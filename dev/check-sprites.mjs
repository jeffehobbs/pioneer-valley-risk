// Verify every sprite is rectangular and only uses palette keys.
// Run: node dev/check-sprites.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
globalThis.window = globalThis;
(0, eval)(readFileSync(join(dir, '..', 'js/sprites.js'), 'utf8'));

let bad = 0;
function check(name, rows, allowSlot) {
  const w = rows[0].length;
  rows.forEach((r, y) => {
    if (r.length !== w) { bad++; console.log(`${name}: row ${y} width ${r.length} != ${w}`); }
    for (const ch of r) {
      if (ch === '.' || (allowSlot && ch === 'C')) continue;
      if (!RV.PAL[ch]) { bad++; console.log(`${name}: unknown palette key '${ch}' in row ${y}`); }
    }
  });
}
for (const k of ['grass', 'forest', 'mountain', 'hills']) RV.SPR[k].forEach((s, i) => check(`${k}[${i}]`, s));
for (const k of ['river', 'lake', 'house', 'star']) check(k, RV.SPR[k]);
check('soldier', RV.SPR.soldier, true);
check('flag', RV.SPR.flag, true);
for (let f = 1; f <= 6; f++) { check(`die${f}.red`, RV.SPR.dice[f].red); check(`die${f}.blue`, RV.SPR.dice[f].blue); }
console.log(bad ? `sprites: FAILED (${bad})` : 'sprites: OK');
process.exit(bad ? 1 : 0);
