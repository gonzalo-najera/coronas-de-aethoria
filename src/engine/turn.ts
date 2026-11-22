// Motor de turnos: procesa cada mes en el orden definido (calendario → … → crónicas).
import type { GameState, Army, Kingdom } from './types';
import type { World } from './world';
import { UNIT, SPECIES } from './data';
import { regOf } from './equipment';
import { rngOf, saveRng, armyMen, atWar, allied, alert, chron, updateVisibility, updateContacts, invalidateVis, dateOf, totalPop, makeCharacter, rel, nid, kprovs, relKey, pickSpecies } from './game';
import { processEconomy, kingdomEconomy } from './economy';
import { moveArmies, logistics, processSieges, retreatTarget, findPath } from './military';
import { processExpeditions, processColonies } from './exploration';
import { monthlyDiplomacy, makePeace } from './diplomacy';
import { runAI } from './ai';
import { processEvents } from './events';
import { BattleState, createBattle, autoResolve, sideTotals, sideUnitsAfter, aiDeploy } from './battle';
import { RNG } from './rng';

export function endTurn(w: World, g: GameState): { battles: number } {
  // 1. Calendario
  g.turn++; const d = dateOf(g.turn); invalidateVis();
  const r = rngOf(g); const rnd = () => r.next(); saveRng(g, r);
  // 2-7. Producción, consumo, comercio, población, construcciones, investigación
  for (const k of g.kingdoms) if (k.alive) processEconomy(w, g, k.id, rnd);
  for (const p of g.provinces) { if (p.owner < 0) continue; if (p.stability < 20) p.lowStabMonths++; else p.lowStabMonths = 0; }
  // 8-9. Movimientos y logística
  moveArmies(w, g); invalidateVis(); logistics(w, g);
  // 10. Expediciones y colonias
  processExpeditions(w, g); processColonies(w, g);
  // 11. Combates y asedios
  const battles = detectBattles(w, g);
  processSieges(w, g);
  // 12. Diplomacia
  monthlyDiplomacy(w, g);
  // 13. IA
  runAI(w, g);
  // 14. Eventos, sucesión, secesiones
  processEvents(w, g); succession(w, g); secessions(w, g);
  // 15. Conocimiento, estadísticas y crónicas
  updateVisibility(w, g); updateContacts(w, g);
  const pk = g.kingdoms[g.playerId]; const e = kingdomEconomy(w, g, g.playerId);
  g.history.push({ turn: g.turn, oro: Math.round(pk.stock.oro), alimentos: Math.round(pk.stock.alimentos), pop: Math.round(totalPop(g, g.playerId)), investigacion: +(e.net.investigacion + (pk.research.current ? 0 : 0)).toFixed(1) });
  if (g.history.length > 600) g.history.shift();
  const men = g.armies.filter(a => a.owner === g.playerId).reduce((s, a) => s + armyMen(a), 0); g.stats.maxArmy = Math.max(g.stats.maxArmy, men);
  for (const k of g.kingdoms) if (k.alive && !k.independent && kprovs(g, k.id).length === 0) { k.alive = false; chron(g, k.id, 'caida', `${k.name} desaparece de la historia.`, true); alert(g, 'internacional', `${k.name} ha caído.`); for (const key in g.relations) { const x = g.relations[key]; if (x.a === k.id || x.b === k.id) x.war = false; } g.armies = g.armies.filter(a => a.owner !== k.id); }
  for (const k of g.kingdoms) if (k.alive && k.independent && kprovs(g, k.id).length === 0) k.alive = false;
  return { battles };
}

function detectBattles(w: World, g: GameState): number {
  let n = 0; const done = new Set<number>();
  for (const a of g.armies) {
    if (done.has(a.prov) || armyMen(a) <= 0) continue;
    const here = g.armies.filter(x => x.prov === a.prov && armyMen(x) > 0);
    const hostile = here.find(x => atWar(g, x.owner, a.owner)); if (!hostile) continue;
    done.add(a.prov);
    // bandos: el dueño (o su aliado) defiende
    const owner = g.provinces[a.prov].owner; const occ = g.provinces[a.prov].occupier;
    const defK = [a.owner, hostile.owner].find(k => k === owner || k === occ || (owner >= 0 && allied(g, k, owner))) ?? hostile.owner;
    const atkK = defK === a.owner ? hostile.owner : a.owner;
    const defenders = here.filter(x => x.owner === defK || (allied(g, x.owner, defK) && atWar(g, x.owner, atkK)));
    const attackers = here.filter(x => x.owner === atkK || (allied(g, x.owner, atkK) && atWar(g, x.owner, defK)));
    if (!attackers.length || !defenders.length) continue;
    const b = createBattle(w, g, a.prov, attackers, defenders);
    if (b.playerSide === 0) { aiDeploy(b, 1); g.pendingBattles.push(b); alert(g, 'critica', `¡Batalla inminente en ${w.provinces[a.prov].name}!`, { prov: a.prov }); n++; }
    else { autoResolve(b); applyBattle(w, g, b); }
  }
  return n;
}

export function applyBattle(w: World, g: GameState, b: BattleState) {
  const win = b.winner as 0 | 1, lose = (1 - win) as 0 | 1; const rep: any = { id: b.id, prov: b.prov, turn: g.turn, field: b.fieldName, phases: b.phase, winner: b.sides[win].kid, loser: b.sides[lose].kid, sides: [] as any[], decisive: b.decisive.slice(0, 6), consequences: [] as string[] };
  const ws = w.provinces[b.prov];
  for (const s of [0, 1] as const) {
    const S = b.sides[s];
    // cirujanos de campaña: parte de los caídos se recupera como heridos
    if (g.kingdoms[S.kid].techs.includes('cirujanos')) for (const q of b.groups) if (q.side === s) { const m = Math.round(q.killed * 0.1); q.killed -= m; q.wounded += m; }
    const t = sideTotals(b, s); const after = sideUnitsAfter(b, s);
    const armies = S.armies.map(id => g.armies.find(a => a.id === id)).filter(Boolean) as Army[];
    const pre = armies.flatMap(a => a.units.map(u => ({ a, u, men: u.men })));
    const ammoLeft: Record<string, number> = {}; for (const type in after) { const gs = b.groups.filter(q => q.side === s && q.type === type && (q.maxAmmo || 0) > 0); const mx = gs.reduce((x, q) => x + (q.maxAmmo || 0) * q.startMen, 0); if (mx > 0) ammoLeft[type] = gs.reduce((x, q) => x + (q.ammo ?? q.maxAmmo ?? 0) * q.startMen, 0) / mx; }
    // reparto proporcional de supervivientes entre los ejércitos del bando
    for (const type in after) {
      const tot = armies.reduce((x, a) => x + (a.units.find(u => u.type === type)?.men || 0), 0) || 1;
      for (const a of armies) { const u = a.units.find(x => x.type === type); if (!u) continue; const share = u.men / tot; u.men = Math.floor(after[type].men * share); a.wounded[type] = (a.wounded[type] || 0) + Math.floor((after[type].wounded + after[type].dispersed * 0.5) * share); u.exp = Math.min(1, u.exp + (s === win ? 0.08 : 0.04)); if (ammoLeft[type] != null) u.amm = Math.max(0, Math.min(u.amm ?? 1, ammoLeft[type])); }
    }
    // historial de los regimientos
    const enemyStart = sideTotals(b, (1 - s) as 0 | 1).start; const won = s === win;
    for (const { a, u, men } of pre) { const r = regOf(g, u); if (!r) continue; const lost = Math.max(0, men - u.men);
      r.battles++; if (won) r.wins++; else r.losses++; r.casualties += lost;
      if (a.general && !r.commanders.includes(a.general.name)) { r.commanders.push(a.general.name); if (r.commanders.length > 8) r.commanders.shift(); }
      const dec = (d: string) => { if (!r.decorations.includes(d)) { r.decorations.push(d); r.history.push({ turn: g.turn, text: 'Condecoración: ' + d + '.' }); } };
      r.history.push({ turn: g.turn, text: `Batalla de ${b.fieldName}: ${won ? 'victoria' : 'derrota'}; ${lost.toLocaleString('es')} bajas de ${men.toLocaleString('es')}.` });
      if (won && r.wins === 1) dec('Bautismo de fuego'); if (r.wins === 5) dec('Estandarte de las cinco victorias'); if (r.wins === 15) dec('Regimiento legendario');
      if (won && t.start < enemyStart * 0.8) dec('Honor de la desigualdad'); if (won && lost > men * 0.4) dec('Mención al sacrificio');
      if (u.men <= 0 && !a.wounded[u.type]) { r.active = false; r.history.push({ turn: g.turn, text: `Aniquilado en ${b.fieldName}.` }); } }
    for (const a of armies) { a.units = a.units.filter(u => u.men > 0); a.morale = Math.max(5, Math.min(95, a.morale + (s === win ? 10 : -25))); a.lastBattle = g.turn; a.path = []; }
    // población: los muertos, prisioneros y desertores no vuelven
    const gone = t.killed + t.captured + t.deserted + Math.floor(t.dispersed * 0.5);
    const kp = kprovs(g, S.kid); const mob = kp.reduce((x, p) => x + p.mobilized, 0) || 1; for (const p of kp) p.mobilized = Math.max(0, p.mobilized - Math.round(gone * p.mobilized / mob));
    rep.sides.push({ kid: S.kid, name: S.name, general: S.general?.name || '—', ...t, units: Object.entries(after).map(([type, v]) => ({ type, name: UNIT[type].name, start: b.groups.filter(x => x.side === s && x.type === type).reduce((q, x) => q + x.startMen, 0), end: v.men })) });
    if (s === lose) { for (const a of armies) { if (!a.units.length) continue; const tgt = retreatTarget(w, g, a); if (tgt === null) { const cap = a.units.reduce((x, u) => x + u.men, 0); rep.consequences.push(`${a.name} queda rodeado y se rinde (${cap.toLocaleString('es')} prisioneros).`); rep.sides[s].captured += cap; a.units = []; } else { a.prov = tgt; a.retreating = true; rep.consequences.push(`${a.name} se retira a ${w.provinces[tgt].name}.`); } } }
    g.armies = g.armies.filter(a => a.units.length || Object.keys(a.wounded).length);
  }
  const kw = g.kingdoms[b.sides[win].kid], kl = g.kingdoms[b.sides[lose].kid];
  const tw = sideTotals(b, win), tl = sideTotals(b, lose);
  const arms = Math.round(tl.captured / 30 + tl.killed / 100); kw.stock.armas += arms; rep.captured = arms; rep.prisoners = tl.captured;
  const outnumbered = tw.start < tl.start * 0.8; kw.stock.prestigio += outnumbered ? 8 : 3; kl.stock.prestigio -= 3;
  const rr = rel(g, kw.id, kl.id); if (rr) rr.warScore += (rr.a === kw.id ? 1 : -1) * Math.round(6 + 20 * (tl.start - tl.end) / Math.max(1, tl.start));
  kl.warExhaustion += 4; kw.warExhaustion += 1; g.provinces[b.prov].prosperity = Math.max(0, g.provinces[b.prov].prosperity - 6);
  rep.consequences.push(`${kw.short}: +${outnumbered ? 8 : 3} prestigio, ${arms} armas capturadas. ${kl.short}: −3 prestigio, +4 cansancio de guerra.`);
  if (outnumbered) rep.consequences.push('Victoria contra un ejército superior en número.');
  rep.consequences.push(`Situación territorial: ${ws.name} sigue en manos de ${g.provinces[b.prov].owner >= 0 ? g.kingdoms[g.provinces[b.prov].owner].short : 'nadie'}${g.provinces[b.prov].occupier >= 0 ? ' (ocupada por ' + g.kingdoms[g.provinces[b.prov].occupier].short + ')' : ''}. Las ciudades amuralladas deben asediarse aparte.`);
  const txt = `Batalla de ${b.fieldName}: ${kw.name} vence a ${kl.name} (${(tl.start - tl.end).toLocaleString('es')} bajas frente a ${(tw.start - tw.end).toLocaleString('es')}).`;
  chron(g, kw.id, 'batalla', txt, true);
  if (kw.id === g.playerId) g.stats.battlesWon++; if (kl.id === g.playerId) g.stats.battlesLost++;
  if (kw.id === g.playerId || kl.id === g.playerId) { alert(g, kw.id === g.playerId ? 'importante' : 'critica', txt, { prov: b.prov }); } else alert(g, 'internacional', txt);
  g.battleReports.unshift(rep); if (g.battleReports.length > 30) g.battleReports.length = 30;
  return rep;
}

function succession(w: World, g: GameState) {
  const r = rngOf(g); const d = dateOf(g.turn);
  for (const k of g.kingdoms) {
    if (!k.alive) continue; const ru = k.ruler;
    if (d.m === 0) { ru.age++; if (k.heir) k.heir.age++; for (const c of Object.values(k.council)) c.age++; if (k.regency && k.ruler.age >= 16) { k.regency = false; chron(g, k.id, 'monarca', `${ru.name} alcanza la mayoría de edad y gobierna sin regente.`, true); } }
    const p = ru.age > 40 ? Math.pow(ru.age - 40, 2) * 0.000018 + 0.0006 : 0.0004; const lifeMult = SPECIES[ru.species].longevidad;
    if (r.next() < p / lifeMult * (ru.health < 50 ? 2 : 1)) {
      const old = ru.name; const heir = k.heir;
      if (heir) { k.ruler = heir; k.heir = null; k.regency = heir.age < 16; k.legitimacy = Math.max(10, k.legitimacy - (k.regency ? 15 : 5)); chron(g, k.id, 'monarca', `Muere ${old}. ${heir.name} hereda la corona de ${k.name}${k.regency ? ' bajo regencia' : ''}.`, true); }
      else { const sp = pickSpecies(r, g.provinces[k.capital].species); k.ruler = makeCharacter(g, r, sp, r.int(25, 50)); k.legitimacy = Math.max(5, k.legitimacy - 30); for (const q of g.provinces) if (q.owner === k.id) q.unrest += 6; chron(g, k.id, 'monarca', `Muere ${old} sin heredero. Crisis sucesoria: ${k.ruler.name} se impone tras disputas en la corte.`, true); }
      if (k.id === g.playerId) { alert(g, 'critica', `Ha muerto ${old}. ${k.ruler.name} reina ahora en ${k.name}.`); g.stats.rulers.push(k.ruler.name); }
      else alert(g, 'internacional', `Muere ${old}, monarca de ${k.name}.`);
    }
    if (!k.heir && !k.independent && k.ruler.age >= 18 && k.ruler.age < 55 && r.next() < 0.02) { k.heir = makeCharacter(g, r, k.ruler.species, 0); k.heir.name = k.heir.name.split(' ')[0] + ' ' + k.ruler.name.split(' ').slice(1).join(' '); if (k.id === g.playerId) { chron(g, k.id, 'monarca', `Nace ${k.heir.name}, heredero de la corona.`, true); alert(g, 'importante', `¡Nace un heredero: ${k.heir.name}!`); } }
    k.legitimacy = Math.min(100, k.legitimacy + 0.15);
  }
  saveRng(g, r);
}
function secessions(w: World, g: GameState) {
  for (const p of g.provinces) {
    if (p.owner < 0 || p.lowStabMonths < 9 || p.id === g.kingdoms[p.owner].capital) continue;
    const old = g.kingdoms[p.owner]; const s = w.provinces[p.id]; const r = rngOf(g);
    const k: Kingdom = { ...JSON.parse(JSON.stringify(old)), id: g.kingdoms.length, name: 'Rebeldes de ' + s.name, short: s.name.split(' ').slice(-1)[0], color: '#6d6d5a', color2: '#e3e0cf', type: 'independiente', independent: true, personality: 'aislacionista', capital: p.id, heir: null, regency: false, alive: true, warExhaustion: 0, techs: old.techs.slice(), research: { current: null, progress: 0 }, stock: { oro: 50, alimentos: 60, madera: 30, piedra: 30, hierro: 5, herramientas: 5, armas: 20, investigacion: 0, prestigio: 0 }, dynasty: 'Junta rebelde', aiTimer: 3 };
    k.ruler = makeCharacter(g, r, pickSpecies(r, p.species), r.int(25, 50)); k.council = old.council; saveRng(g, r);
    g.kingdoms.push(k); p.owner = k.id; p.occupier = -1; p.lowStabMonths = 0; p.stability = 45; p.unrest = 0;
    for (const o of g.kingdoms) { if (o.id === k.id) continue; g.relations[relKey(o.id, k.id)] = { a: Math.min(o.id, k.id), b: Math.max(o.id, k.id), contact: o.id === old.id, opinion: o.id === old.id ? -60 : 0, trust: 30, tension: o.id === old.id ? 80 : 10, alliance: false, nap: false, trade: false, mapsShared: false, war: o.id === old.id, warStart: g.turn, warScore: 0, giftBonus: 0, lastProposal: -99, protectorate: -1 }; }
    chron(g, k.id, 'rebelion', `${s.name} se alza contra ${old.name} y proclama su independencia.`, true);
    if (old.id === g.playerId) alert(g, 'critica', `¡${s.name} se ha rebelado y declara su independencia!`, { prov: p.id }); else alert(g, 'internacional', `${s.name} se rebela contra ${old.short}.`);
  }
}
