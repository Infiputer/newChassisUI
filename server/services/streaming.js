const WebSocket = require('ws');
const axios = require('axios');
const pool = require('../config/database');
const modelService = require('./modelService');

class StreamingService {
  constructor() {
    this.activeStreams = new Map(); // conversationId -> stream info
    this.clients = new Map(); // conversationId -> Set of WebSocket clients
    this.modelConnections = new Map(); // modelId -> active connections
  }

  // Initialize WebSocket server
  initialize(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    console.log('WebSocket server initialized');
  }

  // Handle new WebSocket connection
  handleConnection(ws, req) {
    const url = new URL(req.url, 'http://localhost');
    const conversationId = url.searchParams.get('conversationId');
    const token = url.searchParams.get('token');

    if (!conversationId || !token) {
      ws.close(1008, 'Missing conversationId or token');
      return;
    }

    // Verify token and get user
    this.verifyToken(token)
      .then(user => {
        // Verify user has access to conversation
        return this.verifyConversationAccess(conversationId, user.user_id);
      })
      .then(() => {
        this.addClientToConversation(conversationId, ws);
        console.log(`Client connected to conversation: ${conversationId}`);

        // Check if there's an active stream and resume it for this client
        this.resumeStreaming(conversationId, ws);
      })
      .catch(error => {
        console.error('WebSocket authentication error:', error);
        ws.close(1008, 'Authentication failed');
      });

    ws.on('close', () => {
      this.removeClientFromConversation(conversationId, ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.removeClientFromConversation(conversationId, ws);
    });
  }

  // Add client to conversation
  addClientToConversation(conversationId, ws) {
    if (!this.clients.has(conversationId)) {
      this.clients.set(conversationId, new Set());
    }
    this.clients.get(conversationId).add(ws);
  }

  // Remove client from conversation
  removeClientFromConversation(conversationId, ws) {
    const clients = this.clients.get(conversationId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        this.clients.delete(conversationId);
        // Clean up stream if no clients remain
        if (this.activeStreams.has(conversationId)) {
          const info = this.activeStreams.get(conversationId);
          if (info) info.isComplete = true;
          this.activeStreams.delete(conversationId);
          console.log(`[streaming] All clients disconnected, cleaned up stream for conversation: ${conversationId}`);
        }
      }
    }
  }

  // Start streaming response for a conversation
  async startStreaming(conversationId, modelId, messageContent, userId) {
    try {
      console.log(`[streaming] startStreaming called with conversationId=${conversationId}, modelId=${modelId}, userId=${userId}`);
      // Check if stream already exists
      if (this.activeStreams.has(conversationId)) {
        console.log(`[streaming] Stream already active for conversation: ${conversationId}`);
        return;
      }

      // Create stream info
      const streamInfo = {
        conversationId,
        modelId,
        userId,
        startTime: Date.now(),
        clients: new Set(),
        isComplete: false,
        response: ''
      };

      this.activeStreams.set(conversationId, streamInfo);

      // Get model endpoint
      let endpointInfo;
      try {
        endpointInfo = await modelService.getEndpointForModelId(modelId);
      } catch (e) {
        console.error('[streaming] No active endpoints for model', modelId);
        throw e;
      }

      const { endpointUrl: modelEndpoint, modelName } = endpointInfo;
      console.log(`[streaming] Selected endpoint for modelId=${modelId}:`, modelEndpoint, '| modelName=', modelName);
      if (!modelEndpoint) {
        throw new Error('Model endpoint not found');
      }

      // Start background processing
      this.processModelResponse(conversationId, modelEndpoint, modelName, messageContent);

    } catch (error) {
      console.error('[streaming] Error starting stream:', error);
      this.broadcastToConversation(conversationId, {
        type: 'error',
        message: 'Failed to start streaming'
      });
    }
  }

  // Process model response in background
  async processModelResponse(conversationId, modelEndpoint, modelName, messageContent) {
    try {
      console.log(`[streaming] processModelResponse called for conversationId=${conversationId}, endpoint=${modelEndpoint}`);
      const streamInfo = this.activeStreams.get(conversationId);
      if (!streamInfo) return;

      // Find the last user message to use as parent_message_id
      const userMessageResult = await pool.query(`
        SELECT message_id, order_index FROM messages
        WHERE conversation_id = $1 AND role = 'user'
        ORDER BY created_at DESC, order_index DESC
        LIMIT 1
      `, [conversationId]);
      const parentMessageId = userMessageResult.rows[0]?.message_id || null;
      const orderIndex = (userMessageResult.rows[0]?.order_index || 0) + 1;

      // Get branch path for the current user message (context for the model)
      let branchPath = [];
      if (parentMessageId) {
        branchPath = await this.getBranchPath(pool, conversationId, parentMessageId);
      }

      // Build conversation history for the model (role/content only)
      const conversationHistory = branchPath.map(row => ({ role: row.role, content: row.content }));

      // Get model response (this will handle streaming for Ollama endpoints)
      const response = await this.callModelAPI(modelEndpoint, modelName, messageContent, conversationId, conversationHistory);
      console.log(`[streaming] Model API response for conversationId=${conversationId}`);

      // Note: For Ollama endpoints, streaming is handled in callModelAPI
      // For other endpoints, we would need to call streamResponse here

      // Save assistant message to database
      // Check if an assistant message already exists for this parent/order
      const existingAssistant = await pool.query(`
        SELECT message_id FROM messages
        WHERE conversation_id = $1 AND parent_message_id = $2 AND role = 'assistant' AND order_index = $3
        LIMIT 1
      `, [conversationId, parentMessageId, orderIndex]);
      if (existingAssistant.rows.length === 0) {
        const insertResult = await pool.query(`
          INSERT INTO messages (conversation_id, parent_message_id, role, content, order_index)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING message_id
        `, [conversationId, parentMessageId, 'assistant', response, orderIndex]);
        const assistantMessageId = insertResult.rows[0]?.message_id;
        // Update conversation's current leaf and updated_at
        if (assistantMessageId) {
          await pool.query(`
            UPDATE conversations 
            SET current_leaf_message_id = $1, updated_at = NOW()
            WHERE conversation_id = $2
          `, [assistantMessageId, conversationId]);
        }
      }

      // Track usage
      await this.trackUsage(conversationId, streamInfo.modelId, streamInfo.userId);

      // Mark stream as complete and clean up
      if (this.activeStreams.has(conversationId)) {
        const info = this.activeStreams.get(conversationId);
        if (info) info.isComplete = true;
        this.activeStreams.delete(conversationId);
        console.log(`[streaming] Stream completed, cleaned up for conversation: ${conversationId}`);
      }
    } catch (error) {
      console.error('[streaming] Error processing model response:', error);
      this.broadcastToConversation(conversationId, {
        type: 'error',
        message: 'Error processing response'
      });
      if (this.activeStreams.has(conversationId)) {
        const info = this.activeStreams.get(conversationId);
        if (info) info.isComplete = true;
        this.activeStreams.delete(conversationId);
        console.log(`[streaming] Error occurred, cleaned up stream for conversation: ${conversationId}`);
      }
    }
  }

  // Stream response to all connected clients
  async streamResponse(conversationId, response) {
    const clients = this.clients.get(conversationId);
    if (!clients) return;

    // Simulate token-by-token streaming
    const tokens = response.split(' ');

    for (let i = 0; i < tokens.length; i++) {
      const partialResponse = tokens.slice(0, i + 1).join(' ');

      const message = {
        type: 'token',
        content: tokens[i] + (i < tokens.length - 1 ? ' ' : ''),
        isComplete: i === tokens.length - 1
      };

      this.broadcastToConversation(conversationId, message);

      // Small delay to simulate real streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // Broadcast message to all clients in a conversation
  broadcastToConversation(conversationId, message) {
    const clients = this.clients.get(conversationId);
    if (!clients) return;

    const messageStr = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  // Call model API (supports both Ollama and other endpoints)
  async callModelAPI(modelEndpoint, modelName, messageContent, conversationId, conversationHistoryOverride = null) {
    const ollamaIntegration = require('./ollama-integration');
    const conversationIdFinal = conversationId;

    try {
      // Use override if provided
      const conversationHistory = conversationHistoryOverride || await this.getConversationHistory(conversationIdFinal);
      // Append the current user message
      const messages = [
        ...conversationHistory,
        { role: 'user', content: messageContent }
      ];
      console.log('[streaming] Final messages sent to model:', messages);
      console.log(`[streaming] callModelAPI: endpoint=${modelEndpoint}, messageContent=`, messageContent);
      console.log(`[streaming] callModelAPI: conversationHistory=`, conversationHistory);

      // Treat all endpoints as Ollama-compatible chat APIs for streaming
      // Use Ollama integration for streaming
      return new Promise((resolve, reject) => {
        let fullResponse = '';

        ollamaIntegration.streamOllamaResponse(
          modelEndpoint,
          modelName,
          messages, // Pass the new array
          (token, isComplete) => {
            // console.log('[streaming] Broadcasting token:', JSON.stringify({ content: token, isComplete }));

            // Update the stream info with accumulated response for resume functionality
            const streamInfo = this.activeStreams.get(conversationIdFinal);
            if (streamInfo && !isComplete) {
              streamInfo.response += token;
            }

            // Always send the token, even if it's the last one
            this.broadcastToConversation(conversationIdFinal, {
              type: 'token',
              content: token,
              isComplete: isComplete
            });
            if (!isComplete) {
              fullResponse += token;
            } else {
              resolve(fullResponse);
            }
          },
          (title) => {
            // console.log("[Streaming] Got title:", title)
            // Update the conversation title in the database
            pool.query(
              `UPDATE conversations SET title = $1, updated_at = NOW() WHERE conversation_id = $2`,
              [title, conversationIdFinal]
            ).catch(err => {
              console.error("[Streaming] Failed to update conversation title:", err);
            });
          }
        ).catch(error => {
          // Use conversationIdFinal here for error reporting
          this.broadcastToConversation(conversationIdFinal, {
            type: 'error',
            message: 'Error processing response'
          });
          reject(error);
        });
      });
    } catch (error) {
      // Use conversationIdFinal here for error reporting
      this.broadcastToConversation(conversationIdFinal, {
        type: 'error',
        message: 'Error processing response'
      });
      console.error('[streaming] Error calling model API:', error);
      return `I apologize, but I'm having trouble connecting to the AI model right now. Please try again later. Error: ${error.message}`;
    }
  }

  // Get conversation history for context
  async getConversationHistory(conversationId) {
    try {
      const result = await pool.query(`
        SELECT role, content 
        FROM messages 
        WHERE conversation_id = $1 
        ORDER BY created_at ASC
      `, [conversationId]);

      return result.rows.map(row => ({
        role: row.role,
        content: row.content
      }));
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  // Call generic API endpoints
  async callGenericAPI(endpointUrl, messages) {
    try {
      const response = await axios.post(endpointUrl, {
        messages: messages,
        stream: false
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices?.[0]?.message?.content ||
        response.data.response ||
        'No response from model';
    } catch (error) {
      console.error('Error calling generic API:', error);
      throw error;
    }
  }

  // Get model endpoint
  async getModelEndpoint(modelId) {
    const result = await pool.query(`
      SELECT url FROM model_endpoints 
      WHERE model_id = $1 AND is_active = true 
      ORDER BY weight DESC 
      LIMIT 1
    `, [modelId]);

    return result.rows[0]?.url;
  }

  // Track usage analytics
  async trackUsage(conversationId, modelId, userId) {
    try {
      const streamInfo = this.activeStreams.get(conversationId);
      if (!streamInfo) return;

      const sessionDuration = Math.floor((Date.now() - streamInfo.startTime) / 1000);

      await pool.query(`
        INSERT INTO model_usage_analytics 
        (model_id, user_id, conversation_id, usage_type, tokens_used, session_duration)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [modelId, userId, conversationId, 'conversation_complete', streamInfo.response.length, sessionDuration]);

    } catch (error) {
      console.error('Error tracking usage:', error);
    }
  }

  // Verify JWT token
  async verifyToken(token) {
    const jwt = require('jsonwebtoken');

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const result = await pool.query(
        'SELECT user_id, email, name FROM users WHERE user_id = $1',
        [decoded.user_id]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Verify user has access to conversation
  async verifyConversationAccess(conversationId, userId) {
    const result = await pool.query(
      'SELECT conversation_id FROM conversations WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Conversation access denied');
    }
  }

  // Resume streaming for disconnected clients
  async resumeStreaming(conversationId, client) {
    const streamInfo = this.activeStreams.get(conversationId);
    if (streamInfo && !streamInfo.isComplete) {
      console.log(`[streaming] Resuming stream for conversation ${conversationId} with content: "${streamInfo.response}"`);
      // Send current progress to reconnected client
      client.send(JSON.stringify({
        type: 'resume',
        content: streamInfo.response,
        isComplete: false
      }));
    } else {
      console.log(`[streaming] No active stream to resume for conversation ${conversationId}`);
    }
  }

  // Get active streams info
  getActiveStreams() {
    return Array.from(this.activeStreams.keys());
  }

  // Utility: Get branch path for a message (root to leaf)
  async getBranchPath(pool, conversationId, leafMessageId) {
    const { rows } = await pool.query(`
      WITH RECURSIVE branch_path AS (
        SELECT * FROM messages WHERE message_id = $1 AND conversation_id = $2
        UNION ALL
        SELECT m.* FROM messages m
        INNER JOIN branch_path bp ON m.message_id = bp.parent_message_id
        WHERE m.conversation_id = $2
      )
      SELECT * FROM branch_path ORDER BY created_at ASC
    `, [leafMessageId, conversationId]);
    return rows;
  }
}

module.exports = new StreamingService(); 