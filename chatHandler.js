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

// Kontaktuppgifter → öppna kontaktformulär
const contactInfoRegex =
  /mejladress|mailadress|e-post|kontaktuppgifter|adress|telefonnummer|kan jag ringa/i;

// Flexibel funktion för att avgöra när AI ska ge direkt svar utan consent
function matchesDirectAnswer(message) {
  const msg = message.toLowerCase();

  const serviceTopics = [
    'hemsida',
    'webbsida',
    'webbplats',
    'app',
    'ai-assistent',
    'ai bot',
    'ai-bott',
    'foto',
    'fotografering',
    'mjukvara',
    'digitalisering',
  ];

  const interestIndicators = [
    'fundera',
    'fundering',
    'behöver',
    'behöver kanske',
    'tänker på',
    'tänker att',
    'skulle vilja ha',
    'vill ha',
    'kan ni',
    'vad är',
    'vad gör',
    'är det bra',
    'är det smart',
    'varför',
    'fördel',
    'ny',
    'kan jag få',
    'kan jag beställa',
  ];

  const hasTopic = serviceTopics.some((topic) => msg.includes(topic));
  const hasInterest = interestIndicators.some((ind) => msg.includes(ind));

  if (hasTopic && hasInterest) return true;

  if (
    msg.includes('vad gör appychap') ||
    msg.includes('vad är appychap') ||
    msg.includes('vad är en ai-assistent') ||
    msg.includes('vad är ai-assistent') ||
    msg.includes('vad är en ai bot')
  )
    return true;

  return false;
}

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

  // 4. Intresse för tjänster → antingen direkt AI-svar eller consentfråga beroende på fråga
  if (isServiceInterest(message)) {
    if (matchesDirectAnswer(message)) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `
Du är appyBot – kundtjänströsten för enmansföretaget appyChap från Timrå med norrländsk charm och humor.
appyChap levererar smarta digitala lösningar som är en tillgång, inte en börda:
• Hemsidor som speglar vem du är och gör nyfikna besökare till riktiga kunder.
• Appar som används som stöd i vardagen, byggda för just din verksamhet.
• Mjukvara som löser riktiga problem och faktiskt funkar.
• Foto och grafik som lyfter ditt varumärke istället för att bara pynta det.
• AI-tjänster som effektiviserar din verksamhet och frigör tid till det som verkligen betyder något, t.ex automatisering av vissa arbetsuppgifter eller AI-bottar som svarar på frågor.
Svara kort, vänligt och personligt.
Svara på frågor om appyChap och deras tjänster utan att trigga behovsanalys eller consent.
Om frågan gäller kontaktuppgifter, hänvisa alltid till kontaktformuläret.
              `.trim(),
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
        return res.json({ reply: botResponse });
      } catch (err) {
        console.error('❌ OpenAI error:', err);
        return res.status(500).json({ error: 'AI generation error' });
      }
    } else {
      const reply =
        'Är det okej att jag ställer några frågor så att Andreas kan hjälpa dig närmare och återkomma?';
      return res.json({ reply, triggerNeedsFlow: true });
    }
  }

  // 5. Fallback AI-svar på andra frågor inom ramarna
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
