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

test('lion paws stay on the ground in every clip', async ({ page }, info) => {
  test.setTimeout(180000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player));

  const report = await page.evaluate(() => {
    const g = G.game, THREE = G.THREE;
    const clips = ['Idle', 'Walk', 'Run', 'Roar', 'Chomp'];
    const gapOf = (mech, world) => {
      const sk = mech.skin;
      mech.obj.updateMatrixWorld(true);
      const attr = sk.geometry.attributes.position;
      const v = new THREE.Vector3();
      let minY = Infinity, at = null, bury = -Infinity;
      for (let i = 0; i < attr.count; i += 2) {
        sk.getVertexPosition(i, v);
        v.applyMatrix4(sk.matrixWorld);
        const pen = world.height(v.x, v.z) - v.y;
        if (v.y < minY) { minY = v.y; at = v.clone(); }
        if (pen > bury) bury = pen;
      }
      return { gap: minY - world.height(at.x, at.z), bury };
    };
    const spots = (world) => {
      const planeErr = (x, z) => {
        const h = world.height(x, z);
        const n = world.normalAt(x, z, new THREE.Vector3());
        let err = 0;
        for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1.6, 1.6], [-1.6, 1.6]]) {
          const hh = world.height(x + dx, z + dz);
          const planeY = h - (n.x * dx + n.z * dz) / Math.max(0.2, n.y);
          err = Math.max(err, Math.abs(hh - planeY));
        }
        return { h, ny: n.y, err };
      };
      let flat = null, slope = null;
      const lim = world.playR > 400 ? 220 : 80, step = world.playR > 400 ? 6 : 4;
      for (let x = -lim; x <= lim; x += step) for (let z = -lim; z <= lim; z += step) {
        if (world.playR > 400 && (Math.hypot(x - 18, z + 48) < 50 || Math.hypot(x - 150, z - 8) < 48)) continue;
        const s = planeErr(x, z);
        if (s.h < 1.5 || s.h > 28) continue;
        const row = { x, z, ...s };
        if (s.ny > 0.992 && s.err < 0.05 && (!flat || s.err < flat.err)) flat = row;
        if (s.ny > 0.984 && s.ny < 0.994 && s.err < 0.04 && (!slope || s.ny > slope.ny || (s.ny === slope.ny && s.err < slope.err))) slope = row;
      }
      return { flat, slope };
    };
    const playJungle = (spot, name) => {
      const p = g.player;
      p.pos.set(spot.x, 0, spot.z); p.yaw = 0.4; p.groundY(); p.tilt.identity();
      let worst = { gap: 0, bury: -1, name };
      for (let i = 0; i < 18; i++) {
        p.speedNow = name === 'Run' ? 12 : name === 'Walk' ? 5 : 0;
        p.jaw = name === 'Chomp' ? 1.6 : 0;
        p.roar = name === 'Roar' ? 1.6 : 0;
        p.updateVisual(1 / 20);
        if (i < 12) continue;
        const s = gapOf(p.mech, g.world);
        if (s.bury > worst.bury || Math.abs(s.gap) > Math.abs(worst.gap)) worst = { ...s, name };
      }
      return worst;
    };
    G.save.jungleLion = true; G.save.jungleCostume = false; G.save.farmLion = true; G.save.selected = 'rex';
    if (G.level !== 'jungle') G.setLevel('jungle');
    g.spawnPlayer(false);
    const jungleSpots = spots(g.world);
    const jungle = [];
    for (const name of clips) {
      jungle.push({ where: 'flat', ...playJungle(jungleSpots.flat, name) });
      jungle.push({ where: 'slope', ...playJungle(jungleSpots.slope, name) });
    }

    G.setLevel('farm');
    const farm = G.game.farm;
    farm.ensureFarmLion();
    const farmSpots = spots(G.game.world);
    const stub = { pos: { x: 0, y: 0, z: 0 }, yaw: 0.4, speedNow: 0, turn: 0, mech: { obj: { visible: true } } };
    farm.ridingLion = true;
    const farmRows = [];
    for (const spot of [['flat', farmSpots.flat], ['slope', farmSpots.slope]]) {
      for (const name of clips) {
        let worst = { gap: 0, bury: -1, name, where: spot[0] };
        for (let i = 0; i < 18; i++) {
          stub.pos.x = spot[1].x; stub.pos.z = spot[1].z; stub.yaw = 0.4;
          stub.speedNow = name === 'Run' ? 12 : name === 'Walk' ? 5 : 0;
          farm.farmLion.jaw = name === 'Chomp' ? 1.6 : 0;
          farm.farmLion.thunderT = name === 'Roar' ? 1 : 0;
          farm.syncFarmLion(stub, 1 / 20, true);
          if (i < 12) continue;
          const s = gapOf(farm.farmLion, G.game.world);
          if (s.bury > worst.bury || Math.abs(s.gap) > Math.abs(worst.gap)) worst = { ...s, name, where: spot[0] };
        }
        farmRows.push(worst);
      }
    }
    farm.ridingLion = false;
    const round = (row) => ({ ...row, gap: Math.round(row.gap * 1000) / 1000, bury: Math.round(row.bury * 1000) / 1000 });
    return {
      lion: G.game.player.def.lion === true,
      jungleSpots, farmSpots,
      jungle: jungle.map(round),
      farm: farmRows.map(round),
    };
  });

  const bad = [...report.jungle, ...report.farm].filter(r => r.bury > 0.06 || r.gap < -0.06 || r.gap > 0.18);
  expect(bad, JSON.stringify({ bad, spots: { jungle: report.jungleSpots, farm: report.farmSpots } })).toEqual([]);
  expect(report.jungle.length).toBe(10);
  expect(report.farm.length).toBe(10);

  if (info.project.name !== 'iphone-landscape') return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => {
    window.__hold = true;
    G.setLevel('jungle');
    G.save.jungleLion = true; G.save.jungleCostume = false; G.save.selected = 'rex';
    G.game.spawnPlayer(false);
    G.show('play');
    const p = G.game.player;
    p.pos.set(-68, 0, 32); p.yaw = Math.PI / 2; p.speedNow = 0; p.jaw = 0; p.roar = 0; p.groundY();
    for (let i = 0; i < 16; i++) p.updateVisual(1 / 20);
    const THREE = G.THREE, m = p.mech;
    const yaw = p.yaw;
    const side = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const cam = G.game.camera;
    cam.fov = 42; cam.aspect = 844 / 390; cam.updateProjectionMatrix();
    cam.position.set(p.pos.x, p.pos.y + 1.35, p.pos.z).addScaledVector(side, 7.2);
    cam.lookAt(p.pos.x, p.pos.y + 0.85, p.pos.z);
    G.renderer.setSize(844, 390, false);
    const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
    G.renderer.render(G.game.scene, cam);
  });
  await page.screenshot({ path: OUT + '/lion-jungle-side.png' });

  await page.evaluate(() => {
    G.setLevel('farm');
    G.save.farmLion = true;
    const farm = G.game.farm;
    farm.ensureFarmLion();
    window.__hold = true;
    farm.ridingLion = true;
    const stub = { pos: { x: -8, y: 0, z: 72 }, yaw: Math.PI / 2, speedNow: 5, turn: 0, mech: { obj: { visible: true } } };
    for (let i = 0; i < 16; i++) {
      stub.pos.x = -8 + i * 0.22;
      farm.syncFarmLion(stub, 1 / 20, true);
    }
    const THREE = G.THREE, m = farm.farmLion;
    const yaw = stub.yaw;
    const side = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const cam = G.game.camera;
    cam.fov = 42; cam.aspect = 844 / 390; cam.updateProjectionMatrix();
    cam.position.set(m.obj.position.x, m.obj.position.y + 1.35, m.obj.position.z).addScaledVector(side, 7.2);
    cam.lookAt(m.obj.position.x, m.obj.position.y + 0.85, m.obj.position.z);
    const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
    G.renderer.render(G.game.scene, cam);
  });
  await page.screenshot({ path: OUT + '/lion-farm-walk.png' });

  await page.evaluate(() => {
    window.__hold = true;
    G.setLevel('jungle');
    G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'trex';
    G.game.spawnPlayer(false);
    const p = G.game.player;
    p.pos.set(76, 0, 32); p.yaw = Math.PI / 2; p.speedNow = 5; p.groundY();
    for (let i = 0; i < 12; i++) p.updateVisual(1 / 20);
    const THREE = G.THREE, m = p.mech;
    m.obj.updateMatrixWorld(true);
    const head = new THREE.Vector3(), tail = new THREE.Vector3(), chest = new THREE.Vector3();
    m.bones.head.getWorldPosition(head);
    m.bones.tail5.getWorldPosition(tail);
    m.bones.chest.getWorldPosition(chest);
    const yaw = p.yaw;
    const side = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const cam = G.game.camera;
    cam.fov = 42; cam.aspect = 844 / 390; cam.updateProjectionMatrix();
    cam.position.set(p.pos.x, p.pos.y + 2.4, p.pos.z).addScaledVector(side, 14);
    cam.lookAt(p.pos.x, p.pos.y + 1.6, p.pos.z);
    const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
    G.renderer.render(G.game.scene, cam);
  });
  await page.screenshot({ path: OUT + '/trex-walk-check.png' });
});
