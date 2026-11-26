import { test, expect } from '@playwright/test';

const VIEWS = [
  { name: 'iphone', width: 390, height: 844 },
  { name: 'iphone-landscape', width: 844, height: 390 },
  { name: 'ipad', width: 820, height: 1180 },
  { name: 'ipad-landscape', width: 1180, height: 820 },
];

function overlaps(a, b) {
  if (!a || !b || !a.visible || !b.visible) return false;
  return !(a.r <= b.x + 1 || b.r <= a.x + 1 || a.b <= b.y + 1 || b.b <= a.y + 1);
}

async function ready(page) {
  await page.goto('/index.html?auto=0');
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    if (await page.evaluate(() => !!(window.G && G.screen === 'title' && G.game)).catch(() => false)) return;
    await page.waitForTimeout(200);
  }
  throw new Error('game did not boot');
}

test('Stompolis loads, swing attaches, First Fling completes, pause stays clear', async ({ page }) => {
  test.setTimeout(240000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await ready(page);
  await expect(page.locator('#lv-stomp')).toHaveAttribute('aria-label', 'Play The Swing Boy');
  await expect(page.locator('#ver')).toHaveText('v5.12.0');
  await page.evaluate(() => G.setLevel('stomp'));
  await page.evaluate(() => G.show('play'));
  await page.waitForTimeout(300);
  const boot = await page.evaluate(() => {
    const s = G.game.stomp, p = G.game.player;
    return { level: G.level, id: p.def.id, bands: !!(p.mech.R && p.mech.R._bands && p.mech.R._bands.length), anchors: s.anchors.length, prompt: document.getElementById('stomp-prompt').textContent };
  });
  expect(boot.level).toBe('stomp');
  expect(boot.id).toBe('hoopster');
  expect(boot.bands).toBe(true);
  expect(boot.anchors).toBeGreaterThan(8);
  expect(boot.prompt).toContain('SWING');

  for (const v of VIEWS) {
    await page.setViewportSize({ width: v.width, height: v.height });
    await page.waitForTimeout(200);
    for (let n = 0; n < 3; n++) {
      const shown = await page.evaluate(() => { const rot = document.getElementById('rotate'); return !!(rot && getComputedStyle(rot).display !== 'none'); });
      if (!shown) break;
      await page.locator('#rot-ok').click();
      await page.waitForTimeout(100);
    }
    const boxes = await page.evaluate(() => {
      const box = id => {
        const el = document.getElementById(id);
        if (!el) return { id, visible: false };
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        const hidden = el.classList.contains('hidden') || s.display === 'none' || s.visibility === 'hidden' || r.width < 2 || r.height < 2;
        return { id, x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, visible: !hidden };
      };
      return ['b-pause', 'b-map', 'a-laser', 'a-missile', 'a-melee', 'a-boost'].map(box);
    });
    const pause = boxes.find(b => b.id === 'b-pause');
    expect(pause.visible, v.name + ' pause').toBe(true);
    expect(pause.w, v.name).toBeGreaterThanOrEqual(44);
    expect(pause.h, v.name).toBeGreaterThanOrEqual(44);
    for (const b of boxes) if (b.id !== 'b-pause') expect(overlaps(pause, b), `${v.name} pause overlaps ${b.id}`).toBe(false);
    const swing = boxes.find(b => b.id === 'a-laser');
    expect(swing.visible, v.name + ' swing').toBe(true);
    expect(swing.w, v.name + ' swing size').toBeGreaterThanOrEqual(68);
    await page.locator('#b-pause').click();
    await expect(page.locator('#p-resume')).toBeVisible();
    await page.locator('#p-resume').click();
    await expect(page.locator('#pause')).toBeHidden();
  }

  const swing = await page.evaluate(() => {
    G.game.stomp.reset();
    const b = document.getElementById('a-laser');
    b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, bubbles: true, clientX: 30, clientY: 30 }));
    for (let i = 0; i < 20; i++) G.sim(1 / 30);
    const s = G.game.stomp;
    const out = { hooked: s.hooked, cable: s.cable.visible, ctrl: s.ctrl.swing, state: s.state };
    b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true }));
    for (let i = 0; i < 8; i++) G.sim(1 / 30);
    out.flung = s.sawFling && s.state !== 'swing';
    document.getElementById('a-missile').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, bubbles: true, clientX: 8, clientY: 8 }));
    G.sim(1 / 30);
    document.getElementById('a-missile').dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, bubbles: true }));
    for (let i = 0; i < 12; i++) G.sim(1 / 30);
    out.zip = s.sawZip;
    const p = G.game.player;
    p.pos.set(s.david.x, s.david.y, s.david.z);
    s.state = 'roof';
    document.getElementById('a-melee').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, bubbles: true, clientX: 8, clientY: 8 }));
    G.sim(1 / 30);
    for (let i = 0; i < 100; i++) G.sim(1 / 30);
    out.wrapped = s.david.wrapped;
    out.won = s.won;
    out.win = !document.getElementById('stompwin').classList.contains('hidden');
    out.shouts = G.hud.shoutLog || [];
    out.enemies = G.game.enemies.length;
    return out;
  });
  expect(swing.hooked).toBe(true);
  expect(swing.cable).toBe(true);
  expect(swing.ctrl).toBeGreaterThan(0);
  expect(swing.flung).toBe(true);
  expect(swing.zip).toBe(true);
  expect(swing.wrapped).toBe(true);
  expect(swing.won).toBe(true);
  expect(swing.win).toBe(true);
  expect(swing.shouts).toContain('NOOO DAVIDD!');
  expect(swing.shouts).toContain('THATS NOT FUNNY DAVID!!');
  expect(swing.enemies).toBe(0);
  expect(errors).toEqual([]);
});

test('a fling from three roofs lands, stays outside the towers, and rises', async ({ page }) => {
  test.setTimeout(180000);
  await ready(page);
  const report = await page.evaluate(() => {
    window.__hold = true;
    G.setLevel('stomp');
    G.show('play');
    const inside = (p, towers) => {
      for (const t of towers) if (p.pos.y < t.h - 0.15 && Math.hypot(p.pos.x - t.x, p.pos.z - t.z) < t.r - 0.05) return true;
      return false;
    };
    const hops = [[0, 1], [1, 4], [4, 2]];
    const releases = [];
    for (let f = 15; f <= 90; f += 5) releases.push(f);
    let landed = 0, total = 0, insideFrames = 0, lowApex = 0;
    const rows = [];
    for (const [ri, ai] of hops) {
      for (const rel of releases) {
        const s = G.game.stomp, p = G.game.player;
        s.reset();
        const roof = s.towers[ri];
        const aim = s.towers[ai];
        p.pos.set(roof.x, roof.h, roof.z);
        p.yaw = Math.atan2(aim.x - roof.x, aim.z - roof.z);
        s.state = 'roof'; s.lastRoof = roof; s.won = false; s.vel.set(0, 0, 0);
        window.input.btn.laser = true;
        let insideRun = 0, apex = roof.h, held = false;
        for (let f = 0; f < rel; f++) {
          G.sim(1 / 30);
          if (inside(p, s.towers)) insideRun++;
          if (p.pos.y > apex) apex = p.pos.y;
          if (s.state === 'roof' && s.lastRoof && s.lastRoof !== roof) { held = true; break; }
        }
        const left = roof.h;
        let end = s.state;
        if (!held) {
          window.input.btn.laser = false;
          for (let f = 0; f < 150; f++) {
            G.sim(1 / 30);
            if (inside(p, s.towers)) insideRun++;
            if (p.pos.y > apex) apex = p.pos.y;
            if (s.state === 'roof' || s.state === 'bubble') { end = s.state; break; }
          }
        }
        const ok = held || end === 'roof';
        const rise = apex >= left + 1;
        total++; if (ok) landed++; if (!rise) lowApex++; insideFrames += insideRun;
        rows.push({ roof: roof.h, rel, end: held ? 'held' : end, apex: Math.round((apex - left) * 100) / 100, inside: insideRun });
      }
    }
    window.input.btn.laser = false;
    return { landed, total, pct: Math.round(1000 * landed / total) / 10, insideFrames, lowApex, rows };
  });
  console.log('FLING', report.pct + '%', 'inside', report.insideFrames, 'lowApex', report.lowApex, 'of', report.total);
  console.log(report.rows.filter(r => r.end !== 'roof' || r.apex < 1 || r.inside).map(r => JSON.stringify(r)).join('\n'));
  expect(report.insideFrames).toBe(0);
  expect(report.lowApex / report.total).toBeLessThanOrEqual(0.1);
  expect(report.pct).toBeGreaterThanOrEqual(80);
});
