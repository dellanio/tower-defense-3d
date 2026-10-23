/* ══════════════════════════════════════════════════════════
   FORJA — estado do jogo, entrada, ondas e loop
   Simulação em passo fixo (60 Hz); render e efeitos por quadro.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { createWorld, HOME_POS, HOME_TGT } from './world.js';
import { buildMap } from './map.js';
import { createFX } from './fx.js';
import { Enemies } from './enemies.js';
import { Towers, buildModel, TSCALE } from './towers.js';
import { audio } from './audio.js';
import { M, setLampLevel, hdr } from './materials.js';
import { bracketTexture } from './textures.js';
import {
  TOWERS, ENEMIES, WAVES, MAX_LEVEL, PLATE_TOP, START_GOLD, START_LIVES, WAVE_BONUS,
  waveHpMul, worldToGrid, gridToWorld, COL
} from './config.js';

const Q = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const bootBar = $('bootBar');
bootBar.style.width = '20%';

/* ── montagem da cena ── */
const canvas = $('c');
const W = createWorld(canvas);
const { scene, camera, controls, renderer, composer, grade } = W;
const map = buildMap(scene);
const fx = createFX(scene);
const enemies = new Enemies(scene, map, fx);
const towers = new Towers(scene, fx, enemies, map, audio);
bootBar.style.width = '55%';

/* ── estado ── */
const state = {
  gold: START_GOLD, lives: START_LIVES, wave: 0, waveActive: false, queue: [], waveClock: 0,
  speed: 1, paused: false, over: false, won: false,
  buildType: null, selected: null, timeMode: 'auto', tod: 0.12, simTime: 0, fxTime: 0
};

/* ── cursor de construção: cantoneiras + fantasma + anel de alcance ── */
const cursor = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 2.05), new THREE.MeshBasicMaterial({
  map: bracketTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
}));
cursor.rotation.x = -Math.PI / 2; cursor.position.y = PLATE_TOP + 0.02; cursor.visible = false; cursor.renderOrder = 5;
scene.add(cursor);
const ghostMat = new THREE.MeshBasicMaterial({ color: hdr(COL.tesla, 0.9), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
const ghosts = {};
for (const t of Object.keys(TOWERS)) { ghosts[t] = buildModel(t, ghostMat); ghosts[t].scale.setScalar(TSCALE); ghosts[t].visible = false; scene.add(ghosts[t]); }

const rangeGroup = new THREE.Group(); rangeGroup.visible = false; scene.add(rangeGroup);
{
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.975, 1, 96).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: hdr(COL.brass, 1.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: hdr(COL.brass, 0.5), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.renderOrder = disc.renderOrder = 5;
  rangeGroup.add(disc, ring);
  rangeGroup.userData = { ring, disc };
}
function showRange(x, z, r, color) {
  rangeGroup.visible = true;
  rangeGroup.position.set(x, PLATE_TOP + 0.03, z);
  rangeGroup.scale.setScalar(r);
  rangeGroup.userData.ring.material.color.copy(color);
  rangeGroup.userData.disc.material.color.copy(color).multiplyScalar(0.3);
}

/* ══════════════════════════════════════════════════════════
   HUD
   ══════════════════════════════════════════════════════════ */
const ui = {
  wave: $('sWave'), lives: $('sLives'), livesBar: $('livesBar'), gold: $('sGold'),
  statGold: $('statGold'), statLives: $('statLives'),
  btnWave: $('btnWave'), prev: $('wavePrev'), cards: [...document.querySelectorAll('.card')],
  inspect: $('inspect'), toast: $('toast')
};

function waveText(i) {
  if (i >= WAVES.length) return 'Todas as ondas repelidas';
  const n = { drone: 0, tank: 0 };
  for (const g of WAVES[i]) n[g.type] += g.count;
  const parts = [];
  if (n.drone) parts.push(`<b>${n.drone}</b> Vespas`);
  if (n.tank) parts.push(`<b>${n.tank}</b> Couraçados`);
  return parts.join(' · ');
}
let lastGold = -1;
function syncHUD() {
  ui.wave.innerHTML = `${state.wave}<small>/${WAVES.length}</small>`;
  ui.lives.textContent = Math.max(0, state.lives);
  ui.livesBar.style.width = `${Math.min(1, Math.max(0, state.lives) / START_LIVES) * 100}%`;
  if (state.gold !== lastGold) {
    ui.gold.textContent = state.gold;
    if (lastGold >= 0 && state.gold > lastGold) bump(ui.statGold, 'pop');
    lastGold = state.gold;
  }
  ui.cards.forEach(c => {
    c.classList.toggle('on', c.dataset.t === state.buildType);
    c.classList.toggle('poor', TOWERS[c.dataset.t].cost > state.gold);
  });
  ui.btnWave.disabled = state.waveActive || state.over || state.wave >= WAVES.length;
  ui.btnWave.firstChild.textContent = state.waveActive ? 'Onda em curso' : 'Iniciar onda';
  ui.prev.innerHTML = waveText(state.waveActive ? state.wave : state.wave);
  syncInspect();
}
function bump(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function syncInspect() {
  const t = state.selected;
  ui.inspect.classList.toggle('show', !!t);
  if (!t) return;
  const S = towers.stats(t), D = TOWERS[t.type];
  $('iKick').textContent = `Nível ${t.level} de ${MAX_LEVEL}`;
  $('iName').textContent = D.name;
  [...$('iPips').children].forEach((p, i) => p.classList.toggle('on', i < t.level));
  const next = t.level < MAX_LEVEL ? towers.stats({ ...t, level: t.level + 1 }) : null;
  const row = (k, v, n) => `<span>${k}</span><b>${v}${n ? `<em>→ ${n}</em>` : ''}</b>`;
  const dmgLbl = t.type === 'flame' ? 'Dano/s' : 'Dano';
  $('iRows').innerHTML =
    row(dmgLbl, Math.round(S.dmg), next && Math.round(next.dmg)) +
    row('Alcance', S.range.toFixed(1), next && next.range.toFixed(1)) +
    (t.type === 'cannon' ? row('Área', S.splash.toFixed(1)) : '') +
    (t.type === 'tesla' ? row('Cadeia', `${S.chain} alvos`) + row('Lentidão', `${S.slow * 100 | 0}%`) : '') +
    (t.type === 'flame' ? row('Queimadura', `${Math.round(S.burn)}/s`) : '') +
    (t.type !== 'flame' ? row('Cadência', `${(1 / S.rate).toFixed(2)}/s`) : '');
  const uc = towers.upgradeCost(t);
  $('btnUp').disabled = uc === null || uc > state.gold;
  $('upCost').textContent = uc === null ? 'máx.' : uc;
  $('sellVal').textContent = towers.sellValue(t);
}

let toastTimer = 0;
function toast(kick, title, msg = '', modal = false, dur = 2.6) {
  $('tKick').textContent = kick; $('tTitle').textContent = title; $('tMsg').textContent = msg;
  ui.toast.classList.toggle('modal', modal);
  ui.toast.classList.add('show');
  toastTimer = modal ? Infinity : dur;
}

/* números flutuantes (pool DOM) */
const floaters = [];
for (let i = 0; i < 28; i++) {
  const el = document.createElement('div'); el.className = 'floater';
  $('floaters').appendChild(el);
  floaters.push({ el, life: 0, pos: new THREE.Vector3() });
}
let fi = 0;
function floatText(pos, text) {
  const f = floaters[fi]; fi = (fi + 1) % floaters.length;
  f.el.textContent = text; f.pos.copy(pos); f.life = 1;
}
const _p = new THREE.Vector3();
function updateFloaters(dt) {
  for (const f of floaters) {
    if (f.life <= 0) continue;
    f.life -= dt * 1.1;
    _p.copy(f.pos); _p.y += (1 - f.life) * 1.6;
    _p.project(camera);
    const x = (_p.x * 0.5 + 0.5) * innerWidth, y = (-_p.y * 0.5 + 0.5) * innerHeight;
    f.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${0.9 + (1 - f.life) * 0.3})`;
    f.el.style.opacity = f.life > 0 ? Math.min(1, f.life * 3) : 0;
  }
}

/* ══════════════════════════════════════════════════════════
   REGRAS
   ══════════════════════════════════════════════════════════ */
enemies.onKill = e => {
  const r = e.def.reward;
  state.gold += r;
  floatText(_p.copy(e.pos).setY(1.6), `+${r}`);
  audio.kill();
};
enemies.onReach = e => {
  state.lives -= e.def.damage;
  shake = Math.min(1, shake + 0.45 + e.def.damage * 0.15);
  bump(ui.statLives, 'hurt');
  audio.leak();
  furnacePulse = 1;
  fx.explosion(_p.copy(map.furnace.position).add(new THREE.Vector3(-2.8, 1, 0)), 0.7);
  if (state.lives <= 0 && !state.over) gameOver(false);
};

function startWave() {
  if (state.waveActive || state.over || state.wave >= WAVES.length) return;
  audio.unlock();
  state.waveActive = true;
  state.waveClock = 0;
  const hpMul = waveHpMul(state.wave);
  state.queue = [];
  for (const g of WAVES[state.wave]) for (let i = 0; i < g.count; i++) state.queue.push({ at: g.at + i * g.gap, type: g.type, hpMul });
  state.queue.sort((a, b) => a.at - b.at);
  state.wave++;
  toast(`Onda ${state.wave} de ${WAVES.length}`, 'Inimigos na esteira', '', false, 2);
  audio.wave();
  gateAlarm = 3;
  syncHUD();
}
function stepWave(dt) {
  if (!state.waveActive) return;
  state.waveClock += dt;
  while (state.queue.length && state.queue[0].at <= state.waveClock) {
    const s = state.queue.shift();
    enemies.spawn(s.type, s.hpMul);
  }
  if (!state.queue.length && !enemies.list.some(e => e.alive) && !state.over) {
    state.waveActive = false;
    const bonus = WAVE_BONUS(state.wave);
    state.gold += bonus;
    if (state.wave >= WAVES.length) gameOver(true);
    else toast('Onda contida', `+${bonus} engrenagens`, 'Construa e inicie a próxima', false, 2.6);
    syncHUD();
  }
}
function gameOver(won) {
  state.over = true; state.won = won; state.waveActive = false;
  if (won) { audio.win(); toast('Siderúrgica 07', 'Vitória', `Fornalha intacta · ${state.lives} de ${START_LIVES}`, true); }
  else { audio.lose(); toast('Siderúrgica 07', 'A fornalha apagou', `Você resistiu até a onda ${state.wave}`, true); }
  syncHUD();
}
function restart() {
  enemies.clear(); towers.clear();
  Object.assign(state, { gold: START_GOLD, lives: START_LIVES, wave: 0, waveActive: false, queue: [], over: false, won: false, selected: null, buildType: null });
  ui.toast.classList.remove('show', 'modal');
  syncHUD();
}

function tryBuild(c, r) {
  const type = state.buildType;
  const cost = TOWERS[type].cost;
  if (!map.canBuild(c, r) || towers.at(c, r)) { audio.deny(); return; }
  if (state.gold < cost) { audio.deny(); bump(ui.statGold, 'hurt'); return; }
  state.gold -= cost;
  towers.build(type, c, r);
  if (state.gold < cost) state.buildType = null; // segue construindo enquanto houver engrenagens
  syncHUD();
}
function select(t) { state.selected = t; if (t) state.buildType = null; syncHUD(); }
function upgradeSelected() {
  const t = state.selected; if (!t) return;
  const c = towers.upgradeCost(t);
  if (c === null || c > state.gold) { audio.deny(); return; }
  state.gold -= c; towers.upgrade(t); syncHUD();
}
function sellSelected() {
  const t = state.selected; if (!t) return;
  state.gold += towers.sell(t);
  floatText(_p.copy(t.pos).setY(1.5), `+${towers.sellValue(t)}`);
  select(null);
}

/* ══════════════════════════════════════════════════════════
   ENTRADA — toque curto = ação, arrasto = câmera
   ══════════════════════════════════════════════════════════ */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PLATE_TOP);
let hoverCell = null, down = null, lastInteract = performance.now();
const keys = { shift: false };

function cellAt(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.ray.intersectPlane(plane, _p);
  if (!hit) return null;
  const g = worldToGrid(hit.x, hit.z);
  return g;
}
canvas.addEventListener('pointerdown', e => { audio.unlock(); down = { x: e.clientX, y: e.clientY, t: performance.now(), b: e.button }; lastInteract = performance.now(); });
canvas.addEventListener('pointermove', e => {
  hoverCell = cellAt(e);
  lastInteract = performance.now();
});
canvas.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 500;
  if (down.b === 0 && moved < 8 && quick) {
    const g = cellAt(e);
    if (g) {
      if (state.buildType) tryBuild(g.c, g.r);
      else select(towers.at(g.c, g.r));
    }
  }
  if (down.b === 2 && moved < 6) { state.buildType = null; select(null); }
  down = null;
});
canvas.addEventListener('pointerleave', () => { hoverCell = null; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

addEventListener('keydown', e => {
  keys.shift = e.shiftKey;
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  const byKey = Object.entries(TOWERS).find(([, d]) => d.key === k);
  if (byKey) { setBuild(byKey[0]); return; }
  if (k === 'escape') { state.buildType = null; select(null); syncHUD(); }
  if (k === ' ') { e.preventDefault(); startWave(); }
  if (k === 'u') upgradeSelected();
  if (k === 'delete' || k === 'backspace') sellSelected();
  if (k === 'p') togglePause();
  if (k === 'f') toggleSpeed();
  if (k === 'm') toggleSound();
  if (k === 't') { const order = ['auto', 'dia', 'tarde', 'noite']; segTime.set(order[(order.indexOf(state.timeMode) + 1) % 4]); }
});
addEventListener('keyup', e => { keys.shift = e.shiftKey; });

function setBuild(type) {
  audio.unlock(); audio.click();
  state.buildType = state.buildType === type ? null : type;
  state.selected = null;
  syncHUD();
}
ui.cards.forEach(c => c.addEventListener('click', () => setBuild(c.dataset.t)));
ui.btnWave.addEventListener('click', startWave);
$('btnUp').addEventListener('click', upgradeSelected);
$('btnSell').addEventListener('click', sellSelected);
$('iClose').addEventListener('click', () => select(null));
$('tBtn').addEventListener('click', restart);

function togglePause() { state.paused = !state.paused; $('btnPause').classList.toggle('on', state.paused); }
function toggleSpeed() { state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 3 : 1; $('btnSpeed').textContent = state.speed + '×'; $('btnSpeed').classList.toggle('on', state.speed > 1); }
function toggleSound() {
  audio.unlock(); audio.setMuted(!audio.muted);
  $('w1').style.opacity = audio.muted ? .2 : 1; $('w2').style.opacity = audio.muted ? 0 : 1;
}
$('btnPause').addEventListener('click', togglePause);
$('btnSpeed').addEventListener('click', toggleSpeed);
$('btnSound').addEventListener('click', toggleSound);

/* segmentado com pílula deslizante (mesmo componente da referência) */
function initSeg(el, onChange) {
  const pill = el.querySelector('.pill'), btns = [...el.querySelectorAll('button')];
  const move = () => { const on = el.querySelector('button.on') || btns[0]; pill.style.left = on.offsetLeft + 'px'; pill.style.width = on.offsetWidth + 'px'; };
  const set = v => { btns.forEach(b => b.classList.toggle('on', b.dataset.v === v)); move(); onChange(v); };
  btns.forEach(b => b.addEventListener('click', () => { audio.click(); set(b.dataset.v); }));
  requestAnimationFrame(move);
  return { move, set };
}
const TOD = { dia: 0.14, tarde: 0.42, noite: 0.68 };
const segTime = initSeg($('segTime'), v => { state.timeMode = v; });

addEventListener('resize', () => { W.resize(); segTime.move(); });

/* ══════════════════════════════════════════════════════════
   LOOP
   ══════════════════════════════════════════════════════════ */
const STEP = 1 / 60;
let acc = 0, shake = 0, furnacePulse = 0, gateAlarm = 0, smokeT = 0, ventT = 2;
const clock = new THREE.Clock();
const intro = { t: Q.has('shot') ? 1 : 0, from: camera.position.clone() };
const bulbBase = M.bulb.color.clone(), beaconBase = M.beacon.color.clone();
const fpsEl = $('fps'); let fpsN = 0, fpsT = 0, fpsMs = 0, simMs = 0, simSteps = 0;
if (Q.has('debug') || Q.has('stress')) fpsEl.style.display = 'block';
const camOff = new THREE.Vector3();

const MANUAL = Q.has('manual');
let forcedDt = null, skipRender = false;
function frame() {
  const t0 = performance.now();
  const realDt = forcedDt ?? Math.min(clock.getDelta(), 0.1);
  const dt = state.paused ? 0 : realDt * state.speed;

  /* simulação em passo fixo */
  acc += dt;
  let steps = 0;
  const sim0 = performance.now();
  while (acc >= STEP && steps < 12) {
    state.simTime += STEP;
    stepWave(STEP);
    enemies.update(STEP, state.simTime);
    towers.step(STEP);
    acc -= STEP; steps++;
  }
  if (steps === 12) acc = 0;
  simMs += performance.now() - sim0; simSteps += steps;
  state.fxTime += dt;

  /* ciclo dia/noite */
  if (state.timeMode === 'auto') state.tod = (state.tod + realDt / 150) % 1;
  else if (TOD[state.timeMode] !== undefined) {
    let d = TOD[state.timeMode] - state.tod;
    d -= Math.round(d);
    state.tod = (state.tod + d * Math.min(1, realDt * 2.2) + 1) % 1;
  }
  const sky = W.setTimeOfDay(state.tod);
  setLampLevel(sky.lamp);
  for (const l of map.lamps) l.light.intensity = sky.lamp * 45;
  M.bulb.color.copy(bulbBase).multiplyScalar(0.12 + sky.lamp * 0.88);
  const blink = (Math.sin(state.fxTime * 3) > 0.6 ? 1 : 0.08);
  M.beacon.color.copy(beaconBase).multiplyScalar(blink * (0.3 + sky.lamp * 0.7));
  W.skyU.uTime.value = state.fxTime;
  map.lavaU.uTime.value = state.fxTime;

  /* ambiente vivo: chaminés, respiros, alarme do portão, alto-forno */
  smokeT -= dt;
  if (smokeT <= 0) {
    smokeT = 0.09;
    for (const ch of map.chimneys) {
      fx.smokePuff(ch.top, 1, ch.size * 1.3, 2.4, fx.PAL.smokeA, fx.PAL.smokeB, 6);
      if (Math.random() < 0.3) fx.add.emit(ch.top.x, ch.top.y, ch.top.z, (Math.random() - .5), 3 + Math.random() * 2, (Math.random() - .5), 1.4, 0.25, 0.05, fx.PAL.emberA, fx.PAL.emberB, 0.5, 0.3);
    }
    if (Math.random() < 0.4) {
      const x = (Math.random() - 0.5) * 40;
      fx.add.emit(x, -0.2, -15.6 + (Math.random() - .5) * 2, 0, 2 + Math.random() * 2, 0, 1 + Math.random(), 0.2, 0.04, fx.PAL.emberA, fx.PAL.emberB, 0.8, 0.2);
    }
  }
  ventT -= dt;
  if (ventT <= 0) {
    ventT = 3 + Math.random() * 4;
    const v = map.vents[(Math.random() * map.vents.length) | 0];
    for (let i = 0; i < 14; i++) fx.smoke.emit(v.x, v.y + 0.3, v.z, (Math.random() - .5) * 0.6, 3 + Math.random() * 2, (Math.random() - .5) * 0.6, 1.4 + Math.random(), 0.5, 2.6, fx.PAL.steamA, fx.PAL.steamB, 0.6, 1.2, 0.05);
  }
  gateAlarm = Math.max(0, gateAlarm - realDt);
  map.gate.userData.lamp.rotation.y += realDt * (gateAlarm > 0 || state.waveActive ? 9 : 1.5);
  furnacePulse = Math.max(0, furnacePulse - realDt * 1.6);
  const fp = 1 + Math.sin(state.fxTime * 2.2) * 0.08 + furnacePulse * 1.5;
  map.furnaceGlow.color.copy(hdr(COL.molten, 4 * fp));
  map.furnaceLight.intensity = 40 * fp;

  /* entidades */
  towers.animate(dt, state.fxTime);
  enemies.sync(state.simTime);
  audio.flame(state.paused ? 0 : towers.flameActive);
  const scale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  fx.update(dt, state.fxTime, scale);

  /* cursor e alcance */
  cursor.visible = false; rangeGroup.visible = false;
  for (const g of Object.values(ghosts)) g.visible = false;
  if (state.buildType && hoverCell) {
    const ok = map.canBuild(hoverCell.c, hoverCell.r) && !towers.at(hoverCell.c, hoverCell.r) && state.gold >= TOWERS[state.buildType].cost;
    const p = gridToWorld(hoverCell.c, hoverCell.r);
    const inside = hoverCell.c >= -1 && hoverCell.c <= 18 && hoverCell.r >= -1 && hoverCell.r <= 12;
    if (inside) {
      const col = ok ? hdr(COL.tesla, 1.4) : hdr(0xff3a1a, 1.4);
      cursor.visible = true; cursor.position.set(p.x, PLATE_TOP + 0.02, p.z);
      cursor.material.color.copy(col);
      cursor.material.opacity = 0.75 + Math.sin(state.fxTime * 8) * 0.25;
      const gh = ghosts[state.buildType];
      gh.visible = true; gh.position.set(p.x, PLATE_TOP + 0.05 + Math.sin(state.fxTime * 3) * 0.05, p.z);
      ghostMat.color.copy(col).multiplyScalar(0.55);
      showRange(p.x, p.z, TOWERS[state.buildType].range, ok ? hdr(COL.tesla, 1.2) : hdr(0xff3a1a, 1.2));
    }
  } else if (state.selected) {
    const t = state.selected;
    showRange(t.pos.x, t.pos.z, towers.stats(t).range, hdr(COL.brass, 1.5));
    cursor.visible = true; cursor.position.set(t.pos.x, PLATE_TOP + 0.02, t.pos.z);
    cursor.material.color.copy(hdr(COL.brass, 1.4)); cursor.material.opacity = 1;
  }

  /* câmera: intro, limites, tremor */
  camera.position.sub(camOff);
  if (intro.t < 1) {
    intro.t = Math.min(1, intro.t + realDt / 2.4);
    const k = intro.t < 0.5 ? 4 * intro.t ** 3 : 1 - Math.pow(-2 * intro.t + 2, 3) / 2;
    camera.position.lerpVectors(intro.from, HOME_POS, k);
    camera.lookAt(HOME_TGT);
    if (intro.t >= 1) { controls.enabled = true; controls.update(); }
  } else {
    controls.enabled = true;
    controls.update();
    const tg = controls.target;
    const cx = THREE.MathUtils.clamp(tg.x, -16, 16), cz = THREE.MathUtils.clamp(tg.z, -11, 12);
    if (cx !== tg.x || cz !== tg.z || tg.y !== 0) { camera.position.x += cx - tg.x; camera.position.z += cz - tg.z; tg.set(cx, 0, cz); }
  }
  shake = Math.max(0, shake - realDt * 1.8);
  camOff.set((Math.random() - .5), (Math.random() - .5), (Math.random() - .5)).multiplyScalar(shake * shake * 0.6);
  camera.position.add(camOff);
  grade.uniforms.uShake.value = shake;
  grade.uniforms.uTime.value = state.fxTime;

  /* HUD por quadro */
  if (toastTimer !== Infinity && toastTimer > 0) { toastTimer -= realDt; if (toastTimer <= 0) ui.toast.classList.remove('show'); }
  updateFloaters(realDt);
  hudTick += realDt;
  if (hudTick > 0.15) { hudTick = 0; syncHUD(); }

  if (!skipRender) { renderer.info.reset(); composer.render(); }

  /* medição */
  fpsN++; fpsT += realDt; fpsMs += performance.now() - t0;
  if (fpsT >= 0.5) {
    const alive = enemies.list.filter(e => e.alive).length;
    fpsEl.textContent = `${(fpsN / fpsT).toFixed(0)} fps  cpu ${(fpsMs / fpsN).toFixed(1)} ms\ninimigos ${alive}  torres ${towers.list.length}\ndraw ${renderer.info.render.calls}  tri ${(renderer.info.render.triangles / 1000).toFixed(0)}k\nhoras ${sky.phase}`;
    window.__perf = { fps: fpsN / fpsT, cpuMs: fpsMs / fpsN, simMsPerStep: simSteps ? simMs / simSteps : 0, alive, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    fpsN = 0; fpsT = 0; fpsMs = 0; simMs = 0; simSteps = 0;
  }
  if (!MANUAL) requestAnimationFrame(frame);
}
let hudTick = 0;

/* ── cenário de estresse: ?stress — torres prontas, ondas sem fim ── */
function stressSetup() {
  state.gold = 999999; state.lives = 9999;
  const spots = [[2, 4], [4, 5], [5, 7], [7, 5], [9, 5], [10, 2], [12, 5], [14, 6], [11, 8], [6, 9], [2, 7], [15, 8], [10, 4], [12, 1], [5, 3], [14, 2]];
  const types = ['cannon', 'tesla', 'flame'];
  spots.forEach(([c, r], i) => { if (map.canBuild(c, r)) { const t = towers.build(types[i % 3], c, r); t.level = 1; t.spawn = 1; } });
  state.waveActive = true; state.wave = 1;
  let n = 0;
  state.queue = [];
  setInterval(() => {
    if (enemies.list.length < +(Q.get('stress') || 160)) {
      enemies.spawn(n++ % 3 === 0 ? 'tank' : 'drone', 6);
    }
  }, 60);
}

/* ── API de teste (screenshots / medição) ── */
window.__td = {
  state, enemies, towers, fx, map, W,
  setTime(v) { segTime.set(v); if (TOD[v] !== undefined) state.tod = TOD[v]; },
  build(type, c, r) { state.gold += TOWERS[type].cost; state.buildType = type; tryBuild(c, r); state.buildType = null; const t = towers.at(c, r); if (t) t.spawn = 1; return t; },
  startWave, select: (c, r) => select(towers.at(c, r)), hover(c, r, type) { state.buildType = type; hoverCell = { c, r }; },
  /** modo ?manual: avança n quadros de dt segundos e renderiza só o último */
  advance(n, dt = 1 / 30) {
    forcedDt = dt;
    for (let i = 0; i < n; i++) { skipRender = i < n - 1; frame(); }
    forcedDt = null; skipRender = false;
  },
  camera(pos, tgt) { camera.position.set(...pos); controls.target.set(...tgt); controls.update(); }
};

/* ── boot: espera fontes e compila shaders antes de revelar ── */
(async () => {
  $('bootTxt').textContent = 'Compilando shaders';
  await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]);
  bootBar.style.width = '80%';
  if (Q.has('tod')) { state.timeMode = 'fixo'; state.tod = +Q.get('tod'); }
  W.setTimeOfDay(state.tod);
  renderer.compile(scene, camera);
  composer.render();
  bootBar.style.width = '100%';
  if (Q.has('stress')) stressSetup();
  syncHUD();
  setTimeout(() => $('boot').classList.add('gone'), Q.has('shot') ? 0 : 250);
  if (!Q.has('stress') && !Q.has('shot')) setTimeout(() => toast('Siderúrgica 07', 'Defenda o alto-forno', 'Escolha uma torre (1·2·3) e inicie a onda', false, 4.5), 1200);
  clock.getDelta();
  frame();
})();
