// AI Engine: los reinos IA usan las mismas reglas, costes y conocimiento limitado que el jugador.
import type { GameState, Kingdom, ResId } from './types';
import type { World } from './world';
import { BUILDINGS, TECHS, UNIT } from './data';
import { rngOf, saveRng, armyMen, rel, atWar, kprovs, totalPop, alert } from './game';
import { buildCheck, startBuild, kingdomEconomy, trade, marketPrice } from './economy';
import { obsoleteBy, bestTier, armsCost } from './equipment';
import { recruit, recruitOptions, findPath, armyStrength, canEnter } from './military';
import { evaluate, propose, declareWar, warsOf, power, PROP_NAMES, Proposal } from './diplomacy';
import { launchExpedition, expCheck, colonyCheck, startColony } from './exploration';

const W8: Record<string, Partial<Record<string, number>>> = {
  expansionista: { mil: 1.4, build: 1, sci: 0.8, trade: 0.8 }, militarista: { mil: 1.7, build: 0.9, sci: 0.7, trade: 0.7 }, comercial: { mil: 0.8, build: 1.1, sci: 1, trade: 1.6 },
  pacifista: { mil: 0.6, build: 1.2, sci: 1.1, trade: 1.2 }, explorador: { mil: 0.9, build: 1, sci: 1.1, trade: 1 }, cientifico: { mil: 0.8, build: 1, sci: 1.6, trade: 1 },
  diplomatico: { mil: 0.8, build: 1.1, sci: 1.1, trade: 1.2 }, aislacionista: { mil: 1.1, build: 1.2, sci: 1, trade: 0.5 }, prudente: { mil: 1, build: 1.1, sci: 1, trade: 1 },
};
export function runAI(w: World, g: GameState) {
  const r = rngOf(g); const rnd = () => r.next();
  for (const k of g.kingdoms) {
    if (!k.alive || k.id === g.playerId) continue;
    const P = W8[k.personality] || W8.prudente;
    const eco = kingdomEconomy(w, g, k.id);
    // 1. investigación
    if (!k.research.current) { const av = TECHS.filter(t => !k.techs.includes(t.id) && t.req.every(q => k.techs.includes(q))); if (av.length) k.research.current = r.weighted(av, t => (t.mil || t.unlocks.some(u => u.kind === 'Unidad') ? P.mil! : 1) * (['Comercio', 'Construcción naval'].includes(t.branch) ? P.trade! : 1) * (['Educación', 'Matemáticas'].includes(t.branch) ? P.sci! : 1) * (k.personality === 'explorador' && ['Cartografía', 'Navegación'].includes(t.branch) ? 2.5 : 1)).id; }
    // 2. economía: comprar alimentos si faltan
    if (eco.net.alimentos < 0 && k.stock.alimentos < -eco.net.alimentos * 4) { const q = Math.ceil(-eco.net.alimentos * 3); if (k.stock.oro > q * marketPrice(w, g, k.id, 'alimentos', true) + 40) trade(w, g, k.id, 'alimentos', q); }
    if (k.stock.madera > 1200) trade(w, g, k.id, 'madera', -200); if (k.stock.piedra > 1200) trade(w, g, k.id, 'piedra', -200);
    // 3. construcción
    const reserve = 60 + (k.independent ? 0 : 60);
    if (k.stock.oro > reserve && rnd() < 0.7) {
      const opts: { pid: number; id: string; v: number }[] = [];
      for (const p of kprovs(g, k.id)) for (const b of BUILDINGS) {
        const c = buildCheck(w, g, k.id, p.id, b.id); if (!c.ok) continue;
        let v = 1;
        if (['granja', 'molino', 'riego'].includes(b.id)) v = eco.net.alimentos < 5 ? 4 : 1.2;
        if (b.id === 'aserradero') v = k.stock.madera < 150 ? 2.5 : 0.6; if (b.id === 'cantera') v = k.stock.piedra < 150 ? 2.5 : 0.6;
        if (b.id === 'mina') v = 3; if (b.id === 'herreria') v = k.stock.herramientas < 40 ? 2 : 0.6; if (b.id === 'armeria') v = 1.5 * P.mil!;
        if (b.id === 'mercado') v = 2 * P.trade!; if (b.id === 'puerto') v = 1.5 * P.trade!; if (b.id === 'biblioteca' || b.id === 'universidad') v = 1.5 * P.sci!;
        if (b.id === 'murallas' || b.id === 'castillo') v = (w.provinces[p.id].neighbors.some(n => g.provinces[n].owner >= 0 && g.provinces[n].owner !== k.id) ? 1.4 : 0.3) * P.mil!;
        if (b.id === 'cuartel') v = 0.8 * P.mil!; if (b.id === 'camino') v = 1; if (b.id === 'torre') v = 0.4; if (b.id === 'hospital') v = p.pop > 40000 ? 1.2 : 0.3; if (b.id === 'deposito') v = warsOf(g, k.id).length ? 1.2 : 0.2;
        if (k.independent) v *= ['granja', 'mercado', 'murallas', 'camino'].includes(b.id) ? 1 : 0.3;
        opts.push({ pid: p.id, id: b.id, v: v * (0.6 + rnd() * 0.8) });
      }
      opts.sort((a, b) => b.v - a.v); if (opts.length) startBuild(w, g, k.id, opts[0].pid, opts[0].id); if (opts.length > 1 && k.stock.oro > 400) startBuild(w, g, k.id, opts[1].pid, opts[1].id);
    }
    // 4. ejército
    const pop = totalPop(g, k.id); const men = g.armies.filter(a => a.owner === k.id).reduce((s, a) => s + armyMen(a), 0);
    const enemies = warsOf(g, k.id);
    const target = pop * 0.025 * P.mil! * (enemies.length ? 1.6 : 1) * (k.independent ? 0.6 : 1);
    if (men < target && k.stock.oro > 120 && eco.net.oro > 1 && rnd() < 0.5) {
      const capP = g.provinces[k.capital]; const opts = recruitOptions(w, g, k.id, k.capital).filter(o => !o.why.length && o.pool > 200);
      if (opts.length) {
        // la IA prefiere tipos no obsoletos, equilibra tiradores y caballería, y evita máquinas de asedio si no está asediando
        const have: Record<string, number> = {}; for (const a of g.armies) if (a.owner === k.id) for (const u of a.units) { const c = UNIT[u.type].role; have[c] = (have[c] || 0) + u.men; } const tot = Object.values(have).reduce((x, y) => x + y, 0) || 1;
        const o = r.weighted(opts, o => { const d = o.u; let wgt = d.id === 'milicia' ? 0.5 : 1 + (d.atk + d.def + d.ranged / Math.max(1, d.reload)) / 12; if (d.role === 'asedio' || d.role === 'ingenieros') wgt *= 0.08; if (d.species === 'gigante') wgt *= 0.2; if (obsoleteBy(k, d.id).length) wgt *= 0.25; if (d.role === 'tiradores' && (have.tiradores || 0) / tot < 0.25) wgt *= 1.8; if (d.cav && (have.caballeria || 0) / tot < 0.15) wgt *= 1.5; if (d.training >= 4) wgt *= 0.7; return wgt; });
        const tier = bestTier(g, k.id, capP.id); const ac = Math.max(0.1, armsCost(o.u.id, tier, 100));
        const n = Math.min(o.pool, 600, Math.floor((k.stock.oro - 80) / o.u.cost.oro * 100), Math.floor(k.stock.armas / ac * 100)); if (n >= (o.u.species === 'gigante' ? 5 : 100)) recruit(w, g, k.id, capP.id, o.u.id, n, tier); }
    }
    // 5. operaciones militares (solo con información conocida)
    const myArmies = g.armies.filter(a => a.owner === k.id);
    if (myArmies.length > 1) { const cap = myArmies.filter(a => a.prov === k.capital && !a.path.length); if (cap.length > 1) { const [a, ...rest] = cap; for (const b of rest) { for (const u of b.units) { const e = a.units.find(x => x.type === u.type); if (e) e.men += u.men; else a.units.push({ ...u }); } g.armies.splice(g.armies.indexOf(b), 1); } } }
    for (const a of g.armies.filter(a => a.owner === k.id)) {
      if (a.path.length || a.sieging) continue;
      // defender provincias propias con enemigos
      const threatened = kprovs(g, k.id).filter(p => g.armies.some(e => e.prov === p.id && atWar(g, e.owner, k.id)) || p.occupier >= 0);
      if (threatened.length) { const t = threatened[0]; const enemy = g.armies.filter(e => e.prov === t.id && atWar(g, e.owner, k.id)).reduce((s, e) => s + armyStrength(e), 0); if (armyStrength(a) > enemy * 0.8) { const p = findPath(w, g, a, t.id); if (p) { a.path = p; continue; } } }
      if (enemies.length && armyMen(a) > 1500 && a.supply > 1) {
        const targets = g.provinces.filter(p => enemies.includes(p.owner) && p.occupier !== k.id && k.known[p.id] >= 2);
        let best: number | null = null, bv = -1e9;
        for (const t of targets) { const def = g.armies.filter(e => e.prov === t.id && e.owner === t.owner).reduce((s, e) => s + armyStrength(e), 0); if (def > armyStrength(a) * 0.9) continue; const d = Math.hypot(w.provinces[t.id].cx - w.provinces[a.prov].cx, w.provinces[t.id].cy - w.provinces[a.prov].cy); const v = -d + (t.id === g.kingdoms[t.owner].capital ? 30 : 0) - (t.buildings.murallas || 0) * 8 + rnd() * 10; if (v > bv) { bv = v; best = t.id; } }
        if (best !== null) { const p = findPath(w, g, a, best); if (p && p.length < 12) { a.path = p; continue; } }
      }
      if (!enemies.length && a.prov !== k.capital) { const p = findPath(w, g, a, k.capital); if (p) a.path = p; }
    }
    // 6. diplomacia (cada pocos meses)
    k.aiTimer--; if (k.aiTimer <= 0) {
      k.aiTimer = 4 + Math.floor(rnd() * 4);
      for (const o of g.kingdoms) {
        if (!o.alive || o.id === k.id) continue; const rr = rel(g, k.id, o.id); if (!rr || !rr.contact) continue;
        if (rr.war) { const ws = rr.a === k.id ? rr.warScore : -rr.warScore; const long = g.turn - rr.warStart > 10;
          if ((long && (k.warExhaustion > 25 || ws < -15)) || ws > 30) { const kind = ws > 25 && g.provinces.some(p => p.owner === o.id && p.occupier === k.id) ? 'paz_ceder' : ws > 15 ? 'paz_tributo' : 'paz_blanca'; if (o.id === g.playerId) offerToPlayer(g, k, o.id, { kind }); else { const ev = evaluate(w, g, k.id, o.id, { kind }); if (ev.accept) propose(w, g, k.id, o.id, { kind }); } }
          continue; }
        const kinds: Proposal['kind'][] = []; if (!rr.trade && rr.opinion > 15 && k.personality !== 'aislacionista') kinds.push('comercio'); if (!rr.nap && rr.opinion > 25) kinds.push('nap'); if (!rr.alliance && rr.opinion > 55 && !o.independent) kinds.push('alianza');
        if (o.independent && !k.independent && rr.opinion > 45 && power(g, k.id) > power(g, o.id) * 4 && (k.personality === 'diplomatico' || k.personality === 'expansionista')) kinds.push('incorporar');
        for (const kind of kinds) { if (o.id === g.playerId) { if (g.turn - rr.lastProposal > 12 && rnd() < 0.35) { offerToPlayer(g, k, o.id, { kind }); rr.lastProposal = g.turn; } break; } const ev = evaluate(w, g, k.id, o.id, { kind }); if (ev.accept) { propose(w, g, k.id, o.id, { kind }); break; } }
        // guerra
        const aggressive = k.personality === 'expansionista' || k.personality === 'militarista';
        const border = kprovs(g, k.id).some(p => w.provinces[p.id].neighbors.some(n => g.provinces[n].owner === o.id));
        if (aggressive && border && !rr.nap && !rr.alliance && rr.opinion < -5 && enemies.length === 0 && k.warExhaustion < 10 && g.turn > 8 && power(g, k.id) > power(g, o.id) * (o.id === g.playerId ? 1.5 - 0.1 * g.difficulty : 1.2) && rnd() < 0.3) { declareWar(w, g, k.id, o.id); break; }
      }
    }
    // 7. exploración y colonización
    if (!k.independent && (k.personality === 'explorador' || k.type === 'maritimo' || rnd() < 0.2) && rnd() < 0.06 && k.stock.oro > 200) {
      const port = kprovs(g, k.id).find(p => p.buildings.puerto); const kind = port ? (k.techs.includes('oceanica') && rnd() < 0.5 ? 'oceanica' : 'maritima') : 'terrestre';
      const start = port ? port.id : k.capital; const dirs = ['N', 'S', 'E', 'O'] as const;
      const plan = { start, kind: kind as any, dir: dirs[Math.floor(rnd() * 4)], members: 150, supplies: 10, escort: 50, risk: 1, leaderIdx: 1 };
      if (!expCheck(w, g, k.id, plan).length) launchExpedition(w, g, k.id, plan);
    }
    if (!k.independent && k.stock.oro > 260 && rnd() < (k.personality === 'expansionista' ? 0.12 : 0.05)) {
      const cands = g.provinces.filter(p => p.owner < 0 && !p.colonizing && k.known[p.id] >= 2 && w.provinces[p.id].neighbors.some(n => g.provinces[n].owner === k.id));
      if (cands.length) { const c = cands.reduce((a, b) => w.provinces[b.id].fertility > w.provinces[a.id].fertility ? b : a); if (!colonyCheck(w, g, k.id, c.id, 'colonia').length) startColony(w, g, k.id, c.id, 'colonia', c.cityName); }
    }
  }
  saveRng(g, r);
}
function offerToPlayer(g: GameState, k: Kingdom, to: number, p: Proposal) {
  if (g.events.some(e => e.kind === 'propuesta' && e.data?.from === k.id)) return;
  const txt: Record<string, string> = { comercio: 'propone un acuerdo comercial (+oro para ambos).', nap: 'propone un pacto de no agresión.', alianza: 'propone una alianza defensiva.', paz_blanca: 'propone una paz blanca: cada cual conserva lo suyo.', paz_tributo: 'exige un tributo de hasta 150 de oro a cambio de la paz.', paz_ceder: 'exige que le cedamos las provincias que ocupa a cambio de la paz.', incorporar: 'nos ofrece incorporarnos a su reino.' };
  g.events.push({ id: g.nextId++, kind: 'propuesta', title: `Propuesta de ${k.name}`, text: `${k.ruler.name}, de ${k.name}, ${txt[p.kind] || PROP_NAMES[p.kind]}`, prov: -1, turn: g.turn, data: { from: k.id, prop: p }, choices: [{ label: 'Aceptar', effects: PROP_NAMES[p.kind] }, { label: 'Rechazar', effects: '−5 opinión' }] });
  alert(g, 'internacional', `${k.name}: ${PROP_NAMES[p.kind]}.`);
}
