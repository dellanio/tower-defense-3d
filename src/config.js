/* ══════════════════════════════════════════════════════════
   FORJA — configuração central
   Toda cor, número de balanceamento e layout do mapa vive aqui.
   ══════════════════════════════════════════════════════════ */

export const TILE = 2;
export const COLS = 18;
export const ROWS = 12;

export const PLATE_TOP = 0.35;   // topo das placas construíveis
export const PATH_TOP = 0.08;    // topo da esteira (rebaixada)

/* caminho em coordenadas de grade (col, linha) — fora da grade = túnel / fornalha */
export const PATH_POINTS = [
  [-3, 2], [3, 2], [3, 8], [8, 8], [8, 3], [13, 3], [13, 9], [20, 9]
];

export const gridToWorld = (c, r) => ({
  x: (c - (COLS - 1) / 2) * TILE,
  z: (r - (ROWS - 1) / 2) * TILE
});
export const worldToGrid = (x, z) => ({
  c: Math.round(x / TILE + (COLS - 1) / 2),
  r: Math.round(z / TILE + (ROWS - 1) / 2)
});

/* paleta compartilhada entre HUD (CSS) e cena (hex) */
export const COL = {
  ink:     0x07090b,
  iron:    0x2a3238,
  ironDk:  0x161b1f,
  steel:   0x5d676e,
  brass:   0xe9b872,
  copper:  0xc8743a,
  molten:  0xff6a2a,
  tesla:   0x2fe3b0,
  hazard:  0xf2b134,
  rubber:  0x111315,
  brick:   0x4a2c22
};

/* ── torres ─────────────────────────────────────────────── */
export const TOWERS = {
  cannon: {
    key: '1', name: 'Canhão a Vapor', short: 'Canhão', cost: 100,
    range: 7.2, rate: 1.35, dmg: 42, splash: 2.3,
    desc: 'Projétil balístico com dano em área.'
  },
  tesla: {
    key: '2', name: 'Bobina Tesla', short: 'Tesla', cost: 150,
    range: 6.2, rate: 0.95, dmg: 22, chain: 3, chainRange: 3.6, slow: 0.35,
    desc: 'Raio em cadeia que desacelera.'
  },
  flame: {
    key: '3', name: 'Fornalha', short: 'Fornalha', cost: 120,
    range: 4.6, rate: 0.06, dmg: 34 /* dps */, burn: 9 /* dps */, burnTime: 2.6, cone: 0.42,
    desc: 'Chama contínua em cone, causa queimadura.'
  }
};
export const MAX_LEVEL = 3;
export const upgradeCost = (type, level) => Math.round(TOWERS[type].cost * 0.75 * level);
export const levelMul = level => ({ dmg: Math.pow(1.45, level - 1), range: (level - 1) * 0.6 });
export const sellValue = (type, level) => {
  let spent = TOWERS[type].cost;
  for (let l = 1; l < level; l++) spent += upgradeCost(type, l);
  return Math.round(spent * 0.6);
};

/* ── inimigos ───────────────────────────────────────────── */
export const ENEMIES = {
  drone: { name: 'Vespa', hp: 60, speed: 2.7, reward: 8, damage: 1, radius: 0.5 },
  tank:  { name: 'Couraçado', hp: 340, speed: 1.15, reward: 24, damage: 3, radius: 0.85 }
};

/* ── ondas: grupos {type, count, gap(s), at(s)} ─────────── */
export const WAVES = [
  [{ type: 'drone', count: 10, gap: 0.9, at: 0 }],
  [{ type: 'drone', count: 14, gap: 0.7, at: 0 }, { type: 'tank', count: 2, gap: 3, at: 6 }],
  [{ type: 'tank', count: 5, gap: 2.2, at: 0 }, { type: 'drone', count: 12, gap: 0.5, at: 4 }],
  [{ type: 'drone', count: 26, gap: 0.38, at: 0 }, { type: 'tank', count: 4, gap: 1.8, at: 8 }],
  [{ type: 'tank', count: 10, gap: 1.3, at: 0 }, { type: 'drone', count: 20, gap: 0.4, at: 3 }],
  [{ type: 'drone', count: 40, gap: 0.26, at: 0 }, { type: 'tank', count: 8, gap: 1.2, at: 5 }],
  [{ type: 'tank', count: 16, gap: 0.9, at: 0 }, { type: 'drone', count: 36, gap: 0.3, at: 2 }],
  [{ type: 'drone', count: 60, gap: 0.2, at: 0 }, { type: 'tank', count: 22, gap: 0.7, at: 3 }]
];
export const waveHpMul = w => 1 + 0.22 * w + 0.03 * w * w;

export const START_GOLD = 260;
export const START_LIVES = 20;
export const WAVE_BONUS = w => 40 + w * 10;
