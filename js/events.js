// ============================================================
// Rumo ao Estrelato — eventos de carreira (escolhas com probabilidade)
// p: função (G) => chance de sucesso (0-1). null = resultado garantido.
// fx: efeitos aplicados ao jogador.
// ============================================================

const ev = (G) => G.p; // atalho

const EVENTS = [
  // ---------------- APÓS DERROTA ----------------
  {
    id: 'coletiva_derrota', pool: 'pro', w: 4, icon: '🎙️',
    cond: G => G.S && G.S.last === 'L',
    title: 'Coletiva pós-derrota',
    text: 'O time jogou mal e perdeu. Os jornalistas cercam você na zona mista. O que dizer na coletiva?',
    opts: [
      {
        label: 'Assumir a responsabilidade junto com o grupo',
        p: G => 0.8 + (ev(G).fame - 50) / 500,
        ok: { txt: 'O elenco elogiou sua postura de líder. O vestiário fechou com você.', fx: { chem: 7, coach: 5, fame: 2 } },
        fail: { txt: 'A torcida achou o discurso vazio e pegou no seu pé nas redes.', fx: { fame: -3, form: -3 } },
      },
      {
        label: 'Colocar a culpa no técnico',
        p: G => 0.22 + ev(G).fame / 400,
        ok: { txt: 'A diretoria concordou com você e o técnico foi demitido! O novo comandante chega e a torcida te apoia.', fx: { fame: 6, humor: 5, coachSet: 55 } },
        fail: { txt: 'Péssima ideia. O técnico ficou furioso e o vestiário se voltou contra você.', fx: { coach: -30, chem: -10, fame: -4 } },
      },
      {
        label: 'Culpar a arbitragem',
        p: () => 0.5,
        ok: { txt: 'A torcida comprou a briga e o lance polêmico virou assunto nacional.', fx: { humor: 5, fame: 3 } },
        fail: { txt: 'Você foi denunciado no tribunal e multado.', fx: { money: -40, fame: -4, humor: -3 } },
      },
      {
        label: 'Pedir desculpas à torcida',
        p: () => 0.7,
        ok: { txt: 'Os torcedores reconheceram sua humildade.', fx: { fame: 3, humor: 3 } },
        fail: { txt: 'Mesmo assim você foi vaiado no treino aberto.', fx: { humor: -5 } },
      },
    ],
  },
  {
    id: 'protesto_torcida', pool: 'pro', w: 2, icon: '📢',
    cond: G => G.S && G.S.last === 'L',
    title: 'Protesto no CT',
    text: 'Torcedores organizados cercam o centro de treinamento cobrando o elenco. Você está chegando de carro.',
    opts: [
      {
        label: 'Descer e conversar com os torcedores',
        p: G => 0.5 + ev(G).fame / 300,
        ok: { txt: 'Conversa franca. Os líderes da organizada passaram a te respeitar.', fx: { fame: 6, chem: 4, humor: 3 } },
        fail: { txt: 'O clima esquentou, você foi xingado e ficou abalado.', fx: { humor: -10, form: -4 } },
      },
      {
        label: 'Entrar pelos fundos',
        p: null,
        ok: { txt: 'Você evitou a confusão, mas o clima segue pesado.', fx: { humor: -3 } },
      },
    ],
  },

  // ---------------- APÓS VITÓRIA ----------------
  {
    id: 'coletiva_vitoria', pool: 'pro', w: 4, icon: '🎙️',
    cond: G => G.S && G.S.last === 'W',
    title: 'Coletiva pós-vitória',
    text: 'Grande vitória! Os microfones estão todos virados para você. O que dizer?',
    opts: [
      {
        label: 'Ser humilde e elogiar o grupo',
        p: () => 0.9,
        ok: { txt: 'Os companheiros adoraram. Entrosamento lá em cima.', fx: { chem: 6, coach: 2 } },
        fail: { txt: 'Ninguém deu muita bola para a declaração.', fx: {} },
      },
      {
        label: 'Provocar o rival',
        p: () => 0.4,
        ok: { txt: 'Viralizou! A torcida te transformou em ídolo.', fx: { fame: 8, humor: 5 } },
        fail: { txt: 'O rival usou a provocação como motivação e a pressão em cima de você triplicou.', fx: { chem: -6, coach: -6, form: -5 } },
      },
      {
        label: 'Dizer que merece ser convocado para a seleção',
        p: G => 0.25 + Math.max(0, ev(G).ovr - 70) / 50,
        ok: { txt: 'A imprensa abraçou a campanha pelo seu nome.', fx: { fame: 6, humor: 4 } },
        fail: { txt: 'Foi chamado de arrogante por comentaristas.', fx: { fame: -4, humor: -4 } },
      },
    ],
  },

  // ---------------- TREINOS ----------------
  {
    id: 'treino', pool: 'pro', w: 3, icon: '🏋️',
    title: 'Semana de treinos',
    text: 'Semana livre de jogos. Como você vai aproveitar os treinos?',
    opts: [
      {
        label: 'Treino extra pesado depois do expediente',
        p: G => 0.68 + (ev(G).form - 50) / 400,
        ok: { txt: 'Evolução visível! Você ficou mais forte e rápido.', fx: { ovr: 1, coach: 4 } },
        fail: { txt: 'Exagerou na carga e sentiu uma lesão muscular.', fx: { injury: 3, form: -6 } },
      },
      {
        label: 'Treino normal com o grupo',
        p: null,
        ok: { txt: 'Semana tranquila, corpo descansado.', fx: { form: 3, chem: 2 } },
      },
      {
        label: 'Estudar vídeos com o técnico',
        p: () => 0.85,
        ok: { txt: 'O técnico gostou do interesse e te deu novas funções táticas.', fx: { coach: 8, form: 3 } },
        fail: { txt: 'Você cochilou no meio da análise. O técnico percebeu.', fx: { coach: -3 } },
      },
    ],
  },
  {
    id: 'nutricionista', pool: 'pro', w: 1, icon: '🥗',
    title: 'Nutricionista particular',
    text: 'Um nutricionista famoso oferece um plano personalizado por € 60 mil.',
    opts: [
      {
        label: 'Contratar o plano',
        p: () => 0.8,
        ok: { txt: 'Seu corpo respondeu muito bem. Mais fôlego em campo.', fx: { money: -60, form: 6, pot: 1 } },
        fail: { txt: 'Dieta radical demais, você perdeu massa muscular.', fx: { money: -60, form: -4 } },
      },
      {
        label: 'Seguir a dieta do clube',
        p: null,
        ok: { txt: 'Sem novidades.', fx: { form: 1 } },
      },
    ],
  },

  // ---------------- VIDA FORA DE CAMPO ----------------
  {
    id: 'festa', pool: 'pro', w: 3, icon: '🎉',
    title: 'Convite para a festa',
    text: 'Um cantor famoso te chamou para uma festa na véspera da folga. Os companheiros vão.',
    opts: [
      {
        label: 'Ir à festa',
        p: () => 0.45,
        ok: { txt: 'Noite incrível e ninguém ficou sabendo. Você voltou renovado.', fx: { humor: 12, chem: 5 } },
        fail: { txt: 'Vazaram fotos suas às 4h da manhã. O técnico não gostou nada.', fx: { coach: -15, fame: -5, form: -6 } },
      },
      {
        label: 'Ficar em casa descansando',
        p: null,
        ok: { txt: 'Descansado, mas um pouco entediado.', fx: { form: 3, humor: -2 } },
      },
      {
        label: 'Fazer um churrasco com o elenco em casa',
        p: () => 0.8,
        ok: { txt: 'Resenha boa! O grupo ficou ainda mais unido.', fx: { chem: 12, humor: 6 } },
        fail: { txt: 'Os vizinhos chamaram a polícia por causa do pagode.', fx: { chem: 4, humor: 2, coach: -4, fame: -2 } },
      },
    ],
  },
  {
    id: 'briga', pool: 'pro', w: 2, icon: '😤',
    title: 'Treta no treino',
    text: 'Um companheiro te deu uma entrada dura no treino e ainda te xingou.',
    opts: [
      {
        label: 'Conversar e resolver no vestiário',
        p: () => 0.7,
        ok: { txt: 'Vocês se entenderam e viraram parceiros dentro de campo.', fx: { chem: 8 } },
        fail: { txt: 'A conversa não resolveu e o clima ficou estranho.', fx: { chem: -4 } },
      },
      {
        label: 'Partir pra cima',
        p: () => 0.2,
        ok: { txt: 'Separaram a briga e, curiosamente, o elenco passou a te respeitar.', fx: { chem: 4, fame: 2 } },
        fail: { txt: 'Briga feia. Você foi afastado por 2 jogos e multado.', fx: { suspend: 2, coach: -15, chem: -10, money: -30 } },
      },
      {
        label: 'Levar o caso ao técnico',
        p: () => 0.5,
        ok: { txt: 'O técnico puniu o companheiro e confiou em você.', fx: { coach: 6 } },
        fail: { txt: 'Você ganhou fama de dedo-duro no vestiário.', fx: { chem: -8 } },
      },
    ],
  },
  {
    id: 'redes', pool: 'pro', w: 2, icon: '📱',
    title: 'Redes sociais',
    text: 'Você está com o celular na mão depois do treino. O que postar?',
    opts: [
      {
        label: 'Postar uma indireta para o técnico',
        p: () => 0.3,
        ok: { txt: 'A torcida entendeu como cobrança justa e te apoiou.', fx: { fame: 5, humor: 3 } },
        fail: { txt: 'O técnico viu. E não gostou.', fx: { coach: -18 } },
      },
      {
        label: 'Fazer uma live jogando videogame com a torcida',
        p: () => 0.75,
        ok: { txt: 'Live bombou! Milhares de novos seguidores.', fx: { fame: 6, humor: 4 } },
        fail: { txt: 'Você falou uma besteira ao vivo e virou meme.', fx: { fame: -3, humor: -4 } },
      },
      {
        label: 'Ficar off das redes e focar',
        p: null,
        ok: { txt: 'Mente limpa.', fx: { form: 3 } },
      },
    ],
  },
  {
    id: 'familia', pool: 'pro', w: 1, icon: '👨‍👩‍👦',
    title: 'Saudade de casa',
    text: 'Sua família pede para você passar a folga com eles, mas a viagem é longa.',
    opts: [
      {
        label: 'Viajar para visitar a família',
        p: () => 0.8,
        ok: { txt: 'Recarregou as energias com a família.', fx: { humor: 12 } },
        fail: { txt: 'O voo atrasou e você perdeu um treino.', fx: { humor: 5, coach: -6 } },
      },
      {
        label: 'Ficar e treinar',
        p: null,
        ok: { txt: 'Profissional, mas com saudade.', fx: { form: 2, humor: -4 } },
      },
    ],
  },
  {
    id: 'dores', pool: 'pro', w: 2, icon: '🩹',
    title: 'Dor na coxa',
    text: 'Você sente uma fisgada na coxa no aquecimento do treino. O jogo importante é em 3 dias.',
    opts: [
      {
        label: 'Esconder e jogar no sacrifício',
        p: () => 0.55,
        ok: { txt: 'Aguentou firme. O técnico admirou a entrega.', fx: { coach: 8, fame: 2 } },
        fail: { txt: 'A lesão se agravou. Você vai ficar um tempo de fora.', fx: { injury: 6, form: -8 } },
      },
      {
        label: 'Avisar o departamento médico',
        p: () => 0.9,
        ok: { txt: 'Tratamento rápido, você perde apenas 1 jogo.', fx: { injury: 1 } },
        fail: { txt: 'Era mais sério do que parecia.', fx: { injury: 3 } },
      },
      {
        label: 'Tomar uma infiltração',
        p: () => 0.65,
        ok: { txt: 'A dor passou e você segue jogando.', fx: {} },
        fail: { txt: 'Não funcionou e a lesão piorou.', fx: { injury: 4, form: -4 } },
      },
    ],
  },
  {
    id: 'banco', pool: 'pro', w: 4, icon: '🪑',
    cond: G => G.S && G.S.lastBench,
    title: 'Pouco utilizado',
    text: 'Você ficou no banco no último jogo e está insatisfeito com o pouco tempo em campo.',
    opts: [
      {
        label: 'Exigir titularidade publicamente',
        p: G => 0.2 + ev(G).fame / 300,
        ok: { txt: 'A pressão funcionou: o técnico prometeu te dar chances.', fx: { coach: 8, fame: 3 } },
        fail: { txt: 'O técnico não aceita pressão. Você virou o último da fila.', fx: { coach: -20, humor: -5 } },
      },
      {
        label: 'Trabalhar calado e esperar a chance',
        p: () => 0.75,
        ok: { txt: 'O técnico notou seu profissionalismo.', fx: { coach: 10, form: 3 } },
        fail: { txt: 'Nada mudou e a frustração aumentou.', fx: { humor: -6 } },
      },
      {
        label: 'Pedir ao empresário para buscar outro clube',
        p: () => 0.5,
        ok: { txt: 'O mercado ficou sabendo: mais propostas devem chegar no fim da temporada.', fx: { moreOffers: 2, humor: 4 } },
        fail: { txt: 'A notícia vazou e a diretoria ficou irritada.', fx: { coach: -12, fame: -3 } },
      },
    ],
  },
  {
    id: 'patrocinio', pool: 'pro', w: 2, icon: '👟',
    cond: G => ev(G).fame >= 25,
    title: 'Proposta de patrocínio',
    text: 'Uma marca esportiva quer você como garoto-propaganda.',
    opts: [
      {
        label: 'Aceitar e gravar todas as campanhas',
        p: () => 0.75,
        ok: { txt: 'Contrato assinado! Seu rosto está em outdoors pelo país.', fx: { moneyFame: 1, fame: 5 } },
        fail: { txt: 'A agenda de gravações atrapalhou seus treinos.', fx: { moneyFame: 0.5, form: -6 } },
      },
      {
        label: 'Recusar e focar só no futebol',
        p: null,
        ok: { txt: 'O técnico gostou do seu foco.', fx: { form: 3, coach: 3 } },
      },
    ],
  },
  {
    id: 'imprensa_fora', pool: 'pro', w: 2, icon: '📰',
    cond: G => ev(G).ovr >= 70,
    title: 'Jornal estrangeiro',
    text: 'Um grande jornal internacional pergunta sobre o seu futuro.',
    opts: [
      {
        label: 'Dizer que sonha jogar em um clube maior',
        p: () => 0.5,
        ok: { txt: 'Grandes clubes passaram a te monitorar.', fx: { fame: 6, moreOffers: 2 } },
        fail: { txt: 'A torcida te chamou de mercenário.', fx: { chem: -6, humor: -4, fame: -2 } },
      },
      {
        label: 'Jurar amor ao clube',
        p: () => 0.7,
        ok: { txt: 'Virou ídolo da torcida instantaneamente.', fx: { fame: 4, chem: 5, humor: 3 } },
        fail: { txt: 'Ninguém acreditou muito...', fx: { fame: -2 } },
      },
    ],
  },
  {
    id: 'empresario', pool: 'pro', w: 1, icon: '💼',
    title: 'Novo empresário',
    text: 'Um empresário famoso quer gerenciar sua carreira, mas exige 20% de comissão.',
    opts: [
      {
        label: 'Assinar com o empresário famoso',
        p: () => 0.55,
        ok: { txt: 'Ele abriu portas no mercado internacional.', fx: { fame: 6, moreOffers: 2 } },
        fail: { txt: 'Era um enrolado. Você perdeu dinheiro e tempo.', fx: { money: -150, humor: -6 } },
      },
      {
        label: 'Manter a família cuidando da carreira',
        p: null,
        ok: { txt: 'Confiança em primeiro lugar.', fx: { humor: 4 } },
      },
    ],
  },
  {
    id: 'novo_tecnico', pool: 'pro', w: 1, icon: '🧑‍💼',
    title: 'Troca no comando',
    text: 'A diretoria demitiu o técnico após uma sequência ruim. Chegou um novo comandante.',
    opts: [
      {
        label: 'Se apresentar e mostrar serviço desde o 1º treino',
        p: () => 0.7,
        ok: { txt: 'Primeira impressão excelente!', fx: { coachSet: 68 } },
        fail: { txt: 'Ele achou você ansioso demais.', fx: { coachSet: 45 } },
      },
      {
        label: 'Esperar ele te procurar',
        p: null,
        ok: { txt: 'Relação começa do zero.', fx: { coachSet: 52 } },
      },
    ],
  },
  {
    id: 'mentor', pool: 'pro', w: 2, icon: '🧓',
    cond: G => ev(G).age <= 22,
    title: 'Conselho do veterano',
    text: 'O capitão do time, já no fim da carreira, se oferece para te orientar.',
    opts: [
      {
        label: 'Aceitar as dicas e ficar depois do treino',
        p: () => 0.85,
        ok: { txt: 'Aprendeu muito sobre posicionamento e mentalidade.', fx: { pot: 1, form: 4, chem: 5 } },
        fail: { txt: 'O papo foi bom, mas sem grandes lições.', fx: { chem: 2 } },
      },
      {
        label: 'Agradecer, mas seguir seu próprio caminho',
        p: null,
        ok: { txt: 'Você prefere aprender sozinho.', fx: { humor: 2 } },
      },
    ],
  },
  {
    id: 'aumento', pool: 'pro', w: 1, icon: '💰',
    title: 'Hora de pedir aumento?',
    text: 'Seu empresário acha que você ganha pouco pelo que joga.',
    opts: [
      {
        label: 'Pedir aumento à diretoria',
        p: G => 0.3 + (ev(G).ovr - G.clubs[G.club].s) / 25,
        ok: { txt: 'Contrato renovado com aumento de 30%!', fx: { salaryMul: 1.3, humor: 6 } },
        fail: { txt: 'A diretoria negou e não gostou da pressão.', fx: { coach: -5, humor: -6, fame: -2 } },
      },
      {
        label: 'Deixar para depois',
        p: null,
        ok: { txt: 'Tudo como está.', fx: {} },
      },
    ],
  },
  {
    id: 'caridade', pool: 'pro', w: 1, icon: '🤝',
    title: 'Jogo beneficente',
    text: 'Te convidaram para um jogo beneficente no seu bairro de origem durante a folga.',
    opts: [
      {
        label: 'Ir e jogar com a molecada',
        p: () => 0.9,
        ok: { txt: 'Momento emocionante, viralizou de forma positiva.', fx: { fame: 5, humor: 8 } },
        fail: { txt: 'Torceu o tornozelo no campo de terra.', fx: { injury: 2, humor: 4 } },
      },
      {
        label: 'Mandar camisas autografadas',
        p: null,
        ok: { txt: 'Gesto bacana.', fx: { fame: 1 } },
      },
    ],
  },

  // ---------------- BASE ----------------
  {
    id: 'base_inicio', pool: 'youth', w: 3, icon: '🌱',
    title: 'Primeiro dia na base',
    text: 'Primeiro treino nas categorias de base. Todos estão de olho no garoto novo.',
    opts: [
      {
        label: 'Chegar cedo e treinar forte',
        p: () => 0.85,
        ok: { txt: 'O treinador da base anotou seu nome.', fx: { coach: 10, form: 5 } },
        fail: { txt: 'Exagerou e sentiu o joelho.', fx: { injury: 1 } },
      },
      {
        label: 'Tentar impressionar com dribles e firulas',
        p: () => 0.5,
        ok: { txt: 'Os olheiros ficaram impressionados!', fx: { coach: 6, fame: 4 } },
        fail: { txt: 'Ganhou fama de fominha.', fx: { coach: -8, chem: -6 } },
      },
      {
        label: 'Ficar na sua e observar',
        p: null,
        ok: { txt: 'Discreto e sem riscos.', fx: { chem: 3 } },
      },
    ],
  },
  {
    id: 'base_escola', pool: 'youth', w: 2, icon: '📚',
    title: 'Escola ou futebol?',
    text: 'Sua mãe quer que você termine os estudos, mas a rotina de treinos está puxada.',
    opts: [
      {
        label: 'Conciliar escola e treinos',
        p: () => 0.7,
        ok: { txt: 'Disciplina exemplar. Família orgulhosa.', fx: { humor: 8, pot: 1 } },
        fail: { txt: 'O cansaço bateu e o rendimento caiu.', fx: { form: -5, humor: -3 } },
      },
      {
        label: 'Largar a escola e focar no futebol',
        p: null,
        ok: { txt: 'Mais tempo de treino, mas a família ficou chateada.', fx: { form: 4, humor: -6 } },
      },
    ],
  },
  {
    id: 'base_peneira', pool: 'youth', w: 2, icon: '🔭',
    title: 'Observação da seleção sub-17',
    text: 'Um observador da seleção de base vai assistir ao treino de hoje.',
    opts: [
      {
        label: 'Arriscar jogadas de efeito para chamar atenção',
        p: G => 0.3 + (ev(G).ovr - 50) / 60,
        ok: { txt: 'Você foi chamado para um período de treinos na seleção sub-17!', fx: { fame: 8, pot: 2, humor: 6 } },
        fail: { txt: 'Errou quase tudo que tentou. Fica para a próxima.', fx: { humor: -5 } },
      },
      {
        label: 'Jogar simples e sem erros',
        p: () => 0.6,
        ok: { txt: 'O observador elogiou sua regularidade.', fx: { fame: 3, coach: 4 } },
        fail: { txt: 'Passou despercebido.', fx: {} },
      },
    ],
  },
  {
    id: 'base_empresario', pool: 'youth', w: 1, icon: '🤑',
    title: 'Empresário na porta',
    text: 'Um empresário promete te levar para a Europa se você assinar com ele agora.',
    opts: [
      {
        label: 'Assinar com ele',
        p: () => 0.35,
        ok: { txt: 'Ele tem bons contatos. Seu nome começa a circular.', fx: { fame: 6, moreOffers: 1 } },
        fail: { txt: 'Promessas vazias, e ainda te prendeu num contrato ruim.', fx: { humor: -8, money: -10 } },
      },
      {
        label: 'Esperar o momento certo',
        p: null,
        ok: { txt: 'Paciência é uma virtude.', fx: { humor: 2 } },
      },
    ],
  },
];

// Evento especial de convocação para a seleção
const CALLUP_EVENT = {
  id: 'convocacao', icon: '📞',
  title: 'CONVOCAÇÃO!',
  text: G => `O técnico da seleção ${COUNTRY_BY_ID[G.p.nat].name} ${COUNTRY_BY_ID[G.p.nat].flag} assistiu às suas últimas partidas. Com overall ${Math.floor(G.p.ovr)} e em grande fase, você foi CONVOCADO para defender o seu país!`,
  opts: [
    {
      label: 'Aceitar a convocação com orgulho',
      p: null,
      ok: { txt: 'Sonho realizado! Você agora faz parte da seleção.', fx: { fame: 10, humor: 12, callup: 1 } },
    },
    {
      label: 'Pedir dispensa para focar no clube',
      p: null,
      ok: { txt: 'O técnico do clube adorou, mas a torcida não entendeu.', fx: { coach: 10, fame: -5 } },
    },
  ],
};

const COUNTRY_BY_ID = Object.fromEntries(COUNTRIES.map(c => [c.id, c]));
