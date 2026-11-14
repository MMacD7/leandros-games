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

test('v5.10.5 twenty-four eggs, every baby follows, radar shows them all', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player && G.game.eggs && G.game.eggs.built));
  await page.evaluate(() => {
    G.save.hatched = ['e1', 'e2', 'e6', 'not-an-egg'];
    G.game.persist();
  });
  await page.reload();
  await poll(page, () => !!(window.G && G.game && G.game.eggs && G.game.eggs.built && G.game.eggs.followers.length === 3));

  const migrated = await page.evaluate(() => {
    const g = G.game;
    const ids = new Set(g.eggs.followers.map(b => b.id));
    return {
      eggs: g.eggs.list.length,
      followers: g.eggs.followers.length,
      kept: ['e1', 'e2', 'e6'].every(id => ids.has(id) && g.eggs.list.find(e => e.id === id).hatched),
      fresh: !g.eggs.list.find(e => e.id === 'e13').hatched,
      junk: !g.eggs.followers.some(b => b.id === 'not-an-egg'),
      hud: document.getElementById('eggs-n').textContent,
    };
  });
  expect(migrated.eggs).toBe(24);
  expect(migrated.followers).toBe(3);
  expect(migrated.kept).toBe(true);
  expect(migrated.fresh).toBe(true);
  expect(migrated.junk).toBe(true);
  expect(migrated.hud).toBe('3/24');

  const placed = await page.evaluate(() => {
    const g = G.game, eggs = g.eggs.list;
    const species = [...new Set(eggs.map(e => e.species))];
    const bad = eggs.filter(e => {
      const h = g.world.height(e.x, e.z);
      const gap = e.mesh.position.y - h;
      const crater = Math.hypot(e.x + 40, e.z + 110) < 26;
      const lake = Math.hypot(e.x - 150, e.z - 8) < 36;
      return h < 0.35 || gap < 0.5 || gap > 2.4 || crater || lake;
    }).map(e => e.id + '@' + e.where);
    const where = (w) => eggs.filter(e => e.where === w);
    return {
      species: species.length,
      bad,
      beach: where('beach').some(e => g.world.height(e.x, e.z) > 0.35 && g.world.height(e.x, e.z) < 6),
      volcano: where('volcano').some(e => g.world.height(e.x, e.z) > 6 && Math.hypot(e.x + 40, e.z + 110) < 180),
      falls: where('falls').some(e => Math.hypot(e.x - 18, e.z + 48) < 45),
      start: where('start').some(e => Math.hypot(e.x - 15, e.z - 212) < 90),
    };
  });
  expect(placed.species).toBe(13);
  expect(placed.bad).toEqual([]);
  expect(placed.beach).toBe(true);
  expect(placed.volcano).toBe(true);
  expect(placed.falls).toBe(true);
  expect(placed.start).toBe(true);

  const radar = await page.evaluate(() => {
    const g = G.game, p = g.player;
    G.show('play');
    p.pos.set(15, 0, 212); p.groundY();
    const far = G.drawRadar();
    const nearEgg = g.eggs.list.find(e => !e.hatched);
    p.pos.set(nearEgg.x, 0, nearEgg.z); p.groundY();
    const close = G.drawRadar();
    return {
      n: far.n,
      ids: far.eggs.length,
      edge: far.eggs.filter(e => e.edge).length,
      babies: far.babies.length,
      closeEdge: close.eggs.find(e => e.id === nearEgg.id).edge,
    };
  });
  expect(radar.n).toBe(21);
  expect(radar.ids).toBe(21);
  expect(radar.edge).toBeGreaterThan(0);
  expect(radar.babies).toBe(3);
  expect(radar.closeEdge).toBe(false);

  if (info.project.name === 'iphone') {
    fs.mkdirSync(OUT, { recursive: true });
    await page.evaluate(() => {
      window.__hold = true;
      const g = G.game, p = g.player, e = g.eggs.list.find(x => !x.hatched && x.where === 'start');
      G.show('play');
      document.getElementById('rot-ok').click();
      p.pos.set(e.x - 18, 0, e.z - 8); p.yaw = Math.atan2(18, 8); p.groundY();
      G.drawRadar();
      const cam = g.camera;
      cam.aspect = 390 / 844; cam.fov = 48; cam.updateProjectionMatrix();
      G.renderer.setSize(390, 844, false);
      cam.position.set(p.pos.x - 2, e.y + 3.2, p.pos.z + 6);
      cam.lookAt(e.x, e.y + 2.2, e.z);
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      G.renderer.render(g.scene, cam);
    });
    await page.screenshot({ path: OUT + '/eggs5105-radar.png' });
  }

  const hatched = await page.evaluate(() => {
    const g = G.game;
    G.show('play');
    G.save.ride = true; G.save.selected = 'trex'; G.save.jungleLion = false; G.save.jungleCostume = false;
    g.spawnPlayer(false);
    const p = g.player;
    const misses = [];
    for (const egg of g.eggs.list) {
      if (egg.hatched && g.eggs.followers.some(b => b.id === egg.id)) continue;
      p.pos.set(egg.x, 0, egg.z); p.groundY();
      if (!egg.hatched) g.eggs.beginHatch(egg);
      for (let i = 0; i < 60 && !egg.hatched; i++) g.eggs.update(1 / 20);
      for (let i = 0; i < 6; i++) g.eggs.update(1 / 20);
      const b = g.eggs.followers.find(x => x.id === egg.id);
      const dist = b ? Math.hypot(b.obj.position.x - p.pos.x, b.obj.position.z - p.pos.z) : 999;
      const onGround = b ? Math.abs(b.obj.position.y - g.world.height(b.obj.position.x, b.obj.position.z)) < 3 : false;
      if (!b || !b.obj.visible || egg.hatching || egg.phase || !onGround || dist > 55 || b.obj.scale.x < 0.2) misses.push(egg.id);
    }
    const species = [...new Set(g.eggs.followers.map(b => b.species))];
    const radar = G.drawRadar();
    let ms = [];
    for (let i = 0; i < 6; i++) { G.sim(1 / 30); G.renderer.render(g.scene, g.camera); }
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      G.sim(1 / 30); G.renderer.render(g.scene, g.camera);
      ms.push(performance.now() - t0);
    }
    ms.sort((a, b) => a - b);
    return {
      followers: g.eggs.followers.length,
      misses,
      species: species.length,
      hud: document.getElementById('eggs-n').textContent,
      radarEggs: radar.n,
      radarBabies: radar.babies.length,
      median: Math.round(ms[4] * 10) / 10,
      riding: !!(g.rider && g.rider.mounted),
    };
  });
  expect(hatched.misses).toEqual([]);
  expect(hatched.followers).toBe(24);
  expect(hatched.species).toBe(13);
  expect(hatched.hud).toBe('24/24');
  expect(hatched.radarEggs).toBe(0);
  expect(hatched.radarBabies).toBe(24);
  expect(hatched.riding).toBe(true);
  expect(hatched.median).toBeLessThan(80);
  console.log('EGGS_FPS_MS ' + hatched.median);

  if (info.project.name === 'iphone') {
    await page.evaluate(() => {
      window.__hold = true;
      document.getElementById('rot-ok').click();
      const g = G.game, p = g.player, b = g.eggs.followers[g.eggs.followers.length - 1];
      p.pos.set(90, 0, 40); p.groundY(); p.yaw = 0.4;
      for (let i = 0; i < 5; i++) g.eggs.update(1 / 20);
      b.pop = 0.35; b.obj.position.set(p.pos.x + 1.2, g.world.height(p.pos.x, p.pos.z), p.pos.z + 1.4);
      b.obj.scale.setScalar(0.7); b.obj.visible = true;
      G.drawRadar();
      const cam = g.camera;
      cam.aspect = 390 / 844; cam.fov = 42; cam.updateProjectionMatrix();
      G.renderer.setSize(390, 844, false);
      cam.position.set(p.pos.x + 3.2, p.pos.y + 1.8, p.pos.z + 4.2);
      cam.lookAt(b.obj.position.x, b.obj.position.y + 0.6, b.obj.position.z);
      G.renderer.render(g.scene, cam);
    });
    await page.screenshot({ path: OUT + '/eggs5105-hatch.png' });
    await page.screenshot({ path: OUT + '/eggs5105-counter.png' });
  }

  await page.reload();
  await poll(page, () => !!(window.G && G.game && G.game.eggs && G.game.eggs.built && G.game.eggs.followers.length === 24));
  const kept = await page.evaluate(() => {
    const g = G.game;
    const visible = g.eggs.followers.filter(b => b.obj.visible && b.obj.parent).length;
    g.eggs.gather();
    for (let i = 0; i < 3; i++) g.eggs.update(1 / 20);
    const far = g.eggs.followers.filter(b => Math.hypot(b.obj.position.x - g.player.pos.x, b.obj.position.z - g.player.pos.z) > 80).length;
    return { n: g.eggs.followers.length, visible, far, hud: document.getElementById('eggs-n').textContent };
  });
  expect(kept.n).toBe(24);
  expect(kept.visible).toBe(24);
  expect(kept.far).toBe(0);
  expect(kept.hud).toBe('24/24');
});
