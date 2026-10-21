/**
 * @file Regras de evolução do jogador: overall, efeitos das escolhas, treinos de pré-temporada,
 * prêmios da temporada e, no fim da carreira, o título de legado e os recordes.
 *
 * Como o overall muda:
 *   - Crescimento natural pela idade (só até o potencial; a partir dos 27 vira queda).
 *   - Treino de pré-temporada escolhido pelo jogador (passa do potencial): +2 até 77,
 *     +1 de 78 a 87; a partir de 88 o treino só mantém o nível.
 *   - Conquistas: +1 na temporada em que ganhar título, +3 artilheiro e +2 líder de
 *     assistências do campeonato, +1 artilheiro ou líder de assistências do time
 *     (valores em BONUS).
 *   - Algumas escolhas fora de campo (treino extra, conselho do ídolo).
 */
'use strict';

/**
 * Chip de efeito mostrado na interface.
 * @typedef {{text: string, tone: 'up'|'down'|'neutral'}} Chip
 */

/** Namespace das regras de evolução e de legado. */
const Progression = (() => {
  const { clamp, randInt, signed } = Util;
  const OVR_MIN = 35;
  const OVR_MAX = 99;
  const METERS = { form: 'Fase', coach: 'Técnico', chem: 'Elenco', fans: 'Torcida', fame: 'Fama' };

  /** Pontos de overall por conquista. */
  const BONUS = {
    title: 1,
    titlesPerSeason: 1,
    leagueTopScorer: 3,
    leagueTopAssists: 2,
    teamTopScorer: 1,
    teamTopAssists: 1,
    bestGoalkeeper: 2,
    bestDefender: 4,
  };

  /**
   * Soma pontos ao overall, registra o motivo na temporada e atualiza o overall máximo.
   * @param {number} delta Pontos (pode ser negativo).
   * @param {string} reason Motivo exibido no balanço da temporada.
   * @returns {number} Quanto realmente mudou (respeitando 35 e 99).
   */
  function addOverall(delta, reason) {
    const p = G.p;
    const before = p.ovr;
    p.ovr = clamp(Math.round(p.ovr + delta), OVR_MIN, OVR_MAX);
    p.peak = Math.max(p.peak || 0, p.ovr);
    const applied = p.ovr - before;
    if (applied !== 0 && G.S) G.S.ovrLog.push({ reason, delta: applied });
    return applied;
  }

  /**
   * Aplica os efeitos de uma escolha ao jogador.
   * @param {Effects} fx Efeitos.
   * @returns {Chip[]} Chips descrevendo o que mudou.
   */
  function applyEffects(fx) {
    const p = G.p;
    const chips = [];
    /** Adiciona um chip com o tom (verde/vermelho/neutro) conforme o sinal do valor. */
    const add = (text, value) => chips.push({ text, tone: value > 0 ? 'up' : value < 0 ? 'down' : 'neutral' });
    for (const [key, value] of Object.entries(fx || {})) {
      if (METERS[key]) {
        p[key] = clamp(p[key] + value, 0, 100);
        add(`${METERS[key]} ${signed(value)}`, value);
        continue;
      }
      switch (key) {
        case 'ovr': {
          const got = addOverall(value, 'Escolhas fora de campo');
          if (got) add(`Overall ${signed(got)}`, got);
          break;
        }
        case 'pot':
          p.pot = Math.min(p.pot + value, OVR_MAX);
          add('Potencial ↑', 1);
          break;
        case 'money':
          p.money += value;
          add(Util.fmtMoney(value), value);
          break;
        case 'moneyFame': {
          const gain = Math.round((50 + p.fame * 15) * value);
          p.money += gain;
          add(`+${Util.fmtMoney(gain)}`, 1);
          break;
        }
        case 'injury':
          p.injury += value;
          add(`Lesão: ${Util.plural(value, 'jogo', 'jogos')}`, -1);
          break;
        case 'suspend':
          p.suspended += value;
          add(`Suspenso: ${Util.plural(value, 'jogo', 'jogos')}`, -1);
          break;
        case 'coachSet':
          p.coach = value;
          add(`Técnico: ${value}`, 0);
          break;
        case 'salaryMul':
          p.salary = Math.round(p.salary * value);
          add(`Salário: ${Util.fmtMoney(p.salary)}/ano`, 1);
          break;
        case 'moreOffers':
          if (G.S) G.S.moreOffers += value;
          add('Mercado atento', 1);
          break;
        case 'callup':
          G.nat.called = true;
          add(`${World.country(p.nat).flag} Convocado`, 1);
          break;
        case 'declineCallup':
          G.nat.declinedYear = G.year;
          break;
        default:
          break;
      }
    }
    return chips;
  }

  /**
   * Overall por título: +1 na temporada em que o jogador é campeão (limite em BONUS.titlesPerSeason).
   * @returns {number} Pontos ganhos (0 quando o limite da temporada já foi atingido).
   */
  function titleBonus() {
    const used = G.S.titleBonus || 0;
    if (used >= BONUS.titlesPerSeason) return 0;
    const got = addOverall(BONUS.title, 'Títulos conquistados');
    G.S.titleBonus = used + got;
    return got;
  }

  /**
   * Treinos de pré-temporada. Escolhidos no fim de cada temporada e aplicados no início da próxima.
   * @type {Array<{id: string, name: string, describe: () => string, apply: () => {text: string, chips: Chip[]}}>}
   */
  const TRAININGS = [
    {
      id: 'intenso',
      name: 'Treino intenso',
      describe: () => `${gainText(intenseGain())} O corpo cansa: Fase -6${G.p.form < 35 ? ' e risco de lesão (sua fase está baixa)' : ''}.`,
      apply() {
        const chips = [];
        const got = addOverall(intenseGain(), 'Treino de pré-temporada');
        if (got) chips.push({ text: `Overall ${signed(got)}`, tone: 'up' });
        const lowForm = G.p.form < 35;
        chips.push(...applyEffects(lowForm ? { form: -6, injury: 3 } : { form: -6 }));
        return { text: lowForm ? 'Você treinou forte com o corpo cansado e se lesionou, mas evoluiu.' : 'Pré-temporada puxada: você voltou mais forte.', chips };
      },
    },
    {
      id: 'tecnico',
      name: 'Treino técnico com a comissão',
      describe: () => `${gainText(technicalGain())} Técnico +8.`,
      apply() {
        const chips = [];
        const got = addOverall(technicalGain(), 'Treino de pré-temporada');
        if (got) chips.push({ text: `Overall ${signed(got)}`, tone: 'up' });
        chips.push(...applyEffects({ coach: 8 }));
        return { text: 'Você caprichou nos fundamentos e ganhou a confiança da comissão técnica.', chips };
      },
    },
    {
      id: 'grupo',
      name: 'Pré-temporada com o grupo',
      describe: () => 'Sem ganho de overall, mas Elenco +10 e Fase +8.',
      apply() {
        return { text: 'Amistosos, concentração e resenha: o grupo chega unido à temporada.', chips: applyEffects({ chem: 10, form: 8 }) };
      },
    },
  ];

  /** Overall a partir do qual o treino só mantém o nível. */
  const TRAINING_CEILING = 88;

  /**
   * Overall ganho no treino intenso: +2 até 77, +1 de 78 a 87 (ou depois dos 30 anos), 0 a partir de 88.
   * @returns {number}
   */
  function intenseGain() {
    if (G.p.ovr >= TRAINING_CEILING) return 0;
    return G.p.ovr < 78 && G.p.age <= 30 ? 2 : 1;
  }

  /**
   * Overall ganho no treino técnico: +1 até 87, 0 a partir de 88.
   * @returns {number}
   */
  const technicalGain = () => (G.p.ovr >= TRAINING_CEILING ? 0 : 1);

  /**
   * Texto do ganho de overall de um treino.
   * @param {number} gain Pontos de overall.
   * @returns {string}
   */
  const gainText = gain => (gain > 0 ? `Overall +${gain}.` : 'No seu nível o treino só mantém o overall.');

  /**
   * Aplica o treino de pré-temporada escolhido.
   * @param {string} id Identificador do treino.
   * @returns {{name: string, text: string, chips: Chip[]}|null}
   */
  function applyTraining(id) {
    const training = TRAININGS.find(t => t.id === id);
    if (!training) return null;
    return { name: training.name, ...training.apply() };
  }

  /**
   * Crescimento natural de fim de temporada, pela idade e pelos minutos jogados.
   * Só sobe até o potencial; depois dos 30 anos o corpo começa a cair.
   * @param {number} share Fração dos jogos do time que o jogador disputou (0-1).
   * @returns {number} Pontos de overall (inteiro).
   */
  function naturalGrowth(share) {
    const { age, ovr, pot } = G.p;
    let g;
    if (age <= 20) g = randInt(1, 3);
    else if (age <= 23) g = randInt(0, 2);
    else if (age <= 26) g = randInt(0, 1);
    else if (age <= 28) g = randInt(-1, 0);
    else if (age <= 30) g = randInt(-2, -1);
    else if (age <= 32) g = randInt(-3, -2);
    // Depois dos 38 só segue jogando quem tem overall 90+ (ver Season.retirementForced), e a idade pesa mais.
    else if (age >= 38) g = randInt(-5, -3);
    else g = randInt(-4, -3);
    if (g > 0) {
      if (share < 0.3) g -= 1;
      g = Math.max(0, Math.min(g, pot - ovr));
    }
    return g;
  }

  /**
   * Prêmios por desempenho na liga e o overall que eles rendem.
   * Compara os números do jogador com as marcas sorteadas no início da temporada (G.S.marks).
   * @param {string} leagueLabel Nome da liga (para o texto do prêmio).
   * @param {number} rounds Rodadas da liga.
   * @returns {{awards: string[], notes: string[]}} Prêmios oficiais e destaques do time.
   */
  function leagueAchievements(leagueLabel, rounds) {
    const p = G.p;
    const st = G.S.stats;
    const marks = G.S.marks;
    const avg = st.rN ? st.rSum / st.rN : 0;
    const share = st.possible ? st.games / st.possible : 0;
    const awards = [];
    const notes = [];

    if (p.pos !== 'GOL') {
      if (st.leagueGoals >= 3 && st.leagueGoals > marks.goals) {
        awards.push(`Artilheiro (${leagueLabel})`);
        addOverall(BONUS.leagueTopScorer, 'Artilheiro do campeonato');
      } else if (st.leagueGoals >= 3 && st.leagueGoals > marks.teamGoals) {
        notes.push(`Artilheiro do time na liga, com ${st.leagueGoals} gols.`);
        addOverall(BONUS.teamTopScorer, 'Artilheiro do time');
      }
      if (st.leagueAssists >= 3 && st.leagueAssists > marks.assists) {
        awards.push(`Líder de assistências (${leagueLabel})`);
        addOverall(BONUS.leagueTopAssists, 'Líder de assistências do campeonato');
      } else if (st.leagueAssists >= 3 && st.leagueAssists > marks.teamAssists) {
        notes.push(`Líder de assistências do time na liga, com ${st.leagueAssists}.`);
        addOverall(BONUS.teamTopAssists, 'Líder de assistências do time');
      }
    }
    if (p.pos === 'GOL' && st.cleanSheets >= Math.ceil(rounds * 0.5)) {
      awards.push(`Goleiro menos vazado (${leagueLabel})`);
      addOverall(BONUS.bestGoalkeeper, 'Goleiro menos vazado');
    }
    if (p.pos === 'ZAG' && avg >= 7.4 && share >= 0.7) {
      awards.push(`Melhor zagueiro (${leagueLabel})`);
      addOverall(BONUS.bestDefender, 'Melhor zagueiro do campeonato');
    }
    return { awards, notes };
  }

  /**
   * Conta títulos cujo nome casa com a expressão.
   * @param {RegExp} re Expressão para o nome do título.
   * @returns {number}
   */
  const countTitles = re => G.titles.filter(t => re.test(t.name)).length;

  /** @returns {number} Bolas de Ouro conquistadas. */
  const balloons = () => G.awards.filter(a => a.name === 'Bola de Ouro').length;

  /**
   * Requisitos do título "Superou o REI" e a situação de cada um.
   * @returns {Array<{label: string, value: number, need: number, ok: boolean}>}
   */
  function kingChecklist() {
    const items = [
      { label: 'Gols', value: G.career.goals + G.nat.goals, need: 800 },
      { label: 'Assistências', value: G.career.assists + G.nat.assists, need: 200 },
      { label: 'Copas do Mundo', value: countTitles(/^Copa do Mundo$/), need: 3 },
      { label: 'Bolas de Ouro', value: balloons(), need: 6 },
      { label: 'Champions League', value: countTitles(/^UEFA Champions League$/), need: 6 },
    ];
    return items.map(i => ({ ...i, ok: i.value >= i.need }));
  }

  /**
   * Título de legado da carreira, definido pelo overall máximo (ou pelo desafio do Rei).
   * @returns {{id: string, title: string, desc: string}}
   */
  function legacyTier() {
    const peak = G.p.peak;
    if (kingChecklist().every(i => i.ok)) {
      return { id: 'rei', title: 'Superou o REI', desc: '800 gols, 200 assistências, 3 Copas do Mundo, mais de 5 Bolas de Ouro e mais de 5 Champions. Uma carreira à altura de Pelé.' };
    }
    if (peak >= 96) return { id: 'goat', title: 'Entre os GOATs', desc: `Chegou a ${peak} de overall. Poucos na história jogaram tanto.` };
    if (peak >= 90) return { id: 'craque', title: 'Craque', desc: `Overall máximo de ${peak}: um dos melhores da sua geração.` };
    if (peak >= 85) return { id: 'bom', title: 'Bom jogador', desc: `Overall máximo de ${peak}: carreira respeitada.` };
    return { id: 'pro', title: 'Comum da bola', desc: `Overall máximo de ${peak}. Foi bem mas esperavam mais coisas vindo de você.` };
  }

  /**
   * Jogos disputados por clube ao longo da carreira.
   * @returns {Object<string, number>}
   */
  function gamesByClub() {
    const map = {};
    for (const h of G.history) map[h.club] = (map[h.club] || 0) + h.games;
    return map;
  }

  /**
   * Título de quem defende o mesmo clube por muitos jogos (aparece em "Recordes" na tela final).
   * Para mudar o nome ou o número de jogos, altere aqui.
   */
  const ONE_CLUB_LEGEND = { games: 500, title: 'O Francesco Totti da nova geração' };

  /** Título de quem chega aos 45 anos ainda com overall 90+ (ver Season.retirementForced). */
  const TWO_GENERATIONS = { title: 'O terror de duas gerações', desc: 'Jogou em alto nível até os 45 anos, enfrentando pais e filhos.' };

  /**
   * Recordes históricos batidos na carreira.
   * @returns {Array<{title: string, desc: string}>}
   */
  function records() {
    const out = [];
    const goals = G.career.goals + G.nat.goals;
    const total = G.titles.filter(t => t.kind !== 'youth').length;
    const bdo = balloons();
    const ucl = countTitles(/^UEFA Champions League$/);
    const lib = countTitles(/^Copa Libertadores$/);
    if (bdo >= 9) out.push({ title: 'Recordista de Bolas de Ouro', desc: `${bdo} Bolas de Ouro, superando as 8 de Messi.` });
    if (total >= 50) out.push({ title: 'Maior campeão da história', desc: `${total} títulos, passando os 49 de Lionel Messi.` });
    if (goals >= 950) out.push({ title: 'Maior artilheiro da história', desc: `${goals} gols oficiais, passando Cristiano Ronaldo.` });
    if (ucl >= 7) out.push({ title: 'Senhor da Champions', desc: `${ucl} Champions League, superando as 6 de Gento e Modrić.` });
    if (lib >= 6) out.push({ title: 'Lenda da Libertadores', desc: `${lib} Libertadores, ${lib > 6 ? 'superando' : 'igualando'} Francisco Sá.` });
    if (G.nat.caps >= 225) out.push({ title: 'Recordista pela seleção', desc: `${G.nat.caps} jogos por seleções.` });
    if (G.nat.goals >= 145) out.push({ title: 'Maior artilheiro de seleções', desc: `${G.nat.goals} gols pela seleção, passando Cristiano Ronaldo.` });
    if (G.twoGenerations) out.push({ title: TWO_GENERATIONS.title, desc: TWO_GENERATIONS.desc });
    for (const [clubName, games] of Object.entries(gamesByClub())) {
      if (games >= ONE_CLUB_LEGEND.games) {
        const idol = IDOLS[clubName];
        out.push({ title: ONE_CLUB_LEGEND.title, desc: `${games} jogos pelo ${clubName}${idol ? `. Seu nome agora está ao lado de ${idol[0]} na história do clube` : ''}.` });
      }
    }
    return out;
  }

  /** Ajuste de cada atributo da cartinha em relação ao overall, por posição. */
  const CARD_PROFILES = {
    ATA: { labels: ['RIT', 'FIN', 'PAS', 'DRI', 'DEF', 'FÍS'], offsets: [3, 4, -7, 1, -45, -5] },
    MEI: { labels: ['RIT', 'FIN', 'PAS', 'DRI', 'DEF', 'FÍS'], offsets: [-2, -3, 4, 3, -20, -6] },
    ZAG: { labels: ['RIT', 'FIN', 'PAS', 'DRI', 'DEF', 'FÍS'], offsets: [-10, -40, -15, -18, 4, 3] },
    GOL: { labels: ['ELA', 'MAN', 'CHU', 'REF', 'VEL', 'POS'], offsets: [2, 0, -10, 3, -35, 1] },
  };

  /**
   * Atributos da cartinha de fim de carreira, no estilo das cartas do FIFA.
   * Partem do overall máximo e da posição; finalização e passe sobem com gols e
   * assistências por jogo. Uma variação fixa por nome deixa cada carta única.
   * @returns {{ovr: number, labels: string[], values: number[]}}
   */
  function cardStats() {
    const p = G.p;
    const profile = CARD_PROFILES[p.pos];
    const random = Util.seeded(p.name + p.pos);
    const games = Math.max(1, G.career.games + G.nat.caps);
    const goalsPerGame = (G.career.goals + G.nat.goals) / games;
    const assistsPerGame = (G.career.assists + G.nat.assists) / games;
    const values = profile.offsets.map((offset, i) => {
      let v = p.peak + offset + Math.round(random() * 6 - 3);
      if (p.pos !== 'GOL' && i === 1) v += clamp(Math.round((goalsPerGame - 0.45) * 10), -3, 4);
      if (p.pos !== 'GOL' && i === 2) v += clamp(Math.round((assistsPerGame - 0.2) * 12), -3, 4);
      return clamp(v, 25, 99);
    });
    return { ovr: p.peak, labels: profile.labels, values };
  }

  return {
    cardStats, BONUS, TRAININGS, addOverall, titleBonus, applyEffects, applyTraining, naturalGrowth, leagueAchievements,
    countTitles, balloons, kingChecklist, legacyTier, gamesByClub, records,
  };
})();
