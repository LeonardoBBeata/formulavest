require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const NodeCache = require('node-cache');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const validator = require('validator');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const cache = new NodeCache({
    stdTTL: 300
});

// ======================
// POSTGRESQL
// ======================

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ======================
// EMAIL
// ======================
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

transporter.verify((error) => {
    if (error) {
        console.error('ERRO SMTP:', error);
    } else {
        console.log('SMTP conectado com sucesso!');
    }
});


// ======================
// MIDDLEWARES
// ======================

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// ======================
// DATABASE INIT
// ======================

async function initDB() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS usuarios(
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      senha TEXT NOT NULL,
      verificado BOOLEAN DEFAULT FALSE,
      codigo_verificacao TEXT,
      xp INTEGER DEFAULT 0,
      nivel INTEGER DEFAULT 1,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS email TEXT UNIQUE
  `);

  await db.query(`
    ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS verificado BOOLEAN DEFAULT FALSE
  `);

  await db.query(`
    ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS codigo_verificacao TEXT
  `);

    await db.query(`
  CREATE TABLE IF NOT EXISTS provas(
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    acertos INTEGER,
    total INTEGER,
    percentual REAL,
    questoes JSONB,
    criado_em TIMESTAMP DEFAULT NOW()
  )
`);

  console.log('Banco OK');
}

initDB().catch(err => {
    console.error('Erro ao iniciar banco:', err);
    process.exit(1);
});

// ======================
// JWT
// ======================

function gerarToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username
        },
        process.env.JWT_SECRET,
        {
            expiresIn: '7d'
        }
    );
}

function auth(req, res, next) {

    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({
            error: 'Token ausente'
        });
    }

    const token = header.split(' ')[1];

    try {
        req.user = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        next();

    } catch {
        return res.status(401).json({
            error: 'Token inválido'
        });
    }
}

// ======================
// IA
// ======================

async function chamarIA(prompt) {

    try {

        const response = await axios.post(
            'https://router.huggingface.co/v1/chat/completions',
            {
                model: 'deepseek-ai/DeepSeek-V3.2:fastest',
                messages: [
                    {
                        role: 'system',
                        content: 'Você é especialista em ENEM.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            },
            {
                headers: {
                    Authorization:
                        `Bearer ${process.env.HUGGINGFACE_API_KEY}`
                },
                timeout: 60000
            }
        );

        return response.data
            .choices?.[0]
            ?.message?.content;

    } catch (err) {
        console.log(err.message);
        throw new Error('Erro IA');
    }
}

function extrairJSONSeguro(texto) {
    try {
        const match = texto.match(
            /\{[\s\S]*\}|\[[\s\S]*\]/
        );

        if (!match) return null;

        return JSON.parse(match[0]);

    } catch {
        return null;
    }
}

// ======================
// HEALTH
// ======================

app.get('/', (_, res) => {
    res.send('API ONLINE 🚀');
});

// ======================
// REGISTER
// ======================

app.post('/register', async (req, res) => {
    try {
        const username = req.body.username?.trim();
        const email = req.body.email?.toLowerCase().trim();
        const senha = req.body.senha;
   

        // validações
        if (!username || username.length < 3) {
            return res.status(400).json({
                error: 'Usuário inválido (mínimo 3 caracteres)'
            });
        }

        if (!validator.isEmail(email || '')) {
            return res.status(400).json({
                error: 'Email inválido'
            });
        }

        if (!senha || senha.length < 8) {
            return res.status(400).json({
                error: 'Senha deve ter mínimo 8 caracteres'
            });
        }

        // verificar se já existe
        const existe = await db.query(
            `
            SELECT id
            FROM usuarios
            WHERE username = $1
               OR email = $2
            `,
            [username, email]
        );

        if (existe.rows.length > 0) {
            return res.status(400).json({
                error: 'Usuário ou email já existe'
            });
        }

        // gerar hash da senha
        const hash = await bcrypt.hash(senha, 10);

        // gerar código de verificação
        const codigo = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // salvar usuário no banco
        await db.query(
            `
            INSERT INTO usuarios (
                username,
                email,
                senha,
                codigo_verificacao
            )
            VALUES ($1, $2, $3, $4)
            `,
            [
                username,
                email,
                hash,
                codigo
            ]
        );

        console.log('Tentando enviar email para:', email);

        // enviar email
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: email,
            subject: 'Código de verificação - FórmulaVest',
            text: `Seu código de verificação é: ${codigo}`
        });
transporter.verify((error, success) => {
    if (error) {
        console.error('ERRO SMTP:', error);
    } else {
        console.log('SMTP conectado com sucesso!');
    }
});
        

        console.log('Email enviado com sucesso:', info);

        return res.json({
            ok: true,
            message: 'Código enviado para seu email'
        });

    } catch (err) {
        console.error('ERRO NO REGISTER:', err);

        return res.status(500).json({
            error: 'Erro interno no registro'
        });
    }
});
// ======================
// VERIFY EMAIL
// ======================

app.post('/verificar-email', async (req, res) => {

    try {

        const email =
            req.body.email?.toLowerCase().trim();

        const {
            codigo
        } = req.body;

        const result =
            await db.query(
                `
                SELECT *
                FROM usuarios
                WHERE email=$1
                `,
                [email]
            );

        const user =
            result.rows[0];

        if (!user) {
            return res.status(404).json({
                error:
                    'Usuário não encontrado'
            });
        }

        if (
            user.codigo_verificacao
            !== codigo
        ) {
            return res.status(400).json({
                error:
                    'Código inválido'
            });
        }

        await db.query(
            `
            UPDATE usuarios
            SET
                verificado=TRUE,
                codigo_verificacao=NULL
            WHERE id=$1
            `,
            [user.id]
        );

        res.json({
            ok: true
        });

    } catch (err) {
        console.log(err);

        res.status(500).json({
            error:
                'Erro verificação'
        });
    }
});

// ======================
// LOGIN
// ======================

app.post('/login', async (req, res) => {

    try {

        const email =
            req.body.email?.toLowerCase().trim();

        const {
            senha
        } = req.body;

        const result =
            await db.query(
                `
                SELECT *
                FROM usuarios
                WHERE email=$1
                `,
                [email]
            );

        const user =
            result.rows[0];

        if (!user) {
            return res.status(401).json({
                error:
                    'Email não encontrado'
            });
        }

        if (!user.verificado) {
            return res.status(403).json({
                error:
                    'Verifique seu email primeiro'
            });
        }

        const ok =
            await bcrypt.compare(
                senha,
                user.senha
            );

        if (!ok) {
            return res.status(401).json({
                error:
                    'Senha incorreta'
            });
        }

        const token =
            gerarToken(user);

        res.json({
            ok: true,
            token,
            user: {
                id: user.id,
                username:
                    user.username,
                xp: user.xp,
                nivel:
                    user.nivel
            }
        });

    } catch (err) {
        console.log(err);

        res.status(500).json({
            error:
                'Erro login'
        });
    }
});
// server.js completo atualizado (PARTE 2/2)

// ======================
// GERAR PROVA
// ======================
app.post('/gerar-prova', auth, async (req, res) => {
  try {
    const { curso, faculdade, quantidade } = req.body;
    const qtd = Number(quantidade) || 10;

    const prompt = `
Crie ${qtd} questões estilo ENEM para:
Curso: ${curso}
Faculdade: ${faculdade}

RETORNE SOMENTE JSON:
{
  "questoes": [{
    "enunciado":"",
    "opcoes":{"A":"","B":"","C":"","D":"","E":""},
    "correta":"A"
  }]
}`;

    const resposta = await chamarIA(prompt);
    const json = extrairJSONSeguro(resposta);

    if (!json?.questoes) {
      return res.status(500).json({ error: 'IA inválida' });
    }

    res.json({ questoes: json.questoes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro gerar prova' });
  }
});

// ======================
// GERAR ENEM (90 questões)
// ======================
app.post('/gerar-enem', auth, async (req, res) => {
  try {
    let questoes = [];
    let tentativas = 0;

    while (questoes.length < 90 && tentativas < 20) {
      tentativas++;
      try {
        const resposta = await chamarIA(`
Crie 10 questões inéditas estilo ENEM.
RETORNE SOMENTE JSON:
{
  "questoes": [{
    "enunciado":"",
    "opcoes":{"A":"","B":"","C":"","D":"","E":""},
    "correta":"A"
  }]
}`);

        const json = extrairJSONSeguro(resposta);
        if (json?.questoes) {
          questoes.push(...json.questoes);
        }
      } catch (e) {
        console.log('Tentativa falhou:', e.message);
      }
    }

    if (questoes.length === 0) {
      return res.status(500).json({ error: 'Falha ao gerar questões' });
    }

    res.json({ questoes: questoes.slice(0, 90) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ENEM' });
  }
});

// ======================
// SALVAR PROVA
// ======================
app.post('/salvar-prova', auth, async (req, res) => {
  try {
    const { questoes } = req.body;

    let acertos = 0;
if (!Array.isArray(questoes) || questoes.length === 0) {
    return res.status(400).json({
        error: 'Questões inválidas'
    });
}


questoes.forEach(q => {
    if (q.selecionada === q.correta) {
        acertos++;
    }
});

    const percentual = (acertos / questoes.length) * 100;
    const xpGanho = Math.floor(percentual);

    await db.query(`
      UPDATE usuarios
      SET xp = xp + $1,
          nivel = FLOOR((xp + $1)/100)+1
      WHERE id = $2
    `, [xpGanho, req.user.id]);

    const result = await db.query(`
      INSERT INTO provas(usuario_id, acertos, total, percentual, questoes)
      VALUES($1,$2,$3,$4,$5)
      RETURNING *
    `, [
      req.user.id,
      acertos,
      questoes.length,
      percentual,
      JSON.stringify(questoes)
    ]);

    cache.del(`provas_${req.user.id}`);

    res.json({
      ok: true,
      prova: result.rows[0],
      acertos,
      percentual
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro salvar prova' });
  }
});

// ======================
// HISTÓRICO
// ======================
app.get('/provas', auth, async (req, res) => {
  try {
    const cacheKey = `provas_${req.user.id}`;
    const cached = cache.get(cacheKey);

    if (cached) return res.json({ provas: cached });

    const result = await db.query(`
      SELECT * FROM provas
      WHERE usuario_id = $1
      ORDER BY id DESC
    `, [req.user.id]);

    cache.set(cacheKey, result.rows);
    res.json({ provas: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro histórico' });
  }
});


//=======================
//teste email
//=======================
app.get('/teste-email', async (_, res) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: process.env.SMTP_USER,
            subject: 'Teste SMTP',
            text: 'Se chegou, está funcionando.'
        });

        console.log(info);
        res.send('Email enviado');

    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao enviar');
    }
});

// ======================
// RANKING
// ======================
app.get('/ranking', async (_, res) => {
  try {
    const result = await db.query(`
      SELECT username, xp, nivel
      FROM usuarios
      ORDER BY xp DESC
      LIMIT 50
    `);

    res.json({ ranking: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ranking' });
  }
});

// ======================
// CORRIGIR REDAÇÃO
// ======================
app.post('/corrigir-redacao', auth, async (req, res) => {
  try {
    const { tema, texto } = req.body;

    const prompt = `
Corrija esta redação ENEM.
Tema: ${tema}
Texto: ${texto}

Retorne JSON:
{
 "competencia1":0,
 "competencia2":0,
 "competencia3":0,
 "competencia4":0,
 "competencia5":0,
 "nota_total":0,
 "feedback":""
}`;

    const resposta = await chamarIA(prompt);
    const json = extrairJSONSeguro(resposta);

    if (!json) {
      return res.status(500).json({ error: 'Erro correção' });
    }

    res.json(json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro redação' });
  }
});

// ======================
// PDF PROTEGIDO
// ======================
app.get('/pdf/:id', auth, async (req, res) => {
  try {
    const provaId = req.params.id;

    const result = await db.query(`
      SELECT * FROM provas
      WHERE id = $1 AND usuario_id = $2
    `, [provaId, req.user.id]);

    const prova = result.rows[0];

    if (!prova) {
      return res.status(404).send('Prova não encontrada');
    }

    const doc = new PDFDocument();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename=prova-${prova.id}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(22).text('Simulado ENEM', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Acertos: ${prova.acertos}`);
    doc.text(`Total: ${prova.total}`);
    doc.text(`Percentual: ${prova.percentual.toFixed(1)}%`);

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro PDF');
  }
});

// ======================
// START
// ======================
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
