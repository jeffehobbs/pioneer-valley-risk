/* Risk: Pioneer Valley — tiny WebAudio chip-tune synth. No assets needed. */
(function () {
  'use strict';

  var ctx = null;
  var enabled = true;

  function ac() {
    if (!enabled) return null;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // tone(freq, dur, opts): type, vol, slideTo, delay
  function tone(freq, dur, opts) {
    var c = ac();
    if (!c) return;
    opts = opts || {};
    var t0 = c.currentTime + (opts.delay || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(30, opts.slideTo), t0 + dur);
    }
    var v = opts.vol != null ? opts.vol : 0.08;
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // noise burst (for explosions)
  function noise(dur, opts) {
    var c = ac();
    if (!c) return;
    opts = opts || {};
    var t0 = c.currentTime + (opts.delay || 0);
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    src.buffer = buf;
    var g = c.createGain();
    var v = opts.vol != null ? opts.vol : 0.12;
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    var f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = opts.cutoff || 900;
    src.connect(f);
    f.connect(g);
    g.connect(c.destination);
    src.start(t0);
  }

  var SFX = {
    click:   function () { tone(880, 0.05, { vol: 0.05 }); },
    hover:   function () { tone(520, 0.03, { vol: 0.025, type: 'triangle' }); },
    select:  function () { tone(660, 0.06, { vol: 0.06 }); tone(990, 0.06, { vol: 0.05, delay: 0.06 }); },
    move:    function () { tone(440, 0.05, { vol: 0.05 }); tone(660, 0.05, { vol: 0.05, delay: 0.05 }); },
    dice:    function () {
      for (var i = 0; i < 5; i++) {
        tone(300 + Math.random() * 500, 0.04,
             { vol: 0.05, delay: i * 0.07, type: 'square' });
      }
    },
    hit:     function () { noise(0.22, { vol: 0.16, cutoff: 700 }); tone(120, 0.18, { vol: 0.1, slideTo: 50, type: 'triangle' }); },
    lose:    function () { tone(300, 0.12, { vol: 0.07, slideTo: 150 }); },
    capture: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone(f, 0.09, { vol: 0.07, delay: i * 0.07 });
      });
    },
    phase:   function () { tone(587, 0.08, { vol: 0.06 }); tone(880, 0.1, { vol: 0.06, delay: 0.09 }); },
    turn:    function () { tone(440, 0.09, { vol: 0.07 }); tone(660, 0.09, { vol: 0.07, delay: 0.1 }); tone(880, 0.12, { vol: 0.07, delay: 0.2 }); },
    win:     function () {
      var seq = [523, 659, 784, 1047, 784, 1047, 1319];
      seq.forEach(function (f, i) {
        tone(f, i === seq.length - 1 ? 0.4 : 0.14, { vol: 0.08, delay: i * 0.15 });
      });
    },
    loseAll: function () {
      [392, 330, 262, 196].forEach(function (f, i) {
        tone(f, 0.25, { vol: 0.08, delay: i * 0.22, type: 'triangle' });
      });
    },
  };

  RV.Audio = {
    play: function (name) { if (enabled && SFX[name]) SFX[name](); },
    toggle: function () { enabled = !enabled; return enabled; },
    isOn: function () { return enabled; },
  };
})();
