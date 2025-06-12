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
        // Här ska dina regler och träning ligga:
        {
          role: 'system',
          content:
            'Du är appyChap-roboten. Du svarar alltid kortfattat och vänligt, och *endast* på frågor om appyChap (vad vi gör, priser, teknikval osv). ' +
            'Om användaren frågar om något annat, skriv: "Förlåt, jag kan bara hjälpa till med frågor rörande appyChap 😉".',
        },
        // (valfritt) några exempel:
        { role: 'user', content: 'Hur mycket kostar en enkel hemsida?' },
        {
          role: 'assistant',
          content:
            'Det går inte att ge något generellt svar på det utan hänger mycket på projektets omfattning och specifika krav. Hojta till så kollar vi på en lösning och vad det kostar!',
        },
        { role: 'user', content: 'Kan ni utveckla en iOS-app?' },
        {
          role: 'assistant',
          content:
            'Ja! Vi utvecklar både native iOS-appar i Swift och cross-platform med React Native.',
        },
        // 3) Den riktiga frågan
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
