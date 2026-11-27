// Optional, no-fail Jungle Island goals. Progress is saved locally. v5.19.0: 6 cycling missions and every
// Explorer Stamp now pays +25 bolts (earned in play only; the loop never asks for bolts or purchases).
import { ARENA, VOLC, FALLS } from './world.js';

export const STAMP_BOLTS = 25;
export const DECK = [
  { id: 'cores', title: 'Collect 3 energy cores', goal: 3 },
  { id: 'rings', title: 'Dash through 3 Volcano Turbo Rings', goal: 3 },
  { id: 'shrine', title: 'Charge up at the Waterfall Power Shrine', goal: 1 },
  { id: 'egg', title: 'Hatch a hidden dino egg', goal: 1 },
  { id: 'landmarks', title: 'Visit 2 island landmarks', goal: 2 },
  { id: 'rally', title: 'Start a Beacon Dino Rally (or KO 2 wild dinos)', goal: 2 },
];

const LANDMARKS = [
  { id: 'volcano', x: VOLC.x, z: VOLC.z, r: 34 },
  { id: 'waterfall', x: FALLS.x, z: FALLS.z, r: 26 },
  { id: 'arena', x: ARENA.x, z: ARENA.z, r: 30 },
];

export class Expedition {
  constructor(game) {
    this.g = game;
    const saved = game.save.expedition || {};
    this.state = game.save.expedition = {
      index: Math.max(0, (saved.index | 0) % DECK.length),
      progress: Math.max(0, saved.progress | 0),
      bolts: Math.max(0, saved.bolts | 0),
      stamps: Math.max(0, saved.stamps | 0),
      visited: Array.isArray(saved.visited) ? saved.visited.filter(x => LANDMARKS.some(l => l.id === x)) : [],
      eggs: Array.isArray(saved.eggs) ? saved.eggs.filter(x => typeof x === 'string') : [],
    };
    if (this.state.progress >= this.mission.goal) this.state.progress = 0; // older saves: never start a mission already 'done'
    this.syncHud();
  }
  get mission() { return DECK[this.state.index] || DECK[0]; }
  active() { return !!(this.g.world && this.g.world.level === 'jungle' && this.g.mode === 'roam'); }
  syncHud() {
    const m = this.mission;
    if (this.g.hud && this.g.hud.expedition) this.g.hud.expedition(m.title, Math.min(this.state.progress, m.goal), m.goal, this.state.stamps);
  }
  onCoreCollected() { if (this.active() && this.mission.id === 'cores') this.advance(); }
  // v5.19.0 core island hooks (called by js/islandplus.js)
  onRing() { if (this.active() && this.mission.id === 'rings') this.advance(); }
  onShrine() { if (this.active() && this.mission.id === 'shrine') this.advance(); }
  onRally() { if (this.active() && this.mission.id === 'rally') this.advance(2); }
  onWildKO() { if (this.active() && this.mission.id === 'rally') this.advance(); }
  onEggHatched(id) {
    if (!this.active() || this.mission.id !== 'egg') return;
    const done = this.state.eggs || (this.state.eggs = []);
    if (done.includes(id)) return;
    done.push(id); this.advance();
  }
  updatePlayer(x, z) {
    if (!this.active() || this.mission.id !== 'landmarks') return;
    for (const l of LANDMARKS) {
      if (this.state.visited.includes(l.id) || Math.hypot(x - l.x, z - l.z) > l.r) continue;
      this.state.visited.push(l.id); this.state.progress = this.state.visited.length;
      this.g.persist();
      if (this.state.progress >= this.mission.goal) this.complete(); else this.syncHud();
      break;
    }
  }
  advance(n = 1) {
    this.state.progress += n;
    this.g.persist();
    if (this.state.progress >= this.mission.goal) this.complete(); else this.syncHud();
  }
  complete() {
    this.state.stamps++; this.state.bolts += STAMP_BOLTS;
    if (this.g.addBolts) this.g.addBolts(STAMP_BOLTS);
    this.state.index = (this.state.index + 1) % DECK.length;
    this.state.progress = 0; this.state.visited = []; this.state.eggs = [];
    this.g.persist();
    if (this.g.fx && this.g.player) this.g.fx.sparks(this.g.player.center.clone(), 18, { r: 1, g: 0.78, b: 0.22 }, 1.2);
    if (this.g.hud && this.g.hud.banner) { this.g.hud.banner('🧭 EXPEDITION STAMP! +' + STAMP_BOLTS + ' 🔩', 2); const el = typeof document !== 'undefined' && document.getElementById('banner'); if (el) el.classList.add('ip'); }
    if (this.g.hud && this.g.hud.toast) this.g.hud.toast('🧭 Explorer stamp #' + this.state.stamps + ' earned!');
    if (this.g.hud && this.g.hud.say) this.g.hud.say('Expedition stamp!', { prio: 2, cd: 2000 });
    this.syncHud();
  }
}
