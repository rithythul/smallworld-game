# World Builders: implementation plan

This is the build track for agents. Read `CLAUDE.md` and `DESIGN.md` first. Phase 1 is specified to the level
of files, data and tests; later phases are specified as architecture and milestones, and each gets its own
detailed section here before it starts.

## How to work on this track

- One milestone per pull request, branched from `main`. Keep each PR small enough to review in one sitting.
- Each PR must: pass `npm test`, add or update tests for its milestone, keep old saves loading, and include
  before/after screenshots for any UI change (desktop 1000x700 and phone 390x844).
- Tick the milestone's box in the checklist at the end of this file in the same PR.
- If a milestone forces a design change, stop and ask the owner; then update `DESIGN.md` and the living doc.
- Review every UI change against the fun rules in `DESIGN.md` ("Rules to keep it fun"). A band 1 player must
  be able to do it with no reading.

## Architecture

```
          browser (per player)                               server (one process)
 ┌──────────────────────────────────────────┐        ┌───────────────────────────────────┐
 │ js/problems.js  rules (pure, UMD)        │◄──────►│ js/problems.js  same rules        │
 │ js/life.js      player rules + save      │  ws    │ DATA_DIR/world.json  shared state │
 │ js/sw.js        UI: HUD chip, sheets     │        │ server.js: 'wact' in, 'world' out  │
 │ js/world3d.js   litter, haze, saplings   │        │ js/town.js: per-room town (today)  │
 │ js/globe.js     problem marker on globe  │        └───────────────────────────────────┘
 └──────────────────────────────────────────┘
```

- **New module `js/problems.js`**, UMD like `town.js`, global name `Problems` (not `World`: `window.World`
  is the 3D world). Pure functions only, so the server and Node tests run the same code.
- **Where and what is deterministic; progress is server state.** Which problem runs this week, where it is and
  its cause are computed from the time with a seeded RNG, like `Town.wonderAt(now)`. Every client and the
  server agree without messages. Only progress (counts) lives on the server.
- **One planet for everyone.** World Problems are global: all rooms add to the same total (the
  Splatfest / Nook Miles model). Towns stay per room, as today.
- **Real time vs game time.** A game day (`Life.DAY`) is 6 real minutes. World Problem beats use real UTC
  days and weeks (`REAL_DAY = 86400000`). Never mix the two.

## Phase 1: World Problem Lite

Goal: one Season-sized problem runs each real week in the Wild near town; players see it (haze, hiding animals),
fix it with verbs they already know (pick up, plant), find its cause with a sensor, and watch the world recover.
Works solo (NPC helpers), pays at every beat, and a 6-year-old can do it without reading.

### 1.1 Data: `js/problems.js`

```js
const REAL_DAY = 86400000, WEEK = 7 * REAL_DAY;
const PROBLEMS = {            // Season-size problems for phase 1
  haze:   { icon: '🌫️', biomes: ['taiga', 'forest'], causes: ['volcano', 'smoke'],  fixes: ['clean', 'plant', 'sensor'], goal: 400 },
  litter: { icon: '🛍️', biomes: ['beach', 'meadow'], causes: ['people'],            fixes: ['clean', 'sensor'],          goal: 500 },
  forest: { icon: '🪵', biomes: ['forest', 'jungle'], causes: ['cutting', 'dry'],  fixes: ['plant', 'clean', 'sensor'], goal: 350 },
};
function seasonAt(now) -> { id: week, kind, start, end, region: { x, z, r }, cause, revealAt }
function view(state, now) -> what the client shows: kind, region, fraction done (0..1, never decreases), beat, cause if revealed
function settle(state, now) -> rolls weeks over, adds the NPC trickle, archives finished seasons
function act(state, a, who, now) -> { ok, msg?, add }   // a.type: 'clean' | 'plant' | 'sensor'
function sparksIn(cx, cz, day) -> deterministic litter/sapling spots in one Wild chunk for one real day
```

- **Region:** pick a seeded land point 2 to 6 km from Small Town whose `Planet.sample()` biome is in the
  problem's list (retry a few seeded candidates; fall back to the nearest biome match). `r` is about 300 m.
  Close enough for the existing balloon and plane travel.
- **Cause:** seeded from the problem's `causes`, so it is sometimes natural (volcano, dry spell) and sometimes
  human (smoke, cutting, people). `revealAt` is day 3 of the week, or earlier once 20 sensors are placed.
- **Server state** (`DATA_DIR/world.json`, written like `swboard.json`):

```js
{ v: 1,
  season: { id, done: 0, sensors: 0, helpers: {} },   // helpers: uid -> count, for "you and 23 friends"
  today: { day, byUid: { [uid]: n } },                  // per-player daily contribution, for caps
  history: [ { id, kind, solved: true|false, helpers: n } ] }   // last 12 seasons
```

- **Rules that must hold (test them):** `fraction` never goes down; an unsolved season is archived as
  "waiting" and its kind comes back later, never as a failure; per-uid daily contribution is capped
  (60 actions); an NPC trickle adds about 2% of the goal per real hour while fewer than 5 players helped
  in the last hour, so solo players still see progress.

### 1.2 Server: `server.js`

- Load and save `world.json` (flush on the same timer and on SIGTERM as the board).
- New client message `{ t: 'wact', a: { type, n } }`: rate limited with `allow(p, 'worldBucket', 30, 10)`,
  cleaned by a `cleanWorldAction` whitelist (type in the three verbs, `n` integer 1 to 5), applied with
  `Problems.act`. Reply `{ t: 'wres', res }`.
- Broadcast `{ t: 'world', view }` to every room when progress crosses a whole percent, at most once
  every 5 seconds. Send it on join too.
- HTTP `GET /api/world` returns the current view (for the website and tests), cached for 15 seconds like the board.

### 1.3 Player: `js/life.js`

- New save fields with defaults in `fresh()` and migration in `repair()`: `cleaned: { day, ids: [] }`
  (like `wildPicked`), `stats.cleaned`, `stats.planted`, `stats.sensors`, `stats.problemsHelped`.
- New cap key `clean` in `RULES[1|2|3].caps` (suggested 15 / 12 / 10). All clean-up coins go through
  `kidBonus(life, 'clean', ...)`.
- New memories: `p_haze`, `p_litter`, `p_forest` ("I helped clear the haze") and `p_cause` (found a cause).
- New dreams in `DREAMS`, each with `little` steps for band 1 and `steps` for bands 2 and 3, ending in the
  existing endless levels:
  - `scientist` (🔬): place a sensor, read 3 sensors, find a cause, help 2 problems.
  - `ranger` (🥾): pick up 10 litter, plant 5 saplings, see an animal return, help 3 problems.
    (Key `ranger` is also a job id; dreams and jobs are separate tables, so this is fine.)
  - `captain` (🧢, Crew Captain): join a Clean-up Day, lead a Clean-up Day, lead 3 crews.

### 1.4 3D world: `js/world3d.js`

- **Litter Sparks:** instanced meshes for `bag`, `bottle`, `can` like the Wild items (`ITEM_GOODS`,
  `rebuildItems`). Spots from `Problems.sparksIn(chunk, realDay)`, denser inside the problem region and
  sparse everywhere else. Skipped when their id is in `life.cleaned`. Expose `World.litter()` for tests.
- **Haze:** inside the region, blend the fog and sky toward grey by `(1 - fraction) * closeness`. As
  progress rises the haze thins; it never thickens on screen.
- **Recovery you can see:** in the region, `floor(fraction * 40)` saplings appear on seeded spots, and the
  animal count per chunk scales from 0.3x to 1x with `fraction`.
- **Sensor:** a small landmark kit (a pole with a light) at 3 seeded spots per region. Placing one plays a
  puff; after the reveal, it shows the cause icon (🌋 volcano, 🏭 smoke, 🪓 cutting, 🌞 dry spell, 🧍 people).
- **Planting spots:** glowing soil patches in the region; the action is "Plant", reusing the sapling mesh.
- Action button labels come from `sw.js` `doAction()`, like picking and petting.

### 1.5 UI: `js/sw.js` and `css/sw.css`

- **HUD chip** 🌍 with the problem icon and a filling ring (up only). Tap opens a sheet with: a picture of
  the place, a compass arrow and "Go there" (existing travel), today's action as three big icons
  (🛍️ ✋, 🌱, 📡), the filling picture (leaves filling a tree), "You + N helpers", and the cause card once
  revealed. Band 1 sees only icons and the picture.
- **Guide arrow:** the existing yellow arrow points to the balloon, then the region, when the problem is new.
- **Fact card:** at most one per session, on the cause reveal ("The mountain burped: volcanoes make haze too").
- **Beats:** daily (new Sparks, a toast "The haze got thinner!"), mid-week (cause reveal), weekend finale
  (Clean-up Day, 1.6). Each beat pays through `kidBonus`.
- Wire `net.js` for `wact`, `wres` and `world`. Keep the last view in memory for the HUD and the globe.

### 1.6 Clean-up Day and Crew Captain

- On the weekend (UTC Saturday and Sunday), a Clean-up Day round can start in any room, reusing the Crunch
  Race infrastructure (`startRound` in `server.js`, `raceStart` and `raceEnd` in `sw.js`) with a new mode
  `cleanup`: cooperative, one shared room meter, no ranking, and every pickup also counts toward the World
  Problem.
- The first player to tap "Lead" at the Town Hall becomes Crew Captain for that round. The Captain picks the
  festival theme from 3 pictures; the crew votes by tapping faces (existing emotes). NPC crewmates fill up to
  3. The Captain can start and thank, and cannot kick anyone.
- When the meter fills, the town holds a festival (reuse the Wonders effects) and everyone gets a
  "Clean Town" memory.

### 1.7 Globe: `js/globe.js`

- Draw the problem region as a soft grey patch sprite that fades with `fraction`, and a pin with the problem
  icon. Tapping near it shows the pick card with "Go there". Players' help shows as the patch turning green.

### 1.8 Tests

- `test/problems.test.js` (plain Node, added to `npm test`): the same week gives the same problem, region and
  cause on every call; the region is on land and within 2 to 6 km; `fraction` never decreases across any sequence
  of `settle` and `act`; daily per-uid cap holds; the NPC trickle only runs when few players help; an unsolved
  week archives as waiting and never as failed; `sparksIn` is deterministic.
- `test/life.test.js`: new fields survive `repair()` on an old save; clean-up coins never exceed the band cap;
  the three dreams can be completed.
- **Commit the browser harness** as `test/browser/` with a small helper (launch, boot, `World.place`, close
  sheets) and a `npm run test:browser` script that starts a server on a free port with a temp `DATA_DIR`.
  Scripts: `world-problem.js` (travel to the region, haze visible, clean a Spark, progress rises, globe shows
  the pin), `cleanup-day.js` (two clients, shared meter, festival), `band1-no-reading.js` (a band 1 player
  completes a Spark using only icon buttons).
- **Fun check:** play the 10-minute session in `DESIGN.md` end to end and attach screenshots to the PR.

### 1.9 Decisions needed before or during phase 1

- Free-typed chat: today rooms allow up to 80 typed characters. Proposed: preset phrases only for band 1,
  typed chat for bands 2 and 3 in private rooms only. Owner to confirm.
- Problem distance: 2 to 6 km from town assumes the balloon and plane are the way there. Confirm after playtest.
- Goal sizes (350 to 500 actions per week) are guesses; tune from real play.

## Phase 2: Teacher class rooms, provinces and countries

Architecture only; detail this section before starting.

- **Teacher class rooms (build first).** Room type `class` with a higher player cap (for example 32) set in
  `server.js`. The creator gets a teacher key protected by the existing name + PIN scheme. The teacher picks
  the problem: `Problems` accepts a room-local override. `GET /api/class/:code/summary` (teacher key only)
  returns roles, helpers and totals, with no per-student ranking. Class data expires after 30 days.
- **Province = the room's region of towns** (the towns and districts a room already has). A Governor office
  reuses the mayor election in `town.js` (`run`, `ballot`) with a new office field, and gets one visible power
  per day (open a bridge, pick the festival, place a Wonder), with no upkeep.
- **Countries = several rooms joined by vote.** New server state `DATA_DIR/countries.json`:
  `{ id, name, flag, rooms: [], leader, laws: [] }`. Names and flags from word lists and a flag builder.
  NPC nations are generated deterministically so there is always someone to race and help. Laws come from a
  menu of harmless options (for example "double saplings on Clean-up Day").
- **Society screen:** counts the dreams of players in the country plus NPC placeholders; a missing career
  shows as a need.
- **Trust:** rumours spread as a visible wave between towns; the Fact-Checker dream traces them. The Oracle
  robot with its Fibs-dex arrives here (pre-written claims, rotating weekly).
- **New dreams:** Governor, Leader, Fact-Checker, Doctor, Water Engineer, Clean Energy Engineer, Robot Maker.
- **Scaling note:** one Node process with JSON files is fine for this phase. Plan a database before running
  more than one server process.

## Phase 3: multi-nations and the World Council

- Unions of countries (treaty by vote in each country), the Diplomat dream.
- The World Council: when a Season or Era needs a plan, each country picks one of three pictured plans; NPCs
  fill empty seats; the most-picked plan applies a bonus to the matching verbs.
- All five dials as scenes in the world and a filling ring on the globe. Eras (4 to 8 weeks) made of Seasons.
- The World Ideas Book on smallworld.xyz, reading from `GET /api/world` history.
- Country leaderboard scored on help, positive rankings only.

## Phase 4: the wonderful world

- Future view on the globe (today / if nothing changes / the wonderful world within reach).
- Wonders built by multi-nations; the Space Program as a Grand Project with a milestone about every 2 weeks,
  building on the Noodle Rocket and the Moon trip.
- Store builds: Capacitor wrappers for iPad and Android tablets (Kids Category: parental gate on outside
  links, no third-party ads or analytics), then the Microsoft Store via PWABuilder. One server, one save format.
- Maybe: Shell Ledger and Ledger Keeper, Prime Minister, a teen-only optional real-AI Oracle.

## Checklist

Phase 1
- [ ] M0 Commit the browser test harness (`test/browser/`, `npm run test:browser`)
- [ ] M1 `js/problems.js` rules and `test/problems.test.js`
- [ ] M2 Server state, `wact` / `world` messages, `/api/world`
- [ ] M3 Life fields, caps, memories, and the Scientist, Ranger and Crew Captain dreams
- [ ] M4 Litter Sparks, haze, saplings, sensors and animal recovery in the Wild
- [ ] M5 HUD chip, problem sheet, guide arrow, beats and fact card
- [ ] M6 Clean-up Day and Crew Captain
- [ ] M7 Globe marker and "Go there"
- [ ] M8 Playtest pass: the 10-minute session, band 1 no-reading check, tuning goals and caps

Phase 2
- [ ] Detail this plan, then: teacher class rooms, Governor, countries, Society screen, Trust and the Oracle
