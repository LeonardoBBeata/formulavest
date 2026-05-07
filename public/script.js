constAPI='https://SEU-BACKEND.onrender.com';
consttoken=localStorage.getItem('token');
if(!token){window.location.href='/login.html';
}
// MENU
constsections=document.querySelectorAll('.section');
constmenuItems=document.querySelectorAll('.sidebar li');
menuItems.forEach(item=>{item.onclick=()=>{menuItems.forEach(i=>{i.classList.remove('active');});
12
item.classList.add('active');consttarget=item.dataset.section;sections.forEach(s=>{if(s.id===target){s.classList.remove('hidden');}else{s.classList.add('hidden');}});if(target==='dashboard'){carregarHistorico();}if(target==='ranking'){carregarRanking();}};
});
// MOBILE
constsidebar=document.querySelector('.sidebar');
constmobileBtn=document.getElementById('mobile-menu-btn');
mobileBtn.onclick=()=>{sidebar.classList.toggle('open');
};
// LOADING
functionshowLoading(){document.getElementById('loading').classList.remove('hidden');
}
functionhideLoading(){document.getElementById('loading').classList.add('hidden');
}
// LOGOUT
document.getElementById('logout-btn')
.onclick=()=>{localStorage.removeItem('token');
13
localStorage.removeItem('user');window.location.href='/login.html';
};
// GERAR PROVA
letquestoes=[];
lettimer;
lettempo=0;
asyncfunctiongerarProva(){showLoading();try{constfaculdade=document.getElementById('faculdade').value;constcurso=document.getElementById('curso').value;constquantidade=document.getElementById('quantidade').value||10;constres=awaitfetch(`${API}/gerar-prova`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({faculdade,curso,quantidade})});constdata=awaitres.json();questoes=data.questoes;renderProva();iniciarTimer(questoes.length);
14
}catch(err){console.log(err);alert('Erro gerar prova');}finally{hideLoading();}
}
document.getElementById('gerar-btn')
.onclick=gerarProva;
functionrenderProva(){constcontainer=document.getElementById('prova-container');container.innerHTML=questoes.map((q,i)=>`
<div class="questao">
<h3>
Q${i+1}
</h3>
<p>${q.enunciado}
</p>${Object.entries(q.opcoes).map(([l,t])=>`
<label class="alternativa">${l}) ${t}
<input
type="radio"
name="q${i}"
value="${l}"
>
</label>
`).join('')}
</div>
15
`).join('');document.getElementById('finalizar-btn').classList.remove('hidden');
}
functioniniciarTimer(qtd){tempo=qtd*5*60;clearInterval(timer);timer=setInterval(()=>{constmin=Math.floor(tempo/60);constseg=tempo%60;document.getElementById('tempo-prova').textContent=`Tempo: ${min}m ${seg}s`;tempo--;},1000);
}
// FINALIZAR
document.getElementById('finalizar-btn')
.onclick=async()=>{constrespostas=questoes.map((q,i)=>{constr=document.querySelector(`input[name="q${i}"]:checked`);return{correta:q.correta,selecionada:r?r.value:null};});constres=awaitfetch(`${API}/salvar-prova`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
16
body:JSON.stringify({questoes:respostas})});constdata=awaitres.json();alert(`Acertos: ${data.acertos}`);
};
// DASHBOARD
asyncfunctioncarregarHistorico(){constres=awaitfetch(`${API}/provas`,{headers:{Authorization:`Bearer ${token}`}});constdata=awaitres.json();constprovas=data.provas||[];document.getElementById('total-provas').textContent=provas.length;letmedia=0;letmelhor=0;constpontos=[];provas.forEach(p=>{media+=p.percentual;pontos.push(p.percentual);if(p.percentual>melhor){melhor=p.percentual;}});media=provas.length
17
?media/provas.length:0;document.getElementById('media-acertos').textContent=`${media.toFixed(1)}%`;document.getElementById('melhor-resultado').textContent=`${melhor.toFixed(1)}%`;constuser=JSON.parse(localStorage.getItem('user'));document.getElementById('nivel').textContent=user.nivel;document.getElementById('resultado').innerHTML=provas.map((p,i)=>`
<div class="card">
<h3>Prova #${i+1}</h3>
<p>${p.percentual.toFixed(1)}%</p>
<a href="${API}/pdf/${p.id}" target="_blank">
PDF
</a>
</div>
`).join('');// chartconstctx=document.getElementById('graficoDesempenho');newChart(ctx,{type:'line',data:{labels:pontos.map((_,i)=>i+1),datasets:[{label:'Desempenho',data:pontos}]}});
18
}
// RANKING
asyncfunctioncarregarRanking(){constres=awaitfetch(`${API}/ranking`);constdata=awaitres.json();document.getElementById('ranking-container').innerHTML=data.ranking.map((u,i)=>`
<div class="card">
<h3>#${i+1}${u.username}</h3>
<p>XP: ${u.xp}</p>
<p>Nível: ${u.nivel}</p>
</div>
`).join('');
}
// REDAÇÃO
document.getElementById('enviar-redacao')
.onclick=async()=>{consttema=document.getElementById('tema-redacao').value;consttexto=document.getElementById('texto-redacao').value;constres=awaitfetch(`${API}/corrigir-redacao`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
19
body:JSON.stringify({
tema,
texto
})
}
);
const data = await res.json();
document.getElementById('feedback-redacao')
.innerHTML = `
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
