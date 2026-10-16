/**
 * @file Ponto de entrada do jogo. Liga os cliques da página às ações (atributo data-act)
 * e abre a tela inicial. É o último script carregado pelo index.html.
 */
'use strict';

/**
 * Ações disparadas pelos botões. A chave é o valor de data-act; o argumento vem de data-arg.
 * @type {Object<string, (arg?: string) => void>}
 */
const ACTIONS = {
  // Início e criação do jogador
  start: () => Screens.nationPicker(),
  continue: () => Season.resume(),
  nation: id => Screens.pickNation(id),
  state: uf => Screens.pickState(uf),
  club: i => Screens.pickClub(Number(i)),
  shirt: n => Screens.setShirt(n),
  create: () => Screens.create(),
  'back-nation': () => Screens.nationPicker(),
  'back-state': () => Screens.statePicker(),
  'back-club': () => Screens.clubPicker(),

  // Carreira
  next: () => Season.next(),
  choose: i => Season.choose(Number(i)),
  training: id => Season.chooseTraining(id),
  retire: () => Season.retire(),
  'offer-accept': i => Season.acceptOffer(Number(i)),
  'offer-negotiate': i => Season.negotiate(Number(i)),
  'offer-stay': () => Season.stay(),

  // Partida
  'match-sim': () => Match.simulate(),
  moment: i => Match.chooseOption(Number(i)),
  shoot: zone => Match.shoot(Number(zone)),
  dive: side => Match.dive(Number(side)),
  shootout: () => Match.startShootout(),

  // Fim de carreira
  copy: () => Screens.copySummary(),
  'new-career': () => {
    Store.clear();
    Screens.nationPicker();
  },
};

/** Momento da última troca de tela (para ignorar cliques duplos que cairiam na tela seguinte). */
let lastScreenChange = 0;

/**
 * Observa trocas de tela dentro de #app para registrar o horário.
 * @param {HTMLElement} app Elemento raiz do jogo.
 */
function watchScreenChanges(app) {
  new MutationObserver(() => { lastScreenChange = performance.now(); }).observe(app, { childList: true });
}

/**
 * Trata cliques em qualquer elemento com data-act.
 * Cliques logo após a troca de tela são ignorados para evitar escolhas acidentais.
 * @param {MouseEvent} event Evento de clique.
 */
function onClick(event) {
  const el = event.target.closest('[data-act]');
  if (!el) return;
  const action = ACTIONS[el.dataset.act];
  if (!action) return;
  event.preventDefault();
  if (performance.now() - lastScreenChange < 250) return;
  action(el.dataset.arg);
}

/**
 * Trata digitação em campos com data-input (número da camisa).
 * @param {InputEvent} event Evento de digitação.
 */
function onInput(event) {
  if (event.target.dataset && event.target.dataset.input === 'shirt') Screens.setShirt(event.target.value, true);
}

/**
 * Remove escudos cuja imagem não carregou (arquivo ausente ou sem internet).
 * @param {Event} event Evento de erro (capturado na fase de captura).
 */
function onImageError(event) {
  const el = event.target;
  if (el instanceof HTMLImageElement && el.classList.contains('crest')) el.remove();
}

/** Inicializa o jogo. */
function boot() {
  const app = document.getElementById('app');
  app.addEventListener('click', onClick);
  app.addEventListener('input', onInput);
  document.addEventListener('error', onImageError, true);
  watchScreenChanges(app);
  Screens.home();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
