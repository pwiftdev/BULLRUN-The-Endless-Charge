import * as THREE from 'three';
import { DECOR_SETS, voxGeo } from './models.js';

export const ROAD_W = 8.4;
const CHUNK_LEN = 150;
const SPAWN_Z = -190;
const KILL_Z = 26;

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/* A chunk carries the small scrolling detail — grass tufts, flowers,
   pebbles, trail marks — and rebuilds itself in the current biome's
   colors every time it leapfrogs back to the horizon. */
class Chunk {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.tuftGeo = new THREE.BoxGeometry(0.16, 1, 0.16);
    this.tuftGeo.translate(0, 0.5, 0);
    this.markGeo = new THREE.BoxGeometry(1, 0.03, 1);
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.meshes = [];
  }

  addInstanced(geo, count, fill) {
    const mesh = new THREE.InstancedMesh(geo, this.mat, count);
    for (let i = 0; i < count; i++) {
      fill(i);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
    this.meshes.push(mesh);
  }

  build(palette) {
    for (const m of this.meshes) {
      this.group.remove(m);
      m.dispose();
    }
    this.meshes = [];

    // Grass / scrub tufts on both sides of the trail.
    this.addInstanced(this.tuftGeo, 240, () => {
      const side = Math.random() < 0.5 ? -1 : 1;
      _p.set(side * rnd(ROAD_W / 2 + 0.6, 46), 0, rnd(-CHUNK_LEN / 2, CHUNK_LEN / 2));
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd(0, Math.PI));
      _s.set(rnd(0.7, 1.7), rnd(0.3, 0.95), rnd(0.7, 1.7));
      _c.set(pick(palette.tufts));
      _c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.06);
    });

    // Wildflowers / glow-moss dotted through the grass.
    if (palette.flowers && palette.flowers.length) {
      this.addInstanced(this.tuftGeo, 36, () => {
        const side = Math.random() < 0.5 ? -1 : 1;
        _p.set(side * rnd(ROAD_W / 2 + 0.8, 30), 0, rnd(-CHUNK_LEN / 2, CHUNK_LEN / 2));
        _q.identity();
        const s = rnd(0.5, 0.9);
        _s.set(s, rnd(0.14, 0.3), s);
        _c.set(pick(palette.flowers));
        _c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
      });
    }

    // Hoof-worn marks on the trail for speed perception.
    const dark = palette.road.clone().multiplyScalar(0.82);
    this.addInstanced(this.markGeo, 42, () => {
      _p.set(rnd(-3.7, 3.7), 0.015, rnd(-CHUNK_LEN / 2, CHUNK_LEN / 2));
      _q.identity();
      _s.set(rnd(0.5, 1.6), 1, rnd(0.25, 0.6));
      _c.copy(dark).offsetHSL(0, 0, (Math.random() - 0.5) * 0.04);
    });

    // Pebbles along the trail edges.
    const edge = palette.roadEdge.clone().offsetHSL(0, 0, 0.05);
    this.addInstanced(this.tuftGeo, 50, () => {
      const side = Math.random() < 0.5 ? -1 : 1;
      _p.set(side * rnd(ROAD_W / 2 - 0.3, ROAD_W / 2 + 1.6), 0, rnd(-CHUNK_LEN / 2, CHUNK_LEN / 2));
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd(0, Math.PI));
      const s = rnd(0.6, 1.8);
      _s.set(s, rnd(0.12, 0.3), s);
      _c.copy(edge).offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
    });
  }
}

/* Distant ranges scroll at a fraction of world speed for parallax depth.
   Built in grayscale vertex colors so one tinted material recolors the
   whole range as the biome shifts. */
function mountainGeometry() {
  const layers = 4 + Math.floor(Math.random() * 2);
  const vox = [];
  let w = rnd(22, 30);
  let d = rnd(14, 20);
  let y = 0;
  for (let i = 0; i < layers; i++) {
    const h = rnd(5.5, 8);
    const shade = 0.5 + (i / layers) * 0.4;
    const g = Math.round(shade * 255);
    vox.push({
      x: rnd(-1.5, 1.5), y: y + h / 2, z: rnd(-1, 1),
      sx: w, sy: h, sz: d,
      c: (g << 16) | (g << 8) | g,
    });
    y += h * rnd(0.75, 0.95);
    w *= rnd(0.6, 0.75);
    d *= rnd(0.6, 0.75);
  }
  // bright cap
  vox.push({ y: y + 2.2, sx: w * 0.9, sy: 4.5, sz: d * 0.9, c: 0xf2f2f2 });
  return voxGeo(vox, 0.03);
}

const MOUNTAIN_BAND = 240;
const MOUNTAIN_PARALLAX = 0.35;

export class World {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;

    // Infinite ground + trail (colors lerped per-frame with the biome).
    this.groundMat = new THREE.MeshLambertMaterial({ color: 0x7fb554 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.06, -200);
    ground.receiveShadow = true;
    scene.add(ground);

    this.roadMat = new THREE.MeshLambertMaterial({ color: 0xb18a55 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 700), this.roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -200);
    road.receiveShadow = true;
    scene.add(road);

    this.edgeMat = new THREE.MeshLambertMaterial({ color: 0x8f6f42 });
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 700), this.edgeMat);
      edge.position.set(side * (ROAD_W / 2 + 0.1), 0.02, -200);
      edge.receiveShadow = true;
      scene.add(edge);
    }

    // Old wagon ruts worn into the trail.
    this.rutMat = new THREE.MeshLambertMaterial({ color: 0x9a7847 });
    for (const x of [-1.1, 1.1]) {
      const rut = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 700), this.rutMat);
      rut.rotation.x = -Math.PI / 2;
      rut.position.set(x, 0.006, -200);
      scene.add(rut);
    }

    // Distant parallax ranges.
    this.mountainMat = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x7d9b8c });
    this.mountains = [];
    const variants = [mountainGeometry(), mountainGeometry(), mountainGeometry()];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(pick(variants), this.mountainMat);
      const side = i % 2 === 0 ? -1 : 1;
      m.position.set(side * rnd(48, 115), 0, -200 + (i / 14) * MOUNTAIN_BAND + rnd(-8, 8));
      m.scale.set(rnd(1, 2.4), rnd(0.7, 1.5), rnd(1, 1.8));
      this.mountains.push(m);
      scene.add(m);
    }

    // Two leapfrogging detail chunks.
    this.chunks = [new Chunk(scene), new Chunk(scene)];
    this.chunks[0].group.position.z = -CHUNK_LEN / 2 + 20;
    this.chunks[1].group.position.z = -CHUNK_LEN / 2 + 20 - CHUNK_LEN;

    // Large decor, pooled by type.
    this.decorPool = new Map();
    this.decorActive = [];
    this.decorRoot = new THREE.Group();
    scene.add(this.decorRoot);
    this.cursor = 0;

    this.refresh();
  }

  obtainDecor(builderList) {
    const builder = pick(builderList);
    const key = builder.name;
    const pool = this.decorPool.get(key) || [];
    let item = pool.pop();
    if (!item) {
      item = builder();
      item.type = key;
      this.decorRoot.add(item.group);
    }
    this.decorPool.set(key, pool);
    item.group.visible = true;
    return item;
  }

  releaseDecor(item) {
    item.group.visible = false;
    this.decorPool.get(item.type).push(item);
  }

  placeDecor(item, z) {
    const side = Math.random() < 0.5 ? -1 : 1;
    let x;
    if (item.roadside) {
      x = side * (ROAD_W / 2 + rnd(0.7, 1.4));
    } else {
      const big = item.type === 'mesa' || item.type === 'barn';
      x = side * (big ? rnd(16, 55) : rnd(ROAD_W / 2 + 2.5, 46));
    }
    item.group.position.set(x, 0, z);
    this.decorActive.push(item);
  }

  spawnDecorGroup(z = SPAWN_Z) {
    const set = DECOR_SETS[this.game.biomes.spawnIndex];
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      this.placeDecor(this.obtainDecor(set), z - rnd(0, 12));
    }
  }

  update(dt, ds) {
    // Scroll + leapfrog chunks.
    for (const chunk of this.chunks) {
      chunk.group.position.z += ds;
      if (chunk.group.position.z - CHUNK_LEN / 2 > KILL_Z) {
        chunk.group.position.z -= CHUNK_LEN * 2;
        chunk.build(this.game.biomes.palette);
      }
    }

    // Distant ranges drift slowly — parallax.
    for (const m of this.mountains) {
      m.position.z += ds * MOUNTAIN_PARALLAX;
      if (m.position.z > 45) {
        m.position.z -= MOUNTAIN_BAND;
        const side = Math.random() < 0.5 ? -1 : 1;
        m.position.x = side * rnd(48, 115);
        m.scale.set(rnd(1, 2.4), rnd(0.7, 1.5), rnd(1, 1.8));
      }
    }

    // Spawn decor by distance travelled.
    this.cursor -= ds;
    while (this.cursor <= 0) {
      this.spawnDecorGroup();
      this.cursor += rnd(7, 15);
    }

    // Scroll decor, run behaviors, recycle.
    for (let i = this.decorActive.length - 1; i >= 0; i--) {
      const item = this.decorActive[i];
      item.group.position.z += ds;
      if (item.tick) item.tick(dt);
      if (item.group.position.z > KILL_Z || Math.abs(item.group.position.x) > 70) {
        this.decorActive.splice(i, 1);
        this.releaseDecor(item);
      }
    }
  }

  applyPalette(p) {
    this.groundMat.color.copy(p.ground);
    this.roadMat.color.copy(p.road);
    this.edgeMat.color.copy(p.roadEdge);
    this.rutMat.color.copy(p.road).multiplyScalar(0.84);
    this.mountainMat.color.copy(p.mountain);
  }

  refresh() {
    for (const item of this.decorActive) this.releaseDecor(item);
    this.decorActive = [];
    this.cursor = 0;
    // Pre-scatter decor along the whole visible stretch so a fresh run
    // doesn't start on an empty plain.
    const set = DECOR_SETS[this.game.biomes.spawnIndex];
    for (let z = -20; z > SPAWN_Z; z -= rnd(7, 15)) {
      const n = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        this.placeDecor(this.obtainDecor(set), z);
      }
    }
    for (const chunk of this.chunks) chunk.build(this.game.biomes.palette);
  }
}
