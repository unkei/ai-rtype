// Mid-screen terrain obstacles: pillars, walls and gates that scroll in from
// the right edge. Player collides fatally; player and enemy bullets are
// stopped. Logic-only — render3d.js mirrors segments as box meshes.
import { W, H } from './config.js';

const SCROLL_SPEED = 120;     // px/s leftward, matches the edge terrain strips
const SCRIPT_T = 40;          // script length in seconds; repeats every loop

export class TerrainManager {
  constructor() {
    this.segments = [];       // { x, y, w, h, dead } — x,y = top-left corner
    this.t = 0;
    this.script = this._buildScript();
    this.idx = 0;
  }

  // ---- spawn helpers (all enter just past the right edge) ----

  _pillar(xOff = 0) {
    const h = 120 + Math.random() * 100;              // 120-220
    const yMid = H / 4 + Math.random() * (H / 2);     // H/4 .. 3H/4
    const y = Math.max(50, Math.min(H - 50 - h, yMid - h / 2));
    this.segments.push({ x: W + 40 + xOff, y, w: 28, h, dead: false });
  }

  _topWall(w = 200 + Math.random() * 180) {
    this.segments.push({ x: W + 40, y: 40, w, h: 80, dead: false });
  }

  _bottomWall(w = 200 + Math.random() * 180) {
    this.segments.push({ x: W + 40, y: H - 120, w, h: 80, dead: false });
  }

  // Two wall segments leaving a 220px vertical gap centred on gapCenter.
  _gate(gapCenter = H / 2) {
    const gap = 220;
    const w = 64;
    const x = W + 40;
    const topH = Math.max(0, gapCenter - gap / 2);
    const botY = Math.min(H, gapCenter + gap / 2);
    if (topH > 0) this.segments.push({ x, y: 0, w, h: topH, dead: false });
    if (botY < H) this.segments.push({ x, y: botY, w, h: H - botY, dead: false });
  }

  _buildScript() {
    return [
      { t:  5, fn: (m) => m._pillar() },
      { t: 10, fn: (m) => m._gate(H / 2) },
      { t: 15, fn: (m) => m._topWall(300) },
      { t: 20, fn: (m, loop) => {
        m._pillar(0);
        m._pillar(120);
        if (loop >= 2) m._pillar(240);      // "maze" variant from loop 2+
      } },
      { t: 25, fn: (m) => m._bottomWall() },
      { t: 30, fn: (m) => m._gate(H / 3) }, // gap in the upper third
      { t: 35, fn: (m) => { m._pillar(); m._topWall(); } },
    ];
  }

  update(dt, loop) {
    this.t += dt;
    while (this.idx < this.script.length && this.script[this.idx].t <= this.t) {
      this.script[this.idx].fn(this, loop);
      this.idx++;
    }
    if (this.idx >= this.script.length && this.t >= SCRIPT_T) {
      this.t -= SCRIPT_T;
      this.idx = 0;
    }

    for (const s of this.segments) {
      s.x -= SCROLL_SPEED * dt;
      if (s.x + s.w < -20) s.dead = true;
    }
    this.segments = this.segments.filter((s) => !s.dead);
  }

  // Circle (cx, cy, radius) vs any segment rect.
  hitTest(cx, cy, radius) {
    for (const s of this.segments) {
      const nearX = Math.max(s.x, Math.min(cx, s.x + s.w));
      const nearY = Math.max(s.y, Math.min(cy, s.y + s.h));
      if ((cx - nearX) ** 2 + (cy - nearY) ** 2 < radius * radius) return true;
    }
    return false;
  }

  reset() {
    this.segments = [];
    this.t = 0;
    this.idx = 0;
  }
}
