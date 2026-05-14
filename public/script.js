const API = "https://formulavest.onrender.com";

console.log("APP JS CARREGADO");

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/login.html";
}

let questoes = [];

window.addEventListener("DOMContentLoaded", () => {
  // ======================
  // ELEMENTOS
  // ======================
  const logoutBtn = document.getElementById("logout-btn");

  const gerarEnemBtn =
    document.getElementById(
      "gerar-enem-btn"
    );

  const gerarProvaoBtn =
    document.getElementById(
      "gerar-provao-btn"
    );

  const finalizarEnemBtn =
    document.getElementById(
      "finalizar-enem-btn"
    );

  const finalizarProvaoBtn =
    document.getElementById(
      "finalizar-provao-btn"
    );

  const enviarRedacaoBtn =
    document.getElementById(
      "enviar-redacao"
    );

  // ======================
  // TROCAR ABAS
  // ======================
  const menuItems =
    document.querySelectorAll(
      ".sidebar li"
    );

  const sections =
    document.querySelectorAll(
      ".section"
    );

  menuItems.forEach(item => {
    item.addEventListener(
      "click",
      () => {
        const alvo =
          item.dataset.section;

        menuItems.forEach(i =>
          i.classList.remove(
            "active"
          )
        );

        sections.forEach(sec =>
          sec.classList.add(
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
  });

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
  // GERAR ENEM
  // ======================
  if (gerarEnemBtn) {
    gerarEnemBtn.onclick =
      async () => {
        try {
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
            alert(
              data.error
            );
            return;
          }

          renderProva(
            data.questoes,
            "enem-container",
            "finalizar-enem-btn"
          );

        } catch (err) {
          console.error(
            err
          );

          alert(
            "Erro ao gerar ENEM"
          );
        }
      };
  }

  // ======================
  // GERAR PROVÃO
  // ======================
  if (gerarProvaoBtn) {
    gerarProvaoBtn.onclick =
      async () => {
        try {
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
            alert(
              data.error
            );
            return;
          }

          renderProva(
            data.questoes,
            "provao-container",
            "finalizar-provao-btn"
          );

        } catch (err) {
          console.error(
            err
          );

          alert(
            "Erro ao gerar Provão"
          );
        }
      };
  }

  // ======================
  // FINALIZAR ENEM
  // ======================
  if (finalizarEnemBtn) {
    finalizarEnemBtn.onclick =
      salvarResultado;
  }

  // ======================
  // FINALIZAR PROVÃO
  // ======================
  if (finalizarProvaoBtn) {
    finalizarProvaoBtn.onclick =
      salvarResultado;
  }

  // ======================
  // CORRIGIR REDAÇÃO
  // ======================
  if (enviarRedacaoBtn) {
    enviarRedacaoBtn.onclick =
      async () => {
        try {
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
                method:
                  "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                  Authorization:
                    `Bearer ${token}`
                },
                body:
                  JSON.stringify(
                    {
                      tema,
                      texto
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

          document.getElementById(
            "feedback-redacao"
          ).innerHTML = `
            <div class="card">
              <h3>Nota Final: ${data.nota_total}</h3>
              <p>${data.feedback}</p>
            </div>
          `;

        } catch (err) {
          console.error(
            err
          );

          alert(
            "Erro ao corrigir redação"
          );
        }
      };
  }
});

// ======================
// RENDERIZAR PROVA
// ======================
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

  container.innerHTML =
    lista
      .map(
        (q, i) => `
      <div class="questao">
        <h3>Q${i + 1}</h3>

        <p>${q.enunciado}</p>

        ${Object.entries(
          q.opcoes
        )
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
    .getElementById(
      finalizarId
    )
    .classList.remove(
      "hidden"
    );
}

// ======================
// SALVAR RESULTADO
// ======================
async function salvarResultado() {
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
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`
          },
          body:
            JSON.stringify({
              questoes:
                respostas
            })
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
      "Erro ao salvar prova"
    );
  }
}
