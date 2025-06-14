const db = require('./db');

module.exports = async (req, res) => {
  const { userMessage, botResponse } = req.body;

  if (!userMessage || !botResponse) {
    return res
      .status(400)
      .json({ error: 'Missing userMessage or botResponse' });
  }

  try {
    await db.query(
      `INSERT INTO appybot_chat_messages (content, user_message, bot_response) VALUES ($1, $2, $3)`,
      [userMessage, userMessage, botResponse]
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ manualChatLogger insert failed:', err);
    res.status(500).json({ error: 'Failed to save manual chat message' });
  }
};
