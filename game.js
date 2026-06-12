'use strict';

// ===== Constants =====
const GAME_W = 960;
const GAME_H = 540;
const STATE = Object.freeze({ TITLE: 'title', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' });

// ===== InputManager =====
// Unified keyboard / Gamepad / touch input. Query each frame via .isDown(action).
class InputManager {
  constructor(canvas) {
    this._keys = {};
    this._prev = {};
    // touch virtual stick state
    this._touch = { dx: 0, dy: 0, fire: false, activeStickId: null, activeFireId: null, stickOrigin: null };
    this._canvas = canvas;
    this._setupKeyboard();
    this._setupTouch(canvas);
    this._showVirtual = false;
  }

  _setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      this._keys[e.code] = true;
      e.preventDefault && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code) && e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this._keys[e.code] = false; });
  }

  _setupTouch(canvas) {
    const isTouchDevice = () => navigator.maxTouchPoints > 0;
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!this._showVirtual) this._showVirtual = true;
      for (const t of e.changedTouches) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = GAME_W / rect.width;
        const scaleY = GAME_H / rect.height;
        const gx = (t.clientX - rect.left) * scaleX;
        const gy = (t.clientY - rect.top) * scaleY;
        if (gx < GAME_W * 0.5) {
          // Left half = virtual stick
          this._touch.activeStickId = t.identifier;
          this._touch.stickOrigin = { x: gx, y: gy };
          this._touch.dx = 0; this._touch.dy = 0;
        } else {
          // Right half = fire
          this._touch.activeFireId = t.identifier;
          this._touch.fire = true;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this._touch.activeStickId) {
          const rect = canvas.getBoundingClientRect();
          const scaleX = GAME_W / rect.width;
          const scaleY = GAME_H / rect.height;
          const gx = (t.clientX - rect.left) * scaleX;
          const gy = (t.clientY - rect.top) * scaleY;
          const ox = this._touch.stickOrigin.x;
          const oy = this._touch.stickOrigin.y;
          const dx = gx - ox, dy = gy - oy;
          const len = Math.sqrt(dx * dx + dy * dy);
          const dead = 10;
          if (len < dead) { this._touch.dx = 0; this._touch.dy = 0; }
          else {
            const clamped = Math.min(len, 60);
            this._touch.dx = (dx / len) * (clamped / 60);
            this._touch.dy = (dy / len) * (clamped / 60);
          }
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this._touch.activeStickId) {
          this._touch.dx = 0; this._touch.dy = 0;
          this._touch.activeStickId = null; this._touch.stickOrigin = null;
        }
        if (t.identifier === this._touch.activeFireId) {
          this._touch.fire = false; this._touch.activeFireId = null;
        }
      }
    };
    canvas.addEventListener('touchend', endTouch, { passive: false });
    canvas.addEventListener('touchcancel', endTouch, { passive: false });
  }

  _getGamepad() {
    for (const gp of navigator.getGamepads()) {
      if (gp && gp.connected) return gp;
    }
    return null;
  }

  // Call once per frame before reading state
  update() {
    this._prev = { ...this._keys };
  }

  isDown(action) {
    const gp = this._getGamepad();
    switch (action) {
      case 'up':    return !!(this._keys['ArrowUp']    || this._keys['KeyW'] || (gp && (gp.axes[1] < -0.3 || gp.buttons[12]?.pressed)) || this._touch.dy < -0.3);
      case 'down':  return !!(this._keys['ArrowDown']  || this._keys['KeyS'] || (gp && (gp.axes[1] >  0.3 || gp.buttons[13]?.pressed)) || this._touch.dy >  0.3);
      case 'left':  return !!(this._keys['ArrowLeft']  || this._keys['KeyA'] || (gp && (gp.axes[0] < -0.3 || gp.buttons[14]?.pressed)) || this._touch.dx < -0.3);
      case 'right': return !!(this._keys['ArrowRight'] || this._keys['KeyD'] || (gp && (gp.axes[0] >  0.3 || gp.buttons[15]?.pressed)) || this._touch.dx >  0.3);
      case 'fire':  return !!(this._keys['KeyZ'] || this._keys['Space'] || (gp && gp.buttons[0]?.pressed) || this._touch.fire);
      case 'pause': return !!(this._keys['Escape'] || this._keys['KeyP'] || (gp && gp.buttons[9]?.pressed));
      case 'start': return !!(this._keys['KeyZ'] || this._keys['Space'] || this._keys['Enter'] || (gp && gp.buttons[0]?.pressed));
    }
    return false;
  }

  justPressed(action) {
    const gp = this._getGamepad();
    switch (action) {
      case 'pause': return !!(
        (this._keys['Escape'] && !this._prev['Escape']) ||
        (this._keys['KeyP']   && !this._prev['KeyP'])   ||
        (gp && gp.buttons[9]?.pressed)
      );
      case 'start': return !!(
        (this._keys['KeyZ']   && !this._prev['KeyZ'])   ||
        (this._keys['Space']  && !this._prev['Space'])  ||
        (this._keys['Enter']  && !this._prev['Enter'])  ||
        (gp && gp.buttons[0]?.pressed)
      );
    }
    return false;
  }

  // Analog values for movement (0-1 range per axis)
  axes() {
    const gp = this._getGamepad();
    let dx = 0, dy = 0;
    if (this.isDown('left'))  dx -= 1;
    if (this.isDown('right')) dx += 1;
    if (this.isDown('up'))    dy -= 1;
    if (this.isDown('down'))  dy += 1;
    if (gp) {
      if (Math.abs(gp.axes[0]) > 0.1) dx = gp.axes[0];
      if (Math.abs(gp.axes[1]) > 0.1) dy = gp.axes[1];
    }
    if (this._touch.activeStickId !== null) {
      dx = this._touch.dx;
      dy = this._touch.dy;
    }
    // Normalize diagonal
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) { dx /= len; dy /= len; }
    return { dx, dy };
  }

  renderVirtualControls(ctx) {
    if (!this._showVirtual) return;
    ctx.save();
    ctx.globalAlpha = 0.35;
    // Left stick area
    const cx = GAME_W * 0.18, cy = GAME_H * 0.72, r = 50;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (this._touch.stickOrigin) {
      const knobX = cx + this._touch.dx * r;
      const knobY = cy + this._touch.dy * r;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(knobX, knobY, 18, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
    }
    // Fire button
    const bx = GAME_W * 0.82, by = GAME_H * 0.72, br = 38;
    ctx.fillStyle = this._touch.fire ? '#f84' : 'rgba(255,100,50,0.5)';
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f84';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('FIRE', bx, by);
    ctx.restore();
  }
}

// ===== BulletManager =====
class BulletManager {
  constructor() {
    this.playerBullets = [];
    this.enemyBullets  = [];
  }

  addPlayerShot(x, y) {
    this.playerBullets.push({ x, y, vx: 680, vy: 0, w: 18, h: 4, active: true });
  }

  addPlayerBeam(x, y, power) {
    const w = 30 + power * 80;
    const h = 6  + power * 14;
    this.playerBullets.push({ x, y, vx: 750, vy: 0, w, h, active: true, beam: true });
  }

  addEnemyBullet(x, y, vx, vy) {
    this.enemyBullets.push({ x, y, vx, vy, w: 8, h: 8, active: true });
  }

  update(dt) {
    for (const b of this.playerBullets) {
      b.x += b.vx * dt;
      if (b.x > GAME_W + 50) b.active = false;
    }
    for (const b of this.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -20 || b.x > GAME_W + 20 || b.y < -20 || b.y > GAME_H + 20) b.active = false;
    }
    this.playerBullets = this.playerBullets.filter(b => b.active);
    this.enemyBullets  = this.enemyBullets.filter(b => b.active);
  }

  render(ctx) {
    // Player bullets
    for (const b of this.playerBullets) {
      if (b.beam) {
        const grd = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y);
        grd.addColorStop(0, 'rgba(255,200,50,0.9)');
        grd.addColorStop(1, 'rgba(255,80,0,0.1)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(b.x + b.w / 2, b.y, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#4df';
        ctx.shadowColor = '#4df'; ctx.shadowBlur = 6;
        ctx.fillRect(b.x, b.y - b.h / 2, b.w, b.h);
        ctx.shadowBlur = 0;
      }
    }
    // Enemy bullets
    ctx.fillStyle = '#f44';
    ctx.shadowColor = '#f44'; ctx.shadowBlur = 6;
    for (const b of this.enemyBullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}

// ===== Player =====
const CHARGE_MAX   = 1.5;   // seconds to full charge
const SHOOT_DELAY  = 0.12;  // seconds between rapid shots

class Player {
  constructor(bullets, audio) {
    this.bullets = bullets;
    this.audio   = audio;
    this.x = 80;
    this.y = GAME_H / 2;
    this.speed  = 280;
    this.w = 32; this.h = 18; // visual half-sizes
    this.hitR = 4; // hitbox radius

    this.charge    = 0;
    this.charging  = false;
    this.shootTimer = 0;

    this.invTimer = 0; // invincibility frames after being hit
    this.alive = true;
  }

  reset() {
    this.x = 80; this.y = GAME_H / 2;
    this.charge = 0; this.charging = false;
    this.shootTimer = 0; this.alive = true;
    this.invTimer = 2.0;
  }

  update(dt, input) {
    if (!this.alive) return;

    // Movement
    const { dx, dy } = input.axes();
    this.x += dx * this.speed * dt;
    this.y += dy * this.speed * dt;
    this.x = Math.max(this.w, Math.min(GAME_W - this.w, this.x));
    this.y = Math.max(this.h, Math.min(GAME_H - this.h, this.y));

    // Invincibility countdown
    if (this.invTimer > 0) this.invTimer -= dt;

    // Fire / Charge
    const fireHeld = input.isDown('fire');
    this.shootTimer -= dt;

    if (fireHeld) {
      this.charge = Math.min(this.charge + dt / CHARGE_MAX, 1);
      this.charging = this.charge > 0.05;
    } else {
      if (this.charging && this.charge > 0.05) {
        // Release charge shot
        this.bullets.addPlayerBeam(this.x + this.w, this.y, this.charge);
        this.audio.chargeFire();
      } else if (!fireHeld && this.shootTimer <= 0) {
        // Normal shot while button up is handled below only when pressed
      }
      this.charge = 0;
      this.charging = false;
    }

    // Rapid fire: only when NOT charging (charge < 0.05 means just tapped)
    if (fireHeld && !this.charging && this.shootTimer <= 0) {
      this.bullets.addPlayerShot(this.x + this.w, this.y);
      this.audio.shoot();
      this.shootTimer = SHOOT_DELAY;
    }
  }

  hit() {
    if (this.invTimer > 0 || !this.alive) return false;
    this.invTimer = 2.5;
    return true; // signal a life lost
  }

  render(ctx) {
    if (!this.alive) return;
    // Blink during invincibility
    if (this.invTimer > 0 && Math.floor(this.invTimer * 8) % 2 === 0) return;

    const x = this.x, y = this.y;
    ctx.save();

    // Engine glow
    ctx.fillStyle = '#48f';
    ctx.shadowColor = '#48f'; ctx.shadowBlur = 12;
    ctx.fillRect(x - this.w - 8, y - 3, 10, 6);
    ctx.shadowBlur = 0;

    // Main body
    ctx.fillStyle = '#8cf';
    ctx.beginPath();
    ctx.moveTo(x + this.w, y);
    ctx.lineTo(x - this.w * 0.4, y - this.h * 0.5);
    ctx.lineTo(x - this.w,       y - this.h * 0.3);
    ctx.lineTo(x - this.w,       y + this.h * 0.3);
    ctx.lineTo(x - this.w * 0.4, y + this.h * 0.5);
    ctx.closePath();
    ctx.fill();

    // Wing accent
    ctx.fillStyle = '#4af';
    ctx.beginPath();
    ctx.moveTo(x,             y - 2);
    ctx.lineTo(x - this.w * 0.8, y - this.h * 0.5);
    ctx.lineTo(x - this.w * 0.3, y - 2);
    ctx.closePath();
    ctx.fill();

    // Charge meter visual — glowing orb on nose
    if (this.charge > 0.05) {
      const r = 4 + this.charge * 16;
      const grad = ctx.createRadialGradient(x + this.w, y, 0, x + this.w, y, r);
      grad.addColorStop(0, `rgba(255,200,50,${0.6 + this.charge * 0.4})`);
      grad.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x + this.w, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hitbox debug (uncomment to visualise)
    // ctx.strokeStyle = 'rgba(255,0,0,0.5)'; ctx.beginPath(); ctx.arc(x, y, this.hitR, 0, Math.PI*2); ctx.stroke();

    ctx.restore();
  }
}

// ===== HUD =====
class HUD {
  render(ctx, score, lives, highScore, chargeLevel, paused) {
    ctx.save();
    ctx.font = '16px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#adf';

    // Score
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${String(score).padStart(8, '0')}`, 10, 8);

    // High score
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff8';
    ctx.fillText(`HI ${String(highScore).padStart(8, '0')}`, GAME_W / 2, 8);

    // Lives
    ctx.textAlign = 'right';
    ctx.fillStyle = '#4df';
    ctx.fillText('♥ '.repeat(lives), GAME_W - 10, 8);

    // Charge bar
    if (chargeLevel > 0) {
      const barW = 120, barH = 10;
      const bx = GAME_W / 2 - barW / 2, by = GAME_H - 20;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
      const color = chargeLevel >= 0.99 ? '#ff0' : chargeLevel > 0.5 ? '#fa0' : '#48f';
      ctx.fillStyle = color;
      ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.fillRect(bx, by, barW * chargeLevel, barH);
      ctx.shadowBlur = 0;
    }

    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 40px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('PAUSE', GAME_W / 2, GAME_H / 2);
    }

    ctx.restore();
  }
}

// ===== Background =====
class Background {
  constructor() {
    this.layers = [
      { speed: 25,  count: 60, size: 1, color: '#334' },
      { speed: 70,  count: 30, size: 1, color: '#668' },
      { speed: 150, count: 15, size: 2, color: '#aac' },
    ];
    for (const layer of this.layers) {
      layer.stars = Array.from({ length: layer.count }, () => ({
        x: Math.random() * GAME_W,
        y: Math.random() * GAME_H,
      }));
    }
  }

  update(dt) {
    for (const layer of this.layers) {
      for (const s of layer.stars) {
        s.x -= layer.speed * dt;
        if (s.x < 0) { s.x = GAME_W + Math.random() * 20; s.y = Math.random() * GAME_H; }
      }
    }
  }

  render(ctx) {
    ctx.fillStyle = '#000014';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    for (const layer of this.layers) {
      ctx.fillStyle = layer.color;
      for (const s of layer.stars) ctx.fillRect(s.x | 0, s.y | 0, layer.size, layer.size);
    }
  }
}

// ===== ParticleSystem stub =====
class ParticleSystem {
  constructor() { this.particles = []; }
  spawnExplosion(_x, _y, _color) {}
  update(_dt) {}
  render(_ctx) {}
}

// ===== AudioManager stub =====
class AudioManager {
  _ac() {
    if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this._ctx;
  }
  shoot() {}
  chargeFire() {}
  explode() {}
  hit() {}
}

// ===== Game =====
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.state  = STATE.TITLE;

    this.bg       = new Background();
    this.particles= new ParticleSystem();
    this.audio    = new AudioManager();
    this.input    = new InputManager(canvas);
    this.bullets  = new BulletManager();
    this.player   = new Player(this.bullets, this.audio);
    this.hud      = new HUD();

    this.score     = 0;
    this.lives     = 3;
    this.highScore = parseInt(localStorage.getItem('ai-rtype.hi') || '0', 10);

    this.lastTime = null;
  }

  start() { requestAnimationFrame((t) => this._frame(t)); }

  _frame(time) {
    if (this.lastTime === null) this.lastTime = time;
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;
    this.input.update();
    this._update(dt);
    this._render();
    requestAnimationFrame((t) => this._frame(t));
  }

  _update(dt) {
    this.bg.update(dt);
    this.particles.update(dt);

    if (this.state === STATE.TITLE) {
      if (this.input.justPressed('start')) this._startGame();
      return;
    }
    if (this.state === STATE.GAMEOVER) {
      if (this.input.justPressed('start')) this._goTitle();
      return;
    }
    if (this.input.justPressed('pause')) {
      this.state = this.state === STATE.PAUSED ? STATE.PLAYING : STATE.PAUSED;
    }
    if (this.state === STATE.PAUSED) return;

    // Playing
    this.player.update(dt, this.input);
    this.bullets.update(dt);
  }

  _startGame() {
    this.score = 0; this.lives = 3;
    this.player.reset();
    this.bullets.playerBullets = []; this.bullets.enemyBullets = [];
    this.state = STATE.PLAYING;
  }

  _goTitle() { this.state = STATE.TITLE; }

  _render() {
    const ctx = this.ctx;
    this.bg.render(ctx);
    if (this.state !== STATE.TITLE) {
      this.bullets.render(ctx);
      this.player.render(ctx);
      this.particles.render(ctx);
      this.input.renderVirtualControls(ctx);
      this.hud.render(ctx, this.score, this.lives, this.highScore, this.player.charge, this.state === STATE.PAUSED);
    }
    if (this.state === STATE.TITLE)    this._renderTitle(ctx);
    if (this.state === STATE.GAMEOVER) this._renderGameOver(ctx);
  }

  _renderTitle(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,20,0.55)';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0af';
    ctx.font = 'bold 72px monospace';
    ctx.shadowColor = '#0af'; ctx.shadowBlur = 24;
    ctx.fillText('AI R-TYPE', GAME_W / 2, GAME_H / 2 - 80);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.fillText('PRESS Z / SPACE / A BUTTON TO START', GAME_W / 2, GAME_H / 2 + 10);
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('Move: Arrow / WASD / Stick / Touch    Fire: Z / Space / A', GAME_W / 2, GAME_H / 2 + 50);
    ctx.fillText('Hold fire to charge — release for BEAM', GAME_W / 2, GAME_H / 2 + 74);
    ctx.restore();
  }

  _renderGameOver(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f44';
    ctx.font = 'bold 56px monospace';
    ctx.shadowColor = '#f44'; ctx.shadowBlur = 20;
    ctx.fillText('GAME OVER', GAME_W / 2, GAME_H / 2 - 40);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.fillText('PRESS Z / SPACE / A TO CONTINUE', GAME_W / 2, GAME_H / 2 + 20);
    ctx.restore();
  }
}

// ===== Boot =====
window.addEventListener('load', () => {
  const canvas = document.getElementById('game');
  if (!canvas) { console.error('canvas#game not found'); return; }
  new Game(canvas).start();
});
