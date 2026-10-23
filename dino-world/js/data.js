/* Leandro's Dinosaur World - roster, save data */
'use strict';
window.G = window.G || {};
(function (G) {
  // diet: 'meat' | 'plant' | 'fish'  (array = can eat several)
  G.DINOS = [
    { id: 'raptor', name: 'Raptor', cost: 0, diet: ['meat'], size: 0.95, speed: 1.3, power: 1, tough: 1,
      col: '#f2a541', belly: '#fff1c9', dark: '#b8741c', accent: '#3fa7d6', ability: 'Super speed', run: 'bigjump' },
    { id: 'trike', name: 'Triceratops', cost: 20, diet: ['plant'], size: 1.05, speed: 0.95, power: 2, tough: 3,
      col: '#4f86f7', belly: '#d4e4ff', dark: '#2f5fc4', accent: '#ff8c42', ability: 'Horn charge', run: 'shield' },
    { id: 'steg', name: 'Stegosaurus', cost: 45, diet: ['plant'], size: 1.05, speed: 0.9, power: 2, tough: 2,
      col: '#4cb944', belly: '#e1f7cf', dark: '#2f8a2b', accent: '#ff6b6b', ability: 'Spiky tail', run: 'shield' },
    { id: 'ptera', name: 'Pteranodon', cost: 80, diet: ['fish'], size: 0.85, speed: 1.2, power: 1, tough: 1,
      col: '#9d79d6', belly: '#efe4ff', dark: '#6d4fae', accent: '#ff6b9d', ability: 'Can fly', run: 'doublejump', flies: true },
    { id: 'anky', name: 'Ankylosaurus', cost: 120, diet: ['plant'], size: 1.0, speed: 0.85, power: 2, tough: 3,
      col: '#b5835a', belly: '#f3dfc0', dark: '#7f5636', accent: '#ffd166', ability: 'Super armor', run: 'shield2' },
    { id: 'spino', name: 'Spinosaurus', cost: 170, diet: ['fish', 'meat'], size: 1.15, speed: 1.05, power: 3, tough: 2,
      col: '#1fb5ac', belly: '#d3fbf6', dark: '#0f7f78', accent: '#ff7b54', ability: 'Swims', run: 'magnet', swims: true },
    { id: 'brachio', name: 'Brachiosaurus', cost: 230, diet: ['plant'], size: 1.45, speed: 0.9, power: 2, tough: 3,
      col: '#f6c445', belly: '#fff3c4', dark: '#c48f12', accent: '#e8743b', ability: 'Eats treetops', run: 'shield' },
    { id: 'rex', name: 'T-Rex', cost: 300, diet: ['meat'], size: 1.3, speed: 1.05, power: 3, tough: 3,
      col: '#e4572e', belly: '#ffd29d', dark: '#a8361a', accent: '#ffd166', ability: 'Mega roar', run: 'smash' },
  ];
  G.DINO = {};
  G.DINOS.forEach(d => (G.DINO[d.id] = d));

  G.STAGES = [
    { name: 'Hatchling', xp: 0, scale: 0.76 },
    { name: 'Juvenile', xp: 60, scale: 0.88 },
    { name: 'Adult', xp: 200, scale: 1.1 },
  ];
  G.stageOf = function (xp) { return xp >= 200 ? 2 : xp >= 60 ? 1 : 0; };

  const KEY = 'leandros-dino-world-v1';
  // Every dinosaur is unlocked from the start (bones are just a score).
  const ALL = () => G.DINOS.map(d => d.id);
  const fresh = () => ({ bones: 0, total: 0, unlocked: ALL(), selected: 'raptor', xp: {}, best: { score: 0, dist: 0 },
    eggs: 0, fossils: 0, muted: false, seenUnlock: ALL() });
  G.save = fresh();
  G.load = function () {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') G.save = Object.assign(fresh(), s);
    } catch (e) { /* ignore */ }
    G.save.unlocked = ALL(); G.save.seenUnlock = ALL(); // older saves: unlock everything on load
    if (!G.DINO[G.save.selected]) G.save.selected = 'raptor';
    G.checkUnlocks(true);
  };
  G.persist = function () { try { localStorage.setItem(KEY, JSON.stringify(G.save)); } catch (e) { /* ignore */ } };
  G.resetSave = function () { G.save = fresh(); G.persist(); };

  // Bones are never spent: total earned unlocks dinos automatically.
  G.addBones = function (n) {
    if (n <= 0) return;
    G.save.bones += n; G.save.total += n;
    G.checkUnlocks(false);
    G.persist();
    if (G.ui) G.ui.updateBones();
  };
  G.checkUnlocks = function (silent) {
    G.DINOS.forEach(d => { // (kept for safety: everything is already unlocked)
      if (G.save.total >= d.cost && G.save.unlocked.indexOf(d.id) < 0) {
        G.save.unlocked.push(d.id);
        if (!silent && G.ui) G.ui.queueUnlock(d.id); else G.save.seenUnlock.push(d.id);
      }
    });
  };
  G.isUnlocked = id => G.save.unlocked.indexOf(id) >= 0;
  G.nextLocked = function () { return G.DINOS.find(d => !G.isUnlocked(d.id)); };
})(window.G);
