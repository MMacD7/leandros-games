// v5.9.4 Ankylosaurus. Meshy model from the approved concept, rigged in this game.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneAnky } from './models.js';

const RIM = (shader) => {
  shader.uniforms.uSmash = { value: 0 };
  // Keep the orange plates and the cream belly. A smash adds an amber rim.
  shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
    #include <color_fragment>
    float luma = dot(diffuseColor.rgb, vec3(0.30, 0.59, 0.11));
    float orange = smoothstep(0.02, 0.22, diffuseColor.r - diffuseColor.b);
    vec3 rich = diffuseColor.rgb * vec3(1.08, 0.96, 0.82);
    diffuseColor.rgb = mix(diffuseColor.rgb, rich, max(orange, smoothstep(0.55, 0.86, luma)));
    diffuseColor.rgb += vec3(1.15, 0.42, 0.06) * uSmash * orange;`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `
    float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
    outgoingLight += vec3(0.85, 0.42, 0.12) * rim * 0.10;
    outgoingLight += vec3(1.2, 0.48, 0.08) * uSmash * rim * 0.36;
    #include <output_fragment>`);
  shader.fragmentShader = 'uniform float uSmash;\n' + shader.fragmentShader;
  return shader.uniforms.uSmash;
};

export class AnkyMech {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = true; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.jaw = 0;
    this.skinned = true; this._clip = 'Idle';
    const obj = this.obj = new THREE.Group(); obj.name = 'anky-3d';
    const { scene, animations } = cloneAnky();
    const rig = this.rig = new THREE.Group(); obj.add(rig); rig.add(scene);
    const bones = {};
    const meshes = [];
    const smash = { value: 0 };
    this.smash = smash;
    scene.traverse(o => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; o.raycast = () => {};
        meshes.push(o);
        const mats = [].concat(o.material);
        for (const m of mats) {
          if (!m) continue;
          if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
          m.roughness = 0.66; m.metalness = 0.0; m.envMapIntensity = 0.38;
          m.emissive = new THREE.Color(0x3a2010); m.emissiveIntensity = 0.05;
          m.onBeforeCompile = (shader) => { const u = RIM(shader); if (u) u.value = smash.value; shader.uniforms.uSmash = smash; };
        }
      }
    });
    this.bones = bones; this.meshes = meshes; this.skin = meshes[0];
    const attr0 = this.skin.geometry.attributes.position;
    const backIds = [];
    let hipY = -Infinity, footY = Infinity, shellTip = 0;
    const box0 = new THREE.Box3();
    const tmp = new THREE.Vector3();
    for (let i = 0; i < attr0.count; i++) {
      const x = attr0.getX(i), y = attr0.getY(i), z = attr0.getZ(i);
      box0.expandByPoint(tmp.set(x, y, z));
      if (y < footY) footY = y;
      if (y > attr0.getY(shellTip)) shellTip = i;
      if (z > -0.08 && z < 0.10 && Math.abs(x) < 0.07 && y > hipY) hipY = y;
      // Middle of the back armor, under the tallest spike tips.
      if (z > -0.06 && z < 0.16 && y > 0.16 && y < 0.32 && Math.abs(x) < 0.08) backIds.push(i);
    }
    this._backIds = backIds;
    this._shellTip = shellTip;
    this.b = { pelvis: bones.hips, chest: bones.chest, neck: bones.neck, head: bones.head, jaw: bones.jaw };
    const size = box0.getSize(new THREE.Vector3());
    // Low, long and wide. Hips about 2.35 m, length about 8 m, width about 3 m.
    const sy = 2.35 / Math.max(hipY - footY, 0.001);
    const sx = 3.16 / Math.max(size.x, 0.001);
    const sz = 8.43 / Math.max(size.z, 0.001);
    rig.scale.set(sx, sy, sz);
    const box = new THREE.Box3().setFromObject(rig);
    rig.position.y -= box.min.y;
    this.modelScale = sy;
    this.scale3 = { x: sx, y: sy, z: sz };

    this.mouth = new THREE.Group(); this.mouth.name = 'anky-mouth';
    this.mouth.position.set(0, 0.02, 0.08); (bones.jaw || bones.head).add(this.mouth);
    this.seat = new THREE.Group(); this.seat.name = 'anky-seat';
    (bones.spine || bones.chest).add(this.seat);
    this.seatOnBack();
    this.body = new THREE.Group(); this.body.name = 'anky-body'; bones.spine.add(this.body);
    this.legs = [bones.l_foot, bones.r_foot, bones.l_hand, bones.r_hand].map(g => ({ g: g || new THREE.Group() }));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.8, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
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
    this.mats = { plate: mat, glowColor: new THREE.Color(0xffb14a) };
    this.height = size.y * sy;
    this.fitR = Math.max(size.x * sx, size.z * sz) * 0.42;
    this.sockets = { mouth: this.mouth };
  }
  groundNormal(x, z, yaw, heightAt, out) {
    const fX = Math.sin(yaw), fZ = Math.cos(yaw), sX = fZ, sZ = -fX, d = 2.6;
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
  // Crown of the back armor, on the posed mesh, ignoring the side spikes.
  backHide(out = new THREE.Vector3()) {
    const sk = this.skin, ids = this._backIds, spine = this.bones.spine || this.bones.chest;
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
      if (!spine) continue;
      local.copy(v);
      spine.worldToLocal(local);
      if (Math.abs(local.x) > 0.08) continue;
      if (local.y > best) { best = local.y; out.copy(v); }
    }
    if (best === -Infinity) { if (any === -Infinity) return null; out.copy(anyPt); }
    return out;
  }
  shellTop(out = new THREE.Vector3()) {
    const sk = this.skin;
    if (!sk) return null;
    this.obj.updateMatrixWorld(true);
    sk.getVertexPosition(this._shellTip || 0, out);
    return out.applyMatrix4(sk.matrixWorld);
  }
  seatOnBack() {
    const spine = this.bones.spine || this.bones.chest;
    const hit = this.backHide(this._backHit || (this._backHit = new THREE.Vector3()));
    if (!spine || !hit) { if (this.seat) this.seat.position.set(0, 0.16, 0); return; }
    const local = spine.worldToLocal(hit.clone());
    local.y += 0.006;
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
    const leg = 0.34 * this.modelScale;
    const amp = name === 'Run' ? 24 : 18;
    return 4 * leg * Math.sin(amp * Math.PI / 180);
  }
  animate(dt, speed, o = {}) {
    this.t += dt;
    const roar = Math.max(o.roar || 0, this.roar || 0);
    const smash = o.smash || 0;
    const bite = Math.max(o.bite || 0, (o.jaw || 0) > 0.45 && roar < 0.15 && smash < 0.12 ? o.jaw : 0);
    let name = 'Idle', loop = true, scale = 1;
    if (this.ko > 0.2) { name = 'Idle'; loop = true; }
    else if (smash > 0.12) { name = 'Smash'; loop = false; }
    else if (roar > 0.25) { name = 'Roar'; loop = false; }
    else if (speed > 5.5) { name = 'Run'; scale = Math.max(0.45, speed / this.cycleDist('Run') * 0.7); }
    else if (speed > 0.4) { name = 'Walk'; scale = Math.max(0.4, speed / this.cycleDist('Walk') * 0.85); }
    const act = this.play(name, loop, scale);
    this.mixer.update(dt);
    if (name !== 'Smash' && name !== 'Roar' && bite > 0.25 && this.bones.jaw) this.bones.jaw.rotation.x = Math.min(0.32, bite * 0.32);
    if (act && act.getClip()) this.phase = (act.time / act.getClip().duration) * Math.PI * 2;
    this.jaw = Math.max(0, (this.jaw || 0) - dt * 1.6);
    this.roar = Math.max(0, (this.roar || 0) - dt);
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this.smash) this.smash.value = Math.max(smash, this.flash * 0.35);
    const plate = this.mats.plate;
    if (plate && plate.emissive) plate.emissive.setRGB(0.16 + smash * 0.55, 0.06 + smash * 0.12, 0.02);
    this.seatOnBack();
  }
}
