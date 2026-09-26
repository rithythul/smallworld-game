// Soft, warm sound kit, all made with WebAudio (no files).
// Everything goes through a gentle chain: a low-pass filter (no harsh highs), a little room echo,
// and a compressor so nothing is ever too loud.
const Sound = (() => {
  let ctx = null, master = null, dry = null, verb = null, muted = false, noiseBuf = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 20; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
      const soft = ctx.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 4200; soft.Q.value = 0.5;
      master = ctx.createGain(); master.gain.value = 0.42;
      master.connect(soft); soft.connect(comp); comp.connect(ctx.destination);
      // a small, soft room
      const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      conv.buffer = ir; verb = ctx.createGain(); verb.gain.value = 0.16; verb.connect(conv); conv.connect(master);
      dry = master;
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }

  const ok = () => ctx && !muted;
  function out(g, node, wet = true) { g.connect(node || dry); if (wet && verb) g.connect(verb); }

  function tone(freq, dur, { type = 'sine', vol = 0.2, slide = 0, delay = 0, attack = 0.01, dest = null, wet = true } = {}) {
    if (!ok()) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); out(g, dest, wet);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, { freq = 1200, q = 1, vol = 0.2, delay = 0, type = 'bandpass', wet = false } = {}) {
    if (!ok()) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); out(g, null, wet);
    s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  }
  // a warm plucked note: a sine with a soft octave, like a kalimba
  const pluck = (f, vol = 0.18, delay = 0, dur = 0.5, dest = null) => { tone(f, dur, { vol, delay, dest }); tone(f * 2, dur * 0.5, { vol: vol * 0.18, delay, dest }); };

  // Musical notes on a friendly scale (pentatonic), so any pattern sounds nice
  const PENTA = [0, 2, 4, 7, 9];
  const semis = (i) => PENTA[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);
  const hz = (i) => 261.63 * Math.pow(2, semis(i) / 12);
  const VOICES = {
    marimba: (f, v, d) => pluck(f, 0.16 * v, 0, 0.45, d),
    kalimba: (f, v, d) => pluck(f, 0.14 * v, 0, 0.6, d),
    tom: (f, v, d) => tone(f / 2, 0.35, { vol: 0.22 * v, slide: -f / 6, dest: d }),
    bell: (f, v, d) => { tone(f * 2, 1.1, { vol: 0.08 * v, dest: d }); tone(f * 4, 0.5, { vol: 0.015 * v, dest: d }); },
    glass: (f, v, d) => { tone(f * 2, 0.8, { vol: 0.09 * v, dest: d }); tone(f * 3, 0.35, { vol: 0.02 * v, dest: d }); },
    flute: (f, v, d) => tone(f * 2, 0.55, { vol: 0.08 * v, attack: 0.06, dest: d }),
    harp: (f, v, d) => pluck(f, 0.13 * v, 0, 0.8, d),
    steel: (f, v, d) => { tone(f, 0.55, { vol: 0.12 * v, dest: d }); tone(f * 2.4, 0.3, { vol: 0.03 * v, dest: d }); },
  };
  function panner(pan) {
    if (!pan || !ctx.createStereoPanner) return null;
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(dry); if (verb) p.connect(verb); return p;
  }

  return {
    init,
    get muted() { return muted; },
    toggle() { muted = !muted; return muted; },
    note(i, voice = 'marimba', { vol = 1, pan = 0, harmony = false } = {}) {
      if (!ok()) return;
      const d = panner(pan);
      (VOICES[voice] || VOICES.marimba)(hz(i), vol, d);
      if (harmony) (VOICES[voice] || VOICES.marimba)(hz(i + 2), vol * 0.45, d);
    },
    chord(i, voice = 'bell') { [0, 2, 4].forEach((k, j) => setTimeout(() => this.note(i + k, voice, { vol: 0.8 }), j * 80)); },
    // a soft, crisp crunch: a few filtered clicks and a low thump
    crunch(power = 1, soft = false) {
      const n = soft ? 2 : 3;
      for (let i = 0; i < n; i++) noise(0.04 + Math.random() * 0.03, { freq: 1300 + Math.random() * 1200, q: 0.9, vol: 0.22 * power, delay: i * 0.035 });
      if (!soft) tone(120, 0.12, { vol: 0.14 * power, slide: -40, wet: false });
    },
    gulp() { tone(360, 0.14, { vol: 0.12, slide: -180 }); tone(240, 0.1, { vol: 0.06, slide: 120, delay: 0.1 }); },
    splash() { noise(0.4, { freq: 700, q: 0.5, vol: 0.2, type: 'lowpass', wet: true }); },
    pop() { tone(620 + Math.random() * 200, 0.08, { vol: 0.1, slide: 300 }); },
    step() { noise(0.03, { freq: 500, q: 2, vol: 0.03 }); },
    beep(level) { tone(700 + level * 200, 0.08, { vol: 0.03 }); },
    blip() { tone(660, 0.07, { type: 'triangle', vol: 0.06 }); },
    talk() { tone(260 + Math.random() * 120, 0.05, { vol: 0.035, wet: false }); },
    discover() { [523, 659, 784, 1047].forEach((f, i) => pluck(f, 0.1, i * 0.09, 0.4)); },
    secret() { [392, 494, 587, 740].forEach((f, i) => pluck(f, 0.09, i * 0.12, 0.6)); },
    wrong() { tone(260, 0.16, { type: 'triangle', vol: 0.06, slide: -60 }); },
    coin() { pluck(988, 0.07, 0, 0.15); pluck(1319, 0.07, 0.07, 0.25); },
    combo(n) { pluck(440 * Math.pow(1.12, Math.min(n, 12)), 0.08); },
    echo(delay, vol = 0.5) {
      for (let i = 0; i < 3; i++) noise(0.05, { freq: 900 + Math.random() * 800, q: 1.2, vol: 0.18 * vol, delay: delay + i * 0.04 });
      tone(110, 0.2, { vol: 0.1 * vol, slide: -30, delay });
    },
    drum(n = 0) { tone(90 + n * 8, 0.35, { vol: 0.28, slide: -40 }); noise(0.07, { freq: 300, q: 0.7, vol: 0.12, type: 'lowpass' }); },
    thunder() { noise(1.4, { freq: 160, q: 0.4, vol: 0.35, type: 'lowpass', wet: true }); },
    rooster() { [523, 659, 784].forEach((f, i) => pluck(f, 0.07, i * 0.14, 0.35)); },
    // Small World sounds
    chop() { tone(180, 0.12, { type: 'triangle', vol: 0.18, slide: -60, wet: false }); noise(0.06, { freq: 900, q: 1, vol: 0.14 }); },
    cash() { pluck(784, 0.08, 0, 0.2); pluck(1175, 0.08, 0.08, 0.35); },
    plant() { tone(330, 0.12, { vol: 0.08, slide: 80 }); noise(0.05, { freq: 500, q: 1, vol: 0.06 }); },
    water() { noise(0.35, { freq: 1500, q: 0.6, vol: 0.08, type: 'lowpass' }); tone(520, 0.12, { vol: 0.04, slide: 160, delay: 0.05 }); },
    hammer() { tone(220, 0.08, { type: 'triangle', vol: 0.14, slide: -50, wet: false }); noise(0.04, { freq: 2000, q: 1, vol: 0.08 }); },
    bell() { [659, 784, 988].forEach((f, i) => tone(f, 0.9, { vol: 0.05, delay: i * 0.18 })); },
  };
})();
