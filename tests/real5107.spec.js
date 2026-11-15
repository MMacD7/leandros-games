import { test, expect } from '@playwright/test';
import fs from 'fs';

const IDS = ['spinotitan', 'megatrike', 'raptorpack', 'brachiotank', 'lavaanky'];
const NAMES = ['Spino-Titan', 'Mega-Trike', 'Raptor Pack Alpha', 'Brachio-Tank', 'Lava Ankylo'];
const SPECIALS = ['tsunami', 'rockethorn', 'pack', 'cannon', 'lavaslam'];

async function poll(page, fn, arg, ms = 90000) {
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
async function shot(page, path) {
  for (let i = 0; i < 4; i++) {
    try { await page.screenshot({ path, timeout: 20000 }); return; }
    catch (e) { if (i === 3 || !/EAGAIN/.test(String(e))) throw e; await page.waitForTimeout(500); }
  }
}
async function dismissRotate(page) {
  await page.evaluate(() => {
    const rot = document.getElementById('rotate');
    if (rot && getComputedStyle(rot).display !== 'none') document.getElementById('rot-ok').click();
  });
}

test('v5.10.7 real garage dinos are 3D with their own upgrades', async ({ page }, info) => {
  await ready(page);
  await expect(page.locator('#ver')).toHaveText('v5.10.7');
  const phone = info.project.name === 'iphone';
  if (phone) fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });

  await page.evaluate(() => { document.getElementById('t-real').click(); });
  await poll(page, () => document.getElementById('g-dots') && document.getElementById('g-dots').children.length === 5);
  const names = [];
  for (let i = 0; i < 5; i++) {
    names.push(await page.evaluate(() => document.getElementById('g-name').textContent.replace('NEW!', '').trim()));
    await page.evaluate(() => document.getElementById('g-next').click());
  }
  expect(names.sort()).toEqual([...NAMES].sort());

  const base = {};
  for (const id of ['spinos', 'trice', 'velo', 'brachio', 'ankys']) {
    await page.evaluate(id => G.garage(id), id);
    await poll(page, id => G.mech && G.mech.def && G.mech.def.id === id && G.mech.skinned, id);
    base[id] = await page.evaluate(() => ({ h: G.mech.height, sail: !!G.mech.sailMat, pack: !!(G.mech.pack && G.mech.pack.length), lava: !!G.mech.lava, flames: !!(G.mech.flames && G.mech.flames.length), cannon: !!(G.mech.sockets && G.mech.sockets.cannon) }));
  }
  expect(base.spinos.sail).toBe(false);
  expect(base.velo.pack).toBe(false);
  expect(base.ankys.lava).toBe(false);
  expect(base.trice.flames).toBe(false);
  expect(base.brachio.cannon).toBe(false);

  for (let i = 0; i < IDS.length; i++) {
    const id = IDS[i];
    await page.evaluate(id => G.garage(id), id);
    await poll(page, id => G.mech && G.mech.def && G.mech.def.id === id && G.mech.skinned && G.gRider.mounted, id);
    const snap = await page.evaluate(() => {
      const m = G.mech;
      const rider = G.gRider;
      return {
        id: m.def.id, special: m.def.special, h: m.height, skinned: !!m.skinned,
        sail: !!m.sailMat, flames: m.flames ? m.flames.length : 0, pack: m.pack ? m.pack.length : 0,
        cannon: !!(m.sockets && m.sockets.cannon), lava: !!m.lava, club: !!m.club,
        rider: !!(rider.mounted && rider.mounted === m), grip: rider.grip || '',
      };
    });
    expect(snap.special).toBe(SPECIALS[i]);
    expect(snap.skinned).toBe(true);
    expect(snap.rider).toBe(true);
    expect(snap.grip).toBe('neck');
    if (id === 'spinotitan') { expect(snap.sail).toBe(true); expect(snap.h).toBeGreaterThan(base.spinos.h * 1.1); }
    if (id === 'megatrike') { expect(snap.flames).toBeGreaterThan(0); expect(snap.h).toBeGreaterThan(base.trice.h * 1.1); }
    if (id === 'raptorpack') { expect(snap.pack).toBe(2); expect(snap.h).toBeGreaterThan(base.velo.h); }
    if (id === 'brachiotank') { expect(snap.cannon).toBe(true); expect(snap.h).toBeGreaterThan(base.brachio.h * 1.05); }
    if (id === 'lavaanky') { expect(snap.lava).toBe(true); expect(snap.club).toBe(true); expect(snap.h).toBeGreaterThan(base.ankys.h * 1.05); }
    if (phone) {
      await page.evaluate(id => {
        const yaw = id === 'lavaanky' ? 1.15 : id === 'raptorpack' ? 0.7 : 0.85;
        const lift = id === 'raptorpack' ? 0.32 : 0;
        G.frameGarage({ fit: true, zoom: id === 'lavaanky' ? 0.58 : 1.02, yaw, lift });
        const name = document.getElementById('g-name');
        if (name) name.scrollIntoView({ block: 'center' });
      }, id);
      await page.waitForTimeout(280);
      await shot(page, `/opt/cursor/artifacts/real-${id}-garage.png`);
    }
  }

  await page.evaluate(() => {
    G.save.selected = 'raptorpack'; G.save.landSel = 'raptorpack'; G.save.ride = true;
    G.game.startRoam(); G.show('play');
  });
  await dismissRotate(page);
  await poll(page, () => G.screen === 'play' && G.game.player && G.game.player.def.id === 'raptorpack');
  await page.waitForTimeout(400);
  const timing = await page.evaluate(() => {
    window.__hold = true;
    const scene = G.game.scene, cam = G.game.camera, r = G.renderer;
    const samples = [];
    for (let i = 0; i < 18; i++) {
      const t0 = performance.now();
      G.sim(1 / 60);
      r.render(scene, cam);
      samples.push(performance.now() - t0);
    }
    window.__hold = false;
    samples.sort((a, b) => a - b);
    return { frame: samples[9], cpu: G.cpuMs };
  });
  console.log('REAL5107_FRAME', JSON.stringify(timing));
  expect(timing.frame).toBeLessThan(28);
  fs.writeFileSync('/tmp/real5107-frame.json', JSON.stringify(timing));

  if (phone) {
    const toastOf = { spinotitan: 'TIDAL WAVE', megatrike: 'ROCKET HORNS', raptorpack: 'PACK STRIKE', brachiotank: 'MEGA CANNON', lavaanky: 'LAVA SLAM' };
    const hold = { spinotitan: 0.48, megatrike: 0.3, raptorpack: 0.32, brachiotank: 0.16, lavaanky: 0.55 };
    for (const id of IDS) {
      const toast = await page.evaluate(({ id, hold }) => {
        try { localStorage.setItem('robo-dino-island.announced.farm', '1'); } catch (e) {}
        G.save.selected = id; G.save.landSel = id; G.save.ride = true;
        G.game.startRoam(); G.show('play');
        G.game.spawnT = 99;
        const p = G.game.player;
        const side = id === 'spinotitan' ? 1.15 : id === 'megatrike' ? 0.55 : id === 'lavaanky' ? 0.9 : 0.75;
        const ahead = id === 'megatrike' ? 0.95 : 0.4;
        G.game.camHook = cam => {
          const d = G.game.player, h = d.mech.height || 3;
          const yaw = d.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), sx = fz, sz = -fx;
          const dist = Math.max(h * 0.95, d.mech.fitR || 3, 4) * (id === 'lavaanky' ? 1.75 : id === 'megatrike' ? 1.6 : 1.2);
          cam.position.set(d.pos.x + (fx * ahead + sx * side) * dist, d.pos.y + h * 0.48, d.pos.z + (fz * ahead + sz * side) * dist);
          cam.lookAt(d.pos.x + fx * h * 0.15, d.pos.y + h * 0.4, d.pos.z + fz * h * 0.15);
        };
        G.game.special(p);
        window.__hold = true;
        G.sim(hold);
        G.renderer.render(G.game.scene, G.game.camera);
        return document.getElementById('toast').textContent;
      }, { id, hold: hold[id] });
      expect(toast, id).toContain(toastOf[id]);
      await dismissRotate(page);
      await shot(page, `/opt/cursor/artifacts/real-${id}-ride.png`);
      await page.evaluate(() => { window.__hold = false; G.game.camHook = null; });
    }
  }
});
