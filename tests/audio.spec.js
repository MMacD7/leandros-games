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

function wavBytes(channel, sampleRate) {
  const n = channel.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, channel[i]));
    buf.writeInt16LE((s < 0 ? s * 0x8000 : s * 0x7fff) | 0, 44 + i * 2);
  }
  return buf;
}

test('v5.9.7 metal unlocks after a tap and the toggle works', async ({ page }, info) => {
  test.setTimeout(180000);
  await page.goto('/index.html');
  await poll(page, () => !!(window.G && G.game && G.game.player));
  const before = await page.evaluate(() => G.audioCtx());
  expect(before).toBeFalsy();
  await page.evaluate(() => { const rot = document.getElementById('rotate'); if (rot && getComputedStyle(rot).display !== 'none') document.getElementById('rot-ok').click(); });
  await page.locator('#b-music').click();
  const unlocked = await page.evaluate(() => ({
    state: G.audioCtx() && G.audioCtx().state,
    enabled: G.music.enabled,
    roam: G.music.bpm('roam'),
    battle: G.music.bpm('battle'),
    boss: G.music.bpm('boss'),
  }));
  expect(unlocked.state === 'running' || unlocked.state === 'suspended').toBe(true);
  if (unlocked.state === 'suspended') await page.evaluate(() => G.audioCtx().resume());
  expect(unlocked.enabled).toBe(false);
  expect(unlocked.roam).toBeGreaterThanOrEqual(160);
  expect(unlocked.roam).toBeLessThanOrEqual(180);
  expect(unlocked.battle).toBeGreaterThan(unlocked.roam);
  expect(unlocked.boss).toBeGreaterThanOrEqual(unlocked.battle);
  expect(unlocked.boss).toBeLessThanOrEqual(184);
  await page.locator('#b-music').click();
  const back = await page.evaluate(() => G.music.enabled);
  expect(back).toBe(true);

  await page.evaluate(() => { G.show('play'); });
  const battle = await page.evaluate(() => {
    const g = G.game, p = g.player;
    g.spawnEnemy(p.pos.x + 6, p.pos.z + 2, 2, 'trex', { lone: true });
    for (let i = 0; i < 5; i++) G.sim(1 / 30);
    const near = G.music.wanted;
    for (const e of g.enemies) e.alive = false;
    p.act = null;
    for (let i = 0; i < 3; i++) G.sim(1 / 30);
    const calm = G.music.wanted;
    p.act = { type: 'hold', t: 0, dur: 2 };
    for (let i = 0; i < 3; i++) G.sim(1 / 30);
    const special = G.music.wanted;
    p.act = null;
    return { near, calm, special };
  });
  expect(battle.near).toBe('battle');
  expect(battle.calm).toBe('roam');
  expect(battle.special).toBe('battle');

  const vol = await page.evaluate(() => {
    const input = document.getElementById('p-music-vol');
    input.value = '40';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { value: G.music.volume, saved: G.save.musicVol, label: !!document.getElementById('p-vol') };
  });
  expect(vol.label).toBe(true);
  expect(vol.value).toBeCloseTo(0.4, 2);
  expect(vol.saved).toBeCloseTo(0.4, 2);

  if (info.project.name !== 'iphone-landscape') return;
  fs.mkdirSync(OUT, { recursive: true });
  for (const name of ['roam', 'battle', 'hatch']) {
    const seconds = name === 'hatch' ? 2 : 6;
    const pcm = await page.evaluate(async (arg) => {
      const buf = await G.music.render(arg.name, arg.seconds);
      if (!buf) return null;
      const ch = buf.getChannelData(0);
      const out = new Float32Array(ch.length);
      for (let i = 0; i < ch.length; i++) out[i] = ch[i];
      return { rate: buf.sampleRate, samples: Array.from(out) };
    }, { name, seconds });
    expect(pcm && pcm.samples.length).toBeGreaterThan(1000);
    const peak = pcm.samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak).toBeGreaterThan(0.02);
    const wav = wavBytes(pcm.samples, pcm.rate);
    const wavPath = '/tmp/eggs-music-' + name + '.wav';
    fs.writeFileSync(wavPath, wav);
    const mp3 = OUT + '/eggs-music-' + name + '.mp3';
    try {
      execFileSync('ffmpeg', ['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-q:a', '5', mp3], { stdio: 'ignore' });
    } catch (e) {
      execFileSync('ffmpeg', ['-y', '-i', wavPath, '-c:a', 'aac', '-b:a', '128k', OUT + '/eggs-music-' + name + '.m4a'], { stdio: 'ignore' });
    }
  }
});
