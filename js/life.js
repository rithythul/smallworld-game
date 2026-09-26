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
    lumberjack: { name: 'Lumberjack', icon: '🪓', wage: 15, tasks: 4, place: 'forest', how: 'Chop 2 trees and plant 2 saplings. Cut one, plant one!' },
    mail: { name: 'Mail Carrier', icon: '✉️', wage: 14, tasks: 3, place: 'town', how: 'Take 3 letters to the doors on your list.' },
    builder: { name: 'Builder', icon: '👷', wage: 20, tasks: 3, place: 'lots', needs: ['tools'], how: 'Hammer 3 wooden frames at the building sites.' },
    clerk: { name: 'Town Clerk', icon: '📋', wage: 20, tasks: 3, place: 'hall', needs: ['civics'], how: 'Answer 3 citizens\' questions at the Town Hall desk.' },
    teller: { name: 'Bank Teller', icon: '🏦', wage: 22, tasks: 3, place: 'bank', needs: ['money'], how: 'Help 3 customers with their money at the bank.' },
    tutor: { name: 'Tutor', icon: '🍎', wage: 26, tasks: 3, place: 'school', needs: 3, how: 'Help 3 students with their homework at the school.' },
  };
  const DESK_JOBS = { clerk: 'civics', teller: 'money', tutor: 'any' };
  function canTake(life, id) {
    const j = JOBS[id]; if (!j) return { ok: false, why: 'No such job.' };
    if (typeof j.needs === 'number') {
      if (certCount(life) < j.needs) return { ok: false, why: `Needs ${j.needs} school certificates (you have ${certCount(life)}).` };
    } else if (j.needs) {
      const miss = j.needs.filter(s => !hasCert(life, s));
      if (miss.length) return { ok: false, why: `Needs the ${miss.map(s => SUBJECTS[s].cert).join(' and ')} certificate from the school.` };
    }
    return { ok: true };
  }
  const SHIFTS_PER_DAY = 3;
  // experience pays: +10% for every 3 shifts in the same job, up to +50%
  const wageOf = (life, id) => Math.round(JOBS[id].wage * (1 + 0.1 * Math.min(5, Math.floor((life.stats.shifts[id] || 0) / 3))));
  function startShift(life, id, targets) {
    const c = canTake(life, id); if (!c.ok) return c;
    if (life.shiftsToday >= SHIFTS_PER_DAY) return { ok: false, why: `You worked ${SHIFTS_PER_DAY} shifts today. Rest! A new day starts soon.` };
    life.job = id;
    life.shift = { job: id, need: JOBS[id].tasks, done: 0, targets: targets || [] };
    return { ok: true };
  }
  // one task finished. Returns the paycheck when the shift is done.
  function workDone(life, taxRate, target) {
    const s = life.shift; if (!s) return null;
    if (target !== undefined) s.targets = s.targets.filter(t => t !== target);
    s.done++;
    if (s.done < s.need) return { done: false, left: s.need - s.done };
    const gross = wageOf(life, s.job), tax = Math.round(gross * (taxRate || 0) / 100), net = gross - tax;
    life.coins += net; life.shift = null; life.shiftsToday++;
    life.stats.shifts[s.job] = (life.stats.shifts[s.job] || 0) + 1;
    life.stats.wages += net; life.stats.earned += net; life.stats.taxPaid += tax; life.today.earned += net; life.today.tax += tax;
    life.rep += 1;
    const raise = (life.stats.shifts[s.job] % 3 === 0) && life.stats.shifts[s.job] <= 15;
    return { done: true, job: s.job, gross, tax, net, rate: taxRate || 0, raise, next: wageOf(life, s.job) };
  }
  const quitShift = (life) => { life.shift = null; };

  /* ---------------- the bank ---------------- */
  const SAVE_RATE = 2, LOAN_RATE = 5;          // percent per day
  const loanLimit = (life, owned) => Math.min(400, 60 + 30 * certCount(life) + 40 * (owned || 0));
  function bank(life, what, n, owned) {
    n = Math.floor(n);
    if (!(n > 0)) return { ok: false, why: 'Pick an amount.' };
    if (what === 'deposit') { if (n > life.coins) return { ok: false, why: 'You do not have that many coins.' }; life.coins -= n; life.bank += n; life.stats.deposits += n; return { ok: true }; }
    if (what === 'withdraw') { if (n > life.bank) return { ok: false, why: 'Your savings are smaller than that.' }; life.bank -= n; life.coins += n; return { ok: true }; }
    if (what === 'borrow') { if (life.loan + n > loanLimit(life, owned)) return { ok: false, why: `The bank lends you up to ${loanLimit(life, owned)} coins in total.` }; life.loan += n; life.coins += n; life.stats.borrowed += n; return { ok: true }; }
    if (what === 'repay') { n = Math.min(n, life.loan); if (!n) return { ok: false, why: 'You do not owe anything!' }; if (n > life.coins) return { ok: false, why: 'You do not have that many coins.' }; life.loan -= n; life.coins -= n; return { ok: true }; }
    return { ok: false, why: '?' };
  }

  /* ---------------- money helpers ---------------- */
  function earn(life, n, kind) {
    n = Math.round(n); if (!n) return;
    life.coins += n; life.stats.earned += n; life.today.earned += n;
    if (kind) life.stats[kind] = (life.stats[kind] || 0) + n;
  }
  function spend(life, n) {
    n = Math.round(n);
    if (n > life.coins) return false;
    life.coins -= n; life.today.spent += n; return true;
  }
  const addItem = (life, g, n = 1) => { life.bag[g] = (life.bag[g] || 0) + n; };
  const takeItem = (life, g, n = 1) => { if ((life.bag[g] || 0) < n) return false; life.bag[g] -= n; return true; };
  const bagCount = (life) => Object.values(life.bag).reduce((a, b) => a + b, 0);

  /* ---------------- homes and plots ---------------- */
  const RENT = Town ? Town.RENT : 5;
  const ownedPlots = (town, uid) => town ? Object.entries(town.plots).filter(([, p]) => p.owner === uid).map(([id, p]) => ({ id, ...p, plot: Town.PLOT_BY_ID[id] })) : [];
  const ownsHouse = (town, uid) => ownedPlots(town, uid).some(p => p.build === 'house');
  const shopPlot = (town, uid) => ownedPlots(town, uid).find(p => p.build === 'shop');

  /* ---------------- a new day: the morning budget ---------------- */
  // Bills are paid automatically each morning. If there are not enough coins, the bank lends the rest
  // (so nothing scary happens, but the loan costs interest). Only one day is charged, even after a long break.
  function newDay(life, town, uid, day) {
    if (life.day === day) return null;
    const first = life.day === null;
    const lines = [];
    const yesterday = { ...life.today };
    life.day = day; life.shiftsToday = 0; life.today = { earned: 0, spent: 0, tax: 0 };
    if (first) return null;
    const plots = ownedPlots(town, uid);
    // income first
    if (life.bank >= 10) { const i = Math.max(1, Math.floor(life.bank * SAVE_RATE / 100)); life.bank += i; life.stats.interest += i; life.stats.earned += i; lines.push({ label: `🏦 Savings interest (${SAVE_RATE}%)`, n: i }); }
    const shop = shopPlot(town, uid);
    if (shop && town) {
      let sold = 0, coins = 0;
      for (const g of Object.keys(life.shelf)) {
        while (life.shelf[g] > 0 && sold < 5) { life.shelf[g]--; sold++; coins += Town.price(town, g) + 3; }
      }
      if (sold) { life.coins += coins; life.stats.shopSales += coins; life.stats.earned += coins; lines.push({ label: `🏪 Your shop sold ${sold} things`, n: coins }); }
      else lines.push({ label: '🏪 Your shop shelf was empty: no sales', n: 0 });
    }
    // then the bills
    let bills = 0, taxes = 0;
    if (!ownsHouse(town, uid)) {
      if (life.rentFree > 0) { life.rentFree--; lines.push({ label: `🏢 Apartment rent (free for newcomers, ${life.rentFree} free days left)`, n: 0 }); }
      else { bills += RENT; lines.push({ label: '🏢 Apartment rent', n: -RENT }); }
    }
    plots.forEach(p => { const t = Town.TAX[p.plot.kind]; taxes += t; lines.push({ label: `🏛️ Land tax for ${p.id} (goes to the town)`, n: -t }); });
    if (life.loan > 0) { const i = Math.max(1, Math.ceil(life.loan * LOAN_RATE / 100)); life.loan += i; lines.push({ label: `💸 Loan interest (${LOAN_RATE}%) added to your loan`, n: 0, note: `+${i} owed` }); life.stats.loanInterest += i; }
    const due = bills + taxes;
    let borrowed = 0;
    if (due > life.coins) { borrowed = due - life.coins; life.loan += borrowed; life.coins = due; }
    life.coins -= due;
    life.stats.taxPaid += taxes; if (taxes) life.rep += 1;
    return { day, lines, due, taxes, borrowed, yesterday, coins: life.coins, bank: life.bank, loan: life.loan };
  }

  /* ---------------- dreams ---------------- */
  const S = (l) => l.stats;
  const DREAMS = {
    farmer: { name: 'Farmer', icon: '🌾', title: 'Farmer', desc: 'Grow food on your own land and sell it at the market.', steps: [
      ['Work one Farmhand shift (Jobs office)', (l) => (S(l).shifts.farmhand || 0) >= 1],
      ['Sell something at the Market', (l) => S(l).sold >= 1],
      ['Buy your own farm land', (l, c) => c.plots.some(p => p.plot.kind === 'farm')],
      ['Harvest 6 crops from your farm', (l) => S(l).harvested >= 6],
      ['Earn 150 coins selling at the market', (l) => S(l).soldCoins >= 150],
      ['Own 2 farms', (l, c) => c.plots.filter(p => p.plot.kind === 'farm').length >= 2],
    ] },
    builder: { name: 'Builder', icon: '🔨', title: 'Builder', desc: 'Cut logs, learn to build, and build houses and shops.', steps: [
      ['Chop a tree in the Town Forest', (l) => S(l).chopped >= 1],
      ['Plant a sapling on a stump', (l) => S(l).replanted >= 1],
      ['Earn the Builder Basics certificate (School)', (l) => hasCert(l, 'tools')],
      ['Work one Builder shift', (l) => (S(l).shifts.builder || 0) >= 1],
      ['Buy a building lot', (l, c) => c.plots.some(p => p.plot.kind === 'lot')],
      ['Build a house', (l, c) => c.plots.some(p => p.build === 'house')],
      ['Build a shop', (l, c) => c.plots.some(p => p.build === 'shop')],
    ] },
    shopkeeper: { name: 'Shopkeeper', icon: '🏪', title: 'Shopkeeper', desc: 'Run a shop: buy low, sell high, earn a profit.', steps: [
      ['Sell something at the Market', (l) => S(l).sold >= 1],
      ['Earn the Money Smarts certificate (School)', (l) => hasCert(l, 'money')],
      ['Save 100 coins', (l) => l.coins + l.bank >= 100],
      ['Buy a building lot', (l, c) => c.plots.some(p => p.plot.kind === 'lot')],
      ['Build a shop', (l, c) => c.plots.some(p => p.build === 'shop')],
      ['Put 5 things on your shop shelf', (l) => S(l).stocked >= 5],
      ['Earn 80 coins of shop sales', (l) => S(l).shopSales >= 80],
    ] },
    mayor: { name: 'Mayor', icon: '🏛️', title: 'Mayor', desc: 'Lead the town: people vote for you, you decide what it builds.', steps: [
      ['Vote for a town project (Town Hall)', (l) => S(l).votes >= 1],
      ['Earn the Good Citizen certificate (School)', (l) => hasCert(l, 'civics')],
      ['Work one Town Clerk shift', (l) => (S(l).shifts.clerk || 0) >= 1],
      ['Pay 10 coins of taxes', (l) => S(l).taxPaid >= 10],
      ['Earn 20 reputation (help the town)', (l) => l.rep >= 20],
      ['Run for mayor (Town Hall)', (l) => S(l).ran >= 1],
      ['Win an election', (l) => S(l).won >= 1],
    ] },
    banker: { name: 'Banker', icon: '🏦', title: 'Banker', desc: 'Make money work: save, lend and understand interest.', steps: [
      ['Put coins in a savings account (Bank)', (l) => S(l).deposits >= 1],
      ['Earn the Money Smarts certificate (School)', (l) => hasCert(l, 'money')],
      ['Work one Bank Teller shift', (l) => (S(l).shifts.teller || 0) >= 1],
      ['Earn 5 coins of interest', (l) => S(l).interest >= 5],
      ['Have 150 coins in the bank', (l) => l.bank >= 150],
      ['Work 5 Bank Teller shifts', (l) => (S(l).shifts.teller || 0) >= 5],
    ] },
    teacher: { name: 'Teacher', icon: '🍎', title: 'Teacher', desc: 'Learn everything you can, then help others learn.', steps: [
      ['Take a class at the School', (l) => S(l).classes >= 1],
      ['Earn 1 certificate', (l) => certCount(l) >= 1],
      ['Earn 3 certificates', (l) => certCount(l) >= 3],
      ['Work one Tutor shift', (l) => (S(l).shifts.tutor || 0) >= 1],
      ['Earn all 5 certificates', (l) => certCount(l) >= 5],
      ['Work 5 Tutor shifts', (l) => (S(l).shifts.tutor || 0) >= 5],
    ] },
  };
  // After the steps, the dream keeps going forever: every 120 coins earned is one more level.
  const ENDLESS = 120;
  function dreamGoal(life) {
    const d = DREAMS[life.dream]; if (!d) return null;
    if (life.dreamStep < d.steps.length) return { text: d.steps[life.dreamStep][0], i: life.dreamStep, of: d.steps.length };
    const got = life.stats.earned - life.dreamMark;
    return { text: `Level ${life.dreamLv + 1}: earn ${ENDLESS} more coins (${Math.min(ENDLESS, got)}/${ENDLESS})`, i: life.dreamStep, of: null, endless: true };
  }
  // ctx = { plots } (your land in this town). Returns the steps finished just now.
  function checkDream(life, ctx) {
    const d = DREAMS[life.dream]; if (!d) return [];
    const done = [];
    while (life.dreamStep < d.steps.length && d.steps[life.dreamStep][1](life, ctx)) {
      done.push(d.steps[life.dreamStep][0]); life.dreamStep++; life.dreamLv++;
      if (life.dreamStep === d.steps.length) life.dreamMark = life.stats.earned;
    }
    if (life.dreamStep >= d.steps.length && life.stats.earned - life.dreamMark >= ENDLESS) {
      life.dreamLv++; life.dreamMark = life.stats.earned; done.push(`Level ${life.dreamLv}`);
    }
    return done;
  }
  function title(life) {
    const d = DREAMS[life.dream]; if (!d) return 'Newcomer';
    return `${d.icon} ${d.title}${life.dreamLv ? ' ★' + life.dreamLv : ''}`;
  }

  /* ---------------- a new life ---------------- */
  function fresh(band) {
    return {
      v: 1, coins: 30, bank: 0, loan: 0, band: clamp(band | 0, 1, 3) || 2,
      bag: { wheat: 0, carrot: 0, tomato: 0, corn: 0, log: 0 }, shelf: {},
      school: {}, job: null, shift: null, shiftsToday: 0, day: null, today: { earned: 0, spent: 0, tax: 0 },
      dream: null, dreamStep: 0, dreamLv: 0, dreamMark: 0, rentFree: 3, rep: 0, owesSapling: 0, seen: {},
      stats: { earned: 0, wages: 0, shifts: {}, harvested: 0, farmPicked: 0, sold: 0, soldCoins: 0, chopped: 0, replanted: 0, planted: 0,
        interest: 0, loanInterest: 0, taxPaid: 0, votes: 0, ran: 0, won: 0, classes: 0, deposits: 0, borrowed: 0, stocked: 0, shopSales: 0, built: 0 },
    };
  }
  // fill in anything missing from older saves
  function repair(l) {
    const f = fresh(l && l.band);
    if (!l || typeof l !== 'object') return f;
    const out = { ...f, ...l };
    out.stats = { ...f.stats, ...(l.stats || {}) }; out.stats.shifts = { ...(l.stats && l.stats.shifts || {}) };
    out.bag = { ...f.bag, ...(l.bag || {}) }; out.today = { ...f.today, ...(l.today || {}) };
    ['coins', 'bank', 'loan'].forEach(k => { out[k] = Math.max(0, Math.round(+out[k] || 0)); });
    return out;
  }

  const Life = { DAY, MIN, SUBJECTS, CERT_AT, JOBS, DESK_JOBS, DREAMS, SHIFTS_PER_DAY, SAVE_RATE, LOAN_RATE, RENT, ENDLESS,
    dayOf, dayFrac, hourOf, clock, hasCert, certCount, canTake, wageOf, startShift, workDone, quitShift, bank, loanLimit,
    earn, spend, addItem, takeItem, bagCount, ownedPlots, ownsHouse, shopPlot, newDay, dreamGoal, checkDream, title, fresh, repair };
  if (typeof module !== 'undefined' && module.exports) module.exports = Life; else root.Life = Life;
})(typeof window !== 'undefined' ? window : globalThis);
