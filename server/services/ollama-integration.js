const axios = require('axios');

class OllamaIntegrationService {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Check if an endpoint is an Ollama endpoint
   */
  isOllamaEndpoint(url) {
    return url.includes('localhost:11434') || url.includes('ollama') || url.includes('/api/generate') || url.includes('/api/chat');
  }

  /**
   * Get the model name from the URL or use a default
   */
  getModelFromUrl(url) {
    // Extract model name from URL if present
    const urlParts = url.split('/');
    const modelIndex = urlParts.findIndex(part => part === 'api');
    if (modelIndex !== -1 && urlParts[modelIndex + 2]) {
      return urlParts[modelIndex + 2];
    }

    // If no model in URL, try to extract from the last part
    const lastPart = urlParts[urlParts.length - 1];
    if (lastPart && lastPart !== 'chat' && lastPart !== 'generate') {
      return lastPart;
    }

    return 'tinyllama:latest'; // Default model
  }

  /**
   * Format conversation history for Ollama
   */
  formatConversationHistory(messages) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Make a request to Ollama API
   */
  async callOllamaAPI(endpointUrl, messages, options = {}) {
    try {
      const modelName = this.getModelFromUrl(endpointUrl);
      const isChatEndpoint = endpointUrl.includes('/api/chat');

      const payload = {
        model: modelName,
        ...(isChatEndpoint ? { messages } : { prompt: messages[messages.length - 1].content }),
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9,
          max_tokens: options.max_tokens || 2048,
          ...options
        }
      };

      console.log(`Calling Ollama API: ${endpointUrl}`);
      console.log(`Model: ${modelName}, Messages: ${messages.length}`);

      const response = await axios.post(endpointUrl, payload, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (isChatEndpoint) {
        return response.data.message?.content || response.data.response || 'No response from model';
      } else {
        return response.data.response || 'No response from model';
      }
    } catch (error) {
      console.error('Error calling Ollama API:', error);
      throw new Error(`Ollama API error: ${error.message}`);
    }
  }

  /**
   * Stream response from Ollama API
   */
  async streamOllamaResponse(endpointUrl, modelName, messages, onToken, onTitle, options = {}) {
    try {
      // Determine final URL: If endpointUrl already contains /chat or /api/chat use as is, else append appropriately.
      let postUrl = endpointUrl;
      if (!postUrl.match(/\/chat(\?|$)/)) {
        // Append path depending on whether it's port 11434 (Ollama) or custom proxy (e.g., Shrek)
        if (postUrl.includes('11434')) {
          postUrl = postUrl.replace(/\/$/, '') + '/api/chat';
        } else {
          postUrl = postUrl.replace(/\/$/, '') + '/chat';
        }
      }
      const isChatEndpoint = true;

      console.log('[ollama] Messages:', messages);

      const payload = {
        model: modelName,
        messages: messages, // Always use messages array for /api/chat
        stream: true,
        title: true
      };

      console.log(`[ollama] Streaming from Ollama API: ${endpointUrl}`);
      console.log(`[ollama] Payload:`, JSON.stringify(payload));
      console.log('[ollama] Sending payload to Ollama:', JSON.stringify(payload, null, 2));
      console.log(`[ollama] Model: ${modelName}, Messages: ${messages.length}`);
      // Print the payload for debugging
      console.log('[ollama] Final payload sent to Ollama:', JSON.stringify(payload, null, 2));

      const response = await axios.post(postUrl, payload, {
        timeout: this.timeout,
        responseType: 'stream',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      let fullResponse = '';

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          // console.log(`[ollama] Raw chunk:`, chunk.toString());
          const lines = chunk.toString().split('\n');

          for (const line of lines) {
            if (line.trim() === '') continue;
            // console.log(`[ollama] Parsed line:`, line);

            try {
              const data = JSON.parse(line);
              // console.log(`[ollama] Parsed data:`, data);
              if (data.title) {
                // If data.title contains international (multi-line) text, split and get the first line
                const firstLine = typeof data.title === 'string' ? data.title.split('\n')[0] : data.title;
                console.log('[ollama] Title:', firstLine);
                onTitle(firstLine);
              }
              else if (data.message && typeof data.message.content === 'string') {
                // Always forward the token from data.message.content
                // console.log('[ollama] Forwarding data.message.content token');
                const token = data.message.content;
                fullResponse += token;
                onToken(token, false);
                if (data.done) {
                  console.log('[ollama] Received done=true, resolving stream');
                  onToken('', true);
                  resolve(fullResponse);
                }
                // Do not continue/break here; allow next lines to process next chunk
              } else if (typeof data.response === 'string') {
                // Fallback: handle data.response as a token
                console.log('[ollama] Forwarding data.response token');
                const token = data.response;
                fullResponse += token;
                onToken(token, false);
                if (data.done) {
                  console.log('[ollama] Received done=true (response), resolving stream');
                  onToken('', true);
                  resolve(fullResponse);
                }
              } else {
                // Only warn if message.content is missing or not a string
                console.warn('[ollama] Ollama stream: missing or invalid data.message.content and data.response or data.title', data);
              }
            } catch (parseError) {
              console.error('Error parsing Ollama stream response:', parseError, 'Raw line:', line);
            }
          }
        });

        response.data.on('error', (error) => {
          console.error('Ollama stream error:', error);
          reject(error);
        });

        response.data.on('end', () => {
          if (!fullResponse) {
            // Only reject if no tokens were ever sent
            reject(new Error('No response received from Ollama'));
          } else {
            // If tokens were sent, resolve the promise (if not already resolved)
            try {
              resolve(fullResponse);
            } catch (e) { }
          }
        });
      });
    } catch (error) {
      console.error('Error streaming from Ollama API:', error);
      throw new Error(`Ollama streaming error: ${error.message}`);
    }
  }

  /**
   * Test if an Ollama endpoint is available
   */
  async testEndpoint(endpointUrl) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });
      return {
        available: true,
        models: response.data.models || []
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Get available models from Ollama
   */
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });
      return response.data.models || [];
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      return [];
    }
  }
}

module.exports = new OllamaIntegrationService(); 