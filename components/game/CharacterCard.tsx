'use client';
import {useState,type CSSProperties} from 'react';
import {Shield,Swords,Wind,Brain,Heart,Compass,LockKeyhole,UserRound} from 'lucide-react';
import {type CardData,type Role,RANK_COLORS,ROLE_LABELS,UNIVERSES,STAT_KEYS,STAT_LABELS,ABILITIES} from '@/lib/game/types';
export const ROLE_ICONS={attacker:Swords,tank:Shield,assassin:Wind,controller:Brain,support:Heart,balanced:Compass};
export function RoleIcon({role,size=14}:{role:Role;size?:number}){const Icon=ROLE_ICONS[role];return <Icon size={size}/>}
export function CharacterCard({card,variant='collection',onClick,selected=false,price,badge,priority=false}:{card:CardData;variant?:'mini'|'hero'|'auction'|'collection'|'placement'|'combat'|'result';onClick?:()=>void;selected?:boolean;price?:number;badge?:string;priority?:boolean}){
 const [failed,setFailed]=useState(false);const universe=UNIVERSES.find(u=>u.id===card.universe);
 const inner=<><div className="card-photo">{!failed?<img src={card.portrait} alt={card.name} loading={priority?'eager':'lazy'} decoding="async" onError={()=>setFailed(true)}/>:<div className="portrait-fallback"><UserRound/><span>{card.name}</span></div>}</div><div className="card-shade"/><span className="card-rank">{card.rank}</span>{badge&&<span className="card-badge">{badge}</span>}<div className="card-copy"><span className="card-universe">{universe?.name}</span><h3>{card.name}</h3><span className="card-role"><RoleIcon role={card.role}/>{ROLE_LABELS[card.role]}</span>{price!==undefined&&<span className="card-price">{price===0?'RENFORT':`${price} M`}</span>}</div><span className="card-corner"/></>;
 const props={className:`character-card card-${variant} ${selected?'selected':''} rank-${card.rank}`,style:{'--rarity':RANK_COLORS[card.rank],'--universe':universe?.color} as CSSProperties};
 return onClick?<button {...props} onClick={onClick} aria-label={`${card.name}, rang ${card.rank}, ${ROLE_LABELS[card.role]}`} aria-pressed={selected}>{inner}</button>:<div {...props}>{inner}</div>;
}
export function StatBlock({card}:{card:CardData}){return <div className="stat-block">{STAT_KEYS.map(key=>{const value=card.stats?.[key]??card.scout?.[key];return <div className="stat-row" key={key}><span>{STAT_LABELS[key]}</span>{typeof value==='number'?<><div className="stat-track"><div style={{width:`${value}%`}}/></div><strong>{value}</strong></>:value?<strong className="word-stat">{value}</strong>:<span className="unknown"><LockKeyhole size={11}/> Inconnue</span>}</div>})}</div>}
export function Passive({card}:{card:CardData}){return <div className="passive"><span>PASSIF · {ABILITIES[card.ability].name}</span><p>{ABILITIES[card.ability].description}</p></div>}
