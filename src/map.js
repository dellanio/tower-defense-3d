/* ══════════════════════════════════════════════════════════
   MAPA — piso de placas, esteira rebaixada, calha de metal fundido,
   chaminés, portão de entrada e o alto-forno que o jogador defende
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TILE, COLS, ROWS, PATH_POINTS, PLATE_TOP, PATH_TOP, gridToWorld, COL } from './config.js';
import { M, hdr, lampMat } from './materials.js';

export function buildMap(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const W = COLS * TILE, D = ROWS * TILE;

  /* ── células do caminho ── */
  const pathCells = new Set();
  const key = (c, r) => c + ',' + r;
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const [c0, r0] = PATH_POINTS[i], [c1, r1] = PATH_POINTS[i + 1];
    const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
    for (let c = c0, r = r0; ; c += dc, r += dr) {
      pathCells.add(key(c, r));
      if (c === c1 && r === r1) break;
    }
  }
  const isPath = (c, r) => pathCells.has(key(c, r));
  const inGrid = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;

  /* waypoints em mundo */
  const waypoints = PATH_POINTS.map(([c, r]) => { const p = gridToWorld(c, r); return new THREE.Vector3(p.x, PATH_TOP, p.z); });
  const segLen = []; let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) { const l = waypoints[i].distanceTo(waypoints[i + 1]); segLen.push(l); total += l; }

  /* ── laje base ── */
  {
    const slab = new THREE.Mesh(new RoundedBoxGeometry(W + 1.4, 1.6, D + 1.4, 3, 0.25), M.slab);
    slab.position.y = -0.8 + 0.001;
    slab.receiveShadow = true; slab.castShadow = true;
    root.add(slab);
    // friso de latão no perímetro
    const trimGeoX = new THREE.BoxGeometry(W + 1.2, 0.08, 0.12), trimGeoZ = new THREE.BoxGeometry(0.12, 0.08, D + 1.2);
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(trimGeoX, M.brass); a.position.set(0, -0.02, s * (D / 2 + 0.6)); root.add(a);
      const b = new THREE.Mesh(trimGeoZ, M.brass); b.position.set(s * (W / 2 + 0.6), -0.02, 0); root.add(b);
    }
  }

  /* ── piso externo de concreto ── */
  {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), M.concrete);
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.6;
    floor.receiveShadow = true;
    root.add(floor);
  }

  /* ── placas construíveis (instanciadas) ── */
  const buildCells = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!isPath(c, r)) buildCells.push([c, r]);
  {
    const geo = new RoundedBoxGeometry(TILE - 0.07, 0.5, TILE - 0.07, 2, 0.06);
    const im = new THREE.InstancedMesh(geo, M.plate, buildCells.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    buildCells.forEach(([c, r], i) => {
      const p = gridToWorld(c, r);
      const y = PLATE_TOP - 0.25 + (Math.random() - 0.5) * 0.025;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() * 4 | 0) * Math.PI / 2);
      m4.compose(new THREE.Vector3(p.x, y, p.z), q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m4);
      const v = 0.5 + Math.random() * 0.32;
      const rust = Math.random() < 0.16 ? 0.18 + Math.random() * 0.2 : 0;
      col.setRGB(v * (1 + rust), v * (1 - rust * 0.35), v * (1 - rust * 0.9));
      im.setColorAt(i, col);
    });
    im.receiveShadow = true; im.castShadow = false;
    root.add(im);
  }

  /* ── esteira: grades rebaixadas + trilhos + meio-fio de perigo ── */
  {
    const cells = [...pathCells].map(s => s.split(',').map(Number));
    const geo = new THREE.BoxGeometry(TILE, 0.16, TILE);
    const im = new THREE.InstancedMesh(geo, M.grate, cells.length);
    const m4 = new THREE.Matrix4();
    cells.forEach(([c, r], i) => { const p = gridToWorld(c, r); m4.makeTranslation(p.x, PATH_TOP - 0.08, p.z); im.setMatrixAt(i, m4); });
    im.receiveShadow = true;
    root.add(im);

    // meio-fio onde a esteira encosta em placa
    const curbs = [];
    for (const [c, r] of cells) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (isPath(nc, nr) || !inGrid(nc, nr)) continue;
        curbs.push([c, r, dc, dr]);
      }
    }
    const cg = new THREE.BoxGeometry(TILE, 0.42, 0.16);
    const cim = new THREE.InstancedMesh(cg, M.hazard, curbs.length);
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    curbs.forEach(([c, r, dc, dr], i) => {
      const p = gridToWorld(c, r);
      q.setFromAxisAngle(up, dc !== 0 ? Math.PI / 2 : 0);
      m4.compose(new THREE.Vector3(p.x + dc * (TILE / 2 - 0.02), 0.2, p.z + dr * (TILE / 2 - 0.02)), q, new THREE.Vector3(1, 1, 1));
      cim.setMatrixAt(i, m4);
    });
    cim.castShadow = true; cim.receiveShadow = true;
    root.add(cim);

    // trilhos contínuos por segmento
    const rails = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i], b = waypoints[i + 1];
      for (const off of [-0.62, 0.62]) rails.push([a, b, off]);
    }
    const rg = new THREE.BoxGeometry(1, 0.07, 0.09);
    const rim = new THREE.InstancedMesh(rg, M.steel, rails.length);
    rails.forEach(([a, b, off], i) => {
      const d = new THREE.Vector3().subVectors(b, a);
      const len = d.length() + 1.3;
      const yaw = Math.atan2(-d.z, d.x);
      const n = new THREE.Vector3(-d.z, 0, d.x).normalize().multiplyScalar(off);
      const mid = a.clone().add(b).multiplyScalar(0.5).add(n);
      q.setFromAxisAngle(up, yaw);
      m4.compose(new THREE.Vector3(mid.x, PATH_TOP + 0.035, mid.z), q, new THREE.Vector3(len, 1, 1));
      rim.setMatrixAt(i, m4);
    });
    rim.receiveShadow = true;
    root.add(rim);
  }

  /* ── calha de metal fundido atrás do tabuleiro ── */
  const lavaU = { uTime: { value: 0 } };
  {
    const len = W + 14, zc = -D / 2 - 3.6;
    // calha oca: fundo + duas paredes, para a lava ficar visível
    const floorT = new THREE.Mesh(new THREE.BoxGeometry(len + 1.2, 0.4, 3.6), M.stone);
    floorT.position.set(0, -1.4, zc); root.add(floorT);
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(new RoundedBoxGeometry(len + 1.2, 1.5, 0.55, 2, 0.12), M.stone);
      wall.position.set(0, -0.85, zc + s * 1.55); wall.receiveShadow = true; wall.castShadow = true; root.add(wall);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(len + 1.2, 0.08, 0.12), M.ironDk);
      lip.position.set(0, -0.08, zc + s * 1.3); root.add(lip);
    }
    const lava = new THREE.Mesh(
      new THREE.PlaneGeometry(len, 2.6, 1, 1),
      new THREE.ShaderMaterial({
        uniforms: lavaU, fog: false,
        vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
        fragmentShader: /* glsl */`
          uniform float uTime; varying vec2 vUv; varying vec3 vW;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
          float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
          void main(){
            vec2 p = vec2(vW.x * 0.35 - uTime * 0.35, vW.z * 0.9);
            float f = fbm(p + fbm(p * 1.7 + uTime * 0.12) * 1.6);
            float crust = smoothstep(0.52, 0.78, f);
            vec3 hot = vec3(3.4, 1.25, 0.22), warm = vec3(1.2, 0.2, 0.03), crustC = vec3(0.08, 0.03, 0.02);
            vec3 c = mix(hot, warm, smoothstep(0.25, 0.55, f));
            c = mix(c, crustC, crust);
            float edge = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
            c *= mix(0.35, 1.0, edge);
            gl_FragColor = vec4(c, 1.0);
          }`
      })
    );
    lava.rotation.x = -Math.PI / 2; lava.position.set(0, -0.45, zc);
    root.add(lava);
    for (const x of [-14, 0, 14]) {
      const l = new THREE.PointLight(0xff6a2a, 30, 13, 1.8);
      l.position.set(x, 1.0, zc + 0.4);
      root.add(l);
    }
  }

  /* ── chaminés de tijolo com fumaça e luz de aviação ── */
  const chimneys = [];
  {
    const spots = [[-15, -25, 17, 1.7], [-3, -27, 23, 2.1], [11, -24.5, 15, 1.5], [24, -14, 12, 1.3]];
    for (const [x, z, h, r] of spots) {
      const g = new THREE.Group(); g.position.set(x, -1.6, z);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r, h, 28, 1, true), M.brick);
      body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
      for (const t of [0.18, 0.55, 0.92]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(r * (1 - t * 0.22) + 0.06, 0.09, 8, 36), M.ironDk);
        band.rotation.x = Math.PI / 2; band.position.y = h * t; g.add(band);
      }
      const lip = new THREE.Mesh(new THREE.TorusGeometry(r * 0.8, 0.16, 10, 36), M.iron);
      lip.rotation.x = Math.PI / 2; lip.position.y = h; g.add(lip);
      const ember = new THREE.Mesh(new THREE.CircleGeometry(r * 0.72, 28), M.emberGlow);
      ember.rotation.x = -Math.PI / 2; ember.position.y = h - 0.3; g.add(ember);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), M.beacon);
      beacon.position.set(r * 0.8, h + 0.25, 0); g.add(beacon);
      root.add(g);
      chimneys.push({ top: new THREE.Vector3(x, -1.6 + h + 0.2, z), size: r, beacon });
    }
  }

  /* ── canos ao longo da borda frontal e lateral ── */
  const vents = [];
  {
    const runs = [
      [[-22, 0.2, 14.2], [-8, 0.2, 14.2], [-6, 2.2, 14.2], [10, 2.2, 14.2], [12, 0.2, 14.2], [22, 0.2, 14.2]],
      [[-21.6, 0.4, 12], [-21.6, 0.4, 0], [-21.6, 3.2, -3], [-21.6, 3.2, -12]]
    ];
    for (const pts of runs) {
      const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.08);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.34, 18), M.copper);
      tube.castShadow = true; tube.receiveShadow = true; root.add(tube);
      for (let t = 0.04; t < 1; t += 0.11) {
        const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
        const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.16, 18), M.ironDk);
        fl.position.copy(p); fl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
        fl.castShadow = true; root.add(fl);
      }
      const vp = curve.getPointAt(0.5); vp.y += 0.4;
      vents.push(vp);
      const valve = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 8, 20), M.brass);
      valve.position.copy(vp).add(new THREE.Vector3(0, 0.45, 0)); valve.rotation.x = Math.PI / 2; root.add(valve);
    }
  }

  /* ── portão de entrada (túnel) ── */
  const gate = new THREE.Group();
  {
    const p = gridToWorld(-2, 2);
    gate.position.set(p.x - 0.6, 0, p.z);
    const pil = new RoundedBoxGeometry(1.4, 5.2, 1.0, 2, 0.1);
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(pil, M.iron); m.position.set(0, 1.0, s * 2.2); m.castShadow = true; gate.add(m);
      const h = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.4, 1.05), M.hazard); h.position.set(0, -0.6, s * 2.2); gate.add(h);
    }
    const lintel = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.2, 5.6, 2, 0.12), M.iron);
    lintel.position.set(0, 3.8, 0); lintel.castShadow = true; gate.add(lintel);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 3.4), M.hazard);
    sign.position.set(0.82, 3.8, 0); gate.add(sign);
    const tunnel = new THREE.Mesh(new THREE.BoxGeometry(8, 4.2, 3.8), new THREE.MeshBasicMaterial({ color: 0x020203 }));
    tunnel.position.set(-4.4, 1.4, 0); gate.add(tunnel);
    const lampG = new THREE.Group(); lampG.position.set(0.2, 4.7, 0);
    lampG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.4, 12), M.beacon));
    lampG.userData.keep = true; // gira: fica fora da mesclagem
    gate.add(lampG);
    gate.userData.lamp = lampG;
    root.add(gate);
  }

  /* ── alto-forno: a base do jogador ── */
  const furnace = new THREE.Group();
  const furnaceGlow = new THREE.MeshBasicMaterial({ color: hdr(COL.molten, 4) });
  const furnaceLight = new THREE.PointLight(0xff7a30, 40, 14, 1.8);
  {
    const end = waypoints[waypoints.length - 1];
    furnace.position.set(end.x + 1.8, 0, end.z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 1.2, 32), M.ironDk);
    base.position.y = -0.4; base.receiveShadow = true; base.castShadow = true; furnace.add(base);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.0, 7.5, 32), M.brick);
    body.position.y = 3.8; body.castShadow = true; furnace.add(body);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 2.2, 28), M.iron);
    top.position.y = 8.6; top.castShadow = true; furnace.add(top);
    for (const y of [1.0, 3.2, 5.4, 7.4]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(3.0 - (y / 7.5) * 0.8 + 0.08, 0.14, 10, 40), M.brass);
      band.rotation.x = Math.PI / 2; band.position.y = y; furnace.add(band);
    }
    // boca incandescente voltada para a esteira
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.15, 32, 0, Math.PI), furnaceGlow);
    mouth.position.set(-2.74, 0.9, 0); mouth.rotation.y = -Math.PI / 2; furnace.add(mouth);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.16, 10, 32, Math.PI), M.iron);
    arch.position.set(-2.76, 0.9, 0); arch.rotation.y = -Math.PI / 2; furnace.add(arch);
    furnaceLight.position.set(-4.2, 1.6, 0); furnace.add(furnaceLight);
    // tubo ascendente
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 9, 16), M.copper);
    pipe.position.set(2.2, 4.5, -2.4); pipe.castShadow = true; furnace.add(pipe);
    root.add(furnace);
  }

  /* ── postes de luz (acendem à noite) ── */
  const lamps = [];
  {
    const spots = [[-W / 2 - 1.6, D / 2 + 1.6], [W / 2 + 1.6, D / 2 + 1.6], [-W / 2 - 1.6, -D / 2 - 1.2], [W / 2 + 1.6, -D / 2 - 1.2]];
    const poleG = new THREE.CylinderGeometry(0.12, 0.16, 6.5, 10);
    const armG = new THREE.BoxGeometry(1.4, 0.1, 0.1);
    const shadeG = new THREE.ConeGeometry(0.5, 0.4, 16, 1, true);
    const bulbG = new THREE.SphereGeometry(0.2, 12, 8);
    const halo = new THREE.SpriteMaterial({ color: hdr(0xffc070, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, map: haloTex() });
    lampMat(halo, 0, 0.55); // opacidade controlada pelo ciclo
    for (const [x, z] of spots) {
      const g = new THREE.Group(); g.position.set(x, -1.6, z);
      const pole = new THREE.Mesh(poleG, M.ironDk); pole.position.y = 3.25; pole.castShadow = true; g.add(pole);
      const inward = new THREE.Vector3(-Math.sign(x), 0, -Math.sign(z)).normalize();
      const arm = new THREE.Mesh(armG, M.ironDk); arm.position.set(inward.x * 0.6, 6.4, inward.z * 0.6);
      arm.rotation.y = Math.atan2(-inward.z, inward.x); g.add(arm);
      const head = new THREE.Vector3(inward.x * 1.25, 6.25, inward.z * 1.25);
      const shade = new THREE.Mesh(shadeG, M.iron); shade.position.copy(head); g.add(shade);
      const bulb = new THREE.Mesh(bulbG, M.bulb); bulb.position.copy(head).y -= 0.12; g.add(bulb);
      const spr = new THREE.Sprite(halo); spr.scale.setScalar(1.5); spr.position.copy(bulb.position); g.add(spr);
      const light = new THREE.PointLight(0xffc27a, 0, 26, 1.5);
      light.position.copy(head).y -= 0.4; g.add(light);
      root.add(g);
      lamps.push({ light, bulb });
    }
  }

  /* ── decoração: barris, caixotes e tanques de gás no piso externo ── */
  {
    const barrel = new THREE.CylinderGeometry(0.45, 0.45, 1.25, 18);
    const crate = new RoundedBoxGeometry(1.3, 1.1, 1.3, 2, 0.06);
    const tank = new THREE.CapsuleGeometry(0.75, 2.4, 8, 18);
    const props = [
      ['b', -23, 9], ['b', -23.8, 9.6], ['b', -22.6, 10.4], ['c', -24, 4.5], ['c', -24.2, 5.9],
      ['t', 23.5, -3], ['t', 25.2, -3.3], ['b', 22.5, 13], ['c', 16, 15.6], ['c', 17.4, 15.9], ['b', -12, 15.8], ['b', -11.1, 16.3]
    ];
    for (const [k, x, z] of props) {
      let m;
      if (k === 'b') { m = new THREE.Mesh(barrel, Math.random() < 0.5 ? M.copper : M.hazard); m.position.set(x, -1.6 + 0.62, z); }
      else if (k === 'c') { m = new THREE.Mesh(crate, M.iron); m.position.set(x, -1.6 + 0.55, z); m.rotation.y = Math.random(); }
      else { m = new THREE.Mesh(tank, M.steel); m.rotation.z = Math.PI / 2; m.position.set(x, -1.6 + 0.78, z); }
      m.castShadow = true; m.receiveShadow = true;
      root.add(m);
    }
  }

  mergeStaticDeep(root);

  function canBuild(c, r) { return inGrid(c, r) && !isPath(c, r); }
  function pointAt(d, out) {
    for (let i = 0; i < segLen.length; i++) {
      if (d <= segLen[i] || i === segLen.length - 1) {
        const t = Math.min(1, d / segLen[i]);
        out.lerpVectors(waypoints[i], waypoints[i + 1], t);
        return i;
      }
      d -= segLen[i];
    }
    return 0;
  }

  return { root, lavaU, chimneys, vents, gate, furnace, furnaceGlow, furnaceLight, lamps, waypoints, pathLength: total, pointAt, canBuild, isPath };
}

function haloTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.25, 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* Achata todas as malhas estáticas do cenário em uma por material.
   ~130 malhas -> ~15 draw calls (e o passe de sombra cai junto). */
function mergeStaticDeep(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const groups = new Map();
  const visit = (o) => {
    if (o.userData.keep) return;
    if (o.isMesh && !o.isInstancedMesh && !o.material.isShaderMaterial) {
      const k = o.material.uuid + (o.castShadow ? ':s' : '') + (o.receiveShadow ? ':r' : '');
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(o);
    }
    for (const c of o.children) visit(c);
  };
  visit(root);
  const m4 = new THREE.Matrix4();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geo = mergeGeometries(list.map(m => {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
      return g.applyMatrix4(m4.multiplyMatrices(inv, m.matrixWorld));
    }));
    const merged = new THREE.Mesh(geo, list[0].material);
    merged.castShadow = list[0].castShadow; merged.receiveShadow = list[0].receiveShadow;
    for (const m of list) m.parent.remove(m);
    root.add(merged);
  }
}
