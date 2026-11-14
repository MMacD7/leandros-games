import { test, expect } from '@playwright/test';
import fs from 'fs';

const OUT = '/opt/cursor/artifacts';
const LINE = "Look it's Ricky and Bobby, they are going to POOP!";

async function poll(page, fn, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn).catch(() => false)) return;
    await page.waitForTimeout(150);
  }
  throw new Error('timed out');
}

test('v5.10.4 Ricky and Bobby at 60% size, follow, and the exact POOP line', async ({ page }, info) => {
  test.setTimeout(240000);
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player && G.game.westies));
  await page.evaluate(() => {
    const rot = document.getElementById('rotate');
    if (rot && getComputedStyle(rot).display !== 'none') document.getElementById('rot-ok').click();
  });

  const src = await page.evaluate(async () => (await fetch('./js/westies.js')).text());
  expect(src).toContain(LINE);
  expect(src).not.toContain("Ricky's partner");

  const report = await page.evaluate(() => {
    G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'trex';
    if (G.level !== 'jungle') G.setLevel('jungle');
    G.show('play');
    const g = G.game;
    g.mode = 'roam';
    g.spawnPlayer(false);
    const p = g.player, W = g.westies, THREE = G.THREE;
    p.pos.set(80, 0, 24); p.yaw = 0.4; p.speedNow = 8; p.groundY();
    W.poopClock = 99; W.state = 'off';
    for (const d of W.dogs) d.placed = false;
    for (let i = 0; i < 40; i++) { p.pos.x += Math.sin(p.yaw) * 0.35; p.pos.z += Math.cos(p.yaw) * 0.35; p.groundY(); W.update(1 / 20); }
    const measure = (d) => {
      let skin = null; d.root.updateMatrixWorld(true);
      d.root.traverse(o => { if (o.isSkinnedMesh) skin = o; });
      const attr = skin.geometry.attributes.position, v = new THREE.Vector3();
      const local = new THREE.Vector3();
      let foot = Infinity, back = -Infinity, paw = Infinity;
      for (let i = 0; i < attr.count; i += 8) {
        skin.getVertexPosition(i, local); v.copy(local).applyMatrix4(skin.matrixWorld);
        if (v.y < foot) foot = v.y;
        if (local.z > -0.4 && local.z < 0.25) { if (v.y > back) back = v.y; if (v.y < paw) paw = v.y; }
      }
      const ground = g.world.height(d.pos.x, d.pos.z);
      return { shoulder: back - paw, gap: foot - ground, dist: Math.hypot(d.pos.x - p.pos.x, d.pos.z - p.pos.z) };
    };
    const dogs = W.dogs.map(d => ({
      name: d.name,
      tag: d.tag && d.tag.userData.label,
      tagOn: !!(d.tag && d.tag.visible),
      collar: d.collar.material.color.getHexString(),
      scale: Math.round(d.root.scale.x * 1000) / 1000,
      visible: d.root.visible,
      ...measure(d),
    }));
    const far = { x: p.pos.x + 70, z: p.pos.z + 10 };
    p.pos.x = far.x; p.pos.z = far.z; p.groundY();
    W.update(1 / 20); W.update(1 / 20);
    const caught = W.dogs.map(d => Math.hypot(d.pos.x - p.pos.x, d.pos.z - p.pos.z));
    W.poopClock = 0.05;
    W.update(0.1);
    const shout = document.getElementById('shout').textContent;
    const pooping = W.dogs.some(d => d.poopT > 0);
    // they stay outside the player's body
    let blocked = false;
    for (let i = 0; i < 20; i++) { p.speedNow = 0; W.update(1 / 20); }
    for (const d of W.dogs) if (Math.hypot(d.pos.x - p.pos.x, d.pos.z - p.pos.z) < (p.radius || 1) + 0.4) blocked = true;
    const bench = [];
    for (let i = 0; i < 6; i++) { G.sim(1 / 30); G.renderer.render(g.scene, g.camera); }
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now(); G.sim(1 / 30); G.renderer.render(g.scene, g.camera); bench.push(performance.now() - t0);
    }
    bench.sort((a, b) => a - b);
    return { dogs, caught, shout, pooping, blocked, median: Math.round(bench[4] * 10) / 10, errors: [] };
  });

  expect(report.dogs).toHaveLength(2);
  const ricky = report.dogs.find(d => d.tag === 'Ricky');
  const bobby = report.dogs.find(d => d.tag === 'Bobby');
  expect(ricky.tag).toBe('Ricky');
  expect(bobby.tag).toBe('Bobby');
  expect(ricky.visible).toBe(true);
  expect(bobby.visible).toBe(true);
  expect(ricky.tagOn).toBe(true);
  expect(bobby.tagOn).toBe(true);
  expect(ricky.collar).not.toBe(bobby.collar);
  expect(bobby.scale).toBeLessThan(ricky.scale);
  for (const d of report.dogs) {
    expect(d.shoulder, d.tag).toBeGreaterThan(0.15);
    expect(d.shoulder, d.tag).toBeLessThan(0.34); // the walk hop lifts the back a few millimetres past 0.32
    expect(d.gap, d.tag).toBeGreaterThan(-0.08);
    expect(d.gap, d.tag).toBeLessThan(0.2);
    expect(d.dist, d.tag).toBeGreaterThan(1.5);
    expect(d.dist, d.tag).toBeLessThan(12);
  }
  for (const c of report.caught) expect(c).toBeLessThan(12);
  expect(report.shout).toBe(LINE);
  expect(report.pooping).toBe(true);
  expect(report.blocked).toBe(false);
  expect(report.median).toBeLessThan(40);

  const farm = await page.evaluate(() => {
    G.setLevel('farm');
    const g = G.game, F = G.farm, W = g.westies;
    g.spawnPlayer(false);
    W.trigger('button', true);
    for (let i = 0; i < 30; i++) W.update(1 / 20);
    const edibleDog = F.edible({ kind: 'westie', name: 'Ricky', id: 'ricky' });
    const edibleBobby = F.edible({ kind: 'dog', name: 'Bobby', id: 'bobby' });
    const ediblePig = F.edible(F.animals.find(a => a.kind === 'pig'));
    return {
      line: document.getElementById('shout').textContent,
      both: W.dogs.filter(d => d.root.visible).length,
      edibleDog, edibleBobby, ediblePig,
      state: W.state,
    };
  });
  expect(farm.line).toBe(LINE);
  expect(farm.both).toBe(2);
  expect(farm.edibleDog).toBe(false);
  expect(farm.edibleBobby).toBe(false);
  expect(farm.ediblePig).toBe(true);
  expect(errors).toEqual([]);

  if (info.project.name !== 'iphone') return;
  fs.mkdirSync(OUT, { recursive: true });

  const shoot = async (file, pose) => {
    await page.evaluate((pose) => {
      window.__hold = true;
      const g = G.game, THREE = G.THREE, W = g.westies;
      const showLine = () => {
        const el = document.getElementById('shout');
        el.textContent = "Look it's Ricky and Bobby, they are going to POOP!";
        el.classList.add('show');
        el.style.animation = 'none';
        el.style.opacity = '1';
        el.style.transform = 'translate(-50%, -50%) scale(1)';
      };
      const hideLine = () => {
        const el = document.getElementById('shout');
        el.textContent = ''; el.classList.remove('show'); el.style.opacity = '0';
      };
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      const cam = g.camera;
      cam.aspect = 390 / 844; G.renderer.setSize(390, 844, false);
      const placePair = (x, z, yaw, poop) => {
        W.S = 1; W.state = 'off'; W.helper = false;
        W.dogs.forEach((d, i) => {
          d.off = false; d.root.visible = true; d.poopT = poop ? 0.55 : 0; d.pooped = true;
          const s = i ? 0.1 : -0.1;
          d.pos.set(x + Math.cos(yaw) * s, 0, z - Math.sin(yaw) * s); d.yaw = yaw;
          d.pos.y = W.ground(d.pos); d.root.position.copy(d.pos); d.root.rotation.y = d.yaw;
          d.root.scale.setScalar((d.mul || 1));
          d.body.rotation.set(0, 0, 0); d.body.position.y = 0;
          d.legs.forEach(l => { l.rotation.set(0, 0, 0); const k = l.children.find(c => c.isBone); if (k) k.rotation.set(0, 0, 0); });
          if (poop) { d.body.rotation.x = 0.42; d.legs[0].rotation.x = 0.35; d.legs[1].rotation.x = 0.35; d.legs[2].rotation.x = -1.1; d.legs[3].rotation.x = -1.1; const lk = d.legs[2].children.find(c => c.isBone), rk = d.legs[3].children.find(c => c.isBone); if (lk) lk.rotation.x = 1.2; if (rk) rk.rotation.x = 1.2; }
          d.head.rotation.set(0, 0, 0); d.tail.rotation.z = poop ? 0.2 : 0.4;
          if (d.tag) d.tag.visible = true;
          d.root.updateMatrixWorld(true);
        });
      };
      if (pose === 'farm' || pose === 'poop') {
        if (G.level !== 'farm') G.setLevel('farm');
        G.show('play');
        g.spawnPlayer(false);
        const x = 6, z = 16, yaw = pose === 'poop' ? 1.15 : 0.15;
        placePair(x, z, yaw, pose === 'poop');
        if (pose === 'poop') {
          showLine();
          const d = W.dogs[0];
          const bx = d.pos.x - Math.sin(d.yaw) * 0.12 + Math.cos(d.yaw) * 0.18, bz = d.pos.z - Math.cos(d.yaw) * 0.12 - Math.sin(d.yaw) * 0.18;
          for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2;
            g.fx.glow.spawn({ pos: { x: bx + Math.cos(a) * 0.05, y: d.pos.y + 0.03, z: bz + Math.sin(a) * 0.05 }, vel: { x: 0, y: 0.02, z: 0 }, size: 0.05, life: 2, r: 0.5, g: 0.22, b: 0.06, alpha: 1, grav: 0 }); }
          g.fx.glow.spawn({ pos: { x: bx, y: d.pos.y + 0.1, z: bz }, vel: { x: 0, y: 0.02, z: 0 }, size: 0.09, life: 2, r: 0.85, g: 0.82, b: 0.6, alpha: 0.7, grav: 0 });
        } else hideLine();
        const gy = g.world.height(x, z);
        cam.fov = 36; cam.updateProjectionMatrix();
        cam.position.set(x + Math.sin(yaw) * 1.05, gy + 0.34, z + Math.cos(yaw) * 1.05);
        cam.lookAt(x, gy + 0.14, z);
      } else if (pose === 'ride') {
        G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'trex';
        if (G.level !== 'jungle') G.setLevel('jungle');
        G.show('play');
        g.spawnPlayer(false);
        const p = g.player;
        p.pos.set(90, 0, 30); p.yaw = 0.15; p.speedNow = 4; p.groundY();
        for (let i = 0; i < 6; i++) p.updateVisual(1 / 20);
        if (g.rider) g.rider.update(0.05, p);
        hideLine();
        const yaw = p.yaw;
        p.mech.obj.updateMatrixWorld(true);
        const camGuess = new THREE.Vector3(p.pos.x + Math.sin(yaw) * 8, p.pos.y + 2, p.pos.z + Math.cos(yaw) * 8);
        let fp = null, bestD = 1e9;
        p.mech.obj.traverse(o => {
          if (o.isBone && /foot$/.test(o.name)) {
            const v = new THREE.Vector3(); o.getWorldPosition(v);
            const d = v.distanceTo(camGuess);
            if (d < bestD) { bestD = d; fp = v.clone(); }
          }
        });
        if (!fp) fp = p.pos.clone();
        const camFx = Math.sin(yaw), camFz = Math.cos(yaw);
        const dx = fp.x + camFx * 1.15, dz = fp.z + camFz * 1.15;
        placePair(dx, dz, yaw, false);
        const gy = g.world.height(dx, dz);
        cam.fov = 38; cam.updateProjectionMatrix();
        cam.position.set(dx + camFx * 2.4, gy + 0.7, dz + camFz * 2.4);
        cam.lookAt(fp.x, gy + 0.25, fp.z);
      } else if (pose === 'foot') {
        G.save.jungleLion = false; G.save.jungleCostume = false; G.save.ride = true; G.save.selected = 'trex';
        if (G.level !== 'jungle') G.setLevel('jungle');
        G.show('play');
        g.spawnPlayer(false);
        const p = g.player;
        p.pos.set(90, 0, 30); p.yaw = 0.25; p.speedNow = 0; p.groundY();
        g.mountRider();
        if (g.rider) g.rider.update(0.05, p);
        g.rider.pop();
        for (let i = 0; i < 45; i++) g.rider.update(1 / 30, p);
        if (p.mech && p.mech.obj) p.mech.obj.visible = false;
        hideLine();
        const lp = g.rider.obj.position;
        placePair(lp.x + 0.75, lp.z + 0.15, 0.15, false);
        const gy = g.world.height(lp.x, lp.z);
        cam.fov = 32; cam.updateProjectionMatrix();
        cam.position.set(lp.x + 2.2, gy + 1.05, lp.z + 3.1);
        cam.lookAt(lp.x + 0.35, gy + 0.55, lp.z);
      } else {
        G.save.selected = 'trex';
        if (G.level !== 'jungle') G.setLevel('jungle');
        G.show('play');
        hideLine();
        const x = 90, z = 30, yaw = 0.2;
        placePair(x, z, yaw, false);
        const gy = g.world.height(x, z);
        cam.fov = 40; cam.updateProjectionMatrix();
        cam.position.set(x + Math.sin(yaw) * 1.35, gy + 0.48, z + Math.cos(yaw) * 1.35);
        cam.lookAt(x, gy + 0.28, z);
      }
      G.renderer.render(g.scene, g.camera);
    }, pose);
    await page.screenshot({ path: OUT + '/' + file });
  };

  await shoot('westies2-farm.png', 'poop');
  await shoot('westies2-ride.png', 'ride');
  await shoot('westies2-foot.png', 'foot');
});
