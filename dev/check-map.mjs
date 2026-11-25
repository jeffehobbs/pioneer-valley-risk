// Dev check for the map data. Run: node dev/check-map.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
globalThis.window = globalThis;
const warns = [];
const origWarn = console.warn;
console.warn = (m) => { warns.push(m); origWarn(m); };

for (const f of ['js/map-data.js', 'js/map.js']) {
  (0, eval)(readFileSync(join(dir, '..', f), 'utf8'));
}

const report = RV.checkMap();
console.log(report.text);

const { grid, MAP_W: W, MAP_H: H, TERRITORIES } = RV;
let ok = report.connected && warns.length === 0;
for (let i = 0; i < TERRITORIES.length; i++) {
  const cells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] === i) cells.push([x, y]);
  if (!cells.length) { ok = false; console.log('EMPTY: ' + TERRITORIES[i].name); continue; }
  const seen = new Set([cells[0].join(',')]);
  const stack = [cells[0]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, key = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(key)) continue;
      if (grid[ny][nx] === i) { seen.add(key); stack.push([nx, ny]); }
    }
  }
  if (seen.size !== cells.length) {
    ok = false;
    console.log('DISCONTIGUOUS: ' + TERRITORIES[i].name + ` (${seen.size}/${cells.length})`);
  }
  if (!RV.adj[i].length) { ok = false; console.log('ISOLATED: ' + TERRITORIES[i].name); }
  const [cx, cy] = RV.centroid[i];
  if (grid[Math.floor(cy)][Math.floor(cx)] !== i) { ok = false; console.log('CENTROID OUTSIDE: ' + TERRITORIES[i].name); }
}
for (const [r, towns] of RV.regionTowns.entries()) {
  console.log(`region ${RV.REGIONS[r].name}: ${towns.length} towns, +${RV.REGIONS[r].bonus}`);
}
console.log(ok ? 'map: OK' : 'map: FAILED');
process.exit(ok ? 0 : 1);
