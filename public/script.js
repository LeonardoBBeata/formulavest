const API =
  "https://formulavest.onrender.com";

const token =
  localStorage.getItem(
    "token"
  );

if (!token) {
  window.location.href =
    "/login.html";
}

let questoes = [];
let provaId = null;

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
  carregarGrafico();
  carregarDashboard();
  carregarRanking();
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

  menuItems.forEach(
    item => {
      item.addEventListener(
        "click",
        () => {
          const alvo =
            item.dataset.section;

          menuItems.forEach(
            i =>
              i.classList.remove(
                "active"
              )
          );

          sections.forEach(
            s =>
              s.classList.add(
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
    }
  );
}

function configurarLogout() {
  document.getElementById(
    "logout-btn"
  ).onclick = () => {
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
  ).onclick =
    gerarProvao;

  document.getElementById(
    "finalizar-enem-btn"
  ).onclick =
    salvarResultado;

  document.getElementById(
    "finalizar-provao-btn"
  ).onclick =
    salvarResultado;

  document.getElementById(
    "enviar-redacao"
  ).onclick =
    corrigirRedacao;
}

async function gerarEnem() {
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

  provaId =
    data.prova_id;

  renderProva(
    data.questoes,
    "enem-container",
    "finalizar-enem-btn"
  );
}

async function gerarProvao() {
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

  provaId =
    data.prova_id;

  renderProva(
    data.questoes,
    "provao-container",
    "finalizar-provao-btn"
  );
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

  container.innerHTML = "";

  lista.forEach((q, i) => {
    container.innerHTML += `
      <div class="questao">
        <p class="numero-questao">
          Questão: ${i + 1}
        </p>

        <p class="enunciado">
          ${q.enunciado}
        </p>

        ${Object.entries(q.opcoes)
          .map(([letra, texto]) => `
            <label class="alternativa">
              <input
                type="radio"
                name="q${i}"
                value="${letra}"
              >
              ${texto}
            </label>
          `)
          .join("")}
      </div>
    `;
  });

  document
    .getElementById(
      finalizarId
    )
    .classList.remove(
      "hidden"
    );
}

async function salvarResultado() {
  const respostas =
    questoes.map(
      (q, i) => {
        const marcada =
          document.querySelector(
            `input[name="q${i}"]:checked`
          );

        return {
          correta:
            q.correta,
          selecionada:
            marcada
              ? marcada.value
              : null
        };
      }
    );

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
          JSON.stringify({
            prova_id:
              provaId,
            questoes:
              respostas
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

  document
    .querySelectorAll(
      'input[type="radio"]'
    )
    .forEach(i => {
      i.disabled = true;
    });

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
    `Acertos: ${data.acertos}\nPercentual: ${data.percentual.toFixed(
      1
    )}%`
  );

  await carregarDashboard();
  await carregarRanking();

  mostrarDashboard();
}

function mostrarDashboard() {
  document
    .querySelectorAll(
      ".sidebar li"
    )
    .forEach(
      li =>
        li.classList.remove(
          "active"
        )
    );

  document
    .querySelectorAll(
      ".section"
    )
    .forEach(
      sec =>
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

async function carregarDashboard() {
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
}
async function carregarRanking() {
  const token =
    localStorage.getItem("token");

  const res = await fetch(
    `${API}/ranking`,
    {
      headers:{
        Authorization:
          `Bearer ${token}`
      }
    }
  );

  const data =
    await res.json();

  if(!res.ok){
    console.log(data.error);
    return;
  }

  const ranking =
    data.ranking;

  const meuNome =
    localStorage.getItem(
      "username"
    );

  // TOP 3
  document.getElementById(
    "top3"
  ).innerHTML =
    ranking.slice(0,3)
    .map((u,i)=>`
      <div class="top-card ${
        i===0 ? "gold" :
        i===1 ? "silver" :
        "bronze"
      }">
        <div>#${i+1}</div>
        <div>${u.username}</div>
        <div class="xp">
          ${u.xp} XP
        </div>
      </div>
    `).join("");

  // LISTA
  document.getElementById(
    "ranking"
  ).innerHTML =
    ranking.map((u,i)=>`
      <div class="
        ranking-item
        ${
          u.username===meuNome
          ? "me"
          : ""
        }
      ">
        <div class="rank-left">
          <div class="rank-pos">
            #${i+1}
          </div>

          <div class="rank-user">
            ${u.username}
          </div>
        </div>

        <div class="rank-xp">
          ${u.xp} XP
        </div>
      </div>
    `).join("");
}


async function carregarGrafico() {
  const token =
    localStorage.getItem(
      "token"
    );

  const res =
    await fetch(
      `${API}/provas`,
      {
        headers:{
          Authorization:
            `Bearer ${token}`
        }
      }
    );

  const data =
    await res.json();

  if(!data.provas) return;

  let xp = 0;

  const labels = [];
  const valores = [];

  data.provas
    .reverse()
    .forEach((p,i)=>{
      xp += Math.floor(
        p.percentual
      );

      labels.push(
        `Prova ${i+1}`
      );

      valores.push(
        xp
      );
    });

  const ctx =
    document
      .getElementById(
        "graficoEvolucao"
      );

  new Chart(ctx,{
    type:"line",
    data:{
      labels,
      datasets:[
        {
          label:"XP",
          data:valores,
          borderWidth:3,
          tension:0.3,
          fill:true
        }
      ]
    },
    options:{
      responsive:true
    }
  });
}
async function corrigirRedacao() {
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
          JSON.stringify({
            tema,
            texto
          })
      }
    );

  const data =
    await res.json();

  document.getElementById(
    "feedback-redacao"
  ).innerHTML = `
    <div class="card">
      <h3>
        Nota:
        ${data.nota_total}
      </h3>

      <p>
        ${data.feedback}
      </p>
    </div>
  `;
}
