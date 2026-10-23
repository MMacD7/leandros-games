# Leandro's Dinosaur World

A dinosaur game for kids with no ads, no purchases, no links to other sites, and no tracking.
Once it loads, it runs fully offline. Every dinosaur is unlocked by playing.

## Put it on an iPhone or iPad
1. Open the game link in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**.
3. Launch it from the "Dino World" icon. It runs full-screen and works without internet.

## How to play
- **Island**: drag on the left side to walk. Use the buttons on the right: red = bite/eat, blue = roar, yellow = sprint (hold).
  Eat the right food for your dino (meat, leaves, or fish; the arrow points to the nearest food), and grow from hatchling to juvenile to adult.
  Collect golden eggs and fossils. If your dino gets tired, it naps at the nest and keeps everything it has earned.
- **Run**: tap to jump. Swipe down, or hold the red button, to duck and chomp. Dodge rocks, logs, and fireballs, and grab snacks.
- **Bones** come from both modes. They are never spent. Your total unlocks new dinos: Raptor, Triceratops,
  Stegosaurus, Pteranodon, Ankylosaurus, Spinosaurus, Brachiosaurus, and T-Rex.

Progress is saved on the device (localStorage).

## Tech
Static HTML5 canvas and vanilla JS. No build step and no libraries. All art is drawn in code, and all sounds are synthesized with WebAudio.
`sw.js` caches every file for offline play. `tools/make-icons.html` is only used to regenerate the icons.
