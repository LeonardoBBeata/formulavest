const API = "https://formulavest.onrender.com";


// LOGIN
document.getElementById("login-btn").onclick = async () => {
  const email =
    document.getElementById("login-email").value;

  const senha =
    document.getElementById("login-senha").value;

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

  if (!res.ok) {
    alert(data.error);
    return;
  }

  localStorage.setItem(
    "token",
    data.token
  );

  localStorage.setItem(
    "user",
    JSON.stringify(data.user)
  );

  window.location.href = "/";
};


// REGISTER
document.getElementById("register-btn").onclick = async () => {
  const username =
    document.getElementById(
      "register-username"
    ).value;

  const email =
    document.getElementById(
      "register-email"
    ).value;

  const senha =
    document.getElementById(
      "register-senha"
    ).value;

  const res = await fetch(
    `${API}/register`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        username,
        email,
        senha
      })
    }
  );

  const data = await res.json();

  if (!res.ok) {
    alert(data.error);
    return;
  }

  alert(
    "Código enviado para seu email."
  );

  document
    .getElementById(
      "verificacao-box"
    )
    .classList.remove("hidden");

  document
    .getElementById(
      "verify-email"
    )
    .value = email;
};


// VERIFY EMAIL
document.getElementById(
  "verify-btn"
).onclick = async () => {

  const email =
    document.getElementById(
      "verify-email"
    ).value;

  const codigo =
    document.getElementById(
      "verify-code"
    ).value;

  const res = await fetch(
    `${API}/verificar-email`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        email,
        codigo
      })
    }
  );

  const data = await res.json();

  if (!res.ok) {
    alert(data.error);
    return;
  }

  alert(
    "Email confirmado! Agora faça login."
  );

  document
    .getElementById(
      "verificacao-box"
    )
    .classList.add("hidden");
};
