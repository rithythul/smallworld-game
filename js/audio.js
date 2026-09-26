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

  function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
    if (!ok()) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
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

  return {
    init,
    get muted() { return muted; },
    toggle() { muted = !muted; return muted; },
    crunch(power = 1) {
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
    rooster() { [660, 880, 990, 880].forEach((f, i) => tone(f, 0.18, { type: 'sawtooth', vol: 0.05, delay: i * 0.14 })); },
  };
})();
