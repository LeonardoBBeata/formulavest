require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const helmet = require('helmet');
const compression = require('compression');
const PDFDocument = require('pdfkit');
const NodeCache = require('node-cache');
const { Pool } = require('pg');
const path = require('path');
const app = express();
const cache = new NodeCache({
stdTTL:300
});
// =========================
// POSTGRES
// =========================
const db = new Pool({
connectionString:process.env.DATABASE_URL,
ssl:{
rejectUnauthorized:false
}
});
// =========================
// MIDDLEWARES
// =========================
app.use(helmet());
app.use(compression());
app.use(cors({
origin:process.env.FRONTEND_URL,
credentials:true
}));
app.use(express.json());
app.use(express.static(
path.join(__dirname,'public')
));
// =========================
// JWT
// =========================
function gerarToken(user){
return jwt.sign(
{
id:user.id,
username:user.username
},
process.env.JWT_SECRET,
{
expiresIn:'7d'
}
);
}
function auth(req,res,next){
const authHeader = req.headers.authorization;
if(!authHeader){
return res.status(401).json({
error:'Token ausente'
});
}
const token = authHeader.split(' ')[1];
try{
const decoded = jwt.verify(
token,
process.env.JWT_SECRET
);
req.user = decoded;
next();
}catch{
res.status(401).json({
error:'Token inválido'
});
}
}
// =========================
// DATABASE INIT
// =========================
async function initDB(){
await db.query(`
 CREATE TABLE IF NOT EXISTS usuarios(
 id SERIAL PRIMARY KEY,
 username TEXT UNIQUE,
 senha TEXT,
 xp INTEGER DEFAULT 0,
 nivel INTEGER DEFAULT 1
 )
 `);
await db.query(`
 CREATE TABLE IF NOT EXISTS provas(
 id SERIAL PRIMARY KEY,
 usuario_id INTEGER,
 acertos INTEGER,
 total INTEGER,
 percentual REAL,
 questoes JSONB,
 created_at TIMESTAMP DEFAULT NOW()
 )
 `);
await db.query(`
 CREATE TABLE IF NOT EXISTS redacoes(
 id SERIAL PRIMARY KEY,
 usuario_id INTEGER,
 tema TEXT,
 texto TEXT,
 nota INTEGER,
 c1 INTEGER,
 c2 INTEGER,
 c3 INTEGER,
 c4 INTEGER,
 c5 INTEGER,
 feedback TEXT
 )
 `);
}
initDB();
// =========================
// REGISTER
// =========================
app.post('/register', async(req,res)=>{
4
try{
const {
username,
senha
} = req.body;
const hash = await bcrypt.hash(
senha,
10
);
await db.query(
`
 INSERT INTO usuarios(username,senha)
 VALUES($1,$2)
 `,
[username,hash]
);
res.json({ ok:true });
}catch(err){
res.status(500).json({
error:'Erro ao registrar'
});
}
});
// =========================
// LOGIN
// =========================
app.post('/login', async(req,res)=>{
try{
const {
username,
senha
} = req.body;
const result = await db.query(
`SELECT * FROM usuarios WHERE username=$1`,
[username]
);
const user = result.rows[0];
if(!user){
5
return res.status(401).json({
error:'Usuário não encontrado'
});
}
const ok = await bcrypt.compare(
senha,
user.senha
);
if(!ok){
return res.status(401).json({
error:'Senha incorreta'
});
}
const token = gerarToken(user);
res.json({
ok:true,
token,
user:{
id:user.id,
username:user.username,
nivel:user.nivel,
xp:user.xp
}
});
}catch(err){
res.status(500).json({
error:'Erro login'
});
}
});
// =========================
// RANKING GLOBAL
// =========================
app.get('/ranking', async(_,res)=>{
try{
const result = await db.query(`
 SELECT
 username,
6
 xp,
 nivel
 FROM usuarios
 ORDER BY xp DESC
 LIMIT 50
 `);
res.json({
ranking:result.rows
});
}catch{
res.status(500).json({
error:'Erro ranking'
});
}
});

// =========================
// IA
// =========================
async function chamarIA(prompt){

    try{

        const response = await axios.post(
            'https://router.huggingface.co/v1/chat/completions',
            {
                model:'deepseek-ai/DeepSeek-V3.2:fastest',

                messages:[
                    {
                        role:'system',
                        content:'Você é um especialista em ENEM e vestibulares.'
                    },
                    {
                        role:'user',
                        content:prompt
                    }
                ]
            },
            {
                headers:{
                    Authorization:
                    `Bearer ${process.env.HUGGINGFACE_API_KEY}`
                },

                timeout:60000
            }
        );

        return response.data
            .choices?.[0]
            ?.message?.content;

    }catch(err){

        console.log(err);

        throw new Error('Erro IA');
    }
}

// =========================
// JSON SAFE
// =========================
function extrairJSONSeguro(texto){

    try{

        const match = texto.match(
            /\{[\s\S]*\}|\[[\s\S]*\]/
        );

        if(!match){

            throw new Error('JSON inválido');
        }

        return JSON.parse(match[0]);

    }catch{

        return null;
    }
}

// =========================
// GERAR PROVA
// =========================
app.post('/gerar-prova', auth, async(req,res)=>{

    try{

        const {
            curso,
            faculdade,
            quantidade
        } = req.body;

        const qtd =
        Number(quantidade) || 10;

        const prompt = `
Crie ${qtd} questões estilo ENEM para:

Curso: ${curso}
Faculdade: ${faculdade}

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
`;

        const resposta =
        await chamarIA(prompt);

        const json =
        extrairJSONSeguro(resposta);

        if(!json || !json.questoes){

            return res.status(500).json({
                error:'IA inválida'
            });
        }

        res.json({
            questoes:json.questoes
        });

    }catch(err){

        console.log(err);

        res.status(500).json({
            error:'Erro ao gerar prova'
        });
    }
});

// =========================
// GERAR ENEM COMPLETO
// =========================
app.post('/gerar-enem', auth, async(req,res)=>{

    try{

        let questoes = [];

        while(questoes.length < 90){

            try{

                const resposta =
                await chamarIA(`

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
                extrairJSONSeguro(resposta);

                if(json?.questoes){

                    questoes = [
                        ...questoes,
                        ...json.questoes
                    ];
                }

            }catch(err){

                console.log(
                    'Erro lote:',
                    err.message
                );
            }
        }

        res.json({
            questoes:questoes.slice(0,90)
        });

    }catch(err){

        console.log(err);

        res.status(500).json({
            error:'Erro ENEM'
        });
    }
});

// =========================
// SALVAR PROVA
// =========================
app.post('/salvar-prova', auth, async(req,res)=>{

    try{

        const {
            questoes
        } = req.body;

        let acertos = 0;

        questoes.forEach(q=>{

            if(q.selecionada === q.correta){

                acertos++;
            }
        });

        const percentual =
        (acertos / questoes.length) * 100;

        // XP
        const xpGanho =
        Math.floor(percentual);

        await db.query(
            `
            UPDATE usuarios
            SET
                xp = xp + $1,
                nivel = FLOOR((xp + $1)/100)+1
            WHERE id = $2
            `,
            [
                xpGanho,
                req.user.id
            ]
        );

        // salva prova
        await db.query(
            `
            INSERT INTO provas(
                usuario_id,
                acertos,
                total,
                percentual,
                questoes
            )
            VALUES($1,$2,$3,$4,$5)
            `,
            [
                req.user.id,
                acertos,
                questoes.length,
                percentual,
                JSON.stringify(questoes)
            ]
        );

        // limpa cache
        cache.del(
            `provas_${req.user.id}`
        );

        res.json({
            ok:true,
            acertos,
            percentual
        });

    }catch(err){

        console.log(err);

        res.status(500).json({
            error:'Erro salvar prova'
        });
    }
});

// =========================
// CACHE PROVAS
// =========================
app.get('/provas', auth, async(req,res)=>{
const cacheKey = `provas_${req.user.id}`;
const cached = cache.get(cacheKey);
if(cached){
return res.json(cached);
}
const result = await db.query(
`
 SELECT * FROM provas
 WHERE usuario_id=$1
 ORDER BY created_at DESC
 `,
[req.user.id]
);
const payload = {
provas:result.rows
};
cache.set(cacheKey,payload);
res.json(payload);
7
});
// =========================
// PDF
// =========================
app.get('/pdf/:id', auth, async(req,res)=>{
const result = await db.query(
`SELECT * FROM provas WHERE id=$1`,
[req.params.id]
);
const prova = result.rows[0];
const doc = new PDFDocument();
res.setHeader(
'Content-Type',
'application/pdf'
);
doc.pipe(res);
doc.fontSize(24)
.text('Simulado ENEM');
doc.moveDown();
prova.questoes.forEach((q,i)=>{
doc.fontSize(14)
.text(`${i+1}. ${q.enunciado}`);
doc.moveDown();
});
doc.end();
});
// =========================
// REDAÇÃO REAL
// =========================
app.post('/corrigir-redacao', auth, async(req,res)=>{
try{
const {
tema,
texto
8
} = req.body;
const prompt = `
Você é um corretor oficial do ENEM.
Corrija esta redação usando as 5 competências.
Tema: ${tema}
Texto:
${texto}
Retorne JSON:
{
 "nota_total":0,
 "competencia1":0,
 "competencia2":0,
 "competencia3":0,
 "competencia4":0,
 "competencia5":0,
 "feedback":""
}
`;
const response = await axios.post(
'https://router.huggingface.co/v1/chat/completions',
{
model:'deepseek-ai/DeepSeek-V3.2:fastest',
messages:[
{
role:'user',
content:prompt
}
]
},
{
headers:{
Authorization:`Bearer ${process.env.HUGGINGFACE_API_KEY}`
}
}
);
const textoIA = response.data
.choices[0]
.message
.content;
const json = JSON.parse(
textoIA.match(/\{[\s\S]*\}/)[0]
);
9
res.json(json);
}catch(err){
console.log(err);
res.status(500).json({
error:'Erro redação'
});
}
});
// =========================
// START
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>{
console.log(`Servidor online ${PORT}`);
});
