import * as THREE from 'three';

const c = (h) => new THREE.Color(h);
const v = (x, y, z) => new THREE.Vector3(x, y, z);

// Three worlds the charge travels through, looping forever.
export const BIOMES = [
  {
    name: 'Golden Prairie',
    skyTop: c(0x4f9fe0), skyHorizon: c(0xf4ecc2), skyBottom: c(0x7fa06a),
    sunColor: c(0xfff3d0), sunIntensity: 1.25, sunPos: v(12, 18, 9),
    hemiSky: c(0xbfd9ff), hemiGround: c(0x8a9a6a), hemiIntensity: 0.75,
    fog: c(0xdfeacc),
    ground: c(0x7fb554), road: c(0xb18a55), roadEdge: c(0x8f6f42),
    cloud: c(0xffffff), cloudOpacity: 0.92,
    starAlpha: 0,
    dust: c(0xcbb083),
    mountain: c(0x7d9b8c),
    exposure: 1.05,
    auroraAlpha: 0,
    tufts: [0x6faa4c, 0x8cc45e, 0x79b356, 0x9fce6a, 0xe0c96a],
    flowers: [0xe86a6a, 0xf2f2f2, 0xf0b429, 0xb06ac9],
  },
  {
    name: 'Crimson Mesa',
    skyTop: c(0x54418f), skyHorizon: c(0xff9e5c), skyBottom: c(0x9c5a38),
    sunColor: c(0xffb547), sunIntensity: 1.35, sunPos: v(16, 7, 12),
    hemiSky: c(0xffd2a0), hemiGround: c(0xa97748), hemiIntensity: 0.65,
    fog: c(0xe8a878),
    ground: c(0xd39a55), road: c(0xbb8347), roadEdge: c(0x96683a),
    cloud: c(0xffd9b0), cloudOpacity: 0.7,
    starAlpha: 0.25,
    dust: c(0xe2b489),
    mountain: c(0x9c5a44),
    exposure: 1.12,
    auroraAlpha: 0,
    tufts: [0xc98f4e, 0xa9773f, 0x7c9a53, 0xd6a75f, 0x8a5c33],
    flowers: [0xe86a8a, 0xf0b429],
  },
  {
    name: 'Starlit Range',
    skyTop: c(0x080e2c), skyHorizon: c(0x37317c), skyBottom: c(0x101530),
    sunColor: c(0xcfe0ff), sunIntensity: 0.55, sunPos: v(-9, 15, -7),
    hemiSky: c(0x3a4a8a), hemiGround: c(0x1c2430), hemiIntensity: 0.55,
    fog: c(0x151a3d),
    ground: c(0x27423a), road: c(0x494066), roadEdge: c(0x353052),
    cloud: c(0x2a3160), cloudOpacity: 0.5,
    starAlpha: 1,
    dust: c(0x55507a),
    mountain: c(0x232c55),
    exposure: 0.92,
    auroraAlpha: 0.6,
    tufts: [0x2f5a4c, 0x3c6b58, 0x477a62, 0x63c9b8, 0x35526b],
    flowers: [0x63e0c9, 0x7db8e8],
  },
];

export const SEGMENT_LENGTH = 480; // metres per world before it morphs
const BLEND_METERS = 85;

const COLOR_KEYS = [
  'skyTop', 'skyHorizon', 'skyBottom', 'sunColor', 'hemiSky', 'hemiGround',
  'fog', 'ground', 'road', 'roadEdge', 'cloud', 'dust', 'mountain',
];
const SCALAR_KEYS = ['sunIntensity', 'hemiIntensity', 'cloudOpacity', 'starAlpha', 'exposure', 'auroraAlpha'];

function makePalette() {
  const p = {};
  for (const k of COLOR_KEYS) p[k] = new THREE.Color();
  for (const k of SCALAR_KEYS) p[k] = 0;
  p.sunPos = new THREE.Vector3();
  p.name = BIOMES[0].name;
  p.tufts = BIOMES[0].tufts;
  p.flowers = BIOMES[0].flowers;
  return p;
}

const smooth = (x) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};

export class BiomeManager {
  constructor() {
    this.palette = makePalette();
    this.seg = -1;
    this.changed = false;
    this.spawnIndex = 0;
    this.update(0);
  }

  reset() {
    this.seg = -1;
    this.changed = false;
    this.update(0);
  }

  update(distance) {
    const seg = Math.floor(distance / SEGMENT_LENGTH);
    if (seg !== this.seg) {
      const first = this.seg === -1;
      this.seg = seg;
      this.spawnIndex = seg % BIOMES.length;
      this.changed = !first || seg > 0;
      if (this.seg === 0 && first) this.changed = false;
    }
    const local = distance - seg * SEGMENT_LENGTH;
    const t = seg === 0 ? 1 : smooth(local / BLEND_METERS);
    const from = BIOMES[((seg - 1) % BIOMES.length + BIOMES.length) % BIOMES.length];
    const to = BIOMES[seg % BIOMES.length];

    const p = this.palette;
    for (const k of COLOR_KEYS) p[k].lerpColors(from[k], to[k], t);
    for (const k of SCALAR_KEYS) p[k] = from[k] + (to[k] - from[k]) * t;
    p.sunPos.lerpVectors(from.sunPos, to.sunPos, t);
    p.name = to.name;
    p.tufts = to.tufts;
    p.flowers = to.flowers;
  }

  consumeChanged() {
    const c = this.changed;
    this.changed = false;
    return c;
  }
}
