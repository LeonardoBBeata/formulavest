const API =
  "https://formulavest.onrender.com";

let loginEmail = "";
let loginSenha = "";
let cadastroEmail = "";
let tipoLogin = "aluno";

function mostrar(id) {
  document
    .querySelectorAll(".card")
    .forEach(c =>
      c.classList.add(
        "hidden"
      )
    );

  document
    .getElementById(id)
    .classList.remove(
      "hidden"
    );
}

// ======================
// ABRIR CADASTRO
// ======================

document
  .getElementById(
    "abrir-cadastro"
  )
  .onclick = () => {
    mostrar(
      "cadastro-box"
    );
  };

// ======================
// ABRIR RECUPERAR
// ======================

document
  .getElementById(
    "abrir-recuperar"
  )
  .onclick = () => {
    mostrar(
      "recuperar-box"
    );
  };

// ======================
// VOLTAR LOGIN
// ======================

document
  .querySelectorAll(
    ".voltar-login"
  )
  .forEach(btn => {
    btn.onclick = () => {
      mostrar(
        "login-box"
      );
    };
  });

// ======================
// LOGIN PASSO 1
// ======================

document
  .getElementById(
    "login-btn"
  )
  .onclick = async () => {

    tipoLogin =
      document.querySelector(
        'input[name="tipo-login"]:checked'
      ).value;

    loginEmail =
      document.getElementById(
        "login-email"
      ).value;

    loginSenha =
      document.getElementById(
        "login-senha"
      ).value;

    const res =
      await fetch(
        `${API}/login-iniciar`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              email:
                loginEmail,
              senha:
                loginSenha
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

    mostrar(
      "codigo-login-box"
    );
  };

// ======================
// LOGIN PASSO 2
// ======================

document
  .getElementById(
    "confirmar-login-btn"
  )
  .onclick = async () => {

    const codigo =
      document.getElementById(
        "codigo-login"
      ).value;

    const res =
      await fetch(
        `${API}/login-confirmar`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              email:
                loginEmail,
              senha:
                loginSenha,
              codigo
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

    localStorage.setItem(
      "token",
      data.token
    );

    // ======================
    // REDIRECIONAMENTO
    // ======================

    if (
      tipoLogin === "admin"
    ) {

      if (
        data.role ===
        "empresa_admin"
      ) {
        location.href =
          "/admin_empresa.html";

      } else if (
        data.role ===
        "diretor"
      ) {
        location.href =
          "/admin_diretor.html";

      } else if (
        data.role ===
        "coordenador"
      ) {
        location.href =
          "/admin_coordenador.html";

      } else {
        alert(
          "Sua conta não é administrador."
        );

        localStorage.removeItem(
          "token"
        );

        mostrar(
          "login-box"
        );
      }

    } else {

      if (
        data.role ===
        "professor"
      ) {
        location.href =
          "/professor.html";
      } else {
        location.href =
          "/index.html";
      }

    }
  };

// ======================
// CADASTRO
// ======================

document
  .getElementById(
    "cadastro-btn"
  )
  .onclick = async () => {

    const username =
      document.getElementById(
        "cadastro-user"
      ).value;

    cadastroEmail =
      document.getElementById(
        "cadastro-email"
      ).value;

    const senha =
      document.getElementById(
        "cadastro-senha"
      ).value;

    const res =
      await fetch(
        `${API}/register`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              username,
              email:
                cadastroEmail,
              senha
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

    mostrar(
      "codigo-cadastro-box"
    );
  };

// ======================
// CONFIRMAR CADASTRO
// ======================

document
  .getElementById(
    "confirmar-cadastro-btn"
  )
  .onclick = async () => {

    const codigo =
      document.getElementById(
        "codigo-cadastro"
      ).value;

    const res =
      await fetch(
        `${API}/verificar-email`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              email:
                cadastroEmail,
              codigo
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
      "Conta criada!"
    );

    mostrar(
      "login-box"
    );
  };

// ======================
// RECUPERAR SENHA
// ======================

document
  .getElementById(
    "recuperar-btn"
  )
  .onclick = async () => {

    const email =
      document.getElementById(
        "recuperar-email"
      ).value;

    const res =
      await fetch(
        `${API}/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              email
            })
        }
      );

    const data =
      await res.json();

    alert(
      data.message ||
      data.error
    );
  };
