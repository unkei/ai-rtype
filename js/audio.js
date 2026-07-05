// Synthesized sound effects via Web Audio — no external assets.
// The AudioContext can only start after a user gesture; call unlock() on the
// first input edge (the game does this in Game.update).

class AudioSys {
  constructor() {
    this.ctx = null;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  get ready() {
    return this.ctx && this.ctx.state === 'running';
  }

  // One enveloped oscillator. freq may slide to freqEnd over the duration.
  _tone({ freq, freqEnd, dur, type = 'square', vol = 0.15, delay = 0 }) {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // White-noise burst for explosions.
  _noise({ dur, vol = 0.2, delay = 0, lowpass = 1200 }) {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime + delay;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(t0);
  }

  shoot() {
    this._tone({ freq: 880, freqEnd: 330, dur: 0.08, type: 'square', vol: 0.08 });
  }

  beam(level) {
    this._tone({ freq: 220, freqEnd: 1100, dur: 0.18, type: 'sawtooth', vol: 0.14 });
    this._noise({ dur: 0.15 + level * 0.08, vol: 0.1, lowpass: 3000 });
  }

  explode(big = false) {
    this._noise({ dur: big ? 0.6 : 0.28, vol: big ? 0.3 : 0.18, lowpass: big ? 900 : 1400 });
    this._tone({ freq: big ? 120 : 200, freqEnd: 40, dur: big ? 0.5 : 0.25, type: 'triangle', vol: 0.18 });
  }

  hit() {
    this._tone({ freq: 1400, freqEnd: 900, dur: 0.04, type: 'square', vol: 0.04 });
  }

  warning() {
    for (let i = 0; i < 3; i++) {
      this._tone({ freq: 520, freqEnd: 320, dur: 0.32, type: 'sawtooth', vol: 0.12, delay: i * 0.45 });
    }
  }

  gameover() {
    const notes = [392, 311, 262, 196];
    notes.forEach((f, i) => {
      this._tone({ freq: f, dur: 0.34, type: 'triangle', vol: 0.14, delay: i * 0.3 });
    });
  }

  pickupOption() {
    this._tone({ freq: 660, freqEnd: 1320, dur: 0.18, type: 'sine', vol: 0.15 });
    this._tone({ freq: 880, freqEnd: 1760, dur: 0.22, type: 'sine', vol: 0.08, delay: 0.06 });
  }

  start() {
    const notes = [262, 392, 523];
    notes.forEach((f, i) => {
      this._tone({ freq: f, dur: 0.12, type: 'square', vol: 0.1, delay: i * 0.1 });
    });
  }
}

export const audio = new AudioSys();
