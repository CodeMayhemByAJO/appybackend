const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // lägg till i .env
  ssl: {
    rejectUnauthorized: false,
  },
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
