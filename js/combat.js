/* Risk: Pioneer Valley — combat: dice animation + resolution.
 *
 * Two ways in, one way out:
 *  - doAttack(st, from, to, onDone, opts)  one roll (you, or the Machine at 1X)
 *  - showBattle(st, battle, onDone, opts)  the Machine's rolls, already resolved
 * Both end in show(), which animates the dice, shows the ground's effect and
 * any battle summary, then logs, taunts, flashes and calls onDone.
 */
(function () {
  'use strict';

  var CELL = 16;
  var overlay;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'dice-overlay';
    overlay.id = 'dice-overlay';
    overlay.innerHTML =
      '<div class="dice-card">' +
        '<div class="dice-main">' +
          '<div class="dice-side">' +
            '<div class="dice-label atk-label">—</div>' +
            '<div class="dice-row atk-row"></div>' +
          '</div>' +
          '<div class="dice-vs">VS</div>' +
          '<div class="dice-side">' +
            '<div class="dice-label def-label">—</div>' +
            '<div class="dice-row def-row"></div>' +
          '</div>' +
        '</div>' +
        '<div class="dice-tags"></div>' +
        '<div class="dice-summary"></div>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  function dieCanvas(face, kind, scale) {
    return RV.paintSprite(RV.SPR.dice[face][kind], scale || 4);
  }

  function setDice(rowEl, faces, kind, scale) {
    rowEl.innerHTML = '';
    for (var i = 0; i < faces.length; i++) {
      var cell = document.createElement('div');
      cell.className = 'die';
      cell.appendChild(dieCanvas(faces[i], kind, scale));
      rowEl.appendChild(cell);
    }
  }

  // Short labels for how the ground changed this fight.
  function modTags(mods) {
    var tags = [];
    if (mods.river) tags.push(['river', 'RIVER: ATTACKER -1 DIE']);
    if (mods.terrain === 'mountain') tags.push(['mountain', 'MOUNTAIN: DEFENDER +1 DIE']);
    if (mods.terrain === 'hills') tags.push(['hills', 'HILLS: DEFENDER +1 ON TOP DIE']);
    if (mods.terrain === 'forest') tags.push(['forest', 'FOREST: COVER, LOSES 1 MAX']);
    return tags;
  }

  function isSkipping(st) {
    return st.turn === 1 && RV.AITurn && RV.AITurn.skipping();
  }

  // One roll.
  function doAttack(st, from, to, onDone, opts) {
    var info = names(st, from, to);
    var result = RV.Game.attack(st, from, to);
    if (!result) { if (onDone) onDone(); return; }
    info.last = result;
    info.atkLoss = result.atkLoss;
    info.defLoss = result.defLoss;
    info.captured = result.captured;
    show(st, info, onDone, opts || {});
  }

  // The Machine's batch of rolls on one target (resolved by ai-turn).
  function showBattle(st, battle, onDone, opts) {
    var info = battle.info;
    info.last = battle.last;
    info.summary = battle.rolls > 1 ? battle : null;
    info.atkLoss = battle.atkLoss;
    info.defLoss = battle.defLoss;
    info.captured = battle.captured;
    show(st, info, onDone, opts || {});
  }

  // Names and dice colors, captured before the roll changes ownership.
  function names(st, from, to) {
    var a = st.territories[from], b = st.territories[to];
    return {
      from: from, to: to,
      by: st.turn, vs: b.owner,
      atkName: st.players[st.turn].name, defName: st.players[b.owner].name,
      atkKind: st.players[st.turn].dice, defKind: st.players[b.owner].dice,
      fromName: a.name, toName: b.name,
      startA: a.armies, startD: b.armies,
    };
  }

  function show(st, info, onDone, opts) {
    var result = info.last;
    RV.UI.setBusy(true);
    RV.UI.setArrow(info.from, info.to, st.players[info.by].color);

    var speed = opts.speed || 1;
    var ROLL = (opts.fast ? 380 : 700) / speed;
    var HOLD = (opts.fast ? 420 : 650) / speed;
    if (info.summary) HOLD += 500 / speed;
    if (isSkipping(st)) { finish(); return; }

    ensureOverlay();
    overlay.querySelector('.atk-label').textContent = info.atkName + ' — ' + info.fromName;
    overlay.querySelector('.def-label').textContent = info.defName + ' — ' + info.toName;
    overlay.querySelector('.dice-tags').innerHTML = modTags(result.mods).map(function (t) {
      return '<span class="tag ' + t[0] + '">' + t[1] + '</span>';
    }).join('');
    var sumEl = overlay.querySelector('.dice-summary');
    sumEl.innerHTML = '';
    sumEl.className = 'dice-summary';

    var atkRow = overlay.querySelector('.atk-row');
    var defRow = overlay.querySelector('.def-row');
    var scale = 4;
    setDice(atkRow, new Array(result.atk.length).fill(1), info.atkKind, scale);
    setDice(defRow, new Array(result.def.length).fill(1), info.defKind, scale);
    overlay.classList.add('show');
    RV.Audio.play('dice');

    var t0 = Date.now();
    (function tick() {
      if (RV.UI.state !== st) { overlay.classList.remove('show'); return; }
      if (isSkipping(st)) { overlay.classList.remove('show'); finish(); return; }
      if (Date.now() - t0 < ROLL) {
        shuffleRow(atkRow, info.atkKind);
        shuffleRow(defRow, info.defKind);
        setTimeout(tick, 70);
        return;
      }
      setDice(atkRow, result.atk, info.atkKind, scale);
      setDice(defRow, result.def, info.defKind, scale);
      markDice(atkRow, defRow, result);
      if (info.summary) showSummary(sumEl, info);
      setTimeout(function () {
        overlay.classList.remove('show');
        finish();
      }, HOLD);
    })();

    function shuffleRow(row, kind) {
      for (var i = 0; i < row.children.length; i++) {
        var cell = row.children[i];
        cell.innerHTML = '';
        cell.appendChild(dieCanvas(1 + Math.floor(Math.random() * 6), kind, scale));
      }
    }

    function finish() {
      if (RV.UI.state !== st) return; // game was abandoned mid-roll
      var quiet = isSkipping(st);
      var fx = RV.centroid[info.to][0] * CELL, fy = RV.centroid[info.to][1] * CELL;
      var fx2 = RV.centroid[info.from][0] * CELL, fy2 = RV.centroid[info.from][1] * CELL;
      if (!quiet) RV.Audio.play('hit');
      if (info.defLoss) RV.UI.addFloat(fx, fy - 10, '-' + info.defLoss, '#ff8a80');
      if (info.atkLoss) RV.UI.addFloat(fx2, fy2 - 10, '-' + info.atkLoss, '#ff8a80');
      RV.addLog(st, logLine(info, result));
      if (info.captured) {
        if (!quiet) { RV.Audio.play('capture'); RV.Audio.play('boom'); }
        RV.UI.captureFx(info.to, st.players[info.by].color, quiet);
        setTimeout(function () {
          RV.UI.addFloat(fx, fy - 26, info.toName.toUpperCase() + ' FALLS', '#ffd23f');
        }, quiet ? 0 : 200);
        captureTalk(st, info);
      } else if (info.defLoss === 0 && !quiet) {
        RV.Audio.play('lose');
      }
      RV.UI.clearArrow();
      RV.UI.refresh();

      if (st.over != null) {
        RV.UI.say(RV.Taunts.pick(st.over === 1 ? 'win' : 'lose_game'));
        setTimeout(function () {
          RV.UI.setBusy(false);
          RV.UI.showGameOver(st.over);
        }, 900);
        return;
      }

      setTimeout(function () {
        if (RV.UI.state !== st) return;
        if (st.turn === 0 && st.advance) {
          RV.UI.openAdvanceModal(function () {
            RV.UI.setBusy(false);
            if (onDone) onDone();
          });
          return;
        }
        RV.UI.setBusy(false);
        if (onDone) onDone();
      }, quiet ? 0 : 120);
    }
  }

  function logLine(info, last) {
    var you = info.by === 0;
    var s = info.summary;
    var msg;
    if (s) {
      msg = 'The Machine hits ' + info.toName + ' from ' + info.fromName +
        ': ' + s.rolls + ' rolls, it loses ' + info.atkLoss + ', you lose ' + info.defLoss;
    } else {
      msg = (you ? 'You attack ' : 'The Machine attacks ') + info.toName + ' from ' + info.fromName +
        ': ' + last.atk.join(',') + ' vs ' + last.def.join(',');
    }
    if (info.captured) return msg + ' — ' + info.toName + ' captured!';
    if (s) return msg + '.';
    return msg + ' — defender loses ' + info.defLoss + ', attacker loses ' + info.atkLoss + '.';
  }

  // The Machine gloats when it takes a town (or a county), and sulks
  // sometimes when you take one of its towns.
  function captureTalk(st, info) {
    var line = null;
    if (info.by === 1) {
      var county = RV.regionOf[info.to];
      var held = RV.Game.heldRegions(st, 1).indexOf(county) >= 0;
      if (held) line = RV.Taunts.pick('county', RV.REGIONS[county].name);
      else if (Math.random() < 0.6) line = RV.Taunts.pick('capture', info.toName);
    } else {
      var r = RV.regionOf[info.to];
      var wasTheirs = RV.regionTowns[r].every(function (i) {
        return i === info.to || st.territories[i].owner === 1;
      });
      if (wasTheirs && RV.regionTowns[r].length > 1) line = RV.Taunts.pick('broken');
      else if (Math.random() < 0.3) line = RV.Taunts.pick('lose');
    }
    if (line) RV.UI.say(line);
  }

  // Dim the dice that lost; mark cover saves and the unused mountain die.
  function markDice(atkRow, defRow, r) {
    var outcomes = r.outcomes || [];
    for (var i = 0; i < outcomes.length; i++) {
      var o = outcomes[i];
      if (o === 'a' && defRow.children[i]) defRow.children[i].classList.add('lost');
      if (o === 'd' && atkRow.children[i]) atkRow.children[i].classList.add('lost');
      if (o === 'c' && defRow.children[i]) defRow.children[i].classList.add('covered');
    }
    for (var j = outcomes.length; j < defRow.children.length; j++) {
      defRow.children[j].classList.add('spare');
    }
    if (r.mods && r.mods.defPlus && defRow.children[0]) {
      var badge = document.createElement('span');
      badge.className = 'die-badge';
      badge.textContent = '+' + r.mods.defPlus;
      defRow.children[0].appendChild(badge);
    }
  }

  function showSummary(el, info) {
    var s = info.summary;
    el.className = 'dice-summary show' + (info.captured ? ' won' : '');
    el.innerHTML =
      '<b>BATTLE &times;' + s.rolls + '</b> ' +
      '<span class="atk">-' + info.atkLoss + '</span> / ' +
      '<span class="def">-' + info.defLoss + '</span>' +
      (info.captured ? ' <b class="cap">CAPTURED</b>' : '');
  }

  RV.Combat = { doAttack: doAttack, showBattle: showBattle, names: names };
})();
