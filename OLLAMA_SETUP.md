# OLLAMA Setup Guide for ChassisUI

This guide will help you set up OLLAMA with ChassisUI to enable local AI model conversations.

## Prerequisites

1. **OLLAMA installed and running**
   - Download from: https://ollama.ai/download
   - Start OLLAMA: `ollama serve`

2. **ChassisUI database setup completed**
   - Run: `npm run setup-db`

## Quick Setup

### 1. Run the OLLAMA Setup Script

```bash
npm run setup-ollama
```

This script will:
- ✅ Test OLLAMA connection
- ✅ Create database models and endpoints
- ✅ Check which models need to be pulled
- ✅ Show setup summary

### 2. Pull Required Models

The setup script will tell you which models need to be pulled. Run these commands:

```bash
# Pull the main models
ollama pull llama2
ollama pull mistral
ollama pull phi3

# Optional models
ollama pull codellama
ollama pull gemma
ollama pull neural-chat
```

### 3. Start ChassisUI

```bash
npm run dev
```

Visit http://localhost:3000 and start chatting!

## Available Models

| Model Name | OLLAMA Name | Description | Size |
|------------|-------------|-------------|------|
| Llama 2 | `llama2` | Meta's Llama 2 model | ~3.8GB |
| Mistral | `mistral` | Mistral-7B model | ~4.1GB |
| Phi-3 | `phi3` | Microsoft Phi-3 model | ~1.8GB |
| CodeLlama | `codellama` | Code-focused Llama | ~3.8GB |
| Gemma | `gemma` | Google's lightweight model | ~2.5GB |
| Neural Chat | `neural-chat` | Intel's conversational model | ~3.8GB |

## Manual Setup (Alternative)

If you prefer to set up manually:

### 1. Create Database Models

Run the SQL script directly:

```bash
cd server
psql $DATABASE_URL -f scripts/setup-ollama-models.sql
```

### 2. Test OLLAMA Connection

```bash
curl http://localhost:11434/api/tags
```

### 3. Pull Models

```bash
# Pull models you want to use
ollama pull llama2
ollama pull mistral
# ... etc
```

## Troubleshooting

### OLLAMA Not Running

```bash
# Start OLLAMA
ollama serve

# Check if it's running
curl http://localhost:11434/api/tags
```

### Model Not Found Error

If you get a "model not found" error:

1. Check available models:
   ```bash
   ollama list
   ```

2. Pull the missing model:
   ```bash
   ollama pull <model-name>
   ```

### Connection Issues

1. **OLLAMA not accessible**: Make sure OLLAMA is running on port 11434
2. **Database connection**: Check your DATABASE_URL in `.env`
3. **Model mapping**: Verify the model names in `ollama-service.js`

### Performance Tips

1. **Use smaller models** for faster responses:
   ```bash
   ollama pull phi3    # ~1.8GB
   ollama pull gemma   # ~2.5GB
   ```

2. **Adjust model parameters** in `ollama-service.js`:
   ```javascript
   options: {
     temperature: 0.7,  // Lower = more focused
     top_p: 0.9,        // Lower = more deterministic
     max_tokens: 2048   // Adjust based on needs
   }
   ```

## Custom Models

To add your own models:

1. **Create a custom model** in OLLAMA:
   ```bash
   ollama create mymodel -f Modelfile
   ```

2. **Add to database**:
   ```sql
   INSERT INTO models (name, description, short_description) 
   VALUES ('My Model', 'My custom model', 'Custom model');
   
   INSERT INTO model_endpoints (model_id, url, is_active) 
   VALUES ('model-uuid', 'http://localhost:11434/api/chat', true);
   ```

3. **Update model mapping** in `ollama-service.js`:
   ```javascript
   const modelNameMap = {
     // ... existing models
     'My Model': 'mymodel'
   };
   ```

## API Endpoints

OLLAMA models are accessed via:
- **URL**: `http://localhost:11434/api/chat`
- **Method**: POST
- **Payload**: 
  ```json
  {
    "model": "llama2",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }
  ```

## Monitoring

Check OLLAMA logs:
```bash
# View OLLAMA logs
ollama logs

# Check model usage
ollama ps
```

## Next Steps

1. **Start chatting** with your local models
2. **Explore conversation branching** by editing messages
3. **Try different models** for different tasks
4. **Customize the interface** to your needs

Happy chatting! 🚀 