// Enemies, wave scripting, and enemy bullets.
import { W, H } from './config.js';

const LOOP_T = 55;            // wave script length in seconds; repeats harder

// ------------------------------------------------------------- enemy types

class Enemy {
  constructor(x, y, rank) {
    this.x = x;
    this.y = y;
    this.rank = rank;         // difficulty multiplier, grows per loop
    this.hp = 1;
    this.radius = 16;         // matches the larger 3D models
    this.score = 100;
    this.dead = false;
    this.t = 0;
  }

  update(dt, ctxGame) {
    this.t += dt;
    this.move(dt, ctxGame);
    if (this.x < -60 || this.y < -60 || this.y > H + 60) this.dead = true;
  }

  move(dt) {}
}

// Drifts straight left in formation rows.
export class Straight extends Enemy {
  constructor(x, y, rank) {
    super(x, y, rank);
    this.hp = 1;
    this.score = 100;
    this.speed = 170 * rank;
  }

  move(dt) {
    this.x -= this.speed * dt;
    this.y += Math.sin(this.t * 3) * 14 * dt;
  }
}

// Sweeps in on a sine wave.
export class Sine extends Enemy {
  constructor(x, y, rank) {
    super(x, y, rank);
    this.hp = 2;
    this.score = 200;
    this.baseY = y;
    this.speed = 150 * rank;
    this.amp = 70 + Math.random() * 40;
    this.freq = 2 + Math.random();
  }

  move(dt) {
    this.x -= this.speed * dt;
    this.y = this.baseY + Math.sin(this.t * this.freq) * this.amp;
  }
}

// Slides in, locks on, then dashes at the player's position.
export class Dart extends Enemy {
  constructor(x, y, rank) {
    super(x, y, rank);
    this.hp = 1;
    this.score = 150;
    this.phase = 'enter';     // enter → aim → dash
    this.vx = -220 * rank;
    this.vy = 0;
  }

  move(dt, { player }) {
    if (this.phase === 'enter') {
      this.x += this.vx * dt;
      if (this.x < W * 0.78) {
        this.phase = 'aim';
        this.aimT = 0.35;
        this.vx = 0;
      }
    } else if (this.phase === 'aim') {
      this.aimT -= dt;
      if (this.aimT <= 0 && player) {
        const a = Math.atan2(player.y - this.y, player.x - this.x);
        const v = 430 * this.rank;
        this.vx = Math.cos(a) * v;
        this.vy = Math.sin(a) * v;
        this.phase = 'dash';
      }
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
  }
}

// Ground turret riding the terrain strip; fires aimed shots.
export class Turret extends Enemy {
  constructor(x, top, rank) {
    super(x, top ? 44 : H - 44, rank);
    this.top = top;
    this.hp = 3;
    this.score = 300;
    this.radius = 19;
    this.fireT = 1.2 / rank;
  }

  move(dt, { player, bullets }) {
    this.x -= 120 * dt;       // matches terrain scroll speed
    this.fireT -= dt;
    if (this.fireT <= 0 && player && this.x < W - 40 && this.x > 60) {
      this.fireT = Math.max(1.6 / this.rank, 0.55);
      const a = Math.atan2(player.y - this.y, player.x - this.x);
      const v = 170 + 40 * this.rank;
      bullets.push({
        x: this.x, y: this.y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        r: 4, dead: false,
      });
    }
  }
}

// Homing enemy: gradually turns toward the player, fires burst on approach.
export class Homing extends Enemy {
  constructor(x, y, rank) {
    super(x, y, rank);
    this.hp = 2;
    this.score = 250;
    this.radius = 15;
    this.speed = 130 * rank;
    this.angle = Math.PI;     // start heading left
    this.turnRate = 1.4 * rank;
    this.fireT = 1.8;
  }

  move(dt, { player, bullets }) {
    if (player) {
      const desired = Math.atan2(player.y - this.y, player.x - this.x);
      let diff = desired - this.angle;
      // shortest arc
      while (diff > Math.PI)  diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += Math.sign(diff) * Math.min(Math.abs(diff), this.turnRate * dt);
    }
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;

    this.fireT -= dt;
    if (this.fireT <= 0 && player && Math.hypot(player.x - this.x, player.y - this.y) < 320) {
      this.fireT = Math.max(2.2 / this.rank, 0.9);
      const a = Math.atan2(player.y - this.y, player.x - this.x);
      const v = 140 + 30 * this.rank;
      bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 5, dead: false });
    }
  }
}

// MineLayer: drifts across screen dropping stationary mines.
export class MineLayer extends Enemy {
  constructor(x, y, rank) {
    super(x, y, rank);
    this.hp = 2;
    this.score = 200;
    this.radius = 14;
    this.speed = 110 * rank;
    this.dropT = 1.0;
  }

  move(dt, { bullets }) {
    this.x -= this.speed * dt;
    this.y += Math.sin(this.t * 1.5) * 30 * dt;
    this.dropT -= dt;
    if (this.dropT <= 0 && this.x < W - 40 && this.x > 60) {
      this.dropT = Math.max(2.0 / this.rank, 0.8);
      // Drop a slow-drifting mine (tiny vy, stays mostly in place)
      bullets.push({
        x: this.x, y: this.y,
        vx: -15, vy: 0,
        r: 7, dead: false,
        isMine: true,
      });
    }
  }
}

// Loop-end boss: large core ship with spread / ring / beam attacks.
// Phase 2 activates below 50% HP for faster, more varied attacks.
export class Boss extends Enemy {
  constructor(rank) {
    super(W + 120, H / 2, rank);
    this.hp = Math.round(65 * rank);
    this.maxHp = this.hp;
    this.radius = 42;
    this.score = 5000;
    this.phase = 'enter';
    this.attackT = 1.2;
    this.hitFlash = 0;
    this._phase2Announced = false;
  }

  get isPhase2() {
    return this.hp < this.maxHp * 0.5;
  }

  move(dt, { player, bullets }) {
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    if (this.phase === 'enter') {
      this.x -= 130 * dt;
      if (this.x <= W - 150) this.phase = 'fight';
      return;
    }

    // Phase 2: tighter vertical sweep
    const sweep = this.isPhase2 ? H / 2 - 120 : H / 2 - 155;
    this.y = H / 2 + Math.sin(this.t * (this.isPhase2 ? 1.1 : 0.8)) * sweep;

    this.attackT -= dt;
    if (this.attackT > 0 || !player) return;

    const v = this.isPhase2
      ? 240 + 45 * this.rank
      : 180 + 35 * this.rank;

    const roll = Math.random();
    if (this.isPhase2 && roll < 0.25) {
      // Phase 2 only: dense 5-way spread
      const base = Math.atan2(player.y - this.y, player.x - this.x);
      for (const off of [-0.38, -0.19, 0, 0.19, 0.38]) {
        bullets.push({ x: this.x - 24, y: this.y, vx: Math.cos(base + off) * v, vy: Math.sin(base + off) * v, r: 5, dead: false });
      }
      this.attackT = Math.max(0.9 / this.rank, 0.38);
    } else if (roll < 0.6) {
      // 3-way aimed spread
      const base = Math.atan2(player.y - this.y, player.x - this.x);
      for (const off of [-0.22, 0, 0.22]) {
        bullets.push({ x: this.x - 24, y: this.y, vx: Math.cos(base + off) * v, vy: Math.sin(base + off) * v, r: 5, dead: false });
      }
      this.attackT = Math.max(1.1 / this.rank, 0.4);
    } else {
      // bullet ring — more bullets in phase 2
      const n = this.isPhase2 ? 14 : 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + this.t;
        bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * v * 0.8, vy: Math.sin(a) * v * 0.8, r: 4, dead: false });
      }
      this.attackT = Math.max(1.6 / this.rank, 0.65);
    }
  }
}

// --------------------------------------------------------------- manager

export class EnemyManager {
  constructor() {
    this.enemies = [];
    this.bullets = [];        // enemy bullets: {x,y,vx,vy,r,dead[,isMine]}
    this.t = 0;
    this.loop = 0;
    this.script = this._buildScript();
    this.idx = 0;
    this.spawningEnabled = true;
    this.phase = 'waves';     // waves → warning → boss → (loop++) waves
    this.boss = null;
    this.warnT = 0;
  }

  get rank() {
    return 1 + this.loop * 0.22;
  }

  _buildScript() {
    const rnd = (a, b) => a + Math.random() * (b - a);
    return [
      { t:  1.0, fn: (m) => m._row(Straight, 5, rnd(120, H - 120)) },
      { t:  5.0, fn: (m) => m._spread(Sine, 3) },
      { t:  9.0, fn: (m) => { m._turret(true); m._turret(false); } },
      { t: 13.0, fn: (m) => m._darts(3) },
      { t: 16.0, fn: (m) => { m._row(Straight, 4, rnd(120, H - 120)); m._spread(Sine, 2); } },
      { t: 20.0, fn: (m) => m._spread(Homing, 2) },
      { t: 23.0, fn: (m) => { m._turret(Math.random() < 0.5); m._darts(2); } },
      { t: 27.0, fn: (m) => { m._row(Straight, 6, rnd(120, H - 120)); m._turret(true); m._turret(false); } },
      { t: 31.0, fn: (m) => { m._spread(Sine, 3); m._spread(Homing, 2); } },
      { t: 35.0, fn: (m) => { m._spread(MineLayer, 2); m._darts(2); } },
      { t: 39.0, fn: (m) => { m._row(Straight, 5, rnd(120, H - 120)); m._spread(Homing, 3); } },
      { t: 43.0, fn: (m) => { m._turret(true); m._turret(false); m._darts(3); } },
      { t: 47.0, fn: (m) => { m._spread(MineLayer, 3); m._spread(Sine, 2); } },
      { t: 51.0, fn: (m) => { m._row(Straight, 7, rnd(120, H - 120)); m._spread(Homing, 2); m._darts(2); } },
    ];
  }

  _row(Type, n, y) {
    for (let i = 0; i < n; i++) {
      this.enemies.push(new Type(W + 30 + i * 46, y, this.rank));
    }
  }

  _spread(Type, n) {
    for (let i = 0; i < n; i++) {
      const y = 100 + Math.random() * (H - 200);
      this.enemies.push(new Type(W + 30 + i * 80, y, this.rank));
    }
  }

  _darts(n) {
    for (let i = 0; i < n; i++) {
      const y = 90 + Math.random() * (H - 180);
      this.enemies.push(new Dart(W + 30 + i * 60, y, this.rank));
    }
  }

  _turret(top) {
    this.enemies.push(new Turret(W + 30, top, this.rank));
  }

  update(dt, player) {
    this.t += dt;
    if (this.spawningEnabled) {
      if (this.phase === 'waves') {
        while (this.idx < this.script.length && this.script[this.idx].t <= this.t) {
          this.script[this.idx].fn(this);
          this.idx++;
        }
        if (this.idx >= this.script.length && this.t >= LOOP_T) {
          this.phase = 'warning';
          this.warnT = 2.2;
        }
      } else if (this.phase === 'warning') {
        this.warnT -= dt;
        if (this.warnT <= 0) {
          this.boss = new Boss(this.rank);
          this.enemies.push(this.boss);
          this.phase = 'boss';
        }
      } else if (this.phase === 'boss') {
        if (this.boss && this.boss.dead) {
          this.boss = null;
          this.loop++;
          this.t = 0;
          this.idx = 0;
          this.script = this._buildScript();
          this.phase = 'waves';
        }
      }
    }

    const ctxGame = { player, bullets: this.bullets };
    for (const e of this.enemies) e.update(dt, ctxGame);
    this.enemies = this.enemies.filter((e) => !e.dead);

    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) b.dead = true;
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
  }
}
