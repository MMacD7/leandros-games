// v5 DEEP SEA SHOWDOWN creatures: shark, megalodon, stingray, octopus, jellyfish (playable) plus the wild anglerfish,
// sea serpent, giant crab and the KRAKEN boss. Built procedurally from a few meshes each. Bodies, tails, tentacles and
// tendrils are CPU-bent TUBES (one geometry per creature part, updated every frame from a swimming spine), so a fish
// really S-curves when it swims and an octopus curls every arm, at only a handful of draw calls per creature.
// Same interface the game uses on Beast / Mech / Pup (obj, height, fitR, mats, meshes, sockets, socketPos, animate, ...).
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0), FWD = V(0, 0, 1);
const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- a bundle of bendable tubes in one BufferGeometry ----------
class Tube {
  constructor(n, sides, count, mat, top, bot) {
    this.n = n; this.s = sides; this.c = count; const nv = n * sides * count;
    this.pos = new Float32Array(nv * 3); this.nor = new Float32Array(nv * 3); const col = new Float32Array(nv * 3), idx = [];
    const T = new THREE.Color(top), B = new THREE.Color(bot ?? top), c = new THREE.Color();
    for (let k = 0; k < count; k++) for (let i = 0; i < n; i++) for (let j = 0; j < sides; j++) {
      const v = (k * n + i) * sides + j, a = j / sides * Math.PI * 2; c.copy(B).lerp(T, sm(-0.35, 0.35, Math.sin(a))); col.set([c.r, c.g, c.b], v * 3);
      if (i < n - 1) { const a0 = v, b0 = (k * n + i) * sides + (j + 1) % sides; idx.push(a0, a0 + sides, b0, b0, a0 + sides, b0 + sides); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.boundingSphere = new THREE.Sphere(V(), 60);
    this.geo = g; this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this._t = V(); this._n = V(); this._b = V();
  }
  // spine: array of n Vector3; rad(i) -> [rx, ry]
  set(k, spine, rad) {
    const { n, s } = this, P = this.pos, Nr = this.nor, T = this._t, N = this._n, B = this._b;
    for (let i = 0; i < n; i++) {
      const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)]; T.subVectors(b, a); if (T.lengthSq() < 1e-10) T.set(0, 0, 1); T.normalize();
      const ref = Math.abs(T.y) > 0.92 ? FWD : UP; N.crossVectors(T, ref).normalize(); B.crossVectors(N, T).normalize();
      const [rx, ry] = rad(i), p = spine[i];
      for (let j = 0; j < s; j++) { const an = j / s * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an), v = ((k * n + i) * s + j) * 3;
        P[v] = p.x + N.x * ca * rx + B.x * sa * ry; P[v + 1] = p.y + N.y * ca * rx + B.y * sa * ry; P[v + 2] = p.z + N.z * ca * rx + B.z * sa * ry;
        const nx = N.x * ca * ry + B.x * sa * rx, ny = N.y * ca * ry + B.y * sa * rx, nz = N.z * ca * ry + B.z * sa * rx, l = Math.hypot(nx, ny, nz) || 1;
        Nr[v] = nx / l; Nr[v + 1] = ny / l; Nr[v + 2] = nz / l; } }
  }
  done() { this.geo.attributes.position.needsUpdate = true; this.geo.attributes.normal.needsUpdate = true; }
}

// ---------- geometry helpers ----------
function fin(w, h, sweep, thick = 0.06) { // a curved fin in the YZ plane, base along z (front at +z), tip up and swept back
  const s = new THREE.Shape(); s.moveTo(w * 0.5, 0); s.quadraticCurveTo(w * 0.2, h * 0.75, -w * 0.5 - sweep, h); s.quadraticCurveTo(-w * 0.35 - sweep * 0.55, h * 0.35, -w * 0.5, 0); s.lineTo(w * 0.5, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 8 }); g.translate(0, 0, -thick / 2); g.rotateY(-Math.PI / 2); return g;
}
function teeth(n, rw, rd, len, z0, down = true, rad = 0.06) { const gs = [];
  for (let k = 0; k < n; k++) { const a = -1.15 + 2.3 * k / (n - 1), c = new THREE.ConeGeometry(rad, len * (1 - Math.abs(a) * 0.25), 5); if (down) c.rotateX(Math.PI); c.translate(Math.sin(a) * rw, down ? -len * 0.45 : len * 0.45, z0 + (Math.cos(a) - 1) * rd); gs.push(c); }
  return mergeGeometries(gs); }
function shade(geo, top, bot, lo = -0.3, hi = 0.3, spots = 0, spotC = 0xffffff) { // counter-shading (+ optional pale spots) as vertex colours
  geo.computeBoundingBox(); const bb = geo.boundingBox, p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3), T = new THREE.Color(top), B = new THREE.Color(bot), S = new THREE.Color(spotC), c = new THREE.Color();
  const cy = (bb.max.y + bb.min.y) / 2, hy = Math.max(1e-4, (bb.max.y - bb.min.y) / 2);
  for (let i = 0; i < n; i++) { const y = (p.getY(i) - cy) / hy; c.copy(B).lerp(T, sm(lo, hi, y));
    if (spots && y > 0) { const x = p.getX(i), z = p.getZ(i), f = Math.sin(x * spots) * Math.sin(z * spots * 1.3) * Math.sin((x + z) * spots * 0.7); if (f > 0.55) c.lerp(S, 0.7); }
    col.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo; }
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05, ...o });

// ---------- the creature ----------
export class SeaBeast {
  constructor(def) {
    this.def = def; this.real = true; this.quad = def.kind === 'crab'; this.flyer = false; this.sea = true; this.wild = false;
    this.obj = new THREE.Group(); this.root = new THREE.Group(); this.root.scale.setScalar(def.scale); this.obj.add(this.root);
    this.pivot = new THREE.Group(); this.root.add(this.pivot);
    this.b = {}; this.sockets = {}; this.meshes = []; this.parts = []; this.phase = Math.random() * 6; this.t = 0; this.flash = 0; this.ko = 0; this.climbS = 0; this.turnS = 0; this.zapK = 0;
    const glowColor = new THREE.Color(def.accent || 0x40e0ff).multiplyScalar(1.6);
    this.skin = std({ vertexColors: true, roughness: def.kind === 'jelly' ? 0.2 : 0.45, emissive: 0x000000 });
    this.glowM = new THREE.MeshStandardMaterial({ color: def.accent, emissive: def.accent, emissiveIntensity: 2.2, roughness: 0.3, toneMapped: false });
    this.dark = std({ color: 0x120a0a, roughness: 0.3 }); this.white = std({ color: 0xf4f0e2, roughness: 0.35 }); this.gum = std({ color: 0x6a1418, roughness: 0.6 });
    this.mats = { plate: this.skin, frame: this.dark, glow: this.glowM, glowColor };
    (BUILD[def.kind] || BUILD.shark)(this, def);
    this.obj.traverse(o => { if (o.isMesh) { o.castShadow = !o.material.transparent; o.receiveShadow = false; this.meshes.push(o); } });
    this.animate(0.016, 0, {}); this.obj.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(this.obj); this.height = Math.max(1.2, bb.max.y); this.fitR = bb.getSize(V()).length() * 0.42;
  }
  add(geo, mat, parent, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || this.pivot).add(m); return m; }
  socket(name, parent, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); this.sockets[name] = o; return o; }
  socketPos(name, out) { const s = this.sockets[name] || this.sockets.mouth; return s.getWorldPosition(out); }
  footPos(i, out) { const f = this.feet && this.feet.length ? this.feet[i % this.feet.length] : this.sockets.mouth; f.getWorldPosition(out); return out; }
  dispose() { }
  animate(dt, speed, o = {}) {
    this.t += dt; this.climbS += ((o.climb || 0) - this.climbS) * Math.min(1, dt * 4); this.turnS += ((o.turn || 0) - this.turnS) * Math.min(1, dt * 5);
    this.zapK = Math.max(0, this.zapK - dt * 2.5);
    this.anim(dt, speed, o);
    this.flash = Math.max(0, this.flash - dt * 4); const f = this.flash; this.skin.emissive.setRGB(f * 0.9, f * 0.3, f * 0.3);
  }
  // ---- spine-driven swimmer (shark, megalodon, angler, serpent) ----
  swimmer(cfg) {
    const S = this; S.cfg = cfg; const n = cfg.segs; S.spine = Array.from({ length: n }, () => V()); S.rad = i => { const t = i / (n - 1), P = cfg.prof; let k = 1; while (k < P.length - 1 && P[k][0] < t) k++; const a = P[k - 1], b = P[k], u = Math.max(0, Math.min(1, (t - a[0]) / Math.max(1e-6, b[0] - a[0]))); return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; };
    S.body = new Tube(n, cfg.sides || 12, 1, S.skin, cfg.top, cfg.belly); S.pivot.add(S.body.mesh); S.pivot.position.y = cfg.yc;
    S.anim = (dt, speed, o) => {
      const run = Math.min(1, speed / 16), L = cfg.L, ch = o.charge || 0;
      S.phase += dt * (cfg.rate || 2) * (1 + run * 2.2 + ch * 2.5); const ph = S.phase, amp = L * (cfg.amp || 0.06) * (0.55 + 0.6 * run + 0.4 * ch);
      const head = Math.sin(ph) * amp * (cfg.headK ?? 0.15), vw = cfg.vwave || 0;
      for (let i = 0; i < n; i++) { const t = i / (n - 1), w = Math.pow(t, cfg.pow || 1.5);
        S.spine[i].set(Math.sin(ph - t * (cfg.waves || 4.2)) * amp * w - head * (1 - t) - S.turnS * t * t * L * 0.22, Math.sin(ph * 0.7 - t * 5) * vw * L * t, L * (0.5 - t)); }
      S.body.set(0, S.spine, S.rad); S.body.done();
      for (const p of S.parts) { const f = p.t * (n - 1), i = Math.min(n - 2, Math.floor(f)), u = f - i, a = S.spine[i], b = S.spine[i + 1]; p.g.position.lerpVectors(a, b, u); p.g.rotation.y = Math.atan2(a.x - b.x, a.z - b.z); }
      S.pivot.rotation.x = -S.climbS * 0.45; S.pivot.rotation.z = -S.turnS * 0.25;
      const open = Math.max(o.bite || 0, (o.jaw || 0) * 0.6, (o.roar || 0) * 0.8); if (S.jaw) S.jaw.rotation.x = (cfg.jaw0 || 0.06) + (cfg.jawOpen || 0.75) * Math.min(1, open);
      if (S.pecs) S.pecs.forEach((p, i) => { p.rotation.x = Math.sin(S.t * 3 + i) * 0.12; });
      if (cfg.extra) cfg.extra(dt, speed, o);
    };
  }
  part(t) { const g = new THREE.Group(); this.pivot.add(g); this.parts.push({ t, g }); return g; }
}

const BUILD = {
  // ---------------- SHARK / MEGALODON ----------------
  shark(S, def) {
    const mega = def.id === 'megalodon' || def.mega, L = 7;
    S.swimmer({ L, segs: 18, sides: 12, yc: 1.6, top: def.back, belly: def.belly, amp: 0.055, rate: 2.2, headK: 0.12,
      prof: [[0, 0.06, 0.06], [0.03, 0.4, 0.32], [0.1, 0.78, 0.7], [0.26, 1.02, 1.08], [0.42, 0.98, 1.04], [0.62, 0.62, 0.66], [0.8, 0.3, 0.34], [0.93, 0.15, 0.2], [1, 0.08, 0.14]] });
    const fm = std({ color: def.back, side: THREE.DoubleSide, roughness: 0.5 });
    // head: eyes, teeth, jaw, mouth, gills
    const H = S.part(0.1), mz = 0.1, my = -0.5;
    for (const s of [-1, 1]) { S.add(new THREE.SphereGeometry(0.11, 10, 8), mega ? S.glowM : S.dark, H, s * 0.62, 0.18, 0.35); }
    if (mega) { const em = new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }); for (const s of [-1, 1]) S.add(new THREE.SphereGeometry(0.05, 6, 5), em, H, s * 0.69, 0.2, 0.38); }
    S.add(new THREE.SphereGeometry(0.55, 14, 10).scale(1, 0.35, 0.9), S.gum, H, 0, my + 0.08, mz - 0.15);
    S.add(teeth(mega ? 15 : 11, 0.5, 0.25, mega ? 0.28 : 0.18, 0.35, true, mega ? 0.07 : 0.05), S.white, H, 0, my + 0.12, mz);
    const jaw = new THREE.Group(); jaw.position.set(0, my + 0.05, mz - 0.55); H.add(jaw); S.jaw = jaw;
    S.add(shade(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.32, 1.15), def.back, def.belly), S.skin, jaw, 0, 0.02, 0.5);
    S.add(teeth(mega ? 13 : 9, 0.42, 0.22, mega ? 0.24 : 0.15, 0.95, false, mega ? 0.065 : 0.045), S.white, jaw, 0, 0.02, 0);
    S.socket('mouth', H, 0, my, mz + 0.4);
    const gills = []; for (const s of [-1, 1]) for (let k = 0; k < 5; k++) { const b = new THREE.BoxGeometry(0.03, 0.42, 0.04); b.rotateZ(s * 0.15); b.translate(s * 0.86, -0.08, -0.65 - k * 0.2); gills.push(b); }
    S.add(mergeGeometries(gills), mega ? S.glowM : S.dark, H);
    // fins
    const D = S.part(0.36); S.add(fin(1.5, mega ? 1.9 : 1.6, 0.7), fm, D, 0, 0.95, 0);
    S.pecs = []; const Pp = S.part(0.3); for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.8, -0.45, 0.1); Pp.add(g); const m = S.add(fin(1.1, 1.7, 0.8), fm, g); m.rotation.z = -s * (Math.PI / 2 - 0.45); S.pecs.push(g); }
    const D2 = S.part(0.72); S.add(fin(0.5, 0.45, 0.2), fm, D2, 0, 0.3, 0); const A2 = S.part(0.74); S.add(fin(0.45, 0.4, 0.2).scale(1, -1, 1), fm, A2, 0, -0.32, 0);
    const T = S.part(0.97); const up = S.add(fin(0.7, 2.0, 0.9), fm, T, 0, 0.05, 0); up.rotation.x = -0.25; const lo = S.add(fin(0.6, 1.3, 0.5).scale(1, -1, 1), fm, T, 0, -0.05, 0); lo.rotation.x = 0.3;
    if (mega) { // battle scars + a glowing ridge
      const sc = []; for (let k = 0; k < 6; k++) { const b = new THREE.BoxGeometry(0.04, 0.05, 0.9); b.rotateZ(0.6); b.rotateY((k % 2 ? 1 : -1) * 0.4); b.translate((k % 2 ? 1 : -1) * 0.95, 0.35 - k * 0.07, 0.2 - k * 0.35); sc.push(b); }
      S.add(mergeGeometries(sc), S.white, S.part(0.32));
      const sp = []; for (let k = 0; k < 5; k++) { const c = new THREE.ConeGeometry(0.09, 0.42, 5); c.rotateX(-0.5); c.translate(0, 1.0, 0.9 - k * 0.32); sp.push(c); } S.add(mergeGeometries(sp), S.glowM, S.part(0.45));
    }
  },
  // ---------------- STINGRAY ----------------
  ray(S, def) {
    S.pivot.position.y = 1.1;
    const half = new THREE.Shape(); half.moveTo(0, 2.0); half.quadraticCurveTo(1.7, 1.5, 2.9, -0.15); half.quadraticCurveTo(1.5, -0.85, 0, -1.45); half.lineTo(0, 2.0);
    const wg = new THREE.ExtrudeGeometry(half, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.14, bevelSegments: 2, curveSegments: 12 }); wg.rotateX(Math.PI / 2); wg.translate(0, 0.08, 0);
    { const p = wg.attributes.position; for (let i = 0; i < p.count; i++) { const x = Math.abs(p.getX(i)); p.setY(i, p.getY(i) * (1 - Math.min(1, x / 3) * 0.75) + 0.25 * (1 - Math.min(1, x / 1.2)) * (p.getY(i) > 0 ? 1 : 0.3)); } wg.computeVertexNormals(); }
    shade(wg, def.back, def.belly, -0.2, 0.2, 5.5, def.spot || 0x9ab8c8);
    const wm = std({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.55 }); S.skin = wm; S.mats.plate = wm;
    S.wings = [1, -1].map(s => { const g = new THREE.Group(); S.pivot.add(g); const m = S.add(s > 0 ? wg : wg.clone().scale(-1, 1, 1), wm, g); return g; });
    S.add(shade(new THREE.SphereGeometry(1, 16, 12).scale(0.55, 0.32, 1.5), def.back, def.belly), wm, S.pivot, 0, 0.1, 0.1);
    for (const s of [-1, 1]) { S.add(new THREE.SphereGeometry(0.12, 8, 6), S.dark, S.pivot, s * 0.32, 0.36, 0.95); S.add(new THREE.SphereGeometry(0.07, 6, 5), S.glowM, S.pivot, s * 0.3, 0.3, 0.6); }
    const dots = []; for (let k = 0; k < 10; k++) { const s = k % 2 ? 1 : -1, r = 0.8 + (k >> 1) * 0.38; dots.push(new THREE.SphereGeometry(0.07, 6, 5).translate(s * r, 0.22 - r * 0.05, 0.3 - (k >> 1) * 0.12)); }
    S.add(mergeGeometries(dots), S.glowM, S.pivot);
    S.socket('mouth', S.pivot, 0, -0.15, 1.3);
    const n = 12; S.tailSp = Array.from({ length: n }, () => V()); S.tail = new Tube(n, 6, 1, std({ vertexColors: true }), def.back, def.belly); S.pivot.add(S.tail.mesh);
    const barb = new THREE.Group(); S.pivot.add(barb); S.add(new THREE.ConeGeometry(0.1, 0.9, 6).rotateX(-Math.PI / 2 - 0.3), S.glowM, barb); S.barb = barb; S.socket('sting', barb, 0, 0, -0.45);
    S.anim = (dt, speed, o) => {
      const run = Math.min(1, speed / 16); S.phase += dt * (1.6 + run * 2.4 + (o.charge || 0) * 3); const ph = S.phase, amp = 0.22 + 0.25 * run + (o.boost ? 0.15 : 0);
      S.wings[0].rotation.z = Math.sin(ph) * amp; S.wings[1].rotation.z = -Math.sin(ph) * amp; S.wings[0].rotation.x = S.wings[1].rotation.x = Math.sin(ph - 1) * 0.05;
      for (let i = 0; i < n; i++) { const t = i / (n - 1); S.tailSp[i].set(Math.sin(ph * 0.8 - t * 4) * 0.35 * t - S.turnS * t * t * 1.5, Math.sin(ph - t * 3) * 0.15 * t + (o.whip || 0) * t * t * 2.5, -1.3 - t * 4.8); }
      S.tail.set(0, S.tailSp, i => { const r = 0.17 * (1 - i / n) + 0.025; return [r, r * 0.8]; }); S.tail.done();
      const a = S.tailSp[4], b = S.tailSp[5]; S.barb.position.copy(a); S.barb.rotation.y = Math.atan2(a.x - b.x, a.z - b.z) + Math.PI; S.barb.position.y += 0.12;
      S.pivot.rotation.x = -S.climbS * 0.4; S.pivot.rotation.z = -S.turnS * 0.35 + Math.sin(ph * 0.5) * 0.04;
      S.glowM.emissiveIntensity = 2.2 + S.zapK * 4 + (o.roar || 0) * 2;
    };
  },
  // ---------------- OCTOPUS / KRAKEN ----------------
  octo(S, def) {
    const K = def.kind === 'kraken', TL = K ? 5.2 : 3.4, n = K ? 14 : 11, R0 = K ? 0.48 : 0.3;
    S.pivot.position.y = TL * 0.72;
    const mantle = new THREE.Group(); mantle.position.set(0, 1.25, -0.35); mantle.rotation.x = -0.55; S.pivot.add(mantle); S.mantle = mantle;
    const mg = new THREE.SphereGeometry(1, 28, 20); { const p = mg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = 1 + 0.05 * Math.sin(x * 9) * Math.sin(y * 8 + z * 5); p.setXYZ(i, x * 1.15 * f, y * 1.5 * f, z * 1.3 * f); } mg.computeVertexNormals(); }
    S.add(shade(mg, def.back, def.belly, -0.6, 0.4, K ? 0 : 6, def.spot || 0xff9a7a), S.skin, mantle);
    S.add(shade(new THREE.SphereGeometry(0.95, 22, 16), def.back, def.belly, -0.8, 0.5), S.skin, S.pivot, 0, 0.3, 0.2);
    const em = K ? new THREE.MeshBasicMaterial({ color: 0xffd23a, toneMapped: false }) : std({ color: 0xffe08a, roughness: 0.2 });
    for (const s of [-1, 1]) { S.add(new THREE.SphereGeometry(0.27, 14, 10), em, S.pivot, s * 0.62, 0.55, 0.62); S.add(new THREE.BoxGeometry(0.2, 0.06, 0.06), S.dark, S.pivot, s * 0.66, 0.55, 0.88); S.add(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, 1.0), S.skin, S.pivot, s * 0.62, 0.6, 0.6).rotation.x = -0.3; }
    S.add(new THREE.ConeGeometry(0.17, 0.4, 6).rotateX(Math.PI), S.dark, S.pivot, 0, -0.42, 0.35); S.socket('mouth', S.pivot, 0, -0.3, 0.9); S.socket('ink', mantle, 0, -0.6, -0.9);
    if (K) { const sp = []; for (let k = 0; k < 14; k++) { const a = k / 14 * 6.28, c = new THREE.ConeGeometry(0.12, 0.6, 5); c.translate(0, 0.3, 0); c.rotateZ(Math.cos(a) * 0.9); c.rotateX(Math.sin(a) * 0.9); c.translate(Math.sin(a * 0.5) * 0.2, 1.3, 0); sp.push(c); } S.add(mergeGeometries(sp), S.glowM, mantle).scale.set(1.1, 1, 1.2); }
    S.arms = new Tube(n, 8, 8, S.skin, def.back, def.belly); S.pivot.add(S.arms.mesh); S.spines = Array.from({ length: 8 }, () => Array.from({ length: n }, () => V()));
    const base = V(), out = V(), dir = V(), side = V(), back = V(0, 0, -1), dn = V(0, -1, 0);
    S.feet = []; for (let k = 0; k < 8; k++) { const f = new THREE.Object3D(); S.pivot.add(f); S.feet.push(f); }
    S.anim = (dt, speed, o) => {
      const run = Math.min(1, speed / 12), ph = (S.phase += dt * (1.4 + run * 1.5)), grab = Math.max(o.bite || 0, o.charge || 0, S.grabK || 0), ink = o.roar || 0;
      S.mantle.scale.set(1 - 0.08 * Math.sin(ph * 2) * (0.4 + run), 1 + 0.06 * Math.sin(ph * 2), 1); S.mantle.rotation.x = -0.55 - run * 0.5;
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; out.set(Math.sin(a), 0, Math.cos(a)); base.set(out.x * 0.5, -0.2, out.z * 0.5 + 0.15); side.set(out.z, 0, -out.x);
        const front = out.z > 0.3, sp = S.spines[k], len = TL / (n - 1); let ang = 0.35 - run * 0.25; sp[0].copy(base);
        const pl = V().copy(out).lerp(back, run * 0.8).normalize(); const reach = front ? grab : 0;
        for (let i = 1; i < n; i++) { const t = i / (n - 1); ang += 0.13 + Math.sin(ph + k * 0.9 + t * 3) * 0.12 + (1 - run) * 0.05 - reach * 0.22;
          dir.copy(pl).multiplyScalar(Math.cos(ang)).addScaledVector(dn, Math.sin(ang) * (1 - reach * 0.8)).addScaledVector(side, Math.sin(ph * 1.3 + k + t * 4) * 0.25 * t).addScaledVector(FWD, reach * 1.2).normalize();
          sp[i].copy(sp[i - 1]).addScaledVector(dir, len * (1 + reach * 0.5)); }
        S.feet[k].position.copy(sp[n - 1]);
        S.arms.set(k, sp, i => { const r = R0 * Math.pow(1 - i / n, 1.1) + 0.03; return [r, r]; }); }
      S.arms.done(); S.pivot.rotation.x = -S.climbS * 0.3 + run * 0.25; S.pivot.rotation.z = -S.turnS * 0.2;
      S.glowM.emissiveIntensity = 2 + ink * 3 + S.zapK * 3;
    };
  },
  // ---------------- JELLYFISH ----------------
  jelly(S, def) {
    S.pivot.position.y = 6.2;
    const bellG = new THREE.SphereGeometry(1.8, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2 + 0.15); { const p = bellG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), rim = 1 - Math.min(1, Math.max(0, y) / 0.9), a = Math.atan2(z, x), f = 1 + 0.06 * Math.sin(a * 16) * rim; p.setXYZ(i, x * f, y * 1.05, z * f); } bellG.computeVertexNormals(); }
    const c = new THREE.Color(def.accent), bm = new THREE.MeshStandardMaterial({ color: c.clone().lerp(new THREE.Color(0xffffff), 0.45), emissive: c, emissiveIntensity: 0.55, transparent: true, opacity: 0.62, roughness: 0.15, side: THREE.DoubleSide, depthWrite: false });
    S.skin = bm; S.mats.plate = bm; S.bell = S.add(bellG, bm, S.pivot);
    const core = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.3), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); S.coreM = core;
    S.add(new THREE.SphereGeometry(0.95, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), core, S.bell, 0, 0.1, 0);
    const lobes = []; for (let k = 0; k < 4; k++) { const a = k / 4 * 6.28; lobes.push(new THREE.TorusGeometry(0.28, 0.07, 6, 12).rotateX(Math.PI / 2).translate(Math.cos(a) * 0.45, 0.55, Math.sin(a) * 0.45)); } S.add(mergeGeometries(lobes), S.glowM, S.bell);
    const rim = []; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.28; rim.push(new THREE.SphereGeometry(0.07, 6, 4).translate(Math.cos(a) * 1.85, -0.25, Math.sin(a) * 1.85)); } S.add(mergeGeometries(rim), S.glowM, S.bell);
    S.socket('mouth', S.pivot, 0, -0.6, 0.6); S.socket('core', S.pivot, 0, 0.2, 0);
    const nA = 12, nT = 12, TT = 14;
    S.oral = new Tube(nA, 7, 4, std({ color: c.clone().lerp(new THREE.Color(0xffffff), 0.3), emissive: c, emissiveIntensity: 0.4, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }), 0xffffff); S.oral.mesh.material.vertexColors = false; S.pivot.add(S.oral.mesh);
    S.tm = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.5), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    S.tend = new Tube(nT, 3, TT, S.tm, 0xffffff); S.pivot.add(S.tend.mesh);
    const spO = Array.from({ length: 4 }, () => Array.from({ length: nA }, () => V())), spT = Array.from({ length: TT }, () => Array.from({ length: nT }, () => V()));
    S.anim = (dt, speed, o) => {
      const run = Math.min(1, speed / 10), ph = (S.phase += dt * (2.4 + run * 2)), pulse = Math.sin(ph), zap = Math.max(S.zapK, o.roar || 0, o.whip ? Math.abs(o.whip) : 0);
      S.bell.scale.set(1 + 0.1 * pulse, 1 - 0.13 * pulse, 1 + 0.1 * pulse);
      for (let k = 0; k < 4; k++) { const a = k / 4 * 6.28 + 0.4, sp = spO[k]; for (let i = 0; i < nA; i++) { const t = i / (nA - 1); sp[i].set(Math.cos(a) * (0.3 + 0.15 * t) + Math.sin(ph - t * 5 + k) * 0.35 * t, -0.3 - t * 4.2, Math.sin(a) * (0.3 + 0.15 * t) + Math.cos(ph * 0.8 - t * 4 + k) * 0.35 * t - run * t * t * 1.5); } S.oral.set(k, sp, i => { const r = 0.24 * (1 - i / nA * 0.7) * (1 + 0.35 * Math.sin(i * 2.5)); return [r, r * 0.35]; }); }
      S.oral.done();
      const spread = (o.whip ? 1 : 0) * 0.8 + zap * 0.4;
      for (let k = 0; k < TT; k++) { const a = k / TT * 6.28, sp = spT[k], R = 1.65 * (1 + 0.1 * pulse); for (let i = 0; i < nT; i++) { const t = i / (nT - 1), rr = R + spread * t * 3; sp[i].set(Math.cos(a) * rr + Math.sin(ph * 1.2 - t * 6 + k) * 0.3 * t, -0.2 - t * 6.5 * (1 - spread * 0.25), Math.sin(a) * rr + Math.cos(ph - t * 5 + k * 1.3) * 0.3 * t - run * t * t * 2.5); } S.tend.set(k, sp, () => [0.045, 0.045]); }
      S.tend.done();
      S.tm.opacity = 0.6 + zap * 0.4; S.tm.color.setRGB(...new THREE.Color(def.accent).multiplyScalar(1.4 + zap * 2.5).toArray()); S.coreM.opacity = 0.45 + 0.25 * pulse * pulse + zap * 0.4;
      S.glowM.emissiveIntensity = 2.2 + zap * 4; S.pivot.rotation.x = -S.climbS * 0.25 + run * 0.35; S.pivot.rotation.z = -S.turnS * 0.15;
    };
  },
  // ---------------- ANGLERFISH (wild) ----------------
  angler(S, def) {
    S.swimmer({ L: 4.6, segs: 14, sides: 12, yc: 1.6, top: def.back, belly: def.belly, amp: 0.06, rate: 2.6, headK: 0.05, jawOpen: 0.95, jaw0: 0.25, pow: 2,
      prof: [[0, 0.7, 0.75], [0.06, 1.2, 1.25], [0.28, 1.3, 1.35], [0.52, 0.95, 1.0], [0.78, 0.38, 0.42], [1, 0.12, 0.16]] });
    const fm = std({ color: def.back, side: THREE.DoubleSide });
    const H = S.part(0.04);
    for (const s of [-1, 1]) S.add(new THREE.SphereGeometry(0.13, 8, 6), S.glowM, H, s * 0.9, 0.5, -0.1);
    S.add(teeth(13, 0.75, 0.3, 0.55, 0.2, true, 0.05), S.white, H, 0, -0.1, 0.1);
    const jaw = new THREE.Group(); jaw.position.set(0, -0.35, -0.7); H.add(jaw); S.jaw = jaw;
    S.add(shade(new THREE.SphereGeometry(0.9, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.05, 0.55, 1.15), def.back, def.belly), S.skin, jaw, 0, 0.05, 0.75);
    S.add(teeth(13, 0.8, 0.32, 0.6, 1.55, false, 0.05), S.white, jaw, 0, 0.05, 0);
    S.add(new THREE.SphereGeometry(0.7, 12, 8).scale(1.1, 0.5, 1), S.gum, H, 0, -0.3, -0.1);
    S.socket('mouth', H, 0, -0.3, 0.6);
    const stalk = []; for (let k = 0; k < 6; k++) { const t = k / 5; stalk.push(new THREE.SphereGeometry(0.06, 5, 4).translate(0, 1.2 + Math.sin(t * 2.4) * 1.1, 0.2 + t * 1.5)); } S.add(mergeGeometries(stalk), S.dark, H);
    const lure = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.accent).multiplyScalar(2), toneMapped: false }); S.lure = S.add(new THREE.SphereGeometry(0.22, 12, 8), lure, H, 0, 1.5, 1.75); S.socket('lure', H, 0, 1.5, 1.75);
    const D = S.part(0.45); S.add(fin(1.0, 0.8, 0.4), fm, D, 0, 1.2, 0);
    const T = S.part(0.98); S.add(fin(0.6, 1.0, 0.4), fm, T, 0, 0, 0).rotation.x = -1.2; S.add(fin(0.6, 1.0, 0.4).scale(1, -1, 1), fm, T).rotation.x = 1.2;
    S.pecs = []; const Pp = S.part(0.35); for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 1.1, -0.2, 0); Pp.add(g); S.add(fin(0.6, 0.8, 0.3), fm, g).rotation.z = -s * 1.2; S.pecs.push(g); }
    S.cfg.extra = () => { S.lure.scale.setScalar(1 + 0.25 * Math.sin(S.t * 5) + (S.zapK || 0) * 1.5); };
  },
  // ---------------- SEA SERPENT (wild) ----------------
  serpent(S, def) {
    S.swimmer({ L: 17, segs: 34, sides: 10, yc: 1.4, top: def.back, belly: def.belly, amp: 0.05, rate: 2.0, headK: 0.1, waves: 7, pow: 0.7, vwave: 0.012, jawOpen: 0.85,
      prof: [[0, 0.22, 0.2], [0.02, 0.62, 0.5], [0.055, 0.72, 0.62], [0.09, 0.5, 0.5], [0.2, 0.78, 0.8], [0.5, 0.72, 0.74], [0.85, 0.3, 0.32], [1, 0.06, 0.08]] });
    const H = S.part(0.035);
    for (const s of [-1, 1]) { S.add(new THREE.SphereGeometry(0.11, 8, 6), S.glowM, H, s * 0.52, 0.28, 0.15); S.add(new THREE.ConeGeometry(0.1, 0.9, 6).rotateX(-1.1), S.white, H, s * 0.35, 0.55, -0.35).rotation.z = -s * 0.4; }
    S.add(teeth(9, 0.38, 0.2, 0.2, 0.55, true, 0.04), S.white, H, 0, -0.15, 0);
    const jaw = new THREE.Group(); jaw.position.set(0, -0.25, -0.2); H.add(jaw); S.jaw = jaw;
    S.add(shade(new THREE.SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.4, 1.7), def.back, def.belly), S.skin, jaw, 0, 0.04, 0.45);
    S.add(teeth(9, 0.34, 0.18, 0.18, 1.1, false, 0.035), S.white, jaw, 0, 0.04, 0);
    S.socket('mouth', H, 0, -0.2, 0.9);
    const fm = std({ color: def.accent, emissive: def.accent, emissiveIntensity: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    for (const s of [-1, 1]) S.add(fin(0.8, 1.1, 0.4), fm, H, s * 0.5, 0.1, -0.5).rotation.z = -s * 1.1;
    for (let k = 0; k < 12; k++) { const g = S.part(0.12 + k * 0.065); S.add(new THREE.ConeGeometry(0.13, 0.75 * (1 - k * 0.05), 5).rotateX(-0.45), S.glowM, g, 0, 0.72 * (1 - k * 0.045), 0); }
    const T = S.part(0.99); S.add(fin(0.5, 1.2, 0.5), fm, T).rotation.x = -1.3; S.add(fin(0.5, 1.2, 0.5).scale(1, -1, 1), fm, T).rotation.x = 1.3;
  },
  // ---------------- GIANT CRAB (wild, walks on the sea floor) ----------------
  crab(S, def) {
    S.pivot.position.y = 1.6;
    const shell = new THREE.SphereGeometry(1, 24, 14); { const p = shell.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x * 2.1, y * (y > 0 ? 0.85 : 0.45), z * 1.55 * (1 - 0.15 * Math.max(0, -z))); } shell.computeVertexNormals(); }
    S.body = S.add(shade(shell, def.back, def.belly, -0.2, 0.3, 4, 0xffc070), S.skin, S.pivot);
    const sp = []; for (let k = 0; k < 9; k++) { const a = -1 + k / 4; sp.push(new THREE.ConeGeometry(0.12, 0.4, 5).rotateX(0.5).translate(a * 1.3, 0.62 - Math.abs(a) * 0.15, 0.9 + Math.abs(a) * -0.25)); } S.add(mergeGeometries(sp), S.white, S.pivot);
    for (const s of [-1, 1]) { S.add(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 6), S.skin, S.pivot, s * 0.4, 0.75, 1.2).rotation.x = 0.3; S.add(new THREE.SphereGeometry(0.15, 10, 8), S.dark, S.pivot, s * 0.4, 1.08, 1.3); }
    S.socket('mouth', S.pivot, 0, -0.1, 1.6);
    const lm = std({ color: def.back, roughness: 0.5 });
    S.legs = []; S.feet = [];
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const g = new THREE.Group(); g.position.set(s * 1.7, 0, 0.6 - k * 0.55); g.rotation.y = s * (Math.PI / 2) + (k - 1.5) * 0.25 * s; S.pivot.add(g);
      const up = S.add(new THREE.CylinderGeometry(0.1, 0.13, 1.4, 6).rotateZ(Math.PI / 2).translate(0, 0, 0), lm, g); up.rotation.z = 0; up.geometry.translate(0, 0, 0);
      const seg1 = new THREE.Group(); g.add(seg1); seg1.rotation.x = -0.6; S.add(new THREE.CylinderGeometry(0.11, 0.13, 1.4, 6).rotateX(Math.PI / 2).translate(0, 0, 0.7), lm, seg1);
      const knee = new THREE.Group(); knee.position.z = 1.4; seg1.add(knee); knee.rotation.x = 1.6; S.add(new THREE.ConeGeometry(0.1, 1.7, 6).rotateX(Math.PI / 2).translate(0, 0, 0.85), lm, knee);
      const foot = new THREE.Object3D(); foot.position.z = 1.7; knee.add(foot); S.feet.push(foot); S.legs.push({ g: seg1, k, s }); up.visible = false; }
    S.claws = [];
    for (const s of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(s * 1.4, 0.1, 1.1); arm.rotation.y = s * 0.5; S.pivot.add(arm);
      S.add(new THREE.CylinderGeometry(0.16, 0.2, 1.2, 8).rotateX(Math.PI / 2).translate(0, 0, 0.6), lm, arm);
      const hand = new THREE.Group(); hand.position.z = 1.2; arm.add(hand); hand.rotation.y = -s * 0.7;
      S.add(shade(new THREE.SphereGeometry(0.55, 14, 10).scale(0.8, 0.65, 1.3), def.back, def.belly), S.skin, hand, 0, 0, 0.5);
      S.add(new THREE.ConeGeometry(0.2, 1.1, 8).rotateX(Math.PI / 2).translate(0, -0.12, 1.4), lm, hand);
      const fing = new THREE.Group(); fing.position.set(0, 0.15, 0.85); hand.add(fing); S.add(new THREE.ConeGeometry(0.17, 1.0, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5), lm, fing);
      S.claws.push({ arm, fing }); }
    S.anim = (dt, speed, o) => {
      const run = Math.min(1, speed / 9); S.phase += dt * speed * 0.9; const ph = S.phase;
      for (const L of S.legs) { const a = ph * 2 + L.k * 1.6 + (L.s > 0 ? Math.PI : 0); L.g.rotation.x = -0.6 + Math.sin(a) * 0.35 * run; L.g.rotation.y = Math.cos(a) * 0.3 * run; }
      const pinch = Math.max(o.bite || 0, o.jaw ? 0.6 : 0, o.roar || 0); S.claws.forEach((c, i) => { c.fing.rotation.x = -0.15 - 0.55 * Math.abs(Math.sin(S.t * (pinch > 0.1 ? 14 : 2) + i)) * (0.3 + pinch); c.arm.rotation.x = -pinch * 0.6 - (o.roar || 0) * 0.5; });
      S.pivot.position.y = 1.6 + Math.abs(Math.sin(ph * 2)) * 0.08 * run; S.pivot.rotation.z = Math.sin(ph * 2) * 0.04 * run;
    };
  },
};
BUILD.kraken = BUILD.octo;
BUILD.mega = BUILD.shark;
// ---------------- v5.5 SEA TURTLE (playable + friendly ambient turtles) ----------------
// a domed shell made of plates (scutes), a pale belly plate, a beaked head on a short neck and four paddling flippers
BUILD.turtle = (S, def) => {
  S.pivot.position.y = 1.2; const shellC = new THREE.Color(def.shell || 0x6a4a22), plateC = new THREE.Color(def.back), rimC = new THREE.Color(def.rim || 0xc89a4a);
  const dome = new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.55, 0.78, 1.85);
  { const p = dome.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), rim = y < 0.12;
      const cell = Math.floor((z + 2) / 0.95) * 7 + Math.floor((x + 2 + (Math.floor((z + 2) / 0.95) % 2) * 0.45) / 0.9), e = Math.abs(Math.sin(z * 3.3)) < 0.18 || Math.abs(Math.sin(x * 3.5 + Math.floor((z + 2) / 0.95))) < 0.15;
      c.copy(rim ? rimC : e ? shellC : plateC.clone().offsetHSL(0, 0, ((cell * 37) % 7 - 3) * 0.012)); col.set([c.r, c.g, c.b], i * 3); } dome.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  S.add(dome, S.skin, S.pivot, 0, 0, 0);
  S.add(shade(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.45, 0.3, 1.75), def.belly, def.belly), S.skin, S.pivot, 0, 0.02, 0); // plastron
  const sk = std({ color: def.skin || 0x6a8a5a, roughness: 0.55 }); S.flesh = sk;
  // head + beak + eyes on a short neck (the neck stretches out for a bite)
  const head = new THREE.Group(); head.position.set(0, 0.15, 1.85); S.pivot.add(head); S.head = head;
  S.add(new THREE.CylinderGeometry(0.32, 0.38, 0.6, 10).rotateX(Math.PI / 2), sk, head, 0, 0, -0.1);
  S.add(new THREE.SphereGeometry(0.45, 14, 10).scale(1, 0.85, 1.15), sk, head, 0, 0.08, 0.35);
  S.add(new THREE.ConeGeometry(0.2, 0.32, 8).rotateX(Math.PI / 2).scale(1.2, 0.8, 1), std({ color: 0xd8c070, roughness: 0.4 }), head, 0, -0.02, 0.82);
  for (const s of [-1, 1]) { S.add(new THREE.SphereGeometry(0.12, 10, 8), S.white, head, s * 0.3, 0.2, 0.58); S.add(new THREE.SphereGeometry(0.07, 8, 6), S.dark, head, s * 0.34, 0.22, 0.66); }
  S.socket('mouth', head, 0, -0.05, 0.95);
  // flippers: long front paddles, short back ones
  S.flips = []; for (const [sx, z, L, front] of [[-1, 0.95, 1.9, 1], [1, 0.95, 1.9, 1], [-1, -1.2, 0.95, 0], [1, -1.2, 0.95, 0]]) {
    const g = new THREE.Group(); g.position.set(sx * 1.25, 0.02, z); S.pivot.add(g); const m = S.add(new THREE.SphereGeometry(1, 12, 8).scale(L * 0.5, 0.08, front ? 0.36 : 0.32), sk, g, sx * L * 0.45, 0, front ? -0.15 : 0); m.rotation.y = sx * (front ? -0.35 : 0.5); S.flips.push({ g, sx, front }); }
  S.add(new THREE.ConeGeometry(0.16, 0.5, 6).rotateX(-Math.PI / 2), sk, S.pivot, 0, 0, -1.95); // little tail
  // SHELL SHIELD bubble (shown while the shield is up)
  S.bubble = S.add(new THREE.SphereGeometry(2.6, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(def.accent || 0x6aff9a), transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }), S.pivot, 0, 0.3, 0); S.bubble.visible = false;
  S.spinT = 0; S.shieldK = 0;
  S.anim = (dt, speed, o) => { const run = Math.min(1, speed / 14); S.phase += dt * (1.4 + run * 2.6 + (o.charge || 0) * 2); const ph = S.phase;
    for (const f of S.flips) { const a = f.front ? Math.sin(ph) * (0.45 + 0.35 * run) : Math.sin(ph + 1.2) * 0.3; f.g.rotation.z = f.sx * a; f.g.rotation.y = f.sx * (f.front ? Math.cos(ph) * 0.35 : 0); }
    S.head.position.z = 1.85 + Math.min(1, Math.max(o.bite || 0, (o.jaw || 0) * 0.5)) * 0.45; S.head.rotation.y = Math.sin(S.t * 0.8) * 0.12;
    S.spinT = Math.max(0, S.spinT - dt); S.pivot.rotation.y = S.spinT > 0 ? S.pivot.rotation.y + dt * 22 : S.pivot.rotation.y * Math.max(0, 1 - dt * 10);
    S.pivot.rotation.x = -S.climbS * 0.35 + Math.sin(ph * 0.5) * 0.03; S.pivot.rotation.z = -S.turnS * 0.3;
    S.bubble.visible = S.shieldK > 0; if (S.bubble.visible) { S.bubble.scale.setScalar(1 + Math.sin(S.t * 9) * 0.05); S.bubble.material.opacity = 0.16 + 0.1 * Math.sin(S.t * 6) ** 2; } };
};
