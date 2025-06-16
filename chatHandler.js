const saveMessage = require('./saveMessage');
const { OpenAI } = require('openai');

console.log('[chatHandler] modul laddad!');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- In-memory sessions (byt till DB i produktion) ---
const sessionStates = {};
function getSessionState(id) {
  if (!sessionStates[id]) {
    sessionStates[id] = { consentRequested: false, consentDenied: false };
  }
  return sessionStates[id];
}

// --- Nyckelords-funktioner ---
const priceKeywords = ['pris', 'kostar', 'offert', 'beställa', 'köpa'];
const serviceInterestKeywords = [
  'app',
  'hemsida',
  'webbsida',
  'fotografering',
  'foto',
  'mjukvara',
  'software',
  'ai',
  'bot',
  'automatisering',
  'digitalisering',
];
const helpKeywords = [
  'kan du hjälpa',
  'hjälp mig',
  'behöver hjälp',
  'kan ni hjälpa',
  'hjälp',
];

function isPrice(msg) {
  return priceKeywords.some((k) => msg.includes(k));
}
function isService(msg) {
  return serviceInterestKeywords.some((k) => msg.includes(k));
}
function isHelp(msg) {
  return helpKeywords.some((k) => msg.includes(k));
}
function isYes(msg) {
  return /^(ja|japp|visst|okej|absolut|självklart)\b/i.test(msg);
}
function isNo(msg) {
  return /^(nej|nä|nope|nej tack)\b/i.test(msg);
}

module.exports = async function chatHandler(req, res) {
  const { message, sessionId } = req.body;
  if (!message || !sessionId)
    return res.status(400).json({ error: 'Missing message or sessionId' });
  const msg = message.toLowerCase();
  const session = getSessionState(sessionId);

  // 1) Hjälp-begäran → direkt consent
  if (isHelp(msg) && !session.consentRequested && !session.consentDenied) {
    session.consentRequested = true;
    return res.json({
      reply:
        'Spännande! Är det okej att jag ställer några frågor så att Andreas kan hjälpa dig bättre?',
      triggerNeedsFlow: true,
    });
  }

  // 2) Hantera consent-svar
  if (session.consentRequested) {
    if (isYes(msg)) {
      session.consentRequested = false;
      return res.json({
        reply: 'Bra! Då börjar vi med några frågor.',
        startNeedsFlow: true,
      });
    }
    if (isNo(msg)) {
      session.consentRequested = false;
      session.consentDenied = true;
      return res.json({
        reply:
          'Inga problem! Du kan alltid kontakta oss via kontaktformuläret om du vill.',
      });
    }
    return res.json({
      reply:
        'Jag förstod inte ditt svar. Säg gärna Ja eller Nej så vi kan gå vidare!',
    });
  }

  // 3) Kontaktuppgifter → öppna formulär
  if (
    /mejladress|mailadress|e-post|kontaktuppgifter|adress|telefonnummer|ring/i.test(
      msg
    )
  ) {
    return res.json({
      reply:
        'Du tar enklast kontakt via vårt kontaktformulär. Jag kan öppna det åt dig om du vill!',
      openContactForm: true,
    });
  }

  // 4) Prisfrågor → consent
  if (isPrice(msg) && !session.consentRequested && !session.consentDenied) {
    session.consentRequested = true;
    return res.json({
      reply:
        'Det låter som att du vill ha hjälp med offert eller prisuppgift. Vill du att jag ställer några frågor så att Andreas kan hjälpa dig bättre?',
      triggerNeedsFlow: true,
    });
  }

  // 5) Tjänsteinteresse → direktinfo eller consent
  if (isService(msg) && !session.consentRequested && !session.consentDenied) {
    const directInfo = [
      'fundera på hemsida',
      'ny hemsida',
      'behöver hemsida',
      'vad är en ai-assistent',
      'vad gör appychap',
      'vad är appychap',
      'behöver en app',
      'vill ha en hemsida',
    ];
    if (directInfo.some((t) => msg.includes(t))) {
      // AI-svar utan consent
      try {
        const comp = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `
Du är appyBot – kundtjänströsten för enmansföretaget appyChap från Timrå med norrländsk charm och humor.
Svarar kort, vänligt och personligt.
Presenterar appyChaps tjänster utan consent.
            `.trim(),
            },
            { role: 'user', content: message },
          ],
        });
        return res.json({ reply: comp.choices[0].message.content });
      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'AI error' });
      }
    }
    // annars consent
    session.consentRequested = true;
    return res.json({
      reply:
        'Är det okej att jag ställer några frågor så att Andreas kan hjälpa dig närmare och återkomma?',
      triggerNeedsFlow: true,
    });
  }

  // 6) Few-shot-fasta svar
  const fixed = [
    {
      rx: /vem är chef på appychap/i,
      a: 'Bruno är tillbakalutad chef och styr företaget med en järnhand! 😉 Andreas gör allt annat.',
    },
    {
      rx: /hur många är ni/i,
      a: 'appyChap är ett enmansföretag med Andreas som driver allt själv, men med Bruno (vovven) som chef! 😉',
    },
    {
      rx: /fotograferar appychap/i,
      a: 'Absolut! Jag levererar foton och redigering så att de passar perfekt på din nya hemsida. 😉',
    },
    {
      rx: /mitt wifi funkar inte/i,
      a: 'Ojoj, detta är inget jag kan svara på direkt. Använd kontaktformuläret ovan så återkommer vi så snart vi kan! 😉',
    },
    {
      rx: /var håller ni till/i,
      a: 'appyChap finns i Timrå i Medelpad. Hör gärna av dig så tar vi en kaffe och diskuterar ert projekt! 😉',
    },
    {
      rx: /är ni bra/i,
      a: 'Vi är ett relativt nystartat enmansföretag som hjälpt några lokala hjältar på deras digitaliseringsresor – hoppas på fler snart! 😉',
    },
    {
      rx: /har ni haft många kunder/i,
      a: 'Jag har fått hjälpa ett antal lokala hjältar på deras digitaliseringsresor. Skulle vara kul att hjälpa er också! 😉',
    },
  ];
  for (const f of fixed) {
    if (f.rx.test(message)) {
      await saveMessage({
        content: message,
        user_message: message,
        bot_response: f.a,
      });
      return res.json({ reply: f.a });
    }
  }

  // 7) Fallback AI-svar
  try {
    const comp = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
Du är appyBot – kundtjänströsten för enmansföretaget appyChap från Timrå med norrländsk charm och humor.
Svarar kort, vänligt och personligt.
Svarar endast om appyChaps tjänster och verksamhet.
Vid kontaktuppgifter: hänvisa alltid till kontaktformuläret.
Vid frågor utanför appyChaps scope: hänvisa till kontaktformuläret.
        `.trim(),
        },
        { role: 'user', content: message },
      ],
    });
    const out = comp.choices[0].message.content;
    await saveMessage({
      content: message,
      user_message: message,
      bot_response: out,
    });
    return res.json({ reply: out });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'AI error' });
  }
};
