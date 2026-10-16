/**
 * @file Escudos oficiais dos clubes.
 *
 * Cada entrada aponta para uma imagem dentro de assets/escudos/ e pode trazer as cores
 * extraídas do próprio escudo (elas passam a valer para a camisa do jogador):
 *
 *   'Flamengo': { src: 'assets/escudos/flamengo.png', colors: ['#c8102e', '#111111'] },
 *
 * O nome do arquivo segue Util.slug(nomeDoClube) + '.png'.
 * Enquanto um clube não tiver entrada aqui, o jogo mostra só o nome (nenhum escudo inventado).
 */
'use strict';

/** @type {Object<string, {src: string, colors?: [string, string]}>} */
const CRESTS = {};
