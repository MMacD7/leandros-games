// Dragon Peak: the second level. Volcanic heightfield, glowing lava sea, ash vegetation & crystals,
// dark castle ruins (battle arena), floating rock islands, dragon nests, night sky and lightning.
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { fbm, noise2, rng, smooth, clamp, lerp } from './noise.js';
import { barkTexture } from './proctex.js';
import { S, BASE, ARENA, VOLC, TITLE, triplanar, trunkGeo } from './world.js';

export function rawHeightPeak(x, z) {
  const d0 = Math.hypot(x, z);
  const r = d0 / 292 + fbm(x * 0.006 + 5.1, z * 0.006 - 2.7, 4) * 0.24;
  const land = 1 - smooth(0.7, 0.98, r);
  const db = Math.hypot(x - BASE.x, z - BASE.z), da = Math.hypot(x - ARENA.x, z - ARENA.z), dv = Math.hypot(x - VOLC.x, z - VOLC.z), dt = Math.hypot(x - TITLE.x, z - TITLE.z);
  let h = -7 + land * 10.5 + fbm(x * 0.025, z * 0.025, 3) * 2.2 * land;
  // jagged ridged mountains (kept away from the base)
  const mask = smooth(0.9, 0.5, r) * smooth(50, 115, db);
  const rr = 1 - Math.abs(fbm(x * 0.0085 + 3, z * 0.0085 + 8, 5));
  h += mask * (rr * rr * rr * rr * 50 + Math.max(0, fbm(x * 0.013, z * 0.013, 4) + 0.1) * 16);
  // winding lava canyons: shallow molten channels (passable but hot)
  const cn = Math.abs(fbm(x * 0.0058 - 7, z * 0.0058 + 4, 3));
  const canyon = smooth(0.075, 0.0, cn) * smooth(45, 85, db) * smooth(60, 95, da) * smooth(26, 50, dt) * land;
  h = lerp(h, -0.9, canyon);
  if (h > -1.5 && h < 2.5) h = lerp(h, 0.8 + (h - 0.8) * 0.6, 0.5);
  // Dragon Peak itself: a taller, craggier volcano
  const cone = 150 * Math.pow(Math.max(0, 1 - dv / 165), 1.45) * (1 + fbm(x * 0.045, z * 0.045, 4) * 0.2);
  h = Math.max(h, h * 0.3 + cone);
  if (dv < 22) h -= (1 - dv / 22) * (1 - dv / 22) * 34;
  h = lerp(h, 3.0, 1 - smooth(18, 34, db));
  h = lerp(h, 5.0, 1 - smooth(36, 56, da));
  return h;
}

// ---------- molten lava sea (replaces the ocean) ----------
export function buildLavaSea(W) {
  const u = W.hmUniforms({ uTime: { value: 0 } }); W.waterU = u;
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  mat.customProgramCacheKey = () => 'lava-sea';
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
    if (!sh.vertexShader.includes('vWP = (modelMatrix')) sh.vertexShader = sh.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D uHM; uniform float uS, uN, uTime; varying vec3 vWP;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vno(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1.0,0.0)), f.x), mix(h21(i+vec2(0.0,1.0)), h21(i+vec2(1.0,1.0)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `
vec2 huv = ((vWP.xz + uS*0.5)/uS*uN + 0.5)/(uN+1.0);
float th = texture2D(uHM, clamp(huv, 0.0, 1.0)).r; float dep = max(0.0, -th);
vec2 p = vWP.xz * 0.05;
float n = vno(p + vec2(uTime*0.05, uTime*0.02))*0.55 + vno(p*2.3 - vec2(uTime*0.07, -uTime*0.04))*0.3 + vno(p*5.1 + uTime*0.1)*0.15;
float cr = smoothstep(0.44, 0.6, n);
float shore = 1.0 - smoothstep(0.0, 2.2, dep);
vec3 hot = mix(vec3(3.0,0.75,0.08), vec3(3.4,1.7,0.4), smoothstep(0.1, 0.42, 0.44 - n + 0.1));
vec3 crust = mix(vec3(0.07,0.02,0.012), vec3(0.42,0.07,0.02), smoothstep(0.78, 0.6, n));
vec3 c = mix(hot, crust, cr * (1.0 - shore * 0.7));
c += vec3(1.4,0.35,0.04) * shore * (0.6 + 0.4*sin(uTime*2.0 + dep*6.0 + vWP.x*0.1));
diffuseColor.rgb = c;`);
  };
  const g = new THREE.PlaneGeometry(5000, 5000, 1, 1); g.rotateX(-Math.PI / 2);
  const w = new THREE.Mesh(g, mat); w.position.y = -0.05; w.renderOrder = 0; W.root.add(w); W.water = w;
  // a few big soft glows hovering over the lava for that hot haze
  const gm = new THREE.SpriteMaterial({ map: W.assets.glow, color: 0xff4a10, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35, fog: false });
  W.hazes = []; const r = rng(55);
  for (let i = 0; i < 26; i++) { const a = r() * 6.283, d = 240 + r() * 220; const s = new THREE.Sprite(gm); s.position.set(Math.cos(a) * d, 6, Math.sin(a) * d); s.scale.set(120, 26, 1); W.root.add(s); W.hazes.push(s); }
}

const pick = (W, r, test, count, tries) => { const out = []; for (let t = 0; t < tries && out.length < count; t++) {
  const x = (r() - 0.5) * S * 0.8, z = (r() - 0.5) * S * 0.8; const h = W.height(x, z); if (test(x, z, h)) out.push([x, z, h]); } return out; };
const away = (x, z, k = 1) => Math.hypot(x - BASE.x, z - BASE.z) > 30 * k && Math.hypot(x - ARENA.x, z - ARENA.z) > 50 * k && Math.hypot(x - VOLC.x, z - VOLC.z) > 40 && Math.hypot(x - TITLE.x, z - TITLE.z) > 14;
function inst(W, geo, mat, items, place, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length)); m.count = items.length; m.castShadow = shadow; m.receiveShadow = true;
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  items.forEach((it, i) => { place(it, p, e, s); q.setFromEuler(e); M.compose(p, q, s); m.setMatrixAt(i, M); });
  m.computeBoundingSphere(); W.root.add(m); return m;
}
function crystalGeo(seed, n = 6) {
  const r = rng(seed), parts = [];
  for (let i = 0; i < n; i++) { const h = 1.4 + r() * 2.4, g = new THREE.ConeGeometry(0.28 + r() * 0.25, h, 5, 1); g.translate(0, h / 2, 0);
    g.rotateZ((r() - 0.5) * 1.1); g.rotateX((r() - 0.5) * 1.1); g.translate((r() - 0.5) * 1.2, 0, (r() - 0.5) * 1.2); parts.push(g.toNonIndexed()); }
  const m = mergeGeometries(parts); m.computeVertexNormals(); return m;
}
function rockGeo(seed, flat = 0.75) {
  const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + noise2(x * 1.7 + seed, y * 1.7 + z * 1.3) * 0.38 + noise2(z * 4, x * 4 + seed) * 0.1; p.setXYZ(i, x * k, y * k * flat, z * k); }
  g.computeVertexNormals(); return g;
}

// ---------- charred trees, ember crystals, basalt rocks, obsidian spires ----------
export function buildPeakVegetation(W) {
  const A = W.assets, r = rng(808);
  W.lodSets = []; W.lodTimer = 0; W.spires = []; W.windU = { uTime: { value: 0 } };
  const bark = barkTexture();
  const barkMat = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95, color: 0x4a3a34 });
  const deadTree = (H, lod) => { const sides = lod ? 4 : 7, parts = [trunkGeo(H, 0.5, 0.36, sides, lod ? 3 : 7)]; const rr = rng(H * 7 | 0);
    for (let i = 0; i < (lod ? 3 : 5); i++) { const L = 2.2 + rr() * 2.6, b = trunkGeo(L, 0.6, 0.13, lod ? 3 : 5, lod ? 2 : 3); b.rotateZ(-0.7 - rr() * 0.5); b.rotateY(i / 5 * 6.283 + rr()); b.translate(0.2, H * (0.45 + i * 0.1), 0); parts.push(b); }
    const g = mergeGeometries(parts.map(p => p.index ? p : p)); return g; };
  const trees = pick(W, r, (x, z, h) => h > 2 && h < 45 && away(x, z) && W.normalAtY(x, z) > 0.8 && fbm(x * 0.013 + 4, z * 0.013, 3) > -0.05, 150, 20000);
  const sets = [[deadTree(8, false), deadTree(8, true)], [deadTree(11, false), deadTree(11, true)]];
  sets.forEach(([hiG, loG], v) => { const items = trees.filter((_, i) => i % 2 === v);
    const hi = new THREE.InstancedMesh(hiG, barkMat, items.length), lo = new THREE.InstancedMesh(loG, barkMat, items.length);
    [hi, lo].forEach(m => { m.castShadow = m === hi; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; W.root.add(m); });
    W.lodSets.push({ hi: [hi], lo: [lo], items: items.map(([x, z, h]) => { const s = 0.8 + r() * 0.6; W.addCollider(x, z, 0.5 * s, 10 * s);
      return { x, z, m: new THREE.Matrix4().compose(new THREE.Vector3(x, h - 0.3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.15, r() * 6.283, (r() - 0.5) * 0.15)), new THREE.Vector3(s, s, s)) }; }) }); });
  // glowing crystals: fiery orange and storm purple
  const crys = pick(W, r, (x, z, h) => h > 1.5 && h < 70 && away(x, z), 170, 20000);
  const cA = new THREE.MeshStandardMaterial({ color: 0x501208, emissive: 0xff3a0a, emissiveIntensity: 1.7, roughness: 0.25, metalness: 0.1, flatShading: true });
  const cB = new THREE.MeshStandardMaterial({ color: 0x1c1040, emissive: 0x8a4aff, emissiveIntensity: 1.5, roughness: 0.2, metalness: 0.1, flatShading: true });
  [[crystalGeo(3), cA], [crystalGeo(9), cB]].forEach(([g, m], v) => inst(W, g, m, crys.filter((_, i) => i % 3 === (v ? 2 : 0) || (v === 0 && i % 3 === 1)), ([x, z, h], p, e, s) => { const k = 0.7 + r() * 1.3; p.set(x, h - 0.2, z); e.set(0, r() * 6.283, 0); s.set(k, k, k); if (k > 1.4) W.addCollider(x, z, 1.2 * k, h + 3 * k); }, false));
  // basalt boulders
  const rockMat = triplanar(new THREE.MeshStandardMaterial({ map: A.rock, normalMap: A.rockNor, roughness: 0.9, color: 0x5a5254 }), 0.35); W.rockMat = rockMat;
  const rocks = pick(W, r, (x, z, h) => h > 0.5 && away(x, z) && r() < 0.6, 150, 8000);
  inst(W, rockGeo(3), rockMat, rocks, ([x, z, h], p, e, s) => { const k = 0.8 + Math.pow(r(), 2.5) * 5; p.set(x, h + k * 0.15, z); e.set(r(), r() * 6, r() * 0.4); s.set(k * (1 + r() * 0.6), k, k); if (k > 1.6) W.addCollider(x, z, k, h + k); });
  // obsidian spires (lightning rods for the storm)
  const spireMat = new THREE.MeshStandardMaterial({ color: 0x17131c, roughness: 0.28, metalness: 0.35, flatShading: true });
  const sg = new THREE.ConeGeometry(1, 1, 6, 3); { const p = sg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 + noise2(i * 0.7, y * 3) * 0.25)); } sg.translate(0, 0.5, 0); sg.computeVertexNormals(); }
  const spires = pick(W, r, (x, z, h) => h > 3 && h < 60 && away(x, z, 1.2) && W.normalAtY(x, z) < 0.93, 70, 12000);
  inst(W, sg, spireMat, spires, ([x, z, h], p, e, s) => { const H = 6 + r() * 16, w = 1.4 + r() * 1.6; p.set(x, h - 1, z); e.set((r() - 0.5) * 0.25, r() * 6, (r() - 0.5) * 0.25); s.set(w, H, w); W.addCollider(x, z, w * 0.9, h + H); W.spires.push(new THREE.Vector3(x, h + H - 1, z)); });
}

// ---------- the castle ruins (Dragon Peak battle arena) ----------
export function buildCastle(W) {
  const A = W.assets, r = rng(99);
  const stone = triplanar(new THREE.MeshStandardMaterial({ map: A.rock, normalMap: A.rockNor, normalScale: new THREE.Vector2(1.3, 1.3), roughness: 0.88, color: 0x8a8090 }), 0.2);
  const roofM = new THREE.MeshStandardMaterial({ color: 0x5a1a14, roughness: 0.6, metalness: 0.2, flatShading: true });
  const winM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.9, 0.25), toneMapped: false });
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2626, metalness: 0.85, roughness: 0.45 });
  const boxes = [], cyls = [], cones = [], wins = [], braz = [];
  const ring = 41, NA = 18, gap = i => i % 6 === 2;
  const at = i => { const a = i / NA * Math.PI * 2; return [ARENA.x + Math.cos(a) * ring, ARENA.z + Math.sin(a) * ring]; };
  for (let i = 0; i < NA; i++) {
    const [x, z] = at(i), [x2, z2] = at(i + 1), h = W.height(x, z);
    if (!gap(i) && !gap(i + 1)) { // wall segment
      const mx = (x + x2) / 2, mz = (z + z2) / 2, len = Math.hypot(x2 - x, z2 - z) + 0.6, yaw = Math.atan2(x2 - x, z2 - z), mh = W.height(mx, mz);
      const broken = r() < 0.3, wh = broken ? 2.5 + r() * 2 : 7 + r() * 1.5;
      boxes.push([mx, mh - 1 + wh / 2 + 0.5, mz, 2.4, wh + 1, len, yaw]);
      for (let k = 0; k < 3; k++) { const t = (k + 0.5) / 3; W.addCollider(x + (x2 - x) * t, z + (z2 - z) * t, 2.2, mh + wh); }
      if (!broken) { const n = Math.floor(len / 2.2); for (let k = 0; k < n; k += 2) { const t = (k + 0.5) / n - 0.5; boxes.push([mx + Math.sin(yaw) * t * len, mh + wh + 1.1, mz + Math.cos(yaw) * t * len, 2.6, 1.4, 1.1, yaw]); } }
      else for (let k = 0; k < 4; k++) { const bx = mx + (r() - 0.5) * 9, bz = mz + (r() - 0.5) * 9; boxes.push([bx, W.height(bx, bz) + 0.5, bz, 1.4 + r() * 1.4, 1.1, 1.4 + r() * 2, r() * 3]); }
    }
    if (i % 3 === 0) { // tower
      const broken = r() < 0.3, th = broken ? 7 + r() * 3 : 15 + r() * 6;
      cyls.push([x, h - 1, z, 3.5, th + 1]); cyls.push([x, h + th, z, 4.1, 1.4]);
      W.addCollider(x, z, 4, h + th); if (W.spires) W.spires.push(new THREE.Vector3(x, h + th + 6, z));
      if (!broken) cones.push([x, h + th + 1.4, z, 4.4, 7]);
      for (let k = 0; k < 2; k++) { const a = Math.atan2(ARENA.z - z, ARENA.x - x) + (k - 0.5) * 0.9; wins.push([x + Math.cos(a) * 3.52, h + th * (0.45 + k * 0.25), z + Math.sin(a) * 3.52, Math.atan2(Math.cos(a), Math.sin(a))]); }
    }
  }
  // the broken keep with a tall spire
  const kx = ARENA.x + 66, kz = ARENA.z - 22, kh = W.height(kx, kz);
  boxes.push([kx, kh + 5, kz, 24, 12, 19, 0.3]); boxes.push([kx + 1, kh + 14, kz - 1, 15, 8, 12, 0.3]); boxes.push([kx - 3, kh + 20, kz + 2, 6, 5, 6, 0.3]);
  cyls.push([kx + 8, kh, kz + 6, 3.3, 36]); cones.push([kx + 8, kh + 36, kz + 6, 4.4, 10]); cyls.push([kx + 8, kh + 35, kz + 6, 3.9, 1.2]);
  if (W.spires) W.spires.push(new THREE.Vector3(kx + 8, kh + 46, kz + 6));
  for (let k = 0; k < 4; k++) wins.push([kx + 8 - Math.cos(0.3) * 3.35, kh + 12 + k * 6, kz + 6 + Math.sin(0.3) * 3.35, -Math.PI / 2 + 0.3]);
  for (let k = 0; k < 3; k++) wins.push([kx - 12.1 * Math.cos(0.3) + (k - 1) * 6 * Math.sin(0.3) * 0, kh + 7, kz + 12.1 * Math.sin(0.3) * 0 + (k - 1) * 6, -Math.PI / 2 + 0.3]);
  W.addCollider(kx, kz, 13, kh + 22); W.addCollider(kx + 8, kz + 6, 4, kh + 36);
  // braziers around the fighting floor
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2, x = ARENA.x + Math.cos(a) * 31, z = ARENA.z + Math.sin(a) * 31, h = W.height(x, z); braz.push([x, h, z]); W.braziers.push(new THREE.Vector3(x, h + 2.1, z)); W.addCollider(x, z, 1.1, h + 2); }
  const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stone, boxes.length); bm.castShadow = bm.receiveShadow = true;
  boxes.forEach(([x, y, z, sx, sy, sz, a], i) => bm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(sx, sy, sz))));
  const cg = new THREE.CylinderGeometry(1, 1.08, 1, 12, 1); cg.translate(0, 0.5, 0);
  const cm = new THREE.InstancedMesh(cg, stone, cyls.length); cm.castShadow = cm.receiveShadow = true;
  cyls.forEach(([x, y, z, rr, h], i) => cm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(rr, h, rr))));
  const kg = new THREE.ConeGeometry(1, 1, 8, 1); kg.translate(0, 0.5, 0);
  const km = new THREE.InstancedMesh(kg, roofM, cones.length); km.castShadow = true;
  cones.forEach(([x, y, z, rr, h], i) => km.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(rr, h, rr))));
  const wm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1.8), winM, wins.length);
  wins.forEach(([x, y, z, yaw], i) => wm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1))));
  const bg = new THREE.CylinderGeometry(0.95, 0.55, 1.2, 8); bg.translate(0, 1.4, 0); const pg = new THREE.CylinderGeometry(0.22, 0.3, 1, 6); pg.translate(0, 0.4, 0);
  const brz = mergeGeometries([bg, pg]);
  const zm = new THREE.InstancedMesh(brz, metal, braz.length); zm.castShadow = true;
  braz.forEach(([x, y, z], i) => zm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))));
  W.root.add(bm, cm, km, wm, zm);
  const gm = new THREE.SpriteMaterial({ map: A.glow, color: 0xff7a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 });
  W.brazGlows = W.braziers.map(p => { const s = new THREE.Sprite(gm); s.position.copy(p).y += 0.6; s.scale.set(7, 7, 1); W.root.add(s); return s; });
}

// ---------- floating islands, dragon nests ----------
function islandGeo(seed, R) {
  const r = rng(seed), top = new THREE.CylinderGeometry(R, R * 0.92, 2.2, 14, 1), bot = new THREE.ConeGeometry(R * 0.95, R * (1.4 + r() * 0.8), 14, 6), bot2 = new THREE.ConeGeometry(R * 0.5, R * (1.0 + r() * 0.6), 9, 4);
  bot.rotateX(Math.PI); bot.translate(0, -1.1 - R * 0.7, 0); bot2.rotateX(Math.PI); bot2.translate(R * 0.35, -1.0 - R * 0.6, -R * 0.2);
  for (const g of [top, bot, bot2]) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + noise2(x * 0.35 + seed, z * 0.35 + y * 0.45) * 0.42 + noise2(x * 1.1, y * 1.3 + z + seed) * 0.12; p.setXYZ(i, x * k, y + (y > 0.9 ? noise2(x * 0.5, z * 0.5 + seed) * 0.5 : 0), z * k); } }
  const g = mergeGeometries([top.toNonIndexed(), bot.toNonIndexed(), bot2.toNonIndexed()]); g.computeVertexNormals(); return g;
}
function eggTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#ffb040'; g.lineWidth = 3; g.shadowColor = '#ff6a10'; g.shadowBlur = 6;
  for (let i = 0; i < 9; i++) { g.beginPath(); let x = Math.random() * 128, y = Math.random() * 128; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(255,140,40,.8)'; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildPeakExtras(W) {
  const A = W.assets, r = rng(321);
  W.floaters = []; W.nests = [];
  const rockMat = triplanar(new THREE.MeshStandardMaterial({ map: A.rock, normalMap: A.rockNor, roughness: 0.85, color: 0x8a7a78 }), 0.3);
  const crysM = new THREE.MeshStandardMaterial({ color: 0x501208, emissive: 0xff4a10, emissiveIntensity: 2.2, roughness: 0.25, flatShading: true });
  const spots = [[-22, 70, 128, 13], [64, 88, 112, 10], [8, 112, 62, 16], [-90, 76, 40, 12], [150, 70, -40, 11], [-150, 95, -20, 15], [40, 100, -170, 13], [-60, 65, 200, 9], [190, 85, 120, 12], [-200, 80, 150, 11], [110, 120, -120, 14], [-120, 105, -170, 12]];
  const nestPlace = [];
  spots.forEach(([x, y, z, R], i) => {
    const grp = new THREE.Group(); grp.position.set(x, y, z);
    const m = new THREE.Mesh(islandGeo(i * 13 + 5, R), rockMat); m.castShadow = m.receiveShadow = true; grp.add(m);
    const cg = crystalGeo(i + 40, 5); for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(cg, crysM); const a = r() * 6.283; c.position.set(Math.cos(a) * R * 0.4, -1.5 - R * (0.3 + r() * 0.4), Math.sin(a) * R * 0.4); c.rotation.x = Math.PI + (r() - 0.5) * 0.6; c.scale.setScalar(0.8 + r() * 0.6); grp.add(c); }
    W.root.add(grp); W.floaters.push({ g: grp, y0: y, ph: r() * 6.283, sp: 0.25 + r() * 0.2 });
    if (i % 2 === 0) nestPlace.push({ grp, x: 0, y: 1.2, z: 0 });
  });
  for (const [x, z, h] of pick(W, r, (x, z, h) => h > 24 && h < 90 && away(x, z, 1.3) && W.normalAtY(x, z) > 0.78, 5, 20000)) nestPlace.push({ grp: W.root, x, y: h + 0.3, z });
  // nests: woven torus of charred branches with glowing eggs
  const bark = barkTexture(); const nestM = new THREE.MeshStandardMaterial({ map: bark, color: 0x6a5040, roughness: 1 });
  const tor = new THREE.TorusGeometry(3.2, 1.1, 7, 16); tor.rotateX(Math.PI / 2);
  const sticks = []; for (let k = 0; k < 22; k++) { const s = new THREE.CylinderGeometry(0.1, 0.12, 3.2 + r() * 1.5, 4); s.rotateZ(Math.PI / 2 + (r() - 0.5) * 0.6); s.rotateY(k / 22 * 6.283); s.translate(Math.cos(k / 22 * 6.283) * 3.3, 0.5 + (r() - 0.5) * 0.8, -Math.sin(k / 22 * 6.283) * 3.3); sticks.push(s.toNonIndexed()); }
  const nestG = mergeGeometries([tor.toNonIndexed(), ...sticks]);
  const eggM = new THREE.MeshStandardMaterial({ color: 0x3a2236, roughness: 0.4, metalness: 0.2, emissive: 0xffffff, emissiveMap: eggTexture(), emissiveIntensity: 1.6 });
  const eggG = new THREE.SphereGeometry(0.85, 14, 10); eggG.scale(1, 1.35, 1);
  const gm = new THREE.SpriteMaterial({ map: A.glow, color: 0xff6a20, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 });
  for (const n of nestPlace) {
    const g = new THREE.Group(); g.position.set(n.x, n.y, n.z);
    const nm = new THREE.Mesh(nestG, nestM); nm.castShadow = nm.receiveShadow = true; g.add(nm);
    for (let k = 0; k < 3; k++) { const e = new THREE.Mesh(eggG, eggM); const a = k / 3 * 6.283 + r(); e.position.set(Math.cos(a) * 1.0, 0.9, Math.sin(a) * 1.0); e.rotation.set((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5); g.add(e); }
    const s = new THREE.Sprite(gm); s.position.y = 2.2; s.scale.set(9, 7, 1); g.add(s);
    n.grp.add(g); W.nests.push(g);
    if (n.grp === W.root) W.addCollider(n.x, n.z, 4, n.y + 2);
  }
  W.boltT = 2.5;
}

export function updatePeak(W, dt, cam) {
  for (const f of W.floaters) { f.g.position.y = f.y0 + Math.sin(W.time * f.sp + f.ph) * 1.6; f.g.rotation.y += dt * 0.02; }
  if (W.brazGlows) { const k = 0.75 + 0.15 * Math.sin(W.time * 9) * Math.sin(W.time * 5.3); for (const s of W.brazGlows) s.material.opacity = k; }
  if (W.hazes) for (const h of W.hazes) h.material.opacity = 0.3 + 0.08 * Math.sin(W.time * 0.7);
  W.flashT = Math.max(0, W.flashT - dt * 2.2);
  W.boltT -= dt;
  if (W.boltT <= 0) {
    W.boltT = 3 + Math.random() * 6;
    // strike a spire / tower top near the camera, otherwise open ground
    let to = null; const near = (W.spires || []).filter(p => Math.hypot(p.x - cam.x, p.z - cam.z) < 260);
    if (near.length && Math.random() < 0.75) to = near[(Math.random() * near.length) | 0].clone();
    else { const a = Math.random() * 6.283, d = 60 + Math.random() * 180; to = new THREE.Vector3(cam.x + Math.cos(a) * d, 0, cam.z + Math.sin(a) * d); to.y = Math.max(0, W.height(to.x, to.z)); }
    const from = to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 60, 150 + Math.random() * 40, (Math.random() - 0.5) * 60));
    W.flashT = 1; if (W.onBolt) W.onBolt(from, to, Math.hypot(to.x - cam.x, to.z - cam.z));
  }
}

// ---------- dusk/night sky ----------
export function peakSky() {
  const w = 2048, h = 1024, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#05030c'); gr.addColorStop(0.25, '#120a2c'); gr.addColorStop(0.38, '#341444'); gr.addColorStop(0.45, '#7a2430'); gr.addColorStop(0.495, '#d8582a'); gr.addColorStop(0.52, '#6a2416'); gr.addColorStop(0.6, '#2a0c0a'); gr.addColorStop(1, '#0a0405');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // sunset glow on one side (where the sun light comes from)
  const sx = w * 0.62, sy = h * 0.5; const sg = g.createRadialGradient(sx, sy, 0, sx, sy, w * 0.28); sg.addColorStop(0, 'rgba(255,150,60,.9)'); sg.addColorStop(0.25, 'rgba(255,90,40,.45)'); sg.addColorStop(1, 'rgba(120,20,40,0)'); g.fillStyle = sg; g.fillRect(0, 0, w, h);
  // stars
  const r = rng(77); for (let i = 0; i < 1400; i++) { const y = Math.pow(r(), 1.7) * h * 0.44, x = r() * w, b = r(); g.fillStyle = `rgba(255,${230 + b * 25 | 0},${200 + b * 55 | 0},${0.25 + b * 0.75})`; g.fillRect(x, y, b > 0.93 ? 2.4 : 1.3, b > 0.93 ? 2.4 : 1.3); }
  // a big moon
  const mx = w * 0.2, my = h * 0.22; const mg = g.createRadialGradient(mx, my, 0, mx, my, 90); mg.addColorStop(0, 'rgba(255,220,200,.35)'); mg.addColorStop(1, 'rgba(255,200,180,0)'); g.fillStyle = mg; g.fillRect(mx - 100, my - 100, 200, 200);
  g.fillStyle = '#ffe6d0'; g.beginPath(); g.arc(mx, my, 26, 0, 7); g.fill(); g.fillStyle = 'rgba(180,140,130,.35)'; for (const [dx, dy, rr] of [[-8, -5, 7], [7, 6, 5], [4, -10, 4]]) { g.beginPath(); g.arc(mx + dx, my + dy, rr, 0, 7); g.fill(); }
  // streaky clouds lit from below
  for (let i = 0; i < 70; i++) { const y = h * (0.3 + r() * 0.18), x = r() * w, cw = 120 + r() * 380, ch = 6 + r() * 16; const k = (y / h - 0.3) / 0.18;
    g.fillStyle = `rgba(${40 + k * 150 | 0},${12 + k * 40 | 0},${30 + k * 10 | 0},${0.35 + r() * 0.35})`; g.beginPath(); g.ellipse(x, y, cw / 2, ch / 2, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(x - w, y, cw / 2, ch / 2, 0, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
