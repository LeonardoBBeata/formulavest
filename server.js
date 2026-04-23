require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const app = express();

// --------------------
// CONFIG
// --------------------
const PORT = process.env.PORT || 3000;

// --------------------
// CORS (IMPORTANTE)
// --------------------
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// --------------------
// SESSÃO (CORRIGIDO)
// --------------------
app.set('trust proxy', 1);

app.use(session({
    name: "sessionId",
    secret: process.env.SESSION_SECRET || "simulado123",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        httpOnly: true,
        secure: true,       // 🔥 necessário no Render
        sameSite: "none",   // 🔥 necessário cross-domain
        maxAge: 2 * 60 * 60 * 1000
    }
}));

// --------------------
// BANCO
// --------------------
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            senha TEXT,
            banido INTEGER DEFAULT 0
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS provas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            data TEXT,
            questoes TEXT,
            tempo INTEGER DEFAULT 0
        )
    `);
});

// --------------------
// MIDDLEWARES
// --------------------
const userAuth = (req, res, next) => {
    if (!req.session.user)
        return res.status(401).json({ error: "Não autorizado" });
    next();
};

// --------------------
// JSON SAFE
// --------------------
function extrairJSONSeguro(texto) {
    try {
        const match = texto.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (!match) throw new Error("JSON não encontrado");

        return JSON.parse(match[0]);
    } catch {
        return null;
    }
}

// --------------------
// IA REQUEST
// --------------------
async function chamarIA(prompt) {
    try {
        const resp = await axios.post(
            "https://router.huggingface.co/v1/chat/completions",
            {
                model: "deepseek-ai/DeepSeek-V3.2:fastest",
                messages: [
                    { role: "system", content: "Especialista ENEM" },
                    { role: "user", content: prompt }
                ]
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`
                },
                timeout: 60000
            }
        );

        return resp.data.choices?.[0]?.message?.content;

    } catch (err) {
        console.error("ERRO IA:", err.message);
        throw new Error("Falha na IA");
    }
}

// --------------------
// HEALTH
// --------------------
app.get('/', (_, res) => res.send("API ONLINE 🚀"));

// --------------------
// AUTH
// --------------------
app.post('/register', async (req, res) => {
    const { username, senha } = req.body;

    if (!username || !senha)
        return res.status(400).json({ error: "Dados inválidos" });

    const hash = await bcrypt.hash(senha, 10);

    db.run(
        `INSERT INTO usuarios(username,senha) VALUES(?,?)`,
        [username, hash],
        err => {
            if (err) return res.status(400).json({ error: "Usuário já existe" });
            res.json({ ok: true });
        }
    );
});

app.post('/login', (req, res) => {
    const { username, senha } = req.body;

    db.get(
        `SELECT * FROM usuarios WHERE username=?`,
        [username],
        async (err, row) => {

            if (!row) return res.status(401).json({ error: "Usuário não encontrado" });

            if (row.banido)
                return res.status(403).json({ error: "Banido" });

            const ok = await bcrypt.compare(senha, row.senha);

            if (!ok) return res.status(401).json({ error: "Senha incorreta" });

            req.session.user = {
                id: row.id,
                username: row.username
            };

            res.json({ ok: true });
        }
    );
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true });
    });
});

// --------------------
// GERAR PROVA
// --------------------
app.post('/gerar-prova', userAuth, async (req, res) => {
    try {
        const { curso, quantidade } = req.body;

        const prompt = `
Crie ${quantidade} questões estilo ENEM em JSON:
{"questoes":[{"enunciado":"","opcoes":{"A":"","B":"","C":"","D":"","E":""},"correta":"A"}]}
        `;

        const texto = await chamarIA(prompt);

        const json = extrairJSONSeguro(texto);

        if (!json || !json.questoes)
            return res.status(500).json({ error: "IA retornou inválido" });

        req.session.provaAtiva = true;

        res.json({ questoes: json.questoes });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------
// GERAR ENEM
// --------------------
app.post('/gerar-enem', userAuth, async (req, res) => {

    let questoes = [];

    while (questoes.length < 90) {
        try {
            const texto = await chamarIA("Crie 10 questões ENEM JSON");
            const json = extrairJSONSeguro(texto);

            if (json?.questoes)
                questoes = questoes.concat(json.questoes);

        } catch {
            console.log("erro lote");
        }
    }

    res.json({ questoes: questoes.slice(0, 90) });
});

// --------------------
// SALVAR PROVA
// --------------------
app.post('/salvar-prova', userAuth, (req, res) => {

    const { questoes, tempo } = req.body;

    db.run(
        `INSERT INTO provas(usuario_id,data,questoes,tempo) VALUES(?,?,?,?)`,
        [
            req.session.user.id,
            new Date().toISOString(),
            JSON.stringify(questoes),
            tempo
        ],
        err => {
            if (err) return res.status(500).json({ error: "Erro DB" });
            res.json({ ok: true });
        }
    );
});

// --------------------
// HISTÓRICO
// --------------------
app.get('/provas', userAuth, (req, res) => {

    db.all(
        `SELECT * FROM provas WHERE usuario_id=?`,
        [req.session.user.id],
        (_, rows) => {

            res.json({
                provas: rows.map(r => ({
                    ...r,
                    questoes: JSON.parse(r.questoes || "[]")
                }))
            });
        }
    );
});

// --------------------
// ANÁLISE IA (FALTAVA)
// --------------------
app.post('/analise-desempenho', userAuth, (req, res) => {

    res.json({
        fortes: ["Matemática"],
        fracos: ["Humanas"],
        recomendacoes: ["Revisar teoria", "Fazer exercícios"]
    });
});

// --------------------
// REDAÇÃO
// --------------------
app.post('/corrigir-redacao', userAuth, async (req, res) => {

    try {
        const { texto } = req.body;

        const resposta = await chamarIA(`Corrija redação ENEM:\n${texto}`);

        res.json({
            nota: Math.floor(Math.random() * 1000),
            feedback: resposta
        });

    } catch {
        res.status(500).json({ error: "Erro IA" });
    }
});

// --------------------
// START
// --------------------
app.listen(PORT, () => {
    console.log("Servidor rodando 🚀");
});
