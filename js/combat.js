/* Risk: Pioneer Valley — combat: dice animation + resolution. */
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
        '<div class="dice-side">' +
          '<div class="dice-label atk-label">—</div>' +
          '<div class="dice-row atk-row"></div>' +
        '</div>' +
        '<div class="dice-vs">VS</div>' +
        '<div class="dice-side">' +
          '<div class="dice-label def-label">—</div>' +
          '<div class="dice-row def-row"></div>' +
        '</div>' +
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

  // Roll, animate, resolve. onDone fires after everything settles
  // (and, for the human, after any post-capture advance is chosen).
  function doAttack(st, from, to, onDone, opts) {
    opts = opts || {};
    var a = st.territories[from], b = st.territories[to];
    var atkN = Math.min(3, a.armies - 1);
    var defN = Math.min(2, b.armies);
    var atkName = st.players[st.turn].name, defName = st.players[b.owner].name;
    var atkKind = st.players[st.turn].dice, defKind = st.players[b.owner].dice;
    var fromName = a.name, toName = b.name;

    var result = RV.Game.attack(st, from, to);
    if (!result) { if (onDone) onDone(); return; }
    RV.UI.setBusy(true);

    var ROLL = opts.fast ? 380 : 700;
    var HOLD = opts.fast ? 420 : 650;

    ensureOverlay();
    overlay.querySelector('.atk-label').textContent = atkName + ' — ' + fromName;
    overlay.querySelector('.def-label').textContent = defName + ' — ' + toName;

    var atkRow = overlay.querySelector('.atk-row');
    var defRow = overlay.querySelector('.def-row');
    var scale = 4;
    setDice(atkRow, new Array(atkN).fill(1), atkKind, scale);
    setDice(defRow, new Array(defN).fill(1), defKind, scale);
    overlay.classList.add('show');
    RV.Audio.play('dice');

    var t0 = Date.now();
    (function tick() {
      if (RV.UI.state !== st) { overlay.classList.remove('show'); return; }
      if (Date.now() - t0 < ROLL) {
        shuffleRow(atkRow, atkKind);
        shuffleRow(defRow, defKind);
        setTimeout(tick, 70);
        return;
      }
      setDice(atkRow, result.atk, atkKind, scale);
      setDice(defRow, result.def, defKind, scale);
      markLosers(atkRow, defRow, result);
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
      var fx = RV.centroid[to][0] * CELL, fy = RV.centroid[to][1] * CELL;
      var fx2 = RV.centroid[from][0] * CELL, fy2 = RV.centroid[from][1] * CELL;
      RV.Audio.play('hit');
      if (result.defLoss) RV.UI.addFloat(fx, fy - 10, '-' + result.defLoss, '#ff8a80');
      if (result.atkLoss) RV.UI.addFloat(fx2, fy2 - 10, '-' + result.atkLoss, '#ff8a80');
      var who = st.turn === 0 ? 'You attack ' : 'The Machine attacks ';
      var msg = who + toName + ' from ' + fromName + ': ' +
        result.atk.join(',') + ' vs ' + result.def.join(',');
      if (result.captured) {
        msg += ' — ' + toName + ' captured!';
        RV.addLog(st, msg);
        RV.Audio.play('capture');
        setTimeout(function () {
          RV.UI.addFloat(fx, fy - 26, toName.toUpperCase() + ' FALLS', '#ffd23f');
        }, 200);
      } else {
        msg += ' — defender loses ' + result.defLoss +
               ', attacker loses ' + result.atkLoss + '.';
        RV.addLog(st, msg);
        if (result.defLoss === 0) RV.Audio.play('lose');
      }
      RV.UI.refresh();

      if (st.over != null) {
        setTimeout(function () {
          RV.UI.setBusy(false);
          RV.UI.showGameOver(st.over);
        }, 700);
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
      }, 120);
    }
  }

  // Dim the dice that lost their comparison.
  function markLosers(atkRow, defRow, r) {
    var pairs = Math.min(r.atk.length, r.def.length);
    for (var i = 0; i < pairs; i++) {
      var loser = r.atk[i] > r.def[i] ? defRow.children[i] : atkRow.children[i];
      if (loser) loser.classList.add('lost');
    }
  }

  RV.Combat = { doAttack: doAttack };
})();
