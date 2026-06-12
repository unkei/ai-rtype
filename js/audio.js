// Synthesized audio via Web Audio — chiptune BGM sequencer + layered SFX.
// No external assets: everything is generated from oscillators and noise.
// The AudioContext can only start after a user gesture; call unlock() on the
// first input edge (the game does this in Game.update).

const _ = null; // rest in sequencer patterns

// Expand per-bar pattern builders into one flat step array.
function bars(roots, barFn) {
  const out = [];
  for (const r of roots) out.push(...barFn(r));
  return out;
}

const PROG = [0, -4, 3, -2]; // i — VI — III — VII (Am F C G)

// --------------------------------------------------------------------- songs
//
// One song = tempo + tracks. Patterns are arrays of semitone offsets
// (null = rest), stepped in 16th notes. Drum patterns are strings of
// 'k' kick / 's' snare / 'h' hat per step.

const SONGS = {
  stage: {
    tempo: 128,
    tracks: [
      { inst: 'bass', base: 110, vol: 0.30, dur: 1.3,
        pat: bars(PROG, (r) => [r,_,r,_, r+12,_,r,_, r,_,r+7,_, r+12,_,r+7,_]) },
      { inst: 'lead', base: 440, vol: 0.15, dur: 1.8, pat: [
        0,_,3,_,  7,_,3,_,  5,_,3,_,  0,_,_,_,
        -4,_,0,_, 5,_,0,_,  3,_,0,_,  -4,_,_,_,
        3,_,7,_,  10,_,7,_, 8,_,7,_,  3,_,_,_,
        2,_,5,_,  10,_,9,_, 7,_,5,_,  2,_,_,_,
      ] },
      { inst: 'arp', base: 220, vol: 0.07, dur: 0.9,
        pat: bars(PROG, (r) => [r,r+7,r+12,r+7, r,r+7,r+12,r+7, r,r+7,r+12,r+7, r,r+7,r+12,r+7]) },
      { inst: 'drum', pat: bars([0, 0, 0, 0], () =>
        ['kh',_,'h',_, 'sh',_,'h','k', 'kh',_,'h',_, 'sh',_,'h','h']) },
    ],
  },

  boss: {
    tempo: 150,
    tracks: [
      { inst: 'bass', base: 146.83, vol: 0.30, dur: 0.9, pat: [
        0,0,_,0, 1,_,0,_, 0,0,_,0, 6,_,5,_,
        0,0,_,0, 1,_,0,_, 8,_,7,_, 6,_,5,_,
      ] },
      { inst: 'lead', base: 587.33, vol: 0.13, dur: 1.2, pat: [
        _,_,_,_, 12,13,12,_, _,_,_,_, _,_,_,_,
        _,_,_,_, 12,13,12,_, _,_,18,_, 17,_,13,_,
      ] },
      { inst: 'arp', base: 293.66, vol: 0.06, dur: 0.8, pat: bars([0, 0], (r) =>
        [r,6,12,6, r,6,12,6, r,6,12,6, r,6,12,6]) },
      { inst: 'drum', pat: [
        'kh','h','h','k', 'sh','h','kh','h', 'kh','h','h','k', 'sh','h','h','h',
        'kh','h','h','k', 'sh','h','kh','h', 'kh','h','kh','h', 'sh','h','sh','h',
      ] },
    ],
  },

  title: {
    tempo: 100,
    tracks: [
      { inst: 'pad', base: 220, vol: 0.12, dur: 3.5, pat: [
        0,_,7,_,  12,_,14,_, 15,_,14,_, 12,_,7,_,
        -4,_,3,_, 8,_,12,_,  15,_,12,_, 8,_,3,_,
      ] },
      { inst: 'bass', base: 110, vol: 0.18, dur: 10, pat: [
        0,_,_,_, _,_,_,_, _,_,_,_, _,_,_,_,
        -4,_,_,_, _,_,_,_, _,_,_,_, _,_,_,_,
      ] },
    ],
  },
};

// Each stage shifts the key, pushes the tempo, and swaps the lead timbre so
// loops feel like new stages rather than a repeat.
const STAGE_KEYS = [0, 3, -2, 5];

// --------------------------------------------------------------------- audio

class AudioSys {
  constructor() {
    this.ctx = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.musicVol = 0.34;

    // sequencer state
    this._want = null;     // { name, stage } — desired song, survives pre-unlock
    this._playing = null;  // currently scheduled song key ("name:stage")
    this._step = 0;
    this._nextT = 0;
    this._timer = null;

    this._charge = null;   // persistent charge-loop nodes
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();

        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.ratio.value = 6;
        comp.connect(this.ctx.destination);
        this._out = comp;

        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = 0.9;
        this.sfxBus.connect(comp);

        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = this.musicVol;
        this.musicBus.connect(comp);

        // light feedback delay on the music bus for depth
        const delay = this.ctx.createDelay(0.5);
        delay.delayTime.value = 0.23;
        const fb = this.ctx.createGain();
        fb.gain.value = 0.22;
        const wet = this.ctx.createGain();
        wet.gain.value = 0.18;
        this.musicBus.connect(delay);
        delay.connect(fb).connect(delay);
        delay.connect(wet).connect(comp);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (!this._timer) this._timer = setInterval(() => this._tick(), 30);
    } catch {
      this.ctx = null;
    }
  }

  get ready() {
    return this.ctx && this.ctx.state === 'running';
  }

  // ----------------------------------------------------------------- music

  playMusic(name, stage = 0) {
    if (this._want && this._want.name === name && this._want.stage === stage) return;
    this._want = { name, stage };
  }

  stopMusic(fade = 0.4) {
    this._want = null;
    this._playing = null;
    if (!this.ready || !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, t);
    this.musicBus.gain.exponentialRampToValueAtTime(0.001, t + fade);
  }

  _tick() {
    if (!this.ready || !this._want) return;
    const key = `${this._want.name}:${this._want.stage}`;
    if (this._playing !== key) {
      this._playing = key;
      this._step = 0;
      this._nextT = this.ctx.currentTime + 0.06;
      const t = this.ctx.currentTime;
      this.musicBus.gain.cancelScheduledValues(t);
      this.musicBus.gain.setValueAtTime(this.musicVol, t);
    }

    const song = SONGS[this._want.name];
    const stage = this._want.stage;
    const tempo = song.tempo + Math.min(stage, 6) * 4;
    const stepDur = 60 / tempo / 4;
    const trans = STAGE_KEYS[stage % STAGE_KEYS.length];
    const leadType = stage % 2 === 0 ? 'square' : 'sawtooth';

    while (this._nextT < this.ctx.currentTime + 0.15) {
      for (const tr of song.tracks) {
        const v = tr.pat[this._step % tr.pat.length];
        if (v === null || v === undefined) continue;
        if (tr.inst === 'drum') {
          this._drum(v, this._nextT);
        } else {
          const freq = tr.base * Math.pow(2, (v + trans) / 12);
          this._mNote(tr.inst, freq, this._nextT, stepDur * tr.dur, tr.vol, leadType);
        }
      }
      this._nextT += stepDur;
      this._step++;
    }
  }

  _mNote(inst, freq, t, dur, vol, leadType) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    let type = 'square';
    if (inst === 'bass') type = 'triangle';
    if (inst === 'lead') type = leadType;
    if (inst === 'pad') type = 'triangle';
    if (inst === 'arp') type = 'square';
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    if (inst === 'lead' || inst === 'pad') {
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 5.5;
      lfoGain.gain.value = freq * 0.006;
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  _drum(kinds, t) {
    if (kinds.includes('k')) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.11);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.connect(gain).connect(this.musicBus);
      osc.start(t);
      osc.stop(t + 0.15);
    }
    if (kinds.includes('s')) {
      this._noise({ dur: 0.09, vol: 0.22, at: t, filter: ['bandpass', 1900], bus: this.musicBus });
    }
    if (kinds.includes('h')) {
      this._noise({ dur: 0.03, vol: 0.08, at: t, filter: ['highpass', 7000], bus: this.musicBus });
    }
  }

  // ------------------------------------------------------------ SFX helpers

  // One enveloped oscillator. freq may slide to freqEnd over the duration.
  _tone({ freq, freqEnd, dur, type = 'square', vol = 0.15, delay = 0, detune = 0 }) {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Filtered white-noise burst.
  _noise({ dur, vol = 0.2, delay = 0, filter = ['lowpass', 1200], at = null, bus = null }) {
    if (!this.ready) return;
    const t0 = at !== null ? at : this.ctx.currentTime + delay;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = filter[0];
    f.frequency.value = filter[1];
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(gain).connect(bus || this.sfxBus);
    src.start(t0);
  }

  // ------------------------------------------------------------------- SFX

  shoot() {
    this._tone({ freq: 880, freqEnd: 320, dur: 0.07, type: 'square', vol: 0.06 });
    this._tone({ freq: 1240, freqEnd: 380, dur: 0.05, type: 'square', vol: 0.04, detune: 9 });
  }

  beam(level) {
    this._tone({ freq: 160, freqEnd: 1400, dur: 0.22 + level * 0.05, type: 'sawtooth', vol: 0.16 });
    this._tone({ freq: 70, freqEnd: 200, dur: 0.3, type: 'sine', vol: 0.2 });
    this._noise({ dur: 0.18 + level * 0.1, vol: 0.12, filter: ['highpass', 1200] });
  }

  explode(big = false) {
    this._noise({ dur: big ? 0.7 : 0.3, vol: big ? 0.32 : 0.2, filter: ['lowpass', big ? 800 : 1400] });
    this._tone({ freq: big ? 110 : 190, freqEnd: 36, dur: big ? 0.55 : 0.28, type: 'triangle', vol: 0.22 });
    // debris crackle
    for (let i = 1; i <= (big ? 3 : 1); i++) {
      this._noise({ dur: 0.05, vol: 0.08, delay: 0.08 * i, filter: ['bandpass', 2600] });
    }
  }

  hit() {
    this._tone({ freq: 1400, freqEnd: 900, dur: 0.04, type: 'square', vol: 0.04 });
    this._noise({ dur: 0.025, vol: 0.04, filter: ['highpass', 4000] });
  }

  powerup() {
    [0, 4, 7, 12].forEach((s, i) => {
      this._tone({ freq: 660 * Math.pow(2, s / 12), dur: 0.09, type: 'square', vol: 0.1, delay: i * 0.06 });
    });
    this._tone({ freq: 2640, dur: 0.3, type: 'sine', vol: 0.05, delay: 0.24 });
  }

  stageClear() {
    const line = [0, 4, 7, 12, _, 12, 16, 19];
    line.forEach((s, i) => {
      if (s === null) return;
      const f = 523 * Math.pow(2, s / 12);
      this._tone({ freq: f, dur: 0.22, type: 'square', vol: 0.12, delay: i * 0.13 });
      this._tone({ freq: f / 2, dur: 0.26, type: 'triangle', vol: 0.1, delay: i * 0.13 });
    });
  }

  warning() {
    for (let i = 0; i < 3; i++) {
      this._tone({ freq: 520, freqEnd: 310, dur: 0.34, type: 'sawtooth', vol: 0.11, delay: i * 0.45 });
      this._tone({ freq: 524, freqEnd: 314, dur: 0.34, type: 'sawtooth', vol: 0.09, delay: i * 0.45, detune: 12 });
    }
  }

  gameover() {
    const notes = [392, 311, 262, 196];
    notes.forEach((f, i) => {
      this._tone({ freq: f, dur: 0.36, type: 'triangle', vol: 0.14, delay: i * 0.3 });
      this._tone({ freq: f / 2, dur: 0.4, type: 'sine', vol: 0.1, delay: i * 0.3 });
    });
    this._noise({ dur: 0.8, vol: 0.1, delay: 1.2, filter: ['lowpass', 500] });
  }

  // ------------------------------------------------------ charge-beam loop

  chargeStart() {
    if (!this.ready || this._charge) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, t);
    filter.Q.value = 4;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.09, t + 0.15);
    // tremolo shimmer
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 16;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(gain.gain);
    osc.connect(filter).connect(gain).connect(this.sfxBus);
    osc.start(t);
    lfo.start(t);
    this._charge = { osc, filter, gain, lfo };
  }

  chargeSet(ratio) {
    if (!this._charge || !this.ready) return;
    const t = this.ctx.currentTime;
    this._charge.osc.frequency.setTargetAtTime(90 + ratio * 540, t, 0.06);
    this._charge.filter.frequency.setTargetAtTime(300 + ratio * 2200, t, 0.06);
    this._charge.lfo.frequency.setTargetAtTime(16 + ratio * 14, t, 0.1);
  }

  chargeEnd() {
    if (!this._charge || !this.ctx) return;
    const { osc, gain, lfo } = this._charge;
    this._charge = null;
    try {
      const t = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.stop(t + 0.1);
      lfo.stop(t + 0.1);
    } catch {
      // nodes may already be stopped if the context was recreated
    }
  }
}

export const audio = new AudioSys();
