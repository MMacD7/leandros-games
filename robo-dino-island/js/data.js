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
  { id: 'gmech', name: 'Giga-Mech', price: 0, desc: 'A colossal mech. Its piston fists SLAM the ground in a QUAKE shockwave!', quake: true,
    hp: 260, speed: 10, laser: 11, rate: 0.18, missiles: 4, melee: 46, scale: 1.18, kind: 'gmech',
    body: 0x3e3a36, armor: 0x121212, glow: 0xff3a2a },
  { id: 'dblast', name: 'Dilo-Blaster', price: 0, desc: 'A frilled blaster bot. Sprays sticky GOO that slows foes down!', goo: true,
    hp: 105, speed: 14.5, laser: 7, rate: 0.11, missiles: 2, melee: 20, scale: 0.82, kind: 'dblast',
    body: 0x2c3a24, armor: 0x101410, glow: 0x9aff2a },
  // v5 "on steroids": a supercharged storm pterosaur mech
  { id: 'tptero', name: 'Thunder-Ptero', price: 0, desc: 'A HUGE storm-charged jet pterosaur. Its THUNDER STRIKE chains lightning through every foe!', thunder: true, roid: true,
    hp: 170, speed: 16, laser: 11, rate: 0.12, missiles: 4, melee: 40, scale: 1.35, kind: 'ptero', fly: true,
    body: 0x262a40, armor: 0x0e0e18, glow: 0xffe23a },
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
  { id: 'giga', name: 'Giganotosaurus', price: 0, kind: 'giga', desc: 'Even bigger than a T-Rex! Goes into a BERSERK RAGE: faster and fiercer.',
    hp: 190, speed: 11.5, bite: 34, biteRate: 0.6, special: 'rage', specialName: 'BERSERK<br>RAGE', specialCD: 9, roar: 2.8, scale: 1.12, radius: 2.8,
    back: 0x4a4038, belly: 0xa8967a, stripe: 0x1a1410, accent: 0x9a2a14, eye: 0xff6a1a },
  { id: 'allo', name: 'Allosaurus', price: 0, kind: 'allo', desc: 'The lion of the Jurassic. A lightning-fast TRIPLE BITE combo!',
    hp: 140, speed: 13, bite: 24, biteRate: 0.45, special: 'combo', specialName: 'TRIPLE<br>BITE', specialCD: 4.5, roar: 2.0, scale: 0.92, radius: 2.2,
    back: 0x6a4a2a, belly: 0xd0b48a, stripe: 0x2a1408, accent: 0xd8501a, eye: 0xffc21a },
  { id: 'dilo', name: 'Dilophosaurus', price: 0, kind: 'dilo', desc: 'Twin crests and a pop-out frill. SPITS sticky venom goo that slows and stings!',
    hp: 95, speed: 15.5, bite: 16, biteRate: 0.35, special: 'spit', specialName: 'VENOM<br>SPIT', specialCD: 2.4, roar: 1.4, scale: 0.8, radius: 1.6,
    back: 0x3a4a1a, belly: 0xc8c08a, stripe: 0x1a2208, accent: 0xff5a1a, eye: 0xd8ff3a },
  { id: 'pachy', name: 'Pachycephalosaurus', price: 0, kind: 'pachy', desc: 'A rock-hard dome head. Charges in for a HEAD-BUTT that sends foes flying!',
    hp: 150, speed: 13.5, bite: 14, biteRate: 0.5, special: 'headbutt', specialName: 'HEAD<br>BUTT', specialCD: 3.5, roar: 1.3, scale: 0.86, radius: 1.8,
    back: 0x4a3a2a, belly: 0xb8a080, stripe: 0x22180e, accent: 0x3a8ab8, eye: 0xffa21a },
  { id: 'para', name: 'Parasaurolophus', price: 0, kind: 'para', desc: 'Its trumpet crest blasts a SONIC HONK that knocks everything back!',
    hp: 200, speed: 11, bite: 12, biteRate: 0.6, special: 'honk', specialName: 'SONIC<br>HONK', specialCD: 4.5, roar: 1.6, scale: 1.0, radius: 2.4,
    back: 0x2a5a4a, belly: 0xc0b890, stripe: 0x0e2a22, accent: 0xff7a2a, eye: 0xffd21a },
  // ---- v5: OVER THE TOP. Huge, armored, spiked, glowing dinos (roid: glowing spikes + armor plates in the builder) ----
  { id: 'spinotitan', name: 'Spino-Titan', price: 0, kind: 'spinos', swim: true, roid: true, desc: 'A towering armored Spinosaurus with a glowing sail. Its TIDAL WAVE blasts everything away!',
    hp: 300, speed: 12, bite: 40, biteRate: 0.5, special: 'tsunami', specialName: 'TIDAL<br>WAVE', specialCD: 4, roar: 2.8, scale: 1.55, radius: 3.6,
    back: 0x1c3a4a, belly: 0x9ab0a8, stripe: 0x08161c, accent: 0x2ad8ff, eye: 0x4af0ff },
  { id: 'megatrike', name: 'Mega-Trike', price: 0, kind: 'trice', roid: true, desc: 'A super-sized Triceratops with ROCKET-POWERED horns. Rocket charge = KABOOM!',
    hp: 360, speed: 11, bite: 30, biteRate: 0.6, special: 'rockethorn', specialName: 'ROCKET<br>HORNS', specialCD: 3.5, roar: 2.2, scale: 1.45, radius: 3.6,
    back: 0x3a2a1a, belly: 0xb09070, stripe: 0x140c06, accent: 0xff5a10, eye: 0xffb21a },
  { id: 'raptorpack', name: 'Raptor Pack Alpha', price: 0, kind: 'velo', roid: true, desc: 'The leader of the pack. PACK STRIKE pounces from foe to foe to foe!',
    hp: 170, speed: 20, bite: 24, biteRate: 0.25, special: 'pack', specialName: 'PACK<br>STRIKE', specialCD: 3, roar: 1.8, scale: 0.95, radius: 1.8,
    back: 0x2a1a3a, belly: 0xa890b0, stripe: 0x0e0816, accent: 0xb84aff, eye: 0xd88aff },
  { id: 'brachiotank', name: 'Brachio-Tank', price: 0, kind: 'brachio', roid: true, desc: 'A colossal armored long-neck with a MEGA CANNON that rains shells on the enemy!',
    hp: 480, speed: 9, bite: 22, biteRate: 0.6, special: 'cannon', specialName: 'MEGA<br>CANNON', specialCD: 3.5, roar: 2.4, scale: 1.6, radius: 4.4,
    back: 0x3a4a3a, belly: 0xa8a890, stripe: 0x141a14, accent: 0x8aff3a, eye: 0xaaff4a },
  { id: 'lavaanky', name: 'Lava Ankylo', price: 0, kind: 'ankys', roid: true, desc: 'Molten armor and a magma club. LAVA SLAM splashes a ring of fire!',
    hp: 420, speed: 9, bite: 22, biteRate: 0.6, special: 'lavaslam', specialName: 'LAVA<br>SLAM', specialCD: 3.5, roar: 2.0, scale: 1.4, radius: 3.6,
    back: 0x2a1410, belly: 0x6a4030, stripe: 0x0a0402, accent: 0xff4a0a, eye: 0xff8a1a },
];
REALS.forEach(d => { d.real = true; d.melee = d.bite; });

// Dragons: they fly (Boost = climb). Primary = element blast, special = element BREATH, roar stuns.
export const DRAGONS = [
  { id: 'dfire', name: 'Fire Dragon', price: 0, kind: 'dragon', element: 'fire', desc: 'Spits FIREBALLS and breathes a roaring river of FIRE!',
    hp: 175, speed: 15, bite: 18, biteRate: 0.5, special: 'breath', specialName: 'FIRE<br>BREATH', specialCD: 4, roar: 2.2, scale: 1.2, radius: 3.0,
    back: 0x5a120c, belly: 0xd08a4a, stripe: 0x1a0606, accent: 0xff4a12, eye: 0xffa21a },
  { id: 'dice', name: 'Ice Dragon', price: 0, kind: 'dragon', element: 'ice', desc: 'Fires ICE SHARDS. Its FROST BREATH slows foes and FREEZES them solid!',
    hp: 175, speed: 15, bite: 15, biteRate: 0.42, special: 'breath', specialName: 'FROST<br>BREATH', specialCD: 4, roar: 2.2, scale: 1.2, radius: 3.0,
    back: 0x2a4a6a, belly: 0xcfe6f2, stripe: 0x0e1e30, accent: 0x7ad8ff, eye: 0x8af4ff },
  { id: 'dstorm', name: 'Storm Dragon', price: 0, kind: 'dragon', element: 'storm', desc: 'Throws LIGHTNING BOLTS and calls a chain-lightning STORM!',
    hp: 165, speed: 16, bite: 14, biteRate: 0.55, special: 'breath', specialName: 'LIGHTNING<br>STORM', specialCD: 4.5, roar: 2.2, scale: 1.15, radius: 2.9,
    back: 0x2a2440, belly: 0x8a86a8, stripe: 0x0e0c1a, accent: 0x7a5aff, eye: 0xffe24a },
  { id: 'rdragon', name: 'Robo-Dragon', price: 0, kind: 'rdragon', desc: 'A jet-winged dragon mech: lasers, missiles and FLAME JETS!', breath: true, fly: true, robodragon: true,
    hp: 165, speed: 15.5, laser: 9, rate: 0.14, missiles: 4, melee: 30, scale: 1.1, radius: 2.8,
    body: 0x3a2a2a, armor: 0x121010, glow: 0xff5a1a },
];
DRAGONS.forEach(d => { d.dragon = true; d.fly = true; if (d.kind === 'dragon') { d.real = true; d.melee = d.bite; } else d.real = false; });
// the Dragon Peak arena boss (not in the garage)
export const DRAGON_KING = { ...DRAGONS[0], id: 'dking', name: 'DRAGON KING', element: 'king', back: 0x1c1410, belly: 0x9a7a3a, stripe: 0x060403, accent: 0xffb41a, eye: 0xffd23a, scale: 2.5, radius: 6.2, boss: true };
// v5: the City boss (not in the garage): a kaiju-sized armored Giganotosaurus
export const MEGA_REX = { ...REALS.find(d => d.id === 'giga'), id: 'megarex', name: 'MEGA-REX', roid: true, back: 0x2a2018, belly: 0x8a7050, stripe: 0x0a0604, accent: 0xff2a0a, eye: 0xff3a1a, scale: 2.7, radius: 6.6, boss: true, special: 'stomp' };
// v5: Ricky & Bobby are playable (small, fast West Highland terriers: bite, bark blast, zoomies, big jump + flying hop)
export const WESTIES = [
  { id: 'ricky', name: 'Ricky', price: 0, kind: 'westie', westie: true, accent: 0xd82a2a, desc: 'A tiny terrier with a HUGE heart (red cape). Super fast, big jumps and a mighty BARK!',
    hp: 150, speed: 20, bite: 22, biteRate: 0.22, special: 'bark', specialName: 'BARK<br>BLAST', specialCD: 1, roar: 1.5, scale: 0.85, radius: 1.3 },
  { id: 'bobby', name: 'Bobby', price: 0, kind: 'westie', westie: true, accent: 0x2a6ad8, desc: "Ricky's partner (blue cape). Zoomies so fast he's a blur, and a bark that knocks dinos over!",
    hp: 150, speed: 20.5, bite: 21, biteRate: 0.22, special: 'bark', specialName: 'BARK<br>BLAST', specialCD: 1, roar: 1.5, scale: 0.85, radius: 1.3 },
];
WESTIES.forEach(d => { d.real = true; d.melee = d.bite; });
// v5 DEEP SEA SHOWDOWN: playable sea creatures (they SWIM: free 3D movement with the ▲/▼ buttons) + wild sea monsters
export const SEA = [
  { id: 'shark', name: 'Great White Shark', price: 0, kind: 'shark', desc: 'The fastest hunter in the sea! Snappy bites and a TORPEDO RAM that sends foes spinning.',
    hp: 175, speed: 19, bite: 26, biteRate: 0.3, special: 'ram', specialName: 'TORPEDO<br>RAM', specialCD: 3, roar: 1.8, third: 'frenzy', thirdName: 'FEEDING<br>FRENZY', scale: 1.0, radius: 2.2,
    back: 0x5d6e7c, belly: 0xeef2f2, accent: 0x2ad8ff, eye: 0x101010 },
  { id: 'megalodon', name: 'Megalodon', price: 0, kind: 'shark', mega: true, desc: 'A prehistoric MEGA shark as big as a bus. Its CRUSHING CHOMP flattens anything!',
    hp: 420, speed: 14.5, bite: 44, biteRate: 0.55, special: 'crush', specialName: 'CRUSHING<br>CHOMP', specialCD: 3.5, roar: 2.8, scale: 1.9, radius: 4.2,
    back: 0x3a4048, belly: 0xb8bcb8, accent: 0xff3a1a, eye: 0xff2a1a },
  { id: 'stingray', name: 'Thunder Stingray', price: 0, kind: 'ray', glide: true, desc: 'Glides super fast (hold SWIM FAST). Its tail STING poisons and its ZAP STRIKE chains lightning!',
    hp: 150, speed: 18, bite: 18, biteRate: 0.28, special: 'zap', specialName: 'ZAP<br>STRIKE', specialCD: 2.5, roar: 1.6, sting: true, scale: 1.0, radius: 2.4,
    back: 0x3a4a5a, belly: 0xe8e4dc, accent: 0x5ae8ff, spot: 0x9ad8ff },
  { id: 'octopus', name: 'Giant Octopus', price: 0, kind: 'octo', desc: 'Eight arms! TENTACLE GRAB pulls a foe in and squeezes, and an INK CLOUD blinds every enemy around.',
    hp: 210, speed: 13, bite: 22, biteRate: 0.4, special: 'grab', specialName: 'TENTACLE<br>GRAB', specialCD: 3, roar: 1.6, third: 'ink', thirdName: 'INK<br>CLOUD', scale: 1.0, radius: 2.2,
    back: 0xb8402a, belly: 0xf0a888, accent: 0xff7a3a, spot: 0xffc0a0 },
  { id: 'jellyfish', name: 'Mega Jellyfish', price: 0, kind: 'jelly', desc: 'A glowing giant. SHOCK AURA zaps everything around it, and STINGING TENDRILS whip out in every direction!',
    hp: 165, speed: 11, bite: 18, biteRate: 0.3, special: 'shock', specialName: 'SHOCK<br>AURA', specialCD: 2.5, roar: 1.6, sting: true, third: 'tendrils', thirdName: 'STING<br>TENDRILS', scale: 1.0, radius: 2.2,
    back: 0xff7ad8, belly: 0xffffff, accent: 0xd05aff },
  // wild only (not in the garage)
  { id: 'angler', name: 'Anglerfish', price: 0, kind: 'angler', wildOnly: true, desc: 'A deep-sea horror with a glowing lure.',
    hp: 150, speed: 12, bite: 26, biteRate: 0.5, special: 'lure', specialName: 'LURE<br>FLASH', specialCD: 5, roar: 1.6, scale: 1.1, radius: 2.3,
    back: 0x2a2018, belly: 0x5a4a3a, accent: 0x7affd8 },
  { id: 'serpent', name: 'Sea Serpent', price: 0, kind: 'serpent', wildOnly: true, desc: 'A giant glowing sea snake.',
    hp: 230, speed: 15, bite: 28, biteRate: 0.5, special: 'whip', specialName: 'TAIL<br>WHIP', specialCD: 4, roar: 2, scale: 1.15, radius: 2.4,
    back: 0x1a4a3a, belly: 0x9ad8a0, accent: 0x3affb0 },
  { id: 'crab', name: 'Giant Crab', price: 0, kind: 'crab', wildOnly: true, walker: true, desc: 'Armored claws that never let go.',
    hp: 250, speed: 9, bite: 24, biteRate: 0.5, special: 'combo', specialName: 'CLAW<br>COMBO', specialCD: 4, roar: 1.6, scale: 1.1, radius: 2.8,
    back: 0xc8401a, belly: 0xf0b070, accent: 0xffb03a },
];
SEA.forEach(d => { d.real = true; d.sea = true; d.melee = d.bite; if (!d.walker) { d.fly = true; d.swim = true; } });
// the Deep Sea bosses (not in the garage): the KRAKEN and a monster mega-shark
export const KRAKEN = { id: 'kraken', name: 'THE KRAKEN', price: 0, kind: 'kraken', real: true, sea: true, fly: true, swim: true, boss: true, hp: 900, speed: 11, bite: 30, biteRate: 0.8, special: 'kraken', specialName: 'KRAKEN', specialCD: 5, roar: 2.6,
  scale: 3.0, radius: 7, back: 0x4a1030, belly: 0xc86a8a, accent: 0xff2a6a };
export const MONSTER_MEG = { ...SEA[1], id: 'monstermeg', name: 'MONSTER MEGALODON', scale: 4.0, radius: 8.5, boss: true, back: 0x22262c, belly: 0x8a8e8a, accent: 0xff1a0a };
export const DINOS = [...ROBOS, ...REALS, ...DRAGONS, ...WESTIES, ...SEA];

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
  kos: 0, cores: 0, bestBattle: 0, muted: false, music: true, ride: true, allUnlocked: true, level: 'jungle', voice: true });

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
    if (!['peak', 'city', 'ocean'].includes(out.level)) out.level = 'jungle';
    out.voice = out.voice !== false;
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
