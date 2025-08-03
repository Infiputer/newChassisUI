#!/usr/bin/env node

/**
 * Sample Ollama Endpoint Setup for ChassisUI
 * 
 * This script demonstrates how to create models with Ollama endpoints
 * Run this after starting your ChassisUI server
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3001/api';
const AUTH_TOKEN = 'your-jwt-token-here'; // Replace with actual token from login

// Sample Ollama endpoint configurations
const OLLAMA_MODELS = [
  {
    name: "Llama 2 Chat",
    description: "Meta's Llama 2 model for general conversation",
    short_description: "General purpose chat model",
    long_description: "Llama 2 is a collection of pretrained and fine-tuned large language models (LLMs) ranging in scale from 7 billion to 70 billion parameters. This model is optimized for chat and conversation.",
    endpoints: [
      {
        url: "http://localhost:11434/api/chat",
        weight: 1
      }
    ]
  },
  {
    name: "Code Llama",
    description: "Specialized model for code generation and programming",
    short_description: "Code generation and programming assistant",
    long_description: "Code Llama is a family of large language models for code based on Llama 2, providing state-of-the-art performance among open models, infilling capabilities, support for large input contexts, and zero-shot instruction following ability for programming tasks.",
    endpoints: [
      {
        url: "http://localhost:11434/api/chat/codellama",
        weight: 1
      }
    ]
  },
  {
    name: "Mistral AI",
    description: "Mistral AI's efficient language model",
    short_description: "Fast and efficient language model",
    long_description: "Mistral AI's model is designed to be efficient while maintaining high performance on a variety of tasks including text generation, summarization, and question answering.",
    endpoints: [
      {
        url: "http://localhost:11434/api/chat/mistral",
        weight: 1
      }
    ]
  },
  {
    name: "Load Balanced Llama",
    description: "High availability setup with multiple Ollama instances",
    short_description: "Multiple instances for reliability",
    long_description: "This model uses multiple Ollama instances for load balancing and high availability. Requests are distributed across different instances to ensure reliability and better performance.",
    endpoints: [
      {
        url: "http://localhost:11434/api/chat/llama2",
        weight: 1
      },
      {
        url: "http://localhost:11435/api/chat/llama2",
        weight: 1
      },
      {
        url: "http://localhost:11436/api/chat/llama2",
        weight: 1
      }
    ]
  },
  {
    name: "Tiny Llama",
    description: "Fast and lightweight model for quick responses",
    short_description: "Fast and lightweight model",
    long_description: "Tiny Llama is a compact model designed for speed and efficiency. It's perfect for applications that need quick responses without the computational overhead of larger models.",
    endpoints: [
      {
        url: "http://localhost:11434/api/chat/tinyllama",
        weight: 1
      }
    ]
  }
];

// API helper functions
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`
  }
});

async function testOllamaConnection() {
  console.log('🔍 Testing Ollama connection...');
  try {
    const response = await axios.get('http://localhost:11434/api/tags');
    console.log('✅ Ollama is running and accessible');
    console.log('📋 Available models:', response.data.models.map(m => m.name).join(', '));
    return true;
  } catch (error) {
    console.log('❌ Ollama is not accessible. Make sure to:');
    console.log('   1. Install Ollama: https://ollama.ai');
    console.log('   2. Start Ollama: ollama serve');
    console.log('   3. Pull a model: ollama pull llama2');
    return false;
  }
}

async function testChassisUIConnection() {
  console.log('🔍 Testing ChassisUI connection...');
  try {
    const response = await api.get('/models');
    console.log('✅ ChassisUI is running and accessible');
    return true;
  } catch (error) {
    console.log('❌ ChassisUI is not accessible. Make sure to:');
    console.log('   1. Start the server: npm run dev');
    console.log('   2. Update AUTH_TOKEN in this script');
    return false;
  }
}

async function createModel(modelConfig) {
  try {
    console.log(`📝 Creating model: ${modelConfig.name}`);
    const response = await api.post('/models', modelConfig);
    console.log(`✅ Created model: ${response.data.name} (ID: ${response.data.model_id})`);
    return response.data;
  } catch (error) {
    console.log(`❌ Failed to create model ${modelConfig.name}:`, error.response?.data?.error || error.message);
    return null;
  }
}

async function listExistingModels() {
  try {
    const response = await api.get('/models');
    console.log('📋 Existing models:');
    response.data.forEach(model => {
      console.log(`   - ${model.name} (${model.endpoints?.length || 0} endpoints)`);
    });
    return response.data;
  } catch (error) {
    console.log('❌ Failed to list models:', error.message);
    return [];
  }
}

async function testOllamaAPI() {
  console.log('🧪 Testing Ollama API integration...');
  try {
    const response = await api.post('/ollama/test-call', {
      endpoint: 'http://localhost:11434/api/chat',
      message: 'Hello! Can you tell me a short joke?',
      options: {
        temperature: 0.7,
        max_tokens: 100
      }
    });
    console.log('✅ Ollama API test successful');
    console.log('🤖 Response:', response.data.response.substring(0, 100) + '...');
    return true;
  } catch (error) {
    console.log('❌ Ollama API test failed:', error.response?.data?.error || error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 ChassisUI Ollama Setup Script');
  console.log('================================\n');

  // Test connections
  const ollamaOk = await testOllamaConnection();
  const chassisUIOk = await testChassisUIConnection();

  if (!ollamaOk || !chassisUIOk) {
    console.log('\n❌ Setup incomplete. Please fix the issues above and run again.');
    return;
  }

  console.log('\n✅ All connections verified!\n');

  // Test Ollama API integration
  await testOllamaAPI();

  // List existing models
  console.log('\n📋 Current models in ChassisUI:');
  await listExistingModels();

  // Create sample models
  console.log('\n🔧 Creating sample Ollama models...\n');
  
  for (const modelConfig of OLLAMA_MODELS) {
    await createModel(modelConfig);
    console.log(''); // Empty line for readability
  }

  console.log('🎉 Setup complete!');
  console.log('\n📖 Next steps:');
  console.log('   1. Open ChassisUI in your browser: http://localhost:3000');
  console.log('   2. Go to the Models section to see your new models');
  console.log('   3. Start a conversation using one of the Ollama models');
  console.log('   4. Check the OLLAMA_INTEGRATION.md file for more details');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  OLLAMA_MODELS,
  testOllamaConnection,
  testChassisUIConnection,
  createModel,
  listExistingModels,
  testOllamaAPI
}; 