/**
 * @file Ídolos históricos dos clubes.
 * Apenas os clubes listados aqui têm o evento "Conselho do ídolo", em que o maior ídolo
 * do clube aparece no CT para aconselhar o jogador (uma vez por passagem pelo clube).
 * Formato: nome do clube → [nome do ídolo, conselho].
 */
'use strict';

/** @type {Object<string, [string, string]>} */
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
