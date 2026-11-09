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
  await poll(page, lv => G.level === lv && document.getElementById('loading').classList.contains('hidden') && !!G.game.player, lv, 60000);
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
    return ['b-pause', 'b-map', 'a-laser', 'a-missile', 'a-melee', 'a-boost', 'b-rb', 'b-david', 'b-stink', 'joy-base'].map(box);
  });
}

async function assertPause(page, lv) {
  await go(page, lv);
  await enterPlay(page);
  const boxes = await controlBoxes(page);
  const pause = boxes.find(b => b.id === 'b-pause');
  expect(pause.visible, lv + ' pause visible').toBe(true);
  expect(pause.w, lv + ' pause width').toBeGreaterThanOrEqual(44);
  expect(pause.h, lv + ' pause height').toBeGreaterThanOrEqual(44);
  for (const b of boxes) {
    if (b.id === 'b-pause') continue;
    expect(overlaps(pause, b), `${lv} pause overlaps ${b.id}`).toBe(false);
  }
  await page.locator('#b-pause').click();
  await expect(page.locator('#pause')).toBeVisible();
  await expect(page.locator('#p-resume')).toBeVisible();
  await expect(page.locator('#p-restart')).toBeVisible();
  await expect(page.locator('#p-home')).toBeVisible();
  await page.locator('#p-resume').click();
  await expect(page.locator('#pause')).toBeHidden();
  await poll(page, () => G.screen === 'play');
}

test('lion garage, jungle ride, all levels, touch and pause', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(() => { try { if (sessionStorage.getItem('rdi-keep') !== '1') localStorage.clear(); } catch (e) { } });
  await ready(page);
  await dismissRotate(page);

  await expect(page.locator('#ver')).toHaveText('v5.8');
  const sw = await page.evaluate(async () => (await fetch('./sw.js')).text());
  expect(sw).toContain('./js/lion.js');
  expect(sw).not.toContain('robo-dino-island-dd7d1af7c5');
  expect(sw).toMatch(/const CACHE = 'robo-dino-island-[0-9a-f]{10}'/);

  // Jungle starts as the saved dino, not the lion, until the garage card is on.
  expect(await page.evaluate(() => ({ lion: !!G.game.player.def.lion, selected: G.save.selected, flag: G.save.jungleLion }))).toEqual({ lion: false, selected: 'rex', flag: false });

  await page.locator('#b-garage').click();
  await poll(page, () => G.screen === 'garage');
  const jungleTab = page.locator('#t-jungle');
  await expect(jungleTab).toBeVisible();
  const tabBox = await jungleTab.boundingBox();
  expect(tabBox.height).toBeGreaterThanOrEqual(44);
  await jungleTab.click();
  await expect(page.locator('#g-jungle')).toBeVisible();
  await expect(page.locator('#jg-lion')).toBeVisible();
  await expect(page.locator('#jg-cowboy')).toHaveCount(0);
  const card = await page.locator('#jg-lion').boundingBox();
  expect(card.height).toBeGreaterThanOrEqual(72);
  expect(card.width).toBeGreaterThanOrEqual(140);
  // Existing tabs still open the old picker.
  await page.locator('#t-real').click();
  await expect(page.locator('#g-dino')).toBeVisible();
  await expect(page.locator('#g-jungle')).toBeHidden();
  await page.locator('#t-jungle').click();
  await page.locator('#jg-lion').click();
  await expect(page.locator('#jg-lion')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#jg-lion .jg-state')).toHaveText('✓ Riding on Jungle Island');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('robo-dino-island.v1')));
  expect(saved.jungleLion).toBe(true);
  expect(saved.selected).toBe('rex');
  if (info.project.name === 'iphone') {
    fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
    await page.screenshot({ path: '/opt/cursor/artifacts/lion-garage-iphone.png' });
  }
  await page.locator('#g-back').click();
  await poll(page, () => G.screen === 'title' && G.game.player.def.lion === true);

  // Riding behavior on Jungle Island.
  await enterPlay(page);
  const ride = await page.evaluate(() => {
    const p = G.game.player, R = G.game.rider, THREE = G.THREE;
    p.mech.obj.updateWorldMatrix(true, true);
    const head = new THREE.Vector3(), body = new THREE.Vector3();
    R.head.getWorldPosition(head); p.mech.body.getWorldPosition(body);
    let hoop = false, whiteShorts = false, backpack = false;
    R.obj.traverse(o => {
      if (o.name && /backpack/i.test(o.name)) backpack = true;
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (m && m.map) hoop = true;
        if (m && m.color && m.color.getHex() === 0xf7f7f4) whiteShorts = true;
      }
    });
    const labels = {
      paw: document.querySelector('#a-laser span').innerText,
      nuzzle: document.querySelector('#a-missile span').innerText,
      roar: document.querySelector('#a-melee span').innerText,
      gallop: document.querySelector('#a-boost span').innerText,
    };
    return {
      id: p.def.id, lion: !!p.def.lion, level: G.level,
      mounted: R.mounted === p.mech, parentSeat: R.obj.parent === p.mech.seat,
      headAbove: head.y > body.y + 0.35, hoop, whiteShorts, backpack, labels,
    };
  });
  expect(ride.lion).toBe(true);
  expect(ride.level).toBe('jungle');
  expect(ride.mounted).toBe(true);
  expect(ride.parentSeat).toBe(true);
  expect(ride.headAbove).toBe(true);
  expect(ride.hoop).toBe(true);
  expect(ride.whiteShorts).toBe(true);
  expect(ride.backpack).toBe(false);
  expect(ride.labels.paw).toMatch(/PAW/);
  expect(ride.labels.nuzzle).toMatch(/NUZZLE/);
  expect(ride.labels.roar).toMatch(/ROAR/);
  expect(ride.labels.gallop).toMatch(/GALLOP/);

  // Real touch (CDP). Push the stick straight up. Try four facings so a tree on one side is not a failure.
  const spot = await page.evaluate(() => {
    const W = G.world, p = G.game.player;
    const open = (x, z) => { const h = W.height(x, z); if (h < 1.6 || h > 8) return false; return !W.colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 4); };
    let best = null, bestN = -1;
    for (let x = -80; x <= 100; x += 10) for (let z = 20; z <= 220; z += 10) {
      let n = 0; for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; if (open(x + Math.cos(t) * 12, z + Math.sin(t) * 12)) n++; }
      if (open(x, z) && n > bestN) { bestN = n; best = { x, z, n }; }
    }
    p.place(best.x, best.z, 0); p.speedNow = 0;
    return best;
  });
  const vp = page.viewportSize();
  const sx = 88, sy = Math.round(vp.height * 0.58);
  const cdp = await page.context().newCDPSession(page);
  let bestRun = { dist: 0, speed: 0, yaw: 0 };
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    await page.evaluate(yaw => { const p = G.game.player; p.yaw = yaw; p.speedNow = 0; G.game.cam.yaw = yaw + Math.PI; G.game.snapCam = true; }, yaw);
    await page.waitForTimeout(200);
    const origin = await page.evaluate(() => ({ x: G.game.player.pos.x, z: G.game.player.pos.z }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx, y: sy - 80, id: 1 }] });
    await page.evaluate(() => G.sim(1.0));
    const run = await page.evaluate(o => {
      const p = G.game.player, joy = document.getElementById('joy-base').classList.contains('active');
      return { dist: Math.hypot(p.pos.x - o.x, p.pos.z - o.z), speed: p.speedNow, joy, knob: document.getElementById('joy-knob').style.transform };
    }, origin);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
    if (run.dist > bestRun.dist) bestRun = { ...run, yaw };
  }
  expect(bestRun.joy, 'touch should raise the joystick ' + JSON.stringify(bestRun)).toBe(true);
  expect(bestRun.speed, 'joystick should make the lion run ' + JSON.stringify({ spot, bestRun })).toBeGreaterThan(6);
  expect(bestRun.dist, 'lion should actually move ' + JSON.stringify({ spot, bestRun })).toBeGreaterThan(3);

  const gallop = await page.locator('#a-boost').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gallop.x + gallop.width / 2, y: gallop.y + gallop.height / 2, id: 2 }] });
  await page.waitForTimeout(120);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => G.game.gallops || 0)).toBeGreaterThan(0);

  const nuzzle = await page.locator('#a-missile').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: nuzzle.x + nuzzle.width / 2, y: nuzzle.y + nuzzle.height / 2, id: 3 }] });
  await page.waitForTimeout(80);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => G.game.nuzzles || 0)).toBeGreaterThan(0);

  const roarBtn = await page.locator('#a-melee').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: roarBtn.x + roarBtn.width / 2, y: roarBtn.y + roarBtn.height / 2, id: 4 }] });
  await page.waitForTimeout(50);
  const roared = await page.evaluate(() => G.game.player.roar > 0.2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  expect(roared).toBe(true);

  await assertPause(page, 'jungle');
  expect(await page.evaluate(() => !!G.game.player.def.lion)).toBe(true);

  for (const lv of ['peak', 'city', 'ocean', 'farm']) {
    await assertPause(page, lv);
    const who = await page.evaluate(() => ({ id: G.game.player.def.id, lion: !!G.game.player.def.lion, farm: !!G.game.player.def.farmKid, sea: !!G.game.player.def.sea, horse: !!(G.farm && G.farm.horse), riding: !!(G.farm && G.farm.riding) }));
    expect(who.lion, lv).toBe(false);
    if (lv === 'farm') {
      expect(who.farm).toBe(true);
      expect(who.horse).toBe(true);
      expect(who.riding).toBe(false);
      expect(await page.locator('#a-missile span').innerText()).toMatch(/RIDE|DRIVE|JUMP|HOP/);
    }
    if (lv === 'ocean') expect(who.sea || who.id === 'shark').toBeTruthy();
    if (lv === 'peak' || lv === 'city') expect(who.id).not.toBe('lion');
  }

  await go(page, 'jungle');
  expect(await page.evaluate(() => !!G.game.player.def.lion && G.game.rider.mounted === G.game.player.mech)).toBe(true);

  await page.evaluate(() => sessionStorage.setItem('rdi-keep', '1'));
  await page.reload();
  await poll(page, () => !!(window.G && G.screen === 'title' && G.game && G.game.player), null, 120000);
  expect(await page.evaluate(() => ({ flag: G.save.jungleLion, selected: G.save.selected, lion: !!G.game.player.def.lion, level: G.level }))).toEqual({ flag: true, selected: 'rex', lion: true, level: 'jungle' });

  if (info.project.name === 'iphone') {
    await enterPlay(page);
    await page.evaluate(() => {
      const g = G.game, p = g.player;
      for (const e of g.enemies) { e.alive = false; if (e.mech && e.mech.obj) e.mech.obj.visible = false; }
      p.place(28, 198, 0.5); p.speedNow = 0;
      g.cam.yaw = p.yaw + Math.PI * 0.72;
      g.cam.pitch = 0.48;
      g.cam.dist = 7.6;
      g.snapCam = true;
    });
    await page.waitForTimeout(450);
    const framed = await page.evaluate(() => {
      const p = G.game.player, R = G.game.rider, cam = G.game.camera, THREE = G.THREE;
      p.mech.obj.updateWorldMatrix(true, true);
      const project = v => { const c = v.clone().project(cam); return { x: (c.x * 0.5 + 0.5) * innerWidth, y: (-c.y * 0.5 + 0.5) * innerHeight, z: c.z }; };
      const head = project(new THREE.Vector3().setFromMatrixPosition(R.head.matrixWorld));
      const seat = project(new THREE.Vector3().setFromMatrixPosition(p.mech.seat.matrixWorld));
      const inside = q => q.z > -1 && q.z < 1 && q.x > 8 && q.x < innerWidth - 8 && q.y > 8 && q.y < innerHeight - 8;
      return { head, seat, headIn: inside(head), seatIn: inside(seat), riding: R.obj.parent === p.mech.seat };
    });
    expect(framed.riding).toBe(true);
    expect(framed.headIn).toBe(true);
    expect(framed.seatIn).toBe(true);
    fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
    await page.screenshot({ path: '/opt/cursor/artifacts/lion-leandro-iphone.png' });
  }

  const bad = errors.filter(e => !/favicon|WebGL|THREE.WebGLRenderer|gpu/i.test(e));
  expect(bad, bad.join('\n')).toEqual([]);
});
