import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sky } from './sky.js';
import { Ambience } from './ambience.js';
import { World } from './world.js';
import { Bull } from './bull.js';
import { Obstacles } from './obstacles.js';
import { Particles } from './particles.js';
import { BiomeManager } from './palettes.js';
import { AudioFX } from './audio.js';

const BASE_SPEED = 11;
const MAX_EXTRA = 26; // top speed = 37
const MENU_SPEED = 8;

export class Game {
  constructor(container) {
    this.container = container;

    // AA is handled by the composer's multisampled target, so the renderer
    // itself skips MSAA. high-performance asks for the discrete GPU.
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    // Cap the device pixel ratio: on a retina panel native DPR is 2-3, which
    // is 4-9x the fragments. 1.6 looks crisp for a voxel game at a fraction
    // of the fill cost. The adaptive scaler tunes down from here under load.
    this.maxDPR = Math.min(window.devicePixelRatio || 1, 1.6);
    this.dpr = this.maxDPR;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xdfeacc, 32, 170);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(3.6, 2.0, 7.4);

    // Lights.
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a9a6a, 0.75);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3d0, 1.25);
    this.sun.castShadow = true;
    // 1024 over a ~44-unit frustum is still sharp for blocky geometry.
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -22;
    this.sun.shadow.camera.right = 22;
    this.sun.shadow.camera.top = 26;
    this.sun.shadow.camera.bottom = -14;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 80;
    this.sun.shadow.bias = -0.0008;
    this.sun.target.position.set(0, 0, -10);
    this.scene.add(this.sun, this.sun.target);

    // Cool fill from the opposite side keeps shadowed voxels readable.
    this.fill = new THREE.DirectionalLight(0xbfd9ff, 0.2);
    this.scene.add(this.fill);

    // Post-processing: 2x MSAA render target + bloom for sun, coins and glow.
    const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 2, type: THREE.HalfFloatType });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(this.dpr);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.55, 0.85
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // Systems.
    this.biomes = new BiomeManager();
    this.sky = new Sky(this.scene);
    this.particles = new Particles(this.scene, this);
    this.world = new World(this.scene, this);
    this.obstacles = new Obstacles(this.scene, this);
    this.audio = new AudioFX();
    this.bull = new Bull(this.scene, this);
    this.ambience = new Ambience(this.scene, this);

    // State.
    this.state = 'menu';
    this.distance = 0;
    this.coins = 0;
    this.speed = MENU_SPEED;
    this.timeScale = 1;
    this.menuT = 0;
    this.ui = null;

    // Adaptive resolution: hold ~60fps by nudging pixel ratio up/down.
    this._fpsEMA = 60;
    this._perfT = 0;

    this.clock = new THREE.Clock();
    this._lookAt = new THREE.Vector3();
    this._camTarget = new THREE.Vector3();

    this.bindInput();
    window.addEventListener('resize', () => this.onResize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  get score() {
    return Math.floor(this.distance + this.coins * 25);
  }

  /* ---------------- adaptive resolution ---------------- */

  setDPR(d) {
    d = Math.max(0.8, Math.min(this.maxDPR, d));
    if (Math.abs(d - this.dpr) < 0.02) return;
    this.dpr = d;
    this.renderer.setPixelRatio(d);
    this.composer.setPixelRatio(d);
  }

  tuneResolution(raw) {
    // raw is clamped to 0.05 upstream, so a choppy frame reads as 20fps.
    const fps = 1 / Math.max(raw, 1e-3);
    this._fpsEMA += (fps - this._fpsEMA) * 0.1;
    this._perfT += raw;
    if (this._perfT < 0.7) return;
    this._perfT = 0;
    if (this._fpsEMA < 52 && this.dpr > 0.8) this.setDPR(this.dpr - 0.15);
    else if (this._fpsEMA > 58 && this.dpr < this.maxDPR) this.setDPR(this.dpr + 0.1);
  }

  /* ---------------- state ---------------- */

  reset() {
    this.distance = 0;
    this.coins = 0;
    this.speed = BASE_SPEED;
    this.timeScale = 1;
    this.biomes.reset();
    this.obstacles.clear();
    this.bull.reset();
    this.world.refresh();
    this.biomes.consumeChanged();
  }

  begin() {
    this.reset();
    this.state = 'run';
  }

  toMenu() {
    this.reset();
    this.speed = MENU_SPEED;
    this.state = 'menu';
  }

  gameOver() {
    this.state = 'dead';
    this.bull.die();
    this.audio.hit();
    this.particles.burst(this.bull.x, 0.6, 0);
    this.shake = 0.5;
    const stats = { score: this.score, distance: Math.floor(this.distance), coins: this.coins };
    setTimeout(() => this.ui?.onGameOver(stats), 1100);
  }

  /* ---------------- input ---------------- */

  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (this.state !== 'run') return;
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this.bull.moveLane(-1); break;
        case 'ArrowRight': case 'KeyD': this.bull.moveLane(1); break;
        case 'ArrowUp': case 'KeyW': case 'Space': e.preventDefault(); this.bull.jump(); break;
        case 'ArrowDown': case 'KeyS': e.preventDefault(); this.bull.slide(); break;
      }
    });

    // Touch swipes.
    let sx = 0, sy = 0, st = 0;
    window.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY; st = performance.now();
    }, { passive: true });
    window.addEventListener('touchend', (e) => {
      if (this.state !== 'run') return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      const dt = performance.now() - st;
      if (dt > 600) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 24) this.bull.moveLane(dx > 0 ? 1 : -1);
      } else if (Math.abs(dy) > 24) {
        dy < 0 ? this.bull.jump() : this.bull.slide();
      } else {
        this.bull.jump(); // tap = jump
      }
    }, { passive: true });
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ---------------- loop ---------------- */

  frame() {
    const raw = Math.min(this.clock.getDelta(), 0.05);
    this.tuneResolution(raw);

    // Cinematic slow-mo on death.
    const targetScale = this.state === 'dead' ? 0.14 : 1;
    this.timeScale += (targetScale - this.timeScale) * Math.min(1, raw * 6);
    const dt = raw * this.timeScale;

    const running = this.state === 'run';

    // Speed curve: quick to get moving, slowly asymptotes to max.
    if (running) {
      this.speed = BASE_SPEED + MAX_EXTRA * (1 - Math.exp(-this.distance / 1300));
    } else if (this.state === 'menu') {
      this.speed = MENU_SPEED;
    }
    const ds = this.speed * dt; // metres scrolled this frame
    if (running || this.state === 'menu') this.distance += running ? ds : 0;

    // Biome blend + palette application.
    this.biomes.update(this.distance);
    const p = this.biomes.palette;
    this.scene.fog.color.copy(p.fog);
    this.sky.apply(p);
    this.sky.update(dt);
    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;
    this.sun.color.copy(p.sunColor);
    this.sun.intensity = p.sunIntensity;
    this.sun.position.copy(p.sunPos);
    this.fill.color.copy(p.hemiSky);
    this.fill.position.set(-p.sunPos.x, p.sunPos.y * 0.5 + 5, 8);
    this.renderer.toneMappingExposure +=
      (p.exposure - this.renderer.toneMappingExposure) * Math.min(1, raw * 2);
    this.world.applyPalette(p);

    if (running && this.biomes.consumeChanged()) {
      this.ui?.toast(p.name);
      this.audio.biomeChime();
    }

    // World + gameplay.
    this.world.update(dt, ds);
    this.obstacles.update(dt, ds);
    this.particles.update(dt, ds);
    this.ambience.update(dt, ds, p, this.biomes.spawnIndex);
    this.bull.update(dt, this.speed, running);

    if (running) {
      const got = this.obstacles.collectCoins(this.bull);
      if (got) {
        this.coins += got;
        this.audio.coin();
      }
      if (this.obstacles.checkCollision(this.bull)) this.gameOver();
      this.ui?.hud(this.score, this.coins, this.distance, this.speed);
      this.audio.setWind((this.speed - BASE_SPEED) / MAX_EXTRA);
    } else {
      this.audio.setWind(0.08);
    }

    this.updateCamera(raw, dt);
    this.composer.render();
  }

  updateCamera(raw, dt) {
    const b = this.bull;
    if (this.state === 'menu') {
      // Slow showcase drift around the galloping bull.
      this.menuT += dt * 0.14;
      const a = Math.sin(this.menuT) * 0.55;
      this._camTarget.set(Math.sin(a) * 6.4, 1.9 + Math.sin(this.menuT * 0.7) * 0.35, Math.cos(a) * 6.4 + 1.2);
      this._lookAt.set(0, 1.2, -6);
      this.camera.fov += (58 - this.camera.fov) * Math.min(1, raw * 2);
    } else {
      this._camTarget.set(b.x * 0.55, 3.05 + b.y * 0.28, 6.3);
      this._camTarget.y += Math.sin(performance.now() * 0.0016) * 0.06; // breathing
      this._lookAt.set(b.x * 0.78, 1.25 + b.y * 0.3, -5);
      const targetFov = 60 + (this.speed - BASE_SPEED) * 0.5;
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, raw * 2);
    }

    // Death shake.
    if (this.shake > 0.001) {
      this.shake *= Math.exp(-raw * 5);
      this._camTarget.x += (Math.random() - 0.5) * this.shake;
      this._camTarget.y += (Math.random() - 0.5) * this.shake;
    }

    const k = 1 - Math.exp(-raw * 4.5);
    this.camera.position.lerp(this._camTarget, k);
    this.camera.lookAt(this._lookAt);
    this.camera.updateProjectionMatrix();
  }
}
