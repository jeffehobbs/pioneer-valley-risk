#!/bin/bash
# Run every check: map, sprites, headless sim, then the real game in
# headless Chrome (plays N rounds through click events).
# Usage: dev/smoke.sh [rounds] [difficulty]
set -euo pipefail
cd "$(dirname "$0")/.."
ROUNDS="${1:-6}"
DIFF="${2:-normal}"
PORT="${PORT:-8765}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

node dev/check-map.mjs | tail -1
node dev/check-sprites.mjs
node dev/sim.mjs 20

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 0.6

OUT=$("$CHROME" --headless=new --disable-gpu --no-first-run --mute-audio \
  --window-size=1460,1100 --virtual-time-budget=600000 \
  --dump-dom "http://127.0.0.1:$PORT/dev/smoke.html?rounds=$ROUNDS&diff=$DIFF" 2>/dev/null \
  | sed -n 's:.*<title>\(.*\)</title>.*:\1:p')
echo "$OUT"
[[ "$OUT" == "SMOKE: OK"* ]]

QUIT=$("$CHROME" --headless=new --disable-gpu --no-first-run --mute-audio \
  --window-size=1460,1100 --virtual-time-budget=60000 \
  --dump-dom "http://127.0.0.1:$PORT/dev/smoke.html?mode=quit" 2>/dev/null \
  | sed -n 's:.*<title>\(.*\)</title>.*:\1:p')
echo "$QUIT"
[[ "$QUIT" == "SMOKE: OK"* ]]

RESUME=$("$CHROME" --headless=new --disable-gpu --no-first-run --mute-audio \
  --window-size=1460,1100 --virtual-time-budget=120000 \
  --dump-dom "http://127.0.0.1:$PORT/dev/smoke.html?mode=resume" 2>/dev/null \
  | sed -n 's:.*<title>\(.*\)</title>.*:\1:p')
echo "$RESUME"
[[ "$RESUME" == "SMOKE: OK"* ]]
