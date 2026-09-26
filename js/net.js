// Multiplayer connection. Talks to server.js over a WebSocket.
const Net = (() => {
  let ws = null, me = null, code = null, mode = null, scores = [];
  const others = new Map();     // id -> { name, color, x, y, tx, ty, mood, sw, mv, f, z, walk }
  const handlers = {};
  let lastState = 0, lastScore = '', replaced = false, clockOffset = 0, rid = 0;
  const pending = new Map();      // town actions waiting for the server's answer

  const emit = (evt, data) => (handlers[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });
  const send = (msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };

  let statusFn = null;
  const err = (code, msg) => Object.assign(new Error(msg || code), { code });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // Free Render servers sleep after ~15 minutes and take up to a minute to wake up.
  // Ask /healthz until the server answers "ok". A 404 or an HTML page means there is no game server here.
  async function wake() {
    const deadline = Date.now() + 75000;
    for (let tries = 0; Date.now() < deadline; tries++) {
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
        const r = await fetch('healthz?t=' + Date.now(), { cache: 'no-store', signal: ctl.signal });
        clearTimeout(t);
        const text = (await r.text()).trim();
        if (r.ok && text === 'ok') return;
        if (r.status === 404 || /<html|<!doctype/i.test(text)) throw err('no-server');
      } catch (e) { if (e.code === 'no-server') throw e; }
      if (statusFn) statusFn(Math.round((75000 - (deadline - Date.now())) / 1000));
      await sleep(3000);
    }
    throw err('timeout');
  }
  function openSocket() {
    return new Promise((resolve, reject) => {
      let s;
      try { s = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { return reject(err('failed')); }
      const timer = setTimeout(() => { try { s.close(); } catch (e) {} reject(err('timeout')); }, 12000);
      s.onopen = () => { clearTimeout(timer); ws = s; resolve(); };
      s.onerror = () => { clearTimeout(timer); reject(err('failed')); };
      s.onmessage = onMessage;
      s.onclose = () => {
        const wasIn = !!code;
        ws = null; code = null; others.clear();
        pending.forEach(fn => fn({ ok: false, msg: 'Lost the connection.' })); pending.clear();
        if (wasIn) emit('disconnected', { replaced });
        replaced = false;
      };
    });
  }
  async function connect() {
    if (ws && ws.readyState === 1) return;
    if (!/^https?:$/.test(location.protocol)) throw err('offline');
    await wake();
    try { await openSocket(); } catch (e) { await sleep(1500); await openSocket(); } // one retry
  }

  function onMessage(ev) {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    switch (m.t) {
      case 'joined':
        me = m.you; code = m.code; mode = m.mode; others.clear();
        if (m.now) clockOffset = m.now - Date.now();   // one shared clock for the beat and the wonders
        m.players.forEach(p => { if (p.id !== me) others.set(p.id, { ...p, x: null, y: null }); });
        emit('joined', m);
        break;
      case 'player':
        if (m.p.id === me) { emit('me', m.p); break; }
        if (!others.has(m.p.id)) { others.set(m.p.id, { ...m.p, x: null, y: null }); emit('arrived', m.p); }
        else Object.assign(others.get(m.p.id), m.p);
        emit('player', m.p);
        break;
      case 'left':
        others.delete(m.id); emit('left', m);
        break;
      case 'states':
        m.list.forEach(s => {
          if (s.id === me) return;
          const o = others.get(s.id); if (!o) return;
          if (o.x === null) { o.x = s.x; o.y = s.y; o.walk = 0; }
          o.tx = s.x; o.ty = s.y; o.mood = s.mood; o.sw = s.sw; o.mv = s.mv; o.f = s.f; o.tz = s.z || 0; o.su = s.su; o.h = s.h; o.ga = s.ga; o.a = s.a; o.ti = s.ti;
        });
        break;
      case 'scores': scores = m.list; emit('scores', scores); break;
      case 'replaced': replaced = true; break;
      case 'tres': { const fn = pending.get(m.rid); if (fn) { pending.delete(m.rid); fn(m.res); } break; }
      default: emit(m.t, m); // crunch, found, emote, respawn, error, chat, rtc
    }
  }

  return {
    connect,
    on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); },
    onStatus(fn) { statusFn = fn; },
    async create(name, color, roomMode, uid) { await connect(); send({ t: 'create', name, color, mode: roomMode, uid }); },
    async join(roomCode, name, color, uid) { await connect(); send({ t: 'join', code: roomCode, name, color, uid }); },
    async enter(roomCode, name, color, roomMode, uid) { await connect(); send({ t: 'enter', code: roomCode, name, color, mode: roomMode, uid }); },
        startRound() { if (code) send({ t: 'round' }); },
    leave() { send({ t: 'leave' }); code = null; others.clear(); },
    state(p) {
      if (!code) return;
      const t = performance.now();
      if (t - lastState < 90) return;
      lastState = t;
      send({ t: 'state', x: p.x, y: p.y, mood: p.mood, sw: p.swimming, mv: p.moving, f: Math.round(p.face * 100) / 100, z: Math.round(p.z || 0), su: !!p.suit, h: p.hat || '', ga: !!p.goldAntenna, ti: p.title || '' });
    },
    // Small World: an action on the shared town. Resolves with the town's answer.
    townAct(a) {
      if (!code) return Promise.resolve({ ok: false, msg: 'Not in a room.' });
      const id = ++rid;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        send({ t: 'tact', rid: id, a });
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ ok: false, msg: 'The town did not answer. Try again.' }); } }, 8000);
      });
    },
    crunch(id, n = 0, v = '') { if (code) send({ t: 'crunch', b: id, n, v }); },
    // milliseconds on the shared clock (the server's, once you are in a room)
    now() { return Date.now() + clockOffset; },
    found(n) { if (code) send({ t: 'found', n }); },
    score(found, coins, stars) {
      const key = found + ':' + coins + ':' + stars;
      if (!code || key === lastScore) return;
      lastScore = key; send({ t: 'score', found, coins, stars });
    },
    emote(e) { if (code) send({ t: 'emote', e }); },
    color(c) { if (code) send({ t: 'color', color: c }); },
    away(on) { if (code) send({ t: 'away', on: !!on }); },
    chat(text) { if (code) send({ t: 'chat', text: String(text).slice(0, 80) }); },
    phrase(q) { if (code) send({ t: 'chat', q }); },
    voice(on, mute) { if (code) send({ t: 'voice', on: !!on, mute: !!mute }); },
    rtc(to, data) { if (code) send({ t: 'rtc', to, data }); },
    get active() { return !!code; },
    get code() { return code; },
    get mode() { return mode; },
    get me() { return me; },
    get scores() { return scores; },
    others,
  };
})();
