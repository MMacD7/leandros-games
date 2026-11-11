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

test('v5.8.9 giga feet, stretch, slash, and seat', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player));

  const report = await page.evaluate(() => {
    const g = G.game, THREE = G.THREE;
    G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'giga';
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
        p.speedNow = name === 'Run' ? 14 : name === 'Walk' ? 5 : 0;
        p.roar = name === 'Roar' ? 1.6 : 0;
        p.slashA = name === 'Slash' ? 1 : 0;
        p.updateVisual(1 / 20);
        if (i < 10) continue;
        const s = gapOf();
        if (s.bury > worst.bury || Math.abs(s.gap) > Math.abs(worst.gap)) worst = { ...s, name };
      }
      p.slashA = 0;
      return worst;
    };
    const rows = [];
    for (const name of ['Idle', 'Walk', 'Run', 'Roar', 'Slash']) {
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
    for (const name of ['Idle', 'Walk', 'Run', 'Roar', 'Slash']) stretch[name] = stretchOf(name);
    p.pos.set(flat.x, 0, flat.z); p.yaw = 0.2; p.speedNow = 0; p.roar = 0; p.slashA = 0; p.groundY();
    for (let i = 0; i < 6; i++) p.updateVisual(1 / 20);
    g.rider.update(0.05, p);
    const head = new THREE.Vector3(), hips = new THREE.Vector3(), spineW = new THREE.Vector3();
    g.rider.head.getWorldPosition(head);
    g.rider.hips.getWorldPosition(hips);
    m.bones.spine.getWorldPosition(spineW);
    const box = new THREE.Box3().setFromObject(m.skin);
    const size = box.getSize(new THREE.Vector3());
    const ws = new THREE.Vector3();
    const riderWorld = g.rider.obj.getWorldScale(ws).x;
    g.special(p);
    for (let i = 0; i < 10; i++) { g.updateAct(p, 1 / 20); p.updateVisual(1 / 20); }
    const slash = { clip: m._clip, type: p.act && p.act.type, swept: !!(p.act && p.act.swept), mounted: !!g.rider.mounted };
    const round = (row) => ({ ...row, gap: Math.round(row.gap * 1000) / 1000, bury: Math.round(row.bury * 1000) / 1000 });
    return {
      skinned: m.skinned === true,
      clips: Object.keys(m.actions),
      height: Math.round(m.height * 100) / 100,
      length: Math.round(size.z * 100) / 100,
      width: Math.round(size.x * 100) / 100,
      radius: p.def.radius,
      special: p.def.special,
      rows: rows.map(round),
      stretch,
      toSpine: Math.round(hips.distanceTo(spineW) * 100) / 100,
      headAbove: Math.round((head.y - hips.y) * 100) / 100,
      seatGap: Math.round((hips.y - p.pos.y) * 100) / 100,
      riderWorld: Math.round(riderWorld * 100) / 100,
      slash,
      flat, slope,
    };
  });

  const bad = report.rows.filter(r => r.bury > 0.08 || r.gap < -0.08 || r.gap > 0.45);
  expect(bad, JSON.stringify({ bad, flat: report.flat, slope: report.slope, height: report.height })).toEqual([]);
  expect(report.skinned).toBe(true);
  expect(report.clips).toEqual(expect.arrayContaining(['Idle', 'Walk', 'Run', 'Roar', 'Slash']));
  expect(report.height).toBeGreaterThan(6.2);
  expect(report.height).toBeLessThan(6.9);
  expect(report.length).toBeGreaterThan(10.5);
  expect(report.radius).toBeGreaterThan(3.75);
  expect(report.special).toBe('slash');
  expect(report.toSpine).toBeLessThan(2.2);
  expect(report.headAbove).toBeGreaterThan(0.2);
  expect(report.seatGap).toBeGreaterThan(2.2);
  expect(report.riderWorld).toBeGreaterThan(1.4);
  expect(report.riderWorld).toBeLessThan(2.2);
  expect(report.slash.clip).toBe('Slash');
  expect(report.slash.type).toBe('slash');
  expect(report.slash.swept).toBe(true);
  expect(report.slash.mounted).toBe(true);
  const dataSrc = await page.evaluate(async () => (await fetch('./js/data.js')).text());
  expect(dataSrc).toMatch(/id: 'megarex'[\s\S]{0,500}special: 'stomp'/);
  const gameSrc = await page.evaluate(async () => (await fetch('./js/game.js')).text());
  expect(gameSrc).toContain("def.id === 'giga' ? new GigaMech");
  for (const [name, s] of Object.entries(report.stretch)) {
    expect(s.max, name).toBeLessThan(16);
    expect(s.hot, name).toBeLessThan(0.1);
  }

  await page.evaluate(() => { G.show('play'); });
  await expect(page.locator('#a-missile')).toContainText('SLASH');
  await expect(page.locator('#b-pause')).toBeVisible();

  if (info.project.name !== 'iphone-landscape') return;
  fs.mkdirSync(OUT, { recursive: true });
  console.log('giga', JSON.stringify({ height: report.height, length: report.length, width: report.width, radius: report.radius, stretch: report.stretch, toSpine: report.toSpine, seatGap: report.seatGap }));

  const shoot = async (file, pose) => {
    await page.evaluate((pose) => {
      window.__hold = true;
      G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'giga';
      if (G.level !== 'jungle') G.setLevel('jungle');
      G.game.spawnPlayer(false);
      G.show('play');
      const g = G.game, p = g.player, THREE = G.THREE, m = p.mech;
      for (const e of g.enemies) if (e.remove) e.remove();
      g.enemies.length = 0;
      const AX = 105, AZ = 40;
      p.speedNow = pose === 'walk' ? 5 : 0;
      p.roar = 0; p.slashA = 0;
      p.pos.set(pose === 'vs' ? AX + 8 : AX, 0, AZ); p.yaw = Math.PI / 2; p.groundY();
      for (let i = 0; i < 10; i++) p.updateVisual(1 / 20);
      if (pose === 'slash') {
        const act = m.actions.Slash;
        for (const [n, a] of Object.entries(m.actions)) a.setEffectiveWeight(n === 'Slash' ? 1 : 0);
        act.enabled = true; act.play(); act.time = 0.48;
        m.mixer.update(0.02);
        if (m.seatOnGround) m.seatOnGround((x, z) => g.world.height(x, z));
      }
      g.rider.update(0.05, p);
      if (pose === 'vs') {
        const e = g.spawnEnemy(AX - 8, AZ, 2, 'trex');
        e.pos.set(AX - 8, 0, AZ); e.yaw = Math.PI / 2; e.groundY(); e.speedNow = 0;
        for (let i = 0; i < 4; i++) e.updateVisual(0.05);
        e.mech.obj.visible = true; e.mech.obj.position.copy(e.pos);
      }
      if (pose === 'enemy') {
        p.mech.obj.visible = false;
        if (g.rider.obj) g.rider.obj.visible = false;
        const e = g.spawnEnemy(AX, AZ, 2, 'giga');
        e.pos.set(AX, 0, AZ); e.yaw = Math.PI / 2; e.groundY(); e.speedNow = 5;
        for (let i = 0; i < 10; i++) e.updateVisual(1 / 20);
        e.mech.obj.visible = true; e.mech.obj.position.copy(e.pos);
      }
      const cam = g.camera;
      cam.fov = pose === 'chase' ? 58 : 38;
      cam.aspect = 844 / 390; cam.updateProjectionMatrix();
      G.renderer.setSize(844, 390, false);
      if (pose === 'chase') {
        g.snapCam = true; g.cam.yaw = p.yaw + Math.PI - 0.55; g.cam.pitch = 0.2; g.cam.dist = 8;
        g.updateCamera(1, { looking: false, look: { dx: 0, dy: 0 } });
        g.world.updateLOD(cam.position, { x: p.pos.x, z: p.pos.z, clear: 8 });
      } else if (pose === 'vs' || pose === 'enemy') {
        const look = new THREE.Vector3(AX, g.world.height(AX, AZ) + 3.6, AZ);
        cam.position.set(AX, look.y + 1.4, AZ + (pose === 'enemy' ? 26 : 32));
        cam.lookAt(look);
      } else {
        const look = p.pos.clone(); look.y += m.height * 0.55;
        const side = new THREE.Vector3(0, 0, 1);
        cam.position.copy(look).addScaledVector(side, pose === 'slash' ? 16 : 18);
        cam.position.y = look.y + 1.2;
        cam.lookAt(look);
      }
      for (const e of g.enemies) if (pose !== 'vs' && pose !== 'enemy' && e.mech && e.mech.obj) e.mech.obj.visible = false;
      if (pose === 'enemy') { p.mech.obj.visible = false; if (g.rider.obj) g.rider.obj.visible = false; }
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      G.renderer.render(g.scene, g.camera);
    }, pose);
    await page.screenshot({ path: OUT + '/' + file });
  };

  await page.evaluate(() => { G.garage('giga'); const t = document.getElementById('t-real'); if (t) t.click(); G.frameGarage({ zoom: 1.35, yaw: 0.9 }); });
  await poll(page, () => G.screen === 'garage' && document.getElementById('g-name').textContent.includes('Giganotosaurus'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/giga-garage.png' });

  await shoot('giga-walk.png', 'walk');
  await shoot('giga-slash.png', 'slash');
  await shoot('giga-vs-trex.png', 'vs');
  await shoot('giga-enemy.png', 'enemy');
  await shoot('giga-chase.png', 'chase');

  if (process.env.GIGA_STILLS === '1') return;
  fs.mkdirSync('/tmp/giga-gait', { recursive: true });
  const fps = 20, total = 6 * fps;
  for (let i = 0; i < total; i++) {
    const jpeg = await page.evaluate((i) => {
      const g = G.game, p = g.player, THREE = G.THREE;
      for (const e of g.enemies) if (e.mech && e.mech.obj) e.mech.obj.visible = false;
      p.mech.obj.visible = true;
      p.pos.set(105 + i * 0.22, 0, 40); p.yaw = Math.PI / 2; p.speedNow = 5; p.slashA = 0; p.roar = 0; p.groundY();
      p.updateVisual(1 / 20);
      const cam = g.camera;
      cam.fov = 38; cam.aspect = 844 / 390; cam.updateProjectionMatrix();
      const look = p.pos.clone(); look.y += p.mech.height * 0.55;
      cam.position.set(look.x, look.y + 1.3, look.z + 18);
      cam.lookAt(look);
      G.renderer.render(g.scene, cam);
      const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.7);
      return url.slice(url.indexOf(',') + 1);
    }, i);
    fs.writeFileSync('/tmp/giga-gait/' + String(i).padStart(4, '0') + '.jpg', Buffer.from(jpeg, 'base64'));
  }
  execFileSync('ffmpeg', ['-y', '-framerate', '20', '-i', '/tmp/giga-gait/%04d.jpg', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', OUT + '/giga-walk.mp4'], { stdio: 'inherit' });
});
