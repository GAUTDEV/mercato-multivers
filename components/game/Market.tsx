'use client';
import {useState, useMemo, useEffect, useRef, type CSSProperties} from 'react';
import {Progress} from '@/components/ui/progress';
import {Clock, Coins, LockKeyhole, TrendingUp, Check, Users, Sparkles, Eye, Flame, ChevronDown} from 'lucide-react';
import {CharacterCard, StatBlock, Passive} from './CharacterCard';
import {Avatar, PLAYER_COLORS} from './Lobby';
import {type RoomView, type Action, type CardData} from '@/lib/game/types';

export default function Market({room, act, busy, now, catalog, onCard}: {
  room: RoomView; act: (a: Partial<Action>) => Promise<unknown>; busy: boolean;
  now: number; catalog: CardData[]; onCard: (c: CardData) => void;
}) {
  const auction = room.auction!;
  const card = room.cards[auction.characterId];
  const me = room.players.find(p => p.id === room.meId)!;
  const leader = room.players.find(p => p.id === auction.leader);
  const sealed = room.settings.auctionMode === 'sealed';
  const [custom, setCustom] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(224);
  const panel = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const time = Math.max(0, Math.ceil((auction.endsAt - now) / 1000));
  const cap = Math.max(0, me.budget - Math.max(0, room.settings.teamSize - me.roster.length - 1));
  const full = me.roster.length >= room.settings.teamSize;
  const leading = leader?.id === me.id;
  const canBid = room.phase === 'auction' && !busy && !full && time > 0 && (sealed || !leading);
  const sold = room.phase === 'sold';
  const minimum = sealed ? Math.max(1, auction.myBid + 1) : auction.bid + 1;
  const amount = Number(custom);
  const validAmount = !!custom && Number.isSafeInteger(amount) && amount >= minimum && amount <= cap;

  useEffect(() => {setCustom(''); setCustomOpen(false)}, [room.round]);
  useEffect(() => {
    if (!panel.current) return;
    const observer = new ResizeObserver(([entry]) => setPanelHeight(Math.ceil(entry.target.getBoundingClientRect().height)));
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, []);

  const deck = useMemo(() => {
    const allowed = catalog.filter(c => room.settings.universes.includes(c.universe));
    if (!allowed.length) return [card];
    return Array.from({length: 22}, (_, i) => i === 18 ? card : allowed[(i * 7 + room.round * 13) % allowed.length]);
  }, [catalog, card, room.round, room.settings.universes]);
  const bid = (value: number) => act({type: 'bid', amount: value, expectedRound: room.round});

  return <div className="market-layout page-enter" style={{'--bid-panel-height': `${panelHeight}px`} as CSSProperties}>
    <aside className="recruiters-panel" aria-label="Les recruteurs et leurs budgets" tabIndex={0}>
      <div className="panel-heading"><h2>La table</h2><Users size={16}/></div>
      {room.players.map(p => <div className={`recruiter-row ${auction.leader === p.id && !sealed ? 'is-leading' : ''} ${p.id === me.id ? 'is-me' : ''}`} key={p.id}>
        <Avatar name={p.name} color={p.color} bot={p.bot}/>
        <div><strong>{p.name}{p.id === me.id && <small>VOUS</small>}</strong><span>{p.roster.length}/{room.settings.teamSize} recrues</span></div>
        <b>{p.budget}<small> M</small></b>
      </div>)}
      <div className="market-log"><p className="eyebrow">FIL DU MERCATO</p>
        {room.log.filter(x => ['sold', 'unsold'].includes(x.kind)).slice(0, 5).map(x => <p key={x.id}>{x.text}</p>)}
        {!room.log.some(x => x.kind === 'sold') && <p>Les bonnes affaires commencent ici.</p>}
      </div>
      <div className="table-tip"><span>LE CONSEIL DU RECRUTEUR</span><p>Un grand nom ne gagne pas seul. Gardez de quoi compléter votre équipe.</p></div>
    </aside>

    <section className="auction-stage">
      <div className="stage-heading"><div>
        <p className="eyebrow">{room.phase === 'reveal' ? 'LA MACHINE EST LANCÉE' : sold ? 'LE MARTEAU EST TOMBÉ' : 'À VOUS DE JOUER'}</p>
        <h1>{room.phase === 'reveal' ? 'Qui sera le prochain ?' : sold ? leader ? 'Adjugé.' : 'Personne ne s’est lancé.' : 'Faites votre offre.'}</h1>
      </div><span className="lot-count">LOT <b>{String(room.round).padStart(2, '0')}</b><span>/ {room.marketTotal}</span></span></div>
      {room.phase === 'reveal' ? <div className="reveal-stage">
        <div className="reel-pointer"/><div className="roulette-window"><div className="roulette-track" key={room.round}>
          {deck.map((c, i) => <CharacterCard key={i} card={c} variant="mini" priority/>)}
        </div></div><p className="roulette-caption">Le prochain recrutement peut tout changer.</p>
        <span className="reel-label">MULTIVERS DRAFT SYSTEM / {String(room.round).padStart(2, '0')}</span>
      </div> : <div className={`auction-character ${sold ? 'sold-character' : ''} ${card.rank === 'SS' || card.rank === 'S' ? 'rare-reveal' : ''}`} key={card.id}>
        <div className="auction-card-wrap"><CharacterCard card={card} variant="auction" priority onClick={() => onCard(card)}/>
          {sold && <span className="sold-stamp">{leader ? 'ADJUGÉ' : 'SANS OFFRE'}</span>}
        </div>
        <div className="auction-intel"><span className="eyebrow">RAPPORT DE SCOUTING</span><h2>{card.epithet}</h2>
          <StatBlock card={card}/><Passive card={card}/>
          {!card.stats && <p className="hidden-note"><LockKeyhole size={12}/> Les vraies valeurs seront révélées au combat.</p>}
        </div>
        <button className="mobile-card-details" onClick={() => onCard(card)}><Eye size={16}/> Scouting et capacité spéciale</button>
      </div>}
      {auction.event && <div className="event-banner">{auction.event === 'scouting' ? <Eye size={17}/> : <Flame size={17}/>}
        <strong>{auction.event === 'scouting' ? 'Rapport exclusif' : 'Mercato express'}</strong>
        <span>{auction.event === 'scouting' ? 'Deux informations supplémentaires dévoilées.' : 'Ce lot part 5 secondes plus vite.'}</span>
      </div>}
      <div className="your-roster"><div className="panel-heading"><h2>Vos recrues <span>{me.roster.length}/{room.settings.teamSize}</span></h2><span className="roster-budget"><Coins size={14}/>{me.budget} M restants</span></div>
        <div className="roster-strip" tabIndex={0} role="group" aria-label="Vos recrues, défilement horizontal">
          {me.roster.map(x => <CharacterCard key={x.characterId} card={room.cards[x.characterId]} variant="mini" price={x.price} onClick={() => onCard(room.cards[x.characterId])}/>)}
          {Array.from({length: Math.max(0, room.settings.teamSize - me.roster.length)}, (_, i) => <div key={i} className="empty-roster-slot"><span>+</span><small>À RECRUTER</small></div>)}
        </div>
      </div>
    </section>

    <aside ref={panel} className={`bidding-panel ${sealed ? 'sealed-bidding' : ''}`} aria-label="Commandes d’enchère">
      <div className={`bid-clock ${time <= 5 && room.phase === 'auction' ? 'critical' : ''}`}>
        <span><Clock size={16}/>{room.phase === 'reveal' ? 'RÉVÉLATION' : sold ? 'ENCHÈRE CLOSE' : 'TEMPS RESTANT'}</span>
        <strong role="timer" aria-label={`${time} secondes restantes`}>{room.phase === 'reveal' ? '—' : sold ? '00' : String(time).padStart(2, '0')}<small>s</small></strong>
        <Progress value={room.phase === 'auction' ? Math.min(100, time / room.settings.auctionSeconds * 100) : 0} className="timer-progress"/>
      </div>
      <div className="bid-details"><span className="eyebrow">{sealed && !sold ? 'VOTRE OFFRE SECRÈTE' : sold ? 'PRIX FINAL' : 'MEILLEURE OFFRE'}</span>
        <div className="bid-amount" key={sealed ? auction.myBid : auction.bid}>{sealed && !sold ? auction.myBid : auction.bid}<span>M</span></div>
        {sold ? <p className="bid-owner">{leader ? `${leader.name} remporte ${card.name}.` : 'Personnage remis dans la réserve.'}</p> : sealed ?
          <p className="bid-owner"><LockKeyhole size={14}/> {auction.bidCount} offre{auction.bidCount > 1 ? 's' : ''} déposée{auction.bidCount > 1 ? 's' : ''}</p> :
          <p className={`bid-owner ${leading ? 'your-lead' : ''}`}>{leader ? <><span style={{background: PLAYER_COLORS[leader.color % 6]}}/>{leading ? 'Vous menez l’enchère' : `${leader.name} mène l’enchère`}</> : 'Soyez le premier à enchérir.'}</p>}
      </div>
      <div className="bid-actions">
        {room.phase === 'reveal' ? <p className="pending-copy"><Sparkles size={18}/> La sélection est en cours…</p> : sold ?
          <div className="sale-result"><Check size={22}/><strong>{leading ? 'Bienvenue dans votre équipe.' : 'Le prochain lot arrive.'}</strong><span>Le mercato continue.</span></div> : <>
            {!sealed && <div className="quick-bids">{[1, 5, 10].map(n => <button key={n} disabled={!canBid || auction.bid + n > cap} onClick={() => void bid(auction.bid + n)} aria-label={`Enchérir à ${auction.bid + n} millions (+${n})`}>+{n}<small> M</small></button>)}</div>}
            {!sealed && <button className="custom-bid-toggle" type="button" aria-expanded={customOpen} aria-controls="custom-bid-form" disabled={!canBid} onClick={() => {
              setCustomOpen(!customOpen);
              if (!customOpen) requestAnimationFrame(() => input.current?.focus({preventScroll: true}));
            }}>Montant libre <ChevronDown size={15} className={customOpen ? 'rotated' : ''}/></button>}
            <form id="custom-bid-form" className={`custom-bid ${customOpen || sealed ? 'is-open' : ''}`} onSubmit={async e => {
              e.preventDefault();
              if (!canBid || !validAmount) return;
              if (await bid(amount)) {setCustom(''); setCustomOpen(false); input.current?.blur()}
            }}>
              <label><span className="sr-only">Votre offre en millions</span>
                <input ref={input} type="number" inputMode="numeric" enterKeyHint="send" min={minimum} max={cap} step={1} placeholder={sealed ? 'Offre secrète' : 'Montant libre'} value={custom} onChange={e => setCustom(e.target.value)} disabled={!canBid}/><span>M</span>
              </label>
              <button className="primary" type="submit" disabled={!canBid || !validAmount} aria-label="Déposer l’offre"><TrendingUp size={19}/><span className="mobile-bid-label">Miser</span></button>
            </form>
            <p className="bid-help">{full ? 'Équipe complète. Observez vos adversaires.' : leading && !sealed ? 'Vous avez la main.' : sealed ? `Offre secrète · max. ${cap} M` : `Max. ${cap} M · 1 M réservé par place libre.`}</p>
            {sealed && auction.myBid > 0 && <div className="offer-confirmation" role="status"><Check size={14}/> Offre enregistrée : {auction.myBid} M</div>}
          </>}
      </div>
      <div className="bid-footnote"><LockKeyhole size={13}/><p>{sealed ? 'À égalité, la première offre reçue gagne.' : room.settings.antiSnipe ? 'Dernières secondes : chaque nouvelle offre relance 3 s.' : 'L’enchère ferme à la fin du chrono.'}</p></div>
    </aside>
  </div>;
}
