#!/usr/bin/env node

/**
 * Create Sample Models for ChassisUI
 * 
 * This script creates sample models in the database so the recommendations
 * section will have content to display.
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://chassisui_user:chassisui_password@localhost:5432/chassisui_db'
});

// Sample models to create
const SAMPLE_MODELS = [
  {
    name: "Tiny Llama Chat",
    description: "Fast and lightweight chat model for quick responses",
    short_description: "Fast and lightweight chat model",
    long_description: "Tiny Llama is a compact model designed for speed and efficiency. It's perfect for applications that need quick responses without the computational overhead of larger models.",
    endpoints: [
      {
        url: "http://localhost:11434/api/chat",
        weight: 1
      }
    ]
  },
  {
    name: "Mistral 7B",
    description: "Mistral AI's efficient 7B model for balanced performance",
    short_description: "Efficient 7B model",
    long_description: "Mistral AI's model is designed to be efficient while maintaining high performance on a variety of tasks including text generation, summarization, and question answering.",
    endpoints: [
      {
        url: "http://localhost:11434/api/chat/mistral:7b",
        weight: 1
      }
    ]
  },
  {
    name: "Code Llama",
    description: "Specialized model for code generation and programming tasks",
    short_description: "Code generation assistant",
    long_description: "Code Llama is a family of large language models for code based on Llama 2, providing state-of-the-art performance among open models, infilling capabilities, support for large input contexts, and zero-shot instruction following ability for programming tasks.",
    endpoints: [
      {
        url: "http://localhost:11434/api/chat/codellama",
        weight: 1
      }
    ]
  },
  {
    name: "Llama 3.2",
    description: "Meta's latest Llama 3.2 model for general conversation",
    short_description: "Latest Llama model",
    long_description: "Llama 3.2 is the latest iteration of Meta's large language model family, offering improved performance and capabilities for a wide range of conversational and reasoning tasks.",
    endpoints: [
      {
        url: "http://localhost:11434/api/chat/llama3.2:latest",
        weight: 1
      }
    ]
  },
  {
    name: "LLaVA Vision",
    description: "Vision and language model for image understanding",
    short_description: "Vision and language model",
    long_description: "LLaVA (Large Language and Vision Assistant) is a multimodal model that can understand and reason about images while maintaining strong language capabilities.",
    endpoints: [
      {
        url: "http://localhost:11434/api/chat/llava:latest",
        weight: 1
      }
    ]
  },
  {
    name: "DeepSeek R1",
    description: "DeepSeek's reasoning model for complex problem solving",
    short_description: "Reasoning and problem solving",
    long_description: "DeepSeek R1 is designed for complex reasoning tasks, mathematical problem solving, and analytical thinking with improved performance on challenging benchmarks.",
    endpoints: [
      {
        url: "http://localhost:11434/api/chat/deepseek-r1:1.5b",
        weight: 1
      }
    ]
  },
  {
    name: "Phi-3",
    description: "Microsoft's Phi-3 model for efficient reasoning",
    short_description: "Efficient reasoning model",
    long_description: "Phi-3 is Microsoft's latest language model designed for efficient reasoning and instruction following, offering strong performance with lower computational requirements.",
    endpoints: [
      {
        url: "http://localhost:11434/api/chat/phi3:14b",
        weight: 1
      }
    ]
  }
];

async function createSampleModels() {
  console.log('🚀 Creating sample models for ChassisUI...\n');

  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Check if models already exist
    const existingModels = await pool.query('SELECT COUNT(*) as count FROM models');
    if (existingModels.rows[0].count > 0) {
      console.log(`📋 Found ${existingModels.rows[0].count} existing models`);
      console.log('💡 Sample models may already exist. Skipping creation.\n');
      return;
    }

    // Create sample models
    for (const modelConfig of SAMPLE_MODELS) {
      console.log(`📝 Creating model: ${modelConfig.name}`);
      
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Create the model
        const modelResult = await client.query(`
          INSERT INTO models (name, description, short_description, long_description, owner_user_id)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING model_id
        `, [modelConfig.name, modelConfig.description, modelConfig.short_description, modelConfig.long_description, '00000000-0000-0000-0000-000000000001']); // Default system user

        const modelId = modelResult.rows[0].model_id;

        // Create the endpoints
        for (const endpoint of modelConfig.endpoints) {
          await client.query(`
            INSERT INTO model_endpoints (model_id, url, weight)
            VALUES ($1, $2, $3)
          `, [modelId, endpoint.url, endpoint.weight]);
        }

        await client.query('COMMIT');
        console.log(`✅ Created model: ${modelConfig.name} (ID: ${modelId})`);

      } catch (error) {
        await client.query('ROLLBACK');
        console.log(`❌ Failed to create model ${modelConfig.name}:`, error.message);
      } finally {
        client.release();
      }
    }

    console.log('\n🎉 Sample models created successfully!');
    console.log('\n📖 Next steps:');
    console.log('   1. Start ChassisUI: npm run dev');
    console.log('   2. Open http://localhost:3000');
    console.log('   3. Check the Models section to see your new models');
    console.log('   4. The recommendations section should now show these models');

  } catch (error) {
    console.error('❌ Error creating sample models:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  createSampleModels().catch(console.error);
}

module.exports = { createSampleModels, SAMPLE_MODELS }; 