/**
 * @file Funções utilitárias puras: sorteios, matemática, formatação e escape de HTML.
 * Não dependem do estado do jogo nem do DOM, por isso podem ser usadas em qualquer módulo.
 */
'use strict';

/** Namespace das funções utilitárias. */
const Util = (() => {
  /**
   * Número aleatório no intervalo [0, 1).
   * @returns {number}
   */
  const rnd = () => Math.random();

  /**
   * Limita um valor ao intervalo [min, max].
   * @param {number} value Valor de entrada.
   * @param {number} min Limite inferior.
   * @param {number} max Limite superior.
   * @returns {number} O valor ajustado ao intervalo.
   */
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  /**
   * Inteiro aleatório entre a e b (inclusive).
   * @param {number} a Menor valor possível.
   * @param {number} b Maior valor possível.
   * @returns {number}
   */
  const randInt = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  /**
   * Número real aleatório entre a e b.
   * @param {number} a Início do intervalo.
   * @param {number} b Fim do intervalo.
   * @returns {number}
   */
  const randRange = (a, b) => a + rnd() * (b - a);

  /**
   * Sorteia um item de uma lista.
   * @template T
   * @param {T[]} list Lista não vazia.
   * @returns {T}
   */
  const pick = list => list[Math.floor(rnd() * list.length)];

  /**
   * Retorna uma cópia embaralhada da lista (Fisher–Yates).
   * @template T
   * @param {T[]} list Lista original (não é alterada).
   * @returns {T[]}
   */
  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * Sorteia um item com probabilidade proporcional ao peso.
   * @template T
   * @param {T[]} items Itens candidatos.
   * @param {(item: T) => number} weightOf Função que devolve o peso (>= 0) de cada item.
   * @returns {T}
   */
  function weighted(items, weightOf) {
    const weights = items.map(weightOf);
    let ticket = weights.reduce((a, b) => a + b, 0) * rnd();
    for (let i = 0; i < items.length; i++) {
      ticket -= weights[i];
      if (ticket <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /**
   * Sorteia um número de eventos de uma distribuição de Poisson (usado para gols).
   * @param {number} lambda Média esperada de eventos.
   * @returns {number}
   */
  function poisson(lambda) {
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rnd();
    } while (p > limit);
    return k - 1;
  }

  /**
   * Escapa texto para ser inserido com segurança dentro de HTML.
   * @param {unknown} text Texto qualquer (ex.: nome digitado pelo jogador).
   * @returns {string}
   */
  function esc(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(text).replace(/[&<>"']/g, c => map[c]);
  }

  /**
   * Formata um valor em milhares de euros (ex.: 1500 → "€ 1,5 mi").
   * @param {number} thousands Valor em mil euros.
   * @returns {string}
   */
  function fmtMoney(thousands) {
    const negative = thousands < 0;
    const abs = Math.abs(thousands);
    const text = abs >= 1000 ? `${(abs / 1000).toFixed(1).replace('.', ',')} mi` : `${Math.round(abs)} mil`;
    return `${negative ? '-' : ''}€ ${text}`;
  }

  /**
   * Escreve uma quantidade com a palavra no singular ou plural.
   * @param {number} n Quantidade.
   * @param {string} one Palavra no singular.
   * @param {string} many Palavra no plural.
   * @returns {string} Ex.: "1 gol", "3 gols".
   */
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /**
   * Formata um número com sinal (+3, -2, 0).
   * @param {number} n Número inteiro.
   * @returns {string}
   */
  const signed = n => (n > 0 ? `+${n}` : `${n}`);

  /**
   * Cria um identificador simples a partir de um nome (sem acentos, minúsculo, com hífens).
   * Usado, por exemplo, para o nome de arquivo dos escudos.
   * @param {string} name Nome original.
   * @returns {string} Ex.: "São Paulo" → "sao-paulo".
   */
  function slug(name) {
    return name.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  /**
   * Escolhe preto ou branco para escrever sobre uma cor de fundo, pelo contraste.
   * @param {string} hex Cor de fundo no formato #rrggbb.
   * @returns {string} '#111111' para fundos claros ou '#ffffff' para fundos escuros.
   */
  function contrastText(hex) {
    const value = parseInt(hex.slice(1), 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#111111' : '#ffffff';
  }

  /**
   * Cria um gerador de números aleatórios com semente: o mesmo texto gera sempre a mesma sequência.
   * Usado para que a cartinha do jogador saia igual toda vez que for desenhada.
   * @param {string} seedText Texto de origem (ex.: nome do jogador).
   * @returns {() => number} Função que devolve números em [0, 1).
   */
  function seeded(seedText) {
    let h = 2166136261;
    for (const ch of String(seedText)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  return { seeded, rnd, clamp, randInt, randRange, pick, shuffle, weighted, poisson, esc, fmtMoney, plural, signed, slug, contrastText };
})();
