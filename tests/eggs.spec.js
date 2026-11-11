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

test('v5.9.7 dino eggs hatch and follow', async ({ page }, info) => {
  test.setTimeout(180000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player && G.game.eggs && G.game.eggs.built));
  const found = await page.evaluate(() => {
    const g = G.game, eggs = g.eggs.list;
    const spot = (where) => eggs.filter(e => e.where === where).map(e => ({ id: e.id, species: e.species, x: e.x, z: e.z, h: g.world.height(e.x, e.z) }));
    return { n: eggs.length, beach: spot('beach'), volcano: spot('volcano'), falls: spot('falls') };
  });
  expect(found.n).toBe(12);
  expect(found.beach.some(e => e.h > 0.2 && e.h < 3)).toBe(true);
  expect(found.volcano.some(e => e.h > 12 && Math.hypot(e.x + 40, e.z + 110) < 140)).toBe(true);
  expect(found.falls.some(e => Math.hypot(e.x - 18, e.z + 48) < 28)).toBe(true);

  if (info.project.name === 'iphone-landscape') {
    fs.mkdirSync(OUT, { recursive: true });
    await page.evaluate(() => {
      window.__hold = true;
      const g = G.game, e = g.eggs.list[0], p = g.player;
      G.show('play');
      p.pos.set(e.x, 0, e.z); p.groundY();
      G.sim(0.28);
      const cam = g.camera;
      cam.aspect = 844 / 390; cam.fov = 42; cam.updateProjectionMatrix();
      G.renderer.setSize(844, 390, false);
      const look = p.pos.clone(); look.y += 1.2;
      cam.position.set(e.x + 4, e.y + 2.4, e.z + 6); cam.lookAt(e.x, e.y + 1, e.z);
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      G.renderer.render(g.scene, cam);
    });
    await page.screenshot({ path: OUT + '/eggs-hatch.png' });
    await page.evaluate(() => { window.__hold = false; });
  }

  const hatched = await page.evaluate(() => {
    const g = G.game, p = g.player;
    G.show('play'); G.save.selected = 'trex';
    const ids = g.eggs.list.slice(0, 5).map(e => e.id);
    for (const id of ids) {
      const e = g.eggs.list.find(x => x.id === id);
      p.pos.set(e.x, 0, e.z); p.groundY();
      for (let i = 0; i < 40 && !g.save.hatched.includes(id); i++) G.sim(1 / 20);
    }
    const baby = g.eggs.followers[0];
    let size = 0;
    if (baby) {
      baby.obj.updateWorldMatrix(true, true);
      const box = new G.THREE.Box3().setFromObject(baby.obj);
      const s = box.getSize(new G.THREE.Vector3());
      size = Math.max(s.x, s.y, s.z);
    }
    const y = p.pos.y, h = g.world.height(p.pos.x, p.pos.z);
    return {
      hatched: g.save.hatched.slice(),
      followers: g.eggs.followers.map(b => b.species),
      size, adult: baby ? baby.adult : 0,
      gap: y - h,
      hud: document.getElementById('eggs-n').textContent,
    };
  });
  expect(hatched.hatched.length).toBe(5);
  expect(hatched.followers.length).toBe(4);
  expect(hatched.size / hatched.adult).toBeGreaterThan(0.18);
  expect(hatched.size / hatched.adult).toBeLessThan(0.34);
  expect(Math.abs(hatched.gap)).toBeLessThan(2);
  expect(hatched.hud).toBe('5/12');

  await page.reload();
  await poll(page, () => !!(window.G && G.game && G.game.eggs && G.game.eggs.built));
  const kept = await page.evaluate(() => ({
    hatched: G.save.hatched.length,
    followers: G.game.eggs.followers.length,
    title: document.getElementById('babies-title').textContent,
  }));
  expect(kept.hatched).toBe(5);
  expect(kept.followers).toBe(4);
  expect(kept.title).toBe('BABY DINOS');

  await page.evaluate(() => { G.show('garage'); });
  await poll(page, () => document.getElementById('g-baby-grid').children.length === 12);
  const shelf = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#g-baby-grid .bb-card')];
    return { n: cards.length, hatched: cards.filter(c => c.classList.contains('on')).length, text: cards.map(c => c.textContent).join('|') };
  });
  expect(shelf.n).toBe(12);
  expect(shelf.hatched).toBe(5);
  expect(shelf.text).toContain('Following');
  expect(shelf.text).toContain('In the nest');

  if (info.project.name !== 'iphone-landscape') return;
  await page.evaluate(() => {
    const panel = document.querySelector('#garage .g-panel');
    const s = document.getElementById('g-babies');
    panel.scrollTop = s.offsetTop - 6;
  });
  await page.screenshot({ path: OUT + '/eggs-garage-babies.png' });
  await page.evaluate(() => {
    window.__hold = true;
    const g = G.game, p = g.player;
    G.show('play');
    p.pos.set(200, 0, -160); p.groundY(); p.speedNow = 4; p.yaw = 0.6;
    for (let i = 0; i < 30; i++) { p.updateVisual(1 / 20); g.rider.update(1 / 20, p); g.eggs.update(1 / 20); }
    const cam = g.camera;
    cam.aspect = 844 / 390; cam.fov = 40; cam.updateProjectionMatrix();
    G.renderer.setSize(844, 390, false);
    const b = g.eggs.followers[0];
    const look = p.pos.clone(); look.y += 1.6;
    if (b) look.lerp(b.obj.position, 0.45);
    cam.position.set(p.pos.x - 7, p.pos.y + 3.2, p.pos.z + 9); cam.lookAt(look);
    const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
    G.renderer.render(g.scene, cam);
  });
  await page.screenshot({ path: OUT + '/eggs-babies-following.png' });
  await page.evaluate(() => { window.__hold = false; G.show('play'); });
  await page.screenshot({ path: OUT + '/eggs-hud.png' });
});
