// Enemies, wave scripting, and enemy bullets.
import { W, H } from './config.js';

const LOOP_T = 26;            // wave script length in seconds; repeats harder

// ------------------------------------------------------------- enemy types

class Enemy {
  constructor(x, y, rank) {
    this.x = x;
    this.y = y;
    this.rank = rank;         // difficulty multiplier, grows per loop
    this.hp = 1;
    this.radius = 12;
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
  render(ctx) {}
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

  render(ctx) {
    ctx.fillStyle = '#ff6a6a';
    ctx.strokeStyle = '#8a2020';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 13, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd0d0';
    ctx.beginPath();
    ctx.arc(this.x - 4, this.y - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
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

  render(ctx) {
    ctx.fillStyle = '#6aff8a';
    ctx.strokeStyle = '#1f7a35';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // fins
    ctx.fillStyle = '#2fae52';
    ctx.beginPath();
    ctx.moveTo(this.x + 4, this.y - 10);
    ctx.lineTo(this.x + 14, this.y - 16);
    ctx.lineTo(this.x + 10, this.y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(this.x + 4, this.y + 10);
    ctx.lineTo(this.x + 14, this.y + 16);
    ctx.lineTo(this.x + 10, this.y + 4);
    ctx.closePath();
    ctx.fill();
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

  render(ctx) {
    const blink = this.phase === 'aim' && Math.floor(this.t * 12) % 2 === 0;
    ctx.fillStyle = blink ? '#ffffff' : '#ffb050';
    ctx.strokeStyle = '#a05a10';
    ctx.lineWidth = 1.5;
    const a = Math.atan2(this.vy, this.vx || -1);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// Ground turret riding the terrain strip; fires aimed shots.
export class Turret extends Enemy {
  constructor(x, top, rank) {
    super(x, top ? 44 : H - 44, rank);
    this.top = top;
    this.hp = 3;
    this.score = 300;
    this.radius = 14;
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

  render(ctx) {
    const dir = this.top ? 1 : -1;
    ctx.fillStyle = '#9aa7bd';
    ctx.strokeStyle = '#4a566e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 13, this.top ? 0 : Math.PI, this.top ? Math.PI : 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // barrel
    ctx.strokeStyle = '#cdd6e6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - 10, this.y + 10 * dir);
    ctx.stroke();
    // eye
    ctx.fillStyle = '#ff4040';
    ctx.beginPath();
    ctx.arc(this.x, this.y + 4 * dir, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --------------------------------------------------------------- manager

export class EnemyManager {
  constructor() {
    this.enemies = [];
    this.bullets = [];        // enemy bullets: {x,y,vx,vy,r,dead}
    this.t = 0;
    this.loop = 0;
    this.script = this._buildScript();
    this.idx = 0;
    this.spawningEnabled = true;
  }

  get rank() {
    return 1 + this.loop * 0.18;
  }

  _buildScript() {
    const rnd = (a, b) => a + Math.random() * (b - a);
    return [
      { t: 1.0,  fn: (m) => m._row(Straight, 5, rnd(120, H - 120)) },
      { t: 4.0,  fn: (m) => m._spread(Sine, 3) },
      { t: 7.0,  fn: (m) => { m._turret(true); m._turret(false); } },
      { t: 10.0, fn: (m) => m._darts(3) },
      { t: 13.0, fn: (m) => { m._row(Straight, 4, rnd(120, H - 120)); m._spread(Sine, 2); } },
      { t: 16.5, fn: (m) => { m._turret(Math.random() < 0.5); m._darts(2); } },
      { t: 20.0, fn: (m) => { m._row(Straight, 6, rnd(120, H - 120)); m._turret(true); m._turret(false); } },
      { t: 23.0, fn: (m) => { m._spread(Sine, 3); m._darts(2); } },
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
      while (this.idx < this.script.length && this.script[this.idx].t <= this.t) {
        this.script[this.idx].fn(this);
        this.idx++;
      }
      if (this.idx >= this.script.length && this.t >= LOOP_T) {
        this.t -= LOOP_T;
        this.idx = 0;
        this.loop++;
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

  render(ctx) {
    for (const e of this.enemies) e.render(ctx);
    for (const b of this.bullets) {
      ctx.fillStyle = '#ff80c0';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
