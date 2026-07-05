// Synthesized sound effects and BGM via Web Audio — no external assets.
// The AudioContext can only start after a user gesture; call unlock() on the
// first input edge (the game does this in Game.update).

// ------------------------------------------------------------------ BGM

// Look-ahead scheduler for chip-tune BGM patterns.
// Each "step" is an eighth-note; 16 steps = one measure.
class BGMPlayer {
  constructor() {
    this._ctx = null;
    this._master = null;
    this._timerID = null;
    this._nextBeat = 0;
    this._step = 0;
    this._mode = 'none';  // 'stage' | 'boss' | 'none'
  }

  get _bpm()  { return this._mode === 'boss' ? 162 : 138; }
  get _beat() { return 60 / this._bpm / 2; }  // eighth-note duration

  start(ctx, mode) {
    if (!ctx) return;
    if (this._mode === mode) return;
    this._ctx = ctx;
    this._fadeOut();
    if (mode === 'none') return;

    this._mode = mode;
    this._master = ctx.createGain();
    this._master.gain.setValueAtTime(0.001, ctx.currentTime);
    this._master.gain.linearRampToValueAtTime(0.65, ctx.currentTime + 0.8);
    this._master.connect(ctx.destination);

    this._nextBeat = ctx.currentTime + 0.1;
    this._step = 0;
    this._tick();
  }

  stop() {
    this._fadeOut();
    this._mode = 'none';
  }

  _fadeOut() {
    if (this._timerID) { clearTimeout(this._timerID); this._timerID = null; }
    if (this._master) {
      const g = this._master;
      g.gain.setValueAtTime(g.gain.value, this._ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, this._ctx.currentTime + 0.35);
      setTimeout(() => { try { g.disconnect(); } catch {} }, 500);
      this._master = null;
    }
  }

  _tick() {
    if (!this._master || !this._ctx) return;
    const LOOKAHEAD = 0.1;
    while (this._nextBeat < this._ctx.currentTime + LOOKAHEAD) {
      if (this._mode === 'stage') this._stageBeat(this._nextBeat, this._step);
      else if (this._mode === 'boss') this._bossBeat(this._nextBeat, this._step);
      this._nextBeat += this._beat;
      this._step = (this._step + 1) % 16;
    }
    this._timerID = setTimeout(() => this._tick(), 40);
  }

  // --- Stage BGM: A natural minor, driving arpeggios ---

  _stageBeat(t, s) {
    //          0      1      2      3      4      5      6      7
    //          8      9     10     11     12     13     14     15
    const BASS = [
      110,   110,   131,   131,   147,   147,   131,   131,
      110,   110,   124,   124,   131,   131,   165,   147,
    ];
    const MEL = [
      330,     0,   262,     0,   294,   330,   294,   262,
      220,     0,   247,     0,   262,   294,   330,     0,
    ];

    this._bgmNote(BASS[s], t, 0.19, 'square', 0.065);
    if (MEL[s] > 0) this._bgmNote(MEL[s], t, 0.15, 'sawtooth', 0.038);

    if (s === 0 || s === 8)  this._bgmKick(t);
    if (s === 4 || s === 12) this._bgmSnare(t);
    this._bgmHihat(t, 0.022);
  }

  // --- Boss BGM: E Phrygian, fast & aggressive ---

  _bossBeat(t, s) {
    const BASS = [
      82.4,  82.4,  87.3,  82.4,   98,   87.3,  82.4,  82.4,
      82.4,  82.4,  87.3,  82.4,  110,    98,   87.3,  82.4,
    ];
    const MEL = [
      330,     0,   311,   330,   349,   330,   311,     0,
      294,     0,   311,   330,     0,   349,     0,   311,
    ];

    this._bgmNote(BASS[s], t, 0.15, 'square', 0.082);
    if (MEL[s] > 0) this._bgmNote(MEL[s], t, 0.12, 'sawtooth', 0.048);

    if (s % 4 === 0) this._bgmKick(t);
    if (s === 2 || s === 6 || s === 10 || s === 14) this._bgmSnare(t);
    this._bgmHihat(t, 0.032);
  }

  // --- Percussion helpers (go direct to ctx.destination, not _master) ---

  _bgmKick(t) {
    if (!this._ctx) return;
    const osc = this._ctx.createOscillator();
    const g   = this._ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.14);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g).connect(this._ctx.destination);
    osc.start(t); osc.stop(t + 0.2);
  }

  _bgmSnare(t) {
    if (!this._ctx) return;
    const n   = Math.ceil(this._ctx.sampleRate * 0.11);
    const buf = this._ctx.createBuffer(1, n, this._ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src  = this._ctx.createBufferSource();
    src.buffer = buf;
    const flt  = this._ctx.createBiquadFilter();
    flt.type   = 'highpass';
    flt.frequency.value = 1800;
    const g    = this._ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    src.connect(flt).connect(g).connect(this._ctx.destination);
    src.start(t);
  }

  _bgmHihat(t, vol) {
    if (!this._ctx) return;
    const n   = Math.ceil(this._ctx.sampleRate * 0.04);
    const buf = this._ctx.createBuffer(1, n, this._ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src  = this._ctx.createBufferSource();
    src.buffer = buf;
    const flt  = this._ctx.createBiquadFilter();
    flt.type   = 'highpass';
    flt.frequency.value = 8500;
    const g    = this._ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(flt).connect(g).connect(this._ctx.destination);
    src.start(t);
  }

  _bgmNote(freq, t, dur, type, vol) {
    if (!this._ctx || !this._master) return;
    const osc = this._ctx.createOscillator();
    const g   = this._ctx.createGain();
    osc.type  = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this._master);
    osc.start(t); osc.stop(t + dur + 0.01);
  }
}

// ----------------------------------------------------------------- SFX

class AudioSys {
  constructor() {
    this.ctx = null;
    this._bgm = new BGMPlayer();
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

  // ---- BGM controls ----

  bgmStage() { this._bgm.start(this.ctx, 'stage'); }
  bgmBoss()  { this._bgm.start(this.ctx, 'boss'); }
  bgmStop()  { this._bgm.stop(); }

  // ---- SFX helpers ----

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

  // ---- SFX ----

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

  // Boss warning: three descending siren blips + sustained low drone
  warning() {
    for (let i = 0; i < 3; i++) {
      this._tone({ freq: 580, freqEnd: 300, dur: 0.34, type: 'sawtooth', vol: 0.13, delay: i * 0.5 });
    }
    this._tone({ freq: 120, freqEnd: 80, dur: 1.4, type: 'triangle', vol: 0.1, delay: 0.2 });
  }

  gameover() {
    this.bgmStop();
    const notes = [392, 311, 262, 196];
    notes.forEach((f, i) => {
      this._tone({ freq: f, dur: 0.34, type: 'triangle', vol: 0.14, delay: i * 0.3 });
    });
  }

  bossPhase2() {
    for (let i = 0; i < 4; i++) {
      this._tone({ freq: 640 - i * 60, freqEnd: 200, dur: 0.26, type: 'sawtooth', vol: 0.13, delay: i * 0.18 });
    }
    this._tone({ freq: 300, freqEnd: 1200, dur: 0.6, type: 'sine', vol: 0.18, delay: 0.7 });
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
