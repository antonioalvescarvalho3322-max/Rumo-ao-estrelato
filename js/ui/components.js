/**
 * @file Componentes visuais reutilizados pelas telas: renderização da página, cabeçalho do
 * jogador (HUD), camisa, escudo, medidores, chips de efeito, resumo e tabela da liga.
 * Os botões usam data-act/data-arg; os cliques são tratados em js/main.js.
 */
'use strict';

/** Namespace dos componentes de interface. */
const UI = (() => {
  const { esc, clamp } = Util;

  /** Ícones dos eventos. */
  const ICONS = {
    party: '🎉', train: '🏋️', fight: '😤', phone: '📱', home: '🏠', injury: '🩹', bench: '🪑', boot: '👟',
    money: '💰', coach: '📋', heart: '🤝', seed: '🌱', book: '📚', scout: '🔭', mic: '🎙️', star: '⭐', flag: '📞',
  };

  /**
   * Desenha uma tela dentro de #app.
   * @param {string} html Conteúdo da tela.
   * @param {{hud?: boolean, mood?: 'game'|'setup'|'final'}} [opts]
   *   hud: mostra o cabeçalho do jogador e o resumo pendente (padrão: true se houver carreira).
   *   mood: muda o fundo da página (a escolha de time usa um fundo mais escuro).
   */
  function render(html, opts = {}) {
    const withHud = opts.hud !== undefined ? opts.hud : Boolean(G);
    document.body.dataset.mood = opts.mood || (withHud ? 'game' : 'setup');
    const top = withHud && G ? hud() : '';
    const pending = withHud && G ? feed() : '';
    document.getElementById('app').innerHTML = `${top}<main class="screen">${pending}${html}</main>`;
    window.scrollTo(0, 0);
  }

  /**
   * Camisa do jogador em SVG.
   * @param {{main: string, accent: string, number: string}} kit Cores.
   * @param {string} number Número da camisa.
   * @param {string} [cls] Classe extra (ex.: 'big').
   * @returns {string} HTML.
   */
  function jersey(kit, number, cls = '') {
    return `<svg class="jersey ${cls}" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M32 8 L42 4 Q50 13 58 4 L68 8 L92 23 L83 42 L73 36 L73 95 L27 95 L27 36 L17 42 L8 23 Z" fill="${kit.main}" stroke="${kit.accent}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M17 42 L8 23 L14 19 L23 38 Z M83 42 L92 23 L86 19 L77 38 Z" fill="${kit.accent}"/>
      <path d="M42 4 Q50 13 58 4" fill="none" stroke="${kit.accent}" stroke-width="5"/>
      <text x="50" y="74" text-anchor="middle" fill="${kit.number}" stroke="${kit.accent}" stroke-width="1" font-family="'Barlow Condensed', Impact, sans-serif" font-weight="800" font-size="38">${esc(number)}</text>
    </svg>`;
  }

  /**
   * Escudo oficial do clube, se estiver cadastrado em js/data/crests.js.
   * Sem escudo cadastrado, não desenha nada (nenhum escudo inventado).
   * @param {string} clubName Nome do clube.
   * @param {string} [cls] Classe de tamanho (crest-xs, crest-sm, crest-md, crest-lg).
   * @returns {string} HTML.
   */
  function crest(clubName, cls = 'crest-sm') {
    const data = World.crest(clubName);
    if (!data) return '';
    // Se a imagem não carregar, main.js remove o elemento (tratador global de erro de imagem).
    return `<img class="crest ${cls}" src="${esc(data.src)}" alt="Escudo do ${esc(clubName)}" loading="lazy">`;
  }

  /**
   * Nome do clube com escudo (quando houver) e bandeira do país.
   * @param {string} clubName Nome do clube.
   * @param {string} [cls] Classe de tamanho do escudo.
   * @returns {string} HTML.
   */
  function clubTag(clubName, cls = 'crest-xs') {
    const c = World.club(clubName);
    const flag = c ? `${World.country(c.c).flag} ` : '';
    return `<span class="club-tag">${crest(clubName, cls)}<span>${flag}${esc(clubName)}</span></span>`;
  }

  /**
   * Barras de nível (1 a 5) a partir da força do clube.
   * @param {number} strength Força do clube.
   * @returns {string} HTML.
   */
  function levelBars(strength) {
    const n = clamp(Math.round((strength - 45) / 9), 1, 5);
    return `<span class="lvl" aria-label="Nível ${n} de 5">${'<i class="on"></i>'.repeat(n)}${'<i></i>'.repeat(5 - n)}</span>`;
  }

  /**
   * Medidor horizontal (Fase, Técnico, Elenco, Torcida).
   * @param {string} label Nome do medidor.
   * @param {number} value Valor de 0 a 100.
   * @param {string} cls Classe de cor.
   * @returns {string} HTML.
   */
  function meter(label, value, cls) {
    return `<div class="meter ${cls}"><div class="m-top"><span>${label}</span><b>${Math.round(value)}</b></div><div class="track"><div class="fill" style="width:${clamp(value, 0, 100)}%"></div></div></div>`;
  }

  /**
   * Lista de chips de efeito.
   * @param {Chip[]} list Chips.
   * @returns {string} HTML.
   */
  function chips(list) {
    if (!list || !list.length) return '<div class="chips"><span class="chip">Sem alterações</span></div>';
    return `<div class="chips">${list.map(c => `<span class="chip ${c.tone}">${esc(c.text)}</span>`).join('')}</div>`;
  }

  /**
   * Cabeçalho fixo com a camisa, os dados do jogador e os quatro medidores.
   * @returns {string} HTML.
   */
  function hud() {
    const p = G.p;
    const club = World.current();
    const pos = POSITIONS.find(x => x.id === p.pos);
    const tags = [`<span class="tag ${p.form >= 70 ? 'hot' : ''}">${Sim.formLabel(p.form)}</span>`];
    if (p.injury > 0) tags.push(`<span class="tag bad">Lesionado · ${p.injury} j</span>`);
    if (p.suspended > 0) tags.push(`<span class="tag bad">Suspenso · ${p.suspended} j</span>`);
    if (G.nat.called) tags.push(`<span class="tag gold">${World.country(p.nat).flag} Seleção</span>`);
    if (G.loan) tags.push('<span class="tag">Emprestado</span>');
    const where = G.phase === 'base' ? 'Categorias de base' : World.leagueName(club);
    return `
    <header class="hud">
      <div class="hud-id">
        ${jersey(World.kitColors(G.club), p.shirt)}
        <div class="who">
          <div class="name">${esc(p.name)} <span class="flag">${World.country(p.nat).flag}</span></div>
          <div class="meta">${pos.name} · ${p.age} anos · ${crest(G.club, 'crest-xs')}${esc(club.n)}${G.phase === 'base' ? ' (base)' : ''}</div>
          <div class="meta">${where} · ${G.year} · ${Util.plural(G.titles.length, 'título', 'títulos')}</div>
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

  /**
   * Resumo do que aconteceu desde a última tela (textos e jogos rápidos). Esvazia a fila.
   * @returns {string} HTML.
   */
  function feed() {
    if (!G.feed || !G.feed.length) return '';
    const items = G.feed.map(item => (item.kind === 'match' ? matchCard(item) : `<p>${item.html}</p>${item.chips ? chips(item.chips) : ''}`)).join('');
    G.feed = [];
    return `<section class="news"><h4>Resumo</h4>${items}</section>`;
  }

  /**
   * Cartão de um jogo rápido dentro do resumo.
   * @param {Object} c Cartão criado por MatchView.card.
   * @returns {string} HTML.
   */
  function matchCard(c) {
    const outcome = c.league ? (c.win ? 'Vitória' : c.draw ? 'Empate' : 'Derrota') : (c.win ? 'Classificado' : 'Eliminado');
    return `<div class="feed-match ${c.win ? 'w' : c.draw ? 'd' : 'l'}">
      <div class="fm-head"><span>${esc(c.comp)} · ${esc(c.stage)}</span><b>${outcome}</b></div>
      <div class="fm-score">
        <span class="fm-team">${c.ourClub ? crest(c.ourClub, 'crest-xs') : ''}${esc(c.ourName)}</span>
        <b>${c.us} : ${c.them}</b>
        <span class="fm-team">${esc(c.oppName)}${c.oppClub ? crest(c.oppClub, 'crest-xs') : ''}</span>
      </div>
      ${c.pens ? `<small>Pênaltis ${c.pens}</small>` : ''}
      ${c.narrative ? `<p>${c.narrative}</p>` : ''}
      ${c.message ? `<p class="fm-msg">${c.message}</p>` : ''}
      ${c.rating !== null ? `<small>Sua nota: ${c.rating.toFixed(1)}</small>` : ''}
      ${c.chips && c.chips.length ? chips(c.chips) : ''}
    </div>`;
  }

  /**
   * Tabela da liga com os primeiros colocados e a linha do clube do jogador.
   * @param {number} [limit] Quantos primeiros mostrar.
   * @returns {string} HTML.
   */
  function leagueTable(limit = 5) {
    const t = Sim.sortedTable();
    const me = t.findIndex(r => r.n === G.club);
    const rows = t.map((r, i) => ({ r, i })).filter(x => x.i < limit || x.i === me);
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Clube</th><th>J</th><th>V</th><th>SG</th><th>Pts</th></tr></thead><tbody>
      ${rows.map(({ r, i }) => `<tr class="${r.n === G.club ? 'me' : ''}"><td>${i + 1}</td><td>${crest(r.n, 'crest-xs')}${esc(r.n)}</td><td>${r.gp}</td><td>${r.w}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}
    </tbody></table></div>`;
  }

  return { ICONS, render, jersey, crest, clubTag, levelBars, meter, chips, hud, feed, leagueTable };
})();
