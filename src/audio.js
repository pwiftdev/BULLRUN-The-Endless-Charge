/* Tiny procedural sound kit — no assets, everything synthesized. */
export class AudioFX {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.5 : 0;
      this.master.connect(this.ctx.destination);

      // Looping wind bed, volume follows speed.
      const noise = this.noiseBuffer(2);
      const src = this.ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.value = 400;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      src.connect(this.windFilter).connect(this.windGain).connect(this.master);
      src.start();
    } catch {
      this.ctx = null;
    }
  }

  noiseBuffer(seconds) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  setWind(n) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0.02 + 0.1 * n, t, 0.4);
    this.windFilter.frequency.setTargetAtTime(300 + 1000 * n, t, 0.4);
  }

  tone(freq, endFreq, dur, type, vol, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noiseHit(dur, vol, freq = 800, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur);
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  thud(vol = 0.5) { this.tone(85, 42, 0.11, 'sine', 0.16 * vol); }
  jump() { this.noiseHit(0.18, 0.1, 1600, 'highpass'); this.tone(220, 440, 0.16, 'sine', 0.08); }
  slideFx() { this.noiseHit(0.28, 0.12, 500); }
  swish() { this.noiseHit(0.1, 0.06, 2200, 'highpass'); }
  coin() { this.tone(950, 950, 0.07, 'sine', 0.11); this.tone(1420, 1420, 0.12, 'sine', 0.1, 0.06); }
  hit() {
    this.tone(120, 30, 0.4, 'sine', 0.35);
    this.noiseHit(0.35, 0.25, 500);
  }
  biomeChime() { this.tone(520, 780, 0.5, 'sine', 0.06); }

  toggle() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.value = this.enabled ? 0.5 : 0;
    return this.enabled;
  }
}
