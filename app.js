// ==================== APP.JS (DASHBOARD PREMIUM MOBILE) ====================

let listaCompletaGlobal = []; 
let itensRenderizados = 0;    
const LOTE_CARREGAMENTO = 50; 
let carregandoBloqueio = false; 

// Base de dados calculada
let dadosGlobais = {}; 

// --- UTILIDADES ---
function extrairIdYoutube(url) {
    if (!url) return null;
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
}

// ==========================================
// MOTOR DE FOTOS (A ESTRATÉGIA GENIAL DO SEU GERENCIADOR)
// ==========================================
function gerarAvatar(nome, url) {
    const nomeLimpo = nome ? nome.replace('@', '').trim() : "User";
    const letra = nomeLimpo.charAt(0).toUpperCase();
    
    // Cria um fundo colorido baseado no nome do jogador (igual ao seu sistema)
    const cores = ['#ff0055', '#00f2ea', '#ffd700', '#a200ff', '#00ff00'];
    const hash = nomeLimpo.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const corEscolhida = cores[hash % cores.length];

    // Pega a URL que veio do JSON. Se não vier, tenta a sorte com o Unavatar
    let fotoSrc = url; 
    if (!fotoSrc || fotoSrc.length < 5 || fotoSrc.includes('undefined')) {
        const dataHoje = new Date().toISOString().split('T')[0]; 
        fotoSrc = `https://unavatar.io/tiktok/${nomeLimpo}?t=${dataHoje}`;
    }

    // O TRUQUE: A letra fica no fundo. A foto fica por cima. 
    // O comando onerror="this.style.display='none'" faz a foto sumir se o TikTok bloquear, revelando a letra perfeitamente!
    return `
        <div style="position: relative; width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: ${corEscolhida}; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #111; font-size: 1.2rem; border: 2px solid ${corEscolhida};">
            ${letra}
            <img src="${fotoSrc}" 
                 referrerpolicy="no-referrer" 
                 loading="lazy" 
                 style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 10;" 
                 onerror="this.style.display='none'">
        </div>
    `;
}

// --- INICIALIZAÇÃO ---
document.addEventListener("DOMContentLoaded", () => {
    carregarVideosHistorico();
    calcularRankingsGlobais(); 

    // VERIFICA SE É O PRIMEIRO ACESSO PARA MOSTRAR O TUTORIAL
    if (!localStorage.getItem('tutorialVisto')) {
        document.getElementById('modal-tutorial').style.display = 'flex';
    }

    let timerRolagem;
    window.addEventListener('scroll', () => {
        if (document.getElementById("view-ranking").classList.contains("hidden")) return;
        if (carregandoBloqueio) return;
        
        clearTimeout(timerRolagem);
        timerRolagem = setTimeout(() => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300) {
                carregarMaisItens();
            }
        }, 100);
    });
});

// FUNÇÃO PARA FECHAR O TUTORIAL E NUNCA MAIS MOSTRAR
function fecharTutorial() {
    document.getElementById('modal-tutorial').style.display = 'none';
    localStorage.setItem('tutorialVisto', 'true'); // Salva no celular da pessoa
}

// --- NAVEGAÇÃO DE ABAS ---
function mudarAba(abaDestino) {
    // 1. Esconde TODAS as telas
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-videos').classList.add('hidden');
    document.getElementById('view-ranking').classList.add('hidden');
    if (document.getElementById('view-jogos')) document.getElementById('view-jogos').classList.add('hidden');
    
    // 2. Remove o brilho de TODOS os botões
    document.getElementById('nav-dash').classList.remove('active');
    document.getElementById('nav-videos').classList.remove('active');
    if (document.getElementById('nav-jogos')) document.getElementById('nav-jogos').classList.remove('active');

    // 3. Mostra apenas a aba que foi clicada
    if (abaDestino === 'dashboard') {
        document.getElementById('view-dashboard').classList.remove('hidden');
        document.getElementById('nav-dash').classList.add('active');
        document.getElementById('page-title').innerText = "Dashboard Geral";
    } 
    else if (abaDestino === 'videos') {
        document.getElementById('view-videos').classList.remove('hidden');
        document.getElementById('nav-videos').classList.add('active');
        document.getElementById('page-title').innerText = "Histórico";
    }
    else if (abaDestino === 'jogos') {
        document.getElementById('view-jogos').classList.remove('hidden');
        document.getElementById('nav-jogos').classList.add('active');
        document.getElementById('page-title').innerText = "Fliperama";
    }
}


// --- BUSCA GLOBAL ---
function focarBusca() {
    const box = document.getElementById('search-box');
    box.style.display = 'flex';
    document.getElementById('globalSearch').focus();
}

// ==========================================
// MÁGICA: CÁLCULO DO RANKING GLOBAL (OTIMIZADO PARA CELULAR FRACO)
// ==========================================
async function calcularRankingsGlobais() {
    if(typeof LISTA_DE_VIDEOS === 'undefined') return;

    // Coloca um aviso visual para o usuário saber que o sistema está trabalhando
    const divWins = document.getElementById('global-wins-container');
    const divKills = document.getElementById('global-kills-container');
    if (divWins) divWins.innerHTML = '<div style="text-align:center; width: 100%; color:#00f2ea; padding: 15px;"><i class="fas fa-circle-notch fa-spin"></i> Puxando histórico da arena...</div>';
    if (divKills) divKills.innerHTML = '<div style="text-align:center; width: 100%; color:#ff0055; padding: 15px;"><i class="fas fa-circle-notch fa-spin"></i> Contando abates...</div>';

    // O SEGREDO: Em vez de baixar tudo de uma vez, baixamos um por um (fila)
    for (let i = 0; i < LISTA_DE_VIDEOS.length; i++) {
        const video = LISTA_DE_VIDEOS[i];
        
        try {
            const response = await fetch(video.arquivo);
            if (!response.ok) continue;
            const data = await response.json();

            if(!data || !data.placar) continue;
            
            data.placar.forEach(p => {
                const fotoReal = p.foto || p.foto_url || "";
                
                if(!dadosGlobais[p.nome]) {
                    dadosGlobais[p.nome] = { nome: p.nome, wins: 0, kills: 0, matches: 0, foto: fotoReal, vitimas: [] };
                }
                
                dadosGlobais[p.nome].matches++;
                dadosGlobais[p.nome].kills += p.kills;
                if(p.posicao === 1) dadosGlobais[p.nome].wins++;
                if(fotoReal) dadosGlobais[p.nome].foto = fotoReal; 

                if (p.vitimas && Array.isArray(p.vitimas)) {
                    p.vitimas.forEach(vitimaNome => {
                        if (!dadosGlobais[p.nome].vitimas.includes(vitimaNome)) {
                            dadosGlobais[p.nome].vitimas.push(vitimaNome);
                        }
                    });
                }
            });
        } catch (err) {
            console.log("Falha ao carregar a partida:", video.arquivo);
        }
    }

    // Depois que terminou de calcular um por um, mostra na tela
    renderizarCarrosseisDashboard();
}

function renderizarCarrosseisDashboard() {
    const arrJogadores = Object.values(dadosGlobais);

    const topVencedores = [...arrJogadores].sort((a, b) => b.wins - a.wins).filter(j => j.wins > 0).slice(0, 10);
    const divWins = document.getElementById('global-wins-container');
    divWins.innerHTML = '';
    
    if (topVencedores.length === 0) {
        divWins.innerHTML = '<div style="color:#666; font-size: 12px; width:100%; text-align:center;">Nenhum vencedor registrado ainda.</div>';
    } else {
        topVencedores.forEach((jog, index) => {
            let medalha = index === 0 ? '👑' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : `#${index+1}`));
            let corScore = index === 0 ? 'score-gold' : '';
            let div = document.createElement('div');
            div.className = `top-card rank-${index+1}`;
            div.onclick = () => abrirPerfil(jog.nome);
            div.innerHTML = `
                <div class="top-medal">${medalha}</div>
                <div class="top-avatar" style="padding:0; overflow:hidden;">${gerarAvatar(jog.nome, jog.foto)}</div>
                <div class="top-name">${jog.nome}</div>
                <div class="top-score ${corScore}">${jog.wins} Vitórias</div>
            `;
            divWins.appendChild(div);
        });
    }

    const topMatadores = [...arrJogadores].sort((a, b) => b.kills - a.kills).filter(j => j.kills > 0).slice(0, 10);
    const divKills = document.getElementById('global-kills-container');
    divKills.innerHTML = '';

    if (topMatadores.length === 0) {
        divKills.innerHTML = '<div style="color:#666; font-size: 12px; width:100%; text-align:center;">Nenhum abate registrado.</div>';
    } else {
        topMatadores.forEach((jog, index) => {
            let div = document.createElement('div');
            div.className = `top-card`;
            div.style.borderColor = index === 0 ? '#ff0055' : 'rgba(255,255,255,0.05)';
            div.onclick = () => abrirPerfil(jog.nome);
            div.innerHTML = `
                <div class="top-medal" style="font-size:14px; background:#111; border-radius:5px; padding:2px 5px; border:1px solid #333;">#${index+1}</div>
                <div class="top-avatar" style="padding:0; overflow:hidden; ${index===0 ? 'border-color:#ff0055; box-shadow: 0 0 10px #ff0055;' : ''}">${gerarAvatar(jog.nome, jog.foto)}</div>
                <div class="top-name">${jog.nome}</div>
                <div class="top-score score-red">${jog.kills} KILLS</div>
            `;
            divKills.appendChild(div);
        });
    }
}

// ==========================================
// LISTA DE VÍDEOS E RANKING INDIVIDUAL
// ==========================================
function carregarVideosHistorico() {
    const container = document.getElementById("lista-videos-container");
    if(!container) return;
    container.innerHTML = "";
    
    if(typeof LISTA_DE_VIDEOS !== 'undefined') {
        LISTA_DE_VIDEOS.forEach((video) => {
            const card = document.createElement("div");
            card.className = "card-video";
            card.onclick = () => abrirRankingPartida(video);
            
            let thumbImage = video.thumb || "https://placehold.co/600x300/151720/00f2ea?text=Batalha+Gravada";

            card.innerHTML = `
                <div class="thumb-container">
                    <img src="${thumbImage}" class="thumb-img" alt="Batalha">
                    <div class="play-badge"><i class="fas fa-play" style="margin-left:3px;"></i></div>
                </div>
                <div class="card-info">
                    <span class="card-title">${video.titulo}</span>
                    <span class="card-date"><i class="far fa-calendar-alt"></i> ${video.data}</span>
                </div>
            `;
            container.appendChild(card);
        });
    }
}

function abrirRankingPartida(video) {
    document.getElementById("view-videos").classList.add("hidden");
    document.getElementById("view-dashboard").classList.add("hidden");
    document.getElementById("view-ranking").classList.remove("hidden");
    document.getElementById("page-title").innerText = "Resultado da Arena";
    
    const headerAction = document.getElementById("header-action");
    if(video.videoUrl) {
        headerAction.innerHTML = `
            <button onclick="window.open('${video.videoUrl}', '_blank')" style="width:100%; background:linear-gradient(90deg, #ff0055, #ff00aa); border:none; color:white; border-radius:10px; padding:10px; font-weight:800; text-transform:uppercase; box-shadow: 0 4px 15px rgba(255,0,85,0.4);">
                <i class="fas fa-play-circle"></i> Assistir Gravação
            </button>`;
    }

    const listaTopo = document.getElementById("lista-jogadores-topo");
    const listaResto = document.getElementById("lista-jogadores-resto");
    
    listaTopo.innerHTML = `<div style="text-align:center; padding:50px; color:#00f2ea;"><i class="fas fa-circle-notch fa-spin fa-2x"></i><br><br>Puxando dados do servidor...</div>`;
    listaResto.innerHTML = ""; 

    fetch(video.arquivo)
        .then(res => res.ok ? res.json() : { placar: [] })
        .then(json => {
            listaCompletaGlobal = json.placar;
            // Se o arquivo JSON tiver a variável 'total_falso', usa ela. 
            // Caso seja um arquivo JSON antigo (que não tinha isso), usa o tamanho da lista (length).
            const totalMostrar = json.total_falso ? json.total_falso : listaCompletaGlobal.length;
            
            // O toLocaleString('pt-BR') formata o número pra ficar bonitão (ex: 91.500)
            document.getElementById("total-players-count").innerText = totalMostrar.toLocaleString('pt-BR');
            if(listaCompletaGlobal.length > 0) {
                // Descobre quem é o Top Killer
                const topKiller = listaCompletaGlobal.reduce((prev, curr) => (prev.kills > curr.kills) ? prev : curr);
                
                // Atualiza o HTML para mostrar o Nome e as Kills embaixo
                document.getElementById("top-kill-count").innerHTML = `
                    <span style="font-size: 14px; color: #ffffff; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; margin: 0 auto;">${topKiller.nome}</span>
                    <span style="font-size: 12px; color: var(--danger);"><i class="fas fa-crosshairs"></i> ${topKiller.kills} Kills</span>
                `;
            }
            iniciarRenderizacaoRanking();
        })
        .catch(err => {
            listaTopo.innerHTML = `<div style="text-align:center; color:#ff0055; padding:20px;">Erro ao carregar dados.</div>`;
        });
}

function iniciarRenderizacaoRanking() {
    document.getElementById("lista-jogadores-topo").innerHTML = ""; 
    document.getElementById("lista-jogadores-resto").innerHTML = ""; 
    itensRenderizados = 0;    
    carregarMaisItens();      
}

function carregarMaisItens() {
    if (itensRenderizados >= listaCompletaGlobal.length) return; 
    carregandoBloqueio = true; 
    
    const containerTopo = document.getElementById("lista-jogadores-topo");
    const containerResto = document.getElementById("lista-jogadores-resto");
    
    const fim = Math.min(itensRenderizados + LOTE_CARREGAMENTO, listaCompletaGlobal.length);
    const lote = listaCompletaGlobal.slice(itensRenderizados, fim);

    const fragmentoTopo = document.createDocumentFragment();
    const fragmentoResto = document.createDocumentFragment();

    lote.forEach((p, indexLote) => {
        const indexReal = itensRenderizados + indexLote; 
        const isTop1 = p.posicao === 1;

        const row = document.createElement("div");
        row.className = `player-row ${isTop1 ? 'top-1-row' : ''}`;
        row.onclick = () => abrirPerfil(p.nome);

        let statusText = isTop1 ? '🏆 Grande Campeão' : (p.posicao <= 10 ? '🔥 Elite (Top 10)' : 'Sobrevivente');
        const fotoReal = p.foto || p.foto_url || "";

        row.innerHTML = `
            <div class="rank-num">#${p.posicao}</div>
            <div class="p-avatar" style="padding:0; overflow:hidden;">${gerarAvatar(p.nome, fotoReal)}</div>
            <div class="p-info">
                <div class="p-name" style="${isTop1 ? 'color:gold;' : ''}">${p.nome}</div>
                <div class="p-detail">${statusText}</div>
            </div>
            <div class="p-kills">${p.kills} <i class="fas fa-crosshairs" style="font-size:10px;"></i></div>
        `;
        
        if (indexReal < 3) fragmentoTopo.appendChild(row);
        else fragmentoResto.appendChild(row);
    });

    containerTopo.appendChild(fragmentoTopo);
    containerResto.appendChild(fragmentoResto);

    itensRenderizados = fim;
    carregandoBloqueio = false; 
}

// ==========================================
// MODAL DE PERFIL
// ==========================================
function abrirPerfil(nome) {
    const modal = document.getElementById("modal-perfil");
    modal.style.display = "flex";
    document.getElementById("perfil-nome").innerText = nome;
    
    const avatarHtml = gerarAvatar(nome, dadosGlobais[nome] ? dadosGlobais[nome].foto : ""); 
    document.getElementById("perfil-avatar").innerHTML = avatarHtml;

    if (dadosGlobais[nome]) {
        document.getElementById("stat-vitorias").innerText = dadosGlobais[nome].wins;
        document.getElementById("stat-kills").innerText = dadosGlobais[nome].kills;
        document.getElementById("stat-partidas").innerText = dadosGlobais[nome].matches;
        
        let badgeText = "Guerreiro Iniciante";
        if (dadosGlobais[nome].wins > 0) badgeText = "👑 Lenda da Arena";
        else if (dadosGlobais[nome].kills > 50) badgeText = "☠️ Exterminador";
        document.getElementById("perfil-badge").innerText = badgeText;
    }

    const histContainer = document.getElementById("perfil-historico");
    let htmlHist = "";
    
    LISTA_DE_VIDEOS.forEach((video) => {
        fetch(video.arquivo).then(r=>r.json()).then(data => {
            if(data && data.placar) {
                const p = data.placar.find(x => x.nome === nome);
                if(p) {
                    const colorClass = p.posicao === 1 ? "color:#ffd700;" : "color:#00f2ea;";
                    const icon = p.posicao === 1 ? "fa-trophy" : "fa-shield-alt";
                    const newHtml = `
                        <div class="hist-item">
                            <span style="color:#8892b0; max-width:60%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${video.titulo}</span>
                            <span style="${colorClass} font-weight:800;">
                                <i class="fas ${icon}"></i> #${p.posicao} (${p.kills} K)
                            </span>
                        </div>`;
                    histContainer.innerHTML += newHtml;
                }
            }
        }).catch(e=>{});
    });

    histContainer.innerHTML = ""; 

    // ==========================================================
    // NOVA LÓGICA: RENDERIZANDO A LISTA DE VÍTIMAS NO PERFIL
    // ==========================================================
    const vitimasContainer = document.querySelectorAll(".sheet-history")[1]; 
    vitimasContainer.innerHTML = "";

    if (dadosGlobais[nome] && dadosGlobais[nome].vitimas && dadosGlobais[nome].vitimas.length > 0) {
        const vitimasMostrar = dadosGlobais[nome].vitimas.slice(-30).reverse(); // Mostra só as 30 últimas para não travar o celular

        vitimasMostrar.forEach(nomeVitima => {
            const fotoVitima = dadosGlobais[nomeVitima] ? dadosGlobais[nomeVitima].foto : "";
            
            vitimasContainer.innerHTML += `
                <div class="hist-item" style="justify-content: flex-start; gap: 12px; padding: 8px 10px; background: rgba(255, 0, 85, 0.05); border-radius: 8px; margin-bottom: 5px; border-left: 3px solid #ff0055;">
                    <div style="width: 32px; height: 32px; flex-shrink: 0;">${gerarAvatar(nomeVitima, fotoVitima)}</div>
                    <span style="color: #e2e8f0; font-weight: 600; font-size: 14px;">
                        <i class="fas fa-skull" style="font-size: 10px; color: #ff0055; margin-right: 5px;"></i> ${nomeVitima}
                    </span>
                </div>
            `;
        });
    } else {
        vitimasContainer.innerHTML = `<div style="text-align: center; font-size: 12px; color: #666; padding: 10px;">Ainda não eliminou ninguém.</div>`;
    }
    // ==========================================================
}

function fecharPerfil() { document.getElementById("modal-perfil").style.display = "none"; }

document.getElementById("modal-perfil").onclick = (e) => {
    if(e.target.id === "modal-perfil") fecharPerfil();
}

// --- BUSCA GLOBAL ---
function fecharBusca() {
    document.getElementById('search-box').style.display = 'none';
    document.getElementById('globalSearch').value = '';
    filtrarListaGlobal(); // Aciona o filtro vazio para restaurar a tela original
}

// --- PESQUISA ---
function filtrarListaGlobal() {
    const termo = document.getElementById("globalSearch").value.toLowerCase();
    
    // 1. Pesquisa DENTRO de uma partida (Aba Ranking Específico)
    // Mantém a busca funcionando apenas para os sobreviventes daquela partida
    if (!document.getElementById("view-ranking").classList.contains("hidden")) {
        const filtrados = listaCompletaGlobal.filter(p => p.nome.toLowerCase().includes(termo));
        const containerTopo = document.getElementById("lista-jogadores-topo");
        const containerResto = document.getElementById("lista-jogadores-resto");
        containerTopo.innerHTML = ""; containerResto.innerHTML = "";
        
        filtrados.slice(0, 100).forEach((p, index) => {
             const row = document.createElement("div");
             const fotoReal = p.foto || p.foto_url || "";
             row.className = `player-row ${p.posicao === 1 ? 'top-1-row' : ''}`;
             row.onclick = () => abrirPerfil(p.nome);
             row.innerHTML = `
                <div class="rank-num">#${p.posicao}</div>
                <div class="p-avatar" style="padding:0; overflow:hidden;">${gerarAvatar(p.nome, fotoReal)}</div>
                <div class="p-info"><div class="p-name">${p.nome}</div><div class="p-detail">Resultado da busca</div></div>
                <div class="p-kills">${p.kills}</div>`;
             if (index < 3) containerTopo.appendChild(row);
             else containerResto.appendChild(row);
        });
        return;
    }

    // ==============================================================
    // 2. BUSCA UNIVERSAL (Acontece na aba Partidas ou Dashboard)
    // ==============================================================
    let resultContainer = document.getElementById("search-results-global");
    
    // Cria o container de resultados caso ele não exista ainda no HTML
    if (!resultContainer) {
        resultContainer = document.createElement("div");
        resultContainer.id = "search-results-global";
        resultContainer.className = "players-list fade-in";
        resultContainer.style.paddingTop = "15px";
        document.querySelector(".app-content").appendChild(resultContainer);
    }

    const viewDashboard = document.getElementById("view-dashboard");
    const viewVideos = document.getElementById("view-videos");

    // Se o usuário apagou o texto (ou fechou a busca), volta a tela ao normal
    if (termo.length === 0) {
        resultContainer.style.display = "none";
        resultContainer.innerHTML = "";
        
        // Remove os display "none" forçados
        viewDashboard.style.display = "";
        viewVideos.style.display = "";
        return;
    }

    // Oculta os vídeos e os carrosséis para dar espaço aos resultados
    viewDashboard.style.display = "none";
    viewVideos.style.display = "none";
    
    // Mostra o container de resultados
    resultContainer.style.display = "block";
    resultContainer.innerHTML = `<div class="section-header" style="margin-bottom: 15px;"><h3><i class="fas fa-search" style="color:var(--primary);"></i> Guerreiros Encontrados</h3></div>`;

    // Procura em todo o banco de dados
    const todosJogadores = Object.values(dadosGlobais);
    const filtrados = todosJogadores.filter(p => p.nome.toLowerCase().includes(termo));

    if (filtrados.length === 0) {
        resultContainer.innerHTML += `<div style="text-align:center; color:#8892b0; padding:30px;">Nenhum guerreiro com esse nome.</div>`;
    } else {
        // Mostra os 50 primeiros para não travar o celular
        filtrados.slice(0, 50).forEach(p => {
            const row = document.createElement("div");
            row.className = `player-row`;
            row.style.cursor = "pointer";
            row.onclick = () => {
                fecharBusca(); // Fecha a barra ao clicar
                abrirPerfil(p.nome);
            };
            
            let detalhes = `${p.matches} Partida(s) | ${p.kills} Kills`;
            let corNome = p.wins > 0 ? 'color: var(--gold);' : 'color: var(--text-main);';
            
            row.innerHTML = `
                <div class="p-avatar" style="padding:0; overflow:hidden;">${gerarAvatar(p.nome, p.foto)}</div>
                <div class="p-info">
                    <div class="p-name" style="${corNome}">${p.nome} ${p.wins > 0 ? '👑' : ''}</div>
                    <div class="p-detail">${detalhes}</div>
                </div>
                <div class="p-kills" style="background:transparent; border:none; font-size:16px; color:var(--primary);">
                    <i class="fas fa-chevron-right"></i>
                </div>
            `;
            resultContainer.appendChild(row);
        });
    }
}

// Função para entrar no jogo
function entrarNoJogoCobrinha() {
    // 1. Pergunta o nome do jogador
    let nick = prompt("Digite seu @ do TikTok para jogar:");
    
    if (nick && nick.trim() !== "") {
        // 2. Salva o nome na memória do navegador
        localStorage.setItem("jogadorCobrinha", nick.replace('@', '').trim());
        
        // 3. Manda a pessoa para a página isolada do jogo
        window.location.href = "cobrinha.html"; 
    }
}