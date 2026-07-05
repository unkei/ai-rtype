// AI R-TYPE — entry point: game loop, state machine, HUD overlay.
// World rendering is delegated to Render3D (Three.js); this file owns
// game logic and the 2D text/HUD overlay canvas.
import { W, H, STATE } from './config.js';
import { InputManager } from './input.js';
import { Player, BulletManager } from './player.js';
import { EnemyManager, MegaBoss } from './enemies.js';
import { FX } from './fx.js';
import { audio } from './audio.js';
import { OptionManager } from './options.js';
import { Render3D, loadModels } from './render3d.js';

export { W, H, STATE };

// ---------------------------------------------------------------------- game

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new InputManager(canvas);
    this.state = STATE.TITLE;
    this.time = 0;            // global clock for blink effects
    this.stateTime = 0;       // time since last state change

    this.player = new Player();
    this.bullets = new BulletManager();
    this.enemies = new EnemyManager();
    this.fx = new FX();
    this.options = new OptionManager();
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
      audio.gameover();
    }
    if (s === STATE.TITLE) {
      audio.bgmStop();
    }
  }

  startGame() {
    this.player = new Player();
    this.bullets = new BulletManager();
    this.enemies = new EnemyManager();
    this.fx = new FX();
    this.options = new OptionManager();
    this.score = 0;
    this.lives = 3;
    this.respawnTimer = 0;
    this.newRecord = false;
    this.setState(STATE.PLAYING);
    audio.start();
    audio.bgmStage();
  }

  update(dt) {
    this.time += dt;
    this.stateTime += dt;
    this.input.beginFrame();
    // Web Audio needs a user gesture before it can make sound
    if (this.input.firePressed || this.input.startPressed) audio.unlock();

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
    const prevBossP2 = this.enemies.boss?.isPhase2 ?? false;
    this.enemies.update(dt, this.player.alive ? this.player : null);
    if (this.enemies.phase === 'warning' && prevPhase !== 'warning') audio.warning();
    if (this.enemies.phase === 'boss' && prevPhase === 'warning') audio.bgmBoss();
    if (this.enemies.phase === 'waves' && prevPhase === 'boss') audio.bgmStage();
    if (!prevBossP2 && this.enemies.boss?.isPhase2) audio.bossPhase2();
    this.options.update(dt, this.player, this.bullets);
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
        if (e instanceof MegaBoss) {
          this._hitMegaBoss(b, e);
          if (b.dead) break;
          continue;
        }
        const cx = Math.max(b.x - b.w / 2, Math.min(e.x, b.x + b.w / 2));
        const cy = Math.max(b.y - b.h / 2, Math.min(e.y, b.y + b.h / 2));
        if ((e.x - cx) ** 2 + (e.y - cy) ** 2 > e.radius ** 2) continue;

        e.hp -= b.damage;
        if (e.hitFlash !== undefined) e.hitFlash = 0.08;
        if (b.kind === 'shot' || b.kind === 'option') {
          b.dead = true;
          this.fx.hit(b.x + b.w / 2, b.y);
          audio.hit();
        } else if (--b.pierce < 0) {
          b.dead = true;
        }
        if (e.hp <= 0) {
          e.dead = true;
          this.addScore(e.score, e.x, e.y);
          this.options.onEnemyKill(e.x, e.y);
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

    // option units intercept enemy bullets
    this.options.blockEnemyBullets(this.enemies.bullets, this.fx, audio);

    // enemies & enemy bullets vs player
    const p = this.player;
    if (!p.alive || p.invuln > 0) return;
    for (const e of this.enemies.enemies) {
      if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.radius) {
        if (!(e instanceof MegaBoss)) {
          e.hp -= 2;
          if (e.hp <= 0) {
            e.dead = true;
            this.addScore(e.score, e.x, e.y);
            this.fx.explosion(e.x, e.y, { color: '#ffb060' });
          }
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

  // MegaBoss takes damage only on its three weak points; the hull soaks shots.
  _hitMegaBoss(b, boss) {
    for (const wp of boss.weakPoints) {
      if (wp.dead) continue;
      const cx = Math.max(b.x - b.w / 2, Math.min(wp.x, b.x + b.w / 2));
      const cy = Math.max(b.y - b.h / 2, Math.min(wp.y, b.y + b.h / 2));
      if ((wp.x - cx) ** 2 + (wp.y - cy) ** 2 > wp.r ** 2) continue;

      wp.hp -= b.damage;
      wp.hitFlash = 0.08;
      if (b.kind === 'shot' || b.kind === 'option') {
        b.dead = true;
        this.fx.hit(b.x + b.w / 2, b.y);
        audio.hit();
      } else if (--b.pierce < 0) {
        b.dead = true;
      }
      if (wp.hp <= 0) {
        wp.dead = true;
        this.addScore(1000, wp.x, wp.y);
        this.fx.explosion(wp.x, wp.y, { color: '#ff80c0', count: 40, speed: 280, size: 5 });
        audio.explode(true);
        if (boss.weakPoints.every((w) => w.dead)) {
          boss.dead = true;
          this.addScore(boss.score, wp.x, wp.y);
          this.options.onEnemyKill(wp.x, wp.y);
          this.fx.explosion(wp.x, wp.y, { color: '#ff80c0', count: 90, speed: 380, size: 7 });
          audio.explode(true);
        }
      }
      return;
    }
    // armored hull: bullets stop with sparks, no damage
    if (Math.hypot(b.x - boss.x, b.y - boss.y) < boss.radius) {
      b.dead = true;
      this.fx.hit(b.x, b.y);
    }
  }

  killPlayer() {
    const p = this.player;
    this.fx.explosion(p.x, p.y, { color: '#7df9ff', count: 40, speed: 300, size: 5 });
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

  // ------------------------------------------------------------- overlay
  // Text, HUD and touch UI on the transparent 2D canvas above the WebGL view.

  renderOverlay() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

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
    this.fx.renderPopups(ctx);
    this.renderHud(ctx);

    if (this.enemies.phase === 'warning' && Math.floor(this.time * 4) % 2 === 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff5050';
      ctx.font = 'bold 48px monospace';
      ctx.fillText('WARNING', W / 2, H / 2 - 10);
    }
    if (this.enemies.boss?.isPhase2 && !this.enemies.boss.dead &&
        Math.floor(this.time * 5) % 3 === 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff3333';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('PHASE 2', W / 2, H / 2 + 50);
    }
  }

  renderGameover(ctx) {
    this.fx.renderPopups(ctx);
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

    // option unit indicators (small glowing circles, bottom-left)
    const opts = this.options.units;
    for (let i = 0; i < opts.length; i++) {
      const ox = 20 + i * 22;
      const oy = H - 48;
      ctx.beginPath();
      ctx.arc(ox, oy, 8, 0, Math.PI * 2);
      ctx.fillStyle = opts[i].hitFlash > 0 ? '#ffffff' : '#b59ae0';
      ctx.fill();
      ctx.strokeStyle = '#7df9ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // pending capsule indicators (dimmed)
    for (let i = 0; i < this.options.capsules.length; i++) {
      const ox = 20 + (opts.length + i) * 22;
      const oy = H - 48;
      ctx.beginPath();
      ctx.arc(ox, oy, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(181,154,224,0.25)';
      ctx.fill();
      ctx.strokeStyle = '#5a4080';
      ctx.lineWidth = 1;
      ctx.stroke();
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

function fitCanvas(wrap) {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  wrap.style.width = `${Math.floor(W * scale)}px`;
  wrap.style.height = `${Math.floor(H * scale)}px`;
}

// ---------------------------------------------------------------------- boot

async function boot() {
  const wrap = document.getElementById('wrap');
  const overlay = document.getElementById('game');
  fitCanvas(wrap);
  window.addEventListener('resize', () => fitCanvas(wrap));

  // 3D models load async — show a splash on the overlay meanwhile
  const splash = overlay.getContext('2d');
  splash.fillStyle = '#05070f';
  splash.fillRect(0, 0, W, H);
  splash.textAlign = 'center';
  splash.fillStyle = '#8fd0ff';
  splash.font = 'bold 28px monospace';
  splash.fillText('LOADING...', W / 2, H / 2);
  try {
    await loadModels();
  } catch (err) {
    splash.fillStyle = '#ff6060';
    splash.font = '18px monospace';
    splash.fillText('FAILED TO LOAD 3D MODELS — RELOAD TO RETRY', W / 2, H / 2 + 40);
    throw err;
  }

  const game = new Game(overlay);
  const r3d = new Render3D(document.getElementById('game3d'));
  r3d.initScenery();
  window.__game = game;      // debug/test hooks
  window.__r3d = r3d;

  let last = performance.now();
  function frame(now) {
    // Clamp dt so a backgrounded tab doesn't teleport everything.
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    game.update(dt);
    r3d.update(dt, game);
    r3d.render();
    game.renderOverlay();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
