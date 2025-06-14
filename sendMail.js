const nodemailer = require('nodemailer');

async function sendMail({ name, email, phone, message }) {
  // 👮 Grundläggande validering av obligatoriska fält
  if (!name || !email || !message) {
    throw new Error('Obligatoriska fält saknas');
  }

  // 📞 Validera telefonnummer (om angivet): endast siffror
  if (phone && !/^\d+$/.test(phone)) {
    throw new Error('Telefonnummer får endast innehålla siffror');
  }

  // ✉️ Konfigurera transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Bestäm ämnesrad baserat på om det är en behovsanalys eller vanligt kontakt-mail
  const subject = message.startsWith('Behovsanalys från appyBot:')
    ? 'Ny behovsanalys från appyBot på appyChap.se'
    : 'Nytt meddelande från kontaktformuläret på appyChap.se';

  // 📬 Mailinnehåll
  const mailOptions = {
    from: `"${name}" <${email}>`,
    to: process.env.EMAIL_USER,
    subject, // <-- dynamiskt ämne
    text: `
Du har fått ett nytt meddelande:

Namn: ${name}
E-post: ${email}
Telefon: ${phone || 'Ej angivet'}

Meddelande:
${message}
    `,
    html: `
      <p><strong>Du har fått ett nytt meddelande:</strong></p>
      <p><strong>Namn:</strong> ${name}</p>
      <p><strong>E-post:</strong> <a href="mailto:${email}">${email}</a></p>
      <p><strong>Telefon:</strong> ${
        phone ? `<a href="tel:${phone}">${phone}</a>` : 'Ej angivet'
      }</p>
      <hr/>
      <pre style="white-space: pre-wrap;">${message.replace(
        /\n/g,
        '<br>'
      )}</pre>
    `,
  };

  // 🚀 Skicka!
  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ E-post skickad');
  } catch (err) {
    console.error('❌ Misslyckades skicka e-post:', err);
    throw new Error('Failed to send email.');
  }
}

module.exports = sendMail;
