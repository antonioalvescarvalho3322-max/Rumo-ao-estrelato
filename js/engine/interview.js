/**
 * @file Entrevistas coletivas: escolha da pergunta (sem repetir) e avaliação da resposta.
 *
 * A avaliação não usa sorte. Cada atitude de resposta (ANSWER_STYLES) combina três fatores:
 * relação com o elenco, relação com a torcida e os números da temporada.
 * A nota resultante (0-100) decide se a resposta funciona, divide opiniões ou dá errado.
 */
'use strict';

/** Namespace das entrevistas. */
const Interview = (() => {
  const { clamp, shuffle, weighted } = Util;
  const FACTOR_LABEL = { stats: 'Números', chem: 'Elenco', fans: 'Torcida' };

  /**
   * Nota dos números do jogador na temporada (0-100).
   * Atacantes e meias: gols e assistências por jogo, mais a nota média.
   * Zagueiros: nota média. Goleiros: jogos sem sofrer gol e nota média.
   * Com menos de 3 jogos, usa a fase como referência.
   * @returns {number}
   */
  function statsScore() {
    const p = G.p;
    const st = G.S.stats;
    if (st.games < 3 || !st.rN) return clamp(50 + (p.form - 50) * 0.5, 0, 100);
    const avg = st.rSum / st.rN;
    if (p.pos === 'GOL') return clamp(50 + (st.cleanSheets / st.games - 0.3) * 120 + (avg - 6.8) * 30, 0, 100);
    if (p.pos === 'ZAG') return clamp(50 + (avg - 6.8) * 55, 0, 100);
    const expected = p.pos === 'ATA' ? 0.55 : 0.4;
    const contribution = (st.goals + st.assists * 0.6) / st.games;
    return clamp(50 + (contribution / expected - 1) * 45 + (avg - 6.8) * 30, 0, 100);
  }

  /**
   * Classifica a nota dos números em palavras.
   * @param {number} score Nota de 0 a 100.
   * @returns {string}
   */
  function statsLabel(score) {
    if (score >= 65) return 'bons';
    if (score >= 45) return 'regulares';
    return 'fracos';
  }

  /**
   * Os três fatores que decidem o resultado das entrevistas, arredondados.
   * @returns {{stats: number, chem: number, fans: number}}
   */
  function factors() {
    return { stats: Math.round(statsScore()), chem: Math.round(G.p.chem), fans: Math.round(G.p.fans) };
  }

  /**
   * Situação atual usada para filtrar perguntas que fazem sentido.
   * @returns {InterviewContext}
   */
  function context() {
    const L = G.S && G.S.league;
    const hasTable = Boolean(L && L.played > 0);
    return {
      pos: hasTable ? Sim.myPos() : null,
      teams: L ? L.table.length : 20,
      age: G.p.age,
      ovr: G.p.ovr,
      fame: G.p.fame,
      fans: G.p.fans,
      called: G.nat.called,
    };
  }

  /**
   * Escolhe a próxima pergunta. Perguntas já feitas só voltam depois que todas as
   * possíveis no momento foram usadas. Perguntas ligadas à situação têm prioridade.
   * @returns {InterviewQuestion}
   */
  function pickQuestion() {
    const ctx = context();
    const eligible = INTERVIEW_QUESTIONS.filter(q => !q.when || q.when(ctx));
    let fresh = eligible.filter(q => !G.usedQuestions.includes(q.id));
    if (!fresh.length) {
      G.usedQuestions = G.usedQuestions.filter(id => !eligible.some(q => q.id === id));
      fresh = eligible;
    }
    const question = weighted(fresh, q => (q.when ? 2 : 1));
    G.usedQuestions.push(question.id);
    return question;
  }

  /**
   * Sorteia uma entrevista e guarda no item da agenda (pergunta e ordem das respostas),
   * para que a mesma entrevista apareça se o jogo for retomado.
   * @param {AgendaItem} item Item da agenda do tipo 'interview'.
   */
  function prepare(item) {
    const question = pickQuestion();
    item.qid = question.id;
    item.order = shuffle(question.answers.map((_, i) => i));
  }

  /**
   * Respostas na ordem em que aparecem na tela.
   * @param {AgendaItem} item Item preparado por prepare().
   * @returns {InterviewAnswer[]}
   */
  function answersOf(item) {
    const question = INTERVIEW_QUESTIONS.find(q => q.id === item.qid);
    return item.order.map(i => question.answers[i]);
  }

  /**
   * Monta a tela de escolha da entrevista no mesmo formato dos eventos.
   * @param {AgendaItem} item Item preparado por prepare().
   * @returns {CareerEvent & {factors: Object}}
   */
  function toEvent(item) {
    const question = INTERVIEW_QUESTIONS.find(q => q.id === item.qid);
    return {
      id: 'interview', icon: 'mic',
      title: 'Entrevista coletiva',
      text: `Um repórter pergunta: <b>“${question.question}”</b>`,
      factors: factors(),
      options: answersOf(item).map(a => ({ label: `“${a.label}”` })),
    };
  }

  /**
   * Avalia a resposta escolhida combinando elenco, torcida e números com os pesos da atitude.
   * @param {InterviewAnswer} answer Resposta escolhida.
   * @returns {{tier: 'good'|'mid'|'bad', text: string, fx: Effects, reason: string, styleName: string, factors: Object, score: number}}
   */
  function evaluate(answer) {
    const style = ANSWER_STYLES[answer.style];
    const f = factors();
    const w = style.weights;
    const score = w.stats * f.stats + w.chem * f.chem + w.fans * f.fans;
    const tier = score >= style.good ? 'good' : score >= style.mid ? 'mid' : 'bad';
    const text = tier === 'good' ? answer.good : tier === 'bad' ? answer.bad : (answer.mid || INTERVIEW_MID_TEXT);
    const keys = ['stats', 'chem', 'fans'];
    /** Descreve um fator em palavras, ex.: "Números bons (72)" ou "Torcida 40". */
    const describe = k => (k === 'stats' ? `Números ${statsLabel(f.stats)} (${f.stats})` : `${FACTOR_LABEL[k]} ${f[k]}`);
    let reason;
    if (tier === 'good') {
      const best = keys.reduce((a, b) => (w[b] * (f[b] - 50) > w[a] * (f[a] - 50) ? b : a));
      reason = `O que pesou a favor: ${describe(best)}.`;
    } else if (tier === 'bad') {
      const worst = keys.reduce((a, b) => (w[b] * (60 - f[b]) > w[a] * (60 - f[a]) ? b : a));
      reason = `O que pesou contra: ${describe(worst)}.`;
    } else {
      reason = 'Seu momento não foi forte o bastante para convencer todo mundo.';
    }
    return { tier, text, fx: style.fx[tier], reason, styleName: style.name, factors: f, score: Math.round(score) };
  }

  return { statsScore, statsLabel, factors, prepare, answersOf, toEvent, evaluate };
})();
