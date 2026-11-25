/* Risk: Pioneer Valley — title screen and boot. */
(function () {
  'use strict';

  var diff = 'normal';
  try { diff = localStorage.getItem('pvrisk.diff') || 'normal'; } catch (e) { /* private mode */ }

  var DIFF_TIPS = {
    easy: 'The Machine is cautious and careless with its reinforcements.',
    normal: 'The Machine attacks with the odds and chases county bonuses.',
    hard: 'The Machine attacks at even odds and goes after your counties.',
  };

  var pressedStart = false;

  function buildMenu() {
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
              '" data-diff="' + d + '" title="' + DIFF_TIPS[d] + '">' + d.toUpperCase() + '</button>';
          }).join('') +
        '</div>' +
        '<button id="menu-start" class="btn start" title="' + RV.TERRITORIES.length +
          ' towns, 3 counties. Take them all.">INSERT COIN &#9654;</button>' +
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
      menu.querySelector('#menu-start').focus();
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
    menu.querySelector('#menu-start').addEventListener('click', function (e) {
      e.stopPropagation();
      document.removeEventListener('keydown', pressStart);
      pressedStart = true;
      RV.Audio.play('turn');
      menu.remove();
      start(diff);
    });
    if (pressedStart) menu.querySelector('#menu-start').focus();
  }

  function start(d) {
    RV.AITurn.reset();
    var st = RV.Game.create(d);
    st.log.unshift('The battle for the Pioneer Valley begins! (' + d.toUpperCase() + ')');
    RV.UI.setState(st);
  }

  function showMenu() {
    RV.AITurn.reset();
    RV.UI.setState(null);
    document.getElementById('log').innerHTML = '';
    if (!document.getElementById('menu')) buildMenu();
  }

  function paintLogo() {
    var cv = document.getElementById('logo-canvas');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(RV.paintSprite(RV.SPR.star, 1), 0, 0);
  }

  function boot() {
    paintLogo();
    RV.UI.init();
    showMenu();
  }

  RV.Main = { start: start, showMenu: showMenu };

  if (typeof document === 'undefined' || !document.getElementById) return; // non-browser (tests)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
