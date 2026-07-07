// Option system, R-Type Force style: a single indestructible Force pod plus
// two fixed Bit satellites. Capsules drop from enemy kills; the fill order is
// Force -> Bit(top) -> Bit(bottom) -> missile level 1 -> missile level 2.
// The force key (V / gamepad L1 / touch FORCE) launches the docked Force
// forward/back, or recalls a launched Force back to the ship — docking on
// whichever side (front or rear) it touches first.
import { W, H } from './config.js';
import { audio } from './audio.js';

const KILLS_PER_CAPSULE = 10;
const DOCK_GAP_FIRST = 68;    // px from player to docked Force
const SPRING = 12;            // dock-follow stiffness
const DETACH_SPEED = 400;     // px/s slide when launched
const RECALL_SPEED = 520;     // px/s slide when recalled
const EDGE_MIN = 20;          // launched Force stops at these x bounds
const EDGE_MAX = W - 20;
const SHOOT_INTERVAL = 0.32;
const BIT_SHOOT_INTERVAL = 0.4;
const BIT_OFFSET_Y = 46;      // Bit vertical offset from player
const MISSILE_INTERVAL = 0.9;

// Full loadout: 1 Force + 2 Bits + missile level 2.
const FORCE_SLOTS = 1;
const BIT_SLOTS = 2;
const MAX_MISSILE_LEVEL = 2;

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
  constructor(kind, side) {
    this.kind = kind;          // 'force' | 'bit'
    this.mode = side;          // 'front' | 'back' | 'detached' | 'recall' (force only)
    this.slot = null;          // 'top' | 'bottom' (bit only)
    this.slideDir = 0;         // +/-1 while a launched Force is still sliding
    this.x = 0;
    this.y = 0;
    this.hp = 5;               // absorbed bullet hits before destroyed (bit only)
    this.radius = 12;
    this.shootT = 0.3;
    this.hitFlash = 0;
    this.dead = false;
    this.t = 0;
    this.contactT = 0;         // force-only: contact-damage cooldown
    this.index = 0;            // display index, kept by the manager
  }

  get docked() {
    return this.mode === 'front' || this.mode === 'back';
  }

  // Returns true if the unit was destroyed by this hit. Force is immortal.
  absorbBullet() {
    if (this.kind === 'force') {
      this.hitFlash = 0.14;
      return false;
    }
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
    this.missileLevel = 0;
    this._missileT = MISSILE_INTERVAL;
    this._missileDir = -1;     // alternates up/down
  }

  get force() {
    return this.units.find((u) => u.kind === 'force') || null;
  }

  _bit(slotName) {
    return this.units.find((u) => u.kind === 'bit' && u.slot === slotName) || null;
  }

  // Number of pickups still needed to reach the full loadout.
  _missingCount() {
    let missing = 0;
    if (!this.force) missing++;
    if (!this._bit('top')) missing++;
    if (!this._bit('bottom')) missing++;
    missing += Math.max(0, MAX_MISSILE_LEVEL - this.missileLevel);
    return missing;
  }

  onEnemyKill(x, y) {
    this.killCount++;
    if (this.killCount >= KILLS_PER_CAPSULE &&
        this._missingCount() - this.capsules.length > 0) {
      this.capsules.push(new OptionCapsule(x, y));
      this.killCount = 0;
    }
  }

  // Force key: recall a launched Force, or launch the docked one.
  _toggleForce() {
    const f = this.force;
    if (!f) return;
    if (f.mode === 'detached' || f.mode === 'recall') {
      f.mode = 'recall';
      f.slideDir = 0;
      return;
    }
    if (f.docked) {
      f.slideDir = f.mode === 'front' ? 1 : -1;
      f.mode = 'detached';
    }
  }

  // Apply the next capsule pickup, filling missing slots in priority order:
  // Force -> Bit(top) -> Bit(bottom) -> missile lvl 1 -> missile lvl 2.
  _applyPickup() {
    if (!this.force) {
      const u = new OptionUnit('force', 'front');
      this.units.push(u);
      return;
    }
    if (!this._bit('top')) {
      const u = new OptionUnit('bit', null);
      u.slot = 'top';
      this.units.push(u);
      return;
    }
    if (!this._bit('bottom')) {
      const u = new OptionUnit('bit', null);
      u.slot = 'bottom';
      this.units.push(u);
      return;
    }
    if (this.missileLevel < MAX_MISSILE_LEVEL) {
      this.missileLevel++;
    }
  }

  // Call each frame: moves capsules, checks pickup, runs unit logic.
  update(dt, player, bullets, input) {
    for (const c of this.capsules) c.update(dt);
    this.capsules = this.capsules.filter((c) => !c.dead);

    if (!player.alive) return;

    if (input && input.forcePressed) this._toggleForce();

    // Pickup
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i];
      if (Math.hypot(c.x - player.x, c.y - player.y) <
          c.radius + player.radius + 8) {
        this.capsules.splice(i, 1);
        const u = { x: player.x, y: player.y };
        const before = this.units.length;
        this._applyPickup();
        if (this.units.length > before) {
          const added = this.units[this.units.length - 1];
          added.x = u.x;
          added.y = u.y;
        }
        audio.pickupOption();
      }
    }

    // Dock target for the Force (front or back of the ship).
    const f = this.force;
    let forceTarget = null;
    if (f && f.docked) {
      forceTarget = {
        x: player.x + (f.mode === 'front' ? DOCK_GAP_FIRST : -DOCK_GAP_FIRST),
        y: player.y,
      };
    }

    for (const u of this.units) {
      u.t += dt;
      u.hitFlash = Math.max(0, u.hitFlash - dt);

      if (u.kind === 'bit') {
        const tgt = {
          x: player.x,
          y: player.y + (u.slot === 'top' ? -BIT_OFFSET_Y : BIT_OFFSET_Y),
        };
        u.x += (tgt.x - u.x) * SPRING * dt;
        u.y += (tgt.y - u.y) * SPRING * dt;

        u.shootT -= dt;
        if (u.shootT <= 0) {
          u.shootT = BIT_SHOOT_INTERVAL;
          bullets.spawnOptionShot(u.x + 14, u.y);
        }
        continue;
      }

      // Force logic
      u.contactT = Math.max(0, u.contactT - dt);

      if (u.docked) {
        u.x += (forceTarget.x - u.x) * SPRING * dt;
        u.y += (forceTarget.y - u.y) * SPRING * dt;
      } else if (u.mode === 'detached') {
        if (u.slideDir !== 0) {
          u.x += DETACH_SPEED * u.slideDir * dt;
          if (u.x <= EDGE_MIN) { u.x = EDGE_MIN; u.slideDir = 0; }
          if (u.x >= EDGE_MAX) { u.x = EDGE_MAX; u.slideDir = 0; }
        }
      } else if (u.mode === 'recall') {
        const tx = player.x;
        const ty = player.y;
        const d = Math.hypot(tx - u.x, ty - u.y);
        if (d < 26) {
          // Dock on whichever side the Force approached from.
          u.mode = u.x >= player.x ? 'front' : 'back';
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
        // all modes also fire up and down
        bullets.spawnOptionShotUp(u.x, u.y - 8);
        bullets.spawnOptionShotDown(u.x, u.y + 8);
      }
    }

    // Wall-crawling missile launcher, unlocked at missileLevel >= 1.
    if (this.missileLevel >= 1) {
      this._missileT -= dt;
      if (this._missileT <= 0) {
        this._missileT = MISSILE_INTERVAL;
        bullets.spawnMissile(player.x, player.y, this._missileDir, this.missileLevel);
        this._missileDir = -this._missileDir;
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
            // destroyed bits drop their capsule back for re-collection
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
    this.missileLevel = 0;
    this._missileT = MISSILE_INTERVAL;
    this._missileDir = -1;
  }
}
