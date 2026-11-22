import { newGame } from '../src/engine/game';
import { endTurn, applyBattle } from '../src/engine/turn';
import { autoResolve } from '../src/engine/battle';
import { kingdomEconomy } from '../src/engine/economy';
import { validate, serialize, migrate } from '../src/engine/save';
import { generateWorld } from '../src/engine/world';
const t0 = Date.now();
const { w, g } = newGame({ seed: 1347, player: 0, difficulty: 1 });
console.log('newGame ms', Date.now() - t0, 'kingdoms', g.kingdoms.length, 'armies', g.armies.length);
const pk = g.kingdoms[0]; const e = kingdomEconomy(w, g, 0); console.log('player net', JSON.stringify(Object.fromEntries(Object.entries(e.net).map(([k, v]) => [k, +v.toFixed(1)]))));
console.log('player provs', g.provinces.filter(p => p.owner === 0).length, 'known', pk.known.filter(x => x >= 2).length, 'charted', pk.known.filter(x => x === 1).length);
const t1 = Date.now();
for (let i = 0; i < 120; i++) { const r = endTurn(w, g); while (g.pendingBattles.length) { const b = g.pendingBattles.shift(); autoResolve(b); applyBattle(w, g, b); } g.events = []; }
console.log('120 turns ms', Date.now() - t1);
for (const k of g.kingdoms.filter(k => !k.independent)) console.log(k.short.padEnd(12), k.alive ? 'vivo' : 'MUERTO', 'provs', g.provinces.filter(p => p.owner === k.id).length, 'oro', Math.round(k.stock.oro), 'alim', Math.round(k.stock.alimentos), 'techs', k.techs.length, 'men', g.armies.filter(a => a.owner === k.id).reduce((s, a) => s + a.units.reduce((x, u) => x + u.men, 0), 0));
console.log('wars', Object.values(g.relations).filter(r => r.war).length, 'trade', Object.values(g.relations).filter(r => r.trade).length, 'alliances', Object.values(g.relations).filter(r => r.alliance).length);
console.log('battles', g.battleReports.length, 'expeditions', g.expeditions.length, g.expeditions.map(e => e.state + ':' + e.discovered).join(' '));
console.log('chronicle', g.chronicle.length); console.log(g.chronicle.filter(c => c.important).slice(-12).map(c => c.turn + ' ' + c.text).join('\n'));
if (g.battleReports[0]) { const b = g.battleReports[0]; console.log('battle', b.field, b.phases, JSON.stringify(b.sides.map((s: any) => [s.name, s.start, s.end, s.killed, s.wounded, s.captured]))); }
const s = serialize(g); console.log('save size KB', Math.round(s.length / 1024));
const g2 = migrate(JSON.parse(s)); const w2 = generateWorld(g2.seed); console.log('validate', validate(g2, w2));
// determinismo
const A = newGame({ seed: 1347, player: 0, difficulty: 1 }), B = newGame({ seed: 1347, player: 0, difficulty: 1 });
for (let i = 0; i < 24; i++) { for (const X of [A, B]) { endTurn(X.w, X.g); while (X.g.pendingBattles.length) { const b = X.g.pendingBattles.shift(); autoResolve(b); applyBattle(X.w, X.g, b); } X.g.events = []; } }
console.log('reproducible', serialize(A.g) === serialize(B.g));
// ampliación militar: composición de los ejércitos de la IA, regimientos y migración de partidas v1
const types: Record<string, number> = {}; for (const a of g.armies) for (const u of a.units) types[u.type] = (types[u.type] || 0) + u.men;
console.log('tipos en servicio', JSON.stringify(types));
console.log('regimientos', g.regiments.length, 'activos', g.regiments.filter(r => r.active).length, 'con batallas', g.regiments.filter(r => r.battles > 0).length);
const v1 = JSON.parse(s); v1.version = 1; delete v1.regiments; for (const a of v1.armies) for (const u of a.units) { delete u.tier; delete u.rid; delete u.train; delete u.amm; }
const m1 = migrate(v1); console.log('migración v1→v2', m1.version, 'regimientos', m1.regiments.length, 'unidades sin regimiento', m1.armies.flatMap(a => a.units).filter(u => u.rid == null).length, 'validate', validate(m1, w2));
