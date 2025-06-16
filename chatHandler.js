const saveMessage = require('./saveMessage');
const { OpenAI } = require('openai');

console.log('[chatHandler] modul laddad!');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Klassificera användarfrågan för att avgöra typ av svar
async function classifyUserMessage(message) {
  const classificationPrompt = `
Klassificera följande fråga som "info", "consent", "contact" eller "out-of-scope":
Fråga: "${message}"

- "info" = generella frågor som kan besvaras direkt.
- "consent" = köpintresse, offert, pris, beställning.
- "contact" = fråga om kontaktuppgifter.
- "out-of-scope" = allt annat utanför appyChap.
Svar endast med kategorin.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: classificationPrompt }],
    });

    const category = response.choices[0].message.content.trim().toLowerCase();
    return category;
  } catch (err) {
    console.error('❌ Klassificeringsfel:', err);
    // Vid fel: defaulta till "info" så AI kan försöka svara ändå
    return 'info';
  }
}

// Fasta svar som alltid returneras direkt (utan consent)
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

// Nyckelord för prisrelaterade frågor (känsliga för consent)
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

module.exports = async function chatHandler(req, res) {
  console.log('[chatHandler] ny request:', req.method, req.path, req.body);

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message in request body' });
  }

  // 1. Kolla fasta svar först
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

  // 3. Klassificera med AI och agera enligt kategori
  const category = await classifyUserMessage(message);

  if (category === 'contact') {
    const reply =
      'Du tar enklast kontakt via vårt kontaktformulär. Jag kan öppna det åt dig om du vill!';
    await saveMessage({
      content: message,
      user_message: message,
      bot_response: reply,
    });
    return res.json({ reply, openContactForm: true });
  }

  if (category === 'consent') {
    const reply =
      'Det låter som att du vill ha hjälp med offert eller prisuppgift. Vill du att jag ställer några frågor så att Andreas kan hjälpa dig bättre?';
    return res.json({ reply, triggerNeedsFlow: true });
  }

  if (category === 'info') {
    // Skicka till AI för direkt svar utan consent
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
  }

  // 4. Om out-of-scope → hänvisa till kontaktformulär
  if (category === 'out-of-scope') {
    const reply =
      'Ojoj, detta är inget jag kan svara på direkt – hör av dig via kontaktformuläret så återkommer vi så snart som möjligt! 😉';
    await saveMessage({
      content: message,
      user_message: message,
      bot_response: reply,
    });
    return res.json({ reply });
  }

  // 5. Fallback: om ingen kategori matchar, låt AI svara ändå
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
