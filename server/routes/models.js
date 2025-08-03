const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all available models
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.model_id,
        m.name,
        m.description,
        m.short_description,
        m.long_description,
        m.created_at,
        m.owner_user_id,
        json_agg(
          json_build_object(
            'id', me.id,
            'url', me.url,
            'weight', me.weight,
            'is_active', me.is_active
          )
        ) as endpoints
      FROM models m
      LEFT JOIN model_endpoints me ON m.model_id = me.model_id
      WHERE m.owner_user_id = $1
      GROUP BY m.model_id, m.name, m.description, m.short_description, m.long_description, m.created_at, m.owner_user_id
      ORDER BY m.name
      LIMIT 10
    `, [req.user.user_id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user models:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get trending models
router.get('/trending', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.model_id,
        m.name,
        m.description,
        m.short_description,
        COUNT(mua.id) as usage_count
      FROM models m
      LEFT JOIN model_usage_analytics mua ON m.model_id = mua.model_id
      WHERE mua.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY m.model_id, m.name, m.description, m.short_description
      ORDER BY usage_count DESC
      LIMIT 10
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching trending models:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's recently used models
router.get('/recent', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT
        m.model_id,
        m.name,
        m.description,
        m.short_description,
        MAX(mua.created_at) as last_used
      FROM models m
      INNER JOIN model_usage_analytics mua ON m.model_id = mua.model_id
      WHERE mua.user_id = $1
      GROUP BY m.model_id, m.name, m.description, m.short_description
      ORDER BY last_used DESC
      LIMIT 5
    `, [req.user.user_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recent models:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get model recommendations for user
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    // Get models based on user's usage patterns and trending
    const result = await pool.query(`
      WITH user_models AS (
        SELECT DISTINCT model_id
        FROM model_usage_analytics
        WHERE user_id = $1
      ),
      trending_models AS (
        SELECT 
          m.model_id,
          m.name,
          m.description,
          m.short_description,
          COUNT(mua.id) as usage_count
        FROM models m
        LEFT JOIN model_usage_analytics mua ON m.model_id = mua.model_id
        WHERE mua.created_at >= NOW() - INTERVAL '7 days'
        GROUP BY m.model_id, m.name, m.description, m.short_description
        ORDER BY usage_count DESC
        LIMIT 5
      ),
      all_models AS (
        SELECT 
          m.model_id,
          m.name,
          m.description,
          m.short_description,
          0 as usage_count
        FROM models m
        ORDER BY m.created_at DESC
        LIMIT 10
      )
      SELECT 
        COALESCE(tm.model_id, am.model_id) as model_id,
        COALESCE(tm.name, am.name) as name,
        COALESCE(tm.description, am.description) as description,
        COALESCE(tm.short_description, am.short_description) as short_description,
        COALESCE(tm.usage_count, am.usage_count) as usage_count,
        CASE WHEN um.model_id IS NOT NULL THEN true ELSE false END as used_by_user
      FROM trending_models tm
      FULL OUTER JOIN all_models am ON tm.model_id = am.model_id
      LEFT JOIN user_models um ON COALESCE(tm.model_id, am.model_id) = um.model_id
      ORDER BY used_by_user ASC, usage_count DESC, COALESCE(tm.model_id, am.model_id) DESC
      LIMIT 10
    `, [req.user.user_id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get model details
router.get('/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;

    const result = await pool.query(`
      SELECT 
        m.model_id,
        m.name,
        m.description,
        m.short_description,
        m.long_description,
        m.created_at,
        m.owner_user_id,
        json_agg(
          json_build_object(
            'id', me.id,
            'url', me.url,
            'weight', me.weight,
            'is_active', me.is_active
          )
        ) as endpoints
      FROM models m
      LEFT JOIN model_endpoints me ON m.model_id = me.model_id
      WHERE m.model_id = $1
      GROUP BY m.model_id, m.name, m.description, m.short_description, m.long_description, m.created_at, m.owner_user_id
    `, [modelId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching model:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Track model usage
router.post('/:modelId/usage', authenticateToken, async (req, res) => {
  try {
    const { modelId } = req.params;
    const { usage_type, conversation_id, tokens_used, session_duration } = req.body;

    await pool.query(`
      INSERT INTO model_usage_analytics 
      (model_id, user_id, conversation_id, usage_type, tokens_used, session_duration)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [modelId, req.user.user_id, conversation_id, usage_type, tokens_used, session_duration]);

    res.status(201).json({ message: 'Usage tracked successfully' });
  } catch (error) {
    console.error('Error tracking usage:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Create a new model
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, short_description, long_description, endpoints } = req.body;
    
    // Validate required fields
    if (!name || !endpoints || !Array.isArray(endpoints) || endpoints.length === 0) {
      return res.status(400).json({ 
        error: 'Name and at least one endpoint are required' 
      });
    }

    // Validate endpoints structure
    for (const endpoint of endpoints) {
      if (!endpoint.url || typeof endpoint.weight !== 'number' || endpoint.weight <= 0) {
        return res.status(400).json({ 
          error: 'Each endpoint must have a valid URL and positive weight' 
        });
      }
    }

    // Start a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create the model
      const modelResult = await client.query(`
        INSERT INTO models (name, description, short_description, long_description, owner_user_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING model_id
      `, [name, description, short_description, long_description, req.user.user_id]);

      const modelId = modelResult.rows[0].model_id;

      // Create the endpoints
      for (const endpoint of endpoints) {
        await client.query(`
          INSERT INTO model_endpoints (model_id, url, weight)
          VALUES ($1, $2, $3)
        `, [modelId, endpoint.url, endpoint.weight]);
      }

      await client.query('COMMIT');

      // Return the created model with endpoints
      const finalResult = await pool.query(`
        SELECT 
          m.model_id,
          m.name,
          m.description,
          m.short_description,
          m.long_description,
          m.created_at,
          json_agg(
            json_build_object(
              'id', me.id,
              'url', me.url,
              'weight', me.weight,
              'is_active', me.is_active
            )
          ) as endpoints
        FROM models m
        LEFT JOIN model_endpoints me ON m.model_id = me.model_id
        WHERE m.model_id = $1
        GROUP BY m.model_id, m.name, m.description, m.short_description, m.long_description, m.created_at
      `, [modelId]);

      res.status(201).json(finalResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating model:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a model (only by owner)
router.put('/:modelId', authenticateToken, async (req, res) => {
  try {
    const { modelId } = req.params;
    const { name, description, short_description, long_description, endpoints } = req.body;

    // Check if user owns the model
    const ownershipCheck = await pool.query(`
      SELECT owner_user_id FROM models WHERE model_id = $1
    `, [modelId]);

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }

    if (ownershipCheck.rows[0].owner_user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Only the model owner can update this model' });
    }

    // Start a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update the model
      await client.query(`
        UPDATE models 
        SET name = $1, description = $2, short_description = $3, long_description = $4
        WHERE model_id = $5
      `, [name, description, short_description, long_description, modelId]);

      // Delete existing endpoints
      await client.query(`
        DELETE FROM model_endpoints WHERE model_id = $1
      `, [modelId]);

      // Create new endpoints
      for (const endpoint of endpoints) {
        await client.query(`
          INSERT INTO model_endpoints (model_id, url, weight)
          VALUES ($1, $2, $3)
        `, [modelId, endpoint.url, endpoint.weight]);
      }

      await client.query('COMMIT');

      // Return the updated model
      const finalResult = await pool.query(`
        SELECT 
          m.model_id,
          m.name,
          m.description,
          m.short_description,
          m.long_description,
          m.created_at,
          json_agg(
            json_build_object(
              'id', me.id,
              'url', me.url,
              'weight', me.weight,
              'is_active', me.is_active
            )
          ) as endpoints
        FROM models m
        LEFT JOIN model_endpoints me ON m.model_id = me.model_id
        WHERE m.model_id = $1
        GROUP BY m.model_id, m.name, m.description, m.short_description, m.long_description, m.created_at
      `, [modelId]);

      res.json(finalResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating model:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a model (only by owner)
router.delete('/:modelId', authenticateToken, async (req, res) => {
  try {
    const { modelId } = req.params;

    // Check if user owns the model
    const ownershipCheck = await pool.query(`
      SELECT owner_user_id FROM models WHERE model_id = $1
    `, [modelId]);

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }

    if (ownershipCheck.rows[0].owner_user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Only the model owner can delete this model' });
    }

    // Delete the model (endpoints will be deleted via CASCADE)
    await pool.query(`
      DELETE FROM models WHERE model_id = $1
    `, [modelId]);

    res.json({ message: 'Model deleted successfully' });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 