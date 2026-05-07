constAPI="https://formulavest-2.onrender.com";
constregisterBox=document.getElementById('register-box');
// Toggle registro
document.getElementById('toggle-register').onclick=()=>{registerBox.classList.toggle('hidden');
};
// LOGIN
document.getElementById('login-btn').onclick=async()=>{constusername=document.getElementById('login-username').value;constsenha=document.getElementById('login-senha').value;constres=awaitfetch(`${API}/login`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({username,senha})});constdata=awaitres.json();if(data.ok){window.location.href='/';}else{alert(data.error||'Erro no login');}
};
// REGISTRO
document.getElementById('register-btn').onclick=async()=>{constusername=document.getElementById('reg-username').value;constsenha=document.getElementById('reg-senha').value;constres=awaitfetch(`${API}/register`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({username,senha})});
13
constdata=awaitres.json();if(data.ok){alert('Conta criada!');registerBox.classList.add('hidden');}else{alert(data.error||'Erro ao registrar');}
};
// VERIFICAR SESSÃO
asyncfunctionverificarSessao(){try{constres=awaitfetch(`${API}/provas`,{credentials:'include'});if(res.ok){window.location.href='/';}}catch(err){console.log(err);}
}
verificarSessao();
