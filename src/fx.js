/* ══════════════════════════════════════════════════════════
   EFEITOS — partículas simuladas na GPU, raios, anéis, clarões, fuligem
   Tudo em pool de tamanho fixo: nada é alocado durante o jogo.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { scorchTexture } from './textures.js';

/* ── Partículas: o CPU só grava o nascimento; a trajetória é calculada no shader ── */
const PVERT = /* glsl */`
  uniform float uTime, uScale;
  attribute vec3 aVel; attribute vec4 aT; attribute vec3 aColA; attribute vec3 aColB; attribute vec3 aPhys;
  varying vec3 vCol; varying float vA; varying float vSeed;
  void main(){
    float age = uTime - aT.x;
    float t = age / aT.y;
    if (t < 0.0 || t > 1.0){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
    float drag = aPhys.y;
    float k = drag > 0.001 ? (1.0 - exp(-drag * age)) / drag : age;
    vec3 p = position + aVel * k;
    p.y -= 0.5 * aPhys.x * age * age;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = mix(aT.z, aT.w, t) * uScale / -mv.z;
    vCol = mix(aColA, aColB, t);
    vA = (1.0 - t) * smoothstep(0.0, aPhys.z, t);
    vSeed = aT.x * 13.7;
  }`;
const PFRAG_ADD = /* glsl */`
  varying vec3 vCol; varying float vA;
  void main(){
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(1.0 - d, 0.0), 2.0) * vA;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vCol * a, a);
  }`;
const PFRAG_SMOKE = /* glsl */`
  uniform vec3 uTint; varying vec3 vCol; varying float vA; varying float vSeed;
  void main(){
    vec2 q = gl_PointCoord - 0.5;
    float d = length(q) * 2.0;
    float n = sin(q.x * 11.0 + vSeed) * sin(q.y * 9.0 - vSeed * 0.7) * 0.18;
    float a = smoothstep(1.0, 0.25, d + n) * vA * 0.55;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vCol * uTint, a);
  }`;

export class Particles {
  constructor(scene, max, kind = 'add') {
    this.max = max; this.i = 0; this.lo = Infinity; this.hi = -1;
    const g = new THREE.BufferGeometry();
    const A = (n) => new THREE.BufferAttribute(new Float32Array(max * n), n).setUsage(THREE.DynamicDrawUsage);
    this.a = { position: A(3), aVel: A(3), aT: A(4), aColA: A(3), aColB: A(3), aPhys: A(3) };
    for (const k in this.a) g.setAttribute(k, this.a[k]);
    for (let i = 0; i < max; i++) this.a.aT.array[i * 4 + 1] = 1e-3; // nasce morta
    this.uniforms = { uTime: { value: 0 }, uScale: { value: 600 }, uTint: { value: new THREE.Color(1, 1, 1) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: PVERT,
      fragmentShader: kind === 'add' ? PFRAG_ADD : PFRAG_SMOKE,
      transparent: true, depthWrite: false,
      blending: kind === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = kind === 'add' ? 3 : 2;
    scene.add(this.points);
    this.time = 0;
  }
  /** fadeIn = fração da vida usada para aparecer (fumaça) */
  emit(px, py, pz, vx, vy, vz, life, s0, s1, ca, cb, gravity = 0, drag = 0, fadeIn = 0.02) {
    const i = this.i; this.i = (this.i + 1) % this.max;
    const a = this.a, j = i * 3, q = i * 4;
    const P = a.position.array, V = a.aVel.array, T = a.aT.array, CA = a.aColA.array, CB = a.aColB.array, F = a.aPhys.array;
    P[j] = px; P[j + 1] = py; P[j + 2] = pz;
    V[j] = vx; V[j + 1] = vy; V[j + 2] = vz;
    T[q] = this.time; T[q + 1] = life; T[q + 2] = s0; T[q + 3] = s1;
    CA[j] = ca.r; CA[j + 1] = ca.g; CA[j + 2] = ca.b;
    CB[j] = cb.r; CB[j + 1] = cb.g; CB[j + 2] = cb.b;
    F[j] = gravity; F[j + 1] = drag; F[j + 2] = fadeIn;
    if (i < this.lo) this.lo = i;
    if (i > this.hi) this.hi = i;
  }
  update(time, scale) {
    this.time = time;
    this.uniforms.uTime.value = time;
    this.uniforms.uScale.value = scale;
    if (this.hi < 0) return;
    for (const k in this.a) {
      const at = this.a[k];
      at.clearUpdateRanges();
      at.addUpdateRange(this.lo * at.itemSize, (this.hi - this.lo + 1) * at.itemSize);
      at.needsUpdate = true;
    }
    this.lo = Infinity; this.hi = -1;
  }
}

/* ── Raios Tesla: polilinhas recalculadas a cada quadro enquanto vivem ── */
const BOLT_PTS = 18;
export class Bolts {
  constructor(scene, max = 24) {
    this.list = [];
    const core = new THREE.LineBasicMaterial({ color: new THREE.Color(2.6, 4.2, 4.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.LineBasicMaterial({ color: new THREE.Color(0.25, 1.6, 1.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < max; i++) {
      const mk = (mat) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BOLT_PTS * 3), 3).setUsage(THREE.DynamicDrawUsage));
        const l = new THREE.Line(g, mat); l.frustumCulled = false; l.visible = false; l.renderOrder = 4;
        scene.add(l); return l;
      };
      this.list.push({ a: new THREE.Vector3(), b: new THREE.Vector3(), life: 0, max: 0, amp: 0, lines: [mk(core), mk(halo), mk(halo)] });
    }
  }
  fire(a, b, life = 0.16, amp = 0.45) {
    const s = this.list.find(x => x.life <= 0) || this.list[0];
    s.a.copy(a); s.b.copy(b); s.life = s.max = life; s.amp = amp;
    for (const l of s.lines) l.visible = true;
  }
  update(dt) {
    const d = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3();
    for (const s of this.list) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) { for (const l of s.lines) l.visible = false; continue; }
      d.subVectors(s.b, s.a);
      side.set(-d.z, 0, d.x).normalize();
      up.crossVectors(d, side).normalize();
      s.lines.forEach((l, li) => {
        const arr = l.geometry.attributes.position.array;
        const amp = s.amp * (li === 0 ? 1 : 1.5);
        for (let i = 0; i < BOLT_PTS; i++) {
          const t = i / (BOLT_PTS - 1);
          const env = Math.sin(t * Math.PI);
          const j1 = (Math.random() - 0.5) * amp * env, j2 = (Math.random() - 0.5) * amp * env;
          arr[i * 3]     = s.a.x + d.x * t + side.x * j1 + up.x * j2;
          arr[i * 3 + 1] = s.a.y + d.y * t + side.y * j1 + up.y * j2;
          arr[i * 3 + 2] = s.a.z + d.z * t + side.z * j1 + up.z * j2;
        }
        l.geometry.attributes.position.needsUpdate = true;
        l.material.opacity = Math.min(1, s.life / s.max * 2);
      });
    }
  }
}

/* ── Anéis de choque (pool) ── */
export class Rings {
  constructor(scene, max = 24) {
    this.list = [];
    const geo = new THREE.RingGeometry(0.82, 1, 64);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < max; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; m.renderOrder = 3;
      scene.add(m);
      this.list.push({ m, t: 1, dur: 1, r0: 0, r1: 1 });
    }
  }
  spawn(pos, color, r0, r1, dur = 0.6) {
    const s = this.list.find(x => x.t >= 1) || this.list[0];
    s.m.position.copy(pos); s.m.material.color.copy(color);
    s.t = 0; s.dur = dur; s.r0 = r0; s.r1 = r1; s.m.visible = true;
  }
  update(dt) {
    for (const s of this.list) {
      if (s.t >= 1) continue;
      s.t = Math.min(1, s.t + dt / s.dur);
      const e = 1 - Math.pow(1 - s.t, 3);
      s.m.scale.setScalar(s.r0 + (s.r1 - s.r0) * e);
      s.m.material.opacity = 1 - s.t;
      if (s.t >= 1) s.m.visible = false;
    }
  }
}

/* ── Clarões: poucas PointLights reaproveitadas (luz dinâmica real nos metais) ── */
export class Flashes {
  constructor(scene, n = 4) {
    this.list = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 9, 2);
      scene.add(l);
      this.list.push({ l, t: 0, dur: 1, peak: 0 });
    }
  }
  spawn(pos, color, peak, dur = 0.18, dist = 9) {
    let s = this.list[0];
    for (const x of this.list) if (x.l.intensity < s.l.intensity) s = x;
    s.l.position.copy(pos); s.l.color.set(color); s.l.distance = dist;
    s.peak = peak; s.t = 0; s.dur = dur; s.l.intensity = peak;
  }
  update(dt) {
    for (const s of this.list) {
      if (s.l.intensity <= 0) continue;
      s.t += dt;
      const k = 1 - s.t / s.dur;
      s.l.intensity = k > 0 ? s.peak * k * k : 0;
    }
  }
}

/* ── Fuligem no chão depois das explosões ── */
export class Scorch {
  constructor(scene, max = 40) {
    this.list = []; this.i = 0;
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const tex = scorchTexture();
    for (let n = 0; n < max; n++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.visible = false; m.renderOrder = 1;
      scene.add(m);
      this.list.push({ m, life: 0 });
    }
  }
  spawn(x, y, z, size) {
    const s = this.list[this.i]; this.i = (this.i + 1) % this.list.length;
    s.m.position.set(x, y + 0.012, z); s.m.scale.setScalar(size); s.m.rotation.y = Math.random() * 6.28;
    s.life = 9; s.m.visible = true;
  }
  update(dt) {
    for (const s of this.list) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.m.material.opacity = Math.min(0.8, s.life / 3);
      if (s.life <= 0) s.m.visible = false;
    }
  }
}

/* ── Fachada que as torres/inimigos usam ── */
export function createFX(scene) {
  const add = new Particles(scene, 9000, 'add');
  const smoke = new Particles(scene, 3500, 'smoke');
  const bolts = new Bolts(scene);
  const rings = new Rings(scene);
  const flashes = new Flashes(scene, 4);
  const scorch = new Scorch(scene);

  const C = (r, g, b) => new THREE.Color(r, g, b);
  const PAL = {
    fireA: C(3.6, 1.5, 0.35), fireB: C(1.0, 0.16, 0.02), coreA: C(5, 3.2, 1.4),
    sparkA: C(4.5, 2.8, 1.1), sparkB: C(2.2, 0.45, 0.06),
    teslaA: C(2.5, 6, 5.5), teslaB: C(0.1, 1.4, 1.1),
    smokeA: C(0.42, 0.4, 0.38), smokeB: C(0.16, 0.15, 0.15),
    steamA: C(0.9, 0.9, 0.92), steamB: C(0.6, 0.62, 0.66),
    emberA: C(5, 2, 0.5), emberB: C(1.2, 0.1, 0)
  };
  const R = (a) => (Math.random() - 0.5) * 2 * a;

  const api = {
    add, smoke, bolts, rings, flashes, scorch, PAL,
    explosion(p, scale = 1) {
      for (let i = 0; i < 60 * scale; i++) {
        const th = Math.random() * 6.283, sp = 2 + Math.random() * 7 * scale;
        add.emit(p.x, p.y, p.z, Math.cos(th) * sp, 1.5 + Math.random() * 7, Math.sin(th) * sp, 0.5 + Math.random() * 0.7, 0.22, 0.05, PAL.sparkA, PAL.sparkB, 14, 0.8);
      }
      for (let i = 0; i < 22 * scale; i++) {
        add.emit(p.x + R(0.3), p.y + R(0.25), p.z + R(0.3), R(3.2), 0.6 + Math.random() * 2.8, R(3.2), 0.22 + Math.random() * 0.26, 1.1 * scale, 0.25 * scale, PAL.fireA, PAL.fireB, -2, 4);
      }
      add.emit(p.x, p.y + 0.2, p.z, 0, 0.5, 0, 0.16, 3.2 * scale, 0.6 * scale, PAL.coreA, PAL.fireB, 0, 0);
      for (let i = 0; i < 14 * scale; i++) {
        smoke.emit(p.x + R(0.6), p.y + 0.3, p.z + R(0.6), R(1.2), 1.2 + Math.random() * 1.6, R(1.2), 2.2 + Math.random() * 1.6, 1.4 * scale, 4.2 * scale, PAL.smokeA, PAL.smokeB, -0.3, 1.2, 0.08);
      }
      rings.spawn(new THREE.Vector3(p.x, 0.12, p.z), C(3, 1.4, 0.4), 0.3, 2.8 * scale, 0.55);
      flashes.spawn(p, 0xff8a3a, 60 * scale, 0.28, 10);
      scorch.spawn(p.x, 0.08, p.z, 2.4 * scale);
    },
    sparks(p, n, colA = PAL.sparkA, colB = PAL.sparkB, speed = 4) {
      for (let i = 0; i < n; i++) {
        add.emit(p.x, p.y, p.z, R(speed), Math.random() * speed, R(speed), 0.25 + Math.random() * 0.45, 0.14, 0.03, colA, colB, 12, 0.5);
      }
    },
    smokePuff(p, n = 1, size = 1, vy = 1.4, tint = PAL.smokeA, tintB = PAL.smokeB, life = 3) {
      for (let i = 0; i < n; i++) {
        smoke.emit(p.x + R(0.15), p.y, p.z + R(0.15), R(0.3), vy * (0.7 + Math.random() * 0.6), R(0.3), life * (0.7 + Math.random() * 0.6), 0.8 * size, 3.6 * size, tint, tintB, -0.15, 0.6, 0.12);
      }
    },
    flame(p, dir, range) {
      for (let i = 0; i < 8; i++) {
        const sp = range * (1.5 + Math.random() * 0.6);
        const sx = dir.x + R(0.2), sz = dir.z + R(0.2);
        add.emit(p.x, p.y, p.z, sx * sp, 0.3 + Math.random() * 0.8, sz * sp, 0.42 + Math.random() * 0.22, 0.3, 2.1, PAL.fireA, PAL.fireB, -2.5, 1.3);
      }
      add.emit(p.x, p.y, p.z, dir.x * range * 1.2, 0.1, dir.z * range * 1.2, 0.14, 0.35, 0.7, PAL.coreA, PAL.fireA, 0, 2);
      if (Math.random() < 0.35) smoke.emit(p.x + dir.x * range * 0.8, p.y + 0.6, p.z + dir.z * range * 0.8, dir.x, 1.6, dir.z, 2.2, 1, 3.4, PAL.smokeA, PAL.smokeB, -0.2, 0.8, 0.15);
    },
    update(dt, time, scale) {
      add.update(time, scale); smoke.update(time, scale);
      bolts.update(dt); rings.update(dt); flashes.update(dt); scorch.update(dt);
    }
  };
  return api;
}
