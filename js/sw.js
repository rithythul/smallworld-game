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
  const bandOfAge = (age) => age <= 8 ? 1 : age <= 12 ? 2 : 3;
  const R = () => Life.rules(life);   // the money and quiz rules for this kid's age
  // what each keeper says when you walk up: short
  const HELLO = {
    hall: 'Vote! Taxes build the town.', bank: 'Save coins. They grow!', market: 'I buy crops, fish and logs.',
    school: 'Learn → better jobs.', jobs: 'Want a job?', rent: 'Rent, or build your own home.',
    station: 'All aboard! 🚆', tech: 'Sell online, code, make ads.', biz: 'Start a company!', studio: 'Make videos 🎬',
    dealer: 'Bikes, cars, planes!', airport: 'Fly away on a trip ✈️', harbor: 'Boat to the island ⛵', space: 'Train for space 🚀',
    stadium: 'Score goals on the field ⚽', museum: 'Dinosaurs inside! 🦕', zoo: 'Come see the animals', cafe: 'Hot cocoa? ☕',
    arcade: 'Beat the high score 🕹️', hotel: 'Stay the night 🏨',
    exchange: 'Buy shares. Prices move every day 📈', office: 'Busy busy! Want an office job?', gallery: 'Come see the paintings 🖼️', concert: 'Tonight: the town orchestra 🎻',
    ranch: 'Milk the cows, collect the eggs 🐄', orchard: 'Pick apples! 🍎', mine: 'Dig for ore and crystals ⛏️', lodge: 'Snow is perfect today 🎿',
    hotsprings: 'Warm water, happy muscles ♨️', icecream: 'Two scoops? 🍦', lighthouse: 'Climb up and look out 🗼', university: 'Study hard, earn a degree 🎓',
    castle: 'This castle is 500 years old 🏰', boathouse: 'Row across the lake 🛶', sawmill: 'Logs pay well here 🪵', treehouse: 'Up the ladder! 🛖',
    observatory: 'See the stars any time 🔭', mart: 'This town pays more for what it wants.',
  };
  // fun places: what they cost and what they give
  const FUN = {
    cafe: { cost: 3, why: 'Hot cocoa at the Cafe' }, arcade: { cost: 2, why: 'Arcade game' }, hotel: { cost: 10, why: 'A night at the Hotel' },
    museum: {}, zoo: {}, gallery: {}, lighthouse: {}, castle: { fact: true }, treehouse: {}, observatory: {}, hotsprings: {},
    concert: { cost: 4, why: 'A concert ticket' }, lodge: { cost: 5, why: 'A ski pass' }, icecream: { cost: 2, why: 'Ice cream' }, boathouse: { cost: 3, why: 'A rowing boat for an hour' },
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
  let leaving = false;   // set when another game is being loaded: nothing may save this one over it on the way out
  function save() {
    if (leaving) return;
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
        if (/^festival/.test(id)) World.celebrate(40);
      });
    }
    builtSeen = t.built.length;
    // festival gifts: remembered per town, so one built while you were away still reaches you
    if (life) {
      const key = townKey(), seen = life.townSeen[key];
      if (typeof seen === 'number' && t.built.length > seen) t.built.slice(seen).filter(id => /^festival/.test(id)).forEach(id => Life.earn(life, 5, 'gifts', '🎆', `Festival gift from the town (${Town.project(id).name})`, 'The town spent its taxes on a festival, and every citizen gets 5 coins.'));
      life.townSeen[key] = t.built.length;
      if (Life.ownsHouse(t, me.uid)) life.home = key;
      fixShift();
      if (sheetKind === 'market' && !$('sheet').hidden && !selling) marketSheet(marketMsg);
    }
    spawnBricks();
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

  const here = () => World.trip ? 0 : Town.districtAt(town, World.pos().x);
  const townKey = () => online() ? 'room:' + Net.code : 'solo';
  // land you bought in a friends' town is written down, so if the server ever resets that town you get your coins back
  function landBook(id, info, key = townKey()) {
    if (!key.startsWith('room:')) return;
    const book = life.land[key] = life.land[key] || {};
    if (info === null) delete book[id]; else book[id] = { ...(book[id] || {}), ...info };
  }
  function checkLandBook() {
    const book = life.land[townKey()]; if (!book || !town) return;
    Object.entries(book).forEach(([id, r]) => {
      const st = town.plots[id]; if (st && st.owner === me.uid) return;
      if (r.selling) {   // you were selling it when the connection dropped: the sale went through
        const half = Math.floor((r.cost || 0) / 2) + Math.floor((r.buildCoins || 0) / 2);
        if (half) Life.earn(life, half, null, '🏡', `Sold land ${id} back to the town`, 'The connection dropped while you were selling, but the sale went through: half of what it cost.');
      } else {
        const back = (r.cost || 0) + (r.buildCoins || 0);
        if (back) Life.earn(life, back, null, '🔁', `Refund: land ${id} is gone`, 'The server started this friends\' town over, so your land and what you built on it are gone. Here are your coins back.');
      }
      if ((r.build === 'house' || r.build === 'villa') && life.home === townKey()) life.home = null;
      delete book[id];
    });
    touch(); hud();
  }

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
  let sheetOnClose = null, sheetKind = null;
  function sheet(title, render, onClose) {
    sheetKind = null;
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
  const busy = () => !playing || sleeping || !$('sheet').hidden || !$('title').hidden || Care.locked || World.riding || (Talk.open && document.activeElement && document.activeElement.id === 'chatInput');
  const queue = [];
  // things to show once nothing covers the screen. first = true puts it at the front (money explanations go first).
  function later(fn, first) { if ($('sheet').hidden && playing && !sleeping && !World.riding) fn(); else if (first) queue.unshift(fn); else queue.push(fn); }
  // keep going until something opens a sheet (toasts do not stop the line)
  function flushQueue() { while ($('sheet').hidden && queue.length && !sleeping && !World.riding) queue.shift()(); releaseChips(); }
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
  // retry: a wrong tap wiggles and the right answer glows; the question ends when the right one is tapped.
  // score counts answers right on the first try.
  function quiz(title, questions, onDone, { retry = false } = {}) {
    let i = 0, score = 0;
    if (typeof Music !== 'undefined') Music.duck(true);
    const show = () => sheet(title, (body) => {
      const q = questions[i], sub = SUBJECTS[q.s] || { icon: '❓', name: '' };
      let missed = false;
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">${sub.icon} ${'●'.repeat(i + 1)}${'○'.repeat(questions.length - i - 1)}</p>${q.pic ? `<div class="quiz-pic">${esc(q.pic)}</div>` : ''}${q.q ? `<h3 class="quiz-q">${esc(q.q)}</h3>` : ''}`);
      const box = document.createElement('div'); box.className = 'quiz-opts' + (q.pic ? ' pics' : '');
      const next = () => body.appendChild(button(i < questions.length - 1 ? '→' : '✓', () => { i++; if (i < questions.length) show(); else { sheetOnClose = null; closeSheet(); if (typeof Music !== 'undefined') Music.duck(false); onDone(score); } }, 'big-btn small'));
      q.o.forEach((opt, k) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'quiz-opt' + (q.pic ? ' pic' : ''); b.textContent = opt;
        b.addEventListener('click', () => {
          const right = k === q.a;
          if (retry && !right) {
            missed = true; Sound.wrong(); b.classList.remove('wiggle'); void b.offsetWidth; b.classList.add('wiggle');
            box.children[q.a].classList.add('glow'); return;
          }
          if (right && !missed) score++;
          right ? Sound.discover() : Sound.wrong();
          box.querySelectorAll('button').forEach((x, j) => { x.disabled = true; if (j === q.a) x.classList.add('right'); else if (j === k) x.classList.add('wrong'); });
          if (retry && right && !missed) floatMe('⭐+1', 'task');
          body.insertAdjacentHTML('beforeend', `<p class="quiz-why ${right ? 'ok' : ''}">${right ? '✓ ' : '💡 '}${esc(q.why)}</p>`);
          next();
        });
        box.appendChild(b);
      });
      body.appendChild(box);
    }, () => { if (typeof Music !== 'undefined') Music.duck(false); onDone(null); });
    show();
  }
  // science and life snacks: a short fact the first time something happens
  const KID_FACTS = ['dawn', 'drink', 'sleep', 'kidtax'];
  function fact(trigger) {
    if (!life) return;
    if (life.band === 1 && !KID_FACTS.includes(trigger)) return;   // saved for when they are older
    const list = (typeof FACT_BY_TRIGGER !== 'undefined' && FACT_BY_TRIGGER[trigger]) || [];
    const f = list.find(x => !life.seen['f:' + x.id]); if (!f) return;
    life.seen['f:' + f.id] = 1; touch();
    facts.push(f); if (facts.length === 1) nextFact();
  }
  // one fact at a time, so there is time to read each one
  const facts = [];
  function nextFact() {
    const f = facts[0]; if (!f) return;
    later(() => { toast(life.band === 1 ? `💡 ${esc(f.title)}` : `<span class="t-small">💡 ${esc(f.title)}</span>${esc(f.text)}`, { life: life.band === 1 ? 3 : 6 }); setTimeout(() => { facts.shift(); nextFact(); }, life.band === 1 ? 3500 : 7000); });
  }
  let floatAt = 0, floatN = 0;
  function floatMe(text, cls = 'pay') {
    const p = World.pos(), t = performance.now();
    floatN = t - floatAt < 900 ? floatN + 1 : 0; floatAt = t;
    World.floatText(p.x, p.y - floatN * 34, text, cls);
  }
  function memory(id) {
    if (!Life.remember(life, id)) return;
    const [icon, name] = Life.MEMORIES[id];
    toast(`<span class="t-small">📸 New memory · ⭐ +5</span>${icon} ${esc(name)}`, { big: true, life: 4 });
    Sound.chord(3, 'bell'); touch(); checkDream();
  }

  /* ---------------- receipts: every coin change says why, right next to your coins ---------------- */
  const needCoins = (n) => `⚠️ You need ${n}🪙 and you have ${life.coins}🪙.`;
  const sign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
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
    if (delta || show.length) liveWallet();
    if (!show.length) return;
    const box = $('receipts');
    const morning = show.filter(e => e.morning);
    const chip = (html, cls) => {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'receipt ' + cls; el.innerHTML = html;
      el.addEventListener('click', () => { Sound.blip(); moneySheet(); });
      box.appendChild(el); while (box.children.length > 4) box.firstChild.remove();
      el.dataset.life = cls === 'neg' ? 7000 : 4500;
      if ($('sheet').hidden) fadeChip(el); else held.push(el);   // wait until the sheet is closed, so it can be read
    };
    if (morning.length > 2) {   // the morning budget sheet explains these; one summary chip here
      const sum = (f) => morning.filter(f).reduce((a, e) => a + e.n, 0);
      const net = sum(e => e.acct === 'pocket' && !e.move), sav = sum(e => e.acct === 'bank' && e.n < 0), owed = sum(e => e.acct === 'loan');
      chip(`☀️ Morning bills & income: <b class="${net < 0 ? 'neg' : 'pos'}">${sign(net)}🪙</b>${sav ? ` · 🐷 paid ${-sav}` : ''}${owed > 0 ? ` · <b class="neg">you owe ${owed} more</b>` : ''}<small>Tap to see why</small>`, net < 0 || owed > 0 ? 'neg' : '');
    }
    if (life.band === 1) fresh.filter(e => e.acct === 'pocket' && e.n < 0 && !e.buy && !e.move).forEach(e => console.error('[band1] unflagged drop', e));
    show.filter(e => !(morning.length > 2 && e.morning)).slice(-5).forEach(e => chip(
      e.buy ? `🛍️ ${e.icon} ${life.band === 1 ? '✓' : `${esc(e.why)} <b>${Math.abs(e.n)}🪙</b>`}` :
      e.move && e.acct === 'pocket' ? `${e.icon} ${esc(e.why)} <b>${Math.abs(e.n)}🪙</b><small>${e.n < 0 ? 'Still yours, just in another place.' : ''}</small>`
        : `<b class="${good(e) ? 'pos' : 'neg'}">${amt(e)}</b> ${e.icon} ${esc(e.why)}${e.acct === 'bank' ? ` <em>${ACCT.bank}</em>` : ''}${!good(e) && e.how ? `<small>${esc(e.how)}</small>` : ''}`,
      e.buy ? 'buy' : e.move && e.acct === 'pocket' ? 'move' : good(e) ? '' : 'neg'));
    if (delta) { const pill = $('coinPill'), chose = show.every(e => e.n > 0 || e.buy || e.move); pill.classList.remove('up', 'down', 'spent'); void pill.offsetWidth; pill.classList.add(delta > 0 ? 'up' : chose ? 'spent' : 'down'); }
  }
  // chips wait while a sheet covers them, then fade after a few seconds
  const held = [];
  function fadeChip(el) { const ms = +el.dataset.life || 4500; setTimeout(() => el.classList.add('out'), ms - 500); setTimeout(() => el.remove(), ms); }
  function releaseChips() { if ($('sheet').hidden) held.splice(0).forEach(fadeChip); }
  // every wallet on screen shows the coins you have right now
  function liveWallet() { document.querySelectorAll('.wallet.live').forEach(w => { const html = walletHTML(); if (w.innerHTML !== html) { w.innerHTML = html; w.classList.remove('flash'); void w.offsetWidth; w.classList.add('flash'); } }); }
  function moneySheet() {
    sheet('👛 Money history', (body) => {
      body.insertAdjacentHTML('beforeend', money());
      const today = life.today;
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Today (bills included): earned <b class="pos">${coin(today.earned)}</b> · spent <b class="neg">${coin(today.spent)}</b> · income tax <b>${coin(today.tax)}</b></p>`);
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
    if (online()) Net.card(myCard());
    snailTick();
    if (!life) return;
    const t = now(), h = Life.hourOf(t), rain = Town.raining(t);
    const icon = rain ? '🌧️' : h < 7 ? '🌅' : h < 18 ? '☀️' : h < 20 ? '🌇' : '🌙';
    const day = Life.dayOf(t) - (life.firstDay || Life.dayOf(t)) + 1;
    set('clockIcon', icon); set('clockDay', `Day ${day} · `); set('clockText', Life.clock(t));
    set('coinText', String(life.coins));
    const owe = life.loan + (life.iou || 0);
    set('oweText', owe ? `💸${owe}` : ''); $('oweText').hidden = !owe;
    receipts();
    [1, 2, 3].forEach(b => document.body.classList.toggle('b' + b, life.band === b));
    const lv = Life.starLevel(life.xp), lo = Life.starsFor(lv), hi = Life.starsFor(lv + 1);
    set('starText', String(life.xp)); set('lvText', `Lv ${lv}`);
    $('starRing').style.setProperty('--p', Math.round((life.xp - lo) / (hi - lo) * 100) + '%');
    Object.keys(Life.RITUALS).forEach(id => {
      const el = document.querySelector(`#ritualStrip [data-r="${id}"]`), st = Life.ritualState(life, id, t);
      if (el.dataset.s !== st) { el.dataset.s = st; el.className = st; }
      if (st === 'open' && !life.today.bell[id] && playing) { life.today.bell[id] = 1; Sound.bell(); }
    });
    levelTick();
    set('bagText', String(Life.bagCount(life)));
    const g = nextThing(), where = g && placeFor(g.at);
    set('goalText', g ? `${where && where.grow ? '🏙️ ' : ''}${g.icon} ${life.band === 1 && g.dots ? g.dots : g.text}` : '✨ Pick a dream');
    const kind = g ? g.key.split(':')[0] : 'dream';
    set('goalLabel', life.band === 1 ? '➤' : ({ rit: 'Now', sap: 'Now', start: 'Start', daily: 'Today', dream: 'Dream', free: 'Explore' })[kind] || 'Dream');
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
  const spotsNow = () => World.trip ? World.tripSpots(World.trip) : Town.spotsOf(town);
  const HOME = Town.HOME;
  const homeDoor = () => { const h = myPlots().find(p => p.build === 'house' || p.build === 'villa'); if (h) return { ...plotCenter(h.plot), own: true }; const k = keeper('rent'); return k ? { x: k.x, y: k.y + 20 } : { x: 4040, y: 2230 }; };
  // Where should the guide arrow point for this goal? Places not built yet point to the Town Hall: help the town grow!
  function placeFor(at) {
    if (!at || !town) return null;
    const p = World.pos ? World.pos() : { x: 4800, y: 1500 }, t = now();
    const hall = () => { const k = keeper('hall'); return k && { x: k.x, y: k.y, h: 13, grow: true }; };
    const K = (type) => { const k = nearest(World.keepers.filter(q => q.type === type), p); return k ? { x: k.x, y: k.y, h: 13 } : null; };
    if (['jobs', 'bank', 'market', 'school', 'hall', 'rent'].includes(at)) return K(at);
    if (['tech', 'biz', 'studio', 'dealer', 'airport', 'harbor', 'space', 'station', 'exchange', 'office', 'ranch', 'orchard', 'mine', 'lodge', 'hotsprings', 'university', 'mart', 'gallery'].includes(at)) return K(at) || hall();
    if (at.startsWith('work:')) { const type = at.split(':')[1], ready = Town.workOf(town).filter(w => w.type === type && t - (town.work[w.id] || 0) >= Town.WORK_REGROW), all = Town.workOf(town).filter(w => w.type === type); const w = nearest(ready.length ? ready : all, p); return w ? { x: w.x, y: w.y, h: 7 } : hall(); }
    if (at.startsWith('kind:')) {   // a town of a kind (or the next kind you have not seen)
      const want = at.split(':')[1], ds = Town.districtsOf(town).filter(d => want === 'next' ? !life.kindsSeen[d.kind] : d.kind === want);
      const d = nearest(ds.map(q => ({ x: q.gate.x + 200, y: q.gate.y - 60, d: q })), p);
      return d ? { x: d.x, y: d.y, h: 12 } : hall();
    }
    if (at === 'tree' || at === 'stump') { const tr = nearest(Town.FOREST.filter(x => Town.treeState(town, x.id, t) === at), p) || (at === 'stump' && nearest(Town.FOREST.filter(x => Town.treeState(town, x.id, t) === 'tree'), p)); return tr ? { x: tr.x, y: tr.y, h: at === 'tree' ? 12 : 5 } : null; }
    if (at === 'market' && !Town.SELLABLE.some(g => life.bag[g])) return placeFor('townfarm');   // nothing to sell yet: go and pick something first
    if (at === 'farmland' || at === 'lot') { const f = nearest(Town.allPlots(town).filter(pl => pl.kind === (at === 'lot' ? 'lot' : 'farm') && !(town.plots[pl.id] && town.plots[pl.id].owner)).map(pl => ({ ...plotCenter(pl), id: pl.id })), p); return f ? { ...f, h: 8 } : null; }
    if (at === 'myfarm' || at === 'mylot') { const m = myPlots().find(q => q.plot.kind === (at === 'mylot' ? 'lot' : 'farm')); return m ? { ...plotCenter(m.plot), h: 9 } : placeFor(at === 'mylot' ? 'lot' : 'farmland'); }
    if (at === 'nature' || at.startsWith('spot:')) {
      const type = at.split(':')[1], list = Town.spotsOf(town).filter(s => !type || s.type === type);
      const s = nearest(list, p); return s ? { x: s.x, y: s.y, h: 8 } : hall();
    }
    if (at === 'townfarm') { const ready = Town.FARM_SPOTS.filter((s, i) => t - (town.farm[i] || 0) >= Town.FARM_REGROW); const s = nearest(ready.length ? ready : Town.FARM_SPOTS, p); return { x: s.x, y: s.y, h: 7 }; }
    if (at === 'pool') return { x: HOME.pool.x, y: HOME.pool.y - HOME.pool.ry + 30, h: 6 };
    if (at === 'tap') return town.built.includes('fountain') && dist(p, Town.PROJECT_SPOTS.fountain) < dist(p, HOME.tap) ? { ...Town.PROJECT_SPOTS.fountain, h: 8 } : { ...HOME.tap, h: 8 };
    if (at === 'home') return { ...homeDoor(), h: 12 };
    if (at.startsWith('wild:')) { const good = at.slice(5), it = nearest((World.wildItems ? World.wildItems() : []).filter(q => q.good === good), p); return it ? { x: it.x, y: it.y, h: 6 } : null; }
    if (at === 'brick') { const b = nearest((World.pickups ? World.pickups() : []).filter(q => q.kind === 'brick'), p); return b ? { x: b.x, y: b.y, h: 5 } : null; }
    if (at === 'ball') return { ...(World.ballAt ? World.ballAt() : Town.BALL), h: 5 };
    if (at === 'npc') { const k = nearest(World.keepers.filter(q => !life.today.hello[q.id]), p); return k ? { x: k.x, y: k.y, h: 13 } : null; }
    if (at === 'stop') { if (World.busOn) { const s = nearest(Town.stopsOf(town), p); return { x: s.x, y: s.y, h: 10 }; } return Town.stationsOf(town).length > 1 ? K('station') : hall(); }
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
    // home life: hop in the pool, drink at the tap, go to bed
    if (!World.swimming && Town.inPool(p.x, p.y, 80)) add({ key: 'pool', label: 'Swim', icon: '🏊', cls: 'work', run: () => hopInPool() }, 30);
    const tap = town.built.includes('fountain') && dist(p, Town.PROJECT_SPOTS.fountain) < 190 ? Town.PROJECT_SPOTS.fountain : HOME.tap;
    { const d = dist(p, tap); if (d < (tap === HOME.tap ? 60 : 190)) add({ key: 'tap', label: 'Drink', icon: '💧', cls: 'water', run: () => sip() }, d, 10); }
    if (Life.ritualState(life, 'sleep', t) === 'open') { const h = homeDoor(), d = dist(p, h); if (d < (h.own ? 110 : 80)) add({ key: 'bed', label: 'Sleep', icon: '🛏️', cls: 'buy', run: () => goSleep() }, d, 30); }
    if (wonder && wonder.type === 'stars' && !life.wonders['wish:' + wonder.id]) add({ key: 'wish', label: 'Wish', icon: '🌠', cls: 'buy', run: () => makeWish() }, 90);   // anything close by comes first; otherwise the big button is a wish
    // things to pick and animals to say hello to
    if (World.wildItems && inWildNow()) {
      World.wildItems().forEach(it => { const d = dist(p, it); if (d < 100) { const g = G[it.good] || {}; add({ key: 'item:' + it.id, label: life.band === 1 ? '' : `Pick ${(g.name || '').toLowerCase()}`, icon: g.icon || '🧺', cls: 'work', run: () => pickWild(it) }, d, 10); } });
      World.wildAnimals().forEach(an => { const d = dist(p, an); if (d < 90) add({ key: 'pet:' + an.id, label: life.band === 1 ? '' : 'Say hi', icon: ANIMAL_INFO[an.kind] || '🐾', cls: 'talk', run: () => petAnimal(an) }, d, 5); });
    }
    // a discovery in the Wild
    if (World.wildSpots && inWildNow()) World.wildSpots().forEach(q => { if (life.wild[q.id]) return; const d = dist(p, q); if (d < 130) { const [icon, name] = wildSpotName(q); add({ key: 'wild:' + q.id, label: life.band === 1 ? '' : name, icon, cls: 'buy', run: () => discover(q) }, d, 20); } });
    // a friend close by: see their card (anything else close by comes first)
    if (online()) Net.others.forEach(o => { const ox = o.tx ?? o.x, oy = o.ty ?? o.y; if (ox == null) return; const d = dist(p, { x: ox, y: oy }); if (d < 55) add({ key: 'card:' + o.id, label: o.name, icon: '👋', cls: 'talk', run: () => cardSheet(o) }, d + 40); });
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
    // milking, eggs, apples and ore in the new towns
    if (!World.trip) Town.workOf(town).forEach(w => {
      const d = dist(p, w); if (d > 60) return;
      const ready = t - (town.work[w.id] || 0) >= Town.WORK_REGROW, S = GATHER[w.type];
      add(ready ? { key: 'gather:' + w.id, label: S.label, icon: S.icon, cls: 'work', run: () => gather(w) } : { key: 'wait:' + w.id, label: '⏳', icon: S.icon, cls: 'look idle', run: () => toast(`${S.icon} ⏳`) }, d, Life.WORK_JOB[w.type] === job ? 20 : 0);
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
    if (!life || !town) return;
    const done = life.dream ? Life.checkDream(life, { plots: myPlots() }) : [];
    done.forEach(text => later(() => {
      Sound.chord(4, 'bell'); World.burst(World.pos().x, World.pos().y, 'confetti', 30, 6); World.mood('love', 2);
      const g = Life.dreamGoal(life);
      toast(`<span class="t-small">${esc(Life.title(life))} · ⭐+2</span>✓ ${esc(text)}${g ? `<br>→ ${g.icon} ${esc(g.text)}` : ''}`, { big: true, life: 4 });
    }));
    // the first four steps of a new life
    Life.checkStarter(life).forEach(st => { floatMe(`${st.icon} ✓ ⭐+1`, 'task'); Sound.chord(2, 'bell'); });
    if ((life.starter || 0) >= Life.STARTER.length && !life.dream && !life.seen.pickedDream) { life.seen.pickedDream = 1; later(() => { if (!life.dream) dreamPicker(true); }); }
    if (done.length) touch();
  }
  let guide = null, mapMarks = [], wonder = null, sleeping = false;
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
      if (['rancher', 'picker', 'miner'].includes(job)) Town.workOf(town).filter(w => Life.WORK_JOB[w.type] === job && t - (town.work[w.id] || 0) >= Town.WORK_REGROW).forEach(w => list.push({ x: w.x, y: w.y, h: 7 }));
      if (job === 'ranger') { const done = sh.targets || [], night = Life.hourOf(t) >= 19.5; spotsNow().filter(s => !done.includes(s.id) && !(life.spotAt[s.id] && t - life.spotAt[s.id] < 90000) && (s.type !== 'stars' || night) && s.type !== 'home').slice(0, 4).forEach(s => list.push({ x: s.x, y: s.y, h: 8 })); }
      if (job === 'lumberjack') {
        const want = life.owesSapling || Town.forestLeft(town) <= 10 ? 'stump' : 'tree';
        Town.FOREST.filter(tr => Town.treeState(town, tr.id, t) === want).sort((a, b) => dist(World.pos(), a) - dist(World.pos(), b)).slice(0, 3).forEach(tr => list.push({ x: tr.x, y: tr.y, h: want === 'tree' ? 12 : 5 }));
      }
      if (list.length) arrow = { ...nearest(list, World.pos()), icon: Life.JOBS[job].icon };
    } else if (guide) { list.push({ x: guide.x, y: guide.y, h: guide.h || 12 }); arrow = { ...guide, icon: guide.icon || '📍' }; }
    else { const g = nextThing(), w = g && placeFor(g.at); if (w) { list.push(w); arrow = { ...w, icon: w.grow ? '🏙️' : g.icon, key: g.key }; } }
    World.markers(list); World.guide(arrow);
    mapMarks = list;
    trail(arrow);
  }
  // The one obvious next thing, in this order: a sapling you owe, a ritual that is open now, the first four steps,
  // (little kids: a challenge), your dream, (older kids: a challenge), then a nature spot to discover.
  function nextThing() {
    if (!life) return null;
    const t = now(), lvl = life.band === 1;
    if (life.owesSapling && noStumps()) life.owesSapling = 0;
    if (life.owesSapling) return { key: 'sap', icon: '🌱', text: 'Plant a sapling', at: 'stump' };
    const g0 = life.dream && Life.dreamGoal(life);
    if (g0 && g0.at === 'spot:stars' && Life.hourOf(t) >= 19.5 && !World.trip) return { key: 'dream:' + g0.i, icon: g0.icon, text: g0.text, at: g0.at };   // the stars only come out at night
    const r = Life.ritualNext(life, t);
    if (r && !World.trip) { const T = Life.RITUALS[r]; return { key: 'rit:' + r, icon: T.icon, text: T.name, at: T.at }; }
    if ((life.starter || 0) < Life.STARTER.length) { const st = Life.STARTER[life.starter || 0]; return { key: 'start:' + st.id, icon: st.icon, text: st.text, dots: st.of ? '●'.repeat(st.n(life)) + '○'.repeat(st.of - st.n(life)) : '', at: st.id === 'sell' && !Town.SELLABLE.some(g => life.bag[g]) ? 'townfarm' : st.at }; }
    const dailyNext = () => { const d = life.daily; const c = d && d.day === life.day && (d.list.find(x => !x.done && Life.DAILY_BY_ID[x.id].at) || d.list.find(x => !x.done)); if (!c) return null; const D = Life.DAILY_BY_ID[c.id]; return D.at ? { key: 'daily:' + c.id, icon: D.icon, text: `${D.text} ${c.n}/${c.goal}`, dots: c.goal <= 5 ? '●'.repeat(c.n) + '○'.repeat(c.goal - c.n) : `${c.n}/${c.goal}`, at: D.at } : null; };
    if (!life.dream) return { key: 'dream', icon: '✨', text: 'Pick a dream', at: null };
    if (lvl) { const d = dailyNext(); if (d) return d; }
    const g = Life.dreamGoal(life);
    const night = Life.hourOf(t) >= 19.5;
    if (g && !(g.at === 'spot:stars' && !night)) return { key: 'dream:' + g.i, icon: g.icon, text: g.text, dots: g.of ? '●'.repeat(g.i) + '○'.repeat(g.of - g.i) : '', at: g.at };
    const d = dailyNext(); if (d) return d;
    if (g) return { key: 'dream:' + g.i, icon: g.icon, text: g.text + (g.at === 'spot:stars' ? ' 🌙' : ''), dots: g.at === 'spot:stars' ? '🔭🌙' : '', at: g.at === 'spot:stars' ? null : g.at };
    const s = Town.OLD_SPOTS.find(q => !life.seen['s:' + q.id]);
    return s ? { key: 'free:' + s.id, icon: SPOT[s.type].icon, text: SPOT[s.type].label, at: 'spot:' + s.type } : null;
  }
  // sparkle coins along the way to the next thing: kids learn "follow the arrow" by walking
  let trailKey = null;
  function trail(arrow) {
    if (!World.addPickups || World.trip) return;
    const key = arrow ? `${arrow.key || ''}:${Math.round(arrow.x / 50)}:${Math.round(arrow.y / 50)}` : null;
    if (key === trailKey) return;
    trailKey = key; World.clearPickups('trail');
    const cap = R().caps.trail, used = life.today.bonus.trail || 0, p = World.pos();
    if (!arrow || cap - used <= 0 || dist(p, arrow) < 300) return;
    World.addPickups([0.25, 0.5, 0.75].slice(0, cap - used).map((f, i) => ({ id: `trail:${Date.now()}:${i}`, x: p.x + (arrow.x - p.x) * f, y: p.y + (arrow.y - p.y) * f, kind: 'coin' })));
  }

  /* ---------------- the places ---------------- */
  function openPlace(type, id) {
    Sound.pop(); World.npcMood(id, 'love', 1.5);
    if (!life.today.hello[id]) { life.today.hello[id] = 1; daily('hello'); }
    const fn = ({ bank: bankSheet, market: () => marketSheet('', 0), school: schoolSheet, jobs: jobsSheet, hall: hallSheet, rent: rentSheet, station: stationSheet,
      tech: techSheet, biz: bizSheet, studio: studioSheet, dealer: dealerSheet, airport: airportSheet, harbor: harborSheet, space: spaceSheet, stadium: stadiumSheet,
      exchange: exchangeSheet, office: jobsSheet, university: universitySheet, ranch: () => workPlaceSheet('ranch'), orchard: () => workPlaceSheet('orchard'), mine: () => workPlaceSheet('mine'),
      mart: () => marketSheet('', here()), sawmill: () => marketSheet('', here()) })[type];
    if (fn) fn(); else funSheet(type);
  }
  const placeInfo = (type) => (places().find(p => (p.type || p.id) === type) || Town.PLACES[type] || {});
  const head = (type, text) => { const P = placeInfo(type); return `<div class="keeper"><span class="keeper-icon">${P.icon || '👋'}</span><div><b>${esc((P.npc || {}).name || '')}</b><p>${text}</p></div></div>`; };
  const walletHTML = () => `<span>👛 <b>${coin(life.coins)}</b></span><span>🐷 <b>${coin(life.bank)}</b></span>${life.loan ? `<span class="owe">💸 <b>${coin(life.loan)}</b></span>` : ''}`;
  const money = () => `<div class="wallet live">${walletHTML()}</div>`;

  function bankSheet(msg = '') {
    const owned = myPlots().length, lim = Life.loanLimit(life, owned);
    const Rr = R();
    sheet('🏦 Bank', (body) => {
      body.insertAdjacentHTML('beforeend', head('bank', `Saved coins grow <b>+${Rr.saveRate}%</b> every morning.${Rr.loans ? ` Loans grow <b>+${Rr.loanRate}%</b>.` : ''}`) + money());
      if (msg) note(body, msg);
      const doIt = (what, n, ok) => { const before = { bank: life.bank, loan: life.loan }; const r = Life.bank(life, what, n, owned); if (!r.ok) return bankSheet(`⚠️ ${r.why}`); Sound.cash(); if (what === 'deposit') daily('save', life.bank - before.bank); if (what === 'repay') daily('repay', before.loan - life.loan); touch(); hud(); checkDream(); if (what === 'deposit') fact('interest'); if (what === 'borrow') fact('loan'); bankSheet(ok); };
      const it = Life.interestTomorrow(life);
      if (life.band === 1) {   // a piggy bank: put in, take out, watch it grow
        body.append(card(`<h3 class="piggy">🐷 ${coin(life.bank)} <small class="pos">☀️ +${it.save}</small></h3>`));
        body.lastChild.append(row(button('+5', () => doIt('deposit', 5, '✓ 🐷'), 'choice', life.coins < 5), button('+10', () => doIt('deposit', 10, '✓ 🐷'), 'choice', life.coins < 10), button('👛 ←', () => doIt('withdraw', life.bank, '✓ 👛'), 'choice alt', !life.bank)));
        return;
      }
      if (life.iou) body.append(card(`<h3>🧾 ${coin(life.iou)} <small>owed, no interest</small></h3>`), row(button('Pay', () => doIt('iou', Math.min(life.iou, life.coins), '✓ 🧾'), 'choice', !life.coins)));
      body.append(card(`<h3>🐷 ${coin(life.bank)} <small class="pos">📈 +${it.save} tomorrow</small></h3>${life.bank > 0 && it.save < 1 ? `<p class="small">${Rr.saveRate}% of a small amount is less than 1 coin, so it grows in tiny pieces that add up.</p>` : ''}<p class="small">If your pocket cannot pay a bill, your savings pay it.</p>`));
      body.lastChild.append(row(
        button('+10', () => doIt('deposit', 10, '✓ 🐷 +10'), 'choice', life.coins < 10),
        button('+½', () => doIt('deposit', Math.floor(life.coins / 2), '✓ 🐷'), 'choice', life.coins < 2),
        button('−10', () => doIt('withdraw', 10, '✓ 👛 +10'), 'choice alt', life.bank < 10),
        button('−all', () => doIt('withdraw', life.bank, '✓ 👛'), 'choice alt', !life.bank)));
      if (!Rr.loans && !life.loan) return;
      body.append(card(`<h3>💸 ${coin(life.loan)} <small class="neg">📉 +${it.loan} tomorrow</small></h3><p class="small">Borrowed coins grow ${Rr.loanRate}% every morning until you pay them back. Max ${coin(lim)}</p>`));
      body.lastChild.append(row(
        button('+20', () => doIt('borrow', 20, '✓ 💸 +20'), 'choice alt', life.loan + 20 > lim),
        button('+50', () => doIt('borrow', 50, '✓ 💸 +50'), 'choice alt', life.loan + 50 > lim),
        button('Pay 10', () => doIt('repay', 10, '✓'), 'choice', !life.loan || life.coins < Math.min(10, life.loan)),
        button('Pay all', () => doIt('repay', Math.min(life.loan, life.coins), life.coins >= life.loan ? '🎉 0 💸' : '✓'), 'choice', !life.loan || !life.coins)));
    });
  }

  let selling = false, marketMsg = '';
  // after the market paid (right away or late): items were already taken from the bag
  function afterSell(g, n, res, shown) {
    const each = res.each || [], sold = each.length || n, dropped = sold > 1 && each[each.length - 1] < each[0];
    if (sold < n) Life.addItem(life, g, n - sold);   // the market buys up to 50 at a time
    const lower = shown != null && res.coins < shown - 1 && !R().fairPrice;
    const why = !lower ? '' : online() ? `Someone in this town sold ${G[g].name.toLowerCase()} a moment before you, so the price was lower (${shown} shown, ${res.coins} paid).` : `Prices slowly go back to normal, and it moved a little since the market opened (${shown} shown, ${res.coins} paid).`;
    const sum = each.length > 8 ? `${each.slice(0, 3).join(' + ')} + … + ${each.slice(-2).join(' + ')}` : each.join(' + ');
    if (res.mult > 1) life.stats.localBonus = (life.stats.localBonus || 0) + 1;
    const how = [res.mult > 1 ? `This town wants ${G[g].name.toLowerCase()}, so it pays ×${res.mult}.` : '', sold > 1 ? `${sum} = ${res.coins}.` : '', dropped ? 'Each one you sold made the next one a bit cheaper (more supply → lower price).' : '', why, sold < n ? `The market buys up to ${Town.SELL_MAX} at a time. You still have ${n - sold}.` : ''].filter(Boolean).join(' ');
    Life.earn(life, res.coins, 'soldCoins', G[g].icon, `Sold ${sold} ${G[g].name.toLowerCase()} at the market`, how); life.stats.sold += sold;
    // little kids get at least the usual price: the gap is a separate bonus (shared prices stay real), up to a daily limit
    if (R().fairPrice) {
      const top = Math.max(0, Town.usual(g) * sold - res.coins);
      if (top) { const got = Life.kidBonus(life, 'fair', top, '⚖️', 'Fair price bonus', `Kids get at least the usual price (${Town.usual(g)} each), up to ${R().caps.fair} extra coins a day.`); life.stats.soldCoins += got; }
    }
    daily('sell', sold);
    Sound.cash(); World.burst(World.pos().x, World.pos().y, 'coins', 10, 6); touch(); hud(); checkDream(); fact('supply'); if (G[g].seed) fact('profit');
    return how;
  }
  let marketAt = 0;
  function marketSheet(msg = '', at = marketAt) {
    marketMsg = msg; marketAt = at || 0;
    const D = at ? Town.district(at) : null, mult = (g) => Town.localMult(at, g), wanted = Town.SELLABLE.filter(g => mult(g) > 1);
    sheet(D ? `🛒 ${D.name} Market` : '🧺 Market', (body) => {
      body.insertAdjacentHTML('beforeend', head(D ? 'mart' : 'market', D ? `${D.icon} ${D.kindName} wants: ${wanted.map(g => `${G[g].icon} ×${mult(g)}`).join(' ') || '·'}. Sell things where people want them!` : 'When lots of people sell something, its price goes down ▼. Prices slowly come back up when nobody sells.') + money());
      if (msg) note(body, msg);
      // shown = what the tile promised, so we can explain if the town pays less
      const sell = async (g, n, shown) => {
        if ((life.bag[g] || 0) < n || !n || selling) return;
        selling = true;
        Life.takeItem(life, g, n);   // held for the sale; back in the bag if the market says no
        const res = await act({ type: 'sell', g, n, at: marketAt || undefined });
        selling = false;
        if (!res.ok) { if (!res.slow) Life.addItem(life, g, n); return marketSheet(`⚠️ ${esc(res.msg)}`); }
        const how = afterSell(g, n, res, shown);
        marketSheet(`✓ ${G[g].icon}×${(res.each || []).length || n} → +${coin(res.coins)}${how ? '<br><small>' + how + '</small>' : ''}`);
      };
      const have = Town.SELLABLE.filter(g => life.bag[g]);
      if (life.band === 1) {   // little kids: only what you have, and one big button that sells it all
        if (!have.length) { body.append(tiles(tile('🧺', '→ 🌾', '', () => { const w = placeFor('townfarm'); guide = w && { ...w, icon: '🧺' }; closeSheet(); }, { cls: 'big' }))); return; }
        const fair = (g) => { const real = Town.sellPreview(town, g, life.bag[g]).reduce((a, b) => a + Math.round(b * mult(g)), 0), gap = Math.max(0, Town.usual(g) * Math.min(Town.SELL_MAX, life.bag[g]) - real); return real + Math.min(gap, Math.max(0, R().caps.fair - (life.today.bonus.fair || 0))); };
        body.append(tiles(have.map(g => tile(G[g].icon, `×${life.bag[g]}`, `${fair(g)}🪙`, () => sell(g, Math.min(Town.SELL_MAX, life.bag[g]), fair(g))))));
        const total = have.reduce((a, g) => a + fair(g), 0);
        body.append(button(`✓ ${coin(total)}`, async () => { for (const g of have) if (life.bag[g]) await sell(g, Math.min(Town.SELL_MAX, life.bag[g]), fair(g)); }, 'big-btn small'));
        return;
      }
      body.append(tiles(Town.SELLABLE.map(g => {
        const n = life.bag[g] || 0, tr = Town.trend(town, g), m = mult(g), p = Math.round(Town.price(town, g) * m);
        const all = n > 1 ? Town.sellPreview(town, g, n).reduce((a, b) => a + Math.round(b * m), 0) : 0;
        const t = tile(G[g].icon, `${p}🪙 <i class="${tr}">${tr === 'up' ? '▲' : tr === 'down' ? '▼' : ''}</i>`, `${n ? `×${n}` : ''}${m > 1 ? ` <span class="usual wanted">wanted ×${m}</span>` : tr !== 'same' ? ` <span class="usual">usually ${Town.usual(g)}</span>` : ''}`, () => sell(g, 1, p), { disabled: !n, badge: n > 1 ? `${n > Town.SELL_MAX ? Town.SELL_MAX : 'all'} → ${all}🪙` : '', cls: m > 1 ? 'wanted' : '' });
        const b = t.querySelector('.tile-badge'); if (b) b.addEventListener('click', (e) => { e.stopPropagation(); sell(g, Math.min(Town.SELL_MAX, life.bag[g]), all); });
        return t;
      })));
      if (!have.length) note(body, '🎒 0 → 🌾 🪓 🎣');
      const cost = (n) => Town.buyPreview(town, 'log', n);
      const buyLogs = async (n) => {
        const want = cost(n).reduce((a, b) => a + b, 0);
        if (life.coins < want) return marketSheet(needCoins(want));
        const res = await act({ type: 'buyGood', g: 'log', n });
        if (!res.ok) return marketSheet(`⚠️ ${esc(res.msg)}`);
        if (!Life.spend(life, res.cost, '🪵', `Bought ${n} log${n > 1 ? 's' : ''} at the sawmill`, `${(res.each || []).join(' + ')} = ${res.cost}. The sawmill sells for a bit more than it buys (that is its profit). Each log bought makes the next one a little pricier.`)) return marketSheet(needCoins(res.cost));
        Life.addItem(life, 'log', n); Sound.cash(); touch(); hud(); marketSheet(`✓ 🪵×${n}: ${(res.each || []).join(' + ')} = −${coin(res.cost)}`);
      };
      if (at) return;   // logs are sold at the sawmill in Small Town
      body.insertAdjacentHTML('beforeend', '<h4 class="sub-h">🪚 Buy logs</h4>');
      body.append(tiles(tile('🪵', `${cost(1)[0]}🪙`, '×1', () => buyLogs(1)), tile('🪵', `${cost(5).reduce((a, b) => a + b, 0)}🪙`, '×5', () => buyLogs(5))));
    });
    sheetKind = 'market';
  }

  function schoolSheet(msg = '') {
    const lib = town.built.includes('library');
    sheet('🏫 School', (body) => {
      body.insertAdjacentHTML('beforeend', head('school', `Free for everyone (paid by taxes). Pass ${Life.CERT_AT} classes → 🎓.${lib ? ' 📚 ×2!' : ''}`));
      if (msg) note(body, msg);
      body.append(tiles(Object.entries(Life.SUBJECTS).map(([s, sub]) => {
        const n = life.school[s] || 0, got = Life.hasCert(life, s);
        return tile(sub.icon, sub.name, got ? '🎓' : '●'.repeat(Math.min(n, Life.CERT_AT)) + '○'.repeat(Math.max(0, Life.CERT_AT - n)), () => {
          const Q = R().quiz;
          quiz(`${sub.icon} ${sub.name}`, classQuestions(s, life.band, Q.n), (score) => {
            if (score === null) return;
            life.stats.classes++; daily('class');
            if (Q.retry && !got) Life.addStars(life, score);   // little kids: ⭐ for every first-try right answer (until the certificate), and a class always counts
            if (Q.retry || score >= Q.pass) {
              const before = Life.hasCert(life, s);
              life.school[s] = (life.school[s] || 0) + (lib ? 2 : 1); life.rep += 1;
              const cert = !before && Life.hasCert(life, s);
              if (!Q.retry) Life.addStars(life, 1);
              if (cert) Life.addStars(life, 3);
              Sound.chord(cert ? 6 : 3, 'bell'); touch(); checkDream(); hud();
              schoolSheet(cert ? `🎓 ${sub.cert}! ⭐+3` : Q.retry ? `✓ ⭐+${score}` : `✓ ${score}/${Q.n}`);
            } else { touch(); schoolSheet(`${score}/${Q.n} · 🔁`); }
          }, { retry: Q.retry });
        }, { on: got });
      })));
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">👤 ${BAND_NAMES[life.band]}</p>`);
    });
  }

  function jobsSheet(msg = '') {
    const kid = life.band === 1, rate = Life.effRate(life, town.taxRate);
    sheet('💼 Jobs', (body) => {
      body.insertAdjacentHTML('beforeend', head('jobs', kid ? 'Every task pays right away!' : `Finish every task in a shift to get paid. ${rate}% of each wage is income tax${life.band === 2 ? ' (kids pay half)' : ''}: it pays for the school, roads and parks.`));
      if (msg) note(body, msg);
      if (life.shift) {
        const j = Life.JOBS[life.shift.job];
        body.append(card(`<h3>${j.icon} ${j.name} ${'●'.repeat(life.shift.done)}${'○'.repeat(life.shift.need - life.shift.done)}</h3><p class="small">${j.how} → 🔶</p>`, 'next'));
        const s = life.shift, part = Math.floor(Life.wageOf(life, s.job) * s.done / s.need), keep = part - Life.taxOf(life, part, Math.min(s.rate ?? town.taxRate, town.taxRate));
        if (kid) body.lastChild.append(row(button('👍', closeSheet, 'choice'), button('🛑', (el) => { if (sure(el, '✓ 🛑?')) stopShift(); }, 'choice alt')));
        else body.lastChild.append(button(`✕ Stop · ${'●'.repeat(s.done)}${'○'.repeat(s.need - s.done)} = ${coin(keep)}`, () => stopShift(), 'choice alt'));
      }
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Today ${'●'.repeat(Math.min(life.shiftsToday, R().shifts))}${'○'.repeat(Math.max(0, R().shifts - life.shiftsToday))}</p>`);
      body.append(tiles(Object.entries(Life.JOBS).filter(([id]) => !kid || Life.canTake(life, id, town).ok).map(([id, j]) => {
        const can = Life.canTake(life, id, town);
        const w = Life.wageOf(life, id), tx = Life.taxOf(life, w, town.taxRate);
        return tile(j.icon, kid ? coin(w) : j.name, kid ? '' : can.ok ? (tx ? `${coin(w)} − ${tx} tax = <b class="keep">${coin(w - tx)}</b>` : `<b class="keep">${coin(w)}</b> no tax`) : '🔒 ' + can.why, () => startShift(id), { disabled: !can.ok || !!life.shift, on: life.shift && life.shift.job === id });
      })));
    });
  }
  function dreamSteps() {
    const d = Life.DREAMS[life.dream];
    return Life.stepsOf(life, d).map(([text, , , icon], i) => `<div class="lesson ${i < life.dreamStep ? 'done' : i === life.dreamStep ? 'next' : 'locked'}"><span class="mark">${i < life.dreamStep ? '✓' : icon}</span><span>${esc(text)}</span></div>`).join('')
      + (life.dreamStep >= Life.stepsOf(life, d).length ? `<div class="lesson next"><span class="mark">∞</span><span>${esc(Life.dreamGoal(life).text)}</span></div>` : '');
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
          life.stats.votes++; daily('vote'); Sound.bell(); touch(); checkDream(); fact('vote'); hallSheet(`✓ ${p.icon}${isMayor ? ' ×3' : ''}`);
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
      ec.insertAdjacentHTML('beforeend', `<p class="small">🤝 ${life.rep} helper points</p>`);
      if (isMayor) ec.append(row(...[5, 10, 15, 20].map(r => button(`${town.taxRate === r ? '✓ ' : ''}${r}%`, async () => { const res = await act({ type: 'setTax', rate: r }); hallSheet(res.ok ? `✓ ${r}%` : `⚠️ ${esc(res.msg)}`); }, town.taxRate === r ? 'choice' : 'choice alt'))));
      body.append(ec);
      if (town.news.length) body.append(card(`<h3>📰</h3>${town.news.slice(0, 5).map(n => `<p class="small">${esc(n)}</p>`).join('')}`));
    });
  }

  function rentSheet() {
    const house = Life.ownsHouse(town, me.uid);
    sheet('🏢 Apartments', (body) => {
      const rent = R().rent;
      body.insertAdjacentHTML('beforeend', head('rent', house || life.home ? '🏠 You own a home. No rent!' : !rent ? '🏢 ❤️ Home. Kids live here for free!' : `Rent ${coin(rent)}/day${life.rentFree ? ` · 🎁 ${life.rentFree} free days` : ''}. Own a house → no rent.`));
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
        const own = life.vehicles[id], lock = v.needs && !life.badges[v.needs], up = Life.upkeepOf(life, id);
        return tile(v.icon, own ? '✓' : coin(v.price), `⚡×${v.speed} · ${up ? `⛽ −${up}🪙 every day` : '⛽ free'}`, (el) => {
          if (own) return;
          if (lock) return dealerSheet('🔒 🎓✈️ (Airport)');
          if (life.coins < v.price) return dealerSheet(needCoins(v.price) + ' Save up, or borrow at the 🏦 bank.');
          if (up && !sure(el, `✓ Buy? −${up}🪙 every day`)) return;
          Life.spend(life, v.price, v.icon, `Bought a ${v.name.toLowerCase()}`, up ? `It will also cost ${up} every morning for fuel and repairs.` : 'No fuel bills for you!'); life.vehicles[id] = Date.now(); touch(); hud(); Sound.cash(); World.burst(World.pos().x, World.pos().y, 'confetti', 30, 4);
          if (up) fact('upkeep');
          checkDream(); dealerSheet(`🔑 ${v.icon}! → ${v.icon} button`);
        }, { on: !!own, disabled: !!lock && !own });
      })));
    });
  }

  /* ---------------- trips: airport, harbor, space ---------------- */
  let tripFrom = null, tripKind = 'plane';
  function goTrip(id, fromType) {
    const T = Life.TRIPS[id], k = nearest(World.keepers.filter(q => q.type === fromType), World.pos());
    tripFrom = k ? { x: k.x, y: k.y + 40 } : World.pos();
    closeSheet(); World.setVehicle(null);
    Sound.chord(6, 'bell');
    tripKind = fromType === 'harbor' ? 'boat' : fromType === 'space' ? 'rocket' : 'plane';   // the trip is a little film: take-off, clouds, landing
    World.goTrip(id, tripKind, () => { toast(`<span class="t-small">${T.icon} ${esc(T.name)}</span>📸 → 🔶`, { big: true, life: 4 }); startMusic(); });
    life.stats.trips++; touch();
    memory(id); if (id !== 'moon') memory('flight');
    if (id === 'moon') fact('hop3');
    startMusic(); hud(); checkDream();
  }
  function endTrip(quick) {
    const after = () => { spawnBricks(true); Sound.bell(); startMusic(); hud(); touch(); };
    World.endTrip(tripFrom ? tripFrom.x : 4800, tripFrom ? tripFrom.y : 1500, quick ? null : tripKind, after);
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
  function stadiumSheet() {
    sheet('⚽ Stadium', (body) => {
      body.insertAdjacentHTML('beforeend', head('stadium', 'Kick the ball into a goal: +3🪙 (5 a day).'));
      body.append(tiles(tile('⚽', 'Field', '→ 🔶', () => { const d = Town.districtsOf(town).find(q => q.landmarks.some(l => l.type === 'stadium')); if (d) guide = { x: d.x0 + 1450, y: 420, h: 6, icon: '⚽' }; closeSheet(); })));
    });
  }
  // Grandma's kitchen: cook what you picked, gathered and caught (from Noodle Universe)
  function kitchen(body) {
    const c = card(`<h3>👵 Grandma's kitchen</h3><p class="small">${life.band === 1 ? '🧺 → 🍳 → ⭐ 👟' : 'Bring what you pick, gather and catch. Each dish gives stars once a day, and a full tummy gives fast feet for the rest of the day.'}</p>`, 'kitchen');
    KITCHEN.forEach(r => {
      const cooked = life.today.count['cook:' + r.id], can = Object.entries(r.needs).every(([g, n]) => (life.bag[g] || 0) >= n);
      const row = document.createElement('div'); row.className = 'recipe' + (can ? ' can' : '');
      row.innerHTML = `<span class="r-icon">${r.icon}</span><span class="r-text"><b>${esc(r.name)}</b><span class="r-needs"></span></span>`;
      const needs = row.querySelector('.r-needs');
      Object.entries(r.needs).forEach(([g, n]) => {
        const have = life.bag[g] || 0, b = document.createElement('button'); b.type = 'button';
        b.className = 'need' + (have >= n ? ' ok' : ''); b.innerHTML = `${(G[g] || {}).icon || g}${n > 1 ? '×' + n : ''}`;
        b.title = have >= n ? 'You have it' : 'Where to get it';
        if (have < n) b.addEventListener('click', () => { const w = placeFor(INGREDIENT_AT[g]); if (w) { guide = { ...w, icon: (G[g] || {}).icon }; closeSheet(); toast(`${(G[g] || {}).icon} ➤`, { life: 2 }); } else if (/^wild:/.test(INGREDIENT_AT[g] || '')) toast(`${(G[g] || {}).icon} 🌍 ${life.band === 1 ? '' : 'Grows out in the Wild: walk out of town to find it.'}`, { life: 3 }); });
        needs.append(b);
      });
      row.append(button(can ? (cooked ? '🍳' : `🍳 ⭐+${r.stars}`) : '🔒', () => cook(r), 'choice', !can));
      c.append(row);
    });
    body.append(c);
  }
  function cook(r) {
    if (!Object.entries(r.needs).every(([g, n]) => (life.bag[g] || 0) >= n)) return;
    Object.entries(r.needs).forEach(([g, n]) => Life.takeItem(life, g, n));
    const first = !life.today.count['cook:' + r.id]; life.today.count['cook:' + r.id] = 1;
    life.fed = life.day; life.stats.cooked = (life.stats.cooked || 0) + 1;
    if (first) Life.addStars(life, r.stars);
    boostTick(); Sound.chord(5, 'kalimba'); World.mood('love', 2); World.celebrate(r.id === 'feast' ? 20 : 6);
    toast(`<span class="t-small">👵 Yum!${first ? ` ⭐ +${r.stars}` : ''} · 👟 fast feet today</span>${r.icon} ${esc(r.name)}`, { big: true, life: 4 });
    findNoodle('bubble'); touch(); hud(); checkDream();
    funSheet('cafe');
  }
  function funSheet(type) {
    const P = placeInfo(type), F = FUN[type] || {}, cost = F.cost || 0;
    sheet(`${P.icon || ''} ${P.name || ''}`, (body) => {
      body.insertAdjacentHTML('beforeend', head(type, HELLO[type] || '👋'));
      if (type === 'cafe') kitchen(body);
      if (cost && life.coins < cost) note(body, needCoins(cost));
      body.append(tiles(tile(P.icon, cost ? coin(cost) : 'Visit', type === 'arcade' ? 'right answer → win 5🪙' : '', () => {
        if (cost && life.coins < cost) return;
        if (cost) Life.spend(life, cost, P.icon, F.why || P.name, 'Fun costs a little. You get a nice memory!');
        if (!life.today.count['visit:' + type]) { life.today.count['visit:' + type] = 1; life.xp += 1; }
        memory(type); World.mood('love', 2); Sound.chord(4, 'kalimba');
        if (type === 'concert') [0, 2, 4, 7, 9, 7, 4, 2].forEach((n, i) => setTimeout(() => Sound.note(n + 3, 'kalimba'), 300 + i * 220));
        if (type === 'observatory') memory('stars');
        if (type === 'museum' || F.fact) { const f = (typeof FACTS !== 'undefined') ? FACTS[Math.floor(Math.random() * FACTS.length)] : null; if (f) toast(`<span class="t-small">🦕 ${esc(f.title)}</span>${esc(f.text)}`, { life: 7 }); }
        if (type === 'arcade') { closeSheet(); const kid = life.band === 1; quiz('🕹️', [kid ? makePictureMath(Math.random) : makeMathQuestion(Math.random, life.band * 2)], (s) => {
          if (s === null) return;
          const why = `Arcade prizes are at most ${R().caps.arcade} coins a day.`;
          if (s) { if (!Life.kidBonus(life, 'arcade', 5, '🏆', 'Arcade prize', why)) toast('🕹️ 🏆 ✓ (no more prizes today)'); }
          else if (kid) { if (!Life.kidBonus(life, 'arcade', 2, '🕹️', 'Try prize', 'Nice try! Here are your coins back.')) toast('🕹️ ❤️'); }
          else toast('🕹️ So close! Right answers win the 5🪙 prize.');
          hud();
        }); return; }
        if (cost) toast(`${P.icon} ❤️ −${coin(cost)}`);
        touch(); hud(); closeSheet();
      })));
    });
  }

  /* ---------------- the Stock Exchange ---------------- */
  function exchangeSheet(msg = '') {
    const day = Life.dayOf(now());
    sheet('📈 Stock Exchange', (body) => {
      body.insertAdjacentHTML('beforeend', head('exchange', 'A share is a tiny piece of a company. Buy low, sell high. Prices change every morning, and nobody knows for sure where they go.') + money());
      if (msg) note(body, msg);
      if (!R().loans) { note(body, '📈 🔒 9+'); return; }
      Object.entries(Town.STOCKS).forEach(([sym, S]) => {
        const p = Town.stockPrice(town, sym, day), y = Town.stockPrice(town, sym, day - 1), h = life.shares[sym] || { n: 0, paid: 0 }, ch = p - y;
        const hist = Array.from({ length: 7 }, (_, i) => Town.stockPrice(town, sym, day - 6 + i)), lo = Math.min(...hist), hi = Math.max(...hist);
        const spark = hist.map((v, i) => `${i * 14},${24 - Math.round((v - lo) / Math.max(1, hi - lo) * 22)}`).join(' ');
        const c = card(`<h3>${S.icon} ${S.name} <b>${coin(p)}</b> <small class="${ch >= 0 ? 'pos' : 'neg'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch)}</small></h3>
          <svg class="spark" viewBox="0 0 84 26" aria-hidden="true"><polyline points="${spark}" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          <p class="small">${esc(S.blurb)}${h.n ? `<br>You own ${h.n} · worth ${coin(h.n * p)} · you paid ${coin(Math.round(h.paid))} → <b class="${h.n * p >= h.paid ? 'pos' : 'neg'}">${h.n * p >= h.paid ? '+' : '−'}${Math.abs(Math.round(h.n * p - h.paid))}</b>` : ''}</p>`);
        const doIt = (what, n) => { const r = Life.trade(life, town, what, sym, n, day); if (!r.ok) return exchangeSheet(`⚠️ ${esc(r.why)}`); Sound.cash(); if (what === 'buy') memory('shares'); touch(); hud(); checkDream(); exchangeSheet(what === 'buy' ? `✓ ${S.icon} +${n}` : `✓ ${r.gain >= 0 ? '📈 +' : '📉 −'}${coin(Math.abs(r.gain))}`); };
        c.append(row(button(`+1 · ${coin(p)}`, () => doIt('buy', 1), 'choice', life.coins < p), button(`+5 · ${coin(p * 5)}`, () => doIt('buy', 5), 'choice', life.coins < p * 5),
          button('Sell 1', () => doIt('sell', 1), 'choice alt', !h.n), button('Sell all', () => doIt('sell', h.n), 'choice alt', !h.n)));
        body.append(c);
      });
    });
  }
  // the University: pass a hard exam, get a degree (+10% on every wage)
  function universitySheet(msg = '') {
    sheet('🎓 University', (body) => {
      body.insertAdjacentHTML('beforeend', head('university', 'Pass the big exam to earn a degree: every wage goes up 10%.'));
      if (msg) note(body, msg);
      if (life.badges.degree) { note(body, '🎓 ✓ +10%'); return; }
      if (Life.certCount(life) < 2) { note(body, `🎓🎓 first (School) · ${Life.certCount(life)}/2`); return; }
      body.append(tiles(tile('📝', 'Exam', '4 questions · 3 right', () => {
        const S = ['money', 'math', 'science', 'civics'], qs = S.map(s => classQuestions(s, Math.min(3, life.band + 1), 1)[0]).filter(Boolean);
        quiz('🎓 Exam', qs, (score) => {
          if (score === null) return;
          if (score >= 3 || (R().quiz.retry)) { life.badges.degree = 1; Life.addStars(life, 5); memory('graduate'); Sound.chord(8, 'bell'); World.celebrate(12); touch(); checkDream(); universitySheet('🎓 🎉 +10%'); }
          else universitySheet(`${score}/4 · 🔁`);
        }, { retry: R().quiz.retry });
      })));
    });
  }

  /* ---------------- business: companies, the Tech Hub, the studio ---------------- */
  function bizSheet(msg = '') {
    sheet('🏢 Companies', (body) => {
      body.insertAdjacentHTML('beforeend', head('biz', `Sales − costs = profit. ${R().coLossZero ? 'On a slow day kids just earn nothing, never a loss.' : 'If costs are bigger, it is a loss and it comes out of your pocket.'} Workers sell more but cost wages.`) + money());
      if (msg) note(body, msg);
      life.companies.forEach(co => {
        const T = Life.COMPANIES[co.type];
        const last = life.log.find(e => e.icon === T.icon && e.morning);
        const listed = Object.values(life.online).reduce((a, b) => a + b, 0), cap = Life.onlineCap(co);
        const c = card(`<h3>${T.icon} ${T.name} <small>Lv ${co.level} · 👥 ${co.staff}/${Life.staffMax(co)} · ${co.days ? `profit so far ${co.profit >= 0 ? '+' : ''}${co.profit}🪙 (it cost ${T.cost} to start)` : '🆕 opens tomorrow morning'}${co.ad ? ' · 📣' : ''}</small></h3>
          <p class="small">Every morning: customers pay you, and you pay rent & supplies (${T.upkeep * co.level}🪙) + ${T.wage}🪙 per worker.${T.online ? ` Your store ships ${cap} things a day; each packer ships 3 more. Listed now: ${listed}.` : ''}${last ? `<br>Last morning: <b class="${last.n < 0 ? 'neg' : 'pos'}">${last.n >= 0 ? '+' : ''}${last.n}🪙</b> ${esc(last.how)}` : ''}</p>`);
        const doIt = (what) => { const r = Life.company(life, what, co.id); if (!r.ok) return bizSheet(`⚠️ ${r.why}`); Sound.cash(); touch(); hud(); checkDream(); bizSheet(what === 'close' ? `✓ ${T.icon} closed: +${coin(r.back)}` : `✓ ${T.icon}`); };
        const adUseless = T.online && listed <= cap;
        c.append(row(button(`➕${T.online ? '📦' : '👤'} −${T.wage}🪙/day`, () => doIt('hire'), 'choice', co.staff >= Life.staffMax(co)), button(`➖${T.online ? '📦' : '👤'}`, () => doIt('fire'), 'choice alt', !co.staff),
          button(`⬆️ ${coin(Life.upgradeCost(co))} <small>then −${T.upkeep * (co.level + 1)}🪙/day</small>`, () => doIt('upgrade'), 'choice alt'),
          button(`📣 ${coin(6 + 4 * co.level)}${adUseless ? ' <small>(list more first)</small>' : ''}`, () => doIt('ad'), 'choice alt', !!co.ad || adUseless),
          button(`🔒 Close +${coin(Life.closeValue(co))}`, (el) => { if (sure(el, '✓ Sure? Close it')) doIt('close'); }, 'choice alt')));
        body.append(c);
      });
      body.insertAdjacentHTML('beforeend', '<h4 class="sub-h">🆕 Start a company</h4>');
      body.append(tiles(Object.entries(Life.COMPANIES).map(([id, T]) => tile(T.icon, esc(T.name), `${coin(T.cost)}${T.lot ? ' + 🏗️' : ''}${T.needs ? ' 🎓' + Life.SUBJECTS[T.needs].icon : ''}<br>then −${T.upkeep}🪙/day`, () => startCompany(id)))));
      fact('company');
    });
  }
  function startCompany(id, plotId) {
    const T = Life.COMPANIES[id];
    if (T.lot && !plotId) {
      const empty = myPlots().find(p => p.build === 'company' && !life.companies.some(c => c.plot === p.id));
      if (empty) plotId = empty.id;
    }
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
      if (!store) body.append(tiles(tile('🛒', 'Online store', `${coin(Life.COMPANIES.online.cost)}<br>then −${Life.COMPANIES.online.upkeep}🪙/day`, () => { if (life.coins < Life.COMPANIES.online.cost) return techSheet(needCoins(Life.COMPANIES.online.cost)); startCompany('online'); })));
      else {
        const listed = Object.entries(life.online).filter(([, n]) => n > 0);
        body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">🛒 ${listed.length ? listed.map(([g, n]) => `${G[g].icon}×${n}`).join(' ') : '🫙 Nothing listed: list things or the store sells nothing'} · 🚚 ${Life.onlineCap(store)}/day · each sells for about the market price + 2, minus a 10% fee</p>`);
        body.append(tiles(Town.SELLABLE.map(g => tile(G[g].icon, `+1`, `×${life.bag[g] || 0} · ≈${Town.price(town, g) + 2}🪙`, () => { if (!Life.takeItem(life, g, 1)) return; life.online[g] = (life.online[g] || 0) + 1; life.stats.listed++; touch(); hud(); checkDream(); techSheet(`✓ ${G[g].icon} → 🛒`); }, { disabled: !life.bag[g] }))));
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
    const cap = R().maxPlots;
    if (cap && myPlots().length >= cap) return toast(`${'🏡'.repeat(cap)} ✓`);
    const tax = R().landTax === 'full' ? Town.TAX[pl.kind] : R().landTax ? R().landTax[pl.kind] || 0 : 0;
    sheet(`${pl.kind === 'farm' ? '🌱' : '🏗️'} ${pl.id}`, (body) => {
      body.insertAdjacentHTML('beforeend', `<div class="wallet"><span>🏷️ <b>${coin(pl.price)}</b></span>${tax ? `<span>🏛️ <b>−${coin(tax)} every day</b></span>` : ''}</div>${money()}`);
      if (life.coins >= pl.price) body.insertAdjacentHTML('beforeend', `<p class="picture-sum">👛 ${life.coins} − ${pl.price} = ${life.coins - pl.price} ✓</p>`);
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">${pl.kind === 'farm' ? '🌱 → 💧 → 🌾 → 🧺 🪙' : '🔨 🏠 🏡 🏪 🏭'}</p>`);
      if (life.coins < pl.price) note(body, `−${coin(pl.price - life.coins)} · 💼 or 🏦`);
      body.append(row(button(`Buy ${coin(pl.price)}`, async () => {
        if (life.coins < pl.price) return;
        const res = await act({ type: 'buyPlot', id: pl.id });
        if (!res.ok) { closeSheet(); return toast(`⚠️ ${esc(res.msg)}`); }
        Life.spend(life, res.cost, pl.kind === 'farm' ? '🌱' : '🏗️', `Bought land ${pl.id}`, tax ? `Land costs a little tax every day: ${tax}🪙.` : 'It is yours!'); landBook(pl.id, { cost: res.cost }); Sound.chord(2, 'bell'); World.burst(pl.x + pl.w / 2, pl.y + pl.h / 2, 'confetti', 30, 4);
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
        const g = G[k], sells = k === 'tree' ? `🪵×3` : `→ ≈${coin(Town.price(town, k))} today`;
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
    Sound.water(); const s = Town.soilSpot(Town.plotById(id), i); World.burst(s.x, s.y, 'water', 14, 4); World.mood('love', 1); daily('water');
  }
  async function harvest(id, i) {
    const res = await act({ type: 'harvest', id, i, bonus: Math.random() < 0.25 });
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
        landBook(id, { build: k, buildCoins: b.coins });
        if (co) { const r = Life.company(life, 'start', co, id); if (r.ok) { memory('company'); fact('company'); } else toast(`🏭 Your building is ready. Start a company in it any time at 🏢 (${esc(r.why)})`, { life: 5 }); }
        if (k === 'house' || k === 'villa') { memory('house'); life.home = townKey(); }
        [0, 250, 500].forEach(ms => setTimeout(() => Sound.hammer(), ms));
        const pl = Town.plotById(id); World.burst(pl.x + pl.w / 2, pl.y + pl.h / 2, 'wood', 24, 4);
        toast(`${b.icon} 🔨🔨🔨`, { big: true });
        touch(); hud(); setTimeout(checkDream, 1000);
      };
      const need = (b) => ((life.bag.log || 0) >= b.logs && life.coins >= b.coins) ? '' : `🪵${b.logs} ${coin(b.coins)}`;
      body.append(tiles(['house', 'villa', 'shop'].map(k => { const b = Town.BUILD[k]; return tile(b.icon, b.name, need(b) || `🪵${b.logs} ${coin(b.coins)}`, () => doBuild(k), { disabled: !!need(b) }); })));
      note(body, '🏠 🏡 = your home: no more rent. 🏪 🏭 are for work, not homes.');
      body.insertAdjacentHTML('beforeend', '<h4 class="sub-h">🏭 Company building</h4>');
      const bc = Town.BUILD.company;
      body.append(tiles(Object.entries(Life.COMPANIES).filter(([, T]) => T.lot).map(([co, T]) => tile(T.icon, T.name, `🪵${bc.logs} ${coin(bc.coins + T.cost)}`, () => doBuild('company', co), { disabled: (life.bag.log || 0) < bc.logs || life.coins < bc.coins + T.cost }))));
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
  // someone (the forester, a friend) may have planted every stump already: then nothing is owed
  const noStumps = () => !Town.FOREST.some(x => Town.treeState(town, x.id, now()) === 'stump');
  async function chop(tr) {
    const left = Town.forestLeft(town);
    if (life.owesSapling && noStumps()) life.owesSapling = 0;
    if (life.owesSapling) return toast('🌱 first! (cut one, plant one)');
    if (left <= 10) return toast(`🌲 Only ${left} trees left. Plant saplings 🌱 on stumps first${life.shift && life.shift.job === 'lumberjack' ? ' (that counts for your shift too)' : ''}.`, { life: 5 });
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
    replantDone(tr);
  }
  function replantDone(tr) {
    const owed = life.owesSapling; life.owesSapling = 0; life.stats.replanted++; life.rep += 1; daily('plant');
    Sound.plant(); World.burst(tr.x, tr.y, 'seeds', 12, 1); World.mood('love', 1.2);
    if (life.shift && life.shift.job === 'lumberjack') workStep();
    else if (!owed) { Life.earn(life, R().plantThanks, null, '🌱', 'Thank you for planting a tree'); World.floatText(tr.x, tr.y, `+${R().plantThanks}🪙`); }
    else toast('🌱 ❤️ You planted a tree for the one you cut.');
    touch(); hud(); checkDream();
  }
  // Picking at the Town Farm. Little kids are hired on their first pick (no Jobs sheet) and keep every crop.
  // Without the job you keep a share of what you pick (10 / 6 / 4 a day by age).
  async function farmwork(i) {
    const res = await act({ type: 'farmwork', i });
    if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
    farmDone(i);
  }
  function farmDone(i) {
    const s = Town.FARM_SPOTS[i], g = Town.CROPS[i % 4]; Sound.pop(); World.burst(s.x, s.y, 'leaves', 10, 2);
    life.stats.farmPicked = (life.stats.farmPicked || 0) + 1; daily('pick');
    const shifts = life.shiftsToday < R().shifts;
    if (life.band === 1 && !life.shift && shifts && Life.startShift(life, 'farmhand', [], town).ok) World.floatText(s.x, s.y - 40, '🧑‍🌾', 'task');
    const onShift = life.shift && life.shift.job === 'farmhand';
    const keep = (life.band === 1 || !onShift) && (life.today.picks || 0) < R().pickCap;
    if (keep) { life.today.picks = (life.today.picks || 0) + 1; Life.addItem(life, g); setTimeout(() => World.floatText(s.x, s.y, `+1 ${G[g].icon}`), 350); }
    if (onShift) { workStep(); touch(); hud(); checkDream(); return; }
    life.rep += 1;
    if (life.band === 1) { if (Life.kidBonus(life, 'volunteer', 1, '🧺', 'Thanks for helping on the farm')) World.floatText(s.x + 30, s.y, '+1🪙', 'pay'); else if (!keep) toast('🧺 ❤️ ✓ 🌙'); }
    else if (keep) toast(`🧺 +1 ${G[g].icon} (${life.today.picks}/${R().pickCap} today)${shifts ? ' · 💼🧑‍🌾 = 🪙' : ''}`, { life: 4 });
    else toast(`🧺 ❤️ Your share is used up for today.${shifts ? ' A Farmhand job 💼 pays for picking.' : ' Come back tomorrow.'}`, { life: 5 });
    if (!keep && shifts && life.band > 1) { const k = keeper('jobs'); if (k) guide = { x: k.x, y: k.y, h: 13, icon: '💼' }; }
    touch(); hud(); checkDream();
  }

  const GATHER = { cow: { icon: '🐄', label: 'Milk' }, hen: { icon: '🐔', label: 'Eggs' }, apple: { icon: '🍎', label: 'Pick' }, ore: { icon: '⛏️', label: 'Dig' } };
  async function gather(w) {
    const res = await act({ type: 'gather', spot: w.id });
    if (!res.ok) return toast(`⚠️ ${esc(res.msg)}`);
    gatherDone(w, res);
  }
  function gatherDone(w, res) {
    const g = res.item; Life.addItem(life, g); life.stats.gathered[g] = (life.stats.gathered[g] || 0) + 1;
    World.floatText(w.x, w.y, `+1 ${G[g].icon}`); World.burst(w.x, w.y, w.type === 'ore' ? 'dust' : 'leaves', 10, 2);
    w.type === 'ore' ? [0, 200].forEach(ms => setTimeout(() => Sound.hammer(), ms)) : Sound.pop();
    memory({ cow: 'milk', hen: 'milk', apple: 'apple', ore: 'ore' }[w.type]); if (g === 'gem') memory('gem');
    if (life.shift && Life.WORK_JOB[w.type] === life.shift.job) workStep();
    touch(); hud(); checkDream();
  }
  // the ranch, the orchard and the mine: a job, and what is ready now
  function workPlaceSheet(type) {
    const P = placeInfo(type), job = Object.entries(Life.JOBS).find(([, j]) => j.place === type), t = now();
    const list = Town.workOf(town).filter(w => w.place === type && Math.abs(w.x - World.pos().x) < 1200);
    sheet(`${P.icon} ${P.name}`, (body) => {
      body.insertAdjacentHTML('beforeend', head(type, HELLO[type]) + `<p class="sheet-sub">${list.map(w => (t - (town.work[w.id] || 0) >= Town.WORK_REGROW ? GATHER[w.type].icon : '⏳')).join(' ')} → ${[...new Set(list.map(w => G[Town.WORK_ITEM[w.type]].icon))].join(' ')} → 🛒</p>`);
      if (job) { const [id, j] = job, can = Life.canTake(life, id, town), w = Life.wageOf(life, id); body.append(tiles(tile(j.icon, life.band === 1 ? coin(w) : j.name, life.band === 1 ? '' : `${coin(w)} · ${esc(j.how)}`, () => startShift(id), { disabled: !can.ok || !!life.shift, on: life.shift && life.shift.job === id }))); }
    });
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
          if (!life.memories.fish || Math.random() >= R().fishMiss) { item('fish'); Sound.splash(); World.burst(s.x, s.y, 'water', 16, 2); memory('fish'); World.mood('wow', 1.5); daily('fish'); }
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
    if (pay.step) { Sound.coin(); floatMe(`+${pay.step}🪙`); }
    if (!pay.done) { if (!pay.step) { Sound.coin(); World.floatText(p.x, p.y, `${life.shift.done}/${life.shift.need}`, 'task'); } touch(); hud(); return; }
    if (pay.tax + (pay.grant || 0)) act({ type: 'tax', n: pay.tax + (pay.grant || 0) });
    daily('shift');
    const j = Life.JOBS[pay.job];
    if (pay.perTask) {   // band 1: already paid for every task. A coin shower, no pay slip.
      Sound.cash(); World.burst(p.x, p.y, 'coins', 22, 6); World.mood('laugh', 2);
      toast(`<span class="t-small">${j.icon} ✓</span>💵 +${coin(pay.gross)}`, { big: true, life: 3 });
      touch(); hud(); checkDream(); fact('kidtax');
      return;
    }
    Sound.cash(); World.burst(p.x, p.y, 'coins', 22, 6); World.mood('laugh', 2); World.floatText(p.x, p.y, `+${pay.gross}🪙`, 'pay');
    if (pay.tax) setTimeout(() => World.floatText(p.x + 30, p.y, `−${pay.tax} 🏛️`, 'tax'), 700);
    touch(); hud(); checkDream(); fact('tax');
    // where the tax goes: the project the town is saving for
    const top = Town.projectChoices(town)[0], pct = top ? Math.min(100, Math.round(town.treasury / top.cost * 100)) : 0;
    later(() => sheet('💵 Payday!', (body) => {
      body.insertAdjacentHTML('beforeend', `<div class="budget"><div><span>${j.icon} Wage for your ${j.name} shift</span><b class="pos">+${coin(pay.gross)}</b></div>${pay.rested ? `<div><span>😴 Well rested +10%<small>You slept in your bed last night.</small></span><b class="pos">+${coin(pay.rested)}</b></div>` : ''}<div><span>🏛️ Income tax ${pay.rate}%<small>${life.band === 2 ? 'Kids pay half the tax. ' : ''}${pay.rate}% of ${pay.gross} is ${Math.round(pay.gross * pay.rate) / 100}${pay.tax ? '' : ', rounded down to 0'}. Tax goes to the town: it pays for the school, roads and parks.</small></span><b class="${pay.tax ? 'neg' : ''}">${pay.tax ? '−' + coin(pay.tax) : coin(0)}</b></div><div class="total"><span>👛 You keep</span><b>${coin(pay.net)}</b></div></div>
        ${top ? `<p class="sheet-sub">🏛️ → ${top.icon} ${esc(top.name)} ${pct}%</p>` : ''}${pay.raise ? `<p class="sheet-sub">🎉 Experience pays! Next ${j.name} shift: ${coin(pay.next)}</p>` : ''}`);
      body.append(button('👍', closeSheet, 'big-btn small'));
    }), true);
  }
  function stopShift(msg) {
    const r = Life.quitShift(life, town.taxRate); if (!r) return;
    if (r.tax + (r.grant || 0)) act({ type: 'tax', n: r.tax + (r.grant || 0) });
    touch(); hud();
    jobsSheet(msg || (r.perTask ? '🛑 ✓' : r.net ? `Shift stopped. You were paid for ${r.done} of ${r.need} tasks: +${coin(r.net)}.` : 'Shift stopped. No tasks were done yet, so there is no pay.'));
  }
  // the town changed (you joined friends, or the town grew): make sure your shift can still be finished
  function fixShift() {
    const s = life && life.shift; if (!s || !town) return;
    const job = Life.JOBS[s.job], left = s.need - s.done;
    if (Life.DESK_JOBS[s.job] && !places().some(q => (q.type || q.id) === job.place)) return later(() => stopShift(`${job.icon} This town has no ${job.place === 'tech' ? 'Tech Hub' : 'place'} for this job yet, so the shift stopped. You were paid for the tasks you finished.`));
    if (s.job === 'mail') {
      const ok = s.targets.filter(id => places().some(q => q.id === id));
      if (ok.length < left) ok.push(...places().filter(b => b.id !== 'jobs' && !ok.includes(b.id)).sort(() => Math.random() - 0.5).slice(0, left - ok.length).map(b => b.id));
      s.targets = ok;
    }
    if (s.job === 'builder') {
      const ok = s.targets.filter(id => Town.plotById(id) && Town.allPlots(town).some(p => p.id === id));
      if (ok.length < left) ok.push(...Town.allPlots(town).filter(p => p.kind === 'lot' && !ok.includes(p.id)).sort(() => Math.random() - 0.5).slice(0, left - ok.length).map(p => p.id));
      s.targets = ok;
    }
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
    const retry = R().quiz.retry;
    quiz(`${Life.JOBS[s.job].icon}`, classQuestions(subject, life.band, 1), (score) => {
      if (score === null) return;
      if (score >= 1 || retry) { World.say('npc:' + kid, '👍', 2); workStep(); } else toast('💼 Not quite, so that task does not count yet (no pay is lost). Try the next customer!', { life: 4 });
    }, { retry });
  }

  /* ---------------- a new day ---------------- */
  function dayTick() {
    const day = Life.dayOf(now());
    if (sleeping && day > sleepDay && Life.hourOf(now()) < 12) wakeUp();
    if (life.day === day) return;
    if (life.day !== null && day < life.day && life.day - day < 240) return;   // a clock behind (joining friends) is not a new day
    // a new morning waits until you are not in a building or on a ride, so you can see what it does
    if (life.day !== null && (!$('sheet').hidden || World.riding || !playing)) return;
    if (!life.firstDay) life.firstDay = day;
    if (sleeping) wakeUp();
    const r = Life.newDay(life, town, me.uid, day);
    spawnBricks(true);
    if (World.setWildPicked) World.setWildPicked(wildPickedToday().ids);   // a new morning: the Wild has grown back
    touch();
    syncDaily();
    if (!r) return;
    if (r.taxes) act({ type: 'tax', n: r.taxes });
    if (r.borrowed) fact('loan');
    later(() => morningSheet(r), true);
    hud(); checkDream();
  }
  // today's three challenges exist and count what you already did today
  function syncDaily() { if (!life || life.day === null || !town) return; Life.ensureDaily(life, life.day, { plots: myPlots() }); const r = Life.dailyAdd(life, '_', 0); if (r.done.length) hud(); }
  const challengeTiles = () => tiles((life.daily ? life.daily.list : []).map(c => { const D = Life.DAILY_BY_ID[c.id]; return tile(D.icon, c.done ? '✓' : `${c.n}/${c.goal}`, life.band === 1 ? '' : esc(D.text), () => { const w = placeFor(D.at); if (w) guide = { ...w, icon: D.icon }; closeSheet(); }, { on: c.done, cls: 'challenge' }); }));
  function daily(id, n = 1) {
    if (!life) return;
    const r = Life.dailyAdd(life, id, n);
    r.done.forEach(c => { const D = Life.DAILY_BY_ID[c.id]; floatMe(`${D.icon} ✓ ⭐+1`, 'task'); Sound.chord(3, 'bell'); });
    if (r.perfect) later(() => { World.celebrate(20); Sound.chord(8, 'bell'); memory('perfect'); toast(`<span class="t-small">🌟 Perfect Day!</span>⭐+2 · +${coin(R().perfect)} · ${life.band === 1 ? `🌟×${life.perfectDays}` : `🔥 ${life.streak}`}`, { big: true, life: 5 }); });
    if (r.done.length || r.perfect) { touch(); hud(); }
    checkDream();
  }
  function todaySheet() {
    syncDaily(); if (life.daily) life.daily.shown = true;
    sheet('🎯 Today', (body) => {
      body.append(challengeTiles());
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">🎯 ⭐+1 · 🪙+${R().daily} · 🌟 = 3 ✓ → +${coin(R().perfect)}</p>`);
      body.append(button('✓', closeSheet, 'big-btn small'));
    });
  }
  function morningSheet(r) {
    if (life.daily) life.daily.shown = true;
    if (r.band === 1) {   // little kids: only good news, then today's challenges
      return sheet('☀️', (body) => {
        const plus = r.lines.filter(l => l.n > 0);
        body.insertAdjacentHTML('beforeend', `<div class="morning-row">${life.rit.sleep === r.day - 1 ? '<span>🛏️ ✓</span>' : ''}${plus.map(l => `<span>${l.icon} +${l.n}</span>`).join('')}${life.perfectDays ? `<span>🌟×${life.perfectDays}</span>` : ''}</div>`);
        body.append(challengeTiles());
        body.append(button('☀️', closeSheet, 'big-btn small'));
      });
    }
    sheet(`☀️ Day ${r.day - life.firstDay + 1}`, (body) => {
      const b = document.createElement('div'); b.className = 'budget';
      const night = r.lines.filter(l => l.night), rest = r.lines.filter(l => !l.night);
      r = { ...r, lines: night.concat(rest) };
      const cell = (l) => l.n > 0 ? '+' + coin(l.n) : l.n < 0 ? '−' + coin(-l.n) : (l.note ? esc(l.note) : '·');
      b.innerHTML = `<div class="start"><span>👛 In your pocket last night</span><b>${coin(r.before.coins)}</b></div>`
        + r.lines.map((l, i) => `${i === 0 && l.night ? '<div class="head"><span>💤 While you slept</span></div>' : ''}${i === night.length && night.length && rest.length ? '<div class="head"><span>🧾 Bills</span></div>' : ''}<div><span>${l.icon || ''} ${esc(l.label)}${l.acct === 'bank' ? ' <em>🐷 savings</em>' : ''}${l.how ? `<small>${esc(l.how)}</small>` : ''}</span><b class="${l.acct === 'loan' ? 'neg' : l.move ? 'move' : l.n < 0 ? 'neg' : l.n > 0 ? 'pos' : ''}">${cell(l)}</b></div>`).join('')
        + `<div class="total"><span>👛 In your pocket this morning</span><b>${coin(r.coins)}</b></div>`;
      body.append(b);
      const acc = [r.bank !== r.before.bank ? `🐷 Savings ${r.before.bank} → <b>${r.bank}</b>` : '', r.loan !== r.before.loan ? `💸 You owe ${r.before.loan} → <b>${r.loan}</b>` : '', r.iou !== r.before.iou ? `🧾 You owe ${r.before.iou} → <b>${r.iou}</b> (no interest)` : ''].filter(Boolean);
      if (acc.length) note(body, acc.join(' · '));
      if (r.borrowed) note(body, `💸 The bank lent you ${coin(r.borrowed)} to pay. Pay it back at the bank: loans grow a little every morning.`);
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Yesterday you earned ${coin(r.yesterday.earned)} and spent ${coin(r.yesterday.spent)}. <button type="button" class="link-btn" id="histBtn">👛 Money history</button></p>`);
      body.querySelector('#histBtn').addEventListener('click', () => moneySheet());
      body.insertAdjacentHTML('beforeend', '<h4 class="sub-h">🎯 Today</h4>');
      body.append(challengeTiles());
      body.append(button('☀️', closeSheet, 'big-btn small'));
    });
  }

  /* ---------------- a day like in Noodle Universe: swim at sunrise, a sip at sunset, bed at night ---------------- */
  const HAT_ICON = { flower: '🌼', beanie: '🧢', propeller: '🚁', chef: '👨‍🍳', crown: '👑', bowl: '🎩', shell: '🐚', party: '🥳' };
  function hopInPool() {
    const P = HOME.pool, p = World.pos(), a = Math.atan2((p.y - P.y) / P.ry, (p.x - P.x) / P.rx);
    World.place(P.x + Math.cos(a) * P.rx * 0.6, P.y + Math.sin(a) * P.ry * 0.6); Sound.splash();
  }
  function boostTick() { if (World.setBoost) { const k = (life.rit.swim === life.day ? 1.15 : 1) * (life.fed === life.day ? 1.15 : 1); if (World.boost !== k) World.setBoost(k); } }   // a morning swim and a good meal each give fast feet for the day
  function healthyDay() { later(() => { toast('<span class="t-small">❤️ Healthy Day</span>🌅 🌇 🛏️ ⭐+1', { big: true, life: 4 }); Sound.chord(6, 'bell'); }); }
  function poolSwim() {
    const p = World.pos(); if (!Town.inPool(p.x, p.y, 20)) return;
    const r = Life.doRitual(life, 'swim', now());
    if (!r) { World.mood('laugh', 1.5); return; }
    floatMe(`🌅 ⭐+1 🪙+${r.coins}`); Sound.chord(5, 'bell'); World.mood('wow', 2);
    memory('pool'); findNoodle('dawn'); fact('dawn'); if (r.healthy) healthyDay();
    const n = R().poolCoins, P = HOME.pool;
    if (World.addPickups && n) World.addPickups(Array.from({ length: n }, (_, i) => ({ id: `pool:${life.day}:${i}`, x: P.x + Math.cos(i * 2.4 + 0.5) * P.rx * 0.55, y: P.y + Math.sin(i * 2.4 + 0.5) * P.ry * 0.55, kind: 'coin' })));
    boostTick();
    touch(); hud(); checkDream();
  }
  function sip() {
    const p = World.pos(); Sound.gulp(); World.mood('thirsty', 1); setTimeout(() => World.mood('love', 1.5), 1000); World.burst(p.x, p.y, 'water', 10, 3);
    const r = Life.doRitual(life, 'sip', now());
    if (!r) { World.floatText(p.x, p.y, '💧❤️', 'task'); return; }
    floatMe(`🌇 ⭐+1 🪙+${r.coins}`); Sound.chord(4, 'bell');
    memory('sip'); findNoodle('mint'); fact('drink'); if (r.healthy) healthyDay();
    touch(); hud(); checkDream();
  }
  let dreamT = null, dreamCaught = 0, sleepFrom = 0, sleepDay = 0;
  function goSleep() {
    if (sleeping) return;
    const r = Life.doRitual(life, 'sleep', now()); if (!r) return;   // the prize comes at tuck-in, so waking early loses nothing
    World.setVehicle(null);
    sleeping = true; target = null; renderAction(); sleepFrom = Life.dayFrac(now()); sleepDay = Life.dayOf(now());
    floatMe(`🛏️ ⭐+1 🪙+${r.coins}`);
    memory('bed'); fact('sleep'); if (r.healthy) healthyDay();
    if (World.sleep) World.sleep(true); else World.mood('sleepy', 999);
    touch(); hud(); dreamScreen();
  }
  function dreamScreen() {
    $('dream').hidden = false; dreamCaught = 0; $('dreamCount').textContent = ''; $('dreamStars').innerHTML = '';
    drawDreamArt();
    const plan = $('dreamPlan'); plan.innerHTML = '';
    if (life.band === 3) {   // teens: tomorrow's budget, and a chance to save before bed
      const r = Life.previewBills(life, town, me.uid);
      if (r) {
        const inc = r.lines.filter(l => l.n > 0 && l.night && l.acct === 'pocket').reduce((a, l) => a + l.n, 0), out = r.lines.filter(l => l.n < 0 && l.acct === 'pocket').reduce((a, l) => a - l.n, 0);
        const sgn = (n, c) => n ? `<b class="${c}">${c === 'pos' ? '+' : '−'}${coin(n)}</b>` : `<b>${coin(0)}</b>`;
        plan.innerHTML = `<div class="budget"><div><span>💤 Comes in overnight</span>${sgn(inc, 'pos')}</div><div><span>🧾 Tomorrow's bills${life.rentFree ? ` <small>(rent free for ${life.rentFree} more day${life.rentFree === 1 ? '' : 's'})</small>` : ''}</span>${sgn(out, 'neg')}</div><div class="total"><span>👛 Tomorrow</span><b>${coin(r.coins)}</b></div></div>`;
        if (life.coins >= 10) plan.append(button('🐷 Save 10 before bed', (b) => { if (Life.bank(life, 'deposit', 10).ok) { daily('save', 10); b.disabled = true; b.textContent = '✓ 🐷 +10'; touch(); hud(); } }, 'choice'));
      }
    }
    clearInterval(dreamT); dreamT = setInterval(dreamTick, 3000); setTimeout(dreamTick, 800);
    if (typeof Music !== 'undefined' && musicStarted) Music.play('night');
  }
  // a star twinkles somewhere in the dream: tap it and count
  function dreamTick() {
    if (Care.locked || !sleeping) return;
    const box = $('dreamStars'); while (box.children.length >= 3) box.firstChild.remove();
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dream-star'; b.textContent = '⭐'; b.setAttribute('aria-label', 'Catch the star');
    b.style.left = (8 + Math.random() * 78) + '%'; b.style.top = (6 + Math.random() * 40) + '%';
    b.addEventListener('click', () => {
      b.remove(); dreamCaught++; Sound.note(3 + (dreamCaught % 8), 'bell');
      const got = Life.dreamStar(life), c = $('dreamCount');
      c.textContent = String(dreamCaught); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
      if (got) { touch(); hud(); }
    });
    box.append(b);
  }
  function drawDreamArt() {
    const c = $('dreamArt'), x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = '#fff6c9'; x.beginPath(); x.arc(270, 40, 24, 0, 7); x.fill(); x.fillStyle = '#2a2356'; x.beginPath(); x.arc(282, 32, 22, 0, 7); x.fill();
    x.fillStyle = '#f7f1e3'; rr(x, 66, 118, 188, 76, 30); x.fill(); x.lineWidth = 4; x.strokeStyle = '#1f1a2e'; x.stroke();   // the pillow
    x.save(); x.translate(160, 142); x.scale(2, 2);
    drawHead(x, 0, 0, 'sleepy', performance.now() / 1000, { color: me.color === '#e4572e' ? '#f4b942' : '#e4572e' });
    x.restore();
    x.fillStyle = me.color; rr(x, 22, 176, 276, 76, 24); x.fill(); x.lineWidth = 4; x.strokeStyle = '#1f1a2e'; x.stroke();   // the blanket, in your hoodie colour
    x.fillStyle = 'rgba(255,255,255,.3)'; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(52 + i * 43, 214, 7, 0, 7); x.fill(); }
    x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif'; x.fillText('z', 222, 82); x.font = 'bold 18px sans-serif'; x.fillText('z', 240, 62);
  }
  function wakeUp() {
    if (!sleeping) return;
    sleeping = false; clearInterval(dreamT); $('dream').hidden = true; $('dreamStars').innerHTML = '';
    if (World.sleep) World.sleep(false); World.mood('happy', 1);
    Sound.rooster(); const p = World.pos(); World.burst(p.x, p.y, 'confetti', 16, 4);
    startMusic(); touch(); hud(); setTimeout(flushQueue, 300);
  }
  $('wakeBtn').addEventListener('click', () => { Sound.blip(); wakeUp(); });

  /* ---------------- pickups: pool coins, sparkle trail, coin rain, the pot of gold ---------------- */
  let poolNote = 0;
  function onPickup(id) {
    if (id.startsWith('nb:')) return crunchBrick(id);
    if (id.startsWith('race:')) return raceCrunch(id);
    if (id === 'snail:gift') return meetSnail();
    if (id.startsWith('trail:')) { if (Life.kidBonus(life, 'trail', 1, '✨', 'Sparkle coin', 'Found on the way!')) { Sound.coin(); floatMe('+1🪙'); } }
    else if (id.startsWith('pool:')) { Life.earn(life, 1, null, '🏊', 'Pool coin', 'Found in the pool after your morning swim!'); Sound.note(6 + (poolNote++ % 5), 'bell'); floatMe('+1🪙'); }
    else if (id.startsWith('rain:')) { if (Life.kidBonus(life, 'rain', 1, '🪙', 'Coin rain!', 'Coins fell from the sky!')) { Sound.coin(); floatMe('+1🪙'); } memory('coinrain'); }
    else if (id.startsWith('pot:') && !life.wonders[id]) { life.wonders[id] = 1; Life.earn(life, 5, null, '🌈', 'Pot of gold at the end of the rainbow'); Life.addStars(life, 1); Sound.chord(8, 'bell'); World.celebrate(8); floatMe('🌈 +5🪙 ⭐+1'); memory('rainbow'); guide = null; }
    touch(); hud();
  }
  /* ---------------- the noodle hunt (from Noodle Universe): golden bricks in every town, every morning ---------------- */
  // Walk into a brick to crunch it. Each town's bricks hide that kind of town's noodle; quick crunches make a combo and a tune.
  const BRICK_VOICE = { mountain: 'bell', desert: 'tom', beach: 'steel', lake: 'glass', forest: 'kalimba', college: 'harp', uptown: 'flute', oldtown: 'harp' };
  function brickSpots(k) {
    if (!k) { const g = Town.GARDEN0; return [[g.x - 40, g.y - 40], [g.x + g.w + 40, g.y - 40], [g.x - 40, g.y + g.h + 40], [g.x + g.w + 40, g.y + g.h + 40], [g.x + g.w / 2, g.y + g.h + 90]]; }
    const d = Town.district(k), g = d.garden;
    return [[g.x - 50, g.y + 40], [g.x + g.w + 50, g.y + 40], [g.x - 50, g.y + g.h - 40], [g.x + g.w + 50, g.y + g.h - 40], [d.x0 + 560, 1820], [d.x0 + 1450, 1820]];
  }
  let brickKey = '';
  function spawnBricks(force) {
    if (!World.addPickups || World.trip || !town || !life) return;
    const day = life.day; if (!day) return;
    // only the town you are in and its neighbours, so an endless region never runs out of room for bricks
    const here = World.pos ? Town.districtAt(town, World.pos().x) : 0, lo = Math.max(0, here - 1), hi = Math.min(town.districts || 0, here + 1);
    const key = `${day}:${lo}-${hi}:${townKey()}`; if (key === brickKey && !force) return; brickKey = key;
    if (life.crunched.day !== day) life.crunched = { day, ids: {}, stars: 0 };
    World.clearPickups('nb:');
    const list = [];
    for (let k = lo; k <= hi; k++) brickSpots(k).forEach(([x, y], i) => { const id = `nb:${day}:${k}:${i}`; if (!life.crunched.ids[id]) list.push({ id, x, y, kind: 'brick' }); });
    World.addPickups(list);
    wildBricks(true);
    if (life.snail && !life.snail.done && snailArrived()) snailGift();
  }
  /* ---------------- the planet: the Wild, its discoveries, and the way home ---------------- */
  // Everything outside the towns is the Wild, made by js/planet.js as you walk (world3d streams it).
  const WILD_INFO = { stones: ['🗿', 'Stone Circle'], ruins: ['🏛️', 'Old Ruins'], well: ['🪣', 'Wishing Well'], camp: ['⛺', 'Campsite'], statue: ['🗽', 'Squareface Statue'],
    tower: ['🗼', 'Watchtower'], bigshroom: ['🍄', 'Giant Mushroom'], crystal: ['💎', 'Crystal Cave'], igloo: ['🧊', 'Snow Fort'], arch: ['🌉', 'Red Arch'], mesa: ['🏜️', 'Mesa'],
    lighthouse: ['🗼', 'Lighthouse'], pole: ['🚩', 'Pole'], shipwreck: ['⚓', 'Shipwreck'], pyramid: ['🔺', 'Pyramid'], temple: ['🛕', 'Jungle Temple'],
    cabin: ['🛖', 'Log Cabin'], bigtree: ['🌳', 'Ancient Tree'], snowman: ['⛄', 'Snowman'], totem: ['🪵', 'Totem Pole'], scarecrow: ['🌾', 'Scarecrow'] };
  const ANIMAL_INFO = { sheep: '🐑', rabbit: '🐰', deer: '🦌', fox: '🦊', penguin: '🐧', camel: '🐪', parrot: '🦜', crab: '🦀' };
  // things to pick in the Wild: into your bag, to sell or cook. They grow back every morning.
  function wildPickedToday() { if (life.wildPicked.day !== life.day) life.wildPicked = { day: life.day, ids: [] }; return life.wildPicked; }
  function pickWild(it) {
    const wp = wildPickedToday(); if (wp.ids.includes(it.id)) return;
    wp.ids.push(it.id); World.pickWild(it.id);
    const n = life.band === 1 ? 2 : 1, g = G[it.good] || {};
    Life.addItem(life, it.good, n); life.stats.foraged = (life.stats.foraged || 0) + 1;
    Sound.pop(); World.mood('happy', 1); floatMe(`+${n} ${g.icon || ''}`);
    if (!life.seen['forage']) { life.seen['forage'] = 1; toast(`<span class="t-small">🧺 Into your bag</span>${g.icon} ${esc(g.name || it.good)} · sell it at a market, or cook it at the Cafe`, { life: 5 }); }
    touch(); hud(); checkDream();
  }
  // animals are friendly: say hello for a heart (and a star for each kind of animal, once a day)
  function petAnimal(an) {
    const icon = ANIMAL_INFO[an.kind] || '🐾';
    Sound.chord(6, 'kalimba'); World.floatText(an.x, an.y, '💕', 'pay', 6); World.mood('love', 2);
    const k = 'pet:' + an.kind;
    if (!life.today.count[k]) { life.today.count[k] = 1; Life.addStars(life, 1); floatMe(`${icon} ⭐+1`); } else floatMe(icon + ' 💕');
    life.stats.petted = (life.stats.petted || 0) + 1;
    memory('a_' + an.kind); touch(); hud();
  }
  const HOME_G = { x: 4800, y: 1500 };   // Small Town's plaza, in game px
  const toW = (p) => ({ x: (p.x - 4800) / 10, z: (p.y - 1300) / 10 });   // game px -> planet metres (world3d's units)
  const inWildNow = () => !World.trip && !!World.inWild && World.inWild(World.pos().x, World.pos().y);
  const homeInfo = () => { const w = toW(World.pos()), h = toW(HOME_G); return Planet.heading(w.x, w.z, h.x, h.z); };
  const kmText = (m) => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
  const latText = (lat) => `${Math.abs(Math.round(lat))}°${lat >= 0 ? 'N' : 'S'}`;
  function wildSpotName(q) { const [icon, name] = WILD_INFO[q.type] || ['❔', 'Something']; return q.type === 'pole' ? [icon, q.pole === 'N' ? 'North Pole' : 'South Pole'] : [icon, name]; }
  function discover(q) {
    if (!q || life.wild[q.id]) return;
    life.wild[q.id] = life.day; life.stats.discoveries = (life.stats.discoveries || 0) + 1;
    const today = life.today.count.disc || 0; life.today.count.disc = today + 1;
    const [icon, name] = wildSpotName(q), star = today < 10;
    if (star) Life.addStars(life, 2);
    Sound.discover(); World.celebrate(14); World.mood('wow', 2);
    toast(`<span class="t-small">🧭 Discovery #${life.stats.discoveries}${star ? ' · ⭐ +2' : ''}</span>${icon} ${esc(name)}`, { big: true, life: 4 });
    memory('w_' + q.type);
    if (q.type === 'pole') { findNoodle('polar'); memory('w_pole'); }
    if (life.stats.discoveries >= 10) findNoodle('compass');
    touch(); hud(); checkDream();
  }
  // a noodle brick beside every discovery nearby, once a day each
  let wildBrickV = -1;
  function wildBricks(force) {
    if (!World.wildSpots || World.trip || !life || !life.day) return;
    if (World.wildVersion === wildBrickV && !force) return; wildBrickV = World.wildVersion;
    const day = life.day, spots = World.wildSpots(), have = new Set(World.pickups().map(q => q.id)), want = new Set();
    const add = [];
    spots.forEach(q => { const id = `nb:${day}:w:${q.id}`; want.add(id); if (!life.crunched.ids[id] && !have.has(id)) add.push({ id, x: q.x + 110, y: q.y + 90, kind: 'brick' }); });
    have.forEach(id => { if (id.startsWith(`nb:${day}:w:`) && !want.has(id)) World.clearPickups(id); });
    if (add.length) World.addPickups(add);
  }
  // what the Wild notices about you, twice a second
  let biomeWas = null, wildWas = false, walkFrom = null, poleWas = false;
  function planetTick() {
    if (World.trip || !life) { walkFrom = null; return; }
    const p = World.pos();
    // metres walked (big jumps are rides, balloons or wrapping round the planet, not walking)
    if (walkFrom) {
      const dx = p.x - walkFrom.x, dy = p.y - walkFrom.y, d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 9e5) { life.stats.round = (life.stats.round || 0) + 1; memory('b_round'); findNoodle('globe'); toast('<span class="t-small">🌍 All the way round!</span>You walked round the whole planet!', { big: true, life: 6 }); World.celebrate(40); }
      else if (d < 400) { life.stats.walked = (life.stats.walked || 0) + d / 10; if (wildWas) life.stats.wildWalked = (life.stats.wildWalked || 0) + d / 10; }
    }
    walkFrom = { x: p.x, y: p.y };
    const inW = inWildNow();
    if (inW !== wildWas) {
      wildWas = inW; biomeWas = null;
      if (inW) toast(`<span class="t-small">🌍 The Wild</span>🏡 ${kmText(homeInfo().dist)} · 🧭`, { life: 3 });
    }
    wildBar(inW);
    if (!inW) return;
    const h = homeInfo(); life.stats.farthest = Math.max(life.stats.farthest || 0, Math.round(h.dist));
    if ((life.stats.wildWalked || 0) >= 1000) findNoodle('trail');
    const s = World.planetAt(p.x, p.y), b = s.biome;
    if (b !== biomeWas) {
      const first = biomeWas !== null; biomeWas = b;
      const B = Planet.BIOME[b];
      if (first && B) toast(`${B.icon} ${esc(B.name)}`, { life: 2 });
      if (b === 'snow') { memory('b_snow'); findNoodle('frost'); }
      if (b === 'desert') { memory('b_desert'); findNoodle('sand'); }
      if (b === 'jungle') memory('b_jungle');
    }
    if (b === 'sea' && World.swimming && h.dist > 300) { memory('b_sea'); findNoodle('wave'); }
    const atPole = Math.abs(s.lat) > 88.6;
    if (atPole && !poleWas) { findNoodle('polar'); memory('w_pole'); toast(`<span class="t-small">🚩 ${s.lat > 0 ? 'North' : 'South'} Pole!</span>You are at the top of the world!`, { big: true, life: 5 }); }
    poleWas = atPole;
    wildBricks();
  }
  // the compass: how far home is, and which way (the arrow points home; up the screen is north)
  function wildBar(on) {
    let el = document.getElementById('wildBar');
    if (!on) { if (el) el.hidden = true; return; }
    if (!el) {
      el = document.createElement('button'); el.id = 'wildBar'; el.type = 'button'; el.setAttribute('aria-label', 'Compass: the way home');
      el.addEventListener('click', () => { Sound.blip(); wildSheet(); });
      document.body.append(el);
    }
    const h = homeInfo(), s = World.planetAt(World.pos().x, World.pos().y), B = Planet.BIOME[s.biome] || {};
    el.hidden = false;
    el.innerHTML = `<span class="wb-arrow" style="transform:rotate(${Math.round(h.deg)}deg)">⬆</span><b>🏡 ${kmText(h.dist)}</b><small>${B.icon || ''} ${latText(s.lat)}</small>`;
  }
  function wildSheet() {
    const h = homeInfo(), p = World.pos(), s = World.planetAt(p.x, p.y), B = Planet.BIOME[s.biome] || {};
    sheet('🧭', (body) => {
      body.append(card(`<h3>${B.icon || '🌍'} ${esc(B.name || 'The Wild')} · ${latText(s.lat)}</h3><p class="small">${life.band === 1 ? `🏡 ${kmText(h.dist)}` : `Small Town is ${kmText(h.dist)} to the ${h.word}. Up the screen is north: walk north for snow, south towards the warm equator.`}</p>
        <p class="small">🧭 ${life.stats.discoveries || 0} · 🥾 ${kmText(life.stats.walked || 0)} · 🏁 ${kmText(life.stats.farthest || 0)}</p>`));
      body.append(row(button('🎈 Fly home', () => { closeSheet(); goHome(); }, 'choice'), button('🌍 Planet', () => { closeSheet(); planetView(); }, 'choice alt')));
    });
  }
  // a balloon ride home (world3d animates it when it can)
  function goHome() {
    const to = { x: HOME_G.x, y: HOME_G.y + 60 };
    Sound.chord(5, 'bell');
    const done = () => { toast('<span class="t-small">🎈 Home again</span>🏡 Small Town', { big: true, life: 3 }); spawnBricks(true); hud(); };
    if (World.travel) World.travel('balloon', World.pos(), to, done); else { World.place(to.x, to.y); done(); }
  }
  function planetView() {
    if (!window.Globe) return toast('🌍 ⏳');
    const w = toW(World.pos());
    Globe.open({
      me: { x: w.x, z: w.z, color: me.color },
      friends: [...Net.others.values()].filter(o => o.x != null && o.y < 5e6).map(o => ({ ...toW({ x: o.tx ?? o.x, y: o.ty ?? o.y }), color: o.color, name: o.name })),
      home: toW(HOME_G), towns: (town.districts || 0),
      band: life.band,
      // tapped a place on the globe: the arrow points there, however far
      onPick: (at) => { guide = { x: at.x * 10 + 4800, y: at.z * 10 + 1300, h: 10, icon: '📍' }; const h = Planet.heading(w.x, w.z, at.x, at.z); toast(`<span class="t-small">📍 ${kmText(h.dist)} ${h.word}</span>Follow the arrow!`, { big: true, life: 4 }); },
    });
  }

  let combo = { n: 0, at: 0 };
  function crunchBrick(id) {
    const [, day, k] = id.split(':'), t = performance.now();
    if (life.crunched.day !== +day) life.crunched = { day: +day, ids: {}, stars: 0 };
    if (life.crunched.ids[id]) return;
    life.crunched.ids[id] = 1; life.stats.crunches = (life.stats.crunches || 0) + 1;
    combo = t - combo.at < 4000 ? { n: combo.n + 1, at: t } : { n: 1, at: t };
    life.stats.bestCombo = Math.max(life.stats.bestCombo || 0, combo.n);
    const d = +k ? Town.district(+k) : null, kind = d ? d.kind : null;
    Sound.crunch(1); Sound.note(4 + (combo.n - 1) % 8, BRICK_VOICE[kind] || 'marimba', { harmony: combo.n >= 3 });
    World.mood('crunch', 0.8);
    const cap = life.band === 1 ? 5 : 3;   // a few stars a day from bricks
    let msg = combo.n > 1 ? `🍜 ×${combo.n}` : '🍜';
    if ((life.crunched.stars || 0) < cap) { life.crunched.stars = (life.crunched.stars || 0) + 1; Life.addStars(life, 1); msg += ' ⭐+1'; }
    floatMe(msg);
    daily('crunch');
    // which noodle was inside?
    const hour = Life.hourOf ? Life.hourOf(now()) : 12;
    const kindNoodle = NOODLE_DEX.find(n => n.kind && n.kind === kind);
    const tries = [kindNoodle && kindNoodle.id, 'brick', hour >= 20 && 'glass', combo.n >= 5 && 'macaroni', combo.n >= 10 && 'rigatoni', Math.random() < 0.2 && 'crinkle'];
    const got = tries.find(n => n && !life.noodles[n]);
    if (got) findNoodle(got);
    else if (Math.random() < NOODLE_SHINY) {
      const have = Object.keys(life.noodles).filter(n => !life.shiny[n]);
      if (have.length) { const n = have[Math.floor(Math.random() * have.length)]; life.shiny[n] = Date.now(); Life.addStars(life, 2); later(() => { toast(`<span class="t-small">✨ Golden noodle! ⭐ +2</span>✨ ${esc(NOODLE_BY_ID[n].name)}`, { big: true, life: 4 }); Sound.secret(); World.celebrate(12); }); }
    }
    touch(); hud(); checkDream();
  }
  // a new noodle for the Noodle-dex: ⭐ +3
  function findNoodle(id) {
    const n = NOODLE_BY_ID[id]; if (!n || life.noodles[id]) return false;
    life.noodles[id] = Date.now(); Life.addStars(life, 3);
    const count = Object.keys(life.noodles).length;
    later(() => { toast(`<span class="t-small">🍜 New noodle! ${count}/${NOODLE_DEX.length} · ⭐ +3</span>${esc(n.name)}`, { big: true, life: 4 }); Sound.discover(); World.celebrate(10); });
    if (count === NOODLE_DEX.length) later(() => { toast('<span class="t-small">🏆 Noodle-dex complete!</span>🍜🍜🍜', { big: true, life: 5 }); World.celebrate(40); });
    touch(); hud();
    return true;
  }
  /* ---------------- Crunch Races (from Noodle Universe): 2 minutes, bricks around the plaza, most crunches wins ---------------- */
  // Anyone in a room with a friend can start one. Race bricks are shared: whoever gets there first crunches it.
  let race = null;   // { no, end, mine, bar }
  const raceId = (no, i) => `race:${no}:${i};`;   // the ';' keeps race:1:1 from matching race:1:10
  function raceSpots(no) {
    const P = Town.PLAZA, r = Town.rng ? Town.rng(no * 131 + 7) : Math.random, out = [];
    for (let i = 0; i < 36; i++) { const a = i * 2.39996 + r() * 0.5, d = 190 + (i % 6) * 85 + r() * 40; out.push([P.x + Math.cos(a) * d, P.y + Math.sin(a) * d * 0.8]); }
    return out;
  }
  function raceBar() {
    if (!race) return;
    let el = document.getElementById('raceBar');
    if (!el) { el = document.createElement('div'); el.id = 'raceBar'; document.body.append(el); }
    const left = Math.max(0, Math.ceil((race.end - Date.now()) / 1000)), list = (Net.scores || []).slice().sort((a, b) => (b.round || 0) - (a.round || 0));
    const mine = (list.find(e => e.id === Net.me) || {}).round || race.mine, best = list[0] ? list[0].round || 0 : 0;
    el.innerHTML = `<b>🏁 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b><span>🍜 ${mine}</span>${list.slice(0, 4).map(e => `<i style="background:${esc(e.color)}" title="${esc(e.name)}">${e.round || 0}</i>`).join('')}`;
    el.classList.toggle('lead', mine > 0 && mine >= best);
  }
  function raceStart(m) {
    if (World.trip || !World.addPickups) return;
    race = { no: m.no, end: Date.now() + m.secs * 1000, mine: 0 };
    World.clearPickups('race:');
    closeSheet();
    const P = Town.PLAZA, a = Math.random() * 6.28;
    if (!World.riding) World.place(P.x + Math.cos(a) * 60, P.y + 170 + Math.sin(a) * 30);   // everyone starts together at the plaza
    const gone = new Set(m.crunched || []);   // joined mid-race: bricks friends already crunched
    World.addPickups(raceSpots(m.no).map(([x, y], i) => ({ id: raceId(m.no, i), x, y, kind: 'brick', fixed: true })).filter(q => !gone.has(q.id)));
    guide = { x: P.x, y: P.y, h: 8, icon: '🏁' };
    toast(`<span class="t-small">🏁 Crunch Race${m.by ? ` · ${esc(m.by)} started it` : ''}</span>3 · 2 · 1 · 🍜!`, { big: true, life: 3 });
    Sound.chord(8, 'bell'); raceBar();
  }
  function raceCrunch(id) {
    if (!race || !id.startsWith(`race:${race.no}:`)) return;
    race.mine++;
    const n = race.mine;
    Net.crunch(id, 4 + (n - 1) % 8, 'marimba');
    Sound.crunch(1); Sound.note(4 + (n - 1) % 8, 'marimba', { harmony: n % 4 === 0 }); World.mood('crunch', 0.6); floatMe(`🍜 ${n}`);
    life.stats.crunches = (life.stats.crunches || 0) + 1; daily('crunch');
    raceBar();
  }
  function raceEnd(m) {
    if (!race) return;
    World.clearPickups('race:'); const el = document.getElementById('raceBar'); if (el) el.remove();
    race = null; if (guide && guide.icon === '🏁') guide = null;
    const won = m.valid && m.winners.includes(Net.me);
    const today = life.today.count.race || 0; life.today.count.race = today + 1;
    if (today < 3) Life.addStars(life, 1);   // ⭐ for racing, three races a day
    if (won) { life.stats.trophies = (life.stats.trophies || 0) + 1; Life.addStars(life, 2); findNoodle('thunder'); World.celebrate(30); Sound.chord(10, 'bell'); }
    touch(); hud();
    later(() => sheet(won ? '🏆 You won!' : '🏁 Race over', (body) => {
      body.insertAdjacentHTML('beforeend', `<div class="players">${m.list.map((e, i) => `<div class="player-row ${e.id === Net.me ? 'me' : ''}"><span class="rank">${i < 3 && e.n ? ['🥇', '🥈', '🥉'][i] : '#' + (i + 1)}</span><span class="dot" style="background:${esc(e.color)}"></span><span class="who">${esc(e.name)}</span><span class="stats"><span class="stat big">🍜 ${e.n}</span></span></div>`).join('')}</div>
        <p class="sheet-sub">${m.valid ? (won ? `🏆 +1 · ⭐ +${today < 3 ? 3 : 2}` : (today < 3 ? '⭐ +1 for racing' : '')) : 'A race needs two players who crunch.'}</p>`);
      body.append(button('🏁 Again', () => { Net.startRound(); closeSheet(); }, 'big-btn small'));
    }), true);
  }
  Net.on('round', (m) => { if (m.state === 'start') raceStart(m); else if (m.state === 'end') raceEnd(m); });
  Net.on('crunch', (m) => { if (typeof m.b === 'string' && m.b.startsWith('race:')) { World.clearPickups(m.b); if (m.n != null) Sound.note(m.n, 'marimba', { vol: 0.4 }); } });
  Net.on('scores', () => raceBar());
  setInterval(() => { if (race) { raceBar(); if (Date.now() > race.end + 8000) raceEnd({ valid: false, winners: [], list: [] }); } }, 500);
  Net.on('left', () => { if (race && Net.others.size === 0) raceBar(); });

  /* ---------------- the Udon Snail (from Noodle Universe): a week-long walk to Snowcap, and a gift at the end ---------------- */
  const SNAIL_DAYS = 7, SNAIL_TO = 5;   // Snowcap
  function snailTick() {
    if (!life || !life.day || !town || (town.districts || 0) < SNAIL_TO) return;
    if (!life.snail && Life.starLevel(life.xp) >= 3) {
      life.snail = { from: life.day, to: SNAIL_TO }; touch();
      later(() => { toast(`<span class="t-small">🐌 The Udon Snail set off!</span>🐌 → ${Town.district(SNAIL_TO).icon} ${SNAIL_DAYS} days`, { big: true, life: 5 }); Sound.secret(); });
    }
    if (life.snail && !life.snail.done && snailArrived()) snailGift();
  }
  const snailDays = () => life.snail ? Math.max(0, Math.min(SNAIL_DAYS, life.day - life.snail.from)) : 0;
  const snailArrived = () => !!life.snail && snailDays() >= SNAIL_DAYS;
  function snailGift() {
    if (World.trip || !World.addPickups || life.snail.done) return;
    const g = Town.district(life.snail.to).garden;
    World.addPickups([{ id: 'snail:gift', x: g.x + g.w / 2, y: g.y - 40, kind: 'star' }]);
  }
  function meetSnail() {
    if (!life.snail || life.snail.done) return;
    life.snail.done = life.day; life.hats.shell = 1; life.hat = 'shell'; World.setMe({ color: me.color, hat: 'shell' });
    Life.addStars(life, 5); findNoodle('slowudon');
    later(() => { toast('<span class="t-small">🐌 The Udon Snail made it! ⭐ +5</span>🐚 A golden shell hat for you!', { big: true, life: 5 }); World.celebrate(30); Sound.chord(9, 'bell'); });
    touch(); hud();
  }

  function noodleIcon(n, size, locked, shiny) {
    const c = document.createElement('canvas'); c.width = c.height = size * 2; c.style.width = c.style.height = size + 'px';
    try { drawNoodleIcon(c.getContext('2d'), n, size * 2, locked, shiny); } catch (e) {}
    return c;
  }
  function noodleSheet(sel) {
    const have = Object.keys(life.noodles).length;
    sheet(`🍜 ${have}/${NOODLE_DEX.length}`, (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">${life.band === 1 ? '🍜 → 🚶 → ⭐' : 'Walk into the golden noodle bricks in every town. They come back every morning. Each kind of town hides its own noodle.'}</p>`);
      const grid = document.createElement('div'); grid.className = 'dex';
      NOODLE_DEX.forEach(n => {
        const got = !!life.noodles[n.id], b = document.createElement('button'); b.type = 'button'; b.className = 'dex-cell' + (sel === n.id ? ' on' : '') + (got ? '' : ' locked');
        b.append(noodleIcon(n, 54, !got, !!life.shiny[n.id]));
        b.addEventListener('click', () => { Sound.blip(); noodleSheet(n.id); });
        grid.append(b);
      });
      if (sel) { const n = NOODLE_BY_ID[sel], got = life.noodles[sel]; body.append(card(`<h3>${got ? esc(n.name) : '❔'}${life.shiny[sel] ? ' ✨' : ''}</h3><p class="small">${got ? `${{ common: 'Common', rare: 'Rare', legendary: 'Legendary', secret: 'Secret' }[n.rarity]} · ` : ''}💡 ${esc(n.hint)}</p>`)); }
      body.append(grid);
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">🍜 ${life.stats.crunches || 0} crunched · best combo ×${life.stats.bestCombo || 0} · ✨ ${Object.keys(life.shiny).length} golden</p>`);
    });
  }

  // wonders: the same rare moment for everyone in the room
  function wonderTick() {
    if (World.trip || !World.addPickups) return;
    const w = Town.wonderAt(now());
    if ((w && w.id) === (wonder && wonder.id)) return;
    if (wonder) { if (World.rainbow) World.rainbow(false); if (World.shootingStars) World.shootingStars(false); World.clearPickups('rain:'); World.clearPickups('pot:'); if (guide && guide.icon === '🌈') guide = null; }
    wonder = w;
    if (!w) return;
    const p = World.pos();
    if (w.type === 'rain') { World.addPickups(Array.from({ length: 12 }, (_, i) => ({ id: `rain:${w.id}:${i}`, x: p.x + Math.cos(i * 0.52) * (110 + (i % 3) * 70), y: p.y + Math.sin(i * 0.52) * (110 + (i % 3) * 70), kind: 'coin' }))); toast('<span class="t-small">✨ Wonder!</span>🪙 🌧️ 🪙', { big: true, life: 4 }); }
    if (w.type === 'rainbow') { if (World.rainbow) World.rainbow(true, w.pot.x, w.pot.y); if (!life.wonders['pot:' + w.id]) { World.addPickups([{ id: 'pot:' + w.id, x: w.pot.x, y: w.pot.y, kind: 'pot' }]); guide = { ...w.pot, h: 8, icon: '🌈' }; } toast('<span class="t-small">✨ Wonder!</span>🌈 → 🍯', { big: true, life: 4 }); }
    if (w.type === 'stars') { if (World.shootingStars) World.shootingStars(true); toast('<span class="t-small">✨ Wonder!</span>🌠 → 🙏', { big: true, life: 4 }); }
    Sound.chord(9, 'bell');
  }
  function makeWish() {
    if (!wonder || life.wonders['wish:' + wonder.id]) return;
    life.wonders['wish:' + wonder.id] = 1; Life.addStars(life, 1); memory('wish'); findNoodle('cloud');
    const p = World.pos(); World.floatText(p.x, p.y, '🌠 ⭐+1', 'pay'); Sound.chord(9, 'bell'); World.mood('love', 2); touch(); hud();
  }
  // two friends swimming together: a star once a day
  function buddies() {
    if (!online() || !World.swimming || life.today.bonus.buddy) return;
    const p = World.pos(); if (!Town.inPool(p.x, p.y)) return;
    for (const o of Net.others.values()) if (o.sw && Town.inPool(o.tx ?? o.x, o.ty ?? o.y)) { life.today.bonus.buddy = 1; Life.addStars(life, 1); World.floatText(p.x, p.y, '🏊🤝🏊 ⭐+1', 'pay'); Sound.chord(5, 'bell'); touch(); hud(); return; }
  }

  /* ---------------- ⭐ stars and levels ---------------- */
  function levelTick() {
    const got = Life.claimLevels(life); if (!got.length) return;
    touch();
    got.forEach(g => later(() => { Sound.chord(7, 'bell'); World.celebrate(10); toast(`<span class="t-small">⭐ Level ${g.L}!</span>${g.hat ? `${HAT_ICON[g.hat] || '🎩'} New hat!` : `+${coin(g.coins)}`}`, { big: true, life: 4 }); }));
    if (got.some(g => g.hat)) World.setMe({ color: me.color, hat: life.hat });
  }
  const liveStreak = () => life.lastPerfect === life.day || life.lastPerfect === life.prevPlayed ? life.streak || 0 : 0;
  // How to reach the next level: every way to earn stars, how many it gives, whether it is still open today,
  // and one tap puts the guide arrow on it. Things you can do right now come first.
  function levelWays(toGo) {
    const t = now(), rows = [], go = (at, icon) => () => { const w = placeFor(at); if (w) { guide = { ...w, icon }; closeSheet(); toast(`${icon} ➤`, { life: 2 }); } else toast(`${icon} ⏳`, { life: 2 }); };
    Object.entries(Life.RITUALS).forEach(([id, T]) => { const st = Life.ritualState(life, id, t); rows.push({ icon: T.icon, text: T.name, stars: '+1', state: st === 'open' ? 'now' : st === 'done' ? 'done' : 'later', note: st === 'done' ? 'done today' : st === 'open' ? 'open now' : `${Life.RULES[life.band].win[id][0]}:00`, run: go(T.at, T.icon) }); });
    (life.daily ? life.daily.list : []).forEach(c => { const D = Life.DAILY_BY_ID[c.id]; rows.push({ icon: D.icon, text: D.text, stars: '+1', state: c.done ? 'done' : 'now', note: c.done ? 'done today' : `${c.n}/${c.goal}`, run: go(D.at, D.icon) }); });
    if (life.daily && life.daily.list.length) rows.push({ icon: '🌟', text: 'Perfect Day: all 3 challenges', stars: '+2', state: life.daily.perfect ? 'done' : 'soon', note: life.daily.perfect ? 'done today' : `${life.daily.list.filter(c => c.done).length}/3` });
    const cap = life.band === 1 ? 5 : 3, got = life.crunched && life.crunched.day === life.day ? life.crunched.stars || 0 : 0;
    rows.push({ icon: '🍜', text: 'Crunch noodle bricks', stars: '+1 each', state: got < cap ? 'now' : 'done', note: `${got}/${cap} today`, run: go('brick', '🍜') });
    const g = Life.dreamGoal(life);
    if (g) rows.push({ icon: g.icon || '✨', text: g.text, stars: '+2', state: 'now', note: g.of ? `step ${g.i + 1}/${g.of}` : 'dream level', run: go(g.at, g.icon || '✨') });
    else rows.push({ icon: '✨', text: 'Pick a dream', stars: '+2 a step', state: 'now', note: '', run: () => { closeSheet(); dreamPicker(true); } });
    const nextKind = Town.districtsOf(town).find(d => !life.kindsSeen[d.kind]);
    if (nextKind) rows.push({ icon: nextKind.icon, text: `Visit ${nextKind.name}`, stars: '+5', state: 'now', note: 'new memory', run: go('kind:next', nextKind.icon) });
    if (life.snail && !life.snail.done) {
      const to = Town.district(life.snail.to);
      if (snailArrived()) rows.push({ icon: '🐌', text: `Meet the Udon Snail in ${to.name}`, stars: '+5 🐚', state: 'now', note: 'it made it!', run: go(`kind:${to.kind}`, '🐌') });
      else rows.push({ icon: '🐌', text: `The Udon Snail is walking to ${to.name}`, stars: '+5 🐚', state: 'soon', note: `day ${snailDays()}/${SNAIL_DAYS}` });
    } else if (!life.snail) rows.push({ icon: '🐌', text: 'Reach level 3 to meet the Udon Snail', stars: '+5 🐚', state: 'later', note: '' });
    { const spots = World.wildSpots ? World.wildSpots().filter(q => !life.wild[q.id]) : [], p = World.pos(), q = spots.length ? nearest(spots, p) : null;
      rows.push({ icon: '🧭', text: 'Explore the Wild: find discoveries', stars: '+2 each', state: 'now', note: `${life.stats.discoveries || 0} found · walk off the edge of town`, run: () => { const t = q || { x: p.x, y: -900 }; guide = { x: t.x, y: t.y, h: 10, icon: '🧭' }; closeSheet(); toast('🧭 ➤', { life: 2 }); } }); }
    rows.push({ icon: '🎓', text: 'Take a class', stars: life.band === 1 ? '+1 a right answer' : '+1, +3 for a certificate', state: 'now', note: '', run: go('school', '🎓') });
    rows.push({ icon: '📸', text: 'New places and firsts', stars: '+5', state: 'soon', note: `${Life.memCount(life)}/${Object.keys(Life.MEMORIES).length}`, run: () => { closeSheet(); lifeSheet(); } });
    rows.push({ icon: '🍜', text: 'New noodles for the Noodle-dex', stars: '+3', state: 'soon', note: `${Object.keys(life.noodles).length}/${NOODLE_DEX.length}`, run: () => noodleSheet() });
    const rank = { now: 0, soon: 1, later: 2, done: 3 };
    rows.sort((a, b) => rank[a.state] - rank[b.state]);
    const box = card(`<h3>🪜 How to level up</h3>`, 'ways');
    rows.forEach(r => {
      const b = document.createElement('button'); b.type = 'button'; b.className = `way ${r.state}`;
      b.innerHTML = `<span class="w-icon">${r.icon}</span><span class="w-text">${esc(r.text)}${r.note ? `<small>${esc(r.note)}</small>` : ''}</span><span class="w-stars">${r.state === 'done' ? '✓' : `⭐ ${esc(r.stars)}`}</span>`;
      if (r.run && r.state !== 'done') b.addEventListener('click', () => { Sound.blip(); r.run(); }); else b.disabled = r.state === 'done';
      box.append(b);
    });
    return box;
  }
  function starSheet() {
    syncDaily();
    const lv = Life.starLevel(life.xp), lo = Life.starsFor(lv), hi = Life.starsFor(lv + 1), next = Life.levelReward(lv + 1, life.band), t = now();
    sheet(`⭐ Level ${lv}`, (body) => {
      body.insertAdjacentHTML('beforeend', `<div class="star-big"><b>⭐ ${life.xp}</b><div class="progress"><div style="width:${Math.round((life.xp - lo) / (hi - lo) * 100)}%"></div></div><span>Lv ${lv + 1}: ${next.hat ? `${HAT_ICON[next.hat]} new hat` : `+${coin(next.coins)}`} · ${hi - life.xp} ⭐ to go</span></div>`);
      body.append(levelWays(hi - life.xp));
      body.insertAdjacentHTML('beforeend', `<div class="ritual-row">${Object.entries(Life.RITUALS).map(([id, T]) => `<span class="${Life.ritualState(life, id, t)}">${T.icon}<small>${life.band === 1 ? '' : T.name}</small></span>`).join('')}<span>${life.band === 1 ? `🌟×${life.perfectDays || 0}` : `🔥 ${liveStreak()}`}<small>${life.band === 1 ? '' : 'Perfect Days in a row'}</small></span></div>`);
      body.insertAdjacentHTML('beforeend', '<h4 class="sub-h">🎯 Today</h4>'); body.append(challengeTiles());
      const hats = Object.keys(life.hats || {});
      if (hats.length) {
        body.insertAdjacentHTML('beforeend', '<h4 class="sub-h">🎩</h4>');
        body.append(tiles(tile('🙂', '', '', () => { life.hat = null; World.setMe({ color: me.color, hat: null }); touch(); starSheet(); }, { on: !life.hat }),
          hats.map(h => tile(HAT_ICON[h] || '🎩', '', '', () => { life.hat = h; World.setMe({ color: me.color, hat: h }); Sound.pop(); touch(); starSheet(); }, { on: life.hat === h }))));
      }
      body.append(button('🏆 Leaderboard', () => boardSheet(), 'choice alt'));
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">${life.band === 1 ? '🌅 🌇 🛏️ 🎯 📸 → ⭐' : 'Stars come from the swim, sip and bed, challenges, memories, classes and your dream.'}</p>`);
    });
  }
  $('starPill').addEventListener('click', () => { Sound.blip(); starSheet(); });
  $('ritualStrip').addEventListener('click', (e) => { e.stopPropagation(); Sound.blip(); starSheet(); });

  /* ---------------- age: set once on the title screen, changed later only by a grown-up ---------------- */
  function agePicker() {
    sheet('👤', (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Age group: ${BAND_NAMES[life.band]}. Younger kids have no bills or tax; older kids learn rent, tax and loans.</p>`);
      const box = document.createElement('div'); box.className = 'tabs ages';
      for (let a = 6; a <= 16; a++) box.append(button(String(a), () => {
        me.age = a; me.ageAt = Date.now();
        const changed = Life.setBand(life, bandOfAge(a)); me.band = life.band; save(); touch(); hud();
        closeSheet(); toast(`👤 ${a} · ${BAND_NAMES[life.band]}${changed ? ' ✓' : ''}`, { big: true });
      }, 'tab' + (me.age === a ? ' on' : '')));
      body.append(box);
    });
  }
  $('ageBtn').addEventListener('click', () => { $('menuPop').hidden = true; Care.grownUp(() => agePicker(), 'Change the age group'); });
  // a real birthday: one year older (maybe a new age group, with one new idea on each screen)
  function birthdayCheck() {
    if (!me.age || !me.ageAt) return;
    const Y = 365 * 864e5, years = Math.floor((Date.now() - me.ageAt) / Y); if (years < 1) return;
    me.age += years; me.ageAt += years * Y;
    const up = Life.setBand(life, bandOfAge(me.age)); me.band = life.band;
    Life.earn(life, 20, null, '🎂', `Happy birthday! You are ${me.age}`);
    const NEW = { 2: ['🏛️ You pay a little tax now (half of the grown-up rate).', '🏢 Rent is 3 a day after 3 free days, until you build a house.', '🧾 If coins run short, your savings pay first, then you owe it (no interest).'],
      3: ['🏛️ Full income tax, and land tax.', '🏢 Rent is 5 a day.', '💸 The bank lends coins, but loans grow every morning.'] };
    later(() => sheet(`🎂 ${me.age}!`, (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">🎁 +${coin(20)}</p>` + (up ? (NEW[life.band] || []).map(t => `<div class="lesson next"><span>${esc(t)}</span></div>`).join('') : ''));
      body.append(button('✓', closeSheet, 'big-btn small'));
    }));
  }

  /* ---------------- dreams ---------------- */
  function dreamPicker(first, all = false) {
    sheet(first ? '✨ I want to be…' : '✨ Dreams', (body) => {
      const kid = life.band === 1, ids = all && !kid ? Object.keys(Life.DREAMS) : Life.FEATURED_BY_BAND[life.band] || Life.FEATURED;
      const grid = document.createElement('div'); grid.className = 'tiles dreams';
      ids.forEach(id => {
        const d = Life.DREAMS[id];
        grid.append(tile(d.icon, kid ? '' : d.name, '', () => dreamPreview(id, first), { on: life.dream === id }));
      });
      if (!all && !kid) grid.append(tile('➕', `${Object.keys(Life.DREAMS).length - ids.length} more`, '', () => dreamPicker(first, true)));
      body.append(grid);
    });
  }
  function dreamPreview(id, first) {
    const d = Life.DREAMS[id];
    sheet(`${d.icon} ${d.name}`, (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">${esc(d.desc)}</p>` + Life.stepsOf(life, d).map(([text, , , icon], i) => `<div class="lesson next"><span class="mark">${icon}</span><span>${esc(text)}</span></div>`).join('') + '<div class="lesson next"><span class="mark">∞</span><span>…and it never ends</span></div>');
      body.append(row(button('✓ This is my dream', () => {
        if (life.dream !== id) { life.dream = id; life.dreamStep = 0; life.dreamLv = 0; life.dreamMark = life.stats.earned; }
        life.seen.pickedDream = 1;
        touch(); closeSheet(); checkDream(); hud(); markers();
        const g = Life.dreamGoal(life);
        toast(`<span class="t-small">${d.icon} ${esc(d.name)}</span>→ ${g.icon} ${esc(g.text)} · follow ➤`, { big: true, life: 5 });
        Sound.chord(5, 'bell');
        if (!life.daily || !life.daily.shown) later(() => todaySheet());
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
      body.append(myThings());
      body.append(card(`<h3>🎓 ${Object.entries(Life.SUBJECTS).map(([s, x]) => `${x.icon}${Life.hasCert(life, s) ? '✓' : '·'}`).join(' ')} ${life.badges.pilot ? '🧑‍✈️' : ''}${life.badges.astronaut ? '🧑‍🚀' : ''}</h3>`));
      body.append(row(button('🪪 My card', () => cardSheet('me'), 'choice alt'), button(`🍜 ${Object.keys(life.noodles).length}/${NOODLE_DEX.length}`, () => noodleSheet(), 'choice alt')));
      const dc = card(`<h3>${d ? `${d.icon} ${esc(Life.title(life))}` : '✨'}</h3>${d ? dreamSteps() : ''}`);
      dc.append(button('✨ ↻', () => dreamPicker(), 'choice alt'));
      body.append(dc);
      const mem = Object.entries(Life.MEMORIES);
      body.insertAdjacentHTML('beforeend', `<h4 class="sub-h">📸 ${Life.memCount(life)}/${mem.length} · ⭐ ${life.xp} · Lv ${Life.starLevel(life.xp)}</h4>`);
      body.append(tiles(mem.map(([id, [icon, name]]) => tile(life.memories[id] ? icon : '❔', '', life.memories[id] ? esc(name) : '', null, { cls: life.memories[id] ? 'mem' : 'mem locked' }))));
    });
  }

  // everything you own, what it costs every day, and a way to sell it (tap twice to be sure)
  function myThings() {
    const c = card(`<h3>🔑 My things</h3>`), list = document.createElement('div'); list.className = 'things';
    const item = (icon, name, daily, sellText, onSell) => {
      const r = document.createElement('div'); r.className = 'thing';
      r.innerHTML = `<span class="thing-i">${icon}</span><span class="thing-t"><b>${esc(name)}</b><small>${daily}</small></span>`;
      if (onSell) r.append(button(sellText, (el) => { if (sure(el, '✓ Sure?')) onSell(); }, 'choice alt'));
      list.append(r);
    };
    const home = Life.ownsHouse(town, me.uid) || life.home;
    const rent = Life.rentOf(life);
    item(home ? '🏠' : '🏢', home ? 'Your own home' : 'Apartment', home || !rent ? 'No rent' : life.rentFree ? `Rent free for ${life.rentFree} more day${life.rentFree === 1 ? '' : 's'}, then −${rent}🪙 every day` : `Rent −${rent}🪙 every day`);
    myPlots().forEach(p => {
      const running = life.companies.some(co => co.plot === p.id), back = Math.floor(p.plot.price / 2) + (p.build && Town.BUILD[p.build] ? Math.floor(Town.BUILD[p.build].coins / 2) : 0);
      item(p.plot.kind === 'farm' ? '🌱' : ({ shop: '🏪', house: '🏠', villa: '🏡', company: '🏭' })[p.build] || '🏗️', `Land ${p.id}${p.build ? ' · ' + Town.BUILD[p.build].name : ''}`, `${Life.landTaxOf(life, p.plot.kind) ? `Land tax −${Life.landTaxOf(life, p.plot.kind)}🪙 every day` : 'No land tax'}${running ? ' · close its company to sell' : ''}`,
        `Sell +${coin(back)}`, running ? null : () => sellLand(p));
    });
    Object.keys(life.vehicles).forEach(v => { const V = Life.VEHICLES[v]; item(V.icon, V.name, Life.upkeepOf(life, v) ? `Fuel & repairs −${Life.upkeepOf(life, v)}🪙 every day` : 'No daily cost', `Sell +${coin(Math.floor(V.price / 2))}`, () => {
      if (World.vehicle === v) World.setVehicle(null);
      Life.sellVehicle(life, v); Sound.cash(); touch(); hud(); lifeSheet();
    }); });
    life.companies.forEach(co => { const T = Life.COMPANIES[co.type]; item(T.icon, T.name, `Costs −${T.upkeep * co.level}🪙 + workers every day, sales come in`, `Close +${coin(Life.closeValue(co))}`, () => { Life.company(life, 'close', co.id); Sound.cash(); touch(); hud(); lifeSheet(); }); });
    c.append(list);
    return c;
  }
  async function sellLand(p) {
    const key = townKey();
    landBook(p.id, { selling: true }, key);
    const res = await act({ type: 'sellPlot', id: p.id });
    if (!res.ok) { if (!res.slow && !res.lost) landBook(p.id, { selling: false }, key); return toast(`⚠️ ${esc(res.msg)}`); }
    afterSellLand(p.id, res, key);
    Sound.cash(); lifeSheet();
  }
  function afterSellLand(id, res, key) {
    if (res.refund) Life.earn(life, res.refund, null, '🏡', `Sold land ${id} back to the town`, 'The town buys land back for half of what it cost (and half of what was built on it). No more land tax for it.');
    if (res.build === 'shop') Object.entries(life.shelf).forEach(([g, n]) => { if (n > 0) { Life.addItem(life, g, n); life.shelf[g] = 0; } });
    // still a home? Look at the other land you own (the town copy here may not know about the sale yet)
    if ((res.build === 'house' || res.build === 'villa') && life.home === key && !Life.ownedPlots(town, me.uid).some(q => q.id !== id && (q.build === 'house' || q.build === 'villa'))) life.home = null;
    landBook(id, null, key);
    touch(); hud();
  }
  // a second tap to agree, instead of a grown-up confirm box
  function sure(el, text) {
    if (el.dataset.sure) return true;
    el.dataset.sure = 1; el.dataset.was = el.innerHTML; el.innerHTML = text; el.classList.add('sure');
    setTimeout(() => { if (el.isConnected) { delete el.dataset.sure; el.innerHTML = el.dataset.was; el.classList.remove('sure'); } }, 3500);
    return false;
  }

  /* ---------------- map ---------------- */
  const MAP_TINT = { downtown: '#cfcac0', uptown: '#c9e6a8', rural: '#d7e79a', beach: '#f1e2b3', mountain: '#b7cf9a', college: '#c8dfa5', oldtown: '#d5ccbc', lake: '#b7deb8', desert: '#e8c79a', forest: '#93bf73' };
  function drawCompass(c) {
    const x = c.getContext('2d'), W = c.width, H = c.height, h = homeInfo(), p = World.pos(), s = World.planetAt(p.x, p.y), B = Planet.BIOME[s.biome] || {};
    x.fillStyle = B.ground || '#b4dc7a'; x.fillRect(0, 0, W, H);
    x.save(); x.translate(W / 2, H / 2 - 8); x.rotate(h.deg * Math.PI / 180);
    x.fillStyle = '#e4572e'; x.strokeStyle = '#34233f'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, -46); x.lineTo(24, 16); x.lineTo(0, 4); x.lineTo(-24, 16); x.closePath(); x.fill(); x.stroke(); x.restore();
    x.fillStyle = '#34233f'; x.font = '800 22px "Baloo 2", sans-serif'; x.textAlign = 'center'; x.fillText('🏡 ' + kmText(h.dist), W / 2, H - 16);
    x.font = '800 16px "Baloo 2", sans-serif'; x.fillText('N', W / 2, 18);
  }
  function drawMap(c, big) {
    if (!big && inWildNow()) return drawCompass(c);
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
    const TINT = MAP_TINT;
    Town.districtsOf(town).forEach(d => { x.fillStyle = TINT[d.kind] || '#b4dc7a'; x.fillRect(X(d.x0), Y(B.y0), 2000 * k, (B.y1 - B.y0) * k); const G2 = d.garden; x.fillStyle = '#8cc45e'; x.fillRect(X(G2.x - G2.w / 2), Y(G2.y - G2.h / 2), G2.w * k, G2.h * k); });
    Town.districtsOf(town).forEach(d => {
      const n = d.nat; x.fillStyle = { lake: '#7fd0ea', beach: '#f4e3b5', hills: '#a8d46c', stars: '#9ccb78', grove: '#8cc45e', meadow: '#c3e58f', canyon: '#d98b5f' }[d.nature];
      x.beginPath(); x.ellipse(X(n.x), Y(n.y), 300 * k, 260 * k, 0, 0, 7); x.fill();
    });
    x.fillStyle = '#efe3c4'; x.beginPath(); x.arc(X(Town.PLAZA.x), Y(Town.PLAZA.y), Town.PLAZA.r * k, 0, 7); x.fill();
    x.fillStyle = '#7fd0ea'; [HOME.pool, Town.POND].forEach(w => { x.beginPath(); x.ellipse(X(w.x), Y(w.y), w.rx * k, w.ry * k, 0, 0, 7); x.fill(); });
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
    if (big) Town.districtsOf(town).forEach(d => { x.font = `bold ${Math.max(24, 90 * k)}px sans-serif`; x.textAlign = 'center'; x.fillStyle = '#34233f'; x.fillText(`${d.icon} ${d.name}`, X(d.x0 + 1000), Y(B.y0 + 330)); });
    x.textBaseline = 'alphabetic';
    mapMarks.forEach(m => { x.fillStyle = '#ffd23f'; x.strokeStyle = '#34233f'; x.lineWidth = 1.5; x.beginPath(); const px = X(m.x), py = Y(m.y), r = Math.max(4, 40 * k); x.moveTo(px, py - r); x.lineTo(px + r * 0.7, py); x.lineTo(px, py + r); x.lineTo(px - r * 0.7, py); x.closePath(); x.fill(); x.stroke(); });
    Net.others.forEach(o => { if (o.x == null || o.y > 5e6) return; x.fillStyle = o.color; x.strokeStyle = '#fff8e8'; x.lineWidth = 2; x.beginPath(); x.arc(X(o.tx ?? o.x), Y(o.ty ?? o.y), Math.max(3.5, 40 * k), 0, 7); x.fill(); x.stroke(); });
    if (!World.trip) { const p = World.pos(); x.fillStyle = me.color; x.strokeStyle = '#34233f'; x.lineWidth = 2.5; x.beginPath(); x.arc(X(p.x), Y(p.y), Math.max(4.5, 50 * k), 0, 7); x.fill(); x.stroke(); }
  }
  function mapSheet() {
    const ds = Town.districtsOf(town), here = World.trip ? -1 : Town.districtAt(town, World.pos().x);
    sheet(`🗺️ ${ds.length + 1} towns`, (body) => {
      body.append(row(button('🌍 See the planet', () => { closeSheet(); planetView(); }, 'choice'), inWildNow() ? button(`🎈 Fly home (${kmText(homeInfo().dist)})`, () => { closeSheet(); goHome(); }, 'choice alt') : null));
      // 1) the whole region at a glance, west to east: tap a town to see it and get an arrow there
      const strip = document.createElement('div'); strip.className = 'region';
      const friendsIn = (k) => [...Net.others.values()].filter(o => o.x != null && o.y < 5e6 && Town.districtAt(town, o.tx ?? o.x) === k).map(o => `<i style="background:${esc(o.color)}"></i>`).join('');
      const snailAt = life.snail && !life.snail.done ? Math.round(snailDays() / SNAIL_DAYS * life.snail.to) : -1;
      const cell = (k, icon, name, tint, seen) => `<button type="button" class="region-town ${k === here ? 'here' : ''} ${seen ? '' : 'new'}" data-k="${k}" style="--tint:${tint}">${k === snailAt ? '<span class="rt-snail">🐌</span>' : ''}
        <span class="rt-icon">${icon}</span><span class="rt-name">${esc(name)}</span>${k === here ? `<span class="rt-me" style="background:${esc(me.color)}"></span>` : ''}<span class="rt-friends">${friendsIn(k)}</span>${seen ? '' : '<span class="rt-badge">NEW</span>'}</button>`;
      const need = Town.growthNeed(ds.length + 1), prev = Town.growthNeed(ds.length), have = Math.floor(town.growth || 0), pct = Math.max(0, Math.min(100, Math.round((have - prev) / Math.max(1, need - prev) * 100)));
      strip.innerHTML = cell(0, '🏡', 'Small Town', '#b4dc7a', true) + ds.map(d => cell(d.k, d.icon, d.name, MAP_TINT[d.kind] || '#b4dc7a', !!life.kindsSeen[d.kind])).join('') +
        `<button type="button" class="region-town next" data-k="next"><span class="rt-icon">🚧</span><span class="rt-name">Next town</span><span class="rt-bar"><b style="width:${pct}%"></b></span></button>`;
      body.append(strip);
      // 2) the detailed map, at a readable scale that scrolls sideways, opened where you are
      const c = document.createElement('canvas'); c.className = 'map-canvas wide';
      const R = Town.worldRight(town), H = 460, ratio = (R - 3380) / 3060;
      c.height = H; c.width = Math.round(Math.min(16000, H * ratio)); c.style.width = (c.width / 2) + 'px'; c.style.height = (H / 2) + 'px';
      const wrap = document.createElement('div'); wrap.className = 'map-wrap scroll'; wrap.append(c); body.append(wrap);
      drawMap(c, true);
      const scrollTo = (gx, smooth) => wrap.scrollTo({ left: Math.max(0, (gx - 3380) / (R - 3380) * c.width / 2 - wrap.clientWidth / 2), behavior: smooth ? 'smooth' : 'auto' });
      requestAnimationFrame(() => { scrollTo(World.pos().x); const on = strip.querySelector('.here'); if (on) strip.scrollLeft = on.offsetLeft - strip.clientWidth / 2 + on.offsetWidth / 2; });
      strip.addEventListener('click', (e) => {
        const b = e.target.closest('[data-k]'); if (!b) return; Sound.blip();
        if (b.dataset.k === 'next') { toast(`<span class="t-small">🚧 Next town: ${have}/${need}</span>${life.band === 1 ? '🏛️🪙 🚌 🔨 → 🏙️' : 'Taxes, bus and train fares, building and town projects make the region grow.'}`, { life: 5 }); scrollTo(R, true); return; }
        const k = +b.dataset.k, d = k ? Town.district(k) : null;
        strip.querySelectorAll('.pick').forEach(x => x.classList.remove('pick')); b.classList.add('pick');
        scrollTo(d ? d.x0 + 1000 : 4800, true);
        guide = d ? { x: d.gate.x + 200, y: d.gate.y - 60, h: 12, icon: d.icon } : { x: 4800, y: 1500, h: 12, icon: '🏡' };
        toast(`${d ? d.icon : '🏡'} ${esc(d ? d.name : 'Small Town')} ➤`, { life: 2 });
      });
      // 3) the places in Small Town, as small chips: tap one for an arrow
      const chips = document.createElement('div'); chips.className = 'place-chips';
      const chip = (icon, name, to) => { const b = button(`${icon}${life.band === 1 ? '' : `<small>${esc(name)}</small>`}`, () => { guide = { ...to, icon }; closeSheet(); }, 'place-chip'); b.title = name; chips.append(b); };
      Town.BUILDINGS.forEach(b => { const k = keeper(b.id); if (k) chip(b.icon, b.name, { x: k.x, y: k.y, h: 13 }); });
      chip('🌲', 'Forest', { x: 4130, y: 480, h: 12 }); chip('🌾', 'Town Farm', { x: 5520, y: 470, h: 10 }); chip('🏊', 'Pool', placeFor('pool'));
      body.insertAdjacentHTML('beforeend', '<h4 class="sub-h">🏡 Small Town</h4>'); body.append(chips);
    });
  }
  $('minimap').addEventListener('click', () => { Sound.blip(); mapSheet(); });
  $('coinPill').addEventListener('click', () => { Sound.blip(); moneySheet(); });
  $('mapBtn').addEventListener('click', () => { Sound.blip(); mapSheet(); });
  $('lifeBtn').addEventListener('click', () => { Sound.blip(); lifeSheet(); });
  $('goal').addEventListener('click', () => { Sound.blip(); if (!life.dream && (life.starter || 0) >= Life.STARTER.length) dreamPicker(true); else if (!life.dream) starSheet(); else { guide = null; lifeSheet(); } });
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
  $('boardBtn').addEventListener('click', () => { $('menuPop').hidden = true; boardSheet(); });
  $('cloudBtn').addEventListener('click', () => { $('menuPop').hidden = true; accountSheet(); });
  $('loadBtn').addEventListener('click', () => { Sound.blip(); accountSheet(); });
  function helpSheet() {
    sheet('❓', (body) => {
      body.insertAdjacentHTML('beforeend', `<div class="help-grid">
        <div>💼 → 🪙</div><div>🏫 → 🎓 → 💼⬆️</div><div>🏦 🐷 📈</div><div>🏡 🌱 → 🌾 → 🧺</div>
        <div>🗳️ → 🏛️ → ⛲🏥📚</div><div>🏙️ grows → 🚉💻🎬✈️🚀</div><div>🚌 🚆 🚲 🚗 🛩️</div><div>🏞️ 🎣 📷 🏕️ → 📸 ⭐</div>
        <div>🏭 👥 📣 → 📈</div><div>✨ → ➤ follow the arrow</div><div>🌅 🏊 · 🌇 💧 · 🛏️ 💤 → ⭐🪙</div><div>🎯 ×3 → 🌟</div></div>
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
    sheetKind = 'room';
  }
  async function enterRoom(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 3 || code.length > 8) { const m = $('roomMsg'); if (m) m.textContent = '3–8 letters or numbers'; return false; }
    const m = $('roomMsg'); if (m) m.textContent = '⏳';
    Net.onStatus((s) => { const el = $('roomMsg'); if (el) el.textContent = `⏳ ${s}s`; });
    try { if (World.trip) endTrip(true); await Net.enter(code, me.name, me.color, me.uid); S = S || {}; S.lastRoom = code; return true; }
    catch (e) { const el = $('roomMsg'); if (el) { el.textContent = e.code === 'offline' ? '📡 ✕ (online version only)' : '📡 ✕ · 🔁'; el.classList.add('err'); } return false; }
  }
  function friendsSheet() {
    sheet(`👥 ${Net.code}`, (body) => {
      const link = `${location.origin}${location.pathname}?room=${Net.code}`;
      body.insertAdjacentHTML('beforeend', `<div class="code-box"><div class="code">${esc(Net.code)}</div></div><p class="link-line">${esc(link)}</p>`);
      const list = document.createElement('div'); list.className = 'players';
      const rowFor = (name, color, sub, id) => `<button type="button" class="player-row ${id === 'me' ? 'me' : ''}" data-card="${id}"><span class="dot" style="background:${color}"></span><span class="who">${esc(name)}</span><span class="stats"><span class="stat">${esc(sub || '')}</span></span><span class="go">🪪</span></button>`;
      list.innerHTML = rowFor(me.name, me.color, Life.title(life), 'me') + [...Net.others.values()].map(o => rowFor(o.name, o.color, o.ti, o.id)).join('');
      list.addEventListener('click', (e) => { const b = e.target.closest('[data-card]'); if (!b) return; Sound.blip(); const id = b.dataset.card; cardSheet(id === 'me' ? 'me' : Net.others.get(+id)); });
      body.append(list);
      if (Net.others.size) body.append(button('🏁 Crunch Race (2 min)', () => { Net.startRound(); closeSheet(); }, race ? 'choice' : 'big-btn small', !!race));
      body.append(row(button('📋 Copy', () => { navigator.clipboard && navigator.clipboard.writeText(link).then(() => toast('📋 ✓')).catch(() => {}); }, 'choice'),
        button('🚪 Leave', () => { Net.leave(); Talk.leave(); goSolo(); closeSheet(); toast('🏡'); }, 'choice alt')));
    });
  }
  /* ---------------- player cards: who someone is in the game, with no words anyone typed ---------------- */
  function myCard() {
    const homes = myPlots().map(p => p.build);
    const best = Object.entries(life.memories).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);
    return { xp: life.xp, mem: Life.memCount(life), perfect: life.perfectDays || 0, days: life.stats.sleeps || 0,
      home: homes.includes('villa') ? 2 : homes.includes('house') ? 1 : 0, dream: life.dream || '', hat: life.hat || '',
      kinds: Object.keys(life.kindsSeen || {}), best };
  }
  const cardOf = (o) => o === 'me' ? { name: me.name, color: me.color, card: myCard() } : o;
  function cardSheet(who) {
    const o = cardOf(who), isMe = who === 'me';
    if (!isMe && !Net.others.has(o.id)) return toast('👋 ✕');
    const c = o.card || {}, d = Life.DREAMS[c.dream], lv = Life.starLevel(c.xp || 0);
    sheet(isMe ? '🪪' : '🪪 👋', (body) => {
      const top = document.createElement('div'); top.className = 'pcard';
      const cv = document.createElement('canvas'); cv.width = 132; cv.height = 132; cv.className = 'pcard-face';
      const x = cv.getContext('2d');
      x.save(); x.translate(66, 88); x.scale(1.45, 1.45);
      rr(x, -15, 4, 30, 26, 10); fillStroke(x, o.color, 3);
      drawHead(x, 0, -20, 'happy', 0, { color: o.color === '#e4572e' ? '#f4b942' : '#e4572e' });
      x.restore();
      const face = document.createElement('div'); face.className = 'pcard-pic'; face.style.background = o.color + '33';
      face.append(cv);
      if (c.hat && HAT_ICON[c.hat]) face.insertAdjacentHTML('beforeend', `<span class="pcard-hat">${HAT_ICON[c.hat]}</span>`);
      top.append(face);
      top.insertAdjacentHTML('beforeend', `<div class="pcard-who"><b>${esc(o.name || 'Squareface')}</b>
        <span>${d ? `${d.icon} ${esc(d.title)}` : '🌱'} · ⭐ Lv ${lv}</span></div>`);
      body.append(top);
      if (!o.card) { body.append(card('<p class="small">⏳ 🪪</p>')); return; }
      const stat = (icon, n, what) => `<div class="pcard-stat" title="${what}"><span>${icon}</span><b>${n}</b><small>${what}</small></div>`;
      body.insertAdjacentHTML('beforeend', `<div class="pcard-stats">
        ${stat('⭐', c.xp || 0, 'stars')}${stat('📸', `${c.mem || 0}`, 'memories')}${stat('🌟', c.perfect || 0, 'perfect days')}
        ${stat('🌙', c.days || 0, 'nights')}${stat(['⛺', '🏠', '🏰'][c.home] || '⛺', ['—', '✓', '✓'][c.home] || '—', ['no home yet', 'house', 'villa'][c.home] || '')}</div>`);
      const kinds = (c.kinds || []).map(k => Town.KINDS[k]).filter(Boolean);
      if (kinds.length) body.insertAdjacentHTML('beforeend', `<h4 class="sub-h">🗺️ ${kinds.length}/${Object.keys(Town.KINDS).length}</h4><div class="pcard-row">${kinds.map(k => `<span title="${esc(k.name || '')}">${k.icon}</span>`).join('')}</div>`);
      const mem = (c.best || []).map(id => Life.MEMORIES[id]).filter(Boolean);
      if (mem.length) body.insertAdjacentHTML('beforeend', `<h4 class="sub-h">📸</h4><div class="pcard-row">${mem.map(([icon, name]) => `<span title="${esc(name)}">${icon}</span>`).join('')}</div>`);
      if (!isMe) body.append(button('👋', () => { Net.emote('👋'); World.say('me', '👋', 3); Sound.pop(); closeSheet(); findNoodle('feather'); }, 'big-btn small'));
    });
  }
  /* ---------------- the leaderboard: everyone has a record, and many ways to be on top ---------------- */
  // Every board counts something that only goes up. A secret key on this device keeps the record yours.
  if (!me.key) me.key = newUid() + newUid();
  const BOARDS = [['xp', '⭐', 'Stars'], ['week', '📅', 'This week'], ['earned', '💼', 'Coins earned'], ['mem', '📸', 'Memories'], ['noodles', '🍜', 'Noodles'], ['perfect', '🌟', 'Perfect Days'], ['kinds', '🗺️', 'Towns'], ['far', '🧭', 'Farthest'], ['disc', '🗿', 'Discoveries'], ['nights', '🌙', 'Nights']];
  const onServer = /^https?:$/.test(location.protocol);
  let boardSent = '';
  function myRecord() {
    return { id: me.uid, key: me.key, name: me.name || 'Squareface', color: me.color, hat: life.hat || '', dream: life.dream || '', band: life.band,
      xp: life.xp, earned: Math.round(life.stats.earned || 0), mem: Life.memCount(life), noodles: Object.keys(life.noodles || {}).length, perfect: life.perfectDays || 0, kinds: Object.keys(life.kindsSeen || {}).length, nights: life.stats.sleeps || 0, far: Math.round(life.stats.farthest || 0), disc: life.stats.discoveries || 0 };
  }
  function postRecord(force) {
    if (!onServer || !life || !me.name) return Promise.resolve();
    const r = myRecord(), k = JSON.stringify(r);
    if (k === boardSent && !force) return Promise.resolve();
    return fetch('api/sw/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: k, keepalive: true })
      .then(res => { if (res.ok) boardSent = k; }).catch(() => {});
  }
  setInterval(() => { if (playing) postRecord(); }, 30000);
  addEventListener('pagehide', () => postRecord());
  function boardSheet(by = 'xp', band = 0) {
    sheet('🏆', (body) => {
      const tabs = document.createElement('div'); tabs.className = 'tabs board-tabs';
      BOARDS.forEach(([id, icon, name]) => tabs.append(button(`${icon}<small>${name}</small>`, () => boardSheet(id, band), id === by ? 'tab on' : 'tab')));
      body.append(tabs);
      const who = document.createElement('div'); who.className = 'tabs board-who';
      who.append(button('🌍 Everyone', () => boardSheet(by, 0), band ? 'tab' : 'tab on'), button(`👤 ${BAND_NAMES[life.band]}`, () => boardSheet(by, life.band), band ? 'tab on' : 'tab'));
      body.append(who);
      const list = document.createElement('div'); list.className = 'players board-list'; list.innerHTML = '<p class="small">⏳</p>';
      body.append(list);
      if (!onServer) { list.innerHTML = '<p class="small">The leaderboard lives on the online server.</p>'; return; }
      const icon = (BOARDS.find(b => b[0] === by) || BOARDS[0])[1];
      const rowOf = (e, mine) => `<div class="player-row ${mine ? 'me' : ''}"><span class="rank">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : '#' + e.rank}</span><span class="dot" style="background:${esc(e.color)}"></span><span class="who">${esc(e.name)} ${HAT_ICON[e.hat] || ''}</span><span class="stats"><span class="stat">${(Life.DREAMS[e.dream] || {}).icon || ''}</span><span class="stat big">${icon} ${by === 'far' ? kmText(e.v) : e.v}</span></span></div>`;
      postRecord(true).then(() => fetch(`api/sw/board?by=${by}&band=${band}&me=${me.uid}`)).then(r => r.ok ? r.json() : Promise.reject()).then(d => {
        if (!list.isConnected) return;   // another tab or screen took its place
        const inTop = d.me && d.list.some(e => e.rank === d.me.rank);
        list.innerHTML = d.list.length ? d.list.map(e => rowOf(e, d.me && e.rank === d.me.rank)).join('') + (d.me && !inTop ? `<div class="board-gap">⋯</div>${rowOf(d.me, true)}` : '') : '<p class="small">Nobody yet. Be the first! ⭐</p>';
        if (d.mine) {
          const mine = card(`<h3>🏅 My records</h3><div class="board-mine">${BOARDS.map(([id, ic, name]) => { const m = d.mine[id] || {}; return `<div class="pcard-stat"><span>${ic}</span><b>${id === 'far' ? kmText(m.v || 0) : m.v || 0}</b><small>${m.rank ? `#${m.rank} of ${m.of}` : name}</small></div>`; }).join('')}</div>`);
          body.append(mine);
        }
      }).catch(() => { if (list.isConnected) list.innerHTML = '<p class="small">📡 ✕ · Could not load the leaderboard. Try again soon.</p>'; });
    });
  }
  /* ---------------- online save: a name and a 4-digit PIN, the same game on any device ---------------- */
  // Uses the server's /api/save and /api/load. The PIN stays on this device; the server keeps only a salted hash.
  let cloudSent = '', cloudBusy = false;
  const progressOf = () => life ? life.xp * 100 + Math.round(life.stats.earned || 0) : 0;
  function api(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(d.error || 'Something went wrong. Try again.'); e.status = r.status; e.data = d; throw e; }
      return d;
    });
  }
  const saveBlob = () => { const m = { ...me }; delete m.account; delete m.pendingClassic; return { sw: 1, me: m, life, solo }; };
  // again: send even if nothing changed. overwrite: replace an online game that has more progress (the player chose this).
  function cloudSave({ again = false, overwrite = false } = {}) {
    const a = me.account; if (!a || !onServer || !life || cloudBusy) return Promise.resolve();
    if (a.conflict && !overwrite) return Promise.resolve();   // wait for the player to choose which game to keep
    const blob = saveBlob(), key = JSON.stringify(blob); if (key === cloudSent && !again && !overwrite) return Promise.resolve();
    cloudBusy = true;
    return api('api/save', { name: a.name, pin: a.pin, save: blob, progress: progressOf(), force: !!overwrite })
      .then(() => { cloudSent = key; a.at = Date.now(); a.conflict = null; a.bad = null; save(); })
      .catch(e => { if (e.status === 409) a.conflict = e.data || {}; else if (e.status === 403) a.bad = e.message; })
      .finally(() => { cloudBusy = false; });
  }
  setInterval(() => { if (playing) cloudSave(); }, 120000);
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) cloudSave(); });
  function pinInput(id) { return `<input id="${id}" class="pin-in" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="PIN ••••" aria-label="4-number PIN">`; }
  function accountSheet(msg = '') {
    const a = me.account;
    sheet('☁️', (body) => {
      if (msg) body.insertAdjacentHTML('beforeend', `<p class="sheet-sub ${/^⚠️/.test(msg) ? 'bad' : ''}">${esc(msg)}</p>`);
      if (!onServer) { body.insertAdjacentHTML('beforeend', '<p class="sheet-sub">Online saves live on the online server.</p>'); return; }
      if (a && life) {
        const c = card(`<h3>☁️ ${esc(a.name)}</h3><p class="small">${a.at ? `Saved online ${new Date(a.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. It saves by itself every 2 minutes.` : 'Not saved yet.'}</p>`);
        if (a.bad) c.insertAdjacentHTML('beforeend', `<p class="small bad">⚠️ ${esc(a.bad)}</p>`);
        c.append(row(button('☁️ Save now', () => cloudSave({ again: true }).then(() => accountSheet(a.conflict || a.bad ? '' : '✓ Saved')), 'choice', !!a.conflict),
          button('Use another name', () => { me.account = null; save(); accountSheet(); }, 'choice alt')));
        body.append(c);
        if (a.conflict) {
          const k = card('<h3>⚠️ Your online game has more progress</h3><p class="small">It was played on another device. Which one do you want to keep?</p>');
          k.append(row(button('☁️ Load the online game', () => loadCloud(a.name, a.pin, true), 'choice'),
            button('📱 Keep this one', (b) => { if (!sure(b, 'Tap again: the online game is replaced')) return; cloudSave({ overwrite: true }).then(() => accountSheet(a.conflict ? '' : '✓ Saved')); }, 'choice alt')));
          body.append(k);
        }
        return;
      }
      if (life) {
        const c = card(`<h3>☁️ Save my game online</h3><p class="small">Pick a name and a 4-number PIN you will remember. Use them to play the same game on another phone or computer. There is no way to get a lost PIN back.</p>
          <div class="acct-row"><input id="acctName" maxlength="14" autocomplete="off" placeholder="Name" value="${esc(me.name || '')}">${pinInput('acctPin')}</div>`);
        c.append(button('☁️ Save', () => {
          const name = $('acctName').value.trim(), pin = $('acctPin').value.trim();
          if (!/^\d{4}$/.test(pin)) return accountSheet('⚠️ The PIN is 4 numbers, like 2468.');
          api('api/save', { name, pin, save: saveBlob(), progress: progressOf() }).then(() => { me.account = { name, pin, at: Date.now() }; cloudSent = JSON.stringify(saveBlob()); save(); Sound.chord(5, 'bell'); accountSheet('✓ Saved online'); })
            .catch(e => { if (e.status === 409) { me.account = { name, pin, conflict: e.data || {} }; save(); accountSheet(); } else accountSheet('⚠️ ' + e.message); });
        }, 'big-btn small'));
        body.append(c);
      }
      const l = card(`<h3>📥 Load a saved game</h3><p class="small">Small World and Noodle Universe saves both work.</p><div class="acct-row"><input id="loadName" maxlength="14" autocomplete="off" placeholder="Name">${pinInput('loadPin')}</div>`);
      l.append(button('📥 Load', () => loadCloud($('loadName').value.trim(), $('loadPin').value.trim()), 'choice'));
      body.append(l);
    });
  }
  function loadCloud(name, pin, replace) {
    if (!/^\d{4}$/.test(pin)) return accountSheet('⚠️ The PIN is 4 numbers, like 2468.');
    api('api/load', { name, pin }).then(d => {
      const blob = d.save || {};
      if (blob.sw === 1 && blob.life) {
        const apply = () => {
          const m = { ...(blob.me || {}), account: { name, pin, at: Date.now() } };
          leaving = true; playing = false;
          try { localStorage.setItem(KEY, JSON.stringify({ me: m, life: blob.life, solo: blob.solo, pos: null, lastRoom: S && S.lastRoom })); } catch (e) {}
          location.reload();
        };
        if (!life || replace) return apply();
        // this device already has a game: say what will happen, and ask for a second tap
        return sheet('📥', (body) => {
          const L = Life.repair(blob.life);
          body.append(card(`<h3>📥 ${esc(d.name || name)}</h3><p class="small">⭐ ${L.xp} · Lv ${Life.starLevel(L.xp)} · 🪙 ${L.coins}. Loading it replaces the game on this phone or computer (⭐ ${life.xp}).</p>`));
          body.append(row(button('📥 Load it', (b) => { if (sure(b, 'Tap again to load')) apply(); }, 'choice'), button('✕', () => accountSheet(), 'choice alt')));
        });
      }
      // a Noodle Universe save: its noodles, hats, coins and stars come along into Small World
      if (life) { const had = !!life.classic; importClassic(blob); accountSheet(had ? '✓ Your Noodle Universe noodles and hats are here. Its coins and stars already came over once.' : ''); }
      else { me.pendingClassic = blob; if (!me.name) { me.name = d.name || name; const n = $('nameIn'); if (n) n.value = me.name; } save(); accountSheet('✓ Found your Noodle Universe game. Pick your age and start: your noodles, hats and coins come along.'); }
    }).catch(e => accountSheet('⚠️ ' + e.message));
  }
  // Noodle Universe is part of Small World now. Its noodles and hats always merge in (they cannot be farmed);
  // its coins and stars come over only once per life, whichever save (this device's or an online one) comes first.
  function importClassic(G) {
    if (!life || !G || typeof G !== 'object') return false;
    const rewards = !life.classic; life.classic = life.classic || Date.now();
    let noodles = 0;
    (Array.isArray(G.found) ? G.found : []).forEach(id => { if (NOODLE_BY_ID[id] && !life.noodles[id]) { life.noodles[id] = Date.now(); noodles++; } });
    Object.keys(G.shiny || {}).forEach(id => { if (life.noodles[id]) life.shiny[id] = Date.now(); });
    const hats = Object.keys(G.hats || {}).filter(h => HAT_ICON[h]); hats.forEach(h => { life.hats[h] = 1; });
    if (G.hat && HAT_ICON[G.hat]) { life.hat = G.hat; World.setMe({ color: me.color, hat: life.hat }); }
    const coins = rewards ? Math.min(300, Math.max(0, Math.round(+G.coins || 0))) : 0;
    if (coins) Life.earn(life, coins, null, '🍜', 'Coins from Noodle Universe', 'Noodle Universe is part of Small World now, so your coins came with you (up to 300).');
    const stars = rewards ? Math.min(60, (Array.isArray(G.found) ? G.found.length : 0) * 2 + Object.keys(G.lessons || {}).length + Object.keys(G.challenges || {}).length) : 0;
    if (stars) Life.addStars(life, stars);
    if (noodles || hats.length || coins || stars) later(() => { toast(`<span class="t-small">🍜 Welcome from Noodle Universe!</span>${noodles ? `🍜×${noodles} ` : ''}${hats.map(h => HAT_ICON[h]).join('')} ${coins ? `+${coins}🪙` : ''} ${stars ? `⭐+${stars}` : ''}`, { big: true, life: 6 }); World.celebrate(20); Sound.chord(7, 'bell'); });
    touch(); hud(); save();
    return true;
  }
  function classicCheck() {
    if (!life) return;
    if (me.pendingClassic) { const G = me.pendingClassic; delete me.pendingClassic; importClassic(G); return; }
    if (life.classic) return;
    let G = null; try { G = JSON.parse(localStorage.getItem('noodle-universe-save-v1')); } catch (e) {}
    if (G && G.v === 1 && ((G.found && G.found.length) || G.coins)) importClassic(G);
  }

  Net.on('emote', (m) => { if (m.id !== Net.me && Net.others.has(m.id)) World.say(m.id, m.e, 3); });

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
    if (sheetKind === 'room') closeSheet();
    onTown(m.town);
    checkLandBook();
    toast(`<span class="t-small">👥 ${esc(m.code)}</span>${m.created ? '🆕 🏙️' : '👋 🏙️'}`, { big: true, life: 4 });
    hud(); Talk.refresh();
    if (!life.day || life.day !== Life.dayOf(now())) dayTick();
    if (m.round && m.round.no && m.round.secs > 3) raceStart({ ...m.round, joined: true });
  });
  Net.on('town', (m) => { if (online()) onTown(m.town); });
  // the town answered after we stopped waiting: still give the kid what they did
  // pay a cost that the town already applied; if the pocket is short, the rest is owed with no interest
  function charge(n, icon, why, how) {
    if (Life.spend(life, n, icon, why, how)) return;
    const have = life.coins, rest = n - have;
    if (have) Life.spend(life, have, icon, why, how);
    life.iou = (life.iou || 0) + rest;
    Life.note(life, 'loan', rest, '🧾', `Still to pay: ${why}`, 'Your pocket was short, so the rest is paid back from your pocket tomorrow morning (no interest).');
  }
  Net.on('late', ({ a, res, key }) => {
    const slow = ' (the town was slow)';
    if (a.type === 'harvest' && res.items) { Object.entries(res.items).forEach(([g, n]) => Life.addItem(life, g, n)); life.stats.harvested++; toast(`✓ ${Object.entries(res.items).map(([g, n]) => `+${n} ${G[g].icon}`).join(' ')}${slow}`); }
    if (a.type === 'chop') { Life.addItem(life, 'log', 2); life.stats.chopped++; life.owesSapling = 1; toast('✓ +2 🪵' + slow); }
    if (a.type === 'sell' && res.coins) afterSell(a.g, a.n, res, null);   // the items were held when the sale was sent
    if (a.type === 'buyPlot') { charge(res.cost, '🏡', `Bought land ${a.id}`, 'The town was slow to answer, but the land is yours.'); landBook(a.id, { cost: res.cost }, key); }
    if (a.type === 'sellPlot') afterSellLand(a.id, res, key);
    if (a.type === 'build') { const b = Town.BUILD[a.kind]; if (b) { Life.takeItem(life, 'log', Math.min(b.logs, life.bag.log || 0)); charge(b.coins, b.icon, `Built a ${b.name.toLowerCase()}`, `${b.logs} logs + ${b.coins} coins for the builders.`); landBook(a.id, { build: a.kind, buildCoins: b.coins }, key); life.stats.built++; if (a.kind === 'house' || a.kind === 'villa') life.home = key; toast(`✓ ${b.icon}${slow}`); } }
    if (a.type === 'plant' && G[a.k]) charge(G[a.k].seed, G[a.k].icon, `${G[a.k].name} seeds`, 'The town was slow to answer, but your seeds are planted.');
    if (a.type === 'farmwork') farmDone(a.i);
    if (a.type === 'replant') { const tr = Town.FOREST.find(x => x.id === a.tree); if (tr) replantDone(tr); }
    if (a.type === 'water') daily('water');
    if (a.type === 'gather' && res.item) { const w = Town.workById(a.spot); if (w) gatherDone(w, res); }
    touch(); hud();
  });
  // the connection dropped while waiting: things held for a sale go back in the bag
  Net.on('lost', ({ a }) => { if (a.type === 'sell' && G[a.g]) { Life.addItem(life, a.g, a.n); touch(); hud(); } });
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
    bar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; World.mood(b.dataset.face, 3); life.faces[b.dataset.face] = 1; if (FACES.every(f => life.faces[f])) findNoodle('smile'); Sound.note(FACES.indexOf(b.dataset.face) * 2 + 5, 'kalimba'); bar.hidden = true; $('faceBtn').classList.remove('on'); });
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

  // crossing into another town: its name, what it is, and a memory the first time you see its kind
  let inTown = null;
  function townTick() {
    if (World.trip || !town) return;
    const k = Town.districtAt(town, World.pos().x);
    if (k === inTown) return;
    const first = inTown === null; inTown = k;
    spawnBricks();
    if (first) return;
    if (!k) { toast('<span class="t-small">🏡 Welcome back</span>Small Town', { big: true, life: 3 }); return; }
    const D = Town.district(k);
    toast(`<span class="t-small">${D.icon} ${esc(D.kindName)}</span>${esc(D.name)}${life.band === 1 ? '' : `<br><small>${esc(D.blurb)}</small>`}`, { big: true, life: 4 });
    if (!life.kindsSeen[D.kind]) { life.kindsSeen[D.kind] = 1; memory('k_' + D.kind); if (Object.keys(Town.KINDS).every(k => life.kindsSeen[k])) findNoodle('peak'); checkDream(); touch(); }
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
    townTick();
    const st = World.state();
    if (!World.trip) pos = World.pos();
    if (online() && !World.trip) Net.state({ x: Math.round(pos.x), y: Math.round(pos.y), mood: sleeping ? 'sleepy' : st.mood, moving: st.moving, face: st.face, z: st.hop, title: Life.title(life), swimming: World.swimming, hat: life.hat || '' });
    if (sleeping) { const f = Life.dayFrac(t), done = Math.max(0, Math.min(1, (f - sleepFrom) / Math.max(0.01, 1 - sleepFrom))); $('nightFill').style.width = Math.round(done * 100) + '%'; }
    if ((hudT -= dt) <= 0) {
      hudT = 0.5; planetTick(); hud(); markers(); World.setDay(window.__sw.dayOverride ?? Life.dayFrac(t)); wonderTick(); buddies(); boostTick();
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
    if (life) ages.closest('.mp-row').hidden = true;   // only a grown-up changes the age of a life (⋯ → 👤)
    else for (let a = 6; a <= 16; a++) {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'tab' + (me.age === a ? ' on' : ''); el.textContent = String(a);
      el.addEventListener('click', () => { me.age = a; me.band = bandOfAge(a); ages.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === el)); });
      ages.appendChild(el);
    }
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
      if (fresh && !me.age) { $('titleMsg').textContent = '👤 Age?'; $('ages').classList.remove('nudge'); void $('ages').offsetWidth; $('ages').classList.add('nudge'); return; }
      if (fresh) { life = Life.fresh(me.band); if (me.age) me.ageAt = Date.now(); } else me.band = life.band;
      if (!solo) solo = Town.newTown(Date.now());
      $('title').hidden = true; $('hud').hidden = false; $('minimap').hidden = false;
      World.setMe({ color: me.color, hat: life.hat });
      if (pos && pos.x && pos.y < 5e6) World.place(pos.x, pos.y);   // trips are far away (y > 5e6); anywhere on the planet is fine
      playing = true;
      goSolo();
      dayTick(); syncDaily(); birthdayCheck(); classicCheck();
      if (World.setWildPicked) World.setWildPicked(wildPickedToday().ids);
      save(); startMusic();
      if (fresh && life.band > 1) later(() => welcome());
      else if (!life.dream && (life.starter || 0) >= Life.STARTER.length && life.seen.pickedDream) later(() => { if (!life.dream) dreamPicker(true); });
      if (withFriends) later(() => roomSheet());
      const fromLink = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (fromLink.length >= 3 && !withFriends) later(() => { roomSheet(); $('roomIn').value = fromLink; });
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
      body.insertAdjacentHTML('beforeend', `<div class="welcome-row"><span>🌅</span><span>💼</span><span>🏦</span><span>🏡</span><span>🗳️</span><span>✈️</span></div>
        <p class="sheet-sub">👛 ${coin(life.coins)} · 🏢 Rent is free for ${life.rentFree} days, then ${coin(R().rent)} a day until you build a house. · ➤ follow the arrow</p>`);
      body.append(button('▶', closeSheet, 'big-btn small'));
    });
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
      onHop: () => { Sound.pop(); if (life) { fact('hop'); life.stats.hops = (life.stats.hops || 0) + 1; daily('hop'); } },
      onKick: (j) => { Sound.crunch(Math.min(1, j / 20), true); if (life) { fact('kick'); life.stats.kicks = (life.stats.kicks || 0) + 1; daily('kick'); } },
      onPickup: (id, kind) => { if (life) onPickup(id, kind); },
      onThud: () => Sound.drum(0),
      onSwim: () => { Sound.splash(); if (life) { fact('swim'); poolSwim(); } },
      onGoal: () => {
        Sound.chord(6, 'bell'); World.mood('laugh', 2); memory('goal');
        if (Life.kidBonus(life, 'goal', 3, '⚽', 'Goal prize', 'Up to 5 goal prizes a day.')) toast('⚽ GOAL!', { big: true }); else toast('⚽ GOAL! (the 5 prizes for today are used up)', { big: true });
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
