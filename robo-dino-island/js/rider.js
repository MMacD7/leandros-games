// "Leandro rides": a chunky, cartoony, procedural low-poly kid rider who sits in a saddle (real dinos) or a
// cockpit seat (robots). The seat is found automatically for every dino by ray-casting the body in its rest pose.
import * as THREE from './vendor/three.bundle.min.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// where along the body the seat goes: t = 0 at the hips, 1 at the chest, >1 toward the neck (in front of sails/plates)
const SEATS = {
  rex: { t: 0.42 }, raptor: { t: 0.5 }, tri: { t: 0.32 }, stego: { t: 1.4 }, ptero: { t: 0.55, up: 0.05 }, spino: { t: 1.02, pct: 0.45 }, ankylo: { t: 0.5 }, bronto: { t: 1.12 },
  giga: { t: 0.45 }, allo: { t: 0.48 }, dilo: { t: 0.5 }, pachy: { t: 0.5 }, para: { t: 0.4 }, dragon: { t: 1.18 }, gmech: { t: 0.42 }, dblast: { t: 0.5 }, rdragon: { t: 0.5 },
  trex: { t: 0.45 }, carno: { t: 0.45 }, velo: { t: 0.5 }, spinos: { t: 1.05 }, trice: { t: 0.32 }, ankys: { t: 0.5 }, stegos: { t: 1.45 }, brachio: { t: 1.12 },
};
const seatCache = new Map();
const ray = new THREE.Raycaster();

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function bone(g, x, y, r) { // cartoon bone: shaft + knobby ends
  g.save(); g.translate(x, y); g.rotate(r); g.fillStyle = '#ece6d6'; g.strokeStyle = '#3a3430'; g.lineWidth = 5;
  g.beginPath(); g.rect(-62, -10, 124, 20); g.fill(); g.stroke();
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { g.beginPath(); g.arc(sx * 66, sy * 12, 15, 0, 7); g.fill(); g.stroke(); }
  g.fillRect(-60, -8, 120, 16); g.restore();
}
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const shirtT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#f4f3ee'; g.fillRect(0, 0, w, h); bone(g, 128, 150, 0.6); bone(g, 128, 150, -0.6);
    g.fillStyle = '#ece6d6'; g.strokeStyle = '#3a3430'; g.lineWidth = 5; g.beginPath(); g.arc(128, 82, 34, 0, 7); g.fill(); g.stroke(); g.fillRect(108, 96, 40, 26); g.strokeRect(108, 96, 40, 26);
    g.fillStyle = '#3a3430'; g.beginPath(); g.arc(115, 80, 9, 0, 7); g.arc(141, 80, 9, 0, 7); g.fill(); g.fillRect(126, 92, 4, 8); for (let i = 0; i < 3; i++) g.fillRect(114 + i * 11, 108, 3, 12); });
  const strapT = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#1b2430'; g.fillRect(0, 0, w, h);
    const cols = ['#6fd26a', '#ffb347', '#7ad3ff']; for (let i = 0; i < 6; i++) { g.fillStyle = cols[i % 3]; const y = 10 + i * 20, x = i % 2 ? 36 : 18; g.beginPath(); g.ellipse(x, y, 9, 5, 0, 0, 7); g.fill(); g.fillRect(x + 5, y - 9, 4, 8); g.fillRect(x - 12, y, 6, 3); } });
  strapT.wrapS = strapT.wrapT = THREE.RepeatWrapping;
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0, ...o });
  MATS = {
    skin: M(0xb07d55, { roughness: 0.6 }), hair: M(0x2b1b12, { roughness: 0.9 }), shirt: M(0xffffff, { map: shirtT, roughness: 0.85 }), shirtPlain: M(0xf4f3ee, { roughness: 0.85 }),
    shorts: M(0x9a8862), pack: M(0x1ea5aa, { roughness: 0.55 }), strap: M(0xffffff, { map: strapT }), shoe: M(0xe9eef2, { roughness: 0.5 }), sole: M(0x2a3138), sock: M(0xf6f6f6),
    eye: M(0x15100c, { roughness: 0.2 }), white: new THREE.MeshBasicMaterial({ color: 0xffffff }), mouth: M(0x6a1f1f, { roughness: 0.6 }), cheek: M(0xe08f80, { roughness: 0.7, transparent: true, opacity: 0.55 }),
    saddle: M(0x7a4524, { roughness: 0.7 }), saddleTrim: M(0xd9a55a, { metalness: 0.6, roughness: 0.35 }),
    seat: M(0x2a2f36, { metalness: 0.7, roughness: 0.35 }), seatGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.6, 2.0), toneMapped: false }),
  };
  return MATS;
}

export class Rider {
  constructor() {
    const m = mats(), add = (p, geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
    const cap = (r, l, s = 8) => new THREE.CapsuleGeometry(r, l, 3, s);
    this.obj = new THREE.Group(); this.obj.name = 'leandro';
    const root = this.root = new THREE.Group(); this.obj.add(root);
    // saddle / cockpit seat (built on mount, sized to the dino)
    this.seatGroup = new THREE.Group(); this.obj.add(this.seatGroup);
    // hips + shorts
    const hips = this.hips = new THREE.Group(); hips.position.y = 0.13; root.add(hips);
    add(hips, new THREE.BoxGeometry(0.4, 0.2, 0.28, 1, 1, 1), m.shorts, 0, 0, 0);
    // legs (built pointing down from the hip pivot)
    this.legs = [];
    for (const s of [-1, 1]) { const hip = new THREE.Group(); hip.position.set(s * 0.11, 0, 0.02); hips.add(hip);
      add(hip, cap(0.085, 0.16), m.shorts, 0, -0.12, 0); const knee = new THREE.Group(); knee.position.y = -0.3; hip.add(knee);
      add(knee, cap(0.06, 0.16), m.skin, 0, -0.12, 0); add(knee, new THREE.CylinderGeometry(0.064, 0.064, 0.07, 10), m.sock, 0, -0.27, 0);
      const foot = new THREE.Group(); foot.position.y = -0.31; knee.add(foot); add(foot, new THREE.BoxGeometry(0.13, 0.09, 0.24), m.shoe, 0, -0.03, 0.05); add(foot, new THREE.BoxGeometry(0.135, 0.035, 0.25), m.sole, 0, -0.08, 0.05);
      add(foot, new THREE.BoxGeometry(0.1, 0.02, 0.06), m.sole, 0, 0.005, 0.12);
      this.legs.push({ hip, knee, foot, s }); }
    // torso
    const torso = this.torso = new THREE.Group(); torso.position.y = 0.1; hips.add(torso);
    add(torso, new THREE.BoxGeometry(0.42, 0.42, 0.26), [m.shirtPlain, m.shirtPlain, m.shirtPlain, m.shirtPlain, m.shirt, m.shirtPlain], 0, 0.22, 0);
    add(torso, new THREE.BoxGeometry(0.34, 0.38, 0.16), m.pack, 0, 0.24, -0.2); add(torso, new THREE.BoxGeometry(0.26, 0.16, 0.06), m.pack, 0, 0.13, -0.3);
    add(torso, new THREE.BoxGeometry(0.3, 0.05, 0.1), m.strap, 0, 0.42, -0.21);
    for (const s of [-1, 1]) { const st = add(torso, new THREE.BoxGeometry(0.07, 0.4, 0.03), m.strap, s * 0.12, 0.24, 0.14); st.rotation.z = s * 0.08;
      add(torso, new THREE.BoxGeometry(0.07, 0.03, 0.3), m.strap, s * 0.12, 0.44, 0); }
    add(torso, new THREE.BoxGeometry(0.28, 0.04, 0.035), m.strap, 0, 0.2, 0.155);
    // head
    const head = this.head = new THREE.Group(); head.position.y = 0.5; torso.add(head);
    add(head, new THREE.CylinderGeometry(0.07, 0.08, 0.08, 10), m.skin, 0, -0.02, 0);
    const H = add(head, new THREE.SphereGeometry(0.21, 18, 14), m.skin, 0, 0.2, 0); H.scale.set(1, 0.98, 0.95);
    const hair = add(head, new THREE.SphereGeometry(0.222, 18, 10, 0, Math.PI * 2, 0, 1.42), m.hair, 0, 0.215, -0.012); hair.rotation.x = -0.22; hair.scale.set(1.02, 1, 1);
    const top = add(head, new THREE.SphereGeometry(0.15, 12, 8), m.hair, 0, 0.385, 0.05); top.scale.set(1.05, 0.42, 1.05); top.rotation.x = 0.25;
    const tuft = add(head, new THREE.SphereGeometry(0.07, 8, 6), m.hair, 0.03, 0.4, 0.15); tuft.scale.set(1.5, 0.5, 0.8); tuft.rotation.z = -0.2;
    for (const s of [-1, 1]) { add(head, new THREE.SphereGeometry(0.05, 8, 6), m.skin, s * 0.205, 0.19, 0).scale.set(0.5, 1, 0.8);
      const e = add(head, new THREE.SphereGeometry(0.032, 10, 8), m.eye, s * 0.075, 0.225, 0.18); e.scale.set(1, 1.15, 0.6);
      add(head, new THREE.SphereGeometry(0.01, 6, 4), m.white, s * 0.075 + 0.01, 0.237, 0.2);
      const br = add(head, new THREE.BoxGeometry(0.07, 0.016, 0.02), m.hair, s * 0.078, 0.282, 0.178); br.rotation.z = s * -0.18;
      const ch = add(head, new THREE.SphereGeometry(0.04, 8, 6), m.cheek, s * 0.12, 0.15, 0.16); ch.scale.set(1, 0.6, 0.4); }
    add(head, new THREE.SphereGeometry(0.03, 8, 6), m.skin, 0, 0.18, 0.205);
    // big smile: dark mouth with a row of teeth
    const mouth = add(head, new THREE.CircleGeometry(0.085, 20, Math.PI, Math.PI), m.mouth, 0, 0.125, 0.198); mouth.rotation.x = -0.25;
    const teeth = add(head, new THREE.PlaneGeometry(0.15, 0.03), m.white, 0, 0.112, 0.205); teeth.rotation.x = -0.25;
    this.mouth = mouth;
    // arms (pointing down from the shoulder pivot)
    this.arms = [];
    for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * 0.25, 0.38, 0); torso.add(sh);
      add(sh, new THREE.CylinderGeometry(0.075, 0.07, 0.12, 10), m.shirtPlain, 0, -0.04, 0); add(sh, cap(0.052, 0.14), m.skin, 0, -0.13, 0);
      const el = new THREE.Group(); el.position.y = -0.24; sh.add(el); add(el, cap(0.048, 0.13), m.skin, 0, -0.1, 0);
      const hand = add(el, new THREE.SphereGeometry(0.06, 10, 8), m.skin, 0, -0.22, 0); hand.scale.set(1, 1.1, 0.9);
      this.arms.push({ sh, el, hand, s }); }
    this.obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    this.t = 0; this.cheerT = 0; this.waveT = 0; this.popT = -1; this.mounted = null; this.visible = true;
  }
  // ---- seat finding (cached per dino) ----
  static seatFor(mech) {
    const key = mech.def.id + (mech.def.scale !== undefined ? '@' + mech.def.scale : ''); if (seatCache.has(key)) return seatCache.get(key);
    const o = mech.obj, sp = o.position.clone(), sq = o.quaternion.clone(), b = mech.b;
    o.position.set(0, 0, 0); o.quaternion.identity();
    const saved = {}; for (const k in (mech.rest || {})) { saved[k] = b[k].rotation.clone(); b[k].rotation.copy(mech.rest[k]); }
    o.updateMatrixWorld(true);
    const cfg = SEATS[mech.def.kind] || { t: 0.45 }, P = b.pelvis.getWorldPosition(V()), C = b.chest.getWorldPosition(V());
    let S; if (cfg.t <= 1) S = P.clone().lerp(C, cfg.t); else { const N = (b.neck0 || b.neck || b.chest).getWorldPosition(V()); S = C.clone().lerp(N, cfg.t - 1); }
    const meshes = mech.meshes.filter(m => m.isMesh); const sc = mech.def.scale;
    // several downward rays around the seat; a low-ish percentile ignores thin spikes/plates
    const hs = [];
    for (const dx of [-0.35, 0, 0.35]) for (const dz of [-0.3, 0, 0.3]) { ray.set(V(S.x + dx * sc, S.y + 30, S.z + dz * sc), V(0, -1, 0)); const h = ray.intersectObjects(meshes, false)[0]; if (h) hs.push(h.point.y); }
    hs.sort((a, b2) => a - b2); let top = hs.length ? hs[Math.floor(hs.length * (cfg.pct || (mech.real ? 0.45 : 0.75)))] : S.y + 0.8 * sc;
    // body half-width just under the seat (for leg spread)
    let hw = 0.6 * sc; for (const s of [-1, 1]) { ray.set(V(S.x + s * 20, top - 0.35 * sc, S.z), V(-s, 0, 0)); const h = ray.intersectObjects(meshes, false)[0]; if (h) hw = Math.max(hw * (s < 0 ? 0 : 1), Math.abs(h.point.x - S.x)); }
    let hwLow = hw; for (const s of [-1, 1]) { ray.set(V(S.x + s * 20, top - 0.9 * sc, S.z + 0.3 * sc), V(-s, 0, 0)); const h = ray.intersectObjects(meshes, false)[0]; if (h) hwLow = Math.max(hwLow, Math.abs(h.point.x - S.x)); }
    const boneName = cfg.t > 0.75 ? 'chest' : 'pelvis', bo = b[boneName];
    const seatW = V(S.x, top + (cfg.up || 0) * sc, S.z), local = bo.worldToLocal(seatW.clone());
    // forward direction in bone space (dino faces +z)
    const f = bo.worldToLocal(seatW.clone().add(V(0, 0, 1))).sub(local).normalize(), u = bo.worldToLocal(seatW.clone().add(V(0, 1, 0))).sub(local).normalize();
    for (const k in saved) b[k].rotation.copy(saved[k]); o.position.copy(sp); o.quaternion.copy(sq); o.updateMatrixWorld(true);
    const r = { bone: boneName, local, f, u, hw: hw / sc, hwLow: hwLow / sc, top, scale: sc }; seatCache.set(key, r); return r;
  }
  mount(mech) {
    this.unmount(); if (!mech) return;
    const seat = Rider.seatFor(mech), bo = mech.b[seat.bone], sc = mech.def.scale;
    const ws = Math.min(1.55, Math.max(1.05, 0.72 + 0.55 * sc)) * (mech.def.kind === 'bronto' || mech.def.kind === 'brachio' ? 1.12 : 1); // world size of the kid
    this.obj.scale.setScalar(ws / sc); this.obj.position.copy(seat.local);
    // orient: bone-space up/forward -> rider +y/+z
    const m4 = new THREE.Matrix4(), x = V().crossVectors(seat.u, seat.f).normalize(), z = V().crossVectors(x, seat.u).normalize(); m4.makeBasis(x, seat.u, z); this.obj.quaternion.setFromRotationMatrix(m4);
    this.obj.position.addScaledVector(seat.u, -0.05 * ws / sc); bo.add(this.obj); this.mounted = mech; this.real = !!mech.real; this.popT = -1;
    // leg spread so the legs wrap around the body instead of clipping into it
    const k = sc / ws, hw = seat.hw * sc / ws, hwL = seat.hwLow * sc / ws; this.hw = hw;
    this.spread = Math.min(1.25, Math.max(0.25, Math.asin(Math.min(0.97, Math.max(0.1, (hw + 0.1 - 0.11) / 0.32)))));
    this.shinOut = Math.min(0.9, Math.max(0, Math.atan2(hwL + 0.12 - (0.11 + Math.sin(this.spread) * 0.32), 0.34)));
    this.buildSeat(Math.max(0.3, Math.min(0.75, hw * 1.05)));
    this.setPose(0);
  }
  unmount() { if (this.obj.parent) this.obj.parent.remove(this.obj); this.mounted = null; }
  buildSeat(w) {
    const m = mats(), g = this.seatGroup; while (g.children.length) g.remove(g.children[0]);
    const add = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    if (this.real) { // leather saddle with a horn to hold on to, and straps going down the sides
      add(new THREE.BoxGeometry(w * 1.5, 0.07, 0.62), m.saddle, 0, 0.0, 0); add(new THREE.BoxGeometry(w * 1.1, 0.1, 0.16), m.saddle, 0, 0.06, -0.26);
      add(new THREE.CylinderGeometry(0.035, 0.045, 0.2, 8), m.saddleTrim, 0, 0.1, 0.34); add(new THREE.SphereGeometry(0.06, 8, 6), m.saddleTrim, 0, 0.21, 0.34);
      for (const s of [-1, 1]) { const st = add(new THREE.BoxGeometry(0.05, 0.5, 0.06), m.saddle, s * w * 0.74, -0.24, 0.02); st.rotation.z = s * 0.15;
        const fl = add(new THREE.BoxGeometry(0.035, 0.34, 0.52), m.saddle, s * w * 0.7, -0.13, 0); fl.rotation.z = s * 0.38; }
    } else { // robot cockpit seat: metal shell, glowing trim and a handle bar
      add(new THREE.BoxGeometry(w * 1.4, 0.09, 0.6), m.seat, 0, 0.0, 0); add(new THREE.BoxGeometry(w * 1.2, 0.32, 0.08), m.seat, 0, 0.16, -0.3);
      add(new THREE.BoxGeometry(w * 1.42, 0.025, 0.62), m.seatGlow, 0, 0.05, 0); add(new THREE.BoxGeometry(w * 1.0, 0.025, 0.05), m.seatGlow, 0, 0.31, -0.3);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 8), m.seat, 0, 0.12, 0.34); const bar = add(new THREE.CylinderGeometry(0.026, 0.026, 0.46, 8), m.seat, 0, 0.25, 0.34); bar.rotation.z = Math.PI / 2;
      for (const s of [-1, 1]) { add(new THREE.SphereGeometry(0.035, 8, 6), m.seatGlow, s * 0.24, 0.25, 0.34); const fl = add(new THREE.BoxGeometry(0.04, 0.32, 0.56), m.seat, s * w * 0.66, -0.13, 0); fl.rotation.z = s * 0.32; }
    }
    this.root.position.y = this.real ? 0.035 : 0.045;
  }
  // pose: sitting astride, hands on the horn / handle bar
  setPose(dt, st = {}) {
    const L = this.legs, A = this.arms, t = this.t;
    for (const g of L) { g.hip.rotation.set(-1.35, 0, g.s * this.spread); g.knee.rotation.set(1.45, 0, g.s * this.shinOut * 0.6 - g.s * this.spread * 0.55); g.foot.rotation.set(-0.15, 0, 0); }
    const hold = st.hold || 0, k = st.k || 0;
    this.torso.rotation.set(0.12 + 0.12 * k + 0.25 * hold, 0, 0); this.head.rotation.set(-0.1 * k - 0.2 * hold + Math.sin(t * 1.3) * 0.03, Math.sin(t * 0.7) * 0.12 * (1 - hold), 0);
    for (const a of A) { a.sh.rotation.set(-0.95 - 0.25 * hold, 0, a.s * (0.12 - 0.1 * hold)); a.el.rotation.set(-0.75 - 0.3 * hold, 0, 0); }
    const R = A[1];
    if (this.cheerT > 0) { const u = this.cheerT, pump = Math.abs(Math.sin(u * 9)); R.sh.rotation.set(-2.7 - 0.25 * pump, 0, 0.25); R.el.rotation.set(-0.4 - 0.5 * (1 - pump), 0, 0); this.torso.rotation.z = -0.08; this.root.position.y += pump * 0.05; }
    else if (this.waveT > 0) { R.sh.rotation.set(-2.5, 0, 0.55 + 0.35 * Math.sin(t * 9)); R.el.rotation.set(-0.5, 0, 0.3 * Math.sin(t * 9 + 1)); this.head.rotation.y = 0.35; }
  }
  update(dt, d) {
    this.t += dt; const m = this.mounted; if (this.cheerT > 0) this.cheerT -= dt; if (this.waveT > 0) this.waveT -= dt;
    if (this.popT >= 0) return this.updatePop(dt);
    if (!m) return;
    const sp = d ? d.speedNow || 0 : 0, k = Math.min(1, sp / (8 * m.def.scale)), hold = d ? Math.min(1, Math.max(d.roar > 0.25 ? 1 : 0, d.breathT > 0 ? 0.6 : 0, d.boosting ? 0.5 : 0)) : 0;
    this.root.position.y = (this.real ? 0.035 : 0.045) + Math.abs(Math.sin((m.phase || 0) + 0.6)) * 0.06 * k + Math.sin(this.t * 2) * 0.004;
    this.root.rotation.z += (((d && d.turn) || 0) * 0.28 - this.root.rotation.z) * Math.min(1, dt * 6); // lean into turns
    this.setPose(dt, { k, hold });
  }
  cheer() { this.cheerT = 1.4; }
  wave(t = 2.5) { this.waveT = t; }
  // dino KO: Leandro hops off, safe and smiling, and waits next to it
  pop() { const m = this.mounted; if (!m || this.popT >= 0) return; const wp = this.obj.getWorldPosition(V()), wq = this.obj.getWorldQuaternion(new THREE.Quaternion()), ws = this.obj.getWorldScale(V());
    const scene = m.obj.parent; if (!scene) return; this.unmount(); scene.add(this.obj); this.obj.position.copy(wp); this.obj.quaternion.copy(wq); this.obj.scale.copy(ws);
    this.popFrom = wp; this.popYaw = new THREE.Euler().setFromQuaternion(wq, 'YXZ').y; this.popT = 0; this.seatGroup.visible = false; this.cheerT = 0; }
  updatePop(dt) { this.popT += dt; const u = Math.min(1, this.popT / 0.9), side = V(Math.cos(this.popYaw), 0, -Math.sin(this.popYaw)).multiplyScalar(3.5 * this.obj.scale.x);
    const ground = this.groundAt ? this.groundAt(this.popFrom.x + side.x, this.popFrom.z + side.z) : this.popFrom.y - 3;
    const y = this.popFrom.y + (ground - this.popFrom.y) * u + Math.sin(Math.PI * u) * 2.5;
    this.obj.position.set(this.popFrom.x + side.x * u, Math.max(y, ground), this.popFrom.z + side.z * u); this.obj.rotation.set(0, this.popYaw + u * Math.PI * 2, 0);
    // standing pose
    for (const g of this.legs) { g.hip.rotation.set(0, 0, g.s * 0.08); g.knee.rotation.set(u < 1 ? 0.6 : 0.05, 0, 0); g.foot.rotation.set(0, 0, 0); }
    this.hips.position.y = 0.62; this.torso.rotation.set(0, 0, 0);
    for (const a of this.arms) { a.sh.rotation.set(u < 1 ? -2.6 : -0.2, 0, a.s * (u < 1 ? 0.5 : 0.15)); a.el.rotation.set(-0.2, 0, 0); }
    if (u >= 1) { const R = this.arms[1]; R.sh.rotation.set(-2.5, 0, 0.55 + 0.35 * Math.sin(this.t * 9)); this.obj.position.y = ground + Math.abs(Math.sin(this.t * 5)) * 0.08; } }
  reset() { this.hips.position.y = 0.13; this.seatGroup.visible = true; this.popT = -1; }
}
