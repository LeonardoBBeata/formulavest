const API = "https://formulavest-2.onrender.com";

const registerBox =
document.getElementById('register-box');

document.getElementById('toggle-register')
.onclick = ()=>{

    registerBox.classList.toggle('hidden');
};

document.getElementById('login-btn')
.onclick = async ()=>{

    const username =
    document.getElementById('login-username').value;

    const senha =
    document.getElementById('login-senha').value;

    const res = await fetch(`${API}/login`,{
        method:'POST',

        headers:{
            'Content-Type':'application/json'
        },

        credentials:'include',

        body:JSON.stringify({
            username,
            senha
        })
    });

    const data = await res.json();

    if(data.ok){

        window.location.href = '/';

    }else{

        alert(data.error);
    }
};

document.getElementById('register-btn')
.onclick = async ()=>{

    const username =
    document.getElementById('reg-username').value;

    const senha =
    document.getElementById('reg-senha').value;

    const res = await fetch(`${API}/register`,{
        method:'POST',

        headers:{
            'Content-Type':'application/json'
        },

        credentials:'include',

        body:JSON.stringify({
            username,
            senha
        })
    });

    const data = await res.json();

    if(data.ok){

        alert('Conta criada!');

    }else{

        alert(data.error);
    }
};
