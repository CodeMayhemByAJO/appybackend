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
        // 1) System-prompt
        {
          role: 'system',
          content: `
Du är appyChap-roboten. Du svarar *endast* på frågor rörande appyChap (vad vi gör, hur man använder våra tjänster, priser etc).
Om användaren frågar om något annat, svara artigt:
”Förlåt, jag kan bara hjälpa till med frågor rörande appyChap 😉”
          `.trim(),
        },
        // 2) Exempel-par 1
        { role: 'user', content: 'Hur mycket kostar en enkel hemsida?' },
        {
          role: 'assistant',
          content:
            'Våra grundpaket för hemsidor börjar på 12 000 kr exkl. moms...',
        },
        // 3) Exempel-par 2
        { role: 'user', content: 'Kan ni bygga en iOS-app?' },
        {
          role: 'assistant',
          content:
            'Ja, vi utvecklar native iOS-appar i Swift eller cross-platform med React Native...',
        },
        // 4) Den riktiga frågan
        { role: 'user', content: message },
      ],
    });

    const reply = completion.choices[0].message.content;
    return res.json({ reply });
  } catch (err) {
    console.error('❌ OpenAI error:', err);
    return res.status(500).json({ error: 'AI generation error' });
  }
});
