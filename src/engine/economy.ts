// Economy, Population y Construction Engines. Toda cifra mostrada en la interfaz sale de estas funciones.
import type { GameState, ResId, Breakdown, SpeciesId, Kingdom, ProvState } from './types';
import { SPECIES, SPECIES_IDS, BLD, BuildingDef, UNIT, DEPOSITS, RES, TRADEABLE, TECH } from './data';
import type { World } from './world';
import { seasonFor, armyMen, rel, atWar, alert, chron, totalPop, dateOf } from './game';

export type ResMap = Record<ResId, number>;
export const ZERO = (): ResMap => ({ oro: 0, alimentos: 0, madera: 0, piedra: 0, hierro: 0, herramientas: 0, armas: 0, investigacion: 0, prestigio: 0 });
const add = (b: Breakdown, label: string, value: number) => { if (Math.abs(value) >= 0.005) b.push({ label, value }); };
export const sum = (b: Breakdown) => b.reduce((s, x) => s + x.value, 0);
const spBonus = (p: ProvState, r: ResId) => SPECIES_IDS.reduce((s, sp) => s + (p.species[sp] || 0) * (SPECIES[sp].prod[r] || 0), 0);
const has = (k: Kingdom, t: string) => k.techs.includes(t);

export function seasonMult(w: World, g: GameState, pid: number, turnOffset = 0) {
  const s = w.provinces[pid]; const season = seasonFor(g.turn + turnOffset, s.hemisphere);
  if (s.climate === 'tropical') return { f: 1, season };
  const cold = s.climate === 'frio';
  const f = season === 'Primavera' ? 0.9 : season === 'Verano' ? 1.1 : season === 'Otoño' ? 1.35 : cold ? 0.3 : 0.55;
  return { f, season };
}
export function foodConsMult(p: ProvState) { return SPECIES_IDS.reduce((s, sp) => s + (p.species[sp] || 0) * SPECIES[sp].consumo, 0); }

export interface ProvEco { prod: Record<ResId, Breakdown>; cons: Record<ResId, Breakdown>; workers: number; eff: Breakdown; effMult: number; }
export function provinceEconomy(w: World, g: GameState, pid: number): ProvEco {
  const p = g.provinces[pid], s = w.provinces[pid]; const k = g.kingdoms[p.owner];
  const prod = {} as Record<ResId, Breakdown>, cons = {} as Record<ResId, Breakdown>;
  for (const r of Object.keys(RES) as ResId[]) { prod[r] = []; cons[r] = []; }
  const eff: Breakdown = [];
  if (!k) return { prod, cons, workers: 0, eff, effMult: 0 };
  const b = p.buildings;
  const workers = p.pop * 0.42;
  const W1k = workers / 1000;
  // multiplicador de eficiencia común
  add(eff, 'Base', 1);
  add(eff, 'Estabilidad', -0.3 * Math.max(0, 1 - p.stability / 60));
  if (p.control < 100) add(eff, 'Control territorial incompleto', -(1 - p.control / 100) * 0.7);
  if (p.occupier >= 0) add(eff, 'Ocupación enemiga', -0.6);
  if (k.laws.reclutamiento === 2) add(eff, 'Movilización general', -0.1);
  if (k.laws.integracion === 2) add(eff, 'Integración plena de especies', 0.05);
  const toolsNeed = Math.max(1, totalPop(g, k.id) / 1000 * 0.15);
  add(eff, 'Herramientas disponibles', Math.min(0.15, 0.15 * k.stock.herramientas / toolsNeed));
  if (p.plague > 0) add(eff, 'Epidemia', -0.15);
  const effMult = Math.max(0.1, sum(eff));
  const mul = (bd: Breakdown) => { const base = sum(bd); if (Math.abs(effMult - 1) > 0.005) add(bd, 'Eficiencia provincial (estabilidad, herramientas…)', base * (effMult - 1)); };
  // Alimentos
  const sm = seasonMult(w, g, pid);
  const fa = prod.alimentos;
  add(fa, 'Agricultura y ganadería natural', W1k * s.fertility * 2.0);
  if (b.granja) add(fa, `Granjas (nivel ${b.granja})`, 7 * b.granja * Math.max(0.35, s.fertility));
  if (s.coastal) add(fa, 'Pesca costera', 1.5 + (b.puerto ? 4 * b.puerto : 0));
  if (hasDep(p, s, 'caballos')) add(fa, 'Pastos de cría', 3);
  let fb = sum(fa);
  if (b.molino) add(fa, `Molino (nivel ${b.molino})`, fb * 0.15 * b.molino);
  if (b.riego) add(fa, 'Canales de riego', fb * 0.25);
  if (has(k, 'rotacion')) add(fa, 'Tecnología: Rotación de cultivos', fb * 0.15);
  add(fa, 'Especies: centauros, faunos y humanos', fb * spBonus(p, 'alimentos'));
  fb = sum(fa); add(fa, `Estación: ${sm.season}`, fb * (sm.f - 1));
  mul(fa);
  // Madera
  const forest = (s.mix.bosque || 0) + (s.mix.taiga || 0) + (s.mix.selva || 0) + (s.mix.pantano || 0) * 0.3;
  const fw = prod.madera; add(fw, 'Bosques de la provincia', W1k * forest * 1.1 + 0.4);
  if (b.aserradero) add(fw, `Aserradero (nivel ${b.aserradero})`, 5 * b.aserradero * Math.max(0.4, forest + 0.3));
  let wb = sum(fw); add(fw, 'Especies: faunos', wb * spBonus(p, 'madera'));
  if (has(k, 'silvicultura')) add(fw, 'Tecnología: Silvicultura', wb * 0.2);
  mul(fw);
  // Piedra
  const rock = (s.mix.montana || 0) + (s.mix.colinas || 0) + (s.mix.nieve || 0) * 0.5 + (s.mix.desierto || 0) * 0.2;
  const fs = prod.piedra; add(fs, 'Afloramientos rocosos', W1k * rock * 0.8 + 0.3);
  if (b.cantera) add(fs, `Cantera (nivel ${b.cantera})`, 5 * b.cantera * Math.max(0.4, rock + 0.3));
  let sb = sum(fs); add(fs, 'Especies: minotauros y gigantes', sb * spBonus(p, 'piedra'));
  if (has(k, 'mamposteria')) add(fs, 'Tecnología: Mampostería', sb * 0.15);
  mul(fs);
  // Hierro y oro de minas
  const fi = prod.hierro, fo = prod.oro;
  if (b.mina) {
    const deps = s.deposits.filter((d, i) => !d.hidden || p.revealedDeposits.includes(i));
    for (const d of deps) { const D = DEPOSITS[d.kind]; if (d.kind === 'hierro') add(fi, `Mina de hierro (nivel ${b.mina})`, 5 * b.mina); else if (d.kind === 'cobre') add(fi, `Mina de cobre (nivel ${b.mina})`, 2.5 * b.mina); else if (['oro', 'plata', 'gemas'].includes(d.kind)) add(fo, `Mina de ${D.name.toLowerCase()} (nivel ${b.mina})`, D.gold * b.mina); }
    const ib = sum(fi); if (ib > 0) { add(fi, 'Especies: enanos y minotauros', ib * spBonus(p, 'hierro')); if (has(k, 'mineria')) add(fi, 'Tecnología: Minería profunda', ib * 0.2); }
  }
  mul(fi);
  // Oro: impuestos y comercio
  const taxRate = [0.75, 1, 1.35][k.laws.impuestos];
  const tax = p.pop / 1000 * 0.24 * taxRate * (0.5 + p.prosperity / 100);
  add(fo, `Impuestos (${['bajos', 'moderados', 'altos'][k.laws.impuestos]})`, tax);
  if (b.mercado) add(fo, `Mercado (nivel ${b.mercado})`, tax * 0.2 * b.mercado * (has(k, 'comercio') ? 1.25 : 1));
  if (b.camino) add(fo, 'Caminos', tax * 0.05);
  if (b.puerto) add(fo, `Comercio portuario (nivel ${b.puerto})`, 3 * b.puerto);
  for (const d of s.deposits) if (['sal', 'especias', 'gemas', 'plantas'].includes(d.kind) && !d.hidden && !b.mina) add(fo, `Comercio de ${DEPOSITS[d.kind].name.toLowerCase()}`, DEPOSITS[d.kind].gold * 0.5);
  add(fo, 'Especies: humanos y centauros (comercio)', sum(fo) * spBonus(p, 'oro'));
  if (k.laws.integracion === 0) add(fo, 'Autonomía comunitaria', -tax * 0.05);
  mul(fo);
  // Investigación
  const fr = prod.investigacion; add(fr, 'Estudiosos y escribas', p.pop / 1000 * 0.035);
  if (b.biblioteca) add(fr, 'Biblioteca', 3); if (b.universidad) add(fr, 'Universidad', 8);
  const rb = sum(fr); add(fr, 'Especies: elfos', rb * spBonus(p, 'investigacion'));
  if (b.biblioteca) add(fr, 'Biblioteca (+10%)', rb * 0.1); if (b.universidad) add(fr, 'Universidad (+25%)', rb * 0.25);
  if (has(k, 'matematicas')) add(fr, 'Tecnología: Matemáticas', rb * 0.1);
  mul(fr);
  // Consumo
  const cm = foodConsMult(p); const winterCold = (sm.season === 'Invierno' && (s.climate === 'frio' || s.climate === 'templado')) ? 0.15 : 0;
  add(cons.alimentos, 'Población', p.pop / 1000 * 1.0);
  add(cons.alimentos, 'Especies de gran consumo (minotauros, centauros, gigantes)', p.pop / 1000 * (cm - 1));
  if (winterCold) add(cons.alimentos, 'Invierno', p.pop / 1000 * cm * winterCold);
  for (const id in b) { const d = BLD[id]; if (d && b[id]) add(cons.oro, 'Mantenimiento: ' + d.name, d.upkeep * b[id]); }
  add(cons.herramientas, 'Desgaste de herramientas', p.pop / 1000 * 0.008);
  return { prod, cons, workers, eff, effMult };
}
function hasDep(p: ProvState, s: any, kind: string) { return s.deposits.some((d: any, i: number) => d.kind === kind && (!d.hidden || p.revealedDeposits.includes(i))); }

export interface KEco { prod: Record<ResId, Breakdown>; cons: Record<ResId, Breakdown>; net: ResMap; byProv: { pid: number; prod: ResMap; cons: ResMap }[]; cap: ResMap; }
export function kingdomEconomy(w: World, g: GameState, kid: number, applyConversions = false): KEco {
  const k = g.kingdoms[kid];
  const prod = {} as Record<ResId, Breakdown>, cons = {} as Record<ResId, Breakdown>;
  for (const r of Object.keys(RES) as ResId[]) { prod[r] = []; cons[r] = []; }
  const byProv: KEco['byProv'] = [];
  const agg = (bd: Record<ResId, Breakdown>, src: Record<ResId, Breakdown>) => { for (const r in src) for (const it of src[r as ResId]) { const e = bd[r as ResId].find(x => x.label === it.label); if (e) e.value += it.value; else bd[r as ResId].push({ ...it }); } };
  let herr = 0, arm = 0, dwarfH = 0, popT = 0;
  for (const p of g.provinces) {
    if (p.owner !== kid) continue;
    const e = provinceEconomy(w, g, p.id); agg(prod, e.prod); agg(cons, e.cons);
    const pr = ZERO(), co = ZERO(); for (const r in e.prod) pr[r as ResId] = sum(e.prod[r as ResId]); for (const r in e.cons) co[r as ResId] = sum(e.cons[r as ResId]);
    byProv.push({ pid: p.id, prod: pr, cons: co });
    herr += p.buildings.herreria || 0; arm += p.buildings.armeria || 0; dwarfH += (p.species.enano || 0) * p.pop; popT += p.pop;
  }
  // Cadenas productivas (herrería y armería): requieren hierro y madera en existencias
  const dwarf = popT ? dwarfH / popT : 0;
  const avail = { hierro: k.stock.hierro + sum(prod.hierro), madera: k.stock.madera + sum(prod.madera) };
  if (herr) { const lots = Math.min(herr * 3, avail.hierro / 1, avail.madera * 3); const n = Math.max(0, lots); add(cons.hierro, 'Herrerías (fabricación de herramientas)', n); add(cons.madera, 'Herrerías (mangos y carbón)', n / 3); add(prod.herramientas, `Herrerías (${herr} niveles)`, n * (1 + dwarf * 1.5)); avail.hierro -= n; avail.madera -= n / 3; }
  if (arm) { const n = Math.max(0, Math.min(arm * 3, avail.hierro, avail.madera * 3)); add(cons.hierro, 'Armerías (forja de armas)', n); add(cons.madera, 'Armerías (astiles y escudos)', n / 3); add(prod.armas, `Armerías (${arm} niveles)`, n * (1 + dwarf * 1.2)); }
  // Ejércitos
  let armyGold = 0, armyFood = 0;
  for (const a of g.armies) if (a.owner === kid) { for (const u of a.units) { const d = UNIT[u.type]; armyGold += u.men / 100 * d.upkeep; if (isSupplied(w, g, a)) armyFood += u.men / 100 * d.food; } }
  add(cons.oro, 'Ejército: soldadas', armyGold); add(cons.alimentos, 'Ejército: raciones (tropas abastecidas)', armyFood);
  // Comercio exterior
  for (const key in g.relations) { const r = g.relations[key]; if (!r.trade || r.war || (r.a !== kid && r.b !== kid)) continue; const o = g.kingdoms[r.a === kid ? r.b : r.a]; if (!o.alive) continue; add(prod.oro, 'Acuerdo comercial con ' + o.short, 4 * (has(k, 'comercio') ? 1.5 : 1)); }
  // Tributos de protectorados
  for (const key in g.relations) { const r = g.relations[key]; if (r.protectorate === kid) { const o = g.kingdoms[r.a === kid ? r.b : r.a]; if (o.alive) add(prod.oro, 'Tributo de ' + o.short, 3); } else if (r.protectorate >= 0 && (r.a === kid || r.b === kid) && r.protectorate !== kid) add(cons.oro, 'Tributo a ' + g.kingdoms[r.protectorate].short, 3); }
  // Consejo
  const tes = k.council.tesorero; if (tes) add(prod.oro, `Tesorero ${tes.name.split(' ')[0]} (administración ${tes.administracion})`, sum(prod.oro) * (tes.administracion - 5) * 0.01);
  // Corte y prestigio
  add(cons.oro, 'Corte real y administración', 2 + byProv.length * 0.6);
  let castles = 0; for (const p of g.provinces) if (p.owner === kid) castles += p.buildings.castillo || 0;
  add(prod.prestigio, 'Castillos y corte', castles * 0.1 + 0.05);
  if (!k.independent) add(cons.prestigio, 'Erosión natural del prestigio', Math.max(0, k.stock.prestigio) * 0.01);
  const net = ZERO(); for (const r of Object.keys(RES) as ResId[]) net[r] = sum(prod[r]) - sum(cons[r]);
  const cap = storageCap(g, kid);
  return { prod, cons, net, byProv, cap };
}
export function storageCap(g: GameState, kid: number): ResMap {
  const c = ZERO(); const pop = totalPop(g, kid); let gran = 0; for (const p of g.provinces) if (p.owner === kid) gran += p.buildings.granja || 0;
  c.alimentos = 300 + pop / 1000 * 10 + gran * 40; c.madera = 1500; c.piedra = 1500; c.hierro = 800; c.herramientas = 600; c.armas = 800; c.oro = 99999; c.investigacion = 99999; c.prestigio = 999;
  return c;
}

export function isSupplied(w: World, g: GameState, a: { owner: number; prov: number }): boolean {
  const p = g.provinces[a.prov]; if (p.owner === a.owner && p.occupier < 0) return true; if (p.occupier === a.owner) return true;
  if (p.owner >= 0 && p.owner !== a.owner && rel(g, a.owner, p.owner)?.alliance) return true;
  // línea de abastecimiento: provincia vecina propia con camino o depósito
  for (const n of w.provinces[a.prov].neighbors) { const q = g.provinces[n]; if (q.owner === a.owner && q.occupier < 0 && (q.buildings.camino || q.buildings.deposito)) return true; }
  return false;
}
export function supplyCapacity(w: World, g: GameState, pid: number): number {
  const p = g.provinces[pid]; let c = 4000 + p.pop * 0.12 + (p.buildings.camino ? 5000 : 0) + (p.buildings.deposito ? 15000 : 0);
  for (const n of w.provinces[pid].neighbors) if (g.provinces[n].buildings.deposito && g.provinces[n].owner === p.owner) c += 6000;
  return Math.round(c);
}
export function maxSupply(k: Kingdom) { return 3 + (k.techs.includes('logistica') ? 2 : 0); }

// Estabilidad: factores reales que usa la simulación
export function stabilityFactors(w: World, g: GameState, pid: number): Breakdown {
  const p = g.provinces[pid]; const k = g.kingdoms[p.owner]; const b: Breakdown = []; if (!k) return b;
  add(b, 'Base', 50);
  add(b, 'Prosperidad', (p.prosperity - 50) * 0.3);
  add(b, 'Impuestos', [8, 0, -12][k.laws.impuestos]);
  add(b, 'Reclutamiento', [3, 0, -8][k.laws.reclutamiento]);
  const n = SPECIES_IDS.filter(s => (p.species[s] || 0) >= 0.12).length;
  if (n > 2) add(b, `Tensiones entre ${n} comunidades`, k.laws.integracion === 2 ? 0 : -(n - 2) * (k.laws.integracion === 0 ? 2 : 4));
  if (k.laws.integracion === 2) add(b, 'Representación de todas las especies', 3);
  if (k.stock.alimentos <= 0) add(b, 'Escasez alimentaria', -20);
  add(b, 'Legitimidad del monarca', (k.legitimacy - 50) / 5);
  if (p.buildings.murallas) add(b, 'Seguridad (murallas)', 2 * p.buildings.murallas);
  if (p.buildings.castillo) add(b, 'Castillo', 3);
  if (p.buildings.hospital) add(b, 'Hospital', 3);
  if (p.occupier >= 0) add(b, 'Ocupación enemiga', -25);
  const since = g.turn - p.conqueredTurn; if (since < 36) add(b, 'Conquista reciente', -20 * (1 - since / 36));
  if (p.control < 100) add(b, 'Control territorial en consolidación', -(100 - p.control) / 5);
  if (k.warExhaustion > 0) add(b, 'Cansancio de guerra', -k.warExhaustion / 5);
  const d = capitalDistance(w, g, p.owner, pid); if (d > 2) add(b, 'Distancia a la capital', -Math.min(15, (d - 2) * 1.5) + (k.techs.includes('administracion') ? Math.min(5, (d - 2) * 1.5) : 0));
  const nprov = g.provinces.filter(q => q.owner === k.id).length; if (nprov > 14 && !k.independent) add(b, 'Sobreextensión administrativa', -(nprov - 14) * (k.techs.includes('administracion') ? 0.5 : 1));
  if (p.unrest) add(b, 'Agitación (acontecimientos)', -p.unrest);
  if (p.plague) add(b, 'Epidemia', -8);
  return b;
}
const capDist = new Map<string, number>();
export function capitalDistance(w: World, g: GameState, kid: number, pid: number) {
  const k = g.kingdoms[kid]; const key = `${k.capital}-${pid}`; const c = capDist.get(key); if (c !== undefined) return c;
  const seen = new Map<number, number>([[k.capital, 0]]); const q = [k.capital];
  while (q.length) { const x = q.shift()!; if (x === pid) break; for (const n of w.provinces[x].neighbors) if (!seen.has(n)) { seen.set(n, seen.get(x)! + 1); q.push(n); } for (const s of w.provinces[x].seas) for (const pp of w.seas[s].provinces) if (!seen.has(pp)) { seen.set(pp, seen.get(x)! + 2); q.push(pp); } }
  const d = seen.get(pid) ?? 10; capDist.set(key, d); return d;
}
export function prosperityTarget(w: World, g: GameState, pid: number): Breakdown {
  const p = g.provinces[pid]; const k = g.kingdoms[p.owner]; const b: Breakdown = []; if (!k) return b;
  add(b, 'Base', 40); add(b, 'Fertilidad', w.provinces[pid].fertility * 10);
  if (p.buildings.mercado) add(b, 'Mercado', 8 * p.buildings.mercado); if (p.buildings.camino) add(b, 'Caminos', 6); if (p.buildings.puerto) add(b, 'Puerto', 5 * p.buildings.puerto);
  if (k.stock.alimentos <= 0) add(b, 'Hambre', -20); if (p.occupier >= 0) add(b, 'Ocupación y saqueo', -25);
  if (Object.values(g.relations).some(r => r.war && (r.a === k.id || r.b === k.id))) add(b, 'Guerra (comercio perturbado)', -6);
  if (k.laws.impuestos === 2) add(b, 'Impuestos altos', -6); if (k.laws.impuestos === 0) add(b, 'Impuestos bajos', 4);
  return b;
}
export function popCapacity(w: World, g: GameState, pid: number) { const s = w.provinces[pid], p = g.provinces[pid]; return s.area * (0.3 + s.fertility) * 260 * (1 + 0.15 * (p.buildings.granja || 0) + (p.buildings.riego ? 0.2 : 0)); }

// Construcción
export function buildCheck(w: World, g: GameState, kid: number, pid: number, id: string): { ok: boolean; why: string[]; level: number; def: BuildingDef } {
  const def = BLD[id]; const p = g.provinces[pid], s = w.provinces[pid], k = g.kingdoms[kid]; const why: string[] = [];
  const lvl = (p.buildings[id] || 0) + p.queue.filter(q => q.b === id).length + 1;
  if (p.owner !== kid) why.push('La provincia no es tuya');
  if (p.occupier >= 0) why.push('Provincia ocupada');
  if (lvl > def.max) why.push('Nivel máximo alcanzado');
  if (def.tech && !k.techs.includes(def.tech)) why.push('Requiere tecnología: ' + techName(def.tech));
  if (def.techLv2 && lvl >= 2 && !k.techs.includes(def.techLv2)) why.push('Nivel 2+ requiere: ' + techName(def.techLv2));
  if (def.cond === 'rio' && !s.river) why.push('Requiere un río');
  if (def.cond === 'costa' && !s.coastal) why.push('Requiere costa');
  if (def.cond === 'bosque' && (s.mix.bosque || 0) + (s.mix.taiga || 0) + (s.mix.selva || 0) < 0.12) why.push('Requiere bosque (≥12%)');
  if (def.cond === 'roca' && (s.mix.montana || 0) + (s.mix.colinas || 0) + (s.mix.nieve || 0) < 0.08) why.push('Requiere colinas o montañas');
  if (def.cond === 'yacimiento' && !s.deposits.some((d, i) => (!d.hidden || p.revealedDeposits.includes(i)) && ['hierro', 'cobre', 'oro', 'plata', 'gemas'].includes(d.kind))) why.push('Requiere un yacimiento minero conocido');
  if (id === 'castillo' && !p.buildings.murallas) why.push('Requiere murallas');
  if (id === 'universidad' && !p.buildings.biblioteca) why.push('Requiere biblioteca');
  if (p.queue.length >= 3) why.push('Máximo 3 obras simultáneas por provincia');
  const cost = buildCost(g, kid, pid, id);
  for (const r in cost) if (k.stock[r as ResId] < cost[r as ResId]!) why.push(`Falta ${RES[r as ResId].name.toLowerCase()} (${Math.floor(k.stock[r as ResId])}/${cost[r as ResId]})`);
  return { ok: why.length === 0, why, level: lvl, def };
}
export function buildCost(g: GameState, kid: number, pid: number, id: string): Partial<Record<ResId, number>> {
  const def = BLD[id]; const p = g.provinces[pid]; const lvl = (p.buildings[id] || 0) + p.queue.filter(q => q.b === id).length + 1; const m = 1 + (lvl - 1) * 0.6;
  const o: Partial<Record<ResId, number>> = {}; for (const r in def.cost) o[r as ResId] = Math.round(def.cost[r as ResId]! * m); return o;
}
export function buildMonths(g: GameState, pid: number, id: string) {
  const p = g.provinces[pid]; const strong = (p.species.gigante || 0) * 6 + (p.species.minotauro || 0) * 1.2;
  return Math.max(1, Math.round(BLD[id].months * (1 - Math.min(0.35, strong))));
}
export function startBuild(w: World, g: GameState, kid: number, pid: number, id: string): boolean {
  const c = buildCheck(w, g, kid, pid, id); if (!c.ok) return false; const k = g.kingdoms[kid];
  const cost = buildCost(g, kid, pid, id); for (const r in cost) k.stock[r as ResId] -= cost[r as ResId]!;
  const m = buildMonths(g, pid, id); g.provinces[pid].queue.push({ b: id, monthsLeft: m, total: m }); return true;
}
export function cancelBuild(g: GameState, kid: number, pid: number, qi: number) {
  const p = g.provinces[pid]; const q = p.queue[qi]; if (!q) return; const k = g.kingdoms[kid];
  p.queue.splice(qi, 1); const def = BLD[q.b]; for (const r in def.cost) k.stock[r as ResId] += Math.round(def.cost[r as ResId]! * 0.5);
}
export function techName(id: string) { return TECH[id]?.name || id; }

// Mercado internacional (precios dinámicos)
export function marketPrice(w: World, g: GameState, kid: number, r: ResId, buy: boolean): number {
  const k = g.kingdoms[kid]; let base = RES[r].base;
  let wars = 0; for (const key in g.relations) { const x = g.relations[key]; if (x.war && (x.a === kid || x.b === kid)) wars++; }
  let trades = 0; for (const key in g.relations) { const x = g.relations[key]; if (x.trade && (x.a === kid || x.b === kid)) trades++; }
  // escasez mundial aproximada: existencias medias de los reinos
  let tot = 0, n = 0; for (const o of g.kingdoms) if (o.alive && !o.independent) { tot += o.stock[r]; n++; }
  const avg = n ? tot / n : 100; const scarcity = Math.max(0.7, Math.min(1.8, 150 / Math.max(40, avg)));
  const m = scarcity * (1 + wars * 0.08) * (1 - Math.min(0.2, trades * 0.04)) * (k.techs.includes('comercio') ? 0.95 : 1);
  return Math.max(0.2, +(base * m * (buy ? 1.25 : 0.75)).toFixed(2));
}
export function trade(w: World, g: GameState, kid: number, r: ResId, qty: number): boolean {
  const k = g.kingdoms[kid];
  if (qty > 0) { const cost = qty * marketPrice(w, g, kid, r, true); if (k.stock.oro < cost) return false; k.stock.oro -= cost; k.stock[r] += qty; }
  else { const q = -qty; if (k.stock[r] < q) return false; k.stock[r] -= q; k.stock.oro += q * marketPrice(w, g, kid, r, false); }
  return true;
}

// Proceso mensual de economía y sociedad (pasos 2-5 del motor de turnos)
export function processEconomy(w: World, g: GameState, kid: number, rnd: () => number) {
  const k = g.kingdoms[kid]; if (!k.alive) return;
  const e = kingdomEconomy(w, g, kid);
  for (const r of Object.keys(RES) as ResId[]) { k.stock[r] += e.net[r]; }
  // automatización comercial
  for (const r of TRADEABLE) { const mn = k.market.min[r], mx = k.market.max[r]; if (mn !== undefined && k.stock[r] < mn) { const q = Math.ceil(mn - k.stock[r]); const c = q * marketPrice(w, g, kid, r, true); if (k.stock.oro - c > 50) trade(w, g, kid, r, q); } if (mx !== undefined && k.stock[r] > mx) trade(w, g, kid, r, -Math.floor(k.stock[r] - mx)); }
  // límites de almacenamiento
  for (const r of Object.keys(e.cap) as ResId[]) if (k.stock[r] > e.cap[r]) { if (r === 'alimentos' && kid === g.playerId && k.stock[r] - e.cap[r] > 20) alert(g, 'info', `Los graneros están llenos: se han perdido ${Math.round(k.stock[r] - e.cap[r])} de alimentos. Construye granjas o vende excedentes.`); k.stock[r] = e.cap[r]; }
  for (const r of ['madera', 'piedra', 'hierro', 'herramientas', 'armas'] as ResId[]) if (k.stock[r] < 0) k.stock[r] = 0;
  if (k.stock.oro < 0) { k.legitimacy -= 1; if (kid === g.playerId) alert(g, 'critica', 'El tesoro está en números rojos: la corte pierde legitimidad y los soldados se impacientan.'); for (const a of g.armies) if (a.owner === kid) a.morale = Math.max(0, a.morale - 5); }
  // población, estabilidad, prosperidad
  const famine = k.stock.alimentos < 0;
  if (famine) { k.stock.alimentos = 0; }
  for (const p of g.provinces) {
    if (p.owner !== kid) continue;
    const st = sum(stabilityFactors(w, g, p.id)); p.stability += (Math.max(0, Math.min(100, st)) - p.stability) * 0.25;
    const pt = sum(prosperityTarget(w, g, p.id)); p.prosperity += (Math.max(0, Math.min(100, pt)) - p.prosperity) * 0.08;
    const cap = popCapacity(w, g, p.id);
    const fert = SPECIES_IDS.reduce((s, sp) => s + (p.species[sp] || 0) * SPECIES[sp].fertilidad, 0);
    let rate = 0.0016 * fert * Math.max(0, 1 - p.pop / cap) * (p.stability > 30 ? 1 : 0.5);
    if (famine || k.stock.alimentos <= 0) rate = -0.012;
    if (p.plague > 0) { rate -= 0.01; p.plague--; }
    p.pop = Math.max(200, p.pop * (1 + rate));
    // deriva demográfica: especies más fértiles crecen algo más
    let tot = 0; for (const sp of SPECIES_IDS) { p.species[sp] *= 1 + (SPECIES[sp].fertilidad - fert) * 0.0008; tot += p.species[sp]; } for (const sp of SPECIES_IDS) p.species[sp] /= tot;
    if (p.control < 100) p.control = Math.min(100, p.control + 2.5 + (p.buildings.camino ? 1.5 : 0));
    if (p.unrest > 0) p.unrest = Math.max(0, p.unrest - 0.5);
    // construcción
    for (let i = p.queue.length - 1; i >= 0; i--) { const q = p.queue[i]; if (p.occupier >= 0) continue; q.monthsLeft--; if (q.monthsLeft <= 0) { p.buildings[q.b] = (p.buildings[q.b] || 0) + 1; p.queue.splice(i, 1); const d = BLD[q.b]; if (kid === g.playerId) { alert(g, 'completado', `${d.name}${p.buildings[q.b] > 1 ? ' (nivel ' + p.buildings[q.b] + ')' : ''} terminado en ${p.cityName}.`, { prov: p.id }); chron(g, kid, 'construccion', `Se completa ${d.name.toLowerCase()} en ${p.cityName}.`, ['castillo', 'universidad', 'murallas', 'puerto'].includes(q.b)); } if (q.b === 'mina') revealOnMine(w, g, p.id, rnd); } }
  }
  if (famine && kid === g.playerId) alert(g, 'critica', 'Hambruna: las reservas de alimentos se han agotado. La población disminuye y la estabilidad se desploma.');
  // investigación
  if (k.research.current) {
    k.research.progress += Math.max(0, k.stock.investigacion); k.stock.investigacion = 0;
    const cost = techCost(k, k.research.current);
    if (k.research.progress >= cost) { const t = k.research.current; k.techs.push(t); k.research.progress -= cost; k.research.current = null; if (kid === g.playerId) { alert(g, 'completado', `Investigación completada: ${techName(t)}.`); chron(g, kid, 'tecnologia', `Los eruditos del reino dominan: ${techName(t)}.`, true); } }
  } else k.stock.investigacion = Math.min(k.stock.investigacion, 500);
  // previsión de escasez
  if (kid === g.playerId) { const fNet = e.net.alimentos; if (fNet < 0 && k.stock.alimentos > 0) { const months = k.stock.alimentos / -fNet; if (months < 6) alert(g, months < 3 ? 'critica' : 'importante', `Alimentos: balance ${fNet.toFixed(1)}/mes. Autonomía estimada ${months.toFixed(1)} meses.`); } }
}
export function techCost(k: Kingdom, t: string) { const T = TECH[t]; const base = T ? T.cost : 100; return Math.round(base * (1 + Math.max(0, k.techs.length - 4) * 0.04)); }
function revealOnMine(w: World, g: GameState, pid: number, rnd: () => number) {
  const p = g.provinces[pid], s = w.provinces[pid];
  s.deposits.forEach((d, i) => { if (d.hidden && !p.revealedDeposits.includes(i) && rnd() < 0.7) { p.revealedDeposits.push(i); if (p.owner === g.playerId) { alert(g, 'importante', `¡Los mineros de ${p.cityName} descubren un yacimiento de ${DEPOSITS[d.kind].name.toLowerCase()}!`, { prov: pid }); chron(g, p.owner, 'descubrimiento', `Descubrimiento de un yacimiento de ${DEPOSITS[d.kind].name.toLowerCase()} en ${s.name}.`, true); } } });
}
export function recruitPool(w: World, g: GameState, pid: number, species: SpeciesId | null): number {
  const p = g.provinces[pid]; const k = g.kingdoms[p.owner]; if (!k) return 0; const pct = [0.04, 0.08, 0.15][k.laws.reclutamiento];
  const total = p.pop * pct - p.mobilized * (species ? (p.species[species] || 0) : 1);
  const share = species ? (p.species[species] || 0) : 1; const pool = species ? p.pop * pct * share - p.mobilized * share : total;
  return Math.max(0, Math.floor(species === 'gigante' ? pool * 0.3 : pool));
}
export { dateOf };
