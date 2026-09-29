import fs from 'node:fs';
import ts from 'typescript';
import {spawnSync} from 'node:child_process';
fs.mkdirSync('.test-build',{recursive:true});
for(const name of ['types','catalog','combat','engine']){
 const input=fs.readFileSync(`lib/game/${name}.ts`,'utf8');
 const output=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '([^']+)'/g,(_,p)=>`from '${p.startsWith('.')?p+'.js':p}'`);
 fs.writeFileSync(`.test-build/${name}.js`,output);
}
const r=spawnSync(process.execPath,['--test','tests/engine.test.mjs'],{stdio:'inherit'});process.exit(r.status||0);
