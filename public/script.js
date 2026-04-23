const API = "https://formulavest-2.onrender.com";

// ============================
// ELEMENTOS
// ============================
const authSection = document.getElementById('auth-section');
const sidebar = document.querySelector('.sidebar');
const mainContent = document.querySelector('.main-content');

const sections = document.querySelectorAll('.section');
const menuItems = document.querySelectorAll('.sidebar nav ul li');

// ============================
// ESTADO INICIAL
// ============================
sidebar.classList.add('hidden');
mainContent.classList.add('hidden');

// ============================
// UI CONTROL
// ============================
function mostrarApp(){
    authSection.classList.add('hidden');
    sidebar.classList.remove('hidden');
    mainContent.classList.remove('hidden');
}

function mostrarLogin(){
    authSection.classList.remove('hidden');
    sidebar.classList.add('hidden');
    mainContent.classList.add('hidden');
}

// ============================
// MENU
// ============================
menuItems.forEach(item=>{
    item.addEventListener('click',()=>{
        menuItems.forEach(i=>i.classList.remove('active'));
        item.classList.add('active');

        const target = item.dataset.section;

        sections.forEach(s=>{
            s.id === target ? s.classList.remove('hidden') : s.classList.add('hidden');
        });

        if(target === 'dashboard') carregarHistorico();
    });
});

// ============================
// TEMA
// ============================
const temaToggle = document.getElementById('tema-toggle');

if(localStorage.getItem('tema') === 'dark'){
    document.body.classList.add('dark');
    temaToggle.checked = true;
}

temaToggle.addEventListener('change',()=>{
    if(temaToggle.checked){
        document.body.classList.add('dark');
        localStorage.setItem('tema','dark');
    } else {
        document.body.classList.remove('dark');
        localStorage.setItem('tema','light');
    }
});

// ============================
// LOGIN / REGISTRO
// ============================
document.getElementById('show-register').onclick = ()=>{
    document.getElementById('register-box').classList.remove('hidden');
};

document.getElementById('show-login').onclick = ()=>{
    document.getElementById('register-box').classList.add('hidden');
};

document.getElementById('register-btn').onclick = async ()=>{
    const username = document.getElementById('reg-username').value;
    const senha = document.getElementById('reg-senha').value;

    const res = await fetch(`${API}/register`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username,senha}),
        credentials:'include'
    });

    const data = await res.json();

    if(data.ok){
        alert("Registrado!");
    } else {
        alert(data.error);
    }
};

document.getElementById('login-btn').onclick = async ()=>{
    const username = document.getElementById('login-username').value;
    const senha = document.getElementById('login-senha').value;

    const res = await fetch(`${API}/login`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username,senha}),
        credentials:'include'
    });

    const data = await res.json();

    if(data.ok){
        mostrarApp();
    } else {
        alert(data.error);
    }
};

document.getElementById('logout-btn').onclick = async ()=>{
    await fetch(`${API}/logout`,{
        method:'POST',
        credentials:'include'
    });

    mostrarLogin();
};

// ============================
// VERIFICAR SESSÃO
// ============================
async function verificarSessao(){
    try{
        const res = await fetch(`${API}/provas`,{
            credentials:'include'
        });

        if(res.ok){
            mostrarApp();
        } else {
            mostrarLogin();
        }
    }catch{
        mostrarLogin();
    }
}

verificarSessao();

// ============================
// GERAR PROVA
// ============================
let questoes = [];
let tempo = 0;
let timer;

document.getElementById('gerar-btn').onclick = async ()=>{
    const faculdade = document.getElementById('faculdade').value;
    const curso = document.getElementById('curso').value;
    const quantidade = document.getElementById('quantidade').value || 10;

    const res = await fetch(`${API}/gerar-prova`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({faculdade,curso,quantidade}),
        credentials:'include'
    });

    const data = await res.json();

    questoes = data.questoes;

    renderProva();
    iniciarTimer(questoes.length);
};

function renderProva(){
    const container = document.getElementById('prova-container');

    container.innerHTML = questoes.map((q,i)=>`
        <div class="questao">
            <p><strong>Q${i+1}</strong>: ${q.enunciado}</p>
            ${Object.entries(q.opcoes).map(([l,t])=>`
                <label>
                    ${l}) ${t}
                    <input type="radio" name="q${i}" value="${l}">
                </label>
            `).join('')}
        </div>
    `).join('');

    document.getElementById('finalizar-btn').classList.remove('hidden');
}

// ============================
// TIMER
// ============================
function iniciarTimer(qtd){
    tempo = qtd * 5 * 60;

    clearInterval(timer);

    timer = setInterval(()=>{
        const min = Math.floor(tempo/60);
        const seg = tempo%60;

        document.getElementById('tempo-prova').textContent =
            `Tempo: ${min}m ${seg}s`;

        tempo--;

        if(tempo <= 0){
            clearInterval(timer);
            alert("Tempo esgotado!");
        }

    },1000);
}

// ============================
// FINALIZAR
// ============================
document.getElementById('finalizar-btn').onclick = async ()=>{
    clearInterval(timer);

    const respostas = questoes.map((q,i)=>{
        const r = document.querySelector(`input[name="q${i}"]:checked`);
        return {
            correta: q.correta,
            selecionada: r ? r.value : null
        };
    });

    await fetch(`${API}/salvar-prova`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            questoes: respostas,
            tempo
        }),
        credentials:'include'
    });

    carregarHistorico();
};

// ============================
// DASHBOARD
// ============================
async function carregarHistorico(){

    const res = await fetch(`${API}/provas`,{
        credentials:'include'
    });

    const data = await res.json();

    const provas = data.provas || [];

    document.getElementById('total-provas').textContent = provas.length;

    let total = 0;
    let acertos = 0;

    provas.forEach(p=>{
        p.questoes.forEach(q=>{
            total++;
            if(q.selecionada === q.correta) acertos++;
        });
    });

    const media = total ? (acertos/total)*100 : 0;

    document.getElementById('media-acertos').textContent =
        media.toFixed(1)+"%";
}
