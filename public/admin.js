const API =
"https://formulavest.onrender.com";

document
.getElementById(
  "login-btn"
)
.onclick = async ()=>{

  const email =
  document
  .getElementById(
    "email"
  ).value;

  const senha =
  document
  .getElementById(
    "senha"
  ).value;

  const res =
  await fetch(
    `${API}/login-confirmar`,
    {
      method:"POST",
      headers:{
        "Content-Type":
        "application/json"
      },
      body:JSON.stringify({
        email,
        senha,
        codigo:""
      })
    }
  );

  const data =
  await res.json();

  if(!res.ok){
    return alert(
      data.error
    );
  }

  localStorage.setItem(
    "token",
    data.token
  );

  switch(data.role){

    case "empresa_admin":
      window.location=
      "/empresa.html";
      break;

    case "diretor":
      window.location=
      "/diretor.html";
      break;

    case "coordenador":
      window.location=
      "/coordenador.html";
      break;

    case "professor":
      window.location=
      "/professor.html";
      break;

    case "aluno":
      window.location=
      "/dashboard.html";
      break;

    default:
      alert(
        "Role inválida"
      );
  }
};
