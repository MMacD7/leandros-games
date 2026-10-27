// v5.6 PERSONALITY DINOS: four original, non-robot wild dinos with their own behaviour, speech bubbles and sounds.
//   Grumbletop (grumpy)  - huffs steam, stamps and charges if you get close, then stomps off grumbling
//   Snoozadon (sleepy)   - snores with floating Zzz, yawns awake when bumped, shuffles about, nods off again
//   Strutasaurus (show-off) - struts up to you, spins, flashes its rainbow crest: "TA-DA!"
//   Quiverfoot (scaredy) - squeaks EEP! and runs away; trembles and sweats when it is cornered or hit
// They are part of g.enemies (so they can be bumped, smashed and KO'd like any wild dino) but never use the normal attack AI.
import * as THREE from './vendor/three.bundle.min.js';
import { sfx } from './audio.js';

const TEX = new Map();
function bubbleTex(text, col = '#ffffff') {
  const key = text + col; if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas'); c.width = 512; c.height = 224; const x = c.getContext('2d');
  x.fillStyle = col; x.strokeStyle = '#1a1a2a'; x.lineWidth = 10; const rr = (X, Y, W, H, R) => { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }; rr(14, 14, 484, 150, 60); x.fill(); x.stroke(); // (no roundRect: older iPads)
  x.beginPath(); x.moveTo(226, 160); x.lineTo(256, 212); x.lineTo(286, 160); x.closePath(); x.fill(); x.stroke(); x.fillRect(222, 150, 68, 14);
  let fs = 74; x.font = `900 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`; while (x.measureText(text).width > 440 && fs > 28) { fs -= 4; x.font = `900 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`; }
  x.fillStyle = '#1a1a2a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 92);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; TEX.set(key, t); return t;
}
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const COL = { grumpy: '#ffd8b0', sleepy: '#e4dcff', showoff: '#fff2a8', scaredy: '#d8f0ff' };

export class Personas {
  constructor(g) { this.g = g; this.bubs = []; this.n = { spawned: 0, bubbles: 0, huffs: 0, charges: 0, bumps: 0, snores: 0, yawns: 0, naps: 0, poses: 0, sulks: 0, flees: 0, trembles: 0, peeks: 0 }; this.log = []; }
  say(e, text, dur = 1.9) { const g = this.g; this.kill(e); const m = new THREE.SpriteMaterial({ map: bubbleTex(text, COL[e.def.persona]), transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    const s = new THREE.Sprite(m); s.renderOrder = 20; s.center.set(0.5, 0); g.scene.add(s); this.bubs.push({ e, s, t: 0, dur, text }); e.pzSaid = text; this.n.bubbles++; this.log.push(e.def.persona + ':' + text); if (this.log.length > 40) this.log.shift(); }
  kill(e) { for (let i = this.bubs.length - 1; i >= 0; i--) if (this.bubs[i].e === e) { const B = this.bubs[i]; B.s.removeFromParent(); B.s.material.dispose(); this.bubs.splice(i, 1); } }
  clear() { for (const B of this.bubs) { B.s.removeFromParent(); B.s.material.dispose(); } this.bubs.length = 0; }
  update(dt) { const cam = this.g.camera;
    for (let i = this.bubs.length - 1; i >= 0; i--) { const B = this.bubs[i], e = B.e; B.t += dt;
      if (B.t > B.dur || !e.alive || e.gone || !this.g.enemies.includes(e)) { B.s.removeFromParent(); B.s.material.dispose(); this.bubs.splice(i, 1); continue; }
      const sc = Math.min(1, B.t / 0.15) * (1 + 0.08 * Math.sin(B.t * 14) * Math.max(0, 1 - B.t * 2)), d = cam.position.distanceTo(e.pos), w = Math.max(4.2, Math.min(11, d * 0.11)) * sc;
      B.s.scale.set(w, w * 0.4375, 1); B.s.position.set(e.pos.x, e.pos.y + e.mech.height + 1.2 + Math.sin(B.t * 3) * 0.15, e.pos.z); B.s.material.opacity = Math.min(1, (B.dur - B.t) / 0.3); } }
  // called from Game.think for wild dinos that have a def.persona (instead of the attack AI)
  think(e, dt, p, dist, toP0, pAlive) {
    const g = this.g, fx = g.fx, P = e.pz || (e.pz = { mode: 'idle', t: 0, cd: 0.4 + Math.random() * 0.8, hp: e.hp, sndT: 0, sayT: 0, stuck: 0 }); P.t -= dt; P.cd -= dt; P.sndT -= dt; P.sayT -= dt;
    const toP = toP0.clone().setY(0), dir = toP.lengthSq() > 1e-4 ? toP.clone().normalize() : new THREE.Vector3(0, 0, 1), hurt = e.hp < P.hp - 0.5; P.hp = e.hp;
    const near = Math.max(0, 1 - dist / 60), face = (k = 4) => { e.yaw += Math.max(-k * dt, Math.min(k * dt, angDiff(e.yaw, Math.atan2(dir.x, dir.z)))); }, stand = () => e.move(dt, new THREE.Vector3(), 0, false);
    const wander = (sp) => { const ai = e.ai; if (!ai.wp || ai.t <= 0 || Math.hypot(ai.wp.x - e.pos.x, ai.wp.z - e.pos.z) < 4) { const a = Math.random() * 6.28; ai.wp = new THREE.Vector3(ai.home.x + Math.cos(a) * 25, 0, ai.home.z + Math.sin(a) * 25); ai.t = 8; }
      e.move(dt, new THREE.Vector3(ai.wp.x - e.pos.x, 0, ai.wp.z - e.pos.z).normalize(), sp, false); };
    const head = () => new THREE.Vector3(e.pos.x + Math.sin(e.yaw) * e.radius * 0.9, e.pos.y + e.mech.height * 0.85, e.pos.z + Math.cos(e.yaw) * e.radius * 0.9);
    const k = e.def.persona;
    if (k === 'grumpy') {
      if (hurt && P.mode !== 'charge') { P.mode = 'huff'; P.t = 0.7; P.cd = 0; this.say(e, 'HEY! 😠'); }
      if (P.mode === 'idle') { wander(0.3); if (pAlive && dist < 20 && P.cd <= 0) { P.mode = 'huff'; P.t = 1.1; this.n.huffs++; this.say(e, 'HMPH! 😤'); sfx.grumble(0.5 + near * 0.6); } }
      else if (P.mode === 'huff') { stand(); face(5); e.jaw = 0.3; if (Math.random() < dt * 14) fx.smoke.spawn({ pos: head(), vel: { x: (Math.random() - 0.5) * 2, y: 3 + Math.random() * 2, z: (Math.random() - 0.5) * 2 }, size: 0.5, size1: 2.2, life: 0.7, r: 0.95, g: 0.95, b: 0.95, alpha: 0.7, drag: 1 });
        if (Math.random() < dt * 4) { fx.dust(e.pos, 2, 1.4, 4); if (dist < 26) fx.shake = Math.max(fx.shake, 0.18); }
        if (P.t <= 0) { P.mode = 'charge'; P.t = 1.3; P.hit = false; this.n.charges++; e.roar = 0.8; } }
      else if (P.mode === 'charge') { e.move(dt, dir, 1, true); if (Math.random() < 0.5) fx.dust(e.pos, 1, 1.4, 5);
        if (pAlive && !P.hit && dist < e.radius + p.radius + 1.2) { P.hit = true; this.n.bumps++; p.hit(6, e.pos, e); p.knock.addScaledVector(dir, 10); fx.shake = Math.max(fx.shake, 0.5); this.say(e, 'AND STAY OUT!'); }
        if (P.t <= 0) { P.mode = 'off'; P.t = 3; if (!P.hit) this.say(e, 'Grumble grumble…', 2.4); sfx.grumble(0.4 + near * 0.4); } }
      else { e.move(dt, dir.clone().negate(), 0.45, false); if (P.t <= 0) { P.mode = 'idle'; P.cd = 6; } }
      return; }
    if (k === 'sleepy') {
      if (P.mode === 'idle') P.mode = 'sleep';
      if (P.mode === 'sleep') { stand(); e.jaw = 0;
        if (P.sayT <= 0) { P.sayT = 4; this.say(e, 'Zzz… 😴', 3.6); }
        if (Math.random() < dt * 1.6) fx.glow.spawn({ pos: head(), vel: { x: 0.4, y: 1.6, z: 0 }, size: 0.9, size1: 1.6, life: 1.8, r: 0.6, g: 0.75, b: 1.6, alpha: 0.9, drag: 0.4 });
        if (P.sndT <= 0 && dist < 45) { P.sndT = 3.2; this.n.snores++; sfx.snore(0.3 + near * 0.7); }
        if (hurt || (pAlive && dist < 7)) { P.mode = 'yawn'; P.t = 2; this.n.yawns++; this.say(e, '*YAWN*… huh? 🥱', 2.2); sfx.yawn(0.5 + near * 0.5); } }
      else if (P.mode === 'yawn') { stand(); face(2); e.jaw = Math.min(1, e.jaw + dt * 2); e.roar = 0.3; if (P.t <= 0) { P.mode = 'shuffle'; P.t = 6 + Math.random() * 3; e.jaw = 0; } }
      else { wander(0.22); if (hurt) { this.say(e, 'Ow… so sleepy…'); } if (P.t <= 0) { P.mode = 'sleep'; P.sayT = 0.6; this.n.naps++; this.say(e, 'Night night… 💤', 2); } }
      return; }
    if (k === 'showoff') {
      if (hurt && P.mode !== 'sulk') { P.mode = 'sulk'; P.t = 2.2; this.n.sulks++; this.say(e, 'HEY! Not the crest! 😤'); }
      if (P.mode === 'idle') { wander(0.45); if (pAlive && dist < 32 && P.cd <= 0) { P.mode = 'strut'; P.t = 2.2; this.say(e, 'Look at ME! 😎'); } }
      else if (P.mode === 'strut') { if (dist > 11) e.move(dt, dir, 0.55, false); else { stand(); face(6); } if (P.t <= 0 || dist <= 11) { P.mode = 'pose'; P.t = 1.6; this.n.poses++; this.say(e, '✨ TA-DA! ✨', 2); sfx.tada(0.5 + near * 0.5); fx.ring(e.pos, 6, 0xff7ad8); } }
      else if (P.mode === 'pose') { stand(); e.yaw += dt * 8; e.roar = 1;
        if (Math.random() < dt * 30) { const a = Math.random() * 6.28, h = e.mech.height * (0.6 + Math.random() * 0.8), C = [[2, 0.4, 0.4], [2, 1.4, 0.3], [1.6, 2, 0.4], [0.4, 2, 0.6], [0.4, 1.2, 2], [1.4, 0.5, 2]][(Math.random() * 6) | 0];
          fx.glow.spawn({ pos: { x: e.pos.x + Math.cos(a) * 2.2, y: e.pos.y + h, z: e.pos.z + Math.sin(a) * 2.2 }, vel: { x: Math.cos(a) * 3, y: 2, z: Math.sin(a) * 3 }, size: 0.5, size1: 0.1, life: 0.8, r: C[0], g: C[1], b: C[2], alpha: 1, drag: 1.5 }); }
        if (P.t <= 0) { P.mode = 'brag'; P.t = 1.8; this.say(e, 'Am I AMAZING or what?', 2); } }
      else if (P.mode === 'brag') { stand(); face(4); if (P.t <= 0) { P.mode = 'idle'; P.cd = 9; } }
      else { e.move(dt, dir.clone().negate(), 1, true); if (P.t <= 0) { P.mode = 'idle'; P.cd = 5; } }
      return; }
    if (k === 'scaredy') {
      if (hurt && P.mode !== 'tremble') { P.mode = 'tremble'; P.t = 1.5; this.n.trembles++; this.say(e, "Don't eat me! 😰"); sfx.eep(0.6 + near * 0.4); }
      if (P.mode === 'tremble') { stand(); e.yaw += Math.sin(P.t * 60) * 0.06; if (Math.random() < dt * 10) fx.glow.spawn({ pos: head(), vel: { x: (Math.random() - 0.5) * 3, y: 1.5, z: (Math.random() - 0.5) * 3 }, size: 0.35, size1: 0.15, life: 0.6, r: 0.5, g: 1.0, b: 2.2, alpha: 1, grav: 6, drag: 0.5 });
        if (P.t <= 0) { P.mode = 'flee'; P.t = 2; P.stuck = 0; } return; }
      if (pAlive && dist < 28) { if (P.mode !== 'flee') { P.mode = 'flee'; this.n.flees++; } P.t = 1;
        if (P.sayT <= 0) { P.sayT = 3; this.say(e, 'EEP! 😱', 1.4); } if (P.sndT <= 0) { P.sndT = 2.5; sfx.eep(0.4 + near * 0.6); }
        e.move(dt, dir.clone().negate(), 1, true); P.stuck = e.speedNow < 2 ? P.stuck + dt : 0;
        if (P.stuck > 0.7) { P.mode = 'tremble'; P.t = 1.5; P.stuck = 0; this.n.trembles++; this.say(e, "Don't eat me! 😰"); } return; }
      if (P.mode === 'flee') { P.mode = 'peek'; P.t = 1.6; this.n.peeks++; this.say(e, '…is it gone? 👀', 1.6); }
      if (P.mode === 'peek') { stand(); face(3); if (P.t <= 0) P.mode = 'idle'; return; }
      wander(0.35); return; }
    wander(0.3);
  }
}
