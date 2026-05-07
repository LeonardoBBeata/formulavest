require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();

// ================================
// CONFIG
// ================================
const PORT = process.env.PORT || 3000;

// ================================
// CORS
// ================================
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

app.use(express.json());

// ================================
// PUBLIC
// ================================
app.use(express.static(path.join(__dirname, 'public')));

// ================================
// ROTAS HTML
// ================================
app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (_, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ================================
// SESSION
// ================================
app.set('trust proxy', 1);

app.use(session({
    name: 'sessionId',
    secret: process.env.SESSION_SECRET || 'simulado123',

    resave: false,
    saveUninitialized: false,

    proxy: true,

    cookie: {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 1000 * 60 * 60 * 2
    }
}));

// ================================
// DATABASE
// ================================
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

// ================================
// AUTH MIDDLEWARE
// ================================
function userAuth(req, res, next){

    if(!req.session.user){
        return res.status(401).json({
            error:'Não autorizado'
        });
    }

    next();
}

// ================================
// JSON SAFE
// ================================
function extrairJSONSeguro(texto){

    try{

        const match = texto.match(/\{[\s\S]*\}|\[[\s\S]*\]/);

        if(!match){
            throw new Error('JSON inválido');
        }

        return JSON.parse(match[0]);

    }catch(err){

        console.log('ERRO JSON:', err.message);

        return null;
    }
}

// ================================
// IA
// ================================
async function chamarIA(prompt){

    try{

        const response = await axios.post(
            'https://router.huggingface.co/v1/chat/completions',
            {
                model:'deepseek-ai/DeepSeek-V3.2:fastest',

                messages:[
                    {
                        role:'system',
                        content:'Você é um especialista em vestibulares e ENEM.'
                    },
                    {
                        role:'user',
                        content:prompt
                    }
                ]
            },
            {
                headers:{
                    Authorization:`Bearer ${process.env.HUGGINGFACE_API_KEY}`
                },

                timeout:60000
            }
        );

        return response.data.choices?.[0]?.message?.content;

    }catch(err){

        console.log('ERRO IA:', err.message);

        throw new Error('Falha ao gerar conteúdo');
    }
}

// ================================
// HEALTH
// ================================
app.get('/health', (_,res)=>{
    res.json({
        ok:true,
        message:'API ONLINE 🚀'
    });
});

// ================================
// REGISTER
// ================================
app.post('/register', async (req,res)=>{

    try{

        const { username, senha } = req.body;

        if(!username || !senha){

            return res.status(400).json({
                error:'Dados inválidos'
            });
        }

        const hash = await bcrypt.hash(senha,10);

        db.run(
            `
            INSERT INTO usuarios(username,senha)
            VALUES(?,?)
            `,
            [username,hash],

            function(err){

                if(err){

                    return res.status(400).json({
                        error:'Usuário já existe'
                    });
                }

                res.json({
                    ok:true
                });
            }
        );

    }catch(err){

        res.status(500).json({
            error:'Erro interno'
        });
    }
});

// ================================
// LOGIN
// ================================
app.post('/login', (req,res)=>{

    const { username, senha } = req.body;

    if(!username || !senha){

        return res.status(400).json({
            error:'Preencha todos os campos'
        });
    }

    db.get(
        `
        SELECT * FROM usuarios
        WHERE username = ?
        `,
        [username],

        async (err,row)=>{

            if(err){

                return res.status(500).json({
                    error:'Erro interno'
                });
            }

            if(!row){

                return res.status(401).json({
                    error:'Usuário não encontrado'
                });
            }

            if(row.banido){

                return res.status(403).json({
                    error:'Usuário banido'
                });
            }

            const senhaCorreta = await bcrypt.compare(
                senha,
                row.senha
            );

            if(!senhaCorreta){

                return res.status(401).json({
                    error:'Senha incorreta'
                });
            }

            req.session.user = {
                id:row.id,
                username:row.username
            };

            res.json({
                ok:true,
                user:{
                    id:row.id,
                    username:row.username
                }
            });
        }
    );
});

// ================================
// LOGOUT
// ================================
app.post('/logout', (req,res)=>{

    req.session.destroy(()=>{

        res.clearCookie('sessionId');

        res.json({
            ok:true
        });
    });
});

// ================================
// GERAR PROVA
// ================================
app.post('/gerar-prova', userAuth, async (req,res)=>{

    try{

        const {
            curso,
            faculdade,
            quantidade
        } = req.body;

        const qtd = Number(quantidade) || 10;

        const prompt = `
Crie ${qtd} questões estilo ENEM para o curso ${curso}
na faculdade ${faculdade}.

Retorne SOMENTE JSON:

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

        const respostaIA = await chamarIA(prompt);

        const json = extrairJSONSeguro(respostaIA);

        if(!json || !json.questoes){

            return res.status(500).json({
                error:'IA retornou inválido'
            });
        }

        res.json({
            questoes:json.questoes
        });

    }catch(err){

        console.log(err);

        res.status(500).json({
            error:err.message
        });
    }
});

// ================================
// GERAR ENEM
// ================================
app.post('/gerar-enem', userAuth, async (req,res)=>{

    try{

        let questoes = [];

        while(questoes.length < 90){

            try{

                const resposta = await chamarIA(`
Crie 10 questões estilo ENEM em JSON.
`);

                const json = extrairJSONSeguro(resposta);

                if(json?.questoes){

                    questoes = [
                        ...questoes,
                        ...json.questoes
                    ];
                }

            }catch(err){

                console.log('Erro lote:', err.message);
            }
        }

        res.json({
            questoes:questoes.slice(0,90)
        });

    }catch(err){

        res.status(500).json({
            error:'Erro ao gerar ENEM'
        });
    }
});

// ================================
// SALVAR PROVA
// ================================
app.post('/salvar-prova', userAuth, (req,res)=>{

    try{

        const {
            questoes,
            tempo
        } = req.body;

        db.run(
            `
            INSERT INTO provas(
                usuario_id,
                data,
                questoes,
                tempo
            )
            VALUES(?,?,?,?)
            `,
            [
                req.session.user.id,
                new Date().toISOString(),
                JSON.stringify(questoes),
                tempo
            ],

            err=>{

                if(err){

                    return res.status(500).json({
                        error:'Erro ao salvar'
                    });
                }

                res.json({
                    ok:true
                });
            }
        );

    }catch(err){

        res.status(500).json({
            error:'Erro interno'
        });
    }
});

// ================================
// HISTÓRICO
// ================================
app.get('/provas', userAuth, (req,res)=>{

    db.all(
        `
        SELECT * FROM provas
        WHERE usuario_id = ?
        ORDER BY id DESC
        `,
        [req.session.user.id],

        (err,rows)=>{

            if(err){

                return res.status(500).json({
                    error:'Erro DB'
                });
            }

            res.json({
                provas:rows.map(row=>({

                    ...row,

                    questoes:JSON.parse(
                        row.questoes || '[]'
                    )
                }))
            });
        }
    );
});

// ================================
// ANÁLISE
// ================================
app.post('/analise-desempenho', userAuth, (_,res)=>{

    res.json({

        fortes:[
            'Matemática'
        ],

        fracos:[
            'Humanas'
        ],

        recomendacoes:[
            'Revisar teoria',
            'Fazer exercícios',
            'Treinar interpretação'
        ]
    });
});

// ================================
// REDAÇÃO
// ================================
app.post('/corrigir-redacao', userAuth, async (req,res)=>{

    try{

        const { texto } = req.body;

        if(!texto){

            return res.status(400).json({
                error:'Texto vazio'
            });
        }

        const resposta = await chamarIA(`
Corrija esta redação ENEM:

${texto}

Forneça:
- nota
- competências
- pontos fortes
- pontos fracos
- melhorias
`);

        res.json({

            nota:Math.floor(
                Math.random() * 1000
            ),

            feedback:resposta
        });

    }catch(err){

        res.status(500).json({
            error:'Erro ao corrigir'
        });
    }
});

// ================================
// 404
// ================================
app.use((req,res)=>{

    res.status(404).json({
        error:'Rota não encontrada'
    });
});

// ================================
// START
// ================================
app.listen(PORT, ()=>{

    console.log(`
====================================
🚀 SERVIDOR ONLINE
🌐 PORTA: ${PORT}
====================================
`);
});
