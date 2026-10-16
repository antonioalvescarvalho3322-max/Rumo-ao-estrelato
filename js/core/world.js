/**
 * @file Consultas sobre o mundo do jogo: clubes, ligas, cores, escudos, adversários,
 * salários e torneios. Lê os dados de js/data/ e o estado atual em G.
 */
'use strict';

/** Namespace de consultas sobre clubes, países e competições. */
const World = (() => {
  const { clamp, pick } = Util;

  /**
   * Monta o mapa de todos os clubes do jogo a partir dos dados fixos.
   * @returns {Object<string, Club>}
   */
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

  /**
   * País pelo código.
   * @param {string} id Código (ex.: 'BR').
   * @returns {Country}
   */
  const country = id => COUNTRY_BY_ID[id];

  /** Índice dos clubes a partir dos dados fixos (usado antes de existir uma carreira). */
  let staticIndex = null;

  /**
   * Clube pelo nome. Durante a criação do jogador (sem carreira), usa os dados fixos.
   * @param {string} name Nome do clube.
   * @returns {Club|undefined}
   */
  function club(name) {
    if (G) return G.clubs[name];
    staticIndex = staticIndex || buildClubs();
    return staticIndex[name];
  }

  /**
   * Clube atual do jogador.
   * @returns {Club}
   */
  const current = () => G.clubs[G.club];

  /**
   * Confederação do clube.
   * @param {Club} c Clube.
   * @returns {string} Chave em CONFEDS.
   */
  const confedOf = c => country(c.c).confed;

  /**
   * Nome da liga em que o clube joga (respeitando a divisão no Brasil).
   * @param {Club} c Clube.
   * @returns {string}
   */
  function leagueName(c) {
    const leagues = country(c.c).leagues;
    return leagues[Math.min(c.d, leagues.length) - 1];
  }

  /**
   * Nome da competição com o artigo certo: "do Brasileirão", "da Copa do Brasil".
   * @param {string} name Nome da competição.
   * @returns {string}
   */
  const ofComp = name => `${/^(Brasileirão|Campeonato|Mundial|DFB-Pokal)/.test(name) ? 'do' : 'da'} ${name}`;

  /**
   * Escudo oficial cadastrado do clube, se houver.
   * @param {string} name Nome do clube.
   * @returns {{src: string, colors?: [string, string]}|null}
   */
  const crest = name => CRESTS[name] || null;

  /**
   * Cores da camisa do jogador no clube: cores do escudo, depois a tabela de cores, depois o padrão.
   * @param {string} name Nome do clube.
   * @returns {{main: string, accent: string, number: string}}
   */
  function kitColors(name) {
    const fromCrest = crest(name) && crest(name).colors;
    const [main, accent] = fromCrest || CLUB_COLORS[name] || DEFAULT_KIT;
    return { main, accent, number: Util.contrastText(main) };
  }

  /**
   * Salário anual oferecido por um clube (mil euros).
   * @param {Club} c Clube.
   * @param {number} ovr Overall do jogador.
   * @returns {number}
   */
  function salaryFor(c, ovr) {
    return Math.max(30, Math.round(Math.pow(Math.max(c.s - 42, 4), 2) * 5 * (1 + (ovr - c.s) / 50)));
  }

  /**
   * Valor de mercado do jogador (mil euros), pela idade e overall.
   * @param {Player} p Jogador.
   * @returns {number}
   */
  function marketValue(p) {
    const ageFactor = p.age <= 21 ? 1.4 : p.age <= 25 ? 1.2 : p.age <= 28 ? 1 : p.age <= 31 ? 0.6 : 0.3;
    return 50 * Math.pow(1.21, p.ovr - 50) * ageFactor;
  }

  /**
   * Força do time sub-17 de um clube.
   * @param {Club} c Clube.
   * @returns {number}
   */
  const youthStr = c => 45 + (c.s - 50) * 0.3;

  /**
   * Vaga continental do clube na temporada: 'main', 'second' ou null.
   * Usa o resultado da temporada anterior; sem ele, usa a força do clube no país.
   * @param {string} name Nome do clube.
   * @returns {'main'|'second'|null}
   */
  function contQualFor(name) {
    const c = club(name);
    if (c.d !== 1) return null;
    if (G.qual[name] !== undefined) return G.qual[name];
    const info = country(c.c);
    const ranked = Object.values(G.clubs).filter(x => x.c === c.c && x.d === 1).sort((a, b) => b.s - a.s);
    const rank = ranked.findIndex(x => x.n === name) + 1;
    if (rank <= info.top) return 'main';
    if (CONFEDS[info.confed].second && rank <= info.top + (c.c === 'BR' ? 6 : 2)) return 'second';
    return null;
  }

  /**
   * Torneio de seleções no fim da temporada atual, ou null.
   * Copa do Mundo a cada 4 anos (2030, 2034...); o torneio continental segue o calendário
   * da confederação do jogador (CONFEDS.nationsCupYears; ex.: Copa América e Eurocopa em 2028, 2032...).
   * @returns {string|null}
   */
  function tournamentName() {
    if (G.year % 4 === 2) return 'Copa do Mundo';
    const conf = CONFEDS[country(G.p.nat).confed];
    const { every, offset } = conf.nationsCupYears;
    return G.year % every === offset ? conf.nationsCup : null;
  }

  /**
   * Sorteia uma seleção adversária dentro de uma faixa de força.
   * @param {number} minS Força mínima.
   * @param {number} maxS Força máxima.
   * @param {string} [confed] Se informado, só seleções dessa confederação (eliminatórias e torneio continental).
   * @returns {{n: string, s: number}}
   */
  function natRival(minS, maxS, confed) {
    const own = country(G.p.nat).name;
    const candidates = NATION_RIVALS.filter(([n, , c]) => n !== own && (!confed || c === confed));
    let pool = candidates.filter(([, s]) => s >= minS && s <= maxS);
    if (!pool.length) {
      // Ninguém na faixa: usa as duas seleções de força mais próxima.
      const distance = s => (s < minS ? minS - s : s > maxS ? s - maxS : 0);
      pool = [...candidates].sort((a, b) => distance(a[1]) - distance(b[1])).slice(0, 2);
    }
    const [n, s] = pick(pool);
    return { n, s };
  }

  /**
   * Adversário na copa nacional, entre os clubes mais fortes do país.
   * @param {number} topShare Fração dos melhores clubes considerada (1 = todos).
   * @returns {Club}
   */
  function domesticOpp(topShare) {
    const me = current();
    const pool = Object.values(G.clubs).filter(x => x.c === me.c && x.n !== me.n).sort((a, b) => b.s - a.s);
    return pick(pool.slice(0, Math.max(2, Math.ceil(pool.length * topShare))));
  }

  /**
   * Adversário no torneio continental, mais forte nas fases finais.
   * @param {string} stage Fase ('groups', 'Oitavas de final', ..., 'Final').
   * @returns {Club}
   */
  function contOpp(stage) {
    const me = current();
    const conf = confedOf(me);
    const pool = Object.values(G.clubs)
      .filter(x => confedOf(x) === conf && x.d === 1 && x.n !== me.n)
      .sort((a, b) => b.s - a.s);
    let slice;
    if (G.S.cont && G.S.cont.type === 'second') {
      const start = Math.floor(pool.length * 0.2);
      slice = pool.slice(start, start + Math.max(6, Math.floor(pool.length * 0.4)));
    } else {
      const size = { Final: 6, Semifinal: 10, 'Quartas de final': 14 }[stage] || 18;
      slice = pool.slice(0, size);
    }
    return pick(slice.length ? slice : pool);
  }

  /**
   * Adversário na final do Mundial de Clubes: um dos 5 melhores do outro continente forte.
   * @returns {Club}
   */
  function mundialOpp() {
    const target = confedOf(current()) === 'UEFA' ? 'CONMEBOL' : 'UEFA';
    const pool = Object.values(G.clubs).filter(x => x.d === 1 && confedOf(x) === target).sort((a, b) => b.s - a.s);
    return pick(pool.slice(0, 5));
  }

  /**
   * Faz a força de todos os clubes oscilar um pouco entre as temporadas.
   */
  function driftStrengths() {
    for (const c of Object.values(G.clubs)) {
      c.s = clamp(c.s + (c.b - c.s) * 0.3 + (Math.random() * 3 - 1.5), 40, 95);
    }
  }

  return {
    buildClubs, country, club, current, confedOf, leagueName, ofComp, crest, kitColors, salaryFor, marketValue,
    youthStr, contQualFor, tournamentName, natRival, domesticOpp, contOpp, mundialOpp, driftStrengths,
  };
})();
