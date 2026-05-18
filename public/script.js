const API = "https://formulavest.onrender.com";
const token = localStorage.getItem("token");

if (!token) window.location.href = "/login.html";

let questoes = [];
let provaId = null;
let grafico = null;

let respostasUser = {};
let tempo = 180 * 60;

let xpAtual = 0;
let nivelAtual = 1;

/* INIT */
window.addEventListener("DOMContentLoaded", () => {
  iniciarApp();
});

function iniciarApp() {
  configurarAbas();
  configurarLogout();
  configurarBotoes();
  carregarDashboard();
  carregarRanking();
  carregarGrafico();
  carregarDuolingo();
  iniciarTimer();
}

/* TIMER */
function iniciarTimer() {
  setInterval(() => {
    const h = String(Math.floor(tempo / 3600)).padStart(2, "0");
    const m = String(Math.floor((tempo % 3600) / 60)).padStart(2, "0");
    const s = String(tempo % 60).padStart(2, "0");

    document.getElementById("timer").innerText = `${h}:${m}:${s}`;

    if (tempo > 0) tempo--;
    else finalizarAutomatico();

  }, 1000);
}

function finalizarAutomatico() {
  if (questoes.length > 0) salvarResultado();
}

/* ABAS */
function configurarAbas() {
  document.querySelectorAll(".sidebar li").forEach(item => {
    item.addEventListener("click", () => {
      const alvo = item.dataset.section;

      document.querySelectorAll(".sidebar li").forEach(i => i.classList.remove("active"));
      document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));

      item.classList.add("active");
      document.getElementById(alvo).classList.remove("hidden");
    });
  });
}

/* BOTÕES */
function configurarBotoes() {
  document.getElementById("gerar-enem-btn").onclick = gerarEnem;
  document.getElementById("gerar-provao-btn").onclick = gerarProvao;
  document.getElementById("finalizar-enem-btn").onclick = salvarResultado;
  document.getElementById("finalizar-provao-btn").onclick = salvarResultado;
  document.getElementById("enviar-redacao").onclick = corrigirRedacao;
}

/* PROVAS */
async function gerarEnem() {
  const res = await fetch(`${API}/gerar-enem`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  provaId = data.prova_id;
  questoes = data.questoes;
  respostasUser = {};

  renderProva(data.questoes, "enem-container", "finalizar-enem-btn");
}

async function gerarProvao() {
  const res = await fetch(`${API}/gerar-provao`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  provaId = data.prova_id;
  questoes = data.questoes;
  respostasUser = {};

  renderProva(data.questoes, "provao-container", "finalizar-provao-btn");
}

/* RENDER */
function renderProva(lista, containerId, finalizarId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  lista.forEach((q, i) => {
    container.innerHTML += `
      <div class="questao">
        <p><b>Questão ${i + 1}</b></p>
        <p>${q.enunciado}</p>

        <div class="alternativas">
          ${Object.entries(q.opcoes).map(([letra, texto]) => `
            <div class="alternativa" onclick="selecionar(${i}, '${letra}', this)">
              <span>${letra}) ${texto}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  });

  document.getElementById(finalizarId).classList.remove("hidden");
}

/* SELEÇÃO */
function selecionar(qIndex, letra, el) {
  if (respostasUser[qIndex] !== undefined) return;

  respostasUser[qIndex] = letra;

  const todas = el.parentElement.querySelectorAll(".alternativa");

  todas.forEach(a => {
    a.onclick = null;

    if (a === el) a.classList.add("correct");
    else a.classList.add("wrong");
  });
}

/* FINALIZAR */
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

  animarXP(data.acertos * 10);

  document.querySelectorAll("input").forEach(i => i.disabled = true);

  document.getElementById("finalizar-enem-btn").classList.add("hidden");
  document.getElementById("finalizar-provao-btn").classList.add("hidden");

  mostrarFinal(data);

  carregarDashboard();
  carregarRanking();
  carregarGrafico();
}

/* FINAL SCREEN */
function mostrarFinal(data) {
  document.getElementById("final-screen").classList.remove("hidden");

  document.getElementById("final-text").innerHTML = `
    <p>Acertos: ${data.acertos}</p>
    <p>Percentual: ${data.percentual.toFixed(1)}%</p>
  `;
}

function fecharFinal() {
  document.getElementById("final-screen").classList.add("hidden");
}

/* XP */
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
  const nivel = xpAtual / 100;

  document.getElementById("xp-total").innerText = xpAtual;
  document.getElementById("nivel-user").innerText = Math.floor(nivelAtual);

  const xpNivel = xpAtual % 100;

  document.getElementById("xp-bar-fill").style.width = `${xpNivel}%`;

  document.getElementById("xp-next").innerText =
    `${100 - xpNivel} XP para próximo nível`;
}

async function animarXP(ganho) {
  const popup = document.getElementById("xp-popup");

  popup.innerText = `+${ganho} XP`;
  popup.classList.remove("hidden");

  setTimeout(() => popup.classList.add("hidden"), 1000);

  const res = await fetch(`${API}/add-xp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ xp: ganho })
  });

  const data = await res.json();

  xpAtual = data.xp;
  nivelAtual = data.nivel;

  atualizarUI();
}

/* STREAK */
function atualizarStreak() {
  const hoje = new Date().toDateString();
  const ultimo = localStorage.getItem("lastStudyDay");

  let streak = Number(localStorage.getItem("streak") || 0);

  if (ultimo !== hoje) {
    streak = (ultimo === new Date(Date.now() - 86400000).toDateString()) ? streak + 1 : 1;

    localStorage.setItem("streak", streak);
    localStorage.setItem("lastStudyDay", hoje);
  }

  document.getElementById("streak-days").innerText = `${streak} dias 🔥`;
}

/* DASHBOARD */
async function carregarDashboard() {
  const res = await fetch(`${API}/provas`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  const div = document.getElementById("dashboard-container");

  if (!data.provas?.length) {
    div.innerHTML = "<p>Nenhuma prova feita.</p>";
    return;
  }

  const total = data.provas.length;
  const media = data.provas.reduce((a, p) => a + p.percentual, 0) / total;

  div.innerHTML = `
    <div class="card">Total: ${total}</div>
    <div class="card">Média: ${media.toFixed(1)}%</div>
  `;
}

/* RANKING */
async function carregarRanking() {
  const res = await fetch(`${API}/ranking`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  const top3 = document.getElementById("top3");
  const list = document.getElementById("ranking-list");

  top3.innerHTML = data.ranking.slice(0, 3).map((u, i) => `
    <div class="top-card">${i + 1}º ${u.username} - ${u.xp}</div>
  `).join("");

  list.innerHTML = data.ranking.map((u, i) => `
    <div class="ranking-item">${i + 1} - ${u.username} - ${u.xp}</div>
  `).join("");
}

/* GRAFICO */
async function carregarGrafico() {
  const res = await fetch(`${API}/provas`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  let xp = 0;
  const labels = [];
  const valores = [];

  data.provas.reverse().forEach((p, i) => {
    xp += Math.floor(p.percentual);
    labels.push("Prova " + (i + 1));
    valores.push(xp);
  });

  const ctx = document.getElementById("graficoEvolucao");

  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: valores,
        borderWidth: 3
      }]
    }
  });
}

/* REDAÇÃO */
async function corrigirRedacao() {
  const tema = document.getElementById("tema-redacao").value;
  const texto = document.getElementById("texto-redacao").value;

  const res = await fetch(`${API}/corrigir-redacao`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ tema, texto })
  });

  const data = await res.json();

  document.getElementById("feedback-redacao").innerHTML = `
    <div class="card">
      <h3>Nota: ${data.nota_total}</h3>
      <p>${data.feedback}</p>
    </div>
  `;
}
