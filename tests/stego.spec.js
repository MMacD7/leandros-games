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

test('v5.9.8 stego size, seat, and spike swing', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player));
  const report = await page.evaluate(() => {
    G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'stegos';
    if (G.level !== 'jungle') G.setLevel('jungle');
    G.show('play');
    G.game.spawnPlayer(false);
    const g = G.game, p = g.player, m = p.mech, THREE = G.THREE, sk = m.skin;
    const flat = { x: 80, z: 24 }, slope = { x: 140, z: -200 };
    const play = (spot, name) => {
      p.pos.set(spot.x, 0, spot.z); p.yaw = 0.4; p.speedNow = name === 'Run' ? 12 : name === 'Walk' ? 4 : 0;
      p.roar = name === 'Roar' ? 1.2 : 0; p.smashA = name === 'Swing' ? 1 : 0; p.groundY();
      m._clip = '';
      for (let i = 0; i < 8; i++) p.updateVisual(1 / 20);
      const gapOf = () => {
        let minY = Infinity, at = null, bury = -Infinity;
        const v = new THREE.Vector3();
        sk.geometry.attributes.position;
        m.obj.updateMatrixWorld(true);
        for (let i = 0; i < sk.geometry.attributes.position.count; i += 6) {
          sk.getVertexPosition(i, v); v.applyMatrix4(sk.matrixWorld);
          if (v.y < minY) { minY = v.y; at = { x: v.x, z: v.z }; }
          const pen = g.world.height(v.x, v.z) - v.y;
          if (pen > bury) bury = pen;
        }
        return { gap: minY - g.world.height(at.x, at.z), bury };
      };
      const s = gapOf();
      return { where: 'flat', name, gap: s.gap, bury: s.bury };
    };
    const rows = [];
    for (const name of ['Idle', 'Walk', 'Run']) rows.push(play(flat, name));
    rows.push({ ...play(slope, 'Walk'), where: 'slope' });
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
          for (const [r, f] of [[e0, pa.distanceTo(pb)], [e1, pb.distanceTo(pc)], [e2, pc.distanceTo(ra)]]) {
            if (r < 0.05) continue;
            const ratio = Math.max(f / r, r / Math.max(f, 1e-4));
            n++; if (ratio > maxR) maxR = ratio; if (ratio > 2.5) hot++;
          }
        }
      }
      return { max: Math.round(maxR * 100) / 100, hot: n ? Math.round(hot / n * 1000) / 1000 : 0 };
    };
    const stretch = {};
    for (const name of ['Idle', 'Walk', 'Run', 'Roar', 'Swing']) stretch[name] = stretchOf(name);
    p.pos.set(flat.x, 0, flat.z); p.yaw = 0; p.speedNow = 0; p.roar = 0; p.smashA = 0; p.groundY();
    m._clip = '';
    for (let i = 0; i < 6; i++) p.updateVisual(1 / 20);
    m.obj.updateMatrixWorld(true);
    const foot = new THREE.Vector3(), plate = new THREE.Vector3(), hip = new THREE.Vector3();
    let footLow = Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const vv = new THREE.Vector3();
    const attr = sk.geometry.attributes.position;
    for (let i = 0; i < attr.count; i += 2) {
      sk.getVertexPosition(i, vv); vv.applyMatrix4(sk.matrixWorld);
      if (vv.y < footLow) footLow = vv.y;
      if (vv.x < minX) minX = vv.x; if (vv.x > maxX) maxX = vv.x;
      if (vv.z < minZ) minZ = vv.z; if (vv.z > maxZ) maxZ = vv.z;
    }
    m.plateTop(plate); m.hipPoint(hip);
    const ws = new THREE.Vector3();
    const riderWorld = g.rider.obj.getWorldScale(ws).x;
    const seatOf = (name) => {
      p.speedNow = name === 'Run' ? 12 : name === 'Walk' ? 4 : 0;
      p.roar = name === 'Roar' ? 1.3 : 0;
      p.smashA = name === 'Swing' ? 1 : 0;
      m._clip = '';
      for (let i = 0; i < 10; i++) p.updateVisual(1 / 20);
      g.rider.update(0.05, p);
      const hips = new THREE.Vector3(), back = new THREE.Vector3(), top = new THREE.Vector3();
      g.rider.hips.getWorldPosition(hips);
      const hide = m.backHide(back), shell = m.plateTop(top);
      return {
        name,
        hipGap: hide ? Math.round((hips.y - hide.y) * 100) / 100 : 99,
        belowPlate: shell ? Math.round((shell.y - hips.y) * 100) / 100 : 0,
      };
    };
    const seats = ['Walk', 'Run', 'Roar', 'Swing'].map(seatOf);
    const foe = g.spawnEnemy(p.pos.x, p.pos.z - 5.2, 2, 'pachy');
    foe.hp = foe.maxHp = 200; foe.pos.set(p.pos.x, 0, p.pos.z - 5.2); foe.groundY();
    const hpBefore = foe.hp;
    g.special(p);
    let seenClip = '', seenType = '', seenSlam = false, damaged = false;
    for (let i = 0; i < 28; i++) {
      g.updateAct(p, 1 / 20); p.updateVisual(1 / 20);
      if (m._clip === 'Swing') seenClip = 'Swing';
      if (p.act && p.act.type) seenType = p.act.type;
      if (p.act && p.act.slammed) seenSlam = true;
      if (foe.hp < hpBefore) damaged = true;
    }
    let blocky = 0, skin = 0;
    g.rider.obj.traverse(o => { if (o.isMesh && o.visible && o.userData.blocky) blocky++; if (o.isSkinnedMesh && o.visible) skin++; });
    return {
      quad: m.quad === true, skinned: m.skinned === true,
      clips: Object.keys(m.actions),
      plate: Math.round((plate.y - footLow) * 100) / 100,
      hip: Math.round((hip.y - footLow) * 100) / 100,
      length: Math.round((maxZ - minZ) * 100) / 100,
      width: Math.round((maxX - minX) * 100) / 100,
      radius: p.def.radius, speed: p.def.speed, hp: p.def.hp, special: p.def.special,
      rows, stretch, seats, riderWorld: Math.round(riderWorld * 100) / 100,
      swing: { clip: seenClip, type: seenType, slammed: seenSlam, damaged, foeHp: foe.hp, mounted: !!g.rider.mounted, blocky, skin },
    };
  });
  const bad = report.rows.filter(r => r.bury > 0.08 || r.gap < -0.08 || r.gap > 0.5);
  expect(bad, JSON.stringify({ bad, plate: report.plate, hip: report.hip, length: report.length })).toEqual([]);
  expect(report.quad).toBe(true);
  expect(report.skinned).toBe(true);
  expect(report.clips).toEqual(expect.arrayContaining(['Idle', 'Walk', 'Run', 'Roar', 'Swing']));
  expect(report.length).toBeGreaterThan(8.2);
  expect(report.length).toBeLessThan(9.8);
  expect(report.plate).toBeGreaterThan(3.9);
  expect(report.plate).toBeLessThan(4.7);
  expect(report.hip).toBeGreaterThan(2.6);
  expect(report.hip).toBeLessThan(3.5);
  expect(report.radius).toBeGreaterThan(3);
  expect(report.radius).toBeLessThan(4.2);
  expect(report.speed).toBeGreaterThan(8);
  expect(report.speed).toBeLessThan(13);
  expect(report.hp).toBeGreaterThan(220);
  expect(report.special).toBe('spikeswing');
  expect(report.riderWorld).toBeGreaterThan(1.4);
  expect(report.riderWorld).toBeLessThan(1.7);
  for (const s of report.seats) {
    expect(Math.abs(s.hipGap), s.name).toBeLessThan(0.45);
    expect(s.belowPlate, s.name).toBeGreaterThan(0.4);
  }
  expect(report.swing.clip).toBe('Swing');
  expect(report.swing.type).toBe('spikeswing');
  expect(report.swing.slammed).toBe(true);
  expect(report.swing.damaged).toBe(true);
  expect(report.swing.mounted).toBe(true);
  expect(report.swing.blocky).toBe(0);
  expect(report.swing.skin).toBeGreaterThan(0);
  for (const [name, s] of Object.entries(report.stretch)) {
    expect(s.max, name).toBeLessThan(16);
    expect(s.hot, name).toBeLessThan(0.1);
  }
  const dataSrc = await page.evaluate(async () => (await fetch('./js/data.js')).text());
  expect(dataSrc).toMatch(/id: 'stego',[\s\S]{0,180}kind: 'stego'/);
  await page.evaluate(() => { G.show('play'); });
  await expect(page.locator('#a-missile')).toContainText('SPIKE');
  await expect(page.locator('#a-missile')).toContainText('SWING');
  await expect(page.locator('#b-pause')).toBeVisible();

  fs.mkdirSync('/tmp', { recursive: true });
  fs.writeFileSync('/tmp/stego-report.json', JSON.stringify({ plate: report.plate, hip: report.hip, length: report.length, width: report.width, radius: report.radius, speed: report.speed, hp: report.hp, seats: report.seats, swing: report.swing, stretch: report.stretch, riderWorld: report.riderWorld }));
  if (info.project.name !== 'iphone-landscape') return;
  fs.mkdirSync(OUT, { recursive: true });

  const shoot = async (file, pose) => {
    await page.evaluate((pose) => {
      window.__hold = true;
      G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'stegos';
      if (G.level !== 'jungle') G.setLevel('jungle');
      G.game.spawnPlayer(false);
      G.show('play');
      const g = G.game, p = g.player, THREE = G.THREE, m = p.mech;
      for (const r of g.fx.rings.splice(0)) { g.scene.remove(r.m); if (r.m.material) r.m.material.dispose(); }
      for (const e of g.enemies) if (e.remove) e.remove();
      g.enemies.length = 0;
      const AX = 200, AZ = -160;
      p.speedNow = pose === 'walk' || pose === 'chase' ? 5 : 0;
      p.roar = 0; p.smashA = 0;
      p.pos.set(pose === 'vs' ? AX + 12 : AX, 0, AZ); p.yaw = 0.4; p.groundY();
      for (let i = 0; i < 8; i++) p.updateVisual(1 / 20);
      if (pose === 'swing') {
        g.special(p);
        for (let i = 0; i < 24; i++) {
          g.updateAct(p, 1 / 30); p.updateVisual(1 / 30);
          g.fx.update(1 / 30, g.world, () => {}, g.scene.fog);
          if (p.act && p.act.slammed && p.act.t >= 0.48) break;
        }
      }
      g.rider.update(0.05, p);
      if (pose === 'vs') {
        const e = g.spawnEnemy(AX + 2, AZ + 12, 2, 'trex');
        e.pos.set(AX + 2, 0, AZ + 12); e.yaw = 0.4 + Math.PI; e.groundY(); e.speedNow = 0;
        for (let i = 0; i < 6; i++) e.updateVisual(1 / 20);
        e.mech.obj.visible = true;
      }
      if (pose === 'enemy') {
        p.mech.obj.visible = false; if (g.rider.obj) g.rider.obj.visible = false;
        const e = g.spawnEnemy(AX, AZ, 2, 'stegos');
        e.pos.set(AX, 0, AZ); e.yaw = 0.4; e.groundY(); e.speedNow = 4;
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
        cam.position.set(look.x + 1.2, look.y + 0.7, look.z + 6.2);
        cam.lookAt(look.x, look.y + 0.15, look.z - 0.4);
      } else if (pose === 'vs') {
        cam.fov = 40; cam.updateProjectionMatrix();
        cam.position.set(AX + 32, ground + 7, AZ + 8);
        cam.lookAt(AX, ground + 2.2, AZ + 6);
      } else if (pose === 'enemy') {
        cam.position.set(AX + 12, ground + 2.8, AZ + 7);
        cam.lookAt(AX, ground + 1.7, AZ);
      } else if (pose === 'chase') {
        const look = p.pos.clone(); look.y += 2.2;
        cam.position.set(look.x - 8, look.y + 2.4, look.z + 12);
        cam.lookAt(look);
      } else if (pose === 'swing') {
        const look = p.pos.clone(); look.y += 1.8;
        cam.position.set(look.x + 10, look.y + 2.6, look.z - 6);
        cam.lookAt(look.x - 1, look.y + 0.4, look.z - 2);
      } else {
        const look = p.pos.clone(); look.y += m.height * 0.45;
        cam.position.set(look.x + 12, look.y + 1.2, look.z + 6);
        cam.lookAt(look);
      }
      for (const e of g.enemies) if (pose !== 'vs' && pose !== 'enemy' && e.mech && e.mech.obj) e.mech.obj.visible = false;
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      G.renderer.render(g.scene, cam);
    }, pose);
    await page.screenshot({ path: OUT + '/' + file });
  };

  await page.evaluate(() => {
    G.garage('stegos');
    const lions = document.getElementById('g-lions'); if (lions) lions.style.display = 'none';
    const babies = document.getElementById('g-babies'); if (babies) babies.style.display = 'none';
    const dino = document.getElementById('g-dino'); if (dino) dino.classList.remove('hidden');
    const panel = document.querySelector('.g-panel');
    const s = document.getElementById('g-super');
    if (panel && s) panel.scrollTop = Math.max(0, s.offsetTop - 6);
  });
  await poll(page, () => document.getElementById('g-name').textContent.includes('Stegosaurus'));
  await page.evaluate(() => {
    const panel = document.querySelector('.g-panel');
    const card = document.querySelector('.sd-card[data-super="stegos"]');
    if (panel && card) panel.scrollTop = Math.max(0, card.offsetTop - 36);
  });
  await page.screenshot({ path: OUT + '/stego-garage.png' });
  await shoot('stego-walk.png', 'walk');
  await shoot('stego-swing.png', 'swing');
  await shoot('stego-seat.png', 'seat');
  await shoot('stego-vs-trex.png', 'vs');
  await shoot('stego-chase.png', 'chase');
  await shoot('stego-enemy.png', 'enemy');

  if (process.env.STEGO_STILLS === '1') return;
  fs.mkdirSync('/tmp/stego-gait', { recursive: true });
  const frames = 6 * 10;
  for (let i = 0; i < frames; i++) {
    const jpeg = await page.evaluate((i) => {
      const g = G.game, p = g.player;
      for (const e of g.enemies) if (e.mech && e.mech.obj) e.mech.obj.visible = false;
      p.mech.obj.visible = true;
      if (g.rider.obj) g.rider.obj.visible = true;
      p.pos.set(200 + Math.sin(0.4) * i * 0.18, 0, -160 + Math.cos(0.4) * i * 0.18);
      p.yaw = 0.4; p.speedNow = 4; p.smashA = 0; p.roar = 0; p.groundY();
      p.updateVisual(1 / 10);
      const cam = g.camera;
      cam.fov = 40; cam.aspect = 844 / 390; cam.updateProjectionMatrix();
      const look = p.pos.clone(); look.y += p.mech.height * 0.42;
      cam.position.set(look.x + 11, look.y + 1.4, look.z + 7);
      cam.lookAt(look);
      G.renderer.render(g.scene, cam);
      const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.7);
      return url.slice(url.indexOf(',') + 1);
    }, i);
    fs.writeFileSync('/tmp/stego-gait/' + String(i).padStart(4, '0') + '.jpg', Buffer.from(jpeg, 'base64'));
  }
  execFileSync('ffmpeg', ['-y', '-framerate', '10', '-i', '/tmp/stego-gait/%04d.jpg', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', OUT + '/stego-walk.mp4'], { stdio: 'inherit' });
});
