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
SET
  xp = xp + $1,
  nivel = FLOOR((xp + $1) / 100) + 1
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
// RANKING
// ======================
app.get('/ranking', auth, async (req, res) => {
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

