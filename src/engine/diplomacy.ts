// Diplomacy Engine: propuestas ágiles (propuesta → aceptación / rechazo / contrapropuesta → decisión final).
import type { GameState, Breakdown, Kingdom } from './types';
import type { World } from './world';
import { rel, alert, chron, armyMen, totalPop, kprovs, atWar } from './game';
import { armyStrength } from './military';

export type PropKind = 'regalo' | 'comercio' | 'alianza' | 'nap' | 'mapas' | 'paz_blanca' | 'paz_ceder' | 'paz_tributo' | 'incorporar' | 'ultimatum' | 'protectorado';
export const PROP_NAMES: Record<PropKind, string> = { regalo: 'Enviar regalo', comercio: 'Acuerdo comercial', alianza: 'Alianza', nap: 'Pacto de no agresión', mapas: 'Intercambio de mapas', paz_blanca: 'Paz blanca', paz_ceder: 'Paz: ceder provincias ocupadas', paz_tributo: 'Paz: exigir tributo', incorporar: 'Solicitar incorporación al reino', ultimatum: 'Ultimátum: sumisión o guerra', protectorado: 'Ofrecer protección (protectorado)' };
export interface Proposal { kind: PropKind; gold?: number; }
export interface Evaluation { accept: boolean; score: number; reasons: Breakdown; counter?: { gold: number; text: string }; blocked?: string; }

export function power(g: GameState, k: number) { let s = 0; for (const a of g.armies) if (a.owner === k) s += armyStrength(a); return s + totalPop(g, k) * 0.05 + Math.min(2000, g.kingdoms[k].stock.oro) * 5; }
export function attitude(op: number) { return op > 50 ? 'Amistoso' : op > 20 ? 'Receptivo' : op > -10 ? 'Neutral' : op > -40 ? 'Desconfiado' : 'Hostil'; }
const add = (b: Breakdown, l: string, v: number) => { if (Math.abs(v) >= 0.5) b.push({ label: l, value: Math.round(v) }); };

export function available(g: GameState, from: number, to: number): { kind: PropKind; ok: boolean; why?: string }[] {
  const r = rel(g, from, to); const kf = g.kingdoms[from], kt = g.kingdoms[to]; const out: { kind: PropKind; ok: boolean; why?: string }[] = [];
  const push = (kind: PropKind, ok: boolean, why?: string) => out.push({ kind, ok, why });
  if (!r || !r.contact) return out;
  if (r.war) { push('paz_blanca', true); push('paz_ceder', g.provinces.some(p => p.owner === to && p.occupier === from), 'No ocupas ninguna de sus provincias'); push('paz_tributo', true); return out; }
  push('regalo', kf.stock.oro >= 25, 'Necesitas al menos 25 de oro');
  push('comercio', !r.trade, 'Ya existe un acuerdo');
  push('nap', !r.nap, 'Ya existe un pacto');
  push('alianza', !r.alliance, 'Ya sois aliados');
  push('mapas', !r.mapsShared && kf.techs.includes('cartografia'), kf.techs.includes('cartografia') ? 'Ya intercambiasteis mapas' : 'Requiere Cartografía');
  if (kt.independent) { push('incorporar', true); push('ultimatum', true); push('protectorado', r.protectorate < 0, 'Ya es un protectorado'); }
  return out;
}

export function evaluate(w: World, g: GameState, from: number, to: number, p: Proposal): Evaluation {
  const r = rel(g, from, to); const kf = g.kingdoms[from], kt = g.kingdoms[to]; const b: Breakdown = [];
  if (!r) return { accept: false, score: -100, reasons: [{ label: 'Sin contacto', value: -100 }] };
  const pf = power(g, from), pt = power(g, to); const ratio = pf / Math.max(1, pt);
  if (p.kind === 'regalo') { add(b, 'Un regalo siempre se acepta', 100); return { accept: true, score: 100, reasons: b }; }
  add(b, 'Opinión de ' + kt.short, r.opinion / 2); add(b, 'Confianza', (r.trust - 50) / 5);
  if (from === g.playerId) { const c = kf.council.canciller; if (c) add(b, `Canciller ${c.name.split(' ')[0]} (diplomacia ${c.diplomacia})`, (c.diplomacia - 5) * 2); add(b, 'Dificultad', -g.difficulty * 4); }
  const pers = kt.personality;
  switch (p.kind) {
    case 'comercio':
      add(b, 'Beneficio mutuo del comercio', 12); if (pers === 'comercial') add(b, 'Gobernante comercial', 15); if (pers === 'aislacionista') add(b, 'Gobernante aislacionista', -20);
      if (Object.values(g.relations).some(x => x.war && (x.a === to || x.b === to) && (x.a === from || x.b === from))) add(b, 'En guerra', -100); break;
    case 'nap': add(b, 'Seguridad fronteriza', 8); if (pers === 'pacifista' || pers === 'diplomatico' || pers === 'prudente') add(b, 'Gobernante ' + pers, 12); if (pers === 'expansionista' || pers === 'militarista') add(b, 'Gobernante ' + pers, -15); if (ratio > 1.5) add(b, 'Nos temen', 10); break;
    case 'alianza': {
      add(b, 'Una alianza es un compromiso serio', -25); if (pers === 'diplomatico') add(b, 'Gobernante diplomático', 12); if (pers === 'aislacionista') add(b, 'Gobernante aislacionista', -30);
      add(b, 'Fuerza relativa de ' + kf.short, Math.max(-20, Math.min(15, (ratio - 1) * 12)));
      const common = g.kingdoms.some(o => o.alive && o.id !== from && o.id !== to && rel(g, o.id, to) && rel(g, o.id, from) && (rel(g, o.id, to).opinion < -25 || rel(g, o.id, to).war) && (rel(g, o.id, from).opinion < -10 || rel(g, o.id, from).war));
      if (common) add(b, 'Rival común', 18); if (r.trade) add(b, 'Acuerdo comercial existente', 6); if (r.nap) add(b, 'Pacto de no agresión existente', 4); break;
    }
    case 'mapas': { let mine = 0, theirs = 0; for (let i = 0; i < kf.known.length; i++) { if (kf.known[i] >= 2 && kt.known[i] < 2) mine++; if (kt.known[i] >= 2 && kf.known[i] < 2) theirs++; } add(b, `Valor de nuestros mapas (${mine} regiones nuevas para ellos)`, mine * 0.6); add(b, `Valor de sus mapas (${theirs} regiones que revelan)`, -theirs * 0.5); if (pers === 'explorador' || pers === 'cientifico') add(b, 'Gobernante ' + pers, 10); if (pers === 'aislacionista') add(b, 'Gobernante aislacionista', -20); break; }
    case 'paz_blanca': case 'paz_tributo': case 'paz_ceder': {
      const ws = r.a === to ? r.warScore : -r.warScore; // positivo: les va bien a ellos
      add(b, 'Marcha de la guerra para ' + kt.short, -ws); add(b, 'Cansancio de guerra de ' + kt.short, kt.warExhaustion * 0.8); if (pers === 'pacifista') add(b, 'Gobernante pacifista', 15); if (pers === 'militarista') add(b, 'Gobernante militarista', -10);
      add(b, 'Fuerza relativa', Math.max(-25, Math.min(25, (ratio - 1) * 15)));
      if (p.kind === 'paz_tributo') add(b, 'Exigencia de tributo', -20);
      if (p.kind === 'paz_ceder') { const n = g.provinces.filter(q => q.owner === to && q.occupier === from).length; add(b, `Ceder ${n} provincia(s)`, -10 - n * 10); if (g.provinces.some(q => q.id === kt.capital && q.occupier === from)) add(b, 'Su capital está ocupada', 25); }
      add(b, 'Tregua habitual tras meses de guerra', Math.min(15, (g.turn - r.warStart) * 0.8)); break;
    }
    case 'incorporar': add(b, 'Renunciar a la independencia', -45); add(b, 'Fuerza relativa', Math.min(40, (ratio - 1) * 6)); if ((p.gold || 0) > 0) add(b, `Oro ofrecido (${p.gold})`, (p.gold || 0) / 8); if (r.protectorate === from) add(b, 'Ya es nuestro protectorado', 20); break;
    case 'protectorado': add(b, 'Protección frente a vecinos', 10); add(b, 'Fuerza relativa', Math.min(25, (ratio - 1) * 6)); add(b, 'Pagar tributo', -15); if (pers === 'aislacionista') add(b, 'Aislacionistas', -20); break;
    case 'ultimatum': add(b, 'Humillación', -40); add(b, 'Fuerza relativa', Math.min(60, (ratio - 1) * 8)); break;
  }
  if (p.gold && p.kind !== 'incorporar') add(b, `Oro ofrecido (${p.gold})`, p.gold / 6);
  const score = b.reduce((s, x) => s + x.value, 0);
  const ev: Evaluation = { accept: score > 0, score, reasons: b };
  if (!ev.accept && score > -30 && ['comercio', 'nap', 'alianza', 'mapas', 'paz_blanca', 'incorporar', 'protectorado'].includes(p.kind)) { const gold = Math.ceil((-score + 1) * (p.kind === 'incorporar' ? 8 : 6) / 5) * 5; if (kf.stock.oro >= gold) ev.counter = { gold: gold + (p.gold || 0), text: `${kt.short} aceptaría si añades ${gold} de oro.` }; }
  return ev;
}
export function propose(w: World, g: GameState, from: number, to: number, p: Proposal): Evaluation {
  const ev = evaluate(w, g, from, to, p); const r = rel(g, from, to); r.lastProposal = g.turn;
  if (ev.accept) execute(w, g, from, to, p); else if (p.kind === 'ultimatum') declareWar(w, g, from, to, true);
  else { r.opinion -= 2; }
  return ev;
}
export function execute(w: World, g: GameState, from: number, to: number, p: Proposal) {
  const r = rel(g, from, to); const kf = g.kingdoms[from], kt = g.kingdoms[to];
  if (p.gold) { const gld = Math.min(p.gold, kf.stock.oro); kf.stock.oro -= gld; kt.stock.oro += gld; if (p.kind === 'regalo') { r.giftBonus = Math.min(40, r.giftBonus + gld / 4); r.opinion = Math.min(100, r.opinion + gld / 8); r.trust = Math.min(100, r.trust + 2); } }
  const both = from === g.playerId || to === g.playerId;
  const note = (t: string, imp = false) => { chron(g, from, 'diplomacia', t, imp); if (both) alert(g, 'internacional', t); };
  switch (p.kind) {
    case 'regalo': if (both) alert(g, 'info', `${kt.short} agradece el regalo de ${p.gold} de oro.`); break;
    case 'comercio': r.trade = true; r.opinion += 5; note(`${kf.short} y ${kt.short} firman un acuerdo comercial.`); break;
    case 'nap': r.nap = true; r.opinion += 5; note(`${kf.short} y ${kt.short} firman un pacto de no agresión.`); break;
    case 'alianza': r.alliance = true; r.nap = true; r.opinion += 10; note(`Alianza entre ${kf.name} y ${kt.name}.`, true); break;
    case 'mapas': r.mapsShared = true; for (const [a, b] of [[kf, kt], [kt, kf]] as Kingdom[][]) { for (let i = 0; i < a.known.length; i++) if (b.known[i] > a.known[i]) { a.known[i] = b.known[i]; a.lastOwner[i] = b.lastOwner[i]; a.lastSeen[i] = b.lastSeen[i]; } for (let i = 0; i < a.seaKnown.length; i++) a.seaKnown[i] = Math.max(a.seaKnown[i], b.seaKnown[i]); } note(`${kf.short} y ${kt.short} intercambian sus mapas.`); break;
    case 'paz_blanca': case 'paz_tributo': case 'paz_ceder': makePeace(w, g, from, to, p.kind); break;
    case 'incorporar': case 'ultimatum': annex(w, g, from, to); break;
    case 'protectorado': r.protectorate = from; r.opinion += 5; note(`${kt.name} acepta la protección de ${kf.name}.`, true); break;
  }
}
export function annex(w: World, g: GameState, by: number, target: number) {
  const kb = g.kingdoms[by], kt = g.kingdoms[target];
  for (const p of g.provinces) if (p.owner === target) { p.owner = by; p.occupier = -1; p.conqueredTurn = g.turn - 18; p.unrest += 5; kb.known[p.id] = 2; }
  for (const a of g.armies.slice()) if (a.owner === target) { a.owner = by; a.name = 'Hueste de ' + kt.short; }
  kt.alive = false; kb.stock.prestigio += 5;
  chron(g, by, 'territorio', `${kt.name} se incorpora a ${kb.name}.`, true);
  if (by === g.playerId || target === g.playerId) alert(g, 'importante', `${kt.name} se incorpora a ${kb.name}.`);
  for (const o of g.kingdoms) if (o.alive && o.id !== by) { const r2 = rel(g, o.id, by); if (r2) r2.tension = Math.min(100, r2.tension + 5); }
}
export function declareWar(w: World, g: GameState, from: number, to: number, silentTruce = false) {
  const r = rel(g, from, to); if (!r || r.war) return; const kf = g.kingdoms[from], kt = g.kingdoms[to];
  if (r.alliance || r.nap) { kf.legitimacy = Math.max(0, kf.legitimacy - 15); kf.stock.prestigio -= 10; for (const o of g.kingdoms) if (o.alive && o.id !== from && o.id !== to) { const x = rel(g, o.id, from); if (x) x.opinion -= 10; } }
  r.war = true; r.alliance = false; r.nap = false; r.trade = false; r.warStart = g.turn; r.warScore = 0; r.opinion = Math.min(r.opinion, -40); r.tension = 100;
  chron(g, from, 'guerra', `${kf.name} declara la guerra a ${kt.name}.`, true);
  if (to === g.playerId) alert(g, 'critica', `¡${kf.name} nos declara la guerra!`); else if (from === g.playerId) alert(g, 'importante', `Guerra declarada a ${kt.name}.`); else alert(g, 'internacional', `${kf.name} declara la guerra a ${kt.name}.`);
  // llamada a los aliados del atacado
  for (const o of g.kingdoms) {
    if (!o.alive || o.id === from || o.id === to) continue; const ra = rel(g, o.id, to); if (!ra || !ra.alliance) continue; const rf = rel(g, o.id, from); if (rf.war) continue;
    if (o.id === g.playerId) { (g as any).__callToArms = (g as any).__callToArms || []; g.events.push({ id: g.nextId++, kind: 'llamada', title: 'Llamada a las armas', text: `${kt.name}, nuestro aliado, ha sido atacado por ${kf.name}. ¿Honraremos la alianza?`, prov: -1, turn: g.turn, data: { ally: to, enemy: from }, choices: [{ label: 'Honrar la alianza: declarar la guerra', effects: `Guerra contra ${kf.short}. +5 prestigio.` }, { label: 'Abandonar al aliado', effects: 'Se rompe la alianza. −10 prestigio, −10 legitimidad.' }] }); }
    else if (ra.opinion > 0) { rf.war = true; rf.warStart = g.turn; rf.alliance = false; rf.nap = false; rf.trade = false; chron(g, o.id, 'guerra', `${o.name} entra en guerra junto a su aliado ${kt.short}.`); if (from === g.playerId) alert(g, 'importante', `${o.name} acude en defensa de ${kt.short} y nos declara la guerra.`); }
  }
}
export function makePeace(w: World, g: GameState, from: number, to: number, kind: string) {
  const r = rel(g, from, to); const kf = g.kingdoms[from], kt = g.kingdoms[to];
  r.war = false; r.nap = true; r.warScore = 0; r.opinion = Math.max(r.opinion, -20); r.trust = Math.max(0, r.trust - 5);
  let txt = `Paz entre ${kf.name} y ${kt.name}`;
  for (const p of g.provinces) {
    if (p.owner === to && p.occupier === from) { if (kind === 'paz_ceder') { p.owner = from; p.occupier = -1; p.conqueredTurn = g.turn; kf.known[p.id] = 2; } else p.occupier = -1; }
    else if (p.owner === from && p.occupier === to) p.occupier = -1;
    else if ((p.owner === from || p.owner === to) && p.siege && (p.siege.by === from || p.siege.by === to)) p.siege = null;
  }
  if (kind === 'paz_ceder') txt += ': se ceden las provincias ocupadas'; if (kind === 'paz_tributo') { const gld = Math.min(kt.stock.oro, 150); kt.stock.oro -= gld; kf.stock.oro += gld; txt += `: tributo de ${Math.round(gld)} de oro`; }
  for (const a of g.armies) { if (a.owner === from || a.owner === to) { const o = g.provinces[a.prov].owner; if (o >= 0 && o !== a.owner && !rel(g, a.owner, o)?.alliance) { a.path = [g.kingdoms[a.owner].capital === a.prov ? a.prov : g.kingdoms[a.owner].capital]; a.path = []; a.prov = g.kingdoms[a.owner].capital; } } }
  chron(g, from, 'tratado', txt + '.', true); if (from === g.playerId || to === g.playerId) alert(g, 'importante', txt + '.'); else alert(g, 'internacional', txt + '.');
}
export function monthlyDiplomacy(w: World, g: GameState) {
  for (const key in g.relations) {
    const r = g.relations[key]; const ka = g.kingdoms[r.a], kb = g.kingdoms[r.b]; if (!ka.alive || !kb.alive) continue;
    r.giftBonus *= 0.95;
    let target = 0; if (ka.personality === kb.personality) target += 8; if (r.trade) target += 10; if (r.alliance) target += 25; if (r.nap) target += 8; if (r.war) target -= 50;
    const border = kprovs(g, r.a).some(p => w.provinces[p.id].neighbors.some(n => g.provinces[n].owner === r.b));
    if (border && (ka.personality === 'expansionista' || kb.personality === 'expansionista' || ka.personality === 'militarista' || kb.personality === 'militarista')) target -= 15;
    target += r.giftBonus;
    r.opinion += (target - r.opinion) * 0.03; r.opinion = Math.max(-100, Math.min(100, r.opinion));
    // tensión: ejércitos en la frontera
    let t = r.war ? 100 : 0; if (!r.war) { for (const a of g.armies) { if (a.owner !== r.a && a.owner !== r.b) continue; const other = a.owner === r.a ? r.b : r.a; if (w.provinces[a.prov].neighbors.some(n => g.provinces[n].owner === other) && armyMen(a) > 2000) t += 15; } if (border) t += 10; }
    r.tension += (Math.min(100, t) - r.tension) * 0.3;
    if (r.alliance || r.trade) r.trust = Math.min(100, r.trust + 0.3);
  }
  for (const k of g.kingdoms) { const war = Object.values(g.relations).some(r => r.war && (r.a === k.id || r.b === k.id)); k.warExhaustion = Math.max(0, Math.min(100, k.warExhaustion + (war ? 0.6 : -1))); }
}
export function warsOf(g: GameState, k: number) { return Object.values(g.relations).filter(r => r.war && (r.a === k || r.b === k)).map(r => r.a === k ? r.b : r.a); }
export { atWar };
