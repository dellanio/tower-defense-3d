/* ══════════════════════════════════════════════════════════
   INIMIGOS — cada peça de cada tipo é UM InstancedMesh.
   200 inimigos = ~12 draw calls, não 1.200.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ENEMIES, PATH_TOP } from './config.js';
import { EM, M } from './materials.js';

const MAX = { drone: 420, tank: 220 };
const _m = new THREE.Matrix4(), _base = new THREE.Matrix4(), _l = new THREE.Matrix4(), _r = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();
const SCALE = { drone: 1.2, tank: 1.3 };
const _ahead = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

const Mt = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

export class Enemies {
  constructor(scene, map, fx) {
    this.map = map; this.fx = fx;
    this.list = [];        // vivos
    this.free = [];        // pool
    this.parts = { drone: [], tank: [] };

    const part = (type, geo, mat, local, { tint = false, shadow = true, copies = null, dyn = null } = {}) => {
      const n = MAX[type] * (copies ? copies.length : 1);
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.count = 0; im.frustumCulled = false;
      im.castShadow = shadow; im.receiveShadow = false;
      if (tint) { im.setColorAt(0, _c.setRGB(1, 1, 1)); }
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(im);
      this.parts[type].push({ im, local, tint, copies, dyn });
    };

    /* Vespa — drone pairando */
    part('drone', new THREE.SphereGeometry(0.42, 18, 12), EM.droneBody, Mt(0, 0, 0).multiply(new THREE.Matrix4().makeScale(1.05, 0.86, 1)), { tint: true });
    part('drone', new THREE.TorusGeometry(0.58, 0.05, 6, 28), EM.droneRing, null,
      { dyn: (e, t, out) => out.makeRotationY(t * 3 + e.phase).multiply(_r.makeRotationX(Math.PI / 2 + 0.38)) });
    part('drone', new THREE.SphereGeometry(0.12, 8, 6), M.redEye, Mt(0.36, 0.04, 0), { shadow: false });
    part('drone', new THREE.BoxGeometry(1.35, 0.025, 0.12), M.steel, null,
      { dyn: (e, t, out) => out.makeRotationY(t * 34 + e.phase).setPosition(0, 0.5, 0) });
    part('drone', new THREE.CylinderGeometry(0.07, 0.09, 0.16, 10), M.brass, Mt(0, 0.42, 0));
    part('drone', new THREE.SphereGeometry(0.13, 8, 6), M.emberGlow, Mt(0, -0.36, 0), { shadow: false });

    /* Couraçado — tanque a vapor */
    part('tank', new RoundedBoxGeometry(1.6, 0.55, 1.15, 2, 0.08), EM.tankHull, Mt(0, 0.6, 0), { tint: true });
    part('tank', new RoundedBoxGeometry(1.8, 0.42, 0.32, 2, 0.12), EM.tankDark, null, { copies: [Mt(0, 0.26, 0.56), Mt(0, 0.26, -0.56)] });
    part('tank', new THREE.CylinderGeometry(0.42, 0.52, 0.42, 14), EM.tankHull, Mt(-0.1, 1.08, 0), { tint: true });
    part('tank', new THREE.CylinderGeometry(0.08, 0.1, 0.9, 10), M.ironDk, new THREE.Matrix4().makeRotationZ(-Math.PI / 2).setPosition(0.55, 1.1, 0));
    part('tank', new THREE.CylinderGeometry(0.12, 0.15, 0.7, 12), M.copper, Mt(-0.62, 1.1, 0.3));
    part('tank', new THREE.BoxGeometry(0.06, 0.22, 0.78), EM.tankGrill, Mt(0.81, 0.58, 0), { shadow: false });
    part('tank', new THREE.TorusGeometry(0.47, 0.05, 6, 24), M.brass, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(-0.1, 0.9, 0));

    /* barras de vida — billboard no shader */
    this.hpMax = MAX.drone + MAX.tank;
    this.hpAttr = new THREE.InstancedBufferAttribute(new Float32Array(this.hpMax), 1).setUsage(THREE.DynamicDrawUsage);
    const hpGeo = new THREE.PlaneGeometry(1, 1);
    hpGeo.setAttribute('aHp', this.hpAttr);
    this.hpBars = new THREE.InstancedMesh(hpGeo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      vertexShader: /* glsl */`
        attribute float aHp; varying float vHp; varying vec2 vUv; varying float vW;
        void main(){
          vUv = uv; vHp = aHp;
          float w = instanceMatrix[0][0];
          vW = w;
          vec4 mv = viewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
          mv.xy += position.xy * vec2(w, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying float vHp; varying vec2 vUv; varying float vW;
        void main(){
          vec2 px = vec2(vUv.x * vW, vUv.y * 0.1);
          float border = step(px.x, 0.035) + step(vW - 0.035, px.x) + step(vUv.y, 0.22) + step(0.78, vUv.y);
          vec3 good = vec3(0.18, 0.95, 0.7), bad = vec3(1.0, 0.3, 0.12);
          vec3 fill = mix(bad, good, smoothstep(0.2, 0.7, vHp)) * 1.6;
          vec3 c = vUv.x < vHp ? fill : vec3(0.05, 0.06, 0.07);
          c = mix(c, vec3(0.0), clamp(border, 0.0, 1.0));
          gl_FragColor = vec4(c, 0.85);
        }`
    }), this.hpMax);
    this.hpBars.count = 0; this.hpBars.frustumCulled = false; this.hpBars.renderOrder = 10;
    scene.add(this.hpBars);
  }

  spawn(type, hpMul = 1) {
    const def = ENEMIES[type];
    let n = 0;
    for (const o of this.list) if (o.type === type) n++;
    if (n >= MAX[type]) return null;
    const e = this.free.pop() || { pos: new THREE.Vector3() };
    e.type = type; e.def = def;
    e.maxHp = e.hp = def.hp * hpMul;
    e.dist = -Math.random() * 0.6; e.speed = def.speed * (0.94 + Math.random() * 0.12);
    e.lane = (Math.random() - 0.5) * 0.7;
    e.phase = Math.random() * 6.28;
    e.yaw = 0; e.slowT = 0; e.slowK = 0; e.burnT = 0; e.burnDps = 0; e.flash = 0; e.smokeT = Math.random();
    e.alive = true; e.reached = false;
    this.map.pointAt(0, e.pos);
    this.list.push(e);
    return e;
  }

  /** dano; devolve true se matou */
  hit(e, amount) {
    if (!e.alive) return false;
    e.hp -= amount;
    e.flash = 1;
    if (e.hp <= 0) { this.kill(e); return true; }
    return false;
  }
  kill(e) {
    if (!e.alive) return;
    e.alive = false;
    const p = _v.copy(e.pos); p.y += e.type === 'tank' ? 0.7 : 1.0;
    this.fx.explosion(p, e.type === 'tank' ? 1.1 : 0.6);
    this.onKill && this.onKill(e);
  }

  update(dt, time) {
    const fx = this.fx;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (!e.alive) { this.list.splice(i, 1); this.free.push(e); continue; }

      if (e.burnT > 0) {
        e.burnT -= dt;
        e.hp -= e.burnDps * dt;
        if (Math.random() < dt * 14) fx.add.emit(e.pos.x + (Math.random() - .5) * .6, e.pos.y + 0.8, e.pos.z + (Math.random() - .5) * .6, 0, 1.6, 0, 0.45, 0.5, 0.1, fx.PAL.fireA, fx.PAL.fireB, -1, 0.5);
        if (e.hp <= 0) { this.kill(e); continue; }
      }
      if (e.slowT > 0) e.slowT -= dt;
      const sp = e.speed * (e.slowT > 0 ? 1 - e.slowK : 1);
      e.dist += sp * dt;
      if (e.dist >= this.map.pathLength) {
        e.alive = false; e.reached = true;
        this.onReach && this.onReach(e);
        continue;
      }
      this.map.pointAt(Math.max(0, e.dist), e.pos);
      this.map.pointAt(Math.max(0, e.dist) + 0.9, _ahead);
      _ahead.sub(e.pos);
      const target = Math.atan2(-_ahead.z, _ahead.x);
      let d = target - e.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      e.yaw += d * Math.min(1, dt * 7);
      // faixa lateral para não empilhar
      e.pos.x += Math.sin(e.yaw) * e.lane;
      e.pos.z += Math.cos(e.yaw) * e.lane;
      e.flash = Math.max(0, e.flash - dt * 7);

      if (e.type === 'tank') {
        e.smokeT -= dt;
        if (e.smokeT <= 0) {
          e.smokeT = 0.16;
          const c = Math.cos(e.yaw), s = Math.sin(e.yaw);
          _v.set(e.pos.x + (-0.62 * c + 0.3 * s), e.pos.y + 1.5, e.pos.z + (0.62 * s + 0.3 * c));
          fx.smokePuff(_v, 1, 0.35, 1.2, fx.PAL.smokeA, fx.PAL.smokeB, 1.6);
        }
      }
    }
  }

  /** grava matrizes das instâncias — chamado uma vez por quadro de render */
  sync(time) {
    let hp = 0;
    const all = this.allParts || (this.allParts = [...this.parts.drone, ...this.parts.tank]);
    for (const P of all) P.n = 0;
    for (const e of this.list) {
      if (!e.alive) continue;
      const bob = e.type === 'drone' ? 1.25 + Math.sin(time * 4 + e.phase) * 0.13 : PATH_TOP + Math.abs(Math.sin(time * 18 + e.phase)) * 0.02;
      _q.setFromAxisAngle(_up, e.yaw);
      _base.compose(_v.set(e.pos.x, bob, e.pos.z), _q, _s.setScalar(SCALE[e.type]));
      const burn = e.burnT > 0 ? 0.35 : 0;
      _c.setRGB(1 + e.flash * 2.2 + burn, 1 + e.flash * 1.9 - burn * 0.25, 1 + e.flash * 1.6 - burn * 0.6);
      for (const P of this.parts[e.type]) {
        if (P.copies) {
          for (const L of P.copies) { _m.multiplyMatrices(_base, L); P.im.setMatrixAt(P.n++, _m); }
          continue;
        }
        if (P.dyn) { P.dyn(e, time, _l); _m.multiplyMatrices(_base, _l); }
        else _m.multiplyMatrices(_base, P.local);
        if (P.tint) P.im.setColorAt(P.n, _c);
        P.im.setMatrixAt(P.n++, _m);
      }
      if (e.hp < e.maxHp) {
        const w = e.type === 'tank' ? 1.4 : 0.95;
        _m.makeScale(w, 1, 1).setPosition(e.pos.x, bob + (e.type === 'tank' ? 2.25 : 1.2), e.pos.z);
        this.hpBars.setMatrixAt(hp, _m);
        this.hpAttr.array[hp] = Math.max(0, e.hp / e.maxHp);
        hp++;
      }
    }
    for (const P of all) {
      P.im.count = P.n;
      P.im.instanceMatrix.needsUpdate = true;
      if (P.tint && P.im.instanceColor) P.im.instanceColor.needsUpdate = true;
    }
    this.hpBars.count = hp;
    this.hpBars.instanceMatrix.needsUpdate = true;
    this.hpAttr.needsUpdate = true;
  }

  clear() {
    for (const e of this.list) { e.alive = false; this.free.push(e); }
    this.list.length = 0;
  }
}
