const saveMessage = require('./saveMessage');
const { OpenAI } = require('openai');

console.log('[chatHandler] modul laddad!');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enkel in-memory sessions-hantering (byt till riktig DB i produktion)
const sessionStates = {};

// Hjälpfunktioner för sessionsstatus
function getSessionState(sessionId) {
  if (!sessionStates[sessionId]) {
    sessionStates[sessionId] = {
      consentRequested: false,
      consentDenied: false,
    };
  }
  return sessionStates[sessionId];
}

// Nyckelord
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
  'teknikstrul',
  'automatisering',
  'digitalisering',
];
const helpKeywords = [
  'kan du hjälpa mig',
  'hjälp mig',
  'kan ni hjälpa',
  'hjälp',
  'behöver hjälp',
  'kan du hjälpa',
  'kan ni hjälpa mig',
];

function isPriceRelated(msg) {
  return priceKeywords.some((k) => msg.includes(k));
}
function isServiceInterest(msg) {
  return serviceInterestKeywords.some((k) => msg.includes(k));
}
function isHelpRequest(msg) {
  return helpKeywords.some((k) => msg.includes(k));
}
function isPositiveConsent(msg) {
  return /^(ja|japp|jajjemen|absolut|visst|självklart|okej|kör på|yes?)\b/i.test(
    msg
  );
}
function isNegativeConsent(msg) {
  return /^(nej|nä|nej tack|nope|nädu|icke|absolut inte)\b/i.test(msg);
}

module.exports = async function chatHandler(req, res) {
  const { message, sessionId } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({ error: 'Missing message or sessionId' });
  }

  const msg = message.toLowerCase();
  const session = getSessionState(sessionId);

  // Hjälp-signal → consent direkt
  if (
    isHelpRequest(msg) &&
    !session.consentRequested &&
    !session.consentDenied
  ) {
    session.consentRequested = true;
    return res.json({
      reply:
        'Spännande! Är det okej att jag ställer några frågor så att Andreas kan hjälpa dig bättre?',
      triggerNeedsFlow: true,
    });
  }

  // Consent svar
  if (session.consentRequested) {
    if (isPositiveConsent(msg)) {
      session.consentRequested = false;
      return res.json({
        reply: 'Bra! Då börjar vi med några frågor.',
        startNeedsFlow: true,
      });
    } else if (isNegativeConsent(msg)) {
      session.consentRequested = false;
      session.consentDenied = true;
      return res.json({
        reply:
          'Inga problem! Du kan alltid kontakta oss via kontaktformuläret om du vill.',
      });
    } else {
      return res.json({
        reply:
          'Jag förstod inte ditt svar. Säg gärna Ja eller Nej så vi kan gå vidare!',
      });
    }
  }

  // Kontaktuppgifter → kontaktformulär
  if (
    /mejladress|mailadress|e-post|kontaktuppgifter|adress|telefonnummer|kan jag ringa/i.test(
      msg
    )
  ) {
    return res.json({
      reply:
        'Du tar enklast kontakt via vårt kontaktformulär. Jag kan öppna det åt dig om du vill!',
      openContactForm: true,
    });
  }

  // Prisrelaterade frågor → consent
  if (
    isPriceRelated(msg) &&
    !session.consentRequested &&
    !session.consentDenied
  ) {
    session.consentRequested = true;
    return res.json({
      reply:
        'Det låter som att du vill ha hjälp med offert eller prisuppgift. Vill du att jag ställer några frågor så att Andreas kan hjälpa dig bättre?',
      triggerNeedsFlow: true,
    });
  }

  // Intressefrågor → info-svar utan consent
  if (
    isServiceInterest(msg) &&
    !session.consentRequested &&
    !session.consentDenied
  ) {
    // Exempel: "Är det bra med hemsida?", "Vad gör appyChap?"
    const directInfoTriggers = [
      'fundera på hemsida',
      'ny hemsida',
      'behöver hemsida',
      'vad är en ai-assistent',
      'vad gör appychap',
      'vad är appychap',
      'behöver en app',
      'vill ha en hemsida',
    ];
    if (directInfoTriggers.some((t) => msg.includes(t))) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `
Du är appyBot – kundtjänströsten för enmansföretaget appyChap från Timrå med norrländsk charm och humor.
Svarar kort, vänligt och personligt.
appyChap levererar smarta digitala lösningar:
• Hemsidor som gör nyfikna besökare till kunder.
• Appar som stödjer din verksamhet.
• Mjukvara som löser riktiga problem.
• Foto och grafik som lyfter varumärket.
• AI-tjänster som frigör tid.
Svara utan att trigga consent eller behovsanalys.
              `.trim(),
            },
            { role: 'user', content: message },
          ],
        });
        const botResponse = completion.choices[0].message.content;
        return res.json({ reply: botResponse });
      } catch (err) {
        console.error('OpenAI error:', err);
        return res.status(500).json({ error: 'AI generation error' });
      }
    }
    // Övriga intressefrågor triggar consent
    session.consentRequested = true;
    return res.json({
      reply:
        'Är det okej att jag ställer några frågor så att Andreas kan hjälpa dig närmare och återkomma?',
      triggerNeedsFlow: true,
    });
  }

  // Fallback - AI svar
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
Du är appyBot – kundtjänströsten för enmansföretaget appyChap från Timrå med norrländsk charm och humor.
Svarar kort, vänligt och personligt.
Svarar endast på frågor om appyChap, dess tjänster och verksamhet.
Om frågan gäller kontaktuppgifter, hänvisa alltid till kontaktformuläret.
Svarar sarkastiskt på frågor om att jobba på appyChap.
Blockerar svordomar och otrevliga kommentarer med kort svar.
Om frågan ligger utanför appyChap, hänvisa till kontaktformuläret.
          `.trim(),
        },
        { role: 'user', content: message },
      ],
    });
    const botResponse = completion.choices[0].message.content;
    return res.json({ reply: botResponse });
  } catch (err) {
    console.error('OpenAI error:', err);
    return res.status(500).json({ error: 'AI generation error' });
  }
};
