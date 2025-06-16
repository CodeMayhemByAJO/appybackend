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
  // Lägg inte in svar på kontaktuppgifter här, hanteras separat
];

// Kontaktuppgifter → öppna kontaktformulär
const contactInfoRegex =
  /mejladress|mailadress|e-post|kontaktuppgifter|adress|telefonnummer|kan jag ringa/i;

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

// Prisrelaterade frågor triggar consent
if (isPriceRelated(message)) {
  const reply =
    'Det låter som att du vill ha hjälp med offert eller prisuppgift. Vill du att jag ställer några frågor så att Andreas kan hjälpa dig bättre?';
  return res.json({ reply, triggerNeedsFlow: true });
}

// Intresse för tjänster (t.ex hemsida) — ge ett positivt AI-svar utan consent direkt
if (isServiceInterest(message)) {
  // Exempel på frågor som inte bör trigga consent direkt, som "tänkte det kunde vara bra med en ny hemsida"
  const lowerMsg = message.toLowerCase();
  const directAnswerTriggers = [
    'fundera på hemsida',
    'ny hemsida',
    'behöver hemsida',
    'vad är en ai-assistent',
    'vad gör appychap',
    'vad är appychap',
  ];

  if (directAnswerTriggers.some((trigger) => lowerMsg.includes(trigger))) {
    // Skicka till AI och låt den ge ett relevant svar utan consent
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
  } else {
    // Om det är en övrig tjänstefråga som är mer "intresse" eller "pris", trigga consent
    const reply =
      'Är det okej att jag ställer några frågor så att Andreas kan hjälpa dig närmare och återkomma?';
    return res.json({ reply, triggerNeedsFlow: true });
  }
}
