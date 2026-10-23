/* Áudio 100% procedural — Web Audio, nenhum arquivo */
let ctx = null, master = null, muted = false, flameGain = null, humGain = null, NB = null;
const last = {};

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.4;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    startLoops();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function noiseBuffer(sec = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function startLoops() {
  // chama contínua: ruído em banda, volume segue o nº de fornalhas ativas
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer(); n.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.7;
  flameGain = ctx.createGain(); flameGain.gain.value = 0;
  n.connect(bp).connect(flameGain).connect(master); n.start();
  // zumbido da fábrica
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
  humGain = ctx.createGain(); humGain.gain.value = 0.025;
  o.connect(lp).connect(humGain).connect(master); o.start();
}
function throttle(k, ms) {
  const t = performance.now();
  if (last[k] && t - last[k] < ms) return false;
  last[k] = t; return true;
}
function tone(freq, { type = 'sine', dur = 0.2, gain = 0.15, at = 0, to = null } = {}) {
  if (muted || !ctx) return;
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur, gain, { type = 'lowpass', freq = 800, to = null, at = 0 } = {}) {
  if (muted || !ctx) return;
  const t0 = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = NB || (NB = noiseBuffer(3));
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(master); s.start(t0, Math.random() * Math.max(0, 2.9 - dur)); s.stop(t0 + dur + 0.05);
}

export const audio = {
  unlock: ensure,
  setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.4; },
  get muted() { return muted; },
  flame(level) { if (flameGain) flameGain.gain.setTargetAtTime(muted ? 0 : Math.min(0.22, level * 0.07), ctx.currentTime, 0.08); },
  cannon() { if (!throttle('c', 60)) return; tone(110, { type: 'sine', dur: 0.35, gain: 0.35, to: 40 }); noise(0.25, 0.25, { freq: 1600, to: 200 }); },
  boom() { if (!throttle('b', 50)) return; tone(70, { dur: 0.6, gain: 0.3, to: 28 }); noise(0.6, 0.3, { freq: 900, to: 90 }); },
  zap() {
    if (!throttle('z', 50)) return;
    for (let i = 0; i < 4; i++) tone(900 + Math.random() * 1600, { type: 'sawtooth', dur: 0.05, gain: 0.06, at: i * 0.03, to: 200 });
    noise(0.18, 0.12, { type: 'highpass', freq: 3000 });
  },
  build() { tone(180, { type: 'square', dur: 0.12, gain: 0.08, to: 90 }); noise(0.12, 0.2, { type: 'bandpass', freq: 2400 }); tone(1200, { type: 'triangle', dur: 0.25, gain: 0.05, at: 0.08 }); },
  upgrade() { [0, 1, 2].forEach(i => tone(440 * Math.pow(1.26, i), { type: 'triangle', dur: 0.25, gain: 0.08, at: i * 0.07 })); },
  sell() { tone(600, { type: 'triangle', dur: 0.2, gain: 0.07, to: 300 }); noise(0.2, 0.1, { freq: 1200 }); },
  kill() { if (!throttle('k', 40)) return; tone(260 + Math.random() * 80, { type: 'square', dur: 0.08, gain: 0.04, to: 90 }); },
  leak() { tone(220, { type: 'sawtooth', dur: 0.5, gain: 0.12, to: 110 }); tone(233, { type: 'sawtooth', dur: 0.5, gain: 0.08, at: 0.12, to: 116 }); },
  wave() { tone(98, { type: 'sawtooth', dur: 1.2, gain: 0.12 }); tone(147, { type: 'sawtooth', dur: 1.2, gain: 0.08, at: 0.05 }); noise(1.2, 0.05, { freq: 300 }); },
  deny() { tone(140, { type: 'square', dur: 0.12, gain: 0.06, to: 100 }); },
  click() { tone(1400, { dur: 0.04, gain: 0.03 }); },
  win() { [0, 1, 2, 3, 4].forEach(i => tone(262 * Math.pow(1.26, i), { type: 'triangle', dur: 0.6, gain: 0.1, at: i * 0.1 })); },
  lose() { tone(196, { type: 'sawtooth', dur: 1.6, gain: 0.12, to: 60 }); noise(1.5, 0.12, { freq: 500, to: 60 }); }
};
