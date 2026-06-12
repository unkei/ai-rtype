// AI R-TYPE — entry point: game loop, state machine, parallax background
export const W = 960;
export const H = 540;

export const STATE = {
  TITLE: 'title',
  PLAYING: 'playing',
  GAMEOVER: 'gameover',
};

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
    this.state = STATE.TITLE;
    this.starfield = new Starfield();
    this.terrain = new Terrain();
    this.time = 0;            // global clock for blink effects
  }

  update(dt) {
    this.time += dt;
    this.starfield.update(dt);
    this.terrain.update(dt);

    switch (this.state) {
      case STATE.TITLE:    this.updateTitle(dt); break;
      case STATE.PLAYING:  this.updatePlaying(dt); break;
      case STATE.GAMEOVER: this.updateGameover(dt); break;
    }
  }

  // State hooks — fleshed out in later tasks.
  updateTitle(dt) {}
  updatePlaying(dt) {}
  updateGameover(dt) {}

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
  }

  renderTitle(ctx) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8fd0ff';
    ctx.font = 'bold 72px monospace';
    ctx.fillText('AI R-TYPE', W / 2, H / 2 - 60);
    ctx.font = '20px monospace';
    ctx.fillStyle = '#5a7aa0';
    ctx.fillText('— FABLE EDITION —', W / 2, H / 2 - 18);
    if (Math.floor(this.time * 2) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px monospace';
      ctx.fillText('PRESS FIRE / TAP TO START', W / 2, H / 2 + 70);
    }
  }

  renderPlaying(ctx) {}

  renderGameover(ctx) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6060';
    ctx.font = 'bold 56px monospace';
    ctx.fillText('GAME OVER', W / 2, H / 2);
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
