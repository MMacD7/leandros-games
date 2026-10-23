# Leandro's Robo Dino Island

An ad-free 3D browser game on a jungle island with a volcano, ruins and a sea. You play as either a **real dinosaur** (bite, roar, tail whip, horn charge, pounce) or a **robot mech dinosaur** (lasers, homing missiles, bite/stomp), and you battle a wild mix of both. A knocked-out robot falls over in a shower of sparks. A knocked-out real dino gets dizzy stars and limps off in a puff of dust. There is no gore or blood.

* **No ads, purchases, external links, tracking or network calls.** Everything is static files from the same origin, and a CSP (`default-src 'self'`) enforces that.
* All 16 dinos (8 real, 8 robot) and all upgrades are unlocked with **bolts**. You only earn bolts by playing.
* It's an installable PWA and works fully offline after the first load.

## Play / host
Serve the folder over any static web server, for example `python3 -m http.server 8000`, then open `http://<host>:8000/`.
You need HTTPS (or localhost) for the service worker and install.
On iPhone/iPad: open it in Safari, tap **Share → Add to Home Screen**, then launch it from the icon. It opens fullscreen and keeps working offline.

## Modes
* **Explore the Island**: free roam.
  * Collect energy cores (heal/boost), scrap and bolts.
  * Wild dinos (a mix of real and robot) patrol, roar, and chase you when you get close. Robots shoot and bite. Real dinos bite, charge, pounce, whip or stomp. They back off when they're damaged.
  * The glowing home-base pad repairs you and is a safe zone.
* **Battle Arena**: 90-second timed rounds in the stone ruins. Each wave is tougher, and you get bonus bolts at the end.
* **Dino Garage**: it has **Real**, **Robot** and **Upgrades** tabs. Unlock dinos with bolts. The 5-level upgrades apply to both kinds: Armor & Tough Hide, Lasers & Jaws, Missiles & Specials, Leg Power, Boost & Stamina.
* If you get knocked out, you respawn at base with a short shield. You keep your bolts and unlocks.
* Progress is saved in `localStorage` (key `robo-dino-island.v1`, unchanged). Saves from the first version load fine, and the free T-Rex is added to them.
* Knocking out an enemy triggers a short slow-motion flash.

### Real dinos
Buttons: **BITE** (hold), **special** (with cooldown), **ROAR** (stuns enemies in front of you for a few seconds, 6 s cooldown), **RUN**.

| Dino | Price | Special | Notes |
|---|---|---|---|
| T-Rex | free | MEGA CHOMP: lunging crushing bite | strongest bite, longest roar stun |
| Carnotaurus | 200 | HORN CHARGE: fast bull charge with knockback | quick, bull horns |
| Velociraptor | 350 | POUNCE: leaps onto a target from far away | smallest and fastest, sickle claws, feathers |
| Spinosaurus | 600 | TAIL SWIPE: 360° tail whip | **swims**, big sail |
| Triceratops | 800 | GORE CHARGE: horn charge that stuns | tough frill shield |
| Ankylosaurus | 1000 | CLUB SMASH: club-tail whip that stuns | heaviest armor |
| Stegosaurus | 1200 | SPIKE TAIL: spiked tail whip | back plates |
| Brachiosaurus | 1600 | TITAN STOMP: rears up and slams down with a shockwave | biggest of all |

### Robot dinos
Buttons: **Laser** (hold), **Missile**, **Bite/Stomp**, **Boost**.

| Dino | Price | Special |
|---|---|---|
| Robo-Rex | free (default) | all-rounder, big bite, strong lasers |
| Raptor-X | 150 | very fast, double lasers |
| Tri-Tank | 300 | very tough armor |
| Stego-Blade | 450 | glowing blade plates, spiky tail |
| Ptero-Jet | 600 | **flies** (hold Boost to climb) |
| Spino-Sub | 800 | **swims** fast in the sea |
| Ankylo-Hammer | 1000 | heavy armor, hammer tail |
| Bronto-Titan | 1500 | the biggest |

## Controls
* **Touch**
  * Left side: floating joystick to move.
  * Right side: drag to orbit the camera.
  * Buttons: **Laser** (hold), **Missile** (homing, with cooldown), **Bite/Stomp** (bites an enemy in front of you, otherwise a shockwave stomp), **Boost**.
* **Keyboard/mouse**: WASD/arrows to move, mouse drag to look, J = laser, K = missile, L = bite/stomp, Shift = boost. The pause button is at the top left.
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
After editing any file, regenerate the service worker with `python3 tools/gen-sw.py`. That refreshes the precache list and the cache-version hash.

## Credits and licenses
* **Three.js** © three.js authors, MIT License (`js/vendor/THREE-LICENSE.txt`).
* All textures and the sky are from **Poly Haven** (https://polyhaven.com). They're licensed **CC0 1.0** (public domain): https://polyhaven.com/license. I resized and re-encoded them as JPEG.
  * *Kloofendal 48d Partly Cloudy (Pure Sky)* HDRI by Greg Zaal and Jarod Guest, used for the sky background and environment lighting.
  * *Aerial Grass Rock* by Rob Tuytel, used for grass.
  * *Coast Sand 01* by Rob Tuytel, used for sand and ruin stone.
  * *Forest Ground 01* by Rob Tuytel, used for dirt.
  * *Rocky Terrain 02* by Amal Kumar, used for rock.
  * *Metal Plate* by Rob Tuytel, used for the mech and base metal normal/roughness.
* Everything else is original and procedural: the real and robot dino models, the scale skin and battle-damage textures, leaf/bark/smoke/glow textures, sounds and icons. No copyrighted characters or names are used.
