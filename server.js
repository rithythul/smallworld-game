// Noodle Universe server: serves the game files and runs multiplayer rooms over WebSockets.
// Run with `npm start`, then open http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
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

/* ---------- static files ---------- */
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
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
const clean = (s, n) => String(s || '').replace(/[<>&"'`]/g, '').trim().slice(0, n);
const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);
const COLORS = ['#2fa4b5', '#e4572e', '#8cbf5a', '#b98cff', '#f4b942', '#ff8fb1', '#5b7cfa', '#9a7b5b'];

function publicPlayer(p) {
  return { id: p.id, name: p.name, color: p.color, found: p.found, coins: p.coins, stars: p.stars, host: p.host };
}
function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(room, msg, except) {
  const data = JSON.stringify(msg);
  for (const p of room.players.values()) if (p.ws !== except && p.ws.readyState === 1) p.ws.send(data);
}
function scores(room) {
  return [...room.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color, found: p.found, coins: p.coins, stars: p.stars }))
    .sort((a, b) => b.found - a.found || b.stars - a.stars || b.coins - a.coins);
}

function joinRoom(ws, room, name, color) {
  if (room.players.size >= MAX_PLAYERS) return send(ws, { t: 'error', msg: `Room ${room.code} is full (${MAX_PLAYERS} players).` });
  const used = new Set([...room.players.values()].map(p => p.color));
  const pick = COLORS.includes(color) && !used.has(color) ? color : (COLORS.find(c => !used.has(c)) || COLORS[0]);
  const p = { id: ++room.nextId, ws, name: clean(name, 14) || 'Squareface', color: pick, host: room.players.size === 0, x: 0, y: 0, s: {}, found: 0, coins: 0, stars: 0 };
  room.players.set(p.id, p);
  ws.room = room; ws.player = p;
  send(ws, { t: 'joined', you: p.id, code: room.code, mode: room.mode, players: [...room.players.values()].map(publicPlayer), crunched: [...room.crunched], teamFound: [...room.teamFound] });
  broadcast(room, { t: 'player', p: publicPlayer(p) }, ws);
  broadcast(room, { t: 'scores', list: scores(room) });
}

function leave(ws) {
  const room = ws.room, p = ws.player;
  if (!room || !p) return;
  room.players.delete(p.id);
  ws.room = null; ws.player = null;
  if (!room.players.size) { clearInterval(room.respawn); rooms.delete(room.code); return; }
  if (p.host) { const next = room.players.values().next().value; next.host = true; broadcast(room, { t: 'player', p: publicPlayer(next) }); }
  broadcast(room, { t: 'left', id: p.id, name: p.name });
  broadcast(room, { t: 'scores', list: scores(room) });
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', (ws) => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const room = ws.room, p = ws.player;

    if (m.t === 'create') {
      if (room) leave(ws);
      const r = { code: newCode(), mode: m.mode === 'race' ? 'race' : 'team', players: new Map(), crunched: new Set(), teamFound: new Set(), nextId: 0 };
      r.respawn = setInterval(() => { r.crunched.clear(); broadcast(r, { t: 'respawn' }); }, RESPAWN_MS);
      rooms.set(r.code, r);
      return joinRoom(ws, r, m.name, m.color);
    }
    if (m.t === 'join') {
      const r = rooms.get(clean(m.code, 4).toUpperCase());
      if (!r) return send(ws, { t: 'error', msg: 'No room with that code. Check the letters and try again.' });
      if (room) leave(ws);
      return joinRoom(ws, r, m.name, m.color);
    }
    if (!room || !p) return;

    switch (m.t) {
      case 'state':
        p.x = num(m.x, 0, 5000); p.y = num(m.y, 0, 5000);
        p.s = { mood: clean(m.mood, 10), sw: !!m.sw, mv: !!m.mv, f: num(m.f, -1, 1), z: num(m.z, 0, 400) };
        break;
      case 'crunch': {
        const id = typeof m.b === 'number' ? m.b : clean(m.b, 12);
        if (room.crunched.has(id)) return;
        room.crunched.add(id);
        broadcast(room, { t: 'crunch', b: id, by: p.id }, ws);
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
      case 'emote':
        broadcast(room, { t: 'emote', id: p.id, e: clean(m.e, 4) });
        break;
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
    const list = [...room.players.values()].map(p => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), ...p.s }));
    broadcast(room, { t: 'states', list });
  }
}, TICK_MS);

// Drop connections that went silent (phone locked, lost signal)
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false; ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log(`Noodle Universe running at http://localhost:${PORT}`));
