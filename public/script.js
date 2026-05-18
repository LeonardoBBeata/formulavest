const API = "https://formulavest.onrender.com";
const token = localStorage.getItem("token");

if (!token) window.location.href = "/login.html";

// ======================
// ESTADO GLOBAL
// ======================
let questoes = [];
let provaId = null;
let respostasUser = {};
let grafico = null;

let timerInterval = null;
let tempoRestante = 0;

let xpAtual = 0;
let nivelAtual = 1;

let rankingData = [];
let dashboardData = null;

// ======================
// INIT
// ======================
window.addEventListener("DOMContentLoaded", () => {
  iniciarApp();
});

function iniciarApp() {
  configurarAbas();
  configurarBotoes();
  configurarLogoutSafe();

  carregarDashboard();
  carregarRanking();
  carregarGrafico();
  carregarDuolingo();
  atualizarStreak();
}

// ======================
// SAFE GET ELEMENT
// ======================
const el = (id) => document.getElementById(id);

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

      const sec = el(alvo);
      if (sec) sec.classList.remove("hidden");

      if (alvo !== "enem" && alvo !== "provao") {
        pararTimer();
        el("timer-bar")?.classList.add("hidden");
      }
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

    dashboardData = await res.json();

    atualizarDashboardUI();
  } catch (err) {
    console.error("Erro dashboard:", err);
  }
}

function atualizarDashboardUI() {
  if (!dashboardData) return;

  el("total-provas") && (el("total-provas").innerText = dashboardData.total_provas);
  el("media-acertos") && (el("media-acertos").innerText = dashboardData.media_acertos + "%");
  el("melhor-score") && (el("melhor-score").innerText = dashboardData.melhor_score);
}

// ======================
// RANKING
// ======================
async function carregarRanking() {
  try {
    const res = await fetch(`${API}/ranking`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    rankingData = await res.json();

    renderRanking();
  } catch (err) {
    console.error("Erro ranking:", err);
  }
}

function renderRanking() {
  const container = el("ranking-list");
  if (!container) return;

  container.innerHTML = "";

  rankingData.forEach((user, i) => {
    container.innerHTML += `
      <div class="ranking-item">
        <b>${i + 1}º</b> - ${user.nome}
        <span>${user.xp} XP</span>
      </div>
    `;
  });
}

// ======================
// GRÁFICO (Chart.js)
// ======================
async function carregarGrafico() {
  try {
    const res = await fetch(`${API}/grafico`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    renderGrafico(data);
  } catch (err) {
    console.error("Erro gráfico:", err);
  }
}

function renderGrafico(data) {
  const ctx = el("grafico");

  if (!ctx) return;

  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [{
        label: "Acertos",
        data: data.valores,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      }
    }
  });
}

// ======================
// PROVAS
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

  renderProva(data.questoes, "enem-container", "finalizar-enem-btn");
  iniciarTimer(data.questoes.length);
}

async function gerarProvao() {
  const res = await fetch(`${API}/gerar-provao`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  questoes = data.questoes;
  provaId = data.prova_id;
  respostasUser = {};

  renderProva(data.questoes, "provao-container", "finalizar-provao-btn");
  iniciarTimer(data.questoes.length);
}

// ======================
// RENDER PROVA
// ======================
function renderProva(lista, containerId, btnFinalizar) {
  const container = el(containerId);
  if (!container) return;

  container.innerHTML = "";

  lista.forEach((q, i) => {
    container.innerHTML += `
      <div class="questao">
        <p><b>Questão ${i + 1}</b></p>
        <p>${q.enunciado}</p>

        <div class="alternativas">
          ${Object.entries(q.opcoes).map(([l, t]) => `
            <div class="alternativa" onclick="selecionar(${i}, '${l}', this)">
              ${l}) ${t}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  });

  el(btnFinalizar)?.classList.remove("hidden");
}

// ======================
// SELEÇÃO
// ======================
function selecionar(index, letra, elClicked) {
  if (respostasUser[index] !== undefined) return;

  respostasUser[index] = letra;

  const all = elClicked.parentElement.querySelectorAll(".alternativa");

  all.forEach(a => {
    a.onclick = null;
    a.classList.add(a === elClicked ? "correct" : "wrong");
  });
}

// ======================
// SALVAR RESULTADO
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

  pararTimer();

  animarXP?.(data.acertos * 10);

  el("finalizar-enem-btn")?.classList.add("hidden");
  el("finalizar-provao-btn")?.classList.add("hidden");

  mostrarFinal(data);

  carregarDashboard();
  carregarRanking();
  carregarGrafico();
}

// ======================
// TIMER
// ======================
function iniciarTimer(qtd) {
  pararTimer();

  tempoRestante = qtd * 2 * 60;

  el("timer-bar")?.classList.remove("hidden");

  atualizarTimer();

  timerInterval = setInterval(() => {
    tempoRestante--;
    atualizarTimer();

    if (tempoRestante <= 0) {
      pararTimer();
      salvarResultado();
    }
  }, 1000);
}

function pararTimer() {
  clearInterval(timerInterval);
}

function atualizarTimer() {
  const t = el("timer");
  if (!t) return;

  const h = String(Math.floor(tempoRestante / 3600)).padStart(2, "0");
  const m = String(Math.floor((tempoRestante % 3600) / 60)).padStart(2, "0");
  const s = String(tempoRestante % 60).padStart(2, "0");

  t.innerText = `${h}:${m}:${s}`;
}

// ======================
// FINAL SCREEN
// ======================
function mostrarFinal(data) {
  el("final-screen")?.classList.remove("hidden");

  el("final-text") && (el("final-text").innerHTML = `
    <p>Acertos: ${data.acertos}</p>
    <p>Percentual: ${data.percentual.toFixed(1)}%</p>
  `);
}

// ======================
// XP / USER
// ======================
async function carregarDuolingo() {
  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const user = await res.json();

  xpAtual = user.xp || 0;
  nivelAtual = user.nivel || 1;

  atualizarUI();
}

function atualizarUI() {
  const xpNivel = xpAtual % 100;

  el("xp-total") && (el("xp-total").innerText = xpAtual);
  el("nivel-user") && (el("nivel-user").innerText = nivelAtual);
  el("xp-bar-fill") && (el("xp-bar-fill").style.width = `${xpNivel}%`);
}

// ======================
// STREAK
// ======================
function atualizarStreak() {
  const streak = Number(localStorage.getItem("streak") || 0);
  el("streak-days") && (el("streak-days").innerText = `${streak} dias 🔥`);
}

// ======================
// PLACEHOLDERS (evita crash)
// ======================
function configurarLogoutSafe() {}
function carregarRankingSafe() {}
function carregarDashboardSafe() {}
function carregarGraficoSafe() {}
