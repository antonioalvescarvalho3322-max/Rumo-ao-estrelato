// ============================================================
// Rumo ao Estrelato — motor do jogo
// ============================================================
'use strict';

const SAVE_KEY = 'rumo-ao-estrelato-v2';
const START_YEAR = 2027;
const RETIRE_MIN = 33;
const RETIRE_MAX = 38;
const STAT_LABEL = {
  form: 'Fase', coach: 'Técnico', chem: 'Elenco', fans: 'Torcida', fame: 'Fama',
  ovr: 'Overall', pot: 'Potencial', money: 'Dinheiro', injury: 'Lesão', suspend: 'Suspensão',
};
const ICONS = {
  party: '🎉', train: '🏋️', fight: '😤', phone: '📱', home: '🏠', injury: '🩹', bench: '🪑', boot: '👟',
  news: '📰', money: '💰', coach: '📋', heart: '🤝', seed: '🌱', book: '📚', scout: '🔭', mic: '🎙️',
  star: '⭐', flag: '📞',
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
// Mundo
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
function levelBars(s) {
  const n = clamp(Math.round((s - 45) / 9), 1, 5);
  return `<span class="lvl">${'<i class="on"></i>'.repeat(n)}${'<i></i>'.repeat(5 - n)}</span>`;
}
function salaryFor(club, ovr) {
  return Math.max(30, Math.round(Math.pow(Math.max(club.s - 42, 4), 2) * 5 * (1 + (ovr - club.s) / 50)));
}
function marketValue() {
  const p = P();
  const ageF = p.age <= 21 ? 1.4 : p.age <= 25 ? 1.2 : p.age <= 28 ? 1 : p.age <= 31 ? 0.6 : 0.3;
  return 50 * Math.pow(1.21, p.ovr - 50) * ageF;
}
function shirtColor() { return SHIRT_COLORS.find(s => s.id === P().shirtColor) || SHIRT_COLORS[0]; }

function jerseySvg(color, number, cls = '') {
  return `<svg class="jersey ${cls}" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M32 8 L42 4 Q50 13 58 4 L68 8 L92 23 L83 42 L73 36 L73 95 L27 95 L27 36 L17 42 L8 23 Z" fill="${color.main}" stroke="${color.trim}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M42 4 Q50 13 58 4" fill="none" stroke="${color.trim}" stroke-width="4"/>
    <text x="50" y="74" text-anchor="middle" fill="${color.trim}" font-family="'Barlow Condensed', Impact, sans-serif" font-weight="800" font-size="38">${esc(number)}</text>
  </svg>`;
}

// Força do time em campo, considerando o jogador e o clima do elenco
function effStr(base, playing) {
  const p = P();
  let s = base + (p.chem - 50) * 0.03 + (p.form - 50) * 0.02;
  if (playing) s += (p.ovr - base) * 0.15 + 1;
  return s;
}
function lambda(a, b, home) {
  return 1.3 * Math.exp((a - b) / 16) * (home === true ? 1.1 : home === false ? 0.9 : 1);
}
function quickScore(a, b, home) {
  return [poisson(lambda(a, b, home)), poisson(lambda(b, a, home === null ? null : !home))];
}

// Titularidade: overall x nível do time + relação com técnico, fase e elenco
function titularChance(teamStr, kind) {
  const p = P();
  if (p.injury > 0 || p.suspended > 0) return 0;
  let v;
  if (kind === 'nat') v = 55 + (p.ovr - teamStr) * 5 + (p.form - 50) * 0.4 + (p.fans - 50) * 0.1;
  else if (kind === 'youth') v = 60 + (p.ovr - teamStr) * 4 + (p.coach - 50) * 0.5 + (p.form - 50) * 0.3;
  else v = 50 + (p.ovr - teamStr) * 4 + (p.coach - 50) * 0.55 + (p.form - 50) * 0.35 + (p.chem - 50) * 0.25;
  return clamp(v, 3, 97) / 100;
}
function titularLabel(c) {
  if (c >= 0.75) return 'Titular absoluto';
  if (c >= 0.45) return 'Brigando pela posição';
  if (c > 0) return 'Reserva';
  return 'Fora de combate';
}
function subChance() {
  const p = P();
  if (p.injury > 0 || p.suspended > 0) return 0;
  return clamp(0.55 + (p.form - 50) / 300 + (p.coach - 50) / 300, 0.2, 0.9);
}
// Fase, elenco e técnico influenciam as jogadas
function moodTotal() {
  const p = P();
  return clamp((p.form - 50) * 0.002 + (p.chem - 50) * 0.0012 + (p.coach - 50) * 0.0006, -0.15, 0.15);
}
function formLabel(f) {
  if (f >= 70) return 'Grande fase';
  if (f >= 50) return 'Boa fase';
  if (f >= 30) return 'Irregular';
  return 'Má fase';
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

function meter(label, v, cls) {
  return `<div class="meter ${cls}"><div class="m-top"><span>${label}</span><b>${Math.round(v)}</b></div><div class="track"><div class="fill" style="width:${clamp(v, 0, 100)}%"></div></div></div>`;
}

function hudHtml() {
  const p = P();
  const club = clubOf(G.club);
  const pos = POSITIONS.find(x => x.id === p.pos);
  const tags = [`<span class="tag ${p.form >= 70 ? 'hot' : ''}">${formLabel(p.form)}</span>`];
  if (p.injury > 0) tags.push(`<span class="tag bad">Lesionado · ${p.injury} j</span>`);
  if (p.suspended > 0) tags.push(`<span class="tag bad">Suspenso · ${p.suspended} j</span>`);
  if (G.nat.called) tags.push(`<span class="tag gold">${country(p.nat).flag} Seleção</span>`);
  if (G.loan) tags.push('<span class="tag">Emprestado</span>');
  return `
  <header class="hud">
    <div class="hud-id">
      ${jerseySvg(shirtColor(), p.shirt)}
      <div class="who">
        <div class="name">${esc(p.name)} <span class="flag">${country(p.nat).flag}</span></div>
        <div class="meta">${pos.name} · ${p.age} anos · ${club.n}${G.phase === 'base' ? ' (base)' : ''}</div>
        <div class="meta">${G.phase === 'base' ? 'Categorias de base' : leagueName(club)} · ${G.year} · ${G.titles.length} títulos</div>
        <div class="tags">${tags.join('')}</div>
      </div>
      <div class="ovr"><b>${Math.floor(p.ovr)}</b><small>OVR</small></div>
    </div>
    <div class="meters">
      ${meter('Fase', p.form, 'm-form')}
      ${meter('Técnico', p.coach, 'm-coach')}
      ${meter('Elenco', p.chem, 'm-chem')}
      ${meter('Torcida', p.fans, 'm-fans')}
    </div>
  </header>`;
}

function newsHtml() {
  if (!G.news || !G.news.length) return '';
  const h = `<section class="news"><h4>Resumo</h4>${G.news.map(n => `<p>${n}</p>`).join('')}</section>`;
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
    <section class="home">
      <div class="kicker">Simulador de carreira</div>
      <h1>Rumo ao<br><span>Estrelato</span></h1>
      <p class="sub">Da base à aposentadoria. Suas atitudes definem a relação com o técnico, o elenco e a torcida, e os grandes jogos são decididos nos seus pés.</p>
      <div class="home-actions">
        <button class="btn big" onclick="startSetup()">Iniciar jogo</button>
        ${canContinue ? `<button class="btn ghost" onclick="continueGame()">Continuar carreira de ${esc(saved.p.name)} · ${saved.year}</button>` : ''}
      </div>
      <ul class="howto">
        <li><b>Escolhas</b><span>Entrevistas e atitudes mudam sua relação com técnico, elenco e torcida.</span></li>
        <li><b>Desempenho</b><span>Arrogância só funciona se os gols aparecerem.</span></li>
        <li><b>Mata-mata</b><span>Nas finais e na Copa você escolhe o lance e o canto do pênalti.</span></li>
        <li><b>Seleção</b><span>Overall 85 em grande fase garante a convocação.</span></li>
      </ul>
    </section>`, false);
}

function continueGame() {
  G = loadSave();
  if (!G) return showHome();
  if (G.retired) return showFinal();
  if (G.cur) HANDLERS[G.cur.t](G.cur);
  else next();
}

function stepHead(n, title, hint) {
  return `<div class="step"><span>Passo ${n} de 4</span></div><h2>${title}</h2>${hint ? `<p class="hint">${hint}</p>` : ''}`;
}

function startSetup() {
  G = null; setup = {};
  const items = COUNTRIES.map(c => `
    <button class="pick" onclick="pickNation('${c.id}')">
      <span class="pflag">${c.flag}</span><span class="pname">${c.name}</span><small>${c.leagues[0]}</small>
    </button>`).join('');
  render(`${stepHead(1, 'Onde você nasceu?', 'Sua nacionalidade define a seleção que você pode defender e o país da sua base.')}<div class="grid">${items}</div>`, false);
}

function pickNation(id) {
  setup.nat = id;
  if (id === 'BR') return showStates();
  showBaseClubs();
}

function showStates() {
  const items = BR_STATES.map(s => `
    <button class="pick" onclick="pickState('${s.uf}')">
      <span class="pflag uf">${s.uf}</span><span class="pname">${s.name}</span><small>${s.clubs.slice(0, 3).map(c => c[0]).join(' · ')}</small>
    </button>`).join('');
  render(`${stepHead(2, 'Em qual estado?', 'Você começa na base de um clube tradicional da sua região.')}<div class="grid">${items}</div>
    <button class="btn ghost" onclick="startSetup()">Voltar</button>`, false);
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
    const play = c.s >= 78 ? 'Difícil' : c.s >= 68 ? 'Média' : c.s >= 58 ? 'Boa' : 'Alta';
    return `
    <button class="pick club" onclick="pickClub(${i})">
      <span class="pname">${c.n}</span>
      <small>${country(c.c).leagues[c.d - 1]}</small>
      <span class="kv"><small>Estrutura</small>${levelBars(c.s)}</span>
      <span class="kv"><small>Chance de jogar</small><b>${play}</b></span>
    </button>`;
  }).join('');
  render(`${stepHead(3, 'Escolha a sua base', 'Clube grande dá mais estrutura e potencial, mas é mais difícil virar titular.')}
  <div class="grid">${items}</div>
  <button class="btn ghost" onclick="${setup.nat === 'BR' ? 'showStates()' : 'startSetup()'}">Voltar</button>`, false);
}
function pickClub(i) { setup.club = setup.list[i].n; setup.shirt = setup.shirt || '10'; setup.color = setup.color || 'verde'; showPlayerForm(); }

function showPlayerForm() {
  const pos = POSITIONS.map((p, i) => `
    <label class="radio"><input type="radio" name="pos" value="${p.id}" ${i === 3 ? 'checked' : ''}><span>${p.name}</span></label>`).join('');
  const nums = ['1', '4', '5', '7', '8', '9', '10', '11'].map(n => `<button type="button" class="chipbtn" onclick="setShirt('${n}')">${n}</button>`).join('');
  const colors = SHIRT_COLORS.map(c => `<button type="button" class="swatch ${setup.color === c.id ? 'on' : ''}" data-color="${c.id}" title="${c.name}" aria-label="Camisa ${c.name}" style="--main:${c.main};--trim:${c.trim}" onclick="setColor('${c.id}')"></button>`).join('');
  render(`${stepHead(4, 'Monte o seu jogador')}
    <div class="panel form">
      <div class="form-grid">
        <div class="shirt-preview" id="shirtPreview">${jerseySvg(SHIRT_COLORS.find(c => c.id === setup.color), setup.shirt, 'big')}</div>
        <div class="form-fields">
          <label for="pname">Nome do jogador</label>
          <input id="pname" maxlength="24" placeholder="Ex.: Joãozinho" />
          <label for="pshirt">Número da camisa</label>
          <input id="pshirt" inputmode="numeric" maxlength="2" value="${esc(setup.shirt)}" oninput="setShirt(this.value, true)" />
          <div class="chiprow">${nums}</div>
          <div class="label">Cor da camisa</div>
          <div class="chiprow">${colors}</div>
        </div>
      </div>
      <div class="label">Posição</div>
      <div class="radios">${pos}</div>
      <p class="hint">Base: <b>${esc(setup.club)}</b> · ${country(setup.nat).flag} ${country(setup.nat).name}</p>
      <button class="btn big" onclick="createPlayer()">Começar carreira</button>
    </div>
    <button class="btn ghost" onclick="showBaseClubs()">Voltar</button>`, false);
}
function updateShirtPreview() {
  const el = document.getElementById('shirtPreview');
  if (el) el.innerHTML = jerseySvg(SHIRT_COLORS.find(c => c.id === setup.color), setup.shirt || '?', 'big');
}
function setShirt(v, fromInput) {
  v = String(v).replace(/\D/g, '').slice(0, 2);
  setup.shirt = v;
  if (!fromInput) { const i = document.getElementById('pshirt'); if (i) i.value = v; }
  updateShirtPreview();
}
function setColor(id) {
  setup.color = id;
  document.querySelectorAll('.swatch').forEach(b => b.classList.toggle('on', b.dataset.color === id));
  updateShirtPreview();
}

function createPlayer() {
  const nameInput = document.getElementById('pname');
  const name = (nameInput && nameInput.value.trim()) || 'Joãozinho';
  const pos = (document.querySelector('input[name=pos]:checked') || {}).value || 'ATA';
  const shirt = setup.shirt && +setup.shirt > 0 ? String(+setup.shirt) : '10';
  const clubs = buildClubs();
  const base = clubs[setup.club];
  const pot = clamp(Math.round(70 + rnd() * 16 + rnd() * 8 + (base.s - 60) / 6), 70, 96);
  G = {
    v: 2,
    p: {
      name, nat: setup.nat, uf: setup.uf || null, pos, shirt, shirtColor: setup.color || 'verde', age: 16,
      ovr: 48 + rnd() * 7, pot,
      form: 55, coach: 50, chem: 50, fans: 40, fame: 3,
      money: 0, salary: 5, injury: 0, suspended: 0,
    },
    clubs, club: setup.club, loan: null,
    year: START_YEAR, phase: 'base',
    nat: { called: false, caps: 0, goals: 0, assists: 0, declinedYear: null },
    career: { games: 0, goals: 0, assists: 0, rSum: 0, rN: 0, cleanSheets: 0 },
    titles: [], awards: [], history: [], path: [{ club: setup.club, year: START_YEAR, kind: 'base' }],
    idolMet: [], qual: {}, news: [], agenda: [], cur: null, retired: false,
  };
  startBaseSeason();
  next();
}

// ------------------------------------------------------------
// Agenda
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
    benchRate: 0, used: [], moreOffers: 0,
    stats: { games: 0, possible: 0, starts: 0, goals: 0, assists: 0, leagueGoals: 0, rSum: 0, rN: 0, cleanSheets: 0 },
    titles: [],
  };
}

function startBaseSeason() {
  G.S = newSeasonState();
  const c = clubOf(G.club);
  G.S.youthName = c.c === 'BR' ? 'Copa São Paulo de Futebol Jr.' : `Campeonato Sub-17 (${country(c.c).name})`;
  G.agenda = [
    { t: 'event', pool: 'youth' },
    { t: 'youthsim' },
    { t: 'event', pool: 'youth' },
    { t: 'youthfinal' },
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

function tournamentName() {
  const c = country(P().nat);
  if (G.year % 4 === 2) return 'Copa do Mundo';
  if (G.year % 4 === 0) return CONFEDS[c.confed].nationsCup;
  return null;
}

function startProSeason() {
  G.phase = 'pro';
  const S = G.S = newSeasonState();
  const club = clubOf(G.club);
  const c = country(club.c);

  for (const k in G.clubs) {
    const x = G.clubs[k];
    x.s = clamp(x.s + (x.b - x.s) * 0.3 + (rnd() * 3 - 1.5), 40, 95);
  }

  const teams = Object.values(G.clubs).filter(x => x.c === club.c && x.d === club.d);
  const rounds = Math.max(10, (teams.length - 1) * 2);
  S.league = {
    name: leagueName(club), rounds, played: 0,
    table: teams.map(x => ({ n: x.n, s: x.s, pts: 0, gp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 })),
  };
  S.cup = { name: c.cup, alive: true };
  const q = contQualFor(G.club);
  const conf = CONFEDS[c.confed];
  S.cont = q ? { type: q, name: q === 'main' ? conf.main : conf.second, alive: true } : null;
  G.qual = {};

  const A = [];
  if (club.c === 'BR') A.push({ t: 'estadual' });
  A.push({ t: 'block', n: 1 }, { t: 'event' }, { t: 'block', n: 2 }, { t: 'interview' });
  A.push({ t: 'cupfinal' });
  if (S.cont) A.push({ t: 'contfinal' });
  if (tournamentName()) A.push({ t: 'tourn' });
  A.push({ t: 'end' }, { t: 'offers' }, { t: 'newseason' });
  G.agenda = A;

  if (!G.p.salary || G.p.salary <= 5) G.p.salary = salaryFor(club, G.p.ovr);
}

// ------------------------------------------------------------
// Simulação dos jogos "fora de tela"
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
  let [a, b] = quickScore(eff, oppStr, rnd() < 0.5);
  let goals = 0, assists = 0;
  if (played) {
    const mult = Math.pow(p.ovr / 75, 3) * (1 + (p.form - 50) / 150) * (starter ? 1 : 0.35) * clamp(1 + (eff - oppStr) / 40, 0.4, 1.8);
    goals = Math.min(poisson(GOAL_RATE[p.pos] * mult), 4);
    assists = Math.min(poisson(ASSIST_RATE[p.pos] * mult), 3);
    if (goals + assists > a) a = goals + assists;
    let r = 6.45 + clamp((p.ovr - teamStr) / 40, -0.3, 0.5) + (p.form - 50) / 150 + (a > b ? 0.2 : a < b ? -0.25 : 0)
      + goals * 0.7 + assists * 0.35 + rnd() * 0.6 - 0.3;
    if (p.pos === 'GOL' || p.pos === 'ZAG') r += b === 0 ? 0.4 : -b * 0.12;
    if (!starter) r = 6 + (r - 6.4) * 0.5;
    r = clamp(r, 4.5, 9.8);
    if (kind === 'nat') {
      G.nat.caps++; G.nat.goals += goals; G.nat.assists += assists;
    } else {
      st.games++; if (starter) st.starts++;
      st.goals += goals; st.assists += assists; st.rSum += r; st.rN++;
      if (opts.league) st.leagueGoals += goals;
      if (p.pos === 'GOL' && starter && b === 0) st.cleanSheets++;
    }
    // o desempenho mexe na fase, no técnico e na torcida
    p.form = clamp(p.form + (r - 6.6) * 1.2 + (55 - p.form) * 0.03, 0, 100);
    p.coach = clamp(p.coach + (r - 6.6) * 0.35, 0, 100);
    p.fans = clamp(p.fans + (r - 6.7) * 0.45 + goals * 0.3, 0, 100);
    if (rnd() < 0.012) { p.injury = randInt(2, 6); news(`Você se lesionou e desfalca o time por ${p.injury} jogos.`); }
  } else if (kind === 'club' && p.injury === 0 && p.suspended === 0) {
    p.chem = clamp(p.chem - 0.15, 0, 100);
  }
  return { us: a, them: b, played, starter };
}

function simKO(teamStr, oppStr, kind) {
  const r = simOffscreen(teamStr, oppStr, { kind });
  return r.us > r.them || (r.us === r.them && rnd() < 0.5 + (teamStr - oppStr) / 60);
}

function simLeagueRound() {
  const L = G.S.league;
  for (const row of L.table) {
    let gf, ga;
    const opp = pick(L.table.filter(r => r.n !== row.n));
    if (row.n === G.club) {
      const r = simOffscreen(clubOf(G.club).s, opp.s, { league: true });
      gf = r.us; ga = r.them;
    } else {
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
function myLeaguePos() { return myPos(); }

function tableHtml(limit = 5) {
  const t = sortedTable();
  const me = t.findIndex(r => r.n === G.club);
  const rows = t.map((r, i) => ({ r, i })).filter(x => x.i < limit || x.i === me);
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Clube</th><th>J</th><th>V</th><th>SG</th><th>Pts</th></tr></thead><tbody>
    ${rows.map(({ r, i }) => `<tr class="${r.n === G.club ? 'me' : ''}"><td>${i + 1}</td><td>${r.n}</td><td>${r.gp}</td><td>${r.w}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}
  </tbody></table></div>`;
}

function addTitle(name, kind = 'club') {
  G.titles.push({ name, year: G.year, club: kind === 'nat' ? country(P().nat).name : G.club, kind });
  G.S.titles.push(name);
  const p = P();
  p.fame = clamp(p.fame + (kind === 'youth' ? 3 : 8), 0, 100);
  p.fans = clamp(p.fans + (kind === 'youth' ? 3 : 8), 0, 100);
}

// ------------------------------------------------------------
// Handlers da agenda
// ------------------------------------------------------------
const HANDLERS = {
  event: runEvent, interview: runInterview, callup: runCallup,
  youthsim: runYouthSim, youthfinal: runYouthFinal, baseEnd: runBaseEnd,
  estadual: runEstadual, block: runBlock, cupfinal: runCupFinal, contfinal: runContFinal, mundial: runMundial,
  tourn: runTourn, tmatch: runTournMatch,
  end: runSeasonEnd, offers: runOffers, newseason: runNewSeason,
};

function runYouthSim() {
  const club = clubOf(G.club);
  const others = Object.values(G.clubs).filter(x => x.c === club.c && x.n !== club.n);
  for (const st of ['Quartas de final', 'Semifinal']) {
    const opp = weighted(others, x => x.s - 40);
    const tc = titularChance(youthStr(club), 'youth');
    const pWin = clamp(0.5 + (youthStr(club) + (tc > 0.5 ? (P().ovr - youthStr(club)) * 0.15 : 0) - youthStr(opp)) / 25, 0.15, 0.85);
    if (rnd() > pWin) {
      G.S.youthOut = true;
      news(`${G.S.youthName}: eliminado na ${st.toLowerCase()} pelo ${opp.n} Sub-17.`);
      return next();
    }
  }
  news(`${G.S.youthName}: o ${club.n} Sub-17 está na final!`);
  next();
}

function runYouthFinal() {
  if (G.S.youthOut) return next();
  const club = clubOf(G.club);
  const others = Object.values(G.clubs).filter(x => x.c === club.c && x.n !== club.n);
  const opp = weighted(others, x => Math.pow(x.s - 40, 2));
  playMatch({
    kind: 'youth', comp: G.S.youthName, stage: 'Final',
    ourName: `${club.n} Sub-17`, ourStr: youthStr(club),
    opp: { n: `${opp.n} Sub-17`, s: youthStr(opp) }, home: rnd() < 0.5,
    onEnd: res => {
      if (res.win) { addTitle(G.S.youthName, 'youth'); return `Campeão da ${G.S.youthName}!`; }
      return `Vice-campeão da ${G.S.youthName}.`;
    },
  });
}

function runBaseEnd() {
  const p = P();
  const old = p.ovr;
  p.ovr = Math.min(p.pot, p.ovr + 3 + rnd() * 3 + (p.form - 55) / 20);
  p.age++;
  const club = clubOf(G.club);
  p.salary = salaryFor(club, p.ovr);
  render(`${newsHtml()}
    <section class="panel center">
      <div class="kicker">Fim da base</div>
      <h2>Primeiro contrato profissional</h2>
      <p>O <b>${club.n}</b> te promoveu ao time principal.</p>
      <div class="delta"><span>${Math.floor(old)}</span><i>→</i><b>${Math.floor(p.ovr)}</b><small>Overall</small></div>
      <p>Salário: <b>${fmtMoney(p.salary)}/ano</b></p>
      <p class="hint">Agora você disputa ${leagueName(club)}${club.c === 'BR' ? ', o estadual' : ''} e a ${country(club.c).cup}. Situação no elenco: <b>${titularLabel(titularChance(club.s))}</b>.</p>
      <button class="btn big" onclick="G.year++; next()">Subir para o profissional</button>
    </section>`);
}

function runEstadual() {
  const club = clubOf(G.club);
  const st = BR_STATES.find(s => s.uf === club.uf);
  const others = Object.values(G.clubs).filter(x => x.uf === club.uf && x.n !== club.n);
  if (!st || !others.length) return next();
  for (let i = 0; i < 5; i++) simOffscreen(club.s, pick(others).s);
  const second = Math.max(...others.map(x => x.s));
  if (rnd() > clamp(0.55 + (club.s - second) / 25, 0.1, 0.92)) {
    news(`${st.estadual}: o ${club.n} caiu antes da final.`);
    return next();
  }
  const opp = weighted(others, x => Math.pow(x.s - 40, 2));
  if (simKO(club.s, opp.s)) { addTitle(st.estadual); news(`<b>Campeão do ${st.estadual}</b> em cima do ${opp.n}!`); }
  else news(`${st.estadual}: vice-campeão, perdeu a final para o ${opp.n}.`);
  next();
}

function domesticOpp(topShare) {
  const club = clubOf(G.club);
  const pool = Object.values(G.clubs).filter(x => x.c === club.c && x.n !== club.n).sort((a, b) => b.s - a.s);
  return pick(pool.slice(0, Math.max(2, Math.ceil(pool.length * topShare))));
}

function contOpp(stage) {
  const club = clubOf(G.club);
  const conf = country(club.c).confed;
  const pool = Object.values(G.clubs)
    .filter(x => country(x.c).confed === conf && x.d === 1 && x.n !== club.n)
    .sort((a, b) => b.s - a.s);
  let slice;
  if (G.S.cont.type === 'second') {
    const start = Math.floor(pool.length * 0.2);
    slice = pool.slice(start, start + Math.max(6, Math.floor(pool.length * 0.4)));
  } else {
    slice = pool.slice(0, stage === 'Final' ? 6 : stage === 'Semifinal' ? 10 : 18);
  }
  return pick(slice.length ? slice : pool);
}

// Bloco de meia temporada: liga + fases iniciais das copas, tudo simulado
function runBlock(it) {
  const S = G.S, L = S.league;
  const club = clubOf(G.club);
  const target = it.n === 1 ? Math.floor(L.rounds / 2) : L.rounds;
  const startGames = S.stats.games, startPossible = S.stats.possible;
  while (L.played < target) simLeagueRound();
  news(`${L.name}: após ${L.played} rodadas, o ${club.n} está em <b>${myPos()}º</b> com ${sortedTable()[myPos() - 1].pts} pts.`);

  // Copa nacional
  const cupStages = it.n === 1 ? ['1ª fase', '2ª fase', 'Oitavas de final'] : ['Quartas de final', 'Semifinal'];
  if (S.cup.alive) {
    for (const st of cupStages) {
      const opp = domesticOpp(st === 'Semifinal' ? 0.5 : st === 'Quartas de final' ? 0.8 : 1);
      if (!simKO(club.s, opp.s)) { S.cup.alive = false; news(`${S.cup.name}: eliminado na ${st.toLowerCase()} pelo ${opp.n}.`); break; }
    }
    if (S.cup.alive && it.n === 2) news(`${S.cup.name}: <b>classificado para a FINAL!</b>`);
  }
  // Continental
  if (S.cont && S.cont.alive) {
    if (it.n === 1) {
      let pts = 0;
      for (let i = 0; i < 6; i++) {
        const r = simOffscreen(club.s, contOpp('groups').s);
        pts += r.us > r.them ? 3 : r.us === r.them ? 1 : 0;
      }
      if (pts < 9 && !(pts >= 7 && rnd() < 0.5)) { S.cont.alive = false; news(`${S.cont.name}: eliminado na fase de grupos (${pts} pts).`); }
      else if (!simKO(club.s, contOpp('Oitavas').s)) { S.cont.alive = false; news(`${S.cont.name}: passou dos grupos, mas caiu nas oitavas.`); }
      else news(`${S.cont.name}: classificado para as quartas de final.`);
    } else {
      for (const st of ['Quartas de final', 'Semifinal']) {
        const opp = contOpp(st);
        if (!simKO(club.s, opp.s)) { S.cont.alive = false; news(`${S.cont.name}: eliminado na ${st.toLowerCase()} pelo ${opp.n}.`); break; }
      }
      if (S.cont.alive) news(`${S.cont.name}: <b>classificado para a FINAL!</b>`);
    }
  }
  // Seleção: eliminatórias e amistosos
  if (G.nat.called && it.n === 2) {
    const c = country(P().nat);
    for (let i = 0; i < 4; i++) simOffscreen(c.nat, natRival(c.nat - 12, c.nat + 2).s, { kind: 'nat' });
  }

  const g = S.stats.games - startGames, poss = S.stats.possible - startPossible;
  S.benchRate = poss ? 1 - g / poss : 0;
  const st = S.stats;
  news(`Seus números até aqui: <b>${st.games} jogos, ${st.goals} gols, ${st.assists} assistências</b>${st.rN ? `, nota média ${(st.rSum / st.rN).toFixed(1)}` : ''}.`);
  checkCallup();
  next();
}

function runCupFinal() {
  const S = G.S;
  if (!S.cup.alive) return next();
  const club = clubOf(G.club);
  const opp = domesticOpp(0.35);
  playMatch({
    kind: 'club', comp: S.cup.name, stage: 'Final', big: true,
    ourName: club.n, ourStr: club.s, opp: { n: opp.n, s: opp.s }, home: null,
    onEnd: res => {
      if (!res.win) return `Vice-campeão da ${S.cup.name}.`;
      addTitle(S.cup.name);
      if (club.c === 'BR' && club.d === 1) G.qual[G.club] = 'main';
      return `Campeão da ${S.cup.name}!`;
    },
  });
}

function runContFinal() {
  const S = G.S;
  if (!S.cont || !S.cont.alive) return next();
  const club = clubOf(G.club);
  const opp = contOpp('Final');
  playMatch({
    kind: 'club', comp: S.cont.name, stage: 'Final', big: true,
    ourName: club.n, ourStr: club.s, opp: { n: opp.n, s: opp.s, flag: country(opp.c).flag }, home: null,
    onEnd: res => {
      if (!res.win) return `Vice-campeão da ${S.cont.name}.`;
      addTitle(S.cont.name);
      if (S.cont.type === 'main') G.agenda.unshift({ t: 'mundial' });
      return `Campeão da ${S.cont.name}!`;
    },
  });
}

function runMundial() {
  const club = clubOf(G.club);
  const conf = country(club.c).confed;
  const target = conf === 'UEFA' ? 'CONMEBOL' : 'UEFA';
  const pool = Object.values(G.clubs).filter(x => x.d === 1 && country(x.c).confed === target).sort((a, b) => b.s - a.s).slice(0, 5);
  const opp = pick(pool);
  playMatch({
    kind: 'club', comp: 'Mundial de Clubes', stage: 'Final', big: true,
    ourName: club.n, ourStr: club.s, opp: { n: opp.n, s: opp.s, flag: country(opp.c).flag }, home: null,
    onEnd: res => {
      if (res.win) { addTitle('Mundial de Clubes'); return 'Campeão do Mundial de Clubes!'; }
      return 'Vice-campeão mundial.';
    },
  });
}

function natRival(minS, maxS) {
  const myName = country(P().nat).name;
  let pool = NATION_RIVALS.filter(([n, s]) => n !== myName && s >= minS && s <= maxS);
  if (!pool.length) pool = NATION_RIVALS.filter(([n]) => n !== myName);
  const [n, s] = pick(pool);
  return { n, s };
}

// Torneio de seleções: fases iniciais simuladas, decisões jogadas
function runTourn() {
  const name = tournamentName();
  if (!G.nat.called || !name) return next();
  const c = country(P().nat);
  let pts = 0;
  for (let i = 0; i < 3; i++) {
    const r = simOffscreen(c.nat, natRival(c.nat - 14, c.nat + 2).s, { kind: 'nat' });
    pts += r.us > r.them ? 3 : r.us === r.them ? 1 : 0;
  }
  if (pts < 4 || (pts === 4 && rnd() < 0.4)) {
    news(`${name} ${G.year}: ${c.name} eliminada na fase de grupos (${pts} pts).`);
    return next();
  }
  const isWC = name === 'Copa do Mundo';
  const simStages = isWC ? [['Oitavas de final', 72, 84], ['Quartas de final', 78, 87]] : [['Quartas de final', 72, 85], ['Semifinal', 76, 88]];
  for (const [st, lo, hi] of simStages) {
    if (!simKO(c.nat, natRival(lo, hi).s, 'nat')) {
      news(`${name} ${G.year}: ${c.name} eliminada nas ${st.toLowerCase()}.`);
      return next();
    }
  }
  news(`${name} ${G.year}: ${c.name} avançou até ${isWC ? 'a semifinal' : 'a final'}!`);
  const items = isWC ? [{ t: 'tmatch', stage: 'Semifinal', name }, { t: 'tmatch', stage: 'Final', name }] : [{ t: 'tmatch', stage: 'Final', name }];
  G.agenda.unshift(...items);
  next();
}

function runTournMatch(it) {
  const c = country(P().nat);
  const opp = it.stage === 'Final' ? natRival(83, 89) : natRival(80, 89);
  playMatch({
    kind: 'nat', comp: `${it.name} ${G.year}`, stage: it.stage, big: true,
    ourName: `${c.flag} ${c.name}`, ourStr: c.nat, opp, home: null,
    onEnd: res => {
      if (!res.win) { G.agenda = G.agenda.filter(a => a.t !== 'tmatch'); return `${c.name} eliminada da ${it.name}.`; }
      if (it.stage === 'Final') { addTitle(it.name, 'nat'); return `Campeão da ${it.name}!`; }
      return `${c.name} está na final da ${it.name}!`;
    },
  });
}

// Convocação: OVR 85 + grande fase
function checkCallup() {
  const p = P();
  if (G.phase !== 'pro' || G.nat.called || G.nat.declinedYear === G.year) return;
  if (p.ovr >= 85 && p.form >= 70 && !G.agenda.some(a => a.t === 'callup')) G.agenda.unshift({ t: 'callup' });
}

// ------------------------------------------------------------
// Escolhas (sem porcentagem)
// ------------------------------------------------------------
function eventDef(id) {
  if (id === 'interview') return interviewEvent(G);
  if (id === 'callup') return callupEvent(G);
  if (id === 'idol') return idolEvent(G);
  return EVENTS.find(e => e.id === id);
}

function runEvent(it) {
  if (it.id) return showEvent(eventDef(it.id));
  const pool = it.pool || 'pro';
  // Conselho do ídolo: só em clubes com ídolo histórico, uma vez por clube
  if (pool === 'pro' && IDOLS[G.club] && !G.idolMet.includes(G.club) && rnd() < 0.6) {
    G.idolMet.push(G.club);
    it.id = 'idol';
    save();
    return showEvent(eventDef('idol'));
  }
  if (pool === 'pro' && rnd() > 0.65) return next(); // nem toda temporada tem evento extra
  const cands = EVENTS.filter(e => e.pool === pool && !G.S.used.includes(e.id) && (!e.cond || e.cond(G)));
  if (!cands.length) return next();
  const e = weighted(cands, x => x.w || 1);
  it.id = e.id;
  G.S.used.push(e.id);
  save();
  showEvent(e);
}
function runInterview(it) { it.id = 'interview'; showEvent(eventDef('interview')); }
function runCallup(it) { it.id = 'callup'; showEvent(eventDef('callup')); }

function showEvent(e) {
  const text = typeof e.text === 'function' ? e.text(G) : e.text;
  const opts = e.opts.map((o, i) => `<button class="opt" onclick="chooseEvent(${i})"><span>${o.label}</span><i class="arrow">→</i></button>`).join('');
  render(`${newsHtml()}
    <section class="panel event">
      <div class="ev-icon">${ICONS[e.icon] || '•'}</div>
      <h2>${e.title}</h2>
      <p class="lead">${text}</p>
      <div class="opts">${opts}</div>
    </section>`);
}

function chooseEvent(i) {
  const e = eventDef(G.cur.id);
  const o = e.opts[i];
  const res = o.res(G);
  const chips = applyFx(res.fx || {});
  save();
  render(`
    <section class="panel event">
      <div class="ev-icon">${ICONS[e.icon] || '•'}</div>
      <p class="muted">Você escolheu</p>
      <h2 class="choice">${o.label}</h2>
      <p class="lead">${res.txt}</p>
      <div class="chips">${chips}</div>
      <button class="btn big" onclick="next()">Continuar</button>
    </section>`);
}

function applyFx(fx) {
  const p = P();
  const out = [];
  const chip = (v, txt) => out.push(`<span class="chip ${v >= 0 ? 'up' : 'down'}">${txt}</span>`);
  for (const [k, v] of Object.entries(fx)) {
    switch (k) {
      case 'form': case 'chem': case 'coach': case 'fans': case 'fame':
        p[k] = clamp(p[k] + v, 0, 100); chip(v, `${STAT_LABEL[k]} ${v > 0 ? '+' : ''}${v}`); break;
      case 'ovr': p.ovr = Math.min(p.ovr + v, p.pot + 2); chip(v, `Overall +${v}`); break;
      case 'pot': p.pot = Math.min(p.pot + v, 99); chip(v, 'Potencial ↑'); break;
      case 'money': p.money += v; chip(v, fmtMoney(v)); break;
      case 'moneyFame': { const m = Math.round((50 + p.fame * 15) * v); p.money += m; chip(m, `+${fmtMoney(m)}`); break; }
      case 'injury': p.injury += v; chip(-1, `Lesão: ${v} jogo(s)`); break;
      case 'suspend': p.suspended += v; chip(-1, `Suspenso: ${v} jogo(s)`); break;
      case 'coachSet': p.coach = v; chip(0, `Técnico: ${v}`); break;
      case 'salaryMul': p.salary = Math.round(p.salary * v); chip(1, `Salário: ${fmtMoney(p.salary)}/ano`); break;
      case 'moreOffers': if (G.S) G.S.moreOffers += v; chip(1, 'Mercado atento'); break;
      case 'callup': G.nat.called = true; chip(1, `${country(p.nat).flag} Convocado`); break;
      case 'declineCallup': G.nat.declinedYear = G.year; break;
      default: break;
    }
  }
  return out.join('') || '<span class="chip">Sem alterações</span>';
}

// ------------------------------------------------------------
// PARTIDA (só finais, Mundial e Copa: aqui você escolhe os lances)
// ------------------------------------------------------------
const MOMENTS = {
  ATA: ['one_on_one', 'header', 'edge', 'counter'],
  MEI: ['through', 'long_shot', 'dribble', 'counter'],
  ZAG: ['tackle', 'corner_header', 'cover', 'build'],
  GOL: ['save', 'cross', 'gk_one', 'distribution'],
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
        ['Driblar o atacante', 0.35, 0.35, 'flair', null, 'concede'],
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
  const tc = titularChance(cfg.ourStr, cfg.kind);
  const titular = rnd() < tc;
  const sub = !titular && rnd() < subChance();
  const unavailable = p.injury > 0 || p.suspended > 0;
  M = Object.assign({}, cfg, {
    ko: true, tc, titular, sub, unavailable,
    us: 0, them: 0, goals: 0, assists: 0, rDelta: 0, red: false,
    log: [], idx: 0, auto: false, flash: null, extraUs: [], extraThem: [],
  });
  M.playing = titular || sub;
  M.eff = effStr(cfg.ourStr, titular);
  const lu = lambda(M.eff, cfg.opp.s, cfg.home) * (M.playing ? 0.75 : 1);
  const lt = lambda(cfg.opp.s, M.eff, cfg.home === null ? null : !cfg.home) * (M.playing ? 0.82 : 1);
  M.baseUs = Array.from({ length: poisson(lu) }, () => randInt(1, 90)).sort((a, b) => a - b);
  M.baseThem = Array.from({ length: poisson(lt) }, () => randInt(1, 90)).sort((a, b) => a - b);

  const moments = [];
  if (M.playing) {
    const types = [...MOMENTS[p.pos]].sort(() => rnd() - 0.5);
    const n = titular ? 2 : 1;
    for (let i = 0; i < n; i++) moments.push({ type: types[i] });
    // lances de bola parada substituem um lance comum
    const special = p.pos === 'GOL' ? (rnd() < 0.3 ? 'pen_def' : null)
      : rnd() < { ATA: 0.3, MEI: 0.25, ZAG: 0.08 }[p.pos] ? 'penalty'
        : rnd() < { ATA: 0.15, MEI: 0.25, ZAG: 0.06 }[p.pos] ? 'freekick' : null;
    if (special) moments[moments.length - 1] = { type: special };
    const lo = titular ? 4 : 60;
    const mins = moments.map(() => randInt(lo, 89)).sort((a, b) => a - b);
    moments.forEach((m, i) => { m.min = mins[i]; });
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
    <div class="score"><b>${a}</b><span>:</span><b>${b}</b></div>
    <div class="team">${M.opp.flag ? M.opp.flag + ' ' : ''}${esc(M.opp.n)}</div>
    ${min !== null && min <= 120 ? `<div class="minute">${min}'</div>` : ''}
  </div>`;
}
function compHead() { return `<div class="comp"><span>${esc(M.comp)}</span><b>${esc(M.stage)}</b></div>`; }
function flashHtml() {
  if (!M.flash) return '';
  const f = M.flash; M.flash = null;
  return `<div class="flash ${f.ok ? 'ok' : 'bad'}"><b>${f.icon}</b><span>${f.txt}</span></div>`;
}
function riskTag(p) {
  if (p >= 0.6) return '<em class="risk safe">Seguro</em>';
  if (p >= 0.33) return '<em class="risk mid">Moderado</em>';
  return '<em class="risk hard">Arriscado</em>';
}

function renderMatchIntro() {
  const p = P();
  let lineup;
  if (M.unavailable) lineup = `<div class="lineup bad">Você está ${p.injury > 0 ? 'lesionado' : 'suspenso'} e vai assistir da tribuna.</div>`;
  else if (M.titular) lineup = '<div class="lineup good">O técnico anunciou: você é <b>titular</b>.</div>';
  else if (M.sub) lineup = '<div class="lineup mid">Você começa no <b>banco</b>, mas entra no segundo tempo.</div>';
  else lineup = '<div class="lineup bad">Você ficou no banco e <b>não entrou</b>.</div>';
  const diff = M.opp.s - M.ourStr;
  const fav = diff > 4 ? 'Adversário favorito' : diff < -4 ? 'Seu time é favorito' : 'Jogo equilibrado';
  render(`${newsHtml()}
    <section class="panel match">
      ${compHead()}
      ${scoreboard(null)}
      <p class="center muted">${M.home === true ? 'Em casa' : M.home === false ? 'Fora de casa' : 'Campo neutro'} · ${fav}</p>
      <div class="status-row"><span>Sua situação</span><b>${titularLabel(M.tc)}</b></div>
      ${lineup}
      ${M.playing
        ? '<div class="row"><button class="btn big" onclick="matchNext()">Jogar a decisão</button><button class="btn ghost" onclick="autoMatch()">Simular</button></div>'
        : '<button class="btn big" onclick="finishMatch()">Ver resultado</button>'}
    </section>`);
}

function matchNext() {
  if (M.red || M.idx >= M.moments.length) return finishMatch();
  const m = M.moments[M.idx];
  if (m.type === 'penalty' || m.type === 'freekick' || m.type === 'pen_def') return renderGoalMoment(m);
  const def = momentDef(m.type);
  m.opts = def.opts.map(o => ({ label: o[0], p: momentProb(o[1], o[2]), win: o[3], tag: o[4], lose: o[5] || 'miss' }));
  render(`
    <section class="panel match">
      ${compHead()}
      ${scoreboard(m.min)}
      ${flashHtml()}
      <p class="situation">${def.text}</p>
      <div class="opts">
        ${m.opts.map((o, i) => `<button class="opt" onclick="resolveMoment(${i})"><span>${o.label}</span>${riskTag(o.p)}</button>`).join('')}
      </div>
    </section>`);
}

const WIN_TXT = {
  goal: ['GOL! Você balançou a rede!', 'GOLAÇO! Que pintura!'],
  assist: 'Assistência perfeita! Seu companheiro empurrou para a rede.',
  block: 'Desarme perfeito! Você salvou o time.',
  save: 'Defesaça! Você fechou o gol.',
  safe: 'Jogada segura, o time mantém a posse.',
  flair: 'Que categoria! Você deixou o atacante no chão e saiu jogando.',
  freekick: 'Falta marcada em posição perigosa!',
};

function advance(icon, ok, txt) {
  M.idx++;
  M.flash = { icon, ok, txt };
  if (M.auto) return;
  matchNext();
}

function resolveMoment(i) {
  const m = M.moments[M.idx];
  const o = m.opts[i];
  const ok = rnd() < o.p;
  let txt, icon;
  if (ok) {
    icon = '✓';
    switch (o.win) {
      case 'goal': M.extraUs.push(m.min); M.goals++; M.rDelta += o.tag ? 1.4 : 1.1; txt = o.tag ? WIN_TXT.goal[1] : WIN_TXT.goal[0]; icon = '⚽'; break;
      case 'assist': M.extraUs.push(m.min); M.assists++; M.rDelta += 0.7; txt = WIN_TXT.assist; break;
      case 'block': M.rDelta += 0.5; txt = WIN_TXT.block; break;
      case 'save': M.rDelta += o.tag ? 0.7 : 0.55; txt = WIN_TXT.save; break;
      case 'flair': M.rDelta += 0.6; txt = WIN_TXT.flair; break;
      case 'freekick':
        M.rDelta += 0.2; txt = WIN_TXT.freekick;
        M.moments.splice(M.idx + 1, 0, { type: 'freekick', min: Math.min(90, m.min + 1) });
        break;
      default: M.rDelta += 0.15; txt = WIN_TXT.safe;
    }
  } else {
    icon = '✕';
    switch (o.lose) {
      case 'concede': M.extraThem.push(m.min); M.rDelta -= 0.6; txt = 'Você falhou e o adversário marcou.'; break;
      case 'chance':
        M.rDelta -= 0.35;
        if (rnd() < 0.5) { M.extraThem.push(m.min); txt = 'Você falhou e o adversário aproveitou: gol deles.'; }
        else txt = 'Você falhou, mas o adversário desperdiçou. Ufa!';
        break;
      case 'foul': {
        M.rDelta -= 0.5;
        const r = rnd();
        if (r < 0.18) { M.red = true; M.rDelta -= 1.2; txt = 'Chegou atrasado no carrinho: cartão vermelho! Você foi expulso.'; M.extraThem.push(Math.min(90, m.min + randInt(1, 8))); }
        else if (r < 0.5) { M.extraThem.push(m.min); txt = 'Chegou atrasado: pênalti para o adversário, e gol.'; }
        else txt = 'Chegou atrasado e levou amarelo, mas o perigo passou.';
        break;
      }
      default: M.rDelta -= 0.25; txt = 'Não deu, a chance foi desperdiçada.';
    }
  }
  M.log.push(`${m.min}' · ${o.label} · ${ok ? 'deu certo' : 'não deu'}`);
  advance(icon, ok, `${m.min}' · ${txt}`);
}

// ---------- Pênalti / falta: escolha do canto ----------
const ZONES = ['Alto esquerdo', 'Alto centro', 'Alto direito', 'Baixo esquerdo', 'Baixo centro', 'Baixo direito'];
const SIDE = ['esquerda', 'meio', 'direita'];

function gkTendency() {
  const side = rnd() < 0.5 ? 0 : 2;
  const t = [0.4, 0.2, 0.4];
  const skew = 0.15 + rnd() * 0.15;
  t[side] += skew; t[2 - side] -= skew;
  return t;
}
function saveProb(dive, zone) {
  const col = zone % 3, top = zone < 3;
  if (col === dive) return col === 1 ? (top ? 0.45 : 0.85) : (top ? 0.2 : 0.65);
  if (col === 1) return top ? 0.05 : 0.08;
  return 0.02;
}
function penAcc(zone, pressure = 0) {
  return clamp([0.80, 0.90, 0.80, 0.92, 0.97, 0.92][zone] + skill() * 0.07 + moodTotal() * 0.3 - pressure, 0.4, 0.995);
}
function penaltyProbs(tend, pressure = 0) {
  return [0, 1, 2, 3, 4, 5].map(z => penAcc(z, pressure) * (1 - tend.reduce((s, t, d) => s + t * saveProb(d, z), 0)));
}
function freekickProbs(far) {
  const sk = skill(), md = moodTotal();
  const base = [0.22, 0.06, 0.13, 0.03, 0.12, 0.07];
  return base.map(b => clamp((b + sk * 0.12 * (b > 0.05 ? 1 : 0.3) + md * 0.3) * (far ? 0.6 : 1) - (M.opp.s - M.eff) / 300, 0.01, 0.6));
}
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
function goalGrid(onclick, labels) {
  return `<div class="goal"><div class="net">
    ${labels.map((l, i) => `<button class="zone" onclick="${onclick}(${i})"><span>${l}</span></button>`).join('')}
  </div><div class="grass"></div></div>`;
}

function renderGoalMoment(m) {
  const head = `${compHead()}${m.shootout ? shootoutBoard() : scoreboard(m.min)}${flashHtml()}`;
  if (m.type === 'penalty') {
    m.tend = m.tend || gkTendency();
    const fav = m.tend[0] > m.tend[2] ? 0 : 2;
    render(`<section class="panel match">${head}
      <p class="situation">${m.shootout ? '<b>Disputa de pênaltis.</b> Você bate a cobrança decisiva.' : '<b>Pênalti!</b> Você pega a bola e coloca na marca.'} Escolha o canto.</p>
      <p class="tip">Analista: o goleiro pulou para a <b>${SIDE[fav]}</b> em ${Math.round(m.tend[fav] * 10)} dos últimos 10 pênaltis.</p>
      ${goalGrid('shootGoal', ZONES)}
    </section>`);
  } else if (m.type === 'freekick') {
    m.far = m.far !== undefined ? m.far : rnd() < 0.4;
    render(`<section class="panel match">${head}
      <p class="situation"><b>Falta ${m.far ? 'de longe, a 30 metros' : 'na entrada da área'}.</b> A barreira fecha o lado esquerdo e o goleiro cobre o direito.</p>
      ${goalGrid('shootGoal', ['Ângulo sobre a barreira', 'Por cima, no meio', 'Ângulo do goleiro', 'Na barreira', 'Por baixo da barreira', 'Rasteiro no canto do goleiro'])}
      <div class="opts"><button class="opt" onclick="shootGoal(-1)"><span>Cruzar na área para o cabeceio</span><i class="arrow">→</i></button></div>
    </section>`);
  } else {
    m.kw = m.kw || kickerTendency();
    const fav = m.kw[0] + m.kw[3] > m.kw[2] + m.kw[5] ? 0 : 2;
    render(`<section class="panel match">${head}
      <p class="situation"><b>Pênalti contra!</b> Para que lado você vai pular?</p>
      <p class="tip">Preparador de goleiros: esse batedor costuma bater na <b>${SIDE[fav]}</b>.</p>
      <div class="goal"><div class="net three">
        ${['Pular à esquerda', 'Ficar no meio', 'Pular à direita'].map((l, d) => `<button class="zone" onclick="diveGoal(${d})"><span>${l}</span></button>`).join('')}
      </div><div class="grass"></div></div>
    </section>`);
  }
}

function shootGoal(z) {
  const m = M.moments[M.idx];
  let ok, txt;
  if (m.type === 'penalty') {
    const dive = weighted([0, 1, 2], d => m.tend[d]);
    const onTarget = rnd() < penAcc(z, m.pressure || 0);
    const saved = onTarget && rnd() < saveProb(dive, z);
    ok = onTarget && !saved;
    const where = ZONES[z].toLowerCase();
    const diveTxt = dive === 1 ? 'ficou parado no meio' : `pulou para a ${SIDE[dive]}`;
    if (!onTarget) txt = `Você bateu no ${where} e a bola foi para fora!`;
    else if (saved) txt = `Você bateu no ${where}, o goleiro ${diveTxt} e defendeu.`;
    else txt = `Você bateu no ${where}, o goleiro ${diveTxt}. GOL!`;
    M.log.push(`${m.shootout ? 'Pênaltis' : m.min + "'"} · Pênalti no ${where} · ${ok ? 'gol' : 'perdeu'}`);
  } else if (z === -1) {
    ok = rnd() < clamp(0.16 + skill() * 0.12 + moodTotal(), 0.05, 0.5);
    txt = ok ? 'Cruzamento na medida e o zagueiro cabeceou para o gol. Assistência!' : 'O goleiro saiu e cortou o cruzamento.';
    M.log.push(`${m.min}' · Falta cruzada · ${ok ? 'assistência' : 'cortada'}`);
  } else {
    ok = rnd() < freekickProbs(m.far)[z];
    const where = ZONES[z].toLowerCase();
    txt = ok ? `Cobrança no ${where}: GOLAÇO DE FALTA!` : pick(['A bola explodiu na barreira.', 'O goleiro se esticou todo e espalmou.', 'Passou raspando a trave!']);
    M.log.push(`${m.min}' · Falta no ${where} · ${ok ? 'gol' : 'não entrou'}`);
  }
  if (m.shootout) return afterShootoutKick(ok, txt);
  if (ok) {
    M.extraUs.push(m.min);
    if (m.type === 'freekick' && z === -1) { M.assists++; M.rDelta += 0.7; }
    else { M.goals++; M.rDelta += m.type === 'freekick' ? 1.5 : 0.9; }
  } else M.rDelta -= m.type === 'penalty' ? 0.7 : 0.15;
  advance(ok ? '⚽' : '✕', ok, `${m.min}' · ${txt}`);
}

function diveGoal(d) {
  const m = M.moments[M.idx];
  const z = weighted([0, 1, 2, 3, 4, 5], i => m.kw[i]);
  const acc = [0.80, 0.90, 0.80, 0.92, 0.97, 0.92][z];
  const onTarget = rnd() < acc;
  const saved = onTarget && rnd() < clamp(saveProb(d, z) * (0.8 + skill() * 0.5 + moodTotal()), 0, 0.97);
  const ok = !onTarget || saved;
  const where = ZONES[z].toLowerCase();
  const txt = !onTarget ? `O batedor mandou no ${where}, para fora!`
    : saved ? `Você pulou para a ${SIDE[d]} e defendeu a cobrança no ${where}!`
      : `Você foi para a ${SIDE[d]}, mas ele bateu no ${where}. Gol deles.`;
  M.log.push(`${m.shootout ? 'Pênaltis' : m.min + "'"} · Pênalti contra · ${ok ? 'defendeu' : 'gol deles'}`);
  if (m.shootout) return afterShootoutKick(!ok, txt);
  if (ok) M.rDelta += saved ? 1.0 : 0.2; else { M.extraThem.push(m.min); M.rDelta -= 0.2; }
  advance(ok ? '🧤' : '✕', ok, `${m.min}' · ${txt}`);
}

// Simula a decisão escolhendo a melhor opção em cada lance
function autoMatch() {
  M.auto = true;
  while (!M.red && M.idx < M.moments.length) {
    const m = M.moments[M.idx];
    if (m.type === 'penalty') { m.tend = gkTendency(); const pr = penaltyProbs(m.tend); shootGoal(pr.indexOf(Math.max(...pr))); }
    else if (m.type === 'freekick') { m.far = rnd() < 0.4; const pr = freekickProbs(m.far); shootGoal(pr.indexOf(Math.max(...pr))); }
    else if (m.type === 'pen_def') { m.kw = kickerTendency(); const pr = penDefProbs(m.kw); diveGoal(pr.indexOf(Math.max(...pr))); }
    else {
      const def = momentDef(m.type);
      m.opts = def.opts.map(o => ({ label: o[0], p: momentProb(o[1], o[2]), win: o[3], tag: o[4], lose: o[5] || 'miss' }));
      const val = { goal: 1, assist: 0.85, block: 1, save: 1, flair: 0.5, freekick: 0.5, safe: 0.25 };
      let bi = 0, bv = -1;
      m.opts.forEach((o, i) => { const v = o.p * (val[o.win] || 0.3); if (v > bv) { bv = v; bi = i; } });
      resolveMoment(bi);
    }
  }
  M.flash = null;
  finishMatch(true);
}

// ---------- Disputa de pênaltis ----------
function shootoutBoard() {
  const sh = M.sh;
  const dots = arr => arr.map(x => `<i class="${x ? 'in' : 'out'}"></i>`).join('') || '<i></i>';
  return `<div class="scoreboard">
    <div class="team">${esc(M.ourName)}</div>
    <div class="score"><b>${M.us}</b><span>:</span><b>${M.them}</b></div>
    <div class="team">${M.opp.flag ? M.opp.flag + ' ' : ''}${esc(M.opp.n)}</div>
    <div class="minute">Pênaltis ${sh.us.filter(Boolean).length} : ${sh.them.filter(Boolean).length}</div>
  </div>
  <div class="pens"><div>${dots(sh.us)}</div><div>${dots(sh.them)}</div></div>`;
}
function shootoutDecided(sh) {
  const ug = sh.us.filter(Boolean).length, tg = sh.them.filter(Boolean).length;
  if (sh.us.length <= 5 && sh.them.length <= 5 && !(sh.us.length === 5 && sh.them.length === 5)) {
    return ug + (5 - sh.us.length) < tg || tg + (5 - sh.them.length) < ug;
  }
  return sh.us.length === sh.them.length && ug !== tg;
}
function startShootout() {
  const onField = M.playing && !M.red;
  M.sh = { us: [], them: [], hook: onField ? (P().pos === 'GOL' ? 'save' : 'kick') : null, done: false };
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
        if (usTurn) { m.tend = gkTendency(); const pr = penaltyProbs(m.tend, 0.03); shootGoal(pr.indexOf(Math.max(...pr))); }
        else { m.kw = kickerTendency(); const pr = penDefProbs(m.kw); diveGoal(pr.indexOf(Math.max(...pr))); }
        continue;
      }
      return renderGoalMoment(m);
    }
    if (usTurn) sh.us.push(rnd() < pUs); else sh.them.push(rnd() < pThem);
  }
  const ug = sh.us.filter(Boolean).length, tg = sh.them.filter(Boolean).length;
  M.penWin = ug > tg;
  M.penScore = `${ug} : ${tg}`;
  endMatch();
}
function afterShootoutKick(scored, txt) {
  const sh = M.sh;
  const m = M.moments[M.idx];
  if (m.type === 'penalty') { sh.us.push(scored); M.rDelta += scored ? 0.3 : -0.5; }
  else { sh.them.push(scored); M.rDelta += scored ? -0.1 : 0.6; }
  M.idx = M.moments.length;
  const good = m.type === 'penalty' ? scored : !scored;
  M.flash = { icon: good ? '✓' : '✕', ok: good, txt };
  if (M.auto) return;
  continueShootout();
}

function finishMatch(auto) {
  const [a, b] = scoreAt(999);
  M.us = a; M.them = b;
  if (M.ko && a === b) {
    if (auto || !M.playing || M.red) { M.auto = true; startShootout(); return; }
    render(`
      <section class="panel match">
        ${compHead()}
        ${scoreboard(90)}
        ${flashHtml()}
        <p class="situation">Empate no tempo normal e na prorrogação. A decisão vai para os <b>pênaltis</b>.</p>
        <button class="btn big" onclick="startShootout()">Ir para os pênaltis</button>
      </section>`);
    return;
  }
  endMatch();
}

function endMatch() {
  const p = P();
  const a = M.us, b = M.them;
  const win = a > b || (a === b && M.penWin === true);
  const kind = M.kind;
  let rating = null;
  const before = { form: p.form, coach: p.coach, chem: p.chem, fans: p.fans };

  if (M.playing) {
    let r = (M.titular ? 6.3 : 6.0) + M.rDelta + (win ? 0.3 : -0.3) + rnd() * 0.4 - 0.2;
    if (p.pos === 'GOL') r += b === 0 ? 0.6 : -b * 0.15;
    if (p.pos === 'ZAG') r += b === 0 ? 0.3 : -b * 0.1;
    rating = Math.round(clamp(r, 3, 10) * 10) / 10;
    p.form = clamp(p.form + (rating - 6.6) * 6, 0, 100);
    p.coach = clamp(p.coach + (rating - 6.6) * 3, 0, 100);
    p.chem = clamp(p.chem + 2, 0, 100);
    p.fans = clamp(p.fans + (rating - 6.6) * 4 + (win ? 4 : -2), 0, 100);
    p.fame = clamp(p.fame + M.goals * 0.5 + (rating >= 8 ? 1 : 0) + (win ? 2 : 0), 0, 100);
    if (M.red) p.suspended += 1;
  } else if (M.unavailable) {
    if (p.injury > 0) p.injury--; else if (p.suspended > 0) p.suspended--;
  } else {
    p.form = clamp(p.form - 3, 0, 100);
  }

  if (kind === 'nat') {
    if (M.playing) { G.nat.caps++; G.nat.goals += M.goals; G.nat.assists += M.assists; }
  } else if (kind === 'club') {
    const st = G.S.stats;
    st.possible++;
    if (M.playing) {
      st.games++; if (M.titular) st.starts++;
      st.goals += M.goals; st.assists += M.assists; st.rSum += rating; st.rN++;
      if (p.pos === 'GOL' && M.titular && b === 0) st.cleanSheets++;
    }
  }

  const msg = M.onEnd({ us: a, them: b, win }) || '';
  checkCallup();

  const d = k => { const v = Math.round(p[k] - before[k]); return v ? `<span class="chip ${v > 0 ? 'up' : 'down'}">${STAT_LABEL[k]} ${v > 0 ? '+' : ''}${v}</span>` : ''; };
  render(`
    <section class="panel match">
      ${compHead()}
      ${scoreboard(999)}
      ${M.penScore ? `<p class="center">Pênaltis <b>${M.penScore}</b></p>` : ''}
      ${flashHtml()}
      <h2 class="result ${win ? 'w' : 'l'}">${win ? 'Vitória' : 'Derrota'}</h2>
      ${msg ? `<p class="big-msg">${msg}</p>` : ''}
      ${rating !== null
        ? `<div class="rating"><div class="r ${rating >= 7.5 ? 'hi' : rating >= 6.5 ? 'mid' : 'lo'}">${rating.toFixed(1)}</div><div>Sua nota<br><small>${M.goals} gol(s) · ${M.assists} assist.${M.red ? ' · expulso' : ''}</small></div></div>`
        : '<p class="center muted">Você não entrou em campo.</p>'}
      ${M.log.length ? `<ul class="log">${M.log.map(l => `<li>${l}</li>`).join('')}</ul>` : ''}
      <div class="chips">${d('form')}${d('coach')}${d('chem')}${d('fans')}</div>
      <button class="btn big" onclick="next()">Continuar</button>
    </section>`);
  M = null;
  save();
}

// ------------------------------------------------------------
// Fim de temporada (classificação, prêmios e evolução numa só tela)
// ------------------------------------------------------------
function runSeasonEnd() {
  const S = G.S, L = S.league, p = P();
  while (L.played < L.rounds) simLeagueRound();
  const club = clubOf(G.club);
  const c = country(club.c);
  const pos = myPos();
  const n = L.table.length;
  const notes = [];

  if (pos === 1) { addTitle(L.name); notes.push(`<b>Campeão da ${L.name}!</b>`); }
  else notes.push(`${L.name}: <b>${pos}º lugar</b>.`);

  if (club.c === 'BR') {
    if (club.d > 1 && pos <= 4) {
      club.d--; notes.push(`Acesso! O ${club.n} vai disputar a ${leagueName(club)}.`);
      const down = Object.values(G.clubs).filter(x => x.c === 'BR' && x.d === club.d && x.n !== club.n).sort((a, b) => a.s - b.s)[0];
      if (down) down.d++;
    } else if (club.d < 4 && pos > n - 4) {
      club.d++; notes.push(`Rebaixado. O ${club.n} vai disputar a ${leagueName(club)}.`);
      const up = Object.values(G.clubs).filter(x => x.c === 'BR' && x.d === club.d && x.n !== club.n).sort((a, b) => b.s - a.s)[0];
      if (up) up.d--;
    }
  }
  if (club.d === 1 && G.qual[G.club] === undefined) {
    if (pos <= c.top) G.qual[G.club] = 'main';
    else if (CONFEDS[c.confed].second && pos <= c.top + (club.c === 'BR' ? 6 : 2)) G.qual[G.club] = 'second';
    else G.qual[G.club] = null;
  }
  if (G.qual[G.club]) notes.push(`Vaga na ${G.qual[G.club] === 'main' ? CONFEDS[c.confed].main : CONFEDS[c.confed].second} do ano que vem.`);
  if (G.nat.called && (p.ovr < 82 || p.form < 30) && rnd() < 0.6) {
    G.nat.called = false;
    notes.push('Você foi cortado da seleção por queda de rendimento.');
  }

  // prêmios
  const st = S.stats;
  const avg = st.rN ? st.rSum / st.rN : 6.0;
  const share = st.possible ? st.games / st.possible : 0;
  const awards = [];
  const bigTitles = S.titles.filter(t => /Champions|Libertadores|Mundial|Copa do Mundo|Eurocopa|Copa América|Liga|Premier|LaLiga|Serie A|Bundesliga|Ligue 1|Brasileirão Série A/.test(t)).length;
  if (p.ovr >= 84 && club.d === 1) {
    const lf = c.confed === 'UEFA' ? 1 : 0.75;
    const ga = p.pos === 'ATA' || p.pos === 'MEI' ? (st.goals + st.assists) * 0.35 : 8;
    const score = ((p.ovr - 82) * 4 + (avg - 7.0) * 15 + bigTitles * 6 + ga) * lf + rnd() * 10;
    if (score >= 62) awards.push('Bola de Ouro');
    else if (score >= 48) notes.push('Você ficou entre os 3 finalistas da Bola de Ouro.');
  }
  if ((p.pos === 'ATA' || p.pos === 'MEI') && st.leagueGoals >= Math.max(12, L.rounds * 0.55)) awards.push(`Artilheiro (${L.name})`);
  if (avg >= 7.45 && share >= 0.6) awards.push(`Craque do campeonato (${L.name})`);
  if (p.pos === 'GOL' && st.cleanSheets >= L.rounds * 0.5) awards.push(`Goleiro menos vazado (${L.name})`);
  if (p.age <= 21 && avg >= 7.1 && st.games >= 20) awards.push('Revelação da temporada');
  for (const a of awards) G.awards.push({ name: a, year: G.year });
  p.fame = clamp(p.fame + awards.length * 6, 0, 100);

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
  g += (club.s - 65) / 40;
  let nv = p.ovr + g;
  if (nv > p.pot) nv = Math.max(p.ovr, p.pot - rnd() * 0.5);
  p.ovr = clamp(nv, 35, 99);
  p.age++;
  checkCallup();

  const canRetire = p.age >= RETIRE_MIN;
  const forced = p.age >= RETIRE_MAX || (p.age >= 35 && p.ovr < 62);
  render(`${newsHtml()}
    <section class="panel">
      <div class="kicker">Temporada ${G.year}</div>
      <h2>Fim de temporada</h2>
      ${notes.map(x => `<p>${x}</p>`).join('')}
      ${tableHtml(5)}
      <div class="stats">
        <div><b>${st.games}</b><small>Jogos</small></div>
        <div><b>${st.goals}</b><small>Gols</small></div>
        <div><b>${st.assists}</b><small>Assist.</small></div>
        <div><b>${st.rN ? avg.toFixed(1) : '-'}</b><small>Nota média</small></div>
        ${p.pos === 'GOL' ? `<div><b>${st.cleanSheets}</b><small>Sem sofrer gol</small></div>` : ''}
      </div>
      ${S.titles.length ? `<div class="trophies">${S.titles.map(t => `<span>🏆 ${t}</span>`).join('')}</div>` : ''}
      ${awards.length ? `<div class="trophies award">${awards.map(t => `<span>★ ${t}</span>`).join('')}</div>` : ''}
      <div class="delta"><span>${Math.floor(old)}</span><i>→</i><b>${Math.floor(p.ovr)}</b><small>Overall · ${p.age} anos · valor ${fmtMoney(marketValue())}</small></div>
      ${!G.nat.called && p.ovr >= 80 ? '<p class="hint">Convocação: overall 85 e grande fase (Fase 70 ou mais).</p>' : ''}
      ${forced ? '<p class="big-msg">Seu corpo já não aguenta o ritmo. Hora de pendurar as chuteiras.</p><button class="btn big" onclick="retire()">Encerrar carreira</button>'
        : `<button class="btn big" onclick="next()">Continuar</button>${canRetire ? '<button class="btn ghost" onclick="retire()">Aposentar-se agora</button>' : ''}`}
    </section>`);
  save();
}

// ------------------------------------------------------------
// Mercado
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
  const perfScore = (avg - 6.6) * 2 + p.fame / 40 + S.moreOffers;
  const offers = [];
  const exclude = new Set([G.club]);
  if (G.loan) exclude.add(G.loan.parent);
  const maxS = p.ovr + 3 + perfScore * 1.5;
  const cands = Object.values(G.clubs).filter(c => !exclude.has(c.n) && c.s <= maxS && c.s >= p.ovr - 12 && c.s >= cur.s - 4);
  let n = (rnd() < 0.7 ? 1 : 0) + (perfScore > 1 ? 1 : 0) + (rnd() < 0.3 + S.moreOffers * 0.1 ? 1 : 0);
  if (p.age >= 33) n = Math.max(0, n - 1);
  for (let i = 0; i < n && cands.length; i++) {
    const c = weighted(cands, x => Math.pow(Math.max(1, x.s - (p.ovr - 13)), 1.6));
    cands.splice(cands.indexOf(c), 1);
    offers.push({ club: c.n, salary: Math.round(salaryFor(c, p.ovr) * (0.9 + rnd() * 0.4)), loan: false });
  }
  if (p.age <= 22 && share < 0.4) {
    const lc = Object.values(G.clubs).filter(c => !exclude.has(c.n) && c.s < cur.s - 3 && c.s <= p.ovr + 2 && c.s >= p.ovr - 10);
    if (lc.length) offers.push({ club: pick(lc).n, salary: p.salary, loan: true });
  }
  return offers;
}

function runOffers(it) {
  const p = P();
  if (!it.offers) {
    if (G.loan) {
      const back = G.loan.parent, loanClub = G.club;
      const st = G.S.stats;
      const avg = st.rN ? st.rSum / st.rN : 6;
      news(`Fim do empréstimo: você volta ao ${back}.`);
      G.club = back; G.loan = null;
      p.chem = 45; p.coach = 50;
      it.offers = genOffers();
      if (avg >= 6.8 && !it.offers.some(o => o.club === loanClub)) {
        it.offers.unshift({ club: loanClub, salary: salaryFor(clubOf(loanClub), p.ovr), loan: false, buy: true });
      }
      it.forced = true;
    } else it.offers = genOffers();
    save();
  }
  if (!it.offers.length && !it.forced) { news('Nenhum clube fez proposta nesta janela.'); return next(); }
  const cur = clubOf(G.club);
  const cards = it.offers.map((o, i) => {
    const c = clubOf(o.club);
    const q = contQualFor(o.club);
    const conf = CONFEDS[country(c.c).confed];
    return `<div class="offer">
      <div class="otitle">${clubLabel(c)} ${o.loan ? '<span class="tag">Empréstimo</span>' : ''}${o.buy ? '<span class="tag">Compra definitiva</span>' : ''}</div>
      <div class="ometa">${leagueName(c)} · Nível ${levelBars(c.s)}${q ? ` · ${q === 'main' ? conf.main : conf.second}` : ''}</div>
      <div class="ometa">Salário <b>${fmtMoney(o.salary)}/ano</b> · <b>${titularLabel(estTitular(c))}</b></div>
      <div class="row">
        <button class="btn" onclick="acceptOffer(${i})">Aceitar</button>
        ${!o.negotiated && !o.loan ? `<button class="btn ghost" onclick="negotiate(${i})">Pedir salário maior</button>` : ''}
      </div>
    </div>`;
  }).join('');
  const unhappy = p.ovr > cur.s + 8;
  render(`${newsHtml()}
    <section class="panel">
      <div class="kicker">Janela de transferências</div>
      <h2>Propostas</h2>
      ${it.offers.length ? cards : '<p>Nenhum clube fez proposta nesta janela.</p>'}
      <div class="offer stay">
        <div class="otitle">Permanecer no ${clubLabel(cur)}</div>
        <div class="ometa">${leagueName(cur)} · <b>${titularLabel(estTitular(cur))}</b></div>
        ${unhappy ? '<div class="ometa warn">Você já é bom demais para este clube. Ficar vai abalar sua fase.</div>' : ''}
        <button class="btn ghost" onclick="stayClub()">Ficar</button>
      </div>
    </section>`);
}

// Negociação sem sorte: só aceita quem é peça valiosa para o clube
function negotiate(i) {
  const it = G.cur;
  const o = it.offers[i];
  const c = clubOf(o.club);
  const p = P();
  o.negotiated = true;
  if (p.ovr >= c.s + 2 || p.fame >= 70) { o.salary = Math.round(o.salary * 1.35); news(`O ${c.n} aceitou pagar ${fmtMoney(o.salary)}/ano.`); }
  else { it.offers.splice(i, 1); news(`O ${c.n} achou a exigência alta demais para o seu nível e retirou a proposta.`); }
  save();
  runOffers(it);
}

function acceptOffer(i) {
  const o = G.cur.offers[i];
  const p = P();
  if (o.loan) G.loan = { parent: G.club };
  const leaving = G.club;
  G.club = o.club;
  p.salary = o.salary;
  p.chem = 40; p.coach = 50; p.fans = clamp(35 + p.fame / 4, 0, 100);
  G.path.push({ club: o.club, year: G.year + 1, kind: o.loan ? 'loan' : 'transfer' });
  news(`${o.loan ? 'Emprestado ao' : 'Contratado pelo'} ${o.club}. A torcida do ${leaving} vai sentir sua falta.`);
  next();
}
function stayClub() {
  const p = P();
  if (p.ovr > clubOf(G.club).s + 8) p.form = clamp(p.form - 6, 0, 100);
  next();
}

function runNewSeason() {
  G.year++;
  next();
}

function retire() {
  G.retired = true;
  G.agenda = [];
  save();
  showFinal();
}

// ------------------------------------------------------------
// Tela final: títulos, recordes e honrarias
// ------------------------------------------------------------
function countTitle(re) { return G.titles.filter(t => re.test(t.name)).length; }

function gamesByClub() {
  const map = {};
  for (const h of G.history) map[h.club] = (map[h.club] || 0) + h.games;
  return map;
}

// Recordes relevantes do futebol viram títulos honorários
function honors() {
  const out = [];
  const balloons = G.awards.filter(a => a.name === 'Bola de Ouro').length;
  const goals = G.career.goals + G.nat.goals;
  const total = G.titles.filter(t => t.kind !== 'youth').length;
  if (balloons >= 9) out.push(['🐐 O GOAT', `${balloons} Bolas de Ouro. Superou as 8 de Messi e virou o maior da história.`]);
  else if (balloons >= 5) out.push(['Colecionador de Bolas de Ouro', `${balloons} Bolas de Ouro, ao lado dos maiores de todos os tempos.`]);
  const wc = countTitle(/^Copa do Mundo$/);
  if (wc >= 3) out.push(['O novo Rei do Futebol', `${wc} Copas do Mundo, ${wc > 3 ? 'superando' : 'igualando'} Pelé.`]);
  if (total >= 44) out.push(['Maior campeão da história', `${total} títulos. Passou os 43 de Daniel Alves.`]);
  if (goals >= 950) out.push(['Maior artilheiro da história', `${goals} gols oficiais. Passou Cristiano Ronaldo.`]);
  const ucl = countTitle(/Champions League$/);
  if (ucl >= 7) out.push(['Senhor da Champions', `${ucl} Champions League. Superou as 6 de Gento e Modrić.`]);
  const lib = countTitle(/^Copa Libertadores$/);
  if (lib >= 6) out.push(['Rei da América', `${lib} Libertadores, ${lib > 6 ? 'superando' : 'igualando'} Francisco Sá.`]);
  if (G.nat.caps >= 225) out.push(['Recordista pela seleção', `${G.nat.caps} jogos por seleções, mais do que qualquer um.`]);
  if (G.nat.goals >= 145) out.push(['Artilheiro máximo de seleções', `${G.nat.goals} gols pela seleção. Passou Cristiano Ronaldo.`]);
  for (const [club, games] of Object.entries(gamesByClub())) {
    if (games >= 500) {
      const idol = IDOLS[club];
      out.push(['O Totti de uma nova era', `${games} jogos pelo ${club}${idol ? `. Seu nome agora está ao lado de ${idol[0]} na história do clube` : ''}.`]);
    }
  }
  return out;
}

function legacy() {
  const big = G.titles.filter(t => t.kind !== 'youth').length;
  const score = big * 3 + G.awards.length * 4 + G.awards.filter(a => a.name === 'Bola de Ouro').length * 15
    + countTitle(/^Copa do Mundo$/) * 20 + (G.career.goals + G.nat.goals) / 15 + G.nat.caps / 10;
  if (score >= 120) return 'Lenda eterna do futebol';
  if (score >= 70) return 'Craque histórico';
  if (score >= 35) return 'Ídolo de torcida';
  if (score >= 15) return 'Carreira sólida';
  return 'Jogador profissional';
}

function groupTitles() {
  const map = new Map();
  for (const t of G.titles) {
    if (!map.has(t.name)) map.set(t.name, { name: t.name, kind: t.kind, years: [] });
    map.get(t.name).years.push(`${t.year}${t.kind === 'club' ? ' · ' + t.club : ''}`);
  }
  const order = { nat: 0, club: 1, youth: 2 };
  return [...map.values()].sort((a, b) => order[a.kind] - order[b.kind] || b.years.length - a.years.length);
}

function showFinal() {
  M = null;
  const p = P();
  const car = G.career;
  const groups = groupTitles();
  const hon = honors();
  const clubs = [];
  for (const x of G.path) if (!clubs.length || clubs[clubs.length - 1].club !== x.club) clubs.push(x);
  const byClub = gamesByClub();
  const avg = car.rN ? (car.rSum / car.rN).toFixed(2) : '-';
  const awardsMap = new Map();
  for (const a of G.awards) { if (!awardsMap.has(a.name)) awardsMap.set(a.name, []); awardsMap.get(a.name).push(a.year); }
  render(`
    <section class="final">
      <div class="final-hero">
        ${jerseySvg(shirtColor(), p.shirt, 'big')}
        <div>
          <div class="kicker">Fim de carreira · ${START_YEAR}–${G.year}</div>
          <h1>${esc(p.name)} <span class="flag">${country(p.nat).flag}</span></h1>
          <p class="legacy">${legacy()}</p>
          <p class="muted">${POSITIONS.find(x => x.id === p.pos).name} · aposentou-se aos ${p.age} anos · overall máximo ${Math.max(...G.history.map(h => h.ovr), Math.floor(p.ovr))}</p>
        </div>
      </div>

      ${hon.length ? `<h2>Recordes e honrarias</h2><div class="honors">${hon.map(([t, d]) => `<div class="honor"><b>${t}</b><span>${d}</span></div>`).join('')}</div>` : ''}

      <h2>Títulos <span class="count">${G.titles.length}</span></h2>
      ${groups.length ? `<div class="titles">${groups.map(g => `
        <div class="title-card ${g.kind}">
          <div class="tc-head"><span>${g.name}</span><b>${g.years.length}×</b></div>
          <small>${g.years.join(' · ')}</small>
        </div>`).join('')}</div>` : '<p class="muted">Nenhum título conquistado, mas o futebol também é feito dessas histórias.</p>'}

      ${awardsMap.size ? `<h2>Prêmios individuais</h2><div class="titles">${[...awardsMap].map(([n, ys]) => `
        <div class="title-card award"><div class="tc-head"><span>${n}</span><b>${ys.length}×</b></div><small>${ys.join(' · ')}</small></div>`).join('')}</div>` : ''}

      <h2>Números</h2>
      <div class="stats">
        <div><b>${car.games}</b><small>Jogos por clubes</small></div>
        <div><b>${car.goals}</b><small>Gols</small></div>
        <div><b>${car.assists}</b><small>Assistências</small></div>
        <div><b>${avg}</b><small>Nota média</small></div>
        ${p.pos === 'GOL' ? `<div><b>${car.cleanSheets}</b><small>Jogos sem sofrer gol</small></div>` : ''}
        <div><b>${G.nat.caps}</b><small>Jogos pela seleção</small></div>
        <div><b>${G.nat.goals}</b><small>Gols pela seleção</small></div>
        <div><b>${fmtMoney(p.money)}</b><small>Patrimônio</small></div>
      </div>

      <h2>Trajetória</h2>
      <ol class="path">${clubs.map(x => `<li><span>${G.clubs[x.club] ? clubLabel(G.clubs[x.club]) : x.club}</span><small>${x.year}${x.kind === 'base' ? ' · base' : x.kind === 'loan' ? ' · empréstimo' : ''}${byClub[x.club] ? ` · ${byClub[x.club]} jogos` : ''}</small></li>`).join('')}</ol>

      <details><summary>Temporada a temporada</summary>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ano</th><th>Clube</th><th>J</th><th>G</th><th>A</th><th>Nota</th><th>OVR</th></tr></thead><tbody>
        ${G.history.map(h => `<tr><td>${h.year}</td><td>${h.club}</td><td>${h.games}</td><td>${h.goals}</td><td>${h.assists}</td><td>${h.avg ? h.avg.toFixed(1) : '-'}</td><td>${h.ovr}</td></tr>`).join('')}
        </tbody></table></div>
      </details>

      <div class="row">
        <button class="btn ghost" onclick="copySummary()">Copiar resumo</button>
        <button class="btn big" onclick="clearSave(); startSetup()">Nova carreira</button>
      </div>
      <p id="copied" class="hint center"></p>
    </section>`, false);
}

function copySummary() {
  const p = P();
  const lines = [
    `${p.name} ${country(p.nat).flag} · camisa ${p.shirt} · ${legacy()}`,
    `${G.career.games} jogos · ${G.career.goals} gols · ${G.career.assists} assistências · ${G.nat.caps} jogos pela seleção`,
    ...honors().map(([t]) => `★ ${t}`),
    `Títulos (${G.titles.length}):`,
    ...groupTitles().map(g => `• ${g.name} ×${g.years.length}`),
    'Joguei Rumo ao Estrelato',
  ];
  const txt = lines.join('\n');
  const done = () => { const el = document.getElementById('copied'); if (el) el.textContent = 'Resumo copiado.'; };
  const fallback = () => { const el = document.getElementById('copied'); if (el) { el.style.whiteSpace = 'pre-wrap'; el.style.userSelect = 'all'; el.textContent = txt; } };
  try { if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, fallback); else fallback(); } catch (e) { fallback(); }
}

// ------------------------------------------------------------
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showHome);
else showHome();
