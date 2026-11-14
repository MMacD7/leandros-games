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

test('v5.10.6 forty eggs, hatch show, every baby follows', async ({ page }, info) => {
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
  expect(migrated.eggs).toBe(40);
  expect(migrated.followers).toBe(3);
  expect(migrated.kept).toBe(true);
  expect(migrated.fresh).toBe(true);
  expect(migrated.junk).toBe(true);
  expect(migrated.hud).toBe('3/40');

  const placed = await page.evaluate(() => {
    const g = G.game, eggs = g.eggs.list;
    const species = [...new Set(eggs.map(e => e.species))];
    const bad = eggs.filter(e => {
      const h = g.world.height(e.x, e.z);
      const gap = e.mesh.position.y - h;
      const crater = Math.hypot(e.x + 40, e.z + 110) < 26;
      const lake = Math.hypot(e.x - 150, e.z - 8) < 36;
      return h < 0.35 || gap < 0.5 || gap > 2.4 || crater || lake;
    }).map(e => e.id + '@' + e.where + ' h=' + g.world.height(e.x, e.z).toFixed(2) + ' gap=' + (e.mesh.position.y - g.world.height(e.x, e.z)).toFixed(2));
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
  expect(radar.n).toBe(37);
  expect(radar.ids).toBe(37);
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
    await page.screenshot({ path: OUT + '/eggs-40-radar.png' });
    const frames = OUT + '/eggs-hatch-frames';
    fs.mkdirSync(frames, { recursive: true });
    const shot = async (file) => page.screenshot({ path: file });
    await page.evaluate(() => {
      window.__hold = true;
      document.getElementById('rot-ok').click();
      const g = G.game, p = g.player, e = g.eggs.list.find(x => !x.hatched && x.where === 'start');
      G.show('play');
      p.pos.set(e.x - 3.2, 0, e.z - 2.2); p.groundY();
      g.eggs.beginHatch(e);
      const step = (sec) => { for (let i = 0; i < Math.round(sec * 20); i++) g.eggs.update(1 / 20); };
      step(0.95);
      const cam = g.camera;
      cam.aspect = 390 / 844; cam.fov = 46; cam.updateProjectionMatrix();
      G.renderer.setSize(390, 844, false);
      const aim = (dx, dy, dz, lookY) => {
        cam.position.set(e.x + dx, e.y + dy, e.z + dz);
        cam.lookAt(e.x, e.y + lookY, e.z);
        G.drawRadar();
        G.renderer.render(g.scene, cam);
      };
      aim(-4.2, 2.1, 5.4, 0.85);
      window.__eggShot = e.id;
    });
    await shot(OUT + '/eggs-crack.png');
    await shot(frames + '/01.png');
    await page.evaluate(() => {
      const g = G.game, e = g.eggs.list.find(x => x.id === window.__eggShot);
      const step = (sec) => { for (let i = 0; i < Math.round(sec * 20); i++) g.eggs.update(1 / 20); };
      step(0.25);
      const cam = g.camera;
      cam.position.set(e.x - 4.6, e.y + 2.2, e.z + 5.8);
      cam.lookAt(e.x, e.y + 1.0, e.z);
      G.drawRadar(); G.renderer.render(g.scene, cam);
    });
    await shot(frames + '/02.png');
    await page.evaluate(() => {
      const g = G.game, e = g.eggs.list.find(x => x.id === window.__eggShot);
      const step = (sec) => { for (let i = 0; i < Math.round(sec * 20); i++) g.eggs.update(1 / 20); };
      step(0.25);
      const cam = g.camera;
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      cam.position.set(e.x - 5.2, e.y + 2.6, e.z + 6.4);
      cam.lookAt(e.x, e.y + 1.2, e.z);
      G.drawRadar(); G.renderer.render(g.scene, cam);
    });
    await shot(OUT + '/eggs-burst.png');
    await shot(frames + '/03.png');
    await page.evaluate(() => {
      const g = G.game, e = g.eggs.list.find(x => x.id === window.__eggShot);
      const step = (sec) => { for (let i = 0; i < Math.round(sec * 20); i++) g.eggs.update(1 / 20); };
      step(0.35);
      const cam = g.camera;
      cam.position.set(e.x - 4.8, e.y + 2.0, e.z + 6.0);
      cam.lookAt(e.x, e.y + 0.9, e.z);
      G.drawRadar(); G.renderer.render(g.scene, cam);
    });
    await shot(frames + '/04.png');
    await page.evaluate(() => {
      const g = G.game;
      const step = (sec) => { for (let i = 0; i < Math.round(sec * 20); i++) g.eggs.update(1 / 20); };
      for (let i = 0; i < 30 && !String(g.eggs.lastBanner || '').includes('NEW BABY'); i++) step(0.05);
      const e = g.eggs.list.find(x => x.id === window.__eggShot);
      const cam = g.camera;
      cam.position.set(e.x - 4.4, e.y + 1.9, e.z + 5.6);
      cam.lookAt(e.x, e.y + 0.85, e.z);
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      G.drawRadar(); G.renderer.render(g.scene, cam);
    });
    await shot(OUT + '/eggs-baby.png');
    await shot(frames + '/05.png');
    await page.evaluate(() => { window.__hold = false; });
  }

  const show = await page.evaluate(() => {
    const g = G.game, p = g.player;
    G.show('play');
    p.pos.set(15, 0, 212); p.groundY();
    const step = (sec) => { for (let i = 0; i < Math.round(sec * 20); i++) g.eggs.update(1 / 20); };
    const fresh = () => g.eggs.list.find(e => !e.hatched && !e.hatching);
    let threw = '';
    const e = fresh();
    try {
      g.eggs.beginHatch(e);
      step(0.5);
      var early = { phase: e.phase, cracks: e.cracks, hops: e.hops, visible: e.mesh.visible, hatched: e.hatched };
      step(0.55);
      var built = { phase: e.phase, cracks: e.cracks, hops: e.hops, visible: e.mesh.visible };
      step(0.5);
      var baby = g.eggs.followers.find(b => b.id === e.id);
      var burst = { hatched: e.hatched, hidden: !e.mesh.visible, frags: g.eggs.fragLive.length, baby: !!(baby && baby.obj.visible && baby.reveal > 0), pops: G.sfx.nEggPop || 0 };
      step(1.2);
      baby = g.eggs.followers.find(b => b.id === e.id);
      var done = { phase: e.phase, hatching: e.hatching, reveal: baby ? baby.reveal : -1, banner: g.eggs.lastBanner, pop: document.getElementById('eggs-pop').textContent, scale: baby ? +baby.obj.scale.x.toFixed(2) : 0, cheep: G.sfx.nBabyCheep || 0 };
    } catch (err) { threw = String(err && err.message || err); }

    const hold = fresh();
    g.eggs.beginHatch(hold);
    G.show('play');
    G.sim(0.45);
    const snap = { age: hold.age, cracks: hold.cracks, phase: hold.phase, y: hold.mesh.position.y, t: hold.t };
    G.show('pause');
    G.sim(1.1);
    const frozen = hold.age === snap.age && hold.cracks === snap.cracks && hold.phase === snap.phase && hold.mesh.position.y === snap.y && hold.t === snap.t && document.body.classList.contains('paused');
    G.show('play');
    G.sim(3);
    const resumed = { hatched: hold.hatched, phase: hold.phase, hatching: hold.hatching, follow: g.eggs.followers.some(b => b.id === hold.id && b.obj.visible && b.reveal <= 0) };

    const origMatch = window.matchMedia;
    window.matchMedia = (q) => ({ matches: String(q).includes('reduce'), media: String(q), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    const quiet = fresh();
    g.fx.shake = 0;
    g.eggs.beginHatch(quiet);
    step(2.2);
    const noShake = g.fx.shake === 0 && quiet.hatched;
    window.matchMedia = origMatch;

    g.eggs.fragPeak = 0;
    const a = fresh();
    g.eggs.beginHatch(a);
    const b = fresh();
    let doubleThrew = '';
    try {
      g.eggs.beginHatch(b);
      step(2.6);
    } catch (err) { doubleThrew = String(err && err.message || err); }
    const ba = g.eggs.followers.find(x => x.id === a.id), bb = g.eggs.followers.find(x => x.id === b.id);
    return {
      threw, early, built, burst, done, frozen, resumed, noShake, doubleThrew,
      double: { a: !!(ba && ba.obj.visible), b: !!(bb && bb.obj.visible), peak: g.eggs.fragPeak, live: g.eggs.fragLive.length },
    };
  });
  expect(show.threw).toBe('');
  expect(show.early).toMatchObject({ phase: 'wobble', hatched: false, visible: true });
  expect(show.early.cracks).toBeGreaterThanOrEqual(1);
  expect(show.early.hops).toBeGreaterThanOrEqual(1);
  expect(show.built.phase).toBe('wobble');
  expect(show.built.cracks).toBeGreaterThanOrEqual(2);
  expect(show.built.hops).toBeGreaterThanOrEqual(2);
  expect(show.built.visible).toBe(true);
  expect(show.burst.hatched).toBe(true);
  expect(show.burst.hidden).toBe(true);
  expect(show.burst.frags).toBeGreaterThanOrEqual(8);
  expect(show.burst.baby).toBe(true);
  expect(show.burst.pops).toBeGreaterThan(0);
  expect(show.done.phase).toBe('');
  expect(show.done.hatching).toBe(false);
  expect(show.done.reveal).toBe(0);
  expect(show.done.banner).toContain('NEW BABY');
  expect(show.done.pop).toContain('Babies');
  expect(show.done.scale).toBeGreaterThan(0.8);
  expect(show.done.cheep).toBeGreaterThan(0);
  expect(show.frozen).toBe(true);
  expect(show.resumed).toMatchObject({ hatched: true, phase: '', hatching: false, follow: true });
  expect(show.noShake).toBe(true);
  expect(show.doubleThrew).toBe('');
  expect(show.double.a).toBe(true);
  expect(show.double.b).toBe(true);
  expect(show.double.peak).toBeGreaterThanOrEqual(16);
  expect(show.double.peak).toBeLessThanOrEqual(32);
  expect(show.double.live).toBeLessThanOrEqual(32);

  const ids24 = Array.from({ length: 24 }, (_, i) => 'e' + (i + 1));
  await page.evaluate((ids) => { G.save.hatched = ids.concat(['not-an-egg']); G.game.persist(); }, ids24);
  await page.reload();
  await poll(page, () => !!(window.G && G.game && G.game.eggs && G.game.eggs.built && G.game.eggs.followers.length === 24));
  const oldSave = await page.evaluate(() => {
    const g = G.game;
    G.show('play');
    const ids = new Set(g.eggs.followers.map(b => b.id));
    const radar = G.drawRadar();
    return {
      n: g.eggs.followers.length,
      kept: Array.from({ length: 24 }, (_, i) => 'e' + (i + 1)).every(id => ids.has(id)),
      fresh: !g.eggs.list.find(e => e.id === 'e25').hatched,
      junk: !g.eggs.followers.some(b => b.id === 'not-an-egg'),
      hud: document.getElementById('eggs-n').textContent,
      radar: radar.n,
      babies: radar.babies.length,
    };
  });
  expect(oldSave.n).toBe(24);
  expect(oldSave.kept).toBe(true);
  expect(oldSave.fresh).toBe(true);
  expect(oldSave.junk).toBe(true);
  expect(oldSave.hud).toBe('24/40');
  expect(oldSave.radar).toBe(16);
  expect(oldSave.babies).toBe(24);

  const hatched = await page.evaluate(() => {
    const g = G.game;
    G.show('play');
    G.save.ride = true; G.save.selected = 'trex'; G.save.jungleLion = false; G.save.jungleCostume = false;
    g.spawnPlayer(false);
    const p = g.player;
    const misses = [];
    for (const egg of g.eggs.list) {
      if (egg.hatched && g.eggs.followers.some(b => b.id === egg.id && b.reveal <= 0)) continue;
      p.pos.set(egg.x, 0, egg.z); p.groundY();
      if (!egg.hatched) g.eggs.beginHatch(egg);
      for (let i = 0; i < 100; i++) {
        g.eggs.update(1 / 20);
        const b0 = g.eggs.followers.find(x => x.id === egg.id);
        if (egg.hatched && !egg.hatching && !egg.phase && b0 && b0.reveal <= 0) break;
      }
      for (let i = 0; i < 8; i++) g.eggs.update(1 / 20);
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
  expect(hatched.followers).toBe(40);
  expect(hatched.species).toBe(13);
  expect(hatched.hud).toBe('40/40');
  expect(hatched.radarEggs).toBe(0);
  expect(hatched.radarBabies).toBe(40);
  expect(hatched.riding).toBe(true);
  expect(hatched.median).toBeLessThan(80);
  console.log('EGGS_FPS_MS ' + hatched.median);

  await page.reload();
  await poll(page, () => !!(window.G && G.game && G.game.eggs && G.game.eggs.built && G.game.eggs.followers.length === 40));
  const kept = await page.evaluate(() => {
    const g = G.game;
    const visible = g.eggs.followers.filter(b => b.obj.visible && b.obj.parent).length;
    g.eggs.gather();
    for (let i = 0; i < 3; i++) g.eggs.update(1 / 20);
    const far = g.eggs.followers.filter(b => Math.hypot(b.obj.position.x - g.player.pos.x, b.obj.position.z - g.player.pos.z) > 80).length;
    return { n: g.eggs.followers.length, visible, far, hud: document.getElementById('eggs-n').textContent };
  });
  expect(kept.n).toBe(40);
  expect(kept.visible).toBe(40);
  expect(kept.far).toBe(0);
  expect(kept.hud).toBe('40/40');

  const beforeNo = await page.evaluate(() => {
    const g = G.game;
    G.show('play');
    G.save.ride = true; G.save.selected = 'trex';
    g.spawnPlayer(false);
    const egg = g.eggs.list.find(e => e.hatched);
    g.eggs.beginHatch(egg);
    for (let i = 0; i < 8; i++) g.eggs.update(1 / 20);
    return {
      bolts: G.save.bolts,
      hud: document.getElementById('eggs-n').textContent,
      followers: g.eggs.followers.length,
      hatching: g.eggs.list.some(e => e.hatching || e.phase),
      riding: !!(g.rider && g.rider.mounted),
    };
  });
  expect(beforeNo.followers).toBe(40);
  expect(beforeNo.riding).toBe(true);

  await page.evaluate(() => { const rot = document.getElementById('rotate'); if (rot && getComputedStyle(rot).display !== 'none') document.getElementById('rot-ok').click(); });
  await page.locator('#b-pause').click();
  await expect(page.locator('#p-eggs')).toBeVisible();
  const resetBox = await page.locator('#p-eggs').boundingBox();
  expect(resetBox.height).toBeGreaterThanOrEqual(44);
  await page.locator('#p-eggs').click();
  await expect(page.locator('#egg-reset')).toBeVisible();
  await expect(page.locator('#egg-reset')).toContainText('Start the egg hunt again? Your babies will go back in their eggs!');
  if (info.project.name === 'iphone') {
    fs.mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: OUT + '/eggs-reset-confirm.png' });
  }
  await page.locator('#egg-reset-no').click();
  await expect(page.locator('#egg-reset')).toBeHidden();
  const afterNo = await page.evaluate(() => ({
    hud: document.getElementById('eggs-n').textContent,
    followers: G.game.eggs.followers.length,
    hatched: G.game.eggs.list.filter(e => e.hatched).length,
    bolts: G.save.bolts,
    paused: document.body.classList.contains('paused'),
  }));
  expect(afterNo.hud).toBe(beforeNo.hud);
  expect(afterNo.followers).toBe(40);
  expect(afterNo.hatched).toBe(40);
  expect(afterNo.bolts).toBe(beforeNo.bolts);
  expect(afterNo.paused).toBe(true);

  await page.locator('#p-eggs').click();
  await page.locator('#egg-reset-yes').click();
  const afterYes = await page.evaluate(() => {
    const g = G.game;
    const eggsUp = g.eggs.list.filter(e => e.mesh && e.mesh.visible && !e.hatched && !e.hatching && !e.phase).length;
    const radar = G.drawRadar();
    return {
      hud: document.getElementById('eggs-n').textContent,
      followers: g.eggs.followers.length,
      eggsUp,
      radar: radar.n,
      bolts: G.save.bolts,
      toast: document.getElementById('toast').textContent,
      hunt: G.sfx.nEggHunt || 0,
      riding: !!(g.rider && g.rider.mounted),
      saved: (G.save.hatched || []).length,
    };
  });
  expect(afterYes.hud).toBe('0/40');
  expect(afterYes.followers).toBe(0);
  expect(afterYes.eggsUp).toBe(40);
  expect(afterYes.radar).toBe(40);
  expect(afterYes.bolts).toBe(beforeNo.bolts);
  expect(afterYes.toast).toContain('NEW EGG HUNT!');
  expect(afterYes.hunt).toBeGreaterThan(0);
  expect(afterYes.riding).toBe(true);
  expect(afterYes.saved).toBe(0);
  expect(await page.locator('#g-eggs-reset').count()).toBe(1);

  if (info.project.name === 'iphone') {
    await page.locator('#p-resume').click();
    await page.evaluate(() => {
      window.__hold = true;
      const g = G.game, p = g.player, e = g.eggs.list.find(x => x.where === 'start');
      G.show('play');
      p.pos.set(e.x - 18, 0, e.z - 8); p.yaw = Math.atan2(18, 8); p.groundY();
      const toast = document.getElementById('toast');
      if (toast && !toast.textContent.includes('NEW EGG HUNT')) toast.textContent = '🆕 NEW EGG HUNT!';
      G.drawRadar();
      const cam = g.camera;
      cam.aspect = 390 / 844; cam.fov = 48; cam.updateProjectionMatrix();
      G.renderer.setSize(390, 844, false);
      cam.position.set(p.pos.x - 2, e.y + 3.2, p.pos.z + 6);
      cam.lookAt(e.x, e.y + 2.2, e.z);
      G.renderer.render(g.scene, cam);
    });
    await page.screenshot({ path: OUT + '/eggs-reset-done.png' });
  }

  const mid = await page.evaluate(() => {
    const g = G.game, bolts = G.save.bolts, e = g.eggs.list[12];
    g.eggs.beginHatch(e);
    for (let i = 0; i < 6; i++) g.eggs.update(1 / 20);
    const wobbling = e.phase === 'wobble' && e.hatching;
    g.eggs.resetHunt();
    return {
      wobbling,
      followers: g.eggs.followers.length,
      eggs: g.eggs.list.filter(x => x.mesh && x.mesh.visible && !x.hatched && !x.phase && !x.hatching).length,
      hud: document.getElementById('eggs-n').textContent,
      bolts: G.save.bolts === bolts,
    };
  });
  expect(mid.wobbling).toBe(true);
  expect(mid.followers).toBe(0);
  expect(mid.eggs).toBe(40);
  expect(mid.hud).toBe('0/40');
  expect(mid.bolts).toBe(true);

  await page.reload();
  await poll(page, () => !!(window.G && G.game && G.game.eggs && G.game.eggs.built));
  const resetKept = await page.evaluate(() => ({
    hud: document.getElementById('eggs-n').textContent,
    followers: G.game.eggs.followers.length,
    eggs: G.game.eggs.list.filter(e => e.mesh && e.mesh.visible && !e.hatched).length,
    saved: (G.save.hatched || []).length,
    bolts: G.save.bolts,
  }));
  expect(resetKept.hud).toBe('0/40');
  expect(resetKept.followers).toBe(0);
  expect(resetKept.eggs).toBe(40);
  expect(resetKept.saved).toBe(0);
  expect(resetKept.bolts).toBe(beforeNo.bolts);
});
