import { test, expect } from '@playwright/test';
import fs from 'fs';

const OUT = '/opt/cursor/artifacts';

async function poll(page, fn, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn).catch(() => false)) return;
    await page.waitForTimeout(150);
  }
  throw new Error('timed out');
}

test('v5.10.2 para size, seat, crest honk, and herd', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player));
  const report = await page.evaluate(() => {
    G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'para';
    if (G.level !== 'jungle') G.setLevel('jungle');
    G.show('play');
    G.game.spawnPlayer(false);
    const g = G.game, p = g.player, m = p.mech, THREE = G.THREE, sk = m.skin;
    const flat = { x: 80, z: 24 }, slope = { x: 140, z: -200 };
    const play = (spot, name) => {
      p.pos.set(spot.x, 0, spot.z); p.yaw = 0.3; p.speedNow = name === 'Run' ? 11 : name === 'Walk' ? 4 : 0;
      p.roar = name === 'Roar' ? 1.2 : 0; p.chargeA = name === 'Honk' ? 1 : 0; p.groundY();
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
        for (let t = 0; t < tris.length; t += 12) {
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
    for (const name of ['Idle', 'Walk', 'Run', 'Roar', 'Honk']) stretch[name] = stretchOf(name);
    p.pos.set(flat.x, 0, flat.z); p.yaw = 0; p.speedNow = 0; p.roar = 0; p.chargeA = 0; p.groundY();
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
      p.speedNow = name === 'Run' ? 11 : name === 'Walk' ? 4 : 0;
      p.roar = name === 'Roar' ? 1.3 : 0;
      p.chargeA = name === 'Honk' ? 1 : 0;
      p.yaw = 0; m._clip = '';
      for (let i = 0; i < 8; i++) p.updateVisual(1 / 20);
      g.rider.update(0.05, p);
      const hips = new THREE.Vector3(), back = new THREE.Vector3(), top = new THREE.Vector3();
      g.rider.hips.getWorldPosition(hips);
      const hide = m.backHide(back);
      m.crestTop(top);
      const fwd = new THREE.Vector3(0, 0, 1);
      let near = 99;
      const v = new THREE.Vector3();
      for (let i = 0; i < attr.count; i += 4) {
        sk.getVertexPosition(i, v);
        if (v.y < 0.36) continue;
        v.applyMatrix4(sk.matrixWorld);
        const d = v.distanceTo(hips);
        if (d < near) near = d;
      }
      return {
        name,
        hipGap: hide ? Math.round((hips.y - hide.y) * 100) / 100 : 99,
        crestAhead: Math.round(top.clone().sub(hips).dot(fwd) * 100) / 100,
        crestClear: Math.round(near * 100) / 100,
      };
    };
    const seats = ['Walk', 'Run', 'Roar', 'Honk'].map(seatOf);
    p.chargeA = 0; p.yaw = 0; p.speedNow = 0; p.groundY();
    for (const e of g.enemies) if (e.remove) e.remove();
    g.enemies.length = 0;
    const foe = g.spawnEnemy(p.pos.x, p.pos.z + 6, 2, 'pachy', { lone: true });
    foe.hp = foe.maxHp = 200; foe.pos.set(p.pos.x, 0, p.pos.z + 6); foe.groundY();
    const hpBefore = foe.hp;
    g.special(p);
    let seenClip = '', blown = false, damaged = false, stunned = false;
    for (let i = 0; i < 24; i++) {
      g.updateAct(p, 1 / 20); p.updateVisual(1 / 20);
      if (m._clip === 'Honk') seenClip = 'Honk';
      if (p.act && p.act.blown) blown = true;
      if (foe.hp < hpBefore) damaged = true;
      if (foe.stunT > 0) stunned = true;
    }
    for (const e of g.enemies) if (e.remove) e.remove();
    g.enemies.length = 0;
    g.spawnEnemy(200, -40, 2, 'para');
    const herd = g.enemies.filter(e => e.def && e.def.id === 'para');
    const grazer = herd[0];
    p.pos.set(grazer.pos.x + 8, 0, grazer.pos.z); p.groundY();
    let grazed = grazer.ai.state;
    for (let i = 0; i < 8; i++) g.think(grazer, 0.25);
    const beforeHit = grazer.ai.state;
    grazer.hit(8, p.pos, p);
    let blocky = 0, skin = 0;
    g.rider.obj.traverse(o => { if (o.isMesh && o.visible && o.userData.blocky) blocky++; if (o.isSkinnedMesh && o.visible) skin++; });
    return {
      skinned: m.skinned === true,
      clips: Object.keys(m.actions),
      crest: Math.round((crest.y - footLow) * 100) / 100,
      hip: Math.round((hip.y - footLow) * 100) / 100,
      length: Math.round((maxZ - minZ) * 100) / 100,
      width: Math.round((maxX - minX) * 100) / 100,
      radius: p.def.radius, speed: p.def.speed, hp: p.def.hp, special: p.def.special, gentle: p.def.gentle === true,
      rows, stretch, seats, riderWorld: Math.round(riderWorld * 100) / 100,
      honk: { clip: seenClip, blown, damaged, stunned, foeHp: foe.hp, mounted: !!g.rider.mounted, blocky, skin },
      herd: herd.length, grazed, beforeHit, provoked: grazer.provoked === true, afterHit: grazer.ai.state,
    };
  });
  const bad = report.rows.filter(r => r.bury > 0.08 || r.gap < -0.08 || r.gap > 0.55);
  expect(bad, JSON.stringify({ bad, crest: report.crest, hip: report.hip, length: report.length })).toEqual([]);
  expect(report.skinned).toBe(true);
  expect(report.clips).toEqual(expect.arrayContaining(['Idle', 'Walk', 'Run', 'Roar', 'Honk']));
  expect(report.length).toBeGreaterThan(8.8);
  expect(report.length).toBeLessThan(10.3);
  expect(report.crest).toBeGreaterThan(4.3);
  expect(report.crest).toBeLessThan(5.5);
  expect(report.hip).toBeGreaterThan(2.6);
  expect(report.hip).toBeLessThan(3.9);
  expect(report.radius).toBeGreaterThan(2.8);
  expect(report.radius).toBeLessThan(4);
  expect(report.gentle).toBe(true);
  expect(report.special).toBe('cresthonk');
  expect(report.riderWorld).toBeGreaterThan(1.4);
  expect(report.riderWorld).toBeLessThan(1.7);
  for (const s of report.seats) {
    expect(Math.abs(s.hipGap), s.name).toBeLessThan(0.5);
    expect(s.crestAhead, s.name).toBeGreaterThan(0.4);
    expect(s.crestClear, s.name).toBeGreaterThan(0.25);
  }
  expect(report.honk.clip).toBe('Honk');
  expect(report.honk.blown).toBe(true);
  expect(report.honk.damaged).toBe(true);
  expect(report.honk.stunned).toBe(true);
  expect(report.honk.mounted).toBe(true);
  expect(report.honk.blocky).toBe(0);
  expect(report.herd).toBeGreaterThanOrEqual(2);
  expect(report.herd).toBeLessThanOrEqual(3);
  expect(report.beforeHit).toBe('patrol');
  expect(report.provoked).toBe(true);
  expect(report.afterHit).toBe('chase');
  for (const [name, s] of Object.entries(report.stretch)) {
    expect(s.max, name).toBeLessThan(16);
    expect(s.hot, name).toBeLessThan(0.1);
  }
  await page.evaluate(() => { G.show('play'); G.game.spawnPlayer(false); });
  await expect(page.locator('#a-missile')).toContainText('CREST');
  await expect(page.locator('#a-missile')).toContainText('HONK');
  await expect(page.locator('#b-pause')).toBeVisible();
  fs.mkdirSync('/tmp', { recursive: true });
  fs.writeFileSync('/tmp/para-report.json', JSON.stringify(report));
  if (info.project.name !== 'iphone-landscape') return;
  fs.mkdirSync(OUT, { recursive: true });

  const shoot = async (file, pose) => {
    await page.evaluate((pose) => {
      window.__hold = true;
      G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'para';
      if (G.level !== 'jungle') G.setLevel('jungle');
      G.game.spawnPlayer(false);
      G.show('play');
      const g = G.game, p = g.player, THREE = G.THREE, m = p.mech;
      for (const r of g.fx.rings.splice(0)) { g.scene.remove(r.m); if (r.m.material) r.m.material.dispose(); }
      for (const e of g.enemies) if (e.remove) e.remove();
      g.enemies.length = 0;
      const AX = 210, AZ = -150;
      p.speedNow = pose === 'side' || pose === 'ride' ? 4 : 0;
      p.roar = 0; p.chargeA = 0;
      p.pos.set(AX, 0, AZ); p.yaw = 0.35; p.groundY();
      for (let i = 0; i < 8; i++) p.updateVisual(1 / 20);
      if (pose === 'honk') {
        g.special(p);
        for (let i = 0; i < 20; i++) {
          g.updateAct(p, 1 / 30); p.updateVisual(1 / 30);
          g.fx.update(1 / 30, g.world, () => {}, g.scene.fog);
          if (p.act && p.act.blown) break;
        }
      }
      if (pose === 'herd') {
        p.mech.obj.visible = false;
        if (g.rider.obj) g.rider.obj.visible = false;
        g.spawnEnemy(AX, AZ, 2, 'para');
        g.enemies.forEach((e, i) => {
          e.pos.set(AX + (i - 1) * 4.2, 0, AZ + (i % 2) * 2);
          e.yaw = 0.4; e.groundY(); e.speedNow = 2;
          for (let k = 0; k < 8; k++) e.updateVisual(1 / 20);
          e.mech.obj.visible = true;
        });
      }
      g.rider.update(0.05, p);
      if (pose !== 'honk') for (let i = 0; i < 16; i++) g.fx.update(0.1, g.world, () => {}, g.scene.fog);
      const cam = g.camera;
      cam.aspect = 844 / 390; cam.updateProjectionMatrix();
      G.renderer.setSize(844, 390, false);
      const ground = g.world.height(AX, AZ);
      if (pose === 'side') {
        const look = p.pos.clone(); look.y += m.height * 0.45;
        cam.fov = 38; cam.updateProjectionMatrix();
        cam.position.set(look.x + 14, look.y + 1.2, look.z);
        cam.lookAt(look);
      } else if (pose === 'ride') {
        const look = p.pos.clone(); look.y += m.height * 0.42;
        cam.fov = 40; cam.updateProjectionMatrix();
        cam.position.set(look.x + 16, look.y + 4.5, look.z + 18);
        cam.lookAt(look);
      } else if (pose === 'honk') {
        const look = p.pos.clone(); look.y += 2.4;
        cam.fov = 42; cam.updateProjectionMatrix();
        cam.position.set(look.x + 10, look.y + 2.4, look.z + 4);
        cam.lookAt(look.x, look.y + 0.6, look.z + 2);
      } else if (pose === 'herd') {
        cam.fov = 46; cam.updateProjectionMatrix();
        cam.position.set(AX + 16, ground + 5, AZ + 10);
        cam.lookAt(AX, ground + 2.2, AZ);
      }
      if (pose !== 'herd') for (const e of g.enemies) if (e.mech && e.mech.obj) e.mech.obj.visible = false;
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      G.renderer.render(g.scene, cam);
    }, pose);
    await page.screenshot({ path: OUT + '/' + file });
  };

  await page.evaluate(() => {
    G.garage('para');
    const lions = document.getElementById('g-lions'); if (lions) lions.style.display = 'none';
    const babies = document.getElementById('g-babies'); if (babies) babies.style.display = 'none';
  });
  await poll(page, () => document.getElementById('g-name').textContent.includes('Parasaurolophus'));
  await page.evaluate(() => {
    const panel = document.querySelector('.g-panel');
    const card = document.querySelector('.sd-card[data-super="para"]');
    if (panel && card) panel.scrollTop = Math.max(0, card.offsetTop - 36);
  });
  await page.screenshot({ path: OUT + '/para-garage.png' });
  await shoot('para-side.png', 'side');
  await shoot('para-ride.png', 'ride');
  await shoot('para-honk.png', 'honk');
  await shoot('para-herd.png', 'herd');
});
