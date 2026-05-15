const API =
  "https://formulavest.onrender.com";

const token =
  localStorage.getItem("token");

if (!token) {
  window.location.href =
    "/login.html";
}

let questoes = [];

window.addEventListener(
  "DOMContentLoaded",
  () => {
    iniciarApp();
  }
);

function iniciarApp() {
  configurarAbas();
  configurarLogout();
  configurarBotoes();

  carregarRanking();
  carregarDashboard();
}

function configurarAbas() {
  const menuItems =
    document.querySelectorAll(
      ".sidebar li"
    );

  const sections =
    document.querySelectorAll(
      ".section"
    );

  menuItems.forEach(item => {
    item.addEventListener(
      "click",
      () => {
        const alvo =
          item.dataset.section;

        menuItems.forEach(i =>
          i.classList.remove(
            "active"
          )
        );

        sections.forEach(sec =>
          sec.classList.add(
            "hidden"
          )
        );

        item.classList.add(
          "active"
        );

        document
          .getElementById(
            alvo
          )
          .classList.remove(
            "hidden"
          );
      }
    );
  });
}

function configurarLogout() {
  const btn =
    document.getElementById(
      "logout-btn"
    );

  btn.onclick = () => {
    localStorage.clear();

    window.location.href =
      "/login.html";
  };
}

function configurarBotoes() {
  document.getElementById(
    "gerar-enem-btn"
  ).onclick = gerarEnem;

  document.getElementById(
    "gerar-provao-btn"
  ).onclick = gerarProvao;

  document.getElementById(
    "finalizar-enem-btn"
  ).onclick = salvarResultado;

  document.getElementById(
    "finalizar-provao-btn"
  ).onclick = salvarResultado;

  document.getElementById(
    "enviar-redacao"
  ).onclick = corrigirRedacao;
}

async function gerarEnem() {
  try {
    const res =
      await fetch(
        `${API}/gerar-enem`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );

    const data =
      await res.json();

    if (!res.ok) {
      return alert(
        data.error
      );
    }

    renderProva(
      data.questoes,
      "enem-container",
      "finalizar-enem-btn"
    );

  } catch {
    alert(
      "Erro ao gerar ENEM"
    );
  }
}

async function gerarProvao() {
  try {
    const res =
      await fetch(
        `${API}/gerar-provao`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );

    const data =
      await res.json();

    if (!res.ok) {
      return alert(
        data.error
      );
    }

    renderProva(
      data.questoes,
      "provao-container",
      "finalizar-provao-btn"
    );

  } catch {
    alert(
      "Erro ao gerar Provão"
    );
  }
}

function renderProva(
  lista,
  containerId,
  finalizarId
) {
  questoes = lista;

  const container =
    document.getElementById(
      containerId
    );

  container.innerHTML =
    lista
      .map(
        (q, i) => `
      <div class="questao">
        <h3>Q${i + 1}</h3>
        <p>${q.enunciado}</p>

        ${Object.entries(
          q.opcoes
        )
          .map(
            ([l, t]) => `
          <label class="alternativa">
            <input
              type="radio"
              name="q${i}"
              value="${l}"
            >
            ${l}) ${t}
          </label>
        `
          )
          .join("")}
      </div>
    `
      )
      .join("");

  document
    .getElementById(
      finalizarId
    )
    .classList.remove(
      "hidden"
    );
}

async function salvarResultado() {
  try {
    const respostas =
      questoes.map((q, i) => {
        const marcada =
          document.querySelector(
            `input[name="q${i}"]:checked`
          );

        return {
          correta: q.correta,
          selecionada: marcada
            ? marcada.value
            : null
        };
      });

    const res = await fetch(
      `${API}/salvar-prova`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${token}`
        },
        body: JSON.stringify({
          questoes: respostas
        })
      }
    );

    const data =
      await res.json();

    if (!res.ok) {
      return alert(
        data.error
      );
    }

    // trava todas as respostas
    document
      .querySelectorAll(
        'input[type="radio"]'
      )
      .forEach(input => {
        input.disabled = true;
      });

    // esconde botões finalizar
    document
      .getElementById(
        "finalizar-enem-btn"
      )
      .classList.add(
        "hidden"
      );

    document
      .getElementById(
        "finalizar-provao-btn"
      )
      .classList.add(
        "hidden"
      );

    alert(
      `Prova enviada!\n\nAcertos: ${data.acertos}\nPercentual: ${data.percentual.toFixed(
        1
      )}%`
    );

function mostrarDashboard() {
  document
    .querySelectorAll(
      ".sidebar li"
    )
    .forEach(li =>
      li.classList.remove(
        "active"
      )
    );

  document
    .querySelectorAll(
      ".section"
    )
    .forEach(sec =>
      sec.classList.add(
        "hidden"
      )
    );

  document
    .querySelector(
      '[data-section="dashboard"]'
    )
    .classList.add(
      "active"
    );

  document
    .getElementById(
      "dashboard"
    )
    .classList.remove(
      "hidden"
    );
}

    

    // atualiza dashboard
    await carregarDashboard();
    await carregarRanking();

    // redireciona para dashboard
    mostrarDashboard();

  } catch (err) {
    console.error(err);

    alert(
      "Erro ao salvar prova"
    );
  }
}

    const res =
      await fetch(
        `${API}/salvar-prova`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`
          },
          body:
            JSON.stringify(
              {
                questoes:
                  respostas
              }
            )
        }
      );

    const data =
      await res.json();

    if (!res.ok) {
      return alert(
        data.error
      );
    }

    alert(
      `Acertos: ${data.acertos}\nPercentual: ${data.percentual.toFixed(
        1
      )}%`
    );

    carregarDashboard();
    carregarRanking();

  } catch {
    alert(
      "Erro ao salvar"
    );
  }
}

async function carregarDashboard() {
  try {
    const res =
      await fetch(
        `${API}/provas`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );

    const data =
      await res.json();

    const div =
      document.getElementById(
        "dashboard-container"
      );

    if (
      !data.provas ||
      data.provas.length === 0
    ) {
      div.innerHTML =
        "<p>Nenhuma prova feita.</p>";
      return;
    }

    const total =
      data.provas.length;

    const media =
      data.provas.reduce(
        (a, p) =>
          a +
          p.percentual,
        0
      ) / total;

    div.innerHTML = `
      <div class="card">
        <h3>Total de provas</h3>
        <p>${total}</p>
      </div>

      <div class="card">
        <h3>Média geral</h3>
        <p>${media.toFixed(
          1
        )}%</p>
      </div>
    `;

  } catch (err) {
    console.error(err);
  }
}

async function carregarRanking() {
  try {
    const res =
      await fetch(
        `${API}/ranking`
      );

    const data =
      await res.json();

    const div =
      document.getElementById(
        "ranking-container"
      );

    div.innerHTML =
      data.ranking
        .map(
          (u, i) => `
      <div class="card">
        <h3>#${i + 1}
        ${u.username}</h3>

        <p>XP: ${u.xp}</p>
        <p>Nível: ${u.nivel}</p>
      </div>
    `
        )
        .join("");

  } catch (err) {
    console.error(err);
  }
}

async function corrigirRedacao() {
  try {
    const tema =
      document.getElementById(
        "tema-redacao"
      ).value;

    const texto =
      document.getElementById(
        "texto-redacao"
      ).value;

    const res =
      await fetch(
        `${API}/corrigir-redacao`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`
          },
          body:
            JSON.stringify(
              {
                tema,
                texto
              }
            )
        }
      );

    const data =
      await res.json();

    document.getElementById(
      "feedback-redacao"
    ).innerHTML = `
      <div class="card">
        <h3>Nota:
        ${data.nota_total}</h3>

        <p>
        ${data.feedback}
        </p>
      </div>
    `;

  } catch {
    alert(
      "Erro na redação"
    );
  }
}
