const db = require('./db');

module.exports = async (req, res) => {
  try {
    await db.query(`DELETE FROM appybot_chat_messages`);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Delete error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
};
