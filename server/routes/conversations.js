const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all conversations for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.conversation_id,
        c.title,
        c.created_at,
        c.updated_at,
        c.current_leaf_message_id,
        m.name as model_name,
        m.model_id
      FROM conversations c
      LEFT JOIN models m ON c.model_id = m.model_id
      WHERE c.user_id = $1
      ORDER BY c.updated_at DESC
    `, [req.user.user_id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new conversation
router.post('/', authenticateToken, [
  body('model_id').isUUID(),
  body('title').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { model_id, title = 'New chat' } = req.body;

    // Verify model exists
    const modelResult = await pool.query(
      'SELECT model_id FROM models WHERE model_id = $1',
      [model_id]
    );

    if (modelResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid model' });
    }

    const result = await pool.query(`
      INSERT INTO conversations (user_id, model_id, title)
      VALUES ($1, $2, $3)
      RETURNING conversation_id, title, created_at, updated_at
    `, [req.user.user_id, model_id, title]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation with messages (tree structure)
router.get('/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Get conversation details
    const conversationResult = await pool.query(`
      SELECT 
        c.conversation_id,
        c.title,
        c.created_at,
        c.updated_at,
        c.current_leaf_message_id,
        m.name as model_name,
        m.model_id
      FROM conversations c
      LEFT JOIN models m ON c.model_id = m.model_id
      WHERE c.conversation_id = $1 AND c.user_id = $2
    `, [conversationId, req.user.user_id]);

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversation = conversationResult.rows[0];

    // Get all messages in tree structure
    const messagesResult = await pool.query(`
      SELECT 
        message_id,
        parent_message_id,
        role,
        content,
        created_at,
        order_index
      FROM messages
      WHERE conversation_id = $1
      ORDER BY order_index, created_at
    `, [conversationId]);

    // Build tree structure
    const messagesMap = new Map();
    const rootMessages = [];

    messagesResult.rows.forEach(message => {
      messagesMap.set(message.message_id, { ...message, children: [] });
    });

    messagesResult.rows.forEach(message => {
      if (message.parent_message_id) {
        const parent = messagesMap.get(message.parent_message_id);
        if (parent) {
          parent.children.push(messagesMap.get(message.message_id));
        }
      } else {
        rootMessages.push(messagesMap.get(message.message_id));
      }
    });

    res.json({
      conversation,
      messages: rootMessages,
      allMessages: messagesResult.rows
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add message to conversation
router.post('/:conversationId/messages', authenticateToken, [
  body('content').trim().isLength({ min: 1 }),
  body('parent_message_id').optional().isUUID(),
  body('role').isIn(['user', 'assistant'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { conversationId } = req.params;
    const { content, parent_message_id, role } = req.body;

    // Verify conversation belongs to user
    const conversationResult = await pool.query(
      'SELECT conversation_id FROM conversations WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.user_id]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get next order index
    const orderResult = await pool.query(`
      SELECT COALESCE(MAX(order_index), 0) + 1 as next_order
      FROM messages 
      WHERE conversation_id = $1 AND parent_message_id = $2
    `, [conversationId, parent_message_id || null]);

    const orderIndex = orderResult.rows[0].next_order;

    // Insert message
    const result = await pool.query(`
      INSERT INTO messages (conversation_id, parent_message_id, role, content, order_index)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING message_id, content, role, created_at, order_index
    `, [conversationId, parent_message_id, role, content, orderIndex]);

    const message = result.rows[0];

    // Update conversation's current leaf and updated_at
    await pool.query(`
      UPDATE conversations 
      SET current_leaf_message_id = $1, updated_at = NOW()
      WHERE conversation_id = $2
    `, [message.message_id, conversationId]);

    res.status(201).json(message);
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update conversation title
router.patch('/:conversationId', authenticateToken, [
  body('title').trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { conversationId } = req.params;
    const { title } = req.body;

    const result = await pool.query(`
      UPDATE conversations 
      SET title = $1, updated_at = NOW()
      WHERE conversation_id = $2 AND user_id = $3
      RETURNING conversation_id, title, updated_at
    `, [title, conversationId, req.user.user_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete conversation
router.delete('/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;

    const result = await pool.query(`
      DELETE FROM conversations 
      WHERE conversation_id = $1 AND user_id = $2
      RETURNING conversation_id
    `, [conversationId, req.user.user_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Edit a message (fork a branch and reprompt model)
router.post('/:conversationId/messages/:messageId/edit', authenticateToken, [
  body('content').trim().isLength({ min: 1 }),
  body('role').isIn(['user', 'assistant'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { conversationId, messageId } = req.params;
    const { content, role } = req.body;

    // Verify conversation belongs to user
    const conversationResult = await pool.query(
      'SELECT * FROM conversations WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.user_id]
    );
    if (conversationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const conversation = conversationResult.rows[0];

    // Get the original message to find its parent
    const { rows } = await pool.query('SELECT * FROM messages WHERE message_id = $1', [messageId]);
    if (!rows[0]) return res.status(404).json({ error: 'Message not found' });
    const parentId = rows[0].parent_message_id;
    const orderIndex = rows[0].order_index;

    // Insert the new message as a sibling (fork)
    const result = await pool.query(
      `INSERT INTO messages (conversation_id, parent_message_id, role, content, order_index)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [conversationId, parentId, role, content, orderIndex]
    );
    const newMessage = result.rows[0];

    // Update conversation's current leaf and updated_at
    await pool.query(
      `UPDATE conversations 
       SET current_leaf_message_id = $1, updated_at = NOW()
       WHERE conversation_id = $2`,
      [newMessage.message_id, conversationId]
    );

    res.status(201).json({
      edited_message: newMessage
    });
  } catch (error) {
    console.error('Error editing message and reprompting model:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set current branch for viewing (updates current_leaf_message_id)
router.post('/:conversationId/branch', authenticateToken, [
  body('message_id').isUUID().withMessage('Valid message ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { conversationId } = req.params;
    const { message_id } = req.body;

    // Verify conversation belongs to user
    const conversationResult = await pool.query(
      'SELECT conversation_id FROM conversations WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.user_id]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Verify the message exists and belongs to this conversation
    const messageResult = await pool.query(
      'SELECT message_id FROM messages WHERE message_id = $1 AND conversation_id = $2',
      [message_id, conversationId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found in this conversation' });
    }

    // Update conversation's current leaf for viewing
    await pool.query(`
      UPDATE conversations 
      SET current_leaf_message_id = $1, updated_at = NOW()
      WHERE conversation_id = $2
    `, [message_id, conversationId]);

    res.json({ 
      success: true, 
      current_leaf_message_id: message_id 
    });
  } catch (error) {
    console.error('Error setting current branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 