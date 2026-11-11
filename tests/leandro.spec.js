import { test, expect } from '@playwright/test';
import fs from 'fs';

const OUT = '/opt/cursor/artifacts';
const MOUNTS = ['lion', 'trex', 'brachio', 'giga', 'spinos', 'trice', 'carno', 'velo'];

async function poll(page, fn, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn).catch(() => false)) return;
    await page.waitForTimeout(150);
  }
  throw new Error('timed out');
}

test('v5.9.3 leandro sits on every 3D mount', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player));
  await poll(page, () => {
    try {
      G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'trex';
      if (G.level !== 'jungle') G.setLevel('jungle');
      G.game.spawnPlayer(false);
      return !!(G.game.rider.skinned && G.game.rider.hipBone);
    } catch (e) { return false; }
  });

  const report = await page.evaluate((mounts) => {
    const g = G.game, THREE = G.THREE;
    const rows = [];
    for (const id of mounts) {
      G.save.jungleLion = id === 'lion';
      G.save.jungleCostume = false;
      G.save.selected = id === 'lion' ? 'trex' : id;
      if (id === 'lion') G.save.jungleLion = true;
      g.spawnPlayer(false);
      const p = g.player;
      if (id === 'lion' && p.def.id !== 'lion') { rows.push({ id, error: 'not lion' }); continue; }
      const pose = (mode) => {
        p.pos.set(20, 0, 20); p.yaw = 0.4; p.groundY();
        p.speedNow = mode === 'run' ? 16 : mode === 'walk' ? 5 : 0;
        p.roar = mode === 'roar' ? 1.4 : 0;
        p.chargeA = mode === 'special' && (id === 'carno') ? 1 : 0;
        p.splashA = mode === 'special' && id === 'spinos' ? 1 : 0;
        p.pounceA = mode === 'special' && id === 'velo' ? 1 : 0;
        p.slashA = mode === 'special' && id === 'giga' ? 1 : 0;
        if (p.mech) p.mech._clip = '';
        for (let i = 0; i < 6; i++) p.updateVisual(1 / 20);
        g.rider.update(0.05, p);
        const hip = new THREE.Vector3(), mark = new THREE.Vector3();
        g.rider.hipBone.getWorldPosition(hip);
        g.rider.hips.getWorldPosition(mark);
        let blocky = 0, skin = 0;
        g.rider.obj.traverse(o => { if (o.isMesh && o.visible) { if (o.isSkinnedMesh) skin++; else if (o.userData.blocky) blocky++; } });
        return { gap: Math.round(hip.distanceTo(mark) * 100) / 100, blocky, skin, y: Math.round((hip.y - mark.y) * 100) / 100 };
      };
      const modes = {};
      for (const mode of ['walk', 'run', 'roar', 'special']) modes[mode] = pose(mode);
      rows.push({ id: p.def.id, modes });
    }
    return rows;
  }, MOUNTS);

  console.log('leandro', JSON.stringify(report));
  for (const row of report) {
    expect(row.error || '', row.id).toBe('');
    for (const [mode, s] of Object.entries(row.modes)) {
      expect(s.gap, row.id + ' ' + mode).toBeLessThan(0.4);
      expect(s.blocky, row.id + ' ' + mode).toBe(0);
      expect(s.skin, row.id + ' ' + mode).toBeGreaterThan(0);
    }
  }

  if (info.project.name !== 'iphone-landscape') return;
  fs.mkdirSync(OUT, { recursive: true });
  const shoot = async (file, id, pose) => {
    await page.evaluate(({ id, pose }) => {
      window.__hold = true;
      G.save.jungleCostume = false;
      G.save.jungleLion = id === 'lion';
      G.save.selected = id === 'lion' ? 'trex' : id;
      if (G.level !== 'jungle') G.setLevel('jungle');
      G.game.spawnPlayer(false);
      G.show('play');
      const g = G.game, p = g.player, THREE = G.THREE;
      p.pos.set(105, 0, 40); p.yaw = Math.PI / 2; p.speedNow = 4; p.roar = 0; p.groundY();
      for (let i = 0; i < 8; i++) p.updateVisual(1 / 20);
      g.rider.update(0.05, p);
      const cam = g.camera;
      cam.aspect = 844 / 390;
      G.renderer.setSize(844, 390, false);
      const look = new THREE.Vector3();
      g.rider.head.getWorldPosition(look);
      if (pose === 'face') {
        cam.fov = 28; cam.updateProjectionMatrix();
        cam.position.set(look.x + 1.6, look.y + 0.35, look.z + 2.4);
        cam.lookAt(look.x + 0.05, look.y - 0.02, look.z);
      } else if (id === 'lion') {
        cam.fov = 38; cam.updateProjectionMatrix();
        cam.position.set(look.x - 2.2, look.y + 0.15, look.z + 7.2);
        cam.lookAt(look.x + 0.6, look.y - 0.7, look.z);
      } else {
        cam.fov = 36; cam.updateProjectionMatrix();
        cam.position.set(look.x - 2.4, look.y + 0.2, look.z + 8.4);
        cam.lookAt(look.x + 1.2, look.y - 0.9, look.z);
      }
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      G.renderer.render(g.scene, cam);
    }, { id, pose });
    await page.screenshot({ path: OUT + '/' + file });
  };
  await shoot('leandro-closeup.png', 'trex', 'face');
  await shoot('leandro-on-lion.png', 'lion', 'side');
  await shoot('leandro-on-brachio.png', 'brachio', 'side');
  await page.evaluate(() => {
    G.save.jungleLion = false; G.save.jungleCostume = false;
    G.garage('trex');
    const lions = document.getElementById('g-lions'); if (lions) lions.style.display = 'none';
    const dino = document.getElementById('g-dino'); if (dino) dino.classList.remove('hidden');
    G.frameGarage({ zoom: 1.35, yaw: 0.6 });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/leandro-garage.png' });
});
