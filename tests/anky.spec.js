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

test('v5.9.4 anky feet, stretch, smash, and seat', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player && G.modelsReady !== false));
  await poll(page, () => {
    try { G.save.selected = 'ankys'; G.game.spawnPlayer(false); return G.game.player.def.id === 'ankys' && G.game.player.mech.skinned; }
    catch (e) { return false; }
  });

  const report = await page.evaluate(() => {
    const g = G.game, THREE = G.THREE;
    G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'ankys';
    if (G.level !== 'jungle') G.setLevel('jungle');
    g.spawnPlayer(false);
    const p = g.player, m = p.mech, sk = m.skin;
    const gapOf = () => {
      m.obj.updateMatrixWorld(true);
      const attr = sk.geometry.attributes.position;
      const v = new THREE.Vector3();
      let minY = Infinity, at = null, bury = -Infinity;
      for (let i = 0; i < attr.count; i += 3) {
        sk.getVertexPosition(i, v);
        v.applyMatrix4(sk.matrixWorld);
        const pen = g.world.height(v.x, v.z) - v.y;
        if (v.y < minY) { minY = v.y; at = v.clone(); }
        if (pen > bury) bury = pen;
      }
      return { gap: minY - g.world.height(at.x, at.z), bury };
    };
    let flat = null, slope = null;
    for (let x = -220; x <= 220; x += 6) for (let z = -220; z <= 220; z += 6) {
      if (Math.hypot(x - 18, z + 48) < 50 || Math.hypot(x - 150, z - 8) < 48) continue;
      const h = g.world.height(x, z);
      if (h < 1.5 || h > 28) continue;
      const n = g.world.normalAt(x, z, new THREE.Vector3());
      let err = 0;
      for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const hh = g.world.height(x + dx, z + dz);
        const planeY = h - (n.x * dx + n.z * dz) / Math.max(0.2, n.y);
        err = Math.max(err, Math.abs(hh - planeY));
      }
      if (n.y > 0.992 && err < 0.05 && (!flat || err < flat.err)) flat = { x, z, ny: n.y, err };
      if (n.y > 0.984 && n.y < 0.994 && err < 0.04 && (!slope || err < slope.err)) slope = { x, z, ny: n.y, err };
    }
    const play = (spot, name) => {
      p.pos.set(spot.x, 0, spot.z); p.yaw = 0.4; p.groundY(); p.tilt.identity();
      let worst = { gap: 0, bury: -1, name };
      for (let i = 0; i < 16; i++) {
        p.speedNow = name === 'Run' ? 8 : name === 'Walk' ? 4 : 0;
        p.roar = name === 'Roar' ? 1.6 : 0;
        p.smashA = name === 'Smash' ? 1 : 0;
        p.updateVisual(1 / 20);
        if (i < 10) continue;
        const s = gapOf();
        if (s.bury > worst.bury || Math.abs(s.gap) > Math.abs(worst.gap)) worst = { ...s, name };
      }
      p.smashA = 0;
      return worst;
    };
    const rows = [];
    for (const name of ['Idle', 'Walk', 'Run', 'Roar', 'Smash']) {
      rows.push({ where: 'flat', ...play(flat, name) });
      rows.push({ where: 'slope', ...play(slope, name) });
    }
    const stretchOf = (name) => {
      const clip = m.actions[name];
      for (const [n, a] of Object.entries(m.actions)) a.setEffectiveWeight(n === name ? 1 : 0);
      const dur = clip.getClip().duration;
      const geo = sk.geometry, rest = geo.attributes.position, tris = geo.index.array;
      const ra = new THREE.Vector3(), rb = new THREE.Vector3(), rc = new THREE.Vector3();
      const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
      let maxR = 1, n = 0, hot = 0;
      for (let s = 0; s < 4; s++) {
        clip.time = Math.max(0, dur * (s + 0.5) / 4 - 0.001);
        m.mixer.update(0.001);
        m.obj.updateMatrixWorld(true);
        for (let t = 0; t < tris.length; t += 6) {
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
    for (const name of ['Idle', 'Walk', 'Run', 'Roar', 'Smash']) stretch[name] = stretchOf(name);
    p.pos.set(flat.x, 0, flat.z); p.yaw = 0; p.speedNow = 0; p.roar = 0; p.smashA = 0; p.groundY();
    m._clip = '';
    for (let i = 0; i < 6; i++) p.updateVisual(1 / 20);
    const hips = new THREE.Vector3(), foot = new THREE.Vector3(), headB = new THREE.Vector3();
    const hide = new THREE.Vector3(), shellPt = new THREE.Vector3();
    const hipBone = new THREE.Vector3();
    m.bones.hips.getWorldPosition(hipBone);
    let footLow = Infinity, hipTop = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const vv = new THREE.Vector3();
    m.obj.updateMatrixWorld(true);
    const attr = sk.geometry.attributes.position;
    for (let i = 0; i < attr.count; i += 2) {
      sk.getVertexPosition(i, vv);
      vv.applyMatrix4(sk.matrixWorld);
      if (vv.y < footLow) footLow = vv.y;
      if (vv.x < minX) minX = vv.x; if (vv.x > maxX) maxX = vv.x;
      if (vv.z < minZ) minZ = vv.z; if (vv.z > maxZ) maxZ = vv.z;
      const dx = vv.x - hipBone.x, dz = vv.z - hipBone.z;
      if (dx * dx + dz * dz < 1.4 && vv.y > hipTop) hipTop = vv.y;
    }
    const size = { x: maxX - minX, z: maxZ - minZ };
    m.shellTop(shellPt);
    const shellH = shellPt.y - footLow;
    const hipH = hipTop - footLow;
    const ws = new THREE.Vector3();
    const riderWorld = g.rider.obj.getWorldScale(ws).x;
    const seatOf = (name) => {
      p.speedNow = name === 'Run' ? 14 : name === 'Walk' ? 5 : 0;
      p.roar = name === 'Roar' ? 1.4 : 0;
      p.smashA = name === 'Smash' ? 1 : 0;
      m._clip = '';
      for (let i = 0; i < (name === 'Smash' ? 12 : 8); i++) p.updateVisual(1 / 20);
      g.rider.update(0.05, p);
      g.rider.hips.getWorldPosition(hips);
      const back = m.backHide(hide), shell = m.shellTop(shellPt);
      const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
      const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
      let footDrop = Infinity, footSide = 0;
      for (const leg of g.rider.legs) {
        leg.foot.getWorldPosition(foot);
        footDrop = Math.min(footDrop, hips.y - foot.y);
        footSide = Math.max(footSide, Math.abs(foot.clone().sub(hips).dot(right)));
      }
      g.rider.head.getWorldPosition(headB);
      return {
        name,
        hipGap: back ? Math.round((hips.y - back.y) * 100) / 100 : 99,
        belowShell: shell ? Math.round((shell.y - hips.y) * 100) / 100 : 0,
        footDrop: Math.round(footDrop * 100) / 100,
        footSide: Math.round(footSide * 100) / 100,
        headAbove: Math.round((headB.y - hips.y) * 100) / 100,
      };
    };
    const seats = ['Walk', 'Run', 'Roar', 'Smash'].map(seatOf);
    const foe = g.spawnEnemy(p.pos.x - 2.2, p.pos.z - 4.2, 2, 'pachy');
    foe.hp = foe.maxHp = 200; foe.pos.set(p.pos.x - 2.2, 0, p.pos.z - 4.2); foe.groundY();
    const hpBefore = foe.hp;
    const armorBefore = p.hp;
    p.hit(100, null, foe, true);
    const armorTaken = armorBefore - p.hp;
    p.hp = p.maxHp;
    g.special(p);
    let smashed = false, seenClip = '', seenType = '', seenSlam = false;
    for (let i = 0; i < 24; i++) {
      g.updateAct(p, 1 / 20); p.updateVisual(1 / 20);
      if (m._clip === 'Smash') seenClip = 'Smash';
      if (p.act && p.act.type) seenType = p.act.type;
      if (p.act && p.act.slammed) seenSlam = true;
      if (foe.hp < hpBefore) smashed = true;
    }
    let blocky = 0, skin = 0;
    g.rider.obj.traverse(o => { if (o.isMesh && o.visible && o.userData.blocky) blocky++; if (o.isSkinnedMesh && o.visible) skin++; });
    const smash = { clip: seenClip, type: seenType, slammed: seenSlam, mounted: !!g.rider.mounted, damaged: smashed, foeHp: foe.hp, armorTaken, blocky, skin };
    const round = (row) => ({ ...row, gap: Math.round(row.gap * 1000) / 1000, bury: Math.round(row.bury * 1000) / 1000 });
    return {
      skinned: m.skinned === true,
      quad: m.quad === true,
      clips: Object.keys(m.actions),
      shell: Math.round(shellH * 100) / 100,
      hip: Math.round(hipH * 100) / 100,
      length: Math.round(size.z * 100) / 100,
      width: Math.round(size.x * 100) / 100,
      radius: p.def.radius,
      special: p.def.special,
      rows: rows.map(round),
      stretch,
      seats,
      riderWorld: Math.round(riderWorld * 100) / 100,
      smash,
      flat, slope,
    };
  });

  const bad = report.rows.filter(r => r.bury > 0.08 || r.gap < -0.08 || r.gap > 0.45);
  expect(bad, JSON.stringify({ bad, flat: report.flat, slope: report.slope, hip: report.hip, shell: report.shell, length: report.length, width: report.width })).toEqual([]);
  expect(report.skinned).toBe(true);
  expect(report.quad).toBe(true);
  expect(report.clips).toEqual(expect.arrayContaining(['Idle', 'Walk', 'Run', 'Roar', 'Smash']));
  expect(report.hip).toBeGreaterThan(2.05);
  expect(report.hip).toBeLessThan(2.7);
  expect(report.shell).toBeGreaterThan(2.1);
  expect(report.shell).toBeLessThan(3.4);
  expect(report.length).toBeGreaterThan(7.2);
  expect(report.length).toBeLessThan(8.8);
  expect(report.width).toBeGreaterThan(2.6);
  expect(report.width).toBeLessThan(3.5);
  expect(report.radius).toBeGreaterThan(2.8);
  expect(report.radius).toBeLessThan(3.6);
  expect(report.special).toBe('tailclub');
  for (const s of report.seats) {
    expect(s.hipGap, s.name).toBeGreaterThan(-0.3);
    expect(s.hipGap, s.name).toBeLessThan(0.35);
    expect(s.belowShell, s.name).toBeGreaterThan(0.02);
    expect(s.footDrop, s.name).toBeGreaterThan(0.3);
    expect(s.footSide, s.name).toBeGreaterThan(0.2);
    expect(s.headAbove, s.name).toBeGreaterThan(0.1);
  }
  expect(report.riderWorld).toBeGreaterThan(1.4);
  expect(report.riderWorld).toBeLessThan(1.7);
  expect(report.smash.clip).toBe('Smash');
  expect(report.smash.type).toBe('tailclub');
  expect(report.smash.slammed).toBe(true);
  expect(report.smash.mounted).toBe(true);
  expect(report.smash.damaged).toBe(true);
  expect(report.smash.armorTaken).toBeGreaterThan(50);
  expect(report.smash.armorTaken).toBeLessThan(80);
  expect(report.smash.blocky).toBe(0);
  expect(report.smash.skin).toBeGreaterThan(0);
  const dataSrc = await page.evaluate(async () => (await fetch('./js/data.js')).text());
  expect(dataSrc).toMatch(/id: 'lavaanky'[\s\S]{0,420}special: 'lavaslam'/);
  expect(dataSrc).toMatch(/id: 'ankylo',[\s\S]{0,240}kind: 'ankylo'/);
  const gameSrc = await page.evaluate(async () => (await fetch('./js/game.js')).text());
  expect(gameSrc).toContain("def.id === 'ankys' ? new AnkyMech");
  for (const [name, s] of Object.entries(report.stretch)) {
    expect(s.max, name).toBeLessThan(16);
    expect(s.hot, name).toBeLessThan(0.1);
  }

  await page.evaluate(() => { G.show('play'); });
  await expect(page.locator('#a-missile')).toContainText('TAIL');
  await expect(page.locator('#a-missile')).toContainText('SMASH');
  await expect(page.locator('#b-pause')).toBeVisible();

  if (info.project.name !== 'iphone-landscape') return;
  fs.mkdirSync(OUT, { recursive: true });
  console.log('anky', JSON.stringify({ hip: report.hip, shell: report.shell, length: report.length, width: report.width, radius: report.radius, seats: report.seats, smash: report.smash, stretch: report.stretch }));

  const shoot = async (file, pose) => {
    await page.evaluate((pose) => {
      window.__hold = true;
      G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'ankys';
      if (G.level !== 'jungle') G.setLevel('jungle');
      G.game.spawnPlayer(false);
      G.show('play');
      const g = G.game, p = g.player, THREE = G.THREE, m = p.mech, cam0 = g.camera;
      cam0.fov = cam0.aspect < 1 ? 72 : 58; cam0.updateProjectionMatrix();
      g.fx.update(2, g.world, () => {}, g.scene.fog);
      for (const r of g.fx.rings.splice(0)) { g.scene.remove(r.m); if (r.m.material) r.m.material.dispose(); }
      for (const e of g.enemies) if (e.remove) e.remove();
      g.enemies.length = 0;
      const AX = 105, AZ = 40;
      p.speedNow = pose === 'walk' ? 5 : 0;
      p.roar = 0; p.smashA = 0;
      p.pos.set(pose === 'vs' ? AX + 10 : AX, 0, AZ); p.yaw = Math.PI / 2; p.groundY();
      for (let i = 0; i < 8; i++) p.updateVisual(1 / 20);
      if (pose === 'smash') {
        g.special(p);
        for (let i = 0; i < 24; i++) {
          g.updateAct(p, 1 / 30);
          p.updateVisual(1 / 30);
          g.fx.update(1 / 30, g.world, () => {}, g.scene.fog);
          if (p.act && p.act.slammed && p.act.t >= 0.5) break;
        }
      }
      g.rider.update(0.05, p);
      if (pose === 'vs') {
        const e = g.spawnEnemy(AX - 10, AZ, 2, 'trex');
        e.pos.set(AX - 10, 0, AZ); e.yaw = Math.PI / 2; e.groundY(); e.speedNow = 0; e.tilt.identity();
        for (let i = 0; i < 6; i++) e.updateVisual(1 / 20);
        e.mech.obj.visible = true;
      }
      if (pose === 'enemy') {
        p.mech.obj.visible = false;
        if (g.rider.obj) g.rider.obj.visible = false;
        const e = g.spawnEnemy(AX, AZ, 2, 'ankys');
        e.pos.set(AX, 0, AZ); e.yaw = Math.PI / 2; e.groundY(); e.speedNow = 5;
        for (let i = 0; i < 10; i++) e.updateVisual(1 / 20);
        e.mech.obj.visible = true;
      }
      const cam = g.camera;
      cam.fov = pose === 'chase' ? 58 : pose === 'vs' ? 42 : 38;
      cam.aspect = 844 / 390; cam.updateProjectionMatrix();
      G.renderer.setSize(844, 390, false);
      if (pose === 'chase') {
        p.mech.obj.visible = true;
        if (g.rider.obj) g.rider.obj.visible = true;
        const look = p.pos.clone(); look.y += 2.4;
        cam.fov = 42; cam.updateProjectionMatrix();
        cam.position.set(look.x - 7, look.y + 2.2, look.z + 11);
        cam.lookAt(look.x + 1.5, look.y + 0.3, look.z);
      } else if (pose === 'vs' || pose === 'enemy') {
        const look = new THREE.Vector3(AX, g.world.height(AX, AZ) + 2.4, AZ);
        cam.position.set(AX, look.y + 1.6, AZ - (pose === 'vs' ? 28 : 18));
        cam.lookAt(look);
      } else if (pose === 'seat') {
        const look = new THREE.Vector3();
        g.rider.hips.getWorldPosition(look);
        cam.fov = 34; cam.updateProjectionMatrix();
        cam.position.set(look.x, look.y + 0.45, look.z + 7.4);
        cam.lookAt(look.x + 0.2, look.y - 0.1, look.z);
      } else {
        const look = p.pos.clone(); look.y += m.height * 0.42;
        cam.position.set(look.x, look.y + (pose === 'smash' ? 2.4 : 1.4), look.z + (pose === 'smash' ? 18 : 16));
        cam.lookAt(look);
      }
      for (const e of g.enemies) if (pose !== 'vs' && pose !== 'enemy' && e.mech && e.mech.obj) e.mech.obj.visible = false;
      if (pose === 'enemy') { p.mech.obj.visible = false; if (g.rider.obj) g.rider.obj.visible = false; }
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      G.renderer.render(g.scene, g.camera);
    }, pose);
    await page.screenshot({ path: OUT + '/' + file });
  };

  await page.evaluate(() => {
    G.garage('ankys');
    const lions = document.getElementById('g-lions'); if (lions) lions.style.display = 'none';
    const dino = document.getElementById('g-dino'); if (dino) dino.classList.remove('hidden');
    G.frameGarage({ zoom: 1.2, yaw: 0.75 });
  });
  await poll(page, () => G.screen === 'garage' && document.getElementById('g-name').textContent.includes('Ankylosaurus'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/anky-garage.png' });

  await shoot('anky-walk.png', 'walk');
  await shoot('anky-seat.png', 'seat');
  await shoot('anky-smash.png', 'smash');
  await shoot('anky-vs-trex.png', 'vs');
  await shoot('anky-enemy.png', 'enemy');
  await shoot('anky-chase.png', 'chase');

  if (process.env.TRIKE_STILLS === '1') return;
  fs.mkdirSync('/tmp/anky-gait', { recursive: true });
  for (let i = 0; i < 6 * 20; i++) {
    const jpeg = await page.evaluate((i) => {
      const g = G.game, p = g.player, THREE = G.THREE;
      for (const e of g.enemies) if (e.mech && e.mech.obj) e.mech.obj.visible = false;
      p.mech.obj.visible = true;
      if (g.rider.obj) g.rider.obj.visible = true;
      p.pos.set(105 + i * 0.12, 0, 40); p.yaw = Math.PI / 2; p.speedNow = 4; p.smashA = 0; p.roar = 0; p.groundY();
      p.updateVisual(1 / 20);
      const cam = g.camera;
      cam.fov = 38; cam.aspect = 844 / 390; cam.updateProjectionMatrix();
      const look = p.pos.clone(); look.y += p.mech.height * 0.42;
      cam.position.set(look.x, look.y + 1.3, look.z + 18);
      cam.lookAt(look);
      G.renderer.render(g.scene, cam);
      const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.7);
      return url.slice(url.indexOf(',') + 1);
    }, i);
    fs.writeFileSync('/tmp/anky-gait/' + String(i).padStart(4, '0') + '.jpg', Buffer.from(jpeg, 'base64'));
  }
  execFileSync('ffmpeg', ['-y', '-framerate', '20', '-i', '/tmp/anky-gait/%04d.jpg', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', OUT + '/anky-walk.mp4'], { stdio: 'inherit' });
});
