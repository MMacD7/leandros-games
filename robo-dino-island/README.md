# Leandro's Robo Dino Island

An ad-free 3D browser game with five levels: a jungle island with a volcano, ruins and a sea; **Dragon Peak**, a volcanic mountain at dusk with a glowing lava sea, castle ruins and dragons; **Mega City Smash**, a sunset city full of buildings you can knock down; **Deep Sea Showdown**, an underwater level where you play as a sea creature; and **Farty Poop Farm**, a silly farm where Leandro feeds the animals and rides a horse. You play as either a **real dinosaur** (bite, roar, tail whip, horn charge, pounce) or a **robot mech dinosaur** (lasers, homing missiles, bite/stomp), or a **dragon** (fireballs, fire/frost/lightning breath, flight), and you battle a wild mix of both. A knocked-out robot falls over in a shower of sparks. A knocked-out real dino gets dizzy stars and limps off in a puff of dust. There is no gore or blood.

* **No ads, purchases, external links, tracking or network calls.** Everything is static files from the same origin, and a CSP (`default-src 'self'`) enforces that.
* **Everything is unlocked from the start**: all 41 playable creatures (18 real dinos, 11 robots, 4 dragons, Ricky & Bobby, and 6 sea creatures) and every upgrade at max level. Upgrade levels can be dialled up or down for free in the garage. Bolts are just a score now and don't gate anything. Older saves get everything unlocked when they load.
* It's an installable PWA and works fully offline after the first load.

## Play / host
Serve the folder over any static web server, for example `python3 -m http.server 8000`, then open `http://<host>:8000/`.
You need HTTPS (or localhost) for the service worker and install.
On iPhone/iPad: open it in Safari, tap **Share → Add to Home Screen**, then launch it from the icon. It opens fullscreen and keeps working offline.

## Levels
Pick a level with the big cards on the title screen: **🌴 JUNGLE ISLAND**, **🌋 DRAGON PEAK**, **🏙️ MEGA CITY SMASH** or **🌊 DEEP SEA SHOWDOWN** or **🐷 FARTY POOP FARM**. You can also tap 🗺️ in the game (top-left, or Pause → 🗺️ Change level) to switch at any time. The choice is saved, and the announcer welcomes you when you travel.
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
  * You play as one of six **sea creatures** (see the table below) and **swim freely in 3D**: steer with the joystick and use the **▲ UP / ▼ DOWN** buttons (keys E / Q) to change depth. You can't leave the water.
  * Wild sea creatures roam and swim at different depths: sharks, stingrays, octopuses, jellyfish, anglerfish with glowing lures, sea serpents and giant crabs. Now and then a rare megalodon shows up too. They get tougher with each wave.
  * The boss wave is **🐙 THE KRAKEN**, which uses tentacle slams on red warning circles, an ink storm and a whirlpool that drags you in. On alternate boss waves you get a **🦈 MONSTER MEGALODON** instead.
  * Instead of a stampede, the ocean has a **🦈 SHARK FRENZY**.
  * It has its own doom-metal music: a muffled underwater guitar sound, sonar pings, whale calls and bubbles.
  * If you're playing a land dino when you dive in, you become your last sea creature (the Great White Shark the first time). When you go back to land, you get your land dino back. Ricky and Bobby can go anywhere.
* **Farty Poop Farm** (v5.1, level 5) is a bright, sunny farm with a red barn and silo, a farmhouse with a smoking chimney, fences and paddocks, round and square hay bales, a duck pond with a dock, mud puddles, a corn field, a pumpkin patch, a tractor, a windmill and a chicken coop.
  * You play as **Leandro** himself (a cartoon farm kid in a straw hat), not a dino. The buttons change to **🌽 FEED**, **🐴 RIDE / HOP OFF**, **💨 TOOT** and **RUN / GALLOP**, and you never run out of puff.
  * The farm animals are cows, pigs, chickens, sheep, goats and a horse. Walk up to one and tap **FEED**: it gets the right snack (hay, slop, corn, a carrot or an apple), eats it, shows hearts and then farts and/or poops. Every animal has its own voice (moo, oink, cluck, baa, maa, neigh).
  * A farm bar at the top counts the hungry animals you've fed (12 to go), with 3 stars along the way. Feed 12 different animals to become a **FARM HERO**: fireworks, a cheer and a grand fart symphony, then a new round starts.
  * Poop piles stay on the ground. Step on one for a **SQUISH**. Now and then a **✨ golden poop** drops: grab it to collect it.
  * **The horse**: walk up to it (the RIDE button glows) and tap **RIDE**. Hold **GALLOP** to go much faster, with clip-clop hooves and the odd gallop fart. Tap **HOP OFF** to get down.
  * **🐶 Ricky & Bobby** on the farm: a piggy escapes and the dogs herd it back to its pen. Then they sniff a poop pile, roll in the mud, let out a little dog toot, and fly away.
  * **😜 BAD DAVID** is an original cartoon troublemaker (messy hair, striped shirt). Each tap of his button starts one of 8 naughty but gentle pranks: running around in his undies, belly-flopping into the mud, riding a pig backwards, letting the chickens out, throwing cream pies (one hits the screen!), a MEGA fart that knocks a hay bale over, muddy footprints everywhere, and tickling a cow. A speech bubble shouts things like "DAVID, NOOO!". No animal ever gets hurt.
  * Every fart, plop, squish, splash and animal noise is made on the fly with WebAudio, in many varieties (short, long, squeaky, rumbly, wet, trumpet, tiny and mega). The music is a fast, silly hoedown with banjo, fiddle, cowbell, a washboard, a tuba and chugging metal guitars.
  * The farm has no battle arena. The other four levels are unchanged.
  * **v5.2: wetter, funnier farm.**
    * Farts are squelchier and sillier: bubbly, splashy and sputtery, with pitch slides, wobbly vibrato and squeaky endings. There are 14 kinds plus the toot machine, including bubbly, stutter (rapid-fire), encore (a pause, then a little "pfft"), trombone, squeak-up and raspberry. They're still made on the fly with WebAudio, kept at a gentle volume and never clip.
    * Fart clouds are bigger, bouncier and bright green, with little rising bubbles. The animal squashes, stretches and does a tiny jump.
    * Poop piles land with a **BOING** and have little buzzing flies. Stepping on one makes a star splat, and now and then Leandro slips and lands on his bottom. Golden poops sparkle.
    * The animals each react in their own way:
      * Cows' eyes bug out.
      * Pigs do a happy wiggle and a fart-powered hop.
      * Chickens puff feathers and lay a surprise egg.
      * Sheep fluff up.
      * Goats headbutt a hay bale.
    * Leandro holds his nose and fans the air when a fart goes off next to him. TOOT gives him a little fart-jump, and he does a victory dance on FARM HERO.
    * The horse does a goofy neigh-laugh, a buck-dance and a mane flip. A gallop fart gives a **fart-boost TURBO** with a puffy cloud trail.
    * Ricky & Bobby get the zoomies, slip in the mud, play tug-of-war with a sock until it rips, and do a tiny poop. One of them does a toot that scares them both, and then they fart-rocket away.
    * Bad David has bigger slapstick (somersaults, spins, the odd pratfall) and 2 new pranks, for 10 in all: a **fart-powered pogo stick**, and a **rope swing** into the duck pond (or into the nearest mud puddle when the pond is far away).
  * **v5.3: more farm fun.**
    * **Drive the tractor!** Walk up to it and tap **DRIVE**. It goes putt-putt, puffs exhaust smoke, bounces on its springs, squishes poop piles and pushes hay bales. It's slower than a galloping horse. **HONK** plays a silly moo-horn, and **HOP OFF** gets down. Ricky and Bobby chase the tractor.
    * **A big bouncy castle**, colorful and inflatable, with wobbly turrets. Walk onto it and Leandro bounces high with a boing and a squeak. **JUMP** gives bigger bounces with flips. Animals, Ricky and Bobby and Bad David hop on too, with the odd fart-bounce.
    * **A bigger chicken coop** that Leandro can walk into to collect eggs, with a golden egg now and then. The chickens flap out in a panic with feathers and clucks.
    * **SUPER STINKY** button (🤢): a wind-up wobble and rumble, then a long, wet blast with a camera shake and a big brown cloud with stink lines and buzzing flies. Nearby animals faint and pop back up. Then 2 to 4 cartoon visitors (a farmer, a lady in a big hat, a kid, a mail carrier, a gardener) walk up, shout "EEEEWWW!", hold their nose and run away. There's a short cooldown of about 4 seconds.
    * Ricky and Bobby's farm arrival line is "Look it's Ricky and Bobby, they are going to POOOOPY!", big, bouncy and spoken.
    * Bad David arrives shouting "NOOO DAVIDD!" then "THATS NOT FUNNY DAVID!!", and runs 2 or 3 quick goofy laps around Leandro (or the horse or tractor he's on) before every prank.
    * Leandro now wears a green-and-white hooped football kit with white shorts and hooped socks, with no crest or logo. The backpack is gone everywhere.
* **v5.4: Jungle Island goes WILD (level one only; the core gameplay is unchanged).**
  * Dinos make dramatic entrances, stomping in with a ground-shaking roar and a dust burst.
  * Every hit you land is meatier: a hit flash, flying stars, a burst ring, a punchy thump and a little camera shake. Keep hitting to build combos, and big comic callouts pop up: **SMASH!**, **MEGA!** and **DINO-MITE!**
  * Finishing a dino off brings a slow-motion KO with a camera punch-in and a star burst.
  * Mid-level surprise: the volcano rumbles and smokes, then a **STAMPEDE** thunders through while the camera swoops out to show the herd. In battles, the boss reveal gets a camera swoop too.
  * There are shorter lulls between new arrivals, the music builds as the action heats up, and pickups sparkle.
* **v5.5: a SEA TURTLE in Deep Sea Showdown.**
  * The **Sea Turtle** is the 6th playable sea creature, with its own look: a domed, plated shell, a pale belly, a beaked head and four paddling flippers.
  * **SHELL SPIN** tucks in and spins through foes with a whirring sound and a happy "wheee!". **SHELL SHIELD** puts up a glowing bubble that bounces attacks right back (with a hollow shell CLONK). **SWIM FAST** is a bubbly **FLIPPER DASH**.
  * Friendly turtles now glide around the sea floor in the background.
  * Tap the NEW call-out on the title to jump straight to the Sea Turtle in the garage.
  * Small fix: on Jungle Island the "Find energy cores" hint steps aside while a SMASH!/MEGA!/DINO-MITE! callout shows, so they no longer overlap (most noticeable on iPhone).
* The first tap after this update gives a one-time shout: "New level unlocked, Leandro! Farty Poop Farm!"

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
* They get a wrestling-announcer intro: "In this corner... weighing in at fifteen pounds of pure fluff... Ricky! And... Bobby! It's Ricky and Bobby!" It comes with crowd cheers, spotlights, confetti and a big **RICKY & BOBBY!** banner.
* Then they **dance** for about five seconds: alternating hops, a mirrored jump-spin, a side-to-side wiggle and tail wags, then paws in the air. After that, their little capes flap and they **fly away** into the sky with a sparkle trail. No fighting.
* They're invincible and never targeted. If trouble gets close, they just take off early.
* **🐶 Summon button (v5 helper mode):** tap the big RICKY & BOBBY button in the game (next to the attack buttons) and they swoop in with their intro and follow you. Then they hunt down the nearest enemy, pounce on it and always KO it (a boss just takes a big hit). They bark, and fly away. If nobody is around, they dance instead. The button has a 25-second rest ring, and tapping it while they're here throws more confetti. It works in all five levels. On the farm they herd a runaway pig instead of fighting.
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
| Sea Turtle (v5.5) | SHELL SPIN: tucks into its shell and spins through foes (with a happy "wheee!") | SHELL SHIELD: a glowing bubble for a few seconds that bounces attacks right back | tough domed shell; SWIM FAST is a bubbly FLIPPER DASH |

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
