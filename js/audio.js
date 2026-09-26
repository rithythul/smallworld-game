// Tiny synthesized sound kit. Everything is generated with WebAudio, no files.
const Sound = (() => {
  let ctx = null, master = null, muted = false, noiseBuf = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }

  const ok = () => ctx && !muted;

  function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, attack = 0.012, out = null } = {}) {
    if (!ok()) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, { freq = 2000, q = 1, vol = 0.4, delay = 0, type = 'bandpass' } = {}) {
    if (!ok()) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  }

  // The world is an instrument: every brick plays a note of a friendly scale, so any crunch pattern sounds nice.
  const PENTA = [0, 2, 4, 7, 9];
  const semis = (i) => PENTA[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);
  const VOICES = {
    marimba: (f, v, o) => { tone(f, 0.45, { vol: 0.32 * v, out: o }); tone(f * 4, 0.08, { vol: 0.08 * v, out: o }); },
    kalimba: (f, v, o) => { tone(f, 0.6, { type: 'triangle', vol: 0.26 * v, out: o }); tone(f * 2.01, 0.2, { vol: 0.07 * v, out: o }); },
    tom: (f, v, o) => { tone(f / 2, 0.4, { vol: 0.5 * v, slide: -f / 5, out: o }); },
    bell: (f, v, o) => { tone(f * 2, 1.3, { vol: 0.16 * v, out: o }); tone(f * 5.52, 0.5, { vol: 0.04 * v, out: o }); tone(f * 2.76 * 2, 0.35, { vol: 0.03 * v, out: o }); },
    glass: (f, v, o) => { tone(f * 2, 0.9, { vol: 0.16 * v, out: o }); tone(f * 6, 0.4, { vol: 0.05 * v, out: o }); },
    flute: (f, v, o) => { tone(f * 2, 0.55, { vol: 0.14 * v, attack: 0.05, out: o }); tone(f * 4, 0.3, { vol: 0.02 * v, attack: 0.05, out: o }); },
    harp: (f, v, o) => { tone(f, 0.7, { type: 'triangle', vol: 0.2 * v, out: o }); tone(f * 2, 0.4, { type: 'triangle', vol: 0.06 * v, out: o }); },
    steel: (f, v, o) => { tone(f, 0.6, { vol: 0.22 * v, out: o }); tone(f * 2.4, 0.4, { vol: 0.07 * v, out: o }); tone(f * 3.9, 0.25, { vol: 0.03 * v, out: o }); },
  };
  function panner(pan) {
    if (!pan || !ctx.createStereoPanner) return null;
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(master); return p;
  }

  return {
    init,
    // i = step in the scale (0, 1, 2...), voice = which instrument, pan = -1 left .. 1 right
    note(i, voice = 'marimba', { vol = 1, pan = 0, harmony = false } = {}) {
      if (!ok()) return;
      const out = panner(pan), f = 261.63 * Math.pow(2, semis(i) / 12);
      (VOICES[voice] || VOICES.marimba)(f, vol, out);
      if (harmony) (VOICES[voice] || VOICES.marimba)(261.63 * Math.pow(2, semis(i + 2) / 12), vol * 0.55, out);
    },
    chord(i, voice = 'bell') { [0, 2, 4].forEach((k, j) => setTimeout(() => this.note(i + k, voice, { vol: 0.8 }), j * 70)); },
    get muted() { return muted; },
    toggle() { muted = !muted; return muted; },
    crunch(power = 1, soft = false) {
      if (soft) { noise(0.05, { freq: 2400, q: 0.8, vol: 0.25 * power }); noise(0.05, { freq: 1600, q: 0.8, vol: 0.2 * power, delay: 0.03 }); return; }
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        noise(0.05 + Math.random() * 0.05, { freq: 1400 + Math.random() * 3200, q: 0.8, vol: 0.5 * power, delay: i * (0.028 + Math.random() * 0.02) });
      }
      tone(140, 0.12, { type: 'triangle', vol: 0.25, slide: -60 });
    },
    gulp() { tone(420, 0.16, { vol: 0.25, slide: -260 }); tone(260, 0.1, { type: 'triangle', vol: 0.12, slide: 200, delay: 0.1 }); },
    splash() { noise(0.45, { freq: 900, q: 0.5, vol: 0.45, type: 'lowpass' }); noise(0.25, { freq: 3000, q: 1, vol: 0.2, delay: 0.05 }); },
    pop() { tone(700 + Math.random() * 400, 0.09, { vol: 0.25, slide: 500 }); },
    step() { noise(0.03, { freq: 600, q: 2, vol: 0.06 }); },
    beep(level) { tone(1200 + level * 400, 0.06, { type: 'square', vol: 0.04 }); },
    blip() { tone(880, 0.07, { type: 'triangle', vol: 0.15 }); },
    talk() { tone(300 + Math.random() * 200, 0.05, { type: 'triangle', vol: 0.08 }); },
    discover() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.22, delay: i * 0.09 })); },
    secret() { [392, 494, 587, 740, 988].forEach((f, i) => tone(f, 0.4, { type: 'sine', vol: 0.2, delay: i * 0.12 })); },
    wrong() { tone(220, 0.18, { type: 'square', vol: 0.08, slide: -80 }); },
    coin() { tone(988, 0.07, { type: 'square', vol: 0.06 }); tone(1319, 0.14, { type: 'square', vol: 0.06, delay: 0.07 }); },
    combo(n) { tone(440 * Math.pow(1.12, Math.min(n, 12)), 0.15, { type: 'triangle', vol: 0.18 }); },
    echo(delay, vol = 0.5) {
      for (let i = 0; i < 4; i++) noise(0.05 + Math.random() * 0.04, { freq: 900 + Math.random() * 1400, q: 1.2, vol: 0.4 * vol, delay: delay + i * 0.035 });
      tone(110, 0.2, { type: 'triangle', vol: 0.2 * vol, slide: -40, delay });
    },
    drum(n = 0) { tone(90 + n * 8, 0.35, { type: 'sine', vol: 0.5, slide: -40 }); noise(0.08, { freq: 300, q: 0.7, vol: 0.3, type: 'lowpass' }); },
    thunder() { noise(1.4, { freq: 180, q: 0.4, vol: 0.7, type: 'lowpass' }); noise(0.5, { freq: 900, q: 0.6, vol: 0.25, delay: 0.05 }); },
    rooster() { [660, 880, 990, 880].forEach((f, i) => tone(f, 0.18, { type: 'sawtooth', vol: 0.05, delay: i * 0.14 })); },
  };
})();
