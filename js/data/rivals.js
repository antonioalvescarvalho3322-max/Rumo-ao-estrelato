/**
 * @file Clássicos famosos de cada país.
 *
 * Quando o clube do jogador e o rival estão na mesma liga, o clássico da liga vira um jogo
 * jogado lance a lance (um no primeiro turno e outro no segundo).
 * Formato: [clube A, clube B, nome do clássico]. Para adicionar um clássico, inclua uma linha.
 */
'use strict';

/** @type {Array<[string, string, string]>} */
const CLASSICS = [
  // Brasil
  ['Flamengo', 'Vasco da Gama', 'Clássico dos Milhões'],
  ['Flamengo', 'Fluminense', 'Fla-Flu'],
  ['Flamengo', 'Botafogo', 'Clássico da Rivalidade'],
  ['Fluminense', 'Vasco da Gama', 'Clássico dos Gigantes'],
  ['Botafogo', 'Fluminense', 'Clássico Vovô'],
  ['Botafogo', 'Vasco da Gama', 'Clássico da Amizade'],
  ['Corinthians', 'Palmeiras', 'Derby Paulista'],
  ['São Paulo', 'Corinthians', 'Majestoso'],
  ['Palmeiras', 'São Paulo', 'Choque-Rei'],
  ['Santos', 'Corinthians', 'Clássico Alvinegro'],
  ['Santos', 'São Paulo', 'San-São'],
  ['Santos', 'Palmeiras', 'Clássico da Saudade'],
  ['Guarani', 'Ponte Preta', 'Dérbi Campineiro'],
  ['Grêmio', 'Internacional', 'Gre-Nal'],
  ['Juventude', 'Caxias', 'Ca-Ju'],
  ['Atlético Mineiro', 'Cruzeiro', 'Clássico Mineiro'],
  ['Athletico Paranaense', 'Coritiba', 'Atletiba'],
  ['Bahia', 'Vitória', 'Ba-Vi'],
  ['Sport', 'Náutico', 'Clássico dos Clássicos'],
  ['Sport', 'Santa Cruz', 'Clássico das Multidões'],
  ['Fortaleza', 'Ceará', 'Clássico-Rei'],
  ['Remo', 'Paysandu', 'Re-Pa'],
  ['Goiás', 'Vila Nova', 'Clássico Goiano'],
  ['Goiás', 'Atlético Goianiense', 'Clássico Goiano'],
  ['Avaí', 'Figueirense', 'Clássico da Ilha'],
  ['CRB', 'CSA', 'Clássico das Multidões'],
  ['ABC', 'América (RN)', 'Clássico-Rei'],
  ['Botafogo (PB)', 'Treze', 'Clássico Tradição'],
  // América do Sul
  ['Boca Juniors', 'River Plate', 'Superclássico'],
  ['Racing', 'Independiente', 'Clássico de Avellaneda'],
  ['Rosario Central', "Newell's Old Boys", 'Clássico Rosarino'],
  ['Peñarol', 'Nacional (URU)', 'Clássico Uruguaio'],
  ['Atlético Nacional', 'Independiente Medellín', 'Clássico Paisa'],
  ['Millonarios', 'Santa Fe', 'Clássico Capitalino'],
  ['Colo-Colo', 'Universidad de Chile', 'Superclássico Chileno'],
  ['Olimpia', 'Cerro Porteño', 'Superclássico Paraguaio'],
  // CONCACAF
  ['Club América', 'Chivas Guadalajara', 'Clásico Nacional'],
  ['Monterrey', 'Tigres UANL', 'Clásico Regio'],
  ['LAFC', 'LA Galaxy', 'El Tráfico'],
  // Europa
  ['Real Madrid', 'Barcelona', 'El Clásico'],
  ['Real Madrid', 'Atlético de Madrid', 'Derbi Madrileño'],
  ['Real Betis', 'Sevilla', 'Derbi Sevillano'],
  ['Athletic Bilbao', 'Real Sociedad', 'Derbi Basco'],
  ['Manchester United', 'Liverpool', 'Clássico do Noroeste'],
  ['Manchester City', 'Manchester United', 'Derby de Manchester'],
  ['Arsenal', 'Tottenham', 'Derby do Norte de Londres'],
  ['Liverpool', 'Everton', 'Derby de Merseyside'],
  ['Inter de Milão', 'Milan', 'Derby della Madonnina'],
  ['Roma', 'Lazio', 'Derby della Capitale'],
  ['Juventus', 'Inter de Milão', "Derby d'Italia"],
  ['Borussia Dortmund', 'Bayern de Munique', 'Der Klassiker'],
  ['Paris Saint-Germain', 'Olympique de Marseille', 'Le Classique'],
  ['Ajax', 'Feyenoord', 'De Klassieker'],
  ['Benfica', 'Porto', 'O Clássico'],
  ['Sporting', 'Benfica', 'Derby de Lisboa'],
  ['Galatasaray', 'Fenerbahçe', 'Derby Intercontinental'],
  // Ásia
  ['Al-Hilal', 'Al-Nassr', 'Derby de Riad'],
  ['Gamba Osaka', 'Cerezo Osaka', 'Derby de Osaka'],
];
