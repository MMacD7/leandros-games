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

test('v5.8.6 lion approval shots', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  fs.mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { } });
  await ready(page);
  await page.locator('#b-garage').click();
  await poll(page, () => G.screen === 'garage');
  await page.locator('#jg-lion').click();
  await poll(page, () => G.save.jungleLion === true && G.save.farmLion === true);
  await page.waitForTimeout(400);
  for (const [name, yaw] of [['front', 0.7], ['side', 1.6], ['back', 2.5]]) {
    await page.evaluate(yaw => G.frameGarage({ zoom: 0.38, yaw }), yaw);
    await page.waitForTimeout(350);
    await page.screenshot({ path: OUT + '/v586-lion-garage-' + name + '.png' });
  }
  await page.evaluate(() => G.frameGarage(null));

  await go(page, 'jungle');
  await page.evaluate(() => G.show('play'));
  await poll(page, () => G.screen === 'play');
  await page.evaluate(() => {
    const g = G.game, p = g.player, THREE = G.THREE;
    if (!p.def.lion) { G.save.jungleLion = true; G.save.jungleCostume = false; g.spawnPlayer(false); }
    const lion = g.player;
    if (!lion.def.lion || !lion.mech.body) throw new Error('jungle player ' + lion.def.id);
    lion.pos.set(40, 0, 170); lion.groundY(); lion.yaw = 0.4; lion.speedNow = 11;
    for (let i = 0; i < 8; i++) lion.mech.animate(0.05, 11, {});
    const look = new THREE.Vector3();
    g.camHook = (cam) => {
      lion.mech.body.getWorldPosition(look); look.y += 0.3;
      const yaw = lion.yaw + 1.15, dist = 7.2, pitch = 0.22;
      cam.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      cam.lookAt(look);
    };
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/v586-lion-jungle-run.png' });

  await go(page, 'farm');
  await page.evaluate(() => G.show('play'));
  await poll(page, () => G.screen === 'play');
  await page.evaluate(() => G.sim(0.4));
  await page.evaluate(() => {
    const g = G.game, p = g.player, F = G.farm, THREE = G.THREE;
    document.getElementById('toast').classList.remove('show');
    p.speedNow = 8; p.pos.x = 62; p.pos.z = 148; p.yaw = 0.4; p.groundY();
    F.syncFarmLion(p, 0.05, false);
    g.thunderButt(p);
    const look = new THREE.Vector3();
    g.camHook = (cam) => {
      F.farmLion.body.getWorldPosition(look); look.y += 1.2;
      const yaw = p.yaw + Math.PI * 0.72, dist = 8.2, pitch = 0.32;
      cam.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      cam.lookAt(look);
    };
    G.sim(0.05);
  });
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => document.getElementById('shout').textContent)).toBe('GO TO WAR!!');
  await page.screenshot({ path: OUT + '/v586-lion-farm-war.png' });

  await page.evaluate(() => {
    const F = G.farm, p = G.game.player, g = G.game, THREE = G.THREE;
    const chick = F.animals.find(a => a.kind === 'chicken');
    p.pos.x = chick.pos.x + 1.2; p.pos.z = chick.pos.z; p.groundY();
    F.syncFarmLion(p, 0, false); F.chompCd = 0; F.lionChomp(p); G.sim(0.25);
    const look = new THREE.Vector3();
    g.camHook = (cam) => {
      F.farmLion.head.getWorldPosition(look); look.y += 0.2;
      const yaw = p.yaw + 0.9, dist = 6.4, pitch = 0.2;
      cam.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      cam.lookAt(look);
    };
  });
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => document.getElementById('shout').textContent)).toBe('GULP!');
  await page.screenshot({ path: OUT + '/v586-lion-farm-chomp.png' });
  expect(errors, errors.join('\n')).toEqual([]);
});
