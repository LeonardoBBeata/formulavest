const loginBox =
  document.getElementById(
    "login-admin"
  );

const dashBox =
  document.getElementById(
    "admin-dashboard"
  );

const provasContainer =
  document.getElementById(
    "provas-container"
  );

const estatContainer =
  document.getElementById(
    "estatisticas-admin"
  );

const msgAdmin =
  document.getElementById(
    "msg-admin"
  );

let chart = null;
let activeTab = "provas";

window.addEventListener(
  "DOMContentLoaded",
  () => {
    verificarSessao();
    configurarEventos();
  }
);

function configurarEventos() {
  document
    .getElementById(
      "admin-login-btn"
    )
    .onclick = loginAdmin;

  document
    .getElementById(
      "admin-logout"
    )
    .onclick = logoutAdmin;

  document
    .getElementById(
      "criar-usuario-btn"
    )
    .onclick = criarUsuario;

  document
    .getElementById(
      "refresh-provas-btn"
    )
    .onclick = carregarProvas;

  document
    .getElementById(
      "toggle-sidebar"
    )
    .onclick = () => {
      document
        .getElementById(
          "admin-sidebar"
        )
        .classList.toggle(
          "collapsed"
        );
    };

  document
    .getElementById(
      "filtro-usuario"
    )
    .addEventListener(
      "input",
      carregarProvas
    );

  document
    .querySelectorAll(
      ".admin-sidebar li"
    )
    .forEach(li => {
      li.addEventListener(
        "click",
        () => {
          trocarAba(
            li.dataset.section
          );
        }
      );
    });
}

async function verificarSessao() {
  try {
    const res =
      await fetch(
        "/admin-check",
        {
          credentials:
            "include"
        }
      );

    const data =
      await res.json();

    if (data.ok) {
      abrirDashboard();
    }

  } catch {}
}

async function loginAdmin() {
  const email =
    document.getElementById(
      "admin-email"
    ).value;

  const senha =
    document.getElementById(
      "admin-senha"
    ).value;

  const res =
    await fetch(
      "/admin-login",
      {
        method: "POST",
        credentials:
          "include",
        headers: {
          "Content-Type":
            "application/json"
        },
        body:
          JSON.stringify({
            email,
            senha
          })
      }
    );

  const data =
    await res.json();

  if (!res.ok) {
    return alert(
      data.error
    );
  }

  abrirDashboard();
}

async function logoutAdmin() {
  await fetch(
    "/logout",
    {
      method: "POST",
      credentials:
        "include"
    }
  );

  location.reload();
}

function abrirDashboard() {
  loginBox.classList.add(
    "hidden"
  );

  dashBox.classList.remove(
    "hidden"
  );

  atualizarAbaAtual();

  setInterval(
    atualizarAbaAtual,
    5000
  );
}

function trocarAba(tab) {
  activeTab = tab;

  document
    .querySelectorAll(
      ".admin-sidebar li"
    )
    .forEach(li =>
      li.classList.remove(
        "active"
      )
    );

  document
    .querySelector(
      `[data-section="${tab}"]`
    )
    .classList.add(
      "active"
    );

  document
    .querySelectorAll(
      ".admin-section"
    )
    .forEach(sec => {
      sec.classList.add(
        "hidden"
      );
    });

  document
    .getElementById(tab)
    .classList.remove(
      "hidden"
    );

  atualizarAbaAtual();
}

function atualizarAbaAtual() {
  if (
    activeTab === "provas"
  ) carregarProvas();

  if (
    activeTab === "usuarios"
  ) carregarUsuarios();

  if (
    activeTab ===
    "estatisticas"
  ) carregarEstatisticas();
}

async function carregarProvas() {
  const filtro =
    document
      .getElementById(
        "filtro-usuario"
      )
      .value.toLowerCase();

  const res =
    await fetch(
      "/admin/provas",
      {
        credentials:
          "include"
      }
    );

  const data =
    await res.json();

  const provas =
    (data.provas || [])
      .filter(p =>
        p.username
          .toLowerCase()
          .includes(
            filtro
          )
      );

  if (!provas.length) {
    provasContainer.innerHTML =
      "<p>Nenhuma prova.</p>";
    return;
  }

  provasContainer.innerHTML =
    provas.map(
      p => `
    <div class="prova-card">
      <p>
        <strong>
          ${p.username}
        </strong>
      </p>

      <p>
        ${p.acertos}
        /
        ${p.total}
      </p>

      <p>
        ${p.percentual.toFixed(
          1
        )}%
      </p>
    </div>
  `
    ).join("");
}

async function carregarUsuarios() {
  const res =
    await fetch(
      "/admin/usuarios",
      {
        credentials:
          "include"
      }
    );

  const data =
    await res.json();

  const div =
    document.getElementById(
      "lista-usuarios"
    );

  div.innerHTML =
    data.usuarios.map(
      u => `
    <div class="prova-card">
      <p>
        ${u.username}
      </p>

      <button
        onclick="banirUsuario(${u.id})"
      >
        ${
          u.banido
            ? "Desbanir"
            : "Banir"
        }
      </button>

      <button
        onclick="excluirUsuario(${u.id})"
      >
        Excluir
      </button>
    </div>
  `
    ).join("");
}

async function criarUsuario() {
  const username =
    document.getElementById(
      "novo-username"
    ).value;

  const senha =
    document.getElementById(
      "novo-senha"
    ).value;

  const res =
    await fetch(
      "/admin/criar-usuario",
      {
        method: "POST",
        credentials:
          "include",
        headers: {
          "Content-Type":
            "application/json"
        },
        body:
          JSON.stringify({
            username,
            senha
          })
      }
    );

  const data =
    await res.json();

  msgAdmin.innerText =
    data.ok
      ? "Criado!"
      : data.error;

  carregarUsuarios();
}

async function banirUsuario(id) {
  await fetch(
    `/admin/usuario/${id}/banir`,
    {
      method: "PUT",
      credentials:
        "include"
    }
  );

  carregarUsuarios();
}

async function excluirUsuario(id) {
  if (
    !confirm(
      "Excluir usuário?"
    )
  ) return;

  await fetch(
    `/admin/usuario/${id}`,
    {
      method: "DELETE",
      credentials:
        "include"
    }
  );

  carregarUsuarios();
}

async function carregarEstatisticas() {
  const res =
    await fetch(
      "/admin/stats",
      {
        credentials:
          "include"
      }
    );

  const data =
    await res.json();

  estatContainer.innerHTML = `
    <div class="card-estat">
      <h3>
        Total Provas
      </h3>
      <p>
        ${data.totalProvas}
      </p>
    </div>

    <div class="card-estat">
      <h3>
        Média Geral
      </h3>
      <p>
        ${data.media}%
      </p>
    </div>

    <canvas id="grafico"></canvas>
  `;

  const ctx =
    document.getElementById(
      "grafico"
    );

  if (chart)
    chart.destroy();

  chart =
    new Chart(ctx, {
      type: "bar",
      data: {
        labels:
          data.labels,
        datasets: [
          {
            data:
              data.values
          }
        ]
      }
    });
}
