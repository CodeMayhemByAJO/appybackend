const express = require('express');
const sendMail = require('./sendMail');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// 🧠 Middleware
app.use(cors());
app.use(express.json()); // 👈 SUPER VIKTIGT för att kunna läsa JSON i body

// 🚀 Test-endpoint
app.get('/', (req, res) => {
  res.send('Backend is running 🚀');
});

// 📬 Kontaktformulär-endpoint
app.post('/contact', async (req, res) => {
  console.log('👉 Inkommande body:', req.body);

  try {
    await sendMail(req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Mail error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Starta servern
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
