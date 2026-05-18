const { Pool } = require('pg');

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initDB() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS usuarios(
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      senha TEXT NOT NULL,
      verificado BOOLEAN DEFAULT FALSE,
      codigo_verificacao TEXT,
      reset_token TEXT,
      reset_expira TIMESTAMP,
      banido BOOLEAN DEFAULT FALSE,
      xp INTEGER DEFAULT 0,
      nivel INTEGER DEFAULT 1,
      role TEXT DEFAULT 'aluno',
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("Banco OK");
}

module.exports = initDB;
module.exports.db = db;
