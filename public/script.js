const API = "https://formulavest.onrender.com";

const token = localStorage.getItem("token");

window.addEventListener("DOMContentLoaded", () => {
  // se não estiver logado, só bloqueia app (não quebra login page)
  if (!token && window.location.pathname !== "/login.html") {
    window.location.href = "/login.html";
    return;
  }

  // ======================
  // ELEMENTOS SEGURADOS
  // ======================
  const logoutBtn = document.getElementById("logout-btn");
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const gerarBtn = document.getElementById("gerar-btn");
  const finalizarBtn = document.getElementById("finalizar-btn");
  const enemBtn = document.getElementById("enem-btn");

  // ======================
  // LOGOUT
  // ======================
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login.html";
    };
  }

  // ======================
  // MOBILE MENU
  // ======================
  const sidebar = document.querySelector(".sidebar");

  if (mobileBtn && sidebar) {
    mobileBtn.onclick = () => {
      sidebar.classList.toggle("open");
    };
  }

  // ======================
  // GERAR PROVA
  // ======================
  if (gerarBtn) {
    gerarBtn.onclick = async () => {
      try {
        const faculdade = document.getElementById("faculdade").value;
        const curso = document.getElementById("curso").value;
        const quantidade =
          document.getElementById("quantidade").value || 10;

        const res = await fetch(`${API}/gerar-prova`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ faculdade, curso, quantidade })
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.error || "Erro ao gerar prova");
          return;
        }

        renderProva(data.questoes);
      } catch (err) {
        console.error(err);
        alert("Erro ao gerar prova");
      }
    };
  }

  // ======================
  // FINALIZAR PROVA
  // ======================
  if (finalizarBtn) {
    finalizarBtn.onclick = async () => {
      try {
        const respostas = questoes.map((q, i) => {
          const marcada = document.querySelector(
            `input[name="q${i}"]:checked`
          );

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
          body: JSON.stringify({ questoes: respostas })
        });

        const data = await res.json();

        alert(
          `Acertos: ${data.acertos}\nPercentual: ${data.percentual.toFixed(
            1
          )}%`
        );
      } catch (err) {
        console.error(err);
        alert("Erro ao finalizar prova");
      }
    };
  }
});

// ======================
// PROVA GLOBAL
// ======================
let questoes = [];

function renderProva(qs) {
  questoes = qs;

  const container = document.getElementById("prova-container");

  if (!container) return;

  container.innerHTML = qs
    .map(
      (q, i) => `
    <div class="questao">
      <h3>Q${i + 1}</h3>
      <p>${q.enunciado}</p>

      ${Object.entries(q.opcoes)
        .map(
          ([letra, texto]) => `
        <label>
          ${letra}) ${texto}
          <input type="radio" name="q${i}" value="${letra}">
        </label>
      `
        )
        .join("")}
    </div>
  `
    )
    .join("");

  const btn = document.getElementById("finalizar-btn");
  if (btn) btn.classList.remove("hidden");
}
