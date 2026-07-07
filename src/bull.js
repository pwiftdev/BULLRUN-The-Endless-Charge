import * as THREE from 'three';
import { voxGeo, VOXMAT } from './models.js';

export const LANE_X = 2.2;
const U = 0.16; // voxel unit → metres
const GRAVITY = 24;
const JUMP_V = 9.2;
const SLIDE_TIME = 0.68;

const B = 0x8a4a2c, BD = 0x6f3a22, BL = 0x9c5834, HORN = 0xf2e6c8,
  HOOF = 0x3a2a1e, SN = 0xb97f5a, DARK = 0x241610, GOLD = 0xf5c542, MANE = 0x5c2f1a;

// The bull faces -z (the direction of the charge).
const BODY_VOX = [
  { x: 0, y: 4.5, z: 2.0, sx: 3.2, sy: 2.7, sz: 2.4, c: BD },      // hips
  { x: 0, y: 4.7, z: 0.2, sx: 3.8, sy: 3.1, sz: 2.6, c: B },       // barrel
  { x: 0, y: 5.0, z: -1.9, sx: 4.2, sy: 3.6, sz: 2.4, c: B },      // chest
  { x: 0, y: 3.6, z: -2.0, sx: 3.0, sy: 0.9, sz: 1.6, c: BL },     // brisket
  { x: 0, y: 7.0, z: -1.9, sx: 3.0, sy: 1.1, sz: 2.0, c: MANE },   // hump
  { x: 0, y: 5.9, z: -3.3, sx: 2.6, sy: 2.7, sz: 1.4, c: B },      // neck
  { x: 0, y: 6.2, z: -4.5, sx: 2.3, sy: 2.2, sz: 1.6, c: BL },     // head
  { x: 0, y: 5.6, z: -5.6, sx: 1.7, sy: 1.4, sz: 0.9, c: SN },     // snout
  { x: 0, y: 5.15, z: -6.05, sx: 0.55, sy: 0.8, sz: 0.25, c: GOLD }, // nose ring
  { x: -1.55, y: 7.1, z: -4.5, sx: 1.2, sy: 0.5, sz: 0.5, c: HORN },
  { x: 1.55, y: 7.1, z: -4.5, sx: 1.2, sy: 0.5, sz: 0.5, c: HORN },
  { x: -2.25, y: 7.6, z: -4.5, sx: 0.5, sy: 1.1, sz: 0.5, c: HORN },
  { x: 2.25, y: 7.6, z: -4.5, sx: 0.5, sy: 1.1, sz: 0.5, c: HORN },
  { x: -1.35, y: 6.05, z: -4.2, sx: 0.5, sy: 0.4, sz: 0.4, c: BD }, // ears
  { x: 1.35, y: 6.05, z: -4.2, sx: 0.5, sy: 0.4, sz: 0.4, c: BD },
  { x: -0.75, y: 6.55, z: -5.33, sx: 0.36, sy: 0.5, sz: 0.16, c: DARK }, // eyes
  { x: 0.75, y: 6.55, z: -5.33, sx: 0.36, sy: 0.5, sz: 0.16, c: DARK },
  { x: 0, y: 5.4, z: 3.4, sx: 0.5, sy: 0.5, sz: 1.5, c: BD },      // tail
  { x: 0, y: 4.6, z: 4.15, sx: 0.7, sy: 1.1, sz: 0.5, c: MANE },   // tail tuft
  // coat patches + blaze — voxel-painted markings
  { x: -1.63, y: 4.7, z: 1.8, sx: 0.12, sy: 1.5, sz: 1.6, c: BD },
  { x: 1.93, y: 5.2, z: 0.1, sx: 0.12, sy: 1.6, sz: 1.5, c: BL },
  { x: -2.13, y: 5.4, z: -1.7, sx: 0.12, sy: 1.7, sz: 1.4, c: BD },
  { x: 0, y: 6.95, z: -5.32, sx: 0.7, sy: 0.65, sz: 0.14, c: 0xd9c4a8 }, // blaze
  // red bandana around the neck
  { x: 0, y: 5.1, z: -3.3, sx: 2.85, sy: 0.75, sz: 1.65, c: 0xc23b2e },
  { x: 0, y: 5.55, z: -2.85, sx: 0.7, sy: 0.5, sz: 0.5, c: 0xa22f24 }, // knot
];

const LEG_VOX = [
  { x: 0, y: -0.9, z: 0, sx: 1.15, sy: 2.0, sz: 1.25, c: B },
  { x: 0, y: -2.45, z: 0, sx: 0.85, sy: 1.3, sz: 0.95, c: BD },
  { x: 0, y: -3.35, z: 0, sx: 0.95, sy: 0.55, sz: 1.05, c: HOOF },
];

function legMesh() {
  const m = new THREE.Mesh(voxGeo(LEG_VOX, 0.04), VOXMAT);
  m.castShadow = true;
  return m;
}

export class Bull {
  constructor(scene, game) {
    this.game = game;

    this.root = new THREE.Group();       // world position (lane x, jump y)
    this.bodyG = new THREE.Group();      // gallop bob / pitch / slide squash
    this.model = new THREE.Group();      // voxel-space container, scaled to metres
    this.model.scale.setScalar(U);
    this.bodyG.add(this.model);
    this.root.add(this.bodyG);

    const body = new THREE.Mesh(voxGeo(BODY_VOX, 0.05), VOXMAT);
    body.castShadow = true;
    this.model.add(body);

    // Bandana tails, pivoted at the knot so they can flutter in the wind.
    this.bandanas = [];
    for (const [ox, oz, tint] of [[0.32, -2.8, 0xc23b2e], [-0.28, -2.75, 0xb03528]]) {
      const strip = new THREE.Mesh(
        voxGeo([{ y: -0.8, sx: 0.55, sy: 1.6, sz: 0.16, c: tint }], 0),
        VOXMAT
      );
      strip.castShadow = true;
      const pivot = new THREE.Group();
      pivot.position.set(ox, 5.6, oz);
      pivot.rotation.x = -0.5;
      pivot.add(strip);
      this.model.add(pivot);
      this.bandanas.push(pivot);
    }
    this.breathT = 0;

    // Legs pivot at the hip so rotation.x swings them.
    this.legs = [];
    const hips = [
      [-1.25, 3.6, -1.95], [1.25, 3.6, -1.95], // front L/R
      [-1.2, 3.5, 2.0], [1.2, 3.5, 2.0],       // back  L/R
    ];
    for (const [hx, hy, hz] of hips) {
      const pivot = new THREE.Group();
      pivot.position.set(hx, hy, hz);
      pivot.add(legMesh());
      this.model.add(pivot);
      this.legs.push(pivot);
    }

    scene.add(this.root);

    // Collision box (half extents); height shrinks while sliding.
    this.halfW = 0.48;
    this.halfD = 0.62;

    this.phase = 0;
    this.beatAcc = 0;
    this.reset();
  }

  reset() {
    this.lane = 0;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.slideT = 0;
    this.dead = false;
    this.deadT = 0;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.bodyG.rotation.set(0, 0, 0);
    this.bodyG.scale.set(1, 1, 1);
    this.bodyG.position.set(0, 0, 0);
  }

  get grounded() { return this.y <= 0.0001 && this.vy <= 0; }
  get sliding() { return this.slideT > 0; }
  get hitHeight() { return this.sliding ? 0.72 : 1.38; }

  moveLane(dir) {
    if (this.dead) return;
    const next = Math.min(1, Math.max(-1, this.lane + dir));
    if (next !== this.lane) {
      this.lane = next;
      this.game.audio.swish();
    }
  }

  jump() {
    if (this.dead) return;
    if (this.grounded) {
      this.vy = JUMP_V;
      this.y = 0.001;
      this.slideT = 0;
      this.game.audio.jump();
      this.game.particles.dust(this.x, 0.1, 0.8, 6);
    }
  }

  slide() {
    if (this.dead) return;
    this.slideT = SLIDE_TIME;
    if (!this.grounded) this.vy = Math.min(this.vy, -13); // slam down
    else this.game.audio.slideFx();
  }

  die() {
    this.dead = true;
    this.deadT = 0;
  }

  update(dt, speed, running) {
    if (this.dead) {
      // Tumble forward and settle.
      this.deadT += dt;
      this.root.rotation.x = Math.max(-1.35, this.root.rotation.x - dt * 5);
      this.y = Math.max(0, this.y - dt * 6);
      this.root.position.y = this.y + Math.max(0, 0.35 - this.deadT * 0.6);
      return;
    }

    // Lane easing with a lean into the turn.
    const targetX = this.lane * LANE_X;
    this.x += (targetX - this.x) * Math.min(1, dt * 9);
    const dx = targetX - this.x;
    this.root.rotation.z = -dx * 0.16;
    this.root.rotation.y = -dx * 0.10;

    // Jump physics.
    if (!this.grounded || this.vy > 0) {
      this.y += this.vy * dt;
      this.vy -= GRAVITY * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        if (running) {
          this.game.particles.dust(this.x, 0.1, 0.8, 8);
          this.game.audio.thud(0.9);
        }
      }
    }

    // Slide timer + squash.
    if (this.slideT > 0) this.slideT -= dt;
    const squash = this.sliding ? 0.55 : 1;
    this.bodyG.scale.y += (squash - this.bodyG.scale.y) * Math.min(1, dt * 12);
    const slidePitch = this.sliding ? 0.32 : 0;

    // Gallop cycle.
    const freq = 1.2 + speed * 0.1;
    this.phase += dt * Math.PI * 2 * freq;
    const t = this.phase;
    const airborne = this.y > 0.02;

    // Bandana tails streaming in the wind.
    const wind = 0.35 + speed * 0.012;
    this.bandanas[0].rotation.x = -0.5 - wind + Math.sin(t * 1.9) * 0.24;
    this.bandanas[0].rotation.z = Math.sin(t * 1.4) * 0.2;
    this.bandanas[1].rotation.x = -0.5 - wind + Math.sin(t * 1.9 + 1.4) * 0.24;
    this.bandanas[1].rotation.z = Math.sin(t * 1.4 + 2.1) * 0.2;

    // Frosty breath puffs under starlit skies.
    const pal = this.game.biomes.palette;
    if (pal.starAlpha > 0.5) {
      this.breathT += dt;
      if (this.breathT > 1.25) {
        this.breathT = 0;
        this.game.particles.emit(
          this.x, this.y + 0.88, -1.05,
          new THREE.Color(0xd8e4f5), 3,
          { spread: 0.5, up: 0.35, life: 0.8, size: 0.55, back: 0.4 }
        );
      }
    }

    if (airborne) {
      // Tuck in the air.
      const k = Math.min(1, dt * 10);
      this.legs[0].rotation.x += (-1.0 - this.legs[0].rotation.x) * k;
      this.legs[1].rotation.x += (-1.0 - this.legs[1].rotation.x) * k;
      this.legs[2].rotation.x += (0.9 - this.legs[2].rotation.x) * k;
      this.legs[3].rotation.x += (0.9 - this.legs[3].rotation.x) * k;
      this.bodyG.rotation.x = -this.vy * 0.03 + slidePitch;
      this.bodyG.position.y = 0;
    } else {
      const amp = 0.9;
      this.legs[0].rotation.x = Math.sin(t) * amp;
      this.legs[1].rotation.x = Math.sin(t + 0.35) * amp;
      this.legs[2].rotation.x = Math.sin(t + Math.PI) * amp;
      this.legs[3].rotation.x = Math.sin(t + Math.PI + 0.35) * amp;
      this.bodyG.position.y = Math.abs(Math.sin(t)) * 0.09;
      this.bodyG.rotation.x = Math.sin(t + 0.7) * 0.05 + slidePitch;

      // Hoofbeats → dust + thuds.
      this.beatAcc += dt * Math.PI * 2 * freq;
      if (this.beatAcc > Math.PI) {
        this.beatAcc -= Math.PI;
        if (running && speed > 5) {
          this.game.particles.dust(this.x + (Math.random() - 0.5) * 0.5, 0.08, 0.9, 3);
          this.game.audio.thud(0.45 + Math.random() * 0.15);
        }
      }
    }

    this.root.position.set(this.x, this.y, 0);
  }
}
