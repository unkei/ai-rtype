// Player ship, normal shots, and charge beam.
import { W, H } from './config.js';
import { audio } from './audio.js';

const SPEED = 320;
const MARGIN_X = 20;
const MARGIN_Y = 58;          // keep clear of the terrain strips
const SHOT_COOLDOWN = 0.12;
const CHARGE_MIN = 0.4;       // hold time before a release becomes a beam

// Wall-crawling missile tuning.
const MISSILE_SEEK_VX = 260;
const MISSILE_SEEK_VY = 320;
const MISSILE_CRAWL_VX = 340;
const MISSILE_CRAWL_CLIMB = 1400;  // px/s vertical adjustment while crawling
const MISSILE_LEAD = 32;           // look-ahead so climbs start before the wall face
const MISSILE_FLOOR_Y = H - 48;
const MISSILE_CEIL_Y = 48;

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
    this.kind = kind;         // 'shot' | 'beam' | 'option' | 'missile' | 'flame'
    this.dead = false;
    if (kind === 'missile' || kind === 'flame') {
      this.phase = 'seek';    // 'seek' | 'crawl'
      this.dir = 0;           // -1 crawls the ceiling, +1 crawls the floor
    }
  }

  update(dt, terrain) {
    if (this.kind === 'missile' || this.kind === 'flame') {
      this._updateMissile(dt, terrain);
      return;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x - this.w / 2 > W + 40 || this.x + this.w / 2 < -40) this.dead = true;
    if (this.vy !== 0 && (this.y < -30 || this.y > H + 30)) this.dead = true;
  }

  _updateMissile(dt, terrain) {
    if (this.phase === 'seek') {
      this.x += MISSILE_SEEK_VX * dt;
      this.y += this.dir * MISSILE_SEEK_VY * dt;

      if (terrain) {
        if (this.dir > 0 && this.y >= MISSILE_FLOOR_Y) {
          this.y = MISSILE_FLOOR_Y;
          this.phase = 'crawl';
        } else if (this.dir < 0 && this.y <= MISSILE_CEIL_Y) {
          this.y = MISSILE_CEIL_Y;
          this.phase = 'crawl';
        } else if (terrain.hitTest(this.x, this.y, 3)) {
          const seg = terrain.segments.find((s) =>
            !s.dead && this.x >= s.x && this.x <= s.x + s.w);
          if (seg) {
            this.y = this.dir > 0 ? seg.y - 4 : seg.y + seg.h + 4;
            this.phase = 'crawl';
          }
        }
      } else {
        // No terrain (e.g. test pages) — keep flying straight.
        if (this.dir > 0 && this.y >= MISSILE_FLOOR_Y) this.y = MISSILE_FLOOR_Y;
        if (this.dir < 0 && this.y <= MISSILE_CEIL_Y) this.y = MISSILE_CEIL_Y;
      }
    } else {
      // crawl
      this.x += MISSILE_CRAWL_VX * dt;

      if (terrain) {
        let targetY = this.dir > 0 ? MISSILE_FLOOR_Y : MISSILE_CEIL_Y;
        if (this.dir > 0) {
          let best = null;
          for (const s of terrain.segments) {
            if (s.dead) continue;
            if (this.x + MISSILE_LEAD < s.x || this.x - 4 > s.x + s.w) continue;
            if (s.y + s.h > H - 170) {
              if (best === null || s.y < best) best = s.y;
            }
          }
          if (best !== null) targetY = best - 4;
        } else {
          let best = null;
          for (const s of terrain.segments) {
            if (s.dead) continue;
            if (this.x + MISSILE_LEAD < s.x || this.x - 4 > s.x + s.w) continue;
            if (s.y < 170) {
              const bottom = s.y + s.h;
              if (best === null || bottom > best) best = bottom;
            }
          }
          if (best !== null) targetY = best + 4;
        }

        const dy = targetY - this.y;
        const step = Math.max(-MISSILE_CRAWL_CLIMB * dt, Math.min(MISSILE_CRAWL_CLIMB * dt, dy));
        this.y += step;

        if (terrain.hitTest(this.x, this.y, 2)) this.dead = true;
      }

      if (this.x > W + 40) this.dead = true;
    }
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

  // Wall-crawling missile (or flame missile at level 2): seeks up/down to the
  // nearest surface then crawls along it, hugging terrain as it scrolls past.
  spawnMissile(x, y, dir, level) {
    const isFlame = level >= 2;
    const b = isFlame
      ? new Bullet(x, y, 0, 20, 10, 4, 2, 'flame')
      : new Bullet(x, y, 0, 14, 6, 2, 0, 'missile');
    b.dir = dir;
    this.list.push(b);
  }

  update(dt, terrain) {
    for (const b of this.list) b.update(dt, terrain);
    this.list = this.list.filter((b) => !b.dead);
  }

  clear() {
    this.list = [];
  }
}

export class Player {
  constructor() {
    this.x = -90;             // fly-in intro: start off-screen, jets blazing
    this.y = H / 2;
    this.radius = 7;          // generous-to-the-player hitbox
    this.cooldown = 0;
    this.charging = false;
    this.chargeTime = 0;
    this.alive = true;
    this.invuln = 0;          // seconds of post-respawn invulnerability
    this.time = 0;
    this.entering = true;
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
    this.entering = false;
    this._justRespawned = true;
  }

  update(dt, input, bullets) {
    this.time += dt;
    if (!this.alive) return;

    if (this.entering) {
      this.x += 460 * dt;
      if (this.x >= 120) {
        this.x = 120;
        this.entering = false;
        this.invuln = 1;
      }
      return;               // no control or firing during the fly-in
    }

    if (this.invuln > 0) this.invuln -= dt;

    if (this._justRespawned) {
      this._justRespawned = false;
      if (input.fire) this.charging = true;
    }

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
