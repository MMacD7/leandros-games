// Synthesized sounds with WebAudio. No audio files, nothing downloaded.
let lastBoom = 0, ctx = null, master = null, muted = false, noiseBuf = null, ambient = null, musicBus = null, comp = null, onReady = null;
const now = () => ctx.currentTime;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7;
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  // music has its own bus (separate on/off from sound effects) that ducks under explosions and roars
  musicBus = ctx.createGain(); musicBus.gain.value = 1; musicBus.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startAmbient();
  if (onReady) onReady(ctx);
}
export const audioCtx = () => ctx;
export const getMusicBus = () => musicBus;
export const getNoise = () => noiseBuf;
export function onAudioReady(fn) { onReady = fn; if (ctx) fn(ctx); }
let duckUntil = 0;
export function duck(amount = 0.6, dur = 1) { if (!ctx || !musicBus) return; const t = now(), g = musicBus.gain; g.cancelScheduledValues(t); g.setTargetAtTime(Math.max(0.15, 1 - amount), t, 0.03);
  duckUntil = Math.max(duckUntil, t + dur); g.setTargetAtTime(1, duckUntil, 0.35); }
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.7, now(), 0.05); }
export function isMuted() { return muted; }

function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function noise(t, dur, type, f0, f1, peak, q = 1) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 1;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); env(g, t, 0.005, peak, dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.1);
}
function tone(t, type, f0, f1, dur, peak, a = 0.005) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = ctx.createGain(); env(g, t, a, peak, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + a + dur + 0.05);
  return o;
}
let lastLaser = 0;
// Ricky & Bobby: a yappy terrier bark (two quick 'ruff's) and a stadium crowd cheer
function bark(t, p, v) { tone(t, 'sawtooth', 820 * p, 380 * p, 0.09, 0.22 * v, 0.004); tone(t, 'square', 560 * p, 260 * p, 0.1, 0.12 * v, 0.004); noise(t, 0.08, 'bandpass', 1500 * p, 700 * p, 0.25 * v, 2); }
function cheer(t, v) { noise(t, 2.6, 'bandpass', 900, 1400, 0.38 * v, 0.6); noise(t + 0.1, 2.4, 'bandpass', 2400, 1800, 0.18 * v, 0.8);
  for (let i = 0; i < 9; i++) { const s = t + 0.1 + Math.random() * 1.6, f = 380 + Math.random() * 420; const o = tone(s, 'triangle', f, f * (1.3 + Math.random() * 0.4), 0.45, 0.04 * v, 0.06); o.detune.value = (Math.random() - 0.5) * 40; }
  for (let i = 0; i < 14; i++) noise(t + 0.3 + Math.random() * 1.8, 0.03, 'highpass', 2500, 2400, 0.1 * v, 1); }
export const sfx = {
  bark(p = 1, v = 1) { if (!ctx) return; const t = now(); bark(t, p, v); bark(t + 0.17, p * 1.06, v * 0.85); },
  cheer(v = 1) { if (!ctx) return; cheer(now(), v); duck(0.35, 2.4); },
  laser(vol = 1) { if (!ctx) return; const t = now(); if (t - lastLaser < 0.05) return; lastLaser = t;
    tone(t, 'sawtooth', 1600 + Math.random() * 200, 220, 0.16, 0.12 * vol); tone(t, 'square', 900, 120, 0.12, 0.05 * vol); },
  missile() { if (!ctx) return; const t = now(); noise(t, 0.7, 'bandpass', 600, 2400, 0.35, 2); tone(t, 'sawtooth', 90, 50, 0.5, 0.12); },
  // explosion: sharp crack + mid crunch + long sub-bass thump + crackling tail
  boom(vol = 1) { if (!ctx || vol < 0.03) return; const t = now(); if (t - lastBoom < 0.06) return; lastBoom = t; vol = Math.min(1.6, vol);
    noise(t, 0.12, 'highpass', 3000, 1200, 0.5 * vol, 0.7);
    noise(t, 1.1, 'lowpass', 2600, 70, 0.9 * vol, 0.7);
    tone(t, 'sine', 95, 26, 1.4, 0.95 * vol, 0.004); tone(t, 'triangle', 160, 40, 0.5, 0.35 * vol);
    for (let i = 0; i < 6; i++) noise(t + 0.25 + Math.random() * 0.9, 0.06, 'bandpass', 2500 + Math.random() * 2000, 1500, 0.12 * vol, 3);
    duck(0.55 * Math.min(1, vol), 0.7 + 0.4 * vol); },
  bigBoom(vol = 1) { if (!ctx) return; const t = now(); this.boom(vol); tone(t + 0.02, 'sine', 55, 22, 2.2, 0.8 * vol, 0.01); noise(t + 0.1, 2.4, 'lowpass', 600, 40, 0.5 * vol, 0.5); duck(0.75, 2); },
  flame(v = 1) { if (!ctx) return; const t = now(); noise(t, 0.2, 'bandpass', 700, 1200, 0.22 * v, 0.6); noise(t, 0.16, 'highpass', 4000, 6000, 0.05 * v, 1); },
  ignite() { if (!ctx) return; const t = now(); noise(t, 0.5, 'bandpass', 500, 2400, 0.3, 0.8); tone(t, 'sine', 120, 60, 0.3, 0.2); },
  rumble(dur = 4, v = 1) { if (!ctx) return; const t = now(); noise(t, dur, 'lowpass', 220, 60, 0.55 * v, 0.6); tone(t, 'sine', 40, 28, dur, 0.5 * v, 0.6); duck(0.4, dur * 0.6); },
  whistle(v = 1) { if (!ctx) return; const t = now(); tone(t, 'sine', 1500 + Math.random() * 300, 380, 1.3, 0.05 * v, 0.2); },
  jet() { if (!ctx) return; const t = now(); noise(t, 2.2, 'bandpass', 300, 2500, 0.35, 1.2); tone(t, 'sawtooth', 120, 60, 2, 0.05, 0.4); },
  power() { if (!ctx) return; const t = now(); [392, 523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.05, 'square', f, f, 0.18, 0.08)); tone(t, 'sawtooth', 200, 1600, 0.5, 0.08, 0.05); },
  banner(lvl = 1) { if (!ctx) return; const t = now(); const b = [262, 330, 392, 523][Math.min(3, lvl - 1)] || 262; [1, 1.26, 1.5, 2].forEach((m, i) => tone(t + i * 0.06, 'sawtooth', b * m, b * m, 0.25, 0.07)); noise(t, 0.6, 'highpass', 5000, 9000, 0.12, 0.5); },
  hit() { if (!ctx) return; const t = now(); noise(t, 0.12, 'bandpass', 3200, 1800, 0.25, 6); tone(t, 'triangle', 700, 500, 0.1, 0.06); },
  stomp() { if (!ctx) return; const t = now(); tone(t, 'sine', 80, 28, 0.45, 0.9); noise(t, 0.35, 'lowpass', 600, 60, 0.5); },
  step(vol = 0.25) { if (!ctx) return; const t = now(); tone(t, 'sine', 60, 35, 0.15, vol); noise(t, 0.08, 'bandpass', 1800, 900, vol * 0.25, 4); },
  bite(s = 1) { if (!ctx) return; const t = now(); noise(t, 0.12, 'bandpass', 900 / s, 2600 / s, 0.3, 1.5); tone(t + 0.04, 'square', 260 / s, 80 / s, 0.12, 0.12); },
  chomp(s = 1) { if (!ctx) return; const t = now(); noise(t, 0.08, 'highpass', 1500, 3000, 0.4); tone(t, 'sine', 140 / s, 40, 0.22, 0.6); noise(t + 0.02, 0.25, 'lowpass', 900, 120, 0.45, 0.8); },
  whoosh(v = 1) { if (!ctx) return; const t = now(); noise(t, 0.45, 'bandpass', 300, 1800 * v, 0.3, 1.2); },
  slam() { if (!ctx) return; const t = now(); tone(t, 'sine', 70, 25, 0.7, 0.9); noise(t, 0.6, 'lowpass', 1200, 60, 0.6, 0.7); tone(t, 'triangle', 220, 50, 0.3, 0.2); },
  // big dramatic roar: growling sub layer + roaring formant noise + snarl overtones (robots get a metallic ring-mod layer)
  bigRoar(pitch = 1, vol = 1, robotic = false) { if (!ctx || vol <= 0.02) return; const t = now(), D = 1.5 + 0.4 / pitch; if (vol > 0.4) duck(0.5, D * 0.8);
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.9 * vol, t + 0.12); out.gain.setValueAtTime(0.9 * vol, t + D * 0.6); out.gain.exponentialRampToValueAtTime(0.0001, t + D); out.connect(master);
    const ws = ctx.createWaveShaper(); const c = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 256 - 1; c[i] = Math.tanh(x * 6); } ws.curve = c;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 2; f1.frequency.setValueAtTime(520 * pitch, t); f1.frequency.linearRampToValueAtTime(900 * pitch, t + 0.35); f1.frequency.linearRampToValueAtTime(380 * pitch, t + D);
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 2400 * pitch;
    ws.connect(f1); f1.connect(f2); f2.connect(out);
    for (const [base, g0, type] of [[62, 0.8, 'sawtooth'], [93, 0.5, 'sawtooth'], [131, 0.3, 'square']]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(base * pitch * 1.3, t); o.frequency.linearRampToValueAtTime(base * pitch * 1.6, t + 0.3); o.frequency.linearRampToValueAtTime(base * pitch * 0.9, t + D);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 22 + Math.random() * 10; const lg = ctx.createGain(); lg.gain.value = base * 0.25 * pitch; lfo.connect(lg); lg.connect(o.frequency);
      const g = ctx.createGain(); g.gain.value = g0; o.connect(g); g.connect(ws); o.start(t); lfo.start(t); o.stop(t + D + 0.1); lfo.stop(t + D + 0.1); }
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.setValueAtTime(48 * pitch, t); sub.frequency.linearRampToValueAtTime(34 * pitch, t + D); const sg = ctx.createGain(); sg.gain.value = 0.7; sub.connect(sg); sg.connect(out); sub.start(t); sub.stop(t + D + 0.1);
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuf; const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.Q.value = 1.2; nf.frequency.setValueAtTime(700 * pitch, t); nf.frequency.linearRampToValueAtTime(1500 * pitch, t + 0.4); nf.frequency.linearRampToValueAtTime(500 * pitch, t + D);
    const ng = ctx.createGain(); ng.gain.value = 0.35; ns.connect(nf); nf.connect(ng); ng.connect(out); ns.start(t, Math.random()); ns.stop(t + D + 0.1);
    if (robotic) { const rm = ctx.createOscillator(); rm.type = 'square'; rm.frequency.value = 55 * pitch; const rg = ctx.createGain(); rg.gain.value = 0; const amp = ctx.createGain(); amp.gain.value = 0.5; rm.connect(amp); amp.connect(rg.gain); f2.connect(rg); rg.connect(out); rm.start(t); rm.stop(t + D + 0.1);
      tone(t, 'sawtooth', 1800 * pitch, 400, 0.5, 0.06 * vol); }
  },
  roar(pitch = 1) { if (!ctx) return; const t = now();
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(140 * pitch, t); o.frequency.linearRampToValueAtTime(95 * pitch, t + 0.9);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 28; const lg = ctx.createGain(); lg.gain.value = 18 * pitch; lfo.connect(lg); lg.connect(o.frequency);
    const ws = ctx.createWaveShaper(); const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 4); } ws.curve = c;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(380, t + 1); f.Q.value = 1.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.08); g.gain.setValueAtTime(0.5, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(ws); ws.connect(f); f.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + 1.2); lfo.stop(t + 1.2);
    noise(t, 1.0, 'bandpass', 900, 400, 0.18, 1.2); },
  pickup() { if (!ctx) return; const t = now(); tone(t, 'triangle', 880, 880, 0.08, 0.15); tone(t + 0.07, 'triangle', 1320, 1320, 0.12, 0.15); },
  core() { if (!ctx) return; const t = now(); [660, 880, 1100, 1320].forEach((f, i) => tone(t + i * 0.06, 'sine', f, f * 1.01, 0.2, 0.15)); },
  ko(real) { if (!ctx) return; const t = now(); if (real) { tone(t, 'sawtooth', 220, 50, 1.0, 0.25); noise(t, 0.8, 'bandpass', 600, 150, 0.35, 1.5); tone(t + 0.6, 'sine', 60, 30, 0.5, 0.6); }
    else { tone(t, 'sawtooth', 500, 60, 0.9, 0.2); noise(t, 0.6, 'bandpass', 3000, 300, 0.3, 3); } },
  ui() { if (!ctx) return; const t = now(); tone(t, 'sine', 600, 900, 0.07, 0.12); },
  deny() { if (!ctx) return; const t = now(); tone(t, 'square', 200, 150, 0.15, 0.08); },
  unlock() { if (!ctx) return; const t = now(); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.09, 'triangle', f, f, 0.3, 0.18)); },
  boost() { if (!ctx) return; const t = now(); noise(t, 0.5, 'bandpass', 400, 1600, 0.25, 1.5); },
  beam() { if (!ctx) return; const t = now(); tone(t, 'sine', 300, 1800, 0.6, 0.15, 0.05); },
  // v4: dragons + new dinos
  zap(v = 1) { if (!ctx || v < 0.03) return; const t = now(); noise(t, 0.18, 'highpass', 2500, 6000, 0.35 * v, 0.8); tone(t, 'sawtooth', 2400 + Math.random() * 800, 200, 0.14, 0.08 * v); noise(t + 0.02, 0.3, 'bandpass', 900, 300, 0.25 * v, 2); },
  thunder(v = 1, delay = 0) { if (!ctx || v < 0.03) return; const t = now() + delay; noise(t, 0.25, 'highpass', 3000, 900, 0.3 * v, 0.7); noise(t + 0.05, 2.6, 'lowpass', 900, 60, 0.75 * v, 0.6); tone(t + 0.05, 'sine', 70, 28, 2.2, 0.55 * v, 0.05);
    for (let i = 0; i < 4; i++) noise(t + 0.3 + Math.random() * 1.2, 0.5, 'lowpass', 500, 80, 0.3 * v, 0.8); },
  freeze() { if (!ctx) return; const t = now(); for (let i = 0; i < 5; i++) tone(t + i * 0.04, 'triangle', 2400 + i * 400, 3200 + i * 300, 0.12, 0.06); noise(t, 0.4, 'highpass', 5000, 9000, 0.18, 1); },
  frost(v = 1) { if (!ctx) return; const t = now(); noise(t, 0.2, 'highpass', 3500, 6500, 0.18 * v, 0.7); noise(t, 0.2, 'bandpass', 900, 1500, 0.1 * v, 0.8); },
  spit() { if (!ctx) return; const t = now(); noise(t, 0.18, 'bandpass', 1800, 600, 0.35, 2); tone(t, 'sine', 500, 160, 0.15, 0.15); },
  splat() { if (!ctx) return; const t = now(); noise(t, 0.25, 'lowpass', 1200, 200, 0.4, 1.5); tone(t, 'sine', 180, 60, 0.2, 0.2); },
  honk() { if (!ctx) return; const t = now(); for (const [f, g] of [[110, 0.35], [165, 0.22], [220, 0.12]]) { const o = tone(t, 'sawtooth', f, f * 0.92, 1.1, g, 0.06); o.detune.value = Math.random() * 10; } noise(t, 1.0, 'bandpass', 600, 300, 0.15, 2); duck(0.5, 1); },
  flap(v = 1) { if (!ctx || v < 0.03) return; const t = now(); noise(t, 0.35, 'lowpass', 500, 120, 0.4 * v, 0.9); tone(t, 'sine', 60, 35, 0.3, 0.2 * v); },
  rage() { if (!ctx) return; const t = now(); noise(t, 0.6, 'bandpass', 400, 1400, 0.3, 1.2); tone(t, 'sawtooth', 90, 180, 0.6, 0.12); },
  headbutt() { if (!ctx) return; const t = now(); tone(t, 'square', 300, 90, 0.18, 0.25); noise(t, 0.15, 'bandpass', 2500, 900, 0.4, 3); tone(t, 'sine', 90, 40, 0.4, 0.6); },
};

function startAmbient() {
  // gentle surf/wind bed + occasional synth bird chirps
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
  const g = ctx.createGain(); g.gain.value = 0.05;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12; const lg = ctx.createGain(); lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain);
  s.connect(f); f.connect(g); g.connect(master); s.start(); lfo.start();
  ambient = setInterval(() => {
    if (!ctx || muted || document.hidden) return;
    if (Math.random() < 0.5) { const t = now(), b = 2000 + Math.random() * 1500; for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) tone(t + i * 0.12, 'sine', b, b * 1.3, 0.08, 0.025); }
  }, 2500);
}
