const API = "https://formulavest.onrender.com";
const token = localStorage.getItem("token");

if (!token) window.location.href = "/login.html";

let questoes = [];
let provaId = null;
let grafico = null;

let respostasUser = {};
let tempo = 180 * 60; // 3h ENEM

let xpAtual = 0;
let nivelAtual = 1;

/* ======================
   INIT
====================== */
window.addEventListener("DOMContentLoaded", iniciarApp);

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

/* ======================
   TIMER ENEM
====================== */
function iniciarTimer() {
  setInterval(() => {
    const h = String(Math.floor(tempo / 3600)).padStart(2, '0');
    const m = String(Math.floor((tempo % 3600) / 60)).padStart(2, '0');
    const s = String(tempo % 60).padStart(2, '0');

    const el = document.getElementById("timer");
    if (el) el.innerText = `${h}:${m}:${s}`;

    if (tempo > 0) tempo--;
    else finalizarAutomatico();

  }, 1000);
}

function finalizarAutomatico() {
  if (questoes.length > 0) {
    salvarResultado();
    alert("Tempo esgotado! Prova finalizada automaticamente.");
  }
}

/* ======================
   ABAS
====================== */
function configurarAbas() {
  const menuItems = document.querySelectorAll(".sidebar li");
  const sections = document.querySelectorAll(".section");

  menuItems.forEach(item => {
    item.addEventListener("click", () => {
      const alvo = item.dataset.section;

      menuItems.forEach(i => i.classList.remove("active"));
      sections.forEach(s => s.classList.add("hidden"));

      item.classList.add("active");
      document.getElementById(alvo).classList.remove("hidden");
    });
  });
}

/* ======================
   BOTÕES
====================== */
function configurarBotoes() {
  document.getElementById("gerar-enem-btn").onclick = gerarEnem;
  document.getElementById("gerar-provao-btn").onclick = gerarProvao;
  document.getElementById("finalizar-enem-btn").onclick = salvarResultado;
  document.getElementById("finalizar-provao-btn").onclick = salvarResultado;
  document.getElementById("enviar-redacao").onclick = corrigirRedacao;
}

/* ======================
   GERAR PROVAS
====================== */
async function gerarEnem() {
  const res = await fetch(`${API}/gerar-enem`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error);

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
  if (!res.ok) return alert(data.error);

  provaId = data.prova_id;
  questoes = data.questoes;
  respostasUser = {};

  renderProva(data.questoes, "provao-container", "finalizar-provao-btn");
}

/* ======================
   RENDER PROVA (ENHANCED)
====================== */
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
              <input type="radio" name="q${i}">
              <span>${letra}) ${texto}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  });

  document.getElementById(finalizarId).classList.remove("hidden");
}

/* ======================
   SELEÇÃO (COM FEEDBACK)
====================== */
function selecionar(qIndex, letra, el) {
  if (respostasUser[qIndex]) return;

  respostasUser[qIndex] = letra;

  const alternativas = el.parentElement.querySelectorAll(".alternativa");

  alternativas.forEach(a => {
    a.onclick = null;

    const span = a.querySelector("span");
    const txt = span.innerText;

    if (a === el) {
      a.classList.add("correct");
    } else {
      a.classList.add("wrong");
    }
  });
}

/* ======================
   SALVAR PROVA
====================== */
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
    body: JSON.stringify({
      prova_id: provaId,
      questoes: respostas
    })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error);

  animarXP(data.acertos * 10);
  atualizarStreak();

  document.querySelectorAll('input').forEach(i => i.disabled = true);

  document.getElementById("finalizar-enem-btn").classList.add("hidden");
  document.getElementById("finalizar-provao-btn").classList.add("hidden");

  mostrarResultadoFinal(data);

  await carregarDashboard();
  await carregarRanking();
  await carregarGrafico();
}

/* ======================
   FINAL SCREEN
====================== */
function mostrarResultadoFinal(data) {
  const box = document.getElementById("final-screen");
  const text = document.getElementById("final-text");

  box.classList.remove("hidden");

  text.innerHTML = `
    <h2>Resultado</h2>
    <p><b>Acertos:</b> ${data.acertos}</p>
    <p><b>Percentual:</b> ${data.percentual.toFixed(1)}%</p>
  `;
}

/* ======================
   XP SYSTEM (TEU ORIGINAL MELHORADO)
====================== */
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

  document.getElementById("xp-total").innerText = xpAtual;
  document.getElementById("nivel-user").innerText = nivelAtual;

  document.getElementById("xp-bar-fill").style.width =
    `${(xpNivel / 100) * 100}%`;

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

/* ======================
   STREAK
====================== */
function atualizarStreak() {
  const hoje = new Date().toDateString();
  const ultimo = localStorage.getItem("lastStudyDay");

  let streak = Number(localStorage.getItem("streak") || 0);

  if (ultimo !== hoje) {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);

    if (ultimo === ontem.toDateString()) streak++;
    else streak = 1;

    localStorage.setItem("lastStudyDay", hoje);
    localStorage.setItem("streak", streak);
  }

  document.getElementById("streak-days").innerText =
    `${streak} dias 🔥`;
}

/* ======================
   DASHBOARD / RANKING / GRAFICO (mantidos)
====================== */
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
    <div class="card"><h3>Total</h3><p>${total}</p></div>
    <div class="card"><h3>Média</h3><p>${media.toFixed(1)}%</p></div>
  `;
}
