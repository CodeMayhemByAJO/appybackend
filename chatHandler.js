/* chatHandler.js – API-endpoint för appyBot */

const saveMessage = require('./saveMessage');
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---- Enkel sessions-state i minnet ---- */
const sessionStates = {}; // { sessionId: { consentRequested, consentDenied } }
const getSession = (id) => {
  if (!sessionStates[id])
    sessionStates[id] = { consentRequested: false, consentDenied: false };
  return sessionStates[id];
};

/* ---- RegExp-listor ---- */
const priceKW = /(pris|kostar|offert|beställa|köpa)/i;
const helpKW = /(kan (du|ni) hjälpa|hjälp mig|behöver hjälp)/i;
const serviceKW =
  /(app|hemsida|webbsida|fotografering|foto|mjukvara|software|ai|bot|automatisering|digitalisering|webbplats)/i;
const contactKW =
  /(mejladress|mailadress|e-post|kontaktuppgifter|adress|telefonnummer|kan jag ringa)/i;

/* -- Direkt-info-frågor (ger svar utan consent) -- */
const directInfoREs = [
  /fundera(r)?\s+(på|över)\s+en?\s+hemsida/i,
  /behöver(\s+en|\s+vi|\s+man)?\s+.*hemsida/i,
  /är det bra (att|med) .*hemsida/i,
  /varför .*hemsida/i,
  /behöver .*app/i,
  /vill ha .*hemsida/i,
  /vad gör appychap/i,
  /vad är appychap/i,
  /vad är en ai[- ]?assistent/i,
];

/* -- Fasta “FAQ”-svar -- */
const fixed = [
  {
    re: /vem är chef/i,
    ans: 'Bruno är tillbakalutad chef och styr företaget med järnhand! 😉 Andreas gör allt annat.',
  },
  {
    re: /hur många är ni|är ni enmansföretag/i,
    ans: 'appyChap är ett enmansföretag med Andreas som driver allt själv, men med Bruno (vovven) som chef! 😉',
  },
  {
    re: /fotograferar appychap/i,
    ans: 'Absolut! Jag levererar foton och redigering så de sitter som en smäck på din hemsida. 😉',
  },
  {
    re: /mitt wifi funkar inte/i,
    ans: 'Ojoj, detta är inget jag kan svara på direkt. Testa kontaktformuläret så återkommer vi!',
  },
  {
    re: /var håller ni till/i,
    ans: 'appyChap finns i Timrå i Medelpad. Är du i krokarna bjuder vi på kaffe!',
  },
];

/* ------------------------------------------------------------------ */
module.exports = async (req, res) => {
  const { message, sessionId } = req.body || {};
  if (!message || !sessionId)
    return res.status(400).json({ error: 'missing data' });
  const msg = message.toLowerCase();
  const S = getSession(sessionId); // <- current session state

  /* 1. Hjälp-signal: fråga efter consent direkt (om inte redan nekat) */
  if (helpKW.test(msg) && !S.consentRequested && !S.consentDenied) {
    S.consentRequested = true;
    return res.json({
      reply:
        'Spännande! Är det okej att jag ställer några frågor så att Andreas kan hjälpa dig bättre?',
      triggerNeedsFlow: true,
    });
  }

  /* 2. Hantera ett pågående consent-svar */
  if (S.consentRequested) {
    if (
      /^(ja|japp|jajjemen|absolut|visst|självklart|okej|kör på|yes?)\b/i.test(
        msg
      )
    ) {
      S.consentRequested = false;
      S.consentDenied = false;
      return res.json({ reply: 'Toppen! Då börjar vi.', startNeedsFlow: true });
    }
    if (/^(nej|nä|nej tack|nope|nädu|icke|absolut inte)\b/i.test(msg)) {
      S.consentRequested = false;
      S.consentDenied = true;
      return res.json({
        reply:
          'Inga problem! Du kan alltid kontakta oss via kontaktformuläret om du vill.',
      });
    }
    return res.json({
      reply:
        'Jag förstod inte ditt svar. Säg gärna Ja eller Nej så går vi vidare!',
    });
  }

  /* 3. Fasta FAQ-svar */
  for (const f of fixed)
    if (f.re.test(msg)) {
      await saveMessage({ user_message: message, bot_response: f.ans });
      return res.json({ reply: f.ans });
    }

  /* 4. Kontaktuppgifter → öppna formulär oavsett state */
  if (contactKW.test(msg)) {
    return res.json({
      reply:
        'Du tar enklast kontakt via vårt kontaktformulär. Jag kan öppna det åt dig om du vill!',
      openContactForm: true,
    });
  }

  /* 5. Pris/offert → consentfråga (om inte tidigare NEJ) */
  if (priceKW.test(msg) && !S.consentRequested && !S.consentDenied) {
    S.consentRequested = true;
    return res.json({
      reply:
        'Det låter som att du vill ha offert. Vill du att jag ställer några frågor först?',
      triggerNeedsFlow: true,
    });
  }

  /* 6. Tjänste-intresse */
  if (serviceKW.test(msg)) {
    // Om användaren redan nekat consent – ge bara info-svar
    if (S.consentDenied || directInfoREs.some((re) => re.test(msg))) {
      const info =
        'Absolut! En hemsida (eller app) från appyChap hjälper er att synas och frigör tid. ' +
        'När ni vill gå vidare är det bara att skicka en rad via kontaktformuläret – vi finns här! 😊';
      await saveMessage({ user_message: message, bot_response: info });
      return res.json({ reply: info });
    }
    // annars be om consent
    S.consentRequested = true;
    return res.json({
      reply:
        'Är det okej att jag ställer några frågor om detta och skickar till Andreas så får han titta på det och återkomma?',
      triggerNeedsFlow: true,
    });
  }

  /* 7. Fallback – OpenAI */
  try {
    const gpt = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
Du är appyBot – kundtjänströsten för enmansföretaget appyChap från Timrå med norrländsk charm.
Svar kort, vänligt och personligt. Undvik detaljerad teknik. Hänvisa till kontaktformuläret vid behov.
        `.trim(),
        },
        { role: 'user', content: message },
      ],
    });
    const reply = gpt.choices[0].message.content;
    await saveMessage({ user_message: message, bot_response: reply });
    return res.json({ reply });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'AI error' });
  }
};
