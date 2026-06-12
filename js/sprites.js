// Pixel-art sprites generated at boot from embedded pixel maps.
// No external image files: each sprite is a small offscreen canvas built from
// a string grid ('.' or space = transparent, other chars index the palette).

const PAL = {
  // player / neutral
  w: '#cdd9ea', d: '#5a7aa0', g: '#8593ad', b: '#3fa9f5', B: '#1c5e9c',
  // flame / warm
  o: '#ff9a3c', y: '#ffd76e',
  // straight (red saucer)
  r: '#ff6a6a', k: '#8a2020', R: '#ffd0d0', m: '#d06060',
  // sine (green)
  e: '#6aff8a', E: '#1f7a35', f: '#2fae52',
  // dart (orange)
  n: '#ffb050', N: '#a05a10',
  // turret (grey)
  t: '#9aa7bd', T: '#4a566e', c: '#cdd6e6', x: '#ff4040',
  // boss (purple)
  p: '#5d4a7a', P: '#b59ae0', q: '#2c2142', C: '#ff5080', W: '#ffd0e0',
};

// Build a canvas from a pixel map. Rows may have ragged lengths;
// anything outside a row or not in the palette is transparent.
function make(rows, scale = 2) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const cv = document.createElement('canvas');
  cv.width = w * scale;
  cv.height = h * scale;
  const ctx = cv.getContext('2d');
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < rows[j].length; i++) {
      const col = PAL[rows[j][i]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(i * scale, j * scale, scale, scale);
    }
  }
  return cv;
}

// White silhouette copy, used for hit flashes.
function whiten(src) {
  const cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  const ctx = cv.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

// Mirror the top half downward (for vertically symmetric ships).
function mirrorV(topRows) {
  return topRows.concat([...topRows].reverse());
}

// ------------------------------------------------------------------ player

const PLAYER_HULL = [
  '........dddd',
  '......ddwwwwd',
  '..ddddwwwwwwwdd',
  '.dwwwwwwbbBwwwwddddd',
  'dggwwwwbbbbBwwwwwwwwdddd',
  'dggggwwwwwwwwwwwwwwwwwwd',
  'dggggwwwwwwwwwwwwwwwwwwd',
  'dggwwwwrrrwwwwwwwwwwdddd',
  '.dwwwwwwrrwwwwwddddd',
  '..ddddwwwwwwwdd',
  '......ddwwwwd',
  '........dddd',
];

const FLAMES = [
  ['..yy', '.yooo', 'yooooo', '.yooo', '..yy'],
  ['..y', '.yoo', 'yoooo', '.yoo', '..y'],
  ['.yy', 'yooo', '.ooooo', 'yooo', '.yy'],
];

// ----------------------------------------------------------------- enemies

const STRAIGHT = (win) => [
  '....kkkkkk',
  '..kkrrrrrrkk',
  `.krrr${win}${win}rrrrrk`,
  `krrr${win}${win}${win}${win}rrrrrk`,
  `krrr${win}${win}${win}${win}rrrrrk`,
  `.krrr${win}${win}rrrrrk`,
  '..kkrrrrrrkk',
  '....kkkkkk',
];

const SINE = (flap) => [
  flap === 0 ? '....ff......f' : '.............',
  flap === 0 ? '...feef....ff' : '...ff......f',
  '..feeeef..ff' + (flap === 0 ? '' : 'f'),
  '.feeEEeeeff',
  'feeEEEEeeeef',
  'feeEEEEeeeef',
  '.feeEEeeeff',
  '..feeeef..ff' + (flap === 1 ? '' : 'f'),
  flap === 1 ? '...feef....ff' : '...ff......f',
  flap === 1 ? '....ff......f' : '.............',
];

const DART = [
  '.....NN',
  '..NNNnnNN',
  'NnnnnnnnnnNN',
  `Nnnnyy${'n'.repeat(6)}NN`,
  'NnnnnnnnnnNN',
  '..NNNnnNN',
  '.....NN',
];

// Dome bulging downward (bottom turret pose; flip vertically for the top).
const TURRET = (blink) => [
  'TttttttttttttT',
  'TttttttttttttT',
  `Tttt${blink ? 'xx' : 'tt'}ttttttttT` ,
  `.Ttt${blink ? 'xx' : 'tt'}ttttttT`,
  '.TttttttttttT',
  '..TTttttttTT',
  '....TTTTTT',
];

const BOSS = mirrorV([
  '.............qqqqqqqqqq',
  '..........qqqPPPPPPPPPPqqq',
  '........qqPPppppppppppppPPqq',
  '......qqPpppppppppppppppppPqq',
  '.....qPpppppqqqpppppppppppPPq',
  '....qPppppqqpppppppppppppppPq.q',
  '...qPppppqpppppppqqqqpppppppPqqPq',
  '..qPppppqppppppqqppppqqppppppPppPq',
  '.qPpppppqpppppqpppppppppqpppppPppPq',
  'qPpppppqppppppqpppppppppqppppppPpPq',
  'qPppppqpppppppqpppppppppqppppppPPPq',
  'qPppppqppppppppqpppppppqpppppppppPq',
  'qPppppqqppppppppqqqqqqqppppppppppPq',
]);

// ------------------------------------------------------------------ export

export const sprites = {
  player: make(PLAYER_HULL),
  playerWhite: null,
  flames: FLAMES.map((f) => make(f)),
  straight: [make(STRAIGHT('R')), make(STRAIGHT('m'))],
  sine: [make(SINE(0)), make(SINE(1))],
  dart: make(DART),
  dartWhite: null,
  turret: [make(TURRET(false)), make(TURRET(true))],
  boss: make(BOSS, 3),
  bossWhite: null,
};

sprites.playerWhite = whiten(sprites.player);
sprites.dartWhite = whiten(sprites.dart);
sprites.bossWhite = whiten(sprites.boss);

// Draw a sprite centered on (x, y). Positions are rounded so the pixel grid
// stays crisp; rotation skips rounding because it blurs anyway.
export function drawSprite(ctx, img, x, y, { rot = 0, flipY = false, scale = 1 } = {}) {
  ctx.save();
  if (rot) {
    ctx.translate(x, y);
    ctx.rotate(rot);
  } else {
    ctx.translate(Math.round(x), Math.round(y));
  }
  if (flipY) ctx.scale(1, -1);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
}
