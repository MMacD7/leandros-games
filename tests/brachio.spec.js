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

test('v5.8.8 brachio feet, seat, and stomp', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player));

  const report = await page.evaluate(() => {
    const g = G.game, THREE = G.THREE;
    G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'brachio';
    if (G.level !== 'jungle') G.setLevel('jungle');
    g.spawnPlayer(false);
    const p = g.player, m = p.mech;
    const sk = m.skin;
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
        p.speedNow = name === 'Run' ? 14 : name === 'Walk' ? 5 : 0;
        p.roar = name === 'Roar' ? 1.6 : 0;
        p.rearA = name === 'Stomp' ? 0.7 : 0;
        p.updateVisual(1 / 20);
        if (i < 10) continue;
        const s = gapOf();
        if (s.bury > worst.bury || Math.abs(s.gap) > Math.abs(worst.gap)) worst = { ...s, name };
      }
      return worst;
    };
    const rows = [];
    for (const name of ['Idle', 'Walk', 'Run', 'Roar', 'Stomp']) {
      rows.push({ where: 'flat', ...play(flat, name) });
      rows.push({ where: 'slope', ...play(slope, name) });
    }
    p.pos.set(flat.x, 0, flat.z); p.yaw = 0.2; p.speedNow = 0; p.roar = 0; p.rearA = 0; p.groundY();
    for (let i = 0; i < 8; i++) p.updateVisual(1 / 20);
    const feet0 = m.legs.slice(0, 2).map(L => { const v = new THREE.Vector3(); L.g.getWorldPosition(v); return v.y; });
    m._clip = '';
    p.rearA = 0.9;
    p.updateVisual(1 / 30);
    const act = m.actions.Stomp;
    act.time = 0.52;
    m.mixer.update(0.04);
    if (m.seatOnGround) m.seatOnGround((x, z) => g.world.height(x, z));
    const feet1 = m.legs.slice(0, 2).map(L => { const v = new THREE.Vector3(); L.g.getWorldPosition(v); return v.y; });
    const lift = Math.min(feet1[0] - feet0[0], feet1[1] - feet0[1]);
    g.rider.update(0.05, p);
    const head = new THREE.Vector3(), hips = new THREE.Vector3(), chestW = new THREE.Vector3(), neckW = new THREE.Vector3();
    g.rider.head.getWorldPosition(head);
    g.rider.hips.getWorldPosition(hips);
    m.bones.chest.getWorldPosition(chestW);
    m.bones.neck2.getWorldPosition(neckW);
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
          const edges = [[e0, pa.distanceTo(pb)], [e1, pb.distanceTo(pc)], [e2, pc.distanceTo(ra)]];
          for (const [r, f] of edges) {
            if (r < 0.05) continue;
            const ratio = Math.max(f / r, r / Math.max(f, 1e-4));
            n++; if (ratio > maxR) maxR = ratio; if (ratio > 2.5) hot++;
          }
        }
      }
      return { max: Math.round(maxR * 100) / 100, hot: n ? Math.round(hot / n * 1000) / 1000 : 0 };
    };
    const stretch = {};
    for (const name of ['Idle', 'Walk', 'Run', 'Roar', 'Stomp']) stretch[name] = stretchOf(name);
    const ws = new THREE.Vector3();
    const riderWorld = g.rider.obj.getWorldScale(ws).x;
    const box = new THREE.Box3().setFromObject(m.skin);
    const size = box.getSize(new THREE.Vector3());
    G.save.selected = 'brachiotank'; g.spawnPlayer(false);
    const tank = g.player;
    G.save.selected = 'rex'; g.spawnPlayer(false);
    const round = (row) => ({ ...row, gap: Math.round(row.gap * 1000) / 1000, bury: Math.round(row.bury * 1000) / 1000 });
    return {
      id: 'brachio',
      skinned: m.skinned === true,
      clips: Object.keys(m.actions),
      radius: 4.8,
      height: Math.round(m.height * 100) / 100,
      length: Math.round(size.z * 100) / 100,
      rows: rows.map(round),
      lift: Math.round(lift * 100) / 100,
      clip: m._clip,
      mounted: !!g.rider.mounted,
      seatGap: Math.round((hips.y - p.pos.y) * 100) / 100,
      headAbove: Math.round((head.y - hips.y) * 100) / 100,
      toChest: Math.round(hips.distanceTo(chestW) * 100) / 100,
      toNeck: Math.round(hips.distanceTo(neckW) * 100) / 100,
      stretch,
      riderWorld: Math.round(riderWorld * 100) / 100,
      tankId: tank.def.id,
      tankSkin: tank.mech.skinned === true,
      flat, slope,
    };
  });

  const bad = report.rows.filter(r => r.bury > 0.08 || r.gap < -0.08 || r.gap > 0.42);
  expect(bad, JSON.stringify({ bad, flat: report.flat, slope: report.slope, height: report.height })).toEqual([]);
  expect(report.clips).toEqual(expect.arrayContaining(['Idle', 'Walk', 'Run', 'Roar', 'Stomp']));
  expect(report.height).toBeGreaterThan(9);
  expect(report.height).toBeLessThan(13);
  expect(report.lift).toBeGreaterThan(0.8);
  expect(report.mounted).toBeTruthy();
  expect(report.seatGap).toBeGreaterThan(3);
  expect(report.headAbove).toBeGreaterThan(0.2);
  expect(report.toChest).toBeLessThan(2.4);
  expect(report.toChest).toBeLessThan(report.toNeck);
  expect(report.riderWorld).toBeGreaterThan(1.4);
  expect(report.riderWorld).toBeLessThan(2.2);
  expect(report.tankId).toBe('brachiotank');
  expect(report.tankSkin).toBe(false);

  for (const [name, s] of Object.entries(report.stretch)) {
    expect(s.max, name).toBeLessThan(14);
    expect(s.hot, name).toBeLessThan(0.08);
  }
  if (info.project.name !== 'iphone-landscape') return;
  fs.mkdirSync(OUT, { recursive: true });

  const shoot = async (file, pose) => {
    await page.evaluate((pose) => {
      window.__hold = true;
      G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'brachio';
      if (G.level !== 'jungle') G.setLevel('jungle');
      G.game.spawnPlayer(false);
      G.show('play');
      const g = G.game, p = g.player, THREE = G.THREE, m = p.mech;
      p.speedNow = pose === 'walk' ? 5 : 0;
      p.rearA = pose === 'stomp' ? 0.9 : 0;
      p.roar = 0;
      // The ruins floor is flattened and clear of trees. Both animals stand on it.
      const AX = 105, AZ = 40;
      const place = (x, z) => { p.pos.set(x, 0, z); p.yaw = Math.PI / 2; p.groundY(); };
      place(pose === 'vs' ? AX + 9 : AX, AZ);
      for (let i = 0; i < (pose === 'stomp' ? 8 : 12); i++) p.updateVisual(1 / 20);
      if (pose === 'stomp') {
        const act = m.actions.Stomp;
        act.time = 0.54; m.mixer.update(0.02);
        if (m.seatOnGround) m.seatOnGround((x, z) => g.world.height(x, z));
      }
      g.rider.update(0.05, p);
      if (pose === 'vs') {
        const e = g.spawnEnemy(AX - 9, AZ, 2, 'trex');
        e.pos.set(AX - 9, 0, AZ);
        e.yaw = Math.PI / 2; e.groundY(); e.speedNow = 0;
        for (let i = 0; i < 4; i++) e.updateVisual(0.05);
        e.mech.obj.visible = true;
        e.mech.obj.position.copy(e.pos);
        window.__pair = { x: AX, z: AZ, h: g.world.height(AX, AZ) };
      }
      const yaw = p.yaw;
      const side = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
      const cam = g.camera;
      cam.fov = pose === 'chase' ? 58 : 38;
      cam.aspect = 844 / 390; cam.updateProjectionMatrix();
      G.renderer.setSize(844, 390, false);
      if (pose === 'chase') {
        g.snapCam = true; g.cam.yaw = p.yaw + Math.PI - 0.62; g.cam.pitch = 0.22; g.cam.dist = 8;
        g.updateCamera(1, { looking: false, look: { dx: 0, dy: 0 } });
        g.world.updateLOD(cam.position, { x: p.pos.x, z: p.pos.z, clear: 14 });
      } else if (pose === 'vs') {
        const look = new THREE.Vector3(105, g.world.height(105, 40) + 5.4, 40);
        cam.position.set(105, look.y + 1.6, 40 + 30);
        cam.lookAt(look);
        g.world.updateLOD(cam.position, { x: look.x, z: look.z, clear: 10 });
      } else {
        const look = p.pos.clone();
        look.y += m.height * 0.48;
        cam.position.copy(look).addScaledVector(side, pose === 'stomp' ? 34 : 30);
        cam.position.y = look.y + (pose === 'stomp' ? 3.2 : 1.6);
        cam.lookAt(look);
      }
      for (const e of g.enemies) if (pose !== 'vs' && e.mech && e.mech.obj) e.mech.obj.visible = false;
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      G.renderer.render(g.scene, g.camera);
    }, pose);
    await page.screenshot({ path: OUT + '/' + file });
  };

  await page.evaluate(() => { G.garage('brachio'); G.frameGarage({ zoom: 1.65, yaw: 1.05 }); });
  await poll(page, () => G.screen === 'garage' && document.getElementById('g-name').textContent.includes('Brachiosaurus'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/brachio-garage.png' });

  await shoot('brachio-walk.png', 'walk');
  await shoot('brachio-stomp.png', 'stomp');
  await shoot('brachio-vs-trex.png', 'vs');
  await shoot('brachio-chase.png', 'chase');

  fs.mkdirSync('/tmp/brachio-rear', { recursive: true });
  for (let i = 0; i < 6; i++) {
    const jpeg = await page.evaluate((i) => {
      const g = G.game, p = g.player, m = p.mech, THREE = G.THREE;
      p.speedNow = 0; p.rearA = 0.9; p.roar = 0;
      const act = m.actions.Stomp;
      for (const [n, a] of Object.entries(m.actions)) a.setEffectiveWeight(n === 'Stomp' ? 1 : 0);
      act.enabled = true; act.play();
      act.time = [0.02, 0.22, 0.40, 0.56, 0.78, 1.05][i];
      m.mixer.update(0.001);
      if (m.seatOnGround) m.seatOnGround((x, z) => g.world.height(x, z));
      g.rider.update(0.05, p);
      const cam = g.camera;
      cam.fov = 36; cam.aspect = 844 / 390; cam.updateProjectionMatrix();
      G.renderer.setSize(844, 390, false);
      const look = p.pos.clone(); look.y += m.height * 0.52;
      cam.position.set(p.pos.x, look.y + 4.5, p.pos.z + 38);
      cam.lookAt(look);
      for (const e of g.enemies) if (e.mech && e.mech.obj) e.mech.obj.visible = false;
      G.renderer.render(g.scene, cam);
      const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.82);
      return url.slice(url.indexOf(',') + 1);
    }, i);
    fs.writeFileSync('/tmp/brachio-rear/' + String(i + 1) + '.jpg', Buffer.from(jpeg, 'base64'));
  }
  execFileSync('ffmpeg', ['-y', '-i', '/tmp/brachio-rear/%d.jpg', '-frames:v', '1', '-update', '1', '-filter_complex', 'tile=3x2:margin=4:padding=4', OUT + '/brachio-rearup-sheet.png'], { stdio: 'inherit' });

  if (process.env.BRACHIO_STILLS === '1') return;
  fs.mkdirSync('/tmp/brachio-gait', { recursive: true });
  const fps = 20, total = 6 * fps;
  for (let i = 0; i < total; i++) {
    const jpeg = await page.evaluate((i) => {
      const g = G.game, p = g.player, THREE = G.THREE;
      for (const e of g.enemies) if (e.mech && e.mech.obj) e.mech.obj.visible = false;
      p.pos.set(40 + i * 0.28, 0, 32); p.yaw = Math.PI / 2; p.speedNow = 5; p.rearA = 0; p.roar = 0; p.groundY();
      p.updateVisual(1 / 20);
      const side = new THREE.Vector3(0, 0, 1);
      const cam = g.camera;
      cam.fov = 38; cam.aspect = 844 / 390; cam.updateProjectionMatrix();
      const look = p.pos.clone(); look.y += p.mech.height * 0.5;
      cam.position.copy(look).addScaledVector(side, 28);
      cam.position.y = look.y + 1.4;
      cam.lookAt(look);
      G.renderer.render(g.scene, cam);
      const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.7);
      return url.slice(url.indexOf(',') + 1);
    }, i);
    fs.writeFileSync('/tmp/brachio-gait/' + String(i).padStart(4, '0') + '.jpg', Buffer.from(jpeg, 'base64'));
  }
  execFileSync('ffmpeg', ['-y', '-framerate', '20', '-i', '/tmp/brachio-gait/%04d.jpg', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', OUT + '/brachio-walk.mp4'], { stdio: 'inherit' });
});
