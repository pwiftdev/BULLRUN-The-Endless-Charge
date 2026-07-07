import * as THREE from 'three';
import { OBSTACLE_BUILDERS, OBSTACLE_SETS, buildCoin } from './models.js';
import { LANE_X } from './bull.js';

const SPAWN_Z = -190;
const KILL_Z = 18;

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Obstacles {
  constructor(scene, game) {
    this.game = game;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.pool = new Map(); // type name → recycled instances
    this.active = [];

    this.coinPool = [];
    this.coins = [];
    this.coinRoot = new THREE.Group();
    scene.add(this.coinRoot);

    this.cursor = 30; // metres until first pattern
    this.coinSpin = 0;
  }

  /* ---------- pooling ---------- */

  obtain(type) {
    const pool = this.pool.get(type) || [];
    let item = pool.pop();
    if (!item) {
      item = OBSTACLE_BUILDERS[type]();
      item.type = type;
      this.root.add(item.group);
    }
    this.pool.set(type, pool);
    item.group.visible = true;
    return item;
  }

  release(item) {
    item.group.visible = false;
    this.pool.get(item.type).push(item);
  }

  place(type, lane, z) {
    const item = this.obtain(type);
    item.group.position.set(lane * LANE_X, 0, z);
    item.x = lane * LANE_X;
    this.active.push(item);
    return item;
  }

  obtainCoin() {
    let m = this.coinPool.pop();
    if (!m) {
      m = buildCoin();
      this.coinRoot.add(m);
    }
    m.visible = true;
    return m;
  }

  coinLine(lane, z, n, y = 1.0) {
    for (let i = 0; i < n; i++) {
      const m = this.obtainCoin();
      m.position.set(lane * LANE_X, y, z - i * 1.5);
      this.coins.push(m);
    }
  }

  coinArc(lane, z, n = 7) {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const m = this.obtainCoin();
      m.position.set(lane * LANE_X, 0.9 + Math.sin(t * Math.PI) * 1.35, z + 4.2 - t * 8.4);
      this.coins.push(m);
    }
  }

  /* ---------- spawning ---------- */

  pickLanes(n) {
    const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
    return lanes.slice(0, n);
  }

  spawnPattern() {
    const set = OBSTACLE_SETS[this.game.biomes.spawnIndex];
    const z = SPAWN_Z;
    const r = Math.random();

    if (r < 0.26) {
      // Hurdles in one or two lanes.
      const lanes = this.pickLanes(Math.random() < 0.45 ? 2 : 1);
      for (const lane of lanes) this.place(pick(set.jump), lane, z);
      const free = [-1, 0, 1].filter((l) => !lanes.includes(l));
      if (Math.random() < 0.6) this.coinLine(pick(free), z + 3, 5);
    } else if (r < 0.44) {
      // Full-width fence — must jump. Coins arc over it.
      this.place(set.wide, 0, z);
      if (Math.random() < 0.75) this.coinArc(pick([-1, 0, 1]), z);
    } else if (r < 0.58) {
      // Overhead gate — must slide. A low coin trail threads beneath.
      this.place(pick(set.over), 0, z);
      if (Math.random() < 0.6) this.coinLine(pick([-1, 0, 1]), z + 2, 4, 0.55);
    } else if (r < 0.88) {
      // Blockers in one or two lanes — weave through.
      const lanes = this.pickLanes(Math.random() < 0.5 ? 2 : 1);
      for (const lane of lanes) this.place(pick(set.full), lane, z);
      const free = [-1, 0, 1].filter((l) => !lanes.includes(l));
      if (Math.random() < 0.65) this.coinLine(pick(free), z + 3, 6);
    } else {
      // Chicane — two staggered blockers force an S-curve.
      const [a, b] = this.pickLanes(2);
      this.place(pick(set.full), a, z);
      this.place(pick(set.full), b, z - 11);
      const free = [-1, 0, 1].filter((l) => l !== a)[0];
      if (Math.random() < 0.5) this.coinLine(free, z + 2, 4);
    }
  }

  /* ---------- per-frame ---------- */

  update(dt, ds) {
    const { speed, distance } = this.game;

    // Distance-based spawn cadence: gaps tighten as the run gets long.
    this.cursor -= ds;
    if (this.cursor <= 0) {
      this.spawnPattern();
      const difficulty = Math.max(0.68, 1 - distance / 5200);
      const gap = Math.min(Math.max(speed * 1.05, 14), 34);
      this.cursor = gap * rnd(0.9, 1.45) * difficulty;
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const item = this.active[i];
      item.group.position.z += ds;
      if (item.tick) item.tick(dt);
      if (item.group.position.z > KILL_Z) {
        this.active.splice(i, 1);
        this.release(item);
      }
    }

    this.coinSpin += dt * 3.2;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.position.z += ds;
      c.rotation.y = this.coinSpin;
      if (c.position.z > KILL_Z) {
        this.coins.splice(i, 1);
        c.visible = false;
        this.coinPool.push(c);
      }
    }
  }

  /** Returns the obstacle hit, or null. Player sits at z = 0. */
  checkCollision(bull) {
    for (const item of this.active) {
      const dz = Math.abs(item.group.position.z);
      if (dz > item.halfD + bull.halfD) continue;
      if (Math.abs(item.x - bull.x) > item.halfW + bull.halfW) continue;

      if (item.kind === 'over') {
        if (bull.y + bull.hitHeight > item.gap + 0.06) return item;
      } else {
        // 'jump' and 'full': clear it if your hooves are above it.
        if (bull.y < item.h - 0.12) return item;
      }
    }
    return null;
  }

  /** Collect coins near the bull; returns number collected this frame. */
  collectCoins(bull) {
    let got = 0;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (Math.abs(c.position.z) > 0.9) continue;
      if (Math.abs(c.position.x - bull.x) > 0.85) continue;
      if (Math.abs(c.position.y - (bull.y + 0.85)) > 1.05) continue;
      this.coins.splice(i, 1);
      this.game.particles.sparkle(c.position);
      c.visible = false;
      this.coinPool.push(c);
      got++;
    }
    return got;
  }

  clear() {
    for (const item of this.active) this.release(item);
    this.active = [];
    for (const c of this.coins) {
      c.visible = false;
      this.coinPool.push(c);
    }
    this.coins = [];
    this.cursor = 30;
  }
}
