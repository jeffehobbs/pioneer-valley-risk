/* Risk: Pioneer Valley — tiny WebAudio chip-tune synth: sound effects and
 * a looping chip-tune march. No assets needed. */
(function () {
  'use strict';

  var ctx = null;
  var enabled = pref('pvrisk.sound', true);
  var musicOn = pref('pvrisk.music', true);
  var musicGain = null;      // music bus, so muting cuts notes already queued
  var MUSIC_VOL = 0.2;    // sits under the sound effects

  function pref(key, dflt) {
    try { var v = localStorage.getItem(key); return v == null ? dflt : v === '1'; }
    catch (e) { return dflt; }
  }
  function savePref(key, on) {
    try { localStorage.setItem(key, on ? '1' : '0'); } catch (e) { /* private mode */ }
  }

  function ac() {
    if (!enabled) return null;
    return context();
  }

  // The shared context, whether or not sound effects are on.
  function context() {
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
    // a town falls: low boom under the fanfare
    boom:    function () { noise(0.5, { vol: 0.22, cutoff: 400 }); tone(90, 0.45, { vol: 0.14, slideTo: 35, type: 'triangle' }); },
    card:    function () { tone(1047, 0.06, { vol: 0.05, type: 'triangle' }); tone(1319, 0.1, { vol: 0.05, type: 'triangle', delay: 0.07 }); },
    trade:   function () {
      [659, 784, 988, 1319].forEach(function (f, i) { tone(f, 0.07, { vol: 0.06, delay: i * 0.05, type: 'square' }); });
    },
    taunt:   function () { tone(220, 0.07, { vol: 0.05 }); tone(196, 0.07, { vol: 0.05, delay: 0.08 }); tone(165, 0.12, { vol: 0.05, delay: 0.16 }); },
    undo:    function () { tone(660, 0.05, { vol: 0.05 }); tone(440, 0.06, { vol: 0.05, delay: 0.05 }); },
  };

  // ------------------------------------------------------------- music
  // A short chip-tune march in A minor: square lead, triangle bass, noise
  // hats and a kick. 8 bars at 132 BPM (about 15 s), looped. Notes are
  // scheduled a little ahead of the clock so timers never cause a hiccup.
  // Lead bars are 8 eighth notes: a note, '-' to hold the last one, '.' rest.
  var BPM = 132;
  var LEAD = [
    'A4 . C5 E5 A5 - G5 E5',   // Am
    'F5 - E5 C5 A4 - C5 .',    // F
    'G4 . C5 E5 G5 - E5 C5',   // C
    'D5 - B4 G4 D5 - . .',     // G
    'A5 - G5 E5 C5 - E5 A5',   // Am
    'A5 - G5 F5 E5 - C5 .',    // F
    'D5 - G5 - B5 - D6 -',     // G
    'E5 . G#5 B5 E6 - - .',    // E: turn back to the top
  ];
  var ROOTS = ['A2', 'F2', 'C3', 'G2', 'A2', 'F2', 'G2', 'E2'];

  function midi(name) {
    var m = /^([A-G])(#?)(\d)$/.exec(name);
    var semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
    return 12 * (Number(m[3]) + 1) + semis;
  }
  function hz(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  // Flatten the score into events: {step (in 16ths), len (16ths), voice, note}
  var SCORE = (function () {
    var ev = [];
    LEAD.forEach(function (bar, b) {
      var toks = bar.split(/\s+/), last = null;
      toks.forEach(function (t, k) {
        var step = b * 16 + k * 2;
        if (t === '-') { if (last) last.len += 2; return; }
        if (t === '.') { last = null; return; }
        last = { step: step, len: 2, voice: 'lead', note: midi(t) };
        ev.push(last);
      });
      var root = midi(ROOTS[b]);
      for (var e = 0; e < 8; e++) {   // octave-bouncing eighth-note bass
        ev.push({ step: b * 16 + e * 2, len: 2, voice: 'bass', note: root + (e % 2 ? 12 : 0) });
      }
      for (var q = 0; q < 4; q++) ev.push({ step: b * 16 + q * 4, len: 1, voice: 'kick' });
      for (var h = 0; h < 8; h++) ev.push({ step: b * 16 + h * 2 + 1, len: 1, voice: 'hat' });
      // a little arpeggio sparkle on the off-beats of every other bar
      if (b % 2 === 1) {
        [0, 4, 7, 12].forEach(function (iv, k) {
          ev.push({ step: b * 16 + 8 + k * 2, len: 1, voice: 'arp', note: root + 24 + iv });
        });
      }
    });
    return ev.sort(function (a, b) { return a.step - b.step; });
  })();
  var LOOP_STEPS = LEAD.length * 16;
  var STEP = 60 / BPM / 4;            // one 16th note, in seconds

  var timer = null, loopStart = 0, nextIdx = 0, loopN = 0;

  function voice(ev, t) {
    var c = ctx, dur = ev.len * STEP;
    if (ev.voice === 'hat' || ev.voice === 'kick') {
      if (ev.voice === 'kick') {
        var ko = c.createOscillator(), kg = c.createGain();
        ko.type = 'sine';
        ko.frequency.setValueAtTime(150, t);
        ko.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        kg.gain.setValueAtTime(0.32, t);
        kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        ko.connect(kg); kg.connect(musicGain);
        ko.start(t); ko.stop(t + 0.16);
        return;
      }
      var len = Math.floor(c.sampleRate * 0.04);
      var buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = c.createBufferSource(), hf = c.createBiquadFilter(), hg = c.createGain();
      src.buffer = buf;
      hf.type = 'highpass'; hf.frequency.value = 6000;
      hg.gain.setValueAtTime(0.06, t);
      hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(hf); hf.connect(hg); hg.connect(musicGain);
      src.start(t);
      return;
    }
    var o = c.createOscillator(), g = c.createGain();
    var vol = { lead: 0.07, bass: 0.13, arp: 0.035 }[ev.voice];
    o.type = ev.voice === 'bass' ? 'triangle' : 'square';
    o.frequency.setValueAtTime(hz(ev.note), t);
    if (ev.voice === 'lead' && dur > STEP * 3) {   // a touch of vibrato on held notes
      var lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 6; lg.gain.value = hz(ev.note) * 0.01;
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t + 0.08); lfo.stop(t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setValueAtTime(vol * 0.8, t + Math.min(dur * 0.6, dur - 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + dur);
  }

  function schedule() {
    var horizon = ctx.currentTime + 0.2;
    for (;;) {
      var ev = SCORE[nextIdx];
      var t = loopStart + loopN * LOOP_STEPS * STEP + ev.step * STEP;
      if (t > horizon) break;
      if (t >= ctx.currentTime - 0.01) voice(ev, t);
      if (++nextIdx >= SCORE.length) { nextIdx = 0; loopN++; }
    }
  }

  // Browsers only allow audio after a user gesture, so this is called from
  // a click (INSERT COIN / CONTINUE / the MUSIC button).
  function startMusic() {
    if (!musicOn || timer || (typeof document !== 'undefined' && document.hidden)) return;
    var c = context();
    if (!c) return;
    if (!musicGain) {
      musicGain = c.createGain();
      musicGain.connect(c.destination);
    }
    musicGain.gain.cancelScheduledValues(c.currentTime);
    musicGain.gain.setValueAtTime(MUSIC_VOL, c.currentTime);
    loopStart = c.currentTime + 0.1;
    nextIdx = 0;
    loopN = 0;
    schedule();
    timer = setInterval(schedule, 50);
  }

  function stopMusic() {
    if (timer) { clearInterval(timer); timer = null; }
    if (musicGain && ctx) {
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.setValueAtTime(0, ctx.currentTime);   // silence notes already queued
    }
  }

  // Background tabs throttle timers; stop rather than stutter, resume on return.
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopMusic();
      else if (musicOn && musicGain) startMusic();
    });
  }

  RV.Audio = {
    play: function (name) { if (enabled && SFX[name]) SFX[name](); },
    toggle: function () { enabled = !enabled; savePref('pvrisk.sound', enabled); return enabled; },
    isOn: function () { return enabled; },
    startMusic: startMusic,
    toggleMusic: function () {
      musicOn = !musicOn;
      savePref('pvrisk.music', musicOn);
      if (musicOn) startMusic(); else stopMusic();
      return musicOn;
    },
    musicOn: function () { return musicOn; },
    musicPlaying: function () { return !!timer; },
    _score: function () { return { events: SCORE.length, seconds: LOOP_STEPS * STEP }; },
  };
})();
