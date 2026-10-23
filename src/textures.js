/* Texturas procedurais em canvas — nenhum arquivo de imagem externo */
import * as THREE from 'three';

function canvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}
function tex(c, { srgb = true, repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);

function speckle(g, s, n, alpha) {
  for (let i = 0; i < n; i++) {
    const v = Math.random() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`;
    g.fillRect(Math.random() * s, Math.random() * s, rnd(1, 2.5), rnd(1, 2.5));
  }
}

/** placa de aço rebitada — cor + bump */
export function plateTextures() {
  const S = 256;
  const [c, g] = canvas(S);
  const [b, h] = canvas(S);

  g.fillStyle = '#8a9298'; g.fillRect(0, 0, S, S);
  const grd = g.createLinearGradient(0, 0, S, S);
  grd.addColorStop(0, 'rgba(255,255,255,.06)'); grd.addColorStop(1, 'rgba(0,0,0,.12)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  speckle(g, S, 2600, 0.12);
  // arranhões
  g.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${rnd(.04, .12)})`;
    const x = rnd(0, S), y = rnd(0, S), a = rnd(0, Math.PI), l = rnd(12, 60);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // sujeira nas bordas
  const edge = g.createRadialGradient(S / 2, S / 2, S * .3, S / 2, S / 2, S * .75);
  edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(20,12,6,.38)');
  g.fillStyle = edge; g.fillRect(0, 0, S, S);

  h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);
  // vinco interno
  for (const [ctx, dark, light] of [[g, 'rgba(0,0,0,.35)', 'rgba(255,255,255,.12)'], [h, '#3c3c3c', '#b0b0b0']]) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark; ctx.strokeRect(22, 22, S - 44, S - 44);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = light; ctx.strokeRect(25, 25, S - 50, S - 50);
  }
  // rebites
  const rv = [[14, 14], [S - 14, 14], [14, S - 14], [S - 14, S - 14], [S / 2, 14], [S / 2, S - 14], [14, S / 2], [S - 14, S / 2]];
  for (const [x, y] of rv) {
    const rg = g.createRadialGradient(x - 2, y - 2, 0, x, y, 7);
    rg.addColorStop(0, '#d8dde0'); rg.addColorStop(.6, '#6a7277'); rg.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, 6.5, 0, Math.PI * 2); g.fill();
    const rh = h.createRadialGradient(x, y, 0, x, y, 7);
    rh.addColorStop(0, '#ffffff'); rh.addColorStop(1, '#808080');
    h.fillStyle = rh; h.beginPath(); h.arc(x, y, 7, 0, Math.PI * 2); h.fill();
  }
  speckle(h, S, 1800, 0.25);
  return { map: tex(c), bump: tex(b, { srgb: false }) };
}

/** grade de esteira — losangos escuros com brilho de baixo */
export function grateTextures() {
  const S = 256;
  const [c, g] = canvas(S);
  const [e, k] = canvas(S);
  g.fillStyle = '#3d4246'; g.fillRect(0, 0, S, S);
  k.fillStyle = '#000'; k.fillRect(0, 0, S, S);
  const n = 8, step = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const cx = i * step + step / 2, cy = j * step + step / 2;
    g.fillStyle = '#0b0d0f';
    g.beginPath();
    g.moveTo(cx, cy - step * .34); g.lineTo(cx + step * .2, cy); g.lineTo(cx, cy + step * .34); g.lineTo(cx - step * .2, cy);
    g.closePath(); g.fill();
    k.fillStyle = `rgba(255,${120 + Math.random() * 40 | 0},40,${0.25 + Math.random() * 0.35})`;
    k.beginPath();
    k.moveTo(cx, cy - step * .26); k.lineTo(cx + step * .13, cy); k.lineTo(cx, cy + step * .26); k.lineTo(cx - step * .13, cy);
    k.closePath(); k.fill();
  }
  speckle(g, S, 1500, 0.18);
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 6; g.strokeRect(0, 0, S, S);
  return { map: tex(c), emissive: tex(e) };
}

/** listras de perigo amarelo/preto */
export function hazardTexture() {
  const [c, g] = canvas(128);
  g.fillStyle = '#f2b134'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#141414';
  for (let i = -128; i < 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 + 128, 128); g.lineTo(i + 128, 128); g.closePath(); g.fill();
  }
  speckle(g, 128, 900, 0.3);
  const t = tex(c); t.repeat.set(6, 1);
  return t;
}

/** concreto do piso externo */
export function concreteTexture() {
  const S = 512;
  const [c, g] = canvas(S);
  g.fillStyle = '#5a5855'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    const x = rnd(0, S), y = rnd(0, S), r = rnd(20, 90);
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    const d = Math.random() < .5;
    rg.addColorStop(0, d ? 'rgba(20,16,12,.16)' : 'rgba(255,250,240,.06)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  speckle(g, S, 9000, 0.14);
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3;
  g.strokeRect(0, 0, S, S);
  g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
  return tex(c, { repeat: 14 });
}

/** tijolo refratário das chaminés */
export function brickTexture() {
  const S = 256;
  const [c, g] = canvas(S);
  g.fillStyle = '#231510'; g.fillRect(0, 0, S, S);
  const bh = 16, bw = 42;
  for (let y = 0, row = 0; y < S; y += bh, row++) {
    for (let x = -(row % 2) * bw / 2; x < S; x += bw) {
      const v = rnd(.75, 1.1);
      g.fillStyle = `rgb(${92 * v | 0},${48 * v | 0},${34 * v | 0})`;
      g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
    }
  }
  speckle(g, S, 2400, 0.2);
  const soot = g.createLinearGradient(0, 0, 0, S);
  soot.addColorStop(0, 'rgba(0,0,0,.55)'); soot.addColorStop(.4, 'rgba(0,0,0,.1)'); soot.addColorStop(1, 'rgba(0,0,0,.25)');
  g.fillStyle = soot; g.fillRect(0, 0, S, S);
  const t = tex(c); t.repeat.set(3, 6);
  return t;
}

/** cantoneiras do cursor de construção (mesmo motivo do HUD) */
export function bracketTexture() {
  const [c, g] = canvas(256);
  g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = 10;
  const m = 22, L = 60;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [256 - m, m, -1, 1], [m, 256 - m, 1, -1], [256 - m, 256 - m, -1, -1]]) {
    g.beginPath(); g.moveTo(x + sx * L, y); g.lineTo(x, y); g.lineTo(x, y + sy * L); g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(m, m, 256 - 2 * m, 256 - 2 * m);
  return tex(c);
}

/** mancha de fuligem para decals de explosão */
export function scorchTexture() {
  const [c, g] = canvas(128);
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(0,0,0,.9)'); rg.addColorStop(.45, 'rgba(10,6,4,.55)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = rnd(20, 58);
    g.fillStyle = `rgba(0,0,0,${rnd(.1, .4)})`;
    g.beginPath(); g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, rnd(2, 7), 0, Math.PI * 2); g.fill();
  }
  return tex(c);
}
