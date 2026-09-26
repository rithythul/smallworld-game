// Multiplayer connection. Talks to server.js over a WebSocket.
const Net = (() => {
  let ws = null, me = null, code = null, mode = null, scores = [];
  const others = new Map();     // id -> { name, color, x, y, tx, ty, mood, sw, mv, f, z, walk }
  const handlers = {};
  let lastState = 0, lastScore = '';

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
        if (wasIn) emit('disconnected');
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
        m.players.forEach(p => { if (p.id !== me) others.set(p.id, { ...p, x: null, y: null }); });
        emit('joined', m);
        break;
      case 'player':
        if (m.p.id === me) { emit('me', m.p); break; }
        if (!others.has(m.p.id)) { others.set(m.p.id, { ...m.p, x: null, y: null }); emit('arrived', m.p); }
        else Object.assign(others.get(m.p.id), m.p);
        break;
      case 'left':
        others.delete(m.id); emit('left', m);
        break;
      case 'states':
        m.list.forEach(s => {
          if (s.id === me) return;
          const o = others.get(s.id); if (!o) return;
          if (o.x === null) { o.x = s.x; o.y = s.y; o.walk = 0; }
          o.tx = s.x; o.ty = s.y; o.mood = s.mood; o.sw = s.sw; o.mv = s.mv; o.f = s.f; o.tz = s.z || 0; o.su = s.su; o.h = s.h; o.ga = s.ga; o.a = s.a;
        });
        break;
      case 'scores': scores = m.list; emit('scores', scores); break;
      default: emit(m.t, m); // crunch, found, emote, respawn, error
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
      send({ t: 'state', x: p.x, y: p.y, mood: p.mood, sw: p.swimming, mv: p.moving, f: Math.round(p.face * 10) / 10, z: Math.round(p.z || 0), su: !!p.suit, h: p.hat || '', ga: !!p.goldAntenna });
    },
    crunch(id) { if (code) send({ t: 'crunch', b: id }); },
    found(n) { if (code) send({ t: 'found', n }); },
    score(found, coins, stars) {
      const key = found + ':' + coins + ':' + stars;
      if (!code || key === lastScore) return;
      lastScore = key; send({ t: 'score', found, coins, stars });
    },
    emote(e) { if (code) send({ t: 'emote', e }); },
    color(c) { if (code) send({ t: 'color', color: c }); },
    away(on) { if (code) send({ t: 'away', on: !!on }); },
    get active() { return !!code; },
    get code() { return code; },
    get mode() { return mode; },
    get me() { return me; },
    get scores() { return scores; },
    others,
  };
})();
