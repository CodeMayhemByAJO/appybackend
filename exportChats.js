const db = require('./db');

module.exports = async function exportChats(req, res) {
  try {
    const result = await db.query(`
      SELECT id, created_at, content, user_message, bot_response
      FROM appybot_chat_messages
      ORDER BY created_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Export error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
};
