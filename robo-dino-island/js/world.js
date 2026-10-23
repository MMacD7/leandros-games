// The island: terrain (texture-splatted PBR), sea, volcano, palms/jungle (instanced + LOD), grass & flowers (GPU instanced), ruins, home base.
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { fbm, noise2, rng, smooth, clamp, lerp } from './noise.js';
import { leafTexture, broadLeafTexture, barkTexture, waterNormal } from './proctex.js';

export const S = 820, N = 256, R_ISLAND = 300;
export const BASE = new THREE.Vector3(15, 0, 212);
export const ARENA = new THREE.Vector3(105, 0, 40);
export const VOLC = new THREE.Vector3(-40, 0, -110);

function rawHeight(x, z) {
  const d0 = Math.hypot(x, z);
  const r = d0 / R_ISLAND + fbm(x * 0.0055 + 3.1, z * 0.0055 - 1.7, 4) * 0.2;
  const land = 1 - smooth(0.72, 1.0, r);
  const db = Math.hypot(x - BASE.x, z - BASE.z), da = Math.hypot(x - ARENA.x, z - ARENA.z), dv = Math.hypot(x - VOLC.x, z - VOLC.z);
  let h = -9 + land * 11.8 + fbm(x * 0.02, z * 0.02, 3) * 1.6 * land;
  // inland hills (kept away from the home base so it has a sea view)
  const mask = smooth(0.86, 0.5, r) * smooth(55, 120, db);
  const ridge = 1 - Math.abs(fbm(x * 0.007 + 9, z * 0.007 + 2, 4));
  h += mask * (Math.max(0, fbm(x * 0.011, z * 0.011, 4) + 0.15) * 22 + ridge * ridge * ridge * 14);
  // gentle beach shelf
  if (h > -1.5 && h < 3) h = lerp(h, 1.0 + (h - 1.0) * 0.5, 0.7);
  // volcano cone with crater
  const cone = 118 * Math.pow(Math.max(0, 1 - dv / 150), 1.55) * (1 + fbm(x * 0.05, z * 0.05, 3) * 0.12);
  h = Math.max(h, h * 0.3 + cone);
  if (dv < 20) h -= (1 - dv / 20) * (1 - dv / 20) * 30;
  // flatten home base and ruins arena
  h = lerp(h, 3.0, 1 - smooth(18, 34, db));
  h = lerp(h, 5.0, 1 - smooth(34, 52, da));
  return h;
}

export class World {
  constructor(scene, assets, quality) {
    this.scene = scene; this.assets = assets; this.q = quality; this.time = 0;
    this.colliders = []; this.grid = new Map();
    this.buildHeight();
    this.buildTerrain();
    this.buildWater();
    this.buildVolcano();
    this.buildVegetation();
    this.buildRuins();
    this.buildBase();
    this.buildGrass();
  }

  // ---------- height field ----------
  buildHeight() {
    const n = N + 1; this.H = new Float32Array(n * n); this.splat = new Float32Array(n * n * 4); this.dens = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) this.H[j * n + i] = rawHeight(-S / 2 + i * S / N, -S / 2 + j * S / N);
    const hm = new Uint16Array(n * n * 4); const toH = THREE.DataUtils.toHalfFloat;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i, x = -S / 2 + i * S / N, z = -S / 2 + j * S / N, h = this.H[k];
      const hx = this.H[j * n + Math.min(n - 1, i + 1)] - this.H[j * n + Math.max(0, i - 1)], hz = this.H[Math.min(n - 1, j + 1) * n + i] - this.H[Math.max(0, j - 1) * n + i];
      const ny = 1 / Math.sqrt(1 + (hx * hx + hz * hz) / (4 * (S / N) ** 2));
      const dv = Math.hypot(x - VOLC.x, z - VOLC.z), da = Math.hypot(x - ARENA.x, z - ARENA.z), db = Math.hypot(x - BASE.x, z - BASE.z);
      let sand = 1 - smooth(1.6, 3.4 + noise2(x * 0.05, z * 0.05) * 0.8, h);
      let rock = Math.max(smooth(0.86, 0.7, ny), smooth(6, 30, h) * smooth(150, 70, dv), smooth(80, 40, dv) * 0.95, smooth(30, 48, h) * 0.8);
      let dirt = clamp(smooth(0.3, 0.65, fbm(x * 0.018 + 7, z * 0.018 - 3, 3)) * 0.7 + (1 - smooth(22, 36, da)) * 0.9 + smooth(170, 120, dv) * 0.5, 0, 1);
      rock = clamp(rock, 0, 1); sand = clamp(sand, 0, 1) * (1 - rock);
      dirt *= (1 - sand) * (1 - rock);
      const grass = Math.max(0, 1 - sand - rock - dirt);
      this.splat.set([grass, sand, rock, dirt], k * 4);
      let g = grass * smooth(1.8, 3.4, h) * (0.75 + 0.25 * smooth(-0.3, 0.3, fbm(x * 0.03, z * 0.03, 3))) * smooth(13, 20, db);
      g = clamp(g * 1.5, 0, 1);
      const fl = g * smooth(-0.02, 0.28, fbm(x * 0.022 + 11, z * 0.022 + 5, 3));
      this.dens[k * 2] = g; this.dens[k * 2 + 1] = fl;
      hm[k * 4] = toH(h); hm[k * 4 + 1] = toH(g); hm[k * 4 + 2] = toH(fl); hm[k * 4 + 3] = toH(rock);
    }
    this.hmTex = new THREE.DataTexture(hm, n, n, THREE.RGBAFormat, THREE.HalfFloatType);
    this.hmTex.magFilter = this.hmTex.minFilter = THREE.LinearFilter; this.hmTex.needsUpdate = true;
  }
  height(x, z) {
    const n = N + 1, fx = clamp((x + S / 2) / S * N, 0, N - 1.001), fz = clamp((z + S / 2) / S * N, 0, N - 1.001);
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, H = this.H;
    const h00 = H[j * n + i], h10 = H[j * n + i + 1], h01 = H[(j + 1) * n + i], h11 = H[(j + 1) * n + i + 1];
    return (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v;
  }
  grassAt(x, z) { const n = N + 1, i = clamp(Math.round((x + S / 2) / S * N), 0, N), j = clamp(Math.round((z + S / 2) / S * N), 0, N); return this.dens[(j * n + i) * 2]; }
  normalAt(x, z, out) { const e = 1.5; out.set(this.height(x - e, z) - this.height(x + e, z), 2 * e, this.height(x, z - e) - this.height(x, z + e)).normalize(); return out; }

  hmUniforms(u) { u.uHM = { value: this.hmTex }; u.uS = { value: S }; u.uN = { value: N }; return u; }

  // ---------- terrain ----------
  buildTerrain() {
    const A = this.assets, geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, n = N + 1, col = new Float32Array(pos.count * 3), uv = geo.attributes.uv;
    for (let k = 0; k < pos.count; k++) {
      // PlaneGeometry rows go from +z.. after rotation: row 0 is z=-S/2
      const x = pos.getX(k), z = pos.getZ(k);
      const i = Math.round((x + S / 2) / S * N), j = Math.round((z + S / 2) / S * N);
      pos.setY(k, this.H[j * n + i]); uv.setXY(k, x, z);
      const t = 0.82 + 0.25 * fbm(x * 0.008 + 1, z * 0.008 + 1, 3), w = fbm(x * 0.02 - 4, z * 0.02, 2);
      const gd = this.dens[(j * n + i) * 2]; const dk = 1 - gd * 0.42;
      col[k * 3] = t * (1 + w * 0.15) * dk; col[k * 3 + 1] = t * (1 - gd * 0.25); col[k * 3 + 2] = t * (1 - w * 0.1) * dk;
    }
    const sp = new Float32Array(pos.count * 4);
    for (let k = 0; k < pos.count; k++) { const x = pos.getX(k), z = pos.getZ(k); const i = Math.round((x + S / 2) / S * N), j = Math.round((z + S / 2) / S * N); sp.set(this.splat.subarray((j * n + i) * 4, (j * n + i) * 4 + 4), k * 4); }
    geo.setAttribute('splat', new THREE.BufferAttribute(sp, 4)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0, normalMap: A.grassNor, normalScale: new THREE.Vector2(1.1, 1.1) });
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { tG: { value: A.grass }, tS: { value: A.sand }, tR: { value: A.rock }, tD: { value: A.dirt }, nS: { value: A.sandNor }, nR: { value: A.rockNor } });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 splat; varying vec4 vSplat; varying vec3 vWP; varying vec3 vWN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSplat = splat; vWP = (modelMatrix * vec4(transformed,1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D tG, tS, tR, tD, nS, nR; varying vec4 vSplat; varying vec3 vWP; varying vec3 vWN;
vec3 triR(float s){ vec3 b = pow(abs(vWN), vec3(4.0)); b /= (b.x+b.y+b.z);
  return texture2D(tR, vWP.zy*s).rgb*b.x + texture2D(tR, vWP.xz*s).rgb*b.y + texture2D(tR, vWP.xy*s).rgb*b.z; }`)
        .replace('#include <map_fragment>', `
vec4 sp = vSplat; sp /= max(1e-3, sp.x+sp.y+sp.z+sp.w);
vec2 wuv = vWP.xz;
vec3 cg = texture2D(tG, wuv*0.09).rgb*0.62 + texture2D(tG, wuv*0.023 + 0.37).rgb*0.38;
float gl = dot(cg, vec3(0.3,0.59,0.11)); cg = mix(cg, gl * vec3(0.55,1.05,0.22) * 1.25, 0.8);
vec3 cs = texture2D(tS, wuv*0.12).rgb * vec3(1.08,1.0,0.86);
vec3 cr = sp.z > 0.02 ? triR(0.045) * vec3(0.78,0.74,0.72) : vec3(0.0);
vec3 cd = texture2D(tD, wuv*0.11).rgb * vec3(1.05,0.95,0.8);
diffuseColor.rgb *= cg*sp.x + cs*sp.y + cr*sp.z + cd*sp.w;`)
        .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
          'vec3 mapN = (texture2D(normalMap, vWP.xz*0.09).xyz*sp.x + texture2D(nS, vWP.xz*0.12).xyz*sp.y + texture2D(nR, vWP.xz*0.045).xyz*(sp.z+sp.w))*2.0-1.0;');
    };
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; this.scene.add(m); this.terrain = m;
  }

  // ---------- sea ----------
  buildWater() {
    const wn = waterNormal();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.06, metalness: 0.1, normalMap: wn, transparent: true, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 1.3 });
    const u = this.hmUniforms({ uTime: { value: 0 } }); this.waterU = u;
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D uHM; uniform float uS, uN, uTime; varying vec3 vWP;`)
        .replace('#include <map_fragment>', `
vec2 huv = ((vWP.xz + uS*0.5)/uS*uN + 0.5)/(uN+1.0);
float th = texture2D(uHM, clamp(huv, 0.0, 1.0)).r; float dep = max(0.0, -th);
float kd = smoothstep(0.0, 8.0, dep);
vec3 wc = mix(vec3(0.16,0.78,0.72), vec3(0.015,0.16,0.30), kd);
float foam = (1.0 - smoothstep(0.0, 1.1, dep)) * (0.55 + 0.45*sin(uTime*1.7 - dep*9.0 + vWP.x*0.05));
foam *= smoothstep(-0.2, 0.2, sin(vWP.x*0.9 + uTime) * sin(vWP.z*0.8 - uTime*0.7) + 0.4);
diffuseColor.rgb = mix(wc, vec3(0.95), clamp(foam,0.0,1.0)*0.85);
diffuseColor.a = mix(0.45, 0.94, smoothstep(0.0, 3.5, dep)) + foam*0.4;`)
        .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
          'vec3 mapN = (texture2D(normalMap, vWP.xz*0.035 + vec2(uTime*0.012, uTime*0.006)).xyz + texture2D(normalMap, vWP.zx*0.021 - vec2(uTime*0.009, -uTime*0.011)).xyz)-1.0;');
    };
    const g = new THREE.PlaneGeometry(5000, 5000, 1, 1); g.rotateX(-Math.PI / 2);
    const w = new THREE.Mesh(g, mat); w.position.y = 0; w.renderOrder = 2; this.scene.add(w); this.water = w;
  }

  // ---------- volcano: lava glow (smoke particles are emitted from main via fx) ----------
  buildVolcano() {
    let lowest = Infinity; for (let a = 0; a < 6.28; a += 0.5) lowest = Math.min(lowest, this.height(VOLC.x + Math.cos(a) * 3, VOLC.z + Math.sin(a) * 3));
    this.craterY = this.height(VOLC.x, VOLC.z) + 1.5;
    const lava = new THREE.Mesh(new THREE.CircleGeometry(16, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5a12, toneMapped: false }));
    lava.position.set(VOLC.x, this.craterY, VOLC.z); this.scene.add(lava);
    this.lavaGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.assets.glow, color: 0xff6a20, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8, fog: false }));
    this.lavaGlow.scale.set(60, 40, 1); this.lavaGlow.position.set(VOLC.x, this.craterY + 8, VOLC.z); this.scene.add(this.lavaGlow);
    this.smokeOrigin = new THREE.Vector3(VOLC.x, this.craterY + 4, VOLC.z);
  }

  // ---------- colliders ----------
  addCollider(x, z, r, h = 99) { const c = { x, z, r, h }; this.colliders.push(c); const k = ((x / 16) | 0) + ',' + ((z / 16) | 0);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const kk = ((Math.floor(x / 16) + a) + ',' + (Math.floor(z / 16) + b)); if (!this.grid.has(kk)) this.grid.set(kk, []); this.grid.get(kk).push(c); } }
  collide(p, r, flying) {
    const list = this.grid.get(Math.floor(p.x / 16) + ',' + Math.floor(p.z / 16)); if (!list) return;
    for (const c of list) { if (flying && p.y > c.h) continue; const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; } }
  }

  // ---------- vegetation ----------
  buildVegetation() {
    const A = this.assets, r = rng(42);
    const leaf = leafTexture(), broad = broadLeafTexture(), bark = barkTexture();
    this.windU = { uTime: { value: 0 } };
    const sway = (mat, amt) => { mat.onBeforeCompile = sh => { sh.uniforms.uTime = this.windU.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      float ph = instanceMatrix[3].x*0.13 + instanceMatrix[3].z*0.11;
      #else
      float ph = 0.0;
      #endif
      float sw = max(0.0, transformed.y - ${amt.toFixed(1)}) ;
      transformed.x += sin(uTime*1.3 + ph) * 0.02 * sw * (1.0 + 0.5*sin(uTime*2.7+ph+transformed.z));
      transformed.z += cos(uTime*1.1 + ph) * 0.015 * sw;`); }; };
    const leafMat = new THREE.MeshStandardMaterial({ map: leaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, metalness: 0, color: 0xc8dca0 });
    sway(leafMat, 6);
    const broadMat = new THREE.MeshStandardMaterial({ map: broad, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7, color: 0xb8d898 });
    sway(broadMat, 0.5);
    const barkMat = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95, color: 0xd0c0a8 });
    const fernMat = new THREE.MeshStandardMaterial({ map: leaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: 0x9fc070 });
    sway(fernMat, 0.2);

    // palm variants (hi + lo detail)
    const variants = [];
    for (let v = 0; v < 3; v++) {
      const H = 9 + v * 3.2, lean = 1.5 + v * 1.2;
      variants.push({ hi: [trunkGeo(H, lean, 0.42, 9, 14), palmCrown(H, lean, 11, 8)], lo: [trunkGeo(H, lean, 0.42, 5, 5), palmCrown(H, lean, 7, 3)], H });
    }
    // jungle broadleaf tree + bushes + ferns
    const treeHi = [trunkGeo(15, 0.8, 0.7, 8, 10), crownGeo(15, 5.5, 26)], treeLo = [trunkGeo(15, 0.8, 0.7, 5, 4), crownGeo(15, 5.5, 10)];
    const bushGeo = crownGeo(0.9, 1.8, 9), fernGeo = fernCluster(9);

    const pick = (test, count, tries) => { const out = []; for (let t = 0; t < tries && out.length < count; t++) {
      const x = (r() - 0.5) * S * 0.8, z = (r() - 0.5) * S * 0.8; const h = this.height(x, z); const res = test(x, z, h); if (res) out.push([x, z, h]); } return out; };
    const away = (x, z) => Math.hypot(x - BASE.x, z - BASE.z) > 30 && Math.hypot(x - ARENA.x, z - ARENA.z) > 46 && Math.hypot(x - VOLC.x, z - VOLC.z) > 60;
    const cluster = (x, z) => fbm(x * 0.012 + 20, z * 0.012 - 8, 3);
    const palms = pick((x, z, h) => h > 1.6 && h < 22 && away(x, z) && (cluster(x, z) > 0.08 || (h < 3.0 && r() < 0.5)) && this.normalAtY(x, z) > 0.85, 200, 30000);
    const trees = pick((x, z, h) => h > 6 && h < 30 && away(x, z) && cluster(x, z) > 0.05 && this.normalAtY(x, z) > 0.8, 110, 20000);
    const bushes = pick((x, z, h) => h > 2.5 && h < 40 && away(x, z) && cluster(x, z) > -0.1, 700, 30000);

    this.lodSets = [];
    const mkSet = (geos, mats, items, scaleFn, colR, castHi) => {
      const hi = geos.hi.map((g, i) => new THREE.InstancedMesh(g, mats[i], items.length));
      const lo = geos.lo.map((g, i) => new THREE.InstancedMesh(g, mats[i], items.length));
      [...hi, ...lo].forEach(m => { m.castShadow = castHi; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; this.scene.add(m); });
      lo.forEach(m => m.castShadow = false);
      const mats4 = items.map(([x, z, h]) => { const s = scaleFn(); const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.283);
        if (colR) this.addCollider(x, z, colR * s, geos.H ? geos.H * s : 12);
        return { x, z, m: new THREE.Matrix4().compose(new THREE.Vector3(x, h - 0.3, z), q, new THREE.Vector3(s, s, s)) }; });
      this.lodSets.push({ hi, lo, items: mats4 });
    };
    const perVar = [[], [], []]; palms.forEach((p, i) => perVar[i % 3].push(p));
    variants.forEach((v, i) => mkSet(v, [barkMat, leafMat], perVar[i], () => 0.8 + r() * 0.45, 0.55, true));
    mkSet({ hi: treeHi, lo: treeLo, H: 15 }, [barkMat, broadMat], trees, () => 0.9 + r() * 0.5, 0.9, true);
    mkSet({ hi: [bushGeo], lo: [bushGeo] }, [broadMat], bushes.filter((_, i) => i % 2 === 0), () => 0.7 + r() * 0.9, 0, false);
    mkSet({ hi: [fernGeo], lo: [fernGeo] }, [fernMat], bushes.filter((_, i) => i % 2 === 1), () => 0.8 + r() * 0.8, 0, false);

    // rocks / boulders
    const rockGeo = new THREE.IcosahedronGeometry(1, 2); { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + noise2(x * 1.7 + 3, y * 1.7 + z * 1.3) * 0.35 + noise2(z * 4, x * 4) * 0.08; p.setXYZ(i, x * k, y * k * 0.75, z * k); } rockGeo.computeVertexNormals(); }
    const rockMat = triplanar(new THREE.MeshStandardMaterial({ map: A.rock, normalMap: A.rockNor, roughness: 0.9, color: 0x9a948c }), 0.35);
    const rocks = pick((x, z, h) => h > 0.5 && away(x, z) && r() < 0.6, 120, 8000);
    const rm = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length); rm.castShadow = rm.receiveShadow = true;
    rocks.forEach(([x, z, h], i) => { const s = 0.8 + Math.pow(r(), 2.5) * 5; rm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, h + s * 0.15, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r() * 0.4)), new THREE.Vector3(s * (1 + r() * 0.6), s, s))); if (s > 1.6) this.addCollider(x, z, s * 1.0, h + s); });
    this.scene.add(rm);
    this.rockMat = rockMat;
    this.lodTimer = 0;
  }
  normalAtY(x, z) { const e = 2; const a = this.height(x - e, z) - this.height(x + e, z), b = this.height(x, z - e) - this.height(x, z + e); return 2 * e / Math.hypot(a, 2 * e, b); }

  updateLOD(cam) {
    const lodD2 = this.q.lodDist ** 2, far2 = this.q.draw ** 2;
    for (const set of this.lodSets) {
      let nh = 0, nl = 0;
      for (const it of set.items) {
        const d2 = (it.x - cam.x) ** 2 + (it.z - cam.z) ** 2; if (d2 > far2) continue;
        if (d2 < lodD2) { for (const m of set.hi) m.setMatrixAt(nh, it.m); nh++; } else { for (const m of set.lo) m.setMatrixAt(nl, it.m); nl++; }
      }
      for (const m of set.hi) { m.count = nh; m.instanceMatrix.needsUpdate = true; }
      for (const m of set.lo) { m.count = nl; m.instanceMatrix.needsUpdate = true; }
    }
  }

  // ---------- ruins arena ----------
  buildRuins() {
    const A = this.assets, r = rng(77);
    const stone = triplanar(new THREE.MeshStandardMaterial({ map: A.sand, normalMap: A.rockNor, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.85, color: 0xe8dcc8 }), 0.22);
    const pillars = [], blocks = [];
    const ring = 38;
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2; if (i % 6 === 2) continue; // gaps to walk in
      const x = ARENA.x + Math.cos(a) * ring, z = ARENA.z + Math.sin(a) * ring, h = this.height(x, z);
      const broken = r() < 0.35, ph = broken ? 2 + r() * 4 : 9 + r() * 3;
      pillars.push([x, h, z, 1.4, ph, a]); this.addCollider(x, z, 2.0, h + ph);
      if (!broken) blocks.push([x, h + ph + 0.6, z, 2.2, 1.2, 2.2, a]);
      if (!broken && i % 2 === 0) { const a2 = (i + 1) / 18 * Math.PI * 2; const x2 = ARENA.x + Math.cos(a2) * ring, z2 = ARENA.z + Math.sin(a2) * ring;
        if ((i + 1) % 6 !== 2) blocks.push([(x + x2) / 2, h + ph + 1.6, (z + z2) / 2, 1.6, 1.1, Math.hypot(x2 - x, z2 - z) + 2, Math.atan2(x2 - x, z2 - z)]); }
      if (broken) for (let k = 0; k < 3; k++) { const bx = x + (r() - 0.5) * 8, bz = z + (r() - 0.5) * 8; blocks.push([bx, this.height(bx, bz) + 0.5, bz, 1.6 + r(), 1.1, 1.6 + r() * 2, r() * 3]); }
    }
    // stepped temple at the back
    const tx = ARENA.x + 62, tz = ARENA.z - 20, th = this.height(tx, tz);
    for (let s = 0; s < 4; s++) blocks.push([tx, th + s * 2.4 + 1.2, tz, 26 - s * 5.5, 2.4, 22 - s * 5, 0.3]);
    this.addCollider(tx, tz, 12, th + 10);
    const pg = new THREE.CylinderGeometry(1, 1.12, 1, 10, 1); pg.translate(0, 0.5, 0);
    const pm = new THREE.InstancedMesh(pg, stone, pillars.length); pm.castShadow = pm.receiveShadow = true;
    pillars.forEach(([x, y, z, w, h, a], i) => pm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.4, z), new THREE.Quaternion(), new THREE.Vector3(w, h + 0.4, w))));
    const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stone, blocks.length); bm.castShadow = bm.receiveShadow = true;
    blocks.forEach(([x, y, z, sx, sy, sz, a], i) => bm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(sx, sy, sz))));
    this.scene.add(pm, bm);
  }

  // ---------- home base (repair pad + garage) ----------
  buildBase() {
    const g = new THREE.Group(); g.position.set(BASE.x, 3.0, BASE.z);
    const metal = new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.9, roughness: 0.35, normalMap: this.assets.metalNor, roughnessMap: this.assets.metalRough });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e35, metalness: 0.85, roughness: 0.45 });
    const glow = new THREE.MeshBasicMaterial({ color: 0x3de8ff, toneMapped: false });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(11, 12, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x6a7079, metalness: 0.55, roughness: 0.5, normalMap: this.assets.metalNor, roughnessMap: this.assets.metalRough })); pad.position.y = 0.2; pad.receiveShadow = true; pad.castShadow = true; g.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.18, 6, 48), glow); ring.rotation.x = Math.PI / 2; ring.position.y = 0.65; g.add(ring); this.baseRing = ring;
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 10), dark); hangar.position.set(0, 4.5, 16); hangar.castShadow = hangar.receiveShadow = true; g.add(hangar);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 10.4, 16, 1, false, 0, Math.PI), metal); roof.rotation.set(Math.PI / 2, Math.PI / 2, 0); roof.rotation.z = Math.PI / 2; roof.position.set(0, 9, 16); roof.castShadow = true; g.add(roof);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), new THREE.MeshBasicMaterial({ color: 0x0a2830 })); door.position.set(0, 3.6, 10.95); door.rotation.y = Math.PI; g.add(door);
    door.rotation.y = 0; door.position.z = 10.99 - 0.0;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.3, 0.3), glow); frame.position.set(0, 7.2, 10.9); g.add(frame);
    for (const s of [-1, 1]) { const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7.2, 0.3), glow); f2.position.set(s * 5.4, 3.6, 10.9); g.add(f2); }
    // beacon so kids can always find home
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.6, 120, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x3de8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.y = 60; g.add(beam); this.beam = beam;
    this.scene.add(g); this.addCollider(BASE.x, BASE.z + 16, 8.5, 12); this.baseGroup = g;
  }

  // ---------- grass & flowers (GPU instanced, wraps around the player) ----------
  buildGrass() {
    const r = rng(5);
    const blade = (h, w, bend) => { const segs = 3, pos = [], uv = [], idx = [];
      for (let i = 0; i <= segs; i++) { const t = i / segs, ww = w * (1 - t * 0.85), y = h * t, x = bend * t * t;
        if (i < segs) { pos.push(-ww / 2 + x, y, 0, ww / 2 + x, y, 0); uv.push(0, t, 1, t); } else { pos.push(x, y, 0); uv.push(0.5, 1); } }
      for (let i = 0; i < segs - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } const a = (segs - 1) * 2; idx.push(a, a + 1, a + 2);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g; };
    const clump = [], flower = [];
    for (let i = 0; i < 10; i++) { const g = blade(0.4 + r() * 0.55, 0.16 + r() * 0.08, (r() - 0.5) * 0.45); g.rotateY(r() * Math.PI); g.translate((r() - 0.5) * 1.1, 0, (r() - 0.5) * 1.1); clump.push(g); }
    // lavender-like flower: stem (uv.y<0.5) + spike of small petals (uv.y>0.6)
    for (let i = 0; i < 5; i++) {
      const x = (r() - 0.5) * 0.9, z = (r() - 0.5) * 0.9, h = 0.75 + r() * 0.45;
      const st = new THREE.CylinderGeometry(0.015, 0.02, h, 3, 1, true); st.translate(x, h / 2, z); { const u = st.attributes.uv; for (let k = 0; k < u.count; k++) u.setY(k, u.getY(k) * 0.45); } flower.push(st);
      const sp = new THREE.ConeGeometry(0.11, 0.55, 4, 1); sp.translate(x, h + 0.18, z); { const u = sp.attributes.uv; for (let k = 0; k < u.count; k++) u.setY(k, 0.62 + u.getY(k) * 0.38); } flower.push(sp);
    }
    const flowerGeo = mergeGeometries(flower.map(g => { g.deleteAttribute('normal'); return g.index ? g : g; }));
    const grassGeo = mergeGeometries(clump);
    const mkMesh = (geo, isFlower, count) => {
      const ig = new THREE.InstancedBufferGeometry(); ig.index = geo.index; ig.setAttribute('position', geo.attributes.position); ig.setAttribute('uv', geo.attributes.uv);
      const nor = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < nor.length; i += 3) nor[i + 1] = 1; ig.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      const MAX = count, inst = new Float32Array(MAX * 4), tile = 140;
      for (let i = 0; i < MAX; i++) { inst[i * 4] = r() * tile; inst[i * 4 + 1] = r() * tile; inst[i * 4 + 2] = r() * 6.283; inst[i * 4 + 3] = 0.75 + r() * 0.6; }
      ig.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4)); ig.instanceCount = MAX;
      const u = this.hmUniforms({ uTime: this.windU.uTime, uCenter: { value: new THREE.Vector3() }, uTile: { value: tile }, uRadius: { value: 60 }, uPlayer: { value: new THREE.Vector4(0, 0, 0, 3) } });
      const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
      mat.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, u);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec4 aInst; uniform sampler2D uHM; uniform float uS, uN, uTime, uTile, uRadius; uniform vec3 uCenter; uniform vec4 uPlayer; varying float vY; varying float vVar;`)
          .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
          .replace('#include <begin_vertex>', `
vec2 base = aInst.xy;
vec2 wp = base + uTile * floor((uCenter.xz - base) / uTile + 0.5);
vec2 huv = ((wp + uS*0.5)/uS*uN + 0.5)/(uN+1.0);
vec4 hm = texture2D(uHM, huv);
float dens = ${isFlower ? 'hm.b' : 'hm.g'};
float hsh = fract(sin(dot(base, vec2(12.9898, 78.233))) * 43758.5453);
float dd = length(wp - uCenter.xz);
float sc = aInst.w * smoothstep(hsh - 0.08, hsh + 0.08, dens) * (1.0 - smoothstep(uRadius * 0.55, uRadius, dd));
float c = cos(aInst.z), s = sin(aInst.z);
vec3 p = position * vec3(1.0, 0.6 + 0.45 * dens, 1.0) * sc;
p = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
float k = uv.y * uv.y;
float w = sin(uTime * 1.7 + wp.x * 0.21 + wp.y * 0.17) * 0.6 + sin(uTime * 3.3 + wp.x * 0.6 + wp.y*0.3) * 0.25;
p.x += k * (0.12 + w * 0.22) * sc; p.z += k * w * 0.12 * sc;
vec2 toP = wp - uPlayer.xz; float pd = length(toP);
float push = (1.0 - smoothstep(uPlayer.w * 0.5, uPlayer.w, pd)) * k * sc;
p.xz += normalize(toP + 1e-4) * push * 1.3; p.y -= push * 0.6;
vec3 transformed = vec3(wp.x, hm.r - 0.08, wp.y) + p;
vY = uv.y; vVar = hsh;`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vY; varying float vVar;')
          .replace('vec4 diffuseColor = vec4( diffuse, opacity );', isFlower ?
            `vec3 fc = vY > 0.55 ? mix(vec3(0.28,0.07,0.55), vec3(0.75,0.42,1.0), clamp((vY-0.6)*2.0 + vVar*0.4, 0.0, 1.0)) : vec3(0.05,0.12,0.02);
vec4 diffuseColor = vec4(fc, 1.0);` :
            `vec3 tip = mix(vec3(0.16,0.42,0.03), vec3(0.40,0.58,0.10), vVar);
vec4 diffuseColor = vec4(mix(vec3(0.02,0.07,0.01), tip, smoothstep(0.0, 1.0, vY)), 1.0);`);
      };
      const m = new THREE.Mesh(ig, mat); m.frustumCulled = false; m.receiveShadow = true; this.scene.add(m);
      return { mesh: m, geo: ig, u, max: MAX };
    };
    this.grass = mkMesh(grassGeo, false, 16000);
    this.flowers = mkMesh(flowerGeo, true, 8000);
    this.applyQuality(this.q);
  }

  applyQuality(q) {
    this.q = q;
    this.grass.geo.instanceCount = Math.min(this.grass.max, q.grass);
    this.flowers.geo.instanceCount = Math.min(this.flowers.max, Math.round(this.grass.geo.instanceCount * 0.45));
    const tile = Math.max(50, q.grassR * 2.05); this.grass.u.uTile.value = this.flowers.u.uTile.value = tile;
    this.grass.u.uRadius.value = this.flowers.u.uRadius.value = q.grassR;
    this.grass.mesh.receiveShadow = this.flowers.mesh.receiveShadow = q.tier >= 2;
    this.lodTimer = 0;
  }

  update(dt, cam, player) {
    this.time += dt; this.windU.uTime.value = this.time; this.waterU.uTime.value = this.time;
    // grass center slightly ahead of camera toward player so the field fills the view
    const cx = lerp(cam.x, player.x, 0.7), cz = lerp(cam.z, player.z, 0.7);
    for (const g of [this.grass, this.flowers]) { g.u.uCenter.value.set(cx, 0, cz); g.u.uPlayer.value.set(player.x, 0, player.z, 3.2 * (player.scale || 1)); }
    this.lodTimer -= dt; if (this.lodTimer <= 0) { this.lodTimer = 0.4; this.updateLOD(cam); }
    this.baseRing.material.color.setHSL(0.52, 1, 0.5 + 0.15 * Math.sin(this.time * 3));
    if (this.beam) { const d = Math.hypot(cam.x - BASE.x, cam.z - BASE.z); this.beam.material.opacity = 0.2 * smooth(40, 120, d); this.beam.visible = d > 40; }
    this.lavaGlow.material.opacity = 0.65 + 0.2 * Math.sin(this.time * 2.3) * Math.sin(this.time * 1.1);
  }
}

// ----- geometry builders -----
function trunkGeo(H, lean, rad, sides, rings) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, y = t * H, off = lean * t * t, r = rad * (1.25 - 0.45 * t) * (i === 0 ? 1.35 : 1) * (1 + 0.06 * Math.sin(t * 40));
    for (let s = 0; s <= sides; s++) { const a = s / sides * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
      pos.push(off + cx * r, y, cz * r); nor.push(cx, 0.15, cz); uv.push(s / sides, y / 2.2); }
  }
  for (let i = 0; i < rings; i++) for (let s = 0; s < sides; s++) { const a = i * (sides + 1) + s, b = a + sides + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
function frondGeo(len, width, segs, droop, rise) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) { const t = i / segs, x = t * len, y = len * (rise * t - droop * t * t), w = width * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) * (1 - t * 0.3);
    const fold = w * 0.18; pos.push(x, y - fold, -w, x, y + fold * 0.5, 0, x, y - fold, w); nor.push(0, 1, 0.25, 0, 1, 0, 0, 1, -0.25); uv.push(0, t, 0.5, t, 1, t); }
  for (let i = 0; i < segs; i++) { const a = i * 3, b = a + 3; idx.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
function palmCrown(H, lean, n, segs) {
  const r = rng(H * 10 | 0), parts = [];
  for (let i = 0; i < n; i++) {
    const f = frondGeo(4.2 + r() * 1.6, 1.25, segs, 0.75 + r() * 0.3, 0.45 + r() * 0.2);
    f.rotateZ((r() - 0.3) * 0.25); f.rotateY(i / n * Math.PI * 2 + r() * 0.3); f.translate(lean, H - 0.1, 0); parts.push(f);
  }
  return mergeGeometries(parts);
}
function crownGeo(H, rad, n) {
  // clusters of crossed leaf cards around a sphere -> lush broadleaf canopy / bush
  const r = rng((H * 13 + n) | 0), parts = [];
  for (let i = 0; i < n; i++) {
    const p = new THREE.PlaneGeometry(rad * 1.3, rad * 1.3);
    const nrm = p.attributes.normal; for (let k = 0; k < nrm.count; k++) nrm.setXYZ(k, 0, 1, 0);
    const th = r() * Math.PI * 2, ph = Math.acos(r() * 1.6 - 0.6);
    p.rotateX(-Math.PI / 2 + (r() - 0.5) * 1.4); p.rotateY(th);
    p.translate(Math.sin(ph) * Math.cos(th) * rad * 0.7, H + Math.cos(ph) * rad * 0.5, Math.sin(ph) * Math.sin(th) * rad * 0.7); parts.push(p);
  }
  return mergeGeometries(parts);
}
function fernCluster(n) {
  const r = rng(91), parts = [];
  for (let i = 0; i < n; i++) { const f = frondGeo(1.4 + r() * 0.8, 0.45, 5, 0.9, 0.8); f.rotateY(i / n * Math.PI * 2 + r() * 0.4); f.translate(0, 0.05, 0); parts.push(f); }
  return mergeGeometries(parts);
}
export function triplanar(mat, scale) {
  // object-space triplanar so instanced rocks/stones do not show UV seams
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;').replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vOP = (instanceMatrix * vec4(position,1.0)).xyz;
      #else
      vOP = (modelMatrix * vec4(position,1.0)).xyz;
      #endif
      vON = normalize(normal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;')
      .replace('#include <map_fragment>', `vec3 tb = pow(abs(vON), vec3(3.0)); tb /= tb.x+tb.y+tb.z; float ts = ${scale.toFixed(3)};
diffuseColor.rgb *= texture2D(map, vOP.zy*ts).rgb*tb.x + texture2D(map, vOP.xz*ts).rgb*tb.y + texture2D(map, vOP.xy*ts).rgb*tb.z;`)
      .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'vec3 mapN = (texture2D(normalMap, vOP.zy*ts).xyz*tb.x + texture2D(normalMap, vOP.xz*ts).xyz*tb.y + texture2D(normalMap, vOP.xy*ts).xyz*tb.z)*2.0-1.0;');
  };
  return mat;
}
