// --------------------
// CONFIG
// --------------------
const API = "https://formulavest-2.onrender.com";

// --------------------
// HELPERS
// --------------------
const $ = (id) => document.getElementById(id);

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

        if (!res.ok) throw new Error(data.error || "Erro na API");

        return data;

    } catch (err) {
        console.error("API ERROR:", err);
        throw err;
    }
}

// --------------------
// NAVEGAÇÃO
// --------------------
function setupNavigation() {
    const sections = document.querySelectorAll('.section');
    const menuItems = document.querySelectorAll('.sidebar nav ul li');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {

            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const target = item.dataset.section;

            sections.forEach(s => {
                s.classList.toggle('hidden', s.id !== target);
            });

            if (target === 'dashboard') carregarHistorico();
        });
    });
}

// --------------------
// TEMA
// --------------------
function setupTheme() {
    const toggle = $('tema-toggle');

    if (!toggle) return;

    const temaSalvo = localStorage.getItem('tema');

    if (temaSalvo === 'dark') {
        document.body.classList.add('dark');
        toggle.checked = true;
    }

    toggle.addEventListener('change', () => {
        const dark = toggle.checked;
        document.body.classList.toggle('dark', dark);
        localStorage.setItem('tema', dark ? 'dark' : 'light');
    });
}

// --------------------
// AUTH
// --------------------
function setupAuth() {

    $('show-register')?.addEventListener('click', () =>
        $('register-box').classList.remove('hidden')
    );

    $('show-login')?.addEventListener('click', () =>
        $('register-box').classList.add('hidden')
    );

    // REGISTRO
    $('register-btn')?.addEventListener('click', async () => {

        const username = $('reg-username').value.trim();
        const senha = $('reg-senha').value.trim();

        if (!username || !senha) return alert("Preencha tudo");

        try {
            await apiFetch('/register', {
                method: 'POST',
                body: JSON.stringify({ username, senha })
            });

            alert("Registrado com sucesso!");
            $('register-box').classList.add('hidden');

        } catch (e) {
            alert(e.message);
        }
    });

    // LOGIN
    $('login-btn')?.addEventListener('click', async () => {

        const username = $('login-username').value.trim();
        const senha = $('login-senha').value.trim();

        if (!username || !senha) return alert("Preencha tudo");

        try {
            await apiFetch('/login', {
                method: 'POST',
                body: JSON.stringify({ username, senha })
            });

            location.reload();

        } catch (e) {
            alert(e.message);
        }
    });

    // LOGOUT
    $('logout-btn')?.addEventListener('click', async () => {
        await apiFetch('/logout', { method: 'POST' });
        location.reload();
    });
}

// --------------------
// PROVA NORMAL
// --------------------
let questoes = [];
let cronometro;

function setupProva() {

    $('gerar-btn')?.addEventListener('click', async () => {

        const faculdade = $('faculdade').value.trim();
        const curso = $('curso').value.trim();
        const quantidade = Number($('quantidade').value) || 10;

        if (!faculdade || !curso) return alert("Preencha os campos");

        $('prova-container').innerHTML = "Gerando prova...";

        try {
            const data = await apiFetch('/gerar-prova', {
                method: 'POST',
                body: JSON.stringify({ faculdade, curso, quantidade })
            });

            if (!data.questoes) throw new Error("Falha da IA");

            questoes = data.questoes;

            renderProva();
            iniciarCronometro(quantidade);

        } catch (e) {
            $('prova-container').innerHTML = "";
            alert(e.message);
        }
    });

    $('finalizar-btn')?.addEventListener('click', finalizarProva);
}

function renderProva() {
    $('prova-container').innerHTML = questoes.map((q, i) => `
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

    $('finalizar-btn').classList.remove('hidden');
}

function iniciarCronometro(qtd) {
    let tempo = qtd * 5 * 60;

    clearInterval(cronometro);

    cronometro = setInterval(() => {
        const min = Math.floor(tempo / 60);
        const seg = tempo % 60;

        $('tempo-prova').textContent = `Tempo: ${min}m ${seg}s`;

        if (tempo-- <= 0) {
            clearInterval(cronometro);
            alert("Tempo acabou!");
            finalizarProva();
        }

    }, 1000);
}

async function finalizarProva() {
    clearInterval(cronometro);

    const respostas = questoes.map((q, i) => {
        const marcada = document.querySelector(`input[name="q${i}"]:checked`);

        return {
            enunciado: q.enunciado,
            opcoes: q.opcoes,
            correta: q.correta,
            selecionada: marcada ? marcada.value : null
        };
    });

    try {
        await apiFetch('/salvar-prova', {
            method: 'POST',
            body: JSON.stringify({ questoes: respostas, tempo: 0 })
        });

        alert("Prova salva!");
        carregarHistorico();

    } catch (e) {
        alert(e.message);
    }
}

// --------------------
// ENEM
// --------------------
function setupEnem() {

    $('enem-btn')?.addEventListener('click', async () => {

        $('enem-container').innerHTML = "Gerando ENEM...";

        try {
            const data = await apiFetch('/gerar-enem', {
                method: 'POST',
                body: JSON.stringify({ quantidade: 90 })
            });

            const questoes = data.questoes || [];

            $('enem-container').innerHTML = questoes.map((q, i) => `
                <div class="questao">
                    <p><strong>Q${i + 1}</strong>: ${q.enunciado}</p>
                </div>
            `).join('');

        } catch (e) {
            $('enem-container').innerHTML = "";
            alert(e.message);
        }
    });
}

// --------------------
// DASHBOARD
// --------------------
async function carregarHistorico() {
    try {
        const data = await apiFetch('/provas');

        const provas = data.provas || [];

        if (provas.length === 0) {
            $('resultado').innerHTML = "Nenhuma prova";
            return;
        }

        $('resultado').innerHTML = provas.map((p, i) => `
            <div class="prova-card">
                <h4>Prova ${i + 1}</h4>
                <p>${p.questoes.length} questões</p>
            </div>
        `).join('');

    } catch (e) {
        console.error(e);
    }
}

// --------------------
// REDAÇÃO
// --------------------
function setupRedacao() {

    $('enviar-redacao')?.addEventListener('click', async () => {

        const tema = $('tema-redacao').value.trim();
        const texto = $('texto-redacao').value.trim();

        if (!tema || !texto) return alert("Preencha tudo");

        try {
            const data = await apiFetch('/corrigir-redacao', {
                method: 'POST',
                body: JSON.stringify({ tema, texto })
            });

            $('feedback-redacao').innerHTML = `
                <h3>Nota: ${data.nota}</h3>
                <p>${data.feedback}</p>
            `;

        } catch (e) {
            alert(e.message);
        }
    });
}

// --------------------
// INIT
// --------------------
function init() {
    setupNavigation();
    setupTheme();
    setupAuth();
    setupProva();
    setupEnem();
    setupRedacao();
}

document.addEventListener('DOMContentLoaded', init);
