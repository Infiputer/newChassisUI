const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const ollamaService = require('../services/ollama-service');

const setupOllama = async () => {
  try {
    console.log('🚀 Setting up OLLAMA models and endpoints...\n');

    // 1. Test OLLAMA connection
    console.log('1. Testing OLLAMA connection...');
    try {
      const ollamaInfo = await ollamaService.testConnection();
      console.log('✅ OLLAMA is running and accessible');
      console.log('📋 Available models:', ollamaInfo.models?.map(m => m.name) || []);
    } catch (error) {
      console.log('❌ OLLAMA connection failed:', error.message);
      console.log('💡 Make sure OLLAMA is running: ollama serve');
      console.log('💡 Or install OLLAMA: https://ollama.ai/download');
      return;
    }

    // 2. Read and execute SQL script
    console.log('\n2. Setting up database models and endpoints...');
    const sqlPath = path.join(__dirname, 'setup-ollama-models.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sqlContent);
    console.log('✅ Database models and endpoints created');

    // 3. Check which models need to be pulled
    console.log('\n3. Checking which models need to be pulled...');
    const requiredModels = ['llama2', 'mistral', 'phi3', 'codellama', 'gemma', 'neural-chat'];
    const availableModels = await ollamaService.getAvailableModels();
    const availableModelNames = availableModels.map(m => m.name);
    
    const modelsToPull = requiredModels.filter(model => !availableModelNames.includes(model));
    
    if (modelsToPull.length === 0) {
      console.log('✅ All required models are already available');
    } else {
      console.log('📥 Models to pull:', modelsToPull);
      console.log('💡 Run these commands to pull the models:');
      modelsToPull.forEach(model => {
        console.log(`   ollama pull ${model}`);
      });
    }

    // 4. Show setup summary
    console.log('\n4. Setup Summary:');
    console.log('✅ OLLAMA connection: Working');
    console.log('✅ Database models: Created');
    console.log('✅ Model endpoints: Configured');
    console.log('📋 Available models in database:');
    
    const dbModels = await pool.query('SELECT name, description FROM models WHERE name IN (\'Llama 2\', \'Mistral\', \'Phi-3\', \'CodeLlama\', \'Gemma\', \'Neural Chat\')');
    dbModels.rows.forEach(model => {
      console.log(`   - ${model.name}: ${model.description}`);
    });

    console.log('\n🎉 OLLAMA setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Pull any missing models using: ollama pull <model-name>');
    console.log('2. Start your ChassisUI application: npm run dev');
    console.log('3. Create an account and start chatting!');

  } catch (error) {
    console.error('❌ Error during OLLAMA setup:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Run the setup
setupOllama(); 