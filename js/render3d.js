// Render3D — Three.js view layer. Game logic stays in 2D logical space
// (960×540, y-down, z=0 plane); this module mirrors it with real 3D models
// (Kenney Space Kit, CC0 — assets/models/), lights, particles and bloom.
// Text/HUD lives on the 2D overlay canvas.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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

// ------------------------------------------------------------------- models
// len = target size in logical px, measured along `axis` after rotY is
// applied. Ships face +Z in the source files; rotY turns them to +X
// (player) or -X (enemies).

// tint multiplies the source colors (keeps enemy types readable at a glance),
// glow adds emissive so ships pop against the dark background
const ROCK_TINT = 0x7a86a8;
const MODELS = {
  player:   { url: 'assets/models/craft_speederD.glb',  rotY:  Math.PI / 2, len: 68, glow: 0.22 },
  straight: { url: 'assets/models/craft_speederA.glb',  rotY: -Math.PI / 2, len: 48, tint: 0xff7575, glow: 0.3 },
  sine:     { url: 'assets/models/craft_speederB.glb',  rotY: -Math.PI / 2, len: 48, tint: 0x78ff95, glow: 0.3 },
  dart:     { url: 'assets/models/craft_racer.glb',     rotY: -Math.PI / 2, len: 52, tint: 0xffc06a, glow: 0.3 },
  turret:   { url: 'assets/models/turret_single.glb',   rotY: -Math.PI / 2, len: 46, glow: 0.15 },
  boss:     { url: 'assets/models/craft_miner.glb',     rotY: -Math.PI / 2, len: 190, glow: 0.18 },
  meteor:   { url: 'assets/models/meteor.glb',          axis: 'max', len: 1, tint: ROCK_TINT },
  meteor2:  { url: 'assets/models/meteor_detailed.glb', axis: 'max', len: 1, tint: ROCK_TINT },
  rockA:    { url: 'assets/models/rock_largeA.glb',     axis: 'max', len: 1, tint: ROCK_TINT },
  rockB:    { url: 'assets/models/rock_largeB.glb',     axis: 'max', len: 1, tint: ROCK_TINT },
  crystals: { url: 'assets/models/rock_crystals.glb',   axis: 'max', len: 1, tint: ROCK_TINT },
};

const PROTO = {};             // name → normalized THREE.Group prototype

function normalize(gltf, { rotY = 0, len, axis = 'x' }) {
  const inner = new THREE.Group();
  gltf.scene.rotation.y = rotY;
  inner.add(gltf.scene);

  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const measure = axis === 'max' ? Math.max(size.x, size.y, size.z) : size[axis];
  inner.scale.setScalar(len / measure);

  const box2 = new THREE.Box3().setFromObject(inner);
  const center = box2.getCenter(new THREE.Vector3());
  inner.position.sub(center);

  const proto = new THREE.Group();
  proto.add(inner);
  proto.userData.half = box2.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  return proto;
}

export async function loadModels() {
  const loader = new GLTFLoader();
  await Promise.all(Object.entries(MODELS).map(async ([name, cfg]) => {
    const gltf = await loader.loadAsync(cfg.url);
    const proto = normalize(gltf, cfg);
    // materials are freshly created per loadAsync, safe to mutate in place
    const tint = cfg.tint !== undefined ? new THREE.Color(cfg.tint) : null;
    const done = new Set();
    proto.traverse((o) => {
      if (!o.isMesh || done.has(o.material)) return;
      done.add(o.material);
      if (tint) o.material.color.multiply(tint);
      if (cfg.glow && o.material.emissive) {
        o.material.emissive.copy(o.material.color).multiplyScalar(cfg.glow);
      }
    });
    PROTO[name] = proto;
  }));
}

// clone a prototype; remember original materials so we can flash white
function spawn(name) {
  const g = PROTO[name].clone(true);
  g.traverse((o) => {
    if (o.isMesh) o.userData.origMat = o.material;
  });
  g.userData.half = PROTO[name].userData.half;
  return g;
}

function setFlash(g, on) {
  if (g.userData.flashOn === on) return;
  g.userData.flashOn = on;
  g.traverse((o) => {
    if (o.isMesh) o.material = on ? MAT.flash : o.userData.origMat;
  });
}

// ------------------------------------------------------- shared materials

const MAT = {
  flame:      new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  chargeOrb:  new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  bossArc:    new THREE.MeshBasicMaterial({ color: 0xb59ae0, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
  bossCore:   new THREE.MeshBasicMaterial({ color: 0xff5078 }),
  flash:      new THREE.MeshBasicMaterial({ color: 0xffffff }),

  optCapsule: new THREE.MeshBasicMaterial({ color: 0xb59ae0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
  optUnit:    new THREE.MeshBasicMaterial({ color: 0x9060ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  optShot:    new THREE.MeshBasicMaterial({ color: 0xcc88ff }),

  shot:       new THREE.MeshBasicMaterial({ color: 0x7df9ff }),
  beam:       new THREE.MeshBasicMaterial({ color: 0xbfffff }),
  beamAura:   new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
  ebullet:    new THREE.MeshBasicMaterial({ color: 0xff80c0 }),
  ebulletCore: new THREE.MeshBasicMaterial({ color: 0xffffff }),

  planet:     new THREE.MeshStandardMaterial({ color: 0x24455f, roughness: 0.95, metalness: 0.05, fog: false }),
  planetGlow: new THREE.MeshBasicMaterial({ color: 0x4f9ec4, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide, fog: false }),
  wall:       new THREE.MeshStandardMaterial({ color: 0x141b2c, roughness: 0.95, metalness: 0.1 }),
};

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 12, 8),
  flame: new THREE.ConeGeometry(6, 26, 8),
  planet: new THREE.SphereGeometry(1, 48, 32),
};

// ------------------------------------------------------------ model builders

function buildPlayer() {
  const g = spawn('player');
  const half = g.userData.half;

  const flame = new THREE.Mesh(GEO.flame, MAT.flame);
  flame.rotation.z = Math.PI / 2;
  flame.position.set(-half.x - 10, 0, 0);
  g.add(flame);
  g.userData.flame = flame;

  const orb = new THREE.Mesh(GEO.sphere, MAT.chargeOrb);
  orb.position.set(half.x + 8, 0, 0);
  orb.visible = false;
  g.add(orb);
  g.userData.chargeOrb = orb;

  const light = new THREE.PointLight(0x7df9ff, 900, 260);
  light.position.set(6, 10, 40);
  g.add(light);

  return g;
}

function buildTurret(top) {
  const g = spawn('turret');
  // logical-top turrets hang from the ceiling
  if (top) g.rotation.z = Math.PI;
  return g;
}

function buildBoss() {
  const g = spawn('boss');
  const hull = g.children[0];
  g.userData.hull = hull;

  const arcs = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(115, 3.5, 8, 32, 1.1), MAT.bossArc);
    arc.rotation.z = (i * Math.PI * 2) / 3;
    arcs.add(arc);
  }
  g.add(arcs);
  g.userData.arcs = arcs;

  const core = new THREE.Mesh(GEO.sphere, MAT.bossCore);
  core.scale.setScalar(20);
  core.position.set(-55, 0, 26);
  g.add(core);
  g.userData.core = core;

  const light = new THREE.PointLight(0xff5078, 2600, 520);
  light.position.set(0, 0, 80);
  g.add(light);

  return g;
}

function buildBullet(b) {
  const g = new THREE.Group();
  if (b.kind === 'beam') {
    const core = new THREE.Mesh(GEO.box, MAT.beam);
    core.scale.set(b.w, b.h * 1.5, b.h * 1.5);
    g.add(core);
    const aura = new THREE.Mesh(GEO.box, MAT.beamAura);
    aura.scale.set(b.w + 16, b.h * 1.5 + 10, b.h * 1.5 + 10);
    g.add(aura);
  } else if (b.kind === 'option') {
    const core = new THREE.Mesh(GEO.sphere, MAT.optShot);
    core.scale.setScalar(6);
    g.add(core);
  } else {
    const core = new THREE.Mesh(GEO.box, MAT.shot);
    core.scale.set(18, 5, 5);
    g.add(core);
  }
  return g;
}

function buildEnemyBullet(b) {
  const g = new THREE.Group();
  const glow = new THREE.Mesh(GEO.sphere, MAT.ebullet);
  glow.scale.setScalar(b.r + 2.5);
  g.add(glow);
  const core = new THREE.Mesh(GEO.sphere, MAT.ebulletCore);
  core.scale.setScalar(b.r * 0.6);
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
    this.scene.fog = new THREE.Fog(0x05070f, 750, 1500);

    this.camera = new THREE.PerspectiveCamera(FOV, W / H, 1, 3000);
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
    this._initParticles();
  }

  // call after loadModels(); scenery needs the rock prototypes
  initScenery() {
    this._initPlanet();
    this._initTerrain();
    this._initDrifters();
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

  // ------------------------------------------------------------- scenery

  _initPlanet() {
    const planet = new THREE.Mesh(GEO.planet, MAT.planet);
    planet.scale.setScalar(270);
    planet.position.set(400, 270, -800);
    this.scene.add(planet);
    this._planet = planet;

    const glow = new THREE.Mesh(GEO.planet, MAT.planetGlow);
    glow.scale.setScalar(286);
    glow.position.copy(planet.position);
    this.scene.add(glow);
  }

  _rockName() {
    const r = Math.random();
    if (r < 0.30) return 'meteor';
    if (r < 0.55) return 'meteor2';
    if (r < 0.75) return 'rockA';
    if (r < 0.92) return 'rockB';
    return 'crystals';
  }

  _initTerrain() {
    // rows of CC0 rock/meteor models scrolling along both edges;
    // front row rides the gameplay scroll, back row adds parallax
    this._terrain = [];
    const rows = [
      { z: -14, speed: 120, seg: 72, hMin: 30, hMax: 58 },
      { z: -130, speed: 60, seg: 100, hMin: 55, hMax: 115 },
    ];
    for (const row of rows) {
      for (const top of [true, false]) {
        const n = Math.ceil(W / row.seg) + 3;
        const items = [];
        for (let i = 0; i < n; i++) {
          const rock = spawn(this._rockName());
          rock.rotation.y = Math.random() * Math.PI * 2;
          this.scene.add(rock);
          items.push({
            rock,
            x: -W / 2 + (i - 1) * row.seg + Math.random() * row.seg * 0.4,
            h: row.hMin + Math.random() * (row.hMax - row.hMin),
          });
        }
        this._terrain.push({ items, top, ...row });
      }
    }

    // solid wall strips hiding the rock bases
    for (const top of [true, false]) {
      for (const z of [-14, -130]) {
        const wall = new THREE.Mesh(GEO.box, MAT.wall);
        wall.scale.set(W + 260, 16, 170);
        wall.position.set(0, (top ? 1 : -1) * (H / 2 + 4), z - 40);
        this.scene.add(wall);
      }
    }
  }

  _scrollTerrain(dt) {
    for (const row of this._terrain) {
      const edge = row.top ? H / 2 : -H / 2;
      const dir = row.top ? -1 : 1;
      for (const it of row.items) {
        it.x -= row.speed * dt;
        if (it.x < -W / 2 - row.seg * 1.5) {
          it.x += row.items.length * row.seg;
          it.h = row.hMin + Math.random() * (row.hMax - row.hMin);
          it.rock.rotation.y = Math.random() * Math.PI * 2;
        }
        // embed the rock base into the edge wall
        it.rock.position.set(it.x, edge + dir * it.h * 0.3, row.z);
        it.rock.scale.setScalar(it.h);
      }
    }
  }

  _initDrifters() {
    // loose meteors tumbling by at mid depth, pure decoration
    this._drifters = [];
    for (let i = 0; i < 6; i++) {
      const rock = spawn(Math.random() < 0.5 ? 'meteor' : 'meteor2');
      const s = 18 + Math.random() * 34;
      rock.scale.setScalar(s);
      rock.position.set(
        (Math.random() - 0.5) * W * 1.4,
        (Math.random() - 0.5) * H * 0.8,
        -180 - Math.random() * 160,
      );
      this.scene.add(rock);
      this._drifters.push({
        rock,
        speed: 18 + Math.random() * 30,
        spinX: (Math.random() - 0.5) * 0.8,
        spinY: (Math.random() - 0.5) * 0.8,
      });
    }
  }

  _scrollDrifters(dt) {
    for (const d of this._drifters) {
      const r = d.rock;
      r.position.x -= d.speed * dt;
      r.rotation.x += d.spinX * dt;
      r.rotation.y += d.spinY * dt;
      if (r.position.x < -W * 0.8) {
        r.position.x = W * 0.8;
        r.position.y = (Math.random() - 0.5) * H * 0.8;
      }
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
      size: 7, sizeAttenuation: true, vertexColors: true,
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
      const r = 5 + p.chargeRatio * 14 + Math.sin(p.time * 30) * 2;
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
        o.userData.hull.rotation.x = Math.sin(e.t * 0.7) * 0.15;
        setFlash(o.userData.hull, e.hitFlash > 0);
        o.userData.arcs.rotation.z = -e.t * 1.6;
        const pulse = 1 + Math.sin(e.t * 6) * 0.18;
        o.userData.core.scale.setScalar(20 * pulse);
        o.userData.core.material = e.hitFlash > 0 ? MAT.flash : MAT.bossCore;
      } else if (e instanceof Straight) {
        o = this._obj(e, () => spawn('straight'));
        o.rotation.z = Math.sin(e.t * 3) * 0.12;
      } else if (e instanceof Sine) {
        o = this._obj(e, () => spawn('sine'));
        // bank along the sine path
        o.rotation.x = Math.cos(e.t * e.freq) * 0.5;
      } else if (e instanceof Dart) {
        o = this._obj(e, () => spawn('dart'));
        // face travel direction (logical y-down → negate for world)
        o.rotation.z = -Math.atan2(e.vy, e.vx || -1) + Math.PI;
        setFlash(o, e.phase === 'aim' && Math.floor(e.t * 12) % 2 === 0);
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

  _syncOptions(game) {
    if (!game.options) return;

    for (const c of game.options.capsules) {
      const o = this._obj(c, () => {
        const g = new THREE.Group();
        const outer = new THREE.Mesh(GEO.sphere, MAT.optCapsule);
        outer.scale.setScalar(11);
        g.add(outer);
        const inner = new THREE.Mesh(GEO.sphere, MAT.flash);
        inner.scale.setScalar(4);
        g.add(inner);
        g.add(new THREE.PointLight(0xb59ae0, 500, 140));
        return g;
      });
      o.position.set(wx(c.x), wy(c.y), 0);
      o.rotation.y = c.t * 2.5;
      o.rotation.z = c.t * 1.2;
    }

    for (const u of game.options.units) {
      const o = this._obj(u, () => {
        const g = new THREE.Group();
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(13, 2.5, 8, 24),
          MAT.optUnit,
        );
        ring.userData.origMat = MAT.optUnit;
        g.add(ring);
        const core = new THREE.Mesh(GEO.sphere, MAT.optShot);
        core.scale.setScalar(6);
        core.userData.origMat = MAT.optShot;
        g.add(core);
        g.userData.ring = ring;
        g.add(new THREE.PointLight(0x9060ff, 700, 180));
        return g;
      });
      o.position.set(wx(u.x), wy(u.y), 10);
      o.userData.ring.rotation.z = this.time * 3 + u.index * Math.PI / 1.5;
      o.userData.ring.rotation.x = Math.sin(this.time * 2 + u.index) * 0.4;
      // flash white when hit
      if (u.hitFlash > 0) {
        o.traverse((n) => { if (n.isMesh) n.material = MAT.flash; });
      } else {
        o.traverse((n) => {
          if (n.isMesh && n.userData.origMat) n.material = n.userData.origMat;
        });
      }
    }
  }

  // ----------------------------------------------------------------- frame

  update(dt, game) {
    this.time += dt;
    this._scrollStars(dt);
    this._scrollTerrain(dt);
    this._scrollDrifters(dt);
    this._planet.rotation.y += dt * 0.02;

    this._live.clear();
    if (game.state !== STATE.TITLE) {
      this._syncPlayer(game);
      this._syncEnemies(game);
      this._syncBullets(game);
      this._syncOptions(game);
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
