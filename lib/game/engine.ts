import {CATALOG,CATALOG_BY_ID} from './catalog';
import {random,simulateDuel,bestFormation} from './combat';
import {DEFAULT_SETTINGS,UNIVERSES,STAT_KEYS,type Room,type Settings,type Player,type Action,type RoomView,type CardData,type Character,type Stats,type Visibility} from './types';
export class GameError extends Error { constructor(message:string,public status=400){super(message)} }
const insist=(x:unknown,m:string)=>{if(!x)throw new GameError(m)};
const RANK_ORDER=['D','C','B','A','S','SS'];
export function validateSettings(input:Partial<Settings>={}):Settings{
 const s={...DEFAULT_SETTINGS,...input};
 const number=(key:keyof Settings,min:number,max:number)=>insist(Number.isInteger(s[key])&&Number(s[key])>=min&&Number(s[key])<=max,`Réglage invalide : ${key}`);
 number('maxPlayers',2,6);number('teamSize',3,5);insist([3,5].includes(s.teamSize),'Équipes de 3 ou 5 combattants.');number('budget',30,300);number('marketSize',6,112);number('auctionSeconds',5,45);number('formationSeconds',20,180);
 insist(['partial','full','approximate','hidden','expert'].includes(s.visibility),'Visibilité invalide.');insist(['public','sealed'].includes(s.auctionMode),'Mode d’enchère invalide.');
 insist(Array.isArray(s.universes)&&s.universes.length>0&&s.universes.every(u=>UNIVERSES.some(x=>x.id===u)),'Choisissez au moins un univers.');s.universes=[...new Set(s.universes)];s.events=!!s.events;s.antiSnipe=!!s.antiSnipe;
 return s;
}
const nameOf=(s:unknown)=>{insist(typeof s==='string','Choisissez un pseudo.');const n=String(s).trim().slice(0,22);insist(n.length>=2,'Le pseudo doit contenir au moins 2 caractères.');return n};
export function createRoom(code:string,sid:string,name:string,settings:Partial<Settings>,mode:Room['mode'],now:number,seed:number):Room{
 const s=validateSettings(settings);const host:Player={id:crypto.randomUUID(),sid,name:nameOf(name),color:0,bot:false,ready:true,budget:s.budget,roster:[],formation:[],locked:false,left:false,lastSeen:now};
 const r:Room={code,version:0,hostId:host.id,mode,phase:'lobby',settings:s,players:[host],deck:[],pool:[],round:0,auction:null,phaseEndsAt:0,lastSale:null,matches:[],awards:[],seed,createdAt:now,updatedAt:now,receipts:{},log:[]};
 if(mode==='training'){for(let i=1;i<s.maxPlayers;i++)addBot(r,now);start(r,now)}return r;
}
function note(r:Room,text:string,kind:string,now:number){r.log.unshift({id:`${now}-${r.log.length}-${r.round}`,text,kind,at:now});r.log=r.log.slice(0,40)}
function addBot(r:Room,now:number){insist(r.players.filter(p=>!p.left).length<r.settings.maxPlayers,'Le salon est complet.');let ix=1;while(r.players.some(p=>p.name===`Bot ${['Kira','Nova','Zen','Rin','Aki'][ix-1]}`))ix++;const i=r.players.length;r.players.push({id:crypto.randomUUID(),sid:'bot',name:`Bot ${['Kira','Nova','Zen','Rin','Aki'][ix-1]||ix}`,color:i%6,bot:true,ready:true,budget:r.settings.budget,roster:[],formation:[],locked:false,left:false,lastSeen:now});}
function start(r:Room,now:number){
 const active=r.players.filter(p=>!p.left);insist(active.length>=2,'Il faut au moins 2 joueurs. Ajoutez un bot.');insist(active.every(p=>p.ready),'Tous les joueurs doivent être prêts.');
 const eligible=CATALOG.filter(c=>r.settings.universes.includes(c.universe));insist(eligible.length>=active.length*r.settings.teamSize,'Ajoutez un univers : il manque des combattants pour remplir les équipes.');
 const rnd=random(r.seed);r.pool=eligible.map(c=>c.id);r.deck=[...r.pool];for(let i=r.deck.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[r.deck[i],r.deck[j]]=[r.deck[j],r.deck[i]];}
 r.deck=r.deck.slice(0,Math.min(r.settings.marketSize,r.deck.length));r.players=active;r.round=0;r.matches=[];r.awards=[];r.log=[];for(const p of active){p.budget=r.settings.budget;p.roster=[];p.formation=[];p.locked=false}nextAuction(r,now);
}
function nextAuction(r:Room,now:number){
 if(r.round>=r.deck.length||r.players.every(p=>p.roster.length>=r.settings.teamSize)){beginFormation(r,now);return;}
 const characterId=r.deck[r.round];r.round++;const event=r.settings.events&&r.round%5===0?(r.round%10===0?'scouting':'express'):null;
 r.auction={characterId,round:r.round,endsAt:0,startedAt:now,bid:0,leader:null,bids:[],sealed:{},botAt:0,event};r.phase='reveal';r.phaseEndsAt=now+(r.mode==='training'?2800:3800);note(r,`Lot ${r.round} : ${CATALOG_BY_ID[characterId].name} entre sur le marché.`, 'reveal',now);
}
function beginFormation(r:Room,now:number){
 const owned=new Set(r.players.flatMap(p=>p.roster.map(x=>x.characterId)));const available=r.pool.filter(id=>!owned.has(id)).sort((a,b)=>CATALOG_BY_ID[a].baseValue-CATALOG_BY_ID[b].baseValue);
 for(const p of r.players){let filled=0;while(p.roster.length<r.settings.teamSize){const id=available.shift();if(!id)throw new GameError('Réserve de recrutement épuisée.');p.roster.push({characterId:id,price:0,round:0,reinforcement:true});filled++;}if(filled)note(r,`${p.name} reçoit ${filled} renfort${filled>1?'s':''} de réserve.`, 'reserve',now);p.formation=bestFormation(p.roster.map(x=>x.characterId));p.locked=p.bot||p.left;}
 r.phase='formation';r.auction=null;r.phaseEndsAt=now+r.settings.formationSeconds*1000;note(r,'Placez secrètement vos combattants. Les équipes seront révélées ensemble.', 'formation',now);
}
function beginBattle(r:Room,now:number){
 r.matches=[];let mi=0;
 for(let a=0;a<r.players.length;a++)for(let b=a+1;b<r.players.length;b++){
  const pa=r.players[a],pb=r.players[b];let scoreA=0,scoreB=0;const duels=[];
  // Every scheduled slot is played for a complete scoreline and fair league tiebreaks.
  for(let i=0;i<r.settings.teamSize;i++){const d=simulateDuel(pa.formation[i],pb.formation[i],i,r.seed+mi*917+i*73,scoreA<scoreB,scoreB<scoreA);duels.push(d);if(d.winner==='a')scoreA++;else scoreB++;}
  r.matches.push({a:pa.id,b:pb.id,scoreA,scoreB,winner:scoreA>scoreB?pa.id:pb.id,duels});mi++;
 }
 r.players.forEach(p=>p.locked=true);r.phase='battle';r.phaseEndsAt=now+Math.max(1,r.players.length-1)*r.settings.teamSize*16000+10000;computeAwards(r);note(r,'Les formations sont révélées. Place aux duels.', 'battle',now);
}
function computeAwards(r:Room){
 const entries=r.players.flatMap(p=>p.roster.filter(x=>!x.reinforcement).map(x=>({...x,playerId:p.id,c:CATALOG_BY_ID[x.characterId]})));
 if(!entries.length){r.awards=[];return}const wins:Record<string,number>={};for(const m of r.matches)for(const d of m.duels){const id=d.winner==='a'?d.aId:d.bId;wins[id]=(wins[id]||0)+1;}
 const by=(fn:(x:typeof entries[number])=>number)=>[...entries].sort((a,b)=>fn(b)-fn(a))[0];
 const max=by(x=>x.price),value=by(x=>x.c.baseValue-x.price),mvp=by(x=>(wins[x.characterId]||0)*100+x.c.baseValue),roi=by(x=>(wins[x.characterId]||0)/Math.max(1,x.price));
 r.awards=[{title:'MVP des duels',playerId:mvp.playerId,characterId:mvp.characterId,value:`${wins[mvp.characterId]||0} victoire(s)`},{title:'Meilleure affaire',playerId:value.playerId,characterId:value.characterId,value:`Recruté pour ${value.price} M`},{title:'Record du mercato',playerId:max.playerId,characterId:max.characterId,value:`${max.price} M investis`},{title:'Meilleur rendement',playerId:roi.playerId,characterId:roi.characterId,value:`${((wins[roi.characterId]||0)/Math.max(1,roi.price)).toFixed(2)} victoire / M`}];
}
export function maxBid(r:Room,p:Player){return Math.max(0,p.budget-Math.max(0,r.settings.teamSize-p.roster.length-1))}
function placeBid(r:Room,p:Player,amount:number,now:number){
 const a=r.auction!;insist(r.phase==='auction'&&now<a.endsAt,'Cette enchère est terminée.');insist((!p.left||p.bot)&&p.roster.length<r.settings.teamSize,'Votre équipe est déjà complète.');insist(Number.isSafeInteger(amount)&&amount>=1,'Entrez un montant entier positif.');insist(amount<=maxBid(r,p),'Budget insuffisant : gardez 1 M par place encore libre.');
 if(r.settings.auctionMode==='sealed'){insist(amount>(a.sealed[p.id]?.amount||0),'Votre nouvelle offre doit être supérieure.');a.sealed[p.id]={playerId:p.id,amount,at:now};}
 else{insist(a.leader!==p.id,'Vous menez déjà cette enchère.');insist(amount>a.bid,'Une offre supérieure vient d’arriver.');a.bid=amount;a.leader=p.id;a.bids.unshift({playerId:p.id,amount,at:now});a.bids=a.bids.slice(0,12);if(r.settings.antiSnipe&&a.endsAt-now<3000&&a.endsAt<a.startedAt+60000)a.endsAt=Math.min(a.startedAt+60000,now+3000);}
}
function bots(r:Room,now:number){
 const a=r.auction!;if(now<a.botAt)return;a.botAt=now+900+(r.round%3)*170;const c=CATALOG_BY_ID[a.characterId];const rnd=random(r.seed+r.round*1009+Math.floor(now/1600));
 const eligible=r.players.filter(p=>p.bot&&p.roster.length<r.settings.teamSize&&p.budget>0&&p.id!==a.leader);
 if(!eligible.length)return;const bot=eligible[Math.floor(rnd()*eligible.length)];
 const slots=r.settings.teamSize-bot.roster.length;const sameRole=bot.roster.filter(x=>CATALOG_BY_ID[x.characterId].role===c.role).length;
 const willingness=Math.max(1,Math.round(Math.min(c.baseValue*(.85+rnd()*.6)*(r.settings.budget/100)*(sameRole?.84:1),bot.budget/slots*1.8)));
 const limit=Math.min(maxBid(r,bot),willingness);
 if(r.settings.auctionMode==='sealed'){if(!a.sealed[bot.id]&&limit>0)a.sealed[bot.id]={playerId:bot.id,amount:limit,at:now};}
 else{const amount=a.bid+([1,2,5][Math.floor(rnd()*3)]);if(amount<=limit&&rnd()>.16)placeBid(r,bot,amount,now);}
}
function closeAuction(r:Room,now:number){
 const a=r.auction!;if(r.settings.auctionMode==='sealed'){const best=Object.values(a.sealed).sort((x,y)=>y.amount-x.amount||x.at-y.at||x.playerId.localeCompare(y.playerId))[0];a.leader=best?.playerId||null;a.bid=best?.amount||0;a.bids=Object.values(a.sealed).sort((x,y)=>y.amount-x.amount);}
 const p=r.players.find(p=>p.id===a.leader);
 if(p){insist(p.budget>=a.bid,'Budget incohérent.');p.budget-=a.bid;p.roster.push({characterId:a.characterId,price:a.bid,round:r.round});note(r,`${CATALOG_BY_ID[a.characterId].name} rejoint ${p.name} pour ${a.bid} M.`, 'sold',now)}else note(r,`${CATALOG_BY_ID[a.characterId].name} reste sans offre.`, 'unsold',now);
 r.lastSale={characterId:a.characterId,playerId:a.leader,price:a.bid};r.phase='sold';r.phaseEndsAt=now+2400;
}
export function advance(r:Room,now:number):boolean{
 let changed=false;for(let i=0;i<6;i++){
 if(r.phase==='reveal'&&now>=r.phaseEndsAt){r.phase='auction';r.auction!.startedAt=now;r.auction!.endsAt=now+(r.auction!.event==='express'?Math.max(5,r.settings.auctionSeconds-5):r.settings.auctionSeconds)*1000;r.auction!.botAt=now+1000;changed=true;break;}
 if(r.phase==='auction'){if(now>=r.auction!.endsAt){closeAuction(r,now);changed=true;continue}if(now>=r.auction!.botAt){bots(r,now);changed=true}break;}
 if(r.phase==='sold'&&now>=r.phaseEndsAt){nextAuction(r,now);changed=true;continue}
 if(r.phase==='formation'&&(now>=r.phaseEndsAt||r.players.every(p=>p.locked))){beginBattle(r,now);changed=true;continue}
 if(r.phase==='battle'&&now>=r.phaseEndsAt){r.phase='results';changed=true}break;
 }return changed;
}
export function applyAction(r:Room,sid:string,a:Action,now:number,dev=false):string|null{
 insist(typeof a.requestId==='string'&&a.requestId.length>=8&&a.requestId.length<=100,'Identifiant de requête manquant.');const receipt=`${sid}:${a.requestId}`;if(receipt in r.receipts)return r.receipts[receipt]||null;
 advance(r,now);let p=r.players.find(p=>p.sid===sid);const host=()=>insist(p?.id===r.hostId,'Action réservée à l’hôte.');
 if(a.type==='join'){
  insist(r.phase==='lobby','Cette partie a déjà commencé.');
  if(p){p.left=false;p.lastSeen=now;}else{insist(r.players.filter(p=>!p.left).length<r.settings.maxPlayers,'Ce salon est complet.');const n=nameOf(a.name);insist(!r.players.some(p=>p.name.toLowerCase()===n.toLowerCase()&&!p.left),'Ce pseudo est déjà pris.');p={id:crypto.randomUUID(),sid,name:n,color:r.players.length%6,bot:false,ready:false,budget:r.settings.budget,roster:[],formation:[],locked:false,left:false,lastSeen:now};r.players.push(p);note(r,`${p.name} entre dans le salon.`, 'join',now);}
 }else{
  insist(p&&!p.left,'Rejoignez cette partie pour jouer.');p=p!;p.lastSeen=now;
  if(a.type==='ready'){insist(r.phase==='lobby','La partie a commencé.');p.ready=!p.ready}
  else if(a.type==='settings'){host();insist(r.phase==='lobby','La partie a commencé.');r.settings=validateSettings({...r.settings,...a.settings});insist(r.players.filter(p=>!p.left).length<=r.settings.maxPlayers,'Retirez un bot avant de réduire les places.');r.players.forEach(x=>{x.budget=r.settings.budget;if(x.id!==r.hostId&&!x.bot)x.ready=false;});}
  else if(a.type==='addBot'){host();insist(r.phase==='lobby','La partie a commencé.');addBot(r,now)}
  else if(a.type==='removeBot'){host();insist(r.phase==='lobby','La partie a commencé.');const bot=r.players.find(x=>x.id===a.playerId);insist(bot?.bot,'Seuls les bots peuvent être retirés.');r.players=r.players.filter(x=>x.id!==a.playerId)}
  else if(a.type==='start'){host();insist(r.phase==='lobby','La partie a déjà commencé.');start(r,now)}
  else if(a.type==='bid'){insist(a.expectedRound===r.round,'Le marché est passé au lot suivant.');placeBid(r,p,Number(a.amount),now)}
  else if(a.type==='formation'||a.type==='lock'){
   insist(r.phase==='formation','Le placement est terminé.');insist(!p.locked,'Votre composition est verrouillée.');const ids=a.formation;insist(Array.isArray(ids)&&ids.length===r.settings.teamSize&&new Set(ids).size===ids.length&&ids.every(id=>p!.roster.some(x=>x.characterId===id)),'Composition invalide.');p.formation=[...ids!];if(a.type==='lock')p.locked=true;
  }
  else if(a.type==='skipBattle'){host();insist(r.phase==='battle','Aucun combat en cours.');r.phase='results';}
  else if(a.type==='rematch'){host();insist(r.phase==='results','Terminez la partie avant la revanche.');r.phase='lobby';r.seed=(r.seed+73121)>>>0;r.round=0;r.auction=null;r.phaseEndsAt=0;r.lastSale=null;r.matches=[];r.awards=[];r.deck=[];r.pool=[];r.players=r.players.filter(x=>!x.left);r.players.forEach(x=>{x.ready=x.bot||x.id===r.hostId;x.roster=[];x.formation=[];x.budget=r.settings.budget;x.locked=false});}
  else if(a.type==='leave'){p.left=true;if(r.phase==='lobby')r.players=r.players.filter(x=>x.id!==p!.id);else {p.bot=true;p.locked=true;}if(p.id===r.hostId){const next=r.players.find(x=>!x.bot&&!x.left);if(next)r.hostId=next.id;}}
  else if(a.type.startsWith('debug:')){host();insist(dev&&r.mode==='training','Action de développement indisponible.');if(a.type==='debug:budget')p.budget+=100;else if(a.type==='debug:force'){insist(CATALOG_BY_ID[a.characterId||''],'Combattant inconnu.');insist(!r.players.some(x=>x.roster.some(y=>y.characterId===a.characterId)),'Combattant déjà recruté.');r.deck=r.deck.filter((id,i)=>i<r.round||id!==a.characterId);r.deck.splice(r.round,0,a.characterId!);nextAuction(r,now);}else if(a.type==='debug:combat'){if(a.teams){insist(a.teams.length===r.players.length,'Une équipe par joueur.');insist(new Set(a.teams.flat()).size===a.teams.flat().length,'Combattant en double.');a.teams.forEach((ids,i)=>{insist(ids.length===r.settings.teamSize&&ids.every(id=>CATALOG_BY_ID[id]),'Équipe invalide.');r.players[i].roster=ids.map(characterId=>({characterId,price:0,round:0}));r.players[i].formation=ids;r.players[i].locked=true;});beginBattle(r,now);}else{beginFormation(r,now);beginBattle(r,now);}}else if(a.type==='debug:next'){if(r.phase==='auction')r.auction!.endsAt=now;else r.phaseEndsAt=now;advance(r,now);}else throw new GameError('Commande inconnue.');}
  else if(a.type!=='heartbeat')throw new GameError('Action inconnue.');
 }
 r.updatedAt=now;r.receipts[receipt]=p?.id||'';const keys=Object.keys(r.receipts);if(keys.length>300)for(const k of keys.slice(0,keys.length-300))delete r.receipts[k];return p?.id||null;
}
export function publicCard(c:Character,visibility:Visibility='partial',reveal=false,scouting=false):CardData{
 const out:CardData={id:c.id,name:c.name,universe:c.universe,rank:c.rank,role:c.role,portrait:c.portrait,epithet:c.epithet,ability:c.ability,traits:c.traits};
 const approximation=(v:number)=>v>=88?'Exceptionnelle':v>=75?'Excellente':v>=60?'Élevée':v>=45?'Solide':'Modeste';
 if(reveal||visibility==='full'){out.stats=c.stats;out.scout=c.stats;}else if(visibility==='approximate'){out.scout=Object.fromEntries(STAT_KEYS.map(k=>[k,approximation(c.stats[k])]))}
 else if(visibility==='partial'||scouting){out.scout={speed:approximation(c.stats.speed),defense:approximation(c.stats.defense),...(scouting?{technique:approximation(c.stats.technique),intelligence:approximation(c.stats.intelligence)}:{})};}
 // hidden and expert reveal no numeric information; expert also hides tier-based traits.
 if(visibility==='expert'&&!reveal)out.traits=[];return out;
}
export function viewRoom(r:Room,sid:string,now:number,dev=false):RoomView{
 const me=r.players.find(p=>p.sid===sid);if(!me)throw new GameError('Rejoignez le salon pour accéder à cette partie.',403);
 const reveal=r.phase==='battle'||r.phase==='results';const a=r.auction;const sealed=r.settings.auctionMode==='sealed'&&r.phase==='auction';
 const ids=new Set(r.players.flatMap(p=>p.roster.map(x=>x.characterId)));if(a)ids.add(a.characterId);if(r.lastSale)ids.add(r.lastSale.characterId);
 const cards=Object.fromEntries([...ids].map(id=>[id,publicCard(CATALOG_BY_ID[id],r.settings.visibility,reveal,a?.event==='scouting'&&a.characterId===id)]));
 return {code:r.code,version:r.version,hostId:r.hostId,mode:r.mode,phase:r.phase,settings:r.settings,players:r.players.filter(p=>!p.left||r.phase!=='lobby').map(p=>{const {sid:_,lastSeen,formation,...safe}=p;return {...safe,formation:reveal||p.id===me.id?formation:[],online:p.bot||now-lastSeen<18000};}),round:r.round,marketTotal:r.deck.length,auction:a?{characterId:a.characterId,round:a.round,endsAt:a.endsAt,startedAt:a.startedAt,bid:sealed?0:a.bid,leader:sealed?null:a.leader,event:a.event,bids:sealed?[]:a.bids,myBid:a.sealed[me.id]?.amount||0,bidCount:Object.keys(a.sealed).length}:null,phaseEndsAt:r.phaseEndsAt,lastSale:r.lastSale,matches:reveal?r.matches:[],awards:reveal?r.awards:[],log:r.log,meId:me.id,serverNow:now,cards,dev:dev&&r.mode==='training'};
}
