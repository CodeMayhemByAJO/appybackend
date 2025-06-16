const saveMessage = require('./saveMessage');
const { OpenAI } = require('openai');

console.log('[chatHandler] modul laddad!');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prisrelaterade nyckelord (triggar consent)
const priceKeywords = ['pris', 'kostar', 'offert', 'beställa', 'köpa'];
function isPriceRelated(msg) {
  return priceKeywords.some((k) => msg.includes(k));
}

// Kontaktinfo regex (direktkontakt)
const contactInfoRegex =
  /mejladress|mailadress|e-post|kontaktuppgifter|adress|telefonnummer|kan jag ringa/i;

// Hårdkodade fasta svar (direkt svar utan AI)
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

// Informativa triggers (funderingar, frågor som ger svar utan consent)
const informativeTriggers = [
  'fundera på hemsida',
  'fundering på hemsida',
  'funderar på hemsida',
  'tänker på hemsida',
  'vad är en hemsida',
  'vad gör appychap',
  'vad är appychap',
  'vad är en ai-assistent',
  'vad är ai-assistent',
  'vad är en ai bot',
  'är det bra med hemsida',
  'är det smart med hemsida',
  'varför ha hemsida',
  'fördel med hemsida',
];

// Consent triggers (tydligt intresse / köpsignaler)
const consentTriggers = [
  'vill ha hemsida',
  'behöver hemsida',
  'kan ni göra hemsida',
  'kan ni hjälpa med hemsida',
  'beställa hemsida',
  'köpa hemsida',
  'vill göra hemsida',
  'vill ha app',
  'behöver app',
  'kan ni göra app',
  'kan ni hjälpa med app',
  'beställa app',
  'köpa app',
];

module.exports = async function chatHandler(req, res) {
  console.log('[chatHandler] ny request:', req.method, req.path, req.body);

  const rawMessage = req.body.message;
  if (!rawMessage) {
    return res.status(400).json({ error: 'Missing message in request body' });
  }

  const message = rawMessage.toLowerCase().trim();

  // 1. Kolla fasta svar
  for (const item of fixedAnswers) {
    if (item.questionRegex.test(rawMessage)) {
      await saveMessage({
        content: rawMessage,
        user_message: rawMessage,
        bot_response: item.answer,
      });
      return res.json({ reply: item.answer });
    }
  }

  // 2. Kontaktuppgifter → hänvisa direkt till kontaktformulär
  if (contactInfoRegex.test(message)) {
    const reply =
      'Du tar enklast kontakt via vårt kontaktformulär. Jag kan öppna det åt dig om du vill!';
    await saveMessage({
      content: rawMessage,
      user_message: rawMessage,
      bot_response: reply,
    });
    return res.json({ reply, openContactForm: true });
  }

  // 3. Prisrelaterade frågor → trigga consentfråga
  if (isPriceRelated(message)) {
    const reply =
      'Det låter som att du vill ha hjälp med offert eller prisuppgift. Vill du att jag ställer några frågor så att Andreas kan hjälpa dig bättre?';
    return res.json({ reply, triggerNeedsFlow: true });
  }

  // 4. Informativa frågor → AI-svar utan consent
  if (informativeTriggers.some((trigger) => message.includes(trigger))) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `
Du är appyBot – kundtjänströsten för enmansföretaget appyChap från Timrå med norrländsk charm och humor.
Svarar kort, vänligt och personligt.
Svarar på frågor om appyChap och deras tjänster utan att trigga behovsanalys eller consent.
Om frågan gäller kontaktuppgifter, hänvisa alltid till kontaktformuläret.
          `.trim(),
          },
          { role: 'user', content: rawMessage },
        ],
      });
      const botResponse = completion.choices[0].message.content;
      await saveMessage({
        content: rawMessage,
        user_message: rawMessage,
        bot_response: botResponse,
      });
      return res.json({ reply: botResponse });
    } catch (err) {
      console.error('❌ OpenAI error:', err);
      return res.status(500).json({ error: 'AI generation error' });
    }
  }

  // 5. Consent triggers → trigga consentfråga
  if (consentTriggers.some((trigger) => message.includes(trigger))) {
    const reply =
      'Spännande! Är det okej att jag ställer några frågor så att Andreas kan hjälpa dig närmare och återkomma?';
    return res.json({ reply, triggerNeedsFlow: true });
  }

  // 6. Fallback AI-svar på andra frågor inom ramarna
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
        { role: 'user', content: rawMessage },
      ],
    });
    const botResponse = completion.choices[0].message.content;
    await saveMessage({
      content: rawMessage,
      user_message: rawMessage,
      bot_response: botResponse,
    });
    return res.json({ reply: botResponse });
  } catch (err) {
    console.error('❌ OpenAI error:', err);
    return res.status(500).json({ error: 'AI generation error' });
  }
};
