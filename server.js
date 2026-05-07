require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const NodeCache = require('node-cache');
const PDFDocument = require('pdfkit');
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

async function initDB(){

    await db.query(`
    
        CREATE TABLE IF NOT EXISTS usuarios(
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            xp INTEGER DEFAULT 0,
            nivel INTEGER DEFAULT 1,
            criado_em TIMESTAMP DEFAULT NOW()
        )
    
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

initDB();

// ======================
// JWT
// ======================

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

    const header = req.headers.authorization;

    if(!header){

        return res.status(401).json({
            error:'Token ausente'
        });
    }

    const token = header.split(' ')[1];

    try{

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    }catch{

        return res.status(401).json({
            error:'Token inválido'
        });
    }
}

// ======================
// IA
// ======================

async function chamarIA(prompt){

    try{

        const response = await axios.post(
            'https://router.huggingface.co/v1/chat/completions',
            {
                model:'deepseek-ai/DeepSeek-V3.2:fastest',

                messages:[
                    {
                        role:'system',
                        content:'Você é especialista em ENEM.'
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

        console.log(err.message);

        throw new Error('Erro IA');
    }
}

// ======================
// JSON SAFE
// ======================

function extrairJSONSeguro(texto){

    try{

        const match = texto.match(
            /\{[\s\S]*\}|\[[\s\S]*\]/
        );

        if(!match){

            return null;
        }

        return JSON.parse(match[0]);

    }catch{

        return null;
    }
}

// ======================
// HEALTH
// ======================

app.get('/',(_,res)=>{

    res.send('API ONLINE 🚀');
});

// ======================
// REGISTER
// ======================

app.post('/register',async(req,res)=>{

    try{

        const {
            username,
            senha
        } = req.body;

        if(!username || !senha){

            return res.status(400).json({
                error:'Dados inválidos'
            });
        }

        const hash =
        await bcrypt.hash(senha,10);

        await db.query(
            `
            INSERT INTO usuarios(
                username,
                senha
            )
            VALUES($1,$2)
            `,
            [
                username,
                hash
            ]
        );

        res.json({
            ok:true
        });

    }catch(err){

        console.log(err);

        res.status(400).json({
            error:'Usuário já existe'
        });
    }
});

// ======================
// LOGIN
// ======================

app.post('/login',async(req,res)=>{

    try{

        const {
            username,
            senha
        } = req.body;

        const result =
        await db.query(
            `
            SELECT *
            FROM usuarios
            WHERE username = $1
            `,
            [username]
        );

        const user = result.rows[0];

        if(!user){

            return res.status(401).json({
                error:'Usuário não encontrado'
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

        const token =
        gerarToken(user);

        res.json({
            ok:true,
            token,

            user:{
                id:user.id,
                username:user.username,
                xp:user.xp,
                nivel:user.nivel
            }
        });

    }catch(err){

        console.log(err);

        res.status(500).json({
            error:'Erro login'
        });
    }
});

// ======================
// GERAR PROVA
// ======================

app.post('/gerar-prova',auth,async(req,res)=>{

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
            error:'Erro gerar prova'
        });
    }
});

// ======================
// GERAR ENEM
// ======================

app.post('/gerar-enem',auth,async(req,res)=>{

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

                console.log(err.message);
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

// ======================
// SALVAR PROVA
// ======================

app.post('/salvar-prova',auth,async(req,res)=>{

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

        const result =
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
            RETURNING *
            `,
            [
                req.user.id,
                acertos,
                questoes.length,
                percentual,
                JSON.stringify(questoes)
            ]
        );

        cache.del(
            `provas_${req.user.id}`
        );

        res.json({
            ok:true,
            prova:result.rows[0],
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

// ======================
// HISTÓRICO
// ======================

app.get('/provas',auth,async(req,res)=>{

    try{

        const cacheKey =
        `provas_${req.user.id}`;

        const cached =
        cache.get(cacheKey);

        if(cached){

            return res.json({
                provas:cached
            });
        }

        const result =
        await db.query(
            `
            SELECT *
            FROM provas
            WHERE usuario_id = $1
            ORDER BY id DESC
            `,
            [req.user.id]
        );

        cache.set(
            cacheKey,
            result.rows
        );

        res.json({
            provas:result.rows
        });

    }catch(err){

        console.log(err);

        res.status(500).json({
            error:'Erro histórico'
        });
    }
});

// ======================
// RANKING
// ======================

app.get('/ranking',async(_,res)=>{

    try{

        const result =
        await db.query(
            `
            SELECT
                username,
                xp,
                nivel
            FROM usuarios
            ORDER BY xp DESC
            LIMIT 50
            `
        );

        res.json({
            ranking:result.rows
        });

    }catch(err){

        console.log(err);

        res.status(500).json({
            error:'Erro ranking'
        });
    }
});

// ======================
// REDAÇÃO
// ======================

app.post('/corrigir-redacao',auth,async(req,res)=>{

    try{

        const {
            tema,
            texto
        } = req.body;

        const prompt = `

Corrija esta redação ENEM.

Tema:
${tema}

Texto:
${texto}

Retorne JSON:

{
 "competencia1":0,
 "competencia2":0,
 "competencia3":0,
 "competencia4":0,
 "competencia5":0,
 "nota_total":0,
 "feedback":""
}

`;

        const resposta =
        await chamarIA(prompt);

        const json =
        extrairJSONSeguro(resposta);

        if(!json){

            return res.status(500).json({
                error:'Erro correção'
            });
        }

        res.json(json);

    }catch(err){

        console.log(err);

        res.status(500).json({
            error:'Erro redação'
        });
    }
});

// ======================
// PDF
// ======================

app.get('/pdf/:id',auth,async(req,res)=>{

    try{

        const provaId =
        req.params.id;

        const result =
        await db.query(
            `
            SELECT *
            FROM provas
            WHERE id = $1
            `,
            [provaId]
        );

        const prova =
        result.rows[0];

        if(!prova){

            return res.status(404).send(
                'Não encontrada'
            );
        }

        const doc =
        new PDFDocument();

        res.setHeader(
            'Content-Type',
            'application/pdf'
        );

        res.setHeader(
            'Content-Disposition',
            `inline; filename=prova-${prova.id}.pdf`
        );

        doc.pipe(res);

        doc
        .fontSize(22)
        .text(
            'Simulado ENEM',
            {
                align:'center'
            }
        );

        doc.moveDown();

        doc
        .fontSize(14)
        .text(
            `Acertos: ${prova.acertos}`
        );

        doc.text(
            `Total: ${prova.total}`
        );

        doc.text(
            `Percentual: ${prova.percentual.toFixed(1)}%`
        );

        doc.end();

    }catch(err){

        console.log(err);

        res.status(500).send(
            'Erro PDF'
        );
    }
});

// ======================
// START
// ======================

app.listen(PORT,()=>{

    console.log(
        `Servidor rodando na porta ${PORT}`
    );
});
