// Room chat and voice. Chat goes through the server (which hides bad words, links and phone numbers).
// Voice is WebRTC: every player in voice connects straight to every other one (up to 8), and the server
// only passes the connection messages along.
const Talk = (() => {
  const PHRASES = ['👋 Hi!', 'Follow me!', 'Help me please!', 'Great job! 🎉', 'Come to the pool! 🏊', "Let's crunch bricks!",
    'Where are you?', 'I found a noodle! 🍜', 'Wait for me!', 'Thank you! ❤️', 'Race you! 🏁', 'Bye! 👋'];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let hooks = {}, open = false, unread = 0, log = [];
  const hidden = new Set();                 // players this kid chose to hide (chat and voice)

  /* ---------------- chat panel ---------------- */
  function build() {
    const bar = document.createElement('div'); bar.id = 'talkBar'; bar.hidden = true;
    bar.innerHTML = `<button class="icon-btn" id="micBtn" type="button" aria-label="Microphone" hidden>🎙️</button>
      <button class="icon-btn" id="chatBtn" type="button" aria-label="Room chat">💬<span class="badge" id="chatBadge" hidden>0</span></button>`;
    const panel = document.createElement('div'); panel.id = 'chat'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Room chat');
    panel.innerHTML = `<div class="chat-head"><h2>Room chat</h2><button class="close" id="chatClose" type="button" aria-label="Close chat">✕</button></div>
      <div class="chat-people" id="chatPeople"></div>
      <div class="chat-voice" id="chatVoice"></div>
      <div class="chat-log" id="chatLog" aria-live="polite"></div>
      <div class="chat-phrases" id="chatPhrases">${PHRASES.map((p, i) => `<button type="button" data-q="${i}">${esc(p)}</button>`).join('')}</div>
      <form class="chat-form" id="chatForm"><input id="chatInput" maxlength="80" autocomplete="off" enterkeyhint="send" placeholder="Type a message…" aria-label="Message"><button class="choice" type="submit">Send</button></form>
      <p class="chat-note" id="chatNote"></p>`;
    document.getElementById('app').append(bar, panel);
    [bar, panel].forEach(n => n.addEventListener('pointerdown', e => e.stopPropagation()));
    $('chatBtn').addEventListener('click', () => (open ? close() : show()));
    $('chatClose').addEventListener('click', close);
    $('micBtn').addEventListener('click', () => setMute(!muted));
    $('chatPhrases').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || !cooldown()) return;
      Net.phrase(+b.dataset.q); mine(PHRASES[+b.dataset.q]);
    });
    $('chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = $('chatInput'), text = inp.value.replace(/\s+/g, ' ').trim();
      if (!text || !cooldown()) return;
      Net.chat(text); inp.value = '';
      // show my own line once the server sends it back cleaned (so I see what my friends see)
    });
    $('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); e.stopPropagation(); });
    $('chatPeople').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]'); if (!b) return;
      const id = +b.dataset.id;
      if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
      applyHidden(); renderPeople();
    });
    $('chatVoice').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.v === 'join') joinVoice();
      if (b.dataset.v === 'leave') leaveVoice();
      if (b.dataset.v === 'mute') setMute(!muted);
    });
    // phones: keep the panel above the on-screen keyboard
    if (window.visualViewport) {
      const fit = () => { const vv = window.visualViewport; panel.style.setProperty('--kb', Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + 'px'); };
      visualViewport.addEventListener('resize', fit); visualViewport.addEventListener('scroll', fit);
    }
  }
  let lastSend = 0;
  function cooldown() {
    const t = performance.now();
    if (t - lastSend < 1200) { note('Slow down a little! 🐌'); return false; }
    lastSend = t; return true;
  }
  function note(text) { $('chatNote').textContent = text || ''; }
  function mine(text) { hooks.say && hooks.say('me', text); }

  function show() {
    const chatOK = Care.chat !== 'off';
    if (!chatOK && Care.voice === 'off') return;
    open = true; unread = 0; badge();
    $('chat').hidden = false; $('chatBtn').classList.add('on');
    renderPeople(); renderVoice(); renderLog();
    const typing = Care.chat === 'on';
    $('chatForm').hidden = !typing; $('chatLog').hidden = !chatOK; $('chatPhrases').hidden = !chatOK;
    $('chat').querySelector('h2').textContent = chatOK ? 'Room chat' : 'Voice chat';
    note(!chatOK ? '' : typing ? '' : 'Quick phrases only. A grown-up can change this in the settings.');
    if (typing && !hooks.touch()) $('chatInput').focus();
  }
  function close() {
    open = false; $('chat').hidden = true; $('chatBtn').classList.remove('on');
    if (document.activeElement === $('chatInput')) $('chatInput').blur();
  }
  function badge() { const b = $('chatBadge'); b.hidden = !unread; b.textContent = unread > 9 ? '9+' : unread; }

  function lineText(m) { return m.q !== null && m.q !== undefined ? PHRASES[m.q] : m.text; }
  function renderLog() {
    if (!open) return;
    const box = $('chatLog');
    const rows = log.filter(m => !hidden.has(m.id));
    box.innerHTML = rows.length ? rows.map(m => m.sys
      ? `<p class="chat-sys">${esc(m.text)}</p>`
      : `<p class="chat-line${m.id === Net.me ? ' me' : ''}"><b style="--c:${esc(m.color)}">${esc(m.name)}${m.id === Net.me ? ' (you)' : ''}</b> ${esc(lineText(m))}</p>`).join('')
      : '<p class="chat-sys">Say hi to your friends! Tap a quick phrase to send it.</p>';
    box.scrollTop = box.scrollHeight;
  }
  function renderPeople() {
    if (!open) return;
    const people = [...Net.others.entries()];
    $('chatPeople').innerHTML = people.length
      ? people.map(([id, o]) => `<button type="button" data-id="${id}" class="${hidden.has(id) ? 'off' : ''}" aria-pressed="${hidden.has(id)}" title="${hidden.has(id) ? 'Show' : 'Hide'} ${esc(o.name)}">
          <span class="dot" style="background:${esc(o.color)}"></span>${esc(o.name)} ${hidden.has(id) ? '🙈' : o.voice === 1 ? '🎙️' : o.voice === 2 ? '🔇' : ''}</button>`).join('') +
        '<small>Tap a name to hide</small>'
      : '<small>No one else here yet. Share your room name!</small>';
  }
  function add(m) {
    if (Care.chat === 'off' && !m.sys) return;
    log.push(m); if (log.length > 60) log.shift();
    if (m.sys || hidden.has(m.id)) return renderLog();
    if (Care.chat === 'phrases' && m.text && m.id !== Net.me) { log.pop(); return; }   // typed messages stay hidden
    if (m.id !== Net.me) {
      hooks.say && hooks.say(m.id, lineText(m));
      if (!open) { unread++; badge(); hooks.toast && hooks.toast(m.name, lineText(m)); }
      Sound.blip();
    } else if (m.text) mine(m.text);
    renderLog();
  }

  /* ---------------- voice ---------------- */
  const peers = new Map();    // id -> { pc, audio, level, pending: [], initiator }
  let stream = null, muted = false, inVoice = false, iceServers = null, actx = null, myLevel = null;

  async function joinVoice() {
    if (inVoice) return;
    if (Care.voice === 'off') return note('Voice chat is switched off. A grown-up can change it in the settings.');
    if (Care.voice === 'ask') {
      return Care.grownUp(() => { Care.setVoice('on'); show(); joinVoice(); },
        'Voice chat lets your child talk with the other players in this room. A grown-up needs to say OK once on this device.');
    }
    if (!window.RTCPeerConnection || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return note('This browser can\'t do voice chat. Try Chrome, Safari or Edge on the online version.');
    }
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) { actx = null; }  // while the tap still counts
    note('Asking for the microphone…');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    } catch (e) {
      stream = null;
      return note(e && e.name === 'NotAllowedError'
        ? 'The microphone is blocked. Allow it in the browser (the 🔒 next to the web address), then try again.'
        : 'Could not find a microphone.');
    }
    if (!Net.active) { stopStream(); return; }
    if (!iceServers) {
      try { iceServers = (await (await fetch('api/ice', { cache: 'no-store' })).json()).iceServers; } catch (e) {}
      if (!iceServers) iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    }
    myLevel = meter(stream);
    inVoice = true; muted = false;
    Net.voice(true, false);
    note('');
    $('micBtn').hidden = false; micIcon(); renderVoice(); sync();
  }
  function stopStream() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; }
  function leaveVoice(quiet) {
    if (!inVoice) return;
    inVoice = false; Net.voice(false);
    for (const id of [...peers.keys()]) closePeer(id);
    stopStream(); myLevel = null;
    $('micBtn').hidden = true; renderVoice();
    if (!quiet) note('You left voice chat.');
  }
  function setMute(m) {
    if (!inVoice) return;
    muted = m; stream.getAudioTracks().forEach(t => { t.enabled = !muted; });
    Net.voice(true, muted); micIcon(); renderVoice();
  }
  function micIcon() {
    const b = $('micBtn'); b.textContent = muted ? '🔇' : '🎙️';
    b.classList.toggle('muted', muted); b.setAttribute('aria-label', muted ? 'Microphone off, tap to talk' : 'Microphone on, tap to mute');
  }
  function renderVoice() {
    if (!open) return;
    const box = $('chatVoice');
    if (Care.voice === 'off') { box.innerHTML = ''; return; }
    const n = [...Net.others.values()].filter(o => o.voice).length;
    box.innerHTML = inVoice
      ? `<span>🔊 ${n ? `Talking with ${n}` : 'Waiting for friends'}</span>
         <button class="choice${muted ? '' : ' alt'}" type="button" data-v="mute">${muted ? '🎙️ Unmute' : '🔇 Mute'}</button>
         <button class="choice alt" type="button" data-v="leave">Leave</button>`
      : `<span>🔊 ${n ? `${n} in voice` : 'Voice chat'}</span>
         <button class="choice" type="button" data-v="join">🎙️ Join voice</button>`;
  }
  // how loud a stream is right now (0..1), for the "speaking" ring on name tags
  function meter(s) {
    if (!actx) return null;
    try {
      const src = actx.createMediaStreamSource(s), an = actx.createAnalyser(); an.fftSize = 256; src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      return () => { an.getByteTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; } return Math.sqrt(sum / buf.length); };
    } catch (e) { return null; }
  }

  // Connect to everyone else in voice. The player with the smaller id starts, so two players never both call.
  function sync() {
    for (const [id, o] of Net.others) {
      const want = inVoice && o.voice && !hidden.has(id);
      if (want && !peers.has(id) && Net.me < id) call(id);
      if (!want && peers.has(id)) closePeer(id);
    }
    for (const id of [...peers.keys()]) if (!Net.others.has(id)) closePeer(id);
    renderVoice(); renderPeople();
  }
  function makePeer(id, initiator) {
    const pc = new RTCPeerConnection({ iceServers });
    const peer = { pc, audio: null, level: null, pending: [], initiator };
    peers.set(id, peer);
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.onicecandidate = (e) => { if (e.candidate) Net.rtc(id, { c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
    pc.ontrack = (e) => {
      const s = e.streams[0] || new MediaStream([e.track]);
      if (!peer.audio) { peer.audio = new Audio(); peer.audio.autoplay = true; peer.audio.setAttribute('playsinline', ''); }
      peer.audio.srcObject = s; peer.audio.muted = hidden.has(id);
      peer.audio.play().catch(() => note('Tap anywhere to hear your friends.'));
      peer.level = meter(s);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        closePeer(id);
        note('Could not connect voice with a friend. Their network may block it.');
        if (initiator) setTimeout(sync, 3000);
      }
    };
    return peer;
  }
  async function call(id) {
    const peer = makePeer(id, true);
    try {
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      Net.rtc(id, { sdp: peer.pc.localDescription.toJSON ? peer.pc.localDescription.toJSON() : peer.pc.localDescription });
    } catch (e) { closePeer(id); }
  }
  async function onSignal(m) {
    if (!inVoice || hidden.has(m.from)) return;
    const d = m.data || {};
    let peer = peers.get(m.from);
    try {
      if (d.sdp && d.sdp.type === 'offer') {
        if (peer) closePeer(m.from);
        peer = makePeer(m.from, false);
        await peer.pc.setRemoteDescription(d.sdp);
        await peer.pc.setLocalDescription(await peer.pc.createAnswer());
        Net.rtc(m.from, { sdp: peer.pc.localDescription.toJSON ? peer.pc.localDescription.toJSON() : peer.pc.localDescription });
        flush(peer);
      } else if (d.sdp && d.sdp.type === 'answer' && peer) {
        await peer.pc.setRemoteDescription(d.sdp); flush(peer);
      } else if (d.c && peer) {
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(d.c); else peer.pending.push(d.c);
      }
    } catch (e) { console.warn('voice', e); }
  }
  function flush(peer) { peer.pending.splice(0).forEach(c => peer.pc.addIceCandidate(c).catch(() => {})); }
  function closePeer(id) {
    const p = peers.get(id); if (!p) return;
    try { p.pc.close(); } catch (e) {}
    if (p.audio) { p.audio.srcObject = null; }
    peers.delete(id);
  }
  function applyHidden() {
    for (const [id, p] of peers) if (p.audio) p.audio.muted = hidden.has(id);
    sync(); renderLog();
  }

  /* ---------------- hooks from the game ---------------- */
  function init(h) {
    hooks = h; build();
    Net.on('chat', add);
    Net.on('chat-slow', () => note('Slow down a little! 🐌'));
    Net.on('rtc', onSignal);
    Net.on('player', () => sync());
    Net.on('arrived', (p) => { add({ sys: true, text: `👋 ${p.name} joined the room. Go help them!` }); sync(); });
    Net.on('left', (m) => { hidden.delete(m.id); add({ sys: true, text: `${m.name} left the room.` }); sync(); });
    Net.on('joined', () => { log = [{ sys: true, text: `Welcome to room ${Net.code}! Be kind: everyone here is a friend.` }]; unread = 0; badge(); refresh(); });
    Net.on('disconnected', () => { leaveVoice(true); close(); refresh(); });
    Care.onSettings(() => { if (Care.voice !== 'on') leaveVoice(true); if (Care.chat === 'off') close(); refresh(); });
    // the browser tab going away (phone locked) keeps voice; closing the page ends it
    window.addEventListener('pagehide', () => leaveVoice(true));
  }
  function refresh() {
    $('talkBar').hidden = !Net.active || (Care.chat === 'off' && Care.voice === 'off');
    $('chatBtn').textContent = Care.chat === 'off' ? '🔊' : '💬'; $('chatBtn').appendChild($('chatBadge') || Object.assign(document.createElement('span'), { id: 'chatBadge', className: 'badge', hidden: true }));
    renderPeople(); renderVoice(); renderLog();
  }

  return {
    init, refresh, close,
    leave() { leaveVoice(true); close(); log = []; hidden.clear(); refresh(); },
    pauseVoice() { leaveVoice(true); },
    // 0..1 loudness for a player id or 'me' (only while in voice)
    level(id) {
      if (!inVoice) return 0;
      if (id === 'me') return muted || !myLevel ? 0 : myLevel();
      const p = peers.get(id); return p && p.level && !hidden.has(id) ? p.level() : 0;
    },
    isHidden: (id) => hidden.has(id),
    get open() { return open; },
    get inVoice() { return inVoice; },
    toggle() { open ? close() : show(); },
    PHRASES,
  };
})();
