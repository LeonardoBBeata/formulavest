require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const nodemailer = require('nodemailer');
const NodeCache = require('node-cache');
const cookieParser = require('cookie-parser');
const PDFDocument = require('pdfkit');
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
// EMAIL (GMAIL SMTP)
// ======================

const transporter =
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user:
        process.env.GMAIL_USER,
      pass:
        process.env.GMAIL_APP_PASSWORD
    }
  });

async function enviarEmail(
  para,
  assunto,
  texto,
  html = null
){
  await transporter.sendMail({
    from:
      `"FórmulaVest" <${process.env.GMAIL_USER}>`,
    to: para,
    subject: assunto,
    text: texto,
    html
  });
}

// ======================
// MIDDLEWARES
// ======================

app.use(cookieParser());
app.use(cors({
  origin: "*"
}));

app.use(express.json());
app.use(express.static("public"));

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
  ADD COLUMN IF NOT EXISTS banido BOOLEAN DEFAULT FALSE
`);
    
    await db.query(`
  CREATE TABLE IF NOT EXISTS provas_ativas(
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    questoes JSONB NOT NULL,
    finalizada BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP DEFAULT NOW()
  )
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

    await db.query(`
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS login_codigo TEXT
`);
    await db.query(`
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS reset_token TEXT
`);

await db.query(`
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS reset_expira TIMESTAMP
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
    console.log("Enviando para OpenRouter...");

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content:
              "Você é especialista em vestibulares brasileiros e deve responder SOMENTE em JSON válido."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://formulavest.onrender.com",
          "X-Title": "FormulaVest"
        },
        timeout: 120000
      }
    );

    const texto =
      response.data?.choices?.[0]?.message?.content;

    if (!texto) {
      throw new Error("IA retornou vazio");
    }

    console.log("Resposta recebida da IA.");

    return texto;

  } catch (err) {
    console.error(
      "ERRO IA:",
      err.response?.data || err.message
    );

    throw new Error("Erro IA");
  }
}

function extrairJSONSeguro(texto) {
  try {
    const match = texto.match(
      /\{[\s\S]*\}|\[[\s\S]*\]/
    );

    if (!match) return null;

    return JSON.parse(match[0]);

  } catch (err) {
    console.error(
      "Erro ao extrair JSON:",
      err
    );
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
await enviarEmail(
  email,
  "Código de verificação - FórmulaVest",
  `Seu código de verificação é: ${codigo}`
);

if (error) {
    console.error('ERRO RESEND:', error);
    throw new Error('Falha ao enviar email');
}

console.log('Email enviado:', data);

        



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
// MIDDLEWARE ADM
// ======================

function adminAuth(req, res, next) {
  const adminCookie =
    req.cookies.admin;

  if (
    adminCookie === "true"
  ) {
    return next();
  }

  return res
    .status(401)
    .json({
      error:
        "Não autorizado"
    });
}


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


app.post('/login-iniciar', async (req,res)=>{
  try{
    const { email, senha } = req.body;

    const result = await db.query(
      `SELECT * FROM usuarios
       WHERE email=$1`,
      [email]
    );

    const user = result.rows[0];

    if(!user){
      return res.status(404).json({
        error:'Email não encontrado'
      });
    }

    const ok =
      await bcrypt.compare(
        senha,
        user.senha
      );

    if(!ok){
      return res.status(401).json({
        error:'Senha incorreta'
      });
    }

    const codigo =
      Math.floor(
        100000+
        Math.random()*900000
      ).toString();

    await db.query(`
      UPDATE usuarios
      SET codigo_verificacao=$1
      WHERE id=$2
    `,[codigo,user.id]);

    await enviarEmail(
  email,
  "Código de login - FórmulaVest",
  `Seu código é: ${codigo}`
);

    res.json({ ok:true });

  }catch(err){
    console.log(err);
    res.status(500).json({
      error:'Erro login'
    });
  }
});

app.post('/login-confirmar', async (req, res) => {
  try {
    const {
      email,
      senha,
      codigo
    } = req.body;

    const result =
      await db.query(`
        SELECT *
        FROM usuarios
        WHERE email=$1
      `, [email]);

    const user =
      result.rows[0];

    if (!user) {
      return res.status(404).json({
        error:
          "Usuário não encontrado"
      });
    }

    if (user.banido) {
      return res.status(403).json({
        error:
          "Usuário banido"
      });
    }

    if (
      user.codigo_verificacao
      !== codigo
    ) {
      return res.status(400).json({
        error:
          "Código inválido"
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
          "Senha incorreta"
      });
    }

    const token =
      gerarToken(user);

    const isAdmin =
      email ===
      process.env.ADMIN_EMAIL;

    if (isAdmin) {
      res.cookie(
        "admin",
        "true",
        {
          httpOnly: true,
          sameSite: "lax"
        }
      );
    }

    res.json({
      ok: true,
      token,
      admin: isAdmin
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error:
        "Erro login"
    });
  }
});

app.post(
'/forgot-password',
async (req,res)=>{
  try{
    const { email } =
      req.body;

    const token =
      jwt.sign(
        { email },
        process.env.JWT_SECRET,
        {
          expiresIn:'1h'
        }
      );

    const link =
`https://formulavest.onrender.com/reset-password.html?token=${token}`;

    await enviarEmail(
  email,
  "Recuperar senha - FórmulaVest",
  `Acesse: ${link}`,
  `
    <h2>Recuperar senha</h2>
    <p>Clique abaixo:</p>
    <a href="${link}">
      Alterar senha
    </a>
  `
);

    res.json({
      message:
        'Link enviado'
    });

  }catch(err){
    console.log(err);

    res.status(500).json({
      error:'Erro'
    });
  }
});

app.post(
  "/reset-password",
  async (req, res) => {
    try {
      const {
        token,
        senha
      } = req.body;

      if (
        !senha ||
        senha.length < 8
      ) {
        return res
          .status(400)
          .json({
            error:
              "Senha muito curta"
          });
      }

      const decoded =
        jwt.verify(
          token,
          process.env.JWT_SECRET
        );

      const email =
        decoded.email;

      const hash =
        await bcrypt.hash(
          senha,
          10
        );

      await db.query(
        `
        UPDATE usuarios
        SET senha = $1
        WHERE email = $2
        `,
        [hash, email]
      );

      res.json({
        ok: true,
        message:
          "Senha alterada"
      });

    } catch (err) {
      console.error(err);

      res.status(400).json({
        error:
          "Token inválido ou expirado"
      });
    }
  }
);


// ======================
// ADMIN LOGIN DIRETO
// ======================
app.post(
  '/admin-login',
  (req, res) => {
    const {
      email,
      senha
    } = req.body;

    if (
      email ===
        process.env.ADMIN_EMAIL &&
      senha ===
        process.env.ADMIN_PASSWORD
    ) {
      res.cookie(
        'admin',
        'true',
        {
          httpOnly: true,
          sameSite: 'lax'
        }
      );

      return res.json({
        ok: true
      });
    }

    res.status(401).json({
      error:
        'Credenciais inválidas'
    });
  }
);

// ======================
// ADMIN CHECK
// ======================
app.get(
  '/admin-check',
  adminAuth,
  (_, res) => {
    res.json({
      ok: true
    });
  }
);

// ======================
// ADMIN LOGOUT
// ======================
app.post(
  '/logout',
  (req, res) => {
    res.clearCookie(
      'admin'
    );

    res.json({
      ok: true
    });
  }
);

// ======================
// ADMIN PROVAS
// ======================
app.get(
  '/admin/provas',
  adminAuth,
  async (_, res) => {
    try {
      const result =
        await db.query(`
          SELECT
            p.*,
            u.username
          FROM provas p
          JOIN usuarios u
          ON u.id =
          p.usuario_id
          ORDER BY
          p.id DESC
        `);

      res.json({
        provas:
          result.rows
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Erro provas'
      });
    }
  }
);

// ======================
// ADMIN USUÁRIOS
// ======================
app.get(
  '/admin/usuarios',
  adminAuth,
  async (_, res) => {
    try {
      const result =
        await db.query(`
          SELECT
            id,
            username,
            banido
          FROM usuarios
          ORDER BY id DESC
        `);

      res.json({
        usuarios:
          result.rows
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Erro usuários'
      });
    }
  }
);

// ======================
// ADMIN CRIAR USUÁRIO
// ======================
app.post(
  '/admin/criar-usuario',
  adminAuth,
  async (req, res) => {
    try {
      const {
        username,
        senha
      } = req.body;

      if (
        !username ||
        !senha
      ) {
        return res
          .status(400)
          .json({
            error:
              'Campos obrigatórios'
          });
      }

      const hash =
        await bcrypt.hash(
          senha,
          10
        );

      await db.query(`
        INSERT INTO usuarios(
          username,
          senha
        )
        VALUES($1,$2)
      `, [
        username,
        hash
      ]);

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Erro criar usuário'
      });
    }
  }
);

// ======================
// BANIR/DESBANIR
// ======================
app.put(
  '/admin/usuario/:id/banir',
  adminAuth,
  async (req, res) => {
    try {
      const id =
        req.params.id;

      await db.query(`
        UPDATE usuarios
        SET banido =
        NOT banido
        WHERE id=$1
      `, [id]);

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Erro banir'
      });
    }
  }
);

// ======================
// EXCLUIR USUÁRIO
// ======================
app.delete(
  '/admin/usuario/:id',
  adminAuth,
  async (req, res) => {
    try {
      const id =
        req.params.id;

      await db.query(`
        DELETE FROM usuarios
        WHERE id=$1
      `, [id]);

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Erro excluir'
      });
    }
  }
);

// ======================
// ADMIN STATS
// ======================
app.get(
  '/admin/stats',
  adminAuth,
  async (_, res) => {
    try {
      const result =
        await db.query(`
          SELECT
            u.username,
            p.acertos
          FROM provas p
          JOIN usuarios u
          ON u.id =
          p.usuario_id
        `);

      const provas =
        result.rows;

      const totalProvas =
        provas.length;

      let soma = 0;
      const ranking = {};

      provas.forEach(
        p => {
          soma +=
            p.acertos;

          ranking[
            p.username
          ] =
            (ranking[
              p.username
            ] || 0) +
            p.acertos;
        }
      );

      const media =
        totalProvas
          ? (
              soma /
              totalProvas
            ).toFixed(1)
          : 0;

      res.json({
        totalProvas,
        media,
        labels:
          Object.keys(
            ranking
          ),
        values:
          Object.values(
            ranking
          )
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Erro stats'
      });
    }
  }
);


// ======================
// GERAR PROVÃO PAULISTA
// ======================
app.post('/gerar-provao', auth, async (req, res) => {
  try {
    const resposta =
      await chamarIA(`
Crie uma prova com 10 questões baseada no estilo do Provão Paulista.

RETORNE SOMENTE JSON:

{
  "questoes":[
    {
      "enunciado":"",
      "opcoes":{
        "A":"",
        "B":"",
        "C":"",
        "D":"",
        "E":""
      },
      "correta":"A"
    }
  ]
}
`);

    const json =
      extrairJSONSeguro(
        resposta
      );

    if (!json?.questoes) {
      return res.status(500).json({
        error:
          "IA inválida"
      });
    }

    const result =
      await db.query(`
        INSERT INTO provas_ativas(
          usuario_id,
          questoes
        )
        VALUES($1,$2)
        RETURNING id
      `, [
        req.user.id,
        JSON.stringify(
          json.questoes
        )
      ]);

    const provaId =
      result.rows[0].id;

    res.json({
      prova_id:
        provaId,
      questoes:
        json.questoes
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error:
        "Erro gerar Provão"
    });
  }
});



// ======================
// GERAR PROVA
// ======================
app.post("/gerar-prova", auth, async (req, res) => {
  try {
    const { curso, faculdade, quantidade } = req.body;

    const qtd = Number(quantidade) || 10;

    console.log("GERANDO PROVA...");
    console.log(req.body);

    const prompt = `
Crie ${qtd} questões estilo ENEM para:

Curso: ${curso}
Faculdade: ${faculdade}

RETORNE SOMENTE JSON VÁLIDO:

{
  "questoes": [
    {
      "enunciado": "Pergunta aqui",
      "opcoes": {
        "A": "Texto",
        "B": "Texto",
        "C": "Texto",
        "D": "Texto",
        "E": "Texto"
      },
      "correta": "A"
    }
  ]
}
`;

    const resposta = await chamarIA(prompt);

    const json =
      extrairJSONSeguro(resposta);

    console.log("JSON EXTRAÍDO:");
    console.log(json);

    if (
      !json ||
      !json.questoes ||
      !Array.isArray(json.questoes)
    ) {
      return res.status(500).json({
        error:
          "IA retornou formato inválido"
      });
    }

    return res.json({
      questoes: json.questoes
    });

  } catch (err) {
    console.error(
      "ERRO GERAR PROVA:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao gerar prova"
    });
  }
});

// ======================
// GERAR ENEM (90 questões)
// ======================
app.post('/gerar-enem', auth, async (req, res) => {
  try {
    let questoes = [];
    let tentativas = 0;

    while (questoes.length < 10 && tentativas < 20) {
      tentativas++;

      try {
        const resposta = await chamarIA(`
Crie 10 questões inéditas estilo ENEM.

RETORNE SOMENTE JSON:
{
  "questoes":[
    {
      "enunciado":"",
      "opcoes":{
        "A":"",
        "B":"",
        "C":"",
        "D":"",
        "E":""
      },
      "correta":"A"
    }
  ]
}
`);

        const json =
          extrairJSONSeguro(
            resposta
          );

        if (json?.questoes) {
          questoes.push(
            ...json.questoes
          );
        }

      } catch (e) {
        console.log(
          "Tentativa falhou"
        );
      }
    }

    if (questoes.length === 0) {
      return res.status(500).json({
        error:
          "Falha ao gerar questões"
      });
    }

    const result =
      await db.query(`
        INSERT INTO provas_ativas(
          usuario_id,
          questoes
        )
        VALUES($1,$2)
        RETURNING id
      `, [
        req.user.id,
        JSON.stringify(
          questoes
        )
      ]);

    const provaId =
      result.rows[0].id;

    res.json({
      prova_id: provaId,
      questoes
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error:
        "Erro ENEM"
    });
  }
});

// ======================
// SALVAR PROVA
// ======================
app.post('/salvar-prova', auth, async (req, res) => {
  try {
    const {
      prova_id,
      questoes
    } = req.body;

    const ativo =
      await db.query(`
        SELECT *
        FROM provas_ativas
        WHERE id=$1
        AND usuario_id=$2
      `, [
        prova_id,
        req.user.id
      ]);

    const prova =
      ativo.rows[0];

    if (!prova) {
      return res.status(404).json({
        error:
          "Prova não encontrada"
      });
    }

    if (prova.finalizada) {
      return res.status(400).json({
        error:
          "Essa prova já foi enviada"
      });
    }

    let acertos = 0;

    questoes.forEach(q => {
      if (
        q.selecionada ===
        q.correta
      ) {
        acertos++;
      }
    });

    const percentual =
      (acertos /
        questoes.length) * 100;

    const xpGanho =
      Math.floor(
        percentual
      );

    await db.query(`
      UPDATE usuarios
      SET xp = xp + $1,
          nivel =
          FLOOR(
            (xp + $1)/100
          ) + 1
      WHERE id = $2
    `, [
      xpGanho,
      req.user.id
    ]);

    await db.query(`
      INSERT INTO provas(
        usuario_id,
        acertos,
        total,
        percentual,
        questoes
      )
      VALUES(
        $1,$2,$3,$4,$5
      )
    `, [
      req.user.id,
      acertos,
      questoes.length,
      percentual,
      JSON.stringify(
        questoes
      )
    ]);

    await db.query(`
      UPDATE provas_ativas
      SET finalizada=TRUE
      WHERE id=$1
    `, [
      prova_id
    ]);

    cache.del(
      `provas_${req.user.id}`
    );

    res.json({
      ok: true,
      acertos,
      percentual
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error:
        "Erro salvar prova"
    });
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
app.get(
  '/teste-email',
  async (_, res) => {
    try {

      await enviarEmail(
        "leonardo.beata@aluno.cps.sp.gov.br",
        "Teste FórmulaVest",
        "Se chegou, está funcionando."
      );

      res.send(
        "Email enviado 🚀"
      );

    } catch (err) {
      console.error(err);

      res.status(500).send(
        "Erro ao enviar"
      );
    }
  }
);
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
