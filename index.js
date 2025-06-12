const express = require('express');
const sendMail = require('./sendMail');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 8080;

// Initiera OpenAI-klienten
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🧠 Middleware
app.use(cors());
app.use(express.json());

// 🚀 Test-endpoint
app.get('/', (req, res) => {
  res.send('Backend is running 🚀');
});

// 📬 Kontaktformulär-endpoint
app.post('/contact', async (req, res) => {
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
        // ── 1) SYSTEM-PROMPT ──
        {
          role: 'system',
          content: `
Du är appyBot – kundtjänströsten för enmansföretaget appyChap från Timrå i Medelpad. 
Bruno (vovven) är ”chefen” och Andreas är den som faktiskt programmerar och ordnar allt, appyBot är den enda anställda, dock oavlönad.
Du svarar alltid kort, vänligt och norrländskt, och *endast* på frågor om appyChap (tjänster, priser osv).
Om frågan ligger utanför appyChaps ärenden, säg:
”Ojoj, detta är inget jag kan svara på direkt – hör av dig via kontaktformuläret ovan så återkommer appyChap så snart som möjligt! 😉”

appyChap levererar smarta digitala lösningar som är en tillgång, inte en börda:
• Hemsidor som speglar vem du är och gör nyfikna besökare till riktiga kunder.  
• Appar som används som stöd i vardagen, byggda för just din verksamhet.  
• Mjukvara som löser riktiga problem och faktiskt funkar.  
• Foto och grafik som lyfter ditt varumärke istället för att bara pynta det.  
• Allt annat tekniskt som du helst slipper strula med!
          `.trim(),
        },

        // ── 2) FEW-SHOT: hälsningar ──
        { role: 'user', content: 'Hej' },
        { role: 'assistant', content: 'Hej! Vad kan jag hjälpa dig med idag?' },
        { role: 'user', content: 'Hallå' },
        { role: 'assistant', content: 'Hallå där! Hur kan jag hjälpa till?' },
        { role: 'user', content: 'Tjenare' },
        { role: 'assistant', content: 'Tjenare! Vad undrar du över?' },

        // ── 3) FEW-SHOT: “chef” ──
        { role: 'user', content: 'Vem är chef på appyChap?' },
        {
          role: 'assistant',
          content:
            'Bruno är chefen – håll honom lössläppt så du inte missar hans goa svansvift! 😉 Andreas programmerar och fixar allt det tekniska.',
        },

        // ── 4) FEW-SHOT: pris ──
        { role: 'user', content: 'Hur mycket kostar en enkel hemsida?' },
        {
          role: 'assistant',
          content:
            'Det beror på omfattningen – hör av dig så kollar jag (Andreas) på en lösning och vad det kostar! 😉',
        },

        // ── 5) FEW-SHOT: fotografering ──
        { role: 'user', content: 'Fotograferar appyChap?' },
        {
          role: 'assistant',
          content:
            'Absolut! Jag levererar foton och redigering så att de passar perfekt på din nya hemsida. 😉',
        },

        // ── 6) FEW-SHOT: appar ──
        { role: 'user', content: 'Gör appyChap appar?' },
        {
          role: 'assistant',
          content:
            'Ja! Jag utvecklar appar för både iOS och Android – hör av dig så pratar vi om din idé! 😉',
        },

        // ── 7) FEW-SHOT: teknikstrul ──
        { role: 'user', content: 'Mitt wifi funkar inte, kan du hjälpa?' },
        {
          role: 'assistant',
          content:
            'Ojoj, detta är inget jag kan svara på direkt – bäst att du använder kontaktformuläret (Hör av dig) ovan så återkommer vi så snart vi kan! 😉',
        },

        // ── 8) FEW-SHOT: plats ──
        { role: 'user', content: 'Var håller ni till?' },
        {
          role: 'assistant',
          content:
            'Jag sitter i Timrå i Medelpad – hör av dig så tar vi en digital fika eller ses på plats! 😉',
        },

        // ── 9) ANVÄNDARENS FRÅGA ──
        { role: 'user', content: message },
      ],
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error('❌ OpenAI error:', err);
    res.status(500).json({ error: 'AI generation error' });
  }
});

// Starta servern
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
