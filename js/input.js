// InputManager — unifies keyboard, gamepad, and touch into one interface.
//
// Edge detection contract: all "justPressed" flags are computed once per frame
// in beginFrame() (call it at the top of the game loop). Reading them anywhere
// during the frame gives the same answer; events arriving mid-frame are
// buffered and surface on the NEXT beginFrame().
import { W, H } from './config.js';

const KEYS_LEFT  = ['ArrowLeft', 'KeyA'];
const KEYS_RIGHT = ['ArrowRight', 'KeyD'];
const KEYS_UP    = ['ArrowUp', 'KeyW'];
const KEYS_DOWN  = ['ArrowDown', 'KeyS'];
const KEYS_FIRE  = ['Space', 'KeyZ', 'KeyX', 'KeyJ'];
const KEYS_START = ['Enter'];
const KEYS_FORCE = ['KeyV'];

const PAD_DEADZONE = 0.25;
const STICK_RADIUS = 60;       // logical px for full deflection
const STICK_ZONE = W * 0.45;   // touches left of this are the virtual stick
const FORCE_BTN = { x: W - 110, y: H - 230, r: 44 };  // touch FORCE button

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;

    // -- public state, valid after beginFrame() --
    this.moveX = 0;
    this.moveY = 0;
    this.fire = false;          // held
    this.firePressed = false;   // edge
    this.startPressed = false;  // edge
    this.forcePressed = false;  // edge — option detach/recall
    this.touchActive = false;   // a touch ever happened → show touch UI

    // -- keyboard --
    this._keys = new Set();
    this._pendingFire = false;
    this._pendingStart = false;
    this._pendingForce = false;

    // -- gamepad --
    this._padFirePrev = false;
    this._padStartPrev = false;
    this._padForcePrev = false;

    // -- touch --
    this._stick = null;          // { id, ox, oy, dx, dy } in logical coords
    this._fireTouches = new Set();

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._keys.delete(e.code));
    window.addEventListener('blur', () => this._keys.clear());

    const opts = { passive: false };
    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), opts);
    canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), opts);
    canvas.addEventListener('touchend', (e) => this._onTouchEnd(e), opts);
    canvas.addEventListener('touchcancel', (e) => this._onTouchEnd(e), opts);
  }

  // ------------------------------------------------------------- keyboard

  _onKeyDown(e) {
    if ([...KEYS_LEFT, ...KEYS_RIGHT, ...KEYS_UP, ...KEYS_DOWN,
         ...KEYS_FIRE, ...KEYS_START, ...KEYS_FORCE].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    this._keys.add(e.code);
    if (KEYS_FIRE.includes(e.code)) this._pendingFire = true;
    if (KEYS_START.includes(e.code)) this._pendingStart = true;
    if (KEYS_FORCE.includes(e.code)) this._pendingForce = true;
  }

  _keyHeld(codes) {
    return codes.some((c) => this._keys.has(c));
  }

  // -------------------------------------------------------------- touch

  _logical(touch) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (touch.clientX - r.left) * (W / r.width),
      y: (touch.clientY - r.top) * (H / r.height),
    };
  }

  _onTouchStart(e) {
    e.preventDefault();
    this.touchActive = true;
    for (const t of e.changedTouches) {
      const p = this._logical(t);
      if (Math.hypot(p.x - FORCE_BTN.x, p.y - FORCE_BTN.y) < FORCE_BTN.r) {
        this._pendingForce = true;
      } else if (p.x < STICK_ZONE && !this._stick) {
        this._stick = { id: t.identifier, ox: p.x, oy: p.y, dx: 0, dy: 0 };
      } else {
        this._fireTouches.add(t.identifier);
        this._pendingFire = true;
      }
      this._pendingStart = true; // any tap acts as "start" on menus
    }
  }

  _onTouchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this._stick && t.identifier === this._stick.id) {
        const p = this._logical(t);
        const dx = p.x - this._stick.ox;
        const dy = p.y - this._stick.oy;
        const len = Math.hypot(dx, dy);
        // Follow joystick: shift origin when finger moves beyond the stick radius,
        // so the ring always stays visible under the finger.
        if (len > STICK_RADIUS) {
          const excess = len - STICK_RADIUS;
          this._stick.ox += (dx / len) * excess;
          this._stick.oy += (dy / len) * excess;
        }
        this._stick.dx = p.x - this._stick.ox;
        this._stick.dy = p.y - this._stick.oy;
      }
    }
  }

  _onTouchEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this._stick && t.identifier === this._stick.id) this._stick = null;
      this._fireTouches.delete(t.identifier);
    }
  }

  // ------------------------------------------------------------- gamepad

  _pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) {
      if (p && p.connected) { pad = p; break; }
    }
    if (!pad) {
      this._padFirePrev = false;
      this._padStartPrev = false;
      this._padForcePrev = false;
      return { x: 0, y: 0, fire: false, fireEdge: false, startEdge: false, forceEdge: false };
    }

    let x = pad.axes[0] ?? 0;
    let y = pad.axes[1] ?? 0;
    if (Math.hypot(x, y) < PAD_DEADZONE) { x = 0; y = 0; }
    const btn = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    if (btn(14)) x = -1;
    if (btn(15)) x = 1;
    if (btn(12)) y = -1;
    if (btn(13)) y = 1;

    const fire = btn(0) || btn(1) || btn(2) || btn(5) || btn(7);
    const start = btn(9);
    const fireEdge = fire && !this._padFirePrev;
    const startEdge = start && !this._padStartPrev;
    this._padFirePrev = fire;
    this._padStartPrev = start;
    const force = btn(4);
    const forceEdge = force && !this._padForcePrev;
    this._padForcePrev = force;
    return { x, y, fire, fireEdge, startEdge, forceEdge };
  }

  // --------------------------------------------------------------- frame

  beginFrame() {
    const pad = this._pollGamepad();

    let x = 0, y = 0;
    if (this._keyHeld(KEYS_LEFT)) x -= 1;
    if (this._keyHeld(KEYS_RIGHT)) x += 1;
    if (this._keyHeld(KEYS_UP)) y -= 1;
    if (this._keyHeld(KEYS_DOWN)) y += 1;

    x += pad.x;
    y += pad.y;

    if (this._stick) {
      x += this._stick.dx / STICK_RADIUS;
      y += this._stick.dy / STICK_RADIUS;
    }

    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    this.moveX = Math.abs(x) < 0.05 ? 0 : x;
    this.moveY = Math.abs(y) < 0.05 ? 0 : y;

    this.fire = this._keyHeld(KEYS_FIRE) || pad.fire || this._fireTouches.size > 0;
    this.firePressed = this._pendingFire || pad.fireEdge;
    this.startPressed = this._pendingStart || pad.startEdge;
    this.forcePressed = this._pendingForce || (pad.forceEdge ?? false);
    this._pendingFire = false;
    this._pendingStart = false;
    this._pendingForce = false;
  }

  // ------------------------------------------------------------ touch UI

  renderTouchUI(ctx) {
    if (!this.touchActive) return;
    ctx.save();
    ctx.globalAlpha = 0.35;

    if (this._stick) {
      const s = this._stick;
      const len = Math.hypot(s.dx, s.dy);
      const cap = len > STICK_RADIUS ? STICK_RADIUS / len : 1;
      ctx.strokeStyle = '#9ecbff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.ox, s.oy, STICK_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#9ecbff';
      ctx.beginPath();
      ctx.arc(s.ox + s.dx * cap, s.oy + s.dy * cap, 24, 0, Math.PI * 2);
      ctx.fill();
    }

    // fire button hint (any right-side touch fires; this is just a visual)
    ctx.strokeStyle = this._fireTouches.size > 0 ? '#ffd76e' : '#9ecbff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W - 110, H - 110, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FIRE', W - 110, H - 104);

    // FORCE (option detach/recall) button
    ctx.strokeStyle = '#b59ae0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(FORCE_BTN.x, FORCE_BTN.y, 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#b59ae0';
    ctx.font = '13px monospace';
    ctx.fillText('FORCE', FORCE_BTN.x, FORCE_BTN.y + 5);

    ctx.restore();
  }
}
