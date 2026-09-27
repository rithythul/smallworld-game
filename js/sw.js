// Small World: the game. You live in Small Town: work, learn, save, buy land, farm, build, vote, travel and chase a dream.
// The 3D town is drawn by js/world3d.js (window.World). The town's rules are in js/town.js, your life's rules in js/life.js.
// Design rule: pictures first, as few words as possible. One big button does whatever is right in front of you.
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'small-world-v1';
  const COLORS = ['#2fa4b5', '#e4572e', '#8cbf5a', '#b98cff', '#f4b942', '#ff8fb1', '#5b7cfa', '#9a7b5b'];
  const G = Town.GOODS;
  const coin = (n) => `${n}🪙`;
  const BAND_NAMES = { 1: '6–8', 2: '9–12', 3: '13–16' };
  // what each keeper says when you walk up: short
  const HELLO = {
    hall: 'Vote! Taxes build the town.', bank: 'Save coins. They grow!', market: 'I buy crops, fish and logs.',
    school: 'Learn → better jobs.', jobs: 'Want a job?', rent: 'Rent, or build your own home.',
    station: 'All aboard! 🚆', tech: 'Sell online, code, make ads.', biz: 'Start a company!', studio: 'Make videos 🎬',
    dealer: 'Bikes, cars, planes!', airport: 'Fly away on a trip ✈️', harbor: 'Boat to the island ⛵', space: 'Train for space 🚀',
    stadium: 'Score goals on the field ⚽', museum: 'Dinosaurs inside! 🦕', zoo: 'Come see the animals', cafe: 'Hot cocoa? ☕',
    arcade: 'Beat the high score 🕹️', hotel: 'Stay the night 🏨',
  };

  /* ---------------- saved state ---------------- */
  let S = null;
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  const newUid = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  const me = Object.assign({ uid: newUid(), name: '', color: COLORS[0], band: 2 }, S && S.me);
  let life = S && S.life ? Life.repair(S.life) : null;
  let solo = S && S.solo && S.solo.v === 1 ? S.solo : null;
  let pos = S && S.pos;
  let dirty = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ me, life, solo, pos: World.trip ? pos : (World.pos ? World.pos() : pos), lastRoom: S && S.lastRoom })); } catch (e) {}
    dirty = false;
  }
  const touch = () => { dirty = true; };
  setInterval(() => { if (dirty) save(); }, 4000);
  addEventListener('pagehide', () => { if (life) save(); });

  /* ---------------- the town (yours alone, or the room's) ---------------- */
  let town = null, playing = false;
  const online = () => Net.active;
  const now = () => (online() ? Net.now() : Date.now());
  const who = () => ({ uid: me.uid, name: me.name });
  async function act(a) {
    if (online()) return Net.townAct(a);
    const res = Town.act(solo, a, who(), Date.now());
    if (res.ok) { onTown(solo); touch(); }
    return res;
  }
  let builtSeen = null, mayorSeen = null, newsSeen = null, districtsSeen = null;
  function onTown(t) {
    const first = builtSeen === null;
    town = t;
    World.setTown(t);
    if (builtSeen !== null && t.built.length > builtSeen) {
      t.built.slice(builtSeen).forEach(id => {
        const p = Town.project(id); if (!p) return;
        toast(`<span class="t-small">🎉 New!</span>${p.icon} ${esc(p.name)}`, { big: true, life: 4 });
        Sound.chord(5, 'bell');
        if (/^festival/.test(id)) { World.celebrate(40); Life.earn(life, 5, 'gifts', '🎆', 'Festival gift from the town'); }
      });
    }
    builtSeen = t.built.length;
    if (districtsSeen !== null && (t.districts || 0) > districtsSeen) {
      const d = Town.district(t.districts);
      toast(`<span class="t-small">🏙️ The town grew!</span>${d.landmarks.map(l => l.icon).join(' ')} ${esc(d.name)} →`, { big: true, life: 6 });
      Sound.chord(8, 'bell'); World.celebrate(6); fact('grow');
    }
    districtsSeen = t.districts || 0;
    if (t.mayor && t.mayor.uid === me.uid && mayorSeen !== t.mayor.since) {
      if (!first) { life.stats.won++; Life.remember(life, 'mayor'); toast('<span class="t-small">🗳️ You won!</span>👑 Mayor', { big: true, life: 6 }); Sound.chord(7, 'bell'); World.celebrate(8); }
      else if (!life.stats.won) life.stats.won = 1;
    }
    mayorSeen = t.mayor ? t.mayor.since : 0;
    if (newsSeen !== null && t.news[0] && t.news[0] !== newsSeen && !t.news[0].includes(me.name + ' ')) toast(`📰 ${esc(t.news[0])}`, { life: 4 });
    newsSeen = t.news[0] || '';
    checkDream(); hud();
  }
  // solo towns keep living too
  setInterval(() => {
    if (!playing || online() || !solo) return;
    const before = JSON.stringify(solo);
    Town.settle(solo, Date.now());
    if (JSON.stringify(solo) !== before) { onTown(solo); touch(); }
  }, 10000);

  /* ---------------- little UI helpers ---------------- */
  function toast(html, { big = false, life: secs = 3 } = {}) {
    const box = $('toasts'), el = document.createElement('div');
    el.className = 'toast' + (big ? ' big' : ''); el.style.setProperty('--life', secs + 's');
    el.innerHTML = `<div>${html}</div>`;
    if ([...box.children].some(c => c.textContent === el.textContent)) return;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), (secs + 0.5) * 1000);
  }
  let sheetOnClose = null;
  function sheet(title, render, onClose) {
    $('sheetTitle').textContent = title;
    const body = $('sheetBody'); body.innerHTML = '';
    render(body);
    $('sheet').hidden = false; body.scrollTop = 0;
    sheetOnClose = onClose || null;
  }
  function closeSheet() {
    if ($('sheet').hidden) return;
    $('sheet').hidden = true;
    const f = sheetOnClose; sheetOnClose = null; if (f) f();
    setTimeout(flushQueue, 300);
  }
  $('sheetClose').addEventListener('click', () => { Sound.blip(); closeSheet(); });
  $('sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });
  const busy = () => !playing || !$('sheet').hidden || !$('title').hidden || Care.locked || World.riding || (Talk.open && document.activeElement && document.activeElement.id === 'chatInput');
  const queue = [];
  function later(fn) { if ($('sheet').hidden && playing && !World.riding) fn(); else queue.push(fn); }
  function flushQueue() { if ($('sheet').hidden && queue.length && !World.riding) queue.shift()(); }
  function button(text, onClick, cls = 'choice', disabled = false) {
    const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.innerHTML = text; b.disabled = disabled;
    b.addEventListener('click', () => { Sound.blip(); onClick(b); });
    return b;
  }
  const row = (...kids) => { const d = document.createElement('div'); d.className = 'sw-row'; kids.forEach(k => k && d.append(k)); return d; };
  function card(html, cls = '') { const d = document.createElement('div'); d.className = 'clue ' + cls; d.innerHTML = html; return d; }
  // a picture tile: big icon, a number or two words, an optional badge. Tapping does the obvious thing.
  function tile(icon, main, sub, onClick, { disabled = false, badge = '', on = false, cls = '' } = {}) {
    const b = document.createElement('button'); b.type = 'button'; b.className = `tile ${on ? 'on' : ''} ${cls}`; b.disabled = disabled;
    b.innerHTML = `<span class="tile-i">${icon}</span>${main !== '' ? `<b>${main}</b>` : ''}${sub ? `<small>${sub}</small>` : ''}${badge ? `<span class="tile-badge">${badge}</span>` : ''}`;
    if (onClick) b.addEventListener('click', () => { Sound.blip(); onClick(b); });
    return b;
  }
  const tiles = (...kids) => { const d = document.createElement('div'); d.className = 'tiles'; kids.flat().forEach(k => k && d.append(k)); return d; };
  const note = (body, html) => body.insertAdjacentHTML('beforeend', `<p class="sw-msg">${html}</p>`);
  function quiz(title, questions, onDone) {
    let i = 0, score = 0;
    if (typeof Music !== 'undefined') Music.duck(true);
    const show = () => sheet(title, (body) => {
      const q = questions[i], sub = SUBJECTS[q.s] || { icon: '❓', name: '' };
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">${sub.icon} ${'●'.repeat(i + 1)}${'○'.repeat(questions.length - i - 1)}</p><h3 class="quiz-q">${esc(q.q)}</h3>`);
      const box = document.createElement('div'); box.className = 'quiz-opts';
      q.o.forEach((opt, k) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'quiz-opt'; b.textContent = opt;
        b.addEventListener('click', () => {
          const right = k === q.a; if (right) score++;
          right ? Sound.discover() : Sound.wrong();
          box.querySelectorAll('button').forEach((x, j) => { x.disabled = true; if (j === q.a) x.classList.add('right'); else if (j === k) x.classList.add('wrong'); });
          body.insertAdjacentHTML('beforeend', `<p class="quiz-why ${right ? 'ok' : ''}">${right ? '✓ ' : '💡 '}${esc(q.why)}</p>`);
          body.appendChild(button(i < questions.length - 1 ? '→' : '✓', () => { i++; if (i < questions.length) show(); else { sheetOnClose = null; closeSheet(); if (typeof Music !== 'undefined') Music.duck(false); onDone(score); } }, 'big-btn small'));
        });
        box.appendChild(b);
      });
      body.appendChild(box);
    }, () => { if (typeof Music !== 'undefined') Music.duck(false); onDone(null); });
    show();
  }
  // science and life snacks: a short fact the first time something happens
  function fact(trigger) {
    if (!life) return;
    const list = (typeof FACT_BY_TRIGGER !== 'undefined' && FACT_BY_TRIGGER[trigger]) || [];
    const f = list.find(x => !life.seen['f:' + x.id]); if (!f) return;
    life.seen['f:' + f.id] = 1; touch();
    facts.push(f); if (facts.length === 1) nextFact();
  }
  // one fact at a time, so there is time to read each one
  const facts = [];
  function nextFact() {
    const f = facts[0]; if (!f) return;
    later(() => { toast(`<span class="t-small">💡 ${esc(f.title)}</span>${esc(f.text)}`, { life: 6 }); setTimeout(() => { facts.shift(); nextFact(); }, 7000); });
  }
  function memory(id) {
    if (!Life.remember(life, id)) return;
    const [icon, name] = Life.MEMORIES[id];
    toast(`<span class="t-small">📸 New memory · ⭐ +5</span>${icon} ${esc(name)}`, { big: true, life: 4 });
    Sound.chord(3, 'bell'); touch(); checkDream();
  }

  /* ---------------- receipts: every coin change says why, right next to your coins ---------------- */
  const needCoins = (n) => `⚠️ You need ${n}🪙 and you have ${life.coins}🪙.`;
  const sign = (n) => (n > 0 ? '+' : '−') + Math.abs(n);
  let seenLog = null, lastCoins = null;
  const ACCT = { bank: '🐷 savings', loan: '💸 you owe' };
  // owing more is bad news (red), owing less is good news (green)
  const good = (e) => e.acct === 'loan' ? e.n < 0 : e.n > 0;
  const amt = (e) => e.acct === 'loan' ? `${sign(e.n)}🪙 owed` : `${sign(e.n)}🪙`;
  function receipts() {
    if (!life) return;
    if (seenLog === null) { seenLog = life.logSeq; lastCoins = life.coins; return; }
    const fresh = life.log.filter(e => e.id > seenLog).reverse();
    // safety net: coins changed without a reason written down (should never happen)
    const delta = life.coins - lastCoins, explained = fresh.filter(e => e.acct === 'pocket').reduce((a, e) => a + e.n, 0);
    if (delta !== explained) { console.warn('[money] unexplained change', delta - explained); const e = Life.note(life, 'pocket', delta - explained, '🪙', delta - explained > 0 ? 'Coins added' : 'Coins used'); if (e) fresh.push(e); }
    lastCoins = life.coins; seenLog = life.logSeq;
    const show = fresh.filter(e => !(e.acct !== 'pocket' && e.move));   // the pocket side of a move is enough
    if (!show.length) return;
    const box = $('receipts');
    const morning = show.filter(e => e.morning);
    const chip = (html, neg) => {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'receipt' + (neg ? ' neg' : ''); el.innerHTML = html;
      el.addEventListener('click', () => { Sound.blip(); moneySheet(); });
      box.appendChild(el); while (box.children.length > 4) box.firstChild.remove();
      setTimeout(() => el.classList.add('out'), neg ? 6500 : 4000); setTimeout(() => el.remove(), neg ? 7000 : 4500);
    };
    if (morning.length > 2) {   // the morning budget sheet explains these; one summary chip here
      const net = morning.filter(e => e.acct === 'pocket').reduce((a, e) => a + e.n, 0);
      chip(`☀️ Morning bills & income: <b class="${net < 0 ? 'neg' : 'pos'}">${sign(net)}🪙</b><small>Tap to see why</small>`, net < 0);
    }
    show.filter(e => !(morning.length > 2 && e.morning)).slice(-5).forEach(e => chip(
      `<b class="${good(e) ? 'pos' : 'neg'}">${amt(e)}</b> ${e.icon} ${esc(e.why)}${e.acct === 'bank' ? ` <em>${ACCT.bank}</em>` : ''}${!good(e) && e.how ? `<small>${esc(e.how)}</small>` : ''}`, !good(e)));
    if (delta) { const pill = $('coinPill'); pill.classList.remove('up', 'down'); void pill.offsetWidth; pill.classList.add(delta < 0 ? 'down' : 'up'); }
  }
  function moneySheet() {
    sheet('👛 Money history', (body) => {
      body.insertAdjacentHTML('beforeend', money());
      const today = life.today;
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Today: earned <b class="pos">${coin(today.earned)}</b> · spent <b class="neg">${coin(today.spent)}</b> · income tax <b>${coin(today.tax)}</b></p>`);
      if (!life.log.length) { note(body, 'Nothing yet. Every coin you earn or spend will be listed here, with the reason.'); return; }
      const list = document.createElement('div'); list.className = 'ledger';
      let lastDay;
      life.log.forEach(e => {
        if (e.day !== lastDay) { lastDay = e.day; list.insertAdjacentHTML('beforeend', `<h4 class="sub-h">📅 Day ${Math.max(1, (e.day || 0) - (life.firstDay || e.day || 0) + 1)}</h4>`); }
        list.insertAdjacentHTML('beforeend', `<div class="led ${good(e) ? 'pos' : 'neg'}"><span class="led-i">${e.icon}</span><span class="led-t"><b>${esc(e.why)}</b>${e.acct === 'bank' ? ` <em>${ACCT.bank}</em>` : ''}${e.how ? `<small>${esc(e.how)}</small>` : ''}</span><b class="led-n">${amt(e)}</b></div>`);
      });
      body.append(list);
    });
  }

  /* ---------------- HUD ---------------- */
  const set = (id, text) => { const el = $(id); if (el && el.textContent !== text) el.textContent = text; };
  function hud() {
    if (!life) return;
    const t = now(), h = Life.hourOf(t), rain = Town.raining(t);
    const icon = rain ? '🌧️' : h < 7 ? '🌅' : h < 18 ? '☀️' : h < 20 ? '🌇' : '🌙';
    const day = Life.dayOf(t) - (life.firstDay || Life.dayOf(t)) + 1;
    set('clockIcon', icon); set('clockDay', `Day ${day} · `); set('clockText', Life.clock(t));
    set('coinText', String(life.coins));
    receipts();
    set('bagText', String(Life.bagCount(life)));
    const g = Life.dreamGoal(life), where = g && placeFor(g.at);
    set('goalText', g ? `${where && where.grow ? '🏙️ ' : ''}${g.icon} ${g.text}` : '✨ Pick a dream');
    const sh = life.shift ? Life.JOBS[life.shift.job] : null;
    $('shiftPill').hidden = !sh;
    if (sh) set('shiftText', `${sh.icon} ${'●'.repeat(life.shift.done)}${'○'.repeat(life.shift.need - life.shift.done)}`);
    $('roomPill').hidden = !online();
    if (online()) set('roomText', `${Net.code} · ${Net.others.size + 1} 👥`);
    const owned = Object.keys(life.vehicles);
    $('rideBtn').hidden = !owned.length || !!World.trip;
    if (owned.length) set('rideBtn', World.vehicle ? '🚶' : Life.VEHICLES[bestVehicle()].icon);
  }
  const bestVehicle = () => ['plane', 'car', 'scooter', 'bike'].find(v => life.vehicles[v]);

  /* ---------------- where things are ---------------- */
  const places = () => Town.placesOf(town);
  const keeper = (id) => World.keepers.find(k => k.id === id);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const plotCenter = (p) => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 });
  const myPlots = () => Life.ownedPlots(town, me.uid);
  const insidePlot = (p, q, pad = 20) => q.x > p.x - pad && q.x < p.x + p.w + pad && q.y > p.y - pad && q.y < p.y + p.h + pad + 25;
  const nearest = (list, p) => list.slice().sort((a, b) => dist(p, a) - dist(p, b))[0];
  const spotsNow = () => World.trip ? World.tripSpots(World.trip) : Town.districtsOf(town).flatMap(d => d.spots);
  // Where should the guide arrow point for this goal? Places not built yet point to the Town Hall: help the town grow!
  function placeFor(at) {
    if (!at || !town) return null;
    const p = World.pos ? World.pos() : { x: 4800, y: 1500 }, t = now();
    const hall = () => { const k = keeper('hall'); return k && { x: k.x, y: k.y, h: 13, grow: true }; };
    const K = (type) => { const k = nearest(World.keepers.filter(q => q.type === type), p); return k ? { x: k.x, y: k.y, h: 13 } : null; };
    if (['jobs', 'bank', 'market', 'school', 'hall', 'rent'].includes(at)) return K(at);
    if (['tech', 'biz', 'studio', 'dealer', 'airport', 'harbor', 'space', 'station'].includes(at)) return K(at) || hall();
    if (at === 'tree' || at === 'stump') { const tr = nearest(Town.FOREST.filter(x => Town.treeState(town, x.id, t) === at), p); return tr ? { x: tr.x, y: tr.y, h: at === 'tree' ? 12 : 5 } : null; }
    if (at === 'farmland' || at === 'lot') { const f = nearest(Town.allPlots(town).filter(pl => pl.kind === (at === 'lot' ? 'lot' : 'farm') && !(town.plots[pl.id] && town.plots[pl.id].owner)).map(pl => ({ ...plotCenter(pl), id: pl.id })), p); return f ? { ...f, h: 8 } : null; }
    if (at === 'myfarm' || at === 'mylot') { const m = myPlots().find(q => q.plot.kind === (at === 'mylot' ? 'lot' : 'farm')); return m ? { ...plotCenter(m.plot), h: 9 } : placeFor(at === 'mylot' ? 'lot' : 'farmland'); }
    if (at === 'nature' || at.startsWith('spot:')) {
      const type = at.split(':')[1], list = Town.districtsOf(town).flatMap(d => d.spots).filter(s => !type || s.type === type);
      const s = nearest(list, p); return s ? { x: s.x, y: s.y, h: 8 } : hall();
    }
    if (at === 'stop') { if (World.busOn) { const s = nearest(Town.stopsOf(town), p); return { x: s.x, y: s.y, h: 10 }; } return K('station'); }
    return null;
  }

  /* ---------------- what you can do right here ---------------- */
  let target = null;
  function findTarget() {
    const p = World.pos(), t = now(), cands = [];
    const add = (c, d, pri = 0) => cands.push({ ...c, d: d - pri });
    const sh = life.shift, job = sh && sh.job;
    // on a trip: only the island
    if (World.trip) {
      World.tripSpots(World.trip).forEach(s => { const d = dist(p, s); if (d < 60) add(spotAction(s), d); });
      cands.sort((a, b) => a.d - b.d); return cands[0] || null;
    }
    // the people who look after places
    World.keepers.forEach(k => {
      const d = dist(p, k); if (d > 75) return;
      const desk = sh && Life.DESK_JOBS[job] && Life.JOBS[job].place === k.type;
      if (desk) add({ key: 'desk:' + k.id, label: 'Work', icon: '💼', cls: 'work', run: () => deskTask(k.id) }, d, 30);
      else add({ key: 'npc:' + k.id, label: k.name.split(' ').slice(-1)[0], icon: (places().find(q => q.id === k.id) || {}).icon || '👋', cls: 'talk', run: () => openPlace(k.type, k.id) }, d);
    });
    if (job === 'mail') sh.targets.forEach(id => { const b = places().find(q => q.id === id); if (!b) return; const q = { x: b.x, y: b.y - 5 }, d = dist(p, q); if (d < 70) add({ key: 'mail:' + id, label: 'Deliver', icon: '✉️', cls: 'work', run: () => deliver(id) }, d, 40); });
    if (job === 'builder') sh.targets.forEach(id => { const pl = Town.plotById(id); if (!pl) return; const d = dist(p, plotCenter(pl)); if (d < 90) add({ key: 'frame:' + id, label: 'Hammer', icon: '🔨', cls: 'work', run: () => hammer(id) }, d, 40); });
    // bus stops
    if (World.busOn) Town.stopsOf(town).forEach(s => { const d = dist(p, s); if (d < 70) add({ key: 'bus:' + s.id, label: `Ride · ${coin(Life.FARES.bus)}`, icon: '🚌', cls: 'buy', run: () => stopSheet(s) }, d); });
    // land
    Town.allPlots(town).forEach(pl => {
      if (!insidePlot(pl, p)) return;
      const st = town.plots[pl.id], mine = st && st.owner === me.uid;
      if (!st || !st.owner) { add({ key: 'buy:' + pl.id, label: coin(pl.price), icon: '🏡', cls: 'buy', run: () => buyLand(pl) }, 60); return; }
      if (!mine) { add({ key: 'look:' + pl.id, label: st.name, icon: '👀', cls: 'look idle', run: () => toast(`🏡 ${esc(st.name)}`) }, 80); return; }
      if (pl.kind === 'farm') {
        for (let i = 0; i < 6; i++) {
          const s = Town.soilSpot(pl, i), d = dist(p, s); if (d > 48) continue;
          const c = st.soil[i], state = Town.cropState(c, t);
          if (state === 'empty') add({ key: `plant:${pl.id}:${i}`, label: 'Plant', icon: '🌱', cls: 'buy', run: () => plantPicker(pl.id, i) }, d);
          else if (state === 'dry') add({ key: `water:${pl.id}:${i}`, label: 'Water', icon: '💧', cls: 'water', run: () => water(pl.id, i) }, d);
          else if (state === 'ready') add({ key: `harvest:${pl.id}:${i}`, label: 'Harvest', icon: G[c.k].icon, cls: 'work', run: () => harvest(pl.id, i) }, d);
          else add({ key: `grow:${pl.id}:${i}`, label: `${Math.round(Town.cropProgress(c, t) * 100)}%`, icon: G[c.k].icon, cls: 'look idle', run: () => toast(`${G[c.k].icon} ⏳`) }, d + 5);
        }
      } else if (!st.build) add({ key: 'build:' + pl.id, label: 'Build', icon: '🔨', cls: 'buy', run: () => buildPicker(pl.id) }, 50);
      else if (st.build === 'shop') add({ key: 'shelf:' + pl.id, label: 'Shelf', icon: '🏪', cls: 'buy', run: () => shelfSheet() }, 50);
      else if (st.build === 'company') add({ key: 'co:' + pl.id, label: 'Company', icon: '🏭', cls: 'buy', run: () => bizSheet() }, 50);
      else add({ key: 'home:' + pl.id, label: 'Home', icon: st.build === 'villa' ? '🏡' : '🏠', cls: 'look idle', run: () => { memory('house'); toast('🏠 ❤️'); } }, 60);
    });
    // the forest
    Town.FOREST.forEach(tr => {
      const d = dist(p, tr); if (d > 52) return;
      const state = Town.treeState(town, tr.id, t);
      if (state === 'tree') add({ key: 'chop:' + tr.id, label: 'Chop', icon: '🪓', cls: 'work', run: () => chop(tr) }, d, job === 'lumberjack' ? 20 : 0);
      else if (state === 'stump') add({ key: 'sap:' + tr.id, label: 'Plant', icon: '🌱', cls: 'buy', run: () => replant(tr) }, d, life.owesSapling ? 25 : 0);
      else add({ key: 'kid:' + tr.id, label: '⏳', icon: '🌱', cls: 'look idle', run: () => toast('🌱 ⏳ 🌳') }, d + 5);
    });
    // the town farm
    Town.FARM_SPOTS.forEach((s, i) => {
      const d = dist(p, s); if (d > 48) return;
      if (t - (town.farm[i] || 0) >= Town.FARM_REGROW) add({ key: 'farm:' + i, label: 'Pick', icon: G[Town.CROPS[i % 4]].icon, cls: 'work', run: () => farmwork(i) }, d, job === 'farmhand' ? 20 : 0);
    });
    // nature
    spotsNow().forEach(s => { const d = dist(p, s); if (d < 60) add(spotAction(s), d, job === 'ranger' ? 20 : 0); });
    cands.sort((a, b) => a.d - b.d);
    return cands[0] || null;
  }
  function renderAction() {
    const btn = $('action');
    if (!target || busy()) { btn.hidden = true; return; }
    btn.hidden = false;
    const html = `<span class="act-icon">${target.icon}</span><span>${esc(target.label)}</span>`;
    if (btn.dataset.key !== target.key || btn.dataset.html !== html) { btn.dataset.key = target.key; btn.dataset.html = html; $('actionLabel').innerHTML = html; btn.className = target.cls || ''; btn.classList.add('pop'); }
  }
  function doAction() {
    if (!target || busy()) return false;
    Sound.init(); startMusic();
    target.run(); return true;
  }
  $('action').addEventListener('click', () => doAction());
  $('action').addEventListener('pointerdown', (e) => e.stopPropagation());

  /* ---------------- dreams and the guide ---------------- */
  function checkDream() {
    if (!life || !life.dream || !town) return;
    const done = Life.checkDream(life, { plots: myPlots() });
    done.forEach(text => later(() => {
      Sound.chord(4, 'bell'); World.burst(World.pos().x, World.pos().y, 'confetti', 30, 6); World.mood('love', 2);
      const g = Life.dreamGoal(life);
      toast(`<span class="t-small">⭐ ${esc(Life.title(life))}</span>✓ ${esc(text)}${g ? `<br>→ ${g.icon} ${esc(g.text)}` : ''}`, { big: true, life: 4 });
    }));
    if (done.length) touch();
  }
  let guide = null, mapMarks = [];
  function markers() {
    const list = [], sh = life.shift, t = now();
    let arrow = null;
    if (World.trip) {
      const home = World.tripSpots(World.trip).find(s => s.type === 'home');
      const todo = World.tripSpots(World.trip).filter(s => s.type !== 'home' && !(life.spotAt[s.id] && t - life.spotAt[s.id] < 90000));
      todo.forEach(s => list.push({ x: s.x, y: s.y, h: 8 }));
      arrow = todo[0] ? { ...nearest(todo, World.pos()), icon: '📸' } : home && { ...home, icon: '✈️' };
    } else if (sh) {
      const job = sh.job;
      if (job === 'mail') sh.targets.forEach(id => { const b = places().find(q => q.id === id); if (b) list.push({ x: b.x, y: b.y - 5, h: 10 }); });
      if (job === 'builder') sh.targets.forEach(id => { const pl = Town.plotById(id); if (pl) list.push({ ...plotCenter(pl), h: 9 }); });
      if (Life.DESK_JOBS[job]) { const k = nearest(World.keepers.filter(q => q.type === Life.JOBS[job].place), World.pos()); if (k) list.push({ x: k.x, y: k.y, h: 13 }); }
      if (job === 'farmhand') Town.FARM_SPOTS.forEach((s, i) => { if (t - (town.farm[i] || 0) >= Town.FARM_REGROW) list.push({ ...s, h: 7 }); });
      if (job === 'ranger') { const done = sh.targets || []; spotsNow().filter(s => !done.includes(s.id)).slice(0, 4).forEach(s => list.push({ x: s.x, y: s.y, h: 8 })); }
      if (job === 'lumberjack') {
        const want = life.owesSapling ? 'stump' : 'tree';
        Town.FOREST.filter(tr => Town.treeState(town, tr.id, t) === want).sort((a, b) => dist(World.pos(), a) - dist(World.pos(), b)).slice(0, 3).forEach(tr => list.push({ x: tr.x, y: tr.y, h: want === 'tree' ? 12 : 5 }));
      }
      if (list.length) arrow = { ...nearest(list, World.pos()), icon: Life.JOBS[job].icon };
    } else if (guide) { list.push({ x: guide.x, y: guide.y, h: guide.h || 12 }); arrow = { ...guide, icon: guide.icon || '📍' }; }
    else if (life.owesSapling) { const w = placeFor('stump'); if (w) { list.push(w); arrow = { ...w, icon: '🌱' }; } }
    else { const g = Life.dreamGoal(life), w = g && placeFor(g.at); if (w) { list.push(w); arrow = { ...w, icon: w.grow ? '🏙️' : g.icon }; } }
    World.markers(list); World.guide(arrow);
    mapMarks = list;
  }

  /* ---------------- the places ---------------- */
  function openPlace(type, id) {
    Sound.pop(); World.npcMood(id, 'love', 1.5);
    const fn = ({ bank: bankSheet, market: marketSheet, school: schoolSheet, jobs: jobsSheet, hall: hallSheet, rent: rentSheet, station: stationSheet,
      tech: techSheet, biz: bizSheet, studio: studioSheet, dealer: dealerSheet, airport: airportSheet, harbor: harborSheet, space: spaceSheet, stadium: stadiumSheet })[type];
    if (fn) fn(); else funSheet(type);
  }
  const placeInfo = (type) => (places().find(p => (p.type || p.id) === type) || Town.PLACES[type] || {});
  const head = (type, text) => { const P = placeInfo(type); return `<div class="keeper"><span class="keeper-icon">${P.icon || '👋'}</span><div><b>${esc((P.npc || {}).name || '')}</b><p>${text}</p></div></div>`; };
  const money = () => `<div class="wallet"><span>👛 <b>${coin(life.coins)}</b></span><span>🐷 <b>${coin(life.bank)}</b></span>${life.loan ? `<span class="owe">💸 <b>${coin(life.loan)}</b></span>` : ''}</div>`;

  function bankSheet(msg = '') {
    const owned = myPlots().length, lim = Life.loanLimit(life, owned);
    sheet('🏦 Bank', (body) => {
      body.insertAdjacentHTML('beforeend', head('bank', 'Saved coins grow <b>+2%</b> every morning. Loans grow <b>+5%</b>.') + money());
      if (msg) note(body, msg);
      const doIt = (what, n, ok) => { const r = Life.bank(life, what, n, owned); if (!r.ok) return bankSheet(`⚠️ ${r.why}`); Sound.cash(); touch(); hud(); checkDream(); if (what === 'deposit') fact('interest'); if (what === 'borrow') fact('loan'); bankSheet(ok); };
      const grow = life.bank >= 10 ? Math.max(1, Math.floor(life.bank * Life.SAVE_RATE / 100)) : 0;
      body.append(card(`<h3>🐷 ${coin(life.bank)} <small class="pos">📈 +${grow} tomorrow</small></h3>`));
      body.lastChild.append(row(
        button('+10', () => doIt('deposit', 10, '✓ 🐷 +10'), 'choice', life.coins < 10),
        button('+½', () => doIt('deposit', Math.floor(life.coins / 2), '✓ 🐷'), 'choice', life.coins < 2),
        button('−10', () => doIt('withdraw', 10, '✓ 👛 +10'), 'choice alt', life.bank < 10),
        button('−all', () => doIt('withdraw', life.bank, '✓ 👛'), 'choice alt', !life.bank)));
      body.append(card(`<h3>💸 ${coin(life.loan)} <small class="neg">📉 +${life.loan ? Math.max(1, Math.ceil(life.loan * Life.LOAN_RATE / 100)) : 0} tomorrow</small></h3><p class="small">Max ${coin(lim)}</p>`));
      body.lastChild.append(row(
        button('+20', () => doIt('borrow', 20, '✓ 💸 +20'), 'choice alt', life.loan + 20 > lim),
        button('+50', () => doIt('borrow', 50, '✓ 💸 +50'), 'choice alt', life.loan + 50 > lim),
        button('Pay 10', () => doIt('repay', 10, '✓'), 'choice', !life.loan || life.coins < Math.min(10, life.loan)),
        button('Pay all', () => doIt('repay', Math.min(life.loan, life.coins), life.coins >= life.loan ? '🎉 0 💸' : '✓'), 'choice', !life.loan || !life.coins)));
    });
  }

  function marketSheet(msg = '') {
    sheet('🧺 Market', (body) => {
      body.insertAdjacentHTML('beforeend', head('market', 'Many sellers → price ▼. Few → price ▲.') + money());
      if (msg) note(body, msg);
      const sell = async (g, n) => {
        if ((life.bag[g] || 0) < n || !n) return;
        const shownPrice = Town.price(town, g);
        const res = await act({ type: 'sell', g, n });
        if (!res.ok) return marketSheet(`⚠️ ${esc(res.msg)}`);
        const each = res.each || [], dropped = each.length > 1 && each[each.length - 1] < each[0], sniped = each[0] < shownPrice;
        const how = [each.length > 1 ? `${each.join(' + ')} = ${res.coins}.` : '', dropped ? 'Each one you sold made the next one a bit cheaper (more supply → lower price).' : '', sniped ? 'Someone sold before you, so the price dropped.' : ''].filter(Boolean).join(' ');
        Life.takeItem(life, g, n); Life.earn(life, res.coins, 'soldCoins', G[g].icon, `Sold ${n} ${G[g].name.toLowerCase()} at the market`, how); life.stats.sold += n;
        Sound.cash(); World.burst(World.pos().x, World.pos().y, 'coins', 10, 6); touch(); hud(); checkDream(); fact('supply'); if (G[g].seed) fact('profit');
        marketSheet(`✓ ${G[g].icon}×${n} → +${coin(res.coins)}${how ? '<br><small>' + how + '</small>' : ''}`);
      };
      const have = Town.SELLABLE.filter(g => life.bag[g]);
      body.append(tiles(Town.SELLABLE.map(g => {
        const n = life.bag[g] || 0, tr = Town.trend(town, g);
        const all = n > 1 ? Town.sellPreview(town, g, n).reduce((a, b) => a + b, 0) : 0;
        const t = tile(G[g].icon, `${Town.price(town, g)}🪙 <i class="${tr}">${tr === 'up' ? '▲' : tr === 'down' ? '▼' : ''}</i>`, n ? `×${n}` : '', () => sell(g, 1), { disabled: !n, badge: n > 1 ? `all → ${all}🪙` : '' });
        const b = t.querySelector('.tile-badge'); if (b) b.addEventListener('click', (e) => { e.stopPropagation(); sell(g, life.bag[g]); });
        return t;
      })));
      if (!have.length) note(body, '🎒 0 → 🌾 🪓 🎣');
      const logPrice = Town.price(town, 'log') + 2;
      const buyLogs = async (n) => {
        if (life.coins < logPrice * n) return marketSheet(needCoins(logPrice * n));
        const res = await act({ type: 'buyGood', g: 'log', n });
        if (!res.ok) return marketSheet(`⚠️ ${esc(res.msg)}`);
        Life.spend(life, res.cost, '🪵', `Bought ${n} log${n > 1 ? 's' : ''} at the sawmill`, `${(res.each || []).join(' + ')} = ${res.cost}. The sawmill sells for a bit more than it buys (that is its profit).`); Life.addItem(life, 'log', n); Sound.cash(); touch(); hud(); marketSheet(`✓ 🪵×${n}: ${(res.each || []).join(' + ')} = −${coin(res.cost)}`);
      };
      body.insertAdjacentHTML('beforeend', '<h4 class="sub-h">🪚 Buy logs</h4>');
      body.append(tiles(tile('🪵', `${logPrice}🪙`, '×1', () => buyLogs(1)), tile('🪵', `${logPrice * 5}🪙`, '×5', () => buyLogs(5))));
    });
  }

  function schoolSheet(msg = '') {
    const lib = town.built.includes('library');
    sheet('🏫 School', (body) => {
      body.insertAdjacentHTML('beforeend', head('school', `Free for everyone (paid by taxes). Pass ${Life.CERT_AT} classes → 🎓.${lib ? ' 📚 ×2!' : ''}`));
      if (msg) note(body, msg);
      body.append(tiles(Object.entries(Life.SUBJECTS).map(([s, sub]) => {
        const n = life.school[s] || 0, got = Life.hasCert(life, s);
        return tile(sub.icon, sub.name, got ? '🎓' : '●'.repeat(Math.min(n, Life.CERT_AT)) + '○'.repeat(Math.max(0, Life.CERT_AT - n)), () => {
          quiz(`${sub.icon} ${sub.name}`, classQuestions(s, life.band, 3), (score) => {
            if (score === null) return;
            life.stats.classes++;
            if (score >= 2) {
              const before = Life.hasCert(life, s);
              life.school[s] = (life.school[s] || 0) + (lib ? 2 : 1); life.rep += 1;
              const cert = !before && Life.hasCert(life, s);
              Sound.chord(cert ? 6 : 3, 'bell'); touch(); checkDream(); hud();
              schoolSheet(cert ? `🎓 ${sub.cert}!` : `✓ ${score}/3`);
            } else { touch(); schoolSheet(`${score}/3 · 🔁`); }
          });
        }, { on: got });
      })));
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">👤 ${BAND_NAMES[life.band]} <button type="button" class="link-btn" id="bandBtn">↻</button></p>`);
      body.querySelector('#bandBtn').addEventListener('click', () => { life.band = life.band % 3 + 1; me.band = life.band; touch(); schoolSheet(`👤 ${BAND_NAMES[life.band]}`); });
    });
  }

  function jobsSheet(msg = '') {
    sheet('💼 Jobs', (body) => {
      body.insertAdjacentHTML('beforeend', head('jobs', `Finish every task in a shift to get paid. ${town.taxRate}% of each wage is income tax: it pays for the school, roads and parks.`));
      if (msg) note(body, msg);
      if (life.shift) {
        const j = Life.JOBS[life.shift.job];
        body.append(card(`<h3>${j.icon} ${j.name} ${'●'.repeat(life.shift.done)}${'○'.repeat(life.shift.need - life.shift.done)}</h3><p class="small">${j.how} → 🔶</p>`, 'next'));
        body.lastChild.append(button('✕ Stop (no pay)', () => { if (!confirm('Stop this shift? You only get paid when every task is done.')) return; Life.quitShift(life); touch(); hud(); jobsSheet('Shift stopped. No pay, because it was not finished.'); }, 'choice alt'));
      }
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Today ${'●'.repeat(life.shiftsToday)}${'○'.repeat(Math.max(0, Life.SHIFTS_PER_DAY - life.shiftsToday))}</p>`);
      body.append(tiles(Object.entries(Life.JOBS).map(([id, j]) => {
        const can = Life.canTake(life, id, town);
        const w = Life.wageOf(life, id), tx = Math.round(w * town.taxRate / 100);
        return tile(j.icon, j.name, can.ok ? `${coin(w)} − ${tx} tax = <b class="keep">${coin(w - tx)}</b>` : '🔒 ' + can.why, () => startShift(id), { disabled: !can.ok || !!life.shift, on: life.shift && life.shift.job === id });
      })));
    });
  }
  function dreamSteps() {
    const d = Life.DREAMS[life.dream];
    return d.steps.map(([text, , , icon], i) => `<div class="lesson ${i < life.dreamStep ? 'done' : i === life.dreamStep ? 'next' : 'locked'}"><span class="mark">${i < life.dreamStep ? '✓' : icon}</span><span>${esc(text)}</span></div>`).join('')
      + (life.dreamStep >= d.steps.length ? `<div class="lesson next"><span class="mark">∞</span><span>${esc(Life.dreamGoal(life).text)}</span></div>` : '');
  }

  function hallSheet(msg = '') {
    const t = now(), mayor = town.mayor, isMayor = mayor && mayor.uid === me.uid;
    sheet('🏛️ Town Hall', (body) => {
      body.insertAdjacentHTML('beforeend', head('hall', 'Taxes → 🏦 treasury → things for everyone.'));
      if (msg) note(body, msg);
      const need = Town.growthNeed((town.districts || 0) + 1), have = Math.floor(town.growth || 0);
      body.insertAdjacentHTML('beforeend', `<div class="wallet"><span>🏦 <b>${coin(town.treasury)}</b></span><span>📜 <b>${town.taxRate}%</b></span><span>👑 <b>${esc(mayor ? mayor.name : 'Maple')}</b></span></div>
        <div class="grow-bar"><span>🏙️</span><div class="progress thin"><div style="width:${Math.min(100, have / need * 100)}%"></div></div><b>${have}/${need}</b></div>`);
      const count = {}; Object.values(town.votes).forEach(id => { count[id] = (count[id] || 0) + 1; });
      const myVote = town.votes[me.uid];
      body.insertAdjacentHTML('beforeend', '<h4 class="sub-h">🗳️ Vote</h4>');
      body.append(tiles(Town.projectChoices(town).map(p => {
        const pct = Math.min(100, Math.round(town.treasury / p.cost * 100));
        const tl = tile(p.icon, esc(p.name), `${coin(p.cost)} · ${'👍'.repeat(Math.min(3, count[p.id] || 0)) || '·'}`, async () => {
          const res = await act({ type: 'vote', project: p.id });
          if (!res.ok) return hallSheet(`⚠️ ${esc(res.msg)}`);
          if (!life.seen['vote:' + town.built.length]) { life.seen['vote:' + town.built.length] = 1; life.rep += 1; }
          life.stats.votes++; Sound.bell(); touch(); checkDream(); fact('vote'); hallSheet(`✓ ${p.icon}${isMayor ? ' ×3' : ''}`);
        }, { on: myVote === p.id });
        tl.insertAdjacentHTML('beforeend', `<div class="progress thin"><div style="width:${pct}%"></div></div>`);
        return tl;
      })));
      const e = town.election;
      const ec = card('<h3>👑 Election</h3>');
      if (e) {
        const left = Math.max(0, Math.ceil((e.closes - t) / 1000));
        ec.insertAdjacentHTML('beforeend', `<p class="small">⏳ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · 🤫</p>`);
        ec.append(row(...Object.entries(e.cand).map(([uid, c]) => button(`${e.votes[me.uid] === uid ? '✓ ' : ''}🗳️ ${esc(c.name)}`, async () => {
          const res = await act({ type: 'ballot', cand: uid }); hallSheet(res.ok ? '✓ 🤫' : `⚠️ ${esc(res.msg)}`);
        }))));
      }
      if (!isMayor && !(e && e.cand[me.uid])) {
        const can = Life.hasCert(life, 'civics');
        ec.append(row(button('📣 Run for mayor', async () => {
          const res = await act({ type: 'run', rep: life.rep });
          if (!res.ok) return hallSheet(`⚠️ ${esc(res.msg)}`);
          life.stats.ran++; touch(); checkDream(); hallSheet('✓ 📣');
        }, 'choice alt', !can), can ? null : Object.assign(document.createElement('span'), { className: 'small lock', textContent: '🔒 🎓🏛️' })));
      }
      ec.insertAdjacentHTML('beforeend', `<p class="small">⭐ ${life.rep}</p>`);
      if (isMayor) ec.append(row(...[5, 10, 15, 20].map(r => button(`${town.taxRate === r ? '✓ ' : ''}${r}%`, async () => { const res = await act({ type: 'setTax', rate: r }); hallSheet(res.ok ? `✓ ${r}%` : `⚠️ ${esc(res.msg)}`); }, town.taxRate === r ? 'choice' : 'choice alt'))));
      body.append(ec);
      if (town.news.length) body.append(card(`<h3>📰</h3>${town.news.slice(0, 5).map(n => `<p class="small">${esc(n)}</p>`).join('')}`));
    });
  }

  function rentSheet() {
    const house = Life.ownsHouse(town, me.uid);
    sheet('🏢 Apartments', (body) => {
      body.insertAdjacentHTML('beforeend', head('rent', house ? '🏠 You own a home. No rent!' : `Rent ${coin(Life.RENT)}/day${life.rentFree ? ` · 🎁 ${life.rentFree} free days` : ''}. Own a house → ${coin(Town.TAX.lot)}/day tax.`));
      const free = Town.allPlots(town).filter(pl => !(town.plots[pl.id] && town.plots[pl.id].owner));
      body.append(tiles(free.slice(0, 12).map(pl => tile(pl.kind === 'farm' ? '🌱' : '🏗️', coin(pl.price), pl.id, () => { guide = { ...plotCenter(pl), h: 8, id: pl.id, icon: '🏡' }; closeSheet(); }))));
      fact('rent');
    });
  }

  /* ---------------- travel: bus, train, your own wheels ---------------- */
  function travel(kind, from, to) {
    const fare = Life.FARES[kind];
    if (life.coins < fare) { toast(needCoins(fare)); return; }
    Life.spend(life, fare, kind === 'bus' ? '🚌' : '🚆', `${kind === 'bus' ? 'Bus' : 'Train'} ticket to ${to.name}`, 'Fares help pay for buses and trains.'); act({ type: 'fare', n: fare });
    life.stats.rides++; life.stats[kind === 'bus' ? 'rideBus' : 'rideTrain']++;
    World.setVehicle(null);
    closeSheet(); Sound.bell(); hud();
    World.ride(kind, from, to, () => { memory(kind); fact('fare'); fact('brake'); checkDream(); touch(); hud(); setTimeout(flushQueue, 200); });
  }
  function stopSheet(from) {
    sheet('🚌 Bus', (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">🎫 ${coin(Life.FARES.bus)} · 👛 ${coin(life.coins)}</p>`);
      body.append(tiles(Town.stopsOf(town).filter(s => s.id !== from.id).map(s => tile('🚏', esc(s.name), '', () => travel('bus', from, s), { disabled: life.coins < Life.FARES.bus }))));
    });
  }
  function stationSheet() {
    const p = World.pos(), here = nearest(Town.stationsOf(town), p);
    sheet('🚉 Train', (body) => {
      body.insertAdjacentHTML('beforeend', head('station', `🎫 ${coin(Life.FARES.train)} · fast!`));
      const list = Town.stationsOf(town).filter(s => s.id !== here.id);
      if (!list.length) note(body, '🏙️ → 🚉 (the town must grow)');
      body.append(tiles(list.map(s => tile('🚉', esc(s.name), '', () => travel('train', here, s), { disabled: life.coins < Life.FARES.train }))));
    });
  }
  function toggleRide() {
    if (World.vehicle) { World.setVehicle(null); hud(); Sound.pop(); return; }
    const v = bestVehicle(); if (!v) return;
    World.setVehicle(v); memory('vehicle'); fact(v === 'plane' ? 'hop' : 'drive'); Sound.bell(); hud();
  }
  $('rideBtn').addEventListener('click', () => { Sound.init(); toggleRide(); });
  function dealerSheet(msg = '') {
    sheet('🚗 Wheels & Wings', (body) => {
      body.insertAdjacentHTML('beforeend', head('dealer', 'Faster = pricier. ⛽ = cost every day.') + money());
      if (msg) note(body, msg);
      body.append(tiles(Object.entries(Life.VEHICLES).map(([id, v]) => {
        const own = life.vehicles[id], lock = v.needs && !life.badges[v.needs];
        return tile(v.icon, own ? '✓' : coin(v.price), `⚡×${v.speed} · ⛽${v.upkeep}`, () => {
          if (own) return;
          if (lock) return dealerSheet('🔒 🎓✈️ (Airport)');
          if (life.coins < v.price) return dealerSheet(needCoins(v.price) + ' Save up, or borrow at the 🏦 bank.');
          Life.spend(life, v.price, v.icon, `Bought a ${v.name.toLowerCase()}`, v.upkeep ? `It will also cost ${v.upkeep} every morning for fuel and repairs.` : 'Bikes need no fuel!'); life.vehicles[id] = Date.now(); touch(); hud(); Sound.cash(); World.burst(World.pos().x, World.pos().y, 'confetti', 30, 4);
          if (v.upkeep) fact('upkeep');
          checkDream(); dealerSheet(`🔑 ${v.icon}! → ${v.icon} button`);
        }, { on: !!own, disabled: !!lock && !own });
      })));
    });
  }

  /* ---------------- trips: airport, harbor, space ---------------- */
  let tripFrom = null;
  function goTrip(id, fromType) {
    const T = Life.TRIPS[id], k = nearest(World.keepers.filter(q => q.type === fromType), World.pos());
    tripFrom = k ? { x: k.x, y: k.y + 40 } : World.pos();
    closeSheet(); World.setVehicle(null);
    Sound.chord(6, 'bell');
    World.goTrip(id); life.stats.trips++; touch();
    later(() => toast(`<span class="t-small">${T.icon} ${esc(T.name)}</span>📸 → 🔶`, { big: true, life: 4 }));
    memory(id); if (id !== 'moon') memory('flight');
    if (id === 'moon') fact('hop3');
    startMusic(); hud(); checkDream();
  }
  function endTrip() {
    World.endTrip(tripFrom ? tripFrom.x : 4800, tripFrom ? tripFrom.y : 1500);
    Sound.bell(); startMusic(); hud(); touch();
  }
  function airportSheet(msg = '') {
    sheet('✈️ Airport', (body) => {
      body.insertAdjacentHTML('beforeend', head('airport', 'Where to? ✈️') + money());
      if (msg) note(body, msg);
      const ownPlane = !!life.vehicles.plane;
      body.append(tiles(Object.entries(Life.TRIPS).filter(([, T]) => !T.rocket).map(([id, T]) => tile(T.icon, esc(T.name), ownPlane ? '🛩️ free' : coin(T.fare), () => {
        if (!ownPlane) { if (life.coins < T.fare) return airportSheet(needCoins(T.fare)); Life.spend(life, T.fare, '✈️', `Plane ticket to ${T.name}`); act({ type: 'fare', n: 5 }); }
        goTrip(id, 'airport');
      }, { on: !!life.memories[id] }))));
      body.insertAdjacentHTML('beforeend', '<h4 class="sub-h">🎓 Flight school</h4>');
      body.append(tiles(tile('🧑‍✈️', life.badges.pilot ? '✓' : 'Pilot', life.badges.pilot ? '' : '🔬➗ quiz', () => {
        if (life.badges.pilot) return;
        const qs = classQuestions('science', life.band, 2).concat(classQuestions('math', life.band, 1));
        quiz('🧑‍✈️ Flight school', qs, (score) => { if (score === null) return; if (score >= 2) { life.badges.pilot = 1; Sound.chord(6, 'bell'); touch(); checkDream(); airportSheet('🎓 🧑‍✈️!'); } else airportSheet(`${score}/3 · 🔁`); });
      }, { on: !!life.badges.pilot })));
    });
  }
  function harborSheet() {
    sheet('⚓ Harbor', (body) => {
      body.insertAdjacentHTML('beforeend', head('harbor', 'Boat to the island: cheaper, slower.') + money());
      body.append(tiles(tile('⛵', '🏝️', coin(12), () => { if (life.coins < 12) return toast(needCoins(12)); Life.spend(life, 12, '⛵', 'Boat ticket to Sunny Island'); act({ type: 'fare', n: 3 }); goTrip('island', 'harbor'); }, { disabled: life.coins < 12 })));
    });
  }
  function spaceSheet(msg = '') {
    sheet('🚀 Space Center', (body) => {
      body.insertAdjacentHTML('beforeend', head('space', 'Train hard. Then fly! 🌙'));
      if (msg) note(body, msg);
      body.append(tiles(
        tile('🧑‍🚀', life.badges.astronaut ? '✓' : 'Training', life.badges.astronaut ? '' : '🪐 quiz', () => {
          if (life.badges.astronaut) return;
          if (!Life.hasCert(life, 'science')) return spaceSheet('🔒 🎓🔬');
          const qs = (typeof QUIZ_BANK !== 'undefined' ? QUIZ_BANK.filter(q => q.s === 'space') : []).sort(() => Math.random() - 0.5).slice(0, 3);
          quiz('🧑‍🚀 Training', qs, (score) => { if (score === null) return; if (score >= 2) { life.badges.astronaut = 1; Sound.chord(7, 'bell'); touch(); checkDream(); spaceSheet('🎓 🧑‍🚀!'); } else spaceSheet(`${score}/3 · 🔁`); });
        }, { on: !!life.badges.astronaut }),
        tile('🚀', '🌙', life.badges.astronaut ? 'Go!' : '🔒', () => { if (!life.badges.astronaut) return spaceSheet('🔒 🧑‍🚀'); goTrip('moon', 'space'); }, { disabled: !life.badges.astronaut })));
    });
  }
  let goalsToday = 0;
  function stadiumSheet() {
    sheet('⚽ Stadium', (body) => {
      body.insertAdjacentHTML('beforeend', head('stadium', 'Kick the ball into a goal: +3🪙 (5 a day).'));
      body.append(tiles(tile('⚽', 'Field', '→ 🔶', () => { const d = Town.districtsOf(town).find(q => q.landmarks.some(l => l.type === 'stadium')); if (d) guide = { x: d.x0 + 1450, y: 420, h: 6, icon: '⚽' }; closeSheet(); })));
    });
  }
  function funSheet(type) {
    const P = placeInfo(type), cost = { cafe: 3, arcade: 2, hotel: 10 }[type] || 0;
    sheet(`${P.icon || ''} ${P.name || ''}`, (body) => {
      body.insertAdjacentHTML('beforeend', head(type, HELLO[type] || '👋'));
      body.append(tiles(tile(P.icon, cost ? coin(cost) : 'Visit', '', () => {
        if (cost && life.coins < cost) return toast(needCoins(cost));
        if (cost) Life.spend(life, cost, P.icon, ({ cafe: 'Hot cocoa at the Cafe', arcade: 'Arcade game', hotel: 'A night at the Hotel' })[type] || P.name);
        life.xp += 1; memory(type); World.mood('love', 2); Sound.chord(4, 'kalimba');
        if (type === 'museum') { const f = (typeof FACTS !== 'undefined') ? FACTS[Math.floor(Math.random() * FACTS.length)] : null; if (f) toast(`<span class="t-small">🦕 ${esc(f.title)}</span>${esc(f.text)}`, { life: 7 }); }
        if (type === 'arcade') { closeSheet(); quiz('🕹️', [makeMathQuestion(Math.random, life.band * 2)], (s) => { if (s) { Life.earn(life, 5, null, '🏆', 'Arcade prize'); hud(); } else toast('🕹️ So close! Right answers win the prize.'); }); return; }
        touch(); hud(); closeSheet();
      })));
    });
  }

  /* ---------------- business: companies, the Tech Hub, the studio ---------------- */
  function bizSheet(msg = '') {
    sheet('🏢 Companies', (body) => {
      body.insertAdjacentHTML('beforeend', head('biz', 'Sales − costs = profit. If costs are bigger, it is a loss and it comes out of your pocket. Workers sell more but cost wages.') + money());
      if (msg) note(body, msg);
      life.companies.forEach(co => {
        const T = Life.COMPANIES[co.type];
        const last = life.log.find(e => e.icon === T.icon && e.morning);
        const c = card(`<h3>${T.icon} ${T.name} <small>Lv ${co.level} · 👥 ${co.staff}/${Life.staffMax(co)} · ${co.days ? `total ${co.profit >= 0 ? '+' : ''}${co.profit}🪙` : '🆕 opens tomorrow morning'}${co.ad ? ' · 📣' : ''}</small></h3>
          <p class="small">Every morning: customers pay you, and you pay rent & supplies (${T.upkeep * co.level}🪙) + ${T.wage}🪙 per worker.${last ? `<br>Last morning: <b class="${last.n < 0 ? 'neg' : 'pos'}">${last.n >= 0 ? '+' : ''}${last.n}🪙</b> ${esc(last.how)}` : ''}</p>`);
        const doIt = (what) => { const r = Life.company(life, what, co.id); if (!r.ok) return bizSheet(`⚠️ ${r.why}`); Sound.cash(); touch(); hud(); checkDream(); bizSheet(`✓ ${T.icon}`); };
        c.append(row(button(`➕👤 ${coin(T.wage)}/day`, () => doIt('hire'), 'choice', co.staff >= Life.staffMax(co)), button('➖👤', () => doIt('fire'), 'choice alt', !co.staff),
          button(`⬆️ ${coin(Life.upgradeCost(co))}`, () => doIt('upgrade'), 'choice alt'), button(`📣 ${coin(6 + 4 * co.level)}`, () => doIt('ad'), 'choice alt', !!co.ad)));
        body.append(c);
      });
      body.insertAdjacentHTML('beforeend', '<h4 class="sub-h">🆕 Start a company</h4>');
      body.append(tiles(Object.entries(Life.COMPANIES).map(([id, T]) => tile(T.icon, esc(T.name), `${coin(T.cost)}${T.lot ? ' + 🏗️' : ''}${T.needs ? ' 🎓' + Life.SUBJECTS[T.needs].icon : ''}`, () => startCompany(id)))));
      fact('company');
    });
  }
  function startCompany(id, plotId) {
    const T = Life.COMPANIES[id];
    if (T.lot && !plotId) {
      const lot = myPlots().find(p => p.plot.kind === 'lot' && !p.build);
      if (!lot) { guide = placeFor('lot') && { ...placeFor('lot'), icon: '🏗️' }; closeSheet(); toast('🏗️ → 🏭 (buy a lot, then build)'); return; }
      closeSheet(); guide = { ...plotCenter(lot.plot), h: 9, icon: '🏭' }; toast('🏗️ → 🔨 🏭'); return;
    }
    const r = Life.company(life, 'start', id, plotId || null);
    if (!r.ok) return bizSheet(`⚠️ ${r.why}`);
    memory('company'); Sound.chord(5, 'bell'); touch(); hud(); checkDream(); if (T.online) fact('online');
    bizSheet(`🎉 ${T.icon} ${T.name}!`);
  }
  function techSheet(msg = '') {
    sheet('💻 Tech Hub', (body) => {
      body.insertAdjacentHTML('beforeend', head('tech', 'Sell online to the whole world (10% fee).') + money());
      if (msg) note(body, msg);
      const store = life.companies.find(c => c.type === 'online');
      if (!store) body.append(tiles(tile('🛒', 'Online store', coin(Life.COMPANIES.online.cost), () => { startCompany('online'); techSheet(); })));
      else {
        const listed = Object.entries(life.online).filter(([, n]) => n > 0);
        body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">🛒 ${listed.length ? listed.map(([g, n]) => `${G[g].icon}×${n}`).join(' ') : '🫙'} · 🚚 ${6 * store.level}/day</p>`);
        body.append(tiles(Town.SELLABLE.map(g => tile(G[g].icon, `+1`, `×${life.bag[g] || 0}`, () => { if (!Life.takeItem(life, g, 1)) return; life.online[g] = (life.online[g] || 0) + 1; life.stats.listed++; touch(); hud(); checkDream(); techSheet(`✓ ${G[g].icon} → 🛒`); }, { disabled: !life.bag[g] }))));
      }
      body.insertAdjacentHTML('beforeend', '<h4 class="sub-h">🏢</h4>');
      body.append(tiles(tile('📣', 'Ad Agency', coin(Life.COMPANIES.agency.cost), () => startCompany('agency')), tile('📱', 'App Studio', coin(Life.COMPANIES.app.cost), () => startCompany('app')), tile('💼', 'Jobs', '📣 💻', () => jobsSheet())));
    });
  }
  function studioSheet(msg = '') {
    const ch = life.channel;
    sheet('🎬 Media Studio', (body) => {
      body.insertAdjacentHTML('beforeend', head('studio', 'Film new places → more fans → views earn coins.'));
      if (msg) note(body, msg);
      body.insertAdjacentHTML('beforeend', `<div class="wallet"><span>📹 <b>${ch.videos}</b></span><span>⭐ <b>${ch.subs}</b></span><span>👀 <b>${ch.views}</b></span><span>🪙 <b>${ch.earned}</b></span></div>`);
      const photos = Object.keys(life.photos || {});
      body.append(tiles(tile('🎬', 'Make a video', `📷×${life.bag.photo || 0}`, () => {
        if (!life.bag.photo) { guide = placeFor('spot:photo') && { ...placeFor('spot:photo'), icon: '📷' }; closeSheet(); toast('📷 → 🔶'); return; }
        const place = photos[Math.floor(Math.random() * photos.length)] || 'town';
        Life.takeItem(life, 'photo', 1);
        const r = Life.makeVideo(life, life.lastPhoto || place); life.lastPhoto = null;
        memory('video'); fact('video'); Sound.chord(4, 'bell'); touch(); hud(); checkDream();
        studioSheet(`🎬 ✓ ⭐ +${r.gain}${r.fresh ? ' (new place!)' : ''}`);
      }, { disabled: false })));
    });
  }

  /* ---------------- land, farming, building ---------------- */
  function buyLand(pl) {
    sheet(`${pl.kind === 'farm' ? '🌱' : '🏗️'} ${pl.id}`, (body) => {
      body.insertAdjacentHTML('beforeend', `<div class="wallet"><span>🏷️ <b>${coin(pl.price)}</b></span><span>🏛️ <b>${coin(Town.TAX[pl.kind])}/day</b></span></div>${money()}`);
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">${pl.kind === 'farm' ? '🌱 → 💧 → 🌾 → 🧺 🪙' : '🔨 🏠 🏡 🏪 🏭'}</p>`);
      if (life.coins < pl.price) note(body, `−${coin(pl.price - life.coins)} · 💼 or 🏦`);
      body.append(row(button(`Buy ${coin(pl.price)}`, async () => {
        if (life.coins < pl.price) return;
        const res = await act({ type: 'buyPlot', id: pl.id });
        if (!res.ok) { closeSheet(); return toast(`⚠️ ${esc(res.msg)}`); }
        Life.spend(life, res.cost, pl.kind === 'farm' ? '🌱' : '🏗️', `Bought land ${pl.id}`, `Land costs a little tax every day: ${Town.TAX[pl.kind]}🪙.`); Sound.chord(2, 'bell'); World.burst(pl.x + pl.w / 2, pl.y + pl.h / 2, 'confetti', 30, 4);
        if (guide && guide.id === pl.id) guide = null;
        touch(); hud(); closeSheet(); checkDream(); fact('land');
        toast(`<span class="t-small">🏡 Yours!</span>${pl.kind === 'farm' ? '🌱 → 💧' : '🔨'}`, { big: true });
      }, 'big-btn small', life.coins < pl.price), button('✕', closeSheet, 'choice alt')));
    });
  }
  function plantPicker(id, i) {
    sheet('🌱 Plant', (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">🌱 ${coin('x')} → 🌾 ${coin('y')} = profit · 👛 ${coin(life.coins)}</p>`);
      body.append(tiles([...Town.CROPS, 'tree'].map(k => {
        const g = G[k], sells = k === 'tree' ? `🪵×3` : `→ ${coin(Town.price(town, k))}`;
        return tile(g.icon, coin(g.seed), `⏳${Math.round(g.grow / 6000) / 10}m ${sells}`, async () => {
          if (life.coins < g.seed) return;
          const res = await act({ type: 'plant', id, i, k });
          closeSheet();
          if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
          Life.spend(life, g.seed, g.icon, `${g.name} seeds`, 'Seeds cost coins now. The crop sells for more later: that is profit.'); life.stats.planted++; Sound.plant(); const s = Town.soilSpot(Town.plotById(id), i); World.burst(s.x, s.y, 'seeds', 10, 1);
          touch(); hud(); toast(`${g.icon} → 💧`);
        }, { disabled: life.coins < g.seed });
      })));
    });
  }
  async function water(id, i) {
    const res = await act({ type: 'water', id, i });
    if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
    Sound.water(); const s = Town.soilSpot(Town.plotById(id), i); World.burst(s.x, s.y, 'water', 14, 4); World.mood('love', 1);
  }
  async function harvest(id, i) {
    const res = await act({ type: 'harvest', id, i, bonus: life.shift ? false : Math.random() < 0.25 });
    if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
    const s = Town.soilSpot(Town.plotById(id), i);
    Object.entries(res.items).forEach(([g, n]) => { Life.addItem(life, g, n); World.floatText(s.x, s.y, `+${n} ${G[g].icon}`); });
    life.stats.harvested++; Sound.pop(); Sound.plant(); World.burst(s.x, s.y, 'leaves', 12, 2); World.mood('laugh', 1);
    touch(); hud(); checkDream();
  }
  function buildPicker(id) {
    sheet('🔨 Build', (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">🪵×${life.bag.log || 0} · 👛 ${coin(life.coins)}</p>`);
      const doBuild = async (k, co) => {
        const b = Town.BUILD[k];
        if ((life.bag.log || 0) < b.logs || life.coins < b.coins) return;
        if (co) { const T = Life.COMPANIES[co]; if (T.needs && !Life.hasCert(life, T.needs)) return toast(`🔒 🎓${Life.SUBJECTS[T.needs].icon}`); if (life.coins < b.coins + T.cost) return toast(needCoins(b.coins + T.cost)); }
        const res = await act({ type: 'build', id, kind: k, k: co });
        closeSheet();
        if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
        Life.takeItem(life, 'log', b.logs); Life.spend(life, b.coins, b.icon, `Built a ${b.name.toLowerCase()}`, `${b.logs} logs + ${b.coins} coins for the builders.`); life.stats.built++;
        if (co) { const r = Life.company(life, 'start', co, id); if (r.ok) { memory('company'); fact('company'); } }
        if (k === 'house' || k === 'villa') memory('house');
        [0, 250, 500].forEach(ms => setTimeout(() => Sound.hammer(), ms));
        const pl = Town.plotById(id); World.burst(pl.x + pl.w / 2, pl.y + pl.h / 2, 'wood', 24, 4);
        toast(`${b.icon} 🔨🔨🔨`, { big: true });
        touch(); hud(); setTimeout(checkDream, 1000);
      };
      const need = (b) => ((life.bag.log || 0) >= b.logs && life.coins >= b.coins) ? '' : `🪵${b.logs} ${coin(b.coins)}`;
      body.append(tiles(['house', 'villa', 'shop'].map(k => { const b = Town.BUILD[k]; return tile(b.icon, b.name, need(b) || `🪵${b.logs} ${coin(b.coins)}`, () => doBuild(k), { disabled: !!need(b) }); })));
      body.insertAdjacentHTML('beforeend', '<h4 class="sub-h">🏭 Company building</h4>');
      const bc = Town.BUILD.company;
      body.append(tiles(Object.entries(Life.COMPANIES).filter(([, T]) => T.lot).map(([co, T]) => tile(T.icon, T.name, `🪵${bc.logs} ${coin(bc.coins + T.cost)}`, () => doBuild('company', co), { disabled: !!need(bc) }))));
      if ((life.bag.log || 0) < 12) note(body, '🪵 → 🪓 🌲 or 🧺');
    });
  }
  function shelfSheet(msg = '') {
    sheet('🏪 Shop', (body) => {
      const on = Object.entries(life.shelf).filter(([, n]) => n > 0);
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Every morning customers buy 5 · price +3🪙 · 🧺 ${on.length ? on.map(([g, n]) => `${G[g].icon}×${n}`).join(' ') : '🫙'}</p>`);
      if (msg) note(body, msg);
      body.append(tiles(Town.SELLABLE.map(g => tile(G[g].icon, '+1', `×${life.bag[g] || 0}`, () => { if (!Life.takeItem(life, g, 1)) return; life.shelf[g] = (life.shelf[g] || 0) + 1; life.stats.stocked++; touch(); hud(); checkDream(); shelfSheet(`✓ ${G[g].icon}`); }, { disabled: !life.bag[g] }))));
    });
  }

  /* ---------------- the forest and the town farm ---------------- */
  async function chop(tr) {
    const left = Town.forestLeft(town);
    if (life.owesSapling) return toast('🌱 first! (cut one, plant one)');
    if (left <= 10) return toast(`🌲 ${left} left · 🌱🌱🌱`);
    const res = await act({ type: 'chop', tree: tr.id });
    if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
    Life.addItem(life, 'log', 2); life.stats.chopped++; life.owesSapling = 1;
    World.fellTree(tr.x, tr.y, tr.kind);
    [0, 180, 360].forEach(ms => setTimeout(() => Sound.chop(), ms));
    World.burst(tr.x, tr.y, 'leaves', 18, 6); World.floatText(tr.x, tr.y, '+2 🪵');
    if (life.shift && life.shift.job === 'lumberjack') workStep();
    touch(); hud(); checkDream(); fact('chop'); fact('fall');
  }
  async function replant(tr) {
    const res = await act({ type: 'replant', tree: tr.id });
    if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
    const owed = life.owesSapling; life.owesSapling = 0; life.stats.replanted++; life.rep += 1;
    Sound.plant(); World.burst(tr.x, tr.y, 'seeds', 12, 1); World.mood('love', 1.2);
    if (life.shift && life.shift.job === 'lumberjack') workStep();
    else if (!owed) { Life.earn(life, 1, null, '🌱', 'Thank you for planting a tree'); World.floatText(tr.x, tr.y, '+1🪙'); }
    touch(); hud(); checkDream();
  }
  let volunteer = 0;
  async function farmwork(i) {
    const res = await act({ type: 'farmwork', i });
    if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
    const s = Town.FARM_SPOTS[i]; Sound.pop(); World.burst(s.x, s.y, 'leaves', 10, 2);
    if (life.shift && life.shift.job === 'farmhand') return workStep();
    if (volunteer < 5) { volunteer++; life.rep += 1; touch(); }
    toast('🧺 ❤️ ⭐+1 · 💼 → 🧑‍🌾 = 🪙');
  }

  /* ---------------- nature spots: fish, photos, views, campfires ---------------- */
  const SPOT = {
    fish: { icon: '🎣', label: 'Fish' }, photo: { icon: '📷', label: 'Photo' }, view: { icon: '⛰️', label: 'Look' }, camp: { icon: '🏕️', label: 'Rest' },
    gem: { icon: '💎', label: 'Dig' }, shell: { icon: '🐚', label: 'Collect' }, swim: { icon: '🏊', label: 'Swim' }, stars: { icon: '🔭', label: 'Stars' },
    berry: { icon: '🫐', label: 'Pick' }, home: { icon: '✈️', label: 'Home' },
  };
  function spotAction(s) {
    const S2 = SPOT[s.type] || SPOT.photo, wait = life.spotAt[s.id] && now() - life.spotAt[s.id] < 90000;
    if (s.type === 'home') return { key: 'spot:' + s.id, label: 'Home', icon: World.trip === 'moon' ? '🚀' : '✈️', cls: 'buy', run: () => endTrip() };
    return { key: 'spot:' + s.id, label: wait ? '⏳' : S2.label, icon: S2.icon, cls: wait ? 'look idle' : 'work', run: () => doSpot(s) };
  }
  let fishing = false;
  function doSpot(s) {
    const t = now();
    if (life.spotAt[s.id] && t - life.spotAt[s.id] < 90000) return toast(`${SPOT[s.type].icon} ⏳`);
    const firstHere = !life.seen['s:' + s.id];
    const finish = () => {
      life.spotAt[s.id] = t; life.xp += 1;
      if (firstHere) { life.seen['s:' + s.id] = 1; life.stats.spots++; }
      if (life.shift && life.shift.job === 'ranger' && !(life.shift.targets || []).includes(s.id)) { life.shift.targets = [...(life.shift.targets || []), s.id]; workStep(); }
      touch(); hud(); checkDream();
    };
    const item = (g, n = 1) => { Life.addItem(life, g, n); life.stats.found[g] = (life.stats.found[g] || 0) + n; World.floatText(s.x, s.y, `+${n} ${G[g] ? G[g].icon : '📷'}`); };
    switch (s.type) {
      case 'fish':
        if (fishing) return;
        fishing = true; World.mood('think', 2); toast('🎣 . . .');
        setTimeout(() => {
          fishing = false;
          if (!life.memories.fish || Math.random() < 0.75) { item('fish'); Sound.splash(); World.burst(s.x, s.y, 'water', 16, 2); memory('fish'); World.mood('wow', 1.5); }
          else { toast('🎣 The fish got away! Try again in a moment.'); Sound.wrong(); life.spotAt[s.id] = t - 80000; return; }
          finish();
        }, 1400); return;
      case 'photo': {
        Life.addItem(life, 'photo', 1); life.stats.photos++; life.photos[s.id] = 1; life.lastPhoto = s.id;
        World.floatText(s.x, s.y, '📷✨'); Sound.pop(); memory('photo'); break;
      }
      case 'view': memory('view'); World.mood('love', 2); Sound.chord(2, 'kalimba'); break;
      case 'camp': memory('camp'); World.mood('happy', 2); Sound.chord(0, 'kalimba'); life.xp += 2; break;
      case 'gem': item('gem'); memory('gem'); Sound.coin(); World.burst(s.x, s.y, 'dust', 10, 1); break;
      case 'shell': item('shell', 1 + (Math.random() < 0.4 ? 1 : 0)); memory('shell'); Sound.pop(); break;
      case 'berry': item('berry', 2); memory('berry'); Sound.plant(); break;
      case 'swim': memory('swim'); fact('swim'); Sound.splash(); break;
      case 'stars': {
        const h = Life.hourOf(t);
        if (h < 19.5 && World.trip !== 'moon') return toast('🔭 🌙 (come back at night)');
        memory('stars'); Sound.chord(9, 'bell'); World.celebrate(3); break;
      }
    }
    finish();
  }

  /* ---------------- work ---------------- */
  function startShift(id) {
    let targets = [];
    if (id === 'mail') targets = places().filter(b => b.id !== 'jobs').sort(() => Math.random() - 0.5).slice(0, 3).map(b => b.id);
    if (id === 'builder') {
      const all = Town.allPlots(town), free = all.filter(p => p.kind === 'lot' && !(town.plots[p.id] && town.plots[p.id].build));
      targets = (free.length >= 3 ? free : all.filter(p => p.kind === 'lot')).sort(() => Math.random() - 0.5).slice(0, 3).map(p => p.id);
    }
    const r = Life.startShift(life, id, targets, town);
    if (!r.ok) return jobsSheet(`⚠️ ${esc(r.why)}`);
    touch(); hud(); closeSheet();
    const j = Life.JOBS[id];
    Sound.bell();
    toast(`<span class="t-small">${j.icon} ${j.name}</span>${j.how} → 🔶`, { big: true, life: 4 });
    fact('wage');
  }
  function workStep(target) {
    const pay = Life.workDone(life, town.taxRate, target);
    if (!pay) return;
    const p = World.pos();
    if (!pay.done) { Sound.coin(); World.floatText(p.x, p.y, `${life.shift.done}/${life.shift.need}`, 'task'); touch(); hud(); return; }
    if (pay.tax) act({ type: 'tax', n: pay.tax });
    Sound.cash(); World.burst(p.x, p.y, 'coins', 22, 6); World.mood('laugh', 2); World.floatText(p.x, p.y, `+${pay.net}🪙`, 'pay');
    touch(); hud(); checkDream(); fact('tax');
    const j = Life.JOBS[pay.job];
    later(() => sheet('💵 Payday!', (body) => {
      body.insertAdjacentHTML('beforeend', `<div class="budget"><div><span>${j.icon} Wage for your ${j.name} shift</span><b class="pos">+${coin(pay.gross)}</b></div><div><span>🏛️ Income tax ${pay.rate}%<small>Goes to the town: it pays for the school, roads and parks.</small></span><b class="neg">−${coin(pay.tax)}</b></div><div class="total"><span>👛 You keep</span><b>${coin(pay.net)}</b></div></div>
        ${pay.raise ? `<p class="sheet-sub">🎉 Experience pays! Next ${j.name} shift: ${coin(pay.next)}</p>` : ''}`);
      body.append(button('👍', closeSheet, 'big-btn small'));
    }));
  }
  function deliver(id) {
    const s = life.shift; if (!s || !s.targets.includes(id)) return;
    Sound.pop(); World.say('npc:' + id, '💌 ❤️', 3); World.npcMood(id, 'love', 2);
    workStep(id);
  }
  function hammer(id) {
    const s = life.shift; if (!s || !s.targets.includes(id)) return;
    [0, 200, 400].forEach(ms => setTimeout(() => Sound.hammer(), ms));
    const pl = Town.plotById(id); World.burst(pl.x + pl.w / 2, pl.y + pl.h / 2, 'dust', 16, 3);
    workStep(id);
  }
  function deskTask(kid) {
    const s = life.shift; if (!s) return;
    const subj = Life.DESK_JOBS[s.job], subject = subj === 'any' ? ['money', 'civics', 'tools', 'math', 'science'][Math.floor(Math.random() * 5)] : subj;
    quiz(`${Life.JOBS[s.job].icon}`, classQuestions(subject, life.band, 1), (score) => {
      if (score === null) return;
      if (score >= 1) { World.say('npc:' + kid, '👍', 2); workStep(); } else toast('💼 Not quite, so that task does not count yet. Try the next customer!', { life: 4 });
    });
  }

  /* ---------------- a new day ---------------- */
  function dayTick() {
    const day = Life.dayOf(now());
    if (life.day === day) return;
    if (!life.firstDay) life.firstDay = day;
    const r = Life.newDay(life, town, me.uid, day);
    touch();
    if (!r) return;
    volunteer = 0; goalsToday = 0;
    if (r.taxes) act({ type: 'tax', n: r.taxes });
    if (r.borrowed) fact('loan');
    later(() => sheet(`☀️ Day ${day - life.firstDay + 1}`, (body) => {
      const b = document.createElement('div'); b.className = 'budget';
      b.innerHTML = r.lines.map(l => `<div><span>${l.icon || ''} ${esc(l.label)}${l.acct === 'bank' ? ' <em>🐷 savings</em>' : ''}${l.how ? `<small>${esc(l.how)}</small>` : ''}</span><b class="${l.n < 0 ? 'neg' : l.n > 0 ? 'pos' : ''}">${l.n > 0 ? '+' + coin(l.n) : l.n < 0 ? '−' + coin(-l.n) : (l.note ? esc(l.note) : '·')}</b></div>`).join('')
        + `<div class="total"><span>👛 In your pocket now</span><b>${coin(r.coins)}</b></div>`;
      body.append(b);
      if (r.borrowed) note(body, `💸 Your bills were bigger than your pocket, so the bank lent you ${coin(r.borrowed)}. Pay it back at the bank: loans grow every morning.`);
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Yesterday you earned ${coin(r.yesterday.earned)} and spent ${coin(r.yesterday.spent)}. 🐷 Savings ${coin(r.bank)}${r.loan ? ` · 💸 You owe ${coin(r.loan)}` : ''}. <button type="button" class="link-btn" id="histBtn">👛 Money history</button></p>`);
      body.querySelector('#histBtn').addEventListener('click', () => moneySheet());
      body.append(button('☀️', closeSheet, 'big-btn small'));
    }));
    hud(); checkDream();
  }

  /* ---------------- dreams ---------------- */
  function dreamPicker(first, all = false) {
    sheet(first ? '✨ I want to be…' : '✨ Dreams', (body) => {
      const ids = all ? Object.keys(Life.DREAMS) : Life.FEATURED;
      const grid = document.createElement('div'); grid.className = 'tiles dreams';
      ids.forEach(id => {
        const d = Life.DREAMS[id];
        grid.append(tile(d.icon, d.name, '', () => dreamPreview(id, first), { on: life.dream === id }));
      });
      if (!all) grid.append(tile('➕', `${Object.keys(Life.DREAMS).length - ids.length} more`, '', () => dreamPicker(first, true)));
      body.append(grid);
    });
  }
  function dreamPreview(id, first) {
    const d = Life.DREAMS[id];
    sheet(`${d.icon} ${d.name}`, (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">${esc(d.desc)}</p>` + d.steps.map(([text, , , icon], i) => `<div class="lesson next"><span class="mark">${icon}</span><span>${esc(text)}</span></div>`).join('') + '<div class="lesson next"><span class="mark">∞</span><span>…and it never ends</span></div>');
      body.append(row(button('✓ This is my dream', () => {
        if (life.dream !== id) { life.dream = id; life.dreamStep = 0; life.dreamLv = 0; life.dreamMark = life.stats.earned; }
        touch(); closeSheet(); checkDream(); hud(); markers();
        const g = Life.dreamGoal(life);
        toast(`<span class="t-small">${d.icon} ${esc(d.name)}</span>→ ${g.icon} ${esc(g.text)} · follow ➤`, { big: true, life: 5 });
        Sound.chord(5, 'bell');
      }, 'big-btn small'), button('←', () => dreamPicker(first), 'choice alt')));
    });
  }

  /* ---------------- my life ---------------- */
  function lifeSheet() {
    sheet(`${me.name}`, (body) => {
      const d = Life.DREAMS[life.dream];
      body.insertAdjacentHTML('beforeend', money());
      const bag = Object.entries(life.bag).filter(([, n]) => n);
      body.insertAdjacentHTML('beforeend', `<div class="wallet"><span>🎒 ${bag.length ? bag.map(([g, n]) => `${(G[g] || { icon: '📷' }).icon}×${n}`).join(' ') : '🫙'}</span></div>`);
      const plots = myPlots(), house = Life.ownsHouse(town, me.uid);
      const own = [house ? '🏠' : '🏢', ...plots.map(p => p.plot.kind === 'farm' ? '🌱' : ({ shop: '🏪', house: '🏠', villa: '🏡', company: '🏭' })[p.build] || '🏗️'), ...Object.keys(life.vehicles).map(v => Life.VEHICLES[v].icon), ...life.companies.map(c => Life.COMPANIES[c.type].icon)];
      body.append(card(`<h3>🔑 ${own.join(' ')}</h3>`));
      body.append(card(`<h3>🎓 ${Object.entries(Life.SUBJECTS).map(([s, x]) => `${x.icon}${Life.hasCert(life, s) ? '✓' : '·'}`).join(' ')} ${life.badges.pilot ? '🧑‍✈️' : ''}${life.badges.astronaut ? '🧑‍🚀' : ''}</h3>`));
      const dc = card(`<h3>${d ? `${d.icon} ${esc(Life.title(life))}` : '✨'}</h3>${d ? dreamSteps() : ''}`);
      dc.append(button('✨ ↻', () => dreamPicker(), 'choice alt'));
      body.append(dc);
      const mem = Object.entries(Life.MEMORIES);
      body.insertAdjacentHTML('beforeend', `<h4 class="sub-h">📸 ${Life.memCount(life)}/${mem.length} · ⭐ ${life.xp}</h4>`);
      body.append(tiles(mem.map(([id, [icon, name]]) => tile(life.memories[id] ? icon : '❔', '', life.memories[id] ? esc(name) : '', null, { cls: life.memories[id] ? 'mem' : 'mem locked' }))));
    });
  }

  /* ---------------- map ---------------- */
  function drawMap(c, big) {
    const R = Town.worldRight(town), B = { x0: 3380, x1: R, y0: -420, y1: 2640 };
    const x = c.getContext('2d'), W = c.width, H = c.height;
    // the minimap follows you when the town gets wide; the big map shows it all
    let k = Math.min(W / (B.x1 - B.x0), H / (B.y1 - B.y0)), ox = B.x0;
    if (!big) k = Math.min(W / 2840, H / 3060);   // the minimap keeps one scale and slides along with you
    if (!big) { const p = World.pos(); ox = Math.max(B.x0, Math.min(B.x1 - W / k, p.x - W / k / 2)); }
    const X = gx => (gx - ox) * k, Y = gy => (gy - B.y0) * k, t = now();
    x.fillStyle = '#b4dc7a'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#9fca68'; x.fillRect(X(3680), Y(120), 900 * k, 720 * k);
    x.strokeStyle = '#8a8f99'; x.lineWidth = Math.max(1.5, 30 * k); x.beginPath(); x.moveTo(X(B.x0), Y(Town.RAIL_Y)); x.lineTo(X(R), Y(Town.RAIL_Y)); x.stroke();
    x.strokeStyle = '#e9d9b0'; x.lineCap = 'round'; x.lineWidth = Math.max(3, 80 * k);
    const roads = Town.ROADS.concat(...Town.districtsOf(town).map(d => d.roads));
    roads.forEach(([ax, ay, bx, by]) => { x.beginPath(); x.moveTo(X(Math.max(ax, B.x0)), Y(ay)); x.lineTo(X(bx), Y(by)); x.stroke(); });
    Town.districtsOf(town).forEach(d => {
      const n = d.nat; x.fillStyle = { lake: '#7fd0ea', beach: '#f4e3b5', hills: '#a8d46c', stars: '#9ccb78', grove: '#8cc45e', meadow: '#c3e58f' }[d.nature];
      x.beginPath(); x.ellipse(X(n.x), Y(n.y), 300 * k, 260 * k, 0, 0, 7); x.fill();
    });
    x.fillStyle = '#efe3c4'; x.beginPath(); x.arc(X(Town.PLAZA.x), Y(Town.PLAZA.y), Town.PLAZA.r * k, 0, 7); x.fill();
    const F = Town.TOWN_FARM; x.fillStyle = '#a0673b'; x.fillRect(X(F.x), Y(F.y), F.w * k, F.h * k);
    Town.allPlots(town).forEach(p => {
      const st = town && town.plots[p.id], mine = st && st.owner === me.uid;
      x.fillStyle = mine ? '#ffd23f' : st && st.owner ? (p.kind === 'farm' ? '#8f5d36' : '#d8cdb4') : (p.kind === 'farm' ? '#c7a57a' : '#cfe3a8');
      x.fillRect(X(p.x), Y(p.y), p.w * k, p.h * k);
      x.strokeStyle = '#34233f'; x.lineWidth = mine ? 2 : 1; x.strokeRect(X(p.x), Y(p.y), p.w * k, p.h * k);
    });
    if (town) Town.FOREST.forEach(tr => { const st = Town.treeState(town, tr.id, t); x.fillStyle = st === 'tree' ? '#5f9e57' : st === 'stump' ? '#9a6a44' : '#9dd46e'; x.beginPath(); x.arc(X(tr.x), Y(tr.y), Math.max(1.5, (st === 'tree' ? 30 : 16) * k), 0, 7); x.fill(); });
    places().forEach(b => {
      x.fillStyle = '#fff3d6'; x.strokeStyle = '#34233f'; x.lineWidth = 1.5;
      x.fillRect(X(b.x - b.w / 2), Y(b.y - 45 - 130), b.w * k, 130 * k); x.strokeRect(X(b.x - b.w / 2), Y(b.y - 45 - 130), b.w * k, 130 * k);
      x.font = `${Math.max(10, 70 * k)}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b.icon, X(b.x), Y(b.y - 110));
    });
    x.textBaseline = 'alphabetic';
    mapMarks.forEach(m => { x.fillStyle = '#ffd23f'; x.strokeStyle = '#34233f'; x.lineWidth = 1.5; x.beginPath(); const px = X(m.x), py = Y(m.y), r = Math.max(4, 40 * k); x.moveTo(px, py - r); x.lineTo(px + r * 0.7, py); x.lineTo(px, py + r); x.lineTo(px - r * 0.7, py); x.closePath(); x.fill(); x.stroke(); });
    Net.others.forEach(o => { if (o.x == null || o.x > 20000) return; x.fillStyle = o.color; x.strokeStyle = '#fff8e8'; x.lineWidth = 2; x.beginPath(); x.arc(X(o.tx ?? o.x), Y(o.ty ?? o.y), Math.max(3.5, 40 * k), 0, 7); x.fill(); x.stroke(); });
    if (!World.trip) { const p = World.pos(); x.fillStyle = me.color; x.strokeStyle = '#34233f'; x.lineWidth = 2.5; x.beginPath(); x.arc(X(p.x), Y(p.y), Math.max(4.5, 50 * k), 0, 7); x.fill(); x.stroke(); }
  }
  function mapSheet() {
    sheet('🗺️', (body) => {
      const c = document.createElement('canvas'); c.className = 'map-canvas';
      const R = Town.worldRight(town), ratio = (R - 3380) / 3060;
      c.width = Math.round(Math.min(1400, 720 * Math.max(1, ratio))); c.height = Math.round(c.width / ratio);
      const wrap = document.createElement('div'); wrap.className = 'map-wrap'; wrap.append(c); body.append(wrap);
      drawMap(c, true);
      body.append(tiles(places().map(b => tile(b.icon, '', '', () => { const k = keeper(b.id); if (k) guide = { x: k.x, y: k.y, h: 13, icon: b.icon }; closeSheet(); })),
        Town.districtsOf(town).map(d => tile({ lake: '🏞️', hills: '⛰️', beach: '🏖️', stars: '🔭', grove: '🍄', meadow: '🦋' }[d.nature], '', '', () => { guide = { ...d.nat, h: 8, icon: '🌲' }; closeSheet(); })),
        tile('🌲', '', '', () => { guide = { x: 4130, y: 480, h: 12, icon: '🌲' }; closeSheet(); }), tile('🌾', '', '', () => { guide = { x: 5520, y: 470, h: 10, icon: '🌾' }; closeSheet(); })));
    });
  }
  $('minimap').addEventListener('click', () => { Sound.blip(); mapSheet(); });
  $('coinPill').addEventListener('click', () => { Sound.blip(); moneySheet(); });
  $('mapBtn').addEventListener('click', () => { Sound.blip(); mapSheet(); });
  $('lifeBtn').addEventListener('click', () => { Sound.blip(); lifeSheet(); });
  $('goal').addEventListener('click', () => { Sound.blip(); if (!life.dream) dreamPicker(true); else { guide = null; lifeSheet(); } });
  $('shiftPill').addEventListener('click', () => { Sound.blip(); jobsSheet(); });

  /* ---------------- menu ---------------- */
  $('menuBtn').addEventListener('click', (e) => { e.stopPropagation(); $('menuPop').hidden = !$('menuPop').hidden; });
  document.addEventListener('click', (e) => { if (!e.target.closest('#menuPop') && e.target.id !== 'menuBtn') $('menuPop').hidden = true; });
  $('soundBtn').addEventListener('click', () => { const m = Sound.toggle(); $('soundIcon').textContent = m ? '🔇' : '🔊'; });
  $('musicBtn').addEventListener('click', () => { if (typeof Music === 'undefined') return; Music.init(); const m = Music.toggle(); $('musicIcon').textContent = m ? '🔕' : '🎵'; if (!m) startMusic(true); });
  $('grownBtn').addEventListener('click', () => { $('menuPop').hidden = true; Care.grownUp(); });
  $('awayBtn').addEventListener('click', () => { $('menuPop').hidden = true; Care.goAway(); });
  $('dreamBtn').addEventListener('click', () => { $('menuPop').hidden = true; dreamPicker(); });
  $('friendsBtn2').addEventListener('click', () => { $('menuPop').hidden = true; if (online()) friendsSheet(); else roomSheet(); });
  $('roomPill').addEventListener('click', () => { Sound.blip(); friendsSheet(); });
  $('helpBtn').addEventListener('click', () => { $('menuPop').hidden = true; helpSheet(); });
  function helpSheet() {
    sheet('❓', (body) => {
      body.insertAdjacentHTML('beforeend', `<div class="help-grid">
        <div>💼 → 🪙</div><div>🏫 → 🎓 → 💼⬆️</div><div>🏦 🐷 📈</div><div>🏡 🌱 → 🌾 → 🧺</div>
        <div>🗳️ → 🏛️ → ⛲🏥📚</div><div>🏙️ grows → 🚉💻🎬✈️🚀</div><div>🚌 🚆 🚲 🚗 🛩️</div><div>🏞️ 🎣 📷 🏕️ → 📸 ⭐</div>
        <div>🏭 👥 📣 → 📈</div><div>✨ → ➤ follow the arrow</div></div>
        <p class="sheet-sub">⌨️ WASD · Space/E = do · M = map · 1–6 = faces · 📱 drag = walk</p>`);
    });
  }

  /* ---------------- friends and rooms ---------------- */
  function roomSheet(msg = '') {
    sheet('👥 Friends', (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Same room name = same town 🏙️</p>
        <form class="answer-row" id="roomForm"><input id="roomIn" maxlength="8" autocomplete="off" autocapitalize="characters" placeholder="67NM" aria-label="Room name"><button class="choice alt" type="button" id="roomDice" aria-label="Make up a room name">🎲</button><button class="choice" type="submit">Go →</button></form>
        <p class="mp-msg ${msg ? 'err' : ''}" id="roomMsg">${esc(msg)}</p>`);
      const inp = body.querySelector('#roomIn'); inp.value = S && S.lastRoom || '';
      body.querySelector('#roomDice').addEventListener('click', () => { inp.value = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''); });
      body.querySelector('#roomForm').addEventListener('submit', (e) => { e.preventDefault(); enterRoom(inp.value); });
    });
  }
  async function enterRoom(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 3 || code.length > 8) { const m = $('roomMsg'); if (m) m.textContent = '3–8 letters or numbers'; return false; }
    const m = $('roomMsg'); if (m) m.textContent = '⏳';
    Net.onStatus((s) => { const el = $('roomMsg'); if (el) el.textContent = `⏳ ${s}s`; });
    try { if (World.trip) endTrip(); await Net.enter(code, me.name, me.color, 'team', me.uid); S = S || {}; S.lastRoom = code; return true; }
    catch (e) { const el = $('roomMsg'); if (el) { el.textContent = e.code === 'offline' ? '📡 ✕ (online version only)' : '📡 ✕ · 🔁'; el.classList.add('err'); } return false; }
  }
  function friendsSheet() {
    sheet(`👥 ${Net.code}`, (body) => {
      const link = `${location.origin}${location.pathname}?room=${Net.code}`;
      body.insertAdjacentHTML('beforeend', `<div class="code-box"><div class="code">${esc(Net.code)}</div></div><p class="link-line">${esc(link)}</p>`);
      const list = document.createElement('div'); list.className = 'players';
      const rowFor = (name, color, sub, isMe) => `<div class="player-row ${isMe ? 'me' : ''}"><span class="dot" style="background:${color}"></span><span class="who">${esc(name)}</span><span class="stats"><span class="stat">${esc(sub || '')}</span></span></div>`;
      list.innerHTML = rowFor(me.name, me.color, Life.title(life), true) + [...Net.others.values()].map(o => rowFor(o.name, o.color, o.ti, false)).join('');
      body.append(list);
      body.append(row(button('📋 Copy', () => { navigator.clipboard && navigator.clipboard.writeText(link).then(() => toast('📋 ✓')).catch(() => {}); }, 'choice'),
        button('🚪 Leave', () => { Net.leave(); Talk.leave(); goSolo(); closeSheet(); toast('🏡'); }, 'choice alt')));
    });
  }
  function goSolo() {
    if (!solo) solo = Town.newTown(Date.now());
    Town.settle(solo, Date.now());
    builtSeen = null; mayorSeen = null; newsSeen = null; districtsSeen = null;
    onTown(solo); hud();
  }
  const takeColor = (c) => { if (c && c !== me.color) { me.color = c; World.setMe({ color: c }); touch(); } };
  Net.on('me', (p) => takeColor(p.color));
  Net.on('joined', (m) => {
    const mine = m.players.find(p => p.id === m.you); if (mine) takeColor(mine.color);
    builtSeen = null; mayorSeen = null; newsSeen = null; districtsSeen = null;
    closeSheet();
    onTown(m.town);
    toast(`<span class="t-small">👥 ${esc(m.code)}</span>${m.created ? '🆕 🏙️' : '👋 🏙️'}`, { big: true, life: 4 });
    hud(); Talk.refresh();
    if (!life.day || life.day !== Life.dayOf(now())) dayTick();
  });
  Net.on('town', (m) => onTown(m.town));
  Net.on('arrived', (p) => { toast(`👋 ${esc(p.name)}!`); Sound.bell(); hud(); });
  Net.on('left', () => hud());
  Net.on('disconnected', ({ replaced }) => { toast(replaced ? '📱 ↔ 💻' : '📡 ✕ → 🏡'); goSolo(); Talk.refresh(); });
  Net.on('error', (m) => { const el = $('roomMsg'); if (el) { el.textContent = m.msg; el.classList.add('err'); } else toast(`⚠️ ${esc(m.msg)}`); });

  /* ---------------- faces ---------------- */
  const FACES = ['love', 'laugh', 'wow', 'cool', 'silly', 'sad'];
  function buildFaceBar() {
    const bar = $('emoteBar'); bar.innerHTML = '';
    FACES.forEach(mood => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.face = mood; b.setAttribute('aria-label', 'Face: ' + mood);
      const c = document.createElement('canvas'); c.width = 92; c.height = 80;
      const x = c.getContext('2d'); rr(x, 4, 4, 84, 72, 14); fillStroke(x, '#1f1a2e', 4); drawFace(x, mood, 0.4, 46, 40, 1.9);
      b.appendChild(c); bar.appendChild(b);
    });
    const fb = document.createElement('button'); fb.className = 'icon-btn'; fb.id = 'faceBtn'; fb.type = 'button'; fb.setAttribute('aria-label', 'Make a face'); fb.textContent = '😊';
    $('talkBar').insertBefore(fb, $('talkBar').firstChild);
    fb.addEventListener('click', () => { bar.hidden = !bar.hidden; fb.classList.toggle('on', !bar.hidden); Talk.close(); });
    bar.addEventListener('pointerdown', (e) => e.stopPropagation());
    bar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; World.mood(b.dataset.face, 3); Sound.note(FACES.indexOf(b.dataset.face) * 2 + 5, 'kalimba'); bar.hidden = true; $('faceBtn').classList.remove('on'); });
  }
  addEventListener('keydown', (e) => {
    if (!playing || busy() || e.target.tagName === 'INPUT') return;
    const n = +e.key; if (n >= 1 && n <= 6) World.mood(FACES[n - 1], 3);
    if (e.key === 'c' && online()) Talk.toggle();
    if (e.key === 'm') mapSheet();
    if (e.key === 'r' || e.key === 'v') toggleRide();
  });

  /* ---------------- music ---------------- */
  let musicStarted = false;
  function startMusic(force) {
    if (typeof Music === 'undefined') return;
    if (!musicStarted || force) { Music.init(); musicStarted = true; }
    Music.play(moodNow());
  }
  function moodNow() {
    if (!playing) return 'title';
    if (World.trip) return World.trip === 'moon' ? 'space' : 'adventure';
    const h = Life.hourOf(now());
    return h < 9 ? 'morning' : h < 17.5 ? 'day' : h < 20 ? 'evening' : 'night';
  }

  /* ---------------- the loop ---------------- */
  let hudT = 0, dayT = 0, mapT = 0, musicT = 0, lastKeeperSay = {}, rainWas = false, hillWas = false;
  function tick(dt) {
    if (!playing) return;
    if (Care.tick(dt, $('sheet').hidden)) { target = null; renderAction(); return; }
    const t = now();
    target = busy() ? null : findTarget();
    renderAction();
    receipts();
    if (target && target.key.startsWith('npc:')) {
      const id = target.key.slice(4), k = keeper(id);
      if (k && (!lastKeeperSay[id] || performance.now() - lastKeeperSay[id] > 60000)) { lastKeeperSay[id] = performance.now(); World.say('npc:' + id, HELLO[k.type] || '👋', 3); }
    }
    if (guide && dist(World.pos(), guide) < 60) guide = null;
    const st = World.state();
    if (!World.trip) pos = World.pos();
    if (online() && !World.trip) Net.state({ x: Math.round(pos.x), y: Math.round(pos.y), mood: st.mood, moving: st.moving, face: st.face, z: st.hop, title: Life.title(life) });
    if ((hudT -= dt) <= 0) {
      hudT = 0.5; hud(); markers(); World.setDay(window.__sw.dayOverride ?? Life.dayFrac(t));
      const rain = Town.raining(t); if (rain && !rainWas) { fact('rain'); toast('🌧️ 🌱💧'); } rainWas = rain;
      const up = World.hillAt(World.pos().x, World.pos().y) > 2; if (up && !hillWas) fact('hill'); hillWas = up;
    }
    if ((dayT -= dt) <= 0) { dayT = 2; if (!World.trip) dayTick(); if (dirty) save(); }
    if ((mapT -= dt) <= 0) { mapT = 0.25; if (!World.trip) drawMap($('minimap'), false); }
    if ((musicT -= dt) <= 0) { musicT = 5; if (musicStarted) startMusic(); }
  }

  /* ---------------- title screen ---------------- */
  function titleScreen() {
    const nameIn = $('nameIn'); nameIn.value = me.name || '';
    const sw = $('colors');
    COLORS.forEach(c => {
      const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', 'Hoodie color'); if (c === me.color) b.classList.add('on');
      b.addEventListener('click', () => { me.color = c; sw.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
      sw.appendChild(b);
    });
    const ages = $('ages');
    [1, 2, 3].forEach(b => {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'tab' + (me.band === b ? ' on' : ''); el.textContent = BAND_NAMES[b];
      el.addEventListener('click', () => { me.band = b; ages.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === el)); });
      ages.appendChild(el);
    });
    $('dice').addEventListener('click', () => {
      const A = ['Sunny', 'Brave', 'Happy', 'Clever', 'Kind', 'Lucky', 'Busy', 'Cozy'], B = ['Farmer', 'Builder', 'Baker', 'Mayor', 'Otter', 'Maple', 'Pepper', 'Pixel'];
      nameIn.value = A[Math.floor(Math.random() * A.length)] + ' ' + B[Math.floor(Math.random() * B.length)];
    });
    if (life) { $('startBtn').textContent = 'Continue ☀'; $('newBtn').hidden = false; }
    const go = async (withFriends) => {
      Sound.init(); startMusic();
      const name = nameIn.value.replace(/\s+/g, ' ').trim().slice(0, 14);
      if (name.length < 2) { $('titleMsg').textContent = '✏️ Name?'; nameIn.focus(); return; }
      me.name = name;
      const fresh = !life;
      if (fresh) life = Life.fresh(me.band); else life.band = me.band;
      if (!solo) solo = Town.newTown(Date.now());
      $('title').hidden = true; $('hud').hidden = false; $('minimap').hidden = false;
      World.setMe({ color: me.color });
      if (pos && pos.x && pos.x < 20000) World.place(pos.x, pos.y);
      playing = true;
      goSolo();
      dayTick();
      save(); startMusic();
      if (fresh) later(() => welcome());
      else if (!life.dream) later(() => dreamPicker(true));
      if (withFriends) roomSheet();
      const fromLink = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (fromLink.length >= 3 && !withFriends) { roomSheet(); $('roomIn').value = fromLink; }
    };
    $('startBtn').addEventListener('click', () => go(false));
    $('friendsBtn').addEventListener('click', () => go(true));
    $('newBtn').addEventListener('click', () => {
      if (!confirm('Start a brand new life? Everything in this browser will be gone.')) return;
      life = null; solo = null; pos = null; localStorage.removeItem(KEY); location.reload();
    });
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(false); });
    nameIn.addEventListener('focus', () => { Sound.init(); startMusic(); }, { once: true });
    drawHero();
  }
  // The hero on the title screen, scaled from its real bounds (antenna ball to hoodie) so nothing is cut off.
  function drawHero() {
    const c = $('titleHero'), x = c.getContext('2d'), t = performance.now() / 1000;
    const top = -66.5, bottom = 31.5, pad = 14, k = (c.height - pad * 2) / (bottom - top), bob = Math.sin(t * 2) * 2;
    x.clearRect(0, 0, c.width, c.height);
    x.save(); x.translate(c.width / 2, pad - top * k + bob - 2); x.scale(k, k);
    rr(x, -15, 4, 30, 26, 10); fillStroke(x, me.color, 3);
    drawHead(x, 0, -20, t % 3.2 < 0.14 ? 'blink' : 'happy', t, { color: me.color === '#e4572e' ? '#f4b942' : '#e4572e' });
    x.restore();
    if (!$('title').hidden) requestAnimationFrame(drawHero);
  }
  function welcome() {
    sheet('👋 Small Town', (body) => {
      body.insertAdjacentHTML('beforeend', `<div class="welcome-row"><span>💼</span><span>🏫</span><span>🏦</span><span>🏡</span><span>🗳️</span><span>✈️</span></div>
        <p class="sheet-sub">👛 ${coin(life.coins)} · 🏢 🎁 · ➤ follow the arrow</p>`);
      body.append(button('✨ My dream', () => { sheetOnClose = null; closeSheet(); dreamPicker(true); }, 'big-btn small'));
    }, () => { if (!life.dream) setTimeout(() => dreamPicker(true), 200); });
  }

  /* ---------------- start ---------------- */
  function boot() {
    Talk.init({
      say: (id, text) => World.say(id === 'me' ? 'me' : id, text, Math.min(8, 3 + text.length / 12)),
      toast: (name, text) => toast(`<span class="t-small">💬 ${esc(name)}</span>${esc(text)}`, { life: 3 }),
      touch: () => document.body.classList.contains('touch'),
    });
    buildFaceBar();
    Care.onAway((on) => { Net.away(on); if (on) { save(); Talk.pauseVoice(); } });
    Care.onWarn((min) => toast(`<span class="t-small">😴</span>${min >= 1 ? '2:00' : '0:30'} → 💤`, { life: 4 }));
    World.start({
      now, tick, busy,
      onSpace: () => doAction(),
      others: () => Net.others.values(),
      tagInfo: () => ({ me: { name: me.name, sub: Life.title(life || Life.fresh(2)), talking: Talk.level('me') > 0.08 }, others: (id) => ({ talking: Talk.level(id) > 0.08 }) }),
      onHop: () => { Sound.pop(); if (life) fact('hop'); },
      onKick: (j) => { Sound.crunch(Math.min(1, j / 20), true); if (life) fact('kick'); },
      onThud: () => Sound.drum(0),
      onSwim: () => { Sound.splash(); if (life) fact('swim'); },
      onGoal: () => {
        Sound.chord(6, 'bell'); World.mood('laugh', 2); memory('goal');
        if (goalsToday < 5) { goalsToday++; Life.earn(life, 3, null, '⚽', `Goal prize (${goalsToday}/5 today)`); toast('⚽ GOAL!', { big: true }); } else toast('⚽ GOAL! (the 5 prizes for today are used up)', { big: true });
        touch(); hud();
      },
      onFirework: () => Sound.pop(),
      raining: () => Town.raining(now()),
    }).then(() => {
      $('boot').classList.add('gone');
      if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
      titleScreen();
    }).catch((e) => { $('boot').textContent = 'Small World could not start 3D on this device: ' + e.message; console.error(e); });
  }
  window.__sw = { life: () => life, town: () => town, me };   // for tests and curious grown-ups
  if (window.World) boot(); else addEventListener('world-ready', boot, { once: true });
})();
