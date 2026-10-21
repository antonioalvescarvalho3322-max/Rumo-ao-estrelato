/**
 * @file Cartinha de fim de carreira no estilo das cartas do FIFA.
 *
 * A carta é desenhada num <canvas> (para poder virar imagem PNG) e exibida como <img>,
 * o que permite, no celular, tocar e segurar para salvar. O visual depende do legado:
 *   - Superou o REI / Entre os GOATs: azul-noite com cristais e faixa dourada;
 *   - Craque: ouro; Bom jogador: prata; Jogador profissional: bronze.
 * O jogador pode colocar a própria foto e salvar a imagem na galeria.
 */
'use strict';

/** Namespace da cartinha. */
const PlayerCard = (() => {
  /** Tamanho da imagem gerada (pixels). */
  const W = 600;
  const H = 860;
  /** Lado máximo da foto guardada no salvamento (pixels), para não pesar no navegador. */
  const PHOTO_MAX = 640;
  const DISPLAY_FONT = "'Barlow Condensed', 'Arial Narrow', Impact, sans-serif";

  /** Paleta de cada estilo de carta. */
  const STYLES = {
    toty: { bg: ['#0b1a4a', '#183a8f', '#0a1236'], facet: '#6f9cff', text: '#ffffff', accent: '#f5d36b', border: ['#e9eef7', '#8a96ad'], streak: true },
    gold: { bg: ['#6b4f12', '#e6c25a', '#8d6a17'], facet: '#fff2b8', text: '#2b1d00', accent: '#2b1d00', border: ['#fff6cf', '#a8811f'], streak: false },
    silver: { bg: ['#565d66', '#d8dde3', '#7a828c'], facet: '#ffffff', text: '#1c2026', accent: '#1c2026', border: ['#ffffff', '#8b939c'], streak: false },
    bronze: { bg: ['#5a3214', '#c98a52', '#7a4520'], facet: '#ffd9b3', text: '#2a1406', accent: '#2a1406', border: ['#f4d1ae', '#8a5226'], streak: false },
  };

  /** Imagem da última carta gerada (reaproveitada ao salvar). @type {Blob|null} */
  let lastBlob = null;

  /**
   * Estilo da carta conforme o título de legado.
   * @param {string} tierId Identificador do legado (ver Progression.legacyTier).
   * @returns {Object}
   */
  function styleFor(tierId) {
    if (tierId === 'rei' || tierId === 'goat') return STYLES.toty;
    if (tierId === 'craque') return STYLES.gold;
    if (tierId === 'bom') return STYLES.silver;
    return STYLES.bronze;
  }

  /**
   * Traça o contorno da carta (escudo com recorte no topo, como as cartas do FIFA).
   * @param {CanvasRenderingContext2D} ctx Contexto de desenho.
   * @param {number} inset Recuo da borda (para desenhar a moldura por dentro).
   */
  function shapePath(ctx, inset = 0) {
    const i = inset;
    ctx.beginPath();
    ctx.moveTo(70 + i, 30 + i);
    ctx.lineTo(225, 30 + i);
    ctx.quadraticCurveTo(300, 62 + i, 375, 30 + i);
    ctx.lineTo(530 - i, 30 + i);
    ctx.quadraticCurveTo(548 - i, 72 + i, 580 - i, 84 + i);
    ctx.lineTo(580 - i, 742 - i);
    ctx.quadraticCurveTo(580 - i, 790 - i, 534 - i, 806 - i);
    ctx.lineTo(330, 848 - i);
    ctx.quadraticCurveTo(300, 858 - i, 270, 848 - i);
    ctx.lineTo(66 + i, 806 - i);
    ctx.quadraticCurveTo(20 + i, 790 - i, 20 + i, 742 - i);
    ctx.lineTo(20 + i, 84 + i);
    ctx.quadraticCurveTo(52 + i, 72 + i, 70 + i, 30 + i);
    ctx.closePath();
  }

  /**
   * Fundo: degradê, cristais (triângulos translúcidos) e, nas cartas especiais, a faixa dourada.
   * @param {CanvasRenderingContext2D} ctx Contexto de desenho.
   * @param {Object} style Paleta.
   * @param {() => number} random Gerador com semente.
   */
  function drawBackground(ctx, style, random) {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, style.bg[0]);
    grad.addColorStop(0.5, style.bg[1]);
    grad.addColorStop(1, style.bg[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = style.facet;
    for (let k = 0; k < 38; k++) {
      const x = random() * W;
      const y = random() * H * 0.8;
      const size = 40 + random() * 140;
      ctx.globalAlpha = 0.05 + random() * 0.16;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + size * (random() - 0.2), y + size * random());
      ctx.lineTo(x - size * random(), y + size * (0.4 + random()));
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (style.streak) {
      const gold = ctx.createLinearGradient(0, 260, W, 520);
      gold.addColorStop(0, '#7a5a17');
      gold.addColorStop(0.45, '#f7dc8a');
      gold.addColorStop(0.6, '#fff6d6');
      gold.addColorStop(1, '#a4781f');
      ctx.strokeStyle = gold;
      ctx.lineCap = 'round';
      ctx.lineWidth = 34;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(-20, 560);
      ctx.bezierCurveTo(160, 420, 360, 470, 640, 150);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Escurece a parte de baixo para o nome e os atributos ficarem legíveis.
    const shade = ctx.createLinearGradient(0, 470, 0, H);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, style === STYLES.toty ? 'rgba(4,10,35,.75)' : 'rgba(255,255,255,.18)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 470, W, H - 470);
  }

  /**
   * Desenha a foto do jogador (recortada para preencher a área e esmaecendo embaixo)
   * ou, sem foto, uma silhueta.
   * @param {CanvasRenderingContext2D} ctx Contexto de desenho.
   * @param {HTMLImageElement|null} photo Foto carregada.
   * @param {Object} style Paleta.
   */
  function drawPortrait(ctx, photo, style) {
    const box = { x: 160, y: 30, w: 440, h: 560 };
    if (!photo) {
      ctx.fillStyle = style.text;
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(box.x + box.w / 2, 250, 92, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(box.x + 40, 560);
      ctx.quadraticCurveTo(box.x + box.w / 2, 300, box.x + box.w - 40, 560);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    const layer = document.createElement('canvas');
    layer.width = box.w;
    layer.height = box.h;
    const lctx = layer.getContext('2d');
    const scale = Math.max(box.w / photo.width, box.h / photo.height);
    const dw = photo.width * scale;
    const dh = photo.height * scale;
    lctx.drawImage(photo, (box.w - dw) / 2, (box.h - dh) / 2.6, dw, dh);
    // Esmaece a foto nas bordas de cima, de baixo e da esquerda.
    lctx.globalCompositeOperation = 'destination-in';
    const fadeDown = lctx.createLinearGradient(0, 0, 0, box.h);
    fadeDown.addColorStop(0, 'rgba(0,0,0,0)');
    fadeDown.addColorStop(0.25, 'rgba(0,0,0,1)');
    fadeDown.addColorStop(0.72, 'rgba(0,0,0,1)');
    fadeDown.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = fadeDown;
    lctx.fillRect(0, 0, box.w, box.h);
    const fadeLeft = lctx.createLinearGradient(0, 0, box.w, 0);
    fadeLeft.addColorStop(0, 'rgba(0,0,0,0)');
    fadeLeft.addColorStop(0.3, 'rgba(0,0,0,1)');
    lctx.fillStyle = fadeLeft;
    lctx.fillRect(0, 0, box.w, box.h);
    ctx.drawImage(layer, box.x, box.y);
  }

  /**
   * Escreve um texto diminuindo a fonte até caber na largura.
   * @param {CanvasRenderingContext2D} ctx Contexto de desenho.
   * @param {string} text Texto.
   * @param {number} x Centro horizontal.
   * @param {number} y Linha de base.
   * @param {number} maxWidth Largura máxima.
   * @param {number} size Tamanho inicial da fonte.
   */
  function fitText(ctx, text, x, y, maxWidth, size) {
    let s = size;
    do {
      ctx.font = `800 ${s}px ${DISPLAY_FONT}`;
      s -= 2;
    } while (ctx.measureText(text).width > maxWidth && s > 20);
    ctx.fillText(text, x, y);
  }

  /**
   * Desenha a carta completa.
   * @param {HTMLCanvasElement} canvas Canvas de destino (W×H).
   * @param {HTMLImageElement|null} photo Foto do jogador.
   */
  function draw(canvas, photo) {
    const ctx = canvas.getContext('2d');
    const p = G.p;
    const tier = Progression.legacyTier();
    const style = styleFor(tier.id);
    const stats = Progression.cardStats();
    const random = Util.seeded(`${p.name}|${p.nat}|${p.pos}`);
    ctx.clearRect(0, 0, W, H);

    // Tudo o que é desenhado fica dentro do contorno da carta.
    ctx.save();
    shapePath(ctx);
    ctx.clip();
    drawBackground(ctx, style, random);
    drawPortrait(ctx, photo, style);
    ctx.restore();

    // Moldura metálica.
    const border = ctx.createLinearGradient(0, 0, W, H);
    border.addColorStop(0, style.border[0]);
    border.addColorStop(0.5, style.border[1]);
    border.addColorStop(1, style.border[0]);
    ctx.strokeStyle = border;
    ctx.lineWidth = 12;
    shapePath(ctx, 6);
    ctx.stroke();

    // Overall, posição e bandeira.
    ctx.fillStyle = style.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `800 128px ${DISPLAY_FONT}`;
    ctx.fillText(String(stats.ovr), 118, 190);
    ctx.font = `800 54px ${DISPLAY_FONT}`;
    ctx.fillText(p.pos, 118, 246);
    ctx.font = '50px sans-serif';
    ctx.fillText(World.country(p.nat).flag, 118, 316);
    ctx.font = `800 26px ${DISPLAY_FONT}`;
    ctx.fillText(`#${p.shirt}`, 118, 360);

    // Nome.
    fitText(ctx, p.name.toUpperCase(), W / 2, 640, 460, 64);

    // Linha divisória.
    ctx.strokeStyle = style.accent;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(110, 662);
    ctx.lineTo(490, 662);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Atributos.
    const startX = 95;
    const step = 82;
    stats.labels.forEach((label, i) => {
      const x = startX + i * step;
      ctx.font = `700 26px ${DISPLAY_FONT}`;
      ctx.fillText(label, x, 702);
      ctx.font = `800 50px ${DISPLAY_FONT}`;
      ctx.fillText(String(stats.values[i]), x, 752);
    });

    // Rodapé.
    ctx.font = `800 22px ${DISPLAY_FONT}`;
    ctx.fillText('RUMO AO', W / 2, 790);
    ctx.font = `700 15px ${DISPLAY_FONT}`;
    ctx.fillText(`ESTRELATO · ${tier.title.toUpperCase()}`, W / 2, 810);
  }

  /**
   * Carrega uma imagem a partir de um endereço (data URL).
   * @param {string} src Endereço da imagem.
   * @returns {Promise<HTMLImageElement|null>}
   */
  function loadImage(src) {
    return new Promise(resolve => {
      if (!src) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  /**
   * HTML da seção da cartinha na tela final. A imagem é preenchida por mount().
   * @returns {string}
   */
  function sectionHtml() {
    return `
      <h2>Sua cartinha</h2>
      <div class="fut">
        <img id="futCard" class="fut-card" alt="Cartinha de ${Util.esc(G.p.name)}" width="${W}" height="${H}">
        <div class="fut-actions">
          <label class="btn ghost fut-photo">${G.photo ? 'Trocar foto' : 'Colocar minha foto'}<input type="file" accept="image/*" data-input="photo" hidden></label>
          ${G.photo ? '<button class="btn ghost" data-act="card-remove-photo">Remover foto</button>' : ''}
          <button class="btn" data-act="card-save">Salvar imagem</button>
          <p class="hint" id="futStatus">No celular você também pode tocar e segurar a carta para salvar na galeria.</p>
        </div>
      </div>`;
  }

  /**
   * Desenha a carta e mostra na tela final (espera as fontes carregarem para o texto sair certo).
   * @returns {Promise<void>}
   */
  async function mount() {
    const target = document.getElementById('futCard');
    if (!target) return;
    try {
      if (document.fonts) await document.fonts.load(`800 64px ${DISPLAY_FONT}`);
    } catch (e) { /* segue com a fonte reserva */ }
    // A carreira pode ter sido apagada ("Nova carreira") enquanto as fontes carregavam.
    if (!G) return;
    const photo = await loadImage(G.photo);
    if (!G) return;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    draw(canvas, photo);
    target.src = canvas.toDataURL('image/png');
    lastBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  /**
   * Lê a foto escolhida, reduz o tamanho, guarda na carreira e redesenha a carta.
   * @param {File} file Arquivo de imagem escolhido pelo jogador.
   */
  function setPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const img = await loadImage(reader.result);
      if (!img) return status('Não foi possível abrir essa imagem. Tente outra foto.');
      const scale = Math.min(1, PHOTO_MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      G.photo = canvas.toDataURL('image/jpeg', 0.85);
      Store.save();
      Screens.final();
    };
    reader.readAsDataURL(file);
  }

  /** Tira a foto da carta. */
  function removePhoto() {
    G.photo = null;
    Store.save();
    Screens.final();
  }

  /**
   * Mostra uma mensagem abaixo dos botões da carta.
   * @param {string} text Mensagem.
   */
  function status(text) {
    const el = document.getElementById('futStatus');
    if (el) el.textContent = text;
  }

  /**
   * Salva a carta como imagem PNG. Tenta, nesta ordem:
   *   1. o salvamento do visualizador do Claude (quando o jogo roda no link de teste);
   *   2. o compartilhamento do celular, que tem a opção "Salvar imagem" (vai para a galeria);
   *   3. o download comum do navegador.
   */
  async function save() {
    if (!lastBlob) return status('A carta ainda está sendo desenhada. Tente de novo em um instante.');
    const filename = `cartinha-${Util.slug(G.p.name) || 'jogador'}.png`;

    if (window.claude && typeof window.claude.use === 'function') {
      const downloads = await window.claude.use('downloads');
      if (downloads) {
        try {
          await downloads.save({ filename, data: lastBlob });
          return status('Imagem salva.');
        } catch (e) {
          if (e && e.code === 'declined') return status('Salvamento cancelado.');
        }
      }
    }

    const file = typeof File === 'function' ? new File([lastBlob], filename, { type: 'image/png' }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Minha cartinha · Rumo ao Estrelato' });
        return status('Escolha "Salvar imagem" para guardar na galeria.');
      } catch (e) {
        if (e && e.name === 'AbortError') return status('Compartilhamento cancelado.');
      }
    }

    const url = URL.createObjectURL(lastBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    status('Imagem baixada. No celular, se não aparecer, toque e segure a carta para salvar.');
  }

  return { draw, sectionHtml, mount, setPhoto, removePhoto, save };
})();
