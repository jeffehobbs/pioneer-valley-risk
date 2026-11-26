/* Pioneer Valley Risk — game state and rules.
 *
 * Two players (0 = human, 1 = AI) on the towns of the Pioneer Valley.
 * Classic Risk loop: reinforce -> attack -> fortify -> end turn.
 *  - Reinforcements: max(3, towns / 3) + county bonuses.
 *  - Phases only move forward; all reinforcements must be placed first.
 *  - Capturing a town moves in as many armies as dice rolled; the attacker
 *    may then advance more (state.advance describes the pending choice).
 *  - Fortify: one move per turn, along a chain of your own towns.
 *  - Terrain: mountains give the defender a 3rd die (best two count), hills
 *    add +1 to the defender's top die, forests are cover (the defender loses
 *    at most one army per roll), and attacking across a river costs the
 *    attacker a die.
 *  - Reinforcements can be undone until the first attack of the turn.
 * Victory: own every town.
 */
(function () {
  'use strict';

  var START_ARMIES = 3;
  // The human always moves first, which is worth a lot in two-player Risk.
  // The computer gets extra starting armies to compensate, scaled by difficulty.
  var MACHINE_START_BONUS = { easy: 2, normal: 5, hard: 7 };
  var PHASES = ['reinforce', 'attack', 'fortify'];

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function create(difficulty) {
    var n = RV.TERRITORIES.length;
    var order = shuffle(Array.from({ length: n }, function (_, i) { return i; }));
    var owner = new Array(n);
    order.forEach(function (ti, k) { owner[ti] = k % 2; }); // alternate the shuffled deal

    var territories = RV.TERRITORIES.map(function (t, i) {
      return {
        id: t.id,
        name: t.name,
        terrain: t.terrain,
        owner: owner[i],
        armies: START_ARMIES,
      };
    });

    var state = {
      difficulty: difficulty || 'normal',
      territories: territories,
      players: [
        { name: 'YOU', color: '#37c8ff', dice: 'blue' },
        { name: 'COMPUTER', color: '#ff4d4d', dice: 'red' },
      ],
      turn: 0,
      round: 1,
      phase: 'reinforce',
      pool: 0,
      fortified: false,
      advance: null,
      log: [],
      over: null,
      committed: false,   // attacked or fortified this turn (no more undo)
      undo: [],           // this turn's placements, newest last
      turnNo: 0,
      stats: {
        taken: [0, 0],
        lost: [0, 0],
        rolls: [0, 0],
        biggest: null,
        battle: null,
        history: [],
      },
    };

    var bonus = RV.Game.MACHINE_START_BONUS[state.difficulty] || 0;
    var machine = territoriesOf(state, 1);
    for (var b = 0; b < bonus; b++) {
      territories[machine[Math.floor(Math.random() * machine.length)]].armies++;
    }

    beginTurn(state);
    return state;
  }

  function beginTurn(state) {
    var p = state.turn;
    state.phase = 'reinforce';
    state.fortified = false;
    state.advance = null;
    state.committed = false;
    state.undo = [];
    state.turnNo++;
    if (p === 0) recordHistory(state);
    state.pool = reinforcements(state, p);
    var held = heldRegions(state, p).map(function (r) { return RV.REGIONS[r].name; });
    addLog(state, (p === 0 ? 'Your turn' : 'The computer\'s turn') +
      ': +' + state.pool + ' armies' +
      (held.length ? ' (holds ' + held.join(', ') + ')' : '') + '.');
  }

  function heldRegions(state, p) {
    var out = [];
    RV.regionTowns.forEach(function (towns, r) {
      if (towns.every(function (i) { return state.territories[i].owner === p; })) out.push(r);
    });
    return out;
  }

  function reinforcements(state, p) {
    var count = territoriesOf(state, p).length;
    var n = Math.max(3, Math.floor(count / 3));
    heldRegions(state, p).forEach(function (r) { n += RV.REGIONS[r].bonus; });
    return n;
  }

  function territoriesOf(state, p) {
    var out = [];
    state.territories.forEach(function (t, i) {
      if (t.owner === p) out.push(i);
    });
    return out;
  }

  function totalArmies(state, p) {
    var sum = 0;
    state.territories.forEach(function (t) {
      if (t.owner === p) sum += t.armies;
    });
    return sum;
  }

  function recordHistory(state) {
    var h = state.stats.history;
    var c = [territoriesOf(state, 0).length, territoriesOf(state, 1).length];
    var last = h[h.length - 1];
    if (last && last.round === state.round) last.c = c;
    else h.push({ round: state.round, c: c });
  }

  function placeArmies(state, i, n) {
    var t = state.territories[i];
    if (state.phase !== 'reinforce') return false;
    if (t.owner !== state.turn || n <= 0 || state.pool <= 0) return false;
    if (n > state.pool) n = state.pool;
    t.armies += n;
    state.pool -= n;
    state.undo.push({ i: i, n: n });
    return true;
  }

  // Take back the last placement. Allowed until the first attack (or
  // fortify) of the turn; it reopens the reinforce phase if needed.
  function canUndo(state) {
    return state.undo.length > 0 && !state.committed && !state.advance &&
      state.over == null && (state.phase === 'reinforce' || state.phase === 'attack');
  }

  function undoPlacement(state) {
    if (!canUndo(state)) return null;
    var u = state.undo.pop();
    state.territories[u.i].armies -= u.n;
    state.pool += u.n;
    state.phase = 'reinforce';
    return u;
  }

  // Can the current phase advance to `phase`? Only forward, and only once
  // every reinforcement has been placed.
  function canSetPhase(state, phase) {
    var cur = PHASES.indexOf(state.phase), next = PHASES.indexOf(phase);
    if (next < 0 || next < cur) return false;
    if (state.pool > 0 && next > 0) return false;
    if (state.advance) return false;
    return true;
  }

  function setPhase(state, phase) {
    if (!canSetPhase(state, phase)) return false;
    state.phase = phase;
    if (phase === 'fortify') state.committed = true;
    return true;
  }

  // Is there a chain of `p`-owned towns from a to b?
  function connected(state, a, b) {
    var p = state.territories[a].owner;
    if (state.territories[b].owner !== p) return false;
    var seen = {}, stack = [a];
    seen[a] = true;
    while (stack.length) {
      var v = stack.pop();
      if (v === b) return true;
      RV.adj[v].forEach(function (w) {
        if (!seen[w] && state.territories[w].owner === p) { seen[w] = true; stack.push(w); }
      });
    }
    return false;
  }

  // Fortify: one move per turn along a chain of your own towns.
  function moveArmies(state, from, to, n) {
    var a = state.territories[from], b = state.territories[to];
    if (state.phase !== 'fortify' || state.fortified) return false;
    if (from === to) return false;
    if (a.owner !== state.turn || b.owner !== state.turn) return false;
    if (!connected(state, from, to)) return false;
    if (n <= 0 || n >= a.armies) return false; // keep one garrison
    a.armies -= n;
    b.armies += n;
    state.fortified = true;
    return true;
  }

  // How the ground shapes a fight from `from` into `to`.
  function combatMods(state, from, to) {
    var terr = state.territories[to].terrain;
    return {
      terrain: terr,
      river: !!(RV.isCrossing && RV.isCrossing(from, to)),
      atkDice: RV.isCrossing && RV.isCrossing(from, to) ? 2 : 3,
      defDice: terr === 'mountain' ? 3 : 2,
      defPlus: terr === 'hills' ? 1 : 0,
      cover: terr === 'forest',
    };
  }

  function roll(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(1 + Math.floor(Math.random() * 6));
    return out.sort(function (x, y) { return y - x; });
  }

  // Roll and resolve one combat round.
  // Attacker: up to 3 dice (2 across a river), needs at least 2 armies.
  // Defender: up to 2 dice (3 in the mountains, best two count).
  function attack(state, from, to) {
    var a = state.territories[from], b = state.territories[to];
    if (state.over != null || state.phase !== 'attack' || state.advance) return null;
    if (a.owner !== state.turn || b.owner === state.turn) return null;
    if (a.armies < 2) return null;
    if (RV.adj[from].indexOf(to) < 0) return null;

    var mods = combatMods(state, from, to);
    var atkN = Math.min(mods.atkDice, a.armies - 1);
    var defN = Math.min(mods.defDice, b.armies);
    var atk = roll(atkN), def = roll(defN);
    var defEff = def.slice();
    if (mods.defPlus) defEff[0] = Math.min(6, defEff[0] + mods.defPlus);

    var atkLoss = 0, defLoss = 0, outcomes = [], i;
    var pairs = Math.min(atk.length, def.length, 2);
    for (i = 0; i < pairs; i++) {
      if (atk[i] > defEff[i]) {
        if (mods.cover && defLoss >= 1) { outcomes.push('c'); continue; }
        defLoss++; outcomes.push('a');
      } else {
        atkLoss++; outcomes.push('d');
      }
    }

    a.armies -= atkLoss;
    b.armies -= defLoss;
    state.committed = true;

    var st = state.stats, p = state.turn, loser = b.owner;
    st.lost[p] += atkLoss;
    st.lost[loser] += defLoss;
    st.rolls[p]++;
    var key = state.turnNo + ':' + from + '>' + to;
    if (!st.battle || st.battle.key !== key) {
      st.battle = { key: key, round: state.round, by: p, from: from, to: to,
                    atkLoss: 0, defLoss: 0, rolls: 0, captured: false };
    }
    st.battle.atkLoss += atkLoss;
    st.battle.defLoss += defLoss;
    st.battle.rolls++;

    var captured = false, moved = 0;
    if (b.armies <= 0) {
      captured = true;
      moved = Math.min(atkN, a.armies - 1);
      b.owner = state.turn;
      b.armies = moved;
      a.armies -= moved;
      st.taken[p]++;
      st.battle.captured = true;
      if (a.armies > 1) {
        state.advance = { from: from, to: to, max: a.armies - 1 };
      }
      state.over = winner(state);
    }
    var bt = st.battle;
    if (!st.biggest || st.biggest.key === bt.key ||
        bt.atkLoss + bt.defLoss > st.biggest.atkLoss + st.biggest.defLoss) {
      st.biggest = Object.assign({}, bt);
    }
    if (state.over != null) recordHistory(state);
    return { atk: atk, def: def, defEff: defEff, outcomes: outcomes, mods: mods,
             atkLoss: atkLoss, defLoss: defLoss,
             captured: captured, moved: moved, loser: loser,
             from: from, to: to };
  }

  // Resolve a pending post-capture advance (n may be 0).
  function advance(state, n) {
    var adv = state.advance;
    if (!adv) return false;
    n = Math.max(0, Math.min(adv.max, n | 0));
    state.territories[adv.from].armies -= n;
    state.territories[adv.to].armies += n;
    state.advance = null;
    return true;
  }

  function endTurn(state) {
    if (state.over != null) return;
    if (state.advance) advance(state, 0);
    state.pool = 0;
    state.turn = 1 - state.turn;
    if (state.turn === 0) state.round++;
    beginTurn(state);
    state.over = winner(state);
  }

  function winner(state) {
    var c0 = territoriesOf(state, 0).length;
    var c1 = territoriesOf(state, 1).length;
    if (c0 === 0) return 1;
    if (c1 === 0) return 0;
    return null;
  }

  // msg is a string, or {text, kind} for styled lines (e.g. taunts).
  function addLog(state, msg) {
    state.log.push(msg);
    if (state.log.length > 60) state.log.shift();
  }

  RV.Game = {
    PHASES: PHASES,
    MACHINE_START_BONUS: MACHINE_START_BONUS,
    create: create,
    beginTurn: beginTurn,
    reinforcements: reinforcements,
    heldRegions: heldRegions,
    territoriesOf: territoriesOf,
    totalArmies: totalArmies,
    placeArmies: placeArmies,
    canSetPhase: canSetPhase,
    setPhase: setPhase,
    connected: connected,
    moveArmies: moveArmies,
    attack: attack,
    combatMods: combatMods,
    canUndo: canUndo,
    undoPlacement: undoPlacement,
    advance: advance,
    endTurn: endTurn,
    winner: winner,
    addLog: addLog,
  };
  // shorthand used across UI modules
  RV.addLog = addLog;
})();
