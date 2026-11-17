// Exploration Engine: expediciones con posición y ruta reales sobre el mundo persistente, y colonización.
import type { GameState, Expedition, RegionRef, Kingdom } from './types';
import type { World } from './world';
import { DEPOSITS, SPECIES } from './data';
import { alert, chron, nid, rngOf, saveRng, makeCharacter, pickSpecies, seasonFor, rel } from './game';

export const EXP_KINDS = { terrestre: 'Exploración terrestre', maritima: 'Exploración marítima costera', oceanica: 'Exploración oceánica' };
export const DIRS: Record<string, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], O: [-1, 0] };
export interface ExpPlan { start: number; kind: Expedition['kind']; dir: Expedition['dir']; members: number; supplies: number; escort: number; risk: number; leaderIdx: number; }
export function expCost(p: ExpPlan) { return { oro: Math.round(20 + p.members * 0.12 + p.escort * 0.25 + p.supplies * p.members * 0.008 + (p.kind !== 'terrestre' ? 40 : 0)), alimentos: Math.round(p.supplies * (p.members + p.escort) / 1000 * 1.6) }; }
export function expCheck(w: World, g: GameState, kid: number, p: ExpPlan): string[] {
  const k = g.kingdoms[kid]; const why: string[] = []; const pr = g.provinces[p.start];
  if (pr.owner !== kid) why.push('El punto de partida debe ser una provincia propia');
  if (p.kind !== 'terrestre' && !pr.buildings.puerto) why.push('Las expediciones marítimas parten de un puerto');
  if (p.kind === 'oceanica' && !k.techs.includes('oceanica')) why.push('Requiere la tecnología Navegación oceánica');
  const c = expCost(p); if (k.stock.oro < c.oro) why.push(`Faltan ${Math.ceil(c.oro - k.stock.oro)} de oro`); if (k.stock.alimentos < c.alimentos) why.push(`Faltan ${Math.ceil(c.alimentos - k.stock.alimentos)} de alimentos`);
  if (pr.pop < p.members * 4) why.push('Población insuficiente en el punto de partida');
  if (g.expeditions.filter(e => e.owner === kid && (e.state === 'activa' || e.state === 'regreso')).length >= 3) why.push('Máximo 3 expediciones simultáneas');
  return why;
}
export function explorers(g: GameState, k: Kingdom) { const r = rngOf(g); const mix = g.provinces[k.capital].species; const list = [k.council.explorador]; const extra = (g as any).__explorers?.[k.id]; return list.concat(extra || []); }
export function launchExpedition(w: World, g: GameState, kid: number, p: ExpPlan, name?: string): Expedition | null {
  if (expCheck(w, g, kid, p).length) return null; const k = g.kingdoms[kid]; const c = expCost(p);
  k.stock.oro -= c.oro; k.stock.alimentos -= c.alimentos; g.provinces[p.start].pop -= p.members;
  const r = rngOf(g);
  const leader = p.leaderIdx === 0 && k.council.explorador ? k.council.explorador : makeCharacter(g, r, pickSpecies(r, g.provinces[p.start].species), r.int(24, 45), { inteligencia: 1 });
  saveRng(g, r);
  const loc: RegionRef = { t: 'p', id: p.start };
  const e: Expedition = { id: nid(g), owner: kid, name: name || `Expedición ${leader.name.split(' ').slice(-1)[0]}`, kind: p.kind, leader, members: p.members, startMembers: p.members, supplies: p.supplies, startSupplies: p.supplies, escort: p.escort, dir: p.dir, risk: p.risk, loc, route: [loc], home: p.start, months: 0, maxMonths: p.supplies, state: 'activa', found: [], discovered: 0, discoveredSeas: 0, contacts: [], log: [], losses: 0, ruinsFound: 0, opportunities: [] };
  g.expeditions.push(e);
  if (kid === g.playerId) chron(g, kid, 'expedicion', `Parte la ${e.name} desde ${g.provinces[p.start].cityName} rumbo al ${({ N: 'norte', S: 'sur', E: 'este', O: 'oeste' })[p.dir]}.`, true);
  return e;
}
const posOf = (w: World, r: RegionRef) => r.t === 'p' ? [w.provinces[r.id].cx, w.provinces[r.id].cy] : [w.seas[r.id].cx, w.seas[r.id].cy];
export { posOf };
function candidates(w: World, g: GameState, e: Expedition): RegionRef[] {
  const k = g.kingdoms[e.owner]; const out: RegionRef[] = [];
  if (e.kind === 'terrestre') { if (e.loc.t === 'p') for (const n of w.provinces[e.loc.id].neighbors) out.push({ t: 'p', id: n }); }
  else {
    const ocean = e.kind === 'oceanica';
    if (e.loc.t === 'p') { for (const s of w.provinces[e.loc.id].seas) if (ocean || !w.seas[s].deep) out.push({ t: 's', id: s }); }
    else for (const s of w.seas[e.loc.id].neighbors) if (ocean || !w.seas[s].deep) out.push({ t: 's', id: s });
  }
  return out;
}
function reveal(w: World, g: GameState, e: Expedition, r: RegionRef, rnd: () => number) {
  const k = g.kingdoms[e.owner]; const carto = k.techs.includes('cartografia');
  const mark = (p: number, lvl: number) => { if (k.known[p] < lvl) { k.known[p] = lvl; if (lvl >= 2) { k.lastOwner[p] = g.provinces[p].owner; k.lastSeen[p] = g.turn; } if (lvl >= 1 && !e.found.includes('p' + p)) { e.found.push('p' + p); e.discovered++; } } else if (lvl >= 2) { k.lastOwner[p] = g.provinces[p].owner; k.lastSeen[p] = g.turn; } };
  const markS = (s: number, lvl: number) => { if (k.seaKnown[s] < lvl) { k.seaKnown[s] = lvl; e.discoveredSeas++; } };
  if (r.t === 'p') {
    const s = w.provinces[r.id]; mark(r.id, 2);
    for (const n of s.neighbors) { mark(n, 1); if (carto) for (const m of w.provinces[n].neighbors) mark(m, 1); }
    for (const sea of s.seas) markS(sea, 1);
    const p = g.provinces[r.id];
    if (s.ruins && !(g as any).__ruins?.[e.owner + '-' + r.id]) { (g as any).__ruins = (g as any).__ruins || {}; (g as any).__ruins[e.owner + '-' + r.id] = 1; e.ruinsFound++; k.research.progress += 60; e.log.push({ turn: g.turn, text: `Ruinas antiguas en ${s.name}: los eruditos recuperan saberes perdidos (+60 investigación).` }); }
    s.deposits.forEach((d, i) => { if (!d.hidden && rnd() < 0.8) { const t = `${DEPOSITS[d.kind].name} en ${s.name}`; if (!e.log.some(l => l.text.includes(t))) e.log.push({ turn: g.turn, text: 'Recurso avistado: ' + t + '.' }); } });
    if (p.owner < 0 && s.fertility > 0.6 && !e.opportunities.includes(r.id)) e.opportunities.push(r.id);
    if (p.owner >= 0 && p.owner !== e.owner && !e.contacts.includes(p.owner)) { e.contacts.push(p.owner); const o = g.kingdoms[p.owner]; e.log.push({ turn: g.turn, text: `Contacto con ${o.name} en ${s.name}.` }); }
    for (const st of s.strategic) if (!e.log.some(l => l.text.includes(st))) e.log.push({ turn: g.turn, text: `${s.name}: ${st}.` });
  } else {
    const sr = w.seas[r.id]; markS(r.id, 2); for (const n of sr.neighbors) markS(n, 1);
    for (const p of sr.provinces) mark(p, 1);
    // desembarco de reconocimiento en una costa
    if (sr.provinces.length && rnd() < 0.6) { const p = sr.provinces[Math.floor(rnd() * sr.provinces.length)]; mark(p, 2); const o = g.provinces[p].owner; if (o >= 0 && o !== e.owner && !e.contacts.includes(o)) { e.contacts.push(o); e.log.push({ turn: g.turn, text: `Desembarco en ${w.provinces[p].name}: contacto con ${g.kingdoms[o].name}.` }); } if (o < 0 && w.provinces[p].fertility > 0.6 && !e.opportunities.includes(p)) e.opportunities.push(p); }
  }
}
export function processExpeditions(w: World, g: GameState) {
  const r = rngOf(g); const rnd = () => r.next();
  for (const e of g.expeditions) {
    if (e.state !== 'activa' && e.state !== 'regreso') continue;
    const k = g.kingdoms[e.owner]; e.months++; e.supplies -= 1;
    const carto = k.techs.includes('cartografia');
    if (e.state === 'activa') {
      const steps = (e.kind === 'terrestre' ? 2 : 2) + (carto ? 1 : 0) + (e.kind === 'oceanica' ? 1 : 0) + (e.kind === 'terrestre' && e.leader.species === 'centauro' ? 1 : 0);
      for (let s = 0; s < steps; s++) {
        const c = candidates(w, g, e); if (!c.length) break;
        const [cx, cy] = posOf(w, e.loc); const [dx, dy] = DIRS[e.dir];
        const lost = rnd() < (0.06 - (carto ? 0.025 : 0) + e.risk * 0.02);
        let best = c[0], bv = -1e9;
        for (const cand of c) { const [x, y] = posOf(w, cand); const d = Math.hypot(x - cx, y - cy) || 1; let v = ((x - cx) * dx + (y - cy) * dy) / d * 2; const kn = cand.t === 'p' ? k.known[cand.id] : k.seaKnown[cand.id]; v += kn === 0 ? 1.4 : kn === 1 ? 0.7 : 0; if (e.route.some(x2 => x2.t === cand.t && x2.id === cand.id)) v -= 3; v += rnd() * (lost ? 6 : 0.6); if (v > bv) { bv = v; best = cand; } }
        if (lost && s === 0) e.log.push({ turn: g.turn, text: 'La expedición se extravía y cambia de rumbo.' });
        e.loc = best; e.route.push(best); reveal(w, g, e, best, rnd);
      }
      // peligros
      let risk = [0.04, 0.07, 0.11][e.risk] - (e.leader.inteligencia - 5) * 0.006;
      const here = e.loc.t === 'p' ? w.provinces[e.loc.id] : null;
      const season = seasonFor(g.turn, here ? here.hemisphere : 'N');
      if (e.loc.t === 's') { risk += w.seas[e.loc.id].deep ? 0.06 : 0.02; if (season === 'Invierno') risk += 0.04; if (k.techs.includes('naval')) risk *= 0.7; }
      if (here && ['montana', 'nieve', 'desierto', 'selva', 'pantano'].includes(here.biome)) risk += 0.04;
      if (rnd() < risk) {
        const kinds = e.loc.t === 's' ? ['tormenta', 'tormenta', 'enfermedad', 'accidente'] : ['enfermedad', 'accidente', 'hostiles', 'escasez'];
        const ev = kinds[Math.floor(rnd() * kinds.length)]; let f = 0.06 + rnd() * (ev === 'tormenta' ? 0.25 : 0.12) * (1 + e.risk * 0.3);
        if (ev === 'hostiles') { const o = here ? g.provinces[here.id].owner : -1; if (o >= 0 && o !== e.owner && (rel(g, o, e.owner)?.opinion ?? 0) > 10) f = 0; else f *= Math.max(0.3, 1 - e.escort / Math.max(1, e.members) * 2); }
        const lost = Math.round(e.members * f); e.members -= lost; e.losses += lost; if (ev === 'tormenta') e.supplies -= 1;
        const t = { tormenta: 'Una tormenta castiga la flota', enfermedad: 'Fiebres entre los expedicionarios', accidente: 'Un accidente en el camino', hostiles: 'Emboscada de habitantes hostiles', escasez: 'Las provisiones se echan a perder' }[ev];
        if (lost > 0 || ev === 'escasez') e.log.push({ turn: g.turn, text: `${t}: ${lost} bajas.` }); if (ev === 'escasez') e.supplies -= 1;
      }
      if (e.supplies <= e.startSupplies / 2 || e.months >= e.maxMonths / 2) { e.state = 'regreso'; e.log.push({ turn: g.turn, text: 'Con la mitad de las provisiones consumidas, la expedición emprende el regreso.' }); }
    } else {
      // regreso por la ruta conocida
      for (let s = 0; s < 3; s++) { const idx = e.route.findIndex(x => x.t === e.loc.t && x.id === e.loc.id); if (idx <= 0) { e.loc = { t: 'p', id: e.home }; break; } e.loc = e.route[idx - 1]; }
      if (e.loc.t === 'p' && e.loc.id === e.home) finishExpedition(w, g, e);
    }
    if (e.supplies < 0) { const l = Math.round(e.members * 0.15); e.members -= l; e.losses += l; e.log.push({ turn: g.turn, text: `Hambre: ${l} bajas.` }); }
    if (e.members < 8 && (e.state as string) !== 'terminada') { e.state = 'perdida'; e.log.push({ turn: g.turn, text: 'La expedición desaparece. No se volverá a saber de ella.' }); if (e.owner === g.playerId) { alert(g, 'critica', `La ${e.name} se ha perdido.`, { exp: e.id }); g.expReports.push(e.id); } chron(g, e.owner, 'expedicion', `La ${e.name} se pierde sin dejar rastro.`, true); }
  }
  saveRng(g, r);
}
function finishExpedition(w: World, g: GameState, e: Expedition) {
  e.state = 'terminada'; g.provinces[e.home].pop += e.members;
  const k = g.kingdoms[e.owner]; k.stock.prestigio += Math.min(10, e.discovered * 0.3); e.leader.exp += 2;
  if (e.owner === g.playerId) { alert(g, 'completado', `La ${e.name} regresa: ${e.discovered} regiones descubiertas.`, { exp: e.id }); g.expReports.push(e.id); }
  chron(g, e.owner, 'expedicion', `La ${e.name} regresa tras ${e.months} meses con ${e.discovered} regiones descubiertas${e.contacts.length ? ' y contacto con ' + e.contacts.map(c => g.kingdoms[c].short).join(', ') : ''}.`, true);
}

// Colonización
export const COLONY_KINDS: Record<string, { name: string; cost: { oro: number; alimentos: number; madera?: number; piedra?: number }; settlers: number; months: number; desc: string }> = {
  colonia: { name: 'Colonia agrícola', cost: { oro: 150, alimentos: 80, madera: 40 }, settlers: 1500, months: 6, desc: 'Asentamiento de colonos con granjas.' },
  puesto: { name: 'Puesto comercial', cost: { oro: 120, alimentos: 30, madera: 30 }, settlers: 600, months: 4, desc: 'Enclave de comercio con mercado (y puerto si es costero).' },
  fortaleza: { name: 'Fortaleza fronteriza', cost: { oro: 180, alimentos: 40, piedra: 100 }, settlers: 800, months: 6, desc: 'Plaza fuerte con murallas y atalaya.' },
};
export function colonyCheck(w: World, g: GameState, kid: number, pid: number, kind: string): string[] {
  const k = g.kingdoms[kid]; const p = g.provinces[pid], s = w.provinces[pid]; const why: string[] = []; const C = COLONY_KINDS[kind];
  if (p.owner >= 0) why.push('La provincia ya pertenece a un reino'); if (p.colonizing) why.push('Ya hay una fundación en curso');
  if (k.known[pid] < 2) why.push('Debe estar explorada');
  const adj = s.neighbors.some(n => g.provinces[n].owner === kid);
  const port = g.provinces.some(q => q.owner === kid && q.buildings.puerto);
  const sea = s.coastal && port && s.seas.some(x => k.seaKnown[x] >= 1) && (s.continent === w.provinces[k.capital].continent || k.techs.includes('oceanica') || s.seas.some(x => !w.seas[x].deep && w.seas[x].provinces.some(q => g.provinces[q].owner === kid)));
  if (!adj && !sea) why.push('Debe limitar con tu territorio, o ser costera y alcanzable desde uno de tus puertos (ultramar requiere Navegación oceánica)');
  for (const r in C.cost) if ((k.stock as any)[r] < (C.cost as any)[r]) why.push(`Falta ${r}`);
  if (g.provinces[k.capital].pop < C.settlers * 5) why.push('La capital no tiene población suficiente para enviar colonos');
  return why;
}
export function startColony(w: World, g: GameState, kid: number, pid: number, kind: string, name: string): boolean {
  if (colonyCheck(w, g, kid, pid, kind).length) return false; const k = g.kingdoms[kid]; const C = COLONY_KINDS[kind];
  for (const r in C.cost) (k.stock as any)[r] -= (C.cost as any)[r]; g.provinces[k.capital].pop -= C.settlers;
  g.provinces[pid].colonizing = { by: kid, monthsLeft: C.months, kind, name: name || g.provinces[pid].cityName, settlers: C.settlers };
  if (kid === g.playerId) chron(g, kid, 'colonia', `Parten colonos hacia ${w.provinces[pid].name} para fundar ${name}.`);
  return true;
}
export function processColonies(w: World, g: GameState) {
  for (const p of g.provinces) {
    const c = p.colonizing; if (!c) continue; if (p.owner >= 0) { p.colonizing = null; continue; }
    c.monthsLeft--; if (c.monthsLeft > 0) continue;
    const k = g.kingdoms[c.by]; p.owner = c.by; p.colonizing = null; p.control = 20; p.cityName = c.name;
    const settlersSp = g.provinces[k.capital].species; const tot = p.pop + c.settlers;
    for (const sp in p.species) (p.species as any)[sp] = ((p.species as any)[sp] * p.pop + (settlersSp as any)[sp] * c.settlers) / tot; p.pop = tot;
    p.stability = 45; p.prosperity = 30; p.conqueredTurn = -999;
    if (c.kind === 'colonia') p.buildings.granja = 1; if (c.kind === 'puesto') { p.buildings.mercado = 1; if (w.provinces[p.id].coastal) p.buildings.puerto = 1; } if (c.kind === 'fortaleza') { p.buildings.murallas = 1; p.buildings.torre = 1; }
    k.known[p.id] = 2;
    chron(g, c.by, 'colonia', `Fundación de ${c.name} (${COLONY_KINDS[c.kind].name.toLowerCase()}) en ${w.provinces[p.id].name}.`, true);
    if (c.by === g.playerId) { g.stats.founded++; alert(g, 'completado', `Se funda ${c.name}. El control del territorio se consolidará con los años.`, { prov: p.id }); }
  }
}
export { SPECIES };
