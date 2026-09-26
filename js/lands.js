// The Endless Frontier: new lands east of the Soba Peaks, one after another, forever.
// Every land is made from its number, so every player (and every friend in a room) sees the same land.
// Each land has a Keeper and a Map Stone with 3 missing star shards: one inside a crystal brick,
// one on top of a tall pillar (hop or fly to grab it) and one for answering the Keeper's science question.
// Restoring the Map Stone opens the Cloud Gate to the next land.
const LAND_W = 2400, LAND_H = WORLD.h, LAND_X0 = WORLD.w;

const BIOMES = [
  { id: 'dunes', name: 'Candy Dunes', ground: '#f2d59a', patch: 'rgba(233,184,110,0.45)', dot: 'rgba(255,255,255,0.35)', prop: 'cactus', color: '#e59866', brick: '#f7c873',
    keeper: 'Dune Dumpling', trees: ['corn', 'chili'],
    hello: 'Welcome to the Candy Dunes! It is hot in the day and chilly at night out here.',
    q: { s: 'earth', q: 'Deserts are hot in the day. What happens at night?', o: ['They get cold', 'They get even hotter', 'They turn into oceans'], a: 0, why: 'Dry air and no clouds let the heat escape into space at night, so deserts can get really cold!' } },
  { id: 'marsh', name: 'Mushroom Marsh', ground: '#9fc47e', patch: 'rgba(120,150,90,0.45)', dot: 'rgba(185,140,255,0.35)', prop: 'shroom', color: '#b98cff', brick: '#c7b3e8',
    keeper: 'Mossy Morel', trees: ['mushroom', 'scallion'],
    hello: 'Hello from the soggy, squishy Mushroom Marsh!',
    q: { s: 'nature', q: 'Mushrooms are not plants. What are they?', o: ['Fungi', 'Rocks', 'Tiny animals'], a: 0, why: 'Mushrooms are fungi. They can\'t make food from sunlight like plants, so they eat old leaves and wood instead.' } },
  { id: 'tundra', name: 'Crystal Tundra', ground: '#e4f0f7', patch: 'rgba(170,205,230,0.45)', dot: 'rgba(255,255,255,0.7)', prop: 'crystal', color: '#5b9bd5', brick: '#cfe6f7',
    keeper: 'Frosty Fusilli', trees: ['nori'],
    hello: 'Brrr! Welcome to the Crystal Tundra, where everything sparkles.',
    q: { s: 'chemistry', q: 'Why does ice float on water?', o: ['Ice is lighter for its size than water', 'Ice is hollow inside', 'Ice is afraid of water'], a: 0, why: 'When water freezes, its tiny particles line up with more space between them. That makes ice less dense, so it floats!' } },
  { id: 'bamboo', name: 'Bamboo Breeze', ground: '#b9da8e', patch: 'rgba(130,180,90,0.4)', dot: 'rgba(255,255,255,0.3)', prop: 'bamboo', color: '#6fa54a', brick: '#c9e39b',
    keeper: 'Panda Pho', trees: ['bamboo', 'dumpling'],
    hello: 'Whoosh! Listen to the bamboo sing in the Bamboo Breeze.',
    q: { s: 'nature', q: 'How fast can some bamboo grow?', o: ['Almost 1 meter in one day', '1 cm in a year', 'It never grows'], a: 0, why: 'Some bamboo is the fastest-growing plant on Earth: up to about 90 cm in a single day!' } },
  { id: 'lava', name: 'Lava Ladle', ground: '#a88672', patch: 'rgba(120,80,70,0.4)', dot: 'rgba(255,140,60,0.35)', prop: 'lavarock', color: '#e4572e', brick: '#d9876a',
    keeper: 'Captain Kimchi', trees: ['chili'],
    hello: 'Careful, it\'s toasty! Welcome to the Lava Ladle.',
    q: { s: 'earth', q: 'What is lava?', o: ['Melted rock from inside the Earth', 'Very hot orange juice', 'Sunlight that fell down'], a: 0, why: 'Deep inside the Earth it is so hot that rock melts. When it comes out of a volcano, we call it lava. It cools down into new rock.' } },
  { id: 'clouds', name: 'Cloud Meadows', ground: '#ebe6fb', patch: 'rgba(200,190,245,0.45)', dot: 'rgba(255,255,255,0.8)', prop: 'puff', color: '#8f7cf0', brick: '#e2dcff',
    keeper: 'Nimbus Noodle', trees: ['naruto', 'egg'],
    hello: 'Soft and fluffy! You are walking on the Cloud Meadows.',
    q: { s: 'earth', q: 'What are clouds made of?', o: ['Tiny drops of water or ice', 'Cotton candy', 'Smoke from dragons'], a: 0, why: 'Warm air carries water up high, where it cools into tiny droplets. Billions of them together make a cloud. When they get heavy, it rains!' } },
  { id: 'coral', name: 'Coral Coast', ground: '#f6e6bf', patch: 'rgba(140,210,220,0.35)', dot: 'rgba(255,143,177,0.35)', prop: 'coral', color: '#ff8fb1', brick: '#ffc6d9',
    keeper: 'Shelly Shio', trees: ['nori', 'naruto'],
    hello: 'Ahoy! Smell the salty breeze of the Coral Coast.',
    q: { s: 'nature', q: 'Coral looks like a plant or a rock. What is it really?', o: ['Tiny animals living together', 'Pink stones', 'Seaweed'], a: 0, why: 'Coral is made of tiny animals called polyps. They build hard homes that grow into huge reefs where fish live.' } },
  { id: 'autumn', name: 'Autumn Orchard', ground: '#ead08a', patch: 'rgba(228,140,60,0.35)', dot: 'rgba(228,87,46,0.3)', prop: 'maple', color: '#e08a2e', brick: '#f0b36a',
    keeper: 'Maple Miso', trees: ['egg', 'dumpling'],
    hello: 'Crunch crunch! Welcome to the leafy Autumn Orchard.',
    q: { s: 'nature', q: 'Why do leaves turn orange and red in autumn?', o: ['The green color fades away', 'Someone paints them', 'They catch fire'], a: 0, why: 'Leaves are green because of chlorophyll. In autumn the tree stops making it, the green fades, and the yellow, orange and red that were hiding show up!' } },
];
const LAND_ADJ = ['Whispering', 'Sparkly', 'Giant', 'Sleepy', 'Windy', 'Twinkling', 'Hidden', 'Rainbow', 'Misty', 'Golden', 'Bouncy', 'Moonlit'];

const Lands = (() => {
  const cache = new Map();

  // Place things apart from each other, away from the Map Stone and the edges.
  function scatter(rnd, n, x0, taken, minD, area) {
    const out = [];
    for (let tries = 0; out.length < n && tries < n * 60; tries++) {
      const x = x0 + area.x0 + rnd() * (area.x1 - area.x0), y = area.y0 + rnd() * (area.y1 - area.y0);
      if (taken.some(([tx, ty, d]) => Math.hypot(tx - x, ty - y) < Math.max(minD, d || 0))) continue;
      taken.push([x, y, minD]); out.push([x, y]);
    }
    return out;
  }

  function get(n) {
    if (n < 1) return null;
    if (cache.has(n)) return cache.get(n);
    const rnd = mulberry(n * 7919 + 13);
    const biome = BIOMES[(n - 1) % BIOMES.length], round = Math.floor((n - 1) / BIOMES.length);
    const name = round ? `${LAND_ADJ[(n * 5 + round) % LAND_ADJ.length]} ${biome.name}` : biome.name;
    const x0 = LAND_X0 + (n - 1) * LAND_W;
    const sy = 700 + Math.floor(rnd() * 500);                  // the Map Stone sits near the west entrance
    const stone = { x: x0 + 460, y: sy };
    const keeper = { x: stone.x + 110, y: stone.y + 20 };
    const taken = [[stone.x, stone.y, 260], [x0 + 60, sy, 200]];
    const east = { x0: LAND_W * 0.5, x1: LAND_W - 160, y0: 180, y1: LAND_H - 180 };
    const all = { x0: 160, x1: LAND_W - 160, y0: 160, y1: LAND_H - 140 };
    const [shardBrick] = scatter(rnd, 1, x0, taken, 300, east);
    const [pillar] = scatter(rnd, 1, x0, taken, 300, east);
    const trees = scatter(rnd, 6, x0, taken, 180, all).map(([x, y], i) => ({ x, y, kind: biome.trees[i % biome.trees.length], id: `L${n}t${i}` }));
    const bricks = scatter(rnd, 18, x0, taken, 110, all).map(([x, y], i) => ({ x, y, id: `L${n}.${i}` }));
    const props = scatter(rnd, 44, x0, taken, 90, all).map(([x, y]) => ({ x, y, s: 0.8 + rnd() * 0.6, v: rnd() }));
    // soft ground patches (drawn every frame, so keep them simple)
    const patches = Array.from({ length: 60 }, () => ({ x: x0 + rnd() * LAND_W, y: rnd() * LAND_H, r: 60 + rnd() * 140, dot: rnd() < 0.3 }));
    const L = { n, name, biome, x0, x1: x0 + LAND_W, stone, keeper, shardBrick: { x: shardBrick[0], y: shardBrick[1] }, pillar: { x: pillar[0], y: pillar[1] }, trees, bricks, props, patches, round };
    cache.set(n, L);
    return L;
  }
  // Which land a spot is in (0 = the home world)
  const at = (x) => x < LAND_X0 ? 0 : Math.floor((x - LAND_X0) / LAND_W) + 1;

  /* ---------------- drawing ---------------- */
  function drawGround(ctx, L, vx0, vy0, vx1, vy1) {
    const x0 = Math.max(L.x0, vx0), x1 = Math.min(L.x1, vx1), y0 = Math.max(0, vy0), y1 = Math.min(LAND_H, vy1);
    if (x1 <= x0 || y1 <= y0) return;
    ctx.fillStyle = L.biome.ground; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    for (const p of L.patches) {
      if (p.x + p.r < vx0 || p.x - p.r > vx1 || p.y + p.r < vy0 || p.y - p.r > vy1) continue;
      ctx.fillStyle = p.dot ? L.biome.dot : L.biome.patch;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.6, 0, 0, TAU); ctx.fill();
    }
    // the land's name, written big on the ground near the entrance
    const nx = L.x0 + 420, ny = L.stone.y - 260;
    if (nx > vx0 - 600 && nx < vx1 + 600 && ny > vy0 - 100 && ny < vy1 + 100) {
      ctx.font = '72px "Bagel Fat One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(52,35,63,0.13)'; ctx.fillText(L.name, nx + 140, ny);
    }
    ctx.restore();
  }

  function drawProp(ctx, L, p, t) {
    const { x, y, s, v } = p;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(52,35,63,0.16)'; ctx.beginPath(); ctx.ellipse(0, 2, 26, 8, 0, 0, TAU); ctx.fill();
    const sway = Math.sin(t * 1.3 + x * 0.01) * 1.5;
    switch (L.biome.prop) {
      case 'cactus':
        rr(ctx, -10, -64, 20, 66, 10); fillStroke(ctx, '#7fbf5a', 3);
        rr(ctx, -28, -44, 12, 26, 6); fillStroke(ctx, '#7fbf5a', 3); rr(ctx, 16, -52, 12, 22, 6); fillStroke(ctx, '#7fbf5a', 3);
        if (v > 0.5) { ctx.fillStyle = '#ff8fb1'; circle(ctx, 0, -66, 6); ctx.fill(); }
        break;
      case 'shroom':
        rr(ctx, -7, -34, 14, 36, 6); fillStroke(ctx, '#fff3d6', 3);
        ctx.beginPath(); ctx.ellipse(sway, -36, 30, 20, 0, Math.PI, 0); ctx.closePath(); fillStroke(ctx, v > 0.5 ? '#b98cff' : '#e4572e', 3);
        ctx.fillStyle = '#fff8e8'; [[-12, -44], [4, -50], [14, -40]].forEach(([a, b]) => { circle(ctx, a + sway, b, 4); ctx.fill(); });
        break;
      case 'crystal':
        [[-12, 0.8, -0.2], [0, 1.2, 0], [12, 0.7, 0.25]].forEach(([dx, h, r]) => {
          ctx.save(); ctx.translate(dx, 0); ctx.rotate(r);
          ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-8, -40 * h); ctx.lineTo(0, -52 * h); ctx.lineTo(8, -40 * h); ctx.lineTo(8, 0); ctx.closePath();
          fillStroke(ctx, v > 0.5 ? '#bfe9ff' : '#d8ccff', 3); ctx.restore();
        });
        ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 3 + x) * 0.4})`; circle(ctx, 2, -44, 3); ctx.fill();
        break;
      case 'bamboo':
        [-14, 0, 14].forEach((dx, i) => {
          const h = 70 + i * 14 + v * 20;
          rr(ctx, dx - 5 + sway * (i + 1) * 0.4, -h, 10, h + 2, 4); fillStroke(ctx, '#8cbf5a', 2.5);
          ctx.strokeStyle = '#4f7f35'; ctx.lineWidth = 2; for (let k = 20; k < h; k += 22) { ctx.beginPath(); ctx.moveTo(dx - 5 + sway * (i + 1) * 0.4, -k); ctx.lineTo(dx + 5 + sway * (i + 1) * 0.4, -k); ctx.stroke(); }
        });
        break;
      case 'lavarock':
        ctx.beginPath(); ctx.moveTo(-28, 0); ctx.quadraticCurveTo(-30, -34, -4, -40); ctx.quadraticCurveTo(26, -38, 28, 0); ctx.closePath(); fillStroke(ctx, '#6b5552', 3);
        ctx.strokeStyle = `rgba(255,${120 + Math.sin(t * 2 + x) * 40 | 0},40,0.9)`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(-4, -22); ctx.lineTo(4, -12); ctx.lineTo(14, -26); ctx.stroke();
        break;
      case 'puff':
        [[-16, -18, 18], [10, -22, 20], [0, -34, 18]].forEach(([a, b, r]) => { circle(ctx, a + sway, b, r); fillStroke(ctx, '#ffffff', 3); });
        break;
      case 'coral':
        ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.lineCap = 'round';
        const br = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -30); ctx.moveTo(0, -18); ctx.lineTo(-16, -40); ctx.moveTo(0, -22); ctx.lineTo(16, -44); ctx.moveTo(0, -30); ctx.lineTo(sway, -52); ctx.stroke(); };
        br(); ctx.strokeStyle = v > 0.5 ? '#ff8fb1' : '#ffb38a'; ctx.lineWidth = 7; br();
        break;
      case 'maple':
        rr(ctx, -6, -46, 12, 48, 4); fillStroke(ctx, '#a0673b', 3);
        [[-20, -58, 24], [18, -62, 24], [0, -80, 28]].forEach(([a, b, r]) => { circle(ctx, a + sway, b, r); fillStroke(ctx, v > 0.5 ? '#e4572e' : '#f4b942', 3); });
        break;
    }
    ctx.restore();
  }

  // The Keeper: a round little guardian in the land's color
  function drawKeeper(ctx, L, t, s = 1, at = L.keeper) {
    const { x, y } = at, c = L.biome.color;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const b = Math.sin(t * 2.4) * 2;
    ctx.fillStyle = 'rgba(52,35,63,0.2)'; ctx.beginPath(); ctx.ellipse(0, 2, 24, 7, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -24 + b, 24, 26, 0, 0, TAU); fillStroke(ctx, c, 3);
    ctx.beginPath(); ctx.ellipse(0, -18 + b, 14, 12, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
    ctx.fillStyle = INK; circle(ctx, -8, -32 + b, 3.2); ctx.fill(); circle(ctx, 8, -32 + b, 3.2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, -26 + b, 6, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = '#ff8fb1'; ctx.globalAlpha = 0.6; circle(ctx, -15, -25 + b, 4); ctx.fill(); circle(ctx, 15, -25 + b, 4); ctx.fill(); ctx.globalAlpha = 1;
    // a leaf-noodle sprout on top
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -49 + b); ctx.quadraticCurveTo(8 + Math.sin(t * 3) * 4, -62 + b, 2, -70 + b); ctx.stroke();
    ctx.strokeStyle = '#f7dc7a'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }

  // The Map Stone with 3 sockets for star shards
  function drawStone(ctx, L, t, shards, restored) {
    const { x, y } = L.stone;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(52,35,63,0.2)'; ctx.beginPath(); ctx.ellipse(0, 4, 50, 13, 0, 0, TAU); ctx.fill();
    if (restored) {
      ctx.fillStyle = `rgba(255,210,63,${0.25 + Math.sin(t * 2) * 0.1})`; circle(ctx, 0, -50, 70 + Math.sin(t * 2) * 6); ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-34, -84); ctx.quadraticCurveTo(0, -110, 34, -84); ctx.lineTo(40, 0); ctx.closePath();
    fillStroke(ctx, restored ? '#d9d2c3' : '#b3aa9a', 3);
    // a tiny map carved in the stone
    ctx.strokeStyle = 'rgba(52,35,63,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-20, -30); ctx.lineTo(-6, -40); ctx.lineTo(6, -28); ctx.lineTo(20, -40); ctx.stroke();
    [-18, 0, 18].forEach((dx, i) => {
      const on = restored || shards[i];
      circle(ctx, dx, -70, 8); fillStroke(ctx, on ? '#ffd23f' : '#8d8579', 2.5);
      if (on) { ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 4 + i) * 0.4})`; circle(ctx, dx - 2, -72, 2.5); ctx.fill(); }
    });
    ctx.restore();
  }

  function drawStar(ctx, x, y, r, t) {
    ctx.fillStyle = `rgba(255,236,140,${0.35 + Math.sin(t * 4) * 0.15})`; circle(ctx, x, y, r * 2); ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a + t) * rr2, y + Math.sin(a + t) * rr2); }
    ctx.closePath(); fillStroke(ctx, '#ffd23f', 2.5);
  }
  // A tall pillar with a star shard floating on top (only reachable with a hop)
  function drawPillar(ctx, L, t, hasShard) {
    const { x, y } = L.pillar;
    ctx.fillStyle = 'rgba(52,35,63,0.2)'; ctx.beginPath(); ctx.ellipse(x, y + 3, 34, 10, 0, 0, TAU); ctx.fill();
    rr(ctx, x - 24, y - 70, 48, 72, 8); fillStroke(ctx, '#c9bfae', 3);
    ctx.strokeStyle = 'rgba(52,35,63,0.3)'; ctx.lineWidth = 2;
    for (let k = 14; k < 70; k += 18) { ctx.beginPath(); ctx.moveTo(x - 24, y - k); ctx.lineTo(x + 24, y - k); ctx.stroke(); }
    rr(ctx, x - 30, y - 78, 60, 12, 5); fillStroke(ctx, '#ddd4c3', 3);
    if (hasShard) drawStar(ctx, x, y - 104 + Math.sin(t * 2) * 4, 13, t);
  }

  // A wall of clouds on a land's west edge while it is still locked
  function drawCloudWall(ctx, x, t, vy0, vy1, label) {
    const y0 = Math.max(0, Math.floor(vy0 / 50) * 50), y1 = Math.min(LAND_H, vy1);
    for (let y = y0; y < y1; y += 50) {
      for (let k = 0; k < 4; k++) {
        const cx = x - 40 + k * 44 + Math.sin(t * 0.6 + y * 0.03 + k) * 14;
        ctx.fillStyle = `rgba(255,255,255,${0.92 - k * 0.12})`;
        circle(ctx, cx, y + Math.cos(t * 0.5 + k + y) * 6, 52 - k * 5); ctx.fill();
      }
    }
    if (label) {
      const ly = clampN((vy0 + vy1) / 2, 200, LAND_H - 200);
      ctx.font = '800 18px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(label).width + 30;
      rr(ctx, x - 120 - w / 2, ly - 18, w, 36, 18); fillStroke(ctx, '#fff8e8', 3);
      ctx.fillStyle = INK; ctx.fillText(label, x - 120, ly + 1);
    }
  }
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

  return { get, at, drawGround, drawProp, drawKeeper, drawStone, drawPillar, drawStar, drawCloudWall, W: LAND_W, X0: LAND_X0 };
})();
