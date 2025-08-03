# Ollama Integration with ChassisUI

This guide explains how to use Ollama as model endpoints in your ChassisUI application.

## What is Ollama?

Ollama is an open-source tool that allows you to run large language models locally on your machine. It provides a simple REST API that can be used as an endpoint in ChassisUI.

## Prerequisites

1. **Install Ollama**: Follow the official installation guide at [ollama.ai](https://ollama.ai)
2. **Pull a model**: Run `ollama pull llama2` (or any other model you want to use)
3. **Start Ollama**: Run `ollama serve` to start the Ollama server

## Ollama API Endpoints

Ollama provides several API endpoints:

- **Generate**: `POST http://localhost:11434/api/generate` - For single-turn completions
- **Chat**: `POST http://localhost:11434/api/chat` - For multi-turn conversations
- **List Models**: `GET http://localhost:11434/api/tags` - Get available models

## Setting up Ollama Models in ChassisUI

### 1. Basic Ollama Model Setup

When creating a model in ChassisUI, you can use these endpoint URLs:

**For chat conversations (recommended):**
```
URL: http://localhost:11434/api/chat
Weight: 1
```

**For single-turn completions:**
```
URL: http://localhost:11434/api/generate
Weight: 1
```

### 2. Model-Specific Endpoints

You can also specify the model name in the URL:

```
URL: http://localhost:11434/api/chat/llama2
Weight: 1
```

```
URL: http://localhost:11434/api/chat/codellama
Weight: 1
```

### 3. Load Balancing with Multiple Ollama Instances

If you have multiple Ollama instances running on different ports:

```
URL: http://localhost:11434/api/chat (Weight: 1)
URL: http://localhost:11435/api/chat (Weight: 1)
URL: http://localhost:11436/api/chat (Weight: 1)
```

## Testing Ollama Integration

### 1. Test Connection

Check if Ollama is running and accessible:

```bash
curl http://localhost:11434/api/tags
```

### 2. Test via ChassisUI API

Use the built-in test endpoints:

```bash
# Test connection
curl http://localhost:3001/api/ollama/test

# Get available models
curl http://localhost:3001/api/ollama/models

# Test API call
curl -X POST http://localhost:3001/api/ollama/test-call \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "http://localhost:11434/api/chat",
    "message": "Hello, how are you?",
    "options": {
      "temperature": 0.7
    }
  }'
```

## Popular Ollama Models

Here are some popular models you can use:

### Text Generation Models
- `llama2` - Meta's Llama 2 model
- `llama2:13b` - Larger Llama 2 model
- `llama2:70b` - Largest Llama 2 model
- `mistral` - Mistral AI's model
- `codellama` - Code-focused Llama model
- `neural-chat` - Intel's conversational model

### Code Models
- `codellama` - General code generation
- `codellama:python` - Python-specific
- `codellama:instruct` - Instruction-tuned for code

### Multimodal Models
- `llava` - Vision and language model
- `bakllava` - Another vision-language model

## Pulling Models

To use a model, you need to pull it first:

```bash
# Pull a model
ollama pull llama2

# Pull a specific version
ollama pull llama2:13b

# Pull a custom model
ollama pull codellama:python
```

## Configuration Options

When creating models in ChassisUI, you can specify various options:

### Temperature
Controls randomness in responses (0.0 = deterministic, 1.0 = very random)

### Top-p
Controls diversity via nucleus sampling (0.0 to 1.0)

### Max Tokens
Maximum number of tokens to generate

### Example Configuration
```json
{
  "temperature": 0.7,
  "top_p": 0.9,
  "max_tokens": 2048
}
```

## Environment Variables

You can configure Ollama settings via environment variables:

```bash
# Set Ollama base URL (if not running on localhost:11434)
export OLLAMA_BASE_URL=http://your-ollama-server:11434

# Set timeout for API calls (default: 30 seconds)
export OLLAMA_TIMEOUT=60000
```

## Troubleshooting

### Common Issues

1. **Ollama not running**
   - Start Ollama: `ollama serve`
   - Check if it's running: `curl http://localhost:11434/api/tags`

2. **Model not found**
   - Pull the model: `ollama pull model-name`
   - Check available models: `ollama list`

3. **Connection refused**
   - Verify Ollama is running on the correct port
   - Check firewall settings
   - Ensure the URL in ChassisUI is correct

4. **Slow responses**
   - Use smaller models for faster responses
   - Adjust temperature and other parameters
   - Consider using multiple Ollama instances for load balancing

### Performance Tips

1. **Use appropriate model sizes**
   - Smaller models (7B) for faster responses
   - Larger models (13B, 70B) for better quality

2. **Optimize parameters**
   - Lower temperature for more focused responses
   - Adjust max_tokens based on your needs

3. **Load balancing**
   - Run multiple Ollama instances
   - Use different models for different tasks

## Advanced Usage

### Custom Model Endpoints

You can create custom endpoints for specific use cases:

```
URL: http://localhost:11434/api/chat/llama2
Weight: 1
Description: General purpose chat
```

```
URL: http://localhost:11434/api/chat/codellama
Weight: 1
Description: Code generation
```

### Model Switching

Create multiple models in ChassisUI and switch between them based on the task:

- **General Chat**: Use `llama2` or `mistral`
- **Code Generation**: Use `codellama`
- **Creative Writing**: Use models with higher temperature

### Monitoring and Analytics

ChassisUI tracks usage analytics for all models, including Ollama models. You can monitor:

- Response times
- Token usage
- User interactions
- Model performance

## Security Considerations

1. **Local Deployment**: Ollama runs locally, keeping your data private
2. **Network Access**: Ensure Ollama is only accessible from trusted networks
3. **Model Validation**: Verify model sources and integrity
4. **Resource Limits**: Monitor system resources when running large models

## Support

For issues with:
- **ChassisUI**: Check the main documentation
- **Ollama**: Visit [ollama.ai](https://ollama.ai) or their GitHub repository
- **Model-specific issues**: Check the model's documentation

## Example Model Configurations

### Basic Chat Model
```json
{
  "name": "Llama 2 Chat",
  "description": "General purpose chat model",
  "endpoints": [
    {
      "url": "http://localhost:11434/api/chat/llama2",
      "weight": 1
    }
  ]
}
```

### Code Generation Model
```json
{
  "name": "Code Llama",
  "description": "Specialized for code generation",
  "endpoints": [
    {
      "url": "http://localhost:11434/api/chat/codellama",
      "weight": 1
    }
  ]
}
```

### Load Balanced Model
```json
{
  "name": "High Availability Chat",
  "description": "Multiple Ollama instances for reliability",
  "endpoints": [
    {
      "url": "http://localhost:11434/api/chat/llama2",
      "weight": 1
    },
    {
      "url": "http://localhost:11435/api/chat/llama2",
      "weight": 1
    },
    {
      "url": "http://localhost:11436/api/chat/llama2",
      "weight": 1
    }
  ]
}
``` 