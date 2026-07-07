import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* Living ambience — butterflies over the prairie, birds in day skies,
   fireflies in the night grass. Pure decoration, zero gameplay. */
export class Ambience {
  constructor(scene, game) {
    this.game = game;
    this.time = 0;

    // ---- butterflies (prairie) ----
    this.butterflies = [];
    const wingGeo = new THREE.PlaneGeometry(0.26, 0.36);
    wingGeo.rotateX(-Math.PI / 2);
    wingGeo.translate(0.13, 0, 0);
    const wingColors = [0xf59e2d, 0xf2f2f2, 0xe86a6a, 0x8ac8f5];
    for (let i = 0; i < 8; i++) {
      const group = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: pick(wingColors), side: THREE.DoubleSide });
      const right = new THREE.Mesh(wingGeo, mat);
      const left = new THREE.Mesh(wingGeo, mat);
      left.rotation.y = Math.PI;
      group.add(left, right);
      scene.add(group);
      this.butterflies.push({
        group, left, right,
        anchor: new THREE.Vector3(rnd(-26, 26), rnd(0.9, 2.4), rnd(-150, 5)),
        phase: rnd(0, 20),
        flap: rnd(11, 16),
      });
    }

    // ---- fireflies (night) ----
    const N = 46;
    this.fireflyBase = [];
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const b = new THREE.Vector3(
        (Math.random() < 0.5 ? -1 : 1) * rnd(4.8, 22),
        rnd(0.4, 2.6),
        rnd(-160, 10)
      );
      this.fireflyBase.push({ b, phase: rnd(0, 20), speed: rnd(0.6, 1.6) });
      pos[i * 3] = b.x; pos[i * 3 + 1] = b.y; pos[i * 3 + 2] = b.z;
    }
    const ffGeo = new THREE.BufferGeometry();
    ffGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.fireflyMat = new THREE.PointsMaterial({
      color: 0xd8ffb0,
      size: 0.32,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.fireflies = new THREE.Points(ffGeo, this.fireflyMat);
    this.fireflies.frustumCulled = false;
    scene.add(this.fireflies);

    // ---- bird flocks (day skies) ----
    this.flocks = [];
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.14, 0.3);
    const wingGeoB = new THREE.BoxGeometry(0.85, 0.07, 0.26);
    wingGeoB.translate(0.42, 0, 0);
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x2b2418, transparent: true, opacity: 0.9 });
    for (let f = 0; f < 3; f++) {
      const group = new THREE.Group();
      const birds = [];
      const n = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const bird = new THREE.Group();
        bird.add(new THREE.Mesh(bodyGeo, birdMat));
        const wl = new THREE.Mesh(wingGeoB, birdMat);
        wl.rotation.y = Math.PI;
        const wr = new THREE.Mesh(wingGeoB, birdMat);
        bird.add(wl, wr);
        // loose V formation
        bird.position.set(-Math.abs(i - n / 2) * 1.6, rnd(-0.4, 0.4), (i - n / 2) * 1.9);
        group.add(bird);
        birds.push({ bird, wl, wr, phase: rnd(0, 6) });
      }
      group.position.set(rnd(-160, 160), rnd(20, 34), rnd(-190, -70));
      this.flocks.push({ group, birds, speed: rnd(5, 9) * (Math.random() < 0.5 ? 1 : -1), mat: birdMat });
      group.rotation.y = 0;
      scene.add(group);
    }
    this.birdMat = birdMat;
  }

  update(dt, ds, palette, biomeIndex) {
    this.time += dt;
    const t = this.time;

    // Butterflies — only over the prairie; fade out elsewhere by hiding on wrap.
    for (const bf of this.butterflies) {
      bf.anchor.z += ds;
      if (bf.anchor.z > 14) {
        bf.anchor.set((Math.random() < 0.5 ? -1 : 1) * rnd(5, 26), rnd(0.9, 2.4), -150);
        bf.group.visible = biomeIndex === 0;
      }
      const g = bf.group;
      g.position.set(
        bf.anchor.x + Math.sin(t * 0.7 + bf.phase) * 1.6,
        bf.anchor.y + Math.sin(t * 1.3 + bf.phase * 2) * 0.5,
        bf.anchor.z + Math.cos(t * 0.5 + bf.phase) * 1.2
      );
      g.rotation.y = Math.sin(t * 0.4 + bf.phase) * 1.2;
      const flap = Math.sin(t * bf.flap + bf.phase) * 1.0;
      bf.left.rotation.z = -flap;
      bf.right.rotation.z = flap;
    }

    // Fireflies — glow with the stars.
    this.fireflyMat.opacity = palette.starAlpha * 0.95;
    if (palette.starAlpha > 0.02) {
      const attr = this.fireflies.geometry.attributes.position;
      for (let i = 0; i < this.fireflyBase.length; i++) {
        const f = this.fireflyBase[i];
        f.b.z += ds;
        if (f.b.z > 14) {
          f.b.set((Math.random() < 0.5 ? -1 : 1) * rnd(4.8, 22), rnd(0.4, 2.6), -160);
        }
        attr.setXYZ(
          i,
          f.b.x + Math.sin(t * f.speed + f.phase) * 1.1,
          f.b.y + Math.sin(t * f.speed * 1.7 + f.phase * 3) * 0.45,
          f.b.z + Math.cos(t * f.speed * 0.8 + f.phase) * 0.9
        );
      }
      attr.needsUpdate = true;
    }

    // Birds — day skies only; they roost when the stars come out.
    this.birdMat.opacity = Math.max(0, 0.9 - palette.starAlpha * 1.6);
    for (const flock of this.flocks) {
      flock.group.position.x += flock.speed * dt;
      flock.group.position.y += Math.sin(t * 0.5) * dt * 0.4;
      if (Math.abs(flock.group.position.x) > 200) {
        flock.speed = -flock.speed * rnd(0.9, 1.1);
        flock.group.position.y = rnd(20, 34);
        flock.group.position.z = rnd(-190, -70);
      }
      flock.group.rotation.y = flock.speed > 0 ? Math.PI / 2 : -Math.PI / 2;
      for (const b of flock.birds) {
        const flap = Math.sin(t * 7 + b.phase) * 0.7;
        b.wl.rotation.z = -flap;
        b.wr.rotation.z = flap;
      }
    }
  }
}
