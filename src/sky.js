import * as THREE from 'three';
import { voxGeo } from './models.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export class Sky {
  constructor(scene) {
    this.time = 0;
    this.starAlpha = 0;

    // ---- gradient dome with a soft sun/moon glow ----
    this.uniforms = {
      topColor: { value: new THREE.Color(0x4f9fe0) },
      horizonColor: { value: new THREE.Color(0xf4ecc2) },
      bottomColor: { value: new THREE.Color(0x7fa06a) },
      sunDir: { value: new THREE.Vector3(0.35, 0.42, -0.85).normalize() },
      sunColor: { value: new THREE.Color(0xfff3d0) },
    };
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 topColor, horizonColor, bottomColor, sunColor, sunDir;
        void main() {
          float h = vDir.y;
          vec3 col = h > 0.0
            ? mix(horizonColor, topColor, pow(min(h * 1.55, 1.0), 0.72))
            : mix(horizonColor, bottomColor, min(-h * 3.0, 1.0));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += sunColor * (pow(s, 320.0) * 1.35 + pow(s, 9.0) * 0.3);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(420, 28, 14), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    // ---- twinkling stars (shader points: per-star size + phase) ----
    const N = 700;
    const pos = new Float32Array(N * 3);
    const aSize = new Float32Array(N);
    const aPhase = new Float32Array(N);
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      v.randomDirection();
      v.y = Math.abs(v.y) * 0.92 + 0.06;
      v.normalize().multiplyScalar(398);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      aSize[i] = rnd(1.4, 3.4);
      aPhase[i] = Math.random();
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
    this.starUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
    this.stars = new THREE.Points(starGeo, new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: this.starUniforms,
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aPhase;
        uniform float uTime;
        varying float vA;
        void main() {
          vA = 0.55 + 0.45 * sin(uTime * (0.8 + aPhase * 2.2) + aPhase * 40.0);
          gl_PointSize = aSize;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        uniform float uOpacity;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.1, length(c)) * vA * uOpacity;
          gl_FragColor = vec4(0.85, 0.9, 1.0, a);
        }`,
    }));
    scene.add(this.stars);

    // ---- moon (rides where the night biome's light comes from) ----
    this.moonMats = [];
    const moonMat = (c) => {
      const m = new THREE.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0, depthWrite: false });
      this.moonMats.push(m);
      return m;
    };
    this.moon = new THREE.Group();
    this.moon.add(new THREE.Mesh(new THREE.CircleGeometry(21, 26), moonMat(0xe6edff)));
    const crater = (x, y, r, c) => {
      const cm = new THREE.Mesh(new THREE.CircleGeometry(r, 14), moonMat(c));
      cm.position.set(x, y, 0.6);
      this.moon.add(cm);
    };
    crater(-6, 4, 4.2, 0xc4cfe8);
    crater(7, -3, 3.1, 0xcbd5ec);
    crater(-2, -7, 2.4, 0xc4cfe8);
    this.moon.position.set(-9, 15, -7).normalize();
    this.moon.position.multiplyScalar(392);
    this.moon.lookAt(0, 0, 0);
    scene.add(this.moon);

    // ---- two-tone voxel clouds, drifting + gently bobbing ----
    this.cloudMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      fog: false,
      depthWrite: false,
    });
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const vox = [];
      const n = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < n; j++) {
        const x = (Math.random() - 0.5) * 14;
        const y = (Math.random() - 0.5) * 2.0;
        const z = (Math.random() - 0.5) * 6;
        const sx = 5 + Math.random() * 8;
        const sy = 1.6 + Math.random() * 1.6;
        const sz = 3.5 + Math.random() * 4;
        vox.push({ x, y, z, sx, sy, sz, c: 0xffffff });
        // shaded underside
        vox.push({ x, y: y - sy * 0.42, z, sx: sx * 0.86, sy: sy * 0.4, sz: sz * 0.86, c: 0xc9c9d6 });
      }
      const m = new THREE.Mesh(voxGeo(vox, 0), this.cloudMat);
      m.position.set((Math.random() - 0.5) * 340, 46 + Math.random() * 42, -80 - Math.random() * 240);
      m.userData.speed = 0.6 + Math.random() * 1.1;
      m.userData.baseY = m.position.y;
      m.userData.phase = Math.random() * 10;
      this.clouds.push(m);
      scene.add(m);
    }

    // ---- shooting stars ----
    this.shots = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.35, 12),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, fog: false, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      m.visible = false;
      m.userData.life = 0;
      m.userData.vel = new THREE.Vector3();
      this.shots.push(m);
      scene.add(m);
    }
    this.shotTimer = 4;

    // ---- aurora curtain (only shows on starlit nights) ----
    this.auroraUniforms = { uTime: { value: 0 }, uAlpha: { value: 0 } };
    const aurora = new THREE.Mesh(
      new THREE.PlaneGeometry(540, 130),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: this.auroraUniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uTime, uAlpha;
          void main() {
            float bands = sin(vUv.x * 9.0 + uTime * 0.22) * sin(vUv.x * 23.0 - uTime * 0.13);
            float wave = 0.5 + 0.5 * sin(vUv.x * 6.0 + uTime * 0.18);
            float lift = 0.12 * sin(vUv.x * 4.0 + uTime * 0.1);
            float y = vUv.y + lift;
            float vert = smoothstep(0.02, 0.24, y) * smoothstep(1.0, 0.45, y);
            float a = vert * (0.4 + 0.3 * bands) * uAlpha;
            vec3 col = mix(vec3(0.2, 0.95, 0.7), vec3(0.55, 0.3, 0.95), wave);
            gl_FragColor = vec4(col * a, a);
          }`,
      })
    );
    aurora.position.set(0, 100, -345);
    scene.add(aurora);
  }

  apply(p) {
    this.uniforms.topColor.value.copy(p.skyTop);
    this.uniforms.horizonColor.value.copy(p.skyHorizon);
    this.uniforms.bottomColor.value.copy(p.skyBottom);
    this.uniforms.sunColor.value.copy(p.sunColor);
    this.uniforms.sunDir.value.copy(p.sunPos).normalize();
    this.starAlpha = p.starAlpha;
    this.starUniforms.uOpacity.value = p.starAlpha;
    this.cloudMat.color.copy(p.cloud);
    this.cloudMat.opacity = p.cloudOpacity;
    this.auroraUniforms.uAlpha.value = p.auroraAlpha * 0.55;
    const moonA = Math.max(0, p.starAlpha - 0.25) / 0.75;
    for (const m of this.moonMats) m.opacity = moonA;
  }

  update(dt) {
    this.time += dt;
    this.starUniforms.uTime.value = this.time;
    this.auroraUniforms.uTime.value = this.time;
    this.stars.rotation.y += dt * 0.004;

    for (const cl of this.clouds) {
      cl.position.x += cl.userData.speed * dt;
      cl.position.y = cl.userData.baseY + Math.sin(this.time * 0.3 + cl.userData.phase) * 1.2;
      if (cl.position.x > 190) cl.position.x = -190;
    }

    // Shooting stars streak across deep night skies.
    if (this.starAlpha > 0.55) {
      this.shotTimer -= dt;
      if (this.shotTimer <= 0) {
        const shot = this.shots.find((s) => s.userData.life <= 0);
        if (shot) {
          shot.position.set(rnd(-160, 160), rnd(130, 210), rnd(-280, -220));
          shot.userData.vel.set(rnd(-70, -35) * (Math.random() < 0.5 ? 1 : -1), rnd(-35, -18), 0);
          shot.userData.life = 1;
          shot.visible = true;
          shot.lookAt(shot.position.clone().add(shot.userData.vel));
        }
        this.shotTimer = rnd(3.5, 9);
      }
    }
    for (const shot of this.shots) {
      if (shot.userData.life <= 0) continue;
      shot.userData.life -= dt * 1.1;
      shot.position.addScaledVector(shot.userData.vel, dt);
      shot.material.opacity = Math.max(0, Math.min(1, shot.userData.life * 1.6)) * this.starAlpha;
      if (shot.userData.life <= 0) shot.visible = false;
    }
  }
}
