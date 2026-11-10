// v5.8.8 Brachiosaurus. Meshy model from the approved concept, rigged in this game.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneBrachio } from './models.js';

const RIM = (shader) => {
  // Deepen the teal hide. Leave the bright cream belly and orange crest alone.
  shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
    #include <color_fragment>
    float luma = dot(diffuseColor.rgb, vec3(0.30, 0.59, 0.11));
    float warm = smoothstep(0.05, 0.28, diffuseColor.r - max(diffuseColor.g, diffuseColor.b));
    vec3 deep = pow(diffuseColor.rgb, vec3(1.35)) * vec3(0.62, 0.92, 0.86);
    float keep = max(smoothstep(0.42, 0.78, luma), warm);
    diffuseColor.rgb = mix(deep, diffuseColor.rgb * vec3(1.06, 1.02, 0.94), keep);`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `
    float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
    outgoingLight += vec3(0.95, 0.42, 0.12) * rim * 0.18;
    #include <output_fragment>`);
};

export class BrachioMech {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = true; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.jaw = 0;
    this.skinned = true; this._clip = 'Idle';
    const obj = this.obj = new THREE.Group(); obj.name = 'brachio-3d';
    const { scene, animations } = cloneBrachio();
    const rig = this.rig = new THREE.Group(); obj.add(rig); rig.add(scene);
    const bones = {};
    const meshes = [];
    scene.traverse(o => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; o.raycast = () => {};
        meshes.push(o);
        const mats = [].concat(o.material);
        for (const m of mats) {
          if (!m) continue;
          if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
          m.roughness = 0.72; m.metalness = 0.0; m.envMapIntensity = 0.32;
          m.emissive = new THREE.Color(0x042e34); m.emissiveIntensity = 0.04;
          m.onBeforeCompile = RIM;
        }
      }
    });
    this.bones = bones; this.meshes = meshes; this.skin = meshes[0];
    this.b = { pelvis: bones.hips, chest: bones.chest, neck: bones.neck0, head: bones.head, jaw: bones.jaw };
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    // Head at the top of the mesh. 11 m is about 1.8x the 6 m T-Rex.
    const s = 11 / Math.max(size.y, 0.001);
    rig.scale.setScalar(s);
    box.setFromObject(rig);
    rig.position.y -= box.min.y;
    this.modelScale = s;

    this.mouth = new THREE.Group(); this.mouth.name = 'brachio-mouth';
    this.mouth.position.set(0, -0.04, 0.08); (bones.jaw || bones.head).add(this.mouth);
    this.seat = new THREE.Group(); this.seat.name = 'brachio-seat';
    (bones.chest || bones.neck0).add(this.seat);
    this.seatOnBack();
    this.body = new THREE.Group(); this.body.name = 'brachio-body'; bones.chest.add(this.body);
    this.legs = [bones.fl_foot, bones.fr_foot, bones.bl_foot, bones.br_foot].map(g => ({ g: g || new THREE.Group() }));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; obj.add(shadow); this.shadow = shadow;

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
    this.height = size.y * s;
    this.fitR = Math.max(size.x, size.z) * s * 0.55;
    this.sockets = { mouth: this.mouth };
  }
  groundNormal(x, z, yaw, heightAt, out) {
    const fX = Math.sin(yaw), fZ = Math.cos(yaw), sX = fZ, sZ = -fX, d = 3.4;
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
  surfaceY(x, z) {
    this.obj.updateMatrixWorld(true);
    for (const m of this.meshes) delete m.raycast;
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 40, z), new THREE.Vector3(0, -1, 0), 0, 80);
    const hits = ray.intersectObjects(this.meshes, false);
    for (const m of this.meshes) m.raycast = () => {};
    if (!hits.length) return null;
    let top = -Infinity;
    for (const h of hits) if (h.point.y > top) top = h.point.y;
    return top;
  }
  // On the withers, just in front of the shoulders, in the chest's own frame.
  seatOnBack() {
    this.obj.updateMatrixWorld(true);
    const chest = this.bones.chest;
    const origin = new THREE.Vector3();
    chest.getWorldPosition(origin);
    let best = null;
    for (const lz of [-0.08, 0.0, 0.06]) {
      for (const lx of [-0.04, 0, 0.04]) {
        const probe = new THREE.Vector3(lx, 0.45, lz);
        chest.localToWorld(probe);
        const y = this.surfaceY(probe.x, probe.z);
        if (y == null || y > origin.y + 2.6) continue;
        const hit = new THREE.Vector3(probe.x, y, probe.z);
        if (!best || hit.y > best.y) best = hit;
      }
    }
    if (!best) { this.seat.position.set(0, 0.16, -0.08); return; }
    const local = chest.worldToLocal(best.clone());
    local.y += 0.03;
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
    const leg = 0.62 * this.modelScale;
    const amp = name === 'Run' ? 24 : 18;
    return 4 * leg * Math.sin(amp * Math.PI / 180);
  }
  animate(dt, speed, o = {}) {
    this.t += dt;
    const roar = Math.max(o.roar || 0, this.roar || 0);
    const rear = o.rear || 0;
    let name = 'Idle', loop = true, scale = 1;
    if (this.ko > 0.2) { name = 'Idle'; loop = true; }
    else if (rear > 0.08) { name = 'Stomp'; loop = false; }
    else if (roar > 0.25) { name = 'Roar'; loop = false; }
    else if (speed > 10) { name = 'Run'; scale = Math.max(0.35, speed / this.cycleDist('Run') * 0.72); }
    else if (speed > 0.4) { name = 'Walk'; scale = Math.max(0.35, speed / this.cycleDist('Walk') * 1.15); }
    const act = this.play(name, loop, scale);
    this.mixer.update(dt);
    if (act && act.getClip()) this.phase = (act.time / act.getClip().duration) * Math.PI * 2;
    this.jaw = Math.max(0, (this.jaw || 0) - dt * 1.6);
    this.roar = Math.max(0, (this.roar || 0) - dt);
    this.flash = Math.max(0, this.flash - dt * 4);
    const plate = this.mats.plate;
    if (plate && plate.emissive) plate.emissive.setRGB(0.04, 0.16 + this.flash * 0.4, 0.18);
  }
}
