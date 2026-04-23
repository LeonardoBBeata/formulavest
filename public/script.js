// --------------------
// CONFIG
// --------------------
const API = "https://formulavest-2.onrender.com";

const sections = document.querySelectorAll('.section');
const menuItems = document.querySelectorAll('.sidebar nav ul li');

// --------------------
// FETCH PADRÃO
// --------------------
async function apiFetch(path, options = {}) {
    try {
        const res = await fetch(API + path, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            ...options
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Erro na requisição");

        return data;

    } catch (err) {
        console.error("API ERROR:", err.message);
        throw err;
    }
}

// --------------------
// NAVEGAÇÃO
// --------------------
menuItems.forEach(item => {
    item.addEventListener('click', () => {

        menuItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const target = item.dataset.section;

        sections.forEach(s =>
            s.id === target
                ? s.classList.remove('hidden')
                : s.classList.add('hidden')
        );

        if (target === 'dashboard') carregarHistorico();
    });
});

// --------------------
// TEMA
// --------------------
const temaToggle = document.getElementById('tema-toggle');

if (localStorage.getItem('tema') === 'dark') {
    document.body.classList.add('dark');
    temaToggle.checked = true;
}

temaToggle.addEventListener('change', () => {
    if (temaToggle.checked) {
        document.body.classList.add('dark');
        localStorage.setItem('tema', 'dark');
    } else {
        document.body.classList.remove('dark');
        localStorage.setItem('tema', 'light');
    }
});

// --------------------
// LOGIN / REGISTRO
// --------------------
document.getElementById('show-register').onclick = () =>
    document.getElementById('register-box').classList.remove('hidden');

document.getElementById('show-login').onclick = () =>
    document.getElementById('register-box').classList.add('hidden');

// REGISTRAR
document.getElementById('register-btn').onclick = async () => {
    try {
        await apiFetch('/register', {
            method: 'POST',
            body: JSON.stringify({
                username: reg_username.value,
                senha: reg_senha.value
            })
        });

        alert("Registrado com sucesso!");
        document.getElementById('register-box').classList.add('hidden');

    } catch (e) {
        alert(e.message);
    }
};

// LOGIN
document.getElementById('login-btn').onclick = async () => {
    try {
        await apiFetch('/login', {
            method: 'POST',
            body: JSON.stringify({
                username: login_username.value,
                senha: login_senha.value
            })
        });

        location.reload();

    } catch (e) {
        alert(e.message);
    }
};

// LOGOUT
document.getElementById('logout-btn').onclick = async () => {
    await apiFetch('/logout', { method: 'POST' });
    location.reload();
};

// --------------------
// GERAR PROVA
// --------------------
let questoes = [];
let cronometroInterval;
let tempoGastoSegundos = 0;

document.getElementById('gerar-btn').onclick = async () => {

    const faculdade = document.getElementById('faculdade').value;
    const curso = document.getElementById('curso').value;
    const quantidade = document.getElementById('quantidade').value || 10;

    if (!faculdade || !curso) return alert("Preencha tudo!");

    prova_container.innerHTML = "Gerando...";

    try {
        const data = await apiFetch('/gerar-prova', {
            method: 'POST',
            body: JSON.stringify({ faculdade, curso, quantidade })
        });

        if (!data.questoes) throw new Error("IA falhou");

        questoes = data.questoes;

        exibirProva();
        iniciarCronometro(questoes.length);

    } catch (e) {
        prova_container.innerHTML = "";
        alert(e.message);
    }
};

function exibirProva() {
    prova_container.innerHTML = questoes.map((q, i) => `
        <div class="questao">
            <p><strong>Q${i + 1}</strong>: ${q.enunciado}</p>

            ${Object.entries(q.opcoes).map(([l, t]) => `
                <label>
                    ${l}) ${t}
                    <input type="radio" name="q${i}" value="${l}">
                </label>
            `).join('')}
        </div>
    `).join('');

    document.getElementById('finalizar-btn').classList.remove('hidden');
}

// --------------------
// CRONÔMETRO
// --------------------
function iniciarCronometro(qtd) {
    tempoGastoSegundos = qtd * 5 * 60;

    clearInterval(cronometroInterval);

    cronometroInterval = setInterval(() => {

        const min = Math.floor(tempoGastoSegundos / 60);
        const seg = tempoGastoSegundos % 60;

        document.getElementById('tempo-prova').textContent =
            `Tempo restante: ${min}m ${seg}s`;

        if (tempoGastoSegundos <= 0) {
            clearInterval(cronometroInterval);
            alert("Tempo acabou!");
            finalizarProva();
        }

        tempoGastoSegundos--;

    }, 1000);
}

// --------------------
// FINALIZAR PROVA
// --------------------
document.getElementById('finalizar-btn').onclick = finalizarProva;

function finalizarProva() {

    clearInterval(cronometroInterval);

    const respostas = questoes.map((q, i) => {
        const marcada = document.querySelector(`input[name="q${i}"]:checked`);

        return {
            enunciado: q.enunciado,
            opcoes: q.opcoes,
            correta: q.correta,
            selecionada: marcada ? marcada.value : null
        };
    });

    apiFetch('/salvar-prova', {
        method: 'POST',
        body: JSON.stringify({
            questoes: respostas,
            tempo: 0
        })
    })
    .then(() => {
        alert("Prova salva!");
        carregarHistorico();
    })
    .catch(e => alert(e.message));
}

// --------------------
// ENEM COMPLETO
// --------------------
let enemQuestoes = [];

document.getElementById('enem-btn').onclick = async () => {

    enem_container.innerHTML = "Gerando ENEM...";

    try {
        const data = await apiFetch('/gerar-enem', {
            method: 'POST',
            body: JSON.stringify({ quantidade: 90 })
        });

        enemQuestoes = data.questoes;

        enem_container.innerHTML = enemQuestoes.map((q, i) => `
            <div class="questao">
                <p><strong>Q${i + 1}</strong>: ${q.enunciado}</p>
            </div>
        `).join('');

    } catch (e) {
        enem_container.innerHTML = "";
        alert(e.message);
    }
};

// --------------------
// DASHBOARD
// --------------------
async function carregarHistorico() {
    try {
        const data = await apiFetch('/provas');

        resultado.innerHTML = data.provas.map((p, i) => `
            <div class="prova-card">
                <h4>Prova ${i + 1}</h4>
            </div>
        `).join('');

    } catch (e) {
        console.error(e);
    }
}

// --------------------
// REDAÇÃO
// --------------------
document.getElementById('enviar-redacao').onclick = async () => {

    const tema = tema_redacao.value;
    const texto = texto_redacao.value;

    if (!tema || !texto) return alert("Preencha tudo");

    try {
        const data = await apiFetch('/corrigir-redacao', {
            method: 'POST',
            body: JSON.stringify({ tema, texto })
        });

        feedback_redacao.innerHTML = `
            <h3>Nota: ${data.nota}</h3>
            <p>${data.feedback}</p>
        `;

    } catch (e) {
        alert(e.message);
    }
};
