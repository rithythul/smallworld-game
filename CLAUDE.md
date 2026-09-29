# Small World: notes for coding agents

Small World is a cozy 3D browser game for everyone. There are no age types: it starts simple and unlocks
depth through play, and a 6-year-old who cannot read must be able to play it.
Players live in a shared town, follow dreams (careers), explore an infinite planet, and are growing into
"World Builders": solving world problems together.

**Before building anything for World Builders, read, in order:**
1. `docs/world-builders/DESIGN.md`: the decisions (what and why). Do not re-decide them.
2. `docs/world-builders/IMPLEMENTATION.md`: the build plan (how, in which files, in which order, and how to test).

## Run and test

- `npm install`, then `npm start`. The server is on `PORT` (default 3000) and stores data in `DATA_DIR` (default `./data`).
- `npm test` must pass before every commit. It runs `test/syntax.js`, a browser-equivalent parse of every script in `index.html`
  plus `server.js`, and `test/life.test.js`, the plain Node rules tests.
- **Restart the server after every code change.** It gzips and caches static files in memory, so a running server keeps
  serving old code.
- Browser tests use Playwright with the preinstalled Chromium: `chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })`. Load `/?q=low`, then wait for
  `#boot.gone`. Test hooks are `window.World` (3D world), `window.__sw` (game controller, for example `__sw.life()`) and `window.Globe`.
- `node --check` does NOT catch errors in ES module files (`world3d.js`, `globe.js`); rely on `npm test`.

## Code map

| File | What it is |
| --- | --- |
| `js/life.js` | One player's life rules: `RULES` (being merged into one table, see phase 0), jobs, school, bank, `DREAMS`, `kidBonus` (daily caps), memories, save `fresh()`/`repair()`. UMD: runs in the browser and in Node. |
| `js/town.js` | Shared town rules, authoritative on the server: districts, plots, goods and prices, projects, mayor elections (`act`, `settle`, `wonderAt`). UMD. |
| `js/planet.js` | The made-up planet: `sample(x, z)` gives height and biome; 100 km around, wraps east-west. UMD. |
| `js/world3d.js` | three.js world (ES module): towns, the streamed Wild (chunks, plants, landmarks, pickable items, animals), travel animations. Exposes `window.World`. |
| `js/globe.js` | The spinning planet view (ES module). Exposes `window.Globe`. |
| `js/sw.js` | Game controller and all UI: HUD, sheets (`sheet()`), toasts, actions (`doAction()`), dreams screen, kitchen, races, Wild picking. |
| `js/net.js` | WebSocket client. |
| `server.js` | Static files, rooms (max 8 players, one shared town each), `tact` town actions checked by `cleanAction`, leaderboard, saves. |
| `js/noodles.js`, `learn.js`, `care.js`, `talk.js`, `music.js`, `audio.js`, `art.js` | Noodle-dex and kitchen, school quizzes, play limits and breaks, preset phrases, music and sound, 2D drawing helpers. |

## Conventions

- Vanilla JS, no build step, no framework. `index.html` loads classic scripts in order, then the two modules.
- Rules live in pure UMD modules (`life.js`, `town.js`, new `problems.js`) so the server and `test/*.test.js` can run them.
  The server is authoritative for anything shared; clients only send requests.
- Every new saved field gets a default in `Life.fresh()` and a migration in `Life.repair()`. Old saves must load.
- Every new coin reward goes through `kidBonus` with a daily cap in `RULES` caps. No new currency.
- Every new server message is rate limited (`allow(...)`) and its fields are whitelisted like `cleanAction`.
- UI: pictures, emoji and a yellow arrow first. A new player who cannot read must be able to do it.
- Match the surrounding code style: short comments, plain words, same naming.

## Hard rules (never break these)

- No real money, crypto, tokens or NFTs for players. No third-party ads or tracking.
- No typed chat. Talk is preset phrases and face-emotes. Safety is the same for every player and never unlocks by level.
- No age types or age-based rules. Complexity unlocks by play and choice, never by penalties.
- No red meter that drains as punishment. Show progress toward the wonderful world; problems appear as things in the world to fix.
- Power gives, never takes: no player can fine, ban, kick or take from another player.
- No war, no losing, and missing days never costs anything.
- Real places, countries, leaders and politics never appear. The planet is made up.
- The existing fun (crunching, cooking, races, exploring, dreams) stays the heart. New systems hang off it and never replace it.
