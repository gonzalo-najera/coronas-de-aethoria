// Creación de partida y utilidades comunes del estado.
import { RNG, hashNums } from './rng';
import type { GameState, Kingdom, ProvState, Character, SpeciesId, Relation, Army, ResId, Biome } from './types';
import { KINGDOMS, SPECIES_IDS, SPECIES, MONTHS, SEASONS, UNIT, KingdomTemplate } from './data';
import { generateWorld, World } from './world';
import { personName, cityName } from './names';

export const SAVE_VERSION = 1;
export const START_YEAR = 312;

export function rngOf(g: GameState): RNG { const r = new RNG(0); r.s = g.rng; return r; }
export function saveRng(g: GameState, r: RNG) { g.rng = r.s; }
export function dateOf(turn: number) { const m = (turn + 2) % 12; const y = START_YEAR + Math.floor((turn + 2) / 12); return { m, y, month: MONTHS[m], season: SEASONS[m] }; }
export function dateStr(turn: number) { const d = dateOf(turn); return `${d.month}, año ${d.y}`; }
export function seasonFor(turn: number, hemisphere: 'N' | 'S') { const d = dateOf(turn); return SEASONS[hemisphere === 'S' ? (d.m + 6) % 12 : d.m]; }
export function relKey(a: number, b: number) { return a < b ? `${a}-${b}` : `${b}-${a}`; }
export function rel(g: GameState, a: number, b: number): Relation { return g.relations[relKey(a, b)]; }
export function atWar(g: GameState, a: number, b: number) { if (a === b || a < 0 || b < 0) return false; const r = rel(g, a, b); return !!r && r.war; }
export function allied(g: GameState, a: number, b: number) { if (a === b) return true; const r = rel(g, a, b); return !!r && r.alliance; }
export function nid(g: GameState) { return g.nextId++; }
export function kprovs(g: GameState, k: number) { return g.provinces.filter(p => p.owner === k); }
export function totalPop(g: GameState, k: number) { let s = 0; for (const p of g.provinces) if (p.owner === k) s += p.pop; return s; }
export function chron(g: GameState, kingdom: number, kind: string, text: string, important = false) { g.chronicle.push({ turn: g.turn, kingdom, kind, text, important }); }
export function alert(g: GameState, level: GameState['alerts'][0]['level'], text: string, focus?: any) { g.alerts.unshift({ id: nid(g), turn: g.turn, level, text, read: false, focus }); if (g.alerts.length > 120) g.alerts.length = 120; }
export function armyMen(a: Army) { return a.units.reduce((s, u) => s + u.men, 0); }
export function playerK(g: GameState) { return g.kingdoms[g.playerId]; }

export function makeCharacter(g: GameState | null, r: RNG, sp: SpeciesId, age: number, bias: Partial<Record<'diplomacia' | 'administracion' | 'liderazgo' | 'estrategia' | 'inteligencia' | 'carisma', number>> = {}): Character {
  const S = SPECIES[sp];
  const st = (base: number, b = 0) => Math.max(1, Math.min(10, Math.round(base + r.range(-2.5, 2.5) + b)));
  const traits = ['Prudente', 'Ambicioso', 'Justo', 'Astuto', 'Valiente', 'Erudito', 'Generoso', 'Desconfiado', 'Piadoso', 'Impulsivo', 'Paciente', 'Carismático'];
  return {
    id: g ? nid(g) : Math.floor(r.next() * 1e9), name: personName(r, sp), species: sp, age, health: r.int(60, 95),
    diplomacia: st(5, bias.diplomacia), administracion: st(5 + (sp === 'humano' ? 0.5 : 0), bias.administracion), liderazgo: st(5 + (S.militar - 1) * 2, bias.liderazgo),
    estrategia: st(5, bias.estrategia), inteligencia: st(5 + (S.academica - 1) * 3, bias.inteligencia), carisma: st(5, bias.carisma),
    trait: r.pick(traits), seed: Math.floor(r.next() * 1e9), loyalty: r.int(40, 90), ambition: r.int(10, 90), exp: r.int(0, 5),
  };
}
export function pickSpecies(r: RNG, mix: Record<SpeciesId, number>, giantDamp = true): SpeciesId {
  return r.weighted(SPECIES_IDS, s => (mix[s] || 0) * (giantDamp && s === 'gigante' ? 0.4 : 1));
}
export function makeCouncil(g: GameState, r: RNG, mix: Record<SpeciesId, number>) {
  return {
    canciller: makeCharacter(g, r, pickSpecies(r, mix), r.int(30, 60), { diplomacia: 2 }),
    mariscal: makeCharacter(g, r, pickSpecies(r, mix), r.int(30, 55), { liderazgo: 2, estrategia: 2 }),
    tesorero: makeCharacter(g, r, pickSpecies(r, mix), r.int(30, 65), { administracion: 2 }),
    explorador: makeCharacter(g, r, pickSpecies(r, mix), r.int(25, 50), { inteligencia: 1 }),
  };
}

function normMix(m: Partial<Record<SpeciesId, number>>): Record<SpeciesId, number> {
  const o = {} as Record<SpeciesId, number>; let t = 0; for (const s of SPECIES_IDS) { o[s] = Math.max(0, m[s] || 0); t += o[s]; }
  for (const s of SPECIES_IDS) o[s] = t ? o[s] / t : 1 / SPECIES_IDS.length; return o;
}
function localMix(b: Biome): Partial<Record<SpeciesId, number>> {
  switch (b) {
    case 'bosque': case 'selva': return { fauno: 40, elfo: 14, humano: 34, centauro: 4, minotauro: 6, gigante: 1 };
    case 'taiga': case 'tundra': case 'nieve': return { humano: 45, gigante: 12, enano: 20, fauno: 13, minotauro: 10 };
    case 'montana': case 'colinas': return { enano: 32, minotauro: 26, gigante: 6, humano: 34, fauno: 2 };
    case 'estepa': case 'pradera': case 'llanura': return { centauro: 30, humano: 52, minotauro: 10, fauno: 8 };
    case 'desierto': return { humano: 50, centauro: 30, minotauro: 20 };
    default: return { humano: 60, fauno: 20, minotauro: 10, centauro: 10 };
  }
}
function affinity(t: KingdomTemplate, w: World, p: number): number {
  const s = w.provinces[p]; const m = s.mix;
  switch (t.type) {
    case 'agricola': return s.fertility * 1.5;
    case 'montanoso': return (m.montana || 0) * 2 + (m.colinas || 0) * 1.5 + (m.nieve || 0) + 0.3;
    case 'maritimo': return (s.coastal ? 1.5 : 0) + s.fertility * 0.3;
    case 'forestal': return (m.bosque || 0) * 2 + (m.selva || 0) * 2 + (m.taiga || 0) * 1.5 + 0.2;
    case 'llanuras': return (m.estepa || 0) * 1.6 + (m.pradera || 0) * 1.3 + (m.llanura || 0) * 1.3;
    case 'desertico': return (m.desierto || 0) * 1.2 + (m.estepa || 0) + (s.coastal ? 0.5 : 0) + (s.river ? 0.8 : 0);
    default: return 1;
  }
}

export interface NewGameOpts { seed: number; player: number; rulerName?: string; rulerSpecies?: SpeciesId; kingdomName?: string; color?: string; difficulty: number; gameName?: string }

export function newGame(opts: NewGameOpts): { w: World; g: GameState } {
  const w = generateWorld(opts.seed);
  const r = new RNG(hashNums(opts.seed, 4242));
  const nP = w.provinces.length, nS = w.seas.length;
  const g: GameState = {
    version: SAVE_VERSION, seed: opts.seed, worldHash: w.hash, rng: 0, turn: 0, startYear: START_YEAR, playerId: opts.player, difficulty: opts.difficulty, gameName: opts.gameName || 'Partida',
    kingdoms: [], provinces: [], armies: [], expeditions: [], relations: {}, chronicle: [], alerts: [], events: [], pendingBattles: [], battleReports: [], expReports: [],
    nextId: 1, history: [], stats: { battlesWon: 0, battlesLost: 0, maxArmy: 0, founded: 0, discovered: 0, rulers: [] }, autoPause: true,
  };
  const usedCity = new Set<string>();
  for (const s of w.provinces) {
    const mix = normMix(localMix(s.biome)); const jitter = new RNG(hashNums(opts.seed, s.id, 5));
    for (const k of SPECIES_IDS) mix[k] *= 0.7 + jitter.next() * 0.6;
    g.provinces.push({ id: s.id, owner: -1, occupier: -1, pop: Math.round(s.area * (0.2 + s.fertility) * 55), species: normMix(mix), buildings: {}, queue: [], stability: 50, prosperity: 30, control: 100, cityName: cityName(r, usedCity), unrest: 0, siege: null, mobilized: 0, conqueredTurn: -999, colonizing: null, revealedDeposits: [], lowStabMonths: 0, plague: 0 });
  }
  // Reinos
  KINGDOMS.forEach((t, ki) => {
    const cands = w.provinces.filter(p => p.continent === t.continent && g.provinces[p.id].owner < 0);
    if (!cands.length) return;
    let start = cands[0]; let bd = 1e9; for (const p of cands) { const d = Math.hypot(p.cx - t.anchor[0], p.cy - t.anchor[1]); if (d < bd) { bd = d; start = p; } }
    const claimed = [start.id]; g.provinces[start.id].owner = ki;
    while (claimed.length < t.size) {
      let best = -1, bv = -1e9;
      for (const c of claimed) for (const n of w.provinces[c].neighbors) { if (g.provinces[n].owner >= 0 || w.provinces[n].continent !== t.continent) continue; const s = w.provinces[n]; const v = affinity(t, w, n) - Math.hypot(s.cx - t.anchor[0], s.cy - t.anchor[1]) * 0.05 + r.next() * 0.4; if (v > bv) { bv = v; best = n; } }
      if (best < 0) break; claimed.push(best); g.provinces[best].owner = ki;
    }
    const mix = normMix(t.species);
    const isPlayer = ki === opts.player;
    const rulerSp: SpeciesId = isPlayer && opts.rulerSpecies ? opts.rulerSpecies : pickSpecies(r, mix);
    const ruler = makeCharacter(g, r, rulerSp, r.int(28, 52), { administracion: 1 });
    if (isPlayer && opts.rulerName) ruler.name = opts.rulerName;
    const heir = makeCharacter(g, r, rulerSp, r.int(2, 16));
    heir.name = heir.name.split(' ')[0] + ' ' + ruler.name.split(' ').slice(1).join(' ');
    const k: Kingdom = {
      id: ki, name: isPlayer && opts.kingdomName ? opts.kingdomName : t.name, short: isPlayer && opts.kingdomName ? opts.kingdomName.replace(/^(Reino|Corona|Liga|Fronda|Confederación|Imperio|Principado) de /, '') : t.short,
      color: isPlayer && opts.color ? opts.color : t.color, color2: t.color2, type: t.type, independent: !!t.independent, personality: t.personality, capital: start.id, ruler, heir: t.independent ? null : heir, regency: false,
      council: {}, stock: { oro: 350, alimentos: 250, madera: 140, piedra: 120, hierro: 40, herramientas: 30, armas: 70, investigacion: 0, prestigio: 10 },
      legitimacy: 70, research: { current: null, progress: 0 }, techs: ['escritura', 'forja', ...t.techs], laws: { impuestos: 1, reclutamiento: 1, integracion: 1 },
      known: new Array(nP).fill(0), seaKnown: new Array(nS).fill(0), lastOwner: new Array(nP).fill(-2), lastSeen: new Array(nP).fill(-1),
      alive: true, warExhaustion: 0, heraldry: { shape: ki % 4, charge: (ki * 7) % 9 }, market: { min: {}, max: {} }, aiTimer: r.int(0, 5), dynasty: t.dynasty,
    };
    if (t.type === 'montanoso') { k.stock.piedra += 150; k.stock.hierro += 60; k.stock.alimentos -= 80; }
    if (t.type === 'agricola') { k.stock.alimentos += 200; k.stock.hierro -= 20; }
    if (t.type === 'maritimo') { k.stock.oro += 200; }
    if (t.type === 'forestal') { k.stock.madera += 150; }
    if (t.independent) { k.stock = { oro: 120, alimentos: 120, madera: 60, piedra: 60, hierro: 10, herramientas: 10, armas: 20, investigacion: 0, prestigio: 0 }; }
    k.council = makeCouncil(g, r, mix);
    g.kingdoms.push(k);
    for (const pid of claimed) {
      const ps = g.provinces[pid], s = w.provinces[pid];
      const loc = normMix(localMix(s.biome)); const m = {} as Record<SpeciesId, number>;
      for (const sp of SPECIES_IDS) m[sp] = mix[sp] * 0.72 + loc[sp] * 0.28;
      ps.species = normMix(m);
      const cap = pid === start.id;
      ps.pop = Math.round(s.area * (0.25 + s.fertility) * 150 * (cap ? 1.7 : 1) * (t.type === 'agricola' ? 1.15 : 1) * (t.independent ? 0.7 : 1));
      ps.stability = 55 + r.int(0, 15); ps.prosperity = 45 + r.int(0, 15) + (cap ? 10 : 0);
      const b = ps.buildings; b.granja = cap ? 2 : 1;
      if (cap) { b.mercado = 1; b.murallas = t.independent ? 1 : 2; b.cuartel = 1; b.camino = 1; if (t.type === 'montanoso' || t.personality === 'militarista') b.castillo = 1; }
      if (!t.independent && r.chance(0.45)) b.camino = 1;
      if (s.coastal && (t.type === 'maritimo' || cap || r.chance(0.3))) b.puerto = 1;
      if ((s.mix.bosque || 0) + (s.mix.taiga || 0) + (s.mix.selva || 0) > 0.2 && (t.type === 'forestal' || r.chance(0.4))) b.aserradero = 1;
      if ((s.mix.montana || 0) + (s.mix.colinas || 0) > 0.15 && (t.type === 'montanoso' || r.chance(0.35))) b.cantera = 1;
      if (s.deposits.some(d => !d.hidden && (d.kind === 'hierro' || d.kind === 'cobre' || d.kind === 'oro' || d.kind === 'plata')) && (t.type === 'montanoso' || r.chance(0.4))) b.mina = 1;
      if (cap && t.type === 'montanoso') b.herreria = 1;
      if (cap && k.techs.includes('bibliotecas')) b.biblioteca = 1;
    }
  });
  // Ejércitos iniciales
  for (const k of g.kingdoms) {
    const cap = g.provinces[k.capital]; const units: Army['units'] = [];
    const add = (type: string, men: number) => { const u = UNIT[type]; if (u.species && (cap.species[u.species] || 0) < 0.03) return; if (u.tech && !k.techs.includes(u.tech)) return; units.push({ type, men, exp: 0.1 }); };
    if (k.independent) { add('milicia', 900); if (cap.species.minotauro > 0.3) add('minotauros', 300); if (cap.species.centauro > 0.3) add('exploradores', 0); }
    else {
      add('milicia', 1600); add('lanceros', 1200); add('arqueros', 700);
      if (k.type === 'montanoso') add('enanos', 800); if (k.type === 'llanuras') add('centauros', 900);
      if (k.type === 'forestal') { add('exploradores', 500); add('arq_elficos', 400); }
      if (k.type === 'agricola') add('milicia', 1500); if (k.personality === 'militarista') { add('minotauros', 500); add('piqueros', 800); }
      if (k.type === 'maritimo') add('lanceros', 600); if (k.type === 'desertico') add('minotauros', 400);
    }
    const merged: Army['units'] = []; for (const u of units) { if (u.men <= 0) continue; const m = merged.find(x => x.type === u.type); if (m) m.men += u.men; else merged.push(u); }
    const men = merged.reduce((s, u) => s + u.men, 0); { const own = g.provinces.filter(q => q.owner === k.id); const tp = own.reduce((s, q) => s + q.pop, 0) || 1; let left = men; own.forEach((q, i) => { const m = i === own.length - 1 ? left : Math.round(men * q.pop / tp); q.pop -= m; q.mobilized += m; left -= m; }); }
    const gr = new RNG(hashNums(opts.seed, k.id, 77));
    g.armies.push({ id: nid(g), owner: k.id, name: k.independent ? 'Hueste de ' + k.short : 'Ejército Real de ' + k.short, prov: k.capital, units: merged, wounded: {}, path: [], progress: 0, supply: 3, morale: 75, general: k.independent ? null : makeCharacter(g, gr, k.council.mariscal.species, gr.int(30, 50), { estrategia: 1, liderazgo: 1 }), lastBattle: -99, retreating: false, sieging: false });
  }
  // Relaciones
  for (let a = 0; a < g.kingdoms.length; a++) for (let b = a + 1; b < g.kingdoms.length; b++) {
    const ka = g.kingdoms[a], kb = g.kingdoms[b];
    let op = r.int(-15, 25); if (ka.personality === kb.personality) op += 8; if (ka.type === kb.type) op += 5;
    g.relations[relKey(a, b)] = { a, b, contact: false, opinion: op, trust: 40 + r.int(0, 20), tension: 10, alliance: false, nap: false, trade: false, mapsShared: false, war: false, warStart: -1, warScore: 0, giftBonus: 0, lastProposal: -99, protectorate: -1 };
  }
  // Historia previa: tratados y rivalidades
  const R = (a: string, b: string) => { const ia = KINGDOMS.findIndex(k => k.short === a), ib = KINGDOMS.findIndex(k => k.short === b); return rel(g, ia, ib); };
  R('Aurelanda', 'Marisal').trade = true; R('Aurelanda', 'Marisal').opinion += 25; R('Aurelanda', 'Ilvaren').nap = true; R('Aurelanda', 'Ilvaren').opinion += 15;
  R('Aurelanda', 'Llanoalto').opinion -= 35; R('Durnhal', 'Llanoalto').opinion -= 25; R('Marisal', 'Puertoalba').trade = true;
  R('Ostrevia', 'Velmora').opinion -= 30; R('Ostrevia', 'Skarnheim').opinion -= 20; R('Qasmara', 'Tamarú').trade = true; R('Velmora', 'Ilvaren').opinion += 30;
  R('Durnhal', 'Rocagrís').opinion += 20; R('Llanoalto', 'Cardonegro').opinion -= 30; R('Qasmara', 'Erg Rojo').opinion -= 25;
  g.rng = r.s;
  // Conocimiento inicial
  for (const k of g.kingdoms) initKnowledge(w, g, k);
  updateVisibility(w, g);
  updateContacts(w, g);
  const pk = g.kingdoms[opts.player];
  chron(g, -1, 'historia', `Comienza la era de las Coronas. ${g.kingdoms.filter(k => !k.independent).length} reinos establecidos se reparten las tierras conocidas de Aethoria.`, true);
  chron(g, pk.id, 'monarca', `${pk.ruler.name} (${SPECIES[pk.ruler.species].name.toLowerCase()}, ${pk.ruler.age} años) gobierna ${pk.name} desde ${g.provinces[pk.capital].cityName}.`, true);
  g.stats.rulers.push(pk.ruler.name);
  for (const k of g.kingdoms) k.research.current = null;
  return { w, g };
}

export function initKnowledge(w: World, g: GameState, k: Kingdom) {
  const nP = w.provinces.length; const depth = new Array(nP).fill(99); const q: number[] = [];
  for (const p of g.provinces) if (p.owner === k.id) { depth[p.id] = 0; q.push(p.id); }
  while (q.length) { const c = q.shift()!; if (depth[c] >= 5) continue; for (const n of w.provinces[c].neighbors) if (depth[n] > depth[c] + 1) { depth[n] = depth[c] + 1; q.push(n); } }
  const lim = k.independent ? 2 : 3;
  for (let p = 0; p < nP; p++) { if (depth[p] <= lim) { k.known[p] = 2; k.lastOwner[p] = g.provinces[p].owner; k.lastSeen[p] = 0; } else if (depth[p] <= lim + 2) k.known[p] = Math.max(k.known[p], 1); }
  for (const s of w.seas) { if (s.provinces.some(p => k.known[p] === 2 && g.provinces[p].owner === k.id)) k.seaKnown[s.id] = 2; else if (s.provinces.some(p => k.known[p] === 2)) k.seaKnown[s.id] = Math.max(k.seaKnown[s.id], 1); }
}

// Visibilidad actual (nivel 3) calculada a partir del estado real: territorio propio y vecino, aliados, ejércitos, atalayas, expediciones.
const visCache = new Map<number, Uint8Array>();
export function visibleSet(w: World, g: GameState, k: number): Uint8Array {
  const v = new Uint8Array(w.provinces.length);
  const mark = (p: number, rad: number) => { v[p] = 1; if (rad <= 0) return; for (const n of w.provinces[p].neighbors) mark(n, rad - 1); };
  for (const p of g.provinces) {
    if (p.owner === k || (p.owner >= 0 && allied(g, k, p.owner)) || p.occupier === k) mark(p.id, (p.buildings.torre && p.owner === k) ? 2 : 1);
  }
  for (const a of g.armies) if (a.owner === k || allied(g, k, a.owner)) mark(a.prov, 1);
  for (const e of g.expeditions) if (e.owner === k && (e.state === 'activa' || e.state === 'regreso') && e.loc.t === 'p') mark(e.loc.id, 1);
  return v;
}
export function updateVisibility(w: World, g: GameState) {
  visCache.clear();
  for (const k of g.kingdoms) {
    if (!k.alive) continue; const v = visibleSet(w, g, k.id); visCache.set(k.id, v);
    for (let p = 0; p < v.length; p++) if (v[p]) { if (k.known[p] < 2 && k.id === g.playerId && g.turn > 0) g.stats.discovered++; k.known[p] = 2; k.lastOwner[p] = g.provinces[p].owner; k.lastSeen[p] = g.turn; for (const s of w.provinces[p].seas) if (k.seaKnown[s] < 1) k.seaKnown[s] = 1; }
  }
}
export function isVisible(w: World, g: GameState, k: number, p: number): boolean { let v = visCache.get(k); if (!v) { v = visibleSet(w, g, k); visCache.set(k, v); } return v[p] === 1; }
export function knowLevel(w: World, g: GameState, k: number, p: number): number { if (g.provinces[p].owner === k) return 4; if (isVisible(w, g, k, p)) return 3; return g.kingdoms[k].known[p]; }
export function invalidateVis() { visCache.clear(); }

export function updateContacts(w: World, g: GameState) {
  for (const key in g.relations) {
    const r = g.relations[key]; if (r.contact) continue;
    const ka = g.kingdoms[r.a], kb = g.kingdoms[r.b];
    let c = false;
    for (const p of g.provinces) { if (p.owner === r.b && ka.known[p.id] >= 2) { c = true; break; } if (p.owner === r.a && kb.known[p.id] >= 2) { c = true; break; } }
    if (c) { r.contact = true; if (r.a === g.playerId || r.b === g.playerId) { const o = r.a === g.playerId ? kb : ka; if (g.turn > 0) { alert(g, 'importante', `Primer contacto con ${o.name}.`); chron(g, g.playerId, 'contacto', `Primer contacto diplomático con ${o.name}.`, true); } } }
  }
}
export function getW(): World { return (globalThis as any).__aethoriaWorld; }
export function setW(w: World) { (globalThis as any).__aethoriaWorld = w; }
