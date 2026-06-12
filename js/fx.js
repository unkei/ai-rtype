// Visual effects: particle explosions and score popups.

export class FX {
  constructor() {
    this.particles = [];
    this.popups = [];
  }

  clear() {
    this.particles = [];
    this.popups = [];
  }

  popup(x, y, text, color = '#ffe9a0') {
    this.popups.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  }

  explosion(x, y, { color = '#ffb060', count = 24, speed = 220, size = 4 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.25 + Math.random() * 0.75);
      const life = 0.4 + Math.random() * 0.45;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life,
        maxLife: life,
        size: size * (0.5 + Math.random()),
        color,
      });
    }
  }

  hit(x, y) {
    this.explosion(x, y, { color: '#bfffff', count: 6, speed: 120, size: 2.5 });
  }

  update(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.5 * dt;
      p.vy *= 1 - 1.5 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const u of this.popups) {
      u.life -= dt;
      u.y -= 42 * dt;
    }
    this.popups = this.popups.filter((u) => u.life > 0);
  }

  render(ctx) {
    for (const p of this.particles) {
      const a = Math.max(p.life / p.maxLife, 0);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + a * 0.6);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    for (const u of this.popups) {
      ctx.globalAlpha = Math.max(u.life / u.maxLife, 0);
      ctx.fillStyle = u.color;
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(u.text, u.x, u.y);
    }
    ctx.globalAlpha = 1;
  }
}
