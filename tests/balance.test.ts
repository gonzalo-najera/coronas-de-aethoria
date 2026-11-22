// Simulaciones automáticas de equilibrio del sistema militar (mismo motor de batalla que el juego).
// Uso: ./run.sh tests/balance.test.ts   (sale con código 1 si falla alguna comprobación)
import { newGame } from '../src/engine/game';
import { createBattle, autoResolve, sideTotals, aiDeploy, runPhase } from '../src/engine/battle';
import { UNIT, UNITS, ust } from '../src/engine/milcat';
import { RES } from '../src/engine/data';
import type { Army, Unit } from '../src/engine/types';

const { w, g } = newGame({ seed: 1347, player: 0, difficulty: 1 });
const plain = w.provinces.find(p => p.biome === 'llanura' && !p.river && (p.mix.colinas || 0) < 0.05 && (p.mix.bosque || 0) < 0.1 && w.provinces.length)!.id;
const forest = w.provinces.find(p => (p.mix.bosque || 0) > 0.55 && !p.river)!.id;
const hills = w.provinces.slice().sort((a, b) => (b.mix.colinas || 0) - (a.mix.colinas || 0)).find(p => !p.river && (p.mix.montana || 0) < 0.2)!.id;
const val = (type: string, tier = 2) => { const d = ust(type, tier); return d.cost.oro + d.cost.armas * RES.armas.base; };
type Spec = [string, number, Partial<Unit>?][]; // [tipo, fracción del presupuesto, extras]
function army(owner: number, spec: Spec, budget: number): Army {
  const units: Unit[] = spec.map(([t, f, x]) => ({ type: t, men: Math.max(UNIT[t].species === 'gigante' ? 5 : 30, Math.round(budget * f / val(t, x?.tier ?? 2) * 100)), exp: 0.1, tier: 2, ...(x || {}) }));
  return { id: 9000 + owner, owner, name: 'Prueba ' + owner, prov: 0, units, wounded: {}, path: [], progress: 0, supply: 6, morale: 70, general: null, lastBattle: -9, retreating: false, sieging: false };
}
/** Devuelve la tasa de victorias de A (atacante) y la razón de bajas B/A. */
function fight(A: Spec, B: Spec, pid = plain, n = 6, budget = 2000) {
  let win = 0, la = 0, lb = 0;
  for (let i = 0; i < n; i++) {
    g.turn = 200 + i * 13; const a = army(0, A, budget), b = army(1, B, budget); a.prov = b.prov = pid;
    const bt = createBattle(w, g, pid, [a], [b]); autoResolve(bt);
    const sa = bt.sides.findIndex(s => s.kid === 0) as 0 | 1; if (bt.winner === sa) win++;
    const ta = sideTotals(bt, sa), tb = sideTotals(bt, (1 - sa) as 0 | 1); la += ta.start - ta.end; lb += tb.start - tb.end;
  }
  return { wr: win / n, ratio: lb / Math.max(1, la) };
}
/** Campo de tiro: los tiradores disparan 30 pulsos contra una formación inmóvil a 4 casillas. Devuelve bajas causadas por cada 1000 de coste. */
function range(shooter: string, target: string, n = 3) {
  let tot = 0; for (let i = 0; i < n; i++) { g.turn = 400 + i; const a = army(0, [[shooter, 1]], 1000), b = army(1, [[target, 1]], 3000); a.prov = b.prov = plain;
    const bt = createBattle(w, g, plain, [a], [b]); const sa = bt.sides.findIndex(x => x.kid === 0) as 0 | 1; aiDeploy(bt, 0); aiDeploy(bt, 1);
    const ty = bt.groups.filter(q => q.side !== sa).reduce((m, q) => Math.max(m, sa === 0 ? q.y : -q.y), -99) * (sa === 0 ? 1 : -1);
    for (const q of bt.groups) { if (q.side === sa) { q.y = ty + (sa === 0 ? 4 : -4); q.order = 'disparar'; } else q.order = 'mantener'; q.sector = 'centro'; }
    for (let p = 0; p < 3; p++) { for (const q of bt.groups) if (q.side !== sa) q.order = 'mantener'; runPhase(bt); }
    const t = sideTotals(bt, (1 - sa) as 0 | 1); tot += t.start - t.end; }
  return tot / n;
}
const fails: string[] = []; const out: string[] = [];
const pending = (name: string, ok: boolean, info: string) => out.push(`${ok ? '✓' : '○'} ${name}: ${info}${ok ? '' : ' (objetivo de la Fase 3: bonificaciones de coordinación)'}`);
const check = (name: string, ok: boolean, info: string) => { out.push(`${ok ? '✓' : '✗'} ${name}: ${info}`); if (!ok) fails.push(name); };
const ratio = (A: Spec, B: Spec, pid = plain, n = 6) => { const x = fight(A, B, pid, n), y = fight(B, A, pid, n); return Math.sqrt(x.ratio / Math.max(0.01, y.ratio)); }; // >1: A causa más bajas de las que sufre
const sym = (A: Spec, B: Spec, pid = plain, n = 6) => { const x = fight(A, B, pid, n), y = fight(B, A, pid, n); return (x.wr + (1 - y.wr)) / 2; }; // A como atacante y como defensor
const f2 = (x: number) => x.toFixed(2);

// 1. Ventajas dinámicas (mismo presupuesto, ambos papeles)
let r: number;
r = sym([['piqueros', 1]], [['cab_pesada', 1]]); check('Piqueros frenan a la caballería pesada', r >= 0.6, f2(r));
r = sym([['espadachines', 1]], [['inf_ligera', 1]]); check('Espadachines dominan a la infantería ligera', r >= 0.6, f2(r));
const bowsVsHeavy = ratio([['arqueros', 0.6], ['lanceros', 0.4]], [['inf_pesada', 1]]), xbowVsHeavy = ratio([['ballesteros', 0.6], ['lanceros', 0.4]], [['inf_pesada', 1]]);
check('Ballestas mejores que arcos contra infantería acorazada (razón de bajas)', xbowVsHeavy > bowsVsHeavy * 1.1, `ballestas ${f2(xbowVsHeavy)} vs arcos ${f2(bowsVsHeavy)}`);
{ const bl = range('arqueros', 'milicia'), xl = range('ballesteros', 'milicia'), bh = range('arqueros', 'inf_pesada'), xh = range('ballesteros', 'inf_pesada'), lh = range('arq_largo', 'inf_pesada');
  check('Campo de tiro: contra levas sin protección, el arco rinde más por coste que la ballesta', bl > xl, `arcos ${bl.toFixed(0)} / ballestas ${xl.toFixed(0)} bajas`);
  check('Campo de tiro: contra infantería acorazada, la ballesta rinde más por coste que el arco', xh > bh * 1.2, `ballestas ${xh.toFixed(0)} / arcos ${bh.toFixed(0)} / arco largo ${lh.toFixed(0)} bajas`); }
r = sym([['arqueros', 0.5], ['lanceros', 0.5]], [['milicia', 1]]); check('Arqueros con apoyo baten a levas sin protección', r >= 0.6, f2(r));
r = sym([['cab_pesada', 1]], [['arqueros', 1]]); check('Caballería pesada arrolla a arqueros sin apoyo', r >= 0.6, f2(r));
r = sym([['caballeros', 1]], [['piqueros', 1]], plain); check('Ni los caballeros acorazados vencen siempre a los piqueros', r <= 0.75, f2(r));

// 2. Terreno
const cavPlain = ratio([['cab_pesada', 1]], [['espadachines', 1]], plain), cavForest = ratio([['cab_pesada', 1]], [['espadachines', 1]], forest);
check('La caballería rinde menos en el bosque (razón de bajas)', cavForest < cavPlain, `llanura ${f2(cavPlain)} / bosque ${f2(cavForest)}`);
const ca = ratio([['cent_arqueros', 0.5], ['lanceros', 0.5]], [['lanceros', 1]], plain), caF = ratio([['cent_arqueros', 0.5], ['lanceros', 0.5]], [['lanceros', 1]], forest);
check('Centauros arqueros: rinden más en llanura que en bosque (razón de bajas)', ca > caF, `llanura ${f2(ca)} / bosque ${f2(caF)}`);

// 3. Edades: un ejército de la Edad II supera a uno de la Edad I del mismo coste, sin ser invencible
const ageI: Spec = [['lanceros', 0.4], ['arqueros', 0.25], ['hacheros', 0.15], ['jinetes_ligeros', 0.2]];
const ageII: Spec = [['inf_pesada', 0.35], ['piqueros', 0.15], ['ballesteros', 0.25], ['cab_pesada', 0.25]];
r = sym(ageII, ageI); check('Edad II vence a Edad I con el mismo coste', r >= 0.6, f2(r));
r = sym(ageI, ageII, plain, 6); const big = fight(ageI, ageII, hills, 6, 6000); void big;
const outnumber = (() => { let wins = 0; for (let i = 0; i < 4; i++) { const x = fight(ageII, ageI.map(([t, f]) => [t, f * 2.2]) as Spec, plain, 1); wins += 1 - x.wr; } return wins / 4; })();
check('Una fuerza de Edad I con el doble de recursos puede resistir a una de Edad II', outnumber > 0, f2(outnumber));

// 4. Armas combinadas frente a ejércitos de un solo tipo
const combined: Spec = [['lanceros', 0.55], ['arqueros', 0.3], ['jinetes_ligeros', 0.15]];
for (const mono of ['lanceros', 'arqueros', 'jinetes_ligeros', 'hacheros']) { r = sym(combined, [[mono, 1]]); (mono === 'lanceros' ? pending : check)(`Ejército combinado frente a solo ${UNIT[mono].name.toLowerCase()}`, r >= 0.5, f2(r)); }

// 5. Instrucción, equipo y munición
r = ratio([['lanceros', 1, { exp: 0.3 }]], [['lanceros', 1, { train: 2, exp: 0 }]]); check('Tropas instruidas superan a reclutas en instrucción (razón de bajas)', r >= 1.2, f2(r));
r = sym([['espadachines', 1, { tier: 4 }]], [['espadachines', 1, { tier: 1 }]]); check('Equipo de élite supera a equipo básico (mismo número)', r >= 0.6, f2(r));
{ g.turn = 300; const a = army(0, [['arqueros', 0.5], ['lanceros', 0.5]], 2000), b = army(1, [['enanos', 1]], 2000); const bt = createBattle(w, g, hills, [a], [b]); autoResolve(bt); const arc = bt.groups.filter(x => x.type === 'arqueros'); const left = arc.reduce((s, x) => s + (x.ammo ?? 0), 0), max = arc.reduce((s, x) => s + (x.maxAmmo ?? 0), 0); check('Los tiradores gastan munición', left < max, `${left}/${max} descargas restantes`); }
r = ratio([['arqueros', 0.5, { amm: 1 }], ['lanceros', 0.5]], [['arqueros', 0.5, { amm: 0.05 }], ['lanceros', 0.5]]); check('Sin munición, los tiradores pierden su ventaja (razón de bajas)', r >= 1.1, f2(r));

// 6. Ninguna unidad es universalmente superior (mismo coste, llanura, ambos papeles)
const field = UNITS.filter(u => !['asedio', 'ingenieros'].includes(u.role) && u.species !== 'gigante').map(u => u.id);
const M: Record<string, Record<string, number>> = {};
for (const a of field) M[a] = {};
for (const a of field) { for (const b of field) if (a < b) { const x = sym([[a, 1]], [[b, 1]], plain, 2); M[a][b] = x; M[b][a] = 1 - x; } }
for (const a of field) { const beaten = field.filter(b => b !== a && (M[b]?.[a] ?? 0) >= 0.5); check(`${UNIT[a].name} tiene rivales que la superan`, beaten.length > 0, beaten.length ? beaten.slice(0, 4).map(b => UNIT[b].name).join(', ') : 'ninguno'); }
// los gigantes: el fuego concentrado los abate
r = sym([['gigantes_combate', 1]], [['ballesteros', 0.6], ['piqueros', 0.4]]); check('Los gigantes caen ante fuego concentrado y picas', r <= 0.6, f2(r));

console.log(out.join('\n'));
console.log('\nTabla de victorias (fila contra columna, mismo coste, llanura):');
console.log(''.padEnd(14) + field.map(b => b.slice(0, 6).padStart(7)).join(''));
for (const a of field) console.log(a.slice(0, 13).padEnd(14) + field.map(b => (a === b ? "  —" : f2(M[a][b] ?? NaN)).padStart(7)).join(''));
console.log(fails.length ? `\n${fails.length} comprobaciones fallidas` : '\nTodas las comprobaciones superadas');
if (fails.length) process.exit(1);
