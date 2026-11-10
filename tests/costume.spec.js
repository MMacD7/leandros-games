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
async function assertPause(page, lv) {
  await go(page, lv);
  await enterPlay(page);
  const boxes = await page.evaluate(() => {
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

test('rex costume, lions stay, all levels, touch and pause', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(() => { try { if (sessionStorage.getItem('rdi-keep') !== '1') localStorage.clear(); } catch (e) { } });
  await ready(page);
  await dismissRotate(page);

  await expect(page.locator('#ver')).toHaveText('v5.8.7');
  const sw = await page.evaluate(async () => (await fetch('./sw.js')).text());
  expect(sw).toContain('./js/costume.js');
  expect(sw).toContain('./js/lion.js');
  expect(sw).not.toContain('robo-dino-island-130703df6c');
  expect(sw).toContain('./assets/models/lion.glb');
  expect(sw).toContain('./assets/models/trex.glb');
  expect(sw).toContain('./js/trex.js');
  expect(sw).toContain('./assets/art/rex-rider.webp');
  const lionSrc = await page.evaluate(async () => (await fetch('./js/lion.js')).text());
  expect(lionSrc.toLowerCase()).not.toContain('thundercat');
  expect(sw).toMatch(/const CACHE = 'robo-dino-island-[0-9a-f]{10}'/);
  const costumeSrc = await page.evaluate(async () => (await fetch('./js/costume.js')).text());
  expect(costumeSrc.toLowerCase()).not.toContain('thundercat');
  expect(costumeSrc).not.toMatch(/\.(png|jpe?g|webp|gif)/i);
  const west = await page.evaluate(async () => (await fetch('./js/westies.js')).text());
  expect(west).toContain('Look it\'s Ricky and Bobby, they are going to POOP!');

  await page.locator('#b-garage').click();
  await poll(page, () => G.screen === 'garage');
  await expect(page.locator('#lions-title')).toHaveText('LIONS GO TO WAR!');
  const view = page.viewportSize();
  const card = await page.locator('#jg-costume').boundingBox();
  const lionCard = await page.locator('#jg-lion').boundingBox();
  expect(lionCard.y).toBeGreaterThanOrEqual(0);
  expect(card.height).toBeGreaterThanOrEqual(72);
  expect(card.width).toBeGreaterThanOrEqual(140);
  expect(card.y + card.height).toBeLessThanOrEqual(view.height);
  await page.locator('#jg-costume').click();
  await expect(page.locator('#jg-costume')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#jg-costume .jg-state')).toHaveText('✓ On Jungle Island');
  await expect(page.locator('#jg-lion')).toHaveAttribute('aria-pressed', 'false');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('robo-dino-island.v1')));
  expect(saved.jungleCostume).toBe(true);
  expect(saved.jungleLion).toBe(false);
  expect(saved.farmLion).toBe(false);
  expect(saved.selected).toBe('rex');
  await page.locator('#g-back').click();
  await poll(page, () => G.screen === 'title' && G.game.player.def.costume === true);

  for (const lv of LEVELS) await assertPause(page, lv);
  expect(await page.evaluate(() => ({ level: G.level, costume: !!G.game.player.def.costume, farm: !!G.game.player.def.farmKid }))).toEqual({ level: 'farm', costume: false, farm: true });

  await go(page, 'jungle');
  await enterPlay(page);
  const look = await page.evaluate(() => {
    const p = G.game.player, m = p.mech, THREE = G.THREE;
    m.obj.updateWorldMatrix(true, true);
    const names = [];
    m.obj.traverse(o => { if (o.name) names.push(o.name); });
    const head = new THREE.Vector3(), body = new THREE.Vector3();
    m.head.getWorldPosition(head); m.body.getWorldPosition(body);
    return {
      costume: !!p.def.costume, lion: !!p.def.lion, celtic: !!G.game.rider.mounted,
      art: !!(m.art && m.art.material && m.art.material.map),
      snout: names.includes('rex-snout'), stripe: names.includes('rex-back'),
      backpack: names.some(n => /backpack/i.test(n)),
      headAbove: head.y > body.y,
      chomp: document.querySelector('#a-laser span').innerText, run: document.querySelector('#a-boost span').innerText,
    };
  });
  expect(look.costume).toBe(true);
  expect(look.lion).toBe(false);
  expect(look.celtic).toBeFalsy();
  expect(look.art).toBe(true);
  expect(look.snout).toBe(true);
  expect(look.stripe).toBe(true);
  expect(look.backpack).toBe(false);
  expect(look.headAbove).toBe(true);
  expect(look.chomp).toMatch(/CHOMP/);
  expect(look.run).toMatch(/RUN/);

  const moved = await page.evaluate(() => {
    const p = G.game.player, x0 = p.pos.x, z0 = p.pos.z;
    p.yaw = 0.4; G.game.cam.yaw = p.yaw + Math.PI;
    const inp = { x: 0, y: -1, look: { dx: 0, dy: 0 }, pressed: {}, btn: { boost: true, laser: false, missile: false, melee: false }, looking: false };
    for (let i = 0; i < 30; i++) G.game.update(1 / 30, inp);
    return { dist: Math.hypot(p.pos.x - x0, p.pos.z - z0), speed: p.speedNow, costume: !!p.def.costume };
  });
  expect(moved.costume).toBe(true);
  expect(moved.speed).toBeGreaterThan(6);
  expect(moved.dist).toBeGreaterThan(3);

  await page.evaluate(() => G.show('title'));
  await page.locator('#b-garage').click();
  await poll(page, () => G.screen === 'garage');
  await page.locator('#jg-lion').click();
  await expect(page.locator('#jg-lion')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#jg-lion .jg-state')).toHaveText('✓ On the Farm');
  await expect(page.locator('#jg-costume')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#g-back').click();
  await poll(page, () => G.screen === 'title');

  await go(page, 'farm');
  await enterPlay(page);
  await page.evaluate(() => G.sim(0.4));
  const farm = await page.evaluate(() => {
    const p = G.game.player, F = G.farm, R = p.mech.R;
    let hoop = false, whiteShorts = false;
    R.obj.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (m && m.map) hoop = true; if (m && m.color && m.color.getHex() === 0xf7f7f4) whiteShorts = true; } });
    return { kid: !!p.def.farmKid, costume: !!p.def.costume, ridingLion: F.ridingLion, horse: !!F.horse, tractor: !!F.tractor, hoop, whiteShorts };
  });
  expect(farm).toEqual({ kid: true, costume: false, ridingLion: true, horse: true, tractor: true, hoop: true, whiteShorts: true });
  const f0 = await page.evaluate(() => G.frames);
  await page.waitForTimeout(2000);
  const farmFps = await page.evaluate(f0 => (G.frames - f0) / 2, f0);
  console.log('FARM_FPS ' + farmFps);
  const gallop = await page.locator('#a-boost').boundingBox();
  expect(gallop.x).toBeGreaterThanOrEqual(0);
  expect(gallop.x + gallop.width).toBeLessThanOrEqual(view.width + 0.5);
  expect(gallop.y).toBeGreaterThanOrEqual(0);
  expect(gallop.y + gallop.height).toBeLessThanOrEqual(view.height + 0.5);
  const war = await page.evaluate(() => {
    const g = G.game, p = g.player, F = G.farm, z0 = g.fx.zaps.length;
    g.thunderButt(p);
    return {
      shout: document.getElementById('shout').textContent,
      riding: F.ridingLion, wars: g.wars || 0, zaps: g.fx.zaps.length > z0,
      mane: !!F.farmLion.mane, legs: F.farmLion.legs.length, rear: !!F.farmLion.rear, whisker: !!F.farmLion.obj.getObjectByName('lion-whisker'),
    };
  });
  expect(war.shout).toBe('GO TO WAR!!');
  expect(war.riding).toBe(true);
  expect(war.wars).toBeGreaterThan(0);
  expect(war.zaps).toBe(true);
  expect(war.mane).toBe(true);
  expect(war.legs).toBe(4);
  expect(war.rear).toBe(true);
  expect(war.whisker).toBe(true);
  const bolt = await page.evaluate(() => {
    const g = G.game, F = G.farm, p = g.player;
    g._warUntil = performance.now() + 8000;
    const before = g.wars;
    const again = g.thunderButt(p);
    const blocked = again === false && g.wars === before;
    const pig = F.animals.find(a => a.kind === 'pig');
    pig.pos.x = p.pos.x + 2; pig.pos.z = p.pos.z; pig.dizzyT = 0;
    g._warUntil = 0;
    g.thunderButt(p);
    const dogs = (g.westies && g.westies.dogs) || [];
    return { blocked, dizzy: pig.dizzyT > 0, dogs: dogs.length, zaps: g.fx.zaps.length };
  });
  expect(bolt.blocked).toBe(true);
  expect(bolt.dizzy).toBe(true);
  expect(bolt.zaps).toBeGreaterThan(4);
  const gulp = await page.evaluate(() => {
    const F = G.farm, p = G.game.player, g = G.game;
    const chick = F.animals.find(a => a.kind === 'chicken');
    p.pos.x = chick.pos.x + 1.1; p.pos.z = chick.pos.z; p.groundY();
    F.syncFarmLion(p, 0, false);
    F.chompCd = 0;
    const label = document.querySelector('#a-laser span').innerText;
    const bolts0 = g.save.bolts;
    const a = F.lionChomp(p);
    const id = a && a.id;
    G.sim(0.2);
    const who = F.animals.find(x => x.id === id) || chick;
    const dogs = (g.westies && g.westies.dogs) || [];
    return { ok: !!a, id, label, mid: who.root.scale.x, gulp: who.state === 'gulp', shout: document.getElementById('shout').textContent, bolts: g.save.bolts > bolts0, dogs: dogs.every(d => !d.gulp), visible: who.root.visible };
  });
  expect(gulp.ok).toBe(true);
  expect(gulp.label).toMatch(/CHOMP/);
  expect(gulp.gulp).toBe(true);
  expect(gulp.mid).toBeLessThan(0.95);
  expect(gulp.shout).toBe('GULP!');
  expect(gulp.bolts).toBe(true);
  expect(gulp.dogs).toBe(true);
  expect(gulp.visible).toBe(true);
  await page.evaluate(() => G.sim(4.2));
  const back = await page.evaluate(() => {
    const chick = G.farm.animals.find(a => a.state === 'gulp') || G.farm.animals.find(a => a.kind === 'chicken');
    return { gulp: !chick.gulp, scale: chick.root.scale.x, visible: chick.root.visible };
  });
  expect(back.gulp).toBe(true);
  expect(back.visible).toBe(true);
  expect(back.scale).toBeGreaterThan(0.9);

  await go(page, 'jungle');
  expect(await page.evaluate(() => G.game.player.def.costume === true && G.game.player.def.lion !== true)).toBe(true);
  const backToLion = await page.evaluate(() => {
    G.save.jungleCostume = false; G.game.spawnPlayer(false);
    const m = G.game.player.mech;
    const lion = G.game.player.def.lion === true && !!G.game.rider.mounted && m.skinned === true && !!m.mane && m.legs.length === 4 && !!m.rear;
    G.save.jungleCostume = true; G.game.spawnPlayer(false);
    return { lion, costumeAgain: G.game.player.def.costume === true };
  });
  expect(backToLion.lion).toBe(true);
  expect(backToLion.costumeAgain).toBe(true);

  const trexSmoke = await page.evaluate(() => {
    const g = G.game, THREE = G.THREE;
    G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'trex';
    g.spawnPlayer(false);
    const p = g.player, m = p.mech;
    const names = Object.keys(m.bones || {}), clips = Object.keys(m.actions || {});
    const footY = () => m.legs.map(L => { const v = new THREE.Vector3(); L.g.getWorldPosition(v); return v.y; });
    m.obj.updateMatrixWorld(true);
    const a = footY();
    for (let i = 0; i < 24; i++) m.animate(1 / 20, 6, {});
    m.obj.updateMatrixWorld(true);
    const b = footY();
    const lift = a.map((v, i) => Math.abs(b[i] - v));
    const rider = g.rider;
    const sunk = [];
    if (rider && rider.mounted && rider.head && rider.torso) {
      for (const name of ['Idle', 'Walk', 'Run', 'Roar', 'Chomp']) {
        const act = m.actions[name];
        if (!act) { sunk.push(name); continue; }
        const dur = act.getClip().duration;
        m._clip = '';
        m.play(name, true, 1);
        for (let i = 0; i < 6; i++) {
          act.time = dur * i / 6;
          m.mixer.update(0);
          m.obj.updateMatrixWorld(true);
          for (const part of [rider.head, rider.torso]) {
            const box = new THREE.Box3().setFromObject(part);
            const top = m.surfaceY((box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2);
            if (top == null) continue;
            const gap = box.min.y - top;
            const need = part === rider.head ? 0.1 : -0.03;
            if (gap < need) sunk.push({ clip: name, i, part: part.name, gap: Math.round(gap * 1000) / 1000 });
          }
        }
      }
    } else sunk.push('no-rider');
    const rex = G.defs().find(d => d.id === 'rex');
    const ok = p.def.id === 'trex' && p.def.kind === 'trex' && m.skinned === true && p.def.radius === 2.5
      && names.includes('jaw') && names.includes('l_thigh') && names.includes('tail5')
      && clips.includes('Walk') && clips.includes('Run') && clips.includes('Roar') && clips.includes('Chomp') && clips.includes('Stagger')
      && rex && rex.kind === 'rex';
    G.save.jungleLion = true; G.save.farmLion = true; G.save.jungleCostume = true; G.save.selected = 'rex'; g.spawnPlayer(false);
    return { ok, lift, sunk, costume: g.player.def.costume === true };
  });
  expect(trexSmoke.ok, JSON.stringify(trexSmoke)).toBe(true);
  expect(trexSmoke.sunk, JSON.stringify(trexSmoke.sunk)).toEqual([]);
  expect(Math.max(...trexSmoke.lift)).toBeGreaterThan(0.12);
  expect(trexSmoke.costume).toBe(true);

  await go(page, 'peak');
  expect(await page.evaluate(() => { const d = G.game.player.def; return !d.costume && !d.lion && !d.farmKid && d.id === 'rex'; })).toBe(true);
  await go(page, 'city');
  expect(await page.evaluate(() => { const d = G.game.player.def; return !d.costume && !d.lion && d.id === 'rex'; })).toBe(true);
  await go(page, 'ocean');
  expect(await page.evaluate(() => { const d = G.game.player.def; return !d.costume && (d.sea === true || d.id === 'shark'); })).toBe(true);

  await page.evaluate(() => sessionStorage.setItem('rdi-keep', '1'));
  await page.reload();
  await poll(page, () => !!(window.G && G.screen === 'title' && G.game && G.game.player), null, 120000);
  expect(await page.evaluate(() => ({ jungleCostume: G.save.jungleCostume, jungleLion: G.save.jungleLion, farmLion: G.save.farmLion, selected: G.save.selected }))).toEqual({ jungleCostume: true, jungleLion: true, farmLion: true, selected: 'rex' });

  if (info.project.name === 'iphone') {
    await go(page, 'jungle');
    await enterPlay(page);
    const pace = await page.evaluate(() => {
      const g = G.game;
      G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'trex';
      g.spawnPlayer(false);
      const p = g.player;
      p.pos.set(30, 0, 160); p.groundY();
      for (let i = 0; i < 4; i++) g.spawnEnemy(p.pos.x + 8 + i * 4, p.pos.z + (i - 1.5) * 5, 1);
      const t0 = performance.now();
      G.sim(1.2, 1 / 60);
      const ms = (performance.now() - t0) / (1.2 * 60);
      const fps = G.fps, cpu = G.cpuMs;
      G.save.jungleLion = true; G.save.farmLion = true; G.save.jungleCostume = true; G.save.selected = 'rex'; g.spawnPlayer(false);
      return { ms: Math.round(ms * 10) / 10, fps: Math.round(fps * 10) / 10, cpu: Math.round(cpu * 10) / 10, enemies: g.enemies.length, id: 'trex' };
    });
    fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
    fs.writeFileSync('/opt/cursor/artifacts/v587-fps.txt', JSON.stringify(pace));
    await page.evaluate(() => {
      const g = G.game, p = g.player, THREE = G.THREE;
      p.speedNow = 0;
      const ray = new THREE.Raycaster(), target = new THREE.Vector3(), hatV = new THREE.Vector3(), bodyV = new THREE.Vector3();
      const project = (obj, out) => { obj.getWorldPosition(out); const c = out.clone().project(g.camera); return { x: (c.x * 0.5 + 0.5) * innerWidth, y: (-c.y * 0.5 + 0.5) * innerHeight, z: c.z }; };
      const inside = q => q.z > -1 && q.z < 1 && q.x > 30 && q.x < innerWidth - 30 && q.y > 40 && q.y < innerHeight - 80;
      const viewOk = () => {
        p.mech.obj.updateWorldMatrix(true, true);
        const hat = project(p.mech.rider, hatV), body = project(p.mech.body, bodyV);
        if (!inside(hat) || !inside(body)) return false;
        p.mech.rider.getWorldPosition(target);
        const cam = g.camera.position, dir = target.clone().sub(cam), dist = dir.length();
        if (dist < 5 || dist > 16) return false;
        dir.multiplyScalar(1 / dist); ray.camera = g.camera; ray.set(cam, dir); ray.far = dist - 0.5;
        let hits = []; try { hits = ray.intersectObjects(g.scene.children, true); } catch (e) { return false; }
        return !hits.some(h => { let o = h.object; while (o) { if (o === p.mech.obj) return false; o = o.parent; } return true; });
      };
      const ox = p.pos.x, oz = p.pos.z;
      const spots = [[0, 0], [16, 8], [-16, 6], [8, -18], [22, -8], [-8, 16]];
      let ok = false;
      for (const [dx, dz] of spots) {
        const x = ox + dx, z = oz + dz;
        if (g.world.height(x, z) < 0.4) continue;
        p.place(x, z, p.yaw);
        for (const off of [0.5, 0.85, 1.2, 1.7, 2.2, 2.8, 3.6, 4.4, 5.2]) {
          g.cam.yaw = p.yaw + off; g.cam.pitch = 0.32; g.snapCam = true;
          g.updateCamera(1 / 30, { looking: false });
          if (viewOk()) { ok = true; break; }
        }
        if (ok) break;
      }
      if (!ok) { p.place(ox, oz, p.yaw); g.cam.yaw = p.yaw + 0.9; g.cam.pitch = 0.32; g.snapCam = true; g.updateCamera(1 / 30, { looking: false }); }
    });
    await page.waitForTimeout(80);
    const framed = await page.evaluate(() => {
      const p = G.game.player, cam = G.game.camera, THREE = G.THREE;
      const project = obj => { const v = new THREE.Vector3(); obj.getWorldPosition(v); const c = v.project(cam); return { x: (c.x * 0.5 + 0.5) * innerWidth, y: (-c.y * 0.5 + 0.5) * innerHeight, z: c.z }; };
      const hat = project(p.mech.rider), body = project(p.mech.body);
      const inside = q => q.z > -1 && q.z < 1 && q.x > 8 && q.x < innerWidth - 8 && q.y > 8 && q.y < innerHeight - 8;
      return { hatIn: inside(hat), bodyIn: inside(body), costume: !!p.def.costume };
    });
    expect(framed.costume).toBe(true);
    fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
    await page.screenshot({ path: '/opt/cursor/artifacts/rex-costume-iphone.png' });
  }

  const bad = errors.filter(e => !/favicon|WebGL|THREE.WebGLRenderer|gpu/i.test(e));
  expect(bad, bad.join('\n')).toEqual([]);
});
