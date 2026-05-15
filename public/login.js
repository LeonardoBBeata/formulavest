const API = "https://formulavest.onrender.com";

let loginEmail = "";
let loginSenha = "";

let cadastroEmail = "";

function mostrar(id){
  document
    .querySelectorAll(".card")
    .forEach(c =>
      c.classList.add("hidden")
    );

  document
    .getElementById(id)
    .classList.remove("hidden");
}


// abrir cadastro
document
.getElementById("abrir-cadastro")
.onclick = () => {
  mostrar("cadastro-box");
};

// abrir recuperar
document
.getElementById("abrir-recuperar")
.onclick = () => {
  mostrar("recuperar-box");
};

// voltar
document
.querySelectorAll(".voltar-login")
.forEach(btn=>{
  btn.onclick = ()=>{
    mostrar("login-box");
  };
});


// LOGIN PASSO 1
document
.getElementById("login-btn")
.onclick = async ()=>{

  loginEmail =
    document.getElementById(
      "login-email"
    ).value;

  loginSenha =
    document.getElementById(
      "login-senha"
    ).value;

  const res = await fetch(
    `${API}/login-iniciar`,
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        email:loginEmail,
        senha:loginSenha
      })
    }
  );

  const data = await res.json();

  if(!res.ok){
    alert(data.error);
    return;
  }

  mostrar("codigo-login-box");
};


// LOGIN PASSO 2
document
.getElementById(
  "confirmar-login-btn"
)
.onclick = async ()=>{

  const codigo =
    document.getElementById(
      "codigo-login"
    ).value;

  const res = await fetch(
    `${API}/login-confirmar`,
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        email:loginEmail,
        senha:loginSenha,
        codigo
      })
    }
  );

  const data =
    await res.json();

  if(!res.ok){
    alert(data.error);
    return;
  }

  localStorage.setItem(
    "token",
    data.token
  );

  // SE FOR ADMIN → vai pro admin
  if(data.admin){
    location.href =
      "/admin.html";
    return;
  }

  // usuário normal
  location.href =
    "/index.html";
};


// CADASTRO
document
.getElementById("cadastro-btn")
.onclick = async ()=>{

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

  const res = await fetch(
    `${API}/register`,
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        username,
        email:cadastroEmail,
        senha
      })
    }
  );

  const data = await res.json();

  if(!res.ok){
    alert(data.error);
    return;
  }

  mostrar(
    "codigo-cadastro-box"
  );
};


// CONFIRMAR CADASTRO
document
.getElementById(
  "confirmar-cadastro-btn"
)
.onclick = async ()=>{

  const codigo =
    document.getElementById(
      "codigo-cadastro"
    ).value;

  const res = await fetch(
    `${API}/verificar-email`,
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        email:cadastroEmail,
        codigo
      })
    }
  );

  const data = await res.json();

  if(!res.ok){
    alert(data.error);
    return;
  }

  alert(
    "Conta criada!"
  );

  mostrar("login-box");
};


// RECUPERAR
document
.getElementById(
  "recuperar-btn"
)
.onclick = async ()=>{

  const email =
    document.getElementById(
      "recuperar-email"
    ).value;

  const res = await fetch(
    `${API}/forgot-password`,
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        email
      })
    }
  );

  const data = await res.json();

  alert(data.message);
};
