// ============================================================
// Rumo ao Estrelato — motor do jogo
// ============================================================
'use strict';

const SAVE_KEY = 'rumo-ao-estrelato-v1';
const START_YEAR = 2027;
const STAT_LABEL = {
  form: 'Fase', humor: 'Humor', chem: 'Equipe', coach: 'Técnico', fame: 'Fama',
  ovr: 'Overall', pot: 'Potencial', money: 'Dinheiro', injury: 'Lesão', suspend: 'Suspensão',
};

let G = null;      // estado da carreira
let M = null;      // partida em andamento
let setup = {};    // escolhas da criação do jogador

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------
const rnd = Math.random;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const randInt = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const pct = p => Math.round(clamp(p, 0.01, 0.99) * 100);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function poisson(l) {
  const L = Math.exp(-l);
  let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}
function weighted(items, wfn) {
  const ws = items.map(wfn);
  let t = ws.reduce((a, b) => a + b, 0) * rnd();
  for (let i = 0; i < items.length; i++) { t -= ws[i]; if (t <= 0) return items[i]; }
  return items[items.length - 1];
}
function fmtMoney(k) {
  const neg = k < 0; k = Math.abs(k);
  const s = k >= 1000 ? (k / 1000).toFixed(1).replace('.', ',') + ' mi' : Math.round(k) + ' mil';
  return (neg ? '-' : '') + '€ ' + s;
}
function chanceClass(p) { return p >= 0.65 ? 'hi' : p >= 0.4 ? 'mid' : 'lo'; }

const country = id => COUNTRY_BY_ID[id];
const clubOf = name => G.clubs[name];
const P = () => G.p;

// ------------------------------------------------------------
// Persistência (sem login: salva só no navegador)
// ------------------------------------------------------------
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) { /* sem storage */ }
}
function loadSave() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

// ------------------------------------------------------------
// Construção do mundo
// ------------------------------------------------------------
function buildClubs() {
  const clubs = {};
  for (const c of COUNTRIES) {
    if (c.id === 'BR') {
      for (const st of BR_STATES) {
        for (const [n, s, d] of st.clubs) clubs[n] = { n, s, b: s, d, c: 'BR', uf: st.uf };
      }
    } else {
      for (const [n, s] of c.clubs) clubs[n] = { n, s, b: s, d: 1, c: c.id };
    }
  }
  return clubs;
}
function leagueName(club) {
  const c = country(club.c);
  return c.leagues[Math.min(club.d, c.leagues.length) - 1];
}
function clubLabel(club) { return `${country(club.c).flag} ${club.n}`; }
function stars(s) {
  const n = clamp(Math.round((s - 45) / 9), 1, 5);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}
function salaryFor(club, ovr) {
  return Math.max(30, Math.round(Math.pow(Math.max(club.s - 42, 4), 2) * 5 * (1 + (ovr - club.s) / 50)));
}
function marketValue() {
  const p = P();
  const ageF = p.age <= 21 ? 1.4 : p.age <= 25 ? 1.2 : p.age <= 28 ? 1 : p.age <= 31 ? 0.6 : 0.3;
  return 50 * Math.pow(1.21, p.ovr - 50) * ageF; // mil €
}

// Força do time em campo, considerando o jogador e o clima do elenco
function effStr(base, playing) {
  const p = P();
  let s = base + (p.chem - 50) * 0.03 + (p.humor - 50) * 0.02;
  if (playing) s += (p.ovr - base) * 0.15 + 1;
  return s;
}
function lambda(a, b, home) {
  return 1.3 * Math.exp((a - b) / 16) * (home === true ? 1.1 : home === false ? 0.9 : 1);
}
function quickScore(a, b, home) {
  return [poisson(lambda(a, b, home)), poisson(lambda(b, a, home === null ? null : !home))];
}

// Chance de ser titular: depende de overall x nível do time, técnico, fase, humor e equipe
function titularChance(teamStr, kind) {
  const p = P();
  if (p.injury > 0 || p.suspended > 0) return 0;
  let v;
  if (kind === 'nat') {
    v = 55 + (p.ovr - teamStr) * 5 + (p.form - 50) * 0.4 + (p.fame - 50) * 0.1;
  } else if (kind === 'youth') {
    v = 60 + (p.ovr - teamStr) * 4 + (p.coach - 50) * 0.5 + (p.form - 50) * 0.3;
  } else {
    v = 50 + (p.ovr - teamStr) * 4 + (p.coach - 50) * 0.5 + (p.form - 50) * 0.35
      + (p.humor - 50) * 0.15 + (p.chem - 50) * 0.25;
  }
  return clamp(v, 3, 97) / 100;
}
function subChance() {
  const p = P();
  if (p.injury > 0 || p.suspended > 0) return 0;
  return clamp(0.55 + (p.form - 50) / 300 + (p.coach - 50) / 300, 0.2, 0.9);
}
// Bônus/ônus de fase, humor e equipe nas jogadas
function moodMods() {
  const p = P();
  return {
    form: (p.form - 50) * 0.002,
    humor: (p.humor - 50) * 0.001,
    chem: (p.chem - 50) * 0.0012,
  };
}
function moodTotal() {
  const m = moodMods();
  return clamp(m.form + m.humor + m.chem, -0.15, 0.15);
}
function formLabel(f) {
  if (f >= 70) return '🔥 Grande fase';
  if (f >= 50) return '🙂 Boa fase';
  if (f >= 30) return '😐 Irregular';
  return '🥶 Má fase';
}
function youthStr(club) { return 45 + (club.s - 50) * 0.3; }

// ------------------------------------------------------------
// Renderização básica
// ------------------------------------------------------------
const app = () => document.getElementById('app');

function render(html, withHud = true) {
  app().innerHTML = (withHud && G ? hudHtml() : '') + `<main class="screen">${html}</main>`;
  window.scrollTo(0, 0);
}

function bar(label, v, cls = '') {
  return `<div class="bar ${cls}"><span>${label}</span><div class="track"><div class="fill" style="width:${clamp(v, 0, 100)}%"></div></div><b>${Math.round(v)}</b></div>`;
}

function hudHtml() {
  const p = P();
  const club = clubOf(G.club);
  const pos = POSITIONS.find(x => x.id === p.pos);
  const status = [];
  if (p.injury > 0) status.push(`<span class="tag red">🩹 Lesionado (${p.injury} j)</span>`);
  if (p.suspended > 0) status.push(`<span class="tag red">🟥 Suspenso (${p.suspended} j)</span>`);
  if (G.nat.called) status.push(`<span class="tag gold">${country(p.nat).flag} Seleção</span>`);
  if (G.loan) status.push(`<span class="tag">🔁 Emprestado</span>`);
  const titles = G.titles.length;
  return `
  <header class="hud">
    <div class="hud-top">
      <div class="ovr"><b>${Math.floor(p.ovr)}</b><small>OVR</small></div>
      <div class="who">
        <div class="name">${esc(p.name)} <span class="flag">${country(p.nat).flag}</span></div>
        <div class="meta">${pos.icon} ${pos.name} · ${p.age} anos · ${clubLabel(club)}${G.phase === 'base' ? ' (base)' : ''}</div>
        <div class="meta">${G.phase === 'base' ? 'Categorias de base' : leagueName(club)} · Temporada ${G.year} · 🏆 ${titles}</div>
        <div class="tags"><span class="tag">${formLabel(p.form)}</span>${status.join('')}</div>
      </div>
    </div>
    <div class="bars">
      ${bar('Fase', p.form, 'b-form')}
      ${bar('Humor', p.humor, 'b-humor')}
      ${bar('Equipe', p.chem, 'b-chem')}
      ${bar('Técnico', p.coach, 'b-coach')}
      ${bar('Fama', p.fame, 'b-fame')}
    </div>
  </header>`;
}

function newsHtml() {
  if (!G.news || !G.news.length) return '';
  const h = `<div class="news"><h4>📰 Notícias</h4>${G.news.map(n => `<p>${n}</p>`).join('')}</div>`;
  G.news = [];
  return h;
}
function news(txt) { G.news.push(txt); }

// ------------------------------------------------------------
// Telas iniciais
// ------------------------------------------------------------
function showHome() {
  M = null;
  const saved = loadSave();
  const canContinue = saved && saved.p && !saved.retired;
  render(`
    <div class="home">
      <div class="logo">⭐⚽</div>
      <h1>Rumo ao Estrelato</h1>
      <p class="sub">Da base ao topo do mundo. Cada escolha muda o rumo da sua carreira — e tudo é questão de probabilidade.</p>
      <button class="btn big" onclick="startSetup()">▶ Iniciar jogo</button>
      ${canContinue ? `<button class="btn ghost" onclick="continueGame()">↺ Continuar carreira de ${esc(saved.p.name)} (${saved.year})</button>` : ''}
      <ul class="howto">
        <li>🌎 Escolha onde nasceu e em qual base vai começar</li>
        <li>🎲 Toda escolha mostra a chance de dar certo</li>
        <li>🥅 Em pênaltis e faltas, você escolhe o canto</li>
        <li>📊 Fase, humor, equipe e técnico influenciam sua titularidade e suas jogadas</li>
        <li>📞 OVR 85 + grande fase = convocação para a seleção</li>
      </ul>
    </div>`, false);
}

function continueGame() {
  G = loadSave();
  if (!G) return showHome();
  if (G.retired) return showFinal();
  if (G.cur) HANDLERS[G.cur.t](G.cur);
  else next();
}

function startSetup() {
  G = null; setup = {};
  const items = COUNTRIES.map(c => `
    <button class="pick" onclick="pickNation('${c.id}')">
      <span class="pflag">${c.flag}</span><span>${c.name}</span><small>${c.leagues[0]}</small>
    </button>`).join('');
  render(`<h2>Onde você nasceu?</h2><p class="hint">Escolha sua nacionalidade. Ela define sua seleção e o país onde você começa na base.</p><div class="grid">${items}</div>`, false);
}

function pickNation(id) {
  setup.nat = id;
  if (id === 'BR') return showStates();
  showBaseClubs();
}

function showStates() {
  const items = BR_STATES.map(s => `
    <button class="pick" onclick="pickState('${s.uf}')">
      <span class="pflag">${s.uf}</span><span>${s.name}</span><small>${s.clubs.slice(0, 3).map(c => c[0]).join(', ')}…</small>
    </button>`).join('');
  render(`<h2>🇧🇷 Em qual estado você nasceu?</h2><p class="hint">Você vai começar na base de um clube tradicional da sua região.</p><div class="grid">${items}</div>
    <button class="btn ghost" onclick="startSetup()">← Voltar</button>`, false);
}
function pickState(uf) { setup.uf = uf; showBaseClubs(); }

function showBaseClubs() {
  let list;
  if (setup.nat === 'BR') {
    const st = BR_STATES.find(s => s.uf === setup.uf);
    list = st.clubs.map(([n, s, d]) => ({ n, s, d, c: 'BR' }));
  } else {
    list = country(setup.nat).clubs.map(([n, s]) => ({ n, s, d: 1, c: setup.nat }));
  }
  list.sort((a, b) => b.s - a.s);
  setup.list = list;
  const items = list.map((c, i) => {
    const play = c.s >= 78 ? 'Baixa' : c.s >= 68 ? 'Média' : c.s >= 58 ? 'Boa' : 'Alta';
    return `
    <button class="pick club" onclick="pickClub(${i})">
      <span class="cname">${c.n}</span>
      <small>${country(c.c).leagues[c.d - 1]}</small>
      <small>Estrutura: <b class="stars">${stars(c.s)}</b></small>
      <small>Chance de jogar no profissional: <b>${play}</b></small>
    </button>`;
  }).join('');
  render(`<h2>Escolha a sua base</h2><p class="hint">Clubes grandes têm estrutura melhor (mais potencial), mas é mais difícil virar titular. Clubes menores dão mais minutos.</p>
  <div class="grid">${items}</div>
  <button class="btn ghost" onclick="${setup.nat === 'BR' ? 'showStates()' : 'startSetup()'}">← Voltar</button>`, false);
}
function pickClub(i) { setup.club = setup.list[i].n; showPlayerForm(); }

function showPlayerForm() {
  const pos = POSITIONS.map((p, i) => `
    <label class="radio"><input type="radio" name="pos" value="${p.id}" ${i === 3 ? 'checked' : ''}><span>${p.icon} ${p.name}</span></label>`).join('');
  render(`<h2>Quem é você?</h2>
    <div class="card form">
      <label>Nome do jogador<input id="pname" maxlength="24" placeholder="Ex.: Joãozinho" /></label>
      <div class="label">Posição</div>
      <div class="radios">${pos}</div>
      <p class="hint">Base: <b>${esc(setup.club)}</b> · ${country(setup.nat).flag} ${country(setup.nat).name}</p>
      <button class="btn big" onclick="createPlayer()">Começar carreira ⚽</button>
    </div>
    <button class="btn ghost" onclick="showBaseClubs()">← Voltar</button>`, false);
  setTimeout(() => { const i = document.getElementById('pname'); if (i) i.focus(); }, 50);
}

function createPlayer() {
  const nameInput = document.getElementById('pname');
  const name = (nameInput && nameInput.value.trim()) || 'Joãozinho';
  const pos = (document.querySelector('input[name=pos]:checked') || {}).value || 'ATA';
  const clubs = buildClubs();
  const base = clubs[setup.club];
  // potencial: sorte + estrutura da base
  const pot = clamp(Math.round(70 + rnd() * 16 + rnd() * 8 + (base.s - 60) / 6), 70, 96);
  G = {
    v: 1,
    p: {
      name, nat: setup.nat, uf: setup.uf || null, pos, age: 16,
      ovr: 48 + rnd() * 7, pot,
      form: 55, humor: 60, chem: 50, coach: 50, fame: 3,
      money: 0, salary: 5, injury: 0, suspended: 0,
    },
    clubs, club: setup.club, loan: null,
    year: START_YEAR, phase: 'base', seasonNo: 0,
    nat: { called: false, caps: 0, goals: 0, assists: 0, declinedYear: null },
    career: { games: 0, goals: 0, assists: 0, rSum: 0, rN: 0, cleanSheets: 0 },
    titles: [], awards: [], history: [], path: [{ club: setup.club, year: START_YEAR, kind: 'base' }],
    qual: {}, news: [], agenda: [], cur: null, retired: false,
  };
  startBaseSeason();
  next();
}

// ------------------------------------------------------------
// Agenda / fluxo da temporada
// ------------------------------------------------------------
function next() {
  if (!G) return showHome();
  if (G.retired) return showFinal();
  const it = G.agenda.shift();
  G.cur = it || null;
  save();
  if (!it) { startProSeason(); return next(); }
  HANDLERS[it.t](it);
}

function newSeasonState() {
  return {
    last: null, lastBench: false, used: [], moreOffers: 0,
    stats: { games: 0, possible: 0, starts: 0, goals: 0, assists: 0, leagueGoals: 0, rSum: 0, rN: 0, cleanSheets: 0 },
    titles: [], trophies: [],
  };
}

function startBaseSeason() {
  G.S = newSeasonState();
  const c = clubOf(G.club);
  G.S.youthName = c.c === 'BR' ? 'Copa São Paulo de Futebol Jr.' : `Campeonato Sub-17 (${country(c.c).name})`;
  G.agenda = [
    { t: 'event', pool: 'youth' },
    { t: 'youth', stage: 'Quartas de final' },
    { t: 'event', pool: 'youth' },
    { t: 'youth', stage: 'Semifinal' },
    { t: 'event', pool: 'youth' },
    { t: 'youth', stage: 'Final' },
    { t: 'baseEnd' },
  ];
}

function contQualFor(clubName) {
  const club = clubOf(clubName);
  if (club.d !== 1) return null;
  if (G.qual[clubName] !== undefined) return G.qual[clubName];
  const c = country(club.c);
  const ranked = Object.values(G.clubs).filter(x => x.c === club.c && x.d === 1).sort((a, b) => b.s - a.s);
  const rank = ranked.findIndex(x => x.n === clubName) + 1;
  if (rank <= c.top) return 'main';
  if (CONFEDS[c.confed].second && rank <= c.top + (club.c === 'BR' ? 6 : 2)) return 'second';
  return null;
}

function startProSeason() {
  if (G.phase !== 'pro') G.phase = 'pro';
  const S = G.S = newSeasonState();
  const club = clubOf(G.club);
  const c = country(club.c);

  // drift de força dos clubes
  for (const k in G.clubs) {
    const x = G.clubs[k];
    x.s = clamp(x.s + (x.b - x.s) * 0.3 + (rnd() * 3 - 1.5), 40, 95);
  }

  // Liga
  const teams = Object.values(G.clubs).filter(x => x.c === club.c && x.d === club.d);
  const rounds = Math.max(10, (teams.length - 1) * 2);
  S.league = {
    name: leagueName(club), rounds, played: 0,
    table: teams.map(x => ({ n: x.n, s: x.s, pts: 0, gp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 })),
    keys: [Math.round(rounds * 0.25), Math.round(rounds * 0.5), Math.round(rounds * 0.75), rounds],
  };
  S.cup = { name: c.cup, alive: true };
  const q = contQualFor(G.club);
  const conf = CONFEDS[c.confed];
  S.cont = q ? { type: q, name: q === 'main' ? conf.main : conf.second, alive: true } : null;
  G.qual = {};

  const A = [];
  if (club.c === 'BR') A.push({ t: 'estadual' });
  A.push({ t: 'league', k: 0 }, { t: 'event' }, { t: 'cup', stage: 'early' }, { t: 'cup', stage: 'Quartas de final' });
  A.push({ t: 'league', k: 1 }, { t: 'event' });
  if (S.cont) A.push({ t: 'cont', stage: 'groups' }, { t: 'cont', stage: 'Quartas de final' });
  A.push({ t: 'natmatch' });
  A.push({ t: 'cup', stage: 'Semifinal' }, { t: 'event' }, { t: 'league', k: 2 });
  if (S.cont) A.push({ t: 'cont', stage: 'Semifinal' });
  A.push({ t: 'cup', stage: 'Final' }, { t: 'event' }, { t: 'league', k: 3 });
  if (S.cont) A.push({ t: 'cont', stage: 'Final' });
  A.push({ t: 'end' });
  G.agenda = A;

  G.p.salary = G.p.salary && G.p.salary > 5 ? G.p.salary : salaryFor(club, G.p.ovr);
}

// ------------------------------------------------------------
// Simulação fora de tela (jogos que você não joga "ao vivo")
// ------------------------------------------------------------
const GOAL_RATE = { ATA: 0.33, MEI: 0.13, ZAG: 0.05, GOL: 0 };
const ASSIST_RATE = { ATA: 0.15, MEI: 0.25, ZAG: 0.04, GOL: 0.01 };

function simOffscreen(teamStr, oppStr, opts = {}) {
  const p = P();
  const kind = opts.kind || 'club';
  const st = kind === 'nat' ? null : G.S.stats;
  if (st) st.possible++;
  let played = false, starter = false;
  if (p.injury > 0) p.injury--;
  else if (p.suspended > 0) p.suspended--;
  else if (rnd() < titularChance(teamStr, kind)) { played = true; starter = true; }
  else if (rnd() < subChance() * 0.6) played = true;

  const eff = effStr(teamStr, starter);
  const home = rnd() < 0.5;
  let [a, b] = quickScore(eff, oppStr, home);
  let goals = 0, assists = 0;
  if (played) {
    const mult = Math.pow(p.ovr / 75, 3) * (1 + (p.form - 50) / 150) * (starter ? 1 : 0.35) * clamp(1 + (eff - oppStr) / 40, 0.4, 1.8);
    goals = Math.min(poisson(GOAL_RATE[p.pos] * mult), 4);
    assists = Math.min(poisson(ASSIST_RATE[p.pos] * mult), 3);
    a = Math.max(a, goals + assists > a ? goals + assists : a);
    let r = 6.45 + clamp((p.ovr - teamStr) / 40, -0.3, 0.5) + (p.form - 50) / 150 + (a > b ? 0.2 : a < b ? -0.25 : 0)
      + goals * 0.7 + assists * 0.35 + rnd() * 0.6 - 0.3;
    if (p.pos === 'GOL' || p.pos === 'ZAG') r += b === 0 ? 0.4 : -b * 0.12;
    if (!starter) r = 6 + (r - 6.4) * 0.5;
    r = clamp(r, 4.5, 9.8);
    if (kind === 'nat') {
      G.nat.caps++; G.nat.goals += goals; G.nat.assists += assists;
    } else if (kind === 'club') {
      st.games++; if (starter) st.starts++;
      st.goals += goals; st.assists += assists; st.rSum += r; st.rN++;
      if (opts.league) st.leagueGoals += goals;
      if (p.pos === 'GOL' && starter && b === 0) st.cleanSheets++;
    }
    p.form = clamp(p.form + (r - 6.6) * 1.2 + (55 - p.form) * 0.03, 0, 100);
    if (rnd() < 0.012) { p.injury = randInt(2, 6); news(`🩹 Você se lesionou e vai desfalcar o time por ${p.injury} jogos.`); }
  }
  return { us: a, them: b, played };
}

function simLeagueRound(ourResult) {
  const L = G.S.league;
  for (const row of L.table) {
    let gf, ga;
    if (row.n === G.club) {
      if (ourResult) { gf = ourResult.us; ga = ourResult.them; }
      else {
        const opp = pick(L.table.filter(r => r.n !== row.n));
        const r = simOffscreen(clubOf(G.club).s, opp.s, { league: true });
        gf = r.us; ga = r.them;
      }
    } else {
      const opp = pick(L.table.filter(r => r.n !== row.n));
      [gf, ga] = quickScore(row.s, opp.s, rnd() < 0.5);
    }
    row.gp++; row.gf += gf; row.ga += ga;
    if (gf > ga) { row.w++; row.pts += 3; } else if (gf === ga) { row.d++; row.pts += 1; } else row.l++;
  }
  L.played++;
}
function sortedTable() {
  return [...G.S.league.table].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}
function myPos() { return sortedTable().findIndex(r => r.n === G.club) + 1; }

function tableHtml(limit = 6) {
  const t = sortedTable();
  const me = t.findIndex(r => r.n === G.club);
  const rows = t.map((r, i) => ({ r, i })).filter(x => x.i < limit || x.i === me);
  return `<table class="tbl"><thead><tr><th>#</th><th>Clube</th><th>J</th><th>V</th><th>SG</th><th>Pts</th></tr></thead><tbody>
    ${rows.map(({ r, i }) => `<tr class="${r.n === G.club ? 'me' : ''}"><td>${i + 1}</td><td>${r.n}</td><td>${r.gp}</td><td>${r.w}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}
  </tbody></table>`;
}

// ------------------------------------------------------------
// Títulos
// ------------------------------------------------------------
function addTitle(name, kind = 'club') {
  const t = { name, year: G.year, club: kind === 'nat' ? country(P().nat).name : G.club, kind };
  G.titles.push(t);
  G.S.titles.push(name);
  P().fame = clamp(P().fame + (kind === 'youth' ? 3 : 8), 0, 100);
}

// ------------------------------------------------------------
// Handlers da agenda
// ------------------------------------------------------------
const HANDLERS = {
  event: runEvent,
  youth: runYouth,
  baseEnd: runBaseEnd,
  estadual: runEstadual,
  league: runLeague,
  cup: runCup,
  cont: runCont,
  natmatch: runNatMatch,
  tourn: runTourn,
  end: runSeasonEnd,
  awards: runAwards,
  offers: runOffers,
  newseason: runNewSeason,
  callup: runCallup,
};

function runYouth(it) {
  const club = clubOf(G.club);
  const others = Object.values(G.clubs).filter(x => x.c === club.c && x.n !== club.n);
  const opp = weighted(others, x => Math.pow(x.s - 40, it.stage === 'Final' ? 2 : 1));
  playMatch({
    kind: 'youth', comp: G.S.youthName, stage: it.stage, ko: true,
    ourName: `${club.n} Sub-17`, ourStr: youthStr(club),
    opp: { n: `${opp.n} Sub-17`, s: youthStr(opp) }, home: rnd() < 0.5,
    onEnd: res => {
      if (!res.win) {
        G.agenda = G.agenda.filter(a => a.t !== 'youth');
        return `Eliminado na ${it.stage.toLowerCase()} da ${G.S.youthName}.`;
      }
      if (it.stage === 'Final') { addTitle(G.S.youthName, 'youth'); return `🏆 CAMPEÃO da ${G.S.youthName}!`; }
      return 'Classificado para a próxima fase!';
    },
  });
}

function runBaseEnd() {
  const p = P();
  const old = p.ovr;
  const avg = G.S.stats.rN ? G.S.stats.rSum / G.S.stats.rN : 6.3;
  p.ovr = Math.min(p.pot, p.ovr + 3 + rnd() * 3 + (avg - 6.5));
  p.age++;
  const club = clubOf(G.club);
  const sal = salaryFor(club, p.ovr);
  p.salary = sal;
  render(`
    <div class="card center">
      <div class="big-emoji">✍️</div>
      <h2>Primeiro contrato profissional!</h2>
      <p>Depois de uma temporada nas categorias de base, o <b>${club.n}</b> te promoveu ao time principal.</p>
      <p class="delta">Overall: ${Math.floor(old)} → <b>${Math.floor(p.ovr)}</b></p>
      <p>Salário: <b>${fmtMoney(sal)}/ano</b></p>
      <p class="hint">Agora você disputa ${leagueName(club)}${club.c === 'BR' ? ', o estadual' : ''} e a ${country(club.c).cup}. Chance de ser titular hoje: <b>${pct(titularChance(club.s))}%</b></p>
      <button class="btn big" onclick="G.year++; next()">Subir para o profissional ▶</button>
    </div>`);
}

function runEstadual() {
  const club = clubOf(G.club);
  const st = BR_STATES.find(s => s.uf === club.uf);
  const others = Object.values(G.clubs).filter(x => x.uf === club.uf && x.n !== club.n);
  if (!st || !others.length) return next();
  G.S.estadual = st.estadual;
  for (let i = 0; i < 5; i++) simOffscreen(club.s, pick(others).s);
  const second = Math.max(...others.map(x => x.s));
  const pFinal = clamp(0.55 + (club.s - second) / 25, 0.1, 0.92);
  if (rnd() > pFinal) {
    news(`O ${club.n} caiu antes da final do ${st.estadual}.`);
    return next();
  }
  const opp = weighted(others, x => Math.pow(x.s - 40, 2));
  playMatch({
    kind: 'club', comp: st.estadual, stage: 'Final', ko: true,
    ourName: club.n, ourStr: club.s, opp: { n: opp.n, s: opp.s }, home: rnd() < 0.5,
    onEnd: res => {
      if (res.win) { addTitle(st.estadual); return `🏆 CAMPEÃO do ${st.estadual}!`; }
      return `Vice-campeão do ${st.estadual}.`;
    },
  });
}

function runLeague(it) {
  const L = G.S.league;
  const target = L.keys[it.k];
  while (L.played < target - 1) simLeagueRound(null);
  const club = clubOf(G.club);
  const opp = pick(L.table.filter(r => r.n !== G.club));
  const pos = myPos();
  const t = sortedTable();
  let ctx = `Você está em <b>${pos}º</b> com ${t[pos - 1].pts} pts.`;
  if (it.k === 3) {
    const lead = t[0];
    ctx = pos === 1
      ? `Última rodada! Vocês lideram com ${lead.pts} pts, ${lead.pts - t[1].pts} à frente do ${t[1].n}.`
      : `Última rodada! Vocês estão em ${pos}º, ${lead.pts - t[pos - 1].pts} pts atrás do líder ${lead.n}.`;
  }
  playMatch({
    kind: 'club', comp: L.name, stage: `Rodada ${target} de ${L.rounds}`, ko: false, ctx,
    table: true,
    ourName: club.n, ourStr: club.s, opp: { n: opp.n, s: opp.s }, home: rnd() < 0.5,
    onEnd: res => {
      simLeagueRound(res);
      if (it.k === 3) while (L.played < L.rounds) simLeagueRound(null);
      return `${L.name}: ${myPos()}º lugar.`;
    },
  });
}

function domesticOpp(minRank) {
  const club = clubOf(G.club);
  const pool = Object.values(G.clubs).filter(x => x.c === club.c && x.n !== club.n).sort((a, b) => b.s - a.s);
  const n = Math.max(2, Math.ceil(pool.length * minRank));
  return pick(pool.slice(0, n));
}

function runCup(it) {
  const S = G.S;
  const club = clubOf(G.club);
  if (!S.cup.alive) return next();
  if (it.stage === 'early') {
    const stages = ['1ª fase', '2ª fase', 'Oitavas de final'];
    for (const st of stages) {
      const opp = domesticOpp(1);
      const r = simOffscreen(club.s, opp.s);
      const win = r.us > r.them || (r.us === r.them && rnd() < 0.5 + (club.s - opp.s) / 60);
      if (!win) {
        S.cup.alive = false;
        news(`❌ ${S.cup.name}: eliminado na ${st} pelo ${opp.n} (${r.us}x${r.them}).`);
        return next();
      }
    }
    news(`✅ ${S.cup.name}: classificado para as quartas de final!`);
    return next();
  }
  const opp = domesticOpp(it.stage === 'Final' ? 0.35 : it.stage === 'Semifinal' ? 0.5 : 0.8);
  playMatch({
    kind: 'club', comp: S.cup.name, stage: it.stage, ko: true,
    ourName: club.n, ourStr: club.s, opp: { n: opp.n, s: opp.s }, home: rnd() < 0.5,
    onEnd: res => {
      if (!res.win) { S.cup.alive = false; return `Eliminado da ${S.cup.name}.`; }
      if (it.stage === 'Final') {
        addTitle(S.cup.name);
        if (club.c === 'BR') G.qual[G.club] = 'main';
        return `🏆 CAMPEÃO da ${S.cup.name}!`;
      }
      return `Classificado na ${S.cup.name}!`;
    },
  });
}

function contOpp(stage) {
  const club = clubOf(G.club);
  const conf = country(club.c).confed;
  const pool = Object.values(G.clubs)
    .filter(x => country(x.c).confed === conf && x.d === 1 && x.n !== club.n)
    .sort((a, b) => b.s - a.s);
  const second = G.S.cont.type === 'second';
  let slice;
  if (second) {
    const start = Math.floor(pool.length * 0.2);
    slice = pool.slice(start, start + Math.max(6, Math.floor(pool.length * 0.4)));
  } else {
    const n = stage === 'Final' ? 6 : stage === 'Semifinal' ? 10 : 18;
    slice = pool.slice(0, n);
  }
  return pick(slice.length ? slice : pool);
}

function runCont(it) {
  const S = G.S;
  if (!S.cont || !S.cont.alive) return next();
  const club = clubOf(G.club);
  if (it.stage === 'groups') {
    let pts = 0;
    for (let i = 0; i < 6; i++) {
      const r = simOffscreen(club.s, contOpp('groups').s);
      pts += r.us > r.them ? 3 : r.us === r.them ? 1 : 0;
    }
    if (pts < 9 && !(pts >= 7 && rnd() < 0.5)) {
      S.cont.alive = false;
      news(`❌ ${S.cont.name}: eliminado na fase de grupos (${pts} pts).`);
      return next();
    }
    const opp = contOpp('Oitavas');
    const r = simOffscreen(club.s, opp.s);
    const win = r.us > r.them || (r.us === r.them && rnd() < 0.5);
    if (!win) {
      S.cont.alive = false;
      news(`❌ ${S.cont.name}: passou dos grupos (${pts} pts) mas caiu nas oitavas para o ${opp.n}.`);
    } else news(`✅ ${S.cont.name}: classificado para as quartas! (${pts} pts nos grupos, venceu o ${opp.n} nas oitavas)`);
    return next();
  }
  if (it.stage === 'mundial') return runMundial();
  const opp = contOpp(it.stage);
  playMatch({
    kind: 'club', comp: S.cont.name, stage: it.stage, ko: true, big: true,
    ourName: club.n, ourStr: club.s, opp: { n: opp.n, s: opp.s, flag: country(opp.c).flag }, home: rnd() < 0.5,
    onEnd: res => {
      if (!res.win) { S.cont.alive = false; return `Eliminado da ${S.cont.name}.`; }
      if (it.stage === 'Final') {
        addTitle(S.cont.name);
        if (S.cont.type === 'main') G.agenda.unshift({ t: 'cont', stage: 'mundial' });
        return `🏆 CAMPEÃO da ${S.cont.name}!`;
      }
      return `Classificado na ${S.cont.name}!`;
    },
  });
}

function runMundial() {
  const club = clubOf(G.club);
  const conf = country(club.c).confed;
  const pool = Object.values(G.clubs).filter(x => x.d === 1 && country(x.c).confed !== conf && (conf === 'UEFA' ? country(x.c).confed === 'CONMEBOL' : country(x.c).confed === 'UEFA'))
    .sort((a, b) => b.s - a.s).slice(0, 5);
  const opp = pick(pool);
  playMatch({
    kind: 'club', comp: 'Mundial de Clubes', stage: 'Final', ko: true, big: true,
    ourName: club.n, ourStr: club.s, opp: { n: opp.n, s: opp.s, flag: country(opp.c).flag }, home: null,
    onEnd: res => {
      if (res.win) { addTitle('Mundial de Clubes'); return '🌍🏆 CAMPEÃO DO MUNDO DE CLUBES!'; }
      return 'Vice-campeão mundial.';
    },
  });
}

function natRivals(minS, maxS) {
  const myName = country(P().nat).name;
  let pool = NATION_RIVALS.filter(([n, s]) => n !== myName && s >= minS && s <= maxS);
  if (!pool.length) pool = NATION_RIVALS.filter(([n]) => n !== myName);
  const [n, s] = pick(pool);
  return { n, s };
}

function runNatMatch() {
  if (!G.nat.called) return next();
  const c = country(P().nat);
  const isWCYear = G.year % 4 === 2;
  const opp = natRivals(c.nat - 10, c.nat + 3);
  playMatch({
    kind: 'nat', comp: isWCYear ? 'Amistoso internacional' : 'Eliminatórias', stage: `Seleção ${c.name}`, ko: false,
    ourName: `${c.flag} ${c.name}`, ourStr: c.nat, opp, home: rnd() < 0.5,
    onEnd: () => '',
  });
}

function tournamentName() {
  const c = country(P().nat);
  if (G.year % 4 === 2) return 'Copa do Mundo';
  if (G.year % 4 === 0) return CONFEDS[c.confed].nationsCup;
  return null;
}

function runTourn(it) {
  if (!G.nat.called) return next();
  const c = country(P().nat);
  const name = it.name;
  if (it.stage === 'groups') {
    let pts = 0;
    for (let i = 0; i < 3; i++) {
      const opp = natRivals(c.nat - 14, c.nat + 2);
      const r = simOffscreen(c.nat, opp.s, { kind: 'nat' });
      pts += r.us > r.them ? 3 : r.us === r.them ? 1 : 0;
    }
    if (pts < 4 || (pts === 4 && rnd() < 0.4)) {
      G.agenda = G.agenda.filter(a => a.t !== 'tourn');
      news(`❌ ${name} ${G.year}: ${c.name} eliminada na fase de grupos (${pts} pts).`);
    } else news(`✅ ${name} ${G.year}: ${c.name} classificada na fase de grupos com ${pts} pts!`);
    return next();
  }
  const stageRange = { 'Oitavas de final': [72, 84], 'Quartas de final': [78, 87], 'Semifinal': [81, 89], 'Final': [84, 89] };
  const [lo, hi] = stageRange[it.stage];
  const opp = name === 'Copa do Mundo' ? natRivals(lo, hi) : natRivals(lo - 6, hi);
  playMatch({
    kind: 'nat', comp: `${name} ${G.year}`, stage: it.stage, ko: true, big: true,
    ourName: `${c.flag} ${c.name}`, ourStr: c.nat, opp, home: null,
    onEnd: res => {
      if (!res.win) { G.agenda = G.agenda.filter(a => a.t !== 'tourn'); return `${c.name} eliminada da ${name}.`; }
      if (it.stage === 'Final') { addTitle(name, 'nat'); return `🏆🏆 CAMPEÃO DA ${name.toUpperCase()}!`; }
      return `${c.name} avança na ${name}!`;
    },
  });
}

// Checa convocação: OVR 85 + grande fase
function checkCallup() {
  const p = P();
  if (G.phase !== 'pro' || G.nat.called || G.nat.declinedYear === G.year) return;
  if (p.ovr >= 85 && p.form >= 70 && !G.agenda.some(a => a.t === 'callup')) G.agenda.unshift({ t: 'callup' });
}
function runCallup() {
  showEvent(CALLUP_EVENT, { callup: true });
}

// ------------------------------------------------------------
// Eventos
// ------------------------------------------------------------
function runEvent(it) {
  const pool = it.pool || 'pro';
  if (it.id) return showEvent(EVENTS.find(e => e.id === it.id));
  const cands = EVENTS.filter(e => e.pool === pool && !G.S.used.includes(e.id) && (!e.cond || e.cond(G)));
  if (!cands.length) return next();
  const e = weighted(cands, x => x.w || 1);
  it.id = e.id;
  G.S.used.push(e.id);
  save();
  showEvent(e);
}

function showEvent(e) {
  const text = typeof e.text === 'function' ? e.text(G) : e.text;
  const opts = e.opts.map((o, i) => {
    const pr = o.p ? clamp(o.p(G), 0.03, 0.97) : null;
    const chance = pr === null
      ? `<span class="chance sure">Garantido</span>`
      : `<span class="chance ${chanceClass(pr)}">${pct(pr)}% de dar certo</span>`;
    return `<button class="opt" onclick="chooseEvent('${e.id}', ${i})"><span>${o.label}</span>${chance}</button>`;
  }).join('');
  render(`${newsHtml()}
    <div class="card event">
      <div class="big-emoji">${e.icon}</div>
      <h2>${e.title}</h2>
      <p>${text}</p>
      <div class="opts">${opts}</div>
    </div>`);
}

function chooseEvent(id, i) {
  const e = id === 'convocacao' ? CALLUP_EVENT : EVENTS.find(x => x.id === id);
  const o = e.opts[i];
  const pr = o.p ? clamp(o.p(G), 0.03, 0.97) : 1;
  const ok = rnd() < pr;
  const res = ok ? o.ok : o.fail;
  const chips = applyFx(res.fx || {});
  if (id === 'convocacao' && i === 1) G.nat.declinedYear = G.year;
  render(`
    <div class="card event">
      <div class="big-emoji">${ok ? '✅' : '❌'}</div>
      <h2>${o.p ? (ok ? 'Deu certo!' : 'Deu errado...') : 'Decisão tomada'}</h2>
      <p class="muted">Você escolheu: <i>${o.label}</i>${o.p ? ` (${pct(pr)}%)` : ''}</p>
      <p>${res.txt}</p>
      <div class="chips">${chips}</div>
      <button class="btn big" onclick="next()">Continuar ▶</button>
    </div>`);
  save();
}

function applyFx(fx) {
  const p = P();
  const out = [];
  const chip = (k, v, txt) => out.push(`<span class="chip ${v >= 0 ? 'up' : 'down'}">${txt || `${STAT_LABEL[k]} ${v > 0 ? '+' : ''}${v}`}</span>`);
  for (const [k, v] of Object.entries(fx)) {
    switch (k) {
      case 'form': case 'humor': case 'chem': case 'coach': case 'fame':
        p[k] = clamp(p[k] + v, 0, 100); chip(k, v); break;
      case 'ovr': p.ovr = Math.min(p.ovr + v, p.pot + 2); chip(k, v); break;
      case 'pot': p.pot = Math.min(p.pot + v, 99); chip(k, v, 'Potencial ↑'); break;
      case 'money': p.money += v; chip(k, v, `${fmtMoney(v)}`); break;
      case 'moneyFame': { const m = Math.round((50 + p.fame * 15) * v); p.money += m; chip('money', m, `+${fmtMoney(m)}`); break; }
      case 'injury': p.injury += v; chip(k, -v, `🩹 Lesão: ${v} jogo(s)`); break;
      case 'suspend': p.suspended += v; chip(k, -v, `🟥 Suspenso: ${v} jogo(s)`); break;
      case 'coachSet': p.coach = v; chip('coach', 0, `Técnico: ${v}`); break;
      case 'salaryMul': p.salary = Math.round(p.salary * v); chip('money', 1, `Salário: ${fmtMoney(p.salary)}/ano`); break;
      case 'moreOffers': if (G.S) G.S.moreOffers += v; chip('fame', 1, '📈 Mercado atento'); break;
      case 'callup': G.nat.called = true; chip('fame', 1, `${country(p.nat).flag} Convocado!`); break;
      default: break;
    }
  }
  return out.join('') || '<span class="chip">Sem alterações</span>';
}

// ------------------------------------------------------------
// PARTIDA
// ------------------------------------------------------------
// Jogadas: base = chance mínima, range = quanto o overall soma
const MOMENTS = {
  ATA: ['one_on_one', 'header', 'edge', 'counter', 'one_on_one'],
  MEI: ['through', 'long_shot', 'dribble', 'counter', 'through'],
  ZAG: ['tackle', 'corner_header', 'cover', 'build', 'tackle'],
  GOL: ['save', 'cross', 'gk_one', 'distribution', 'save'],
};

function momentDef(type) {
  const D = {
    one_on_one: {
      text: 'Lançamento perfeito! Você sai <b>cara a cara com o goleiro</b>.',
      opts: [
        ['Chutar forte no canto', 0.30, 0.35, 'goal'],
        ['Tentar a cavadinha', 0.15, 0.35, 'goal', 'golaço'],
        ['Driblar o goleiro', 0.22, 0.33, 'goal'],
        ['Rolar para o companheiro livre', 0.35, 0.30, 'assist'],
      ],
    },
    header: {
      text: 'Cruzamento na área! A bola vem <b>na sua cabeça</b>.',
      opts: [
        ['Cabecear firme para o chão', 0.18, 0.30, 'goal'],
        ['Desviar de leve no primeiro pau', 0.14, 0.28, 'goal'],
        ['Escorar para trás', 0.22, 0.25, 'assist'],
      ],
    },
    edge: {
      text: 'Você recebe <b>na entrada da área</b>, com um zagueiro colado.',
      opts: [
        ['Chutar de primeira', 0.10, 0.25, 'goal'],
        ['Driblar o zagueiro e finalizar', 0.10, 0.28, 'goal'],
        ['Tabelar com o meia', 0.14, 0.26, 'goal'],
        ['Segurar e esperar o time', 0.85, 0.10, 'safe'],
      ],
    },
    counter: {
      text: '<b>Contra-ataque 3 contra 2!</b> A bola está nos seus pés.',
      opts: [
        ['Conduzir e finalizar', 0.18, 0.28, 'goal'],
        ['Tocar para o ponta', 0.20, 0.28, 'assist'],
        ['Cavar a falta na meia-lua', 0.45, 0.25, 'freekick'],
      ],
    },
    through: {
      text: 'Você domina no meio e vê o atacante <b>se infiltrando</b> entre os zagueiros.',
      opts: [
        ['Enfiada de primeira', 0.20, 0.30, 'assist'],
        ['Lançamento longo nas costas da zaga', 0.14, 0.28, 'assist'],
        ['Passe seguro e manter a posse', 0.85, 0.10, 'safe'],
      ],
    },
    long_shot: {
      text: 'Sobra uma bola limpa <b>na intermediária</b>.',
      opts: [
        ['Bomba de longe', 0.06, 0.22, 'goal', 'golaço'],
        ['Chute colocado no ângulo', 0.05, 0.22, 'goal', 'golaço'],
        ['Abrir na ponta para o cruzamento', 0.15, 0.20, 'assist'],
      ],
    },
    dribble: {
      text: 'Você recebe <b>marcado por dois</b> adversários perto da área.',
      opts: [
        ['Drible desconcertante e passe para o gol', 0.15, 0.25, 'assist'],
        ['Cavar a falta', 0.50, 0.25, 'freekick'],
        ['Tocar de lado', 0.90, 0.08, 'safe'],
      ],
    },
    tackle: {
      text: 'O atacante adversário <b>arranca em velocidade</b> em direção à área!',
      opts: [
        ['Dar o carrinho', 0.40, 0.35, 'block', null, 'foul'],
        ['Acompanhar e fechar o ângulo', 0.50, 0.30, 'block', null, 'chance'],
        ['Falta tática (cartão amarelo)', 0.85, 0.10, 'block', null, 'chance'],
      ],
    },
    corner_header: {
      text: '<b>Escanteio a favor!</b> Você sobe para a área adversária.',
      opts: [
        ['Cabecear no canto', 0.12, 0.22, 'goal'],
        ['Ajeitar para o companheiro', 0.12, 0.20, 'assist'],
      ],
    },
    cover: {
      text: '<b>Bola longa nas costas</b> do lateral! O ponta adversário corre livre.',
      opts: [
        ['Antecipar e cortar de cabeça', 0.50, 0.35, 'block', null, 'concede'],
        ['Recuar e cobrir', 0.60, 0.30, 'block', null, 'chance'],
      ],
    },
    build: {
      text: '<b>Pressão alta</b> do adversário na sua saída de bola.',
      opts: [
        ['Driblar o atacante (ousado)', 0.35, 0.35, 'flair', null, 'concede'],
        ['Passe curto para o volante', 0.72, 0.20, 'safe', null, 'chance'],
        ['Chutão para frente', 0.85, 0.10, 'safe'],
      ],
    },
    save: {
      text: '<b>Chute forte de fora da área</b> em direção ao seu gol!',
      opts: [
        ['Espalmar para escanteio', 0.50, 0.35, 'save', null, 'concede'],
        ['Tentar encaixar a bola', 0.40, 0.35, 'save', 'firme', 'concede'],
      ],
    },
    cross: {
      text: '<b>Cruzamento perigoso</b> na pequena área!',
      opts: [
        ['Sair socando', 0.55, 0.30, 'save', null, 'chance'],
        ['Sair para encaixar', 0.45, 0.35, 'save', 'firme', 'concede'],
        ['Ficar embaixo da trave', 0.35, 0.30, 'save', null, 'concede'],
      ],
    },
    gk_one: {
      text: 'O atacante adversário sai <b>cara a cara com você</b>!',
      opts: [
        ['Sair abafando', 0.30, 0.35, 'save', null, 'concede'],
        ['Esperar e fechar o ângulo', 0.28, 0.35, 'save', null, 'concede'],
      ],
    },
    distribution: {
      text: 'Você tem a bola nas mãos e o adversário está <b>todo no ataque</b>.',
      opts: [
        ['Reposição rápida para o contra-ataque', 0.15, 0.25, 'assist'],
        ['Segurar e esfriar o jogo', 0.92, 0.05, 'safe'],
      ],
    },
  };
  return D[type];
}

function skill() { return clamp((P().ovr - 50) / 45, 0, 1); }
function momentProb(base, range) {
  const diff = (M.opp.s - M.eff) / 100 * 0.8;
  return clamp(base + skill() * range + moodTotal() - diff, 0.03, 0.97);
}

function playMatch(cfg) {
  const p = P();
  const kind = cfg.kind;
  const tc = titularChance(cfg.ourStr, kind);
  const titular = rnd() < tc;
  const sub = !titular && rnd() < subChance();
  const unavailable = p.injury > 0 || p.suspended > 0;
  M = Object.assign({}, cfg, {
    tc, titular, sub, unavailable,
    us: 0, them: 0, goals: 0, assists: 0, rDelta: 0, red: false,
    log: [], idx: 0, auto: false,
  });
  M.playing = titular || sub;
  M.eff = effStr(cfg.ourStr, titular);
  const lu = lambda(M.eff, cfg.opp.s, cfg.home) * (M.playing ? 0.72 : 1);
  const lt = lambda(cfg.opp.s, M.eff, cfg.home === null ? null : !cfg.home) * (M.playing ? 0.8 : 1);
  M.baseUs = Array.from({ length: poisson(lu) }, () => randInt(1, 90)).sort((a, b) => a - b);
  M.baseThem = Array.from({ length: poisson(lt) }, () => randInt(1, 90)).sort((a, b) => a - b);

  // jogadas do jogador
  const moments = [];
  if (M.playing) {
    const types = [...MOMENTS[p.pos]].sort(() => rnd() - 0.5);
    const n = titular ? 3 : (rnd() < 0.35 ? 2 : 1);
    for (let i = 0; i < n; i++) moments.push({ type: types[i] });
    const pen = { ATA: 0.18, MEI: 0.14, ZAG: 0.05, GOL: 0 }[p.pos];
    const fk = { ATA: 0.14, MEI: 0.22, ZAG: 0.07, GOL: 0 }[p.pos];
    if (rnd() < pen) moments.push({ type: 'penalty' });
    if (rnd() < fk) moments.push({ type: 'freekick' });
    if (p.pos === 'GOL' && rnd() < 0.16) moments.push({ type: 'pen_def' });
    const lo = titular ? 4 : 60;
    const mins = moments.map(() => randInt(lo, 89)).sort((a, b) => a - b);
    moments.sort(() => rnd() - 0.5).forEach((m, i) => { m.min = mins[i]; });
  }
  M.moments = moments;
  renderMatchIntro();
}

function scoreAt(min) {
  if (min === null) min = 0;
  const us = M.baseUs.filter(m => m <= min).length + M.extraUs.filter(m => m <= min).length;
  const them = M.baseThem.filter(m => m <= min).length + M.extraThem.filter(m => m <= min).length;
  return [us, them];
}

function scoreboard(min) {
  const [a, b] = scoreAt(min);
  return `<div class="scoreboard">
    <div class="team">${esc(M.ourName)}</div>
    <div class="score">${a} <span>x</span> ${b}</div>
    <div class="team">${M.opp.flag ? M.opp.flag + ' ' : ''}${esc(M.opp.n)}</div>
    ${min !== null && min <= 120 ? `<div class="minute">${min}'</div>` : ''}
  </div>`;
}

function renderMatchIntro() {
  M.extraUs = []; M.extraThem = [];
  const p = P();
  const mm = moodMods();
  const fmt = v => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
  let lineup;
  if (M.unavailable) lineup = `<div class="lineup bad">🩹 Você está ${p.injury > 0 ? 'lesionado' : 'suspenso'} e não joga esta partida.</div>`;
  else if (M.titular) lineup = `<div class="lineup good">✅ O técnico anunciou: você é <b>TITULAR</b>!</div>`;
  else if (M.sub) lineup = `<div class="lineup mid">🪑 Você começa no <b>banco</b>, mas vai entrar no 2º tempo.</div>`;
  else lineup = `<div class="lineup bad">🪑 Você ficou no banco e <b>não entrou</b> em campo.</div>`;
  const diff = M.opp.s - M.ourStr;
  const fav = diff > 4 ? 'Adversário favorito' : diff < -4 ? 'Seu time é favorito' : 'Jogo equilibrado';
  render(`${newsHtml()}
    <div class="card match">
      <div class="comp">${esc(M.comp)} · ${esc(M.stage)}${M.ko ? ' · mata-mata' : ''}</div>
      ${scoreboard(null)}
      <p class="center muted">${M.home === true ? '🏟️ Em casa' : M.home === false ? '✈️ Fora de casa' : '🌐 Campo neutro'} · ${fav}</p>
      ${M.ctx ? `<p class="center">${M.ctx}</p>` : ''}
      <div class="factors">
        <div>Chance de titularidade: <b class="${chanceClass(M.tc)}">${pct(M.tc)}%</b></div>
        <div class="small">Influência nas jogadas → Fase ${fmt(mm.form)} · Humor ${fmt(mm.humor)} · Equipe ${fmt(mm.chem)}</div>
      </div>
      ${lineup}
      ${M.playing
        ? `<div class="row"><button class="btn big" onclick="matchNext()">▶ Jogar partida</button><button class="btn ghost" onclick="autoMatch()">⏩ Simular</button></div>`
        : `<button class="btn big" onclick="finishMatch()">Ver resultado ▶</button>`}
    </div>`);
}

function matchNext() {
  if (M.red || M.idx >= M.moments.length) return finishMatch();
  const m = M.moments[M.idx];
  if (m.type === 'penalty' || m.type === 'freekick' || m.type === 'pen_def') return renderGoalMoment(m);
  const def = momentDef(m.type);
  m.opts = def.opts.map(o => ({ label: o[0], p: momentProb(o[1], o[2]), win: o[3], tag: o[4], lose: o[5] || 'miss' }));
  render(`
    <div class="card match">
      <div class="comp">${esc(M.comp)} · ${esc(M.stage)}</div>
      ${scoreboard(m.min)}
      <p class="situation">${def.text}</p>
      <div class="opts">
        ${m.opts.map((o, i) => `<button class="opt" onclick="resolveMoment(${i})"><span>${o.label}</span><span class="chance ${chanceClass(o.p)}">${pct(o.p)}%</span></button>`).join('')}
      </div>
      <p class="hint">A % é a chance da jogada dar certo, considerando seu overall, fase, humor, entrosamento e o nível do adversário.</p>
    </div>`);
}

const WIN_TXT = {
  goal: ['GOOOOL! Você balançou a rede!', 'GOLAÇO! Que pintura!'],
  assist: 'Assistência perfeita! Seu companheiro empurrou para a rede: GOL!',
  block: 'Desarme perfeito! Você salvou o time.',
  save: 'DEFESAÇA! Você fechou o gol!',
  safe: 'Jogada segura, o time mantém a posse.',
  flair: 'Que categoria! Você deixou o atacante no chão e saiu jogando. A torcida foi ao delírio.',
  freekick: 'Falta marcada em posição perigosa!',
};
const LOSE_TXT = {
  miss: 'Não deu... a chance foi desperdiçada.',
  chance: 'Você falhou e o adversário teve a chance...',
  concede: 'Você falhou e o adversário marcou. 😣',
  foul: 'Chegou atrasado no carrinho!',
};

function resolveMoment(i) {
  const m = M.moments[M.idx];
  const o = m.opts[i];
  const ok = rnd() < o.p;
  let txt, icon;
  if (ok) {
    icon = '✅';
    switch (o.win) {
      case 'goal': M.extraUs.push(m.min); M.goals++; M.rDelta += o.tag ? 1.4 : 1.1; txt = o.tag ? WIN_TXT.goal[1] : WIN_TXT.goal[0]; icon = '⚽'; break;
      case 'assist': M.extraUs.push(m.min); M.assists++; M.rDelta += 0.7; txt = WIN_TXT.assist; icon = '🅰️'; break;
      case 'block': M.rDelta += 0.5; txt = WIN_TXT.block; break;
      case 'save': M.rDelta += o.tag ? 0.7 : 0.55; txt = WIN_TXT.save; icon = '🧤'; break;
      case 'flair': M.rDelta += 0.6; txt = WIN_TXT.flair; break;
      case 'freekick':
        M.rDelta += 0.2; txt = WIN_TXT.freekick;
        M.moments.splice(M.idx + 1, 0, { type: 'freekick', min: Math.min(90, m.min + 1) });
        break;
      default: M.rDelta += 0.15; txt = WIN_TXT.safe;
    }
  } else {
    icon = '❌';
    switch (o.lose) {
      case 'concede': M.extraThem.push(m.min); M.rDelta -= 0.6; txt = LOSE_TXT.concede; break;
      case 'chance':
        M.rDelta -= 0.35;
        if (rnd() < 0.5) { M.extraThem.push(m.min); txt = LOSE_TXT.chance + ' e marcou. 😣'; }
        else txt = LOSE_TXT.chance + ' mas desperdiçou. Ufa!';
        break;
      case 'foul': {
        M.rDelta -= 0.5;
        const r = rnd();
        if (r < 0.18) { M.red = true; M.rDelta -= 1.2; txt = LOSE_TXT.foul + ' 🟥 CARTÃO VERMELHO! Você foi expulso.'; M.extraThem.push(Math.min(90, m.min + randInt(1, 8))); }
        else if (r < 0.5) { M.extraThem.push(m.min); txt = LOSE_TXT.foul + ' Pênalti para o adversário... e gol. 😣'; }
        else txt = LOSE_TXT.foul + ' Cartão amarelo, mas o perigo passou.';
        break;
      }
      default: M.rDelta -= 0.25; txt = LOSE_TXT.miss;
    }
  }
  M.log.push(`${m.min}' ${icon} ${o.label} (${pct(o.p)}%) — ${ok ? 'deu certo' : 'deu errado'}`);
  M.idx++;
  if (M.auto) return;
  showMomentResult(m.min, icon, txt);
}

function showMomentResult(min, icon, txt) {
  render(`
    <div class="card match">
      <div class="comp">${esc(M.comp)} · ${esc(M.stage)}</div>
      ${scoreboard(min)}
      <div class="big-emoji">${icon}</div>
      <p class="situation">${txt}</p>
      <button class="btn big" onclick="matchNext()">${M.red || M.idx >= M.moments.length ? 'Fim de jogo ▶' : 'Continuar ▶'}</button>
    </div>`);
}

// ---------- Pênalti / falta: escolha do canto ----------
const ZONES = ['Alto esquerdo', 'Alto centro', 'Alto direito', 'Baixo esquerdo', 'Baixo centro', 'Baixo direito'];

function gkTendency() {
  const side = rnd() < 0.5 ? 0 : 2;
  const t = [0.4, 0.2, 0.4];
  const skew = 0.15 + rnd() * 0.15;
  t[side] += skew; t[2 - side] -= skew;
  return t; // pulo para [esquerda, fica, direita]
}
function saveProb(dive, zone) {
  const col = zone % 3, top = zone < 3;
  if (col === dive) return col === 1 ? (top ? 0.45 : 0.85) : (top ? 0.2 : 0.65);
  if (col === 1) return top ? 0.05 : 0.08;
  return 0.02;
}
function penaltyProbs(tend, pressure = 0) {
  const sk = skill(), md = moodTotal();
  const acc = [0.80, 0.90, 0.80, 0.92, 0.97, 0.92].map(a => clamp(a + sk * 0.07 + md * 0.3 - pressure, 0.4, 0.995));
  return acc.map((a, z) => a * (1 - tend.reduce((s, t, d) => s + t * saveProb(d, z), 0)));
}
function freekickProbs(far) {
  const sk = skill(), md = moodTotal();
  const base = [0.22, 0.06, 0.13, 0.03, 0.12, 0.07];
  return base.map(b => clamp((b + sk * 0.12 * (b > 0.05 ? 1 : 0.3) + md * 0.3) * (far ? 0.6 : 1) - (M.opp.s - M.eff) / 300, 0.01, 0.6));
}
// Goleiro defendendo pênalti: chance de defesa ao pular para cada lado
function penDefProbs(kickW) {
  const sk = skill(), md = moodTotal();
  const acc = [0.80, 0.90, 0.80, 0.92, 0.97, 0.92];
  return [0, 1, 2].map(d => clamp(kickW.reduce((s, w, z) => s + w * ((1 - acc[z]) + acc[z] * saveProb(d, z) * (0.8 + sk * 0.5 + md)), 0), 0.03, 0.9));
}
function kickerTendency() {
  const side = rnd() < 0.5 ? 0 : 2;
  const w = [0.12, 0.08, 0.12, 0.25, 0.18, 0.25];
  w[side] += 0.08; w[side + 3] += 0.08; w[2 - side] -= 0.06; w[5 - side] -= 0.10;
  return w;
}
const SIDE = ['ESQUERDA', 'MEIO', 'DIREITA'];

function goalGrid(probs, onclick, labels) {
  return `<div class="goal">
    <div class="net">
      ${probs.map((p, i) => `<button class="zone ${chanceClass(p)}" onclick="${onclick}(${i})"><small>${labels[i]}</small><b>${pct(p)}%</b></button>`).join('')}
    </div>
  </div>`;
}

function renderGoalMoment(m) {
  if (m.type === 'penalty') {
    m.tend = m.tend || gkTendency();
    m.probs = penaltyProbs(m.tend, m.pressure || 0);
    const fav = m.tend[0] > m.tend[2] ? 0 : 2;
    const hint = `📋 Analista: o goleiro pulou para a <b>${SIDE[fav]}</b> em ${Math.round(m.tend[fav] * 10)} dos últimos 10 pênaltis.`;
    render(`
      <div class="card match">
        <div class="comp">${esc(M.comp)} · ${esc(M.stage)}</div>
        ${m.shootout ? shootoutBoard() : scoreboard(m.min)}
        <p class="situation">${m.shootout ? '<b>Disputa de pênaltis!</b> Você vai bater a cobrança decisiva.' : '<b>PÊNALTI!</b> Você pega a bola e coloca na marca. Escolha o canto:'}</p>
        <p class="hint">${hint}</p>
        ${goalGrid(m.probs, 'shootGoal', ZONES)}
        <p class="hint">Cantos altos: difícil pro goleiro, mas risco de isolar. Meio: ótimo se ele pular.</p>
      </div>`);
  } else if (m.type === 'freekick') {
    m.far = m.far !== undefined ? m.far : rnd() < 0.4;
    m.probs = freekickProbs(m.far);
    const cross = clamp(0.16 + skill() * 0.12 + moodTotal(), 0.05, 0.5);
    m.cross = cross;
    render(`
      <div class="card match">
        <div class="comp">${esc(M.comp)} · ${esc(M.stage)}</div>
        ${scoreboard(m.min)}
        <p class="situation"><b>FALTA ${m.far ? 'de longe (30 metros)' : 'na entrada da área'}!</b> A barreira está à esquerda, o goleiro cobre o lado direito. Onde você bate?</p>
        <div class="wall-hint">🧱🧱🧱 barreira</div>
        ${goalGrid(m.probs, 'shootGoal', ['Ângulo (sobre a barreira)', 'Por cima, no meio', 'Ângulo do goleiro', 'Na barreira', 'Por baixo da barreira', 'Rasteiro no canto do goleiro'])}
        <div class="opts"><button class="opt" onclick="shootGoal(-1)"><span>Cruzar na área para o cabeceio</span><span class="chance ${chanceClass(cross)}">${pct(cross)}%</span></button></div>
      </div>`);
  } else {
    m.kw = m.kw || kickerTendency();
    m.probs = penDefProbs(m.kw);
    const fav = m.kw[0] + m.kw[3] > m.kw[2] + m.kw[5] ? 0 : 2;
    render(`
      <div class="card match">
        <div class="comp">${esc(M.comp)} · ${esc(M.stage)}</div>
        ${m.shootout ? shootoutBoard() : scoreboard(m.min)}
        <p class="situation"><b>PÊNALTI CONTRA!</b> ${m.shootout ? 'Cobrança decisiva da disputa!' : ''} Para que lado você vai pular?</p>
        <p class="hint">📋 Preparador de goleiros: esse batedor costuma bater na <b>${SIDE[fav]}</b>.</p>
        <div class="goal"><div class="net three">
          ${[0, 1, 2].map(d => `<button class="zone ${chanceClass(m.probs[d])}" onclick="diveGoal(${d})"><small>${['Pular à esquerda', 'Ficar no meio', 'Pular à direita'][d]}</small><b>${pct(m.probs[d])}%</b></button>`).join('')}
        </div></div>
        <p class="hint">A % é a chance de você defender (ou do batedor errar).</p>
      </div>`);
  }
}

function shootGoal(z) {
  const m = M.moments[M.idx];
  let ok, txt, icon;
  if (m.type === 'penalty') {
    const dive = weighted([0, 1, 2], d => m.tend[d]);
    const acc = penaltyProbs([0, 0, 0], m.pressure || 0)[z]; // só precisão
    const onTarget = rnd() < acc;
    const saved = onTarget && rnd() < saveProb(dive, z);
    ok = onTarget && !saved;
    const where = ZONES[z].toLowerCase();
    const diveTxt = dive === 1 ? 'ficou parado no meio' : `pulou para a ${SIDE[dive].toLowerCase()}`;
    if (!onTarget) txt = `Você bateu no ${where}... e a bola foi PRA FORA! 😱`;
    else if (saved) txt = `Você bateu no ${where}, o goleiro ${diveTxt} e DEFENDEU! 🧤`;
    else txt = `Você bateu no ${where}, o goleiro ${diveTxt}... GOOOOL! ⚽`;
    icon = ok ? '⚽' : '❌';
    M.log.push(`${m.shootout ? 'Pênaltis' : m.min + "'"} 🥅 Pênalti no ${where} (${pct(m.probs[z])}%) — ${ok ? 'GOL' : 'perdeu'}`);
  } else {
    if (z === -1) {
      ok = rnd() < m.cross;
      txt = ok ? 'Cruzamento na medida e o zagueiro cabeceou para o gol! Assistência!' : 'O goleiro saiu e cortou o cruzamento.';
      icon = ok ? '🅰️' : '❌';
      M.log.push(`${m.min}' 🎯 Falta cruzada (${pct(m.cross)}%) — ${ok ? 'assistência' : 'cortada'}`);
    } else {
      ok = rnd() < m.probs[z];
      const where = ZONES[z].toLowerCase();
      txt = ok ? `Cobrança no ${where}... GOLAÇO DE FALTA! 🚀` : pick([`A bola explodiu na barreira.`, `O goleiro se esticou todo e espalmou.`, `Passou raspando a trave!`]);
      icon = ok ? '⚽' : '❌';
      M.log.push(`${m.min}' 🎯 Falta no ${where} (${pct(m.probs[z])}%) — ${ok ? 'GOL' : 'não entrou'}`);
    }
  }
  if (m.shootout) return afterShootoutKick(ok, txt);
  if (ok) {
    M.extraUs.push(m.min);
    if (m.type === 'freekick' && z === -1) { M.assists++; M.rDelta += 0.7; }
    else { M.goals++; M.rDelta += m.type === 'freekick' ? 1.5 : 0.9; }
  } else M.rDelta -= m.type === 'penalty' ? 0.7 : 0.15;
  M.idx++;
  if (!M.auto) showMomentResult(m.min, icon, txt);
}

function diveGoal(d) {
  const m = M.moments[M.idx];
  const z = weighted([0, 1, 2, 3, 4, 5], i => m.kw[i]);
  const acc = [0.80, 0.90, 0.80, 0.92, 0.97, 0.92][z];
  const onTarget = rnd() < acc;
  const saved = onTarget && rnd() < clamp(saveProb(d, z) * (0.8 + skill() * 0.5 + moodTotal()), 0, 0.97);
  const ok = !onTarget || saved;
  const where = ZONES[z].toLowerCase();
  const txt = !onTarget ? `O batedor mandou no ${where}... PRA FORA! 😅`
    : saved ? `Você pulou para a ${SIDE[d].toLowerCase()} e DEFENDEU a cobrança no ${where}! 🧤🔥`
      : `Você foi para a ${SIDE[d].toLowerCase()}, mas ele bateu no ${where}. Gol do adversário.`;
  M.log.push(`${m.shootout ? 'Pênaltis' : m.min + "'"} 🧤 Pênalti contra — pulou ${SIDE[d].toLowerCase()} (${pct(m.probs[d])}%) — ${ok ? 'DEFENDEU' : 'gol deles'}`);
  if (m.shootout) return afterShootoutKick(!ok, txt);
  if (ok) M.rDelta += saved ? 1.0 : 0.2; else { M.extraThem.push(m.min); M.rDelta -= 0.2; }
  M.idx++;
  if (!M.auto) showMomentResult(m.min, ok ? '🧤' : '❌', txt);
}

// Simula a partida inteira escolhendo a opção mais provável
function autoMatch() {
  M.auto = true;
  while (!M.red && M.idx < M.moments.length) {
    const m = M.moments[M.idx];
    if (m.type === 'penalty' || m.type === 'freekick') {
      if (m.type === 'penalty') { m.tend = gkTendency(); m.probs = penaltyProbs(m.tend); }
      else { m.far = rnd() < 0.4; m.probs = freekickProbs(m.far); m.cross = clamp(0.16 + skill() * 0.12 + moodTotal(), 0.05, 0.5); }
      let best = m.probs.indexOf(Math.max(...m.probs));
      if (m.type === 'freekick' && m.cross > m.probs[best]) best = -1;
      shootGoal(best);
    } else if (m.type === 'pen_def') {
      m.kw = kickerTendency(); m.probs = penDefProbs(m.kw);
      diveGoal(m.probs.indexOf(Math.max(...m.probs)));
    } else {
      const def = momentDef(m.type);
      m.opts = def.opts.map(o => ({ label: o[0], p: momentProb(o[1], o[2]), win: o[3], tag: o[4], lose: o[5] || 'miss' }));
      const val = { goal: 1, assist: 0.85, block: 1, save: 1, flair: 0.5, freekick: 0.5, safe: 0.25 };
      let bi = 0, bv = -1;
      m.opts.forEach((o, i) => { const v = o.p * (val[o.win] || 0.3); if (v > bv) { bv = v; bi = i; } });
      resolveMoment(bi);
    }
  }
  finishMatch(true);
}

// ---------- Disputa de pênaltis ----------
function shootoutBoard() {
  const sh = M.sh;
  const dots = arr => arr.map(x => x ? '🟢' : '🔴').join('') || '—';
  return `<div class="scoreboard">
    <div class="team">${esc(M.ourName)}</div>
    <div class="score">${M.us} <span>x</span> ${M.them}</div>
    <div class="team">${M.opp.flag ? M.opp.flag + ' ' : ''}${esc(M.opp.n)}</div>
    <div class="minute">Pênaltis: ${sh.us.filter(Boolean).length} x ${sh.them.filter(Boolean).length}</div>
  </div>
  <div class="pens"><div>${dots(sh.us)}</div><div>${dots(sh.them)}</div></div>`;
}
function shootoutDecided(sh) {
  const ug = sh.us.filter(Boolean).length, tg = sh.them.filter(Boolean).length;
  if (sh.us.length <= 5 && sh.them.length <= 5 && !(sh.us.length === 5 && sh.them.length === 5)) {
    const ul = 5 - sh.us.length, tl = 5 - sh.them.length;
    return ug + ul < tg || tg + tl < ug;
  }
  return sh.us.length === sh.them.length && ug !== tg;
}
function startShootout() {
  const p = P();
  const onField = M.playing && !M.red;
  M.sh = { us: [], them: [], hook: onField ? (p.pos === 'GOL' ? 'save' : 'kick') : null, done: false };
  continueShootout();
}
function continueShootout() {
  const sh = M.sh;
  const pUs = clamp(0.75 + (M.eff - M.opp.s) / 200, 0.6, 0.88);
  const pThem = clamp(0.75 + (M.opp.s - M.eff) / 200, 0.6, 0.88);
  while (!shootoutDecided(sh)) {
    const usTurn = sh.us.length === sh.them.length;
    const round = (usTurn ? sh.us.length : sh.them.length) + 1;
    if (!sh.done && round === 5 && ((usTurn && sh.hook === 'kick') || (!usTurn && sh.hook === 'save'))) {
      sh.done = true;
      const m = { type: usTurn ? 'penalty' : 'pen_def', shootout: true, pressure: 0.03, min: 120 };
      M.moments.push(m);
      M.idx = M.moments.length - 1;
      if (M.auto) {
        if (usTurn) { m.tend = gkTendency(); m.probs = penaltyProbs(m.tend, 0.03); shootGoal(m.probs.indexOf(Math.max(...m.probs))); }
        else { m.kw = kickerTendency(); m.probs = penDefProbs(m.kw); diveGoal(m.probs.indexOf(Math.max(...m.probs))); }
        continue;
      }
      return renderGoalMoment(m);
    }
    if (usTurn) sh.us.push(rnd() < pUs); else sh.them.push(rnd() < pThem);
  }
  const ug = sh.us.filter(Boolean).length, tg = sh.them.filter(Boolean).length;
  M.penWin = ug > tg;
  M.penScore = `${ug}x${tg}`;
  endMatch();
}
function afterShootoutKick(ok, txt) {
  const sh = M.sh;
  const m = M.moments[M.idx];
  if (m.type === 'penalty') { sh.us.push(ok); M.rDelta += ok ? 0.3 : -0.5; }
  else { sh.them.push(ok); M.rDelta += ok ? -0.1 : 0.6; }
  M.idx = M.moments.length;
  if (M.auto) return;
  render(`
    <div class="card match">
      <div class="comp">${esc(M.comp)} · ${esc(M.stage)}</div>
      ${shootoutBoard()}
      <p class="situation">${txt}</p>
      <button class="btn big" onclick="continueShootout()">Continuar ▶</button>
    </div>`);
}

function finishMatch(auto) {
  const [a, b] = scoreAt(999);
  M.us = a; M.them = b;
  if (M.ko && a === b) {
    if (auto || !M.playing || M.red) { M.auto = true; startShootout(); return; }
    render(`
      <div class="card match">
        <div class="comp">${esc(M.comp)} · ${esc(M.stage)}</div>
        ${scoreboard(90)}
        <p class="situation">Empate no tempo normal e na prorrogação! A decisão vai para os <b>PÊNALTIS</b>.</p>
        <button class="btn big" onclick="startShootout()">Ir para os pênaltis 🥅</button>
      </div>`);
    return;
  }
  endMatch();
}

function endMatch() {
  const p = P();
  const a = M.us, b = M.them;
  const win = a > b || (a === b && M.penWin === true);
  const loss = a < b || (a === b && M.penWin === false);
  const kind = M.kind;
  let rating = null;
  const before = { form: p.form, humor: p.humor, chem: p.chem, coach: p.coach };

  if (M.playing) {
    let r = (M.titular ? 6.3 : 6.0) + M.rDelta + (win ? 0.3 : loss ? -0.3 : 0) + rnd() * 0.4 - 0.2;
    if (p.pos === 'GOL') r += b === 0 ? 0.6 : -b * 0.15;
    if (p.pos === 'ZAG') r += b === 0 ? 0.3 : -b * 0.1;
    rating = Math.round(clamp(r, 3, 10) * 10) / 10;
    p.form = clamp(p.form + (rating - 6.6) * 6, 0, 100);
    p.coach = clamp(p.coach + (rating - 6.6) * 3, 0, 100);
    p.chem = clamp(p.chem + 2, 0, 100);
    p.fame = clamp(p.fame + M.goals * 0.4 + (rating >= 8 ? 1 : 0) + (M.big && win ? 2 : 0), 0, 100);
    if (M.red) p.suspended += 1;
    if (rnd() < 0.03) { p.injury += randInt(1, 4); news(`🩹 Você saiu machucado e vai desfalcar o time por ${p.injury} jogos.`); }
  } else {
    if (M.unavailable) { if (p.injury > 0) p.injury--; else if (p.suspended > 0) p.suspended--; }
    else { p.humor = clamp(p.humor - 4, 0, 100); p.form = clamp(p.form - 2, 0, 100); }
  }
  p.humor = clamp(p.humor + (win ? 3 : loss ? -3 : 0), 0, 100);

  // estatísticas
  if (kind === 'nat') {
    if (M.playing) { G.nat.caps++; G.nat.goals += M.goals; G.nat.assists += M.assists; }
  } else if (kind === 'club') {
    const st = G.S.stats;
    st.possible++;
    if (M.playing) {
      st.games++; if (M.titular) st.starts++;
      st.goals += M.goals; st.assists += M.assists; st.rSum += rating; st.rN++;
      if (M.table) st.leagueGoals += M.goals;
      if (p.pos === 'GOL' && M.titular && b === 0) st.cleanSheets++;
    }
  } else if (kind === 'youth') {
    const st = G.S.stats;
    if (M.playing) { st.games++; st.goals += M.goals; st.assists += M.assists; st.rSum += rating; st.rN++; }
  }
  if (kind !== 'nat') {
    G.S.last = win ? 'W' : loss ? 'L' : 'D';
    G.S.lastBench = !M.titular && !M.unavailable;
  }

  const msg = M.onEnd({ us: a, them: b, win, loss }) || '';
  checkCallup();

  const d = k => { const v = Math.round(p[k] - before[k]); return v ? `<span class="chip ${v > 0 ? 'up' : 'down'}">${STAT_LABEL[k]} ${v > 0 ? '+' : ''}${v}</span>` : ''; };
  const resTxt = win ? 'VITÓRIA' : loss ? 'DERROTA' : 'EMPATE';
  render(`
    <div class="card match">
      <div class="comp">${esc(M.comp)} · ${esc(M.stage)}</div>
      ${scoreboard(999)}
      ${M.penScore ? `<p class="center">Pênaltis: <b>${M.penScore}</b></p>` : ''}
      <h2 class="center result ${win ? 'w' : loss ? 'l' : 'd'}">${resTxt}</h2>
      ${msg ? `<p class="center big-msg">${msg}</p>` : ''}
      ${rating !== null
        ? `<div class="rating"><div class="r ${rating >= 7.5 ? 'hi' : rating >= 6.5 ? 'mid' : 'lo'}">${rating.toFixed(1)}</div><div>Sua nota<br><small>${M.goals} gol(s) · ${M.assists} assist.${M.red ? ' · 🟥 expulso' : ''}</small></div></div>`
        : `<p class="center muted">Você não entrou em campo.</p>`}
      ${M.log.length ? `<ul class="log">${M.log.map(l => `<li>${l}</li>`).join('')}</ul>` : ''}
      <div class="chips">${d('form')}${d('humor')}${d('chem')}${d('coach')}</div>
      <button class="btn big" onclick="next()">Continuar ▶</button>
    </div>`);
  M = null;
  save();
}

// ------------------------------------------------------------
// Fim de temporada
// ------------------------------------------------------------
function runSeasonEnd() {
  const S = G.S;
  const L = S.league;
  while (L.played < L.rounds) simLeagueRound(null);
  const club = clubOf(G.club);
  const c = country(club.c);
  const pos = myPos();
  S.pos = pos;
  const n = L.table.length;
  const notes = [];

  if (pos === 1) { addTitle(L.name); notes.push(`🏆 CAMPEÃO da ${L.name}!`); }
  else notes.push(`${L.name}: terminou em <b>${pos}º</b> lugar.`);

  // acesso / rebaixamento (Brasil)
  if (club.c === 'BR') {
    if (club.d > 1 && pos <= 4) {
      club.d--; notes.push(`⬆️ ACESSO! O ${club.n} vai disputar a ${leagueName(club)}.`);
      const down = Object.values(G.clubs).filter(x => x.c === 'BR' && x.d === club.d && x.n !== club.n).sort((a, b) => a.s - b.s)[0];
      if (down) down.d++;
    } else if (club.d < 4 && pos > n - 4) {
      club.d++; notes.push(`⬇️ REBAIXADO! O ${club.n} vai disputar a ${leagueName(club)}.`);
      const up = Object.values(G.clubs).filter(x => x.c === 'BR' && x.d === club.d && x.n !== club.n).sort((a, b) => b.s - a.s)[0];
      if (up) up.d--;
    }
  }
  // vaga continental
  if (club.d === 1 && G.qual[G.club] === undefined) {
    if (pos <= c.top) G.qual[G.club] = 'main';
    else if (CONFEDS[c.confed].second && pos <= c.top + (club.c === 'BR' ? 6 : 2)) G.qual[G.club] = 'second';
    else G.qual[G.club] = null;
  }
  if (G.qual[G.club]) notes.push(`🌎 Vaga garantida na ${G.qual[G.club] === 'main' ? CONFEDS[c.confed].main : CONFEDS[c.confed].second} da próxima temporada.`);

  // seleção: corte
  const p = P();
  if (G.nat.called && (p.ovr < 82 || p.form < 30) && rnd() < 0.6) {
    G.nat.called = false;
    notes.push(`📉 Você foi cortado da seleção por queda de rendimento.`);
  }
  checkCallup();

  // monta o restante do calendário
  const tn = tournamentName();
  const rest = [];
  if (tn) {
    rest.push({ t: 'tourn', stage: 'groups', name: tn });
    if (tn === 'Copa do Mundo') rest.push({ t: 'tourn', stage: 'Oitavas de final', name: tn });
    rest.push({ t: 'tourn', stage: 'Quartas de final', name: tn }, { t: 'tourn', stage: 'Semifinal', name: tn }, { t: 'tourn', stage: 'Final', name: tn });
  }
  rest.push({ t: 'awards' }, { t: 'offers' }, { t: 'newseason' });
  G.agenda = G.agenda.concat(rest);

  const st = S.stats;
  const avg = st.rN ? (st.rSum / st.rN).toFixed(2) : '-';
  render(`${newsHtml()}
    <div class="card">
      <h2>🏁 Fim da temporada ${G.year}</h2>
      ${notes.map(x => `<p>${x}</p>`).join('')}
      <h3>Classificação final</h3>
      ${tableHtml(6)}
      <h3>Seus números no clube</h3>
      <div class="stats">
        <div><b>${st.games}</b><small>Jogos</small></div>
        <div><b>${st.goals}</b><small>Gols</small></div>
        <div><b>${st.assists}</b><small>Assist.</small></div>
        <div><b>${avg}</b><small>Nota média</small></div>
        ${p.pos === 'GOL' ? `<div><b>${st.cleanSheets}</b><small>Sem sofrer gol</small></div>` : ''}
      </div>
      ${S.titles.length ? `<p class="trophies">${S.titles.map(t => `🏆 ${t}`).join('<br>')}</p>` : ''}
      ${G.nat.called && tn ? `<p class="big-msg">${country(p.nat).flag} Agora é hora da <b>${tn} ${G.year}</b>!</p>` : ''}
      <button class="btn big" onclick="next()">Continuar ▶</button>
    </div>`);
  save();
}

function runAwards() {
  const p = P();
  const S = G.S;
  const st = S.stats;
  const club = clubOf(G.club);
  const c = country(club.c);
  const avg = st.rN ? st.rSum / st.rN : 6.0;
  const share = st.possible ? st.games / st.possible : 0;
  const awards = [];
  const bigTitles = S.titles.filter(t => /Champions|Libertadores|Mundial|Copa do Mundo|Eurocopa|Copa América|Liga|Premier|LaLiga|Serie A|Bundesliga|Ligue 1|Brasileirão Série A/.test(t)).length;

  // Bola de Ouro
  if (p.ovr >= 84 && club.d === 1) {
    const lf = c.confed === 'UEFA' ? 1 : 0.75;
    const ga = p.pos === 'ATA' || p.pos === 'MEI' ? (st.goals + st.assists) * 0.35 : 8;
    const score = ((p.ovr - 82) * 4 + (avg - 7.0) * 15 + bigTitles * 6 + ga) * lf + rnd() * 10;
    if (score >= 62) awards.push('🥇 Bola de Ouro');
    else if (score >= 48) news(`🥉 Você ficou entre os 3 finalistas da Bola de Ouro!`);
  }
  // Artilheiro
  const L = S.league;
  if ((p.pos === 'ATA' || p.pos === 'MEI') && st.leagueGoals >= Math.max(12, L.rounds * 0.55)) awards.push(`👟 Artilheiro (${L.name})`);
  if (avg >= 7.45 && share >= 0.6) awards.push(`⭐ Craque do campeonato (${L.name})`);
  if (p.pos === 'GOL' && st.cleanSheets >= L.rounds * 0.5) awards.push(`🧤 Goleiro menos vazado (${L.name})`);
  if (p.age <= 21 && avg >= 7.1 && st.games >= 20) awards.push('🌟 Revelação da temporada');
  for (const a of awards) G.awards.push({ name: a, year: G.year });
  p.fame = clamp(p.fame + awards.length * 6, 0, 100);

  // histórico
  G.history.push({ year: G.year, club: G.club, games: st.games, goals: st.goals, assists: st.assists, avg: st.rN ? avg : null, ovr: Math.floor(p.ovr), titles: [...S.titles] });
  const car = G.career;
  car.games += st.games; car.goals += st.goals; car.assists += st.assists; car.rSum += st.rSum; car.rN += st.rN; car.cleanSheets += st.cleanSheets;
  p.money += p.salary;

  // evolução
  const old = p.ovr;
  const a = p.age;
  let g = a <= 20 ? 2 + rnd() * 4 : a <= 23 ? 1 + rnd() * 3 : a <= 27 ? rnd() * 2.5 : a <= 30 ? -0.5 + rnd() * 1.5 : a <= 33 ? -2 + rnd() * 1.5 : -3.5 + rnd() * 1.5;
  if (g > 0) g *= 0.5 + Math.min(share, 1);
  g += (avg - 6.4) * (a <= 30 ? 0.6 : 0.3);
  g += (club.s - 65) / 40; // estrutura do clube
  let nv = p.ovr + g;
  if (nv > p.pot) nv = Math.max(p.ovr, p.pot - rnd() * 0.5);
  p.ovr = clamp(nv, 35, 99);
  p.age++;

  const canRetire = p.age >= 33;
  const forced = p.age >= 40 || (p.age >= 35 && p.ovr < 62);
  render(`${newsHtml()}
    <div class="card">
      <h2>📊 Balanço ${G.year}</h2>
      <p class="delta">Overall: ${Math.floor(old)} → <b>${Math.floor(p.ovr)}</b> ${p.ovr >= old ? '📈' : '📉'}</p>
      <p>Idade: <b>${p.age} anos</b> · Valor de mercado: <b>${fmtMoney(marketValue())}</b> · Patrimônio: <b>${fmtMoney(p.money)}</b></p>
      ${awards.length ? `<h3>Prêmios individuais</h3><p class="trophies">${awards.join('<br>')}</p>` : ''}
      ${S.titles.length ? `<h3>Títulos da temporada</h3><p class="trophies">${S.titles.map(t => `🏆 ${t}`).join('<br>')}</p>` : '<p class="muted">Nenhum título nesta temporada.</p>'}
      ${!G.nat.called && p.ovr >= 80 ? `<p class="hint">📞 Para ser convocado: overall 85 e grande fase (Fase ≥ 70).</p>` : ''}
      ${forced ? `<p class="big-msg">Seu corpo já não aguenta mais o ritmo. Chegou a hora de pendurar as chuteiras.</p><button class="btn big" onclick="retire()">Encerrar carreira 🏁</button>`
        : `<button class="btn big" onclick="next()">Continuar ▶</button>${canRetire ? `<button class="btn ghost" onclick="retire()">Aposentar-se agora</button>` : ''}`}
    </div>`);
  save();
}

// ------------------------------------------------------------
// Mercado: propostas
// ------------------------------------------------------------
function estTitular(club) {
  const p = P();
  return clamp(50 + (p.ovr - club.s) * 4 + (p.form - 50) * 0.35, 3, 97) / 100;
}

function genOffers() {
  const p = P();
  const S = G.S;
  const cur = clubOf(G.club);
  const st = S.stats;
  const avg = st.rN ? st.rSum / st.rN : 6.2;
  const share = st.possible ? st.games / st.possible : 0;
  const perf = (avg - 6.6) * 2 + p.fame / 40 + S.moreOffers;
  const offers = [];
  const exclude = new Set([G.club]);
  if (G.loan) exclude.add(G.loan.parent);
  const maxS = p.ovr + 3 + perf * 1.5;
  const cands = Object.values(G.clubs).filter(c => !exclude.has(c.n) && c.s <= maxS && c.s >= p.ovr - 12 && c.s >= cur.s - 4);
  let n = (rnd() < 0.75 ? 1 : 0) + (perf > 1 ? 1 : 0) + (rnd() < 0.35 + S.moreOffers * 0.1 ? 1 : 0);
  if (p.age >= 33) n = Math.max(0, n - 1);
  for (let i = 0; i < n && cands.length; i++) {
    const c = weighted(cands, x => Math.pow(Math.max(1, x.s - (p.ovr - 13)), 1.6));
    cands.splice(cands.indexOf(c), 1);
    offers.push({ club: c.n, salary: Math.round(salaryFor(c, p.ovr) * (0.9 + rnd() * 0.4)), loan: false });
  }
  // empréstimo para ganhar minutos
  if (p.age <= 22 && share < 0.4) {
    const lc = Object.values(G.clubs).filter(c => !exclude.has(c.n) && c.s < cur.s - 3 && c.s <= p.ovr + 2 && c.s >= p.ovr - 10);
    if (lc.length) {
      const c = pick(lc);
      offers.push({ club: c.n, salary: p.salary, loan: true });
    }
  }
  return offers;
}

function runOffers(it) {
  const p = P();
  if (!it.offers) {
    if (G.loan) {
      const back = G.loan.parent;
      const loanClub = G.club;
      const st = G.S.stats;
      const avg = st.rN ? st.rSum / st.rN : 6;
      news(`🔁 Fim do empréstimo: você retorna ao ${back}.`);
      G.club = back; G.loan = null;
      p.chem = 45; p.coach = 50;
      it.offers = genOffers();
      if (avg >= 6.8 && !it.offers.some(o => o.club === loanClub)) {
        it.offers.unshift({ club: loanClub, salary: salaryFor(clubOf(loanClub), p.ovr), loan: false, buy: true });
      }
    } else it.offers = genOffers();
    save();
  }
  const cur = clubOf(G.club);
  const cards = it.offers.map((o, i) => {
    const c = clubOf(o.club);
    if (!c) return '';
    const q = contQualFor(o.club);
    const neg = clamp(0.35 + (p.ovr - c.s) / 30 + p.fame / 300, 0.1, 0.85);
    return `<div class="offer">
      <div class="otitle">${clubLabel(c)} ${o.loan ? '<span class="tag">Empréstimo 1 temporada</span>' : ''}${o.buy ? '<span class="tag">Compra definitiva</span>' : ''}</div>
      <div class="ometa">${leagueName(c)} · Nível <b class="stars">${stars(c.s)}</b>${q ? ` · 🌎 ${q === 'main' ? CONFEDS[country(c.c).confed].main : CONFEDS[country(c.c).confed].second}` : ''}</div>
      <div class="ometa">Salário: <b>${fmtMoney(o.salary)}/ano</b> · Chance de titular: <b class="${chanceClass(estTitular(c))}">${pct(estTitular(c))}%</b></div>
      <div class="row">
        <button class="btn" onclick="acceptOffer(${i})">Aceitar</button>
        ${!o.negotiated && !o.loan ? `<button class="btn ghost" onclick="negotiate(${i})">Pedir +35% salário (${pct(neg)}%)</button>` : ''}
      </div>
    </div>`;
  }).join('');
  const unhappy = p.ovr > cur.s + 8;
  render(`${newsHtml()}
    <div class="card">
      <h2>💼 Janela de transferências</h2>
      ${it.offers.length ? `<p>Seu empresário recebeu ${it.offers.length} proposta(s):</p>${cards}` : '<p>Nenhum clube fez proposta nesta janela.</p>'}
      <div class="offer stay">
        <div class="otitle">Permanecer no ${clubLabel(cur)}</div>
        <div class="ometa">${leagueName(cur)} · Chance de titular: <b class="${chanceClass(estTitular(cur))}">${pct(estTitular(cur))}%</b></div>
        ${unhappy ? '<div class="ometa warn">Você sente que já é bom demais para este clube (humor -6).</div>' : ''}
        <button class="btn ghost" onclick="stayClub()">Ficar</button>
      </div>
    </div>`);
}

function negotiate(i) {
  const it = G.cur;
  const o = it.offers[i];
  const c = clubOf(o.club);
  const p = P();
  const pr = clamp(0.35 + (p.ovr - c.s) / 30 + p.fame / 300, 0.1, 0.85);
  o.negotiated = true;
  if (rnd() < pr) { o.salary = Math.round(o.salary * 1.35); news(`✅ O ${c.n} aceitou pagar ${fmtMoney(o.salary)}/ano!`); }
  else { it.offers.splice(i, 1); news(`❌ O ${c.n} não gostou da exigência e retirou a proposta.`); }
  save();
  runOffers(it);
}

function acceptOffer(i) {
  const o = G.cur.offers[i];
  const p = P();
  const from = G.club;
  if (o.loan) G.loan = { parent: from };
  G.club = o.club;
  p.salary = o.salary;
  p.chem = 40; p.coach = 50; p.humor = clamp(p.humor + 8, 0, 100);
  G.path.push({ club: o.club, year: G.year + 1, kind: o.loan ? 'loan' : 'transfer' });
  news(`✍️ ${o.loan ? 'Emprestado ao' : 'Contratado pelo'} ${o.club}! Bem-vindo ao ${country(clubOf(o.club).c).name} ${country(clubOf(o.club).c).flag}.`);
  next();
}
function stayClub() {
  const p = P();
  if (p.ovr > clubOf(G.club).s + 8) p.humor = clamp(p.humor - 6, 0, 100);
  next();
}

function runNewSeason() {
  G.year++;
  G.seasonNo++;
  next(); // agenda vazia => startProSeason
}

function retire() {
  G.retired = true;
  G.agenda = [];
  save();
  showFinal();
}

// ------------------------------------------------------------
// Tela final: títulos da carreira
// ------------------------------------------------------------
function legacy() {
  const p = P();
  const big = G.titles.filter(t => t.kind !== 'youth').length;
  const score = big * 3 + G.awards.length * 4 + G.awards.filter(a => a.name.includes('Bola de Ouro')).length * 15
    + G.titles.filter(t => t.name === 'Copa do Mundo').length * 20 + (G.career.goals + G.nat.goals) / 15 + G.nat.caps / 10;
  if (score >= 120) return ['👑', 'Lenda eterna do futebol'];
  if (score >= 70) return ['🌟', 'Craque histórico'];
  if (score >= 35) return ['🏅', 'Ídolo de torcida'];
  if (score >= 15) return ['⚽', 'Carreira sólida'];
  return ['🙂', 'Jogador profissional'];
}

function groupTitles() {
  const map = new Map();
  for (const t of G.titles) {
    const k = t.name;
    if (!map.has(k)) map.set(k, { name: k, kind: t.kind, years: [] });
    map.get(k).years.push(`${t.year}${t.kind === 'club' ? ' · ' + t.club : ''}`);
  }
  const order = { nat: 0, club: 1, youth: 2 };
  return [...map.values()].sort((a, b) => order[a.kind] - order[b.kind] || b.years.length - a.years.length);
}

function showFinal() {
  M = null;
  const p = P();
  const car = G.career;
  const [icon, title] = legacy();
  const groups = groupTitles();
  const clubs = [];
  for (const x of G.path) if (!clubs.length || clubs[clubs.length - 1].club !== x.club) clubs.push(x);
  const avg = car.rN ? (car.rSum / car.rN).toFixed(2) : '-';
  const awardsMap = new Map();
  for (const a of G.awards) { if (!awardsMap.has(a.name)) awardsMap.set(a.name, []); awardsMap.get(a.name).push(a.year); }
  render(`
    <div class="card final">
      <div class="big-emoji">${icon}</div>
      <h1>${esc(p.name)} ${country(p.nat).flag}</h1>
      <p class="legacy">${title}</p>
      <p class="muted">${POSITIONS.find(x => x.id === p.pos).name} · Carreira de ${START_YEAR} a ${G.year} · Aposentou-se aos ${p.age} anos · Overall máximo ${Math.max(...G.history.map(h => h.ovr), Math.floor(p.ovr))}</p>

      <h2>🏆 Títulos (${G.titles.length})</h2>
      ${groups.length ? `<div class="titles">${groups.map(g => `
        <div class="title-card ${g.kind}">
          <div class="tc-head"><span>${g.kind === 'nat' ? country(p.nat).flag : g.kind === 'youth' ? '🌱' : '🏆'} ${g.name}</span><b>${g.years.length}x</b></div>
          <small>${g.years.join(' · ')}</small>
        </div>`).join('')}</div>` : '<p class="muted">Nenhum título conquistado... mas o futebol é feito de histórias.</p>'}

      ${awardsMap.size ? `<h2>🎖️ Prêmios individuais</h2><div class="titles">${[...awardsMap].map(([n, ys]) => `
        <div class="title-card award"><div class="tc-head"><span>${n}</span><b>${ys.length}x</b></div><small>${ys.join(' · ')}</small></div>`).join('')}</div>` : ''}

      <h2>📈 Números da carreira</h2>
      <div class="stats">
        <div><b>${car.games}</b><small>Jogos (clubes)</small></div>
        <div><b>${car.goals}</b><small>Gols</small></div>
        <div><b>${car.assists}</b><small>Assistências</small></div>
        <div><b>${avg}</b><small>Nota média</small></div>
        ${p.pos === 'GOL' ? `<div><b>${car.cleanSheets}</b><small>Jogos sem sofrer gol</small></div>` : ''}
        <div><b>${G.nat.caps}</b><small>Jogos pela seleção</small></div>
        <div><b>${G.nat.goals}</b><small>Gols pela seleção</small></div>
        <div><b>${fmtMoney(p.money)}</b><small>Patrimônio</small></div>
      </div>

      <h2>🧭 Trajetória</h2>
      <ol class="path">${clubs.map(x => `<li>${G.clubs[x.club] ? clubLabel(G.clubs[x.club]) : x.club} <small>(${x.year}${x.kind === 'base' ? ', base' : x.kind === 'loan' ? ', empréstimo' : ''})</small></li>`).join('')}</ol>

      <details><summary>Temporada a temporada</summary>
        <table class="tbl"><thead><tr><th>Ano</th><th>Clube</th><th>J</th><th>G</th><th>A</th><th>Nota</th><th>OVR</th></tr></thead><tbody>
        ${G.history.map(h => `<tr><td>${h.year}</td><td>${h.club}</td><td>${h.games}</td><td>${h.goals}</td><td>${h.assists}</td><td>${h.avg ? h.avg.toFixed(1) : '-'}</td><td>${h.ovr}</td></tr>`).join('')}
        </tbody></table>
      </details>

      <div class="row">
        <button class="btn" onclick="copySummary()">📋 Copiar resumo</button>
        <button class="btn big" onclick="clearSave(); startSetup()">🔄 Nova carreira</button>
      </div>
      <p id="copied" class="hint center"></p>
    </div>`, false);
}

function copySummary() {
  const p = P();
  const [, title] = legacy();
  const lines = [
    `⭐ ${p.name} ${country(p.nat).flag} — ${title}`,
    `${G.career.games} jogos · ${G.career.goals} gols · ${G.career.assists} assistências · ${G.nat.caps} jogos pela seleção`,
    `🏆 Títulos (${G.titles.length}):`,
    ...groupTitles().map(g => `• ${g.name} x${g.years.length}`),
    ...(G.awards.length ? ['🎖️ Prêmios:', ...G.awards.map(a => `• ${a.name} (${a.year})`)] : []),
    'Joguei Rumo ao Estrelato ⚽',
  ];
  const txt = lines.join('\n');
  const done = () => { const el = document.getElementById('copied'); if (el) el.textContent = 'Resumo copiado! ✅'; };
  if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, () => prompt('Copie o resumo:', txt));
  else prompt('Copie o resumo:', txt);
}

// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', showHome);
