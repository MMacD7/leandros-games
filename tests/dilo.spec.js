import { test, expect } from '@playwright/test';
import fs from 'fs';
import { execFileSync } from 'child_process';

const OUT = '/opt/cursor/artifacts';

async function poll(page, fn, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn).catch(() => false)) return;
    await page.waitForTimeout(150);
  }
  throw new Error('timed out');
}

test('v5.10.0 dilo size, seat, frill blast, and pack', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player));
  const report = await page.evaluate(() => {
    G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'dilo';
    if (G.level !== 'jungle') G.setLevel('jungle');
    G.show('play');
    G.game.spawnPlayer(false);
    const g = G.game, p = g.player, m = p.mech, THREE = G.THREE, sk = m.skin;
    const flat = { x: 80, z: 24 }, slope = { x: 140, z: -200 };
    const play = (spot, name) => {
      p.pos.set(spot.x, 0, spot.z); p.yaw = 0.4; p.speedNow = name === 'Run' ? 14 : name === 'Walk' ? 4 : 0;
      p.roar = name === 'Roar' ? 1.2 : 0; p.frillT = name === 'Blast' ? 1.3 : 0; p.chargeA = 0; p.groundY();
      m._clip = '';
      for (let i = 0; i < 8; i++) p.updateVisual(1 / 20);
      let minY = Infinity, at = null, bury = -Infinity;
      const v = new THREE.Vector3();
      m.obj.updateMatrixWorld(true);
      for (let i = 0; i < sk.geometry.attributes.position.count; i += 6) {
        sk.getVertexPosition(i, v); v.applyMatrix4(sk.matrixWorld);
        if (v.y < minY) { minY = v.y; at = { x: v.x, z: v.z }; }
        const pen = g.world.height(v.x, v.z) - v.y;
        if (pen > bury) bury = pen;
      }
      return { name, gap: minY - g.world.height(at.x, at.z), bury };
    };
    const rows = [];
    for (const name of ['Idle', 'Walk', 'Run']) rows.push(play(flat, name));
    rows.push(play(slope, 'Walk'));
    const stretchOf = (name) => {
      const clip = m.actions[name];
      for (const [n, a] of Object.entries(m.actions)) a.setEffectiveWeight(n === name ? 1 : 0);
      const dur = clip.getClip().duration;
      const rest = sk.geometry.attributes.position, tris = sk.geometry.index.array;
      const ra = new THREE.Vector3(), rb = new THREE.Vector3(), rc = new THREE.Vector3();
      const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
      let maxR = 1, n = 0, hot = 0;
      for (let s = 0; s < 4; s++) {
        clip.time = Math.max(0, dur * (s + 0.5) / 4 - 0.001);
        m.mixer.update(0.001); m.obj.updateMatrixWorld(true);
        for (let t = 0; t < tris.length; t += 9) {
          const i0 = tris[t], i1 = tris[t + 1], i2 = tris[t + 2];
          ra.fromBufferAttribute(rest, i0); rb.fromBufferAttribute(rest, i1); rc.fromBufferAttribute(rest, i2);
          const e0 = ra.distanceTo(rb), e1 = rb.distanceTo(rc), e2 = rc.distanceTo(ra);
          sk.getVertexPosition(i0, pa); sk.getVertexPosition(i1, pb); sk.getVertexPosition(i2, pc);
          for (const [r, f] of [[e0, pa.distanceTo(pb)], [e1, pb.distanceTo(pc)], [e2, pc.distanceTo(pa)]]) {
            if (r < 0.05) continue;
            const ratio = Math.max(f / r, r / Math.max(f, 1e-4));
            n++; if (ratio > maxR) maxR = ratio; if (ratio > 2.5) hot++;
          }
        }
      }
      return { max: Math.round(maxR * 100) / 100, hot: n ? Math.round(hot / n * 1000) / 1000 : 0 };
    };
    const stretch = {};
    for (const name of ['Idle', 'Walk', 'Run', 'Roar', 'Blast']) stretch[name] = stretchOf(name);
    p.pos.set(flat.x, 0, flat.z); p.yaw = 0; p.speedNow = 0; p.roar = 0; p.frillT = 0; p.chargeA = 0; p.groundY();
    m._clip = '';
    for (let i = 0; i < 6; i++) p.updateVisual(1 / 20);
    m.obj.updateMatrixWorld(true);
    const crest = new THREE.Vector3(), hip = new THREE.Vector3();
    let footLow = Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const vv = new THREE.Vector3();
    const attr = sk.geometry.attributes.position;
    for (let i = 0; i < attr.count; i += 2) {
      sk.getVertexPosition(i, vv); vv.applyMatrix4(sk.matrixWorld);
      if (vv.y < footLow) footLow = vv.y;
      if (vv.x < minX) minX = vv.x; if (vv.x > maxX) maxX = vv.x;
      if (vv.z < minZ) minZ = vv.z; if (vv.z > maxZ) maxZ = vv.z;
    }
    m.crestTop(crest); m.hipPoint(hip);
    const ws = new THREE.Vector3();
    const riderWorld = g.rider.obj.getWorldScale(ws).y;
    const seatOf = (name) => {
      p.speedNow = name === 'Run' ? 14 : name === 'Walk' ? 4 : 0;
      p.roar = name === 'Roar' ? 1.3 : 0;
      p.frillT = name === 'Blast' ? 1.3 : 0;
      p.chargeA = 0;
      p.yaw = 0;
      m._clip = '';
      for (let i = 0; i < 10; i++) p.updateVisual(1 / 20);
      g.rider.update(0.05, p);
      const hips = new THREE.Vector3(), back = new THREE.Vector3(), neck = new THREE.Vector3();
      g.rider.hips.getWorldPosition(hips);
      const hide = m.backHide(back);
      const frill = new THREE.Vector3();
      m.frillEdge(frill);
      const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
      const ahead = frill.clone().sub(hips).dot(fwd);
      let near = 99;
      const vv = new THREE.Vector3();
      const attr = sk.geometry.attributes.position;
      for (let i = 0; i < attr.count; i += 3) {
        sk.getVertexPosition(i, vv);
        if (vv.y < 0.22 || vv.z < 0.55) continue;
        vv.applyMatrix4(sk.matrixWorld);
        const d = vv.distanceTo(hips);
        if (d < near) near = d;
      }
      return {
        name,
        hipGap: hide ? Math.round((hips.y - hide.y) * 100) / 100 : 99,
        frillAhead: Math.round(ahead * 100) / 100,
        frillClear: Math.round(near * 100) / 100,
      };
    };
    const seats = ['Walk', 'Run', 'Roar', 'Blast'].map(seatOf);
    p.frillT = 0; p.yaw = 0; p.speedNow = 0; p.groundY();
    const foe = g.spawnEnemy(p.pos.x, p.pos.z + 5.4, 2, 'pachy');
    foe.hp = foe.maxHp = 200; foe.pos.set(p.pos.x, 0, p.pos.z + 5.4); foe.groundY();
    const hpBefore = foe.hp;
    g.special(p);
    let seenClip = '', seenType = '', spat = false, damaged = false, stunned = false, slowed = false;
    for (let i = 0; i < 30; i++) {
      g.updateAct(p, 1 / 20); p.updateVisual(1 / 20);
      if (m._clip === 'Blast') seenClip = 'Blast';
      if (p.act && p.act.type) seenType = p.act.type;
      if (p.act && p.act.spat) spat = true;
      if (foe.hp < hpBefore) damaged = true;
      if (foe.stunT > 0) stunned = true;
      if (foe.slowT > 0) slowed = true;
    }
    const before = g.enemies.length;
    g.spawnEnemy(120, 30, 2, 'dilo');
    const pack = g.enemies.filter(e => e.alive && e.def.id === 'dilo').length;
    let blocky = 0, skin = 0;
    g.rider.obj.traverse(o => { if (o.isMesh && o.visible && o.userData.blocky) blocky++; if (o.isSkinnedMesh && o.visible) skin++; });
    return {
      quad: m.quad === true, skinned: m.skinned === true,
      clips: Object.keys(m.actions),
      crest: Math.round((crest.y - footLow) * 100) / 100,
      hip: Math.round((hip.y - footLow) * 100) / 100,
      length: Math.round((maxZ - minZ) * 100) / 100,
      width: Math.round((maxX - minX) * 100) / 100,
      radius: p.def.radius, speed: p.def.speed, hp: p.def.hp, special: p.def.special,
      rows, stretch, seats, riderWorld: Math.round(riderWorld * 100) / 100,
      blast: { clip: seenClip, type: seenType, spat, damaged, stunned, slowed, foeHp: foe.hp, pack, mounted: !!g.rider.mounted, blocky, skin },
    };
  });
  const bad = report.rows.filter(r => r.bury > 0.08 || r.gap < -0.08 || r.gap > 0.55);
  expect(bad, JSON.stringify({ bad, crest: report.crest, hip: report.hip, length: report.length })).toEqual([]);
  expect(report.quad).toBe(false);
  expect(report.skinned).toBe(true);
  expect(report.clips).toEqual(expect.arrayContaining(['Idle', 'Walk', 'Run', 'Roar', 'Blast']));
  expect(report.length).toBeGreaterThan(6.4);
  expect(report.length).toBeLessThan(7.6);
  expect(report.crest).toBeGreaterThan(2.9);
  expect(report.crest).toBeLessThan(3.6);
  expect(report.hip).toBeGreaterThan(1.85);
  expect(report.hip).toBeLessThan(2.55);
  expect(report.radius).toBeGreaterThan(2);
  expect(report.radius).toBeLessThan(3);
  expect(report.speed).toBeGreaterThan(16);
  expect(report.speed).toBeLessThan(21);
  expect(report.hp).toBeLessThan(110);
  expect(report.special).toBe('frillblast');
  expect(report.riderWorld).toBeGreaterThan(1.4);
  expect(report.riderWorld).toBeLessThan(1.7);
  for (const s of report.seats) {
    expect(Math.abs(s.hipGap), s.name).toBeLessThan(0.5);
    expect(s.frillAhead, s.name).toBeGreaterThan(0.3);
    expect(s.frillClear, s.name).toBeGreaterThan(0.2);
  }
  expect(report.blast.clip).toBe('Blast');
  expect(report.blast.type).toBe('frillblast');
  expect(report.blast.spat).toBe(true);
  expect(report.blast.damaged).toBe(true);
  expect(report.blast.stunned).toBe(true);
  expect(report.blast.slowed).toBe(true);
  expect(report.blast.pack).toBe(2);
  expect(report.blast.mounted).toBe(true);
  expect(report.blast.blocky).toBe(0);
  expect(report.blast.skin).toBeGreaterThan(0);
  for (const [name, s] of Object.entries(report.stretch)) {
    expect(s.max, name).toBeLessThan(16);
    expect(s.hot, name).toBeLessThan(0.1);
  }
  const dataSrc = await page.evaluate(async () => (await fetch('./js/data.js')).text());
  expect(dataSrc).toMatch(/id: 'dblast',[\s\S]{0,220}kind: 'dblast'/);
  await page.evaluate(() => { G.show('play'); });
  await expect(page.locator('#a-missile')).toContainText('FRILL');
  await expect(page.locator('#a-missile')).toContainText('BLAST');
  await expect(page.locator('#b-pause')).toBeVisible();

  fs.mkdirSync('/tmp', { recursive: true });
  fs.writeFileSync('/tmp/dilo-report.json', JSON.stringify({ crest: report.crest, hip: report.hip, length: report.length, width: report.width, radius: report.radius, speed: report.speed, hp: report.hp, seats: report.seats, blast: report.blast, stretch: report.stretch, riderWorld: report.riderWorld }));
  if (info.project.name !== 'iphone-landscape') return;
  fs.mkdirSync(OUT, { recursive: true });

  const shoot = async (file, pose) => {
    await page.evaluate((pose) => {
      window.__hold = true;
      G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'dilo';
      if (G.level !== 'jungle') G.setLevel('jungle');
      G.game.spawnPlayer(false);
      G.show('play');
      const g = G.game, p = g.player, THREE = G.THREE, m = p.mech;
      for (const r of g.fx.rings.splice(0)) { g.scene.remove(r.m); if (r.m.material) r.m.material.dispose(); }
      g.orbs.length = 0;
      for (const e of g.enemies) if (e.remove) e.remove();
      g.enemies.length = 0;
      const AX = 200, AZ = -160;
      p.speedNow = pose === 'walk' || pose === 'chase' ? 5 : 0;
      p.roar = 0; p.chargeA = 0;
      p.pos.set(pose === 'vs' ? AX : AX, 0, pose === 'vs' ? AZ : AZ); p.yaw = 0.15; p.groundY();
      for (let i = 0; i < 8; i++) p.updateVisual(1 / 20);
      if (pose === 'blast') {
        g.special(p);
        for (let i = 0; i < 28; i++) {
          g.updateAct(p, 1 / 30); p.updateVisual(1 / 30);
          g.fx.update(1 / 30, g.world, () => {}, g.scene.fog);
          if (p.act && p.act.spat) break;
        }
      }
      g.rider.update(0.05, p);
      if (pose === 'vs') {
        const e = g.spawnEnemy(AX + 1, AZ + 14, 2, 'trex');
        e.pos.set(AX + 1, 0, AZ + 14); e.yaw = Math.PI + 0.15; e.groundY(); e.speedNow = 0;
        for (let i = 0; i < 6; i++) e.updateVisual(1 / 20);
        e.mech.obj.visible = true;
      }
      if (pose === 'enemy') {
        p.mech.obj.visible = false; if (g.rider.obj) g.rider.obj.visible = false;
        const e = g.spawnEnemy(AX, AZ, 2, 'dilo');
        e.pos.set(AX, 0, AZ); e.yaw = 0.15; e.groundY(); e.speedNow = 5;
        for (let i = 0; i < 10; i++) e.updateVisual(1 / 20);
        e.mech.obj.visible = true;
      }
      const cam = g.camera;
      cam.fov = 40; cam.aspect = 844 / 390; cam.updateProjectionMatrix();
      G.renderer.setSize(844, 390, false);
      const ground = g.world.height(AX, AZ);
      if (pose === 'seat') {
        const look = new THREE.Vector3();
        g.rider.hips.getWorldPosition(look);
        cam.fov = 32; cam.updateProjectionMatrix();
        cam.position.set(look.x + 2.4, look.y + 0.7, look.z + 2.2);
        cam.lookAt(look.x, look.y + 0.15, look.z + 0.4);
      } else if (pose === 'vs') {
        cam.fov = 42; cam.updateProjectionMatrix();
        cam.position.set(AX + 22, ground + 5.5, AZ + 8);
        cam.lookAt(AX, ground + 2.2, AZ + 6);
      } else if (pose === 'enemy') {
        cam.position.set(AX + 11, ground + 2.6, AZ + 8);
        cam.lookAt(AX, ground + 1.8, AZ);
      } else if (pose === 'chase') {
        const look = p.pos.clone(); look.y += 2.4;
        cam.position.set(look.x - 7, look.y + 2.2, look.z + 11);
        cam.lookAt(look);
      } else if (pose === 'blast') {
        const look = p.pos.clone(); look.y += 1.6;
        cam.fov = 50; cam.updateProjectionMatrix();
        cam.position.set(look.x + 16, look.y + 3.4, look.z - 2);
        cam.lookAt(look.x - 1, look.y + 0.8, look.z + 4);
      } else {
        const look = p.pos.clone(); look.y += m.height * 0.48;
        cam.position.set(look.x + 12, look.y + 1.1, look.z + 6);
        cam.lookAt(look);
      }
      for (const e of g.enemies) if (pose !== 'vs' && pose !== 'enemy' && e.mech && e.mech.obj) e.mech.obj.visible = false;
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      G.renderer.render(g.scene, cam);
    }, pose);
    await page.screenshot({ path: OUT + '/' + file });
  };

  await page.evaluate(() => {
    G.garage('dilo');
    const lions = document.getElementById('g-lions'); if (lions) lions.style.display = 'none';
    const babies = document.getElementById('g-babies'); if (babies) babies.style.display = 'none';
    const dino = document.getElementById('g-dino'); if (dino) dino.classList.remove('hidden');
  });
  await poll(page, () => document.getElementById('g-name').textContent.includes('Dilophosaurus'));
  await page.evaluate(() => {
    const panel = document.querySelector('.g-panel');
    const card = document.querySelector('.sd-card[data-super="dilo"]');
    if (panel && card) panel.scrollTop = Math.max(0, card.offsetTop - 36);
  });
  await page.screenshot({ path: OUT + '/dilo-garage.png' });
  await shoot('dilo-walk.png', 'walk');
  await shoot('dilo-seat.png', 'seat');
  await shoot('dilo-vs-trex.png', 'vs');
  await shoot('dilo-chase.png', 'chase');
  await shoot('dilo-enemy.png', 'enemy');
  await shoot('dilo-blast.png', 'blast');

  if (process.env.DILO_STILLS === '1') return;
  await page.evaluate(() => {
    const g = G.game;
    g.orbs.length = 0;
    for (let i = 0; i < 30; i++) g.fx.update(0.1, g.world, () => {}, g.scene.fog);
  });
  fs.mkdirSync('/tmp/dilo-gait', { recursive: true });
  const frames = 6 * 10;
  for (let i = 0; i < frames; i++) {
    const jpeg = await page.evaluate((i) => {
      const g = G.game, p = g.player;
      g.orbs.length = 0;
      for (const e of g.enemies) if (e.mech && e.mech.obj) e.mech.obj.visible = false;
      p.mech.obj.visible = true;
      if (g.rider.obj) g.rider.obj.visible = true;
      p.pos.set(200 + Math.sin(0.15) * i * 0.22, 0, -160 + Math.cos(0.15) * i * 0.22);
      p.yaw = 0.15; p.speedNow = 5; p.chargeA = 0; p.roar = 0; p.groundY();
      p.updateVisual(1 / 10);
      const cam = g.camera;
      cam.fov = 40; cam.aspect = 844 / 390; cam.updateProjectionMatrix();
      const look = p.pos.clone(); look.y += p.mech.height * 0.45;
      cam.position.set(look.x + 11, look.y + 1.3, look.z + 7);
      cam.lookAt(look);
      G.renderer.render(g.scene, cam);
      const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.7);
      return url.slice(url.indexOf(',') + 1);
    }, i);
    fs.writeFileSync('/tmp/dilo-gait/' + String(i).padStart(4, '0') + '.jpg', Buffer.from(jpeg, 'base64'));
  }
  execFileSync('ffmpeg', ['-y', '-framerate', '10', '-i', '/tmp/dilo-gait/%04d.jpg', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', OUT + '/dilo-walk.mp4'], { stdio: 'inherit' });
});
