import * as THREE from 'three';

const MAX = 160;
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

export class Particles {
  constructor(scene, game) {
    this.game = game;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.13, 0.13, 0.13),
      new THREE.MeshBasicMaterial(),
      MAX
    );
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.slots = [];
    for (let i = 0; i < MAX; i++) {
      this.slots.push({ life: 0, max: 1, size: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3() });
      this.mesh.setColorAt(i, new THREE.Color(0xffffff));
      _s.setScalar(0);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceColor.needsUpdate = true;
    this.cursor = 0;
  }

  emit(x, y, z, color, count, opts = {}) {
    const spread = opts.spread ?? 1.6;
    const up = opts.up ?? 2.2;
    const life = opts.life ?? 0.7;
    const size = opts.size ?? 1;
    for (let i = 0; i < count; i++) {
      const s = this.slots[this.cursor];
      s.life = s.max = life * (0.7 + Math.random() * 0.6);
      s.size = size * (0.6 + Math.random() * 0.8);
      s.pos.set(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4);
      s.vel.set(
        (Math.random() - 0.5) * spread,
        Math.random() * up,
        (Math.random() - 0.5) * spread + (opts.back ?? 2.5)
      );
      this.mesh.setColorAt(this.cursor, color);
      this.cursor = (this.cursor + 1) % MAX;
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  /** Dust puff at the hooves, tinted by the current biome. */
  dust(x, y, z, count) {
    this.emit(x, y, z, this.game.biomes.palette.dust, count, { spread: 1.2, up: 1.4, life: 0.55 });
  }

  sparkle(pos) {
    this.emit(pos.x, pos.y, pos.z, new THREE.Color(0xffd24a), 8, { spread: 2.4, up: 2.6, life: 0.5, size: 0.8, back: 1 });
  }

  burst(x, y, z) {
    this.emit(x, y, z, this.game.biomes.palette.dust, 34, { spread: 4.5, up: 4.2, life: 1.1, size: 1.6, back: 3 });
  }

  update(dt, ds) {
    for (let i = 0; i < MAX; i++) {
      const s = this.slots[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      s.vel.y -= 5.5 * dt;
      s.pos.addScaledVector(s.vel, dt);
      s.pos.z += ds * 0.6;
      if (s.pos.y < 0.02) { s.pos.y = 0.02; s.vel.y = 0; }
      const k = Math.max(0, s.life / s.max);
      _p.copy(s.pos);
      _s.setScalar(s.size * k);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
