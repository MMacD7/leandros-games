import { test, expect } from '@playwright/test';
import fs from 'fs';
const OUT = '/opt/cursor/artifacts';

async function poll(page, fn, arg, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg).catch(() => false)) return;
    await page.waitForTimeout(150);
  }
  throw new Error('timed out');
}
async function boot(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.screen === 'title' && G.game && G.game.player));
  return errors;
}

test('lion walk then gallop, pure side, fixed frames', async ({ page }) => {
  test.setTimeout(360000);
  const errors = await boot(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => { G.save.jungleLion = true; G.save.jungleCostume = false; G.save.ride = true; if (G.level !== 'jungle') G.setLevel('jungle'); });
  await poll(page, () => G.level === 'jungle' && !!G.game.player, null, 40000);
  await page.evaluate(() => { G.show('play'); G.game.spawnPlayer(false); window.dispatchEvent(new Event('resize')); });
  await poll(page, () => G.screen === 'play' && G.game.player.def.lion === true, null, 20000);
  await page.waitForTimeout(300);
  fs.mkdirSync('/tmp/lion-gait', { recursive: true });

  const spot = await page.evaluate(() => {
    window.__hold = true;
    const w = G.game.world;
    if (w.grass) w.grass.mesh.visible = false;
    if (w.flowers) w.flowers.mesh.visible = false;
    G.game.scene.traverse(o => { if (o.isInstancedMesh) o.visible = false; });
    if (w.baseGroup) w.baseGroup.visible = false;
    for (const e of G.game.enemies) if (e.mech && e.mech.obj) e.mech.obj.visible = false;
    G.renderer.setSize(844, 390, false);
    const cam = G.game.camera;
    cam.aspect = 844 / 390; cam.fov = 58; cam.updateProjectionMatrix();
    let best = null;
    for (let R = 180; R <= 260 && !best; R += 15) {
      for (let a = 0; a < 6.283 && !best; a += 0.18) {
        const cx = Math.cos(a) * R, cz = Math.sin(a) * R;
        const tx = -Math.sin(a), tz = Math.cos(a);
        let minH = 99, maxH = -99, ok = true;
        for (let s = 0; s <= 72; s += 4) {
          const h = w.height(cx + tx * s, cz + tz * s);
          if (h < 0.35 || h > 2.6) { ok = false; break; }
          minH = Math.min(minH, h); maxH = Math.max(maxH, h);
        }
        if (!ok || maxH - minH > 1.3) continue;
        best = { x0: cx, z0: cz, tx, tz, yaw: Math.atan2(tx, tz), y: Math.round((minH + maxH) / 2 * 100) / 100 };
      }
    }
    return best;
  });
  if (!spot) throw new Error('no open path');

  const legs = await page.evaluate((spot) => {
    const p = G.game.player, THREE = G.THREE;
    p.pos.set(spot.x0, 0, spot.z0); p.yaw = spot.yaw; p.groundY();
    p.mech.obj.position.copy(p.pos);
    p.mech.obj.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw + Math.PI);
    p.mech.obj.updateMatrixWorld(true);
    const foot = () => p.mech.legs.map(L => { const v = new THREE.Vector3(); L.g.getWorldPosition(v); return Math.round((v.y - p.pos.y) * 1000) / 1000; });
    const walk = [], gallop = [];
    for (let i = 0; i < 30; i++) { p.mech.animate(1 / 30, 4.2, {}); p.mech.obj.updateMatrixWorld(true); walk.push(foot()); }
    for (let i = 0; i < 24; i++) { p.mech.animate(1 / 30, 13, {}); p.mech.obj.updateMatrixWorld(true); gallop.push(foot()); }
    return { order: ['front-left', 'front-right', 'back-left', 'back-right'], walk, gallop };
  }, spot);
  fs.writeFileSync(OUT + '/v586-legs.json', JSON.stringify(legs));
  const range = (rows) => [0, 1, 2, 3].map(i => {
    const ys = rows.map(r => r[i]);
    return Math.round((Math.max(...ys) - Math.min(...ys)) * 1000) / 1000;
  });
  const walkRange = range(legs.walk), gallopRange = range(legs.gallop);
  fs.writeFileSync(OUT + '/v586-legs-range.json', JSON.stringify({ spot, walkRange, gallopRange }));
  for (const r of [...walkRange, ...gallopRange]) expect(r).toBeGreaterThan(0.2);

  const align = await page.evaluate((spot) => {
    const p = G.game.player, THREE = G.THREE, up = new THREE.Vector3(0, 1, 0);
    const fwd = new THREE.Vector3(Math.sin(spot.yaw), 0, Math.cos(spot.yaw));
    const head = new THREE.Vector3(), tail = new THREE.Vector3();
    let best = 0, bestDot = -2;
    for (let i = 0; i < 24; i++) {
      const extra = i * Math.PI / 12;
      p.mech.obj.quaternion.setFromAxisAngle(up, spot.yaw + extra);
      p.mech.obj.updateMatrixWorld(true);
      p.mech.bones.head.getWorldPosition(head);
      p.mech.bones.tail1.getWorldPosition(tail);
      const nose = head.sub(tail); nose.y = 0; nose.normalize();
      const dot = nose.dot(fwd);
      if (dot > bestDot) { bestDot = dot; best = extra; }
    }
    return { extra: best, dot: Math.round(bestDot * 1000) / 1000 };
  }, spot);
  fs.writeFileSync(OUT + '/v586-align.json', JSON.stringify(align));
  const fps = 30, total = 7 * fps;
  let travelled = 0;
  for (let i = 0; i < total; i++) {
    const speed = i < 3 * fps ? 4.2 : 13;
    travelled += speed / fps;
    const jpeg = await page.evaluate(({ spot, travelled, speed, dt, reset, extra, yawOff }) => {
      const g = G.game, p = g.player, THREE = G.THREE;
      if (reset) { p.mech._clip = ''; p.mech.play('Walk', true, 1); p.mech.actions.Walk.time = 0; }
      p.pos.set(spot.x0 + spot.tx * travelled, 0, spot.z0 + spot.tz * travelled); p.yaw = spot.yaw; p.groundY(); p.speedNow = speed;
      const up = new THREE.Vector3(0, 1, 0);
      p.mech.obj.position.copy(p.pos);
      p.mech.obj.quaternion.setFromAxisAngle(up, p.yaw + extra);
      p.mech.obj.updateMatrixWorld(true);
      p.mech.animate(dt, speed, {});
      if (g.rider) g.rider.update(dt, p);
      p.mech.obj.updateMatrixWorld(true);
      const head = new THREE.Vector3(), tail = new THREE.Vector3(), shL = new THREE.Vector3(), shR = new THREE.Vector3();
      p.mech.bones.head.getWorldPosition(head);
      p.mech.bones.tail1.getWorldPosition(tail);
      p.mech.bones.fl_arm.getWorldPosition(shL);
      p.mech.bones.fr_arm.getWorldPosition(shR);
      const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
      side.applyAxisAngle(up, yawOff);
      const mid = head.clone().lerp(tail, 0.5);
      mid.y = (shL.y + shR.y) * 0.5;
      const length = Math.max(head.distanceTo(tail) * 2.05, 5.4);
      const fov = 58 * Math.PI / 180, aspect = 844 / 390;
      const dist = length / (1.2 * Math.tan(fov / 2) * aspect);
      const cam = g.camera;
      cam.position.copy(mid).addScaledVector(side, dist);
      cam.lookAt(mid);
      G.renderer.render(g.scene, cam);
      const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.7);
      return url.slice(url.indexOf(',') + 1);
    }, { spot, travelled, speed, dt: 1 / fps, reset: i === 0, extra: align.extra, yawOff: 0.85 });
    fs.writeFileSync('/tmp/lion-gait/' + String(i).padStart(4, '0') + '.jpg', Buffer.from(jpeg, 'base64'));
  }
  expect(errors, errors.join('\n')).toEqual([]);
});
