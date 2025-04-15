const nodemailer = require('nodemailer');

async function sendMail(name, email, phone, message) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"${name}" <${email}>`,
    to: process.env.EMAIL_USER,
    subject: 'Nytt meddelande från kontaktformuläret på appyChap.se',

    // Textversion – visas som fallback
    text: `
Du har fått ett nytt meddelande via kontaktformuläret:

Namn: ${name}
E-post: ${email}
Telefon: ${phone}

Meddelande:
${message}
    `,

    // HTML-version – snygg i Gmail, Outlook m.fl.
    html: `
      <p><strong>Du har fått ett nytt meddelande via kontaktformuläret:</strong></p>
      <p><strong>Namn:</strong> ${name}</p>
      <p><strong>E-post:</strong> <a href="mailto:${email}">${email}</a></p>
      <p><strong>Telefon:</strong> <a href="tel:${phone}">${phone}</a></p>
      <p><strong>Meddelande:</strong><br>${message.replace(/\n/g, '<br>')}</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = sendMail;
