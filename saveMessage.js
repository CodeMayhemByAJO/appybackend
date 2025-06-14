const db = require('./db');

async function saveMessage({ sessionId, userMessage, botResponse }) {
  const content = userMessage; // eller kombinera user + bot
  try {
    await db.query(
      `INSERT INTO appybot_chat_messages 
        (content, user_message, bot_response) 
       VALUES ($1, $2, $3)`,
      [content, userMessage, botResponse]
    );
  } catch (err) {
    console.error('❌ DB insert failed:', err);
  }
}

module.exports = saveMessage;
