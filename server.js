require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const JSON5 = require('json5');

const app = express();

// --------------------
// CORS
// --------------------
app.use(cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// --------------------
// Sessão (Render FIX)
// --------------------
app.set('trust proxy', 1);

app.use(session({
    secret: process.env.SESSION_SECRET || 'simulado123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 2 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? "none" : "lax"
    }
}));

// --------------------
// Banco
// --------------------
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
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
const adminAuth = (req,res,next)=>{
    if(!req.session.admin) return res.status(401).json({error:"Não autorizado"});
    next();
};

const userAuth = (req,res,next)=>{
    if(!req.session.user) return res.status(401).json({error:"Não autorizado"});
    next();
};

// --------------------
// JSON ROBUSTO
// --------------------
function extrairJSONSeguro(texto){
    if(!texto) throw new Error("Texto vazio");

    const match = texto.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if(!match) throw new Error("JSON não encontrado");

    let jsonStr = match[0];

    try{
        return JSON.parse(jsonStr);
    }catch{
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
    }catch{

        const resp = await axios.post(
            "https://router.huggingface.co/v1/chat/completions",
            {
                model:"deepseek-ai/DeepSeek-V3.2:fastest",
                messages:[
                    {role:"system",content:"Corrija JSON"},
                    {role:"user",content:texto}
                ]
            },
            {
                headers:{
                    Authorization:`Bearer ${process.env.HUGGINGFACE_API_KEY}`
                }
            }
        );

        return extrairJSONSeguro(resp.data.choices?.[0]?.message?.content);
    }
}

// --------------------
// GERAR LOTE (ENEM)
// --------------------
async function gerarLoteQuestoes(qtd){

const prompt = `
Crie ${qtd} questões estilo ENEM

Formato JSON:
{"questoes":[{ "enunciado":"...", "opcoes":{"A":"...","B":"...","C":"...","D":"...","E":"..."}, "correta":"A"}]}
`;

const resp = await axios.post(
"https://router.huggingface.co/v1/chat/completions",
{
model:"deepseek-ai/DeepSeek-V3.2:fastest",
messages:[
{role:"system",content:"Especialista ENEM"},
{role:"user",content:prompt}
]
},
{
headers:{
Authorization:`Bearer ${process.env.HUGGINGFACE_API_KEY}`
}
}
);

const texto = resp.data.choices?.[0]?.message?.content;

const json = await parseJSONComCorrecao(texto);

return json.questoes;
}

// --------------------
// HEALTH
// --------------------
app.get('/', (req,res)=>res.send("API ON 🚀"));

// --------------------
// AUTH
// --------------------
app.post('/register', async (req,res)=>{
    const {username,senha} = req.body;

    const hash = await bcrypt.hash(senha,10);

    db.run(`INSERT INTO usuarios(username,senha) VALUES(?,?)`,
    [username,hash],
    err=>{
        if(err) return res.status(400).json({error:"Usuário existe"});
        res.json({ok:true});
    });
});

app.post('/login', async (req,res)=>{
    const {username,senha} = req.body;

    db.get(`SELECT * FROM usuarios WHERE username=?`,[username],async (err,row)=>{
        if(!row) return res.status(401).json({error:"Inválido"});
        if(row.banido) return res.status(403).json({error:"Banido"});

        const ok = await bcrypt.compare(senha,row.senha);
        if(!ok) return res.status(401).json({error:"Inválido"});

        req.session.user = {id:row.id,username:row.username};

        res.json({ok:true});
    });
});

app.post('/logout',(req,res)=>{
    req.session.destroy();
    res.json({ok:true});
});

// --------------------
// GERAR PROVA NORMAL
// --------------------
app.post('/gerar-prova', userAuth, async (req,res)=>{

if(req.session.provaAtiva)
return res.status(400).json({error:"Finalize a prova atual"});

const {faculdade,curso,quantidade} = req.body;

const prompt = `Crie ${quantidade} questões ENEM para ${curso} em ${faculdade}`;

try{

const resp = await axios.post(
"https://router.huggingface.co/v1/chat/completions",
{
model:"deepseek-ai/DeepSeek-V3.2:fastest",
messages:[
{role:"system",content:"Especialista ENEM"},
{role:"user",content:prompt}
]
},
{
headers:{Authorization:`Bearer ${process.env.HUGGINGFACE_API_KEY}`}
}
);

const json = await parseJSONComCorrecao(resp.data.choices?.[0]?.message?.content);

req.session.provaAtiva = true;

res.json({questoes:json.questoes});

}catch(err){
res.status(500).json({error:"Erro IA"});
}

});

// --------------------
// GERAR ENEM COMPLETO
// --------------------
app.post('/gerar-enem', userAuth, async (req,res)=>{

const total = Number(req.body.quantidade) || 90;
let questoes = [];

while(questoes.length < total){

try{
const novas = await gerarLoteQuestoes(10);
questoes = questoes.concat(novas);
}catch(e){
console.warn("erro lote");
}

}

questoes = questoes.slice(0,total);

req.session.provaAtiva = true;

res.json({questoes});

});

// --------------------
// SALVAR PROVA
// --------------------
app.post('/salvar-prova', userAuth, (req,res)=>{

const {questoes,tempo} = req.body;

req.session.provaAtiva = false;

db.run(
`INSERT INTO provas(usuario_id,data,questoes,tempo) VALUES(?,?,?,?)`,
[
req.session.user.id,
new Date().toISOString(),
JSON.stringify(questoes),
tempo
],
err=>{
if(err) return res.status(500).json({error:"DB error"});
res.json({ok:true});
}
);

});

// --------------------
// HISTÓRICO
// --------------------
app.get('/provas', userAuth, (req,res)=>{
db.all(`SELECT * FROM provas WHERE usuario_id=?`,
[req.session.user.id],
(err,rows)=>{

res.json({
provas: rows.map(r=>({
...r,
questoes: r.questoes ? JSON.parse(r.questoes):[]
}))
});

});
});

// --------------------
// REDAÇÃO
// --------------------
app.post('/corrigir-redacao', userAuth, async (req,res)=>{

const {tema,texto} = req.body;

const prompt = `Corrija redação ENEM e dê nota`;

const resp = await axios.post(
"https://router.huggingface.co/v1/chat/completions",
{
model:"deepseek-ai/DeepSeek-V3.2:fastest",
messages:[
{role:"system",content:"Corretor ENEM"},
{role:"user",content:prompt+"\n"+texto}
]
},
{
headers:{Authorization:`Bearer ${process.env.HUGGINGFACE_API_KEY}`}
}
);

const json = extrairJSONSeguro(resp.data.choices?.[0]?.message?.content);

res.json(json);

});

// --------------------
// ADMIN
// --------------------
app.post('/admin-login',(req,res)=>{

if(
req.body.email === (process.env.ADMIN_EMAIL||"admin@email.com") &&
req.body.senha === (process.env.ADMIN_SENHA||"123456")
){
req.session.admin = true;
return res.json({ok:true});
}

res.status(401).json({error:"Inválido"});

});

app.get('/admin/usuarios', adminAuth, (req,res)=>{
db.all(`SELECT id,username,banido FROM usuarios`,[],(_,rows)=>{
res.json({usuarios:rows});
});
});

// --------------------
// SERVER
// --------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
console.log("Servidor rodando 🚀");
});
