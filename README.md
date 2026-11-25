# Risk: Pioneer Valley

A two-player, pixel-art take on classic Risk, played across 32 towns of Franklin, Hampshire and
Hampden counties. You go first against the Machine. Plain HTML, CSS and JavaScript with no build
step or dependencies; the only network request is the Press Start 2P font, and it falls back to
monospace offline.

## Play

Open `index.html` in a browser. It works from `file://`, or you can serve it:

```
python3 -m http.server 8000
```

Then browse to http://localhost:8000.

## Rules

- **Reinforce:** you get max(3, towns ÷ 3) armies, plus a county bonus for each county you hold
  completely (Franklin +4, Hampshire +5, Hampden +5). Click your towns to place them;
  shift-click places the whole pool. Once the pool is empty, the game moves to Attack.
- **Attack:** click one of your towns with 2+ armies, then an outlined neighbor. The attacker rolls
  up to 3 dice and the defender up to 2. The highest dice are compared pairwise, and ties go to the
  defender. After a capture, you choose how many more armies to advance.
- **Fortify:** make one move between two of your towns that are linked through your own territory.
  The move ends your turn.
- Towns border each other on land, or across the Connecticut, Deerfield or Westfield rivers
  (bridges). The Quabbin can't be crossed.
- Own every town to win.

Difficulty sets how aggressive the Machine is and how many extra starting armies it gets to offset
moving second: Easy +0, Normal +4, Hard +8.

## Layout

| File | Role |
| --- | --- |
| `js/map-data.js` | ASCII map grid, towns, and counties. Edit the map here. |
| `js/map.js` | Builds the grid, adjacency (including river bridges), label anchors, and regions |
| `js/game.js` | Rules and state: phases, dice, advance, fortify, win |
| `js/ai.js` | The Machine's decision for each step |
| `js/ai-turn.js` | Runs the Machine's turn with animation |
| `js/ui.js` | Canvas rendering, input, HUD, and modals |
| `js/combat.js` | Dice overlay and resolution |
| `js/sprites.js` | Pixel art; every palette key is one character |
| `js/audio.js` | WebAudio chip-tune sound effects |

## Checks

```
dev/smoke.sh
```

This runs the map check (contiguity, connectivity, label anchors), the sprite palette check, and a
headless simulation of 60 games through the real rules and AI. It then opens the actual page in
headless Chrome and plays 6 rounds with real click events. Use `dev/smoke.sh 80 hard` to play a
whole game. `dev/sprites.html` is a gallery of every sprite.
