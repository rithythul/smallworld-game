// Healthy play for kids: break reminders, a daily play limit, and parent settings behind a math gate.
// Everything is stored on this device, so breaks survive a page reload.
const Care = (() => {
  const KEY = 'noodle-universe-care';
  const DEFAULTS = { breakEvery: 20, breakLen: 5, daily: 60, chat: 'on', voice: 'ask' };  // minutes; 0 = off. chat: on | phrases | off; voice: ask | on | off
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  let S = { ...DEFAULTS, day: today(), played: 0, since: 0, breakUntil: 0, extra: 0, away: false };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  let el = null, mode = null, saveT = 0, tipI = 0, onAway = null;

  const TIPS = [
    '🍎 Go eat something yummy.',
    '💧 Drink a glass of real water.',
    '🤸 Stretch like a long noodle: arms up, reach for the sky!',
    '👀 Look out of a window at something far away.',
    '🧹 Help someone at home for a minute. Real-life reputation points!',
    '😊 Tell someone what you did in the game today.',
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
        <button class="big-btn small" type="button" id="careClose" hidden>Back to the game</button>
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
    el.querySelector('#careParent').addEventListener('click', () => openGate());
    el.querySelector('#careClose').addEventListener('click', () => { if (mode === 'grown') end(); });
  }

  function inWords(n) {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const under100 = (x) => x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? '-' + ones[x % 10] : '');
    const th = Math.floor(n / 1000), h = Math.floor(n / 100) % 10, r = n % 100;
    return [ones[th] + ' thousand', h ? ones[h] + ' hundred' : '', r ? under100(r) : ''].filter(Boolean).join(' ');
  }
  function openGate(onPass) {
    const n = 1000 + Math.floor(Math.random() * 9000);
    el.querySelector('#careQ').textContent = `Grown-ups only: type this number in digits: ${inWords(n)}.`;
    const g = el.querySelector('#careGate'); g.hidden = false; g.dataset.ans = String(n);
    el.querySelector('#careAnswer').value = ''; el.querySelector('#careGateMsg').textContent = '';
    g.onsubmit = (e) => {
      e.preventDefault();
      if (el.querySelector('#careAnswer').value.trim() === g.dataset.ans) { g.hidden = true; if (onPass) { end(); onPass(); } else showSettings(); }
      else el.querySelector('#careGateMsg').textContent = 'Not quite. Ask a grown-up!';
    };
    el.querySelector('#careAnswer').focus();
  }

  function showSettings() {
    const box = el.querySelector('#careSettings'); box.hidden = false;
    const sel = (id, label, vals, cur, unit) => `<label class="care-row" for="${id}"><span>${label}</span><select id="${id}">${vals.map(v => `<option value="${v}"${v === cur ? ' selected' : ''}>${v ? v + ' ' + unit : 'Off'}</option>`).join('')}</select></label>`;
    const pick = (id, label, opts, cur) => `<label class="care-row" for="${id}"><span>${label}</span><select id="${id}">${opts.map(([v, t]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
    box.innerHTML = `<h3>Grown-up settings</h3>
      ${sel('cBreakEvery', 'Break after', [15, 20, 30, 45, 0], S.breakEvery, 'min of play')}
      ${sel('cBreakLen', 'Break length', [3, 5, 10, 15], S.breakLen, 'min')}
      ${sel('cDaily', 'Play time per day', [30, 45, 60, 90, 120, 0], S.daily, 'min')}
      ${pick('cChat', 'Room chat', [['on', 'Typing + quick phrases'], ['phrases', 'Quick phrases only'], ['off', 'Off']], S.chat)}
      ${pick('cVoice', 'Voice chat', [['ask', 'Ask a grown-up first'], ['on', 'Allowed'], ['off', 'Off']], S.voice)}
      <p class="sheet-sub">Chat only reaches players in the same room. Bad words, links and phone numbers are hidden, and nothing is recorded. Kids can hide any player.</p>
      <p class="sheet-sub">Played today: ${Math.round(S.played / 60)} min. Settings are saved on this device.</p>
      <div class="answer-row"><button class="choice" type="button" id="cSave">Save</button>
      ${mode === 'break' ? '<button class="choice alt" type="button" id="cSkip">Skip this break</button>' : ''}
      ${mode === 'done' ? '<button class="choice alt" type="button" id="cMore">Allow 15 more minutes</button>' : ''}</div>`;
    box.querySelector('#cSave').addEventListener('click', () => {
      S.breakEvery = +box.querySelector('#cBreakEvery').value; S.breakLen = +box.querySelector('#cBreakLen').value; S.daily = +box.querySelector('#cDaily').value;
      S.chat = box.querySelector('#cChat').value; S.voice = box.querySelector('#cVoice').value;
      if (onSettings) onSettings(S);
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
    el.querySelector('#careClose').hidden = newMode !== 'grown';
    el.querySelector('#careParent').hidden = newMode === 'grown';
    const t = el.querySelector('#careTitle'), p = el.querySelector('#careText');
    if (newMode === 'break') { t.textContent = 'Break time! 😴'; p.textContent = `You played for ${S.breakEvery} minutes. Squareface needs a rest, and so do you!`; }
    if (newMode === 'done') { t.textContent = 'That\'s all for today! 🌙'; p.textContent = 'Squareface is recharging for tomorrow. Your world will be waiting for you.'; }
    if (newMode === 'away') { t.textContent = 'Enjoy your meal! 🍽️'; p.textContent = 'Your game is paused. In a room with friends, they see that you are away.'; }
    if (newMode === 'grown') { t.textContent = 'Grown-ups only 🔒'; p.textContent = ''; }
    else if (onAway) onAway(true);
    tick(0);
  }
  function end() {
    const was = mode;
    el.hidden = true; mode = null; if (was !== 'grown') S.breakUntil = 0; save();
    if (onAway && was !== 'grown') onAway(false);
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
    if (mode !== 'away' && mode !== 'grown') for (let i = 0; i < 3; i++) { const k = (heroT * 0.5 + i / 3) % 1; c.globalAlpha = 1 - k; c.fillText('z', 150 + k * 30, 60 - k * 40 - i * 4); }
    c.globalAlpha = 1;
  }

  // Called every frame while playing. Returns true when play is paused.
  let warned = 0, onWarn = null, onSettings = null;
  function tick(dt, canBreak = true) {
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
      el.querySelector('#careTip').textContent = mode === 'away' || mode === 'grown' ? '' : TIPS[Math.floor(tipI) % TIPS.length];
      drawHero(dt);
      return true;
    }
    if (S.breakUntil > Date.now()) { show('break'); return true; }
    if (document.hidden) return false;
    S.played += dt; S.since += dt;
    saveT -= dt; if (saveT <= 0) { saveT = 5; save(); }
    if (S.daily && S.played >= (S.daily + S.extra) * 60) { S.doneDay = S.day; save(); show('done'); return true; }
    if (S.breakEvery) {
      const left = S.breakEvery * 60 - S.since;
      if (left <= 120 && left > 30 && warned < 1) { warned = 1; onWarn && onWarn(2); }
      if (left <= 30 && left > 0 && warned < 2) { warned = 2; onWarn && onWarn(0.5); }
      // wait for a good moment (not mid-dialogue, lesson or race), but never more than 2 extra minutes
      if (left <= 0 && (canBreak || left < -120)) {
        S.since = 0; warned = 0; S.breakUntil = Date.now() + S.breakLen * 60000; save(); show('break'); return true;
      }
    }
    return false;
  }

  return {
    tick,
    goAway() { show('away'); },
    // Opens the grown-up gate. With a callback, a correct answer runs it; without, it opens the settings.
    grownUp(onPass, why) {
      if (mode) return;
      show('grown');
      el.querySelector('#careText').textContent = why || 'Settings for breaks, play time and chat.';
      openGate(onPass);
    },
    setVoice(v) { S.voice = v; save(); },
    get chat() { return S.chat; },
    get voice() { return S.voice; },
    onSettings(fn) { onSettings = fn; },
    onAway(fn) { onAway = fn; },
    onWarn(fn) { onWarn = fn; },
    minutesLeftToday() { return S.daily ? Math.max(0, Math.round((S.daily + S.extra) * 60 - S.played) / 60) : Infinity; },
    get locked() { return !!mode; },
  };
})();
