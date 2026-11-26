# Pioneer Valley Risk

A two-player, pixel-art take on classic Risk, played across 32 towns of Franklin, Hampshire and
Hampden counties. You go first against the computer. Plain HTML, CSS and JavaScript with no build
step or dependencies; the only network request is the Press Start 2P font, and it falls back to
monospace offline. The game saves itself as you play, so a reload or QUIT can CONTINUE it.

## Play

Open `index.html` in a browser. It works from `file://`, or you can serve it:

```
python3 -m http.server 8000
```

Then browse to http://localhost:8000.

## Rules

- **Reinforce:** you get max(3, towns ÷ 3) armies, plus a county bonus for each county you hold
  completely (Franklin +4, Hampshire +5, Hampden +5). Click your towns to place them;
  shift-click places the whole pool. Once the pool is empty, the game moves to Attack. UNDO
  (Cmd/Ctrl-Z) takes back placements until your first attack.
- **Cards:** take at least one town in a turn and you draw a card showing a town and its terrain
  (plus two wilds in the deck). Trade three of a kind, or three different terrains, for 4, 6, 8,
  10, 12, 15, then 20, 25 and so on. The count is shared by both sides, so every trade is worth
  more than the last. A traded card showing a town you hold also puts +2 there. At 5 cards you
  must trade before placing.
- **Attack:** click one of your towns with 2+ armies, then an outlined neighbor. The attacker rolls
  up to 3 dice and the defender up to 2. The highest dice are compared pairwise, and ties go to the
  defender. After a capture, you choose how many more armies to advance.
- **Terrain:** the ground favors the defender.
  - Mountains: the defender rolls 3 dice, and the best two count.
  - Hills: +1 on the defender's top die.
  - Forests: cover, so the defender loses at most one army per roll.
  - Rivers: attacking across a bridge costs the attacker a die.

  The arrow you aim with names whatever applies.
- **Fortify:** make one move between two of your towns that are linked through your own territory.
  The move ends your turn.
- Towns border each other on land, or across the Connecticut, Deerfield or Westfield rivers
  where a real bridge crosses (10 of them, listed in `js/map-data.js`). The Quabbin can't be
  crossed.
- Own every town to win.

Difficulty sets how aggressive the computer is and how many extra starting armies it gets to offset
moving second: Easy +0, Normal +2, Hard +6. AI 1X / 2X / 4X sets how fast it plays. At 2X and up,
its rolls against one town are shown as a single battle. Click the board or press Space during its
turn to skip ahead. A results screen after each game shows the swing of the war and your record
on that difficulty.

## Layout

| File | Role |
| --- | --- |
| `js/map-data.js` | ASCII map grid, towns, and counties. Edit the map here. |
| `js/map.js` | Builds the grid, adjacency (including river bridges), label anchors, and regions |
| `js/game.js` | Rules and state: phases, dice, advance, fortify, win |
| `js/ai.js` | The computer's decision for each step |
| `js/taunts.js` | What the computer says when towns and counties change hands |
| `js/ai-turn.js` | Runs the computer's turn with animation, speed and skip |
| `js/ui.js` | Canvas rendering, input, HUD, and modals |
| `js/combat.js` | Dice overlay and resolution |
| `js/sprites.js` | Pixel art; every palette key is one character |
| `js/audio.js` | WebAudio chip-tune sound effects and the looping chip-tune march |
| `js/main.js` | Title screen, save/CONTINUE, and the win/loss record |

## Checks

```
dev/smoke.sh
```

This runs the map check (contiguity, connectivity, label anchors), the sprite palette check, and a
headless simulation of 60 games through the real rules and AI. It then opens the actual page in
headless Chrome and plays 6 rounds with real click events: trades, undo, every AI speed, and
skip. Two more runs quit in the middle of the computer's turn, and reload and CONTINUE in the middle
of it. Use `dev/smoke.sh 80 hard` to play a whole game. `dev/sprites.html` is a gallery of every
sprite.

Balance: `node dev/sim.mjs 400` plays the computer against a terrain-aware stand-in human. Set
`BONUS=easy,normal,hard` to try other start bonuses, and `BOT_RATIO` to make the stand-in bolder or
more careful. With cards and terrain in, the computer wins about 10% / 50% / 70% on Easy / Normal /
Hard.
