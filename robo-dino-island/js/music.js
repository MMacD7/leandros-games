// Procedural soundtrack, synthesized live with Web Audio (no audio files, nothing downloaded).
// A look-ahead step sequencer schedules drums, bass, brass, plucks and pads. Each mood is a loop of 4 bars of 16 steps,
// so tracks loop seamlessly; switching tracks crossfades on the next step. Music has its own bus that ducks under booms.
import { audioCtx, getMusicBus, getNoise, onAudioReady } from './audio.js';

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
let stingEnd = 0, ctx = null, out = null, enabled = true, cur = null, want = null, step = 0, nextT = 0, timer = null, shaper = null, vol = 0.34;

// ---------- instruments (each schedules a short voice at time t into the given bus) ----------
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function osc(bus, t, type, f0, f1, a, peak, d, filt) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + a + d);
  env(g, t, a, peak, d); let n = o; if (filt) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(filt[0], t); f.frequency.exponentialRampToValueAtTime(filt[1], t + a + d); f.Q.value = filt[2] || 1; o.connect(f); n = f; }
  n.connect(g); g.connect(bus); o.start(t); o.stop(t + a + d + 0.05); return o;
}
function nz(bus, t, type, f, q, a, peak, d) {
  const s = ctx.createBufferSource(); s.buffer = getNoise(); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(); env(g, t, a, peak, d); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random() * 1.5); s.stop(t + a + d + 0.05);
}
const I = {
  kick: (b, t, v = 1) => { osc(b, t, 'sine', 150, 42, 0.002, 0.9 * v, 0.32); nz(b, t, 'highpass', 3000, 1, 0.001, 0.12 * v, 0.02); },
  snare: (b, t, v = 1) => { nz(b, t, 'bandpass', 1900, 0.8, 0.001, 0.5 * v, 0.16); osc(b, t, 'triangle', 220, 160, 0.001, 0.25 * v, 0.08); },
  hat: (b, t, v = 1, open) => nz(b, t, 'highpass', 8000, 1, 0.001, 0.14 * v, open ? 0.22 : 0.035),
  crash: (b, t, v = 1) => nz(b, t, 'highpass', 5500, 0.6, 0.002, 0.28 * v, 1.6),
  taiko: (b, t, v = 1, f = 70) => { osc(b, t, 'sine', f * 1.6, f * 0.75, 0.003, 1.0 * v, 0.7); nz(b, t, 'lowpass', 380, 1, 0.002, 0.5 * v, 0.25); },
  tom: (b, t, v = 1, f = 180) => osc(b, t, 'triangle', f * 1.3, f * 0.8, 0.002, 0.5 * v, 0.2),
  conga: (b, t, v = 1, f = 330) => { osc(b, t, 'sine', f * 1.2, f, 0.002, 0.35 * v, 0.12); nz(b, t, 'bandpass', f * 4, 3, 0.001, 0.06 * v, 0.03); },
  shaker: (b, t, v = 1) => nz(b, t, 'highpass', 6500, 1.5, 0.01, 0.07 * v, 0.05),
  bass: (b, t, m, d, v = 1, dist) => { const o1 = osc(dist ? shaper : b, t, 'sawtooth', mtof(m), mtof(m), 0.005, 0.32 * v, d, [1400, 160, 4]); osc(b, t, 'sine', mtof(m - 12), mtof(m - 12), 0.005, 0.4 * v, d); },
  brass: (b, t, ms, d, v = 1) => { for (const m of ms) for (const det of [-6, 7]) { const o = osc(b, t, 'sawtooth', mtof(m), mtof(m), 0.06, 0.07 * v, d, [600, 2600, 1.2]); o.detune.value = det; } },
  stab: (b, t, ms, v = 1) => { for (const m of ms) osc(b, t, 'square', mtof(m), mtof(m), 0.004, 0.06 * v, 0.14, [3200, 500, 2]); },
  pluck: (b, t, m, v = 1) => { osc(b, t, 'triangle', mtof(m), mtof(m), 0.002, 0.22 * v, 0.35); osc(b, t, 'sine', mtof(m + 12), mtof(m + 12), 0.002, 0.08 * v, 0.12); },
  arp: (b, t, m, v = 1) => osc(b, t, 'square', mtof(m), mtof(m), 0.003, 0.05 * v, 0.1, [2600, 700, 3]),
  pad: (b, t, ms, d, v = 1) => { for (const m of ms) { const o = osc(b, t, 'sawtooth', mtof(m), mtof(m), d * 0.35, 0.035 * v, d * 0.7, [900, 1200, 0.7]); o.detune.value = (Math.random() - 0.5) * 14; } },
};

// chord roots per bar (D minor): i - VI - VII - V
const PROG = [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]];
const ROOT = [38, 34, 36, 33];
const TRACKS = {
  // big cinematic drums + brass swells
  title: { bpm: 84, fn(b, t, s, bar, d) {
    if (s === 0) { I.taiko(b, t, 1, 62); I.brass(b, t, PROG[bar].map(m => m + 12), d * 15, 1); I.pad(b, t, PROG[bar], d * 16, 1); if (bar === 0) I.crash(b, t, 0.8); I.bass(b, t, ROOT[bar], d * 6, 0.9); }
    if (s === 6 || s === 10) I.taiko(b, t, 0.75, 75); if (s === 8) { I.taiko(b, t, 0.9, 58); I.bass(b, t, ROOT[bar], d * 6, 0.7); }
    if (s === 12 || s === 14) I.tom(b, t, 0.6, 150); if (s % 4 === 2) I.hat(b, t, 0.5);
    if (bar === 3 && s >= 12) I.snare(b, t, 0.3 + (s - 12) * 0.18);
    if (s === 4 || s === 12) I.stab(b, t, [PROG[bar][0] + 24, PROG[bar][2] + 24], 0.7);
  } },
  // adventurous jungle percussion + marimba melody
  roam: { bpm: 112, fn(b, t, s, bar, d) {
    const MEL = [[62, -1, 65, -1, 69, -1, 67, 65, 64, -1, 62, -1, 60, -1, 62, -1], [58, -1, 62, -1, 65, -1, 64, 62, 60, -1, 57, -1, 58, -1, 60, -1], [60, -1, 64, -1, 67, -1, 65, 64, 62, -1, 60, -1, 64, -1, 67, -1], [69, -1, 67, -1, 64, -1, 61, -1, 57, -1, 61, 64, 69, -1, -1, -1]];
    if (s === 0 || s === 7 || s === 10) I.tom(b, t, 0.75, 110); if ([2, 3, 6, 11, 14].includes(s)) I.conga(b, t, 0.8, s % 2 ? 400 : 300);
    if (s % 2 === 0) I.shaker(b, t, s % 4 === 0 ? 1 : 0.6); if (s === 4 || s === 12) I.snare(b, t, 0.25);
    if (s === 0 || s === 6 || s === 8 || s === 14) I.bass(b, t, ROOT[bar] + (s === 14 ? 7 : 0), d * 2.5, 0.75);
    const m = MEL[bar][s]; if (m > 0) I.pluck(b, t, m, 0.9);
    if (s === 0) I.pad(b, t, PROG[bar], d * 16, 0.7); if (s === 0 && bar === 0) I.taiko(b, t, 0.6, 70);
  } },
  // intense driving drums, faster
  battle: { bpm: 148, fn(b, t, s, bar, d) {
    if (s % 4 === 0 || s === 14) I.kick(b, t, 1); if (s === 4 || s === 12) I.snare(b, t, 1); if (bar === 3 && s >= 13) I.snare(b, t, 0.7);
    I.hat(b, t, s % 2 ? 0.5 : 0.9, s % 8 === 6);
    I.bass(b, t, ROOT[bar] + (s % 4 === 2 ? 12 : 0), d * 0.9, 0.9);
    if (s === 0) { I.brass(b, t, PROG[bar].map(m => m + 12), d * 6, 1.1); if (bar === 0) I.crash(b, t, 1); }
    if (s === 6 || s === 10) I.stab(b, t, PROG[bar].map(m => m + 12), 0.9);
    I.arp(b, t, PROG[bar][s % 3] + 24 + (s >= 8 ? 12 : 0), 0.8);
  } },
  // heaviest: double kick, distorted bass, brass power chords, choir pad, taiko hits
  boss: { bpm: 168, fn(b, t, s, bar, d) {
    const R = [38, 39, 36, 34][bar], C = [[50, 57, 62], [51, 58, 63], [48, 55, 60], [46, 53, 58]][bar];
    if (s % 2 === 0 || s === 15) I.kick(b, t, 1); if (s === 4 || s === 12) { I.snare(b, t, 1.1); I.taiko(b, t, 0.6, 80); } if (s === 0) { I.crash(b, t, 1); I.taiko(b, t, 1, 55); }
    I.hat(b, t, 0.6); I.bass(b, t, R + (s % 8 === 7 ? 12 : 0), d * 0.85, 1, true);
    if (s === 0 || s === 8) I.brass(b, t, C.map(m => m + 12), d * 7, 1.3); if (s === 0) I.pad(b, t, C, d * 16, 1.2);
    if (s === 3 || s === 11) I.stab(b, t, C.map(m => m + 24), 1);
    if (bar === 3 && s >= 12) I.tom(b, t, 0.9, 220 - (s - 12) * 30);
  } },
  // ---- Dragon Peak (E phrygian: dark, ominous, epic) ----
  // slow war drums, low brass, choir pad and a bell-like dragon motif
  peak: { bpm: 92, fn(b, t, s, bar, d) {
    const R = [40, 41, 40, 38][bar], C = [[52, 55, 59], [53, 57, 60], [52, 55, 59], [50, 53, 57]][bar];
    const MEL = [[76, -1, -1, 77, 76, -1, 74, -1, 71, -1, -1, -1, 72, -1, 71, -1], [77, -1, -1, 79, 77, -1, 76, -1, 72, -1, -1, -1, 74, -1, 72, -1], [76, -1, 79, -1, 83, -1, 81, 79, 77, -1, 76, -1, 74, -1, 76, -1], [74, -1, -1, 72, 71, -1, -1, -1, 69, -1, 71, -1, 72, -1, 74, -1]];
    if (s === 0) { I.taiko(b, t, 1, 52); I.pad(b, t, C, d * 16, 1.1); I.bass(b, t, R, d * 7, 0.9); if (bar === 0) I.crash(b, t, 0.6); }
    if (s === 3 || s === 6) I.taiko(b, t, 0.6, 68); if (s === 8) { I.taiko(b, t, 0.95, 50); I.bass(b, t, R, d * 6, 0.8); I.brass(b, t, C.map(m => m - 12), d * 7, 0.9); }
    if (s === 11 || s === 14) I.tom(b, t, 0.55, 130); if (s % 4 === 2) I.hat(b, t, 0.35, s === 14);
    const m = MEL[bar][s]; if (m > 0) { I.pluck(b, t, m, 0.75); I.arp(b, t, m - 12, 0.4); }
    if (bar === 3 && s >= 12) I.snare(b, t, 0.25 + (s - 12) * 0.15);
  } },
  // fast phrygian riff for battles on Dragon Peak
  peakbattle: { bpm: 152, fn(b, t, s, bar, d) {
    const R = [40, 41, 40, 43][bar], C = [[52, 55, 59], [53, 57, 60], [52, 55, 59], [55, 58, 62]][bar];
    const RIFF = [0, 0, 12, 0, 1, 0, 0, 12, 0, 0, 3, 0, 1, 0, -2, 0];
    if (s % 4 === 0 || s === 7 || s === 14) I.kick(b, t, 1); if (s === 4 || s === 12) I.snare(b, t, 1);
    I.hat(b, t, s % 2 ? 0.45 : 0.85, s % 8 === 6);
    I.bass(b, t, R + RIFF[s], d * 0.9, 0.95, s % 4 === 0);
    if (s === 0) { I.brass(b, t, C.map(m => m + 12), d * 7, 1.1); if (bar === 0) { I.crash(b, t, 1); I.taiko(b, t, 0.9, 58); } }
    if (s === 10) I.stab(b, t, C.map(m => m + 12), 0.9);
    I.arp(b, t, C[(s * 2) % 3] + 24, 0.7);
  } },
  // the Dragon King: thundering double kick, distorted bass, huge brass and choir
  dragonboss: { bpm: 172, fn(b, t, s, bar, d) {
    const R = [40, 41, 38, 39][bar], C = [[52, 59, 64], [53, 60, 65], [50, 57, 62], [51, 58, 63]][bar];
    if (s % 2 === 0 || s === 15 || s === 7) I.kick(b, t, 1.05); if (s === 4 || s === 12) { I.snare(b, t, 1.15); I.taiko(b, t, 0.7, 75); }
    if (s === 0) { I.crash(b, t, 1.1); I.taiko(b, t, 1.1, 48); I.pad(b, t, C.map(m => m - 12), d * 16, 1.3); }
    I.hat(b, t, 0.55, s % 4 === 2); I.bass(b, t, R + (s % 8 === 3 ? 1 : s % 8 === 7 ? 12 : 0), d * 0.85, 1.05, true);
    if (s === 0 || s === 8) I.brass(b, t, C.map(m => m + 12), d * 7, 1.4); if (s === 6 || s === 14) I.brass(b, t, [C[0] + 13], d * 2, 1.1);
    if (s === 3 || s === 11) I.stab(b, t, C.map(m => m + 24), 1.05);
    if (bar === 3 && s >= 10) I.tom(b, t, 1, 240 - (s - 10) * 26);
  } },
};

function startTrack(name, t) {
  const T = TRACKS[name]; if (!T) return;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.6); g.connect(out);
  if (cur) { const old = cur.g; old.gain.cancelScheduledValues(t); old.gain.setTargetAtTime(0.0001, t, 0.25); setTimeout(() => old.disconnect(), 3000); }
  cur = { name, T, g }; step = 0;
}
function tick() {
  if (!ctx || !enabled || document.hidden) { if (ctx) nextT = ctx.currentTime + 0.05; return; }
  if (performance.now() < stingEnd) { nextT = ctx.currentTime + 0.05; return; }
  if (want !== (cur && cur.name) && want) startTrack(want, Math.max(nextT, ctx.currentTime + 0.03));
  if (!cur) return;
  if (nextT < ctx.currentTime - 0.3) nextT = ctx.currentTime + 0.05; // resync after a stall
  const d = 60 / cur.T.bpm / 4;
  while (nextT < ctx.currentTime + 0.2) { const s = step % 16, bar = (step >> 4) % 4; try { cur.T.fn(cur.g, nextT, s, bar, d); } catch (e) { /* never let music break the game */ } step = (step + 1) % 64; nextT += d; }
}
function ensure() {
  if (ctx || !audioCtx()) return; ctx = audioCtx();
  out = ctx.createGain(); out.gain.value = enabled ? vol : 0; out.connect(getMusicBus());
  shaper = ctx.createWaveShaper(); const c = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 256 - 1; c[i] = Math.tanh(x * 3.5) * 0.8; } shaper.curve = c;
  const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 2200; shaper.connect(sf); sf.connect(out);
  nextT = ctx.currentTime + 0.1; timer = setInterval(tick, 30);
}
onAudioReady(() => ensure());

export const music = {
  play(name) { want = name; ensure(); },
  get track() { return cur ? cur.name : null; },
  get wanted() { return want; },
  get running() { return !!timer && enabled; },
  setEnabled(on) { enabled = on; if (out && ctx) out.gain.setTargetAtTime(on ? vol : 0, ctx.currentTime, 0.1); if (on && ctx) nextT = ctx.currentTime + 0.05; },
  get enabled() { return enabled; },
  // victory fanfare: one-shot brass arpeggio + crash + taiko, then fall back to `then`
  victory() {
    ensure(); if (!ctx || !enabled) return;
    if (cur) { cur.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1); cur = null; }
    const b = ctx.createGain(); b.connect(out); const t = ctx.currentTime + 0.05;
    I.crash(b, t, 1); I.taiko(b, t, 1, 60); [62, 66, 69, 74].forEach((m, i) => I.brass(b, t + i * 0.16, [m, m - 12], 0.35, 1.2));
    I.brass(b, t + 0.7, [62, 66, 69, 74], 1.8, 1.3); I.taiko(b, t + 0.7, 1, 55); I.crash(b, t + 0.7, 0.8); I.kick(b, t + 0.7, 1); I.snare(b, t + 0.6, 0.6); I.snare(b, t + 0.65, 0.8);
    stingEnd = performance.now() + 3400; this.stings = (this.stings || 0) + 1;
  },
};
