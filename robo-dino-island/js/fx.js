// GPU-instanced billboard particles (smoke, fire, sparks, laser streaks), missiles, shock rings, flash light.
import * as THREE from './vendor/three.bundle.min.js';

const VS = `
attribute vec4 iPos;   // xyz, size
attribute vec4 iCol;   // rgba
attribute vec4 iDir;   // xyz dir, w = streak length (0 = round billboard)
attribute float iRot;
varying vec2 vUv; varying vec4 vCol; varying float vDepth; varying float vNear;
void main(){
  vUv = uv; vCol = iCol;
  vec4 mv = modelViewMatrix * vec4(iPos.xyz, 1.0);
  vNear = smoothstep(0.6, 1.5 + iPos.w * 0.8, -mv.z); // fade big particles that reach the camera (no screen whiteouts)
  vec2 c = position.xy;
  if (iDir.w > 0.0) {
    vec3 d = normalize((modelViewMatrix * vec4(iDir.xyz, 0.0)).xyz);
    vec3 side = normalize(cross(d, normalize(mv.xyz)));
    mv.xyz += side * c.x * iPos.w + d * c.y * iDir.w;
  } else {
    float cs = cos(iRot), sn = sin(iRot);
    mv.xy += vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs) * iPos.w;
  }
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
uniform sampler2D map; uniform vec3 fogColor; uniform float fogNear, fogFar, additive;
varying vec2 vUv; varying vec4 vCol; varying float vDepth; varying float vNear;
void main(){
  vec4 t = texture2D(map, vUv);
  vec4 c = vec4(vCol.rgb * mix(vec3(1.0), t.rgb, 0.0), t.a * vCol.a * vNear);
  float f = smoothstep(fogNear, fogFar, vDepth);
  if (additive > 0.5) c.rgb *= c.a * (1.0 - f); else c.rgb = mix(c.rgb, fogColor, f);
  gl_FragColor = c;
}`;

export class Particles {
  constructor(scene, max, map, additive) {
    this.max = max; this.cap = max; this.p = []; this.additive = additive; this.ov = 0;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aDir = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.aRot = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    [this.aPos, this.aCol, this.aDir, this.aRot].forEach(a => a.setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iPos', this.aPos); g.setAttribute('iCol', this.aCol); g.setAttribute('iDir', this.aDir); g.setAttribute('iRot', this.aRot); g.instanceCount = 0;
    this.u = { map: { value: map }, fogColor: { value: new THREE.Color() }, fogNear: { value: 100 }, fogFar: { value: 500 }, additive: { value: additive ? 1 : 0 } };
    const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, premultipliedAlpha: !!additive });
    if (additive) { m.blending = THREE.CustomBlending; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor; }
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 5 : 4; scene.add(this.mesh); this.geo = g;
  }
  spawn(o) {
    // pooled: when the (tier-dependent) cap is reached, recycle an existing particle instead of growing
    let slot = -1; if (this.p.length >= this.cap) { this.ov = (this.ov + 7) % this.p.length; slot = this.ov; }
    const p = { x: o.pos.x, y: o.pos.y, z: o.pos.z, vx: o.vel ? o.vel.x : 0, vy: o.vel ? o.vel.y : 0, vz: o.vel ? o.vel.z : 0,
      life: o.life || 1, age: 0, s0: o.size ?? 1, s1: o.size1 ?? o.size ?? 1, r: o.r ?? 1, g: o.g ?? 1, b: o.b ?? 1, a0: o.alpha ?? 1, a1: o.alpha1 ?? 0,
      rot: o.rot ?? Math.random() * 6.28, rv: o.rv ?? 0, drag: o.drag ?? 0, grav: o.grav ?? 0, len: o.len || 0, fadeIn: o.fadeIn || 0, dir: o.dir || null };
    if (slot >= 0) this.p[slot] = p; else this.p.push(p); return p;
  }
  update(dt, fog) {
    if (fog) { this.u.fogColor.value.copy(fog.color).convertLinearToSRGB(); this.u.fogNear.value = fog.near; this.u.fogFar.value = fog.far; }
    const P = this.aPos.array, C = this.aCol.array, D = this.aDir.array, Rr = this.aRot.array; let n = 0;
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i]; p.age += dt; if (p.age >= p.life) { this.p[i] = this.p[this.p.length - 1]; this.p.pop(); i--; continue; }
      const t = p.age / p.life, dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr; p.vy = p.vy * dr - p.grav * dt; p.vz *= dr; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.rv * dt;
      let a = p.a0 + (p.a1 - p.a0) * t; if (p.fadeIn) a *= Math.min(1, t / p.fadeIn);
      P[n * 4] = p.x; P[n * 4 + 1] = p.y; P[n * 4 + 2] = p.z; P[n * 4 + 3] = p.s0 + (p.s1 - p.s0) * t;
      C[n * 4] = p.r; C[n * 4 + 1] = p.g; C[n * 4 + 2] = p.b; C[n * 4 + 3] = a;
      if (p.len) { const d = p.dir || { x: p.vx, y: p.vy, z: p.vz }; D[n * 4] = d.x; D[n * 4 + 1] = d.y; D[n * 4 + 2] = d.z + 1e-5; D[n * 4 + 3] = p.len; } else D[n * 4 + 3] = 0;
      Rr[n] = p.rot; n++;
    }
    this.geo.instanceCount = n;
    for (const a of [this.aPos, this.aCol, this.aDir, this.aRot]) { a.needsUpdate = true; a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); }
  }
}

export class FX {
  constructor(scene, assets, audio) {
    this.scene = scene; this.sfx = audio;
    // buffers are sized for the top tier; setTier() sets the live caps + spawn-count multiplier
    this.smoke = new Particles(scene, 1700, assets.smoke, false);
    this.glow = new Particles(scene, 2300, assets.glow, true);
    this.fire = new Particles(scene, 1500, assets.smoke, true);
    this.light = new THREE.PointLight(0xff9a40, 0, 40, 1.6); scene.add(this.light); this.lightT = 0;
    this.em = []; this.debris = []; this.k = 1; this.maxDebris = 40; this.maxEm = 40;
    // scorch decals + warning circles (pooled meshes)
    const dg = new THREE.CircleGeometry(1, 20); dg.rotateX(-Math.PI / 2);
    this.scorches = []; this.scorchI = 0;
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ color: 0x0a0604, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); m.visible = false; m.renderOrder = 2; scene.add(m); this.scorches.push({ m, t: 0 }); }
    const wg = new THREE.RingGeometry(0.78, 1, 36); wg.rotateX(-Math.PI / 2); const wf = new THREE.CircleGeometry(0.78, 36); wf.rotateX(-Math.PI / 2);
    this.warns = []; this.wg = wg; this.wf = wf;
    // pooled missile meshes
    const mg = new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8); mg.rotateX(Math.PI / 2);
    this.missileMat = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.7, roughness: 0.35 });
    this.missiles = []; this.mGeo = mg;
    this.rings = [];
    const rg = new THREE.RingGeometry(0.85, 1, 40); rg.rotateX(-Math.PI / 2); this.ringGeo = rg; this.ringGeoV = new THREE.RingGeometry(0.7, 1, 40); this.waves = [];
    this.shake = 0; this.v = new THREE.Vector3();
    this.zaps = []; this.zapMats = {};
  }
  // jagged lightning bolt between two points (two crossed ribbons so it reads from any angle) + glow beads
  zap(a, b, col = { r: 0.75, g: 0.8, b: 1.0 }, w = 0.32, life = 0.16, jag = 0.08) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length(); if (L < 0.2) return;
    const n = Math.max(4, Math.min(16, Math.round(L / 2.5))), dn = d.clone().divideScalar(L);
    const p1 = new THREE.Vector3().crossVectors(dn, Math.abs(dn.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize(), p2 = new THREE.Vector3().crossVectors(dn, p1).normalize();
    const pts = []; for (let i = 0; i <= n; i++) { const t = i / n, j = i === 0 || i === n ? 0 : L * jag * (0.4 + Math.random() * 0.6);
      pts.push(a.clone().addScaledVector(d, t).addScaledVector(p1, (Math.random() - 0.5) * 2 * j).addScaledVector(p2, (Math.random() - 0.5) * 2 * j)); }
    const pos = [];
    for (const P of [p1, p2]) for (let i = 0; i < n; i++) { const A = pts[i], B = pts[i + 1], ww = w * (1 - 0.5 * i / n);
      const a0 = A.clone().addScaledVector(P, ww), a1 = A.clone().addScaledVector(P, -ww), b0 = B.clone().addScaledVector(P, ww), b1 = B.clone().addScaledVector(P, -ww);
      pos.push(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, b0.x, b0.y, b0.z, a1.x, a1.y, a1.z, b1.x, b1.y, b1.z, b0.x, b0.y, b0.z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const key = [col.r, col.g, col.b].join(','); let mat = this.zapMats[key];
    if (!mat) mat = this.zapMats[key] = new THREE.MeshBasicMaterial({ color: new THREE.Color(col.r * 2.6, col.g * 2.6, col.b * 2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 4; this.scene.add(m); this.zaps.push({ m, t: 0, life });
    if (this.zaps.length > 40) { const z = this.zaps.shift(); this.scene.remove(z.m); z.m.geometry.dispose(); }
    for (let i = 0; i <= n; i += 2) this.glow.spawn({ pos: pts[i], size: 1.6 * w * 4, size1: 0.5, life: 0.12, r: col.r * 2, g: col.g * 2, b: col.b * 2, alpha: 0.9 });
    this.glow.spawn({ pos: b, size: 4, size1: 1, life: 0.14, r: col.r * 2.6, g: col.g * 2.6, b: col.b * 2.6, alpha: 1 });
    this.light.position.copy(b); this.light.position.y += 1; this.light.color.setRGB(col.r, col.g, col.b); this.light.intensity = Math.max(this.light.intensity, 50); this.light.distance = Math.max(this.light.distance, 40);
  }
  // frost breath puff (call every frame while breathing)
  frost(pos, dir, len = 1, power = 1) {
    const n = this.n(5 * power);
    for (let i = 0; i < n; i++) { const sp = (17 + Math.random() * 12) * len, j = () => (Math.random() - 0.5) * 0.3;
      const v = { x: (dir.x + j()) * sp, y: (dir.y + j() * 0.6) * sp + 1, z: (dir.z + j()) * sp };
      this.fire.spawn({ pos, vel: v, size: 0.5 * power, size1: Math.min(7, 4 * power * len), life: 0.45 + Math.random() * 0.2, r: 0.35, g: 0.9 + Math.random() * 0.3, b: 2.4, alpha: 0.7, alpha1: 0, drag: 2.2, rv: (Math.random() - 0.5) * 3 }); }
    if (Math.random() < 0.6 * this.k) { const e = pos.clone().addScaledVector(dir, (4 + Math.random() * 6) * len); this.smoke.spawn({ pos: e, vel: { x: dir.x * 6, y: 1, z: dir.z * 6 }, size: 1.5, size1: 6, life: 1.1, r: 0.85, g: 0.95, b: 1.05, alpha: 0.45, drag: 1.5, rv: 1, fadeIn: 0.1 }); }
    for (let i = 0; i < 2; i++) this.glow.spawn({ pos, vel: { x: dir.x * 24 + (Math.random() - 0.5) * 9, y: dir.y * 24 + (Math.random() - 0.5) * 6, z: dir.z * 24 + (Math.random() - 0.5) * 9 }, size: 0.16, life: 0.55, r: 2.2, g: 2.6, b: 3, alpha: 1, drag: 1.2 });
    this.light.position.copy(pos).addScaledVector(dir, 4); this.light.color.setRGB(0.5, 0.8, 1); this.light.intensity = Math.max(this.light.intensity, 45 * power); this.light.distance = Math.max(this.light.distance, 30);
  }
  // icy shatter / goo splat bursts
  shatter(pos, power = 1) { for (let i = 0; i < this.n(14 * power); i++) { const v = { x: (Math.random() - 0.5) * 16 * power, y: 3 + Math.random() * 10 * power, z: (Math.random() - 0.5) * 16 * power };
      this.glow.spawn({ pos, vel: v, size: 0.22, life: 0.7, len: 0.5, r: 1.6, g: 2.4, b: 3, alpha: 1, grav: 20, drag: 0.8 }); }
    this.smoke.spawn({ pos, size: 2 * power, size1: 6 * power, life: 0.9, r: 0.85, g: 0.95, b: 1.05, alpha: 0.6, drag: 1, fadeIn: 0.05 }); this.ring(pos, 6 * power, 0x9fe8ff); }
  goo(pos, power = 1) { for (let i = 0; i < this.n(14 * power); i++) { const v = { x: (Math.random() - 0.5) * 12 * power, y: 3 + Math.random() * 7, z: (Math.random() - 0.5) * 12 * power };
      this.glow.spawn({ pos, vel: v, size: 0.35, size1: 0.15, life: 0.8, r: 0.8, g: 2.6, b: 0.3, alpha: 1, grav: 22, drag: 0.6 }); }
    this.smoke.spawn({ pos, size: 1.5 * power, size1: 5 * power, life: 1.2, r: 0.45, g: 0.75, b: 0.2, alpha: 0.55, drag: 1, fadeIn: 0.05 }); this.ring(pos, 5 * power, 0x9aff2a); }
  setTier(t) {
    const T = [{ s: 450, g: 650, f: 380, k: 0.42, d: 10, e: 14 }, { s: 750, g: 1050, f: 650, k: 0.65, d: 20, e: 24 }, { s: 1200, g: 1600, f: 1050, k: 1, d: 32, e: 34 }, { s: 1700, g: 2300, f: 1500, k: 1.25, d: 44, e: 44 }][t] || {};
    this.smoke.cap = T.s; this.glow.cap = T.g; this.fire.cap = T.f; this.k = T.k; this.maxDebris = T.d; this.maxEm = T.e;
  }
  n(x) { return Math.max(1, Math.round(x * this.k)); } // tier-scaled particle count
  emit(dur, fn) { if (this.em.length >= this.maxEm) return; this.em.push({ t: 0, dur, fn }); }
  flash(pos, power = 1, color = 0xff9a40) { this.light.position.copy(pos); this.light.position.y += 2; this.light.color.set(color); this.light.distance = Math.max(this.light.intensity > 20 ? this.light.distance : 0, 40 + 30 * power); this.light.intensity = Math.max(this.light.intensity, 45 * power); }
  scorch(pos, r) { const S = this.scorches[this.scorchI++ % this.scorches.length]; S.m.position.set(pos.x, pos.y + 0.12, pos.z); S.m.scale.setScalar(r); S.m.rotation.y = Math.random() * 6; S.m.visible = true; S.t = 0; }
  // pulsing red warning circle on the ground (lava bombs, air strikes)
  warn(pos, r, dur) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const fill = new THREE.MeshBasicMaterial({ color: 0xff3a10, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(this.wg, mat), f = new THREE.Mesh(this.wf, fill); m.add(f); m.position.set(pos.x, pos.y + 0.35, pos.z); m.scale.setScalar(r); m.renderOrder = 3; this.scene.add(m);
    const w = { m, f, t: 0, dur }; this.warns.push(w); return w;
  }
  // fiery debris chunk with a smoke + flame trail
  chunk(pos, vel, size = 1) { if (this.debris.length >= this.maxDebris) return; this.debris.push({ p: pos.clone(), v: new THREE.Vector3(vel.x, vel.y, vel.z), t: 0, life: 1.4 + Math.random() * 0.8, s: size }); }
  // flamethrower / fire-breath puff (call every frame while breathing)
  flame(pos, dir, len = 1, power = 1) {
    const n = this.n(5 * power);
    for (let i = 0; i < n; i++) { const sp = (18 + Math.random() * 12) * len, j = () => (Math.random() - 0.5) * 0.32;
      const v = { x: (dir.x + j()) * sp, y: (dir.y + j() * 0.6) * sp + 1.5, z: (dir.z + j()) * sp };
      this.fire.spawn({ pos, vel: v, size: 0.5 * power, size1: Math.min(7, 4.2 * power * len), life: 0.42 + Math.random() * 0.2, r: 2.5, g: 0.8 + Math.random() * 0.7, b: 0.15, alpha: 0.9, alpha1: 0, drag: 2.2, rv: (Math.random() - 0.5) * 4 }); }
    this.glow.spawn({ pos, vel: { x: dir.x * 10, y: dir.y * 10, z: dir.z * 10 }, size: 1.6 * power, size1: 0.4, life: 0.12, r: 3, g: 2.6, b: 1.4, alpha: 1 });
    if (Math.random() < 0.35 * this.k) { const e = pos.clone().addScaledVector(dir, 9 * len); this.smoke.spawn({ pos: e, vel: { x: dir.x * 4, y: 4, z: dir.z * 4 }, size: 2, size1: 7, life: 1.4, r: 0.18, g: 0.16, b: 0.15, alpha: 0.5, drag: 1, rv: 1, fadeIn: 0.2 }); }
    if (Math.random() < 0.6) this.glow.spawn({ pos, vel: { x: dir.x * 22 + (Math.random() - 0.5) * 8, y: dir.y * 22 + Math.random() * 6, z: dir.z * 22 + (Math.random() - 0.5) * 8 }, size: 0.12, life: 0.6, len: 0.5, r: 3, g: 1.8, b: 0.5, alpha: 1, grav: 6 });
    this.light.position.copy(pos).addScaledVector(dir, 4); this.light.color.setRGB(1, 0.55, 0.2); this.light.intensity = Math.max(this.light.intensity, 60 * power); this.light.distance = Math.max(this.light.distance, 30);
  }
  // flames licking off a burning dino / ground patch (call every frame)
  burn(pos, r = 1, h = 1, rate = 1) {
    if (Math.random() < 0.9 * rate * this.k) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r;
      this.fire.spawn({ pos: { x: pos.x + Math.cos(a) * d, y: pos.y + Math.random() * h, z: pos.z + Math.sin(a) * d }, vel: { x: 0, y: 3 + Math.random() * 3, z: 0 }, size: 0.8 + r * 0.25, size1: 0.2, life: 0.5 + Math.random() * 0.3, r: 3, g: 1.1 + Math.random() * 0.8, b: 0.2, alpha: 0.9, rv: 2 }); }
    if (Math.random() < 0.18 * rate * this.k) this.smoke.spawn({ pos: { x: pos.x, y: pos.y + h + 0.5, z: pos.z }, vel: { x: 0.5, y: 3.5, z: 0 }, size: 1 + r * 0.3, size1: 4 + r, life: 1.8, r: 0.14, g: 0.13, b: 0.12, alpha: 0.45, drag: 0.5, rv: 0.6, fadeIn: 0.2 });
    if (Math.random() < 0.25 * rate) this.glow.spawn({ pos: { x: pos.x + (Math.random() - 0.5) * r, y: pos.y + Math.random() * h, z: pos.z + (Math.random() - 0.5) * r }, vel: { x: (Math.random() - 0.5) * 2, y: 4 + Math.random() * 4, z: (Math.random() - 0.5) * 2 }, size: 0.14, life: 1, r: 3, g: 1.5, b: 0.4, alpha: 1 });
  }
  // drifting embers in a volume (volcano air, title screen)
  embers(c, R, n = 1, up = 3) { for (let i = 0; i < this.n(n); i++) this.glow.spawn({ pos: { x: c.x + (Math.random() - 0.5) * R, y: c.y + (Math.random() - 0.3) * R * 0.5, z: c.z + (Math.random() - 0.5) * R }, vel: { x: (Math.random() - 0.5) * 2 + 1, y: up * (0.5 + Math.random()), z: (Math.random() - 0.5) * 2 }, size: 0.1 + Math.random() * 0.14, size1: 0.02, life: 2.5 + Math.random() * 2, r: 3, g: 1.2 + Math.random() * 0.6, b: 0.25, alpha: 1, drag: 0.2 }); }
  // glowing falling projectile trail (lava bombs, meteors)
  trail(pos, size = 1, hot = 1) {
    this.fire.spawn({ pos, size: 1.6 * size, size1: 0.4 * size, life: 0.35, r: 3.2, g: 1.2 + 0.6 * hot, b: 0.25, alpha: 1, rv: 3 });
    this.glow.spawn({ pos, size: 2.2 * size, size1: 0.5, life: 0.08, r: 3, g: 2 * hot, b: 0.8 * hot, alpha: 1 });
    if (Math.random() < 0.8 * this.k) this.smoke.spawn({ pos, size: 0.9 * size, size1: 3.5 * size, life: 1.4, r: 0.2, g: 0.18, b: 0.17, alpha: 0.55, drag: 0.6, rv: 1 });
  }
  explosion(pos, power = 1, opts = {}) { return this.boom(pos, power, opts); }
  // the big one: layered fireball, secondary blasts, shockwave rings, flaming debris, smoke column, scorch, light flash, shake
  boom(pos, power = 1, opts = {}) {
    const P = power * 1.35, k = this.k, base = new THREE.Vector3(pos.x, pos.y, pos.z);
    for (let i = 0; i < this.n(16 * Math.sqrt(P)); i++) { const a = Math.random() * 6.28, u = Math.random(), sp = 4 + Math.random() * 10 * P;
      const v = { x: Math.cos(a) * sp * (1 - u * 0.5), y: 2 + u * 10 * P, z: Math.sin(a) * sp * (1 - u * 0.5) };
      const hot = Math.random(); this.fire.spawn({ pos: base, vel: v, size: 3.4 * P, size1: 9 * P, life: 0.55 + Math.random() * 0.6, r: 1.6 + hot * 0.6, g: 0.34 + hot * 0.4, b: 0.04 + hot * 0.06, alpha: 0.42, drag: 2.6, rv: (Math.random() - 0.5) * 3 }); }
    this.glow.spawn({ pos: base, size: 9 * P, size1: 14 * P, life: 0.16, r: 2, g: 1.3, b: 0.6, alpha: 0.9 });
    this.glow.spawn({ pos: base, size: 4 * P, size1: 1, life: 0.1, r: 2.5, g: 2.4, b: 2.2, alpha: 1 });
    // rolling secondary fireballs rising into a mushroom puff
    if (P > 0.7) this.emit(0.5, (dt, t) => { if (Math.random() < 0.6) { const o = base.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6 * P, t * 10 * P, (Math.random() - 0.5) * 6 * P)); this.fire.spawn({ pos: o, vel: { x: 0, y: 6, z: 0 }, size: 4 * P, size1: 8 * P, life: 0.6, r: 2, g: 0.6, b: 0.1, alpha: 0.8, drag: 1.5, rv: 2 }); } });
    // smoke column rising for a few seconds
    const col = opts.column ?? P > 0.6;
    if (col) this.emit(2.6 * Math.min(1.6, P), (dt, t, dur) => { if (Math.random() < 0.55 * k) { const g = 0.1 + Math.random() * 0.1, f = 1 - t / dur;
      this.smoke.spawn({ pos: { x: base.x + (Math.random() - 0.5) * 3 * P, y: base.y + 1, z: base.z + (Math.random() - 0.5) * 3 * P }, vel: { x: 0.8, y: 7 + 5 * P, z: 0 }, size: 3 * P, size1: 11 * P, life: 2.6 + Math.random(), r: g, g, b: g, alpha: 0.75 * f + 0.15, drag: 0.35, rv: (Math.random() - 0.5) * 0.6, fadeIn: 0.1 }); } });
    for (let i = 0; i < this.n(12 * P); i++) { const v = { x: (Math.random() - 0.5) * 9, y: 2 + Math.random() * 7, z: (Math.random() - 0.5) * 9 };
      const g = 0.1 + Math.random() * 0.12; this.smoke.spawn({ pos: base, vel: v, size: 3 * P, size1: 11 * P, life: 2 + Math.random(), r: g, g, b: g, alpha: 0.8, drag: 1.2, rv: (Math.random() - 0.5), fadeIn: 0.08 }); }
    for (let i = 0; i < this.n(6 * P); i++) this.chunk(base, { x: (Math.random() - 0.5) * 26 * Math.sqrt(P), y: 10 + Math.random() * 14, z: (Math.random() - 0.5) * 26 * Math.sqrt(P) }, 0.6 + Math.random() * 0.6);
    for (let i = 0; i < this.n(8 * P); i++) { const v = { x: (Math.random() - 0.5) * 24, y: 8 + Math.random() * 12, z: (Math.random() - 0.5) * 24 };
      this.glow.spawn({ pos: base, vel: v, size: 0.22, life: 1, len: 1.3, r: 3, g: 1.8, b: 0.6, alpha: 1, grav: 24, drag: 0.4 }); }
    this.sparks(base, 20 * P, undefined, 1.6);
    this.ring(base, 16 * P, 0xffb060); this.ring(base, 8 * P, 0xffffff); if (P > 1.2) this.ring(base, 26 * P, 0xff6020);
    if (opts.ground !== false) { const g = base.clone(); g.y = (opts.groundY ?? base.y - 0.8); this.scorch(g, 2.5 + 2.5 * P); }
    this.flash(base, P); this.shake = Math.max(this.shake, 0.65 * P * (opts.shake ?? 1));
  }
  muzzle(pos, col, dir) {
    this.glow.spawn({ pos, size: 4.2, size1: 1.0, life: 0.13, r: col.r * 2.4, g: col.g * 2.4, b: col.b * 2.4, alpha: 1 });
    this.glow.spawn({ pos, size: 1.3, size1: 0.3, life: 0.09, r: 2.5, g: 2.5, b: 2.5, alpha: 1 });
    if (dir) { // star-shaped flare + a few hot sparks
      this.glow.spawn({ pos, vel: { x: dir.x * 4, y: dir.y * 4, z: dir.z * 4 }, size: 0.5, life: 0.08, len: 3.2, r: col.r * 3, g: col.g * 3, b: col.b * 3, alpha: 1, dir });
      for (let i = 0; i < 4; i++) this.glow.spawn({ pos, vel: { x: dir.x * 18 + (Math.random() - 0.5) * 9, y: dir.y * 18 + Math.random() * 5, z: dir.z * 18 + (Math.random() - 0.5) * 9 }, size: 0.08, life: 0.25, len: 0.6, r: 3, g: 2.2, b: 1.2, alpha: 1, grav: 15 });
      this.light.position.copy(pos); this.light.color.setRGB(col.r, col.g, col.b); this.light.intensity = Math.max(this.light.intensity, 40);
    }
  }
  // punchy hit without a weapon (bites, rams, tail whips): white-hot pop, dust burst, chips
  impact(pos, power = 1, soft = false) {
    this.glow.spawn({ pos, size: 3.2 * power, size1: 5 * power, life: 0.14, r: 2.6, g: 2.2, b: 1.6, alpha: 0.9 });
    this.glow.spawn({ pos, size: 1.2 * power, size1: 0.2, life: 0.1, r: 3, g: 3, b: 3, alpha: 1 });
    for (let i = 0; i < 8 * power; i++) { const v = { x: (Math.random() - 0.5) * 12 * power, y: Math.random() * 8 + 2, z: (Math.random() - 0.5) * 12 * power };
      if (soft) this.smoke.spawn({ pos, vel: v, size: 0.5 * power, size1: 2.2 * power, life: 0.7, r: 0.7, g: 0.63, b: 0.5, alpha: 0.6, drag: 3, rv: 1 });
      else this.glow.spawn({ pos, vel: v, size: 0.1, life: 0.4 + Math.random() * 0.3, len: 0.7, r: 3, g: 2, b: 0.8, alpha: 1, grav: 22, drag: 1 }); }
    this.ring(pos, 4 * power, 0xffffff);
  }
  // visible shockwave rings from a roar + dust blown away along the ground
  roarWave(pos, dir, s = 1, col) {
    // a cone of hot breath/air puffs blasting forward
    for (let i = 0; i < 16; i++) { const sp = 18 + Math.random() * 14, j = () => (Math.random() - 0.5) * 0.5;
      this.smoke.spawn({ pos: pos.clone().addScaledVector(dir, 0.8), vel: { x: (dir.x + j()) * sp, y: (dir.y + j() * 0.6) * sp, z: (dir.z + j()) * sp }, size: 0.6 * s, size1: 3.6 * s, life: 0.55 + Math.random() * 0.3, r: 1.1, g: 1.05, b: 1.0, alpha: 0.22, drag: 3.2, rv: 1 }); }
    for (let i = 0; i < 18; i++) { const a = (Math.random() - 0.5) * 1.6, d = { x: dir.x * Math.cos(a) - dir.z * Math.sin(a), z: dir.x * Math.sin(a) + dir.z * Math.cos(a) };
      const p = pos.clone().addScaledVector(dir, 2 + Math.random() * 6); p.y -= 2.5 * s;
      this.smoke.spawn({ pos: p, vel: { x: d.x * 16, y: 1 + Math.random() * 2, z: d.z * 16 }, size: 1.2 * s, size1: 4 * s, life: 1.1, r: 0.62, g: 0.56, b: 0.44, alpha: 0.45, drag: 2, rv: 1 }); }
    if (col) this.glow.spawn({ pos, size: 3 * s, size1: 6 * s, life: 0.4, r: col.r * 1.5, g: col.g * 1.5, b: col.b * 1.5, alpha: 0.8 });
  }
  // stunned: little circling stars (real dinos) or crackling blue sparks (robots)
  dizzy(e, real) {
    const h = e.pos.clone(); h.y += e.mech.height * 1.0 + 0.5; const a = Math.random() * 6.28, r = 0.8 + e.def.scale * 0.6;
    h.x += Math.cos(a) * r; h.z += Math.sin(a) * r;
    if (real) this.glow.spawn({ pos: h, vel: { x: -Math.sin(a) * 4, y: 0.6, z: Math.cos(a) * 4 }, size: 0.55, size1: 0.2, life: 0.7, r: 3, g: 2.6, b: 0.6, alpha: 1 });
    else for (let i = 0; i < 3; i++) this.glow.spawn({ pos: h, vel: { x: (Math.random() - 0.5) * 8, y: Math.random() * 4, z: (Math.random() - 0.5) * 8 }, size: 0.07, life: 0.25, len: 0.6, r: 0.8, g: 2, b: 3, alpha: 1, grav: 10 });
  }
  laserBolt(pos, dir, col, speed) {
    const vel = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    return [this.glow.spawn({ pos, vel, size: 1.0, life: 1.2, len: 8, r: col.r * 2, g: col.g * 2, b: col.b * 2, alpha: 1, alpha1: 1, dir }),
      this.glow.spawn({ pos, vel, size: 0.28, life: 1.2, len: 6.5, r: 1, g: 1, b: 1, alpha: 1, alpha1: 1, dir })];
  }
  sparks(pos, n = 10, col = { r: 1, g: 0.75, b: 0.3 }, power = 1) {
    n = Math.max(2, Math.round(n * 1.5 * this.k));
    for (let i = 0; i < n; i++) { const v = { x: (Math.random() - 0.5) * 18 * power, y: Math.random() * 12 * power + 2, z: (Math.random() - 0.5) * 18 * power };
      this.glow.spawn({ pos, vel: v, size: 0.13, life: 0.4 + Math.random() * 0.5, len: 0.85, r: col.r * 3.2, g: col.g * 3.2, b: col.b * 3.2, alpha: 1, alpha1: 0.2, grav: 22, drag: 1.3 }); }
    this.glow.spawn({ pos, size: 2.2 * power, size1: 3.4 * power, life: 0.16, r: col.r * 2.4, g: col.g * 2.4, b: col.b * 2.4, alpha: 0.95 });
  }
  dust(pos, n = 8, size = 2, radial = 6) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; const v = { x: Math.cos(a) * radial, y: 1 + Math.random() * 2, z: Math.sin(a) * radial };
      this.smoke.spawn({ pos, vel: v, size, size1: size * 2.8, life: 1.1, r: 0.62, g: 0.55, b: 0.42, alpha: 0.55, drag: 2.5, rv: (Math.random() - 0.5) }); }
  }
  ring(pos, radius, color) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.position.copy(pos); m.position.y += 0.4; this.scene.add(m); this.rings.push({ m, t: 0, R: radius });
  }
  meteor(pos, size = 1) { this.trail(pos, size * 1.6, 1.2); }
  launchMissile(from, dirInit, target, owner, dmg, col) {
    if (this.missiles.length >= 48) { const o = this.missiles.shift(); this.scene.remove(o.m); } // perf cap for button mashing (oldest fizzles)
    const m = new THREE.Mesh(this.mGeo, this.missileMat); m.position.copy(from); m.castShadow = false; this.scene.add(m);
    const vel = dirInit.clone().multiplyScalar(14); vel.y += 9;
    this.missiles.push({ m, vel, target, owner, dmg, t: 0, col });
    this.sfx.missile();
  }
  update(dt, world, onMissileHit, fog) {
    // missiles: arc up then home in
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const M = this.missiles[i]; M.t += dt; const p = M.m.position;
      if (M.target && M.target.alive) { const tp = this.v.copy(M.target.pos); tp.y += M.target.mech.height * 0.45; const want = tp.sub(p).normalize().multiplyScalar(36); M.vel.lerp(want, Math.min(1, dt * (M.t < 0.25 ? 1 : 4.5))); }
      else M.vel.y -= 9 * dt;
      p.addScaledVector(M.vel, dt); M.m.lookAt(p.x + M.vel.x, p.y + M.vel.y, p.z + M.vel.z);
      // fire + thick smoke trail
      const back = this.v.copy(M.vel).normalize().multiplyScalar(-0.6).add(p);
      this.fire.spawn({ pos: back, vel: { x: -M.vel.x * 0.15, y: -M.vel.y * 0.15, z: -M.vel.z * 0.15 }, size: 1.5, size1: 0.3, life: 0.22, r: 3.2, g: 1.5, b: 0.4, alpha: 1, rv: 4 }); this.glow.spawn({ pos: p, size: 1.8, size1: 0.4, life: 0.06, r: 3, g: 2, b: 1.1, alpha: 1 });
      if (Math.random() < 0.95) this.smoke.spawn({ pos: back, vel: { x: (Math.random() - 0.5), y: 0.6, z: (Math.random() - 0.5) }, size: 0.7, size1: 3.2, life: 1.3 * Math.max(0.6, this.k), r: 0.8, g: 0.8, b: 0.8, alpha: 0.55, drag: 1, rv: 1 });
      const gh = world.height(p.x, p.z); let hit = p.y < Math.max(gh, -0.5) + 0.2 || M.t > 5;
      if (!hit && M.target && M.target.alive) { const tp = M.target.pos; const dx = tp.x - p.x, dz = tp.z - p.z, dy = (tp.y + M.target.mech.height * 0.45) - p.y; if (dx * dx + dz * dz + dy * dy < (M.target.radius + 0.8) ** 2) hit = true; }
      if (hit) { this.boom(p, 0.85, { groundY: gh }); this.sfx.boom(0.8); onMissileHit(M, p.clone()); this.scene.remove(M.m); this.missiles.splice(i, 1); }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t += dt; const k = r.t / 0.5; r.m.scale.setScalar(1 + k * r.R); r.m.material.opacity = 1 - k; if (k >= 1) { this.scene.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); } }
    for (let i = this.waves.length - 1; i >= 0; i--) { const w = this.waves[i]; w.t += dt; if (w.t < 0) continue; const k = w.t / 0.6;
      w.m.scale.setScalar((1 + k * 9) * w.s); w.m.position.addScaledVector(w.dir, dt * 22 * w.s); w.m.material.opacity = Math.max(0, 0.32 * (1 - k) * Math.min(1, k * 4));
      if (k >= 1) { this.scene.remove(w.m); w.m.material.dispose(); this.waves.splice(i, 1); } }
    // generic timed emitters
    for (let i = this.em.length - 1; i >= 0; i--) { const E = this.em[i]; E.t += dt; E.fn(dt, E.t, E.dur); if (E.t >= E.dur) this.em.splice(i, 1); }
    // flaming debris with trails
    for (let i = this.debris.length - 1; i >= 0; i--) { const D = this.debris[i]; D.t += dt; D.v.y -= 26 * dt; D.p.addScaledVector(D.v, dt);
      if (Math.random() < 0.9) this.fire.spawn({ pos: D.p, size: 0.9 * D.s, size1: 0.2, life: 0.3, r: 3, g: 1.3, b: 0.3, alpha: 1, rv: 3 });
      if (Math.random() < 0.5 * this.k) this.smoke.spawn({ pos: D.p, size: 0.5 * D.s, size1: 2.2 * D.s, life: 1, r: 0.15, g: 0.14, b: 0.13, alpha: 0.5, drag: 0.8, rv: 1 });
      const gh = world ? world.height(D.p.x, D.p.z) : -99;
      if (D.p.y < gh || D.t > D.life) { if (D.p.y < gh + 1) { D.p.y = gh + 0.2; this.sparks(D.p, 4, undefined, 0.5); this.fire.spawn({ pos: D.p, vel: { x: 0, y: 3, z: 0 }, size: 1.6 * D.s, size1: 0.3, life: 0.6, r: 3, g: 1.2, b: 0.3, alpha: 0.9 }); } this.debris.splice(i, 1); } }
    for (const S of this.scorches) if (S.m.visible) { S.t += dt; S.m.material.opacity = 0.7 * Math.min(1, S.t * 6) * Math.max(0, 1 - Math.max(0, S.t - 10) / 4); if (S.t > 14) S.m.visible = false; }
    for (let i = this.warns.length - 1; i >= 0; i--) { const w = this.warns[i]; w.t += dt; const u = w.t / w.dur, pl = 0.5 + 0.5 * Math.sin(w.t * (8 + u * 18));
      w.m.material.opacity = 0.45 + 0.5 * pl; w.f.material.opacity = 0.08 + 0.25 * u; w.f.scale.setScalar(Math.min(1, u)); if (w.t >= w.dur || w.dead) { this.scene.remove(w.m); w.m.material.dispose(); w.f.material.dispose(); this.warns.splice(i, 1); } }
    for (let i = this.zaps.length - 1; i >= 0; i--) { const z = this.zaps[i]; z.t += dt; z.m.visible = z.t < z.life && (z.t < 0.05 || Math.random() < 0.8); if (z.t >= z.life) { this.scene.remove(z.m); z.m.geometry.dispose(); this.zaps.splice(i, 1); } }
    this.light.intensity *= Math.max(0, 1 - dt * 7);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.smoke.update(dt, fog); this.glow.update(dt, fog); this.fire.update(dt, fog);
  }
}
