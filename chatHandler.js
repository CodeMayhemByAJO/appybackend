const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const saveMessage = require('./saveMessage');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* Läs in prompt.md från filsystemet */
let prompt;
try {
  prompt = fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf8');
} catch (e) {
  console.error('Kunde inte läsa prompt.md:', e.message);
  prompt = 'Du är appyBot – en vänlig assistent från appyChap.';
}

/* Session-state i minnet */
const sessionStates = {};
const getSession = (id) => {
  if (!sessionStates[id]) {
    sessionStates[id] = { consentRequested: false, consentDenied: false };
  }
  return sessionStates[id];
};

/* Nyckelord */
const priceKW = /(pris|kostar|offert|beställa|köpa)/i;
const helpKW = /(kan (du|ni) hjälpa|hjälp mig|behöver hjälp)/i;
const contactKW =
  /(mejladress|mailadress|e-post|kontaktuppgifter|adress|telefonnummer|kan jag ringa)/i;

const fixed = [
  {
    re: /vem är chef/i,
    ans: 'Bruno är chef – Andreas sköter resten 😉',
  },
  {
    re: /hur många är ni|är ni enmansföretag/i,
    ans: 'appyChap är ett enmansföretag med Andreas som gör allt själv – men med Bruno som chef! 😉',
  },
  {
    re: /fotograferar appychap/i,
    ans: 'Absolut! Vi fotar och redigerar så det sitter som en smäck på din sajt 📸',
  },
  {
    re: /var håller ni till/i,
    ans: 'appyChap finns i Timrå i Medelpad. Är du i krokarna bjuder vi på kaffe!',
  },
];

module.exports = async (req, res) => {
  const { message, sessionId } = req.body || {};
  if (!message || !sessionId)
    return res.status(400).json({ error: 'missing data' });

  const msg = message.toLowerCase();
  const S = getSession(sessionId);

  // 1. Hjälp-signal
  if (helpKW.test(msg) && !S.consentRequested && !S.consentDenied) {
    S.consentRequested = true;
    return res.json({
      reply:
        'Spännande! Är det okej att jag ställer några frågor så att Andreas kan hjälpa dig bättre?',
      triggerNeedsFlow: true,
    });
  }

  // 2. Hantera consent-svar
  if (S.consentRequested) {
    if (
      /^(ja|japp|jajjemen|absolut|visst|självklart|okej|kör på|yes?)\b/i.test(
        msg
      )
    ) {
      S.consentRequested = false;
      S.consentDenied = false;
      return res.json({ reply: 'Toppen! Då börjar vi.', startNeedsFlow: true });
    }
    if (/^(nej|nä|nej tack|nope|nädu|icke|absolut inte)\b/i.test(msg)) {
      S.consentRequested = false;
      S.consentDenied = true;
      return res.json({
        reply:
          'Inga problem! Du kan alltid kontakta oss via kontaktformuläret om du vill.',
      });
    }
    return res.json({
      reply:
        'Jag förstod inte ditt svar. Säg gärna Ja eller Nej så går vi vidare!',
    });
  }

  // 3. Fasta svar
  for (const f of fixed) {
    if (f.re.test(msg)) {
      await saveMessage({ user_message: message, bot_response: f.ans });
      return res.json({ reply: f.ans });
    }
  }

  // 4. Kontakt
  if (contactKW.test(msg)) {
    return res.json({
      reply:
        'Du tar enklast kontakt via vårt kontaktformulär. Jag kan öppna det åt dig om du vill!',
      openContactForm: true,
    });
  }

  // 5. Pris/offert → fråga om behovsanalys
  if (priceKW.test(msg) && !S.consentRequested && !S.consentDenied) {
    S.consentRequested = true;
    return res.json({
      reply:
        'Det låter som att du vill ha offert. Vill du att jag ställer några frågor först?',
      triggerNeedsFlow: true,
    });
  }

  // 6. Fallback → OpenAI med prompt.md
  try {
    const gpt = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: message },
      ],
    });
    const reply = gpt.choices[0].message.content;
    await saveMessage({ user_message: message, bot_response: reply });
    return res.json({ reply });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'AI error' });
  }
};
