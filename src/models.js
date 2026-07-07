import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Shared voxel material — everything uses vertex colors so the whole world
// batches into a handful of materials.
export const VOXMAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.85,
  metalness: 0.05,
});

export const COINMAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.28,
  metalness: 0.65,
  emissive: 0xffcc55,
  emissiveIntensity: 0.4,
});

export function glowMat(color, intensity = 1.2) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.6,
  });
}

const _c = new THREE.Color();

/**
 * Merge a list of colored boxes into one geometry.
 * voxel: { x, y, z, sx, sy, sz, c } — sizes default to 1, position to 0.
 * jitter: subtle per-voxel lightness noise for an organic hand-built feel.
 */
export function voxGeo(voxels, jitter = 0.05) {
  const geos = voxels.map((vx) => {
    const g = new THREE.BoxGeometry(vx.sx ?? 1, vx.sy ?? 1, vx.sz ?? 1);
    g.translate(vx.x ?? 0, vx.y ?? 0, vx.z ?? 0);
    _c.set(vx.c);
    if (jitter) _c.offsetHSL(0, 0, (Math.random() - 0.5) * jitter);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = _c.r;
      arr[i * 3 + 1] = _c.g;
      arr[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  });
  return mergeGeometries(geos);
}

export function voxMesh(voxels, opts = {}) {
  const m = new THREE.Mesh(voxGeo(voxels, opts.jitter ?? 0.05), opts.mat ?? VOXMAT);
  m.castShadow = opts.shadow ?? true;
  m.receiveShadow = false;
  return m;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ================================================================== */
/*  DECOR — scenery items that drift past on both sides of the trail  */
/*  Each builder returns { group, tick? }                             */
/* ================================================================== */

function barn() {
  const R = 0xa63c2e, RD = 0x8c2f24, W = 0xf2e8d8, ROOF = 0x5b4632, DOOR = 0x4a3220;
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 1.6, sx: 5.2, sy: 3.2, sz: 4.2, c: R },
    { y: 3.5, sx: 5.7, sy: 0.7, sz: 4.7, c: ROOF },
    { y: 4.1, sx: 4.2, sy: 0.65, sz: 4.7, c: ROOF },
    { y: 4.68, sx: 2.7, sy: 0.55, sz: 4.7, c: ROOF },
    { y: 5.08, sx: 1.3, sy: 0.35, sz: 4.7, c: RD },
    { z: 2.13, y: 1.25, sx: 1.7, sy: 2.5, sz: 0.14, c: DOOR },
    { z: 2.16, y: 1.25, sx: 0.14, sy: 2.5, sz: 0.1, c: W },
    { z: 2.15, y: 3.05, sx: 1.0, sy: 0.9, sz: 0.1, c: W },
  ]));
  group.rotation.y = rnd(-0.5, 0.5);
  return { group };
}

function windmill() {
  const WOOD = 0x8d8272, WOOD2 = 0x776c5c;
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 1.2, sx: 1.7, sy: 2.4, sz: 1.7, c: WOOD },
    { y: 3.4, sx: 1.3, sy: 2.2, sz: 1.3, c: WOOD2 },
    { y: 5.4, sx: 1.0, sy: 1.8, sz: 1.0, c: WOOD },
    { y: 6.6, sx: 1.5, sy: 0.9, sz: 1.5, c: 0x6b6152 },
  ]));
  const rotor = voxMesh([
    { sx: 0.42, sy: 5.4, sz: 0.16, c: 0xd9cbb0 },
    { sx: 5.4, sy: 0.42, sz: 0.16, c: 0xd9cbb0 },
    { sx: 0.7, sy: 0.7, sz: 0.4, c: 0x5b4632 },
  ]);
  rotor.position.set(0, 6.6, 0.95);
  group.add(rotor);
  const speed = rnd(0.5, 1.1);
  return { group, tick: (dt) => { rotor.rotation.z += dt * speed; } };
}

function tree() {
  const T = 0x6b4a2c, L1 = 0x4e8f3c, L2 = 0x61a44a, L3 = 0x437f34;
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 1.1, sx: 0.7, sy: 2.2, sz: 0.7, c: T },
    { y: 3.1, sx: 2.9, sy: 1.9, sz: 2.9, c: L1 },
    { y: 4.35, sx: 2.0, sy: 1.2, sz: 2.0, c: L2 },
    { x: 1.15, y: 2.8, sx: 1.4, sy: 1.2, sz: 1.4, c: L3 },
    { x: -1.0, y: 3.5, sx: 1.2, sy: 1.0, sz: 1.2, c: L2 },
  ], { jitter: 0.08 }));
  return { group };
}

function wheat() {
  const golds = [0xe2c25a, 0xd4b04a, 0xefd070, 0xc9a53f];
  const vox = [];
  for (let i = 0; i < 34; i++) {
    const h = rnd(0.6, 1.3);
    vox.push({ x: rnd(-2, 2), z: rnd(-2, 2), y: h / 2, sx: 0.22, sy: h, sz: 0.22, c: pick(golds) });
  }
  const m = voxMesh(vox, { jitter: 0.1, shadow: false });
  const group = new THREE.Group();
  group.add(m);
  return { group };
}

function silo() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 2.2, sx: 2.2, sy: 4.4, sz: 2.2, c: 0x9aa7b0 },
    { y: 1.4, sx: 2.35, sy: 0.3, sz: 2.35, c: 0x7e8a92 },
    { y: 2.8, sx: 2.35, sy: 0.3, sz: 2.35, c: 0x7e8a92 },
    { y: 4.7, sx: 1.8, sy: 0.6, sz: 1.8, c: 0x7e8a92 },
    { y: 5.25, sx: 1.15, sy: 0.55, sz: 1.15, c: 0x6d7880 },
  ]));
  return { group };
}

function cow() {
  const W = 0xf5f0e6, B = 0x2b2b2b, P = 0xe8b4a8;
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 0.95, sx: 1.15, sy: 0.9, sz: 1.9, c: W },
    { x: 0.35, y: 1.25, z: 0.35, sx: 0.5, sy: 0.45, sz: 0.7, c: B },
    { x: -0.3, y: 0.8, z: -0.5, sx: 0.5, sy: 0.5, sz: 0.6, c: B },
    { y: 1.25, z: -1.15, sx: 0.65, sy: 0.6, sz: 0.55, c: W },
    { y: 1.05, z: -1.5, sx: 0.45, sy: 0.32, sz: 0.2, c: P },
    { x: 0.45, y: 1.5, z: -1.1, sx: 0.25, sy: 0.18, sz: 0.18, c: W },
    { x: -0.45, y: 1.5, z: -1.1, sx: 0.25, sy: 0.18, sz: 0.18, c: W },
    { x: 0.38, y: 0.28, z: 0.6, sx: 0.26, sy: 0.56, sz: 0.26, c: W },
    { x: -0.38, y: 0.28, z: 0.6, sx: 0.26, sy: 0.56, sz: 0.26, c: W },
    { x: 0.38, y: 0.28, z: -0.6, sx: 0.26, sy: 0.56, sz: 0.26, c: W },
    { x: -0.38, y: 0.28, z: -0.6, sx: 0.26, sy: 0.56, sz: 0.26, c: W },
  ]));
  group.rotation.y = rnd(0, Math.PI * 2);
  return { group };
}

function hayPile() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 0.55, sx: 1.6, sy: 1.1, sz: 1.2, c: 0xd9b44a },
    { x: 0.9, y: 0.45, z: 0.5, sx: 1.2, sy: 0.9, sz: 1.0, c: 0xc9a53f },
    { x: 0.3, y: 1.35, sx: 1.1, sy: 0.6, sz: 0.9, c: 0xe2c25a },
  ]));
  return { group };
}

function mesa() {
  const group = new THREE.Group();
  const s = rnd(0.8, 1.5);
  group.add(voxMesh([
    { y: 0.6, sx: 14, sy: 1.2, sz: 11, c: 0x9c5436 },
    { y: 2.6, sx: 12, sy: 4.2, sz: 9, c: 0xb0603f },
    { y: 5.4, sx: 9.4, sy: 1.6, sz: 7.2, c: 0xc27a4a },
    { y: 6.6, sx: 6.6, sy: 1.1, sz: 5.2, c: 0xd18c55 },
  ], { jitter: 0.06 }));
  group.scale.setScalar(s);
  group.rotation.y = rnd(0, Math.PI * 2);
  return { group };
}

function saguaro() {
  const G = 0x3f7d3b, G2 = 0x4c9147;
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 2.4, sx: 0.9, sy: 4.8, sz: 0.9, c: G },
    { x: 1.05, y: 2.7, sx: 1.2, sy: 0.65, sz: 0.65, c: G2 },
    { x: 1.5, y: 3.6, sx: 0.65, sy: 1.7, sz: 0.65, c: G2 },
    { x: -1.0, y: 1.9, sx: 1.1, sy: 0.65, sz: 0.65, c: G2 },
    { x: -1.4, y: 2.7, sx: 0.65, sy: 1.4, sz: 0.65, c: G2 },
  ]));
  group.rotation.y = rnd(0, Math.PI * 2);
  return { group };
}

function rocks() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 0.7, sx: 1.9, sy: 1.5, sz: 1.6, c: 0x8b8578 },
    { x: 0.9, y: 0.4, z: 0.5, sx: 1.1, sy: 0.8, sz: 1.0, c: 0x9b958a },
    { x: -0.7, y: 1.2, z: -0.2, sx: 0.9, sy: 0.8, sz: 0.8, c: 0x7d786c },
  ], { jitter: 0.07 }));
  group.rotation.y = rnd(0, Math.PI * 2);
  return { group };
}

function deadTree() {
  const T = 0x6e5138;
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 1.5, sx: 0.55, sy: 3.0, sz: 0.55, c: T },
    { x: 0.8, y: 2.6, sx: 1.6, sy: 0.35, sz: 0.35, c: T },
    { x: 1.5, y: 3.2, sx: 0.35, sy: 1.2, sz: 0.35, c: T },
    { x: -0.6, y: 3.3, sx: 1.2, sy: 0.3, sz: 0.3, c: 0x5c422c },
  ]));
  group.rotation.y = rnd(0, Math.PI * 2);
  return { group };
}

function tumbleweed() {
  const vox = [];
  for (let i = 0; i < 10; i++) {
    vox.push({
      x: rnd(-0.5, 0.5), y: rnd(-0.5, 0.5), z: rnd(-0.5, 0.5),
      sx: rnd(0.1, 1.2), sy: rnd(0.1, 1.2), sz: rnd(0.1, 1.2),
      c: 0x8a6b3f,
    });
  }
  const group = new THREE.Group();
  const ball = voxMesh(vox, { jitter: 0.12 });
  ball.position.y = 0.75;
  group.add(ball);
  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = rnd(1.5, 3.5);
  return {
    group,
    tick: (dt) => {
      group.position.x += dir * speed * dt;
      ball.rotation.z -= dir * speed * dt * 1.4;
    },
  };
}

function pine() {
  const T = 0x4a3524, L = [0x2e6b45, 0x27593a, 0x35784e];
  const group = new THREE.Group();
  const g = pick(L);
  group.add(voxMesh([
    { y: 0.7, sx: 0.55, sy: 1.4, sz: 0.55, c: T },
    { y: 1.8, sx: 3.0, sy: 1.0, sz: 3.0, c: g },
    { y: 2.75, sx: 2.3, sy: 0.95, sz: 2.3, c: g },
    { y: 3.65, sx: 1.6, sy: 0.9, sz: 1.6, c: g },
    { y: 4.5, sx: 0.9, sy: 0.9, sz: 0.9, c: g },
  ], { jitter: 0.07 }));
  group.scale.setScalar(rnd(0.8, 1.5));
  return { group };
}

function crystalDecor() {
  const group = new THREE.Group();
  group.add(voxMesh([{ y: 0.35, sx: 2.2, sy: 0.7, sz: 1.8, c: 0x4a4a58 }]));
  const glow = new THREE.Mesh(
    voxGeo([
      { x: -0.4, y: 1.3, sx: 0.55, sy: 2.0, sz: 0.55, c: 0x5ee6d0 },
      { x: 0.5, y: 1.0, sx: 0.45, sy: 1.4, sz: 0.45, c: 0x7df0dd },
      { x: 0.05, y: 0.85, z: 0.5, sx: 0.35, sy: 1.0, sz: 0.35, c: 0x4ecfc0 },
    ], 0),
    glowMat(0x5ee6d0, 0.85)
  );
  glow.castShadow = true;
  group.add(glow);
  return { group };
}

function campDecor() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { x: 1.6, y: 0.85, sx: 1.9, sy: 1.7, sz: 0.3, c: 0xd97f4a },
    { x: 1.6, y: 1.75, sx: 1.1, sy: 0.5, sz: 0.3, c: 0xc06a3a },
    { x: -0.9, y: 0.16, sx: 1.1, sy: 0.22, sz: 0.28, c: 0x5c422c },
    { x: -0.9, y: 0.16, z: 0.3, sx: 0.28, sy: 0.22, sz: 1.1, c: 0x6e5138 },
  ]));
  const flame = new THREE.Mesh(
    voxGeo([
      { x: -0.9, y: 0.55, sx: 0.4, sy: 0.65, sz: 0.4, c: 0xffa53d },
      { x: -0.9, y: 1.0, sx: 0.22, sy: 0.4, sz: 0.22, c: 0xffd27a },
    ], 0),
    glowMat(0xffa53d, 1.6)
  );
  group.add(flame);
  let t = Math.random() * 10;
  return {
    group,
    tick: (dt) => {
      t += dt;
      flame.scale.y = 1 + Math.sin(t * 9) * 0.2 + Math.sin(t * 23) * 0.08;
    },
  };
}

function cabin() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 1.3, sx: 3.6, sy: 2.6, sz: 3.0, c: 0x6b4a2c },
    { y: 2.85, sx: 4.0, sy: 0.55, sz: 3.4, c: 0x3d2c1c },
    { y: 3.32, sx: 2.6, sy: 0.5, sz: 3.4, c: 0x332416 },
    { x: 1.1, y: 3.9, sx: 0.55, sy: 1.1, sz: 0.55, c: 0x55534e },
  ]));
  const win = new THREE.Mesh(
    voxGeo([{ z: 1.53, y: 1.5, sx: 0.8, sy: 0.8, sz: 0.1, c: 0xffd27a }], 0),
    glowMat(0xffd27a, 1.3)
  );
  group.add(win);
  group.rotation.y = rnd(-0.6, 0.6);
  return { group };
}

function telegraphPole() {
  const P = 0x4a3826;
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 3.2, sx: 0.35, sy: 6.4, sz: 0.35, c: P },
    { y: 5.9, sx: 2.1, sy: 0.22, sz: 0.22, c: P },
    { y: 5.45, sx: 1.5, sy: 0.2, sz: 0.2, c: 0x3d2e1e },
    { x: -0.85, y: 6.12, sx: 0.14, sy: 0.22, sz: 0.14, c: 0xd7e4ea },
    { x: 0.85, y: 6.12, sx: 0.14, sy: 0.22, sz: 0.14, c: 0xd7e4ea },
  ]));
  return { group, roadside: true };
}

function fenceline() {
  const group = new THREE.Group();
  const vox = [
    { y: 0.55, sx: 8.4, sy: 0.16, sz: 0.12, c: 0x8d6238 },
    { y: 0.95, sx: 8.4, sy: 0.16, sz: 0.12, c: 0x7a5230 },
  ];
  for (const px of [-4, -1.35, 1.35, 4]) {
    vox.push({ x: px, y: 0.55, sx: 0.22, sy: 1.15, sz: 0.22, c: 0x6e4a26 });
  }
  group.add(voxMesh(vox, { jitter: 0.08 }));
  group.rotation.y = Math.PI / 2; // run parallel to the trail
  return { group, roadside: true };
}

// biome index → weighted decor builder list
export const DECOR_SETS = [
  [tree, tree, wheat, wheat, wheat, hayPile, cow, windmill, barn, silo, telegraphPole, fenceline, fenceline],
  [saguaro, saguaro, saguaro, rocks, deadTree, deadTree, tumbleweed, tumbleweed, mesa, mesa, telegraphPole],
  [pine, pine, pine, pine, crystalDecor, crystalDecor, rocks, campDecor, cabin],
];

/* ================================================================== */
/*  OBSTACLES — return { group, kind, h, gap, halfW, halfD, tick? }   */
/*  kind: 'jump' (leap it) | 'full' (dodge it) | 'over' (slide it)    */
/* ================================================================== */

const WOOD = 0x7a5230, WOOD2 = 0x8d6238, WOOD3 = 0x6e4a26;

function fence() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { x: -0.85, y: 0.5, sx: 0.24, sy: 1.0, sz: 0.24, c: WOOD3 },
    { x: 0.85, y: 0.5, sx: 0.24, sy: 1.0, sz: 0.24, c: WOOD3 },
    { y: 0.52, sx: 2.1, sy: 0.2, sz: 0.13, c: WOOD2 },
    { y: 0.87, sx: 2.1, sy: 0.2, sz: 0.13, c: WOOD },
  ]));
  return { group, kind: 'jump', h: 0.95, halfW: 1.05, halfD: 0.35 };
}

function fenceWide() {
  const group = new THREE.Group();
  const vox = [
    { y: 0.52, sx: 7.8, sy: 0.2, sz: 0.13, c: WOOD2 },
    { y: 0.87, sx: 7.8, sy: 0.2, sz: 0.13, c: WOOD },
  ];
  for (const px of [-3.5, -1.2, 1.2, 3.5]) {
    vox.push({ x: px, y: 0.5, sx: 0.24, sy: 1.0, sz: 0.24, c: WOOD3 });
  }
  group.add(voxMesh(vox));
  return { group, kind: 'jump', h: 0.95, halfW: 4.4, halfD: 0.35 };
}

function hay() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 0.5, sx: 1.5, sy: 1.0, sz: 1.15, c: 0xd9b44a },
    { y: 0.5, x: -0.35, sx: 0.14, sy: 1.04, sz: 1.19, c: 0xa9853a },
    { y: 0.5, x: 0.35, sx: 0.14, sy: 1.04, sz: 1.19, c: 0xa9853a },
  ], { jitter: 0.08 }));
  return { group, kind: 'jump', h: 1.0, halfW: 0.95, halfD: 0.75 };
}

function wagon() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 1.1, sx: 1.9, sy: 0.9, sz: 2.7, c: WOOD3 },
    { y: 1.95, sx: 2.05, sy: 0.8, sz: 2.5, c: 0xe8dcc2 },
    { y: 2.5, sx: 1.7, sy: 0.45, sz: 2.3, c: 0xf2e8d8 },
    { x: -1.0, y: 0.55, z: 0.95, sx: 0.2, sy: 1.1, sz: 1.1, c: 0x3d2c1c },
    { x: 1.0, y: 0.55, z: 0.95, sx: 0.2, sy: 1.1, sz: 1.1, c: 0x3d2c1c },
    { x: -1.0, y: 0.55, z: -0.95, sx: 0.2, sy: 1.1, sz: 1.1, c: 0x3d2c1c },
    { x: 1.0, y: 0.55, z: -0.95, sx: 0.2, sy: 1.1, sz: 1.1, c: 0x3d2c1c },
  ]));
  return { group, kind: 'full', h: 2.7, halfW: 1.1, halfD: 1.4 };
}

function boulder() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 0.95, sx: 1.9, sy: 1.9, sz: 1.6, c: 0x8b8578 },
    { x: 0.5, y: 1.9, sx: 1.1, sy: 0.9, sz: 1.0, c: 0x9b958a },
    { x: -0.6, y: 0.6, z: 0.4, sx: 0.9, sy: 1.2, sz: 0.9, c: 0x7d786c },
  ], { jitter: 0.07 }));
  return { group, kind: 'full', h: 2.3, halfW: 1.05, halfD: 0.95 };
}

function ranchGate() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { x: -4.0, y: 1.5, sx: 0.55, sy: 3.0, sz: 0.55, c: WOOD3 },
    { x: 4.0, y: 1.5, sx: 0.55, sy: 3.0, sz: 0.55, c: WOOD3 },
    { y: 1.45, sx: 8.6, sy: 0.75, sz: 0.4, c: WOOD },
    { y: 2.25, sx: 2.4, sy: 0.55, sz: 0.18, c: 0xd9b44a },
  ]));
  return { group, kind: 'over', gap: 1.06, halfW: 4.4, halfD: 0.4 };
}

function cactusSmall() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 0.48, sx: 0.55, sy: 0.95, sz: 0.55, c: 0x3f7d3b },
    { x: 0.5, y: 0.6, sx: 0.5, sy: 0.4, sz: 0.4, c: 0x4c9147 },
    { x: -0.45, y: 0.35, sx: 0.4, sy: 0.5, sz: 0.4, c: 0x4c9147 },
  ]));
  return { group, kind: 'jump', h: 0.95, halfW: 0.85, halfD: 0.45 };
}

function log() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 0.42, sx: 2.0, sy: 0.6, sz: 0.65, c: WOOD },
    { x: 0.6, y: 0.82, sx: 0.35, sy: 0.25, sz: 0.35, c: 0x5c422c },
    { x: -0.9, y: 0.42, sx: 0.25, sy: 0.66, sz: 0.7, c: 0x5c422c },
  ]));
  return { group, kind: 'jump', h: 0.82, halfW: 1.05, halfD: 0.45 };
}

function saguaroTall() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 1.3, sx: 0.85, sy: 2.6, sz: 0.85, c: 0x3f7d3b },
    { x: 0.85, y: 1.5, sx: 0.9, sy: 0.6, sz: 0.6, c: 0x4c9147 },
    { x: 1.15, y: 2.1, sx: 0.6, sy: 1.3, sz: 0.6, c: 0x4c9147 },
  ]));
  return { group, kind: 'full', h: 2.6, halfW: 0.95, halfD: 0.55 };
}

function mesaRock() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 0.8, sx: 1.9, sy: 1.6, sz: 1.5, c: 0xb0603f },
    { y: 1.9, sx: 1.4, sy: 0.7, sz: 1.1, c: 0xc27a4a },
    { y: 2.4, sx: 0.9, sy: 0.4, sz: 0.8, c: 0xd18c55 },
  ], { jitter: 0.06 }));
  return { group, kind: 'full', h: 2.4, halfW: 1.0, halfD: 0.85 };
}

function archDesert() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { x: -3.9, y: 1.4, sx: 1.2, sy: 2.8, sz: 1.0, c: 0xb0603f },
    { x: 3.9, y: 1.4, sx: 1.2, sy: 2.8, sz: 1.0, c: 0xb0603f },
    { y: 1.55, sx: 8.8, sy: 0.95, sz: 0.9, c: 0x9c5436 },
    { y: 2.2, sx: 6.0, sy: 0.45, sz: 0.8, c: 0xc27a4a },
  ], { jitter: 0.06 }));
  return { group, kind: 'over', gap: 1.07, halfW: 4.4, halfD: 0.55 };
}

function campfire() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 0.14, sx: 1.2, sy: 0.24, sz: 0.3, c: 0x5c422c },
    { y: 0.14, sx: 0.3, sy: 0.24, sz: 1.2, c: 0x6e5138 },
    { x: 0.55, y: 0.12, z: 0.55, sx: 0.3, sy: 0.24, sz: 0.3, c: 0x77736a },
    { x: -0.55, y: 0.12, z: -0.55, sx: 0.3, sy: 0.24, sz: 0.3, c: 0x77736a },
  ]));
  const flame = new THREE.Mesh(
    voxGeo([
      { y: 0.55, sx: 0.5, sy: 0.7, sz: 0.5, c: 0xffa53d },
      { y: 1.0, sx: 0.28, sy: 0.45, sz: 0.28, c: 0xffd27a },
    ], 0),
    glowMat(0xffa53d, 1.7)
  );
  group.add(flame);
  let t = Math.random() * 10;
  return {
    group, kind: 'jump', h: 0.95, halfW: 0.85, halfD: 0.6,
    tick: (dt) => {
      t += dt;
      flame.scale.setScalar(1 + Math.sin(t * 10) * 0.13);
    },
  };
}

function logPile() {
  const group = new THREE.Group();
  group.add(voxMesh([
    { y: 0.35, sx: 2.0, sy: 0.55, sz: 0.6, c: WOOD },
    { y: 0.35, z: 0.55, sx: 1.8, sy: 0.55, sz: 0.55, c: WOOD3 },
    { y: 0.85, z: 0.25, sx: 1.7, sy: 0.5, sz: 0.55, c: 0x5c422c },
  ]));
  return { group, kind: 'jump', h: 1.05, halfW: 1.0, halfD: 0.75 };
}

function crystalTall() {
  const group = new THREE.Group();
  group.add(voxMesh([{ y: 0.3, sx: 1.7, sy: 0.6, sz: 1.4, c: 0x4a4a58 }]));
  const glow = new THREE.Mesh(
    voxGeo([
      { y: 1.5, sx: 0.7, sy: 2.4, sz: 0.7, c: 0x5ee6d0 },
      { x: 0.55, y: 1.0, sx: 0.45, sy: 1.5, sz: 0.45, c: 0x7df0dd },
      { x: -0.5, y: 0.9, sx: 0.4, sy: 1.2, sz: 0.4, c: 0x4ecfc0 },
    ], 0),
    glowMat(0x5ee6d0, 0.9)
  );
  glow.castShadow = true;
  group.add(glow);
  return { group, kind: 'full', h: 2.7, halfW: 0.95, halfD: 0.75 };
}

function branchGate() {
  const D = 0x3a2c1e, D2 = 0x4a3826;
  const group = new THREE.Group();
  group.add(voxMesh([
    { x: -3.9, y: 1.6, sx: 0.8, sy: 3.2, sz: 0.8, c: D },
    { x: 3.9, y: 1.6, sx: 0.8, sy: 3.2, sz: 0.8, c: D },
    { y: 1.5, sx: 8.6, sy: 0.55, sz: 0.5, c: D2 },
    { x: 1.2, y: 1.85, sx: 2.2, sy: 0.35, sz: 0.4, c: D },
    { x: -3.6, y: 3.2, sx: 1.4, sy: 1.0, sz: 1.4, c: 0x27593a },
    { x: 3.7, y: 3.3, sx: 1.5, sy: 1.1, sz: 1.5, c: 0x2e6b45 },
  ]));
  return { group, kind: 'over', gap: 1.08, halfW: 4.4, halfD: 0.5 };
}

export const OBSTACLE_BUILDERS = {
  fence, fenceWide, hay, wagon, boulder, ranchGate,
  cactusSmall, log, saguaroTall, mesaRock, archDesert,
  campfire, logPile, crystalTall, branchGate,
};

// biome index → obstacle type names per behavior
export const OBSTACLE_SETS = [
  { jump: ['fence', 'hay'], full: ['wagon', 'boulder'], over: ['ranchGate'], wide: 'fenceWide' },
  { jump: ['cactusSmall', 'log'], full: ['saguaroTall', 'mesaRock'], over: ['archDesert'], wide: 'fenceWide' },
  { jump: ['campfire', 'logPile'], full: ['crystalTall', 'boulder'], over: ['branchGate'], wide: 'fenceWide' },
];

/* ---------------- coin ---------------- */

export function buildCoin() {
  const m = new THREE.Mesh(
    voxGeo([
      { sx: 0.78, sy: 0.78, sz: 0.14, c: 0xf5c542 },
      { sx: 0.92, sy: 0.3, sz: 0.12, c: 0xdba82c },
      { sx: 0.3, sy: 0.92, sz: 0.12, c: 0xdba82c },
      { sx: 0.3, sy: 0.44, sz: 0.2, c: 0x8a6410 },
    ], 0),
    COINMAT
  );
  m.castShadow = true;
  return m;
}
