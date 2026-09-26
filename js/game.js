// Noodle Universe: game loop, rules and world logic.
const Game = (() => {
  const canvas = $('world');
  const ctx = canvas.getContext('2d');
  const SAVE_KEY = 'noodle-universe-save-v1';
  const START_TIME = 5 * 60 + 59;
  const POOL_OPEN = 6 * 60, POOL_CLOSE = 8 * 60;
  const DOOR = { x: 508, y: 588 };
  const GATE = { x: 500, y: 768 };
  const TALK = { x: 885, y: 506 };
  const POSTER = { x: 1046, y: 468 };
  const ORACLE_AT = { x: 900, y: 890 };
  const POOL = PLACES.pool;
  const LAST_TILE = { x: POOL.x + 11 * 30 + 15, y: POOL.y + 3 * 30 + 15 };
  const GOLD_BRICK = { x: PLACES.willowBack.x, y: PLACES.willowBack.y + 58 };
  const MIRROR = STREAM.mirror;
  const SPRING = CANYON.spring;
  const DRUM = CANYON.drum;
  const snail = { x: CANYON.snail.x, y: CANYON.snail.y, dir: 1, moved: 0 };
  const LAKE = PEAKS.lake, STATUE = PEAKS.statue, NEST = PEAKS.nest, TROCK = PEAKS.thunderRock;
  let stormFlash = 0, stormWarnDay = 0;
  let rockShimmer = [], drumHit = 0, drumBeats = [], mirrorTimer = 0, drinkWhere = null;

  let G = null;                 // saved state
  let ground = null;            // pre-rendered ground
  let vw = 0, vh = 0, dpr = 1, zoom = 1;
  const cam = { x: 0, y: 0 };
  const P = { x: 0, y: 0, z: 0, vz: 0, wing: 0, flapping: false, wings: false, stamina: 0, airT: 0, moving: false, walk: 0, face: 0, mood: 'happy', crunching: 0, wow: 0, antennaPulse: 0, swimming: false, area: null };
  const lastGround = { x: 0, y: 0 };
  let flyTouch = false, waterHintT = 0;
  const keys = new Set();
  const stick = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  let particles = [];
  let shake = 0;
  let combo = { n: 0, last: 0 };
  let swim = null;
  let drinkHeld = false, drinkSound = 0;
  let current = null;           // current interaction
  let running = false;
  let now = 0, lastFrame = 0;
  let beepTimer = 0, saveTimer = 0, blinkT = 0;
  let thirstWarned = false, nightWarned = false;
  let streamSamples = [];

  /* ---------- state ---------- */
  function fresh() {
    return {
      v: 1, day: 1, time: START_TIME, water: 80, coins: 0,
      found: [], clues: [], solved: [], pieces: [],
      flags: {}, crunched: [], glassTaken: [], drinks: 0, crunches: 0, woodsCrunches: 0, canyonCrunches: 0,
      boulderHp: {}, gateHp: 3, mintDay: 0, mintUntil: 0, statueStep: 0, birdTalks: 0,
      buffUntil: 0, buffDay: 0, fortune: null, hints: {}, journalNew: false,
      px: DOOR.x, py: DOOR.y + 30,
      pantry: {}, shaken: {}, cooked: {}, dishes: {}, hats: {}, hat: null, shiny: {},
      skills: { swim: 0, fly: 0 }, lessons: {}, challenges: {}, lesson: null, stats: { swimOpen: 0, hops: 0, maxCombo: 0 },
    };
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 1) return Object.assign(fresh(), s); } catch (e) {}
    return null;
  }
  function save() {
    if (!G) return;
    const out = P.area === 'lake' ? PEAKS.lakeEntry : GATE;
    G.px = P.swimming ? out.x : P.x; G.py = P.swimming ? out.y : P.y;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {}
  }

  /* ---------- helpers ---------- */
  const hour = () => G.time / 60;
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const has = (id) => G.found.includes(id);
  const buffed = () => G.buffDay === G.day && G.buffUntil > G.time;
  const minty = () => G.mintDay === G.day && G.mintUntil > G.time;
  const inPond = (x, y, pad = 0) => ((x - MIRROR.x) / (MIRROR.rx + pad)) ** 2 + ((y - MIRROR.y) / (MIRROR.ry + pad)) ** 2 < 1;
  const inSpring = (x, y, pad = 0) => ((x - SPRING.x) / (SPRING.rx + pad)) ** 2 + ((y - SPRING.y) / (SPRING.ry + pad)) ** 2 < 1;
  const canyonOpen = () => !!G.flags.gateOpen;
  const fogGone = () => G.pieces.includes(5);
  const inPeaks = (x) => x > PEAKS.left - 20;
  const stormy = () => G.day % 2 === 0 && hour() >= 13 && hour() < 17;
  const poolOpen = () => G.time >= POOL_OPEN && G.time < POOL_CLOSE;
  const isNight = () => hour() >= 20 || hour() < 5;

  function buildStreamSamples() {
    const pts = STREAM.pts; const out = [pts[0]];
    let cur = pts[0];
    for (let i = 1; i < pts.length - 1; i++) {
      const mid = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
      for (let k = 1; k <= 12; k++) {
        const t = k / 12, u = 1 - t;
        out.push([u * u * cur[0] + 2 * u * t * pts[i][0] + t * t * mid[0], u * u * cur[1] + 2 * u * t * pts[i][1] + t * t * mid[1]]);
      }
      cur = mid;
    }
    out.push(pts[pts.length - 1]);
    streamSamples = out;
  }
  function streamDist(x, y) {
    let best = 1e9;
    for (let i = 1; i < streamSamples.length; i++) {
      const [ax, ay] = streamSamples[i - 1], [bx, by] = streamSamples[i];
      if (Math.abs(ay - y) > 200 && Math.abs(by - y) > 200) continue;
      const dx = bx - ax, dy = by - ay;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
      best = Math.min(best, dist(x, y, ax + dx * t, ay + dy * t));
    }
    return best;
  }
  const onBridge = (x, y) => STREAM.bridges.some(b => x > b.x + 6 && x < b.x + b.w - 6 && y > b.y - 6 && y < b.y + b.h + 10);

  const RECTS = [
    { x: PLACES.house.x + 14, y: PLACES.house.y + 60, w: PLACES.house.w - 28, h: 112 },
    { x: PLACES.shop.x - 8, y: PLACES.shop.y + 40, w: PLACES.shop.w + 50, h: 112 },
    { x: POOL.x - 30, y: POOL.y - 34, w: POOL.w + 60, h: POOL.h + 56 },
  ];
  // Water you can swim in (the pool and the mountain lake have their own swim mode)
  const isWater = (x, y) => (!onBridge(x, y) && streamDist(x, y) < STREAM.width / 2 + 4) || inPond(x, y, 6) || inSpring(x, y, 8);

  // Can you stand here? z is your height above the ground: things below you don't block you.
  // withWater = false means water does not count (movement handles water itself).
  function blocked(x, y, z = 0, withWater = true) {
    if (x < 30 || y < 40 || x > WORLD.w - 30 || y > WORLD.h - 30) return true;
    // walls, fog and cliffs block you even in the air
    if (y > CANYON.wallY - 22 && y < CANYON.wallY + 26 && !(canyonOpen() && Math.abs(x - CANYON.gate.x) < 56)) return true;
    if (x > PEAKS.left - 40 && (!fogGone() || y > CANYON.wallY - 22)) return true;
    if (x > PEAKS.left - 40 && dist(x, y, STATUE.x, STATUE.y - 20) < 62) return true;
    if (z < 90) for (const r of RECTS) if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
    if (z < 45) {
      for (const t of treeSpots()) if (dist(x, y, t[0], t[1]) < 22) return true;
      if (dist(x, y, PLACES.willowBack.x, PLACES.willowBack.y) < 22) return true;
      if (dist(x, y, 900, 848) < 40) return true;
      for (const [rx, ry] of CANYON.rocks) if (dist(x, y, rx, ry) < 36) return true;
      if (dist(x, y, DRUM.x, DRUM.y - 8) < 50) return true;
      for (const c of Object.values(COACHES)) if (dist(x, y, c.x, c.y) < 20) return true;
      if (dist(x, y, 420, 1470) < 34) return true;
      if (x > PEAKS.left - 40) {
        if (dist(x, y, TROCK.x, TROCK.y) < 38) return true;
        if (dist(x, y, NEST.x, NEST.y - 8) < 42) return true;
        for (const [px, py] of PEAKS.pines) if (dist(x, y, px, py) < 22) return true;
      }
    }
    if (z < 12 && x > LAKE.x - 20 && x < LAKE.x + LAKE.w + 20 && y > LAKE.y - 16 && y < LAKE.y + LAKE.h + 14) return true;
    if (withWater && z < 12 && isWater(x, y)) return true;
    return false;
  }
  function treeSpots() { return TREES; }
  const FRUIT_MAX = { egg: 3, chili: 3, mushroom: 2, bamboo: 2, naruto: 3, corn: 2, scallion: 2, nori: 3, dumpling: 3 };
  const fruitLeft = (i) => { const k = TREES[i][2]; return k === 'willow' ? 0 : Math.max(0, FRUIT_MAX[k] - ((G.shaken || {})[i] || 0)); };
  const treeShake = new Map();
  // Dishes from Grandma: bonuses that last a while
  const dishOn = (id) => { const d = (G.dishes || {})[id] || (G.dishes || {}).feast; return !!d && d.day === G.day && G.time < d.until; };

  function bricks() {
    const list = BRICK_SPOTS.map(([x, y], i) => ({ i, x, y, kind: y > CANYON.top ? 'canyon' : x > PEAKS.left ? (y < PEAKS.snowLine ? 'snow' : 'peak') : x > 1450 ? 'woods' : 'normal' }))
      .filter(b => !G.crunched.includes(b.i));
    CANYON.boulders.forEach(([x, y], k) => {
      const hp = G.boulderHp[k] === undefined ? 3 : G.boulderHp[k];
      if (hp > 0) list.push({ i: 'boulder' + k, k, x, y, kind: 'boulder', hp, max: 3 });
    });
    if (G.pieces.includes(1) && !G.pieces.includes(2)) list.push({ i: 'gold', x: GOLD_BRICK.x, y: GOLD_BRICK.y, kind: 'gold' });
    if (G.fortune && !G.fortune.crunched) {
      const [fx, fy] = FORTUNE_SPAWNS[G.fortune.spawn];
      list.push({ i: 'fortune', x: fx, y: fy, kind: 'fortune' });
    }
    return list;
  }
  function glassNoodles() {
    if (!isNight()) return [];
    return GLASS_SPOTS.map(([x, y], i) => ({ i, x, y })).filter(g => !G.glassTaken.includes(g.i));
  }

  /* ---------- particles ---------- */
  function burst(x, y, n, colors, { speed = 220, up = 160, size = 5, life = 0.8, type = 'crumb', grav = 700 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - up * Math.random(), life, max: life, color: colors[i % colors.length], size: size * (0.5 + Math.random() * 0.8), type, grav, rot: Math.random() * 6 });
    }
  }
  function floatText(x, y, text, color = '#fff8e8') {
    particles.push({ x, y, vx: 0, vy: -60, life: 1.1, max: 1.1, text, color, type: 'text', grav: 0 });
  }

  /* ---------- rewards ---------- */
  function giveNoodle(id, from) {
    if (has(id)) return false;
    const n = NOODLES.find(n => n.id === id);
    if (!n) return false;
    G.found.push(id);
    P.wow = 1.6;
    Sound.discover(); buzz([20, 40, 30]);
    if (from) UI.toast(`<span class="t-small">Team noodle · from ${from}</span>${n.name}`, { noodle: n, big: true, life: 3.2 });
    else { UI.toast(`<span class="t-small">New noodle · ${n.rarity}</span>${n.name}`, { noodle: n, big: true, life: 3.2 }); Net.found(id); }
    burst(P.x, P.y - 60, 24, ['#ffd23f', '#fff8e8', '#e4572e', '#8fe0ea'], { type: 'spark', speed: 260, grav: 200, life: 1.1 });
    milestone();
    save();
    return true;
  }
  function addCoins(n, x = P.x, y = P.y - 80) {
    dailyAdd('coins', n);
    G.coins += n; floatText(x, y, `+${n}`, '#ffd23f'); Sound.coin();
  }
  function addClue(id) {
    if (G.clues.includes(id)) return;
    G.clues.push(id); G.journalNew = true;
    UI.toast(`<span class="t-small">New clue</span>${CLUES[id].title}: open your journal (J)`, { life: 3.4 });
  }
  function solve(id) { if (!G.solved.includes(id)) G.solved.push(id); }
  function milestone() {
    const n = G.found.length;
    if (n >= 3 && G.flags.metGrandma && !G.flags.pillowReady) {
      G.flags.pillowReady = true;
      setTimeout(() => UI.toast('<span class="t-small">Hmm?</span>Your antenna twitches. Something is waiting at home.', { life: 3.6 }), 3400);
    }
  }

  /* ---------- day cycle ---------- */
  function newDay(msg, spot) {
    G.day++; G.time = START_TIME; G.crunched = []; G.glassTaken = []; G.boulderHp = {}; G.shaken = {};
    G.water = Math.max(G.water, 70);
    newFortune();
    ensureDaily();
    setTimeout(() => UI.toast('<span class="t-small">📅 New day, new challenges</span>Open ⭐ Skills to see today\'s 3 challenges.', { life: 3.4 }), 3800);
    P.swimming = false; swim = null; P.area = null; P.z = 0; P.vz = 0; G.lesson = null;
    P.x = spot ? spot.x : DOOR.x; P.y = spot ? spot.y : DOOR.y + 30;
    cam.x = P.x - vw / zoom / 2; cam.y = P.y - vh / zoom / 2;
    thirstWarned = false; nightWarned = false;
    save();
    Sound.rooster();
    UI.toast(`<span class="t-small">${msg || 'Good morning!'}</span>Day ${G.day}. The pool opens at 6:00.`, { life: 3.6 });
  }
  function newFortune() {
    const idx = (G.day * 7 + 3) % FORTUNES.length;
    const spawn = (G.day * 3 + 1) % FORTUNE_SPAWNS.length;
    G.fortune = { idx, spawn, crunched: false, done: false };
  }

  /* ---------- interactions ---------- */
  function findInteraction() {
    if (UI.busy || P.z > 6) return null;
    const c = [];
    const add = (label, x, y, r, fn, prio = 1, cls = '') => { const d = dist(P.x, P.y, x, y); if (d < r) c.push({ label, x, y, d, fn, prio, cls }); };
    if (P.swimming) {
      if (P.area === 'pool' && G.clues.includes('pillow') && !G.pieces.includes(1) && poolOpen()) add('DIVE', LAST_TILE.x, LAST_TILE.y, 34, diveTile, 3, 'swim');
      if (P.area !== 'open') c.push({ label: 'GET OUT', x: P.x, y: P.y, d: 999, fn: P.area === 'lake' ? exitLake : exitPool, prio: 0, cls: 'swim' });
    } else {
      if (G.fortune && G.fortune.crunched && !G.fortune.done) { const f = FORTUNES[G.fortune.idx]; add('LOOK', f.where.x, f.where.y, 64, fortuneFound, 3, 'look'); }
      add('TALK', TALK.x, TALK.y, 80, talkGrandma, 2, 'talk');
      add('LAUNCH', ROCKET_PAD.x, ROCKET_PAD.y + 30, 70, launchRocket, 2, 'swim');
      add('TALK', COACHES.kombu.x, COACHES.kombu.y + 20, 70, () => talkCoach('kombu'), 2, 'talk');
      add('TALK', COACHES.penne.x, COACHES.penne.y + 20, 70, () => talkCoach('penne'), 2, 'talk');
      add('LOOK', POSTER.x, POSTER.y, 70, lookPoster, 2, 'look');
      add('ASK', ORACLE_AT.x, ORACLE_AT.y, 80, askOracle, 2, 'look');
      add(G.flags.pillowReady && !G.clues.includes('pillow') ? 'LOOK' : canSleep() ? 'SLEEP' : 'HOME', DOOR.x, DOOR.y, 70, useDoor, 2, 'look');
      add(poolOpen() ? 'SWIM' : 'CLOSED', GATE.x, GATE.y, 70, enterPool, 2, 'swim');
      if (!canyonOpen()) {
        const gy = CANYON.wallY - 30;
        if (G.solved.includes('cipher')) add('CRUNCH', CANYON.gate.x, gy, 80, crunchGate, 2);
        else add('LOOK', CANYON.gate.x, gy, 80, () => UI.say('me', 'A giant wall of ancient crunch-rock. You tap it. Too hard to crunch... for now.'), 2, 'look');
      }
      CANYON.rocks.forEach(([rx, ry], i) => add('CRUNCH', rx, ry + 34, 66, () => crunchRock(i), 1));
      add('DRUM', DRUM.x, DRUM.y + 40, 80, hitDrum, 2, 'talk');
      add('TALK', snail.x, snail.y + 10, 80, talkSnail, 2, 'talk');
      if (fogGone()) {
        add(G.statueStep === 3 && !G.pieces.includes(6) ? 'SLEEP' : 'LOOK', STATUE.x, STATUE.y + 40, 90, useStatue, 2, 'look');
        add('SWIM', PEAKS.lakeEntry.x, PEAKS.lakeEntry.y, 70, enterLake, 2, 'swim');
        add('DRINK', LAKE.x + LAKE.w / 2, LAKE.y - 26, 70, () => startDrink('lake'), 2, 'water');
        add('TALK', NEST.x, NEST.y + 44, 70, talkBird, 2, 'talk');
        add(stormy() && !has('thunder') ? 'PICK' : 'LOOK', TROCK.x, TROCK.y + 36, 70, useThunderRock, 2, 'look');
      }
      if (inSpring(P.x, P.y, 44)) c.push({ label: 'DRINK', x: SPRING.x, y: SPRING.y, d: 60, fn: () => startDrink('spring'), prio: 1, cls: 'water', hold: true });
      for (const b of bricks()) add('CRUNCH', b.x, b.y, 62, () => crunch(b), 1);
      for (const g of glassNoodles()) add('PICK', g.x, g.y, 56, () => pickGlass(g), 2, 'look');
      if (!has('vine')) for (const [wx, wy] of WILLOWS) add('PICK', wx, wy + 10, 64, pickVine, 1, 'look');
      TREES.forEach(([tx, ty, kind], i) => { if (kind !== 'willow' && fruitLeft(i) > 0) add('SHAKE', tx, ty + 12, 66, () => shakeTree(i), 1, 'look'); });
      if (!c.length) {
        const sd = streamDist(P.x, P.y);
        if (inPond(P.x, P.y, 44)) c.push({ label: 'DRINK', x: P.x, y: P.y, d: 0, fn: () => startDrink('mirror'), prio: 0, cls: 'water', hold: true });
        else if (sd < STREAM.width / 2 + 36 && !onBridge(P.x, P.y)) c.push({ label: 'DRINK', x: P.x, y: P.y, d: sd, fn: () => startDrink('stream'), prio: 0, cls: 'water', hold: true });
      }
    }
    if (!c.length) return null;
    c.sort((a, b) => (b.prio - a.prio) || (a.d - b.d));
    return c[0];
  }

  /* ---------- physics: gravity, flying and swimming ---------- */
  const flyHeld = () => keys.has('f') || keys.has('shift') || flyTouch;
  // Skill levels: 1-3 come from lessons, then mastery levels keep going forever with practice.
  const masteryNeed = (L) => 30 * (L - 3) * (L - 2);  // total seconds of practice for level L (L >= 4)
  function skillLevel(skill) {
    const base = G.skills[skill];
    if (base < 3) return base;
    const xp = (G.xp || {})[skill] || 0;
    let L = 3; while (xp >= masteryNeed(L + 1)) L++;
    return L;
  }
  const flyMax = (l) => l <= 3 ? PHYS.flyMaxZ[l] : 190 + (l - 3) * 15;
  const wingMax = (l) => l <= 3 ? PHYS.wing[l] : 6 + (l - 3) * 0.6;
  let masteryT = 1;
  function masteryTick(dt) {
    G.xp = G.xp || { swim: 0, fly: 0 };
    if (P.swimming) G.xp.swim += dt;
    if (P.z > 2) G.xp.fly += dt;
    masteryT -= dt; if (masteryT > 0) return; masteryT = 1;
    G.mastery = G.mastery || { swim: 3, fly: 3 };
    ['swim', 'fly'].forEach(sk => {
      const L = skillLevel(sk);
      if (L > 3 && L > (G.mastery[sk] || 3)) {
        G.mastery[sk] = L; G.bonusStars = (G.bonusStars || 0) + 1;
        Sound.secret();
        UI.toast(`<span class="t-small">⭐ +1 · Mastery</span>${sk === 'swim' ? '🏊 Swimming' : '🪽 Flying'} level ${L}! ${sk === 'swim' ? 'A little faster in the water.' : 'Higher and longer flights.'}`, { life: 3.4 });
        save();
      }
    });
  }
  function physics(dt) {
    const lvl = skillLevel('fly');
    P.wings = lvl >= 1;
    // jump off the ground
    if (flyHeld() && P.z === 0 && !P.swimming && !drinkHeld && !P.jumpLock) {
      P.vz = PHYS.hop; P.jumpLock = true; P.airT = 0;
      G.stats.hops++;
      dailyAdd('hop');
      Sound.pop();
      if (G.lesson && G.lesson.id === 'fly1') G.lesson.n = (G.lesson.n || 0) + 1;
    }
    if (!flyHeld()) P.jumpLock = false;
    if (P.z > 0 || P.vz > 0) {
      P.airT += dt;
      dailyAdd('air', dt);
      P.flapping = false;
      if (flyHeld() && lvl >= 1 && P.wing > 0 && P.z < flyMax(lvl) && P.airT > 0.12) {
        P.vz = Math.min(P.vz + 2600 * dt, 240);
        P.wing -= dt; P.flapping = true;
        if (Math.random() < dt * 6) Sound.step();
      }
      P.vz -= PHYS.gravity * dt;
      if (lvl >= 1 && !P.flapping && P.vz < -170) P.vz = -170; // wings make you glide down gently
      P.z += P.vz * dt;
      if (P.z >= flyMax(lvl) && lvl >= 1) { P.z = flyMax(lvl); P.vz = Math.min(P.vz, 0); }
      if (P.airT > (G.stats.bestAir || 0)) G.stats.bestAir = P.airT;
      if (P.z <= 0) land();
    } else {
      P.wing = Math.min(wingMax(lvl), P.wing + dt * 1.5);
      if (!P.swimming && !isWater(P.x, P.y)) { lastGround.x = P.x; lastGround.y = P.y; }
    }
    // swimming in streams and ponds
    if (P.area === 'open') {
      G.stats.swimOpen += dt;
      P.stamina -= dt;
      // the stream's current pulls you downstream
      if (!inPond(P.x, P.y) && !inSpring(P.x, P.y)) {
        const dir = streamDir(P.x, P.y), push = PHYS.current[G.skills.swim] * (dishOn('sea') ? 0.5 : 1) * dt;
        const nx = P.x + dir[0] * push, ny = P.y + dir[1] * push;
        if (!blocked(nx, ny, 0, false)) { P.x = nx; P.y = ny; }
      }
      if (P.stamina <= 0) {
        stopOpenSwim();
        P.x = lastGround.x; P.y = lastGround.y;
        Sound.splash();
        UI.toast('<span class="t-small">Too tired! 😮‍💨</span>You paddled back to the shore. More lessons = more stamina.', { life: 3 });
      }
    }
  }
  function land() {
    P.z = 0; P.vz = 0; P.flapping = false;
    if (P.airT > 0.3) burst(P.x, P.y, 8, ['#fff3d6', '#d9b877'], { speed: 120, up: 60, size: 4, life: 0.5 });
    if (isWater(P.x, P.y)) {
      if (G.skills.swim >= 1) { startOpenSwim(); return; }
      Sound.splash();
      burst(P.x, P.y, 20, ['#8fe0ea', '#ffffff'], { speed: 220, up: 200, size: 5, type: 'drop' });
      P.x = lastGround.x; P.y = lastGround.y;
      waterHint(true);
      return;
    }
    if (blocked(P.x, P.y, 0, false)) { P.x = lastGround.x; P.y = lastGround.y; }
  }
  function streamDir(x, y) {
    let best = 1e9, dir = [0, 1];
    for (let i = 1; i < streamSamples.length; i++) {
      const [ax, ay] = streamSamples[i - 1], [bx, by] = streamSamples[i];
      const d = dist(x, y, (ax + bx) / 2, (ay + by) / 2);
      if (d < best) { best = d; const l = Math.hypot(bx - ax, by - ay) || 1; dir = [(bx - ax) / l, (by - ay) / l]; }
    }
    return dir;
  }
  function startOpenSwim() {
    if (P.area === 'open') return;
    P.swimming = true; P.area = 'open'; P.z = 0; P.vz = 0;
    P.stamina = PHYS.swimStamina[G.skills.swim] * (dishOn('sea') ? 2 : 1);
    drinkHeld = false;
    Sound.splash();
    burst(P.x, P.y, 14, ['#8fe0ea', '#ffffff'], { speed: 180, up: 160, size: 4, type: 'drop' });
  }
  function stopOpenSwim() { if (P.area === 'open') { P.swimming = false; P.area = null; } }
  function waterHint(fell) {
    if (now - waterHintT < 4) return;
    waterHintT = now;
    UI.toast(`<span class="t-small">${fell ? 'Splash! 💦' : 'Deep water 🌊'}</span>You can't swim yet. Take lessons with Coach Kombu at the pool.`, { life: 3.2 });
  }

  /* ---------- lessons, challenges and stars ---------- */
  const lessonDone = (id) => !!G.lessons[id];
  function starTotal() {
    let n = 0;
    LESSONS.forEach(l => { if (G.lessons[l.id]) n += l.stars; });
    CHALLENGES.forEach(c => { if (G.challenges[c.id]) n += c.stars; });
    return n + (G.bonusStars || 0);
  }
  // Daily challenges (new ones every in-game morning)
  function ensureDaily() {
    if (G.daily && G.daily.day === G.day) return;
    const rnd = mulberry(G.day * 7919 + 13);
    const pool = DAILY_POOL.filter(d => (!d.needFly || G.skills.fly >= 1) && (!d.needSwim || G.skills.swim >= 1));
    const list = [];
    while (list.length < 3 && pool.length) {
      const d = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      let goal = d.min + Math.floor(rnd() * (d.max - d.min + 1));
      if (d.id === 'crunch' && G.day <= 3) goal = 6 + Math.floor(rnd() * 7);
      list.push({ id: d.id, goal, title: d.title.replace('{n}', goal) });
    }
    G.daily = { day: G.day, list, prog: {}, done: {} };
  }
  function dailyAdd(key, amount = 1) {
    if (!G || !G.daily || G.daily.day !== G.day) return;
    const c = G.daily.list.find(x => x.id === key);
    if (!c || G.daily.done[key]) return;
    G.daily.prog[key] = (G.daily.prog[key] || 0) + amount;
    if (G.daily.prog[key] >= c.goal) {
      G.daily.done[key] = true;
      G.bonusStars = (G.bonusStars || 0) + 1;
      Sound.coin();
      UI.toast(`<span class="t-small">⭐ +1 · Daily challenge</span>${c.title}. Done!`, { life: 3 });
      addCoins(5);
      if (G.daily.list.every(x => G.daily.done[x.id])) {
        G.streak = G.lastPerfect === G.day - 1 ? (G.streak || 0) + 1 : 1;
        G.lastPerfect = G.day;
        G.bonusStars = (G.bonusStars || 0) + 2;
        setTimeout(() => { Sound.secret(); addCoins(15); UI.toast(`<span class="t-small">🌟 Perfect Day! ⭐ +2</span>All 3 challenges done. Streak: ${G.streak} day${G.streak > 1 ? 's' : ''} 🔥`, { big: true, life: 4 }); }, 1200);
      }
    }
  }

  function nextLesson(coach) { return LESSONS.find(l => l.coach === coach && !lessonDone(l.id)); }
  function startLesson(l) {
    G.lesson = { id: l.id, left: { swim1: 60, swim2: 45, swim3: 90, fly1: 60, fly2: 60, fly3: 90 }[l.id], n: 0, side: null, rings: [false, false, false], started: false };
    Sound.blip();
    UI.toast(`<span class="t-small">Lesson started</span>${l.title}: ${l.desc}`, { life: 4 });
  }
  function completeLesson(id) {
    const l = LESSONS.find(x => x.id === id);
    G.lessons[id] = true; G.lesson = null;
    G.skills[l.skill] = Math.max(G.skills[l.skill], l.level);
    if (l.skill === 'fly') P.wing = wingMax(skillLevel('fly'));
    if (l.skill === 'swim' && P.area === 'open') P.stamina = PHYS.swimStamina[G.skills.swim];
    Sound.secret(); P.wow = 1.8;
    burst(P.x, P.y - 60 - P.z, 34, ['#ffd23f', '#fff8e8', '#8fe0ea'], { type: 'spark', speed: 280, grav: 150 });
    UI.toast(`<span class="t-small">⭐ +${l.stars} · ${l.skill === 'swim' ? 'Swimming' : 'Flying'} level ${l.level}</span>${l.unlock}`, { big: true, life: 4.4 });
    if (id === 'fly3') setTimeout(() => giveNoodle('sky'), 800);
    save();
  }
  function lessonTick(dt) {
    const L = G.lesson; if (!L) return;
    L.left -= dt;
    if (L.left <= 0) { G.lesson = null; Sound.wrong(); UI.toast('<span class="t-small">Out of time</span>Talk to your coach to try the lesson again.', { life: 3 }); return; }
    switch (L.id) {
      case 'swim1': if (P.swimming && P.area === 'pool') { L.n += dt; if (L.n >= 5) completeLesson('swim1'); } break;
      case 'swim2':
        if (P.swimming && P.area === 'pool') {
          const side = P.x < POOL.x + 50 ? 'L' : P.x > POOL.x + POOL.w - 50 ? 'R' : null;
          if (side && side !== L.side) { L.side = side; L.n++; Sound.blip(); if (L.n >= 4) completeLesson('swim2'); }
        }
        break;
      case 'swim3':
        if (P.area === 'open' && P.y < 820) L.started = true;
        if (L.started && P.area === 'open' && P.y > 1225) completeLesson('swim3');
        break;
      case 'fly1': if (L.n >= 5) completeLesson('fly1'); break;
      case 'fly2':
        RINGS.forEach(([rx, ry], i) => {
          if (!L.rings[i] && dist(P.x, P.y, rx, ry) < 44 && Math.abs(P.z - RING_Z) < 32) { L.rings[i] = true; Sound.coin(); burst(rx, ry - RING_Z, 16, ['#ffd23f', '#fff8e8'], { type: 'spark', speed: 200, grav: 0 }); }
        });
        if (L.rings.every(Boolean)) completeLesson('fly2');
        break;
      case 'fly3': if (P.z >= SKY_CLOUD.z - 12 && dist(P.x, P.y, SKY_CLOUD.x, SKY_CLOUD.y) < 70) completeLesson('fly3'); break;
    }
  }
  function lessonText() {
    const L = G.lesson; if (!L) return null;
    const l = LESSONS.find(x => x.id === L.id), s = Math.ceil(L.left) + 's';
    const prog = { swim1: `${Math.min(5, L.n).toFixed(0)}/5s afloat`, swim2: `${L.n}/4 walls`, swim3: L.started ? 'swim down to bridge 2!' : 'jump in near bridge 1', fly1: `${L.n}/5 hops`, fly2: `${L.rings.filter(Boolean).length}/3 rings`, fly3: 'fly up to the cloud' }[L.id];
    return `Lesson · ${l.title}: ${prog} (${s})`;
  }
  // Noodle Level rewards: every level gives something, forever.
  const noodleLevel = () => 1 + Math.floor(Math.sqrt(starTotal() / 2));
  function levelTick() {
    const L = noodleLevel();
    if (!G.levelClaimed) { G.levelClaimed = 1; }
    if (G.levelClaimed >= L) return;
    const got = [];
    while (G.levelClaimed < L) {
      G.levelClaimed++;
      const r = levelReward(G.levelClaimed);
      if (r.coins) G.coins += r.coins;
      if (r.hat) { G.hats[r.hat] = true; if (!G.hat) G.hat = r.hat; }
      if (r.flag) G.flags[r.flag] = true;
      got.push(r.text);
    }
    Sound.secret(); P.wow = 1.6;
    burst(P.x, P.y - 80, 30, ['#ffd23f', '#b98cff', '#8fe0ea', '#ff8fb1'], { type: 'spark', speed: 260, grav: 120 });
    UI.toast(`<span class="t-small">🎉 Noodle Level ${L}!</span>You got ${got.join(', ')}.`, { big: true, life: 4.4 });
    save();
  }
  // Shiny noodles: rare golden versions of noodles you already have.
  function giveShiny(why) {
    const pool = G.found.filter(id => !G.shiny[id]);
    if (!pool.length) return false;
    const id = pool[Math.floor(Math.random() * pool.length)], n = NOODLES.find(x => x.id === id);
    G.shiny[id] = true;
    G.bonusStars = (G.bonusStars || 0) + 1;
    Sound.secret(); P.wow = 1.6;
    burst(P.x, P.y - 70, 28, ['#ffd23f', '#fff1a8', '#ffffff'], { type: 'spark', speed: 240, grav: 100 });
    UI.toast(`<span class="t-small">✨ Shiny noodle! ⭐ +1${why ? ' · ' + why : ''}</span>A golden ${n.name}!`, { noodle: n, shiny: true, big: true, life: 4 });
    save();
    return true;
  }
  const maybeShiny = (chance = SHINY_CHANCE) => { if (Math.random() < chance) setTimeout(() => giveShiny(), 700); };

  // Grandma's shop
  function buyHat(id) {
    const h = HATS[id]; if (!h || G.hats[id]) return 'You already have it.';
    if (G.coins < h.price) return `You need ${h.price - G.coins} more coins.`;
    G.coins -= h.price; G.hats[id] = true; G.hat = id; Sound.coin(); save();
    UI.toast(`<span class="t-small">🛍️ New hat</span>${h.name}. Looking good!`, { life: 2.8 });
    return '';
  }
  function wearHat(id) { G.hat = id && G.hats[id] ? id : null; Sound.blip(); save(); }
  function buyGoodie(id) {
    const g = SHOP_GOODIES.find(x => x.id === id);
    if (G.coins < g.price) return `You need ${g.price - G.coins} more coins.`;
    if (id === 'rocket' && G.launchDay !== G.day) return 'Your rocket is already fueled for today!';
    if (id === 'fortune' && G.fortune && !G.fortune.done) return G.fortune.crunched ? 'Solve today\'s riddle first (check your journal).' : 'Today\'s Fortune Cracker is still out there somewhere. Find it first!';
    if (id === 'broth' && G.water >= 99) return 'Your water is already full.';
    G.coins -= g.price; Sound.coin();
    if (id === 'rocket') { G.launchDay = -1; UI.toast('<span class="t-small">🚀 Rocket fueled</span>Launch it from the pad in Crunch Meadow.', { life: 3 }); }
    if (id === 'fortune') {
      G.fortuneN = (G.fortuneN || 0) + 1;
      G.fortune = { idx: (G.day * 7 + 3 + G.fortuneN * 5) % FORTUNES.length, spawn: Math.floor(Math.random() * FORTUNE_SPAWNS.length), crunched: false, done: false };
      UI.toast('<span class="t-small">🥠 New Fortune Cracker</span>A pink sparkly brick appeared somewhere. Find it and crunch it!', { life: 3.4 });
    }
    if (id === 'broth') { G.water = 100; floatText(P.x, P.y - 100, 'Ahh!', '#8fe0ea'); }
    save();
    return '';
  }

  function sellFood(id, all) {
    const have = G.pantry[id] || 0; if (!have) return 'You have none left.';
    const n = all ? have : 1, coins = n * FOOD_PRICES[id];
    G.pantry[id] -= n;
    addCoins(coins);
    UI.toast(`<span class="t-small">🪙 Sold to Grandma</span>${n} × ${FOODS[id].name} for ${coins} coins.`, { food: id, life: 2.4 });
    save();
    return '';
  }

  let chalT = 0;
  function challengeTick(dt) {
    chalT -= dt; if (chalT > 0) return; chalT = 0.5;
    levelTick();
    const met = {
      combo5: G.stats.maxCombo >= 5, drink10: G.drinks >= 10, early: !!G.flags.early,
      noodles10: G.found.length >= 10, air4: (G.stats.bestAir || 0) >= 4, river30: G.stats.swimOpen >= 30, noodles20: G.found.length >= 20,
    };
    CHALLENGES.forEach(c => {
      if (G.challenges[c.id] || !met[c.id]) return;
      G.challenges[c.id] = true;
      Sound.coin();
      UI.toast(`<span class="t-small">⭐ +${c.stars} · Challenge complete</span>${c.title}: ${c.desc}`, { life: 3.4 });
      save();
    });
  }

  function talkCoach(key) {
    const c = COACHES[key], who = key;
    const l = nextLesson(key);
    const skillName = key === 'kombu' ? 'swimming' : 'flying';
    if (!l) return UI.say(who, key === 'kombu' ? ['You swim better than a noodle in soup! Nothing left to teach you.', 'Go ride the rivers, champ!'] : ['Squawk! You fly like a true Soba Bird now.', 'The sky is all yours.']);
    if (G.lesson && G.lesson.id === l.id) return UI.say(who, `Keep going! ${l.desc}`);
    const intro = G.skills[c.skill] === 0
      ? (key === 'kombu' ? ['Hey hey! I\'m Coach Kombu. Water is deep, and you don\'t know how to swim yet!', 'Without lessons you can\'t go in streams or ponds. Let\'s fix that.'] : ['Squawk! Captain Penne here, flight instructor.', 'Down here, gravity always pulls you back to the ground. But with practice... you can fly!'])
      : [`Ready for more ${skillName}?`];
    UI.say(who, [...intro, `Lesson ${l.level}: <em>${l.title}</em>. ${l.desc}`], { choices: [
      { label: 'Start lesson', fn: () => startLesson(l) },
      { label: 'Later', alt: true },
    ] });
  }

  function crunch(b) {
    faceStep('crunch');
    dailyAdd('crunch');
    P.crunching = 0.45;
    shake = Math.min(14, 6 + combo.n * 1.5);
    Sound.crunch(b.kind === 'gold' ? 1.4 : 1); buzz(b.kind === 'boulder' ? 35 : 18);
    const cols = { normal: ['#f4c35a', '#e0a13a', '#fff3d6'], woods: ['#c6d77a', '#9ccb6b', '#fff3d6'], gold: ['#ffd23f', '#fff8e8', '#e4572e'], fortune: ['#ffb3c8', '#fff8e8', '#b98cff'], canyon: ['#e59866', '#c9784a', '#fff3d6'], boulder: ['#c9784a', '#a45a33', '#e9a36b'], peak: ['#a9a39a', '#9a7b5b', '#fff3d6'], snow: ['#ffffff', '#dfe8f2', '#bfe9ff'] }[b.kind];
    burst(b.x, b.y - 16, 22, cols, { speed: 280, up: 260, size: 6 });
    floatText(b.x, b.y - 50, 'CRUNCH!', '#fff8e8');
    G.water = Math.max(0, G.water - 5);

    const t = now;
    const win = (buffed() ? 2.6 : 1.7) + (dishOn('dumpling') ? 1.2 : 0);
    combo.n = t - combo.last < win ? combo.n + 1 : 1;
    combo.last = t;
    UI.combo(combo.n);
    G.stats.maxCombo = Math.max(G.stats.maxCombo || 0, combo.n);
    if (combo.n >= 3) dailyAdd('combo');
    if (combo.n >= 2) Sound.combo(combo.n);
    if (combo.n >= 5 && !has('macaroni')) setTimeout(() => giveNoodle('macaroni'), 350);

    if (b.i === 'gold') return crunchGold();
    if (b.i === 'fortune') return crunchFortune();
    if (b.kind === 'boulder') {
      G.boulderHp[b.k] = b.hp - 1;
      shake = 16;
      if (G.boulderHp[b.k] > 0) { floatText(b.x, b.y - 90, `${G.boulderHp[b.k]} more!`, '#ffd23f'); return; }
      burst(b.x, b.y - 20, 40, cols, { speed: 380, up: 320, size: 8 });
      addCoins(5, b.x, b.y - 90);
      Net.crunch('boulder' + b.k);
      if (!has('boulder')) giveNoodle('boulder');
      return;
    }

    G.crunched.push(b.i);
    Net.crunch(b.i);
    G.crunches++;
    if (b.kind === 'woods') G.woodsCrunches++;
    if (b.kind === 'canyon') G.canyonCrunches++;
    if (b.kind === 'peak' || b.kind === 'snow') G.peakCrunches = (G.peakCrunches || 0) + 1;
    addCoins(1 + (combo.n >= 3 ? 1 : 0) + (buffed() ? 1 : 0), b.x, b.y - 80);
    maybeShiny();
    if (!has('brick')) return giveNoodle('brick');
    if (b.kind === 'woods' && !has('matcha') && (Math.random() < 0.35 || G.woodsCrunches >= 3)) return giveNoodle('matcha');
    if (b.kind === 'snow' && !has('somen') && (Math.random() < 0.4 || G.peakCrunches >= 3)) return giveNoodle('somen');
    if (b.kind === 'peak' && !has('peaksoba') && (Math.random() < 0.35 || G.peakCrunches >= 2)) return giveNoodle('peaksoba');
    if (b.kind === 'canyon' && !has('crackle') && (Math.random() < 0.35 || G.canyonCrunches >= 3)) return giveNoodle('crackle');
    if (!has('crinkle') && (Math.random() < 0.2 || G.crunches >= 5)) return giveNoodle('crinkle');
  }

  /* ---------- Chapter 2: Crunch Canyon ---------- */
  function crunchGate() {
    G.gateHp--;
    P.crunching = 0.45; shake = 20;
    Sound.crunch(1.5); buzz(45);
    const gx = CANYON.gate.x, gy = CANYON.wallY - 20;
    burst(gx, gy, 30, ['#a45a33', '#c9784a', '#e9a36b'], { speed: 340, up: 300, size: 8 });
    if (G.gateHp > 0) { floatText(gx, gy - 70, G.gateHp === 2 ? 'CRACK!' : 'ALMOST!', '#ffd23f'); save(); return; }
    G.flags.gateOpen = true;
    burst(gx, gy, 60, ['#a45a33', '#e9a36b', '#fff3d6', '#ffd23f'], { speed: 460, up: 380, size: 10 });
    Sound.secret(); P.wow = 1.6;
    UI.toast('<span class="t-small">The wall crumbles</span>Crunch Canyon is open!', { life: 3.6 });
    save();
  }

  function crunchRock(i) {
    const [rx, ry] = CANYON.rocks[i];
    P.crunching = 0.45; shake = 8;
    Sound.crunch(0.9);
    burst(rx, ry - 50, 12, ['#c9784a', '#e9a36b'], { speed: 200, up: 200, size: 5 });
    faceStep('crunch');
    const isTrue = i === CANYON.trueRock;
    // every rock echoes once; the true one echoes twice, then booms
    if (isTrue) {
      Sound.echo(0.25, 0.5); Sound.echo(0.5, 0.35); Sound.echo(1.4, 1.1);
      rockShimmer[i] = 2.2;
      setTimeout(() => floatText(rx, ry - 130, 'crunch', '#fff8e8'), 250);
      setTimeout(() => floatText(rx, ry - 130, 'crunch', '#fff8e8'), 500);
      setTimeout(() => floatText(rx, ry - 140, 'CRUNCH!!', '#ffd23f'), 1400);
      if (G.clues.includes('canyon') && !G.pieces.includes(3)) {
        setTimeout(() => {
          G.pieces.push(3); solve('canyon');
          Sound.secret(); P.wow = 1.6;
          burst(rx, ry - 40, 36, ['#ffd23f', '#fff8e8', '#e9a36b'], { type: 'spark', speed: 280, grav: 150 });
          UI.say('me-wow', [
            'That echo! crunch... crunch... and then a big CRUNCH!',
            'A piece of paper flutters down from behind the rock. <em>Map Piece 3</em>!',
            'It shows a drum. And three dots: two small, a gap, then one big.',
          ], { onDone: () => { addClue('piece3'); save(); } });
        }, 2000);
      }
    } else {
      Sound.echo(0.55, 0.3);
      rockShimmer[i] = 1;
      setTimeout(() => floatText(rx, ry - 130, 'crunch…', '#fff8e8'), 550);
    }
  }

  function hitDrum() {
    drumHit = 1;
    Sound.drum(drumBeats.length); buzz(30);
    shake = 5;
    floatText(DRUM.x + (Math.random() - 0.5) * 40, DRUM.y - 130, 'BOM', '#fff8e8');
    if (G.pieces.includes(4)) return;
    const t = now;
    if (drumBeats.length && t - drumBeats[drumBeats.length - 1] > 2.4) drumBeats = [];
    drumBeats.push(t);
    if (drumBeats.length < 3) return;
    const [a, b, c] = drumBeats.slice(-3);
    drumBeats = [];
    const g1 = b - a, g2 = c - b;
    const miss = G.drumMiss || 0;
    const right = miss >= 4 ? g2 > g1 : (g1 < 0.8 && g2 > 0.6 && g2 < 3.0 && g2 > g1 * 1.4);
    const played = '● ' + (g1 > 0.6 ? '· · ' : '') + '● ' + (g2 > 0.6 ? '· · ' : '') + '●';
    if (!G.pieces.includes(3)) { setTimeout(() => UI.toast('The drum hums. It seems to be waiting for a special rhythm.', { life: 2.6 }), 300); return; }
    if (!right) {
      G.drumMiss = miss + 1;
      setTimeout(() => {
        Sound.wrong();
        UI.toast(`<span class="t-small">You played: ${played}</span>The drum grumbles. The echo went: ● ● · · ●`, { life: 3 });
        if (G.drumMiss === 2) setTimeout(() => {
          UI.toast('<span class="t-small">🥁 The drum plays by itself!</span>Listen: BOM BOM ... BOOM', { life: 3.4 });
          [0, 0.3, 1.3].forEach((d, i) => setTimeout(() => { Sound.drum(i); drumHit = 1; floatText(DRUM.x, DRUM.y - 130, i < 2 ? 'BOM' : 'BOOM', '#ffd23f'); }, 900 + d * 1000));
        }, 800);
      }, 250);
      return;
    }
    G.pieces.push(4); solve('piece3');
    setTimeout(() => {
      Sound.secret(); P.wow = 1.6; shake = 14;
      burst(DRUM.x, DRUM.y - 100, 44, ['#ffd23f', '#e4572e', '#fff8e8'], { type: 'spark', speed: 320, grav: 150 });
      giveNoodle('rigatoni');
      UI.say('note', [
        'BOM BOM ... BOOOM! The drum head pops open like a lid!',
        'Inside: <em>Map Piece 4</em>, and a note in Grandma\'s curly writing:',
        '<em>"Drink where the water lies."</em>',
      ], { onDone: () => { addClue('piece4'); save(); } });
    }, 400);
  }

  // The snail's real-time trip: 7 real days along the roads, from the canyon to the summit.
  const snailTrip = () => G.snailStart ? Math.min(1, (Date.now() - G.snailStart) / (SNAIL_TRIP_DAYS * 86400000)) : 0;
  function snailTripPos() {
    const segs = []; let total = 0;
    for (let i = 1; i < SNAIL_PATH.length; i++) { const l = dist(...SNAIL_PATH[i - 1], ...SNAIL_PATH[i]); segs.push(l); total += l; }
    let d = snailTrip() * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i]) { const [ax, ay] = SNAIL_PATH[i], [bx, by] = SNAIL_PATH[i + 1], f = d / segs[i]; return [ax + (bx - ax) * f, ay + (by - ay) * f]; }
      d -= segs[i];
    }
    return SNAIL_PATH[SNAIL_PATH.length - 1];
  }
  function talkSnail() {
    if (G.pieces.includes(5)) {
      const p = snailTrip();
      if (p >= 1) {
        if (!G.flags.snailGift) {
          return UI.say('snail', [
            'Phew... I made it! The top of the Soba Peaks. Told you I would come. Only took a week!',
            'Here, for waiting so patiently: my old <em>Golden Snail Shell</em>, 100 coins, and a very shiny Slow Udon.',
          ], { onDone: () => {
            G.flags.snailGift = true; G.hats.shell = true; G.hat = 'shell'; G.coins += 100;
            if (!has('slowudon')) G.found.push('slowudon');
            G.shiny.slowudon = true; G.bonusStars = (G.bonusStars || 0) + 3;
            Sound.secret(); P.wow = 2;
            burst(P.x, P.y - 70, 40, ['#ffd23f', '#fff1a8', '#d8e38a'], { type: 'spark', speed: 280, grav: 120 });
            UI.toast('<span class="t-small">🐌 A gift from the Udon Snail · ⭐ +3</span>Golden Snail Shell hat, 100 coins and a shiny Slow Udon!', { big: true, life: 4.6 });
            save();
          } });
        }
        return UI.say('snail', ['What a view up here. I think I\'ll stay a while. Maybe a year. Or two.']);
      }
      const day = Math.min(SNAIL_TRIP_DAYS, Math.floor(p * SNAIL_TRIP_DAYS) + 1), left = Math.ceil((1 - p) * SNAIL_TRIP_DAYS * 24);
      const lines = [
        `Hellooo, speedy! I\'m on my way to the mountains. Day ${day} of ${SNAIL_TRIP_DAYS}.`,
        left > 24 ? `About ${Math.ceil(left / 24)} more days to go. Real days! Come find me again.` : `Only about ${left} more hours! Meet me at the top of the Soba Peaks.`,
        'I will have a present for you when I get there. Something shiny...',
      ];
      return UI.say('snail', lines);
    }
    if (G.clues.includes('mirror')) {
      if (has('dawn')) {
        return UI.say('snail', [
          'Under my house? Mmm... My shell IS my house, you know.',
          'Oh! You have seen the <em>Dawn Noodle</em>? The one that only lives at sunrise? How lovely.',
          'For a friend of the morning... fine, fine. I\'ll scooch. Veeeery slowly.',
        ], { onDone: finishSnail });
      }
      return UI.say('snail', [
        'Under my house? Mmm, maybe there is something. Maybe not.',
        'I only scooch for someone who has seen the <em>Dawn Noodle</em>. It floats in the Morning Pool, right after it opens.',
      ]);
    }
    const lines = [
      ['Hellooo... I\'m the Udon Snail. I\'m in no hurry. Are you?', 'Take your time. Noodles taste better slow.'],
      ['The rocks here are very chatty. Crunch one and it talks back.', 'Some of them talk back more than once. Hee.'],
      ['Have you tried the Minty Spring? It makes your feet feel fresh.'],
    ];
    UI.say('snail', lines[(G.day + G.coins) % lines.length]);
  }
  function finishSnail() {
    snail.moved = 1;
    setTimeout(() => {
      G.pieces.push(5); solve('mirror'); G.snailStart = Date.now();
      Sound.secret(); P.wow = 1.8;
      burst(CANYON.snail.x, CANYON.snail.y - 10, 50, ['#ffd23f', '#fff8e8', '#d8e38a'], { type: 'spark', speed: 300, grav: 150 });
      giveNoodle('slowudon');
      UI.say('me-wow', [
        'Where the snail was sitting: <em>Map Piece 5</em>!',
        'It shows tall mountains... and on top, a little statue with a square head. It looks just like you.',
      ], { onDone: () => { addClue('piece5'); UI.toast('<span class="t-small">Chapter 2 complete</span>Far to the east, the mountain fog is lifting…', { life: 4.8 }); save(); } });
    }, 1400);
  }

  function crunchGold() {
    G.pieces.push(2); solve('piece1');
    shake = 18; Sound.secret();
    burst(GOLD_BRICK.x, GOLD_BRICK.y - 20, 50, ['#ffd23f', '#fff8e8', '#e4572e'], { speed: 360, up: 300, size: 7, type: 'spark' });
    setTimeout(() => {
      giveNoodle('updown');
      UI.say('note', [
        'Inside the golden brick: <em>Map Piece 2</em>, and a folded note.',
        'The note is written in little noodle shapes. Straight ones, wavy ones, curly ones, zigzags. Some have dots on top.',
        'You can\'t read it. Not yet.',
      ], { onDone: () => addClue('cipher') });
    }, 700);
    save();
  }
  function crunchFortune() {
    G.fortune.crunched = true;
    burst(P.x, P.y - 40, 16, ['#ffb3c8', '#b98cff', '#fff8e8'], { type: 'spark', speed: 200, grav: 150 });
    const f = FORTUNES[G.fortune.idx];
    setTimeout(() => UI.say('note', ['A Fortune Cracker! A tiny paper strip falls out:', `<em>"${f.text}"</em>`]), 450);
    G.journalNew = true;
    save();
  }
  function fortuneFound() {
    G.fortune.done = true;
    Sound.secret(); P.wow = 1.4;
    burst(P.x, P.y - 40, 26, ['#ffd23f', '#fff8e8', '#ffb3c8'], { type: 'spark', speed: 240, grav: 150 });
    addCoins(10);
    UI.toast('<span class="t-small">Fortune solved</span>You found the hidden treasure!', { life: 2.8 });
    if (!has('cloud')) setTimeout(() => giveNoodle('cloud'), 600);
    else maybeShiny(0.25);
    save();
  }

  function nearestWater() {
    const spots = [...streamSamples.filter((_, i) => i % 6 === 0).map(([x, y]) => ({ x, y, n: 'the stream' })), { x: MIRROR.x, y: MIRROR.y, n: 'the Mirror Pond' }, { x: LAKE.x + LAKE.w / 2, y: LAKE.y - 20, n: 'the mountain lake' }];
    if (canyonOpen()) spots.push({ x: SPRING.x, y: SPRING.y, n: 'the Minty Spring' });
    let best = spots[0], bd = 1e9;
    spots.forEach(sp => { const d = dist(P.x, P.y, sp.x, sp.y); if (d < bd) { bd = d; best = sp; } });
    const a = Math.atan2(best.y - P.y, best.x - P.x) * 180 / Math.PI;
    const dir = a > -45 && a <= 45 ? 'east' : a > 45 && a <= 135 ? 'south' : a < -45 && a >= -135 ? 'north' : 'west';
    return `Drink from ${best.n}, to the ${dir}. Your face is getting hot!`;
  }
  function startDrink(where = 'stream') {
    drinkHeld = true; drinkWhere = where;
    G.drinks++;
    dailyAdd('drink');
    Sound.gulp();
    if (where === 'spring') {
      if (!minty()) UI.toast('<span class="t-small">Minty 🌿</span>So fresh! You walk faster for a while.', { life: 2.8 });
      G.mintDay = G.day; G.mintUntil = G.time + 120;
      if (!has('mint')) setTimeout(() => giveNoodle('mint'), 500);
    }
    if (where === 'mirror') mirrorTimer = 0;
    if (!has('soba') && G.drinks >= 3) setTimeout(() => giveNoodle('soba'), 500);
  }

  function shakeTree(i) {
    const [tx, ty, kind] = TREES[i];
    const food = TREE_FOOD[kind];
    G.shaken[i] = (G.shaken[i] || 0) + 1;
    treeShake.set(i, now + 0.5);
    const first = !(G.pantry[food] > 0) && !(G.foodSeen || {})[food];
    G.pantry[food] = (G.pantry[food] || 0) + 1;
    G.foodSeen = G.foodSeen || {}; G.foodSeen[food] = true;
    Sound.pop(); buzz(15);
    burst(tx, ty - 60, 10, ['#8cbf5a', '#6fa54a', FOOD_COLORS[food]], { speed: 180, up: 120, size: 5 });
    floatText(tx, ty - 110, '+1 ' + FOODS[food].name, '#fff8e8');
    dailyAdd('food');
    maybeShiny();
    if (first) UI.toast(`<span class="t-small">New food · ${TREE_NAMES[kind]}</span>${FOODS[food].name}. Grandma can cook with it!`, { food, life: 3.2 });
    save();
  }
  function eatFood(id) {
    if (!(G.pantry[id] > 0)) return false;
    G.pantry[id]--;
    G.water = Math.min(100, G.water + 20);
    Sound.gulp(); P.crunching = 0.5;
    floatText(P.x, P.y - 100, 'Yum!', '#ffd23f');
    save();
    return true;
  }
  function canCook(r) { return Object.entries(r.needs).every(([f, n]) => (G.pantry[f] || 0) >= n); }
  function cook(id) {
    const r = RECIPES.find(x => x.id === id);
    if (!r || !canCook(r)) return false;
    Object.entries(r.needs).forEach(([f, n]) => { G.pantry[f] -= n; });
    const first = !G.cooked[id];
    G.cooked[id] = (G.cooked[id] || 0) + 1;
    G.dishes = G.dishes || {};
    if (id === 'classic' || id === 'feast') { G.water = 100; addCoins(id === 'feast' ? 40 : 15); }
    if (id !== 'classic') G.dishes[id] = { day: G.day, until: id === 'spicy' ? G.time + 180 : 24 * 60 };
    if (first) { G.bonusStars = (G.bonusStars || 0) + 2; }
    Sound.secret(); P.wow = 1.6; P.crunching = 0.8;
    burst(P.x, P.y - 70, 26, ['#ffd23f', '#e4572e', '#fff8e8'], { type: 'spark', speed: 240, grav: 150 });
    UI.toast(`<span class="t-small">🍜 ${r.name}${first ? ' · ⭐ +2 new recipe' : ''}</span>${r.effect}`, { big: true, life: 4 });
    save();
    return true;
  }

  function pickVine() {
    Sound.pop();
    burst(P.x, P.y - 70, 10, ['#f7dc7a', '#fff3d6'], { speed: 150 });
    giveNoodle('vine');
  }
  function pickGlass(g) {
    G.glassTaken.push(g.i);
    burst(g.x, g.y - 10, 18, ['#c9f3ff', '#ffffff'], { type: 'spark', speed: 180, grav: 80 });
    Sound.pop();
    if (!giveNoodle('glass')) addCoins(4, g.x, g.y - 40);
  }

  /* ---------- Chapter 3: Soba Peaks ---------- */
  function faceStep(kind) {
    if (!G.clues.includes('statue') || G.pieces.includes(6) || G.statueStep >= 4) return;
    if (STATUE_FACES[G.statueStep] !== kind) return;
    G.statueStep++;
    Sound.blip(); setTimeout(() => Sound.blip(), 120);
    const names = { crunch: 'crunchy face 😋', thirsty: 'thirsty face 🥵', cool: 'cool face 😎', sleepy: 'sleepy face 😴' };
    UI.toast(`<span class="t-small">Faces ${G.statueStep}/4</span>Far away, a stone screen shows your ${names[kind]}`, { life: 3.2 });
    save();
  }

  function useStatue() {
    if (!G.clues.includes('statue')) {
      Sound.blip();
      return UI.say('note', [
        'A stone statue with a square head. It looks exactly like you, only very, very old.',
        'Its pedestal has four little dark screens. Each one shows a face: <em>crunchy, thirsty, cool, sleepy</em>.',
        'Carved underneath: <em>"SHOW ME YOUR FACES, IN THIS ORDER."</em>',
      ], { onDone: () => { solve('piece5'); addClue('statue'); save(); } });
    }
    if (G.pieces.includes(6)) return UI.say('me', 'The statue smiles at you. Its screen face looks a lot like yours.');
    if (G.statueStep === 3) {
      return UI.say('me', 'Three screens glow. Only the sleepy face is left. The snow looks soft next to the statue...', { choices: [
        { label: 'Sleep next to the statue', fn: sleepAtStatue },
        { label: 'Not yet', alt: true },
      ] });
    }
    const lit = G.statueStep;
    UI.say('me', lit ? `${lit} of the 4 screens glow. The next face is the ${['crunchy', 'thirsty', 'cool', 'sleepy'][lit]} one.` : 'Four dark screens. Crunchy, thirsty, cool, sleepy. None of them glow yet.');
  }
  function sleepAtStatue() {
    G.statueStep = 4;
    Sound.blip();
    newDay('You slept in the snow. Brrr!', { x: STATUE.x, y: STATUE.y + 70 });
    G.time = 6 * 60;
    setTimeout(statueOpens, 900);
  }
  function statueOpens() {
    G.pieces.push(6); solve('statue');
    Sound.secret(); P.wow = 2; shake = 16;
    burst(STATUE.x, STATUE.y - 60, 60, ['#9ff3ff', '#ffd23f', '#fff8e8'], { type: 'spark', speed: 340, grav: 150 });
    giveNoodle('smile');
    UI.say('me-wow', [
      'The morning sun hits the statue. All four screens light up, and then its big face screen turns on... and smiles at you!',
      'A little door slides open in the pedestal. Inside: <em>Map Piece 6</em>.',
      'It shows a dark cave, full of glowing noodles.',
    ], { onDone: () => { UI.toast('<span class="t-small">Chapter 3 complete</span>The Glass Noodle Caves are next…', { life: 4.8 }); save(); } });
  }

  function enterLake() {
    P.swimming = true; P.area = 'lake'; swim = null;
    P.x = LAKE.x + 50; P.y = LAKE.y + LAKE.h / 2;
    Sound.splash();
    burst(P.x, P.y, 30, ['#bfe9ff', '#ffffff'], { speed: 240, up: 200, size: 5, type: 'drop' });
    UI.toast('<span class="t-small">Brrr! 🧊</span>The mountain lake is icy cold.', { life: 2.4 });
    faceStep('cool');
  }
  function exitLake() {
    P.swimming = false; P.area = null;
    P.x = PEAKS.lakeEntry.x - 10; P.y = PEAKS.lakeEntry.y;
    Sound.splash();
  }

  function talkBird() {
    G.birdTalks++;
    if (!has('feather')) {
      return UI.say('bird', [
        'Tweet! A square visitor! We Soba Birds don\'t get many of those.',
        'Here, a present from our nest. We have too many anyway.',
      ], { onDone: () => giveNoodle('feather') });
    }
    const lines = [
      ['The old statue at the top? It stares at the sunrise every single morning. Tweet.'],
      ['On stormy afternoons, lightning loves that scorched rock near the summit. Something shiny sits there when it rains.'],
      ['The lake up here is freezing! Only very cool faces go swimming in it.'],
      ['Storms roll in every other day, in the afternoon. Tweet tweet.'],
    ];
    UI.say('bird', lines[G.birdTalks % lines.length]);
  }
  function useThunderRock() {
    if (stormy() && !has('thunder')) {
      shake = 12; stormFlash = 1; Sound.thunder();
      burst(TROCK.x, TROCK.y - 70, 30, ['#ffd23f', '#fff8e8'], { type: 'spark', speed: 280, grav: 150 });
      return giveNoodle('thunder');
    }
    UI.say('me', has('thunder') ? 'The scorched rock. You already caught the Thunder Udon here.' : 'A rock covered in burn marks. Lightning must really like this spot.');
  }

  function enterPool() {
    const lessonTime = G.lesson && G.lesson.id.startsWith('swim');
    if (!poolOpen() && !lessonTime) {
      Sound.wrong();
      UI.say('me', (G.time < POOL_OPEN ? 'The gate is locked. The sign says the Morning Pool opens at 6:00 AM.' : 'The Morning Pool is closed. It opens every day from 6 to 8 AM.') + ' (Coach Kombu can let you in for a swimming lesson.)');
      return;
    }
    P.swimming = true; P.area = 'pool'; P.x = GATE.x; P.y = POOL.y + 40;
    swim = { t: 25, score: 0, bubbles: [], spawn: 0, dawn: G.time < POOL_OPEN + 60 && !has('dawn') ? { x: POOL.x + 200, y: POOL.y + 120 } : null, done: false };
    Sound.splash();
    burst(P.x, P.y, 30, ['#8fe0ea', '#ffffff', '#5ed0e6'], { speed: 240, up: 200, size: 5, type: 'drop' });
    G.flags.swam = true;
    if (poolOpen() && G.time < 7 * 60) G.flags.early = true;
    if (G.buffDay !== G.day && poolOpen()) {
      G.buffDay = G.day; G.buffUntil = 24 * 60;
      UI.toast('<span class="t-small">Fresh Start 😎</span>Faster steps and bigger combos all day!', { life: 3.4 });
    }
  }
  function exitPool() {
    P.swimming = false; swim = null;
    P.x = GATE.x; P.y = GATE.y - 6;
    Sound.splash();
    burst(P.x, P.y - 20, 16, ['#8fe0ea', '#ffffff'], { speed: 180, size: 4, type: 'drop' });
  }
  function diveTile() {
    G.pieces.push(1); solve('pillow');
    Sound.secret(); P.wow = 1.6;
    burst(P.x, P.y, 40, ['#ffd23f', '#fff8e8', '#8fe0ea'], { type: 'spark', speed: 280, grav: 150 });
    UI.say('me-wow', [
      'You dive down to the glowing tile... it wiggles loose!',
      'Under it, wrapped in noodle-proof plastic: <em>Map Piece 1</em>.',
      'It shows a stream on the left, and a tree drawn... upside down?',
    ], { onDone: () => addClue('piece1') });
    save();
  }

  function useDoor() {
    if (G.flags.pillowReady && !G.clues.includes('pillow')) {
      Sound.blip();
      UI.say('note', [
        'Something is poking out from under your pillow. A note, in Grandma\'s curly handwriting:',
        `<em>"${CLUES.pillow.text.replace('\n', ' ')}"</em>`,
        'Below it, a tiny drawing of a noodle. It is colored gold.',
      ], { onDone: () => { addClue('pillow'); save(); } });
      return;
    }
    if (canSleep()) {
      const nap = !(hour() >= 18 || hour() < 5);
      UI.say('me', nap ? 'You need the morning! Take a nap and wake up just before the pool opens?' : 'Your bed looks very cozy. Sleep until morning?', { choices: [
        { label: nap ? 'Nap until 6 AM ☀' : 'Sleep until morning', fn: () => { const stuck = sameGoalT > 90; newDay('You slept like a noodle.'); if (stuck || Math.random() < 0.35) setTimeout(() => startDaydream('sleep'), 300); } },
        { label: 'Not yet', alt: true },
      ] });
    } else {
      UI.say('me', 'Home sweet home. It\'s too early for bed. The day is full of noodles!');
    }
  }

  // Some puzzles need the early morning; never make players wait 10 minutes for it.
  function needsMorning() {
    const c = (id) => G.clues.includes(id);
    return !poolOpen() && ((c('pillow') && !G.pieces.includes(1)) || (c('mirror') && !G.pieces.includes(5) && !has('dawn')));
  }
  const canSleep = () => hour() >= 18 || hour() < 5 || needsMorning();

  function talkGrandma() {
    dailyAdd('talk');
    if (!G.flags.metGrandma) {
      UI.say('grandma', [
        'Oh! You switched on! Good morning, little square one. I\'m Grandma Ramen.',
        'My old Noodle-dex is empty... Would you fill it up for me?',
        'Start by crunching the noodle bricks in Crunch Meadow, just south of here!',
      ], { onDone: () => { G.flags.metGrandma = true; addCoins(5); milestone(); save(); } });
      return;
    }
    const n = G.found.length;
    if (!G.flags.welcome2) {
      G.flags.welcome2 = true;
      return UI.say('grandma', ['Drink from the stream when your face gets hot, and never skip your morning swim.', 'And if you ever find a strange note... keep it. Some things are hidden on purpose. Hee hee.']);
    }
    if (G.clues.includes('cipher') && !G.flags.decoder) return UI.say('grandma', ['Noodle letters? My, I haven\'t seen those in years!', 'I used to hang the whole alphabet up somewhere. On the side of this stand, maybe? My memory is soft as udon.']);
    if (G.clues.includes('pillow') && !G.pieces.includes(1)) return UI.say('grandma', ['A note under your pillow? How mysterious.', 'I always say: the pool water is newest the moment the gate opens.']);
    if (G.pieces.includes(1) && !G.pieces.includes(2)) return UI.say('grandma', ['An upside-down tree? Well. Every willow I know hangs its noodles down.', 'If one ever grew them up... that would be a very special tree. Deep in the woods, I bet.']);
    if (n >= 10 && !G.flags.reward10) { G.flags.reward10 = true; addCoins(30); return UI.say('grandma', [`${n} noodles! You\'re a real collector now.`, 'Here, 30 Crunch Coins. Don\'t spend them all on hints!']); }
    if (n >= 5 && !G.flags.reward5) { G.flags.reward5 = true; addCoins(15); return UI.say('grandma', [`${n} noodles already! My heart is warm like broth.`, 'Take 15 Crunch Coins, for being a good little collector.']); }
    const tips = [
      'Crunch bricks quickly, one after another, for a combo. Five in a row is a MEGA CRUNCH!',
      'Some noodles only come out at night. The woods glow after 8 o\'clock.',
      'Swim a lot of bubbles in the pool and something bubbly might show up.',
      'Every day a Fortune Cracker appears somewhere. Pink and sparkly! Crunch it for a riddle.',
      'Too thirsty and you\'ll walk like a soggy noodle. The stream is always free.',
      'That old bowl south of here? The Noodle Oracle. It knows things... for a price.',
      'Shake the trees! Eggs, chilis, mushrooms... bring me food and I\'ll cook you something special.',
      'A Classic Ramen needs an egg, a scallion and a naruto swirl. Just saying.',
      'Grandma\'s shop is right here! Hats, rocket fuel... and I buy the food you pick.',
    ];
    UI.say('grandma', tips[(G.day + G.coins + n) % tips.length], { choices: [
      { label: '🍜 Cook something', fn: () => UI.cook(G, { canCook, cook, eat: eatFood }) },
      { label: '🛍️ Shop', fn: () => UI.shop(G, { buyHat, wearHat, buyGoodie, sellFood }) },
      { label: 'Bye, Grandma!', alt: true },
    ] });
  }

  function lookPoster() {
    if (G.clues.includes('cipher') && !G.flags.decoder) {
      G.flags.decoder = true; G.journalNew = true;
      Sound.secret(); P.wow = 1.4;
      UI.say('me-wow', ['An old poster of wiggly noodle shapes, with a letter under each one.', 'It\'s the <em>Noodle Alphabet</em>! You copy it into your journal.'], { onDone: () => { UI.toast('<span class="t-small">Journal updated</span>Noodle alphabet added. Decode the note!', { life: 3.4 }); save(); } });
      return;
    }
    UI.say('me', G.flags.decoder ? 'The Noodle Alphabet poster. You already copied it into your journal.' : 'An old poster covered in wiggly noodle shapes, with a letter under each one. Pretty. A bit strange.');
  }

  const HINT_COST = [0, 3, 6];
  function askOracle() {
    const open = ['pillow', 'piece1', 'cipher', 'canyon', 'piece3', 'piece4', 'mirror', 'piece5', 'statue'].find(id => G.clues.includes(id) && !G.solved.includes(id));
    if (!open) return UI.say('oracle', ['Bloop. I am the Noodle Oracle.', 'Nothing troubles you yet, little screen. Come back when you find something strange.']);
    const lvl = G.hints[open] || 0;
    const clue = CLUES[open];
    if (lvl >= 3) return UI.say('oracle', ['I have told you all I know about ' + clue.title + ':', clue.hints[2]]);
    const mercy = sameGoalT > 300;
    const cost = mercy ? 0 : HINT_COST[lvl];
    if (mercy) { G.hints[open] = 3; save(); return UI.say('oracle', ['Bloop... you have been stuck a long time. The Oracle feels sorry for you. This one is free:', clue.hints[2]]); }
    const prev = lvl ? ['Last time I said: ' + clue.hints[lvl - 1]] : [];
    UI.say('oracle', [...prev, `Bloop... "${clue.title}" troubles you. A ${['small nudge', 'bigger hint', 'full answer'][lvl]} costs ${cost ? cost + ' Crunch Coins' : 'nothing. The first one is free'}.`], { choices: [
      { label: cost ? `Pay ${cost} coins` : 'Yes please', fn: () => {
        if (G.coins < cost) { Sound.wrong(); return UI.say('oracle', `You have ${G.coins} coins. Crunch more bricks and come back.`); }
        G.coins -= cost; G.hints[open] = lvl + 1; Sound.coin(); save();
        UI.say('oracle', clue.hints[lvl]);
      } },
      { label: 'Not now', alt: true },
    ] });
  }

  function tryCipher(input) {
    const norm = (s) => s.toUpperCase().replace(/[^A-Z]/g, '');
    if (norm(input) !== norm(CLUES.cipher.answer)) { Sound.wrong(); return false; }
    solve('cipher'); addCoins(25);
    setTimeout(() => {
      giveNoodle('echo');
      UI.toast('<span class="t-small">Chapter 1 complete</span>A deep rumble comes from the south…', { life: 4.5 });
      addClue('canyon');
    }, 500);
    save();
    return true;
  }

  /* ---------- hints: story steps, where to go, and the guide arrow ---------- */
  function story() {
    const c = (id) => G.clues.includes(id), p = (n) => G.pieces.includes(n), n = G.found.length;
    const ch = (title, steps) => ({ title, steps });
    return [
      ch('Chapter 1 · The Pillow Note', [
        { text: 'Swim in the Morning Pool', where: 'The pool is just south of your house. It opens 6 to 8 AM.', done: !!G.flags.swam },
        { text: 'Say good morning to Grandma Ramen', where: 'Her noodle stand is north-east of your house, in Ramen Village.', done: !!G.flags.metGrandma },
        { text: 'Collect 3 noodles', where: 'Crunch the bricks in Crunch Meadow, south of the village.', done: n >= 3 },
        { text: 'Check your house', where: 'Your antenna twitches... something is waiting at home.', done: c('pillow') },
        { clue: 'pillow', text: 'Solve the Pillow Note riddle', where: 'Read it in your journal. Think about the early morning and water.', done: p(1) },
        { clue: 'piece1', text: 'Find the place on Map Piece 1', where: 'Cross the stream into Spaghetti Woods and look for a tree that breaks the rules.', done: p(2) },
        { clue: 'cipher', text: 'Learn to read the noodle letters', where: 'Grandma collects old signs. Look around her stand.', done: !!G.flags.decoder },
        { clue: 'cipher', text: 'Decode the note', where: 'Journal, Clues tab. Match each shape using the Noodle alphabet tab.', done: G.solved.includes('cipher') },
      ]),
      ch('Chapter 2 · Crunch Canyon', [
        { text: 'Break through the boulder wall', where: 'South of Crunch Meadow. It cracked when you decoded the note.', done: canyonOpen() },
        { clue: 'canyon', text: 'Find the echo that crunches twice', where: 'Crunch the tall rocks in the canyon and listen.', done: p(3) },
        { clue: 'piece3', text: 'Play the rhythm you heard', where: 'Something big you can hit, east across the canyon bridge.', done: p(4) },
        { clue: 'piece4', text: 'Drink where the water lies', where: 'Water that lies... like a mirror. Follow the stream.', done: c('mirror') },
        { clue: 'mirror', text: 'Read the reflection', where: 'It is backwards in your journal. Then find who it talks about in the canyon.', done: p(5) },
      ]),
      ch('Chapter 3 · Soba Peaks', [
        { clue: 'piece5', text: 'Climb the Soba Peaks', where: 'East, past Spaghetti Woods. Follow the road out of the woods and up the zigzag.', done: c('statue') },
        { clue: 'statue', text: 'Show the statue your faces', where: 'Crunchy, thirsty, cool, sleepy, in that order. Look at what makes your face change.', done: p(6) },
      ]),
      ch('Chapter 4 · The Glass Noodle Caves', [
        { text: 'Coming in the next update', where: 'Map Piece 6 shows a dark cave full of glowing noodles.', done: false, soon: true },
      ]),
    ];
  }
  // Where the yellow arrow points: the area to explore, not the exact answer.
  function goalTarget() {
    const c = (id) => G.clues.includes(id), p = (n) => G.pieces.includes(n);
    if (G.lesson) {
      const l = LESSONS.find(x => x.id === G.lesson.id);
      if (l.id.startsWith('swim') && l.id !== 'swim3') return { x: GATE.x, y: GATE.y, label: 'Pool' };
      if (l.id === 'swim3') return { x: 1280, y: 760, label: 'Bridge' };
      return { x: 1000, y: 1250, label: 'Meadow' };
    }
    if (hour() >= 21 || hour() < 5) return { ...DOOR, label: 'Home' };
    if (!G.flags.swam && G.day === 1 && G.time < POOL_CLOSE) return { ...GATE, label: 'Pool' };
    if (!G.flags.metGrandma) return { ...TALK, label: 'Grandma' };
    if (G.found.length < 3) return { x: 760, y: 1300, label: 'Meadow' };
    if (G.flags.pillowReady && !c('pillow')) return { ...DOOR, label: 'Home' };
    if (c('pillow') && !p(1)) return poolOpen() ? { ...GATE, label: 'Pool' } : { ...DOOR, label: 'Home (nap)' };
    if (p(1) && !p(2)) return { x: 2100, y: 450, label: 'Deep woods' };
    if (c('cipher') && !G.flags.decoder) return { ...TALK, label: "Grandma's stand" };
    if (G.flags.decoder && !G.solved.includes('cipher')) return null;
    if (G.solved.includes('cipher') && !canyonOpen()) return { x: CANYON.gate.x, y: CANYON.wallY - 40, label: 'Boulder wall' };
    if (canyonOpen() && !p(3)) return { x: 600, y: 2150, label: 'Canyon rocks' };
    if (p(3) && !p(4)) return { x: 1900, y: 2350, label: 'East canyon' };
    if (p(4) && !c('mirror')) return { x: 1250, y: 900, label: 'The stream' };
    if (c('mirror') && !p(5)) return has('dawn') ? { x: 800, y: 2380, label: 'Udon Snail' } : poolOpen() ? { ...GATE, label: 'Pool' } : { ...DOOR, label: 'Home (nap)' };
    if (p(5) && !c('statue')) return { x: STATUE.x, y: STATUE.y + 80, label: 'Summit' };
    if (c('statue') && !p(6)) return G.statueStep === 2 ? { ...PEAKS.lakeEntry, label: 'Lake' } : G.statueStep === 3 ? { x: STATUE.x, y: STATUE.y + 80, label: 'Statue' } : null;
    return null;
  }
  let guideOn = false, sameGoalT = 0, lastGoalKey = '', hintStep = 0, lastSecrets = [];
  // A hint that always matches what the goal pill is asking for right now.
  function hintFor(level) {
    if (G.lesson) { const l = LESSONS.find(x => x.id === G.lesson.id); return level === 0 ? l.desc : null; }
    if (hour() >= 21 || hour() < 5) return level === 0 ? 'Walk to your front door in Ramen Village and choose Sleep.' : null;
    for (const chap of story()) {
      const st = chap.steps.find(x => !x.done);
      if (!st) continue;
      if (st.soon) return null;
      if (st.clue && G.clues.includes(st.clue) && CLUES[st.clue].hints[level]) return CLUES[st.clue].hints[level];
      return level === 0 ? st.where : null;
    }
    return null;
  }

  function goalText() {
    const lt = lessonText(); if (lt) return lt;
    const n = G.found.length;
    if (hour() >= 21 || hour() < 5) return 'It\'s late. Go home and sleep (your door)';
    if (!G.flags.swam && G.day === 1 && G.time < POOL_CLOSE) return 'Swim in the Morning Pool before 8 AM';
    if (!G.flags.metGrandma) return 'Say good morning to Grandma Ramen at her noodle stand';
    if (n < 3) return `Collect 3 noodles (${n}/3). Crunch bricks in the meadow!`;
    if (G.flags.pillowReady && !G.clues.includes('pillow')) return 'Your antenna twitches… check your house';
    if (G.clues.includes('pillow') && !G.pieces.includes(1)) return poolOpen() ? 'Swim in the pool and follow the floor arrows' : 'The pool is closed. Nap at home to wake up at 6 AM';
    if (G.pieces.includes(1) && !G.pieces.includes(2)) return 'Find the place drawn on Map Piece 1';
    if (G.clues.includes('cipher') && !G.flags.decoder) return 'Find a way to read the noodle letters';
    if (G.flags.decoder && !G.solved.includes('cipher')) return 'Decode the noodle letters in your journal';
    if (G.solved.includes('cipher') && !canyonOpen()) return 'Something rumbled in the south. Check the boulder wall';
    if (canyonOpen() && !G.pieces.includes(3)) return 'Find the echo that crunches twice';
    if (G.pieces.includes(3) && !G.pieces.includes(4)) return 'Where could that rhythm be played?';
    if (G.pieces.includes(4) && !G.clues.includes('mirror')) return 'Drink where the water lies';
    if (G.clues.includes('mirror') && !G.pieces.includes(5)) return has('dawn') ? 'Ask the Udon Snail about its house (canyon)' : (poolOpen() ? 'Catch the Dawn Noodle in the pool (6–7 AM)' : 'Catch the Dawn Noodle: nap at home, swim at 6 AM');
    if (G.pieces.includes(5) && !G.clues.includes('statue')) return 'Climb to the top of the Soba Peaks (east)';
    if (G.clues.includes('statue') && !G.pieces.includes(6)) return `Show the statue your faces (${G.statueStep}/4)`;
    return `Chapter 3 done! Fill the Noodle-dex (${n}/${NOODLES.length})`;
  }

  /* ---------- update ---------- */
  /* ---------- space daydreams ---------- */
  const ROCKET_PAD = { x: 420, y: 1480 };
  let spaceBoost = false;
  function dreamLines() {
    for (const chap of story()) {
      const step = chap.steps.find(st => !st.done);
      if (!step) continue;
      if (step.soon) break;
      const tg = goalTarget();
      return [`Your next step: ${step.text}.`, step.where, tg ? `When you wake up, follow the yellow arrow toward: ${tg.label}.` : 'When you wake up, open your journal. The answer is waiting there.'];
    }
    const d = (G.daily && G.daily.list || []).map(c => c.title.toLowerCase()).join(', ');
    return [`Today's challenges: ${d || 'crunch, drink and explore'}.`, 'Shake the trees and cook with Grandma for special powers.', 'Race your friends, or fill the Team Pot together. The universe never ends!'];
  }
  function startDaydream(why) {
    drinkHeld = false; stick.active = false;
    Space.start({ seed: G.day * 31 + Math.floor(G.time), lines: dreamLines(), color: profile.color, onEnd: (r) => {
      if (r.coins) addCoins(r.coins);
      if (r.stars === 3) { guideOn = true; G.bonusStars = (G.bonusStars || 0) + 1; }
      const firstSuit = !G.flags.suit;
      G.flags.suit = true;
      Sound.rooster();
      UI.toast(`<span class="t-small">You wake up ${r.stars === 3 ? '· ⭐ +1' : ''}</span>${r.stars === 3 ? 'The Guide Stars showed you the way. Follow the yellow arrow!' : 'What a strange dream...'}`, { big: true, life: 4 });
      if (firstSuit) setTimeout(() => UI.toast('<span class="t-small">🧑‍🚀 Space suit unlocked</span>Wear it from the ⋯ menu. Everyone will see it!', { life: 4 }), 1800);
      $('suitBtn').hidden = false;
      save();
    } });
    Sound.secret();
  }
  function launchRocket() {
    if (G.launchDay === G.day) return UI.say('me', 'The rocket needs a whole day to refuel with broth. Come back tomorrow!');
    G.launchDay = G.day;
    shake = 12; Sound.thunder();
    burst(ROCKET_PAD.x, ROCKET_PAD.y - 20, 40, ['#ffd23f', '#e4572e', '#fff8e8'], { speed: 300, up: 260, size: 7, type: 'spark' });
    setTimeout(() => startDaydream('rocket'), 600);
  }

  /* ---------- world map ---------- */
  const CELL = 200, COLS = Math.ceil(WORLD.w / CELL), ROWS = Math.ceil(WORLD.h / CELL);
  let mapImg = null, mapT = 0;
  function buildMapImage() {
    mapImg = document.createElement('canvas'); mapImg.width = 900; mapImg.height = Math.round(900 * WORLD.h / WORLD.w);
    const m = mapImg.getContext('2d'), k = mapImg.width / WORLD.w;
    m.drawImage(ground, 0, 0, mapImg.width, mapImg.height);
    m.save(); m.scale(k, k);
    drawStream(m, 0, false);
    rr(m, POOL.x, POOL.y, POOL.w, POOL.h, 10); m.fillStyle = '#5ed0e6'; m.fill();
    rr(m, LAKE.x, LAKE.y, LAKE.w, LAKE.h, 50); m.fillStyle = '#8fd3ef'; m.fill();
    m.beginPath(); m.ellipse(SPRING.x, SPRING.y, SPRING.rx, SPRING.ry, 0, 0, Math.PI * 2); m.fillStyle = '#9ff0c8'; m.fill();
    m.fillStyle = '#b8693e'; m.fillRect(0, CANYON.wallY - 20, WORLD.w, 40);
    m.restore();
  }
  function markSeen() {
    if (!G.seen || G.seen.length !== COLS * ROWS) G.seen = '0'.repeat(COLS * ROWS);
    const cx = Math.floor(P.x / CELL), cy = Math.floor(P.y / CELL);
    let arr = null;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS || dx * dx + dy * dy > 5) continue;
      const i = y * COLS + x;
      if (G.seen[i] !== '1') { arr = arr || G.seen.split(''); arr[i] = '1'; }
    }
    if (arr) G.seen = arr.join('');
  }
  const seenAt = (x, y) => { const i = Math.floor(y / CELL) * COLS + Math.floor(x / CELL); return G.seen && G.seen[i] === '1'; };
  function mapLandmarks() {
    const L = [
      { x: H0.x + 120, y: H0.y + 110, icon: '🏠', label: 'Home' },
      { x: TALK.x, y: TALK.y - 60, icon: '🍜', label: 'Grandma' },
      { x: POOL.x + POOL.w / 2, y: POOL.y + POOL.h / 2, icon: '🏊', label: 'Morning Pool' },
      { x: 900, y: 850, icon: '🔮', label: 'Oracle' },
      { x: ROCKET_PAD.x, y: ROCKET_PAD.y - 20, icon: '🚀', label: 'Rocket' },
      { x: COACHES.penne.x, y: COACHES.penne.y - 20, icon: '🪽', label: 'Flight school' },
      { x: MIRROR.x, y: MIRROR.y, icon: '🪞', label: 'Mirror Pond' },
      { x: DRUM.x, y: DRUM.y - 30, icon: '🥁', label: 'Drum' },
      { x: SPRING.x, y: SPRING.y, icon: '🌿', label: 'Minty Spring' },
      { x: STATUE.x, y: STATUE.y - 40, icon: '🗿', label: 'Statue' },
      { x: LAKE.x + LAKE.w / 2, y: LAKE.y + LAKE.h / 2, icon: '🧊', label: 'Lake' },
      { x: NEST.x, y: NEST.y - 20, icon: '🐦', label: 'Soba Birds' },
    ];
    return L.filter(l => seenAt(l.x, l.y));
  }
  const H0 = PLACES.house;
  // Draws the map into any canvas. mini = the small corner map.
  function drawMap(c, W, H, mini) {
    const k = W / WORLD.w, t = now;
    c.clearRect(0, 0, W, H);
    c.drawImage(mapImg, 0, 0, W, H);
    // fog of war over places you have not explored yet
    const fog = document.createElement('canvas'); fog.width = W; fog.height = H;
    const f = fog.getContext('2d');
    f.fillStyle = '#e9dcc0'; f.fillRect(0, 0, W, H);
    f.strokeStyle = 'rgba(160,120,80,0.25)'; f.lineWidth = 1;
    for (let i = -H; i < W; i += 10) { f.beginPath(); f.moveTo(i, 0); f.lineTo(i + H, H); f.stroke(); }
    f.globalCompositeOperation = 'destination-out';
    const r = CELL * k * 1.25;
    for (let i = 0; i < (G.seen || '').length; i++) {
      if (G.seen[i] !== '1') continue;
      const x = ((i % COLS) + 0.5) * CELL * k, y = (Math.floor(i / COLS) + 0.5) * CELL * k;
      const g = f.createRadialGradient(x, y, r * 0.35, x, y, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = g; f.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.drawImage(fog, 0, 0);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (!mini) {
      // region names
      c.font = `${Math.max(12, W / 55)}px "Bagel Fat One", sans-serif`; c.fillStyle = 'rgba(52,35,63,0.55)';
      [['Ramen Village', 700, 250], ['Crunch Meadow', 780, 1450], ['Spaghetti Woods', 1960, 900], ['Crunch Canyon', 1300, 2350], ['Soba Peaks', 3100, 1200]].forEach(([n, x, y]) => { if (seenAt(x, y)) c.fillText(n, x * k, y * k); });
      c.font = `${Math.max(14, W / 45)}px sans-serif`;
      mapLandmarks().forEach(l => { c.fillText(l.icon, l.x * k, l.y * k); });
      if (!canyonOpen() && seenAt(CANYON.gate.x, CANYON.wallY - 100)) c.fillText('🔒', CANYON.gate.x * k, CANYON.wallY * k);
      if (G.pieces.includes(5) && seenAt(snail.x, snail.y)) c.fillText('🐌', snail.x * k, snail.y * k);
    }
    // goal and pin
    const tg = goalTarget();
    if (tg) { c.font = `${mini ? 12 : Math.max(16, W / 40)}px sans-serif`; c.fillText('⭐', tg.x * k, tg.y * k); if (!mini) { c.font = '800 12px "Baloo 2", sans-serif'; c.fillStyle = INK; c.fillText(tg.label, tg.x * k, tg.y * k + 16); } }
    if (G.pin) { c.font = `${mini ? 12 : Math.max(16, W / 40)}px sans-serif`; c.fillText('📍', G.pin.x * k, G.pin.y * k - 6); }
    // friends and you
    for (const o of Net.others.values()) {
      if (o.x === null) continue;
      circle(c, o.x * k, o.y * k, mini ? 3.5 : 6); fillStroke(c, o.color, 2);
      if (!mini) { c.font = '800 11px "Baloo 2", sans-serif'; c.fillStyle = INK; c.fillText(o.name, o.x * k, o.y * k - 12); }
    }
    const pr = (mini ? 4 : 7) + Math.sin(t * 5) * 1.5;
    c.fillStyle = 'rgba(255,255,255,0.6)'; circle(c, P.x * k, P.y * k, pr + 5); c.fill();
    circle(c, P.x * k, P.y * k, pr); fillStroke(c, profile.color || '#2fa4b5', 2.5);
    if (!mini) { c.font = '800 12px "Baloo 2", sans-serif'; c.fillStyle = INK; c.fillText('You', P.x * k, P.y * k + pr + 12); }
  }
  function openMap() {
    markSeen();
    UI.map({
      draw: (c, W, H) => drawMap(c, W, H, false),
      aspect: WORLD.h / WORLD.w,
      explored: Math.round(100 * ((G.seen || '').split('1').length - 1) / (COLS * ROWS)),
      pin: !!G.pin,
      tap: (fx, fy) => {
        const x = fx * WORLD.w, y = fy * WORLD.h;
        if (G.pin && dist(x, y, G.pin.x, G.pin.y) < 150) { G.pin = null; UI.toast('Pin removed.', { life: 1.8 }); }
        else { G.pin = { x, y }; UI.toast('<span class="t-small">📍 Pin placed</span>Follow the blue arrow to get there.', { life: 2.8 }); }
        save();
      },
      clearPin: () => { G.pin = null; save(); },
    });
  }

  function update(dt) {
    if (Care.tick(dt)) { keys.clear(); stick.active = false; drinkHeld = false; return; }
    if (Space.active) {
      let mx = 0, my = 0;
      if (keys.has('arrowleft') || keys.has('a')) mx -= 1;
      if (keys.has('arrowright') || keys.has('d')) mx += 1;
      if (keys.has('arrowup') || keys.has('w')) my -= 1;
      if (keys.has('arrowdown') || keys.has('s')) my += 1;
      if (stick.active) { mx += stick.dx; my += stick.dy; }
      const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
      Space.update(dt, mx, my, spaceBoost || keys.has(' '));
      $('actionLabel').textContent = 'BOOST'; $('action').hidden = false; $('flyBtn').hidden = true;
      $('hud').hidden = Space.active;
      return;
    }
    $('hud').hidden = false;
    const busy = UI.busy;
    if (!busy) {
      G.time += dt * (P.swimming ? 0.5 : 1);
      if (G.time >= 24 * 60) {
        UI.say('me', 'Zzz… You fell asleep under the stars.', { onDone: () => newDay('You woke up outside. Oops!') });
        G.time = 24 * 60 - 0.01;
      }
    }

    // movement input
    let mx = 0, my = 0;
    if (!busy) {
      if (keys.has('arrowleft') || keys.has('a')) mx -= 1;
      if (keys.has('arrowright') || keys.has('d')) mx += 1;
      if (keys.has('arrowup') || keys.has('w')) my -= 1;
      if (keys.has('arrowdown') || keys.has('s')) my += 1;
      if (stick.active) { mx += stick.dx; my += stick.dy; }
    }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    let speed = P.swimming ? 170 : 210;
    if (G.water < 25) speed *= 0.8;
    if (buffed()) speed *= 1.2;
    if (minty()) speed *= 1.2;
    if (dishOn('spicy')) speed *= 1.25;
    if (G.water < 25) faceStep('thirsty');
    if (!busy) { lessonTick(dt); challengeTick(dt); masteryTick(dt); if (P.swimming) dailyAdd('swim', dt); }
    if (P.swimming && P.area === 'lake' && !has('ice') && dist(P.x, P.y, LAKE.x + LAKE.w * 0.62 + Math.sin(now) * 40, LAKE.y + LAKE.h * 0.55) < 34) giveNoodle('ice');
    stormFlash = Math.max(0, stormFlash - dt * 3);
    if (stormy() && inPeaks(P.x) && !busy) {
      if (stormWarnDay !== G.day) { stormWarnDay = G.day; UI.toast('<span class="t-small">Storm ⛈</span>Dark clouds roll over the peaks!', { life: 3 }); }
      if (Math.random() < dt * 0.12) { stormFlash = 1; setTimeout(() => Sound.thunder(), 300); }
    }
    if (drinkHeld) speed = 0;
    if (P.area === 'open') { const sl = skillLevel('swim'); speed = 120 + Math.min(sl, 3) * 20 + Math.max(0, sl - 3) * 6; }
    P.moving = len > 0.15 && speed > 0;
    if (!busy) physics(dt);
    if (P.moving) {
      const nx = P.x + mx * speed * dt, ny = P.y + my * speed * dt;
      if (P.swimming && P.area !== 'open') {
        const A = P.area === 'lake' ? LAKE : POOL;
        P.x = clamp(nx, A.x + 26, A.x + A.w - 26);
        P.y = clamp(ny, A.y + 30, A.y + A.h - 12);
      } else {
        const tryMove = (tx, ty) => {
          if (blocked(tx, ty, P.z, false)) return false;
          const wet = P.z < 12 && isWater(tx, ty);
          if (wet && P.area !== 'open') {
            if (G.skills.swim < 1) { waterHint(); return false; }
            startOpenSwim();
          } else if (!wet && P.area === 'open') stopOpenSwim();
          return true;
        };
        if (tryMove(nx, P.y)) P.x = nx;
        if (tryMove(P.x, ny)) P.y = ny;
      }
      P.walk += dt * (P.swimming ? 4 : 7);
      if (mx) P.face = clamp(P.face + Math.sign(mx) * dt * 8, -1, 1);
      if (!P.swimming && Math.floor(P.walk / Math.PI) !== Math.floor((P.walk - dt * 7) / Math.PI)) Sound.step();
    } else P.face *= 0.9;

    // hydration
    if (!busy) {
      if (!P.swimming) G.water -= dt * (P.moving ? 0.35 : 0.12);
      if (drinkHeld) {
        G.water += dt * 45;
        drinkSound -= dt;
        if (drinkSound <= 0) { Sound.gulp(); drinkSound = 0.42; burst(P.x + (P.face >= 0 ? 30 : -30), P.y - 6, 4, ['#8fe0ea', '#ffffff'], { speed: 80, up: 120, size: 4, type: 'drop', life: 0.5 }); }
        if (G.water >= 100 && drinkWhere !== 'mirror') { drinkHeld = false; floatText(P.x, P.y - 90, 'Ahh!', '#8fe0ea'); }
      }
      G.water = clamp(G.water, 0, 100);
      if (G.water < 25 && !thirstWarned) { thirstWarned = true; UI.toast(`<span class="t-small">Thirsty 🥵</span>${nearestWater()}`, { life: 3.4 }); }
      if (G.water > 50) thirstWarned = false;
      if (hour() >= 21 && !nightWarned) { nightWarned = true; UI.toast('<span class="t-small">Getting sleepy 😴</span>Head home and sleep, or you\'ll nap outside.', { life: 3.2 }); }
    }

    // swim minigame
    if (swim && !busy) {
      if (!swim.done) {
        swim.t -= dt;
        swim.spawn -= dt;
        if (swim.spawn <= 0) {
          swim.spawn = 0.45;
          swim.bubbles.push({ x: POOL.x + 30 + Math.random() * (POOL.w - 60), y: POOL.y + 30 + Math.random() * (POOL.h - 50), life: 3.2, r: 9 + Math.random() * 6 });
        }
        if (swim.t <= 0) {
          swim.done = true; swim.bubbles = [];
          UI.toast(`<span class="t-small">Swim over</span>You caught ${swim.score} bubbles!`, { life: 2.6 });
          if (swim.score >= 12) giveNoodle('bubble'); else if (!has('bubble')) setTimeout(() => UI.toast('Catch 12 or more for a surprise…', { life: 2.4 }), 900);
        }
      }
      swim.bubbles.forEach(b => { b.life -= dt; b.y -= dt * 8; });
      swim.bubbles = swim.bubbles.filter(b => {
        if (b.life <= 0) return false;
        if (dist(P.x, P.y - 10, b.x, b.y) < b.r + 22) { swim.score++; Sound.pop(); burst(b.x, b.y, 6, ['#ffffff', '#8fe0ea'], { speed: 120, size: 3, type: 'drop', life: 0.4, grav: 0 }); return false; }
        return true;
      });
      if (swim.dawn) {
        swim.dawn.x = POOL.x + 180 + Math.sin(now * 0.8) * 130;
        swim.dawn.y = POOL.y + 150 + Math.cos(now * 1.1) * 40;
        if (dist(P.x, P.y, swim.dawn.x, swim.dawn.y) < 36) { swim.dawn = null; giveNoodle('dawn'); }
        else if (G.time >= POOL_OPEN + 60) swim.dawn = null;
      }
    }

    // stop drinking if walked away
    if (drinkHeld) {
      const still = drinkWhere === 'lake' ? dist(P.x, P.y, LAKE.x + LAKE.w / 2, LAKE.y - 26) < 90 : drinkWhere === 'spring' ? inSpring(P.x, P.y, 50) : drinkWhere === 'mirror' ? inPond(P.x, P.y, 50) : streamDist(P.x, P.y) < STREAM.width / 2 + 40;
      if (P.swimming || !still) drinkHeld = false;
    }
    if (drinkHeld && drinkWhere === 'mirror' && !busy) {
      mirrorTimer += dt;
      if (mirrorTimer > 1.4 && G.pieces.includes(4) && !G.clues.includes('mirror')) {
        drinkHeld = false;
        solve('piece4');
        Sound.secret(); P.wow = 1.6;
        giveNoodle('vermicelli');
        UI.say('me-wow', [
          'You lean over the water to drink... and the reflection shows <em>words</em>!',
          'There are no words anywhere around you. Only in the water. And they look... backwards?',
        ], { onDone: () => { addClue('mirror'); save(); } });
      }
    } else if (!drinkHeld) mirrorTimer = Math.max(0, mirrorTimer - dt * 2);
    drumHit = Math.max(0, drumHit - dt * 4);
    rockShimmer = rockShimmer.map(v => Math.max(0, (v || 0) - dt));
    if (snail.moved > 0 && snail.moved < 90) snail.moved += dt * 30;
    if (G.pieces.includes(5)) {
      // on its week-long walk to the mountains
      const [sx, sy] = snailTripPos();
      snail.dir = sx > snail.x + 0.01 ? 1 : sx < snail.x - 0.01 ? -1 : snail.dir;
      snail.x = sx; snail.y = sy;
    } else {
      const nx = CANYON.snail.x + snail.moved + Math.sin(now * 0.12) * 50;
      snail.dir = nx > snail.x ? 1 : nx < snail.x ? -1 : snail.dir;
      snail.x = nx; snail.y = CANYON.snail.y;
    }

    // antenna: sense secrets
    const secrets = [];
    if (G.flags.pillowReady && !G.clues.includes('pillow')) secrets.push(DOOR);
    if (G.clues.includes('pillow') && !G.pieces.includes(1) && poolOpen()) secrets.push(LAST_TILE);
    if (G.pieces.includes(1) && !G.pieces.includes(2)) secrets.push(GOLD_BRICK);
    if (G.clues.includes('cipher') && !G.flags.decoder) secrets.push(POSTER);
    if (G.solved.includes('cipher') && !canyonOpen()) secrets.push({ x: CANYON.gate.x, y: CANYON.wallY });
    if (canyonOpen() && G.clues.includes('canyon') && !G.pieces.includes(3)) { const [rx, ry] = CANYON.rocks[CANYON.trueRock]; secrets.push({ x: rx, y: ry }); }
    if (G.pieces.includes(3) && !G.pieces.includes(4)) secrets.push(DRUM);
    if (G.pieces.includes(4) && !G.clues.includes('mirror')) secrets.push(MIRROR);
    if (G.clues.includes('mirror') && !G.pieces.includes(5)) secrets.push(snail);
    if (G.pieces.includes(5) && !G.clues.includes('statue')) secrets.push(STATUE);
    if (G.statueStep === 2 && !G.pieces.includes(6)) secrets.push(PEAKS.lakeEntry);
    if (G.statueStep === 3 && !G.pieces.includes(6)) secrets.push(STATUE);
    if (stormy() && !has('thunder') && fogGone()) secrets.push(TROCK);
    if (G.fortune && G.fortune.crunched && !G.fortune.done) secrets.push(FORTUNES[G.fortune.idx].where);
    glassNoodles().forEach(g => !has('glass') && secrets.push(g));
    lastSecrets = secrets;
    let near = 1e9;
    secrets.forEach(s => near = Math.min(near, dist(P.x, P.y, s.x, s.y)));
    const range = dishOn('forest') ? 1040 : 520;
    P.antennaPulse = near < range ? 1 - near / range : 0;
    if (P.antennaPulse > 0 && !busy) {
      beepTimer -= dt;
      if (beepTimer <= 0) { Sound.beep(P.antennaPulse); beepTimer = 1.3 - P.antennaPulse * 1.1; }
    }

    // mood
    P.crunching = Math.max(0, P.crunching - dt);
    P.wow = Math.max(0, P.wow - dt);
    blinkT -= dt; if (blinkT < -0.14) blinkT = 2 + Math.random() * 3;
    const h = hour();
    P.mood = P.crunching > 0 ? 'crunch'
      : P.wow > 0 ? 'wow'
      : P.swimming ? (buffed() ? 'cool' : 'swim')
      : G.water < 25 ? 'thirsty'
      : (h >= 21 || h < 5) ? 'sleepy'
      : P.antennaPulse > 0.6 ? 'think'
      : blinkT < 0 ? 'blink'
      : buffed() && h < 12 ? 'cool'
      : 'happy';

    // particles
    particles.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.vx *= 0.98; p.rot += dt * 6; });
    particles = particles.filter(p => p.life > 0);
    if (P.mood === 'sleepy' && Math.random() < dt * 0.8) particles.push({ x: P.x + 20, y: P.y - 90, vx: 20, vy: -30, life: 1.6, max: 1.6, text: 'z', color: '#fff8e8', type: 'text', grav: 0 });
    shake = Math.max(0, shake - dt * 40);

    // interaction + HUD
    current = findInteraction();
    const btn = $('action');
    if (current) {
      if ($('actionLabel').textContent !== current.label || btn.hidden) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
      $('actionLabel').textContent = current.label;
      btn.className = btn.className.replace(/\b(water|talk|swim|look|idle)\b/g, '').trim();
      if (current.cls) btn.classList.add(current.cls);
      btn.hidden = false;
    } else if (!isTouch) btn.hidden = true;
    else { $('actionLabel').textContent = '·'; btn.className = 'idle'; btn.hidden = false; }

    UI.hud(G);
    $('starCount').textContent = starTotal();
    const chips = [];
    if (buffed()) chips.push('😎 Fresh Start'); if (minty()) chips.push('🌿 Minty');
    [['spicy', '🌶️ Spicy'], ['forest', '🍄 Forest sense'], ['sea', '🌊 Sea legs'], ['dumpling', '🥟 Long combos']].forEach(([id, label]) => dishOn(id) && chips.push(label));
    $('buff').hidden = !chips.length; $('buff').textContent = chips.join('  ·  ');
    if (isTouch) {
      const fb = $('flyBtn');
      fb.hidden = P.swimming || UI.busy;
      $('flyLabel').textContent = G.skills.fly >= 1 ? 'FLY' : 'HOP';
    }
    P.suit = !!(G.flags.suit && G.flags.wearSuit);
    P.hat = G.hat; P.goldAntenna = !!G.flags.goldAntenna;
    if ((G.flags.trail || G.flags.rainbow) && P.moving && Math.random() < dt * 14) {
      const cols = G.flags.rainbow ? ['#e4572e', '#ffd23f', '#8cbf5a', '#2fa4b5', '#b98cff'] : ['#ffd23f', '#fff1a8'];
      particles.push({ x: P.x + (Math.random() - 0.5) * 20, y: P.y - 6 - (P.z || 0), vx: 0, vy: -20, life: 0.7, max: 0.7, color: cols[Math.floor(Math.random() * cols.length)], size: 5, type: 'spark', grav: 0, rot: 0 });
    }
    const gt = goalText();
    UI.goal(gt);
    if (gt !== lastGoalKey) { lastGoalKey = gt; sameGoalT = 0; hintStep = 0; guideOn = false; UI.goalHint(''); } else if (!busy && !Space.active) sameGoalT += dt;
    // Hint ladder: the longer you are stuck on one goal, the more help you get.
    if (hintStep < 1 && sameGoalT > 45) { hintStep = 1; const h = hintFor(0); if (h) { P.wow = 0; UI.toast(`<span class="t-small">🤔 Squareface thinks…</span>${h}`, { life: 5 }); } }
    if (hintStep < 2 && sameGoalT > 90) { hintStep = 2; const h = hintFor(1); if (h) UI.goalHint(h); }
    if (hintStep < 3 && sameGoalT > 150) { hintStep = 3; if (goalTarget()) { guideOn = true; UI.toast('<span class="t-small">Need a hand? 🧭</span>Follow the yellow arrow. Tap the goal to hide it.', { life: 3.6 }); } }
    if (hintStep < 4 && sameGoalT > 240) hintStep = 4;

    // camera
    const viewW = vw / zoom, viewH = vh / zoom;
    const tx = clamp(P.x - viewW / 2, 0, Math.max(0, WORLD.w - viewW));
    const ty = clamp(P.y - 40 - viewH / 2, 0, Math.max(0, WORLD.h - viewH));
    cam.x += (tx - cam.x) * Math.min(1, dt * 6);
    cam.y += (ty - cam.y) * Math.min(1, dt * 6);

    saveTimer -= dt; if (saveTimer <= 0) { saveTimer = 5; save(); }

    // multiplayer: send my position, smooth everyone else's
    if (Net.active) {
      Net.state(P);
      Net.score(G.found.length, G.coins, starTotal());
      for (const o of Net.others.values()) {
        if (o.x === null || o.tx === undefined) continue;
        const k = Math.min(1, dt * 10);
        o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.z = (o.z || 0) + ((o.tz || 0) - (o.z || 0)) * k;
        if (o.mv) o.walk = (o.walk || 0) + dt * 7;
      }
    }
    for (const [id, e] of emotes) if (e.until < now) emotes.delete(id);
    if (roundEnd && Net.active) updateRoomPill();
    boardT -= dt; if (boardT <= 0) { boardT = 30; postScore(); }
    mapT -= dt;
    if (mapT <= 0) {
      mapT = 0.3; markSeen();
      const mm = $('minimap');
      if (mm && mm.offsetParent && mapImg) { const mc = mm.getContext('2d'); mc.setTransform(1, 0, 0, 1, 0, 0); drawMap(mc, mm.width, mm.height, true); }
    }
    if (G.pin && dist(P.x, P.y, G.pin.x, G.pin.y) < 90) { G.pin = null; Sound.coin(); UI.toast('📍 You reached your pin!', { life: 2 }); }
    cloudT -= dt; if (cloudT <= 0) { cloudT = 60; cloudSave(); }
  }

  /* ---------- render ---------- */
  function lightLevel() {
    const h = hour();
    if (h < 5) return { dark: 0.6, tint: null };
    if (h < 6) return { dark: 0.6 - (h - 5) * 0.45, tint: [255, 150, 120, 0.18] };
    if (h < 8) return { dark: 0.15 * (1 - (h - 6) / 2), tint: [255, 170, 130, 0.14 * (1 - (h - 6) / 2)] };
    if (h < 17) return { dark: 0, tint: null };
    if (h < 19) return { dark: 0, tint: [255, 150, 60, 0.16 * (h - 17) / 2] };
    if (h < 21) return { dark: 0.12 + 0.43 * (h - 19) / 2, tint: [255, 130, 80, 0.16 * (1 - (h - 19) / 2)] };
    return { dark: 0.6, tint: null };
  }

  const lightCanvas = document.createElement('canvas');
  const lctx = lightCanvas.getContext('2d');

  function render() {
    if (Space.active) { Space.render(ctx, vw, vh, dpr); return; }
    const t = now;
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#6fa54a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const k = dpr * zoom;
    ctx.setTransform(k, 0, 0, k, (-cam.x + sx) * k, (-cam.y + sy) * k);
    const viewW = vw / zoom, viewH = vh / zoom;
    const vx0 = cam.x - 150, vy0 = cam.y - 200, vx1 = cam.x + viewW + 150, vy1 = cam.y + viewH + 200;
    const inView = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;

    // ground
    const gx = clamp(Math.floor(cam.x) - 20, 0, WORLD.w), gy = clamp(Math.floor(cam.y) - 20, 0, WORLD.h);
    const gw = Math.min(WORLD.w - gx, Math.ceil(viewW) + 40), gh = Math.min(WORLD.h - gy, Math.ceil(viewH) + 40);
    if (gw > 0 && gh > 0) ctx.drawImage(ground, gx, gy, gw, gh, gx, gy, gw, gh);

    // cloud shadows
    ctx.fillStyle = 'rgba(52,35,63,0.06)';
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 537 + t * 14) % (WORLD.w + 600)) - 300, cy = (i * 331) % WORLD.h;
      if (!inView(cx, cy)) continue;
      ctx.beginPath(); ctx.ellipse(cx, cy, 180, 70, 0, 0, Math.PI * 2); ctx.ellipse(cx + 110, cy + 20, 120, 55, 0, 0, Math.PI * 2); ctx.fill();
    }

    const dawn = G.time >= POOL_OPEN && G.time < POOL_CLOSE;
    drawStream(ctx, t, dawn);
    if (inView(SPRING.x, SPRING.y)) drawSpring(ctx, SPRING, t);
    if (inView(LAKE.x + LAKE.w / 2, LAKE.y + LAKE.h / 2)) {
      drawLake(ctx, LAKE, t);
      if (!has('ice')) {
        const ix = LAKE.x + LAKE.w * 0.62 + Math.sin(t) * 40, iy = LAKE.y + LAKE.h * 0.55;
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; circle(ctx, ix, iy, 20 + Math.sin(t * 3) * 3); ctx.fill();
        rr(ctx, ix - 12, iy - 12, 24, 24, 5); fillStroke(ctx, 'rgba(191,233,255,0.9)', 2.5);
      }
    }
    if (drinkHeld && drinkWhere === 'mirror') drawReflection(ctx, t, Math.min(1, mirrorTimer / 1.2), G.pieces.includes(4));
    drawPool(ctx, POOL, t, { soon: G.time >= POOL_OPEN - 10 && G.time < POOL_OPEN ? Math.ceil(POOL_OPEN - G.time) : 0, open: poolOpen(), dawn, showArrows: dawn, lastTile: G.clues.includes('pillow') && !G.pieces.includes(1) });

    // pool bubbles and dawn noodle
    if (swim) {
      swim.bubbles.forEach(b => {
        ctx.globalAlpha = Math.min(1, b.life);
        circle(ctx, b.x, b.y, b.r); fillStroke(ctx, 'rgba(255,255,255,0.55)', 2.5, '#ffffff');
        ctx.fillStyle = '#fff'; circle(ctx, b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25); ctx.fill();
        ctx.globalAlpha = 1;
      });
      if (swim.dawn) {
        const d = swim.dawn;
        ctx.fillStyle = 'rgba(255,179,138,0.5)'; circle(ctx, d.x, d.y, 26 + Math.sin(t * 4) * 4); ctx.fill();
        noodleStroke(ctx, () => { ctx.beginPath(); for (let x = -16; x <= 16; x += 2) ctx.lineTo(d.x + x, d.y + Math.sin(x * 0.35 + t * 5) * 4); }, '#ffb38a', 5);
      }
    }

    // depth-sorted objects
    const night = isNight() || hour() >= 19;
    const draw = [];
    TREES.forEach(([x, y, kind], i) => inView(x, y) && draw.push({ y, fn: () => drawTree(ctx, x, y, t, kind, fruitLeft(i), Math.max(0, (treeShake.get(i) || 0) - now)) }));
    const wb = PLACES.willowBack;
    if (inView(wb.x, wb.y)) draw.push({ y: wb.y, fn: () => drawWillow(ctx, wb.x, wb.y, t, true, G.pieces.includes(1) ? 1 : 0.3) });
    bricks().forEach(b => inView(b.x, b.y) && draw.push({ y: b.y, fn: () => drawBrick(ctx, b, t, current && current.label === 'CRUNCH' && dist(current.x, current.y, b.x, b.y) < 1) }));
    glassNoodles().forEach(g => inView(g.x, g.y) && draw.push({ y: g.y, fn: () => {
      ctx.fillStyle = 'rgba(201,243,255,0.35)'; circle(ctx, g.x, g.y - 10, 22 + Math.sin(t * 3 + g.i) * 4); ctx.fill();
      ctx.globalAlpha = 0.85;
      noodleStroke(ctx, () => { ctx.beginPath(); for (let x = -14; x <= 14; x += 2) ctx.lineTo(g.x + x, g.y - 10 + Math.sin(x * 0.4 + t * 3) * 4); }, '#c9f3ff', 4);
      ctx.globalAlpha = 1;
    } }));
    CANYON.rocks.forEach(([rx, ry], i) => inView(rx, ry) && draw.push({ y: ry, fn: () => drawEchoRock(ctx, rx, ry, t, Math.min(1, rockShimmer[i] || 0)) }));
    if (inView(DRUM.x, DRUM.y)) draw.push({ y: DRUM.y, fn: () => drawDrum(ctx, DRUM.x, DRUM.y, t, drumHit, G.pieces.includes(4)) });
    if (inView(snail.x, snail.y)) draw.push({ y: snail.y, fn: () => drawSnail(ctx, snail.x, snail.y, t, snail.dir) });
    if (inView(CANYON.gate.x, CANYON.wallY) || inView(P.x, CANYON.wallY)) draw.push({ y: CANYON.wallY + 14, fn: () => drawCanyonWall(ctx, t, canyonOpen() ? 0 : G.gateHp, G.solved.includes('cipher')) });
    PEAKS.pines.forEach(([px, py]) => inView(px, py) && draw.push({ y: py, fn: () => drawPine(ctx, px, py, t, py < PEAKS.snowLine + 100) }));
    if (inView(STATUE.x, STATUE.y)) draw.push({ y: STATUE.y, fn: () => drawStatue(ctx, STATUE.x, STATUE.y, t, G.pieces.includes(6) ? 4 : G.statueStep, G.pieces.includes(6)) });
    if (inView(NEST.x, NEST.y)) draw.push({ y: NEST.y, fn: () => drawNest(ctx, NEST.x, NEST.y, t) });
    if (inView(TROCK.x, TROCK.y)) draw.push({ y: TROCK.y, fn: () => drawThunderRock(ctx, TROCK.x, TROCK.y, t, stormy(), !has('thunder')) });
    if (inView(PEAKS.left, P.y) || inView(PEAKS.left, CANYON.wallY + 200)) draw.push({ y: WORLD.h, fn: () => {
      drawRidge(ctx, CANYON.wallY + 30, WORLD.h);
      if (!fogGone()) drawFog(ctx, t, 0, CANYON.wallY);
    } });
    Object.entries(COACHES).forEach(([key, c]) => inView(c.x, c.y) && draw.push({ y: c.y, fn: () => key === 'kombu' ? drawKombu(ctx, c.x, c.y, t) : drawPenne(ctx, c.x, c.y, t) }));
    if (inView(ROCKET_PAD.x, ROCKET_PAD.y)) draw.push({ y: ROCKET_PAD.y, fn: () => {
      ctx.fillStyle = 'rgba(52,35,63,0.2)'; ctx.beginPath(); ctx.ellipse(ROCKET_PAD.x, ROCKET_PAD.y + 4, 50, 14, 0, 0, Math.PI * 2); ctx.fill();
      rr(ctx, ROCKET_PAD.x - 44, ROCKET_PAD.y - 12, 88, 18, 8); fillStroke(ctx, '#a9a39a', 3);
      ctx.save(); ctx.translate(ROCKET_PAD.x, ROCKET_PAD.y - 52); ctx.scale(1.3, 1.3);
      Space.drawRocket(ctx, 0, 0, 0, t, G.launchDay === G.day ? 0 : 0, profile.color); ctx.restore();
      if (G.launchDay !== G.day) { ctx.font = '800 12px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#34233f'; ctx.fillText('READY', ROCKET_PAD.x, ROCKET_PAD.y + 1); }
    } });
    SIGNPOSTS.forEach(([sx, sy, signs]) => inView(sx, sy) && draw.push({ y: sy, fn: () => drawSignpost(ctx, sx, sy, signs) }));
    const H = PLACES.house, S = PLACES.shop;
    draw.push({ y: H.y + 170, fn: () => drawHouse(ctx, H, t, night) });
    draw.push({ y: S.y + 150, fn: () => drawShop(ctx, S, t, night) });
    draw.push({ y: 858, fn: () => drawOracle(ctx, 900, 858, t, 1, !!current && current.label === 'ASK') });
    draw.push({ y: P.y + (P.swimming ? 1000 : 0) + (P.z > 40 ? 3000 : 0), fn: () => {
      drawPlayer(ctx, P, t);
      const me = emotes.get('me');
      if (Net.active || me) drawTag(ctx, P.x, P.y - (P.swimming ? 60 : 108) - (P.z || 0), Net.active ? (profile.name || 'You') : 'You', profile.color || '#2fa4b5', me && me.e);
    } });
    for (const [id, o] of Net.others) {
      if (o.x === null || !inView(o.x, o.y)) continue;
      draw.push({ y: o.y + (o.sw ? 1000 : 0) + ((o.z || 0) > 40 ? 3000 : 0), fn: () => {
        const ghost = { hat: o.h, goldAntenna: o.ga, suit: o.su, x: o.x, y: o.y, z: o.z || 0, moving: o.mv, walk: o.walk || 0, face: o.f || 0, mood: o.mood || 'happy', crunching: 0, antennaPulse: 0, swimming: o.sw, color: o.color, wings: (o.z || 0) > 2 };
        drawPlayer(ctx, ghost, t);
        const e = emotes.get(id);
        drawTag(ctx, o.x, o.y - (o.sw ? 60 : 108) - (o.z || 0), o.a ? o.name + ' 💤' : o.name, o.color, e ? e.e : o.a ? '🍽️' : null);
      } });
    }
    draw.sort((a, b) => a.y - b.y).forEach(d => d.fn());

    if (hintStep >= 4) lastSecrets.forEach(sc => {
      if (!inView(sc.x, sc.y)) return;
      for (let i = 0; i < 5; i++) { const a = t * 2 + i * 1.26, r = 30 + Math.sin(t * 3 + i) * 8; ctx.fillStyle = `rgba(255,236,140,${0.6 + Math.sin(t * 6 + i) * 0.4})`; circle(ctx, sc.x + Math.cos(a) * r, sc.y - 30 + Math.sin(a) * r * 0.6, 4); ctx.fill(); }
    });
    // guide arrow toward the current goal
    if (guideOn) {
      const tg = goalTarget();
      if (tg && dist(P.x, P.y, tg.x, tg.y) > 90) drawGuideArrow(ctx, P.x, P.y - 20 - (P.z || 0), Math.atan2(tg.y - P.y, tg.x - P.x), t, tg.label);
    }
    if (G.pin) drawGuideArrow(ctx, P.x, P.y - 20 - (P.z || 0), Math.atan2(G.pin.y - P.y, G.pin.x - P.x), t + 1, 'Pin', '#8fd3ef');
    // the sky layer: flight rings, the cloud, and stamina meters
    if (G.lesson && G.lesson.id === 'fly2') RINGS.forEach(([rx, ry], i) => inView(rx, ry) && drawRing(ctx, rx, ry, RING_Z, t, G.lesson.rings[i]));
    if (inView(SKY_CLOUD.x, SKY_CLOUD.y - SKY_CLOUD.z)) drawSkyCloud(ctx, { ...SKY_CLOUD, alpha: P.z > 60 ? 1 : 0.55 }, t, !has('sky'));
    if (P.z > 2 && P.wings) drawMeter(ctx, P.x + 34, P.y - 70 - P.z, P.wing / wingMax(skillLevel('fly')), '#f7dc7a');
    if (P.area === 'open' && isFinite(P.stamina)) drawMeter(ctx, P.x + 34, P.y - 40, P.stamina / PHYS.swimStamina[G.skills.swim], '#8fe0ea');

    // particles
    particles.forEach(p => {
      const a = Math.min(1, p.life / p.max * 1.5);
      ctx.globalAlpha = a;
      if (p.type === 'text') {
        ctx.font = p.text === 'z' ? '800 20px "Baloo 2", sans-serif' : '22px "Bagel Fat One", sans-serif';
        ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.fillStyle = p.color;
        ctx.strokeText(p.text, p.x, p.y); ctx.fillText(p.text, p.x, p.y);
      } else if (p.type === 'spark') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
      } else if (p.type === 'drop') {
        ctx.fillStyle = p.color; circle(ctx, p.x, p.y, p.size / 2); ctx.fill();
      } else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        rr(ctx, -p.size / 2, -p.size / 3, p.size, p.size * 0.66, 2); fillStroke(ctx, p.color, 1.5);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    });

    // interaction marker
    if (current && current.d !== 999 && current.label !== 'DRINK') {
      const bob = Math.sin(t * 6) * 4;
      const my = current.y - (current.label === 'TALK' ? 150 : current.label === 'CRUNCH' ? 58 : 70) + bob;
      ctx.beginPath(); ctx.moveTo(current.x - 10, my - 10); ctx.lineTo(current.x + 10, my - 10); ctx.lineTo(current.x, my + 2); ctx.closePath();
      fillStroke(ctx, '#ffd23f', 3);
    }

    // lighting
    const L = lightLevel();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (L.tint) { ctx.fillStyle = `rgba(${L.tint[0]},${L.tint[1]},${L.tint[2]},${L.tint[3]})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (L.dark > 0.01) {
      if (lightCanvas.width !== canvas.width || lightCanvas.height !== canvas.height) { lightCanvas.width = canvas.width; lightCanvas.height = canvas.height; }
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
      lctx.fillStyle = `rgba(22,18,58,${L.dark})`;
      lctx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);
      lctx.globalCompositeOperation = 'destination-out';
      const light = (x, y, r, s = 1) => {
        const X = (x - cam.x) * k, Y = (y - cam.y) * k, R = r * k;
        const gr = lctx.createRadialGradient(X, Y, 0, X, Y, R);
        gr.addColorStop(0, `rgba(0,0,0,${s})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = gr; lctx.fillRect(X - R, Y - R, R * 2, R * 2);
      };
      light(P.x, P.y - 56, 170, 0.9);
      light(H.x + 64, H.y + 108, 120, 0.9);
      light(S.x - 6, S.y + 42, 110); light(S.x + S.w + 6, S.y + 42, 110);
      light(S.x + S.w / 2, S.y - 8, 120, 0.7);
      light(900, 830, 110, 0.7);
      glassNoodles().forEach(g => light(g.x, g.y - 10, 90, 0.9));
      bricks().forEach(b => (b.kind === 'gold' || b.kind === 'fortune') && light(b.x, b.y, 80, 0.8));
      if (G.pieces.includes(6) || G.statueStep) light(STATUE.x, STATUE.y - 60, 120, 0.8);
      ctx.drawImage(lightCanvas, 0, 0);
      // fireflies
      if (L.dark > 0.3) {
        ctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
        for (let i = 0; i < 40; i++) {
          const fx = 1450 + ((i * 263) % 1100) + Math.sin(t * 0.7 + i) * 40, fy = ((i * 419) % 1700) + Math.cos(t * 0.5 + i * 2) * 30;
          if (!inView(fx, fy)) continue;
          const a = (Math.sin(t * 3 + i * 1.7) + 1) / 2;
          ctx.fillStyle = `rgba(255,236,140,${a * 0.25})`; circle(ctx, fx, fy, 9); ctx.fill();
          ctx.fillStyle = `rgba(255,246,190,${a})`; circle(ctx, fx, fy, 2.5); ctx.fill();
        }
      }
    }

    // flying Soba Birds over the peaks
    ctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
    for (let i = 0; i < 3; i++) {
      const bx = 3100 + Math.cos(t * 0.3 + i * 2.1) * 360, by = 800 + Math.sin(t * 0.45 + i * 2.1) * 420 - 200;
      if (inView(bx, by)) drawSobaBird(ctx, bx, by, t + i, 0.9);
    }
    // storm over the peaks
    if (stormy() && inPeaks(cam.x + viewW)) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const edge = Math.max(0, (PEAKS.left - cam.x) * k);
      ctx.fillStyle = 'rgba(40,40,70,0.28)'; ctx.fillRect(edge, 0, canvas.width - edge, canvas.height);
      ctx.strokeStyle = 'rgba(200,220,255,0.55)'; ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      for (let i = 0; i < 90; i++) {
        const rx = ((i * 97.3 + t * 90) % canvas.width), ry = ((i * 211.7 + t * 900) % canvas.height);
        if (rx < edge) continue;
        ctx.moveTo(rx, ry); ctx.lineTo(rx - 6 * dpr, ry + 18 * dpr);
      }
      ctx.stroke();
      if (stormFlash > 0) { ctx.fillStyle = `rgba(255,255,240,${stormFlash * 0.45})`; ctx.fillRect(edge, 0, canvas.width - edge, canvas.height); }
    }

    // swim HUD
    if (swim && !swim.done) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const text = `Bubbles ${swim.score}  ·  ${Math.ceil(swim.t)}s`;
      ctx.font = '26px "Bagel Fat One", sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.fillStyle = '#9ff3ff';
      const y = vh - (isTouch ? 160 : 90);
      ctx.strokeText(text, vw / 2, y); ctx.fillText(text, vw / 2, y);
    }
  }

  /* ---------- loop ---------- */
  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastFrame) / 1000 || 0);
    lastFrame = ts; now = ts / 1000;
    if (running) { update(dt); render(); }
    requestAnimationFrame(frame);
  }

  function resize() {
    vw = window.innerWidth; vh = window.innerHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    zoom = clamp(Math.min(vw / 900, vh / 620), 0.72, 1.5);
    if (typeof restStick === 'function') restStick();
  }

  /* ---------- input ---------- */
  // Touch mode turns on for phones and tablets, and also the first time anyone touches the screen.
  let isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  function enableTouch() {
    if (!isTouch) isTouch = true;
    document.body.classList.add('touch');
    restStick();
  }
  if (isTouch) document.body.classList.add('touch');

  // small vibration on phones that support it (Android); silently ignored elsewhere
  function buzz(ms) { try { if (isTouch && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  function actionDown() {
    if (!running) return;
    if (Space.active) { spaceBoost = true; $('action').classList.add('pressed'); return; }
    if (UI.talking) { UI.advance(); return; }
    if (UI.busy) return;
    $('action').classList.add('pressed');
    buzz(8);
    if (current) current.fn();
  }
  function actionUp() { $('action').classList.remove('pressed'); drinkHeld = false; spaceBoost = false; }

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT') { if (e.key === 'Escape') UI.closeSheet(); return; }
    const k = e.key.toLowerCase();
    if ([' ', 'e', 'enter'].includes(k)) { e.preventDefault(); if (!e.repeat) actionDown(); return; }
    if (k === 'escape') { UI.closeSheet(); return; }
    if (!running) return;
    if (k === 'n' && !UI.talking) { $('sheet').hidden ? UI.dex(G) : UI.closeSheet(); return; }
    if (k === 'm' && !UI.talking) { $('sheet').hidden ? openMap() : UI.closeSheet(); return; }
    if (k === 'j' && !UI.talking) { $('sheet').hidden ? UI.journal(G) : UI.closeSheet(); return; }
    if (k.startsWith('arrow') || k === 'f') e.preventDefault();
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    keys.delete(k);
    if ([' ', 'e', 'enter'].includes(k)) actionUp();
  });
  window.addEventListener('blur', () => { keys.clear(); actionUp(); });

  // The action button keeps the finger even if it slides a little, so holding to drink works.
  const act = $('action');
  act.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.pointerType === 'touch') enableTouch();
    try { act.setPointerCapture(e.pointerId); } catch (err) {}
    actionDown();
  });
  act.addEventListener('pointerup', actionUp);
  act.addEventListener('pointercancel', actionUp);
  act.addEventListener('lostpointercapture', actionUp);

  // Floating joystick: rests in the bottom-left corner, jumps to wherever you put your thumb.
  const stickEl = $('stick');
  function restStick() {
    if (!isTouch || stick.active) return;
    stickEl.hidden = !running;
    stickEl.classList.add('rest');
    const cs = getComputedStyle(document.documentElement);
    const sal = parseFloat(cs.getPropertyValue('--sal')) || 0, sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
    stickEl.style.left = (86 + sal) + 'px';
    stickEl.style.top = (vh - 118 - sab) + 'px';
    $('stickKnob').style.transform = '';
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') enableTouch();
    if (!running) return;
    if (UI.talking) { UI.advance(); return; }
    if (!isTouch || UI.busy) return;
    stick.active = true; stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.dx = stick.dy = 0;
    stickEl.hidden = false; stickEl.classList.remove('rest');
    stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px';
    $('stickKnob').style.transform = '';
    G.flags.movedByTouch = true;
  });
  window.addEventListener('pointermove', (e) => {
    if (!stick.active || e.pointerId !== stick.id) return;
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
    const d = Math.hypot(dx, dy), max = 46;
    if (d > max) { dx *= max / d; dy *= max / d; }
    stick.dx = dx / max; stick.dy = dy / max;
    $('stickKnob').style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const endStick = (e) => { if (e.pointerId !== stick.id) return; stick.active = false; stick.dx = stick.dy = 0; restStick(); };
  window.addEventListener('pointerup', endStick);
  window.addEventListener('pointercancel', endStick);

  // Phones: no long-press menus, no pinch zoom, sound wakes up again after the app was in the background.
  window.addEventListener('contextmenu', (e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  window.addEventListener('pointerdown', () => { if (running) Sound.init(); }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { save(); keys.clear(); actionUp(); } else keepAwake();
  });

  // Keep the screen from dimming while playing (if the browser allows it).
  let wakeLock = null;
  function keepAwake() {
    try { if (navigator.wakeLock && !document.hidden) navigator.wakeLock.request('screen').then(l => { wakeLock = l; }).catch(() => {}); } catch (e) {}
  }

  // Full screen button, only where the browser supports it (Android, iPad, desktop).
  const fsOK = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  $('fsBtn').hidden = !fsOK;
  $('fsBtn').addEventListener('click', () => {
    const el = document.documentElement;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (r && r.catch) r.catch(() => {}); }
    } catch (e) {}
  });
  const fsSync = () => { $('fsBtn').classList.toggle('on', !!(document.fullscreenElement || document.webkitFullscreenElement)); setTimeout(() => { resize(); restStick(); }, 120); };
  document.addEventListener('fullscreenchange', fsSync);
  document.addEventListener('webkitfullscreenchange', fsSync);

  const flyBtn = $('flyBtn');
  flyBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { flyBtn.setPointerCapture(e.pointerId); } catch (err) {} flyTouch = true; flyBtn.classList.add('pressed'); });
  const flyUp = () => { flyTouch = false; flyBtn.classList.remove('pressed'); };
  flyBtn.addEventListener('pointerup', flyUp); flyBtn.addEventListener('pointercancel', flyUp); flyBtn.addEventListener('lostpointercapture', flyUp);
  $('menuBtn').addEventListener('click', (e) => { e.stopPropagation(); const pop = $('menuPop'); pop.hidden = !pop.hidden; $('menuBtn').setAttribute('aria-expanded', String(!pop.hidden)); });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#menuPop') && !e.target.closest('#menuBtn')) $('menuPop').hidden = true; });
  $('suitBtn').addEventListener('click', () => {
    G.flags.wearSuit = !G.flags.wearSuit; $('menuPop').hidden = true; Sound.blip();
    UI.toast(G.flags.wearSuit ? '🧑‍🚀 Space suit on!' : 'Space suit off.', { life: 2 });
  });
  $('awayBtn').addEventListener('click', () => { $('menuPop').hidden = true; Care.goAway(); });
  Care.onAway((on) => { Net.away(on); if (on) save(); });
  Net.on('helped', (m) => { if (m.n > 0) { addCoins(m.n); Sound.secret(); UI.toast(`<span class="t-small">🤝 Welcome back!</span>Your friends crunched ${m.n} brick${m.n > 1 ? 's' : ''} while you were away: +${m.n} coins.`, { big: true, life: 4.4 }); } });
  $('accountBtn').addEventListener('click', () => { Sound.blip(); $('menuPop').hidden = true; openAccount(); });
  $('boardBtn').addEventListener('click', () => { Sound.blip(); $('menuPop').hidden = true; postScore(); openBoard(); });
  $('mapBtn').addEventListener('click', () => { Sound.blip(); openMap(); });
  $('minimap').addEventListener('click', () => { Sound.blip(); openMap(); });
  $('skillsMenuBtn').addEventListener('click', () => { $('menuPop').hidden = true; Sound.blip(); UI.skills(G, starTotal()); });
  $('skillsBtn').addEventListener('click', () => { Sound.blip(); UI.skills(G, starTotal()); });

  $('dexBtn').addEventListener('click', () => { Sound.blip(); UI.dex(G); });
  $('journalBtn').addEventListener('click', () => { Sound.blip(); UI.journal(G); });
  $('goal').addEventListener('click', () => {
    Sound.blip();
    const tg = goalTarget();
    if (!tg) { UI.journal(G, 'story'); return; }
    guideOn = !guideOn; sameGoalT = 0;
    UI.toast(guideOn ? `<span class="t-small">🧭 Showing the way</span>Follow the yellow arrow to: ${tg.label}. Tap the goal again to hide it.` : 'Arrow hidden. Tap the goal to show it again.', { life: 3 });
  });
  $('soundBtn').addEventListener('click', () => { const m = Sound.toggle(); $('soundIcon').textContent = m ? '🔇' : '🔊'; $('menuPop').hidden = true; });

  /* ---------- boot ---------- */
  let titleAnim = true;
  function titleLoop(ts) {
    if (!titleAnim) return;
    drawTitleHero($('titleHero').getContext('2d'), ts / 1000);
    requestAnimationFrame(titleLoop);
  }

  /* ---------- multiplayer ---------- */
  const PROFILE_KEY = 'noodle-universe-profile';
  const COLORS = ['#2fa4b5', '#e4572e', '#8cbf5a', '#b98cff', '#f4b942', '#ff8fb1', '#5b7cfa', '#9a7b5b'];
  let profile = { name: '', color: COLORS[0] };
  try { Object.assign(profile, JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}); } catch (e) {}
  if (!/^[a-z0-9]{8,24}$/.test(profile.uid || '')) profile.uid = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 16);
  let roomPot = null, roundEnd = 0;
  const saveProfile = () => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) {} };
  const emotes = new Map(); // id (or 'me') -> { e, until }
  let pendingStart = null;

  function brickPos(id) {
    if (typeof id === 'number' && BRICK_SPOTS[id]) return BRICK_SPOTS[id];
    const m = /^boulder(\d)$/.exec(id); return m ? CANYON.boulders[+m[1]] : null;
  }
  Net.on('joined', (m) => {
    profile.color = (m.players.find(p => p.id === m.you) || {}).color || profile.color;
    P.color = profile.color;
    const go = pendingStart; pendingStart = null;
    if (go) go();
    // bring in what the room already did
    m.crunched.forEach(id => { if (typeof id === 'number') { if (!G.crunched.includes(id)) G.crunched.push(id); } else { const k = /^boulder(\d)$/.exec(id); if (k) G.boulderHp[+k[1]] = 0; } });
    if (m.mode === 'team') m.teamFound.forEach(n => { if (!has(n) && NOODLES.some(x => x.id === n)) G.found.push(n); });
    roomPot = m.pot; roundEnd = m.round ? now + m.round.secs : 0;
    $('roomPill').hidden = false; $('roomPill').classList.remove('off'); $('emoteBtn').hidden = false; $('emoteMenuBtn').hidden = false;
    updateRoomPill();
    UI.toast(`<span class="t-small">${m.mode === 'team' ? '🤝 Team up' : '🏁 Race'} · room ${m.code}</span>${m.created ? `You made room <b>${m.code}</b>! Tap the room button to share it.` : `You joined room <b>${m.code}</b> with ${m.players.length - 1} friend${m.players.length > 2 ? 's' : ''}.`}`, { life: 5 });
    if (m.created) setTimeout(openFriends, 700);
    save();
  });
  Net.on('arrived', (p) => { Sound.blip(); UI.toast(`<span class="t-small">👋 New player</span>${p.name} joined the room`, { life: 2.6 }); updateRoomPill(); });
  Net.on('left', (m) => { UI.toast(`${m.name} left the room`, { life: 2.2 }); updateRoomPill(); });
  Net.on('scores', () => { updateRoomPill(); if (!$('sheet').hidden && $('sheetTitle').textContent === 'Friends') openFriends(); });
  Net.on('crunch', (m) => {
    const pos = brickPos(m.b);
    if (typeof m.b === 'number') { if (!G.crunched.includes(m.b)) G.crunched.push(m.b); }
    else { const k = /^boulder(\d)$/.exec(m.b); if (k) G.boulderHp[+k[1]] = 0; }
    if (pos && running) { burst(pos[0], pos[1] - 16, 12, ['#f4c35a', '#fff3d6'], { speed: 200, up: 180, size: 5 }); if (dist(P.x, P.y, pos[0], pos[1]) < 500) Sound.crunch(0.4); }
  });
  Net.on('found', (m) => {
    const n = NOODLES.find(x => x.id === m.n); if (!n) return;
    if (Net.mode === 'team') { if (!giveNoodle(m.n, m.name)) UI.toast(`<span class="t-small">${m.name}</span>found ${n.name} too!`, { life: 2.4 }); }
    else UI.toast(`<span class="t-small">🏁 ${m.name}</span>found ${n.name}${has(m.n) ? '' : '. Hurry!'}`, { noodle: n, life: 2.8 });
  });
  Net.on('me', (p) => { profile.color = p.color; P.color = p.color; saveProfile(); if (!$('sheet').hidden && $('sheetTitle').textContent === 'Friends') openFriends(); });
  Net.on('emote', (m) => { emotes.set(m.id === Net.me ? 'me' : m.id, { e: m.e, until: now + 3.5 }); if (m.id !== Net.me) Sound.pop(); });
  Net.on('round', (m) => {
    if (m.state === 'start') {
      roundEnd = now + m.secs;
      Sound.rooster();
      UI.toast(`<span class="t-small">🏁 Crunch Race!</span>${Math.round(m.secs / 60)} minutes. Crunch as many bricks as you can!`, { big: true, life: 4 });
    } else {
      roundEnd = 0;
      const won = m.winners.includes(Net.me);
      const names = m.list.filter(e => m.winners.includes(e.id)).map(e => e.name).join(' & ') || 'Nobody';
      const rank = m.list.findIndex(e => e.id === Net.me), mine = rank >= 0 ? m.list[rank].n : 0;
      let stars = won ? 3 : rank === 1 && mine > 0 ? 2 : rank === 2 && mine > 0 ? 1 : 0;
      if (!stars && mine >= 5) stars = 1;
      if (won) { G.trophies = (G.trophies || 0) + 1; addCoins(20); Sound.secret(); P.wow = 2; }
      if (stars) G.bonusStars = (G.bonusStars || 0) + stars;
      const best = mine > (G.bestRace || 0);
      if (best) G.bestRace = mine;
      UI.toast(`<span class="t-small">🏆 Race over · you crunched ${mine}${best && mine ? ' · personal best!' : ''}</span>${won ? 'You win! ⭐ +3 and 20 coins' : names + ' wins' + (stars ? `. You get ⭐ +${stars}` : '')}. Start another round any time!`, { big: true, life: 5 });
      save();
    }
    updateRoomPill();
  });
  Net.on('pot', (m) => {
    roomPot = m.pot;
    if (m.up) {
      G.bonusStars = (G.bonusStars || 0) + 2; addCoins(10); Sound.secret();
      setTimeout(() => giveShiny('Team Pot gift'), 1500);
      UI.toast(`<span class="t-small">🍲 Team Pot level ${m.pot.level}!</span>Everyone gets ⭐ +2 and 10 coins. The next pot is bigger.`, { big: true, life: 4.4 });
      save();
    }
    if (!$('sheet').hidden && $('sheetTitle').textContent === 'Friends') openFriends();
  });
  Net.on('respawn', () => { G.crunched = []; G.boulderHp = {}; UI.toast('The bricks grew back!', { life: 2.4 }); });
  Net.on('error', (m) => { mpMessage(m.msg, true); if (running) UI.toast(m.msg, { life: 3 }); });
  Net.on('disconnected', () => {
    $('roomPill').classList.add('off'); $('emoteBtn').hidden = true; $('emoteMenuBtn').hidden = true; $('emoteBar').hidden = true;
    if (running) UI.toast('<span class="t-small">Offline</span>Lost the connection to your room. You can keep playing solo.', { life: 4 });
  });

  function updateRoomPill() {
    if (!Net.code) return;
    let text = `${Net.mode === 'team' ? '🤝' : '🏁'} ${Net.code} · ${Net.others.size + 1}`;
    if (roundEnd > now) {
      const left = Math.ceil(roundEnd - now), mine = (Net.scores.find(e => e.id === Net.me) || {}).round || 0;
      text = `🏁 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · you ${mine}`;
    } else if (Net.mode === 'team' && roomPot) text += ` · 🍲 ${roomPot.fill}/${roomPot.need}`;
    $('roomText').textContent = text;
  }
  function openFriends() {
    UI.players(Net, leaveRoom, { pot: roomPot, roundLeft: roundEnd > now ? Math.ceil(roundEnd - now) : 0, startRound: () => Net.startRound() });
  }

  // Global leaderboard (lives on the server; quietly off when there is no server)
  let boardFails = 0, boardT = 20, myRank = null;
  const online = () => /^https?:$/.test(location.protocol) && boardFails < 3;
  function postScore() {
    if (!online() || !G) return;
    fetch('api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: profile.uid, name: profile.name || 'Squareface', color: profile.color, coins: G.coins, found: G.found.length, stars: starTotal() }) })
      .then(r => r.ok ? r.json() : Promise.reject(r.status)).then(d => { myRank = d.rank; boardFails = 0; })
      .catch(e => { if (e !== 429) boardFails++; });
  }
  // Online saves: a name + 4-digit PIN. The server keeps the save; nothing to recover if forgotten.
  let cloudT = 60, lastCloud = '';
  const api = (path, body) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(r => r.json().catch(() => ({})).then(d => { if (!r.ok) throw new Error(d.error || 'Could not reach the game server.'); return d; }),
      () => { throw new Error('Could not reach the game server. Online saving works on the Render version.'); });
  function cloudSave() {
    if (!profile.account || !G || !/^https?:$/.test(location.protocol)) return Promise.resolve('');
    save();
    return api('api/save', { name: profile.account.name, pin: profile.account.pin, save: G })
      .then(() => { lastCloud = UI.fmtTime(G.time) + ' (day ' + G.day + ')'; return 'Saved!'; }, e => e.message);
  }
  function openAccount() {
    UI.account({ account: profile.account, name: profile.name, last: lastCloud, online: /^https?:$/.test(location.protocol),
      link: (name, pin) => api('api/save', { name, pin, save: (save(), G) }).then(() => {
        profile.account = { name, pin }; profile.name = name; saveProfile(); lastCloud = 'just now'; boardT = 0;
        UI.toast('<span class="t-small">☁️ Saved online</span>Remember your name and PIN to play anywhere.', { life: 3.6 });
      }),
      saveNow: cloudSave,
      unlink: () => { delete profile.account; saveProfile(); UI.toast('This device stopped saving online. Your online save is still there.', { life: 3.4 }); } });
  }
  function openBoard(by = 'coins') {
    UI.leaderboard({ by, uid: profile.uid, name: profile.name, online: /^https?:$/.test(location.protocol),
      load: (key) => fetch('api/leaderboard?by=' + key).then(r => r.ok ? r.json() : Promise.reject()),
      rename: (n) => { profile.name = n.slice(0, 14); saveProfile(); boardT = 0; } });
  }
  function leaveRoom() {
    Net.leave();
    $('roomPill').hidden = true; $('emoteBtn').hidden = true; $('emoteMenuBtn').hidden = true; $('emoteBar').hidden = true;
    UI.closeSheet();
    UI.toast('You left the room. Playing solo now.', { life: 2.6 });
  }
  function sendEmote(e) {
    emotes.set('me', { e, until: now + 3.5 });
    P.wow = 0.8;
    Net.emote(e);
    $('emoteBar').hidden = true;
  }
  function mpMessage(text, err) { const el = $('mpMsg'); el.textContent = text || ''; el.classList.toggle('err', !!err); }

  function setupMultiplayerUI(startFn) {
    const nameIn = $('mpName'); nameIn.value = profile.name || '';
    const box = $('mpColors');
    COLORS.forEach(c => {
      const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', 'Color ' + c);
      if (c === profile.color) b.classList.add('on');
      b.addEventListener('click', () => { profile.color = c; box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); saveProfile(); });
      box.appendChild(b);
    });
    let mode = 'team';
    document.querySelectorAll('.mode-card').forEach(card => card.addEventListener('click', () => {
      mode = card.dataset.mode; document.querySelectorAll('.mode-card').forEach(c => c.classList.toggle('on', c === card));
    }));
    $('friendsBtn').addEventListener('click', () => {
      $('mpPanel').hidden = !$('mpPanel').hidden;
      if ($('mpPanel').hidden) return;
      if (isTouch) $('mpPanel').scrollIntoView({ block: 'start', behavior: 'smooth' }); else nameIn.focus();
    });
    const ready = () => { profile.name = nameIn.value.trim().slice(0, 14) || 'Squareface'; saveProfile(); Sound.init(); pendingStart = startFn; };
    const fail = () => { pendingStart = null; mpMessage('Could not reach the game server. Multiplayer works on the online version (Render) or when you run "npm start". Solo play works everywhere.', true); };
    const codeIn = $('mpCode');
    const cleanCode = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    codeIn.addEventListener('input', () => { const c = cleanCode(codeIn.value); if (c !== codeIn.value) codeIn.value = c; });
    $('mpDice').addEventListener('click', () => {
      const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789';
      const pick = (set) => set[Math.floor(Math.random() * set.length)];
      codeIn.value = pick(D) + pick(D) + pick(L) + pick(L);
      mpMessage('');
    });
    const enter = () => {
      const code = cleanCode(codeIn.value);
      if (code.length < 3) { codeIn.focus(); return mpMessage('Type a room name with 3 to 8 letters or numbers, like 67NM. Or tap 🎲.', true); }
      ready(); mpMessage('Entering room ' + code + '…');
      Net.enter(code, profile.name, profile.color, mode, profile.uid).catch(fail);
    };
    $('mpEnter').addEventListener('click', enter);
    codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); enter(); } });
    // a link like .../#KFPR opens the panel with the code filled in
    const fromLink = (new URLSearchParams(location.search).get('room') || (location.hash || '').replace('#', '')).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (fromLink.length >= 3 && fromLink.length <= 8) {
      $('mpPanel').hidden = false; codeIn.value = fromLink;
      mpMessage(`You were invited to room ${fromLink}. Type your name and tap Enter room!`);
    }
    $('roomPill').addEventListener('click', () => { Sound.blip(); openFriends(); });
    $('emoteBtn').addEventListener('click', () => { $('emoteBar').hidden = !$('emoteBar').hidden; });
  $('emoteMenuBtn').addEventListener('click', () => { $('menuPop').hidden = true; $('emoteBar').hidden = false; });
    $('emoteBar').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) sendEmote(b.dataset.e); });
  }

  function begin(state) {
    G = state || fresh();
    if (!G.fortune) newFortune();
    ensureDaily();
    if (G.pieces.includes(5) && !G.clues.includes('piece5')) G.clues.push('piece5');
    if (G.pieces.includes(5) && !G.snailStart) G.snailStart = Date.now();
    P.x = G.px; P.y = G.py; P.color = profile.color;
    $('suitBtn').hidden = !G.flags.suit;
    if (blocked(P.x, P.y)) { P.x = DOOR.x; P.y = DOOR.y + 30; }
    cam.x = P.x - vw / zoom / 2; cam.y = P.y - vh / zoom / 2;
    $('title').hidden = true; $('hud').hidden = false;
    keepAwake();
    titleAnim = false;
    running = true;
    restStick();
    if (!state) {
      setTimeout(() => UI.say('me-wow', [
        '*bzzt* ...Systems on. Screen on. Smile on.',
        'Hello, <em>Noodle Universe</em>! It smells like broth out here.',
        'The clock says 5:58 AM. The Morning Pool opens at 6. Let\'s go for a swim!',
      ], { onDone: () => UI.toast(isTouch ? 'Drag anywhere to move. Tap the big button to act.' : 'Move with WASD or arrows. Press Space to act.', { life: 4 }) }), 400);
    } else {
      UI.toast(`<span class="t-small">Welcome back</span>Day ${G.day} · ${G.found.length} noodles collected`, { life: 3 });
    }
  }

  async function boot(hotData) {
    resize();
    window.addEventListener('resize', resize);
    buildStreamSamples();
    try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
    ground = buildGround();
    buildMapImage();
    requestAnimationFrame(titleLoop);
    requestAnimationFrame(frame);

    const saved = (hotData && hotData.G) || load();
    if (saved) { $('startBtn').textContent = 'Continue ☀'; $('resetBtn').hidden = false; }
    const startGame = () => { if (!running) begin(saved && !$('resetBtn').dataset.wiped ? saved : null); };
    $('startBtn').addEventListener('click', () => { Sound.init(); startGame(); });
    setupMultiplayerUI(startGame);
    // Load a game saved online (name + PIN)
    $('loadBtn').addEventListener('click', () => { $('loadPanel').hidden = !$('loadPanel').hidden; if ($('loadPanel').hidden) return; if (isTouch) $('loadPanel').scrollIntoView({ block: 'start', behavior: 'smooth' }); else $('loadName').focus(); });
    $('loadPanel').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('loadName').value.trim(), pin = $('loadPin').value.trim(), msg = $('loadMsg');
      msg.classList.remove('err'); msg.textContent = 'Loading…';
      api('api/load', { name, pin }).then(d => {
        profile.account = { name: d.name || name, pin }; profile.name = d.name || name; saveProfile();
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(d.save)); } catch (err) {}
        Sound.init();
        begin(Object.assign(fresh(), d.save));
        UI.toast(`<span class="t-small">☁️ Welcome back, ${profile.name}</span>Your game is loaded.`, { life: 3.4 });
      }).catch(err => { msg.textContent = err.message; msg.classList.add('err'); });
    });
    $('resetBtn').addEventListener('click', () => {
      const b = $('resetBtn');
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to erase your save'; return; }
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
      b.dataset.wiped = '1'; b.hidden = true; $('startBtn').textContent = 'Wake up ☀';
    });
    if (hotData && hotData.G) begin(hotData.G);
  }

  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(() => ({ G: running ? (save(), G) : null })); } catch (e) {} }
  if (hot && typeof hot.ready === 'function') hot.ready(boot); else boot(hot && hot.data);

  return { levelReward: () => levelReward(noodleLevel() + 1), level: () => noodleLevel(), tryCipher, story, eat: eatFood, mastery: (sk) => ({ level: skillLevel(sk), xp: Math.floor((G.xp || {})[sk] || 0), next: masteryNeed(Math.max(3, skillLevel(sk)) + 1) }), get state() { return G; }, get player() { return P; } };
})();
