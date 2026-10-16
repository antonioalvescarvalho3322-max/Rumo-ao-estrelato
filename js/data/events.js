/**
 * @file Eventos de carreira fora de campo (vida de jogador, base, conselho do ídolo e convocação).
 *
 * Nenhum evento usa porcentagem: cada opção tem uma consequência definida, que pode
 * depender do momento do jogador (fase, relação com elenco/torcida, overall etc.).
 * As entrevistas ficam em js/data/interviews.js.
 */
'use strict';

/**
 * Efeitos que uma escolha aplica ao jogador. Todos são opcionais.
 * Os valores de form, coach, chem, fans e fame somam ao medidor (0 a 100).
 * @typedef {Object} Effects
 * @property {number} [form] Fase.
 * @property {number} [coach] Relação com o técnico.
 * @property {number} [chem] Relação com o elenco.
 * @property {number} [fans] Relação com a torcida.
 * @property {number} [fame] Fama (influencia propostas e prêmios).
 * @property {number} [ovr] Pontos de overall.
 * @property {number} [pot] Pontos de potencial.
 * @property {number} [money] Dinheiro em mil euros (negativo = gasto).
 * @property {number} [moneyFame] Multiplicador de um ganho proporcional à fama (patrocínio).
 * @property {number} [injury] Jogos de lesão.
 * @property {number} [suspend] Jogos de suspensão.
 * @property {number} [coachSet] Define a relação com o técnico (novo técnico).
 * @property {number} [salaryMul] Multiplica o salário.
 * @property {number} [moreOffers] Aumenta as propostas na próxima janela.
 * @property {number} [callup] 1 = aceita a convocação para a seleção.
 * @property {number} [declineCallup] 1 = recusa a convocação neste ano.
 */

/**
 * @typedef {Object} ChoiceOption
 * @property {string} label Texto do botão.
 * @property {(G: GameState) => {text: string, fx: Effects}} outcome Consequência da escolha.
 */

/**
 * @typedef {Object} CareerEvent
 * @property {string} id Identificador único.
 * @property {'pro'|'youth'} [pool] Fase da carreira em que o evento pode aparecer.
 * @property {number} [weight] Peso no sorteio (maior = mais frequente).
 * @property {string} icon Chave do ícone (ver UI.ICONS).
 * @property {string} title Título do evento.
 * @property {string} text Descrição da situação (pode conter HTML simples).
 * @property {(G: GameState) => boolean} [when] Condição para o evento poder aparecer.
 * @property {ChoiceOption[]} options Opções de escolha.
 */

/** Eventos sorteados durante a temporada (um por temporada, nem sempre). @type {CareerEvent[]} */
const CAREER_EVENTS = [
  // ---------------- Vida de jogador ----------------
  {
    id: 'festa', pool: 'pro', weight: 3, icon: 'party',
    title: 'Convite para a festa',
    text: 'Um cantor famoso chamou o elenco para uma festa na véspera da folga.',
    options: [
      {
        label: 'Ir à festa com o elenco',
        outcome: G => (G.p.form >= 50
          ? { text: 'Você está em boa fase e ninguém reclamou. O grupo ficou mais unido.', fx: { chem: 10, coach: -4 } }
          : { text: 'Você vinha jogando mal e foi fotografado às 4h da manhã. Técnico e torcida não perdoaram.', fx: { chem: 6, coach: -15, fans: -10 } }),
      },
      { label: 'Ficar em casa descansando', outcome: () => ({ text: 'Corpo descansado para o próximo jogo.', fx: { form: 5, chem: -2 } }) },
      { label: 'Fazer um churrasco com o elenco em casa', outcome: () => ({ text: 'Resenha boa e sem exposição. O grupo fechou com você.', fx: { chem: 8, form: 1 } }) },
    ],
  },
  {
    id: 'treino_extra', pool: 'pro', weight: 3, icon: 'train',
    title: 'Treino extra',
    text: 'Semana sem jogos. A comissão técnica liberou o CT para quem quiser treinar mais.',
    options: [
      {
        label: 'Treinar pesado depois do expediente',
        outcome: G => (G.p.form >= 40
          ? { text: 'Corpo inteiro e cabeça boa: você evoluiu de verdade.', fx: { ovr: 1, coach: 5 } }
          : { text: 'Seu corpo já estava cansado da má fase. Lesão muscular.', fx: { injury: 3, form: -5 } }),
      },
      { label: 'Estudar vídeos com o técnico', outcome: () => ({ text: 'O técnico gostou do interesse e te deu novas funções táticas.', fx: { coach: 9, form: 2 } }) },
      { label: 'Descansar e fazer fisioterapia', outcome: () => ({ text: 'Recuperado e leve.', fx: { form: 7 } }) },
    ],
  },
  {
    id: 'briga', pool: 'pro', weight: 2, icon: 'fight',
    title: 'Treta no treino',
    text: 'Um companheiro te deu uma entrada dura no treino e ainda te xingou.',
    options: [
      { label: 'Conversar e resolver no vestiário', outcome: () => ({ text: 'Vocês se entenderam e viraram parceiros em campo.', fx: { chem: 7 } }) },
      {
        label: 'Partir pra cima',
        outcome: G => (G.p.chem >= 60
          ? { text: 'O elenco gosta de você e ficou do seu lado, mas o clube te suspendeu por 2 jogos.', fx: { suspend: 2, coach: -10, chem: 4 } }
          : { text: 'Ninguém te defendeu. Suspenso por 2 jogos e com o vestiário contra você.', fx: { suspend: 2, coach: -12, chem: -12 } }),
      },
      { label: 'Levar o caso ao técnico', outcome: () => ({ text: 'O técnico puniu o companheiro, mas você ganhou fama de dedo-duro.', fx: { coach: 6, chem: -8 } }) },
    ],
  },
  {
    id: 'redes', pool: 'pro', weight: 2, icon: 'phone',
    title: 'Redes sociais',
    text: 'Depois do treino você pega o celular. O que postar?',
    options: [
      {
        label: 'Postar uma indireta para o técnico',
        outcome: G => (G.p.fans >= 65
          ? { text: 'A torcida, que te adora, comprou a briga. O técnico ficou furioso.', fx: { coach: -18, fans: 6 } }
          : { text: 'O técnico viu e a torcida achou que você está se achando.', fx: { coach: -18, fans: -6 } }),
      },
      { label: 'Fazer uma live com a torcida', outcome: () => ({ text: 'A live bombou e trouxe milhares de novos seguidores.', fx: { fans: 8, fame: 3, form: -2 } }) },
      { label: 'Ficar off e focar', outcome: () => ({ text: 'Mente limpa.', fx: { form: 4 } }) },
    ],
  },
  {
    id: 'familia', pool: 'pro', weight: 1, icon: 'home',
    title: 'Saudade de casa',
    text: 'Sua família pede para você passar a folga com eles, mas a viagem é longa.',
    options: [
      { label: 'Viajar para ver a família', outcome: () => ({ text: 'Recarregou as energias, mas chegou atrasado no treino.', fx: { form: 7, coach: -4 } }) },
      { label: 'Ficar e treinar', outcome: () => ({ text: 'Profissional. O técnico notou.', fx: { coach: 5, form: -2 } }) },
    ],
  },
  {
    id: 'dores', pool: 'pro', weight: 2, icon: 'injury',
    title: 'Dor na coxa',
    text: 'Você sente uma fisgada na coxa. O jogo importante é daqui a 3 dias.',
    options: [
      {
        label: 'Esconder e jogar no sacrifício',
        outcome: G => (G.p.form >= 60
          ? { text: 'Com o corpo em dia, você aguentou. O técnico admirou a entrega.', fx: { coach: 8, fans: 4 } }
          : { text: 'O corpo cobrou. A lesão se agravou.', fx: { injury: 6, form: -8 } }),
      },
      { label: 'Avisar o departamento médico', outcome: () => ({ text: 'Tratamento rápido: você perde só 1 jogo.', fx: { injury: 1, coach: 2 } }) },
    ],
  },
  {
    id: 'banco', pool: 'pro', weight: 5, icon: 'bench',
    when: G => Boolean(G.S && G.S.benchRate >= 0.4),
    title: 'Pouco utilizado',
    text: 'Você está ficando muito no banco e está insatisfeito.',
    options: [
      {
        label: 'Exigir titularidade publicamente',
        outcome: G => (G.p.ovr >= G.clubs[G.club].s
          ? { text: 'Você é melhor que o time e todo mundo sabe. O técnico cedeu.', fx: { coach: 6, fans: 5 } }
          : { text: 'Seu nível ainda não justifica a cobrança. Você foi para o fim da fila.', fx: { coach: -18, chem: -5 } }),
      },
      { label: 'Trabalhar calado e esperar', outcome: () => ({ text: 'O técnico valorizou seu profissionalismo.', fx: { coach: 10 } }) },
      { label: 'Pedir para ser negociado', outcome: () => ({ text: 'O mercado ficou sabendo. Mais propostas devem chegar.', fx: { moreOffers: 2, coach: -8, fans: -5 } }) },
    ],
  },
  {
    id: 'patrocinio', pool: 'pro', weight: 2, icon: 'boot',
    when: G => G.p.fame >= 25,
    title: 'Proposta de patrocínio',
    text: 'Uma marca esportiva quer você como garoto-propaganda.',
    options: [
      { label: 'Aceitar e gravar todas as campanhas', outcome: () => ({ text: 'Seu rosto está em outdoors, mas a agenda pesou.', fx: { moneyFame: 1, fame: 5, form: -4 } }) },
      { label: 'Recusar e focar no futebol', outcome: () => ({ text: 'O técnico gostou do foco.', fx: { form: 3, coach: 4 } }) },
    ],
  },
  {
    id: 'aumento', pool: 'pro', weight: 1, icon: 'money',
    title: 'Hora de pedir aumento?',
    text: 'Seu empresário acha que você ganha pouco pelo que joga.',
    options: [
      {
        label: 'Pedir aumento à diretoria',
        outcome: G => (G.p.ovr >= G.clubs[G.club].s + 3
          ? { text: 'Você é peça-chave. Contrato renovado com 30% de aumento!', fx: { salaryMul: 1.3 } }
          : { text: 'A diretoria negou: seu nível ainda não justifica. Ficou um clima ruim.', fx: { coach: -6, fans: -4 } }),
      },
      { label: 'Deixar para depois', outcome: () => ({ text: 'Tudo como está.', fx: {} }) },
    ],
  },
  {
    id: 'novo_tecnico', pool: 'pro', weight: 1, icon: 'coach',
    title: 'Troca no comando',
    text: 'A diretoria demitiu o técnico. Chegou um novo comandante.',
    options: [
      { label: 'Se apresentar e mostrar serviço desde o primeiro treino', outcome: () => ({ text: 'Primeira impressão excelente.', fx: { coachSet: 65 } }) },
      { label: 'Esperar ele te procurar', outcome: () => ({ text: 'A relação começa do zero.', fx: { coachSet: 50 } }) },
    ],
  },
  {
    id: 'caridade', pool: 'pro', weight: 1, icon: 'heart',
    title: 'Jogo beneficente',
    text: 'Te convidaram para um jogo beneficente no seu bairro de origem durante a folga.',
    options: [
      { label: 'Ir e jogar com a molecada', outcome: () => ({ text: 'Momento emocionante. A torcida adorou.', fx: { fans: 7, fame: 3, form: -2 } }) },
      { label: 'Mandar camisas autografadas', outcome: () => ({ text: 'Gesto bacana.', fx: { fans: 2 } }) },
    ],
  },

  // ---------------- Base ----------------
  {
    id: 'base_inicio', pool: 'youth', weight: 3, icon: 'seed',
    title: 'Primeiro dia na base',
    text: 'Primeiro treino nas categorias de base. Todos estão de olho no garoto novo.',
    options: [
      { label: 'Chegar cedo e treinar forte', outcome: () => ({ text: 'O treinador da base anotou seu nome.', fx: { coach: 10, form: 4 } }) },
      {
        label: 'Tentar impressionar com dribles e firulas',
        outcome: G => (G.p.ovr >= 52
          ? { text: 'Você tem talento para isso. Os olheiros ficaram impressionados!', fx: { coach: 4, fame: 5, fans: 4 } }
          : { text: 'Errou quase tudo e ganhou fama de fominha.', fx: { coach: -8, chem: -6 } }),
      },
      { label: 'Ficar na sua e observar', outcome: () => ({ text: 'Discreto e sem riscos.', fx: { chem: 4 } }) },
    ],
  },
  {
    id: 'base_escola', pool: 'youth', weight: 2, icon: 'book',
    title: 'Escola ou futebol?',
    text: 'Sua mãe quer que você termine os estudos, mas a rotina de treinos está puxada.',
    options: [
      { label: 'Conciliar escola e treinos', outcome: () => ({ text: 'Disciplina exemplar. Você aprendeu a ler melhor o jogo.', fx: { pot: 2, form: -3 } }) },
      { label: 'Largar a escola e focar no futebol', outcome: () => ({ text: 'Mais tempo de treino.', fx: { ovr: 1, form: 3 } }) },
    ],
  },
  {
    id: 'base_peneira', pool: 'youth', weight: 2, icon: 'scout',
    title: 'Observação da seleção sub-17',
    text: 'Um observador da seleção de base vai assistir ao treino de hoje.',
    options: [
      {
        label: 'Arriscar jogadas de efeito',
        outcome: G => (G.p.ovr >= 53
          ? { text: 'Deu show! Você foi chamado para treinar com a seleção sub-17.', fx: { fame: 8, pot: 2 } }
          : { text: 'Ainda falta técnica para isso. Errou tudo.', fx: { form: -5 } }),
      },
      { label: 'Jogar simples e sem erros', outcome: () => ({ text: 'O observador elogiou sua regularidade.', fx: { fame: 3, coach: 4 } }) },
    ],
  },
];

/**
 * Monta o evento "Conselho do ídolo" para o clube atual.
 * Só deve ser chamado quando IDOLS[G.club] existir.
 * @param {GameState} G Estado da carreira.
 * @returns {CareerEvent}
 */
function buildIdolEvent(G) {
  const [idol, advice] = IDOLS[G.club];
  return {
    id: 'idol', icon: 'star',
    title: `O conselho de ${idol}`,
    text: `${idol}, ídolo eterno do ${G.club}, aparece no CT e te chama no canto do gramado:<br><br><i>“${advice}”</i>`,
    options: [
      { label: 'Ouvir cada palavra com atenção', outcome: () => ({ text: `${idol} gostou da sua humildade e passou a te acompanhar de perto.`, fx: { pot: 2, form: 5, chem: 4, fans: 6 } }) },
      { label: `Pedir para treinar com ${idol} depois do treino`, outcome: () => ({ text: 'Uma tarde que valeu por um ano de treino.', fx: { ovr: 1, pot: 1, coach: 4, fans: 4 } }) },
      { label: 'Agradecer rápido e ir embora', outcome: () => ({ text: 'A torcida não perdoou o desdém com o maior ídolo do clube.', fx: { fans: -12, chem: -4 } }) },
    ],
  };
}

/**
 * Monta o evento de convocação para a seleção (overall 85 em grande fase).
 * @param {GameState} G Estado da carreira.
 * @returns {CareerEvent}
 */
function buildCallupEvent(G) {
  const c = COUNTRY_BY_ID[G.p.nat];
  return {
    id: 'callup', icon: 'flag',
    title: 'Convocação!',
    text: `O técnico da seleção ${c.name} ${c.flag} acompanhou suas partidas. Com overall ${Math.floor(G.p.ovr)} e em grande fase, você foi <b>convocado</b> para defender o seu país!`,
    options: [
      { label: 'Aceitar a convocação', outcome: () => ({ text: 'Sonho realizado! Você agora faz parte da seleção.', fx: { fame: 10, fans: 10, callup: 1 } }) },
      { label: 'Pedir dispensa para focar no clube', outcome: () => ({ text: 'O técnico do clube adorou. A torcida não entendeu.', fx: { coach: 10, fans: -6, declineCallup: 1 } }) },
    ],
  };
}
