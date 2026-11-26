/* Pioneer Valley Risk — map data.
 *
 * The board is an ASCII grid (RV.MAP_ROWS). Each character is one cell:
 *   a territory key (see RV.TERRITORIES), '~' river, '=' reservoir, '.' void.
 * Two towns border each other when their cells touch (including diagonally)
 * or, across a river, only where RV.BRIDGES lists a real bridge between them.
 * The Quabbin is wider than one cell, so it is never crossable.
 *
 * Layout is a stylized but geographically faithful sketch of the three
 * Pioneer Valley counties: Franklin (north), Hampshire (middle) and
 * Hampden (south). The Connecticut River runs north-south down the middle;
 * the Deerfield River enters it at Greenfield and the Westfield River at
 * West Springfield / Agawam. The Quabbin Reservoir sits to the east.
 * Each county is a region: hold all of it for a reinforcement bonus.
 */
window.RV = window.RV || {};

RV.MAP_ROWS = [
  'CCCCCCCCSSSSSSSGGGGGGG~NNNNNNNNOOOOOOOOOOO',
  'CCCCCCCCSSSSSSSGGGGGGG~NNNNNNNNOOOOOOOOOOO',
  'CCCCCCCCSSSSSSSGGGGGGG~NNNNNNNNOOOOOOOOOOO',
  'CCCCCCCCSSSSSSSGGGGGGG~NNNNNNNNOOOOOOOOOOO',
  'CCCCCCCCSSSSSSSGGGGGGG~MMMMMMMMYYYYYYYYYYY',
  'CCCCCCCCSSSSSSSGGGGGGG~MMMMMMMMYYYYYYYYYYY',
  'CCCCCCCCSSSSSSSGGGGGGG~MMMMMMMMYYYYYYYYYYY',
  'CCCCCCCCSSSSSSSGGGGGGG~MMMMMMMMYYYYYYYYYYY',
  'CCCCCCCCSSSSSSSGGGGGGG~MMMMMMMMYYYYYYYYYYY',
  'CCCCCCCC~~~~~~~~~~~~~~~MMMMMMMMYYYYYYYYYYY',
  'CCCCCCCCDDDDDDDDDDDDDD~UUUUUUUUUUUUU======',
  'CCCCCCCCDDDDDDDDDDDDDD~UUUUUUUUUUU========',
  'kkkkkkkkDDDDDDDDDDDDDD~UUUUUUUUUUU========',
  'kkkkkkkkDDDDDDDDDDDDDD~UUUUUUUUUUU========',
  'kkkkkkkkwwwwwwwtttttt~hhhhaaaaaaaa========',
  'kkkkkkkkwwwwwwwtttttt~hhhhaaaaaaaa========',
  'kkkkkkkkwwwwwwwtttttt~hhhhaaaaaaaa========',
  'kkkkkkkkwwwwwwwnnnnnn~hhhhaaaaaaaa========',
  'kkkkkkkkwwwwwwwnnnnnn~hhhhaaaaaaaaaa=====b',
  'kkkkkkkkwwwwwwwnnnnnn~hhhhaaaaaaaabbbbbbbb',
  'ccccccccnnnnnnnnnnnnn~hhhhaaaaaaaabbbbbbbb',
  'ccccccccnnnnnnnnnnnnn~ssssssggggggbbbbbbbb',
  'ccccccccnnnnnnnnnnnnn~ssssssggggggbbbbbbbb',
  'cccccccceeeeeeeeHHHHH~ssssssggggggbbbbbbbb',
  'cccccccceeeeeeeeHHHHH~ssssssggggggbbbbbbbb',
  'cccccccceeeeeeeeHHHHH~ssssssggggggbbbbbbbb',
  'BBBBBBBBeeeeeeeeHHHHH~QQQQQQQQLLLLLLLLLLLL',
  'BBBBBBBBWWWWWWWWHHHHHH~QQQQQQQLLLLLLLLLLLL',
  'BBBBBBBBWWWWWWWWVVVVVV~QQQQQQQLLLLLLLLLLLL',
  'BBBBBBBBWWWWWWWWVVVVVV~FFFFFFFFFJJJJJJJJJJ',
  'BBBBBBBBWWWWWWWWVVVVVV~FFFFFFFFFJJJJJJJJJJ',
  'BBBBBBBBWWWWWWWWVVVVVV~FFFFFFFFFJJJJJJJJJJ',
  'BBBBBBBBWWWWWWWW~~~~~~~FFFFFFFFFJJJJJJJJJJ',
  'XXXXXXXXXXXXXXAAAAAAAA~FFFFFFFFFJJJJJJJJJJ',
  'XXXXXXXXXXXXXXAAAAAAAA~ZZZZZZZZZPPPPPPPPPP',
  'XXXXXXXXXXXXXXAAAAAAAA~ZZZZZZZZZPPPPPPPPPP',
  'XXXXXXXXXXXXXXAAAAAAAA~ZZZZZZZZZPPPPPPPPPP',
  'XXXXXXXXXXXXXXAAAAAAAA~ZZZZZZZZZPPPPPPPPPP',
];

RV.MAP_W = RV.MAP_ROWS[0].length;
RV.MAP_H = RV.MAP_ROWS.length;

// Regions (counties). bonus = extra armies per turn for holding all of it.
RV.REGIONS = [
  { id: 'franklin',  name: 'Franklin',  bonus: 4, color: '#c8a2ff' },
  { id: 'hampshire', name: 'Hampshire', bonus: 5, color: '#7dff8a' },
  { id: 'hampden',   name: 'Hampden',   bonus: 5, color: '#ffb347' },
];

// key = grid character. label = short form drawn on the board.
RV.TERRITORIES = [
  // --- Franklin County ---
  { id:'C', name:'Charlemont',       terrain:'mountain', region:'franklin' },
  { id:'S', name:'Shelburne',        terrain:'hills',    region:'franklin' },
  { id:'G', name:'Greenfield',       terrain:'plains',   region:'franklin' },
  { id:'N', name:'Northfield',       terrain:'forest',   region:'franklin' },
  { id:'O', name:'Orange',           terrain:'forest',   region:'franklin' },
  { id:'M', name:'Montague',         terrain:'plains',   region:'franklin' },
  { id:'Y', name:'New Salem',        terrain:'forest',   region:'franklin' },
  { id:'D', name:'Deerfield',        terrain:'plains',   region:'franklin' },
  { id:'U', name:'Sunderland',       terrain:'plains',   region:'franklin' },

  // --- Hampshire County ---
  { id:'k', name:'Cummington',       terrain:'mountain', region:'hampshire' },
  { id:'c', name:'Chesterfield',     terrain:'forest',   region:'hampshire' },
  { id:'w', name:'Williamsburg',     terrain:'forest',   region:'hampshire' },
  { id:'t', name:'Hatfield',         terrain:'plains',   region:'hampshire' },
  { id:'n', name:'Northampton',      terrain:'plains',   region:'hampshire' },
  { id:'e', name:'Easthampton',      terrain:'hills',    region:'hampshire' },
  { id:'h', name:'Hadley',           terrain:'plains',   region:'hampshire' },
  { id:'a', name:'Amherst',          terrain:'plains',   region:'hampshire' },
  { id:'s', name:'South Hadley',     terrain:'hills',    region:'hampshire' },
  { id:'g', name:'Granby',           terrain:'plains',   region:'hampshire' },
  { id:'b', name:'Belchertown',      terrain:'forest',   region:'hampshire' },

  // --- Hampden County ---
  { id:'B', name:'Blandford',        terrain:'mountain', region:'hampden' },
  { id:'W', name:'Westfield',        terrain:'plains',   region:'hampden' },
  { id:'X', name:'Southwick',        terrain:'hills',    region:'hampden' },
  { id:'H', name:'Holyoke',          terrain:'hills',    region:'hampden' },
  { id:'V', name:'West Springfield', terrain:'plains',   region:'hampden', label:'W SPRINGFIELD' },
  { id:'A', name:'Agawam',           terrain:'plains',   region:'hampden' },
  { id:'Q', name:'Chicopee',         terrain:'plains',   region:'hampden' },
  { id:'L', name:'Ludlow',           terrain:'forest',   region:'hampden' },
  { id:'F', name:'Springfield',      terrain:'plains',   region:'hampden' },
  { id:'J', name:'Wilbraham',        terrain:'hills',    region:'hampden' },
  { id:'Z', name:'Longmeadow',       terrain:'plains',   region:'hampden' },
  { id:'P', name:'Hampden',          terrain:'hills',    region:'hampden' },
];

// The real bridges between towns that face each other across a river.
// Facing across water with no bridge here (Hatfield–Hadley, say) is no border.
RV.BRIDGES = [
  ['Greenfield',       'Montague',         'General Pierce Bridge'],
  ['Greenfield',       'Deerfield',        'Routes 5 & 10 and I-91, over the Deerfield'],
  ['Deerfield',        'Sunderland',       'Sunderland Bridge, Route 116'],
  ['Northampton',      'Hadley',           'Calvin Coolidge Bridge, Route 9'],
  ['South Hadley',     'Holyoke',          'County Bridge, Route 116'],
  ['Holyoke',          'Chicopee',         'Willimansett Bridge and I-391'],
  ['West Springfield', 'Chicopee',         'Mass Pike, I-90'],
  ['West Springfield', 'Springfield',      'Memorial and North End bridges'],
  ['West Springfield', 'Agawam',           'Route 5 and Route 147, over the Westfield'],
  ['Agawam',           'Springfield',      'South End Bridge'],
];
