const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const conversationRoutes = require('./routes/conversations');
const modelRoutes = require('./routes/models');
const ollamaTestRoutes = require('./routes/ollama-test');
const streamingService = require('./services/streaming');
const { authenticateToken } = require('./middleware/auth');
const chatRoutes = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration - Allow all origins in development
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 3000, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global request logger
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.originalUrl} | body:`, req.body);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('[API] GET /health');
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/ollama', ollamaTestRoutes);
app.use('/api/chat', chatRoutes);

// Streaming endpoint
app.post('/api/stream/:conversationId', authenticateToken, async (req, res) => {
  try {
    console.log('[API] POST /api/stream/' + req.params.conversationId, '| body:', req.body);
    const { conversationId } = req.params;
    const { modelId, messageContent } = req.body;
    const userId = req.user.user_id;

    // Start streaming
    await streamingService.startStreaming(conversationId, modelId, messageContent, userId);
    console.log('[API] Streaming started for conversation:', conversationId);
    res.json({ message: 'Streaming started' });
  } catch (error) {
    console.error('[API] Error starting stream:', error);
    res.status(500).json({ error: 'Failed to start streaming' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[API] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  console.warn('[API] 404 Not Found:', req.originalUrl);
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`ChassisUI Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Initialize WebSocket server
streamingService.initialize(server);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 