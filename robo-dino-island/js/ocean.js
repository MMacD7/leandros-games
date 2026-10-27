// DEEP SEA SHOWDOWN: the fourth level, on the sea floor. Same concept as Jungle Island (roam, wild creatures, arena waves,
// a boss) but underwater: dense blue water fog, animated CAUSTIC light on the sand (terrain shader), swaying kelp forests,
// coral reefs, rocks, a SUNKEN PIRATE SHIP with treasure, sunken Atlantis ruins in the arena, rising bubbles, drifting
// "marine snow", fish schools and slanted GOD RAYS from the shimmering surface overhead. Everything is instanced or a
// single mesh, and the far draw distance is capped by the fog (nothing past ~300 m is drawn), so it stays iPad-friendly.
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { fbm, noise2, rng, smooth, clamp, lerp } from './noise.js';
import { BASE, ARENA, VOLC, TITLE, triplanar } from './world.js';
import { SeaBeast } from './sea.js';

export const SURF = 66; // the water surface (seen from below)
// (lazy: world.js and ocean.js import each other, so the shared constants are only read at run time)
const SHIP = () => ({ x: ARENA.x - 78, z: ARENA.z + 70 });
export function rawHeightOcean(x, z) {
  const d0 = Math.hypot(x, z), db = Math.hypot(x - BASE.x, z - BASE.z), da = Math.hypot(x - ARENA.x, z - ARENA.z), dv = Math.hypot(x - VOLC.x, z - VOLC.z);
  let h = 7 + fbm(x * 0.006, z * 0.006, 4) * 4 + Math.sin(x * 0.11 + fbm(x * 0.02, z * 0.02, 2) * 4) * 0.45; // sand dunes + ripples
  const ridge = 1 - Math.abs(fbm(x * 0.008 + 5, z * 0.008 - 3, 4)); h += Math.pow(ridge, 5) * 26 * smooth(60, 140, db) * smooth(70, 120, da); // reef ridges
  h += smooth(290, 390, d0 + fbm(x * 0.01, z * 0.01, 2) * 40) * 55; // canyon walls all around (the edge of the world)
  const cone = 58 * Math.pow(Math.max(0, 1 - dv / 125), 1.6) * (1 + fbm(x * 0.05, z * 0.05, 3) * 0.12); h = Math.max(h, h * 0.4 + cone); // seamount + hot vent
  if (dv < 16) h -= (1 - dv / 16) * (1 - dv / 16) * 16;
  const S0 = SHIP(), ds = Math.hypot(x - S0.x, z - S0.z); h = lerp(h, 6.5, 1 - smooth(22, 40, ds));
  h = lerp(h, 3.0, 1 - smooth(18, 34, db)); h = lerp(h, 5.0, 1 - smooth(34, 52, da));
  return h;
}
// terrain shader pieces: tileable animated caustics (well-known iterative water-caustic pattern)
export const oceanGLSL = () => `
float caus(vec2 p, float time){
  vec2 pp = mod(p * 6.28318, 6.28318) - 250.0; vec2 i = pp; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++) { float t = time * (1.0 - (3.5 / float(n + 1)));
    i = pp + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(pp.x / (sin(i.x + t) / inten), pp.y / (cos(i.y + t) / inten))); }
  c /= 4.0; c = 1.17 - pow(c, 1.4); return pow(abs(c), 8.0); }`;

export function oceanSky() { // background + environment: bright water overhead fading to the deep blue below
  const w = 512, h = 256, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#bff4ff'); gr.addColorStop(0.18, '#5cc8e6'); gr.addColorStop(0.42, '#1a7aa0'); gr.addColorStop(0.5, '#0e5a7c'); gr.addColorStop(0.7, '#073650'); gr.addColorStop(1, '#021822');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const sg = g.createRadialGradient(w * 0.3, 0, 0, w * 0.3, 0, h * 0.5); sg.addColorStop(0, 'rgba(255,255,240,.9)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sg; g.fillRect(0, 0, w, h * 0.5);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function rippleTex() { const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); g.fillStyle = '#6ad0ee'; g.fillRect(0, 0, N, N); const r = rng(3);
  for (let i = 0; i < 160; i++) { const x = r() * N, y = r() * N, rr = 8 + r() * 26; for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { const gg = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr); gg.addColorStop(0, 'rgba(235,255,255,.55)'); gg.addColorStop(0.6, 'rgba(160,235,255,.15)'); gg.addColorStop(1, 'rgba(160,235,255,0)'); g.fillStyle = gg; g.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
function rayTex() { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(0.5, 'rgba(255,255,255,.45)'); v.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in'; const hgr = g.createLinearGradient(0, 0, 64, 0); hgr.addColorStop(0, 'rgba(0,0,0,0)'); hgr.addColorStop(0.5, 'rgba(0,0,0,1)'); hgr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = hgr; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function plankTex() { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d'); const r = rng(8);
  for (let y = 0; y < 128; y += 16) { const v = 70 + r() * 40 | 0; g.fillStyle = `rgb(${v + 20},${v},${v - 25})`; g.fillRect(0, y, 128, 16); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, y, 128, 2); g.fillRect((r() * 128) | 0, y, 2, 16); }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(40,90,70,${r() * 0.25})`; g.fillRect(r() * 128, r() * 128, 2 + r() * 8, 1 + r() * 3); } // algae
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }

export function buildOcean(w) {
  const A = w.assets, r = rng(321), root = w.root; w.windU = { uTime: { value: 0 } }; w.lodSets = []; w.lodTimer = 0; w.drawCap = 300; w.vents = [];
  if (w.water) w.water.visible = false; w.lavaGlow.material.color.set(0x40fff0); w.lavaGlow.scale.set(40, 30, 1);
  const away = (x, z, pad = 0) => Math.hypot(x - BASE.x, z - BASE.z) > 30 + pad && Math.hypot(x - ARENA.x, z - ARENA.z) > 50 + pad && Math.hypot(x - VOLC.x, z - VOLC.z) > 40 + pad && Math.hypot(x - SHIP().x, z - SHIP().z) > 26 + pad && Math.hypot(x - TITLE.x, z - TITLE.z) > 16 + pad;
  const pick = (test, count, tries) => { const out = []; for (let t = 0; t < tries && out.length < count; t++) { const x = (r() - 0.5) * 680, z = (r() - 0.5) * 680, h = w.height(x, z); if (test(x, z, h)) out.push([x, z, h]); } return out; };
  const sway = (mat, k) => { mat.onBeforeCompile = sh => { sh.uniforms.uTime = w.windU.uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
    #ifdef USE_INSTANCING
    float ph = instanceMatrix[3].x * 0.07 + instanceMatrix[3].z * 0.05;
    #else
    float ph = 0.0;
    #endif
    float hh = max(0.0, transformed.y); transformed.x += sin(uTime * 0.9 + ph + hh * 0.18) * ${k.toFixed(3)} * hh * hh; transformed.z += cos(uTime * 0.7 + ph * 1.3 + hh * 0.15) * ${(k * 0.7).toFixed(3)} * hh * hh;`); }; mat.customProgramCacheKey = () => 'sway-ocean-' + k; };
  const mkSet = (geos, mat, items, scaleFn, colors) => {
    const hi = new THREE.InstancedMesh(geos.hi, mat, items.length), lo = new THREE.InstancedMesh(geos.lo || geos.hi, mat, items.length);
    for (const m of [hi, lo]) { m.frustumCulled = false; m.count = 0; m.castShadow = false; m.receiveShadow = true; root.add(m); }
    const its = items.map(([x, z, h], i) => { const s = scaleFn(); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.2, r() * 6.28, (r() - 0.5) * 0.2)); return { x, z, c: colors ? colors[i % colors.length] : null, m: new THREE.Matrix4().compose(new THREE.Vector3(x, h - 0.2, z), q, new THREE.Vector3(s, s, s)) }; });
    if (colors) { const c = new THREE.Color(); for (const m of [hi, lo]) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(items.length * 3), 3); } }
    w.lodSets.push({ hi: [hi], lo: [lo], items: its, colored: !!colors }); return its; };

  // ---- kelp forests: tall ribbons with alternating blades, swaying in the current ----
  const kelpGeo = (H, segs) => { const parts = []; const st = new THREE.PlaneGeometry(0.28, H, 1, segs); st.translate(0, H / 2, 0); parts.push(st);
    for (let k = 1; k < segs; k++) { const y = H * k / segs, bl = new THREE.PlaneGeometry(0.55, 1.6, 1, 1); bl.translate(0.3, 0.6, 0); bl.rotateZ(-0.6); bl.rotateY(k * 2.4); bl.translate(0, y, 0); parts.push(bl); }
    const g = mergeGeometries(parts); const p = g.attributes.position, col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const t = Math.max(0, p.getY(i)) / H; col.set([0.28 + t * 0.5, 0.36 + t * 0.4, 0.1 + t * 0.06], i * 3); } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; };
  const kelpM = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8, color: 0x9ab84a, emissive: 0x0c1a04 }); sway(kelpM, 0.0035);
  const forest = (x, z) => fbm(x * 0.012 - 9, z * 0.012 + 4, 3);
  const kelp = pick((x, z, h) => h < 22 && away(x, z) && forest(x, z) > 0.12, 520, 40000);
  mkSet({ hi: kelpGeo(16, 10), lo: kelpGeo(16, 4) }, kelpM, kelp, () => 0.7 + r() * 0.9);
  for (let i = 0; i < kelp.length; i += 9) w.addCollider(kelp[i][0], kelp[i][1], 0.6, 99);

  // ---- coral reefs: branching, brain, fan, tubes and anemone pom-poms (instance colours from a bright palette) ----
  const PAL = [0xff5a7a, 0xffa040, 0xb05aff, 0x40e0d0, 0xffe050, 0xff7ad0, 0xff4030, 0x7aff8a].map(c => new THREE.Color(c));
  const branch = () => { const gs = []; const rec = (x, y, z, dx, dy, dz, len, rad, d) => { const c = new THREE.CylinderGeometry(rad * 0.7, rad, len, 6); c.translate(0, len / 2, 0); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize()); c.applyQuaternion(q); c.translate(x, y, z); gs.push(c);
      const ex = x + dx * len, ey = y + dy * len, ez = z + dz * len; if (d < 3) for (let k = 0; k < 2; k++) { const a = k * Math.PI + d; rec(ex, ey, ez, dx + Math.cos(a) * 0.6, dy + 0.2, dz + Math.sin(a) * 0.6, len * 0.75, rad * 0.7, d + 1); } else gs.push(new THREE.SphereGeometry(rad * 1.4, 6, 4).translate(ex, ey, ez)); };
    rec(0, 0, 0, 0, 1, 0, 1.4, 0.28, 0); return mergeGeometries(gs.map(g => g.index ? g.toNonIndexed() : g)); };
  const brain = () => { const g = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = 1 + 0.06 * Math.sin(x * 14 + Math.sin(z * 9) * 2); p.setXYZ(i, x * f * 1.2, y * f * 0.8, z * f * 1.2); } g.computeVertexNormals(); return g; };
  const fan = () => { const g = new THREE.CircleGeometry(1.6, 18, 0, Math.PI); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.5) * 0.12); g.computeVertexNormals(); const st = new THREE.CylinderGeometry(0.06, 0.09, 0.6, 5).translate(0, -0.1, 0); return mergeGeometries([g.toNonIndexed(), st.toNonIndexed()]); };
  const tubes = () => { const gs = []; for (let k = 0; k < 7; k++) { const a = k * 2.3, rr = k ? 0.35 + (k % 3) * 0.12 : 0, h = 1.2 + (k * 37 % 10) / 10 * 1.4; gs.push(new THREE.CylinderGeometry(0.16, 0.2, h, 8, 1, true).translate(Math.cos(a) * rr, h / 2, Math.sin(a) * rr)); } return mergeGeometries(gs); };
  const pom = () => { const gs = [new THREE.SphereGeometry(0.45, 10, 8).scale(1, 0.6, 1)]; for (let k = 0; k < 22; k++) { const a = k * 2.399, rr = Math.sqrt(k / 22) * 0.45; gs.push(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 4).rotateX(rr * 1.5).rotateY(a).translate(Math.cos(a) * rr, 0.35, Math.sin(a) * rr)); } return mergeGeometries(gs.map(g => g.toNonIndexed())); };
  const coralM = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, side: THREE.DoubleSide, emissive: 0x101010 });
  const reef = (x, z) => fbm(x * 0.016 + 13, z * 0.016 - 2, 3);
  for (const [geo, n, sc] of [[branch(), 240, () => 0.9 + r() * 1.6], [brain(), 180, () => 0.6 + r() * 1.2], [fan(), 160, () => 0.8 + r() * 1.0], [tubes(), 150, () => 0.8 + r() * 1.0], [pom(), 200, () => 0.8 + r() * 1.2]]) {
    const items = pick((x, z, h) => away(x, z, -8) && (reef(x, z) > 0.05 || h > 14) && r() < 0.8, n, 30000);
    mkSet({ hi: geo }, coralM, items, sc, items.map(() => PAL[(r() * PAL.length) | 0]));
  }
  // ---- rocks ----
  const rockGeo = new THREE.IcosahedronGeometry(1, 2); { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + noise2(x * 1.7 + 3, y * 1.7 + z * 1.3) * 0.35 + noise2(z * 4, x * 4) * 0.08; p.setXYZ(i, x * k, y * k * 0.75, z * k); } rockGeo.computeVertexNormals(); }
  const rockMat = triplanar(new THREE.MeshStandardMaterial({ map: A.rock, normalMap: A.rockNor, roughness: 0.9, color: 0x7a8a92 }), 0.35);
  const rocks = pick((x, z, h) => away(x, z) && r() < 0.6, 150, 8000);
  const rm = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length); rm.castShadow = rm.receiveShadow = true;
  rocks.forEach(([x, z, h], i) => { const s = 0.8 + Math.pow(r(), 2.5) * 6; rm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, h + s * 0.15, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r() * 0.4)), new THREE.Vector3(s * (1 + r() * 0.6), s, s))); if (s > 1.6) w.addCollider(x, z, s, h + s); if (s > 2.5 && w.vents.length < 10) w.vents.push(new THREE.Vector3(x, h + s * 0.9, z)); });
  root.add(rm); w.rockMat = rockMat;
  w.vents.push(new THREE.Vector3(VOLC.x, w.craterY - 2, VOLC.z));

  buildShip(w, r);

  // ---- the surface overhead (seen from below) ----
  const rt = rippleTex(); rt.repeat.set(30, 30); w.surfTex = rt;
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ map: rt, color: 0xc8f6ff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  surf.position.y = SURF; surf.renderOrder = -1; root.add(surf); w.surface = surf;
  // ---- god rays: tall soft light shafts that always hang around the camera ----
  const rm2 = new THREE.MeshBasicMaterial({ map: rayTex(), color: 0xbff6ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
  w.rays = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), rm2.clone()); m.userData = { ox: (r() - 0.5) * 170, oz: (r() - 0.5) * 170, w: 4 + r() * 9, ph: r() * 6.28, sp: 0.2 + r() * 0.4 }; m.renderOrder = 3; root.add(m); w.rays.push(m); }
  // ---- marine snow: tiny drifting specks around the camera ----
  const NS = 700, sp = new Float32Array(NS * 3); w.snowBase = new Float32Array(NS * 3); for (let i = 0; i < NS * 3; i++) w.snowBase[i] = r() * 70;
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  w.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xe0f8ff, size: 0.22, transparent: true, opacity: 0.55, depthWrite: false })); w.snow.frustumCulled = false; root.add(w.snow);
  // ---- fish schools ----
  const fishG = mergeGeometries([new THREE.SphereGeometry(0.35, 8, 6).scale(0.45, 0.8, 1.4).toNonIndexed(), new THREE.ConeGeometry(0.3, 0.45, 4).rotateX(Math.PI / 2).scale(0.2, 1, 1).translate(0, 0, -0.62).toNonIndexed()]);
  const NF = 40, NSch = 5; w.fish = new THREE.InstancedMesh(fishG, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.6 }), NF * NSch); w.fish.frustumCulled = false; root.add(w.fish);
  const FC = [0xd0e0f0, 0xffd040, 0x40a0ff, 0xff7040, 0xc0f0ff].map(c => new THREE.Color(c)); for (let i = 0; i < NF * NSch; i++) w.fish.setColorAt(i, FC[Math.floor(i / NF)].clone().offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.1));
  w.schools = []; for (let s = 0; s < NSch; s++) { const a = s / NSch * 6.28, d = 60 + r() * 150; w.schools.push({ cx: Math.cos(a) * d, cz: Math.sin(a) * d, R: 18 + r() * 20, y: 8 + r() * 18, sp: (0.15 + r() * 0.12) * (r() < 0.5 ? 1 : -1), off: Array.from({ length: NF }, () => [(r() - 0.5) * 9, (r() - 0.5) * 4, (r() - 0.5) * 9, r() * 6]) }); }
  w.fishM = new THREE.Matrix4(); w.fishQ = new THREE.Quaternion(); w.fishE = new THREE.Euler();
  // v5.5 friendly sea turtles gliding around (scenery, not enemies)
  const TC = [[0x5a8a3a, 0x3a2a12, 0xd8b060], [0x7a6a3a, 0x2a1a0a, 0xe0c080], [0x4a7a6a, 0x1a2a22, 0xb8d0a0], [0x8a7a4a, 0x3a2410, 0xf0d090]];
  w.turtles = []; for (let i = 0; i < 4; i++) { const c = TC[i], m = new SeaBeast({ id: 'turtle-amb' + i, kind: 'turtle', scale: 0.7 + r() * 0.35, back: c[0], shell: c[1], rim: c[2], belly: 0xf0e2b0, accent: 0x6aff9a, skin: 0x7a9a5a });
    root.add(m.obj); const a = i / 4 * 6.28 + r(); w.turtles.push({ m, cx: BASE.x + Math.cos(a) * (40 + r() * 70), cz: BASE.z + Math.sin(a) * (40 + r() * 70), R: 14 + r() * 16, y: 6 + r() * 10, sp: (0.08 + r() * 0.06) * (r() < 0.5 ? -1 : 1), a: r() * 6.28 }); }
}

// a sunken pirate ship lying on its side in the sand, mast snapped, with a torn sail, cannons and a glowing treasure chest
function buildShip(w, r) {
  const S0 = SHIP(), g = new THREE.Group(), h = w.height(S0.x, S0.z); g.position.set(S0.x, h - 1.4, S0.z); g.rotation.set(0.04, 0.7, 0.32); w.root.add(g); w.ship = g;
  const pt = plankTex(), wood = new THREE.MeshStandardMaterial({ map: pt, roughness: 0.92, color: 0xb8a088 }), dark = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 }), iron = new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.7, roughness: 0.5 });
  const hull = new THREE.BoxGeometry(7, 5, 26, 8, 6, 26); { const p = hull.attributes.position, uv = hull.attributes.uv; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const u = z / 13, bot = Math.max(0, -y / 2.5);
      x *= (1 - Math.pow(Math.max(0, u), 2.2) * 0.92) * (1 - bot * 0.55) * (1 - Math.max(0, -u - 0.85) * 1.2); y += Math.pow(Math.max(0, u), 3) * 2.2 + (y > 0 ? Math.max(0, -u - 0.7) * 3 : 0); p.setXYZ(i, x, y, z); }
    hull.computeVertexNormals(); for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getZ(i) + p.getX(i)) * 0.12, p.getY(i) * 0.25); }
  const hm = new THREE.Mesh(hull, wood); hm.position.y = 2.5; g.add(hm);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.6, 9), new THREE.MeshBasicMaterial({ color: 0x050505 })); hole.position.set(3.05, 2.2, 3); hole.rotation.y = Math.PI / 2 + 0.08; g.add(hole);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.3, 22), wood); deck.position.set(0, 4.7, -1); g.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 6), wood); cabin.position.set(0, 6.4, -9); g.add(cabin);
  for (let k = 0; k < 3; k++) { const wdw = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0x0a1418 })); wdw.position.set(-1.8 + k * 1.8, 6.6, -12.02); wdw.rotation.y = Math.PI; g.add(wdw); }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 16, 8), wood); mast.position.set(0, 12, 2); g.add(mast);
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 10, 6), wood); yard.rotation.z = Math.PI / 2; yard.position.set(0, 17, 2); g.add(yard);
  const sailG = new THREE.PlaneGeometry(9, 7, 10, 8); { const p = sailG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 0.6) * 0.5 + Math.cos(y * 0.8) * 0.3); if (y < -2 && Math.sin(x * 3.1) > 0.2) p.setY(i, y + 1.5 * (Math.sin(x * 5) + 1)); } sailG.computeVertexNormals(); }
  const sail = new THREE.Mesh(sailG, new THREE.MeshStandardMaterial({ color: 0xd8ccb0, side: THREE.DoubleSide, roughness: 1, transparent: true, opacity: 0.88 })); sail.position.set(0, 13.4, 2.4); g.add(sail); w.sail = sail;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4, 4, 2), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, side: THREE.DoubleSide })); flag.position.set(1.1, 19.4, 2); g.add(flag);
  const skull = new THREE.Mesh(new THREE.CircleGeometry(0.35, 10), new THREE.MeshBasicMaterial({ color: 0xf0f0e0, side: THREE.DoubleSide })); skull.position.set(1.1, 19.5, 2.02); g.add(skull);
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 5, 8), wood); stump.position.set(0, 7.2, -4.5); stump.rotation.z = 0.2; g.add(stump);
  const broken = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 11, 8), wood); broken.position.set(-6, 1, -6); broken.rotation.set(0.2, 0, 1.45); g.add(broken);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 2.2, 8), iron); c.rotation.z = Math.PI / 2; c.position.set(s * 3.4, 3.4, 6 - k * 4); g.add(c); }
  const anchor = new THREE.Group(); anchor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4, 6), iron)); const ar = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.18, 6, 14, Math.PI), iron); ar.rotation.z = Math.PI; ar.position.y = -1.6; anchor.add(ar); anchor.position.set(4.5, 2, 12); anchor.rotation.z = 0.5; g.add(anchor);
  // treasure: a chest spilling glowing gold
  const tc = new THREE.Group(); const tx = S0.x + 14, tz = S0.z - 10, th = w.height(tx, tz); tc.position.set(tx, th + 0.6, tz); tc.rotation.y = -0.6; w.root.add(tc);
  tc.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 1.5), dark)); const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 2.4, 10, 1, false, 0, Math.PI), dark); lid.rotation.set(-1.0, 0, Math.PI / 2); lid.position.set(0, 0.9, -0.5); tc.add(lid);
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 1, roughness: 0.25, emissive: 0x6a4000 });
  const coins = []; for (let k = 0; k < 40; k++) coins.push(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 8).rotateX(r() * 2).translate((r() - 0.5) * 2.2, 0.55 + r() * 0.3, (r() - 0.5) * 1.2)); for (let k = 0; k < 30; k++) coins.push(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 8).translate((r() - 0.3) * 4, -0.55, 1 + r() * 2));
  tc.add(new THREE.Mesh(mergeGeometries(coins), gold)); w.treasure = new THREE.Vector3(tx, th + 1.6, tz);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: w.assets.glow, color: 0xffc040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 })); gl.scale.set(9, 6, 1); gl.position.set(tx, th + 1.6, tz); w.root.add(gl); w.goldGlow = gl;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const f = new THREE.Vector3(Math.sin(0.7), 0, Math.cos(0.7)); for (const k of [-9, -3, 3, 9]) w.addCollider(S0.x + f.x * k, S0.z + f.z * k, 4.2, h + 9);
  w.vents.push(new THREE.Vector3(S0.x, h + 4, S0.z));
}

const _cam = new THREE.Vector3();
export function updateOcean(w, dt, cam) {
  const t = w.time; _cam.copy(cam);
  if (w.surfTex) { w.surfTex.offset.set(t * 0.004, t * 0.003); }
  if (w.sail) w.sail.rotation.y = Math.sin(t * 0.6) * 0.06;
  if (w.goldGlow) w.goldGlow.material.opacity = 0.55 + 0.2 * Math.sin(t * 2.2);
  // god rays: wrap on a grid around the camera, billboard on y, slant with the sun, breathe
  for (const m of w.rays || []) { const U = m.userData, G = 170; const x = cam.x + (((U.ox - cam.x) % G + G * 1.5) % G - G / 2), z = cam.z + (((U.oz - cam.z) % G + G * 1.5) % G - G / 2);
    const top = SURF + 2, bottom = Math.max(w.height(x, z), 0); m.position.set(x, top, z); m.scale.set(U.w, top - bottom + 6, 1); m.rotation.set(0, Math.atan2(cam.x - x, cam.z - z), 0.18);
    const d = Math.hypot(cam.x - x, cam.z - z); m.material.opacity = (0.1 + 0.08 * Math.sin(t * U.sp + U.ph)) * smooth(140, 70, d) * smooth(6, 20, d); }
  // marine snow wraps in a 70 m cube around the camera and drifts slowly
  if (w.snow) { const P = w.snow.geometry.attributes.position.array, B = w.snowBase, k = 70; for (let i = 0; i < P.length; i += 3) {
      P[i] = cam.x + ((B[i] + t * 0.3 - cam.x) % k + k * 1.5) % k - k / 2; P[i + 1] = cam.y + ((B[i + 1] - t * 0.25 - cam.y) % k + k * 1.5) % k - k / 2; P[i + 2] = cam.z + ((B[i + 2] + Math.sin(t * 0.2 + i) * 0.5 - cam.z) % k + k * 1.5) % k - k / 2; }
    w.snow.geometry.attributes.position.needsUpdate = true; }
  // v5.5 ambient turtles: slow circles with a gentle bob (only animated near the camera)
  for (const T of w.turtles || []) { T.a += dt * T.sp; const x = T.cx + Math.cos(T.a) * T.R, z = T.cz + Math.sin(T.a) * T.R, y = Math.max(w.height(x, z), 0) + T.y + Math.sin(t * 0.7 + T.R) * 1.2, near = Math.hypot(x - cam.x, z - cam.z) < 160;
    T.m.obj.visible = near; if (!near) continue; T.m.obj.position.set(x, y, z); T.m.obj.rotation.y = Math.atan2(-Math.sin(T.a) * T.sp, Math.cos(T.a) * T.sp); T.m.animate(dt, 5, { turn: T.sp > 0 ? 0.3 : -0.3 }); }
  // fish schools (only the ones near the camera get updated)
  if (w.fish) { let n = 0; const M = w.fishM, Q = w.fishQ, E = w.fishE, p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    for (const S of w.schools) { const a = t * S.sp, cx = S.cx + Math.cos(a) * S.R, cz = S.cz + Math.sin(a) * S.R; if (Math.hypot(cx - cam.x, cz - cam.z) > 170) continue; 
      const fy = Math.max(w.height(cx, cz) + 3, S.y);
      for (const o of S.off) { p.set(cx + o[0] + Math.sin(t * 1.3 + o[3]) * 0.8, fy + o[1] + Math.sin(t * 2 + o[3]) * 0.4, cz + o[2] + Math.cos(t * 1.1 + o[3]) * 0.8); E.set(0, Math.atan2(-Math.sin(a) * S.sp, Math.cos(a) * S.sp) + Math.sin(t * 6 + o[3]) * 0.15, 0); Q.setFromEuler(E); M.compose(p, Q, s); w.fish.setMatrixAt(n++, M); } }
    w.fish.count = n; w.fish.instanceMatrix.needsUpdate = true; }
}
