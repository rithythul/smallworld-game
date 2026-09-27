// Plain Node tests for the Small World rules: node test/life.test.js
// The big promise: a 6-year-old (band 1) only ever sees coins go down when they tap Buy.
const assert = require('assert');
const Town = require('../js/town.js');
const Life = require('../js/life.js');
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { console.error('✗ ' + name + '\n  ' + e.message); process.exitCode = 1; } };
const DAYMS = Life.DAY, at = (day, hour) => day * DAYMS + ((hour - 6) / 17) * DAYMS;
const rnd = Life.seeded(42);

test('band 1: 30 days of play, coins only go down on purchases, no debts', () => {
  const town = Town.newTown(0), life = Life.fresh(1); life.day = 1;
  for (let day = 2; day < 32; day++) {
    const r = Life.newDay(life, town, 'u', day);
    assert(r, 'a morning happens');
    r.lines.forEach(l => assert(l.acct === 'loan' || l.n >= 0 || l.move, `band 1 morning line is not negative: ${l.label} ${l.n}`));
    assert.strictEqual(r.borrowed, 0); assert.strictEqual(r.owed, 0);
    for (let k = 0; k < 4; k++) {
      const x = rnd();
      if (x < 0.3) { Life.startShift(life, 'farmhand', [], town); while (life.shift) Life.workDone(life, town.taxRate); }
      else if (x < 0.4) { Life.startShift(life, 'mail', [], town); Life.workDone(life, 10); Life.quitShift(life, 10); }
      else if (x < 0.55) Life.spend(life, 7, '🌱', 'Seeds');
      else if (x < 0.7) Life.bank(life, 'deposit', 5);
      else if (x < 0.8) Life.bank(life, 'borrow', 20);
      else if (x < 0.9) Life.bank(life, 'withdraw', 3);
      else { life.vehicles.car = 1; }
    }
  }
  life.log.filter(e => e.acct === 'pocket' && e.n < 0).forEach(e => assert(e.buy || e.move, `unflagged drop: ${e.why} ${e.n}`));
  assert.strictEqual(life.loan, 0); assert.strictEqual(life.iou, 0);
});

test('band 1: every task pays at once and adds up to the wage, no tax', () => {
  const town = Town.newTown(0), life = Life.fresh(1); life.day = 1;
  Life.startShift(life, 'farmhand', [], town);
  const a = Life.workDone(life, 10), b = Life.workDone(life, 10), c = Life.workDone(life, 10);
  assert.deepStrictEqual([a.step, b.step, c.step], [4, 4, 4]);
  assert.strictEqual(c.done, true); assert.strictEqual(c.tax, 0); assert.strictEqual(c.grant, 1);
  Life.startShift(life, 'lumberjack', [], town);
  let sum = 0, p; do { p = Life.workDone(life, 10); sum += p.step; } while (!p.done);
  assert.strictEqual(sum, Life.wageOf(life, 'lumberjack'));
});

test('band 2/3: stopping after 2 of 3 pays for the finished tasks', () => {
  [2, 3].forEach(b => {
    const town = Town.newTown(0), life = Life.fresh(b); life.day = 1;
    Life.startShift(life, 'mail', [], town); Life.workDone(life, 10); Life.workDone(life, 10);
    const c0 = life.coins, r = Life.quitShift(life, 10);
    const gross = Math.floor(14 * 2 / 3);
    assert.strictEqual(r.net, gross - Life.taxOf(life, gross, 10));
    assert.strictEqual(life.coins - c0, r.net);
    assert(life.log.some(e => /Paid for 2 of 3 tasks/.test(e.why)));
  });
});

test('band 2: short pocket → savings first, then a no-interest IOU paid next morning; never a loan', () => {
  const town = Town.newTown(0), life = Life.fresh(2); life.day = 1; life.rentFree = 0; life.coins = 1; life.bank = 1;
  life.vehicles.car = 1;   // half upkeep: 1
  const r = Life.newDay(life, town, 'u', 2);   // rent 3 + car 1 = 4; pocket 1, savings 1 (+interest 0) → owe 2
  assert.strictEqual(life.loan, 0);
  assert(r.fromSavings >= 1); assert(life.iou > 0, 'owes an IOU');
  const owe = life.iou; Life.earn(life, 20, null, '🧪', 'test');
  Life.newDay(life, town, 'u', 3);
  assert(life.iou < owe || life.iou === 0, 'IOU paid first'); assert.strictEqual(life.loan, 0);
});

test('band 2 tax: 12 at 10% keeps 12, 20 at 10% pays 1', () => {
  const life = Life.fresh(2);
  assert.strictEqual(Life.taxOf(life, 12, 10), 0); assert.strictEqual(Life.taxOf(life, 20, 10), 1);
});

test('band 3 keeps the real rules: rent, loans with interest', () => {
  const town = Town.newTown(0), life = Life.fresh(3); life.day = 1; life.rentFree = 0; life.coins = 0;
  Life.newDay(life, town, 'u', 2); assert.strictEqual(life.loan, 5);
  Life.newDay(life, town, 'u', 3); assert(life.loan >= 10, 'rent borrowed again'); assert(life.loanFrac > 0 || life.loan > 10, 'interest counted');
});

test('rituals: windows by band, the welcome swim, once a day, Healthy Day', () => {
  const b1 = Life.fresh(1), b3 = Life.fresh(3);
  b1.stats.swims = 1; b3.stats.swims = 1;
  assert.strictEqual(Life.ritualState(b1, 'swim', at(5, 5.99 + 0.02)), 'open');
  assert.strictEqual(Life.ritualState(b1, 'swim', at(5, 9.9)), 'open');
  assert.strictEqual(Life.ritualState(b1, 'swim', at(5, 10.1)), 'past');
  assert.strictEqual(Life.ritualState(b3, 'swim', at(5, 7.9)), 'open');
  assert.strictEqual(Life.ritualState(b3, 'swim', at(5, 8.1)), 'past');
  const kid = Life.fresh(1);
  assert.strictEqual(Life.ritualState(kid, 'swim', at(5, 21)), 'open', 'first swim counts at any hour');
  const l = Life.fresh(1); l.day = 5;
  assert(Life.doRitual(l, 'swim', at(5, 7))); assert.strictEqual(Life.doRitual(l, 'swim', at(5, 8)), null, 'once a day');
  assert(Life.doRitual(l, 'sip', at(5, 17)));
  const last = Life.doRitual(l, 'sleep', at(5, 21)); assert(last.healthy);
});

test('stars: levels and gifts once each', () => {
  assert.deepStrictEqual([2, 3, 12, 27, 48].map(Life.starLevel), [1, 2, 3, 4, 5]);
  const l = Life.fresh(1); l.day = 1; l.xp = 27; const c0 = l.coins;
  const got = Life.claimLevels(l); assert.deepStrictEqual(got.map(g => g.L), [2, 3, 4]);
  assert.strictEqual(l.hat, 'flower'); assert.strictEqual(l.coins - c0, 10 + 20);
  assert.strictEqual(Life.claimLevels(l).length, 0);
});

test('daily challenges: the same for friends, goals by band, Perfect Day once', () => {
  const a = Life.fresh(1), b = Life.fresh(1), c = Life.fresh(3); [a, b, c].forEach(l => { l.day = 9; });
  const ctx = { plots: [] };
  assert.deepStrictEqual(Life.ensureDaily(a, 9, ctx).list.map(x => x.id), Life.ensureDaily(b, 9, ctx).list.map(x => x.id));
  const d = Life.ensureDaily(c, 9, ctx); assert.strictEqual(d.list.length, 3);
  let perfect = 0; a.daily.list.forEach(x => { const r = Life.dailyAdd(a, x.id, 50); if (r.perfect) perfect++; });
  assert.strictEqual(perfect, 1); assert.strictEqual(a.perfectDays, 1);
  assert.strictEqual(Life.dailyAdd(a, a.daily.list[0].id, 5).perfect, false);
});

test('repair: old saves get no burst of gifts and skip the starter', () => {
  const old = Life.fresh(2); delete old.levelClaimed; delete old.starter; old.xp = 60; old.dream = 'farmer';
  const r = Life.repair(JSON.parse(JSON.stringify(old)));
  assert.strictEqual(r.levelClaimed, 5); assert.strictEqual(r.starter, 4); assert.strictEqual(Life.claimLevels(r).length, 0);
});

test('setBand: to 1 forgives the loan, to 2 turns it into an IOU', () => {
  const l = Life.fresh(3); l.loan = 30; Life.setBand(l, 2); assert.strictEqual(l.loan, 0); assert.strictEqual(l.iou, 30);
  Life.setBand(l, 1); assert.strictEqual(l.iou, 0);
});

test('town: the pool, wonders and kid bonuses', () => {
  assert(Town.inPool(4000, 2420)); assert(!Town.inPool(4040, 2230));
  const t = 123456789; assert.deepStrictEqual(Town.wonderAt(t), Town.wonderAt(t));
  const l = Life.fresh(1); let got = 0; for (let i = 0; i < 40; i++) got += Life.kidBonus(l, 'trail', 1, '✨', 'Trail'); assert.strictEqual(got, 15);
});

test('market prices come back when nobody sells, even with frequent checks', () => {
  const t = Town.newTown(0); t.stock.corn = 40;
  for (let ms = 0; ms <= 10 * 60000; ms += 10000) Town.settle(t, ms);
  assert(t.stock.corn < 25, 'corn stock drifted back toward normal: ' + t.stock.corn.toFixed(1));
});

console.log(`${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
