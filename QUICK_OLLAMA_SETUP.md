# Quick Ollama Setup for ChassisUI

This is a quick guide to get Ollama working with ChassisUI in just a few steps.

## Prerequisites

1. **Ollama installed and running**
2. **ChassisUI server running**
3. **At least one Ollama model pulled**

## Step 1: Install and Start Ollama

```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama
ollama serve

# Pull a model (in a new terminal)
ollama pull llama2
```

## Step 2: Start ChassisUI

```bash
# In your ChassisUI directory
npm run dev
```

## Step 3: Create an Ollama Model in ChassisUI

1. **Open ChassisUI** in your browser: `http://localhost:3000`
2. **Login** to your account
3. **Go to Models** section (click "Models" in the sidebar)
4. **Click "Create Model"**
5. **Fill in the form:**

### Basic Ollama Model Configuration

**Model Name:** `Llama 2 Chat`
**Description:** `Meta's Llama 2 model for general conversation`
**Short Description:** `General purpose chat model`

**Endpoints:**
- **URL:** `http://localhost:11434/api/chat`
- **Weight:** `1`

### Advanced Configuration (Optional)

**Model Name:** `Code Llama`
**Description:** `Specialized model for code generation`
**Short Description:** `Code generation assistant`

**Endpoints:**
- **URL:** `http://localhost:11434/api/chat/codellama`
- **Weight:** `1`

## Step 4: Test Your Model

1. **Go to Chat** section
2. **Select your new Ollama model** from the dropdown
3. **Start a conversation** and test it!

## Sample Endpoint URLs

Here are some common Ollama endpoint configurations:

### Basic Chat
```
URL: http://localhost:11434/api/chat
```

### Model-Specific Chat
```
URL: http://localhost:11434/api/chat/llama2
URL: http://localhost:11434/api/chat/codellama
URL: http://localhost:11434/api/chat/mistral
```

### Single Turn Generation
```
URL: http://localhost:11434/api/generate
```

### Load Balancing (Multiple Instances)
```
URL: http://localhost:11434/api/chat (Weight: 1)
URL: http://localhost:11435/api/chat (Weight: 1)
URL: http://localhost:11436/api/chat (Weight: 1)
```

## Troubleshooting

### Ollama Not Accessible
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not running, start it
ollama serve
```

### Model Not Found
```bash
# List available models
ollama list

# Pull a model if needed
ollama pull llama2
```

### ChassisUI Connection Issues
```bash
# Check if server is running
curl http://localhost:3001/health

# Restart if needed
npm run dev
```

## Quick Test Commands

Test Ollama directly:
```bash
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama2",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

Test ChassisUI Ollama integration:
```bash
curl http://localhost:3001/api/ollama/test
```

## Popular Models to Try

```bash
# General purpose
ollama pull llama2
ollama pull mistral

# Code generation
ollama pull codellama
ollama pull codellama:python

# Fast and lightweight
ollama pull tinyllama
ollama pull deepseek-r1:1.5b
```

## Next Steps

1. **Explore different models** - Try different Ollama models for different tasks
2. **Set up load balancing** - Use multiple Ollama instances for reliability
3. **Customize parameters** - Adjust temperature, max tokens, etc.
4. **Check the full documentation** - See `OLLAMA_INTEGRATION.md` for advanced features

## Need Help?

- **Ollama issues**: Check [ollama.ai](https://ollama.ai)
- **ChassisUI issues**: Check the main README.md
- **Integration issues**: Check OLLAMA_INTEGRATION.md 