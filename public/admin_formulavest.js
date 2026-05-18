const API =
  "https://formulavest.onrender.com";

const token =
  localStorage.getItem(
    "token"
  );

if (!token) {
  location.href =
    "/login.html";
}

function authHeaders() {
  return {
    "Content-Type":
      "application/json",
    "Authorization":
      `Bearer ${token}`
  };
}

function mostrar(id) {
  document
    .querySelectorAll(
      ".pagina"
    )
    .forEach(p =>
      p.classList.add(
        "hidden"
      )
    );

  document
    .getElementById(id)
    .classList.remove(
      "hidden"
    );
}

function logout() {
  localStorage.removeItem(
    "token"
  );

  location.href =
    "/login.html";
}

// ======================
// VERIFICAR MASTER
// ======================

async function verificarMaster() {
  const res =
    await fetch(
      `${API}/me`,
      {
        headers:
          authHeaders()
      }
    );

  const data =
    await res.json();

  if (
    data.role !==
    "formulavest_master"
  ) {
    alert(
      "Sem permissão"
    );

    logout();
  }
}

// ======================
// DASHBOARD
// ======================

async function carregarDashboard() {
  const res =
    await fetch(
      `${API}/master/stats`,
      {
        headers:
          authHeaders()
      }
    );

  const data =
    await res.json();

  document.getElementById(
    "totalEmpresas"
  ).textContent =
    data.totalEmpresas;

  document.getElementById(
    "totalUsuarios"
  ).textContent =
    data.totalUsuarios;

  document.getElementById(
    "totalProvas"
  ).textContent =
    data.totalProvas;
}

// ======================
// EMPRESAS
// ======================

async function carregarEmpresas() {
  const res =
    await fetch(
      `${API}/master/empresas`,
      {
        headers:
          authHeaders()
      }
    );

  const data =
    await res.json();

  const box =
    document.getElementById(
      "listaEmpresas"
    );

  box.innerHTML =
    data.empresas
      .map(
        e => `
      <div class="
        bg-white
        p-4
        rounded
        shadow
        flex
        justify-between
      ">
        <span>
          #${e.id}
          - ${e.nome}
        </span>

        <button
          onclick="excluirEmpresa(${e.id})"
          class="
            bg-red-600
            text-white
            px-3
            py-1
            rounded
          "
        >
          Excluir
        </button>
      </div>
    `
      )
      .join("");
}

async function criarEmpresa() {
  const nome =
    document.getElementById(
      "empresaNome"
    ).value;

  await fetch(
    `${API}/master/criar-empresa`,
    {
      method: "POST",
      headers:
        authHeaders(),
      body:
        JSON.stringify({
          nome
        })
    }
  );

  carregarEmpresas();
}

async function excluirEmpresa(id) {
  if (
    !confirm(
      "Excluir empresa?"
    )
  ) return;

  await fetch(
    `${API}/master/empresa/${id}`,
    {
      method: "DELETE",
      headers:
        authHeaders()
    }
  );

  carregarEmpresas();
}

// ======================
// CRIAR EMPRESA ADMIN
// ======================

async function criarEmpresaAdmin() {
  const username =
    document.getElementById(
      "adminNome"
    ).value;

  const email =
    document.getElementById(
      "adminEmail"
    ).value;

  const senha =
    document.getElementById(
      "adminSenha"
    ).value;

  const empresa_id =
    document.getElementById(
      "adminEmpresaId"
    ).value;

  await fetch(
    `${API}/master/criar-admin`,
    {
      method: "POST",
      headers:
        authHeaders(),
      body:
        JSON.stringify({
          username,
          email,
          senha,
          empresa_id
        })
    }
  );

  alert(
    "Admin criado!"
  );
}

// ======================
// INIT
// ======================

verificarMaster();
carregarDashboard();
carregarEmpresas();
