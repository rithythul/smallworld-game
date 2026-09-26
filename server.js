// Noodle Universe server: serves the game files and runs multiplayer rooms over WebSockets.
// Run with `npm start`, then open http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const MAX_PLAYERS = 8;
const TICK_MS = 100;                 // how often positions are sent out
const RESPAWN_MS = 15 * 60 * 1000;   // shared bricks grow back every 15 minutes

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const PUBLIC = new Set(['index.html', 'manifest.webmanifest', 'css', 'js', 'icons']);
const ROUND_SECS = +process.env.ROUND_SECS || 120;               // one Crunch Race round
const potNeed = (level) => 20 + level * 10; // team pot grows every time it fills

/* ---------- leaderboard (saved to a JSON file) ---------- */
// Everything the server remembers lives in DATA_DIR. On Render, point it at a persistent disk.
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const BOARD_FILE = process.env.LEADERBOARD_FILE || path.join(DATA_DIR, 'leaderboard.json');
const SAVE_DIR = path.join(DATA_DIR, 'saves');
let board = {};
try { board = JSON.parse(fs.readFileSync(BOARD_FILE, 'utf8')) || {}; } catch (e) { board = {}; }
let boardDirty = false;
setInterval(() => {
  if (!boardDirty) return;
  boardDirty = false;
  fs.mkdir(path.dirname(BOARD_FILE), { recursive: true }, () => fs.writeFile(BOARD_FILE, JSON.stringify(board), () => {}));
}, 10000);
const lastPost = new Map();
function readBody(req, cb, limit = 2000) {
  let data = '';
  req.on('data', (c) => { data += c; if (data.length > limit) req.destroy(); });
  req.on('end', () => { try { cb(JSON.parse(data)); } catch (e) { cb(null); } });
}
function topList(by) {
  const key = ['coins', 'found', 'stars', 'trophies'].includes(by) ? by : 'coins';
  return Object.values(board).sort((a, b) => (b[key] || 0) - (a[key] || 0) || (b.coins || 0) - (a.coins || 0)).slice(0, 50)
    .map(e => ({ id: e.id, name: e.name, color: e.color, coins: e.coins, found: e.found, stars: e.stars, trophies: e.trophies || 0 }));
}
function handleApi(req, res, urlPath, query) {
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  if (urlPath === '/api/ice' && req.method === 'GET') {
    // Network helpers for voice chat. STUN works for most homes; set TURN_URL, TURN_USER and TURN_PASS
    // to add a relay server for strict school or phone networks.
    const ice = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
    if (process.env.TURN_URL) ice.push({ urls: process.env.TURN_URL.split(','), username: process.env.TURN_USER || '', credential: process.env.TURN_PASS || '' });
    return json(200, { iceServers: ice });
  }
  if (urlPath === '/api/leaderboard' && req.method === 'GET') {
    const by = new URLSearchParams(query).get('by');
    return json(200, { list: topList(by), total: Object.keys(board).length });
  }
  if (urlPath === '/api/score' && req.method === 'POST') {
    return readBody(req, (m) => {
      if (!m || typeof m.id !== 'string' || !/^[a-z0-9]{8,24}$/.test(m.id)) return json(400, { error: 'bad request' });
      const t = Date.now();
      if (t - (lastPost.get(m.id) || 0) < 8000) return json(429, { error: 'slow down' });
      lastPost.set(m.id, t);
      const prev = board[m.id] || { id: m.id };
      board[m.id] = { ...prev, id: m.id, name: safeName(m.name) || 'Squareface', color: COLORS.includes(m.color) ? m.color : COLORS[0],
        coins: num(m.coins, 0, 1e7), found: num(m.found, 0, 999), stars: num(m.stars, 0, 1e5), trophies: prev.trophies || 0, updated: t };
      boardDirty = true;
      const key = 'coins';
      const rank = Object.values(board).filter(e => (e[key] || 0) > board[m.id][key]).length + 1;
      json(200, { rank, total: Object.keys(board).length });
    });
  }
  if ((urlPath === '/api/save' || urlPath === '/api/load') && req.method === 'POST') {
    return readBody(req, (m) => handleAccount(urlPath, m, req, json), 300000);
  }
  json(404, { error: 'not found' });
}

/* ---------- online saves: a name and a 4-digit PIN, no recovery ---------- */
const nameKey = (n) => String(n || '').trim().toLowerCase().replace(/[^a-z0-9 _-]/g, '').replace(/\s+/g, '-');
const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString('hex');
const attempts = new Map(); // ip -> [timestamps] of failed PINs
const nameLocks = new Map(); // save name -> { fails, until }
function tooManyTries(ip) {
  const t = Date.now(), list = (attempts.get(ip) || []).filter(x => t - x < 60000);
  attempts.set(ip, list);
  return list.length >= 6;
}
function handleAccount(urlPath, m, req, json) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map(x => x.trim()).filter(Boolean);
  const ip = xff.length ? xff[xff.length - 1] : (req.socket.remoteAddress || '?');
  if (!m) return json(400, { error: 'Something went wrong. Try again.' });
  const key = nameKey(m.name), pin = String(m.pin || '');
  if (key.length < 2 || key.length > 14) return json(400, { error: 'Names need 2 to 14 letters or numbers.' });
  if (!/^\d{4}$/.test(pin)) return json(400, { error: 'The PIN is 4 numbers, like 2468.' });
  if (tooManyTries(ip)) return json(429, { error: 'Too many wrong PINs. Wait a minute and try again.' });
  const lock = nameLocks.get(key);
  if (lock && lock.until > Date.now()) return json(429, { error: 'This name is locked for a while after too many wrong PINs. Try again later.' });
  const file = path.join(SAVE_DIR, key + '.json');
  fs.readFile(file, 'utf8', (err, text) => {
    let rec = null; try { rec = err ? null : JSON.parse(text); } catch (e) { rec = null; }
    const wrongPin = () => {
      attempts.get(ip).push(Date.now());
      const l = nameLocks.get(key) || { fails: 0, until: 0 };
      l.fails++; if (l.fails >= 10) { l.until = Date.now() + 3600000; l.fails = 0; }
      nameLocks.set(key, l);
    };
    if (urlPath === '/api/load') {
      if (!rec) return json(404, { error: 'No saved game with that name. Check the spelling.' });
      if (hashPin(pin, rec.salt) !== rec.hash) { wrongPin(); return json(403, { error: 'Wrong PIN for that name.' }); }
      return json(200, { name: rec.name, save: rec.save, updated: rec.updated });
    }
    // save
    if (!m.save || typeof m.save !== 'object') return json(400, { error: 'Nothing to save.' });
    if (rec && hashPin(pin, rec.salt) !== rec.hash) { wrongPin(); return json(403, { error: 'That name is already taken. Wrong PIN? Pick a different name.' }); }
    // Never let an older device overwrite a save with more progress, unless the player says so.
    const progress = num(m.progress, 0, 1e7);
    if (rec && !m.force && (rec.progress || 0) > progress) return json(409, { error: 'Your online save has more progress (from another device).', theirs: rec.progress, yours: progress });
    const salt = rec ? rec.salt : crypto.randomBytes(12).toString('hex');
    const out = { name: safeName(m.name), salt, hash: rec ? rec.hash : hashPin(pin, salt), save: m.save, progress, created: rec ? rec.created : Date.now(), updated: Date.now() };
    fs.mkdir(SAVE_DIR, { recursive: true }, () => fs.writeFile(file, JSON.stringify(out), (e) => e ? json(500, { error: 'Could not save right now.' }) : json(200, { ok: true, created: !rec })));
  });
}

/* ---------- static files ---------- */
const server = http.createServer((req, res) => {
  const [rawPath, query = ''] = (req.url || '/').split('?');
  let urlPath = decodeURIComponent(rawPath);
  if (urlPath.startsWith('/api/')) return handleApi(req, res, urlPath, query);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  if (urlPath === '/healthz') { res.writeHead(200); res.end('ok'); return; }
  const file = path.normalize(path.join(ROOT, urlPath));
  const top = path.relative(ROOT, file).split(path.sep)[0];
  if (!file.startsWith(ROOT + path.sep) || !PUBLIC.has(top)) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=300' });
    res.end(data);
  });
});

/* ---------- rooms ---------- */
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O, easy to read out loud
function newCode() {
  let code;
  do { code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); } while (rooms.has(code));
  return code;
}
const BLOCK = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'slut', 'whore', 'nigg', 'fag', 'rape', 'nazi', 'porn', 'piss', 'bastard'];
const clean = (s, n) => String(s || '').replace(/[<>&"'`]/g, '').trim().slice(0, n);
const safeName = (s) => { const c = clean(s, 14), flat = c.toLowerCase().replace(/[^a-z]/g, ''); return BLOCK.some(w => flat.includes(w)) ? 'Squareface' : c; };
// Room chat: bad words become stars; links, emails and long numbers (phone numbers, addresses) are hidden
// so kids don't share personal details. Nothing is stored: messages only go to the players in the room.
const CHAT_MAX = 80, PHRASE_COUNT = 12;
function cleanChat(s) {
  let t = String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
  t = t.replace(/\S+@\S+/g, '***').replace(/(https?:\/\/|www\.)\S*/gi, '***').replace(/\b\S+\.(com|net|org|io|gg|me|co|tv|app|xyz|ly)\b\S*/gi, '***');
  t = t.replace(/(\d[\s.-]*){5,}/g, '*** ');
  t = t.split(' ').map(w => { const flat = w.toLowerCase().replace(/[^a-z]/g, ''); return flat && BLOCK.some(b => flat.includes(b)) ? '*'.repeat(Math.min(w.length, 6)) : w; }).join(' ');
  return t.trim();
}
// A small token bucket per player: `n` messages per `sec` seconds.
function allow(p, key, n, sec) {
  const t = Date.now(), b = p[key] || (p[key] = { tokens: n, at: t });
  b.tokens = Math.min(n, b.tokens + (t - b.at) / 1000 * (n / sec)); b.at = t;
  if (b.tokens < 1) return false;
  b.tokens -= 1; return true;
}
const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);
const COLORS = ['#2fa4b5', '#e4572e', '#8cbf5a', '#b98cff', '#f4b942', '#ff8fb1', '#5b7cfa', '#9a7b5b'];

function publicPlayer(p) {
  return { id: p.id, name: p.name, color: p.color, found: p.found, coins: p.coins, stars: p.stars, trophies: p.trophies, host: p.host, voice: p.voice || 0 };
}
function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(room, msg, except) {
  const data = JSON.stringify(msg);
  for (const p of room.players.values()) if (p.ws !== except && p.ws.readyState === 1) p.ws.send(data);
}
function scores(room) {
  return [...room.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color, found: p.found, coins: p.coins, stars: p.stars, trophies: p.trophies, round: p.round }))
    .sort((a, b) => b.found - a.found || b.stars - a.stars || b.coins - a.coins);
}

function joinRoom(ws, room, name, color, uid) {
  if (room.players.size >= MAX_PLAYERS) return send(ws, { t: 'error', msg: `Room ${room.code} is full (${MAX_PLAYERS} players).` });
  const used = new Set([...room.players.values()].map(p => p.color));
  const pick = COLORS.includes(color) && !used.has(color) ? color : (COLORS.find(c => !used.has(c)) || COLORS[0]);
  const p = { id: ++room.nextId, ws, name: safeName(name) || 'Squareface', color: pick, host: room.players.size === 0, x: 0, y: 0, s: {}, found: 0, coins: 0, stars: 0, trophies: 0, round: 0, uid: /^[a-z0-9]{8,24}$/.test(uid || '') ? uid : null };
  room.players.set(p.id, p);
  ws.room = room; ws.player = p;
  send(ws, { t: 'joined', you: p.id, created: room.players.size === 1, code: room.code, mode: room.mode, players: [...room.players.values()].map(publicPlayer), crunched: [...room.crunched], teamFound: [...room.teamFound], pot: room.pot, round: roundInfo(room) });
  broadcast(room, { t: 'player', p: publicPlayer(p) }, ws);
  broadcast(room, { t: 'scores', list: scores(room) });
}

function roundInfo(room) { return room.roundEnd ? { secs: Math.max(0, Math.round((room.roundEnd - Date.now()) / 1000)) } : null; }
function startRound(room) {
  if (room.roundEnd) return;
  room.roundEnd = Date.now() + ROUND_SECS * 1000;
  room.players.forEach(p => { p.round = 0; });
  room.crunched.clear();
  broadcast(room, { t: 'respawn' });
  broadcast(room, { t: 'round', state: 'start', secs: ROUND_SECS });
  room.roundTimer = setTimeout(() => endRound(room), ROUND_SECS * 1000);
}
function endRound(room) {
  room.roundEnd = null;
  const list = [...room.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color, n: p.round })).sort((a, b) => b.n - a.n);
  const best = list[0] && list[0].n > 0 ? list[0].n : 0;
  const scored = list.filter(e => e.n > 0).length;
  const winners = scored >= 2 ? list.filter(e => best > 0 && e.n === best) : [];
  winners.forEach(w => {
    const p = room.players.get(w.id); if (!p) return;
    p.trophies++;
    if (p.uid && board[p.uid]) { board[p.uid].trophies = (board[p.uid].trophies || 0) + 1; boardDirty = true; }
  });
  broadcast(room, { t: 'round', state: 'end', list, winners: winners.map(w => w.id), valid: scored >= 2 });
  broadcast(room, { t: 'scores', list: scores(room) });
}

// The same player entering again (a new tab, or rejoining after the phone slept) replaces their old copy,
// so nobody ever sees two of the same Squareface.
function dropOldCopy(room, uid, ws) {
  if (!room || !/^[a-z0-9]{8,24}$/.test(uid || '')) return;
  for (const old of [...room.players.values()]) {
    if (old.uid !== uid || old.ws === ws) continue;
    send(old.ws, { t: 'replaced' });
    leave(old.ws);
    try { old.ws.close(4000, 'replaced'); } catch (e) {}
  }
}
function leave(ws) {
  const room = ws.room, p = ws.player;
  if (!room || !p) return;
  room.players.delete(p.id);
  ws.room = null; ws.player = null;
  if (!room.players.size) { clearInterval(room.respawn); clearTimeout(room.roundTimer); rooms.delete(room.code); return; }
  if (p.host) { const next = room.players.values().next().value; next.host = true; broadcast(room, { t: 'player', p: publicPlayer(next) }); }
  broadcast(room, { t: 'left', id: p.id, name: p.name });
  broadcast(room, { t: 'scores', list: scores(room) });
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16384 });
wss.on('connection', (ws) => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const room = ws.room, p = ws.player;

    if (m.t === 'enter') {
      // Room names are chosen by players: 3 to 8 letters or numbers, like 67NM.
      const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length < 3 || code.length > 8) return send(ws, { t: 'error', msg: 'Room names need 3 to 8 letters or numbers, like 67NM.' });
      if (room) leave(ws);
      dropOldCopy(rooms.get(code), m.uid, ws);
      let r = rooms.get(code);
      if (!r) {
        r = { code, mode: m.mode === 'race' ? 'race' : 'team', players: new Map(), crunched: new Set(), teamFound: new Set(), nextId: 0, pot: { level: 1, fill: 0, need: potNeed(1) }, roundEnd: null };
        r.respawn = setInterval(() => { r.crunched.clear(); broadcast(r, { t: 'respawn' }); }, RESPAWN_MS);
        rooms.set(code, r);
      }
      return joinRoom(ws, r, m.name, m.color, m.uid);
    }
    if (m.t === 'create') {
      if (room) leave(ws);
      const r = { code: newCode(), mode: m.mode === 'race' ? 'race' : 'team', players: new Map(), crunched: new Set(), teamFound: new Set(), nextId: 0, pot: { level: 1, fill: 0, need: potNeed(1) }, roundEnd: null };
      r.respawn = setInterval(() => { r.crunched.clear(); broadcast(r, { t: 'respawn' }); }, RESPAWN_MS);
      rooms.set(r.code, r);
      return joinRoom(ws, r, m.name, m.color, m.uid);
    }
    if (m.t === 'join') {
      if (room) leave(ws);
      dropOldCopy(rooms.get(clean(m.code, 4).toUpperCase()), m.uid, ws);
      const r = rooms.get(clean(m.code, 4).toUpperCase());
      if (!r) return send(ws, { t: 'error', msg: 'No room with that code. Check the letters and try again.' });
      return joinRoom(ws, r, m.name, m.color, m.uid);
    }
    if (!room || !p) return;

    switch (m.t) {
      case 'state':
        p.x = num(m.x, 0, 1e7); p.y = num(m.y, 0, 5000);  // the world keeps growing east
        p.s = { mood: clean(m.mood, 10), sw: !!m.sw, mv: !!m.mv, f: num(m.f, -1, 1), z: num(m.z, 0, 400), su: !!m.su, h: clean(m.h, 10), ga: !!m.ga };
        break;
      case 'crunch': {
        const id = typeof m.b === 'number' ? m.b : clean(m.b, 12);
        if (room.crunched.has(id)) return;
        room.crunched.add(id);
        broadcast(room, { t: 'crunch', b: id, by: p.id }, ws);
        if (room.roundEnd) { p.round++; broadcast(room, { t: 'scores', list: scores(room) }); }
        if (room.mode === 'team') room.players.forEach(q => { if (q !== p && q.away) q.helped = (q.helped || 0) + 1; });
        if (room.mode === 'team' && room.players.size >= 2) {
          room.pot.fill++;
          if (room.pot.fill >= room.pot.need) {
            room.pot.level++; room.pot.fill = 0; room.pot.need = potNeed(room.pot.level);
            broadcast(room, { t: 'pot', pot: room.pot, up: true });
          } else broadcast(room, { t: 'pot', pot: room.pot });
        }
        break;
      }
      case 'found': {
        const n = clean(m.n, 16);
        if (room.mode === 'team') room.teamFound.add(n);
        broadcast(room, { t: 'found', n, by: p.id, name: p.name }, ws);
        break;
      }
      case 'score':
        p.found = num(m.found, 0, 999); p.coins = num(m.coins, 0, 1e6); p.stars = num(m.stars, 0, 999);
        broadcast(room, { t: 'scores', list: scores(room) });
        break;
      case 'color': {
        const taken = [...room.players.values()].some(o => o !== p && o.color === m.color);
        if (!COLORS.includes(m.color)) return;
        if (taken) return send(ws, { t: 'error', msg: 'Someone in the room already has that color. Pick another one!' });
        p.color = m.color;
        broadcast(room, { t: 'player', p: publicPlayer(p) });
        broadcast(room, { t: 'scores', list: scores(room) });
        break;
      }
      case 'round':
        if (room.mode !== 'race') break;
        if (room.players.size < 2) { send(ws, { t: 'error', msg: 'Crunch Races need at least 2 players. Share your room name with a friend!' }); break; }
        startRound(room);
        break;
      case 'away':
        p.away = !!m.on;
        if (!p.away && p.helped) { send(ws, { t: 'helped', n: p.helped }); p.helped = 0; }
        broadcast(room, { t: 'emote', id: p.id, e: p.away ? '🍽️' : '👋' });
        break;
      case 'emote':
        broadcast(room, { t: 'emote', id: p.id, e: clean(m.e, 4) });
        break;
      case 'chat': {
        if (!allow(p, 'chatBucket', 5, 10)) return send(ws, { t: 'chat-slow' });
        const q = Number.isInteger(m.q) && m.q >= 0 && m.q < PHRASE_COUNT ? m.q : null;
        const text = q === null ? cleanChat(m.text) : '';
        if (q === null && !text) return;
        broadcast(room, { t: 'chat', id: p.id, name: p.name, color: p.color, q, text });
        break;
      }
      case 'voice': {
        // 0 = not in voice, 1 = talking, 2 = in voice with the mic muted
        const v = m.on ? (m.mute ? 2 : 1) : 0;
        if (v === (p.voice || 0)) return;
        p.voice = v;
        broadcast(room, { t: 'player', p: publicPlayer(p) });
        break;
      }
      case 'rtc': {
        // WebRTC signalling for voice: offers, answers and network candidates go only to the one player they are for,
        // and only while both players have voice switched on.
        const to = room.players.get(m.to);
        if (!to || to === p || !p.voice || !to.voice || !m.data || typeof m.data !== 'object') return;
        if (!allow(p, 'rtcBucket', 80, 10)) return;
        send(to.ws, { t: 'rtc', from: p.id, data: m.data });
        break;
      }
      case 'leave':
        leave(ws);
        break;
    }
  });
  ws.on('close', () => leave(ws));
});

// Send everyone's position 10 times a second
setInterval(() => {
  for (const room of rooms.values()) {
    const list = [...room.players.values()].map(p => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), ...p.s, a: !!p.away }));
    broadcast(room, { t: 'states', list });
  }
}, TICK_MS);

// Drop connections that went silent (phone locked, lost signal)
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false; ws.ping();
  }
}, 15000);

server.listen(PORT, () => console.log(`Noodle Universe running at http://localhost:${PORT}`));
