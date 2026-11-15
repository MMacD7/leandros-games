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
        const h = G.mech.height || 4;
        const tall = G.mech.def.kind === 'brachio' || G.mech.def.kind === 'spinos';
        G.frameGarage({ fit: true, zoom: tall ? 1.55 : id === 'lavaanky' ? 2.3 : 1.7, yaw: id === 'lavaanky' ? 1.2 : 0.85 });
        const name = document.getElementById('g-name');
        if (name) name.scrollIntoView({ block: 'center' });
      }, id);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `/opt/cursor/artifacts/real-${id}-garage.png`, timeout: 20000 });
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
    for (const id of IDS) {
      await page.evaluate(id => {
        G.save.selected = id; G.save.landSel = id; G.save.ride = true;
        G.game.startRoam(); G.show('play');
        const p = G.game.player;
        G.game.camHook = cam => {
          const d = G.game.player, h = d.mech.height || 3;
          const fit = Math.max(h, d.mech.fitR || 0) * 1.35;
          cam.position.set(d.pos.x + fit * 0.85, d.pos.y + h * 0.45, d.pos.z + fit);
          cam.lookAt(d.pos.x, d.pos.y + h * 0.38, d.pos.z);
        };
        G.game.special(p);
        window.__hold = true;
        G.sim(id === 'megatrike' || id === 'brachiotank' ? 0.22 : id === 'lavaanky' ? 0.4 : 0.35);
        G.renderer.render(G.game.scene, G.game.camera);
      }, id);
      await dismissRotate(page);
      await page.screenshot({ path: `/opt/cursor/artifacts/real-${id}-ride.png`, timeout: 20000 });
      await page.evaluate(() => { window.__hold = false; G.game.camHook = null; });
    }
  }
});
