import {database} from '@/lib/game/db';
import {CATALOG} from '@/lib/game/catalog';
import {createRoom,applyAction,advance,viewRoom,publicCard,GameError} from '@/lib/game/engine';
import type {Action,Room} from '@/lib/game/types';
export const dynamic='force-dynamic';
const DEV=import.meta.env.DEV;
const headers={'Cache-Control':'no-store, private','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
function json(data:unknown,status=200,cookie?:string){return new Response(JSON.stringify(data),{status,headers:{...headers,...(cookie?{'Set-Cookie':cookie}:{})}})}
function session(req:Request){const raw=req.headers.get('cookie')?.match(/(?:^|;\s*)mm_session=([a-f0-9-]{72,80})(?:;|$)/)?.[1];return raw||null;}
async function rate(db:D1Database,key:string,limit:number,now:number){
 const bucket=Math.floor(now/3600000);const k=`${key}:${bucket}`;
 const result=await db.prepare('INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(k,now+3600000).first<{count:number}>();
 if(result&&result.count>limit)throw new GameError('Trop de tentatives. Réessayez un peu plus tard.',429);
}
async function update(code:string,sid:string,action?:Action){
 const db=database();const now=Date.now();
 for(let attempt=0;attempt<12;attempt++){
  const row=await db.prepare('SELECT state,version FROM rooms WHERE code=?').bind(code).first<{state:string;version:number}>();
  if(!row)throw new GameError('Aucun salon avec ce code.',404);const r=JSON.parse(row.state) as Room;
  if(now-r.updatedAt>24*3600000)throw new GameError('Cette partie a expiré. Créez un nouveau salon.',410);
  if(!action&&!r.players.some(p=>p.sid===sid))throw new GameError('Rejoignez le salon pour accéder à cette partie.',403);
  let changed=advance(r,now);if(action){applyAction(r,sid,action,now,DEV);changed=true;}
  const me=r.players.find(p=>p.sid===sid);if(me&&now-me.lastSeen>5000){me.lastSeen=now;changed=true;}
  if(!changed)return viewRoom(r,sid,now,DEV);
  r.version=row.version+1;r.updatedAt=now;
  const result=await db.prepare('UPDATE rooms SET state=?,version=?,updated_at=? WHERE code=? AND version=?').bind(JSON.stringify(r),r.version,now,code,row.version).run();
  if(result.meta.changes===1)return action?.type==='leave'?null:viewRoom(r,sid,now,DEV);
 }
 throw new GameError('Le marché est très actif. Réessayez cette action.',409);
}
function error(e:unknown){if(e instanceof GameError)return json({error:e.message},e.status);console.error('[mercato]',e instanceof Error?e.message:'unknown');return json({error:'La connexion au salon est momentanément indisponible. Réessayez.'},503)}
export async function GET(req:Request){try{
 const url=new URL(req.url);if(url.searchParams.get('catalog')==='1')return json({characters:CATALOG.map(c=>publicCard(c,'hidden'))});
 const sid=session(req);if(!sid)throw new GameError('Rejoignez une partie pour continuer.',401);const code=(url.searchParams.get('code')||'').toUpperCase();if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))throw new GameError('Le code contient 6 caractères.');
 return json({room:await update(code,sid)});
}catch(e){return error(e)}}
export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new GameError('Origine de requête invalide.',403);
 if(!req.headers.get('content-type')?.includes('application/json'))throw new GameError('Format de requête invalide.');
 if(Number(req.headers.get('content-length')||0)>20000)throw new GameError('Requête trop volumineuse.',413);
 const raw=await req.text();if(raw.length>20000)throw new GameError('Requête trop volumineuse.',413);let body:Action;try{body=JSON.parse(raw)}catch{throw new GameError('Requête invalide.')}
 if(!body||typeof body.type!=='string')throw new GameError('Action invalide.');let sid=session(req),cookie:string|undefined;
 if(!sid){sid=crypto.randomUUID()+crypto.randomUUID();cookie=`mm_session=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${new URL(req.url).protocol==='https:'?'; Secure':''}`;}
 const now=Date.now();const db=database();
 if(body.type==='create'){
  if(typeof body.requestId!=='string'||body.requestId.length<8||body.requestId.length>100)throw new GameError('Identifiant de requête manquant.');
  const existing=await db.prepare("SELECT state FROM rooms WHERE json_extract(state,'$.createRequest')=? AND json_extract(state,'$.creatorSid')=? LIMIT 1").bind(body.requestId,sid).first<{state:string}>();
  if(existing)return json({room:viewRoom(JSON.parse(existing.state),sid,now,DEV)},200,cookie);
  await rate(db,`create:${sid}`,30,now);const ip=req.headers.get('cf-connecting-ip');if(ip)await rate(db,`create-ip:${ip}`,100,now);
  // Expired rooms are removed opportunistically, without keeping timers in memory.
  await db.batch([db.prepare('DELETE FROM rooms WHERE updated_at<?').bind(now-48*3600000),db.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now-3600000)]);
  for(let i=0;i<4;i++){const bytes=crypto.getRandomValues(new Uint8Array(10)),alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const code=Array.from(bytes.slice(0,6)).map(x=>alphabet[x%alphabet.length]).join('');
   const seed=new DataView(bytes.buffer).getUint32(6);const r=createRoom(code,sid,String(body.name||''),body.settings||{},body.mode==='training'?'training':'friends',now,seed);
   Object.assign(r,{createRequest:body.requestId,creatorSid:sid});
   const created=await db.prepare('INSERT OR IGNORE INTO rooms (code,version,state,updated_at) VALUES (?,?,?,?)').bind(code,r.version,JSON.stringify(r),now).run();
   if(created.meta.changes)return json({room:viewRoom(r,sid,now,DEV)},200,cookie);
  }throw new GameError('Impossible de créer un salon. Réessayez.',503);
 }
 const code=String(body.code||'').toUpperCase();if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))throw new GameError('Le code contient 6 caractères.');
 if(body.type==='join')await rate(db,`join:${sid}`,100,now);
 return json({room:await update(code,sid,body)},200,cookie);
}catch(e){return error(e)}}
