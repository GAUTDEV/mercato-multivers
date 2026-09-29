import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const mode=process.argv[2]||'deploy';
if(!['prepare','deploy','dry-run'].includes(mode))throw new Error('Usage: node scripts/cloudflare-deploy.mjs prepare|deploy|dry-run');
const dry=mode==='dry-run';
const placeholder='00000000-0000-4000-8000-000000000000';
const id=process.env.CLOUDFLARE_D1_DATABASE_ID||(dry?placeholder:'');
if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||(!dry&&id===placeholder)){
 throw new Error('Set CLOUDFLARE_D1_DATABASE_ID to the UUID of your Cloudflare D1 database before deploying.');
}
const generated=path.join(root,'dist/server/wrangler.json');
if(!existsSync(generated))throw new Error('Run npm run build:cloudflare first.');
const config=JSON.parse(readFileSync(generated,'utf8'));
config.name='mercato-multivers';
config.workers_dev=true;
config.preview_urls=false;
config.d1_databases=[{binding:'DB',database_name:'mercato-multivers',database_id:id,migrations_dir:'../../drizzle'}];
delete config.topLevelName;
const target=path.join(root,'dist/server/wrangler.cloudflare.json');
writeFileSync(target,JSON.stringify(config,null,2)+'\n');
console.log('Prepared standalone Cloudflare Worker configuration.');
function wrangler(args){const result=spawnSync(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),...args,'--config',target],{cwd:root,stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);}
if(mode==='deploy'){
 // Apply the versioned schema before the Worker becomes reachable.
 wrangler(['d1','migrations','apply','DB','--remote']);
 wrangler(['deploy']);
}else if(dry){
 wrangler(['deploy','--dry-run','--outdir',path.join(root,'.wrangler/cloudflare-dry-run')]);
}
