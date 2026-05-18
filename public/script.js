const API = "https://formulavest.onrender.com";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/login.html";
}

let questoes = [];
let provaId = null;
let grafico = null;

let xpAtual = 0;
let nivelAtual = 1;

window.addEventListener("DOMContentLoaded", iniciarApp);

function iniciarApp() {
  configurarAbas();
  configurarLogout();
  configurarBotoes();
  carregarDashboard();
  carregarRanking();
  carregarGrafico();
  carregarDuolingo();
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
   DUOLINGO XP SYSTEM
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

  const xpTotalEl = document.getElementById("xp-total");
  const nivelEl = document.getElementById("nivel-user");
  const barra = document.getElementById("xp-bar-fill");
  const xpNext = document.getElementById("xp-next");

  if (xpTotalEl) xpTotalEl.innerText = xpAtual;
  if (nivelEl) nivelEl.innerText = nivelAtual;

  if (barra) {
    barra.style.width = `${(xpNivel / 100) * 100}%`;
  }

  if (xpNext) {
    xpNext.innerText = `${100 - xpNivel} XP para próximo nível`;
  }
}

async function animarXP(ganho) {
  const popup = document.getElementById("xp-popup");

  if (popup) {
    popup.innerText = `+${ganho} XP`;
    popup.classList.remove("hidden");

    setTimeout(() => popup.classList.add("hidden"), 1000);
  }

  // atualiza backend
  const res = await fetch(`${API}/add-xp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ xp: ganho })
  });

  const data = await res.json();
  if (!res.ok) return console.log(data.error);

  xpAtual = data.xp;
  nivelAtual = data.nivel;

  atualizarUI();
  checarLevelUp();
}

function checarLevelUp() {
  const novoNivel = Math.floor(xpAtual / 100) + 1;

  if (novoNivel > nivelAtual) {
    nivelAtual = novoNivel;

    const el = document.getElementById("nivel-user");
    if (!el) return;

    el.classList.add("level-up");

    setTimeout(() => {
      el.classList.remove("level-up");
    }, 800);
  }
}

function atualizarStreak() {
  const hoje = new Date().toDateString();
  const ultimo = localStorage.getItem("lastStudyDay");

  let streakAtual = Number(localStorage.getItem("streak") || 0);

  if (ultimo !== hoje) {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);

    if (ultimo === ontem.toDateString()) {
      streakAtual++;
    } else {
      streakAtual = 1;
    }

    localStorage.setItem("lastStudyDay", hoje);
    localStorage.setItem("streak", streakAtual);
  }

  const el = document.getElementById("streak-days");
  if (el) el.innerText = `${streakAtual} dias 🔥`;
}

/* ======================
   LOGOUT
====================== */
function configurarLogout() {
  document.getElementById("logout-btn").onclick = () => {
    localStorage.clear();
    window.location.href = "/login.html";
  };
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

  renderProva(data.questoes, "provao-container", "finalizar-provao-btn");
}

/* ======================
   RENDER PROVA
====================== */
function renderProva(lista, containerId, finalizarId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  lista.forEach((q, i) => {
    container.innerHTML += `
      <div class="questao">
        <p><b>Questão ${i + 1}</b></p>
        <p>${q.enunciado}</p>

        ${Object.entries(q.opcoes).map(([letra, texto]) => `
          <label>
            <input type="radio" name="q${i}" value="${letra}">
            ${letra}) ${texto}
          </label>
        `).join("")}
      </div>
    `;
  });

  document.getElementById(finalizarId).classList.remove("hidden");
}

/* ======================
   SALVAR PROVA (FIX PRINCIPAL)
====================== */
async function salvarResultado() {
  const respostas = questoes.map((q, i) => {
    const marcada = document.querySelector(`input[name="q${i}"]:checked`);

    return {
      correta: q.correta,
      selecionada: marcada ? marcada.value : null
    };
  });

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

  document.querySelectorAll('input[type="radio"]').forEach(i => i.disabled = true);

  document.getElementById("finalizar-enem-btn").classList.add("hidden");
  document.getElementById("finalizar-provao-btn").classList.add("hidden");

  alert(`Acertos: ${data.acertos}\nPercentual: ${data.percentual.toFixed(1)}%`);

  await carregarDashboard();
  await carregarRanking();
  await carregarGrafico();

  mostrarDashboard();
}

/* ======================
   DASHBOARD
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

/* ======================
   RANKING
====================== */
async function carregarRanking() {
  const res = await fetch(`${API}/ranking`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  if (!res.ok) return console.log(data.error);

  const ranking = data.ranking || [];
  const meuNome = localStorage.getItem("username");

  document.getElementById("top3").innerHTML =
    ranking.slice(0, 3).map((u, i) => `
      <div class="top-card">
        <div>#${i + 1}</div>
        <div>${u.username}</div>
        <div>${u.xp} XP</div>
      </div>
    `).join("");

  document.getElementById("ranking-list").innerHTML =
    ranking.map((u, i) => `
      <div class="${u.username === meuNome ? "me" : ""}">
        #${i + 1} - ${u.username} - ${u.xp} XP
      </div>
    `).join("");
}

/* ======================
   GRÁFICO
====================== */
async function carregarGrafico() {
  const res = await fetch(`${API}/provas`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  if (!data.provas) return;

  let xp = 0;
  const labels = [];
  const valores = [];

  data.provas.reverse().forEach((p, i) => {
    xp += Math.floor(p.percentual);
    labels.push(`Prova ${i + 1}`);
    valores.push(xp);
  });

  const ctx = document.getElementById("graficoEvolucao");
  if (!ctx) return;

  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "XP",
        data: valores,
        borderWidth: 3,
        tension: 0.3
      }]
    }
  });
}

/* ======================
   REDAÇÃO
====================== */
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

/* ======================
   DASHBOARD NAV
====================== */
function mostrarDashboard() {
  document.querySelectorAll(".sidebar li").forEach(li => li.classList.remove("active"));
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));

  document.querySelector('[data-section="dashboard"]').classList.add("active");
  document.getElementById("dashboard").classList.remove("hidden");
}
