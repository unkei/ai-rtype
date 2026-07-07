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
import { TerrainManager } from './terrain.js';
import { Render3D, loadModels } from './render3d.js';

export { W, H, STATE };

// ---------------------------------------------------------------------- game

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new InputManager(canvas);
    this.state = STATE.SPLASH;
    this.time = 0;            // global clock for blink effects
    this.stateTime = 0;       // time since last state change

    this.player = new Player();
    this.bullets = new BulletManager();
    this.enemies = new EnemyManager();
    this.fx = new FX();
    this.options = new OptionManager();
    this.terrain = new TerrainManager();
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
    this.terrain = new TerrainManager();
    this.score = 0;
    this.lives = 3;
    this.respawnTimer = 0;
    this.newRecord = false;
    this.setState(STATE.PLAYING);
    audio.start();
    audio.bgmStage();
    this._vibrate(50);
  }

  update(dt) {
    this.time += dt;
    this.stateTime += dt;
    this.input.beginFrame();
    // Web Audio needs a user gesture before it can make sound
    if (this.input.firePressed || this.input.startPressed) audio.unlock();

    switch (this.state) {
      case STATE.SPLASH:   this.updateSplash(dt); break;
      case STATE.TITLE:    this.updateTitle(dt); break;
      case STATE.PLAYING:  this.updatePlaying(dt); break;
      case STATE.GAMEOVER: this.updateGameover(dt); break;
    }
  }

  updateSplash(dt) {
    // auto-advance after presents+pause (3.8s) or skip on fire
    if (this.stateTime > 3.8 || this.input.firePressed || this.input.startPressed) {
      this.setState(STATE.TITLE);
    }
  }

  updateTitle(dt) {
    // brief lockout so SPLASH→TITLE transition doesn't immediately start the game
    if (this.stateTime > 0.3 && (this.input.firePressed || this.input.startPressed)) {
      this.startGame();
    }
  }

  updatePlaying(dt) {
    this.player.update(dt, this.input, this.bullets);
    this.bullets.update(dt);
    const prevPhase = this.enemies.phase;
    const prevBossP2 = this.enemies.boss?.isPhase2 ?? false;
    this.enemies.update(dt, this.player.alive ? this.player : null);
    if (this.enemies.phase === 'warning' && prevPhase !== 'warning') {
      audio.warning();
      this._vibrate([120, 60, 120, 60, 120]);
    }
    if (this.enemies.phase === 'boss' && prevPhase === 'warning') audio.bgmBoss();
    if (this.enemies.phase === 'waves' && prevPhase === 'boss') {
      audio.bgmStage();
      this._vibrate([80, 40, 80, 40, 300]);
    }
    if (!prevBossP2 && this.enemies.boss?.isPhase2) {
      audio.bossPhase2();
      this._vibrate([200, 80, 200]);
    }
    this.options.update(dt, this.player, this.bullets, this.input);
    this.terrain.update(dt, this.enemies.loop);
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
    // bullets vs terrain (both sides' shots are stopped by rock)
    for (const b of this.bullets.list) {
      if (!b.dead && this.terrain.hitTest(b.x, b.y, 3)) {
        b.dead = true;
        this.fx.hit(b.x, b.y);
      }
    }
    for (const b of this.enemies.bullets) {
      if (!b.dead && this.terrain.hitTest(b.x, b.y, b.r)) b.dead = true;
    }

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
    if (this.terrain.hitTest(p.x, p.y, p.radius + 2)) {
      this.killPlayer();
      return;
    }
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
    this._vibrate(180);
  }

  _vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  updateGameover(dt) {
    // let the battlefield wind down behind the message
    this.enemies.spawningEnabled = false;
    this.enemies.update(dt, null);
    this.terrain.update(dt, this.enemies.loop);
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
      case STATE.SPLASH:   this.renderSplash(ctx); break;
      case STATE.TITLE:    this.renderTitle(ctx); break;
      case STATE.PLAYING:  this.renderPlaying(ctx); break;
      case STATE.GAMEOVER: this.renderGameover(ctx); break;
    }

    this.input.renderTouchUI(ctx);
  }

  renderSplash(ctx) {
    const t = this.stateTime;
    ctx.textAlign = 'center';

    // "STUDIO UNNO presents" — 500ms pause, fade in 0.5-1.3s, hold, fade out 2.5-3.3s, 500ms pause → title
    const a1 = t < 0.5 ? 0 : t < 1.3 ? (t - 0.5) / 0.8 : t < 2.5 ? 1.0 : Math.max(0, 1.0 - (t - 2.5) / 0.8);
    if (a1 > 0.01) {
      ctx.globalAlpha = a1;
      ctx.fillStyle = '#8fa8cc';
      ctx.font = '22px monospace';
      ctx.fillText('STUDIO UNNO presents', W / 2, H / 2);
      ctx.globalAlpha = 1;
    }

    // skip hint
    if (t > 1.0 && Math.floor(t * 2) % 2 === 0) {
      ctx.fillStyle = 'rgba(70,97,138,0.55)';
      ctx.font = '14px monospace';
      ctx.fillText('PRESS FIRE TO SKIP', W / 2, H - 52);
    }
  }

  renderTitle(ctx) {
    const t = this.time;
    const fade = Math.min(1, this.stateTime / 0.5);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';

    // Decorative framing line
    ctx.strokeStyle = 'rgba(143,208,255,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 280, H / 2 - 42);
    ctx.lineTo(W / 2 + 280, H / 2 - 42);
    ctx.stroke();

    const pulse = 0.8 + Math.sin(t * 1.5) * 0.2;
    ctx.shadowBlur = 22 * pulse;
    ctx.shadowColor = '#7df9ff';
    ctx.fillStyle = '#8fd0ff';
    ctx.font = 'bold 72px monospace';
    ctx.fillText('AI R-TYPE', W / 2, H / 2 + 28);
    ctx.shadowBlur = 0;

    ctx.font = '20px monospace';
    ctx.fillStyle = '#5a7aa0';
    ctx.fillText('— FABLE EDITION —', W / 2, H / 2 + 72);

    if (this.hiScore > 0) {
      ctx.fillStyle = '#ffe9a0';
      ctx.font = '18px monospace';
      ctx.fillText(`HI-SCORE ${String(this.hiScore).padStart(7, '0')}`, W / 2, H / 2 + 108);
    }

    if (Math.floor(t * 2) % 2 === 0) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px monospace';
      ctx.fillText('PRESS FIRE / TAP TO START', W / 2, H / 2 + 148);
      ctx.shadowBlur = 0;
    }

    ctx.font = '15px monospace';
    ctx.fillStyle = '#46618a';
    ctx.fillText('MOVE: ARROWS / WASD · FIRE: Z X SPACE (HOLD = CHARGE) · FORCE: V', W / 2, H - 52);
    ctx.restore();
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

    // Dark edge vignette (no red — atmosphere only)
    const vgAlpha = 0.45 + Math.sin(this.time * 2.5) * 0.08;
    const vg = ctx.createRadialGradient(W / 2, H / 2, 180, W / 2, H / 2, 560);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${vgAlpha})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';

    // "GAME OVER" with glow
    ctx.shadowBlur = 36;
    ctx.shadowColor = '#ff3030';
    ctx.fillStyle = '#ff6060';
    ctx.font = 'bold 64px monospace';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 28);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#dce8ff';
    ctx.font = '24px monospace';
    ctx.fillText(`SCORE ${String(this.score).padStart(7, '0')}`, W / 2, H / 2 + 28);

    if (this.newRecord && Math.floor(this.time * 3) % 2 === 0) {
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#ffe9a0';
      ctx.fillStyle = '#ffe9a0';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('★ NEW RECORD! ★', W / 2, H / 2 + 66);
      ctx.shadowBlur = 0;
    }

    if (this.stateTime > 1 && Math.floor(this.time * 2) % 2 === 0) {
      ctx.fillStyle = '#9ecbff';
      ctx.font = '18px monospace';
      ctx.fillText('PRESS FIRE / TAP TO CONTINUE', W / 2, H / 2 + 108);
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

    // option unit indicators (small glowing circles + F/B/D labels, bottom-left)
    const opts = this.options.units;
    for (let i = 0; i < opts.length; i++) {
      const u = opts[i];
      const ox = 20 + i * 22;
      const oy = H - 48;
      const det = u.mode === 'detached' || u.mode === 'recall';
      ctx.beginPath();
      ctx.arc(ox, oy, 8, 0, Math.PI * 2);
      ctx.fillStyle = u.hitFlash > 0 ? '#ffffff'
        : det ? 'rgba(181,154,224,0.35)' : '#b59ae0';
      ctx.fill();
      ctx.strokeStyle = det ? '#4a6a90' : '#7df9ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = det ? '#6a7a95' : '#cfe0ff';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(det ? 'D' : (u.mode === 'front' ? 'F' : 'B'), ox, oy + 22);
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
