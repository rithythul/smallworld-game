// Healthy play for kids: break reminders, a daily play limit, and parent settings behind a math gate.
// Everything is stored on this device, so breaks survive a page reload.
const Care = (() => {
  const KEY = 'noodle-universe-care';
  const DEFAULTS = { breakEvery: 20, breakLen: 5, daily: 60 };  // minutes; 0 = off
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  let S = { ...DEFAULTS, day: today(), played: 0, since: 0, breakUntil: 0, extra: 0, away: false };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  let el = null, mode = null, saveT = 0, tipI = 0, onAway = null;

  const TIPS = [
    '🍎 Go eat something yummy.',
    '💧 Drink a glass of real water, like Squareface does from the stream.',
    '🤸 Stretch like a long noodle: arms up, reach for the sky!',
    '👀 Look out of a window at something far away.',
    '🧹 Help someone at home for a minute. Grandma Ramen would be proud.',
    '😊 Tell someone what you found in the Noodle Universe today.',
  ];

  function fmt(sec) { sec = Math.max(0, Math.ceil(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
  function msToMidnight() { const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); return m - n; }

  function build() {
    el = document.createElement('div'); el.id = 'care'; el.hidden = true;
    el.innerHTML = `<div class="care-card" role="dialog" aria-modal="true" aria-labelledby="careTitle">
      <canvas id="careHero" width="220" height="200"></canvas>
      <h2 id="careTitle"></h2>
      <p id="careText" class="care-text"></p>
      <p id="careTip" class="care-tip"></p>
      <div class="care-count" id="careCount"></div>
      <div class="care-actions">
        <button class="big-btn small" type="button" id="careBack" hidden>I'm back! ☀</button>
        <button class="link-btn" type="button" id="careParent">For grown-ups: settings</button>
      </div>
      <form id="careGate" class="care-gate" hidden>
        <label for="careAnswer" id="careQ"></label>
        <div class="answer-row"><input id="careAnswer" inputmode="numeric" autocomplete="off"><button class="choice" type="submit">OK</button></div>
        <p class="answer-msg" id="careGateMsg"></p>
      </form>
      <div id="careSettings" class="care-settings" hidden></div>
    </div>`;
    document.getElementById('app').appendChild(el);
    el.querySelector('#careBack').addEventListener('click', () => { if (mode === 'away') end(); });
    el.querySelector('#careParent').addEventListener('click', openGate);
  }

  function openGate() {
    const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
    el.querySelector('#careQ').textContent = `Grown-ups only: what is ${a} × ${b}?`;
    const g = el.querySelector('#careGate'); g.hidden = false; g.dataset.ans = String(a * b);
    el.querySelector('#careAnswer').value = ''; el.querySelector('#careGateMsg').textContent = '';
    g.onsubmit = (e) => {
      e.preventDefault();
      if (el.querySelector('#careAnswer').value.trim() === g.dataset.ans) { g.hidden = true; showSettings(); }
      else el.querySelector('#careGateMsg').textContent = 'Not quite. Ask a grown-up!';
    };
    el.querySelector('#careAnswer').focus();
  }

  function showSettings() {
    const box = el.querySelector('#careSettings'); box.hidden = false;
    const sel = (id, label, vals, cur, unit) => `<label class="care-row" for="${id}"><span>${label}</span><select id="${id}">${vals.map(v => `<option value="${v}"${v === cur ? ' selected' : ''}>${v ? v + ' ' + unit : 'Off'}</option>`).join('')}</select></label>`;
    box.innerHTML = `<h3>Grown-up settings</h3>
      ${sel('cBreakEvery', 'Break after', [15, 20, 30, 45, 0], S.breakEvery, 'min of play')}
      ${sel('cBreakLen', 'Break length', [3, 5, 10, 15], S.breakLen, 'min')}
      ${sel('cDaily', 'Play time per day', [30, 45, 60, 90, 120, 0], S.daily, 'min')}
      <p class="sheet-sub">Played today: ${Math.round(S.played / 60)} min. Settings are saved on this device.</p>
      <div class="answer-row"><button class="choice" type="button" id="cSave">Save</button>
      ${mode === 'break' ? '<button class="choice alt" type="button" id="cSkip">Skip this break</button>' : ''}
      ${mode === 'done' ? '<button class="choice alt" type="button" id="cMore">Allow 15 more minutes</button>' : ''}</div>`;
    box.querySelector('#cSave').addEventListener('click', () => {
      S.breakEvery = +box.querySelector('#cBreakEvery').value; S.breakLen = +box.querySelector('#cBreakLen').value; S.daily = +box.querySelector('#cDaily').value;
      save(); box.hidden = true;
      if (mode === 'done' && (!S.daily || S.played < (S.daily + S.extra) * 60)) end();
    });
    const skip = box.querySelector('#cSkip'); if (skip) skip.addEventListener('click', () => { S.breakUntil = 0; S.since = 0; save(); end(); });
    const more = box.querySelector('#cMore'); if (more) more.addEventListener('click', () => { S.extra += 15; save(); end(); });
  }

  function show(newMode) {
    if (!el) build();
    mode = newMode; el.hidden = false; tipI = Math.floor(Math.random() * TIPS.length);
    el.querySelector('#careGate').hidden = true; el.querySelector('#careSettings').hidden = true;
    el.querySelector('#careBack').hidden = newMode !== 'away';
    const t = el.querySelector('#careTitle'), p = el.querySelector('#careText');
    if (newMode === 'break') { t.textContent = 'Break time! 😴'; p.textContent = `You played for ${S.breakEvery} minutes. Squareface needs a rest, and so do you!`; }
    if (newMode === 'done') { t.textContent = 'That\'s all for today! 🌙'; p.textContent = 'Squareface is recharging for tomorrow. The Noodle Universe will be waiting, and the Udon Snail keeps walking while you sleep.'; }
    if (newMode === 'away') { t.textContent = 'Enjoy your meal! 🍽️'; p.textContent = 'Your game is paused. In a team room, your friends see that you are away, and every brick they crunch earns you a thank-you coin.'; }
    if (onAway) onAway(true);
    tick(0);
  }
  function end() {
    el.hidden = true; mode = null; S.breakUntil = 0; save();
    if (onAway) onAway(false);
  }

  let heroT = 0;
  function drawHero(dt) {
    heroT += dt;
    const c = el.querySelector('#careHero').getContext('2d');
    c.clearRect(0, 0, 220, 200);
    c.save(); c.translate(110, 140); c.scale(1.8, 1.8);  // antenna tip stays inside the canvas
    const bob = Math.sin(heroT * 1.5) * 1.5;
    rr(c, -15, 4 - bob, 30, 26, 10); fillStroke(c, '#2fa4b5', 3);
    drawHead(c, 0, -20 - bob, mode === 'away' ? 'happy' : 'sleepy', heroT, {});
    c.restore();
    c.font = '800 22px "Baloo 2", sans-serif'; c.fillStyle = '#b98cff';
    if (mode !== 'away') for (let i = 0; i < 3; i++) { const k = (heroT * 0.5 + i / 3) % 1; c.globalAlpha = 1 - k; c.fillText('z', 150 + k * 30, 60 - k * 40 - i * 4); }
    c.globalAlpha = 1;
  }

  // Called every frame while playing. Returns true when play is paused.
  function tick(dt) {
    if (S.day !== today()) { S.day = today(); S.played = 0; S.extra = 0; }
    if (mode) {
      if (el.hidden) el.hidden = false;
      const cnt = el.querySelector('#careCount');
      if (mode === 'break') {
        const left = (S.breakUntil - Date.now()) / 1000;
        cnt.textContent = left > 0 ? `Back in ${fmt(left)}` : '';
        if (left <= 0) end();
      } else if (mode === 'done') {
        if (S.day !== S.doneDay) { end(); return false; }
        cnt.textContent = `New play time in ${fmt(msToMidnight() / 1000)}`;
      } else cnt.textContent = '';
      tipI += dt / 6;
      el.querySelector('#careTip').textContent = mode === 'away' ? '' : TIPS[Math.floor(tipI) % TIPS.length];
      drawHero(dt);
      return true;
    }
    if (S.breakUntil > Date.now()) { show('break'); return true; }
    if (document.hidden) return false;
    S.played += dt; S.since += dt;
    saveT -= dt; if (saveT <= 0) { saveT = 5; save(); }
    if (S.daily && S.played >= (S.daily + S.extra) * 60) { S.doneDay = S.day; save(); show('done'); return true; }
    if (S.breakEvery && S.since >= S.breakEvery * 60) {
      S.since = 0; S.breakUntil = Date.now() + S.breakLen * 60000; save(); show('break'); return true;
    }
    return false;
  }

  return {
    tick,
    goAway() { show('away'); },
    onAway(fn) { onAway = fn; },
    minutesLeftToday() { return S.daily ? Math.max(0, Math.round((S.daily + S.extra) * 60 - S.played) / 60) : Infinity; },
    get locked() { return !!mode; },
  };
})();
