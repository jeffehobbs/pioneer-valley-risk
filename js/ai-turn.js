/* Risk: Pioneer Valley — runs the Machine's turn, step by step. */
(function () {
  'use strict';

  var running = false;
  var gen = 0;          // bumped on reset so a stale loop from an old game dies
  var MAX_STEPS = 600;

  function run() {
    var st = RV.UI.state;
    if (!st || st.turn !== 1 || st.over != null) return;
    if (running) return;
    running = true;
    var myGen = gen;
    RV.AI.resetTurn(st);
    RV.UI.setBusy(true);
    var steps = 0;
    setTimeout(step, 500);

    function alive() { return myGen === gen && RV.UI.state === st; }

    function step() {
      if (!alive()) return;
      steps++;
      if (st.over != null) { RV.UI.setBusy(false); RV.UI.showGameOver(st.over); running = false; return; }
      if (steps > MAX_STEPS) { finish(); return; }
      var action = RV.AI.step(st);

      switch (action.type) {
        case 'place':
          RV.Game.placeArmies(st, action.to, action.n);
          RV.UI.addFloat(
            RV.centroid[action.to][0] * 16,
            RV.centroid[action.to][1] * 16 - 8,
            '+' + action.n, '#7dff8a');
          RV.addLog(st, 'The Machine reinforces ' +
            st.territories[action.to].name + ' (+' + action.n + ').');
          RV.Audio.play('move');
          RV.UI.refresh();
          setTimeout(step, 260);
          return;

        case 'attack':
          RV.Combat.doAttack(st, action.from, action.to, function () {
            setTimeout(step, 180);
          }, { fast: true });
          return;

        case 'advance': {
          var adv = st.advance;
          RV.Game.advance(st, action.n);
          if (adv && action.n > 0) {
            RV.addLog(st, 'The Machine advances ' + action.n + ' more into ' +
              st.territories[adv.to].name + '.');
          }
          RV.UI.refresh();
          setTimeout(step, 120);
          return;
        }

        case 'move':
          if (RV.Game.moveArmies(st, action.from, action.to, action.n)) {
            RV.addLog(st, 'The Machine shifts ' + action.n + ' from ' +
              st.territories[action.from].name + ' to ' +
              st.territories[action.to].name + '.');
            RV.UI.addFloat(
              RV.centroid[action.to][0] * 16,
              RV.centroid[action.to][1] * 16 - 8,
              '+' + action.n, st.players[1].color);
            RV.Audio.play('move');
          } else {
            st.fortified = true; // illegal move: don't loop on it
          }
          RV.UI.refresh();
          setTimeout(step, 400);
          return;

        case 'phase':
          if (!RV.Game.setPhase(st, action.phase)) {
            finish();
            return;
          }
          RV.UI.refresh();
          setTimeout(step, 300);
          return;

        case 'end':
        default:
          finish();
      }
    }

    function finish() {
      if (!alive()) return;
      running = false;
      RV.addLog(st, 'The Machine ends its turn.');
      RV.Game.endTurn(st);
      RV.UI.setBusy(false);
      RV.Audio.play('turn');
      RV.UI.refresh();
      if (st.over != null) RV.UI.showGameOver(st.over);
    }
  }

  RV.AITurn = {
    run: run,
    reset: function () { running = false; gen++; },
  };
})();
