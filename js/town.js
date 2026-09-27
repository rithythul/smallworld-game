// Small World: the rules of Small Town. This file runs in the browser (solo towns) and on the server
// (shared towns in rooms), so everyone plays by exactly the same rules.
(function (root) {
  const X0 = 3600, X1 = 6000, H = 2600;
  const MIN = 60 * 1000;

  // a tiny seeded random, same as art.js
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------- the map of Small Town ---------------- */
  const BUILDINGS = [
    { id: 'hall', name: 'Town Hall', icon: '🏛️', x: 4800, y: 900, w: 320, h: 210, npc: { name: 'Mayor Maple', color: '#8cbf5a', hat: 'crown' } },
    { id: 'bank', name: 'Bank', icon: '🏦', x: 4330, y: 1180, w: 230, h: 170, npc: { name: 'Banker Penny', color: '#f4b942', hat: 'beanie' } },
    { id: 'market', name: 'Market', icon: '🧺', x: 5270, y: 1180, w: 250, h: 170, npc: { name: 'Marketkeeper Miso', color: '#e4572e', hat: 'chef' } },
    { id: 'school', name: 'School', icon: '🏫', x: 4330, y: 1580, w: 250, h: 180, npc: { name: 'Teacher Tofu', color: '#b98cff', hat: 'flower' } },
    { id: 'jobs', name: 'Jobs & Post Office', icon: '💼', x: 5270, y: 1580, w: 250, h: 170, npc: { name: 'Boss Bolt', color: '#5b7cfa', hat: 'propeller' } },
    { id: 'rent', name: 'Apartments', icon: '🏢', x: 4000, y: 2130, w: 260, h: 220, npc: { name: 'Landlord Keys', color: '#9a7b5b', hat: 'bowl' } },
  ];
  const PLAZA = { x: 4800, y: 1330, r: 150 };
  const TOWN_FARM = { x: 5160, y: 260, w: 720, h: 420 };
  const FARM_SPOTS = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) FARM_SPOTS.push({ x: TOWN_FARM.x + 90 + c * 135, y: TOWN_FARM.y + 150 + r * 160 });
  const ROADS = [   // [x0, y0, x1, y1] straight roads, 90 wide
    [X0 - 1000, 1760, 6220, 1760], [4800, 1000, 4800, 2560], [4330, 1180, 5270, 1180], [4330, 1580, 5270, 1580],
    [4330, 1180, 4330, 1760], [5270, 1180, 5270, 1760], [5520, 760, 5520, 1760], [4560, 760, 5520, 760], [4560, 760, 4560, 1180],
    [3560, -60, 3560, 1760],   // up to the train station
  ];
  const RAIL_Y = -250;                      // the railway runs along the north edge, east forever
  const STATION = { id: 'station0', type: 'station', x: 3740, y: -20, w: 260 };
  const PROJECT_SPOTS = { fountain: { x: 4800, y: 1340 }, park: { x: 5100, y: 2230 }, library: { x: 5330, y: 2010 }, clinic: { x: 5000, y: 2000 }, busTown: { x: 3740, y: 1700 }, busVillage: { x: 560, y: 680 } };

  // land for sale: farms east of the market, building lots in the west and south
  const PLOTS = [];
  [950, 1160, 1370, 1930, 2140, 2350].forEach((y, r) => [5560, 5790].forEach((x, c) => PLOTS.push({ id: `F${r * 2 + c + 1}`, kind: 'farm', x, y, w: 200, h: 165, price: 70 + (r % 3) * 10 + c * 10 })));
  [1000, 1210, 1420].forEach((y, r) => [3700, 3930].forEach((x, c) => PLOTS.push({ id: `L${r * 2 + c + 1}`, kind: 'lot', x, y, w: 200, h: 170, price: 110 + r * 15 + c * 10 })));
  [1900, 2110, 2330].forEach((y, r) => [4290, 4520].forEach((x, c) => PLOTS.push({ id: `L${r * 2 + c + 7}`, kind: 'lot', x, y, w: 200, h: 170, price: 130 + r * 10 + c * 10 })));
  const PLOT_BY_ID = {}; PLOTS.forEach(p => { PLOT_BY_ID[p.id] = p; });

  /* ---------------- the town grows: new districts to the east, forever ---------------- */
  const DX0 = 6220, DW = 2000;
  // what each new district brings. After the first four, districts keep coming with new landmarks from a pool.
  const PLACES = {
    station: { name: 'Train Station', icon: '🚉', npc: { name: 'Conductor Rails', color: '#5b7cfa', hat: 'beanie' }, wall: '#e8f1f7', roof: '#5b7cfa' },
    tech: { name: 'Tech Hub', icon: '💻', npc: { name: 'Techie Pixel', color: '#2fa4b5', hat: 'propeller' }, wall: '#d6f1ff', roof: '#2fa4b5' },
    biz: { name: 'Business Center', icon: '🏢', npc: { name: 'Investor Ivy', color: '#9a7b5b', hat: 'crown' }, wall: '#f3eddd', roof: '#34233f' },
    studio: { name: 'Media Studio', icon: '🎬', npc: { name: 'Director Reel', color: '#ff8fb1', hat: 'beanie' }, wall: '#ffe2ef', roof: '#b98cff' },
    dealer: { name: 'Wheels & Wings', icon: '🚗', npc: { name: 'Dealer Gears', color: '#e4572e', hat: 'propeller' }, wall: '#fff1a8', roof: '#e4572e' },
    airport: { name: 'Airport', icon: '✈️', npc: { name: 'Captain Sky', color: '#5b7cfa', hat: 'crown' }, wall: '#eef6ff', roof: '#9ff3ff' },
    harbor: { name: 'Harbor', icon: '⚓', npc: { name: 'Skipper Wave', color: '#2fa4b5', hat: 'bowl' }, wall: '#fff3d6', roof: '#2fa4b5' },
    space: { name: 'Space Center', icon: '🚀', npc: { name: 'Commander Nova', color: '#b98cff', hat: 'propeller' }, wall: '#f7f1e3', roof: '#34233f' },
    stadium: { name: 'Stadium', icon: '⚽', npc: { name: 'Coach Kick', color: '#8cbf5a', hat: 'beanie' }, wall: '#e0f5d0', roof: '#8cbf5a' },
    museum: { name: 'Museum', icon: '🦕', npc: { name: 'Curator Bones', color: '#f4b942', hat: 'bowl' }, wall: '#f3eddd', roof: '#9a7b5b' },
    zoo: { name: 'Zoo', icon: '🦁', npc: { name: 'Keeper Paws', color: '#f08a3c', hat: 'flower' }, wall: '#e0f5d0', roof: '#8cbf5a' },
    cafe: { name: 'Cafe', icon: '☕', npc: { name: 'Barista Bean', color: '#9a7b5b', hat: 'chef' }, wall: '#ffe2c6', roof: '#e4572e' },
    arcade: { name: 'Arcade', icon: '🕹️', npc: { name: 'Gamer Glitch', color: '#b98cff', hat: 'propeller' }, wall: '#eadcff', roof: '#5b7cfa' },
    hotel: { name: 'Hotel', icon: '🏨', npc: { name: 'Manager Mint', color: '#8cbf5a', hat: 'crown' }, wall: '#fff3d6', roof: '#b98cff' },
  };
  Object.assign(STATION, PLACES.station);
  const DISTRICTS = [
    { name: 'Station District', land: ['tech', 'biz'], nature: 'lake' },
    { name: 'Studio District', land: ['studio', 'dealer'], nature: 'hills' },
    { name: 'Airport District', land: ['airport', 'harbor'], nature: 'beach' },
    { name: 'Space District', land: ['space', 'stadium'], nature: 'stars' },
  ];
  const POOL = ['museum', 'zoo', 'cafe', 'arcade', 'hotel'], NATURES = ['grove', 'lake', 'meadow', 'hills', 'beach'];
  const NATURE_NAME = { lake: 'Blue Lake', hills: 'Sunny Hills', beach: 'Seashell Beach', stars: 'Star Hill', grove: 'Mushroom Grove', meadow: 'Butterfly Meadow' };
  const NAMES = ['Maple', 'Cedar', 'Willow', 'Pine', 'Birch', 'Aspen', 'Juniper', 'Elm', 'Hazel', 'Rowan'];
  const growthNeed = (k) => 25 + 60 * (k - 1) + 20 * (k - 1) * (k - 1);   // growth points to open district k
  const dcache = {};
  function district(k) {
    if (dcache[k]) return dcache[k];
    const x0 = DX0 + (k - 1) * DW, d = DISTRICTS[k - 1];
    const land = d ? d.land : [POOL[(k * 2) % POOL.length], POOL[(k * 2 + 1) % POOL.length]];
    const nature = d ? d.nature : NATURES[k % NATURES.length];
    const name = d ? d.name : `${NAMES[k % NAMES.length]} District`;
    const mk = (type, x, y, w) => ({ id: type + k, type, x, y, w, ...PLACES[type] });
    const landmarks = [mk(land[0], x0 + 520, 1690, type0w(land[0])), mk(land[1], x0 + 1480, 1690, type0w(land[1]))];
    const station = { ...mk('station', x0 + 1180, -20, 260), id: 'station' + k };
    const plots = [];
    [1900, 2110].forEach((y, r) => [150, 380, 1100, 1330].forEach((dx, c) => plots.push({ id: `D${k}L${r * 4 + c + 1}`, kind: 'lot', x: x0 + dx, y, w: 200, h: 170, price: 100 + 10 * k + r * 10 + c * 5 })));
    [880, 1090].forEach((y, r) => [1150, 1380].forEach((dx, c) => plots.push({ id: `D${k}F${r * 2 + c + 1}`, kind: 'farm', x: x0 + dx, y, w: 200, h: 165, price: 70 + 5 * k + r * 10 + c * 5 })));
    const roads = [[x0 - 20, 1760, x0 + DW, 1760], [x0 + 1000, -60, x0 + 1000, 2560], [x0 + 1000, 1330, x0 + 1760, 1330]];
    const cx = x0 + 480, cy = 620;
    const SP = {
      lake: [['fish', -250, 230], ['fish', 270, 170], ['photo', 0, -280], ['camp', 330, -210]],
      hills: [['view', 0, 40], ['gem', -260, 200], ['gem', 250, 220], ['photo', 300, -200]],
      beach: [['shell', -250, 240], ['shell', 60, 300], ['swim', 0, 60], ['photo', 300, 260]],
      stars: [['stars', 0, 60], ['photo', -260, 230], ['gem', 280, 240], ['camp', -300, -200]],
      grove: [['berry', -240, 180], ['berry', 240, 200], ['photo', 0, -250], ['camp', 300, -150]],
      meadow: [['photo', -200, 150], ['berry', 220, 220], ['camp', 0, -220], ['view', 280, -60]],
    }[nature];
    const spots = SP.map(([type, dx, dy], i) => ({ id: `n${k}.${i}`, type, x: cx + dx, y: cy + dy }));
    return (dcache[k] = { k, x0, x1: x0 + DW, name, nature, natureName: NATURE_NAME[nature], nat: { x: cx, y: cy }, landmarks, station, plots, roads, spots, stop: { x: x0 + 250, y: 1700 } });
  }
  function type0w(t) { return t === 'airport' ? 360 : t === 'stadium' ? 320 : 280; }
  const districtsOf = (town) => Array.from({ length: (town && town.districts) || 0 }, (_, i) => district(i + 1));
  const allPlots = (town) => PLOTS.concat(...districtsOf(town).map(d => d.plots));
  function plotById(id) {
    if (Object.prototype.hasOwnProperty.call(PLOT_BY_ID, id)) return PLOT_BY_ID[id];
    const m = /^D(\d{1,3})[FL]\d{1,2}$/.exec(id || ''); if (!m) return null;
    return district(+m[1]).plots.find(p => p.id === id) || null;
  }
  // every place with a keeper you can talk to: the old town, the train station, and each district's landmarks
  const placesOf = (town) => [...BUILDINGS, STATION, ...districtsOf(town).flatMap(d => [d.station, ...d.landmarks])];
  const hasPlace = (town, type) => districtsOf(town).some(d => d.landmarks.some(l => l.type === type));
  const stopsOf = (town) => [{ id: 'stop0', name: 'Small Town', x: PROJECT_SPOTS.busTown.x, y: PROJECT_SPOTS.busTown.y }, ...districtsOf(town).map(d => ({ id: 'stop' + d.k, name: d.name, x: d.stop.x, y: d.stop.y }))];
  const stationsOf = (town) => [{ id: 'station0', name: 'Small Town', x: STATION.x, y: STATION.y }, ...districtsOf(town).map(d => ({ id: d.station.id, name: d.name, x: d.station.x, y: d.station.y }))];
  const worldRight = (town) => DX0 + ((town && town.districts) || 0) * DW;
  function grow(town, n, now) {
    town.growth = (town.growth || 0) + n;
    while (town.growth >= growthNeed((town.districts || 0) + 1)) {
      town.districts = (town.districts || 0) + 1;
      const d = district(town.districts);
      news(town, `🏙️ Small Town grew! ${d.name} opened: ${d.landmarks.map(l => l.icon + ' ' + l.name).join(', ')}.`);
      town.justGrew = { k: town.districts, at: now };
    }
  }
  // 6 soil spots on a farm, 2 rows of 3
  const soilSpot = (p, i) => ({ x: p.x + 40 + (i % 3) * 60, y: p.y + 60 + Math.floor(i / 3) * 62 });

  // the town forest: public trees
  const FOREST = [];
  { const r = rng(4242); for (let tries = 0; FOREST.length < 42 && tries < 3000; tries++) {
    const x = 3720 + r() * 800, y = 180 + r() * 600;
    if (FOREST.some(t => Math.hypot(t.x - x, t.y - y) < 95)) continue;
    FOREST.push({ id: 't' + FOREST.length, x, y, kind: r() < 0.5 ? 'oak' : 'pine' });
  } }

  /* ---------------- goods, prices and time ---------------- */
  const GOODS = {
    wheat: { name: 'Wheat', icon: '🌾', base: 4, seed: 1, grow: 1.0 * MIN },
    carrot: { name: 'Carrot', icon: '🥕', base: 7, seed: 2, grow: 1.5 * MIN },
    tomato: { name: 'Tomato', icon: '🍅', base: 10, seed: 3, grow: 2.5 * MIN },
    corn: { name: 'Corn', icon: '🌽', base: 14, seed: 5, grow: 3.5 * MIN },
    tree: { name: 'Tree', icon: '🌳', base: 0, seed: 4, grow: 5 * MIN, sapling: true },
    log: { name: 'Log', icon: '🪵', base: 6 },
    fish: { name: 'Fish', icon: '🐟', base: 9 },
    shell: { name: 'Shell', icon: '🐚', base: 6 },
    gem: { name: 'Crystal', icon: '💎', base: 16 },
    berry: { name: 'Berries', icon: '🫐', base: 5 },
  };
  const CROPS = ['wheat', 'carrot', 'tomato', 'corn'];
  const SELLABLE = ['wheat', 'carrot', 'tomato', 'corn', 'log', 'fish', 'shell', 'gem', 'berry'];
  const NORM = 20;   // how much of each good the market usually has
  const FARM_REGROW = 40 * 1000, TREE_REGROW = 5 * MIN;
  const TAX = { farm: 2, lot: 3 };          // property tax per day
  const RENT = 5;                            // apartment rent per day
  const BUILD = { house: { name: 'House', icon: '🏠', logs: 12, coins: 60 }, shop: { name: 'Shop', icon: '🏪', logs: 18, coins: 110 },
    villa: { name: 'Villa', icon: '🏡', logs: 30, coins: 400 }, company: { name: 'Company', icon: '🏭', logs: 16, coins: 90 } };
  const COMPANY_TYPES = ['bakery', 'restaurant', 'builders', 'toys'];

  const PROJECTS = [
    { id: 'fountain', name: 'Plaza Fountain', icon: '⛲', cost: 60, desc: 'A place to meet friends. The town looks happier.' },
    { id: 'lights', name: 'Street Lights', icon: '💡', cost: 110, desc: 'Bright, safe streets at night.' },
    { id: 'bus', name: 'Bus Line', icon: '🚌', cost: 150, desc: 'A town bus that drives up and down Main Road. A ticket costs 2 coins.' },
    { id: 'park', name: 'Town Park', icon: '🌳', cost: 210, desc: 'Trees, benches and a playground for everyone.' },
    { id: 'library', name: 'Library', icon: '📚', cost: 280, desc: 'Free books for everyone. Classes give an extra star.' },
    { id: 'clinic', name: 'Clinic', icon: '🏥', cost: 380, desc: 'Doctors and nurses keep the town healthy.' },
  ];
  // after the big projects, the town keeps going: festivals and tree planting, forever
  function project(id) {
    const p = PROJECTS.find(x => x.id === id); if (p) return p;
    const m = /^(festival|forest)(\d+)$/.exec(id); if (!m) return null;
    const n = +m[2];
    return m[1] === 'festival'
      ? { id, name: `Town Festival #${n}`, icon: '🎆', cost: 120 + n * 30, desc: 'Music, fireworks and a gift of 5 coins for every citizen.' }
      : { id, name: `Plant a Forest #${n}`, icon: '🌲', cost: 60 + n * 10, desc: 'The town pays foresters to plant 6 new trees.' };
  }
  function projectChoices(town) {
    const out = PROJECTS.filter(p => !town.built.includes(p.id)).slice(0, 3);
    let n = 1; while (town.built.includes('festival' + n)) n++;
    let f = 1; while (town.built.includes('forest' + f)) f++;
    if (out.length < 3) out.push(project('festival' + n));
    if (out.length < 3 || forestLeft(town) < 30) out.push(project('forest' + f));
    return out.slice(0, 3);
  }

  /* ---------------- a new town ---------------- */
  function newTown(now) {
    return { v: 1, created: now, at: now, treasury: 40, growth: 0, districts: 0, taxRate: 10, plots: {}, cut: {}, saplings: {}, farm: {},
      stock: Object.fromEntries(SELLABLE.map(g => [g, NORM])), built: [], votes: {}, mayor: null, election: null,
      lastNpcTax: now, lastForester: now, news: [] };
  }
  function news(town, text) { town.news.unshift(text); town.news.length = Math.min(town.news.length, 8); }

  const forestLeft = (town) => FOREST.filter(t => treeState(town, t.id, town.at) === 'tree').length;
  function treeState(town, id, now) {
    if (town.saplings[id]) return now - town.saplings[id] >= TREE_REGROW ? 'tree' : 'sapling';
    return town.cut[id] ? 'stump' : 'tree';
  }
  function price(town, g) {
    const gd = GOODS[g]; if (!gd || !gd.base) return 0;
    const f = clamp(1.5 - 0.5 * (town.stock[g] || 0) / NORM, 0.5, 1.6);
    return Math.max(1, Math.round(gd.base * f));
  }
  // what selling n would pay right now, one by one (each sale lowers the price a little)
  const SELL_MAX = 50;   // the market buys up to 50 of one thing at a time
  function sellPreview(town, g, n) { const st = town.stock[g] || 0, each = []; for (let i = 0; i < Math.min(n, SELL_MAX); i++) { town.stock[g] = st + i; each.push(price(town, g)); } town.stock[g] = st; return each; }
  // what buying n logs would cost, one by one (each one bought makes the next a little pricier)
  function buyPreview(town, g, n) { const st = town.stock[g] || 0, each = []; for (let i = 0; i < n; i++) { town.stock[g] = Math.max(0, st - i); each.push(price(town, g) + 2); } town.stock[g] = st; return each; }
  const usual = (g) => GOODS[g] ? GOODS[g].base : 0;
  const trend = (town, g) => { const f = price(town, g) / GOODS[g].base; return f > 1.12 ? 'up' : f < 0.88 ? 'down' : 'same'; };
  function cropState(c, now) {
    if (!c) return 'empty';
    if (!c.w) return 'dry';
    return now - c.w >= GOODS[c.k].grow ? 'ready' : 'growing';
  }
  const cropProgress = (c, now) => (!c || !c.w) ? 0 : clamp((now - c.w) / GOODS[c.k].grow, 0, 1);

  // Time passes: prices settle back, the town collects a little tax from its other citizens,
  // a forester plants trees, elections close and projects get built.
  // Weather is the same for everyone: some afternoons it rains, and rain waters every thirsty crop.
  const DAY = 6 * MIN;
  function raining(now) { const d = Math.floor(now / DAY), f = (now % DAY) / DAY; return ((d * 2654435761) >>> 0) % 4 === 1 && f > 0.32 && f < 0.52; }
  function settle(town, now) {
    if (raining(now)) Object.values(town.plots).forEach(p => (p.soil || []).forEach(c => { if (c && !c.w) c.w = now; }));
    SELLABLE.forEach(g => { if (typeof town.stock[g] !== 'number') town.stock[g] = NORM; });
    if (typeof town.growth !== 'number') { town.growth = 0; town.districts = 0; }
    // prices drift back to normal: 10% of the way every 30 seconds. Leftover time is kept, so frequent checks never lose it.
    const steps = Math.floor(Math.max(0, now - town.at) / (30 * 1000));
    if (steps > 0) {
      for (let i = 0; i < Math.min(60, steps); i++) SELLABLE.forEach(g => { town.stock[g] += (NORM - town.stock[g]) * 0.1; });
      town.at = steps > 60 ? now : town.at + steps * 30 * 1000;
    }
    const npcTaxes = Math.floor((now - town.lastNpcTax) / (2 * MIN));
    if (npcTaxes > 0) { town.treasury += Math.min(30, npcTaxes * 2); grow(town, Math.min(30, npcTaxes * 2), now); town.lastNpcTax += npcTaxes * 2 * MIN; }
    if (now - town.lastForester > 4 * MIN) {
      town.lastForester = now;
      const stump = FOREST.find(t => treeState(town, t.id, now) === 'stump');
      if (stump) town.saplings[stump.id] = now;
    }
    // election
    const e = town.election;
    if (e && now >= e.closes) {
      const tally = {};
      Object.entries(e.cand).forEach(([uid, c]) => { tally[uid] = Math.floor((c.rep || 0) / 5); });
      Object.values(e.votes).forEach(uid => { if (tally[uid] !== undefined) tally[uid] += 2; });
      const incumbent = town.mayor ? 3 : 4;   // Mayor Maple (or the mayor now) gets votes from the other citizens
      let best = null, bestN = incumbent;
      Object.entries(tally).forEach(([uid, n]) => { if (n > bestN) { best = uid; bestN = n; } });
      if (best) { town.mayor = { uid: best, name: e.cand[best].name, since: now }; news(town, `🗳️ ${e.cand[best].name} won the election with ${bestN} votes! New mayor!`); }
      else news(town, `🗳️ The election is over. ${town.mayor ? town.mayor.name : 'Mayor Maple'} stays mayor (${incumbent} votes).`);
      town.lastElection = { at: now, tally, names: Object.fromEntries(Object.entries(e.cand).map(([u, c]) => [u, c.name])), incumbent, winner: best };
      town.election = null;
    }
    // build the project most people voted for, when the treasury can pay for it
    const choices = projectChoices(town);
    const count = {}; Object.values(town.votes).forEach(id => { count[id] = (count[id] || 0) + 1; });
    const pick = choices.slice().sort((a, b) => (count[b.id] || 0) - (count[a.id] || 0))[0];
    if (pick && (count[pick.id] || 0) > 0 && town.treasury >= pick.cost) {
      town.treasury -= pick.cost; town.built.push(pick.id); town.votes = {};
      if (/^forest/.test(pick.id)) FOREST.filter(t => treeState(town, t.id, now) === 'stump').slice(0, 6).forEach(t => { town.saplings[t.id] = now; });
      news(town, `${pick.icon} The town built: ${pick.name}! Paid with everyone's taxes.`);
      grow(town, 15, now);
      town.justBuilt = { id: pick.id, at: now };
    }
  }

  /* ---------------- actions ---------------- */
  // who = { uid, name }. Returns { ok, msg, gain: { coins, items } } for the player who acted.
  function act(town, a, who, now) {
    settle(town, now);
    const fail = (msg) => ({ ok: false, msg });
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const dm = /^D(\d+)/.exec(a.id || ''), plot = a.id && (!dm || +dm[1] <= (town.districts || 0)) ? plotById(a.id) : null;   // land in districts that exist
    const st = plot && own(town.plots, a.id) ? town.plots[a.id] : null;
    if (a.i !== undefined && !(Number.isInteger(a.i) && a.i >= 0 && a.i < 10)) return fail('?');
    const mine = st && st.owner === who.uid;
    switch (a.type) {
      case 'buyPlot': {
        if (!plot) return fail('No such land.');
        if (st && st.owner) return fail(`${st.name} already owns this land.`);
        town.plots[a.id] = { owner: who.uid, name: who.name, build: null, soil: plot.kind === 'farm' ? [null, null, null, null, null, null] : [] };
        news(town, `🏡 ${who.name} bought ${plot.kind === 'farm' ? 'a farm' : 'a lot'} (${a.id}).`);
        grow(town, 5, now);
        return { ok: true, cost: plot.price };
      }
      case 'build': {
        if (!mine) return fail('You can only build on your own land.');
        if (plot.kind !== 'lot' || st.build) return fail('You cannot build here.');
        if (!BUILD[a.kind]) return fail('Build what?');
        st.build = a.kind; st.buildAt = now;
        if (a.kind === 'company') st.co = COMPANY_TYPES.includes(a.k) ? a.k : 'bakery';
        grow(town, 10, now);
        news(town, `${BUILD[a.kind].icon} ${who.name} built a ${BUILD[a.kind].name.toLowerCase()}!`);
        return { ok: true };
      }
      case 'plant': {
        if (!mine || plot.kind !== 'farm') return fail('Plant on your own farm.');
        if (st.soil[a.i]) return fail('Something is already growing here.');
        if (!own(GOODS, a.k) || !GOODS[a.k].grow) return fail('That will not grow.');
        st.soil[a.i] = { k: a.k, t: now, w: 0 };
        return { ok: true };
      }
      case 'water': {
        const c = mine && st.soil[a.i];
        if (!c || c.w) return fail('Nothing to water.');
        c.w = now; return { ok: true };
      }
      case 'harvest': {
        const c = mine && st.soil[a.i];
        if (cropState(c, now) !== 'ready') return fail('Not ready yet.');
        st.soil[a.i] = null;
        return { ok: true, items: c.k === 'tree' ? { log: 3 } : { [c.k]: 1 + (a.bonus ? 1 : 0) }, crop: c.k };
      }
      case 'sell': {
        const n = Math.max(1, Math.min(SELL_MAX, a.n | 0));
        if (!SELLABLE.includes(a.g)) return fail('The market does not buy that.');
        let coins = 0; const each = [];
        for (let i = 0; i < n; i++) { const p = price(town, a.g); each.push(p); coins += p; town.stock[a.g] += 1; }   // every one sold makes the next a little cheaper
        return { ok: true, coins, each };
      }
      case 'buyGood': {   // logs from the sawmill
        const n = Math.max(1, Math.min(30, a.n | 0));
        if (a.g !== 'log') return fail('Not for sale.');
        let cost = 0; const each = [];
        for (let i = 0; i < n; i++) { const p = price(town, 'log') + 2; each.push(p); cost += p; town.stock.log = Math.max(0, town.stock.log - 1); }
        return { ok: true, cost, each };
      }
      case 'sellPlot': {   // sell your land back to the town for half of what it cost (and half of what you built on it)
        if (!mine) return fail('That is not your land.');
        const refund = Math.floor(plot.price / 2) + (st.build && BUILD[st.build] ? Math.floor(BUILD[st.build].coins / 2) : 0);
        delete town.plots[a.id];
        news(town, `🏡 ${who.name} sold land ${a.id} back to the town.`);
        return { ok: true, refund, build: st.build || null };
      }
      case 'chop': {
        const t = FOREST.find(x => x.id === a.tree);
        if (!t || treeState(town, t.id, now) !== 'tree') return fail('No tree here.');
        delete town.saplings[t.id]; town.cut[t.id] = now;
        return { ok: true };
      }
      case 'replant': {
        const t = FOREST.find(x => x.id === a.tree);
        if (!t || treeState(town, t.id, now) !== 'stump') return fail('Plant saplings on stumps.');
        town.saplings[t.id] = now; return { ok: true };
      }
      case 'farmwork': {
        const s = FARM_SPOTS[a.i]; if (!s) return fail('?');
        if (now - (town.farm[a.i] || 0) < FARM_REGROW) return fail('Not ready yet.');
        town.farm[a.i] = now; return { ok: true };
      }
      case 'tax': {
        const n = Math.max(0, Math.min(500, Math.round(a.n || 0)));
        town.treasury += n; grow(town, n, now); return { ok: true };
      }
      case 'fare': {   // a bus or train ticket: fares help pay for public transport
        const n = Math.max(1, Math.min(20, Math.round(a.n || 1)));
        town.treasury += n; grow(town, n, now); return { ok: true };
      }
      case 'vote': {
        if (!projectChoices(town).some(p => p.id === a.project)) return fail('That project is not on the list.');
        town.votes[who.uid] = a.project;
        if (town.mayor && town.mayor.uid === who.uid) { town.votes[who.uid + ':m1'] = a.project; town.votes[who.uid + ':m2'] = a.project; }   // the mayor's choice counts 3 times
        return { ok: true };
      }
      case 'run': {
        if (town.mayor && town.mayor.uid === who.uid) return fail('You are already the mayor!');
        if (!town.election) town.election = { opened: now, closes: now + 3 * MIN, cand: {}, votes: {} };
        town.election.cand[who.uid] = { name: who.name, rep: Math.max(0, Math.min(200, a.rep | 0)) };
        news(town, `🗳️ ${who.name} is running for mayor! Voting closes in 3 minutes.`);
        return { ok: true };
      }
      case 'ballot': {
        if (!town.election || !own(town.election.cand, a.cand)) return fail('No election right now.');
        town.election.votes[who.uid] = a.cand; return { ok: true };
      }
      case 'setTax': {
        if (!town.mayor || town.mayor.uid !== who.uid) return fail('Only the mayor can change taxes.');
        town.taxRate = [5, 10, 15, 20].includes(a.rate) ? a.rate : 10;
        news(town, `📜 Mayor ${who.name} set taxes to ${town.taxRate}%.`);
        return { ok: true };
      }
    }
    return fail('Unknown action.');
  }

  const Town = { X0, X1, H, MIN, BUILDINGS, PLAZA, ROADS, TOWN_FARM, FARM_SPOTS, PLOTS, PLOT_BY_ID, FOREST, PROJECT_SPOTS, GOODS, CROPS, SELLABLE, TAX, RENT, BUILD, PROJECTS,
    RAIL_Y, STATION, DX0, DW, DAY, raining, sellPreview, buyPreview, usual, SELL_MAX, NORM, PLACES, COMPANY_TYPES, district, districtsOf, allPlots, plotById, placesOf, hasPlace, stopsOf, stationsOf, worldRight, growthNeed, grow,
    FARM_REGROW, soilSpot, newTown, settle, act, price, trend, cropState, cropProgress, treeState, forestLeft, project, projectChoices };
  if (typeof module !== 'undefined' && module.exports) module.exports = Town; else root.Town = Town;
})(typeof window !== 'undefined' ? window : globalThis);
