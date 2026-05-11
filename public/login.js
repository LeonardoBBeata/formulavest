const API = "https://formulavest.onrender.com";


// ======================
// LOGIN
// ======================
document.getElementById("login-btn").onclick = async () => {
  try {
    const email = document.getElementById("login-email").value;
    const senha = document.getElementById("login-senha").value;

    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });

    const data = await res.json();

    console.log("LOGIN RESPONSE:", res);
    console.log("LOGIN DATA:", data);

    if (!res.ok) {
      alert(data.error || "Erro no login");
      return;
    }

    // se essas funções não existirem, não quebra o código
    if (typeof setUser === "function") setUser(data.user);
    if (typeof setToken === "function") setToken(data.token);

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    window.location.href = "/";
  } catch (err) {
    console.error(err);
    alert("Erro inesperado no login");
  }
};


// ======================
// REGISTER
// ======================
document.getElementById("register-btn").onclick = async () => {
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

    alert("Código enviado para seu email.");

    document.getElementById("verificacao-box").classList.remove("hidden");
    document.getElementById("verify-email").value = email;

  } catch (err) {
    console.error(err);
    alert("Erro inesperado no registro");
  }
};


// ======================
// VERIFY EMAIL
// ======================
document.getElementById("verify-btn").onclick = async () => {
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

    alert("Email confirmado! Agora faça login.");

    console.log("VERIFY RESPONSE:", res);
    console.log("VERIFY DATA:", data);

    document.getElementById("verificacao-box").classList.add("hidden");

  } catch (err) {
    console.error(err);
    alert("Erro inesperado na verificação");
  }
};
