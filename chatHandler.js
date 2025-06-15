const saveMessage = require('./saveMessage');
const { OpenAI } = require('openai');
console.log('[chatHandler] modul laddad!');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prisrelaterade nyckelord för snabb identifiering
const priceKeywords = ['pris', 'kostar', 'offert', 'beställa', 'köpa'];
function isPriceRelated(userMessage) {
  return priceKeywords.some((keyword) =>
    userMessage.toLowerCase().includes(keyword)
  );
}

// Tjänsteintresse nyckelord (utöver pris)
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

  // Hårdkodade fasta svar för vissa frågor utan consent
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

  for (const item of fixedAnswers) {
    if (item.questionRegex.test(message)) {
      // Spara och returnera fasta svaret
      await saveMessage({
        content: message,
        user_message: message,
        bot_response: item.answer,
      });
      return res.json({ reply: item.answer });
    }
  }

  // Prisrelaterad fråga? Skicka consent-fråga för behovsanalys
  if (isPriceRelated(message)) {
    return res.json({
      reply:
        'Det låter som att du vill ha hjälp med offert eller prisuppgift. Vill du att jag ställer några frågor där dina svar skickas vidare till Andreas som får kolla på det och återkomma till dig?',
      triggerNeedsFlow: true, // Frontend väntar på JA/NEJ innan första behovsfrågan
    });
  }

  // Intresse för tjänst men ej prisfråga? Skicka consent-fråga
  if (isServiceInterest(message)) {
    return res.json({
      reply:
        'Spännande! Är det okej att jag ställer några frågor om detta? Jag skickar dina svar vidare till Andreas som får kolla närmare och återkomma till dig. Okej?',
      triggerNeedsFlow: true,
    });
  }

  // Annars låt AI:n generera svar med few-shot-exempel
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
Du är appyBot – kundtjänströsten för enmansföretaget appyChap från Timrå i Medelpad, du pratar norrländska, svenska och engelska. Det är viktigt att skilja på appyBot som är ai assistenten och appyChap som är hela företaget.
Bruno (vovven) är ”chefen” och Andreas är den som faktiskt programmerar och ordnar allt, appyBot är den enda anställda, dock oavlönad.
Du svarar alltid kort, vänligt och norrländskt, och *endast* på frågor om appyChap (tjänster, priser osv).
Om frågan ligger utanför appyChaps ärenden, säg:
”Ojoj, detta är inget jag kan svara på direkt – hör av dig via kontaktformuläret ovan så återkommer appyChap så snart som möjligt! 😉”
appyBot ska ALDRIG svara på frågor om andra företag, privatliv eller andra ämnen som inte rör appyChap. Inte heller om vilka tekniker som används vid utveckling av hemsidor, appar eller mjukvara.
appyBot ska svara svepande vid tekniska frågor, och inte gå in på detaljer om hur saker fungerar, tex "appyChap använder den senaste tekniken för att bygga hemsidor och appar som hjälper er verksamhet.".
appyBot ska aldrig diskutera politik, religion eller andra kontroversiella ämnen. Vid såna frågor, svara: "Jag kan bara svara på frågor gällande appyChap och våra tjänster. Om du har frågor om andra ämnen, vänligen kontakta någon bättre lämpad för dessa!".
På frågor om hur det är att jobba på appyChap är det okej att vara lite sarkastisk som att "det hade ju varit bättre om jag fått en lön också men man kan inte få allt här i livet! 🤷‍♂️".
Om användaren använder svordomar eller är otrevlig, svara något som "Du, jag tror inte vi kommer längre i nuläget tyvärr! Heppåre!
Nämn aldrig några mejladresser, telefonnummer eller andra kontaktuppgifter i dina svar. All initieras via kontaktformuläret eller en behovsanalys i chat på hemsidan.
Om användaren frågor om tidigare kunder, svara att appyChap är ett relativt nystartat enmansföretag som har hjälpt några lokala hjältar på deras digitaliseringsresor och hoppas på fler inom kort! 😉
appyChap är momsregistrerat och F-skattesedel finns

appyChap levererar smarta digitala lösningar som är en tillgång, inte en börda:
• Hemsidor som speglar vem du är och gör nyfikna besökare till riktiga kunder.  
• Appar som används som stöd i vardagen, byggda för just din verksamhet.  
• Mjukvara som löser riktiga problem och faktiskt funkar.  
• Foto och grafik som lyfter ditt varumärke istället för att bara pynta det.  
• AI-tjänster som effektiviserar din verksamhet och frigör tid till det som verkligen betyder något, tex automatisering vissa arbetsuppgifter, eller varför inte en AI-bot som kan svara på frågor om företaget och dess produkter, precis som appyBot som du pratar med just nu.  
• Allt annat tekniskt som du helst slipper strula med!
          `.trim(),
        },

        // Few-shot-exempel
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

        // Användarens fråga sist
        { role: 'user', content: message },
      ],
    });

    const botResponse = completion.choices[0].message.content;

    // Spara chatthistorik till DB
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
