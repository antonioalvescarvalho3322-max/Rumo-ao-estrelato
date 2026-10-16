/**
 * @file Simulação dos jogos que não são jogados lance a lance (liga, fases iniciais das copas,
 * fase de grupos e jogos da seleção), além da titularidade e da tabela da liga.
 */
'use strict';

/** Namespace da simulação de partidas e da liga. */
const Sim = (() => {
  const { clamp, rnd, pick, poisson, randInt, randRange } = Util;

  /** Média de gols por jogo de um titular de overall 75, por posição. */
  const GOAL_RATE = { ATA: 0.33, MEI: 0.13, ZAG: 0.05, GOL: 0 };
  /** Média de assistências por jogo de um titular de overall 75, por posição. */
  const ASSIST_RATE = { ATA: 0.15, MEI: 0.25, ZAG: 0.04, GOL: 0.01 };

  /**
   * Força efetiva do time em campo: o clima do elenco e a fase pesam, e o jogador
   * puxa o time para cima (ou para baixo) quando joga.
   * @param {number} base Força do time.
   * @param {boolean} playing Se o jogador está em campo.
   * @returns {number}
   */
  function effStr(base, playing) {
    const p = G.p;
    let s = base + (p.chem - 50) * 0.03 + (p.form - 50) * 0.02;
    if (playing) s += (p.ovr - base) * 0.15 + 1;
    return s;
  }

  /**
   * Média de gols esperada de um time contra outro.
   * @param {number} a Força do time que ataca.
   * @param {number} b Força do adversário.
   * @param {boolean|null} home true em casa, false fora, null em campo neutro.
   * @returns {number}
   */
  function lambda(a, b, home) {
    return 1.3 * Math.exp((a - b) / 16) * (home === true ? 1.1 : home === false ? 0.9 : 1);
  }

  /**
   * Sorteia um placar.
   * @param {number} a Força do time A.
   * @param {number} b Força do time B.
   * @param {boolean|null} home Mando do time A.
   * @returns {[number, number]} Gols de A e de B.
   */
  function quickScore(a, b, home) {
    return [poisson(lambda(a, b, home)), poisson(lambda(b, a, home === null ? null : !home))];
  }

  /**
   * Chance (0-1) de o jogador começar jogando. Depende do overall em relação ao time
   * e da relação com técnico, elenco e da fase.
   * @param {number} teamStr Força do time.
   * @param {'club'|'nat'|'youth'} [kind] Tipo de partida.
   * @returns {number}
   */
  function titularChance(teamStr, kind = 'club') {
    const p = G.p;
    if (p.injury > 0 || p.suspended > 0) return 0;
    let v;
    if (kind === 'nat') v = 55 + (p.ovr - teamStr) * 5 + (p.form - 50) * 0.4 + (p.fans - 50) * 0.1;
    else if (kind === 'youth') v = 60 + (p.ovr - teamStr) * 4 + (p.coach - 50) * 0.5 + (p.form - 50) * 0.3;
    else v = 50 + (p.ovr - teamStr) * 4 + (p.coach - 50) * 0.55 + (p.form - 50) * 0.35 + (p.chem - 50) * 0.25;
    return clamp(v, 3, 97) / 100;
  }

  /**
   * Descrição da situação no elenco a partir da chance de titularidade.
   * @param {number} chance Valor entre 0 e 1.
   * @returns {string}
   */
  function titularLabel(chance) {
    if (chance >= 0.75) return 'Titular absoluto';
    if (chance >= 0.45) return 'Brigando pela posição';
    if (chance > 0) return 'Reserva';
    return 'Fora de combate';
  }

  /**
   * Chance de entrar no segundo tempo quando começa no banco.
   * @returns {number}
   */
  function subChance() {
    const p = G.p;
    if (p.injury > 0 || p.suspended > 0) return 0;
    return clamp(0.55 + (p.form - 50) / 300 + (p.coach - 50) / 300, 0.2, 0.9);
  }

  /**
   * Bônus (ou ônus) que fase, elenco e técnico dão às jogadas, entre -0,15 e +0,15.
   * @returns {number}
   */
  function moodTotal() {
    const p = G.p;
    return clamp((p.form - 50) * 0.002 + (p.chem - 50) * 0.0012 + (p.coach - 50) * 0.0006, -0.15, 0.15);
  }

  /**
   * Nome da fase pelo valor do medidor.
   * @param {number} form Fase (0-100).
   * @returns {string}
   */
  function formLabel(form) {
    if (form >= 70) return 'Grande fase';
    if (form >= 50) return 'Boa fase';
    if (form >= 30) return 'Irregular';
    return 'Má fase';
  }

  /**
   * Simula um jogo sem interação e soma os números do jogador.
   * Também ajusta fase, técnico e torcida conforme a nota.
   * @param {number} teamStr Força do time do jogador.
   * @param {number} oppStr Força do adversário.
   * @param {{kind?: 'club'|'nat', league?: boolean}} [opts] Tipo de jogo e se vale pela liga.
   * @returns {{us: number, them: number, played: boolean, starter: boolean}}
   */
  function playOffscreen(teamStr, oppStr, opts = {}) {
    const p = G.p;
    const kind = opts.kind || 'club';
    const st = kind === 'nat' ? null : G.S.stats;
    if (st) st.possible++;

    let played = false;
    let starter = false;
    if (p.injury > 0) p.injury--;
    else if (p.suspended > 0) p.suspended--;
    else if (rnd() < titularChance(teamStr, kind)) { played = true; starter = true; } else if (rnd() < subChance() * 0.6) played = true;

    const eff = effStr(teamStr, starter);
    let [us, them] = quickScore(eff, oppStr, rnd() < 0.5);
    if (!played) {
      if (kind === 'club' && p.injury === 0 && p.suspended === 0) p.chem = clamp(p.chem - 0.15, 0, 100);
      return { us, them, played, starter };
    }

    const mult = Math.pow(p.ovr / 75, 3) * (1 + (p.form - 50) / 150) * (starter ? 1 : 0.35) * clamp(1 + (eff - oppStr) / 40, 0.4, 1.8);
    const goals = Math.min(poisson(GOAL_RATE[p.pos] * mult), 4);
    const assists = Math.min(poisson(ASSIST_RATE[p.pos] * mult), 3);
    if (goals + assists > us) us = goals + assists;

    let rating = 6.45 + clamp((p.ovr - teamStr) / 40, -0.3, 0.5) + (p.form - 50) / 150
      + (us > them ? 0.2 : us < them ? -0.25 : 0) + goals * 0.7 + assists * 0.35 + rnd() * 0.6 - 0.3;
    if (p.pos === 'GOL' || p.pos === 'ZAG') rating += them === 0 ? 0.4 : -them * 0.12;
    if (!starter) rating = 6 + (rating - 6.4) * 0.5;
    rating = clamp(rating, 4.5, 9.8);

    if (kind === 'nat') {
      G.nat.caps++;
      G.nat.goals += goals;
      G.nat.assists += assists;
    } else {
      st.games++;
      if (starter) st.starts++;
      st.goals += goals;
      st.assists += assists;
      st.rSum += rating;
      st.rN++;
      if (opts.league) {
        st.leagueGoals += goals;
        st.leagueAssists += assists;
      }
      if (p.pos === 'GOL' && starter && them === 0) st.cleanSheets++;
    }

    p.form = clamp(p.form + (rating - 6.6) * 1.2 + (55 - p.form) * 0.03, 0, 100);
    p.coach = clamp(p.coach + (rating - 6.6) * 0.35, 0, 100);
    p.fans = clamp(p.fans + (rating - 6.7) * 0.45 + goals * 0.3, 0, 100);
    if (rnd() < 0.012) {
      p.injury = randInt(2, 6);
      Season.feedText(`Você se lesionou e desfalca o time por ${p.injury} jogos.`);
    }
    return { us, them, played, starter };
  }

  /**
   * Simula um mata-mata sem interação.
   * @param {number} teamStr Força do time do jogador.
   * @param {number} oppStr Força do adversário.
   * @param {'club'|'nat'} [kind] Tipo de jogo.
   * @returns {boolean} true se o time do jogador avançou.
   */
  function simKO(teamStr, oppStr, kind) {
    const r = playOffscreen(teamStr, oppStr, { kind });
    return r.us > r.them || (r.us === r.them && rnd() < 0.5 + (teamStr - oppStr) / 60);
  }

  /**
   * Cria a tabela da liga do clube e sorteia as marcas a superar para ser
   * artilheiro/líder de assistências da liga e do time.
   * @param {Club} club Clube do jogador.
   * @returns {{league: Object, marks: Object}}
   */
  function setupLeague(club) {
    const teams = Object.values(G.clubs).filter(x => x.c === club.c && x.d === club.d);
    const rounds = Math.max(10, (teams.length - 1) * 2);
    const league = {
      name: World.leagueName(club),
      rounds,
      played: 0,
      table: teams.map(x => ({ n: x.n, s: x.s, pts: 0, gp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 })),
    };
    const marks = {
      goals: Math.round(rounds * randRange(0.65, 0.9)),
      assists: Math.round(rounds * randRange(0.38, 0.52)),
      teamGoals: Math.round(rounds * randRange(0.3, 0.45)),
      teamAssists: Math.round(rounds * randRange(0.2, 0.3)),
    };
    return { league, marks };
  }

  /**
   * Simula uma rodada da liga inteira (inclusive o jogo do clube do jogador).
   */
  function leagueRound() {
    const L = G.S.league;
    for (const row of L.table) {
      const opp = pick(L.table.filter(r => r.n !== row.n));
      let gf;
      let ga;
      if (row.n === G.club) {
        const r = playOffscreen(World.current().s, opp.s, { league: true });
        gf = r.us;
        ga = r.them;
      } else {
        [gf, ga] = quickScore(row.s, opp.s, rnd() < 0.5);
      }
      row.gp++;
      row.gf += gf;
      row.ga += ga;
      if (gf > ga) { row.w++; row.pts += 3; } else if (gf === ga) { row.d++; row.pts += 1; } else row.l++;
    }
    L.played++;
  }

  /**
   * Tabela ordenada por pontos, saldo e gols marcados.
   * @returns {Array<Object>}
   */
  function sortedTable() {
    return [...G.S.league.table].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  }

  /**
   * Posição atual do clube do jogador na liga.
   * @returns {number}
   */
  const myPos = () => sortedTable().findIndex(r => r.n === G.club) + 1;

  return {
    effStr, lambda, quickScore, titularChance, titularLabel, subChance, moodTotal, formLabel,
    playOffscreen, simKO, setupLeague, leagueRound, sortedTable, myPos,
  };
})();
