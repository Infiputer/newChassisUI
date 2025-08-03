const pool = require('../config/database');

/**
 * Select an active endpoint for a given model_id using weighted random selection.
 * @param {string} modelId - UUID of the model.
 * @returns {Promise<{ endpointUrl: string, modelName: string }>}
 * @throws {Error} If the model does not exist or has no active endpoints.
 */
async function getEndpointForModelId(modelId) {
  const { rows } = await pool.query(
    `SELECT m.name AS model_name, me.url, me.weight
     FROM models m
     JOIN model_endpoints me ON m.model_id = me.model_id
     WHERE m.model_id = $1 AND me.is_active = true`,
    [modelId]
  );

  if (rows.length === 0) {
    throw new Error('No active endpoints found for model');
  }

  // Weighted random selection
  const totalWeight = rows.reduce((sum, row) => sum + (row.weight || 1), 0);
  let r = Math.random() * totalWeight;
  let selected = rows[0];
  for (const row of rows) {
    if (r < row.weight) {
      selected = row;
      break;
    }
    r -= row.weight;
  }

  return {
    endpointUrl: selected.url,
    modelName: selected.model_name
  };
}

module.exports = {
  getEndpointForModelId
}; 