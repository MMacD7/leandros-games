// Touch controls: floating joystick (left half), camera orbit drag (right half), action buttons. Keyboard/mouse fallback for desktop.
export class Input {
  constructor(root) {
    this.move = { x: 0, y: 0 }; this.look = { dx: 0, dy: 0 }; this.btn = { laser: false, missile: false, melee: false, boost: false };
    this.pressed = {}; this.taps = {}; this.lastLook = -1e9; this.enabled = false;
    this.joyBase = document.getElementById('joy-base'); this.joyKnob = document.getElementById('joy-knob'); this.zone = document.getElementById('touch-zone');
    this.joyId = null; this.lookId = null; this.joyC = { x: 0, y: 0 };
    const opt = { passive: false };
    this.zone.addEventListener('touchstart', e => this.ts(e), opt);
    window.addEventListener('touchmove', e => this.tm(e), opt);
    window.addEventListener('touchend', e => this.te(e), opt); window.addEventListener('touchcancel', e => this.te(e), opt);
    // buttons: pointer events per button, each tracking its own pointerIds, so several buttons can be held at once
    // (and the joystick keeps working). Every press counts; holding auto-repeats in the game loop.
    document.querySelectorAll('[data-btn]').forEach(b => {
      const k = b.dataset.btn, ids = new Set(); b.style.touchAction = 'none';
      const on = e => { e.preventDefault(); e.stopPropagation(); ids.add(e.pointerId); try { b.setPointerCapture(e.pointerId); } catch (err) { } this.btn[k] = true; this.pressed[k] = (this.pressed[k] || 0) + 1; this.taps[k] = (this.taps[k] || 0) + 1; b.classList.add('down'); };
      const off = e => { ids.delete(e.pointerId); if (!ids.size) { this.btn[k] = false; b.classList.remove('down'); } };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
      b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); }, opt); // no emulated mouse/click/zoom
      b.addEventListener('contextmenu', e => e.preventDefault());
      this.btnIds = this.btnIds || {}; this.btnIds[k] = ids;
    });
    // keyboard
    this.keys = {};
    const map = { KeyJ: 'laser', Space: 'laser', KeyK: 'missile', KeyL: 'melee', ShiftLeft: 'boost', ShiftRight: 'boost' };
    window.addEventListener('keydown', e => { this.keys[e.code] = true; if (map[e.code]) { if (!this.btn[map[e.code]]) this.pressed[map[e.code]] = true; this.btn[map[e.code]] = true; } });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; if (map[e.code]) this.btn[map[e.code]] = false; });
    // mouse drag to orbit on desktop
    let md = null;
    this.zone.addEventListener('mousedown', e => { md = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('mousemove', e => { if (!md) return; this.look.dx += e.clientX - md.x; this.look.dy += e.clientY - md.y; md = { x: e.clientX, y: e.clientY }; this.lastLook = performance.now(); });
    window.addEventListener('mouseup', () => md = null);
  }
  ts(e) {
    if (!this.enabled) return; e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth * 0.45 && this.joyId === null) {
        this.joyId = t.identifier; this.joyC = { x: t.clientX, y: t.clientY };
        this.joyBase.style.transform = `translate(${t.clientX - 60}px, ${t.clientY - 60}px)`; this.joyBase.classList.add('active'); this.setKnob(0, 0);
      } else if (this.lookId === null) { this.lookId = t.identifier; this.lookP = { x: t.clientX, y: t.clientY }; }
    }
  }
  tm(e) {
    if (this.enabled) e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joyId) { let dx = t.clientX - this.joyC.x, dy = t.clientY - this.joyC.y; const L = Math.hypot(dx, dy), M = 55; if (L > M) { dx *= M / L; dy *= M / L; }
        this.move.x = dx / M; this.move.y = dy / M; this.setKnob(dx, dy); }
      else if (t.identifier === this.lookId) { this.look.dx += t.clientX - this.lookP.x; this.look.dy += t.clientY - this.lookP.y; this.lookP = { x: t.clientX, y: t.clientY }; this.lastLook = performance.now(); }
    }
  }
  te(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.joyId) { this.joyId = null; this.move.x = this.move.y = 0; this.setKnob(0, 0); this.joyBase.classList.remove('active'); this.joyBase.style.transform = ''; }
      if (t.identifier === this.lookId) this.lookId = null;
    }
  }
  setKnob(x, y) { this.joyKnob.style.transform = `translate(${x}px, ${y}px)`; }
  read() {
    let x = this.move.x, y = this.move.y;
    if (this.keys.KeyW || this.keys.ArrowUp) y -= 1; if (this.keys.KeyS || this.keys.ArrowDown) y += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) x -= 1; if (this.keys.KeyD || this.keys.ArrowRight) x += 1;
    const L = Math.hypot(x, y); if (L > 1) { x /= L; y /= L; }
    const look = { dx: this.look.dx, dy: this.look.dy }; this.look.dx = this.look.dy = 0;
    const pressed = this.pressed; this.pressed = {};
    return { x, y, look, pressed, btn: this.btn, looking: performance.now() - this.lastLook < 1500 };
  }
  reset() { this.move.x = this.move.y = 0; for (const k in this.btn) this.btn[k] = false; for (const k in (this.btnIds || {})) this.btnIds[k].clear(); this.joyId = this.lookId = null; document.querySelectorAll('[data-btn]').forEach(b => b.classList.remove('down')); }
}
