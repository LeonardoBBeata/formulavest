


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



        // enviar email


await enviarEmail(
  email,
  "Código de verificação - FórmulaVest",
  `Seu código de verificação é: ${codigo}`
);


        



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


app.post('/login-iniciar', async (req, res) => {
  try {
    const { email, senha } = req.body;

    const result = await db.query(`
      SELECT *
      FROM usuarios
      WHERE email = $1
    `, [email.toLowerCase()]);

    const user = result.rows[0];

    // usuário não existe
    if (!user) {
      return res.status(404).json({
        error: 'Email não encontrado'
      });
    }

    // usuário banido
    if (user.banido) {
      return res.status(403).json({
        error: 'Usuário banido'
      });
    }
    if (!user.verificado) {
  return res.status(403).json({
    error: 'Confirme seu email primeiro'
  });
}

    // verifica senha
    const ok = await bcrypt.compare(
      senha,
      user.senha
    );

    if (!ok) {
      return res.status(401).json({
        error: 'Senha incorreta'
      });
    }

    // ADM MASTER -> pula código
    if (
      user.email.toLowerCase() ===
      'adm@formulavest.com'
    ) {
      return res.json({
        ok: true,
        adminDirect: true
      });
    }

    // gera código para usuário normal
    const codigo = Math.floor(
      100000 +
      Math.random() * 900000
    ).toString();

    await db.query(`
      UPDATE usuarios
      SET codigo_verificacao = $1
      WHERE id = $2
    `, [
      codigo,
      user.id
    ]);

    await enviarEmail(
      user.email,
      "Código de login - FórmulaVest",
      `Seu código é: ${codigo}`
    );

    return res.json({
      ok: true
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: 'Erro login'
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

    const result = await db.query(`
      SELECT *
      FROM usuarios
      WHERE email = $1
    `, [email.toLowerCase()]);

    const user = result.rows[0];

    // usuário não existe
    if (!user) {
      return res.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    // usuário banido
    if (user.banido) {
      return res.status(403).json({
        error: 'Usuário banido'
      });
    }
      if (!user.verificado) {
  return res.status(403).json({
    error: 'Confirme seu email primeiro'
  });
}

    // verifica senha
    const senhaOk =
      await bcrypt.compare(
        senha,
        user.senha
      );

    if (!senhaOk) {
      return res.status(401).json({
        error: 'Senha incorreta'
      });
    }

    // só exige código se NÃO for ADM
    if (
      user.email.toLowerCase() !==
      'adm@formulavest.com'
    ) {
      if (
        user.codigo_verificacao !==
        codigo
      ) {
        return res.status(400).json({
          error: 'Código inválido'
        });
      }

      // limpa código
      await db.query(`
        UPDATE usuarios
        SET codigo_verificacao = NULL
        WHERE id = $1
      `, [user.id]);
    }

    // gera token
    const token =
      gerarToken(user);

    return res.json({
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

    return res.status(500).json({
      error: 'Erro login'
    });
  }
});

app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const result = await db.query(`
      SELECT id
      FROM usuarios
      WHERE email = $1
    `, [email]);

if (result.rows.length === 0) {
  return res.json({
    message: "Se o email existir, enviaremos um link."
  });
}

const token = crypto.randomUUID();

await db.query(`
  UPDATE usuarios
  SET
    reset_token=$1,
    reset_expira=NOW() + INTERVAL '1 hour'
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
      <a href="${link}">Alterar senha</a>
      `
    );

    res.json({
      message: "Link enviado"
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Erro"
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

const result = await db.query(`
  SELECT *
  FROM usuarios
  WHERE reset_token=$1
  AND reset_expira > NOW()
`, [token]);

const user = result.rows[0];

if (!user) {
  return res.status(400).json({
    error: "Token inválido"
  });
}

     const hash = await bcrypt.hash(
  senha,
  10
);

await db.query(`
  UPDATE usuarios
  SET
    senha = $1,
    reset_token = NULL,
    reset_expira = NULL
  WHERE id = $2
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

      res.status(400).json({
        error:
          "Token inválido ou expirado"
      });
    }
  }
);
