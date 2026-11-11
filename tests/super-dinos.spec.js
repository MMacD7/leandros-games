import { test, expect } from '@playwright/test';
import fs from 'fs';

const OUT = '/opt/cursor/artifacts';
const IDS = ['trex', 'brachio', 'giga', 'spinos', 'trice', 'carno', 'velo', 'ankys', 'stegos'];
const NAMES = ['T-Rex', 'Brachiosaurus', 'Giganotosaurus', 'Spinosaurus', 'Triceratops', 'Carnotaurus', 'Velociraptor', 'Ankylosaurus', 'Stegosaurus'];
const MOVES = ['MEGA CHOMP', 'TITAN STOMP', 'MEGA SLASH', 'SAIL SPLASH', 'TRIKE CHARGE', 'HORN RUSH', 'RAPTOR POUNCE', 'TAIL SMASH', 'SPIKE SWING'];

async function poll(page, fn, ms = 90000, label = 'poll', arg) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg).catch(() => false)) return;
    await page.waitForTimeout(150);
  }
  const snap = await page.evaluate(() => {
    const c = document.querySelector('#g-super canvas');
    return { title: document.getElementById('super-title') && document.getElementById('super-title').textContent, cards: document.querySelectorAll('#g-super [data-super]').length, screen: window.G && G.screen, player: !!(window.G && G.game && G.game.player) };
  }).catch(e => String(e));
  throw new Error('timed out ' + label + ' ' + JSON.stringify(snap));
}

test('v5.9.5 SUPER DINOS section', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player && G.modelsReady !== false), 90000, 'boot');
  await page.evaluate(() => {
    G.show('garage');
    const panel = document.querySelector('.g-panel');
    const s = document.getElementById('g-super');
    if (panel && s) panel.scrollTop = Math.max(0, s.offsetTop - 6);
  });
  await poll(page, () => {
    const c = document.querySelector('#g-super canvas');
    if (!c) return false;
    const px = c.getContext('2d').getImageData(30, 24, 1, 1).data;
    return px[3] > 10 && px[0] + px[1] + px[2] > 20;
  }, 20000, 'thumbs');

  await expect(page.locator('#super-title')).toHaveText('SUPER DINOS');
  await expect(page.locator('#lions-title')).toHaveText('LIONS GO TO WAR!');
  const cards = page.locator('#g-super [data-super]');
  await expect(cards).toHaveCount(9);
  for (let i = 0; i < 9; i++) {
    const card = cards.nth(i);
    await expect(card).toHaveAttribute('data-super', IDS[i]);
    await expect(card.locator('b')).toHaveText(NAMES[i]);
    await expect(card.locator('small')).toHaveText(MOVES[i]);
  }
  const dup = await page.evaluate(() => document.querySelectorAll('[data-super]').length);
  expect(dup).toBe(9);
  const lists = await page.evaluate(() => ({ super: G.superIds, real: G.realIds() }));
  expect(lists.super).toEqual(IDS);
  for (const id of IDS) expect(lists.real, id).not.toContain(id);

  const project = info.project.name;
  if (project === 'iphone' || project === 'iphone-landscape' || project === 'ipad') {
    fs.mkdirSync(OUT, { recursive: true });
    const file = project === 'iphone' ? 'superdinos-garage-iphone.png'
      : project === 'ipad' ? 'superdinos-garage-ipad.png'
      : 'superdinos-garage-iphone-landscape.png';
    await page.screenshot({ path: OUT + '/' + file });
  }

  for (const id of IDS) {
    await page.locator(`#g-super [data-super="${id}"]`).click({ force: true });
    const name = NAMES[IDS.indexOf(id)];
    await poll(page, (name) => document.getElementById('g-name').textContent.includes(name), 20000, 'name ' + id, name);
    const ride = await page.evaluate((id) => {
      G.save.jungleLion = false; G.save.jungleCostume = false;
      if (G.level !== 'jungle') G.setLevel('jungle');
      G.game.spawnPlayer(false);
      const p = G.game.player, r = G.game.rider;
      let blocky = 0, skin = 0;
      if (r && r.obj) r.obj.traverse(o => {
        if (o.isMesh && o.visible && o.userData.blocky) blocky++;
        if (o.isSkinnedMesh && o.visible) skin++;
      });
      return { id: p.def.id, skinned: !!(p.mech && p.mech.skinned), mounted: !!(r && r.mounted), riderSkin: !!(r && r.skinned), blocky, skin };
    }, id);
    expect(ride.id, id).toBe(id);
    expect(ride.skinned, id).toBe(true);
    expect(ride.mounted, id).toBe(true);
    expect(ride.riderSkin, id).toBe(true);
    expect(ride.blocky, id).toBe(0);
    expect(ride.skin, id).toBeGreaterThan(0);
  }

  await page.click('#t-real');
  const realNames = [];
  const nReal = await page.locator('#g-dots i').count();
  for (let i = 0; i < nReal; i++) {
    realNames.push((await page.locator('#g-name').innerText()).replace(/^NEW!\s*/, ''));
    await page.click('#g-next');
  }
  for (const name of NAMES) expect(realNames, name).not.toContain(name);

  await page.click('#t-robo');
  const roboNames = [];
  const nRobo = await page.locator('#g-dots i').count();
  for (let i = 0; i < nRobo; i++) {
    roboNames.push((await page.locator('#g-name').innerText()).replace(/^NEW!\s*/, ''));
    await page.click('#g-next');
  }
  expect(roboNames).toContain('Ankylo-Hammer');
  expect(roboNames).toContain('Robo-Rex');
  for (const name of NAMES) expect(roboNames, name).not.toContain(name);

  if (project !== 'iphone-landscape') return;
  await page.locator('#g-super [data-super="trex"]').click({ force: true });
  await page.evaluate(() => {
    window.__hold = true;
    G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'trex';
    if (G.level !== 'jungle') G.setLevel('jungle');
    G.game.spawnPlayer(false);
    G.show('play');
    const g = G.game, p = g.player, THREE = G.THREE;
    p.pos.set(105, 0, 40); p.yaw = Math.PI / 2; p.speedNow = 0; p.roar = 0; p.groundY();
    for (let i = 0; i < 8; i++) p.updateVisual(1 / 20);
    g.rider.update(0.05, p);
    const cam = g.camera;
    cam.fov = 38; cam.aspect = 844 / 390; cam.updateProjectionMatrix();
    G.renderer.setSize(844, 390, false);
    const look = p.pos.clone(); look.y += p.mech.height * 0.42;
    cam.position.set(look.x - 2, look.y + 1.4, look.z + 14);
    cam.lookAt(look.x + 1, look.y - 0.2, look.z);
    const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
    G.renderer.render(g.scene, cam);
  });
  await page.screenshot({ path: OUT + '/superdinos-ride.png' });
});
