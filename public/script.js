const API = "https://formulavest-2.onrender.com";

// ============================
// ELEMENTOS
// ============================
const sections = document.querySelectorAll('.section');
const menuItems = document.querySelectorAll('.sidebar nav ul li');

// ============================
// MENU LATERAL
// ============================
menuItems.forEach(item => {

    item.addEventListener('click', () => {

        menuItems.forEach(i => {
            i.classList.remove('active');
        });

        item.classList.add('active');

        const target = item.dataset.section;

        sections.forEach(section => {

            if(section.id === target){

                section.classList.remove('hidden');

            }else{

                section.classList.add('hidden');
            }
        });

        // dashboard
        if(target === 'dashboard'){
            carregarHistorico();
        }
    });
});

// ============================
// TEMA
// ============================
const temaToggle = document.getElementById('tema-toggle');

if(localStorage.getItem('tema') === 'dark'){

    document.body.classList.add('dark');

    if(temaToggle){
        temaToggle.checked = true;
    }
}

if(temaToggle){

    temaToggle.addEventListener('change', ()=>{

        if(temaToggle.checked){

            document.body.classList.add('dark');

            localStorage.setItem('tema','dark');

        }else{

            document.body.classList.remove('dark');

            localStorage.setItem('tema','light');
        }
    });
}

// ============================
// VERIFICAR SESSÃO
// ============================
async function verificarSessao(){

    try{

        const res = await fetch(`${API}/provas`,{
            credentials:'include'
        });

        if(!res.ok){

            window.location.href = '/login.html';
        }

    }catch(err){

        console.log(err);

        window.location.href = '/login.html';
    }
}

verificarSessao();

// ============================
// LOGOUT
// ============================
const logoutBtn = document.getElementById('logout-btn');

if(logoutBtn){

    logoutBtn.onclick = async ()=>{

        try{

            await fetch(`${API}/logout`,{
                method:'POST',
                credentials:'include'
            });

        }catch(err){

            console.log(err);
        }

        window.location.href = '/login.html';
    };
}

// ============================
// GERAR PROVA
// ============================
let questoes = [];
let tempo = 0;
let timer = null;

const gerarBtn = document.getElementById('gerar-btn');

if(gerarBtn){

    gerarBtn.onclick = async ()=>{

        try{

            const faculdade =
            document.getElementById('faculdade').value;

            const curso =
            document.getElementById('curso').value;

            const quantidade =
            document.getElementById('quantidade').value || 10;

            gerarBtn.disabled = true;
            gerarBtn.textContent = 'Gerando...';

            const res = await fetch(`${API}/gerar-prova`,{

                method:'POST',

                headers:{
                    'Content-Type':'application/json'
                },

                credentials:'include',

                body:JSON.stringify({
                    faculdade,
                    curso,
                    quantidade
                })
            });

            const data = await res.json();

            if(!data.questoes){

                alert(data.error || 'Erro ao gerar prova');

                return;
            }

            questoes = data.questoes;

            renderProva();

            iniciarTimer(questoes.length);

        }catch(err){

            console.log(err);

            alert('Erro ao gerar prova');

        }finally{

            gerarBtn.disabled = false;
            gerarBtn.textContent = 'Gerar Prova';
        }
    };
}

// ============================
// RENDER PROVA
// ============================
function renderProva(){

    const container =
    document.getElementById('prova-container');

    if(!container) return;

    container.innerHTML = questoes.map((q,i)=>`

        <div class="questao">

            <p class="enunciado">
                <strong>Q${i + 1}</strong>
                ${q.enunciado}
            </p>

            ${Object.entries(q.opcoes).map(([letra,texto])=>`

                <label class="alternativa">

                    <span>
                        <strong>${letra})</strong>
                        ${texto}
                    </span>

                    <input
                        type="radio"
                        name="q${i}"
                        value="${letra}"
                    >

                </label>

            `).join('')}

        </div>

    `).join('');

    const finalizarBtn =
    document.getElementById('finalizar-btn');

    if(finalizarBtn){
        finalizarBtn.classList.remove('hidden');
    }
}

// ============================
// TIMER
// ============================
function iniciarTimer(qtd){

    tempo = qtd * 5 * 60;

    clearInterval(timer);

    timer = setInterval(()=>{

        const min = Math.floor(tempo / 60);
        const seg = tempo % 60;

        const tempoEl =
        document.getElementById('tempo-prova');

        if(tempoEl){

            tempoEl.textContent =
            `Tempo: ${min}m ${seg}s`;
        }

        tempo--;

        if(tempo <= 0){

            clearInterval(timer);

            alert('Tempo esgotado!');
        }

    },1000);
}

// ============================
// FINALIZAR PROVA
// ============================
const finalizarBtn =
document.getElementById('finalizar-btn');

if(finalizarBtn){

    finalizarBtn.onclick = async ()=>{

        try{

            clearInterval(timer);

            const respostas = questoes.map((q,i)=>{

                const resposta =
                document.querySelector(
                    `input[name="q${i}"]:checked`
                );

                return {

                    correta:q.correta,

                    selecionada:
                    resposta
                    ? resposta.value
                    : null
                };
            });

            const res = await fetch(
                `${API}/salvar-prova`,
                {

                    method:'POST',

                    headers:{
                        'Content-Type':'application/json'
                    },

                    credentials:'include',

                    body:JSON.stringify({

                        questoes:respostas,

                        tempo
                    })
                }
            );

            const data = await res.json();

            if(data.ok){

                alert('Prova salva!');

                carregarHistorico();

            }else{

                alert(data.error || 'Erro');
            }

        }catch(err){

            console.log(err);

            alert('Erro ao finalizar');
        }
    };
}

// ============================
// DASHBOARD
// ============================
async function carregarHistorico(){

    try{

        const res = await fetch(`${API}/provas`,{
            credentials:'include'
        });

        const data = await res.json();

        const provas = data.provas || [];

        // total provas
        const totalProvas =
        document.getElementById('total-provas');

        if(totalProvas){

            totalProvas.textContent =
            provas.length;
        }

        let totalQuestoes = 0;
        let totalAcertos = 0;
        let melhor = 0;

        provas.forEach(prova=>{

            let acertosProva = 0;

            prova.questoes.forEach(q=>{

                totalQuestoes++;

                if(q.selecionada === q.correta){

                    totalAcertos++;
                    acertosProva++;
                }
            });

            const percentual =
            prova.questoes.length
            ? (acertosProva / prova.questoes.length) * 100
            : 0;

            if(percentual > melhor){

                melhor = percentual;
            }
        });

        const media = totalQuestoes
            ? (totalAcertos / totalQuestoes) * 100
            : 0;

        // média
        const mediaEl =
        document.getElementById('media-acertos');

        if(mediaEl){

            mediaEl.textContent =
            `${media.toFixed(1)}%`;
        }

        // melhor resultado
        const melhorEl =
        document.getElementById('melhor-resultado');

        if(melhorEl){

            melhorEl.textContent =
            `${melhor.toFixed(1)}%`;
        }

        // nível
        const nivelEl =
        document.getElementById('nivel');

        if(nivelEl){

            const nivel =
            Math.floor(totalAcertos / 20) + 1;

            nivelEl.textContent = nivel;
        }

        // histórico
        const resultado =
        document.getElementById('resultado');

        if(resultado){

            resultado.innerHTML = provas.map((p,index)=>{

                let acertos = 0;

                p.questoes.forEach(q=>{

                    if(q.selecionada === q.correta){

                        acertos++;
                    }
                });

                const percentual =
                p.questoes.length
                ? ((acertos / p.questoes.length) * 100).toFixed(1)
                : 0;

                return `

                    <div class="card">

                        <h3>
                            Prova #${provas.length - index}
                        </h3>

                        <p>
                            Acertos:
                            ${acertos}/${p.questoes.length}
                        </p>

                        <p>
                            Resultado:
                            ${percentual}%
                        </p>

                    </div>
                `;
            }).join('');
        }

    }catch(err){

        console.log(err);
    }
}
