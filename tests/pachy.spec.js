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

test('v5.10.1 pachy size, seat, and skull bash', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player));
  const report = await page.evaluate(() => {
    G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'pachy';
    if (G.level !== 'jungle') G.setLevel('jungle');
    G.show('play');
    G.game.spawnPlayer(false);
    const g = G.game, p = g.player, m = p.mech, THREE = G.THREE, sk = m.skin;
    const flat = { x: 80, z: 24 }, slope = { x: 140, z: -200 };
    const play = (spot, name) => {
      p.pos.set(spot.x, 0, spot.z); p.yaw = 0.4; p.speedNow = name === 'Run' ? 12 : name === 'Walk' ? 4 : 0;
      p.roar = name === 'Roar' ? 1.2 : 0; p.chargeA = name === 'Bash' ? 1 : 0; p.groundY();
      m._clip = '';
      for (let i = 0; i < 8; i++) p.updateVisual(1 / 20);
      let minY = Infinity, at = null, bury = -Infinity;
      const v = new THREE.Vector3();
      m.obj.updateMatrixWorld(true);
      for (let i = 0; i < sk.geometry.attributes.position.count; i += 6) {
        sk.getVertexPosition(i, v); v.applyMatrix4(sk.matrixWorld);
        if (v.y < minY) { minY = v.y; at = { x: v.x, z: v.z }; }
        const pen = g.world.height(v.x, v.z) - v.y;
        if (pen > bury) bury = pen;
      }
      return { name, gap: minY - g.world.height(at.x, at.z), bury };
    };
    const rows = [];
    for (const name of ['Idle', 'Walk', 'Run']) rows.push(play(flat, name));
    rows.push(play(slope, 'Walk'));
    const stretchOf = (name) => {
      const clip = m.actions[name];
      for (const [n, a] of Object.entries(m.actions)) a.setEffectiveWeight(n === name ? 1 : 0);
      const dur = clip.getClip().duration;
      const rest = sk.geometry.attributes.position, tris = sk.geometry.index.array;
      const ra = new THREE.Vector3(), rb = new THREE.Vector3(), rc = new THREE.Vector3();
      const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
      let maxR = 1, n = 0, hot = 0;
      for (let s = 0; s < 4; s++) {
        clip.time = Math.max(0, dur * (s + 0.5) / 4 - 0.001);
        m.mixer.update(0.001); m.obj.updateMatrixWorld(true);
        for (let t = 0; t < tris.length; t += 9) {
          const i0 = tris[t], i1 = tris[t + 1], i2 = tris[t + 2];
          ra.fromBufferAttribute(rest, i0); rb.fromBufferAttribute(rest, i1); rc.fromBufferAttribute(rest, i2);
          const e0 = ra.distanceTo(rb), e1 = rb.distanceTo(rc), e2 = rc.distanceTo(ra);
          sk.getVertexPosition(i0, pa); sk.getVertexPosition(i1, pb); sk.getVertexPosition(i2, pc);
          for (const [r, f] of [[e0, pa.distanceTo(pb)], [e1, pb.distanceTo(pc)], [e2, pc.distanceTo(pa)]]) {
            if (r < 0.05) continue;
            const ratio = Math.max(f / r, r / Math.max(f, 1e-4));
            n++; if (ratio > maxR) maxR = ratio; if (ratio > 2.5) hot++;
          }
        }
      }
      return { max: Math.round(maxR * 100) / 100, hot: n ? Math.round(hot / n * 1000) / 1000 : 0 };
    };
    const stretch = {};
    for (const name of ['Idle', 'Walk', 'Run', 'Roar', 'Bash']) stretch[name] = stretchOf(name);
    p.pos.set(flat.x, 0, flat.z); p.yaw = 0; p.speedNow = 0; p.roar = 0; p.chargeA = 0; p.groundY();
    m._clip = '';
    for (let i = 0; i < 6; i++) p.updateVisual(1 / 20);
    m.obj.updateMatrixWorld(true);
    const dome = new THREE.Vector3(), hip = new THREE.Vector3();
    let footLow = Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const vv = new THREE.Vector3();
    const attr = sk.geometry.attributes.position;
    for (let i = 0; i < attr.count; i += 2) {
      sk.getVertexPosition(i, vv); vv.applyMatrix4(sk.matrixWorld);
      if (vv.y < footLow) footLow = vv.y;
      if (vv.x < minX) minX = vv.x; if (vv.x > maxX) maxX = vv.x;
      if (vv.z < minZ) minZ = vv.z; if (vv.z > maxZ) maxZ = vv.z;
    }
    m.domeTop(dome); m.hipPoint(hip);
    const ws = new THREE.Vector3();
    const riderWorld = g.rider.obj.getWorldScale(ws).y;
    const seatOf = (name) => {
      p.speedNow = name === 'Run' ? 12 : name === 'Walk' ? 4 : 0;
      p.roar = name === 'Roar' ? 1.3 : 0;
      p.chargeA = name === 'Bash' ? 1 : 0;
      p.yaw = 0;
      m._clip = '';
      for (let i = 0; i < 10; i++) p.updateVisual(1 / 20);
      g.rider.update(0.05, p);
      const hips = new THREE.Vector3(), back = new THREE.Vector3(), top = new THREE.Vector3();
      g.rider.hips.getWorldPosition(hips);
      const hide = m.backHide(back);
      m.domeTop(top);
      const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
      const ahead = top.clone().sub(hips).dot(fwd);
      return {
        name,
        hipGap: hide ? Math.round((hips.y - hide.y) * 100) / 100 : 99,
        domeAhead: Math.round(ahead * 100) / 100,
      };
    };
    const seats = ['Walk', 'Run', 'Roar', 'Bash'].map(seatOf);
    p.chargeA = 0; p.yaw = 0; p.speedNow = 0; p.groundY();
    const foe = g.spawnEnemy(p.pos.x, p.pos.z + 3.4, 2, 'para');
    foe.hp = foe.maxHp = 200; foe.pos.set(p.pos.x, 0, p.pos.z + 3.4); foe.groundY();
    const hpBefore = foe.hp;
    g.special(p);
    let seenClip = '', seenType = '', slammed = false, damaged = false, stunned = false;
    for (let i = 0; i < 28; i++) {
      g.updateAct(p, 1 / 20); p.updateVisual(1 / 20);
      if (m._clip === 'Bash') seenClip = 'Bash';
      if (p.act && p.act.type) seenType = p.act.type;
      if (p.act && p.act.slammed) slammed = true;
      if (foe.hp < hpBefore) damaged = true;
      if (foe.stunT > 0) stunned = true;
    }
    let blocky = 0, skin = 0;
    g.rider.obj.traverse(o => { if (o.isMesh && o.visible && o.userData.blocky) blocky++; if (o.isSkinnedMesh && o.visible) skin++; });
    return {
      quad: m.quad === true, skinned: m.skinned === true,
      clips: Object.keys(m.actions),
      dome: Math.round((dome.y - footLow) * 100) / 100,
      hip: Math.round((hip.y - footLow) * 100) / 100,
      length: Math.round((maxZ - minZ) * 100) / 100,
      width: Math.round((maxX - minX) * 100) / 100,
      radius: p.def.radius, speed: p.def.speed, hp: p.def.hp, special: p.def.special,
      rows, stretch, seats, riderWorld: Math.round(riderWorld * 100) / 100,
      bash: { clip: seenClip, type: seenType, slammed, damaged, stunned, foeHp: foe.hp, mounted: !!g.rider.mounted, blocky, skin },
    };
  });
  const bad = report.rows.filter(r => r.bury > 0.08 || r.gap < -0.08 || r.gap > 0.55);
  expect(bad, JSON.stringify({ bad, dome: report.dome, hip: report.hip, length: report.length })).toEqual([]);
  expect(report.quad).toBe(false);
  expect(report.skinned).toBe(true);
  expect(report.clips).toEqual(expect.arrayContaining(['Idle', 'Walk', 'Run', 'Roar', 'Bash']));
  expect(report.length).toBeGreaterThan(5.4);
  expect(report.length).toBeLessThan(6.6);
  expect(report.dome).toBeGreaterThan(2.7);
  expect(report.dome).toBeLessThan(3.4);
  expect(report.hip).toBeGreaterThan(1.9);
  expect(report.hip).toBeLessThan(2.55);
  expect(report.radius).toBeGreaterThan(1.8);
  expect(report.radius).toBeLessThan(2.8);
  expect(report.speed).toBeGreaterThan(11);
  expect(report.speed).toBeLessThan(16);
  expect(report.hp).toBeGreaterThan(150);
  expect(report.special).toBe('skullbash');
  expect(report.riderWorld).toBeGreaterThan(1.4);
  expect(report.riderWorld).toBeLessThan(1.7);
  for (const s of report.seats) {
    expect(Math.abs(s.hipGap), s.name).toBeLessThan(0.5);
    expect(s.domeAhead, s.name).toBeGreaterThan(0.25);
  }
  expect(report.bash.clip).toBe('Bash');
  expect(report.bash.type).toBe('skullbash');
  expect(report.bash.slammed).toBe(true);
  expect(report.bash.damaged).toBe(true);
  expect(report.bash.stunned).toBe(true);
  expect(report.bash.mounted).toBe(true);
  expect(report.bash.blocky).toBe(0);
  expect(report.bash.skin).toBeGreaterThan(0);
  for (const [name, s] of Object.entries(report.stretch)) {
    expect(s.max, name).toBeLessThan(16);
    expect(s.hot, name).toBeLessThan(0.1);
  }
  const dataSrc = await page.evaluate(async () => (await fetch('./js/data.js')).text());
  expect(dataSrc).toMatch(/id: 'tptero',[\s\S]{0,420}kind: 'ptero'/);
  await page.evaluate(() => { G.show('play'); });
  await expect(page.locator('#a-missile')).toContainText('SKULL');
  await expect(page.locator('#a-missile')).toContainText('BASH');
  await expect(page.locator('#b-pause')).toBeVisible();

  fs.mkdirSync('/tmp', { recursive: true });
  fs.writeFileSync('/tmp/pachy-report.json', JSON.stringify({ dome: report.dome, hip: report.hip, length: report.length, width: report.width, radius: report.radius, speed: report.speed, hp: report.hp, seats: report.seats, bash: report.bash, stretch: report.stretch, riderWorld: report.riderWorld }));
  if (info.project.name !== 'iphone-landscape') return;
  fs.mkdirSync(OUT, { recursive: true });

  const shoot = async (file, pose) => {
    await page.evaluate((pose) => {
      window.__hold = true;
      G.save.jungleLion = false; G.save.jungleCostume = false; G.save.selected = 'pachy';
      if (G.level !== 'jungle') G.setLevel('jungle');
      G.game.spawnPlayer(false);
      G.show('play');
      const g = G.game, p = g.player, THREE = G.THREE, m = p.mech;
      for (const r of g.fx.rings.splice(0)) { g.scene.remove(r.m); if (r.m.material) r.m.material.dispose(); }
      g.orbs.length = 0;
      for (const e of g.enemies) if (e.remove) e.remove();
      g.enemies.length = 0;
      const AX = 200, AZ = -160;
      p.speedNow = pose === 'walk' || pose === 'chase' ? 5 : 0;
      p.roar = 0; p.chargeA = 0;
      p.pos.set(AX, 0, AZ); p.yaw = 0.2; p.groundY();
      for (let i = 0; i < 8; i++) p.updateVisual(1 / 20);
      if (pose === 'bash') {
        g.special(p);
        for (let i = 0; i < 28; i++) {
          g.updateAct(p, 1 / 30); p.updateVisual(1 / 30);
          g.fx.update(1 / 30, g.world, () => {}, g.scene.fog);
          if (p.act && p.act.slammed) break;
        }
      }
      g.rider.update(0.05, p);
      if (pose === 'vs') {
        const e = g.spawnEnemy(AX + 1, AZ + 11, 2, 'trex');
        e.pos.set(AX + 1, 0, AZ + 11); e.yaw = Math.PI + 0.2; e.groundY(); e.speedNow = 0;
        for (let i = 0; i < 6; i++) e.updateVisual(1 / 20);
        e.mech.obj.visible = true;
      }
      if (pose === 'enemy') {
        p.mech.obj.visible = false; if (g.rider.obj) g.rider.obj.visible = false;
        const e = g.spawnEnemy(AX, AZ, 2, 'pachy', { lone: true });
        e.pos.set(AX, 0, AZ); e.yaw = 0.2; e.groundY(); e.speedNow = 4;
        for (let i = 0; i < 10; i++) e.updateVisual(1 / 20);
        e.mech.obj.visible = true;
      }
      const cam = g.camera;
      cam.fov = 40; cam.aspect = 844 / 390; cam.updateProjectionMatrix();
      G.renderer.setSize(844, 390, false);
      const ground = g.world.height(AX, AZ);
      if (pose === 'seat') {
        const look = new THREE.Vector3();
        g.rider.hips.getWorldPosition(look);
        cam.fov = 32; cam.updateProjectionMatrix();
        cam.position.set(look.x + 2.2, look.y + 0.55, look.z + 1.6);
        cam.lookAt(look.x, look.y + 0.1, look.z + 0.5);
      } else if (pose === 'vs') {
        cam.fov = 42; cam.updateProjectionMatrix();
        cam.position.set(AX + 18, ground + 4.6, AZ + 6);
        cam.lookAt(AX, ground + 1.8, AZ + 5);
      } else if (pose === 'enemy') {
        cam.position.set(AX + 9, ground + 2.2, AZ + 6);
        cam.lookAt(AX, ground + 1.4, AZ);
      } else if (pose === 'chase') {
        const look = p.pos.clone(); look.y += 1.8;
        cam.position.set(look.x - 6, look.y + 1.8, look.z + 9);
        cam.lookAt(look);
      } else if (pose === 'bash') {
        const look = new THREE.Vector3();
        (m.bones.hips || m.obj).getWorldPosition(look);
        p.mech.obj.visible = true;
        if (g.rider.obj) g.rider.obj.visible = true;
        cam.fov = 46; cam.updateProjectionMatrix();
        cam.position.set(look.x + 8, look.y + 3.6, look.z + 8);
        cam.lookAt(look.x, look.y + 0.8, look.z);
      } else {
        const look = p.pos.clone(); look.y += m.height * 0.5;
        cam.position.set(look.x + 9, look.y + 1.0, look.z + 5);
        cam.lookAt(look);
      }
      for (const e of g.enemies) if (pose !== 'vs' && pose !== 'enemy' && pose !== 'bash' && e.mech && e.mech.obj) e.mech.obj.visible = false;
      const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
      G.renderer.render(g.scene, cam);
    }, pose);
    await page.screenshot({ path: OUT + '/' + file });
  };

  await page.evaluate(() => {
    G.garage('pachy');
    const lions = document.getElementById('g-lions'); if (lions) lions.style.display = 'none';
    const babies = document.getElementById('g-babies'); if (babies) babies.style.display = 'none';
    const dino = document.getElementById('g-dino'); if (dino) dino.classList.remove('hidden');
  });
  await poll(page, () => document.getElementById('g-name').textContent.includes('Pachycephalosaurus'));
  await page.evaluate(() => {
    const panel = document.querySelector('.g-panel');
    const card = document.querySelector('.sd-card[data-super="pachy"]');
    if (panel && card) panel.scrollTop = Math.max(0, card.offsetTop - 36);
  });
  await page.screenshot({ path: OUT + '/pachy-garage.png' });
  await shoot('pachy-walk.png', 'walk');
  await shoot('pachy-seat.png', 'seat');
  await shoot('pachy-vs-trex.png', 'vs');
  await shoot('pachy-chase.png', 'chase');
  await shoot('pachy-enemy.png', 'enemy');
  await shoot('pachy-bash.png', 'bash');

  if (process.env.PACHY_STILLS === '1') return;
  await page.evaluate(() => {
    const g = G.game;
    g.orbs.length = 0;
    for (let i = 0; i < 20; i++) g.fx.update(0.1, g.world, () => {}, g.scene.fog);
  });
  fs.mkdirSync('/tmp/pachy-gait', { recursive: true });
  const frames = 6 * 10;
  for (let i = 0; i < frames; i++) {
    const jpeg = await page.evaluate((i) => {
      const g = G.game, p = g.player;
      g.orbs.length = 0;
      for (const e of g.enemies) if (e.mech && e.mech.obj) e.mech.obj.visible = false;
      p.mech.obj.visible = true;
      if (g.rider.obj) g.rider.obj.visible = true;
      p.pos.set(200 + Math.sin(0.2) * i * 0.16, 0, -160 + Math.cos(0.2) * i * 0.16);
      p.yaw = 0.2; p.speedNow = 4; p.chargeA = 0; p.roar = 0; p.groundY();
      p.updateVisual(1 / 10);
      const cam = g.camera;
      cam.fov = 40; cam.aspect = 844 / 390; cam.updateProjectionMatrix();
      const look = p.pos.clone(); look.y += p.mech.height * 0.48;
      cam.position.set(look.x + 8, look.y + 1.1, look.z + 5);
      cam.lookAt(look);
      G.renderer.render(g.scene, cam);
      const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.7);
      return url.slice(url.indexOf(',') + 1);
    }, i);
    fs.writeFileSync('/tmp/pachy-gait/' + String(i).padStart(4, '0') + '.jpg', Buffer.from(jpeg, 'base64'));
  }
  execFileSync('ffmpeg', ['-y', '-framerate', '10', '-i', '/tmp/pachy-gait/%04d.jpg', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', OUT + '/pachy-walk.mp4'], { stdio: 'inherit' });
});
