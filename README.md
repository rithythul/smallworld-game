# Noodle Universe

A cozy browser game about **Squareface Guy**, a little AI with a smiley screen for a face, who collects every noodle in the Noodle Universe and uncovers the mystery of the Golden Noodle.

## Play

The game runs on a small Node server (it also hosts multiplayer, the leaderboard and online saves):

```sh
npm install
npm start
# then open http://localhost:3000
```

Opening `index.html` without the server still works for solo play; multiplayer, the leaderboard and online saves need the server.

**Controls:** WASD / arrows to move, Space to act (crunch, drink, swim, talk, shake), F or Shift to hop and fly, `N` Noodle-dex, `J` journal, `M` map.

**Phones and tablets:** drag anywhere to walk (the joystick follows your thumb), tap the big button to act and hold it to drink, HOP/FLY button to jump and fly. Portrait, landscape and tablets all have their own layout. Use the ⋯ menu for full screen, or **Add to Home Screen** to play it like an app.

## What's in the game

- **Story (3 chapters so far):** the Pillow Note, pool tiles at dawn, the Backwards Willow and a noodle cipher; Crunch Canyon with the Echo Rock, the rhythm drum, the Mirror Pond and the Udon Snail; the Soba Peaks with the Face Statue. The journal's **Story** tab always shows the next step and where to look. Tap the goal for a yellow guide arrow.
- **World:** Ramen Village, Crunch Meadow, Spaghetti Woods, Crunch Canyon, Soba Peaks, the Morning Pool (6–8 AM), day and night, storms.
- **Physics and skills:** gravity and hopping; deep water needs swimming lessons (Coach Kombu), flying needs flight lessons (Captain Penne). After 3 lessons each skill keeps levelling forever.
- **Food:** 10 kinds of trees; shake them for food, eat it, or cook 6 recipes with Grandma for special powers.
- **Endless play:** 25 noodles, 3 new daily challenges every morning, stars and an endless Noodle Level, big challenges, space daydreams with Guide Stars and a space suit.
- **Multiplayer:** type any room name (3 to 8 letters or numbers, like `67NM`) and tap Enter room. If it's new, you create it; friends type the same name or tap your shared invite link. Up to 8 players per room. *Team up* shares the Noodle-dex and fills a Team Pot that keeps growing; *Race* runs 2-minute Crunch Races for trophies. Players pick unique colors, see each other's faces and send emotes. When a new friend joins, everyone already in the room gets a pink arrow to them and a thank-you for going to say hi.
- **Room chat and voice:** tap 💬 (or press `C`) to chat. Kids can send quick phrases like "Follow me!" or type up to 80 letters; words show in a bubble over their Squareface. Bad words, links, emails and phone numbers are hidden, messages are never stored, and any player can be hidden with one tap. **Join voice** talks over WebRTC, straight between players (up to 8), with a mute button and a green glow on whoever is speaking. Voice needs a grown-up's OK the first time on each device.
- **Grandma's shop:** spend coins on hats (friends see them), rocket fuel, Fortune Crackers and broth; sell the food you pick for coins.
- **Rewards:** every Noodle Level gives something (coins, hats, sparkle trails, a golden antenna, a crown), forever. 1 in 40 finds turns a noodle golden (shiny).
- **World map:** press M or tap 🗺️. Explored areas reveal themselves, landmarks appear once found, the goal is starred, and you can drop a pin to follow. Desktop has a minimap.
- **The Udon Snail's trip:** after Chapter 2 the snail walks to the Soba Peaks over 7 real days and brings a gift.
- **Healthy play for kids:** grown-up settings (⋯ menu → 🔒) for breaks, play time, chat and voice; a 5-minute break after 20 minutes of play, 60 minutes of play per day, and grown-up settings behind a math question. "Going to eat" pauses the game; in team rooms friends see you are away and earn you thank-you coins.
- **Leaderboard:** coins, noodles, stars and trophies across everyone playing online.
- **Online saves:** save with a name and a 4-digit PIN, load it on any device. There is no recovery: forget the PIN and you start a new game.

See [GAME_DESIGN.md](GAME_DESIGN.md) for the original design.

## Deploy on Render

Multiplayer needs a **Web Service** (a Static Site can't run the server). `render.yaml` sets it up.

1. Merge this branch into `main` (or use this branch directly).
2. If you already have a Static Site called `noodle-universe`, delete it first (Settings → Delete) so the new service can keep the `noodle-universe.onrender.com` address.
3. In the Render dashboard click **New +** → **Blueprint**, pick the `squarefaceguy` repo and branch, and click **Apply**. Render runs `npm install` and `npm start`.
4. Open `https://noodle-universe.onrender.com` and try **Play with friends**.

Manual setup: **New +** → **Web Service**, pick the repo, Runtime **Node**, Build Command `npm install`, Start Command `npm start`.

**Check it works:** open `https://<your-site>.onrender.com/healthz`. It should show `ok`. If it says Not Found, the site is still a Static Site and multiplayer will not work.

**Warning "package-lock.json found … Yarn"?** Render picked `yarn` as the build command. It is harmless, but set **Settings → Build Command** to `npm install` to match this project's `package-lock.json` (do not delete the lock file).

**Voice chat on strict networks:** voice connects players directly using free STUN servers, which works on most home Wi-Fi. Some school and phone networks block that; to relay voice there, add a TURN server (for example from Metered or Twilio) with the environment variables `TURN_URL` (like `turn:your.server:3478`), `TURN_USER` and `TURN_PASS`.

**Keep saves and the leaderboard:** the free plan sleeps after about 15 minutes without players and its disk is wiped on every restart or deploy, which erases online saves and the leaderboard. To keep them, use a paid instance, add a **Disk** (mount path `/var/data`) and set the environment variable `DATA_DIR=/var/data`. The free plan also takes about 30 seconds to wake up for the first visitor.

**How many players?** Each room holds up to 8 players, and there can be many rooms at the same time. A single free Render instance comfortably handles a few dozen players at once.

## Code

| File | What it does |
|---|---|
| `js/data.js` | Noodles, map layout, clues, riddles |
| `js/art.js` | All drawing (characters, world, icons), no image files |
| `js/audio.js` | Synthesized sound effects |
| `js/ui.js` | HUD, dialogue, Noodle-dex, journal |
| `js/game.js` | Game loop, movement, physics, rules, story, hints |
| `js/net.js` | Multiplayer connection |
| `js/space.js` | Space daydreams |
| `js/care.js` | Breaks, daily play time and grown-up settings |
| `js/talk.js` | Room chat, quick phrases and WebRTC voice |
| `server.js` | Node server: static files, rooms, leaderboard, online saves |
