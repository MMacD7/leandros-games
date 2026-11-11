// v5.9.3 Velociraptor. Meshy model from the approved concept, rigged in this game.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneRaptor } from './models.js';

const RIM = (shader) => {
  shader.uniforms.uPounce = { value: 0 };
  // Keep the tan hide and the blue feathers. A pounce adds a blue rim.
  shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
    #include <color_fragment>
    float luma = dot(diffuseColor.rgb, vec3(0.30, 0.59, 0.11));
    float blue = smoothstep(0.04, 0.2, diffuseColor.b - diffuseColor.r);
    vec3 warm = diffuseColor.rgb * vec3(1.06, 0.98, 0.88);
    diffuseColor.rgb = mix(warm, diffuseColor.rgb * vec3(0.9, 0.95, 1.08), max(blue, smoothstep(0.62, 0.85, luma)));
    diffuseColor.rgb += vec3(0.15, 0.35, 1.1) * uPounce * blue;`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `
    float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
    outgoingLight += vec3(0.25, 0.45, 0.9) * rim * 0.1;
    outgoingLight += vec3(0.2, 0.45, 1.2) * uPounce * rim * 0.4;
    #include <output_fragment>`);
  shader.fragmentShader = 'uniform float uPounce;\n' + shader.fragmentShader;
  return shader.uniforms.uPounce;
};

export class RaptorMech {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = false; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.jaw = 0;
    this.skinned = true; this._clip = 'Idle';
    const obj = this.obj = new THREE.Group(); obj.name = 'raptor-3d';
    const { scene, animations } = cloneRaptor();
    const rig = this.rig = new THREE.Group(); obj.add(rig); rig.add(scene);
    const bones = {};
    const meshes = [];
    const pounce = { value: 0 };
    this.pounce = pounce;
    scene.traverse(o => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; o.raycast = () => {};
        meshes.push(o);
        const mats = [].concat(o.material);
        for (const m of mats) {
          if (!m) continue;
          if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
          m.roughness = 0.58; m.metalness = 0.0; m.envMapIntensity = 0.4;
          m.emissive = new THREE.Color(0x1a2438); m.emissiveIntensity = 0.05;
          m.onBeforeCompile = (shader) => { const u = RIM(shader); if (u) u.value = pounce.value; shader.uniforms.uPounce = pounce; };
        }
      }
    });
    this.bones = bones; this.meshes = meshes; this.skin = meshes[0];
    const attr0 = this.skin.geometry.attributes.position;
    const backIds = [];
    let hipY = -Infinity, footY = Infinity, headTip = 0;
    for (let i = 0; i < attr0.count; i++) {
      const x = attr0.getX(i), y = attr0.getY(i), z = attr0.getZ(i);
      if (y < footY) footY = y;
      if (y > attr0.getY(headTip)) headTip = i;
      if (z > -0.02 && z < 0.16 && Math.abs(x) < 0.08 && y > hipY) hipY = y;
      // The saddle: the back just behind the shoulders, not the neck.
      if (z > 0.08 && z < 0.22 && y > 0.02 && y < 0.24 && Math.abs(x) < 0.09) backIds.push(i);
    }
    this._backIds = backIds;
    this._headTip = headTip;
    this.b = { pelvis: bones.hips, chest: bones.chest, neck: bones.neck, head: bones.head, jaw: bones.jaw };
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    // Hip hump to the soles. Length and the head follow the sculpt.
    const s = 2.6 / Math.max(hipY - footY, 0.001);
    rig.scale.setScalar(s);
    box.setFromObject(rig);
    rig.position.y -= box.min.y;
    this.modelScale = s;

    this.mouth = new THREE.Group(); this.mouth.name = 'raptor-mouth';
    this.mouth.position.set(0, -0.02, 0.12); (bones.jaw || bones.head).add(this.mouth);
    this.seat = new THREE.Group(); this.seat.name = 'raptor-seat';
    (bones.spine || bones.chest).add(this.seat);
    this.seatOnBack();
    this.body = new THREE.Group(); this.body.name = 'raptor-body'; bones.chest.add(this.body);
    this.legs = [bones.l_foot, bones.r_foot].map(g => ({ g: g || new THREE.Group() }));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
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
    this.mats = { plate: mat, glowColor: new THREE.Color(0x4aa0ff) };
    this.height = size.y * s;
    this.fitR = Math.max(size.x, size.z) * s * 0.48;
    this.sockets = { mouth: this.mouth };
  }
  groundNormal(x, z, yaw, heightAt, out) {
    const fX = Math.sin(yaw), fZ = Math.cos(yaw), sX = fZ, sZ = -fX, d = 2.3;
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
    // Plant a foot that clips the ground, and settle a walking stance. A real leap (feet well clear) stays in the air.
    if (lift > -0.35) this.obj.position.y += lift;
    return lift;
  }
  // Crown of the back just behind the shoulders, on the posed mesh.
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
      if (Math.abs(local.x) > 0.07) continue;
      if (local.y > best) { best = local.y; out.copy(v); }
    }
    if (best === -Infinity) { if (any === -Infinity) return null; out.copy(anyPt); }
    return out;
  }
  headTop(out = new THREE.Vector3()) {
    const sk = this.skin;
    if (!sk) return null;
    this.obj.updateMatrixWorld(true);
    sk.getVertexPosition(this._headTip || 0, out);
    return out.applyMatrix4(sk.matrixWorld);
  }
  seatOnBack() {
    const spine = this.bones.spine || this.bones.chest;
    const hit = this.backHide(this._backHit || (this._backHit = new THREE.Vector3()));
    if (!spine || !hit) { if (this.seat) this.seat.position.set(0, 0.14, 0); return; }
    const local = spine.worldToLocal(hit.clone());
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
    const leg = 0.58 * this.modelScale;
    const amp = name === 'Run' ? 33 : 22;
    return 4 * leg * Math.sin(amp * Math.PI / 180) * (name === 'Run' ? 0.72 : 1);
  }
  animate(dt, speed, o = {}) {
    this.t += dt;
    const roar = Math.max(o.roar || 0, this.roar || 0);
    const pounce = o.pounce || 0;
    const bite = Math.max(o.bite || 0, (o.jaw || 0) > 0.45 && roar < 0.15 && pounce < 0.12 ? o.jaw : 0);
    let name = 'Idle', loop = true, scale = 1;
    if (this.ko > 0.2) { name = 'Idle'; loop = true; }
    else if (pounce > 0.12) { name = 'Pounce'; loop = false; }
    else if (roar > 0.25) { name = 'Roar'; loop = false; }
    else if (speed > 8) { name = 'Run'; scale = Math.max(0.7, speed / this.cycleDist('Run') * 0.7); }
    else if (speed > 0.4) { name = 'Walk'; scale = Math.max(0.5, speed / this.cycleDist('Walk') * 0.95); }
    const act = this.play(name, loop, scale);
    this.mixer.update(dt);
    if (name !== 'Pounce' && name !== 'Roar' && bite > 0.25 && this.bones.jaw) this.bones.jaw.rotation.x = Math.min(0.35, bite * 0.35);
    if (act && act.getClip()) this.phase = (act.time / act.getClip().duration) * Math.PI * 2;
    this.jaw = Math.max(0, (this.jaw || 0) - dt * 1.6);
    this.roar = Math.max(0, (this.roar || 0) - dt);
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this.pounce) this.pounce.value = Math.max(pounce, this.flash * 0.4);
    const plate = this.mats.plate;
    if (plate && plate.emissive) plate.emissive.setRGB(0.05, 0.08 + pounce * 0.15, 0.16 + pounce * 0.55);
    this.seatOnBack();
  }
}
