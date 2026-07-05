// Option system, R-Type Force style: capsules drop from enemy kills; collected
// units dock to the FRONT (right) or REAR (left) of the ship. The force key
// (V / gamepad L1 / touch FORCE) detaches the newest docked unit — it slides
// in its docked direction to the screen edge and fires both ways — or, if any
// unit is detached, recalls them all to re-dock at the rear.
import { W, H } from './config.js';
import { audio } from './audio.js';

const MAX_OPTIONS = 3;
const KILLS_PER_CAPSULE = 10;
const DOCK_GAP_FIRST = 68;    // px from player to first docked unit
const DOCK_GAP_NEXT = 50;     // px between successive docked units
const SPRING = 12;            // dock-follow stiffness
const DETACH_SPEED = 400;     // px/s slide when detached
const RECALL_SPEED = 520;     // px/s slide when recalled
const EDGE_MIN = 20;          // detached units stop at these x bounds
const EDGE_MAX = W - 20;
const SHOOT_INTERVAL = 0.32;

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
  constructor(order, side) {
    this.order = order;       // collection order — newest is detached first
    this.mode = side;         // 'front' | 'back' | 'detached' | 'recall'
    this.slideDir = 0;        // +/-1 while a detached unit is still sliding
    this.x = 0;
    this.y = 0;
    this.hp = 5;              // absorbed bullet hits before destroyed
    this.radius = 12;
    this.shootT = 0.3;
    this.hitFlash = 0;
    this.dead = false;
    this.t = 0;
    this.index = 0;           // display index, kept by the manager
  }

  get docked() {
    return this.mode === 'front' || this.mode === 'back';
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
    this.collectCount = 0;    // alternates front/back on pickup
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

  // Force key: recall all detached units, or detach the newest docked one.
  _toggleForce() {
    const detached = this.units.filter((u) => u.mode === 'detached' || u.mode === 'recall');
    if (detached.length > 0) {
      for (const u of this.units) {
        if (u.mode === 'detached' || u.mode === 'recall') {
          u.mode = 'recall';
          u.slideDir = 0;
        }
      }
      return;
    }
    const docked = this.units.filter((u) => u.docked);
    if (docked.length === 0) return;
    const newest = docked.reduce((a, b) => (b.order > a.order ? b : a));
    newest.slideDir = newest.mode === 'front' ? 1 : -1;
    newest.mode = 'detached';
  }

  // Call each frame: moves capsules, checks pickup, runs unit logic.
  update(dt, player, bullets, input) {
    for (const c of this.capsules) c.update(dt);
    this.capsules = this.capsules.filter((c) => !c.dead);

    if (!player.alive) return;

    if (input && input.forcePressed) this._toggleForce();

    // Pickup — 1st unit docks front, 2nd back, 3rd front (alternating).
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i];
      if (Math.hypot(c.x - player.x, c.y - player.y) <
          c.radius + player.radius + 8) {
        this.capsules.splice(i, 1);
        if (this.units.length < MAX_OPTIONS) {
          const side = this.collectCount % 2 === 0 ? 'front' : 'back';
          const u = new OptionUnit(this.collectCount, side);
          u.x = player.x;
          u.y = player.y;
          this.units.push(u);
          this.collectCount++;
          audio.pickupOption();
        }
      }
    }

    // Dock slots: stable order along each side by collection order.
    const front = this.units.filter((u) => u.mode === 'front')
      .sort((a, b) => a.order - b.order);
    const back = this.units.filter((u) => u.mode === 'back')
      .sort((a, b) => a.order - b.order);
    const dock = new Map();
    front.forEach((u, i) => dock.set(u, {
      x: player.x + DOCK_GAP_FIRST + i * DOCK_GAP_NEXT, y: player.y,
    }));
    back.forEach((u, i) => dock.set(u, {
      x: player.x - DOCK_GAP_FIRST - i * DOCK_GAP_NEXT, y: player.y,
    }));

    for (const u of this.units) {
      u.t += dt;
      u.hitFlash = Math.max(0, u.hitFlash - dt);

      if (u.docked) {
        const tgt = dock.get(u);
        u.x += (tgt.x - u.x) * SPRING * dt;
        u.y += (tgt.y - u.y) * SPRING * dt;
      } else if (u.mode === 'detached') {
        if (u.slideDir !== 0) {
          u.x += DETACH_SPEED * u.slideDir * dt;
          if (u.x <= EDGE_MIN) { u.x = EDGE_MIN; u.slideDir = 0; }
          if (u.x >= EDGE_MAX) { u.x = EDGE_MAX; u.slideDir = 0; }
        }
      } else if (u.mode === 'recall') {
        const tx = player.x - DOCK_GAP_FIRST;
        const ty = player.y;
        const d = Math.hypot(tx - u.x, ty - u.y);
        if (d < 26) {
          u.mode = 'back';    // recalled units always re-dock at the rear
        } else {
          u.x += ((tx - u.x) / d) * RECALL_SPEED * dt;
          u.y += ((ty - u.y) / d) * RECALL_SPEED * dt;
        }
      }

      u.shootT -= dt;
      if (u.shootT <= 0) {
        u.shootT = SHOOT_INTERVAL;
        if (u.mode === 'front') {
          bullets.spawnOptionShot(u.x + 18, u.y);
        } else if (u.mode === 'back') {
          bullets.spawnOptionShotBack(u.x - 18, u.y);
        } else {
          // detached / recalling: fire both directions
          bullets.spawnOptionShot(u.x + 18, u.y);
          bullets.spawnOptionShotBack(u.x - 18, u.y);
        }
      }
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
          if (destroyed) {
            if (fx) fx.explosion(u.x, u.y, { color: '#b59ae0', count: 18, speed: 200, size: 4 });
            // destroyed units drop their capsule back for re-collection
            this.capsules.push(new OptionCapsule(u.x, u.y));
          }
        }
      }
    }
  }

  reset() {
    this.capsules = [];
    this.units = [];
    this.killCount = 0;
    this.collectCount = 0;
  }
}
