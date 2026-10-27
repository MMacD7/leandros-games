# Leandro's Robo Dino Island

An ad-free 3D browser game with four levels: a jungle island with a volcano, ruins and a sea; **Dragon Peak**, a volcanic mountain at dusk with a glowing lava sea, castle ruins and dragons; **Mega City Smash**, a sunset city full of buildings you can knock down; and **Deep Sea Showdown**, an underwater level where you play as a sea creature. You play as either a **real dinosaur** (bite, roar, tail whip, horn charge, pounce) or a **robot mech dinosaur** (lasers, homing missiles, bite/stomp), or a **dragon** (fireballs, fire/frost/lightning breath, flight), and you battle a wild mix of both. A knocked-out robot falls over in a shower of sparks. A knocked-out real dino gets dizzy stars and limps off in a puff of dust. There is no gore or blood.

* **No ads, purchases, external links, tracking or network calls.** Everything is static files from the same origin, and a CSP (`default-src 'self'`) enforces that.
* **Everything is unlocked from the start**: all 40 playable creatures (18 real dinos, 11 robots, 4 dragons, Ricky & Bobby, and 5 sea creatures) and every upgrade at max level. Upgrade levels can be dialled up or down for free in the garage. Bolts are just a score now and don't gate anything. Older saves get everything unlocked when they load.
* It's an installable PWA and works fully offline after the first load.

## Play / host
Serve the folder over any static web server, for example `python3 -m http.server 8000`, then open `http://<host>:8000/`.
You need HTTPS (or localhost) for the service worker and install.
On iPhone/iPad: open it in Safari, tap **Share → Add to Home Screen**, then launch it from the icon. It opens fullscreen and keeps working offline.

## Levels
Pick a level with the big cards on the title screen: **🌴 JUNGLE ISLAND**, **🌋 DRAGON PEAK**, **🏙️ MEGA CITY SMASH** or **🌊 DEEP SEA SHOWDOWN**. You can also tap 🗺️ in the game (top-left, or Pause → 🗺️ Change level) to switch at any time. The choice is saved, and the announcer welcomes you when you travel.
* **Dragon Peak** has a taller, craggier volcano, a molten lava sea and glowing lava canyons and cracks (walking in lava hurts, flying over it is fine). It also has charred dead trees, glowing ember and storm crystals, obsidian spires, floating rock islands and dragon nests with glowing eggs. Lightning strikes the spires with thunder, embers drift in the air, and there's a dusk sky with stars and a moon.
* Its wild creatures are dragons in the sky plus Giganotosaurus, Allosaurus, Dilophosaurus, Pachycephalosaurus, Parasaurolophus, Giga-Mech and Dilo-Blaster on the ground.
* The Battle Arena on Dragon Peak is a ring of crumbling **castle ruins** with towers, a broken keep and burning braziers. Its boss wave is the giant **DRAGON KING**, with a health bar, fire rain, minions and its own boss music.
* It has its own music: an ominous E-phrygian theme, a fast battle riff and a Dragon King boss track.
* **Mega City Smash** (v5) is a sunset city with streets, parked cars and skyscrapers.
  * Every building can be smashed. Bites, stomps, tail whips, charges, missiles and breath all damage it. A building cracks, sinks and crumbles into rubble with dust, falling chunks and a crash sound, and drops bolts.
  * A **🏙️ SMASHED** meter at the top shows how much of the city is down.
  * Waves of wild dinos and mechs roam the streets. The boss wave is the giant **MEGA-REX**.
  * It has its own industrial-metal music.
* **Deep Sea Showdown** (v5) is underwater, with blue water fog, light rays from the surface, caustics rippling over the sandy floor, swaying kelp forests, coral reefs, rocks, bubbling vents, fish schools, drifting particles and a sunken pirate ship with a glowing treasure chest.
  * You play as one of five **sea creatures** (see the table below) and **swim freely in 3D**: steer with the joystick and use the **▲ UP / ▼ DOWN** buttons (keys E / Q) to change depth. You can't leave the water.
  * Wild sea creatures roam and swim at different depths: sharks, stingrays, octopuses, jellyfish, anglerfish with glowing lures, sea serpents and giant crabs. Now and then a rare megalodon shows up too. They get tougher with each wave.
  * The boss wave is **🐙 THE KRAKEN**, which uses tentacle slams on red warning circles, an ink storm and a whirlpool that drags you in. On alternate boss waves you get a **🦈 MONSTER MEGALODON** instead.
  * Instead of a stampede, the ocean has a **🦈 SHARK FRENZY**.
  * It has its own doom-metal music: a muffled underwater guitar sound, sonar pings, whale calls and bubbles.
  * If you're playing a land dino when you dive in, you become your last sea creature (the Great White Shark the first time). When you go back to land, you get your land dino back. Ricky and Bobby can go anywhere.
* The first tap after this update gives a one-time shout: "New level unlocked, Leandro! Deep Sea Showdown!"

## Modes
* **Explore the Island**: free roam.
  * Collect energy cores (heal/boost), scrap and bolts.
  * Wild dinos (a mix of real and robot) patrol, roar, and chase you when you get close. Robots shoot and bite. Real dinos bite, charge, pounce, whip or stomp. They back off when they're damaged.
  * The glowing home-base pad repairs you and is a safe zone.
* **Battle Arena**: 90-second timed rounds in the stone ruins, with waves of enemies. Every 3rd wave is a **BOSS WAVE**: a giant MEGA ROBO-REX or TITAN T-REX with its own health bar (+30 s on the clock). Meteor-storm ☄️ and air-strike ✈️ power-ups appear in the arena. Hit combos and KO streak banners (DOUBLE KO!, TRIPLE KO!, MEGA KO!, RAMPAGE!) give bonus bolts. The round ends with a fireworks-and-explosions celebration.
* **Dino Garage**: it has **Real**, **Robot**, **🐉 Dragons**, **🦈 Sea**, **🐶 Dogs** and **Upgrades** tabs. Pick any dino. The 5-level upgrades apply to both kinds: Armor & Tough Hide, Lasers & Jaws, Missiles & Specials, Leg Power, Boost & Stamina, and 🔥 Fire Power (hotter fire breath, burning missiles, and a roar that breathes fire for the real dinos).
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
* An original **heavy-metal** soundtrack generated live in code (Web Audio step sequencer). There are no audio files and no downloads.
* It runs at 140–172 BPM with distorted power-chord guitars, a growling bass, double-kick drums, and a boss riser and hit. An intensity layer of extra double-kick, cymbals and a screaming lead fades in as the battle gets bigger.
* Tracks:
  * Jungle Island: tribal metal with taiko drums and toms.
  * Dragon Peak: epic and dark, with choir and brass.
  * Mega City: industrial metal with metal clanks and an arpeggiated synth.
  * Deep Sea: doom-y underwater metal with a muffled guitar sound, sonar pings, whale glides and bubbles.
  * Each level has a roam, a battle and a boss track, plus a victory fanfare.
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
* They get a wrestling-announcer intro: "In this corner... weighing in at fifteen pounds of pure fluff... Ricky! And his partner... Bobby! It's Ricky and Bobby!" It comes with crowd cheers, spotlights, confetti and a big **RICKY & BOBBY!** banner.
* Then they **dance** for about five seconds: alternating hops, a mirrored jump-spin, a side-to-side wiggle and tail wags, then paws in the air. After that, their little capes flap and they **fly away** into the sky with a sparkle trail. No fighting.
* They're invincible and never targeted. If trouble gets close, they just take off early.
* **🐶 Summon button (v5 helper mode):** tap the big RICKY & BOBBY button in the game (next to the attack buttons) and they swoop in with their intro and follow you. Then they hunt down the nearest enemy, pounce on it and always KO it (a boss just takes a big hit). They bark, and fly away. If nobody is around, they dance instead. The button has a 25-second rest ring, and tapping it while they're here throws more confetti. It works in all four levels.
* **Underwater** they wear **scuba gear**: a dive mask, a little yellow air tank with a hose, and flippers. Their capes come off. They swim in with a trail of bubbles, follow you at your depth, bark **bubbly yips**, and float up and away.
* **Playable (v5):** Ricky and Bobby are in the garage's 🐶 Dogs tab. They have BITE, BARK BLAST (knock-back), ZOOMIES and JUMP (with flying double hops). If you play as one, only the other dog comes when you summon.
* Random visits are rate-limited. The intro follows the 🗣️ voice setting.
* Spoken lines always use natural words (no ALL-CAPS or stretched words), so iPhone and iPad voices say the names instead of spelling them.

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

### Sea creatures (Deep Sea Showdown, v5)
These are in the garage's 🦈 Sea tab. Buttons: **BITE** (or **STING**), the **special**, a **third move**, **SWIM FAST**, and **▲ / ▼** to swim up and down.

| Creature | Special | Third move | Notes |
|---|---|---|---|
| Great White Shark | TORPEDO RAM: a fast charge that sends foes spinning | FEEDING FRENZY: faster, harder bites | fastest swimmer |
| Megalodon | CRUSHING CHOMP: a huge lunging bite with a shockwave | SONAR ROAR | huge, scarred, glowing eyes |
| Thunder Stingray | ZAP STRIKE: lightning from its tail barb that chains through up to 5 foes | SONAR ROAR | its sting poisons, and it glides very fast with SWIM FAST |
| Giant Octopus | TENTACLE GRAB: pulls a foe in and squeezes it | INK CLOUD: blinds every enemy around, and they wander off | eight bendy arms |
| Mega Jellyfish | SHOCK AURA: an electric burst all around it | STINGING TENDRILS: whips all its tendrils out in a ring (poison) | glowing see-through bell |

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
* **Keyboard/mouse**: WASD/arrows to move, mouse drag to look, J = laser, K = missile, L = bite/stomp (fire breath for Robo-Rex), Shift = boost. Underwater, E (or R / Page Up) swims up and Q (or F / Page Down) swims down. The pause button is at the top left.
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
* Deep Sea: caustics and a seagrass and sand palette are added to the terrain shader. There are instanced, swaying kelp and coral LOD sets with per-instance colours, additive god-ray billboards, a rippling surface seen from below, marine-snow points and instanced fish schools. The sea creatures are procedural spine-driven tube bodies with counter-shading.
* Performance: enemies are capped per tier, particles are pooled, far vegetation uses LOD, and the ocean draw distance is capped by its fog.
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
* The Dragon Peak sky, lava sea, castle, crystals, nests and floating islands, the Mega City buildings and cars, and the whole Deep Sea level (sky, kelp, coral, shipwreck, fish and sea creatures) are all procedural (code and canvas). They reuse the CC0 rock/dirt/sand textures above.
* Everything else is original and procedural: the real and robot dino and dragon models, the sea creatures, the metal soundtrack, the announcer callouts (the browser's own speech engine), the Ricky & Bobby Westie models, barks and crowd-cheer sounds, the scale skin and battle-damage textures, leaf/bark/smoke/glow textures, sounds and icons. No copyrighted characters or names are used.
