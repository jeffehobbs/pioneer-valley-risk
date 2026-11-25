// Headless game simulation: the Machine vs a simple bot standing in for
// the human, through the real rules + AI modules.
// Run: node dev/sim.mjs [gamesPerDifficulty]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
globalThis.window = globalThis;

for (const f of [
  'js/sprites.js', 'js/audio.js', 'js/map-data.js', 'js/map.js',
  'js/game.js', 'js/ai.js', 'js/ui.js', 'js/combat.js',
  'js/ai-turn.js', 'js/main.js',
]) {
  (0, eval)(readFileSync(join(dir, '..', f), 'utf8'));
}

const N = RV.TERRITORIES.length;
const GAMES = Number(process.argv[2]) || 20;
const MAX_ROUNDS = 150;

function invariants(st, where) {
  let total = 0;
  st.territories.forEach((t, i) => {
    if (t.armies < 1) throw new Error(`${where}: ${t.name} has ${t.armies} armies`);
    if (t.owner !== 0 && t.owner !== 1) throw new Error(`${where}: bad owner on ${t.name}`);
    total++;
  });
  if (total !== N) throw new Error(`${where}: ${total} towns`);
}

// A plain-but-sensible human stand-in: stacks on its strongest front,
// attacks with a 2:1 edge, advances everything, fortifies to the front.
function botTurn(st) {
  const mine = () => RV.Game.territoriesOf(st, 0);
  const enemies = (i) => RV.adj[i].filter((j) => st.territories[j].owner !== 0);
  let front = mine().filter((i) => enemies(i).length)
    .sort((a, b) => st.territories[b].armies - st.territories[a].armies)[0];
  if (front == null) front = mine()[0];
  RV.Game.placeArmies(st, front, st.pool);
  if (!RV.Game.setPhase(st, 'attack')) throw new Error('bot could not enter attack');

  for (let round = 0; round < 200 && st.over == null; round++) {
    let best = null;
    for (const from of mine()) {
      const a = st.territories[from].armies;
      for (const to of enemies(from)) {
        const b = st.territories[to].armies;
        if (a - 1 >= b * 2 && (!best || a - b > best.edge)) best = { from, to, edge: a - b };
      }
    }
    if (!best) break;
    RV.Game.attack(st, best.from, best.to);
    if (st.advance) RV.Game.advance(st, st.advance.max);
  }
  if (st.over != null) return;
  RV.Game.setPhase(st, 'fortify');
  const interior = mine().filter((i) => !enemies(i).length && st.territories[i].armies > 1);
  for (const from of interior) {
    const to = mine().find((j) => enemies(j).length && RV.Game.connected(st, from, j));
    if (to != null && RV.Game.moveArmies(st, from, to, st.territories[from].armies - 1)) break;
  }
}

function aiTurn(st) {
  RV.AI.resetTurn(st);
  for (let steps = 0; steps < 1000; steps++) {
    const a = RV.AI.step(st);
    if (a.type === 'end') return;
    if (a.type === 'place') { if (!RV.Game.placeArmies(st, a.to, a.n)) throw new Error('AI bad place'); }
    else if (a.type === 'attack') { if (!RV.Game.attack(st, a.from, a.to)) throw new Error('AI bad attack'); }
    else if (a.type === 'advance') RV.Game.advance(st, a.n);
    else if (a.type === 'move') { if (!RV.Game.moveArmies(st, a.from, a.to, a.n)) throw new Error('AI bad move'); }
    else if (a.type === 'phase') { if (!RV.Game.setPhase(st, a.phase)) throw new Error('AI bad phase ' + a.phase); }
    if (st.over != null) return;
  }
  throw new Error('AI turn did not end');
}

function runGame(difficulty) {
  const st = RV.Game.create(difficulty);
  invariants(st, 'start');
  while (st.over == null && st.round <= MAX_ROUNDS) {
    if (st.turn === 0) botTurn(st); else aiTurn(st);
    invariants(st, `round ${st.round}`);
    RV.Game.endTurn(st);
  }
  return st;
}

let failures = 0;
for (const difficulty of ['easy', 'normal', 'hard']) {
  const tally = { 0: 0, 1: 0, draw: 0 };
  const rounds = [];
  for (let g = 0; g < GAMES; g++) {
    try {
      const st = runGame(difficulty);
      if (st.over == null) tally.draw++; else { tally[st.over]++; rounds.push(st.round); }
    } catch (e) {
      failures++;
      console.log(`${difficulty} game ${g}: ERROR ${e.message}`);
    }
  }
  rounds.sort((a, b) => a - b);
  const median = rounds.length ? rounds[Math.floor(rounds.length / 2)] : '-';
  console.log(`${difficulty.padEnd(6)} bot ${tally[0]}  machine ${tally[1]}  unfinished ${tally.draw}  ` +
    `(median ${median} rounds)`);
  if (tally.draw > GAMES * 0.2) { failures++; console.log(`  too many unfinished games on ${difficulty}`); }
}
console.log(failures ? `simulation: FAILED (${failures})` : 'simulation: OK');
process.exit(failures ? 1 : 0);
