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

  // home life, right next to where everyone wakes up: the Sunrise Pool (morning swim), a water tap (sunset sip),
  // the Duck Pond for fishing, a ball to kick, and a few nature spots in the old town
  const HOME = { pool: { x: 4000, y: 2420, rx: 150, ry: 85 }, tap: { x: 3790, y: 2310 } };
  const POND = { x: 3590, y: 2060, rx: 110, ry: 70 };
  const BALL = { x: 3690, y: 2440 };
  const OLD_SPOTS = [
    { id: 'old-fish', type: 'fish', x: 3590, y: 2150 },
    { id: 'old-photo', type: 'photo', x: 4620, y: 470 },
    { id: 'old-stars', type: 'stars', x: 4546, y: 1450 },
    { id: 'old-berry', type: 'berry', x: 5090, y: 470 },
  ];
  // every town has a Small World Garden: a little park with the Small World mark in the middle (here: by the plaza)
  const GARDEN0 = { x: 4546, y: 1330, w: 300, h: 190 };
  const inPool = (x, y, pad = 0) => { const u = (x - HOME.pool.x) / (HOME.pool.rx + pad), v = (y - HOME.pool.y) / (HOME.pool.ry + pad); return u * u + v * v < 1; };

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
    // places that belong to one kind of town
    exchange: { name: 'Stock Exchange', icon: '📈', npc: { name: 'Broker Bull', color: '#3e7d22', hat: 'crown' }, wall: '#e9eef5', roof: '#34233f' },
    office: { name: 'Office Tower', icon: '🏢', npc: { name: 'Manager Memo', color: '#5b7cfa', hat: 'beanie' }, wall: '#d6e4f0', roof: '#5b7cfa' },
    gallery: { name: 'Art Gallery', icon: '🖼️', npc: { name: 'Artist Iris', color: '#ff8fb1', hat: 'flower' }, wall: '#fff8e8', roof: '#b98cff' },
    concert: { name: 'Concert Hall', icon: '🎻', npc: { name: 'Maestro Melody', color: '#b98cff', hat: 'bowl' }, wall: '#f3eddd', roof: '#9a3b3b' },
    ranch: { name: 'Sunny Ranch', icon: '🐄', npc: { name: 'Rancher Clover', color: '#9a7b5b', hat: 'bowl' }, wall: '#e4572e', roof: '#fff8e8' },
    orchard: { name: 'Apple Orchard', icon: '🍎', npc: { name: 'Grower Pip', color: '#8cbf5a', hat: 'flower' }, wall: '#ffe2c6', roof: '#8cbf5a' },
    mine: { name: 'Crystal Mine', icon: '⛏️', npc: { name: 'Miner Flint', color: '#6b5a78', hat: 'beanie' }, wall: '#b8aca0', roof: '#6b5a78' },
    lodge: { name: 'Ski Lodge', icon: '🎿', npc: { name: 'Coach Frost', color: '#2fa4b5', hat: 'beanie' }, wall: '#a0673b', roof: '#fff8e8' },
    hotsprings: { name: 'Hot Springs', icon: '♨️', npc: { name: 'Keeper Steam', color: '#ff8fb1', hat: 'flower' }, wall: '#cfc6d8', roof: '#9a7b5b' },
    icecream: { name: 'Ice Cream Stand', icon: '🍦', npc: { name: 'Scoop', color: '#ff8fb1', hat: 'chef' }, wall: '#ffe2ef', roof: '#ff8fb1' },
    lighthouse: { name: 'Lighthouse', icon: '🗼', npc: { name: 'Keeper Beam', color: '#e4572e', hat: 'bowl' }, wall: '#fff8e8', roof: '#e4572e' },
    university: { name: 'University', icon: '🎓', npc: { name: 'Professor Quill', color: '#34233f', hat: 'bowl' }, wall: '#c8664a', roof: '#34233f' },
    castle: { name: 'Castle', icon: '🏰', npc: { name: 'Knight Nutmeg', color: '#8a8f99', hat: 'crown' }, wall: '#cfc6d8', roof: '#5b7cfa' },
    boathouse: { name: 'Boathouse', icon: '🛶', npc: { name: 'Captain Paddle', color: '#2fa4b5', hat: 'bowl' }, wall: '#a0673b', roof: '#2fa4b5' },
    sawmill: { name: 'Sawmill', icon: '🪚', npc: { name: 'Sawyer Oak', color: '#9a7b5b', hat: 'beanie' }, wall: '#c79a64', roof: '#6b4a2f' },
    treehouse: { name: 'Treehouse', icon: '🛖', npc: { name: 'Ranger Fern', color: '#8cbf5a', hat: 'flower' }, wall: '#c79a64', roof: '#5f9e57' },
    observatory: { name: 'Observatory', icon: '🔭', npc: { name: 'Stargazer Luna', color: '#5b7cfa', hat: 'propeller' }, wall: '#f7f1e3', roof: '#8a8f99' },
    mart: { name: 'Local Market', icon: '🛒', npc: { name: 'Shopkeeper', color: '#f4b942', hat: 'chef' }, wall: '#fff3d6', roof: '#e4572e' },
  };
  Object.assign(STATION, PLACES.station);
  // Small Town is the first town of a region that never ends. Each time the region grows, a new town opens
  // to the east, and each town has its own kind: a busy downtown, a fancy uptown, farm valleys, beach towns,
  // mountain towns, a college town, an old town with a castle, lake towns, canyon towns and forest villages.
  const KINDS = {
    downtown: { name: 'Downtown', icon: '🏙️', suffix: 'City', nature: 'lake', pool: ['exchange', 'office', 'hotel', 'cafe', 'arcade'], lot: 1.6, farm: 1.3,
      wants: { wheat: 1.4, carrot: 1.4, tomato: 1.4, corn: 1.4, milk: 1.5, egg: 1.5, apple: 1.4, berry: 1.3, honey: 1.5, mushroom: 1.3 }, blurb: 'Tall towers, busy offices, the stock exchange.' },
    uptown: { name: 'Uptown', icon: '🏛️', suffix: 'Heights', nature: 'meadow', pool: ['gallery', 'concert', 'museum', 'cafe', 'hotel'], lot: 2, farm: 1.5,
      wants: { gem: 1.6, shell: 1.4, fish: 1.3, apple: 1.2, flower: 1.7, honey: 1.3 }, blurb: 'Big houses, gardens, art and music.' },
    rural: { name: 'Farm Valley', icon: '🌾', suffix: 'Farms', nature: 'meadow', pool: ['ranch', 'orchard', 'cafe'], lot: 0.8, farm: 0.7, farms: 8,
      wants: { log: 1.4, ore: 1.4, gem: 1.2, fish: 1.2, coconut: 1.4 }, blurb: 'Barns, cows, apple trees and cheap farmland.' },
    beach: { name: 'Beach Town', icon: '🏖️', suffix: 'Bay', nature: 'beach', pool: ['icecream', 'lighthouse', 'harbor', 'cafe'], lot: 1.2, farm: 1,
      wants: { apple: 1.3, milk: 1.3, egg: 1.3, log: 1.3, corn: 1.2, mushroom: 1.4 }, blurb: 'Sand, surf, ice cream and a lighthouse.' },
    mountain: { name: 'Mountain Town', icon: '⛰️', suffix: 'Peak', nature: 'hills', pool: ['mine', 'lodge', 'hotsprings', 'cafe'], lot: 0.9, farm: 0.9,
      wants: { fish: 1.5, shell: 1.5, tomato: 1.3, berry: 1.2, coconut: 1.6 }, blurb: 'Snowy peaks, a crystal mine, skiing and hot springs.' },
    college: { name: 'College Town', icon: '🎓', suffix: 'College', nature: 'grove', pool: ['university', 'museum', 'stadium', 'cafe'], lot: 1.3, farm: 1,
      wants: { berry: 1.4, apple: 1.3, egg: 1.2, corn: 1.2 }, blurb: 'The university, the big stadium and busy students.' },
    oldtown: { name: 'Old Town', icon: '🏰', suffix: 'Old Town', nature: 'stars', pool: ['castle', 'museum', 'cafe', 'hotel'], lot: 1.4, farm: 1,
      wants: { log: 1.3, gem: 1.3, milk: 1.2 }, blurb: 'A castle, old walls and stories from long ago.' },
    lake: { name: 'Lake Town', icon: '🛶', suffix: 'Lake', nature: 'lake', pool: ['boathouse', 'cafe', 'hotel'], lot: 1.1, farm: 0.9,
      wants: { ore: 1.3, wheat: 1.3, carrot: 1.3, egg: 1.2 }, blurb: 'Cabins, boats and the best fishing.' },
    desert: { name: 'Canyon Town', icon: '🌵', suffix: 'Canyon', nature: 'canyon', pool: ['mine', 'observatory', 'cafe'], lot: 0.7, farm: 0.8,
      wants: { fish: 1.6, apple: 1.5, milk: 1.4, berry: 1.4, tomato: 1.3 }, blurb: 'Red rocks, cactus, a mine and the clearest night sky.' },
    forest: { name: 'Forest Village', icon: '🌲', suffix: 'Woods', nature: 'grove', pool: ['sawmill', 'treehouse', 'cafe'], lot: 0.8, farm: 0.9,
      wants: { fish: 1.3, shell: 1.4, corn: 1.3, milk: 1.2 }, blurb: 'Tall pines, a sawmill and treehouses.' },
  };
  // the first six towns are always the same, then the region keeps going with new towns of every kind
  const FIRST = [
    { kind: 'downtown', name: 'Downtown', land: ['tech', 'exchange', 'biz'] },
    { kind: 'uptown', name: 'Uptown', land: ['studio', 'gallery', 'dealer'] },
    { kind: 'rural', name: 'Green Valley', land: ['ranch', 'orchard', 'cafe'] },
    { kind: 'beach', name: 'Seashell Bay', land: ['airport', 'icecream', 'harbor'] },
    { kind: 'mountain', name: 'Snowcap', land: ['space', 'mine', 'lodge'] },
    { kind: 'college', name: 'College Hill', land: ['university', 'museum', 'stadium'] },
  ];
  const CYCLE = ['downtown', 'rural', 'mountain', 'uptown', 'beach', 'oldtown', 'lake', 'desert', 'forest', 'college'];
  const NATURE_NAME = { lake: 'Blue Lake', hills: 'Sunny Hills', beach: 'Seashell Beach', stars: 'Star Hill', grove: 'Mushroom Grove', meadow: 'Butterfly Meadow', canyon: 'Red Canyon' };
  const NAMES = ['Maple', 'Cedar', 'Willow', 'Pine', 'Birch', 'Aspen', 'Juniper', 'Elm', 'Hazel', 'Rowan', 'Clover', 'Sunny', 'Misty', 'Golden', 'Silver'];
  // what you can gather in some towns (shared: once picked, it regrows for everyone)
  const WORK = { ranch: ['cow', 'cow', 'hen', 'hen'], orchard: ['apple', 'apple', 'apple', 'apple'], mine: ['ore', 'ore', 'ore', 'ore'] };
  const WORK_ITEM = { cow: 'milk', hen: 'egg', apple: 'apple', ore: 'ore' };
  const WORK_REGROW = 45 * 1000;
  // A region from day one: the first towns are open when a town is made, so there is always somewhere to go.
  // After them, growth (taxes, fares, building, projects) opens one more town at a time, forever.
  const START_TOWNS = 6;
  const growthNeed = (k) => { const j = k - START_TOWNS; return j <= 0 ? 0 : 25 + 60 * (j - 1) + 20 * (j - 1) * (j - 1); };   // growth points to open district k
  const dcache = {};
  function district(k) {
    if (dcache[k]) return dcache[k];
    const x0 = DX0 + (k - 1) * DW, f = FIRST[k - 1], r = rng(k * 7717 + 5);
    const kind = f ? f.kind : CYCLE[(k - 7) % CYCLE.length], K = KINDS[kind];
    let land = f ? f.land : null;
    if (!land) { const pool = K.pool.slice(); land = []; while (land.length < 3 && pool.length) land.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); }
    // wide buildings go in the wide slots
    const wide = (t) => ['airport', 'stadium'].includes(t);
    land = land.slice().sort((a, b) => (wide(b) ? 1 : 0) - (wide(a) ? 1 : 0));
    if (land.length === 3 && wide(land[0])) land = [land[0], land[2], land[1]];
    const round = Math.floor((k - 7) / (NAMES.length * 2)), name = f ? f.name : `${NAMES[(k * 7) % NAMES.length]} ${K.suffix}${round ? ' ' + (round + 1) : ''}`;
    const nature = f && k === 1 ? 'lake' : K.nature;
    const mk = (type, x, y, w) => ({ id: type + k, type, x, y, w, ...PLACES[type] });
    const SLOTS = [330, 1640, 700];
    const landmarks = land.map((t, i) => mk(t, x0 + SLOTS[i], 1690, i === 2 ? Math.min(260, type0w(t)) : type0w(t)));
    landmarks.push({ ...mk('mart', x0 + 1260, 1690, 180) });
    const station = { ...mk('station', x0 + 1180, -20, 260), id: 'station' + k };
    const plots = [];
    [1900, 2110].forEach((y, row) => [150, 380, 1100, 1330].forEach((dx, c) => plots.push({ id: `D${k}L${row * 4 + c + 1}`, kind: 'lot', x: x0 + dx, y, w: 200, h: 170, price: Math.round((100 + 10 * k + row * 10 + c * 5) * K.lot) })));
    const FP = [[1150, 880], [1380, 880], [1150, 1090], [1380, 1090], [1150, 670], [1380, 670], [1610, 880], [1610, 1090]].slice(0, K.farms || 4);
    FP.forEach(([dx, y], i) => plots.push({ id: `D${k}F${i + 1}`, kind: 'farm', x: x0 + dx, y, w: 200, h: 165, price: Math.round((70 + 5 * k + (i % 4 >= 2 ? 10 : 0) + (i % 2) * 5) * K.farm) }));
    const roads = [[x0 - 20, 1760, x0 + DW, 1760], [x0 + 1000, -60, x0 + 1000, 2560], [x0 + 1000, 1330, x0 + 1760, 1330]];
    const cx = x0 + 480, cy = 620;
    const SP = {
      lake: [['fish', -250, 230], ['fish', 270, 170], ['photo', 0, -280], ['camp', 330, -210]],
      hills: [['view', 0, 40], ['gem', -260, 200], ['gem', 250, 220], ['photo', 300, -200]],
      beach: [['shell', -250, 240], ['shell', 60, 300], ['swim', 0, 60], ['photo', 300, 260]],
      stars: [['stars', 0, 60], ['photo', -260, 230], ['gem', 280, 240], ['camp', -300, -200]],
      grove: [['berry', -240, 180], ['berry', 240, 200], ['photo', 0, -250], ['camp', 300, -150]],
      meadow: [['photo', -200, 150], ['berry', 220, 220], ['camp', 0, -220], ['view', 280, -60]],
      canyon: [['view', 0, 40], ['gem', -260, 220], ['stars', 260, 200], ['photo', -280, -200]],
    }[nature];
    const spots = SP.map(([type, dx, dy], i) => ({ id: `n${k}.${i}`, type, x: cx + dx, y: cy + dy }));
    // gathering spots in a row in front of the ranch, the orchard and the mine
    const work = [];
    landmarks.forEach(L => (WORK[L.type] || []).forEach((type, i) => work.push({ id: `w${k}.${work.length}`, type, place: L.type, x: L.x - 150 + i * 100, y: 1420 })));
    return (dcache[k] = { k, x0, x1: x0 + DW, name, kind, kindName: K.name, icon: K.icon, blurb: K.blurb, nature, natureName: NATURE_NAME[nature], nat: { x: cx, y: cy }, landmarks, station, plots, roads, spots, work, stop: { x: x0 + 900, y: 1700 }, gate: { x: x0 + 60, y: 1760 }, garden: { x: x0 + 780, y: 2090, w: 300, h: 340 } });
  }
  function type0w(t) { return t === 'airport' ? 360 : t === 'stadium' ? 320 : 280; }
  // which town are you in? (0 = Small Town)
  const districtAt = (town, x) => { const k = Math.floor((x - DX0) / DW) + 1; return k >= 1 && k <= ((town && town.districts) || 0) ? k : 0; };
  // a local market pays more for what its town wants
  const localMult = (k, g) => { if (!k) return 1; const K = KINDS[district(k).kind]; return (K.wants && K.wants[g]) || 1; };
  const workOf = (town) => districtsOf(town).flatMap(d => d.work);
  const workById = (id) => { const m = /^w(\d{1,3})\.(\d{1,2})$/.exec(id || ''); return m ? district(+m[1]).work[+m[2]] || null : null; };

  /* ---------------- the Stock Exchange: three companies, prices that move every day (the same for everyone) ---------------- */
  const STOCKS = {
    bake: { name: 'Sunny Bakery', icon: '🥐', base: 20, trend: 0.004, vol: 0.12, dividend: 1, blurb: 'Steady. Pays 1 coin a day for every 5 shares.' },
    toy: { name: 'Toy Town Co.', icon: '🧸', base: 35, trend: 0.008, vol: 0.25, dividend: 0, blurb: 'Goes up and down more.' },
    rocket: { name: 'Rocket Corp', icon: '🚀', base: 60, trend: 0.015, vol: 0.45, dividend: 0, blurb: 'Can go way up, or way down. Risky!' },
  };
  function stockPrice(town, sym, day) {
    const S = STOCKS[sym]; if (!S) return 0;
    const t = Math.max(0, day - Math.floor((town ? town.created : 0) / DAY)), ph = sym.length * 1.7;
    const h = ((Math.sin((t + 1) * 12.9898 + ph * 78.233) * 43758.5453) % 1 + 1) % 1;   // a little daily noise
    const wobble = 0.6 * Math.sin(t * 0.9 + ph) + 0.4 * Math.sin(t * 2.7 + ph * 2) + (h - 0.5) * 0.4;
    return Math.max(1, Math.round(S.base * (1 + S.trend * t) * (1 + S.vol * wobble)));
  }
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
  const spotsOf = (town) => OLD_SPOTS.concat(districtsOf(town).flatMap(d => d.spots));
  // wonders: rare shared moments. The same time gives the same wonder for everyone in a room.
  const WONDER_WIN = 8 * MIN, WONDER_LEN = 45 * 1000;
  const POTS = [{ x: 4560, y: 1760 }, { x: 5040, y: 1760 }, { x: 4800, y: 2200 }, { x: 5100, y: 760 }];
  function wonderAt(now) {
    const w = Math.floor(now / WONDER_WIN), r = rng(w * 7919 + 101);
    if (r() > 0.55) return null;
    const start = w * WONDER_WIN + r() * (WONDER_WIN - WONDER_LEN);
    if (now < start || now >= start + WONDER_LEN) return null;
    const hour = 6 + ((start % (6 * MIN)) / (6 * MIN)) * 17, pick = r();
    const type = hour >= 19.5 ? 'stars' : pick < 0.5 ? 'rain' : 'rainbow';
    return { id: w, type, start, end: start + WONDER_LEN, pot: POTS[Math.floor(r() * POTS.length)] };
  }
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
    milk: { name: 'Milk', icon: '🥛', base: 8 },
    egg: { name: 'Eggs', icon: '🥚', base: 6 },
    apple: { name: 'Apple', icon: '🍎', base: 6 },
    ore: { name: 'Ore', icon: '🪨', base: 9 },
    // gathered out in the Wild
    mushroom: { name: 'Mushrooms', icon: '🍄', base: 7 },
    coconut: { name: 'Coconut', icon: '🥥', base: 8 },
    flower: { name: 'Wildflowers', icon: '🌸', base: 4 },
    honey: { name: 'Honey', icon: '🍯', base: 12 },
  };
  const CROPS = ['wheat', 'carrot', 'tomato', 'corn'];
  const SELLABLE = ['wheat', 'carrot', 'tomato', 'corn', 'log', 'fish', 'shell', 'gem', 'berry', 'milk', 'egg', 'apple', 'ore', 'mushroom', 'coconut', 'flower', 'honey'];
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
    return { v: 1, created: now, at: now, treasury: 40, growth: 0, districts: START_TOWNS, taxRate: 10, plots: {}, cut: {}, saplings: {}, farm: {},
      stock: Object.fromEntries(SELLABLE.map(g => [g, NORM])), work: {}, built: [], votes: {}, mayor: null, election: null,
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
    if ((town.districts || 0) < START_TOWNS) town.districts = START_TOWNS;   // older saved towns get the region too
    if (!town.work || typeof town.work !== 'object') town.work = {};
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
        const at = Number.isInteger(a.at) && a.at > 0 ? a.at : 0;
        if (at > (town.districts || 0)) return fail('That town is not here yet.');
        const mult = localMult(at, a.g);   // a town that wants this pays more for it
        let coins = 0; const each = [];
        for (let i = 0; i < n; i++) { const p = Math.round(price(town, a.g) * mult); each.push(p); coins += p; town.stock[a.g] += 1; }   // every one sold makes the next a little cheaper
        return { ok: true, coins, each, mult };
      }
      case 'gather': {   // milk a cow, collect eggs, pick an apple, dig ore: it regrows for everyone
        const w = workById(a.spot);
        if (!w || +a.spot.slice(1).split('.')[0] > (town.districts || 0)) return fail('Nothing here.');
        if (now - (town.work[w.id] || 0) < WORK_REGROW) return fail('Not ready yet. It comes back soon.');
        town.work[w.id] = now;
        const item = w.type === 'ore' && rng(now % 100000)() < 0.12 ? 'gem' : WORK_ITEM[w.type];
        return { ok: true, item, type: w.type };
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
    RAIL_Y, STATION, DX0, DW, DAY, GARDEN0, START_TOWNS, KINDS, CYCLE, WORK_ITEM, WORK_REGROW, STOCKS, stockPrice, districtAt, localMult, workOf, workById, raining, sellPreview, buyPreview, usual, SELL_MAX, NORM, HOME, POND, BALL, OLD_SPOTS, inPool, spotsOf, wonderAt, POTS, rng, PLACES, COMPANY_TYPES, district, districtsOf, allPlots, plotById, placesOf, hasPlace, stopsOf, stationsOf, worldRight, growthNeed, grow,
    FARM_REGROW, soilSpot, newTown, settle, act, price, trend, cropState, cropProgress, treeState, forestLeft, project, projectChoices };
  if (typeof module !== 'undefined' && module.exports) module.exports = Town; else root.Town = Town;
})(typeof window !== 'undefined' ? window : globalThis);
