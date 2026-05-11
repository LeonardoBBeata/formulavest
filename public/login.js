const API = "";

let emailTemp = "";

// elementos
const loginBox = document.getElementById("loginBox");
const registerBox = document.getElementById("registerBox");
const verifyBox = document.getElementById("verifyBox");

const mostrarRegistro = document.getElementById("mostrarRegistro");
const mostrarLogin = document.getElementById("mostrarLogin");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const verifyBtn = document.getElementById("verifyBtn");

// alternar telas
mostrarRegistro.onclick = (e)=>{
    e.preventDefault();

    loginBox.classList.add("hidden");
    registerBox.classList.remove("hidden");
};

mostrarLogin.onclick = (e)=>{
    e.preventDefault();

    registerBox.classList.add("hidden");
    loginBox.classList.remove("hidden");
};

// REGISTRO
registerBtn.onclick = async ()=>{

    const username =
        document.getElementById("regUsername").value;

    const email =
        document.getElementById("regEmail").value;

    const senha =
        document.getElementById("regSenha").value;

    const res = await fetch(
        API + "/register",
        {
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                username,
                email,
                senha
            })
        }
    );

    const data = await res.json();

    if(!res.ok){
        alert(data.error);
        return;
    }

    emailTemp = email;

    alert(
        "Código enviado para seu email!"
    );

    registerBox.classList.add("hidden");
    verifyBox.classList.remove("hidden");
};

// VERIFICAR EMAIL
verifyBtn.onclick = async ()=>{

    const codigo =
        document.getElementById("verifyCode").value;

    const res = await fetch(
        API + "/verificar-email",
        {
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                email: emailTemp,
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
        "Conta verificada! Faça login."
    );

    verifyBox.classList.add("hidden");
    loginBox.classList.remove("hidden");
};

// LOGIN
loginBtn.onclick = async ()=>{

    const email =
        document.getElementById("loginEmail").value;

    const senha =
        document.getElementById("loginSenha").value;

    const res = await fetch(
        API + "/login",
        {
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                email,
                senha
            })
        }
    );

    const data = await res.json();

    if(!res.ok){
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

    window.location.href =
        "/";
};
