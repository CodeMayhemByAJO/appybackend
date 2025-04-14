
const nodemailer = require('nodemailer');

async function sendMail(name, email, message) {
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
    subject: 'Nytt meddelande från kontaktformulär',
    text: message,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = sendMail;
