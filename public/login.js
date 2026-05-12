const API = "https://formulavest.onrender.com";

console.log("LOGIN JS CARREGADO");

window.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("login-btn");
  const registerBtn = document.getElementById("register-btn");
  const verifyBtn = document.getElementById("verify-btn");
  const box = document.getElementById("verificacao-box");

  // ======================
  // LOGIN
  // ======================
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      try {
        const email = document.getElementById("login-email").value.trim();
        const senha = document.getElementById("login-senha").value;

        console.log("Tentando login...");

        const res = await fetch(`${API}/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email,
            senha
          })
        });

        const data = await res.json();

        console.log("LOGIN:", data);

        if (!res.ok) {
          alert(data.error || "Erro no login");
          return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem(
          "user",
          JSON.stringify(data.user)
        );

        // ir para index principal
        window.location.href = "/index.html";

      } catch (err) {
        console.error(err);
        alert("Erro ao fazer login");
      }
    });
  }

  // ======================
  // REGISTER
  // ======================
  if (registerBtn) {
    registerBtn.addEventListener("click", async () => {
      try {
        const username =
          document.getElementById("register-username").value.trim();

        const email =
          document.getElementById("register-email").value.trim();

        const senha =
          document.getElementById("register-senha").value;

        const res = await fetch(`${API}/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username,
            email,
            senha
          })
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.error || "Erro no registro");
          return;
        }

        alert("Código enviado para seu email");

        box.classList.remove("hidden");

        document.getElementById(
          "verify-email"
        ).value = email;

      } catch (err) {
        console.error(err);
        alert("Erro no registro");
      }
    });
  }

  // ======================
  // VERIFY
  // ======================
  if (verifyBtn) {
    verifyBtn.addEventListener("click", async () => {
      try {
        const email =
          document.getElementById("verify-email").value.trim();

        const codigo =
          document.getElementById("verify-code").value.trim();

        const res = await fetch(
          `${API}/verificar-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email,
              codigo
            })
          }
        );

        const data = await res.json();

        if (!res.ok) {
          alert(data.error || "Erro");
          return;
        }

        alert(
          "Email confirmado! Agora faça login."
        );

        box.classList.add("hidden");

      } catch (err) {
        console.error(err);
        alert("Erro na verificação");
      }
    });
  }
});
