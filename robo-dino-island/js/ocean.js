// DEEP SEA SHOWDOWN: the fourth level, on the sea floor. Same concept as Jungle Island (roam, wild creatures, arena waves,
// a boss) but underwater: dense blue water fog, animated CAUSTIC light on the sand (terrain shader), swaying kelp forests,
// coral reefs, rocks, a SUNKEN PIRATE SHIP with treasure, sunken Atlantis ruins in the arena, rising bubbles, drifting
// "marine snow", fish schools and slanted GOD RAYS from the shimmering surface overhead. Everything is instanced or a
// single mesh, and the far draw distance is capped by the fog (nothing past ~300 m is drawn), so it stays iPad-friendly.
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { fbm, noise2, rng, smooth, clamp, lerp } from './noise.js';
import { BASE, ARENA, VOLC, TITLE, triplanar } from './world.js';
import { SeaBeast, fin } from './sea.js';
import { fishScaleTextures } from './proctex.js';
import { GOLDFISH } from './data.js';

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
  for (int n = 0; n < 2; n++) { float t = time * (1.0 - (3.5 / float(n + 1)));
    i = pp + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(pp.x / (sin(i.x + t) / inten), pp.y / (cos(i.y + t) / inten))); }
  c /= 2.0; c = 1.17 - pow(c, 1.4); return pow(abs(c), 8.0); }`;

export function oceanSky() { // background + environment: bright water overhead fading to the deep blue below
  const w = 512, h = 256, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d6faff'); gr.addColorStop(0.18, '#74e2f4'); gr.addColorStop(0.38, '#2ab4d4'); gr.addColorStop(0.5, '#1a8db0'); gr.addColorStop(0.7, '#0f6a92'); gr.addColorStop(1, '#0a4a6e');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const sg = g.createRadialGradient(w * 0.3, 0, 0, w * 0.3, 0, h * 0.5); sg.addColorStop(0, 'rgba(255,255,240,.9)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sg; g.fillRect(0, 0, w, h * 0.5);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function rippleTex() { const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); g.fillStyle = '#6ad0ee'; g.fillRect(0, 0, N, N); const r = rng(3);
  for (let i = 0; i < 160; i++) { const x = r() * N, y = r() * N, rr = 8 + r() * 26; for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { const gg = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr); gg.addColorStop(0, 'rgba(235,255,255,.55)'); gg.addColorStop(0.6, 'rgba(160,235,255,.15)'); gg.addColorStop(1, 'rgba(160,235,255,0)'); g.fillStyle = gg; g.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
function rayTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 512; const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 512);
  for (const x of [28, 64, 100]) {
    const v = g.createLinearGradient(0, 0, 0, 512); v.addColorStop(0, 'rgba(255,255,255,.95)'); v.addColorStop(0.5, 'rgba(255,255,255,.4)'); v.addColorStop(1, 'rgba(255,255,255,0)');
    const h = g.createLinearGradient(x - 16, 0, x + 16, 0); h.addColorStop(0, 'rgba(255,255,255,0)'); h.addColorStop(0.5, 'rgba(255,255,255,1)'); h.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = v; g.fillRect(x - 16, 0, 32, 512); g.globalCompositeOperation = 'destination-in'; g.fillStyle = h; g.fillRect(x - 16, 0, 32, 512); g.globalCompositeOperation = 'source-over';
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function causticTex() {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  const img = g.createImageData(N, N), d = img.data;
  const hash = (ix, iy) => { const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453; return n - Math.floor(n); };
  const edge = (x, y, cell) => {
    const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy); let best = 9, second = 9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cx = ix + ox, cy = iy + oy, px = cx + hash(cx, cy) - fx, py = cy + hash(cy + 5, cx) - fy, dd = px * px + py * py;
      if (dd < best) { second = best; best = dd; } else if (dd < second) second = dd;
    }
    const e = Math.sqrt(second) - Math.sqrt(best); return e < 0.07 ? 1 - e / 0.07 : 0;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = Math.min(1, edge(x, y, 86) * 0.7 + edge(x + 20, y + 11, 46) * 0.45 + edge(x * 2, y * 2, 28) * 0.3);
    const i = (y * N + x) * 4; d[i] = d[i + 1] = d[i + 2] = (v * 255) | 0; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(2, 2); return t;
}
function plankTex() { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d'); const r = rng(8);
  for (let y = 0; y < 128; y += 16) { const v = 70 + r() * 40 | 0; g.fillStyle = `rgb(${v + 20},${v},${v - 25})`; g.fillRect(0, y, 128, 16); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, y, 128, 2); g.fillRect((r() * 128) | 0, y, 2, 16); }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(40,90,70,${r() * 0.25})`; g.fillRect(r() * 128, r() * 128, 2 + r() * 8, 1 + r() * 3); } // algae
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }

// Reef tang (deep body, 0.9 m) and clownfish (stubby, 0.6 m). One geometry each, instanced.
function latheFish(length, rx, ry, rings, radial, bulge, colorAt) {
  const pos = [], uv = [], col = [], idx = [];
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1), z = length * (0.5 - t), bell = Math.sin(Math.PI * t);
    let rX = 0.02 + bell * rx, rY = 0.02 + bell * ry;
    if (i === bulge) { rX *= 1.06; rY *= 1.06; }
    for (let j = 0; j < radial; j++) {
      const a = j / radial * Math.PI * 2, x = Math.cos(a) * rX, y = Math.sin(a) * rY;
      pos.push(x, y, z); uv.push(j / radial, t);
      const c = colorAt(t, a, y, rY);
      col.push(c[0], c[1], c[2]);
    }
  }
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial, c = a + radial, d = b + radial;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function paintFin(geo, body, edge) {
  const p = geo.attributes.position, uv = geo.attributes.uv, a = new Float32Array(p.count * 3);
  const B = new THREE.Color(body), E = new THREE.Color(edge);
  for (let i = 0; i < p.count; i++) { const c = uv && uv.getY(i) > 0.82 ? E : B; a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(a, 3));
  return geo;
}
function bendTail(geo, sign) {
  const p = geo.attributes.position, out = new Float32Array(p.count * 3);
  let zH = -1e9, zT = 1e9;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (z > zH) zH = z; if (z < zT) zT = z; }
  const len = Math.max(1e-4, zH - zT), z0 = zH - 0.55 * len;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z >= z0) { out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z; continue; }
    const u = (z0 - z) / (z0 - zT), ang = sign * 0.35 * u * u, c = Math.cos(ang), s = Math.sin(ang), zz = z - z0;
    out[i * 3] = x * c + zz * s; out[i * 3 + 1] = y; out[i * 3 + 2] = -x * s + zz * c + z0;
  }
  return new THREE.Float32BufferAttribute(out, 3);
}
function withMorph(geo) {
  geo.morphAttributes.position = [bendTail(geo, 1), bendTail(geo, -1)];
  geo.morphTargetsRelative = false;
  return geo;
}
const _fishCol = new THREE.Color();
function tangColor(t, a, y, rY) {
  let k = y >= 0 ? 1 : 0.75;
  if (t < 0.26 && y > rY * 0.15) k = Math.min(1, k + 0.22);
  return [k, k, k];
}
function clownColor(t, a, y) {
  const bands = [0.3, 0.5, 0.68];
  for (const b of bands) { const d = Math.abs(t - b); if (d < 0.045) return d > 0.03 ? [0.102, 0.102, 0.102] : [0.957, 0.945, 0.91]; }
  return [1, 0.478, 0.094];
}
function schoolFish(kind) {
  const tang = kind === 'tang';
  const body = latheFish(tang ? 0.9 : 0.6, tang ? 0.1 : 0.13, tang ? 0.24 : 0.16, tang ? 8 : 8, tang ? 10 : 9, 2, tang ? tangColor : clownColor);
  const lobe = (ang) => { const g = paintFin(fin(tang ? 0.16 : 0.12, tang ? 0.22 : 0.14, 0.05, 0.015, 3), tang ? 0xffffff : 0xff7a18, tang ? 0xffd23a : 0x1a1a1a); g.translate(0, ang > 0 ? 0.02 : -0.02, tang ? -0.42 : -0.28); g.rotateX(ang); return g.index ? g.toNonIndexed() : g; };
  const dorsal = paintFin(fin(tang ? 0.2 : 0.14, tang ? 0.28 : 0.16, 0.06, 0.015, 3), tang ? 0xffffff : 0xff7a18, tang ? 0xffd23a : 0x1a1a1a); dorsal.translate(0, tang ? 0.16 : 0.1, tang ? 0.05 : 0);
  const anal = paintFin(fin(tang ? 0.12 : 0.1, tang ? 0.16 : 0.1, 0.04, 0.012, 3).scale(1, -1, 1), tang ? 0xffffff : 0xff7a18, tang ? 0xffd23a : 0x1a1a1a); anal.translate(0, tang ? -0.14 : -0.08, 0);
  const pec = (s) => { const g = paintFin(fin(0.1, tang ? 0.16 : 0.1, 0.04, 0.012, 3), tang ? 0xffffff : 0xff7a18, tang ? 0xffd23a : 0x1a1a1a); g.translate(s * (tang ? 0.1 : 0.12), -0.02, tang ? 0.12 : 0.06); g.rotateZ(-s * 1.2); return g.index ? g.toNonIndexed() : g; };
  const parts = [body.toNonIndexed(), lobe(0.35), lobe(-0.35), dorsal.index ? dorsal.toNonIndexed() : dorsal, anal.index ? anal.toNonIndexed() : anal, pec(1), pec(-1)];
  return withMorph(mergeGeometries(parts));
}

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
    const g = mergeGeometries(parts); const p = g.attributes.position, col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const t = Math.max(0, Math.min(1, p.getY(i) / H)); col.set([0.32 + t * 0.40, 0.50 + t * 0.42, 0.14 + t * 0.22], i * 3); } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; };
  const kelpM = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8, color: 0xa8d85a, emissive: 0x103a0c, emissiveIntensity: 1 }); sway(kelpM, 0.0035);
  const forest = (x, z) => fbm(x * 0.012 - 9, z * 0.012 + 4, 3);
  const kelp = pick((x, z, h) => h < 22 && away(x, z) && forest(x, z) > 0.12, 520, 40000);
  mkSet({ hi: kelpGeo(16, 10), lo: kelpGeo(16, 4) }, kelpM, kelp, () => 0.7 + r() * 0.9);
  if (w.lodSets.length) w.lodSets[w.lodSets.length - 1].kelp = true;
  for (let i = 0; i < kelp.length; i += 9) w.addCollider(kelp[i][0], kelp[i][1], 0.6, 99);

  // ---- coral reefs: branching, brain, fan, tubes and anemone pom-poms (instance colours from a bright palette) ----
  const PAL = [0xff6f91, 0xff9a3c, 0xffd23a, 0xff4fd8, 0x5ff2c8, 0xff5a4e, 0xc77dff, 0xffb3c7].map(c => new THREE.Color(c));
  const caus = causticTex(); w.caustic = caus;
  const coralM = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0, side: THREE.DoubleSide, emissive: 0xbff6ff, emissiveIntensity: 0.35, emissiveMap: caus, envMapIntensity: 0.7 });
  const pomM = coralM.clone(); pomM.emissive = new THREE.Color(0xff8ab0); pomM.emissiveIntensity = 0.25; pomM.emissiveMap = caus;
  const branch = () => { const gs = []; const rec = (x, y, z, dx, dy, dz, len, rad, d) => { const c = new THREE.CylinderGeometry(rad * 0.7, rad, len, 6); c.translate(0, len / 2, 0); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize()); c.applyQuaternion(q); c.translate(x, y, z); gs.push(c);
      const ex = x + dx * len, ey = y + dy * len, ez = z + dz * len; if (d < 3) for (let k = 0; k < 2; k++) { const a = k * Math.PI + d; rec(ex, ey, ez, dx + Math.cos(a) * 0.6, dy + 0.2, dz + Math.sin(a) * 0.6, len * 0.75, rad * 0.7, d + 1); } else gs.push(new THREE.SphereGeometry(rad * 1.4, 6, 4).translate(ex, ey, ez)); };
    rec(0, 0, 0, 0, 1, 0, 1.4, 0.28, 0); return mergeGeometries(gs.map(g => g.index ? g.toNonIndexed() : g)); };
  const brain = () => { const g = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = 1 + 0.06 * Math.sin(x * 14 + Math.sin(z * 9) * 2); p.setXYZ(i, x * f * 1.2, y * f * 0.8, z * f * 1.2); } g.computeVertexNormals(); return g; };
  const fan = () => { const g = new THREE.CircleGeometry(1.6, 18, 0, Math.PI); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.5) * 0.12); g.computeVertexNormals(); const st = new THREE.CylinderGeometry(0.06, 0.09, 0.6, 5).translate(0, -0.1, 0); return mergeGeometries([g.toNonIndexed(), st.toNonIndexed()]); };
  const tubes = () => { const gs = []; for (let k = 0; k < 7; k++) { const a = k * 2.3, rr = k ? 0.35 + (k % 3) * 0.12 : 0, h = 1.2 + (k * 37 % 10) / 10 * 1.4; gs.push(new THREE.CylinderGeometry(0.16, 0.2, h, 8, 1, true).translate(Math.cos(a) * rr, h / 2, Math.sin(a) * rr)); } return mergeGeometries(gs); };
  const pom = () => { const gs = [new THREE.SphereGeometry(0.45, 10, 8).scale(1, 0.6, 1)]; for (let k = 0; k < 22; k++) { const a = k * 2.399, rr = Math.sqrt(k / 22) * 0.45; gs.push(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 4).rotateX(rr * 1.5).rotateY(a).translate(Math.cos(a) * rr, 0.35, Math.sin(a) * rr)); } return mergeGeometries(gs.map(g => g.toNonIndexed())); };
  const reef = (x, z) => fbm(x * 0.016 + 13, z * 0.016 - 2, 3);
  const glowAt = [];
  for (const [geo, n, sc, mat, tips] of [[branch(), 240, () => 0.9 + r() * 1.6, coralM, false], [brain(), 180, () => 0.6 + r() * 1.2, coralM, false], [fan(), 160, () => 0.8 + r() * 1.0, coralM, false], [tubes(), 150, () => 0.8 + r() * 1.0, coralM, false], [pom(), 200, () => 0.8 + r() * 1.2, pomM, true]]) {
    const items = pick((x, z, h) => away(x, z, -8) && (reef(x, z) > 0.05 || h > 14) && r() < 0.8, n, 30000);
    mkSet({ hi: geo }, mat, items, sc, items.map(() => PAL[(r() * PAL.length) | 0].clone().multiplyScalar(1.15)));
    if (tips) for (const it of items) if (glowAt.length < 220) glowAt.push(it);
  }
  // ---- rocks ----
  const rockGeo = new THREE.IcosahedronGeometry(1, 2); { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + noise2(x * 1.7 + 3, y * 1.7 + z * 1.3) * 0.35 + noise2(z * 4, x * 4) * 0.08; p.setXYZ(i, x * k, y * k * 0.75, z * k); } rockGeo.computeVertexNormals(); }
  const rockMat = triplanar(new THREE.MeshStandardMaterial({ map: A.rock, normalMap: A.rockNor, roughness: 0.9, color: 0x7a8a92, emissive: 0xbff6ff, emissiveIntensity: 0.35, emissiveMap: caus }), 0.35);
  const rocks = pick((x, z, h) => away(x, z) && r() < 0.6, 150, 8000);
  const rm = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length); rm.castShadow = rm.receiveShadow = true;
  rocks.forEach(([x, z, h], i) => { const s = 0.8 + Math.pow(r(), 2.5) * 6; rm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, h + s * 0.15, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r() * 0.4)), new THREE.Vector3(s * (1 + r() * 0.6), s, s))); if (s > 1.6) w.addCollider(x, z, s, h + s); if (h < 10 && glowAt.length < 400) glowAt.push([x, z, h + s * 0.7]); if (s > 2.5 && w.vents.length < 10) w.vents.push(new THREE.Vector3(x, h + s * 0.9, z)); });
  root.add(rm); w.rockMat = rockMat;
  const bioMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const bio = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), bioMat, Math.max(1, glowAt.length));
  const BIO = [0x3de8ff, 0x5ff2c8, 0xff8a6a].map(c => new THREE.Color(c));
  glowAt.forEach((p, i) => { const s = 0.7 + r() * 1.5; bio.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[2] + 0.35, p[1]), new THREE.Quaternion(), new THREE.Vector3(s, s, s))); bio.setColorAt(i, BIO[i % 3]); });
  bio.count = glowAt.length; bio.frustumCulled = false; root.add(bio); w.bio = bio; w.bioMat = bioMat; w.coralM = coralM; w.pomM = pomM;
  w.vents.push(new THREE.Vector3(VOLC.x, w.craterY - 2, VOLC.z));

  buildShip(w, r);

  // ---- the surface overhead (seen from below) ----
  const rt = rippleTex(); rt.repeat.set(24, 24); w.surfTex = rt;
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ map: rt, color: 0xd6faff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  surf.position.y = SURF; surf.renderOrder = -1; root.add(surf); w.surface = surf;
  // ---- god rays: tall soft light shafts that always hang around the camera ----
  const rm2 = new THREE.MeshBasicMaterial({ map: rayTex(), color: 0xfff4d6, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
  w.rays = []; for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), rm2.clone()); m.userData = { ox: (r() - 0.5) * 170, oz: (r() - 0.5) * 170, w: 4 + r() * 9, ph: r() * 6.28, sp: 0.2 + r() * 0.4 }; m.renderOrder = 3; root.add(m); w.rays.push(m); }
  // ---- marine snow: tiny drifting specks around the camera ----
  const NS = 700, sp = new Float32Array(NS * 3); w.snowBase = new Float32Array(NS * 3); for (let i = 0; i < NS * 3; i++) w.snowBase[i] = r() * 70;
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  w.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xe0f8ff, size: 0.16, transparent: true, opacity: 0.45, depthWrite: false, sizeAttenuation: true })); w.snow.frustumCulled = false; root.add(w.snow);
  // ---- reef tangs + clownfish. Two instanced meshes, 5 schools × 40. School 0 (clownfish) swims with the player.
  const NF = 40;
  const scales = fishScaleTextures();
  const fishMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: scales.map, normalMap: scales.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.32, metalness: 0.15, envMapIntensity: 1.3 });
  const tangG = schoolFish('tang'), clownG = schoolFish('clown');
  w.fishTang = new THREE.InstancedMesh(tangG, fishMat, NF * 4); w.fishClown = new THREE.InstancedMesh(clownG, fishMat, NF);
  for (const m of [w.fishTang, w.fishClown]) { m.frustumCulled = false; root.add(m); }
  const tangTint = [0xffd23a, 0xff5a7a, 0xff4fd8, 0x2ed88a];
  for (let s = 0; s < 4; s++) for (let i = 0; i < NF; i++) {
    const col = new THREE.Color(tangTint[s]);
    if (s === 0) col.lerp(new THREE.Color(0xffa822), i / NF);
    w.fishTang.setColorAt(s * NF + i, col);
  }
  for (let i = 0; i < NF; i++) { const k = 1 + (r() - 0.5) * 0.08; w.fishClown.setColorAt(i, _fishCol.setRGB(k, k, k)); }
  w.fishTang.instanceColor.needsUpdate = w.fishClown.instanceColor.needsUpdate = true;
  const hubs = [null, { x: BASE.x + 5, z: BASE.z - 14 }, TITLE, ARENA, { x: (BASE.x + ARENA.x) * 0.5, z: (BASE.z + ARENA.z) * 0.45 }];
  w.schools = []; for (let s = 0; s < 5; s++) { const h = hubs[s], withPlayer = s === 0; w.schools.push({ withPlayer, clown: withPlayer, cx: h ? h.x + (r() - 0.5) * 24 : BASE.x, cz: h ? h.z + (r() - 0.5) * 24 : BASE.z, R: withPlayer ? 5.5 : 11 + r() * 10, lift: withPlayer ? 2.4 : 3.2 + r() * 4, sp: (0.22 + r() * 0.1) * (r() < 0.5 ? 1 : -1), off: Array.from({ length: NF }, () => [(r() - 0.5) * (withPlayer ? 4.5 : 7), (r() - 0.5) * 1.4, (r() - 0.5) * (withPlayer ? 4.5 : 7), r() * 6, 0.85 + r() * 0.35]) }); }
  w.fishM = new THREE.Matrix4(); w.fishQ = new THREE.Quaternion(); w.fishE = new THREE.Euler(); w.fishDummy = { morphTargetInfluences: [0, 0] }; w.sparkT = 0; w.fishSeen = [];
  const gf = new SeaBeast(GOLDFISH); gf.obj.traverse(o => { if (o.isMesh) o.castShadow = false; }); root.add(gf.obj);
  const g0 = w.height(BASE.x + 4, BASE.z - 16); gf.obj.position.set(BASE.x + 4, g0 + 8, BASE.z - 16);
  w.goldfish = { m: gf, mode: 'orbit', orbitT: 8, loop: 0 };
  // v5.5 friendly sea turtles gliding around (scenery, not enemies)
  const TC = [[0x5a8a3a, 0x3a2a12, 0xd8b060], [0x7a6a3a, 0x2a1a0a, 0xe0c080], [0x4a7a6a, 0x1a2a22, 0xb8d0a0], [0x8a7a4a, 0x3a2410, 0xf0d090]];
  w.turtles = []; for (let i = 0; i < 4; i++) { const c = TC[i], m = new SeaBeast({ id: 'turtle-amb' + i, kind: 'turtle', scale: 0.7 + r() * 0.35, back: c[0], shell: c[1], rim: c[2], belly: 0xf0e2b0, accent: 0x6aff9a, skin: 0x7a9a5a });
    m.obj.traverse(o => { if (o.isMesh) o.castShadow = false; }); root.add(m.obj); const a = i / 4 * 6.28 + r(); w.turtles.push({ m, cx: BASE.x + Math.cos(a) * (40 + r() * 70), cz: BASE.z + Math.sin(a) * (40 + r() * 70), R: 14 + r() * 16, y: 6 + r() * 10, sp: (0.08 + r() * 0.06) * (r() < 0.5 ? -1 : 1), a: r() * 6.28 }); }
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
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  const f = new THREE.Vector3(Math.sin(0.7), 0, Math.cos(0.7)); for (const k of [-9, -3, 3, 9]) w.addCollider(S0.x + f.x * k, S0.z + f.z * k, 4.2, h + 9);
  w.vents.push(new THREE.Vector3(S0.x, h + 4, S0.z));
}

const _cam = new THREE.Vector3(), _fishP = new THREE.Vector3(), _fishS = new THREE.Vector3(1, 1, 1);
export function updateOcean(w, dt, cam) {
  const t = w.time; _cam.copy(cam);
  if (w.surfTex) { w.surfTex.offset.set(t * 0.004, t * 0.003); }
  if (w.caustic) { w.caustic.offset.set(t * 0.02, t * 0.013); const pulse = 0.3 + 0.08 * Math.sin(t * 1.7); if (w.rockMat) w.rockMat.emissiveIntensity = pulse; if (w.coralM) w.coralM.emissiveIntensity = pulse; if (w.pomM) w.pomM.emissiveIntensity = 0.22 + 0.06 * Math.sin(t * 1.7); }
  if (w.bioMat) w.bioMat.color.setScalar(1.6 + 0.4 * Math.sin(t * 1.3));
  if (w.sail) w.sail.rotation.y = Math.sin(t * 0.6) * 0.06;
  if (w.goldGlow) w.goldGlow.material.opacity = 0.55 + 0.2 * Math.sin(t * 2.2);
  // god rays: wrap on a grid around the camera, billboard on y, slant with the sun, breathe
  for (const m of w.rays || []) { const U = m.userData, G = 170; U.ox += dt * 0.25; const x = cam.x + (((U.ox - cam.x) % G + G * 1.5) % G - G / 2), z = cam.z + (((U.oz - cam.z) % G + G * 1.5) % G - G / 2);
    const top = SURF + 2, bottom = Math.max(w.height(x, z), 0); m.position.set(x, top, z); m.scale.set(U.w, top - bottom + 6, 1); m.rotation.set(0, Math.atan2(cam.x - x, cam.z - z), 0.18);
    const d = Math.hypot(cam.x - x, cam.z - z); m.material.opacity = (0.12 + 0.08 * Math.sin(t * U.sp + U.ph)) * smooth(150, 25, d) * smooth(6, 20, d); }
  // marine snow wraps in a 70 m cube around the camera and drifts slowly
  if (w.snow) { const P = w.snow.geometry.attributes.position.array, B = w.snowBase, k = 70; for (let i = 0; i < P.length; i += 3) {
      P[i] = cam.x + ((B[i] + t * 0.3 - cam.x) % k + k * 1.5) % k - k / 2; P[i + 1] = cam.y + ((B[i + 1] - t * 0.25 - cam.y) % k + k * 1.5) % k - k / 2; P[i + 2] = cam.z + ((B[i + 2] + Math.sin(t * 0.2 + i) * 0.5 - cam.z) % k + k * 1.5) % k - k / 2; }
    w.snow.geometry.attributes.position.needsUpdate = true; }
  // v5.5 ambient turtles: slow circles with a gentle bob (only animated near the camera)
  for (const T of w.turtles || []) { T.a += dt * T.sp; const x = T.cx + Math.cos(T.a) * T.R, z = T.cz + Math.sin(T.a) * T.R, y = Math.max(w.height(x, z), 0) + T.y + Math.sin(t * 0.7 + T.R) * 1.2, near = Math.hypot(x - cam.x, z - cam.z) < 160;
    T.m.obj.visible = near; if (!near) continue; T.m.obj.position.set(x, y, z); T.m.obj.rotation.y = Math.atan2(-Math.sin(T.a) * T.sp, Math.cos(T.a) * T.sp); T.m.animate(dt, 5, { turn: T.sp > 0 ? 0.3 : -0.3 }); }
  // reef tangs (schools 1–4) and the clownfish school that stays with the swimmer
  if (w.fishTang) {
    let nt = 0, nc = 0; const M = w.fishM, Q = w.fishQ, E = w.fishE, p = _fishP, s = _fishS, dummy = w.fishDummy;
    w.fishSeen.length = 0;
    for (const S of w.schools) { const a = t * S.sp; let ox = S.cx, oz = S.cz;
      if (S.withPlayer && w.swimX != null) { const dx = cam.x - w.swimX, dz = cam.z - w.swimZ, len = Math.hypot(dx, dz) || 1; ox = w.swimX + dx / len * 5; oz = w.swimZ + dz / len * 5; }
      const cx = ox + Math.cos(a) * S.R, cz = oz + Math.sin(a) * S.R;
      const sand = w.height(cx, cz), fy = sand + (S.lift || 5);
      const head = Math.atan2(-Math.sin(a) * S.sp, Math.cos(a) * S.sp);
      const mesh = S.clown ? w.fishClown : w.fishTang;
      for (const o of S.off) { const sc = (o[4] || 1) * 1.3; p.set(cx + o[0] + Math.sin(t * 1.3 + o[3]) * 0.6, Math.min(SURF - 6, Math.max(sand + 1.4, fy + o[1] + Math.sin(t * 2 + o[3]) * 0.25)), cz + o[2] + Math.cos(t * 1.1 + o[3]) * 0.6);
        const sway = Math.sin(t * 9 + o[3]), wob = Math.sin(t * 6 + o[3]) * 0.09, wobRate = Math.cos(t * 6 + o[3]) * 0.54;
        const roll = -(S.sp + wobRate) * 0.6;
        s.set(sc, sc, sc); E.set(Math.sin(t * 2.2 + o[3]) * 0.08, head + wob, roll); Q.setFromEuler(E); M.compose(p, Q, s);
        const n = S.clown ? nc++ : nt++; mesh.setMatrixAt(n, M);
        dummy.morphTargetInfluences[0] = Math.max(0, sway); dummy.morphTargetInfluences[1] = Math.max(0, -sway); mesh.setMorphAt(n, dummy);
        if (w.fishSeen.length < 24) w.fishSeen.push(p.x, p.y, p.z); }
    }
    w.fishTang.instanceMatrix.needsUpdate = w.fishClown.instanceMatrix.needsUpdate = true;
    if (w.fishTang.morphTexture) w.fishTang.morphTexture.needsUpdate = true;
    if (w.fishClown.morphTexture) w.fishClown.morphTexture.needsUpdate = true;
    w.sparkT = (w.sparkT || 0) + dt;
    const fx = w.game && w.game.fx;
    if (fx && w.sparkT > 0.34 && w.fishSeen.length) { w.sparkT = 0; const i = ((Math.random() * (w.fishSeen.length / 3)) | 0) * 3;
      fx.glow.spawn({ pos: { x: w.fishSeen[i], y: w.fishSeen[i + 1], z: w.fishSeen[i + 2] }, vel: { x: 0, y: 0.3, z: 0 }, size: 0.6, size1: 0, life: 0.25, r: 1.6, g: 1.5, b: 1.2, alpha: 1 }); }
  }
  updateGoldfish(w, dt, cam);
}

function updateGoldfish(w, dt, cam) {
  const G = w.goldfish; if (!G) return;
  const m = G.m, t = w.time, px = w.swimX != null ? w.swimX : BASE.x, pz = w.swimZ != null ? w.swimZ : BASE.z;
  const here = m.obj.position, dist = Math.hypot(here.x - px, here.z - pz);
  if (G.mode !== 'orbit' && dist < 30) { G.mode = 'orbit'; G.orbitT = 8; }
  let x, z, yaw;
  if (G.mode === 'orbit') {
    G.orbitT -= dt; const ang = t * 0.7;
    x = px + Math.cos(ang) * 14; z = pz + Math.sin(ang) * 14; yaw = ang + Math.PI / 2;
    if (G.orbitT <= 0) G.mode = 'patrol';
  } else {
    const mx = (BASE.x + ARENA.x) * 0.5, mz = (BASE.z + ARENA.z) * 0.5, dx = ARENA.x - BASE.x, dz = ARENA.z - BASE.z, len = Math.hypot(dx, dz) || 1;
    const fx = dx / len, fz = dz / len, sx = -fz, sz = fx, u = t * 0.18, along = Math.sin(u) * 26, across = Math.sin(u) * Math.cos(u) * 26;
    x = mx + fx * along + sx * across; z = mz + fz * along + sz * across;
    yaw = Math.atan2(fx * Math.cos(u) * 26 + sx * Math.cos(2 * u) * 13, fz * Math.cos(u) * 26 + sz * Math.cos(2 * u) * 13);
  }
  const sand = w.height(x, z), y = Math.min(SURF - 8, sand + 8 + Math.sin(t * 0.6) * 1.5);
  m.obj.position.set(x, y, z); m.obj.rotation.y = yaw; m.animate(dt, 6, {});
  if (m.bubblesDue > 0 && w.game && w.game.bubbles) {
    const mouth = m.socketPos('mouth', _fishP);
    w.game.bubbles(mouth, m.bubblesDue, 1.4, 4); m.bubblesDue = 0;
  }
  if (w.game && w.game.fx && Math.random() < dt * 2 && m.veil) {
    m.veil.getWorldPosition(_fishP);
    w.game.fx.glow.spawn({ pos: { x: _fishP.x, y: _fishP.y, z: _fishP.z }, vel: { x: 0, y: 0.4, z: 0 }, size: 0.45, size1: 0, life: 0.35, r: 1.8, g: 1.35, b: 0.4, alpha: 1 });
  }
  if (Math.hypot(x - cam.x, z - cam.z) > 220) m.obj.visible = false; else m.obj.visible = true;
}
