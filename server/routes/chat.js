const express = require('express');
const http = require('http');
const https = require('https');
const { getEndpointForModelId } = require('../services/modelService');
const router = express.Router();

/**
 * POST /:modelId
 * Proxy chat request to a selected endpoint for the given modelId.
 * Body is expected to contain { messages: [...], ... }.
 * The proxy will replace/insert the "model" field with the model's name.
 * Response is streamed (NDJSON) back to the client.
 */
router.post('/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;

    // Retrieve endpoint and model name
    const { endpointUrl, modelName } = await getEndpointForModelId(modelId);

    // Build payload, overriding model field
    const payload = {
      ...req.body,
      model: modelName
    };

    const url = new URL(endpointUrl);
    const protocol = url.protocol === 'https:' ? https : http;

    const proxyReq = protocol.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json',
          // Preserve other headers except content-length (we will set automatically)
        }
      },
      (proxyRes) => {
        // Forward status and headers
        res.status(proxyRes.statusCode);
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          // Avoid setting transfer-encoding to let Node handle chunked encoding
          if (key.toLowerCase() === 'transfer-encoding') continue;
          res.setHeader(key, value);
        }
        res.setHeader('Content-Type', 'application/x-ndjson');
        // Pipe streamed response
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      console.error('Chat proxy error:', err);
      res.status(502).json({ error: 'Failed to connect to model endpoint' });
    });

    // Write payload
    proxyReq.write(JSON.stringify(payload));
    proxyReq.end();
  } catch (error) {
    console.error('Error handling chat request:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router; 