// Build after `pnpm build:cloudflare`. Outputs a self-contained local QA fixture.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const packages = path.join(root, 'node_modules/.pnpm');
const esbuildPath = fs.readdirSync(packages).filter(n => n.startsWith('esbuild@')).sort().at(-1);
if (!esbuildPath) throw new Error('Install project dependencies first.');
const {build} = require(path.join(packages, esbuildPath, 'node_modules/esbuild'));
const output = path.resolve(process.argv[2] || path.join(root, '.mobile-preview'));
fs.mkdirSync(output, {recursive: true});
await build({
  entryPoints: [path.join(root, 'tests/mobile-preview.tsx')],
  outfile: path.join(output, 'fixture.js'), bundle: true, minify: true,
  platform: 'browser', format: 'iife', jsx: 'automatic',
  tsconfig: path.join(root, 'tsconfig.json'), define: {'process.env.NODE_ENV': '"production"'},
});
const cssDir = path.join(root, 'dist/client/_next/static/css');
const css = fs.readdirSync(cssDir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n');
fs.writeFileSync(path.join(output, 'fixture.css'), css + '\n' + fs.readFileSync(path.join(root, 'app/mobile.css'), 'utf8'));
fs.writeFileSync(path.join(output, 'frame.html'), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content"><link rel="stylesheet" href="fixture.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>`);
fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Mercato — contrôle mobile local</title><style>
body{margin:0;padding:16px;font:14px Arial;background:#e7e8ee;color:#161826}header{display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap}select,button{padding:10px}iframe{display:block;border:0;box-shadow:0 8px 35px #0004;border-radius:14px;background:#101116}#label{font-weight:700}
</style></head><body><header><strong>Contrôle local · données fictives</strong><label>Taille <select id="size"><option value="390,844">390 × 844</option><option value="320,568">320 × 568</option><option value="375,667">375 × 667</option><option value="430,932">430 × 932</option><option value="768,1024">768 × 1024</option><option value="844,390">844 × 390 · paysage</option><option value="1440,900">1440 × 900</option></select></label><label>Écran <select id="stage"><option value="home">Accueil</option><option value="lobby">Salon</option><option value="auction">Enchères publiques</option><option value="sealed">Offres secrètes</option><option value="formation3">Composition 3</option><option value="formation5">Composition 5</option><option value="battle">Duels</option><option value="results">Résultats</option></select></label><button id="restart">Recharger le scénario</button></header><iframe id="game" title="Jeu en aperçu mobile" width="390" height="844" src="frame.html?stage=home"></iframe><script>
const size=document.querySelector('#size'),stage=document.querySelector('#stage'),frame=document.querySelector('#game');
size.onchange=()=>{const [w,h]=size.value.split(',');frame.width=w;frame.height=h};
const reset=()=>{frame.src='frame.html?stage='+stage.value};stage.onchange=reset;document.querySelector('#restart').onclick=reset;
</script></body></html>`);
console.log(output);
