// AI R-TYPE — entry point: game loop, state machine, parallax background
import { W, H, STATE } from './config.js';
import { InputManager } from './input.js';
import { Player, BulletManager } from './player.js';
import { EnemyManager } from './enemies.js';
import { FX } from './fx.js';
import { audio } from './audio.js';

export { W, H, STATE };

// ---------------------------------------------------------------- background

class Starfield {
  constructor() {
    this.layers = [
      { speed: 30,  size: 1, count: 70, color: 'rgba(120,140,200,0.7)', stars: [] },
      { speed: 80,  size: 2, count: 40, color: 'rgba(180,200,255,0.85)', stars: [] },
      { speed: 160, size: 3, count: 18, color: 'rgba(255,255,255,1)',   stars: [] },
    ];
    for (const layer of this.layers) {
      for (let i = 0; i < layer.count; i++) {
        layer.stars.push({ x: Math.random() * W, y: Math.random() * H });
      }
    }
  }

  update(dt, speedScale = 1) {
    for (const layer of this.layers) {
      for (const s of layer.stars) {
        s.x -= layer.speed * speedScale * dt;
        if (s.x < -4) {
          s.x = W + 4;
          s.y = Math.random() * H;
        }
      }
    }
  }

  render(ctx) {
    for (const layer of this.layers) {
      ctx.fillStyle = layer.color;
      for (const s of layer.stars) {
        ctx.fillRect(s.x | 0, s.y | 0, layer.size, layer.size);
      }
    }
  }
}

// Scrolling jagged terrain strips along the top and bottom edges.
class Terrain {
  constructor() {
    this.seg = 48;            // horizontal width of one segment
    this.speed = 120;
    this.offset = 0;
    const n = Math.ceil(W / this.seg) + 3;
    this.top = Array.from({ length: n }, () => this._h());
    this.bottom = Array.from({ length: n }, () => this._h());
  }

  _h() {
    return 14 + Math.random() * 34;
  }

  update(dt, speedScale = 1) {
    this.offset += this.speed * speedScale * dt;
    while (this.offset >= this.seg) {
      this.offset -= this.seg;
      this.top.shift();
      this.top.push(this._h());
      this.bottom.shift();
      this.bottom.push(this._h());
    }
  }

  render(ctx) {
    ctx.fillStyle = '#1a2438';
    ctx.strokeStyle = '#33476e';
    ctx.lineWidth = 2;
    this._strip(ctx, this.top, true);
    this._strip(ctx, this.bottom, false);
  }

  _strip(ctx, heights, isTop) {
    ctx.beginPath();
    const x0 = -this.offset - this.seg;
    ctx.moveTo(x0, isTop ? 0 : H);
    for (let i = 0; i < heights.length; i++) {
      const x = x0 + i * this.seg;
      const y = isTop ? heights[i] : H - heights[i];
      ctx.lineTo(x + this.seg * 0.5, y);
      ctx.lineTo(x + this.seg, isTop ? heights[i] * 0.45 : H - heights[i] * 0.45);
    }
    ctx.lineTo(x0 + heights.length * this.seg, isTop ? 0 : H);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------- game

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new InputManager(canvas);
    this.state = STATE.TITLE;
    this.starfield = new Starfield();
    this.terrain = new Terrain();
    this.time = 0;            // global clock for blink effects
    this.stateTime = 0;       // time since last state change

    this.player = new Player();
    this.bullets = new BulletManager();
    this.enemies = new EnemyManager();
    this.fx = new FX();
    this.score = 0;
    this.lives = 3;
    this.respawnTimer = 0;
    this.hiScore = this._loadHiScore();
    this.newRecord = false;
  }

  _loadHiScore() {
    try {
      return Number(localStorage.getItem('ai-rtype-hiscore')) || 0;
    } catch {
      return 0;
    }
  }

  _saveHiScore() {
    try {
      localStorage.setItem('ai-rtype-hiscore', String(this.hiScore));
    } catch {
      // private mode etc. — hi-score just won't persist
    }
  }

  addScore(points, x, y) {
    this.score += points;
    this.fx.popup(x, y - 16, String(points));
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      this.newRecord = true;
    }
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
    if (s === STATE.GAMEOVER) {
      this._saveHiScore();
      audio.stopMusic(0.3);
      audio.gameover();
    }
    if (s === STATE.TITLE) {
      audio.playMusic('title');
    }
  }

  startGame() {
    this.player = new Player();
    this.bullets = new BulletManager();
    this.enemies = new EnemyManager();
    this.fx = new FX();
    this.score = 0;
    this.lives = 3;
    this.respawnTimer = 0;
    this.newRecord = false;
    this.setState(STATE.PLAYING);
    audio.playMusic('stage', 0);
  }

  update(dt) {
    this.time += dt;
    this.stateTime += dt;
    this.input.beginFrame();
    // Web Audio needs a user gesture before it can make sound
    if (this.input.firePressed || this.input.startPressed || this.input.fire) audio.unlock();
    this.starfield.update(dt);
    this.terrain.update(dt);

    switch (this.state) {
      case STATE.TITLE:    this.updateTitle(dt); break;
      case STATE.PLAYING:  this.updatePlaying(dt); break;
      case STATE.GAMEOVER: this.updateGameover(dt); break;
    }
  }

  updateTitle(dt) {
    if (this.input.firePressed || this.input.startPressed) {
      this.startGame();
    }
  }

  updatePlaying(dt) {
    this.player.update(dt, this.input, this.bullets);
    this.bullets.update(dt);
    const prevPhase = this.enemies.phase;
    this.enemies.update(dt, this.player.alive ? this.player : null);
    const phase = this.enemies.phase;
    if (phase !== prevPhase) {
      if (phase === 'warning') {
        audio.warning();
        audio.stopMusic(0.8);
      } else if (phase === 'boss') {
        audio.playMusic('boss', this.enemies.loop);
      } else if (phase === 'waves') {
        audio.playMusic('stage', this.enemies.loop);
      }
    }
    this.fx.update(dt);
    this.checkCollisions();

    if (!this.player.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        if (this.lives > 0) {
          this.player.respawn();
        } else {
          this.setState(STATE.GAMEOVER);
        }
      }
    }
  }

  checkCollisions() {
    // player bullets vs enemies
    for (const b of this.bullets.list) {
      if (b.dead) continue;
      for (const e of this.enemies.enemies) {
        if (e.dead) continue;
        const cx = Math.max(b.x - b.w / 2, Math.min(e.x, b.x + b.w / 2));
        const cy = Math.max(b.y - b.h / 2, Math.min(e.y, b.y + b.h / 2));
        if ((e.x - cx) ** 2 + (e.y - cy) ** 2 > e.radius ** 2) continue;

        e.hp -= b.damage;
        if (e.hitFlash !== undefined) e.hitFlash = 0.08;
        if (b.kind === 'shot') {
          b.dead = true;
          this.fx.hit(b.x + b.w / 2, b.y);
          audio.hit();
        } else if (--b.pierce < 0) {
          b.dead = true;
        }
        if (e.hp <= 0) {
          e.dead = true;
          this.addScore(e.score, e.x, e.y);
          const big = e.radius > 20;
          this.fx.explosion(e.x, e.y, {
            color: big ? '#ff80c0' : '#ffb060',
            count: big ? 70 : 24,
            speed: big ? 340 : 220,
            size: big ? 6 : 4,
          });
          audio.explode(big);
        }
        if (b.dead) break;
      }
    }

    // enemies & enemy bullets vs player
    const p = this.player;
    if (!p.alive || p.invuln > 0) return;
    for (const e of this.enemies.enemies) {
      if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.radius) {
        e.hp -= 2;
        if (e.hp <= 0) {
          e.dead = true;
          this.addScore(e.score, e.x, e.y);
          this.fx.explosion(e.x, e.y, { color: '#ffb060' });
        }
        this.killPlayer();
        return;
      }
    }
    for (const b of this.enemies.bullets) {
      if (!b.dead && Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.radius) {
        b.dead = true;
        this.killPlayer();
        return;
      }
    }
  }

  killPlayer() {
    const p = this.player;
    this.fx.explosion(p.x, p.y, { color: '#7df9ff', count: 40, speed: 300, size: 5 });
    audio.chargeEnd();
    audio.explode(true);
    p.alive = false;
    this.lives--;
    this.respawnTimer = 1.6;
  }

  updateGameover(dt) {
    // let the battlefield wind down behind the message
    this.enemies.spawningEnabled = false;
    this.enemies.update(dt, null);
    this.fx.update(dt);
    // brief lockout so a held button doesn't skip the screen instantly
    if (this.stateTime > 1 && (this.input.firePressed || this.input.startPressed)) {
      this.setState(STATE.TITLE);
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, W, H);
    this.starfield.render(ctx);
    this.terrain.render(ctx);

    switch (this.state) {
      case STATE.TITLE:    this.renderTitle(ctx); break;
      case STATE.PLAYING:  this.renderPlaying(ctx); break;
      case STATE.GAMEOVER: this.renderGameover(ctx); break;
    }

    this.input.renderTouchUI(ctx);
  }

  renderTitle(ctx) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8fd0ff';
    ctx.font = 'bold 72px monospace';
    ctx.fillText('AI R-TYPE', W / 2, H / 2 - 60);
    ctx.font = '20px monospace';
    ctx.fillStyle = '#5a7aa0';
    ctx.fillText('— FABLE EDITION —', W / 2, H / 2 - 18);
    if (this.hiScore > 0) {
      ctx.fillStyle = '#ffe9a0';
      ctx.font = '18px monospace';
      ctx.fillText(`HI-SCORE ${String(this.hiScore).padStart(7, '0')}`, W / 2, H / 2 + 18);
    }
    if (Math.floor(this.time * 2) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px monospace';
      ctx.fillText('PRESS FIRE / TAP TO START', W / 2, H / 2 + 70);
    }
    ctx.font = '15px monospace';
    ctx.fillStyle = '#46618a';
    ctx.fillText('MOVE: ARROWS / WASD / STICK · FIRE: Z X SPACE (HOLD = CHARGE)', W / 2, H - 70);
  }

  renderPlaying(ctx) {
    this.bullets.render(ctx);
    this.enemies.render(ctx);
    this.player.render(ctx);
    this.fx.render(ctx);
    this.renderHud(ctx);

    if (this.enemies.phase === 'warning' && Math.floor(this.time * 4) % 2 === 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff5050';
      ctx.font = 'bold 48px monospace';
      ctx.fillText('WARNING', W / 2, H / 2 - 10);
    }
  }

  renderGameover(ctx) {
    this.enemies.render(ctx);
    this.fx.render(ctx);
    this.renderHud(ctx);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6060';
    ctx.font = 'bold 56px monospace';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
    ctx.fillStyle = '#dce8ff';
    ctx.font = '24px monospace';
    ctx.fillText(`SCORE ${String(this.score).padStart(7, '0')}`, W / 2, H / 2 + 24);
    if (this.newRecord && Math.floor(this.time * 3) % 2 === 0) {
      ctx.fillStyle = '#ffe9a0';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('★ NEW RECORD! ★', W / 2, H / 2 + 60);
    }
    if (this.stateTime > 1 && Math.floor(this.time * 2) % 2 === 0) {
      ctx.fillStyle = '#9ecbff';
      ctx.font = '18px monospace';
      ctx.fillText('PRESS FIRE / TAP TO CONTINUE', W / 2, H / 2 + 104);
    }
  }

  renderHud(ctx) {
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#dce8ff';
    ctx.fillText(`SCORE ${String(this.score).padStart(7, '0')}`, 16, 32);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe9a0';
    ctx.fillText(`HI ${String(this.hiScore).padStart(7, '0')}`, W - 16, 32);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#8fa8cc';
    ctx.font = '16px monospace';
    ctx.fillText(`STAGE ${this.enemies.loop + 1}`, W / 2, 30);

    // boss HP bar
    const boss = this.enemies.boss;
    if (boss && !boss.dead) {
      const w = 360;
      const x = W / 2 - w / 2;
      ctx.fillStyle = 'rgba(20,30,50,0.8)';
      ctx.fillRect(x - 2, 40, w + 4, 12);
      ctx.fillStyle = '#ff5080';
      ctx.fillRect(x, 42, w * Math.max(boss.hp / boss.maxHp, 0), 8);
      ctx.strokeStyle = '#b59ae0';
      ctx.strokeRect(x - 2, 40, w + 4, 12);
    }
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px monospace';

    // remaining lives as small ship icons
    for (let i = 0; i < this.lives; i++) {
      const x = 22 + i * 28;
      const y = 50;
      ctx.fillStyle = '#c8d6ea';
      ctx.beginPath();
      ctx.moveTo(x + 9, y);
      ctx.lineTo(x - 7, y - 5);
      ctx.lineTo(x - 7, y + 5);
      ctx.closePath();
      ctx.fill();
    }

    // charge gauge
    const p = this.player;
    if (p.charging && p.chargeTime > 0.1) {
      const w = 180;
      const x = W / 2 - w / 2;
      const y = H - 26;
      ctx.fillStyle = 'rgba(20,30,50,0.8)';
      ctx.fillRect(x - 2, y - 2, w + 4, 12);
      ctx.fillStyle = p.chargeLevel >= 3 ? '#ffd76e' : '#7df9ff';
      ctx.fillRect(x, y, w * p.chargeRatio, 8);
      ctx.strokeStyle = '#5a7aa0';
      ctx.strokeRect(x - 2, y - 2, w + 4, 12);
    }
  }
}

// ------------------------------------------------------------------- scaling

function fitCanvas(canvas) {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${Math.floor(W * scale)}px`;
  canvas.style.height = `${Math.floor(H * scale)}px`;
}

// ---------------------------------------------------------------------- boot

function boot() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);

  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));

  let last = performance.now();
  function frame(now) {
    // Clamp dt so a backgrounded tab doesn't teleport everything.
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    game.update(dt);
    game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
