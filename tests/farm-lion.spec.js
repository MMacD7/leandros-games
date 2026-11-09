import { test, expect } from '@playwright/test';
import fs from 'fs';

const LEVELS = ['jungle', 'peak', 'city', 'ocean', 'farm'];

async function poll(page, fn, arg, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const ok = await page.evaluate(fn, arg).catch(() => false);
    if (ok) return;
    await page.waitForTimeout(150);
  }
  throw new Error('timed out');
}
async function ready(page) {
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.screen === 'title' && G.game && G.game.player), null, 120000);
}
async function dismissRotate(page) {
  await page.evaluate(() => {
    const rot = document.getElementById('rotate');
    if (rot && getComputedStyle(rot).display !== 'none') document.getElementById('rot-ok').click();
  });
}
async function go(page, lv) {
  await page.evaluate(lv => { if (G.level !== lv) G.travel(lv); }, lv);
  await poll(page, lv => G.level === lv && document.getElementById('loading').classList.contains('hidden') && !!G.game.player, lv);
}
async function enterPlay(page) {
  await page.evaluate(() => G.show('play'));
  await dismissRotate(page);
  await poll(page, () => G.screen === 'play');
}
function overlaps(a, b) {
  if (!a || !b || !a.visible || !b.visible) return false;
  return !(a.r <= b.x + 1 || b.r <= a.x + 1 || a.b <= b.y + 1 || b.b <= a.y + 1);
}
async function controlBoxes(page) {
  return page.evaluate(() => {
    const box = id => {
      const el = document.getElementById(id);
      if (!el) return { id, visible: false };
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const hidden = el.classList.contains('hidden') || s.display === 'none' || s.visibility === 'hidden' || r.width < 2 || r.height < 2;
      return { id, x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, visible: !hidden };
    };
    return ['b-pause', 'b-map', 'a-laser', 'a-missile', 'a-melee', 'a-boost', 'b-rb', 'b-david', 'b-stink'].map(box);
  });
}
async function assertPause(page, lv) {
  await go(page, lv);
  await enterPlay(page);
  const boxes = await controlBoxes(page);
  const pause = boxes.find(b => b.id === 'b-pause');
  expect(pause.visible, lv + ' pause').toBe(true);
  expect(pause.w).toBeGreaterThanOrEqual(44);
  expect(pause.h).toBeGreaterThanOrEqual(44);
  for (const b of boxes) if (b.id !== 'b-pause') expect(overlaps(pause, b), `${lv} pause overlaps ${b.id}`).toBe(false);
  await page.locator('#b-pause').click();
  await expect(page.locator('#p-resume')).toBeVisible();
  await page.locator('#p-resume').click();
  await expect(page.locator('#pause')).toBeHidden();
}

test('farm lion, jungle lion, all levels, touch and pause', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(() => { try { if (sessionStorage.getItem('rdi-keep') !== '1') localStorage.clear(); } catch (e) { } });
  await ready(page);
  await dismissRotate(page);

  await expect(page.locator('#ver')).toHaveText('v5.7.1');
  const sw = await page.evaluate(async () => (await fetch('./sw.js')).text());
  expect(sw).toContain('./js/lion.js');
  expect(sw).toContain('./js/farm.js');
  expect(sw).not.toContain('robo-dino-island-98af1b78d2');
  expect(sw).not.toContain('costume.js');
  expect(sw).toMatch(/const CACHE = 'robo-dino-island-[0-9a-f]{10}'/);
  const west = await page.evaluate(async () => (await fetch('./js/westies.js')).text());
  expect(west).toContain('Look it\'s Ricky and Bobby, they are going to POOP!');

  const pageText = await page.locator('body').innerText();
  expect(pageText.toLowerCase()).not.toContain('thundercat');
  await page.locator('#b-garage').click();
  await poll(page, () => G.screen === 'garage');
  await expect(page.locator('#lions-title')).toHaveText('LIONS GO TO WAR!');
  await expect(page.locator('#t-jungle')).toHaveCount(0);
  await expect(page.locator('#jg-farm-lion')).toHaveCount(0);
  await expect(page.locator('#jg-costume')).toHaveCount(0);
  const view = page.viewportSize();
  const heading = await page.locator('#lions-title').boundingBox();
  expect(heading.y).toBeGreaterThanOrEqual(0);
  expect(heading.y + heading.height).toBeLessThanOrEqual(view.height);
  expect(heading.width).toBeGreaterThan(140);
  const card = await page.locator('#jg-lion').boundingBox();
  expect(card.height).toBeGreaterThanOrEqual(72);
  expect(card.width).toBeGreaterThanOrEqual(140);
  expect(card.y + card.height).toBeLessThanOrEqual(view.height);
  await expect(page.locator('#jg-lion')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#g-back').click();
  await poll(page, () => G.screen === 'title' && G.game.player.def.lion !== true && G.save.farmLion === false && G.save.jungleLion === false);

  for (const lv of LEVELS) await assertPause(page, lv);
  expect(await page.evaluate(() => ({ level: G.level, lion: !!G.game.player.def.lion, farm: !!G.game.player.def.farmKid, ridingLion: !!(G.farm && G.farm.ridingLion) }))).toEqual({ level: 'farm', lion: false, farm: true, ridingLion: false });
  expect(await page.evaluate(() => !!(G.farm && G.farm.horse && !G.farm.riding))).toBe(true);

  await page.evaluate(() => G.show('title'));
  await page.locator('#b-garage').click();
  await poll(page, () => G.screen === 'garage');
  await expect(page.locator('#lions-title')).toHaveText('LIONS GO TO WAR!');
  await page.locator('#jg-lion').click();
  await expect(page.locator('#jg-lion')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#jg-lion .jg-state')).toHaveText('✓ Jungle Island and the Farm');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('robo-dino-island.v1')));
  expect(saved.farmLion).toBe(true);
  expect(saved.jungleLion).toBe(true);
  expect(saved.selected).toBe('rex');
  if (info.project.name === 'iphone') {
    fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
    await page.screenshot({ path: '/opt/cursor/artifacts/lions-go-to-war-garage-iphone.png' });
  }
  await page.locator('#g-back').click();
  await poll(page, () => G.screen === 'title');

  await go(page, 'jungle');
  await enterPlay(page);
  expect(await page.evaluate(() => G.game.player.def.lion === true && G.game.rider.mounted === G.game.player.mech)).toBe(true);
  const jungleWar = await page.evaluate(() => {
    const g = G.game, p = g.player;
    const hp = g.enemies.filter(e => e.alive).map(e => e.hp);
    g.thunderButt(p);
    const safe = hp.join(',') === g.enemies.filter(e => e.alive).map(e => e.hp).join(',');
    const z0 = g.fx.zaps.length;
    g.update(1 / 30, { x: 0, y: 0, look: { dx: 0, dy: 0 }, pressed: { melee: 1 }, btn: { melee: true, laser: false, missile: false, boost: false }, looking: false });
    return { wars: g.wars || 0, safe, shout: document.getElementById('shout').textContent, label: document.querySelector('#a-melee span').innerText, zaps: g.fx.zaps.length > z0, rear: !!(p.mech.sockets && p.mech.sockets.rear), thunder: p.mech.thunderT > 0 };
  });
  expect(jungleWar.wars).toBeGreaterThan(1);
  expect(jungleWar.safe).toBe(true);
  expect(jungleWar.shout).toBe('GO TO WAR!!');
  expect(jungleWar.label).toMatch(/WAR/);
  expect(jungleWar.zaps).toBe(true);
  expect(jungleWar.rear).toBe(true);
  expect(jungleWar.thunder).toBe(true);

  await go(page, 'farm');
  await enterPlay(page);
  await page.evaluate(() => G.sim(0.4));
  const ride = await page.evaluate(() => {
    const F = G.farm, p = G.game.player, R = p.mech.R, THREE = G.THREE;
    F.farmLion.obj.updateWorldMatrix(true, true);
    R.obj.updateWorldMatrix(true, true);
    const head = new THREE.Vector3(), body = new THREE.Vector3(), legL = new THREE.Vector3(), legR = new THREE.Vector3();
    R.head.getWorldPosition(head); F.farmLion.body.getWorldPosition(body);
    R.legs[0].foot.getWorldPosition(legL); R.legs[1].foot.getWorldPosition(legR);
    let hoop = false, whiteShorts = false, backpack = false;
    R.obj.traverse(o => {
      if (o.name && /backpack/i.test(o.name)) backpack = true;
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (m && m.map) hoop = true;
        if (m && m.color && m.color.getHex() === 0xf7f7f4) whiteShorts = true;
      }
    });
    return {
      kid: !!p.def.farmKid, lionDef: !!p.def.lion, ridingLion: F.ridingLion, horse: !!F.horse, horseRide: F.riding,
      tractor: !!F.tractor, driving: F.driving, hoop, whiteShorts, backpack,
      headAbove: head.y > body.y + 0.2, legsApart: Math.hypot(legL.x - legR.x, legL.z - legR.z) > 0.25,
      gallop: document.querySelector('#a-boost span').innerText, hop: document.querySelector('#a-missile span').innerText, war: document.querySelector('#a-melee span').innerText,
    };
  });
  expect(ride.kid).toBe(true);
  expect(ride.lionDef).toBe(false);
  expect(ride.ridingLion).toBe(true);
  expect(ride.horse).toBe(true);
  expect(ride.horseRide).toBe(false);
  expect(ride.tractor).toBe(true);
  expect(ride.driving).toBe(false);
  expect(ride.hoop).toBe(true);
  expect(ride.whiteShorts).toBe(true);
  expect(ride.backpack).toBe(false);
  expect(ride.headAbove).toBe(true);
  expect(ride.legsApart).toBe(true);
  expect(ride.gallop).toMatch(/GALLOP/);
  expect(ride.hop).toMatch(/HOP OFF/);
  expect(ride.war).toMatch(/WAR/);
  const farmWar = await page.evaluate(() => {
    const g = G.game, p = g.player, hp = p.hp;
    const rear = G.farm.farmLion.socketPos('rear', new G.THREE.Vector3());
    g.update(1 / 30, { x: 0, y: 0, look: { dx: 0, dy: 0 }, pressed: { melee: 1 }, btn: { melee: true, laser: false, missile: false, boost: false }, looking: false });
    return { shout: document.getElementById('shout').textContent, riding: G.farm.ridingLion, hp: p.hp, hp0: hp, wars: g.wars || 0, rearY: rear.y, cloud: !!G.farm.farmLion.rear };
  });
  expect(farmWar.shout).toBe('GO TO WAR!!');
  expect(farmWar.riding).toBe(true);
  expect(farmWar.hp).toBe(farmWar.hp0);
  expect(farmWar.wars).toBeGreaterThan(0);
  expect(farmWar.cloud).toBe(true);
  expect(farmWar.rearY).toBeGreaterThan(0.4);

  const moved = await page.evaluate(() => {
    const p = G.game.player, x0 = p.pos.x, z0 = p.pos.z;
    p.yaw = 0; G.game.cam.yaw = Math.PI;
    const inp = { x: 0, y: -1, look: { dx: 0, dy: 0 }, pressed: {}, btn: { boost: true, laser: false, missile: false, melee: false }, looking: false };
    for (let i = 0; i < 30; i++) G.game.update(1 / 30, inp);
    return { dist: Math.hypot(p.pos.x - x0, p.pos.z - z0), speed: p.speedNow, still: G.farm.ridingLion };
  });
  expect(moved.still).toBe(true);
  expect(moved.speed).toBeGreaterThan(6);
  expect(moved.dist).toBeGreaterThan(3);

  // Hop off, horse still mounts, tractor still there, lion stays in the yard.
  const after = await page.evaluate(() => {
    const F = G.farm, p = G.game.player;
    F.dismountLion();
    const nearLion = F.lionNear(p);
    const H = F.horse;
    p.pos.x = H.pos.x + 1.2; p.pos.z = H.pos.z; p.groundY();
    const horse = F.tryMount(p);
    const ridingHorse = F.riding && !F.ridingLion;
    F.dismount(true);
    return { nearLion, horse, ridingHorse, tractor: !!F.tractor, lionVisible: F.farmLion.obj.visible };
  });
  expect(after.nearLion).toBe(true);
  expect(after.horse).toBe(true);
  expect(after.ridingHorse).toBe(true);
  expect(after.tractor).toBe(true);
  expect(after.lionVisible).toBe(true);

  await go(page, 'peak');
  expect(await page.evaluate(() => ({ lion: !!G.game.player.def.lion, farm: !!G.game.player.def.farmKid, id: G.game.player.def.id }))).toEqual({ lion: false, farm: false, id: 'rex' });
  await go(page, 'city');
  expect(await page.evaluate(() => { const d = G.game.player.def; return !d.lion && !d.farmKid && d.id === 'rex'; })).toBe(true);
  await go(page, 'ocean');
  expect(await page.evaluate(() => { const d = G.game.player.def; return d.lion !== true && (d.sea === true || d.id === 'shark'); })).toBe(true);

  await page.evaluate(() => sessionStorage.setItem('rdi-keep', '1'));
  await page.reload();
  await poll(page, () => !!(window.G && G.screen === 'title' && G.game && G.game.player), null, 120000);
  expect(await page.evaluate(() => ({ farmLion: G.save.farmLion, jungleLion: G.save.jungleLion, selected: G.save.selected }))).toEqual({ farmLion: true, jungleLion: true, selected: 'rex' });
  await go(page, 'jungle');
  expect(await page.evaluate(() => G.game.player.def.lion === true)).toBe(true);

  if (info.project.name === 'iphone') {
    await go(page, 'farm');
    await enterPlay(page);
    await page.evaluate(() => G.sim(0.5));
    await page.evaluate(() => {
      const g = G.game, p = g.player, F = G.farm;
      p.speedNow = 0;
      g.cam.yaw = p.yaw + Math.PI * 0.72;
      g.cam.pitch = 0.42;
      g.snapCam = true;
      F.syncFarmLion(p, 0, false);
      G.sim(0.05);
      g.thunderButt(p);
      p.mech.obj.updateWorldMatrix(true, true);
      F.farmLion.obj.updateWorldMatrix(true, true);
    });
    await page.waitForTimeout(700);
    const framed = await page.evaluate(() => {
      const p = G.game.player, F = G.farm, cam = G.game.camera, THREE = G.THREE;
      const project = obj => { const v = new THREE.Vector3(); obj.getWorldPosition(v); const c = v.project(cam); return { x: (c.x * 0.5 + 0.5) * innerWidth, y: (-c.y * 0.5 + 0.5) * innerHeight, z: c.z }; };
      const head = project(p.mech.R.head), seat = project(F.farmLion.seat);
      const inside = q => q.z > -1 && q.z < 1 && q.x > 8 && q.x < innerWidth - 8 && q.y > 8 && q.y < innerHeight - 8;
      return { headIn: inside(head), seatIn: inside(seat), riding: F.ridingLion };
    });
    expect(framed.riding).toBe(true);
    expect(framed.headIn).toBe(true);
    expect(framed.seatIn).toBe(true);
    fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
    await page.screenshot({ path: '/opt/cursor/artifacts/farm-lion-leandro-iphone.png' });
  }

  const bad = errors.filter(e => !/favicon|WebGL|THREE.WebGLRenderer|gpu/i.test(e));
  expect(bad, bad.join('\n')).toEqual([]);
});
