const sections = document.querySelectorAll('.section');
const menuItems = document.querySelectorAll('.sidebar nav ul li');
const API = "https://formulavest-2.onrender.com";



menuItems.forEach(item=>{
    item.addEventListener('click',()=>{
        menuItems.forEach(i=>i.classList.remove('active'));
        item.classList.add('active');
        const target = item.dataset.section;
        sections.forEach(s=> s.id===target ? s.classList.remove('hidden') : s.classList.add('hidden'));
        if(target==='dashboard') carregarHistorico();
    });
});

// Tema
const temaToggle = document.getElementById('tema-toggle');
if(localStorage.getItem('tema')==='dark'){
    document.body.classList.add('dark');
    temaToggle.checked=true;
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

// Login / Registro
document.getElementById('show-register').addEventListener('click',()=>document.getElementById('register-box').classList.remove('hidden'));
document.getElementById('show-login').addEventListener('click',()=>document.getElementById('register-box').classList.add('hidden'));

document.getElementById('register-btn').addEventListener('click', async ()=>{
    const username = document.getElementById('reg-username').value;
    const senha = document.getElementById('reg-senha').value;
    try{
        const res = await fetch('/register',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username,senha}), credentials:'include'});
        const data = await res.json();
        if(data.ok){ alert('Registrado! Faça login'); document.getElementById('register-box').classList.add('hidden'); }
        else alert(data.error);
    }catch(err){ alert('Erro no registro'); }
});

document.getElementById('login-btn').addEventListener('click', async ()=>{
    const username = document.getElementById('login-username').value;
    const senha = document.getElementById('login-senha').value;
    try{
        const res = await fetch('/login',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username,senha}), credentials:'include'});
        const data = await res.json();
        if(data.ok){
            document.getElementById('auth-section').classList.add('hidden');
            document.querySelector('.sidebar').classList.remove('hidden');
            document.querySelector('.main-content').classList.remove('hidden');
        } else alert(data.error);
    }catch(err){ alert('Erro no login'); }
});

document.getElementById('logout-btn').addEventListener('click', async ()=>{
    await fetch('/logout',{method:'POST', credentials:'include'});
    location.reload();
});

// --------------------
// Gerar prova
// --------------------
let questoes = [];
let cronometroInterval;
let tempoGastoSegundos = 0;

document.getElementById('gerar-btn').addEventListener('click', async ()=>{
    const faculdade = document.getElementById('faculdade').value;
    const curso = document.getElementById('curso').value;
    const quantidadeInput = document.getElementById('quantidade');
    const defaultQtdInput = document.getElementById('default-quantidade');
    const quantidade = quantidadeInput.value || defaultQtdInput.value || 10;

    if(!faculdade||!curso) return alert("Preencha todos os campos!");
    const container = document.getElementById('prova-container');
    container.innerHTML='';

    try{
        const res = await fetch('/gerar-prova',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({faculdade,curso,quantidade}), credentials:'include'});
        const data = await res.json();
        questoes = data.questoes;
        exibirProva();
        iniciarCronometro(questoes.length);
    }catch(err){ alert("Erro ao gerar prova"); }
});

function exibirProva(){
    const container = document.getElementById('prova-container');
    container.innerHTML = questoes.map((q,i)=>`
        <div class="questao">
            <p class="enunciado"><strong>Q${i+1}</strong>: ${q.enunciado}</p>
            ${Object.entries(q.opcoes).map(([letra,texto])=>`
                <label class="alternativa">
                    <span>${letra}) ${texto}</span>
                    <input type="radio" name="q${i}" value="${letra}">
                </label>
            `).join('')}
        </div>
    `).join('');
    document.getElementById('finalizar-btn').classList.remove('hidden');
    if(!document.getElementById('tempo-prova')){
        const p = document.createElement('p');
        p.id='tempo-prova';
        document.getElementById('gerar').prepend(p);
    }
}

// Cronômetro
function iniciarCronometro(qtd){
    tempoGastoSegundos = qtd*5*60;
    const display = document.getElementById('tempo-prova');
    clearInterval(cronometroInterval);
    cronometroInterval = setInterval(()=>{
        const min = Math.floor(tempoGastoSegundos/60);
        const seg = tempoGastoSegundos%60;
        if(display) display.textContent = `Tempo restante: ${min}m ${seg}s`;
        if(tempoGastoSegundos<=0){
            clearInterval(cronometroInterval);
            alert("Tempo esgotado!");
            document.getElementById('finalizar-btn').click();
        }
        tempoGastoSegundos--;
    },1000);
}

// Finalizar prova
document.getElementById('finalizar-btn').addEventListener('click', ()=>{
    clearInterval(cronometroInterval);

    // Garante que tempoGastoSegundos está definido
    if(typeof tempoGastoSegundos !== 'number' || isNaN(tempoGastoSegundos)){
        tempoGastoSegundos = 0;
    }

    const respostas = questoes.map((q,i)=>{
        const radio = document.querySelector(`input[name="q${i}"]:checked`);
        const selecionada = radio ? radio.value : null;
        // Envia apenas os campos necessários
        return {
            enunciado: q.enunciado,
            opcoes: q.opcoes,
            correta: q.correta,
            selecionada
        };
    });

    fetch('/salvar-prova', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
            questoes: respostas,
            tempo: (questoes.length*5*60 - tempoGastoSegundos)
        }),
        credentials:'include'
    })
    .then(async res=>{
        if(!res.ok){
            const err = await res.json();
            throw new Error(err.error || 'Erro ao salvar prova');
        }
        // Redireciona para dashboard
        menuItems.forEach(i=>i.classList.remove('active'));
        document.querySelector('[data-section="dashboard"]').classList.add('active');
        sections.forEach(s=> s.id==='dashboard'? s.classList.remove('hidden') : s.classList.add('hidden'));
        carregarHistorico();
    })
    .catch(err=>{
        alert(err.message);
    });
});

// --------------------
// Dashboard
// --------------------
async function carregarHistorico(){

    const res = await fetch('/provas',{credentials:'include'});
    const data = await res.json();

    const provas = data.provas || [];

    if(provas.length === 0){
        document.getElementById('resultado').innerHTML = "Nenhuma prova ainda";
        return;
    }

    let totalAcertos = 0;
    let totalQuestoes = 0;
    let melhor = 0;
    let desempenhoArray = [];

    provas.forEach((p,i)=>{
        let acertos = 0;

        p.questoes.forEach(q=>{
            if(q.selecionada === q.correta) acertos++;
        });

        const perc = (acertos/p.questoes.length)*100;

        desempenhoArray.push(perc);

        totalAcertos += acertos;
        totalQuestoes += p.questoes.length;

        if(perc > melhor) melhor = perc;
    });

    const media = (totalAcertos/totalQuestoes)*100;

    // 🎯 XP SYSTEM
    const xp = Math.floor(totalAcertos * 10);
    const nivel = Math.floor(xp / 1000) + 1;

    document.getElementById('total-provas').textContent = provas.length;
    document.getElementById('media-acertos').textContent = media.toFixed(1)+"%";
    document.getElementById('melhor-resultado').textContent = melhor.toFixed(1)+"%";
    document.getElementById('nivel').textContent = nivel;

    // 📈 GRÁFICO
    const ctx = document.getElementById('graficoDesempenho');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: provas.map((_,i)=>`Prova ${i+1}`),
            datasets: [{
                label: 'Desempenho (%)',
                data: desempenhoArray,
                tension: 0.3
            }]
        }
    });

    // 📋 Histórico
    document.getElementById('resultado').innerHTML = provas.map((p,i)=>{
        let acertos=0;
        p.questoes.forEach(q=>{
            if(q.selecionada===q.correta) acertos++;
        });

        return `
        <div class="prova-card">
            <h4>Prova ${i+1}</h4>
            <p>${acertos}/${p.questoes.length}</p>
        </div>
        `;
    }).join('');

    gerarAnaliseIA(provas);
}
// --------------------
// Simulado ENEM completo
// --------------------

let enemQuestoes = [];
let enemTempo = 300*60;
let enemInterval;

document.getElementById('enem-btn').addEventListener('click', async ()=>{

    const quantidade = 90

    const res = await fetch('/gerar-enem',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({quantidade}),
        credentials:'include'
    });
const data = await res.json();

if(!data.questoes){

alert("Erro ao gerar prova ENEM");

return;

}

enemQuestoes = data.questoes;


if(!data.questoes){
    alert("Erro ao gerar prova ENEM");
    return;
}



    const container = document.getElementById('enem-container');

    container.innerHTML = enemQuestoes.map((q,i)=>`
        <div class="questao">
        <p><strong>Q${i+1}</strong>: ${q.enunciado}</p>

        ${Object.entries(q.opcoes).map(([l,t])=>`
            <label>
                ${l}) ${t}
                <input type="radio" name="enem${i}" value="${l}">
            </label>
        `).join('')}
        </div>
    `).join('');

    document.getElementById('finalizar-enem').classList.remove('hidden');

    iniciarTempoEnem();
});

function iniciarTempoEnem(){

    enemTempo = 300*60;

    const display = document.getElementById('tempo-enem');

    clearInterval(enemInterval);

    enemInterval = setInterval(()=>{

        const min = Math.floor(enemTempo/60);
        const seg = enemTempo%60;

        display.textContent = `Tempo restante: ${min}m ${seg}s`;

        if(enemTempo<=0){

            clearInterval(enemInterval);

            alert("Tempo do ENEM acabou");

            document.getElementById('finalizar-enem').click();
        }

        enemTempo--;

    },1000);
}
// --------------------
// Redação
// --------------------

async function gerarAnaliseIA(provas){

    const res = await fetch('/analise-desempenho',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({provas}),
        credentials:'include'
    });

    const data = await res.json();

    document.getElementById('analise-ia').innerHTML = `
        <p><strong>✅ Pontos fortes:</strong> ${data.fortes.join(', ')}</p>
        <p><strong>⚠️ Pontos fracos:</strong> ${data.fracos.join(', ')}</p>
        <p><strong>🚀 Recomendações:</strong> ${data.recomendacoes.join(', ')}</p>
    `;
}

document.getElementById('enviar-redacao').addEventListener('click', async ()=>{

const tema = document.getElementById('tema-redacao').value;
const texto = document.getElementById('texto-redacao').value;

if(!tema || !texto) return alert("Preencha tema e redação");

const res = await fetch('/corrigir-redacao',{

method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({tema,texto}),
credentials:'include'

});

const data = await res.json();

document.getElementById('feedback-redacao').innerHTML = `
<h4>Nota Final: ${data.nota}/1000</h4>

<p>${data.feedback}</p>
`;

});
