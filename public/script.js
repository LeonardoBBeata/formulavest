const API = "https://formulavest.onrender.com";

console.log("APP JS CARREGADO");

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/login.html";
}

let questoes = [];

window.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logout-btn");
  const gerarBtn = document.getElementById("gerar-btn");
  const finalizarBtn = document.getElementById("finalizar-btn");

  // ======================
  // TROCAR ABAS
  // ======================
  const menuItems = document.querySelectorAll(".sidebar li");
  const sections = document.querySelectorAll(".section");

  menuItems.forEach(item => {
    item.addEventListener("click", () => {
      const alvo = item.dataset.section;

      menuItems.forEach(i =>
        i.classList.remove("active")
      );

      sections.forEach(sec =>
        sec.classList.add("hidden")
      );

      item.classList.add("active");

      document
        .getElementById(alvo)
        .classList.remove("hidden");
    });
  });

  // ======================
  // LOGOUT
  // ======================
  logoutBtn.onclick = () => {
    localStorage.clear();
    window.location.href = "/login.html";
  };

  // ======================
  // GERAR PROVA
  // ======================
  gerarBtn.onclick = async () => {
    try {
      const faculdade =
        document.getElementById("faculdade").value;

      const curso =
        document.getElementById("curso").value;

      const quantidade =
        document.getElementById("quantidade").value || 10;

      const res = await fetch(
        `${API}/gerar-prova`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            faculdade,
            curso,
            quantidade
          })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      renderProva(data.questoes);

    } catch (err) {
      console.error(err);
      alert("Erro gerar prova");
    }
  };

  // ======================
  // FINALIZAR
  // ======================
  finalizarBtn.onclick = async () => {
    try {
      const respostas = questoes.map((q, i) => {
        const marcada = document.querySelector(
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
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            questoes: respostas
          })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      alert(
        `Acertos: ${data.acertos}\nPercentual: ${data.percentual.toFixed(1)}%`
      );

    } catch (err) {
      console.error(err);
      alert("Erro ao finalizar");
    }
  };
});

function renderProva(lista) {
  questoes = lista;

  const container =
    document.getElementById(
      "prova-container"
    );

  container.innerHTML = lista
    .map(
      (q, i) => `
      <div class="questao">
        <h3>Q${i + 1}</h3>
        <p>${q.enunciado}</p>

        ${Object.entries(q.opcoes)
          .map(
            ([letra, texto]) => `
            <label class="alternativa">
              ${letra}) ${texto}
              <input
                type="radio"
                name="q${i}"
                value="${letra}"
              >
            </label>
          `
          )
          .join("")}
      </div>
    `
    )
    .join("");

  document
    .getElementById("finalizar-btn")
    .classList.remove("hidden");
}
