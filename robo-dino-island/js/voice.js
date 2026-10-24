// Hype announcer: offline voice callouts via the browser's built-in speechSynthesis (no network, no audio files).
// A small priority queue with rate limiting so it never spams; music ducks while the announcer talks.
// iOS Safari only allows speech after a user gesture, so prime() is called on the first tap.
import { duck } from './audio.js';

const SS = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
const U = typeof window !== 'undefined' ? window.SpeechSynthesisUtterance : null;
let enabled = true, primed = false, vox = null, busy = false, lastT = -1e9, q = [], curPrio = 0;
const lastSaid = new Map();
const MIN_GAP = 1400, SAME_CD = 5000, MAX_Q = 3;
const stats = { said: 0, dropped: 0, queued: 0, errors: 0, log: [] };

// iOS reads ALL-CAPS words and stretched words ('RICKYYYY') letter by letter, so every line is turned into natural
// sentence-case speech here: '&' -> 'and', no 3+ repeated letters, caps words -> Capitalized, KO -> knockout, T-Rex -> T. rex.
const SPOKEN = { KO: 'knockout', KOS: 'knockouts', OK: 'okay' };
export function speakable(s) {
  let t = String(s).replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu, ' ').replace(/&/g, ' and ').replace(/\bT-?REX\b/gi, 'T. rex').replace(/([A-Za-z])\1{2,}/g, '$1');
  t = t.replace(/\b[A-Z][A-Z']+\b/g, w => SPOKEN[w] || (w[0] + w.slice(1).toLowerCase()));
  return t.replace(/([A-Za-z])-([A-Za-z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
}
function pickVoice() {
  if (!SS) return null; let vs = []; try { vs = SS.getVoices() || []; } catch (e) { return null; }
  const en = vs.filter(v => /^en/i.test(v.lang));
  // deep / energetic male-sounding voices first (names vary by platform), any English voice otherwise
  const pref = [/daniel/i, /aaron/i, /arthur/i, /fred/i, /alex/i, /ralph/i, /reed/i, /rocko/i, /grandpa/i, /google uk english male/i, /male/i, /david/i, /mark/i, /george/i, /james/i];
  for (const re of pref) { const v = en.find(v => re.test(v.name)); if (v) return v; }
  return en.find(v => v.localService) || en[0] || vs[0] || null;
}
if (SS) { try { SS.addEventListener ? SS.addEventListener('voiceschanged', () => { vox = pickVoice(); }) : (SS.onvoiceschanged = () => { vox = pickVoice(); }); } catch (e) { } }

function speakNow(item) {
  busy = true; curPrio = item.prio; lastT = performance.now(); stats.said++; stats.log.push(item.text); if (stats.log.length > 30) stats.log.shift();
  if (!SS || !U) { setTimeout(() => { busy = false; pump(); }, 900); return; } // graceful no-op: banners still show
  try {
    if (!vox) vox = pickVoice();
    const u = new U(item.text); if (vox) u.voice = vox; u.lang = vox ? vox.lang : 'en-US';
    u.pitch = item.pitch ?? 0.62; u.rate = item.rate ?? 1.06; u.volume = 1;
    const est = 600 + item.text.length * 70; duck(0.7, est / 1000 + 0.4);
    let done = false; const fin = () => { if (done) return; done = true; busy = false; setTimeout(pump, 150); };
    u.onend = fin; u.onerror = () => { stats.errors++; fin(); }; setTimeout(fin, est + 2500); // never stall the queue
    SS.speak(u);
  } catch (e) { stats.errors++; busy = false; }
}
function pump() {
  if (busy || !q.length) return;
  const wait = MIN_GAP - (performance.now() - lastT); if (wait > 0) { setTimeout(pump, wait + 10); return; }
  q.sort((a, b) => b.prio - a.prio); speakNow(q.shift());
}

export const voice = {
  get enabled() { return enabled; }, get supported() { return !!SS; }, stats,
  setEnabled(on) { enabled = !!on; if (!enabled) { q = []; try { SS && SS.cancel(); } catch (e) { } busy = false; } },
  // must run inside a user gesture on iOS: speak a silent utterance to unlock speechSynthesis
  prime() { if (primed || !SS || !U) return; primed = true; try { const u = new U(' '); u.volume = 0; SS.speak(u); vox = pickVoice(); } catch (e) { } },
  // prio: 1 normal, 2 important (boss / names), 3 top (LEANDRO WINS!) — top priority cuts in front
  say(text, o = {}) {
    if (!enabled || !text) return false; text = speakable(text); if (!text) return false; const now = performance.now(), prio = o.prio || 1;
    if (now - (lastSaid.get(text) || -1e9) < (o.cd ?? SAME_CD)) { stats.dropped++; return false; }
    if (q.length >= MAX_Q) { q.sort((a, b) => a.prio - b.prio); if (q[0].prio > prio) { stats.dropped++; return false; } q.shift(); stats.dropped++; }
    if (o.replace) q = q.filter(x => x.prio > prio);
    lastSaid.set(text, now); q.push({ text, prio, pitch: o.pitch, rate: o.rate }); stats.queued++;
    if (prio >= 3 && busy && SS && curPrio < 3) { try { SS.cancel(); } catch (e) { } busy = false; lastT = 0; }
    pump(); return true;
  },
  clear() { q = []; },
  speakable,
  get voiceName() { return vox ? vox.name : null; },
};
