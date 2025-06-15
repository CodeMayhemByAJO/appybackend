const saveMessage = require('./saveMessage');
const { OpenAI } = require('openai');

console.log('[chatHandler] modul laddad!');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const priceKeywords = ['pris', 'kostar', 'offert', 'beställa', 'köpa'];
function isPriceRelated(userMessage) {
  return priceKeywords.some((keyword) =>
    userMessage.toLowerCase().includes(keyword)
  );
}

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
function isServiceInterest(userMessage) {
  return serviceInterestKeywords.some((keyword) =>
    userMessage.toLowerCase().includes(keyword)
  );
}

// Hårdkodade fasta svar utan consent
const fixedAnswers = [
  {
    questionRegex: /fotograferar appychap/i,
    answer:
      'Absolut! Jag levererar foton och redigering så att de passar perfekt på din nya hemsida. 😉',
  },
  {
    questionRegex: /vem är chef på appychap/i,
    answer:
      'Bruno är tillbakalutad chef och styr företaget med en järnhand! 😉 Andreas gör verkligen ALLT och appyBot är Kundtjänstchef',
  },
  {
    questionRegex: /mitt wifi funkar inte/i,
    answer:
      'Ojoj, detta är inget jag kan svara på direkt. Använd kontaktformuläret (Hör av dig) ovan så återkommer vi så snart vi kan!',
  },
  {
    questionRegex: /var håller ni till/i,
    answer:
      'appyChap finns i Timrå i Medelpad. Håller ni till i krokarna, hör av dig så tar vi en kaffe och diskuterar ert projekt!',
  },
  {
    questionRegex: /är ni bra/i,
    answer:
      'Vi är ett relativt nystartat enmansföretag, men har haft glädjen att hjälpa några lokala hjältar på deras digitaliseringsresor och hoppas på fler inom kort! 😉',
  },
  {
    questionRegex: /har ni haft många kunder/i,
    answer:
      'Jag har fått hjälpa ett antal lokala hjältar på deras digitaliseringsresor. Vore kul hoppas att få hjälpa er också! 😉',
  },
];

module.exports = async function chatHandler(req, res) {
  console.log('[chatHandler] ny request:', req.method, req.path, req.body);

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message in request body' });
  }

  // Fasta svar först
  for (const item of fixedAnswers) {
    if (item.questionRegex.test(message)) {
      await saveMessage({
        content: message,
        user_message: message,
        bot_response: item.answer,
      });
      return res.json({ reply: item.answer });
    }
  }

  // Kontaktuppgifter - hänvisa direkt till kontaktformulär
  const contactInfoRegex =
    /mejladress|mailadress|e-post|kontaktuppgifter|adress|telefonnummer/i;
  if (contactInfoRegex.test(message)) {
    const reply =
      'Du tar enklast kontakt via vårt kontaktformulär. Jag kan öppna det åt dig om du vill!';
    await saveMessage({
      content: message,
      user_message: message,
      bot_response: reply,
    });
    return res.json({ reply, openContactForm: true });
  }

  // Prisrelaterade frågor → consentfråga
  if (isPriceRelated(message)) {
    const reply =
      'Det låter som att du vill ha hjälp med offert eller prisuppgift. Vill du att jag ställer några frågor så att Andreas kan hjälpa dig bättre?';
    return res.json({ reply, triggerNeedsFlow: true });
  }

  // Intresse för tjänster (ej pris) → consentfråga
  if (isServiceInterest(message)) {
    const reply =
      'Spännande! Är det okej att jag ställer några frågor så att Andreas kan hjälpa dig närmare och återkomma?';
    return res.json({ reply, triggerNeedsFlow: true });
  }

  // Annars: AI-svar med systemprompt och few-shot-exempel
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
Du är appyBot – kundtjänströsten för enmansföretaget appyChap från Timrå i Medelpad, med norrländsk charm och humor.
- Svara kort, vänligt och personligt.
- Svara endast på frågor om appyChap, deras tjänster och verksamhet.
- Om frågan gäller pris eller intresse, ställ en personlig consentfråga.
- Hänvisa alltid till kontaktformuläret vid kontaktuppgifter.
- Svara sarkastiskt på frågor om att jobba där.
- Blockera svordomar och otrevliga kommentarer med ett kort svar.
- Ge informativa svar på frågor om företagets verksamhet utan consent.

Exempel på frågor och svar:

User: "Vad gör appyChap?"
Assistant: "appyChap bygger smarta hemsidor, appar och digitala lösningar som hjälper småföretagare i vardagen."

User: "Jag är elektriker, behöver jag en hemsida?"
Assistant: "Som elektriker kan en hemsida verkligen hjälpa dig att synas och nå fler kunder. Vill du att jag ställer några frågor så att Andreas kan hjälpa dig bättre?"

User: "Har ni någon mejladress?"
Assistant: "Du tar enklast kontakt via vårt kontaktformulär. Jag kan öppna det åt dig om du vill!"

User: "Hur är det att jobba på appyChap?"
Assistant: "Det hade ju varit bättre om jag fått lön också, men man kan inte få allt här i livet! 🤷‍♂️"

User: "Jag vill prata politik"
Assistant: "Jag kan bara svara på frågor gällande appyChap och våra tjänster. Om du har frågor om andra ämnen, kontakta någon bättre lämpad för dessa!"
          `.trim(),
        },

        // Few-shot-exempel
        { role: 'user', content: 'Vad gör appyChap?' },
        {
          role: 'assistant',
          content:
            'appyChap bygger smarta hemsidor, appar och digitala lösningar som hjälper småföretagare i vardagen.',
        },

        { role: 'user', content: 'Jag är elektriker, behöver jag en hemsida?' },
        {
          role: 'assistant',
          content:
            'Som elektriker kan en hemsida verkligen hjälpa dig att synas och nå fler kunder. Vill du att jag ställer några frågor så att Andreas kan hjälpa dig bättre?',
        },

        { role: 'user', content: 'Har ni någon mejladress?' },
        {
          role: 'assistant',
          content:
            'Du tar enklast kontakt via vårt kontaktformulär. Jag kan öppna det åt dig om du vill!',
        },

        { role: 'user', content: 'Hur är det att jobba på appyChap?' },
        {
          role: 'assistant',
          content:
            'Det hade ju varit bättre om jag fått lön också, men man kan inte få allt här i livet! 🤷‍♂️',
        },

        { role: 'user', content: 'Jag vill prata politik' },
        {
          role: 'assistant',
          content:
            'Jag kan bara svara på frågor gällande appyChap och våra tjänster. Om du har frågor om andra ämnen, kontakta någon bättre lämpad för dessa!',
        },

        { role: 'user', content: message },
      ],
    });

    const botResponse = completion.choices[0].message.content;

    await saveMessage({
      content: message,
      user_message: message,
      bot_response: botResponse,
    });

    res.json({ reply: botResponse });
  } catch (err) {
    console.error('❌ OpenAI error:', err);
    res.status(500).json({ error: 'AI generation error' });
  }
};
