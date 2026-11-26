/* Risk: Pioneer Valley — board rendering and human input. */
(function () {
  'use strict';

  var CELL = 16;
  var BW, BH;              // board size in logical px
  var canvas, ctx, k = 1, dpr = 1;
  var tiles = null;
  var sel = -1;            // selected territory
  var hover = -1;
  var animating = false;   // lock input during dice / modals
  var floats = [];         // floating combat text
  var pulse = 0;
  var dirty = true;
  var gameOverShown = false;
  var modalOpen = false;
  var arrow = null;        // {from, to, color} while a fight is on screen
  var flashes = [];        // capture flashes: {i, color, life}
  var shake = 0;           // frames of screen shake left
  var townCells = [];      // [[x, y], ...] per territory, for flashes
  var blitzOn = false;
  var sayTimer = null;
  var reduceMotion = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { blitzOn = localStorage.getItem('pvrisk.blitz') === '1'; } catch (e) { /* private mode */ }

  var GROUND = {
    mountain: ['MOUNTAIN · +1 DIE', 'Defender rolls 3 dice; the best two count.'],
    hills:    ['HILLS · +1', 'Defender adds 1 to their highest die.'],
    forest:   ['FOREST · COVER', 'Defender loses at most 1 army per roll.'],
    plains:   ['PLAINS', 'Open ground: no defense bonus.'],
  };

  var ui = { state: null };

  function busy() {
    return animating || modalOpen || !ui.state || ui.state.turn === 1 || ui.state.over != null;
  }

  function init() {
    canvas = document.getElementById('board');
    ctx = canvas.getContext('2d');
    BW = RV.MAP_W * CELL;
    BH = RV.MAP_H * CELL;
    tiles = RV.buildTiles(1);
    tiles.house2 = RV.paintSprite(RV.SPR.house, 2);
    for (var t = 0; t < RV.TERRITORIES.length; t++) townCells.push([]);
    for (var y = 0; y < RV.MAP_H; y++) {
      for (var x = 0; x < RV.MAP_W; x++) if (RV.grid[y][x] >= 0) townCells[RV.grid[y][x]].push([x, y]);
    }
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', function () { hover = -1; dirty = true; refreshHUD(); });
    document.addEventListener('keydown', onKey);
    // Any click outside the controls during the Machine's turn skips its animations.
    document.addEventListener('click', function (e) {
      if (!ui.state || ui.state.turn !== 1 || !RV.AITurn.running()) return;
      if (e.target.closest && e.target.closest('button, .modal, .gameover')) return;
      RV.AITurn.skip();
      refreshHUD();
    }, true);
    wireButtons();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { dirty = true; });
    }
    renderLoop();
  }

  function resize() {
    var wrap = document.getElementById('board-wrap');
    var stacked = window.innerWidth <= 900;
    var availW = wrap.clientWidth - (stacked ? 32 : 312);
    var availH = stacked ? Infinity : wrap.clientHeight - 32;
    if (availW < 200) availW = 200;
    if (availH < 200) availH = 200;
    var fit = Math.min(availW / BW, availH / BH);
    // fill the space; snapping to 1/16 keeps every 16px cell a whole number of px
    k = Math.max(0.3, Math.floor(fit * 16) / 16);
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(BW * k * dpr);
    canvas.height = Math.round(BH * k * dpr);
    canvas.style.width = Math.round(BW * k) + 'px';
    canvas.style.height = Math.round(BH * k) + 'px';
    dirty = true;
  }

  // ---------------------------------------------------------------- render
  function render() {
    if (!ctx) return;
    ctx.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawBackground();
    drawTerrains();
    if (!ui.state) return;
    drawTints();
    drawFlashes();
    drawBorders();
    drawSelection();
    drawMarkers();
    drawArrows();
    drawFloats();
  }

  function drawBackground() {
    ctx.fillStyle = '#0c1420';
    ctx.fillRect(0, 0, BW, BH);
  }

  function drawTerrains() {
    for (var y = 0; y < RV.MAP_H; y++) {
      for (var x = 0; x < RV.MAP_W; x++) {
        var px = x * CELL, py = y * CELL;
        var key = x + ',' + y;
        if (RV.riverSet[key]) {
          ctx.drawImage(RV.lakeSet[key] ? tiles.lake : tiles.river, px, py);
          continue;
        }
        var t = RV.grid[y][x];
        if (t < 0) continue;
        var terr = RV.TERRITORIES[t].terrain;
        var set = tiles[terr === 'plains' ? 'grass' : terr];
        ctx.drawImage(set[RV.cellVariant(x, y, set.length)], px, py);
      }
    }
    RV.bridges.forEach(drawBridge);
  }

  // A plank bridge on the river cell where two towns face each other.
  function drawBridge(b) {
    var px = b.x * CELL, py = b.y * CELL;
    var h = b.dir === 'h';
    function r(x, y, w, hh, c) {
      ctx.fillStyle = c;
      if (h) ctx.fillRect(px + x, py + y, w, hh); else ctx.fillRect(px + y, py + x, hh, w);
    }
    r(0, 3, CELL, 10, '#3a2410');      // shadow / rails
    r(0, 4, CELL, 8, '#a8743a');       // deck
    for (var k = 1; k < CELL; k += 3) r(k, 4, 1, 8, '#7a4f24'); // planks
    r(0, 4, CELL, 1, '#d9a35c');       // rail highlight
    r(0, 11, CELL, 1, '#5a3a1a');
  }

  function drawTints() {
    var st = ui.state;
    ctx.globalAlpha = 0.34;
    for (var y = 0; y < RV.MAP_H; y++) {
      for (var x = 0; x < RV.MAP_W; x++) {
        var t = RV.grid[y][x];
        if (t < 0) continue;
        ctx.fillStyle = st.players[st.territories[t].owner].color;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Dark outline between towns; brighter, heavier line between counties.
  function drawBorders() {
    for (var y = 0; y < RV.MAP_H; y++) {
      for (var x = 0; x < RV.MAP_W; x++) {
        var t = RV.grid[y][x];
        if (t < 0) continue;
        var px = x * CELL, py = y * CELL;
        var edges = [
          [x, y - 1, 0, 0, CELL, 2],
          [x, y + 1, 0, CELL - 2, CELL, 2],
          [x - 1, y, 0, 0, 2, CELL],
          [x + 1, y, CELL - 2, 0, 2, CELL],
        ];
        for (var e = 0; e < 4; e++) {
          var nx = edges[e][0], ny = edges[e][1];
          var out = nx < 0 || ny < 0 || nx >= RV.MAP_W || ny >= RV.MAP_H;
          var other = out ? -2 : RV.grid[ny][nx];
          if (other === t) continue;
          if (!out && RV.riverSet[nx + ',' + ny]) continue;
          var county = other >= 0 && RV.regionOf[other] !== RV.regionOf[t];
          ctx.fillStyle = county ? 'rgba(255,240,200,0.55)' : '#101020';
          ctx.fillRect(px + edges[e][2], py + edges[e][3], edges[e][4], edges[e][5]);
        }
      }
    }
  }

  function fitFont(text, size, maxW, minSize) {
    for (var s = size; s >= minSize; s--) {
      ctx.font = s + 'px "Press Start 2P", monospace';
      if (ctx.measureText(text).width <= maxW) return s;
    }
    return minSize;
  }

  // Town width (in px) on the centroid's row, for label fitting.
  function rowWidth(i) {
    var cy = Math.floor(RV.centroid[i][1]), w = 0;
    for (var x = 0; x < RV.MAP_W; x++) if (RV.grid[cy][x] === i) w++;
    return w * CELL;
  }

  // House + army count + unit icons + name
  function drawMarkers() {
    var st = ui.state;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < st.territories.length; i++) {
      var cx = RV.centroid[i][0] * CELL;
      var cy = RV.centroid[i][1] * CELL;
      var terr = st.territories[i];
      var cells = RV.TERRITORIES[i].cells;
      var big = cells >= 44;
      var small = cells < 24;
      var col = st.players[terr.owner].color;

      if (big) ctx.drawImage(tiles.house2, cx - 10, cy - 30);
      if (!small) {
        var maxI = Math.min(5, Math.floor(cells / 16));
        var shown = Math.min(terr.armies, maxI);
        var w = 12, gap = 14;
        var x0 = cx - (shown * gap - (gap - w)) / 2;
        var spr = RV.unitSprite('soldier', col);
        for (var s = 0; s < shown; s++) {
          ctx.drawImage(spr, Math.round(x0 + s * gap), Math.round(cy + (big ? 10 : 8)), w, Math.round(w * 12 / 14));
        }
      }

      // army count in an owner-colored chip
      var label = String(terr.armies);
      var fs = small ? 10 : 13;
      ctx.font = fs + 'px "Press Start 2P", monospace';
      var cw = Math.max(fs + 8, ctx.measureText(label).width + 8);
      var chipY = cy + (big ? -2 : -4);
      ctx.fillStyle = 'rgba(10,10,20,0.85)';
      ctx.fillRect(Math.round(cx - cw / 2) - 1, Math.round(chipY - fs / 2 - 4), Math.round(cw) + 2, fs + 8);
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(cx - cw / 2), Math.round(chipY - fs / 2 - 3), Math.round(cw), fs + 6);
      ctx.fillStyle = '#0a0a14';
      ctx.fillText(label, cx, chipY + 1);

      // name
      var name = (RV.TERRITORIES[i].label || terr.name).toUpperCase();
      var nfs = fitFont(name, small ? 6 : 7, rowWidth(i) - 6, 5);
      ctx.font = nfs + 'px "Press Start 2P", monospace';
      var ny = cy + (big ? 26 : (small ? 11 : 20));
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10,10,20,0.9)';
      ctx.strokeText(name, cx, ny);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(name, cx, ny);
    }
  }

  function territoryOutline(i, color, lw) {
    ctx.fillStyle = color;
    for (var y = 0; y < RV.MAP_H; y++) {
      for (var x = 0; x < RV.MAP_W; x++) {
        if (RV.grid[y][x] !== i) continue;
        var px = x * CELL, py = y * CELL;
        var edges = [
          [x, y - 1, 0, 0, CELL, lw],
          [x, y + 1, 0, CELL - lw, CELL, lw],
          [x - 1, y, 0, 0, lw, CELL],
          [x + 1, y, CELL - lw, 0, lw, CELL],
        ];
        for (var e = 0; e < 4; e++) {
          var nx = edges[e][0], ny = edges[e][1];
          var other = (nx < 0 || ny < 0 || nx >= RV.MAP_W || ny >= RV.MAP_H)
            ? -2 : RV.grid[ny][nx];
          if (other !== i) {
            ctx.fillRect(px + edges[e][2], py + edges[e][3], edges[e][4], edges[e][5]);
          }
        }
      }
    }
  }

  // Towns the current selection can act on.
  function targetsOf(i) {
    var st = ui.state;
    if (i < 0 || st.turn !== 0 || st.territories[i].owner !== 0) return [];
    if (st.phase === 'attack') {
      if (st.territories[i].armies < 2) return [];
      return RV.adj[i].filter(function (j) { return st.territories[j].owner !== 0; });
    }
    if (st.phase === 'fortify' && !st.fortified) {
      if (st.territories[i].armies < 2) return [];
      var out = [];
      st.territories.forEach(function (t, j) {
        if (j !== i && t.owner === 0 && RV.Game.connected(st, i, j)) out.push(j);
      });
      return out;
    }
    return [];
  }

  function drawSelection() {
    var st = ui.state;
    if (sel >= 0) {
      var color = st.phase === 'attack' ? 'rgba(255,90,82,0.9)' : 'rgba(125,255,138,0.85)';
      targetsOf(sel).forEach(function (j) {
        territoryOutline(j, j === hover ? '#ffffff' : color, 2);
      });
    }
    if (hover >= 0 && hover !== sel) {
      territoryOutline(hover, 'rgba(255,255,255,0.45)', 2);
    }
    if (sel >= 0) {
      var a = 0.65 + 0.35 * Math.sin(pulse * 0.15);
      territoryOutline(sel, 'rgba(255,224,64,' + a.toFixed(2) + ')', 3);
    }
  }

  // ---------------------------------------------------------- capture fx
  function captureFx(i, color, quiet) {
    flashes.push({ i: i, color: color, life: quiet ? 14 : 28, max: quiet ? 14 : 28 });
    if (!quiet && !reduceMotion) shake = 16;
    dirty = true;
  }

  function drawFlashes() {
    for (var f = flashes.length - 1; f >= 0; f--) {
      var fl = flashes[f];
      var t = fl.life / fl.max;          // 1 -> 0
      ctx.globalAlpha = 0.85 * t;
      ctx.fillStyle = t > 0.6 ? '#ffffff' : fl.color;
      townCells[fl.i].forEach(function (c) { ctx.fillRect(c[0] * CELL, c[1] * CELL, CELL, CELL); });
      ctx.globalAlpha = 1;
      if (--fl.life <= 0) flashes.splice(f, 1);
    }
  }

  // ---------------------------------------------------------------- arrows
  // The fight on screen, or (on your turn) the attack you're about to make.
  function drawArrows() {
    var st = ui.state;
    if (arrow) { drawArrow(arrow.from, arrow.to, arrow.color, null); return; }
    if (st.turn === 0 && st.phase === 'attack' && sel >= 0 && hover >= 0 &&
        targetsOf(sel).indexOf(hover) >= 0 && !animating && !modalOpen) {
      drawArrow(sel, hover, st.players[0].color, groundLabel(sel, hover));
    }
  }

  function groundLabel(from, to) {
    var m = RV.Game.combatMods(ui.state, from, to), parts = [];
    if (m.river) parts.push('RIVER -1 DIE');
    if (m.terrain === 'mountain') parts.push('MOUNTAIN +1 DIE');
    if (m.terrain === 'hills') parts.push('HILLS +1');
    if (m.terrain === 'forest') parts.push('COVER');
    return parts.join(' · ');
  }

  function drawArrow(from, to, color, label) {
    var ax = RV.centroid[from][0] * CELL, ay = RV.centroid[from][1] * CELL - 4;
    var bx = RV.centroid[to][0] * CELL, by = RV.centroid[to][1] * CELL - 4;
    var dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy);
    if (len < 24) return;
    var ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    var sx = ax + ux * 12, sy = ay + uy * 12;
    var ex = bx - ux * 14, ey = by - uy * 14;      // arrow tip
    var hx = ex - ux * 12, hy = ey - uy * 12;      // base of the head
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(10,10,20,0.9)';
    ctx.lineWidth = 8;
    seg(sx, sy, hx, hy);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -(pulse % 40) * 0.5;
    seg(sx, sy, hx, hy);
    ctx.setLineDash([]);
    tri(ex + ux * 3, ey + uy * 3, hx - ux * 2 + nx * 11, hy - uy * 2 + ny * 11,
        hx - ux * 2 - nx * 11, hy - uy * 2 - ny * 11, 'rgba(10,10,20,0.9)');
    tri(ex, ey, hx + nx * 8, hy + ny * 8, hx - nx * 8, hy - ny * 8, color);
    if (label) {
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var mx = (sx + hx) / 2, my = (sy + hy) / 2 - 12;
      var w = ctx.measureText(label).width + 8;
      mx = Math.max(w / 2 + 2, Math.min(BW - w / 2 - 2, mx));
      ctx.fillStyle = 'rgba(10,10,20,0.9)';
      ctx.fillRect(Math.round(mx - w / 2), Math.round(my - 6), Math.round(w), 12);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(label, mx, my + 1);
    }
    ctx.restore();

    function seg(x1, y1, x2, y2) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    function tri(x1, y1, x2, y2, x3, y3, c) {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill();
    }
  }

  // --------------------------------------------------------------- floats
  function addFloat(x, y, text, color) {
    floats.push({ x: x, y: y, text: text, color: color, life: 60 });
  }

  function drawFloats() {
    for (var i = floats.length - 1; i >= 0; i--) {
      var f = floats[i];
      f.life--;
      f.y -= 0.4;
      if (f.life <= 0) { floats.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, f.life / 30);
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      var half = ctx.measureText(f.text).width / 2 + 3;
      f.x = Math.max(half, Math.min(BW - half, f.x));
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10,10,20,0.9)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- input
  function cellAt(e) {
    var r = canvas.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width * BW;
    var y = (e.clientY - r.top) / r.height * BH;
    var cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= RV.MAP_W || cy >= RV.MAP_H) return -1;
    return RV.grid[cy][cx];
  }

  function onMove(e) {
    var t = busy() && !(ui.state && ui.state.turn === 1) ? -1 : cellAt(e);
    if (t !== hover) {
      hover = t;
      dirty = true;
      refreshHUD();
    }
  }

  function onKey(e) {
    if (modalOpen || !ui.state) return;
    if (e.key === 'Escape' && sel >= 0) {
      sel = -1; dirty = true; refreshHUD();
    } else if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      doUndo();
    } else if (e.key === ' ' && ui.state.turn === 1 && RV.AITurn.running()) {
      e.preventDefault();
      RV.AITurn.skip();
      refreshHUD();
    } else if ((e.key === 'b' || e.key === 'B') && !e.metaKey && !e.ctrlKey) {
      toggleBlitz();
    }
  }

  function toggleBlitz() {
    blitzOn = !blitzOn;
    try { localStorage.setItem('pvrisk.blitz', blitzOn ? '1' : '0'); } catch (err) { /* ignore */ }
    RV.Audio.play('click');
    refreshHUD();
  }

  function doUndo() {
    var st = ui.state;
    if (busy() || !RV.Game.canUndo(st)) return;
    var u = RV.Game.undoPlacement(st);
    if (!u) return;
    sel = -1;
    RV.Audio.play('undo');
    addFloat(RV.centroid[u.i][0] * CELL, RV.centroid[u.i][1] * CELL - 8, '-' + u.n, '#ffd23f');
    refreshHUD();
  }

  function doTrade() {
    var st = ui.state;
    if (busy() || !RV.Game.canTrade(st)) return;
    var t = RV.Game.tradeCards(st);
    if (!t) return;
    sel = -1;
    RV.Audio.play('trade');
    RV.addLog(st, 'You trade in three cards for +' + t.armies + ' armies' +
      (t.bonusTown >= 0 ? ' (+2 on ' + st.territories[t.bonusTown].name + ')' : '') + '.');
    if (t.bonusTown >= 0) {
      addFloat(RV.centroid[t.bonusTown][0] * CELL, RV.centroid[t.bonusTown][1] * CELL - 8, '+2', '#7dff8a');
    }
    refreshHUD();
  }

  function cardName(c) {
    if (c.kind === 'wild') return 'Wild card';
    return RV.TERRITORIES[c.town].name + ' — ' + c.kind.charAt(0).toUpperCase() + c.kind.slice(1);
  }

  function onClick(e) {
    if (busy()) return;
    var t = cellAt(e);
    if (t < 0) { sel = -1; dirty = true; refreshHUD(); return; }
    var st = ui.state;
    var terr = st.territories[t];

    if (st.phase === 'reinforce') {
      if (RV.Game.mustTrade(st)) {
        RV.addLog(st, 'You hold ' + st.hands[0].length + ' cards: trade in a set first.');
        RV.Audio.play('lose');
        nudge('btn-trade');
      } else if (terr.owner === 0 && st.pool > 0) {
        var n = e.shiftKey ? st.pool : 1;
        RV.Game.placeArmies(st, t, n);
        RV.Audio.play('move');
        addFloat(RV.centroid[t][0] * CELL, RV.centroid[t][1] * CELL - 8, '+' + n, '#7dff8a');
        if (st.pool <= 0) {
          RV.addLog(st, 'Reinforcements placed. Attack!');
          RV.Game.setPhase(st, 'attack');
          RV.Audio.play('phase');
        }
      } else if (terr.owner !== 0) {
        RV.Audio.play('lose');
      }
      refreshHUD();
      return;
    }

    if (st.phase === 'attack') {
      if (terr.owner === 0) {
        if (terr.armies < 2) {
          RV.addLog(st, terr.name + ' needs at least 2 armies to attack.');
          RV.Audio.play('lose');
          sel = -1;
        } else {
          sel = sel === t ? -1 : t;
          RV.Audio.play('select');
        }
      } else if (sel >= 0 && RV.adj[sel].indexOf(t) >= 0) {
        var from = sel;
        var how = (e.shiftKey || blitzOn) ? 'doBlitz' : 'doAttack';
        RV.Combat[how](st, from, t, function () {
          // keep the source selected for follow-up attacks
          sel = st.territories[from].armies >= 2 ? from : -1;
          dirty = true;
          refreshHUD();
        });
      } else {
        sel = -1;
      }
      refreshHUD();
      return;
    }

    if (st.phase === 'fortify') {
      if (st.fortified) {
        RV.addLog(st, 'You already fortified this turn.');
        refreshHUD();
        return;
      }
      if (terr.owner !== 0 || sel === t) {
        sel = -1;
      } else if (sel >= 0 && targetsOf(sel).indexOf(t) >= 0) {
        openMoveModal(sel, t);
      } else if (terr.armies >= 2) {
        sel = t;
        RV.Audio.play('select');
      } else {
        sel = -1;
      }
      refreshHUD();
    }
  }

  // -------------------------------------------------------------- buttons
  function wireButtons() {
    var phaseBtns = document.querySelectorAll('.btn.phase');
    for (var i = 0; i < phaseBtns.length; i++) {
      phaseBtns[i].addEventListener('click', function () {
        if (busy()) return;
        var st = ui.state, phase = this.dataset.phase;
        if (phase === st.phase) return;
        if (!RV.Game.setPhase(st, phase)) {
          if (st.pool > 0) RV.addLog(st, 'Place all ' + st.pool + ' reinforcements first.');
          RV.Audio.play('lose');
          refreshHUD();
          return;
        }
        sel = -1;
        RV.Audio.play('phase');
        refreshHUD();
      });
    }
    document.getElementById('btn-end').addEventListener('click', function () {
      if (busy()) return;
      var st = ui.state;
      if (st.pool > 0) {
        RV.addLog(st, 'Place all ' + st.pool + ' reinforcements first.');
        RV.Audio.play('lose');
        refreshHUD();
        return;
      }
      endHumanTurn();
    });
    var snd = document.getElementById('btn-sound');
    function paintSnd() {
      snd.textContent = RV.Audio.isOn() ? 'SND' : 'SND OFF';
      snd.classList.toggle('off', !RV.Audio.isOn());
    }
    paintSnd();
    snd.addEventListener('click', function () { RV.Audio.toggle(); paintSnd(); });
    var mus = document.getElementById('btn-music');
    function paintMus() {
      mus.textContent = RV.Audio.musicOn() ? 'MUSIC' : 'MUSIC OFF';
      mus.classList.toggle('off', !RV.Audio.musicOn());
    }
    paintMus();
    mus.addEventListener('click', function () { RV.Audio.toggleMusic(); paintMus(); });
    var spd = document.getElementById('btn-speed');
    function paintSpd() { spd.textContent = 'AI ' + RV.AITurn.speed() + 'X'; }
    paintSpd();
    spd.addEventListener('click', function () { RV.AITurn.cycleSpeed(); RV.Audio.play('click'); paintSpd(); });
    document.getElementById('btn-undo').addEventListener('click', doUndo);
    document.getElementById('btn-trade').addEventListener('click', doTrade);
    document.getElementById('btn-blitz').addEventListener('click', toggleBlitz);
    document.getElementById('btn-quit').addEventListener('click', function () {
      if (!ui.state || ui.state.over != null) { RV.Main.showMenu(); return; }
      openModal({
        title: 'QUIT GAME?',
        body: '<div class="move-line">Your game is saved. CONTINUE picks it up from the title screen.</div>',
        okLabel: 'QUIT',
        onOk: function () { RV.Main.showMenu(); },
      });
    });
  }

  // Briefly flash a control to point at it.
  function nudge(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('nudge');
    void el.offsetWidth;
    el.classList.add('nudge');
  }

  // The Machine speaks: a bubble under its name, and a line in the log.
  function say(line) {
    if (!line || !ui.state) return;
    RV.addLog(ui.state, { text: 'THE MACHINE: "' + line + '"', kind: 'taunt' });
    var el = document.getElementById('taunt');
    el.textContent = line;
    el.classList.add('show');
    if (!(RV.AITurn.skipping && RV.AITurn.skipping())) RV.Audio.play('taunt');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(function () { el.classList.remove('show'); }, 2600 + line.length * 45);
    refreshHUD();
  }

  // Your turn begins (after the Machine's).
  function onHumanTurn() {
    var st = ui.state;
    if (!st || st.turn !== 0) return;
    if (RV.Game.mustTrade(st)) {
      RV.addLog(st, 'You hold ' + st.hands[0].length + ' cards: trade in a set first.');
      nudge('btn-trade');
    }
    refreshHUD();
  }

  function endHumanTurn() {
    var st = ui.state;
    sel = -1;
    RV.addLog(st, 'You end your turn.');
    RV.Game.endTurn(st);
    if (st.drawn) {
      RV.addLog(st, 'You took a town, so you draw a card: ' + cardName(st.drawn) + '.');
      RV.Audio.play('card');
    }
    RV.Audio.play('turn');
    dirty = true;
    refreshHUD();
    if (st.over != null) { showGameOver(st.over); return; }
    RV.AITurn.run();
  }

  // --------------------------------------------------------------- modals
  // openModal({title, body, okLabel, cancelLabel, danger, onOk, onCancel, onOpen, noCancel})
  function openModal(o) {
    var modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = o.title;
    document.getElementById('modal-body').innerHTML = o.body || '';
    var okBtn = document.getElementById('modal-ok');
    var cancelBtn = document.getElementById('modal-cancel');
    okBtn.textContent = o.okLabel || 'CONFIRM';
    okBtn.classList.toggle('danger', !!o.danger);
    cancelBtn.textContent = o.cancelLabel || 'CANCEL';
    cancelBtn.style.display = o.noCancel ? 'none' : '';
    modal.classList.remove('hidden');
    modalOpen = true;

    function close() {
      modal.classList.add('hidden');
      modalOpen = false;
      okBtn.onclick = cancelBtn.onclick = null;
      document.removeEventListener('keydown', key);
    }
    function key(e) {
      if (e.key === 'Enter') { e.preventDefault(); okBtn.onclick(); }
      else if (e.key === 'Escape' && !o.noCancel) { e.preventDefault(); cancelBtn.onclick(); }
      else if (o.onKey) o.onKey(e);
    }
    okBtn.onclick = function () { close(); if (o.onOk) o.onOk(); };
    cancelBtn.onclick = function () { close(); if (o.onCancel) o.onCancel(); };
    document.addEventListener('keydown', key);
    if (o.onOpen) o.onOpen();
    okBtn.focus();
  }

  function stepperHTML(val) {
    return '<div class="stepper">' +
        '<button id="mv-min" class="btn small" title="Minimum">&laquo;</button>' +
        '<button id="mv-minus" class="btn small">-</button>' +
        '<span id="mv-val" class="stepper-val">' + val + '</span>' +
        '<button id="mv-plus" class="btn small">+</button>' +
        '<button id="mv-max" class="btn small" title="Maximum">&raquo;</button>' +
      '</div>';
  }

  // Wires a stepper; returns a getter for its value.
  function wireStepper(min, max, start) {
    var val = start;
    function setVal(n) {
      val = Math.max(min, Math.min(max, n));
      document.getElementById('mv-val').textContent = val;
    }
    document.getElementById('mv-minus').onclick = function () { setVal(val - 1); RV.Audio.play('click'); };
    document.getElementById('mv-plus').onclick = function () { setVal(val + 1); RV.Audio.play('click'); };
    document.getElementById('mv-min').onclick = function () { setVal(min); RV.Audio.play('click'); };
    document.getElementById('mv-max').onclick = function () { setVal(max); RV.Audio.play('click'); };
    return {
      get: function () { return val; },
      key: function (e) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === '-') setVal(val - 1);
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === '+' || e.key === '=') setVal(val + 1);
      },
    };
  }

  function openMoveModal(from, to) {
    var st = ui.state;
    var a = st.territories[from], b = st.territories[to];
    var maxN = a.armies - 1;
    var stepper;
    openModal({
      title: 'FORTIFY',
      body: '<div class="move-line">' + a.name + ' <b>' + a.armies + '</b> &rarr; ' +
        b.name + ' <b>' + b.armies + '</b></div>' + stepperHTML(maxN),
      okLabel: 'MOVE',
      onOpen: function () { stepper = wireStepper(1, maxN, maxN); },
      onKey: function (e) { stepper.key(e); },
      onOk: function () {
        var n = stepper.get();
        if (RV.Game.moveArmies(st, from, to, n)) {
          RV.Audio.play('move');
          RV.addLog(st, 'You moved ' + n + ' from ' + a.name + ' to ' + b.name + '.');
          addFloat(RV.centroid[to][0] * CELL, RV.centroid[to][1] * CELL - 8, '+' + n, '#7dff8a');
          sel = -1;
          refreshHUD();
          // one fortify per turn: the turn ends here
          animating = true;
          setTimeout(function () {
            animating = false;
            if (ui.state === st && st.turn === 0) endHumanTurn();
          }, 600);
        }
      },
    });
  }

  // After a capture: choose how many more armies to push in.
  function openAdvanceModal(done) {
    var st = ui.state, adv = st.advance;
    var a = st.territories[adv.from], b = st.territories[adv.to];
    var stepper;
    openModal({
      title: 'ADVANCE',
      body: '<div class="move-line">' + a.name + ' <b>' + a.armies + '</b> &rarr; ' +
        b.name + ' <b>' + b.armies + '</b></div>' + stepperHTML(adv.max),
      okLabel: 'MOVE',
      noCancel: true,
      onOpen: function () { stepper = wireStepper(0, adv.max, adv.max); },
      onKey: function (e) { stepper.key(e); },
      onOk: function () {
        var n = stepper.get();
        RV.Game.advance(st, n);
        if (n > 0) {
          RV.Audio.play('move');
          RV.addLog(st, 'You advance ' + n + ' more into ' + b.name + '.');
        }
        dirty = true;
        refreshHUD();
        done();
      },
    });
  }

  // ----------------------------------------------------------------- HUD
  function refreshHUD() {
    dirty = true;
    if (!ui.state) return;
    var st = ui.state;
    var i;
    for (i = 0; i < 2; i++) {
      var side = i === 0 ? 'player' : 'ai';
      var p = st.players[i];
      document.getElementById('sw-' + side).style.background = p.color;
      document.getElementById('hud-' + side + '-name').textContent = p.name;
      document.getElementById('hud-' + side + '-stats').textContent =
        RV.Game.territoriesOf(st, i).length + ' TOWNS · ' + RV.Game.totalArmies(st, i) + ' ARMIES' +
        // your own cards are on the side panel; the Machine's count is worth watching
        (i === 1 ? ' · ' + st.hands[1].length + (st.hands[1].length === 1 ? ' CARD' : ' CARDS') : '');
    }
    var myTurn = st.turn === 0;
    var skipping = !myTurn && RV.AITurn.skipping();
    document.getElementById('turn-banner').textContent =
      st.over != null ? 'GAME OVER' :
      (myTurn ? 'YOUR TURN' : (skipping ? 'SKIPPING...' : 'THE MACHINE IS PLOTTING...'));
    var phaseNames = {
      reinforce: 'REINFORCE',
      attack: 'ATTACK',
      fortify: 'FORTIFY',
    };
    document.getElementById('phase-banner').textContent =
      st.over != null ? '' : 'ROUND ' + st.round + ' · ' + phaseNames[st.phase] +
      (!myTurn && !skipping && RV.AITurn.running() ? ' · CLICK TO SKIP' : '');
    document.getElementById('pool-count').textContent = st.phase === 'reinforce' ? st.pool : 0;
    document.getElementById('reinforce-pool').classList.toggle('empty', !(st.phase === 'reinforce' && st.pool > 0));
    document.querySelectorAll('.btn.phase').forEach(function (b) {
      var ph = b.dataset.phase;
      b.classList.toggle('active', ph === st.phase);
      b.disabled = !myTurn || (ph !== st.phase && !RV.Game.canSetPhase(st, ph));
    });
    document.getElementById('btn-end').disabled = !myTurn || st.over != null || st.pool > 0;
    document.getElementById('btn-undo').disabled = !myTurn || !RV.Game.canUndo(st);
    var blitzBtn = document.getElementById('btn-blitz');
    blitzBtn.classList.toggle('on', blitzOn);
    blitzBtn.textContent = blitzOn ? 'BLITZ ON' : 'BLITZ';
    refreshCards(st, myTurn);

    // info card
    var t = sel >= 0 ? sel : (hover >= 0 ? hover : -1);
    var card = document.getElementById('info-card');
    if (t >= 0) {
      var terr = st.territories[t];
      card.classList.remove('idle');
      document.getElementById('info-name').textContent = terr.name.toUpperCase();
      document.getElementById('info-owner').textContent = st.players[terr.owner].name;
      document.getElementById('info-owner').style.color = st.players[terr.owner].color;
      document.getElementById('info-armies').textContent = terr.armies;
      document.getElementById('info-county').textContent = RV.REGIONS[RV.regionOf[t]].name.toUpperCase();
      var g = GROUND[terr.terrain] || GROUND.plains;
      document.getElementById('info-ground').textContent = g[0];
      document.getElementById('info-ground-row').title = g[1];
      document.getElementById('info-borders').innerHTML = RV.adj[t].map(function (j) {
        return '<span style="color:' + st.players[st.territories[j].owner].color + '">' +
          st.territories[j].name + '</span>';
      }).join(', ');
    } else {
      card.classList.add('idle');
      document.getElementById('info-name').textContent = '—';
      document.getElementById('info-owner').textContent = '—';
      document.getElementById('info-owner').style.color = '';
      document.getElementById('info-armies').textContent = '—';
      document.getElementById('info-county').textContent = '—';
      document.getElementById('info-ground').textContent = '—';
      document.getElementById('info-ground-row').title = '';
      document.getElementById('info-borders').textContent = '—';
    }

    // counties
    document.getElementById('regions').innerHTML = RV.REGIONS.map(function (r, ri) {
      var towns = RV.regionTowns[ri];
      var mine = 0, theirs = 0;
      towns.forEach(function (j) {
        if (st.territories[j].owner === 0) mine++; else theirs++;
      });
      var holder = mine === towns.length ? 0 : (theirs === towns.length ? 1 : -1);
      return '<div class="region-row' + (holder >= 0 ? ' held' : '') + '"' +
        (holder >= 0 ? ' style="color:' + st.players[holder].color + '"' : '') + '>' +
        '<span class="rname">' + r.name.toUpperCase() + '</span>' +
        '<span class="rbar">' +
          '<i style="width:' + (100 * mine / towns.length) + '%;background:' + st.players[0].color + '"></i>' +
          '<i style="width:' + (100 * theirs / towns.length) + '%;background:' + st.players[1].color + '"></i>' +
        '</span>' +
        '<span class="rbonus">+' + r.bonus + '</span>' +
      '</div>';
    }).join('');

    // log
    var logEl = document.getElementById('log');
    logEl.innerHTML = st.log.slice(-7).map(function (l) {
      var d = document.createElement('div');
      d.className = 'log-line' + (typeof l === 'object' && l.kind ? ' ' + l.kind : '');
      d.textContent = typeof l === 'object' ? l.text : l;
      return d.outerHTML;
    }).join('');

    RV.Main.autosave(st);
  }

  // Your hand, the set TRADE would use, and what it's worth.
  var handKey = '';
  function refreshCards(st, myTurn) {
    var hand = st.hands[0];
    var set = RV.Game.bestSet(st, 0) || [];
    var key = JSON.stringify(hand) + '|' + set.join(',');
    if (key !== handKey) {
      handKey = key;
      var el = document.getElementById('hand');
      el.innerHTML = '';
      if (!hand.length) {
        el.innerHTML = '<div class="hand-empty">—</div>';
      }
      hand.forEach(function (c, i) {
        var d = document.createElement('div');
        d.className = 'rcard ' + c.kind + (set.indexOf(i) >= 0 ? ' inset' : '') +
          (c.town >= 0 && st.territories[c.town].owner === 0 ? ' owned' : '');
        d.title = cardName(c) + (c.town >= 0 && st.territories[c.town].owner === 0
          ? ' (you hold it: +2 there when traded)' : '');
        var art = c.kind === 'wild'
          ? RV.paintSprite(RV.SPR.star, 2)
          : RV.paintSprite(RV.SPR[RV.TERRAIN_TILES[c.kind]][0], 2);
        art.className = 'rcard-art';
        d.appendChild(art);
        var nm = document.createElement('div');
        nm.className = 'rcard-name';
        nm.textContent = c.kind === 'wild' ? 'WILD' : (RV.TERRITORIES[c.town].label || RV.TERRITORIES[c.town].name).toUpperCase();
        d.appendChild(nm);
        var kd = document.createElement('div');
        kd.className = 'rcard-kind';
        kd.textContent = c.kind === 'wild' ? 'ANY' : c.kind.toUpperCase();
        d.appendChild(kd);
        el.appendChild(d);
      });
    }
    var tb = document.getElementById('btn-trade');
    tb.textContent = 'TRADE +' + RV.Game.tradeValue(st);
    tb.disabled = !myTurn || !RV.Game.canTrade(st);
    tb.classList.toggle('urgent', myTurn && RV.Game.mustTrade(st));
  }

  // ------------------------------------------------------------ game over
  // Results: what happened, the round the tide turned, and your record.
  function showGameOver(winner) {
    if (gameOverShown) return;
    gameOverShown = true;
    animating = true;
    var youWon = winner === 0;
    var st = ui.state;
    RV.Audio.play(youWon ? 'win' : 'loseAll');
    var rec = RV.Main.recordResult(st.difficulty, youWon);
    var S = st.stats;
    var c0 = st.players[0].color, c1 = st.players[1].color;

    function pair(a, b) {
      return '<span style="color:' + c0 + '">' + a + '</span> · <span style="color:' + c1 + '">' + b + '</span>';
    }
    var big = '—';
    if (S.biggest) {
      var bb = S.biggest;
      big = st.territories[bb.from].name.toUpperCase() + ' &gt; ' + st.territories[bb.to].name.toUpperCase() +
        '<small>ROUND ' + bb.round + ' · ' + (bb.by === 0 ? 'YOU' : 'THE MACHINE') + ' · ' +
        (bb.atkLoss + bb.defLoss) + ' FELL' + (bb.captured ? ' · TAKEN' : ' · HELD') + '</small>';
    }
    var tide = tideRound(S.history, winner);
    var rows = [
      ['TOWNS TAKEN', pair(S.taken[0], S.taken[1])],
      ['ARMIES LOST', pair(S.lost[0], S.lost[1])],
      ['CARD TRADES', pair(S.traded[0], S.traded[1])],
      ['BIGGEST BATTLE', big],
      ['TIDE TURNED', tide == null ? 'NEVER IN DOUBT' : 'ROUND ' + tide],
      [st.difficulty.toUpperCase() + ' RECORD', rec.w + 'W – ' + rec.l + 'L'],
    ];

    var overlay = document.createElement('div');
    overlay.className = 'gameover';
    overlay.innerHTML =
      '<div class="gameover-card">' +
        '<h2 class="' + (youWon ? 'win' : 'lose') + '">' + (youWon ? 'VICTORY!' : 'DEFEAT') + '</h2>' +
        '<div class="go-stats">ROUND ' + st.round + ' · ' + st.difficulty.toUpperCase() + '</div>' +
        '<canvas class="go-chart" width="320" height="84" title="Towns held each round"></canvas>' +
        '<div class="go-table">' + rows.map(function (r) {
          return '<div class="info-row"><span class="k">' + r[0] + '</span><span>' + r[1] + '</span></div>';
        }).join('') + '</div>' +
        '<button id="go-restart" class="btn">PLAY AGAIN</button>' +
      '</div>';
    document.body.appendChild(overlay);
    drawChart(overlay.querySelector('.go-chart'), S.history, st, tide);
    document.getElementById('go-restart').addEventListener('click', function () {
      overlay.remove();
      RV.Main.showMenu();
    });
  }

  // The round after the winner last trailed (or drew) on towns; null if
  // they led from the first round on.
  function tideRound(history, winner) {
    var last = -1;
    history.forEach(function (h, k) { if (h.c[winner] <= h.c[1 - winner]) last = k; });
    if (last < 0) return null;
    var nxt = history[last + 1];
    return nxt ? nxt.round : history[last].round;
  }

  function drawChart(cv, history, st, tide) {
    if (!cv || !history.length) return;
    var c = cv.getContext('2d');
    var W = cv.width, H = cv.height, pad = 6, n = RV.TERRITORIES.length;
    c.fillStyle = '#0b1222';
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(pad, Math.round(H / 2), W - pad * 2, 1);          // the halfway line
    var xs = function (k) { return pad + (history.length < 2 ? 0 : k * (W - pad * 2) / (history.length - 1)); };
    var ys = function (v) { return H - pad - v * (H - pad * 2) / n; };
    if (tide != null) {
      history.forEach(function (h, k) {
        if (h.round === tide) { c.fillStyle = 'rgba(255,210,63,0.35)'; c.fillRect(Math.round(xs(k)) - 1, pad, 2, H - pad * 2); }
      });
    }
    [1, 0].forEach(function (p) {
      c.strokeStyle = st.players[p].color;
      c.lineWidth = 3;
      c.beginPath();
      history.forEach(function (h, k) {
        var x = Math.round(xs(k)), y = Math.round(ys(h.c[p]));
        if (k) c.lineTo(x, y); else c.moveTo(x, y);
      });
      c.stroke();
    });
  }

  // ------------------------------------------------------------- loop
  function renderLoop() {
    pulse++;
    if (shake > 0) {
      shake--;
      var m = shake * 0.45;
      canvas.style.transform = shake ? 'translate(' + Math.round((Math.random() * 2 - 1) * m) + 'px,' +
        Math.round((Math.random() * 2 - 1) * m) + 'px)' : '';
    }
    if (dirty || floats.length || sel >= 0 || arrow || flashes.length) {
      dirty = false;
      render();
    }
    requestAnimationFrame(renderLoop);
  }

  RV.UI = {
    init: init,
    get state() { return ui.state; },
    setState: function (st) {
      ui.state = st;
      sel = -1; hover = -1; animating = false; modalOpen = false;
      gameOverShown = false;
      floats.length = 0;
      flashes.length = 0;
      arrow = null;
      shake = 0;
      handKey = '';
      if (canvas) canvas.style.transform = '';
      var tb = document.getElementById('taunt');
      if (tb) tb.classList.remove('show');
      document.getElementById('modal').classList.add('hidden');
      var go = document.querySelector('.gameover');
      if (go) go.remove();
      dirty = true;
      refreshHUD();
    },
    render: function () { dirty = true; },
    addFloat: addFloat,
    setBusy: function (b) { animating = b; dirty = true; },
    busy: busy,
    refresh: refreshHUD,
    showGameOver: showGameOver,
    openAdvanceModal: openAdvanceModal,
    openModal: openModal,
    onHumanTurn: onHumanTurn,
    captureFx: captureFx,
    say: say,
    setArrow: function (from, to, color) { arrow = { from: from, to: to, color: color }; dirty = true; },
    clearArrow: function () { arrow = null; dirty = true; },
    resize: resize,
    getSel: function () { return sel; },
    setSel: function (i) { sel = i; dirty = true; },
  };
})();
