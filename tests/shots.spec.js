import { test, expect } from '@playwright/test';
import fs from 'fs';

async function poll(page, fn, arg, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg).catch(() => false)) return;
    await page.waitForTimeout(150);
  }
  throw new Error('timed out');
}
async function ready(page) {
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.screen === 'title' && G.game && G.game.player));
}
async function go(page, lv) {
  await page.evaluate(lv => { if (G.level !== lv) G.setLevel(lv); }, lv);
  await poll(page, lv => G.level === lv && !!G.game.player, lv, 30000);
}
const OUT = '/opt/cursor/artifacts';

test('close-up iPhone landscape shots', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { } });
  await ready(page);
  await page.locator('#b-garage').click();
  await poll(page, () => G.screen === 'garage');
  await page.evaluate(() => G.frameGarage({ zoom: 0.38, yaw: 0.7 }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/v582-lion-garage-iphone.png' });

  await page.locator('#jg-costume').click();
  await poll(page, () => G.save.jungleCostume === true);
  await page.evaluate(() => G.frameGarage({ zoom: 0.34, yaw: 0.95 }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/v582-costume-garage-iphone.png' });
  await page.evaluate(() => G.frameGarage(null));

  await page.locator('#g-back').click();
  await poll(page, () => G.screen === 'title');
  await go(page, 'jungle');
  await page.evaluate(() => G.show('play'));
  await poll(page, () => G.screen === 'play');
  await page.evaluate(() => {
    const g = G.game, p = g.player, THREE = G.THREE;
    document.getElementById('toast').classList.remove('show');
    p.speedNow = 0;
    const spots = [[55, 165], [70, 150], [30, 145], [80, 175]];
    for (const [x, z] of spots) if (g.world.height(x, z) > 0.4) { p.place(x, z, 0.4); break; }
    const look = new THREE.Vector3();
    g.camHook = (cam) => {
      p.mech.rider.getWorldPosition(look); look.y += 0.05;
      const yaw = p.yaw + 0.85, dist = 4.8, pitch = 0.32;
      cam.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      cam.lookAt(look);
    };
    G.sim(0.08);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + '/v582-costume-jungle-iphone.png' });

  await page.evaluate(() => {
    G.game.camHook = null; G.save.jungleCostume = false; G.save.jungleLion = true; G.save.farmLion = true;
    G.game.spawnPlayer(false);
  });
  await page.evaluate(() => {
    const g = G.game, p = g.player, THREE = G.THREE;
    document.getElementById('toast').classList.remove('show');
    p.speedNow = 0;
    if (g.world.height(55, 165) > 0.4) p.place(55, 165, 0.5);
    const look = new THREE.Vector3();
    g.camHook = (cam) => {
      g.rider.head.getWorldPosition(look);
      const yaw = p.yaw + 0.75, dist = 5.2, pitch = 0.34;
      cam.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      cam.lookAt(look);
    };
    G.sim(0.08);
  });
  expect(await page.evaluate(() => G.game.player.def.lion === true)).toBe(true);
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + '/v582-lion-jungle-iphone.png' });

  await page.evaluate(() => { G.game.camHook = null; });
  await go(page, 'farm');
  await page.evaluate(() => G.show('play'));
  await poll(page, () => G.screen === 'play');
  await page.evaluate(() => G.sim(0.4));
  await page.evaluate(() => {
    const g = G.game, p = g.player, F = G.farm, THREE = G.THREE;
    document.getElementById('toast').classList.remove('show');
    p.speedNow = 0;
    p.pos.x = 28; p.pos.z = 160; p.yaw = 0.2; p.groundY();
    F.syncFarmLion(p, 0, false);
    g.thunderButt(p);
    const look = new THREE.Vector3();
    g.camHook = (cam) => {
      F.farmLion.body.getWorldPosition(look); look.y += 0.7;
      const yaw = p.yaw + 1.25, dist = 7.4, pitch = 0.36;
      cam.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      cam.lookAt(look);
    };
    G.sim(0.05);
  });
  await page.waitForTimeout(650);
  expect(await page.evaluate(() => document.getElementById('shout').textContent)).toBe('GO TO WAR!!');
  await page.screenshot({ path: OUT + '/v582-lion-farm-war-iphone.png' });
  await page.evaluate(() => {
    const F = G.farm, p = G.game.player, g = G.game, THREE = G.THREE;
    const chick = F.animals.find(a => a.kind === 'chicken');
    p.pos.x = chick.pos.x + 1.2; p.pos.z = chick.pos.z; p.groundY();
    F.syncFarmLion(p, 0, false);
    F.chompCd = 0;
    F.lionChomp(p);
    G.sim(0.18);
    document.getElementById('toast').classList.remove('show');
    const look = new THREE.Vector3();
    g.camHook = (cam) => {
      F.farmLion.head.getWorldPosition(look);
      const yaw = p.yaw + 0.9, dist = 4.6, pitch = 0.3;
      cam.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      cam.lookAt(look);
    };
    G.sim(0.05);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/v582-lion-farm-chomp-iphone.png' });
});
