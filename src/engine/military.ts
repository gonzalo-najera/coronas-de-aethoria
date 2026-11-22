// Military + Logistics Engines: reclutamiento, rutas, movimiento, abastecimiento y asedios.
import type { GameState, Army, Unit, Kingdom, ResId } from './types';
import { UNIT, SPECIES, TECH } from './data';
import { ust, tierName } from './milcat';
import { availableTiers, bestTier, armsCost, trainingMonths, newRegiment, absorb, armyLoad, siegePower, tierOf, regLog } from './equipment';
import type { World } from './world';
import { atWar, allied, rel, armyMen, alert, chron, nid, seasonFor, makeCharacter, rngOf, saveRng } from './game';
import { recruitPool, isSupplied, supplyCapacity, maxSupply } from './economy';

export function canEnter(g: GameState, kid: number, pid: number): boolean {
  const o = g.provinces[pid].owner; if (o < 0 || o === kid) return true; if (atWar(g, kid, o) || allied(g, kid, o)) return true;
  const r = rel(g, kid, o); if (r && r.protectorate === kid) return true; return false;
}
export function armySpeed(w: World, g: GameState, a: Army): number {
  let s = 99; for (const u of a.units) if (u.men > 0) s = Math.min(s, UNIT[u.type].stratSpeed); if (s === 99) s = 1;
  return s;
}
export function stepCost(w: World, g: GameState, a: Army | { owner: number; units: Unit[] }, from: number, to: number): number {
  const s = w.provinces[to]; const p = g.provinces[to];
  let c = s.moveCost; const roads = p.buildings.camino && g.provinces[from].buildings.camino; if (roads) c *= 0.65;
  // afinidad de terreno de la composición (centauros en llanura, enanos en montaña)
  let tf = 0, men = 0; for (const u of a.units) { const d = UNIT[u.type]; const m = d.terrain[s.biome] ?? 1; tf += m * u.men; men += u.men; } if (men) c /= Math.max(0.5, tf / men);
  const season = seasonFor(g.turn, s.hemisphere); if (season === 'Invierno' && (s.climate === 'frio')) c *= 1.5; else if (season === 'Invierno') c *= 1.15;
  if (s.river && !roads) c *= 1.1;
  return c;
}
export function findPath(w: World, g: GameState, a: Army, dest: number): number[] | null {
  if (dest === a.prov) return [];
  if (!canEnter(g, a.owner, dest)) return null;
  const N = w.provinces.length; const dist = new Float64Array(N).fill(Infinity); const prev = new Int32Array(N).fill(-1);
  dist[a.prov] = 0; const open = new Set([a.prov]);
  while (open.size) {
    let c = -1, bd = Infinity; for (const o of open) if (dist[o] < bd) { bd = dist[o]; c = o; } open.delete(c);
    if (c === dest) break;
    for (const n of w.provinces[c].neighbors) { if (!canEnter(g, a.owner, n)) continue; const nd = dist[c] + stepCost(w, g, a, c, n); if (nd < dist[n]) { dist[n] = nd; prev[n] = c; open.add(n); } }
  }
  if (!isFinite(dist[dest])) return null;
  const path: number[] = []; let c = dest; while (c !== a.prov) { path.unshift(c); c = prev[c]; } return path;
}
export function pathInfo(w: World, g: GameState, a: Army, path: number[]) {
  // tiempo estimado (meses) y riesgos
  let t = 0, prev = a.prov, outSupply = 0; const risks: string[] = []; const sp = armySpeed(w, g, a);
  for (const p of path) { t += stepCost(w, g, a, prev, p) / sp; if (!isSupplied(w, g, { owner: a.owner, prov: p })) outSupply++; const ow = g.provinces[p].owner; if (ow >= 0 && atWar(g, a.owner, ow)) risks.push('Territorio enemigo: ' + w.provinces[p].name); if (w.provinces[p].strategic.includes('Paso de montaña')) risks.push('Paso de montaña: avance lento'); prev = p; }
  const men = armyMen(a); const load = armyLoad(a);
  for (const p of path) if (load > supplyCapacity(w, g, p)) { risks.push(`${w.provinces[p].name} no puede abastecer a ${men.toLocaleString('es')} soldados`); break; }
  if (outSupply) risks.push(`${outSupply} provincia(s) sin línea de abastecimiento: se consumirán las reservas de campaña`);
  return { months: t, outSupply, risks: [...new Set(risks)] };
}

export function recruitOptions(w: World, g: GameState, kid: number, pid: number) {
  const k = g.kingdoms[kid]; const p = g.provinces[pid];
  return Object.values(UNIT).map(u => {
    const why: string[] = [];
    if (p.owner !== kid) why.push('No es tu provincia'); if (p.occupier >= 0) why.push('Ocupada');
    for (const t of u.techs) if (!k.techs.includes(t)) why.push('Requiere ' + (TECH[t]?.name || t));
    if (u.needsBarracks && !p.buildings.cuartel) why.push('Requiere cuartel');
    const pool = recruitPool(w, g, pid, u.species);
    if (u.species && (p.species[u.species] || 0) < 0.03) why.push(`Pocos ${SPECIES[u.species].plural.toLowerCase()} en la provincia`);
    return { u, pool, why };
  });
}
export function recruit(w: World, g: GameState, kid: number, pid: number, type: string, men: number, tier?: number): Army | null {
  const k = g.kingdoms[kid]; const p = g.provinces[pid]; const u = UNIT[type];
  const opt = recruitOptions(w, g, kid, pid).find(o => o.u.id === type)!; if (opt.why.length) return null;
  men = Math.floor(Math.min(men, opt.pool)); if (men < (u.species === 'gigante' ? 5 : 50)) return null;
  if (tier == null) tier = bestTier(g, kid, pid); if (!availableTiers(g, kid, pid)[tier]?.ok) return null;
  const gold = men / 100 * u.cost.oro, arms = armsCost(type, tier, men);
  if (k.stock.oro < gold || k.stock.armas < arms) return null;
  k.stock.oro -= gold; k.stock.armas -= arms; p.pop -= men; p.mobilized += men;
  let a = g.armies.find(x => x.owner === kid && x.prov === pid && !x.path.length);
  if (!a) { const r = rngOf(g); a = { id: nid(g), owner: kid, name: armyName(g, kid), prov: pid, units: [], wounded: {}, path: [], progress: 0, supply: maxSupply(k), morale: 60, general: makeCharacter(g, r, k.council.mariscal?.species || 'humano', r.int(25, 45), { estrategia: 0 }), lastBattle: -99, retreating: false, sieging: false }; saveRng(g, r); g.armies.push(a); }
  const ex = a.units.find(x => x.type === type); const exp0 = (p.buildings.cuartel ? 0.1 : 0) + (k.techs.includes('instruccion') ? 0.05 : 0);
  const nu = { type, men, exp: exp0, tier, train: trainingMonths(k, type), amm: 1 };
  if (ex) { absorb(g, ex, nu); regLog(g, ex.rid, `Recibe ${men.toLocaleString('es')} reclutas en ${p.cityName} (equipo ${tierName(tier).toLowerCase()}).`); }
  else a.units.push({ ...nu, rid: newRegiment(g, kid, type, p.cityName).id });
  return a;
}
const ORD = ['Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo'];
export function armyName(g: GameState, kid: number) { const n = g.armies.filter(a => a.owner === kid).length; return (ORD[n] || (n + 1) + 'º') + ' Ejército' + (g.kingdoms[kid].independent ? '' : ' de ' + g.kingdoms[kid].short); }
export function disband(w: World, g: GameState, a: Army, type?: string) {
  const p = g.provinces[a.prov]; const home = p.owner === a.owner ? p : g.provinces[g.kingdoms[a.owner].capital];
  const list = type ? a.units.filter(u => u.type === type) : a.units.slice();
  for (const u of list) { home.pop += u.men; home.mobilized = Math.max(0, home.mobilized - u.men); a.units.splice(a.units.indexOf(u), 1); }
  if (!a.units.length) g.armies.splice(g.armies.indexOf(a), 1);
}
export function splitArmy(g: GameState, a: Army, type: string, men: number): Army | null {
  const u = a.units.find(x => x.type === type); if (!u || men <= 0 || men >= armyMen(a)) return null; men = Math.min(men, u.men);
  u.men -= men; if (u.men <= 0) a.units.splice(a.units.indexOf(u), 1);
  const b: Army = { id: nid(g), owner: a.owner, name: armyName(g, a.owner), prov: a.prov, units: [{ type, men, exp: u.exp, tier: u.tier, train: u.train, amm: u.amm, rid: u.rid }], wounded: {}, path: [], progress: 0, supply: a.supply, morale: a.morale, general: null, lastBattle: a.lastBattle, retreating: false, sieging: false };
  g.armies.push(b); return b;
}
export function mergeArmies(g: GameState, a: Army, b: Army) {
  if (a.prov !== b.prov || a.owner !== b.owner) return;
  for (const u of b.units) { const ex = a.units.find(x => x.type === u.type); if (ex) absorb(g, ex, u); else a.units.push({ ...u }); }
  for (const t in b.wounded) a.wounded[t] = (a.wounded[t] || 0) + b.wounded[t];
  a.morale = (a.morale + b.morale) / 2; if (!a.general) a.general = b.general; g.armies.splice(g.armies.indexOf(b), 1);
}

// Movimiento mensual (paso 8). Devuelve encuentros hostiles detectados.
export function moveArmies(w: World, g: GameState) {
  for (const a of g.armies) {
    if (!a.path.length) { a.progress = 0; continue; }
    a.sieging = false;
    let mp = armySpeed(w, g, a) * (a.supply <= 0 ? 0.8 : 1) * (a.retreating ? 1.2 : 1);
    while (a.path.length && mp > 0) {
      const next = a.path[0];
      if (!canEnter(g, a.owner, next)) { a.path = []; if (a.owner === g.playerId) alert(g, 'importante', `${a.name} no puede entrar en ${w.provinces[next].name}: no hay derecho de paso.`, { army: a.id }); break; }
      const c = stepCost(w, g, a, a.prov, next); const need = c * (1 - a.progress);
      if (mp >= need) { mp -= need; a.prov = next; a.path.shift(); a.progress = 0; if (g.armies.some(o => o.prov === next && o !== a && atWar(g, o.owner, a.owner))) { a.path = []; break; } }
      else { a.progress += mp / c; mp = 0; }
    }
    if (!a.path.length) a.retreating = false;
  }
}
// Logística (paso 9)
export function logistics(w: World, g: GameState) {
  const r = rngOf(g);
  for (const a of g.armies.slice()) {
    const k = g.kingdoms[a.owner]; const men = armyLoad(a); const sup = isSupplied(w, g, a);
    if (sup) { a.supply = Math.min(maxSupply(k), a.supply + 1); a.morale = Math.min(90, a.morale + 4); }
    else { a.supply -= 1; }
    const capac = supplyCapacity(w, g, a.prov);
    let attr = 0;
    if (a.supply < 0) { attr += 0.04; a.morale = Math.max(0, a.morale - 12); if (a.owner === g.playerId) alert(g, 'critica', `${a.name} se ha quedado sin suministros: deserciones y enfermedades.`, { army: a.id }); }
    if (sup && men > capac) attr += 0.01 * Math.min(3, men / capac - 1 + 0.5);
    if (sup && k.stock.alimentos <= 0) { attr += 0.02; a.morale -= 6; }
    if (k.stock.oro < 0) { attr += 0.01; }
    if (attr > 0) for (const u of a.units) { const l = Math.floor(u.men * attr); u.men -= l; }
    // instrucción y reposición de munición (solo con línea de abastecimiento)
    for (const u of a.units) { if (u.train && u.train > 0 && sup) u.train--; const d = UNIT[u.type];
      if (sup && (u.amm ?? 1) < 1 && d.ammo > 0) { const need = (1 - (u.amm ?? 1)) * u.men / 100 * d.ammo * d.ammoUse; const pay = Math.min(need, Math.max(0, k.stock.armas)); k.stock.armas -= pay; u.amm = Math.min(1, (u.amm ?? 1) + (need > 0 ? (1 - (u.amm ?? 1)) * pay / need : 1)); if (pay < need && a.owner === g.playerId) alert(g, 'importante', `${a.name}: no hay armas suficientes para reponer la munición.`, { army: a.id }); } }
    // recuperación de heridos
    const rec = (sup ? 0.2 : 0.05) * (k.techs.includes('herboristeria') ? 1.3 : 1) * (g.provinces[a.prov].buildings.hospital ? 1.5 : 1);
    for (const t in a.wounded) { const back = Math.floor(a.wounded[t] * rec); if (back <= 0) { if (a.wounded[t] < 20) { const home = g.provinces[k.capital]; home.mobilized = Math.max(0, home.mobilized - a.wounded[t]); home.pop += a.wounded[t]; delete a.wounded[t]; } continue; } a.wounded[t] -= back; const u = a.units.find(x => x.type === t); if (u) u.men += back; else a.units.push({ type: t, men: back, exp: 0.1, tier: 1, rid: newRegiment(g, a.owner, t, g.provinces[a.prov].cityName).id }); }
    a.units = a.units.filter(u => u.men > 0);
    if (!a.units.length && !Object.keys(a.wounded).length) g.armies.splice(g.armies.indexOf(a), 1);
  }
  saveRng(g, r);
}

// Asedios (paso 11b)
export function garrison(g: GameState, pid: number) { const b = g.provinces[pid].buildings; return 300 + (b.murallas || 0) * 600 + (b.castillo ? 1000 : 0); }
export function siegeMonths(g: GameState, pid: number, a: Army) {
  const b = g.provinces[pid].buildings; let m = 1 + (b.murallas || 0) * 2 + (b.castillo ? 3 : 0);
  const k = g.kingdoms[a.owner]; if (k.techs.includes('asedio')) m *= 0.6; m /= 1 + siegePower([a]) / 40;
  return Math.max(1, Math.round(m));
}
export function processSieges(w: World, g: GameState) {
  for (const p of g.provinces) {
    const besiegers = g.armies.filter(a => a.prov === p.id && !a.path.length && p.owner >= 0 && ((atWar(g, a.owner, p.owner) && p.occupier !== a.owner) || (a.owner === p.owner && p.occupier >= 0)));
    const defenders = g.armies.filter(a => a.prov === p.id && besiegers.some(b => atWar(g, a.owner, b.owner)));
    if (!besiegers.length || defenders.length) { if (p.siege && !besiegers.length) p.siege = null; continue; }
    const a = besiegers[0]; a.sieging = true;
    if (a.owner === p.owner) { p.occupier = -1; p.siege = null; if (a.owner === g.playerId) alert(g, 'importante', `${p.cityName} liberada por ${a.name}.`, { prov: p.id }); chron(g, a.owner, 'guerra', `${p.cityName} es liberada.`); continue; }
    const men = besiegers.reduce((s, x) => s + armyMen(x), 0); const gar = garrison(g, p.id);
    if (!p.siege || p.siege.by !== a.owner) p.siege = { by: a.owner, progress: 0, months: 0 };
    if (men < gar) { if (a.owner === g.playerId && p.siege.months === 0) alert(g, 'importante', `${a.name} no tiene efectivos suficientes para asediar ${p.cityName} (guarnición ≈${gar}). Solo puede bloquearla.`, { army: a.id }); p.siege.months++; continue; }
    p.siege.months++; p.siege.progress += 100 / siegeMonths(g, p.id, a) * Math.min(1.5, men / (gar * 3));
    if (p.siege.progress >= 100) occupy(w, g, p.id, a.owner);
  }
}
export function occupy(w: World, g: GameState, pid: number, by: number) {
  const p = g.provinces[pid]; p.occupier = by; p.siege = null; p.prosperity = Math.max(0, p.prosperity - 15);
  const vic = g.kingdoms[p.owner], k = g.kingdoms[by];
  const r = rel(g, by, p.owner); if (r) r.warScore += (r.a === by ? 1 : -1) * (pid === vic.capital ? 25 : 10);
  if (by === g.playerId || p.owner === g.playerId) alert(g, by === g.playerId ? 'importante' : 'critica', `${p.cityName} (${w.provinces[pid].name}) ha caído ante ${k.name}.`, { prov: pid });
  chron(g, by, 'guerra', `${k.name} toma ${p.cityName} tras un asedio.`, true);
}
export function assault(w: World, g: GameState, a: Army): { ok: boolean; text: string } {
  const p = g.provinces[a.prov]; if (!p.siege || p.siege.by !== a.owner) return { ok: false, text: 'No hay asedio en curso.' };
  const r = rngOf(g); const gar = garrison(g, p.id); const men = armyMen(a);
  const giants = Math.min(2, 1 + siegePower([a]) / 80);
  const chance = Math.max(0.05, Math.min(0.9, (men / (gar * 5)) * giants * (0.5 + p.siege.progress / 100)));
  const ok = r.next() < chance; const lossPct = ok ? 0.06 + r.next() * 0.06 : 0.1 + r.next() * 0.1;
  let lost = 0; for (const u of a.units) { const l = Math.floor(u.men * lossPct); u.men -= l; lost += l; a.wounded[u.type] = (a.wounded[u.type] || 0) + Math.floor(l * 0.5); }
  a.morale = Math.max(0, a.morale + (ok ? 5 : -15)); saveRng(g, r);
  if (ok) occupy(w, g, p.id, a.owner);
  const text = ok ? `¡Asalto victorioso! ${p.cityName} cae. Bajas: ${lost.toLocaleString('es')}.` : `El asalto a ${p.cityName} fracasa. Bajas: ${lost.toLocaleString('es')} (la mitad, heridos).`;
  chron(g, a.owner, 'guerra', text, ok); return { ok, text };
}
export function retreatTarget(w: World, g: GameState, a: Army): number | null {
  const opts = w.provinces[a.prov].neighbors.filter(n => { const o = g.provinces[n].owner; return (o === a.owner || (o >= 0 && allied(g, a.owner, o)) || o < 0) && !g.armies.some(x => x.prov === n && atWar(g, x.owner, a.owner)); });
  if (!opts.length) return null; opts.sort((x, y) => (g.provinces[y].owner === a.owner ? 1 : 0) - (g.provinces[x].owner === a.owner ? 1 : 0)); return opts[0];
}
export function armyStrength(a: Army) { let s = 0; for (const u of a.units) { const d = ust(u.type, tierOf(u)); s += u.men * (d.atk + d.def + d.ranged / Math.max(1, d.reload) + d.armor * 0.5) * (1 + u.exp * 0.3) * (u.train ? 0.8 : 1); } return s * (0.5 + a.morale / 200); }
