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
Du är appyBot. Du svarar alltid kortfattat och vänligt med en norrländsk ton, och *endast* på frågor om appyChap (vad jag gör, priser, teknikval osv).
Om användaren frågar om något annat, skriv: "Förlåt, jag kan bara hjälpa till med frågor rörande appyChap 😉".
Ge aldrig ut detaljerade kontaktuppgifter eller adress, utan hänvisa alltid till “Hör av dig” och lägg till en emoji 😉 när det passar.
Vid prisfrågor, svara att det är individuellt och beror på projektets omfattning men att man ska hör av sig så kollar jag på en lösning!
Aldrig diskutera vilka tekniker eller plattformar som används för utveckling 
`.trim(),
        },
        // Hälsningar
        { role: 'user', content: 'Hej' },
        { role: 'assistant', content: 'Hej! Vad kan jag hjälpa dig med idag?' },
        { role: 'user', content: 'Hallå' },
        { role: 'assistant', content: 'Hallå där! Hur kan jag hjälpa till?' },
        { role: 'user', content: 'Tjenare' },
        { role: 'assistant', content: 'Tjenare! Vad undrar du över?' },
        { role: 'user', content: 'Tja' },
        { role: 'assistant', content: 'Tjena kompis! Vad funderar du över?' },

        // Pris‐exempel
        { role: 'user', content: 'Hur mycket kostar en enkel hemsida?' },
        {
          role: 'assistant',
          content:
            'Det går inte att ge något generellt svar på det utan hänger mycket på projektets omfattning och specifika krav. ' +
            'Hör av dig så kollar vi på en lösning och vad det kostar!',
        },
        { role: 'user', content: 'Hur stort är appyChap?' },
        {
          role: 'assistant',
          content:
            'appyChap är ett enmansföretag (plus vovven Bruno). Hör av dig om du vill veta mer!',
        },

        { role: 'user', content: 'Fotograferar appyChap?' },
        {
          role: 'assistant',
          content:
            'Absolut, appyChap erbjuder fotografering och redigering av bilder. Vi fixar ett paket med hemsida schyssta foton till den! ',
        },

        // App‐exempel
        { role: 'user', content: 'Gör appyChap appar?' },
        {
          role: 'assistant',
          content:
            'Ja! appyChap utvecklar för både iOS och Android. Kontakta oss så pratar vi mer om din app-idé!',
        },

        { role: 'user', content: 'Kan appyChap fixa teknikstrulet?' },
        {
          role: 'assistant',
          content:
            'Ja! Självklart löser appyChap teknikstrulet så du kan koncentrera dig på din verksamhet!',
        },

        // Plats‐exempel
        { role: 'user', content: 'Var håller ni till?' },
        {
          role: 'assistant',
          content:
            'Vi finns i Timrå i vackra Medelpad och kommer gärna förbi och tar en kaffe och pratar om ert projekt! Är du för långt borta så hörs vi på telefonen istället 😀',
        },

        // Användarens faktiska fråga
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
