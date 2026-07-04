// Render3D — Three.js view layer. Game logic stays in 2D logical space
// (960×540, y-down, z=0 plane); this module mirrors it with 3D models,
// lights, particles and bloom. Text/HUD lives on the 2D overlay canvas.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { W, H, STATE } from './config.js';
import { Straight, Sine, Dart, Turret, Boss } from './enemies.js';

// logical (y-down) → world (y-up), gameplay plane at z=0
const wx = (x) => x - W / 2;
const wy = (y) => H / 2 - y;

const FOV = 45;
// distance at which the 960×540 plane at z=0 exactly fills the view
const CAM_DIST = (H / 2) / Math.tan((FOV / 2) * Math.PI / 180);

const MAX_PARTICLES = 512;

// ------------------------------------------------------- shared materials

const MAT = {
  playerHull: new THREE.MeshStandardMaterial({ color: 0xc8d6ea, flatShading: true, metalness: 0.7, roughness: 0.35 }),
  playerWing: new THREE.MeshStandardMaterial({ color: 0x5a7aa0, flatShading: true, metalness: 0.6, roughness: 0.4 }),
  canopy:     new THREE.MeshStandardMaterial({ color: 0x104060, emissive: 0x3fa9f5, emissiveIntensity: 1.6, roughness: 0.2 }),
  flame:      new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  chargeOrb:  new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),

  straight:   new THREE.MeshStandardMaterial({ color: 0xff6a6a, flatShading: true, metalness: 0.4, roughness: 0.5, emissive: 0x8a2020, emissiveIntensity: 0.35 }),
  sine:       new THREE.MeshStandardMaterial({ color: 0x6aff8a, flatShading: true, metalness: 0.4, roughness: 0.5, emissive: 0x1f7a35, emissiveIntensity: 0.35 }),
  sineFin:    new THREE.MeshStandardMaterial({ color: 0x2fae52, flatShading: true, metalness: 0.4, roughness: 0.5 }),
  dart:       new THREE.MeshStandardMaterial({ color: 0xffb050, flatShading: true, metalness: 0.5, roughness: 0.45, emissive: 0xa05a10, emissiveIntensity: 0.4 }),
  turret:     new THREE.MeshStandardMaterial({ color: 0x9aa7bd, flatShading: true, metalness: 0.8, roughness: 0.35 }),
  turretEye:  new THREE.MeshBasicMaterial({ color: 0xff4040 }),
  bossHull:   new THREE.MeshStandardMaterial({ color: 0x5d4a7a, flatShading: true, metalness: 0.6, roughness: 0.4, emissive: 0x2a1a45, emissiveIntensity: 0.5 }),
  bossArc:    new THREE.MeshBasicMaterial({ color: 0xb59ae0, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
  bossCore:   new THREE.MeshBasicMaterial({ color: 0xff5078 }),
  flash:      new THREE.MeshBasicMaterial({ color: 0xffffff }),

  shot:       new THREE.MeshBasicMaterial({ color: 0x7df9ff }),
  beam:       new THREE.MeshBasicMaterial({ color: 0xbfffff }),
  beamAura:   new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
  ebullet:    new THREE.MeshBasicMaterial({ color: 0xff80c0 }),
  ebulletCore: new THREE.MeshBasicMaterial({ color: 0xffffff }),

  terrain:    new THREE.MeshStandardMaterial({ color: 0x33476e, flatShading: true, metalness: 0.3, roughness: 0.7 }),
  terrainBack: new THREE.MeshStandardMaterial({ color: 0x1a2438, flatShading: true, metalness: 0.3, roughness: 0.85 }),
};

// all geometries are shared — entity meshes come and go constantly
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 12, 8),
  spike: new THREE.ConeGeometry(1, 1, 4),
  playerBody: new THREE.ConeGeometry(8, 40, 6),
  flame: new THREE.ConeGeometry(4.5, 18, 8),
  straight: new THREE.IcosahedronGeometry(13, 0),
  fin: new THREE.ConeGeometry(4, 12, 4),
  dart: new THREE.ConeGeometry(8, 26, 4),
  dome: new THREE.SphereGeometry(13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  barrel: new THREE.CylinderGeometry(2.5, 2.5, 16, 8),
  bossHull: new THREE.DodecahedronGeometry(42, 0),
  bossArc: new THREE.TorusGeometry(52, 2.2, 8, 24, 1.1),
};

// ------------------------------------------------------------ model builders

function buildPlayer() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(GEO.playerBody, MAT.playerHull);
  body.rotation.z = -Math.PI / 2;
  g.add(body);

  const canopy = new THREE.Mesh(GEO.sphere, MAT.canopy);
  canopy.scale.set(6, 3.5, 4);
  canopy.position.set(4, 4, 0);
  g.add(canopy);

  const wings = new THREE.Mesh(GEO.box, MAT.playerWing);
  wings.scale.set(18, 2.5, 34);
  wings.position.set(-8, -2, 0);
  g.add(wings);

  const tail = new THREE.Mesh(GEO.box, MAT.playerWing);
  tail.scale.set(9, 11, 2.5);
  tail.position.set(-13, 6, 0);
  g.add(tail);

  const flame = new THREE.Mesh(GEO.flame, MAT.flame);
  flame.rotation.z = Math.PI / 2;
  flame.position.set(-27, 0, 0);
  g.add(flame);
  g.userData.flame = flame;

  const orb = new THREE.Mesh(GEO.sphere, MAT.chargeOrb);
  orb.position.set(26, 0, 0);
  orb.visible = false;
  g.add(orb);
  g.userData.chargeOrb = orb;

  const light = new THREE.PointLight(0x7df9ff, 900, 260);
  light.position.set(6, 0, 30);
  g.add(light);

  return g;
}

function buildStraight() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(GEO.straight, MAT.straight);
  body.scale.set(1.15, 0.7, 0.9);
  g.add(body);
  g.userData.spin = body;
  return g;
}

function buildSine() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(GEO.sphere, MAT.sine);
  body.scale.setScalar(11);
  g.add(body);
  for (const dir of [1, -1]) {
    const fin = new THREE.Mesh(GEO.fin, MAT.sineFin);
    fin.position.set(6, 13 * dir, 0);
    fin.rotation.z = dir > 0 ? 0.5 : Math.PI - 0.5;
    g.add(fin);
  }
  return g;
}

function buildDart() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(GEO.dart, MAT.dart);
  body.rotation.z = -Math.PI / 2;
  g.add(body);
  g.userData.body = body;
  return g;
}

function buildTurret(top) {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(GEO.dome, MAT.turret);
  g.add(dome);
  const barrel = new THREE.Mesh(GEO.barrel, MAT.turret);
  barrel.position.set(-7, 8, 0);
  barrel.rotation.z = 0.7;
  g.add(barrel);
  const eye = new THREE.Mesh(GEO.sphere, MAT.turretEye);
  eye.scale.setScalar(3.2);
  eye.position.set(0, 6, 0);
  g.add(eye);
  // logical-top turrets hang downward in world space
  if (top) g.rotation.z = Math.PI;
  return g;
}

function buildBoss() {
  const g = new THREE.Group();

  const hull = new THREE.Mesh(GEO.bossHull, MAT.bossHull);
  hull.scale.set(1.3, 1, 1);
  g.add(hull);
  g.userData.hull = hull;

  const arcs = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const arc = new THREE.Mesh(GEO.bossArc, MAT.bossArc);
    arc.rotation.z = (i * Math.PI * 2) / 3;
    arcs.add(arc);
  }
  g.add(arcs);
  g.userData.arcs = arcs;

  const core = new THREE.Mesh(GEO.sphere, MAT.bossCore);
  core.scale.setScalar(14);
  core.position.set(-2, 0, 30);
  g.add(core);
  g.userData.core = core;

  const light = new THREE.PointLight(0xff5078, 2200, 420);
  light.position.set(0, 0, 60);
  g.add(light);

  return g;
}

function buildBullet(b) {
  if (b.kind === 'beam') {
    const g = new THREE.Group();
    const core = new THREE.Mesh(GEO.box, MAT.beam);
    core.scale.set(b.w, b.h, b.h);
    g.add(core);
    const aura = new THREE.Mesh(GEO.box, MAT.beamAura);
    aura.scale.set(b.w + 14, b.h + 8, b.h + 8);
    g.add(aura);
    return g;
  }
  const g = new THREE.Group();
  const core = new THREE.Mesh(GEO.box, MAT.shot);
  core.scale.set(14, 4, 4);
  g.add(core);
  return g;
}

function buildEnemyBullet(b) {
  const g = new THREE.Group();
  const glow = new THREE.Mesh(GEO.sphere, MAT.ebullet);
  glow.scale.setScalar(b.r + 1.5);
  g.add(glow);
  const core = new THREE.Mesh(GEO.sphere, MAT.ebulletCore);
  core.scale.setScalar(b.r * 0.5);
  g.add(core);
  return g;
}

// ------------------------------------------------------------------ renderer

export class Render3D {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(W, H, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070f);
    this.scene.fog = new THREE.Fog(0x05070f, 750, 1400);

    this.camera = new THREE.PerspectiveCamera(FOV, W / H, 1, 2000);
    this.camera.position.set(0, 0, CAM_DIST);

    this.scene.add(new THREE.AmbientLight(0x8090b0, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(200, 300, 400);
    this.scene.add(sun);

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.composer.setSize(W, H);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 1.05, 0.55, 0.5));

    this.time = 0;
    this._meshes = new Map();   // game entity → THREE.Group
    this._live = new Set();

    this._initStars();
    this._initTerrain();
    this._initParticles();
  }

  // ----------------------------------------------------------- starfield

  _initStars() {
    this._starLayers = [];
    const layers = [
      { speed: 30,  size: 2.5, count: 70, color: 0x7890c8, z: -320 },
      { speed: 80,  size: 3.5, count: 40, color: 0xb4c8ff, z: -160 },
      { speed: 160, size: 4.5, count: 18, color: 0xffffff, z: -60 },
    ];
    for (const l of layers) {
      const pos = new Float32Array(l.count * 3);
      // spawn across a widened band so wrapped stars cover the fringes
      // that perspective exposes at depth
      const spread = 1.6;
      for (let i = 0; i < l.count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * W * spread;
        pos[i * 3 + 1] = (Math.random() - 0.5) * H * spread;
        pos[i * 3 + 2] = l.z;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: l.color, size: l.size, sizeAttenuation: true,
        transparent: true, opacity: 0.9, depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      this.scene.add(points);
      this._starLayers.push({ points, speed: l.speed, halfW: W * spread * 0.5, halfH: H * spread * 0.5 });
    }
  }

  _scrollStars(dt) {
    for (const l of this._starLayers) {
      const pos = l.points.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i) - l.speed * dt;
        if (x < -l.halfW) {
          x = l.halfW;
          pos.setY(i, (Math.random() - 0.5) * l.halfH * 2);
        }
        pos.setX(i, x);
      }
      pos.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------- terrain

  _initTerrain() {
    // crystalline spikes scrolling along top and bottom edges;
    // front row matches the old 2D terrain scroll, back row adds parallax
    this._spikes = [];
    const rows = [
      { z: -10, speed: 120, seg: 48, hMin: 16, hMax: 48, mat: MAT.terrain },
      { z: -110, speed: 60, seg: 64, hMin: 24, hMax: 64, mat: MAT.terrainBack },
    ];
    for (const row of rows) {
      for (const top of [true, false]) {
        const n = Math.ceil(W / row.seg) + 3;
        const mesh = new THREE.InstancedMesh(GEO.spike, row.mat, n);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(mesh);
        const items = Array.from({ length: n }, (_, i) => ({
          x: -W / 2 + (i - 1) * row.seg,
          h: row.hMin + Math.random() * (row.hMax - row.hMin),
        }));
        this._spikes.push({ mesh, items, top, ...row });
      }
    }
    this._dummy = new THREE.Object3D();

    // solid wall strips along both edges
    for (const top of [true, false]) {
      const wall = new THREE.Mesh(GEO.box, MAT.terrainBack);
      wall.scale.set(W + 200, 14, 160);
      wall.position.set(0, (top ? 1 : -1) * (H / 2 + 3), -60);
      this.scene.add(wall);
    }
  }

  _scrollTerrain(dt) {
    for (const s of this._spikes) {
      const edge = s.top ? H / 2 : -H / 2;
      const dir = s.top ? -1 : 1;
      for (let i = 0; i < s.items.length; i++) {
        const it = s.items[i];
        it.x -= s.speed * dt;
        if (it.x < -W / 2 - s.seg * 1.5) {
          it.x += s.items.length * s.seg;
          it.h = s.hMin + Math.random() * (s.hMax - s.hMin);
        }
        this._dummy.position.set(it.x, edge + dir * it.h / 2, s.z);
        this._dummy.scale.set(s.seg * 0.62, dir * it.h, s.seg * 0.62);
        this._dummy.rotation.set(0, (i * 0.7) % Math.PI, 0);
        this._dummy.updateMatrix();
        s.mesh.setMatrixAt(i, this._dummy.matrix);
      }
      s.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // ----------------------------------------------------------- particles

  _initParticles() {
    const geo = new THREE.BufferGeometry();
    this._pPos = new Float32Array(MAX_PARTICLES * 3);
    this._pCol = new Float32Array(MAX_PARTICLES * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this._pPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this._pCol, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.PointsMaterial({
      size: 6, sizeAttenuation: true, vertexColors: true,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this._particles = new THREE.Points(geo, mat);
    this._particles.frustumCulled = false;
    this.scene.add(this._particles);
    this._colorCache = new Map();
  }

  _color(str) {
    let c = this._colorCache.get(str);
    if (!c) {
      c = new THREE.Color(str);
      this._colorCache.set(str, c);
    }
    return c;
  }

  _syncParticles(fx) {
    const n = Math.min(fx.particles.length, MAX_PARTICLES);
    for (let i = 0; i < n; i++) {
      const p = fx.particles[i];
      this._pPos[i * 3] = wx(p.x);
      this._pPos[i * 3 + 1] = wy(p.y);
      this._pPos[i * 3 + 2] = 20;
      const a = Math.max(p.life / p.maxLife, 0);
      const c = this._color(p.color);
      this._pCol[i * 3] = c.r * a;
      this._pCol[i * 3 + 1] = c.g * a;
      this._pCol[i * 3 + 2] = c.b * a;
    }
    const geo = this._particles.geometry;
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  // ------------------------------------------------------------ entities

  _obj(ent, build) {
    let o = this._meshes.get(ent);
    if (!o) {
      o = build();
      this._meshes.set(ent, o);
      this.scene.add(o);
    }
    this._live.add(ent);
    return o;
  }

  _syncPlayer(game) {
    const p = game.player;
    if (!p.alive) return;
    const o = this._obj(p, buildPlayer);
    o.position.set(wx(p.x), wy(p.y), 0);
    // blink while invulnerable
    o.visible = !(p.invuln > 0 && Math.floor(p.time * 12) % 2 === 0);
    // bank into vertical movement
    const targetRoll = game.input.moveY * 0.55;
    o.rotation.x += (targetRoll - o.rotation.x) * 0.18;

    const flame = o.userData.flame;
    flame.scale.y = 0.8 + Math.sin(p.time * 40) * 0.35;

    const orb = o.userData.chargeOrb;
    if (p.charging && p.chargeTime > 0.15) {
      orb.visible = true;
      const r = 4 + p.chargeRatio * 12 + Math.sin(p.time * 30) * 2;
      orb.scale.setScalar(r);
    } else {
      orb.visible = false;
    }
  }

  _syncEnemies(game) {
    for (const e of game.enemies.enemies) {
      if (e.dead) continue;
      let o;
      if (e instanceof Boss) {
        o = this._obj(e, buildBoss);
        o.userData.hull.rotation.x = e.t * 0.4;
        o.userData.hull.material = e.hitFlash > 0 ? MAT.flash : MAT.bossHull;
        o.userData.arcs.rotation.z = -e.t * 1.6;
        const pulse = 1 + Math.sin(e.t * 6) * 0.18;
        o.userData.core.scale.setScalar(14 * pulse);
        o.userData.core.material = e.hitFlash > 0 ? MAT.flash : MAT.bossCore;
      } else if (e instanceof Straight) {
        o = this._obj(e, buildStraight);
        o.userData.spin.rotation.y = e.t * 2.4;
      } else if (e instanceof Sine) {
        o = this._obj(e, buildSine);
        o.rotation.z = Math.sin(e.t * 4) * 0.3;
      } else if (e instanceof Dart) {
        o = this._obj(e, buildDart);
        // face travel direction (logical y-down → negate for world)
        o.rotation.z = -Math.atan2(e.vy, e.vx || -1) + Math.PI;
        o.userData.body.material = (e.phase === 'aim' && Math.floor(e.t * 12) % 2 === 0) ? MAT.flash : MAT.dart;
        o.userData.body.rotation.x = e.t * 6;
      } else if (e instanceof Turret) {
        o = this._obj(e, () => buildTurret(e.top));
      } else {
        continue;
      }
      o.position.set(wx(e.x), wy(e.y), 0);
    }
  }

  _syncBullets(game) {
    for (const b of game.bullets.list) {
      if (b.dead) continue;
      const o = this._obj(b, () => buildBullet(b));
      o.position.set(wx(b.x), wy(b.y), 0);
    }
    for (const b of game.enemies.bullets) {
      if (b.dead) continue;
      const o = this._obj(b, () => buildEnemyBullet(b));
      o.position.set(wx(b.x), wy(b.y), 0);
      o.rotation.y = this.time * 5;
    }
  }

  // ----------------------------------------------------------------- frame

  update(dt, game) {
    this.time += dt;
    this._scrollStars(dt);
    this._scrollTerrain(dt);

    this._live.clear();
    if (game.state !== STATE.TITLE) {
      this._syncPlayer(game);
      this._syncEnemies(game);
      this._syncBullets(game);
    }
    for (const [ent, o] of this._meshes) {
      if (!this._live.has(ent)) {
        this.scene.remove(o);
        this._meshes.delete(ent);
      }
    }

    this._syncParticles(game.fx);

    // subtle camera follow for extra depth
    const p = game.player;
    const followX = game.state === STATE.PLAYING && p.alive ? wx(p.x) * 0.05 : 0;
    const followY = game.state === STATE.PLAYING && p.alive ? wy(p.y) * 0.05 : 0;
    this.camera.position.x += (followX - this.camera.position.x) * 0.05;
    this.camera.position.y += (followY - this.camera.position.y) * 0.05;
    this.camera.lookAt(this.camera.position.x * 0.5, this.camera.position.y * 0.5, 0);
  }

  render() {
    this.composer.render();
  }
}
