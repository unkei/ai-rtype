'use strict';

// ===== Constants =====
const GAME_W = 960;
const GAME_H = 540;

// ===== Background =====
class Background {
  constructor() {
    this.layers = [
      { speed: 25,  count: 60,  size: 1, color: '#334' },
      { speed: 70,  count: 30,  size: 1, color: '#668' },
      { speed: 150, count: 15,  size: 2, color: '#aac' },
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
        if (s.x < 0) {
          s.x = GAME_W + Math.random() * 20;
          s.y = Math.random() * GAME_H;
        }
      }
    }
  }

  render(ctx) {
    ctx.fillStyle = '#000014';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    for (const layer of this.layers) {
      ctx.fillStyle = layer.color;
      for (const s of layer.stars) {
        ctx.fillRect(s.x | 0, s.y | 0, layer.size, layer.size);
      }
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
  _ctx() {
    if (!this._actx) this._actx = new (window.AudioContext || window.webkitAudioContext)();
    return this._actx;
  }
  shoot() {}
  chargeLoop(_level) {}
  chargeFire() {}
  explode() {}
  hit() {}
}

// ===== Game =====
const STATE = Object.freeze({ TITLE: 'title', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' });

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = STATE.TITLE;
    this.bg = new Background();
    this.particles = new ParticleSystem();
    this.audio = new AudioManager();
    this.lastTime = null;
  }

  start() {
    requestAnimationFrame((t) => this._frame(t));
  }

  _frame(time) {
    if (this.lastTime === null) this.lastTime = time;
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;
    this._update(dt);
    this._render();
    requestAnimationFrame((t) => this._frame(t));
  }

  _update(dt) {
    this.bg.update(dt);
    this.particles.update(dt);
  }

  _render() {
    const ctx = this.ctx;
    this.bg.render(ctx);
    this.particles.render(ctx);
    if (this.state === STATE.TITLE) this._renderTitle(ctx);
  }

  _renderTitle(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,20,0.5)';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title
    ctx.fillStyle = '#0af';
    ctx.font = 'bold 72px monospace';
    ctx.shadowColor = '#0af';
    ctx.shadowBlur = 20;
    ctx.fillText('AI R-TYPE', GAME_W / 2, GAME_H / 2 - 60);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = '22px monospace';
    ctx.fillText('CORE ENGINE ACTIVE', GAME_W / 2, GAME_H / 2 + 10);

    ctx.fillStyle = '#888';
    ctx.font = '16px monospace';
    ctx.fillText('more features coming soon...', GAME_W / 2, GAME_H / 2 + 50);
    ctx.restore();
  }
}

// ===== Boot =====
window.addEventListener('load', () => {
  const canvas = document.getElementById('game');
  if (!canvas) { console.error('canvas#game not found'); return; }
  new Game(canvas).start();
});
