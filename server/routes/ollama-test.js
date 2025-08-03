const express = require('express');
const ollamaIntegration = require('../services/ollama-integration');

const router = express.Router();

// Test Ollama connection
router.get('/test', async (req, res) => {
  try {
    const result = await ollamaIntegration.testEndpoint('http://localhost:11434');
    res.json(result);
  } catch (error) {
    console.error('Error testing Ollama:', error);
    res.status(500).json({ error: 'Failed to test Ollama connection' });
  }
});

// Get available Ollama models
router.get('/models', async (req, res) => {
  try {
    const models = await ollamaIntegration.getAvailableModels();
    res.json({ models });
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    res.status(500).json({ error: 'Failed to fetch Ollama models' });
  }
});

// Test Ollama API call
router.post('/test-call', async (req, res) => {
  try {
    const { endpoint, message, messages, options } = req.body;
    
    if (!endpoint || (!message && !messages)) {
      return res.status(400).json({ error: 'Endpoint and either message or messages are required' });
    }

    // Prefer full messages array if provided, else fallback to single message
    const finalMessages = Array.isArray(messages) && messages.length > 0
      ? messages
      : [{ role: 'user', content: message }];
    const response = await ollamaIntegration.callOllamaAPI(endpoint, finalMessages, options);
    
    res.json({ response });
  } catch (error) {
    console.error('Error testing Ollama API call:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 