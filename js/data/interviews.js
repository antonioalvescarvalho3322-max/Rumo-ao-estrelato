/**
 * @file Banco de perguntas das entrevistas coletivas.
 *
 * Cada resposta tem uma "atitude" (estilo). O resultado não é sorteado: ele depende de
 * três fatores do momento do jogador, combinados com os pesos do estilo:
 *   - Elenco  (relação com o grupo, 0-100)
 *   - Torcida (relação com a torcida, 0-100)
 *   - Números (desempenho na temporada, 0-100; ver Interview.statsScore)
 * A lógica de avaliação fica em js/engine/interview.js.
 */
'use strict';

/**
 * @typedef {Object} AnswerStyle
 * @property {string} name Nome da atitude, mostrado na explicação do resultado.
 * @property {{stats: number, chem: number, fans: number}} weights Peso de cada fator (soma 1).
 * @property {number} good Nota mínima (0-100) para a resposta funcionar.
 * @property {number} mid Nota mínima para a resposta dividir opiniões (abaixo disso, dá errado).
 * @property {{good: Effects, mid: Effects, bad: Effects}} fx Efeitos de cada resultado.
 */

/** @type {Object<string, AnswerStyle>} */
const ANSWER_STYLES = {
  confiante: {
    name: 'Confiança',
    weights: { stats: 0.5, chem: 0.25, fans: 0.25 },
    good: 62, mid: 50,
    fx: {
      good: { chem: 4, coach: 3, fans: 8, form: 4, fame: 4 },
      mid: { fans: 2, chem: -3 },
      bad: { chem: -10, coach: -8, fans: -6, form: -3 },
    },
  },
  provocador: {
    name: 'Provocação',
    weights: { stats: 0.4, chem: 0.15, fans: 0.45 },
    good: 62, mid: 52,
    fx: {
      good: { fans: 14, fame: 5 },
      mid: { fans: 3, coach: -3 },
      bad: { fans: -14, coach: -5, fame: -2 },
    },
  },
  critico: {
    name: 'Crítica ao comando',
    weights: { stats: 0.35, chem: 0.25, fans: 0.4 },
    good: 66, mid: 55,
    fx: {
      good: { fans: 8, coach: -14 },
      mid: { coach: -12, fans: 2 },
      bad: { coach: -22, chem: -10, fans: -8 },
    },
  },
  arbitragem: {
    name: 'Reclamação da arbitragem',
    weights: { stats: 0.3, chem: 0.2, fans: 0.5 },
    good: 58, mid: 48,
    fx: {
      good: { fans: 8, chem: 3 },
      mid: { fans: 2, money: -30 },
      bad: { fans: -5, money: -60 },
    },
  },
  coletivo: {
    name: 'Espírito de grupo',
    weights: { stats: 0.2, chem: 0.6, fans: 0.2 },
    good: 55, mid: 40,
    fx: {
      good: { chem: 7, coach: 5, fans: 2 },
      mid: { chem: 4, coach: 3 },
      bad: { chem: 1, coach: 2, fans: -2 },
    },
  },
  humor: {
    name: 'Bom humor',
    weights: { stats: 0.2, chem: 0.5, fans: 0.3 },
    good: 58, mid: 45,
    fx: {
      good: { chem: 6, fans: 5, fame: 2 },
      mid: { fans: 1 },
      bad: { chem: -5, coach: -5, fans: -4 },
    },
  },
  evasivo: {
    name: 'Resposta neutra',
    weights: { stats: 0.34, chem: 0.33, fans: 0.33 },
    good: 70, mid: 45,
    fx: {
      good: { coach: 3, chem: 2 },
      mid: { fans: -2 },
      bad: { fans: -4, fame: -1 },
    },
  },
  leal: {
    name: 'Amor à camisa',
    weights: { stats: 0.4, chem: 0.2, fans: 0.4 },
    good: 55, mid: 42,
    fx: {
      good: { fans: 10, chem: 3 },
      mid: { fans: 4 },
      bad: { fans: -6 },
    },
  },
  ambicioso: {
    name: 'Ambição',
    weights: { stats: 0.6, chem: 0.1, fans: 0.3 },
    good: 65, mid: 50,
    fx: {
      good: { moreOffers: 2, fame: 4, fans: -4 },
      mid: { moreOffers: 1, fans: -8, chem: -3 },
      bad: { fans: -12, chem: -6, coach: -4 },
    },
  },
};

/** Texto usado quando a resposta divide opiniões e a opção não tem um texto próprio. */
const INTERVIEW_MID_TEXT = 'A declaração dividiu opiniões: uns aplaudiram, outros criticaram.';

/**
 * @typedef {Object} InterviewAnswer
 * @property {string} label Resposta do jogador.
 * @property {string} style Chave em ANSWER_STYLES.
 * @property {string} good Texto quando a resposta funciona.
 * @property {string} bad Texto quando a resposta dá errado.
 * @property {string} [mid] Texto quando a resposta divide opiniões.
 */

/**
 * Contexto usado para decidir quais perguntas fazem sentido no momento.
 * @typedef {Object} InterviewContext
 * @property {number|null} pos Posição do time na liga (null fora da liga).
 * @property {number} teams Quantidade de times na liga.
 * @property {number} age Idade do jogador.
 * @property {number} ovr Overall atual.
 * @property {number} fame Fama.
 * @property {number} fans Relação com a torcida.
 * @property {boolean} called Se já está convocado para a seleção.
 */

/**
 * @typedef {Object} InterviewQuestion
 * @property {string} id Identificador único (usado para não repetir perguntas).
 * @property {string} question Pergunta do jornalista.
 * @property {(ctx: InterviewContext) => boolean} [when] Condição para a pergunta aparecer.
 * @property {InterviewAnswer[]} answers Respostas possíveis (a ordem é embaralhada na tela).
 */

/** @type {InterviewQuestion[]} */
const INTERVIEW_QUESTIONS = [
  {
    id: 'estrela',
    question: 'Você é a grande estrela deste time?',
    answers: [
      { label: 'Sou o melhor do time e todo mundo sabe.', style: 'confiante', good: 'Ninguém contestou: os números e o vestiário estão com você.', bad: 'A frase pegou mal. O vestiário achou que você se acha mais do que é.' },
      { label: 'Aqui não tem estrela, tem grupo.', style: 'coletivo', good: 'O elenco adorou ser valorizado.', bad: 'Discurso bonito, mas o vestiário anda frio com você.' },
      { label: 'Estrela é o escudo. Eu só ajudo.', style: 'leal', good: 'A torcida cantou seu nome no treino seguinte.', bad: 'A torcida achou demagogia de quem não está rendendo.' },
    ],
  },
  {
    id: 'classico',
    question: 'Domingo tem clássico. Qual é o recado para o rival?',
    answers: [
      { label: 'Vamos passar por cima deles, pode escrever.', style: 'provocador', good: 'A torcida lotou o estádio para ver você cumprir a promessa.', bad: 'O rival colou a frase no vestiário e a pressão ficou toda em cima de você.' },
      { label: 'Respeito, mas quem manda na cidade somos nós.', style: 'confiante', good: 'Resposta de dono do time. Moral lá em cima.', bad: 'Faltou bola para sustentar a marra.' },
      { label: 'Clássico se ganha em campo, não no microfone.', style: 'evasivo', good: 'Postura madura, elogiada até pelos rivais.', mid: 'Resposta morna. A torcida queria mais sangue nos olhos.', bad: 'Soou como medo. A torcida cobrou atitude.' },
      { label: 'Torcida, quero o estádio pegando fogo!', style: 'provocador', good: 'Ingressos esgotados em uma hora.', bad: 'Com o momento ruim, o chamado soou vazio.' },
    ],
  },
  {
    id: 'ma_fase',
    question: 'O time vem de resultados ruins. De quem é a culpa?',
    when: ctx => ctx.pos !== null && ctx.pos > Math.ceil(ctx.teams / 2),
    answers: [
      { label: 'A culpa é de todos, eu incluído.', style: 'coletivo', good: 'O grupo se fechou com você.', bad: 'O vestiário não comprou o discurso.' },
      { label: 'O esquema do técnico não está funcionando.', style: 'critico', good: 'A torcida concorda com você, mas o técnico não gostou nada.', bad: 'Você também não está bem. Técnico, elenco e torcida se voltaram contra você.' },
      { label: 'A arbitragem tem nos prejudicado muito.', style: 'arbitragem', good: 'A torcida comprou a briga e o assunto virou polêmica nacional.', bad: 'Ninguém comprou a desculpa e você ainda foi multado.' },
      { label: 'Sem comentários. Foco no próximo jogo.', style: 'evasivo', good: 'Postura profissional, sem criar crise.', bad: 'Fugir da pergunta irritou a torcida.' },
    ],
  },
  {
    id: 'mercado',
    question: 'Um gigante europeu está de olho em você. Vai sair?',
    when: ctx => ctx.fame >= 30 || ctx.ovr >= 76,
    answers: [
      { label: 'Meu sonho é jogar a Champions League.', style: 'ambicioso', good: 'Os grandes clubes anotaram seu nome e a torcida entendeu o sonho.', bad: 'Sem números para isso, a frase só irritou a torcida.' },
      { label: 'Meu coração é deste clube.', style: 'leal', good: 'A torcida foi à loucura.', bad: 'Ninguém acreditou muito.' },
      { label: 'Isso é com o meu empresário.', style: 'evasivo', good: 'Resposta profissional.', bad: 'A torcida entendeu como um adeus.' },
      { label: 'Se pagarem o que eu valho, a gente conversa.', style: 'ambicioso', good: 'Mensagem recebida pelo mercado.', bad: 'A torcida te chamou de mercenário.' },
    ],
  },
  {
    id: 'selecao',
    question: 'Você merece ser convocado para a seleção?',
    when: ctx => !ctx.called && ctx.ovr >= 78,
    answers: [
      { label: 'Mereço, e o técnico da seleção sabe disso.', style: 'confiante', good: 'A imprensa abraçou a campanha pelo seu nome.', bad: 'Foi chamado de arrogante pelos comentaristas.' },
      { label: 'Estou trabalhando quieto. Uma hora a chance chega.', style: 'coletivo', good: 'Postura elogiada pelo grupo.', bad: 'Ninguém deu muita atenção.' },
      { label: 'Se não me chamarem, o problema é deles.', style: 'provocador', good: 'A torcida comprou a briga pela sua convocação.', bad: 'A frase repercutiu muito mal.' },
    ],
  },
  {
    id: 'selecao_posicao',
    question: 'Na seleção você disputa posição com grandes nomes. Isso incomoda?',
    when: ctx => ctx.called,
    answers: [
      { label: 'Vou tomar essa camisa. É questão de tempo.', style: 'confiante', good: 'Recado dado e bem recebido.', bad: 'Os veteranos da seleção não gostaram da marra.' },
      { label: 'Sirvo o país onde o técnico mandar.', style: 'coletivo', good: 'O grupo da seleção elogiou sua postura.', bad: 'Soou como conformismo.' },
      { label: 'Me dá dez minutos que eu resolvo.', style: 'humor', good: 'A frase virou bordão nas arquibancadas.', bad: 'A piada não caiu bem no momento.' },
    ],
  },
  {
    id: 'joia',
    question: 'Muita gente diz que você é o novo craque do país. Concorda?',
    when: ctx => ctx.age <= 21,
    answers: [
      { label: 'Ainda tenho muito a aprender.', style: 'coletivo', good: 'Os veteranos passaram a te proteger.', bad: 'Humildade demais soou como insegurança.' },
      { label: 'Pode me chamar de craque, sim.', style: 'confiante', good: 'Com esse futebol, ninguém discordou.', bad: 'Ainda é cedo para isso, e todo mundo percebeu.' },
      { label: 'Craque é quem ganha título. Me cobrem no fim do ano.', style: 'confiante', good: 'Resposta de gente grande.', bad: 'Promessa grande para quem ainda não entrega.' },
    ],
  },
  {
    id: 'veterano',
    question: 'Você já pensa em aposentadoria?',
    when: ctx => ctx.age >= 31,
    answers: [
      { label: 'Enquanto eu fizer gol, ninguém me tira de campo.', style: 'confiante', good: 'A experiência fala alto. Ninguém duvida.', bad: 'Os números atuais não ajudam o discurso.' },
      { label: 'Quero encerrar a carreira aqui, com essa torcida.', style: 'leal', good: 'A torcida estendeu uma faixa com o seu nome.', bad: 'A torcida quer ver isso em campo.' },
      { label: 'Ainda quero viver uma experiência em outro país.', style: 'ambicioso', good: 'Clubes de fora entraram em contato.', bad: 'A torcida sentiu falta de compromisso.' },
    ],
  },
  {
    id: 'tecnico',
    question: 'Como está sua relação com o técnico?',
    answers: [
      { label: 'Ótima. Ele é como um pai para mim.', style: 'coletivo', good: 'O técnico agradeceu publicamente.', bad: 'Ninguém no vestiário acreditou.' },
      { label: 'Respeito, mas eu deveria jogar mais solto.', style: 'critico', good: 'A torcida concorda, mas o técnico torceu o nariz.', bad: 'O técnico entendeu como deslealdade.' },
      { label: 'Pergunta pra ele, ué.', style: 'humor', good: 'Até o técnico riu na coletiva seguinte.', bad: 'A ironia caiu muito mal.' },
    ],
  },
  {
    id: 'vaias',
    question: 'Você foi vaiado no último jogo. Como responde?',
    when: ctx => ctx.fans < 45,
    answers: [
      { label: 'Vaia faz parte. Vou responder com gols.', style: 'confiante', good: 'Resposta madura que acalmou a arquibancada.', bad: 'Sem gols para mostrar, a vaia aumentou.' },
      { label: 'Quem vaia não sabe o que é jogar aqui.', style: 'provocador', good: 'Parte da torcida admirou a personalidade.', bad: 'A torcida ficou ainda mais contra você.' },
      { label: 'Peço desculpas. A torcida tem razão de cobrar.', style: 'leal', good: 'A humildade reconquistou a arquibancada.', bad: 'A torcida quer menos discurso e mais futebol.' },
    ],
  },
  {
    id: 'meme',
    question: 'Um lance seu virou meme nas redes sociais. Você viu?',
    answers: [
      { label: 'Vi e ri muito. Quem não ri de si mesmo...', style: 'humor', good: 'Você virou o jogador mais simpático do país.', bad: 'Rir do próprio erro na fase ruim pegou mal.' },
      { label: 'Meme é coisa de quem não tem argumento.', style: 'provocador', good: 'A resposta virou outro meme, desta vez a seu favor.', bad: 'Você virou meme de novo.' },
      { label: 'Nem vi. Estou focado.', style: 'evasivo', good: 'Foco total, elogiado pelo técnico.', bad: 'Ninguém acreditou que você não viu.' },
    ],
  },
  {
    id: 'titulo',
    question: 'O time briga pelo título. Vai dar?',
    when: ctx => ctx.pos !== null && ctx.pos <= 3,
    answers: [
      { label: 'Vai dar, e eu vou ser o artilheiro.', style: 'confiante', good: 'A confiança contagiou o elenco.', bad: 'Promessa pesada para quem não vem decidindo.' },
      { label: 'Jogo a jogo, sem euforia.', style: 'coletivo', good: 'O técnico adorou o pé no chão.', bad: 'Resposta protocolar.' },
      { label: 'Já podem preparar a festa.', style: 'provocador', good: 'A torcida já ensaia a comemoração.', bad: 'O salto alto virou piada dos rivais.' },
    ],
  },
  {
    id: 'rebaixamento',
    question: 'O time está perto da zona de rebaixamento. E agora?',
    when: ctx => ctx.pos !== null && ctx.pos > ctx.teams - 4,
    answers: [
      { label: 'Eu chamo a responsabilidade e vou tirar o time dessa.', style: 'confiante', good: 'O elenco se agarrou ao seu discurso.', bad: 'Quem está mal não pode prometer salvar ninguém.' },
      { label: 'O grupo precisa se fechar mais do que nunca.', style: 'coletivo', good: 'O vestiário se uniu.', bad: 'Discurso repetido de quem não sabe o que fazer.' },
      { label: 'A diretoria precisa contratar com urgência.', style: 'critico', good: 'A torcida concordou e pressionou a diretoria.', bad: 'O vestiário se sentiu desvalorizado.' },
    ],
  },
  {
    id: 'salario',
    question: 'Dizem que você pediu aumento. É verdade?',
    answers: [
      { label: 'Valorização é justa para quem decide jogos.', style: 'ambicioso', good: 'Os números te dão razão.', bad: 'A torcida achou o pedido um absurdo.' },
      { label: 'Dinheiro não é prioridade agora.', style: 'leal', good: 'A torcida aplaudiu.', bad: 'Ninguém acreditou.' },
      { label: 'Isso é assunto interno.', style: 'evasivo', good: 'A diretoria agradeceu a discrição.', bad: 'O silêncio alimentou a polêmica.' },
    ],
  },
  {
    id: 'companheiro',
    question: 'Um companheiro reclamou que você não passa a bola. O que diz?',
    answers: [
      { label: 'Passo quando é para passar e faço gol quando é para fazer.', style: 'confiante', good: 'Com esses números, até o companheiro concordou.', bad: 'O vestiário ficou do lado dele.' },
      { label: 'Vou conversar com ele. Estamos juntos.', style: 'coletivo', good: 'Assunto resolvido no vestiário.', bad: 'O clima continua estranho.' },
      { label: 'Ele precisa se movimentar melhor.', style: 'provocador', good: 'A torcida concordou com você.', bad: 'Você expôs um colega e o grupo não gostou.' },
    ],
  },
  {
    id: 'polemica',
    question: 'Houve um pênalti polêmico contra vocês na última rodada. O que achou?',
    answers: [
      { label: 'Foi um roubo, simples assim.', style: 'arbitragem', good: 'A torcida comprou a briga.', bad: 'Você foi denunciado e multado.' },
      { label: 'Erros acontecem. A gente precisa ser melhor.', style: 'coletivo', good: 'Postura elogiada por todos.', bad: 'A torcida queria mais revolta.' },
      { label: 'Com um VAR desses, melhor jogar sem.', style: 'humor', good: 'A frase viralizou de forma positiva.', bad: 'A piada rendeu uma multa.' },
    ],
  },
  {
    id: 'idolo',
    question: 'Você já se considera ídolo da torcida?',
    when: ctx => ctx.age >= 23,
    answers: [
      { label: 'Sou ídolo, sim. Basta olhar a arquibancada.', style: 'confiante', good: 'A arquibancada respondeu cantando seu nome.', bad: 'A torcida achou que você se precipitou.' },
      { label: 'Ídolo é quem fica. Quero fazer história aqui.', style: 'leal', good: 'Faixas com o seu nome apareceram no estádio.', bad: 'Ainda falta futebol para esse discurso.' },
      { label: 'Ídolo de verdade ganha título. Ainda falta muito.', style: 'coletivo', good: 'Discurso de líder.', bad: 'Resposta protocolar.' },
    ],
  },
  {
    id: 'objetivo',
    question: 'Qual é o seu objetivo pessoal para a temporada?',
    answers: [
      { label: 'Ser o artilheiro do campeonato.', style: 'confiante', good: 'Com o seu momento, a meta parece possível.', bad: 'Meta ousada para quem não vem marcando.' },
      { label: 'Ajudar o time a ganhar títulos.', style: 'coletivo', good: 'O elenco abraçou o discurso.', bad: 'Resposta pronta.' },
      { label: 'Ganhar a Bola de Ouro.', style: 'ambicioso', good: 'O mundo começou a prestar atenção em você.', bad: 'A frase virou piada nas redes.' },
    ],
  },
];
