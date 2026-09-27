// Small World: your life in Small Town. Money, jobs, school, the bank, bills and your dream.
// Pure rules (no drawing), so they can be tested in Node. The town itself lives in town.js.
(function (root) {
  const Town = root.Town || (typeof require === 'function' ? require('./town.js') : null);
  const MIN = 60 * 1000;
  const DAY = 6 * MIN;                 // one Small Town day = 6 real minutes, the same for everyone in a room
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------- time ---------------- */
  const dayOf = (now) => Math.floor(now / DAY);
  const dayFrac = (now) => (now % DAY) / DAY;
  // 6:00 in the morning to 11:00 at night, then the next day starts
  const hourOf = (now) => 6 + dayFrac(now) * 17;
  function clock(now) {
    const h = hourOf(now), hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
    return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
  }

  /* ---------------- the rulebook: money rules that grow up with you ---------------- */
  // Band 1 (6-8): coins only go down when you tap Buy. No tax, rent, bills or loans; every task pays at once.
  // Band 2 (9-12): half tax, small rent, and savings pay the bills before a no-interest IOU.
  // Band 3 (13-16): the real thing: tax, rent, land tax, fuel, loans with interest.
  // Every money, quiz and ritual rule reads this table, so the numbers live in one place.
  const RULES = {
    1: { start: 40, taxShare: 0, rent: 0, rentFree: 0, landTax: 0, upkeepShare: 0, loans: false, loanRate: 0, loanMax: 0, shortfall: 'none',
      saveRate: 5, saveMin: 5, saveCap: 10, payEach: true, shifts: 6, rested: 0, fairPrice: true, fishMiss: 0, coLossZero: true, maxPlots: 2, plantThanks: 2,
      quiz: { n: 2, opts: 2, pass: 1, retry: true }, mathLv: [1, 2],
      win: { swim: [6, 10], sip: [16, 20], sleep: [19, 23] }, rit: { swim: 3, sip: 2, sleep: 3 }, poolCoins: 5, dreamCoins: 5,
      daily: 5, perfect: 15, streakResets: false, caps: { trail: 15, dream: 5, fair: 30, volunteer: 10, rain: 12, arcade: 15, goal: 15 }, pickCap: 10, lvGift: [5, 50], endless: 60 },
    2: { start: 30, taxShare: 0.5, rent: 3, rentFree: 3, landTax: { farm: 1, lot: 2 }, upkeepShare: 0.5, loans: 'manual', loanRate: 3, loanMax: 80, shortfall: 'iou',
      saveRate: 3, saveMin: 10, saveCap: 0, payEach: false, shifts: 4, rested: 0.1, fairPrice: false, fishMiss: 0.15, coLossZero: false, maxPlots: 0, plantThanks: 1,
      quiz: { n: 3, opts: 3, pass: 2, retry: false }, mathLv: [4, 5],
      win: { swim: [6, 9], sip: [17, 20], sleep: [20, 23] }, rit: { swim: 2, sip: 1, sleep: 2 }, poolCoins: 5, dreamCoins: 3,
      daily: 4, perfect: 12, streakResets: true, caps: { trail: 8, dream: 3, fair: 0, volunteer: 0, rain: 12, arcade: 15, goal: 15 }, pickCap: 6, lvGift: [3, 30], endless: 120 },
    3: { start: 20, taxShare: 1, rent: 5, rentFree: 3, landTax: 'full', upkeepShare: 1, loans: 'full', loanRate: 5, loanMax: 400, shortfall: 'loan',
      saveRate: 2, saveMin: 0, saveCap: 0, payEach: false, shifts: 3, rested: 0.1, fairPrice: false, fishMiss: 0.25, coLossZero: false, maxPlots: 0, plantThanks: 1,
      quiz: { n: 3, opts: 4, pass: 2, retry: false }, mathLv: [6, 7],
      win: { swim: [6, 8], sip: [17, 19], sleep: [21, 23] }, rit: { swim: 1, sip: 1, sleep: 1 }, poolCoins: 3, dreamCoins: 0,
      daily: 3, perfect: 10, streakResets: true, caps: { trail: 0, dream: 0, fair: 0, volunteer: 0, rain: 12, arcade: 15, goal: 15 }, pickCap: 4, lvGift: [2, 20], endless: 180 },
  };
  const rules = (l) => RULES[l && l.band] || RULES[2];
  // income tax: band 1 pays none, band 2 half, band 3 all (always rounded down)
  const taxOf = (life, gross, rate) => Math.floor(gross * (rate || 0) * rules(life).taxShare / 100);
  // what the town would have got: for younger kids "the Mayor pays your tax", so the town still grows as fast
  const grantOf = (life, gross, rate) => rules(life).taxShare < 1 ? Math.max(0, Math.round(gross * (rate || 0) / 100) - taxOf(life, gross, rate)) : 0;
  const rentOf = (life) => rules(life).rent;
  const landTaxOf = (life, kind) => { const t = rules(life).landTax; return t === 'full' ? (Town ? Town.TAX[kind] : 0) : t ? t[kind] || 0 : 0; };
  const upkeepOf = (life, v) => Math.floor((VEHICLES[v] ? VEHICLES[v].upkeep : 0) * rules(life).upkeepShare);
  // the tax rate you really pay, e.g. 7.5 for a kid at half of 15%
  const effRate = (life, rate) => Math.round((rate || 0) * rules(life).taxShare * 10) / 10;
  const seeded = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

  /* ---------------- school ---------------- */
  const SUBJECTS = {
    money: { name: 'Money', icon: '💰', cert: 'Money Smarts' },
    civics: { name: 'Civics', icon: '🏛️', cert: 'Good Citizen' },
    tools: { name: 'Building', icon: '🔨', cert: 'Builder Basics' },
    math: { name: 'Math', icon: '➗', cert: 'Math Whiz' },
    science: { name: 'Science', icon: '🔬', cert: 'Young Scientist' },
  };
  const CERT_AT = 2;                   // pass 2 classes in a subject to earn its certificate
  const hasCert = (life, s) => (life.school[s] || 0) >= CERT_AT;
  const certCount = (life) => Object.keys(SUBJECTS).filter(s => hasCert(life, s)).length;

  /* ---------------- jobs ---------------- */
  // place: where the work happens. tasks: how many to finish one shift.
  const JOBS = {
    farmhand: { name: 'Farmhand', icon: '🧑‍🌾', wage: 12, tasks: 3, place: 'farm', how: 'Pick 3 ripe crops on the Town Farm.' },
    lumberjack: { name: 'Lumberjack', icon: '🪓', wage: 15, tasks: 4, place: 'forest', how: 'Chop 2 trees, plant 2 saplings.' },
    mail: { name: 'Mail Carrier', icon: '✉️', wage: 14, tasks: 3, place: 'town', how: 'Take 3 letters to the doors.' },
    ranger: { name: 'Park Ranger', icon: '🥾', wage: 16, tasks: 3, place: 'nature', town: 1, how: 'Check 3 nature spots.' },
    builder: { name: 'Builder', icon: '👷', wage: 20, tasks: 3, place: 'lots', needs: ['tools'], how: 'Hammer 3 building frames.' },
    clerk: { name: 'Town Clerk', icon: '📋', wage: 20, tasks: 3, place: 'hall', needs: ['civics'], how: 'Help 3 citizens at the Town Hall.' },
    teller: { name: 'Bank Teller', icon: '🏦', wage: 22, tasks: 3, place: 'bank', needs: ['money'], how: 'Help 3 bank customers.' },
    marketer: { name: 'Marketer', icon: '📣', wage: 24, tasks: 3, place: 'tech', needs: ['money'], how: 'Make 3 ads at the Tech Hub.' },
    coder: { name: 'Coder', icon: '💻', wage: 26, tasks: 3, place: 'tech', needs: ['math'], how: 'Fix 3 bugs at the Tech Hub.' },
    tutor: { name: 'Tutor', icon: '🍎', wage: 26, tasks: 3, place: 'school', needs: 3, how: 'Help 3 students at the School.' },
  };
  const DESK_JOBS = { clerk: 'civics', teller: 'money', tutor: 'any', marketer: 'money', coder: 'math' };
  // places that only exist once the town has grown enough
  const LATE_PLACES = { tech: 'Tech Hub', biz: 'Business Center', studio: 'Media Studio', dealer: 'Wheels & Wings', airport: 'Airport', space: 'Space Center', harbor: 'Harbor', nature: 'Station District' };
  function canTake(life, id, town) {
    const j = JOBS[id]; if (!j) return { ok: false, why: 'No such job.' };
    if (town && LATE_PLACES[j.place] && !(j.place === 'nature' ? (town.districts || 0) >= 1 : Town.hasPlace(town, j.place))) return { ok: false, why: `🏙️ ${LATE_PLACES[j.place]}`, grow: true };
    if (typeof j.needs === 'number') {
      if (certCount(life) < j.needs) return { ok: false, why: `🎓 ×${j.needs}` };
    } else if (j.needs) {
      const miss = j.needs.filter(s => !hasCert(life, s));
      if (miss.length) return { ok: false, why: '🎓 ' + miss.map(s => SUBJECTS[s].icon).join(' ') };
    }
    return { ok: true };
  }
  const SHIFTS_PER_DAY = 3;
  // experience pays: +10% for every 3 shifts in the same job, up to +50%
  const wageOf = (life, id) => Math.round(JOBS[id].wage * (1 + 0.1 * Math.min(5, Math.floor((life.stats.shifts[id] || 0) / 3))));
  function startShift(life, id, targets, town) {
    const c = canTake(life, id, town); if (!c.ok) return c;
    const most = rules(life).shifts;
    if (life.shiftsToday >= most) return { ok: false, why: `You worked ${most} shifts today. Rest! A new day starts soon.` };
    life.job = id;
    // the tax rate is locked when you start, so the pay you were shown is the pay you get
    life.shift = { job: id, need: JOBS[id].tasks, done: 0, targets: targets || [], rate: town ? town.taxRate : 10 };
    return { ok: true };
  }
  // one task finished. Band 1 is paid for every task right away; older kids get the paycheck when the shift is done.
  function workDone(life, taxRate, target) {
    const s = life.shift; if (!s) return null;
    if (target !== undefined) s.targets = s.targets.filter(t => t !== target);
    s.done++;
    const J = JOBS[s.job], R = rules(life), rate = shiftRate(s, taxRate);
    if (R.payEach) {
      const wage = wageOf(life, s.job), step = Math.floor(wage / s.need), pay = s.done < s.need ? step : wage - step * (s.need - 1);
      life.coins += pay; life.stats.wages += pay; life.stats.earned += pay; life.today.earned += pay;
      note(life, 'pocket', pay, J.icon, `${J.name} ${s.done}/${s.need}`, 'Paid right away. All yours!');
      if (s.done < s.need) return { done: false, left: s.need - s.done, step: pay };
      return finishShift(life, s, { gross: wage, tax: 0, net: wage, rate, grant: Math.round(wage * rate / 100), step: pay, perTask: true });
    }
    if (s.done < s.need) return { done: false, left: s.need - s.done };
    const gross = wageOf(life, s.job), tax = taxOf(life, gross, rate);
    // slept in your bed last night? You work better: +10% (at least 1)
    const rested = R.rested && life.rested === life.day ? Math.max(1, Math.round(gross * R.rested)) : 0;
    const net = gross - tax + rested;
    life.coins += net;
    note(life, 'pocket', gross, J.icon, `Wage: ${J.name} shift`, 'You finished all the tasks. This is your pay.');
    if (rested) note(life, 'pocket', rested, '😴', 'Well rested +10%', 'You slept in your bed last night, so you worked better today.');
    const eff = effRate(life, rate);
    note(life, 'pocket', -tax, '🏛️', `Income tax ${eff}%`, `${R.taxShare < 1 ? 'Kids pay half the tax. ' : ''}${eff}% of ${gross} is ${Math.round(gross * eff) / 100}, rounded down to ${tax}. It goes to the town and pays for the school, roads, parks and the bus.`, { link: 'wage' });
    life.stats.wages += net; life.stats.earned += net; life.today.earned += net; life.today.tax += tax;
    return finishShift(life, s, { gross, tax, net, rate: eff, townRate: rate, grant: grantOf(life, gross, rate), rested });
  }
  function finishShift(life, s, pay) {
    life.shift = null; life.shiftsToday++;
    life.stats.shifts[s.job] = (life.stats.shifts[s.job] || 0) + 1;
    life.stats.taxPaid += pay.tax; life.rep += 1;
    const raise = (life.stats.shifts[s.job] % 3 === 0) && life.stats.shifts[s.job] <= 15;
    return { done: true, job: s.job, ...pay, raise, next: wageOf(life, s.job) };
  }
  // the lower of the rate when you started and the rate now: a tax change never makes your shift pay less than promised
  const shiftRate = (s, now) => { const r = [s.rate, now].filter(x => typeof x === 'number'); return r.length ? Math.min(...r) : 0; };
  const taxOn = (gross, rate) => Math.floor(gross * (rate || 0) / 100);
  // stopping early: band 1 already has its pay; older kids are paid for the tasks they finished
  function quitShift(life, taxRate) {
    const s = life.shift; if (!s) return null;
    life.shift = null;
    if (s.done) life.shiftsToday++;
    if (rules(life).payEach || !s.done) return { done: s.done, need: s.need, net: 0, tax: 0, grant: 0, perTask: rules(life).payEach };
    const rate = shiftRate(s, taxRate), gross = Math.floor(wageOf(life, s.job) * s.done / s.need), tax = taxOf(life, gross, rate), net = gross - tax;
    life.coins += net;
    note(life, 'pocket', gross, JOBS[s.job].icon, `Paid for ${s.done} of ${s.need} tasks: ${JOBS[s.job].name}`, `You stopped early, so you are paid for the tasks you finished (${s.done} of ${s.need}).`);
    note(life, 'pocket', -tax, '🏛️', `Income tax ${effRate(life, rate)}%`, `${effRate(life, rate)}% of ${gross} is ${Math.round(gross * effRate(life, rate)) / 100}, rounded down to ${tax}.`);
    life.stats.wages += net; life.stats.earned += net; life.stats.taxPaid += tax; life.today.earned += net; life.today.tax += tax;
    return { done: s.done, need: s.need, job: s.job, gross, tax, net, rate, grant: grantOf(life, gross, rate) };
  }

  /* ---------------- the bank ---------------- */
  const SAVE_RATE = 2, LOAN_RATE = 5;          // percent per day
  // interest keeps its fractions: 2% of 9 is 0.18 a day, which adds up to a whole coin in a few days
  const grows = (amount, rate, frac) => { const x = amount * rate / 100 + (frac || 0); return { n: Math.floor(x + 1e-9), frac: x - Math.floor(x + 1e-9) }; };
  // savings interest by the rules: band 1 grows 5% (at least 1 once 5 are saved, at most 10), band 2 3%, band 3 2%
  function saveGrowth(life) {
    const R = rules(life); if (!(life.bank > 0)) return { n: 0, frac: life.bankFrac || 0 };
    let g = grows(life.bank, R.saveRate, life.bankFrac);
    if (R.saveMin && life.bank >= R.saveMin && g.n < 1) g = { n: 1, frac: 0 };
    if (R.saveCap && g.n > R.saveCap) g = { n: R.saveCap, frac: 0 };
    return g;
  }
  const interestTomorrow = (life) => ({ save: saveGrowth(life).n, loan: life.loan > 0 ? grows(life.loan, rules(life).loanRate, life.loanFrac).n : 0 });
  const loanLimit = (life, owned) => Math.min(rules(life).loanMax, 60 + 30 * certCount(life) + 40 * (owned || 0));
  function bank(life, what, n, owned) {
    n = Math.floor(n);
    if (!(n > 0)) return { ok: false, why: 'Pick an amount.' };
    if (what === 'deposit') { if (n > life.coins) return { ok: false, why: 'You do not have that many coins.' }; life.coins -= n; life.bank += n; life.stats.deposits += n;
      note(life, 'pocket', -n, '🐷', 'Moved to your savings', `Still yours! It is safe in the bank and grows ${rules(life).saveRate}% every morning.`, { move: true }); note(life, 'bank', n, '🐷', 'Saved from your pocket', '', { move: true }); return { ok: true }; }
    if (what === 'withdraw') { if (n > life.bank) return { ok: false, why: 'Your savings are smaller than that.' }; life.bank -= n; life.coins += n;
      note(life, 'bank', -n, '👛', 'Taken out to your pocket', '', { move: true }); note(life, 'pocket', n, '🐷', 'Taken out of your savings', '', { move: true }); return { ok: true }; }
    if (what === 'borrow') { if (!rules(life).loans) return { ok: false, why: 'The bank lends to kids who are 9 or older.' };
      if (life.loan + n > loanLimit(life, owned)) return { ok: false, why: `The bank lends you up to ${loanLimit(life, owned)} coins in total.` }; life.loan += n; life.coins += n; life.stats.borrowed += n;
      note(life, 'pocket', n, '💸', 'Loan from the bank', `You must pay it back. It grows ${rules(life).loanRate}% every morning until you do.`, { move: true }); note(life, 'loan', n, '💸', 'You borrowed'); return { ok: true }; }
    if (what === 'iou') { n = Math.min(n, life.iou || 0); if (!n) return { ok: false, why: 'You do not owe anything!' }; if (n > life.coins) return { ok: false, why: 'You do not have that many coins.' }; life.iou -= n; life.coins -= n;
      note(life, 'pocket', -n, '🧾', 'Paid back what you owed', 'It had no interest, and now it is smaller.', { move: true }); note(life, 'loan', -n, '🧾', 'Paid back (no interest)'); return { ok: true }; }
    if (what === 'repay') { n = Math.min(n, life.loan); if (!n) return { ok: false, why: 'You do not owe anything!' }; if (n > life.coins) return { ok: false, why: 'You do not have that many coins.' }; life.loan -= n; life.coins -= n;
      note(life, 'pocket', -n, '💸', 'Paid back your loan', 'Less to owe means less interest tomorrow.', { move: true }); note(life, 'loan', -n, '💸', 'Paid back'); return { ok: true }; }
    return { ok: false, why: '?' };
  }

  /* ---------------- the money diary ---------------- */
  // Every coin that comes or goes is written down with a reason in plain words, so a kid can always see
  // WHY their coins changed. acct: 'pocket' (coins), 'bank' (savings) or 'loan' (what you owe).
  // why = a few words ("Income tax 10%"). how = one short sentence that explains it ("It pays for the school and roads.").
  const LOG_MAX = 120;
  function note(life, acct, n, icon, why, how, extra) {
    n = Math.round(n); if (!n) return null;
    const e = { id: ++life.logSeq, t: Date.now(), day: life.day, acct, n, icon, why, how: how || '', ...(extra || {}) };
    life.log.unshift(e); if (life.log.length > LOG_MAX) life.log.length = LOG_MAX;
    return e;
  }
  // coins in: counts as earned (for dreams and the day's summary)
  function earn(life, n, kind, icon = '🪙', why = 'Coins', how = '', extra) {
    n = Math.round(n); if (!n) return;
    life.coins += n; life.stats.earned += n; life.today.earned += n;
    if (kind) life.stats[kind] = (life.stats[kind] || 0) + n;
    note(life, 'pocket', n, icon, why, how, extra);
  }
  // coins out, only if you have them. This is always something you chose to buy.
  function spend(life, n, icon = '🪙', why = 'Spent', how = '') {
    n = Math.round(n);
    if (n > life.coins) return false;
    life.coins -= n; life.today.spent += n;
    note(life, 'pocket', -n, icon, why, how, { buy: true });
    return true;
  }
  // little extra coins for kids (a trail, dream stars, a fair price...). Each kind has a daily cap, written in the rules.
  function kidBonus(life, src, n, icon, why, how) {
    const cap = rules(life).caps[src] || 0, used = life.today.bonus[src] || 0, pay = Math.min(n, cap - used);
    if (pay <= 0) return 0;
    life.today.bonus[src] = used + pay;
    earn(life, pay, null, icon, why, how, { bonus: src });
    return pay;
  }
  const dreamStar = (life) => kidBonus(life, 'dream', 1, '🌠', 'Dream star', 'You caught a star in your dream!');
  const addItem = (life, g, n = 1) => { life.bag[g] = (life.bag[g] || 0) + n; };
  const takeItem = (life, g, n = 1) => { if ((life.bag[g] || 0) < n) return false; life.bag[g] -= n; return true; };
  const bagCount = (life) => Object.values(life.bag).reduce((a, b) => a + b, 0);

  /* ---------------- homes and plots ---------------- */
  const RENT = Town ? Town.RENT : 5;
  const ownedPlots = (town, uid) => town ? Object.entries(town.plots).filter(([, p]) => p.owner === uid).map(([id, p]) => ({ id, ...p, plot: Town.plotById(id) })).filter(p => p.plot) : [];
  const ownsHouse = (town, uid) => ownedPlots(town, uid).some(p => p.build === 'house' || p.build === 'villa');
  const shopPlot = (town, uid) => ownedPlots(town, uid).find(p => p.build === 'shop');

  /* ---------------- things you can own ---------------- */
  // speed: how much faster than walking. upkeep: coins a day (fuel, insurance, parking). Owning costs money every day!
  const VEHICLES = {
    bike: { name: 'Bike', icon: '🚲', price: 45, speed: 1.6, upkeep: 0 },
    scooter: { name: 'Scooter', icon: '🛵', price: 120, speed: 2.1, upkeep: 1 },
    car: { name: 'Car', icon: '🚗', price: 260, speed: 2.6, upkeep: 3 },
    plane: { name: 'Plane', icon: '🛩️', price: 1200, speed: 2.6, upkeep: 6, needs: 'pilot' },
  };
  const FARES = { bus: 2, train: 4 };
  function sellVehicle(life, id) {
    const v = VEHICLES[id]; if (!v || !life.vehicles[id]) return { ok: false, why: '?' };
    const back = Math.floor(v.price / 2);
    delete life.vehicles[id]; life.coins += back;
    const u = upkeepOf(life, id);
    note(life, 'pocket', back, v.icon, `Sold your ${v.name.toLowerCase()}`, `Used things sell for half the price.${u ? ` No more daily costs for it (it cost ${u} every morning).` : ''}`);
    return { ok: true, back };
  }

  /* ---------------- companies ---------------- */
  // lot: needs your own building lot (a real building in town). Online ones are started at the Tech Hub.
  const COMPANIES = {
    bakery: { name: 'Bakery', icon: '🥐', cost: 80, lot: true, base: 16, upkeep: 5, wage: 5 },
    restaurant: { name: 'Restaurant', icon: '🍕', cost: 150, lot: true, base: 28, upkeep: 9, wage: 6 },
    toys: { name: 'Toy Workshop', icon: '🧸', cost: 110, lot: true, base: 20, upkeep: 6, wage: 5 },
    builders: { name: 'Building Co.', icon: '🏗️', cost: 120, lot: true, base: 24, upkeep: 7, wage: 6, needs: 'tools' },
    online: { name: 'Online Store', icon: '🛒', cost: 50, lot: false, base: 0, upkeep: 3, wage: 4, online: true },
    agency: { name: 'Ad Agency', icon: '📣', cost: 120, lot: false, base: 22, upkeep: 6, wage: 6, needs: 'money' },
    app: { name: 'App Studio', icon: '📱', cost: 180, lot: false, base: 32, upkeep: 8, wage: 8, needs: 'math' },
  };
  const staffMax = (co) => co.level * 2;
  // an online store ships 6 a day per level; every packer you hire ships 3 more
  const onlineCap = (co) => 6 * co.level + 3 * co.staff;
  const closeValue = (co) => Math.floor(COMPANIES[co.type].cost * (1 + 0.8 * (co.level - 1)) / 3);
  const upgradeCost = (co) => Math.round(COMPANIES[co.type].cost * 0.8 * co.level);
  function company(life, what, id, arg) {
    const co = life.companies.find(c => c.id === id);
    if (what === 'start') {
      const T = COMPANIES[id]; if (!T) return { ok: false, why: '?' };
      if (T.needs && !hasCert(life, T.needs)) return { ok: false, why: '🎓 ' + SUBJECTS[T.needs].icon };
      if (life.coins < T.cost) return { ok: false, why: `🪙 ${T.cost}` };
      life.coins -= T.cost; life.today.spent += T.cost;
      note(life, 'pocket', -T.cost, T.icon, `Started a company: ${T.name}`, 'Starting a business costs money first. It earns it back over time.', { buy: true });
      const c = { id: id + Date.now().toString(36).slice(-4), type: id, level: 1, staff: 0, ad: 0, plot: arg || null, days: 0, profit: 0 };
      life.companies.push(c); life.stats.companies++;
      return { ok: true, co: c };
    }
    if (!co) return { ok: false, why: '?' };
    const T = COMPANIES[co.type];
    if (what === 'hire') { if (co.staff >= staffMax(co)) return { ok: false, why: '⬆️' }; co.staff++; return { ok: true }; }
    if (what === 'fire') { if (!co.staff) return { ok: false, why: '0' }; co.staff--; return { ok: true }; }
    if (what === 'upgrade') { const c = upgradeCost(co); if (life.coins < c) return { ok: false, why: `🪙 ${c}` }; life.coins -= c; life.today.spent += c; co.level++;
      note(life, 'pocket', -c, '⬆️', `${T.name}: made bigger (level ${co.level})`, 'Bigger companies can sell more, but cost more to run each day.', { buy: true }); return { ok: true }; }
    if (what === 'close') {
      const back = closeValue(co);
      life.companies = life.companies.filter(c => c !== co);
      life.coins += back;
      note(life, 'pocket', back, T.icon, `Closed ${T.name}: sold its things`, 'Closing stops the daily costs. Used ovens, desks and computers sell for a third of what they cost.');
      return { ok: true, back };
    }
    if (what === 'ad') { const c = 6 + 4 * co.level; if (life.coins < c) return { ok: false, why: `🪙 ${c}` }; if (co.ad) return { ok: false, why: '📣' }; life.coins -= c; life.today.spent += c; co.ad = 1; life.stats.ads++;
      note(life, 'pocket', -c, '📣', `${T.name}: an ad`, 'Ads cost money now and bring more customers tomorrow.', { buy: true }); return { ok: true, cost: c }; }
    return { ok: false, why: '?' };
  }
  // one day of business: customers buy, workers get paid. Bigger towns have more customers.
  function companyDay(life, co, town) {
    const T = COMPANIES[co.type], size = 1 + 0.12 * ((town && town.districts) || 0);
    const demand = 0.8 + Math.random() * 0.45, boost = co.ad ? 1.5 : 1;
    let rev;
    if (T.online) {
      // the online store sells what you listed, anywhere in the world, minus a 10% platform fee
      let n = 0, coins = 0;
      for (const g of Object.keys(life.online)) while (life.online[g] > 0 && n < onlineCap(co) * boost) { life.online[g]--; n++; coins += (town ? Town.price(town, g) : 5) + 2; }
      const fee = Math.round(coins * 0.1); rev = coins - fee; life.stats.onlineSold += n; life.stats.onlineCoins += rev;
      co.lastOnline = { n, coins, fee };
    } else rev = Math.round(T.base * co.level * (1 + 0.35 * co.staff) * demand * size * boost);
    const rent = T.upkeep * co.level, wages = co.staff * T.wage, cost = rent + wages, ad = co.ad;
    co.ad = 0; co.days++; co.profit += rev - cost;
    life.stats.coRevenue += rev; life.stats.coProfit += rev - cost;
    return { rev, cost, rent, wages, staff: co.staff, ad, net: rev - cost, online: T.online ? co.lastOnline : null };
  }

  /* ---------------- a video channel ---------------- */
  // New places make better videos. Subscribers watch every day, and views earn a little ad money.
  function makeVideo(life, place) {
    const ch = life.channel, fresh = !ch.places[place];
    ch.places[place] = 1; ch.videos++;
    const gain = fresh ? 6 + Math.floor(Math.random() * 5) : 2;
    ch.subs += gain; return { gain, fresh };
  }

  /* ---------------- experiences ---------------- */
  const MEMORIES = {
    bus: ['🚌', 'First bus ride'], train: ['🚆', 'First train ride'], fish: ['🎣', 'First fish'], view: ['⛰️', 'Top of the hill'],
    shell: ['🐚', 'Seashell'], swim: ['🏊', 'Swim in the sea'], stars: ['🔭', 'Shooting star'], camp: ['🏕️', 'Campfire'],
    berry: ['🫐', 'Wild berries'], gem: ['💎', 'Crystal'], photo: ['📷', 'First photo'], island: ['🏝️', 'Sunny Island'],
    snow: ['🏔️', 'Snow Peak'], safari: ['🦁', 'Safari'], volcano: ['🌋', 'Volcano'], moon: ['🌙', 'Moon walk'],
    company: ['🏭', 'First company'], vehicle: ['🔑', 'First ride of your own'], house: ['🏠', 'Your own home'], video: ['🎬', 'First video'],
    flight: ['✈️', 'First flight'], mayor: ['👑', 'Mayor'], goal: ['⚽', 'First goal'],
    pool: ['🏊', 'Morning swim'], sip: ['🚰', 'Sunset sip'], bed: ['🛏️', 'Sweet dreams'], perfect: ['🌟', 'Perfect Day'],
    rainbow: ['🌈', 'A rainbow'], coinrain: ['🪙', 'Coin rain'], wish: ['🌠', 'A wish on a shooting star'],
    museum: ['🦕', 'Dinosaur bones'], zoo: ['🦁', 'Zoo day'], cafe: ['☕', 'Hot cocoa'], arcade: ['🕹️', 'Arcade high score'], hotel: ['🏨', 'Hotel night'],
  };
  function remember(life, id) {
    if (life.memories[id] || !MEMORIES[id]) return false;
    life.memories[id] = Date.now(); addStars(life, 5); return true;
  }
  const memCount = (life) => Object.keys(life.memories).length;
  const TRIPS = {
    island: { name: 'Sunny Island', icon: '🏝️', fare: 25 },
    snow: { name: 'Snow Peak', icon: '🏔️', fare: 30 },
    safari: { name: 'Safari', icon: '🦁', fare: 35 },
    volcano: { name: 'Volcano', icon: '🌋', fare: 40 },
    moon: { name: 'The Moon', icon: '🌙', fare: 0, rocket: true },
  };

  /* ---------------- a new day: the morning budget ---------------- */
  // Bills are paid automatically each morning. If there are not enough coins, the bank lends the rest
  // (so nothing scary happens, but the loan costs interest). Only one day is charged, even after a long break.
  function newDay(life, town, uid, day) {
    if (life.day === day) return null;
    // time only goes forward: a phone clock a little different from the server's must not charge a morning twice
    if (life.day !== null && day < life.day && life.day - day < 240) return null;
    const first = life.day === null, R = rules(life);
    const lines = [];
    const yesterday = { ...life.today };
    if (life.lastPlayed !== day) { life.prevPlayed = life.lastPlayed; life.lastPlayed = day; }
    // slept in your bed last night? Older kids work better today (+10%)
    life.rested = R.rested && life.rit.sleep === day - 1 ? day : null;
    life.day = day; life.shiftsToday = 0; life.today = freshToday();
    if (first) return null;
    const before = { coins: life.coins, bank: life.bank, loan: life.loan, iou: life.iou };
    const plots = ownedPlots(town, uid);
    // every line: icon, what it is (words), coins (+ or -), and a short "why". night = earned while you slept.
    const line = (acct, icon, label, n, how, extra) => { lines.push({ acct, icon, label, n, how: how || '', ...(extra || {}) }); note(life, acct, n, icon, label, how, { morning: day, ...(extra || {}) }); };
    const gain = (icon, label, n, stat, how) => { if (!n) return; life.coins += n; life.stats.earned += n; life.today.earned += n; if (stat) life.stats[stat] += n; line('pocket', icon, label, n, how, { night: true }); };
    const bill = (icon, label, n, how) => { if (!n) return; life.coins -= n; life.today.spent += n; line('pocket', icon, label, -n, how); };
    // income first: this is money that came in while you slept
    const sg = saveGrowth(life);
    if (sg.n || life.bank > 0) {
      life.bankFrac = sg.frac;
      const raw = Math.round(before.bank * R.saveRate) / 100;
      if (sg.n) { life.bank += sg.n; life.stats.interest += sg.n; life.stats.earned += sg.n; line('bank', '🐷', `Savings grew ${R.saveRate}% (interest)`, sg.n, `${R.saveRate}% of ${before.bank} is ${raw}${R.saveMin && sg.n === 1 && raw < 1 ? ' (kids get at least 1)' : ''}${R.saveCap && sg.n === R.saveCap && raw > R.saveCap ? ` (kids get at most ${R.saveCap} a day)` : ''}. The bank pays you for keeping coins there.`, { night: true }); }
    }
    const shop = shopPlot(town, uid);
    if (shop && town) {
      let sold = 0, coins = 0;
      for (const g of Object.keys(life.shelf)) {
        while (life.shelf[g] > 0 && sold < 5) { life.shelf[g]--; sold++; coins += Town.price(town, g) + 3; }
      }
      if (sold) gain('🏪', `Your shop sold ${sold} thing${sold === 1 ? '' : 's'}`, coins, 'shopSales', 'Customers pay the market price + 3.');
      else lines.push({ acct: 'pocket', icon: '🏪', label: 'Your shop shelf was empty, so it sold nothing', n: 0, how: 'Put things on the shelf to sell tomorrow.', night: true });
    }
    // companies: sales in, costs out. A loss comes out of your pocket, and it says why. (Band 1: a quiet day, never a loss.)
    let losses = 0, profits = 0;
    life.companies.forEach(co => {
      const T = COMPANIES[co.type], r = companyDay(life, co, town);
      const costs = [`rent & supplies ${r.rent}`, r.wages ? `${r.staff} worker${r.staff > 1 ? 's' : ''} ${r.wages}` : ''].filter(Boolean).join(' + ');
      const how = r.online ? `Sold ${r.online.n} online for ${r.online.coins}, the website kept ${r.online.fee} (10% fee). Costs: ${costs}.`
        : `Customers paid ${r.rev}${r.ad ? ' (the ad brought extra customers)' : ''}. Costs: ${costs}.`;
      if (r.net >= 0) { profits += r.net; gain(T.icon, `${T.name}: profit`, r.net, null, how); }
      else if (R.coLossZero) { co.profit -= r.net; life.stats.coProfit -= r.net; lines.push({ acct: 'pocket', icon: T.icon, label: `${T.name}: a quiet day`, n: 0, how: 'Not many customers today. Kids never lose money on a company.', night: true }); }
      else { losses += -r.net; bill(T.icon, `${T.name}: lost money today`, -r.net, how + (r.online && !r.online.n ? ' Nothing was listed to sell!' : ' Costs were bigger than sales.')); }
    });
    // the channel
    const ch = life.channel;
    if (ch.videos) { const views = ch.subs * 4 + ch.videos * 2; ch.views += views; const c = Math.floor(views / 10); ch.earned += c; gain('📹', `Your videos: ${views} views`, c, 'viewCoins', '1 coin for every 10 views.'); }
    // what you owed yesterday (band 2, no interest) is paid first
    if (life.iou > 0 && life.coins > 0) { const n = Math.min(life.iou, life.coins); life.iou -= n; life.coins -= n; line('pocket', '🧾', 'Paid back what you owed', -n, 'Yesterday your coins were short, so you owed this. It had no interest.', { move: true }); note(life, 'loan', -n, '🧾', 'Paid back (no interest)', '', { morning: day }); }
    // then the bills (the rules for your age decide which ones you have)
    let bills = 0, taxes = 0;
    if (R.rent) {
      if (ownsHouse(town, uid)) life.home = life.home || 'here';
      else if (life.home) lines.push({ acct: 'pocket', icon: '🏠', label: 'No rent: you have your own house', n: 0, how: 'You built a house, so you never pay rent again.' });
      else if (life.rentFree > 0) { life.rentFree--; lines.push({ acct: 'pocket', icon: '🎁', label: life.rentFree ? `Free rent (newcomer gift, ${life.rentFree} free day${life.rentFree === 1 ? '' : 's'} left)` : 'Free rent today: your last free day', n: 0, how: `After that, rent is ${R.rent} a day until you build your own house.` }); }
      else { bills += R.rent; bill('🏢', 'Apartment rent', R.rent, 'You live in an apartment. Build your own house and you stop paying rent.'); }
    }
    // teens with a big business (star level 5+) pay business tax on profit, like real companies
    if (life.band === 3 && starLevel(life.xp) >= 5 && profits >= 10) { const bt = Math.floor(profits / 10); taxes += bt; bill('🏛️', 'Business tax 10%', bt, `10% of your companies' profit (${profits}) goes to the town, like income tax does.`); }
    plots.forEach(p => { const t = landTaxOf(life, p.plot.kind); if (!t) return; taxes += t; bill('🏛️', `Land tax for your ${p.plot.kind === 'farm' ? 'farm' : 'land'} ${p.id}`, t, 'Everyone who owns land pays a little to the town each day. You can sell land back at 🔑 My things.'); });
    Object.keys(life.vehicles).forEach(v => { const u = upkeepOf(life, v); if (u) { bills += u; bill(VEHICLES[v].icon, `${VEHICLES[v].name}: fuel & repairs`, u, 'Owning a vehicle costs money every day, even when you park it. You can sell it at 🔑 My things.'); } });
    const due = bills + taxes;
    // not enough in your pocket? Your savings pay first. Then: band 2 owes it (no interest), band 3 borrows it.
    let fromSavings = 0, borrowed = 0, owed = 0;
    if (life.coins < 0) {
      const short = -life.coins, why = [losses ? `your companies lost ${losses}` : '', due ? `the bills were ${due}` : ''].filter(Boolean).join(' and ');
      fromSavings = Math.min(life.bank, short);
      if (fromSavings) {
        life.bank -= fromSavings; life.coins += fromSavings;
        line('pocket', '🐷', 'Your savings paid the rest', fromSavings, `Your pocket had ${before.coins} but ${why}, so your savings paid the rest.`, { move: true });
        note(life, 'bank', -fromSavings, '👛', 'Used to pay the bills', '', { morning: day });
      }
      if (life.coins < 0 && R.shortfall === 'loan') {
        borrowed = -life.coins; life.loan += borrowed; life.coins = 0;
        line('pocket', '💸', 'The bank lent you the rest', borrowed, `Your pocket${fromSavings ? ' and savings' : ''} did not have enough: ${why}. Pay it back at the bank.`, { move: true });
        note(life, 'loan', borrowed, '💸', 'Borrowed to pay the bills', '', { morning: day });
      } else if (life.coins < 0 && R.shortfall === 'iou') {
        owed = -life.coins; life.iou += owed; life.coins = 0;
        line('pocket', '🧾', `You owe ${owed} (no interest)`, owed, `Your pocket${fromSavings ? ' and savings' : ''} did not have enough: ${why}. It is paid back from your pocket tomorrow morning.`, { move: true });
        note(life, 'loan', owed, '🧾', 'Owed for the bills (no interest)', '', { morning: day });
      } else if (life.coins < 0) {   // band 1 never has bills; just in case, nothing is owed
        const gift = -life.coins; life.coins = 0;
        line('pocket', '🎁', 'The town helped you out', gift, 'Kids never owe money.', { move: true });
      }
    }
    // loan interest, only on what you owed last night (not on what was just lent)
    if (before.loan > 0 && R.loanRate) {
      const g = grows(before.loan, R.loanRate, life.loanFrac); life.loanFrac = g.frac;
      if (g.n) { life.loan += g.n; life.stats.loanInterest += g.n; lines.push({ acct: 'loan', icon: '💸', label: `Your loan grew ${R.loanRate}% (interest)`, n: 0, note: `+${g.n} owed`, how: `${R.loanRate}% of ${before.loan} is ${Math.round(before.loan * R.loanRate) / 100}. Borrowed coins cost extra every day until you pay them back.` }); note(life, 'loan', g.n, '💸', `Loan interest ${R.loanRate}%`, `${R.loanRate}% of ${before.loan}`, { morning: day }); }
    }
    life.stats.taxPaid += taxes; if (taxes) life.rep += 1;
    return { day, lines, due, taxes, losses, borrowed, owed, fromSavings, yesterday, before, coins: life.coins, bank: life.bank, loan: life.loan, iou: life.iou, band: life.band };
  }
  // what tomorrow morning will look like (for the budget card at bedtime), without changing anything
  function previewBills(life, town, uid) {
    const copy = JSON.parse(JSON.stringify(life)); copy.log = []; copy.logSeq = 0;
    return newDay(copy, town, uid, (life.day || 0) + 1);
  }
  // only a grown-up changes the age group. Moving down forgives debts, moving up gives a few rent-free days.
  function setBand(life, b) {
    b = clamp(b | 0, 1, 3); const from = life.band; if (b === from) return false;
    if (life.shift) quitShift(life, life.shift.rate);   // pay the tasks done so far under the old rules
    life.band = b;
    if (b === 1) {
      if (life.loan) { note(life, 'loan', -life.loan, '🎁', "Kids' rules: the bank forgave your loan"); life.loan = 0; }
      if (life.iou) { note(life, 'loan', -life.iou, '🎁', "Kids' rules: what you owed is forgiven"); life.iou = 0; }
    }
    if (b === 2 && life.loan) {
      const n = life.loan; life.loan = 0; life.iou += n; life.loanFrac = 0;
      note(life, 'loan', -n, '🧾', 'Your loan is now an IOU'); note(life, 'loan', n, '🧾', 'IOU (no interest)', 'Kids of 9 to 12 owe without interest. It is paid back from your pocket each morning.');
    }
    if (b > from) life.rentFree = Math.max(life.rentFree, 3);
    return true;
  }

  /* ---------------- daily rituals from Noodle Universe: swim at sunrise, a sip at sunset, bed at night ---------------- */
  // The pool and the tap work all day; only the star and coins have a time window (wider for younger kids).
  const RITUALS = { swim: { icon: '🌅', name: 'Morning swim', at: 'pool' }, sip: { icon: '🌇', name: 'Sunset sip', at: 'tap' }, sleep: { icon: '🛏️', name: 'Bedtime', at: 'home' } };
  function ritualState(life, id, now) {
    const day = Math.max(dayOf(now), life.day || 0);
    if (life.rit[id] === day) return 'done';
    if (id === 'swim' && !life.stats.swims) return 'open';   // a brand-new kid's first swim counts at any hour
    const h = hourOf(now), [a, b] = rules(life).win[id];
    return h < a ? 'soon' : h < b ? 'open' : 'past';
  }
  const ritualNext = (life, now) => Object.keys(RITUALS).find(id => ritualState(life, id, now) === 'open') || null;
  function doRitual(life, id, now) {
    if (ritualState(life, id, now) !== 'open') return null;
    const day = Math.max(dayOf(now), life.day || 0), R = rules(life), T = RITUALS[id];
    life.rit[id] = day; life.stats[id + 's'] = (life.stats[id + 's'] || 0) + 1;
    earn(life, R.rit[id], null, T.icon, T.name, ({ swim: 'A swim at sunrise wakes up your body.', sip: 'A drink of water at sunset: your body is mostly water!', sleep: 'Sleep helps you grow and remember.' })[id]);
    addStars(life, 1);
    let healthy = false;
    if (Object.keys(RITUALS).every(k => life.rit[k] === day)) { healthy = true; life.stats.healthy++; addStars(life, 1); }
    return { coins: R.rit[id], stars: healthy ? 2 : 1, healthy };
  }

  /* ---------------- ⭐ stars: one points system, endless levels ---------------- */
  const starLevel = (xp) => 1 + Math.floor(Math.sqrt((xp || 0) / 3));
  const starsFor = (L) => 3 * (L - 1) * (L - 1);
  const addStars = (life, n) => { life.xp = (life.xp || 0) + n; };
  const LEVEL_HATS = { 3: 'flower', 5: 'beanie', 7: 'propeller', 9: 'chef', 10: 'crown', 12: 'bowl' };
  const levelReward = (L, band) => { if (LEVEL_HATS[L]) return { hat: LEVEL_HATS[L] }; const [k, cap] = (RULES[band] || RULES[2]).lvGift; return { coins: Math.min(cap, k * L) }; };
  function claimLevels(life) {
    const out = [], lv = starLevel(life.xp);
    while ((life.levelClaimed || 1) < lv) {
      const L = (life.levelClaimed || 1) + 1, r = levelReward(L, life.band);
      life.levelClaimed = L;
      if (r.hat) { life.hats[r.hat] = 1; life.hat = r.hat; }
      else earn(life, r.coins, null, '⭐', `Level ${L} gift`, 'Stars add up to levels, and every level has a prize.');
      out.push({ L, ...r });
    }
    return out;
  }

  /* ---------------- the first four things to do (before picking a dream) ---------------- */
  const STARTER = [
    { id: 'swim', icon: '🏊', text: 'Swim in the pool', at: 'pool', done: (l) => (l.stats.swims || 0) >= 1 },
    { id: 'pick', icon: '🧺', text: 'Pick 3 at the Town Farm', at: 'townfarm', done: (l) => (l.stats.farmPicked || 0) >= 3, n: (l) => Math.min(3, l.stats.farmPicked || 0), of: 3 },
    { id: 'sell', icon: '🪙', text: 'Sell at the Market', at: 'market', done: (l) => l.stats.sold >= 1 },
    { id: 'save', icon: '🐷', text: 'Save at the Bank', at: 'bank', done: (l) => l.stats.deposits >= 1 },
  ];
  function checkStarter(life) {
    const done = [];
    while ((life.starter || 0) < STARTER.length && STARTER[life.starter || 0].done(life)) { done.push(STARTER[life.starter || 0]); life.starter = (life.starter || 0) + 1; addStars(life, 1); }
    return done;
  }

  /* ---------------- three little challenges a day (the same three for friends in a room) ---------------- */
  const DAILY_POOL = [
    { id: 'pick', icon: '🧺', text: 'Pick at the Town Farm', goal: [3, 5, 8], at: 'townfarm' },
    { id: 'plant', icon: '🌱', text: 'Plant a sapling', goal: [1, 2, 3], at: 'stump' },
    { id: 'shift', icon: '💼', text: 'Finish a job shift', goal: [1, 1, 2], at: 'jobs' },
    { id: 'sell', icon: '🪙', text: 'Sell things at the Market', goal: [2, 4, 8], at: 'market' },
    { id: 'save', icon: '🐷', text: 'Save coins at the Bank', goal: [5, 15, 30], at: 'bank' },
    { id: 'hello', icon: '👋', text: 'Say hi to townsfolk', goal: [2, 3, 4], at: 'npc' },
    { id: 'hop', icon: '🦘', text: 'Hop', goal: [10, 15, 20], at: null },
    { id: 'kick', icon: '⚽', text: 'Kick the ball', goal: [3, 5, 8], at: 'ball' },
    { id: 'class', icon: '🎓', text: 'Take a class', goal: [1, 1, 1], at: 'school' },
    { id: 'fish', icon: '🎣', text: 'Catch a fish', goal: [1, 2, 3], at: 'spot:fish' },
  ];
  // these can grow with your star level; the others are limited by the day (shifts, stumps, fish, classes)
  const DAILY_GROWS = ['pick', 'hello', 'hop', 'kick', 'sell', 'save'];
  const DAILY_BY_ID = Object.fromEntries(DAILY_POOL.map(d => [d.id, d]));
  function ensureDaily(life, day, ctx) {
    if (life.daily && life.daily.day === day) return life.daily;
    const r = seeded(day * 7919 + 13), order = DAILY_POOL.map(d => ({ d, k: r() })).sort((a, b) => a.k - b.k).map(x => x.d);
    const lv = starLevel(life.xp), b = clamp(life.band | 0, 1, 3) - 1;
    const list = order.slice(0, 3).map(d => ({ id: d.id, goal: d.goal[b] + (DAILY_GROWS.includes(d.id) ? Math.floor((lv - 1) / 10) : 0), n: 0, done: false }));
    life.daily = { day, list, perfect: false, shown: false };
    return life.daily;
  }
  // something happened (n times). Counts toward today's challenges; pays when one is finished.
  function dailyAdd(life, id, n = 1) {
    const t = life.today; t.count[id] = (t.count[id] || 0) + n;
    const d = life.daily; if (!d || d.day !== life.day) return { done: [], perfect: false };
    const R = rules(life), done = [];
    d.list.forEach(c => {
      c.n = Math.min(c.goal, t.count[c.id] || 0);
      if (!c.done && c.n >= c.goal) { c.done = true; done.push(c); addStars(life, 1); earn(life, R.daily, null, DAILY_BY_ID[c.id].icon, `Challenge done: ${DAILY_BY_ID[c.id].text}`, 'One of today\'s three challenges.'); }
    });
    let perfect = false;
    if (!d.perfect && d.list.length && d.list.every(c => c.done)) {
      d.perfect = perfect = true; addStars(life, 2); life.perfectDays = (life.perfectDays || 0) + 1;
      life.streak = life.lastPerfect === life.prevPlayed ? (life.streak || 0) + 1 : 1; life.lastPerfect = life.day;
      earn(life, R.perfect, null, '🌟', 'Perfect Day: all 3 challenges', 'You finished every challenge today!');
    }
    return { done, perfect };
  }

  /* ---------------- dreams ---------------- */
  // Each step: [what to do, done?, where to go (for the guide arrow), icon]
  const S = (l) => l.stats;
  const has = (c, kind) => c.plots.some(p => p.plot.kind === kind);
  const built = (c, b) => c.plots.some(p => p.build === b);
  const hasCo = (l, t) => l.companies.some(c => !t || (Array.isArray(t) ? t.includes(c.type) : c.type === t));
  const L = (l) => l.stats;
  const DREAMS = {
    farmer: { name: 'Farmer', icon: '🌾', title: 'Farmer', desc: 'Grow food and sell it.', little: [
      ['Pick 3 at the Town Farm', (l) => (L(l).farmPicked || 0) >= 3, 'townfarm', '🧺'],
      ['Sell at the Market', (l) => L(l).sold >= 1, 'market', '🪙'],
      ['Buy a farm', (l, c) => has(c, 'farm'), 'farmland', '🏡'],
      ['Harvest 3 crops', (l) => L(l).harvested >= 3, 'myfarm', '🌾'],
      ['60 from selling', (l) => L(l).soldCoins >= 60, 'market', '💰'],
      ['Own 2 farms', (l, c) => c.plots.filter(p => p.plot.kind === 'farm').length >= 2, 'farmland', '🏡'],
    ], steps: [
      ['Farmhand shift', (l) => (S(l).shifts.farmhand || 0) >= 1, 'jobs', '🧑‍🌾'],
      ['Sell at the Market', (l) => S(l).sold >= 1, 'market', '🧺'],
      ['Buy a farm', (l, c) => has(c, 'farm'), 'farmland', '🏡'],
      ['Harvest 6 crops', (l) => S(l).harvested >= 6, 'myfarm', '🌾'],
      ['Earn 150 selling', (l) => S(l).soldCoins >= 150, 'market', '💰'],
      ['Own 2 farms', (l, c) => c.plots.filter(p => p.plot.kind === 'farm').length >= 2, 'farmland', '🏡'],
    ] },
    builder: { name: 'Builder', icon: '🔨', title: 'Builder', desc: 'Build houses and more.', little: [
      ['Chop a tree', (l) => L(l).chopped >= 1, 'tree', '🪓'],
      ['Plant a sapling', (l) => L(l).replanted >= 1, 'stump', '🌱'],
      ['12 logs', (l) => (l.bag.log || 0) >= 12 || L(l).built >= 1, 'tree', '🪵'],
      ['Buy a lot', (l, c) => has(c, 'lot'), 'lot', '🏗️'],
      ['Build a house', (l, c) => built(c, 'house') || built(c, 'villa'), 'mylot', '🏠'],
      ['Build a shop', (l, c) => built(c, 'shop'), 'lot', '🏪'],
    ], steps: [
      ['Chop a tree', (l) => S(l).chopped >= 1, 'tree', '🪓'],
      ['Plant a sapling', (l) => S(l).replanted >= 1, 'stump', '🌱'],
      ['Building class', (l) => hasCert(l, 'tools'), 'school', '🎓'],
      ['Builder shift', (l) => (S(l).shifts.builder || 0) >= 1, 'jobs', '👷'],
      ['Buy a lot', (l, c) => has(c, 'lot'), 'lot', '🏗️'],
      ['Build a house', (l, c) => built(c, 'house'), 'mylot', '🏠'],
      ['Build a villa', (l, c) => built(c, 'villa'), 'lot', '🏡'],
    ] },
    shopkeeper: { name: 'Shopkeeper', icon: '🏪', title: 'Shopkeeper', desc: 'Buy low, sell high.', little: [
      ['Sell at the Market', (l) => L(l).sold >= 1, 'market', '🪙'],
      ['Save 50', (l) => l.coins + l.bank >= 50, 'townfarm', '💰'],
      ['Buy a lot', (l, c) => has(c, 'lot'), 'lot', '🏗️'],
      ['Build a shop', (l, c) => built(c, 'shop'), 'mylot', '🏪'],
      ['Stock 3 things', (l) => L(l).stocked >= 3, 'mylot', '📦'],
      ['40 in sales', (l) => L(l).shopSales >= 40, 'mylot', '💰'],
    ], steps: [
      ['Sell at the Market', (l) => S(l).sold >= 1, 'market', '🧺'],
      ['Money class', (l) => hasCert(l, 'money'), 'school', '🎓'],
      ['Save 100', (l) => l.coins + l.bank >= 100, 'jobs', '💰'],
      ['Buy a lot', (l, c) => has(c, 'lot'), 'lot', '🏗️'],
      ['Build a shop', (l, c) => built(c, 'shop'), 'mylot', '🏪'],
      ['Stock 5 things', (l) => S(l).stocked >= 5, 'mylot', '📦'],
      ['Earn 80 in sales', (l) => S(l).shopSales >= 80, 'mylot', '💰'],
    ] },
    mayor: { name: 'Mayor', icon: '🏛️', title: 'Mayor', desc: 'Lead the town.', steps: [
      ['Vote at Town Hall', (l) => S(l).votes >= 1, 'hall', '🗳️'],
      ['Civics class', (l) => hasCert(l, 'civics'), 'school', '🎓'],
      ['Clerk shift', (l) => (S(l).shifts.clerk || 0) >= 1, 'jobs', '📋'],
      ['Pay 10 taxes', (l) => S(l).taxPaid >= 10, 'jobs', '🏛️'],
      ['20 helper points', (l) => l.rep >= 20, 'jobs', '🤝'],
      ['Run for mayor', (l) => S(l).ran >= 1, 'hall', '📣'],
      ['Win the election', (l) => S(l).won >= 1, 'hall', '👑'],
    ] },
    banker: { name: 'Banker', icon: '🏦', title: 'Banker', desc: 'Make money grow.', little: [
      ['Save at the Bank', (l) => L(l).deposits >= 1, 'bank', '🐷'],
      ['20 in your piggy bank', (l) => l.bank >= 20, 'bank', '🐷'],
      ['3 coins of interest', (l) => L(l).interest >= 3, 'bank', '📈'],
      ['Money class', (l) => hasCert(l, 'money'), 'school', '🎓'],
      ['100 in your piggy bank', (l) => l.bank >= 100, 'bank', '💰'],
      ['Teller shift', (l) => (L(l).shifts.teller || 0) >= 1, 'jobs', '🏦'],
    ], steps: [
      ['Save at the Bank', (l) => S(l).deposits >= 1, 'bank', '🐷'],
      ['Money class', (l) => hasCert(l, 'money'), 'school', '🎓'],
      ['Teller shift', (l) => (S(l).shifts.teller || 0) >= 1, 'jobs', '🏦'],
      ['Earn 5 interest', (l) => S(l).interest >= 5, 'bank', '📈'],
      ['150 in the bank', (l) => l.bank >= 150, 'bank', '💰'],
      ['5 teller shifts', (l) => (S(l).shifts.teller || 0) >= 5, 'jobs', '🏦'],
    ] },
    teacher: { name: 'Teacher', icon: '🍎', title: 'Teacher', desc: 'Learn, then teach.', little: [
      ['Take a class', (l) => L(l).classes >= 1, 'school', '📚'],
      ['1 certificate', (l) => certCount(l) >= 1, 'school', '🎓'],
      ['2 certificates', (l) => certCount(l) >= 2, 'school', '🎓'],
      ['3 certificates', (l) => certCount(l) >= 3, 'school', '🎓'],
      ['Tutor shift', (l) => (L(l).shifts.tutor || 0) >= 1, 'jobs', '🍎'],
      ['All 5 certificates', (l) => certCount(l) >= 5, 'school', '🎓'],
    ], steps: [
      ['Take a class', (l) => S(l).classes >= 1, 'school', '📚'],
      ['1 certificate', (l) => certCount(l) >= 1, 'school', '🎓'],
      ['3 certificates', (l) => certCount(l) >= 3, 'school', '🎓'],
      ['Tutor shift', (l) => (S(l).shifts.tutor || 0) >= 1, 'jobs', '🍎'],
      ['All 5 certificates', (l) => certCount(l) >= 5, 'school', '🎓'],
      ['5 tutor shifts', (l) => (S(l).shifts.tutor || 0) >= 5, 'jobs', '🍎'],
    ] },
    youtuber: { name: 'YouTuber', icon: '📹', title: 'Creator', desc: 'Film the world, grow a channel.', steps: [
      ['Take a photo in nature', (l) => S(l).photos >= 1, 'spot:photo', '📷'],
      ['Make a video', (l) => l.channel.videos >= 1, 'studio', '🎬'],
      ['10 subscribers', (l) => l.channel.subs >= 10, 'spot:photo', '⭐'],
      ['Earn 10 from views', (l) => S(l).viewCoins >= 10, 'studio', '💰'],
      ['Post 5 videos', (l) => l.channel.videos >= 5, 'studio', '🎬'],
      ['60 subscribers', (l) => l.channel.subs >= 60, 'spot:photo', '🌟'],
    ] },
    marketer: { name: 'Digital Marketer', icon: '📣', title: 'Marketer', desc: 'Help businesses get customers.', steps: [
      ['Money class', (l) => hasCert(l, 'money'), 'school', '🎓'],
      ['Marketer shift', (l) => (S(l).shifts.marketer || 0) >= 1, 'jobs', '📣'],
      ['Start an Ad Agency', (l) => hasCo(l, 'agency'), 'tech', '🏢'],
      ['Run 3 ads', (l) => S(l).ads >= 3, 'biz', '📺'],
      ['Earn 100 profit', (l) => S(l).coProfit >= 100, 'biz', '💰'],
    ] },
    online: { name: 'Online Seller', icon: '🛒', title: 'Online Seller', desc: 'Sell online, to anywhere.', steps: [
      ['Sell at the Market', (l) => S(l).sold >= 1, 'market', '🧺'],
      ['Open an online store', (l) => hasCo(l, 'online'), 'tech', '🛒'],
      ['List 5 things', (l) => S(l).listed >= 5, 'tech', '📦'],
      ['Sell 10 online', (l) => S(l).onlineSold >= 10, 'tech', '🚚'],
      ['Earn 100 online', (l) => S(l).onlineCoins >= 100, 'tech', '💰'],
    ] },
    coder: { name: 'Coder', icon: '💻', title: 'Coder', desc: 'Build apps people love.', steps: [
      ['Math class', (l) => hasCert(l, 'math'), 'school', '🎓'],
      ['Coder shift', (l) => (S(l).shifts.coder || 0) >= 1, 'jobs', '💻'],
      ['Start an App Studio', (l) => hasCo(l, 'app'), 'tech', '📱'],
      ['Hire a coder', (l) => l.companies.some(c => c.type === 'app' && c.staff >= 1), 'biz', '🧑‍💻'],
      ['Upgrade your app', (l) => l.companies.some(c => c.type === 'app' && c.level >= 2), 'biz', '⬆️'],
    ] },
    chef: { name: 'Chef', icon: '👩‍🍳', title: 'Chef', desc: 'Cook and run a restaurant.', steps: [
      ['Pick wild berries', (l) => (S(l).found.berry || 0) >= 1, 'spot:berry', '🫐'],
      ['Buy a lot', (l, c) => has(c, 'lot'), 'lot', '🏗️'],
      ['Open a bakery or restaurant', (l) => hasCo(l, ['bakery', 'restaurant']), 'mylot', '🍕'],
      ['Hire a cook', (l) => l.companies.some(c => c.staff >= 1), 'biz', '🧑‍🍳'],
      ['Earn 150 in sales', (l) => S(l).coRevenue >= 150, 'biz', '💰'],
    ] },
    ceo: { name: 'Entrepreneur', icon: '🏢', title: 'CEO', desc: 'Start companies and grow them.', steps: [
      ['Save 150', (l) => l.coins + l.bank >= 150, 'jobs', '💰'],
      ['Start a company', (l) => l.companies.length >= 1, 'biz', '🏭'],
      ['Hire 2 people', (l) => l.companies.reduce((a, c) => a + c.staff, 0) >= 2, 'biz', '🧑‍🤝‍🧑'],
      ['Run an ad', (l) => S(l).ads >= 1, 'biz', '📣'],
      ['Own 2 companies', (l) => l.companies.length >= 2, 'biz', '🏭'],
      ['Earn 300 profit', (l) => S(l).coProfit >= 300, 'biz', '💰'],
    ] },
    explorer: { name: 'Explorer', icon: '🧭', title: 'Explorer', desc: 'Travel and see nature.', little: [
      ['Catch a fish', (l) => (L(l).found.fish || 0) >= 1, 'spot:fish', '🎣'],
      ['Take a photo', (l) => L(l).photos >= 1, 'spot:photo', '📷'],
      ['Pick wild berries', (l) => (L(l).found.berry || 0) >= 1, 'spot:berry', '🫐'],
      ['See the stars at night', (l) => !!l.memories.stars, 'spot:stars', '🔭'],
      ['8 memories', (l) => memCount(l) >= 8, 'nature', '📸'],
      ['Ride the bus or train', (l) => L(l).rides >= 1, 'stop', '🚌'],
      ['Go on a trip', (l) => L(l).trips >= 1, 'airport', '🏝️'],
    ], steps: [
      ['Catch a fish', (l) => (S(l).found.fish || 0) >= 1, 'spot:fish', '🎣'],
      ['Ride the bus or train', (l) => S(l).rides >= 1, 'stop', '🚌'],
      ['Visit 3 nature spots', (l) => S(l).spots >= 3, 'nature', '🌲'],
      ['Go on a trip', (l) => S(l).trips >= 1, 'airport', '🏝️'],
      ['10 memories', (l) => memCount(l) >= 10, 'nature', '📸'],
    ] },
    pilot: { name: 'Pilot', icon: '✈️', title: 'Pilot', desc: 'Fly planes around the world.', steps: [
      ['Math class', (l) => hasCert(l, 'math'), 'school', '🎓'],
      ['Ride the train', (l) => (S(l).rideTrain || 0) >= 1, 'station', '🚆'],
      ['Flight school', (l) => !!l.badges.pilot, 'airport', '🎓'],
      ['Fly 3 trips', (l) => S(l).trips >= 3, 'airport', '✈️'],
      ['Buy a plane', (l) => !!l.vehicles.plane, 'dealer', '🛩️'],
    ] },
    astronaut: { name: 'Astronaut', icon: '🚀', title: 'Astronaut', desc: 'Train hard and go to space.', steps: [
      ['Science class', (l) => hasCert(l, 'science'), 'school', '🔬'],
      ['Math class', (l) => hasCert(l, 'math'), 'school', '➗'],
      ['See the stars', (l) => !!l.memories.stars, 'spot:stars', '🔭'],
      ['Astronaut training', (l) => !!l.badges.astronaut, 'space', '🧑‍🚀'],
      ['Walk on the Moon', (l) => !!l.memories.moon, 'space', '🌙'],
    ] },
  };
  // the few shown first; the rest are one tap away. Little kids get six that all work in the old town.
  const FEATURED = ['farmer', 'builder', 'youtuber', 'astronaut', 'ceo', 'explorer'];
  const FEATURED_BY_BAND = { 1: ['farmer', 'builder', 'shopkeeper', 'banker', 'teacher', 'explorer'], 2: FEATURED, 3: FEATURED };
  const stepsOf = (life, d) => life.band === 1 && d.little ? d.little : d.steps;
  // After the steps, the dream keeps going forever: every 60/120/180 coins earned (by age) is one more level.
  const ENDLESS = 120;
  function dreamGoal(life) {
    const d = DREAMS[life.dream]; if (!d) return null;
    const steps = stepsOf(life, d), E = rules(life).endless;
    if (life.dreamStep < steps.length) { const st = steps[life.dreamStep]; return { text: st[0], at: st[2], icon: st[3], i: life.dreamStep, of: steps.length }; }
    const got = life.stats.earned - life.dreamMark;
    return { text: `Level ${life.dreamLv + 1}: earn ${Math.min(E, got)} of ${E}🪙`, icon: '⭐', at: 'jobs', i: life.dreamStep, of: null, endless: true };
  }
  // ctx = { plots } (your land in this town). Returns the steps finished just now. Each step is ⭐+2.
  function checkDream(life, ctx) {
    const d = DREAMS[life.dream]; if (!d) return [];
    const steps = stepsOf(life, d), E = rules(life).endless, done = [];
    while (life.dreamStep < steps.length && steps[life.dreamStep][1](life, ctx)) {
      done.push(steps[life.dreamStep][0]); life.dreamStep++; life.dreamLv++; addStars(life, 2);
      if (life.dreamStep === steps.length) life.dreamMark = life.stats.earned;
    }
    if (life.dreamStep >= steps.length && life.stats.earned - life.dreamMark >= E) {
      life.dreamLv++; life.dreamMark = life.stats.earned; done.push(`Level ${life.dreamLv}`); addStars(life, 2);
    }
    return done;
  }
  function title(life) {
    const d = DREAMS[life.dream], lv = starLevel(life.xp);
    return d ? `${d.icon} ${d.title} ⭐${lv}` : `🌱 ⭐${lv}`;
  }

  /* ---------------- a new life ---------------- */
  const freshToday = () => ({ earned: 0, spent: 0, tax: 0, bonus: {}, count: {}, hello: {}, bell: {} });
  function fresh(band) {
    const b = clamp(band | 0, 1, 3) || 2;
    return {
      v: 1, coins: RULES[b].start, bank: 0, loan: 0, iou: 0, band: b,
      bag: { wheat: 0, carrot: 0, tomato: 0, corn: 0, log: 0, fish: 0, shell: 0, gem: 0, berry: 0, photo: 0 }, shelf: {}, online: {},
      school: {}, job: null, shift: null, shiftsToday: 0, day: null, today: freshToday(),
      dream: null, dreamStep: 0, dreamLv: 0, dreamMark: 0, rentFree: RULES[b].rentFree, rep: 0, owesSapling: 0, seen: {},
      hat: null, hats: {}, levelClaimed: 1, starter: 0, rit: {}, daily: null, perfectDays: 0, streak: 0, lastPerfect: null, lastPlayed: null, prevPlayed: null, rested: null, wonders: {},
      vehicles: {}, riding: null, companies: [], channel: { videos: 0, subs: 0, views: 0, earned: 0, places: {} },
      xp: 0, memories: {}, badges: {}, spotAt: {}, photos: {}, log: [], logSeq: 0, bankFrac: 0, loanFrac: 0, home: null, land: {}, townSeen: {},
      stats: { earned: 0, wages: 0, shifts: {}, harvested: 0, farmPicked: 0, sold: 0, soldCoins: 0, chopped: 0, replanted: 0, planted: 0,
        interest: 0, loanInterest: 0, taxPaid: 0, votes: 0, ran: 0, won: 0, classes: 0, deposits: 0, borrowed: 0, stocked: 0, shopSales: 0, built: 0,
        companies: 0, ads: 0, coRevenue: 0, coProfit: 0, onlineSold: 0, onlineCoins: 0, listed: 0, viewCoins: 0, photos: 0, rides: 0, rideBus: 0, rideTrain: 0,
        spots: 0, trips: 0, found: {}, gifts: 0, swims: 0, sips: 0, sleeps: 0, healthy: 0, hops: 0, kicks: 0 },
    };
  }
  // fill in anything missing from older saves
  function repair(l) {
    const f = fresh(l && l.band);
    if (!l || typeof l !== 'object') return f;
    const out = { ...f, ...l };
    out.stats = { ...f.stats, ...(l.stats || {}) }; out.stats.shifts = { ...(l.stats && l.stats.shifts || {}) }; out.stats.found = { ...(l.stats && l.stats.found || {}) };
    out.bag = { ...f.bag, ...(l.bag || {}) }; out.today = { ...f.today, ...(l.today || {}) };
    ['bonus', 'count', 'hello', 'bell'].forEach(k => { if (!out.today[k] || typeof out.today[k] !== 'object') out.today[k] = {}; });
    ['rit', 'hats', 'wonders', 'land', 'townSeen'].forEach(k => { if (!out[k] || typeof out[k] !== 'object') out[k] = {}; });
    out.iou = Math.max(0, Math.round(+out.iou || 0));
    // old saves: no burst of level gifts, and no starter steps if they already play
    out.levelClaimed = typeof l.levelClaimed === 'number' ? l.levelClaimed : starLevel(out.xp);
    const oldSave = typeof l.starter !== 'number';
    out.starter = oldSave ? ((l.dream || (l.stats && l.stats.earned > 0)) ? STARTER.length : 0) : l.starter;
    // an old little-kid save: move the dream onto the new little path (finished stays finished)
    const D = DREAMS[out.dream];
    if (oldSave && out.band === 1 && D && D.little) out.dreamStep = (l.dreamStep || 0) >= D.steps.length ? D.little.length : 0;
    out.channel = { ...f.channel, ...(l.channel || {}) };
    if (!Array.isArray(out.companies)) out.companies = [];
    if (!Array.isArray(out.log)) { out.log = []; out.logSeq = 0; }
    ['coins', 'bank', 'loan'].forEach(k => { out[k] = Math.max(0, Math.round(+out[k] || 0)); });
    if (!DREAMS[out.dream]) out.dream = out.dream ? 'farmer' : null;
    return out;
  }

  const Life = { DAY, MIN, SUBJECTS, CERT_AT, JOBS, DESK_JOBS, DREAMS, FEATURED, FEATURED_BY_BAND, SHIFTS_PER_DAY, SAVE_RATE, LOAN_RATE, RENT, ENDLESS,
    RULES, rules, taxOf, grantOf, effRate, rentOf, landTaxOf, upkeepOf, seeded, stepsOf, kidBonus, dreamStar, previewBills, setBand, RITUALS, ritualState, ritualNext, doRitual,
    starLevel, starsFor, addStars, LEVEL_HATS, levelReward, claimLevels, STARTER, checkStarter, DAILY_POOL, DAILY_BY_ID, ensureDaily, dailyAdd, freshToday,
    VEHICLES, FARES, COMPANIES, MEMORIES, TRIPS, LATE_PLACES, note, company, companyDay, staffMax, upgradeCost, onlineCap, closeValue, sellVehicle, interestTomorrow, taxOn, makeVideo, remember, memCount,
    dayOf, dayFrac, hourOf, clock, hasCert, certCount, canTake, wageOf, startShift, workDone, quitShift, bank, loanLimit,
    earn, spend, addItem, takeItem, bagCount, ownedPlots, ownsHouse, shopPlot, newDay, dreamGoal, checkDream, title, fresh, repair };
  if (typeof module !== 'undefined' && module.exports) module.exports = Life; else root.Life = Life;
})(typeof window !== 'undefined' ? window : globalThis);
