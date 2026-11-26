/* Pioneer Valley Risk — runs the computer's turn, step by step.
 *
 * Every roll gets its own dice. skip() (a click or Space during its turn)
 * finishes the turn with no animation at all.
 */
(function () {
  'use strict';

  var running = false;
  var skipping = false;
  var gen = 0;          // bumped on reset so a stale loop from an old game dies
  var MAX_STEPS = 600;

  function wait(ms) { return skipping ? 0 : ms; }

  function run() {
    var st = RV.UI.state;
    if (!st || st.turn !== 1 || st.over != null) return;
    if (running) return;
    running = true;
    skipping = false;
    var myGen = gen;
    RV.AI.resetTurn(st);
    RV.UI.setBusy(true);
    RV.UI.refresh();
    var steps = 0;
    setTimeout(step, wait(500));

    function alive() { return myGen === gen && RV.UI.state === st; }
    function next(ms) { setTimeout(step, wait(ms)); }

    function step() {
      if (!alive()) return;
      steps++;
      if (st.over != null) { RV.UI.setBusy(false); RV.UI.showGameOver(st.over); running = false; return; }
      if (steps > MAX_STEPS) { finish(); return; }
      var action = RV.AI.step(st);

      switch (action.type) {
        case 'place':
          RV.Game.placeArmies(st, action.to, action.n);
          floatAt(action.to, '+' + action.n, '#7dff8a');
          RV.addLog(st, 'The computer reinforces ' +
            st.territories[action.to].name + ' (+' + action.n + ').');
          if (!skipping) RV.Audio.play('move');
          RV.UI.refresh();
          next(260);
          return;

        case 'attack':
          RV.Combat.doAttack(st, action.from, action.to, function () { next(180); }, { fast: true });
          return;

        case 'advance': {
          var adv = st.advance;
          RV.Game.advance(st, action.n);
          if (adv && action.n > 0) {
            RV.addLog(st, 'The computer advances ' + action.n + ' more into ' +
              st.territories[adv.to].name + '.');
          }
          RV.UI.refresh();
          next(120);
          return;
        }

        case 'move':
          if (RV.Game.moveArmies(st, action.from, action.to, action.n)) {
            RV.addLog(st, 'The computer shifts ' + action.n + ' from ' +
              st.territories[action.from].name + ' to ' +
              st.territories[action.to].name + '.');
            floatAt(action.to, '+' + action.n, st.players[1].color);
            if (!skipping) RV.Audio.play('move');
          } else {
            st.fortified = true; // illegal move: don't loop on it
          }
          RV.UI.refresh();
          next(400);
          return;

        case 'phase':
          if (!RV.Game.setPhase(st, action.phase)) {
            finish();
            return;
          }
          RV.UI.refresh();
          next(300);
          return;

        case 'end':
        default:
          finish();
      }
    }

    function floatAt(i, text, color) {
      RV.UI.addFloat(RV.centroid[i][0] * 16, RV.centroid[i][1] * 16 - 8, text, color);
    }

    function finish() {
      if (!alive()) return;
      running = false;
      skipping = false;
      RV.addLog(st, 'The computer ends its turn.');
      RV.Game.endTurn(st);
      RV.UI.setBusy(false);
      RV.Audio.play('turn');
      RV.UI.refresh();
      if (st.over != null) RV.UI.showGameOver(st.over);
      else RV.UI.onHumanTurn();
    }
  }

  RV.AITurn = {
    run: run,
    reset: function () { running = false; skipping = false; gen++; },
    running: function () { return running; },
    skipping: function () { return skipping; },
    skip: function () { if (running) skipping = true; },
  };
})();
