// Semua suara disintesis WebAudio — tanpa file audio sama sekali.
// Aman dipanggil di headless (tanpa AudioContext): semua method jadi no-op.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx || typeof window === 'undefined') return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  _tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      /* abaikan */
    }
  }

  _noise(dur, vol = 0.3, low = 400) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = low;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t0);
    } catch {
      /* abaikan */
    }
  }

  click() {
    this._tone(660, 0.06, 'square', 0.12);
  }
  shot() {
    this._noise(0.14, 0.5, 1800);
    this._tone(180, 0.1, 'square', 0.2, 60);
  }
  punch() {
    this._noise(0.08, 0.3, 500);
  }
  crash() {
    this._noise(0.25, 0.45, 700);
    this._tone(90, 0.2, 'sawtooth', 0.2, 40);
  }
  pickup() {
    this._tone(523, 0.1, 'sine', 0.25);
    this._tone(784, 0.16, 'sine', 0.25, null, 0.09);
  }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.18, 'triangle', 0.25, null, i * 0.11));
  }
  busted() {
    this._tone(392, 0.25, 'sawtooth', 0.2, 196);
    this._tone(311, 0.4, 'sawtooth', 0.2, 155, 0.22);
  }
  sirenBlip() {
    this._tone(880, 0.12, 'sine', 0.1, 660);
  }
  engineStart() {
    this._tone(70, 0.35, 'sawtooth', 0.18, 140);
  }
  reload() {
    this._tone(300, 0.05, 'square', 0.12);
    this._tone(420, 0.05, 'square', 0.12, null, 0.08);
  }

  // Dengung mesin mengikuti kecepatan mobil; dipanggil tiap frame.
  setEngine(speedRatio, active) {
    if (!this.ctx || this.muted) return;
    try {
      if (!active || speedRatio <= 0.01) {
        if (this.engineOsc) {
          this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        }
        return;
      }
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 500;
        this.engineOsc.connect(f);
        f.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      const freq = 55 + speedRatio * 130;
      this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.08);
      this.engineGain.gain.setTargetAtTime(0.05 + speedRatio * 0.05, this.ctx.currentTime, 0.1);
    } catch {
      /* abaikan */
    }
  }
}
