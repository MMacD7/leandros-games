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

function env(g, t, a, peak, dec) { peak = Math.max(0.0002, peak || 0); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
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
function nz2(t, dur, type, f0, f1, peak, q = 1) { noise(t, dur, type, f0, f1, peak, q); }
// Ricky & Bobby: a small-terrier "yip" (quick rise-then-fall pitch through a mouth-like band filter, soft and short) and a stadium crowd cheer
function yip(t, p, v) {
  const f0 = 640 * p, o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0 * 0.82, t); o.frequency.linearRampToValueAtTime(f0 * 1.22, t + 0.025); o.frequency.exponentialRampToValueAtTime(f0 * 0.72, t + 0.11);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.3; bp.frequency.setValueAtTime(1700 * p, t); bp.frequency.exponentialRampToValueAtTime(1200 * p, t + 0.11);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2 * v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.06 * v, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(bp); bp.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + 0.15);
  noise(t, 0.035, 'bandpass', 2400 * p, 1600 * p, 0.05 * v, 1.5); // a touch of breath at the start
}
function cheer(t, v) { noise(t, 2.6, 'bandpass', 900, 1400, 0.38 * v, 0.6); noise(t + 0.1, 2.4, 'bandpass', 2400, 1800, 0.18 * v, 0.8);
  for (let i = 0; i < 9; i++) { const s = t + 0.1 + Math.random() * 1.6, f = 380 + Math.random() * 420; const o = tone(s, 'triangle', f, f * (1.3 + Math.random() * 0.4), 0.45, 0.04 * v, 0.06); o.detune.value = (Math.random() - 0.5) * 40; }
  for (let i = 0; i < 14; i++) noise(t + 0.3 + Math.random() * 1.8, 0.03, 'highpass', 2500, 2400, 0.1 * v, 1); }
// ---- v5.2 FARTY POOP FARM: WETTER + FUNNIER procedural farts (all synthesized, no samples) ----
// One "toot" = layered: buzzy lips (osc + wobble vibrato + flutter chop -> resonant low-pass) + a low sub rumble
// + bubbly band-passed noise bursts and little "bloop" pops (the wet part) + a splashy sputter tail.
// Pitch curves are cartoon slides (rising squeak endings, trombone wah). A variant is a little "routine" of toots
// (stutter rapid-fire, pause-then-'pfft' encore...). Everything goes through one per-fart bus capped at a sane level.
const FARTS = {
  short:    { seg: [{ f0: 120, f1: 82, dur: 0.26, flut: 44, wob: 0.2, lp: 950, wet: 0.5 }] },
  long:     { seg: [{ f0: 100, f1: 64, dur: 1.35, flut: 30, wob: 0.24, lp: 820, wet: 0.6, vib: 5, sq: 0.25 }] },
  squeaky:  { seg: [{ f0: 380, f1: 300, dur: 0.55, flut: 58, wob: 0.12, lp: 2600, type: 'square', wet: 0.2, sq: 1 }] },
  rumbly:   { seg: [{ f0: 58, f1: 40, dur: 1.1, flut: 17, wob: 0.3, lp: 430, sub: 1, wet: 0.7 }] },
  wet:      { seg: [{ f0: 92, f1: 60, dur: 0.8, flut: 34, wob: 0.3, lp: 1050, wet: 1.5, sub: 0.5 }] },
  trumpet:  { seg: [{ f0: 125, f1: 280, dur: 0.7, flut: 38, wob: 0.1, lp: 1500, wet: 0.3, vib: 7 }] },
  tiny:     { seg: [{ f0: 300, f1: 240, dur: 0.17, flut: 60, wob: 0.1, lp: 2400, type: 'square', wet: 0.3, sq: 0.6 }] },
  mega:     { seg: [{ f0: 62, f1: 36, dur: 2.2, flut: 21, wob: 0.36, lp: 680, sub: 1.2, wet: 1.6, vib: 3 }, { at: 2.55, f0: 340, f1: 520, dur: 0.22, flut: 60, wob: 0.1, lp: 2400, type: 'square', wet: 0.3, sq: 1 }] },
  // v5.2 new routines
  bubbly:   { seg: [{ f0: 105, f1: 70, dur: 0.95, flut: 26, wob: 0.34, lp: 900, wet: 2.2, sub: 0.4 }] },
  stutter:  { seg: [0, 0.14, 0.26, 0.4, 0.5, 0.62].map((at, i) => ({ at, f0: 140 - i * 6, f1: 110 - i * 5, dur: 0.1, flut: 50, wob: 0.15, lp: 1100, wet: 0.5 })) },
  encore:   { seg: [{ f0: 110, f1: 72, dur: 0.6, flut: 36, wob: 0.25, lp: 950, wet: 0.9 }, { at: 1.0, f0: 260, f1: 330, dur: 0.14, flut: 55, wob: 0.1, lp: 2200, type: 'square', wet: 0.2, sq: 0.8 }] },
  trombone: { seg: [{ f0: 150, f1: 70, dur: 1.5, flut: 28, wob: 0.12, lp: 1300, wah: 1, vib: 6, wet: 0.4, slide: [1, 1.35, 0.8, 1.2, 0.55] }] },
  squeakup: { seg: [{ f0: 120, f1: 95, dur: 0.45, flut: 40, wob: 0.18, lp: 1000, wet: 0.6 }, { at: 0.42, f0: 330, f1: 900, dur: 0.3, flut: 70, wob: 0.06, lp: 3000, type: 'square', sq: 1, wet: 0 }] },
  raspberry:{ seg: [{ f0: 180, f1: 150, dur: 0.7, flut: 64, wob: 0.18, lp: 1700, wet: 0.8, vib: 9 }] },
};
export const FART_KINDS = [...Object.keys(FARTS), 'machine'];
function bloop(t, f, bus, v) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.35, t + 0.05);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.08); }
function nz(t, dur, type, f0, f1, peak, q, bus) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain(); env(g, t, 0.005, peak, dur); s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.1); }
function toot(t, o, v, bus) {
  const r = 0.88 + Math.random() * 0.3, dur = o.dur * (0.85 + Math.random() * 0.3), f0 = o.f0 * r, f1 = o.f1 * r, sq = o.sq || 0;
  const src = ctx.createOscillator(); src.type = o.type || 'sawtooth'; src.frequency.setValueAtTime(f0, t);
  if (o.slide) o.slide.forEach((k, i) => i && src.frequency.linearRampToValueAtTime(f0 * k, t + dur * i / (o.slide.length - 1)));
  else { src.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * (sq ? 0.8 : 1)); if (sq) src.frequency.exponentialRampToValueAtTime(f1 * (1.5 + 0.5 * sq), t + dur); } // silly rising squeak ending
  const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.setValueAtTime(o.flut * 0.37, t); const lg = ctx.createGain(); lg.gain.value = f0 * o.wob; lfo.connect(lg); lg.connect(src.frequency);
  if (o.vib) { const vb = ctx.createOscillator(); vb.frequency.value = o.vib; const vg = ctx.createGain(); vg.gain.value = f0 * 0.08; vb.connect(vg); vg.connect(src.frequency); vb.start(t); vb.stop(t + dur + 0.05); } // wobbly vibrato
  const am = ctx.createOscillator(); am.type = 'square'; am.frequency.setValueAtTime(o.flut * r, t); am.frequency.linearRampToValueAtTime(o.flut * r * (0.6 + Math.random() * 0.5), t + dur);
  const vca = ctx.createGain(); vca.gain.value = 0.55; const amg = ctx.createGain(); amg.gain.value = 0.45; am.connect(amg); amg.connect(vca.gain);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = o.wah ? 9 : 5; lp.frequency.setValueAtTime(o.lp * 1.3, t);
  if (o.wah) for (let i = 1; i <= 6; i++) lp.frequency.linearRampToValueAtTime(o.lp * (i % 2 ? 0.45 : 1.4), t + dur * i / 6); else lp.frequency.exponentialRampToValueAtTime(o.lp * 0.7, t + dur);
  const g = ctx.createGain(), pk = Math.max(0.0002, 0.34 * v); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + 0.015); g.gain.setValueAtTime(pk, t + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(vca); vca.connect(lp); lp.connect(g); g.connect(bus); for (const n of [src, lfo, am]) { n.start(t); n.stop(t + dur + 0.05); }
  if (o.sub) { const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.setValueAtTime(f0 * 0.8, t); s.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * 0.7), t + dur); const sg = ctx.createGain(); env(sg, t, 0.03, 0.26 * v * o.sub, dur); s.connect(sg); sg.connect(bus); s.start(t); s.stop(t + dur + 0.1); }
  const w = o.wet || 0;
  if (w > 0) { // the wet part: a squelchy bubbly splutter, randomized bloop pops, then a little splash/sputter tail
    nz(t, dur * 0.9, 'bandpass', 760, 260, 0.13 * v * w, 2.5, bus);
    const nb = Math.round(3 + w * 6); for (let i = 0; i < nb; i++) { const s = t + Math.random() * dur; nz(s, 0.03 + Math.random() * 0.04, 'bandpass', 350 + Math.random() * 900, 250, 0.1 * v * Math.min(1.4, w), 6, bus); }
    const np = Math.round(2 + w * 4); for (let i = 0; i < np; i++) bloop(t + Math.random() * dur * 1.05, 250 + Math.random() * 650, bus, 0.07 * v * Math.min(1.4, w));
    if (w >= 0.5) { const e = t + dur * 0.92; nz(e, 0.22, 'lowpass', 1400, 200, 0.1 * v * w, 1, bus); for (let i = 0; i < 3; i++) bloop(e + 0.04 + i * 0.06 + Math.random() * 0.03, 500 + Math.random() * 400, bus, 0.05 * v * w); }
  }
  nz(t, Math.min(0.25, dur), 'lowpass', 500, 150, 0.06 * v, 1, bus); // a little air
  return dur;
}
function fart(t, k, v) {
  const F = FARTS[k] || FARTS.short; const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(master); let end = 0;
  for (const s of F.seg) { const at = (s.at || 0) * (0.95 + Math.random() * 0.1); end = Math.max(end, at + toot(t + at, s, v * (s.at ? 0.8 : 1), bus)); }
  return end;
}
// mammal "voice": a buzzy source through two formant band-pass filters (vowel), with vibrato / tremolo
function voiceT(t, o) {
  const s = ctx.createOscillator(); s.type = o.type || 'sawtooth'; s.frequency.setValueAtTime(o.f[0], t); for (let i = 1; i < o.f.length; i++) s.frequency.linearRampToValueAtTime(o.f[i], t + o.dur * i / (o.f.length - 1));
  if (o.vib) { const l = ctx.createOscillator(); l.frequency.value = o.vib; const lg = ctx.createGain(); lg.gain.value = o.vibD || 6; l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + o.dur + 0.1); }
  const v = Math.max(0.0002, o.v || 0); const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(v, t + (o.a || 0.06)); out.gain.setValueAtTime(v, t + o.dur * 0.75); out.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  if (o.trem) { const tr = ctx.createOscillator(); tr.frequency.value = o.trem; const tg = ctx.createGain(); tg.gain.value = 0.5; const vca = ctx.createGain(); vca.gain.value = 0.55; tr.connect(tg); tg.connect(vca.gain); vca.connect(out); tr.start(t); tr.stop(t + o.dur + 0.1); out._in = vca; }
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(o.lp0 || 2500, t); lp.frequency.linearRampToValueAtTime(o.lp1 || o.lp0 || 2500, t + o.dur * 0.5); lp.frequency.linearRampToValueAtTime(o.lp0 || 2500, t + o.dur);
  s.connect(lp); for (const [f, q, gn] of o.form) { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; const bg = ctx.createGain(); bg.gain.value = gn; lp.connect(b); b.connect(bg); bg.connect(out._in || out); }
  out.connect(master); s.start(t); s.stop(t + o.dur + 0.05);
}
export const sfx = {
  // v4.4: n quick yips ('yip-yip'); p = pitch (Bobby is a bit higher), v = volume. Silent until the first tap unlocks audio.
  bark(p = 1, v = 1, n = 2) { if (!ctx) return; const t = now(); for (let i = 0; i < n; i++) yip(t + i * 0.16, p * (1 + i * 0.06), v * (1 - i * 0.15)); },
  // ---- v5.1 Farty Poop Farm ----
  fart(kind = 'random', v = 1) { const K = FART_KINDS.filter(k => k !== 'mega' && k !== 'tiny' && k !== 'machine'); const k = kind === 'random' ? K[(Math.random() * K.length) | 0] : FARTS[kind] || kind === 'machine' ? kind : 'short';
    this.nFarts = (this.nFarts || 0) + 1; this.lastFart = k; this.fartLog = this.fartLog || {}; this.fartLog[k] = (this.fartLog[k] || 0) + 1; if (!ctx) return k; const t = now(); v = Math.min(1.3, Math.max(0, v));
    if (k === 'machine') { for (let i = 0; i < 6; i++) fart(t + i * 0.13, i % 3 === 2 ? 'tiny' : 'short', v * (0.75 + Math.random() * 0.3)); return k; }
    const d = fart(t, k, v); if (d > 0.9) duck(0.45, d); return k; },
  // v5.2 silly extras
  // v5.3 SUPER STINKY visitors: a whiny cartoon "EEEEWWW!" (pitch per visitor)
  eww(p = 1, v = 1) { this.nEww = (this.nEww || 0) + 1; if (!ctx) return; const t = now(); voiceT(t, { f: [520 * p, 640 * p, 600 * p, 470 * p, 380 * p], dur: 0.75, v: 0.2 * v, a: 0.03, vib: 7, vibD: 14, form: [[350 * p, 4, 1.0], [2300 * p, 6, 0.7]] }); voiceT(t + 0.62, { f: [420 * p, 300 * p], dur: 0.35, v: 0.12 * v, a: 0.02, form: [[700, 4, 1], [1100, 5, 0.6]] }); },
  // v5.5 sea turtle: a whirring spin, a hollow shell CLONK + shimmer for the shield, a bubbly flipper whoosh
  shellSpin(v = 1) { if (!ctx) return; const t = now(); this.nShell = (this.nShell || 0) + 1; for (let i = 0; i < 6; i++) noise(t + i * 0.12, 0.12, 'bandpass', 500 + i * 140, 900, 0.22 * v, 3); tone(t, 'triangle', 180, 520, 0.8, 0.12 * v, 0.02); },
  shellShield(v = 1) { if (!ctx) return; const t = now(); this.nShell = (this.nShell || 0) + 1; tone(t, 'sine', 240, 180, 0.25, 0.3 * v, 0.003); noise(t, 0.08, 'bandpass', 900, 600, 0.25 * v, 4); tone(t + 0.05, 'sine', 1200, 1800, 0.6, 0.06 * v, 0.05); tone(t + 0.1, 'sine', 1600, 2400, 0.5, 0.05 * v, 0.05); },
  clonk(v = 1) { if (!ctx) return; const t = now(); tone(t, 'sine', 300, 210, 0.18, 0.28 * v, 0.002); noise(t, 0.06, 'bandpass', 1200, 800, 0.2 * v, 5); },
  flipper(v = 1) { if (!ctx) return; const t = now(); this.nFlip = (this.nFlip || 0) + 1; noise(t, 0.45, 'bandpass', 600, 2200, 0.25 * v, 1.2); for (let i = 0; i < 5; i++) tone(t + 0.05 + i * 0.06, 'sine', 500 + Math.random() * 500, 900 + Math.random() * 600, 0.07, 0.07 * v, 0.004); },
  wheee(v = 1) { if (!ctx) return; const t = now(); this.nWheee = (this.nWheee || 0) + 1; voiceT(t + 0.05, { f: [380, 520, 760, 980, 900], dur: 0.7, v: 0.16 * v, a: 0.03, vib: 6, vibD: 18, form: [[600, 4, 1.0], [2600, 6, 0.6]] }); }, // a happy little turtle "wheee!"
  // v5.3 bouncy castle: a rubbery vinyl squeak + a soft air 'whumpf'
  squeakBounce(v = 1, p = 1) { this.nSqueak = (this.nSqueak || 0) + 1; if (!ctx) return; const t = now(); tone(t, 'triangle', 900 * p, 1500 * p, 0.09, 0.07 * v, 0.003); tone(t + 0.07, 'triangle', 1300 * p, 800 * p, 0.08, 0.05 * v, 0.003);
    noise(t, 0.18, 'lowpass', 400, 120, 0.12 * v); },
  boing(v = 1, p = 1) { this.nBoing = (this.nBoing || 0) + 1; if (!ctx) return; const t = now(); const o = tone(t, 'sine', 180 * p, 520 * p, 0.32, 0.22 * v, 0.004); const l = ctx.createOscillator(); l.frequency.value = 18; const lg = ctx.createGain(); lg.gain.value = 60 * p; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.4); },
  stars(v = 1) { if (!ctx) return; const t = now(); [1568, 2093, 2637, 2093].forEach((f, i) => tone(t + i * 0.07, 'triangle', f, f, 0.12, 0.06 * v)); },
  sparkle(v = 1) { if (!ctx) return; const t = now(); for (let i = 0; i < 6; i++) { const f = 1800 + Math.random() * 1800; tone(t + i * 0.05, 'sine', f, f * 1.05, 0.15, 0.05 * v); } },
  slip(v = 1) { this.nSlip = (this.nSlip || 0) + 1; if (!ctx) return; const t = now(); tone(t, 'sine', 300, 1400, 0.35, 0.12 * v, 0.01); tone(t + 0.42, 'sine', 120, 50, 0.25, 0.35 * v); nz2(t + 0.42, 0.2, 'lowpass', 900, 150, 0.3 * v); },
  sneeze(v = 1, p = 1) { this.nSneeze = (this.nSneeze || 0) + 1; if (!ctx) return; const t = now(); voiceT(t, { f: [500 * p, 700 * p, 900 * p], dur: 0.45, v: 0.18 * v, a: 0.2, form: [[900, 4, 1.2], [2400, 5, 0.6]] }); nz2(t + 0.5, 0.25, 'highpass', 2500, 1200, 0.4 * v); voiceT(t + 0.5, { f: [900 * p, 400 * p], dur: 0.18, v: 0.2 * v, a: 0.005, form: [[1500, 3, 1]] }); },
  honkTune(v = 1, p = 1) { this.nHonk = (this.nHonk || 0) + 1; if (!ctx) return; const t = now(); [392, 494, 587, 494, 659, 587].forEach((f, i) => { const o = tone(t + i * 0.18, 'sawtooth', f * 0.5 * p, f * 0.5 * p, 0.16, 0.09 * v, 0.02); o.detune.value = Math.random() * 8; }); },
  grumble(v = 1) { if (!ctx) return; voiceT(now(), { f: [110, 95, 120, 90], dur: 0.9, v: 0.3 * v, a: 0.05, trem: 13, lp0: 700, form: [[400, 3, 1.4], [900, 4, 0.5]] }); },
  snore(v = 1) { this.nSnore = (this.nSnore || 0) + 1; if (!ctx) return; const t = now(); nz2(t, 0.9, 'bandpass', 300, 500, 0.18 * v, 3); voiceT(t, { f: [70, 85, 70], dur: 0.9, v: 0.12 * v, a: 0.3, trem: 24, lp0: 500, form: [[300, 2, 1]] }); tone(t + 1.1, 'sine', 1200, 1800, 0.35, 0.05 * v, 0.05); },
  trip(v = 1) { if (!ctx) return; const t = now(); tone(t, 'square', 600, 200, 0.18, 0.06 * v); tone(t + 0.2, 'sine', 90, 40, 0.3, 0.4 * v); nz2(t + 0.2, 0.3, 'lowpass', 800, 100, 0.3 * v); this.stars(v * 0.8); },
  laughNeigh(v = 1) { this.nAnimal = (this.nAnimal || 0) + 1; if (!ctx) return; const t = now(); for (let i = 0; i < 5; i++) voiceT(t + i * 0.13, { f: [760 - i * 40, 980 - i * 50, 700 - i * 40], dur: 0.11, v: 0.24 * v, a: 0.01, vib: 20, vibD: 40, form: [[1300, 3, 1.3], [2500, 5, 0.6]] }); },
  punch(v = 1) { if (!ctx) return; const t = now(); tone(t, 'sine', 140, 40, 0.25, 0.7 * v, 0.003); nz2(t, 0.14, 'bandpass', 1800, 500, 0.45 * v, 1.2); nz2(t, 0.05, 'highpass', 4000, 2500, 0.25 * v, 1); },
  callout(v = 1) { if (!ctx) return; const t = now(); [523, 784, 1047].forEach((f, i) => tone(t + i * 0.05, 'square', f, f * 1.02, 0.16, 0.07 * v)); nz2(t, 0.4, 'highpass', 3000, 8000, 0.1 * v); },
  plop(v = 1) { this.nPlops = (this.nPlops || 0) + 1; if (!ctx) return; const t = now(); tone(t, 'sine', 560, 85, 0.13, 0.32 * v); noise(t + 0.02, 0.16, 'lowpass', 500, 120, 0.25 * v, 1.2); tone(t + 0.14, 'sine', 420, 120, 0.08, 0.12 * v); },
  squish(v = 1) { this.nSquish = (this.nSquish || 0) + 1; if (!ctx) return; const t = now(); noise(t, 0.3, 'bandpass', 900, 260, 0.38 * v, 2.2); tone(t, 'sine', 230, 70, 0.22, 0.22 * v); for (let i = 0; i < 4; i++) tone(t + 0.05 + Math.random() * 0.2, 'sine', 300 + Math.random() * 400, 120, 0.05, 0.08 * v); },
  squelch(v = 1) { if (!ctx) return; const t = now(); noise(t, 0.16, 'lowpass', 900, 200, 0.22 * v, 2); tone(t, 'sine', 180 + Math.random() * 60, 90, 0.1, 0.1 * v); },
  splash(v = 1) { this.nSplash = (this.nSplash || 0) + 1; if (!ctx) return; const t = now(); noise(t, 0.7, 'lowpass', 1600, 140, 0.5 * v, 0.8); noise(t, 0.25, 'highpass', 2500, 1200, 0.15 * v, 0.7); for (let i = 0; i < 8; i++) tone(t + Math.random() * 0.5, 'sine', 250 + Math.random() * 500, 100, 0.06, 0.08 * v); },
  pie(v = 1) { if (!ctx) return; const t = now(); noise(t, 0.35, 'bandpass', 1400, 400, 0.45 * v, 1.2); tone(t, 'sine', 300, 90, 0.2, 0.25 * v); noise(t + 0.05, 0.25, 'highpass', 3000, 1500, 0.12 * v, 1); },
  munch(v = 1) { if (!ctx) return; const t = now(); for (let i = 0; i < 4; i++) { noise(t + i * 0.16, 0.07, 'bandpass', 1500 + Math.random() * 900, 900, 0.22 * v, 1.2); tone(t + i * 0.16, 'square', 140, 90, 0.05, 0.04 * v); } },
  moo(p = 1, v = 1) { this.nAnimal = (this.nAnimal || 0) + 1; if (!ctx) return; voiceT(now(), { f: [100 * p, 128 * p, 118 * p, 92 * p], dur: 1.3, v: 0.5 * v, a: 0.15, vib: 5, vibD: 3, lp0: 380, lp1: 1700, form: [[620, 3, 1.4], [1050, 5, 0.6], [240, 2, 0.8]] }); },
  oink(p = 1, v = 1) { this.nAnimal = (this.nAnimal || 0) + 1; if (!ctx) return; const t = now(); for (let i = 0; i < 2; i++) { voiceT(t + i * 0.19, { type: 'square', f: [240 * p, 200 * p, 170 * p], dur: 0.15, v: 0.35 * v, a: 0.01, lp0: 1800, form: [[950, 3, 1.4], [1900, 6, 0.4]] }); noise(t + i * 0.19, 0.12, 'bandpass', 700, 400, 0.2 * v, 3); } },
  cluck(p = 1, v = 1) { this.nAnimal = (this.nAnimal || 0) + 1; if (!ctx) return; const t = now(); const n = 3 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) voiceT(t + i * 0.12, { type: 'triangle', f: [700 * p, 920 * p, 640 * p], dur: 0.07, v: 0.22 * v, a: 0.005, form: [[1300, 4, 1.4], [2600, 6, 0.5]] });
    voiceT(t + n * 0.12 + 0.05, { type: 'sawtooth', f: [620 * p, 1150 * p, 900 * p], dur: 0.28, v: 0.2 * v, a: 0.01, form: [[1400, 4, 1.2], [2800, 6, 0.4]] }); },
  baa(p = 1, v = 1) { this.nAnimal = (this.nAnimal || 0) + 1; if (!ctx) return; voiceT(now(), { f: [340 * p, 360 * p, 300 * p], dur: 0.85, v: 0.36 * v, a: 0.04, trem: 8, lp0: 2600, form: [[1100, 4, 1.4], [2400, 6, 0.5], [600, 3, 0.4]] }); },
  maa(p = 1, v = 1) { this.nAnimal = (this.nAnimal || 0) + 1; if (!ctx) return; voiceT(now(), { f: [470 * p, 520 * p, 410 * p], dur: 0.7, v: 0.32 * v, a: 0.03, trem: 11, lp0: 3000, form: [[1500, 5, 1.4], [2900, 6, 0.6]] }); },
  neigh(p = 1, v = 1) { this.nAnimal = (this.nAnimal || 0) + 1; if (!ctx) return; const t = now();
    voiceT(t, { f: [520 * p, 980 * p, 900 * p], dur: 0.35, v: 0.3 * v, a: 0.03, vib: 15, vibD: 40, lp0: 3200, form: [[1400, 3, 1.3], [2600, 5, 0.6]] });
    voiceT(t + 0.33, { f: [900 * p, 640 * p, 420 * p], dur: 0.75, v: 0.3 * v, a: 0.02, trem: 17, vib: 9, vibD: 25, lp0: 2600, form: [[1200, 3, 1.3], [2400, 5, 0.6]] });
    noise(t + 1.0, 0.35, 'bandpass', 900, 500, 0.15 * v, 2); },
  // v5.3 tractor: a chunky putt-putt engine thump and a silly MOO-horn
  putt(v = 1, rev = 0) { if (!ctx) return; const t = now(); v = Math.min(1, v); this.nPutt = (this.nPutt || 0) + 1; tone(t, 'square', 62 + rev * 30, 40 + rev * 20, 0.09, 0.07 * v, 0.004); noise(t, 0.07, 'lowpass', 380 + rev * 200, 120, 0.22 * v, 1.5); tone(t, 'sine', 48 + rev * 20, 30, 0.12, 0.2 * v, 0.004); },
  mooHorn(v = 1) { if (!ctx) return; const t = now(); this.nHonk2 = (this.nHonk2 || 0) + 1; v = Math.min(1, v);
    tone(t, 'sawtooth', 210, 160, 0.55, 0.11 * v, 0.02); tone(t, 'square', 262, 200, 0.55, 0.05 * v, 0.02); tone(t + 0.6, 'sawtooth', 175, 120, 0.85, 0.12 * v, 0.03); tone(t + 0.6, 'square', 220, 150, 0.85, 0.05 * v, 0.03); noise(t + 0.6, 0.8, 'bandpass', 700, 380, 0.05 * v, 3); },
  clop(v = 1, p = 1) { if (!ctx) return; const t = now(); noise(t, 0.035, 'bandpass', 2300 * p, 1800, 0.3 * v, 4); tone(t, 'triangle', 430 * p, 300, 0.05, 0.12 * v); noise(t + 0.07, 0.03, 'bandpass', 2000 * p, 1600, 0.2 * v, 4); },
  giggle(v = 1) { this.nGiggle = (this.nGiggle || 0) + 1; if (!ctx) return; const t = now(); for (let i = 0; i < 4; i++) voiceT(t + i * 0.13, { f: [760 - i * 40, 820 - i * 50, 700 - i * 40], dur: 0.09, v: 0.22 * v, a: 0.01, form: [[2200, 5, 1.2], [900, 4, 0.6]] }); },
  sniff(v = 1) { if (!ctx) return; const t = now(); for (let i = 0; i < 3; i++) noise(t + i * 0.11, 0.06, 'highpass', 2500, 3500, 0.12 * v, 1); },
  rooster(v = 1) { if (!ctx) return; const t = now(); [[0, 0.14, 650, 820], [0.17, 0.14, 700, 880], [0.36, 0.18, 760, 940], [0.6, 0.6, 980, 700]].forEach(([d, l, a, b]) => voiceT(t + d, { f: [a, b, b * 0.97], dur: l, v: 0.22 * v, a: 0.02, vib: 7, vibD: 15, form: [[1400, 4, 1.3], [2700, 6, 0.5]] })); },
  tada(v = 1) { if (!ctx) return; const t = now(); [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(t + i * 0.08, 'triangle', f, f, 0.25, 0.14 * v)); },
  // v5 Deep Sea: a cluster of bubbly blips (n bubbles over ~0.4 s), a squishy INK splurt, and a sonar ping
  bubbles(v = 1, n = 6) { this.nBubbles = (this.nBubbles || 0) + 1; if (!ctx) return; const t = now(); for (let i = 0; i < n; i++) { const s = t + Math.random() * 0.4, f = 300 + Math.random() * 700; tone(s, 'sine', f, f * (2 + Math.random()), 0.05 + Math.random() * 0.04, 0.07 * v); } },
  ink(v = 1) { if (!ctx) return; const t = now(); noise(t, 0.55, 'lowpass', 900, 120, 0.4 * v, 1.2); tone(t, 'sine', 140, 50, 0.4, 0.3 * v); this.bubbles(v * 0.7, 8); },
  sonar(v = 1) { if (!ctx) return; const t = now(); for (let k = 0; k < 3; k++) tone(t + k * 0.35, 'sine', 1240, 1230, 0.9, 0.1 * v * Math.pow(0.45, k)); },
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
  // v5: a building collapsing: deep thump, long rumbling crumble, cracking concrete and shattering glass (h = building size 0..1)
  crash(v = 1, h = 0.6) { if (!ctx) return; const t = now(); v = Math.min(1.4, v); const d = 1.6 + h * 1.6;
    tone(t, 'sine', 70, 24, 1.2 + h, 0.9 * v, 0.006); noise(t, d, 'lowpass', 900, 50, 0.7 * v, 0.5); noise(t + 0.05, d * 0.8, 'bandpass', 400, 160, 0.35 * v, 0.9);
    for (let i = 0; i < 10; i++) noise(t + Math.random() * d * 0.8, 0.07 + Math.random() * 0.08, 'bandpass', 600 + Math.random() * 900, 300, 0.22 * v, 2); // concrete cracks
    for (let i = 0; i < 8; i++) noise(t + 0.1 + Math.random() * d * 0.6, 0.05, 'highpass', 4500 + Math.random() * 3000, 7000, 0.08 * v, 4); // glass
    duck(0.6, d * 0.6); },
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
// v5.2: render one fart variant offline (used by the headless test to check every variant plays, stays in range and doesn't clip)
export async function renderFart(kind, v = 1, sec = 3.2) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC) return null;
  const sr = 22050, off = new OAC(1, Math.round(sr * sec), sr), keep = [ctx, master, noiseBuf];
  try { ctx = off; master = off.createGain(); master.gain.value = 0.7; const c = off.createDynamicsCompressor(); c.threshold.value = -14; c.ratio.value = 4; master.connect(c); c.connect(off.destination);
    noiseBuf = off.createBuffer(1, sr * 2, sr); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (kind === 'machine') { for (let i = 0; i < 6; i++) fart(i * 0.13, i % 3 === 2 ? 'tiny' : 'short', v * 0.9); } else fart(0.02, kind, v);
  } finally { [ctx, master, noiseBuf] = keep; }
  const buf = await off.startRendering(); return buf.getChannelData(0);
}
