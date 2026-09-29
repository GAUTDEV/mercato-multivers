import {CATALOG_BY_ID} from './catalog';
import {ABILITIES,SLOTS,STAT_KEYS,type Character,type Duel,type Role,type Stats} from './types';
export const COUNTERS:Partial<Record<Role,Role>>={attacker:'support',support:'assassin',assassin:'controller',controller:'tank',tank:'attacker'};
export function random(seed:number){let s=seed>>>0;return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function effective(c:Character,slot:number,behind:boolean):Stats{
 const s={...c.stats};for(const [k,v] of Object.entries(SLOTS[slot].boost))s[k as keyof Stats]*=v;
 if(slot===4&&behind){s.stamina*=1.1;s.defense*=1.06;}
 const ability:Record<string,Partial<Stats>>={burst:{power:1.09},bulwark:{defense:1.12},precision:{technique:1.1},adaptation:{intelligence:1.1,control:1.1},resolve:{stamina:1.13},tempo:{speed:1.12},recovery:{defense:1.07,stamina:1.09}};
 for(const [k,v] of Object.entries(ability[c.ability]||{}))s[k as keyof Stats]*=v;
 return s;
}
function pressure(a:Stats,b:Stats,roleA:Role,roleB:Role){
 const offense=a.power*.48+a.technique*.37+a.range*.15;
 const guard=b.defense*.57+b.stamina*.24+b.intelligence*.19;
 const aim=clamp(1+(a.speed-b.speed)*.003+(a.technique-b.technique)*.002,.78,1.22);
 const control=clamp(1+((a.control*.6+a.intelligence*.4)-(b.speed*.4+b.intelligence*.4+b.stamina*.2))*.003,.85,1.18);
 const counter=COUNTERS[roleA]===roleB?1.16:1;
 return Math.max(6,18+(offense-guard)*.2)*aim*control*counter*(.9+a.stamina*.0015);
}
export function simulateDuel(aId:string,bId:string,slot:number,seed:number,behindA=false,behindB=false):Duel{
 const a=CATALOG_BY_ID[aId],b=CATALOG_BY_ID[bId];if(!a||!b)throw new Error('Combattant inconnu');
 const as=effective(a,slot,behindA),bs=effective(b,slot,behindB);if(a.ability==='disruption')bs.speed*=.92;if(b.ability==='disruption')as.speed*=.92;
 const rnd=random(seed);const ap=pressure(as,bs,a.role,b.role)*(1+(rnd()-.5)*.05),bp=pressure(bs,as,b.role,a.role)*(1+(rnd()-.5)*.05);
 const maxA=78+as.defense*.30+as.stamina*.32,maxB=78+bs.defense*.30+bs.stamina*.32;
 const scoreA=ap/maxB*(1+as.speed*.0007),scoreB=bp/maxA*(1+bs.speed*.0007);
 const winner=scoreA>=scoreB?'a':'b';
 const advantage=(own:Character,other:Character,s:Stats,o:Stats,behind:boolean)=>{
  const reasons=[`${SLOTS[slot].name} : ${SLOTS[slot].short.toLowerCase()}`];
  if(COUNTERS[own.role]===other.role)reasons.unshift('Contre de rôle : pression +16 %');
  if(s.technique-o.technique>8)reasons.push('Meilleure technique : la garde est percée');
  if(s.speed-o.speed>8)reasons.push('Vitesse supérieure : plus de coups efficaces');
  if(s.stamina-o.stamina>8)reasons.push('Endurance supérieure sur la durée');
  if(s.defense-o.defense>8)reasons.push('Résistance supérieure : les coups sont absorbés');
  if(s.control+s.intelligence-o.control-o.intelligence>15)reasons.push('Le contrôle perturbe le rythme adverse');
  reasons.push(`Passif : ${ABILITIES[own.ability].name}`);
  if(slot===4&&behind)reasons.push('Retour au score : endurance +10 %, résistance +6 %');
  return reasons;
 };
 const frames:Duel['frames']=[];let hpA=maxA,hpB=maxB;
 const first=as.speed>=bs.speed?'a':'b';
 for(let t=0;t<10;t++){
  const actor=t%2===0?first:first==='a'?'b':'a';const isA=actor==='a';const critical=t===6||t===7;
  const damage=(isA?ap:bp)*(critical?1.13:1)*(1+(rnd()-.5)*.08);
  if(isA)hpB=Math.max(1,hpB-damage);else hpA=Math.max(1,hpA-damage);
  const names=['Prise d’initiative','Test de la garde','Pression offensive','Riposte technique','Le rythme s’accélère'];
  frames.push({a:Math.max(1,Math.round(hpA/maxA*100)),b:Math.max(1,Math.round(hpB/maxB*100)),actor,label:critical?'Ouverture exploitée':names[Math.floor(t/2)],critical});
 }
 // The finishing animation must never appear to heal a combatant.
 const lastHp=winner==='a'?frames[frames.length-1].a:frames[frames.length-1].b;
 const winHp=Math.min(lastHp,clamp(Math.round(Math.abs(scoreA-scoreB)/Math.max(scoreA,scoreB)*100+9),9,85));
 frames.push({a:winner==='a'?winHp:0,b:winner==='b'?winHp:0,actor:winner,label:'Avantage décisif',critical:true});
 return {slot,aId,bId,winner,scoreA:Math.round(scoreA*1000),scoreB:Math.round(scoreB*1000),hpA:maxA,hpB:maxB,frames,reasonsA:advantage(a,b,as,bs,behindA),reasonsB:advantage(b,a,bs,as,behindB),statsA:a.stats,statsB:b.stats};
}
export function bestFormation(ids:string[]):string[]{
 // A small assignment problem (at most 5!) gives bots sensible slot choices.
 let best=-Infinity,formation=[...ids];
 function visit(order:string[],rest:string[]){if(!rest.length){let score=0;order.forEach((id,i)=>{const c=CATALOG_BY_ID[id];for(const [k,v] of Object.entries(SLOTS[i].boost))score+=c.stats[k as keyof Stats]*(v-1)});if(score>best){best=score;formation=order}return}rest.forEach((id,i)=>visit([...order,id],rest.filter((_,j)=>i!==j)));}
 visit([],ids);return formation;
}
