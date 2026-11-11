import { test, expect } from '@playwright/test';
import fs from 'fs';
import { execFileSync } from 'child_process';

const OUT = '/opt/cursor/artifacts';

async function poll(page, fn, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn).catch(() => false)) return;
    await page.waitForTimeout(150);
  }
  throw new Error('timed out');
}

test('v5.9.6 bigger jungle island', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player));
  const report = await page.evaluate(() => {
    G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'trex';
    if (G.level !== 'jungle') G.setLevel('jungle');
    G.show('play');
    const g = G.game, w = g.world, p = g.player;
    let canopy = 0;
    for (const set of w.lodSets || []) for (const m of [...(set.hi || []), ...(set.lo || [])]) if (m.userData && m.userData.canopy) canopy++;
    const lake = w.height(150, 8);
    const up = w.height(2, -58);
    const lip = w.height(18, -48);
    const low = w.height(70, -22);
    const volc = w.height(-40, -110);
    const beach = [];
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2, d = w.islandR * 0.82;
      const x = Math.cos(a) * d, z = Math.sin(a) * d, h = w.height(x, z);
      if (h > 0.3 && h < 2.4) beach.push({ x, z, h });
    }
    const spots = [[200, -180], [150, 8], [-40, -70], beach[0] ? [beach[0].x, beach[0].z] : [300, 0]];
    const contact = [];
    for (const [x, z] of spots) {
      p.pos.set(x, 0, z); p.groundY();
      for (let i = 0; i < 4; i++) p.updateVisual(1 / 20);
      contact.push({ x, z, y: p.pos.y, h: w.height(x, z), gap: p.pos.y - w.height(x, z) });
    }
    const spawns = [];
    for (let i = 0; i < 6; i++) {
      const s = g.roamSpawnPoint();
      const h = w.height(s[0], s[1]);
      spawns.push({ x: s[0], z: s[1], h });
    }
    let ms = 0;
    if (infoName() === 'iphone') {
      G.sim(0.4);
      const n = 12, t0 = performance.now();
      for (let i = 0; i < n; i++) { G.sim(1 / 30); G.renderer.render(g.scene, g.camera); }
      ms = (performance.now() - t0) / n;
    }
    function infoName() { return window.__proj || ''; }
    return {
      span: w.span, islandR: w.islandR, playR: w.playR,
      area: (w.islandR / 300) ** 2,
      canopy, falls: !!(w.falls && w.falls.parent),
      lake, up, lip, low, volc, beach: beach[0] || null, contact, spawns, ms,
    };
  });
  expect(report.span).toBeGreaterThan(1200);
  expect(report.islandR).toBeGreaterThan(480);
  expect(report.playR).toBeGreaterThan(520);
  expect(report.area).toBeGreaterThan(2.5);
  expect(report.area).toBeLessThan(3.2);
  expect(report.canopy).toBeGreaterThan(0);
  expect(report.falls).toBe(true);
  expect(report.lake).toBeLessThan(0);
  expect(report.up).toBeGreaterThan(8);
  expect(report.low).toBeLessThan(report.up - 4);
  expect(report.volc).toBeGreaterThan(40);
  expect(report.beach).toBeTruthy();
  for (const c of report.contact) {
    expect(Math.abs(c.gap), JSON.stringify(c)).toBeLessThan(2);
    expect(Number.isFinite(c.y)).toBe(true);
  }
  for (const s of report.spawns) {
    expect(s.h).toBeGreaterThan(1.2);
    expect(s.h).toBeLessThan(42);
  }

  if (info.project.name === 'iphone') {
    const bench = await page.evaluate(() => {
      const g = G.game;
      for (let i = 0; i < 8; i++) { G.sim(1 / 30); G.renderer.render(g.scene, g.camera); }
      const samples = [];
      for (let i = 0; i < 16; i++) {
        const a = performance.now();
        G.sim(1 / 30); G.renderer.render(g.scene, g.camera);
        samples.push(performance.now() - a);
      }
      const sorted = samples.slice().sort((a, b) => a - b);
      const median = sorted[7];
      const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
      return {
        ms: Math.round(median * 10) / 10,
        mean: Math.round(mean * 10) / 10,
        max: Math.round(sorted[sorted.length - 1]),
        fps: Math.round(1000 / median),
        tris: G.renderer.info.render.triangles,
      };
    });
    console.log('island-fps', JSON.stringify({ beforeMs: 8.6, beforeFps: 116, ...bench }));
    expect(bench.ms).toBeLessThan(30);
  }

  if (info.project.name !== 'iphone-landscape') return;
  fs.mkdirSync(OUT, { recursive: true });
  console.log('island', JSON.stringify(report));

  const shoot = async (file, pose) => {
    await page.evaluate((pose) => {
      window.__hold = true;
      const g = G.game, p = g.player, w = g.world, THREE = G.THREE;
      G.show('play');
      p.mech.obj.visible = true;
      if (g.rider.obj) g.rider.obj.visible = true;
      const cam = g.camera;
      cam.aspect = 844 / 390; cam.fov = pose === 'overview' || pose === 'fly' ? 55 : 42;
      cam.updateProjectionMatrix();
      G.renderer.setSize(844, 390, false);
      const place = (x, z, yaw) => { p.pos.set(x, 0, z); p.yaw = yaw; p.speedNow = 0; p.roar = 0; p.groundY(); for (let i = 0; i < 6; i++) p.updateVisual(1 / 20); g.rider.update(0.05, p); };
      if (pose === 'overview') {
        p.mech.obj.visible = false; if (g.rider.obj) g.rider.obj.visible = false;
        cam.position.set(40, 380, 520); cam.lookAt(0, 20, 0);
      } else if (pose === 'jungle') {
        place(180, -160, 0.6);
        const look = p.pos.clone(); look.y += 5;
        cam.position.set(look.x - 12, w.height(look.x - 12, look.z + 20) + 6, look.z + 20);
        cam.lookAt(look.x + 4, look.y + 9, look.z - 6);
      } else if (pose === 'beach') {
        const b = (() => { for (let i = 0; i < 36; i++) { const a = i / 36 * 6.283, d = w.islandR * 0.8, x = Math.cos(a) * d, z = Math.sin(a) * d, h = w.height(x, z); if (h > 0.4 && h < 2.2) return { x, z }; } return { x: 400, z: 40 }; })();
        place(b.x, b.z, 0.4);
        const look = p.pos.clone(); look.y += 2;
        cam.position.set(look.x - 12, look.y + 5, look.z + 18); cam.lookAt(look.x, look.y, look.z - 10);
      } else if (pose === 'river') {
        const f = w.falls; f.updateWorldMatrix(true, true);
        const wp = f.getWorldPosition(new THREE.Vector3());
        const bx = wp.x + 28, bz = wp.z + 18;
        place(bx - 4, bz + 2, -2.3);
        cam.position.set(bx, w.height(bx, bz) + 7, bz);
        cam.lookAt(wp.x, wp.y - 7, wp.z);
        window.__falls = { x: +wp.x.toFixed(1), y: +wp.y.toFixed(1), z: +wp.z.toFixed(1), camY: +cam.position.y.toFixed(1) };
      } else if (pose === 'volcano') {
        G.sim(1.6);
        place(30, 10, Math.PI);
        const cy = w.craterY || w.height(-40, -110);
        cam.position.set(70, w.height(70, -20) + 22, 30);
        cam.lookAt(-40, cy + 16, -110);
      }
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      G.renderer.render(g.scene, cam);
    }, pose);
    await page.screenshot({ path: OUT + '/' + file });
  };

  await shoot('island-overview.png', 'overview');
  await shoot('island-ride-jungle.png', 'jungle');
  await shoot('island-ride-beach.png', 'beach');
  await shoot('island-river-waterfall.png', 'river');
  console.log('falls', JSON.stringify(await page.evaluate(() => window.__falls)));
  await shoot('island-volcano.png', 'volcano');
  await page.evaluate(() => { window.__hold = false; G.show('play'); });
  await page.waitForTimeout(400);
  await page.locator('#radar').screenshot({ path: OUT + '/island-minimap.png' });

  fs.mkdirSync('/tmp/island-fly', { recursive: true });
  const frames = 8 * 10;
  for (let i = 0; i < frames; i++) {
    const jpeg = await page.evaluate((i) => {
      const g = G.game, THREE = G.THREE, cam = g.camera;
      window.__hold = true;
      g.player.mech.obj.visible = true;
      if (g.rider.obj) g.rider.obj.visible = true;
      const a = i / 80 * Math.PI * 2;
      cam.fov = 55; cam.aspect = 844 / 390; cam.updateProjectionMatrix();
      G.renderer.setSize(844, 390, false);
      cam.position.set(Math.sin(a) * 340, 150 + Math.sin(a * 2) * 30, Math.cos(a) * 340);
      cam.lookAt(Math.sin(a + 0.4) * 40, 25, Math.cos(a + 0.4) * 40);
      G.renderer.render(g.scene, cam);
      const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.65);
      return url.slice(url.indexOf(',') + 1);
    }, i);
    fs.writeFileSync('/tmp/island-fly/' + String(i).padStart(4, '0') + '.jpg', Buffer.from(jpeg, 'base64'));
  }
  execFileSync('ffmpeg', ['-y', '-framerate', '10', '-i', '/tmp/island-fly/%04d.jpg', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', OUT + '/island-flyover.mp4'], { stdio: 'inherit' });
});
