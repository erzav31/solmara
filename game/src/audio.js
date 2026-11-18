// Synthesised sound effects with plain WebAudio. No assets, no network.
// Every method is a no-op until the browser has an AudioContext (created on
// the first user gesture) or when muted, so headless tests stay silent.
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
  }

  unlock() {
    if (typeof window === 'undefined' || this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.3;
    let node = src;
    if (lowpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      src.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shot() { this.noise(0.09, 0.5, 1800); this.tone(180, 0.08, 'square', 0.18, 60); }
  punch() { this.noise(0.07, 0.25, 900); }
  crash() { this.noise(0.18, 0.4, 500); this.tone(90, 0.15, 'sine', 0.3, 40); }
  pickup() { this.tone(660, 0.09, 'sine', 0.2, 990); }
  missionDone() { this.tone(523, 0.12, 'sine', 0.22); this.tone(659, 0.12, 'sine', 0.22); this.tone(784, 0.22, 'sine', 0.25); }
  busted() { this.tone(392, 0.25, 'sawtooth', 0.2, 196); }
  wasted() { this.tone(220, 0.5, 'sawtooth', 0.22, 55); }
  denied() { this.tone(140, 0.12, 'square', 0.15, 110); }

  // Continuous engine hum whose pitch follows speed (0..1).
  engine(speed01) {
    if (!this.ctx || this.muted) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.05);
    this.engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0, t, 0.08);
  }

  // Two-tone police siren while wanted.
  siren(on) {
    if (!this.ctx || this.muted) {
      if (this.sirenGain) this.sirenGain.gain.value = 0;
      return;
    }
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.9;
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 750;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this.sirenOn = true;
    }
    if (this.sirenGain) {
      this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.1);
    }
  }
}
