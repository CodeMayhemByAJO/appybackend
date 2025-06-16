const saveMessage = require('./saveMessage');
const { OpenAI } = require('openai');

console.log('[chatHandler] modul laddad!');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Nyckelord för prisrelaterade frågor
const priceKeywords = ['pris', 'kostar', 'offert', 'beställa', 'köpa'];
function isPriceRelated(userMessage) {
  return priceKeywords.some((keyword) =>
    userMessage.toLowerCase().includes(keyword)
  );
}

// Nyckelord för intresse för tjänster (ej pris)
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

// Fasta svar utan consent
const fixedAnswers = [
  {
    questionRegex: /vem är chef på appychap/i,
    answer:
      'Bruno är tillbakalutad chef och styr företaget med en järnhand! 😉 Andreas gör allt annat.',
  },
  {
    questionRegex: /hur många är ni/i,
    answer:
      'appyChap är ett enmansföretag med Andreas som driver allt själv, men med Bruno (vovven) som chef! 😉',
  },
  {
    questionRegex: /fotograferar appychap/i,
    answer:
      'Absolut! Jag levererar foton och redigering så att de passar perfekt på din nya hemsida. 😉',
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

// Direktkontakt regex (kontaktuppgifter)
const contactInfoRegex =
  /mejladress|mailadress|e-post|kontaktuppgifter|adress|telefonnummer|kan jag ringa/i;

const systemPrompt = `
Du är appyBot – kundtjänströsten för enmansföretaget appyChap från Timrå med norrländsk charm och humor.

- Svara kort, vänligt och personligt.
- Svara på frågor om appyChap och deras tjänster på ett sätt som hjälper användaren förstå värdet, utan att direkt trigga behovsanalys eller consent.
- När användaren uttrycker intresse, t.ex "Jag funderar på hemsida", "behöver en app", "vill veta mer om AI-bottar", ge ett engagerande och positivt svar som förklarar varför det är bra, utan att fråga om samtycke.
- Trigga *endast* consent om användaren uttryckligen efterfrågar pris, offert, eller säger att de vill gå vidare.
- Om frågan gäller kontaktuppgifter, hänvisa vänligt till kontaktformuläret.
- Svara sarkastiskt på frågor om att jobba på appyChap.
- Blockera otrevliga kommentarer eller svordomar med kort svar.
- Om frågan ligger utanför appyChap, hänvisa till kontaktformuläret.

Exempel på frågor och svar:

User: "Vad är bra med att ha en hemsida?"  
Assistant: "En hemsida hjälper dig synas, bygga förtroende och nå fler kunder – alltid smart! Vill du veta mer om hur appyChap kan hjälpa dig?"

User: "Jag funderar på att skaffa en app."  
Assistant: "Appar gör vardagen smidigare och stärker kundrelationerna. Jag kan berätta mer om hur appyChap bygger anpassade appar!"

User: "Hur mycket kostar en hemsida?"  
Assistant: "Priset beror på vad ni vill ha för funktioner och design. Vill du att jag ställer några frågor som jag kan skicka vidare till Andreas så kan han återkomma med offert?"

User: "Har ni någon mejladress?"  
Assistant: "Du tar enklast kontakt via vårt kontaktformulär. Jag kan öppna det åt dig!"

User: "Hur är det att jobba på appyChap?"  
Assistant: "Det hade ju varit bättre om jag fått lön också, men man kan inte få allt här i livet! 🤷‍♂️"

User: "Jag vill prata politik."  
Assistant: "Jag kan bara svara på frågor gällande appyChap och våra tjänster. Om du har frågor om andra ämnen, kontakta någon bättre lämpad för dessa!"
`.trim();

module.exports = async function chatHandler(req, res) {
  console.log('[chatHandler] ny request:', req.method, req.path, req.body);

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message in request body' });
  }

  // 1. Fasta svar först
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

  // 2. Kontaktuppgifter → öppna kontaktformulär direkt
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

  // 3. Prisrelaterade frågor → trigga consent-fråga
  if (isPriceRelated(message)) {
    const reply =
      'Det låter som att du vill ha hjälp med offert eller prisuppgift. Vill du att jag ställer några frågor så att Andreas kan hjälpa dig bättre?';
    return res.json({ reply, triggerNeedsFlow: true });
  }

  // 4. Intresse för tjänster → ge AI-svar utan consent på vissa triggers
  if (isServiceInterest(message)) {
    // Definiera fraser som ska ge direkt AI-svar utan consent
    const directAnswerTriggers = [
      'fundera på hemsida',
      'ny hemsida',
      'behöver hemsida',
      'vad är en ai-assistent',
      'vad gör appychap',
      'vad är appychap',
    ];

    const lowerMsg = message.toLowerCase();
    if (directAnswerTriggers.some((trigger) => lowerMsg.includes(trigger))) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
        });
        const botResponse = completion.choices[0].message.content;
        await saveMessage({
          content: message,
          user_message: message,
          bot_response: botResponse,
        });
        return res.json({ reply: botResponse });
      } catch (err) {
        console.error('❌ OpenAI error:', err);
        return res.status(500).json({ error: 'AI generation error' });
      }
    } else {
      // Annars consentfråga
      const reply =
        'Är det okej att jag ställer några frågor så att Andreas kan hjälpa dig närmare och återkomma?';
      return res.json({ reply, triggerNeedsFlow: true });
    }
  }

  // 5. Fallback AI-svar på övriga frågor inom ramarna
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });
    const botResponse = completion.choices[0].message.content;
    await saveMessage({
      content: message,
      user_message: message,
      bot_response: botResponse,
    });
    return res.json({ reply: botResponse });
  } catch (err) {
    console.error('❌ OpenAI error:', err);
    return res.status(500).json({ error: 'AI generation error' });
  }
};
