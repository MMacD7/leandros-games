// Procedural HEAVY METAL soundtrack, synthesized live with Web Audio (no audio files, nothing downloaded).
// v5: rebuilt to be way more bad-ass: 150–172 BPM, distorted power-chord guitars (saw/square oscillators through a
// waveshaper + cabinet filters), a growling bass, punchy kick/snare with double-kick runs, minor/phrygian riffs,
// a boss RISER + HIT when a boss arrives, and an INTENSITY layer (extra double-kick, leads and cymbals) that swells
// with the number of dinos in a battle. Per-level flavour: Jungle = tribal metal (taiko + toms under the riffs),
// Dragon Peak = epic & dark (choir, brass, phrygian), Mega City = industrial rock (metal clanks, gated synth, chugs),
// Deep Sea = doom-y underwater metal (muffled guitar cab, sonar pings, whale glides, bubble blips).
// A look-ahead step sequencer schedules 4 bars of 16 steps per loop; switching tracks crossfades on the next step.
// Everything goes into the music bus (which already ducks under booms and the announcer's voice), and the master
// level is kept low enough that the announcer and Ricky & Bobby's yips always cut through.
import { audioCtx, getMusicBus, getNoise, onAudioReady } from './audio.js';

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
let stingEnd = 0, ctx = null, out = null, enabled = true, cur = null, want = null, step = 0, nextT = 0, timer = null, vol = 0.26, inten = 0, DIST = null, DIST2 = null;

// ---------- instruments (each schedules a short voice at time t into the given bus) ----------
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function osc(bus, t, type, f0, f1, a, peak, d, filt) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + a + d);
  env(g, t, a, peak, d); let n = o; if (filt) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(filt[0], t); f.frequency.exponentialRampToValueAtTime(filt[1], t + a + d); f.Q.value = filt[2] || 1; o.connect(f); n = f; }
  n.connect(g); g.connect(bus); o.start(t); o.stop(t + a + d + 0.05); return o;
}
function nz(bus, t, type, f, q, a, peak, d, f1) {
  const s = ctx.createBufferSource(); s.buffer = getNoise(); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + a + d); fl.Q.value = q;
  const g = ctx.createGain(); env(g, t, a, peak, d); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random() * 1.5); s.stop(t + a + d + 0.05);
}
const G = b => b.gtr || b, L = b => b.lay || b; // guitar (distortion) input / intensity layer of a track bus
const I = {
  // punchy metal kit
  kick: (b, t, v = 1) => { osc(b, t, 'sine', 170, 44, 0.002, 1.0 * v, 0.24); osc(b, t, 'triangle', 2400, 600, 0.001, 0.12 * v, 0.012); nz(b, t, 'highpass', 4000, 1, 0.001, 0.1 * v, 0.012); },
  snare: (b, t, v = 1) => { nz(b, t, 'bandpass', 1800, 0.7, 0.001, 0.6 * v, 0.14); nz(b, t, 'highpass', 5000, 0.7, 0.001, 0.22 * v, 0.2); osc(b, t, 'triangle', 240, 170, 0.001, 0.4 * v, 0.07); },
  hat: (b, t, v = 1, open) => nz(b, t, 'highpass', 8500, 1, 0.001, 0.11 * v, open ? 0.2 : 0.03),
  ride: (b, t, v = 1) => { nz(b, t, 'bandpass', 6200, 4, 0.001, 0.08 * v, 0.35); osc(b, t, 'square', 3900, 3900, 0.001, 0.012 * v, 0.25); },
  crash: (b, t, v = 1) => nz(b, t, 'highpass', 4800, 0.6, 0.002, 0.3 * v, 1.7),
  china: (b, t, v = 1) => { nz(b, t, 'bandpass', 3500, 1.2, 0.002, 0.3 * v, 0.9); nz(b, t, 'highpass', 7000, 0.5, 0.001, 0.12 * v, 0.6); },
  taiko: (b, t, v = 1, f = 70) => { osc(b, t, 'sine', f * 1.6, f * 0.75, 0.003, 1.0 * v, 0.6); nz(b, t, 'lowpass', 380, 1, 0.002, 0.5 * v, 0.22); },
  tom: (b, t, v = 1, f = 180) => { osc(b, t, 'sine', f * 1.4, f * 0.8, 0.002, 0.6 * v, 0.22); nz(b, t, 'lowpass', 900, 1, 0.001, 0.12 * v, 0.05); },
  // industrial: a metal clank (inharmonic squares) and a gated noise "steam" burst
  clank: (b, t, v = 1) => { for (const f of [523, 1187, 1730]) osc(b, t, 'square', f, f * 0.98, 0.001, 0.05 * v, 0.11, [7000, 1500, 6]); nz(b, t, 'bandpass', 2600, 9, 0.001, 0.3 * v, 0.09); },
  steam: (b, t, v = 1, d = 0.1) => nz(b, t, 'bandpass', 1200, 0.8, 0.002, 0.16 * v, d),
  // distorted guitar: palm-muted chug / open power chord (root + fifth + octave), detuned saws + square into the waveshaper
  chug: (b, t, m, v = 1) => { const g = G(b); for (const [n, det] of [[m, -7], [m, 8], [m + 7, 0]]) { const o = osc(g, t, 'sawtooth', mtof(n), mtof(n), 0.002, 0.16 * v, 0.1, [1800, 260, 2]); o.detune.value = det; } },
  pc: (b, t, m, d, v = 1) => { const g = G(b); for (const [n, det, ty] of [[m, -8, 'sawtooth'], [m, 9, 'sawtooth'], [m + 7, -4, 'sawtooth'], [m + 12, 5, 'square'], [m - 12, 0, 'square']]) { const o = osc(g, t, ty, mtof(n), mtof(n), 0.004, 0.13 * v, d, [4200, 1500, 0.8]); o.detune.value = det; } },
  // screaming lead (saw + vibrato) for melodies / fills
  lead: (b, t, m, d, v = 1) => { const g = G(b); const o = osc(g, t, 'sawtooth', mtof(m), mtof(m), 0.01, 0.07 * v, d, [5000, 2500, 1]); const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 6.2; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.detune); lfo.start(t + d * 0.3); lfo.stop(t + d + 0.1); },
  // growling bass: sub sine + driven square
  bass: (b, t, m, d, v = 1) => { osc(b, t, 'sine', mtof(m - 12), mtof(m - 12), 0.004, 0.42 * v, d); const g = b.bas || b; osc(g, t, 'square', mtof(m), mtof(m), 0.004, 0.14 * v, d, [900, 300, 2]); },
  brass: (b, t, ms, d, v = 1) => { for (const m of ms) for (const det of [-6, 7]) { const o = osc(b, t, 'sawtooth', mtof(m), mtof(m), 0.05, 0.06 * v, d, [700, 2600, 1.2]); o.detune.value = det; } },
  choir: (b, t, ms, d, v = 1) => { for (const m of ms) for (const det of [-9, 0, 10]) { const o = osc(b, t, 'sawtooth', mtof(m), mtof(m), d * 0.3, 0.022 * v, d * 0.75, [1100, 900, 3]); o.detune.value = det; } },
  bell: (b, t, m, v = 1) => { osc(b, t, 'sine', mtof(m), mtof(m), 0.002, 0.16 * v, 0.9); osc(b, t, 'sine', mtof(m) * 2.76, mtof(m) * 2.76, 0.001, 0.05 * v, 0.35); },
  arp: (b, t, m, v = 1) => osc(b, t, 'square', mtof(m), mtof(m), 0.003, 0.045 * v, 0.09, [3200, 700, 3]),
  // v5 Deep Sea: a submarine SONAR ping (with two fading echoes), a WHALE song glide, BUBBLE blips, and a deep sub swell
  sonar: (b, t, m = 86, v = 1) => { for (let k = 0; k < 3; k++) { const tk = t + k * 0.38, a = Math.pow(0.42, k); osc(b, tk, 'sine', mtof(m), mtof(m) * 0.995, 0.004, 0.13 * v * a, 1.3); osc(b, tk, 'sine', mtof(m + 12), mtof(m + 12), 0.002, 0.03 * v * a, 0.35); } },
  whale: (b, t, m, d, v = 1) => { const f = mtof(m); osc(b, t, 'triangle', f, f * 1.5, d * 0.45, 0.07 * v, d * 0.55, [900, 500, 2]); osc(b, t + d * 0.5, 'sine', f * 1.5, f * 0.9, d * 0.2, 0.05 * v, d * 0.5); },
  bubble: (b, t, v = 1) => { const f = 500 + Math.random() * 900; osc(b, t, 'sine', f, f * 2.6, 0.003, 0.05 * v, 0.06); },
  swell: (b, t, m, d, v = 1) => { for (const det of [-10, 10]) { const o = osc(b, t, 'sawtooth', mtof(m), mtof(m), d * 0.4, 0.05 * v, d * 0.6, [300, 700, 1.5]); o.detune.value = det; } },
};

// ---------- riffs (semitone offsets from the bar root; -99 = rest). x = palm-muted chug, O = open power chord ----------
const RIFF_A = [0, 0, 0, 12, 0, 0, 1, 0, 0, 0, 3, 0, 0, 1, 0, -2];    // phrygian gallop
const RIFF_B = [0, -99, 0, 0, 0, -99, 0, 3, 0, -99, 0, 0, 5, 3, 1, 0]; // chromatic chug
const RIFF_C = [0, 0, -99, 0, 0, -99, 0, 0, 7, -99, 6, -99, 5, -99, 3, -99]; // industrial stomp
// a full song bar: drums + riff + chords. o: { root[4], riff, kick: 'half'|'rock'|'gallop'|'double'|'blast'|'tribal', open: steps with power chords, flavour }
function metal(b, t, s, bar, d, o) {
  const R = o.root[bar], rf = (o.riffs ? o.riffs[bar] : o.riff)[s], lay = L(b);
  // drums
  const k = o.kick;
  if (k === 'half') { if (s === 0 || s === 10) I.kick(b, t, 1); if (s === 8) I.snare(b, t, 1.1); }
  else if (k === 'rock') { if (s === 0 || s === 6 || s === 8 || s === 10) I.kick(b, t, 1); if (s === 4 || s === 12) I.snare(b, t, 1); }
  else if (k === 'gallop') { if (s % 4 === 0 || s % 4 === 3) I.kick(b, t, 1); if (s === 4 || s === 12) I.snare(b, t, 1); }
  else if (k === 'double') { if (s % 2 === 0 || (bar % 2 && s % 4 === 3)) I.kick(b, t, 0.95); if (s === 4 || s === 12) I.snare(b, t, 1.1); }
  else if (k === 'blast') { I.kick(b, t, 0.85); if (s % 4 === 2) I.snare(b, t, 0.9); }
  else if (k === 'tribal') { if (s === 0 || s === 3 || s === 8 || s === 11) I.kick(b, t, 1); if (s === 4 || s === 12) I.snare(b, t, 1); if (s === 6 || s === 14) I.taiko(b, t, 0.8, 75); if (s === 2 || s === 10) I.tom(b, t, 0.55, 150); }
  if (o.ride) { if (s % 2 === 0) I.ride(b, t, s % 4 ? 0.6 : 1); } else I.hat(b, t, s % 2 ? 0.45 : 0.8, s % 8 === 6);
  if (s === 0 && bar === 0) { I.crash(b, t, 1); if (o.taiko) I.taiko(b, t, 1, 55); }
  if (s === 0 && bar === 2) I.china(b, t, 0.8);
  if (bar === 3 && s >= 12) I.tom(b, t, 0.85, 240 - (s - 12) * 35); // fill
  // guitars + bass
  if (rf > -99) { const open = o.open && o.open.includes(s); if (open) I.pc(b, t, R + rf + 12, d * 3.5, 1); else I.chug(b, t, R + rf + 12, 1); I.bass(b, t, R + rf, d * (open ? 2 : 0.9), 0.9); }
  if (s === 0 && o.chord) I.pc(b, t, R + 12, d * 7, 0.9);
  // flavour
  if (o.flavour === 'tribal') { if ([2, 5, 7, 13].includes(s)) I.tom(b, t, 0.45, s % 2 ? 210 : 160); if (s === 0) I.taiko(b, t, 0.9, 52); }
  if (o.flavour === 'epic') { if (s === 0) { I.choir(b, t, [R + 24, R + 27, R + 31], d * 16, 1); I.taiko(b, t, 1, 50); } if (s === 8) I.brass(b, t, [R + 12, R + 19, R + 24], d * 7, 0.9); const m = o.mel && o.mel[bar][s]; if (m > 0) I.bell(b, t, m, 0.8); }
  if (o.flavour === 'deep') { if (s === 0 && (bar === 0 || bar === 2)) I.sonar(b, t, o.ping || 86, 1); if (s === 8 && bar === 1) I.whale(b, t, R + 19, d * 14, 1); if (s === 0 && bar === 3) I.swell(b, t, R + 12, d * 16, 1);
    if (s % 2 === 1 && Math.random() < 0.35) I.bubble(b, t, 0.8); if (s === 10 || s === 14) I.taiko(b, t, 0.55, 60); const m = o.mel && o.mel[bar][s]; if (m > 0) I.bell(b, t, m, 0.6); }
  if (o.flavour === 'industrial') { if (s % 4 === 2) I.clank(b, t, 0.9); if (s === 7 || s === 15) I.steam(b, t, 0.8, d * 0.6); I.arp(b, t, R + 24 + [0, 12, 7, 3][s % 4], 0.6); }
  // INTENSITY layer (fades in with the battle): double-kick runs, crash on every bar, a screaming lead
  if (o.layer) { I.kick(lay, t, 0.7); if (s % 4 === 0) I.china(lay, t, 0.25); if (s === 0) I.crash(lay, t, 0.8);
    const lm = o.lead && o.lead[bar][s]; if (lm > 0) I.lead(lay, t, lm, d * 1.8, 1); }
}
const MEL_PEAK = [[76, -1, -1, 77, 76, -1, 74, -1, 71, -1, -1, -1, 72, -1, 71, -1], [77, -1, -1, 79, 77, -1, 76, -1, 72, -1, -1, -1, 74, -1, 72, -1], [76, -1, 79, -1, 83, -1, 81, 79, 77, -1, 76, -1, 74, -1, 76, -1], [74, -1, -1, 72, 71, -1, -1, -1, 69, -1, 71, -1, 72, -1, 74, -1]];
const LEAD_D = [[74, -1, 77, -1, 76, -1, 74, -1, 72, -1, 74, -1, 75, -1, 74, -1], [72, -1, 70, -1, 69, -1, 70, -1, 72, -1, 74, -1, 77, -1, 79, -1], [81, -1, 79, -1, 77, -1, 76, -1, 77, -1, 79, -1, 81, -1, 82, -1], [81, -1, -1, -1, 79, -1, -1, -1, 77, 76, 74, 73, 74, -1, -1, -1]];
const LEAD_E = LEAD_D.map(r => r.map(m => m > 0 ? m + 2 : m)), LEAD_A = LEAD_D.map(r => r.map(m => m > 0 ? m - 5 : m));
const TRACKS = {
  // title: epic half-time metal intro (D minor)
  title: { bpm: 150, fn: (b, t, s, bar, d) => metal(b, t, s, bar, d, { root: [38, 34, 36, 33], riff: [0, -99, -99, -99, -99, -99, -99, -99, 0, -99, -99, 0, -99, -99, 0, -99], open: [0, 8], kick: 'half', taiko: true, flavour: 'epic', mel: MEL_PEAK.map(r => r.map(m => m > 0 ? m - 2 : m)) }) },
  // ---- Jungle Island: TRIBAL METAL ----
  roam: { bpm: 156, fn: (b, t, s, bar, d) => metal(b, t, s, bar, d, { root: [40, 40, 36, 38], riff: RIFF_A, open: [0], kick: 'tribal', taiko: true, flavour: 'tribal' }) },
  battle: { bpm: 166, fn: (b, t, s, bar, d) => metal(b, t, s, bar, d, { root: [40, 41, 38, 36], riff: RIFF_A, open: [0, 8], kick: 'double', taiko: true, flavour: 'tribal', layer: true, lead: LEAD_E }) },
  boss: { bpm: 172, fn: (b, t, s, bar, d) => metal(b, t, s, bar, d, { root: [38, 39, 36, 34], riff: RIFF_B, open: [0, 8], kick: 'blast', taiko: true, flavour: 'tribal', layer: true, lead: LEAD_D, chord: true }) },
  // ---- Dragon Peak: EPIC & DARK (E phrygian) ----
  peak: { bpm: 150, fn: (b, t, s, bar, d) => metal(b, t, s, bar, d, { root: [40, 41, 40, 38], riff: [0, -99, -99, 0, -99, -99, 1, -99, 0, -99, -99, -99, 1, -99, 0, -99], open: [0, 8], kick: 'half', taiko: true, flavour: 'epic', mel: MEL_PEAK }) },
  peakbattle: { bpm: 164, fn: (b, t, s, bar, d) => metal(b, t, s, bar, d, { root: [40, 41, 40, 43], riff: RIFF_A, open: [0, 8], kick: 'gallop', flavour: 'epic', mel: MEL_PEAK, layer: true, lead: LEAD_E }) },
  dragonboss: { bpm: 172, fn: (b, t, s, bar, d) => metal(b, t, s, bar, d, { root: [40, 41, 38, 39], riff: RIFF_B, open: [0, 8], kick: 'blast', taiko: true, flavour: 'epic', mel: MEL_PEAK, layer: true, lead: LEAD_E, chord: true }) },
  // ---- Mega City: INDUSTRIAL ROCK (A minor / phrygian) ----
  city: { bpm: 152, fn: (b, t, s, bar, d) => metal(b, t, s, bar, d, { root: [45, 45, 41, 43], riff: RIFF_C, open: [0, 8], kick: 'rock', ride: true, flavour: 'industrial' }) },
  citybattle: { bpm: 164, fn: (b, t, s, bar, d) => metal(b, t, s, bar, d, { root: [45, 46, 43, 41], riff: RIFF_B, open: [0, 8], kick: 'double', flavour: 'industrial', layer: true, lead: LEAD_A }) },
  // ---- Deep Sea Showdown: DOOM-Y UNDERWATER METAL (C# minor, muffled "under water" guitar cab, sonar, whales, bubbles) ----
  ocean: { bpm: 140, muffle: 1500, fn: (b, t, s, bar, d) => metal(b, t, s, bar, d, { root: [37, 37, 33, 35], riff: [0, -99, -99, 0, -99, -99, 0, -99, 3, -99, 0, -99, -99, 1, -99, -99], open: [0, 8], kick: 'half', flavour: 'deep', ping: 85, mel: MEL_PEAK.map(r => r.map(m => m > 0 ? m - 3 : m)) }) },
  oceanbattle: { bpm: 160, muffle: 2300, fn: (b, t, s, bar, d) => metal(b, t, s, bar, d, { root: [37, 38, 35, 33], riff: RIFF_A, open: [0, 8], kick: 'gallop', flavour: 'deep', ping: 85, layer: true, lead: LEAD_D.map(r => r.map(m => m > 0 ? m - 1 : m)) }) },
  oceanboss: { bpm: 168, muffle: 2800, fn: (b, t, s, bar, d) => metal(b, t, s, bar, d, { root: [37, 38, 36, 34], riff: RIFF_B, open: [0, 8], kick: 'blast', taiko: true, flavour: 'deep', ping: 80, layer: true, lead: LEAD_D.map(r => r.map(m => m > 0 ? m - 1 : m)), chord: true }) },
  cityboss: { bpm: 170, fn: (b, t, s, bar, d) => metal(b, t, s, bar, d, { root: [45, 46, 44, 43], riff: RIFF_A, open: [0, 8], kick: 'blast', flavour: 'industrial', layer: true, lead: LEAD_A, chord: true }) },
};

function curve(k, asym) { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; c[i] = Math.tanh(x * k + asym * x * x) * 0.85; } return c; }
// per-track bus: gain + guitar amp chain (drive → waveshaper → cabinet filters) + bass drive + intensity layer
function trackBus(t, muffle) {
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.6); g.connect(out);
  const pre = ctx.createGain(); pre.gain.value = 1.6; const ws = ctx.createWaveShaper(); ws.curve = DIST; ws.oversample = '2x';
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 95; const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 650; mid.gain.value = -5; mid.Q.value = 0.9;
  const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 2400; pres.gain.value = 3; const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = muffle || 4200; cab.Q.value = 0.8;
  const post = ctx.createGain(); post.gain.value = 0.42; pre.connect(ws); ws.connect(hp); hp.connect(mid); mid.connect(pres); pres.connect(cab); cab.connect(post); post.connect(g); g.gtr = pre;
  const bpre = ctx.createGain(); bpre.gain.value = 1.2; const bws = ctx.createWaveShaper(); bws.curve = DIST2; const blp = ctx.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 1400; const bpost = ctx.createGain(); bpost.gain.value = 0.55;
  bpre.connect(bws); bws.connect(blp); blp.connect(bpost); bpost.connect(g); g.bas = bpre;
  const lay = ctx.createGain(); lay.gain.value = Math.max(0.0001, inten); lay.connect(g); g.lay = lay;
  const lpre = ctx.createGain(); lpre.gain.value = 1.4; const lws = ctx.createWaveShaper(); lws.curve = DIST; const lcab = ctx.createBiquadFilter(); lcab.type = 'lowpass'; lcab.frequency.value = 5000;
  const lpost = ctx.createGain(); lpost.gain.value = 0.35; lpre.connect(lws); lws.connect(lcab); lcab.connect(lpost); lpost.connect(lay); lay.gtr = lpre; // the layer's lead guitar is gated by the intensity
  return g;
}
function startTrack(name, t) {
  const T = TRACKS[name]; if (!T) return;
  const g = trackBus(t, T.muffle);
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
  DIST = curve(9, 0.6); DIST2 = curve(3, 0.2);
  nextT = ctx.currentTime + 0.1; timer = setInterval(tick, 30);
}
onAudioReady(() => ensure());

export const music = {
  play(name) { want = name; ensure(); },
  get track() { return cur ? cur.name : null; },
  get wanted() { return want; },
  get running() { return !!timer && enabled; },
  get intensity() { return inten; },
  setEnabled(on) { enabled = on; if (out && ctx) out.gain.setTargetAtTime(on ? vol : 0, ctx.currentTime, 0.1); if (on && ctx) nextT = ctx.currentTime + 0.05; },
  get enabled() { return enabled; },
  // 0..1: how hard the battle is raging (extra double-kick, cymbals and a screaming lead fade in)
  setIntensity(k) { k = Math.max(0, Math.min(1, k || 0)); if (Math.abs(k - inten) < 0.02) return; inten = k; if (ctx && cur && cur.g.lay) cur.g.lay.gain.setTargetAtTime(Math.max(0.0001, k), ctx.currentTime, 0.6); },
  // a boss arrives: a 1.6 s noise + saw RISER, then a massive HIT (kick + taiko + crash + low power chord)
  bossHit() {
    ensure(); if (!ctx || !enabled) return; this.hits = (this.hits || 0) + 1;
    const b = ctx.createGain(); b.connect(out); setTimeout(() => b.disconnect(), 6000); const t = ctx.currentTime + 0.03, R = 1.6;
    nz(b, t, 'highpass', 200, 1.5, R * 0.95, 0.35, 0.05, 7000);
    const o = osc(b, t, 'sawtooth', 80, 1200, R * 0.95, 0.06, 0.05, [600, 5000, 4]);
    const h = t + R, hb = trackBus(h); setTimeout(() => hb.disconnect(), 6000); hb.gain.cancelScheduledValues(h); hb.gain.setValueAtTime(1, h);
    I.kick(b, h, 1.2); I.taiko(b, h, 1.2, 45); I.crash(b, h, 1.2); I.china(b, h, 0.8); I.pc(hb, h, 40, 1.6, 1.3); I.bass(hb, h, 28, 1.4, 1.2); I.brass(b, h, [52, 59, 64], 1.4, 1.2);
    stingEnd = Math.max(stingEnd, performance.now() + 900);
  },
  // victory fanfare: one-shot power-chord + brass run + crash + taiko, then the loop resumes
  victory() {
    ensure(); if (!ctx || !enabled) return;
    if (cur) { cur.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1); cur = null; }
    const b = trackBus(ctx.currentTime); b.gain.cancelScheduledValues(ctx.currentTime); b.gain.setValueAtTime(1, ctx.currentTime); setTimeout(() => b.disconnect(), 6000); const t = ctx.currentTime + 0.05;
    I.crash(b, t, 1); I.taiko(b, t, 1, 60); [50, 54, 57, 62].forEach((m, i) => { I.pc(b, t + i * 0.16, m, 0.3, 1); I.kick(b, t + i * 0.16, 0.9); });
    I.pc(b, t + 0.7, 50, 1.8, 1.2); I.brass(b, t + 0.7, [62, 66, 69, 74], 1.8, 1.3); I.taiko(b, t + 0.7, 1, 55); I.crash(b, t + 0.7, 0.9); I.kick(b, t + 0.7, 1.1); I.snare(b, t + 0.6, 0.6); I.snare(b, t + 0.65, 0.8);
    I.lead(b, t + 0.7, 86, 1.6, 1.2);
    stingEnd = performance.now() + 3400; this.stings = (this.stings || 0) + 1;
  },
};
