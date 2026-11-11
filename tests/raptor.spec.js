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

test('v5.9.3 raptor feet, stretch, rush, and seat', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player && G.modelsReady !== false));
  await poll(page, () => {
    try { G.save.selected = 'velo'; G.game.spawnPlayer(false); return G.game.player.def.id === 'velo' && G.game.player.mech.skinned; }
    catch (e) { return false; }
  });

  const report = await page.evaluate(() => {
    const g = G.game, THREE = G.THREE;
    G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'velo';
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
    for (let x = -80; x <= 80; x += 4) for (let z = -80; z <= 80; z += 4) {
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
        p.speedNow = name === 'Run' ? 18 : name === 'Walk' ? 5 : 0;
        p.roar = name === 'Roar' ? 1.6 : 0;
        p.pounceA = name === 'Pounce' ? 1 : 0;
        p.updateVisual(1 / 20);
        if (i < 10) continue;
        const s = gapOf();
        if (s.bury > worst.bury || Math.abs(s.gap) > Math.abs(worst.gap)) worst = { ...s, name };
      }
      p.pounceA = 0;
      return worst;
    };
    const rows = [];
    for (const name of ['Idle', 'Walk', 'Run', 'Roar', 'Pounce']) {
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
    for (const name of ['Idle', 'Walk', 'Run', 'Roar', 'Pounce']) stretch[name] = stretchOf(name);
    p.pos.set(flat.x, 0, flat.z); p.yaw = 0.2; p.speedNow = 0; p.roar = 0; p.pounceA = 0; p.groundY();
    m._clip = '';
    for (let i = 0; i < 6; i++) p.updateVisual(1 / 20);
    const hips = new THREE.Vector3(), foot = new THREE.Vector3(), headB = new THREE.Vector3();
    const hide = new THREE.Vector3(), headPt = new THREE.Vector3();
    const hipBone = new THREE.Vector3();
    m.bones.hips.getWorldPosition(hipBone);
    let footLow = Infinity, hipTop = -Infinity;
    const vv = new THREE.Vector3();
    m.obj.updateMatrixWorld(true);
    const attr = sk.geometry.attributes.position;
    for (let i = 0; i < attr.count; i += 2) {
      sk.getVertexPosition(i, vv);
      vv.applyMatrix4(sk.matrixWorld);
      if (vv.y < footLow) footLow = vv.y;
      const dx = vv.x - hipBone.x, dz = vv.z - hipBone.z;
      if (dx * dx + dz * dz < 1.4 && vv.y > hipTop) hipTop = vv.y;
    }
    const box = new THREE.Box3().setFromObject(m.skin);
    const size = box.getSize(new THREE.Vector3());
    m.headTop(headPt);
    const headH = headPt.y - footLow;
    const hipH = hipTop - footLow;
    const ws = new THREE.Vector3();
    const riderWorld = g.rider.obj.getWorldScale(ws).x;
    const seatOf = (name) => {
      p.speedNow = name === 'Run' ? 18 : name === 'Walk' ? 5 : 0;
      p.roar = name === 'Roar' ? 1.4 : 0;
      p.pounceA = name === 'Pounce' ? 1 : 0;
      m._clip = '';
      for (let i = 0; i < (name === 'Pounce' ? 12 : 8); i++) p.updateVisual(1 / 20);
      g.rider.update(0.05, p);
      g.rider.hips.getWorldPosition(hips);
      const back = m.backHide(hide), head = m.headTop(headPt);
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
        belowCrest: head ? Math.round((head.y - hips.y) * 100) / 100 : 0,
        footDrop: Math.round(footDrop * 100) / 100,
        footSide: Math.round(footSide * 100) / 100,
        headAbove: Math.round((headB.y - hips.y) * 100) / 100,
      };
    };
    const seats = ['Walk', 'Run', 'Roar', 'Pounce'].map(seatOf);
    g.special(p);
    let seenClip = '', seenType = '', seenSlam = false;
    for (let i = 0; i < 20; i++) {
      g.updateAct(p, 1 / 20); p.updateVisual(1 / 20);
      if (m._clip === 'Pounce') seenClip = m._clip;
      if (p.act && p.act.type === 'raptorpounce') seenType = p.act.type;
      if (p.act && p.act.slammed || p.pounceHit) seenSlam = true;
    }
    const pounce = { clip: seenClip || m._clip, type: seenType || (p.act && p.act.type), slammed: seenSlam, mounted: !!g.rider.mounted, speed: p.def.speed };
    const round = (row) => ({ ...row, gap: Math.round(row.gap * 1000) / 1000, bury: Math.round(row.bury * 1000) / 1000 });
    return {
      skinned: m.skinned === true,
      quad: m.quad === true,
      clips: Object.keys(m.actions),
      head: Math.round(headH * 100) / 100,
      hip: Math.round(hipH * 100) / 100,
      length: Math.round(size.z * 100) / 100,
      width: Math.round(size.x * 100) / 100,
      radius: p.def.radius,
      special: p.def.special,
      rows: rows.map(round),
      stretch,
      seats,
      riderWorld: Math.round(riderWorld * 100) / 100,
      pounce,
      flat, slope,
    };
  });

  const bad = report.rows.filter(r => r.bury > 0.08 || r.gap < -0.08 || r.gap > 0.45);
  expect(bad, JSON.stringify({ bad, flat: report.flat, slope: report.slope, hip: report.hip, crest: report.head, length: report.length })).toEqual([]);
  expect(report.skinned).toBe(true);
  expect(report.quad).toBe(false);
  expect(report.clips).toEqual(expect.arrayContaining(['Idle', 'Walk', 'Run', 'Roar', 'Pounce']));
  expect(report.hip).toBeGreaterThan(2.3);
  expect(report.hip).toBeLessThan(3.0);
  expect(report.head).toBeGreaterThan(2.8);
  expect(report.head).toBeLessThan(4.6);
  expect(report.length).toBeGreaterThan(6.2);
  expect(report.length).toBeLessThan(8.2);
  expect(report.radius).toBeGreaterThan(2.0);
  expect(report.radius).toBeLessThan(3.2);
  expect(report.special).toBe('raptorpounce');
  expect(report.pounce.speed).toBe(18);
  for (const s of report.seats) {
    expect(s.hipGap, s.name).toBeGreaterThan(-0.3);
    expect(s.hipGap, s.name).toBeLessThan(0.35);
    expect(s.belowCrest, s.name).toBeGreaterThan(s.name === 'Pounce' ? -0.15 : 0.55);
    expect(s.footDrop, s.name).toBeGreaterThan(0.3);
    expect(s.footSide, s.name).toBeGreaterThan(0.25);
    expect(s.headAbove, s.name).toBeGreaterThan(0.15);
  }
  expect(report.riderWorld).toBeGreaterThan(1.15);
  expect(report.riderWorld).toBeLessThan(2.0);
  expect(report.pounce.clip).toBe('Pounce');
  expect(report.pounce.type).toBe('raptorpounce');
  expect(report.pounce.slammed).toBe(true);
  expect(report.pounce.mounted).toBe(true);
  const dataSrc = await page.evaluate(async () => (await fetch('./js/data.js')).text());
  expect(dataSrc).toMatch(/id: 'raptorpack'[\s\S]{0,400}special: 'pack'/);
  const gameSrc = await page.evaluate(async () => (await fetch('./js/game.js')).text());
  expect(gameSrc).toContain("def.id === 'velo' ? new RaptorMech");
  for (const [name, s] of Object.entries(report.stretch)) {
    expect(s.max, name).toBeLessThan(16);
    expect(s.hot, name).toBeLessThan(0.1);
  }

  await page.evaluate(() => { G.show('play'); });
  await expect(page.locator('#a-missile')).toContainText('POUNCE');
  await expect(page.locator('#b-pause')).toBeVisible();

  if (info.project.name !== 'iphone-landscape') return;
  fs.mkdirSync(OUT, { recursive: true });
  console.log('velo', JSON.stringify({ hip: report.hip, crest: report.head, length: report.length, width: report.width, radius: report.radius, seats: report.seats, stretch: report.stretch }));

  const shoot = async (file, pose) => {
    await page.evaluate((pose) => {
      window.__hold = true;
      G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'velo';
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
      p.roar = 0; p.pounceA = 0;
      p.pos.set(pose === 'vs' ? AX + 10 : AX, 0, AZ); p.yaw = Math.PI / 2; p.groundY();
      for (let i = 0; i < 8; i++) p.updateVisual(1 / 20);
      if (pose === 'pounce') {
        g.special(p);
        for (let i = 0; i < 40; i++) {
          g.updateAct(p, 1 / 30);
          p.updateVisual(1 / 30);
          g.fx.update(1 / 30, g.world, () => {}, g.scene.fog);
          if (p.act && p.act.dur && p.act.t / p.act.dur > 0.58) {
            const ring = p.pos.clone(); ring.y = p.ground || 0;
            g.fx.ring(ring, 8, 0x4aa0ff);
            g.fx.update(1 / 30, g.world, () => {}, g.scene.fog);
            break;
          }
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
        g.spawnEnemy(AX, AZ, 2, 'velo');
        const pack = g.enemies.filter(en => en.def && en.def.id === 'velo');
        pack.forEach((en, i) => {
          en.pos.set(AX - 8 + i * 8, 0, AZ); en.yaw = Math.PI / 2; en.groundY(); en.speedNow = 6;
          for (let k = 0; k < 10; k++) en.updateVisual(1 / 20);
          en.mech.obj.visible = true;
        });
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
        cam.position.set(AX, look.y + 2.2, AZ - (pose === 'vs' ? 28 : 26));
        cam.lookAt(look);
      } else if (pose === 'seat') {
        const look = new THREE.Vector3();
        g.rider.hips.getWorldPosition(look);
        cam.fov = 34; cam.updateProjectionMatrix();
        cam.position.set(look.x, look.y + 0.45, look.z + 7.4);
        cam.lookAt(look.x + 0.2, look.y - 0.1, look.z);
      } else {
        const look = p.pos.clone(); look.y += m.height * 0.42;
        if (pose === 'pounce') {
          const gy = p.ground || 0;
          cam.position.set(p.pos.x - 3, gy + 3.4, p.pos.z + 20);
          cam.lookAt(p.pos.x + 2, gy + 2.4, p.pos.z);
        } else {
          cam.position.set(look.x, look.y + 1.3, look.z + 16);
          cam.lookAt(look);
        }
      }
      for (const e of g.enemies) if (pose !== 'vs' && pose !== 'enemy' && e.mech && e.mech.obj) e.mech.obj.visible = false;
      if (pose === 'enemy') { p.mech.obj.visible = false; if (g.rider.obj) g.rider.obj.visible = false; }
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      G.renderer.render(g.scene, g.camera);
    }, pose);
    await page.screenshot({ path: OUT + '/' + file });
  };

  await page.evaluate(() => {
    G.garage('velo');
    const lions = document.getElementById('g-lions'); if (lions) lions.style.display = 'none';
    const dino = document.getElementById('g-dino'); if (dino) dino.classList.remove('hidden');
    G.frameGarage({ zoom: 1.2, yaw: 0.75 });
  });
  await poll(page, () => G.screen === 'garage' && document.getElementById('g-name').textContent.includes('Velociraptor'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/raptor-garage.png' });

  await shoot('raptor-walk.png', 'walk');
  await shoot('raptor-seat.png', 'seat');
  await shoot('raptor-pounce.png', 'pounce');
  await shoot('raptor-vs-trex.png', 'vs');
  await shoot('raptor-enemy.png', 'enemy');
  await shoot('raptor-chase.png', 'chase');

  if (process.env.RAPTOR_STILLS === '1') return;
  fs.mkdirSync('/tmp/raptor-gait', { recursive: true });
  for (let i = 0; i < 6 * 20; i++) {
    const jpeg = await page.evaluate((i) => {
      const g = G.game, p = g.player, THREE = G.THREE;
      for (const e of g.enemies) if (e.mech && e.mech.obj) e.mech.obj.visible = false;
      p.mech.obj.visible = true;
      if (g.rider.obj) g.rider.obj.visible = true;
      p.pos.set(105 + i * 0.18, 0, 40); p.yaw = Math.PI / 2; p.speedNow = 5; p.pounceA = 0; p.roar = 0; p.groundY();
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
    fs.writeFileSync('/tmp/raptor-gait/' + String(i).padStart(4, '0') + '.jpg', Buffer.from(jpeg, 'base64'));
  }
  execFileSync('ffmpeg', ['-y', '-framerate', '20', '-i', '/tmp/raptor-gait/%04d.jpg', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', OUT + '/raptor-walk.mp4'], { stdio: 'inherit' });
});
