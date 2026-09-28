# Small World

A little 3D town that works like the real world, for kids aged 6 to 16. You play **Squareface**, a new citizen of Small Town. Work a job, go to school, save at the bank, buy land, farm, build a house or a shop, pay taxes, vote, run for mayor, and work step by step toward your dream. Play alone or with friends in the same shared town.

## Play

The game runs on a small Node server (it also hosts multiplayer towns, the leaderboard and online saves):

```sh
npm install
npm start
# then open http://localhost:3000
```

**Controls:** WASD or arrows to walk. Space, E or the big button does whatever is nearby. With nothing nearby, Space hops. `R` gets on or off your vehicle, `M` opens the map, `1` to `6` make faces, `C` opens chat in a room. Scroll to zoom.

**Phones and tablets:** drag anywhere to walk, tap the big button to do things, and tap quickly to hop.

## Small World: what's in the town

The UI is pictures first. One big button does whatever is in front of you, and a yellow arrow (on the ground and at the screen edge) always points to your next step.

### Rules that grow up with you

The age picked for a new life sets its rules. After that, only a grown-up changes it (⋯ → 👤, behind a math question), and a real birthday can move a kid up.

| | Ages 6–8 | Ages 9–12 | Ages 13–16 |
|---|---|---|---|
| Pay | every task pays at once | at the end of a shift | at the end of a shift |
| Income tax | none (the Mayor pays it, so the town still grows) | half | full |
| Rent, land tax, fuel | none | small | full |
| Short on coins in the morning | never happens | savings pay, then an IOU with no interest | savings pay, then a bank loan with interest |
| Market | at least the usual price | real prices | real prices |
| Classes | picture questions, 2 big answers, retry until right | 3 questions | 3 questions, percent maths |
| Shifts a day | 6 | 4 | 3 |

Coins only go down with a reason you can see: a receipt appears by your coins, and tapping the coins shows the whole money history. For the youngest, coins only go down when they tap Buy.

### A region of towns that never ends

Small Town is only the first town. As everyone works, pays taxes and builds, a new town opens to the east, reached by road and train, forever. Each town has its own kind, look, places, jobs and wants:

| Town | What's there |
|---|---|
| 🏙️ Downtown | office towers, the 📈 Stock Exchange (shares that go up and down, a bakery that pays dividends), office jobs |
| 🏛️ Uptown | mansions and gardens, an art gallery, a concert hall; land costs the most |
| 🌾 Farm Valley | a ranch (milk cows, collect eggs), an apple orchard, cheap farmland, rancher and picker jobs |
| 🏖️ Beach Town | sand and sea, an ice cream stand, a lighthouse, the harbor and airport |
| ⛰️ Mountain Town | snowy peaks you can climb, a crystal mine (miner job), a ski lodge, hot springs, the space center |
| 🎓 College Town | the University (pass the exam for a degree: +10% on every wage), the stadium |
| 🏰 Old Town | a castle and old streets |
| 🛶 Lake Town | cabins and rowing boats |
| 🌵 Canyon Town | red rocks, cactus, a mine and an observatory |
| 🌲 Forest Village | tall pines, a sawmill and treehouses |

Every town has a 🛒 local market that pays more for what that town wants (Downtown pays ×1.5 for milk; the mountains pay more for fish), so it pays to carry things where they are wanted. Every town also has a 🌱 Small World Garden with the Small World mark in the middle. New dreams: Traveler, Rancher, Mountaineer, Investor and Graduate.

### Small Town Days (from Noodle Universe)

- **🌅 Morning swim** in the Sunrise Pool by the Apartments, **🌇 a sunset sip** at the water tap, **🛏️ bedtime** at home. Each gives ⭐ and a few coins in its time window; the pool and tap work all day. All three make a Healthy Day. At bedtime you dream: catch stars and count them while the night passes. Older kids who slept work 10% better the next day, and teens see tomorrow's budget before bed.
- **⭐ Stars and levels:** stars come from rituals, challenges, memories, classes and your dream. Levels never end and bring coins or a new hat your friends can see.
- **🎯 Three challenges a day**, the same for friends in a room. All three is a 🌟 Perfect Day.
- **✨ Wonders:** now and then everyone in the town sees coin rain, a rainbow with a pot of gold, or shooting stars to wish on.
- **First steps:** a new life starts with swim → pick 3 at the Town Farm → sell → save, then picks a dream. Sparkle coins along the way teach "follow the arrow".

- **Dreams (15):** Farmer, Builder, Shopkeeper, Mayor, Banker, Teacher, YouTuber, Digital Marketer, Online Seller, Coder, Chef, Entrepreneur, Explorer, Pilot, Astronaut. Six are shown first; the rest are one tap away. Each dream is a path of real steps, then endless levels. Your name and title float over your head, and over your friends' heads.
- **Work (10 jobs):** Farmhand, Lumberjack, Mail Carrier, Park Ranger, Builder, Town Clerk, Bank Teller, Marketer, Coder, Tutor. Shifts end with a pay slip: wage, income tax, what you keep. Experience brings raises.
- **School:** Money, Civics, Building, Math and Science classes for ages 6–8, 9–12 and 13–16. Certificates unlock jobs, companies, flight school and astronaut training.
- **Money:** savings earn 2% a day, loans cost 5% a day. A morning budget shows rent, land tax, fuel, loan interest, shop and company results and video views.
- **Land and building:** farms (plant, water, harvest; rain waters crops for free), lots for a house, a villa, a shop or a company building.
- **Companies:** Bakery, Restaurant, Toy Workshop, Building Co. (on your own lot), Online Store, Ad Agency, App Studio. Hire staff, upgrade, run ads; revenue minus costs is profit, or a loss.
- **Creators:** take photos in nature, make videos at the Media Studio, gain subscribers, earn from views.
- **An endless town:** taxes, fares, building and projects are "growth". Every time growth reaches the next goal, a new district opens to the east with a train station, two new places (Tech Hub, Business Center, Media Studio, Wheels & Wings, Airport, Harbor, Space Center, Stadium, then Museum, Zoo, Cafe, Arcade, Hotel...), land for sale and a piece of nature (lake, hills, beach, star hill, mushroom grove, meadow). It never stops.
- **Getting around:** the town bus (once voted for) and the train cost a fare and speed up and brake like real vehicles. Buy a bike, scooter, car or plane at Wheels & Wings; each has a daily upkeep.
- **Adventures:** fish, collect shells and crystals, pick berries, swim, watch the stars at night, sit by a campfire. Fly to Sunny Island, Snow Peak, the Safari and the Volcano, or train as an astronaut and walk on the Moon. Every first time becomes a memory in your album.
- **Physics, the same everywhere:** gravity brings hops back down (one sixth of it on the Moon), hills slow you going up, water holds you up, balls bounce and roll downhill and take your momentum when you run into them, chopped trees tip slowly then crash, and vehicles need distance to stop. Each rule comes with a short science card the first time you meet it.
- **The town:** taxes fill the treasury; citizens vote for a fountain, street lights, a bus line, a park, a library, a clinic, festivals and forests; anyone with the Good Citizen certificate can run for mayor.
- **Music:** gentle songs made in code that change with the time of day, trips and space (⋯ → 🎵 to turn off).
- **Friends:** a room name puts everyone in one shared, saved town. Chat, faces and voice (a grown-up says OK first).
- **Healthy play:** breaks, a daily limit and grown-up settings behind a math question.
- **The Small World mark** is mown into the lawn beside the plaza.

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
- **Player cards:** walk up to a friend (the big button shows 👋 and their name), tap a name in the friends list, or open 🪪 My card from your life page. A card shows your Squareface, hat, dream, star level, memories, Perfect Days, nights slept, home and the kinds of towns you have visited. Cards hold no typed words, only numbers and things the game already knows, so they are safe for young kids. 👋 waves back.
- **Online saves:** save with a name and a 4-digit PIN, load it on any device. There is no recovery: forget the PIN and you start a new game.

See [GAME_DESIGN.md](GAME_DESIGN.md) for the original design.

## Deploy on KOOMPI Cloud (Docker)

The game and the multiplayer server run together from the `Dockerfile` in this repo.

1. In [KOOMPI Cloud](https://kconsole.koompi.cloud) create a new app from the `smallworld-game` GitHub repo and branch, and choose **Dockerfile** as the build type.
2. Set the container port to **3000** (or set the `PORT` environment variable to the port KOOMPI Cloud gives you).
3. Add a **persistent volume** mounted at `/data`. Online saves, shared towns and the leaderboard live there; without a volume they are erased on every redeploy.
4. Health check path: `/healthz` (it answers `ok`).
5. Multiplayer uses WebSockets on the same address, so make sure WebSockets are allowed through KOOMPI Cloud's proxy (they usually are by default).

**Try the image on your own computer:**

```sh
docker build -t smallworld .
docker run -p 3000:3000 -v smallworld-data:/data smallworld
# open http://localhost:3000
```

When the container is stopped (for example on a redeploy) the server saves towns and the leaderboard before it exits.

`render.yaml` is still here if you ever want to go back to Render.

**Voice chat on strict networks:** voice connects players directly using free STUN servers, which works on most home Wi-Fi. Some school and phone networks block that; to relay voice there, add a TURN server (for example from Metered or Twilio) with the environment variables `TURN_URL` (like `turn:your.server:3478`), `TURN_USER` and `TURN_PASS`.

**Keep saves and the leaderboard:** mount a volume at `/data` (the Docker image sets `DATA_DIR=/data`). Outside Docker, set `DATA_DIR` to any folder that survives restarts.

**How many players?** Each room holds up to 8 players, and there can be many rooms at the same time. One small container comfortably handles a few dozen players at once.

## Code

| File | What it does |
|---|---|
| `index.html`, `css/sw.css` | Small World page and styles |
| `js/world3d.js` | The 3D town (three.js): buildings, farms, forest, projects, Squarefaces, name tags, day and night, walking |
| `js/sw.js` | Small World game: HUD, places, jobs, school, bank, market, land, dreams, rooms |
| `js/town.js` | Town rules shared by the browser and the server: land, crops, prices, forest, weather, taxes, votes, elections, growing districts |
| `js/life.js` | Your life's rules: the rulebook by age, money, jobs and wages, certificates, bank, vehicles, companies, channel, memories, morning bills, rituals, stars, daily challenges, dreams |
| `test/life.test.js` | `npm test`: checks the rules, like "a 6-year-old's coins only go down when they tap Buy" |
| `js/music.js` | Background music made with WebAudio |
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
