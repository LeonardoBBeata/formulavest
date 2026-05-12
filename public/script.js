const API = "https://formulavest.onrender.com";
const token = localStorage.getItem("token");

console.log("APP JS CARREGADO");

// se não tiver token → login
if (!token) {
  window.location.href = "/login.html";
}

let questoes = [];

window.addEventListener("DOMContentLoaded", () => {
  const logoutBtn =
    document.getElementById("logout-btn");

  const gerarBtn =
    document.getElementById("gerar-btn");

  const finalizarBtn =
    document.getElementById("finalizar-btn");

  // ======================
  // LOGOUT
  // ======================
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.clear();
      window.location.href =
        "/login.html";
    };
  }

  // ======================
  // GERAR PROVA
  // ======================
  if (gerarBtn) {
    gerarBtn.onclick = async () => {
      try {
        const faculdade =
          document.getElementById(
            "faculdade"
          ).value;

        const curso =
          document.getElementById(
            "curso"
          ).value;

        const quantidade =
          document.getElementById(
            "quantidade"
          ).value || 10;

        const res = await fetch(
          `${API}/gerar-prova`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`
            },
            body: JSON.stringify({
              faculdade,
              curso,
              quantidade
            })
          }
        );

        const data =
          await res.json();

        if (!res.ok) {
          alert(data.error);
          return;
        }

        renderProva(
          data.questoes
        );

      } catch (err) {
        console.error(err);
        alert(
          "Erro ao gerar prova"
        );
      }
    };
  }

  // ======================
  // FINALIZAR
  // ======================
  if (finalizarBtn) {
    finalizarBtn.onclick =
      async () => {
        try {
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
                method:
                  "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                  Authorization:
                    `Bearer ${token}`
                },
                body: JSON.stringify(
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
            alert(
              data.error
            );
            return;
          }

          alert(
            `Acertos: ${data.acertos}\nPercentual: ${data.percentual.toFixed(
              1
            )}%`
          );

        } catch (err) {
          console.error(err);
          alert(
            "Erro ao finalizar"
          );
        }
      };
  }
});

function renderProva(qs) {
  questoes = qs;

  const container =
    document.getElementById(
      "prova-container"
    );

  if (!container) return;

  container.innerHTML =
    qs
      .map(
        (q, i) => `
      <div class="questao">
        <h3>Q${i + 1}</h3>
        <p>${q.enunciado}</p>

        ${Object.entries(
          q.opcoes
        )
          .map(
            (
              [letra, texto]
            ) => `
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
    .getElementById(
      "finalizar-btn"
    )
    .classList.remove(
      "hidden"
    );
}
