const express = require('express');
const sendMail = require('./sendMail');
const cors = require('cors');
const { OpenAI } = require('openai'); // <— lägg till

const app = express();
const PORT = process.env.PORT || 8080;

// Initiera OpenAI-klienten
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🧠 Middleware
app.use(cors());
app.use(express.json()); // 👈 SUPER VIKTIGT för att kunna läsa JSON i body

// 🚀 Test-endpoint
app.get('/', (req, res) => {
  res.send('Backend is running 🚀');
});

// 📬 Kontaktformulär-endpoint
app.post('/contact', async (req, res) => {
  console.log('👉 Inkommande body:', req.body);

  try {
    await sendMail(req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Mail error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🤖 Chat-endpoint
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message in request body' });
  }
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
Du är appyChap-roboten. Du svarar *endast* på frågor som handlar om appyChap
(vad vi gör, hur man använder våra tjänster, priser etc).
Om användaren ställer en fråga utanför appyChaps verksamhetsområde,
ska du artigt svara:
”Förlåt, jag kan bara hjälpa till med frågor om appyChap.”
          `.trim(),
        },
        { role: 'user', content: message },
      ],
    });
    const reply = completion.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error('❌ OpenAI error:', err);
    res.status(500).json({ error: 'AI generation error' });
  }
});

// Starta servern
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
