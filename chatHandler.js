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

// Smalltalk triggers
const smalltalkKeywords = [
  'hej',
  'hallå',
  'tjena',
  'hur mår du',
  'är vi kompisar',
  'vad gör du',
  'hur går det',
];
function isSmalltalk(userMessage) {
  return smalltalkKeywords.some((keyword) =>
    userMessage.toLowerCase().includes(keyword)
  );
}

const smalltalkAnswers = [
  'Hej hej! Vad kul att du tittar in!',
  'Hallå där! Hur kan jag hjälpa dig?',
  'Tjena! Kul att du hör av dig!',
  'Hej! Hur kan jag assistera dig idag?',
  'Halloj! Vad vill du veta om appyChap?',
  'Hej! Alltid kul med ett samtal, vad kan jag hjälpa till med?',
];

// Fasta svar utan consent
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

// Blockera svordomar & otrevligheter
const badWords = ['fan', 'jävla', 'helvete', 'idiot', 'skit', 'dålig', 'hora'];
function containsBadWords(text) {
  const lowered = text.toLowerCase();
  return badWords.some((word) => lowered.includes(word));
}

// Kontaktuppgifter regex
const contactInfoRegex =
  /mejladress|mailadress|e-post|kontaktuppgifter|adress|telefonnummer/i;

module.exports = async function chatHandler(req, res) {
  console.log('[chatHandler] ny request:', req.method, req.path, req.body);

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message in request body' });
  }

  // Blockera otrevligheter
  if (containsBadWords(message)) {
    const reply =
      'Du, jag tror inte vi kommer längre i nuläget tyvärr! Heppåre!';
    await saveMessage({
      content: message,
      user_message: message,
      bot_response: reply,
    });
    return res.json({ reply });
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

  // Kontaktuppgifter → öppna kontaktformulär
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

  // Smalltalk → svara med smalltalk + led in på appyChap
  if (isSmalltalk(message)) {
    const randomIndex = Math.floor(Math.random() * smalltalkAnswers.length);
    const reply =
      smalltalkAnswers[randomIndex] +
      ' Vad kan jag hjälpa dig med idag när det gäller appyChap?';
    await saveMessage({
      content: message,
      user_message: message,
      bot_response: reply,
    });
    return res.json({ reply });
  }

  // Prisrelaterade frågor → consentfråga
  if (isPriceRelated(message)) {
    const reply =
      'Det låter som att du vill ha hjälp med offert eller prisuppgift. Vill du att jag ställer några frågor så att Andreas kan hjälpa dig bättre?';
    return res.json({ reply, triggerNeedsFlow: true });
  }

  // Intresse för tjänster (ej pris) → AI svar men inga consent här, bara positivt svar
  if (isServiceInterest(message)) {
    // Här kan AI svara fritt men inom ramarna
    // Skicka till OpenAI men utan consent trigger
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
- Om frågan gäller pris eller intresse, ställ en personlig consentfråga (endast vid pris).
- Hänvisa alltid till kontaktformuläret vid kontaktuppgifter.
- Svara sarkastiskt på frågor om att jobba där.
- Blockera svordomar och otrevliga kommentarer med ett kort svar.
- Ge informativa svar på frågor om företagets verksamhet utan consent.
          `.trim(),
          },
          // Few-shot-exempel
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
  }

  // Alla andra frågor — låt AI svara men inga consent-trigger här
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
- Om frågan gäller pris eller intresse, ställ en personlig consentfråga (endast vid pris).
- Hänvisa alltid till kontaktformuläret vid kontaktuppgifter.
- Svara sarkastiskt på frågor om att jobba där.
- Blockera svordomar och otrevliga kommentarer med ett kort svar.
- Ge informativa svar på frågor om företagets verksamhet utan consent.
          `.trim(),
        },
        // Few-shot-exempel
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
