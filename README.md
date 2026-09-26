# Small World

A little 3D town that works like the real world, for kids aged 6 to 16. You play **Squareface**, a new citizen of Small Town. Work a job, go to school, save at the bank, buy land, farm, build a house or a shop, pay taxes, vote, run for mayor, and work step by step toward your dream. Play alone or with friends in the same shared town.

## Play

The game runs on a small Node server (it also hosts multiplayer towns, the leaderboard and online saves):

```sh
npm install
npm start
# then open http://localhost:3000
```

**Controls:** WASD or arrows to walk. Space, E or the big button does whatever is nearby: talk, plant, water, harvest, chop, buy land, deliver a letter. With nothing nearby, Space hops. `M` opens the map, `1` to `6` make faces, `C` opens chat in a room. Scroll to zoom.

**Phones and tablets:** drag anywhere to walk, tap the big button to do things, and tap quickly to hop.

## Small World: what's in the town

- **Work:** at the 💼 Jobs office, pick a job and go to work. There are 7 jobs: Farmhand, Lumberjack, Mail Carrier, Builder, Town Clerk, Bank Teller and Tutor. A shift is a few small tasks, marked by yellow diamonds. The pay slip shows the wage, the income tax that goes to the town, and what you keep. Experience gives raises. You can work 3 shifts a day.
- **School:** 🏫 classes in Money, Civics, Building, Math and Science, with questions for ages 6–8, 9–12 or 13–16. Pass 2 classes in a subject to earn its certificate. Certificates unlock better jobs. Classes are free because taxes pay for the school.
- **Bank:** 🏦 savings earn 2% interest every morning. Loans cost 5% a day. You can borrow more when you hold certificates and land.
- **Market:** 🧺 sell crops and logs. Prices follow supply and demand: every sale lowers the price a little, and prices recover over time. Buy logs from the sawmill.
- **Land:** 12 farms and 12 building lots are for sale, and each has a daily land tax. Farms have 6 soil beds: buy seeds, plant, water and harvest. On a lot you can build a house (no more rent) or a shop (customers buy from your shelf every morning at a markup).
- **The forest:** chop a tree for logs, then plant a sapling on a stump before you chop again ("cut one, plant one"). The forest closes when too few trees are left.
- **The town:** 🏛️ taxes fill the treasury. Citizens vote on projects: a fountain, street lights, a bus line, a park, a library and a clinic, then festivals and new forests forever. Each project appears in the 3D town when it is built. Anyone with the Good Citizen certificate can run for mayor. The mayor sets the tax rate, and their project vote counts 3 times.
- **Every morning:** a budget card shows the rent, land taxes, savings interest, loan interest and shop sales. If you can't pay the bills, the bank lends the rest, and that loan costs interest.
- **Dreams:** choose to become a Farmer, Builder, Shopkeeper, Mayor, Banker or Teacher. Each dream is a path of real steps, and the yellow diamond shows the way to the next one. After the last step the dream keeps levelling up forever, and your title shows over your head.
- **Day and night:** a Small Town day is 6 minutes. Everyone in a room shares the same clock, so the whole room has the same day and night.
- **Friends:** type a room name (3 to 8 letters or numbers) to share one town: the same land, market prices, votes and mayor. Towns are saved on the server. You can chat (bad words, links and phone numbers are hidden), make faces, and use WebRTC voice (a grown-up says OK first).
- **Healthy play:** breaks, a daily play limit, and grown-up settings behind a math question (⋯ menu → 🔒).
- **The Small World mark:** the logo, recoloured in the town's greens, is mown into the lawn beside the plaza (`icons/smallworld-mark.png`; the original is `icons/smallworld-logo.png`).

The 3D is made with [three.js](https://threejs.org) (MIT, bundled in `js/vendor/`). All models are built in code: no model files to download.

## Classic: Noodle Universe

The original 2D game is still here at `classic.html` (⋯ menu → 🍜 Classic Noodle Universe).

### What's in the classic game

- **Story (3 chapters so far):** the Pillow Note, pool tiles at dawn, the Backwards Willow and a noodle cipher; Crunch Canyon with the Echo Rock, the rhythm drum, the Mirror Pond and the Udon Snail; the Soba Peaks with the Face Statue. The journal's **Story** tab always shows the next step and where to look. Tap the goal for a yellow guide arrow.
- **World:** Ramen Village, Crunch Meadow, Spaghetti Woods, Crunch Canyon, Soba Peaks, the Morning Pool (6–8 AM), day and night, storms.
- **The Endless Frontier (Chapter 4):** after Chapter 3 the Cloud Gate east of the Soba Peaks opens, and the map keeps growing forever. Each new land (Candy Dunes, Mushroom Marsh, Crystal Tundra, Bamboo Breeze, Lava Ladle, Cloud Meadows, Coral Coast, Autumn Orchard, then *Whispering*, *Sparkly*… versions of them) has its own Keeper, bricks, food trees and a Map Stone missing 3 star shards: one in a crystal brick, one on a tall pillar (hop to grab it), one for answering the Keeper's science question. Restore the stone and the next land opens. Every land gets its own page on the world map.
- **Physics and skills:** gravity and hopping; deep water needs swimming lessons (Coach Kombu), flying needs flight lessons (Captain Penne). After 3 lessons each skill keeps levelling forever.
- **Food:** 10 kinds of trees; shake them for food, eat it, or cook 6 recipes with Grandma for special powers.
- **Endless play:** 25 noodles, 3 new daily challenges every morning, stars and an endless Noodle Level, big challenges, space daydreams with Guide Stars and a space suit.
- **Multiplayer:** type any room name (3 to 8 letters or numbers, like `67NM`) and tap Enter room. If it's new, you create it; friends type the same name or tap your shared invite link. Up to 8 players per room. *Team up* shares the Noodle-dex and fills a Team Pot that keeps growing; *Race* runs 2-minute Crunch Races for trophies. Players pick unique colors, see each other's faces and send emotes. When a new friend joins, everyone already in the room gets a pink arrow to them and a thank-you for going to say hi.
- **Room chat and voice:** tap 💬 (or press `C`) to chat. Kids can send quick phrases like "Follow me!" or type up to 80 letters; words show in a bubble over their Squareface. Bad words, links, emails and phone numbers are hidden, messages are never stored, and any player can be hidden with one tap. **Join voice** talks over WebRTC, straight between players (up to 8), with a mute button and a green glow on whoever is speaking. Voice needs a grown-up's OK the first time on each device.
- **The world is an instrument:** every brick plays a note (marimba in the meadow, drums in the canyon, bells in the snow, and a new instrument in every Frontier land). A combo climbs up the scale like a melody. Your antenna blinks on the beat: crunch in time for harmony and "In the groove!". In a room you hear your friends' crunches as music, and crunching together makes ♪ HARMONY ♪.
- **Faces:** tap 😊 (or press 1 to 6) to show a face on Squareface's screen: love, laugh, wow, cool, silly, sad. Friends see it right away, no reading needed. Typed chat and voice are still there with 💬.
- **Wonders:** rare surprises that everyone playing sees at the same moment: Noodle Rain, the Sky Whale, the Giggle Brick, the Noodle Rainbow and Shooting Stars. They never run out, and your journal remembers every one you saw.
- **Rituals:** a morning swim when the pool opens, a sunset sip from the stream, and going home at night. Each gives ⭐ +1 once a day.
- **Grandma's shop:** spend coins on hats (friends see them), rocket fuel, Fortune Crackers and broth; sell the food you pick for coins.
- **Rewards:** every Noodle Level gives something (coins, hats, sparkle trails, a golden antenna, a crown), forever. 1 in 40 finds turns a noodle golden (shiny).
- **Live map:** always on screen (top-right on phones and tablets, bottom-left on computers), zoomed in around you with your friends and a ⭐ pointing to your goal. Tap it for the full map.
- **World map:** press M or tap 🗺️. Explored areas reveal themselves, landmarks appear once found, the goal is starred, and you can drop a pin to follow.
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

**Keep saves and the leaderboard:** the free plan sleeps after about 15 minutes without players and its disk is wiped on every restart or deploy, which erases online saves, shared towns and the leaderboard. To keep them, use a paid instance, add a **Disk** (mount path `/var/data`) and set the environment variable `DATA_DIR=/var/data`. The free plan also takes about 30 seconds to wake up for the first visitor.

**How many players?** Each room holds up to 8 players, and there can be many rooms at the same time. A single free Render instance comfortably handles a few dozen players at once.

## Code

| File | What it does |
|---|---|
| `index.html`, `css/sw.css` | Small World page and styles |
| `js/world3d.js` | The 3D town (three.js): buildings, farms, forest, projects, Squarefaces, name tags, day and night, walking |
| `js/sw.js` | Small World game: HUD, places, jobs, school, bank, market, land, dreams, rooms |
| `js/town.js` | Town rules shared by the browser and the server: land, crops, prices, forest, taxes, votes, elections |
| `js/life.js` | Your life's rules: money, jobs and wages, certificates, bank, morning bills, dreams |
| `classic.html` | The classic 2D Noodle Universe |
| `js/data.js` | Noodles, map layout, clues, riddles |
| `js/art.js` | All drawing (characters, world, icons), no image files |
| `js/audio.js` | Synthesized sound effects |
| `js/ui.js` | HUD, dialogue, Noodle-dex, journal |
| `js/game.js` | Game loop, movement, physics, rules, story, hints |
| `js/net.js` | Multiplayer connection |
| `js/space.js` | Space daydreams |
| `js/care.js` | Breaks, daily play time and grown-up settings |
| `js/lands.js` | The Endless Frontier: lands made from their number, their Keepers and drawings |
| `js/talk.js` | Room chat, quick phrases and WebRTC voice |
| `server.js` | Node server: static files, rooms, shared Small World towns, leaderboard, online saves |
