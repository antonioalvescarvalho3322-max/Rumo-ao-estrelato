/**
 * @file Telas do jogo: início, criação do jogador, escolhas (eventos e entrevistas),
 * fim da base, fim de temporada, janela de transferências e tela final da carreira.
 * Os botões usam data-act/data-arg; os cliques são tratados em js/main.js.
 */
'use strict';

/** Namespace das telas. */
const Screens = (() => {
  const { esc, fmtMoney, plural, signed } = Util;

  /** Escolhas feitas durante a criação do jogador (antes de existir uma carreira). */
  const setup = { nat: null, uf: null, club: null, list: [], shirt: '10' };

  // ---------------------------------------------------------------------------
  // Início e criação do jogador
  // ---------------------------------------------------------------------------

  /** Tela inicial, com opção de continuar a carreira salva. */
  function home() {
    const saved = Store.load();
    const canContinue = saved && saved.p && !saved.retired;
    UI.render(`
      <section class="home">
        <div class="kicker">Simulador de carreira</div>
        <h1>Rumo ao<br><span>Estrelato</span></h1>
        <p class="sub">Da base à aposentadoria. Suas atitudes definem a relação com o técnico, o elenco e a torcida, e os mata-matas são decididos nos seus pés.</p>
        <div class="home-actions">
          <button class="btn big" data-act="start">Iniciar jogo</button>
          ${canContinue ? `<button class="btn ghost" data-act="continue">Continuar carreira de ${esc(saved.p.name)} · ${saved.year}</button>` : ''}
        </div>
        <ul class="howto">
          <li><b>Escolhas</b><span>Entrevistas e atitudes mudam sua relação com técnico, elenco e torcida.</span></li>
          <li><b>Overall</b><span>Cresce com treino, títulos, artilharias e assistências.</span></li>
          <li><b>Mata-mata</b><span>Das oitavas em diante, você decide os lances.</span></li>
          <li><b>Legado</b><span>Do bom jogador aos GOATs. E só uma carreira rara supera o Rei.</span></li>
        </ul>
      </section>`, { hud: false, mood: 'setup' });
  }

  /**
   * Cabeçalho dos passos de criação.
   * @param {number} n Número do passo.
   * @param {string} title Título.
   * @param {string} [hint] Explicação.
   * @returns {string} HTML.
   */
  function stepHead(n, title, hint) {
    return `<div class="step"><span>Passo ${n} de 4</span></div><h2>${title}</h2>${hint ? `<p class="hint">${hint}</p>` : ''}`;
  }

  /** Passo 1: nacionalidade. */
  function nationPicker() {
    G = null;
    Object.assign(setup, { nat: null, uf: null, club: null, list: [] });
    const items = COUNTRIES.map(c => `
      <button class="pick" data-act="nation" data-arg="${c.id}">
        <span class="pflag">${c.flag}</span><span class="pname">${c.name}</span><small>${c.leagues[0]}</small>
      </button>`).join('');
    UI.render(`${stepHead(1, 'Onde você nasceu?', 'Sua nacionalidade define a seleção que você pode defender e o país da sua base.')}<div class="grid">${items}</div>`, { hud: false, mood: 'setup' });
  }

  /**
   * Guarda a nacionalidade e segue (brasileiros escolhem o estado).
   * @param {string} id Código do país.
   */
  function pickNation(id) {
    setup.nat = id;
    if (id === 'BR') return statePicker();
    clubPicker();
  }

  /** Passo 2 (só Brasil): estado de nascimento. */
  function statePicker() {
    const items = BR_STATES.map(s => `
      <button class="pick" data-act="state" data-arg="${s.uf}">
        <span class="pflag uf">${s.uf}</span><span class="pname">${s.name}</span><small>${s.clubs.slice(0, 3).map(c => c[0]).join(' · ')}</small>
      </button>`).join('');
    UI.render(`${stepHead(2, 'Em qual estado?', 'Você começa na base de um clube tradicional da sua região.')}<div class="grid">${items}</div>
      <button class="btn ghost" data-act="back-nation">Voltar</button>`, { hud: false, mood: 'setup' });
  }

  /**
   * Guarda o estado e segue para a escolha do clube.
   * @param {string} uf Sigla do estado.
   */
  function pickState(uf) {
    setup.uf = uf;
    clubPicker();
  }

  /** Passo 3: clube da base (com escudo oficial, quando cadastrado, e as cores do clube). */
  function clubPicker() {
    let list;
    if (setup.nat === 'BR') {
      list = BR_STATES.find(s => s.uf === setup.uf).clubs.map(([n, s, d]) => ({ n, s, d, c: 'BR' }));
    } else {
      list = World.country(setup.nat).clubs.map(([n, s]) => ({ n, s, d: 1, c: setup.nat }));
    }
    list.sort((a, b) => b.s - a.s);
    setup.list = list;
    const items = list.map((c, i) => {
      const play = c.s >= 78 ? 'Difícil' : c.s >= 68 ? 'Média' : c.s >= 58 ? 'Boa' : 'Alta';
      const crest = UI.crest(c.n, 'crest-lg');
      const kit = CLUB_COLORS[c.n] || (World.crest(c.n) && World.crest(c.n).colors);
      const badge = crest || (kit ? UI.jersey(World.kitColors(c.n), '', 'mini') : '');
      return `
      <button class="pick club" data-act="club" data-arg="${i}">
        <span class="club-head">${badge}<span class="pname">${esc(c.n)}</span></span>
        <small>${World.country(c.c).leagues[c.d - 1]}</small>
        <span class="kv"><small>Estrutura</small>${UI.levelBars(c.s)}</span>
        <span class="kv"><small>Chance de jogar</small><b>${play}</b></span>
      </button>`;
    }).join('');
    UI.render(`${stepHead(3, 'Escolha a sua base', 'Clube grande dá mais estrutura e potencial, mas é mais difícil virar titular.')}
      <div class="grid clubs">${items}</div>
      <button class="btn ghost" data-act="${setup.nat === 'BR' ? 'back-state' : 'back-nation'}">Voltar</button>`, { hud: false, mood: 'setup' });
  }

  /**
   * Guarda o clube e segue para os dados do jogador.
   * @param {number} index Posição do clube na lista.
   */
  function pickClub(index) {
    setup.club = setup.list[index].n;
    playerForm();
  }

  /** Passo 4: nome, número da camisa e posição. A camisa usa as cores do clube. */
  function playerForm() {
    const positions = POSITIONS.map((p, i) => `
      <label class="radio"><input type="radio" name="pos" value="${p.id}" ${i === 3 ? 'checked' : ''}><span>${p.name}</span></label>`).join('');
    const numbers = ['1', '4', '5', '7', '8', '9', '10', '11'].map(n => `<button type="button" class="chipbtn" data-act="shirt" data-arg="${n}">${n}</button>`).join('');
    const hasColors = Boolean(CLUB_COLORS[setup.club] || (World.crest(setup.club) && World.crest(setup.club).colors));
    UI.render(`${stepHead(4, 'Monte o seu jogador')}
      <div class="panel form">
        <div class="form-grid">
          <div class="shirt-preview" id="shirtPreview">${UI.jersey(World.kitColors(setup.club), setup.shirt, 'big')}</div>
          <div class="form-fields">
            <label for="pname">Nome do jogador</label>
            <input id="pname" maxlength="24" placeholder="Ex.: Joãozinho" autocomplete="off" />
            <label for="pshirt">Número da camisa</label>
            <input id="pshirt" inputmode="numeric" maxlength="2" value="${esc(setup.shirt)}" data-input="shirt" />
            <div class="chiprow">${numbers}</div>
            <p class="hint">${hasColors ? `A camisa usa as cores do ${esc(setup.club)}.` : `As cores do ${esc(setup.club)} ainda não estão cadastradas; a camisa usa o padrão do jogo.`}</p>
          </div>
        </div>
        <div class="label">Posição</div>
        <div class="radios">${positions}</div>
        <p class="hint">Base: ${UI.clubTag(setup.club)} · ${World.country(setup.nat).name}</p>
        <button class="btn big" data-act="create">Começar carreira</button>
      </div>
      <button class="btn ghost" data-act="back-club">Voltar</button>`, { hud: false, mood: 'setup' });
  }

  /**
   * Atualiza o número da camisa (botões rápidos ou campo de texto) e a prévia.
   * @param {string} value Número digitado ou escolhido.
   * @param {boolean} [fromInput] true quando veio do campo de texto (não reescreve o campo).
   */
  function setShirt(value, fromInput = false) {
    setup.shirt = String(value).replace(/\D/g, '').slice(0, 2);
    if (!fromInput) {
      const input = document.getElementById('pshirt');
      if (input) input.value = setup.shirt;
    }
    const preview = document.getElementById('shirtPreview');
    if (preview) preview.innerHTML = UI.jersey(World.kitColors(setup.club), setup.shirt || '?', 'big');
  }

  /** Cria a carreira com as escolhas da criação e começa a temporada de base. */
  function create() {
    const nameInput = document.getElementById('pname');
    const posInput = document.querySelector('input[name=pos]:checked');
    createCareer({
      nat: setup.nat,
      uf: setup.uf,
      club: setup.club,
      name: (nameInput && nameInput.value.trim()) || 'Joãozinho',
      pos: posInput ? posInput.value : 'ATA',
      shirt: setup.shirt && +setup.shirt > 0 ? String(+setup.shirt) : '10',
    });
    Season.startBase();
    Season.next();
  }

  // ---------------------------------------------------------------------------
  // Escolhas (eventos, entrevistas, convocação)
  // ---------------------------------------------------------------------------

  /**
   * Painel com os três fatores que decidem a entrevista.
   * @param {{stats: number, chem: number, fans: number}} f Fatores.
   * @returns {string} HTML.
   */
  function factorsPanel(f) {
    return `<div class="factors">
      <div><span>Elenco</span><b>${f.chem}</b></div>
      <div><span>Torcida</span><b>${f.fans}</b></div>
      <div><span>Números</span><b>${Interview.statsLabel(f.stats)}</b></div>
    </div>`;
  }

  /**
   * Tela de escolha.
   * @param {CareerEvent & {factors?: Object}} event Evento ou entrevista.
   */
  function choice(event) {
    const options = event.options.map((o, i) => `<button class="opt" data-act="choose" data-arg="${i}"><span>${o.label}</span><i class="arrow">→</i></button>`).join('');
    UI.render(`
      <section class="panel event">
        <div class="ev-icon">${UI.ICONS[event.icon] || '•'}</div>
        <h2>${event.title}</h2>
        <p class="lead">${event.text}</p>
        ${event.factors ? `<p class="hint">Na entrevista, o resultado depende do seu momento com o elenco, com a torcida e dos seus números.</p>${factorsPanel(event.factors)}` : ''}
        <div class="opts">${options}</div>
      </section>`);
  }

  /**
   * Resultado de uma escolha.
   * @param {{icon: string, title: string, choice: string, text: string, chips: Chip[], tier?: string, reason?: string, factors?: Object}} result
   */
  function choiceResult(result) {
    const tierLabel = { good: 'Funcionou', mid: 'Dividiu opiniões', bad: 'Deu errado' }[result.tier];
    UI.render(`
      <section class="panel event">
        <div class="ev-icon">${UI.ICONS[result.icon] || '•'}</div>
        <p class="muted">${esc(result.title)} · você escolheu</p>
        <h2 class="choice">${result.choice}</h2>
        ${tierLabel ? `<div class="tier ${result.tier}">${tierLabel}</div>` : ''}
        <p class="lead">${result.text}</p>
        ${result.reason ? `<p class="reason">${result.reason}</p><p class="factors-caption">Seu momento na hora da resposta</p>${factorsPanel(result.factors)}` : ''}
        ${UI.chips(result.chips)}
        <button class="btn big" data-act="next">Continuar</button>
      </section>`);
  }

  /**
   * Botões para escolher o treino de pré-temporada.
   * @returns {string} HTML.
   */
  function trainingPicker() {
    return `<div class="training">
      <h3>Pré-temporada</h3>
      <p class="hint">Escolha como vai treinar antes da próxima temporada.</p>
      <div class="opts">
        ${Progression.TRAININGS.map(t => `<button class="opt" data-act="training" data-arg="${t.id}"><span><b>${t.name}</b><small>${t.describe()}</small></span><i class="arrow">→</i></button>`).join('')}
      </div>
    </div>`;
  }

  /**
   * Fim da base: primeiro contrato profissional.
   * @param {{before: number, after: number, salary: number, situation: string}} view Dados calculados.
   */
  function baseEnd(view) {
    const club = World.current();
    UI.render(`
      <section class="panel">
        <div class="kicker">Fim da base</div>
        <h2>Primeiro contrato profissional</h2>
        <p>O ${UI.clubTag(G.club)} te promoveu ao time principal.</p>
        <div class="delta"><span>${view.before}</span><i>→</i><b>${view.after}</b><small>Overall</small></div>
        <p>Salário: <b>${fmtMoney(view.salary)}/ano</b> · Situação no elenco: <b>${view.situation}</b></p>
        <p class="hint">Agora você disputa ${World.leagueName(club)}${club.c === 'BR' ? ', o estadual' : ''} e a ${World.country(club.c).cup}.</p>
        ${trainingPicker()}
      </section>`);
  }

  /**
   * Fim de temporada: classificação, números, títulos, prêmios, evolução do overall
   * (com o motivo de cada ponto) e a escolha da pré-temporada.
   * @param {Object} view Dados calculados por Season (closeSeason).
   */
  function seasonEnd(view) {
    const st = view.stats;
    const isGK = G.p.pos === 'GOL';
    const diff = view.ovrEnd - view.ovrStart;
    const breakdown = view.breakdown.length
      ? `<ul class="breakdown">${view.breakdown.map(b => `<li><span>${b.reason}</span><b class="${b.delta > 0 ? 'up' : 'down'}">${signed(b.delta)}</b></li>`).join('')}</ul>`
      : '<p class="hint">Seu overall não mudou nesta temporada.</p>';
    UI.render(`
      <section class="panel">
        <div class="kicker">Temporada ${view.year}</div>
        <h2>Fim de temporada</h2>
        ${view.notes.map(n => `<p>${n}</p>`).join('')}
        ${view.table}
        <div class="stats">
          <div><b>${st.games}</b><small>Jogos</small></div>
          <div><b>${st.goals}</b><small>Gols</small></div>
          <div><b>${st.assists}</b><small>Assistências</small></div>
          <div><b>${st.avg !== null ? st.avg.toFixed(1) : '-'}</b><small>Nota média</small></div>
          ${isGK ? `<div><b>${st.cleanSheets}</b><small>Sem sofrer gol</small></div>` : ''}
        </div>
        ${view.titles.length ? `<div class="trophies">${view.titles.map(t => `<span>🏆 ${t}</span>`).join('')}</div>` : ''}
        ${view.awards.length ? `<div class="trophies award">${view.awards.map(a => `<span>★ ${a}</span>`).join('')}</div>` : ''}
        <div class="ovr-card">
          <div class="delta"><span>${view.ovrStart}</span><i>→</i><b>${view.ovrEnd}</b><small>Overall ${diff ? `(${signed(diff)})` : ''} · ${view.age} anos · valor ${fmtMoney(view.value)}</small></div>
          ${breakdown}
        </div>
        ${view.callHint ? '<p class="hint">Convocação: overall 85 e grande fase (Fase 70 ou mais).</p>' : ''}
        ${view.forcedRetirement
          ? '<p class="big-msg">Seu corpo já não aguenta o ritmo. Hora de pendurar as chuteiras.</p><button class="btn big" data-act="retire">Encerrar carreira</button>'
          : `${trainingPicker()}${view.canRetire ? '<button class="btn ghost" data-act="retire">Aposentar-se agora</button>' : ''}`}
      </section>`);
  }

  /**
   * Janela de transferências.
   * @param {AgendaItem} item Passo com as propostas (item.offers).
   */
  function offers(item) {
    const p = G.p;
    const cur = World.current();
    const cards = item.offers.map((o, i) => {
      const c = World.club(o.club);
      const q = World.contQualFor(o.club);
      const conf = CONFEDS[World.confedOf(c)];
      return `<div class="offer">
        <div class="otitle">${UI.clubTag(o.club, 'crest-sm')} ${o.loan ? '<span class="tag">Empréstimo</span>' : ''}${o.buy ? '<span class="tag">Compra definitiva</span>' : ''}</div>
        <div class="ometa">${World.leagueName(c)} · Nível ${UI.levelBars(c.s)}${q ? ` · ${q === 'main' ? conf.main : conf.second}` : ''}</div>
        <div class="ometa">Salário <b>${fmtMoney(o.salary)}/ano</b> · <b>${Sim.titularLabel(estimateStarter(c))}</b></div>
        <div class="row">
          <button class="btn" data-act="offer-accept" data-arg="${i}">Aceitar</button>
          ${!o.negotiated && !o.loan ? `<button class="btn ghost" data-act="offer-negotiate" data-arg="${i}">Pedir salário maior</button>` : ''}
        </div>
      </div>`;
    }).join('');
    UI.render(`
      <section class="panel">
        <div class="kicker">Janela de transferências</div>
        <h2>Propostas</h2>
        ${item.offers.length ? cards : '<p>Nenhum clube fez proposta nesta janela.</p>'}
        <div class="offer stay">
          <div class="otitle">Permanecer no ${UI.clubTag(G.club, 'crest-sm')}</div>
          <div class="ometa">${World.leagueName(cur)} · <b>${Sim.titularLabel(estimateStarter(cur))}</b></div>
          ${p.ovr > cur.s + 8 ? '<div class="ometa warn">Você já é bom demais para este clube. Ficar vai abalar sua fase.</div>' : ''}
          <button class="btn ghost" data-act="offer-stay">Ficar</button>
        </div>
      </section>`);
  }

  /**
   * Chance estimada de titularidade em um clube (para comparar propostas).
   * @param {Club} c Clube.
   * @returns {number}
   */
  function estimateStarter(c) {
    return Util.clamp(50 + (G.p.ovr - c.s) * 4 + (G.p.form - 50) * 0.35, 3, 97) / 100;
  }

  // ---------------------------------------------------------------------------
  // Fim de carreira
  // ---------------------------------------------------------------------------

  /**
   * Títulos agrupados por nome, com os anos de cada conquista.
   * @returns {Array<{name: string, kind: string, years: string[]}>}
   */
  function groupedTitles() {
    const map = new Map();
    for (const t of G.titles) {
      if (!map.has(t.name)) map.set(t.name, { name: t.name, kind: t.kind, years: [] });
      map.get(t.name).years.push(`${t.year}${t.kind === 'club' ? ` · ${t.club}` : ''}`);
    }
    const order = { nat: 0, club: 1, youth: 2 };
    return [...map.values()].sort((a, b) => order[a.kind] - order[b.kind] || b.years.length - a.years.length);
  }

  /** Tela final: título de legado, recordes, títulos, prêmios, números e trajetória. */
  function final() {
    const p = G.p;
    const car = G.career;
    const tier = Progression.legacyTier();
    const records = Progression.records();
    const king = Progression.kingChecklist();
    const groups = groupedTitles();
    const byClub = Progression.gamesByClub();
    const clubs = [];
    for (const x of G.path) if (!clubs.length || clubs[clubs.length - 1].club !== x.club) clubs.push(x);
    const avg = car.rN ? (car.rSum / car.rN).toFixed(2) : '-';
    const awards = new Map();
    for (const a of G.awards) {
      if (!awards.has(a.name)) awards.set(a.name, []);
      awards.get(a.name).push(a.year);
    }
    UI.render(`
      <section class="final">
        <div class="final-hero tier-${tier.id}">
          ${UI.jersey(World.kitColors(G.club), p.shirt, 'big')}
          <div>
            <div class="kicker">Fim de carreira · 2027–${G.year}</div>
            <h1>${esc(p.name)} <span class="flag">${World.country(p.nat).flag}</span></h1>
            <p class="legacy">${tier.title}</p>
            <p class="legacy-desc">${tier.desc}</p>
            <p class="muted">${POSITIONS.find(x => x.id === p.pos).name} · aposentou-se aos ${p.age} anos · overall máximo ${p.peak}</p>
          </div>
        </div>

        ${records.length ? `<h2>Recordes</h2><div class="honors">${records.map(r => `<div class="honor"><b>${r.title}</b><span>${r.desc}</span></div>`).join('')}</div>` : ''}

        <h2>Títulos <span class="count">${G.titles.length}</span></h2>
        ${groups.length ? `<div class="titles">${groups.map(g => `
          <div class="title-card ${g.kind}">
            <div class="tc-head"><span>${g.name}</span><b>${g.years.length}×</b></div>
            <small>${g.years.join(' · ')}</small>
          </div>`).join('')}</div>` : '<p class="muted">Nenhum título conquistado, mas o futebol também é feito dessas histórias.</p>'}

        ${awards.size ? `<h2>Prêmios individuais</h2><div class="titles">${[...awards].map(([name, years]) => `
          <div class="title-card award"><div class="tc-head"><span>${name}</span><b>${years.length}×</b></div><small>${years.join(' · ')}</small></div>`).join('')}</div>` : ''}

        <h2>Números</h2>
        <div class="stats">
          <div><b>${car.games}</b><small>Jogos por clubes</small></div>
          <div><b>${car.goals + G.nat.goals}</b><small>Gols</small></div>
          <div><b>${car.assists + G.nat.assists}</b><small>Assistências</small></div>
          <div><b>${avg}</b><small>Nota média</small></div>
          ${p.pos === 'GOL' ? `<div><b>${car.cleanSheets}</b><small>Jogos sem sofrer gol</small></div>` : ''}
          <div><b>${G.nat.caps}</b><small>Jogos pela seleção</small></div>
          <div><b>${G.nat.goals}</b><small>Gols pela seleção</small></div>
          <div><b>${fmtMoney(p.money)}</b><small>Patrimônio</small></div>
        </div>

        <h2>Desafio do Rei</h2>
        <p class="hint">Para superar o Rei é preciso cumprir tudo isto na mesma carreira.</p>
        <ul class="king">${king.map(k => `<li class="${k.ok ? 'ok' : ''}"><span>${k.label}</span><b>${k.value} / ${k.need}</b></li>`).join('')}</ul>

        <h2>Trajetória</h2>
        <ol class="path">${clubs.map(x => `<li>${UI.clubTag(x.club)}<small>${x.year}${x.kind === 'base' ? ' · base' : x.kind === 'loan' ? ' · empréstimo' : ''}${byClub[x.club] ? ` · ${byClub[x.club]} jogos` : ''}</small></li>`).join('')}</ol>

        <details><summary>Temporada a temporada</summary>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ano</th><th>Clube</th><th>J</th><th>G</th><th>A</th><th>Nota</th><th>OVR</th></tr></thead><tbody>
          ${G.history.map(h => `<tr><td>${h.year}</td><td>${esc(h.club)}</td><td>${h.games}</td><td>${h.goals}</td><td>${h.assists}</td><td>${h.avg ? h.avg.toFixed(1) : '-'}</td><td>${h.ovr}</td></tr>`).join('')}
          </tbody></table></div>
        </details>

        <div class="row">
          <button class="btn ghost" data-act="copy">Copiar resumo</button>
          <button class="btn big" data-act="new-career">Nova carreira</button>
        </div>
        <p id="copied" class="hint center"></p>
      </section>`, { hud: false, mood: 'final' });
  }

  /** Copia um resumo da carreira em texto (ou mostra o texto na tela, se não for possível copiar). */
  function copySummary() {
    const p = G.p;
    const lines = [
      `${p.name} ${World.country(p.nat).flag} · camisa ${p.shirt} · ${Progression.legacyTier().title}`,
      `Overall máximo ${p.peak} · ${G.career.games} jogos · ${G.career.goals + G.nat.goals} gols · ${G.career.assists + G.nat.assists} assistências`,
      ...Progression.records().map(r => `★ ${r.title}`),
      `Títulos (${G.titles.length}):`,
      ...groupedTitles().map(g => `• ${g.name} ×${g.years.length}`),
      'Joguei Rumo ao Estrelato',
    ];
    const text = lines.join('\n');
    const output = document.getElementById('copied');
    /** Mostra o resumo na tela para o jogador copiar manualmente. */
    const showText = () => {
      if (!output) return;
      output.style.whiteSpace = 'pre-wrap';
      output.style.userSelect = 'all';
      output.textContent = text;
    };
    try {
      if (!navigator.clipboard) return showText();
      navigator.clipboard.writeText(text).then(() => { if (output) output.textContent = 'Resumo copiado.'; }, showText);
    } catch (e) {
      showText();
    }
  }

  return {
    home, nationPicker, pickNation, statePicker, pickState, clubPicker, pickClub, playerForm, setShirt, create,
    choice, choiceResult, baseEnd, seasonEnd, offers, final, copySummary,
  };
})();
