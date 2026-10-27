# v4 "more dinos, dragons and another level" — progress notes
Started 8:40 PM ET Oct 23. A backup of v3 (same as the live site) was kept.

## Plan / status
- [x] S1 new real dinos (giga, allo, dilo, pachy, para) + robots (gmech, dblast) + specials (rage, combo, spit, headbutt, honk / quake, goo) — beast.js/mech.js/data.js/game.js
- [x] S2 dragons in beast.js (dragon body plan, fire/ice/storm + king), robo-dragon in mech.js, DRAGONS list, flight + wing flap, element orbs + breaths, garage 'Dragons' tab. Scale bumped to 1.2, girthier body, closer garage camera.
- [x] S3a Dragon Peak world: js/peak.js (heightfield, lava sea shader, ash terrain + glowing veins, dead trees, crystals, spires, castle-ruins arena, floating islands, nests w/ glowing eggs, lightning, sky canvas). World(level) with root group; mayhem.setWorld caches props/lava per world; game.setWorld; env swap (sky/PMREM/fog/sun/hemi/exposure); title level buttons + travel overlay; peak/peakbattle/dragonboss music. Test screenshots look good.
- [x] S3b gameplay check on peak (v4smoke.js): all 11 new creatures attack, flight climbs, King spawns w/ bar, peak spawns, travel back. Jungle excludes dragons + giga/allo/dilo/gmech/dblast. Breath aim-assist for flyers.
- [x] S4 rider seats OK on all 27 (verify), garage gallery checked
- [x] S4b VOICE CALLOUTS (parent steer 9:19 PM): js/voice.js speechSynthesis queue/rate-limit/duck/prime; 🗣️ toggle (b-voice/p-voice, save.voice); LEANDRO WINS banner (#banner.win) on wave clear/boss KO/battle end; streaks, boss/king incoming, travel welcome, garage name, Let's go Leandro
- [~] S5 verify.js extended (v4 block + NALL=27); iphone-landscape all PASS except 2 test bugs (fixed); full 4-viewport run in progress
- [~] S6 shots4.js -> drafts good; final into screenshots/ after tests
- [x] README updated
- [x] S4c RICKY & BOBBY (parent steer 9:47 PM): js/westies.js (procedural Westies, capes/collars, spotlights, confetti, announcer intro, bark stun / fetch power-up, flee on danger, invincible, cooldown 110s/60s victory), sfx.bark/cheer; westie.js test PASS; README section added; verify.js has R&B check
- [~] 10:37 PM resume: sw.js regenerated (f4bf87b148); 4-viewport verify running sequentially final shots in screenshots/v4-* (king/wins/giga/garage re-running after a SwiftShader screenshot timeout)
- [x] Final screenshots in screenshots/v4-*.png (9 incl. leandro-wins-banner, ricky-bobby-entrance)
- [~] verify run 1 (iPhones, under CPU contention): only test-timing fails (missile real-time timers, stray missile KO'ing the fight-back rex, music sync before next frame, speech log checked inside a sync evaluate) -> verify.js hardened; ipads running with the fixed file, then iPhones re-run
- [x] S7 sw.js (cache robo-dino-island-f4bf87b148), copied to leandros-games (diff clean), site zip (40 files), upload-stage: robo-dino-island_js (14), robo-dino-island_css (1), robo-dino-island (README, index.html, sw.js); no deletions; launcher unchanged
- [~] verify run 2 (fixed tests, sequential, 4000s timeout each)

## v4.1 "Have the second level selectable" / "make it more obvious" (Oct 24, 7:00 AM ET)
- [x] Title: the small pills are replaced by two big level cards (#lv-jungle and #lv-peak, same ids, data-lv). The DRAGON PEAK card is the eye-catcher: a lava pulse border, a gentle bounce, a NEW! badge and 🌋🐉. It's bigger than the Play button and comes first in portrait.
- [x] In-game chooser: #levels screen (lvd-jungle/lvd-peak/lvd-close), opened from the HUD 🗺️ (#b-map) and Pause → 🗺️ Change level (#p-map). It uses the same travel().
- [x] Auto-update:
  - register with updateViaCache:'none'
  - reg.update() on load and visibilitychange
  - one reload on controllerchange (sessionStorage 15 s loop guard)
  - SW: network-first (4 s timeout → cache) for navigations, html, js, css and the manifest; addAll with cache:'reload'; on upgrade the activate step navigates open windows once, which rescues stuck v3/v4 pages
  - gen-sw.py updated
- [x] v4.1 label on the title (#ver).
- [x] One-time "New level unlocked, Leandro! Dragon Peak!" on the first tap. It respects the voice toggle; the flag is localStorage 'robo-dino-island.announced.peak'.
- [x] dino-world:
  - sw.js gets the same network-first update logic (cache leandros-dino-world-v3)
  - main.js gets the updateViaCache, update and controllerchange changes
  - edited the separate dino-world game and kept a backup
- [x] Garage:
  - The new creatures come first in each tab (giga/allo/dilo/pachy/para, gmech/dblast, dragons).
  - NEW! badges on the name, dots and tabs.
  - The first garage open after the update lands on Giganotosaurus (localStorage 'robo-dino-island.seen.newgarage').
  - Title callout '🆕 NEW: 7 dinos + 4 dragons!' (it opens the garage) next to the v4.1 label.
- [x] 🐶 RICKY & BOBBY HUD button (#b-rb):
  - Sits left of the action cluster in landscape and above it in portrait.
  - 25 s cooldown with a conic ring and a seconds countdown.
  - Tapping while the dogs are here does westies.barkBlast(). Random visits are kept.
- [x] Targeted test v41.js:
  - 4 viewports: 57/58 pass. The one failure was the iPhone-landscape garage tabs at 27px tall; I fixed it to 8px padding and the iPhone re-run passed 28/28.
  - Test fix: the bouncing peak card needs tap({force:true}) because Playwright sees it as 'not stable'.
- [x] dino-world SW check (dw41b.js): registers, controls the page, no reload loop, works offline.
- [x] Released:
  - sw cache robo-dino-island-3c50af2373
  - copied to leandros-games (diff clean)
  - zip rebuilt
  - upload-stage: robo-dino-island_js (main.js, westies.js), robo-dino-island_css (style.css), robo-dino-island_tools (gen-sw.py), dino-world_js (main.js), dino-world (sw.js), robo-dino-island (README.md, index.html, sw.js)
  - no deletions

## v4.2 (Oct 24, 7:45 AM ET): dogs dance + fly away, spoken names, no-cooldown multi-touch attacks
- [x] Westies:
  - Sequence is enter → dance (5 s: alternating hops, a mirrored jump-spin, a butt wiggle, rear-up, fast tail wag, confetti, spotlights, cheer) → fly away (flapping capes, sparkle trail, shrink into the sky) → off.
  - help, barkBlast, barks and stun are removed. Danger nearby makes them fly off early.
  - Tapping 🐶 while they're here throws more confetti. The 'BARK!' label is gone; the R&B cooldown is kept.
- [x] Voice:
  - voice.speakable() normalizes every spoken line: & → and, no 3+ repeated letters, ALL-CAPS words → Capitalized, KO → knockout, T-Rex → T. rex, hyphens → spaces, emoji stripped.
  - Source literals are fixed too ('Leandro wins!', 'Leandro!', creature names as written, streak lines 'Double knockout!' …).
  - Westie lines: "…Ricky!", "And... Bobby!", "It's Ricky and Bobby!".
  - Bug fix: a prio-3 line no longer cancels another prio-3 line that's mid-sentence.
- [x] Attacks:
  - No player cooldowns; each tap fires, up to 4 per frame. Holding auto-repeats (laser at its fire rate, the others every 0.22 s).
  - Pointer events per button with their own pointerId sets and pointer capture, so several buttons can be held together with the joystick.
  - Cooldown rings are hidden. The missile pool is capped at 48 (the oldest fizzles).
- [x] Title v4.2, README updated, sw regenerated.
- [x] Test v42.js (iPad landscape): 15/15 pass. Screenshots v42-dance.png and v42-flyaway.png.
- [x] iPhone landscape (844x390) v42.js: 15/15 pass after a test-only fix (the entry wait loop was 4.0 s exactly, so it raced the 4 s enter timeout).

## v4.3 (Oct 24, 8:00 AM ET): Ricky & Bobby clearly visible
- [x] Dogs scaled 2.1 → 4.4 (DOG_S), spotlights ×1.7, and the beam opacity lowered so it doesn't wash them out.
- [x] Stage:
  - One dog on each side of the player, 4 m ahead, on two glowing floating dance floors at about eye height. That puts them in the HUD-free middle band of the screen and above ground clutter.
  - The lateral distance comes from the player's oriented footprint (dino + rider + wings, via Westies.footprint) in perspective, so they clear the silhouette for rex, gmech and dragons. The dogs fly in with capes and sparkles and face the camera.
- [x] Camera:
  - Game.updateCamera eases back to stage.need and turns to the stage yaw (unless the player is steering it) while the dogs are active.
  - It restores smoothly after the fly-away (stageK lerp).
- [x] The R&B banner sits higher (#banner.rb top 15%). The "Here come…" toast is dropped.
- [x] Test v43.js (iPhone landscape 844x390 + iPad 1180x820; rex, gmech, dfire) projects dog and player boxes to the screen: 16/16 pass.
  - Dogs fully in view, no overlap with the player box, ≥12% of the screen height, ≤15% under HUD buttons.
  - Camera restored after.
- [x] Screenshots v43-dance-iphone.png and v43-dance-ipad.png. v4.3 label, sw regenerated, released.

## v4.4 (Oct 24, 2026 ET): smaller Ricky & Bobby + a couple of barks
- [x] DOG_S 4.4 → 2.5 (57%). Spotlights scale with the dogs (1.7 → 1.0). Dance hop heights × 0.6 (HOP), so max body lift is ~1.2 m instead of ~4.8 m.
- [x] Barks: new procedural yip() in audio.js (sawtooth 525–780 Hz with a quick rise-then-fall, band-passed, soft). sfx.bark(p, v, n). In the dance (Westies.barkQ): Ricky yip-yip at 0.25 s, Bobby yip-yip (pitch ×1.15) at 0.7 s, Ricky single yip at 3.0 s. A short head toss + open jaw on each bark.
- [x] v4.4 label, sw regenerated (robo-dino-island-b9ed9fe3c3).
- [x] Test v44.js (iPhone 390x844 portrait, iPhone 844x390, iPad 1366x1024; rex, gmech, dfire): all pass. Screenshots v44-dogs-iphone.png, v44-dogs-iphone-landscape.png, v44-dogs-ipad.png.

## v5.0 (Oct 26–27, 2026 ET): Mega City Smash, playable Ricky & Bobby, helper summon, metal music, "on steroids", Deep Sea Showdown
A backup of v4.4 was kept. Tests: v5.js (city/dogs/stampede) and v5-ocean.js (ocean).
- [x] Level 3 MEGA CITY SMASH (js/city.js): destructible buildings, SMASHED meter, waves, MEGA-REX boss, one-time shout. v5.js city phase 57/57.
- [x] Ricky & Bobby playable (Pup in westies.js), helper summon (follow → hunt → KO → bark → fly away) in every level, line-157 fix.
- [x] Procedural heavy-metal music (music.js), per-level tracks + boss riser/hit + intensity layer.
- [x] On steroids: 6 roid dinos (spinotitan, megatrike, raptorpack, brachiotank, lavaanky, tptero), stampedes, LOD, enemy cap, pooled particles.
- [x] Level 4 DEEP SEA SHOWDOWN: js/ocean.js (world), js/sea.js (SeaBeast models), data.js SEA/KRAKEN/MONSTER_MEG, game.js sea moves (ram, crush, zap, grab, ink, shock, tendrils, frenzy, lure, kraken), ▲/▼ swim buttons (input.js up/down, keys E/Q), ocean ENV/levelUI/music/garage Sea tab (main.js), 4th level card + chooser (index.html, css), ocean tracks (music.js), sfx.bubbles/ink/sonar (audio.js), scuba westies (westies.js setScuba), no fire underwater (mayhem.js).
- [x] v5-ocean.js: 74/74 PASS on ipad / iphone / iphone-landscape. FPS (SwiftShader, Kraken battle): ipad 1.5 fps / 1.41 ms cpu, iphone 2.7 / 1.48, iphone-landscape 2.0 / 1.52.
- [x] Screenshots: v5-ocean-ipad.png, v5-ocean-iphone.png, v5-ocean-iphone-landscape.png, v5-scuba-westies.png, v5-scuba-westies-iphone.png, v5-ocean-creatures.png (montage of the garage Sea tab), v5-ocean-title*.png, v5-chooser-4*.png.
- [x] README updated for v5.
- [x] Full v5.js regression after the ocean work: the first pass was 53/57, with 3 test bugs (the Ricky label check now saw the hidden ▲/▼ buttons) and 1 stampede timing flake (sim 8 s → 11 s, because KO slow-mo shortens the sim). After the fixes it is 57/57 PASS. City FPS: ipad 1.3 / 1.58 ms, iphone 2.8 / 2.11, iphone-landscape 2.5 / 1.79.
- [x] Layout polish: 4 level cards fit in portrait and landscape, the garage has 6 tabs on one row, the title counter counts only playable creatures (40), and the newcall text is shorter.
- [x] sw.js regenerated: cache robo-dino-island-f5f8ad8f59 (39 files). Final ocean run after the sw regen: 74/74 PASS, zero console errors. Ocean FPS: ipad 1.5 / 1.52 ms, iphone 2.7 / 1.32, iphone-landscape 2.0 / 1.87 (SwiftShader software GL, not real-device numbers).
- DONE. Nothing uploaded.

## v5.1 (Oct 27, 2026 ET): Farty Poop Farm (level 5)
- [x] New level **Farty Poop Farm**: new `js/farm.js` (farm scenery, animals, feeding, poops, horse riding, Leandro's farm-kid model, Bad David). It's wired into world.js, game.js, main.js, mayhem.js, westies.js, audio.js, music.js, data.js, index.html and style.css.
- [x] You play as Leandro (a cartoon farm kid, no photos). The buttons are FEED / RIDE (HOP OFF) / TOOT / RUN (GALLOP).
- [x] Animals: 3 cows, 3 pigs, 6 chickens, 3 sheep, 2 goats and 1 horse. Each eats its own food, then a happy reaction, then farts and/or poops.
  - Feeding goal: 12 animals, with 3 stars.
  - Win screen: FARM HERO, with fireworks and a fart symphony, then a new round.
  - Poop piles persist and are squishable. Golden poops can be collected.
- [x] Horse: ride / gallop / gallop farts / hop off.
- [x] Ricky & Bobby on the farm: they herd a runaway pig, sniff poop, roll in mud, do a dog toot and fly away. The dogs are farm-sized here.
- [x] BAD DAVID button: an original character with 8 gentle pranks and "DAVID, NOOO!" speech bubbles. No animal is ever hurt.
- [x] Procedural farts: 8 kinds plus the machine. Also plops, squish, splash, pie, munch and the animal voices.
- [x] Hoedown music for the title and for play.
- [x] Fixes found along the way:
  - Leftover volcano smoke particles are cleared when you change level.
  - Voice/envelope gain ramps are clamped, so a 0 volume can't throw.
- [x] Test v51-farm.js: 109/109 PASS on ipad / iphone / iphone-landscape, including regression travel through the other 4 levels, with zero console errors.

## v5.2 (Oct 27, 2026 ET): wetter, funnier Farty Poop Farm
- [x] Naming: Bobby no longer gets a label; the pair is simply "Ricky and Bobby" everywhere (westies intro line, Bobby's garage description, README, these notes).
- [x] audio.js: a new fart engine with 14 variants plus the machine. It layers a wobbly tone, a resonant filter, wet splutter bursts, bubble pops and a splash/sputter tail, with pitch slides, squeak endings, stutters and encores. Peak gain is clamped. `renderFart()` renders a variant offline for the tests.
- [x] New procedural sounds: boing, stars, sparkle, slip, trip and the neigh-laugh.
- [x] farm.js:
  - Big bouncy fart clouds with bubbles, and squash & stretch plus a fart-jump.
  - Each animal reacts in its own way: cow bug-eyes, pig wiggle and fart-hop, chicken feather puff and surprise egg, sheep fluff, goat headbutts a hay bale.
  - Poop: boing landing, flies, a star splat, and golden sparkles.
  - Leandro: nose-hold and fan, a poop pratfall, the toot fart-jump and a victory dance.
  - Horse: laugh, buck-dance, mane flip, and a fart-boost turbo with a cloud trail.
  - Bad David: more slapstick, plus the new pogo and rope-swing pranks.
- [x] westies.js (farm only): zoomies, mud slip, sock tug-of-war, a tiny dog poop, a toot that scares them, and a fart-rocket exit.
- [x] Version v5.2, and sw.js regenerated.

## v5.3 (Oct 27, 2026 ET): farm-only release
- [x] Ricky and Bobby's farm intro is exactly "Look it's Ricky and Bobby, they are going to POOOOPY!": a big bouncy on-screen shout (`#shout`), also spoken by voice.js, with no other intro line on the farm.
- [x] Bad David's entrance shouts "NOOO DAVIDD!" then "THATS NOT FUNNY DAVID!!" (big bubbles plus voice), followed by 2 or 3 fast goofy laps (1.5 to 2 s) around Leandro, the horse or the tractor before every one of the 10 pranks, with giggles, dust puffs and his tongue out.
- [x] Drivable tractor: DRIVE / HOP OFF, a putt-putt engine, exhaust puffs, bouncy suspension, a moo-horn HONK, poop squishing and hay-bale pushing. It's slower than the horse.
- [x] Leandro's Celtic-style hooped kit (#018749 and white), white shorts and hooped socks. No crest, sponsor or logo, and no backpack anywhere (rider.js).
- [x] Bouncy castle: wobbly turrets and a squishy floor. Auto-bounce with a boing and a squeak, and JUMP for big bounces with flips. Guest animals, the dogs and Bad David bounce on it too, with fart-bounces.
- [x] Big walk-in chicken coop with 6 nest boxes. Collecting eggs increases the egg counter, with a golden egg about 15% of the time. Entering the coop makes the chickens panic (feathers and clucks).
- [x] SUPER STINKY button with a ~4 s cooldown: wind-up wobble and rumble, a layered long wet blast, a camera shake, a big brown cloud, stink lines and 2 buzzing flies. Nearby animals faint and pop back up, then 2 to 4 generic cartoon visitors walk up, shout "EEEEWWW!" (bubble plus voice), hold their nose and run off.
- [x] Version v5.3, and sw.js regenerated.
- [x] (v5.4 Jungle Island excitement shipped next; see below.)

## v5.4 (Oct 27, 2026 ET): Jungle Island excitement (level one only)
- [x] New js/hype.js (JungleHype). It's active only on Jungle Island, and the other 4 levels are untouched.
  - Dramatic entrances: a roar, ground shake, dust and rings, throttled to one every ~3 s.
  - Hit FX: flash, stars, burst ring, a punch thump and shake.
  - Combo callouts (SMASH! at 3, MEGA! at 6, DINO-MITE! at 10, then every 8 more), shown in `#callout` and spoken.
  - Slow-mo finishing KO with a camera punch-in.
  - Volcano rumble + STAMPEDE surprise roughly every 2.5-3.5 minutes, with a camera swoop, plus a swoop on the battle boss reveal.
  - Music intensity builds with nearby fighting, the combo and time spent playing.
  - Sparkling pickups.
- [x] game.js: small hooks (spawn, hit, KO, boss reveal, camera). Roam spawns arrive every 1.6 s, or 0.9 s when fewer than 4 dinos are left (was 2.5 s), on Jungle Island only.
- [x] Version v5.4, and sw.js regenerated.
- [ ] Next: v5.5 sea turtle, then v5.6 city collapses, pause/home, Robo Dinos toggle and new dinos.

