/* Pioneer Valley Risk — the computer talks.
 *
 * RV.Taunts.pick(kind, arg) returns a line or null. Callers decide when to
 * speak; this module only rations the lines so the same one doesn't repeat
 * back to back.
 */
(function () {
  'use strict';

  // Said when the computer takes the town.
  var TOWN = {
    'Charlemont':       'Charlemont is mine. Enjoy the view from down there.',
    'Shelburne':        'The Bridge of Flowers blooms red now.',
    'Greenfield':       'Greenfield has fallen. Poet\'s Seat writes my verses now.',
    'Northfield':       'Northfield is mine. Not even a prayer up there.',
    'Orange':           'Orange falls. Even the skydivers are jumping ship.',
    'Montague':         'Montague taken. The Book Mill shelves only my memoirs.',
    'New Salem':        'New Salem is mine. The Quabbin heard you lose.',
    'Deerfield':        'Deerfield has fallen. Yankee Candle smells like victory.',
    'Sunderland':       'Sunderland is mine. Sugarloaf has a new lookout.',
    'Cummington':       'Cummington taken. The fair will be held in my honor.',
    'Chesterfield':     'Chesterfield falls. I\'m swimming in the Gorge.',
    'Williamsburg':     'Williamsburg is mine, and so are the cinnamon buns.',
    'Hatfield':         'Hatfield has fallen. The asparagus is mine.',
    'Northampton':      'Northampton is mine. Paradise City, under new management.',
    'Easthampton':      'Easthampton falls. Nashawannuck Pond is my moat.',
    'Hadley':           'Hadley taken. Route 9 traffic now runs my way.',
    'Amherst':          'Amherst falls. Class dismissed.',
    'South Hadley':     'South Hadley is mine. Mount Holyoke concedes.',
    'Granby':           'Granby taken. Even the dinosaur tracks lead to me.',
    'Belchertown':      'Belchertown falls. I\'d make a joke, but I\'m above it.',
    'Blandford':        'Blandford is mine. The ski hill too.',
    'Westfield':        'Westfield taken. Whip City cracks.',
    'Southwick':        'Southwick falls. Connecticut wanted it back. Too late.',
    'Holyoke':          'Holyoke has fallen. Spike.',
    'West Springfield': 'West Springfield is mine. See you at the Big E.',
    'Agawam':           'Agawam taken. Six Flags over the computer.',
    'Chicopee':         'Chicopee falls. Westover is cleared for my landing.',
    'Ludlow':           'Ludlow is mine. Pass the linguica.',
    'Springfield':      'Springfield has fallen. Nothing but net.',
    'Wilbraham':        'Wilbraham taken. Friendly\'s serves me first now.',
    'Longmeadow':       'Longmeadow falls. Lovely lawns. Mine.',
    'Hampden':          'Hampden taken. A town named after a county. Bold.',
  };

  var LINES = {
    // the computer takes a town it has already gloated about
    capture: [
      'Another one.',
      'Resistance is inefficient.',
      'I\'ll put up a sign.',
      'Next.',
      'Your armies make excellent fertilizer.',
    ],
    // you take one of its towns
    lose: [
      'A temporary setback.',
      'Enjoy it while it lasts.',
      'I let you have that one.',
      'Recalculating.',
      'That town was a decoy.',
      'Noted. Filed. Avenged later.',
    ],
    // the computer completes a county
    county: {
      Franklin:  'All of Franklin County is mine. Pay the toll at the French King Bridge.',
      Hampshire: 'Hampshire County is mine. Five colleges, one dean.',
      Hampden:   'Hampden County is mine. Springfield bows.',
    },
    // you break its county
    broken: [
      'You broke my county. I will remember that.',
      'My beautiful county. You will pay for that.',
    ],
    win:  'The Pioneer Valley is mine. Drive safe on 91.',
    lose_game: 'Impossible. I demand a recount.',
  };

  var lastLine = null;
  var saidTown = {};

  function fromList(list) {
    var options = list.filter(function (l) { return l !== lastLine; });
    return options[Math.floor(Math.random() * options.length)];
  }

  function pick(kind, arg) {
    var line = null;
    if (kind === 'capture') {
      if (TOWN[arg] && !saidTown[arg]) { saidTown[arg] = true; line = TOWN[arg]; }
      else line = fromList(LINES.capture);
    } else if (kind === 'county') {
      line = LINES.county[arg] || null;
    } else if (Array.isArray(LINES[kind])) {
      line = fromList(LINES[kind]);
    } else if (typeof LINES[kind] === 'string') {
      line = LINES[kind];
    }
    if (line) lastLine = line;
    return line;
  }

  RV.Taunts = {
    pick: pick,
    reset: function () { lastLine = null; saidTown = {}; },
    TOWN: TOWN,
  };
})();
