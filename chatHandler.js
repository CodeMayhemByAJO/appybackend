const saveMessage = require('./saveMessage');
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// session management
const sessionStates = {};
function getSessionState(id) {
  if (!sessionStates[id]) {
    sessionStates[id] = { consentRequested: false, consentDenied: false };
  }
  return sessionStates[id];
}

const priceKeywords = ['pris', 'kostar', 'offert', 'beställa', 'köpa'];
const serviceKeywords = [
  'app',
  'hemsida',
  'webbsida',
  'fotografering',
  'ai',
  'bot',
];
const helpKeywords = ['hjälp mig', 'kan du hjälpa', 'behöver hjälp'];

function containsAny(msg, list) {
  return list.some((k) => msg.includes(k));
}

module.exports = async function chatHandler(req, res) {
  const { message, sessionId } = req.body;
  if (!message || !sessionId)
    return res.status(400).json({ error: 'Missing message or sessionId' });
  const msg = message.toLowerCase();
  const session = getSessionState(sessionId);

  // help-signal → consent
  if (
    containsAny(msg, helpKeywords) &&
    !session.consentRequested &&
    !session.consentDenied
  ) {
    session.consentRequested = true;
    return res.json({
      reply:
        'Spännande! Är det okej att jag ställer några frågor så att Andreas kan hjälpa dig närmare och återkomma?',
      triggerNeedsFlow: true,
    });
  }
  // handle consent response
  if (session.consentRequested) {
    if (/^(ja|absolut|visst)\b/.test(msg)) {
      session.consentRequested = false;
      return res.json({
        reply: 'Bra! Då börjar vi med några frågor.',
        startNeedsFlow: true,
      });
    }
    if (/^(nej|nä)\b/.test(msg)) {
      session.consentRequested = false;
      session.consentDenied = true;
      return res.json({
        reply:
          'Inga problem! Du kan alltid kontakta oss via kontaktformuläret 😉',
      });
    }
    return res.json({ reply: 'Jag förstod inte ditt svar. Säg Ja eller Nej.' });
  }

  // fixed answers
  const fixed = [
    { rx: /vem är chef/i, ans: 'Bruno är chef och Andreas gör allt annat! 😉' },
    {
      rx: /hur många är ni/i,
      ans: 'appyChap är ett enmansföretag med Andreas och Bruno som chef! 😉',
    },
  ];
  for (const f of fixed)
    if (f.rx.test(message)) return res.json({ reply: f.ans });

  // contact info
  if (/mejladresser?|telefonnummer|kontaktuppgifter|adress/.test(msg)) {
    return res.json({
      reply:
        'Du tar enklast kontakt via vårt kontaktformulär. Jag kan öppna det åt dig om du vill!',
      openContactForm: true,
    });
  }

  // price → consent
  if (
    containsAny(msg, priceKeywords) &&
    !session.consentRequested &&
    !session.consentDenied
  ) {
    session.consentRequested = true;
    return res.json({
      reply:
        'Det låter som du vill ha offert. Vill du att jag ställer några frågor?',
      triggerNeedsFlow: true,
    });
  }

  // service interest
  if (
    containsAny(msg, serviceKeywords) &&
    !session.consentRequested &&
    !session.consentDenied
  ) {
    // direct info if contains 'vad gör' etc
    if (/vad gör|vad är/.test(msg)) {
      const ai = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Du är appyBot... kort svar utan consent.',
          },
          { role: 'user', content: message },
        ],
      });
      return res.json({ reply: ai.choices[0].message.content });
    }
    // else trigger consent
    session.consentRequested = true;
    return res.json({
      reply:
        'Är det okej att jag ställer några frågor så att Andreas kan hjälpa dig?',
      triggerNeedsFlow: true,
    });
  }

  // fallback AI
  const ai = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Du är appyBot... svara inom ramarna.' },
      { role: 'user', content: message },
    ],
  });
  await saveMessage({
    content: message,
    user_message: message,
    bot_response: ai.choices[0].message.content,
  });
  res.json({ reply: ai.choices[0].message.content });
};
