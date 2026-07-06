// Player ship, normal shots, and charge beam.
import { W, H } from './config.js';
import { audio } from './audio.js';

const SPEED = 320;
const MARGIN_X = 20;
const MARGIN_Y = 58;          // keep clear of the terrain strips
const SHOT_COOLDOWN = 0.12;
const CHARGE_MIN = 0.4;       // hold time before a release becomes a beam

class Bullet {
  constructor(x, y, vx, w, h, damage, pierce, kind, vy = 0) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.w = w;
    this.h = h;
    this.damage = damage;
    this.pierce = pierce;     // how many extra enemies a beam can pass through
    this.kind = kind;         // 'shot' | 'beam' | 'option'
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x - this.w / 2 > W + 40 || this.x + this.w / 2 < -40) this.dead = true;
    if (this.vy !== 0 && (this.y < -30 || this.y > H + 30)) this.dead = true;
  }
}

export class BulletManager {
  constructor() {
    this.list = [];
  }

  spawnShot(x, y) {
    this.list.push(new Bullet(x, y, 700, 14, 4, 1, 0, 'shot'));
  }

  spawnOptionShot(x, y) {
    this.list.push(new Bullet(x, y, 560, 10, 4, 1, 0, 'option'));
  }

  spawnOptionShotBack(x, y) {
    this.list.push(new Bullet(x, y, -480, 10, 4, 1, 0, 'option'));
  }

  spawnOptionShotUp(x, y) {
    this.list.push(new Bullet(x, y, 120, 4, 10, 1, 0, 'option', -520));
  }

  spawnOptionShotDown(x, y) {
    this.list.push(new Bullet(x, y, 120, 4, 10, 1, 0, 'option', 520));
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
    }
    if (this.charging && !input.fire) {
      if (this.chargeTime >= CHARGE_MIN) {
        bullets.spawnBeam(nose.x, nose.y, this.chargeLevel);
        audio.beam(this.chargeLevel);
      }
      this.charging = false;
      this.chargeTime = 0;
    }
  }
}
