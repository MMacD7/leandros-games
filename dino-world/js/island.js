/* Island mode: open top-down (2.5D) island to roam as a dinosaur */
'use strict';
(function (G) {
  const W = 3200, CX = 1600, CY = 1600, R = 1250, CELL = 16, GN = W / CELL;
  const DEEP = 0, SHALLOW = 1, SAND = 2, GRASS = 3, FOREST = 4, LAKE_S = 5, LAKE_D = 6, ROCK = 7, LAVA = 8;
  const LAKE = { x: CX + 430, y: CY + 170, r: 220 }, VOLC = { x: CX - 180, y: CY - 620, r: 270 };
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

  function hash(i, j) { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 5, y * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 9, y * 4.3 + 1) * 0.15;

  function sample(x, y) {
    const nz = fbm(x / 380, y / 380);
    const dx = x - CX, dy = y - CY, d = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    const shape = 1 + 0.12 * Math.sin(3 * th + 1) + 0.07 * Math.sin(5 * th + 2) + 0.05 * Math.sin(7 * th + 0.5);
    const h = 1 - d / (R * shape) + (nz - 0.5) * 0.22;
    let t;
    if (h < -0.04) t = DEEP; else if (h < 0.035) t = SHALLOW; else if (h < 0.085) t = SAND;
    else {
      const vd = (Math.hypot(x - VOLC.x, y - VOLC.y) / VOLC.r) * (1 + (nz - 0.5) * 0.3);
      if (vd < 0.28) t = LAVA; else if (vd < 1) t = ROCK;
      else {
        const la = Math.atan2(y - LAKE.y, x - LAKE.x);
        const ld = Math.hypot(x - LAKE.x, y - LAKE.y) / (LAKE.r * (1 + 0.18 * Math.sin(4 * la) + (nz - 0.5) * 0.4));
        if (ld < 0.6) t = LAKE_D; else if (ld < 1) t = LAKE_S; else if (ld < 1.15) t = SAND;
        else t = vnoise(x / 520 + 20, y / 520 + 7) > 0.62 ? FOREST : GRASS;
      }
    }
    return { t, h, nz };
  }

  // ---------- world generation (once) ----------
  let grid = null, terrain = null, mini = null, nest = null;
  function buildWorld() {
    grid = new Uint8Array(GN * GN);
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) grid[j * GN + i] = sample(i * CELL + CELL / 2, j * CELL + CELL / 2).t;
    // low-res colour pass
    const LR = 800, sc = W / LR;
    const low = document.createElement('canvas'); low.width = low.height = LR;
    const lc = low.getContext('2d'), img = lc.createImageData(LR, LR), px = img.data;
    for (let j = 0; j < LR; j++) for (let i = 0; i < LR; i++) {
      const x = i * sc, y = j * sc, s = sample(x, y), v = (fbm(x / 90, y / 90) - 0.5) * 30;
      let r, g, b;
      switch (s.t) {
        case DEEP: { const k = Math.max(0, Math.min(1, -s.h * 4)); r = 40 - k * 20; g = 150 - k * 50; b = 215 - k * 30; break; }
        case SHALLOW: r = 70; g = 205; b = 230; break;
        case SAND: r = 246 + v * 0.3; g = 224 + v * 0.3; b = 160 + v * 0.3; break;
        case GRASS: r = 118 + v; g = 200 + v; b = 80 + v * 0.5; break;
        case FOREST: r = 70 + v; g = 160 + v; b = 62 + v * 0.5; break;
        case LAKE_S: r = 80; g = 200; b = 235; break;
        case LAKE_D: r = 45; g = 155; b = 215; break;
        case ROCK: { const dx = (x - VOLC.x) / VOLC.r, dy = (y - VOLC.y) / VOLC.r, l = (-dx - dy) * 25; r = 150 + l + v; g = 125 + l + v; b = 105 + l + v; break; }
        case LAVA: { const dd = Math.hypot(x - VOLC.x, y - VOLC.y) / VOLC.r; r = 255; g = 120 + (0.28 - dd) * 400; b = 40; break; }
      }
      const o = (j * LR + i) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
    lc.putImageData(img, 0, 0);
    const TS = 0.5; // terrain canvas: half world resolution
    terrain = document.createElement('canvas'); terrain.width = terrain.height = W * TS;
    const tc = terrain.getContext('2d'); tc.imageSmoothingEnabled = true; tc.drawImage(low, 0, 0, W * TS, W * TS);
    // decorations
    tc.save(); tc.scale(TS, TS);
    for (let k = 0; k < 9000; k++) {
      const x = rnd(200, W - 200), y = rnd(200, W - 200), t = tAt(x, y);
      if (t === GRASS || t === FOREST) {
        if (Math.random() < 0.12) { // flower
          tc.fillStyle = ['#ffffff', '#ffe066', '#ff8fab', '#c77dff'][k % 4];
          for (let p = 0; p < 5; p++) { tc.beginPath(); tc.arc(x + Math.cos(p * 1.26) * 3, y + Math.sin(p * 1.26) * 3, 2.4, 0, TAU); tc.fill(); }
          tc.fillStyle = '#ffb703'; tc.beginPath(); tc.arc(x, y, 1.8, 0, TAU); tc.fill();
        } else { // grass tuft
          tc.strokeStyle = t === FOREST ? 'rgba(30,90,30,0.55)' : 'rgba(60,140,40,0.55)'; tc.lineWidth = 2.2;
          tc.beginPath(); tc.moveTo(x - 4, y); tc.lineTo(x - 6, y - 7); tc.moveTo(x, y); tc.lineTo(x, y - 9); tc.moveTo(x + 4, y); tc.lineTo(x + 6, y - 7); tc.stroke();
        }
      } else if (t === SAND && Math.random() < 0.5) {
        tc.fillStyle = Math.random() < 0.5 ? 'rgba(200,170,110,0.6)' : 'rgba(255,255,255,0.5)'; tc.beginPath(); tc.arc(x, y, rnd(1.5, 3), 0, TAU); tc.fill();
        if (Math.random() < 0.04) { tc.fillStyle = '#ff9f80'; tc.beginPath(); for (let p = 0; p < 10; p++) { const rr = p % 2 ? 3 : 7; tc.lineTo(x + Math.cos(p * 0.628) * rr, y + Math.sin(p * 0.628) * rr); } tc.fill(); }
      } else if (t === ROCK && Math.random() < 0.3) {
        tc.fillStyle = 'rgba(90,70,60,0.45)'; tc.beginPath(); tc.ellipse(x, y, rnd(4, 10), rnd(3, 6), 0, 0, TAU); tc.fill();
      }
    }
    // crater rim + glow
    const g = tc.createRadialGradient(VOLC.x, VOLC.y, 10, VOLC.x, VOLC.y, VOLC.r * 0.4);
    g.addColorStop(0, 'rgba(255,240,120,0.9)'); g.addColorStop(0.6, 'rgba(255,120,40,0.5)'); g.addColorStop(1, 'rgba(255,80,20,0)');
    tc.fillStyle = g; tc.beginPath(); tc.arc(VOLC.x, VOLC.y, VOLC.r * 0.4, 0, TAU); tc.fill();
    tc.restore();
    // minimap
    mini = document.createElement('canvas'); mini.width = mini.height = 140;
    const mc = mini.getContext('2d'); mc.drawImage(low, 0, 0, 140, 140);
    // nest: walk from the south shore toward centre until grass
    nest = { x: CX + 60, y: CY + R };
    while (tAt(nest.x, nest.y) !== GRASS && nest.y > CY) nest.y -= 10;
    nest.y -= 60;
  }
  function tAt(x, y) {
    const i = (x / CELL) | 0, j = (y / CELL) | 0;
    if (i < 0 || j < 0 || i >= GN || j >= GN) return DEEP;
    return grid[j * GN + i];
  }
  const isWater = t => t === DEEP || t === SHALLOW || t === LAKE_S || t === LAKE_D;
  const isLand = t => t === SAND || t === GRASS || t === FOREST || t === ROCK;
  function randomSpot(types, minDist) {
    for (let k = 0; k < 400; k++) {
      const x = rnd(150, W - 150), y = rnd(150, W - 150);
      if (types.indexOf(tAt(x, y)) >= 0 && (!minDist || Math.hypot(x - nest.x, y - nest.y) > minDist)) return { x, y };
    }
    return { x: nest.x, y: nest.y };
  }

  // ---------- state ----------
  const I = (G.island = {});
  let P = null, ents = null, cam = { x: 0, y: 0 }, zoom = 1, time = 0, dayT = 0.08, saveT = 0, foodHint = null, hintT = 0;
  let particles = [];
  let shadeCv = null;

  function canWalk(t, sp) {
    if (t === LAVA) return false;
    if (sp.flies) return true;
    if (t === DEEP || t === LAKE_D) return !!sp.swims;
    return true;
  }
  function stageScale() { return G.STAGES[P.stage].scale; }
  function pScale() { return 0.66 * P.sp.size * stageScale(); }

  I.start = function () {
    if (!grid) buildWorld();
    const sp = G.DINO[G.save.selected];
    const xp = G.save.xp[sp.id] || 0;
    P = { sp, id: sp.id, x: nest.x + 40, y: nest.y + 30, face: 1, dir: { x: 1, y: 0 }, hp: 100, hunger: 85, stamina: 100,
      xp, stage: G.stageOf(xp), bite: 0, roar: 0, biteCD: 0, roarCD: 0, t: 0, m: 0, dead: 0, hurt: 0, water: false };
    time = 0; particles = [];
    ents = { plants: [], trees: [], fish: [], meats: [], critters: [], npcs: [], eggs: [], fossils: [] };
    for (let k = 0; k < 170; k++) { const p = randomSpot([GRASS, FOREST, SAND]); const t = tAt(p.x, p.y); ents.trees.push({ x: p.x, y: p.y, palm: t === SAND || Math.random() < 0.15, munched: 0, r: 16 }); }
    for (let k = 0; k < 110; k++) { const p = randomSpot([GRASS, FOREST]); ents.plants.push({ x: p.x, y: p.y, kind: Math.random() < 0.6 ? 'fern' : 'bush', eaten: 0 }); }
    for (let k = 0; k < 30; k++) { const p = randomSpot([GRASS, FOREST, SAND]); ents.meats.push({ x: p.x, y: p.y, eaten: 0 }); }
    for (let k = 0; k < 45; k++) {
      const p = k < 18 ? randomSpot([LAKE_S, LAKE_D]) : randomSpot([SHALLOW]);
      ents.fish.push({ x: p.x, y: p.y, a: rnd(0, TAU), face: 1, eaten: 0, jump: 0, col: ['#ffbf69', '#9bf6ff', '#ffadad', '#caffbf'][k % 4] });
    }
    for (let k = 0; k < 34; k++) { const p = randomSpot([GRASS, FOREST, SAND], 200); ents.critters.push({ x: p.x, y: p.y, vx: 0, vy: 0, kind: k % 2, face: 1, flee: 0, gone: 0, wt: 0 }); }
    const herb = ['trike', 'steg', 'anky', 'brachio', 'trike', 'steg', 'brachio', 'anky', 'trike', 'ptera', 'spino', 'raptor'];
    herb.forEach((id, k) => { const p = randomSpot([GRASS, FOREST], 350); ents.npcs.push(mkNpc(id, p, false)); });
    for (let k = 0; k < 4; k++) { const p = randomSpot([FOREST], 500); ents.npcs.push(mkNpc('raptor', p, true)); }
    placeCollectibles();
    cam.x = P.x; cam.y = P.y;
    I.resize();
  };
  function mkNpc(id, p, grumpy) {
    const sp = G.DINO[id];
    return { id, sp, x: p.x, y: p.y, tx: p.x, ty: p.y, face: 1, mode: 'wander', timer: rnd(1, 4), grumpy, hitCD: 0, t: rnd(0, 9), m: 0,
      s: 0.5 * sp.size * (grumpy ? 0.8 : rnd(0.8, 1.05)),
      pal: grumpy ? { col: '#8e7cc3', belly: '#e0d8ff', dark: '#5e4b9a', accent: '#ff4d6d' } : null };
  }
  function placeCollectibles() {
    ents.eggs = []; ents.fossils = [];
    for (let k = 0; k < 10; k++) { const p = randomSpot([GRASS, FOREST, SAND], 250); ents.eggs.push({ x: p.x, y: p.y, taken: false }); }
    for (let k = 0; k < 6; k++) { const p = randomSpot([SAND, ROCK], 250); ents.fossils.push({ x: p.x, y: p.y, taken: false }); }
  }
  I.resize = function () {
    const w = G.vw, h = G.vh;
    // more world on bigger screens (iPad), clamped so sprites stay readable
    zoom = Math.max(0.85, Math.min(1.45, Math.sqrt(w * h) / 560));
    if (!shadeCv) shadeCv = document.createElement('canvas');
    shadeCv.width = Math.ceil(w / 4); shadeCv.height = Math.ceil(h / 4);
  };
  I.stop = function () { if (P) { G.save.xp[P.id] = P.xp; G.persist(); } };

  // ---------- helpers ----------
  function pop(x, y, type, extra) { particles.push(Object.assign({ x, y, vx: rnd(-30, 30), vy: rnd(-90, -50), life: 1, type }, extra || {})); }
  function burst(x, y, n, col) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(60, 160); particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.5, 0.9), type: 'dot', col }); } }
  function eats(kind) { return P.sp.diet.indexOf(kind) >= 0; }
  function gainFood(fill, xp, x, y) {
    P.hunger = Math.min(100, P.hunger + fill);
    P.hp = Math.min(100, P.hp + 6);
    P.xp += xp; G.save.xp[P.id] = P.xp;
    G.addBones(1);
    pop(x, y - 20, 'bone'); burst(x, y - 10, 8, '#fff3b0');
    G.audio.chomp();
    const st = G.stageOf(P.xp);
    if (st > P.stage) {
      P.stage = st; G.audio.grow(); G.addBones(st === 1 ? 5 : 15);
      for (let i = 0; i < 30; i++) burst(P.x, P.y - 30, 1, ['#ffd166', '#06d6a0', '#ef476f', '#118ab2'][i % 4]);
      G.ui.banner(st);
    }
    G.persist();
  }

  function bite() {
    if (P.biteCD > 0 || P.dead) return;
    P.biteCD = 0.32; P.bite = 0.3;
    const s = pScale(), reach = 45 + 60 * s;
    const bx = P.x + P.face * reach * 0.55, by = P.y + P.dir.y * reach * 0.3 - 6;
    const near = (e, r) => (e.x - bx) * (e.x - bx) + (e.y - by) * (e.y - by) < r * r;
    const R2 = reach;
    // plants
    if (eats('plant')) {
      for (const p of ents.plants) if (!p.eaten && near(p, R2)) { p.eaten = rnd(20, 35); gainFood(p.kind === 'bush' ? 22 : 18, 7, p.x, p.y); return; }
      if (P.id === 'brachio') for (const t of ents.trees) if (!t.munched && near(t, R2 + 10)) { t.munched = rnd(25, 40); gainFood(26, 9, t.x, t.y - 60); return; }
    }
    if (eats('meat')) {
      for (const m of ents.meats) if (!m.eaten && near(m, R2)) { m.eaten = rnd(25, 40); gainFood(25, 8, m.x, m.y); return; }
      for (const c of ents.critters) if (!c.gone && near(c, R2 + 6)) { c.gone = rnd(15, 25); burst(c.x, c.y - 10, 12, '#ffffff'); gainFood(20, 9, c.x, c.y); return; }
    }
    if (eats('fish')) {
      for (const f of ents.fish) if (!f.eaten && near(f, R2 + 14)) { f.eaten = rnd(14, 24); G.audio.splash(); gainFood(22, 8, f.x, f.y); return; }
    }
    // not food: nip dinos / critters -> they run away
    for (const n of ents.npcs) if (near(n, R2 + 20 * n.s)) { flee(n, 4); G.audio.chomp(); burst(n.x, n.y - 30, 6, '#ffffff'); return; }
    for (const c of ents.critters) if (!c.gone && near(c, R2)) { c.flee = 3; G.audio.miss(); return; }
    G.audio.miss();
  }
  function roar() {
    if (P.roarCD > 0 || P.dead) return;
    P.roarCD = 2.2; P.roar = 0.9;
    const big = P.id === 'rex' || P.id === 'spino' || P.id === 'brachio';
    G.audio.roar(big);
    const r = (220 + P.stage * 60) * (P.id === 'rex' ? 1.6 : 1);
    particles.push({ x: P.x, y: P.y - 30 * pScale() * 2, life: 1, type: 'ring', r: 10, max: r });
    for (const n of ents.npcs) if (Math.hypot(n.x - P.x, n.y - P.y) < r) flee(n, 5);
    for (const c of ents.critters) if (Math.hypot(c.x - P.x, c.y - P.y) < r) c.flee = 4;
  }
  function flee(n, t) { n.mode = 'flee'; n.timer = t; }

  function moveEnt(e, dx, dy, sp) {
    const nx = e.x + dx, ny = e.y + dy;
    if (canWalk(tAt(nx, ny), sp)) { e.x = nx; e.y = ny; return true; }
    if (canWalk(tAt(nx, e.y), sp)) { e.x = nx; return true; }
    if (canWalk(tAt(e.x, ny), sp)) { e.y = ny; return true; }
    return false;
  }
  const landOnly = { flies: false, swims: false };

  // ---------- update ----------
  I.update = function (dt) {
    time += dt; dayT = (dayT + dt / 210) % 1;
    const inp = G.input;
    P.t += dt;
    if (P.biteCD > 0) P.biteCD -= dt; if (P.roarCD > 0) P.roarCD -= dt;
    if (P.bite > 0) P.bite -= dt; if (P.roar > 0) P.roar -= dt; if (P.hurt > 0) P.hurt -= dt;
    if (P.dead > 0) {
      P.dead -= dt;
      if (P.dead <= 0) { P.x = nest.x + 40; P.y = nest.y + 30; P.hp = 75; P.hunger = Math.max(P.hunger, 70); P.hurt = 2; cam.x = P.x; cam.y = P.y; }
    } else {
      if (inp.bite) bite(); if (inp.roar) roar();
      let jx = inp.jx, jy = inp.jy; const mag = Math.min(1, Math.hypot(jx, jy));
      const t = tAt(P.x, P.y), sp = P.sp;
      P.water = isWater(t) && !sp.flies;
      let spd = 150 * sp.speed * (0.85 + 0.12 * P.stage);
      const sprinting = inp.sprint && P.stamina > 1 && mag > 0.1;
      if (sprinting) { spd *= 1.75; P.stamina -= dt * (P.id === 'raptor' ? 14 : 24); } else P.stamina = Math.min(100, P.stamina + dt * 16);
      if (P.water) spd *= sp.swims ? 1.2 : 0.65;
      if (mag > 0.08) {
        moveEnt(P, (jx / Math.max(mag, 1e-3)) * mag * spd * dt, (jy / Math.max(mag, 1e-3)) * mag * spd * dt, sp);
        if (Math.abs(jx) > 0.12) P.face = jx > 0 ? 1 : -1;
        P.dir.x = jx / mag; P.dir.y = jy / mag;
        if (P.water && Math.random() < dt * 8) particles.push({ x: P.x + rnd(-10, 10), y: P.y, life: 0.8, type: 'ripple', r: 4 });
      }
      P.m = mag * (sprinting ? 1 : 0.75);
      // tree collisions
      if (!sp.flies) for (const tr of ents.trees) { const dx = P.x - tr.x, dy = P.y - tr.y, d = Math.hypot(dx, dy), rr = tr.r + 8; if (d < rr && d > 0.01) { P.x = tr.x + (dx / d) * rr; P.y = tr.y + (dy / d) * rr; } }
      P.x = Math.max(120, Math.min(W - 120, P.x)); P.y = Math.max(120, Math.min(W - 120, P.y));
      // hunger / health
      P.hunger = Math.max(0, P.hunger - dt * 0.55);
      const atNest = Math.hypot(P.x - nest.x, P.y - nest.y) < 130;
      if (P.hunger <= 0) P.hp -= dt * 2.5; else if (P.hunger > 35) P.hp = Math.min(100, P.hp + dt * (atNest ? 12 : 2.5));
      if (P.hp <= 0) { P.hp = 0; P.dead = 2.6; G.audio.hit(); }
      // collectibles
      const pr = 34 + 20 * pScale();
      for (const e of ents.eggs) if (!e.taken && Math.hypot(e.x - P.x, e.y - P.y) < pr) { e.taken = true; G.save.eggs++; G.addBones(3); G.audio.collect(); burst(e.x, e.y - 15, 16, '#ffd166'); pop(e.x, e.y - 30, 'bone', { n: 3 }); }
      for (const f of ents.fossils) if (!f.taken && Math.hypot(f.x - P.x, f.y - P.y) < pr) { f.taken = true; G.save.fossils++; G.addBones(6); G.audio.collect(); burst(f.x, f.y - 15, 16, '#e9d8a6'); pop(f.x, f.y - 30, 'bone', { n: 6 }); }
      if (ents.eggs.every(e => e.taken) && ents.fossils.every(e => e.taken)) placeCollectibles();
    }
    // camera
    cam.x += (P.x - cam.x) * Math.min(1, dt * 6); cam.y += (P.y - cam.y) * Math.min(1, dt * 6);

    // regrowth
    for (const p of ents.plants) if (p.eaten > 0) p.eaten = Math.max(0, p.eaten - dt);
    for (const t of ents.trees) if (t.munched > 0) t.munched = Math.max(0, t.munched - dt);
    for (const m of ents.meats) if (m.eaten > 0) { m.eaten -= dt; if (m.eaten <= 0) { m.eaten = 0; const p = randomSpot([GRASS, FOREST, SAND]); m.x = p.x; m.y = p.y; } }
    // fish
    for (const f of ents.fish) {
      if (f.eaten > 0) { f.eaten = Math.max(0, f.eaten - dt); continue; }
      f.a += rnd(-1, 1) * dt * 2;
      const nx = f.x + Math.cos(f.a) * 30 * dt, ny = f.y + Math.sin(f.a) * 30 * dt;
      if (isWater(tAt(nx, ny)) && tAt(nx, ny) !== DEEP) { f.x = nx; f.y = ny; } else f.a += Math.PI * 0.7;
      f.face = Math.cos(f.a) >= 0 ? 1 : -1;
      if (f.jump > 0) f.jump -= dt; else if (Math.random() < dt * 0.05) f.jump = 0.8;
    }
    // critters
    const night = darkness() > 0.3;
    for (const c of ents.critters) {
      if (c.gone > 0) { c.gone -= dt; if (c.gone <= 0) { const p = randomSpot([GRASS, FOREST, SAND], 300); c.x = p.x; c.y = p.y; c.gone = 0; } continue; }
      const dx = c.x - P.x, dy = c.y - P.y, d = Math.hypot(dx, dy);
      if (!P.dead && d < 150) c.flee = Math.max(c.flee, 1);
      let sp = 28;
      if (c.flee > 0) { c.flee -= dt; sp = 135; const k = 1 / Math.max(d, 1); c.vx = dx * k; c.vy = dy * k; }
      else { c.wt -= dt; if (c.wt <= 0) { c.wt = rnd(1, 3); const a = rnd(0, TAU); const go = Math.random() < 0.6; c.vx = go ? Math.cos(a) : 0; c.vy = go ? Math.sin(a) : 0; } }
      if (!moveEnt(c, c.vx * sp * dt, c.vy * sp * dt, landOnly) || !isLand(tAt(c.x, c.y))) { c.vx = -c.vx; c.vy = -c.vy; c.wt = 0.5; }
      if (Math.abs(c.vx) > 0.1) c.face = c.vx > 0 ? 1 : -1;
      c.moving = (c.vx || c.vy) ? 1 : 0;
    }
    // npc dinos
    for (const n of ents.npcs) {
      n.t += dt; if (n.hitCD > 0) n.hitCD -= dt;
      const dx = P.x - n.x, dy = P.y - n.y, d = Math.hypot(dx, dy);
      if (n.grumpy && n.mode !== 'flee' && !P.dead) {
        const brave = P.id !== 'rex' && (P.stage < 2 || night);
        if (brave && d < 300 && P.hurt <= 0) n.mode = 'chase'; else if (n.mode === 'chase' && (d > 420 || !brave)) { n.mode = 'wander'; n.timer = 1; }
      }
      let vx = 0, vy = 0, spd = 0;
      if (n.mode === 'flee') {
        n.timer -= dt; if (n.timer <= 0) { n.mode = 'wander'; n.timer = 1; }
        spd = 150; vx = -dx / Math.max(d, 1); vy = -dy / Math.max(d, 1);
      } else if (n.mode === 'chase') {
        spd = 128; vx = dx / Math.max(d, 1); vy = dy / Math.max(d, 1);
        if (d < 30 + 40 * pScale() && n.hitCD <= 0) {
          n.hitCD = 1.2;
          let dmg = 9; if (P.id === 'trike') dmg = 4; if (P.id === 'anky') dmg = 0;
          if (P.id === 'steg' || (P.id === 'trike' && G.input.sprint)) { burst(n.x, n.y - 20, 10, '#fff'); dmg = 0; }
          if (dmg) { P.hp -= dmg; P.hurt = 0.6; G.audio.hit(); }
          flee(n, 2.5);
        }
      } else {
        n.timer -= dt;
        if (n.timer <= 0) { n.timer = rnd(2, 6); const a = rnd(0, TAU), r = rnd(60, 260); n.tx = n.x + Math.cos(a) * r; n.ty = n.y + Math.sin(a) * r; if (Math.random() < 0.35) { n.tx = n.x; n.ty = n.y; } }
        const tx = n.tx - n.x, ty = n.ty - n.y, td = Math.hypot(tx, ty);
        if (td > 6) { spd = n.grumpy ? 60 : 38; vx = tx / td; vy = ty / td; }
      }
      if (spd) {
        if (!moveEnt(n, vx * spd * dt, vy * spd * dt, n.sp.flies ? n.sp : landOnly) || !(n.sp.flies || isLand(tAt(n.x, n.y)))) { n.tx = n.x - vx * 100; n.ty = n.y - vy * 100; n.timer = 2; }
        if (Math.abs(vx) > 0.15) n.face = vx > 0 ? 1 : -1;
      }
      n.m = spd ? Math.min(1, spd / 120) : 0;
    }
    // particles
    for (const p of particles) { p.life -= dt * (p.type === 'ring' ? 1.4 : 1); p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; if (p.type === 'dot') p.vy += 200 * dt; if (p.type === 'ring') p.r += (p.max - p.r) * dt * 5; }
    particles = particles.filter(p => p.life > 0);
    if (night && Math.random() < dt * 4) particles.push({ x: P.x + rnd(-400, 400), y: P.y + rnd(-300, 300), vx: rnd(-10, 10), vy: rnd(-10, 10), life: 3, type: 'fly' });
    // food hint
    hintT -= dt;
    if (hintT <= 0) { hintT = 0.5; foodHint = P.hunger < 60 ? nearestFood() : null; }
    saveT += dt; if (saveT > 5) { saveT = 0; G.persist(); }
  };
  function nearestFood() {
    let best = null, bd = 1e12;
    const chk = (e) => { const d = dist2(e, P); if (d < bd) { bd = d; best = e; } };
    if (eats('plant')) ents.plants.forEach(p => !p.eaten && chk(p));
    if (eats('meat')) { ents.meats.forEach(m => !m.eaten && chk(m)); ents.critters.forEach(c => !c.gone && chk(c)); }
    if (eats('fish')) ents.fish.forEach(f => !f.eaten && chk(f));
    return bd > 160 * 160 ? best : null;
  }
  function darkness() {
    const p = dayT;
    if (p < 0.55) return 0; if (p < 0.65) return ((p - 0.55) / 0.1) * 0.62; if (p < 0.9) return 0.62; return (1 - (p - 0.9) / 0.1) * 0.62;
  }

  // ---------- draw ----------
  I.draw = function (c) {
    const w = G.vw, h = G.vh;
    c.fillStyle = '#1f7fc4'; c.fillRect(0, 0, w, h);
    const vw = w / zoom, vh = h / zoom, x0 = cam.x - vw / 2, y0 = cam.y - vh / 2;
    c.drawImage(terrain, x0 * 0.5, y0 * 0.5, vw * 0.5, vh * 0.5, 0, 0, w, h);
    c.save(); c.scale(zoom, zoom); c.translate(-x0, -y0);
    const inView = (e, m) => e.x > x0 - m && e.x < x0 + vw + m && e.y > y0 - m && e.y < y0 + vh + m * 1.5;
    // water sparkle
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2;
    const gs = 70;
    for (let gx = Math.floor(x0 / gs) * gs; gx < x0 + vw; gx += gs) for (let gy = Math.floor(y0 / gs) * gs; gy < y0 + vh; gy += gs) {
      const hsh = hash(gx / gs | 0, gy / gs | 0), px = gx + hsh * gs, py = gy + ((hsh * 7) % 1) * gs;
      if (!isWater(tAt(px, py))) continue;
      const a = Math.sin(time * 1.5 + hsh * 20); if (a < 0.2) continue;
      c.globalAlpha = a * 0.7; c.beginPath(); c.arc(px, py, 7, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    }
    c.globalAlpha = 1;
    G.drawNest(c, nest.x, nest.y, 1.2);
    // flat items
    for (const f of ents.fish) if (!f.eaten && inView(f, 40)) {
      if (f.jump > 0) { const k = Math.sin((f.jump / 0.8) * Math.PI); G.drawFish(c, f.x, f.y - k * 30, 0.9, f.face, time, f.col); }
      else { c.globalAlpha = 0.6; G.drawFish(c, f.x, f.y, 0.8, f.face, time, f.col); c.globalAlpha = 1; }
    }
    for (const e of ents.fossils) if (!e.taken && inView(e, 40)) { G.drawFossil(c, e.x, e.y, 1, time); G.drawSparkle(c, e.x + 12, e.y - 28, 9, time + e.x); }
    // y-sorted sprites
    const list = [];
    for (const t of ents.trees) if (inView(t, 120)) list.push({ y: t.y, f: () => {
      // fade trees that stand in front of the player so he never loses his dino
      const cover = t.y > P.y && t.y - P.y < 120 && Math.abs(t.x - P.x) < 70;
      G.drawShadow(c, t.x, t.y, 26); if (cover) c.globalAlpha = 0.4; G.drawTree(c, t.x, t.y, 0.95, t.palm, time, t.munched > 0); c.globalAlpha = 1; } });
    for (const p of ents.plants) if (inView(p, 40)) list.push({ y: p.y, f: () => p.kind === 'fern' ? G.drawFern(c, p.x, p.y, 0.9, p.eaten > 0, time) : G.drawBush(c, p.x, p.y, 0.9, p.eaten > 0) });
    for (const m of ents.meats) if (!m.eaten && inView(m, 40)) list.push({ y: m.y, f: () => { G.drawShadow(c, m.x, m.y, 14); G.drawMeat(c, m.x, m.y - 10 - Math.abs(Math.sin(time * 3 + m.x)) * 4, 0.9); } });
    for (const e of ents.eggs) if (!e.taken && inView(e, 40)) list.push({ y: e.y, f: () => { G.drawShadow(c, e.x, e.y, 12); G.drawEgg(c, e.x, e.y, 1, time + e.x); G.drawSparkle(c, e.x + 12, e.y - 30, 8, time + e.y); } });
    for (const cr of ents.critters) if (!cr.gone && inView(cr, 40)) list.push({ y: cr.y, f: () => { G.drawShadow(c, cr.x, cr.y, 10); G.drawCritter(c, cr.x, cr.y, 0.9, cr.face, time, cr.kind, cr.moving); } });
    for (const n of ents.npcs) if (inView(n, 150)) list.push({ y: n.y, f: () => drawDinoAt(c, n.id, n.x, n.y, n.s, n.face, { t: n.t, m: n.m, pal: n.pal, jaw: n.mode === 'chase' ? 0.25 + Math.sin(n.t * 10) * 0.1 : 0 }, n.sp) });
    list.push({ y: P.y, f: drawPlayer });
    list.sort((a, b) => a.y - b.y);
    for (const e of list) e.f();
    // particles
    for (const p of particles) {
      const a = Math.max(0, Math.min(1, p.life));
      if (p.type === 'dot') { c.fillStyle = p.col; c.globalAlpha = a; c.beginPath(); c.arc(p.x, p.y, 4, 0, TAU); c.fill(); }
      else if (p.type === 'bone') { c.globalAlpha = a; G.drawBone(c, p.x, p.y, 0.9, 0.3); if (p.n) { c.font = 'bold 20px ui-rounded, system-ui, sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = '#432'; c.lineWidth = 4; c.strokeText('+' + p.n, p.x + 16, p.y + 7); c.fillText('+' + p.n, p.x + 16, p.y + 7); } }
      else if (p.type === 'ring') { c.globalAlpha = a * 0.8; c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.ellipse(p.x, p.y + 30, p.r, p.r * 0.55, 0, 0, TAU); c.stroke(); c.lineWidth = 3; c.beginPath(); c.ellipse(p.x, p.y + 30, p.r * 0.7, p.r * 0.38, 0, 0, TAU); c.stroke(); }
      else if (p.type === 'ripple') { c.globalAlpha = a * 0.7; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.ellipse(p.x, p.y, 4 + (1 - a) * 22, (4 + (1 - a) * 22) * 0.4, 0, 0, TAU); c.stroke(); }
      else if (p.type === 'fly') { c.globalAlpha = Math.min(a, 1) * (0.5 + 0.5 * Math.sin(time * 6 + p.x)); c.fillStyle = '#fff59d'; c.beginPath(); c.arc(p.x, p.y, 3, 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
    // food hint arrow
    if (foodHint && !P.dead) {
      const a = Math.atan2(foodHint.y - P.y, foodHint.x - P.x), rr = 70 + 60 * pScale() + Math.sin(time * 6) * 6;
      const hx = P.x + Math.cos(a) * rr, hy = P.y - 20 + Math.sin(a) * rr * 0.75;
      c.save(); c.translate(hx, hy);
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.fill();
      if (eats('meat')) G.drawMeat(c, 2, 0, 0.6); else if (eats('fish')) G.drawFish(c, 0, 0, 0.7, 1, time); else G.drawLeaf(c, 0, 0, 0.75, -0.4);
      c.rotate(a); c.fillStyle = '#ff7b00'; c.beginPath(); c.moveTo(30, 0); c.lineTo(20, -9); c.lineTo(20, 9); c.closePath(); c.fill();
      c.restore();
    }
    c.restore();
    drawNight(c, w, h, x0, y0);
  };
  function drawDinoAt(c, id, x, y, s, face, S, sp) {
    const t = tAt(x, y), fly = sp.flies, wat = !fly && isWater(t);
    G.drawShadow(c, x, y, 34 * s * (G.DINO_W[id] / 170), fly ? 0.15 : 0.25);
    const yy = fly ? y - 26 - Math.sin((S.t || 0) * 3) * 5 : y;
    if (wat) {
      const deep = t === DEEP || t === LAKE_D, cut = deep ? 34 * s * (G.DINO_H[id] / 100) : 14 * s;
      c.save(); c.beginPath(); c.rect(x - 400, yy - 600, 800, 600 - cut + 4); c.clip();
      G.drawDino(c, id, x, yy + (deep ? cut * 0.3 : 0), s, face, S); c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, yy - cut + 4, 40 * s * 1.4, 10 * s * 1.4, 0, 0, TAU); c.stroke();
    } else G.drawDino(c, id, x, yy, s, face, S);
  }
  function drawPlayer() {
    const c = G.ctx, s = pScale();
    if (P.dead > 0) {
      c.save(); c.globalAlpha = Math.min(1, P.dead); G.drawDino(c, P.id, P.x, P.y, s, P.face, { t: 0, sil: false }); c.restore();
      c.font = 'bold 28px ui-rounded, system-ui, sans-serif'; c.fillStyle = '#fff'; c.fillText('z z z', P.x - 20 + Math.sin(P.t * 3) * 6, P.y - 70 * s - 20 - (2.6 - P.dead) * 20);
      return;
    }
    // highlight ring so the kid can always find himself
    c.strokeStyle = 'rgba(255,230,90,0.9)'; c.lineWidth = 4; c.beginPath(); c.ellipse(P.x, P.y + 2, 30 + 40 * s, (30 + 40 * s) * 0.33, 0, 0, TAU); c.stroke();
    const S = { t: P.t, m: P.m, jaw: P.bite > 0 ? Math.sin((P.bite / 0.3) * Math.PI) * 0.6 : P.roar > 0 ? 0.6 : 0, roar: P.roar > 0 };
    if (P.hurt > 0 && Math.floor(P.hurt * 12) % 2) S.alpha = 0.45;
    drawDinoAt(c, P.id, P.x, P.y, s, P.face, S, P.sp);
  }
  function drawNight(c, w, h, x0, y0) {
    const d = darkness();
    if (d <= 0.01) return;
    const sc = shadeCv.getContext('2d'), sw = shadeCv.width, sh = shadeCv.height;
    sc.globalCompositeOperation = 'source-over'; sc.clearRect(0, 0, sw, sh);
    sc.fillStyle = 'rgba(12,18,70,' + d + ')'; sc.fillRect(0, 0, sw, sh);
    sc.globalCompositeOperation = 'destination-out';
    const light = (wx, wy, r) => { const sx = ((wx - x0) * zoom) / 4, sy = ((wy - y0) * zoom) / 4, rr = (r * zoom) / 4; const g = sc.createRadialGradient(sx, sy, 0, sx, sy, rr); g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)'); sc.fillStyle = g; sc.fillRect(sx - rr, sy - rr, rr * 2, rr * 2); };
    light(P.x, P.y - 20, 200);
    light(nest.x, nest.y, 200);
    light(VOLC.x, VOLC.y, 260);
    c.save(); c.imageSmoothingEnabled = true; c.drawImage(shadeCv, 0, 0, w, h); c.restore();
    // dusk warm tint
    if (dayT > 0.5 && dayT < 0.7) { c.fillStyle = 'rgba(255,110,40,' + (0.12 * Math.sin(((dayT - 0.5) / 0.2) * Math.PI)) + ')'; c.fillRect(0, 0, w, h); }
  }
  I.drawMinimap = function (mc) {
    const s = mc.canvas.width;
    mc.clearRect(0, 0, s, s); mc.drawImage(mini, 0, 0, s, s);
    const k = s / W;
    mc.fillStyle = '#7a5230'; mc.beginPath(); mc.arc(nest.x * k, nest.y * k, 4.5, 0, TAU); mc.fill();
    mc.fillStyle = '#fff'; mc.strokeStyle = '#e63946'; mc.lineWidth = 2.5; mc.beginPath(); mc.arc(P.x * k, P.y * k, 5, 0, TAU); mc.fill(); mc.stroke();
  };
  I.hud = function () { return { hp: P.hp, hunger: P.hunger, xp: P.xp, stage: P.stage, stamina: P.stamina, id: P.id, night: darkness() > 0.3, roarCD: P.roarCD }; };
  // test hooks (local only, no network)
  I._debug = { get P() { return P; }, get ents() { return ents; }, tAt, nest: () => nest, setDay: v => (dayT = v) };
})(window.G);
