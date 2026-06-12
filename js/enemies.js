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

// Loop-end boss: large core ship with spread / ring attacks.
export class Boss extends Enemy {
  constructor(rank) {
    super(W + 120, H / 2, rank);
    this.hp = Math.round(55 * rank);
    this.maxHp = this.hp;
    this.radius = 30;
    this.score = 5000;
    this.phase = 'enter';
    this.attackT = 1.2;
    this.hitFlash = 0;
  }

  move(dt, { player, bullets }) {
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    if (this.phase === 'enter') {
      this.x -= 130 * dt;
      if (this.x <= W - 150) this.phase = 'fight';
      return;
    }

    this.y = H / 2 + Math.sin(this.t * 0.8) * (H / 2 - 130);
    this.attackT -= dt;
    if (this.attackT > 0 || !player) return;

    const v = 180 + 35 * this.rank;
    if (Math.random() < 0.6) {
      // 3-way aimed spread
      const base = Math.atan2(player.y - this.y, player.x - this.x);
      for (const off of [-0.22, 0, 0.22]) {
        bullets.push({
          x: this.x - 24, y: this.y,
          vx: Math.cos(base + off) * v, vy: Math.sin(base + off) * v,
          r: 5, dead: false,
        });
      }
      this.attackT = Math.max(1.1 / this.rank, 0.45);
    } else {
      // bullet ring
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + this.t;
        bullets.push({
          x: this.x, y: this.y,
          vx: Math.cos(a) * v * 0.8, vy: Math.sin(a) * v * 0.8,
          r: 4, dead: false,
        });
      }
      this.attackT = Math.max(1.8 / this.rank, 0.8);
    }
  }

  render(ctx) {
    const { x, y } = this;
    ctx.save();

    // hull
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#5d4a7a';
    ctx.strokeStyle = '#b59ae0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 34, y);
    ctx.lineTo(x - 6, y - 44);
    ctx.lineTo(x + 44, y - 30);
    ctx.lineTo(x + 56, y);
    ctx.lineTo(x + 44, y + 30);
    ctx.lineTo(x - 6, y + 44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // rotating shield arcs
    ctx.strokeStyle = 'rgba(181,154,224,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a = this.t * 1.6 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(x, y, 52, a, a + 1.1);
      ctx.stroke();
    }

    // glowing core (the weak point look)
    const pulse = 0.6 + Math.sin(this.t * 6) * 0.25;
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : `rgba(255,80,120,${pulse})`;
    ctx.beginPath();
    ctx.arc(x - 2, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd0e0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
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
    this.phase = 'waves';     // waves → warning → boss → (loop++) waves
    this.boss = null;
    this.warnT = 0;
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
