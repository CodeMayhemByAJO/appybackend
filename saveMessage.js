const db = require('./db');

async function saveMessage({ content, user_message, bot_response }) {
  try {
    await db.query(
      `INSERT INTO appybot_chat_messages 
        (content, user_message, bot_response) 
       VALUES ($1, $2, $3)`,
      [content, user_message, bot_response]
    );
    console.log('✅ Message saved to database');
  } catch (err) {
    console.error('❌ DB insert failed:', err);
  }
}

module.exports = saveMessage;
