// v5.9.1 Triceratops. Meshy model from the approved concept, rigged in this game.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneTrike } from './models.js';

const RIM = (shader) => {
  shader.uniforms.uCharge = { value: 0 };
  // Keep the leaf green and the red-and-yellow frill. A charge adds a warm rim on the shield.
  shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
    #include <color_fragment>
    float luma = dot(diffuseColor.rgb, vec3(0.30, 0.59, 0.11));
    float warm = smoothstep(0.04, 0.22, diffuseColor.r - diffuseColor.g);
    vec3 rich = diffuseColor.rgb * vec3(0.90, 1.06, 0.86);
    float keep = max(warm, smoothstep(0.55, 0.85, luma));
    diffuseColor.rgb = mix(rich, diffuseColor.rgb, keep);
    diffuseColor.rgb += vec3(1.05, 0.38, 0.06) * uCharge * warm;`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `
    float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
    outgoingLight += vec3(0.25, 0.55, 0.18) * rim * 0.10;
    outgoingLight += vec3(1.15, 0.42, 0.08) * uCharge * rim * 0.32;
    #include <output_fragment>`);
  shader.fragmentShader = 'uniform float uCharge;\n' + shader.fragmentShader;
  return shader.uniforms.uCharge;
};

export class TrikeMech {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = true; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.jaw = 0;
    this.skinned = true; this._clip = 'Idle';
    const obj = this.obj = new THREE.Group(); obj.name = 'trike-3d';
    const { scene, animations } = cloneTrike();
    const rig = this.rig = new THREE.Group(); obj.add(rig); rig.add(scene);
    const bones = {};
    const meshes = [];
    const charge = { value: 0 };
    this.charge = charge;
    scene.traverse(o => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; o.raycast = () => {};
        meshes.push(o);
        const mats = [].concat(o.material);
        for (const m of mats) {
          if (!m) continue;
          if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
          m.roughness = 0.62; m.metalness = 0.0; m.envMapIntensity = 0.4;
          m.emissive = new THREE.Color(0x143010); m.emissiveIntensity = 0.05;
          m.onBeforeCompile = (shader) => { const u = RIM(shader); if (u) u.value = charge.value; shader.uniforms.uCharge = charge; };
        }
      }
    });
    this.bones = bones; this.meshes = meshes; this.skin = meshes[0];
    const attr0 = this.skin.geometry.attributes.position;
    const backIds = [];
    let hipY = -Infinity, footY = Infinity, frillTip = 0;
    for (let i = 0; i < attr0.count; i++) {
      const x = attr0.getX(i), y = attr0.getY(i), z = attr0.getZ(i);
      if (y < footY) footY = y;
      if (y > attr0.getY(frillTip)) frillTip = i;
      if (z > -0.08 && z < 0.08 && Math.abs(x) < 0.08 && y > hipY) hipY = y;
      // The saddle: the back hide just behind the frill, not the shield itself.
      if (z > 0.24 && z < 0.36 && y > 0.06 && y < 0.22 && Math.abs(x) < 0.10) backIds.push(i);
    }
    this._backIds = backIds;
    this._frillTip = frillTip;
    this.b = { pelvis: bones.hips, chest: bones.chest, neck: bones.neck, head: bones.head, jaw: bones.jaw };
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    // Hip hump to the soles. This puts the hips at 3.5 m. Length and frill follow the sculpt.
    const s = 3.5 / Math.max(hipY - footY, 0.001);
    rig.scale.setScalar(s);
    box.setFromObject(rig);
    rig.position.y -= box.min.y;
    this.modelScale = s;

    this.mouth = new THREE.Group(); this.mouth.name = 'trike-mouth';
    this.mouth.position.set(0, 0.02, 0.10); (bones.jaw || bones.head).add(this.mouth);
    this.seat = new THREE.Group(); this.seat.name = 'trike-seat';
    (bones.chest || bones.spine).add(this.seat);
    this.seatOnBack();
    this.body = new THREE.Group(); this.body.name = 'trike-body'; bones.chest.add(this.body);
    this.legs = [bones.l_foot, bones.r_foot, bones.l_hand, bones.r_hand].map(g => ({ g: g || new THREE.Group() }));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; obj.add(shadow); this.shadow = shadow;

    this.mixer = new THREE.AnimationMixer(scene);
    this.actions = {};
    for (const clip of animations) {
      const act = this.mixer.clipAction(clip);
      act.play();
      act.setEffectiveWeight(clip.name === 'Idle' ? 1 : 0);
      this.actions[clip.name] = act;
    }
    const mat = meshes[0] && meshes[0].material;
    this.mats = { plate: mat, glowColor: new THREE.Color(0xc8e060) };
    this.height = size.y * s;
    this.fitR = Math.max(size.x, size.z) * s * 0.48;
    this.sockets = { mouth: this.mouth };
  }
  groundNormal(x, z, yaw, heightAt, out) {
    const fX = Math.sin(yaw), fZ = Math.cos(yaw), sX = fZ, sZ = -fX, d = 2.4;
    const dz = (heightAt(x + fX * d, z + fZ * d) - heightAt(x - fX * d, z - fZ * d)) / (2 * d);
    const dx = (heightAt(x + sX * d, z + sZ * d) - heightAt(x - sX * d, z - sZ * d)) / (2 * d);
    return out.set(-dx * sX - dz * fX, 1, -dx * sZ - dz * fZ).normalize();
  }
  seatOnGround(heightAt) {
    const sk = this.skin;
    if (!sk || !heightAt) return 0;
    this.obj.updateMatrixWorld(true);
    const attr = sk.geometry.attributes.position;
    const v = this._seatV || (this._seatV = new THREE.Vector3());
    let lift = -Infinity;
    for (let i = 0; i < attr.count; i += 4) {
      sk.getVertexPosition(i, v);
      v.applyMatrix4(sk.matrixWorld);
      const pen = heightAt(v.x, v.z) - v.y;
      if (pen > lift) lift = pen;
    }
    if (lift > -Infinity) this.obj.position.y += lift;
    return lift;
  }
  // Crown of the back hide just behind the frill, on the posed mesh. A vertical ray here can hit the frill first.
  backHide(out = new THREE.Vector3()) {
    const sk = this.skin, ids = this._backIds, chest = this.bones.chest;
    if (!sk || !ids || !ids.length) return null;
    this.obj.updateMatrixWorld(true);
    const v = this._hideV || (this._hideV = new THREE.Vector3());
    const local = this._hideL || (this._hideL = new THREE.Vector3());
    let best = -Infinity, any = -Infinity;
    const anyPt = this._hideAny || (this._hideAny = new THREE.Vector3());
    for (let k = 0; k < ids.length; k++) {
      sk.getVertexPosition(ids[k], v);
      v.applyMatrix4(sk.matrixWorld);
      if (v.y > any) { any = v.y; anyPt.copy(v); }
      if (!chest) continue;
      local.copy(v);
      chest.worldToLocal(local);
      if (Math.abs(local.x) > 0.08) continue;
      if (local.y > best) { best = local.y; out.copy(v); }
    }
    if (best === -Infinity) { if (any === -Infinity) return null; out.copy(anyPt); }
    return out;
  }
  frillTop(out = new THREE.Vector3()) {
    const sk = this.skin;
    if (!sk) return null;
    this.obj.updateMatrixWorld(true);
    sk.getVertexPosition(this._frillTip || 0, out);
    return out.applyMatrix4(sk.matrixWorld);
  }
  // Follows the chest bone. The anchor is the skinned back, not the frill.
  seatOnBack() {
    const chest = this.bones.chest || this.bones.spine;
    const hit = this.backHide(this._backHit || (this._backHit = new THREE.Vector3()));
    if (!chest || !hit) { if (this.seat) this.seat.position.set(0, 0.12, 0.02); return; }
    const local = chest.worldToLocal(hit.clone());
    local.y += 0.008;
    this.seat.position.copy(local);
  }
  socketPos(name, out) { const s = (name && this.sockets[name]) || this.mouth; return s.getWorldPosition(out); }
  footPos(i, out) { return this.legs[i % this.legs.length].g.getWorldPosition(out); }
  dispose() { this.mixer.stopAllAction(); }
  play(name, loop, scale) {
    const next = this.actions[name]; if (!next) return;
    const fresh = this._clip !== name;
    if (fresh) {
      next.reset();
      next.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
      next.clampWhenFinished = !loop;
      next.play();
      this._clip = name;
    }
    next.timeScale = scale;
    for (const [n, act] of Object.entries(this.actions)) {
      const target = n === name ? 1 : 0;
      act.setEffectiveWeight(fresh || !loop ? target : act.getEffectiveWeight() * 0.62 + target * 0.38);
    }
    return next;
  }
  cycleDist(name) {
    const leg = 0.46 * this.modelScale;
    const amp = name === 'Run' ? 29 : 21;
    return 4 * leg * Math.sin(amp * Math.PI / 180);
  }
  animate(dt, speed, o = {}) {
    this.t += dt;
    const roar = Math.max(o.roar || 0, this.roar || 0);
    const charge = o.charge || 0;
    const bite = Math.max(o.bite || 0, (o.jaw || 0) > 0.45 && roar < 0.15 && charge < 0.12 ? o.jaw : 0);
    let name = 'Idle', loop = true, scale = 1;
    if (this.ko > 0.2) { name = 'Idle'; loop = true; }
    else if (charge > 0.12) { name = 'Charge'; loop = false; }
    else if (roar > 0.25) { name = 'Roar'; loop = false; }
    else if (speed > 9) { name = 'Run'; scale = Math.max(0.4, speed / this.cycleDist('Run') * 0.5); }
    else if (speed > 0.45) { name = 'Walk'; scale = Math.max(0.4, speed / this.cycleDist('Walk') * 0.85); }
    const act = this.play(name, loop, scale);
    this.mixer.update(dt);
    if (name !== 'Charge' && name !== 'Roar' && bite > 0.25 && this.bones.jaw) this.bones.jaw.rotation.x = Math.min(0.35, bite * 0.35);
    if (act && act.getClip()) this.phase = (act.time / act.getClip().duration) * Math.PI * 2;
    this.jaw = Math.max(0, (this.jaw || 0) - dt * 1.6);
    this.roar = Math.max(0, (this.roar || 0) - dt);
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this.charge) this.charge.value = Math.max(charge, this.flash * 0.35);
    const plate = this.mats.plate;
    if (plate && plate.emissive) plate.emissive.setRGB(0.05 + charge * 0.45, 0.12 + charge * 0.18, 0.04);
    this.seatOnBack();
  }
}
