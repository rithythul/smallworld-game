// Noodle Universe: game loop, rules and world logic.
const Game = (() => {
  const canvas = $('world');
  const ctx = canvas.getContext('2d');
  const SAVE_KEY = 'noodle-universe-save-v1';
  const START_TIME = 5 * 60 + 58;
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
  let rockShimmer = [], drumHit = 0, drumBeats = [], mirrorTimer = 0, drinkWhere = null;

  let G = null;                 // saved state
  let ground = null;            // pre-rendered ground
  let vw = 0, vh = 0, dpr = 1, zoom = 1;
  const cam = { x: 0, y: 0 };
  const P = { x: 0, y: 0, moving: false, walk: 0, face: 0, mood: 'happy', crunching: 0, wow: 0, antennaPulse: 0, swimming: false };
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
      boulderHp: {}, gateHp: 3, mintDay: 0, mintUntil: 0,
      buffUntil: 0, buffDay: 0, fortune: null, hints: {}, journalNew: false,
      px: DOOR.x, py: DOOR.y + 30,
    };
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 1) return Object.assign(fresh(), s); } catch (e) {}
    return null;
  }
  function save() {
    if (!G) return;
    G.px = P.swimming ? GATE.x : P.x; G.py = P.swimming ? GATE.y : P.y;
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
  function blocked(x, y) {
    if (x < 30 || y < 40 || x > WORLD.w - 30 || y > WORLD.h - 30) return true;
    for (const r of RECTS) if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
    for (const [wx, wy] of WILLOWS) if (dist(x, y, wx, wy) < 22) return true;
    if (dist(x, y, PLACES.willowBack.x, PLACES.willowBack.y) < 22) return true;
    if (dist(x, y, 900, 848) < 40) return true;
    if (!onBridge(x, y) && streamDist(x, y) < STREAM.width / 2 + 4) return true;
    if (inPond(x, y, 6) || inSpring(x, y, 8)) return true;
    // the boulder wall, with its gate
    if (y > CANYON.wallY - 22 && y < CANYON.wallY + 26 && !(canyonOpen() && Math.abs(x - CANYON.gate.x) < 56)) return true;
    for (const [rx, ry] of CANYON.rocks) if (dist(x, y, rx, ry) < 36) return true;
    if (dist(x, y, DRUM.x, DRUM.y - 8) < 50) return true;
    return false;
  }

  function bricks() {
    const list = BRICK_SPOTS.map(([x, y], i) => ({ i, x, y, kind: y > CANYON.top ? 'canyon' : x > 1450 ? 'woods' : 'normal' }))
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
  function giveNoodle(id) {
    if (has(id)) return false;
    const n = NOODLES.find(n => n.id === id);
    G.found.push(id);
    P.wow = 1.6;
    Sound.discover();
    UI.toast(`<span class="t-small">New noodle · ${n.rarity}</span>${n.name}`, { noodle: n, big: true, life: 3.2 });
    burst(P.x, P.y - 60, 24, ['#ffd23f', '#fff8e8', '#e4572e', '#8fe0ea'], { type: 'spark', speed: 260, grav: 200, life: 1.1 });
    milestone();
    save();
    return true;
  }
  function addCoins(n, x = P.x, y = P.y - 80) {
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
  function newDay(msg) {
    G.day++; G.time = START_TIME; G.crunched = []; G.glassTaken = []; G.boulderHp = {};
    G.water = Math.max(G.water, 70);
    newFortune();
    P.swimming = false; swim = null;
    P.x = DOOR.x; P.y = DOOR.y + 30;
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
    if (UI.busy) return null;
    const c = [];
    const add = (label, x, y, r, fn, prio = 1, cls = '') => { const d = dist(P.x, P.y, x, y); if (d < r) c.push({ label, x, y, d, fn, prio, cls }); };
    if (P.swimming) {
      if (G.clues.includes('pillow') && !G.pieces.includes(1) && poolOpen()) add('DIVE', LAST_TILE.x, LAST_TILE.y, 34, diveTile, 3, 'swim');
      c.push({ label: 'GET OUT', x: P.x, y: P.y, d: 999, fn: exitPool, prio: 0, cls: 'swim' });
    } else {
      if (G.fortune && G.fortune.crunched && !G.fortune.done) { const f = FORTUNES[G.fortune.idx]; add('LOOK', f.where.x, f.where.y, 64, fortuneFound, 3, 'look'); }
      add('TALK', TALK.x, TALK.y, 80, talkGrandma, 2, 'talk');
      add('LOOK', POSTER.x, POSTER.y, 70, lookPoster, 2, 'look');
      add('ASK', ORACLE_AT.x, ORACLE_AT.y, 80, askOracle, 2, 'look');
      add(G.flags.pillowReady && !G.clues.includes('pillow') ? 'LOOK' : 'SLEEP', DOOR.x, DOOR.y, 70, useDoor, 2, 'look');
      add(poolOpen() ? 'SWIM' : 'CLOSED', GATE.x, GATE.y, 70, enterPool, 2, 'swim');
      if (!canyonOpen()) {
        const gy = CANYON.wallY - 30;
        if (G.solved.includes('cipher')) add('CRUNCH', CANYON.gate.x, gy, 80, crunchGate, 2);
        else add('LOOK', CANYON.gate.x, gy, 80, () => UI.say('me', 'A giant wall of ancient crunch-rock. You tap it. Too hard to crunch... for now.'), 2, 'look');
      }
      CANYON.rocks.forEach(([rx, ry], i) => add('CRUNCH', rx, ry + 34, 66, () => crunchRock(i), 1));
      add('DRUM', DRUM.x, DRUM.y + 40, 80, hitDrum, 2, 'talk');
      add('TALK', snail.x, snail.y + 10, 80, talkSnail, 2, 'talk');
      if (inSpring(P.x, P.y, 44)) c.push({ label: 'DRINK', x: SPRING.x, y: SPRING.y, d: 60, fn: () => startDrink('spring'), prio: 1, cls: 'water', hold: true });
      for (const b of bricks()) add('CRUNCH', b.x, b.y, 62, () => crunch(b), 1);
      for (const g of glassNoodles()) add('PICK', g.x, g.y, 56, () => pickGlass(g), 2, 'look');
      if (!has('vine')) for (const [wx, wy] of WILLOWS) add('PICK', wx, wy + 10, 64, pickVine, 1, 'look');
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

  function crunch(b) {
    P.crunching = 0.45;
    shake = Math.min(14, 6 + combo.n * 1.5);
    Sound.crunch(b.kind === 'gold' ? 1.4 : 1);
    const cols = { normal: ['#f4c35a', '#e0a13a', '#fff3d6'], woods: ['#c6d77a', '#9ccb6b', '#fff3d6'], gold: ['#ffd23f', '#fff8e8', '#e4572e'], fortune: ['#ffb3c8', '#fff8e8', '#b98cff'], canyon: ['#e59866', '#c9784a', '#fff3d6'], boulder: ['#c9784a', '#a45a33', '#e9a36b'] }[b.kind];
    burst(b.x, b.y - 16, 22, cols, { speed: 280, up: 260, size: 6 });
    floatText(b.x, b.y - 50, 'CRUNCH!', '#fff8e8');
    G.water = Math.max(0, G.water - 7);

    const t = now;
    const win = buffed() ? 2.6 : 1.7;
    combo.n = t - combo.last < win ? combo.n + 1 : 1;
    combo.last = t;
    UI.combo(combo.n);
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
      if (!has('boulder')) giveNoodle('boulder');
      return;
    }

    G.crunched.push(b.i);
    G.crunches++;
    if (b.kind === 'woods') G.woodsCrunches++;
    if (b.kind === 'canyon') G.canyonCrunches++;
    addCoins(1 + (combo.n >= 3 ? 1 : 0) + (buffed() ? 1 : 0), b.x, b.y - 80);
    if (!has('brick')) return giveNoodle('brick');
    if (b.kind === 'woods' && !has('matcha') && (Math.random() < 0.35 || G.woodsCrunches >= 3)) return giveNoodle('matcha');
    if (b.kind === 'canyon' && !has('crackle') && (Math.random() < 0.35 || G.canyonCrunches >= 3)) return giveNoodle('crackle');
    if (!has('crinkle') && (Math.random() < 0.2 || G.crunches >= 5)) return giveNoodle('crinkle');
  }

  /* ---------- Chapter 2: Crunch Canyon ---------- */
  function crunchGate() {
    G.gateHp--;
    P.crunching = 0.45; shake = 20;
    Sound.crunch(1.5);
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
    Sound.drum(drumBeats.length);
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
    const right = g1 < 0.55 && g2 > 0.6 && g2 < 2.4 && g2 > g1 * 1.7;
    if (!G.pieces.includes(3)) { setTimeout(() => UI.toast('The drum hums. It seems to be waiting for a special rhythm.', { life: 2.6 }), 300); return; }
    if (!right) { setTimeout(() => { Sound.wrong(); UI.toast('The drum grumbles. That was not the rhythm.', { life: 2.2 }); }, 250); return; }
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

  function talkSnail() {
    if (G.pieces.includes(5)) return UI.say('snail', ['Hellooo again, speedy. I\'m still thinking about that Dawn Noodle.', 'I heard the mountains are next. Mountains are very tall. I\'ll meet you there in about... a year.']);
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
      G.pieces.push(5); solve('mirror');
      Sound.secret(); P.wow = 1.8;
      burst(CANYON.snail.x, CANYON.snail.y - 10, 50, ['#ffd23f', '#fff8e8', '#d8e38a'], { type: 'spark', speed: 300, grav: 150 });
      giveNoodle('slowudon');
      UI.say('me-wow', [
        'Where the snail was sitting: <em>Map Piece 5</em>!',
        'It shows tall mountains... and on top, a little statue with a square head. It looks just like you.',
      ], { onDone: () => { UI.toast('<span class="t-small">Chapter 2 complete</span>The Soba Peaks are calling. Coming in the next update…', { life: 4.8 }); save(); } });
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
    save();
  }

  function startDrink(where = 'stream') {
    drinkHeld = true; drinkWhere = where;
    G.drinks++;
    Sound.gulp();
    if (where === 'spring') {
      if (!minty()) UI.toast('<span class="t-small">Minty 🌿</span>So fresh! You walk faster for a while.', { life: 2.8 });
      G.mintDay = G.day; G.mintUntil = G.time + 120;
      if (!has('mint')) setTimeout(() => giveNoodle('mint'), 500);
    }
    if (where === 'mirror') mirrorTimer = 0;
    if (!has('soba') && G.drinks >= 3) setTimeout(() => giveNoodle('soba'), 500);
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

  function enterPool() {
    if (!poolOpen()) {
      Sound.wrong();
      UI.say('me', G.time < POOL_OPEN ? 'The gate is locked. The sign says the Morning Pool opens at 6:00 AM.' : 'The Morning Pool is closed. It opens every day from 6 to 8 AM. Sleep, then come back early!');
      return;
    }
    P.swimming = true; P.x = GATE.x; P.y = POOL.y + 40;
    swim = { t: 25, score: 0, bubbles: [], spawn: 0, dawn: G.time < POOL_OPEN + 30 && !has('dawn') ? { x: POOL.x + 200, y: POOL.y + 120 } : null, done: false };
    Sound.splash();
    burst(P.x, P.y, 30, ['#8fe0ea', '#ffffff', '#5ed0e6'], { speed: 240, up: 200, size: 5, type: 'drop' });
    G.flags.swam = true;
    if (G.buffDay !== G.day) {
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
    if (hour() >= 18 || hour() < 5) {
      UI.say('me', 'Your bed looks very cozy. Sleep until morning?', { choices: [
        { label: 'Sleep until 5:58 AM', fn: () => newDay('You slept like a noodle.') },
        { label: 'Not yet', alt: true },
      ] });
    } else {
      UI.say('me', 'Home sweet home. It\'s too early for bed. The day is full of noodles!');
    }
  }

  function talkGrandma() {
    if (!G.flags.metGrandma) {
      UI.say('grandma', [
        'Oh! You switched on! Good morning, little square one.',
        'I\'m Grandma Ramen. Welcome to the <em>Noodle Universe</em>.',
        'Long ago I collected every noodle there is. My old Noodle-dex is empty now... Would you fill it up for me?',
        'Crunch the noodle bricks, drink from the stream when your face gets hot, and never skip your morning swim.',
        'And if you ever find a strange note... keep it. Some things are hidden on purpose. Hee hee.',
      ], { onDone: () => { G.flags.metGrandma = true; addCoins(5); milestone(); save(); } });
      return;
    }
    const n = G.found.length;
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
    ];
    UI.say('grandma', tips[(G.day + G.coins + n) % tips.length]);
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

  const HINT_COST = [3, 6, 10];
  function askOracle() {
    const open = ['pillow', 'piece1', 'cipher', 'canyon', 'piece3', 'piece4', 'mirror'].find(id => G.clues.includes(id) && !G.solved.includes(id));
    if (!open) return UI.say('oracle', ['Bloop. I am the Noodle Oracle.', 'Nothing troubles you yet, little screen. Come back when you find something strange.']);
    const lvl = G.hints[open] || 0;
    const clue = CLUES[open];
    if (lvl >= 3) return UI.say('oracle', ['I have told you all I know about ' + clue.title + ':', clue.hints[2]]);
    const cost = HINT_COST[lvl];
    const prev = lvl ? ['Last time I said: ' + clue.hints[lvl - 1]] : [];
    UI.say('oracle', [...prev, `Bloop... "${clue.title}" troubles you. A ${['small nudge', 'bigger hint', 'full answer'][lvl]} costs ${cost} Crunch Coins.`], { choices: [
      { label: `Pay ${cost} coins`, fn: () => {
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

  function goalText() {
    const n = G.found.length;
    if (hour() >= 21 || hour() < 5) return 'It\'s late. Go home and sleep (your door)';
    if (!G.flags.swam && G.day === 1 && G.time < POOL_CLOSE) return 'Swim in the Morning Pool before 8 AM';
    if (!G.flags.metGrandma) return 'Say good morning to Grandma Ramen at her noodle stand';
    if (n < 3) return `Collect 3 noodles (${n}/3). Crunch bricks in the meadow!`;
    if (G.flags.pillowReady && !G.clues.includes('pillow')) return 'Your antenna twitches… check your house';
    if (G.clues.includes('pillow') && !G.pieces.includes(1)) return 'Solve the Pillow Note (journal)';
    if (G.pieces.includes(1) && !G.pieces.includes(2)) return 'Find the place drawn on Map Piece 1';
    if (G.clues.includes('cipher') && !G.flags.decoder) return 'Find a way to read the noodle letters';
    if (G.flags.decoder && !G.solved.includes('cipher')) return 'Decode the noodle letters in your journal';
    if (G.solved.includes('cipher') && !canyonOpen()) return 'Something rumbled in the south. Check the boulder wall';
    if (canyonOpen() && !G.pieces.includes(3)) return 'Find the echo that crunches twice';
    if (G.pieces.includes(3) && !G.pieces.includes(4)) return 'Where could that rhythm be played?';
    if (G.pieces.includes(4) && !G.clues.includes('mirror')) return 'Drink where the water lies';
    if (G.clues.includes('mirror') && !G.pieces.includes(5)) return 'Read the reflection (journal)';
    return `Chapter 2 done! Fill the Noodle-dex (${n}/${NOODLES.length})`;
  }

  /* ---------- update ---------- */
  function update(dt) {
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
    if (G.water < 25) speed *= 0.62;
    if (buffed()) speed *= 1.2;
    if (minty()) speed *= 1.2;
    if (drinkHeld) speed = 0;
    P.moving = len > 0.15 && speed > 0;
    if (P.moving) {
      const nx = P.x + mx * speed * dt, ny = P.y + my * speed * dt;
      if (P.swimming) {
        P.x = clamp(nx, POOL.x + 26, POOL.x + POOL.w - 26);
        P.y = clamp(ny, POOL.y + 30, POOL.y + POOL.h - 12);
      } else {
        if (!blocked(nx, P.y)) P.x = nx;
        if (!blocked(P.x, ny)) P.y = ny;
      }
      P.walk += dt * (P.swimming ? 4 : 7);
      if (mx) P.face = clamp(P.face + Math.sign(mx) * dt * 8, -1, 1);
      if (!P.swimming && Math.floor(P.walk / Math.PI) !== Math.floor((P.walk - dt * 7) / Math.PI)) Sound.step();
    } else P.face *= 0.9;

    // hydration
    if (!busy) {
      if (!P.swimming) G.water -= dt * (P.moving ? 0.5 : 0.25);
      if (drinkHeld) {
        G.water += dt * 45;
        drinkSound -= dt;
        if (drinkSound <= 0) { Sound.gulp(); drinkSound = 0.42; burst(P.x + (P.face >= 0 ? 30 : -30), P.y - 6, 4, ['#8fe0ea', '#ffffff'], { speed: 80, up: 120, size: 4, type: 'drop', life: 0.5 }); }
        if (G.water >= 100 && drinkWhere !== 'mirror') { drinkHeld = false; floatText(P.x, P.y - 90, 'Ahh!', '#8fe0ea'); }
      }
      G.water = clamp(G.water, 0, 100);
      if (G.water < 25 && !thirstWarned) { thirstWarned = true; UI.toast('<span class="t-small">Thirsty 🥵</span>Drink from the stream to walk at full speed.', { life: 3 }); }
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
        else if (G.time >= POOL_OPEN + 30) swim.dawn = null;
      }
    }

    // stop drinking if walked away
    if (drinkHeld) {
      const still = drinkWhere === 'spring' ? inSpring(P.x, P.y, 50) : drinkWhere === 'mirror' ? inPond(P.x, P.y, 50) : streamDist(P.x, P.y) < STREAM.width / 2 + 40;
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
    const sOff = G.pieces.includes(5) ? 90 : snail.moved;
    const nx = CANYON.snail.x + sOff + Math.sin(now * 0.12) * 50;
    snail.dir = nx > snail.x ? 1 : nx < snail.x ? -1 : snail.dir;
    snail.x = nx;

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
    if (G.fortune && G.fortune.crunched && !G.fortune.done) secrets.push(FORTUNES[G.fortune.idx].where);
    glassNoodles().forEach(g => !has('glass') && secrets.push(g));
    let near = 1e9;
    secrets.forEach(s => near = Math.min(near, dist(P.x, P.y, s.x, s.y)));
    const range = 520;
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
    UI.goal(goalText());

    // camera
    const viewW = vw / zoom, viewH = vh / zoom;
    const tx = clamp(P.x - viewW / 2, 0, Math.max(0, WORLD.w - viewW));
    const ty = clamp(P.y - 40 - viewH / 2, 0, Math.max(0, WORLD.h - viewH));
    cam.x += (tx - cam.x) * Math.min(1, dt * 6);
    cam.y += (ty - cam.y) * Math.min(1, dt * 6);

    saveTimer -= dt; if (saveTimer <= 0) { saveTimer = 5; save(); }
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
    if (drinkHeld && drinkWhere === 'mirror') drawReflection(ctx, t, Math.min(1, mirrorTimer / 1.2), G.pieces.includes(4));
    drawPool(ctx, POOL, t, { open: poolOpen(), dawn, showArrows: dawn, lastTile: G.clues.includes('pillow') && !G.pieces.includes(1) });

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
    WILLOWS.forEach(([x, y]) => inView(x, y) && draw.push({ y, fn: () => drawWillow(ctx, x, y, t) }));
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
    const H = PLACES.house, S = PLACES.shop;
    draw.push({ y: H.y + 170, fn: () => drawHouse(ctx, H, t, night) });
    draw.push({ y: S.y + 150, fn: () => drawShop(ctx, S, t, night) });
    draw.push({ y: 858, fn: () => drawOracle(ctx, 900, 858, t, 1, !!current && current.label === 'ASK') });
    draw.push({ y: P.y + (P.swimming ? 1000 : 0), fn: () => drawPlayer(ctx, P, t) });
    draw.sort((a, b) => a.y - b.y).forEach(d => d.fn());

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
  }

  /* ---------- input ---------- */
  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (isTouch) document.body.classList.add('touch');

  function actionDown() {
    if (!running) return;
    if (UI.talking) { UI.advance(); return; }
    if (UI.busy) return;
    $('action').classList.add('pressed');
    if (current) current.fn();
  }
  function actionUp() { $('action').classList.remove('pressed'); drinkHeld = false; }

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT') { if (e.key === 'Escape') UI.closeSheet(); return; }
    const k = e.key.toLowerCase();
    if ([' ', 'e', 'enter'].includes(k)) { e.preventDefault(); if (!e.repeat) actionDown(); return; }
    if (k === 'escape') { UI.closeSheet(); return; }
    if (!running) return;
    if (k === 'n' && !UI.talking) { $('sheet').hidden ? UI.dex(G) : UI.closeSheet(); return; }
    if (k === 'j' && !UI.talking) { $('sheet').hidden ? UI.journal(G) : UI.closeSheet(); return; }
    if (k.startsWith('arrow')) e.preventDefault();
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    keys.delete(k);
    if ([' ', 'e', 'enter'].includes(k)) actionUp();
  });
  window.addEventListener('blur', () => { keys.clear(); actionUp(); });

  const act = $('action');
  act.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); actionDown(); });
  act.addEventListener('pointerup', actionUp);
  act.addEventListener('pointerleave', actionUp);
  act.addEventListener('pointercancel', actionUp);

  canvas.addEventListener('pointerdown', (e) => {
    if (!isTouch || !running || UI.busy) return;
    stick.active = true; stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.dx = stick.dy = 0;
    const s = $('stick'); s.hidden = false; s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px';
    $('stickKnob').style.transform = '';
  });
  window.addEventListener('pointermove', (e) => {
    if (!stick.active || e.pointerId !== stick.id) return;
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
    const d = Math.hypot(dx, dy), max = 46;
    if (d > max) { dx *= max / d; dy *= max / d; }
    stick.dx = dx / max; stick.dy = dy / max;
    $('stickKnob').style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const endStick = (e) => { if (e.pointerId !== stick.id) return; stick.active = false; stick.dx = stick.dy = 0; $('stick').hidden = true; };
  window.addEventListener('pointerup', endStick);
  window.addEventListener('pointercancel', endStick);

  $('dexBtn').addEventListener('click', () => { Sound.blip(); UI.dex(G); });
  $('journalBtn').addEventListener('click', () => { Sound.blip(); UI.journal(G); });
  $('goal').addEventListener('click', () => { Sound.blip(); UI.journal(G); });
  $('soundBtn').addEventListener('click', () => { const m = Sound.toggle(); $('soundIcon').textContent = m ? '🔇' : '🔊'; });

  /* ---------- boot ---------- */
  let titleAnim = true;
  function titleLoop(ts) {
    if (!titleAnim) return;
    drawTitleHero($('titleHero').getContext('2d'), ts / 1000);
    requestAnimationFrame(titleLoop);
  }

  function begin(state) {
    G = state || fresh();
    if (!G.fortune) newFortune();
    P.x = G.px; P.y = G.py;
    if (blocked(P.x, P.y)) { P.x = DOOR.x; P.y = DOOR.y + 30; }
    cam.x = P.x - vw / zoom / 2; cam.y = P.y - vh / zoom / 2;
    $('title').hidden = true; $('hud').hidden = false;
    titleAnim = false;
    running = true;
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
    requestAnimationFrame(titleLoop);
    requestAnimationFrame(frame);

    const saved = (hotData && hotData.G) || load();
    if (saved) { $('startBtn').textContent = 'Continue ☀'; $('resetBtn').hidden = false; }
    $('startBtn').addEventListener('click', () => { Sound.init(); begin(saved && !$('resetBtn').dataset.wiped ? saved : null); });
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

  return { tryCipher };
})();
