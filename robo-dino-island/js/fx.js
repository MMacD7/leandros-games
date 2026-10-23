// GPU-instanced billboard particles (smoke, fire, sparks, laser streaks), missiles, shock rings, flash light.
import * as THREE from './vendor/three.bundle.min.js';

const VS = `
attribute vec4 iPos;   // xyz, size
attribute vec4 iCol;   // rgba
attribute vec4 iDir;   // xyz dir, w = streak length (0 = round billboard)
attribute float iRot;
varying vec2 vUv; varying vec4 vCol; varying float vDepth;
void main(){
  vUv = uv; vCol = iCol;
  vec4 mv = modelViewMatrix * vec4(iPos.xyz, 1.0);
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
varying vec2 vUv; varying vec4 vCol; varying float vDepth;
void main(){
  vec4 t = texture2D(map, vUv);
  vec4 c = vec4(vCol.rgb * mix(vec3(1.0), t.rgb, 0.0), t.a * vCol.a);
  float f = smoothstep(fogNear, fogFar, vDepth);
  if (additive > 0.5) c.rgb *= c.a * (1.0 - f); else c.rgb = mix(c.rgb, fogColor, f);
  gl_FragColor = c;
}`;

export class Particles {
  constructor(scene, max, map, additive) {
    this.max = max; this.p = []; this.additive = additive;
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
    if (this.p.length >= this.max) this.p.shift();
    const p = { x: o.pos.x, y: o.pos.y, z: o.pos.z, vx: o.vel ? o.vel.x : 0, vy: o.vel ? o.vel.y : 0, vz: o.vel ? o.vel.z : 0,
      life: o.life || 1, age: 0, s0: o.size ?? 1, s1: o.size1 ?? o.size ?? 1, r: o.r ?? 1, g: o.g ?? 1, b: o.b ?? 1, a0: o.alpha ?? 1, a1: o.alpha1 ?? 0,
      rot: o.rot ?? Math.random() * 6.28, rv: o.rv ?? 0, drag: o.drag ?? 0, grav: o.grav ?? 0, len: o.len || 0, fadeIn: o.fadeIn || 0, dir: o.dir || null };
    this.p.push(p); return p;
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
    this.smoke = new Particles(scene, 700, assets.smoke, false);
    this.glow = new Particles(scene, 900, assets.glow, true);
    this.fire = new Particles(scene, 400, assets.smoke, true);
    this.light = new THREE.PointLight(0xff9a40, 0, 40, 1.6); scene.add(this.light); this.lightT = 0;
    // pooled missile meshes
    const mg = new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8); mg.rotateX(Math.PI / 2);
    this.missileMat = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.7, roughness: 0.35 });
    this.missiles = []; this.mGeo = mg;
    this.rings = [];
    const rg = new THREE.RingGeometry(0.85, 1, 40); rg.rotateX(-Math.PI / 2); this.ringGeo = rg; this.ringGeoV = new THREE.RingGeometry(0.7, 1, 40); this.waves = [];
    this.shake = 0; this.v = new THREE.Vector3();
  }
  flash(pos, power = 1, color = 0xff9a40) { this.light.position.copy(pos); this.light.position.y += 2; this.light.color.set(color); this.light.intensity = Math.max(this.light.intensity, 180 * power); }
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
    n = Math.round(n * 1.5);
    for (let i = 0; i < n; i++) { const v = { x: (Math.random() - 0.5) * 18 * power, y: Math.random() * 12 * power + 2, z: (Math.random() - 0.5) * 18 * power };
      this.glow.spawn({ pos, vel: v, size: 0.13, life: 0.4 + Math.random() * 0.5, len: 0.85, r: col.r * 3.2, g: col.g * 3.2, b: col.b * 3.2, alpha: 1, alpha1: 0.2, grav: 22, drag: 1.3 }); }
    this.glow.spawn({ pos, size: 2.2 * power, size1: 3.4 * power, life: 0.16, r: col.r * 2.4, g: col.g * 2.4, b: col.b * 2.4, alpha: 0.95 });
  }
  explosion(pos, power = 1) {
    const P = power * 1.35;
    for (let i = 0; i < 16 * P; i++) { const v = { x: (Math.random() - 0.5) * 13, y: Math.random() * 9, z: (Math.random() - 0.5) * 13 };
      this.fire.spawn({ pos, vel: v, size: 3.2 * P, size1: 8 * P, life: 0.45 + Math.random() * 0.5, r: 3.2, g: 1.2 + Math.random() * 0.7, b: 0.3, alpha: 1, drag: 3, rv: (Math.random() - 0.5) * 3 }); }
    this.glow.spawn({ pos, size: 13 * P, size1: 17 * P, life: 0.2, r: 3, g: 2.4, b: 1.6, alpha: 1 });
    this.glow.spawn({ pos, size: 4 * P, size1: 1, life: 0.1, r: 4, g: 4, b: 4, alpha: 1 });
    for (let i = 0; i < 12 * P; i++) { const v = { x: (Math.random() - 0.5) * 7, y: 2 + Math.random() * 6, z: (Math.random() - 0.5) * 7 };
      const g = 0.12 + Math.random() * 0.12; this.smoke.spawn({ pos, vel: v, size: 3 * P, size1: 10 * P, life: 1.8 + Math.random(), r: g, g, b: g, alpha: 0.8, drag: 1.2, rv: (Math.random() - 0.5), fadeIn: 0.08 }); }
    // flaming debris chunks arcing out with smoke trails
    for (let i = 0; i < 7 * P; i++) { const v = { x: (Math.random() - 0.5) * 22, y: 8 + Math.random() * 10, z: (Math.random() - 0.5) * 22 };
      this.fire.spawn({ pos, vel: v, size: 0.9, size1: 0.3, life: 0.9 + Math.random() * 0.5, r: 3, g: 1.4, b: 0.4, alpha: 1, grav: 26, drag: 0.4 });
      this.glow.spawn({ pos, vel: v, size: 0.2, life: 0.9, len: 1.2, r: 3, g: 1.8, b: 0.6, alpha: 1, grav: 26, drag: 0.4 }); }
    this.sparks(pos, 22 * P, undefined, 1.6);
    this.ring(pos, 14 * P, 0xffb060); this.ring(pos, 7 * P, 0xffffff);
    this.flash(pos, P); this.shake = Math.max(this.shake, 0.6 * P);
  }
  dust(pos, n = 8, size = 2, radial = 6) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; const v = { x: Math.cos(a) * radial, y: 1 + Math.random() * 2, z: Math.sin(a) * radial };
      this.smoke.spawn({ pos, vel: v, size, size1: size * 2.8, life: 1.1, r: 0.62, g: 0.55, b: 0.42, alpha: 0.55, drag: 2.5, rv: (Math.random() - 0.5) }); }
  }
  ring(pos, radius, color) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.position.copy(pos); m.position.y += 0.4; this.scene.add(m); this.rings.push({ m, t: 0, R: radius });
  }
  launchMissile(from, dirInit, target, owner, dmg, col) {
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
      this.fire.spawn({ pos: p, size: 1.2, size1: 0.3, life: 0.15, r: 3, g: 1.6, b: 0.5, alpha: 1 }); this.glow.spawn({ pos: p, size: 1.4, size1: 0.4, life: 0.06, r: 2, g: 1.5, b: 1, alpha: 1 });
      if (Math.random() < 0.9) this.smoke.spawn({ pos: p, size: 0.6, size1: 2.4, life: 0.9, r: 0.85, g: 0.85, b: 0.85, alpha: 0.5, drag: 1, rv: 1 });
      const gh = world.height(p.x, p.z); let hit = p.y < Math.max(gh, -0.5) + 0.2 || M.t > 5;
      if (!hit && M.target && M.target.alive) { const tp = M.target.pos; const dx = tp.x - p.x, dz = tp.z - p.z, dy = (tp.y + M.target.mech.height * 0.45) - p.y; if (dx * dx + dz * dz + dy * dy < (M.target.radius + 0.8) ** 2) hit = true; }
      if (hit) { this.explosion(p, 0.8); this.sfx.boom(0.8); onMissileHit(M, p.clone()); this.scene.remove(M.m); this.missiles.splice(i, 1); }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t += dt; const k = r.t / 0.5; r.m.scale.setScalar(1 + k * r.R); r.m.material.opacity = 1 - k; if (k >= 1) { this.scene.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); } }
    for (let i = this.waves.length - 1; i >= 0; i--) { const w = this.waves[i]; w.t += dt; if (w.t < 0) continue; const k = w.t / 0.6;
      w.m.scale.setScalar((1 + k * 9) * w.s); w.m.position.addScaledVector(w.dir, dt * 22 * w.s); w.m.material.opacity = Math.max(0, 0.32 * (1 - k) * Math.min(1, k * 4));
      if (k >= 1) { this.scene.remove(w.m); w.m.material.dispose(); this.waves.splice(i, 1); } }
    this.light.intensity *= Math.max(0, 1 - dt * 9);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.smoke.update(dt, fog); this.glow.update(dt, fog); this.fire.update(dt, fog);
  }
}
