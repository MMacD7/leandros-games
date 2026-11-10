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

test('lion walk then gallop, side on, fixed frames', async ({ page }) => {
  test.setTimeout(240000);
  const errors = await boot(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => { G.save.jungleLion = true; G.save.jungleCostume = false; G.save.ride = true; if (G.level !== 'jungle') G.setLevel('jungle'); });
  await poll(page, () => G.level === 'jungle' && !!G.game.player, null, 40000);
  await page.evaluate(() => { G.show('play'); G.game.spawnPlayer(false); });
  await poll(page, () => G.screen === 'play' && G.game.player.def.lion === true, null, 20000);
  await page.waitForTimeout(400);
  fs.mkdirSync('/tmp/lion-gait', { recursive: true });
  const fps = 12, total = 6 * fps;
  const legs = await page.evaluate(() => {
    const g = G.game, p = g.player, THREE = G.THREE;
    const home = p.pos.clone(); const yaw = p.yaw;
    const pin = () => { p.pos.copy(home); p.yaw = yaw; p.groundY(); };
    pin();
    const foot = () => p.mech.legs.map(L => { const v = new THREE.Vector3(); L.g.getWorldPosition(v); return Math.round(v.y * 1000) / 1000; });
    const walk = [], gallop = [];
    for (let i = 0; i < 24; i++) { pin(); p.mech.animate(1 / 12, 5, {}); walk.push(foot()); }
    for (let i = 0; i < 24; i++) { pin(); p.mech.animate(1 / 12, 13, {}); gallop.push(foot()); }
    return { order: ['front-left', 'front-right', 'back-left', 'back-right'], walk, gallop, home: [home.x, home.z], yaw };
  });
  fs.writeFileSync(OUT + '/v586-legs.json', JSON.stringify(legs));
  const spot = await page.evaluate(() => {
    window.__hold = true;
    const w = G.game.world, p = G.game.player;
    let x = p.pos.x, z = p.pos.z;
    for (let i = 0; i < 24; i++) {
      const h = w.height(x, z);
      if (h > 0.15 && h < 1.05) break;
      let bx = x, bz = z, bh = h;
      for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) {
        const hh = w.height(x + dx, z + dz);
        if (hh < bh) { bh = hh; bx = x + dx; bz = z + dz; }
      }
      if (bx === x && bz === z) break;
      x = bx; z = bz;
    }
    return { x, z, y: Math.round(w.height(x, z) * 100) / 100 };
  });
  const range = (rows) => [0, 1, 2, 3].map(i => {
    const ys = rows.map(r => r[i]);
    return Math.round((Math.max(...ys) - Math.min(...ys)) * 1000) / 1000;
  });
  const walkRange = range(legs.walk), gallopRange = range(legs.gallop);
  fs.writeFileSync(OUT + '/v586-legs-range.json', JSON.stringify({ walkRange, gallopRange }));
  for (const r of [...walkRange, ...gallopRange]) expect(r).toBeGreaterThan(0.08);
  for (let i = 0; i < total; i++) {
    const jpeg = await page.evaluate(({ i, spot }) => {
      const g = G.game, p = g.player, THREE = G.THREE;
      const dt = 1 / 12, speed = i < 12 * 2.5 ? 4.6 : 13.5;
      p.pos.set(spot.x, 0, spot.z); p.yaw = 0.15; p.groundY(); p.speedNow = 0;
      const up = new THREE.Vector3(0, 1, 0);
      p.mech.obj.position.copy(p.pos);
      p.mech.obj.quaternion.setFromAxisAngle(up, p.yaw);
      p.mech.obj.updateMatrixWorld(true);
      p.mech.animate(dt, speed, {});
      if (g.rider) g.rider.update(dt, p);
      p.mech.obj.updateMatrixWorld(true);
      const look = new THREE.Vector3();
      p.mech.body.getWorldPosition(look);
      const yaw = p.yaw + Math.PI / 2, dist = 6.2;
      const cam = g.camera;
      cam.position.set(look.x + Math.sin(yaw) * dist, look.y + 0.55, look.z + Math.cos(yaw) * dist);
      cam.lookAt(look.x, look.y + 0.05, look.z);
      G.renderer.render(g.scene, cam);
      const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.72);
      return url.slice(url.indexOf(',') + 1);
    }, { i, spot });
    fs.writeFileSync('/tmp/lion-gait/' + String(i).padStart(4, '0') + '.jpg', Buffer.from(jpeg, 'base64'));
  }
  expect(errors, errors.join('\n')).toEqual([]);
});
