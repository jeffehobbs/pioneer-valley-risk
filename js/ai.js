/* Risk: Pioneer Valley — the Machine (computer opponent).
 *
 * RV.AI.step(state) inspects the current state and returns ONE action:
 *   {type:'place',   to, n}
 *   {type:'attack',  from, to}
 *   {type:'advance', n}          (after a capture)
 *   {type:'move',    from, to, n}
 *   {type:'phase',   phase}
 *   {type:'end'}
 * The caller executes the action (with animation), then asks for the next
 * step. Decisions are re-evaluated each step, so the AI adapts to dice.
 */
(function () {
  'use strict';

  // ratio: attack when (attackers - 1) >= defenders * ratio
  // regionAware: weight county completion / breaking the human's county
  // scatter: chance of a careless reinforcement
  var DIFF = {
    easy:   { ratio: 1.7,  regionAware: 0.3, scatter: 0.35, stack: false, keepBack: 1.0, maxAttacks: 6 },
    normal: { ratio: 1.2,  regionAware: 1.0, scatter: 0.0,  stack: true,  keepBack: 0.25, maxAttacks: 60 },
    hard:   { ratio: 1.0,  regionAware: 1.6, scatter: 0.0,  stack: true,  keepBack: 0,   maxAttacks: 120 },
  };

  function diff(state) {
    return DIFF[state.difficulty] || DIFF.normal;
  }

  function myTowns(state) {
    return RV.Game.territoriesOf(state, state.turn);
  }

  function enemyNeighbors(state, i) {
    var p = state.territories[i].owner;
    return RV.adj[i].filter(function (j) { return state.territories[j].owner !== p; });
  }

  function isBorder(state, i) {
    return enemyNeighbors(state, i).length > 0;
  }

  function pressure(state, i) {
    var sum = 0;
    enemyNeighbors(state, i).forEach(function (j) { sum += state.territories[j].armies; });
    return sum;
  }

  function maxEnemy(state, i) {
    var m = 0;
    enemyNeighbors(state, i).forEach(function (j) { m = Math.max(m, state.territories[j].armies); });
    return m;
  }

  // Fraction of region r owned by player p.
  function regionShare(state, r, p) {
    var towns = RV.regionTowns[r], own = 0;
    towns.forEach(function (i) { if (state.territories[i].owner === p) own++; });
    return own / towns.length;
  }

  // Value of taking town `to` (beyond the fight itself).
  function targetValue(state, to) {
    var d = diff(state), p = state.turn;
    var r = RV.regionOf[to];
    var v = 1;
    var mine = regionShare(state, r, p);
    var theirs = regionShare(state, r, 1 - p);
    v += d.regionAware * mine * 4;             // finish our county
    if (theirs === 1) v += d.regionAware * 5;  // break their bonus
    return v;
  }

  // ------------------------------------------------------------ reinforce
  function reinforceStep(state) {
    var pool = state.pool;
    if (pool <= 0) return { type: 'phase', phase: 'attack' };

    var d = diff(state);
    var mine = myTowns(state);

    if (d.scatter && Math.random() < d.scatter) {
      return { type: 'place', to: mine[Math.floor(Math.random() * mine.length)], n: 1 };
    }

    // Defend a county we hold if the human is massing next to it.
    if (d.stack) {
      var worst = null;
      RV.Game.heldRegions(state, state.turn).forEach(function (r) {
        RV.regionTowns[r].forEach(function (i) {
          var gap = maxEnemy(state, i) - state.territories[i].armies;
          if (gap > 0 && (!worst || gap > worst.gap)) worst = { i: i, gap: gap };
        });
      });
      if (worst) return { type: 'place', to: worst.i, n: Math.min(pool, worst.gap + 1) };
    }

    // Score each border town as a staging ground: its strength, the best
    // weak target next door, and how exposed it is.
    var best = null;
    mine.forEach(function (i) {
      var en = enemyNeighbors(state, i);
      if (!en.length) return;
      var a = state.territories[i].armies;
      var opp = 0;
      en.forEach(function (j) {
        var b = state.territories[j].armies;
        var s = targetValue(state, j) * 6 / (b + 1);
        if (s > opp) opp = s;
      });
      var score = d.stack
        ? a * 0.6 + opp * 2 + pressure(state, i) / (a + 1)
        : opp + pressure(state, i) / (a + 1) * 1.5;
      if (!best || score > best.score) best = { i: i, score: score };
    });

    if (!best) {
      var biggest = mine.slice().sort(function (x, y) {
        return state.territories[y].armies - state.territories[x].armies;
      })[0];
      return { type: 'place', to: biggest, n: pool };
    }
    // Normal/hard stack everything on one front; easy spreads it around.
    var n = d.stack ? pool : Math.min(pool, Math.max(1, Math.ceil(pool / 2)));
    return { type: 'place', to: best.i, n: n };
  }

  // --------------------------------------------------------------- attack
  function attackStep(state) {
    if (state.advance) return { type: 'advance', n: advanceChoice(state) };
    var d = diff(state);
    state._aiAttacks = (state._aiAttacks || 0);
    if (state._aiAttacks >= d.maxAttacks) return { type: 'phase', phase: 'fortify' };

    var best = null;
    myTowns(state).forEach(function (from) {
      var a = state.territories[from].armies;
      if (a < 2) return;
      enemyNeighbors(state, from).forEach(function (to) {
        var b = state.territories[to].armies;
        if (a - 1 < b * d.ratio && !(a >= 4 && b === 1)) return;
        var score = (a - 1 - b) + targetValue(state, to) * 2 - b * 0.5;
        if (!best || score > best.score) best = { from: from, to: to, score: score };
      });
    });

    if (!best) return { type: 'phase', phase: 'fortify' };
    state._aiAttacks++;
    return { type: 'attack', from: best.from, to: best.to };
  }

  // How many extra armies to push into a freshly captured town.
  function advanceChoice(state) {
    var d = diff(state), adv = state.advance;
    var srcThreat = maxEnemy(state, adv.from);
    var dstThreat = enemyNeighbors(state, adv.to).length;
    if (!dstThreat) return srcThreat ? 0 : adv.max;   // dead end
    var keep = Math.ceil(srcThreat * d.keepBack);
    return Math.max(0, Math.min(adv.max, adv.max - keep));
  }

  // -------------------------------------------------------------- fortify
  function fortifyStep(state) {
    if (state.fortified) return { type: 'end' };
    var mine = myTowns(state);
    var interior = mine.filter(function (i) {
      return !isBorder(state, i) && state.territories[i].armies >= 2;
    }).sort(function (x, y) {
      return state.territories[y].armies - state.territories[x].armies;
    });

    for (var k = 0; k < interior.length; k++) {
      var from = interior[k];
      var dests = mine.filter(function (j) {
        return isBorder(state, j) && RV.Game.connected(state, from, j);
      });
      if (!dests.length) continue;
      dests.sort(function (x, y) {
        return pressure(state, y) / (state.territories[y].armies + 1) -
               pressure(state, x) / (state.territories[x].armies + 1);
      });
      return { type: 'move', from: from, to: dests[0], n: state.territories[from].armies - 1 };
    }
    return { type: 'end' };
  }

  RV.AI = {
    step: function (state) {
      if (state.over != null) return { type: 'end' };
      if (state.turn === 0) return { type: 'end' }; // human drives its own turn
      switch (state.phase) {
        case 'reinforce': return reinforceStep(state);
        case 'attack':    return attackStep(state);
        default:          return fortifyStep(state);
      }
    },
    resetTurn: function (state) { state._aiAttacks = 0; },
    _DIFF: DIFF,
  };
})();
