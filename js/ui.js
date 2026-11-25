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
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', function () { hover = -1; dirty = true; refreshHUD(); });
    document.addEventListener('keydown', onKey);
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
    drawBorders();
    drawSelection();
    drawMarkers();
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
    if (e.key === 'Escape' && sel >= 0 && !modalOpen) {
      sel = -1; dirty = true; refreshHUD();
    }
  }

  function onClick(e) {
    if (busy()) return;
    var t = cellAt(e);
    if (t < 0) { sel = -1; dirty = true; refreshHUD(); return; }
    var st = ui.state;
    var terr = st.territories[t];

    if (st.phase === 'reinforce') {
      if (terr.owner === 0 && st.pool > 0) {
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
        RV.Combat.doAttack(st, from, t, function () {
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
    document.getElementById('btn-sound').addEventListener('click', function () {
      var on = RV.Audio.toggle();
      this.textContent = on ? 'SND' : 'MUTE';
      this.classList.toggle('off', !on);
    });
    document.getElementById('btn-quit').addEventListener('click', function () {
      if (!ui.state || ui.state.over != null) { RV.Main.showMenu(); return; }
      openModal({
        title: 'QUIT GAME?',
        body: '<div class="move-line">This battle will be lost.</div>',
        okLabel: 'QUIT',
        danger: true,
        onOk: function () { RV.Main.showMenu(); },
      });
    });
  }

  function endHumanTurn() {
    var st = ui.state;
    sel = -1;
    RV.addLog(st, 'You end your turn.');
    RV.Game.endTurn(st);
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
        RV.Game.territoriesOf(st, i).length + ' TOWNS · ' + RV.Game.totalArmies(st, i) + ' ARMIES';
    }
    var myTurn = st.turn === 0;
    document.getElementById('turn-banner').textContent =
      st.over != null ? 'GAME OVER' :
      (myTurn ? 'YOUR TURN' : 'THE MACHINE IS PLOTTING...');
    var phaseNames = {
      reinforce: 'REINFORCE',
      attack: 'ATTACK',
      fortify: 'FORTIFY',
    };
    document.getElementById('phase-banner').textContent =
      st.over != null ? '' : 'ROUND ' + st.round + ' · ' + phaseNames[st.phase];
    document.getElementById('pool-count').textContent = st.phase === 'reinforce' ? st.pool : 0;
    document.getElementById('reinforce-pool').classList.toggle('empty', !(st.phase === 'reinforce' && st.pool > 0));
    document.querySelectorAll('.btn.phase').forEach(function (b) {
      var ph = b.dataset.phase;
      b.classList.toggle('active', ph === st.phase);
      b.disabled = !myTurn || (ph !== st.phase && !RV.Game.canSetPhase(st, ph));
    });
    document.getElementById('btn-end').disabled = !myTurn || st.over != null || st.pool > 0;

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
      d.className = 'log-line';
      d.textContent = l;
      return d.outerHTML;
    }).join('');
  }

  // ------------------------------------------------------------ game over
  function showGameOver(winner) {
    if (gameOverShown) return;
    gameOverShown = true;
    animating = true;
    var youWon = winner === 0;
    var st = ui.state;
    RV.Audio.play(youWon ? 'win' : 'loseAll');
    var overlay = document.createElement('div');
    overlay.className = 'gameover';
    overlay.innerHTML =
      '<div class="gameover-card">' +
        '<h2 class="' + (youWon ? 'win' : 'lose') + '">' +
          (youWon ? 'VICTORY!' : 'DEFEAT') + '</h2>' +
        '<div class="go-stats">ROUND ' + (st ? st.round : '?') + '</div>' +
        '<button id="go-restart" class="btn">PLAY AGAIN</button>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById('go-restart').addEventListener('click', function () {
      overlay.remove();
      RV.Main.showMenu();
    });
  }

  // ------------------------------------------------------------- loop
  function renderLoop() {
    pulse++;
    if (dirty || floats.length || sel >= 0) {
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
    resize: resize,
    getSel: function () { return sel; },
    setSel: function (i) { sel = i; dirty = true; },
  };
})();
