// Battle Engine: simulación táctica 2D por fases. La representación gráfica dibuja exactamente estos estados.
import { RNG, hashNums } from './rng';
import type { GameState, Army, Character, Biome } from './types';
import { UNIT, UnitDef } from './data';
import type { World } from './world';

export const BW = 30, BH = 20, TICKS = 10;
// 0 llano, 1 bosque, 2 colina, 3 río, 4 vado/puente, 5 camino, 6 roca (infranqueable), 7 pantano, 8 nieve
export const TILE = [
  { n: 'Llano', mv: 1, def: 1, atk: 1, los: 0 }, { n: 'Bosque', mv: 0.6, def: 1.2, atk: 0.9, los: 1 }, { n: 'Colina', mv: 0.75, def: 1.25, atk: 1.1, los: 0 },
  { n: 'Río', mv: 0, def: 1, atk: 1, los: 0 }, { n: 'Vado/puente', mv: 0.7, def: 0.85, atk: 0.75, los: 0 }, { n: 'Camino', mv: 1.15, def: 1, atk: 1, los: 0 },
  { n: 'Roca', mv: 0, def: 1, atk: 1, los: 1 }, { n: 'Pantano', mv: 0.5, def: 0.9, atk: 0.85, los: 0 }, { n: 'Nieve', mv: 0.75, def: 1, atk: 0.95, los: 0 },
];
export type Sector = 'vanguardia' | 'izquierda' | 'centro' | 'derecha' | 'retaguardia' | 'reserva';
export const SECTORS: Sector[] = ['vanguardia', 'izquierda', 'centro', 'derecha', 'retaguardia', 'reserva'];
export const SECTOR_NAMES: Record<Sector, string> = { vanguardia: 'Vanguardia', izquierda: 'Flanco izquierdo', centro: 'Centro', derecha: 'Flanco derecho', retaguardia: 'Retaguardia', reserva: 'Reserva' };
export type Order = 'mantener' | 'avanzar' | 'atacar' | 'cargar' | 'hostigar' | 'disparar' | 'flanquear' | 'replegarse' | 'retirarse' | 'perseguir' | 'reforzar';
export const ORDER_NAMES: Record<Order, string> = { mantener: 'Mantener posición', avanzar: 'Avanzar', atacar: 'Ataque frontal', cargar: 'Cargar', hostigar: 'Hostigar', disparar: 'Disparar', flanquear: 'Flanquear', replegarse: 'Replegarse', retirarse: 'Retirarse', perseguir: 'Perseguir', reforzar: 'Reforzar / incorporar' };
export type Intensity = 'prudente' | 'equilibrada' | 'agresiva' | 'desesperada';
export const INT: Record<Intensity, { dealt: number; taken: number; fat: number; spd: number; mor: number; coh: number }> = {
  prudente: { dealt: 0.72, taken: 0.72, fat: 0.7, spd: 0.8, mor: 0.8, coh: 0.6 },
  equilibrada: { dealt: 1, taken: 1, fat: 1, spd: 1, mor: 1, coh: 1 },
  agresiva: { dealt: 1.38, taken: 1.28, fat: 1.6, spd: 1.12, mor: 1.1, coh: 1.4 },
  desesperada: { dealt: 1.85, taken: 1.65, fat: 2.3, spd: 1.2, mor: 0.5, coh: 2 },
};
export type Status = 'formado' | 'combatiendo' | 'desorganizado' | 'huida' | 'retirado' | 'destruido';
export interface BGroup {
  id: number; side: 0 | 1; type: string; sector: Sector; men: number; startMen: number; x: number; y: number; w: number;
  order: Order; intensity: Intensity; target: number | null; morale: number; cohesion: number; fatigue: number; exp: number; status: Status;
  killed: number; wounded: number; captured: number; deserted: number; dispersed: number; charged: boolean; contactTicks: number; lastHit: string; ordersGiven: number;
}
export interface Frame { g: { id: number; x: number; y: number; men: number; st: Status; w: number }[]; fx: { k: 'tiro' | 'melee'; a: number; b: number }[]; }
export interface BSide { kid: number; armies: number[]; general: Character | null; units: { type: string; men: number; exp: number }[]; name: string; color: string; }
export interface BattleState {
  id: number; prov: number; turn: number; sides: [BSide, BSide]; attackerSide: 0 | 1; playerSide: 0 | 1 | -1;
  tiles: number[]; fieldName: string; features: string[]; minWidth: number;
  stage: 'reconocimiento' | 'despliegue' | 'combate' | 'fin'; phase: number; maxPhases: number; groups: BGroup[];
  log: { phase: number; text: string; side: number }[]; frames: Frame[]; decisive: string[]; winner: -1 | 0 | 1; rngS: number; info: [number, number]; nextG: number;
}

const passable = (b: BattleState, x: number, y: number) => { const tx = Math.floor(x), ty = Math.floor(y); if (tx < 0 || ty < 0 || tx >= BW || ty >= BH) return false; return TILE[b.tiles[ty * BW + tx]].mv > 0; };
export const tileAt = (b: BattleState, x: number, y: number) => { const tx = Math.max(0, Math.min(BW - 1, Math.floor(x))), ty = Math.max(0, Math.min(BH - 1, Math.floor(y))); return b.tiles[ty * BW + tx]; };

export function generateField(w: World, pid: number, seed: number) {
  const s = w.provinces[pid]; const r = new RNG(hashNums(seed, pid, 31337)); const t = new Array(BW * BH).fill(0); const m = s.mix; const feats: string[] = [];
  const set = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < BW && y < BH) t[y * BW + x] = v; };
  const blob = (v: number, n: number, size: number, yr: [number, number]) => { for (let i = 0; i < n; i++) { let x = r.int(0, BW - 1), y = r.int(yr[0], yr[1]); for (let k = 0; k < size; k++) { set(x, y, v); x += r.int(-1, 1); y += r.int(-1, 1); } } };
  const cold = s.climate === 'frio';
  if (cold && (m.tundra || 0) + (m.nieve || 0) > 0.3) for (let i = 0; i < BW * BH; i++) if (r.chance(0.5)) t[i] = 8;
  const forest = (m.bosque || 0) + (m.taiga || 0) + (m.selva || 0);
  blob(1, Math.round(2 + forest * 14), 10 + Math.round(forest * 12), [1, BH - 2]); if (forest > 0.15) feats.push('Bosques que limitan la visión y el alcance de tiro');
  const hills = (m.colinas || 0) + (m.montana || 0) * 0.6;
  blob(2, Math.round(1 + hills * 8), 8, [2, 7]); blob(2, Math.round(1 + hills * 8), 8, [BH - 8, BH - 3]); if (hills > 0.1) feats.push('Colinas en ambas mitades: posiciones elevadas defendibles');
  if ((m.pantano || 0) > 0.05) { blob(7, 3, 10, [6, 13]); feats.push('Terreno pantanoso que frena las cargas'); }
  if ((m.montana || 0) + (m.nieve || 0) > 0.22) { // paso estrecho
    const half = r.int(4, 6); const cx = Math.floor(BW / 2) + r.int(-2, 2);
    for (let y = 0; y < BH; y++) { const hw = (y > 5 && y < BH - 6) ? half : half + 4; for (let x = 0; x < BW; x++) if (Math.abs(x - cx) > hw + (r.chance(0.3) ? 1 : 0)) set(x, y, 6); }
    feats.push(`Paso de montaña estrecho (≈${half * 2} casillas de anchura): limita la anchura de combate`);
  }
  if (s.river) { // río horizontal con vados o puente
    const ry = Math.floor(BH / 2) + r.int(-1, 1); for (let x = 0; x < BW; x++) { if (t[ry * BW + x] !== 6) set(x, ry, 3); }
    const nb = r.int(2, 3); for (let i = 0; i < nb; i++) { const x = r.int(3, BW - 4); if (t[ry * BW + x] === 3) { set(x, ry, 4); set(x + 1, ry, 4); } }
    feats.push(`Río ${'que solo se cruza por ' + nb + ' vados o puentes'}: cruzarlo bajo ataque es muy peligroso`);
  }
  if (s.coastal && r.chance(0.5)) { const side = r.chance(0.5) ? 0 : BW - 1; for (let y = 0; y < BH; y++) for (let k = 0; k < r.int(2, 4); k++) set(side === 0 ? k : BW - 1 - k, y, 6); feats.push('La costa cierra uno de los flancos'); }
  // camino central
  const rx = Math.floor(BW / 2) + r.int(-4, 4); for (let y = 0; y < BH; y++) { const v = t[y * BW + rx]; if (v === 3) set(rx, y, 4); else if (v !== 6) set(rx, y, 5); }
  // anchura mínima
  let minW = BW; for (let y = 0; y < BH; y++) { let c = 0; for (let x = 0; x < BW; x++) if (TILE[t[y * BW + x]].mv > 0) c++; if (t.slice(y * BW, y * BW + BW).some(v => v === 3)) continue; minW = Math.min(minW, c); }
  const name = (m.montana || 0) > 0.22 ? 'Paso de ' + s.name : s.river ? 'Vados de ' + s.name : forest > 0.4 ? 'Bosque de ' + s.name : 'Campos de ' + s.name;
  return { tiles: t, features: feats, minWidth: minW, name };
}

export function unitCat(u: UnitDef): 'inf' | 'ranged' | 'cav' | 'heavy' { if (u.cav) return 'cav'; if (u.range > 0 && u.id !== 'exploradores') return 'ranged'; if (u.id === 'minotauros' || u.id === 'gigantes' || u.id === 'enanos') return 'heavy'; return 'inf'; }
export const FORMATIONS: Record<string, { name: string; desc: string; p: Record<'inf' | 'ranged' | 'cav' | 'heavy', Partial<Record<Sector, number>>>; needs?: string }> = {
  equilibrada: { name: 'Equilibrada', desc: 'Línea sólida con arqueros delante y caballería en las alas.', p: { inf: { izquierda: 25, centro: 40, derecha: 25, reserva: 10 }, ranged: { vanguardia: 60, retaguardia: 40 }, cav: { izquierda: 50, derecha: 50 }, heavy: { centro: 100 } } },
  defensiva: { name: 'Defensiva', desc: 'Centro reforzado, tiradores protegidos y caballería en reserva.', p: { inf: { izquierda: 25, centro: 45, derecha: 25, reserva: 5 }, ranged: { retaguardia: 100 }, cav: { reserva: 100 }, heavy: { centro: 60, reserva: 40 } } },
  ofensiva: { name: 'Ofensiva', desc: 'Vanguardia potente para romper el centro enemigo.', p: { inf: { vanguardia: 30, izquierda: 20, centro: 30, derecha: 20 }, ranged: { vanguardia: 100 }, cav: { izquierda: 50, derecha: 50 }, heavy: { vanguardia: 100 } } },
  envolvente: { name: 'Envolvente', desc: 'Alas fuertes para rodear al enemigo.', p: { inf: { izquierda: 35, centro: 30, derecha: 35 }, ranged: { retaguardia: 100 }, cav: { izquierda: 50, derecha: 50 }, heavy: { izquierda: 50, derecha: 50 } } },
  profundidad: { name: 'Defensa en profundidad', desc: 'Varias líneas que se relevan.', p: { inf: { centro: 40, retaguardia: 30, reserva: 30 }, ranged: { retaguardia: 100 }, cav: { reserva: 100 }, heavy: { centro: 100 } } },
  flanco: { name: 'Flanco izquierdo reforzado', desc: 'Concentra la fuerza en un ala.', p: { inf: { izquierda: 50, centro: 30, derecha: 20 }, ranged: { izquierda: 50, retaguardia: 50 }, cav: { izquierda: 100 }, heavy: { izquierda: 100 } } },
  anticaballeria: { name: 'Anticaballería', desc: 'Picas y lanzas al frente contra cargas.', p: { inf: { vanguardia: 40, izquierda: 20, centro: 20, derecha: 20 }, ranged: { retaguardia: 100 }, cav: { reserva: 100 }, heavy: { centro: 100 } } },
  emboscada: { name: 'Emboscada', desc: 'Tropas ocultas en los bosques de las alas. Requiere bosque.', needs: 'bosque', p: { inf: { centro: 70, reserva: 30 }, ranged: { izquierda: 50, derecha: 50 }, cav: { izquierda: 50, derecha: 50 }, heavy: { centro: 100 } } },
};
export type Deployment = Record<string, Partial<Record<Sector, number>>>;
export function formationDeployment(side: BSide, f: string): Deployment {
  const F = FORMATIONS[f] || FORMATIONS.equilibrada; const d: Deployment = {};
  for (const u of side.units) { if (u.men <= 0) continue; const p = F.p[unitCat(UNIT[u.type])]; const e: Partial<Record<Sector, number>> = {}; let left = u.men; const secs = Object.keys(p) as Sector[];
    secs.forEach((s, i) => { const v = i === secs.length - 1 ? left : Math.round(u.men * p[s]! / 100); e[s] = v; left -= v; }); d[u.type] = e; }
  return d;
}
function sectorPos(sec: Sector, side: 0 | 1): [number, number] {
  const P: Record<Sector, [number, number]> = { vanguardia: [0.5, BH - 6.4], izquierda: [0.22, BH - 4.6], centro: [0.5, BH - 4.6], derecha: [0.78, BH - 4.6], retaguardia: [0.5, BH - 3.1], reserva: [0.5, BH - 1.5] };
  const [fx, y] = P[sec]; return side === 0 ? [fx * BW, y] : [BW - fx * BW, BH - y];
}
export function groupWidth(b: BattleState, men: number, type: string, x: number, y: number) {
  const d = UNIT[type]; let wd = Math.max(0.8, Math.min(6, men / (d.density * 2)));
  // limita por el ancho transitable de la fila
  const ty = Math.floor(y); let l = Math.floor(x), r = Math.floor(x); while (l > 0 && passable(b, l - 1 + 0.5, ty + 0.5)) l--; while (r < BW - 1 && passable(b, r + 1 + 0.5, ty + 0.5)) r++;
  return Math.min(wd, r - l + 1);
}
export function applyDeployment(b: BattleState, side: 0 | 1, dep: Deployment) {
  b.groups = b.groups.filter(g => g.side !== side);
  const S = b.sides[side];
  const bySec: Record<string, BGroup[]> = {};
  for (const u of S.units) {
    const e = dep[u.type] || { centro: u.men }; let total = 0; for (const s in e) total += Math.max(0, e[s as Sector] || 0);
    const scale = total > u.men ? u.men / total : 1; let assigned = 0;
    for (const s of SECTORS) { let men = Math.floor((e[s] || 0) * scale); if (men <= 0) continue; assigned += men;
      const g: BGroup = { id: b.nextG++, side, type: u.type, sector: s, men, startMen: men, x: 0, y: 0, w: 1, order: 'mantener', intensity: 'equilibrada', target: null, morale: UNIT[u.type].morale + 10 + u.exp * 15, cohesion: 90, fatigue: 0, exp: u.exp, status: 'formado', killed: 0, wounded: 0, captured: 0, deserted: 0, dispersed: 0, charged: false, contactTicks: 0, lastHit: '', ordersGiven: 0 };
      (bySec[s] = bySec[s] || []).push(g); b.groups.push(g); }
    const rest = u.men - assigned; if (rest > 0) { const g = b.groups.find(x => x.side === side && x.type === u.type && x.sector === 'reserva'); if (g) { g.men += rest; g.startMen += rest; } else { const ng: BGroup = { id: b.nextG++, side, type: u.type, sector: 'reserva', men: rest, startMen: rest, x: 0, y: 0, w: 1, order: 'mantener', intensity: 'equilibrada', target: null, morale: UNIT[u.type].morale + 10 + u.exp * 15, cohesion: 90, fatigue: 0, exp: u.exp, status: 'formado', killed: 0, wounded: 0, captured: 0, deserted: 0, dispersed: 0, charged: false, contactTicks: 0, lastHit: '', ordersGiven: 0 }; (bySec.reserva = bySec.reserva || []).push(ng); b.groups.push(ng); } }
  }
  for (const s in bySec) {
    const gs = bySec[s]; let [sx, sy] = sectorPos(s as Sector, side);
    for (const g of gs) g.w = groupWidth(b, g.men, g.type, sx, sy);
    const tot = gs.reduce((a, g) => a + g.w + 0.25, 0); let x = sx - tot / 2;
    for (const g of gs) { g.x = Math.max(g.w / 2, Math.min(BW - g.w / 2, x + g.w / 2)); g.y = sy; x += g.w + 0.25; nudgePassable(b, g); }
  }
  for (const g of b.groups) if (g.side === side) { const d = UNIT[g.type]; g.order = g.sector === 'reserva' ? 'mantener' : d.range > 0 && !d.cav ? 'disparar' : 'mantener'; }
}
function nudgePassable(b: BattleState, g: BGroup) { if (passable(b, g.x, g.y)) return; for (let d = 1; d < BW; d++) { for (const s of [-1, 1]) { const x = g.x + s * d; if (passable(b, x, g.y)) { g.x = x; g.w = groupWidth(b, g.men, g.type, g.x, g.y); return; } } } }
export function deployZone(side: 0 | 1) { return side === 0 ? [BH - 7, BH - 0.5] : [0.5, 7]; }
export function moveDeployed(b: BattleState, g: BGroup, x: number, y: number) { const [y0, y1] = deployZone(g.side); g.y = Math.max(y0, Math.min(y1, y)); g.x = Math.max(g.w / 2, Math.min(BW - g.w / 2, x)); if (!passable(b, g.x, g.y)) nudgePassable(b, g); g.w = groupWidth(b, g.men, g.type, g.x, g.y); }

export function sideGeneral(g: GameState, armies: Army[]): Character | null { let best: Character | null = null; for (const a of armies) if (a.general && (!best || a.general.estrategia > best.estrategia)) best = a.general; return best; }
export function createBattle(w: World, g: GameState, pid: number, attackers: Army[], defenders: Army[]): BattleState {
  const mk = (arr: Army[]): BSide => { const units: BSide['units'] = []; for (const a of arr) for (const u of a.units) { if (u.men <= 0) continue; const e = units.find(x => x.type === u.type); if (e) { e.exp = (e.exp * e.men + u.exp * u.men) / (e.men + u.men); e.men += u.men; } else units.push({ type: u.type, men: u.men, exp: u.exp }); } const k = g.kingdoms[arr[0].owner]; return { kid: k.id, armies: arr.map(a => a.id), general: sideGeneral(g, arr), units, name: k.name, color: k.color }; };
  const A = mk(attackers), D = mk(defenders);
  const pSide = A.kid === g.playerId ? 'A' : D.kid === g.playerId ? 'D' : '-';
  const sides: [BSide, BSide] = pSide === 'A' ? [A, D] : [D, A];
  const attackerSide: 0 | 1 = pSide === 'A' ? 0 : 1;
  const f = generateField(w, pid, g.seed + g.turn);
  const scout = (S: BSide) => { const t = S.units.reduce((s, u) => s + u.men, 0) || 1; const sc = S.units.filter(u => u.type === 'exploradores' || u.type === 'centauros').reduce((s, u) => s + u.men, 0); return Math.min(1, 0.35 + sc / t * 3 + ((S.general?.inteligencia || 5) - 5) * 0.04); };
  const b: BattleState = { id: g.nextId++, prov: pid, turn: g.turn, sides, attackerSide, playerSide: pSide === '-' ? -1 : 0, tiles: f.tiles, fieldName: f.name, features: f.features, minWidth: f.minWidth, stage: 'reconocimiento', phase: 0, maxPhases: 12, groups: [], log: [], frames: [], decisive: [], winner: -1, rngS: hashNums(g.seed, g.turn, pid, 5), info: [scout(sides[0]), scout(sides[1])], nextG: 1 };
  // el defensor ocupa colinas si puede (la IA despliega sola)
  return b;
}
export function assessment(b: BattleState, side: 0 | 1) {
  const adv: string[] = [], vul: string[] = [], def: string[] = [], flank: string[] = [], risk: string[] = [];
  const my = (y: number) => side === 0 ? y >= BH / 2 : y < BH / 2;
  let hillsMine = 0, hillsTheirs = 0, forestL = 0, forestR = 0;
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) { const t = b.tiles[y * BW + x]; if (t === 2) { if (my(y)) hillsMine++; else hillsTheirs++; } if (t === 1) { if (x < 8) forestL++; if (x > BW - 9) forestR++; } }
  if (hillsMine > 6) { adv.push('Disponemos de colinas en nuestra mitad del campo'); def.push('Las colinas propias dan +25% de defensa y +1 de alcance a los tiradores'); }
  if (hillsTheirs > 6) vul.push('El enemigo dispone de posiciones elevadas');
  if (b.minWidth < 16) adv.push(`Frente estrecho (${b.minWidth} casillas): un ejército pequeño puede contener a uno grande`);
  if (forestL > 8) flank.push('Bosque en el ala izquierda: ruta de flanqueo encubierta (o emboscada)'); if (forestR > 8) flank.push('Bosque en el ala derecha: ruta de flanqueo encubierta (o emboscada)');
  if (b.tiles.some(t => t === 3)) risk.push('Cruzar el río por los vados reduce el ataque un 25% y la defensa un 15%');
  const mine = b.sides[side].units.reduce((s, u) => s + u.men, 0), theirs = b.sides[1 - side].units.reduce((s, u) => s + u.men, 0);
  if (theirs > mine * 1.3) risk.push('Inferioridad numérica: evita combatir en campo abierto'); if (mine > theirs * 1.3) adv.push('Superioridad numérica');
  const cav = b.sides[1 - side].units.filter(u => UNIT[u.type].cav).reduce((s, u) => s + u.men, 0); if (cav > 0) risk.push('El enemigo cuenta con caballería: protege los flancos (piqueros)');
  const q = b.info[side]; const quality = q > 0.75 ? 'Alta' : q > 0.5 ? 'Media' : 'Baja';
  return { adv, vul, def, flank, risk, quality, q };
}
export function enemyEstimate(b: BattleState, side: 0 | 1, men: number) { const q = b.info[side]; if (q > 0.75) return { txt: men.toLocaleString('es'), exact: true }; const r = q > 0.5 ? 100 : 500; if (men <= 0) return { txt: '0', exact: false }; const v = Math.round(men / r) * r; return { txt: v === 0 ? '<' + r : '≈' + v.toLocaleString('es'), exact: false }; }
export function hiddenFrom(b: BattleState, side: 0 | 1, g: BGroup) { if (g.side === side || b.info[side] > 0.6) return false; if (b.stage === 'fin') return false; const t = tileAt(b, g.x, g.y); if (t !== 1) return false; return !b.groups.some(o => o.side === side && Math.hypot(o.x - g.x, o.y - g.y) < 4.5 && alive(o)); }

export const alive = (g: BGroup) => g.status !== 'huida' && g.status !== 'retirado' && g.status !== 'destruido';
const onField = (g: BGroup) => g.status !== 'retirado' && g.status !== 'destruido';
function gapX(a: BGroup, b: BGroup) { return Math.abs(a.x - b.x) - (a.w + b.w) / 2; }
function gapY(a: BGroup, b: BGroup) { return Math.abs(a.y - b.y) - 0.9; }
function inContact(a: BGroup, b: BGroup) { return gapX(a, b) < 0.15 && gapY(a, b) < 0.15; }
function facing(g: BGroup) { return g.side === 0 ? -1 : 1; }
function hitDir(att: BGroup, def: BGroup): 'frente' | 'flanco' | 'retaguardia' { const rel = (att.y - def.y) * facing(def); if (rel >= 0.45) return 'frente'; if (rel <= -0.45) return 'retaguardia'; return 'flanco'; }

function bfsNext(b: BattleState, g: BGroup, tx: number, ty: number): [number, number] {
  const sx = Math.floor(g.x), sy = Math.floor(g.y); let ex = Math.max(0, Math.min(BW - 1, Math.floor(tx))), ey = Math.max(0, Math.min(BH - 1, Math.floor(ty)));
  if (sx === ex && sy === ey) return [tx, ty];
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < BW && y < BH && TILE[b.tiles[y * BW + x]].mv > 0;
  if (!ok(ex, ey)) { let best = -1, bd = 1e9; for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) if (ok(x, y)) { const d = Math.hypot(x - ex, y - ey); if (d < bd) { bd = d; best = y * BW + x; } } if (best < 0) return [g.x, g.y]; ex = best % BW; ey = (best / BW) | 0; }
  const prev = new Int16Array(BW * BH).fill(-1); const q = [ey * BW + ex]; prev[ey * BW + ex] = ey * BW + ex; let found = false;
  while (q.length) { const c = q.shift()!; const cx = c % BW, cy = (c / BW) | 0; if (cx === sx && cy === sy) { found = true; break; } for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const nx = cx + dx, ny = cy + dy; if (!ok(nx, ny) && !(nx === sx && ny === sy)) continue; if (nx < 0 || ny < 0 || nx >= BW || ny >= BH) continue; const j = ny * BW + nx; if (prev[j] >= 0) continue; if (dx && dy && (!ok(cx + dx, cy) || !ok(cx, cy + dy))) continue; prev[j] = c; q.push(j); } }
  if (!found) return [tx, ty];
  const n = prev[sy * BW + sx]; const nx = n % BW, ny = (n / BW) | 0; if (nx === ex && ny === ey) return [tx, ty]; return [nx + 0.5, ny + 0.5];
}
function nearestEnemy(b: BattleState, g: BGroup, pred: (o: BGroup) => boolean = alive) { let best: BGroup | null = null, bd = 1e9; for (const o of b.groups) if (o.side !== g.side && pred(o)) { const d = Math.hypot(o.x - g.x, o.y - g.y); if (d < bd) { bd = d; best = o; } } return best; }
const G = (b: BattleState, id: number | null) => id == null ? null : b.groups.find(x => x.id === id) || null;

function destination(b: BattleState, g: BGroup): [number, number] | null {
  const d = UNIT[g.type]; const homeY = g.side === 0 ? BH - 0.3 : 0.3; const lineY = g.side === 0 ? BH - 3 : 3;
  if (g.status === 'huida') return [g.x, homeY];
  switch (g.order) {
    case 'mantener': case 'disparar': return null;
    case 'retirarse': return [g.x, homeY];
    case 'replegarse': if (Math.abs(g.y - lineY) < 0.4) { g.order = 'mantener'; return null; } return [g.x, lineY];
    case 'avanzar': { const e = nearestEnemy(b, g); if (!e) return null; if (d.range > 0 && !d.cav && Math.hypot(e.x - g.x, e.y - g.y) <= rangeOf(b, g)) return null; return [g.x + Math.sign(e.x - g.x) * Math.min(1.5, Math.abs(e.x - g.x)), e.y - facing(g) * -0.95]; }
    case 'atacar': case 'cargar': case 'perseguir': {
      let t = G(b, g.target); const pred = g.order === 'perseguir' ? (o: BGroup) => o.status === 'huida' : alive;
      if (!t || !(g.order === 'perseguir' ? t.status === 'huida' : alive(t))) { t = nearestEnemy(b, g, pred); g.target = t ? t.id : null; }
      if (!t) { if (g.order === 'perseguir') g.order = 'mantener'; return null; }
      return [t.x, t.y + (g.y > t.y ? 0.95 : -0.95)];
    }
    case 'flanquear': {
      let t = G(b, g.target); if (!t || !alive(t)) { t = nearestEnemy(b, g); g.target = t ? t.id : null; } if (!t) return null;
      const side = g.x < t.x ? -1 : 1; let fx = t.x + side * (t.w / 2 + g.w / 2 + 0.05); if (!passable(b, fx, t.y)) fx = t.x - side * (t.w / 2 + g.w / 2 + 0.05);
      if (Math.abs(g.x - fx) > 1.2 && Math.abs(g.y - t.y) > 2.2) return [fx, g.y + (t.y - g.y) * 0.35]; // primero lateral
      return [fx, t.y];
    }
    case 'hostigar': { const e = nearestEnemy(b, g); if (!e) return null; const dist = Math.hypot(e.x - g.x, e.y - g.y); const R = rangeOf(b, g); if (dist < Math.max(2, R * 0.5)) return [g.x - (e.x - g.x) / dist * 2, g.y - (e.y - g.y) / dist * 2]; if (dist > R * 0.9) return [e.x, e.y]; return null; }
    case 'reforzar': { const t = G(b, g.target); if (!t || t.side !== g.side || !onField(t)) { g.order = 'mantener'; return null; } return [t.x, t.y - facing(t) * 1.0]; }
  }
  return null;
}
function rangeOf(b: BattleState, g: BGroup) { const d = UNIT[g.type]; let r = d.range; if (tileAt(b, g.x, g.y) === 2) r += 1; return r; }
function los(b: BattleState, a: BGroup, t: BGroup) { const n = Math.ceil(Math.hypot(t.x - a.x, t.y - a.y) * 2); let block = 0; for (let i = 1; i < n; i++) { const x = a.x + (t.x - a.x) * i / n, y = a.y + (t.y - a.y) * i / n; if (TILE[tileAt(b, x, y)].los) block++; } return block <= 2 ? 1 : block <= 5 ? 0.55 : 0.25; }

function sideMods(b: BattleState, side: 0 | 1) { const gen = b.sides[side].general; return { atk: 1 + ((gen?.estrategia || 5) - 5) * 0.03, mor: 1 - ((gen?.liderazgo || 5) - 5) * 0.035 }; }
export function desperateAllowed(b: BattleState, side: 0 | 1) { const mine = b.groups.filter(g => g.side === side && alive(g)); const theirs = b.groups.filter(g => g.side !== side && alive(g)); const mm = mine.reduce((s, g) => s + g.men, 0), tm = theirs.reduce((s, g) => s + g.men, 0); const mor = mine.length ? mine.reduce((s, g) => s + g.morale, 0) / mine.length : 0; return mor < 40 || mm < tm * 0.55; }

export function runPhase(b: BattleState, techAtk: [number, number] = [1, 1]) {
  if (b.stage === 'fin') return; b.stage = 'combate';
  const r = new RNG(b.rngS); b.frames = []; b.phase++;
  const ph = b.phase; const logp = (t: string, side = -1) => b.log.push({ phase: ph, text: t, side });
  for (let tick = 0; tick < TICKS; tick++) {
    const fx: Frame['fx'] = [];
    // 1. movimiento
    for (const g of b.groups) {
      if (!onField(g)) continue; const d = UNIT[g.type];
      const engaged = b.groups.some(o => o.side !== g.side && onField(o) && o.status !== 'huida' && inContact(g, o));
      if (engaged && g.status !== 'huida' && g.order !== 'retirarse' && g.order !== 'replegarse') { continue; }
      const dest = destination(b, g); if (!dest) { continue; }
      const [nx, ny] = bfsNext(b, g, dest[0], dest[1]);
      const tm = TILE[tileAt(b, g.x, g.y)].mv || 0.5; const fatigueF = g.fatigue > 80 ? 0.7 : 1;
      let sp = 0.3 * d.speed * tm * INT[g.intensity].spd * fatigueF * (g.status === 'desorganizado' ? 0.75 : 1) * (g.status === 'huida' ? 1.25 : 1);
      if (g.order === 'cargar' && Math.hypot(dest[0] - g.x, dest[1] - g.y) < 4) sp *= 1.6;
      const dx = nx - g.x, dy = ny - g.y; const dist = Math.hypot(dx, dy); if (dist < 0.01) continue;
      const step = Math.min(sp, dist); const sub = 4;
      for (let k = 0; k < sub; k++) {
        const ox = g.x, oy = g.y; g.x += dx / dist * step / sub; g.y += dy / dist * step / sub;
        if (!passable(b, g.x, g.y)) { g.x = ox; g.y = oy; break; }
        if (g.status !== 'huida' && g.order !== 'retirarse' && b.groups.some(o => o.side !== g.side && onField(o) && o.status !== 'huida' && inContact(g, o))) break;
      }
      g.w = groupWidth(b, g.men, g.type, g.x, g.y);
      g.fatigue = Math.min(100, g.fatigue + 0.7 * INT[g.intensity].fat * (g.order === 'cargar' ? 1.6 : 1));
      if (TILE[tileAt(b, g.x, g.y)].mv < 0.8) g.cohesion = Math.max(0, g.cohesion - 0.6);
      if (g.status === 'huida' && (g.side === 0 ? g.y > BH - 0.7 : g.y < 0.7)) { g.status = 'retirado'; logp(`${UNIT[g.type].name} (${SECTOR_NAMES[g.sector]}) abandona el campo de batalla.`, g.side); }
      if (g.order === 'retirarse' && (g.side === 0 ? g.y > BH - 0.7 : g.y < 0.7)) { g.status = 'retirado'; }
      // reforzar: fusión al llegar
      if (g.order === 'reforzar') { const t = G(b, g.target); if (t && Math.hypot(t.x - g.x, t.y - g.y) < 1.4) { if (t.type === g.type) { t.morale = (t.morale * t.men + g.morale * g.men) / (t.men + g.men); t.men += g.men; t.startMen += g.men; g.men = 0; g.status = 'retirado'; logp(`Las reservas de ${UNIT[g.type].name} se incorporan a la línea.`, g.side); } else { t.morale = Math.min(100, t.morale + 8); g.order = 'atacar'; g.target = null; logp(`Refuerzos de ${UNIT[g.type].name} sostienen la línea.`, g.side); } } }
    }
    // 2. combate cuerpo a cuerpo
    const loss = new Map<number, { n: number; src: string; routed: boolean; attacker: BGroup }>();
    const contacts: [BGroup, BGroup][] = [];
    for (const a of b.groups) for (const c of b.groups) if (a.side === 0 && c.side === 1 && onField(a) && onField(c) && inContact(a, c) && !(a.status === 'huida' && c.status === 'huida')) contacts.push([a, c]);
    const nC = new Map<number, number>(); for (const [a, c] of contacts) { nC.set(a.id, (nC.get(a.id) || 0) + 1); nC.set(c.id, (nC.get(c.id) || 0) + 1); }
    for (const [a, c] of contacts) {
      fx.push({ k: 'melee', a: a.id, b: c.id });
      for (const [att, def] of [[a, c], [c, a]] as [BGroup, BGroup][]) {
        if (att.status === 'huida') continue;
        const ad = UNIT[att.type], dd = UNIT[def.type]; const dir = hitDir(att, def);
        const frontage = dir === 'frente' ? Math.min(att.w, def.w) : Math.min(att.w, 1.8);
        const engaged = Math.min(att.men, frontage * ad.density * 2) / (nC.get(att.id) || 1);
        const ta = TILE[tileAt(b, att.x, att.y)], td = TILE[tileAt(b, def.x, def.y)];
        let s = engaged * ad.atk * (1 + att.exp * 0.25) * (0.55 + 0.45 * att.morale / 100) * (1 - att.fatigue / 220) * (0.6 + 0.4 * att.cohesion / 100) * INT[att.intensity].dealt * ta.atk * sideMods(b, att.side).atk * techAtk[att.side];
        s *= ad.terrain[biomeOfTile(tileAt(b, att.x, att.y))] ?? 1;
        if (td.def > 1 && ta.def <= 1) s *= 0.85; // atacar cuesta arriba / en bosque
        if (dir === 'flanco') s *= 1.45; if (dir === 'retaguardia') s *= 1.9;
        if (att.status === 'desorganizado') s *= 0.75;
        let impact = false;
        if ((att.order === 'cargar' || ad.charge > 0.9) && !att.charged && att.contactTicks === 0) { impact = true; const anti = dd.antiCav >= 2 && dir === 'frente' && def.status !== 'desorganizado' ? true : false; if (anti && ad.cav) { s *= 0.6; att.morale -= 12; att.cohesion -= 15; logp(`La carga de ${ad.name} se estrella contra las picas de ${dd.name}.`, att.side); b.decisive.push(`Fase ${ph}: carga fallida de ${ad.name} contra ${dd.name}.`); } else { s *= 1 + ad.charge + (att.order === 'cargar' ? 0.3 : 0); def.cohesion -= 12 * (1 + ad.charge); } att.charged = true; att.fatigue += 6; }
        if (ad.cav === false && dd.cav) s *= ad.antiCav;
        let defv = dd.def * (1 + def.exp * 0.2) * (0.6 + 0.4 * def.cohesion / 100) * td.def / INT[def.intensity].taken * (def.order === 'mantener' ? 1.15 : 1);
        defv *= dd.terrain[biomeOfTile(tileAt(b, def.x, def.y))] ?? 1;
        if (def.status === 'huida') defv *= 0.4;
        const n = s / Math.max(0.5, defv) * 0.0095 * (def.status === 'huida' ? 2.5 : 1);
        const e = loss.get(def.id); if (e) e.n += n; else loss.set(def.id, { n, src: dir, routed: def.status === 'huida', attacker: att });
        if (dir !== 'frente') def.lastHit = dir;
        if (impact && dir !== 'frente') b.decisive.push(`Fase ${ph}: ${ad.name} carga contra el ${dir} de ${dd.name}.`);
      }
    }
    // 3. tiro
    for (const g of b.groups) {
      const d = UNIT[g.type]; if (!alive(g) || d.ranged <= 0) continue;
      if (b.groups.some(o => o.side !== g.side && onField(o) && o.status !== 'huida' && inContact(g, o))) continue;
      if (!['disparar', 'hostigar', 'mantener', 'avanzar', 'replegarse'].includes(g.order) && !(d.cav && g.order === 'flanquear')) continue;
      const R = rangeOf(b, g); let t = G(b, g.target); if (!t || !onField(t) || Math.hypot(t.x - g.x, t.y - g.y) > R) t = null;
      if (!t) { let bd = 1e9; for (const o of b.groups) if (o.side !== g.side && onField(o) && !hiddenFrom(b, g.side as 0 | 1, o)) { const dd = Math.hypot(o.x - g.x, o.y - g.y); if (dd <= R && dd < bd) { bd = dd; t = o; } } }
      if (!t) continue;
      const dist = Math.hypot(t.x - g.x, t.y - g.y); const shooters = Math.min(g.men, g.w * d.density * 2);
      const cover = TILE[tileAt(b, t.x, t.y)].los ? 0.6 : 1; const hill = tileAt(b, g.x, g.y) === 2 ? 1.15 : 1;
      const n = shooters * d.ranged * (0.55 + 0.45 * g.morale / 100) * (1 - dist / R * 0.4) * cover * hill * los(b, g, t) * INT[g.intensity].dealt * 0.0045 / (UNIT[t.type].def * 0.4 + 1.5);
      const e = loss.get(t.id); if (e) e.n += n; else loss.set(t.id, { n, src: 'tiro', routed: t.status === 'huida', attacker: g });
      g.fatigue = Math.min(100, g.fatigue + 0.4); fx.push({ k: 'tiro', a: g.id, b: t.id });
    }
    // 4. aplicar bajas y moral
    for (const g of b.groups) {
      if (!onField(g)) continue; const L = loss.get(g.id); const engaged = contacts.some(([a, c]) => a === g || c === g);
      g.contactTicks = engaged ? g.contactTicks + 1 : 0;
      if (L) {
        let n = Math.min(g.men, L.n * (0.85 + r.next() * 0.3)); n = Math.floor(n) + (r.next() < n % 1 ? 1 : 0);
        const before = g.men; g.men -= n;
        if (L.routed) { const pursuers = L.attacker; const cap = UNIT[pursuers.type].cav ? 0.45 : 0.3; g.killed += Math.round(n * 0.3); g.captured += Math.round(n * cap); g.wounded += Math.round(n * 0.15); g.dispersed += n - Math.round(n * 0.3) - Math.round(n * cap) - Math.round(n * 0.15); }
        else { g.killed += Math.round(n * 0.33); g.wounded += Math.round(n * 0.52); g.deserted += Math.round(n * 0.05); g.dispersed += n - Math.round(n * 0.33) - Math.round(n * 0.52) - Math.round(n * 0.05); }
        const frac = n / Math.max(1, before);
        g.morale -= frac * 180 * INT[g.intensity].mor * sideMods(b, g.side).mor * (L.src === 'tiro' ? 0.7 : 1) * (UNIT[g.type].id === 'milicia' ? 1.2 : 1);
        g.cohesion -= frac * 80 * INT[g.intensity].coh;
        if (L.src === 'flanco') g.morale -= 1.5; if (L.src === 'retaguardia') g.morale -= 3;
      }
      if (engaged) { g.fatigue = Math.min(100, g.fatigue + 1.8 * INT[g.intensity].fat); if (g.intensity === 'agresiva' || g.intensity === 'desesperada') g.cohesion -= 0.5 * INT[g.intensity].coh; }
      else if (!L && g.status !== 'huida') { g.morale = Math.min(UNIT[g.type].morale + 25, g.morale + 0.6); g.fatigue = Math.max(0, g.fatigue - (g.order === 'mantener' ? 1.5 : 0.3)); g.cohesion = Math.min(100, g.cohesion + (g.order === 'mantener' ? 1.2 : 0.3)); }
      if (g.fatigue > 85) g.morale -= 0.4;
      // pánico contagioso
      if (g.status !== 'huida') for (const o of b.groups) if (o !== g && o.side === g.side && o.status === 'huida' && Math.hypot(o.x - g.x, o.y - g.y) < 3) g.morale -= 0.6;
      g.cohesion = Math.max(0, g.cohesion); g.morale = Math.max(0, g.morale);
      // estados
      const thr = g.intensity === 'desesperada' ? 3 : UNIT[g.type].morale >= 75 ? 11 : 15;
      if (g.men < Math.max(10, g.startMen * 0.04) && g.status !== 'retirado') { g.dispersed += g.men; g.men = 0; g.status = 'destruido'; logp(`${UNIT[g.type].name} (${SECTOR_NAMES[g.sector]}) queda aniquilada.`, g.side); continue; }
      if (g.status !== 'huida' && g.morale <= thr) {
        g.status = 'huida'; logp(`¡${UNIT[g.type].name} del ${SECTOR_NAMES[g.sector].toLowerCase()} rompe filas y huye!`, g.side);
        b.decisive.push(`Fase ${ph}: ${b.sides[g.side].name.split(' ').slice(-1)[0]} — ${UNIT[g.type].name} (${SECTOR_NAMES[g.sector].toLowerCase()}) se desbanda${g.lastHit ? ' tras un ataque por el ' + g.lastHit : ''}.`);
        if (g.intensity === 'desesperada') { const c = Math.floor(g.men * 0.12); g.men -= c; g.captured += c; logp('El ataque desesperado fracasa: colapso catastrófico.', g.side); b.decisive.push(`Fase ${ph}: un ataque desesperado termina en colapso.`); }
      } else if (g.status !== 'huida') g.status = g.cohesion < 30 ? 'desorganizado' : engaged ? 'combatiendo' : 'formado';
    }
    b.frames.push({ g: b.groups.map(g => ({ id: g.id, x: +g.x.toFixed(3), y: +g.y.toFixed(3), men: g.men, st: g.status, w: +g.w.toFixed(2) })), fx });
    // fin
    const act = [0, 1].map(s => b.groups.filter(g => g.side === s && alive(g)).length);
    if (!act[0] || !act[1]) { finish(b, !act[0] && !act[1] ? (1 - b.attackerSide) as 0 | 1 : (act[0] ? 0 : 1)); break; }
  }
  if ((b.stage as string) !== 'fin' && b.phase >= b.maxPhases) { logp('Cae la noche: el atacante no logra desalojar al defensor.'); b.decisive.push(`El defensor resiste ${b.maxPhases} fases y conserva el campo.`); finish(b, (1 - b.attackerSide) as 0 | 1); }
  b.rngS = r.s;
}
function biomeOfTile(t: number): string { return t === 1 ? 'bosque' : t === 2 ? 'colinas' : t === 7 ? 'pantano' : 'llanura'; }
function finish(b: BattleState, winner: 0 | 1) {
  b.winner = winner; b.stage = 'fin';
  // persecución: la caballería del vencedor captura a los que huyen
  const cavW = b.groups.filter(g => g.side === winner && alive(g) && UNIT[g.type].cav).reduce((s, g) => s + g.men, 0);
  const totW = b.groups.filter(g => g.side === winner && alive(g)).reduce((s, g) => s + g.men, 0) || 1;
  const pursuit = b.groups.some(g => g.side === winner && g.order === 'perseguir') ? 0.06 : 0;
  for (const g of b.groups) if (g.side !== winner && (g.status === 'huida' || alive(g))) { const f = (g.status === 'huida' ? 0.06 : 0.02) + cavW / totW * 0.2 + pursuit; const n = Math.floor(g.men * f); g.men -= n; g.captured += Math.floor(n * 0.5); g.killed += Math.floor(n * 0.3); g.dispersed += n - Math.floor(n * 0.5) - Math.floor(n * 0.3); }
  b.log.push({ phase: b.phase, text: `Victoria de ${b.sides[winner].name}.`, side: winner });
}

// IA táctica: usada por los reinos IA y por la resolución automática/delegación del jugador (mismo motor)
export function aiOrders(b: BattleState, side: 0 | 1, onlyIdle = false) {
  const mine = b.groups.filter(g => g.side === side && alive(g)), theirs = b.groups.filter(g => g.side !== side && alive(g));
  const pw = (gs: BGroup[]) => gs.reduce((s, g) => { const d = UNIT[g.type]; return s + g.men * (d.atk + d.def + d.ranged) * (0.5 + g.morale / 200); }, 0);
  const ratio = pw(mine) / Math.max(1, pw(theirs)); const defender = side !== b.attackerSide;
  const desp = desperateAllowed(b, side) && ratio < 0.5 && b.phase > 3;
  const intensity: Intensity = desp ? 'desesperada' : ratio > 1.4 ? 'agresiva' : ratio < 0.75 ? 'prudente' : 'equilibrada';
  const friendRouted = b.groups.some(g => g.side === side && g.status === 'huida');
  for (const g of mine) {
    if (onlyIdle && g.ordersGiven > 0 && g.order !== 'mantener') continue;
    const d = UNIT[g.type]; const cat = unitCat(d); g.intensity = intensity;
    const near = nearestEnemy(b, g); if (!near) { g.order = 'mantener'; continue; }
    const dist = Math.hypot(near.x - g.x, near.y - g.y);
    if (theirs.some(t => t.status === 'huida') && cat === 'cav' && ratio > 1) { g.order = 'perseguir'; continue; }
    if (g.sector === 'reserva' && b.phase < 3 && !friendRouted && ratio < 1.6) { g.order = 'mantener'; continue; }
    if (ratio < 0.35 && b.phase > 2 && !defender) { g.order = 'retirarse'; continue; }
    if (cat === 'ranged') { g.order = dist <= rangeOf(b, g) ? 'disparar' : (defender && ratio < 1.1 ? 'mantener' : 'avanzar'); continue; }
    if (cat === 'cav') { const rt = theirs.filter(t => unitCat(UNIT[t.type]) === 'ranged'); const tgt = rt.length ? rt[0] : theirs.reduce((a, t) => t.men < a.men ? t : a, theirs[0]); g.order = ratio < 0.6 ? 'hostigar' : 'flanquear'; g.target = tgt.id; continue; }
    if (defender && ratio < 1.05 && b.phase < 6) { g.order = 'mantener'; continue; }
    g.order = (cat === 'heavy' && dist > 3) ? 'cargar' : 'atacar'; g.target = null;
  }
  for (const g of mine) g.ordersGiven++;
}
export function aiDeploy(b: BattleState, side: 0 | 1) {
  const S = b.sides[side]; const defender = side !== b.attackerSide; const cav = S.units.some(u => UNIT[u.type].cav);
  const enemyCav = b.sides[1 - side].units.some(u => UNIT[u.type].cav);
  const f = enemyCav && S.units.some(u => u.type === 'piqueros') ? 'anticaballeria' : defender ? (b.minWidth < 16 ? 'profundidad' : 'defensiva') : cav ? 'envolvente' : 'equilibrada';
  applyDeployment(b, side, formationDeployment(S, f));
}
export function autoResolve(b: BattleState, techAtk: [number, number] = [1, 1]) {
  if (!b.groups.some(g => g.side === 0)) aiDeploy(b, 0); if (!b.groups.some(g => g.side === 1)) aiDeploy(b, 1);
  let guard = 0; while (b.stage !== 'fin' && guard++ < 20) { aiOrders(b, 0); aiOrders(b, 1); runPhase(b, techAtk); }
}
export function sideTotals(b: BattleState, side: 0 | 1) {
  const gs = b.groups.filter(g => g.side === side); const t = { start: 0, end: 0, killed: 0, wounded: 0, captured: 0, deserted: 0, dispersed: 0 };
  for (const g of gs) { t.start += g.startMen; t.end += g.men; t.killed += g.killed; t.wounded += g.wounded; t.captured += g.captured; t.deserted += g.deserted; t.dispersed += g.dispersed; }
  return t;
}
export function sideUnitsAfter(b: BattleState, side: 0 | 1) { const m: Record<string, { men: number; wounded: number; dispersed: number }> = {}; for (const g of b.groups) if (g.side === side) { const e = m[g.type] || (m[g.type] = { men: 0, wounded: 0, dispersed: 0 }); e.men += g.men; e.wounded += g.wounded; e.dispersed += g.dispersed; } return m; }
