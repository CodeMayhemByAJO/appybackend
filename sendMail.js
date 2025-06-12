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

  // 📬 Mailinnehåll
  const mailOptions = {
    from: `"${name}" <${email}>`,
    to: process.env.EMAIL_USER,
    subject: 'Ny behovsanalys från appyBot på appyChap.se',

    text: `
Du har fått en ny behovsanalys via appyBot:

Namn: ${name}
E-post: ${email}
Telefon: ${phone || 'Ej angivet'}

Analys:
${message}
    `,

    html: `
      <p><strong>Du har fått en ny behovsanalys via appyBot:</strong></p>
      <p><strong>Namn:</strong> ${name}</p>
      <p><strong>E-post:</strong> <a href="mailto:${email}">${email}</a></p>
      <p><strong>Telefon:</strong> ${
        phone ? `<a href="tel:${phone}">${phone}</a>` : 'Ej angivet'
      }</p>
      <p><strong>Analys:</strong><br>${message.replace(/\n/g, '<br>')}</p>
    `,
  };

  // 🚀 Skicka!
  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ E-post skickad');
  } catch (err) {
    console.error('❌ Misslyckades skicka e-post:', err); // <-- detta visar exakt Gmail/Nodemailer-fel
    throw new Error('Failed to send email.');
  }
}

module.exports = sendMail;
