// ============================================================
// Rumo ao Estrelato — eventos de carreira
// Sem porcentagem: cada escolha tem consequência definida.
// Em várias delas o resultado depende do seu desempenho (gols, nota, fase).
// res(G) => { txt, fx }   fx = efeitos (form, coach, chem, fans, fame, ...)
// ============================================================

const COUNTRY_BY_ID = Object.fromEntries(COUNTRIES.map(c => [c.id, c]));

// Desempenho na temporada atual
const SCORING_LINE = { ATA: 0.45, MEI: 0.25, ZAG: 0.08, GOL: null };
function perf(G) {
  const p = G.p;
  const st = G.S ? G.S.stats : { games: 0, goals: 0, assists: 0, rSum: 0, rN: 0, cleanSheets: 0 };
  const games = st.games;
  const avg = st.rN ? st.rSum / st.rN : 6.5;
  const gpg = games ? st.goals / games : 0;
  const line = SCORING_LINE[p.pos];
  const scoring = games >= 3 && (line === null ? avg >= 7.0 && st.cleanSheets >= games * 0.35 : gpg >= line);
  const good = games >= 3 && (avg >= 6.95 || scoring) && p.form >= 45;
  const numbers = p.pos === 'GOL'
    ? `${st.cleanSheets} jogos sem sofrer gol em ${games} partidas (nota média ${avg.toFixed(1)})`
    : `${st.goals} ${st.goals === 1 ? 'gol' : 'gols'} e ${st.assists} ${st.assists === 1 ? 'assistência' : 'assistências'} em ${games} jogos (nota média ${avg.toFixed(1)})`;
  return { games, goals: st.goals, avg, scoring, good, numbers };
}

const EVENTS = [
  // ---------------- VIDA DE JOGADOR ----------------
  {
    id: 'festa', pool: 'pro', w: 3, icon: 'party',
    title: 'Convite para a festa',
    text: 'Um cantor famoso chamou o elenco para uma festa na véspera da folga.',
    opts: [
      {
        label: 'Ir à festa com o elenco',
        res: G => G.p.form >= 50
          ? { txt: 'Você está em boa fase, ninguém reclamou. O grupo ficou mais unido.', fx: { chem: 10, coach: -4 } }
          : { txt: 'Você vinha jogando mal e foi fotografado às 4h da manhã. O técnico e a torcida não perdoaram.', fx: { chem: 6, coach: -15, fans: -10 } },
      },
      { label: 'Ficar em casa descansando', res: () => ({ txt: 'Corpo descansado para o próximo jogo.', fx: { form: 5, chem: -2 } }) },
      { label: 'Fazer um churrasco com o elenco em casa', res: () => ({ txt: 'Resenha boa e sem exposição. O grupo fechou com você.', fx: { chem: 8, form: 1 } }) },
    ],
  },
  {
    id: 'treino', pool: 'pro', w: 3, icon: 'train',
    title: 'Semana de treinos',
    text: 'Semana livre de jogos. Como você aproveita?',
    opts: [
      {
        label: 'Treino extra pesado depois do expediente',
        res: G => G.p.form >= 40
          ? { txt: 'Corpo inteiro e cabeça boa: você evoluiu de verdade.', fx: { ovr: 1, coach: 5 } }
          : { txt: 'Seu corpo já estava cansado da má fase. Lesão muscular.', fx: { injury: 3, form: -5 } },
      },
      { label: 'Estudar vídeos com o técnico', res: () => ({ txt: 'O técnico gostou do interesse e te deu novas funções táticas.', fx: { coach: 9, form: 2 } }) },
      { label: 'Descansar e fazer fisioterapia', res: () => ({ txt: 'Recuperado e leve.', fx: { form: 7 } }) },
    ],
  },
  {
    id: 'briga', pool: 'pro', w: 2, icon: 'fight',
    title: 'Treta no treino',
    text: 'Um companheiro te deu uma entrada dura no treino e ainda te xingou.',
    opts: [
      { label: 'Conversar e resolver no vestiário', res: () => ({ txt: 'Vocês se entenderam e viraram parceiros em campo.', fx: { chem: 7 } }) },
      {
        label: 'Partir pra cima',
        res: G => G.p.chem >= 60
          ? { txt: 'O elenco já gostava de você e ficou do seu lado. Mas o clube te suspendeu por 2 jogos.', fx: { suspend: 2, coach: -10, chem: 4 } }
          : { txt: 'Ninguém te defendeu. Suspenso por 2 jogos e com o vestiário contra você.', fx: { suspend: 2, coach: -12, chem: -12 } },
      },
      { label: 'Levar o caso ao técnico', res: () => ({ txt: 'O técnico puniu o companheiro, mas você ganhou fama de dedo-duro.', fx: { coach: 6, chem: -8 } }) },
    ],
  },
  {
    id: 'redes', pool: 'pro', w: 2, icon: 'phone',
    title: 'Redes sociais',
    text: 'Depois do treino você pega o celular. O que postar?',
    opts: [
      {
        label: 'Postar uma indireta para o técnico',
        res: G => G.p.fans >= 65
          ? { txt: 'A torcida, que te adora, comprou a briga. O técnico ficou furioso.', fx: { coach: -18, fans: 6 } }
          : { txt: 'O técnico viu e a torcida achou que você está se achando.', fx: { coach: -18, fans: -6 } },
      },
      { label: 'Fazer uma live com a torcida', res: () => ({ txt: 'Live bombou, milhares de novos seguidores.', fx: { fans: 8, fame: 3, form: -2 } }) },
      { label: 'Ficar off e focar', res: () => ({ txt: 'Mente limpa.', fx: { form: 4 } }) },
    ],
  },
  {
    id: 'familia', pool: 'pro', w: 1, icon: 'home',
    title: 'Saudade de casa',
    text: 'Sua família pede para você passar a folga com eles, mas a viagem é longa.',
    opts: [
      { label: 'Viajar para ver a família', res: () => ({ txt: 'Recarregou as energias, mas chegou atrasado no treino.', fx: { form: 7, coach: -4 } }) },
      { label: 'Ficar e treinar', res: () => ({ txt: 'Profissional. O técnico notou.', fx: { coach: 5, form: -2 } }) },
    ],
  },
  {
    id: 'dores', pool: 'pro', w: 2, icon: 'injury',
    title: 'Dor na coxa',
    text: 'Você sente uma fisgada na coxa. O jogo importante é daqui a 3 dias.',
    opts: [
      {
        label: 'Esconder e jogar no sacrifício',
        res: G => G.p.form >= 60
          ? { txt: 'Com o corpo em dia, você aguentou. O técnico admirou a entrega.', fx: { coach: 8, fans: 4 } }
          : { txt: 'O corpo cobrou. A lesão se agravou.', fx: { injury: 6, form: -8 } },
      },
      { label: 'Avisar o departamento médico', res: () => ({ txt: 'Tratamento rápido: você perde só 1 jogo.', fx: { injury: 1, coach: 2 } }) },
    ],
  },
  {
    id: 'banco', pool: 'pro', w: 5, icon: 'bench',
    cond: G => G.S && G.S.benchRate >= 0.4,
    title: 'Pouco utilizado',
    text: 'Você está ficando muito no banco e está insatisfeito.',
    opts: [
      {
        label: 'Exigir titularidade publicamente',
        res: G => G.p.ovr >= G.clubs[G.club].s
          ? { txt: 'Você é melhor que o time e todo mundo sabe. O técnico cedeu.', fx: { coach: 6, fans: 5 } }
          : { txt: 'Seu nível ainda não justifica a cobrança. Você foi para o fim da fila.', fx: { coach: -18, chem: -5 } },
      },
      { label: 'Trabalhar calado e esperar', res: () => ({ txt: 'O técnico valorizou seu profissionalismo.', fx: { coach: 10 } }) },
      { label: 'Pedir para ser negociado', res: () => ({ txt: 'O mercado ficou sabendo. Mais propostas devem chegar.', fx: { moreOffers: 2, coach: -8, fans: -5 } }) },
    ],
  },
  {
    id: 'patrocinio', pool: 'pro', w: 2, icon: 'boot',
    cond: G => G.p.fame >= 25,
    title: 'Proposta de patrocínio',
    text: 'Uma marca esportiva quer você como garoto-propaganda.',
    opts: [
      { label: 'Aceitar e gravar todas as campanhas', res: () => ({ txt: 'Seu rosto está em outdoors, mas a agenda pesou.', fx: { moneyFame: 1, fame: 5, form: -4 } }) },
      { label: 'Recusar e focar no futebol', res: () => ({ txt: 'O técnico gostou do foco.', fx: { form: 3, coach: 4 } }) },
    ],
  },
  {
    id: 'imprensa_fora', pool: 'pro', w: 2, icon: 'news',
    cond: G => G.p.ovr >= 70,
    title: 'Jornal estrangeiro',
    text: 'Um grande jornal internacional pergunta sobre o seu futuro.',
    opts: [
      { label: 'Dizer que sonha jogar num clube maior', res: () => ({ txt: 'Grandes clubes ficaram atentos. A torcida te chamou de mercenário.', fx: { moreOffers: 2, fans: -10, chem: -3 } }) },
      { label: 'Jurar amor ao clube', res: () => ({ txt: 'A torcida foi à loucura.', fx: { fans: 10, chem: 3 } }) },
    ],
  },
  {
    id: 'aumento', pool: 'pro', w: 1, icon: 'money',
    title: 'Hora de pedir aumento?',
    text: 'Seu empresário acha que você ganha pouco pelo que joga.',
    opts: [
      {
        label: 'Pedir aumento à diretoria',
        res: G => G.p.ovr >= G.clubs[G.club].s + 3
          ? { txt: 'Você é peça-chave. Contrato renovado com 30% de aumento!', fx: { salaryMul: 1.3 } }
          : { txt: 'A diretoria negou: seu nível não justifica. Ficou um clima ruim.', fx: { coach: -6, fans: -4 } },
      },
      { label: 'Deixar para depois', res: () => ({ txt: 'Tudo como está.', fx: {} }) },
    ],
  },
  {
    id: 'novo_tecnico', pool: 'pro', w: 1, icon: 'coach',
    title: 'Troca no comando',
    text: 'A diretoria demitiu o técnico. Chegou um novo comandante.',
    opts: [
      { label: 'Se apresentar e mostrar serviço desde o 1º treino', res: () => ({ txt: 'Primeira impressão excelente.', fx: { coachSet: 65 } }) },
      { label: 'Esperar ele te procurar', res: () => ({ txt: 'A relação começa do zero.', fx: { coachSet: 50 } }) },
    ],
  },
  {
    id: 'caridade', pool: 'pro', w: 1, icon: 'heart',
    title: 'Jogo beneficente',
    text: 'Te convidaram para um jogo beneficente no seu bairro de origem durante a folga.',
    opts: [
      { label: 'Ir e jogar com a molecada', res: () => ({ txt: 'Momento emocionante, a torcida adorou.', fx: { fans: 7, fame: 3, form: -2 } }) },
      { label: 'Mandar camisas autografadas', res: () => ({ txt: 'Gesto bacana.', fx: { fans: 2 } }) },
    ],
  },

  // ---------------- BASE ----------------
  {
    id: 'base_inicio', pool: 'youth', w: 3, icon: 'seed',
    title: 'Primeiro dia na base',
    text: 'Primeiro treino nas categorias de base. Todos estão de olho no garoto novo.',
    opts: [
      { label: 'Chegar cedo e treinar forte', res: () => ({ txt: 'O treinador da base anotou seu nome.', fx: { coach: 10, form: 4 } }) },
      {
        label: 'Tentar impressionar com dribles e firulas',
        res: G => G.p.ovr >= 52
          ? { txt: 'Você tem talento para isso. Os olheiros ficaram impressionados!', fx: { coach: 4, fame: 5, fans: 4 } }
          : { txt: 'Errou quase tudo e ganhou fama de fominha.', fx: { coach: -8, chem: -6 } },
      },
      { label: 'Ficar na sua e observar', res: () => ({ txt: 'Discreto e sem riscos.', fx: { chem: 4 } }) },
    ],
  },
  {
    id: 'base_escola', pool: 'youth', w: 2, icon: 'book',
    title: 'Escola ou futebol?',
    text: 'Sua mãe quer que você termine os estudos, mas a rotina de treinos está puxada.',
    opts: [
      { label: 'Conciliar escola e treinos', res: () => ({ txt: 'Disciplina exemplar. Você aprendeu a ler melhor o jogo.', fx: { pot: 1, form: -3 } }) },
      { label: 'Largar a escola e focar no futebol', res: () => ({ txt: 'Mais tempo de treino.', fx: { form: 5, coach: 3 } }) },
    ],
  },
  {
    id: 'base_peneira', pool: 'youth', w: 2, icon: 'scout',
    title: 'Observação da seleção sub-17',
    text: 'Um observador da seleção de base vai assistir ao treino de hoje.',
    opts: [
      {
        label: 'Arriscar jogadas de efeito',
        res: G => G.p.ovr >= 53
          ? { txt: 'Deu show! Você foi chamado para treinar com a seleção sub-17.', fx: { fame: 8, pot: 2 } }
          : { txt: 'Ainda falta técnica para isso. Errou tudo.', fx: { form: -5 } },
      },
      { label: 'Jogar simples e sem erros', res: () => ({ txt: 'O observador elogiou sua regularidade.', fx: { fame: 3, coach: 4 } }) },
    ],
  },
];

// ---------------- ENTREVISTA (montada conforme o momento) ----------------
function interviewEvent(G) {
  const pf = perf(G);
  const pos = G.S && G.S.league ? myLeaguePos(G) : null;
  const n = G.S && G.S.league ? G.S.league.table.length : 20;
  const teamBad = pos !== null && pos > Math.ceil(n / 2);
  const opts = [
    {
      label: '“Toca em mim que é gol!”',
      res: () => pf.scoring
        ? { txt: `Com ${pf.numbers}, ninguém discute. A confiança contagiou o elenco.`, fx: { chem: 6, coach: 4, fans: 8, form: 5, fame: 4 } }
        : { txt: `Com ${pf.numbers}, a frase virou piada. Elenco e técnico não gostaram nada.`, fx: { chem: -12, coach: -10, fans: -5, form: -4 } },
    },
    {
      label: 'Xingar o time rival e chamar a torcida pra cima',
      res: () => pf.good
        ? { txt: `Você está voando (${pf.numbers}). A torcida abraçou a provocação!`, fx: { fans: 15, fame: 5, chem: 2 } }
        : { txt: `Quem está mal (${pf.numbers}) não pode provocar. A torcida te vaiou.`, fx: { fans: -15, coach: -5, fame: -2 } },
    },
    {
      label: 'Elogiar o grupo e o técnico',
      res: () => ({ txt: 'Discurso de líder. O vestiário fechou com você.', fx: { chem: 6, coach: 6, fans: 1 } }),
    },
  ];
  if (teamBad) {
    opts.push({
      label: 'Colocar a culpa no técnico',
      res: () => pf.good
        ? { txt: `Você é o melhor do time (${pf.numbers}) e a torcida concorda com você. O técnico ficou furioso.`, fx: { fans: 8, coach: -20 } }
        : { txt: `Você também está mal (${pf.numbers}). Péssima ideia: técnico, elenco e torcida contra você.`, fx: { coach: -25, chem: -10, fans: -8 } },
    });
  }
  return {
    id: 'interview', icon: 'mic',
    title: 'Entrevista coletiva',
    text: `Meio de temporada. ${pos !== null ? `O time está em <b>${pos}º</b> no campeonato. ` : ''}Seus números: <b>${pf.numbers}</b>. Os jornalistas querem uma declaração forte.`,
    opts,
  };
}

// ---------------- CONSELHO DO ÍDOLO ----------------
function idolEvent(G) {
  const [idol, quote] = IDOLS[G.club];
  return {
    id: 'idol', icon: 'star',
    title: `O conselho de ${idol}`,
    text: `${idol}, ídolo eterno do ${G.club}, aparece no CT e te chama no canto do gramado:<br><br><i>“${quote}”</i>`,
    opts: [
      { label: 'Ouvir cada palavra com atenção', res: () => ({ txt: `${idol} gostou da sua humildade e passou a te acompanhar de perto.`, fx: { pot: 2, form: 5, chem: 4, fans: 6 } }) },
      { label: `Pedir para treinar com ${idol} depois do treino`, res: () => ({ txt: 'Uma tarde que valeu por um ano de treino.', fx: { ovr: 1, pot: 1, coach: 4, fans: 4 } }) },
      { label: 'Agradecer rápido e ir embora', res: () => ({ txt: 'A torcida não perdoou o desdém com o maior ídolo do clube.', fx: { fans: -12, chem: -4 } }) },
    ],
  };
}

// ---------------- CONVOCAÇÃO ----------------
function callupEvent(G) {
  const c = COUNTRY_BY_ID[G.p.nat];
  return {
    id: 'callup', icon: 'flag',
    title: 'Convocação!',
    text: `O técnico da seleção ${c.name} ${c.flag} acompanhou suas partidas. Com overall ${Math.floor(G.p.ovr)} e em grande fase, você foi <b>convocado</b> para defender o seu país!`,
    opts: [
      { label: 'Aceitar a convocação', res: () => ({ txt: 'Sonho realizado! Você agora faz parte da seleção.', fx: { fame: 10, fans: 10, callup: 1 } }) },
      { label: 'Pedir dispensa para focar no clube', res: () => ({ txt: 'O técnico do clube adorou. A torcida não entendeu.', fx: { coach: 10, fans: -6, declineCallup: 1 } }) },
    ],
  };
}
