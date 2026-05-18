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

let perfil = {
  nome: "",
  email: "",
  foto: ""
};

// ======================
// INIT
// ======================
window.addEventListener("DOMContentLoaded", () => {
  iniciarApp();
});

function iniciarApp() {
  configurarAbas();
  configurarBotoes();
  configurarLogout();

  carregarDashboard();
  carregarRanking();
  carregarGrafico();
  carregarDuolingo();
  atualizarStreak();
}

// ======================
// TIMER
// ======================
function iniciarTimer(qtd) {
  pararTimer();

  tempoRestante = qtd * 2 * 60;

  document.getElementById("timer-bar").style.display = "block";

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
  const h = String(Math.floor(tempoRestante / 3600)).padStart(2, "0");
  const m = String(Math.floor((tempoRestante % 3600) / 60)).padStart(2, "0");
  const s = String(tempoRestante % 60).padStart(2, "0");

  document.getElementById("timer").textContent = `${h}:${m}:${s}`;
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
      document.getElementById(alvo).classList.remove("hidden");

      if (alvo !== "enem" && alvo !== "provao") {
        pararTimer();
        document.getElementById("timer-bar").style.display = "none";
      }
    });
  });
}

// ======================
// BOTÕES
// ======================
function configurarBotoes() {
  document.getElementById("gerar-enem-btn").onclick = gerarEnem;
  document.getElementById("gerar-provao-btn").onclick = gerarProvao;

  document.getElementById("finalizar-enem-btn").onclick = salvarResultado;
  document.getElementById("finalizar-provao-btn").onclick = salvarResultado;

  document.getElementById("enviar-redacao").onclick = corrigirRedacao;
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
// RENDER
// ======================
function renderProva(lista, containerId, btnFinalizar) {
  const container = document.getElementById(containerId);
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

  document.getElementById(btnFinalizar).classList.remove("hidden");
}

// ======================
// SELEÇÃO
// ======================
function selecionar(index, letra, el) {
  if (respostasUser[index] !== undefined) return;

  respostasUser[index] = letra;

  const all = el.parentElement.querySelectorAll(".alternativa");

  all.forEach(a => {
    a.onclick = null;
    a.classList.add(a === el ? "correct" : "wrong");
  });
}

// ======================
// FINALIZAR
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
  animarXP(data.acertos * 10);

  document.getElementById("finalizar-enem-btn").classList.add("hidden");
  document.getElementById("finalizar-provao-btn").classList.add("hidden");

  mostrarFinal(data);

  carregarDashboard();
  carregarRanking();
  carregarGrafico();
}

// ======================
// FINAL SCREEN
// ======================
function mostrarFinal(data) {
  document.getElementById("final-screen").classList.remove("hidden");

  document.getElementById("final-text").innerHTML = `
    <p>Acertos: ${data.acertos}</p>
    <p>Percentual: ${data.percentual.toFixed(1)}%</p>
  `;
}

// ======================
// XP
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

  document.getElementById("xp-total").innerText = xpAtual;
  document.getElementById("nivel-user").innerText = nivelAtual;
  document.getElementById("xp-bar-fill").style.width = `${xpNivel}%`;
}

// ======================
// PERFIL (CORRIGIDO)
// ======================
function abrirPerfil() {
  document.getElementById("profile-modal").classList.remove("hidden");
  carregarPerfil();
}

function fecharPerfil() {
  document.getElementById("profile-modal").classList.add("hidden");
}

async function carregarPerfil() {
  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  perfil = data;

  document.getElementById("profile-avatar").src = data.foto || "default.png";
  document.getElementById("profile-preview").src = data.foto || "default.png";

  document.getElementById("nome-input").value = data.nome || "";
  document.getElementById("email-input").value = data.email || "";
}

document.getElementById("foto-input").addEventListener("change", function () {
  const file = this.files[0];
  const reader = new FileReader();

  reader.onload = e => {
    document.getElementById("profile-preview").src = e.target.result;
    perfil.foto = e.target.result;
  };

  reader.readAsDataURL(file);
});

async function salvarPerfil() {
  const res = await fetch(`${API}/atualizar-perfil`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(perfil)
  });

  const data = await res.json();

  alert("Perfil atualizado!");
  fecharPerfil();
}

// ======================
// RESTO (mantém igual)
// ======================
function atualizarStreak() {
  const hoje = new Date().toDateString();
  let streak = Number(localStorage.getItem("streak") || 0);

  document.getElementById("streak-days").innerText = `${streak} dias 🔥`;
}
