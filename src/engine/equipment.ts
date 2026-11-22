// Equipamiento, regimientos, obsolescencia y modernización.
import type { GameState, Army, Unit, Kingdom, Regiment } from './types';
import { UNIT, TIERS, tierName, ust } from './milcat';
import { TECH } from './data';
import type { World } from './world';
import { nid } from './game';

export const tierOf = (u: Unit) => u.tier ?? 2;
export const hasTechs = (k: Kingdom, type: string) => UNIT[type].techs.every(t => k.techs.includes(t));

/** Niveles de equipo que puede fabricar una provincia (según edificios y técnicas). */
export function availableTiers(g: GameState, kid: number, pid: number): { tier: number; ok: boolean; why: string }[] {
  const k = g.kingdoms[kid]; const b = g.provinces[pid].buildings;
  return TIERS.map(t => {
    let why = '';
    if (t.id === 2 && !b.herreria && !b.armeria) why = 'Requiere herrería o armería en la provincia';
    if (t.id === 3) why = !k.techs.includes('acero') ? 'Requiere ' + TECH.acero.name : !b.armeria ? 'Requiere armería en la provincia' : '';
    if (t.id === 4) why = !k.techs.includes('forja_maestra') ? 'Requiere ' + TECH.forja_maestra.name : !b.armeria ? 'Requiere armería en la provincia' : '';
    return { tier: t.id, ok: !why, why };
  });
}
export function bestTier(g: GameState, kid: number, pid: number) { let best = 1; for (const t of availableTiers(g, kid, pid)) if (t.ok) best = Math.max(best, t.tier); return best; }

/** Coste en armas de equipar 'men' soldados de un tipo con un nivel de equipo. */
export const armsCost = (type: string, tier: number, men: number) => men / 100 * ust(type, tier).cost.armas;
export function trainingMonths(k: Kingdom, type: string) { return Math.ceil(UNIT[type].training * (k.techs.includes('instruccion') ? 0.75 : 1)); }

// ---------------------------------------------------------------- Regimientos
const ORDN = (n: number) => n + '.º';
export function newRegiment(g: GameState, kid: number, type: string, place: string): Regiment {
  if (!g.regiments) g.regiments = [];
  const n = g.regiments.filter(r => r.owner === kid && r.type === type).length + 1;
  const reg: Regiment = { id: nid(g), owner: kid, name: `${ORDN(n)} de ${UNIT[type].name} de ${place}`, banner: (g.nextId * 7919 + kid * 31) % 1000, founded: g.turn, type, active: true, battles: 0, wins: 0, losses: 0, casualties: 0, decorations: [], commanders: [], history: [] };
  reg.history.push({ turn: g.turn, text: `Fundado en ${place} como ${UNIT[type].name.toLowerCase()}.` });
  g.regiments.push(reg); return reg;
}
export function regOf(g: GameState, u: Unit) { return u.rid != null ? (g.regiments || []).find(r => r.id === u.rid) || null : null; }
export function regLog(g: GameState, rid: number | undefined, text: string) { if (rid == null) return; const r = (g.regiments || []).find(x => x.id === rid); if (r) { r.history.push({ turn: g.turn, text }); if (r.history.length > 60) r.history.splice(1, 1); } }
/** Garantiza que toda unidad tiene nivel de equipo y regimiento (partidas nuevas y migradas). */
export function ensureMilitary(g: GameState, place: (a: Army) => string) {
  if (!g.regiments) g.regiments = [];
  for (const a of g.armies) for (const u of a.units) { if (u.tier == null) u.tier = 2; if (u.rid == null || !g.regiments.some(r => r.id === u.rid)) u.rid = newRegiment(g, a.owner, u.type, place(a)).id; }
}
/** Al fusionar dos unidades del mismo tipo, la mayor conserva su regimiento y absorbe a la otra. */
export function absorb(g: GameState, into: Unit, from: Unit) {
  const tot = into.men + from.men || 1;
  into.exp = (into.exp * into.men + from.exp * from.men) / tot; into.tier = (tierOf(into) * into.men + tierOf(from) * from.men) / tot;
  into.train = Math.round(((into.train || 0) * into.men + (from.train || 0) * from.men) / tot); into.amm = ((into.amm ?? 1) * into.men + (from.amm ?? 1) * from.men) / tot;
  if (from.rid != null && from.rid !== into.rid) { const r = regOf(g, from), t = regOf(g, into); if (r) { r.active = false; r.history.push({ turn: g.turn, text: `Se integra en ${t ? t.name : 'otro regimiento'}.` }); } if (t && r) t.history.push({ turn: g.turn, text: `Absorbe al ${r.name}.` }); }
  into.men = tot;
}

// ---------------------------------------------------------------- Obsolescencia
/** Unidades sucesoras que el reino ya puede formar y que dejan anticuado este tipo. */
export function obsoleteBy(k: Kingdom, type: string): string[] { return UNIT[type].obsoleteBy.filter(id => UNIT[id] && hasTechs(k, id)); }
export function unitWarnings(k: Kingdom, u: Unit): string[] {
  const w: string[] = []; const ob = obsoleteBy(k, u.type);
  if (ob.length) w.push(`Obsoleta: ya puedes formar ${ob.map(x => UNIT[x].name.toLowerCase()).join(' o ')}`);
  if (tierOf(u) < 1.5) w.push(`Equipo ${tierName(tierOf(u)).toLowerCase()}`);
  if ((u.amm ?? 1) < 0.5) w.push('Munición escasa'); if ((u.train || 0) > 0) w.push(`En instrucción (${u.train} meses)`);
  return w;
}

// ---------------------------------------------------------------- Modernización (conserva el regimiento y parte de la experiencia)
export interface RefitOpt { to: string; tier: number; arms: number; gold: number; months: number; exp: number; why: string[]; label: string; }
export function refitOptions(w: World, g: GameState, a: Army, u: Unit): RefitOpt[] {
  const k = g.kingdoms[a.owner]; const p = g.provinces[a.prov]; const out: RefitOpt[] = [];
  const base: string[] = []; if (p.owner !== a.owner || p.occupier >= 0) base.push('Debe estar en una provincia propia'); if (a.path.length) base.push('El ejército está en marcha'); if (a.sieging) base.push('El ejército está asediando');
  const tiers = availableTiers(g, a.owner, a.prov); const best = bestTier(g, a.owner, a.prov); const cur = tierOf(u);
  // 1) mejor equipo para el mismo tipo
  if (best > cur + 0.05) { const extra = Math.max(0, armsCost(u.type, best, u.men) - armsCost(u.type, cur, u.men) * 0.5); out.push({ to: u.type, tier: best, arms: Math.round(extra), gold: Math.round(u.men / 100 * 2), months: 1, exp: u.exp, why: [...base], label: `Reequipar con nivel ${tierName(best)}` }); }
  // 2) conversión a un tipo superior
  for (const to of UNIT[u.type].upgrades) {
    const d = UNIT[to]; if (!d) continue; const why = [...base];
    if (!hasTechs(k, to)) why.push('Requiere ' + d.techs.filter(t => !k.techs.includes(t)).map(t => TECH[t]?.name || t).join(', '));
    if (d.species && d.species !== UNIT[u.type].species) why.push(`Solo para ${d.species}s`);
    if (d.needsBarracks && !p.buildings.cuartel) why.push('Requiere cuartel en la provincia');
    const t = Math.max(1, Math.min(best, Math.round(cur)));
    const arms = Math.round(armsCost(to, t, u.men) * 0.85); const gold = Math.round(u.men / 100 * Math.max(1, (d.cost.oro - UNIT[u.type].cost.oro) * 0.6));
    out.push({ to, tier: t, arms, gold, months: Math.max(1, Math.ceil(d.training / 2)), exp: u.exp * 0.75, why, label: `Convertir en ${d.name}` });
  }
  void tiers; return out;
}
export function refit(w: World, g: GameState, a: Army, u: Unit, opt: RefitOpt): string | null {
  const k = g.kingdoms[a.owner]; if (opt.why.length) return opt.why[0];
  if (k.stock.armas < opt.arms) return `Faltan armas (${Math.ceil(opt.arms)} necesarias)`; if (k.stock.oro < opt.gold) return `Falta oro (${opt.gold} necesario)`;
  k.stock.armas -= opt.arms; k.stock.oro -= opt.gold;
  const from = u.type; const prevTier = tierOf(u);
  u.tier = opt.tier; u.exp = opt.exp; u.train = Math.max(u.train || 0, opt.months); u.amm = 1;
  if (opt.to !== from) {
    u.type = opt.to; const ex = a.units.find(x => x !== u && x.type === opt.to);
    if (ex) { absorb(g, ex, u); a.units.splice(a.units.indexOf(u), 1); }
    if (a.wounded[from]) { a.wounded[opt.to] = (a.wounded[opt.to] || 0) + a.wounded[from]; delete a.wounded[from]; }
    const r = regOf(g, ex || u); if (r) r.type = opt.to;
    regLog(g, (ex || u).rid, `Modernizado: de ${UNIT[from].name.toLowerCase()} a ${UNIT[opt.to].name.toLowerCase()} (equipo ${tierName(opt.tier).toLowerCase()}).`);
  } else regLog(g, u.rid, `Reequipado: de equipo ${tierName(prevTier).toLowerCase()} a ${tierName(opt.tier).toLowerCase()}.`);
  return null;
}

// ---------------------------------------------------------------- Logística y asedio
/** Carga logística: efectivos ponderados por sus necesidades (caballos, máquinas, gigantes). */
export function armyLoad(a: { units: Unit[] }) { return a.units.reduce((s, u) => s + u.men * UNIT[u.type].logistics, 0); }
/** Poder de asedio: suma de la eficacia contra fortificaciones (por cada 100 efectivos). */
export function siegePower(armies: { units: Unit[] }[]) { let s = 0; for (const a of armies) for (const u of a.units) s += u.men / 100 * UNIT[u.type].siege * (u.train ? 0.6 : 1); return s; }
