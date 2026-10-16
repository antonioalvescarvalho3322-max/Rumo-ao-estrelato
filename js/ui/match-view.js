/**
 * @file Telas das partidas interativas (abertura, lances, pênaltis, faltas e resultado)
 * e o cartão-resumo dos jogos rápidos. Só desenha: as regras ficam em js/engine/match.js.
 */
'use strict';

/** Namespace das telas de partida. */
const MatchView = (() => {
  const { esc } = Util;

  /**
   * Cabeçalho com competição e fase.
   * @param {Object} M Partida.
   * @returns {string} HTML.
   */
  function head(M) {
    return `<div class="comp"><span>${esc(M.comp)}</span><b>${esc(M.stage)}</b></div>`;
  }

  /**
   * Placar com os nomes (e escudos, quando houver).
   * @param {Object} M Partida.
   * @param {number|null} min Minuto mostrado (null = antes do jogo; acima de 120 = placar final).
   * @returns {string} HTML.
   */
  function scoreboard(M, min) {
    const [a, b] = Match.scoreAt(min);
    /** Bloco de um time no placar: escudo (se houver), bandeira e nome. */
    const team = (name, clubName, flag) => `<div class="team">${clubName ? UI.crest(clubName, 'crest-md') : ''}<span>${flag ? `${flag} ` : ''}${esc(name)}</span></div>`;
    return `<div class="scoreboard">
      ${team(M.ourName, M.ourClub)}
      <div class="score"><b>${a}</b><span>:</span><b>${b}</b></div>
      ${team(M.opp.n, M.opp.club, M.opp.flag)}
      ${min !== null && min <= 120 ? `<div class="minute">${min}'</div>` : ''}
    </div>`;
  }

  /**
   * Placar da disputa de pênaltis, com as bolinhas de cada cobrança.
   * @param {Object} M Partida.
   * @returns {string} HTML.
   */
  function shootoutBoard(M) {
    const sh = M.sh;
    /** Bolinhas das cobranças: verde = gol, vermelha = perdeu. */
    const dots = list => list.map(x => `<i class="${x ? 'in' : 'out'}"></i>`).join('') || '<i></i>';
    return `${scoreboard(M, 999)}
      <div class="pens"><div>${dots(sh.us)}</div><span>Pênaltis ${sh.us.filter(Boolean).length} : ${sh.them.filter(Boolean).length}</span><div>${dots(sh.them)}</div></div>`;
  }

  /**
   * Faixa com o resultado do lance anterior (consumida ao ser exibida).
   * @param {Object} M Partida.
   * @returns {string} HTML.
   */
  function flash(M) {
    if (!M.flash) return '';
    const f = M.flash;
    M.flash = null;
    return `<div class="flash ${f.ok ? 'ok' : 'bad'}"><b>${f.icon}</b><span>${f.text}</span></div>`;
  }

  /**
   * Linha que explica se o jogador começou jogando, entrou no segundo tempo ou ficou de fora.
   * @param {Object} M Partida.
   * @returns {string} HTML.
   */
  function lineup(M) {
    const p = G.p;
    if (M.unavailable) return `<div class="lineup bad">Você está ${p.injury > 0 ? 'lesionado' : 'suspenso'} e vai assistir da tribuna.</div>`;
    if (M.titular) return '<div class="lineup good">O técnico anunciou: você é <b>titular</b>.</div>';
    if (M.sub) return '<div class="lineup mid">Você começa no <b>banco</b>, mas entra no segundo tempo.</div>';
    return '<div class="lineup bad">Você ficou no banco e <b>não entrou</b>.</div>';
  }

  /**
   * Etiqueta de risco de uma opção (sem números): Seguro, Moderado ou Arriscado.
   * @param {number} chance Chance interna da opção.
   * @returns {string} HTML.
   */
  function riskTag(chance) {
    if (chance >= 0.6) return '<em class="risk safe">Seguro</em>';
    if (chance >= 0.33) return '<em class="risk mid">Moderado</em>';
    return '<em class="risk hard">Arriscado</em>';
  }

  /**
   * Faixa do lance: no jogo rápido avisa que é um lance decisivo; na final mostra o favoritismo.
   * Em ambos mostra se o jogador é titular e oferece simular o resto da partida.
   * @param {Object} M Partida.
   * @returns {string} HTML.
   */
  function banner(M) {
    const status = M.titular ? 'Titular' : 'Entrou no 2º tempo';
    const diff = M.opp.s - M.ourStr;
    const favorite = diff > 4 ? 'adversário favorito' : diff < -4 ? 'seu time é favorito' : 'jogo equilibrado';
    const label = M.quick ? 'Lance decisivo' : `Final · ${favorite}`;
    return `<div class="quick-banner"><span>${label}</span><b>${status}</b><button class="link" data-act="match-sim">Simular</button></div>`;
  }

  /**
   * Lance comum com as opções e o risco de cada uma.
   * @param {Object} M Partida.
   * @param {Object} m Lance atual.
   * @param {string} text Descrição da situação.
   */
  function moment(M, m, text) {
    UI.render(`
      <section class="panel match">
        ${head(M)}
        ${scoreboard(M, m.min)}
        ${banner(M)}
        ${flash(M)}
        <p class="situation">${text}</p>
        <div class="opts">
          ${m.opts.map((o, i) => `<button class="opt" data-act="moment" data-arg="${i}"><span>${o.label}</span>${riskTag(o.p)}</button>`).join('')}
        </div>
      </section>`);
  }

  /**
   * Gol dividido em zonas clicáveis.
   * @param {string} action Ação de cada zona ('shoot' ou 'dive').
   * @param {string[]} labels Rótulos das zonas.
   * @param {boolean} [three] true para 3 colunas de altura inteira (goleiro).
   * @returns {string} HTML.
   */
  function goal(action, labels, three = false) {
    return `<div class="goal"><div class="net${three ? ' three' : ''}">
      ${labels.map((label, i) => `<button class="zone" data-act="${action}" data-arg="${i}"><span>${label}</span></button>`).join('')}
    </div><div class="grass"></div></div>`;
  }

  /**
   * Cobrança de pênalti (no jogo ou na disputa).
   * @param {Object} M Partida.
   * @param {Object} m Lance de pênalti.
   */
  function penalty(M, m) {
    const fav = m.tend[0] > m.tend[2] ? 0 : 2;
    UI.render(`
      <section class="panel match">
        ${head(M)}
        ${m.shootout ? shootoutBoard(M) : scoreboard(M, m.min)}
        ${m.shootout ? '' : banner(M)}
        ${flash(M)}
        <p class="situation">${m.shootout ? '<b>Disputa de pênaltis.</b> Você bate a cobrança decisiva.' : '<b>Pênalti!</b> Você pega a bola e coloca na marca.'} Escolha o canto.</p>
        <p class="tip">Analista: o goleiro pulou para a <b>${Match.SIDE[fav]}</b> em ${Math.round(m.tend[fav] * 10)} dos últimos 10 pênaltis.</p>
        ${goal('shoot', Match.ZONES)}
      </section>`);
  }

  /**
   * Cobrança de falta.
   * @param {Object} M Partida.
   * @param {Object} m Lance de falta.
   * @param {string[]} labels Rótulos das zonas.
   */
  function freekick(M, m, labels) {
    UI.render(`
      <section class="panel match">
        ${head(M)}
        ${scoreboard(M, m.min)}
        ${banner(M)}
        ${flash(M)}
        <p class="situation"><b>Falta ${m.far ? 'de longe, a 30 metros' : 'na entrada da área'}.</b> A barreira fecha o lado esquerdo e o goleiro cobre o direito.</p>
        ${goal('shoot', labels)}
        <div class="opts"><button class="opt" data-act="shoot" data-arg="-1"><span>Cruzar na área para o cabeceio</span><i class="arrow">→</i></button></div>
      </section>`);
  }

  /**
   * Goleiro defendendo pênalti.
   * @param {Object} M Partida.
   * @param {Object} m Lance de pênalti contra.
   */
  function penaltyDefense(M, m) {
    const fav = m.kw[0] + m.kw[3] > m.kw[2] + m.kw[5] ? 0 : 2;
    UI.render(`
      <section class="panel match">
        ${head(M)}
        ${m.shootout ? shootoutBoard(M) : scoreboard(M, m.min)}
        ${m.shootout ? '' : banner(M)}
        ${flash(M)}
        <p class="situation"><b>Pênalti contra!</b> ${m.shootout ? 'É a cobrança decisiva da disputa.' : ''} Para que lado você vai pular?</p>
        <p class="tip">Preparador de goleiros: esse batedor costuma bater na <b>${Match.SIDE[fav]}</b>.</p>
        ${goal('dive', ['Pular à esquerda', 'Ficar no meio', 'Pular à direita'], true)}
      </section>`);
  }

  /**
   * Empate na final: chamada para a disputa de pênaltis.
   * @param {Object} M Partida.
   */
  function shootoutPrompt(M) {
    UI.render(`
      <section class="panel match">
        ${head(M)}
        ${scoreboard(M, 90)}
        ${flash(M)}
        <p class="situation">Empate no tempo normal e na prorrogação. A decisão vai para os <b>pênaltis</b>.</p>
        <button class="btn big" data-act="shootout">Ir para os pênaltis</button>
      </section>`);
  }

  /**
   * Tela de resultado das finais.
   * @param {Object} M Partida.
   * @param {{win: boolean, rating: number|null, message: string, chips: Chip[]}} summary Resumo.
   */
  function result(M, summary) {
    const { win, rating, message, chips } = summary;
    UI.render(`
      <section class="panel match">
        ${head(M)}
        ${scoreboard(M, 999)}
        ${M.penScore ? `<p class="center">Pênaltis <b>${M.penScore}</b></p>` : ''}
        ${flash(M)}
        <h2 class="result ${win ? 'w' : 'l'}">${win ? 'Vitória' : 'Derrota'}</h2>
        ${message ? `<p class="big-msg">${message}</p>` : ''}
        ${rating !== null
          ? `<div class="rating"><div class="r ${rating >= 7.5 ? 'hi' : rating >= 6.5 ? 'mid' : 'lo'}">${rating.toFixed(1)}</div><div>Sua nota<br><small>${Util.plural(M.goals, 'gol', 'gols')} · ${Util.plural(M.assists, 'assistência', 'assistências')}${M.red ? ' · expulso' : ''}</small></div></div>`
          : lineup(M)}
        ${M.log.length ? `<ul class="log">${M.log.map(l => `<li>${l}</li>`).join('')}</ul>` : ''}
        ${UI.chips(chips)}
        <button class="btn big" data-act="next">Continuar</button>
      </section>`);
  }

  /**
   * Cartão-resumo de um jogo rápido, exibido no topo da próxima tela.
   * @param {Object} M Partida.
   * @param {{win: boolean, rating: number|null, message: string, chips: Chip[]}} summary Resumo.
   * @returns {Object} Item do resumo (feed).
   */
  function card(M, summary) {
    const narrative = M.flash ? M.flash.text : (M.playing ? '' : M.unavailable ? 'Você não jogou (lesão ou suspensão).' : 'Você ficou no banco.');
    return {
      kind: 'match',
      comp: M.comp,
      stage: M.stage,
      ourName: M.ourName,
      ourClub: M.ourClub || null,
      oppName: `${M.opp.flag ? `${M.opp.flag} ` : ''}${M.opp.n}`,
      oppClub: M.opp.club || null,
      us: M.us,
      them: M.them,
      pens: M.penScore || null,
      win: summary.win,
      rating: summary.rating,
      narrative,
      message: summary.message,
      chips: summary.chips,
    };
  }

  return { moment, penalty, freekick, penaltyDefense, shootoutPrompt, result, card };
})();
