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
    [X0 - 1000, 1760, X1, 1760], [4800, 1000, 4800, 2560], [4330, 1180, 5270, 1180], [4330, 1580, 5270, 1580],
    [4330, 1180, 4330, 1760], [5270, 1180, 5270, 1760], [5520, 760, 5520, 1760], [4560, 760, 5520, 760], [4560, 760, 4560, 1180],
  ];
  const PROJECT_SPOTS = { fountain: { x: 4800, y: 1340 }, park: { x: 5100, y: 2230 }, library: { x: 5330, y: 2010 }, clinic: { x: 5000, y: 2000 }, busTown: { x: 3740, y: 1700 }, busVillage: { x: 560, y: 680 } };

  // land for sale: farms east of the market, building lots in the west and south
  const PLOTS = [];
  [950, 1160, 1370, 1930, 2140, 2350].forEach((y, r) => [5560, 5790].forEach((x, c) => PLOTS.push({ id: `F${r * 2 + c + 1}`, kind: 'farm', x, y, w: 200, h: 165, price: 70 + (r % 3) * 10 + c * 10 })));
  [1000, 1210, 1420].forEach((y, r) => [3700, 3930].forEach((x, c) => PLOTS.push({ id: `L${r * 2 + c + 1}`, kind: 'lot', x, y, w: 200, h: 170, price: 110 + r * 15 + c * 10 })));
  [1900, 2110, 2330].forEach((y, r) => [4290, 4520].forEach((x, c) => PLOTS.push({ id: `L${r * 2 + c + 7}`, kind: 'lot', x, y, w: 200, h: 170, price: 130 + r * 10 + c * 10 })));
  const PLOT_BY_ID = {}; PLOTS.forEach(p => { PLOT_BY_ID[p.id] = p; });
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
  };
  const CROPS = ['wheat', 'carrot', 'tomato', 'corn'];
  const SELLABLE = ['wheat', 'carrot', 'tomato', 'corn', 'log'];
  const NORM = 20;   // how much of each good the market usually has
  const FARM_REGROW = 40 * 1000, TREE_REGROW = 5 * MIN;
  const TAX = { farm: 2, lot: 3 };          // property tax per day
  const RENT = 5;                            // apartment rent per day
  const BUILD = { house: { name: 'House', icon: '🏠', logs: 12, coins: 60 }, shop: { name: 'Shop', icon: '🏪', logs: 18, coins: 110 } };

  const PROJECTS = [
    { id: 'fountain', name: 'Plaza Fountain', icon: '⛲', cost: 60, desc: 'A place to meet friends. The town looks happier.' },
    { id: 'lights', name: 'Street Lights', icon: '💡', cost: 110, desc: 'Bright, safe streets at night.' },
    { id: 'bus', name: 'Bus Line', icon: '🚌', cost: 150, desc: 'A free town bus that drives up and down Main Road.' },
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
    return { v: 1, created: now, at: now, treasury: 40, taxRate: 10, plots: {}, cut: {}, saplings: {}, farm: {},
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
  const trend = (town, g) => { const f = price(town, g) / GOODS[g].base; return f > 1.12 ? 'up' : f < 0.88 ? 'down' : 'same'; };
  function cropState(c, now) {
    if (!c) return 'empty';
    if (!c.w) return 'dry';
    return now - c.w >= GOODS[c.k].grow ? 'ready' : 'growing';
  }
  const cropProgress = (c, now) => (!c || !c.w) ? 0 : clamp((now - c.w) / GOODS[c.k].grow, 0, 1);

  // Time passes: prices settle back, the town collects a little tax from its other citizens,
  // a forester plants trees, elections close and projects get built.
  function settle(town, now) {
    const dt = Math.max(0, now - town.at);
    if (dt > 20 * 1000) {
      const steps = Math.min(60, Math.floor(dt / (30 * 1000)));
      for (let i = 0; i < steps; i++) SELLABLE.forEach(g => { town.stock[g] += (NORM - town.stock[g]) * 0.1; });
      town.at = now;
    }
    const npcTaxes = Math.floor((now - town.lastNpcTax) / (2 * MIN));
    if (npcTaxes > 0) { town.treasury += Math.min(30, npcTaxes * 2); town.lastNpcTax += npcTaxes * 2 * MIN; }
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
      town.justBuilt = { id: pick.id, at: now };
    }
  }

  /* ---------------- actions ---------------- */
  // who = { uid, name }. Returns { ok, msg, gain: { coins, items } } for the player who acted.
  function act(town, a, who, now) {
    settle(town, now);
    const fail = (msg) => ({ ok: false, msg });
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const plot = a.id && own(PLOT_BY_ID, a.id) ? PLOT_BY_ID[a.id] : null, st = plot && own(town.plots, a.id) ? town.plots[a.id] : null;
    if (a.i !== undefined && !(Number.isInteger(a.i) && a.i >= 0 && a.i < 10)) return fail('?');
    const mine = st && st.owner === who.uid;
    switch (a.type) {
      case 'buyPlot': {
        if (!plot) return fail('No such land.');
        if (st && st.owner) return fail(`${st.name} already owns this land.`);
        town.plots[a.id] = { owner: who.uid, name: who.name, build: null, soil: plot.kind === 'farm' ? [null, null, null, null, null, null] : [] };
        news(town, `🏡 ${who.name} bought ${plot.kind === 'farm' ? 'a farm' : 'a lot'} (${a.id}).`);
        return { ok: true, cost: plot.price };
      }
      case 'build': {
        if (!mine) return fail('You can only build on your own land.');
        if (plot.kind !== 'lot' || st.build) return fail('You cannot build here.');
        if (!BUILD[a.kind]) return fail('Build what?');
        st.build = a.kind; st.buildAt = now;
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
        const n = Math.max(1, Math.min(50, a.n | 0));
        if (!SELLABLE.includes(a.g)) return fail('The market does not buy that.');
        let coins = 0; for (let i = 0; i < n; i++) { coins += price(town, a.g); town.stock[a.g] += 1; }
        return { ok: true, coins };
      }
      case 'buyGood': {   // logs from the sawmill
        const n = Math.max(1, Math.min(30, a.n | 0));
        if (a.g !== 'log') return fail('Not for sale.');
        let cost = 0; for (let i = 0; i < n; i++) { cost += price(town, 'log') + 2; town.stock.log = Math.max(0, town.stock.log - 1); }
        return { ok: true, cost };
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
        town.treasury += n; return { ok: true };
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
    FARM_REGROW, soilSpot, newTown, settle, act, price, trend, cropState, cropProgress, treeState, forestLeft, project, projectChoices };
  if (typeof module !== 'undefined' && module.exports) module.exports = Town; else root.Town = Town;
})(typeof window !== 'undefined' ? window : globalThis);
