import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const sql=new DatabaseSync(':memory:');
sql.exec(fs.readFileSync('drizzle/0000_sticky_longshot.sql','utf8'));
// Run the real route and real SQLite queries; only Cloudflare's D1 binding is adapted.
globalThis.__testDB={prepare(query){const stmt=sql.prepare(query);let values=[];return {bind(...v){values=v;return this},async first(){return stmt.get(...values)||null},async run(){return {meta:{changes:Number(stmt.run(...values).changes)}}}}},async batch(statements){return Promise.all(statements.map(s=>s.run()))}};
fs.writeFileSync('.test-build/db.js','export function database(){return globalThis.__testDB}');
const src=fs.readFileSync('app/api/game/route.ts','utf8').replaceAll("'@/lib/game/","'./").replace('import.meta.env.DEV','false');
fs.writeFileSync('.test-build/route.js',ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '([^']+)'/g,(_,p)=>`from '${p}.js'`));
const {GET,POST}=await import('../.test-build/route.js');
const sid=()=>`mm_session=${crypto.randomUUID()}${crypto.randomUUID()}`;
const host=sid(),guest=sid();let code;
async function post(cookie,data){const response=await POST(new Request('https://game.test/api/game',{method:'POST',headers:{cookie,origin:'https://game.test','content-type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),...data})}));return {status:response.status,data:await response.json()};}
async function get(cookie){const response=await GET(new Request(`https://game.test/api/game?code=${code}`,{headers:{cookie}}));return {status:response.status,data:await response.json()};}
test('API: create, join, concurrent bids, sealed data, reconnect, and authorization',async()=>{
 const created=await post(host,{type:'create',name:'Host',settings:{maxPlayers:2,teamSize:3,auctionSeconds:5,events:false}});assert.equal(created.status,200);code=created.data.room.code;
 const joined=await post(guest,{type:'join',code,name:'Guest'});assert.equal(joined.status,200);
 assert.equal((await get(sid())).status,403);
 assert.equal((await post(guest,{type:'start',code})).status,400);
 await post(guest,{type:'ready',code});assert.equal((await post(host,{type:'start',code})).status,200);
 const row=sql.prepare('SELECT state FROM rooms WHERE code=?').get(code);const room=JSON.parse(row.state);room.phaseEndsAt=Date.now()-1;sql.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(room),code);
 assert.equal((await get(host)).data.room.phase,'auction');
 const bids=await Promise.all([post(host,{type:'bid',code,amount:20,expectedRound:1}),post(guest,{type:'bid',code,amount:25,expectedRound:1})]);assert.ok(bids.every(b=>b.status===200));
 const snapshot=(await get(host)).data.room;assert.equal(snapshot.auction.bid,25);assert.equal(snapshot.players[0].budget,100);assert.equal('sid' in snapshot.players[0],false);assert.equal(snapshot.cards[snapshot.auction.characterId].stats,undefined);
 assert.equal((await post(host,{type:'bid',code,amount:999,expectedRound:1})).status,400);
 assert.equal((await post(host,{type:'debug:budget',code})).status,400);
 const saved=JSON.parse(sql.prepare('SELECT state FROM rooms WHERE code=?').get(code).state);saved.auction.endsAt=Date.now()-1;sql.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(saved),code);
 const sold=(await get(guest)).data.room;assert.equal(sold.phase,'sold');assert.equal(sold.players.find(p=>p.id===sold.meId).budget,75);
 const refresh=(await get(guest)).data.room;assert.equal(refresh.players.find(p=>p.id===refresh.meId).roster.length,1);
 assert.equal((await post(host,{type:'bid',code,amount:30,expectedRound:1})).status,400);
});
test('API: rejects foreign origins and malformed input',async()=>{const response=await POST(new Request('https://game.test/api/game',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:'{}'}));assert.equal(response.status,403);const malformed=await POST(new Request('https://game.test/api/game',{method:'POST',headers:{'content-type':'application/json'},body:'{'}));assert.equal(malformed.status,400)});
test('API: same create request and session return the same room',async()=>{const requestId=crypto.randomUUID();const data={type:'create',requestId,name:'Retry',settings:{maxPlayers:2}};const one=await post(host,data),two=await post(host,data);assert.equal(one.data.room.code,two.data.room.code)});
