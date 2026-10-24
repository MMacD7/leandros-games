/* Screens, input, UI and the main loop */
'use strict';
(function (G) {
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const cv = $('#game'), ctx = cv.getContext('2d');
  G.ctx = ctx; G.vw = 800; G.vh = 400;
  G.input = { jx: 0, jy: 0, sprint: false, bite: false, roar: false };
  let heroBox = { x: 0, y: 0, r: 0 }, screen = 'title', paused = false, last = 0, titleT = 0, titleRoar = 0, dpr = 1;

  // ---------- icons (inline SVG, no external files) ----------
  const ST = 'stroke="#5a3e2b" stroke-width="2.5" stroke-linejoin="round"';
  const ICONS = {
    bone: '<svg viewBox="0 0 48 24"><g fill="#fffbea" ' + ST + '><circle cx="8" cy="7" r="6"/><circle cx="8" cy="17" r="6"/><circle cx="40" cy="7" r="6"/><circle cx="40" cy="17" r="6"/><rect x="8" y="7" width="32" height="10"/></g><rect x="7" y="8.4" width="34" height="7.2" fill="#fffbea"/></svg>',
    bite: '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="24" rx="20" ry="16" fill="#7a1d2b" stroke="#fff" stroke-width="3"/><path d="M7 15l4 9 4-9 4 9 5-10 5 10 4-9 4 9 4-9z" fill="#fff"/><path d="M8 34l4-8 4 8 4-8 4 9 4-9 4 8 4-8 4 8z" fill="#fff"/></svg>',
    roar: '<svg viewBox="0 0 48 48"><path d="M5 17h8l11-9v32l-11-9H5z" fill="#fff"/><path d="M30 16q6 8 0 16M35 11q10 13 0 26M40 6q14 18 0 36" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>',
    bolt: '<svg viewBox="0 0 48 48"><path d="M28 2 8 28h14l-4 18 22-28H26z" fill="#fff" stroke="#7a5200" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    home: '<svg viewBox="0 0 48 48"><path d="M24 6 4 24h6v16h10V30h8v10h10V24h6z" fill="#fff"/></svg>',
    sndOn: '<svg viewBox="0 0 48 48"><path d="M6 18h8l10-8v28l-10-8H6z" fill="#fff"/><path d="M30 17q5 7 0 14M35 12q10 12 0 24" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>',
    sndOff: '<svg viewBox="0 0 48 48"><path d="M6 18h8l10-8v28l-10-8H6z" fill="#fff"/><path d="M31 17l12 14M43 17 31 31" stroke="#ff8787" stroke-width="4" stroke-linecap="round"/></svg>',
    heart: '<svg viewBox="0 0 48 48"><path d="M24 42C8 30 2 22 6 13c4-8 14-8 18 0 4-8 14-8 18 0 4 9-2 17-18 29z" fill="#ff4d6d" stroke="#5a1e2b" stroke-width="2.5"/><ellipse cx="14" cy="15" rx="4" ry="3" fill="#fff" opacity=".6"/></svg>',
    meat: '<svg viewBox="0 0 48 48"><path d="M28 20l12-8" stroke="#5a3e2b" stroke-width="9" stroke-linecap="round"/><path d="M28 20l12-8" stroke="#fffbea" stroke-width="5" stroke-linecap="round"/><circle cx="41" cy="9" r="4.5" fill="#fffbea" stroke="#5a3e2b" stroke-width="2"/><circle cx="44" cy="14" r="4.5" fill="#fffbea" stroke="#5a3e2b" stroke-width="2"/><ellipse cx="18" cy="27" rx="15" ry="13" fill="#d9480f" stroke="#5a2a20" stroke-width="2.5"/><ellipse cx="14" cy="23" rx="7" ry="4" fill="#ff8a65"/></svg>',
    leaf: '<svg viewBox="0 0 48 48"><path d="M6 42Q4 8 42 6Q42 42 6 42z" fill="#5bd16b" stroke="#1f6b2a" stroke-width="2.5"/><path d="M8 40 34 14" stroke="#1f6b2a" stroke-width="2.5"/></svg>',
    fish: '<svg viewBox="0 0 48 48"><path d="M36 24l10-9v18z" fill="#ff9f1c" stroke="#7a4a00" stroke-width="2.5" stroke-linejoin="round"/><path d="M4 24q16-16 34 0q-18 16-34 0z" fill="#ffbf69" stroke="#7a4a00" stroke-width="2.5"/><circle cx="13" cy="22" r="2.6" fill="#222"/></svg>',
    star: '<svg viewBox="0 0 48 48"><path d="M24 3l6.5 13.5 14.5 1.6-10.8 10 3 14.6L24 35.4 10.8 42.7l3-14.6L3 18.1l14.5-1.6z" fill="#ffd166" stroke="#a66a00" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    starOff: '<svg viewBox="0 0 48 48"><path d="M24 3l6.5 13.5 14.5 1.6-10.8 10 3 14.6L24 35.4 10.8 42.7l3-14.6L3 18.1l14.5-1.6z" fill="#cfc9e3" stroke="#8f88ad" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 48 48"><path d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#5a3e2b" stroke-width="5"/><rect x="9" y="21" width="30" height="23" rx="5" fill="#ffd166" stroke="#5a3e2b" stroke-width="3"/><circle cx="24" cy="32" r="3.5" fill="#5a3e2b"/></svg>',
    palm: '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="43" rx="20" ry="4.5" fill="#f4dc9a"/><path d="M23 43q-3-14 3-27" stroke="#5a3e2b" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M23 43q-3-14 3-27" stroke="#c08552" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M26 16Q12 6 3 17q11-5 23-1zM26 16q14-11 20 3-10-7-20-3zM26 16q-4-13 9-15-7 6-9 15zM26 16Q16 12 10 4q10 3 16 12z" fill="#51cf66" stroke="#1f6b2a" stroke-width="2" stroke-linejoin="round"/><circle cx="24" cy="18" r="3" fill="#8a5a2b"/><circle cx="28" cy="19" r="3" fill="#8a5a2b"/></svg>',
    run: '<svg viewBox="0 0 48 48"><path d="M4 14h10M2 24h12M4 34h10" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M30 44c-8 0-11-7-7-13l7-7 7 7c4 6 1 13-7 13z" fill="#fff"/><ellipse cx="20" cy="18" rx="3.5" ry="6" transform="rotate(-25 20 18)" fill="#fff"/><ellipse cx="30" cy="12" rx="3.5" ry="6.5" fill="#fff"/><ellipse cx="40" cy="18" rx="3.5" ry="6" transform="rotate(25 40 18)" fill="#fff"/></svg>',
    egg: '<svg viewBox="0 0 48 48"><path d="M24 3c10 0 17 17 17 27a17 17 0 0 1-34 0C7 20 14 3 24 3z" fill="#fff7c2" stroke="#5a3e2b" stroke-width="2.5"/><path d="M9 27l6-4 5 5 5-6 5 5 5-5 5 4" fill="none" stroke="#5a3e2b" stroke-width="2.5" stroke-linejoin="round"/><circle cx="18" cy="35" r="3" fill="#ff9f43"/><circle cx="30" cy="38" r="3.5" fill="#ff9f43"/><circle cx="29" cy="14" r="2.5" fill="#ff9f43"/><circle cx="19" cy="15" r="2" fill="#ff9f43"/></svg>',
    back: '<svg viewBox="0 0 48 48"><path d="M30 8 14 24l16 16" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    replay: '<svg viewBox="0 0 48 48"><path d="M38 26a14 14 0 1 1-5-12" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M38 4v14H24z" fill="#fff"/></svg>',
    check: '<svg viewBox="0 0 48 48"><path d="M8 26l10 10 22-24" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 48 48"><path d="M14 6l28 18-28 18z" fill="#fff" stroke-linejoin="round"/></svg>',
    up: '<svg viewBox="0 0 48 48"><path d="M24 6 8 26h10v16h12V26h10z" fill="#fff"/></svg>',
    down: '<svg viewBox="0 0 48 48"><path d="M24 42 8 22h10V6h12v16h10z" fill="#fff"/></svg>',
    shield: '<svg viewBox="0 0 48 48"><path d="M24 4l17 6v12c0 10-7 18-17 22C14 40 7 32 7 22V10z" fill="#74c0fc" stroke="#1d4e89" stroke-width="3"/></svg>',
    fang: '<svg viewBox="0 0 48 48"><path d="M8 6h32l-6 10-4-4-6 30-6-30-4 4z" fill="#fff" stroke="#5a3e2b" stroke-width="3" stroke-linejoin="round"/></svg>',
    speed: '<svg viewBox="0 0 48 48"><path d="M28 2 8 28h14l-4 18 22-28H26z" fill="#ffd43b" stroke="#7a5200" stroke-width="3" stroke-linejoin="round"/></svg>',
    rotate: '<svg viewBox="0 0 64 64"><rect x="22" y="6" width="20" height="36" rx="4" fill="none" stroke="#5a2d0c" stroke-width="4" transform="rotate(-90 32 32) translate(0 6)"/><path d="M14 18a22 22 0 0 1 30-8" stroke="#e8590c" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M46 4l0 10-10 0z" fill="#e8590c"/></svg>',
  };
  ICONS.plant = ICONS.leaf;
  function icons(root) { (root || document).querySelectorAll('i[data-icon]').forEach(i => { const n = i.getAttribute('data-icon'); if (i._n !== n) { i.innerHTML = ICONS[n] || ''; i._n = n; } }); }

  // ---------- sizing ----------
  function resize() {
    G.vw = window.innerWidth; G.vh = window.innerHeight;
    // cap backing-store size (~4 MP) so big iPads stay smooth
    dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4.2e6 / (G.vw * G.vh)));
    cv.width = Math.round(G.vw * dpr); cv.height = Math.round(G.vh * dpr);
    if (G.island && screen === 'island') G.island.resize();
    if (screen === 'runner') G.runner.resize();
    checkRotate();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  // ---------- block page scroll / zoom ----------
  document.addEventListener('touchmove', e => { if (!e.target.closest || !e.target.closest('.grid')) e.preventDefault(); }, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
  let lastTouchEnd = 0;
  document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTouchEnd < 350 && !(e.target.closest && e.target.closest('button'))) e.preventDefault(); lastTouchEnd = n; }, { passive: false });
  document.addEventListener('pointerdown', () => G.audio.unlock(), true);
  document.addEventListener('touchstart', () => G.audio.unlock(), { capture: true, passive: true });

  // ---------- screens ----------
  const screens = { title: $('#title'), collection: $('#collection'), island: $('#hud-island'), runner: $('#hud-run') };
  function show(name) {
    if (screen === 'island' && name !== 'island') G.island.stop();
    screen = name;
    Object.keys(screens).forEach(k => screens[k].classList.toggle('hidden', k !== name));
    $('#over').classList.add('hidden');
    resetInput();
    if (name === 'title') renderNext();
    if (name === 'collection') renderGrid();
    if (name === 'island') { G.island.start(); G.island.resize(); setFoodIcon(); checkRotate(); }
    if (name === 'runner') { G.runner.start(); runHelp(); }
    G.ui.updateBones();
    showNextUnlock();
  }
  function tapBtn(el, fn) { el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); G.audio.unlock(); fn(e); }); }
  tapBtn($('#b-island'), () => { G.audio.click(); show('island'); });
  tapBtn($('#b-run'), () => { G.audio.click(); show('runner'); });
  tapBtn($('#b-dinos'), () => { G.audio.click(); show('collection'); });
  $$('.home').forEach(b => tapBtn(b, () => { G.audio.click(); show('title'); }));
  tapBtn($('#collection .back'), () => { G.audio.click(); show('title'); });
  $$('.mute').forEach(b => tapBtn(b, () => { G.save.muted = !G.save.muted; G.persist(); muteIcons(); G.audio.click(); }));
  function muteIcons() { $$('.mute').forEach(b => { b.innerHTML = '<i data-icon="' + (G.save.muted ? 'sndOff' : 'sndOn') + '"></i>'; }); icons(); }
  tapBtn($('#ov-home'), () => { G.audio.click(); show('title'); });
  tapBtn($('#ov-again'), () => { G.audio.click(); $('#over').classList.add('hidden'); G.runner.start(); runHelp(); });

  // title: tap the big dino to make it roar
  screens.title.addEventListener('pointerdown', e => { if (e.target.closest('button') || Math.hypot(e.clientX - heroBox.x, e.clientY - heroBox.y) > heroBox.r) return; titleRoar = 0.9; G.audio.roar(G.save.selected === 'rex'); });

  // ---------- collection ----------
  function renderGrid() {
    const grid = $('#grid'); grid.innerHTML = '';
    G.DINOS.forEach(d => {
      const un = G.isUnlocked(d.id), xp = G.save.xp[d.id] || 0, st = G.stageOf(xp);
      const card = document.createElement('div');
      card.className = 'dcard' + (un ? '' : ' locked') + (G.save.selected === d.id ? ' sel' : '');
      const pips = (n, ic) => '<span>' + [1, 2, 3].map(i => '<i data-icon="' + ic + '" class="' + (i <= n ? '' : 'off') + '"></i>').join('') + '</span>';
      const spd = d.speed >= 1.2 ? 3 : d.speed >= 1 ? 2 : 1;
      const diet = d.diet.map(x => '<i data-icon="' + x + '"></i>').join('');
      card.innerHTML = '<canvas width="240" height="180"></canvas><div class="nm">' + (un ? d.name : '???') + '</div>' +
        '<div class="stats"><span>' + diet + '</span>' + pips(spd, 'speed') + pips(d.power, 'fang') + pips(d.tough, 'shield') + '</div>' +
        (un ? '<div class="stage">' + [0, 1, 2].map(i => '<i data-icon="' + (i <= st ? 'star' : 'starOff') + '"></i>').join('') + '</div>'
          : '<i class="lock" data-icon="lock"></i><div class="prog"><i data-icon="bone"></i><div class="track"><div class="fill" style="width:' + Math.min(100, (G.save.total / d.cost) * 100) + '%"></div></div><span>' + G.save.total + '/' + d.cost + '</span></div>');
      grid.appendChild(card);
      const c = card.querySelector('canvas').getContext('2d');
      drawCardDino(c, d.id, 240, 180, !un, 0.2);
      card._c = c; card._id = d.id; card._un = un;
      card.addEventListener('click', () => {
        if (!un) { G.audio.nope(); card.classList.remove('wiggle'); void card.offsetWidth; card.classList.add('wiggle'); return; }
        G.save.selected = d.id; G.persist(); G.audio.roar(d.id === 'rex');
        $$('.dcard').forEach(x => x.classList.remove('sel')); card.classList.add('sel');
      });
    });
    icons(grid);
  }
  function drawCardDino(c, id, w, h, sil, t) {
    c.clearRect(0, 0, w, h);
    const s = Math.min((h * 0.86) / G.DINO_H[id], (w * 0.86) / G.DINO_W[id]);
    G.drawShadow(c, w / 2, h - 12, 50 * s * (G.DINO_W[id] / 170) * 1.2, sil ? 0.12 : 0.2);
    G.drawDino(c, id, w / 2 + G.DINO_W[id] * s * 0.12, h - 12, s, 1, { t, m: 0, sil });
  }

  // next unlock pill on title
  function renderNext() {
    const el = $('#next-unlock'), d = G.nextLocked();
    if (!d) { el.innerHTML = '<i data-icon="star"></i><i data-icon="star"></i><i data-icon="star"></i>'; icons(el); return; }
    const prev = G.DINOS[G.DINOS.indexOf(d) - 1], lo = prev ? prev.cost : 0;
    const pct = Math.max(0, Math.min(100, ((G.save.total - lo) / (d.cost - lo)) * 100));
    el.innerHTML = '<canvas width="112" height="80"></canvas><div class="track"><div class="fill" style="width:' + pct + '%"></div></div><i data-icon="bone"></i><span>' + G.save.total + '/' + d.cost + '</span>';
    drawCardDino(el.querySelector('canvas').getContext('2d'), d.id, 112, 80, true, 0);
    icons(el);
  }

  // ---------- unlock popups ----------
  const unlockQ = [];
  let ulId = null, ulT = 0;
  function showNextUnlock() {
    if (ulId || !unlockQ.length) return;
    if (screen === 'runner' && !G.runner.hud().over) return;
    ulId = unlockQ.shift(); ulT = 0;
    $('#unlock .ul-name').textContent = G.DINO[ulId].name;
    $('#unlock').classList.remove('hidden'); paused = true; resetInput();
    G.audio.fanfare();
  }
  tapBtn($('#ul-ok'), () => {
    G.audio.click(); G.save.selected = ulId; G.save.seenUnlock.push(ulId); G.persist();
    ulId = null; $('#unlock').classList.add('hidden'); paused = false;
    if (screen === 'title') renderNext(); if (screen === 'collection') renderGrid();
    showNextUnlock();
  });

  // ---------- rotate hint (phones in portrait, island mode only) ----------
  let rotDismissed = false;
  function checkRotate() {
    const need = screen === 'island' && G.vh > G.vw && G.vw < 600 && !rotDismissed;
    $('#rotate').classList.toggle('hidden', !need);
    if (need) paused = true; else if (!ulId) paused = false;
  }
  tapBtn($('#rot-ok'), () => { rotDismissed = true; G.audio.click(); checkRotate(); });

  // ---------- UI api used by game modules ----------
  G.ui = {
    updateBones() { $$('.bones-val').forEach(e => (e.textContent = G.save.bones)); },
    queueUnlock(id) { unlockQ.push(id); setTimeout(showNextUnlock, 50); },
    banner(stage) {
      const b = $('#banner');
      b.innerHTML = [0, 1, 2].map(i => '<i data-icon="' + (i <= stage ? 'star' : 'starOff') + '"></i>').join('') + '<span>' + G.STAGES[stage].name + '!</span>';
      icons(b); b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
      clearTimeout(b._t); b._t = setTimeout(() => b.classList.add('hidden'), 2200);
    },
    runnerOver(r) {
      $('#ov-score').textContent = r.score; $('.ov-m').textContent = r.meters + ' m';
      $('#ov-bones').textContent = '+' + r.bones; $('.ov-best').classList.toggle('hidden', !r.newBest);
      $('#over').classList.remove('hidden');
      setTimeout(showNextUnlock, 600);
    },
  };

  // ---------- island controls ----------
  const joyZone = $('#joy-zone'), joyBase = $('#joy-base'), joyKnob = $('#joy-knob');
  let joyId = null, joyC = { x: 0, y: 0 };
  function resetInput() {
    G.input.jx = G.input.jy = 0; G.input.sprint = false; G.input.bite = G.input.roar = false; joyId = null;
    joyBase.style.transform = ''; joyKnob.style.transform = ''; joyBase.classList.remove('active');
    $$('.act').forEach(a => a.classList.remove('down'));
  }
  joyZone.addEventListener('pointerdown', e => {
    e.preventDefault(); if (joyId !== null) return;
    joyId = e.pointerId; try { joyZone.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    const r = joyBase.getBoundingClientRect();
    const home = { x: r.left + r.width / 2 - (parseFloat(joyBase.dataset.dx) || 0), y: r.top + r.height / 2 - (parseFloat(joyBase.dataset.dy) || 0) };
    joyC = { x: e.clientX, y: e.clientY };
    const dx = e.clientX - home.x, dy = e.clientY - home.y;
    joyBase.dataset.dx = dx; joyBase.dataset.dy = dy;
    joyBase.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; joyBase.classList.add('active');
    joyMove(e);
  });
  function joyMove(e) {
    if (e.pointerId !== joyId) return;
    const rad = joyBase.offsetWidth * 0.42;
    let dx = e.clientX - joyC.x, dy = e.clientY - joyC.y; const d = Math.hypot(dx, dy);
    if (d > rad) { dx = (dx / d) * rad; dy = (dy / d) * rad; }
    joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    const m = Math.min(1, d / rad);
    G.input.jx = (dx / rad); G.input.jy = (dy / rad);
    if (m < 0.12) { G.input.jx = G.input.jy = 0; }
  }
  function joyEnd(e) { if (e.pointerId !== joyId) return; joyId = null; G.input.jx = G.input.jy = 0; joyKnob.style.transform = ''; joyBase.style.transform = ''; joyBase.dataset.dx = 0; joyBase.dataset.dy = 0; joyBase.classList.remove('active'); }
  joyZone.addEventListener('pointermove', joyMove);
  joyZone.addEventListener('pointerup', joyEnd); joyZone.addEventListener('pointercancel', joyEnd);
  function holdBtn(el, on, off) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } on(); });
    const up = e => { el.classList.remove('down'); off && off(); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  }
  holdBtn($('#a-bite'), () => (G.input.bite = true));
  holdBtn($('#a-roar'), () => (G.input.roar = true));
  holdBtn($('#a-sprint'), () => (G.input.sprint = true), () => (G.input.sprint = false));
  function setFoodIcon() { const sp = G.DINO[G.save.selected]; const i = $('#hud-island .food-icon'); i.setAttribute('data-icon', sp.diet[0]); icons($('#hud-island')); }

  // ---------- runner controls: tap = jump, swipe down = duck/chomp ----------
  const runEl = screens.runner;
  let rp = null;
  runEl.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return; e.preventDefault();
    if (rp) return;
    rp = { id: e.pointerId, y: e.clientY, x: e.clientX, t: performance.now(), mode: null };
    try { runEl.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    rp.timer = setTimeout(() => { if (rp && !rp.mode) { rp.mode = 'jump'; G.runner.jump(); } }, 70);
    fadeHelp();
  });
  runEl.addEventListener('pointermove', e => {
    if (!rp || e.pointerId !== rp.id) return;
    const dy = e.clientY - rp.y;
    if (dy > 22 && rp.mode !== 'duck') { rp.mode = 'duck'; clearTimeout(rp.timer); G.runner.setDuck(true); }
    else if (dy < -22 && !rp.mode) { rp.mode = 'jump'; clearTimeout(rp.timer); G.runner.jump(); }
  });
  const rEnd = e => {
    if (!rp || e.pointerId !== rp.id) return;
    clearTimeout(rp.timer);
    if (!rp.mode) G.runner.jump();
    if (rp.mode === 'duck') G.runner.setDuck(false);
    rp = null;
  };
  runEl.addEventListener('pointerup', rEnd); runEl.addEventListener('pointercancel', rEnd);
  holdBtn($('#r-duck'), () => { G.runner.setDuck(true); fadeHelp(); }, () => G.runner.setDuck(false));
  let helpT = null;
  function runHelp() { const h = $('.run-help'); h.classList.remove('fade'); clearTimeout(helpT); helpT = setTimeout(fadeHelp, 3500); }
  function fadeHelp() { $('.run-help').classList.add('fade'); }

  // ---------- keyboard (desktop testing) ----------
  const keys = {};
  window.addEventListener('keydown', e => {
    if (keys[e.code]) return; keys[e.code] = true; G.audio.unlock();
    if (screen === 'runner') { if (e.code === 'Space' || e.code === 'ArrowUp') G.runner.jump(); if (e.code === 'ArrowDown') G.runner.setDuck(true); }
    if (screen === 'island') { if (e.code === 'Space') G.input.bite = true; if (e.code === 'KeyR') G.input.roar = true; }
    keyAxes();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; if (screen === 'runner' && e.code === 'ArrowDown') G.runner.setDuck(false); keyAxes(); });
  function keyAxes() {
    if (screen !== 'island' || joyId !== null) return;
    G.input.jx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    G.input.jy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    G.input.sprint = !!(keys.ShiftLeft || keys.ShiftRight);
  }

  // ---------- HUD refresh ----------
  const hpF = $('#hud-island .hp .fill'), foodF = $('#hud-island .food .fill'), xpF = $('#hud-island .xp .fill'), starsEl = $('#hud-island .stars');
  const ring = $('#a-sprint .ring circle'), roarB = $('#a-roar'), mini = $('#minimap').getContext('2d');
  let lastStage = -1, lastHearts = -1, miniT = 0;
  function hudIsland(dt) {
    const h = G.island.hud();
    hpF.style.width = h.hp + '%'; foodF.style.width = h.hunger + '%';
    const lo = G.STAGES[h.stage].xp, hi = h.stage < 2 ? G.STAGES[h.stage + 1].xp : lo;
    xpF.style.width = (h.stage < 2 ? ((h.xp - lo) / (hi - lo)) * 100 : 100) + '%';
    if (h.stage !== lastStage) { lastStage = h.stage; starsEl.innerHTML = [0, 1, 2].map(i => '<i data-icon="' + (i <= h.stage ? 'star' : 'starOff') + '"></i>').join(''); icons(starsEl); }
    ring.style.strokeDashoffset = 289 * (1 - h.stamina / 100);
    roarB.classList.toggle('cool', h.roarCD > 0);
    hpF.parentNode.parentNode.style.animation = h.hunger <= 0 ? 'bob .3s infinite alternate' : '';
    miniT -= dt; if (miniT <= 0) { miniT = 0.1; G.island.drawMinimap(mini); }
  }
  function hudRunner() {
    const h = G.runner.hud(); if (!h) return;
    $('#r-score').textContent = h.score;
    if (h.hearts !== lastHearts) { lastHearts = h.hearts; const el = $('#hud-run .hearts'); el.innerHTML = ''; for (let i = 0; i < h.max; i++) el.innerHTML += '<i data-icon="' + (i < 3 ? 'heart' : 'shield') + '" class="' + (i < h.hearts ? '' : 'empty') + '"></i>'; icons(el); }
  }

  // ---------- title scene ----------
  function drawTitle(c, dt) {
    titleT += dt; if (titleRoar > 0) titleRoar -= dt;
    const w = G.vw, h = G.vh;
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#48cae4'); g.addColorStop(0.65, '#ade8f4'); g.addColorStop(1, '#caf0f8');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(w * 0.85, h * 0.16, Math.min(w, h) * 0.08, 0, Math.PI * 2); c.fill();
    const base = h * 0.78;
    // volcano
    const vx = w * 0.2, vs = Math.min(w, h) / 400;
    c.fillStyle = '#7d6b91'; c.beginPath(); c.moveTo(vx - 200 * vs, base); c.lineTo(vx - 35 * vs, base - 190 * vs); c.lineTo(vx + 35 * vs, base - 190 * vs); c.lineTo(vx + 200 * vs, base); c.fill();
    c.fillStyle = '#ff7b39'; c.beginPath(); c.moveTo(vx - 35 * vs, base - 190 * vs); c.lineTo(vx - 15 * vs, base - 150 * vs); c.lineTo(vx, base - 170 * vs); c.lineTo(vx + 18 * vs, base - 140 * vs); c.lineTo(vx + 35 * vs, base - 190 * vs); c.fill();
    for (let i = 0; i < 4; i++) { const tt = (titleT * 0.25 + i / 4) % 1; c.fillStyle = 'rgba(130,120,140,' + 0.5 * (1 - tt) + ')'; c.beginPath(); c.arc(vx + Math.sin(tt * 4 + i) * 12 * vs, base - (200 + tt * 140) * vs, (16 + tt * 30) * vs, 0, 7); c.fill(); }
    // hills
    c.fillStyle = '#80ed99'; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w + 20; x += 20) c.lineTo(x, base - 30 - Math.sin(x / 140 + 1) * 25); c.lineTo(w, h); c.fill();
    c.fillStyle = '#57cc99'; c.fillRect(0, base, w, h - base);
    c.fillStyle = '#38a3a5'; c.fillRect(0, base, w, 6);
    G.drawTree(c, w > h * 1.15 ? w * 0.66 : w * 0.92, base + 6, vs * 1.3, true, titleT, false);
    G.drawTree(c, w * 0.06, base + 8, vs * 1.1, false, titleT, false);
    // parade of unlocked friends in the background
    const un = G.DINOS.filter(d => G.isUnlocked(d.id) && d.id !== G.save.selected);
    un.forEach((d, i) => {
      const span = w + 400, x = ((titleT * 40 + i * (span / Math.max(1, un.length))) % span) - 200;
      const s = (vs * 0.45 * 88) / G.DINO_H[d.id] * (d.id === 'brachio' ? 1.5 : 1);
      G.drawShadow(c, x, base - 22 * vs, 30 * s, 0.15);
      G.drawDino(c, d.id, x, base - 22 * vs, s, 1, { t: titleT + i, m: 0.7, alpha: 0.85 });
    });
    // hero dino
    const id = G.save.selected, land = w > h * 1.15;
    // landscape: hero stands to the right of the buttons; portrait: centred between title and buttons
    const hs = land ? Math.min((h * 0.42) / G.DINO_H[id], (w * 0.26) / G.DINO_W[id]) : Math.min((h * 0.26) / G.DINO_H[id], (w * 0.7) / G.DINO_W[id]);
    const cx = land ? w * 0.83 : w / 2, hy = land ? base + 12 * vs : base - 6;
    const hx = cx + G.DINO_W[id] * hs * 0.1;
    heroBox = { x: cx, y: hy - G.DINO_H[id] * hs / 2, r: Math.max(G.DINO_W[id], G.DINO_H[id]) * hs * 0.6 };
    G.drawShadow(c, cx, hy, 50 * hs * (G.DINO_W[id] / 170) * 1.3, 0.25);
    const bounce = titleRoar > 0 ? Math.sin(titleRoar * 20) * 3 : 0;
    G.drawDino(c, id, hx + bounce, hy, hs, 1, { t: titleT, m: 0, jaw: titleRoar > 0 ? 0.65 : 0, roar: titleRoar > 0 });
  }

  // unlock popup canvas animation
  function drawUnlock(dt) {
    ulT += dt;
    const c = $('#ul-canvas').getContext('2d');
    c.clearRect(0, 0, 360, 240);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 + ulT * 0.5; c.fillStyle = i % 2 ? 'rgba(255,209,102,0.5)' : 'rgba(255,255,255,0.4)'; c.beginPath(); c.moveTo(180, 130); c.arc(180, 130, 260, a, a + 0.13); c.fill(); }
    const s = Math.min(200 / G.DINO_H[ulId], 300 / G.DINO_W[ulId]) * (1 + Math.max(0, 1 - ulT * 2) * -0.6);
    G.drawShadow(c, 180, 222, 60, 0.2);
    G.drawDino(c, ulId, 180 + G.DINO_W[ulId] * s * 0.12, 222 - Math.abs(Math.sin(ulT * 4)) * 10, s, 1, { t: ulT, m: 0.3, jaw: Math.sin(ulT * 3) > 0.6 ? 0.5 : 0 });
    ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#c77dff'].forEach((col, j) => { for (let i = 0; i < 6; i++) { const x = (i * 67 + j * 31 + ulT * 40 * (1 + j * 0.2)) % 360, y = (ulT * 90 * (1 + i * 0.1) + j * 47 + i * 23) % 240; c.fillStyle = col; c.fillRect(x, y, 7, 11); } });
  }

  // ---------- main loop ----------
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (screen === 'title' || screen === 'collection') drawTitle(ctx, dt);
    else if (screen === 'island') {
      if (!paused) G.island.update(dt);
      G.input.bite = G.input.roar = false;
      G.island.draw(ctx); hudIsland(dt);
    } else if (screen === 'runner') {
      if (!paused) G.runner.update(dt);
      G.runner.draw(ctx); hudRunner();
    }
    if (ulId) drawUnlock(dt);
  }

  // ---------- boot ----------
  G.load();
  icons(); muteIcons(); resize(); show('title');
  requestAnimationFrame(frame);
  window.addEventListener('pagehide', () => { if (screen === 'island') G.island.stop(); G.persist(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { G.persist(); resetInput(); } });
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    // auto-update: register without the HTTP cache, re-check on launch/return, reload once when a new version takes over
    var SW = navigator.serviceWorker, hadCtl = !!SW.controller, reloading = false;
    SW.addEventListener('controllerchange', function () {
      if (reloading || !hadCtl) return;
      var last = +(sessionStorage.getItem('ldw-sw-reload') || 0); if (Date.now() - last < 15000) return;
      reloading = true; sessionStorage.setItem('ldw-sw-reload', String(Date.now())); location.reload();
    });
    window.addEventListener('load', function () {
      SW.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
        var check = function () { reg.update().catch(function () {}); };
        check(); document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
      }).catch(function () {});
    });
  }
  G._screen = () => screen;
  G._show = show;
})(window.G);
