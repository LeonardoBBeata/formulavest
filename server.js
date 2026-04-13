const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const JSON5 = require('json5');





dotenv.config();
const app = express();

// --------------------
// CORS com cookies
// --------------------
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'simulado123',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 2*60*60*1000 } // 2h
}));

// --------------------
// Banco SQLite
// --------------------
const db = new sqlite3.Database('./database.db');

db.serialize(()=>{
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        senha TEXT,
        banido INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS provas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        data TEXT,
        questoes TEXT,
        tempo INTEGER DEFAULT 0,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);
});

// --------------------
// Middleware
// --------------------
function adminAuth(req, res, next){
    if(!req.session.admin) return res.status(401).json({error:"Não autorizado"});
    next();
}

function userAuth(req, res, next){
    if(!req.session.user) return res.status(401).json({error:"Não autorizado"});
    next();
}

// --------------------
// Função auxiliar para extrair JSON malformado
// --------------------
function extrairJSONSeguro(texto){

    if(!texto) throw new Error("Texto vazio");

    const match = texto.match(/\{[\s\S]*\}|\[[\s\S]*\]/);

    if(!match) throw new Error("JSON não encontrado");

    let jsonStr = match[0];

    try{
        return JSON.parse(jsonStr);
    }catch{

        // limpeza automática
        jsonStr = jsonStr
        .replace(/,\s*}/g,'}')
        .replace(/,\s*]/g,']')
        .replace(/\n/g,' ')
        .replace(/\r/g,' ')
        .replace(/\t/g,' ');

        return JSON.parse(jsonStr);
    }

}
async function parseJSONComCorrecao(texto){

try{

return extrairJSONSeguro(texto);

}catch(err){

console.warn("JSON inválido → pedindo correção para IA");

const corrigir = await axios.post(
"https://router.huggingface.co/v1/chat/completions",
{
model:"deepseek-ai/DeepSeek-V3.2:fastest",
messages:[
{role:"system",content:"Você corrige JSON malformado"},
{role:"user",content:`Corrija este JSON e retorne apenas JSON válido:\n${texto}`}
]
},
{
headers:{
Authorization:`Bearer ${process.env.HUGGINGFACE_API_KEY}`,
"Content-Type":"application/json"
},
timeout:60000
}
);

const textoCorrigido = corrigir.data.choices?.[0]?.message?.content;

return extrairJSONSeguro(textoCorrigido);

}

}

async function gerarLoteQuestoes(quantidade){

const prompt = `
Crie ${quantidade} questões estilo ENEM.

Formato JSON obrigatório:

{
"questoes":[
{
"enunciado":"...",
"opcoes":{
"A":"...",
"B":"...",
"C":"...",
"D":"...",
"E":"..."
},
"correta":"A"
}
]
}

Retorne apenas JSON.
`;

const response = await axios.post(
"https://router.huggingface.co/v1/chat/completions",
{
model:"deepseek-ai/DeepSeek-V3.2:fastest",
messages:[
{role:"system",content:"Especialista em provas ENEM"},
{role:"user",content:prompt}
]
},
{
headers:{
Authorization:`Bearer ${process.env.HUGGINGFACE_API_KEY}`,
"Content-Type":"application/json"
},
timeout:60000
}
);

const texto = response.data.choices?.[0]?.message?.content;

if(!texto) throw new Error("Resposta vazia da IA");

const json = await parseJSONComCorrecao(texto);

return json.questoes;

}
// --------------------
// Rotas Usuário
// --------------------
app.post('/register', async (req,res)=>{
    const { username, senha } = req.body;
    if(!username || !senha) return res.status(400).json({ error:"Preencha todos os campos" });
    const hash = await bcrypt.hash(senha,10);
    db.run(`INSERT INTO usuarios(username,senha) VALUES(?,?)`, [username,hash], function(err){
        if(err) return res.status(400).json({ error:"Usuário já existe" });
        res.json({ ok:true });
    });
});

app.post('/login', async (req,res)=>{
    const { username, senha } = req.body;
    if(!username || !senha) return res.status(400).json({ error:"Preencha todos os campos" });

    db.get(`SELECT * FROM usuarios WHERE username=?`, [username], async (err,row)=>{
        if(err || !row) return res.status(401).json({ error:"Usuário ou senha inválidos" });
        if(row.banido === 1) return res.status(403).json({ error:"Usuário banido." });

        const ok = await bcrypt.compare(senha, row.senha);
        if(!ok) return res.status(401).json({ error:"Usuário ou senha inválidos" });

        req.session.user = { id: row.id, username: row.username };
        res.json({ ok:true });
    });
});

app.post('/logout',(req,res)=>{
    req.session.destroy();
    res.json({ ok:true });
});

// REDAÇÂO
app.post('/analise-desempenho', userAuth, async (req,res)=>{

const provas = req.body.provas;

const prompt = `
Analise desempenho de um aluno.

Dados:
${JSON.stringify(provas)}

Diga:
- pontos fortes
- pontos fracos
- recomendações

Formato:
{
"fortes":[],
"fracos":[],
"recomendacoes":[]
}
`;

const response = await axios.post(
"https://router.huggingface.co/v1/chat/completions",
{
model:"deepseek-ai/DeepSeek-V3.2:fastest",
messages:[
{role:"system",content:"Especialista em educação"},
{role:"user",content:prompt}
]
},
{
headers:{Authorization:`Bearer ${process.env.HUGGINGFACE_API_KEY}`}
}
);

const texto = response.data.choices?.[0]?.message?.content;

const json = extrairJSONSeguro(texto);

res.json(json);

});

// --------------------
// Gerar prova
// --------------------
app.post('/gerar-prova', userAuth, async (req, res) => {
    if (req.session.provaAtiva) 
        return res.status(400).json({ error: "Finalize a prova atual antes de gerar outra." });

    const { faculdade, curso, quantidade } = req.body;
    if (!faculdade || !curso || !quantidade) 
        return res.status(400).json({ error: "Dados incompletos" });

    const prompt = `
Crie um simulado ENEM com ${quantidade} questões
para o curso ${curso} na faculdade ${faculdade}.
Cada questão deve ter enunciado, 5 alternativas (A-E) e indicar a correta.
Retorne apenas JSON válido no formato:
{"questoes":[{"enunciado":"...","opcoes":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correta":"A"}]}
`;

    // Função robusta para tentar extrair e parsear JSON
    function extrairJSONSeguro(texto) {
        const match = texto.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (!match) throw new Error("JSON não encontrado");
        let jsonStr = match[0];

        // Remove vírgulas finais antes de } ou ]
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

        // Escapa aspas internas dentro das strings
        jsonStr = jsonStr.replace(/"([^"]*?)"/g, (m, p1) => `"${p1.replace(/"/g, '\\"')}"`);

        return JSON.parse(jsonStr);
    }

    try {
        // -------------------
        // Primeira chamada HF
        // -------------------
        const response = await axios.post(
            "https://router.huggingface.co/v1/chat/completions",
            {
                model: "deepseek-ai/DeepSeek-V3.2:fastest",
                messages: [
                    { role: "system", content: "Você é especialista em ENEM." },
                    { role: "user", content: prompt }
                ]
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 60000
            }
        );

        let texto = response.data.choices?.[0]?.message?.content;
        if (!texto) throw new Error("Resposta vazia da API Hugging Face Router");

        // -------------------
        // Tenta parsear JSON
        // -------------------
let questoes;

try{

questoes = extrairJSONSeguro(texto).questoes;

}catch(err){

console.warn("Primeira tentativa falhou → pedindo correção para IA");

const corrigir = await axios.post(
"https://router.huggingface.co/v1/chat/completions",
{
model:"deepseek-ai/DeepSeek-V3.2:fastest",
messages:[
{role:"system",content:"Especialista em corrigir JSON"},
{role:"user",content:`Corrija o JSON abaixo e retorne apenas JSON válido:\n${texto}`}
]
},
{
headers:{
Authorization:`Bearer ${process.env.HUGGINGFACE_API_KEY}`,
"Content-Type":"application/json"
},
timeout:60000
}
);

const textoCorrigido = corrigir.data.choices?.[0]?.message?.content;

questoes = extrairJSONSeguro(textoCorrigido).questoes;

}

        req.session.provaAtiva = true;
        res.json({ questoes });

    } catch (error) {
        console.error("Erro HF Router:", error.response?.data || error.message);
        res.status(500).json({ error: "Erro ao gerar prova" });
    }
});
// --------------------
// Salvar prova
// --------------------
app.post('/salvar-prova', userAuth, (req,res)=>{
    const { questoes, tempo } = req.body;
    req.session.provaAtiva = false;

    if(!Array.isArray(questoes) || questoes.length === 0) return res.status(400).json({ error: "Nenhuma questão enviada" });
    if(typeof tempo !== 'number' || isNaN(tempo)) return res.status(400).json({ error: "Tempo inválido" });

    const usuarioId = req.session.user.id;
    const dataAgora = new Date().toISOString();
    const questoesJSON = JSON.stringify(questoes);

    db.run(
        `INSERT INTO provas(usuario_id, data, questoes, tempo) VALUES(?,?,?,?)`,
        [usuarioId, dataAgora, questoesJSON, tempo],
        function(err){
            if(err){
                console.error("Erro ao salvar prova:", err);
                return res.status(500).json({ error:"Erro ao salvar prova no banco" });
            }
            res.json({ ok:true });
        }
    );
});

// --------------------
// Histórico do usuário
// --------------------
app.get('/provas', userAuth, (req,res)=>{
    db.all(`SELECT * FROM provas WHERE usuario_id=? ORDER BY data DESC`, [req.session.user.id], (err,rows)=>{
        if(err) return res.status(500).json({ error:"Erro ao buscar histórico" });
        const provas = rows.map(r=>({
            id: r.id,
            data: r.data,
            tempo: r.tempo || 0,
            // ✅ Trata caso questoes seja NULL ou vazio
            questoes: r.questoes ? JSON.parse(r.questoes) : []
        }));
        res.json({ provas });
    });
});

// --------------------
// Rotas Admin
// --------------------
app.post('/admin-login', (req, res)=>{
    const { email, senha } = req.body;
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@email.com";
    const ADMIN_SENHA = process.env.ADMIN_SENHA || "123456";

    if(email === ADMIN_EMAIL && senha === ADMIN_SENHA){
        req.session.admin = true;
        return res.json({ ok:true });
    }

    res.status(401).json({ ok:false, error:"Credenciais inválidas" });
});

app.get('/admin/usuarios', adminAuth, (req,res)=>{
    db.all(`SELECT id, username, banido FROM usuarios`, [], (err,rows)=>{
        if(err) return res.status(500).json({ error:"Erro ao buscar usuários" });
        res.json({ usuarios:rows });
    });
});

app.post('/admin/criar-usuario', adminAuth, async (req,res)=>{
    const { username, senha } = req.body;
    if(!username || !senha) return res.status(400).json({ error:"Preencha todos os campos" });

    try{
        const hash = await bcrypt.hash(senha,10);
        db.run(`INSERT INTO usuarios(username, senha) VALUES(?,?)`, [username, hash], function(err){
            if(err) return res.status(400).json({ error:"Usuário já existe" });
            res.json({ ok:true });
        });
    } catch(err){
        console.error(err);
        res.status(500).json({ error:"Erro ao criar usuário" });
    }
});

app.put('/admin/usuario/:id/banir', adminAuth, (req,res)=>{
    const id = req.params.id;
    db.run(`UPDATE usuarios SET banido = CASE WHEN banido=1 THEN 0 ELSE 1 END WHERE id=?`, [id], function(err){
        if(err) return res.status(500).json({ error:"Erro ao atualizar" });
        res.json({ ok:true });
    });
});

app.delete('/admin/usuario/:id', adminAuth, (req,res)=>{
    const id = req.params.id;
    db.run(`DELETE FROM usuarios WHERE id=?`, [id], function(err){
        if(err) return res.status(500).json({ error:"Erro ao excluir" });
        res.json({ ok:true });
    });
});

app.get('/admin/provas', adminAuth, (req,res)=>{
    db.all(`
        SELECT provas.*, usuarios.username
        FROM provas
        JOIN usuarios ON provas.usuario_id=usuarios.id
        ORDER BY data DESC
    `, [], (err,rows)=>{
        if(err) return res.status(500).json({ error:"Erro ao buscar provas" });

        const provas = rows.map(r=>({
            id: r.id,
            username: r.username,
            data: r.data,
            tempo: r.tempo || 0,
            questoes: r.questoes ? JSON5.parse(r.questoes) : []
        }));

        res.json({ provas });
    });
});

app.post('/gerar-enem', userAuth, async (req,res)=>{

const total = Number(req.body.quantidade) || 90;
const lote = 10;

let questoes = [];

try{

while(questoes.length < total){

console.log("Gerando lote...");

try{

const novas = await gerarLoteQuestoes(lote);

questoes = questoes.concat(novas);

}catch(err){

console.warn("Erro no lote:",err.message);

}

}

// limita ao total exato
questoes = questoes.slice(0,total);

req.session.provaAtiva = true;

res.json({questoes});

}catch(err){

console.error("Erro gerar ENEM:",err.message);

res.status(500).json({error:"Erro ao gerar simulado ENEM"});

}

});


app.post('/corrigir-redacao', userAuth, async (req,res)=>{

const { tema, texto } = req.body;

const prompt = `
Avalie uma redação estilo ENEM.

Tema: ${tema}

Redação:
${texto}

Dê:

nota de 0 a 1000
feedback detalhado
erros
melhorias

Retorne JSON:

{
"nota":800,
"feedback":"texto"
}
`;

try{

const response = await axios.post(
"https://router.huggingface.co/v1/chat/completions",
{
model:"deepseek-ai/DeepSeek-V3.2:fastest",
messages:[
{role:"system",content:"Especialista em correção de redação ENEM"},
{role:"user",content:prompt}
]
},
{
headers:{
Authorization:`Bearer ${process.env.HUGGINGFACE_API_KEY}`,
"Content-Type":"application/json"
}
}
);

const textoIA = response.data.choices?.[0]?.message?.content;

const json = extrairJSONSeguro(textoIA);

res.json(json);

}catch(err){

console.error("Erro corrigir redação:",err.message);

res.status(500).json({error:"Erro ao corrigir redação"});

}

});

// --------------------
// Servidor
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Servidor rodando em http://localhost:${PORT}`));
