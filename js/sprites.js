/* Pioneer Valley Risk — pixel-art sprites.
 *
 * Sprites are 16x16 (or smaller) ASCII grids; each character is a palette
 * key, '.' is transparent. RV.paintSprite() renders one to a canvas,
 * optionally substituting a player color for the 'C' slot.
 */
(function () {
  'use strict';

  window.RV = window.RV || {};
  var P = RV;

  // Palette: key -> color
  var PAL = {
    g: '#3fae4a', // grass base
    l: '#57c85f', // grass light
    d: '#2f8f3a', // grass dark
    u: '#4cbf55', // grass mid
    t: '#7a4a21', // tree trunk
    f: '#1e7a33', // tree leaves
    F: '#37a04a', // leaves light
    m: '#8b8b96', // rock
    i: '#b9b9c4', // rock light
    j: '#5f5f6b', // rock dark
    s: '#f4f7fb', // snow
    h: '#c98a3d', // hill
    e: '#a06a2a', // hill shade
    y: '#ffd23f', // flower yellow
    v: '#ff7ab8', // flower pink
    w: '#2f7fd8', // water
    W: '#63b1f2', // water light
    z: '#245fae', // deep water (reservoir)
    o: '#f4f4f4', // die face
    O: '#d9d9e3', // die shade
    X: '#1c1c28', // pip
    q: '#9aa0b4', // pole metal
    n: '#f2c79a', // skin
    k: '#23232e', // dark outline
    R: '#e33b32', // die rim: red (the computer)
    B: '#3b6de3', // die rim: blue (you)
    r: '#d64541', // roof
    a: '#f7f3e8', // house wall
    b: '#8a5a2b', // door
    G: '#ffd23f', // star gold
  };

  // ---------------------------------------------------------------- grass --
  var GRASS_A = [
    'gggggggggggggggg',
    'gggglggggggdgugg',
    'gggggggggllggggg',
    'ggdggggggggggggg',
    'gggggggggggggugg',
    'ggggdugggggggggg',
    'uggggggggggduggg',
    'ggggggggggggggug',
    'gggggggduggggggg',
    'gggllggggggggggd',
    'ggggggggggggdugg',
    'gdgggggggggggggg',
    'ggggggggggggggll',
    'ggggdugggggggggu',
    'gggggggggggggggg',
    'uggggggggggggggd',
  ];
  var GRASS_B = [
    'gggugdgglggggggg',
    'gggggggggggggggu',
    'gdgggggugggggggg',
    'gggggggggggggglg',
    'ggllgggggggugggg',
    'gggggggggggggggg',
    'ggggdgugllgggggg',
    'uggggggggggggdgg',
    'gggggggglggggggg',
    'gggugggggggggggu',
    'gggggggdgggllggg',
    'dguggggggggggggg',
    'gggggggggggdugug',
    'gllggggggggggggg',
    'gggggggggugdgglg',
    'gggggggggggggggu',
  ];
  var GRASS_C = [
    'gggggggggggggggg',
    'ggggdggguggggggg',
    'uglgggggggggdgug',
    'gggggggggggggggg',
    'gggggggggduggggg',
    'gggggllggggggggd',
    'gggggggggggggugg',
    'dggggggggggggggg',
    'gggggugggggggggg',
    'gggggggggggllggg',
    'gggggggggggggggg',
    'ggugdgglgggggggg',
    'ggggggggggdggugg',
    'gggggllggggggggg',
    'lggggggggggggdgg',
    'gggggggggggggggg',
  ];

  // Tree stamp: 7 wide x 8 tall at (x,y)
  function stampTree(rows, x, y, flip) {
    var art = flip ? [
      '..fff..',
      '.fffff.',
      '.fffFff',
      'ffffff.',
      '.fffff.',
      '..fff..',
      '...t...',
      '...t...',
    ] : [
      '..fff..',
      '.fffff.',
      '.ffFfff',
      '.fffff.',
      '.fffff.',
      '..fff..',
      '...t...',
      '...t...',
    ];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 7; c++) {
        var ch = art[r][c];
        if (ch !== '.') rows[y + r][x + c] = ch;
      }
    }
  }

  function clone(rows) { return rows.map(function (r) { return r.split(''); }); }
  function join(rows) { return rows.map(function (r) { return r.join(''); }); }

  var FOREST_A = (function () {
    var r = clone(GRASS_A);
    stampTree(r, 2, 3, false);
    stampTree(r, 9, 7, true);
    return join(r);
  })();
  var FOREST_B = (function () {
    var r = clone(GRASS_B);
    stampTree(r, 9, 2, false);
    stampTree(r, 3, 8, true);
    return join(r);
  })();
  var FOREST_C = (function () {
    var r = clone(GRASS_C);
    stampTree(r, 5, 4, true);
    return join(r);
  })();

  // Mountain stamp: 10 wide x 9 tall peak
  function stampMountain(rows, x, y) {
    var art = [
      '.....ss.....',
      '....ssss....',
      '....smis....',
      '...mimmi....',
      '...mmimim...',
      '..mimjmmi...',
      '..mmmjmmm...',
      '.mjmmmjmm...',
      '.mjmjmjmjm..',
    ];
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 10; c++) {
        var ch = art[r][c];
        if (ch !== '.') rows[y + r][x + c] = ch;
      }
    }
  }

  var MOUNTAIN_A = (function () {
    var r = clone(GRASS_A);
    stampMountain(r, 3, 4);
    return join(r);
  })();
  var MOUNTAIN_B = (function () {
    var r = clone(GRASS_B);
    stampMountain(r, 5, 3);
    return join(r);
  })();
  var MOUNTAIN_C = (function () {
    var r = clone(GRASS_C);
    stampMountain(r, 2, 5);
    return join(r);
  })();

  // Hill bump: 8 wide x 4 tall
  function stampHill(rows, x, y) {
    var art = [
      '..hhhh..',
      '.hhhhhh.',
      'hhhhhhhh',
      'hehhhheh',
    ];
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 8; c++) {
        var ch = art[r][c];
        if (ch !== '.') rows[y + r][x + c] = ch;
      }
    }
  }

  var HILLS_A = (function () {
    var r = clone(GRASS_A);
    stampHill(r, 2, 6);
    stampHill(r, 8, 10);
    r[4][12] = 'y'; r[11][4] = 'v'; r[13][13] = 'y';
    return join(r);
  })();
  var HILLS_B = (function () {
    var r = clone(GRASS_B);
    stampHill(r, 7, 4);
    stampHill(r, 1, 11);
    r[6][3] = 'v'; r[12][12] = 'y';
    return join(r);
  })();
  var HILLS_C = (function () {
    var r = clone(GRASS_C);
    stampHill(r, 4, 7);
    r[3][8] = 'y'; r[14][5] = 'v'; r[9][13] = 'y';
    return join(r);
  })();

  // River: vertical flow
  var RIVER = [
    'wwwwwwwwwwwwwwww',
    'wwwwWwwwwwwwwwww',
    'wwwwwwwwwWwwwwww',
    'wWWwwwwwwwwwwwW.',
    'wwwwwwwWwwwwwwww',
    'wwwWwwwwwwwwWWww',
    'wwwwwwwwwwwwwwww',
    'wwwwWwwwwwwwwwww',
    'wwwwwwwwWwwwwwww',
    'wwwwwwwwwwwwWwww',
    'wwWwwwwwwwwwwwww',
    'wwwwwwwwWwwwwwww',
    'wwwwWWwwwwwwwwww',
    'wwwwwwwwwwwwwWww',
    'wwWwwwwwwwwwwwww',
    'wwwwwwwwwwwwwwww',
  ].map(function (row) { return row.replace('.', 'w'); });

  // Reservoir: deeper, calmer water
  var LAKE = RIVER.map(function (row, y) {
    return row.replace(/W/g, y % 5 === 2 ? 'W' : 'w').replace(/w/g, function (c, x) {
      return ((x * 7 + y * 3) % 11 === 0) ? 'z' : 'w';
    });
  });

  // House marker (10 wide x 9 tall), drawn at a territory's heart
  var HOUSE = [
    '....rr....',
    '...rrrr...',
    '..rrrrrr..',
    '.rrrrrrrr.',
    '..aaaaaa..',
    '..aaaaaa..',
    '..abaaba..',
    '..abaaba..',
    '..aaaaaa..',
  ];

  // ---------------------------------------------------------------- dice --
  // 16x16 die, pip layout per face (positions on a 4x4 logical grid)
  var PIP_POS = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]],
    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  };

  function makeDie(face, rimColor) {
    var rows = [];
    for (var y = 0; y < 16; y++) rows.push(new Array(16).fill('.'));
    // body with cut corners
    for (y = 1; y <= 14; y++) {
      for (var x = 1; x <= 14; x++) {
        var onEdge = (x === 1 || x === 14 || y === 1 || y === 14);
        var corner = ((x <= 2 && y <= 2) || (x >= 13 && y <= 2) ||
                      (x <= 2 && y >= 13) || (x >= 13 && y >= 13)) && onEdge;
        if (corner) continue;
        if (onEdge) rows[y][x] = rimColor;
        else rows[y][x] = (y > 10 && x > 10) ? 'O' : 'o';
      }
    }
    // pips: 2x2 blocks on a 3x3 logical grid
    (PIP_POS[face] || []).forEach(function (p) {
      var cx = 3 + p[0] * 4, cy = 3 + p[1] * 4;
      for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) {
        rows[cy + dy][cx + dx] = 'X';
      }
    });
    return rows.map(function (r) { return r.join(''); });
  }

  // Soldier unit icon, 14 wide x 12 tall. 'C' = owner color slot.
  var SOLDIER = [
    '....kkkkkk....',
    '...kCCCCCCk...',
    '...kCCCCCCk...',
    '....nnnnnn....',
    '....nnnnnn....',
    '..CC.CCCC.CC..',
    '..CC.CCCC.CC..',
    '...CCCCCCCC...',
    '...CCCCCCCC...',
    '...CCC..CCC...',
    '...CCC..CCC...',
    '...kk....kk...',
  ];

  // Flag: pole + 'C' banner, 10 wide x 14 tall
  var FLAG = [
    'q........',
    'qCCCCCCC.',
    'qCCCCCCC.',
    'qCCCCCCC.',
    'qCCCCCCC.',
    'q........',
    'q........',
    'q........',
    'q........',
    'q........',
    'q........',
    'q........',
    '.qq......',
    '.qq......',
  ];

  // Logo: 16x16 four-point star (gold)
  var STAR = [
    '.......GG.......',
    '......GGGG......',
    '.....GGGGGG.....',
    '....GGGGGGGG....',
    '...GGGGGGGGGG...',
    '..GGGGGGGGGGGG..',
    '.GGGGGGGGGGGGGG.',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
    '.GGGGGGGGGGGGGG.',
    '..GGGGGGGGGGGG..',
    '...GGGGGGGGGG...',
    '....GGGGGGGG....',
    '.....GGGGGG.....',
    '......GGGG......',
    '.......GG.......',
  ];

  P.PAL = PAL;
  P.SPR = {
    grass: [GRASS_A, GRASS_B, GRASS_C],
    forest: [FOREST_A, FOREST_B, FOREST_C],
    mountain: [MOUNTAIN_A, MOUNTAIN_B, MOUNTAIN_C],
    hills: [HILLS_A, HILLS_B, HILLS_C],
    river: RIVER,
    lake: LAKE,
    house: HOUSE,
    soldier: SOLDIER,
    flag: FLAG,
    star: STAR,
    dice: {},
  };
  for (var face = 1; face <= 6; face++) {
    P.SPR.dice[face] = {
      red: makeDie(face, 'R'),  // the computer's dice
      blue: makeDie(face, 'B'), // your dice
    };
  }

  // Terrain tile list per terrain type
  P.TERRAIN_TILES = {
    plains: 'grass',
    forest: 'forest',
    mountain: 'mountain',
    hills: 'hills',
  };

  // Deterministic per-cell variant pick
  P.cellVariant = function (x, y, count) {
    var h = (x * 73856093) ^ (y * 19349663);
    h = (h ^ (h >> 13)) >>> 0;
    h = (h * 1274126177) >>> 0;
    return (h >>> 8) % count;
  };

  // Render a sprite row-array to a canvas.
  // opts.slotColor substitutes the 'C' slot; 'p' pole uses the slot too.
  P.paintSprite = function (rows, scale, slotColor) {
    scale = scale || 2;
    var w = rows[0].length, h = rows.length;
    var cv = document.createElement('canvas');
    cv.width = w * scale;
    cv.height = h * scale;
    var ctx = cv.getContext('2d');
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var ch = rows[y][x];
        if (ch === '.' || ch === ' ') continue;
        var col;
        if (ch === 'C') col = slotColor;
        else col = PAL[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return cv;
  };

  // Pre-rendered tile canvases (built once the DOM is available)
  P.TILES = null;
  P.buildTiles = function (scale) {
    var tiles = { scale: scale };
    ['grass', 'forest', 'mountain', 'hills'].forEach(function (key) {
      tiles[key] = P.SPR[key].map(function (rows) {
        return P.paintSprite(rows, scale);
      });
    });
    tiles.river = P.paintSprite(P.SPR.river, scale);
    tiles.lake = P.paintSprite(P.SPR.lake, scale);
    tiles.house = P.paintSprite(P.SPR.house, scale);
    tiles.star = P.paintSprite(P.SPR.star, scale);
    return tiles;
  };

  // Per-player-color unit sprites, cached
  var unitCache = {};
  P.unitSprite = function (kind, color) {
    var key = kind + ':' + color;
    if (!unitCache[key]) {
      unitCache[key] = P.paintSprite(
        kind === 'flag' ? P.SPR.flag : P.SPR.soldier, 1, color);
    }
    return unitCache[key];
  };
})();
