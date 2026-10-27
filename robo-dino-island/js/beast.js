// Real (organic, non-robot) dinosaurs. Bodies are smooth lofted tubes (Catmull-Rom spine through bone-attached control
// points, elliptical cross-sections) skinned to a bone rig with blended weights, so they bend like animals. Skin uses a
// procedural scale albedo + normal map, with countershading / stripes / scars baked into vertex colours.
// Each dino renders in 3 draw calls: skin, horn/teeth/claws, glowing eyes.
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { scaleTextures } from './proctex.js';
import { noise2, rng } from './noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = h => new THREE.Color(h);
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const crs = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
const M = (p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => new THREE.Matrix4().compose(V(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2])), V(...s));
const UP = V(0, 1, 0);

function palette(def, wild) {
  const p = { back: C(def.back), belly: C(def.belly), stripe: C(def.stripe ?? def.back), accent: C(def.accent), eye: C(def.eye),
    horn: C(0xd9cdb2), hornDark: C(0x2e2620), mouth: C(0x4a1a1e), tongue: C(0x7a3036), claw: C(0x1a1612), scar: C(0xc4ae98) };
  if (wild) { p.back.multiplyScalar(0.5); p.belly.multiplyScalar(0.62); p.stripe.multiplyScalar(0.45); p.eye = C(0xff2a0a); p.accent.lerp(C(0xff2a0a), 0.45).multiplyScalar(0.8); }
  return p;
}

class OB {
  constructor(def, wild) {
    this.def = def; this.wild = wild; this.pal = palette(def, wild); this.r = rng(def.id.length * 977 + (wild ? 5 : 1));
    this.bones = {}; this.list = []; this.sockets = {}; this.geo = { skin: [], horn: [], eye: [] }; this.dirty = true; this.eyes = [];
    this.root = this.bone('root', null, 0, 0, 0);
  }
  bone(name, parent, x, y, z) { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); if (parent) this.bones[parent].add(b); this.bones[name] = b; this.list.push(b); this.dirty = true; return b; }
  socket(bone, name, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); this.bones[bone].add(o); this.sockets[name] = o; return o; }
  upd() { if (this.dirty) { this.root.updateMatrixWorld(true); this.dirty = false; } }
  W(bone, p) { this.upd(); return V(p[0], p[1], p[2]).applyMatrix4(this.bones[bone].matrixWorld); }
  bi(name) { const i = this.list.indexOf(this.bones[name]); if (i < 0) throw new Error('bone ' + name); return i; }

  // countershaded skin colour for a surface point: up = how much the normal faces the sky (-1..1)
  skinColor(up, a, b, o = {}) {
    const P = this.pal, c = P.belly.clone().lerp(P.back, sstep(-0.45, 0.35, up));
    if (o.stripes !== false) { const s = Math.sin(a * (o.sf ?? 2.3) + 1.8 * noise2(a * 0.45 + 3, b * 0.8)); c.lerp(P.stripe, sstep(0.25, 0.75, s) * sstep(-0.1, 0.5, up) * 0.92); }
    if (o.stripes !== false) c.lerp(P.accent, sstep(0.82, 0.98, up) * 0.45 * (0.6 + 0.4 * noise2(a * 1.3, b)));
    c.multiplyScalar(0.88 + 0.22 * noise2(a * 2.1 + 7, b * 2.3 - 1));
    return c;
  }

  // smooth lofted tube through bone-attached control points: [{b, p:[x,y,z], r:[rx, ry]}]
  tube(pts, o = {}) {
    const seg = o.seg ?? 16, per = o.per ?? 4, n = pts.length, P = pts.map(q => this.W(q.b, q.p));
    const ext = (i) => i < 0 ? P[0].clone().multiplyScalar(2).sub(P[1]) : i > n - 1 ? P[n - 1].clone().multiplyScalar(2).sub(P[n - 2]) : P[i];
    const ctr = t => { const i = Math.max(0, Math.min(n - 2, Math.floor(t))), f = t - i, a = ext(i - 1), b = P[i], c = P[i + 1], d = ext(i + 2);
      return V(crs(a.x, b.x, c.x, d.x, f), crs(a.y, b.y, c.y, d.y, f), crs(a.z, b.z, c.z, d.z, f)); };
    const rv = (t, k) => { const i = Math.max(0, Math.min(n - 2, Math.floor(t))), f = t - i, g = j => pts[Math.max(0, Math.min(n - 1, j))].r[k];
      return Math.max(0.004, crs(g(i - 1), g(i), g(i + 1), g(i + 2), f)); };
    const nR = (n - 1) * per + 1, pos = [], nor = [], uv = [], col = [], si = [], sw = [], idx = [];
    let maxR = 0; for (const q of pts) maxR = Math.max(maxR, (q.r[0] + q.r[1]) * 0.5);
    const ts = o.ts ?? 1.0, uRep = Math.max(2, Math.round(2 * Math.PI * maxR / ts));
    let Nv = null, arc = 0, prevC = null; const rings = [];
    const ref = o.up ? V(...o.up) : UP.clone(), seed = this.r() * 50;
    for (let k = 0; k < nR; k++) {
      const t = k / per, c = ctr(t), T = ctr(Math.min(n - 1, t + 0.02)).sub(ctr(Math.max(0, t - 0.02))).normalize();
      if (!Nv) { Nv = ref.clone().addScaledVector(T, -ref.dot(T)); if (Nv.lengthSq() < 0.01) Nv = V(0, 0, 1).addScaledVector(T, -T.z); }
      else Nv.addScaledVector(T, -Nv.dot(T));
      Nv.normalize(); const S = Nv.clone().cross(T).normalize();
      if (prevC) arc += c.distanceTo(prevC); prevC = c;
      const rx = rv(t, 0), ry = rv(t, 1), i0 = Math.max(0, Math.min(n - 2, Math.floor(t))), f = t - i0;
      const bA = this.bi(pts[i0].b), bB = this.bi(pts[i0 + 1].b), w = bA === bB ? 0 : sstep(0, 1, f);
      rings.push({ c, T, rx, ry });
      for (let j = 0; j <= seg; j++) {
        const th = j / seg * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
        const e = o.sq ?? 1, x = Math.sign(cs) * Math.abs(cs) ** e, y0 = Math.sign(sn) * Math.abs(sn) ** e;
        let y = y0 * (sn >= 0 ? (o.top ?? 1) : (o.belly ?? 1));
        if (o.ridge) y += o.ridge * Math.max(0, sn) ** 14;
        const lump = o.lump ? 1 + o.lump * noise2(arc * 1.7 + seed, th * 1.6) : 1;
        const off = S.clone().multiplyScalar(x * rx * lump).addScaledVector(Nv, y * ry * lump);
        const p = c.clone().add(off); pos.push(p.x, p.y, p.z);
        uv.push(j / seg * uRep, arc / ts);
        const upd = off.lengthSq() > 1e-8 ? off.clone().normalize().dot(UP) : 0;
        const cc = o.color ? (typeof o.color === 'function' ? o.color(upd, arc, th, t, sn) : o.color.clone()) : this.skinColor(upd, arc, th, o);
        col.push(cc.r, cc.g, cc.b);
        si.push(bA, bB, 0, 0); sw.push(1 - w, w, 0, 0);
      }
    }
    const row = seg + 1;
    for (let k = 0; k < nR - 1; k++) for (let j = 0; j < seg; j++) { const a = k * row + j, b = a + row; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    // rounded end caps
    const cap = (k, sign) => { const R = rings[k], ci = pos.length / 3, c = R.c.clone().addScaledVector(R.T, sign * Math.min(R.rx, R.ry) * 0.55);
      pos.push(c.x, c.y, c.z); uv.push(0.5, 0); const s0 = si.slice(k * row * 4, k * row * 4 + 4), w0 = sw.slice(k * row * 4, k * row * 4 + 4); si.push(...s0); sw.push(...w0);
      col.push(col[k * row * 3], col[k * row * 3 + 1], col[k * row * 3 + 2]);
      for (let j = 0; j < seg; j++) { const a = k * row + j; if (sign < 0) idx.push(ci, a + 1, a); else idx.push(ci, a, a + 1); } };
    if (o.cap0 !== false) cap(0, -1); if (o.cap1 !== false) cap(nR - 1, 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.setIndex(idx); g.computeVertexNormals();
    const nm = g.attributes.normal; for (let k = 0; k < nR; k++) { const a = k * row, b = a + seg; const x = nm.getX(a) + nm.getX(b), y = nm.getY(a) + nm.getY(b), z = nm.getZ(a) + nm.getZ(b), l = Math.hypot(x, y, z) || 1; nm.setXYZ(a, x / l, y / l, z / l); nm.setXYZ(b, x / l, y / l, z / l); }
    this.geo[o.mat || 'skin'].push(g.toNonIndexed());
    return rings;
  }
  // rigid part on one bone. col: Color or fn(localPos) -> Color
  part(bone, geo, mk, m, col) {
    this.upd(); let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const a of ['uv1', 'uv2']) if (g.attributes[a]) g.deleteAttribute(a);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, cl = new Float32Array(n * 3), lp = g.attributes.position, v = V(0, 0, 0);
    for (let i = 0; i < n; i++) { const c = typeof col === 'function' ? col(v.set(lp.getX(i), lp.getY(i), lp.getZ(i))) : col; cl[i * 3] = c.r; cl[i * 3 + 1] = c.g; cl[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.bones[bone].matrixWorld, m));
    const bi = this.bi(bone), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    this.geo[mk].push(g);
  }
  blob(bone, p, r, rot = [0, 0, 0], col, mk = 'skin', seg = 12) { this.part(bone, new THREE.SphereGeometry(1, seg, Math.max(6, seg * 0.6 | 0)), mk, M(p, rot, r), col || this.pal.back); }
  // curved tapered horn / claw / tooth along local +y, bending toward local +z
  horn(bone, p, rot, len, r0, bend = 0, cA, cB, mk = 'horn', seg = 8, rings = 6) {
    const pos = [], idx = [], cols = [];
    const A = cA || this.pal.horn, B = cB || this.pal.horn;
    for (let k = 0; k <= rings; k++) { const t = k / rings, y = len * t, z = bend * len * t * t, r = r0 * Math.pow(1 - t, 0.9) + 0.003, c = A.clone().lerp(B, t);
      for (let j = 0; j <= seg; j++) { const a = j / seg * Math.PI * 2; pos.push(Math.cos(a) * r, y, z + Math.sin(a) * r); cols.push(c.r, c.g, c.b); } }
    const row = seg + 1; for (let k = 0; k < rings; k++) for (let j = 0; j < seg; j++) { const a = k * row + j, b = a + row; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const cg = new THREE.Float32BufferAttribute(cols, 3); const ng = g.toNonIndexed(); const cn = new Float32Array(ng.attributes.position.count * 3);
    for (let i = 0; i < idx.length; i++) { cn[i * 3] = cols[idx[i] * 3]; cn[i * 3 + 1] = cols[idx[i] * 3 + 1]; cn[i * 3 + 2] = cols[idx[i] * 3 + 2]; }
    this.part(bone, ng, mk, M(p, rot), (() => { let i = 0; return () => { const c = new THREE.Color(cn[i * 3], cn[i * 3 + 1], cn[i * 3 + 2]); i++; return c; }; })());
  }
  // flat extruded plate (sails, frills, back plates, feathers), shape in local x/y
  plate(bone, shape, thick, m, colFn, mk = 'skin', bevel = 0.03) {
    const s = new THREE.Shape(); shape.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
    g.translate(0, 0, -thick / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.8, uv.getY(i) * 0.8);
    this.part(bone, g, mk, m, colFn);
  }
  eye(bone, p, r, browRot) {
    const P = this.pal;
    this.blob(bone, p, [r * 1.25, r * 1.1, r * 1.25], [0, 0, 0], P.claw, 'horn', 10); // dark socket
    this.blob(bone, [p[0] + Math.sign(p[0]) * r * 0.35, p[1], p[2] + r * 0.1], [r * 0.8, r * 0.75, r * 0.95], [0, 0, 0], P.eye, 'eye', 10);
    const sd = Math.sign(p[0]);
    // heavy angry brow ridge sloping down toward the snout
    this.blob(bone, [p[0] - sd * r * 0.2, p[1] + r * 1.05, p[2] + r * 0.2], [r * 1.7, r * 0.75, r * 2.8], [0.35 + (browRot || 0), sd * 0.2, sd * 0.42], P.back.clone().multiplyScalar(0.85));
    this.socket(bone, sd > 0 ? 'eyeL' : 'eyeR', p[0] + sd * r * 0.7, p[1], p[2] + r * 0.2);
  }
  finish(assets) {
    const sc = scaleTextures();
    const P = this.pal;
    const mats = {
      plate: new THREE.MeshStandardMaterial({ vertexColors: true, map: sc.map, normalMap: sc.normal, normalScale: new THREE.Vector2(1.25, 1.25), roughness: 0.74, metalness: 0, envMapIntensity: 0.85 }),
      frame: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, envMapIntensity: 1.0 }),
      glow: new THREE.MeshBasicMaterial({ color: P.eye.clone().multiplyScalar(3.2), toneMapped: false }),
      glowColor: P.eye.clone(),
    };
    const group = new THREE.Group(); group.add(this.root); this.root.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(this.list); this.meshes = [];
    for (const [k, mk] of [['skin', 'plate'], ['horn', 'frame'], ['eye', 'glow']]) {
      if (!this.geo[k].length) continue;
      const geo = mergeGeometries(this.geo[k]); geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.5;
      const mesh = new THREE.SkinnedMesh(geo, mats[mk]); mesh.castShadow = k !== 'eye'; mesh.receiveShadow = k !== 'eye';
      mesh.bind(skeleton, new THREE.Matrix4()); mesh.boundingSphere = geo.boundingSphere.clone(); group.add(mesh); this.meshes.push(mesh);
    }
    this.mats = mats; return group;
  }
}

// ---------------- shared body plans ----------------
function teethRow(B, bone, z0, z1, n, xAt, yAt, down, len, s = 1) {
  for (let i = 0; i < n; i++) { const z = z0 + (z1 - z0) * i / (n - 1), l = len * (0.7 + 0.5 * Math.sin(Math.PI * (0.25 + 0.6 * i / (n - 1))));
    for (const sd of [1, -1]) B.horn(bone, [sd * xAt(z), yAt(z), z], down ? [Math.PI, 0, sd * -0.08] : [0, 0, sd * 0.08], l * s, 0.035 * s + l * 0.12, down ? -0.15 : 0.15, B.pal.horn, B.pal.horn.clone().multiplyScalar(1.1), 'horn', 6, 3); }
}
function clawsOn(B, bone, pts, len, r0, bend = 0.45) { for (const [x, y, z, ry = 0] of pts) B.horn(bone, [x, y, z], [Math.PI / 2 + 0.35, ry, 0], len, r0, bend, B.pal.claw, B.pal.claw.clone().lerp(B.pal.horn, 0.25), 'horn', 6, 4); }

// biped theropod: T-Rex, Carnotaurus, Velociraptor, Spinosaurus
function theropod(B, o) {
  const P = B.pal;
  B.bone('pelvis', 'root', 0, o.hipH, 0);
  B.bone('spine', 'pelvis', 0, 0.1, o.body * 0.5); B.bone('chest', 'spine', 0, -0.02, o.body * 0.5); B.bone('ribs', 'chest', 0, 0, 0);
  B.bone('neck0', 'chest', 0, o.neck[1] * 0.55, o.neck[0] * 0.55); B.bone('neck1', 'neck0', 0, o.neck[1] * 0.45, o.neck[0] * 0.45);
  B.bone('head', 'neck1', 0, 0.12 * o.hs, 0.25 * o.hs); B.bone('jaw', 'head', 0, o.jawY, o.jawZ);
  let prev = 'pelvis'; for (let i = 0; i < o.tailN; i++) { B.bone('tail' + i, prev, 0, i ? -0.05 : 0.04, i ? -o.tailL : -o.body * 0.42); prev = 'tail' + i; }
  const [a, b, c] = o.leg;
  for (const [sd, S] of [[1, 'L'], [-1, 'R']]) {
    B.bone(S + 'hip', 'pelvis', sd * o.hipW, -0.12, 0.05); B.bone(S + 'knee', S + 'hip', 0, -a * 0.93, a * 0.36);
    B.bone(S + 'ankle', S + 'knee', 0, -b * 0.88, -b * 0.47); B.bone(S + 'foot', S + 'ankle', 0, -c * 0.97, c * 0.22); B.bone(S + 'toe', S + 'foot', 0, 0, o.foot * 0.35);
    B.bone(S + 'sh', 'chest', sd * o.shW, -o.shY, o.body * 0.2); B.bone(S + 'el', S + 'sh', 0, -o.arm[0], o.arm[0] * 0.35); B.bone(S + 'hand', S + 'el', 0, -o.arm[1] * 0.55, o.arm[1] * 0.85);
  }
  // ---- body: tail tip -> pelvis -> belly -> chest -> neck -> back of head
  const T = o.tailN, pts = [];
  pts.push({ b: 'tail' + (T - 1), p: [0, 0, -o.tailL * 0.95], r: [0.04 * o.w, 0.05 * o.w] });
  for (let i = T - 1; i >= 0; i--) { const u = (i + 1) / (T + 0.5), r = (o.tailR * Math.pow(1 - u, 1.05) + 0.05) * o.w; pts.push({ b: 'tail' + i, p: [0, 0, 0], r: [r * (o.tailFlat || 1), r * 1.18 * (o.tailTall || 1)] }); }
  pts.push({ b: 'pelvis', p: [0, 0.06, -0.1], r: [o.hipR[0] * o.w, o.hipR[1]] });
  pts.push({ b: 'spine', p: [0, -0.12, 0], r: [o.bellyR[0] * o.w, o.bellyR[1]] });
  pts.push({ b: 'ribs', p: [0, -0.06, 0.05], r: [o.chestR[0] * o.w, o.chestR[1]] });
  pts.push({ b: 'neck0', p: [0, -0.08, 0], r: [o.neckR[0] * o.w, o.neckR[1]] });
  pts.push({ b: 'neck1', p: [0, 0, 0], r: [o.neckR[0] * 0.82 * o.w, o.neckR[1] * 0.82] });
  pts.push({ b: 'head', p: [0, 0.0, -0.12 * o.hs], r: [o.neckR[0] * 0.74 * o.w, o.neckR[1] * 0.74] });
  B.bodyPts = pts;
  B.tube(pts, { seg: 22, per: 4, ridge: 0.06, lump: 0.03, ts: 0.9, sf: o.sf, cap1: false });
  // ---- head (upper skull + snout) and lower jaw; the mouth inside is dark, teeth are ivory
  const hs = o.hs, H = o.headPts.map(([z, y, rx, ry]) => ({ b: 'head', p: [0, y * hs, z * hs], r: [rx * hs, ry * hs] }));
  const mouthCol = (up, arc, th, t, sn) => sn < -0.62 ? P.mouth : B.skinColor(up, arc + 9, th, { sf: 4 });
  const scars = o.scar ? (up, arc, th, t, sn) => { const c = mouthCol(up, arc, th, t, sn); const d = Math.abs((arc - o.scar[0]) - (th - o.scar[1]) * 0.25); return d < 0.025 && sn > -0.3 ? P.scar.clone() : c; } : mouthCol;
  B.tube(H, { seg: 18, per: 4, belly: o.headBelly ?? 0.55, sq: 0.85, ts: 0.55, color: scars });
  const J = o.jawPts.map(([z, y, rx, ry]) => ({ b: 'jaw', p: [0, y * hs, z * hs], r: [rx * hs, ry * hs] }));
  B.tube(J, { seg: 14, per: 3, top: 0.45, ts: 0.55, color: (up, arc, th, t, sn) => sn > 0.55 ? P.tongue : B.skinColor(up, arc + 4, th, { sf: 4 }) });
  const at = (pp, z) => { // interpolate a head profile at z
    for (let i = 0; i < pp.length - 1; i++) if (z <= pp[i + 1][0] * hs || i === pp.length - 2) { const f = Math.max(0, Math.min(1, (z - pp[i][0] * hs) / ((pp[i + 1][0] - pp[i][0]) * hs))); return pp[i].map((v, k) => (v + (pp[i + 1][k] - v) * f) * (k ? hs : hs)); } };
  const tz0 = o.teeth[0] * hs, tz1 = o.teeth[1] * hs;
  teethRow(B, 'head', tz0, tz1, o.teeth[2], z => at(o.headPts, z)[2] * 0.86, z => at(o.headPts, z)[1] - at(o.headPts, z)[3] * (o.headBelly ?? 0.55) + 0.02 * hs, true, o.teeth[3] * hs, 1);
  teethRow(B, 'jaw', tz0 + 0.1 * hs, tz1 - 0.05 * hs, o.teeth[2] - 1, z => at(o.jawPts, z)[2] * 0.8, z => at(o.jawPts, z)[1] + at(o.jawPts, z)[3] * 0.4, false, o.teeth[3] * 0.8 * hs, 1);
  B.eye('head', [o.eyeP[0] * hs, o.eyeP[1] * hs, o.eyeP[2] * hs], o.eyeR * hs, o.browTilt);
  B.eye('head', [-o.eyeP[0] * hs, o.eyeP[1] * hs, o.eyeP[2] * hs], o.eyeR * hs, o.browTilt);
  const tip = o.headPts[o.headPts.length - 2];
  for (const sd of [1, -1]) B.blob('head', [sd * 0.1 * hs, (tip[1] + tip[3] * 0.55) * hs, tip[0] * hs], [0.045 * hs, 0.03 * hs, 0.06 * hs], [0, 0, 0], P.claw, 'horn', 8);
  B.socket('head', 'mouth', 0, -0.1 * hs, o.headPts[o.headPts.length - 1][0] * hs);
  // ---- legs: big drumstick thighs, slim shins, clawed feet
  const lw = o.legW;
  for (const S of ['L', 'R']) {
    B.tube([
      { b: S + 'hip', p: [0, 0.32, 0.0], r: [0.5 * lw, 0.62 * lw] },
      { b: S + 'hip', p: [0.02 * (S === 'L' ? 1 : -1), -a * 0.42, a * 0.14], r: [0.5 * lw, 0.7 * lw] },
      { b: S + 'knee', p: [0, 0.06, 0], r: [0.29 * lw, 0.34 * lw] },
      { b: S + 'knee', p: [0, -b * 0.45, -b * 0.24], r: [0.22 * lw, 0.28 * lw] },
      { b: S + 'ankle', p: [0, 0, 0], r: [0.15 * lw, 0.18 * lw] },
      { b: S + 'ankle', p: [0, -c * 0.5, c * 0.1], r: [0.13 * lw, 0.15 * lw] },
      { b: S + 'foot', p: [0, 0.12 * lw, 0], r: [0.17 * lw, 0.15 * lw] },
    ], { seg: 14, per: 3, up: [0, 0, 1], ts: 0.7, lump: 0.04, sf: 3.1 });
    const sd = S === 'L' ? 1 : -1;
    for (const t of [-1, 0, 1]) {
      const sp = o.toeSpread * lw;
      B.tube([{ b: S + 'foot', p: [t * sp * 0.4, 0.1 * lw, 0.02], r: [0.08 * lw, 0.075 * lw] }, { b: S + 'toe', p: [t * sp * 0.8, 0.07 * lw, o.foot * 0.25], r: [0.075 * lw, 0.06 * lw] }, { b: S + 'toe', p: [t * sp, 0.05 * lw, o.foot * 0.55], r: [0.05 * lw, 0.04 * lw] }],
        { seg: 8, per: 2, up: [0, 1, 0], ts: 0.4, stripes: false });
      clawsOn(B, S + 'toe', [[t * sp, 0.06 * lw, o.foot * 0.58, t * 0.2]], 0.2 * lw * (o.clawK || 1), 0.045 * lw);
    }
    if (o.sickle) B.horn(S + 'toe', [sd * 0.05, 0.16 * lw, 0.05], [-0.4, 0, 0], 0.42 * lw, 0.055 * lw, -0.9, P.claw, P.claw.clone().lerp(P.horn, 0.3), 'horn', 8, 6);
    // arms
    const [ua, fa] = o.arm, aw = o.armW;
    B.tube([{ b: S + 'sh', p: [0, 0.08, 0], r: [0.16 * aw, 0.19 * aw] }, { b: S + 'el', p: [0, 0, 0], r: [0.1 * aw, 0.11 * aw] }, { b: S + 'hand', p: [0, 0, 0], r: [0.07 * aw, 0.065 * aw] }],
      { seg: 10, per: 3, up: [0, 0, 1], ts: 0.5, stripes: false });
    const fingers = o.fingers || 2;
    clawsOn(B, S + 'hand', Array.from({ length: fingers }, (_, i) => [(i - (fingers - 1) / 2) * 0.06 * aw, -0.02, 0.05]), 0.17 * aw * (o.handClaw || 1), 0.03 * aw, 0.8);
  }
  B.socket('chest', 'jet', 0, 0, 0);
  return o;
}

// quadruped: Triceratops, Ankylosaurus, Stegosaurus, Brachiosaurus
function quadruped(B, o) {
  const P = B.pal;
  B.bone('pelvis', 'root', 0, o.hipH, 0);
  B.bone('spine', 'pelvis', 0, o.spineY ?? 0.05, o.body * 0.5); B.bone('chest', 'spine', 0, o.chestY ?? -0.05, o.body * 0.5); B.bone('ribs', 'chest', 0, 0, 0);
  let prev = 'chest'; for (let i = 0; i < o.neckN; i++) { B.bone('neck' + i, prev, 0, i ? o.neckRise : o.neckRise * 0.5 + 0.1, i ? o.neckL : o.body * 0.32); prev = 'neck' + i; }
  B.bone('head', prev, 0, o.headY ?? 0, o.headZ ?? o.neckL * 0.7); B.bone('jaw', 'head', 0, o.jawY, o.jawZ);
  prev = 'pelvis'; for (let i = 0; i < o.tailN; i++) { B.bone('tail' + i, prev, 0, i ? -o.tailDrop : 0.05, i ? -o.tailL : -o.body * 0.4); prev = 'tail' + i; }
  for (const [sd, S] of [[1, 'L'], [-1, 'R']]) {
    const [a, b, c] = o.legB, [fa, fb, fc] = o.legF;
    B.bone(S + 'hip', 'pelvis', sd * o.hipW, -0.15, 0); B.bone(S + 'knee', S + 'hip', 0, -a, a * 0.22); B.bone(S + 'ankle', S + 'knee', 0, -b, -b * 0.25); B.bone(S + 'foot', S + 'ankle', 0, -c, c * 0.12);
    B.bone(S + 'Fhip', 'chest', sd * o.shW, -0.2, 0.1); B.bone(S + 'Fknee', S + 'Fhip', 0, -fa, -fa * 0.12); B.bone(S + 'Fankle', S + 'Fknee', 0, -fb, fb * 0.1); B.bone(S + 'Ffoot', S + 'Fankle', 0, -fc, 0.03);
  }
  const T = o.tailN, pts = [];
  pts.push({ b: 'tail' + (T - 1), p: [0, 0, -o.tailL * 0.95], r: [0.05, 0.06] });
  for (let i = T - 1; i >= 0; i--) { const u = (i + 1) / (T + 0.5), r = o.tailR * Math.pow(1 - u, 1.1) + 0.06; pts.push({ b: 'tail' + i, p: [0, 0, 0], r: [r * (o.tailFlat || 1), r * 1.1] }); }
  pts.push({ b: 'pelvis', p: [0, 0.02, -0.1], r: o.hipR });
  pts.push({ b: 'spine', p: [0, -0.08, 0], r: o.bellyR });
  pts.push({ b: 'ribs', p: [0, -0.05, 0.1], r: o.chestR });
  for (let i = 0; i < o.neckN; i++) { const u = (i + 1) / (o.neckN + 1); pts.push({ b: 'neck' + i, p: [0, 0, 0], r: [o.neckR[0] * (1 - u * o.neckTaper), o.neckR[1] * (1 - u * o.neckTaper)] }); }
  pts.push({ b: 'head', p: [0, 0, -0.15], r: [o.neckR[0] * (1 - o.neckTaper) * 0.95, o.neckR[1] * (1 - o.neckTaper) * 0.95] });
  B.bodyPts = pts;
  B.tube(pts, { seg: 24, per: 4, ridge: o.ridge ?? 0.05, lump: 0.03, ts: 1.0, top: o.top ?? 1, belly: o.belly ?? 1, sf: o.sf, cap1: false });
  const H = o.headPts.map(([z, y, rx, ry]) => ({ b: 'head', p: [0, y, z], r: [rx, ry] }));
  B.tube(H, { seg: 16, per: 3, belly: 0.65, sq: 0.9, ts: 0.55, color: (up, arc, th, t, sn) => sn < -0.65 ? P.mouth : B.skinColor(up, arc + 9, th, { sf: 4 }) });
  const J = o.jawPts.map(([z, y, rx, ry]) => ({ b: 'jaw', p: [0, y, z], r: [rx, ry] }));
  B.tube(J, { seg: 12, per: 3, top: 0.45, ts: 0.55, color: (up, arc, th, t, sn) => sn > 0.55 ? P.tongue : B.skinColor(up, arc + 4, th, { sf: 4 }) });
  B.eye('head', o.eyeP, o.eyeR, o.browTilt); B.eye('head', [-o.eyeP[0], o.eyeP[1], o.eyeP[2]], o.eyeR, o.browTilt);
  B.socket('head', 'mouth', 0, -0.1, o.headPts[o.headPts.length - 1][0]);
  // pillar legs with elephant-like feet and blunt nails
  for (const S of ['L', 'R']) for (const F of ['', 'F']) {
    const [a, b, c] = F ? o.legF : o.legB, lw = F ? o.legWF : o.legW, p = S + F;
    B.tube([
      { b: p + 'hip', p: [0, 0.3, 0], r: [0.48 * lw, 0.6 * lw] },
      { b: p + 'hip', p: [0, -a * 0.45, a * (F ? -0.04 : 0.12)], r: [0.44 * lw, 0.55 * lw] },
      { b: p + 'knee', p: [0, 0, 0], r: [0.3 * lw, 0.33 * lw] },
      { b: p + 'knee', p: [0, -b * 0.5, 0], r: [0.26 * lw, 0.28 * lw] },
      { b: p + 'ankle', p: [0, 0, 0], r: [0.24 * lw, 0.26 * lw] },
      { b: p + 'foot', p: [0, 0.15 * lw, 0.04 * lw], r: [0.3 * lw, 0.3 * lw] },
      { b: p + 'foot', p: [0, 0.06 * lw, 0.06 * lw], r: [0.31 * lw, 0.3 * lw] },
    ], { seg: 14, per: 3, up: [0, 0, 1], ts: 0.8, lump: 0.04, sf: 3 });
    for (let t = -1; t <= 1; t++) B.horn(p + 'foot', [t * 0.16 * lw, 0.06 * lw, 0.3 * lw], [Math.PI / 2 + 0.5, 0, 0], 0.13 * lw, 0.07 * lw, 0.2, P.claw, P.claw.clone().lerp(P.horn, 0.3), 'horn', 6, 3);
  }
  B.socket('chest', 'jet', 0, 0, 0);
  return o;
}
function scutes(B, from, to, k = 1, col) { // row of dark bony studs along the back
  const pts = B.bodyPts.slice(from, to);
  for (const q of pts) B.horn(q.b, [q.p[0], q.p[1] + q.r[1] * 0.97, q.p[2]], [0, 0, 0], q.r[1] * 0.28 * k, q.r[0] * 0.12 * k + 0.02, -0.4, col || B.pal.hornDark, B.pal.hornDark.clone().lerp(B.pal.horn, 0.3), 'horn', 6, 3);
}

const SPECIES = {
  trex(B) {
    const o = theropod(B, { hipH: 3, hipW: 0.6, body: 1.9, w: 1, hs: 1, neck: [1.0, 0.75], tailN: 9, tailL: 0.78, tailR: 0.75,
      hipR: [0.92, 1.08], bellyR: [1.1, 1.28], chestR: [1.0, 1.18], neckR: [0.7, 0.8], leg: [1.35, 1.3, 0.75], legW: 1.28, foot: 0.8, toeSpread: 0.24,
      shW: 0.55, shY: 0.42, arm: [0.38, 0.32], armW: 1, fingers: 2,
      jawY: -0.24, jawZ: 0.02,
      headPts: [[-0.3, 0.08, 0.5, 0.52], [0.12, 0.14, 0.62, 0.64], [0.55, 0.1, 0.56, 0.6], [1.0, 0.03, 0.46, 0.52], [1.42, -0.03, 0.38, 0.44], [1.74, -0.07, 0.32, 0.36], [1.94, -0.12, 0.2, 0.2]],
      jawPts: [[-0.18, 0.0, 0.42, 0.34], [0.35, -0.05, 0.47, 0.37], [0.9, -0.01, 0.4, 0.3], [1.4, 0.02, 0.32, 0.22], [1.76, 0.05, 0.24, 0.15], [1.9, 0.06, 0.12, 0.08]],
      teeth: [0.35, 1.84, 9, 0.27], eyeP: [0.44, 0.34, 0.58], eyeR: 0.1, browTilt: 0.1, scar: [1.15, 1.0], sf: 2.1 });
    // brow bosses behind the eyes + jaw muscle bulges
    for (const sd of [1, -1]) { B.horn('head', [sd * 0.4, 0.5, 0.38], [-0.5, 0, sd * -0.45], 0.2, 0.12, -0.3, B.pal.hornDark, B.pal.hornDark.clone().lerp(B.pal.back, 0.5)); B.blob('head', [sd * 0.42, -0.05, 0.1], [0.2, 0.3, 0.38], [0, 0, 0], B.pal.back.clone().multiplyScalar(0.95)); }
    scutes(B, 4, 16, 1.2);
    return o;
  },
  carno(B) {
    const o = theropod(B, { hipH: 3, hipW: 0.52, body: 1.7, w: 0.85, hs: 0.95, neck: [1.0, 0.6], tailN: 10, tailL: 0.72, tailR: 0.65,
      hipR: [0.78, 0.92], bellyR: [0.9, 1.05], chestR: [0.85, 1.0], neckR: [0.55, 0.62], leg: [1.35, 1.45, 0.85], legW: 0.92, foot: 0.7, toeSpread: 0.2,
      shW: 0.48, shY: 0.4, arm: [0.24, 0.18], armW: 0.85, fingers: 3, handClaw: 0.6,
      jawY: -0.26, jawZ: 0.02,
      headPts: [[-0.25, 0.05, 0.38, 0.44], [0.15, 0.12, 0.45, 0.52], [0.55, 0.08, 0.4, 0.46], [0.95, -0.02, 0.31, 0.36], [1.25, -0.08, 0.25, 0.28], [1.42, -0.12, 0.15, 0.16]],
      jawPts: [[-0.15, 0.0, 0.32, 0.25], [0.35, -0.04, 0.35, 0.26], [0.85, 0.0, 0.28, 0.2], [1.25, 0.03, 0.2, 0.13], [1.38, 0.04, 0.1, 0.07]],
      teeth: [0.3, 1.32, 7, 0.18], eyeP: [0.36, 0.28, 0.55], eyeR: 0.08, browTilt: 0.2, scar: [0.8, 2.0], sf: 3.2 });
    for (const sd of [1, -1]) {
      B.horn('head', [sd * 0.28, 0.5, 0.42], [0.2, 0, sd * -1.05], 0.55, 0.15, 0.35, B.pal.hornDark, B.pal.horn); // the bull horns
      // rows of bony osteoderm studs along the flanks
      for (let i = 3; i < B.bodyPts.length - 2; i++) { const q = B.bodyPts[i]; B.horn(q.b, [sd * q.r[0] * 0.72, q.p[1] + q.r[1] * 0.62, q.p[2]], [0, 0, sd * -0.8], 0.14, 0.08, 0, B.pal.hornDark, B.pal.hornDark.clone().lerp(B.pal.horn, 0.4), 'horn', 6, 2); }
    }
    scutes(B, 5, 16, 0.8);
    return o;
  },
  velo(B) {
    const P = B.pal;
    const o = theropod(B, { hipH: 2.6, hipW: 0.42, body: 1.5, w: 0.7, hs: 0.85, neck: [1.0, 0.75], tailN: 10, tailL: 0.75, tailR: 0.45,
      hipR: [0.62, 0.74], bellyR: [0.66, 0.8], chestR: [0.62, 0.76], neckR: [0.36, 0.4], leg: [1.15, 1.3, 0.8], legW: 0.78, foot: 0.6, toeSpread: 0.15, sickle: true,
      shW: 0.4, shY: 0.35, arm: [0.62, 0.55], armW: 0.8, fingers: 3, handClaw: 1.3,
      jawY: -0.17, jawZ: 0.02,
      headPts: [[-0.22, 0.05, 0.3, 0.32], [0.15, 0.07, 0.33, 0.33], [0.5, 0.04, 0.27, 0.27], [0.95, -0.02, 0.17, 0.18], [1.3, -0.05, 0.12, 0.12], [1.42, -0.07, 0.07, 0.07]],
      jawPts: [[-0.15, 0.0, 0.24, 0.17], [0.4, -0.02, 0.24, 0.16], [0.95, 0.01, 0.15, 0.1], [1.32, 0.02, 0.09, 0.06], [1.4, 0.02, 0.05, 0.04]],
      teeth: [0.3, 1.32, 9, 0.1], eyeP: [0.27, 0.2, 0.48], eyeR: 0.075, browTilt: 0.3, sf: 4.2 });
    // feathers: crest, arm wings, back quills and a tail fan (accent colour tips)
    const fc = (y0, y1) => v => P.back.clone().lerp(P.accent, sstep(y0, y1, v.y));
    const feather = (bone, p, rot, L, W) => B.plate(bone, [[0, 0], [W * 0.5, L * 0.35], [W * 0.25, L], [0, L * 1.05], [-W * 0.25, L], [-W * 0.5, L * 0.35]], 0.02, M(p, rot), fc(L * 0.3, L), 'skin', 0.01);
    for (let i = 0; i < 5; i++) feather('head', [0, 0.32, 0.05 - i * 0.12], [-1.2 - i * 0.12, 0, 0], 0.32 + i * 0.03, 0.09);
    for (const S of ['L', 'R']) { const sd = S === 'L' ? 1 : -1; for (let i = 0; i < 6; i++) feather(S + 'el', [sd * 0.05, -0.05 - i * 0.07, 0.02 - i * 0.03], [-0.4 - i * 0.15, 0, sd * 0.1], 0.55 - i * 0.03, 0.12); }
    for (let i = 3; i < 15; i++) { const q = B.bodyPts[i]; if (!q) break; feather(q.b, [0, q.p[1] + q.r[1] * 0.85, q.p[2]], [-1.9, 0, 0], 0.22 + 0.1 * Math.sin(i * 0.4), 0.09); }
    for (let k = -3; k <= 3; k++) feather('tail9', [k * 0.03, 0.02, -0.4], [-1.57, k * 0.18, 0], 0.75 - Math.abs(k) * 0.07, 0.16);
    return o;
  },
  spinos(B) {
    const P = B.pal;
    const o = theropod(B, { hipH: 2.6, hipW: 0.58, body: 2.2, w: 0.9, hs: 1, neck: [1.15, 0.65], tailN: 10, tailL: 0.8, tailR: 0.58, tailFlat: 0.7, tailTall: 1.5,
      hipR: [0.78, 0.9], bellyR: [0.92, 1.05], chestR: [0.88, 1.0], neckR: [0.5, 0.58], leg: [1.15, 1.05, 0.65], legW: 1.0, foot: 0.75, toeSpread: 0.22,
      shW: 0.5, shY: 0.45, arm: [0.72, 0.62], armW: 1.05, fingers: 3, handClaw: 1.4,
      jawY: -0.17, jawZ: 0.0,
      headPts: [[-0.25, 0.05, 0.36, 0.38], [0.2, 0.06, 0.38, 0.36], [0.65, 0.02, 0.28, 0.26], [1.25, -0.03, 0.19, 0.19], [1.85, -0.05, 0.16, 0.15], [2.3, -0.04, 0.2, 0.17], [2.48, -0.06, 0.1, 0.09]],
      jawPts: [[-0.15, 0.0, 0.3, 0.2], [0.5, -0.02, 0.25, 0.17], [1.3, 0.0, 0.16, 0.11], [1.95, 0.01, 0.14, 0.09], [2.3, 0.02, 0.15, 0.09], [2.42, 0.02, 0.07, 0.05]],
      teeth: [0.4, 2.4, 11, 0.16], eyeP: [0.32, 0.22, 0.5], eyeR: 0.075, browTilt: 0.2, sf: 2.6 });
    B.blob('head', [0, 0.3, 0.75], [0.07, 0.12, 0.45], [0.1, 0, 0], P.back); // crest
    // the sail: three overlapping skinned sections so it bends with the back
    const sailCol = v => P.back.clone().lerp(P.accent, sstep(0.6, 2.6, v.y)).lerp(P.stripe, 0.5 * sstep(0.55, 0.85, Math.sin(v.x * 5 + v.y * 1.5)));
    const sail = (bone, z0, z1, h0, h1, y) => B.plate(bone, [[z0, 0], [z0, h0 * 0.75], [(z0 + z1) / 2, (h0 + h1) / 2 * 1.04], [z1, h1 * 0.75], [z1, 0]], 0.08, M([0, y, 0], [0, -Math.PI / 2, 0]), sailCol, 'skin', 0.04);
    sail('pelvis', -1.4, 0.2, 1.4, 2.3, 0.6); sail('spine', -0.5, 0.75, 2.4, 2.9, 0.7); sail('chest', -0.5, 0.95, 2.9, 1.8, 0.68);
    for (const [bn, zs] of [['pelvis', [-1.2, -0.7, -0.2]], ['spine', [-0.25, 0.25, 0.7]], ['chest', [0.0, 0.5]]]) for (const z of zs) B.blob(bn, [0, 1.6, z], [0.06, 1.2, 0.06], [0, 0, 0], P.back.clone().multiplyScalar(0.8));
    for (let i = 2; i < 9; i++) B.plate('tail' + i, [[0.4, 0], [0.25, 0.5 - i * 0.03], [-0.5, 0.42 - i * 0.03], [-0.8, 0]], 0.05, M([0, 0.35 - i * 0.02, 0], [0, -Math.PI / 2, 0]), v => P.back.clone().lerp(P.accent, sstep(0.1, 0.45, v.y) * 0.7), 'skin', 0.02);
    return o;
  },
  trice(B) {
    const P = B.pal;
    const o = quadruped(B, { hipH: 2.2, hipW: 0.85, shW: 0.82, body: 2.4, neckN: 1, neckL: 0.5, neckRise: -0.05, headZ: 0.45, headY: -0.05, tailN: 7, tailL: 0.7, tailR: 0.62, tailDrop: 0.06,
      hipR: [1.15, 1.2], bellyR: [1.35, 1.35], chestR: [1.2, 1.25], neckR: [0.85, 0.9], neckTaper: 0.2, legB: [0.95, 0.85, 0.35], legF: [0.85, 0.78, 0.3], legW: 1.3, legWF: 1.15,
      jawY: -0.32, jawZ: 0.35, eyeP: [0.48, 0.32, 0.55], eyeR: 0.08, browTilt: 0.15, sf: 1.8,
      headPts: [[-0.4, 0.1, 0.72, 0.7], [0.15, 0.08, 0.7, 0.66], [0.65, -0.05, 0.5, 0.52], [1.05, -0.18, 0.32, 0.38], [1.32, -0.32, 0.16, 0.2]],
      jawPts: [[0.0, 0.0, 0.48, 0.26], [0.55, -0.06, 0.38, 0.22], [0.95, -0.1, 0.22, 0.15], [1.1, -0.12, 0.1, 0.07]] });
    // frill: big shield with scalloped edge and spikes, bold accent pattern
    const fr = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * (-0.08 + i / 24 * 1.16), rr = 1.75 + 0.08 * Math.cos(i * Math.PI); fr.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.92]); } fr.push([-0.55, -0.35], [0.55, -0.35]);
    const frc = v => { const d = Math.hypot(v.x, v.y / 0.92); let c = P.back.clone().lerp(P.accent, sstep(0.9, 1.45, d)); if (Math.hypot(Math.abs(v.x) - 0.75, v.y - 0.85) < 0.28) c = P.accent.clone().multiplyScalar(1.1); if (Math.hypot(Math.abs(v.x) - 0.75, v.y - 0.85) < 0.13) c = P.stripe.clone(); return c.lerp(P.stripe, d > 1.62 ? 0.6 : 0); };
    B.plate('head', fr, 0.16, M([0, 0.45, -0.35], [-0.65, 0, 0]), frc, 'skin', 0.06);
    for (let i = 0; i <= 12; i++) { const a = Math.PI * (-0.04 + i / 12 * 1.08); const x = Math.cos(a) * 1.78, y = Math.sin(a) * 1.64; const q = V(x, y, 0).applyEuler(new THREE.Euler(-0.65, 0, 0)).add(V(0, 0.45, -0.35));
      B.horn('head', [q.x, q.y, q.z], [-0.65, 0, -(a - Math.PI / 2)], 0.3, 0.09, 0, P.hornDark, P.horn, 'horn', 6, 3); }
    for (const sd of [1, -1]) B.horn('head', [sd * 0.33, 0.5, 0.45], [1.05, 0, sd * -0.18], 1.35, 0.16, 0.3, P.hornDark, P.horn, 'horn', 10, 8);
    B.horn('head', [0, 0.12, 1.05], [0.55, 0, 0], 0.42, 0.11, 0.2, P.hornDark, P.horn);
    B.horn('head', [0, -0.25, 1.25], [1.9, 0, 0], 0.25, 0.14, -0.3, P.claw, P.hornDark); // beak
    return o;
  },
  ankys(B) {
    const P = B.pal;
    const o = quadruped(B, { hipH: 1.75, hipW: 0.95, shW: 0.9, body: 2.4, neckN: 1, neckL: 0.4, neckRise: -0.02, headZ: 0.35, headY: -0.05, tailN: 8, tailL: 0.62, tailR: 0.55, tailDrop: 0.02, tailFlat: 1.1,
      hipR: [1.45, 0.92], bellyR: [1.65, 1.0], chestR: [1.5, 0.95], neckR: [0.75, 0.6], neckTaper: 0.15, top: 0.85, belly: 0.75, ridge: 0.0,
      legB: [0.72, 0.6, 0.3], legF: [0.68, 0.55, 0.28], legW: 1.2, legWF: 1.1,
      jawY: -0.2, jawZ: 0.15, eyeP: [0.42, 0.2, 0.4], eyeR: 0.07, browTilt: 0.2, sf: 1.4,
      headPts: [[-0.3, 0.05, 0.62, 0.45], [0.15, 0.05, 0.62, 0.44], [0.55, -0.02, 0.48, 0.36], [0.82, -0.08, 0.3, 0.24], [0.92, -0.1, 0.15, 0.12]],
      jawPts: [[0.0, 0.0, 0.42, 0.18], [0.5, -0.03, 0.34, 0.15], [0.72, -0.05, 0.18, 0.1]] });
    // bony armor: rows of studs/spikes across the back, big side spikes, head horns, club tail
    for (let i = 2; i < B.bodyPts.length - 1; i++) { const q = B.bodyPts[i], n = i > B.bodyPts.length - 5 ? 3 : i < 6 ? 3 : 7;
      for (let k = 0; k < n; k++) { const a = Math.PI * (n === 7 ? 0.08 + k / 6 * 0.84 : 0.25 + k / 2 * 0.5), x = Math.cos(a) * q.r[0] * 0.98, y = Math.sin(a) * q.r[1] * 0.82;
        const side = k === 0 || k === n - 1; B.horn(q.b, [q.p[0] + x, q.p[1] + y, q.p[2]], [0, 0, a - Math.PI / 2], side ? 0.42 : 0.16, side ? 0.13 : 0.12, 0, P.hornDark, side ? P.horn : P.hornDark.clone().lerp(P.horn, 0.35), 'horn', 6, side ? 4 : 2); } }
    for (const sd of [1, -1]) { B.horn('head', [sd * 0.5, 0.22, -0.2], [-0.6, 0, sd * -1.2], 0.35, 0.11, 0); B.horn('head', [sd * 0.5, -0.05, 0.05], [0, 0, sd * -1.7], 0.25, 0.09, 0); }
    B.blob('tail7', [0, 0, -0.5], [0.55, 0.32, 0.5], [0, 0, 0], P.hornDark.clone().lerp(P.back, 0.3), 'horn', 14);
    for (const sd of [1, -1]) B.blob('tail7', [sd * 0.38, 0, -0.45], [0.36, 0.3, 0.42], [0, sd * 0.3, 0], P.hornDark.clone().lerp(P.horn, 0.2), 'horn', 12);
    B.socket('tail7', 'club', 0, 0, -0.5);
    return o;
  },
  stegos(B) {
    const P = B.pal;
    const o = quadruped(B, { hipH: 2.5, hipW: 0.72, shW: 0.68, body: 2.3, spineY: 0.2, chestY: -0.45, neckN: 2, neckL: 0.55, neckRise: -0.12, headZ: 0.45, headY: -0.05, tailN: 8, tailL: 0.72, tailR: 0.58, tailDrop: 0.08,
      hipR: [0.95, 1.15], bellyR: [1.05, 1.2], chestR: [0.92, 1.0], neckR: [0.55, 0.55], neckTaper: 0.35,
      legB: [1.15, 1.0, 0.35], legF: [0.72, 0.62, 0.28], legW: 1.1, legWF: 0.88,
      jawY: -0.14, jawZ: 0.1, eyeP: [0.24, 0.12, 0.38], eyeR: 0.06, browTilt: 0.25, sf: 2.8,
      headPts: [[-0.25, 0.0, 0.32, 0.3], [0.15, 0.02, 0.34, 0.3], [0.5, -0.04, 0.26, 0.23], [0.8, -0.08, 0.16, 0.15], [0.9, -0.1, 0.08, 0.08]],
      jawPts: [[0.0, 0.0, 0.24, 0.12], [0.5, -0.02, 0.2, 0.1], [0.78, -0.03, 0.1, 0.06]] });
    const pc = v => P.back.clone().lerp(P.accent, sstep(0.25, 0.95, v.y / 1.4)).lerp(P.stripe, 0.4 * sstep(0.5, 0.9, Math.sin(v.y * 9 + v.x * 3)));
    const kite = h => [[0, -0.1], [0.45 * h, 0.5 * h], [0.1 * h, 1.3 * h], [0, 1.38 * h], [-0.12 * h, 1.25 * h], [-0.45 * h, 0.45 * h]];
    const bp = B.bodyPts; let side = 1;
    for (let i = 4; i < bp.length - 1; i++) { const q = bp[i], u = (i - 4) / (bp.length - 5), h = 0.45 + 0.75 * Math.sin(Math.min(1, u * 1.25) * Math.PI) ** 0.8;
      for (const sd of [1, -1]) B.plate(q.b, kite(h), 0.08, M([sd * 0.18, q.p[1] + q.r[1] * 0.8, q.p[2] + sd * side * 0.12], [0, Math.PI / 2, sd * -0.18]), pc, 'skin', 0.03);
      side = -side; }
    for (const [x, rz] of [[0.18, -0.9], [-0.18, 0.9], [0.14, -1.25], [-0.14, 1.25]]) B.horn('tail7', [x, 0.12, x > 0 === rz < -1 ? -0.1 : -0.4], [0.5, 0, rz], 0.85, 0.1, -0.15, P.hornDark, P.horn, 'horn', 8, 5);
    return o;
  },
  brachio(B) {
    const P = B.pal;
    const o = quadruped(B, { hipH: 2.6, hipW: 0.8, shW: 0.78, body: 2.6, spineY: 0.2, chestY: 0.35, neckN: 6, neckL: 0.72, neckRise: 0.62, headZ: 0.35, headY: 0.1, tailN: 8, tailL: 0.75, tailR: 0.7, tailDrop: 0.1,
      hipR: [1.05, 1.2], bellyR: [1.25, 1.35], chestR: [1.15, 1.3], neckR: [0.7, 0.75], neckTaper: 0.58, ridge: 0.08,
      legB: [1.2, 1.1, 0.4], legF: [1.6, 1.45, 0.45], legW: 1.25, legWF: 1.2,
      jawY: -0.12, jawZ: 0.05, eyeP: [0.22, 0.18, 0.25], eyeR: 0.06, browTilt: 0.2, sf: 1.6,
      headPts: [[-0.25, 0.0, 0.28, 0.28], [0.1, 0.05, 0.3, 0.32], [0.4, 0.0, 0.25, 0.24], [0.7, -0.06, 0.2, 0.17], [0.85, -0.08, 0.12, 0.1]],
      jawPts: [[0.0, 0.0, 0.22, 0.12], [0.5, -0.02, 0.18, 0.1], [0.75, -0.03, 0.1, 0.06]] });
    B.blob('head', [0, 0.32, 0.15], [0.2, 0.22, 0.3], [0, 0, 0], P.back); // nasal crest
    for (let i = 0; i < 6; i++) B.horn('neck' + i, [0, 0.62 - i * 0.06, 0], [-0.4, 0, 0], 0.2, 0.08, 0, P.hornDark, P.horn, 'horn', 6, 2);
    scutes(B, 2, 12, 1);
    return o;
  },
  // ---------------- v4: more dinos ----------------
  giga(B) {
    const P = B.pal;
    const o = theropod(B, { hipH: 3.2, hipW: 0.6, body: 2.2, w: 0.95, hs: 1.1, neck: [1.05, 0.7], tailN: 10, tailL: 0.82, tailR: 0.72,
      hipR: [0.88, 1.05], bellyR: [1.02, 1.2], chestR: [0.95, 1.12], neckR: [0.66, 0.76], leg: [1.4, 1.35, 0.78], legW: 1.22, foot: 0.8, toeSpread: 0.24,
      shW: 0.52, shY: 0.42, arm: [0.42, 0.36], armW: 0.95, fingers: 3, jawY: -0.24, jawZ: 0.02,
      headPts: [[-0.3, 0.08, 0.44, 0.5], [0.12, 0.14, 0.52, 0.6], [0.6, 0.12, 0.46, 0.58], [1.1, 0.05, 0.38, 0.5], [1.55, -0.02, 0.3, 0.42], [1.9, -0.07, 0.26, 0.34], [2.1, -0.12, 0.16, 0.18]],
      jawPts: [[-0.18, 0, 0.36, 0.32], [0.4, -0.05, 0.4, 0.35], [1.0, -0.01, 0.34, 0.28], [1.5, 0.02, 0.27, 0.2], [1.9, 0.05, 0.2, 0.14], [2.04, 0.06, 0.1, 0.07]],
      teeth: [0.35, 2.0, 10, 0.28], eyeP: [0.4, 0.36, 0.6], eyeR: 0.1, browTilt: 0.25, scar: [1.4, 2.2], sf: 2.6 });
    // knobbly ridge along the snout + heavy brow horns
    for (let i = 0; i < 6; i++) B.horn('head', [0, 0.62 - i * 0.04, 0.55 + i * 0.22], [-0.25, 0, 0], 0.12 + 0.04 * Math.sin(i), 0.07, -0.2, P.hornDark, P.hornDark.clone().lerp(P.horn, 0.4), 'horn', 6, 2);
    for (const sd of [1, -1]) { B.horn('head', [sd * 0.38, 0.52, 0.45], [-0.6, 0, sd * -0.5], 0.28, 0.13, -0.3, P.hornDark, P.hornDark.clone().lerp(P.back, 0.5)); B.blob('head', [sd * 0.4, -0.05, 0.1], [0.2, 0.3, 0.4], [0, 0, 0], P.back.clone().multiplyScalar(0.95)); }
    scutes(B, 3, 18, 1.5);
    return o;
  },
  allo(B) {
    const P = B.pal;
    const o = theropod(B, { hipH: 2.9, hipW: 0.55, body: 1.9, w: 0.85, hs: 0.95, neck: [1.0, 0.7], tailN: 10, tailL: 0.75, tailR: 0.62,
      hipR: [0.78, 0.94], bellyR: [0.88, 1.06], chestR: [0.84, 1.0], neckR: [0.52, 0.6], leg: [1.3, 1.35, 0.8], legW: 0.98, foot: 0.72, toeSpread: 0.2,
      shW: 0.48, shY: 0.4, arm: [0.5, 0.42], armW: 0.95, fingers: 3, handClaw: 1.3, jawY: -0.22, jawZ: 0.02,
      headPts: [[-0.25, 0.05, 0.38, 0.44], [0.15, 0.12, 0.44, 0.52], [0.6, 0.08, 0.38, 0.46], [1.05, 0.0, 0.3, 0.38], [1.4, -0.06, 0.24, 0.28], [1.6, -0.1, 0.14, 0.15]],
      jawPts: [[-0.15, 0, 0.32, 0.26], [0.4, -0.04, 0.34, 0.26], [0.95, 0, 0.28, 0.2], [1.4, 0.03, 0.2, 0.13], [1.55, 0.04, 0.1, 0.07]],
      teeth: [0.3, 1.5, 8, 0.2], eyeP: [0.35, 0.3, 0.55], eyeR: 0.085, browTilt: 0.3, sf: 3.6 });
    // the famous horn crests in front of the eyes + twin nasal ridges
    for (const sd of [1, -1]) { B.horn('head', [sd * 0.27, 0.5, 0.68], [-0.35, 0, sd * -0.25], 0.36, 0.14, -0.25, P.accent.clone().multiplyScalar(0.7), P.hornDark);
      for (let i = 0; i < 4; i++) B.horn('head', [sd * 0.14, 0.5 - i * 0.05, 0.95 + i * 0.16], [-0.2, 0, sd * -0.15], 0.09, 0.05, 0, P.hornDark, P.hornDark.clone().lerp(P.horn, 0.3), 'horn', 6, 2); }
    scutes(B, 4, 17, 1.0);
    return o;
  },
  dilo(B) {
    const P = B.pal;
    const o = theropod(B, { hipH: 2.5, hipW: 0.42, body: 1.55, w: 0.72, hs: 0.85, neck: [1.05, 0.85], tailN: 10, tailL: 0.72, tailR: 0.48,
      hipR: [0.62, 0.74], bellyR: [0.68, 0.82], chestR: [0.64, 0.78], neckR: [0.38, 0.42], leg: [1.15, 1.25, 0.75], legW: 0.8, foot: 0.62, toeSpread: 0.16,
      shW: 0.4, shY: 0.36, arm: [0.5, 0.45], armW: 0.8, fingers: 3, handClaw: 1.1, jawY: -0.17, jawZ: 0.02,
      headPts: [[-0.22, 0.05, 0.31, 0.33], [0.15, 0.07, 0.34, 0.34], [0.55, 0.03, 0.27, 0.27], [0.98, -0.03, 0.18, 0.19], [1.3, -0.06, 0.13, 0.13], [1.42, -0.08, 0.07, 0.07]],
      jawPts: [[-0.15, 0, 0.25, 0.17], [0.4, -0.02, 0.24, 0.16], [0.95, 0.01, 0.15, 0.1], [1.32, 0.02, 0.09, 0.06], [1.4, 0.02, 0.05, 0.04]],
      teeth: [0.3, 1.32, 9, 0.11], eyeP: [0.27, 0.2, 0.48], eyeR: 0.075, browTilt: 0.3, sf: 4 });
    // twin head crests
    const cc = v => P.accent.clone().lerp(P.stripe, 0.6 * sstep(0.25, 0.5, Math.sin(v.x * 9)));
    for (const sd of [1, -1]) B.plate('head', [[-0.35, 0], [-0.2, 0.28], [0.25, 0.5], [0.75, 0.26], [1.0, 0]], 0.04, M([sd * 0.11, 0.28, 0.25], [0, -Math.PI / 2, sd * 0.14]), cc, 'skin', 0.02);
    // the folding neck frill (opens when it spits)
    const fan = sd => { const pts = [[0, -0.28]]; for (let i = 0; i <= 10; i++) { const a = -1.25 + i / 10 * 2.5, r = 1.05 + 0.08 * Math.cos(i * Math.PI); pts.push([sd * Math.cos(a) * r, Math.sin(a) * r]); } pts.push([0, 0.28]); return pts; };
    const fc = v => { const d = Math.hypot(v.x, v.y); return P.accent.clone().lerp(P.stripe, sstep(0.55, 0.7, d) * (1 - sstep(0.8, 0.95, d))).lerp(C(0xffe060), sstep(0.92, 1.05, d) * 0.8); };
    for (const [sd, S] of [[1, 'L'], [-1, 'R']]) { B.bone('frill' + S, 'head', sd * 0.22, -0.02, -0.12); B.plate('frill' + S, fan(sd), 0.03, M([0, 0, 0]), fc, 'skin', 0.015);
      for (let i = 0; i < 5; i++) { const a = -1.0 + i * 0.5; B.horn('frill' + S, [0, 0, 0.02], [0, 0, -sd * (Math.PI / 2 - a)], 0.95, 0.025, 0, P.stripe, P.accent, 'horn', 5, 2); } }
    return o;
  },
  pachy(B) {
    const P = B.pal;
    const o = theropod(B, { hipH: 2.2, hipW: 0.45, body: 1.5, w: 0.85, hs: 0.8, neck: [0.8, 0.55], tailN: 9, tailL: 0.62, tailR: 0.52,
      hipR: [0.7, 0.82], bellyR: [0.82, 0.92], chestR: [0.72, 0.82], neckR: [0.42, 0.48], leg: [1.05, 1.05, 0.6], legW: 0.88, foot: 0.6, toeSpread: 0.18,
      shW: 0.4, shY: 0.35, arm: [0.3, 0.26], armW: 0.75, fingers: 3, handClaw: 0.6, jawY: -0.14, jawZ: 0.05,
      headPts: [[-0.25, 0.1, 0.34, 0.38], [0.1, 0.12, 0.38, 0.42], [0.45, 0.0, 0.3, 0.32], [0.75, -0.12, 0.18, 0.2], [0.88, -0.18, 0.1, 0.1]],
      jawPts: [[-0.1, 0, 0.26, 0.16], [0.35, -0.03, 0.24, 0.14], [0.7, -0.02, 0.12, 0.08], [0.8, -0.01, 0.06, 0.05]],
      teeth: [0.3, 0.8, 5, 0.08], eyeP: [0.3, 0.15, 0.42], eyeR: 0.08, browTilt: 0.1, sf: 3 });
    // the thick bony battering dome, ringed with knobs and spikes
    const dome = P.horn.clone().lerp(P.accent, 0.25);
    B.blob('head', [0, 0.42, 0.05], [0.46, 0.42, 0.54], [0.15, 0, 0], v => dome.clone().lerp(P.hornDark, sstep(0.2, -0.6, v.y) * 0.5), 'horn', 18);
    for (let i = 0; i < 11; i++) { const a = -Math.PI * 0.95 + i / 10 * Math.PI * 1.9; const x = Math.sin(a) * 0.45, z = 0.05 + Math.cos(a) * 0.5;
      B.horn('head', [x, 0.3, z], [Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2], 0.16 + 0.06 * (i % 2), 0.06, 0, P.hornDark, P.horn, 'horn', 6, 2); }
    for (let i = 0; i < 3; i++) B.horn('head', [0, 0.12 - i * 0.05, 0.5 + i * 0.13], [0.6, 0, 0], 0.08, 0.05, 0, P.hornDark, P.horn, 'horn', 6, 2);
    scutes(B, 4, 14, 0.9);
    return o;
  },
  para(B) {
    const P = B.pal;
    const o = quadruped(B, { hipH: 2.4, hipW: 0.7, shW: 0.6, body: 2.2, spineY: 0.12, chestY: -0.25, neckN: 3, neckL: 0.55, neckRise: 0.25, headZ: 0.4, headY: 0.05, tailN: 9, tailL: 0.75, tailR: 0.6, tailDrop: 0.03,
      hipR: [0.9, 1.1], bellyR: [1.0, 1.15], chestR: [0.85, 0.95], neckR: [0.5, 0.55], neckTaper: 0.45,
      legB: [1.25, 1.1, 0.4], legF: [0.8, 0.75, 0.25], legW: 1.05, legWF: 0.7,
      jawY: -0.15, jawZ: 0.1, eyeP: [0.24, 0.14, 0.3], eyeR: 0.065, browTilt: 0.2, sf: 2.4,
      headPts: [[-0.25, 0.0, 0.3, 0.3], [0.15, 0.02, 0.3, 0.28], [0.5, -0.06, 0.24, 0.2], [0.8, -0.12, 0.2, 0.14], [0.95, -0.14, 0.18, 0.1]],
      jawPts: [[0, 0, 0.22, 0.1], [0.5, -0.02, 0.18, 0.08], [0.85, -0.03, 0.14, 0.06]] });
    // the long hollow trumpet crest
    B.tube([{ b: 'head', p: [0, 0.18, 0.5], r: [0.1, 0.12] }, { b: 'head', p: [0, 0.42, 0.05], r: [0.12, 0.15] }, { b: 'head', p: [0, 0.72, -0.55], r: [0.11, 0.14] }, { b: 'head', p: [0, 0.95, -1.25], r: [0.08, 0.09] }],
      { seg: 12, per: 4, ts: 0.5, color: (up, arc) => P.accent.clone().lerp(P.stripe, sstep(0.6, 0.9, Math.sin(arc * 7)) * 0.6) });
    scutes(B, 3, 15, 0.7);
    return o;
  },
  // ---------------- v4: DRAGONS (fire / ice / storm / the Dragon King) ----------------
  dragon(B) {
    const P = B.pal, el = B.def.element || 'fire', king = el === 'king', K = king ? 1.35 : 1;
    const o = quadruped(B, { hipH: 2.3, hipW: 0.62, shW: 0.6, body: 2.2, spineY: 0.12, chestY: 0.05, neckN: 4, neckL: 0.62, neckRise: 0.32, headZ: 0.5, headY: 0.05, tailN: 11, tailL: 0.72, tailR: 0.62, tailDrop: 0.02,
      hipR: [0.9, 1.02], bellyR: [1.08, 1.18], chestR: [1.08, 1.2], neckR: [0.66, 0.7], neckTaper: 0.52, ridge: 0.1,
      legB: [1.05, 0.95, 0.4], legF: [0.95, 0.85, 0.32], legW: 0.95, legWF: 0.82,
      jawY: -0.2, jawZ: 0.05, eyeP: [0.3, 0.24, 0.42], eyeR: 0.08, browTilt: 0.4, sf: 3,
      headPts: [[-0.3, 0.05, 0.38, 0.36], [0.1, 0.1, 0.42, 0.4], [0.5, 0.06, 0.34, 0.3], [0.95, -0.02, 0.26, 0.22], [1.3, -0.06, 0.21, 0.17], [1.5, -0.08, 0.1, 0.1]],
      jawPts: [[-0.1, 0, 0.3, 0.16], [0.5, -0.03, 0.27, 0.14], [1.05, 0, 0.19, 0.1], [1.4, 0.02, 0.1, 0.06]] });
    teethRow(B, 'head', 0.3, 1.38, 8, z => 0.3 - 0.1 * z, z => -0.12 - 0.04 * z, true, 0.15, 1);
    teethRow(B, 'jaw', 0.35, 1.3, 7, z => 0.24 - 0.1 * z, () => 0.03, false, 0.11, 1);
    // element colours for horns + spikes
    const HC = { fire: [0x1a0e0a, 0xd9c3a0], ice: [0x6aa8d8, 0xeafaff], storm: [0x1c1a2c, 0xfff08a], king: [0x0e0b08, 0xffc23a] }[el];
    P.hornDark = C(HC[0]); P.horn = C(HC[1]);
    const dirRot = d => { const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize())); return [e.x, e.y, e.z]; };
    // horns: big swept-back pair, a second pair, cheek blades, nose horn (+ a crown for the king)
    for (const sd of [1, -1]) {
      B.horn('head', [sd * 0.24, 0.38, -0.05], dirRot(V(sd * 0.3, 0.45, -1)), 1.15 * K, 0.13 * K, 0.22, P.hornDark, P.horn, 'horn', 10, 8);
      B.horn('head', [sd * 0.33, 0.18, -0.12], dirRot(V(sd * 0.7, 0.2, -1)), 0.65 * K, 0.08 * K, 0.18, P.hornDark, P.horn);
      for (let i = 0; i < 3; i++) B.horn('jaw', [sd * (0.27 - i * 0.04), -0.08, 0.1 + i * 0.25], dirRot(V(sd, -0.5, -0.6)), 0.3 - i * 0.06, 0.05, 0, P.hornDark, P.horn, 'horn', 6, 2);
      if (king) for (let i = 0; i < 3; i++) B.horn('head', [sd * (0.12 + i * 0.07), 0.42, 0.2 - i * 0.12], dirRot(V(sd * 0.25 * i, 1, -0.4)), 0.4 + 0.12 * i, 0.06, 0.1, P.hornDark, P.horn);
    }
    B.horn('head', [0, 0.14, 1.12], [0.7, 0, 0], 0.26, 0.06, -0.2, P.hornDark, P.horn);
    // spikes all down the neck, back and tail
    const bp = B.bodyPts;
    for (let i = 1; i < bp.length - 1; i++) { const q = bp[i], big = 0.25 + q.r[1] * 0.5;
      B.horn(q.b, [0, q.p[1] + q.r[1] * 0.93, q.p[2]], [-0.55, 0, 0], big * (king ? 1.2 : 1), q.r[0] * 0.14 + 0.03, -0.3, P.hornDark, P.horn, 'horn', 6, 3); }
    // spade tail blade
    B.plate('tail10', [[0, 0.25], [0.6, -0.35], [0.15, -0.55], [0, -1.35], [-0.15, -0.55], [-0.6, -0.35]], 0.05, M([0, 0, -0.35], [Math.PI / 2, 0, 0]), v => P.back.clone().lerp(P.accent, sstep(0.2, 0.6, Math.abs(v.x))), 'horn', 0.02);
    // inner-fire glow: throat + chest vents in the eye colour (pulses with the roar)
    for (const sd of [1, -1]) for (let i = 0; i < 3; i++) B.blob('ribs', [sd * 0.9, -0.15 + i * 0.12, -0.25 + i * 0.28], [0.03, 0.06, 0.28], [0, sd * 0.25, 0.3 * sd], P.eye, 'eye', 8);
    B.blob('neck1', [0, -0.42, 0.05], [0.18, 0.06, 0.32], [0, 0, 0], P.eye, 'eye', 8);
    if (el === 'ice') for (let i = 3; i < 14; i += 2) { const q = bp[i]; for (const sd of [1, -1]) B.horn(q.b, [sd * q.r[0] * 0.55, q.p[1] + q.r[1] * 0.7, q.p[2]], dirRot(V(sd * 0.8, 1, -0.3)), 0.35, 0.07, 0, P.hornDark, P.horn, 'horn', 5, 2); }
    // wings: arm bones + leathery membranes in three hinged sections + finger spars and claws
    const mem = P.accent.clone().lerp(P.back, 0.4).multiplyScalar(0.8), memC = v => mem.clone().lerp(P.back.clone().multiplyScalar(0.6), sstep(-0.3, -2.2, v.y) * 0.5).lerp(P.stripe, 0.4 * sstep(0.6, 0.95, Math.sin(v.x * 3.5 + v.y * 2)));
    for (const [sd, S] of [[1, 'L'], [-1, 'R']]) {
      B.bone(S + 'wing', 'chest', sd * 0.55, 0.82, 0.25); B.bone(S + 'wing2', S + 'wing', sd * 2.3, 0, 0); B.bone(S + 'wing3', S + 'wing2', sd * 2.1, 0, -0.1);
      B.tube([{ b: S + 'wing', p: [-sd * 0.25, -0.05, 0], r: [0.24, 0.26] }, { b: S + 'wing2', p: [0, 0, 0], r: [0.14, 0.15] }, { b: S + 'wing3', p: [0, 0, 0], r: [0.11, 0.11] }, { b: S + 'wing3', p: [sd * 1.9, 0, -0.3], r: [0.035, 0.035] }],
        { seg: 10, per: 3, up: [0, 0, 1], ts: 0.6, stripes: false });
      const mk = (bone, pts) => B.plate(bone, pts.map(([x, y]) => [sd * x, y]), 0.035, M([0, -0.02, 0], [Math.PI / 2, 0, 0]), memC, 'skin', 0.01);
      mk(S + 'wing', [[-0.15, 0.12], [2.35, 0.08], [2.35, -1.8], [1.6, -2.1], [0.8, -2.65], [-0.3, -2.45], [-0.45, -0.6]]);
      mk(S + 'wing2', [[0, 0.08], [2.1, 0.0], [1.95, -1.1], [1.4, -2.65], [0.7, -2.05], [-0.05, -1.85]]);
      mk(S + 'wing3', [[-0.3, 0.05], [1.95, -0.32], [1.2, -0.9], [1.1, -1.95], [0.5, -1.35], [-0.1, -2.2], [-0.35, -1.0]]);
      for (const [bn, d] of [[S + 'wing2', V(1.4, 0, -2.6)], [S + 'wing3', V(1.1, 0, -1.95)], [S + 'wing3', V(-0.1, 0, -2.2)], [S + 'wing', V(0.8, 0, -2.6)]])
        B.horn(bn, [0, 0, 0], dirRot(V(sd * d.x, 0, d.z)), d.length(), 0.055, 0, P.hornDark, P.back, 'horn', 5, 2);
      B.horn(S + 'wing3', [0, 0.05, 0.08], dirRot(V(sd * 0.3, 0.35, 1)), 0.42, 0.07, 0.3, P.claw, P.horn);
      B.horn(S + 'wing', [sd * 0.1, 0.18, 0], dirRot(V(sd * 0.2, 1, -0.6)), 0.45, 0.1, -0.2, P.hornDark, P.horn);
      B.horn(S + 'wing3', [sd * 1.9, 0, -0.3], dirRot(V(sd, 0.1, -0.2)), 0.35, 0.04, 0, P.hornDark, P.horn, 'horn', 5, 2);
    }
    B.socket('chest', 'jet', 0, 0.4, -0.3);
    return { ...o, flyer: true };
  },
};

// v5 "ON STEROIDS": huge glowing spikes down the back, armor plates on the flanks, big glowing head horns
// (and a cannon for the Brachio-Tank, lava cracks for the Lava Ankylo). Pure decoration on the shared body plan.
function roid(B, def) {
  const P = B.pal, pts = B.bodyPts || [], dark = P.hornDark, hot = P.eye.clone().lerp(P.accent, 0.35);
  for (let i = 2; i < pts.length - 1; i++) { const q = pts[i], len = q.r[1] * (0.7 + 0.25 * Math.sin(i * 1.7)) + 0.12, r0 = q.r[0] * 0.2 + 0.04;
    B.horn(q.b, [0, q.p[1] + q.r[1] * 0.9, q.p[2]], [-0.3, 0, 0], len, r0, -0.35, dark, dark.clone().lerp(P.accent, 0.4), 'horn', 6, 3);
    B.horn(q.b, [0, q.p[1] + q.r[1] * 0.92, q.p[2]], [-0.3, 0, 0], len * 1.16, r0 * 0.42, -0.35, hot, hot, 'eye', 5, 2);
    if (i % 3 === 0 && q.b.indexOf('tail') < 0) for (const sd of [1, -1]) B.blob(q.b, [sd * q.r[0] * 0.78, q.p[1] + q.r[1] * 0.3, q.p[2]], [q.r[0] * 0.42, q.r[1] * 0.3, q.r[0] * 0.62], [0, 0, sd * 0.55], dark.clone().lerp(P.back, 0.25), 'horn', 8); }
  const h = pts.find(q => q.b === 'head'); if (h && B.bones.head) { const hr = h.r[1];
    for (const sd of [1, -1]) { B.horn('head', [sd * hr * 0.55, hr * 0.9, hr * 0.4], [-0.75, 0, sd * -0.5], hr * 1.6, hr * 0.26, -0.5, dark, hot, 'horn', 7, 4);
      B.blob('head', [sd * hr * 0.55, hr * 0.9 + 0.02, hr * 0.4], [hr * 0.3, hr * 0.14, hr * 0.3], [0, 0, 0], hot, 'eye', 8); } }
  if (def.special === 'cannon' && B.bones.ribs) { // mega cannon strapped to the back
    B.part('ribs', new THREE.CylinderGeometry(0.32, 0.4, 2.6, 12), 'horn', M([0, 1.6, 0.3], [-1.1, 0, 0]), dark);
    B.part('ribs', new THREE.CylinderGeometry(0.26, 0.26, 0.12, 12), 'eye', M([0, 1.6 + Math.cos(1.1) * 1.3, 0.3 + Math.sin(1.1) * 1.3], [-1.1, 0, 0]), hot);
    B.blob('ribs', [0, 1.25, 0.2], [0.8, 0.45, 0.9], [0, 0, 0], dark, 'horn', 10);
    B.socket('ribs', 'cannon', 0, 1.6 + Math.cos(1.1) * 1.45, 0.3 + Math.sin(1.1) * 1.45); }
  if (def.special === 'lavaslam') for (let i = 0; i < pts.length; i += 2) { const q = pts[i]; // molten cracks
    B.blob(q.b, [q.r[0] * 0.3 * Math.sin(i * 2.3), q.p[1] + q.r[1] * 0.75, q.p[2]], [q.r[0] * 0.18, q.r[1] * 0.08, q.r[0] * 0.5], [0, 0.3 * i, 0], hot, 'eye', 6); }
}

export class Beast {
  constructor(def, assets, wild = false) {
    const B = new OB(def, wild);
    this.info = SPECIES[def.kind](B);
    if (def.roid) roid(B, def);
    this.obj = new THREE.Group();
    this.rig = B.finish(assets); this.obj.add(this.rig); this.rig.scale.setScalar(def.scale);
    this.b = B.bones; this.sockets = B.sockets; this.mats = B.mats; this.meshes = B.meshes; this.def = def; this.wild = wild; this.real = true;
    this.phase = Math.random() * 6; this.t = Math.random() * 10; this.seed = Math.random() * 10; this.jaw = 0; this.flash = 0; this.ko = 0;
    this.quad = !!this.b.LFhip; this.flyer = !!this.info.flyer;
    this.feet = Object.keys(this.b).filter(k => /^(L|R)F?foot$/.test(k));
    // drop the rig so the feet stand on the ground
    this.rig.updateMatrixWorld(true); let minY = Infinity; const v = V(0, 0, 0);
    for (const k of this.feet) { this.b[k].getWorldPosition(v); minY = Math.min(minY, v.y / def.scale); }
    this.hip0 = this.b.pelvis.position.y - minY + 0.02; this.b.pelvis.position.y = this.hip0; this.pelvisY = this.hip0;
    const hm = new THREE.SpriteMaterial({ map: assets.glow, color: B.mats.glowColor, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 });
    this.halos = []; for (const k of ['eyeL', 'eyeR']) if (this.sockets[k]) { const sp = new THREE.Sprite(hm); sp.scale.setScalar(0.95); this.sockets[k].add(sp); this.halos.push(sp); }
    this.haloMat = hm;
    const bb = new THREE.Box3(); for (const m of this.meshes) { m.geometry.computeBoundingBox(); bb.union(m.geometry.boundingBox); }
    bb.min.y += this.hip0 - this.info.hipH; bb.max.y += this.hip0 - this.info.hipH; this.box = bb;
    this.fitR = bb.getSize(V(0, 0, 0)).length() * 0.5 * def.scale;
    this.height = Math.min(bb.max.y, this.quad ? bb.max.y : this.hip0 + 2.2) * def.scale * (def.kind === 'brachio' ? 0.62 : 1);
    this._v = V(0, 0, 0); this._inv = new THREE.Matrix4();
  }
  socketPos(name, out) { const s = this.sockets[name] || this.sockets.mouth; return s.getWorldPosition(out); }
  footPos(i, out) { return this.b[this.feet[i % this.feet.length]].getWorldPosition(out); }
  dispose() { this.meshes.forEach(m => m.geometry.dispose()); [this.mats.plate, this.mats.frame, this.mats.glow, this.haloMat].forEach(m => m.dispose()); }

  animate(dt, speed, o = {}) {
    const b = this.b, sc = this.def.scale; this.t += dt; const t = this.t;
    const stride = (this.quad ? 2.5 : 3.0) * sc * (this.def.kind === 'velo' ? 0.85 : 1);
    this.phase += speed * dt / stride * Math.PI;
    const ph = this.phase, k = Math.min(1, speed / (2.5 * sc)), run = sstep(7 * sc, 15 * sc, speed), ko = this.ko;
    const idle = (1 - k) * (1 - ko), roar = (o.roar || 0) * (1 - ko), bite = o.bite || 0, charge = o.charge || 0, rear = o.rear || 0, air = o.air || 0;
    const snarl = Math.pow(Math.max(0, Math.sin(t * 0.8 + this.seed)), 10) * idle;
    const R = (n, x = 0, y = 0, z = 0) => { const bo = b[n]; if (bo) bo.rotation.set(x, y, z); };
    const fly = this.flyer && o.flying && ko < 0.5 ? 1 : 0;
    const crouch = (0.6 * idle + 0.4 * charge + 0.5 * ko) * (1 - fly);
    // ---- body lean / sway
    const lean = (this.quad ? 0.02 : 0.1) * run + 0.12 * charge + 0.05 * crouch - 0.16 * roar - 0.55 * rear + (this.quad ? 0 : 0.04 * idle);
    const sway = Math.sin(ph) * 0.05 * k;
    R('pelvis', lean + Math.cos(ph * 2) * 0.02 * k, sway, Math.sin(ph) * 0.035 * k + ko * 0.1);
    R('spine', -0.02 * run, -sway * 0.5, 0); R('chest', (this.quad ? 0 : -0.03) - 0.05 * roar, -sway * 0.7, -Math.sin(ph) * 0.02 * k);
    const br = Math.sin(t * (1.7 + 2.2 * run + 1.5 * (o.pant || 0))) * (0.022 + 0.02 * run) * (1 - ko * 0.8);
    if (b.ribs) b.ribs.scale.set(1 + br * 0.7, 1 + br, 1);
    // ---- legs
    const flat = (n, chainSum) => R(n, -chainSum);
    if (fly) { // dragon in flight: legs tucked under, body banks into turns and pitches up to climb
      R('pelvis', 0.04 * k - 0.28 * (o.climb || 0) - 0.1 * roar, 0, -(o.turn || 0) * 0.45);
      for (const S of ['L', 'R']) { R(S + 'hip', 1.0); R(S + 'knee', 0.45); R(S + 'ankle', -0.25); R(S + 'foot', 0.7); R(S + 'Fhip', -0.35 + 0.1 * Math.sin(t * 2)); R(S + 'Fknee', 1.1); R(S + 'Fankle', -0.5); R(S + 'Ffoot', 0.4); }
    } else if (!this.quad) {
      for (const [S, off] of [['L', 0], ['R', Math.PI]]) {
        const s = Math.sin(ph + off), c = Math.cos(ph + off), lift = Math.max(0, -c);
        const A = (0.4 + 0.25 * run) * k;
        let hip = s * A - 0.12 * crouch - lift * 0.15 * k, knee = lift * (0.8 + 0.4 * run) * k + 0.35 * crouch, ankle = -lift * (0.5 + 0.3 * run) * k - 0.25 * crouch;
        if (air) { hip = hip * (1 - air) - 0.7 * air; knee = knee * (1 - air) + 1.1 * air; ankle = ankle * (1 - air) - 0.6 * air; }
        if (ko) { hip = hip * (1 - ko) + 0.4 * ko * (S === 'L' ? 1 : -0.4); knee = knee * (1 - ko) + 0.5 * ko; }
        R(S + 'hip', hip, 0, (S === 'L' ? -1 : 1) * 0.04 * crouch); R(S + 'knee', knee); R(S + 'ankle', ankle);
        const pitch = b.pelvis.rotation.x, sum = pitch + hip + knee + ankle;
        flat(S + 'foot', sum - (lift > 0.3 ? lift * 0.4 * k : 0)); R(S + 'toe', -Math.max(0, s - 0.5) * 0.9 * k + (lift > 0.3 ? 0.5 * lift * k : 0));
        // arms: little swing, flex when roaring/biting
        R(S + 'sh', -s * 0.2 * k + 0.25 - 0.5 * roar - 0.3 * bite + 0.2 * idle * Math.sin(t * 1.3), 0, (S === 'L' ? 1 : -1) * (0.15 + 0.35 * roar));
        R(S + 'el', -0.6 - 0.4 * roar + 0.1 * Math.sin(t * 2 + off)); R(S + 'hand', 0.3 + 0.4 * roar);
      }
    } else {
      const gait = run > 0.5 ? [['L', 0], ['RF', 0.15], ['R', Math.PI], ['LF', Math.PI + 0.15]] : [['L', 0], ['LF', Math.PI * 0.5], ['R', Math.PI], ['RF', Math.PI * 1.5]];
      for (const [S, off] of gait) {
        const front = S.includes('F'), s = Math.sin(ph + off), c = Math.cos(ph + off), lift = Math.max(0, -c);
        const A = (0.32 + 0.15 * run) * k;
        let hip = s * A - (front ? 0.1 : 0.05) * crouch, knee = lift * 0.6 * k + 0.15 * crouch, ankle = -lift * 0.35 * k;
        const n = front ? S[0] + 'F' : S;
        if (rear) { if (front) { hip += -0.7 * rear; knee += 0.9 * rear; } else hip += 0.55 * rear; }
        if (ko) { hip = hip * (1 - ko) + 0.3 * ko; knee = knee * (1 - ko) + 0.3 * ko; }
        R(n + 'hip', hip); R(n + 'knee', knee); R(n + 'ankle', ankle);
        const pitch = b.pelvis.rotation.x + (front ? b.spine.rotation.x + b.chest.rotation.x : 0);
        flat(n + 'foot', pitch + hip + knee + ankle);
      }
    }
    // ---- tail: travelling wave, lifts when running/roaring, curls for a whip
    for (let i = 0; i < 12; i++) { const n = 'tail' + i; if (!b[n]) break;
      const w = Math.sin(t * (1.5 + 2.2 * k) - i * 0.55 + ph * 0.5) * (0.03 + 0.016 * i) * (0.55 + 0.8 * k) * (1 - ko);
      R(n, (i === 0 ? 0.04 : 0.012) + 0.025 * run + 0.03 * roar + 0.03 * rear - 0.02 * ko - (this.quad ? 0.01 : 0), w - (o.turn || 0) * 0.07 + (o.whip || 0) * 0.28, 0); }
    // ---- neck / head: stabilised, low and aggressive when idle, raised and shaking when roaring, lunging when biting
    const nk = Object.keys(b).filter(n => /^neck\d$/.test(n)).length || 1, lookY = (o.look || 0) * 0.35 / nk;
    const headLow = this.quad ? 0.06 * idle + 0.25 * charge : 0.1 * idle + 0.1 * charge;
    const nf = fly ? 0.11 : 0;
    for (let i = 0; i < nk; i++) R('neck' + i, nf + (headLow + Math.cos(ph * 2) * 0.025 * k - (0.45 * roar + 0.12 * rear) / nk * (i ? 0.7 : 1.3) + 0.3 * bite / nk + 0.25 * ko) * (this.def.kind === 'brachio' ? 0.4 : 1), lookY + snarl * 0.2 * Math.sin(t * 9), 0);
    R('head', -nf * nk * 0.8 - lean * 0.8 - 0.12 * roar + 0.22 * bite + Math.sin(t * 26) * 0.045 * roar + snarl * 0.08, lookY + snarl * 0.12 * Math.sin(t * 11), Math.sin(t * 19) * 0.06 * roar + Math.sin(t * 13) * 0.05 * snarl);
    if (b.frillL) { this.frill = (this.frill || 0) + ((o.frill || roar > 0.3 ? 1 : 0) - (this.frill || 0)) * Math.min(1, dt * 10); const f = this.frill;
      R('frillL', 0, 1.45 * (1 - f), 0); R('frillR', 0, -1.45 * (1 - f), 0); b.frillL.scale.setScalar(0.35 + 0.65 * f); b.frillR.scale.setScalar(0.35 + 0.65 * f); }
    if (this.flyer) { const fq = o.boost ? 6.4 : 3.7, A = (o.boost ? 0.95 : 0.72) * (fly ? 1 : 0), w = (this.wingPh = (this.wingPh || 0) + dt * fq);
      for (const [S, sd] of [['L', 1], ['R', -1]]) { let z1, y1, z2, y2, z3, y3;
        if (fly) { const s = Math.sin(w); z1 = 0.1 + s * A; y1 = 0.1 - 0.12 * Math.cos(w); z2 = Math.sin(w - 0.6) * A * 0.5 - 0.05; y2 = 0.05; z3 = Math.sin(w - 1.1) * A * 0.4; y3 = 0.06 + 0.1 * Math.cos(w); }
        else { const brw = Math.sin(t * 1.2) * 0.06; z1 = 0.72 + brw + 0.35 * roar; y1 = 0.55 - 0.35 * roar; z2 = -0.55 + 0.45 * roar; y2 = 0.42 - 0.3 * roar; z3 = -0.45 + 0.4 * roar; y3 = 0.5 - 0.35 * roar; }
        R(S + 'wing', 0, sd * y1, sd * z1); R(S + 'wing2', 0, sd * y2, sd * z2); R(S + 'wing3', 0, sd * y3, sd * z3); }
      this.flapS = fly ? Math.sin(w) : 0; }
    this.jaw += (Math.max(o.jaw || 0, roar * 1.25, snarl * 0.6, ko * 0.5) - this.jaw) * Math.min(1, dt * 16);
    R('jaw', this.jaw * (this.quad ? 0.45 : 0.62) + 0.02 + Math.max(0, br) * 0.4);
    // ---- keep the planted foot on the ground (pelvis follows the legs)
    let target = this.hip0;
    if (!air && !fly && ko < 0.5) {
      b.pelvis.position.y = this.hip0; this.rig.updateMatrixWorld(true); this._inv.copy(this.rig.matrixWorld).invert();
      let minY = Infinity; for (const f of this.feet) { this._v.setFromMatrixPosition(b[f].matrixWorld).applyMatrix4(this._inv); minY = Math.min(minY, this._v.y); }
      target = this.hip0 - minY + 0.02;
    } else if (air || fly) target = this.hip0 - (fly ? Math.sin((this.wingPh || 0) - 0.3) * 0.12 : 0);
    this.pelvisY += (target - this.pelvisY) * Math.min(1, dt * 18); b.pelvis.position.y = this.pelvisY;
    // ---- hit flash / KO dim / angry eye pulse
    this.flash = Math.max(0, this.flash - dt * 5);
    this.mats.plate.emissive.setRGB(this.flash * 0.75, this.flash * 0.5, this.flash * 0.35);
    const pulse = (1 - ko) * (1.7 + 0.5 * Math.sin(t * 3.5) + 1.2 * roar) + 0.04;
    this.mats.glow.color.copy(this.mats.glowColor).multiplyScalar(pulse);
    this.haloMat.opacity = (1 - ko) * (0.6 + 0.2 * Math.sin(t * 3.5) + 0.3 * roar);
  }
}
