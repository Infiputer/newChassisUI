const axios = require('axios');
const pool = require('../config/database');

class OllamaService {
  constructor() {
    this.baseUrl = 'http://localhost:11434';
    this.timeout = 30000; // 30 seconds
  }

  // Get model name from database
  async getModelName(modelId) {
    try {
      const result = await pool.query(
        'SELECT name FROM models WHERE model_id = $1',
        [modelId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Model not found');
      }
      
      // Map model names to OLLAMA model names
      const modelNameMap = {
        'Llama 2': 'llama2',
        'Mistral': 'mistral',
        'Phi-3': 'phi3',
        'CodeLlama': 'codellama',
        'Gemma': 'gemma',
        'Neural Chat': 'neural-chat'
      };
      
      const dbModelName = result.rows[0].name;
      return modelNameMap[dbModelName] || dbModelName.toLowerCase().replace(/\s+/g, '-');
    } catch (error) {
      console.error('Error getting model name:', error);
      throw error;
    }
  }

  // Build conversation history for OLLAMA
  async buildConversationHistory(conversationId, parentMessageId = null) {
    try {
      let query = `
        WITH RECURSIVE message_tree AS (
          SELECT 
            message_id, 
            parent_message_id, 
            role, 
            content, 
            order_index,
            0 as level
          FROM messages 
          WHERE conversation_id = $1 AND parent_message_id IS NULL
          
          UNION ALL
          
          SELECT 
            m.message_id, 
            m.parent_message_id, 
            m.role, 
            m.content, 
            m.order_index,
            mt.level + 1
          FROM messages m
          INNER JOIN message_tree mt ON m.parent_message_id = mt.message_id
          WHERE m.conversation_id = $1
        )
        SELECT role, content, order_index, level
        FROM message_tree
        ORDER BY level, order_index
      `;

      const result = await pool.query(query, [conversationId]);
      
      // Convert to OLLAMA format
      const messages = result.rows.map(row => ({
        role: row.role,
        content: row.content
      }));

      return messages;
    } catch (error) {
      console.error('Error building conversation history:', error);
      throw error;
    }
  }

  // Call OLLAMA API with streaming
  async streamResponse(modelId, conversationId, userMessage, onToken) {
    try {
      const ollamaModelName = await this.getModelName(modelId);
      const conversationHistory = await this.buildConversationHistory(conversationId);
      
      // Add the new user message
      const messages = [
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      const payload = {
        model: ollamaModelName,
        messages: messages,
        stream: true,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 2048
        }
      };

      console.log(`Calling OLLAMA with model: ${ollamaModelName}`);
      console.log(`Messages count: ${messages.length}`);

      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        payload,
        {
          timeout: this.timeout,
          responseType: 'stream',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      let fullResponse = '';
      
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          try {
            const data = JSON.parse(line);
            
            if (data.message && data.message.content) {
              const token = data.message.content;
              fullResponse += token;
              
              // Send token to callback
              if (onToken) {
                onToken(token, false);
              }
            }
            
            if (data.done) {
              // Send completion signal
              if (onToken) {
                onToken('', true);
              }
              break;
            }
          } catch (parseError) {
            console.error('Error parsing OLLAMA response:', parseError);
          }
        }
      });

      response.data.on('end', () => {
        console.log('OLLAMA stream completed');
        return fullResponse;
      });

      response.data.on('error', (error) => {
        console.error('OLLAMA stream error:', error);
        throw error;
      });

    } catch (error) {
      console.error('Error calling OLLAMA:', error);
      
      // Check if it's a model not found error
      if (error.response && error.response.status === 404) {
        throw new Error(`OLLAMA model not found. Please ensure the model is pulled: ollama pull ${ollamaModelName}`);
      }
      
      throw error;
    }
  }

  // Test OLLAMA connection
  async testConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });
      
      console.log('OLLAMA connection successful');
      console.log('Available models:', response.data.models?.map(m => m.name) || []);
      
      return response.data;
    } catch (error) {
      console.error('OLLAMA connection failed:', error.message);
      throw new Error('OLLAMA is not running or not accessible at http://localhost:11434');
    }
  }

  // Get available models from OLLAMA
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });
      
      return response.data.models || [];
    } catch (error) {
      console.error('Error getting OLLAMA models:', error);
      return [];
    }
  }

  // Pull a model to OLLAMA
  async pullModel(modelName) {
    try {
      console.log(`Pulling model: ${modelName}`);
      
      const response = await axios.post(
        `${this.baseUrl}/api/pull`,
        { name: modelName },
        { timeout: 300000 } // 5 minutes timeout for pulling
      );
      
      console.log(`Model ${modelName} pulled successfully`);
      return response.data;
    } catch (error) {
      console.error(`Error pulling model ${modelName}:`, error);
      throw error;
    }
  }
}

module.exports = new OllamaService(); 