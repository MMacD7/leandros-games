import { test, expect } from '@playwright/test';
import fs from 'fs';
import { execFileSync } from 'child_process';
const OUT = '/opt/cursor/artifacts';

async function poll(page, fn, arg, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg).catch(() => false)) return;
    await page.waitForTimeout(150);
  }
  throw new Error('timed out');
}

test('v5.8.7 T-Rex stills and a walk clip', async ({ page }) => {
  test.setTimeout(240000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.screen === 'title' && G.game && G.game.player));
  await page.evaluate(() => G.garage('trex'));
  await page.evaluate(() => { const t = document.getElementById('t-real'); if (t) t.click(); });
  await poll(page, () => G.screen === 'garage' && document.getElementById('g-name').textContent.includes('T-Rex') && !document.getElementById('g-dino').classList.contains('hidden'));
  await page.waitForTimeout(500);
  await page.evaluate(() => G.frameGarage({ zoom: 0.72, yaw: 0.9 }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/v587-trex-garage.png' });

  await page.evaluate(() => {
    G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'trex';
    if (G.level !== 'jungle') G.setLevel('jungle');
    G.game.spawnPlayer(false);
    G.show('play'); window.__hold = true;
  });
  await poll(page, () => G.screen === 'play' && G.game.player.def.kind === 'trex');
  await page.waitForTimeout(400);
  await page.evaluate(() => { const t = document.getElementById('toast'); if (t) { t.textContent = ''; t.classList.remove('show'); } });
  await page.evaluate(() => {
    const w = G.game.world;
    if (w.grass) w.grass.mesh.visible = false;
    if (w.flowers) w.flowers.mesh.visible = false;
    G.game.scene.traverse(o => { if (o.isInstancedMesh) o.visible = false; });
    if (w.baseGroup) w.baseGroup.visible = false;
    for (const e of G.game.enemies) { e.pos.x += 500; if (e.mech && e.mech.obj) e.mech.obj.visible = false; }
    if (G.game.hype) G.game.hype._entToast = 1e9;
    const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
    const shout = document.getElementById('shout'); if (shout) shout.classList.remove('show');
    G.renderer.setSize(844, 390, false);
    const cam = G.game.camera; cam.aspect = 844 / 390; cam.fov = 50; cam.updateProjectionMatrix();
  });

  const shoot = async (file, speed, pose) => {
    await page.evaluate(({ speed, pose }) => {
      const g = G.game, p = g.player, THREE = G.THREE;
      p.pos.set(40, 0, 150); p.yaw = Math.PI / 2; p.groundY(); p.speedNow = speed;
      p.mech.obj.position.copy(p.pos);
      p.mech.obj.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw + Math.PI);
      p.mech.obj.updateMatrixWorld(true);
      if (pose === 'rider') {
        for (let i = 0; i < 8; i++) p.mech.animate(1 / 20, 4, {});
        if (g.rider) g.rider.update(1 / 20, p);
      } else if (pose === 'roar' || pose === 'chomp') {
        const clip = pose === 'roar' ? 'Roar' : 'Chomp';
        p.mech._clip = '';
        p.mech.play(clip, false, 1);
        p.mech.actions[clip].time = pose === 'roar' ? 0.5 : 0.22;
        p.mech.mixer.update(0);
      } else {
        for (let i = 0; i < 12; i++) p.mech.animate(1 / 20, speed, {});
      }
      p.mech.obj.updateMatrixWorld(true);
      const head = new THREE.Vector3(), tail = new THREE.Vector3(), chest = new THREE.Vector3();
      p.mech.bones.head.getWorldPosition(head);
      p.mech.bones.tail5.getWorldPosition(tail);
      p.mech.bones.chest.getWorldPosition(chest);
      const axis = head.clone().sub(tail); axis.y = 0;
      if (axis.lengthSq() < 1e-4) axis.set(1, 0, 0);
      axis.normalize();
      const side = new THREE.Vector3(-axis.z, 0, axis.x);
      const mid = head.clone().lerp(tail, 0.5); mid.y = chest.y * 0.85 + p.pos.y * 0.15;
      const length = Math.max(head.distanceTo(tail) * 1.35, 6.5);
      const fov = 50 * Math.PI / 180, aspect = 844 / 390;
      const top = Math.max(head.y, tail.y, chest.y);
      const vSpan = Math.max(top - p.pos.y, 3) * 1.55;
      const dist = Math.max(length / (1.05 * Math.tan(fov / 2) * aspect), vSpan / (2 * Math.tan(fov / 2)));
      const cam = g.camera;
      const focusY = (top + p.pos.y) / 2 - dist * Math.tan(fov / 2) * 0.16;
      cam.position.copy(mid).addScaledVector(side, dist);
      cam.position.y = focusY;
      cam.lookAt(mid.x, focusY, mid.z);
      if (pose === 'rider' && g.rider && g.rider.head) {
        const look = new THREE.Vector3();
        g.rider.head.getWorldPosition(look);
        cam.position.copy(look).addScaledVector(side, 2.6).addScaledVector(axis, 1.6);
        cam.position.y = look.y + 0.2;
        cam.lookAt(look);
      }
      G.renderer.render(g.scene, cam);
    }, { speed, pose });
    await page.screenshot({ path: OUT + '/' + file });
  };
  await shoot('v587-trex-walk.png', 5, '');
  await shoot('v587-trex-rider.png', 4, 'rider');
  await shoot('v587-trex-run.png', 12, '');
  await shoot('v587-trex-roar.png', 0, 'roar');
  await shoot('v587-trex-chomp.png', 0, 'chomp');

  await page.evaluate(() => {
    const g = G.game, p = g.player, THREE = G.THREE;
    const made = [g.spawnEnemy(p.pos.x + 16, p.pos.z, 2, 'trex'), g.spawnEnemy(p.pos.x - 16, p.pos.z, 2, 'trex')];
    made.forEach((e, i) => {
      e.pos.set(p.pos.x + (i === 0 ? 14 : -16), p.pos.y, p.pos.z);
      e.groundY(); e.yaw = p.yaw;
      e.mech.obj.visible = true;
      e.mech.obj.position.copy(e.pos);
      e.mech.obj.quaternion.copy(p.mech.obj.quaternion);
      e.mech.obj.updateMatrixWorld(true);
    });
    const box = new THREE.Box3().setFromObject(p.mech.obj);
    made.forEach(e => box.expandByObject(e.mech.obj));
    const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const length = Math.max(size.x, size.z, 8) * 1.08;
    const fov = 50 * Math.PI / 180, aspect = 844 / 390;
    const dist = length / (1.05 * Math.tan(fov / 2) * aspect);
    const cam = g.camera;
    cam.position.set(mid.x, mid.y, mid.z + dist);
    cam.lookAt(mid.x, mid.y * 0.85, mid.z);
    G.renderer.render(g.scene, cam);
  });
  await page.screenshot({ path: OUT + '/v587-trex-enemies.png' });

  await page.evaluate(() => {
    const g = G.game, p = g.player, THREE = G.THREE;
    for (const e of g.enemies) if (e.mech && e.mech.obj) e.mech.obj.visible = false;
    const e = g.spawnEnemy(p.pos.x + 22, p.pos.z, 2, 'giga');
    e.pos.set(p.pos.x + 22, 0, p.pos.z); e.yaw = p.yaw; e.groundY(); e.speedNow = 0;
    e.updateVisual(0.05);
    p.pos.set(40, 0, 150); p.yaw = Math.PI / 2; p.groundY();
    p.mech.obj.position.copy(p.pos);
    const up = new THREE.Vector3(0, 1, 0);
    p.mech.obj.quaternion.setFromAxisAngle(up, p.yaw + Math.PI);
    e.mech.obj.visible = true;
    e.mech.obj.position.copy(e.pos);
    e.mech.obj.quaternion.copy(p.mech.obj.quaternion);
    p.mech.obj.updateMatrixWorld(true);
    e.mech.obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(p.mech.obj); box.expandByObject(e.mech.obj);
    const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const length = Math.max(size.x, size.z) * 1.15;
    const fov = 50 * Math.PI / 180, aspect = 844 / 390;
    const dist = length / (1.05 * Math.tan(fov / 2) * aspect);
    const cam = g.camera;
    cam.position.set(mid.x, mid.y, mid.z + dist);
    cam.lookAt(mid.x, mid.y * 0.85, mid.z);
    G.renderer.render(g.scene, cam);
  });
  await page.screenshot({ path: OUT + '/v587-trex-giga.png' });

  await page.evaluate(() => {
    const g = G.game, p = g.player;
    for (const e of g.enemies) if (e.mech && e.mech.obj) e.mech.obj.visible = false;
    p.pos.set(40, 0, 150); p.yaw = Math.PI / 2; p.speedNow = 6; p.groundY();
    g.snapCam = true; g.cam.yaw = p.yaw + Math.PI; g.cam.pitch = 0.2; g.cam.dist = 8;
    G.renderer.setSize(844, 390, false);
    g.camera.aspect = 844 / 390; g.camera.fov = 58; g.camera.updateProjectionMatrix();
    g.updateCamera(1, { looking: false, look: { dx: 0, dy: 0 } });
    G.renderer.render(g.scene, g.camera);
  });
  await page.screenshot({ path: OUT + '/v587-trex-chase.png' });

  if (process.env.TREX_STILLS === '1') { expect(errors, errors.join('\n')).toEqual([]); return; }
  fs.mkdirSync('/tmp/trex-gait', { recursive: true });
  const fps = 20, total = 4 * fps;
  let travelled = 0;
  for (let i = 0; i < total; i++) {
    travelled += 5 / fps;
    const jpeg = await page.evaluate(({ travelled }) => {
      const g = G.game, p = g.player, THREE = G.THREE;
      for (const e of g.enemies) if (e.mech && e.mech.obj) e.mech.obj.visible = false;
      p.pos.set(-90 + travelled, 0, 30); p.yaw = Math.PI / 2; p.groundY();
      const up = new THREE.Vector3(0, 1, 0);
      p.mech.obj.position.copy(p.pos);
      p.mech.obj.quaternion.setFromAxisAngle(up, p.yaw + Math.PI);
      p.mech.obj.updateMatrixWorld(true);
      p.mech.animate(1 / 20, 5, {});
      if (g.rider) g.rider.update(1 / 20, p);
      p.mech.obj.updateMatrixWorld(true);
      const head = new THREE.Vector3(), tail = new THREE.Vector3(), chest = new THREE.Vector3();
      p.mech.bones.head.getWorldPosition(head);
      p.mech.bones.tail5.getWorldPosition(tail);
      p.mech.bones.chest.getWorldPosition(chest);
      const axis = head.clone().sub(tail); axis.y = 0;
      if (axis.lengthSq() < 1e-4) axis.set(1, 0, 0);
      axis.normalize();
      const side = new THREE.Vector3(-axis.z, 0, axis.x);
      const mid = head.clone().lerp(tail, 0.5); mid.y = chest.y * 0.85 + p.pos.y * 0.15;
      const length = Math.max(head.distanceTo(tail) * 1.35, 6.5);
      const fov = 50 * Math.PI / 180, aspect = 844 / 390;
      const top = Math.max(head.y, tail.y, chest.y);
      const vSpan = Math.max(top - p.pos.y, 3) * 1.55;
      const dist = Math.max(length / (1.05 * Math.tan(fov / 2) * aspect), vSpan / (2 * Math.tan(fov / 2)));
      const cam = g.camera;
      const focusY = (top + p.pos.y) / 2 - dist * Math.tan(fov / 2) * 0.16;
      cam.position.copy(mid).addScaledVector(side, dist);
      cam.position.y = focusY;
      cam.lookAt(mid.x, focusY, mid.z);
      G.renderer.render(g.scene, cam);
      const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.7);
      return url.slice(url.indexOf(',') + 1);
    }, { travelled });
    fs.writeFileSync('/tmp/trex-gait/' + String(i).padStart(4, '0') + '.jpg', Buffer.from(jpeg, 'base64'));
  }
  execFileSync('ffmpeg', ['-y', '-framerate', '20', '-i', '/tmp/trex-gait/%04d.jpg', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', OUT + '/v587-trex-walk.mp4'], { stdio: 'inherit' });
  expect(errors, errors.join('\n')).toEqual([]);
});
