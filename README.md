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

Small Town is only the first town. Six more are open from the very first minute (Downtown, Uptown, Green Valley, Seashell Bay, Snowcap and College Hill), reached by road and train. After that, as everyone works, pays taxes and builds, one more town opens to the east, forever. The 🗺️ map starts with a strip of every town from west to east (where you are, where your friends are, and how close the next town is); tap a town to see it on the map and get an arrow there. Each town has its own kind, look, places, jobs and wants:

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

### A whole planet

Small World is a round planet, about 100 km around, and every bit of it is made from numbers as you walk (`js/planet.js`). There are no walls: walk off the edge of town in any direction and you are in **the Wild**.

- **The same planet for everyone.** The land comes from fixed numbers, not from a server, so friends see the same hills, seas and discoveries, and it is all still there when you come back.
- **Climate by latitude.** Small Town sits at 30°N. Walk north (up the screen) through forests and pine woods into the Snowlands and on to the North Pole; walk south towards the warm equator for deserts and jungle, and on to the South Pole. Mountain ranges have snowy tops, and oceans and seas lie between the continents: swim across them.
- **All the way round.** East and west wrap: walk far enough east (about an hour and a half) and you come back home from the west.
- **Discoveries:** about four chunks in ten hold something to find (stone circles, old ruins, wishing wells, campsites, Squareface statues, watchtowers, giant mushrooms, crystal caves, snow forts, red arches, mesas, lighthouses, shipwrecks, pyramids, temples, cabins, ancient trees, snowmen, totem poles, scarecrows and the poles). Each is ⭐ +2 (ten a day) and a memory, with a noodle brick beside it. New noodles for exploring: Trail, Compass, Frosty, Desert, Ocean Wave, Polar and Round-the-World.
- **Things to pick** (they grow back every morning): berries, wildflowers and honey in the meadows, mushrooms in the woods, coconuts in the jungle and on beaches, shells, crystals and ore. They go in your bag to sell (towns pay more for what they want) or cook at Grandma's kitchen: Mushroom Soup, Tropical Smoothie and Flower Honey Tea are new.
- **Animals** wander about in every land: sheep, rabbits and deer in the meadows, foxes in the woods, penguins in the snow, camels in the desert, parrots in the jungle and crabs on the beach. Say hi for a heart (⭐ +1 for each kind, once a day) and a memory the first time.
- **More to see:** birch and autumn trees, bamboo, sunflowers, ice spikes, reeds, starfish and old dead trees, and more discoveries: shipwrecks, pyramids, jungle temples, log cabins, ancient trees, snowmen, totem poles and scarecrows.
- **Never lost.** In the Wild a compass shows how far home is and which way, and the minimap turns into a compass. Tap it for 🎈 **Fly home**. Leaderboards for the farthest from home and the most discoveries.
- **🌍 See the planet** (map screen): a globe like Google Earth, painted from the same numbers. It opens close above you and pulls back to the whole planet; drag to spin, pinch or scroll to zoom, and tap anywhere to set a destination the arrow will point to.
- **The ground curves away** gently to the horizon, like a little planet.
- **How it stays fast:** the Wild is built in 100 m chunks near you, one small piece per frame, and chunks far behind are thrown away, so walking for hours uses the same memory as walking for a minute. Far-away townsfolk rest instead of animating. Slow devices get a thinner Wild.

### Travel you can watch

Every trip is a little film. A plane taxis, takes off, climbs, flies through the clouds on a long trip and lands; a boat sails out and in with spray behind it; the rocket launches with flames and touches down; the balloon rises, drifts and floats down with you in the basket; the bus and train drive along the road and the rails. The camera follows the whole way.

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
- **🪜 How to level up:** the ⭐ page lists every way to earn stars right now (rituals, today's challenges, noodle bricks, your dream's next step, a town you have not visited, classes, memories, noodles), how many stars each gives and whether it is open, done or later today. Tap one and the guide arrow takes you there.
- **🍜 The noodle hunt (from Noodle Universe):** golden noodle bricks sit by the Small World Garden of every town and come back every morning. Walk into one to crunch it: a note in that town's instrument, a combo that climbs the scale, a few stars a day, and noodles for the 24-noodle Noodle-dex (one per kind of town, plus night glass, combos, rituals, wishes, waves and faces; 1 in 40 comes back golden).
- **Leaderboard (🏆 in the ⋯ menu or on the ⭐ page):** every player has a record on the server. Boards: stars, stars this week, coins earned, memories, Perfect Days, kinds of towns and nights, for everyone or only your age group, plus "My records" with your place on every board. Every board counts something that only goes up, so spending or a bad day never drops you. A secret key on the device keeps a record yours, and the server limits how fast numbers can grow.
- **☁️ Online saves:** ⋯ → ☁️ Save online, with a name and a 4-number PIN. It saves by itself every 2 minutes and when you leave. Load it on any phone or computer (☁️ on the title screen). If another device has more progress, you choose which game to keep. There is no way to get a lost PIN back.
- **Rooms:** up to 8 players share one room and its town; there can be any number of rooms at once.
- **Player cards:** walk up to a friend (the big button shows 👋 and their name), tap a name in the friends list, or open 🪪 My card from your life page. A card shows your Squareface, hat, dream, star level, memories, Perfect Days, nights slept, home and the kinds of towns you have visited. Cards hold no typed words, only numbers and things the game already knows, so they are safe for young kids. 👋 waves back.
- **The Small World mark** is mown into the lawn beside the plaza.

The 3D is made with [three.js](https://threejs.org) (MIT, bundled in `js/vendor/`). All models are built in code: no model files to download.

## Noodle Universe lives on inside Small World

Noodle Universe, the first Squareface game, is now part of Small World, so there is one game to play and to look after. What came along: the noodle hunt and the Noodle-dex (golden noodles too), crunching as music, Grandma's kitchen, Crunch Races and trophies, the Udon Snail's long walk, the morning swim / sunset sip / bedtime rituals, wonders, faces, hats and online saves with a name and PIN. The Endless Frontier became the endless region of towns.

**Old progress comes along.** A Noodle Universe game on the same device is brought over the first time you play Small World: noodles, golden noodles and hats, plus up to 300 coins and 60 stars. A Noodle Universe online save works too: ⋯ → ☁️ Save online → Load a saved game (or ☁️ on the title screen). Coins and stars come over once per life; noodles and hats merge in any time. Old links to `classic.html` open Small World.

The original design notes are in [GAME_DESIGN.md](GAME_DESIGN.md).

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
| `js/planet.js` | The planet: continents, seas, mountains, climate and biomes, the same for every player |
| `js/globe.js` | The planet view: a globe you can spin and tap |
| `js/town.js` | Town rules shared by the browser and the server: land, crops, prices, forest, weather, taxes, votes, elections, growing districts |
| `js/life.js` | Your life's rules: the rulebook by age, money, jobs and wages, certificates, bank, vehicles, companies, channel, memories, morning bills, rituals, stars, daily challenges, dreams |
| `test/life.test.js` | `npm test`: checks the rules, like "a 6-year-old's coins only go down when they tap Buy" |
| `js/music.js` | Background music made with WebAudio |
| `js/art.js` | 2D drawing for the screens: Squareface faces and Noodle-dex icons |
| `js/noodles.js` | The Noodle-dex and Grandma's recipes |
| `js/learn.js` | Science facts, class and quiz questions |
| `js/audio.js` | Synthesized sound effects |
| `js/net.js` | Multiplayer connection |
| `js/care.js` | Breaks, daily play time and grown-up settings |
| `js/talk.js` | Room chat, quick phrases and WebRTC voice |
| `server.js` | Node server: static files, rooms, shared towns, Crunch Races, the leaderboard, online saves |
| `classic.html` | Sends old Noodle Universe links to the game |
| `Dockerfile` | The container for KOOMPI Cloud (or any Docker host) |
