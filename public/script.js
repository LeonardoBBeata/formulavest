const API = "https://formulavest.onrender.com";
const token = localStorage.getItem("token");

if (!token) window.location.href = "/login.html";

// ======================
// STATE
// ======================
let questoes = [];
let provaId = null;
let respostasUser = {};
let grafico = null;

// ======================
// INIT
// ======================
window.addEventListener("DOMContentLoaded", () => {
  configurarAbas();
  configurarBotoes();
  configurarLogout();
  configurarPerfil();

  carregarDashboard();
  carregarRanking();
  carregarGrafico();
  carregarUser();
});

// ======================
// HELPERS
// ======================
const el = (id) => document.getElementById(id);

// ======================
// PERFIL BOLINHA
// ======================
function configurarPerfil() {
  const avatar = el("avatar-mini");

  avatar?.addEventListener("click", () => {
    window.location.href = "/perfil.html";
  });
}

// ======================
// ABAS
// ======================
function configurarAbas() {
  document.querySelectorAll(".sidebar li").forEach(item => {
    item.addEventListener("click", () => {
      const alvo = item.dataset.section;

      document.querySelectorAll(".sidebar li").forEach(i => i.classList.remove("active"));
      document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));

      item.classList.add("active");
      el(alvo)?.classList.remove("hidden");
    });
  });
}

// ======================
// BOTÕES
// ======================
function configurarBotoes() {
  el("gerar-enem-btn")?.addEventListener("click", gerarEnem);
  el("gerar-provao-btn")?.addEventListener("click", gerarProvao);

  el("finalizar-enem-btn")?.addEventListener("click", salvarResultado);
  el("finalizar-provao-btn")?.addEventListener("click", salvarResultado);

  el("enviar-redacao")?.addEventListener("click", corrigirRedacao);
}

// ======================
// DASHBOARD
// ======================
async function carregarDashboard() {
  try {
    const res = await fetch(`${API}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    el("dashboard-container").innerHTML = `
      <div class="card">
        <p>Total de provas: ${data.provas?.length || 0}</p>
      </div>
    `;
  } catch (e) {
    console.error(e);
  }
}

// ======================
// USER (XP)
// ======================
async function carregarUser() {
  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const user = await res.json();

  el("xp-total").innerText = user.xp || 0;
  el("nivel-user").innerText = user.nivel || 1;

  el("xp-bar-fill").style.width = `${(user.xp || 0) % 100}%`;
}

// ======================
// RANKING
// ======================
async function carregarRanking() {
  const res = await fetch(`${API}/ranking`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  const top3 = data.slice(0, 3);

  el("top3").innerHTML = top3.map((u, i) => `
    <div class="card">
      <h3>${i + 1}º ${u.username}</h3>
      <p>${u.xp} XP</p>
    </div>
  `).join("");

  el("ranking-list").innerHTML = data.map((u, i) => `
    <div>
      ${i + 1} - ${u.username} | ${u.xp} XP
    </div>
  `).join("");
}

// ======================
// GRÁFICO
// ======================
async function carregarGrafico() {
  const res = await fetch(`${API}/grafico`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  const ctx = el("graficoEvolucao");
  if (!ctx) return;

  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: "line",
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: "Acertos",
        data: Object.values(data),
        borderWidth: 2
      }]
    }
  });
}

// ======================
// PROVA ENEM
// ======================
async function gerarEnem() {
  const res = await fetch(`${API}/gerar-enem`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  questoes = data.questoes;
  provaId = data.prova_id;
  respostasUser = {};

  renderProva(questoes, "enem-container", "finalizar-enem-btn");
}

// ======================
// PROVA PROVÃO
// ======================
async function gerarProvao() {
  const res = await fetch(`${API}/gerar-provao`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  questoes = data.questoes;
  provaId = data.prova_id;
  respostasUser = {};

  renderProva(questoes, "provao-container", "finalizar-provao-btn");
}

// ======================
// RENDER PROVA
// ======================
function renderProva(lista, containerId, btnId) {
  const container = el(containerId);
  container.innerHTML = "";

  lista.forEach((q, i) => {
    container.innerHTML += `
      <div class="questao">
        <p><b>Q${i + 1}</b> ${q.enunciado}</p>

        ${Object.entries(q.opcoes).map(([l, t]) => `
          <div onclick="selecionar(${i}, '${l}', this)">
            ${l}) ${t}
          </div>
        `).join("")}
      </div>
    `;
  });

  el(btnId)?.classList.remove("hidden");
}

// ======================
// SELEÇÃO
// ======================
function selecionar(index, letra, elClicked) {
  if (respostasUser[index] !== undefined) return;

  respostasUser[index] = letra;

  const all = elClicked.parentElement.querySelectorAll("div");

  all.forEach(a => {
    a.onclick = null;
    a.style.opacity = a === elClicked ? "1" : "0.4";
  });
}

// ======================
// SALVAR
// ======================
async function salvarResultado() {
  const respostas = questoes.map((q, i) => ({
    correta: q.correta,
    selecionada: respostasUser[i] || null
  }));

  const res = await fetch(`${API}/salvar-prova`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ prova_id: provaId, questoes: respostas })
  });

  const data = await res.json();

  el("final-screen").classList.remove("hidden");

  el("final-text").innerHTML = `
    <p>Acertos: ${data.acertos}</p>
    <p>Percentual: ${data.percentual.toFixed(1)}%</p>
  `;

  carregarDashboard();
  carregarRanking();
  carregarGrafico();
}

// ======================
// REDAÇÃO
// ======================
async function corrigirRedacao() {
  const tema = el("tema-redacao").value;
  const texto = el("texto-redacao").value;

  const res = await fetch(`${API}/corrigir-redacao`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ tema, texto })
  });

  const data = await res.json();

  el("feedback-redacao").innerText =
    `Nota: ${data.nota_total}\n${data.feedback}`;
}

// ======================
// LOGOUT
// ======================
function configurarLogout() {
  el("logout-btn")?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/login.html";
  });
}
