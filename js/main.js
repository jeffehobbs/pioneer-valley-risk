/* Pioneer Valley Risk — title screen, boot, saved game and record.
 *
 * The game in progress is saved to localStorage after every change, so a
 * reload (or QUIT) can CONTINUE it. Finished games are tallied per
 * difficulty.
 */
(function () {
  'use strict';

  var diff = 'normal';
  try { diff = localStorage.getItem('pvrisk.diff') || 'normal'; } catch (e) { /* private mode */ }

  var DIFF_TIPS = {
    easy: 'The computer is cautious and careless with its reinforcements.',
    normal: 'The computer attacks with the odds and chases county bonuses.',
    hard: 'The computer attacks at even odds and goes after your counties.',
  };

  var pressedStart = false;
  var SAVE_KEY = 'pvrisk.save.v1';
  var RECORD_KEY = 'pvrisk.record';

  function store(key, val) {
    try {
      if (val == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { /* private mode or full */ }
  }
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function readSave() {
    var st = load(SAVE_KEY);
    if (!st || !st.territories || st.territories.length !== RV.TERRITORIES.length || st.over != null) return null;
    if (st.players && st.players[1]) st.players[1].name = 'COMPUTER';  // saves from before the rename
    return st;
  }

  function autosave(st) {
    if (!st || st !== RV.UI.state) return;
    store(SAVE_KEY, st.over != null ? null : st);
  }

  function record() {
    var r = load(RECORD_KEY) || {};
    ['easy', 'normal', 'hard'].forEach(function (d) { r[d] = r[d] || { w: 0, l: 0 }; });
    return r;
  }

  // Tally a finished game once; returns that difficulty's record.
  function recordResult(d, won) {
    var st = RV.UI.state, r = record();
    if (st && !st.recorded) {
      st.recorded = true;
      r[d] = r[d] || { w: 0, l: 0 };
      r[d][won ? 'w' : 'l']++;
      store(RECORD_KEY, r);
    }
    store(SAVE_KEY, null);
    return r[d] || { w: 0, l: 0 };
  }

  function diffTip(d) {
    var r = record()[d];
    return DIFF_TIPS[d] + (r.w || r.l ? ' Your record: ' + r.w + 'W – ' + r.l + 'L.' : '');
  }

  function buildMenu() {
    var saved = readSave();
    var menu = document.createElement('div');
    menu.id = 'menu';
    menu.className = 'menu splash' + (pressedStart ? ' picking' : '');
    menu.innerHTML =
      '<div class="splash-bg"></div>' +
      '<div class="splash-frame">' +
      '<img class="splash-art" src="img/splash.jpg" alt="Pioneer Valley Risk">' +
      '<div class="menu-card">' +
        '<div class="diff-row">' +
          ['easy', 'normal', 'hard'].map(function (d) {
            return '<button class="btn diff' + (d === diff ? ' active' : '') +
              '" data-diff="' + d + '" title="' + diffTip(d) + '">' + d.toUpperCase() + '</button>';
          }).join('') +
        '</div>' +
        (saved ? '<button id="menu-continue" class="btn continue" title="Round ' + saved.round + ', ' +
          saved.difficulty.toUpperCase() + '">CONTINUE &#9654;</button>' : '') +
        '<button id="menu-start" class="btn start" title="' + RV.TERRITORIES.length +
          ' towns, 3 counties. Take them all.">' + (saved ? 'NEW GAME' : 'INSERT COIN') + ' &#9654;</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(menu);

    // PRESS START: any click or key on the splash reveals the difficulty picker.
    function pressStart(e) {
      if (menu.classList.contains('picking')) return;
      if (e && e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return;
      if (e) e.preventDefault();
      pressedStart = true;
      menu.classList.add('picking');
      document.removeEventListener('keydown', pressStart);
      RV.Audio.play('select');
      menu.querySelector(saved ? '#menu-continue' : '#menu-start').focus();
    }
    if (!pressedStart) {
      menu.addEventListener('click', pressStart);
      document.addEventListener('keydown', pressStart);
    }

    var diffs = menu.querySelectorAll('.diff');
    for (var i = 0; i < diffs.length; i++) {
      diffs[i].addEventListener('click', function (e) {
        e.stopPropagation();
        diff = this.dataset.diff;
        try { localStorage.setItem('pvrisk.diff', diff); } catch (err) { /* ignore */ }
        for (var j = 0; j < diffs.length; j++) {
          diffs[j].classList.toggle('active', diffs[j] === this);
        }
        RV.Audio.play('click');
      });
    }
    function go(fn) {
      document.removeEventListener('keydown', pressStart);
      pressedStart = true;
      RV.Audio.play('turn');
      RV.Audio.startMusic();
      menu.remove();
      fn();
    }
    menu.querySelector('#menu-start').addEventListener('click', function (e) {
      e.stopPropagation();
      if (!saved) { go(function () { start(diff); }); return; }
      // A new game replaces the saved one: ask first.
      RV.UI.openModal({
        title: 'START A NEW GAME?',
        body: '<div class="move-line">Your saved game (round ' + saved.round + ', ' +
          saved.difficulty.toUpperCase() + ') will be lost.</div>',
        okLabel: 'NEW GAME',
        danger: true,
        onOk: function () { go(function () { start(diff); }); },
      });
    });
    if (saved) {
      menu.querySelector('#menu-continue').addEventListener('click', function (e) {
        e.stopPropagation();
        go(function () { resume(saved); });
      });
    }
    if (pressedStart) menu.querySelector(saved ? '#menu-continue' : '#menu-start').focus();
  }

  function start(d) {
    RV.AITurn.reset();
    RV.Taunts.reset();
    var st = RV.Game.create(d);
    st.log.unshift('The battle for the Pioneer Valley begins! (' + d.toUpperCase() + ')');
    RV.UI.setState(st);
    RV.UI.showHelpFirstTime();
  }

  // Pick a saved game back up where it stopped, mid-computer-turn included.
  function resume(st) {
    RV.AITurn.reset();
    RV.Taunts.reset();
    RV.addLog(st, 'Game resumed.');
    RV.UI.setState(st);
    if (st.turn === 1) RV.AITurn.run();
    else if (st.advance) RV.UI.openAdvanceModal(function () { RV.UI.refresh(); });
    else RV.UI.onHumanTurn();
  }

  function showMenu() {
    RV.AITurn.reset();
    RV.UI.setState(null);
    document.getElementById('log').innerHTML = '';
    if (!document.getElementById('menu')) buildMenu();
  }

  function boot() {
    RV.UI.init();
    showMenu();
  }

  RV.Main = { start: start, resume: resume, showMenu: showMenu, autosave: autosave,
              recordResult: recordResult, readSave: readSave };

  if (typeof document === 'undefined' || !document.getElementById) return; // non-browser (tests)
  // iOS Safari ignores user-scalable=no, so stop pinch-zoom here.
  ['gesturestart', 'gesturechange'].forEach(function (type) {
    document.addEventListener(type, function (e) { e.preventDefault(); }, { passive: false });
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
