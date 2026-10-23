/* Synthesized sound effects (WebAudio, no files, no network) */
'use strict';
(function (G) {
  let ac = null, master = null, noiseBuf = null;
  const A = (G.audio = {});
  A.unlock = function () {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // iOS: play a silent buffer inside the gesture
      const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0);
    }
    if (ac.state === 'suspended') ac.resume();
  };
  const ok = () => ac && !G.save.muted;
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(type, f1, f2, dur, vol, delay) {
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, 0.01, vol, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq, q, type, delay) {
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ac.createGain(); env(g, t, 0.005, vol, dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  A.chomp = function () { if (!ok()) return; noise(0.08, 0.6, 1800, 2); tone('square', 320, 90, 0.09, 0.18); noise(0.06, 0.4, 900, 2, 'bandpass', 0.07); };
  A.miss = function () { if (!ok()) return; noise(0.07, 0.25, 2500, 1.5); };
  A.roar = function (big) {
    if (!ok()) return;
    const t = ac.currentTime, dur = big ? 1.1 : 0.8;
    const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    const base = big ? 70 : 110;
    o.frequency.setValueAtTime(base * 1.6, t); o.frequency.linearRampToValueAtTime(base * 2.2, t + 0.2); o.frequency.exponentialRampToValueAtTime(base * 0.8, t + dur);
    o2.frequency.setValueAtTime(base * 1.63, t); o2.frequency.exponentialRampToValueAtTime(base * 0.7, t + dur);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 28; lg.gain.value = base * 0.5; lfo.connect(lg); lg.connect(o.frequency);
    f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(1500, t + 0.25); f.frequency.exponentialRampToValueAtTime(300, t + dur);
    env(g, t, 0.06, 0.5, dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    [o, o2, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.1); });
    noise(dur * 0.9, 0.25, 500, 0.7, 'lowpass');
  };
  A.jump = function () { if (!ok()) return; tone('sine', 300, 750, 0.18, 0.3); };
  A.flap = function () { if (!ok()) return; noise(0.12, 0.3, 600, 1, 'lowpass'); tone('sine', 400, 900, 0.12, 0.15); };
  A.collect = function () { if (!ok()) return; [660, 880, 1320].forEach((f, i) => tone('triangle', f, f * 1.01, 0.12, 0.25, i * 0.07)); };
  A.coin = function () { if (!ok()) return; tone('square', 990, 1320, 0.08, 0.12); tone('square', 1320, 1600, 0.12, 0.1, 0.06); };
  A.hit = function () { if (!ok()) return; tone('sine', 180, 50, 0.3, 0.6); noise(0.2, 0.4, 300, 0.8, 'lowpass'); };
  A.click = function () { if (!ok()) return; tone('triangle', 700, 500, 0.06, 0.2); };
  A.nope = function () { if (!ok()) return; tone('square', 220, 160, 0.12, 0.12); tone('square', 180, 130, 0.14, 0.12, 0.12); };
  A.grow = function () { if (!ok()) return; [392, 523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.16, 0.25, i * 0.09)); };
  A.fanfare = function () {
    if (!ok()) return;
    [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.52], [1047, 0.64]].forEach(([f, d]) => { tone('square', f, f, 0.18, 0.12, d); tone('triangle', f / 2, f / 2, 0.2, 0.2, d); });
  };
  A.splash = function () { if (!ok()) return; noise(0.25, 0.3, 1200, 0.6, 'highpass'); };
  A.boom = function () { if (!ok()) return; noise(0.5, 0.5, 200, 0.6, 'lowpass'); tone('sine', 90, 40, 0.4, 0.4); };
})(window.G);
