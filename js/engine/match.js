/**
 * @file Partidas de mata-mata jogadas lance a lance.
 *
 * Dois formatos:
 *   - rápido (oitavas, quartas e semifinal): um lance decisivo; o resultado aparece no resumo
 *     da tela seguinte. Se o jogador não entrar em campo, o jogo é só simulado.
 *   - completo (finais): dois lances, pênaltis interativos e tela de resultado.
 * Nos dois formatos, se o jogador não entrar em campo, o jogo é simulado direto.
 *
 * As telas ficam em js/ui/match-view.js; aqui ficam só as regras.
 */
'use strict';

/**
 * Configuração de uma partida.
 * @typedef {Object} MatchConfig
 * @property {'club'|'nat'|'youth'} kind Tipo (define estatísticas e titularidade).
 * @property {string} comp Competição.
 * @property {string} stage Fase (ex.: 'Oitavas de final').
 * @property {boolean} quick Formato rápido (um lance) ou completo.
 * @property {string} ourName Nome do time do jogador.
 * @property {number} ourStr Força do time do jogador.
 * @property {string} [ourClub] Clube do jogador (para o escudo).
 * @property {{n: string, s: number, flag?: string, club?: string}} opp Adversário.
 * @property {boolean|null} home Mando de campo (null = neutro).
 * @property {(res: {us: number, them: number, win: boolean}) => string} onEnd Chamado no fim; devolve uma mensagem.
 */

/** Namespace das partidas interativas. */
const Match = (() => {
  const { clamp, rnd, randInt, poisson, weighted, pick } = Util;

  /** Partida em andamento (não é salva: ao retomar o jogo, a partida recomeça). */
  let M = null;

  /** Tipos de lance de cada posição. */
  const MOMENTS = {
    ATA: ['one_on_one', 'header', 'edge', 'counter'],
    MEI: ['through', 'long_shot', 'dribble', 'counter'],
    ZAG: ['tackle', 'corner_header', 'cover', 'build'],
    GOL: ['save', 'cross', 'gk_one', 'distribution'],
  };

  /**
   * Descrição de cada lance: texto e opções.
   * Cada opção: [texto, chance base, quanto o overall soma, resultado se der certo, marca, resultado se der errado].
   * Resultados: goal, assist, block, save, safe, flair, freekick | miss, concede, chance, foul.
   */
  const MOMENT_DEFS = {
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

  /** Textos de lance que deu certo. */
  const WIN_TEXT = {
    goal: 'GOL! Você balançou a rede!',
    golaço: 'GOLAÇO! Que pintura!',
    assist: 'Assistência perfeita! Seu companheiro empurrou para a rede.',
    block: 'Desarme perfeito! Você salvou o time.',
    save: 'Defesaça! Você fechou o gol.',
    safe: 'Jogada segura, o time mantém a posse.',
    flair: 'Que categoria! Você deixou o atacante no chão e saiu jogando.',
    freekick: 'Falta marcada em posição perigosa!',
  };

  /** Zonas do gol (3 colunas × 2 alturas). */
  const ZONES = ['Alto esquerdo', 'Alto centro', 'Alto direito', 'Baixo esquerdo', 'Baixo centro', 'Baixo direito'];
  /** Rótulos das zonas na cobrança de falta. */
  const FREEKICK_ZONES = ['Ângulo sobre a barreira', 'Por cima, no meio', 'Ângulo do goleiro', 'Na barreira', 'Por baixo da barreira', 'Rasteiro no canto do goleiro'];
  /** Lados (índice da coluna). */
  const SIDE = ['esquerda', 'meio', 'direita'];

  /** @returns {Object|null} A partida em andamento. */
  const current = () => M;

  /**
   * Habilidade do jogador de 0 a 1 (overall 50 → 0, overall 95 → 1).
   * @returns {number}
   */
  const skill = () => clamp((G.p.ovr - 50) / 45, 0, 1);

  /**
   * Chance real de uma opção de lance dar certo (não é mostrada ao jogador).
   * @param {number} base Chance mínima.
   * @param {number} range Quanto a habilidade soma.
   * @returns {number}
   */
  function optionChance(base, range) {
    const difficulty = (M.opp.s - M.eff) / 100 * 0.8;
    return clamp(base + skill() * range + Sim.moodTotal() - difficulty, 0.03, 0.97);
  }

  /**
   * Inicia uma partida de mata-mata.
   * @param {MatchConfig} cfg Configuração.
   */
  function start(cfg) {
    const p = G.p;
    const tc = Sim.titularChance(cfg.ourStr, cfg.kind);
    const titular = rnd() < tc;
    const sub = !titular && rnd() < Sim.subChance();
    M = {
      ...cfg,
      tc, titular, sub,
      unavailable: p.injury > 0 || p.suspended > 0,
      playing: titular || sub,
      us: 0, them: 0, goals: 0, assists: 0, rDelta: 0, red: false,
      log: [], idx: 0, auto: false, flash: null, extraUs: [], extraThem: [],
    };
    M.eff = Sim.effStr(cfg.ourStr, titular);
    const lu = Sim.lambda(M.eff, cfg.opp.s, cfg.home) * (M.playing ? 0.75 : 1);
    const lt = Sim.lambda(cfg.opp.s, M.eff, cfg.home === null ? null : !cfg.home) * (M.playing ? 0.82 : 1);
    M.baseUs = Array.from({ length: poisson(lu) }, () => randInt(1, 90)).sort((a, b) => a - b);
    M.baseThem = Array.from({ length: poisson(lt) }, () => randInt(1, 90)).sort((a, b) => a - b);
    M.moments = M.playing ? buildMoments(titular, cfg.quick) : [];

    if (!M.playing) return finish(true);
    showCurrentMoment();
  }

  /**
   * Sorteia os lances do jogador na partida.
   * @param {boolean} titular Se começou jogando.
   * @param {boolean} quick Formato rápido (um lance).
   * @returns {Array<{type: string, min: number}>}
   */
  function buildMoments(titular, quick) {
    const pos = G.p.pos;
    const types = Util.shuffle(MOMENTS[pos]);
    const count = quick || !titular ? 1 : 2;
    const moments = types.slice(0, count).map(type => ({ type }));
    // Bola parada às vezes substitui um lance comum.
    let special = null;
    if (pos === 'GOL') special = rnd() < 0.3 ? 'pen_def' : null;
    else if (rnd() < { ATA: 0.3, MEI: 0.25, ZAG: 0.08 }[pos]) special = 'penalty';
    else if (rnd() < { ATA: 0.15, MEI: 0.25, ZAG: 0.06 }[pos]) special = 'freekick';
    if (special) moments[moments.length - 1] = { type: special };
    const lo = titular ? 4 : 60;
    const minutes = moments.map(() => randInt(lo, 89)).sort((a, b) => a - b);
    moments.forEach((m, i) => { m.min = minutes[i]; });
    return moments;
  }

  /**
   * Placar até um minuto.
   * @param {number|null} min Minuto (null = antes de começar).
   * @returns {[number, number]}
   */
  function scoreAt(min) {
    const limit = min === null ? 0 : min;
    /** Conta os gols de uma lista que aconteceram até o minuto limite. */
    const count = list => list.filter(m => m <= limit).length;
    return [count(M.baseUs) + count(M.extraUs), count(M.baseThem) + count(M.extraThem)];
  }

  /** Mostra o lance atual ou encerra a partida se não houver mais lances. */
  function showCurrentMoment() {
    if (M.red || M.idx >= M.moments.length) return finish(false);
    const m = M.moments[M.idx];
    if (m.type === 'penalty') {
      m.tend = m.tend || goalkeeperTendency();
      return MatchView.penalty(M, m);
    }
    if (m.type === 'freekick') {
      if (m.far === undefined) m.far = rnd() < 0.4;
      return MatchView.freekick(M, m, FREEKICK_ZONES);
    }
    if (m.type === 'pen_def') {
      m.kw = m.kw || kickerTendency();
      return MatchView.penaltyDefense(M, m);
    }
    prepareOptions(m);
    MatchView.moment(M, m, MOMENT_DEFS[m.type].text);
  }

  /**
   * Calcula as opções do lance (com a chance interna de cada uma).
   * @param {Object} m Lance.
   */
  function prepareOptions(m) {
    m.opts = MOMENT_DEFS[m.type].opts.map(o => ({
      label: o[0], p: optionChance(o[1], o[2]), win: o[3], tag: o[4], lose: o[5] || 'miss',
    }));
  }

  /**
   * Registra o resultado de um lance e segue para o próximo (ou para o fim do jogo).
   * @param {string} icon Ícone do resultado.
   * @param {boolean} ok Se foi bom para o time do jogador.
   * @param {string} text Narração.
   */
  function advance(icon, ok, text) {
    M.idx++;
    M.flash = { icon, ok, text };
    if (!M.auto) showCurrentMoment();
  }

  /**
   * Resolve a opção escolhida em um lance comum.
   * @param {number} i Índice da opção.
   */
  function chooseOption(i) {
    const m = M.moments[M.idx];
    const o = m.opts[i];
    const ok = rnd() < o.p;
    let text;
    let icon = ok ? '✓' : '✕';
    if (ok) {
      switch (o.win) {
        case 'goal':
          M.extraUs.push(m.min); M.goals++; M.rDelta += o.tag ? 1.4 : 1.1;
          text = o.tag ? WIN_TEXT.golaço : WIN_TEXT.goal; icon = '⚽';
          break;
        case 'assist': M.extraUs.push(m.min); M.assists++; M.rDelta += 0.7; text = WIN_TEXT.assist; break;
        case 'block': M.rDelta += 0.5; text = WIN_TEXT.block; break;
        case 'save': M.rDelta += o.tag ? 0.7 : 0.55; text = WIN_TEXT.save; break;
        case 'flair': M.rDelta += 0.6; text = WIN_TEXT.flair; break;
        case 'freekick':
          M.rDelta += 0.2; text = WIN_TEXT.freekick;
          M.moments.splice(M.idx + 1, 0, { type: 'freekick', min: Math.min(90, m.min + 1) });
          break;
        default: M.rDelta += 0.15; text = WIN_TEXT.safe;
      }
    } else {
      switch (o.lose) {
        case 'concede': M.extraThem.push(m.min); M.rDelta -= 0.6; text = 'Você falhou e o adversário marcou.'; break;
        case 'chance':
          M.rDelta -= 0.35;
          if (rnd() < 0.5) { M.extraThem.push(m.min); text = 'Você falhou e o adversário aproveitou: gol deles.'; } else text = 'Você falhou, mas o adversário desperdiçou. Ufa!';
          break;
        case 'foul': {
          M.rDelta -= 0.5;
          const r = rnd();
          if (r < 0.18) {
            M.red = true; M.rDelta -= 1.2; text = 'Chegou atrasado no carrinho: cartão vermelho! Você foi expulso.';
            M.extraThem.push(Math.min(90, m.min + randInt(1, 8)));
          } else if (r < 0.5) { M.extraThem.push(m.min); text = 'Chegou atrasado: pênalti para o adversário, e gol.'; } else text = 'Chegou atrasado e levou amarelo, mas o perigo passou.';
          break;
        }
        default: M.rDelta -= 0.25; text = 'Não deu, a chance foi desperdiçada.';
      }
    }
    M.log.push(`${m.min}' · ${o.label} · ${ok ? 'deu certo' : 'não deu'}`);
    advance(icon, ok, `${m.min}' · ${text}`);
  }

  // ---------------- Pênaltis e faltas ----------------

  /**
   * Para que lado o goleiro adversário costuma pular: [esquerda, fica, direita].
   * @returns {number[]}
   */
  function goalkeeperTendency() {
    const side = rnd() < 0.5 ? 0 : 2;
    const t = [0.4, 0.2, 0.4];
    const skew = 0.15 + rnd() * 0.15;
    t[side] += skew;
    t[2 - side] -= skew;
    return t;
  }

  /**
   * Onde o batedor adversário costuma bater: peso de cada uma das 6 zonas.
   * @returns {number[]}
   */
  function kickerTendency() {
    const side = rnd() < 0.5 ? 0 : 2;
    const w = [0.12, 0.08, 0.12, 0.25, 0.18, 0.25];
    w[side] += 0.08; w[side + 3] += 0.08; w[2 - side] -= 0.06; w[5 - side] -= 0.10;
    return w;
  }

  /**
   * Chance de o goleiro defender quando pula para um lado e a bola vai para uma zona.
   * @param {number} dive Lado do pulo (0, 1, 2).
   * @param {number} zone Zona (0-5).
   * @returns {number}
   */
  function saveChance(dive, zone) {
    const col = zone % 3;
    const top = zone < 3;
    if (col === dive) return col === 1 ? (top ? 0.45 : 0.85) : (top ? 0.2 : 0.65);
    if (col === 1) return top ? 0.05 : 0.08;
    return 0.02;
  }

  /**
   * Chance de acertar o gol batendo em uma zona.
   * @param {number} zone Zona (0-5).
   * @param {number} [pressure] Pressão extra (disputa de pênaltis).
   * @returns {number}
   */
  function penaltyAccuracy(zone, pressure = 0) {
    return clamp([0.80, 0.90, 0.80, 0.92, 0.97, 0.92][zone] + skill() * 0.07 + Sim.moodTotal() * 0.3 - pressure, 0.4, 0.995);
  }

  /**
   * Chance de gol por zona, considerando a tendência do goleiro.
   * @param {number[]} tend Tendência do goleiro.
   * @param {number} [pressure] Pressão extra.
   * @returns {number[]}
   */
  function penaltyChances(tend, pressure = 0) {
    return [0, 1, 2, 3, 4, 5].map(z => penaltyAccuracy(z, pressure) * (1 - tend.reduce((s, t, d) => s + t * saveChance(d, z), 0)));
  }

  /**
   * Chance de gol de falta por zona.
   * @param {boolean} far Falta de longe.
   * @returns {number[]}
   */
  function freekickChances(far) {
    const sk = skill();
    const md = Sim.moodTotal();
    const base = [0.22, 0.06, 0.13, 0.03, 0.12, 0.07];
    return base.map(b => clamp((b + sk * 0.12 * (b > 0.05 ? 1 : 0.3) + md * 0.3) * (far ? 0.6 : 1) - (M.opp.s - M.eff) / 300, 0.01, 0.6));
  }

  /**
   * Chance de o goleiro (jogador) defender pulando para cada lado.
   * @param {number[]} kickW Tendência do batedor.
   * @returns {number[]}
   */
  function defenseChances(kickW) {
    const sk = skill();
    const md = Sim.moodTotal();
    const acc = [0.80, 0.90, 0.80, 0.92, 0.97, 0.92];
    return [0, 1, 2].map(d => clamp(kickW.reduce((s, w, z) => s + w * ((1 - acc[z]) + acc[z] * saveChance(d, z) * (0.8 + sk * 0.5 + md)), 0), 0.03, 0.9));
  }

  /**
   * Cobra o pênalti ou a falta em uma zona (-1 = cruzar a falta na área).
   * @param {number} zone Zona escolhida.
   */
  function shoot(zone) {
    const m = M.moments[M.idx];
    let ok;
    let text;
    if (m.type === 'penalty') {
      const dive = weighted([0, 1, 2], d => m.tend[d]);
      const onTarget = rnd() < penaltyAccuracy(zone, m.pressure || 0);
      const saved = onTarget && rnd() < saveChance(dive, zone);
      ok = onTarget && !saved;
      const where = ZONES[zone].toLowerCase();
      const diveText = dive === 1 ? 'ficou parado no meio' : `pulou para a ${SIDE[dive]}`;
      if (!onTarget) text = `Você bateu no ${where} e a bola foi para fora!`;
      else if (saved) text = `Você bateu no ${where}, o goleiro ${diveText} e defendeu.`;
      else text = `Você bateu no ${where}, o goleiro ${diveText}. GOL!`;
      M.log.push(`${m.shootout ? 'Pênaltis' : `${m.min}'`} · Pênalti no ${where} · ${ok ? 'gol' : 'perdeu'}`);
    } else if (zone === -1) {
      ok = rnd() < clamp(0.16 + skill() * 0.12 + Sim.moodTotal(), 0.05, 0.5);
      text = ok ? 'Cruzamento na medida e o zagueiro cabeceou para o gol. Assistência!' : 'O goleiro saiu e cortou o cruzamento.';
      M.log.push(`${m.min}' · Falta cruzada · ${ok ? 'assistência' : 'cortada'}`);
    } else {
      ok = rnd() < freekickChances(m.far)[zone];
      const where = ZONES[zone].toLowerCase();
      text = ok ? `Cobrança no ${where}: GOLAÇO DE FALTA!` : pick(['A bola explodiu na barreira.', 'O goleiro se esticou todo e espalmou.', 'Passou raspando a trave!']);
      M.log.push(`${m.min}' · Falta no ${where} · ${ok ? 'gol' : 'não entrou'}`);
    }
    if (m.shootout) return afterShootoutKick(ok, text);
    if (ok) {
      M.extraUs.push(m.min);
      if (m.type === 'freekick' && zone === -1) { M.assists++; M.rDelta += 0.7; } else { M.goals++; M.rDelta += m.type === 'freekick' ? 1.5 : 0.9; }
    } else {
      M.rDelta -= m.type === 'penalty' ? 0.7 : 0.15;
    }
    advance(ok ? '⚽' : '✕', ok, `${m.min}' · ${text}`);
  }

  /**
   * Goleiro: pula para um lado no pênalti do adversário.
   * @param {number} side 0 = esquerda, 1 = meio, 2 = direita.
   */
  function dive(side) {
    const m = M.moments[M.idx];
    const zone = weighted([0, 1, 2, 3, 4, 5], i => m.kw[i]);
    const acc = [0.80, 0.90, 0.80, 0.92, 0.97, 0.92][zone];
    const onTarget = rnd() < acc;
    const saved = onTarget && rnd() < clamp(saveChance(side, zone) * (0.8 + skill() * 0.5 + Sim.moodTotal()), 0, 0.97);
    const ok = !onTarget || saved;
    const where = ZONES[zone].toLowerCase();
    let text;
    if (!onTarget) text = `O batedor mandou no ${where}, para fora!`;
    else if (saved) text = `Você pulou para a ${SIDE[side]} e defendeu a cobrança no ${where}!`;
    else text = `Você foi para a ${SIDE[side]}, mas ele bateu no ${where}. Gol deles.`;
    M.log.push(`${m.shootout ? 'Pênaltis' : `${m.min}'`} · Pênalti contra · ${ok ? 'defendeu' : 'gol deles'}`);
    if (m.shootout) return afterShootoutKick(!ok, text);
    if (ok) M.rDelta += saved ? 1.0 : 0.2; else { M.extraThem.push(m.min); M.rDelta -= 0.2; }
    advance(ok ? '🧤' : '✕', ok, `${m.min}' · ${text}`);
  }

  /** Simula a partida escolhendo a melhor opção de cada lance (botão "Simular"). */
  function simulate() {
    M.auto = true;
    while (!M.red && M.idx < M.moments.length) {
      const m = M.moments[M.idx];
      if (m.type === 'penalty') {
        m.tend = m.tend || goalkeeperTendency();
        const ch = penaltyChances(m.tend);
        shoot(ch.indexOf(Math.max(...ch)));
      } else if (m.type === 'freekick') {
        if (m.far === undefined) m.far = rnd() < 0.4;
        const ch = freekickChances(m.far);
        shoot(ch.indexOf(Math.max(...ch)));
      } else if (m.type === 'pen_def') {
        m.kw = m.kw || kickerTendency();
        const ch = defenseChances(m.kw);
        dive(ch.indexOf(Math.max(...ch)));
      } else {
        prepareOptions(m);
        const value = { goal: 1, assist: 0.85, block: 1, save: 1, flair: 0.5, freekick: 0.5, safe: 0.25 };
        let best = 0;
        let bestValue = -1;
        m.opts.forEach((o, i) => {
          const v = o.p * (value[o.win] || 0.3);
          if (v > bestValue) { bestValue = v; best = i; }
        });
        chooseOption(best);
      }
    }
    finish(true);
  }

  // ---------------- Disputa de pênaltis ----------------

  /**
   * Verifica se a disputa de pênaltis já está decidida.
   * @param {{us: boolean[], them: boolean[]}} sh Cobranças de cada lado (true = gol).
   * @returns {boolean}
   */
  function shootoutDecided(sh) {
    const ug = sh.us.filter(Boolean).length;
    const tg = sh.them.filter(Boolean).length;
    if (sh.us.length <= 5 && sh.them.length <= 5 && !(sh.us.length === 5 && sh.them.length === 5)) {
      return ug + (5 - sh.us.length) < tg || tg + (5 - sh.them.length) < ug;
    }
    return sh.us.length === sh.them.length && ug !== tg;
  }

  /**
   * Começa a disputa de pênaltis. Na final, se o jogador estiver em campo, ele bate
   * (ou defende, se for goleiro) a quinta cobrança.
   */
  function startShootout() {
    const interactive = !M.quick && !M.auto && M.playing && !M.red;
    M.sh = { us: [], them: [], hook: interactive ? (G.p.pos === 'GOL' ? 'save' : 'kick') : null, done: false };
    continueShootout();
  }

  /** Continua a disputa até alguém vencer, parando na cobrança do jogador. */
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
        if (usTurn) {
          m.tend = goalkeeperTendency();
          return MatchView.penalty(M, m);
        }
        m.kw = kickerTendency();
        return MatchView.penaltyDefense(M, m);
      }
      if (usTurn) sh.us.push(rnd() < pUs); else sh.them.push(rnd() < pThem);
    }
    M.penWin = sh.us.filter(Boolean).length > sh.them.filter(Boolean).length;
    M.penScore = `${sh.us.filter(Boolean).length} : ${sh.them.filter(Boolean).length}`;
    conclude();
  }

  /**
   * Registra a cobrança do jogador na disputa e continua.
   * @param {boolean} scored Se a cobrança terminou em gol (de qualquer lado).
   * @param {string} text Narração.
   */
  function afterShootoutKick(scored, text) {
    const sh = M.sh;
    const m = M.moments[M.idx];
    if (m.type === 'penalty') { sh.us.push(scored); M.rDelta += scored ? 0.3 : -0.5; } else { sh.them.push(scored); M.rDelta += scored ? -0.1 : 0.6; }
    M.idx = M.moments.length;
    const good = m.type === 'penalty' ? scored : !scored;
    M.flash = { icon: good ? '✓' : '✕', ok: good, text };
    continueShootout();
  }

  // ---------------- Fim de jogo ----------------

  /**
   * Fecha o tempo normal. Empate leva aos pênaltis (todo jogo aqui é mata-mata).
   * @param {boolean} auto Se a partida está sendo simulada.
   */
  function finish(auto) {
    const [a, b] = scoreAt(999);
    M.us = a;
    M.them = b;
    if (a !== b) return conclude();
    if (auto || M.quick || !M.playing || M.red) {
      M.auto = true;
      return startShootout();
    }
    MatchView.shootoutPrompt(M);
  }

  /**
   * Encerra a partida: nota, efeitos nos medidores, estatísticas e consequências na competição.
   * No formato rápido, o resultado vai para o resumo da próxima tela.
   */
  function conclude() {
    const p = G.p;
    const { us, them } = M;
    const win = us > them || (us === them && M.penWin === true);
    const before = { ovr: p.ovr, form: p.form, coach: p.coach, chem: p.chem, fans: p.fans };
    let rating = null;

    if (M.playing) {
      let r = (M.titular ? 6.3 : 6.0) + M.rDelta + (win ? 0.3 : -0.3) + rnd() * 0.4 - 0.2;
      if (p.pos === 'GOL') r += them === 0 ? 0.6 : -them * 0.15;
      if (p.pos === 'ZAG') r += them === 0 ? 0.3 : -them * 0.1;
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
    recordStats(rating);

    const message = M.onEnd({ us, them, win }) || '';
    G.cur.done = true;
    Season.checkCallup();

    const chips = [];
    const ovrGain = p.ovr - before.ovr;
    if (ovrGain) chips.push({ text: `Overall ${Util.signed(ovrGain)}`, tone: ovrGain > 0 ? 'up' : 'down' });
    for (const [key, label] of [['form', 'Fase'], ['coach', 'Técnico'], ['chem', 'Elenco'], ['fans', 'Torcida']]) {
      const v = Math.round(p[key] - before[key]);
      if (v) chips.push({ text: `${label} ${Util.signed(v)}`, tone: v > 0 ? 'up' : 'down' });
    }
    const summary = { win, rating, message, chips };
    if (M.quick) {
      G.feed.push(MatchView.card(M, summary));
      M = null;
      Season.next();
      return;
    }
    MatchView.result(M, summary);
    M = null;
    Store.save();
  }

  /**
   * Soma os números da partida às estatísticas da temporada ou da seleção.
   * @param {number|null} rating Nota do jogador (null se não jogou).
   */
  function recordStats(rating) {
    if (M.kind === 'nat') {
      if (M.playing) { G.nat.caps++; G.nat.goals += M.goals; G.nat.assists += M.assists; }
      return;
    }
    if (M.kind !== 'club') return;
    const st = G.S.stats;
    st.possible++;
    if (!M.playing) return;
    st.games++;
    if (M.titular) st.starts++;
    st.goals += M.goals;
    st.assists += M.assists;
    st.rSum += rating;
    st.rN++;
    if (G.p.pos === 'GOL' && M.titular && M.them === 0) st.cleanSheets++;
  }

  return {
    current, start, scoreAt, chooseOption, shoot, dive, simulate, startShootout, ZONES, SIDE,
  };
})();
