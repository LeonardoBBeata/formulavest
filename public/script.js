const API = 'https://SEU-BACKEND.onrender.com';
const token = localStorage.getItem('token');

if (!token) {
    window.location.href = '/login.html';
}

// ======================
// MENU
// ======================

const sections = document.querySelectorAll('.section');
const menuItems = document.querySelectorAll('.sidebar li');

menuItems.forEach(item => {
    item.onclick = () => {
        menuItems.forEach(i => {
            i.classList.remove('active');
        });

        item.classList.add('active');

        const target = item.dataset.section;

        sections.forEach(section => {
            if (section.id === target) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });

        if (target === 'dashboard') {
            carregarHistorico();
        }

        if (target === 'ranking') {
            carregarRanking();
        }
    };
});

// ======================
// MOBILE MENU
// ======================

const sidebar = document.querySelector('.sidebar');
const mobileBtn = document.getElementById('mobile-menu-btn');

mobileBtn.onclick = () => {
    sidebar.classList.toggle('open');
};

// ======================
// LOADING
// ======================

function showLoading() {
    document
        .getElementById('loading')
        .classList.remove('hidden');
}

function hideLoading() {
    document
        .getElementById('loading')
        .classList.add('hidden');
}

// ======================
// LOGOUT
// ======================

document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    window.location.href = '/login.html';
};

// ======================
// GERAR PROVA
// ======================

let questoes = [];
let timer;
let tempo = 0;

async function gerarProva() {
    showLoading();

    try {
        const faculdade =
            document.getElementById('faculdade').value;

        const curso =
            document.getElementById('curso').value;

        const quantidade =
            document.getElementById('quantidade').value || 10;

        const res = await fetch(
            `${API}/gerar-prova`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    faculdade,
                    curso,
                    quantidade
                })
            }
        );

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error);
        }

        questoes = data.questoes;

        renderProva();
        iniciarTimer(questoes.length);

    } catch (err) {
        console.log(err);
        alert('Erro ao gerar prova');
    } finally {
        hideLoading();
    }
}

document
    .getElementById('gerar-btn')
    .onclick = gerarProva;

// ======================
// RENDER QUESTÕES
// ======================

function renderProva() {
    const container =
        document.getElementById('prova-container');

    container.innerHTML = questoes.map((q, i) => `
        <div class="questao">
            <h3>Q${i + 1}</h3>

            <p>${q.enunciado}</p>

            ${Object.entries(q.opcoes).map(([letra, texto]) => `
                <label class="alternativa">
                    ${letra}) ${texto}
                    <input
                        type="radio"
                        name="q${i}"
                        value="${letra}"
                    >
                </label>
            `).join('')}
        </div>
    `).join('');

    document
        .getElementById('finalizar-btn')
        .classList.remove('hidden');
}

// ======================
// TIMER
// ======================

function iniciarTimer(qtd) {
    tempo = qtd * 5 * 60;

    clearInterval(timer);

    timer = setInterval(() => {
        if (tempo <= 0) {
            clearInterval(timer);

            alert('Tempo esgotado!');
            return;
        }

        const min = Math.floor(tempo / 60);
        const seg = tempo % 60;

        document.getElementById(
            'tempo-prova'
        ).textContent =
            `Tempo: ${min}m ${seg}s`;

        tempo--;
    }, 1000);
}

// ======================
// FINALIZAR PROVA
// ======================

document.getElementById(
    'finalizar-btn'
).onclick = async () => {

    const respostas = questoes.map((q, i) => {
        const marcada =
            document.querySelector(
                `input[name="q${i}"]:checked`
            );

        return {
            correta: q.correta,
            selecionada:
                marcada ? marcada.value : null
        };
    });

    const res = await fetch(
        `${API}/salvar-prova`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization:
                    `Bearer ${token}`
            },
            body: JSON.stringify({
                questoes: respostas
            })
        }
    );

    const data = await res.json();

    alert(
        `Acertos: ${data.acertos}\nPercentual: ${data.percentual.toFixed(1)}%`
    );
};

// ======================
// DASHBOARD
// ======================

let grafico = null;

async function carregarHistorico() {
    const res = await fetch(
        `${API}/provas`,
        {
            headers: {
                Authorization:
                    `Bearer ${token}`
            }
        }
    );

    const data = await res.json();
    const provas = data.provas || [];

    document.getElementById(
        'total-provas'
    ).textContent = provas.length;

    let media = 0;
    let melhor = 0;
    const pontos = [];

    provas.forEach(prova => {
        media += prova.percentual;
        pontos.push(prova.percentual);

        if (prova.percentual > melhor) {
            melhor = prova.percentual;
        }
    });

    media = provas.length
        ? media / provas.length
        : 0;

    document.getElementById(
        'media-acertos'
    ).textContent =
        `${media.toFixed(1)}%`;

    document.getElementById(
        'melhor-resultado'
    ).textContent =
        `${melhor.toFixed(1)}%`;

    const user =
        JSON.parse(
            localStorage.getItem('user')
        );

    document.getElementById(
        'nivel'
    ).textContent =
        user?.nivel || 1;

    document.getElementById(
        'resultado'
    ).innerHTML = provas.map((p, i) => `
        <div class="card">
            <h3>Prova #${i + 1}</h3>
            <p>${p.percentual.toFixed(1)}%</p>

            <a href="${API}/pdf/${p.id}" target="_blank">
                PDF
            </a>
        </div>
    `).join('');

    const ctx =
        document.getElementById(
            'graficoDesempenho'
        );

    if (grafico) {
        grafico.destroy();
    }

    grafico = new Chart(ctx, {
        type: 'line',
        data: {
            labels:
                pontos.map((_, i) => i + 1),
            datasets: [
                {
                    label: 'Desempenho',
                    data: pontos
                }
            ]
        }
    });
}

// ======================
// RANKING
// ======================

async function carregarRanking() {
    const res = await fetch(
        `${API}/ranking`
    );

    const data = await res.json();

    document.getElementById(
        'ranking-container'
    ).innerHTML =
        data.ranking.map((u, i) => `
        <div class="card">
            <h3>#${i + 1} ${u.username}</h3>
            <p>XP: ${u.xp}</p>
            <p>Nível: ${u.nivel}</p>
        </div>
    `).join('');
}

// ======================
// REDAÇÃO
// ======================

document.getElementById(
    'enviar-redacao'
).onclick = async () => {

    const tema =
        document.getElementById(
            'tema-redacao'
        ).value;

    const texto =
        document.getElementById(
            'texto-redacao'
        ).value;

    const res = await fetch(
        `${API}/corrigir-redacao`,
        {
            method: 'POST',
            headers: {
                'Content-Type':
                    'application/json',
                Authorization:
                    `Bearer ${token}`
            },
            body: JSON.stringify({
                tema,
                texto
            })
        }
    );

    const data = await res.json();

    document.getElementById(
        'feedback-redacao'
    ).innerHTML = `
        <div class="card">
            <h2>Nota: ${data.nota_total}</h2>
            <p>C1: ${data.competencia1}</p>
            <p>C2: ${data.competencia2}</p>
            <p>C3: ${data.competencia3}</p>
            <p>C4: ${data.competencia4}</p>
            <p>C5: ${data.competencia5}</p>
            <hr>
            <p>${data.feedback}</p>
        </div>
    `;
};
