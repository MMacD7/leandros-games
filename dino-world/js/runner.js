/* Runner mode: side-scrolling endless runner */
'use strict';
(function (G) {
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);
  const R = (G.runner = {});
  let S = null, k = 1, VW = 600, VH = 400, GY = 320;
  const GRAV = 2300, JUMPV = 860, PX = 120, STAND_H = 82, DUCK_H = 40;

  R.resize = function () {
    k = Math.min(G.vh / 400, G.vw / 520);
    VW = G.vw / k; VH = G.vh / k; GY = VH - Math.max(78, VH * 0.17);
  };
  R.start = function () {
    R.resize();
    const sp = G.DINO[G.save.selected];
    const extra = sp.run === 'shield' ? 1 : sp.run === 'shield2' ? 2 : 0;
    S = { sp, id: sp.id, y: 0, vy: 0, ground: true, jumps: 0, duck: false, chomp: 0, hearts: 3 + extra, max: 3 + extra, inv: 0,
      speed: 300, dist: 0, pts: 0, snacks: 0, obs: [], food: [], parts: [], spawn: 1.4, foodT: 0.8, t: 0, over: 0, done: false, shake: 0, erupt: 0, clouds: [] };
    for (let i = 0; i < 6; i++) S.clouds.push({ x: rnd(0, VW), y: rnd(30, GY * 0.45), s: rnd(0.6, 1.3) });
  };
  R.jump = function () {
    if (!S || S.over) return;
    const big = S.sp.run === 'bigjump' ? 1.12 : 1;
    if (S.ground) { S.vy = JUMPV * big; S.ground = false; S.jumps = 1; S.duck = false; G.audio.jump(); dust(PX, GY, 6); }
    else if (S.sp.run === 'doublejump' && S.jumps < 2) { S.vy = JUMPV * 0.85; S.jumps = 2; G.audio.flap(); }
  };
  R.setDuck = function (on) {
    if (!S || S.over) return;
    if (on && !S.duck) { S.chomp = 0.4; G.audio.chomp(); if (!S.ground) S.vy = Math.min(S.vy, -1100); }
    S.duck = on;
  };
  function dust(x, y, n) { for (let i = 0; i < n; i++) S.parts.push({ x, y: y - 4, vx: rnd(-120, -20), vy: rnd(-80, -10), life: rnd(0.3, 0.6), col: '#d9b98a', r: rnd(3, 6) }); }
  function boom(x, y, col, n) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(80, 260); S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.4, 0.8), col, r: rnd(3, 7) }); } }

  function spawnObstacle() {
    const t = S.t, r = Math.random();
    if (t > 8 && r < 0.28) { S.obs.push({ type: 'fire', x: VW + 320, y: 72, r: 15, w: 30, h: 30, extra: 140 }); S.erupt = 1.2; G.audio.boom(); }
    else if (t > 4 && r < 0.55) S.obs.push({ type: 'log', x: VW + 60, y: 15, w: 70, h: 30, extra: 50, rot: 0 });
    else { const w = rnd(34, 50); S.obs.push({ type: 'rock', x: VW + 60, y: 0, w, h: rnd(30, 46), seed: Math.random() }); }
    if (t > 25 && Math.random() < 0.18) { const w = rnd(30, 40); S.obs.push({ type: 'rock', x: VW + 60 + rnd(260, 320), y: 0, w, h: rnd(28, 38), seed: Math.random() }); }
  }
  function spawnFood() {
    const air = Math.random() < 0.4;
    const n = Math.random() < 0.3 ? 3 : 1;
    for (let i = 0; i < n; i++) S.food.push({ x: VW + 40 + i * 48, y: air ? 125 + Math.sin(i) * 10 : 24, eaten: false, bob: rnd(0, 6) });
  }
  const hit = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  R.update = function (dt) {
    if (!S) return;
    S.t += dt;
    for (const p of S.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; }
    S.parts = S.parts.filter(p => p.life > 0);
    if (S.shake > 0) S.shake -= dt; if (S.erupt > 0) S.erupt -= dt;
    if (S.over) { S.over += dt; if (S.over > 1.0 && !S.done) finish(); return; }
    S.speed = Math.min(660, 300 + S.t * 5.5);
    const dx = S.speed * dt;
    S.dist += dx;
    for (const c of S.clouds) { c.x -= dx * 0.08 * c.s; if (c.x < -120) { c.x = VW + 100; c.y = rnd(30, GY * 0.45); } }
    // player physics
    if (!S.ground) {
      let g = GRAV; if (S.sp.run === 'doublejump' && S.vy < 0) g *= 0.5;
      S.vy -= g * dt; S.y += S.vy * dt;
      if (S.y <= 0) { S.y = 0; S.vy = 0; S.ground = true; S.jumps = 0; dust(PX, GY, 5); }
    }
    if (S.chomp > 0) S.chomp -= dt; if (S.inv > 0) S.inv -= dt;
    // spawns
    S.spawn -= dt;
    if (S.spawn <= 0) { spawnObstacle(); S.spawn = rnd(1.05, 1.9) * Math.max(0.62, 1 - S.t / 200); }
    S.foodT -= dt; if (S.foodT <= 0) { spawnFood(); S.foodT = rnd(1.2, 2.6); }
    // player box (feet at y, GY is ground line; heights are upward)
    const ph = S.duck ? DUCK_H : STAND_H, pw = S.duck ? 74 : 56;
    const pbx = PX - 26, pby = S.y;
    for (const o of S.obs) {
      o.x -= dx + (o.extra || 0) * dt;
      if (o.type === 'log') o.rot -= (dx + o.extra * dt) / 15;
      if (o.dead) continue;
      let ox, oy, ow, oh;
      if (o.type === 'fire') { ox = o.x - o.r * 0.8; oy = o.y - o.r * 0.8; ow = o.r * 1.6; oh = o.r * 1.6; }
      else { ox = o.x - o.w * 0.4; oy = 0; ow = o.w * 0.8; oh = o.h * 0.85; }
      if (hit(pbx, pby, pw, ph, ox, oy, ow, oh)) {
        if (S.sp.run === 'smash' && S.duck && o.type !== 'fire') { o.dead = true; boom(o.x, GY - o.h / 2, '#a1887f', 14); S.pts += 5; G.audio.boom(); S.shake = 0.15; continue; }
        if (S.inv > 0) continue;
        o.dead = true; S.hearts--; S.inv = 1.5; S.shake = 0.3; G.audio.hit();
        boom(o.x, GY - (o.y || o.h / 2), o.type === 'fire' ? '#ff9f1c' : '#8d6e63', 16);
        if (S.hearts <= 0) { S.over = 0.001; G.audio.roar(false); }
      }
    }
    S.obs = S.obs.filter(o => o.x > -120 && !(o.dead && o.type === 'fire'));
    for (const f of S.food) {
      f.x -= dx;
      if (f.eaten) continue;
      if (S.sp.run === 'magnet') { const ddx = PX + 10 - f.x, ddy = S.y + 40 - f.y, d = Math.hypot(ddx, ddy); if (d < 180 && f.x > PX - 20) { f.x += (ddx / d) * 420 * dt; f.y += (ddy / d) * 420 * dt; } }
      if (hit(pbx - 6, pby - 6, pw + 20, ph + 12, f.x - 14, f.y - 14, 28, 28)) {
        f.eaten = true; S.snacks++; const bonus = S.chomp > 0 ? 20 : 10; S.pts += bonus; S.chomp = Math.max(S.chomp, 0.25);
        G.audio.coin(); boom(f.x, GY - f.y, '#fff3b0', 8);
        S.parts.push({ x: f.x, y: GY - f.y - 20, vx: 0, vy: -60, life: 0.8, txt: '+' + bonus });
      }
    }
    S.food = S.food.filter(f => f.x > -60 && !f.eaten);
  };
  function meters() { return Math.floor(S.dist / 40); }
  function score() { return meters() + S.pts; }
  function finish() {
    S.done = true;
    const sc = score(), m = meters(), bones = Math.floor(m / 50) + Math.ceil(S.snacks / 2);
    const best = G.save.best; const newBest = sc > best.score;
    if (newBest) best.score = sc; if (m > best.dist) best.dist = m;
    G.persist();
    G.addBones(bones);
    G.ui.runnerOver({ score: sc, meters: m, bones, newBest });
  }
  R.hud = function () { return S ? { hearts: S.hearts, max: S.max, score: score(), meters: meters(), over: !!S.over } : null; };
  R._debug = { get S() { return S; } };

  // ---------- drawing ----------
  R.draw = function (c) {
    const w = G.vw, h = G.vh;
    c.save();
    if (S.shake > 0) c.translate(rnd(-6, 6), rnd(-6, 6));
    c.scale(k, k);
    // sky: day -> sunset loop
    const ph = (Math.sin(S.t / 25) + 1) / 2;
    const g = c.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, mix('#4cc9f0', '#7b5ea7', ph)); g.addColorStop(1, mix('#caf0f8', '#ffb38a', ph));
    c.fillStyle = g; c.fillRect(-20, -20, VW + 40, VH + 40);
    // sun
    c.fillStyle = mix('#fff3b0', '#ffd166', ph); c.beginPath(); c.arc(VW * 0.8, 70 + ph * 60, 34, 0, TAU); c.fill();
    // clouds
    c.fillStyle = 'rgba(255,255,255,0.9)';
    for (const cl of S.clouds) { c.beginPath(); c.arc(cl.x, cl.y, 18 * cl.s, 0, TAU); c.arc(cl.x + 20 * cl.s, cl.y - 8 * cl.s, 22 * cl.s, 0, TAU); c.arc(cl.x + 42 * cl.s, cl.y, 16 * cl.s, 0, TAU); c.fill(); }
    // volcano far
    const vx = VW * 0.62 - ((S.dist * 0.03) % (VW + 600)) + 300;
    drawVolcano(c, vx, GY - 40);
    // hills
    layer(c, 0.18, GY - 50, 70, '#8fd694', 260, 0);
    layer(c, 0.35, GY - 18, 50, '#5fbf68', 190, 2);
    // jungle trees
    const off = (S.dist * 0.6) % 160;
    for (let i = -1; i < VW / 160 + 2; i++) {
      const x = i * 160 - off, n = Math.floor((S.dist * 0.6) / 160) + i, hh = ((n * 9301 + 49297) % 233280) / 233280;
      if (hh < 0.5) G.drawTree(c, x, GY + 4, 0.8 + hh * 0.4, true, S.t, false); else G.drawTree(c, x, GY + 4, 0.7 + hh * 0.3, false, S.t, false);
    }
    // ground
    c.fillStyle = '#c8945c'; c.fillRect(-20, GY, VW + 40, VH - GY + 20);
    c.fillStyle = '#6cc04a'; c.fillRect(-20, GY - 2, VW + 40, 14);
    c.fillStyle = '#4fa437'; const go = S.dist % 40; for (let x = -go; x < VW + 40; x += 40) { c.beginPath(); c.moveTo(x, GY + 12); c.lineTo(x + 10, GY + 22); c.lineTo(x + 20, GY + 12); c.fill(); }
    c.fillStyle = '#a87445'; const po = S.dist % 90; for (let x = -po; x < VW + 90; x += 90) { c.beginPath(); c.ellipse(x + 30, GY + 40, 8, 4, 0, 0, TAU); c.ellipse(x + 70, GY + 62, 5, 3, 0, 0, TAU); c.fill(); }
    // food
    for (const f of S.food) {
      const fy = GY - f.y + Math.sin(S.t * 4 + f.bob) * 4;
      if (S.sp.diet[0] === 'meat') G.drawMeat(c, f.x, fy, 1);
      else if (S.sp.diet[0] === 'fish') G.drawFish(c, f.x, fy, 1.1, -1, S.t, '#ffbf69');
      else G.drawLeaf(c, f.x, fy, 1.1, Math.sin(S.t * 3 + f.bob) * 0.3);
    }
    // obstacles
    for (const o of S.obs) {
      if (o.dead) continue;
      if (o.type === 'rock') drawRock(c, o.x, GY + 4, o.w, o.h, o.seed);
      else if (o.type === 'log') drawLog(c, o.x, GY - o.h / 2 + 2, o.w, o.h, o.rot);
      else {
        if (o.x > VW - 10) { // warning
          const a = (Math.sin(S.t * 18) + 1) / 2;
          c.fillStyle = 'rgba(255,60,40,' + (0.5 + a * 0.5) + ')'; c.beginPath(); c.arc(VW - 30, GY - o.y, 22, 0, TAU); c.fill();
          c.fillStyle = '#fff'; c.font = 'bold 30px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('!', VW - 30, GY - o.y + 11); c.textAlign = 'left';
        } else drawFire(c, o.x, GY - o.y, o.r, S.t);
      }
    }
    // player
    const sc = 88 / G.DINO_H[S.id] * (S.id === 'brachio' ? 1.35 : S.id === 'anky' ? 0.95 : 1.05);
    const blink = S.inv > 0 && Math.floor(S.inv * 12) % 2;
    G.drawShadow(c, PX + 5, GY + 6, 34 * Math.max(0.4, 1 - S.y / 300), 0.25);
    G.drawDino(c, S.id, PX, GY - S.y + (S.id === 'ptera' ? 10 : 0), sc, 1, {
      t: S.over ? 0 : S.t, m: S.ground && !S.over ? 1 : 0.2, duck: S.duck, jaw: S.chomp > 0 ? Math.sin((S.chomp / 0.4) * Math.PI) * 0.7 : 0,
      alpha: blink ? 0.4 : 1 });
    // particles
    for (const p of S.parts) {
      c.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      if (p.txt) { c.font = 'bold 22px ui-rounded, system-ui, sans-serif'; c.lineWidth = 4; c.strokeStyle = '#432'; c.strokeText(p.txt, p.x, p.y); c.fillStyle = '#fff'; c.fillText(p.txt, p.x, p.y); }
      else { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
    c.restore();
  };
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = ((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t, g = ((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t, bl = (pa & 255) * (1 - t) + (pb & 255) * t;
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (bl | 0) + ')';
  }
  function layer(c, par, base, amp, col, wl, seed) {
    const off = S.dist * par;
    c.fillStyle = col; c.beginPath(); c.moveTo(-10, VH);
    for (let x = -10; x <= VW + 20; x += 20) { const u = (x + off) / wl; c.lineTo(x, base - (Math.sin(u + seed) * 0.5 + Math.sin(u * 2.3 + seed * 3) * 0.3 + 0.8) * amp); }
    c.lineTo(VW + 20, VH); c.closePath(); c.fill();
  }
  function drawVolcano(c, x, y) {
    c.fillStyle = '#7d6b91'; c.beginPath(); c.moveTo(x - 230, y + 40); c.lineTo(x - 40, y - 150); c.lineTo(x + 40, y - 150); c.lineTo(x + 230, y + 40); c.closePath(); c.fill();
    c.fillStyle = '#ff7b39'; c.beginPath(); c.moveTo(x - 40, y - 150); c.lineTo(x - 20, y - 110); c.lineTo(x - 5, y - 135); c.lineTo(x + 15, y - 100); c.lineTo(x + 40, y - 150); c.closePath(); c.fill();
    for (let i = 0; i < 4; i++) { const tt = (S.t * 0.4 + i / 4) % 1; c.fillStyle = 'rgba(120,110,130,' + (0.5 * (1 - tt)) + ')'; c.beginPath(); c.arc(x + Math.sin(tt * 5 + i) * 15, y - 160 - tt * 120, 16 + tt * 30, 0, TAU); c.fill(); }
    if (S.erupt > 0) { c.fillStyle = 'rgba(255,140,40,' + S.erupt * 0.6 + ')'; c.beginPath(); c.arc(x, y - 160, 40 + (1.2 - S.erupt) * 40, 0, TAU); c.fill(); }
  }
  function drawRock(c, x, y, w, h, seed) {
    c.save(); c.translate(x, y); c.lineWidth = 3; c.strokeStyle = '#3e2f2a';
    c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2 + 4, -h * 0.6); c.lineTo(-w * 0.15, -h); c.lineTo(w * 0.25, -h * (0.9 + seed * 0.1)); c.lineTo(w / 2, -h * 0.45); c.lineTo(w / 2 + 2, 0); c.closePath();
    c.fillStyle = '#9e8f86'; c.fill(); c.stroke();
    c.fillStyle = '#c4b7ae'; c.beginPath(); c.moveTo(-w * 0.3, -h * 0.6); c.lineTo(-w * 0.12, -h * 0.9); c.lineTo(w * 0.05, -h * 0.6); c.closePath(); c.fill();
    c.restore();
  }
  function drawLog(c, x, y, w, h, rot) {
    c.save(); c.translate(x, y); c.lineWidth = 3; c.strokeStyle = '#4a2e1a';
    c.fillStyle = '#9c6b3f'; c.beginPath(); c.roundRect ? c.roundRect(-w / 2, -h / 2, w, h, h / 2) : c.rect(-w / 2, -h / 2, w, h); c.fill(); c.stroke();
    c.strokeStyle = '#7a4f2b'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { const lx = ((i * 22 + rot * -8) % w + w) % w - w / 2; c.beginPath(); c.moveTo(lx, -h / 2 + 5); c.lineTo(lx + 8, h / 2 - 5); c.stroke(); }
    c.translate(w / 2 - 4, 0); c.rotate(rot); c.lineWidth = 3; c.strokeStyle = '#4a2e1a'; c.fillStyle = '#e1b382'; c.beginPath(); c.ellipse(0, 0, h * 0.32, h / 2, 0, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = '#b07d4f'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, h * 0.16, h * 0.25, 0, 0, TAU); c.stroke();
    c.restore();
  }
  function drawFire(c, x, y, r, t) {
    c.save(); c.translate(x, y);
    for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(255,' + (120 + i * 25) + ',40,' + (0.5 - i * 0.08) + ')'; c.beginPath(); c.arc(16 + i * 12 + Math.sin(t * 20 + i) * 3, Math.sin(t * 15 + i) * 4, r * (1 - i * 0.15), 0, TAU); c.fill(); }
    const g = c.createRadialGradient(-3, -3, 2, 0, 0, r * 1.2); g.addColorStop(0, '#fff7ae'); g.addColorStop(0.5, '#ffb703'); g.addColorStop(1, '#fb5607');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 1.15, 0, TAU); c.fill();
    c.restore();
  }
})(window.G);
