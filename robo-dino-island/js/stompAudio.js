// Stompolis rock theme and arcade hits. HTML audio so iPad Safari can unlock on the first tap.
import { isMuted } from './audio.js';

const THEMES = { stomp: 'audio/swing-theme.mp3', farm: 'audio/farm-theme.mp3', jungle: 'audio/jungle-theme.mp3' };
const SFX = {
  swing: 'audio/sfx-swing.mp3', zip: 'audio/sfx-zip.mp3', coin: 'audio/sfx-coin.mp3', wrap: 'audio/sfx-wrap.mp3', win: 'audio/sfx-win.mp3',
  roar: 'audio/sfx-dino-roar.mp3', fart: 'audio/sfx-fart.mp3', plop: 'audio/sfx-poop-plop.mp3',
};

const theme = new Audio();
theme.loop = true;
theme.preload = 'auto';
theme.volume = 0.55;
theme.setAttribute('data-stomp-theme', '1');
const mount = () => { if (document.body && !theme.parentNode) document.body.appendChild(theme); };
if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

let wantLevel = '';
const pools = {};

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
  if (url && !isMuted()) {
    theme.dataset.level = wantLevel;
    if (!theme.src || !theme.src.endsWith(url)) { theme.src = url; theme.loop = true; }
    theme.volume = 0.55;
    if (theme.paused) { const p = theme.play(); if (p && p.catch) p.catch(() => {}); }
  } else { theme.dataset.level = ''; if (!theme.paused) theme.pause(); }
}

for (const ev of ['touchstart', 'pointerdown', 'click']) {
  document.addEventListener(ev, () => applyTheme(), { capture: true });
}

export const stompAudio = {
  sync(level) { wantLevel = THEMES[level] ? level : ''; applyTheme(); },
  setMuted() { applyTheme(); },
  swing() { playUrl(SFX.swing, 0.7); },
  zip() { playUrl(SFX.zip, 0.75); },
  coin() { playUrl(SFX.coin, 0.65); },
  wrap() { playUrl(SFX.wrap, 0.8); },
  win() { playUrl(SFX.win, 0.85); },
  roar() { playUrl(SFX.roar, 0.8); },
  fart() { playUrl(SFX.fart, 0.75); },
  plop() { playUrl(SFX.plop, 0.7); },
  get theme() { return theme; },
};
