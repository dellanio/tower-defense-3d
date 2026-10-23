/* ══════════════════════════════════════════════════════════
   TORRES — Canhão a Vapor, Bobina Tesla, Fornalha
   Geometrias e materiais compartilhados; só os grupos são por torre.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TOWERS, PLATE_TOP, MAX_LEVEL, levelMul, gridToWorld, upgradeCost, sellValue } from './config.js';
import { M } from './materials.js';

/* ── geometrias compartilhadas ── */
const G = {
  cBase: new THREE.CylinderGeometry(0.85, 0.98, 0.5, 8),
  trim: new THREE.TorusGeometry(0.9, 0.06, 8, 32),
  cHouse: new RoundedBoxGeometry(1.0, 0.6, 0.95, 2, 0.1),
  cBoiler: new THREE.SphereGeometry(0.38, 20, 14),
  cBarrel: new THREE.CylinderGeometry(0.15, 0.2, 1.3, 16).rotateZ(-Math.PI / 2).translate(0.55, 0, 0),
  cMuzzle: new THREE.TorusGeometry(0.19, 0.06, 8, 20).rotateY(Math.PI / 2).translate(1.2, 0, 0),
  cBand: new THREE.TorusGeometry(0.2, 0.04, 6, 18).rotateY(Math.PI / 2).translate(0.2, 0, 0),
  pipe: new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8),
  gauge: new THREE.CylinderGeometry(0.13, 0.13, 0.05, 16).rotateX(Math.PI / 2),

  tBase: new THREE.CylinderGeometry(0.8, 0.95, 0.45, 10),
  tCol: new THREE.CylinderGeometry(0.18, 0.26, 1.7, 12),
  tCoil: new THREE.TorusGeometry(0.34, 0.055, 8, 28).rotateX(Math.PI / 2),
  tCore: new THREE.SphereGeometry(0.26, 18, 12),
  tCage: new THREE.TorusGeometry(0.42, 0.035, 6, 30),
  tProng: new THREE.CylinderGeometry(0.03, 0.04, 0.7, 6),
  tTip: new THREE.SphereGeometry(0.075, 10, 8),

  fBody: new RoundedBoxGeometry(1.35, 0.85, 1.35, 2, 0.12),
  fGrate: new THREE.BoxGeometry(0.05, 0.3, 0.72),
  fChim: new THREE.CylinderGeometry(0.13, 0.16, 0.85, 10),
  fTank: new THREE.CapsuleGeometry(0.2, 0.75, 6, 12).rotateZ(Math.PI / 2),
  fMount: new THREE.CylinderGeometry(0.3, 0.36, 0.3, 14),
  fNozzle: new THREE.CylinderGeometry(0.09, 0.15, 0.9, 12).rotateZ(-Math.PI / 2).translate(0.5, 0, 0),
  fRing: new THREE.TorusGeometry(0.12, 0.04, 6, 16).rotateY(Math.PI / 2).translate(0.95, 0, 0),
  fPilot: new THREE.SphereGeometry(0.07, 8, 6),

  lvl: new THREE.TorusGeometry(0.96, 0.05, 6, 32).rotateX(Math.PI / 2),
  shell: new THREE.SphereGeometry(0.17, 12, 8)
};

function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = shadow;
  return m;
}

/** monta o modelo; `ov` substitui todos os materiais (fantasma de construção) */
export function buildModel(type, ov = null) {
  const g = new THREE.Group();
  const P = new THREE.Group();          // pivô do giro
  const mat = m => ov || m;
  const parts = { pivot: P };

  if (type === 'cannon') {
    g.add(mesh(G.cBase, mat(M.iron), 0, 0.25, 0));
    const tr = mesh(G.trim, mat(M.brass), 0, 0.5, 0); tr.rotation.x = Math.PI / 2; g.add(tr);
    P.position.y = 0.55; g.add(P);
    P.add(mesh(G.cHouse, mat(M.copper), 0, 0.3, 0));
    P.add(mesh(G.cBoiler, mat(M.brass), -0.45, 0.45, 0));
    for (const z of [-0.28, 0.28]) P.add(mesh(G.pipe, mat(M.copper), -0.2, 0.82, z));
    P.add(mesh(G.gauge, mat(M.glass), 0.05, 0.36, 0.49, false));
    const barrel = new THREE.Group(); barrel.position.set(0.35, 0.38, 0); P.add(barrel);
    barrel.add(mesh(G.cBarrel, mat(M.steel)), mesh(G.cMuzzle, mat(M.brass)), mesh(G.cBand, mat(M.brass)));
    parts.barrel = barrel;
    parts.muzzle = new THREE.Object3D(); parts.muzzle.position.set(1.32, 0, 0); barrel.add(parts.muzzle);
  }

  if (type === 'tesla') {
    g.add(mesh(G.tBase, mat(M.ironDk), 0, 0.22, 0));
    const tr = mesh(G.trim, mat(M.brass), 0, 0.45, 0); tr.rotation.x = Math.PI / 2; tr.scale.setScalar(0.92); g.add(tr);
    g.add(mesh(G.tCol, mat(M.iron), 0, 1.25, 0));
    P.position.y = 0; g.add(P);
    for (let i = 0; i < 7; i++) P.add(mesh(G.tCoil, mat(M.copper), 0, 0.72 + i * 0.16, 0));
    const core = mesh(G.tCore, ov || M.teslaGlow, 0, 2.3, 0, false); core.userData.keep = true; g.add(core); parts.core = core;
    const cage = mesh(G.tCage, mat(M.brass), 0, 2.3, 0); cage.rotation.x = Math.PI / 2; g.add(cage);
    parts.tips = [];
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      const pr = mesh(G.tProng, mat(M.brass), Math.cos(a) * 0.5, 2.15, Math.sin(a) * 0.5);
      pr.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      g.add(pr);
      g.add(mesh(G.tTip, mat(M.steel), Math.cos(a) * 0.68, 2.47, Math.sin(a) * 0.68));
      const mark = new THREE.Object3D(); mark.position.set(Math.cos(a) * 0.68, 2.47, Math.sin(a) * 0.68);
      g.add(mark); parts.tips.push(mark);
    }
    parts.top = new THREE.Object3D(); parts.top.position.set(0, 2.3, 0); g.add(parts.top);
  }

  if (type === 'flame') {
    g.add(mesh(G.fBody, mat(M.iron), 0, 0.43, 0));
    for (const s of [1, -1]) {
      const gr = mesh(G.fGrate, ov || M.emberGlow, s * 0.68, 0.38, 0, false); g.add(gr);
    }
    g.add(mesh(G.fChim, mat(M.copper), -0.4, 1.2, -0.4));
    g.add(mesh(G.fTank, mat(M.steel), 0, 0.42, 0.66));
    P.position.y = 0.88; g.add(P);
    P.add(mesh(G.fMount, mat(M.brass), 0, 0.12, 0));
    const nz = new THREE.Group(); nz.position.y = 0.18; P.add(nz);
    nz.add(mesh(G.fNozzle, mat(M.steel)), mesh(G.fRing, mat(M.brass)));
    const pilot = mesh(G.fPilot, ov || M.emberGlow, 1.02, 0, 0, false); pilot.userData.keep = true; nz.add(pilot); parts.pilot = pilot;
    parts.muzzle = new THREE.Object3D(); parts.muzzle.position.set(1.05, 0, 0); nz.add(parts.muzzle);
    parts.chimTop = new THREE.Object3D(); parts.chimTop.position.set(-0.4, 1.7, -0.4); g.add(parts.chimTop);
  }

  /* mescla peças estáticas por material: ~20 malhas viram ~6 draw calls por torre */
  const key = type + (ov ? ':ghost' : '');
  mergeStatic(g, key + ':root');
  mergeStatic(P, key + ':pivot');
  for (const c of [...P.children]) if (c.isGroup) mergeStatic(c, key + ':sub');

  parts.levels = new THREE.Group(); g.add(parts.levels);
  g.userData.parts = parts;
  return g;
}

const mergedCache = new Map();
function mergeStatic(parent, key) {
  const byMat = new Map();
  for (const c of parent.children) {
    if (!c.isMesh || c.userData.keep) continue;
    if (!byMat.has(c.material)) byMat.set(c.material, []);
    byMat.get(c.material).push(c);
  }
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    const k = key + ':' + mat.uuid;
    let geo = mergedCache.get(k);
    if (!geo) {
      geo = mergeGeometries(list.map(m => {
        m.updateMatrix();
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
        return g.applyMatrix4(m.matrix);
      }));
      mergedCache.set(k, geo);
    }
    for (const m of list) parent.remove(m);
    const shadow = list.some(m => m.castShadow);
    parent.add(mesh(geo, mat, 0, 0, 0, shadow));
  }
}

export const TSCALE = 1.18;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3();
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export class Towers {
  constructor(scene, fx, enemies, map, audio) {
    this.scene = scene; this.fx = fx; this.enemies = enemies; this.map = map; this.audio = audio;
    this.list = [];
    this.byCell = new Map();
    this.flameActive = 0;

    /* projéteis do canhão: um InstancedMesh */
    this.shells = [];
    this.shellMesh = new THREE.InstancedMesh(G.shell, M.emberGlow, 160);
    this.shellMesh.count = 0; this.shellMesh.frustumCulled = false;
    this.shellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.shellMesh);
  }

  stats(t) {
    const d = TOWERS[t.type], k = levelMul(t.level);
    return { ...d, dmg: d.dmg * k.dmg, range: d.range + k.range, burn: (d.burn || 0) * k.dmg };
  }

  at(c, r) { return this.byCell.get(c + ',' + r) || null; }

  build(type, c, r) {
    const p = gridToWorld(c, r);
    const g = buildModel(type);
    g.position.set(p.x, PLATE_TOP, p.z);
    g.scale.setScalar(TSCALE);
    this.scene.add(g);
    const t = { type, c, r, level: 1, group: g, parts: g.userData.parts, pos: new THREE.Vector3(p.x, PLATE_TOP, p.z),
      cd: 0.4, yaw: Math.random() * 6.28, spawn: 0, recoil: 0, target: null, firing: 0, charge: 0, arcT: Math.random() };
    t.parts.pivot.rotation.y = t.yaw;
    this.list.push(t);
    this.byCell.set(c + ',' + r, t);
    this.audio.build();
    return t;
  }

  upgrade(t) {
    if (t.level >= MAX_LEVEL) return;
    t.level++;
    const ring = mesh(G.lvl, M.brass, 0, 0.08 + t.level * 0.13, 0);
    ring.scale.setScalar(1 - t.level * 0.04);
    t.parts.levels.add(ring);
    t.spawn = 0.55;
    this.fx.rings.spawn(_v.copy(t.pos).setY(PLATE_TOP + 0.05), new THREE.Color(3, 2.2, 1), 0.4, 2.6, 0.7);
    this.fx.sparks(_v.copy(t.pos).setY(PLATE_TOP + 1.2), 40, this.fx.PAL.sparkA, this.fx.PAL.sparkB, 3.5);
    this.audio.upgrade();
  }

  sell(t) {
    this.scene.remove(t.group);
    this.list.splice(this.list.indexOf(t), 1);
    this.byCell.delete(t.c + ',' + t.r);
    this.fx.smokePuff(_v.copy(t.pos).setY(PLATE_TOP + 0.4), 8, 0.8, 1.2);
    this.fx.sparks(_v, 30);
    this.audio.sell();
    return sellValue(t.type, t.level);
  }

  pickTarget(t, range) {
    let best = null, bd = -1;
    const r2 = range * range;
    for (const e of this.enemies.list) {
      if (!e.alive || e.dist < 0.2) continue;
      const dx = e.pos.x - t.pos.x, dz = e.pos.z - t.pos.z;
      if (dx * dx + dz * dz <= r2 && e.dist > bd) { bd = e.dist; best = e; }
    }
    return best;
  }

  /* ── passo de simulação (tempo fixo) ── */
  step(dt) {
    this.flameActive = 0;
    for (const t of this.list) {
      const S = this.stats(t);
      t.cd -= dt;
      if (t.target && (!t.target.alive || t.target.pos.distanceToSquared(t.pos) > S.range * S.range)) t.target = null;
      if (!t.target || t.type !== 'flame') t.target = this.pickTarget(t, S.range) || null;
      const e = t.target;
      t.firing = Math.max(0, t.firing - dt * 3);

      if (e && t.type !== 'tesla') {
        const want = Math.atan2(-(e.pos.z - t.pos.z), e.pos.x - t.pos.x);
        let d = want - t.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        t.yaw += d * Math.min(1, dt * (t.type === 'flame' ? 10 : 7));
        t.aligned = Math.abs(d) < 0.22;
      }

      if (t.type === 'cannon' && e && t.cd <= 0 && t.aligned) { t.cd = S.rate; this.fireCannon(t, e, S); }
      if (t.type === 'tesla') {
        t.charge = Math.min(1, t.charge + dt / S.rate);
        if (e && t.cd <= 0) { t.cd = S.rate; t.charge = 0; this.fireTesla(t, e, S); }
      }
      if (t.type === 'flame' && e && t.aligned) { t.firing = 1; this.flameActive++; this.burnCone(t, S, dt); }
    }
    this.stepShells(dt);
  }

  fireCannon(t, e, S) {
    t.parts.muzzle.getWorldPosition(_v);
    const flight = 0.45 + _v.distanceTo(e.pos) / 16;
    const aim = new THREE.Vector3();
    this.map.pointAt(Math.min(this.map.pathLength, e.dist + e.speed * (e.slowT > 0 ? 1 - e.slowK : 1) * flight), aim);
    aim.x += Math.sin(e.yaw) * e.lane; aim.z += Math.cos(e.yaw) * e.lane;
    this.shells.push({ a: _v.clone(), b: aim, t: 0, dur: flight, arc: 1.2 + flight * 2.2, dmg: S.dmg, splash: S.splash, trail: 0 });
    t.recoil = 1;
    _d.subVectors(_v, t.pos).setY(0).normalize();
    this.fx.flashes.spawn(_v, 0xffa050, 40, 0.12, 7);
    for (let i = 0; i < 18; i++) {
      this.fx.add.emit(_v.x, _v.y, _v.z, _d.x * (3 + Math.random() * 5) + (Math.random() - .5) * 2, Math.random() * 2, _d.z * (3 + Math.random() * 5) + (Math.random() - .5) * 2,
        0.18 + Math.random() * 0.15, 0.5, 0.1, this.fx.PAL.fireA, this.fx.PAL.fireB, 0, 4);
    }
    this.fx.smokePuff(_v, 4, 0.55, 0.9, this.fx.PAL.steamA, this.fx.PAL.steamB, 1.4);
    this.audio.cannon();
  }

  stepShells(dt) {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.t += dt / s.dur;
      const u = Math.min(1, s.t);
      s.p = s.p || new THREE.Vector3();
      s.p.lerpVectors(s.a, s.b, u); s.p.y += s.arc * 4 * u * (1 - u);
      s.trail -= dt;
      if (s.trail <= 0) {
        s.trail = 0.02;
        this.fx.smoke.emit(s.p.x, s.p.y, s.p.z, 0, 0.2, 0, 0.9, 0.25, 0.9, this.fx.PAL.smokeA, this.fx.PAL.smokeB, -0.1, 0.5, 0.05);
        this.fx.add.emit(s.p.x, s.p.y, s.p.z, 0, 0, 0, 0.18, 0.5, 0.1, this.fx.PAL.fireA, this.fx.PAL.fireB, 0, 0);
      }
      if (u >= 1) {
        const r2 = s.splash * s.splash;
        for (const e of this.enemies.list) {
          if (!e.alive) continue;
          const dx = e.pos.x - s.b.x, dz = e.pos.z - s.b.z, d2 = dx * dx + dz * dz;
          if (d2 <= r2) this.enemies.hit(e, s.dmg * (1 - 0.5 * Math.sqrt(d2) / s.splash));
        }
        this.fx.explosion(_v.copy(s.b).setY(0.35), 0.8);
        this.audio.boom();
        this.shells.splice(i, 1);
      }
    }
  }

  fireTesla(t, first, S) {
    const hitList = [first];
    let cur = first;
    while (hitList.length < S.chain) {
      let nb = null, nd = S.chainRange * S.chainRange;
      for (const e of this.enemies.list) {
        if (!e.alive || hitList.includes(e)) continue;
        const d2 = e.pos.distanceToSquared(cur.pos);
        if (d2 < nd) { nd = d2; nb = e; }
      }
      if (!nb) break;
      hitList.push(nb); cur = nb;
    }
    t.parts.top.getWorldPosition(_v);
    const from = _v.clone();
    let dmg = S.dmg;
    for (const e of hitList) {
      _w.copy(e.pos); _w.y += e.type === 'tank' ? 1.0 : 1.05;
      this.fx.bolts.fire(from, _w, 0.18, 0.55);
      this.fx.sparks(_w, 14, this.fx.PAL.teslaA, this.fx.PAL.teslaB, 3);
      e.slowT = 1.2; e.slowK = S.slow;
      this.enemies.hit(e, dmg);
      dmg *= 0.75;
      from.copy(_w);
    }
    t.parts.top.getWorldPosition(_v);
    this.fx.flashes.spawn(_v, 0x5effd8, 45, 0.2, 10);
    this.audio.zap();
  }

  burnCone(t, S, dt) {
    const fx = Math.cos(t.yaw), fz = -Math.sin(t.yaw);
    const cosA = Math.cos(S.cone);
    for (const e of this.enemies.list) {
      if (!e.alive) continue;
      const dx = e.pos.x - t.pos.x, dz = e.pos.z - t.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > S.range + e.def.radius || d < 0.01) continue;
      if ((dx * fx + dz * fz) / d < cosA) continue;
      e.burnT = S.burnTime; e.burnDps = S.burn;
      this.enemies.hit(e, S.dmg * dt);
    }
  }

  /* ── animação por quadro (não afeta o jogo) ── */
  animate(dt, time) {
    for (const t of this.list) {
      const P = t.parts;
      P.pivot.rotation.y = t.type === 'tesla' ? P.pivot.rotation.y + dt * (0.4 + t.charge * 2) : t.yaw;

      if (t.spawn < 1) {
        t.spawn = Math.min(1, t.spawn + dt / 0.55);
        const k = easeOutBack(t.spawn);
        t.group.scale.setScalar(Math.max(0.001, k) * TSCALE);
        t.group.position.y = PLATE_TOP + (1 - Math.min(1, t.spawn * 1.4)) * 2.2;
        if (t.spawn >= 1) {
          this.fx.rings.spawn(_v.copy(t.pos).setY(PLATE_TOP + 0.03), new THREE.Color(1.6, 1.3, 0.9), 0.5, 2.0, 0.5);
          this.fx.smokePuff(_v, 6, 0.6, 0.5, this.fx.PAL.smokeA, this.fx.PAL.smokeB, 1.5);
        }
      }

      if (t.type === 'cannon') {
        t.recoil = Math.max(0, t.recoil - dt * 4);
        P.barrel.position.x = 0.35 - t.recoil * t.recoil * 0.32;
      }
      if (t.type === 'tesla') {
        const s = 0.7 + t.charge * 0.5 + Math.sin(time * 30) * 0.04 * t.charge;
        P.core.scale.setScalar(s);
        t.arcT -= dt;
        if (t.arcT <= 0) {
          t.arcT = 0.15 + Math.random() * 0.5 * (1.4 - t.charge);
          const tip = P.tips[(Math.random() * 3) | 0];
          P.top.getWorldPosition(_v); tip.getWorldPosition(_w);
          this.fx.bolts.fire(_v, _w, 0.07, 0.12);
        }
      }
      if (t.type === 'flame') {
        P.pilot.scale.setScalar(0.8 + Math.random() * 0.5 + t.firing);
        if (t.firing > 0.5) {
          P.muzzle.getWorldPosition(_v);
          _d.set(Math.cos(t.yaw), 0, -Math.sin(t.yaw));
          this.fx.flame(_v, _d, this.stats(t).range);
          if (Math.random() < 0.3) this.fx.flashes.spawn(_v, 0xff7a2a, 22, 0.1, 6);
        }
        if (Math.random() < dt * 2.5) {
          P.chimTop.getWorldPosition(_v);
          this.fx.smokePuff(_v, 1, 0.3, 1.2, this.fx.PAL.smokeA, this.fx.PAL.smokeB, 1.8);
        }
      }
    }
    /* projéteis */
    let n = 0; const m4 = new THREE.Matrix4();
    for (const s of this.shells) { if (s.p) { m4.makeTranslation(s.p.x, s.p.y, s.p.z); this.shellMesh.setMatrixAt(n++, m4); } }
    this.shellMesh.count = n;
    this.shellMesh.instanceMatrix.needsUpdate = true;
  }

  upgradeCost(t) { return t.level >= MAX_LEVEL ? null : upgradeCost(t.type, t.level); }
  sellValue(t) { return sellValue(t.type, t.level); }

  clear() {
    for (const t of [...this.list]) this.scene.remove(t.group);
    this.list.length = 0; this.byCell.clear(); this.shells.length = 0;
  }
}
