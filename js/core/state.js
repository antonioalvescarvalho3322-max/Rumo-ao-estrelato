/**
 * @file Estado da carreira, criação de um novo jogador e persistência no navegador.
 *
 * Todo o progresso vive no objeto global G (GameState). Ele é salvo no localStorage
 * depois de cada passo da agenda, por isso o jogo pode ser fechado e retomado.
 */
'use strict';

/**
 * @typedef {Object} Player
 * @property {string} name Nome do jogador.
 * @property {string} nat Código do país de nascimento.
 * @property {string|null} uf Estado de nascimento (só para brasileiros).
 * @property {'GOL'|'ZAG'|'MEI'|'ATA'} pos Posição.
 * @property {string} shirt Número da camisa.
 * @property {number} age Idade.
 * @property {number} ovr Overall atual (inteiro, 35-99).
 * @property {number} peak Maior overall já atingido.
 * @property {number} pot Potencial: teto do crescimento natural (treinos e conquistas passam dele).
 * @property {number} form Fase (0-100).
 * @property {number} coach Relação com o técnico (0-100).
 * @property {number} chem Relação com o elenco (0-100).
 * @property {number} fans Relação com a torcida (0-100).
 * @property {number} fame Fama (0-100).
 * @property {number} money Patrimônio em mil euros.
 * @property {number} salary Salário anual em mil euros.
 * @property {number} injury Jogos restantes de lesão.
 * @property {number} suspended Jogos restantes de suspensão.
 */

/**
 * @typedef {Object} Club
 * @property {string} n Nome.
 * @property {number} s Força atual (oscila um pouco a cada temporada).
 * @property {number} b Força de referência.
 * @property {number} d Divisão (1 fora do Brasil).
 * @property {string} c Código do país.
 * @property {string} [uf] Estado (clubes brasileiros).
 */

/**
 * Item da agenda da temporada. O campo t indica o tipo (ver Season.HANDLERS).
 * @typedef {Object} AgendaItem
 * @property {string} t Tipo do passo.
 * @property {string} [stage] Fase do mata-mata.
 * @property {string} [id] Evento escolhido (para não sortear de novo ao retomar).
 * @property {Object} [view] Resultado já calculado (para não aplicar duas vezes ao retomar).
 */

/**
 * @typedef {Object} SeasonStats
 * @property {number} games Jogos disputados.
 * @property {number} possible Jogos do time na temporada.
 * @property {number} starts Jogos como titular.
 * @property {number} goals Gols na temporada.
 * @property {number} assists Assistências na temporada.
 * @property {number} leagueGoals Gols na liga.
 * @property {number} leagueAssists Assistências na liga.
 * @property {number} rSum Soma das notas.
 * @property {number} rN Quantidade de notas.
 * @property {number} cleanSheets Jogos sem sofrer gol (goleiro titular).
 */

/**
 * @typedef {Object} SeasonState
 * @property {SeasonStats} stats Números da temporada (clube).
 * @property {string[]} titles Títulos conquistados na temporada.
 * @property {Array<{reason: string, delta: number}>} ovrLog Mudanças de overall na temporada.
 * @property {number} titleBonus Overall já ganho com títulos na temporada (limite em Progression.BONUS).
 * @property {number} ovrStart Overall no início da temporada.
 * @property {number} benchRate Fração de jogos fora do time no último bloco.
 * @property {string[]} used Eventos já usados na temporada.
 * @property {number} moreOffers Bônus de propostas para a próxima janela.
 * @property {Object} [league] Tabela da liga.
 * @property {{name: string, alive: boolean}} [cup] Copa nacional.
 * @property {{type: string, name: string, alive: boolean}|null} [cont] Torneio continental.
 * @property {{goals: number, assists: number, teamGoals: number, teamAssists: number}} [marks]
 *   Marcas a superar para ser artilheiro/líder de assistências da liga e do time.
 */

/**
 * @typedef {Object} GameState
 * @property {number} v Versão do formato salvo.
 * @property {Player} p Jogador.
 * @property {Object<string, Club>} clubs Todos os clubes do jogo.
 * @property {string} club Clube atual.
 * @property {{parent: string}|null} loan Empréstimo em andamento.
 * @property {number} year Ano da temporada.
 * @property {'base'|'pro'} phase Fase da carreira.
 * @property {{called: boolean, caps: number, goals: number, assists: number, declinedYear: number|null}} nat Seleção.
 * @property {{games: number, goals: number, assists: number, rSum: number, rN: number, cleanSheets: number}} career Totais por clubes.
 * @property {Array<{name: string, year: number, club: string, kind: 'club'|'nat'|'youth'}>} titles Títulos.
 * @property {Array<{name: string, year: number}>} awards Prêmios individuais.
 * @property {Array<Object>} history Resumo de cada temporada.
 * @property {Array<{club: string, year: number, kind: string}>} path Clubes por onde passou.
 * @property {string[]} idolMet Clubes em que o ídolo já deu conselho.
 * @property {string[]} usedQuestions Perguntas de entrevista já feitas (evita repetição).
 * @property {string[]} recentEvents Últimos eventos de carreira (evita repetição).
 * @property {Object<string, string|null>} qual Vagas continentais conquistadas na temporada.
 * @property {Array<Object>} feed Resumo exibido no topo da próxima tela.
 * @property {AgendaItem[]} agenda Próximos passos da temporada.
 * @property {AgendaItem|null} cur Passo atual.
 * @property {string|null} pendingTraining Treino de pré-temporada escolhido.
 * @property {boolean} retired Se a carreira terminou.
 * @property {SeasonState} S Temporada atual.
 */

/** Estado da carreira em andamento (null enquanto nenhuma carreira foi criada). @type {GameState|null} */
let G = null;

/** Persistência no localStorage. */
const Store = (() => {
  const SAVE_KEY = 'rumo-ao-estrelato-v3';

  /** Salva o estado atual. Falhas (modo privado, armazenamento cheio) são ignoradas. */
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(G));
    } catch (e) { /* sem armazenamento disponível */ }
  }

  /**
   * Lê a carreira salva.
   * @returns {GameState|null}
   */
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /** Apaga a carreira salva. */
  function clear() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) { /* ignora */ }
  }

  return { save, load, clear };
})();

/**
 * Cria uma nova carreira a partir das escolhas da tela inicial e a coloca em G.
 * @param {{nat: string, uf: string|null, club: string, name: string, pos: string, shirt: string}} choices
 * @returns {GameState}
 */
function createCareer(choices) {
  const clubs = World.buildClubs();
  const base = clubs[choices.club];
  // Potencial: teto do crescimento natural. Clubes com mais estrutura formam mais.
  const pot = Util.clamp(Math.round(72 + Util.rnd() * 12 + Util.rnd() * 6 + (base.s - 60) / 6), 70, 92);
  const ovr = Util.randInt(48, 55);
  G = {
    v: 3,
    p: {
      name: choices.name, nat: choices.nat, uf: choices.uf, pos: choices.pos, shirt: choices.shirt,
      age: 16, ovr, peak: ovr, pot,
      form: 55, coach: 50, chem: 50, fans: 40, fame: 3,
      money: 0, salary: 5, injury: 0, suspended: 0,
    },
    clubs,
    club: choices.club,
    loan: null,
    year: 2027,
    phase: 'base',
    nat: { called: false, caps: 0, goals: 0, assists: 0, declinedYear: null },
    career: { games: 0, goals: 0, assists: 0, rSum: 0, rN: 0, cleanSheets: 0 },
    titles: [],
    awards: [],
    history: [],
    path: [{ club: choices.club, year: 2027, kind: 'base' }],
    idolMet: [],
    usedQuestions: [],
    recentEvents: [],
    qual: {},
    feed: [],
    agenda: [],
    cur: null,
    pendingTraining: null,
    retired: false,
    S: null,
  };
  return G;
}

/**
 * Cria o estado vazio de uma temporada.
 * @returns {SeasonState}
 */
function newSeasonState() {
  return {
    stats: { games: 0, possible: 0, starts: 0, goals: 0, assists: 0, leagueGoals: 0, leagueAssists: 0, rSum: 0, rN: 0, cleanSheets: 0 },
    titles: [],
    ovrLog: [],
    titleBonus: 0,
    ovrStart: G.p.ovr,
    benchRate: 0,
    used: [],
    moreOffers: 0,
  };
}
