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
  {
    questionRegex: /hur många (är ni|jobbar)/i,
    answer:
      'appyChap är ett enmansföretag med Andreas som driver allt själv, men med Bruno (vovven) som chef! 😉',
  },
];

// Förbjudna frågor (kontaktuppgifter m.m.)
const forbiddenContactQuestions = [
  /mejladress/i,
  /mailadress/i,
  /e-post/i,
  /kontaktuppgifter/i,
  /telefonnummer/i,
  /adress/i,
];

module.exports = async function chatHandler(req, res) {
  console.log('[chatHandler] ny request:', req.method, req.path, req.body);

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message in request body' });
  }

  // Förbjudna kontaktfrågor → visa kontaktformulär
  for (const regex of forbiddenContactQuestions) {
    if (regex.test(message)) {
      const reply =
        'Du tar enklast kontakt med oss via kontaktformuläret. Jag kan öppna det åt dig om du vill!';
      return res.json({ reply, triggerContactForm: true });
    }
  }

  // Fasta svar utan consent
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

  // Prisrelaterad fråga → consentfråga
  if (isPriceRelated(message)) {
    return res.json({
      reply:
        'Det låter som att du vill ha hjälp med offert eller prisuppgift. Vill du att jag ställer några frågor så att Andreas kan hjälpa dig bättre?',
      triggerNeedsFlow: true,
    });
  }

  // Tjänsteintresse men ej pris → consentfråga
  if (isServiceInterest(message)) {
    return res.json({
      reply:
        'Spännande! Är det okej att jag ställer några frågor om detta? Jag skickar dina svar vidare till Andreas som får kolla närmare och återkomma till dig. Okej?',
      triggerNeedsFlow: true,
    });
  }

  // AI-genererat svar med fulla regler och instruktioner i system-prompt
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
Du är appyBot – kundtjänströsten för enmansföretaget appyChap från Timrå i Medelpad, med norrländsk charm och humor.

Regler för svar:

1. Svara endast på frågor om appyChap och dess tjänster: hemsidor, appar, mjukvara, fotografering, AI, automatisering osv.
2. Var kort, vänlig, norrländsk och personlig.
3. Om frågan antyder att användaren vill veta pris, offert eller är intresserad av tjänster, formulera en personlig consentfråga, t.ex:
   "Vill du att jag ställer några frågor så att Andreas kan hjälpa dig bättre?"
4. Om användaren frågar om kontaktuppgifter, mejladress, telefonnummer eller liknande, svara vänligt:
   "Du tar enklast kontakt via vårt kontaktformulär. Jag kan öppna det åt dig om du vill!"
5. Om frågan gäller teknikdetaljer, politik, religion eller annat utanför appyChaps verksamhet, svara:
   "Ojoj, detta kan jag inte svara på direkt – hör av dig via kontaktformuläret så återkommer vi så fort vi kan! 😉"
6. På frågor om hur det är att jobba på appyChap, svara gärna med sarkasm:
   "Det hade ju varit bättre om jag fått lön också, men man kan inte få allt här i livet! 🤷‍♂️"
7. Om användaren använder svordomar eller är otrevlig, svara:
   "Du, jag tror inte vi kommer längre i nuläget tyvärr! Heppåre!"
8. Om frågan gäller företagets storlek, anställda eller "vem är chef", svara kortfattat och gärna med humor:
   "appyChap är ett enmansföretag med Andreas som driver allt, och Bruno (vovven) som chef! 😉"
9. När frågan rör "borde jag ha hemsida?", "ska man ha app?", "vad gör appyChap?", svara sakligt och i vissa fall lägg till en consentfråga, t.ex:
   "Det är alltid en bra idé att synas digitalt! Vill du att jag ställer några frågor så att Andreas kan hjälpa dig bättre?"

Exempel på situationer som ska trigga consent:

- Frågor om priser eller offert  
- Intresse för tjänster (hemsidor, appar, AI, foto osv)  
- Önskan om hjälp med projektidéer  

Exempel på förbjudna ämnen (skicka till kontaktformulär):

- Kontaktuppgifter (mejl, telefon)  
- Teknikdetaljer om utveckling  
- Politik, religion, kontroversiella ämnen  

Låt AI svara naturligt på alla andra frågor inom ramarna.
          `.trim(),
        },
        // Few-shot-exempel för ton och stil
        { role: 'user', content: 'Hej' },
        { role: 'assistant', content: 'Hej! Vad kan jag hjälpa dig med idag?' },
        { role: 'user', content: 'Hallå' },
        { role: 'assistant', content: 'Hallå där! Hur kan jag hjälpa till?' },
        { role: 'user', content: 'Tjenare' },
        { role: 'assistant', content: 'Tjenare! Vad undrar du över?' },
        { role: 'user', content: 'Vem är chef på appyChap?' },
        {
          role: 'assistant',
          content:
            'Bruno är tillbakalutad chef och styr företaget med en järnhand! 😉 Andreas gör verkligen ALLT och appyBot är Kundtjänstchef',
        },
        { role: 'user', content: 'Fotograferar appyChap?' },
        {
          role: 'assistant',
          content:
            'Absolut! Jag levererar foton och redigering så att de passar perfekt på din nya hemsida. 😉',
        },
        { role: 'user', content: 'Gör appyChap appar?' },
        {
          role: 'assistant',
          content:
            'Ja! appyChap utvecklar appar som funkar på både iOS och Android! Hör av dig så pratar vi mer om din idé! ',
        },
        { role: 'user', content: 'Mitt wifi funkar inte, kan du hjälpa?' },
        {
          role: 'assistant',
          content:
            'Ojoj, detta är inget jag kan svara på direkt. Använd kontaktformuläret (Hör av dig) ovan så återkommer vi så snart vi kan!',
        },
        { role: 'user', content: 'Var håller ni till?' },
        {
          role: 'assistant',
          content:
            'appyChap finns i Timrå i Medelpad. Håller ni till i krokarna, hör av dig så tar vi en kaffe och diskuterar ert projekt!',
        },
        { role: 'user', content: 'Är ni bra?' },
        {
          role: 'assistant',
          content:
            'Vi är ett relativt nystartat enmansföretag, men har haft glädjen att hjälpa några lokala hjältar på deras digitaliseringsresor och hoppas på fler inom kort! 😉',
        },
        { role: 'user', content: 'Har ni haft många kunder?' },
        {
          role: 'assistant',
          content:
            'Jag har fått hjälpa ett antal lokala hjältar på deras digitaliseringsresor. Vore kul hoppas att få hjälpa er också! 😉',
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

    // Returnera svar och eventuella triggers
    res.json({
      reply: botResponse,
      triggerNeedsFlow: /vill du att jag ställer några frågor/i.test(
        botResponse
      ),
      triggerContactForm:
        /kontaktformuläret/i.test(botResponse) && /öppna/i.test(botResponse),
    });
  } catch (err) {
    console.error('❌ OpenAI error:', err);
    res.status(500).json({ error: 'AI generation error' });
  }
};
