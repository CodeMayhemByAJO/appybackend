
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sendMail = require('./sendMail');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    await sendMail(name, email, message);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Mail error:', error);
    res.status(500).json({ success: false, error: 'Failed to send email.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
