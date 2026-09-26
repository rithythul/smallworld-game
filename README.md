# Noodle Universe

A cozy browser game about **Squareface Guy**, a little AI with a smiley screen for a face, who collects every noodle in the Noodle Universe and uncovers the mystery of the Golden Noodle.

## Play

No build step. Serve the folder and open `index.html`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

**Controls:** WASD / arrows to move, Space to act (crunch, drink, swim, talk), `N` Noodle-dex, `J` clue journal. On phones, drag anywhere to move and tap the big button.

## What's in this version (Chapter 1)

- Ramen Village, Crunch Meadow, the stream and Spaghetti Woods
- Crunching with combos, a hydration meter, and drinking from the stream
- A day/night clock, with the Morning Pool open only from 6 to 8 AM (bubble mini-game + Fresh Start buff)
- 12 noodles to collect in the Noodle-dex
- The first part of the Golden Noodle hunt: the Pillow Note, pool tile arrows, the Backwards Willow, and a noodle-letter cipher
- Daily Fortune Cracker riddles and the Noodle Oracle hint shop
- Auto-save in the browser

See [GAME_DESIGN.md](GAME_DESIGN.md) for the full design.

## Code

| File | What it does |
|---|---|
| `js/data.js` | Noodles, map layout, clues, riddles |
| `js/art.js` | All drawing (characters, world, icons), no image files |
| `js/audio.js` | Synthesized sound effects |
| `js/ui.js` | HUD, dialogue, Noodle-dex, journal |
| `js/game.js` | Game loop, movement, rules, the hunt |
