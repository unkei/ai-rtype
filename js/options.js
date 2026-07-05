// Option system: power-up capsules that drop from enemy kills,
// collected by the player to gain trailing satellites that auto-fire
// and intercept enemy bullets.
import { H } from './config.js';
import { audio } from './audio.js';

const TRAIL_GAP = 54;     // px behind each successive target
const SPRING = 9;         // follow stiffness (higher = tighter)
const MAX_OPTIONS = 3;
const KILLS_PER_CAPSULE = 10;

// ------------------------------------------------------------- capsule

class OptionCapsule {
  constructor(x, y) {
    this.x = x;
    this.y = Math.max(60, Math.min(H - 60, y));
    this.vx = -85;
    this.t = 0;
    this.radius = 10;
    this.dead = false;
  }

  update(dt) {
    this.t += dt;
    this.x += this.vx * dt;
    this.y += Math.sin(this.t * 2.5) * 28 * dt;
    if (this.x < -40) this.dead = true;
  }
}

// -------------------------------------------------------------- unit

class OptionUnit {
  constructor(index) {
    this.index = index;
    this.x = 0;
    this.y = 0;
    this.hp = 5;          // absorbed bullet hits before destroyed
    this.radius = 12;
    this.shootT = 0.3;
    this.hitFlash = 0;
    this.dead = false;
    this.t = 0;
  }

  // Spring toward (targetX - TRAIL_GAP, targetY).
  follow(dt, targetX, targetY) {
    this.x += (targetX - TRAIL_GAP - this.x) * SPRING * dt;
    this.y += (targetY - this.y) * SPRING * dt;
  }

  update(dt, bullets) {
    this.t += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.shootT -= dt;
    if (this.shootT <= 0) {
      bullets.spawnOptionShot(this.x + 18, this.y);
      this.shootT = 0.32;
    }
  }

  // Returns true if the unit was destroyed by this hit.
  absorbBullet() {
    this.hp--;
    this.hitFlash = 0.14;
    if (this.hp <= 0) this.dead = true;
    return this.hp <= 0;
  }
}

// ----------------------------------------------------------- manager

export class OptionManager {
  constructor() {
    this.capsules = [];
    this.units = [];
    this.killCount = 0;
  }

  onEnemyKill(x, y) {
    this.killCount++;
    // Emit a capsule every N kills, up to the max option count.
    if (this.killCount >= KILLS_PER_CAPSULE &&
        this.units.length + this.capsules.length < MAX_OPTIONS) {
      this.capsules.push(new OptionCapsule(x, y));
      this.killCount = 0;
    }
  }

  // Call each frame: moves capsules, checks pickup, runs unit logic.
  update(dt, player, bullets) {
    for (const c of this.capsules) c.update(dt);
    this.capsules = this.capsules.filter((c) => !c.dead);

    if (!player.alive) return;

    // Pickup
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i];
      if (Math.hypot(c.x - player.x, c.y - player.y) <
          c.radius + player.radius + 8) {
        this.capsules.splice(i, 1);
        if (this.units.length < MAX_OPTIONS) {
          const u = new OptionUnit(this.units.length);
          u.x = player.x - TRAIL_GAP * (this.units.length + 1);
          u.y = player.y;
          this.units.push(u);
          audio.pickupOption();
        }
      }
    }

    // Chain: unit[0] follows player, unit[i] follows unit[i-1].
    // Capture positions before mutation so chaining is simultaneous.
    const targets = [
      { x: player.x, y: player.y },
      ...this.units.map((u) => ({ x: u.x, y: u.y })),
    ];
    for (let i = 0; i < this.units.length; i++) {
      this.units[i].follow(dt, targets[i].x, targets[i].y);
      this.units[i].update(dt, bullets);
    }

    this.units = this.units.filter((u) => !u.dead);
    this.units.forEach((u, i) => { u.index = i; });
  }

  // Intercept enemy bullets; call after option update, before player check.
  blockEnemyBullets(enemyBullets, fx, audio) {
    for (const u of this.units) {
      for (const b of enemyBullets) {
        if (b.dead) continue;
        if (Math.hypot(b.x - u.x, b.y - u.y) < u.radius + b.r) {
          b.dead = true;
          const destroyed = u.absorbBullet();
          if (fx) fx.hit(b.x, b.y);
          if (audio) audio.hit();
          if (destroyed && fx) {
            fx.explosion(u.x, u.y, { color: '#b59ae0', count: 18, speed: 200, size: 4 });
          }
        }
      }
    }
  }

  reset() {
    this.capsules = [];
    this.units = [];
    this.killCount = 0;
  }
}
