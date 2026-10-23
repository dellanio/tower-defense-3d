/* Materiais compartilhados — nenhuma torre/inimigo clona material.
   Variações por instância usam instanceColor; brilho noturno usa o registro de lâmpadas. */
import * as THREE from 'three';
import { COL } from './config.js';
import { plateTextures, grateTextures, hazardTexture, brickTexture, concreteTexture } from './textures.js';

const envMats = [];
const lampMats = [];

function std(opts, env = 1) {
  const m = new THREE.MeshStandardMaterial(opts);
  m.userData.envBase = env;
  m.envMapIntensity = env;
  envMats.push(m);
  return m;
}
/** cor HDR (>1) para MeshBasic — alimenta o bloom */
export function hdr(hex, k) { return new THREE.Color(hex).multiplyScalar(k); }

export function setEnvLevel(level) {
  for (const m of envMats) m.envMapIntensity = m.userData.envBase * level;
}
/** registra material cujo emissive acende à noite: base + extra*lamp */
export function lampMat(m, base, extra) {
  m.userData.lamp = { base, extra };
  lampMats.push(m);
  return m;
}
export function setLampLevel(level) {
  for (const m of lampMats) {
    const { base, extra } = m.userData.lamp;
    const v = base + extra * level;
    if (m.emissive) m.emissiveIntensity = v; else m.opacity = v;
  }
}

const plate = plateTextures();
const grate = grateTextures();

export const M = {
  plate: std({ map: plate.map, bumpMap: plate.bump, bumpScale: 3, color: 0xb4b6b4, roughness: 0.55, metalness: 0.38 }, 0.9),
  grate: std({ map: grate.map, emissiveMap: grate.emissive, emissive: new THREE.Color(COL.molten), emissiveIntensity: 0.9, roughness: 0.5, metalness: 0.8 }, 0.7),
  slab:  std({ color: 0x23292d, roughness: 0.6, metalness: 0.45 }, 0.8),
  iron:  std({ color: 0x3a4248, roughness: 0.5, metalness: 0.6 }, 1),
  ironDk: std({ color: COL.ironDk, roughness: 0.6, metalness: 0.7 }, 0.8),
  steel: std({ color: COL.steel, roughness: 0.32, metalness: 0.92 }, 1.1),
  brass: std({ color: COL.brass, roughness: 0.36, metalness: 1 }, 1.0),
  copper: std({ color: COL.copper, roughness: 0.42, metalness: 1 }, 0.9),
  rubber: std({ color: COL.rubber, roughness: 0.92, metalness: 0.05 }, 0.4),
  hazard: std({ map: hazardTexture(), roughness: 0.65, metalness: 0.3 }, 0.6),
  brick: std({ map: brickTexture(), roughness: 0.92, metalness: 0.0 }, 0.3),
  concrete: std({ map: concreteTexture(), color: 0x8a8682, roughness: 0.94, metalness: 0.05 }, 0.35),
  stone: std({ color: 0x2c2724, roughness: 0.88, metalness: 0.1 }, 0.4),
  glass: std({ color: 0x223038, roughness: 0.08, metalness: 0.2, emissive: new THREE.Color(0xffb35a), emissiveIntensity: 0.2 }, 1.4),

  /* emissivos */
  emberGlow: new THREE.MeshBasicMaterial({ color: hdr(COL.molten, 4.2) }),
  teslaGlow: new THREE.MeshBasicMaterial({ color: hdr(COL.tesla, 3.4) }),
  redEye:   new THREE.MeshBasicMaterial({ color: hdr(0xff2a1a, 5) }),
  bulb:     new THREE.MeshBasicMaterial({ color: hdr(0xffcf8a, 4) }),
  beacon:   new THREE.MeshBasicMaterial({ color: hdr(0xff2010, 6) })
};
lampMat(M.glass, 0.15, 2.6);

/* materiais dos inimigos: branco no instanceColor = normal; >1 = clarão de dano */
export const EM = {
  droneBody: std({ color: 0xc9884a, roughness: 0.34, metalness: 0.9 }, 1.1),
  droneRing: std({ color: 0x3a4248, roughness: 0.4, metalness: 0.9 }, 1),
  tankHull: std({ color: 0x6b6a58, roughness: 0.55, metalness: 0.5 }, 0.9),
  tankDark: std({ color: 0x1c1e1f, roughness: 0.8, metalness: 0.4 }, 0.5),
  tankGrill: new THREE.MeshBasicMaterial({ color: hdr(0xff5a1a, 3.2) })
};
