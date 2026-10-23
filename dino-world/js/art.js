/* Procedural cartoon art: dinos, critters, items. All drawn with canvas paths. */
'use strict';
(function (G) {
  const TAU = Math.PI * 2;
  const OUT = 'rgba(48,30,26,0.95)';
  const SIL = '#3a3550';
  let sil = false, LW = 3;
  const C = c => (sil ? SIL : c);

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  G.shade = shade;

  function ell(c, x, y, rx, ry, rot, fill, stroke) {
    c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU);
    c.fillStyle = C(fill); c.fill(); if (stroke !== false) c.stroke();
  }
  function cap(c, x1, y1, x2, y2, w, fill) {
    c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
    c.strokeStyle = OUT; c.lineWidth = w + LW * 2; c.stroke();
    c.strokeStyle = C(fill); c.lineWidth = w; c.stroke();
    c.strokeStyle = OUT; c.lineWidth = LW;
  }
  function poly(c, pts, fill, stroke) {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.fillStyle = C(fill); c.fill(); if (stroke !== false) c.stroke();
  }
  function eye(c, x, y, r, angry) {
    if (sil) return;
    ell(c, x, y, r, r * 1.08, 0, '#fff');
    c.beginPath(); c.arc(x + r * 0.28, y + r * 0.08, r * 0.58, 0, TAU); c.fillStyle = '#1d1430'; c.fill();
    c.beginPath(); c.arc(x + r * 0.45, y - r * 0.2, r * 0.22, 0, TAU); c.fillStyle = '#fff'; c.fill();
    if (angry) { c.beginPath(); c.moveTo(x - r * 1.1, y - r * 1.3); c.lineTo(x + r * 1.2, y - r * 0.75); c.lineWidth = LW * 1.6; c.stroke(); c.lineWidth = LW; }
  }
  function tail(c, x, y, len, th, wag, lift, fill) {
    c.beginPath();
    c.moveTo(x + th * 0.3, y - th * 0.75);
    c.quadraticCurveTo(x - len * 0.55, y - th * 0.55 + wag * 0.4, x - len, y + lift + wag);
    c.quadraticCurveTo(x - len * 0.5, y + th * 0.55 + wag * 0.4, x + th * 0.3, y + th * 0.8);
    c.closePath(); c.fillStyle = C(fill); c.fill(); c.stroke();
  }
  // biped leg: big thigh, shin, foot
  function bleg(c, hx, hy, L, w, ph, m, fill) {
    const sw = Math.sin(ph) * 0.55 * m, lift = Math.max(0, Math.cos(ph)) * L * 0.22 * m;
    const ax = hx + Math.sin(sw) * L * 0.75, ay = hy + L - lift - w * 0.25;
    const kx = (hx + ax) / 2 + L * 0.18, ky = (hy + ay) / 2;
    cap(c, kx, ky, ax, ay, w * 0.62, fill);
    ell(c, ax + w * 0.35, ay + w * 0.15, w * 0.62, w * 0.3, 0, fill);
    ell(c, hx + 2, hy - 2, w * 0.95, L * 0.42, -0.3 + sw * 0.6, fill);
  }
  // quadruped leg: stumpy column with toenails
  function qleg(c, hx, hy, L, w, ph, m, fill) {
    const sw = Math.sin(ph) * 0.4 * m, lift = Math.max(0, Math.cos(ph)) * L * 0.2 * m;
    const fx = hx + Math.sin(sw) * L, fy = hy + L - lift - w * 0.4;
    cap(c, hx, hy, fx, fy, w, fill);
    if (!sil) { c.fillStyle = '#fff8e8'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(fx + i * w * 0.28 + w * 0.15, fy + w * 0.42, w * 0.12, 0, TAU); c.fill(); } }
  }
  // generic head. Local: back of head at 0,0 snout towards +x
  function head(c, x, y, rot, P, S, o) {
    const hl = o.hl, hh = o.hh, jaw = S.jaw || 0;
    c.save(); c.translate(x, y); c.rotate(rot);
    if (o.frill) { // triceratops frill
      ell(c, -hh * 0.1, -hh * 0.35, hh * 1.05, hh * 1.15, -0.35, P.accent);
      if (!sil) { c.fillStyle = shade(P.accent, 0.45); for (let i = 0; i < 5; i++) { const a = -2.4 + i * 0.55; c.beginPath(); c.arc(-hh * 0.1 + Math.cos(a) * hh * 0.8, -hh * 0.35 + Math.sin(a) * hh * 0.85, hh * 0.12, 0, TAU); c.fill(); } }
    }
    // lower jaw
    c.save(); c.translate(hl * 0.05, hh * 0.18); c.rotate(jaw);
    if (jaw > 0.05 && !sil) { poly(c, [0, -hh * 0.05, hl * 0.9, -hh * 0.2 - jaw * hh * 0.3, hl * 0.9, hh * 0.05, 0, hh * 0.2], '#8e2433', false); }
    c.beginPath(); c.moveTo(-hh * 0.15, -hh * 0.05); c.lineTo(hl * o.jawLen, -hh * 0.02);
    c.quadraticCurveTo(hl * o.jawLen + hh * 0.1, hh * 0.18, hl * o.jawLen * 0.85, hh * 0.3);
    c.quadraticCurveTo(hl * 0.3, hh * 0.42, -hh * 0.2, hh * 0.3); c.closePath();
    c.fillStyle = C(P.belly); c.fill(); c.stroke();
    if (o.teeth && !sil) { c.fillStyle = '#fff'; for (let i = 1; i < o.teeth; i++) { const tx = (hl * o.jawLen * 0.9 * i) / o.teeth; c.beginPath(); c.moveTo(tx - 3, -hh * 0.03); c.lineTo(tx, -hh * 0.03 - hh * 0.16); c.lineTo(tx + 3, -hh * 0.03); c.fill(); } }
    c.restore();
    // upper head
    c.beginPath();
    c.moveTo(-hh * 0.35, hh * 0.25);
    c.quadraticCurveTo(-hh * 0.55, -hh * 0.75, hl * 0.3, -hh * 0.62);
    c.quadraticCurveTo(hl * 0.85, -hh * 0.5 + o.snoutUp, hl, -hh * 0.05 + (o.beak ? hh * 0.25 : 0));
    c.quadraticCurveTo(hl * 1.02, hh * 0.18, hl * 0.9, hh * 0.2);
    c.lineTo(0, hh * 0.24); c.closePath();
    c.fillStyle = C(P.col); c.fill(); c.stroke();
    if (o.teeth && !sil) { c.fillStyle = '#fff'; for (let i = 1; i < o.teeth; i++) { const tx = (hl * 0.88 * i) / o.teeth; c.beginPath(); c.moveTo(tx - 3.2, hh * 0.21); c.lineTo(tx, hh * 0.21 + hh * 0.2); c.lineTo(tx + 3.2, hh * 0.21); c.fill(); } }
    if (o.horns && !sil) {
      c.fillStyle = '#fff6df';
      poly(c, [hl * 0.15, -hh * 0.45, hl * 0.48, -hh * 0.62, hl * 1.0, -hh * 1.35], '#fff6df');
      poly(c, [hl * 0.78, -hh * 0.3, hl * 0.9, -hh * 0.25, hl * 0.95, -hh * 0.72], '#fff6df');
    }
    if (o.crest) { poly(c, [-hh * 0.1, -hh * 0.5, hl * 0.25, -hh * 0.6, -hh * 1.2, -hh * 1.3], P.accent); }
    if (o.bump) { ell(c, hl * 0.35, -hh * 0.6, hh * 0.45, hh * 0.35, 0, P.col); }
    // nostril
    if (!sil) { c.beginPath(); c.arc(hl * 0.86, -hh * 0.15 + (o.beak ? hh * 0.1 : 0), Math.max(1.2, hh * 0.06), 0, TAU); c.fillStyle = OUT; c.fill(); }
    eye(c, hl * o.eyeX, -hh * 0.22, hh * o.eyeR, o.angry);
    if (o.blush && !sil) { ell(c, hl * 0.45, hh * 0.05, hh * 0.16, hh * 0.09, 0, 'rgba(255,120,140,0.45)', false); }
    c.restore();
  }

  function stripes(c, x, y, rx, ry, n, col) {
    if (sil) return;
    c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.clip();
    c.fillStyle = col;
    for (let i = 0; i < n; i++) { const sx = x - rx * 0.6 + (i * rx * 1.3) / n; c.beginPath(); c.moveTo(sx, y - ry); c.lineTo(sx + rx * 0.14, y - ry); c.lineTo(sx + rx * 0.05, y - ry * 0.25); c.closePath(); c.fill(); }
    c.restore();
  }
  function spots(c, x, y, rx, ry, col, seed) {
    if (sil) return;
    c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.clip(); c.fillStyle = col;
    for (let i = 0; i < 9; i++) { const a = (seed + i * 2.39996), d = 0.25 + ((i * 37) % 10) / 14; c.beginPath(); c.ellipse(x + Math.cos(a) * rx * d * 0.8, y + Math.sin(a) * ry * d * 0.7 - ry * 0.2, rx * 0.09, ry * 0.11, 0, 0, TAU); c.fill(); }
    c.restore();
  }
  function belly(c, x, y, rx, ry, rot, col) { if (sil) return; c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.clip(); ell(c, x + rx * 0.15, y + ry * 0.75, rx * 0.8, ry * 0.6, rot, col, false); c.restore(); }

  // ---------- species ----------
  function biped(c, P, S, o) {
    const t = S.t || 0, m = S.m || 0, ph = t * (6 + 6 * m) * (o.stepK || 1);
    const duck = S.duck ? 1 : 0;
    const L = o.leg * (1 - duck * 0.25), hipY = -L;
    const bob = Math.abs(Math.sin(ph)) * 2.5 * m;
    const bx = 0, by = hipY - o.ry * 0.35 - bob + duck * 4;
    const tilt = duck ? 0.12 : o.tilt;
    const dark = shade(P.col, -0.25), wag = Math.sin(t * 3 + 1) * 6 + Math.sin(ph) * 3 * m;
    bleg(c, -o.rx * 0.15, hipY - bob, L, o.legW, ph + Math.PI, m, dark);
    tail(c, bx - o.rx * 0.65, by - 2, o.tail, o.ry * 0.85, wag, -o.ry * 0.3 - duck * 6, P.col);
    if (o.sail) { // spinosaurus sail
      c.beginPath(); const sx = bx - o.rx * 0.75, sy = by - o.ry * 0.5;
      c.moveTo(sx, sy + 6);
      c.quadraticCurveTo(sx + o.rx * 0.55, sy - o.ry * 3.6, sx + o.rx * 1.4, sy + 8);
      c.closePath(); c.fillStyle = C(P.accent); c.fill(); c.stroke();
      if (!sil) { c.strokeStyle = shade(P.accent, -0.2); c.lineWidth = 2; for (let i = 1; i < 6; i++) { const px = sx + (o.rx * 1.4 * i) / 6; c.beginPath(); c.moveTo(px, sy + 6); c.lineTo(px + 2, sy - o.ry * 1.7 * Math.sin((Math.PI * i) / 6)); c.stroke(); } c.strokeStyle = OUT; c.lineWidth = LW; }
    }
    ell(c, bx, by, o.rx, o.ry, tilt, P.col);
    belly(c, bx, by, o.rx, o.ry, tilt, P.belly);
    if (o.stripes) stripes(c, bx - o.rx * 0.2, by, o.rx * 0.8, o.ry, 4, P.dark);
    if (o.feathers && !sil) { for (let i = 0; i < 3; i++) poly(c, [bx - o.rx * 0.3 + i * 8, by - o.ry * 0.85, bx - o.rx * 0.1 + i * 8, by - o.ry * 1.3 - i * 2, bx + i * 8, by - o.ry * 0.8], P.accent); }
    const nx = bx + o.rx * 0.7, ny = by - o.ry * 0.35;
    const na = (duck ? 0.15 : o.neckA) + (S.roar ? 0.25 : 0);
    const hx = nx + Math.cos(na) * o.neck, hy = ny - Math.sin(na) * o.neck + (duck ? 6 : 0) + Math.sin(ph * 2) * 1.2 * m;
    cap(c, nx - 4, ny + 4, hx, hy, o.neckW, P.col);
    cap(c, nx + o.rx * 0.05, ny + o.ry * 0.55, nx + o.rx * 0.05 + o.arm * 0.7, ny + o.ry * 0.55 + o.arm * 0.6 + Math.sin(t * 4) * 2, o.armW, dark);
    head(c, hx - 4, hy, -(o.headRot || 0) + (S.roar ? -0.3 : 0) + (duck ? 0.15 : 0), P, S, o.head);
    cap(c, nx + o.rx * 0.1, ny + o.ry * 0.5, nx + o.rx * 0.1 + o.arm, ny + o.ry * 0.5 + o.arm * 0.5 + Math.sin(t * 4 + 1) * 2, o.armW, P.col);
    bleg(c, o.rx * 0.05, hipY - bob, L, o.legW, ph, m, P.col);
  }

  function quad(c, P, S, o) {
    const t = S.t || 0, m = S.m || 0, ph = t * (5 + 5 * m);
    const duck = S.duck ? 1 : 0;
    const L = o.leg, bob = Math.abs(Math.sin(ph)) * 2 * m;
    const by = -L - o.ry * 0.55 - bob, bx = 0;
    const dark = shade(P.col, -0.25), wag = Math.sin(t * 2.5) * 5 + Math.sin(ph) * 3 * m;
    const fL = o.frontLeg || L;
    qleg(c, -o.rx * 0.5, by + o.ry * 0.4, L + o.ry * 0.15, o.legW, ph + Math.PI, m, dark);
    qleg(c, o.rx * 0.5, by + o.ry * 0.3 - (fL - L), fL + o.ry * 0.25, o.legW, ph, m, dark);
    tail(c, bx - o.rx * 0.7, by, o.tail, o.ry * 0.7, wag, o.ry * 0.25, P.col);
    const tipX = bx - o.rx * 0.7 - o.tail, tipY = by + o.ry * 0.25 + wag;
    if (o.spikes) { for (let i = 0; i < 2; i++) { poly(c, [tipX + 10 + i * 12, tipY - 2, tipX + 2 + i * 12, tipY - 24, tipX + 16 + i * 12, tipY - 4], '#fff6df'); } }
    if (o.club) ell(c, tipX + 4, tipY, 12, 9, 0, P.dark || dark);
    if (o.plates) {
      for (let i = 0; i < 6; i++) {
        const a = Math.PI + 0.35 + i * 0.45, px = bx + Math.cos(a) * o.rx * 0.88, py = by + Math.sin(a) * o.ry * 0.95;
        const s = (i === 2 || i === 3 ? 1.3 : 0.95) * o.ry * 0.85, rot = a + Math.PI / 2;
        c.save(); c.translate(px, py); c.rotate(rot - Math.PI / 2 + 0);
        poly(c, [-s * 0.45, 4, -s * 0.5, -s * 0.5, 0, -s * 1.15, s * 0.5, -s * 0.5, s * 0.45, 4], i % 2 ? P.accent : shade(P.accent, -0.12));
        c.restore();
      }
    }
    // neck & head
    const nx = bx + o.rx * 0.75, ny = by - o.ry * 0.25;
    const na = (duck ? Math.min(o.neckA, 0.1) : o.neckA) + (S.roar ? 0.2 : 0) + Math.sin(t * 2) * 0.03;
    const hx = nx + Math.cos(na) * o.neck, hy = ny - Math.sin(na) * o.neck;
    cap(c, nx - 6, ny + 2, hx, hy, o.neckW, P.col);
    if (o.neckSpots && !sil) { c.fillStyle = P.accent; for (let i = 1; i < 5; i++) { c.beginPath(); c.arc(nx + (hx - nx) * i / 5, ny + (hy - ny) * i / 5 - 3, 3.5, 0, TAU); c.fill(); } }
    ell(c, bx, by, o.rx, o.ry, 0, P.col);
    belly(c, bx, by, o.rx, o.ry, 0, P.belly);
    if (o.spotsCol) spots(c, bx, by, o.rx, o.ry, o.spotsCol, 1.3);
    if (o.armor && !sil) {
      c.fillStyle = shade(P.col, -0.18);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 6 - r; i++) {
        const ax = bx - o.rx * 0.7 + i * o.rx * 0.28 + r * o.rx * 0.14, ay = by - o.ry * 0.75 + r * o.ry * 0.38;
        c.beginPath(); c.ellipse(ax, ay, o.rx * 0.1, o.ry * 0.14, 0, 0, TAU); c.fill(); c.stroke();
      }
      for (let i = 0; i < 5; i++) poly(c, [bx - o.rx * 0.7 + i * o.rx * 0.33, by + o.ry * 0.35, bx - o.rx * 0.6 + i * o.rx * 0.33, by + o.ry * 0.95, bx - o.rx * 0.5 + i * o.rx * 0.33, by + o.ry * 0.35], '#fff6df');
    }
    head(c, hx - 2, hy, -(o.headRot || 0) + (S.roar ? -0.35 : 0), P, S, o.head);
    qleg(c, -o.rx * 0.42, by + o.ry * 0.45, L + o.ry * 0.1, o.legW, ph, m, P.col);
    qleg(c, o.rx * 0.58, by + o.ry * 0.35 - (fL - L), fL + o.ry * 0.2, o.legW, ph + Math.PI, m, P.col);
  }

  function ptera(c, P, S) {
    const t = S.t || 0, fl = Math.sin(t * (S.m > 0.1 ? 10 : 6));
    const by = -46 + fl * 3, bx = 0;
    const far = shade(P.col, -0.25);
    // far wing
    poly(c, [bx - 4, by - 4, bx - 34, by - 30 - fl * 26, bx - 64, by - 6 - fl * 30, bx - 20, by + 6], far);
    // legs
    cap(c, bx - 10, by + 8, bx - 18, by + 22, 4, far);
    // body
    ell(c, bx, by, 24, 13, -0.1, P.col);
    belly(c, bx, by, 24, 13, -0.1, P.belly);
    // tail nub
    // neck + head
    cap(c, bx + 16, by - 6, bx + 26, by - 16, 8, P.col);
    c.save(); c.translate(bx + 26, by - 18); c.rotate(-0.05 + (S.roar ? -0.25 : 0));
    poly(c, [-6, -2, -30, -18, -4, -10], P.accent); // crest
    // beak
    const jaw = S.jaw || 0;
    c.save(); c.translate(4, 4); c.rotate(jaw * 0.8); poly(c, [0, 0, 36, 2, 0, 6], '#ffcf6b'); c.restore();
    poly(c, [-2, -6, 40, 0, 2, 5], '#ffcf6b');
    ell(c, 0, 0, 10, 9, 0, P.col);
    eye(c, 2, -2, 5);
    c.restore();
    // near wing
    poly(c, [bx + 4, by - 2, bx - 26, by - 36 - fl * 30, bx - 70, by - 6 - fl * 34, bx - 14, by + 8], P.col);
    if (!sil) { c.beginPath(); c.moveTo(bx - 10, by + 2); c.lineTo(bx - 30, by - 22 - fl * 22); c.strokeStyle = shade(P.col, 0.35); c.lineWidth = 2; c.stroke(); c.strokeStyle = OUT; c.lineWidth = LW; }
    cap(c, bx - 4, by + 8, bx - 8, by + 24, 4, P.col);
  }

  const SHAPES = {
    rex: o => o === 0 ? null : null,
  };
  const DEF = {
    rex: { kind: 'biped', leg: 34, legW: 15, rx: 42, ry: 27, tilt: -0.12, tail: 62, neck: 18, neckA: 0.9, neckW: 22, arm: 11, armW: 6, stripes: true,
      head: { hl: 46, hh: 30, jawLen: 0.95, teeth: 6, eyeX: 0.32, eyeR: 0.2, snoutUp: 4, angry: true } },
    raptor: { kind: 'biped', leg: 30, legW: 10, rx: 28, ry: 16, tilt: -0.15, tail: 58, neck: 20, neckA: 1.0, neckW: 11, arm: 16, armW: 5, stripes: true, feathers: true, stepK: 1.2,
      head: { hl: 34, hh: 18, jawLen: 0.95, teeth: 5, eyeX: 0.32, eyeR: 0.3, snoutUp: 2 } },
    spino: { kind: 'biped', leg: 32, legW: 13, rx: 42, ry: 22, tilt: -0.1, tail: 66, neck: 22, neckA: 0.85, neckW: 15, arm: 16, armW: 6, sail: true,
      head: { hl: 54, hh: 20, jawLen: 1.0, teeth: 7, eyeX: 0.2, eyeR: 0.3, snoutUp: 6 } },
    trike: { kind: 'quad', leg: 18, legW: 15, rx: 44, ry: 26, tail: 40, neck: 14, neckA: 0.3, neckW: 22, headRot: -0.25,
      head: { hl: 40, hh: 26, jawLen: 0.85, beak: true, frill: true, horns: true, eyeX: 0.35, eyeR: 0.2, snoutUp: 0, blush: true } },
    steg: { kind: 'quad', leg: 20, legW: 14, rx: 44, ry: 25, tail: 50, neck: 16, neckA: -0.1, neckW: 15, headRot: -0.15, plates: true, spikes: true,
      head: { hl: 26, hh: 16, jawLen: 0.85, beak: true, eyeX: 0.35, eyeR: 0.32, snoutUp: 0, blush: true } },
    anky: { kind: 'quad', leg: 12, legW: 13, rx: 46, ry: 20, tail: 44, neck: 10, neckA: 0.05, neckW: 18, headRot: -0.1, armor: true, club: true,
      head: { hl: 28, hh: 20, jawLen: 0.85, beak: true, eyeX: 0.38, eyeR: 0.26, snoutUp: 0, blush: true } },
    brachio: { kind: 'quad', leg: 30, frontLeg: 42, legW: 15, rx: 42, ry: 26, tail: 50, neck: 80, neckA: 1.25, neckW: 16, headRot: 0.15, spotsCol: '#e8743b', neckSpots: true,
      head: { hl: 30, hh: 18, jawLen: 0.85, beak: false, bump: true, eyeX: 0.35, eyeR: 0.3, snoutUp: 0, blush: true } },
  };
  // approx local height (for fitting into cards / icons)
  G.DINO_H = { rex: 120, raptor: 95, spino: 120, trike: 90, steg: 95, anky: 70, brachio: 175, ptera: 125 };
  G.DINO_W = { rex: 190, raptor: 160, spino: 200, trike: 170, steg: 170, anky: 160, brachio: 190, ptera: 140 };

  // S: {t, m (0..1 moving), jaw, roar, duck, sil, pal (palette override), alpha}
  G.drawDino = function (c, id, x, y, s, face, S) {
    S = S || {};
    const P = S.pal ? Object.assign({}, G.DINO[id], S.pal) : G.DINO[id];
    sil = !!S.sil;
    c.save(); c.translate(x, y); c.scale(s * (face < 0 ? -1 : 1), s);
    if (S.alpha != null) c.globalAlpha = S.alpha;
    LW = Math.max(1.6, Math.min(3.2, 2.2 / Math.max(0.35, s) )); // keep outline readable
    c.lineWidth = LW; c.lineJoin = 'round'; c.strokeStyle = OUT;
    const d = DEF[id];
    if (id === 'ptera') ptera(c, P, S);
    else if (d.kind === 'biped') biped(c, P, S, d);
    else quad(c, P, S, d);
    c.restore(); sil = false;
  };

  G.drawShadow = function (c, x, y, rx, a) {
    c.fillStyle = 'rgba(20,40,10,' + (a || 0.25) + ')';
    c.beginPath(); c.ellipse(x, y, rx, rx * 0.32, 0, 0, TAU); c.fill();
  };

  // ---------- items & critters ----------
  G.drawMeat = function (c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); c.lineWidth = 2.5; c.strokeStyle = OUT; c.rotate(-0.4);
    cap(c, 4, 0, 18, 0, 5, '#fff6df'); ell(c, 20, -3, 4, 4, 0, '#fff6df'); ell(c, 20, 3, 4, 4, 0, '#fff6df');
    ell(c, -6, 0, 14, 11, 0, '#c0392b'); ell(c, -9, -3, 8, 5, -0.3, '#e86a5a', false);
    c.restore();
  };
  G.drawFern = function (c, x, y, s, eaten, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    if (eaten) { c.fillStyle = '#5a8f2e'; c.beginPath(); c.ellipse(0, 0, 8, 3, 0, 0, TAU); c.fill(); c.restore(); return; }
    const sway = Math.sin(t * 1.5 + x) * 0.06;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.38 + sway;
      c.save(); c.rotate(a + Math.PI / 2);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-8, -18, 0, -34); c.quadraticCurveTo(8, -18, 0, 0);
      c.fillStyle = i % 2 ? '#3fae49' : '#56c75a'; c.fill(); c.strokeStyle = '#26762f'; c.lineWidth = 1.5; c.stroke();
      c.restore();
    }
    c.restore();
  };
  G.drawBush = function (c, x, y, s, eaten) {
    c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = '#2b6b26'; c.lineWidth = 2;
    ell(c, -10, -10, 13, 11, 0, '#3f9b3a'); ell(c, 10, -10, 13, 11, 0, '#3f9b3a'); ell(c, 0, -18, 14, 12, 0, '#4cb046');
    if (!eaten) { c.fillStyle = '#e8304f'; [[-10, -14], [6, -20], [12, -8], [-3, -8], [0, -24], [-14, -6]].forEach(p => { c.beginPath(); c.arc(p[0], p[1], 3.6, 0, TAU); c.fill(); c.fillStyle = '#ff9db0'; c.beginPath(); c.arc(p[0] - 1, p[1] - 1, 1.2, 0, TAU); c.fill(); c.fillStyle = '#e8304f'; }); }
    c.restore();
  };
  G.drawFish = function (c, x, y, s, face, t, col) {
    c.save(); c.translate(x, y); c.scale(s * face, s); c.rotate(Math.sin(t * 8) * 0.12);
    c.lineWidth = 2; c.strokeStyle = OUT;
    poly(c, [-12, 0, -22, -8, -22, 8], col || '#ff9f1c');
    ell(c, 0, 0, 14, 8, 0, col || '#ffbf69');
    c.beginPath(); c.arc(7, -2, 2, 0, TAU); c.fillStyle = '#222'; c.fill();
    c.restore();
  };
  G.drawCritter = function (c, x, y, s, face, t, kind, moving) {
    c.save(); c.translate(x, y); c.scale(s * face, s); c.lineWidth = 2.2; c.strokeStyle = OUT; c.lineJoin = 'round';
    const ph = t * 16, b = moving ? Math.abs(Math.sin(ph)) * 3 : 0;
    if (kind === 0) { // round bird
      cap(c, -3, -8, -5 + Math.sin(ph) * 4 * moving, 0, 2.5, '#f4a259'); cap(c, 3, -8, 1 - Math.sin(ph) * 4 * moving, 0, 2.5, '#f4a259');
      poly(c, [-12, -18 - b, -22, -26 - b, -20, -14 - b], '#7d6bd6');
      ell(c, 0, -17 - b, 13, 11, 0, '#a593f0'); ell(c, 2, -13 - b, 8, 5, 0, '#e4ddff', false);
      ell(c, 9, -26 - b, 7, 7, 0, '#a593f0'); poly(c, [14, -27 - b, 22, -25 - b, 14, -23 - b], '#ffcf3f');
      c.beginPath(); c.arc(11, -28 - b, 1.8, 0, TAU); c.fillStyle = '#222'; c.fill();
    } else { // little lizard
      c.beginPath(); c.moveTo(-8, -6 - b); c.quadraticCurveTo(-22, -4 + Math.sin(ph) * 3, -30, -10); c.quadraticCurveTo(-20, -1, -8, -2 - b); c.fillStyle = '#5ec27a'; c.fill(); c.stroke();
      cap(c, -4, -4, -6 + Math.sin(ph) * 4 * moving, 0, 2.5, '#3c9c58'); cap(c, 6, -4, 4 - Math.sin(ph) * 4 * moving, 0, 2.5, '#3c9c58');
      ell(c, 0, -6 - b, 11, 5.5, 0, '#5ec27a'); ell(c, 13, -9 - b, 6, 4.5, 0, '#5ec27a');
      c.beginPath(); c.arc(15, -10 - b, 1.6, 0, TAU); c.fillStyle = '#222'; c.fill();
    }
    c.restore();
  };
  G.drawEgg = function (c, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s); c.rotate(Math.sin(t * 3) * 0.12);
    c.lineWidth = 2.5; c.strokeStyle = OUT;
    c.beginPath(); c.moveTo(0, -30); c.bezierCurveTo(14, -30, 16, 0, 0, 0); c.bezierCurveTo(-16, 0, -14, -30, 0, -30);
    const g = c.createLinearGradient(-12, -30, 12, 0); g.addColorStop(0, '#fff7c2'); g.addColorStop(1, '#ffc93c');
    c.fillStyle = g; c.fill(); c.stroke();
    c.fillStyle = '#ff9f43'; [[-4, -20, 3], [5, -12, 2.5], [-3, -8, 2], [4, -24, 2]].forEach(p => { c.beginPath(); c.arc(p[0], p[1], p[2], 0, TAU); c.fill(); });
    c.restore();
  };
  G.drawFossil = function (c, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s); c.lineWidth = 2.5; c.strokeStyle = OUT;
    ell(c, 0, -12, 16, 14, 0, '#d9c7a7');
    c.beginPath(); c.strokeStyle = '#8d6e4a'; c.lineWidth = 2.5;
    for (let a = 0; a < 12; a += 0.2) { const r = 1 + a * 1.05; const px = Math.cos(a) * r, py = -12 + Math.sin(a) * r; if (a === 0) c.moveTo(px, py); else c.lineTo(px, py); }
    c.stroke();
    c.restore();
  };
  G.drawSparkle = function (c, x, y, r, t) {
    const a = (Math.sin(t * 5) + 1) / 2;
    c.save(); c.translate(x, y); c.rotate(t); c.fillStyle = 'rgba(255,255,220,' + (0.4 + a * 0.6) + ')';
    c.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.3 : r * (0.7 + a * 0.3); const an = (i * Math.PI) / 4; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.fill(); c.restore();
  };
  G.drawTree = function (c, x, y, s, palm, t, munched) {
    c.save(); c.translate(x, y); c.scale(s, s); c.lineWidth = 2.5; c.strokeStyle = OUT;
    if (palm) {
      const sw = Math.sin(t + x * 0.01) * 3;
      c.beginPath(); c.moveTo(-5, 0); c.quadraticCurveTo(-2, -40, 6 + sw, -78); c.lineTo(14 + sw, -76); c.quadraticCurveTo(8, -40, 7, 0); c.closePath(); c.fillStyle = '#b07a46'; c.fill(); c.stroke();
      if (!munched) for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; c.save(); c.translate(10 + sw, -78); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(22, -14, 44, 6); c.quadraticCurveTo(22, -2, 0, 0); c.fillStyle = i % 2 ? '#2e9e44' : '#3cb553'; c.fill(); c.stroke(); c.restore(); }
      else ell(c, 10 + sw, -78, 8, 6, 0, '#3cb553');
      c.fillStyle = '#8a5a2b'; c.beginPath(); c.arc(6 + sw, -74, 4, 0, TAU); c.arc(14 + sw, -73, 4, 0, TAU); c.fill();
    } else {
      cap(c, 0, 0, 0, -36, 12, '#9a6a3c');
      const r = munched ? 0.7 : 1;
      ell(c, -16 * r, -44, 22 * r, 19 * r, 0, '#2f9a48'); ell(c, 16 * r, -44, 22 * r, 19 * r, 0, '#2f9a48'); ell(c, 0, -62 * (munched ? 0.9 : 1), 26 * r, 22 * r, 0, '#3db456');
      if (!munched) { ell(c, -6, -66, 9, 6, -0.4, 'rgba(255,255,255,0.18)', false); }
    }
    c.restore();
  };
  G.drawNest = function (c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); c.lineWidth = 3; c.strokeStyle = '#6b4423';
    ell(c, 0, 0, 46, 18, 0, '#a07040');
    ell(c, 0, -2, 34, 11, 0, '#7a5230');
    c.strokeStyle = '#c99a5b'; c.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 30, Math.sin(a) * 12); c.lineTo(Math.cos(a + 0.5) * 46, Math.sin(a + 0.5) * 17); c.stroke(); }
    G.drawEgg(c, -10, 0, 0.55, 0); G.drawEgg(c, 8, 2, 0.5, 0);
    c.restore();
  };
  G.drawBone = function (c, x, y, s, rot) {
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s); c.lineWidth = 2; c.strokeStyle = OUT;
    cap(c, -10, 0, 10, 0, 6, '#fffbea');
    [[-12, -4], [-12, 4], [12, -4], [12, 4]].forEach(p => ell(c, p[0], p[1], 4.5, 4.5, 0, '#fffbea'));
    c.fillStyle = '#fffbea'; c.fillRect(-11, -3, 22, 6);
    c.restore();
  };
  G.drawLeaf = function (c, x, y, s, rot) {
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s); c.lineWidth = 2; c.strokeStyle = '#1f6b2a';
    c.beginPath(); c.moveTo(-14, 0); c.quadraticCurveTo(0, -14, 14, 0); c.quadraticCurveTo(0, 14, -14, 0); c.fillStyle = '#5bd16b'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-14, 0); c.lineTo(12, 0); c.stroke();
    c.restore();
  };
  G.drawHeart = function (c, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s, s); c.beginPath(); c.moveTo(0, 6);
    c.bezierCurveTo(-14, -4, -8, -14, 0, -7); c.bezierCurveTo(8, -14, 14, -4, 0, 6);
    c.fillStyle = col || '#ff4d6d'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke(); c.restore();
  };
})(window.G);
