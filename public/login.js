const API = 'https://SEU-BACKEND.onrender.com';
async function login(){
const username = document
.getElementById('login-username')
.value;
const senha = document
.getElementById('login-senha')
.value;
const res = await fetch(`${API}/login`,{
method:'POST',
headers:{
'Content-Type':'application/json'
},
body:JSON.stringify({
username,
10
senha
})
});
const data = await res.json();
if(data.ok){
localStorage.setItem(
'token',
data.token
);
localStorage.setItem(
'user',
JSON.stringify(data.user)
);
window.location.href = '/';
}
}
