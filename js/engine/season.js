/**
 * @file Fluxo da carreira: a agenda de cada temporada e o que acontece em cada passo
 * (blocos simulados da liga, mata-matas, eventos, entrevistas, torneios de seleções,
 * fim de temporada, janela de transferências e aposentadoria).
 *
 * Cada temporada é uma lista de passos (G.agenda). next() tira o próximo passo e chama o
 * handler correspondente. Passos sem interação chamam next() de novo; passos com tela
 * esperam um clique do jogador (tratado em js/main.js).
 */
'use strict';

/** Namespace do fluxo da temporada. */
const Season = (() => {
  const { rnd, pick, weighted, clamp } = Util;

  /** Fases de mata-mata jogadas lance a lance (a final no formato completo). */
  const KO_STAGES = ['Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];
  /** Títulos que pesam para a Bola de Ouro. */
  const BIG_TITLES = /Champions|Libertadores|Mundial|Copa do Mundo|Eurocopa|Copa América|Liga|Premier|LaLiga|Serie A|Bundesliga|Ligue 1|Brasileirão Série A/;

  // ---------------------------------------------------------------------------
  // Resumo (feed) e títulos
  // ---------------------------------------------------------------------------

  /**
   * Adiciona uma linha ao resumo exibido no topo da próxima tela.
   * @param {string} html Texto (pode ter <b>).
   * @param {Chip[]} [chips] Efeitos relacionados.
   */
  function feedText(html, chips) {
    G.feed.push({ kind: 'text', html, chips: chips || null });
  }

  /**
   * Registra um título: entra na lista da carreira, aumenta fama e torcida e vale +1 de overall
   * (uma vez por temporada; ver Progression.titleBonus).
   * @param {string} name Nome do título.
   * @param {'club'|'nat'|'youth'} [kind] Clube, seleção ou base.
   * @returns {number} Pontos de overall ganhos (0 se já estiver no máximo).
   */
  function addTitle(name, kind = 'club') {
    const p = G.p;
    G.titles.push({ name, year: G.year, club: kind === 'nat' ? World.country(p.nat).name : G.club, kind });
    G.S.titles.push(name);
    p.fame = clamp(p.fame + (kind === 'youth' ? 3 : 8), 0, 100);
    p.fans = clamp(p.fans + (kind === 'youth' ? 3 : 8), 0, 100);
    return Progression.titleBonus();
  }

  /**
   * Texto da próxima fase do mata-mata.
   * @param {string} stage Fase atual.
   * @returns {string}
   */
  function nextStageLabel(stage) {
    return { 'Oitavas de final': 'as quartas de final', 'Quartas de final': 'a semifinal', Semifinal: 'a final' }[stage] || 'a próxima fase';
  }

  // ---------------------------------------------------------------------------
  // Agenda
  // ---------------------------------------------------------------------------

  /**
   * Executa o próximo passo da agenda. Quando a agenda acaba, começa uma nova temporada.
   */
  function next() {
    if (!G) return Screens.home();
    if (G.retired) return Screens.final();
    const item = G.agenda.shift();
    G.cur = item || null;
    Store.save();
    if (!item) {
      startPro();
      return next();
    }
    HANDLERS[item.t](item);
  }

  /**
   * Retoma uma carreira salva no ponto em que parou.
   */
  function resume() {
    G = Store.load();
    if (!G) return Screens.home();
    if (G.retired) return Screens.final();
    if (G.cur) return HANDLERS[G.cur.t](G.cur);
    next();
  }

  /**
   * Monta a temporada de base (16 anos): dois eventos, a campanha na copa sub-17 e a promoção.
   */
  function startBase() {
    G.S = newSeasonState();
    const c = World.current();
    G.S.youthName = c.c === 'BR' ? 'Copa São Paulo de Futebol Jr.' : `Campeonato Sub-17 (${World.country(c.c).name})`;
    G.agenda = [
      { t: 'event', pool: 'youth' },
      { t: 'youthsim' },
      { t: 'event', pool: 'youth' },
      { t: 'youthfinal' },
      { t: 'baseEnd' },
    ];
  }

  /**
   * Monta uma temporada profissional: aplica o treino de pré-temporada, cria a liga,
   * define as copas disputadas e a ordem dos passos.
   */
  function startPro() {
    G.phase = 'pro';
    World.driftStrengths();
    G.S = newSeasonState();
    const club = World.current();
    const c = World.country(club.c);
    const { league, marks } = Sim.setupLeague(club);
    G.S.league = league;
    G.S.marks = marks;
    G.S.cup = { name: c.cup, alive: true };
    const q = World.contQualFor(G.club);
    const conf = CONFEDS[c.confed];
    G.S.cont = q ? { type: q, name: q === 'main' ? conf.main : conf.second, alive: true } : null;
    G.qual = {};
    if (!G.p.salary || G.p.salary <= 5) G.p.salary = World.salaryFor(club, G.p.ovr);

    if (G.pendingTraining) {
      const r = Progression.applyTraining(G.pendingTraining);
      G.pendingTraining = null;
      if (r) feedText(`<b>Pré-temporada · ${r.name}:</b> ${r.text}`, r.chips);
    }

    const hasCont = Boolean(G.S.cont);
    const A = [];
    if (club.c === 'BR') A.push({ t: 'estadual' });
    A.push({ t: 'block', n: 1 }, { t: 'event' });
    A.push({ t: 'cup', stage: KO_STAGES[0] });
    if (hasCont) A.push({ t: 'cont', stage: KO_STAGES[0] });
    A.push({ t: 'interview' });
    A.push({ t: 'cup', stage: KO_STAGES[1] });
    if (hasCont) A.push({ t: 'cont', stage: KO_STAGES[1] });
    A.push({ t: 'block', n: 2 });
    A.push({ t: 'cup', stage: KO_STAGES[2] });
    if (hasCont) A.push({ t: 'cont', stage: KO_STAGES[2] });
    A.push({ t: 'cup', stage: KO_STAGES[3] });
    if (hasCont) A.push({ t: 'cont', stage: KO_STAGES[3] });
    if (World.tournamentName()) A.push({ t: 'tourn' });
    A.push({ t: 'end' }, { t: 'offers' }, { t: 'newseason' });
    G.agenda = A;
  }

  // ---------------------------------------------------------------------------
  // Base
  // ---------------------------------------------------------------------------

  /** Quartas e semifinal da copa sub-17, simuladas. */
  function runYouthSim() {
    const club = World.current();
    const others = Object.values(G.clubs).filter(x => x.c === club.c && x.n !== club.n);
    const ours = World.youthStr(club);
    for (const stage of ['Quartas de final', 'Semifinal']) {
      const opp = weighted(others, x => x.s - 40);
      const boost = Sim.titularChance(ours, 'youth') > 0.5 ? (G.p.ovr - ours) * 0.15 : 0;
      const pWin = clamp(0.5 + (ours + boost - World.youthStr(opp)) / 25, 0.15, 0.85);
      if (rnd() > pWin) {
        G.S.youthOut = true;
        feedText(`${G.S.youthName}: eliminado na ${stage.toLowerCase()} pelo ${opp.n} Sub-17.`);
        return next();
      }
    }
    feedText(`${G.S.youthName}: o ${club.n} Sub-17 está na <b>final</b>!`);
    next();
  }

  /**
   * Final da copa sub-17, jogada lance a lance.
   * @param {AgendaItem} item Passo atual.
   */
  function runYouthFinal(item) {
    if (G.S.youthOut || item.done) return next();
    const club = World.current();
    const others = Object.values(G.clubs).filter(x => x.c === club.c && x.n !== club.n);
    const opp = weighted(others, x => Math.pow(x.s - 40, 2));
    Match.start({
      kind: 'youth', comp: G.S.youthName, stage: 'Final', quick: false,
      ourName: `${club.n} Sub-17`, ourClub: club.n, ourStr: World.youthStr(club),
      opp: { n: `${opp.n} Sub-17`, s: World.youthStr(opp), club: opp.n }, home: rnd() < 0.5,
      onEnd: res => {
        if (!res.win) return `Vice-campeão ${World.ofComp(G.S.youthName)}.`;
        addTitle(G.S.youthName, 'youth');
        return `Campeão ${World.ofComp(G.S.youthName)}!`;
      },
    });
  }

  /**
   * Fim da base: evolução da temporada, primeiro contrato e escolha da primeira pré-temporada.
   * @param {AgendaItem} item Passo atual (guarda o resultado para não aplicar duas vezes).
   */
  function runBaseEnd(item) {
    if (!item.view) {
      const p = G.p;
      const before = p.ovr;
      Progression.addOverall(Util.randInt(3, 5) + (p.form >= 60 ? 1 : 0), 'Evolução na base');
      p.age++;
      const club = World.current();
      p.salary = World.salaryFor(club, p.ovr);
      item.view = { before, after: p.ovr, salary: p.salary, situation: Sim.titularLabel(Sim.titularChance(club.s)) };
      Store.save();
    }
    Screens.baseEnd(item.view);
  }

  // ---------------------------------------------------------------------------
  // Temporada profissional
  // ---------------------------------------------------------------------------

  /** Campeonato estadual (só no Brasil), simulado. */
  function runEstadual() {
    const club = World.current();
    const st = BR_STATES.find(s => s.uf === club.uf);
    const others = Object.values(G.clubs).filter(x => x.uf === club.uf && x.n !== club.n);
    if (!st || !others.length) return next();
    for (let i = 0; i < 5; i++) Sim.playOffscreen(club.s, pick(others).s);
    const second = Math.max(...others.map(x => x.s));
    if (rnd() > clamp(0.55 + (club.s - second) / 25, 0.1, 0.92)) {
      feedText(`${st.estadual}: o ${club.n} caiu antes da final.`);
      return next();
    }
    const opp = weighted(others, x => Math.pow(x.s - 40, 2));
    if (Sim.simKO(club.s, opp.s)) {
      const gained = addTitle(st.estadual);
      feedText(`<b>Campeão do ${st.estadual}</b> em cima do ${opp.n}!`, gained ? [{ text: `Overall ${Util.signed(gained)}`, tone: 'up' }] : null);
    } else {
      feedText(`${st.estadual}: vice-campeão, perdeu a final para o ${opp.n}.`);
    }
    next();
  }

  /**
   * Meia temporada simulada: rodadas da liga e fases iniciais das copas.
   * Bloco 1: primeiro turno, 1ª e 2ª fases da copa e fase de grupos continental.
   * Bloco 2: segundo turno e jogos da seleção.
   * @param {AgendaItem} item Passo atual (item.n = 1 ou 2).
   */
  function runBlock(item) {
    const S = G.S;
    const L = S.league;
    const club = World.current();
    const target = item.n === 1 ? Math.floor(L.rounds / 2) : L.rounds;
    const startGames = S.stats.games;
    const startPossible = S.stats.possible;
    while (L.played < target) Sim.leagueRound();
    const row = Sim.sortedTable()[Sim.myPos() - 1];
    feedText(`${L.name}: após ${L.played} rodadas, o ${club.n} está em <b>${Sim.myPos()}º</b> com ${row.pts} pontos.`);

    if (item.n === 1) {
      if (S.cup.alive) {
        for (const stage of ['1ª fase', '2ª fase']) {
          const opp = World.domesticOpp(1);
          if (!Sim.simKO(club.s, opp.s)) {
            S.cup.alive = false;
            feedText(`${S.cup.name}: eliminado na ${stage} pelo ${opp.n}.`);
            break;
          }
        }
        if (S.cup.alive) feedText(`${S.cup.name}: classificado para as <b>oitavas de final</b>.`);
      }
      if (S.cont && S.cont.alive) {
        let pts = 0;
        for (let i = 0; i < 6; i++) {
          const r = Sim.playOffscreen(club.s, World.contOpp('groups').s);
          pts += r.us > r.them ? 3 : r.us === r.them ? 1 : 0;
        }
        if (pts < 9 && !(pts >= 7 && rnd() < 0.5)) {
          S.cont.alive = false;
          feedText(`${S.cont.name}: eliminado na fase de grupos (${pts} pontos).`);
        } else {
          feedText(`${S.cont.name}: classificado para as <b>oitavas de final</b> (${pts} pontos nos grupos).`);
        }
      }
    } else if (G.nat.called) {
      const c = World.country(G.p.nat);
      for (let i = 0; i < 4; i++) Sim.playOffscreen(c.nat, World.natRival(c.nat - 12, c.nat + 2).s, { kind: 'nat' });
    }

    const games = S.stats.games - startGames;
    const possible = S.stats.possible - startPossible;
    S.benchRate = possible ? 1 - games / possible : 0;
    const st = S.stats;
    feedText(`Seus números: <b>${st.games} jogos, ${Util.plural(st.goals, 'gol', 'gols')}, ${Util.plural(st.assists, 'assistência', 'assistências')}</b>${st.rN ? `, nota média ${(st.rSum / st.rN).toFixed(1)}` : ''}.`);
    checkCallup();
    next();
  }

  /**
   * Jogo de mata-mata da copa nacional (oitavas em diante).
   * @param {AgendaItem} item Passo atual (item.stage).
   */
  function runCup(item) {
    const S = G.S;
    if (item.done || !S.cup.alive) return next();
    const club = World.current();
    const share = { 'Oitavas de final': 1, 'Quartas de final': 0.8, Semifinal: 0.5, Final: 0.35 }[item.stage];
    const opp = World.domesticOpp(share);
    const isFinal = item.stage === 'Final';
    Match.start({
      kind: 'club', comp: S.cup.name, stage: item.stage, quick: !isFinal,
      ourName: club.n, ourClub: club.n, ourStr: club.s,
      opp: { n: opp.n, s: opp.s, club: opp.n }, home: isFinal ? null : rnd() < 0.5,
      onEnd: res => {
        if (!res.win) {
          S.cup.alive = false;
          return isFinal ? `Vice-campeão ${World.ofComp(S.cup.name)}.` : `Eliminado ${World.ofComp(S.cup.name)}.`;
        }
        if (!isFinal) return `Classificado para ${nextStageLabel(item.stage)}.`;
        addTitle(S.cup.name);
        if (club.c === 'BR' && club.d === 1) G.qual[G.club] = 'main';
        return `Campeão ${World.ofComp(S.cup.name)}!`;
      },
    });
  }

  /**
   * Jogo de mata-mata do torneio continental (oitavas em diante).
   * Quem vence o torneio principal disputa o Mundial de Clubes.
   * @param {AgendaItem} item Passo atual (item.stage).
   */
  function runCont(item) {
    const S = G.S;
    if (item.done || !S.cont || !S.cont.alive) return next();
    const club = World.current();
    const opp = World.contOpp(item.stage);
    const isFinal = item.stage === 'Final';
    Match.start({
      kind: 'club', comp: S.cont.name, stage: item.stage, quick: !isFinal,
      ourName: club.n, ourClub: club.n, ourStr: club.s,
      opp: { n: opp.n, s: opp.s, flag: World.country(opp.c).flag, club: opp.n }, home: isFinal ? null : rnd() < 0.5,
      onEnd: res => {
        if (!res.win) {
          S.cont.alive = false;
          return isFinal ? `Vice-campeão ${World.ofComp(S.cont.name)}.` : `Eliminado ${World.ofComp(S.cont.name)}.`;
        }
        if (!isFinal) return `Classificado para ${nextStageLabel(item.stage)}.`;
        addTitle(S.cont.name);
        if (S.cont.type === 'main') G.agenda.unshift({ t: 'mundial' });
        return `Campeão ${World.ofComp(S.cont.name)}!`;
      },
    });
  }

  /**
   * Final do Mundial de Clubes.
   * @param {AgendaItem} item Passo atual.
   */
  function runMundial(item) {
    if (item.done) return next();
    const club = World.current();
    const opp = World.mundialOpp();
    Match.start({
      kind: 'club', comp: 'Mundial de Clubes', stage: 'Final', quick: false,
      ourName: club.n, ourClub: club.n, ourStr: club.s,
      opp: { n: opp.n, s: opp.s, flag: World.country(opp.c).flag, club: opp.n }, home: null,
      onEnd: res => {
        if (!res.win) return 'Vice-campeão mundial.';
        addTitle('Mundial de Clubes');
        return 'Campeão do Mundial de Clubes!';
      },
    });
  }

  /**
   * Torneio de seleções: fase de grupos simulada e mata-mata jogado
   * (Copa do Mundo a partir das oitavas; torneio continental a partir das quartas).
   */
  function runTournament() {
    const name = World.tournamentName();
    if (!G.nat.called || !name) return next();
    const c = World.country(G.p.nat);
    let pts = 0;
    for (let i = 0; i < 3; i++) {
      const r = Sim.playOffscreen(c.nat, World.natRival(c.nat - 14, c.nat + 2).s, { kind: 'nat' });
      pts += r.us > r.them ? 3 : r.us === r.them ? 1 : 0;
    }
    if (pts < 4 || (pts === 4 && rnd() < 0.4)) {
      feedText(`${name} ${G.year}: ${c.name} eliminada na fase de grupos (${pts} pontos).`);
      return next();
    }
    feedText(`${name} ${G.year}: ${c.name} avançou na fase de grupos com ${pts} pontos.`);
    const stages = name === 'Copa do Mundo' ? KO_STAGES : KO_STAGES.slice(1);
    G.agenda.unshift(...stages.map(stage => ({ t: 'tmatch', stage, name })));
    next();
  }

  /**
   * Jogo de mata-mata do torneio de seleções.
   * @param {AgendaItem} item Passo atual (item.stage, item.name).
   */
  function runTournamentMatch(item) {
    if (item.done) return next();
    const c = World.country(G.p.nat);
    const ranges = { 'Oitavas de final': [72, 84], 'Quartas de final': [78, 87], Semifinal: [80, 89], Final: [83, 89] };
    const opp = World.natRival(...ranges[item.stage]);
    const isFinal = item.stage === 'Final';
    Match.start({
      kind: 'nat', comp: `${item.name} ${G.year}`, stage: item.stage, quick: !isFinal,
      ourName: `${c.flag} ${c.name}`, ourStr: c.nat, opp, home: null,
      onEnd: res => {
        if (!res.win) {
          G.agenda = G.agenda.filter(a => a.t !== 'tmatch');
          return `${c.name} eliminada ${World.ofComp(item.name)}.`;
        }
        if (!isFinal) return `${c.name} avança para ${nextStageLabel(item.stage)}.`;
        addTitle(item.name, 'nat');
        return `Campeão ${World.ofComp(item.name)}!`;
      },
    });
  }

  /**
   * Agenda a convocação quando o jogador atinge overall 85 em grande fase (Fase 70 ou mais).
   */
  function checkCallup() {
    const p = G.p;
    if (G.phase !== 'pro' || G.nat.called || G.nat.declinedYear === G.year) return;
    if (p.ovr >= 85 && p.form >= 70 && !G.agenda.some(a => a.t === 'callup')) G.agenda.unshift({ t: 'callup' });
  }

  // ---------------------------------------------------------------------------
  // Escolhas: eventos, entrevistas e convocação
  // ---------------------------------------------------------------------------

  /**
   * Definição do evento guardado no passo atual.
   * @param {AgendaItem} item Passo com item.id.
   * @returns {CareerEvent}
   */
  function eventOf(item) {
    if (item.id === 'idol') return buildIdolEvent(G);
    if (item.id === 'callup') return buildCallupEvent(G);
    return CAREER_EVENTS.find(e => e.id === item.id);
  }

  /**
   * Evento de carreira. Na fase profissional aparece em cerca de metade das temporadas;
   * em clubes com ídolo histórico, o conselho do ídolo tem prioridade (uma vez por clube).
   * @param {AgendaItem} item Passo atual.
   */
  function runEvent(item) {
    if (item.answered) return Screens.choiceResult(item.answered);
    if (item.id) return Screens.choice(eventOf(item));
    const pool = item.pool || 'pro';
    if (pool === 'pro' && IDOLS[G.club] && !G.idolMet.includes(G.club) && rnd() < 0.6) {
      G.idolMet.push(G.club);
      item.id = 'idol';
      Store.save();
      return Screens.choice(eventOf(item));
    }
    if (pool === 'pro' && rnd() > 0.5) return next();
    const recent = G.recentEvents || [];
    let candidates = CAREER_EVENTS.filter(e => e.pool === pool && (!e.when || e.when(G)));
    const fresh = candidates.filter(e => !recent.includes(e.id));
    if (fresh.length) candidates = fresh;
    if (!candidates.length) return next();
    const event = weighted(candidates, e => e.weight || 1);
    item.id = event.id;
    G.recentEvents = [...recent, event.id].slice(-5);
    Store.save();
    Screens.choice(event);
  }

  /**
   * Entrevista coletiva (uma por temporada), com pergunta sorteada sem repetir.
   * @param {AgendaItem} item Passo atual.
   */
  function runInterview(item) {
    if (item.answered) return Screens.choiceResult(item.answered);
    if (!item.qid) {
      Interview.prepare(item);
      Store.save();
    }
    Screens.choice(Interview.toEvent(item));
  }

  /**
   * Convocação para a seleção.
   * @param {AgendaItem} item Passo atual.
   */
  function runCallup(item) {
    if (item.answered) return Screens.choiceResult(item.answered);
    item.id = 'callup';
    Screens.choice(eventOf(item));
  }

  /**
   * Aplica a opção escolhida no evento, entrevista ou convocação atual e mostra o resultado.
   * @param {number} index Posição da opção na tela.
   */
  function choose(index) {
    const item = G.cur;
    if (!item || item.answered) return;
    let result;
    if (item.t === 'interview') {
      const answer = Interview.answersOf(item)[index];
      const ev = Interview.evaluate(answer);
      result = {
        icon: 'mic', title: 'Entrevista coletiva', choice: `“${answer.label}”`, text: ev.text,
        tier: ev.tier, reason: ev.reason, styleName: ev.styleName, factors: ev.factors,
        chips: Progression.applyEffects(ev.fx),
      };
    } else {
      const event = eventOf(item);
      const option = event.options[index];
      const out = option.outcome(G);
      result = { icon: event.icon, title: event.title, choice: option.label, text: out.text, chips: Progression.applyEffects(out.fx) };
    }
    item.answered = result;
    Store.save();
    Screens.choiceResult(result);
  }

  // ---------------------------------------------------------------------------
  // Fim de temporada
  // ---------------------------------------------------------------------------

  /**
   * Fim da temporada: classificação final, acesso/rebaixamento, vagas, prêmios,
   * evolução do overall e escolha da pré-temporada.
   * @param {AgendaItem} item Passo atual (guarda o resultado para não recalcular).
   */
  function runSeasonEnd(item) {
    if (!item.view) {
      item.view = closeSeason();
      Store.save();
    }
    Screens.seasonEnd(item.view);
  }

  /**
   * Calcula tudo o que acontece no fim da temporada.
   * @returns {Object} Dados exibidos na tela de fim de temporada.
   */
  function closeSeason() {
    const S = G.S;
    const L = S.league;
    const p = G.p;
    while (L.played < L.rounds) Sim.leagueRound();
    const club = World.current();
    const c = World.country(club.c);
    const pos = Sim.myPos();
    const notes = [];

    if (pos === 1) {
      addTitle(L.name);
      notes.push(`<b>Campeão ${World.ofComp(L.name)}!</b>`);
    } else {
      notes.push(`${L.name}: <b>${pos}º lugar</b>.`);
    }
    notes.push(...promotionNotes(club, pos, L.table.length));

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

    // Prêmios
    const st = S.stats;
    const avg = st.rN ? st.rSum / st.rN : 6;
    const share = st.possible ? st.games / st.possible : 0;
    const league = Progression.leagueAchievements(L.name, L.rounds);
    const awards = [...league.awards];
    notes.push(...league.notes);
    if (p.ovr >= 88 && club.d === 1) {
      const leagueFactor = World.confedOf(club) === 'UEFA' ? 1 : 0.75;
      const contribution = p.pos === 'ATA' || p.pos === 'MEI' ? (st.goals + st.assists) * 0.3 : 5;
      const positionFactor = { ATA: 1, MEI: 0.95, ZAG: 0.8, GOL: 0.75 }[p.pos];
      const bigTitles = S.titles.filter(t => BIG_TITLES.test(t)).length;
      const score = ((p.ovr - 88) * 5 + (avg - 7.2) * 18 + bigTitles * 6 + contribution) * leagueFactor * positionFactor;
      // Há sempre outros candidatos fortes: mesmo o melhor do mundo vence no máximo 60% das vezes.
      const chance = clamp((score - 50) / 50, 0, 0.6);
      if (rnd() < chance) awards.push('Bola de Ouro');
      else if (score >= 40) notes.push('Você ficou entre os 3 finalistas da Bola de Ouro.');
    }
    if (avg >= 7.45 && share >= 0.6) awards.push(`Craque do campeonato (${L.name})`);
    if (p.age <= 21 && avg >= 7.1 && st.games >= 20) awards.push('Revelação da temporada');
    for (const a of awards) G.awards.push({ name: a, year: G.year });
    p.fame = clamp(p.fame + awards.length * 6, 0, 100);

    // Histórico e totais
    G.history.push({ year: G.year, club: G.club, games: st.games, goals: st.goals, assists: st.assists, avg: st.rN ? avg : null, ovr: p.ovr, titles: [...S.titles] });
    const car = G.career;
    car.games += st.games; car.goals += st.goals; car.assists += st.assists;
    car.rSum += st.rSum; car.rN += st.rN; car.cleanSheets += st.cleanSheets;
    p.money += p.salary;

    // Evolução natural (idade e minutos)
    const growth = Progression.naturalGrowth(share);
    if (growth) Progression.addOverall(growth, growth > 0 ? 'Evolução natural' : 'Idade');
    p.age++;
    checkCallup();

    const breakdown = {};
    for (const { reason, delta } of S.ovrLog) breakdown[reason] = (breakdown[reason] || 0) + delta;
    return {
      year: G.year,
      notes,
      table: UI.leagueTable(5),
      stats: { games: st.games, goals: st.goals, assists: st.assists, avg: st.rN ? avg : null, cleanSheets: st.cleanSheets },
      titles: [...S.titles],
      awards,
      ovrStart: S.ovrStart,
      ovrEnd: p.ovr,
      breakdown: Object.entries(breakdown).map(([reason, delta]) => ({ reason, delta })),
      age: p.age,
      value: World.marketValue(p),
      forcedRetirement: p.age >= 38 || (p.age >= 35 && p.ovr < 62),
      canRetire: p.age >= 33,
      callHint: !G.nat.called && p.ovr >= 80,
    };
  }

  /**
   * Acesso e rebaixamento no Brasil (4 sobem e 4 descem entre as séries).
   * @param {Club} club Clube do jogador.
   * @param {number} pos Posição final.
   * @param {number} teams Times na liga.
   * @returns {string[]} Notas para a tela.
   */
  function promotionNotes(club, pos, teams) {
    if (club.c !== 'BR') return [];
    /** Move um clube de outra divisão para manter o número de times em cada série. */
    const swap = (fromDiv, toDiv, strongest) => {
      const others = Object.values(G.clubs).filter(x => x.c === 'BR' && x.d === fromDiv && x.n !== club.n)
        .sort((a, b) => (strongest ? b.s - a.s : a.s - b.s));
      if (others[0]) others[0].d = toDiv;
    };
    if (club.d > 1 && pos <= 4) {
      club.d--;
      swap(club.d, club.d + 1, false);
      return [`Acesso! O ${club.n} vai disputar a ${World.leagueName(club)}.`];
    }
    if (club.d < 4 && pos > teams - 4) {
      club.d++;
      swap(club.d, club.d - 1, true);
      return [`Rebaixado. O ${club.n} vai disputar a ${World.leagueName(club)}.`];
    }
    return [];
  }

  /**
   * Guarda o treino de pré-temporada escolhido (aplicado no início da próxima temporada)
   * e segue a carreira.
   * @param {string} id Identificador do treino.
   */
  function chooseTraining(id) {
    G.pendingTraining = id;
    if (G.cur && G.cur.t === 'baseEnd') G.year++;
    next();
  }

  /** Encerra a carreira e mostra a tela final. */
  function retire() {
    G.retired = true;
    G.agenda = [];
    Store.save();
    Screens.final();
  }

  // ---------------------------------------------------------------------------
  // Janela de transferências
  // ---------------------------------------------------------------------------

  /**
   * Gera as propostas da janela, conforme overall, fama, desempenho e idade.
   * @returns {Array<{club: string, salary: number, loan: boolean, buy?: boolean, negotiated?: boolean}>}
   */
  function generateOffers() {
    const p = G.p;
    const S = G.S;
    const cur = World.current();
    const st = S.stats;
    const avg = st.rN ? st.rSum / st.rN : 6.2;
    const share = st.possible ? st.games / st.possible : 0;
    const perf = (avg - 6.6) * 2 + p.fame / 40 + S.moreOffers;
    const exclude = new Set([G.club]);
    if (G.loan) exclude.add(G.loan.parent);
    const maxS = p.ovr + 3 + perf * 1.5;
    const candidates = Object.values(G.clubs).filter(c => !exclude.has(c.n) && c.s <= maxS && c.s >= p.ovr - 12 && c.s >= cur.s - 4);
    let count = (rnd() < 0.7 ? 1 : 0) + (perf > 1 ? 1 : 0) + (rnd() < 0.3 + S.moreOffers * 0.1 ? 1 : 0);
    if (p.age >= 33) count = Math.max(0, count - 1);
    const offers = [];
    for (let i = 0; i < count && candidates.length; i++) {
      const c = weighted(candidates, x => Math.pow(Math.max(1, x.s - (p.ovr - 13)), 1.6));
      candidates.splice(candidates.indexOf(c), 1);
      offers.push({ club: c.n, salary: Math.round(World.salaryFor(c, p.ovr) * (0.9 + rnd() * 0.4)), loan: false });
    }
    if (p.age <= 22 && share < 0.4) {
      const loanClubs = Object.values(G.clubs).filter(c => !exclude.has(c.n) && c.s < cur.s - 3 && c.s <= p.ovr + 2 && c.s >= p.ovr - 10);
      if (loanClubs.length) offers.push({ club: pick(loanClubs).n, salary: p.salary, loan: true });
    }
    return offers;
  }

  /**
   * Janela de transferências. Também encerra empréstimos. Sem propostas, segue direto.
   * @param {AgendaItem} item Passo atual (guarda as propostas).
   */
  function runOffers(item) {
    const p = G.p;
    if (!item.offers) {
      if (G.loan) {
        const back = G.loan.parent;
        const loanClub = G.club;
        const st = G.S.stats;
        const avg = st.rN ? st.rSum / st.rN : 6;
        feedText(`Fim do empréstimo: você volta ao ${back}.`);
        G.club = back;
        G.loan = null;
        p.chem = 45;
        p.coach = 50;
        item.offers = generateOffers();
        if (avg >= 6.8 && !item.offers.some(o => o.club === loanClub)) {
          item.offers.unshift({ club: loanClub, salary: World.salaryFor(World.club(loanClub), p.ovr), loan: false, buy: true });
        }
        item.forced = true;
      } else {
        item.offers = generateOffers();
      }
      Store.save();
    }
    if (!item.offers.length && !item.forced) {
      feedText('Janela de transferências: nenhum clube fez proposta.');
      return next();
    }
    Screens.offers(item);
  }

  /**
   * Pede salário maior. Sem sorte: o clube aceita se o jogador for peça valiosa para ele
   * (overall acima do nível do clube ou fama alta); senão retira a proposta.
   * @param {number} index Posição da proposta.
   */
  function negotiate(index) {
    const item = G.cur;
    const offer = item.offers[index];
    const c = World.club(offer.club);
    offer.negotiated = true;
    if (G.p.ovr >= c.s + 2 || G.p.fame >= 70) {
      offer.salary = Math.round(offer.salary * 1.35);
      feedText(`O ${c.n} aceitou pagar ${Util.fmtMoney(offer.salary)}/ano.`);
    } else {
      item.offers.splice(index, 1);
      feedText(`O ${c.n} achou a exigência alta demais para o seu nível e retirou a proposta.`);
    }
    Store.save();
    Screens.offers(item);
  }

  /**
   * Aceita uma proposta (transferência ou empréstimo).
   * @param {number} index Posição da proposta.
   */
  function acceptOffer(index) {
    const offer = G.cur.offers[index];
    const p = G.p;
    const leaving = G.club;
    if (offer.loan) G.loan = { parent: G.club };
    G.club = offer.club;
    p.salary = offer.salary;
    p.chem = 40;
    p.coach = 50;
    p.fans = clamp(35 + p.fame / 4, 0, 100);
    G.path.push({ club: offer.club, year: G.year + 1, kind: offer.loan ? 'loan' : 'transfer' });
    feedText(`${offer.loan ? 'Emprestado ao' : 'Contratado pelo'} <b>${offer.club}</b>. A torcida do ${leaving} vai sentir sua falta.`);
    next();
  }

  /** Recusa as propostas e fica no clube (se já for bom demais para ele, a fase cai). */
  function stay() {
    if (G.p.ovr > World.current().s + 8) G.p.form = clamp(G.p.form - 6, 0, 100);
    next();
  }

  /** Avança o calendário para a próxima temporada. */
  function runNewSeason() {
    G.year++;
    next();
  }

  /** Mapa tipo de passo → função que o executa. */
  const HANDLERS = {
    event: runEvent,
    interview: runInterview,
    callup: runCallup,
    youthsim: runYouthSim,
    youthfinal: runYouthFinal,
    baseEnd: runBaseEnd,
    estadual: runEstadual,
    block: runBlock,
    cup: runCup,
    cont: runCont,
    mundial: runMundial,
    tourn: runTournament,
    tmatch: runTournamentMatch,
    end: runSeasonEnd,
    offers: runOffers,
    newseason: runNewSeason,
  };

  return {
    next, resume, startBase, feedText, checkCallup, choose, chooseTraining, retire,
    negotiate, acceptOffer, stay,
  };
})();
