// Roster (robot + real dinos), upgrades and save data. Everything is earned by playing: bolts are the only currency.
export const ROBOS = [
  { id: 'rex', name: 'Robo-Rex', price: 0, desc: 'The king of the island. Strong lasers and FIRE BREATH!', breath: true,
    hp: 120, speed: 11, laser: 9, rate: 0.16, missiles: 2, melee: 30, scale: 1.0, kind: 'rex',
    body: 0x3a3f47, armor: 0x141518, glow: 0x35e8ff },
  { id: 'raptor', name: 'Raptor-X', price: 150, desc: 'Super fast and nimble. Double lasers!',
    hp: 85, speed: 16, laser: 6, rate: 0.10, missiles: 2, melee: 22, scale: 0.72, kind: 'raptor',
    body: 0x34302c, armor: 0x111214, glow: 0xff8a1a },
  { id: 'tri', name: 'Tri-Tank', price: 300, desc: 'Three horns and a shield frill. Very tough!',
    hp: 190, speed: 8.5, laser: 10, rate: 0.22, missiles: 3, melee: 36, scale: 1.0, kind: 'tri',
    body: 0x3c4236, armor: 0x131416, glow: 0xff3a1a },
  { id: 'stego', name: 'Stego-Blade', price: 450, desc: 'Glowing blade plates and a spiky tail.',
    hp: 160, speed: 9.5, laser: 9, rate: 0.18, missiles: 4, melee: 34, scale: 1.0, kind: 'stego',
    body: 0x332c3e, armor: 0x121115, glow: 0xff2a6a },
  { id: 'ptero', name: 'Ptero-Jet', price: 600, desc: 'Jet wings - it can FLY! Hold Boost to climb.',
    hp: 90, speed: 15, laser: 8, rate: 0.14, missiles: 2, melee: 18, scale: 0.85, kind: 'ptero', fly: true,
    body: 0x2c3a4c, armor: 0x101317, glow: 0x3de8ff },
  { id: 'spino', name: 'Spino-Sub', price: 800, desc: 'A sail-backed swimmer. Zooms through the sea!',
    hp: 140, speed: 11.5, laser: 10, rate: 0.15, missiles: 3, melee: 32, scale: 1.05, kind: 'spino', swim: true,
    body: 0x24403f, armor: 0x0f1414, glow: 0x3dffd5 },
  { id: 'ankylo', name: 'Ankylo-Hammer', price: 1000, desc: 'Armored tank with a giant hammer tail.',
    hp: 230, speed: 8, laser: 8, rate: 0.2, missiles: 4, melee: 45, scale: 0.95, kind: 'ankylo',
    body: 0x4a3a28, armor: 0x141210, glow: 0xffa13a },
  { id: 'bronto', name: 'Bronto-Titan', price: 1500, desc: 'A giant long-neck mech. Biggest of them all!',
    hp: 300, speed: 9, laser: 12, rate: 0.2, missiles: 6, melee: 50, scale: 1.25, kind: 'bronto',
    body: 0x44464c, armor: 0x141518, glow: 0xff5a1a },
];
ROBOS.forEach(d => { d.real = false; });

// Real (organic) dinosaurs: natural attacks instead of guns. Primary = bite, special (cooldown), roar (stuns), run.
export const REALS = [
  { id: 'trex', name: 'T-Rex', price: 0, kind: 'trex', desc: 'The tyrant king! Bone-crushing bite and a roar that shakes the ground.',
    hp: 150, speed: 11, bite: 30, biteRate: 0.55, special: 'chomp', specialName: 'MEGA<br>CHOMP', specialCD: 6, roar: 2.6, scale: 1.0, radius: 2.5,
    back: 0x45351f, belly: 0x9c8058, stripe: 0x100b06, accent: 0xb83c14, eye: 0xffa21a },
  { id: 'carno', name: 'Carnotaurus', price: 200, kind: 'carno', desc: 'The horned bull-lizard. Lightning-fast horn charge!',
    hp: 115, speed: 14.5, bite: 22, biteRate: 0.45, special: 'charge', specialName: 'HORN<br>CHARGE', specialCD: 4.5, roar: 2.0, scale: 0.92, radius: 2.1,
    back: 0x5c2618, belly: 0xb88a66, stripe: 0x220d08, accent: 0xff5a1a, eye: 0xffc21a },
  { id: 'velo', name: 'Velociraptor', price: 350, kind: 'velo', desc: 'Small, clever and super quick. Pounces from far away!',
    hp: 80, speed: 18, bite: 15, biteRate: 0.28, special: 'pounce', specialName: 'POUNCE', specialCD: 3, roar: 1.2, scale: 0.62, radius: 1.2,
    back: 0x2a2d30, belly: 0x9d907a, stripe: 0x0e0f11, accent: 0xff7414, eye: 0xffd21a },
  { id: 'spinos', name: 'Spinosaurus', price: 600, kind: 'spinos', swim: true, desc: 'A giant sail and a crocodile snout. Swims like a torpedo!',
    hp: 165, speed: 11.5, bite: 26, biteRate: 0.5, special: 'whip', specialName: 'TAIL<br>SWIPE', specialCD: 4.5, roar: 2.2, scale: 1.05, radius: 2.6,
    back: 0x263236, belly: 0x8e9786, stripe: 0x0e1416, accent: 0xd83a16, eye: 0x4af0ff },
  { id: 'trice', name: 'Triceratops', price: 800, kind: 'trice', desc: 'Three huge horns and a shield frill. An unstoppable gore charge!',
    hp: 230, speed: 9.5, bite: 20, biteRate: 0.6, special: 'charge', specialName: 'GORE<br>CHARGE', specialCD: 4.5, roar: 1.6, scale: 1.0, radius: 2.6,
    back: 0x3a382c, belly: 0x978a6c, stripe: 0x1a1912, accent: 0xe0501a, eye: 0xffa21a },
  { id: 'ankys', name: 'Ankylosaurus', price: 1000, kind: 'ankys', desc: 'A living tank covered in bony armor, with a smashing club tail.',
    hp: 270, speed: 8, bite: 14, biteRate: 0.6, special: 'whip', specialName: 'CLUB<br>SMASH', specialCD: 4, roar: 1.4, scale: 1.0, radius: 2.6,
    back: 0x3e3a2a, belly: 0x8c7d60, stripe: 0x1c1a12, accent: 0xc89a48, eye: 0xff8a1a },
  { id: 'stegos', name: 'Stegosaurus', price: 1200, kind: 'stegos', desc: 'Huge back plates and a tail full of spikes.',
    hp: 210, speed: 9, bite: 14, biteRate: 0.6, special: 'whip', specialName: 'SPIKE<br>TAIL', specialCD: 3.5, roar: 1.4, scale: 1.0, radius: 2.6,
    back: 0x363e2e, belly: 0x9a9070, stripe: 0x161a12, accent: 0xe03a16, eye: 0xffa21a },
  { id: 'brachio', name: 'Brachiosaurus', price: 1600, kind: 'brachio', desc: 'The tallest of all! Rears up for an earth-shaking stomp.',
    hp: 330, speed: 8.5, bite: 14, biteRate: 0.6, special: 'stomp', specialName: 'TITAN<br>STOMP', specialCD: 5.5, roar: 1.8, scale: 1.25, radius: 3.4,
    back: 0x474c52, belly: 0xa69e8c, stripe: 0x24272c, accent: 0x7a8696, eye: 0xffb21a },
];
REALS.forEach(d => { d.real = true; d.melee = d.bite; });
export const DINOS = [...ROBOS, ...REALS];

export const UPGRADES = [
  { id: 'armor', name: 'Armor & Tough Hide', desc: '+15% health for every dino', icon: '🛡️' },
  { id: 'laser', name: 'Lasers & Jaws', desc: '+15% laser and bite damage', icon: '🔴' },
  { id: 'missile', name: 'Missiles & Specials', desc: '+1 missile, faster missile & special reload', icon: '🚀' },
  { id: 'engine', name: 'Leg Power', desc: '+8% speed', icon: '⚙️' },
  { id: 'battery', name: 'Boost & Stamina', desc: 'Longer boost / run', icon: '🔋' },
  { id: 'fire', name: 'Fire Power', desc: 'Hotter fire breath, burning missiles &amp; a roar that breathes fire', icon: '🔥' },
];
export const MAX_UP = 5;
export const upCost = lvl => [60, 120, 200, 320, 480][lvl] ?? Infinity;

const KEY = 'robo-dino-island.v1';
// Everything is unlocked from the start: every dino is owned and every upgrade starts at max level (levels can be
// dialled down/up for free in the garage). Bolts are just a score now.
const ALL_IDS = () => DINOS.map(d => d.id);
const maxUps = () => Object.fromEntries(UPGRADES.map(u => [u.id, MAX_UP]));
const fresh = () => ({ bolts: 0, owned: ALL_IDS(), selected: 'rex', up: maxUps(),
  kos: 0, cores: 0, bestBattle: 0, muted: false, music: true, ride: true, allUnlocked: true });

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!s) return fresh();
    const f = fresh();
    const owned = ALL_IDS(); // older saves: everything gets unlocked on load
    const up = s.allUnlocked ? { ...f.up, ...(s.up || {}) } : maxUps(); // first load after the update: max out every upgrade
    for (const k in up) up[k] = Math.max(0, Math.min(MAX_UP, up[k] | 0));
    const out = { ...f, ...s, up, owned, allUnlocked: true };
    if (!DINOS.some(d => d.id === out.selected)) out.selected = 'rex';
    return out;
  } catch (e) { return fresh(); }
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } }

export function statsFor(def, up) {
  if (def.real) return {
    hp: Math.round(def.hp * (1 + 0.15 * up.armor)),
    speed: def.speed * (1 + 0.08 * up.engine),
    bite: def.bite * (1 + 0.15 * up.laser), rate: def.biteRate, laser: 0, missiles: 0,
    missileCD: Math.max(def.specialCD * 0.55, def.specialCD - 0.35 * up.missile), // special cooldown
    melee: def.bite * (1 + 0.15 * up.laser), roar: def.roar, roarCD: 6,
    boost: 3.5 + 0.8 * up.battery, fire: up.fire || 0,
  };
  return {
    hp: Math.round(def.hp * (1 + 0.15 * up.armor)),
    speed: def.speed * (1 + 0.08 * up.engine),
    laser: def.laser * (1 + 0.15 * up.laser),
    rate: def.rate,
    missiles: def.missiles + up.missile,
    missileCD: Math.max(2.2, 5 - 0.5 * up.missile),
    melee: def.melee * (1 + 0.1 * up.armor),
    boost: 3 + 0.8 * up.battery, fire: up.fire || 0,
  };
}
