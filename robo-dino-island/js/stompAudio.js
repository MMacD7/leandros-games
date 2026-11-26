// Stompolis rock theme and arcade hits. HTML audio so iPad Safari can unlock on the first tap.
import { isMuted } from './audio.js';
import { voice } from './voice.js';

const THEMES = { stomp: 'audio/swing-theme.mp3', farm: 'audio/farm-theme.mp3', jungle: 'audio/jungle-theme.mp3', ocean: 'audio/deepsea-theme.mp3' };
const SFX = {
  swing: 'audio/sfx-swing.mp3', zip: 'audio/sfx-zip.mp3', coin: 'audio/sfx-coin.mp3', wrap: 'audio/sfx-wrap.mp3', win: 'audio/sfx-win.mp3',
  roar: 'audio/sfx-dino-roar.mp3', fart: 'audio/sfx-fart.mp3', plop: 'audio/sfx-poop-plop.mp3',
  torpedo: 'audio/sfx-torpedo.mp3', chomp: 'audio/sfx-chomp-water.mp3', sonar: 'audio/sfx-sonar-boost.mp3',
};
const POOP_MP3 = 'audio/voice-ricky-bobby-poop.mp3';

const theme = new Audio();
theme.loop = true;
theme.preload = 'auto';
theme.volume = 0.55;
theme.setAttribute('data-stomp-theme', '1');
const mount = () => { if (document.body && !theme.parentNode) document.body.appendChild(theme); };
if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

let wantLevel = '';
let musicOn = true;
let musicVol = 0.9;
const pools = {};
const poop = new Audio(POOP_MP3);
poop.preload = 'auto';
poop.volume = 1;

function pool(url) {
  let list = pools[url];
  if (!list) list = pools[url] = [0, 1, 2, 3].map(() => { const a = new Audio(url); a.preload = 'auto'; return a; });
  const a = list.find(x => x.paused || x.ended) || list[0];
  try { a.currentTime = 0; } catch (e) { /* iOS may reject a seek before the first play */ }
  return a;
}

function playUrl(url, vol) {
  if (isMuted() || !url) return;
  const a = pool(url);
  a.volume = vol;
  const p = a.play();
  if (p && p.catch) p.catch(() => {});
}

function applyTheme() {
  const url = THEMES[wantLevel];
  const audible = !!(url && !isMuted() && musicOn && musicVol > 0.01);
  if (audible) {
    theme.dataset.level = wantLevel;
    if (!theme.src || !theme.src.endsWith(url)) { theme.src = url; theme.loop = true; }
    theme.volume = 0.55 * musicVol;
    if (theme.paused) { const p = theme.play(); if (p && p.catch) p.catch(() => {}); }
  } else { theme.dataset.level = ''; if (!theme.paused) theme.pause(); }
}

let poopUnlocked = false;
function unlockPoop() {
  if (poopUnlocked || poop.dataset.live) return;
  poopUnlocked = true;
  const p = poop.play();
  if (p && p.then) p.then(() => { if (!poop.dataset.live) { poop.pause(); try { poop.currentTime = 0; } catch (e) { /* not seekable yet */ } } }).catch(() => {});
}
for (const ev of ['touchstart', 'pointerdown', 'click']) {
  document.addEventListener(ev, () => { applyTheme(); unlockPoop(); }, { capture: true });
}

export const stompAudio = {
  sync(level) { wantLevel = THEMES[level] ? level : ''; applyTheme(); },
  setMuted() { applyTheme(); },
  setMusic(on, vol) { musicOn = on !== false; if (vol != null) musicVol = Math.max(0, Math.min(1, vol)); applyTheme(); },
  swing() { playUrl(SFX.swing, 0.7); },
  zip() { playUrl(SFX.zip, 0.75); },
  coin() { playUrl(SFX.coin, 0.65); },
  wrap() { playUrl(SFX.wrap, 0.8); },
  win() { playUrl(SFX.win, 0.85); },
  roar() { playUrl(SFX.roar, 0.8); },
  fart() { playUrl(SFX.fart, 0.75); },
  plop() { playUrl(SFX.plop, 0.7); },
  torpedo() { playUrl(SFX.torpedo, 0.8); },
  chomp() { playUrl(SFX.chomp, 0.8); },
  sonar() { playUrl(SFX.sonar, 0.75); },
  // Real line. Returns 'played', 'muted', or 'fail' so speechSynthesis is only the fallback.
  poopLine() {
    if (isMuted()) return 'muted';
    poop.dataset.live = '1';
    try { poop.currentTime = 0; } catch (e) { /* seek can fail before the first successful play */ }
    poop.volume = 1;
    try {
      const p = poop.play();
      if (p && p.then) p.then(() => {}).catch(() => { poop.dataset.live = ''; voice.say("Look, it's Ricky and Bobby, they are going to poop!", { prio: 3, cd: 0, pitch: 1.1, rate: 1.0, replace: true }); });
      return 'played';
    } catch (e) {
      poop.dataset.live = '';
      voice.say("Look, it's Ricky and Bobby, they are going to poop!", { prio: 3, cd: 0, pitch: 1.1, rate: 1.0, replace: true });
      return 'fail';
    }
  },
  get theme() { return theme; },
};
