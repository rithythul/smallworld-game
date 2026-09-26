// Small World: the game. You live in Small Town: work, learn, save, buy land, farm, build, vote, and chase a dream.
// The 3D town is drawn by js/world3d.js (window.World). The town's rules are in js/town.js, your life's rules in js/life.js.
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'small-world-v1';
  const COLORS = ['#2fa4b5', '#e4572e', '#8cbf5a', '#b98cff', '#f4b942', '#ff8fb1', '#5b7cfa', '#9a7b5b'];
  const G = Town.GOODS;
  const coin = (n) => `${n}🪙`;
  const BAND_NAMES = { 1: '6 to 8', 2: '9 to 12', 3: '13 to 16' };
  const HINTS = {
    hall: 'Vote for town projects and for a mayor. Taxes pay for them.',
    bank: 'Save coins and earn interest, or borrow and pay interest.',
    market: 'Sell crops and logs. Prices follow supply and demand.',
    school: 'Take classes, earn certificates, unlock better jobs.',
    jobs: 'Pick a job and go to work. Earn wages, pay a little tax.',
    rent: 'Your home for now. Rent, or build your own house.',
  };
  const BLD = Object.fromEntries(Town.BUILDINGS.map(b => [b.id, b]));

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
    try { localStorage.setItem(KEY, JSON.stringify({ me, life, solo, pos: World.pos ? World.pos() : pos })); } catch (e) {}
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
  let builtSeen = null, mayorSeen = null, newsSeen = null;
  function onTown(t) {
    const first = town !== t && builtSeen === null;
    town = t;
    World.setTown(t);
    // celebrate what the town builds
    if (builtSeen !== null && t.built.length > builtSeen) {
      t.built.slice(builtSeen).forEach(id => {
        const p = Town.project(id); if (!p) return;
        toast(`<span class="t-small">🎉 The town built</span>${p.icon} ${esc(p.name)}! Paid for with everyone's taxes.`, { big: true, life: 5 });
        Sound.chord(5, 'bell');
        if (/^festival/.test(id)) { World.celebrate(40); Life.earn(life, 5, 'gifts'); toast('🎆 Festival gift: +5🪙 for every citizen!'); }
      });
    }
    builtSeen = t.built.length;
    if (t.mayor && t.mayor.uid === me.uid && mayorSeen !== t.mayor.since) {
      if (mayorSeen !== null || !first) { life.stats.won++; toast('<span class="t-small">🗳️ You won!</span>You are the new mayor of Small Town. Set the tax rate and pick projects at the Town Hall.', { big: true, life: 6 }); Sound.chord(7, 'bell'); World.celebrate(8); }
      else if (!life.stats.won) life.stats.won = 1;
    }
    mayorSeen = t.mayor ? t.mayor.since : 0;
    if (newsSeen !== null && t.news[0] && t.news[0] !== newsSeen && !t.news[0].includes(me.name + ' ')) toast(`<span class="t-small">📰 Town news</span>${esc(t.news[0])}`, { life: 4 });
    newsSeen = t.news[0] || '';
    checkDream(); hud();
  }
  // solo towns keep living too
  setInterval(() => {
    if (!playing || online() || !solo) return;
    const before = JSON.stringify(solo);
    Town.settle(solo, Date.now());
    if (JSON.stringify(solo) !== before) { onTown(solo); touch(); }
  }, 15000);

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
  const busy = () => !playing || !$('sheet').hidden || !$('title').hidden || Care.locked || (Talk.open && document.activeElement && document.activeElement.id === 'chatInput');
  // things to show once no sheet is open (morning budget, dream steps)
  const queue = [];
  function later(fn) { if ($('sheet').hidden && playing) fn(); else queue.push(fn); }
  function flushQueue() { if ($('sheet').hidden && queue.length) queue.shift()(); }
  function button(text, onClick, cls = 'choice', disabled = false) {
    const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.innerHTML = text; b.disabled = disabled;
    b.addEventListener('click', () => { Sound.blip(); onClick(b); });
    return b;
  }
  const row = (...kids) => { const d = document.createElement('div'); d.className = 'sw-row'; kids.forEach(k => d.append(k)); return d; };
  function card(html, cls = '') { const d = document.createElement('div'); d.className = 'clue ' + cls; d.innerHTML = html; return d; }
  function quiz(title, questions, onDone) {
    let i = 0, score = 0;
    const show = () => sheet(title, (body) => {
      const q = questions[i], sub = SUBJECTS[q.s] || { icon: '❓', name: '' };
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Question ${i + 1} of ${questions.length} · ${sub.icon} ${sub.name}</p><h3 class="quiz-q">${esc(q.q)}</h3>`);
      const box = document.createElement('div'); box.className = 'quiz-opts';
      q.o.forEach((opt, k) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'quiz-opt'; b.textContent = opt;
        b.addEventListener('click', () => {
          const right = k === q.a; if (right) score++;
          right ? Sound.discover() : Sound.wrong();
          box.querySelectorAll('button').forEach((x, j) => { x.disabled = true; if (j === q.a) x.classList.add('right'); else if (j === k) x.classList.add('wrong'); });
          body.insertAdjacentHTML('beforeend', `<p class="quiz-why ${right ? 'ok' : ''}">${right ? '✓ Right! ' : 'Not quite, and that is okay! '}${esc(q.why)}</p>`);
          const next = button(i < questions.length - 1 ? 'Next question' : 'Finish', () => { i++; if (i < questions.length) show(); else { sheetOnClose = null; closeSheet(); onDone(score); } }, 'big-btn small');
          body.appendChild(next);
        });
        box.appendChild(b);
      });
      body.appendChild(box);
    }, () => onDone(null));
    show();
  }
  // science snacks: a short fact the first time something happens
  function fact(trigger) {
    const list = (typeof FACT_BY_TRIGGER !== 'undefined' && FACT_BY_TRIGGER[trigger]) || [];
    const f = list.find(x => !life.seen['f:' + x.id]); if (!f) return;
    life.seen['f:' + f.id] = 1; touch();
    later(() => toast(`<span class="t-small">💡 ${esc(f.title)}</span>${esc(f.text)}`, { life: 7 }));
  }

  /* ---------------- HUD ---------------- */
  function hud() {
    if (!life) return;
    const t = now(), h = Life.hourOf(t);
    const icon = h < 7 ? '🌅' : h < 18 ? '☀️' : h < 20 ? '🌇' : '🌙';
    const day = Life.dayOf(t) - (life.firstDay || Life.dayOf(t)) + 1;
    set('clockIcon', icon); set('clockDay', `Day ${day} · `); set('clockText', Life.clock(t));
    set('coinText', String(life.coins));
    set('bagText', String(Life.bagCount(life)));
    const g = Life.dreamGoal(life), d = Life.DREAMS[life.dream];
    set('goalText', g ? `${d.icon} ${g.text}` : 'Pick a dream at the Jobs office');
    const sh = life.shift ? Life.JOBS[life.shift.job] : null;
    $('shiftPill').hidden = !sh;
    if (sh) set('shiftText', `${sh.icon} ${sh.name}: ${life.shift.done}/${life.shift.need}`);
    $('roomPill').hidden = !online();
    if (online()) set('roomText', `${Net.code} · ${Net.others.size + 1} 👥`);
  }
  const set = (id, text) => { const el = $(id); if (el && el.textContent !== text) el.textContent = text; };

  /* ---------------- where things are ---------------- */
  const keeper = (id) => World.keepers.find(k => k.id === id);
  const door = (id) => ({ x: BLD[id].x, y: BLD[id].y - 5 });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const plotCenter = (p) => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 });
  const myPlots = () => Life.ownedPlots(town, me.uid);
  const insidePlot = (p, q, pad = 20) => q.x > p.x - pad && q.x < p.x + p.w + pad && q.y > p.y - pad && q.y < p.y + p.h + pad + 25;

  /* ---------------- what you can do right here ---------------- */
  let target = null;
  function findTarget() {
    const p = World.pos(), t = now(), cands = [];
    const add = (c, d, pri = 0) => cands.push({ ...c, d: d - pri });
    const sh = life.shift, job = sh && sh.job;
    // townsfolk in front of their buildings
    World.keepers.forEach(k => {
      const d = dist(p, k); if (d > 75) return;
      const desk = sh && Life.DESK_JOBS[job] && Life.JOBS[job].place === k.id;
      if (desk) add({ key: 'desk:' + k.id, label: 'Help a customer', icon: '💼', cls: 'work', run: () => deskTask(k.id) }, d, 30);
      else add({ key: 'npc:' + k.id, label: `Talk to ${k.name.split(' ')[1] || k.name}`, icon: BLD[k.id].icon, cls: 'talk', run: () => openPlace(k.id) }, d);
    });
    // mail
    if (job === 'mail') sh.targets.forEach(id => { const q = door(id), d = dist(p, q); if (d < 70) add({ key: 'mail:' + id, label: 'Deliver the letter', icon: '✉️', cls: 'work', run: () => deliver(id) }, d, 40); });
    // builder frames
    if (job === 'builder') sh.targets.forEach(id => { const q = plotCenter(Town.PLOT_BY_ID[id]), d = dist(p, q); if (d < 90) add({ key: 'frame:' + id, label: 'Hammer the frame', icon: '🔨', cls: 'work', run: () => hammer(id) }, d, 40); });
    // land
    Town.PLOTS.forEach(pl => {
      if (!insidePlot(pl, p)) return;
      const st = town.plots[pl.id], mine = st && st.owner === me.uid;
      if (!st || !st.owner) { add({ key: 'buy:' + pl.id, label: `Buy land · ${coin(pl.price)}`, icon: '🏡', cls: 'buy', run: () => buyLand(pl) }, 60); return; }
      if (!mine) { add({ key: 'look:' + pl.id, label: `${st.name}'s ${pl.kind === 'farm' ? 'farm' : 'land'}`, icon: '👀', cls: 'look idle', run: () => toast(`This land belongs to ${esc(st.name)}. Land tax: ${Town.TAX[pl.kind]}🪙 a day.`) }, 80); return; }
      if (pl.kind === 'farm') {
        for (let i = 0; i < 6; i++) {
          const s = Town.soilSpot(pl, i), d = dist(p, s); if (d > 48) continue;
          const c = st.soil[i], state = Town.cropState(c, t);
          if (state === 'empty') add({ key: `plant:${pl.id}:${i}`, label: 'Plant seeds', icon: '🌱', cls: 'buy', run: () => plantPicker(pl.id, i) }, d);
          else if (state === 'dry') add({ key: `water:${pl.id}:${i}`, label: 'Water it', icon: '💧', cls: 'water', run: () => water(pl.id, i) }, d);
          else if (state === 'ready') add({ key: `harvest:${pl.id}:${i}`, label: `Harvest ${G[c.k].name.toLowerCase()}`, icon: G[c.k].icon, cls: 'work', run: () => harvest(pl.id, i) }, d);
          else add({ key: `grow:${pl.id}:${i}`, label: `Growing ${Math.round(Town.cropProgress(c, t) * 100)}%`, icon: G[c.k].icon, cls: 'look idle', run: () => toast(`${G[c.k].icon} ${G[c.k].name} grows by itself now. Come back soon!`) }, d + 5);
        }
      } else if (!st.build) add({ key: 'build:' + pl.id, label: 'Build here', icon: '🔨', cls: 'buy', run: () => buildPicker(pl.id) }, 50);
      else if (st.build === 'shop') add({ key: 'shelf:' + pl.id, label: 'Stock your shop', icon: '🏪', cls: 'buy', run: () => shelfSheet() }, 50);
      else add({ key: 'home:' + pl.id, label: 'Your house', icon: '🏠', cls: 'look idle', run: () => toast('🏠 Home sweet home. No rent to pay: you own it! You pay a small land tax instead.') }, 60);
    });
    // the forest
    Town.FOREST.forEach(tr => {
      const d = dist(p, tr); if (d > 52) return;
      const state = Town.treeState(town, tr.id, t);
      if (state === 'tree') add({ key: 'chop:' + tr.id, label: 'Chop the tree', icon: '🪓', cls: 'work', run: () => chop(tr) }, d, job === 'lumberjack' ? 20 : 0);
      else if (state === 'stump') add({ key: 'sap:' + tr.id, label: 'Plant a sapling', icon: '🌱', cls: 'buy', run: () => replant(tr) }, d, life.owesSapling ? 25 : 0);
      else add({ key: 'kid:' + tr.id, label: 'Young tree growing', icon: '🌱', cls: 'look idle', run: () => toast('🌱 This sapling becomes a big tree in a few minutes.') }, d + 5);
    });
    // the town farm
    Town.FARM_SPOTS.forEach((s, i) => {
      const d = dist(p, s); if (d > 48) return;
      const ready = t - (town.farm[i] || 0) >= Town.FARM_REGROW;
      if (ready) add({ key: 'farm:' + i, label: job === 'farmhand' ? 'Pick for work' : 'Help pick', icon: G[Town.CROPS[i % 4]].icon, cls: 'work', run: () => farmwork(i) }, d, job === 'farmhand' ? 20 : 0);
    });
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
    Sound.init();
    const t = target; t.run(); return true;
  }
  $('action').addEventListener('click', () => doAction());
  $('action').addEventListener('pointerdown', (e) => e.stopPropagation());

  /* ---------------- dreams and progress ---------------- */
  function checkDream() {
    if (!life || !life.dream || !town) return;
    const done = Life.checkDream(life, { plots: myPlots() });
    done.forEach(text => later(() => {
      Sound.chord(4, 'bell'); World.burst(World.pos().x, World.pos().y, 'confetti', 30, 6); World.mood('love', 2);
      const g = Life.dreamGoal(life), d = Life.DREAMS[life.dream];
      toast(`<span class="t-small">⭐ Dream step done · ${esc(Life.title(life))}</span>${esc(text)}${g ? `<br><small>Next: ${esc(g.text)}</small>` : ''}`, { big: true, life: 5 });
      if (life.dreamStep === d.steps.length && text === d.steps[d.steps.length - 1][0]) toast(`🏆 You became a real ${d.title}! Your dream keeps growing: every ${Life.ENDLESS} coins you earn is one more level.`, { big: true, life: 7 });
    }));
    if (done.length) touch();
  }
  // show the way to what the dream (or the job) needs next
  let guide = null;
  function markers() {
    const list = [], sh = life.shift, t = now();
    if (sh) {
      const job = sh.job;
      if (job === 'mail') sh.targets.forEach(id => list.push({ ...door(id), h: 10 }));
      if (job === 'builder') sh.targets.forEach(id => list.push({ ...plotCenter(Town.PLOT_BY_ID[id]), h: 9 }));
      if (Life.DESK_JOBS[job]) { const k = keeper(Life.JOBS[job].place); if (k) list.push({ x: k.x, y: k.y, h: 13 }); }
      if (job === 'farmhand') Town.FARM_SPOTS.forEach((s, i) => { if (t - (town.farm[i] || 0) >= Town.FARM_REGROW) list.push({ ...s, h: 7 }); });
      if (job === 'lumberjack') {
        const p = World.pos(), want = life.owesSapling ? 'stump' : 'tree';
        Town.FOREST.filter(tr => Town.treeState(town, tr.id, t) === want).sort((a, b) => dist(p, a) - dist(p, b)).slice(0, 3).forEach(tr => list.push({ x: tr.x, y: tr.y, h: want === 'tree' ? 12 : 5 }));
      }
    } else if (guide) list.push({ x: guide.x, y: guide.y, h: guide.h || 12 });
    else if (life.owesSapling) {
      const p = World.pos(), st = Town.FOREST.filter(tr => Town.treeState(town, tr.id, t) === 'stump').sort((a, b) => dist(p, a) - dist(p, b))[0];
      if (st) list.push({ x: st.x, y: st.y, h: 5 });
    } else {
      const w = dreamPlace(); if (w) list.push(w);
    }
    World.markers(list);
    mapMarks = list;
  }
  function dreamPlace() {
    const g = Life.dreamGoal(life); if (!g || g.endless) return null;
    const text = g.text, k = (id) => { const q = keeper(id); return q ? { x: q.x, y: q.y, h: 13 } : null; };
    if (/Jobs office|shift/i.test(text)) return k(/Clerk/.test(text) ? 'jobs' : 'jobs');
    if (/School|certificate|class/i.test(text)) return k('school');
    if (/Bank|savings|interest|in the bank/i.test(text)) return k('bank');
    if (/Vote|mayor|election|reputation|taxes/i.test(text)) return k('hall');
    if (/Sell|Market|sales/i.test(text)) return k('market');
    if (/Chop|sapling/i.test(text)) { const tr = Town.FOREST.find(x => Town.treeState(town, x.id, now()) === (/sapling/.test(text) ? 'stump' : 'tree')); return tr ? { x: tr.x, y: tr.y, h: 12 } : null; }
    const mine = myPlots();
    if (/farm land|Own 2 farms|Buy your own farm/i.test(text)) { const f = Town.PLOTS.find(pl => pl.kind === 'farm' && !(town.plots[pl.id] && town.plots[pl.id].owner)); return f ? { ...plotCenter(f), h: 8 } : null; }
    if (/Buy a building lot/i.test(text)) { const f = Town.PLOTS.find(pl => pl.kind === 'lot' && !(town.plots[pl.id] && town.plots[pl.id].owner)); return f ? { ...plotCenter(f), h: 8 } : null; }
    if (/Harvest/i.test(text)) { const f = mine.find(m => m.plot.kind === 'farm'); return f ? { ...plotCenter(f.plot), h: 8 } : null; }
    if (/Build|shelf/i.test(text)) { const f = mine.find(m => m.plot.kind === 'lot'); return f ? { ...plotCenter(f.plot), h: 10 } : k('jobs'); }
    return null;
  }

  /* ---------------- the places ---------------- */
  function openPlace(id) {
    Sound.pop(); World.npcMood(id, 'love', 1.5);
    ({ bank: bankSheet, market: marketSheet, school: schoolSheet, jobs: jobsSheet, hall: hallSheet, rent: rentSheet })[id]();
  }
  const head = (id, text) => `<div class="keeper"><span class="keeper-icon">${BLD[id].icon}</span><div><b>${esc(BLD[id].npc.name)}</b><p>${text}</p></div></div>`;
  const money = () => `<div class="wallet"><span>👛 Pocket <b>${coin(life.coins)}</b></span><span>🏦 Savings <b>${coin(life.bank)}</b></span>${life.loan ? `<span class="owe">💸 Loan <b>${coin(life.loan)}</b></span>` : ''}</div>`;

  function bankSheet(msg = '') {
    const owned = myPlots().length, lim = Life.loanLimit(life, owned);
    sheet('🏦 Bank', (body) => {
      body.insertAdjacentHTML('beforeend', head('bank', 'Coins in the bank are safe, and they grow a little every morning. That growth is called <b>interest</b>.') + money());
      if (msg) body.insertAdjacentHTML('beforeend', `<p class="sw-msg">${msg}</p>`);
      const doIt = (what, n, okText) => { const r = Life.bank(life, what, n, owned); if (!r.ok) return bankSheet(`⚠️ ${r.why}`); Sound.cash(); touch(); hud(); checkDream(); if (what === 'deposit') fact('interest'); if (what === 'borrow') fact('loan'); bankSheet(okText); };
      const save = card(`<span class="where">Savings · ${Life.SAVE_RATE}% a day</span><h3>Put coins away</h3><p class="small">Tomorrow morning your savings grow by <b>${coin(life.bank >= 10 ? Math.max(1, Math.floor(life.bank * Life.SAVE_RATE / 100)) : 0)}</b>${life.bank < 10 ? ' (savings start growing at 10🪙)' : ''}.</p>`);
      save.append(row(
        button('Save 10', () => doIt('deposit', 10, '✓ Saved 10 coins.'), 'choice', life.coins < 10),
        button('Save half', () => doIt('deposit', Math.floor(life.coins / 2), '✓ Saved half of your coins.'), 'choice', life.coins < 2),
        button('Take out 10', () => doIt('withdraw', 10, '✓ Took out 10 coins.'), 'choice alt', life.bank < 10),
        button('Take out all', () => doIt('withdraw', life.bank, '✓ Took out all your savings.'), 'choice alt', !life.bank)));
      body.append(save);
      const loan = card(`<span class="where">Loans · ${Life.LOAN_RATE}% a day</span><h3>Borrow for a big dream</h3><p class="small">Borrowing lets you buy land now and pay later, but the loan grows by ${Life.LOAN_RATE}% every morning until you pay it back. If you borrow 50🪙 today, you owe <b>${50 + Math.ceil(50 * Life.LOAN_RATE / 100)}🪙</b> tomorrow. You can borrow up to <b>${coin(lim)}</b> in total (more with certificates and land).</p>`);
      loan.append(row(
        button('Borrow 20', () => doIt('borrow', 20, '✓ You borrowed 20 coins. Remember to pay it back!'), 'choice alt', life.loan + 20 > lim),
        button('Borrow 50', () => doIt('borrow', 50, '✓ You borrowed 50 coins. Remember to pay it back!'), 'choice alt', life.loan + 50 > lim),
        button('Pay back 10', () => doIt('repay', 10, '✓ Paid back 10 coins.'), 'choice', !life.loan || life.coins < Math.min(10, life.loan)),
        button('Pay back all', () => doIt('repay', Math.min(life.loan, life.coins), life.coins >= life.loan ? '🎉 Your loan is paid off!' : '✓ Paid back what you could.'), 'choice', !life.loan || !life.coins)));
      body.append(loan);
      if (life.stats.interest) body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Interest you earned so far: <b>${coin(life.stats.interest)}</b>. Interest you paid on loans: <b>${coin(life.stats.loanInterest)}</b>.</p>`);
    });
  }

  function marketSheet(msg = '') {
    sheet('🧺 Market', (body) => {
      body.insertAdjacentHTML('beforeend', head('market', 'I buy what you grow and chop. When lots of people sell the same thing, its price goes <b>down</b>. When it is rare, the price goes <b>up</b>. That is <b>supply and demand</b>!') + money());
      if (msg) body.insertAdjacentHTML('beforeend', `<p class="sw-msg">${msg}</p>`);
      const tbl = document.createElement('div'); tbl.className = 'goods';
      Town.SELLABLE.forEach(g => {
        const have = life.bag[g] || 0, price = Town.price(town, g), tr = Town.trend(town, g);
        const r = document.createElement('div'); r.className = 'good';
        r.innerHTML = `<span class="gi">${G[g].icon}</span><span class="gn"><b>${G[g].name}</b><small>you have ${have}</small></span><span class="gp ${tr}">${coin(price)} ${tr === 'up' ? '▲' : tr === 'down' ? '▼' : '•'}</span>`;
        const sell = async (n) => {
          if ((life.bag[g] || 0) < n) return;
          const res = await act({ type: 'sell', g, n });
          if (!res.ok) return marketSheet(`⚠️ ${esc(res.msg)}`);
          Life.takeItem(life, g, n); Life.earn(life, res.coins, 'soldCoins'); life.stats.sold += n;
          Sound.cash(); World.burst(World.pos().x, World.pos().y, 'coins', 10, 6); touch(); hud(); checkDream(); fact('supply'); if (G[g].seed) fact('profit');
          marketSheet(`✓ Sold ${n} ${G[g].name.toLowerCase()} for ${coin(res.coins)}.${n > 1 ? ' Each one you sold made the next one a little cheaper.' : ''}`);
        };
        r.append(row(button('Sell 1', () => sell(1), 'choice', !have), button('Sell all', () => sell(have), 'choice alt', have < 2)));
        tbl.append(r);
      });
      body.append(tbl);
      const logs = card(`<span class="where">Sawmill</span><h3>🪵 Buy logs</h3><p class="small">No time to chop? Buy logs for <b>${coin(Town.price(town, 'log') + 2)}</b> each. That is a bit more than the market pays for them: the sawmill needs a <b>profit</b> too.</p>`);
      const buyLogs = async (n) => {
        const cost = (Town.price(town, 'log') + 2) * n;
        if (life.coins < cost) return marketSheet(`⚠️ ${n} logs cost about ${coin(cost)}. You have ${coin(life.coins)}.`);
        const res = await act({ type: 'buyGood', g: 'log', n });
        if (!res.ok) return marketSheet(`⚠️ ${esc(res.msg)}`);
        Life.spend(life, res.cost); Life.addItem(life, 'log', n); Sound.cash(); touch(); hud(); marketSheet(`✓ Bought ${n} logs for ${coin(res.cost)}.`);
      };
      logs.append(row(button('Buy 1', () => buyLogs(1)), button('Buy 5', () => buyLogs(5), 'choice alt')));
      body.append(logs);
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">🌱 Seeds are bought right on your farm when you plant: ${Town.CROPS.map(c => `${G[c].icon} ${coin(G[c].seed)}`).join(' · ')}.</p>`);
    });
  }

  function schoolSheet(msg = '') {
    const lib = town.built.includes('library');
    sheet('🏫 School', (body) => {
      body.insertAdjacentHTML('beforeend', head('school', `Classes are free for everyone: the town pays for the school with taxes. Pass ${Life.CERT_AT} classes in a subject to earn its certificate. Certificates unlock better jobs!`));
      if (msg) body.insertAdjacentHTML('beforeend', `<p class="sw-msg">${msg}</p>`);
      if (lib) body.insertAdjacentHTML('beforeend', '<p class="sheet-sub">📚 The town has a library now: every class you pass counts twice!</p>');
      const grid = document.createElement('div'); grid.className = 'sw-grid';
      Object.entries(Life.SUBJECTS).forEach(([s, sub]) => {
        const n = life.school[s] || 0, got = Life.hasCert(life, s);
        const c = card(`<span class="where">${got ? '🎓 Certificate earned' : `${Math.min(n, Life.CERT_AT)}/${Life.CERT_AT} classes`}</span><h3>${sub.icon} ${sub.name}</h3><p class="small">${got ? `“${sub.cert}”` : `Earns: “${sub.cert}”`}</p>`, got ? 'solved' : '');
        c.append(button(got ? 'Practice again' : 'Take a class', () => {
          const qs = classQuestions(s, life.band, 3);
          quiz(`${sub.icon} ${sub.name} class`, qs, (score) => {
            if (score === null) return;
            life.stats.classes++;
            if (score >= 2) {
              const before = Life.hasCert(life, s);
              life.school[s] = (life.school[s] || 0) + (lib ? 2 : 1); life.rep += 1;
              const cert = !before && Life.hasCert(life, s);
              Sound.chord(cert ? 6 : 3, 'bell');
              touch(); checkDream(); hud();
              schoolSheet(cert ? `🎓 You earned the <b>${sub.cert}</b> certificate! New jobs may be open at the Jobs office.` : `✓ You passed with ${score}/3!`);
            } else { touch(); schoolSheet(`You got ${score}/3. Pass with 2 or more. Try again: every try teaches you something!`); }
          });
        }));
        grid.append(c);
      });
      body.append(grid);
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Questions are for ages ${BAND_NAMES[life.band]}. <button type="button" class="link-btn" id="bandBtn">Change</button></p>`);
      body.querySelector('#bandBtn').addEventListener('click', () => { life.band = life.band % 3 + 1; me.band = life.band; touch(); schoolSheet(`Questions are now for ages ${BAND_NAMES[life.band]}.`); });
    });
  }

  function jobsSheet(msg = '') {
    sheet('💼 Jobs & Post Office', (body) => {
      body.insertAdjacentHTML('beforeend', head('jobs', `Pick a job and go to work! A shift is a few small tasks. When you finish, you get paid a <b>wage</b>. A part goes to the town as <b>income tax</b> (${town.taxRate}% now). You can work ${Life.SHIFTS_PER_DAY} shifts a day, and experience gets you a raise.`));
      if (msg) body.insertAdjacentHTML('beforeend', `<p class="sw-msg">${msg}</p>`);
      if (life.shift) {
        const j = Life.JOBS[life.shift.job];
        const c = card(`<span class="where">At work now</span><h3>${j.icon} ${j.name}: ${life.shift.done}/${life.shift.need}</h3><p class="small">${j.how} Follow the yellow diamonds!</p>`, 'next');
        c.append(button('Stop this shift (no pay)', () => { Life.quitShift(life); touch(); hud(); jobsSheet('You stopped the shift.'); }, 'choice alt'));
        body.append(c);
      }
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Shifts today: <b>${life.shiftsToday}/${Life.SHIFTS_PER_DAY}</b></p>`);
      const grid = document.createElement('div'); grid.className = 'sw-grid';
      Object.entries(Life.JOBS).forEach(([id, j]) => {
        const can = Life.canTake(life, id), n = life.stats.shifts[id] || 0;
        const c = card(`<span class="where">${n ? `${n} shift${n === 1 ? '' : 's'} worked` : 'New job'}</span><h3 class="job-head"><span>${j.icon} ${j.name}</span><span class="wage">${coin(Life.wageOf(life, id))}</span></h3><p class="small">${j.how}</p>${can.ok ? '' : `<p class="small lock">🔒 ${esc(can.why)}</p>`}`, can.ok ? '' : 'locked-card');
        c.append(button(life.shift && life.shift.job === id ? 'Working…' : 'Start a shift', () => startShift(id), 'choice', !can.ok || !!life.shift));
        grid.append(c);
      });
      body.append(grid);
      const d = Life.DREAMS[life.dream];
      const dc = card(`<span class="where">Your dream</span><h3>${d ? `${d.icon} ${d.name} · ${esc(Life.title(life))}` : 'No dream yet'}</h3>${d ? dreamSteps() : ''}`);
      dc.append(button('Change my dream', () => dreamPicker(), 'choice alt'));
      body.append(dc);
    });
  }
  function dreamSteps() {
    const d = Life.DREAMS[life.dream];
    return d.steps.map(([text], i) => `<div class="lesson ${i < life.dreamStep ? 'done' : i === life.dreamStep ? 'next' : 'locked'}"><span class="mark">${i < life.dreamStep ? '✓' : i + 1}</span><span>${esc(text)}</span></div>`).join('')
      + (life.dreamStep >= d.steps.length ? `<div class="lesson next"><span class="mark">∞</span><span>${esc(Life.dreamGoal(life).text)}</span></div>` : '');
  }

  function hallSheet(msg = '') {
    const t = now(), mayor = town.mayor, isMayor = mayor && mayor.uid === me.uid;
    sheet('🏛️ Town Hall', (body) => {
      body.insertAdjacentHTML('beforeend', head('hall', `Everyone's taxes go into the town <b>treasury</b>. Citizens <b>vote</b> on what the town builds next. When there is enough money, the town builds the project with the most votes.`));
      if (msg) body.insertAdjacentHTML('beforeend', `<p class="sw-msg">${msg}</p>`);
      body.insertAdjacentHTML('beforeend', `<div class="wallet"><span>🏦 Treasury <b>${coin(town.treasury)}</b></span><span>📜 Income tax <b>${town.taxRate}%</b></span><span>👑 Mayor <b>${esc(mayor ? mayor.name : 'Maple')}</b></span></div>`);
      // projects
      const count = {}; Object.values(town.votes).forEach(id => { count[id] = (count[id] || 0) + 1; });
      const myVote = town.votes[me.uid];
      const pc = card('<span class="where">Vote: what should the town build next?</span><h3>🗳️ Town projects</h3>');
      Town.projectChoices(town).forEach(p => {
        const pct = Math.min(100, Math.round(town.treasury / p.cost * 100));
        const r = document.createElement('div'); r.className = 'proj';
        r.innerHTML = `<div><b>${p.icon} ${esc(p.name)}</b> · ${coin(p.cost)} · ${count[p.id] || 0} vote${count[p.id] === 1 ? '' : 's'}<br><small>${esc(p.desc)}</small><div class="progress thin"><div style="width:${pct}%"></div></div></div>`;
        r.append(button(myVote === p.id ? '✓ Your vote' : 'Vote', async () => {
          const res = await act({ type: 'vote', project: p.id });
          if (!res.ok) return hallSheet(`⚠️ ${esc(res.msg)}`);
          if (!life.seen['vote:' + town.built.length]) { life.seen['vote:' + town.built.length] = 1; life.rep += 1; }
          life.stats.votes++; Sound.bell(); touch(); checkDream(); fact('vote'); hallSheet(`✓ You voted for ${p.icon} ${esc(p.name)}.${isMayor ? ' As mayor, your vote counts 3 times!' : ''}`);
        }, myVote === p.id ? 'choice alt' : 'choice'));
        pc.append(r);
      });
      body.append(pc);
      if (town.built.length) body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Already built: ${town.built.map(id => { const p = Town.project(id); return p ? `${p.icon} ${esc(p.name)}` : ''; }).join(' · ')}</p>`);
      // elections
      const e = town.election;
      const ec = card(`<span class="where">Elections</span><h3>👑 Who leads Small Town?</h3><p class="small">The mayor sets the income tax and their vote on projects counts 3 times. Anyone with the <b>Good Citizen</b> certificate can run. People who help the town (reputation) get more votes.</p>`);
      if (e) {
        const left = Math.max(0, Math.ceil((e.closes - t) / 1000));
        ec.insertAdjacentHTML('beforeend', `<p class="small"><b>Voting is open!</b> It closes in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}. The votes are secret.</p>`);
        Object.entries(e.cand).forEach(([uid, c]) => ec.append(button(`${e.votes[me.uid] === uid ? '✓ ' : ''}Vote for ${esc(c.name)}`, async () => {
          const res = await act({ type: 'ballot', cand: uid });
          hallSheet(res.ok ? `✓ Your secret vote is in.` : `⚠️ ${esc(res.msg)}`);
        }, 'choice')));
      }
      if (!isMayor && !(e && e.cand[me.uid])) {
        const can = Life.hasCert(life, 'civics');
        ec.append(button('Run for mayor', async () => {
          const res = await act({ type: 'run', rep: life.rep });
          if (!res.ok) return hallSheet(`⚠️ ${esc(res.msg)}`);
          life.stats.ran++; touch(); checkDream(); hallSheet('✓ You are running for mayor! Ask friends to vote for you. You can vote for yourself too.');
        }, 'choice alt', !can));
        if (!can) ec.insertAdjacentHTML('beforeend', '<p class="small lock">🔒 Needs the Good Citizen certificate (School).</p>');
      }
      ec.insertAdjacentHTML('beforeend', `<p class="small">Your reputation: <b>${life.rep}</b> (work shifts, pay taxes, vote, plant trees and take classes to raise it).</p>`);
      if (town.lastElection) {
        const L = town.lastElection;
        ec.insertAdjacentHTML('beforeend', `<p class="small">Last election: ${Object.entries(L.tally).map(([u, n]) => `${esc(L.names[u])} ${n}`).join(' · ')} · ${L.winner ? '' : 'the old mayor '}${L.incumbent} votes from other citizens.</p>`);
      }
      if (isMayor) {
        ec.insertAdjacentHTML('beforeend', '<p class="small"><b>You are the mayor!</b> Higher taxes build projects faster, but everyone keeps less of their pay. Choose wisely.</p>');
        ec.append(row(...[5, 10, 15, 20].map(r => button(`${town.taxRate === r ? '✓ ' : ''}${r}%`, async () => { const res = await act({ type: 'setTax', rate: r }); hallSheet(res.ok ? `✓ Income tax is now ${r}%.` : `⚠️ ${esc(res.msg)}`); }, town.taxRate === r ? 'choice' : 'choice alt'))));
      }
      body.append(ec);
      if (town.news.length) body.append(card(`<span class="where">Town news</span>${town.news.slice(0, 6).map(n => `<p class="small">${esc(n)}</p>`).join('')}`));
    });
  }

  function rentSheet() {
    const house = Life.ownsHouse(town, me.uid);
    sheet('🏢 Apartments', (body) => {
      body.insertAdjacentHTML('beforeend', head('rent', house ? 'You own a house now, so you do not rent from me any more. Owning costs a small land tax instead of rent!' :
        `You live in one of my apartments. Rent is <b>${coin(Life.RENT)}</b> a day, paid every morning.${life.rentFree ? ` Newcomers live free for a few days: <b>${life.rentFree}</b> free days left.` : ''}`));
      body.append(card(`<span class="where">Rent or own?</span><h3>🏠 Your own house</h3><p class="small">Buy a building lot, then build a house with <b>${Town.BUILD.house.logs} logs</b> and <b>${coin(Town.BUILD.house.coins)}</b>. Then you pay only <b>${coin(Town.TAX.lot)}</b> land tax a day instead of ${coin(Life.RENT)} rent. Owning costs more at the start, and saves money later.</p>`));
      const free = Town.PLOTS.filter(pl => !(town.plots[pl.id] && town.plots[pl.id].owner));
      const lc = card(`<span class="where">Land for sale</span><h3>🏡 ${free.length} plots for sale</h3>`);
      free.slice(0, 8).forEach(pl => lc.append(button(`${pl.kind === 'farm' ? '🌱 Farm' : '🏗️ Lot'} ${pl.id} · ${coin(pl.price)} · tax ${Town.TAX[pl.kind]}/day · show me`, () => { guide = { ...plotCenter(pl), h: 8, id: pl.id }; closeSheet(); toast(`Follow the yellow diamond to ${pl.id}!`); }, 'choice alt')));
      body.append(lc);
      fact('rent');
    });
  }

  /* ---------------- land, farming, building ---------------- */
  function buyLand(pl) {
    sheet(`${pl.kind === 'farm' ? '🌱 Farm land' : '🏗️ Building lot'} ${pl.id}`, (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">${pl.kind === 'farm' ? 'Farm land has 6 soil beds. Plant seeds, water them, harvest, and sell at the market.' : 'On a building lot you can build a house (no more rent!) or a shop (it sells things for you every morning).'}</p>
        <div class="wallet"><span>🏷️ Price <b>${coin(pl.price)}</b></span><span>🏛️ Land tax <b>${coin(Town.TAX[pl.kind])}/day</b></span></div>${money()}`);
      if (life.coins < pl.price) body.insertAdjacentHTML('beforeend', `<p class="sw-msg">You need ${coin(pl.price - life.coins)} more. Work shifts and sell crops to save up, or borrow at the Bank (you will pay interest).</p>`);
      body.append(row(button(`Buy for ${coin(pl.price)}`, async () => {
        if (life.coins < pl.price) return;
        const res = await act({ type: 'buyPlot', id: pl.id });
        if (!res.ok) { closeSheet(); return toast(`⚠️ ${esc(res.msg)}`); }
        Life.spend(life, res.cost); Sound.chord(2, 'bell'); World.burst(pl.x + pl.w / 2, pl.y + pl.h / 2, 'confetti', 30, 4);
        if (guide && guide.id === pl.id) guide = null;
        touch(); hud(); closeSheet(); checkDream(); fact('land');
        toast(`<span class="t-small">🏡 It's yours!</span>${pl.kind === 'farm' ? 'Walk to a soil bed and plant seeds.' : 'Stand on it to build. You need logs: chop trees or buy them at the Market.'}`, { big: true, life: 5 });
      }, 'big-btn small', life.coins < pl.price), button('Not now', closeSheet, 'choice alt')));
    });
  }
  function plantPicker(id, i) {
    sheet('🌱 What will you plant?', (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Seeds cost coins now; the crop sells later. The difference is your <b>profit</b>. Water it after planting!</p>${money()}`);
      const grid = document.createElement('div'); grid.className = 'sw-grid';
      [...Town.CROPS, 'tree'].forEach(k => {
        const g = G[k], sells = k === 'tree' ? `3 logs (${coin(Town.price(town, 'log') * 3)})` : coin(Town.price(town, k));
        const c = card(`<h3>${g.icon} ${g.name}</h3><p class="small">Seed ${coin(g.seed)} · grows in ${Math.round(g.grow / 6000) / 10} min · sells for ${sells}</p>`);
        c.append(button(`Plant for ${coin(g.seed)}`, async () => {
          if (life.coins < g.seed) return;
          const res = await act({ type: 'plant', id, i, k });
          closeSheet();
          if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
          Life.spend(life, g.seed); life.stats.planted++; Sound.plant(); const s = Town.soilSpot(Town.PLOT_BY_ID[id], i); World.burst(s.x, s.y, 'seeds', 10, 1);
          touch(); hud(); toast(`${g.icon} Planted! Now water it 💧`);
        }, 'choice', life.coins < g.seed));
        grid.append(c);
      });
      body.append(grid);
    });
  }
  async function water(id, i) {
    const res = await act({ type: 'water', id, i });
    if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
    Sound.water(); const s = Town.soilSpot(Town.PLOT_BY_ID[id], i); World.burst(s.x, s.y, 'water', 14, 4); World.mood('love', 1);
  }
  async function harvest(id, i) {
    const res = await act({ type: 'harvest', id, i, bonus: life.shift ? false : Math.random() < 0.25 });
    if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
    const s = Town.soilSpot(Town.PLOT_BY_ID[id], i);
    Object.entries(res.items).forEach(([g, n]) => { Life.addItem(life, g, n); World.floatText(s.x, s.y, `+${n} ${G[g].icon}`); });
    life.stats.harvested++; Sound.pop(); Sound.plant(); World.burst(s.x, s.y, 'leaves', 12, 2); World.mood('laugh', 1);
    touch(); hud(); checkDream();
  }
  function buildPicker(id) {
    sheet('🔨 What will you build?', (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">You have <b>${life.bag.log || 0} 🪵 logs</b> and <b>${coin(life.coins)}</b>. Chop trees in the Town Forest, or buy logs at the Market.</p>`);
      const grid = document.createElement('div'); grid.className = 'sw-grid';
      Object.entries(Town.BUILD).forEach(([k, b]) => {
        const ok = (life.bag.log || 0) >= b.logs && life.coins >= b.coins;
        const c = card(`<h3>${b.icon} ${b.name}</h3><p class="small">${b.logs} logs + ${coin(b.coins)}. ${k === 'house' ? 'No more rent: you own your home.' : 'Put goods on the shelf; customers buy them every morning for more than the market pays.'}</p>`);
        c.append(button(ok ? `Build a ${b.name.toLowerCase()}` : `Need ${Math.max(0, b.logs - (life.bag.log || 0))} logs, ${coin(Math.max(0, b.coins - life.coins))}`, async () => {
          const res = await act({ type: 'build', id, kind: k });
          closeSheet();
          if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
          Life.takeItem(life, 'log', b.logs); Life.spend(life, b.coins); life.stats.built++;
          [0, 250, 500].forEach(ms => setTimeout(() => Sound.hammer(), ms));
          const pl = Town.PLOT_BY_ID[id]; World.burst(pl.x + pl.w / 2, pl.y + pl.h / 2, 'wood', 24, 4);
          toast(`<span class="t-small">${b.icon} Building…</span>The builders are putting it up right now. Watch!`, { big: true });
          touch(); hud(); setTimeout(checkDream, 1000);
        }, 'choice', !ok));
        grid.append(c);
      });
      body.append(grid);
    });
  }
  function shelfSheet(msg = '') {
    sheet('🏪 Your shop', (body) => {
      const on = Object.entries(life.shelf).filter(([, n]) => n > 0);
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Every morning, customers buy up to 5 things from your shelf. They pay the market price <b>+3🪙</b>. Buying low and selling higher is how shops make a <b>profit</b>.</p>`);
      if (msg) body.insertAdjacentHTML('beforeend', `<p class="sw-msg">${msg}</p>`);
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">On the shelf: ${on.length ? on.map(([g, n]) => `${G[g].icon}×${n}`).join(' ') : 'nothing yet'}</p>`);
      const tbl = document.createElement('div'); tbl.className = 'goods';
      Town.SELLABLE.forEach(g => {
        const have = life.bag[g] || 0;
        const r = document.createElement('div'); r.className = 'good';
        r.innerHTML = `<span class="gi">${G[g].icon}</span><span class="gn"><b>${G[g].name}</b><small>you have ${have}</small></span><span class="gp">sells ~${coin(Town.price(town, g) + 3)}</span>`;
        r.append(button('Put 1 on shelf', () => { if (!Life.takeItem(life, g, 1)) return; life.shelf[g] = (life.shelf[g] || 0) + 1; life.stats.stocked++; touch(); hud(); checkDream(); shelfSheet(`✓ ${G[g].icon} is on the shelf.`); }, 'choice', !have));
        tbl.append(r);
      });
      body.append(tbl);
    });
  }

  /* ---------------- the forest and the town farm ---------------- */
  async function chop(tr) {
    const left = Town.forestLeft(town);
    if (life.owesSapling) return toast('🌱 Cut one, plant one! Plant a sapling on a stump first (follow the diamond).');
    if (left <= 10) return toast(`🌲 Only ${left} trees are left. The forest needs to grow back first. Plant saplings on the stumps!`);
    const res = await act({ type: 'chop', tree: tr.id });
    if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
    const n = 2;
    Life.addItem(life, 'log', n); life.stats.chopped++; life.owesSapling = 1;
    [0, 180, 360].forEach(ms => setTimeout(() => Sound.chop(), ms));
    World.burst(tr.x, tr.y, 'leaves', 18, 6); World.burst(tr.x, tr.y, 'wood', 8, 2); World.floatText(tr.x, tr.y, `+${n} 🪵`);
    if (life.shift && life.shift.job === 'lumberjack') workStep();
    touch(); hud(); checkDream(); fact('chop');
    toast('🪵 +2 logs. Now plant a sapling on a stump, so the forest grows back.');
  }
  async function replant(tr) {
    const res = await act({ type: 'replant', tree: tr.id });
    if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
    const owed = life.owesSapling; life.owesSapling = 0; life.stats.replanted++; life.rep += 1;
    Sound.plant(); World.burst(tr.x, tr.y, 'seeds', 12, 1); World.mood('love', 1.2);
    if (life.shift && life.shift.job === 'lumberjack') workStep();
    else if (!owed) { Life.earn(life, 1); World.floatText(tr.x, tr.y, '+1🪙'); }
    touch(); hud(); checkDream();
  }
  let volunteer = 0;
  async function farmwork(i) {
    const res = await act({ type: 'farmwork', i });
    if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
    const s = Town.FARM_SPOTS[i]; Sound.pop(); World.burst(s.x, s.y, 'leaves', 10, 2);
    if (life.shift && life.shift.job === 'farmhand') return workStep();
    if (volunteer < 5) { volunteer++; life.rep += 1; touch(); }
    toast('🧺 Thank you! The Town Farm feeds the town kitchen. Want to be paid for this? Take a Farmhand job at the Jobs office.');
  }

  /* ---------------- work ---------------- */
  function startShift(id) {
    const t = now();
    let targets = [];
    if (id === 'mail') targets = Town.BUILDINGS.filter(b => b.id !== 'jobs').sort(() => Math.random() - 0.5).slice(0, 3).map(b => b.id);
    if (id === 'builder') {
      const free = Town.PLOTS.filter(p => p.kind === 'lot' && !(town.plots[p.id] && town.plots[p.id].build));
      targets = (free.length >= 3 ? free : Town.PLOTS.filter(p => p.kind === 'lot')).sort(() => Math.random() - 0.5).slice(0, 3).map(p => p.id);
    }
    const r = Life.startShift(life, id, targets);
    if (!r.ok) return jobsSheet(`⚠️ ${esc(r.why)}`);
    touch(); hud(); closeSheet();
    const j = Life.JOBS[id];
    Sound.bell();
    toast(`<span class="t-small">${j.icon} Go to work!</span>${j.how} Follow the yellow diamonds.`, { big: true, life: 5 });
    fact('wage'); void t;
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
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">You finished a ${j.icon} ${j.name} shift. Here is your pay slip:</p>
        <div class="budget"><div><span>Wage</span><b>${coin(pay.gross)}</b></div><div><span>Income tax to the town (${pay.rate}%)</span><b class="neg">−${coin(pay.tax)}</b></div><div class="total"><span>You get</span><b>${coin(pay.net)}</b></div></div>
        <p class="sheet-sub">${pay.raise ? `🎉 Experience pays: your wage for this job is now <b>${coin(pay.next)}</b>!` : `Shifts left today: <b>${Life.SHIFTS_PER_DAY - life.shiftsToday}</b>.`} Taxes pay for the school, roads and town projects.</p>`);
      body.append(button('Great!', closeSheet, 'big-btn small'));
    }));
  }
  function deliver(id) {
    const s = life.shift; if (!s || !s.targets.includes(id)) return;
    Sound.pop(); World.say('npc:' + id, 'A letter for me? Thank you! 💌', 3); World.npcMood(id, 'love', 2);
    workStep(id);
  }
  function hammer(id) {
    const s = life.shift; if (!s || !s.targets.includes(id)) return;
    [0, 200, 400].forEach(ms => setTimeout(() => Sound.hammer(), ms));
    const pl = Town.PLOT_BY_ID[id]; World.burst(pl.x + pl.w / 2, pl.y + pl.h / 2, 'dust', 16, 3);
    workStep(id);
  }
  function deskTask(bid) {
    const s = life.shift; if (!s) return;
    const subj = Life.DESK_JOBS[s.job], subject = subj === 'any' ? ['money', 'civics', 'tools', 'math', 'science'][Math.floor(Math.random() * 5)] : subj;
    const q = classQuestions(subject, life.band, 1);
    quiz(`${Life.JOBS[s.job].icon} A customer asks…`, q, (score) => {
      if (score === null) return;
      if (score >= 1) { World.say('npc:' + bid, 'Thanks for helping!', 3); workStep(); }
      else toast('The customer went to think about it. Try the next one!');
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
    volunteer = 0;
    if (r.taxes) act({ type: 'tax', n: r.taxes });
    if (r.borrowed) fact('loan');
    later(() => sheet(`☀️ Good morning! Day ${day - life.firstDay + 1}`, (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Yesterday you earned <b>${coin(r.yesterday.earned)}</b> and spent <b>${coin(r.yesterday.spent)}</b>. Here is this morning's budget:</p>`);
      const b = document.createElement('div'); b.className = 'budget';
      b.innerHTML = r.lines.map(l => `<div><span>${esc(l.label)}</span><b class="${l.n < 0 ? 'neg' : l.n > 0 ? 'pos' : ''}">${l.note ? esc(l.note) : l.n > 0 ? '+' + coin(l.n) : l.n < 0 ? '−' + coin(-l.n) : '0'}</b></div>`).join('')
        + `<div class="total"><span>Pocket now</span><b>${coin(r.coins)}</b></div>`;
      body.append(b);
      if (r.borrowed) body.insertAdjacentHTML('beforeend', `<p class="sw-msg">You did not have enough coins for the bills, so the bank lent you <b>${coin(r.borrowed)}</b>. Loans grow every day: pay it back at the Bank when you can.</p>`);
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Savings <b>${coin(r.bank)}</b>${r.loan ? ` · Loan <b>${coin(r.loan)}</b>` : ''}. ${r.bank ? 'Your savings grew while you slept!' : 'Tip: coins saved in the Bank grow every morning.'}</p>`);
      body.append(button('Start the day ☀', closeSheet, 'big-btn small'));
    }));
    hud(); checkDream();
  }

  /* ---------------- dreams ---------------- */
  function dreamPicker(first) {
    sheet(first ? 'What do you dream of becoming?' : 'Change your dream', (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">In Small World you can become anything. You just have to work toward it, step by step, like in real life. You can change your dream later.</p>`);
      const grid = document.createElement('div'); grid.className = 'sw-grid dreams';
      Object.entries(Life.DREAMS).forEach(([id, d]) => {
        const b = button(`<span class="dream-icon">${d.icon}</span><b>${d.name}</b><small>${d.desc}</small>`, () => {
          if (life.dream !== id) { life.dream = id; life.dreamStep = 0; life.dreamLv = 0; life.dreamMark = life.stats.earned; }
          touch(); closeSheet(); checkDream(); hud();
          const g = Life.dreamGoal(life);
          toast(`<span class="t-small">${d.icon} Your dream: ${d.name}</span>First step: ${esc(g.text)}. Follow the yellow diamond!`, { big: true, life: 6 });
        }, 'mode-card' + (life.dream === id ? ' on' : ''));
        grid.append(b);
      });
      body.append(grid);
    });
  }

  /* ---------------- my life ---------------- */
  function lifeSheet() {
    sheet(`${me.name}'s life`, (body) => {
      const d = Life.DREAMS[life.dream];
      body.insertAdjacentHTML('beforeend', money());
      body.insertAdjacentHTML('beforeend', `<div class="wallet"><span>🎒 ${Object.entries(life.bag).filter(([, n]) => n).map(([g, n]) => `${G[g].icon}×${n}`).join(' ') || 'Your bag is empty'}</span></div>`);
      const plots = myPlots(), house = Life.ownsHouse(town, me.uid);
      body.append(card(`<span class="where">Home and land</span><h3>${house ? '🏠 You own a house' : `🏢 You rent an apartment (${coin(Life.RENT)}/day)`}</h3><p class="small">${plots.length ? plots.map(p => `${p.plot.kind === 'farm' ? '🌱' : p.build === 'shop' ? '🏪' : p.build === 'house' ? '🏠' : '🏗️'} ${p.id}`).join(' · ') + ` · land tax ${coin(plots.reduce((a, p) => a + Town.TAX[p.plot.kind], 0))}/day` : 'No land yet. Land for sale has yellow signs.'}</p>`));
      body.append(card(`<span class="where">School</span><h3>🎓 ${Life.certCount(life)} certificates</h3><p class="small">${Object.entries(Life.SUBJECTS).map(([s, x]) => `${x.icon} ${Life.hasCert(life, s) ? '✓' : `${life.school[s] || 0}/${Life.CERT_AT}`}`).join(' · ')}</p>`));
      body.append(card(`<span class="where">Work</span><h3>💼 ${life.shift ? `${Life.JOBS[life.shift.job].icon} At work: ${life.shift.done}/${life.shift.need}` : 'Not at work'}</h3><p class="small">${Object.entries(life.stats.shifts).map(([j, n]) => `${Life.JOBS[j].icon} ${n} shifts`).join(' · ') || 'Visit the Jobs office to start working.'}</p>`));
      const dc = card(`<span class="where">Dream</span><h3>${d ? `${d.icon} ${esc(Life.title(life))}` : 'No dream yet'}</h3>${d ? dreamSteps() : ''}`);
      dc.append(button('Change my dream', () => dreamPicker(), 'choice alt'));
      body.append(dc);
      body.append(card(`<span class="where">Your story so far</span><p class="small">Earned ${coin(life.stats.earned)} · paid ${coin(life.stats.taxPaid)} of taxes · harvested ${life.stats.harvested} crops · chopped ${life.stats.chopped} trees and planted ${life.stats.replanted} · reputation ${life.rep}</p>`));
    });
  }

  /* ---------------- map ---------------- */
  let mapMarks = [];
  const MAPB = { x0: 3380, x1: 6220, y0: -160, y1: 2640 };
  function drawMap(c, big) {
    const x = c.getContext('2d'), W = c.width, H = c.height, k = Math.min(W / (MAPB.x1 - MAPB.x0), H / (MAPB.y1 - MAPB.y0));
    const X = gx => (gx - MAPB.x0) * k, Y = gy => (gy - MAPB.y0) * k, t = now();
    x.fillStyle = '#b4dc7a'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#9fca68'; x.fillRect(X(3680), Y(120), 900 * k, 720 * k);
    x.strokeStyle = '#e9d9b0'; x.lineCap = 'round'; x.lineWidth = Math.max(3, 80 * k);
    Town.ROADS.forEach(([ax, ay, bx, by]) => { x.beginPath(); x.moveTo(X(Math.max(ax, MAPB.x0)), Y(ay)); x.lineTo(X(bx), Y(by)); x.stroke(); });
    x.fillStyle = '#efe3c4'; x.beginPath(); x.arc(X(Town.PLAZA.x), Y(Town.PLAZA.y), Town.PLAZA.r * k, 0, 7); x.fill();
    const F = Town.TOWN_FARM; x.fillStyle = '#a0673b'; x.fillRect(X(F.x), Y(F.y), F.w * k, F.h * k);
    Town.PLOTS.forEach(p => {
      const st = town && town.plots[p.id], mine = st && st.owner === me.uid;
      x.fillStyle = mine ? '#ffd23f' : st && st.owner ? (p.kind === 'farm' ? '#8f5d36' : '#d8cdb4') : (p.kind === 'farm' ? '#c7a57a' : '#cfe3a8');
      x.fillRect(X(p.x), Y(p.y), p.w * k, p.h * k);
      x.strokeStyle = '#34233f'; x.lineWidth = mine ? 2 : 1; x.strokeRect(X(p.x), Y(p.y), p.w * k, p.h * k);
      if (big) { x.fillStyle = '#34233f'; x.font = `800 ${Math.max(9, 38 * k)}px "Baloo 2", system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(p.id, X(p.x + p.w / 2), Y(p.y + p.h / 2)); x.textBaseline = 'alphabetic'; }
    });
    if (town) Town.FOREST.forEach(tr => { const st = Town.treeState(town, tr.id, t); x.fillStyle = st === 'tree' ? '#5f9e57' : st === 'stump' ? '#9a6a44' : '#9dd46e'; x.beginPath(); x.arc(X(tr.x), Y(tr.y), Math.max(1.5, (st === 'tree' ? 30 : 16) * k), 0, 7); x.fill(); });
    Town.BUILDINGS.forEach(b => {
      x.fillStyle = '#fff3d6'; x.strokeStyle = '#34233f'; x.lineWidth = 1.5;
      x.fillRect(X(b.x - b.w / 2), Y(b.y - 45 - 130), b.w * k, 130 * k); x.strokeRect(X(b.x - b.w / 2), Y(b.y - 45 - 130), b.w * k, 130 * k);
      x.font = `${Math.max(10, 70 * k)}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b.icon, X(b.x), Y(b.y - 110));
    });
    if (big) Town.BUILDINGS.forEach(b => {
      x.font = `800 ${Math.max(11, 40 * k)}px "Baloo 2", system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'top'; x.lineJoin = 'round';
      const name = b.id === 'jobs' ? 'Jobs' : b.name;
      x.lineWidth = 4; x.strokeStyle = '#fff8e8'; x.strokeText(name, X(b.x), Y(b.y - 40)); x.fillStyle = '#34233f'; x.fillText(name, X(b.x), Y(b.y - 40));
    });
    x.textBaseline = 'alphabetic';
    mapMarks.forEach(m => { x.fillStyle = '#ffd23f'; x.strokeStyle = '#34233f'; x.lineWidth = 1.5; x.beginPath(); const px = X(m.x), py = Y(m.y), r = Math.max(4, 40 * k); x.moveTo(px, py - r); x.lineTo(px + r * 0.7, py); x.lineTo(px, py + r); x.lineTo(px - r * 0.7, py); x.closePath(); x.fill(); x.stroke(); });
    Net.others.forEach(o => { if (o.x == null) return; x.fillStyle = o.color; x.strokeStyle = '#fff8e8'; x.lineWidth = 2; x.beginPath(); x.arc(X(o.x), Y(o.y), Math.max(3.5, 40 * k), 0, 7); x.fill(); x.stroke(); });
    const p = World.pos(); x.fillStyle = me.color; x.strokeStyle = '#34233f'; x.lineWidth = 2.5; x.beginPath(); x.arc(X(p.x), Y(p.y), Math.max(4.5, 50 * k), 0, 7); x.fill(); x.stroke();
  }
  function mapSheet() {
    sheet('🗺️ Small Town', (body) => {
      const c = document.createElement('canvas'); c.className = 'map-canvas'; c.width = 720; c.height = 710;
      const wrap = document.createElement('div'); wrap.className = 'map-wrap'; wrap.append(c); body.append(wrap);
      drawMap(c, true);
      body.insertAdjacentHTML('beforeend', '<p class="map-legend">🟡 your land and where to go next · colored dots are friends · tap a place to get a guide</p>');
      const r = row(...Town.BUILDINGS.map(b => button(`${b.icon} ${b.name}`, () => { const k = keeper(b.id); guide = { x: k.x, y: k.y, h: 13 }; closeSheet(); toast(`Follow the yellow diamond to the ${b.name}!`); }, 'choice alt')));
      r.append(button('🌲 Forest', () => { guide = { x: 4130, y: 480, h: 12 }; closeSheet(); }, 'choice alt'), button('🌾 Town Farm', () => { guide = { x: 5520, y: 470, h: 10 }; closeSheet(); }, 'choice alt'));
      body.append(r);
    });
  }
  $('minimap').addEventListener('click', () => { Sound.blip(); mapSheet(); });
  $('mapBtn').addEventListener('click', () => { Sound.blip(); mapSheet(); });
  $('lifeBtn').addEventListener('click', () => { Sound.blip(); lifeSheet(); });
  $('goal').addEventListener('click', () => { Sound.blip(); if (!life.dream) dreamPicker(true); else jobsSheet(); });
  $('shiftPill').addEventListener('click', () => { Sound.blip(); jobsSheet(); });

  /* ---------------- menu ---------------- */
  $('menuBtn').addEventListener('click', (e) => { e.stopPropagation(); $('menuPop').hidden = !$('menuPop').hidden; });
  document.addEventListener('click', (e) => { if (!e.target.closest('#menuPop') && e.target.id !== 'menuBtn') $('menuPop').hidden = true; });
  $('soundBtn').addEventListener('click', () => { const m = Sound.toggle(); $('soundIcon').textContent = m ? '🔇' : '🔊'; });
  $('grownBtn').addEventListener('click', () => { $('menuPop').hidden = true; Care.grownUp(); });
  $('awayBtn').addEventListener('click', () => { $('menuPop').hidden = true; Care.goAway(); });
  $('dreamBtn').addEventListener('click', () => { $('menuPop').hidden = true; dreamPicker(); });
  $('friendsBtn2').addEventListener('click', () => { $('menuPop').hidden = true; if (online()) friendsSheet(); else roomSheet(); });
  $('roomPill').addEventListener('click', () => { Sound.blip(); friendsSheet(); });
  $('helpBtn').addEventListener('click', () => { $('menuPop').hidden = true; helpSheet(); });
  function helpSheet() {
    sheet('How Small World works', (body) => {
      body.insertAdjacentHTML('beforeend', `<div class="lesson next"><span class="mark">1</span><span><b>Work</b> at the 💼 Jobs office to earn wages. A little goes to the town as tax.</span></div>
        <div class="lesson next"><span class="mark">2</span><span><b>Learn</b> at the 🏫 School. Certificates unlock better jobs.</span></div>
        <div class="lesson next"><span class="mark">3</span><span><b>Save</b> at the 🏦 Bank (it grows!), or borrow (it costs interest).</span></div>
        <div class="lesson next"><span class="mark">4</span><span><b>Buy land</b>: farms grow crops, lots hold houses and shops. Land has a daily tax.</span></div>
        <div class="lesson next"><span class="mark">5</span><span><b>Sell</b> at the 🧺 Market. Prices change with supply and demand.</span></div>
        <div class="lesson next"><span class="mark">6</span><span><b>Vote</b> at the 🏛️ Town Hall. Taxes build parks, a library, a clinic and more.</span></div>
        <div class="lesson next"><span class="mark">∞</span><span><b>Chase your dream</b>, step by step. It never ends: there is always a next level.</span></div>
        <p class="sheet-sub">Walk: WASD or arrows, or drag on a phone. Do things: Space, E or the big button. Hop: Space when nothing is near, or a quick tap.</p>`);
    });
  }

  /* ---------------- friends and rooms ---------------- */
  function roomSheet(msg = '') {
    sheet('👥 Play with friends', (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Pick a room name. Friends who type the same name live in the same Small Town with you: the same land, market, votes and mayor.</p>
        <form class="answer-row" id="roomForm"><input id="roomIn" maxlength="8" autocomplete="off" autocapitalize="characters" placeholder="67NM" aria-label="Room name"><button class="choice alt" type="button" id="roomDice" aria-label="Make up a room name">🎲</button><button class="choice" type="submit">Enter room</button></form>
        <p class="mp-msg ${msg ? 'err' : ''}" id="roomMsg">${esc(msg)}</p>
        <p class="sheet-sub">Your coins, certificates and dream come with you. Land belongs to the town where you bought it.</p>`);
      const inp = body.querySelector('#roomIn'); inp.value = S && S.lastRoom || '';
      body.querySelector('#roomDice').addEventListener('click', () => { inp.value = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''); });
      body.querySelector('#roomForm').addEventListener('submit', (e) => { e.preventDefault(); enterRoom(inp.value); });
    });
  }
  async function enterRoom(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 3 || code.length > 8) { const m = $('roomMsg'); if (m) m.textContent = 'Room names need 3 to 8 letters or numbers, like 67NM.'; return false; }
    const m = $('roomMsg'); if (m) m.textContent = 'Connecting…';
    Net.onStatus((s) => { const el = $('roomMsg'); if (el) el.textContent = `Waking up the server… ${s}s (free servers nap when nobody plays)`; });
    try { await Net.enter(code, me.name, me.color, 'team', me.uid); S = S || {}; S.lastRoom = code; return true; }
    catch (e) { const el = $('roomMsg'); if (el) { el.textContent = e.code === 'offline' ? 'Friends need the online version of the game.' : 'Could not connect. Check the internet and try again.'; el.classList.add('err'); } return false; }
  }
  function friendsSheet() {
    sheet(`👥 Room ${Net.code}`, (body) => {
      const link = `${location.origin}${location.pathname}?room=${Net.code}`;
      body.insertAdjacentHTML('beforeend', `<div class="code-box"><div><span class="mp-label">Room name</span><div class="code">${esc(Net.code)}</div></div></div><p class="sheet-sub">Friends type <b>${esc(Net.code)}</b> in “Play with friends”, or open this link:</p><p class="link-line">${esc(link)}</p>`);
      const list = document.createElement('div'); list.className = 'players';
      const rowFor = (name, color, sub, isMe) => `<div class="player-row ${isMe ? 'me' : ''}"><span class="dot" style="background:${color}"></span><span class="who">${esc(name)}${isMe ? ' (you)' : ''}</span><span class="stats"><span class="stat">${esc(sub || '')}</span></span></div>`;
      list.innerHTML = rowFor(me.name, me.color, Life.title(life), true) + [...Net.others.values()].map(o => rowFor(o.name, o.color, o.ti, false)).join('');
      body.append(list);
      body.append(row(button('📋 Copy link', () => { navigator.clipboard && navigator.clipboard.writeText(link).then(() => toast('Link copied!')).catch(() => {}); }, 'choice'),
        button('Leave room', () => { Net.leave(); Talk.leave(); goSolo(); closeSheet(); toast('You are back in your own Small Town.'); }, 'choice alt')));
    });
  }
  function goSolo() {
    if (!solo) solo = Town.newTown(Date.now());
    Town.settle(solo, Date.now());
    builtSeen = null; mayorSeen = null; newsSeen = null;
    onTown(solo); hud();
  }
  // the room gives everyone a different hoodie color
  const takeColor = (c) => { if (c && c !== me.color) { me.color = c; World.setMe({ color: c }); touch(); } };
  Net.on('me', (p) => takeColor(p.color));
  Net.on('joined', (m) => {
    const mine = m.players.find(p => p.id === m.you); if (mine) takeColor(mine.color);
    builtSeen = null; mayorSeen = null; newsSeen = null;
    closeSheet();
    onTown(m.town);
    toast(`<span class="t-small">👥 Room ${esc(m.code)}</span>${m.created ? 'You made a new town! Share the room name with friends.' : 'Welcome to your friends\' town!'}`, { big: true, life: 4 });
    hud(); Talk.refresh();
    if (!life.day || life.day !== Life.dayOf(now())) dayTick();
  });
  Net.on('town', (m) => onTown(m.town));
  Net.on('arrived', (p) => { toast(`👋 ${esc(p.name)} moved to Small Town. Go say hi!`); Sound.bell(); hud(); });
  Net.on('left', () => hud());
  Net.on('disconnected', ({ replaced }) => { toast(replaced ? 'You opened Small World somewhere else, so this window left the room.' : 'Lost the connection. You are back in your own town.'); goSolo(); Talk.refresh(); });
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
  });

  /* ---------------- the loop ---------------- */
  let hudT = 0, dayT = 0, mapT = 0, lastKeeperSay = {};
  function tick(dt) {
    if (!playing) return;
    if (Care.tick(dt, $('sheet').hidden)) { target = null; renderAction(); return; }
    const t = now();
    target = busy() ? null : findTarget();
    renderAction();
    // townsfolk say hello when you walk up
    if (target && target.key.startsWith('npc:')) {
      const id = target.key.slice(4);
      if (!lastKeeperSay[id] || performance.now() - lastKeeperSay[id] > 60000) { lastKeeperSay[id] = performance.now(); World.say('npc:' + id, HINTS[id], 4); }
    }
    if (guide && dist(World.pos(), guide) < 60) guide = null;
    const st = World.state();
    pos = World.pos();
    if (online()) Net.state({ x: Math.round(pos.x), y: Math.round(pos.y), mood: st.mood, moving: st.moving, face: st.face, z: st.hop, title: Life.title(life) });
    if ((hudT -= dt) <= 0) { hudT = 0.5; hud(); markers(); World.setDay(window.__sw.dayOverride ?? Life.dayFrac(t)); }
    if ((dayT -= dt) <= 0) { dayT = 2; dayTick(); if (dirty) save(); }
    if ((mapT -= dt) <= 0) { mapT = 0.25; drawMap($('minimap'), false); }
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
    if (life) { $('startBtn').textContent = 'Continue my life ☀'; $('newBtn').hidden = false; }
    const go = async (withFriends) => {
      Sound.init();
      const name = nameIn.value.replace(/\s+/g, ' ').trim().slice(0, 14);
      if (name.length < 2) { $('titleMsg').textContent = 'Type your name first (2 letters or more).'; nameIn.focus(); return; }
      me.name = name;
      const fresh = !life;
      if (fresh) life = Life.fresh(me.band); else life.band = me.band;
      if (!solo) solo = Town.newTown(Date.now());
      $('title').hidden = true; $('hud').hidden = false; $('minimap').hidden = false;
      World.setMe({ color: me.color });
      if (pos && pos.x) World.place(pos.x, pos.y);
      playing = true;
      goSolo();
      dayTick();
      save();
      if (fresh) later(() => welcome());
      else if (!life.dream) later(() => dreamPicker(true));
      if (withFriends) roomSheet();
      const fromLink = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (fromLink.length >= 3 && !withFriends) { roomSheet(); $('roomIn').value = fromLink; }
    };
    $('startBtn').addEventListener('click', () => go(false));
    $('friendsBtn').addEventListener('click', () => go(true));
    $('newBtn').addEventListener('click', () => {
      if (!confirm('Start a brand new life? Your coins, land and dream in this browser will be gone.')) return;
      life = null; solo = null; pos = null; localStorage.removeItem(KEY); location.reload();
    });
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(false); });
    drawHero();
  }
  // The hero on the title screen. The drawing spans y -66.5 (antenna ball) to +31.5 (hoodie) around the head,
  // so it is scaled and centred from those bounds with a margin: nothing is ever cut off. It bobs and blinks.
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
    sheet('Welcome to Small Town! 🏡', (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Small Town works like the real world, just smaller. You start with <b>${coin(life.coins)}</b> and a room at the Apartments (the first days are free).</p>
        <div class="lesson next"><span class="mark">💼</span><span>Work to earn money. Learn to earn more.</span></div>
        <div class="lesson next"><span class="mark">🏦</span><span>Save it, spend it, or invest it in land.</span></div>
        <div class="lesson next"><span class="mark">🏛️</span><span>Pay taxes, vote, and help the town grow.</span></div>
        <p class="sheet-sub">First, choose your dream. Everything you want to become, you work toward, step by step.</p>`);
      body.append(button('Choose my dream ✨', () => { sheetOnClose = null; closeSheet(); dreamPicker(true); }, 'big-btn small'));
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
    Care.onWarn((min) => toast(`<span class="t-small">😴 Break soon</span>${min >= 1 ? 'In 2 minutes' : 'In 30 seconds'} it is time for a little rest. Finish what you are doing!`, { life: 4 }));
    World.start({
      now,
      tick,
      busy,
      onSpace: () => doAction(),
      others: () => Net.others.values(),
      tagInfo: () => ({ me: { name: me.name, sub: Life.title(life || Life.fresh(2)), talking: Talk.level('me') > 0.08 }, others: (id) => ({ talking: Talk.level(id) > 0.08 }) }),
      onHop: () => Sound.pop(),
    }).then(() => {
      $('boot').classList.add('gone');
      if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
      titleScreen();
    }).catch((e) => { $('boot').textContent = 'Small World could not start 3D on this device: ' + e.message; console.error(e); });
  }
  window.__sw = { life: () => life, town: () => town, me };   // for tests and curious grown-ups
  if (window.World) boot(); else addEventListener('world-ready', boot, { once: true });
})();
