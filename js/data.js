// ============================================================
// Rumo ao Estrelato — dados do jogo (países, ligas, clubes)
// s = força do clube (0-100), d = divisão (Brasil: 1=A,2=B,3=C,4=D)
// ============================================================

const CONFEDS = {
  CONMEBOL: {
    main: 'Copa Libertadores', second: 'Copa Sul-Americana',
    nationsCup: 'Copa América',
  },
  UEFA: {
    main: 'UEFA Champions League', second: 'UEFA Europa League',
    nationsCup: 'Eurocopa',
  },
  CONCACAF: {
    main: 'Copa dos Campeões da CONCACAF', second: null,
    nationsCup: 'Copa Ouro',
  },
  AFC: {
    main: 'Liga dos Campeões da Ásia', second: null,
    nationsCup: 'Copa da Ásia',
  },
};

const COUNTRIES = [
  {
    id: 'BR', name: 'Brasil', flag: '🇧🇷', confed: 'CONMEBOL', nat: 87,
    leagues: ['Brasileirão Série A', 'Brasileirão Série B', 'Brasileirão Série C', 'Brasileirão Série D'],
    cup: 'Copa do Brasil', top: 6,
  },
  {
    id: 'AR', name: 'Argentina', flag: '🇦🇷', confed: 'CONMEBOL', nat: 88,
    leagues: ['Liga Profesional Argentina'], cup: 'Copa Argentina', top: 4,
    clubs: [
      ['River Plate', 80], ['Boca Juniors', 79], ['Racing', 76], ['Estudiantes', 74],
      ['Vélez Sarsfield', 73], ['Independiente', 72], ['Talleres', 72], ['Rosario Central', 71],
      ['Lanús', 71], ['San Lorenzo', 70], ['Argentinos Juniors', 70], ["Newell's Old Boys", 68],
    ],
  },
  {
    id: 'UY', name: 'Uruguai', flag: '🇺🇾', confed: 'CONMEBOL', nat: 82,
    leagues: ['Campeonato Uruguaio'], cup: 'Copa AUF Uruguai', top: 3,
    clubs: [
      ['Peñarol', 72], ['Nacional (URU)', 72], ['Defensor Sporting', 64], ['Liverpool (URU)', 64],
      ['Montevideo Wanderers', 61], ['Danubio', 60], ['Cerro Largo', 58], ['Boston River', 59],
    ],
  },
  {
    id: 'CO', name: 'Colômbia', flag: '🇨🇴', confed: 'CONMEBOL', nat: 82,
    leagues: ['Liga Colombiana'], cup: 'Copa Colômbia', top: 3,
    clubs: [
      ['Atlético Nacional', 73], ['Millonarios', 71], ['América de Cali', 70], ['Junior Barranquilla', 70],
      ['Independiente Medellín', 68], ['Deportes Tolima', 67], ['Santa Fe', 67], ['Once Caldas', 64],
    ],
  },
  {
    id: 'CL', name: 'Chile', flag: '🇨🇱', confed: 'CONMEBOL', nat: 75,
    leagues: ['Campeonato Chileno'], cup: 'Copa Chile', top: 3,
    clubs: [
      ['Colo-Colo', 70], ['Universidad de Chile', 69], ['Universidad Católica', 68], ['Palestino', 62],
      ['Huachipato', 61], ['Coquimbo Unido', 61], ['Cobreloa', 58], ['Everton (CHI)', 59],
    ],
  },
  {
    id: 'PY', name: 'Paraguai', flag: '🇵🇾', confed: 'CONMEBOL', nat: 76,
    leagues: ['Campeonato Paraguaio'], cup: 'Copa Paraguai', top: 3,
    clubs: [
      ['Olimpia', 68], ['Cerro Porteño', 68], ['Libertad', 67], ['Guaraní (PAR)', 62],
      ['Nacional (PAR)', 60], ['Sportivo Luqueño', 58], ['Sportivo Ameliano', 57], ['2 de Mayo', 56],
    ],
  },
  {
    id: 'MX', name: 'México', flag: '🇲🇽', confed: 'CONCACAF', nat: 78,
    leagues: ['Liga MX'], cup: 'Copa México', top: 3,
    clubs: [
      ['Club América', 76], ['Monterrey', 76], ['Tigres UANL', 76], ['Cruz Azul', 74],
      ['Toluca', 73], ['Chivas Guadalajara', 72], ['Pumas UNAM', 70], ['León', 69],
      ['Pachuca', 70], ['Santos Laguna', 66],
    ],
  },
  {
    id: 'US', name: 'Estados Unidos', flag: '🇺🇸', confed: 'CONCACAF', nat: 78,
    leagues: ['MLS'], cup: 'US Open Cup', top: 3,
    clubs: [
      ['Inter Miami', 75], ['LAFC', 74], ['LA Galaxy', 71], ['FC Cincinnati', 70],
      ['Columbus Crew', 70], ['Seattle Sounders', 70], ['Orlando City', 69], ['Atlanta United', 68],
      ['New York Red Bulls', 68], ['Philadelphia Union', 69],
    ],
  },
  {
    id: 'PT', name: 'Portugal', flag: '🇵🇹', confed: 'UEFA', nat: 87,
    leagues: ['Liga Portugal'], cup: 'Taça de Portugal', top: 3,
    clubs: [
      ['Sporting', 83], ['Benfica', 82], ['Porto', 81], ['Braga', 76],
      ['Vitória de Guimarães', 71], ['Famalicão', 68], ['Rio Ave', 65], ['Boavista', 62],
      ['Gil Vicente', 64], ['Moreirense', 64],
    ],
  },
  {
    id: 'ES', name: 'Espanha', flag: '🇪🇸', confed: 'UEFA', nat: 89,
    leagues: ['LaLiga'], cup: 'Copa del Rey', top: 4,
    clubs: [
      ['Real Madrid', 90], ['Barcelona', 89], ['Atlético de Madrid', 85], ['Athletic Bilbao', 81],
      ['Villarreal', 81], ['Real Sociedad', 79], ['Real Betis', 79], ['Sevilla', 77],
      ['Valencia', 75], ['Celta de Vigo', 75], ['Girona', 74], ['Osasuna', 74],
    ],
  },
  {
    id: 'EN', name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confed: 'UEFA', nat: 88,
    leagues: ['Premier League'], cup: 'FA Cup', top: 4,
    clubs: [
      ['Manchester City', 89], ['Liverpool', 89], ['Arsenal', 88], ['Chelsea', 85],
      ['Newcastle', 83], ['Manchester United', 82], ['Tottenham', 82], ['Aston Villa', 82],
      ['Brighton', 79], ['Crystal Palace', 78], ['West Ham', 77], ['Everton', 75],
    ],
  },
  {
    id: 'IT', name: 'Itália', flag: '🇮🇹', confed: 'UEFA', nat: 84,
    leagues: ['Serie A'], cup: 'Coppa Italia', top: 4,
    clubs: [
      ['Inter de Milão', 87], ['Napoli', 85], ['Juventus', 84], ['Milan', 83],
      ['Atalanta', 82], ['Roma', 81], ['Lazio', 79], ['Bologna', 79],
      ['Fiorentina', 78], ['Torino', 75],
    ],
  },
  {
    id: 'DE', name: 'Alemanha', flag: '🇩🇪', confed: 'UEFA', nat: 86,
    leagues: ['Bundesliga'], cup: 'DFB-Pokal', top: 4,
    clubs: [
      ['Bayern de Munique', 89], ['Bayer Leverkusen', 84], ['Borussia Dortmund', 84], ['RB Leipzig', 82],
      ['Eintracht Frankfurt', 80], ['Stuttgart', 80], ['Freiburg', 77], ['Wolfsburg', 76],
      ["Borussia M'gladbach", 75], ['Union Berlin', 74],
    ],
  },
  {
    id: 'FR', name: 'França', flag: '🇫🇷', confed: 'UEFA', nat: 89,
    leagues: ['Ligue 1'], cup: 'Copa da França', top: 3,
    clubs: [
      ['Paris Saint-Germain', 88], ['Olympique de Marseille', 81], ['Monaco', 81], ['Lille', 79],
      ['Lyon', 79], ['Nice', 77], ['Lens', 77], ['Rennes', 76], ['Nantes', 72], ['Strasbourg', 74],
    ],
  },
  {
    id: 'NL', name: 'Holanda', flag: '🇳🇱', confed: 'UEFA', nat: 85,
    leagues: ['Eredivisie'], cup: 'Copa da Holanda', top: 2,
    clubs: [
      ['PSV', 80], ['Feyenoord', 79], ['Ajax', 78], ['AZ Alkmaar', 75],
      ['Twente', 74], ['Utrecht', 72], ['Heerenveen', 67], ['Sparta Rotterdam', 65],
    ],
  },
  {
    id: 'TR', name: 'Turquia', flag: '🇹🇷', confed: 'UEFA', nat: 79,
    leagues: ['Süper Lig'], cup: 'Copa da Turquia', top: 2,
    clubs: [
      ['Galatasaray', 80], ['Fenerbahçe', 80], ['Beşiktaş', 77], ['Trabzonspor', 73],
      ['Başakşehir', 71], ['Samsunspor', 68], ['Göztepe', 67], ['Kasımpaşa', 66],
    ],
  },
  {
    id: 'SA', name: 'Arábia Saudita', flag: '🇸🇦', confed: 'AFC', nat: 72,
    leagues: ['Saudi Pro League'], cup: 'Copa do Rei', top: 3,
    clubs: [
      ['Al-Hilal', 80], ['Al-Nassr', 80], ['Al-Ittihad', 79], ['Al-Ahli', 78],
      ['Al-Qadsiah', 73], ['Al-Shabab', 72], ['Al-Ettifaq', 71], ['Al-Taawoun', 69],
    ],
  },
  {
    id: 'JP', name: 'Japão', flag: '🇯🇵', confed: 'AFC', nat: 79,
    leagues: ['J1 League'], cup: 'Copa do Imperador', top: 3,
    clubs: [
      ['Vissel Kobe', 71], ['Kawasaki Frontale', 70], ['Yokohama F. Marinos', 70], ['Kashima Antlers', 70],
      ['Sanfrecce Hiroshima', 70], ['Urawa Reds', 69], ['Gamba Osaka', 67], ['Cerezo Osaka', 66],
    ],
  },
];

// Estados brasileiros e seus clubes tradicionais: [nome, força, divisão]
const BR_STATES = [
  {
    uf: 'SP', name: 'São Paulo', estadual: 'Campeonato Paulista', clubs: [
      ['Palmeiras', 82, 1], ['São Paulo', 78, 1], ['Corinthians', 77, 1], ['Santos', 74, 1],
      ['RB Bragantino', 74, 1], ['Mirassol', 70, 1], ['Novorizontino', 64, 2], ['Ponte Preta', 62, 2],
      ['Guarani', 60, 3], ['Portuguesa', 56, 4],
    ],
  },
  {
    uf: 'RJ', name: 'Rio de Janeiro', estadual: 'Campeonato Carioca', clubs: [
      ['Flamengo', 84, 1], ['Botafogo', 79, 1], ['Fluminense', 77, 1], ['Vasco da Gama', 74, 1],
      ['Volta Redonda', 60, 3], ['Bangu', 52, 4], ['Madureira', 52, 4],
    ],
  },
  {
    uf: 'MG', name: 'Minas Gerais', estadual: 'Campeonato Mineiro', clubs: [
      ['Atlético Mineiro', 78, 1], ['Cruzeiro', 78, 1], ['América Mineiro', 65, 2],
      ['Athletic Club', 60, 2], ['Tombense', 58, 3], ['Tupi', 52, 4],
    ],
  },
  {
    uf: 'RS', name: 'Rio Grande do Sul', estadual: 'Campeonato Gaúcho', clubs: [
      ['Internacional', 77, 1], ['Grêmio', 76, 1], ['Juventude', 66, 2], ['Caxias', 59, 3],
      ['Ypiranga', 58, 3], ['Brasil de Pelotas', 54, 4],
    ],
  },
  {
    uf: 'PR', name: 'Paraná', estadual: 'Campeonato Paranaense', clubs: [
      ['Athletico Paranaense', 71, 1], ['Coritiba', 69, 1], ['Operário Ferroviário', 63, 2],
      ['Londrina', 59, 3], ['Paraná Clube', 53, 4],
    ],
  },
  {
    uf: 'SC', name: 'Santa Catarina', estadual: 'Campeonato Catarinense', clubs: [
      ['Chapecoense', 66, 1], ['Criciúma', 64, 2], ['Avaí', 63, 2], ['Figueirense', 58, 3], ['Joinville', 53, 4],
    ],
  },
  {
    uf: 'BA', name: 'Bahia', estadual: 'Campeonato Baiano', clubs: [
      ['Bahia', 76, 1], ['Vitória', 69, 1], ['Jacuipense', 52, 4], ['Juazeirense', 51, 4],
    ],
  },
  {
    uf: 'PE', name: 'Pernambuco', estadual: 'Campeonato Pernambucano', clubs: [
      ['Sport', 66, 2], ['Náutico', 60, 3], ['Retrô', 56, 3], ['Santa Cruz', 56, 4],
    ],
  },
  {
    uf: 'CE', name: 'Ceará', estadual: 'Campeonato Cearense', clubs: [
      ['Fortaleza', 69, 2], ['Ceará', 67, 2], ['Ferroviário', 56, 3], ['Floresta', 55, 3],
    ],
  },
  {
    uf: 'GO', name: 'Goiás', estadual: 'Campeonato Goiano', clubs: [
      ['Goiás', 65, 2], ['Atlético Goianiense', 64, 2], ['Vila Nova', 63, 2],
      ['Aparecidense', 53, 4], ['Anápolis', 52, 4], ['Goiânia', 50, 4],
    ],
  },
  {
    uf: 'PA', name: 'Pará', estadual: 'Campeonato Paraense', clubs: [
      ['Remo', 66, 1], ['Paysandu', 61, 3], ['Tuna Luso', 51, 4], ['Águia de Marabá', 50, 4],
    ],
  },
  {
    uf: 'AM', name: 'Amazonas', estadual: 'Campeonato Amazonense', clubs: [
      ['Amazonas FC', 60, 2], ['Manaus', 52, 4], ['Nacional (AM)', 50, 4],
    ],
  },
  {
    uf: 'MT', name: 'Mato Grosso', estadual: 'Campeonato Mato-Grossense', clubs: [
      ['Cuiabá', 64, 2], ['Mixto', 50, 4], ['Luverdense', 50, 4],
    ],
  },
  {
    uf: 'DF', name: 'Distrito Federal', estadual: 'Campeonato Candango', clubs: [
      ['Brasiliense', 53, 4], ['Gama', 52, 4], ['Capital', 51, 4],
    ],
  },
  {
    uf: 'AL', name: 'Alagoas', estadual: 'Campeonato Alagoano', clubs: [
      ['CRB', 62, 2], ['CSA', 58, 3], ['ASA', 50, 4],
    ],
  },
  {
    uf: 'RN', name: 'Rio Grande do Norte', estadual: 'Campeonato Potiguar', clubs: [
      ['ABC', 57, 3], ['América (RN)', 56, 3],
    ],
  },
  {
    uf: 'PB', name: 'Paraíba', estadual: 'Campeonato Paraibano', clubs: [
      ['Botafogo (PB)', 57, 3], ['Treze', 52, 4], ['Campinense', 51, 4],
    ],
  },
  {
    uf: 'MA', name: 'Maranhão', estadual: 'Campeonato Maranhense', clubs: [
      ['Sampaio Corrêa', 54, 4], ['Moto Club', 51, 4],
    ],
  },
];

const POSITIONS = [
  { id: 'GOL', name: 'Goleiro', icon: '🧤' },
  { id: 'ZAG', name: 'Zagueiro', icon: '🛡️' },
  { id: 'MEI', name: 'Meio-campista', icon: '🎯' },
  { id: 'ATA', name: 'Atacante', icon: '⚽' },
];

// Times genéricos de seleções adversárias
const NATION_RIVALS = [
  ['Brasil', 87], ['Argentina', 88], ['França', 89], ['Espanha', 89], ['Inglaterra', 88],
  ['Portugal', 87], ['Alemanha', 86], ['Holanda', 85], ['Itália', 84], ['Bélgica', 83],
  ['Croácia', 82], ['Uruguai', 82], ['Colômbia', 82], ['Marrocos', 81], ['Japão', 79],
  ['Turquia', 79], ['México', 78], ['Estados Unidos', 78], ['Senegal', 78], ['Suíça', 79],
  ['Dinamarca', 80], ['Equador', 78], ['Coreia do Sul', 76], ['Paraguai', 76], ['Chile', 75],
  ['Arábia Saudita', 72], ['Austrália', 74], ['Canadá', 75], ['Nigéria', 76], ['Irã', 74],
];

// Ídolos históricos: só esses clubes têm o "conselho do ídolo"
// [nome do ídolo, conselho]
const IDOLS = {
  'Flamengo': ['Zico', 'Treina falta até a perna pedir pra parar. Foi assim que eu fiz no Maracanã.'],
  'Palmeiras': ['Marcos', 'Aqui a cobrança é diária. Quem aguenta a pressão do Allianz vira eterno.'],
  'Corinthians': ['Marcelinho Carioca', 'A Fiel não perdoa quem corre pouco. Deixa o sangue em campo.'],
  'São Paulo': ['Rogério Ceni', 'Disciplina é tudo. Seja o primeiro a chegar e o último a sair do CT.'],
  'Vasco da Gama': ['Juninho Pernambucano', 'Bola parada decide título. Treina até acertar dez seguidas.'],
  'Fluminense': ['Fred', 'Dentro da área você tem que ser frio. Pensa rápido e bate seco.'],
  'Botafogo': ['Jairzinho', 'Joga com alegria, garoto. Essa camisa foi feita para quem ousa.'],
  'Grêmio': ['Renato Gaúcho', 'Confiança, guri! Quem não acredita em si não ganha nada.'],
  'Internacional': ['Falcão', 'Leia o jogo antes da bola chegar. Inteligência ganha campeonato.'],
  'Atlético Mineiro': ['Reinaldo', 'A Massa empurra o time. Retribui com entrega em cada lance.'],
  'Cruzeiro': ['Tostão', 'Futebol é simples: passe certo, movimentação e humildade.'],
  'Bahia': ['Bobô', 'O torcedor tricolor é apaixonado. Respeita essa história.'],
  'Boca Juniors': ['Riquelme', 'Na Bombonera a bola tem que ser sua. Pede ela sempre.'],
  'River Plate': ['Enzo Francescoli', 'Elegância e gol. Jogar bonito também é jogar para ganhar.'],
  'Barcelona': ['Messi', 'Joga simples e se diverte. O resto vem naturalmente.'],
  'Real Madrid': ['Raúl', 'Aqui só existe uma opção: ganhar. Todo ano, toda competição.'],
  'Atlético de Madrid': ['Fernando Torres', 'Luta em cada bola. O Atleti é coração antes de tudo.'],
  'Manchester United': ['Paul Scholes', 'Passe curto, cabeça erguida e trabalho duro, todos os dias.'],
  'Liverpool': ['Steven Gerrard', 'Em Anfield você nunca caminha sozinho. Lidera pelo exemplo.'],
  'Arsenal': ['Thierry Henry', 'Velocidade é arma, mas a calma na finalização é o que separa os grandes.'],
  'Chelsea': ['Frank Lampard', 'Chega na área de trás. Meia que faz gol vale ouro.'],
  'Manchester City': ['Sergio Agüero', 'Um gol pode mudar a história de um clube. Esteja pronto para ele.'],
  'Juventus': ['Alessandro Del Piero', 'Fidelidade e classe. A Juve se lembra de quem fica nos momentos difíceis.'],
  'Milan': ['Paolo Maldini', 'Concentração por 90 minutos. Um erro e o San Siro não esquece.'],
  'Inter de Milão': ['Javier Zanetti', 'Profissionalismo é o seu maior talento. Cuide do corpo.'],
  'Roma': ['Francesco Totti', 'Um clube, uma cidade, uma vida. Pensa nisso antes de qualquer proposta.'],
  'Napoli': ['Marek Hamšík', 'Nápoles te ama se você amar Nápoles. Simples assim.'],
  'Bayern de Munique': ['Oliver Kahn', 'Aqui no Bayern o segundo lugar não existe. Nunca desista.'],
  'Borussia Dortmund': ['Marco Reus', 'A Muralha Amarela te carrega. Dá tudo por ela.'],
  'Ajax': ['Marco van Basten', 'Técnica primeiro. A escola do Ajax forma craques, não atletas.'],
  'Benfica': ['Rui Costa', 'O Benfica é uma família gigante. Honre o manto.'],
  'Porto': ['Vítor Baía', 'O Dragão exige vencer. A mentalidade vencedora se treina.'],
  'Paris Saint-Germain': ['Raí', 'Paris é exigente, mas reconhece quem joga com o coração.'],
  'Galatasaray': ['Gheorghe Hagi', 'O inferno do Galatasaray é seu aliado. Sinta a energia.'],
  'Fenerbahçe': ['Alex de Souza', 'Eu era estrangeiro e virei estátua aqui. Você também pode.'],
  'Peñarol': ['Fernando Morena', 'Garra charrua, gol e mais gol.'],
  'Nacional (URU)': ['Álvaro Recoba', 'Uma canhota bem treinada resolve qualquer clássico.'],
  'Club América': ['Cuauhtémoc Blanco', 'Personalidade! No Azteca o tímido some.'],
  'Atlético Nacional': ['René Higuita', 'Ousadia, mas com responsabilidade.'],
  'Al-Hilal': ['Sami Al-Jaber', 'Aqui a cobrança por títulos asiáticos é enorme. Esteja pronto.'],
  'LA Galaxy': ['Landon Donovan', 'Seja o exemplo dentro e fora de campo.'],
};

const SHIRT_COLORS = [
  { id: 'verde', name: 'Verde', main: '#0e6b3c', trim: '#f5d300' },
  { id: 'preto', name: 'Preto', main: '#121614', trim: '#f5d300' },
  { id: 'amarelo', name: 'Amarelo', main: '#f5d300', trim: '#0b1f15' },
  { id: 'branco', name: 'Branco', main: '#eef1ef', trim: '#0e6b3c' },
  { id: 'vermelho', name: 'Vermelho', main: '#b5121b', trim: '#f4f4f4' },
  { id: 'azul', name: 'Azul', main: '#1b3fa6', trim: '#f4f4f4' },
];
