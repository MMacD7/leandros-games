# Leandro's Robo Dino Island

An ad-free 3D browser game with two levels: a jungle island with a volcano, ruins and a sea, and **Dragon Peak**, a volcanic mountain at dusk with a glowing lava sea, castle ruins and dragons. You play as either a **real dinosaur** (bite, roar, tail whip, horn charge, pounce) or a **robot mech dinosaur** (lasers, homing missiles, bite/stomp), or a **dragon** (fireballs, fire/frost/lightning breath, flight), and you battle a wild mix of both. A knocked-out robot falls over in a shower of sparks. A knocked-out real dino gets dizzy stars and limps off in a puff of dust. There is no gore or blood.

* **No ads, purchases, external links, tracking or network calls.** Everything is static files from the same origin, and a CSP (`default-src 'self'`) enforces that.
* **Everything is unlocked from the start**: all 27 creatures (13 real dinos, 10 robots, 4 dragons) and every upgrade at max level. Upgrade levels can be dialled up or down for free in the garage. Bolts are just a score now and don't gate anything. Older saves get everything unlocked when they load.
* It's an installable PWA and works fully offline after the first load.

## Play / host
Serve the folder over any static web server, for example `python3 -m http.server 8000`, then open `http://<host>:8000/`.
You need HTTPS (or localhost) for the service worker and install.
On iPhone/iPad: open it in Safari, tap **Share → Add to Home Screen**, then launch it from the icon. It opens fullscreen and keeps working offline.

## Levels
Pick a level with the big cards on the title screen: **🌴 JUNGLE ISLAND** or **🌋 DRAGON PEAK**. You can also tap 🗺️ in the game (top-left, or Pause → 🗺️ Change level) to switch at any time. The choice is saved, and the announcer welcomes you when you travel.
* **Dragon Peak** has a taller, craggier volcano, a molten lava sea and glowing lava canyons and cracks (walking in lava hurts, flying over it is fine). It also has charred dead trees, glowing ember and storm crystals, obsidian spires, floating rock islands and dragon nests with glowing eggs. Lightning strikes the spires with thunder, embers drift in the air, and there's a dusk sky with stars and a moon.
* Its wild creatures are dragons in the sky plus Giganotosaurus, Allosaurus, Dilophosaurus, Pachycephalosaurus, Parasaurolophus, Giga-Mech and Dilo-Blaster on the ground.
* The Battle Arena on Dragon Peak is a ring of crumbling **castle ruins** with towers, a broken keep and burning braziers. Its boss wave is the giant **DRAGON KING**, with a health bar, fire rain, minions and its own boss music.
* It has its own music: an ominous E-phrygian theme, a fast battle riff and a Dragon King boss track.

## Modes
* **Explore the Island**: free roam.
  * Collect energy cores (heal/boost), scrap and bolts.
  * Wild dinos (a mix of real and robot) patrol, roar, and chase you when you get close. Robots shoot and bite. Real dinos bite, charge, pounce, whip or stomp. They back off when they're damaged.
  * The glowing home-base pad repairs you and is a safe zone.
* **Battle Arena**: 90-second timed rounds in the stone ruins, with waves of enemies. Every 3rd wave is a **BOSS WAVE**: a giant MEGA ROBO-REX or TITAN T-REX with its own health bar (+30 s on the clock). Meteor-storm ☄️ and air-strike ✈️ power-ups appear in the arena. Hit combos and KO streak banners (DOUBLE KO!, TRIPLE KO!, MEGA KO!, RAMPAGE!) give bonus bolts. The round ends with a fireworks-and-explosions celebration.
* **Dino Garage**: it has **Real**, **Robot**, **🐉 Dragons** and **Upgrades** tabs. Pick any dino. The 5-level upgrades apply to both kinds: Armor & Tough Hide, Lasers & Jaws, Missiles & Specials, Leg Power, Boost & Stamina, and 🔥 Fire Power (hotter fire breath, burning missiles, and a roar that breathes fire for the real dinos).
* If you get knocked out, you respawn at base with a short shield. You keep your bolts.
* Progress is saved in `localStorage` (key `robo-dino-island.v1`, unchanged). Saves from older versions load fine.
* Knocking out an enemy triggers a short slow-motion flash.

### Fire and explosions (v3)
* **Explosions** are layered: a fireball, rolling secondary blasts, shockwave rings, flying flaming debris, a smoke column, a scorch mark, a light flash, camera shake and a bass boom.
* **Explosive barrels, fuel tanks and crates** sit in the arena and in depots around the island. Shoot, bite, stomp or burn them and they blow up, damage nearby enemies, and set off chain reactions. They respawn later.
* **Fire**: missiles leave fire-and-smoke trails and set their targets on fire. Explosions leave burning ground patches. Boost and Ptero-Jet leave jet flames. Burning dinos take a little damage over time, and water puts the fire out.
* **Volcano**: it erupts every minute or so, with a lava fountain and lava bombs. A red warning circle shows where each bomb will land, so you can dodge. It has glowing lava rivers (don't walk in them) and embers in the air.
* **Title screen**: explosions behind the logo, embers, and volcano eruptions.
* Particles are pooled and capped per quality tier. Low uses about a third of Ultra's particle budget, with fewer debris chunks and emitters.

### Music
* An original, high-energy soundtrack generated live in code (Web Audio step sequencer). There are no audio files and no downloads.
* Tracks:
  * Title: cinematic taiko drums, brass and pads.
  * Free roam: jungle percussion and marimba.
  * Battle: fast driving drums, bass, stabs and arps.
  * Boss wave: double kick, distorted bass, brass and choir.
  * Dragon Peak: a dark theme, a battle riff and the Dragon King boss track.
  * Victory: a fanfare sting.
* Tracks loop seamlessly, crossfade, and duck under explosions and roars. Music starts after the first tap (an iOS rule).
* The 🎵 button (title screen) and Pause → Music turn it on or off, separately from sound effects. The setting is saved.

### Announcer voice
* A loud, hype announcer calls out the action using the browser's built-in offline speech (`speechSynthesis`). There's no network and no audio files. It uses a deep voice where one is available, with tuned pitch and rate. If the browser has no speech, the game just skips the voice.
* Callouts:
  * KO streaks (DOUBLE KO!, RAMPAGE!, UNSTOPPABLE!)
  * Boss incoming! and Dragon King incoming!
  * Welcome to Dragon Peak! when you travel
  * the creature's name when you pick it in the garage
* **LEANDRO!** It shouts his name a lot:
  * on start
  * on big combos
  * "Let's go, Leandro!" when he mounts up
  * **LEANDRO WINS!**, with a big gold banner, on every wave clear, boss KO and battle win
* It's rate-limited and queued by priority so it never spams, and the music ducks under it. It's unlocked on the first tap (an iOS rule).
* The 🗣️ button (title screen) and Pause → Voice turn it on or off. The setting is saved.

### Ricky & Bobby
* Two fluffy West Highland terriers (Westies), Ricky (red cape) and Bobby (blue cape), sometimes run into the game:
  * every few minutes while roaming
  * at the start of some battles and boss waves
  * after victories
* They get a wrestling-announcer intro: "In this corner... weighing in at fifteen pounds of pure fluff... RICKYYYY! And his partner... BOBBYYYY!" It comes with crowd cheers, barks, spotlights, confetti and a big **RICKY & BOBBY!** banner.
* Then they help. They either do a bark shockwave that stuns and pushes back nearby enemies, or fetch a power-up. After that they run off.
* They're invincible, never targeted and not counted as enemies. They run away early if danger gets close.
* **🐶 Summon button:** tap the big RICKY & BOBBY button in the game (next to the attack buttons) to call them in any time. It has a 25-second cooldown ring. Tap it again while they're here for an extra bark blast.
* Random visits are rate-limited, so they show up at most about every two minutes. The intro follows the 🗣️ voice setting.

### Leandro rides
* A cartoony, low-poly kid rider (Leandro) sits on every dino: a leather saddle on the real ones and a cockpit seat on the robots. The seat is found automatically for each of the 27 bodies, and on dragons he rides a saddle on the back, just behind the neck.
* He bounces with the stride, leans into turns, holds on tight during roars, fire breath and boosts, and fist-pumps on every KO. He waves from the T-Rex on the title screen.
* If your dino gets knocked out, he hops off safely, waves, and climbs back on when the dino comes back. He never gets hurt.
* Turn him on or off with the 🧒 *Leandro rides* button in the garage or the pause menu. The setting is saved and is on by default.
* He is built entirely in code from simple shapes (`js/rider.js`). No photos or image files of anyone are in the game.

### Real dinos
Buttons: **BITE** (hold), **special** (with cooldown), **ROAR** (stuns enemies in front of you for a few seconds, 6 s cooldown), **RUN**.

| Dino | Special | Notes |
|---|---|---|
| T-Rex | MEGA CHOMP: lunging crushing bite | strongest bite, longest roar stun |
| Carnotaurus | HORN CHARGE: fast bull charge with knockback | quick, bull horns |
| Velociraptor | POUNCE: leaps onto a target from far away | smallest and fastest, sickle claws, feathers |
| Spinosaurus | TAIL SWIPE: 360° tail whip | **swims**, big sail |
| Triceratops | GORE CHARGE: horn charge that stuns | tough frill shield |
| Ankylosaurus | CLUB SMASH: club-tail whip that stuns | heaviest armor |
| Stegosaurus | SPIKE TAIL: spiked tail whip | back plates |
| Brachiosaurus | TITAN STOMP: rears up and slams down with a shockwave | biggest of all |
| Giganotosaurus | RAGE MODE: glowing red fury, faster with harder bites | huge hunter |
| Allosaurus | COMBO SLASH: three quick lunging bites | brow horns |
| Dilophosaurus | VENOM SPIT: opens its neck frill and spits poison goo (slows + poisons) | twin crests and frill |
| Pachycephalosaurus | HEAD-BUTT: dome-head ram with big knockback and dizzy stars | dome skull |
| Parasaurolophus | HONK BLAST: trumpet-crest sound wave that stuns and pushes | tube crest |

### Robot dinos
Buttons: **Laser** (hold), **Missile**, **Bite/Stomp**, **Boost**.

| Dino | Special |
|---|---|
| Robo-Rex | all-rounder, strong lasers, **FIRE BREATH** flamethrower (sets enemies and barrels on fire) |
| Raptor-X | very fast, double lasers |
| Tri-Tank | very tough armor |
| Stego-Blade | glowing blade plates, spiky tail |
| Ptero-Jet | **flies** (hold Boost to climb) |
| Spino-Sub | **swims** fast in the sea |
| Ankylo-Hammer | heavy armor, hammer tail |
| Bronto-Titan | the biggest |
| Giga-Mech | **QUAKE SLAM**: piston-fist ground pound with a shockwave |
| Dilo-Blaster | **GOO SPRAY**: neck-frill cannon of sticky poison goo |

### Dragons
They fly with the Ptero controls: hold **CLIMB** to gain height and let go to glide down. The wings really flap. They have horns, spikes, glowing eyes and a big roar. Buttons: **element blast** (hold), **breath** (cooldown), **ROAR**, **CLIMB**.

| Dragon | Blast | Breath / special |
|---|---|---|
| Fire Dragon | fireballs that explode | FIRE BREATH sets everything alight |
| Ice Dragon | ice shards | FROST BREATH slows and **freezes** foes solid |
| Storm Dragon | lightning bolts | LIGHTNING STORM chain-zaps every foe in front |
| Robo-Dragon | lasers + missiles | FLAME JETS from its jaws and wing jets |

The breath has a gentle aim-assist so younger players hit what they're facing.

## Controls
* **Touch**
  * Left side: floating joystick to move.
  * Right side: drag to orbit the camera.
  * Buttons: **Laser** (hold), **Missile** (homing, with cooldown), **Bite/Stomp** (bites an enemy in front of you, otherwise a shockwave stomp), **Boost**.
* **Keyboard/mouse**: WASD/arrows to move, mouse drag to look, J = laser, K = missile, L = bite/stomp (fire breath for Robo-Rex), Shift = boost. The pause button is at the top left.
* Sound is synthesized live with WebAudio. Use the speaker button on the title screen or the pause menu to mute.

## Graphics and performance
* Three.js r186 (vendored, MIT).
* PBR materials with image-based lighting from a CC0 sky HDRI.
* The sun casts real-time shadows, and there's fog.
* Terrain is splat-mapped (grass/sand/rock/dirt by height and slope, with triplanar rock).
* Water has depth color and shore foam.
* GPU-instanced grass and flowers sway in the wind and get trampled.
* Instanced palms, jungle trees, bushes and ferns use 2 LOD levels.
* The volcano smokes.
* Effects: emissive glow parts, muzzle flashes, laser streaks, homing missiles with smoke trails, explosions, sparks and shock rings.
* The robo dinos are procedural, built from bevelled superellipsoid armor shells on a skinned bone rig. They have spikes, angry brows, glowing eyes and a procedural battle-damage map (scratches, soot, claw marks, rivets). They have walk cycles, an opening jaw and a roar.
* The real dinos are procedural too. Their bodies are smooth lofted tubes through a bone rig with blended skin weights, so they bend like animals. Skin uses a procedural scale albedo and normal map, plus baked countershading, stripes, accent markings and scars. They have walk/run cycles, tail sway, breathing, an opening jaw, and a roar with camera shake, a breath blast and dust.

The game picks one of four **quality tiers** automatically:

| Tier | Pixel ratio | Shadow map | Grass |
|---|---|---|---|
| Low | 1.0 | 512 | 3.2k clumps |
| Medium | 1.3 | 1024 | 6.5k clumps |
| High | 1.7 | 2048 | 11k clumps |
| Ultra | 2.0 | 2048 | 16k clumps |

* The tier also sets the vegetation draw distance and the number of enemies.
* Starting tier: iPhone starts on High, iPad on Medium, desktop on High/Ultra.
* While you play, it measures FPS. It steps down if the frame rate falls below target (iPad 40, others 52) and steps back up after sustained headroom.
* You can override it in Pause → Quality, or with `?q=0..3` in the URL.

## Files
`index.html`, `css/`, `js/` (game code plus `js/vendor/three.bundle.min.js`), `assets/` (textures and sky), `icons/`, `manifest.webmanifest`, `sw.js` (precache, cache-first).
Updates install automatically. The service worker loads pages and code network-first (with an offline fallback) and reloads the game once when a new version takes over. The title screen shows the version (bottom right). After editing any file, regenerate the service worker with `python3 tools/gen-sw.py`. That refreshes the precache list and the cache-version hash.

## Credits and licenses
* **Three.js** © three.js authors, MIT License (`js/vendor/THREE-LICENSE.txt`).
* All textures and the sky are from **Poly Haven** (https://polyhaven.com). They're licensed **CC0 1.0** (public domain): https://polyhaven.com/license. I resized and re-encoded them as JPEG.
  * *Kloofendal 48d Partly Cloudy (Pure Sky)* HDRI by Greg Zaal and Jarod Guest, used for the sky background and environment lighting.
  * *Aerial Grass Rock* by Rob Tuytel, used for grass.
  * *Coast Sand 01* by Rob Tuytel, used for sand and ruin stone.
  * *Forest Ground 01* by Rob Tuytel, used for dirt.
  * *Rocky Terrain 02* by Amal Kumar, used for rock.
  * *Metal Plate* by Rob Tuytel, used for the mech and base metal normal/roughness.
* The Dragon Peak sky, lava sea, castle, crystals, nests and floating islands are all procedural (code and canvas). They reuse the CC0 rock/dirt/sand textures above.
* Everything else is original and procedural: the real and robot dino and dragon models, the announcer callouts (the browser's own speech engine), the Ricky & Bobby Westie models, barks and crowd-cheer sounds, the scale skin and battle-damage textures, leaf/bark/smoke/glow textures, sounds and icons. No copyrighted characters or names are used.
