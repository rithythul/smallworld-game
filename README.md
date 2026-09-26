# Noodle Universe

A cozy browser game about **Squareface Guy**, a little AI with a smiley screen for a face, who collects every noodle in the Noodle Universe and uncovers the mystery of the Golden Noodle.

## Play

No build step. Serve the folder and open `index.html`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

**Controls:** WASD / arrows to move, Space to act (crunch, drink, swim, talk), `N` Noodle-dex, `J` clue journal.

**Phones and tablets:** drag anywhere to walk (the joystick follows your thumb), tap the big button to act, and hold it to drink. The layout adapts to portrait, landscape and tablets. Tap the full-screen button (where the browser supports it), or use **Add to Home Screen** to play it like an app.

## What's in this version (Chapters 1 to 3)

- Ramen Village, Crunch Meadow, the stream and Spaghetti Woods
- Crunching with combos, a hydration meter, and drinking from the stream
- A day/night clock, with the Morning Pool open only from 6 to 8 AM (bubble mini-game + Fresh Start buff)
- 24 noodles to collect in the Noodle-dex
- The first part of the Golden Noodle hunt: the Pillow Note, pool tile arrows, the Backwards Willow, and a noodle-letter cipher
- **Chapter 2, Crunch Canyon:** a boulder wall to crunch open, the Echo Rock, the rhythm drum, the Mirror Pond with backwards writing, the Udon Snail, the Minty Spring and 3-hit boulder bricks
- **Chapter 3, Soba Peaks:** the mountain fog lifts, a snowy climb, the Face Statue puzzle, an icy mountain lake, the Soba Birds, and afternoon storms with Thunder Udon
- Daily Fortune Cracker riddles and the Noodle Oracle hint shop
- Auto-save in the browser

See [GAME_DESIGN.md](GAME_DESIGN.md) for the full design.

## Deploy on Render

This repo includes a `render.yaml`, so Render can set everything up for you.

1. Push this branch to GitHub (or merge it into `main`).
2. Go to [dashboard.render.com](https://dashboard.render.com), click **New +** then **Blueprint**.
3. Connect your GitHub account and pick the `squarefaceguy` repository and branch.
4. Render reads `render.yaml` and creates a free **static site** called `noodle-universe`. Click **Apply**.
5. After a minute you get a public link like `https://noodle-universe.onrender.com`.

Manual setup works too: **New +** then **Static Site**, pick the repo, leave the build command empty (or `echo ok`), and set the publish directory to `.`.

Every push to the connected branch redeploys the site automatically.

## Code

| File | What it does |
|---|---|
| `js/data.js` | Noodles, map layout, clues, riddles |
| `js/art.js` | All drawing (characters, world, icons), no image files |
| `js/audio.js` | Synthesized sound effects |
| `js/ui.js` | HUD, dialogue, Noodle-dex, journal |
| `js/game.js` | Game loop, movement, rules, the hunt |
