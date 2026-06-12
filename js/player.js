// Player ship, normal shots, and charge beam.
import { W, H } from './config.js';
import { audio } from './audio.js';
import { sprites, drawSprite } from './sprites.js';

const SPEED = 320;
const MARGIN_X = 20;
const MARGIN_Y = 58;          // keep clear of the terrain strips
const SHOT_COOLDOWN = 0.12;
const CHARGE_MIN = 0.4;       // hold time before a release becomes a beam

class Bullet {
  constructor(x, y, vx, w, h, damage, pierce, kind) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.w = w;
    this.h = h;
    this.damage = damage;
    this.pierce = pierce;     // how many extra enemies a beam can pass through
    this.kind = kind;         // 'shot' | 'beam'
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    if (this.x - this.w / 2 > W + 40) this.dead = true;
  }
}

export class BulletManager {
  constructor() {
    this.list = [];
  }

  spawnShot(x, y) {
    this.list.push(new Bullet(x, y, 700, 14, 4, 1, 0, 'shot'));
  }

  spawnBeam(x, y, level) {
    const spec = [
      { h: 8,  damage: 3,  pierce: 2 },
      { h: 14, damage: 6,  pierce: 4 },
      { h: 22, damage: 12, pierce: 9 },
    ][level - 1];
    this.list.push(new Bullet(x, y, 900, 36, spec.h, spec.damage, spec.pierce, 'beam'));
  }

  update(dt) {
    for (const b of this.list) b.update(dt);
    this.list = this.list.filter((b) => !b.dead);
  }

  clear() {
    this.list = [];
  }

  render(ctx) {
    for (const b of this.list) {
      if (b.kind === 'shot') {
        ctx.fillStyle = '#7df9ff';
        ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      } else {
        const g = ctx.createLinearGradient(b.x - b.w / 2, 0, b.x + b.w / 2, 0);
        g.addColorStop(0, 'rgba(125,249,255,0)');
        g.addColorStop(0.5, '#bfffff');
        g.addColorStop(1, '#ffffff');
        ctx.fillStyle = g;
        ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
        ctx.fillStyle = 'rgba(125,249,255,0.35)';
        ctx.fillRect(b.x - b.w / 2 - 6, b.y - b.h / 2 - 3, b.w + 12, b.h + 6);
      }
    }
  }
}

export class Player {
  constructor() {
    this.x = 120;
    this.y = H / 2;
    this.radius = 7;          // generous-to-the-player hitbox
    this.cooldown = 0;
    this.charging = false;
    this.chargeTime = 0;
    this.alive = true;
    this.invuln = 0;          // seconds of post-respawn invulnerability
    this.time = 0;
  }

  get chargeRatio() {
    return Math.min(this.chargeTime / 1.2, 1);
  }

  get chargeLevel() {
    if (this.chargeTime >= 1.2) return 3;
    if (this.chargeTime >= 0.75) return 2;
    return 1;
  }

  respawn() {
    this.x = 120;
    this.y = H / 2;
    this.alive = true;
    this.invuln = 2;
    this.charging = false;
    this.chargeTime = 0;
    audio.chargeEnd();
  }

  update(dt, input, bullets) {
    this.time += dt;
    if (!this.alive) return;
    if (this.invuln > 0) this.invuln -= dt;

    this.x += input.moveX * SPEED * dt;
    this.y += input.moveY * SPEED * dt;
    this.x = Math.max(MARGIN_X, Math.min(W - MARGIN_X - 40, this.x));
    this.y = Math.max(MARGIN_Y, Math.min(H - MARGIN_Y, this.y));

    this.cooldown -= dt;
    const nose = { x: this.x + 22, y: this.y };

    if (input.firePressed && this.cooldown <= 0) {
      bullets.spawnShot(nose.x, nose.y);
      audio.shoot();
      this.cooldown = SHOT_COOLDOWN;
      this.charging = true;
      this.chargeTime = 0;
    }
    if (this.charging && input.fire) {
      this.chargeTime += dt;
      if (this.chargeTime > 0.15) {
        audio.chargeStart();
        audio.chargeSet(this.chargeRatio);
      }
    }
    if (this.charging && !input.fire) {
      audio.chargeEnd();
      if (this.chargeTime >= CHARGE_MIN) {
        bullets.spawnBeam(nose.x, nose.y, this.chargeLevel);
        audio.beam(this.chargeLevel);
      }
      this.charging = false;
      this.chargeTime = 0;
    }
  }

  render(ctx) {
    if (!this.alive) return;
    // blink while invulnerable
    if (this.invuln > 0 && Math.floor(this.time * 12) % 2 === 0) return;

    const { x, y } = this;
    ctx.save();

    // engine flame, 3-frame animation
    const fl = sprites.flames[Math.floor(this.time * 18) % sprites.flames.length];
    drawSprite(ctx, fl, x - 28, y);

    drawSprite(ctx, sprites.player, x, y);

    // charge glow at the nose
    if (this.charging && this.chargeTime > 0.15) {
      const r = 4 + this.chargeRatio * 12 + Math.sin(this.time * 30) * 2;
      ctx.fillStyle = this.chargeRatio >= 1
        ? `rgba(255,215,110,${0.55 + Math.sin(this.time * 24) * 0.25})`
        : `rgba(125,249,255,${0.4 + this.chargeRatio * 0.5})`;
      ctx.beginPath();
      ctx.arc(x + 26, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
