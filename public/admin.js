// --------------------
// ELEMENTOS
// --------------------
const loginBox = document.getElementById('login-admin');
const dashBox = document.getElementById('admin-dashboard');
const provasContainer = document.getElementById('provas-container');
const estatContainer = document.getElementById('estatisticas-admin');
const msgAdmin = document.getElementById('msg-admin');
let chart;

// --------------------
// LOGIN ADMIN
// --------------------
document.getElementById('admin-login-btn').addEventListener('click', async () => {
    const email = document.getElementById('admin-email').value;
    const senha = document.getElementById('admin-senha').value;

    try {
        const res = await fetch('/admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, senha })
        });
        const data = await res.json();

        if (data.ok) {
            loginBox.classList.add('hidden');
            dashBox.classList.remove('hidden');
            atualizarDashboard();
        } else {
            alert(data.error);
        }
    } catch (err) {
        console.error(err);
        alert("Erro no login admin");
    }
});

// --------------------
// LOGOUT
// --------------------
document.getElementById('admin-logout').addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST', credentials: 'include' });
    location.reload();
});

// --------------------
// CARREGAR USUÁRIOS
// --------------------
async function carregarUsuarios() {
    try {
        const res = await fetch('/admin/usuarios', { credentials: 'include' });
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const data = await res.json();
        const usuarios = data.usuarios || [];

        const container = document.getElementById('lista-usuarios');
        if (!usuarios.length) {
            container.innerHTML = "<p>Nenhum usuário encontrado</p>";
            return;
        }

        container.innerHTML = usuarios.map(u => `
            <div class="prova-card">
                <p><strong>${u.username}</strong> ${u.banido ? '🚫 (Banido)' : ''}</p>
                <button onclick="banirUsuario(${u.id})">
                    ${u.banido ? 'Desbanir' : 'Banir'}
                </button>
                <button onclick="excluirUsuario(${u.id})" style="background:#dc2626;color:white">
                    Excluir
                </button>
            </div>
        `).join('');
    } catch (err) {
        console.error("Erro ao carregar usuários:", err);
        document.getElementById('lista-usuarios').innerHTML = "<p>Erro ao carregar usuários</p>";
    }
}

// --------------------
// BANIR / DESBANIR USUÁRIO
// --------------------
async function banirUsuario(id) {
    try {
        const res = await fetch(`/admin/usuario/${id}/banir`, { method: 'PUT', credentials: 'include' });
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        carregarUsuarios();
    } catch (err) {
        console.error(err);
        alert("Erro ao atualizar status do usuário");
    }
}

// --------------------
// EXCLUIR USUÁRIO
// --------------------
async function excluirUsuario(id) {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
    try {
        const res = await fetch(`/admin/usuario/${id}`, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        carregarUsuarios();
    } catch (err) {
        console.error(err);
        alert("Erro ao excluir usuário");
    }
}

// --------------------
// CRIAR USUÁRIO
// --------------------
document.getElementById('criar-usuario-btn').addEventListener('click', async () => {
    const username = document.getElementById('novo-username').value;
    const senha = document.getElementById('novo-senha').value;

    if (!username || !senha) {
        msgAdmin.innerText = "Campos obrigatórios";
        return;
    }

    try {
        const res = await fetch('/admin/criar-usuario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, senha })
        });
        const data = await res.json();
        if (data.ok) {
            msgAdmin.innerText = "Usuário criado com sucesso!";
            carregarUsuarios();
        } else {
            msgAdmin.innerText = data.error;
        }
    } catch (err) {
        console.error(err);
        msgAdmin.innerText = "Erro ao criar usuário";
    }
});

// --------------------
// CARREGAR PROVAS
// --------------------
async function carregarProvas() {
    const filtro = document.getElementById('filtro-usuario')?.value?.toLowerCase() || "";

    try {
        const res = await fetch('/admin/provas', { credentials: 'include' });
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const data = await res.json();
        const provas = (data.provas || []).filter(p => p.username.toLowerCase().includes(filtro));

        if (!provas.length) {
            provasContainer.innerHTML = "<p>Nenhuma prova encontrada</p>";
            return;
        }

        provasContainer.innerHTML = provas.map(p => {
            const acertos = p.questoes.filter(q => q.selecionada === q.correta).length;
            return `
                <div class="prova-card">
                    <p><strong>${p.username}</strong></p>
                    <p>Acertos: ${acertos} / ${p.questoes.length}</p>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        provasContainer.innerHTML = "<p>Erro ao carregar provas</p>";
    }
}

// --------------------
// CARREGAR ESTATÍSTICAS
// --------------------
async function carregarEstatisticas() {
    try {
        const res = await fetch('/admin/provas', { credentials: 'include' });
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const data = await res.json();

        const provas = data.provas || [];
        if (!provas.length) {
            estatContainer.innerHTML = "<p>Sem dados</p>";
            return;
        }

        let totalProvas = provas.length;
        let totalQuestoes = 0;
        let totalAcertos = 0;
        let ranking = {};

        provas.forEach(p => {
            const acertos = p.questoes.filter(q => q.selecionada === q.correta).length;
            totalQuestoes += p.questoes.length;
            totalAcertos += acertos;
            ranking[p.username] = (ranking[p.username] || 0) + acertos;
        });

        const media = totalQuestoes ? Math.round((totalAcertos / totalQuestoes) * 100) : 0;
        const rankingOrdenado = Object.entries(ranking).sort((a, b) => b[1] - a[1]);
        const nomes = rankingOrdenado.map(r => r[0]);
        const pontos = rankingOrdenado.map(r => r[1]);

        estatContainer.innerHTML = `
            <div class="card-estat">
                <h3>Total de Provas</h3>
                <p>${totalProvas}</p>
            </div>
            <div class="card-estat">
                <h3>Total de Questões Respondidas</h3>
                <p>${totalQuestoes}</p>
            </div>
            <div class="card-estat">
                <h3>Média Geral de Acertos</h3>
                <p>${media}%</p>
            </div>
            <h3 style="margin-top:30px">🏆 Ranking</h3>
            ${rankingOrdenado.map((r, i) => `<p>${i + 1}º - ${r[0]} (${r[1]} pontos)</p>`).join('')}
            <canvas id="grafico"></canvas>
        `;

        const ctx = document.getElementById('grafico');
        if (chart) chart.destroy();

        chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: nomes,
                datasets: [{
                    label: 'Pontuação Total',
                    data: pontos,
                    backgroundColor: '#3b82f6'
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });

    } catch (err) {
        console.error(err);
        estatContainer.innerHTML = "<p>Erro ao carregar estatísticas</p>";
    }
}

// --------------------
// MENU LATERAL
// --------------------
document.querySelectorAll('.admin-sidebar li').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.admin-sidebar li').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const target = item.dataset.section;
        document.querySelectorAll('.admin-section').forEach(sec => {
            sec.id === target ? sec.classList.remove('hidden') : sec.classList.add('hidden');
        });

        if (target === "estatisticas") carregarEstatisticas();
        if (target === "usuarios") carregarUsuarios();
    });
});

// --------------------
// TOGGLE SIDEBAR
// --------------------
document.getElementById('toggle-sidebar').addEventListener('click', () => {
    document.getElementById('admin-sidebar').classList.toggle('collapsed');
});

// --------------------
// FILTRO POR USUÁRIO
// --------------------
document.getElementById('filtro-usuario')?.addEventListener('input', carregarProvas);

// --------------------
// ATUALIZAÇÃO AUTOMÁTICA
// --------------------
function atualizarDashboard() {
    carregarUsuarios();
    carregarProvas();
    carregarEstatisticas();
}
setInterval(atualizarDashboard, 5000);

// --------------------
// INICIAL
// --------------------
atualizarDashboard();