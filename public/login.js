constAPI='https://SEU-BACKEND.onrender.com';
// LOGIN
document.getElementById('login-btn')
.onclick=async()=>{constusername=document.getElementById('login-username').value;constsenha=document.getElementById('login-senha').value;
10
constres=awaitfetch(`${API}/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,senha})});constdata=awaitres.json();if(data.ok){localStorage.setItem('token',data.token);localStorage.setItem('user',JSON.stringify(data.user));window.location.href='/';}else{alert(data.error);}
};
// REGISTER
document.getElementById('register-btn')
.onclick=async()=>{constusername=document.getElementById('reg-username').value;constsenha=document.getElementById('reg-senha').value;constres=awaitfetch(`${API}/register`,{
11
method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,senha})});constdata=awaitres.json();if(data.ok){alert('Conta criada');}else{alert(data.error);}
};
