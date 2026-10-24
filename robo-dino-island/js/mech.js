// Procedural robot mech dinosaurs. Each mech is built from bevelled PBR plates, pistons and glowing parts,
// rigidly skinned onto a bone rig so a whole robot renders in ~4 draw calls (plates / frame / joints / glow).
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { battleDamageTexture } from './proctex.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const geoCache = new Map();
function bevelBox(w, h, d, b = 0.08) {
  const k = `bb${w},${h},${d},${b}`; if (geoCache.has(k)) return geoCache.get(k);
  b = Math.min(b, w * 0.3, h * 0.3, d * 0.3);
  const s = new THREE.Shape(); s.moveTo(-w / 2 + b, -h / 2 + b); s.lineTo(w / 2 - b, -h / 2 + b); s.lineTo(w / 2 - b, h / 2 - b); s.lineTo(-w / 2 + b, h / 2 - b); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -(d - 2 * b) / 2); scaleUV(g, 0.5); geoCache.set(k, g); return g;
}
function profile(pts, width, b = 0.06) {
  // side profile in (z,y) extruded across x
  const s = new THREE.Shape(); pts.forEach(([z, y], i) => i ? s.lineTo(z, y) : s.moveTo(z, y)); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, width - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 3 });
  g.rotateY(-Math.PI / 2); g.translate((width - 2 * b) / 2, 0, 0); scaleUV(g, 0.5); return g;
}
function plateXY(pts, thick, b = 0.03) { // flat shape in (x,y) with thickness along z (sails, frills, wings)
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -thick / 2); scaleUV(g, 0.5); return g;
}
function scaleUV(g, s) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s); }
const cyl = (rt, rb, h, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, Math.max(seg, 12), 1);
const cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, Math.max(seg, 7), 1);
const sph = (r) => new THREE.IcosahedronGeometry(r, 2);

const matCache = {};
function makeMats(def, assets, wild) {
  const body = wild ? 0x1d1e22 : def.body, armor = wild ? 0x3a3d44 : def.armor, glow = wild ? 0xff2414 : def.glow;
  // battle-damage map: scratches, soot, claw marks and rivets (the map is ~0.33 grey on average, so colours are boosted to match)
  const dmg = battleDamageTexture();
  const plate = new THREE.MeshStandardMaterial({ color: new THREE.Color(body).multiplyScalar(3.0), map: dmg, metalness: 0.7, roughness: wild ? 0.3 : 0.34, normalMap: assets.metalNor, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: assets.metalRough, envMapIntensity: 1.35 });
  const frame = new THREE.MeshStandardMaterial({ color: new THREE.Color(armor).multiplyScalar(2.8), map: dmg, metalness: 0.7, roughness: 0.5, normalMap: assets.metalNor, normalScale: new THREE.Vector2(0.9, 0.9), envMapIntensity: 1.1 });
  const joint = new THREE.MeshStandardMaterial({ color: 0x9aa1aa, metalness: 1, roughness: 0.22, envMapIntensity: 1.4 });
  const glowM = new THREE.MeshBasicMaterial({ color: new THREE.Color(glow).multiplyScalar(2.2), toneMapped: false });
  return { plate, frame, joint, glow: glowM, glowColor: new THREE.Color(glow) };
}

class Builder {
  constructor(def, assets, wild) {
    this.def = def; this.assets = assets; this.wild = wild; this.mats = makeMats(def, assets, wild);
    this.bones = {}; this.list = []; this.parts = []; this.sockets = {};
    this.root = this.bone('root', null, 0, 0, 0);
  }
  bone(name, parent, x, y, z) { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); if (parent) this.bones[parent].add(b); this.bones[name] = b; this.list.push(b); return b; }
  part(bone, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
    this.parts.push({ bone, geo, mat, m });
  }
  mirror(fn) { fn(1, 'L'); fn(-1, 'R'); }
  socket(bone, name, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); this.bones[bone].add(o); this.sockets[name] = o; return o; }
  finish() {
    const group = new THREE.Group(); group.add(this.root); this.root.updateMatrixWorld(true);
    const byMat = new Map();
    this.parts.forEach(p => {
      const bi = this.list.indexOf(this.bones[p.bone]);
      let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      ['uv1', 'uv2'].forEach(a => g.deleteAttribute(a));
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.bones[p.bone].matrixWorld, p.m));
      const n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      if (!byMat.has(p.mat)) byMat.set(p.mat, []); byMat.get(p.mat).push(g);
    });
    const skeleton = new THREE.Skeleton(this.list);
    this.meshes = [];
    for (const [mk, geos] of byMat) {
      const geo = mergeGeometries(geos); geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.6;
      const mesh = new THREE.SkinnedMesh(geo, this.mats[mk]); mesh.castShadow = mk !== 'glow'; mesh.receiveShadow = mk !== 'glow';
      mesh.bind(skeleton, new THREE.Matrix4()); mesh.boundingSphere = geo.boundingSphere.clone();
      group.add(mesh); this.meshes.push(mesh);
    }
    return group;
  }
}

// ---------------- shell primitive: superellipsoid with taper (sleek armour) ----------------
const sp = (c, e) => Math.sign(c) * Math.pow(Math.abs(c), e);
function shell(w, h, d, o = {}) {
  const k = 'sh' + [w, h, d, o.e, o.e2, o.tf, o.tfy, o.tb, o.tby, o.yf, o.U, o.V].join(',');
  if (geoCache.has(k)) return geoCache.get(k);
  const e1 = o.e ?? 0.5, e2 = o.e2 ?? e1, tf = o.tf ?? 1, tfy = o.tfy ?? tf, tb = o.tb ?? 1, tby = o.tby ?? tb, yf = o.yf ?? 0, U = o.U ?? 10, Vn = o.V ?? 18;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= U; i++) { const u = -Math.PI / 2 + Math.PI * i / U, cu = Math.cos(u), su = Math.sin(u);
    for (let j = 0; j <= Vn; j++) { const v = -Math.PI + 2 * Math.PI * j / Vn, cv = Math.cos(v), sv = Math.sin(v);
      const x = sp(cu, e1) * sp(sv, e2), y = sp(su, e1), z = sp(cu, e1) * sp(cv, e2);
      const sx = z > 0 ? 1 + (tf - 1) * z : 1 + (tb - 1) * -z, sy = z > 0 ? 1 + (tfy - 1) * z : 1 + (tby - 1) * -z;
      pos.push(x * w / 2 * sx, y * h / 2 * sy + yf * z * h / 2, z * d / 2); uv.push(j / Vn * (w + d), i / U * h); } }
  for (let i = 0; i < U; i++) for (let j = 0; j < Vn; j++) { const a = i * (Vn + 1) + j, b = a + Vn + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); geoCache.set(k, g); return g;
}
const vshell = (w, h, d, o) => { const k = 'v' + [w, h, d, JSON.stringify(o || {})].join(','); if (geoCache.has(k)) return geoCache.get(k); const g = shell(w, d, h, o).clone(); g.rotateX(Math.PI / 2); geoCache.set(k, g); return g; }; // length along -y

// ---------------- shared part kits ----------------
function legChain(B, side, s, parent, hx, hy, hz, L, front) {
  const [a, b, c] = L, w = L.w || 0.7, P = side + (front ? 'F' : ''), sgn = side === 'L' ? 1 : -1;
  B.bone(P + 'hip', parent, sgn * hx, hy, hz); B.bone(P + 'knee', P + 'hip', 0, -a, 0); B.bone(P + 'ankle', P + 'knee', 0, -b, 0); B.bone(P + 'foot', P + 'ankle', 0, -c, 0);
  // thigh: big armoured muscle + outer plate + hip disc
  B.part(P + 'hip', vshell(w * 1.05, a * 1.25, w * 1.45, { e: 0.55, tf: 0.62, tfy: 0.8 }), 'plate', 0, -a * 0.42, 0);
  B.part(P + 'hip', vshell(0.16, a * 0.95, w * 1.15, { e: 0.4, tf: 0.6 }), 'frame', sgn * w * 0.52, -a * 0.45, 0);
  B.part(P + 'hip', cyl(w * 0.5, w * 0.5, 0.12, 16), 'frame', sgn * w * 0.6, 0, 0, 0, 0, Math.PI / 2);
  B.part(P + 'hip', cyl(w * 0.3, w * 0.3, 0.13, 16), 'glow', sgn * w * 0.62, 0, 0, 0, 0, Math.PI / 2);
  B.part(P + 'hip', vshell(0.05, a * 0.55, 0.08, { e: 0.3 }), 'glow', sgn * w * 0.62, -a * 0.5, w * 0.25);
  if (s >= 0.8) for (let k = 0; k < 2; k++) B.part(P + 'hip', cone(0.09 + 0.05 * w, 0.45 * w + 0.15, 7), 'joint', sgn * w * 0.6, -a * (0.15 + k * 0.32), -w * 0.45, -1.9 + k * 0.2, 0, sgn * -0.7);
  if (front) B.part(P + 'hip', shell(w * 1.25, 0.18, w * 1.3, { e: 0.4, tf: 0.8 }), 'frame', sgn * w * 0.18, 0.2, 0, 0, 0, sgn * -0.35); // pauldron
  // knee + shin
  B.part(P + 'knee', cyl(w * 0.3, w * 0.3, w * 0.9, 12), 'joint', 0, 0, 0, 0, 0, Math.PI / 2);
  B.part(P + 'knee', vshell(w * 0.6, b * 1.1, w * 0.62, { e: 0.5, tf: 0.75 }), 'frame', 0, -b * 0.5, 0);
  B.part(P + 'knee', vshell(w * 0.66, b * 0.8, w * 0.3, { e: 0.4, tf: 0.7 }), 'plate', 0, -b * 0.42, w * 0.3);
  B.part(P + 'knee', cyl(0.06, 0.06, b * 0.85, 6), 'joint', 0, -b * 0.5, -w * 0.38);
  // ankle + metatarsal
  B.part(P + 'ankle', sph(w * 0.26), 'joint');
  B.part(P + 'ankle', vshell(w * 0.42, c * 1.1, w * 0.46, { e: 0.5 }), 'plate', 0, -c * 0.5, 0);
  // foot + toes + claws
  B.part(P + 'foot', shell(w * 0.75, 0.25, w * 0.8, { e: 0.5 }), 'frame', 0, 0.06, w * 0.05);
  for (let t = -1; t <= 1; t++) {
    B.part(P + 'foot', shell(0.2 * s + w * 0.08, 0.2, w * 1.0, { e: 0.5, tf: 0.6 }), 'plate', t * w * 0.28, 0.04, w * 0.45, 0, t * 0.32, 0);
    B.part(P + 'foot', cone(0.08 * s + 0.02, 0.3, 5), 'joint', t * w * 0.46, 0.02, w * 0.98, Math.PI / 2 + 0.3, 0, 0);
  }
}
function tailChain(B, parent, n, len, w0, h0, glowEvery = 2, spikes = true, y0 = 0.1) {
  let prev = parent;
  for (let i = 0; i < n; i++) {
    const t = i / n, w = w0 * (1 - t * 0.78), h = h0 * (1 - t * 0.72), name = 'tail' + i;
    B.bone(name, prev, 0, i === 0 ? y0 : -0.02, i === 0 ? -0.6 : -len); prev = name;
    B.part(name, shell(w, h, len * 1.25, { e: 0.5, tf: 1.04, tb: 0.86 }), 'plate', 0, 0, -len * 0.5);
    B.part(name, shell(w * 0.9, h * 0.75, len * 0.45, { e: 0.5 }), 'frame', 0, -h * 0.12, -len * 0.02);
    B.part(name, shell(w * 0.7, h * 0.3, len * 0.9, { e: 0.4 }), 'frame', 0, h * 0.42, -len * 0.5);
    if (spikes) B.part(name, plateXY([[0, 0], [-len * 0.75, h * 0.62], [-len * 0.5, 0]], 0.06, 0.02), 'frame', 0, h * 0.35, -len * 0.1, 0, Math.PI / 2, 0);
    if (i % glowEvery === 0) B.mirror(sd => B.part(name, shell(0.05, h * 0.12, len * 0.8, { e: 0.3 }), 'glow', sd * w * 0.49, -h * 0.05, -len * 0.5));
  }
  B.part(prev, cone(w0 * 0.1, len * 0.8, 8), 'frame', 0, 0, -len * 1.25, -Math.PI / 2, 0, 0);
  return prev;
}
function missilePods(B, bone, x, y, z, s = 1) {
  B.mirror(sd => {
    B.part(bone, shell(0.55 * s, 0.5 * s, 1.15 * s, { e: 0.35, tf: 0.9 }), 'frame', sd * x, y, z);
    B.part(bone, shell(0.6 * s, 0.18 * s, 1.0 * s, { e: 0.35 }), 'plate', sd * x, y + 0.26 * s, z - 0.05);
    for (let i = 0; i < 4; i++) B.part(bone, cyl(0.075 * s, 0.075 * s, 0.08, 8), 'glow', sd * x + ((i % 2) - 0.5) * 0.24 * s, y + (((i / 2) | 0) - 0.5) * 0.2 * s, z + 0.56 * s, Math.PI / 2, 0, 0);
    B.socket(bone, 'pod' + (sd > 0 ? 'L' : 'R'), sd * x, y, z + 0.7 * s);
  });
}
function eyes(B, bone, x, y, z, s = 1, horns = true) {
  B.mirror(sd => { B.part(bone, shell(0.1, 0.11 * s, 0.32 * s, { e: 0.35, tf: 0.55 }), 'glow', sd * x, y, z, 0.28, sd * 0.25, sd * -0.2); B.socket(bone, 'eye' + (sd > 0 ? 'L' : 'R'), sd * (x + 0.04), y, z);
    // heavy angry brow sloping down toward the snout, plus a swept-back brow horn
    B.part(bone, shell(0.22 * s, 0.1 * s, 0.55 * s, { e: 0.35, tf: 0.55 }), 'frame', sd * (x - 0.02), y + 0.12 * s, z + 0.02, 0.42, sd * 0.2, sd * -0.35);
    if (horns) B.part(bone, cone(0.08 * s, 0.5 * s, 7), 'joint', sd * (x - 0.05), y + 0.2 * s, z - 0.3 * s, -2.0, 0, sd * -0.5); });
}
function teeth(B, bone, z0, z1, y, x, down, s = 1) {
  const n = Math.max(3, Math.round((z1 - z0) / 0.2));
  for (let i = 0; i < n; i++) { const z = z0 + (z1 - z0) * i / (n - 1), xx = x * (1 - 0.35 * i / n); B.mirror(sd => B.part(bone, cone(0.05 * s, 0.2 * s, 4), 'joint', sd * xx, y, z, down ? Math.PI : 0, 0, 0)); }
}
function dorsal(B, bone, z0, z1, y, n, hgt, mat = 'frame') {
  for (let i = 0; i < n; i++) { const z = z0 + (z1 - z0) * i / Math.max(1, n - 1), hh = hgt * (0.7 + 0.3 * Math.sin(Math.PI * i / Math.max(1, n - 1)));
    B.part(bone, plateXY([[0.25, 0], [-0.35, hh], [-0.25, 0]], 0.07, 0.02), mat, 0, y, z, 0, Math.PI / 2, 0); }
}
function rexHead(B, hl, hw, crest) {
  // cranium + long snout, brow armour, glowing visor eyes, teeth, separate jaw
  B.part('head', shell(hw, 0.85, 1.15, { e: 0.5, tf: 0.85, tb: 0.8 }), 'plate', 0, 0.22, 0.1);
  B.part('head', shell(hw * 0.86, 0.6, hl * 0.85, { e: 0.45, tf: 0.62, tfy: 0.7, yf: -0.12 }), 'plate', 0, 0.12, hl * 0.52);
  B.part('head', shell(hw * 0.78, 0.25, hl * 0.95, { e: 0.4, tf: 0.6 }), 'frame', 0, -0.12, hl * 0.5);
  B.mirror(sd => {
    B.part('head', shell(0.2, 0.14, 0.95, { e: 0.35, tf: 0.5 }), 'frame', sd * hw * 0.36, 0.55, 0.45, -0.12, sd * -0.12, sd * 0.15);
    B.part('head', shell(0.05, 0.06, hl * 0.55, { e: 0.3 }), 'glow', sd * hw * 0.4, 0.08, hl * 0.6, 0, sd * 0.1, 0);
    B.part('head', shell(0.1, 0.4, 0.5, { e: 0.4 }), 'frame', sd * hw * 0.48, 0.12, -0.15);
  });
  eyes(B, 'head', hw * 0.43, 0.36, 0.42);
  B.part('head', shell(0.14, 0.08, 0.14, { e: 0.4 }), 'glow', 0, 0.3, hl * 0.98);
  teeth(B, 'head', 0.45, hl * 0.95, -0.22, hw * 0.34, true);
  if (crest) dorsal(B, 'head', -0.35, 0.35, 0.6, 3, 0.45);
  B.bone('jaw', 'head', 0, -0.18, 0.0);
  B.part('jaw', shell(hw * 0.78, 0.32, hl * 1.0, { e: 0.45, tf: 0.6, tfy: 0.6 }), 'frame', 0, -0.12, hl * 0.48);
  B.part('jaw', shell(hw * 0.8, 0.14, hl * 0.7, { e: 0.35, tf: 0.7 }), 'plate', 0, -0.25, hl * 0.4);
  teeth(B, 'jaw', 0.6, hl * 0.88, 0.04, hw * 0.3, false);
  B.socket('head', 'mouth', 0, -0.05, hl + 0.35);
}

// ---------------- species ----------------
function biped(B, o) {
  const s = o.s, w = o.w, bh = o.bh;
  B.bone('pelvis', 'root', 0, o.hipH, 0);
  B.part('pelvis', shell(1.45 * w, 1.35 * bh, 1.9, { e: 0.5 }), 'frame', 0, 0, -0.15);
  B.part('pelvis', shell(1.6 * w, 0.9 * bh, 2.0, { e: 0.4, tb: 0.85 }), 'plate', 0, 0.35 * bh, -0.15);
  B.bone('chest', 'pelvis', 0, 0.2, 0.8);
  // torso: main hull, belly frame, armour bands, glow strips, dorsal blades
  B.part('chest', shell(1.75 * w, 1.75 * bh, 3.0, { e: 0.5, tf: 0.78, tfy: 0.85, tb: 0.9, yf: 0.12 }), 'plate', 0, 0.05, 0.55, -0.1);
  B.part('chest', shell(1.45 * w, 1.1 * bh, 2.6, { e: 0.5, tf: 0.75 }), 'frame', 0, -0.42 * bh, 0.6, -0.12);
  for (let i = 0; i < 3; i++) B.part('chest', shell(1.82 * w * (1 - i * 0.06), 1.8 * bh * (1 - i * 0.05), 0.2, { e: 0.45 }), 'frame', 0, 0.05 + i * 0.05, -0.25 + i * 0.6, -0.1);
  B.mirror(sd => {
    B.part('chest', shell(0.05, 0.08, 1.9, { e: 0.3 }), 'glow', sd * 0.86 * w, 0.18, 0.55, -0.1);
    B.part('chest', shell(0.05, 0.05, 1.3, { e: 0.3 }), 'glow', sd * 0.8 * w, -0.25, 0.7, -0.1);
    for (let i = 0; i < 3; i++) B.part('chest', shell(0.28, 0.05, 0.12, { e: 0.3 }), 'glow', sd * 0.32 * w, 0.88 * bh, -0.2 + i * 0.32, -0.1);
  });
  dorsal(B, 'chest', -0.6, 1.5, 0.82 * bh, 5, 0.55 * bh);
  dorsal(B, 'pelvis', -0.9, 0.3, 0.75 * bh, 2, 0.5 * bh);
  // neck
  B.bone('neck', 'chest', 0, 0.5 * bh, 1.85);
  B.part('neck', shell(0.85 * w, 0.85, 1.0, { e: 0.5, tf: 0.85 }), 'frame', 0, 0.2, 0.3, -0.5);
  B.part('neck', shell(0.95 * w, 0.45, 0.95, { e: 0.4, tf: 0.85 }), 'plate', 0, 0.5, 0.25, -0.5);
  B.mirror(sd => B.part('neck', cyl(0.06, 0.06, 1.0, 6), 'joint', sd * 0.36 * w, -0.1, 0.35, -0.9, 0, 0));
  dorsal(B, 'neck', -0.2, 0.4, 0.68, 2, 0.4);
  B.bone('head', 'neck', 0, 0.55, 0.7);
  rexHead(B, o.headL, o.headW, o.crest);
  // arms
  B.mirror((sd, P) => {
    B.bone(P + 'sh', 'chest', sd * 0.82 * w, -0.35 * bh, 1.25); B.bone(P + 'el', P + 'sh', 0, -o.arm, 0.0);
    B.part(P + 'sh', sph(0.22), 'joint'); B.part(P + 'sh', vshell(0.3, o.arm * 1.1, 0.32, { e: 0.5 }), 'plate', 0, -o.arm / 2, 0);
    B.part(P + 'el', vshell(0.22, o.arm, 0.24, { e: 0.5, tf: 0.7 }), 'frame', 0, -o.arm * 0.45, 0.1);
    for (let k = -1; k <= 1; k += 2) B.part(P + 'el', cone(0.05, 0.28, 4), 'joint', k * 0.06, -o.arm * 0.95, 0.15, 0.5, 0, 0);
  });
  B.mirror(sd => legChain(B, sd > 0 ? 'L' : 'R', s, 'pelvis', 0.92 * w, -0.1, -0.1, o.leg));
  tailChain(B, 'pelvis', o.tailN, o.tailL, 1.2 * w, 1.05 * bh);
  missilePods(B, 'chest', 0.62 * w, 0.92 * bh, 0.0, 0.9);
  return o;
}

function quad(B, o) {
  B.bone('pelvis', 'root', 0, o.hipH, 0);
  B.part('pelvis', shell(o.bw, o.bh, 2.0, { e: 0.5 }), 'plate', 0, 0, -0.1);
  B.bone('chest', 'pelvis', 0, o.chestDY || 0, o.bodyL);
  B.part('chest', shell(o.bw * 1.05, o.bh * 1.05, o.bodyL + 1.6, { e: 0.5, tf: 0.8, tb: 0.95 }), 'plate', 0, -(o.chestDY || 0) * 0.5, -o.bodyL * 0.45, Math.atan2(o.chestDY || 0, o.bodyL));
  B.part('chest', shell(o.bw * 0.82, o.bh * 0.6, o.bodyL + 1.2, { e: 0.5 }), 'frame', 0, -o.bh * 0.32, -o.bodyL * 0.45, Math.atan2(o.chestDY || 0, o.bodyL));
  for (let i = 0; i < 2; i++) B.part('chest', shell(o.bw * 1.07, o.bh * 1.07, 0.12, { e: 0.45 }), 'frame', 0, -(o.chestDY || 0) * (0.3 + i * 0.35), -o.bodyL * (0.15 + i * 0.6), Math.atan2(o.chestDY || 0, o.bodyL));
  B.mirror(sd => { B.part('chest', shell(0.05, 0.09, o.bodyL * 1.1, { e: 0.3 }), 'glow', sd * o.bw * 0.53, 0.05, -o.bodyL * 0.45, Math.atan2(o.chestDY || 0, o.bodyL));
    for (let i = 0; i < 3; i++) B.part('chest', shell(0.05, 0.25, 0.08, { e: 0.3 }), 'glow', sd * o.bw * 0.5, -0.18, -o.bodyL * 0.75 + i * 0.25); });
  missilePods(B, 'chest', o.bw * 0.34, o.bh * 0.5 + 0.15, -o.bodyL * 0.3, 0.85);
  B.mirror((sd, P) => { legChain(B, P, o.s, 'pelvis', o.bw * 0.46, -0.15, -0.1, o.legB); legChain(B, P, o.s, 'chest', o.bw * 0.44, -0.2, 0.2, o.legF, true); });
  let prev = 'chest';
  for (let i = 0; i < o.neckN; i++) {
    const nm = 'neck' + i; B.bone(nm, prev, 0, i ? o.neckRise : 0.1, i ? o.neckL : 0.75); prev = nm;
    const w = o.neckW * (1 - i / (o.neckN + 2) * 0.5), pitch = -Math.atan2(o.neckRise, o.neckL);
    B.part(nm, shell(w, w * 0.95, o.neckL * 1.4, { e: 0.5 }), i % 2 ? 'plate' : 'frame', 0, 0, o.neckL * 0.5, pitch);
    B.part(nm, shell(w * 1.05, w * 0.4, o.neckL * 1.0, { e: 0.4 }), 'plate', 0, w * 0.3, o.neckL * 0.5, pitch);
    if (i % 2 === 0) B.mirror(sd => B.part(nm, shell(0.04, 0.06, o.neckL * 0.9, { e: 0.3 }), 'glow', sd * w * 0.5, 0, o.neckL * 0.5, pitch));
  }
  B.bone('neck', prev, 0, o.neckRise, o.neckL);
  B.bone('head', 'neck', 0, 0, 0.1);
  const hl = o.headL, hw = o.headW, hh = o.headH;
  B.part('head', shell(hw, 0.75 * hh, 0.95, { e: 0.5, tf: 0.85 }), 'plate', 0, 0.12, 0.1);
  B.part('head', shell(hw * 0.8, 0.5 * hh, hl * 0.9, { e: 0.45, tf: 0.55, yf: -0.15 }), 'plate', 0, 0.02, hl * 0.5);
  B.mirror(sd => B.part('head', shell(0.16, 0.1, 0.7, { e: 0.35, tf: 0.5 }), 'frame', sd * hw * 0.38, 0.4 * hh, 0.3, -0.1, sd * -0.1, sd * 0.15));
  eyes(B, 'head', hw * 0.42, 0.25 * hh, 0.3, 0.9);
  B.bone('jaw', 'head', 0, -0.15, -0.05);
  B.part('jaw', shell(hw * 0.75, 0.25, hl * 0.95, { e: 0.45, tf: 0.55 }), 'frame', 0, -0.1, hl * 0.45);
  B.socket('head', 'mouth', 0, 0, hl + 0.3);
  tailChain(B, 'pelvis', o.tailN, o.tailL, o.bw * 0.55, o.bh * 0.65, 2, !o.noFins, 0.05);
  return o;
}

const SPECIES = {
  rex(B) { return biped(B, { s: 1, w: 1.08, bh: 1.1, hipH: 3.05, headL: 1.85, headW: 1.05, arm: 0.6, leg: Object.assign([1.45, 1.3, 0.7], { w: 0.95 }), tailN: 7, tailL: 0.9, crest: false }); },
  raptor(B) {
    const o = biped(B, { s: 0.8, w: 0.72, bh: 0.78, hipH: 3.0, headL: 1.45, headW: 0.7, arm: 0.95, leg: Object.assign([1.4, 1.5, 0.85], { w: 0.56 }), tailN: 8, tailL: 0.9, crest: true });
    B.mirror((sd, P) => { B.part(P + 'foot', cone(0.08, 0.65, 5), 'glow', 0, 0.38, 0.32, -0.7, 0, 0); });
    return o;
  },
  spino(B) {
    const o = biped(B, { s: 1, w: 0.95, bh: 1, hipH: 2.9, headL: 2.4, headW: 0.78, arm: 0.9, leg: Object.assign([1.35, 1.3, 0.7], { w: 0.85 }), tailN: 8, tailL: 0.95 });
    const sail = [[-1.3, 0], [-1.0, 1.7], [-0.3, 2.6], [0.5, 2.7], [1.3, 2.0], [1.7, 0]];
    B.part('chest', plateXY(sail, 0.08), 'plate', 0, 0.75, 0.4, 0, Math.PI / 2, 0);
    for (let i = 0; i < 7; i++) { const x = -1.1 + i * 0.45, hh = 2.5 - Math.abs(i - 3) * 0.33; B.part('chest', shell(0.13, hh, 0.11, { e: 0.4 }), i % 2 ? 'glow' : 'joint', 0, 0.75 + hh / 2, 0.4 - x); }
    return o;
  },
  tri(B) {
    const o = quad(B, { s: 1, hipH: 2.2, bw: 2.2, bh: 1.75, bodyL: 2.2, legB: Object.assign([1.0, 0.9, 0.35], { w: 0.9 }), legF: Object.assign([0.9, 0.85, 0.3], { w: 0.85 }),
      neckN: 1, neckL: 0.5, neckRise: 0.0, neckW: 1.15, headL: 1.45, headW: 1.25, headH: 1.2, tailN: 5, tailL: 0.75 });
    const fr = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * (0.02 + i / 12 * 0.96); fr.push([Math.cos(a) * 1.7, Math.sin(a) * 1.55]); } fr.push([-0.6, -0.25], [0.6, -0.25]);
    B.part('head', plateXY(fr, 0.12, 0.05), 'plate', 0, 0.4, -0.3, -0.5, 0, 0);
    B.part('head', plateXY(fr.map(([x, y]) => [x * 0.8, y * 0.8]), 0.16, 0.04), 'frame', 0, 0.4, -0.36, -0.5, 0, 0);
    for (let i = 0; i <= 8; i++) { const a = Math.PI * (0.06 + i / 8 * 0.88); B.part('head', sph(0.1), 'glow', Math.cos(a) * 1.62, 0.4 + Math.sin(a) * 1.48 * Math.cos(0.5), -0.3 - Math.sin(a) * 1.48 * Math.sin(0.5)); }
    B.mirror(sd => B.part('head', cone(0.14, 1.5, 10), 'joint', sd * 0.42, 0.62, 0.75, 1.25, 0, sd * -0.12));
    B.part('head', cone(0.12, 0.6, 8), 'joint', 0, 0.3, 1.4, 1.0, 0, 0);
    return o;
  },
  stego(B) {
    const o = quad(B, { s: 1, hipH: 2.6, chestDY: -0.45, bw: 1.8, bh: 1.65, bodyL: 2.3, legB: Object.assign([1.2, 1.1, 0.4], { w: 0.78 }), legF: Object.assign([0.85, 0.75, 0.3], { w: 0.68 }),
      neckN: 2, neckL: 0.6, neckRise: -0.1, neckW: 0.75, headL: 1.0, headW: 0.65, headH: 0.8, tailN: 6, tailL: 0.85 });
    const kite = [[0, -0.1], [0.42, 0.55], [0, 1.25], [-0.42, 0.55]];
    for (let i = 0; i < 6; i++) { const z = -3.3 + i * 0.6, h = 0.75 + Math.sin((i + 1) / 7 * Math.PI) * 0.65; // front of the back stays clear: rider seat
      B.mirror(sd => { B.part('chest', plateXY(kite, 0.07), i % 2 ? 'plate' : 'frame', sd * 0.22, 0.75 + 0.12 * Math.sin(i), z, 0, Math.PI / 2, sd * -0.16, h, h, 1);
        B.part('chest', shell(0.05, 0.7 * h, 0.05, { e: 0.3 }), 'glow', sd * 0.25, 1.15 + 0.12 * Math.sin(i), z, 0, 0, sd * -0.16); }); }
    for (let k = 0; k < 4; k++) B.part('tail4', cone(0.09, 1.0, 6), k % 2 ? 'glow' : 'joint', (k % 2 ? 1 : -1) * 0.25, 0.15, -0.3 - (k >> 1) * 0.4, 0, 0, (k % 2 ? -1 : 1) * 1.1);
    return o;
  },
  ankylo(B) {
    const o = quad(B, { s: 1, hipH: 1.7, bw: 2.6, bh: 1.3, bodyL: 2.1, legB: Object.assign([0.8, 0.6, 0.3], { w: 0.72 }), legF: Object.assign([0.75, 0.55, 0.3], { w: 0.68 }),
      neckN: 1, neckL: 0.4, neckRise: 0, neckW: 0.9, headL: 0.9, headW: 1.0, headH: 0.8, tailN: 6, tailL: 0.75, noFins: true });
    for (let i = 0; i < 6; i++) B.mirror(sd => { B.part('chest', cone(0.15, 0.65, 6), i % 2 ? 'joint' : 'frame', sd * 1.35, 0.05, -2.2 + i * 0.5, 0, 0, sd * -1.4); B.part('chest', cone(0.1, 0.4, 6), 'glow', sd * 0.6, 0.72, -2.2 + i * 0.5, 0, 0, sd * -0.4); });
    B.part('tail5', new THREE.DodecahedronGeometry(0.65, 0), 'plate', 0, 0, -0.9); B.part('tail5', sph(0.3), 'glow', 0, 0.45, -0.9);
    B.mirror(sd => B.part('head', cone(0.1, 0.45, 5), 'joint', sd * 0.55, 0.3, -0.2, 0, 0, sd * -1.2));
    return o;
  },
  bronto(B) {
    const o = quad(B, { s: 1.1, hipH: 3.3, chestDY: 0.1, bw: 2.4, bh: 2.05, bodyL: 2.6, legB: Object.assign([1.5, 1.4, 0.4], { w: 1.18 }), legF: Object.assign([1.5, 1.4, 0.4], { w: 1.1 }),
      neckN: 7, neckL: 0.75, neckRise: 0.48, neckW: 0.95, headL: 1.15, headW: 0.8, headH: 0.95, tailN: 9, tailL: 0.9 });
    // armoured neck: overlapping collar rings with spikes and glowing seams
    for (let i = 0; i < 7; i++) { const nm = 'neck' + i, w = 0.95 * (1 - i / 9 * 0.5), pitch = -Math.atan2(0.48, 0.75);
      B.part(nm, shell(w * 1.22, w * 1.15, 0.32, { e: 0.4 }), 'frame', 0, 0.02, 0.1, pitch);
      B.part(nm, cone(0.1, 0.5 - i * 0.03, 7), 'joint', 0, w * 0.62, 0.2, -0.5 + pitch, 0, 0);
      B.mirror(sd => B.part(nm, cone(0.07, 0.32, 7), i % 2 ? 'glow' : 'joint', sd * w * 0.58, w * 0.2, 0.15, -0.6, 0, sd * -1.2)); }
    // spiked armour ridge down the back and big shoulder/hip plates
    dorsal(B, 'chest', -2.6, 0.6, o.bh * 0.5, 6, 0.75, 'frame'); dorsal(B, 'pelvis', -1.0, 0.6, o.bh * 0.5, 3, 0.65, 'frame');
    for (let i = 0; i < 6; i++) B.part('chest', cone(0.07, 0.35, 7), 'glow', 0, o.bh * 0.5 + 0.12, -2.4 + i * 0.6, 0, 0, 0);
    B.mirror(sd => { B.part('chest', shell(0.4, 1.3, 2.2, { e: 0.4, tf: 0.8 }), 'frame', sd * o.bw * 0.52, 0.0, -1.2, 0, 0, sd * -0.12);
      for (let k = 0; k < 3; k++) B.part('chest', cone(0.1, 0.55, 7), 'joint', sd * o.bw * 0.6, 0.35, -2.0 + k * 0.6, 0, 0, sd * -1.3); });
    // heavy armoured head: ram plate, jaw teeth
    B.part('head', shell(0.95, 0.35, 1.2, { e: 0.4, tf: 0.75 }), 'frame', 0, 0.48, 0.25, -0.1);
    teeth(B, 'head', 0.4, 1.05, -0.12, 0.26, true, 0.9);
    // tail tip: spiked mace of plates
    B.mirror(sd => B.part('tail8', cone(0.07, 0.45, 7), 'joint', sd * 0.12, 0.08, -0.5, 0, 0, sd * -1.3));
    return o;
  },
  ptero(B) {
    B.bone('pelvis', 'root', 0, 1.6, 0);
    B.part('pelvis', shell(0.9, 0.8, 1.4, { e: 0.5, tb: 0.7 }), 'plate', 0, 0, -0.2);
    B.bone('chest', 'pelvis', 0, 0.15, 0.7);
    B.part('chest', shell(1.0, 0.9, 1.7, { e: 0.5, tf: 0.8 }), 'plate', 0, 0, 0.25);
    B.part('chest', shell(0.8, 0.5, 1.5, { e: 0.5 }), 'frame', 0, -0.28, 0.2);
    B.part('chest', cyl(0.25, 0.32, 0.6, 12), 'frame', 0, -0.1, -1.1, Math.PI / 2, 0, 0);
    B.part('chest', cyl(0.2, 0.2, 0.1, 12), 'glow', 0, -0.1, -1.42, Math.PI / 2, 0, 0);
    B.socket('chest', 'jet', 0, -0.1, -1.55);
    B.bone('neck', 'chest', 0, 0.35, 1.0); B.part('neck', shell(0.42, 0.42, 1.0, { e: 0.5 }), 'frame', 0, 0.2, 0.3, -0.6);
    B.bone('head', 'neck', 0, 0.5, 0.65);
    B.part('head', shell(0.5, 0.45, 0.8, { e: 0.5 }), 'plate', 0, 0.12, 0.1);
    B.part('head', shell(0.4, 0.28, 2.0, { e: 0.5, tf: 0.15, tfy: 0.2 }), 'plate', 0, 0.06, 1.1);
    // big swept armour crest with a glowing core blade
    B.part('head', plateXY([[0.5, 0], [-1.9, 0.95], [-1.5, 0.55], [-0.4, 0.15]], 0.1, 0.03), 'frame', 0, 0.3, 0.05, 0, Math.PI / 2, 0);
    B.part('head', plateXY([[0.2, 0.05], [-1.5, 0.75], [-0.4, 0.2]], 0.13, 0.01), 'glow', 0, 0.32, 0.0, 0, Math.PI / 2, 0);
    B.part('head', shell(0.46, 0.12, 1.6, { e: 0.35, tf: 0.2 }), 'frame', 0, 0.2, 1.0);
    eyes(B, 'head', 0.2, 0.2, 0.3, 0.8, false);
    teeth(B, 'head', 0.45, 1.75, -0.08, 0.13, true, 0.75);
    B.bone('jaw', 'head', 0, -0.08, 0.1); B.part('jaw', shell(0.34, 0.16, 1.8, { e: 0.5, tf: 0.15 }), 'frame', 0, -0.05, 0.95);
    teeth(B, 'jaw', 0.5, 1.6, 0.03, 0.11, false, 0.7);
    B.socket('head', 'mouth', 0, 0, 2.2);
    B.mirror((sd, P) => {
      B.bone(P + 'wing', 'chest', sd * 0.5, 0.2, 0.3); B.bone(P + 'wing2', P + 'wing', sd * 2.6, 0, 0);
      B.part(P + 'wing', shell(2.8, 0.2, 0.32, { e: 0.5 }), 'frame', sd * 1.3, 0, 0.2);
      B.part(P + 'wing', plateXY([[0, 0.4], [sd * 2.6, 0.3], [sd * 2.6, -1.1], [sd * 2.0, -1.35], [sd * 1.3, -1.25], [sd * 0.6, -1.7], [0, -1.7]], 0.06), 'plate', 0, 0, 0, Math.PI / 2, 0, 0);
      for (let k = 0; k < 3; k++) B.part(P + 'wing', shell(0.1, 0.1, 1.5 - k * 0.2, { e: 0.4 }), 'frame', sd * (0.5 + k * 0.8), 0.06, -0.6, 0, sd * (0.25 - k * 0.12), 0); // finger spars
      B.part(P + 'wing', shell(2.3, 0.04, 0.05, { e: 0.3 }), 'glow', sd * 1.3, 0.06, -0.45, 0, 0, 0);
      B.part(P + 'wing', cone(0.07, 0.4, 7), 'joint', sd * 2.65, 0.0, 0.45, -1.2, 0, 0); // wrist claws
      B.part(P + 'wing', cone(0.06, 0.32, 7), 'joint', sd * 2.65, 0.0, 0.25, -1.4, sd * 0.3, 0);
      B.part(P + 'wing', cone(0.08, 0.55, 7), 'joint', sd * 0.9, 0.12, 0.25, -0.3, 0, sd * -0.9); // shoulder spike
      B.part(P + 'wing', cyl(0.22, 0.28, 1.3, 12), 'frame', sd * 1.3, -0.3, -0.2, Math.PI / 2, 0, 0);
      B.part(P + 'wing', cyl(0.18, 0.18, 0.06, 12), 'glow', sd * 1.3, -0.3, -0.87, Math.PI / 2, 0, 0);
      B.socket(P + 'wing', 'jet' + P, sd * 1.3, -0.3, -0.95);
      B.part(P + 'wing2', shell(2.5, 0.15, 0.25, { e: 0.5, tf: 0.5 }), 'frame', sd * 1.2, 0, 0.25, 0, sd * 0.25, 0);
      B.part(P + 'wing2', plateXY([[0, 0.3], [sd * 2.9, -0.45], [sd * 2.3, -0.75], [sd * 1.6, -0.7], [sd * 0.9, -1.05], [0, -1.1]], 0.05), 'plate', 0, 0, 0, Math.PI / 2, 0, 0);
      B.part(P + 'wing2', cone(0.06, 0.7, 7), 'frame', sd * 2.9, 0.0, -0.45, 0, 0, sd * -Math.PI / 2 + sd * 0.25);
      B.part(P + 'wing2', shell(2.3, 0.05, 0.06, { e: 0.3 }), 'glow', sd * 1.2, 0.05, -0.55, 0, sd * -0.32, 0);
      legChain(B, P, 0.6, 'pelvis', 0.3, -0.2, 0, Object.assign([0.5, 0.5, 0.3], { w: 0.3 }));
    });
    missilePods(B, 'chest', 0.45, 0.35, 0.1, 0.55);
    tailChain(B, 'pelvis', 5, 0.55, 0.4, 0.35, 2, false);
    B.part('tail4', plateXY([[0, 0], [0.4, 0.5], [-0.4, 0.5]], 0.05), 'glow', 0, 0, -0.5, Math.PI / 2, 0, 0);
    return { s: 0.6, hipH: 1.6, flyer: true };
  },
  // ---------------- v4 robots ----------------
  gmech(B) {
    const o = biped(B, { s: 1.15, w: 1.2, bh: 1.2, hipH: 3.25, headL: 2.15, headW: 1.12, arm: 0.75, leg: Object.assign([1.55, 1.4, 0.75], { w: 1.05 }), tailN: 8, tailL: 0.95, crest: true });
    // giant piston fists for the QUAKE slam, shoulder armour and a spiked dorsal ridge
    B.mirror((sd, P) => { B.part(P + 'el', shell(0.55, 0.55, 0.6, { e: 0.4 }), 'frame', 0, -o.arm * 1.05, 0.15); B.part(P + 'el', cyl(0.18, 0.18, 0.12, 12), 'glow', 0, -o.arm * 1.05, 0.47, Math.PI / 2, 0, 0);
      B.part('chest', shell(0.9, 0.35, 1.1, { e: 0.4, tf: 0.8 }), 'frame', sd * 1.0, 0.4, 1.0, 0, 0, sd * -0.45);
      for (let k = 0; k < 3; k++) B.part('chest', cone(0.12, 0.6, 7), 'joint', sd * 1.25, 0.55, 0.6 + k * 0.4, 0, 0, sd * -1.0); });
    for (let i = 0; i < 5; i++) B.part('chest', cone(0.1, 0.5 + 0.2 * Math.sin(i), 7), 'glow', 0, 1.25 * 1.2 * 0.75 + 0.1, -0.5 + i * 0.45, -0.3, 0, 0);
    return o;
  },
  dblast(B) {
    const o = biped(B, { s: 0.85, w: 0.78, bh: 0.82, hipH: 2.9, headL: 1.5, headW: 0.72, arm: 0.85, leg: Object.assign([1.35, 1.4, 0.8], { w: 0.6 }), tailN: 8, tailL: 0.88, crest: false });
    // twin head crests, a radial blaster frill around the neck and glowing goo tanks
    B.mirror(sd => { B.part('head', plateXY([[-0.4, 0], [-0.1, 0.45], [0.6, 0.6], [1.1, 0.2], [1.2, 0]], 0.06, 0.02), 'frame', sd * 0.16, 0.55, 0.2, 0, -Math.PI / 2, sd * 0.12);
      B.part('head', plateXY([[-0.2, 0.05], [0.5, 0.42], [0.95, 0.1]], 0.08, 0.01), 'glow', sd * 0.17, 0.57, 0.2, 0, -Math.PI / 2, sd * 0.12); });
    for (let i = 0; i < 9; i++) { const a = -Math.PI * 0.55 + i / 8 * Math.PI * 1.1, sd = Math.sign(Math.cos(a)) || 1;
      B.part('neck', plateXY([[0, -0.12], [1.05, -0.05], [1.15, 0.05], [0, 0.12]], 0.05, 0.02), i % 2 ? 'frame' : 'plate', Math.sin(a) * 0.25, 0.35 + Math.cos(a) * 0.25, 0.15, 0, 0, Math.PI / 2 - a);
      B.part('neck', shell(0.05, 0.05, 0.05, { e: 0.3 }), 'glow', Math.sin(a) * 1.25, 0.35 + Math.cos(a) * 1.25, 0.15); }
    B.mirror(sd => { B.part('chest', cyl(0.28, 0.28, 1.4, 14), 'frame', sd * 0.45, 1.0, 0.2, Math.PI / 2, 0, 0); B.part('chest', cyl(0.22, 0.22, 1.2, 14), 'glow', sd * 0.45, 1.0, 0.2, Math.PI / 2, 0, 0); });
    return o;
  },
  rdragon(B) {
    const o = quad(B, { s: 0.9, hipH: 2.2, bw: 1.7, bh: 1.45, bodyL: 2.0, legB: Object.assign([1.0, 0.9, 0.35], { w: 0.68 }), legF: Object.assign([0.9, 0.8, 0.3], { w: 0.6 }),
      neckN: 4, neckL: 0.62, neckRise: 0.32, neckW: 0.72, headL: 1.5, headW: 0.82, headH: 0.85, tailN: 9, tailL: 0.8 });
    teeth(B, 'head', 0.35, 1.35, -0.12, 0.28, true, 0.85); teeth(B, 'jaw', 0.4, 1.25, 0.02, 0.24, false, 0.8);
    // horns, back blades, spade tail, flame-jet nozzles
    B.mirror(sd => { B.part('head', cone(0.13, 1.3, 8), 'joint', sd * 0.28, 0.45, -0.2, -2.0, 0, sd * -0.35); B.part('head', cone(0.08, 0.7, 7), 'frame', sd * 0.38, 0.25, -0.15, -1.9, 0, sd * -0.8);
      B.part('head', cyl(0.09, 0.12, 0.3, 10), 'frame', sd * 0.2, -0.05, 1.35, Math.PI / 2, 0, 0); B.part('head', cyl(0.07, 0.07, 0.04, 10), 'glow', sd * 0.2, -0.05, 1.51, Math.PI / 2, 0, 0); });
    dorsal(B, 'chest', -2.4, 0.4, o.bh * 0.5, 6, 0.8, 'frame'); dorsal(B, 'pelvis', -1.0, 0.5, o.bh * 0.5, 3, 0.7, 'frame');
    for (let i = 0; i < 4; i++) dorsal(B, 'neck' + i, -0.1, 0.3, 0.38, 1, 0.45, i % 2 ? 'glow' : 'frame');
    B.part('tail8', plateXY([[0, 0.2], [0.6, -0.3], [0, -1.2], [-0.6, -0.3]], 0.06), 'frame', 0, 0, -0.6, Math.PI / 2, 0, 0);
    B.part('tail8', plateXY([[0, 0.05], [0.3, -0.3], [0, -0.8], [-0.3, -0.3]], 0.08), 'glow', 0, 0, -0.6, Math.PI / 2, 0, 0);
    B.socket('chest', 'jet', 0, -0.5, -1.8);
    // big jet-wings (ptero-style), scaled up
    const W = 1.35;
    B.mirror((sd, P) => {
      B.bone(P + 'wing', 'chest', sd * 0.7, 0.55, -0.6); B.bone(P + 'wing2', P + 'wing', sd * 2.6 * W, 0, 0);
      B.part(P + 'wing', shell(2.8 * W, 0.24, 0.36, { e: 0.5 }), 'frame', sd * 1.3 * W, 0, 0.2);
      B.part(P + 'wing', plateXY([[0, 0.4], [sd * 2.6 * W, 0.3], [sd * 2.6 * W, -1.1 * W], [sd * 2.0 * W, -1.35 * W], [sd * 1.3 * W, -1.25 * W], [sd * 0.6 * W, -1.7 * W], [0, -1.7 * W]], 0.06), 'plate', 0, 0, 0, Math.PI / 2, 0, 0);
      for (let k = 0; k < 3; k++) B.part(P + 'wing', shell(0.1, 0.1, 1.5 * W - k * 0.2, { e: 0.4 }), 'frame', sd * (0.5 + k * 0.8) * W, 0.06, -0.6 * W, 0, sd * (0.25 - k * 0.12), 0);
      B.part(P + 'wing', shell(2.3 * W, 0.05, 0.06, { e: 0.3 }), 'glow', sd * 1.3 * W, 0.06, -0.45 * W, 0, 0, 0);
      B.part(P + 'wing', cone(0.1, 0.6, 7), 'joint', sd * 2.65 * W, 0.0, 0.45, -1.2, 0, 0);
      B.part(P + 'wing', cone(0.1, 0.7, 7), 'joint', sd * 0.9, 0.12, 0.25, -0.3, 0, sd * -0.9);
      B.part(P + 'wing', cyl(0.25, 0.32, 1.4, 12), 'frame', sd * 1.3 * W, -0.32, -0.2, Math.PI / 2, 0, 0);
      B.part(P + 'wing', cyl(0.2, 0.2, 0.06, 12), 'glow', sd * 1.3 * W, -0.32, -0.92, Math.PI / 2, 0, 0);
      B.socket(P + 'wing', 'jet' + P, sd * 1.3 * W, -0.32, -1.0);
      B.part(P + 'wing2', shell(2.5 * W, 0.17, 0.28, { e: 0.5, tf: 0.5 }), 'frame', sd * 1.2 * W, 0, 0.25, 0, sd * 0.25, 0);
      B.part(P + 'wing2', plateXY([[0, 0.3], [sd * 2.9 * W, -0.45 * W], [sd * 2.3 * W, -0.75 * W], [sd * 1.6 * W, -0.7 * W], [sd * 0.9 * W, -1.05 * W], [0, -1.1 * W]], 0.05), 'plate', 0, 0, 0, Math.PI / 2, 0, 0);
      B.part(P + 'wing2', cone(0.07, 0.9, 7), 'frame', sd * 2.9 * W, 0.0, -0.45 * W, 0, 0, sd * -Math.PI / 2 + sd * 0.25);
      B.part(P + 'wing2', shell(2.3 * W, 0.05, 0.06, { e: 0.3 }), 'glow', sd * 1.2 * W, 0.05, -0.55 * W, 0, sd * -0.32, 0);
    });
    return { ...o, flyer: true, height: 3.6 };
  },
};

export class Mech {
  constructor(def, assets, wild = false) {
    const B = new Builder(def, assets, wild);
    this.info = SPECIES[def.kind](B);
    this.obj = new THREE.Group();
    this.rig = B.finish(); this.obj.add(this.rig);
    this.rig.scale.setScalar(def.scale);
    this.b = B.bones; this.sockets = B.sockets; this.mats = B.mats; this.meshes = B.meshes; this.def = def; this.wild = wild;
    this.phase = Math.random() * 6; this.t = Math.random() * 10; this.jaw = 0; this.flash = 0; this.ko = 0;
    this.quad = !!this.b.LFhip; this.flyer = !!this.info.flyer;
    this.rest = {}; for (const k in this.b) this.rest[k] = this.b[k].rotation.clone();
    // rest poses
    const set = (n, x, y = 0, z = 0) => { if (this.b[n]) { this.b[n].rotation.set(x, y, z); this.rest[n] = this.b[n].rotation.clone(); } };
    for (const P of ['L', 'R']) {
      if (this.quad) { for (const F of ['', 'F']) { set(P + F + 'hip', F ? -0.15 : 0.2); set(P + F + 'knee', F ? 0.2 : -0.35); set(P + F + 'ankle', F ? -0.05 : 0.15); set(P + F + 'foot', 0); } }
      else if (!this.flyer) { set(P + 'hip', -0.45); set(P + 'knee', 0.95); set(P + 'ankle', -0.75); set(P + 'foot', 0.25); set(P + 'sh', 0.4); set(P + 'el', -0.9); }
      else { set(P + 'hip', 0.9); set(P + 'knee', 0.9); set(P + 'ankle', -0.5); }
    }
    set('neck', this.quad ? 0 : -0.25); set('head', this.quad ? 0 : 0.2);
    // drop the rig so the lowest foot touches the ground
    if (!this.flyer) { this.rig.updateMatrixWorld(true); let minY = Infinity; const v = new THREE.Vector3();
      for (const k in this.b) if (k.endsWith('foot')) { this.b[k].getWorldPosition(v); minY = Math.min(minY, v.y / def.scale); }
      if (isFinite(minY)) this.info.hipH -= (minY - 0.08); this.b.pelvis.position.y = this.info.hipH; }
    // glow halos on eyes
    const hm = new THREE.SpriteMaterial({ map: assets.glow, color: B.mats.glowColor, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 });
    this.halos = [];
    for (const k of ['eyeL', 'eyeR']) if (this.sockets[k]) { const sp = new THREE.Sprite(hm); sp.scale.setScalar(0.9); this.sockets[k].add(sp); this.halos.push(sp); }
    this.haloMat = hm;
    this.obj.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = true; });
    { const bb = new THREE.Box3(); for (const m of this.meshes) { m.geometry.computeBoundingBox(); bb.union(m.geometry.boundingBox); } this.box = bb; this.fitR = bb.getSize(new THREE.Vector3()).length() * 0.5 * def.scale; }
    this.height = this.info.height ? this.info.height * def.scale : (this.flyer ? 2.6 : (this.info.hipH + (this.quad ? 1.5 : 2.4))) * def.scale;
  }
  socketPos(name, out) { const s = this.sockets[name] || this.sockets.mouth; return s.getWorldPosition(out); }
  dispose() { this.meshes.forEach(m => { m.geometry.dispose(); }); Object.values(this.mats).forEach(m => m.dispose && m.dispose()); this.haloMat.dispose(); }

  animate(dt, speed, opts = {}) {
    const b = this.b, r = this.rest, sc = this.def.scale;
    this.t += dt;
    const stride = (this.quad ? 2.2 : 2.6) * sc * (this.flyer ? 1 : 1);
    this.phase += speed * dt / stride * Math.PI;
    const ph = this.phase, k = Math.min(1, speed / (4 * sc)), breath = Math.sin(this.t * 2) * 0.03;
    const R = (n, x = 0, y = 0, z = 0) => { const bo = b[n]; if (!bo) return; const rr = r[n]; bo.rotation.set(rr.x + x, rr.y + y, rr.z + z); };
    if (this.flyer) {
      const fl = opts.flying ? 1 : 0, flap = Math.sin(this.t * (opts.boost ? 9 : 5)) * (0.35 + 0.2 * k);
      R('Lwing', 0, 0, flap * fl + (1 - fl) * 0.9); R('Rwing', 0, 0, -flap * fl - (1 - fl) * 0.9);
      R('Lwing2', 0, 0, flap * 0.6 * fl); R('Rwing2', 0, 0, -flap * 0.6 * fl);
      R('pelvis', -0.1 * k + (opts.climb || 0) * -0.3, 0, (opts.turn || 0) * -0.5);
      b.pelvis.position.y = this.info.hipH + Math.sin(this.t * 2.5) * 0.15;
      if (this.quad) for (const P of ['L', 'R']) { R(P + 'hip', 0.85 + 0.05 * Math.sin(this.t * 3)); R(P + 'knee', -0.2); R(P + 'Fhip', -0.4); R(P + 'Fknee', 0.9); }
      else for (const P of ['L', 'R']) R(P + 'hip', 0.2 * Math.sin(this.t * 3));
      if (this.quad) for (let i = 0; i < 6; i++) R('neck' + i, fl * 0.1);
    } else if (this.quad) {
      const legs = [['L', 0], ['RF', 0], ['R', Math.PI], ['LF', Math.PI]];
      for (const [P, o] of legs) { const s = Math.sin(ph + o), lift = Math.max(0, Math.cos(ph + o));
        R(P + 'hip', s * 0.5 * k); R(P + 'knee', (P.includes('F') ? 1 : -1) * lift * 0.5 * k); R(P + 'ankle', -s * 0.25 * k); }
      b.pelvis.position.y = this.info.hipH + Math.abs(Math.cos(ph)) * 0.06 * k + breath;
      R('pelvis', 0, 0, Math.sin(ph) * 0.03 * k);
    } else {
      for (const [P, o] of [['L', 0], ['R', Math.PI]]) { const s = Math.sin(ph + o), lift = Math.max(0, Math.cos(ph + o));
        R(P + 'hip', s * 0.55 * k - lift * 0.15 * k); R(P + 'knee', lift * 0.6 * k); R(P + 'ankle', -lift * 0.35 * k - s * 0.1 * k); R(P + 'foot', -s * 0.2 * k);
        R(P + 'sh', -s * 0.25 * k + breath); }
      b.pelvis.position.y = this.info.hipH - 0.1 * k + Math.abs(Math.cos(ph)) * 0.12 * k + breath;
      R('pelvis', 0.08 * k, Math.sin(ph) * 0.06 * k, Math.sin(ph) * 0.04 * k);
    }
    // tail sway & head
    for (let i = 0; i < 10; i++) { const n = 'tail' + i; if (!b[n]) break; R(n, Math.sin(this.t * 1.3 + i * 0.5) * 0.03 + (i === 0 ? 0.05 : 0.02), Math.sin(ph * 0.5 + i * 0.6 + this.t * 0.8) * (0.06 + 0.06 * k) - (opts.turn || 0) * 0.08 * i * 0.3, 0); }
    R('neck', -Math.sin(ph * 2) * 0.03 * k + (opts.roar || 0) * -0.3, (opts.look || 0) * 0.3);
    R('head', Math.sin(ph * 2) * 0.04 * k + breath + (opts.roar || 0) * -0.35 + (opts.aim || 0), (opts.look || 0) * 0.3);
    this.jaw += ((opts.jaw || 0) - this.jaw) * Math.min(1, dt * 18);
    R('jaw', this.jaw * 0.75 + Math.max(0, Math.sin(this.t * 0.7)) * 0.04);
    // hit flash / KO dim
    this.flash = Math.max(0, this.flash - dt * 5);
    this.mats.plate.emissive.setRGB(this.flash * 0.9, this.flash * 0.6, this.flash * 0.4);
    const pulse = (1 - this.ko) * (1.6 + 0.6 * Math.sin(this.t * 4)) + 0.05;
    this.mats.glow.color.copy(this.mats.glowColor).multiplyScalar(pulse);
    this.haloMat.opacity = (1 - this.ko) * (0.75 + 0.2 * Math.sin(this.t * 4));
  }
}
