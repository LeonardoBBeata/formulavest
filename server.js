
require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const SibApiV3Sdk = require('@getbrevo/brevo');
const NodeCache = require('node-cache');
const cookieParser = require('cookie-parser');
const PDFDocument = require('pdfkit');
const validator = require('validator');
const { Pool } = require('pg');

const fs = require("fs");

if (!fs.existsSync("public/uploads")) {
  fs.mkdirSync("public/uploads", { recursive: true });
}

const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = req.user.id + "-" + Date.now() + ext;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Apenas imagens são permitidas"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});

const app = express();

app.set("trust proxy", 1);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});


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
// EMAIL (BREVO)
// ======================

const brevo = new SibApiV3Sdk.TransactionalEmailsApi();

brevo.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

async function enviarEmail(
  para,
  assunto,
  texto,
  html = null
) {
  await brevo.sendTransacEmail({
    sender: {
      name: "FórmulaVest",
      email: process.env.EMAIL_FROM
    },
    to: [
      {
        email: para
      }
    ],
    subject: assunto,
    textContent: texto,
    htmlContent:
      html || `<p>${texto}</p>`
  });
}
// ======================
// MIDDLEWARES
// ======================

app.use(cookieParser());

app.use(cors({
  origin: [
    "https://formulavest.onrender.com",
    "http://localhost:5500"
  ],
  credentials: true
}));

app.use(express.json());

// 👇 COLOCA AQUI (IMPORTANTE)
app.use("/uploads", express.static("public/uploads"));
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
  ADD COLUMN IF NOT EXISTS foto TEXT
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
    await db.query(`
CREATE TABLE IF NOT EXISTS empresas(
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
)
`);
    await db.query(`
CREATE TABLE IF NOT EXISTS escolas(
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER
    REFERENCES empresas(id)
    ON DELETE CASCADE,
  nome TEXT NOT NULL
)
`);
    await db.query(`
CREATE TABLE IF NOT EXISTS periodos(
  id SERIAL PRIMARY KEY,
  escola_id INTEGER
    REFERENCES escolas(id)
    ON DELETE CASCADE,
  nome TEXT NOT NULL
)
`);
    await db.query(`
CREATE TABLE IF NOT EXISTS salas(
  id SERIAL PRIMARY KEY,
  periodo_id INTEGER
    REFERENCES periodos(id)
    ON DELETE CASCADE,
  nome TEXT NOT NULL
)
`);
    await db.query(`
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS empresa_id INTEGER
REFERENCES empresas(id)
`);
    await db.query(`
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS escola_id INTEGER
REFERENCES escolas(id)
`);
    await db.query(`
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS periodo_id INTEGER
REFERENCES periodos(id)
`);
    await db.query(`
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS sala_id INTEGER
REFERENCES salas(id)
`);
    await db.query(`
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS role TEXT
DEFAULT 'aluno'
`);

    

  console.log('Banco OK');
}
async function criarAdmMaster() {
  try {
    const email = "adm@formulavest.com";
    const senha =
  process.env.MASTER_PASSWORD;

    const existe = await db.query(`
      SELECT id
      FROM usuarios
      WHERE email = $1
    `, [email]);

    if (existe.rows.length > 0) {
      console.log("ADM master já existe");
      return;
    }

    // cria empresa principal
    const empresa = await db.query(`
      INSERT INTO empresas(nome)
      VALUES('FórmulaVest')
      RETURNING id
    `);

    const empresaId =
      empresa.rows[0].id;

    const hash =
      await bcrypt.hash(
        senha,
        10
      );

    await db.query(`
      INSERT INTO usuarios(
        username,
        email,
        senha,
        role,
        empresa_id,
        verificado
      )
      VALUES(
        $1,$2,$3,$4,$5,TRUE
      )
    `, [
      "ADM",
      email,
      hash,
      "formulavest_master",
      empresaId
    ]);

    console.log(
      "ADM MASTER CRIADO"
    );

  } catch (err) {
    console.error(
      "Erro ao criar ADM:",
      err
    );
  }
}



initDB()
  .then(() =>
    criarAdmMaster()
  )
  .catch(err => {
    console.error('Erro ao iniciar banco:', err);
    process.exit(1);
});
// ======================
// roles
// ======================

function mesmaEmpresa(req, usuarioEmpresaId) {
  return req.user.empresa_id === usuarioEmpresaId;
}



// ======================
// JWT
// ======================
function gerarToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      empresa_id: user.empresa_id,
      escola_id: user.escola_id,
      sala_id: user.sala_id
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

function permitir(...roles) {
  return (req, res, next) => {

    // master pode tudo
    if (
      req.user.role ===
      "formulavest_master"
    ) {
      return next();
    }

    if (
      !roles.includes(
        req.user.role
      )
    ) {
      return res
        .status(403)
        .json({
          error:
            "Sem permissão"
        });
    }

    next();
  };
}


function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({
      error: "Token ausente"
    });
  }

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Token inválido"
    });
  }

  const token = header.split(" ")[1];

  try {
    req.user = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    next();

  } catch {
    return res.status(401).json({
      error: "Token inválido"
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
  codigo_verificacao,
  verificado
)
VALUES ($1,$2,$3,$4,FALSE)
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

console.log("Email enviado com Brevo");

console.log('Email enviado:');

        



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


app.post(
  "/login-iniciar",
  loginLimiter,
  async (req, res) => {
    try {
      const { email, senha } = req.body;

      const emailNormalizado =
        email?.toLowerCase()?.trim();

      if (!emailNormalizado) {
        return res.status(400).json({
          error: "Email obrigatório"
        });
      }

      if (!senha) {
        return res.status(400).json({
          error: "Senha obrigatória"
        });
      }

      const result = await db.query(`
        SELECT *
        FROM usuarios
        WHERE email = $1
      `, [emailNormalizado]);

      const user = result.rows[0];

      if (!user) {
        return res.status(404).json({
          error: "Email não encontrado"
        });
      }

      if (!user.verificado) {
        return res.status(403).json({
          error: "Verifique seu email primeiro"
        });
      }

      if (user.banido) {
        return res.status(403).json({
          error: "Usuário banido"
        });
      }

      const senhaOk =
        await bcrypt.compare(
          senha,
          user.senha
        );

      if (!senhaOk) {
        return res.status(401).json({
          error: "Senha incorreta"
        });
      }

      if (
        user.email.toLowerCase() ===
        "adm@formulavest.com"
      ) {
        return res.json({
          ok: true,
          adminDirect: true
        });
      }

      const codigo = Math.floor(
        100000 +
        Math.random() * 900000
      ).toString();

      await db.query(`
        UPDATE usuarios
        SET codigo_verificacao=$1
        WHERE id=$2
      `, [
        codigo,
        user.id
      ]);

      await enviarEmail(
        user.email,
        "Código de login - FórmulaVest",
        `Seu código é: ${codigo}`
      );

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Erro login"
      });
    }
  }
);
app.post(
  "/login-confirmar",
  loginLimiter,
  async (req, res) => {
    try {
      const {
        email,
        senha,
        codigo
      } = req.body;

      const emailNormalizado =
        email?.toLowerCase()?.trim();

      if (!emailNormalizado) {
        return res.status(400).json({
          error: "Email obrigatório"
        });
      }

      const result = await db.query(`
        SELECT *
        FROM usuarios
        WHERE email = $1
      `, [emailNormalizado]);

      const user = result.rows[0];

      if (!user) {
        return res.status(404).json({
          error: "Usuário não encontrado"
        });
      }

      if (user.banido) {
        return res.status(403).json({
          error: "Usuário banido"
        });
      }

      const senhaOk =
        await bcrypt.compare(
          senha,
          user.senha
        );

      if (!senhaOk) {
        return res.status(401).json({
          error: "Senha incorreta"
        });
      }

      if (
        user.email.toLowerCase() !==
        "adm@formulavest.com"
      ) {
        if (
          user.codigo_verificacao !==
          codigo
        ) {
          return res.status(400).json({
            error: "Código inválido"
          });
        }

        await db.query(`
          UPDATE usuarios
          SET codigo_verificacao=NULL
          WHERE id=$1
        `, [user.id]);
      }

      const token =
        gerarToken(user);

      res.json({
        ok: true,
        token,
        role: user.role,
        empresa_id:
          user.empresa_id,
        escola_id:
          user.escola_id,
        sala_id:
          user.sala_id
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Erro login"
      });
    }
  }
);

app.post(
  "/forgot-password",
  async (req, res) => {
    try {
      const { email } = req.body;

      const result =
        await db.query(`
          SELECT id
          FROM usuarios
          WHERE email=$1
        `, [email]);

      if (
        result.rows.length === 0
      ) {
        return res.json({
          message:
            "Se o email existir, enviaremos um link."
        });
      }

      const token =
        crypto.randomUUID();

      await db.query(`
        UPDATE usuarios
        SET
          reset_token=$1,
          reset_expira=
            NOW() + INTERVAL '1 hour'
        WHERE email=$2
      `, [token, email]);

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
          "Se o email existir, enviaremos um link."
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Erro"
      });
    }
  }
);

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

      const result =
        await db.query(`
          SELECT *
          FROM usuarios
          WHERE reset_token=$1
          AND reset_expira > NOW()
        `, [token]);

      const user =
        result.rows[0];

      if (!user) {
        return res
          .status(400)
          .json({
            error:
              "Token inválido ou expirado"
          });
      }

      const hash =
        await bcrypt.hash(
          senha,
          10
        );

      await db.query(`
        UPDATE usuarios
        SET
          senha=$1,
          reset_token=NULL,
          reset_expira=NULL
        WHERE id=$2
      `, [
        hash,
        user.id
      ]);

      res.json({
        ok: true,
        message:
          "Senha alterada"
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Erro ao resetar senha"
      });
    }
  }
);



app.post("/add-xp", auth, async (req, res) => {
  try {
    const xp = Number(req.body.xp || 0);

    if (xp <= 0) {
      return res.status(400).json({ error: "XP inválido" });
    }

    const result = await db.query(`
      UPDATE usuarios
      SET 
        xp = xp + $1,
        nivel = FLOOR((xp + $1) / 100) + 1
      WHERE id = $2
      RETURNING xp, nivel
    `, [xp, req.user.id]);

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro XP" });
  }
});
// ======================
// ADMIN CHECK
// ======================
app.get(
  "/admin-check",
  auth,
  permitir(
    "formulavest_master",
    "empresa_admin",
    "diretor",
    "coordenador"
  ),
  (_, res) => {
    res.json({
      ok: true
    });
  }
);


// ======================
// ADMIN PROVAS
// ======================
app.get(
  "/admin/provas",
  auth,
  permitir(
    "formulavest_master",
    "empresa_admin",
    "diretor",
    "coordenador"
  ),
  async (req, res) => {
    try {
      let result;

      // MASTER vê tudo
      if (
        req.user.role ===
        "formulavest_master"
      ) {
        result =
          await db.query(`
            SELECT
              p.*,
              u.username
            FROM provas p
            JOIN usuarios u
            ON u.id = p.usuario_id
            ORDER BY p.id DESC
          `);

      // EMPRESA
      } else if (
        req.user.role ===
        "empresa_admin"
      ) {
        result =
          await db.query(`
            SELECT
              p.*,
              u.username
            FROM provas p
            JOIN usuarios u
            ON u.id = p.usuario_id
            WHERE
              u.empresa_id=$1
            ORDER BY p.id DESC
          `, [
            req.user.empresa_id
          ]);

      // ESCOLA
      } else {
        result =
          await db.query(`
            SELECT
              p.*,
              u.username
            FROM provas p
            JOIN usuarios u
            ON u.id = p.usuario_id
            WHERE
              u.escola_id=$1
            ORDER BY p.id DESC
          `, [
            req.user.escola_id
          ]);
      }

      res.json({
        provas:
          result.rows
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Erro provas"
      });
    }
  }
);



//empresas


//periodos
app.post(
  "/admin/criar-periodo",
  auth,
  permitir(
    "empresa_admin",
    "diretor"
  ),
  async (req, res) => {
    try {
      const {
        escola_id,
        nome
      } = req.body;

      let escola;

      // diretor só pode usar a própria escola
      if (
        req.user.role ===
        "diretor"
      ) {
        escola =
          await db.query(`
            SELECT *
            FROM escolas
            WHERE id=$1
            AND id=$2
          `, [
            escola_id,
            req.user.escola_id
          ]);

      } else {
        escola =
          await db.query(`
            SELECT *
            FROM escolas
            WHERE id=$1
            AND empresa_id=$2
          `, [
            escola_id,
            req.user.empresa_id
          ]);
      }

      if (
        escola.rows.length === 0
      ) {
        return res
          .status(403)
          .json({
            error:
              "Sem permissão"
          });
      }

      await db.query(`
        INSERT INTO periodos(
          escola_id,
          nome
        )
        VALUES($1,$2)
      `, [
        escola_id,
        nome
      ]);

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Erro criar período"
      });
    }
  }
);


//listar periodos
app.get(
  "/admin/periodos/:escolaId",
  auth,
  permitir(
    "formulavest_master",
    "empresa_admin",
    "diretor",
    "coordenador"
  ),
  async (req, res) => {
    try {
      const escolaId =
        req.params.escolaId;

      const escola =
        await db.query(`
          SELECT *
          FROM escolas
          WHERE id=$1
        `, [escolaId]);

      if (
        escola.rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            error:
              "Escola não encontrada"
          });
      }

      const esc =
        escola.rows[0];

      if (
        req.user.role !==
          "formulavest_master" &&
        esc.empresa_id !==
          req.user.empresa_id
      ) {
        return res
          .status(403)
          .json({
            error:
              "Sem permissão"
          });
      }

      const result =
        await db.query(`
          SELECT *
          FROM periodos
          WHERE escola_id=$1
          ORDER BY id DESC
        `, [escolaId]);

      res.json({
        periodos:
          result.rows
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Erro listar períodos"
      });
    }
  }
);

//escolas
app.post(
  "/admin/criar-escola",
  auth,
  permitir(
    "empresa_admin"
  ),
  async (req, res) => {
    try {
      const {
        nome
      } = req.body;

      await db.query(`
        INSERT INTO escolas(
          empresa_id,
          nome
        )
        VALUES($1,$2)
      `, [
        req.user.empresa_id,
        nome
      ]);

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Erro criar escola"
      });
    }
  }
);


//salas
app.post(
  "/admin/criar-sala",
  auth,
  permitir(
    "diretor",
    "coordenador"
  ),
  async (req, res) => {
    try {
      const {
        nome,
        periodo_id
      } = req.body;

      const periodo =
        await db.query(`
          SELECT
            p.*,
            e.empresa_id
          FROM periodos p
          JOIN escolas e
          ON e.id = p.escola_id
          WHERE p.id=$1
        `, [
          periodo_id
        ]);

      if (
        periodo.rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            error:
              "Período inválido"
          });
      }

      const p =
        periodo.rows[0];

      if (
        p.empresa_id !==
        req.user.empresa_id
      ) {
        return res
          .status(403)
          .json({
            error:
              "Sem permissão"
          });
      }

      await db.query(`
        INSERT INTO salas(
          periodo_id,
          nome
        )
        VALUES($1,$2)
      `, [
        periodo_id,
        nome
      ]);

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Erro criar sala"
      });
    }
  }
);
// ======================
// ADMIN USUÁRIOS
// ======================
app.get(
  "/admin/usuarios",
  auth,
  permitir(
    "formulavest_master",
    "empresa_admin",
    "diretor",
    "coordenador"
  ),
  async (req, res) => {
    try {
      let result;

      // MASTER vê tudo
      if (
        req.user.role ===
        "formulavest_master"
      ) {
        result =
          await db.query(`
            SELECT *
            FROM usuarios
            ORDER BY id DESC
          `);

      // ADMIN DA EMPRESA
      } else if (
        req.user.role ===
        "empresa_admin"
      ) {
        result =
          await db.query(`
            SELECT *
            FROM usuarios
            WHERE empresa_id=$1
            ORDER BY id DESC
          `, [
            req.user.empresa_id
          ]);

      // DIRETOR
      } else if (
        req.user.role ===
        "diretor"
      ) {
        result =
          await db.query(`
            SELECT *
            FROM usuarios
            WHERE escola_id=$1
            ORDER BY id DESC
          `, [
            req.user.escola_id
          ]);

      // COORDENADOR
      } else {
        result =
          await db.query(`
            SELECT *
            FROM usuarios
            WHERE escola_id=$1
            AND role IN (
              'professor',
              'aluno'
            )
            ORDER BY id DESC
          `, [
            req.user.escola_id
          ]);
      }

      res.json({
        usuarios:
          result.rows
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Erro listar usuários"
      });
    }
  }
);
// ======================
// ADMIN CRIAR USUÁRIO
// ======================
app.post("/admin/criar-usuario", auth, permitir(
  "formulavest_master",
  "empresa_admin",
  "diretor",
  "coordenador"
), async (req, res) => {
  try {
    const {
      username,
      email,
      senha,
      role,
      escola_id,
      sala_id
    } = req.body;

    if (!username || username.length < 3) {
      return res.status(400).json({ error: "Username inválido" });
    }

    const emailNorm = email?.toLowerCase().trim();

    const existe = await db.query(`
      SELECT id FROM usuarios
      WHERE email=$1 OR username=$2
    `, [emailNorm, username]);

    if (existe.rows.length > 0) {
      return res.status(400).json({ error: "Usuário já existe" });
    }

    const hash = await bcrypt.hash(senha, 10);

    let empresaId = req.user.empresa_id;
    let escolaId = escola_id;

    if (req.user.role === "formulavest_master") {
      empresaId = req.body.empresa_id;
    }

    if (req.user.role === "diretor") {
      escolaId = req.user.escola_id;
    }

    if (req.user.role === "coordenador") {
      if (!["aluno", "professor"].includes(role)) {
        return res.status(403).json({ error: "Sem permissão" });
      }
      escolaId = req.user.escola_id;
    }

    await db.query(`
      INSERT INTO usuarios(
        username,
        email,
        senha,
        role,
        empresa_id,
        escola_id,
        sala_id,
        verificado
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
    `, [
      username,
      emailNorm,
      hash,
      role,
      empresaId,
      escolaId,
      sala_id
    ]);

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro criar usuário" });
  }
});
// ======================
// BANIR/DESBANIR
// ======================
app.put("/admin/usuario/:id/banir", auth, permitir(
  "empresa_admin",
  "diretor",
  "coordenador"
), async (req, res) => {
  try {
    const id = req.params.id;

    const result = await db.query(`
      SELECT * FROM usuarios WHERE id=$1
    `, [id]);

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    if (user.role === "formulavest_master") {
      return res.status(403).json({ error: "Não pode alterar master" });
    }

    if (user.empresa_id !== req.user.empresa_id) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    const nivel = {
      empresa_admin: 4,
      diretor: 3,
      coordenador: 2,
      professor: 1,
      aluno: 0
    };

    if (nivel[user.role] >= nivel[req.user.role]) {
      return res.status(403).json({
        error: "Hierarquia insuficiente"
      });
    }

    await db.query(`
      UPDATE usuarios
      SET banido = NOT banido
      WHERE id = $1
    `, [id]);

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro banir usuário" });
  }
});

// ======================
// EXCLUIR USUÁRIO
// ======================
app.delete(
  "/admin/usuario/:id",
  auth,
  permitir(
    "empresa_admin",
    "diretor"
  ),
  async (req, res) => {
    try {
      const id =
        req.params.id;

      const alvo =
        await db.query(`
          SELECT *
          FROM usuarios
          WHERE id=$1
        `, [id]);

      const user =
        alvo.rows[0];

      if (!user) {
        return res
          .status(404)
          .json({
            error:
              "Usuário não encontrado"
          });
      }

      if (
        user.empresa_id !==
        req.user.empresa_id
      ) {
        return res
          .status(403)
          .json({
            error:
              "Sem permissão"
          });
      }

      const nivel = {
        formulavest_master: 5,
        empresa_admin: 4,
        diretor: 3,
        coordenador: 2,
        professor: 1,
        aluno: 0
      };

      if (
        nivel[user.role] >=
        nivel[req.user.role]
      ) {
        return res
          .status(403)
          .json({
            error:
              "Você não pode excluir esse usuário"
          });
      }

      await db.query(`
        DELETE
        FROM usuarios
        WHERE id=$1
      `, [id]);

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Erro excluir"
      });
    }
  }
);



//=======================
// ROLES
//=======================
app.get("/me", auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, username, email, foto, role, xp, nivel
      FROM usuarios
      WHERE id = $1
    `, [req.user.id]);

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      foto: user.foto || "/default.png",
      role: user.role,
      xp: user.xp,
      nivel: user.nivel
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro /me" });
  }
});

      // fallback de foto padrão
if (!user.foto) {
  user.foto = "/default.png";
}

      return res.json({
        id: user.id,
        nome: user.username, // já pronto pro frontend
        username: user.username,
        email: user.email,
        foto: user.foto,
        role: user.role,
        empresa_id: user.empresa_id,
        escola_id: user.escola_id,
        sala_id: user.sala_id,
        xp: user.xp || 0,
        nivel: user.nivel || 1
      });

     catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao buscar usuário" });
    }
  }
);


app.post("/upload-foto", auth, upload.single("foto"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma imagem enviada" });
    }

    const fotoUrl = `/uploads/${req.file.filename}`;

    await db.query(`
      UPDATE usuarios
      SET foto = $1
      WHERE id = $2
    `, [fotoUrl, req.user.id]);

    return res.json({
      ok: true,
      foto: fotoUrl
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro upload foto" });
  }
});

app.put("/atualizar-perfil", auth, async (req, res) => {
  try {
    const { nome, email, senha, foto } = req.body;

    const userResult = await db.query(`
      SELECT * FROM usuarios WHERE id = $1
    `, [req.user.id]);

    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    let novoNome = nome || user.username;
    let novoEmail = email || user.email;
    let novaFoto = foto || user.foto;

    let novaSenha = user.senha;

    if (senha && senha.length >= 8) {
      novaSenha = await bcrypt.hash(senha, 10);
    }

    await db.query(`
      UPDATE usuarios
      SET
        username = $1,
        email = $2,
        senha = $3,
        foto = $4
      WHERE id = $5
    `, [
      novoNome,
      novoEmail,
      novaSenha,
      novaFoto,
      req.user.id
    ]);

    res.json({
      ok: true,
      nome: novoNome,
      email: novoEmail,
      foto: novaFoto
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar perfil" });
  }
});
// ======================
// ADMIN STATS
// ======================
app.get(
  "/admin/stats",
  auth,
  permitir(
    "formulavest_master",
    "empresa_admin",
    "diretor",
    "coordenador"
  ),
  async (req, res) => {
    try {
      let result;

      // MASTER vê tudo
      if (
        req.user.role ===
        "formulavest_master"
      ) {
        result =
          await db.query(`
            SELECT
              u.username,
              p.acertos
            FROM provas p
            JOIN usuarios u
            ON u.id = p.usuario_id
          `);

      // EMPRESA
      } else if (
        req.user.role ===
        "empresa_admin"
      ) {
        result =
          await db.query(`
            SELECT
              u.username,
              p.acertos
            FROM provas p
            JOIN usuarios u
            ON u.id = p.usuario_id
            WHERE
              u.empresa_id=$1
          `, [
            req.user.empresa_id
          ]);

      // ESCOLA
      } else {
        result =
          await db.query(`
            SELECT
              u.username,
              p.acertos
            FROM provas p
            JOIN usuarios u
            ON u.id = p.usuario_id
            WHERE
              u.escola_id=$1
          `, [
            req.user.escola_id
          ]);
      }

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
            ] || 0)
            + p.acertos;
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
          "Erro stats"
      });
    }
  }
);

// ======================
// MASTER STATS
// ======================

app.get(
  "/master/stats",
  auth,
  permitir(
    "formulavest_master"
  ),
  async (_, res) => {
    try {

      const empresas =
        await db.query(`
          SELECT COUNT(*)
          FROM empresas
        `);

      const usuarios =
        await db.query(`
          SELECT COUNT(*)
          FROM usuarios
        `);

      const provas =
        await db.query(`
          SELECT COUNT(*)
          FROM provas
        `);

      res.json({
        totalEmpresas:
          Number(
            empresas
              .rows[0]
              .count
          ),

        totalUsuarios:
          Number(
            usuarios
              .rows[0]
              .count
          ),

        totalProvas:
          Number(
            provas
              .rows[0]
              .count
          )
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Erro stats"
      });
    }
  }
);



// ======================
// LISTAR EMPRESAS/escolas
// ======================

app.get(
  "/admin/escolas",
  auth,
  permitir(
    "formulavest_master",
    "empresa_admin",
    "diretor"
  ),
  async (req, res) => {
    try {
      let result;

      // MASTER vê todas
      if (
        req.user.role ===
        "formulavest_master"
      ) {
        result =
          await db.query(`
            SELECT *
            FROM escolas
            ORDER BY id DESC
          `);

      // empresa/diretor só da empresa
      } else {
        result =
          await db.query(`
            SELECT *
            FROM escolas
            WHERE empresa_id=$1
            ORDER BY id DESC
          `, [
            req.user.empresa_id
          ]);
      }

      res.json({
        escolas:
          result.rows
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Erro listar escolas"
      });
    }
  }
);

app.get(
  "/master/empresas",
  auth,
  permitir(
    "formulavest_master"
  ),
  async (_, res) => {
    try {

      const result =
        await db.query(`
          SELECT *
          FROM empresas
          ORDER BY id DESC
        `);

      res.json({
        empresas:
          result.rows
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Erro empresas"
      });
    }
  }
);



// ======================
// CRIAR EMPRESA
// ======================

app.post(
  "/master/criar-empresa",
  auth,
  permitir(
    "formulavest_master"
  ),
  async (req, res) => {
    try {

      const {
        nome
      } = req.body;

      await db.query(`
        INSERT INTO empresas(
          nome
        )
        VALUES($1)
      `, [
        nome
      ]);

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Erro criar empresa"
      });
    }
  }
);



// ======================
// EXCLUIR EMPRESA
// ======================

app.delete(
  "/master/empresa/:id",
  auth,
  permitir(
    "formulavest_master"
  ),
  async (req, res) => {
    try {

      const id =
        req.params.id;

      await db.query(`
        DELETE
        FROM empresas
        WHERE id=$1
      `, [
        id
      ]);

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Erro excluir empresa"
      });
    }
  }
);



// ======================
// CRIAR EMPRESA ADMIN
// ======================

app.post(
  "/master/criar-admin",
  auth,
  permitir(
    "formulavest_master"
  ),
  async (req, res) => {
    try {
      const {
        username,
        email,
        senha,
        empresa_id
      } = req.body;

      // validações básicas
      if (!username || username.length < 3) {
        return res.status(400).json({
          error: "Username inválido"
        });
      }

      if (!email) {
        return res.status(400).json({
          error: "Email obrigatório"
        });
      }

      if (!senha || senha.length < 8) {
        return res.status(400).json({
          error: "Senha muito curta"
        });
      }

      // verificar duplicado
      const existe = await db.query(`
        SELECT id
        FROM usuarios
        WHERE email=$1
           OR username=$2
      `, [
        email.toLowerCase().trim(),
        username
      ]);

      if (existe.rows.length > 0) {
        return res.status(400).json({
          error: "Usuário já existe"
        });
      }

      // gerar hash só depois
      const hash =
        await bcrypt.hash(
          senha,
          10
        );

      // inserir admin
      await db.query(`
        INSERT INTO usuarios(
          username,
          email,
          senha,
          role,
          empresa_id,
          verificado
        )
        VALUES(
          $1,$2,$3,
          'empresa_admin',
          $4,
          TRUE
        )
      `, [
        username,
        email.toLowerCase().trim(),
        hash,
        empresa_id
      ]);

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Erro criar admin"
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

    while (questoes.length < 10 && tentativas < 5) {
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
app.post("/salvar-prova", auth, async (req, res) => {
  try {
    const { prova_id, questoes } = req.body;

    const ativo = await db.query(`
      SELECT *
      FROM provas_ativas
      WHERE id=$1 AND usuario_id=$2
    `, [prova_id, req.user.id]);

    const prova = ativo.rows[0];

    if (!prova) {
      return res.status(404).json({ error: "Prova não encontrada" });
    }

    if (prova.finalizada) {
      return res.status(400).json({ error: "Prova já finalizada" });
    }

    const gabarito = prova.questoes;

    let acertos = 0;

    questoes.forEach((q, i) => {
      if (q.selecionada === gabarito[i].correta) {
        acertos++;
      }
    });

    const percentual = (acertos / questoes.length) * 100;
    const xpGanho = Math.floor(percentual);

    // XP + nível (1 query só)
    await db.query(`
      UPDATE usuarios
      SET 
        xp = xp + $1,
        nivel = FLOOR((xp + $1) / 100) + 1
      WHERE id = $2
    `, [xpGanho, req.user.id]);

    await db.query(`
      INSERT INTO provas(
        usuario_id,
        acertos,
        total,
        percentual,
        questoes
      )
      VALUES ($1,$2,$3,$4,$5)
    `, [
      req.user.id,
      acertos,
      questoes.length,
      percentual,
      JSON.stringify(questoes)
    ]);

    await db.query(`
      UPDATE provas_ativas
      SET finalizada = TRUE
      WHERE id = $1
    `, [prova_id]);

    cache.del(`provas_${req.user.id}`);

    res.json({
      ok: true,
      acertos,
      percentual
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro salvar prova" });
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
  "/teste-email",
  auth,
  permitir(
    "formulavest_master"
  ),
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




app.get("/dashboard", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await db.query(`
      SELECT xp, nivel
      FROM usuarios
      WHERE id = $1
    `, [userId]);

    const provas = await db.query(`
      SELECT acertos, total, percentual, criado_em
      FROM provas
      WHERE usuario_id = $1
      ORDER BY id ASC
    `, [userId]);

    res.json({
      user: user.rows[0],
      provas: provas.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro dashboard" });
  }
});



app.get("/grafico", auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT questoes
      FROM provas
      WHERE usuario_id = $1
    `, [req.user.id]);

    const materias = {
      matematica: 0,
      portugues: 0,
      ciencias: 0,
      humanas: 0
    };

    result.rows.forEach(p => {
      const q = p.questoes;

      q.forEach(item => {
        const materia = item.materia || "geral";

        if (!materias[materia]) {
          materias[materia] = 0;
        }

        if (item.correta === item.selecionada) {
          materias[materia]++;
        }
      });
    });

    res.json(materias);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro gráfico" });
  }
});
// ======================
// RANKING
// ======================
app.get("/ranking", auth, async (req, res) => {
  try {
    let query = `
      SELECT username, xp, nivel, foto
      FROM usuarios
    `;

    const params = [];
    const conditions = [];

    if (req.user.role !== "formulavest_master") {
      conditions.push(`empresa_id = $${params.length + 1}`);
      params.push(req.user.empresa_id);
    }

    if (req.user.escola_id) {
      conditions.push(`escola_id = $${params.length + 1}`);
      params.push(req.user.escola_id);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY xp DESC LIMIT 50";

    const result = await db.query(query, params);

    res.json(result.rows); // 🔥 IMPORTANTE: array puro

  } catch (err) {
    console.error("Ranking erro:", err);
    res.status(500).json({ error: "Erro ranking" });
  }
});
// ======================
// CORRIGIR REDAÇÃO
// ======================
app.post('/corrigir-redacao', auth, async (req, res) => {
  try {
    const { tema, texto } = req.body;

const prompt = `
Corrija esta redação ENEM seguindo as 5 competências:

Competência 1: norma padrão
Competência 2: compreensão do tema
Competência 3: argumentação
Competência 4: coesão
Competência 5: proposta de intervenção

Tema: ${tema}
Texto: ${texto}

RETORNE JSON:
{
 "competencia1":0-200,
 "competencia2":0-200,
 "competencia3":0-200,
 "competencia4":0-200,
 "competencia5":0-200,
 "nota_total":0-1000,
 "feedback":""
}
`;;

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
app.get("/pdf-enem/:id", auth, async (req, res) => {
  const provaId = req.params.id;

  const result = await db.query(`
    SELECT * FROM provas
    WHERE id = $1 AND usuario_id = $2
  `, [provaId, req.user.id]);

  const prova = result.rows[0];

  if (!prova) {
    return res.status(404).send("Prova não encontrada");
  }

  const doc = new PDFDocument({ margin: 30 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename=enem-${prova.id}.pdf`
  );

  doc.pipe(res);

  doc.fontSize(20).text("FórmulaVest - Simulado ENEM", { align: "center" });
  doc.moveDown();

  doc.fontSize(12).text(`Acertos: ${prova.acertos}/${prova.total}`);
  doc.text(`Percentual: ${prova.percentual.toFixed(1)}%`);
  doc.moveDown();

  prova.questoes.forEach((q, i) => {
    doc.fontSize(14).text(`Questão ${i + 1}`);
    doc.fontSize(12).text(q.enunciado);
    doc.moveDown(0.5);

    Object.entries(q.opcoes).forEach(([k, v]) => {
      doc.text(`${k}) ${v}`);
    });

    doc.moveDown(0.5);
    doc.text(`Sua resposta: ${q.selecionada || "Não respondida"}`);
    doc.text(`Correta: ${q.correta}`);

    doc.moveDown();

    doc.text("━━━━━━━━━━━━━━━━━━━━━━");
    doc.moveDown();
  });

  doc.end();
});

// ======================
// START
// ======================
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
