// Offline UI fixture: uses the actual components and engine; never calls D1.
import React from 'react';
import {createRoot} from 'react-dom/client';
import Game from '../components/game/Game';
import {createRoom, applyAction, advance, viewRoom, publicCard} from '../lib/game/engine';
import {CATALOG} from '../lib/game/catalog';
import type {Room, Action} from '../lib/game/types';

const sid = 'mobile-preview-session';
const scenario = new URLSearchParams(location.search).get('stage') || 'home';
const site = 'https://mercato-multivers.panique-party-sacha.workers.dev';
const catalog = CATALOG.map(c => ({...publicCard(c), portrait: site + c.portrait}));
let room: Room | null = null;
localStorage.removeItem('mm:lastRoom');
localStorage.removeItem('mm:name');
localStorage.setItem('mm:muted', '1');

if (scenario !== 'home') {
  let now = Date.now();
  room = createRoom('ABC234', sid, 'Sacha_recruteur_mobile', {
    maxPlayers: 6, teamSize: scenario === 'formation3' ? 3 : 5,
    marketSize: 12, auctionSeconds: 45, formationSeconds: 180, events: false,
    auctionMode: scenario === 'sealed' ? 'sealed' : 'public',
  }, scenario === 'lobby' ? 'friends' : 'training', now, 1315);
  const target = scenario === 'sealed' ? 'auction' : scenario.startsWith('formation') ? 'formation' : scenario;
  for (let i = 0; room.phase !== target && i < 4000; i++) {
    now += 1000;
    advance(room, now);
  }
  const shift = Date.now() - now;
  room.phaseEndsAt += shift;
  if (room.auction) {
    room.auction.endsAt += shift;
    room.auction.startedAt += shift;
    room.auction.botAt = Date.now() + 3_600_000;
  }
  localStorage.setItem('mm:lastRoom', room.code);
}

function snapshot() {
  if (!room) return null;
  const view = viewRoom(room, sid, Date.now(), false);
  for (const card of Object.values(view.cards)) card.portrait = site + card.portrait;
  return view;
}

window.fetch = async (input, options) => {
  const url = String(input);
  const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  if (url.includes('catalog=1')) return response({characters: catalog});
  try {
    if (options?.method === 'POST') {
      const action = JSON.parse(String(options.body)) as Action;
      if (action.type === 'create') {
        room = createRoom('ABC234', sid, action.name!, action.settings!, action.mode!, Date.now(), 1315);
      } else if (room) {
        applyAction(room, sid, action, Date.now(), false);
        if (action.type === 'leave') room = null;
      }
    }
    if (room) advance(room, Date.now());
    return response({room: snapshot()});
  } catch (error) {
    return response({error: error instanceof Error ? error.message : 'Preview error'}, 400);
  }
};

createRoot(document.getElementById('root')!).render(<Game/>);
