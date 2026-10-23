// Boot, renderer, adaptive quality, screens (title / play / garage / pause / results), HUD and the main loop.
import * as THREE from './vendor/three.bundle.min.js';
import { HDRLoader } from './vendor/three.bundle.min.js';
import { World, BASE, VOLC, ARENA } from './world.js';
import { FX } from './fx.js';
import { Game } from './game.js';
import { makeDino } from './game.js';
import { Input } from './input.js';
import { music } from './music.js';
import { Rider } from './rider.js';
import { DINOS, ROBOS, REALS, UPGRADES, MAX_UP, loadSave, writeSave, statsFor } from './data.js';
import { initAudio, setMuted, sfx } from './audio.js';
import { smokeTexture, glowTexture } from './proctex.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);

// ---------------- quality tiers ----------------
const TIERS = [
  { tier: 0, name: 'Low', pr: 1.0, shadow: 512, shadowR: 30, grass: 3200, grassR: 30, draw: 360, lodDist: 60, enemies: 4 },
  { tier: 1, name: 'Medium', pr: 1.3, shadow: 1024, shadowR: 36, grass: 6500, grassR: 40, draw: 460, lodDist: 90, enemies: 5 },
  { tier: 2, name: 'High', pr: 1.7, shadow: 2048, shadowR: 42, grass: 11000, grassR: 48, draw: 580, lodDist: 125, enemies: 6 },
  { tier: 3, name: 'Ultra', pr: 2.0, shadow: 2048, shadowR: 48, grass: 16000, grassR: 56, draw: 720, lodDist: 170, enemies: 7 },
];
const ua = navigator.userAgent;
const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isIPhone = /iPhone|iPod/.test(ua);
const isMobile = isIPad || isIPhone || /Android|Mobile/.test(ua);
let startTier = isIPhone ? 2 : isIPad ? 1 : isMobile ? 1 : ((navigator.hardwareConcurrency || 4) >= 8 ? 3 : 2);
const forced = params.has('q') ? Math.max(0, Math.min(3, +params.get('q'))) : null;
let autoQ = forced === null && params.get('auto') !== '0';
const targetFps = isIPad ? 40 : 52;
let Q = { ...TIERS[forced ?? startTier] };

const save = loadSave(); setMuted(save.muted);
const persist = () => writeSave(save);

// ---------------- renderer ----------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: (forced ?? startTier) >= 1, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.3, 1400);
const sun = new THREE.DirectionalLight(0xfff1dc, 3.6); sun.castShadow = true; scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a5a2a, 0.25); scene.add(hemi);
const sunDir = new THREE.Vector3(0.45, 0.62, 0.35).normalize();

function applyQuality(q) {
  Q = { ...q };
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr));
  sun.shadow.mapSize.set(Q.shadow, Q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  const c = sun.shadow.camera; c.left = c.bottom = -Q.shadowR; c.right = c.top = Q.shadowR; c.near = 1; c.far = 400; c.updateProjectionMatrix();
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  if (world) world.applyQuality(Q);
  if (fx) fx.setTier(Q.tier);
  if (game) game.quality = Q;
  $('p-quality').textContent = 'Graphics: ' + (autoQ ? 'Auto (' + Q.name + ')' : Q.name);
  resize();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 72 : 58; camera.updateProjectionMatrix();
  gCam.aspect = w / h; gCam.updateProjectionMatrix();
  checkRotate();
}
window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------------- loading ----------------
const assets = {};
const mgr = new THREE.LoadingManager();
mgr.onProgress = (u, l, t) => { $('load-bar').style.width = (l / t * 85) + '%'; };
const tl = new THREE.TextureLoader(mgr);
function tex(path, srgb = true) { const t = tl.load(path); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
assets.grass = tex('assets/tex/grass_diff.jpg'); assets.grassNor = tex('assets/tex/grass_nor.jpg', false);
assets.sand = tex('assets/tex/sand_diff.jpg'); assets.sandNor = tex('assets/tex/sand_nor.jpg', false);
assets.rock = tex('assets/tex/rock_diff.jpg'); assets.rockNor = tex('assets/tex/rock_nor.jpg', false);
assets.dirt = tex('assets/tex/dirt_diff.jpg');
assets.metalNor = tex('assets/tex/metal_nor.jpg', false); assets.metalRough = tex('assets/tex/metal_rough.jpg', false);
assets.smoke = smokeTexture(); assets.glow = glowTexture();
const skyTex = tl.load((forced ?? startTier) >= 2 ? 'assets/hdri/sky_4k.jpg' : 'assets/hdri/sky_2k.jpg', t => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; });
let hdr = null; new HDRLoader(mgr).setDataType(THREE.HalfFloatType).load('assets/hdri/sky_1k.hdr', t => { hdr = t; });

let world, fx, game, input, ready = false;
mgr.onLoad = () => { if (!ready) boot(); };

function boot() {
  ready = true; $('load-t').textContent = 'Waking up the robots…';
  // environment lighting from the CC0 HDRI, background from the matching sky photo
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(hdr).texture; pm.dispose();
  scene.environmentIntensity = 0.42;
  scene.background = skyTex; scene.backgroundIntensity = 1.0;
  // find the sun in the HDRI so shadows match the sky
  try { const img = hdr.image, d = img.data, W = img.width, H = img.height; let best = 0, bi = 0; const f = THREE.DataUtils.fromHalfFloat;
    for (let y = 0; y < H / 2; y += 2) for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4; const l = f(d[i]) + f(d[i + 1]) + f(d[i + 2]); if (l > best) { best = l; bi = y * W + x; } }
    const u = (bi % W) / W, v = Math.floor(bi / W) / H; const phi = (u - 0.5) * Math.PI * 2, th = (0.5 - v) * Math.PI;
    const el = Math.max(0.5, Math.min(1.05, th));
    sunDir.set(Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el)).normalize();
  } catch (e) { /* keep default */ }
  // fog colour = sky horizon colour
  const fogC = new THREE.Color(0xb6cde0);
  try { const im = skyTex.image, cv = document.createElement('canvas'); cv.width = 64; cv.height = 32; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, 64, 32); const px = g.getImageData(0, 15, 64, 2).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < px.length; i += 4) { r += px[i]; gg += px[i + 1]; b += px[i + 2]; } const n = px.length / 4; fogC.setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace); } catch (e) { }
  scene.fog = new THREE.Fog(fogC, 60, 900);
  world = new World(scene, assets, Q);
  fx = new FX(scene, assets, sfx);
  input = new Input(document.body);
  game = new Game({ renderer, scene, camera, world, fx, assets, save, input, hud, persist: () => persist(), quality: Q });
  game.startRoam();
  titleEnemies();
  applyQuality(Q);
  for (let i = 0; i < 130; i++) { emitSmoke(0.1); fx.update(0.1, world, () => { }, scene.fog); }
  renderer.compile(scene, camera);
  buildGarage();
  $('load-bar').style.width = '100%';
  setTimeout(() => { $('loading').classList.add('hidden'); show('title'); }, 150);
  requestAnimationFrame(loop);
}
// title: a real T-Rex and a robot face off and roar at each other in front of the volcano
const TITLE = { x: 16, z: 181 };
function titleEnemies() {
  game.clearEnemies(); const p = game.player;
  const rivalId = p.def.real ? 'rex' : 'trex';
  p.place(TITLE.x - 7.5, TITLE.z, Math.PI / 2 - 0.25);
  const r = game.spawnEnemy(TITLE.x + 7.5, TITLE.z - 1, 1, rivalId); r.yaw = -Math.PI / 2 + 0.25; r.ai.state = 'idle';
  const a = game.spawnEnemy(TITLE.x - 26, TITLE.z - 38, 1, 'raptor'); a.yaw = 0.6; a.ai.state = 'idle';
  const b = game.spawnEnemy(TITLE.x + 30, TITLE.z - 46, 1, 'trice'); b.yaw = -0.7; b.ai.state = 'idle';
  titleRoarT = 0.8; titleWho = 0;
}
let titleRoarT = 1, titleWho = 0;

// ---------------- HUD ----------------
let toastT = 0, bannerT = 0;
const hud = {
  toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); toastT = 1.8; },
  hurt() { const el = $('hurt'); el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 120); },
  bolts() { $('bolts').textContent = save.bolts; $('g-bolts').textContent = save.bolts; },
  knockedOut(real) { $('ko-sub').textContent = real ? 'Catching your breath at the base…' : 'Rebooting at the base…'; $('ko-msg').classList.remove('hidden'); },
  flash() { const el = $('flash'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); },
  roar() { document.body.classList.remove('roaring'); void document.body.offsetWidth; document.body.classList.add('roaring'); },
  actions(def) {
    const L = def.real ? { laser: 'BITE', missile: def.specialName, melee: (save.up.fire ? '🔥 ' : '') + 'ROAR', boost: 'RUN' } : { laser: 'LASER', missile: 'MISSILE', melee: def.breath ? 'FIRE<br>BREATH' : 'BITE<br>STOMP', boost: 'BOOST' };
    document.body.classList.toggle('breath', !!def.breath);
    for (const k in L) document.querySelector(`[data-btn="${k}"] span`).innerHTML = L[k];
    document.body.classList.toggle('real-dino', !!def.real);
  },
  revived() { $('ko-msg').classList.add('hidden'); hud.toast('Back in action!'); },
  banner(t, lvl = 1) { const el = $('banner'); el.textContent = t; el.className = 'lv' + lvl; void el.offsetWidth; el.classList.add('show'); bannerT = 1.6 + lvl * 0.2; },
  combo(n) { const el = $('combo'); if (n >= 3) { el.innerHTML = `<b>${n}</b> HIT COMBO`; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('show', 'pop'); } else el.classList.remove('show'); },
  victory() { music.victory(); },
  logoBoom() { const el = document.querySelector('#title .logo'); el.classList.remove('boom'); void el.offsetWidth; el.classList.add('boom'); },
  results(b, bonus) { $('r-text').innerHTML = `Wave reached: <b>${b.wave}</b><br>Robots knocked out: <b>${b.kos}</b><br>Bolts earned: <b>${b.bolts}</b> (incl. ${bonus} bonus)<br>Best ever: <b>${save.bestBattle}</b> KOs`; show('results'); $('ko-msg').classList.add('hidden'); },
};
const ebarEls = [];
function updateHUD(dt) {
  const p = game.player; if (!p) return;
  $('hp').style.width = (p.hp / p.maxHp * 100) + '%'; $('hp-t').textContent = Math.ceil(p.hp);
  $('boost').style.width = (p.boostE / p.st.boost * 100) + '%';
  $('mcd').style.setProperty('--p', Math.max(0, p.missileT / p.st.missileCD * 100) + '%');
  $('rcd').style.setProperty('--p', p.real ? Math.max(0, p.meleeT / p.st.roarCD * 100) + '%' : p.def.breath ? Math.max(0, p.meleeT / 3 * 100) + '%' : '0%');
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('show'); }
  const gb = game.battle, boss = gb && gb.boss && gb.boss.alive ? gb.boss : null; $('boss').classList.toggle('hidden', !boss);
  if (boss) { $('boss-name').textContent = boss.def.name; $('boss-hp').style.width = (boss.hp / boss.maxHp * 100) + '%'; }
  const b = game.battle;
  $('hud-tc').classList.toggle('hidden', !b);
  if (b) { const t = Math.max(0, Math.ceil(b.t)); $('timer').textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); $('wave').textContent = `Wave ${b.wave} · KOs ${b.kos}`; }
  // enemy health bars
  const W = window.innerWidth, H = window.innerHeight, v = new THREE.Vector3(); let n = 0;
  for (const e of game.enemies) { if (!e.alive || n >= 8) continue; if (e.pos.distanceTo(p.pos) > 70) continue;
    v.set(e.pos.x, e.pos.y + e.mech.height * 1.08 + 0.6, e.pos.z).project(camera); if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
    let el = ebarEls[n]; if (!el) { el = document.createElement('div'); el.className = 'ebar'; el.innerHTML = '<b></b><i></i>'; $('ebars').appendChild(el); ebarEls[n] = el; }
    el.style.display = 'block'; el.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px)`; el.lastChild.style.width = (e.hp / e.maxHp * 100) + '%'; el.firstChild.textContent = 'L' + e.level; n++; }
  for (let i = n; i < ebarEls.length; i++) ebarEls[i].style.display = 'none';
  drawRadar(p);
}
const rc = $('radar').getContext('2d');
function drawRadar(p) {
  const S = 220, R = 105, scale = R / 120, yaw = game.cam.yaw; rc.clearRect(0, 0, S, S);
  rc.save(); rc.translate(S / 2, S / 2); rc.beginPath(); rc.arc(0, 0, R, 0, 7); rc.clip();
  const dot = (x, z, col, r) => { const dx = (x - p.pos.x) * scale, dz = (z - p.pos.z) * scale; const c = Math.cos(-yaw + Math.PI), s = Math.sin(-yaw + Math.PI);
    let rx = dx * c - dz * s, ry = dx * s + dz * c; const L = Math.hypot(rx, ry); if (L > R - 6) { rx *= (R - 6) / L; ry *= (R - 6) / L; } rc.fillStyle = col; rc.beginPath(); rc.arc(-rx, -ry, r, 0, 7); rc.fill(); };
  rc.strokeStyle = 'rgba(255,255,255,.15)'; rc.lineWidth = 2; rc.beginPath(); rc.arc(0, 0, R * 0.5, 0, 7); rc.stroke();
  dot(VOLC.x, VOLC.z, '#ff7a2a', 9); dot(ARENA.x, ARENA.z, '#ffd34a', 7); dot(BASE.x, BASE.z, '#3de8ff', 9);
  for (const k of game.pickups) if (k.alive && k.type === 'core') dot(k.x, k.z, 'rgba(120,240,255,.8)', 3);
  for (const e of game.enemies) if (e.alive) dot(e.pos.x, e.pos.z, '#ff3a2a', 6);
  rc.restore();
  rc.fillStyle = '#fff'; rc.beginPath(); rc.moveTo(S / 2, S / 2 - 12); rc.lineTo(S / 2 + 8, S / 2 + 8); rc.lineTo(S / 2 - 8, S / 2 + 8); rc.fill();
}

// ---------------- screens ----------------
let screen = 'loading', paused = false;
let prevScreen = 'loading';
function show(s) {
  prevScreen = screen; screen = s;
  for (const id of ['title', 'garage', 'pause', 'results']) $(id).classList.toggle('hidden', id !== s);
  const playing = s === 'play';
  $('hud').classList.toggle('hidden', !(playing || s === 'pause' || s === 'results'));
  document.body.classList.toggle('playing', playing);
  if (input) { input.enabled = playing; input.reset(); }
  if (s === 'title') { $('title-bolts').innerHTML = `<span class="nut">⬢</span> ${save.bolts} bolts · ${save.owned.length}/${DINOS.length} dinos`; }
  if (s === 'garage') { if (prevScreen !== 'garage') syncGarageToSelected(); refreshGarage(); }
  if (s === 'title' && game) game.mh.titleEnter();
  hud.bolts(); checkRotate(); fpsReset(); syncMusic();
}
function syncMusic() {
  const b = game && game.battle;
  const t = screen === 'title' || screen === 'garage' || screen === 'loading' ? 'title' : b ? (b.boss && b.boss.alive ? 'boss' : 'battle') : 'roam';
  music.play(t);
}
let rotateDismissed = false;
function checkRotate() { const portrait = window.innerHeight > window.innerWidth * 1.05; $('rotate').classList.toggle('hidden', !(portrait && !rotateDismissed && (screen === 'play' || screen === 'title'))); }
$('rot-ok').addEventListener('click', () => { rotateDismissed = true; checkRotate(); });
const tap = (id, fn) => $(id).addEventListener('click', e => { initAudio(); sfx.ui(); fn(e); });
tap('b-roam', () => { game.startRoam(); show('play'); hud.toast('Find energy cores ⚡ and wild dinos!'); });
tap('b-battle', () => { game.startBattle(); show('play'); });
tap('b-garage', () => { garageFrom = 'title'; show('garage'); });
tap('b-pause', () => show('pause'));
tap('p-resume', () => show('play'));
tap('p-garage', () => { garageFrom = 'pause'; show('garage'); });
tap('p-home', () => { if (game.battle && !game.battle.over) game.battle = null; game.startRoam(); titleEnemies(); show('title'); });
tap('r-ok', () => { game.startRoam(); show('play'); });
const soundLabel = () => { $('b-sound').textContent = save.muted ? '🔇' : '🔊'; $('p-sound').textContent = save.muted ? '🔇 Sound off' : '🔊 Sound on'; };
const toggleSound = () => { save.muted = !save.muted; setMuted(save.muted); persist(); soundLabel(); };
tap('b-sound', toggleSound); tap('p-sound', toggleSound); soundLabel();
const musicLabel = () => { $('b-music').classList.toggle('off', !save.music); $('b-music').setAttribute('aria-label', save.music ? 'Music on' : 'Music off'); $('p-music').textContent = save.music ? '🎵 Music on' : '🎵 Music off'; };
const toggleMusic = () => { save.music = !save.music; music.setEnabled(save.music); persist(); musicLabel(); };
const rideLabel = () => { for (const id of ['g-ride', 'p-ride']) { $(id).textContent = '🧒 Leandro rides: ' + (save.ride !== false ? 'ON' : 'OFF'); $(id).classList.toggle('off', save.ride === false); } };
const toggleRide = () => { save.ride = save.ride === false; persist(); rideLabel(); game.mountRider(); if (gMech) { if (save.ride) gRider.mount(gMech); else gRider.unmount(); } if (save.ride && game.rider.mounted) game.rider.wave(1.5); };
tap('g-ride', toggleRide); tap('p-ride', toggleRide); rideLabel();
tap('b-music', toggleMusic); tap('p-music', toggleMusic); music.setEnabled(save.music !== false); musicLabel();
tap('p-quality', () => { if (autoQ) { autoQ = false; applyQuality(TIERS[0]); } else if (Q.tier < 3) applyQuality(TIERS[Q.tier + 1]); else { autoQ = true; applyQuality(TIERS[startTier]); } });
document.addEventListener('gesturestart', e => e.preventDefault()); document.addEventListener('dblclick', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (!e.target.closest('.g-panel')) e.preventDefault(); }, { passive: false });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'play') show('pause'); });

// ---------------- garage ----------------
const gScene = new THREE.Scene(), gCam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
const GARAGE_YAW = 1.5; // ~3/4 front view (camera sits at yaw 0.67)
let gIdx = 0, gMech = null, garageFrom = 'title', gTab = 'robo', gList = 'robo';
const gListOf = () => gList === 'real' ? REALS : ROBOS;
const gMechs = {}, gRider = new Rider();
function buildGarage() {
  gScene.background = new THREE.Color(0x0b1520); gScene.environment = scene.environment; gScene.environmentIntensity = 0.7;
  gScene.fog = new THREE.Fog(0x0b1520, 20, 60);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.4, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x14181d, metalness: 0.6, roughness: 0.5, normalMap: assets.metalNor, envMapIntensity: 0.12 }));
  floor.position.y = -0.25; floor.receiveShadow = true; gScene.add(floor); gScene.userData.floor = floor;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.07, 6, 64), new THREE.MeshBasicMaterial({ color: 0x3de8ff, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; gScene.add(ring); gScene.userData.ring = ring;
  const grid = new THREE.GridHelper(80, 40, 0x1f5a70, 0x15303e); grid.position.y = -0.5; gScene.add(grid);
  const key = new THREE.SpotLight(0xffffff, 500, 70, 0.7, 0.6, 1.4); key.position.set(10, 16, 14); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); gScene.add(key, key.target);
  const rim = new THREE.SpotLight(0x3de8ff, 600, 60, 0.7, 0.6, 1.6); rim.position.set(-10, 8, -10); gScene.add(rim, rim.target);
  const fill = new THREE.HemisphereLight(0xa0c8ff, 0x202020, 0.55); gScene.add(fill);
  const rim2 = new THREE.SpotLight(0xff5a1a, 700, 60, 0.7, 0.6, 1.6); rim2.position.set(12, 7, -11); gScene.add(rim2, rim2.target);
  syncGarageToSelected();
}
function syncGarageToSelected() { const d = DINOS.find(d => d.id === save.selected) || ROBOS[0]; gList = d.real ? 'real' : 'robo'; gTab = gList; gIdx = Math.max(0, gListOf().indexOf(d)); }
function setGarageMech() {
  const def = gListOf()[gIdx]; if (gMech) gScene.remove(gMech.obj);
  gMech = gMechs[def.id] || (gMechs[def.id] = makeDino(def, assets, false)); gScene.add(gMech.obj);
  gMech.obj.position.set(0, 0, 0); if (def.fly) gMech.obj.position.y = 1.2;
  if (save.ride !== false) gRider.mount(gMech); else gRider.unmount();
}
function refreshGarage() {
  if (gTab !== 'ups') gList = gTab;
  const list = gListOf(); gIdx = Math.min(gIdx, list.length - 1); const def = list[gIdx]; setGarageMech();
  const owned = save.owned.includes(def.id), st = statsFor(def, save.up);
  $('g-name').textContent = def.name; $('g-desc').textContent = def.desc + (def.fly ? ' ✈' : '') + (def.swim ? ' 🌊' : '');
  $('g-abil').innerHTML = def.real ? `<b>Bite</b> · <b>${def.specialName.replace('<br>', ' ')}</b> · <b>Roar</b> (stuns) · <b>Run</b>` : `<b>Laser</b> · <b>Missiles</b> · <b>Bite/Stomp</b> · <b>Boost</b>`;
  const bars = def.real ? [['Health', st.hp / 400], ['Speed', st.speed / 20], ['Bite', st.bite / (st.rate * 80)], ['Special', 3 / st.missileCD], ['Roar', st.roar / 3]]
    : [['Health', st.hp / 400], ['Speed', st.speed / 20], ['Laser', st.laser * (0.2 / st.rate) / 25], ['Missiles', st.missiles / 11], ['Bite', st.melee / 80]];
  $('g-stats').innerHTML = bars.map(([n, v]) => `<div class="stat"><span>${n}</span><div class="sb"><i style="width:${Math.min(100, v * 100)}%"></i></div></div>`).join('');
  const a = $('g-action');
  a.textContent = save.selected === def.id ? '✓ Your dino' : 'Play as ' + def.name; a.disabled = save.selected === def.id; a.className = 'btn primary';
  $('g-dots').innerHTML = list.map((d, i) => `<i class="${save.owned.includes(d.id) ? 'own' : ''} ${i === gIdx ? 'cur' : ''}"></i>`).join('');
  $('g-ups').innerHTML = UPGRADES.map(u => { const l = save.up[u.id]; return `<div class="up"><span class="ic">${u.icon}</span><div><h4>${u.name}</h4><p>${u.desc}</p><span class="pips">${'●'.repeat(l)}${'○'.repeat(MAX_UP - l)}</span> <small class="lvl">Level ${l}/${MAX_UP}</small></div>
    <span class="upb"><button data-up="${u.id}" data-d="-1" ${l <= 0 ? 'disabled' : ''} aria-label="less">−</button><button data-up="${u.id}" data-d="1" ${l >= MAX_UP ? 'disabled' : ''} aria-label="more">+</button></span></div>`; }).join('');
  $('g-dino').classList.toggle('hidden', gTab === 'ups'); $('g-ups').classList.toggle('hidden', gTab !== 'ups');
  for (const t of ['real', 'robo', 'ups']) $('t-' + t).classList.toggle('on', gTab === t);
  $('g-prev').parentElement.classList.toggle('hidden', gTab === 'ups');
  hud.bolts();
}
tap('g-prev', () => { const n = gListOf().length; gIdx = (gIdx + n - 1) % n; refreshGarage(); });
tap('g-next', () => { gIdx = (gIdx + 1) % gListOf().length; refreshGarage(); });
tap('t-real', () => { if (gList !== 'real') gIdx = 0; gTab = 'real'; refreshGarage(); }); tap('t-robo', () => { if (gList !== 'robo') gIdx = 0; gTab = 'robo'; refreshGarage(); });
tap('t-ups', () => { gTab = 'ups'; refreshGarage(); });
tap('g-back', () => { if (garageFrom === 'pause') { if (game.player.def.id !== save.selected) { const hp = game.player.hp / game.player.maxHp; const pos = game.player.pos.clone(), yaw = game.player.yaw; game.spawnPlayer(!!game.battle); game.player.place(pos.x, pos.z, yaw); } show('play'); } else { game.spawnPlayer(false); titleEnemies(); show('title'); } });
$('g-action').addEventListener('click', () => {
  initAudio(); const def = gListOf()[gIdx];
  if (save.owned.includes(def.id)) { save.selected = def.id; sfx.ui(); gMech.roar = 1.6; sfx.bigRoar(def.real ? 1.1 - def.scale * 0.25 : 1.3 - def.scale * 0.3, def.real ? 1 : 0.6, !def.real); }
  else { save.owned.push(def.id); save.selected = def.id; sfx.unlock(); }
  persist(); refreshGarage();
});
$('g-ups').addEventListener('click', e => { const b = e.target.closest('button[data-up]'); if (!b) return; initAudio(); const id = b.dataset.up, l = save.up[id], n = Math.max(0, Math.min(MAX_UP, l + (+b.dataset.d || 1)));
  if (n !== l) { save.up[id] = n; persist(); n > l ? sfx.unlock() : sfx.ui(); if (game.player) { const p = game.player; const f = p.hp / p.maxHp; p.st = statsFor(p.def, save.up); p.maxHp = p.st.hp; p.hp = p.maxHp * f; } } else sfx.deny(); refreshGarage(); });

// ---------------- adaptive quality ----------------
let fpsAcc = 0, fpsN = 0, fpsWarm = 0, goodWindows = 0, lastDrop = -1e9, measured = 60; const dropped = new Set();
function fpsReset() { fpsAcc = 0; fpsN = 0; fpsWarm = 1.5; }
function fpsTick(dt, now) {
  if (fpsWarm > 0) { fpsWarm -= dt; return; }
  fpsAcc += dt; fpsN++;
  if (fpsAcc < 2.5) return;
  measured = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
  if (!autoQ) return;
  if (measured < targetFps && Q.tier > 0) { dropped.add(Q.tier); lastDrop = now; goodWindows = 0; applyQuality(TIERS[Q.tier - 1]); fpsWarm = 2; }
  else if (measured > 58 && Q.tier < 3 && !dropped.has(Q.tier + 1) && now - lastDrop > 30000) { if (++goodWindows >= 3) { goodWindows = 0; applyQuality(TIERS[Q.tier + 1]); fpsWarm = 2; } }
  else goodWindows = 0;
}

// ---------------- loop ----------------
let last = performance.now(), smokeT = 0, titleT = 0, frames = 0, cpuMs = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1; if (dt <= 0) return;
  frames++;
  fpsTick(dt, now);
  if (screen === 'garage') {
    titleT += dt; { const tall = gMech.def.kind === 'bronto' || gMech.def.kind === 'brachio'; gMech.obj.rotation.y = GARAGE_YAW - (tall ? 0.45 : 0) + Math.sin(titleT * 0.35) * (tall ? 0.3 : 0.55); } gMech.animate(dt, 0, { jaw: gMech.roar > 0 ? 1 : 0, roar: gMech.roar > 0.3 ? Math.min(1, gMech.roar) : 0, flying: gMech.def.fly });
    if (!gMech.roarT || titleT > gMech.roarT) { gMech.roarT = titleT + 6 + Math.random() * 3; if (gMech.roarT > 7) gMech.roar = 1.6; }
    gMech.roar = Math.max(0, (gMech.roar || 0) - dt); if (gRider.mounted) gRider.update(dt, { speedNow: 0, roar: gMech.roar, turn: 0 }); if (gMech.def.fly) gMech.obj.position.y = 1.5 + Math.sin(titleT * 2) * 0.2;
    const W = window.innerWidth, H = window.innerHeight, portrait = H > W, h = gMech.height, R = Math.max(gMech.fitR, 6);
    const t = Math.tan(THREE.MathUtils.degToRad(gCam.fov / 2)), dist = R / (portrait ? t * gCam.aspect * 1.0 : Math.min(t * 0.95, t * gCam.aspect * 0.52)) * (portrait ? 1.0 : 0.8) + 2;
    const tall = gMech.def.kind === 'bronto' || gMech.def.kind === 'brachio', cy = h * (tall ? 0.85 : 0.5) + (gMech.def.fly ? 1.2 : 0);
    gCam.position.set(dist * 0.62, cy + dist * (gMech.def.fly ? 0.62 : 0.28), dist * 0.78); gCam.lookAt(0, cy, 0);
    gCam.setViewOffset(W, H, portrait ? 0 : (0.5 - 0.28) * W, portrait ? (0.5 - 0.3) * H : 0, W, H);
    gScene.userData.ring.material.color.setHSL(gMech.real ? 0.06 : 0.52, 1, 0.5 + 0.2 * Math.sin(titleT * 3));
    renderer.render(gScene, gCam); return;
  }
  const c0 = performance.now();
  const inp = input.read();
  const real = dt; if (game.slowmo > 0) { game.slowmo -= dt; dt *= 0.28; }
  syncMusic();
  if (screen === 'play') { game.update(dt, inp); updateHUD(real); }
  else if (screen === 'title') {
    titleT += dt; const p = game.player, rival = game.enemies[0];
    p.updateVisual(dt); for (const e of game.enemies) e.updateVisual(dt); game.rider.update(dt, p); if (game.rider.mounted && game.rider.waveT <= 0 && Math.random() < dt * 0.25) game.rider.wave(2.2);
    titleRoarT -= dt;
    if (titleRoarT <= 0 && rival) { const who = titleWho++ % 2 ? rival : p; who.roar = 1.7; who.jaw = 1; titleRoarT = 3.6; fx.shake = Math.max(fx.shake, 0.35); fx.roarWave(game.mouthPos(who), who.forward(new THREE.Vector3()), who.def.scale, who.mech.mats.glowColor); sfx.bigRoar(who.real ? 0.85 : 1, 0.5, !who.real);
      if (who.real) game.mh.fieryRoar(who, false); else if (who.def.breath) game.mh.startBreath(who, 1.1); }
    game.mh.safe = true; for (const d of [p, ...game.enemies]) if (d.breathT > 0) game.mh.updateBreath(d, dt);
    game.mh.updateTitle(dt);
    const W = window.innerWidth, H = window.innerHeight, asp = W / H, mid = new THREE.Vector3(TITLE.x, p.pos.y, TITLE.z);
    const a = Math.sin(titleT * 0.12) * 0.22, r = (asp < 1 ? 28 : asp < 1.5 ? 17.5 : 15.5) + Math.sin(titleT * 0.2) * 1.0;
    camera.position.set(mid.x + Math.sin(a) * r, 0, mid.z + Math.cos(a) * r);
    camera.position.y = Math.max(mid.y + 3.0, world.height(camera.position.x, camera.position.z) + 3.0);
    camera.lookAt(mid.x, mid.y + (asp < 1 ? 6.0 : 4.4), mid.z - 4);
    if (fx.shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake, 0));
    game.updatePickups(dt);
  } else if (screen === 'pause' || screen === 'results') { /* frozen world */ }
  // volcano smoke plume
  if (screen !== 'pause') {
    emitSmoke(dt);
    world.update(dt, camera.position, { x: game.player.pos.x, z: game.player.pos.z, scale: game.player.def.scale });
    fx.update(dt, world, (M, p) => game.onMissileHit(M, p), scene.fog);
  }
  // shadow camera follows the action
  const P = game.player.pos; sun.target.position.set(P.x, P.y, P.z); sun.position.copy(P).addScaledVector(sunDir, 150);
  const c1 = performance.now(); cpuMs += ((c1 - c0) - cpuMs) * 0.05;
  renderer.render(scene, camera);
}

function emitSmoke(dt) {
  smokeT -= dt;
  while (smokeT < 0) { smokeT += 0.1; const o = world.smokeOrigin; const g = 0.13 + Math.random() * 0.12;
    fx.smoke.spawn({ pos: new THREE.Vector3(o.x + (Math.random() - 0.5) * 10, o.y, o.z + (Math.random() - 0.5) * 10), vel: { x: 2.5 + Math.random() * 1.5, y: 8 + Math.random() * 4, z: -0.8 + Math.random() }, size: 20, size1: 110, life: 15, r: g, g, b: g * 1.03, alpha: 0.9, alpha1: 0, drag: 0.03, rv: (Math.random() - 0.5) * 0.2, fadeIn: 0.04 });
    if (Math.random() < 0.35) fx.fire.spawn({ pos: new THREE.Vector3(o.x + (Math.random() - 0.5) * 8, o.y + 1, o.z + (Math.random() - 0.5) * 8), vel: { x: 0, y: 4, z: 0 }, size: 9, size1: 16, life: 1.2, r: 2.2, g: 0.6, b: 0.1, alpha: 0.6 });
    if (Math.random() < 0.3) fx.glow.spawn({ pos: new THREE.Vector3(o.x, o.y + 2, o.z), vel: { x: (Math.random() - 0.5) * 8, y: 10 + Math.random() * 8, z: (Math.random() - 0.5) * 8 }, size: 3, size1: 0.6, life: 1.4, r: 2.6, g: 0.9, b: 0.2, alpha: 1, grav: 9 });
  }
}
// ---------------- offline ----------------
if ('serviceWorker' in navigator && location.protocol !== 'file:') { window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { })); }

// test / debug hooks (no network, local only)
function simulate(sec, dt0 = 1 / 30) { for (let t = 0; t < sec; t += dt0) { let dt = dt0; if (game.slowmo > 0) { game.slowmo -= dt; dt *= 0.28; } const inp = input.read(); if (screen === 'play') game.update(dt, inp); else if (screen === 'title') { game.mh.safe = true; for (const d of [game.player, ...game.enemies]) { if (d.breathT > 0) game.mh.updateBreath(d, dt); d.updateVisual(dt); } game.mh.updateTitle(dt); } emitSmoke(dt); world.update(dt, camera.position, { x: game.player.pos.x, z: game.player.pos.z, scale: game.player.def.scale }); fx.update(dt, world, (M, p) => game.onMissileHit(M, p), scene.fog); } if (screen === 'play') updateHUD(dt0); }
window.G = { defs: () => DINOS, get gRider() { return gRider; }, get gCam() { return gCam; }, Rider, music, get mh() { return game.mh; }, sim: simulate, get game() { return game; }, get save() { return save; }, get screen() { return screen; }, get quality() { return Q; }, get fps() { return measured; }, get frames() { return frames; }, get cpuMs() { return cpuMs; }, show, garage: (i, tab) => { const d = typeof i === 'string' ? DINOS.find(x => x.id === i) : DINOS[i]; garageFrom = 'title'; show('garage'); gList = d.real ? 'real' : 'robo'; gTab = tab || gList; gIdx = gListOf().indexOf(d); refreshGarage(); }, applyQuality: t => { autoQ = false; applyQuality(TIERS[t]); }, TIERS, renderer, THREE };
