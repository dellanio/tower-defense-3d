// Captura determinística do jogo em Chromium headless (Playwright).
// Uso:  npm install && node tools/shot.mjs <saida.png> "<query>" "[js]" [esperaMs] [w] [h]
// Ex.:  node tools/shot.mjs noite.png "shot&manual&tod=0.7" "__td.build('tesla',2,3); __td.advance(60)"
//
// ?manual  desliga o loop em tempo real; __td.advance(n, dt) avança n quadros e renderiza só o último.
// ?shot    pula a animação de entrada.   ?tod=0..1  fixa a hora do dia.   ?stress=N  cenário de carga.
// NOSHOT=1 só mede (window.__perf) sem salvar imagem.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THREE = process.env.THREE_DIR || path.join(ROOT, 'node_modules/three');
const [out = 'shot.png', query = 'shot&manual', script = '', wait = '500', w = '1600', h = '900'] = process.argv.slice(2);
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' };

const browser = await chromium.launch({
  // sem GPU no ambiente? o SwiftShader rasteriza WebGL na CPU (lento, mas fiel)
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});
const page = await (await browser.newContext({ viewport: { width: +w, height: +h } })).newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

// serve o repositório e troca o CDN do three pela cópia local
await page.route('**/*', async route => {
  const u = new URL(route.request().url());
  if (u.hostname === 'game.local') {
    const f = path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] || 'application/octet-stream' });
  }
  if (u.hostname === 'unpkg.com') {
    return route.fulfill({ body: fs.readFileSync(path.join(THREE, u.pathname.replace(/^\/three@[^/]+/, ''))), contentType: 'text/javascript' });
  }
  if (u.hostname.includes('fonts.')) return route.continue().catch(() => route.abort());
  return route.abort();
});

await page.goto(`http://game.local/?${query}`);
await page.waitForFunction(() => window.__td, null, { timeout: 60000 })
  .catch(() => { console.log(logs.join('\n')); process.exit(1); });
if (script) await page.evaluate(script).catch(e => logs.push('[eval] ' + e.message));
await page.waitForTimeout(+wait);
if (!process.env.NOSHOT) await page.screenshot({ path: out, timeout: 150000, animations: 'disabled' });
console.log(JSON.stringify(await page.evaluate(() => window.__perf || null)));
if (logs.length) console.log(logs.join('\n'));
await browser.close();
