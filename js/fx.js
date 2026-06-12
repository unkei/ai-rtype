// Visual effects: particle explosions, shockwave rings, score popups,
// and charge-beam energy particles that get sucked into the ship's nose.

export class FX {
  constructor() {
    this.particles = [];
    this.popups = [];
    this.rings = [];
    this.sucks = [];
    this.chargeTarget = null;
  }

  clear() {
    this.particles = [];
    this.popups = [];
    this.rings = [];
    this.sucks = [];
  }

  popup(x, y, text, color = '#ffe9a0') {
    this.popups.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  }

  explosion(x, y, { color = '#ffb060', count = 24, speed = 220, size = 4 } = {}) {
    if (count >= 20) {
      this.rings.push({ x, y, r: 8, vr: speed * 1.8, life: 0.32, maxLife: 0.32, color });
    }
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

  // Spawn energy motes around the ship's nose; update() pulls them in.
  chargeSuck(tx, ty, ratio) {
    this.chargeTarget = { x: tx, y: ty };
    const n = 1 + Math.floor(ratio * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 36 + Math.random() * 34;
      const life = 0.45 + Math.random() * 0.2;
      this.sucks.push({
        x: tx + Math.cos(a) * r,
        y: ty + Math.sin(a) * r,
        life,
        maxLife: life,
        size: 1.5 + Math.random() * 2 + ratio * 2,
        color: ratio >= 1 ? '#ffd76e' : '#7df9ff',
      });
    }
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

    for (const r of this.rings) {
      r.life -= dt;
      r.r += r.vr * dt;
      r.vr *= 1 - 4 * dt;
    }
    this.rings = this.rings.filter((r) => r.life > 0);

    const t = this.chargeTarget;
    for (const s of this.sucks) {
      s.life -= dt;
      if (t) {
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const d = Math.hypot(dx, dy);
        // accelerate inward as the mote ages — reads as being absorbed
        const v = 140 + (1 - s.life / s.maxLife) * 520;
        if (d < Math.max(v * dt, 7)) {
          s.life = 0;
        } else {
          s.x += (dx / d) * v * dt;
          s.y += (dy / d) * v * dt;
        }
      }
    }
    this.sucks = this.sucks.filter((s) => s.life > 0);
  }

  render(ctx) {
    for (const r of this.rings) {
      ctx.globalAlpha = Math.max(r.life / r.maxLife, 0);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const s of this.sucks) {
      ctx.globalAlpha = Math.min(s.life / s.maxLife * 2, 1);
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
    }
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
