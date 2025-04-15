const nodemailer = require('nodemailer');

async function sendMail({ name, email, phone, message, website }) {
  // 🐝 Honeypot – stoppa bottar direkt
  if (website && website.trim() !== '') {
    throw new Error('Bot detected via honeypot field');
  }

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

  // 📬 Mailinnehåll
  const mailOptions = {
    from: `"${name}" <${email}>`,
    to: process.env.EMAIL_USER,
    subject: 'Nytt meddelande från kontaktformuläret på appyChap.se',

    text: `
Du har fått ett nytt meddelande via kontaktformuläret:

Namn: ${name}
E-post: ${email}
Telefon: ${phone || 'Ej angivet'}

Meddelande:
${message}
    `,

    html: `
      <p><strong>Du har fått ett nytt meddelande via kontaktformuläret:</strong></p>
      <p><strong>Namn:</strong> ${name}</p>
      <p><strong>E-post:</strong> <a href="mailto:${email}">${email}</a></p>
      <p><strong>Telefon:</strong> ${
        phone ? `<a href="tel:${phone}">${phone}</a>` : 'Ej angivet'
      }</p>
      <p><strong>Meddelande:</strong><br>${message.replace(/\n/g, '<br>')}</p>
    `,
  };

  // 🚀 Skicka!
  await transporter.sendMail(mailOptions);
}

module.exports = sendMail;
