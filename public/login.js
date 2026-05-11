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
      console.log("CLICK LOGIN");

      try {
        const email = document.getElementById("login-email").value;
        const senha = document.getElementById("login-senha").value;

        const res = await fetch(`${API}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, senha })
        });

        const data = await res.json();

        console.log("LOGIN RESPONSE:", res.status, data);

        if (!res.ok) {
          alert(data.error || "Erro no login");
          return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        window.location.href = "/";
      } catch (err) {
        console.error(err);
        alert("Erro no login");
      }
    });
  }

  // ======================
  // REGISTER
  // ======================
  if (registerBtn) {
    registerBtn.addEventListener("click", async () => {
      try {
        const username = document.getElementById("register-username").value;
        const email = document.getElementById("register-email").value;
        const senha = document.getElementById("register-senha").value;

        const res = await fetch(`${API}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, senha })
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.error || "Erro no registro");
          return;
        }

        alert("Código enviado para seu email");

        if (box) box.classList.remove("hidden");
        document.getElementById("verify-email").value = email;

      } catch (err) {
        console.error(err);
        alert("Erro no registro");
      }
    });
  }

  // ======================
  // VERIFY EMAIL
  // ======================
  if (verifyBtn) {
    verifyBtn.addEventListener("click", async () => {
      try {
        const email = document.getElementById("verify-email").value;
        const codigo = document.getElementById("verify-code").value;

        const res = await fetch(`${API}/verificar-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, codigo })
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.error || "Erro na verificação");
          return;
        }

        alert("Email verificado!");

        if (box) box.classList.add("hidden");

      } catch (err) {
        console.error(err);
        alert("Erro na verificação");
      }
    });
  }
});
