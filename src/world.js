/* ══════════════════════════════════════════════════════════
   MUNDO — renderer, câmera, céu, ciclo dia/noite e pós-processo
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { setEnvLevel } from './materials.js';

export const HOME_POS = new THREE.Vector3(-4, 27, 29);
export const HOME_TGT = new THREE.Vector3(0, 0, 1.5);

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false; // conta todos os passes do pós-processo

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8a7a66, 70, 190);

  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.5, 600);
  camera.position.set(6, 62, 70);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.screenSpacePanning = false;
  controls.panSpeed = 0.9;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;
  controls.minDistance = 14;
  controls.maxDistance = 62;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.18;
  controls.target.copy(HOME_TGT);
  controls.enabled = false;

  /* IBL — reflexos nos metais */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  /* ── céu: gradiente + halo do sol + estrelas ── */
  const skyU = {
    uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uBot: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
    uStars: { value: 0 }, uTime: { value: 0 }
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uTop,uHor,uBot,uSunCol,uSunDir; uniform float uStars,uTime;
        varying vec3 vDir;
        float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 c = mix(uBot, uHor, smoothstep(-0.25, 0.0, h));
          c = mix(c, uTop, smoothstep(0.02, 0.6, h));
          float s = max(dot(d, normalize(uSunDir)), 0.0);
          c += uSunCol * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12);
          vec3 g = floor(d * 220.0);
          float st = step(0.9965, hash(g)) * smoothstep(0.05, 0.4, h);
          st *= 0.6 + 0.4 * sin(uTime * 2.0 + hash(g + 3.0) * 40.0);
          c += vec3(st) * uStars * 1.4;
          gl_FragColor = vec4(c, 1.0);
        }`
    })
  );
  scene.add(sky);

  /* ── luzes ── */
  const hemi = new THREE.HemisphereLight(0xb8c9d6, 0x2a2018, 0.5);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1dc, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const SC = sun.shadow.camera;
  SC.left = -30; SC.right = 30; SC.top = 24; SC.bottom = -24; SC.near = 5; SC.far = 140;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  /* ── ciclo dia/noite por keyframes ── */
  const K = [
    { t: 0.00, n: 'dia',   sun: 0xfff0d8, si: 3.6, dir: [0.75, 0.72, 0.5], hs: 0xb9c6cf, hg: 0x2b2118, hi: 0.95, top: 0x55819e, hor: 0xcdbb9c, bot: 0x3a332c, fog: 0x9aa0a0, env: 1.0, lamp: 0.0, exp: 0.95, stars: 0 },
    { t: 0.30, n: 'dia',   sun: 0xffe6c4, si: 3.4, dir: [-0.45, 0.8, 0.55], hs: 0xb3bcc2, hg: 0x2b2118, hi: 0.9, top: 0x50728c, hor: 0xd3b48c, bot: 0x3a332c, fog: 0x9c917e, env: 0.95, lamp: 0.0, exp: 0.95, stars: 0 },
    { t: 0.42, n: 'tarde', sun: 0xff7f3e, si: 2.3, dir: [-0.95, 0.32, 0.25], hs: 0x8a6c6a, hg: 0x1a110c, hi: 0.38, top: 0x27304a, hor: 0xff8445, bot: 0x22160f, fog: 0x6b4634, env: 0.42, lamp: 0.55, exp: 1.02, stars: 0.05 },
    { t: 0.52, n: 'noite', sun: 0x89a9ff, si: 0.85, dir: [-0.35, 1.0, -0.55], hs: 0x1b3346, hg: 0x07090c, hi: 0.32, top: 0x02040a, hor: 0x0c1f2c, bot: 0x05070a, fog: 0x0b1620, env: 0.2, lamp: 1.0, exp: 1.12, stars: 1 },
    { t: 0.84, n: 'noite', sun: 0x89a9ff, si: 0.85, dir: [0.35, 1.0, -0.55], hs: 0x1b3346, hg: 0x07090c, hi: 0.32, top: 0x02040a, hor: 0x0c1f2c, bot: 0x05070a, fog: 0x0b1620, env: 0.2, lamp: 1.0, exp: 1.12, stars: 1 },
    { t: 0.93, n: 'aurora', sun: 0xffc293, si: 1.6, dir: [0.95, 0.28, -0.2], hs: 0x7f8fa8, hg: 0x1a1612, hi: 0.42, top: 0x31506e, hor: 0xefb185, bot: 0x2a2622, fog: 0x8a7e74, env: 0.45, lamp: 0.4, exp: 1.0, stars: 0.15 },
    { t: 1.00, n: 'dia',   sun: 0xfff0d8, si: 3.6, dir: [0.75, 0.72, 0.5], hs: 0xb9c6cf, hg: 0x2b2118, hi: 0.95, top: 0x55819e, hor: 0xcdbb9c, bot: 0x3a332c, fog: 0x9aa0a0, env: 1.0, lamp: 0.0, exp: 0.95, stars: 0 }
  ];
  for (const k of K) {
    for (const f of ['sun', 'hs', 'hg', 'top', 'hor', 'bot', 'fog']) k[f] = new THREE.Color(k[f]);
    k.dir = new THREE.Vector3(...k.dir).normalize();
  }
  const tmpC = new THREE.Color(), tmpV = new THREE.Vector3();
  const sky2 = { lamp: 0, phase: 'dia' };
  const smooth = x => x * x * (3 - 2 * x);

  function setTimeOfDay(t) {
    t = ((t % 1) + 1) % 1;
    let i = 0;
    while (i < K.length - 2 && t > K[i + 1].t) i++;
    const a = K[i], b = K[i + 1];
    const f = smooth(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
    const L = (x, y) => x + (y - x) * f;

    sun.color.copy(a.sun).lerp(b.sun, f);
    sun.intensity = L(a.si, b.si);
    tmpV.copy(a.dir).lerp(b.dir, f).normalize();
    sun.position.copy(tmpV).multiplyScalar(60);
    sun.target.position.set(0, 0, 0);
    hemi.color.copy(a.hs).lerp(b.hs, f);
    hemi.groundColor.copy(a.hg).lerp(b.hg, f);
    hemi.intensity = L(a.hi, b.hi);
    skyU.uTop.value.copy(a.top).lerp(b.top, f);
    skyU.uHor.value.copy(a.hor).lerp(b.hor, f);
    skyU.uBot.value.copy(a.bot).lerp(b.bot, f);
    skyU.uSunDir.value.copy(tmpV);
    skyU.uSunCol.value.copy(sun.color).multiplyScalar(Math.min(1, sun.intensity / 2.5));
    skyU.uStars.value = L(a.stars, b.stars);
    scene.fog.color.copy(a.fog).lerp(b.fog, f);
    setEnvLevel(L(a.env, b.env));
    renderer.toneMappingExposure = L(a.exp, b.exp);
    sky2.lamp = L(a.lamp, b.lamp);
    sky2.phase = f < 0.5 ? a.n : b.n;
    return sky2;
  }

  /* ── pós-processo: bloom HDR + vinheta/grão + saída ACES ── */
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.5, 1.7);
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.42 }, uGrain: { value: 0.045 }, uShake: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float uTime,uVig,uGrain,uShake; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        // aberração cromática leve nas bordas (+ choque de dano)
        vec2 d = uv - 0.5;
        float ca = 0.0012 + uShake * 0.006;
        vec4 c;
        c.r = texture2D(tDiffuse, uv - d * ca).r;
        c.g = texture2D(tDiffuse, uv).g;
        c.b = texture2D(tDiffuse, uv + d * ca).b;
        c.a = 1.0;
        float v = smoothstep(0.95, 0.25, length(d * vec2(1.05, 1.0)));
        c.rgb *= mix(1.0 - uVig, 1.0, v);
        c.rgb = mix(c.rgb, c.rgb * vec3(1.6, 0.5, 0.4), uShake * 0.35 * (1.0 - v));
        float g = hash(uv * vec2(1931.0, 1087.0) + fract(uTime) * 91.0) - 0.5;
        c.rgb += g * uGrain * (c.rgb + 0.015);
        gl_FragColor = c;
      }`
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    // em retrato, abre o FOV para o tabuleiro largo caber
    camera.fov = camera.aspect < 1 ? 38 + (1 - camera.aspect) * 34 : 38;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  }
  resize();

  return { renderer, scene, camera, controls, sun, hemi, sky, skyU, composer, bloom, grade, setTimeOfDay, resize };
}
