// Ventanas: reino, economía, tecnología, ejército, exploración, diplomacia, crónicas, partida, eventos e informes.
import type { ResId, Kingdom } from '../engine/types';
import { RES, TRADEABLE, TECHS, TECH, UNIT, LAWS, SPECIES, BIOMES, PERSONALITY_NAMES, TYPE_NAMES, BUILDINGS } from '../engine/data';
import { playerK, dateStr, rel, kprovs, armyMen, totalPop, knowLevel } from '../engine/game';
import { storageCap, marketPrice, trade, techCost, sum, isSupplied } from '../engine/economy';
import { attitude, available, evaluate, propose, declareWar, PROP_NAMES, PropKind, power, warsOf } from '../engine/diplomacy';
import { EXP_KINDS, ExpPlan, expCost, expCheck, launchExpedition, explorers } from '../engine/exploration';
import { resolveEvent } from '../engine/events';
import { saveGame, listSaves, loadGame, deleteSave, serialize, importGame, SaveMeta } from '../engine/save';
import { UI, act, $, esc, fmt, sgn, big, bd, bar, toast, HOOK, ask, showText } from './util';
import { portrait, heraldry } from './art';
import { charLine } from './panels';
import { getEco } from './app';

const TITLES: Record<string, string> = { reino: 'Reino', economia: 'Economía', tecnologia: 'Tecnología', ejercito: 'Ejército', exploracion: 'Exploración', diplomacia: 'Diplomacia', cronicas: 'Crónicas', partida: 'Partida', evento: 'Asuntos de Estado', exprep: 'Informe de expedición', chips: 'Indicadores visibles' };
export function openModal(m: string, arg: any = null) { UI.modalArg = arg ?? (UI.modal === m ? UI.modalArg : null); UI.modal = m; if (m === 'partida') refreshSaves(); renderModal(); document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.m === m)); }
export function closeModal() { if (UI.modal === 'exprep') UI.g!.expReports = []; UI.modal = null; UI.modalArg = null; const m = $('#modal'); m.hidden = true; m.innerHTML = ''; document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.m === 'atlas')); }
act('modal', d => { if (d.m === 'atlas') closeModal(); else openModal(d.m!, d.arg != null ? +d.arg : null); });
act('closemodal', () => closeModal());
export function renderModal() {
  const m = UI.modal; if (!m || !UI.g) return; const el = $('#modal'); el.hidden = false;
  const fn = BODY[m]; if (!fn) return; const sc = el.querySelector('.mbody')?.scrollTop || 0;
  el.innerHTML = `<div class="mwin ${m}"><header><h2>${TITLES[m]}</h2><button class="icon" data-act="closemodal" title="Cerrar (Esc)">×</button></header><div class="mbody">${fn()}</div></div>`;
  const mb = el.querySelector('.mbody'); if (mb) mb.scrollTop = sc;
}
const BODY: Record<string, () => string> = {};

// ---------- reino ----------
function advice(): { who: string; text: string }[] {
  const g = UI.g!, w = UI.w!; const k = playerK(g); const e = getEco(); const out: { who: string; text: string }[] = [];
  const name = (r: string) => k.council[r]?.name.split(' ')[0] || '—';
  if (e.net.oro < 0) out.push({ who: `Tesorero ${name('tesorero')}`, text: `Las arcas pierden ${fmt(-e.net.oro, 1)} de oro al mes${k.stock.oro > 0 ? `; quedan ≈${Math.floor(k.stock.oro / -e.net.oro)} meses` : ''}. Reducid tropas o construid mercados.` });
  else if (k.stock.oro > 500) out.push({ who: `Tesorero ${name('tesorero')}`, text: `Disponemos de ${fmt(k.stock.oro)} de oro ociosos. Invertidlos en edificios productivos.` });
  if (e.net.alimentos < 0) out.push({ who: `Tesorero ${name('tesorero')}`, text: `El reino consume más alimentos de los que produce (${sgn(e.net.alimentos)}/mes). Granjas, molinos o compras en el mercado.` });
  if (e.net.herramientas < 0 && k.stock.herramientas < 30) out.push({ who: `Tesorero ${name('tesorero')}`, text: 'Las herramientas escasean y la producción caerá. Una herrería con hierro lo resolvería.' });
  const wars = warsOf(g, k.id).filter(x => g.kingdoms[x].alive);
  if (wars.length) { const mine = power(g, k.id); for (const x of wars) { const r = mine / Math.max(1, power(g, x)); out.push({ who: `Mariscal ${name('mariscal')}`, text: `Guerra con ${g.kingdoms[x].short}: nuestra fuerza estimada es ${r > 1.2 ? 'superior' : r < 0.8 ? 'inferior' : 'similar'} (${r.toFixed(2)}×).${r < 0.8 ? ' Conviene buscar la paz o aliados.' : ''}` }); } }
  const unsup = g.armies.filter(a => a.owner === k.id && !isSupplied(w, g, a)); if (unsup.length) out.push({ who: `Mariscal ${name('mariscal')}`, text: `${unsup.length} ejército(s) sin línea de suministro: vigilad sus reservas.` });
  if (!g.armies.some(a => a.owner === k.id)) out.push({ who: `Mariscal ${name('mariscal')}`, text: 'No tenemos ningún ejército en pie.' });
  let best: Kingdom | null = null, bo = -1e9; for (const o of g.kingdoms) { if (o.id === k.id || !o.alive) continue; const r = rel(g, k.id, o.id); if (!r?.contact || r.war || r.trade) continue; if (r.opinion > bo) { bo = r.opinion; best = o; } }
  if (best) out.push({ who: `Canciller ${name('canciller')}`, text: `${best.name} nos ve con buenos ojos (opinión ${Math.round(bo)}). Un acuerdo comercial sería bien recibido.` });
  const unknown = k.known.filter(v => v === 0).length; const active = g.expeditions.filter(x => x.owner === k.id && (x.state === 'activa' || x.state === 'regreso')).length;
  out.push({ who: `Explorador ${name('explorador')}`, text: `Desconocemos ${unknown} de ${k.known.length} regiones del mundo. ${active ? `Hay ${active} expedición(es) en marcha.` : 'Ninguna expedición está en marcha.'}` });
  if (!k.research.current) out.push({ who: 'Corte', text: 'No hay ningún proyecto de investigación en curso.' });
  return out;
}
BODY.reino = () => {
  const g = UI.g!; const k = playerK(g); const r = k.ruler;
  const person = (c: any, role: string, crown = false) => `<div class="person card">${portrait(c, 72, crown)}<div><small class="muted">${role}</small><br><b>${esc(c.name)}</b><br><small>${SPECIES[c.species as keyof typeof SPECIES].name}, ${c.age} años · salud ${Math.round(c.health)} · ${esc(c.trait)}</small>${charLine(c)}${c.loyalty != null && role !== 'Monarca' && role !== 'Heredero' ? `<small>Lealtad ${Math.round(c.loyalty)} · Ambición ${Math.round(c.ambition)}</small>` : ''}</div></div>`;
  const laws = (Object.keys(LAWS) as (keyof typeof LAWS)[]).map(id => { const L = LAWS[id]; return `<div class="law"><b>${L.name}</b><div class="seg">${L.levels.map((n, i) => { const dis = id === 'integracion' && i === 2 && !k.techs.includes('administracion'); return `<button class="${k.laws[id] === i ? 'on' : ''}" data-act="law" data-l="${id}" data-v="${i}" ${dis ? 'disabled title="Requiere Administración"' : ''}>${n}</button>`; }).join('')}</div><small>${esc(L.desc[k.laws[id]])}</small></div>`; }).join('');
  return `<div class="grid2"><div>
    <div class="hero">${heraldry(k, 64)}<div><h3>${esc(k.name)}</h3><p>${TYPE_NAMES[k.type]} · Dinastía ${esc(k.dynasty)} · capital ${esc(g.provinces[k.capital].cityName)}</p><p>Legitimidad ${Math.round(k.legitimacy)} ${bar(k.legitimacy)} · Prestigio ${fmt(k.stock.prestigio)} · Cansancio de guerra ${Math.round(k.warExhaustion)}</p></div></div>
    ${person(r, 'Monarca', true)}${k.regency ? '<p class="neg small">Regencia: el monarca es menor de edad.</p>' : ''}
    ${k.heir ? person(k.heir, 'Heredero') : '<p class="muted small">Sin heredero designado: una muerte del monarca abriría una crisis sucesoria.</p>'}
    <h3>Leyes</h3>${laws}
  </div><div>
    <h3>Consejo</h3>${Object.entries(k.council).map(([role, c]) => person(c, ({ canciller: 'Canciller (diplomacia)', mariscal: 'Mariscal (ejército)', tesorero: 'Tesorero (economía)', explorador: 'Explorador mayor' } as any)[role] || role)).join('')}
    <h3>Recomendaciones del consejo</h3><ul class="advice">${advice().map(a => `<li><b>${esc(a.who)}:</b> ${esc(a.text)}</li>`).join('')}</ul>
  </div></div>`;
};
act('law', d => { const k = playerK(UI.g!); (k.laws as any)[d.l!] = +d.v!; toast('Ley actualizada. Sus efectos se aplican desde ya.'); HOOK.refresh(); });

// ---------- economía ----------
function chart(key: 'oro' | 'alimentos' | 'pop' | 'investigacion', label: string, color: string) {
  const h = UI.g!.history.slice(-120); if (h.length < 2) return `<div class="chart"><b>${label}</b><p class="muted small">Se necesitan al menos dos meses de historia.</p></div>`;
  const v = h.map(x => x[key]); const mn = Math.min(...v), mx = Math.max(...v); const W = 300, H = 90; const sx = (i: number) => 30 + i / (h.length - 1) * (W - 36); const sy = (x: number) => H - 14 - (mx === mn ? 0.5 : (x - mn) / (mx - mn)) * (H - 24);
  return `<div class="chart"><b>${label}</b><svg viewBox="0 0 ${W} ${H}"><line x1="30" y1="${H - 14}" x2="${W - 6}" y2="${H - 14}" class="axis"/><text x="26" y="${sy(mx) + 4}" class="t" text-anchor="end">${big(mx)}</text><text x="26" y="${sy(mn) + 4}" class="t" text-anchor="end">${big(mn)}</text><text x="30" y="${H - 2}" class="t">${dateStr(h[0].turn).split(',')[1]}</text><text x="${W - 6}" y="${H - 2}" class="t" text-anchor="end">${dateStr(h[h.length - 1].turn).split(',')[1]}</text><polyline fill="none" stroke="${color}" stroke-width="2" points="${h.map((x, i) => sx(i).toFixed(1) + ',' + sy(x[key]).toFixed(1)).join(' ')}"/></svg></div>`;
}
BODY.economia = () => {
  const g = UI.g!, w = UI.w!; const k = playerK(g); const e = getEco(); const cap = storageCap(g, k.id);
  const res = (Object.keys(RES) as ResId[]);
  const rows = res.map(r => `<tr data-tip="res" data-r="${r}"><td>${RES[r].icon} ${RES[r].name}</td><td>${fmt(k.stock[r])}</td><td>${cap[r] < 99999 ? fmt(cap[r]) : '—'}</td><td class="pos">${sgn(sum(e.prod[r]))}</td><td class="neg">${fmt(-Math.abs(sum(e.cons[r])), 1)}</td><td class="${e.net[r] < 0 ? 'neg' : 'pos'}"><b>${sgn(e.net[r])}</b></td><td>${e.net[r] < 0 && k.stock[r] > 0 && r !== 'prestigio' ? Math.floor(k.stock[r] / -e.net[r]) + ' meses' : e.net[r] >= 0 ? 'estable' : '—'}</td></tr>`).join('');
  const provRows = e.byProv.slice().sort((a, b) => b.prod.oro - a.prod.oro).map(p => `<tr class="clickable" data-act="focus" data-prov="${p.pid}"><td>${esc(w.provinces[p.pid].name)}</td>${(['oro', 'alimentos', 'madera', 'piedra', 'hierro', 'investigacion'] as ResId[]).map(r => `<td class="${p.prod[r] - p.cons[r] < 0 ? 'neg' : ''}">${sgn(p.prod[r] - p.cons[r])}</td>`).join('')}</tr>`).join('');
  const market = TRADEABLE.map(r => { const buy = marketPrice(w, g, k.id, r, true), sell = marketPrice(w, g, k.id, r, false);
    return `<tr><td>${RES[r].icon} ${RES[r].name}</td><td>${fmt(k.stock[r])}</td><td>${buy.toFixed(2)}</td><td>${sell.toFixed(2)}</td><td class="nowrap">${[10, 50].map(q => `<button class="mini" data-act="trade" data-r="${r}" data-q="${q}" ${k.stock.oro < q * buy ? 'disabled' : ''}>+${q}</button>`).join('')}${[10, 50].map(q => `<button class="mini" data-act="trade" data-r="${r}" data-q="${-q}" ${k.stock[r] < q ? 'disabled' : ''}>−${q}</button>`).join('')}</td>
    <td><input class="sm" type="number" min="0" placeholder="—" value="${k.market.min[r] ?? ''}" data-act-change="mkt" data-r="${r}" data-k="min"></td><td><input class="sm" type="number" min="0" placeholder="—" value="${k.market.max[r] ?? ''}" data-act-change="mkt" data-r="${r}" data-k="max"></td></tr>`; }).join('');
  return `<h3>Balance mensual</h3><p class="small muted">Pasa el ratón por una fila para ver el desglose completo. Todos los valores salen de la misma función que procesa el turno.</p>
  <table class="tbl"><tr><th>Recurso</th><th>Reservas</th><th>Capacidad</th><th>Producción</th><th>Consumo</th><th>Neto</th><th>Autonomía</th></tr>${rows}</table>
  <h3>Evolución</h3><div class="charts">${chart('oro', 'Oro', '#b8860b')}${chart('alimentos', 'Alimentos', '#5c8a3a')}${chart('pop', 'Población', '#7a4a2a')}${chart('investigacion', 'Investigación mensual', '#4a6a9a')}</div>
  <h3>Mercado</h3><p class="small">Los precios dependen de tus reservas, de los mercados y puertos, y de los acuerdos comerciales. Las órdenes automáticas compran por debajo del mínimo y venden por encima del máximo cada mes (si queda oro).</p>
  <table class="tbl"><tr><th>Bien</th><th>Reservas</th><th>Compra</th><th>Venta</th><th>Operar</th><th>Mín. auto</th><th>Máx. auto</th></tr>${market}</table>
  <h3>Por provincia (neto mensual)</h3><table class="tbl sm"><tr><th>Provincia</th><th>Oro</th><th>Alim.</th><th>Madera</th><th>Piedra</th><th>Hierro</th><th>Invest.</th></tr>${provRows}</table>`;
};
act('trade', d => { const g = UI.g!; if (trade(UI.w!, g, g.playerId, d.r as ResId, +d.q!)) HOOK.refresh(); else toast('Operación no posible.', 'critica'); });
act('mkt', (d, el) => { const k = playerK(UI.g!); const v = (el as HTMLInputElement).value; const m = (k.market as any)[d.k!]; if (v === '') delete m[d.r!]; else m[d.r!] = Math.max(0, +v); });

// ---------- tecnología ----------
BODY.tecnologia = () => {
  const g = UI.g!; const k = playerK(g); const sel = UI.modalArg && TECH[UI.modalArg] ? UI.modalArg : k.research.current || TECHS.find(t => !k.techs.includes(t.id) && t.req.every(r => k.techs.includes(r)))?.id;
  const maxC = Math.max(...TECHS.map(t => t.col)), maxR = Math.max(...TECHS.map(t => t.row)); const CW = 172, RH = 62, NW = 152, NH = 44; const Wd = (maxC + 1) * CW + 20, Hd = (maxR + 1) * RH + 20;
  const pos = (t: typeof TECHS[0]) => [10 + t.col * CW, 10 + t.row * RH];
  const lines = TECHS.flatMap(t => t.req.map(r => { const a = TECH[r]; if (!a) return ''; const [x1, y1] = pos(a), [x2, y2] = pos(t); return `<path d="M${x1 + NW} ${y1 + NH / 2} C ${x1 + NW + 20} ${y1 + NH / 2}, ${x2 - 20} ${y2 + NH / 2}, ${x2} ${y2 + NH / 2}" class="${k.techs.includes(r) ? 'ok' : ''}"/>`; })).join('');
  const nodes = TECHS.map(t => { const [x, y] = pos(t); const has = k.techs.includes(t.id); const av = !has && t.req.every(r => k.techs.includes(r)); const cur = k.research.current === t.id; const cls = has ? 'has' : cur ? 'cur' : av ? 'av' : 'lock';
    return `<g class="node ${cls} ${sel === t.id ? 'sel' : ''}" data-act="techsel" data-t="${t.id}"><rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="6"/><text x="${x + 8}" y="${y + 18}" class="n">${esc(t.name)}</text><text x="${x + 8}" y="${y + 34}" class="s">${has ? '✓ conocida' : cur ? `en curso ${Math.round(k.research.progress / techCost(k, t.id) * 100)}%` : esc(t.branch) + ' · ' + techCost(k, t.id)}</text>${cur ? `<rect x="${x}" y="${y + NH - 4}" width="${NW * Math.min(1, k.research.progress / techCost(k, t.id))}" height="4" class="prog"/>` : ''}</g>`; }).join('');
  const T = sel ? TECH[sel] : null; const e = getEco();
  let card = ''; if (T) { const has = k.techs.includes(T.id); const av = !has && T.req.every(r => k.techs.includes(r)); const cost = techCost(k, T.id); const months = e.net.investigacion > 0 ? Math.ceil(Math.max(0, cost - (k.research.current === T.id ? k.research.progress : 0)) / e.net.investigacion) : null;
    card = `<div class="techcard"><h3>${esc(T.name)}</h3><p class="small muted">${esc(T.branch)} · coste ${cost} de investigación${months != null && !has ? ` · ≈${months} meses al ritmo actual` : ''}</p><p>${esc(T.desc)}</p>${T.effects.length ? `<h4>Efectos</h4><ul>${T.effects.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${T.unlocks.length ? `<h4>Desbloquea</h4><ul>${T.unlocks.map(u => `<li><b>${esc(u.kind)}:</b> ${esc(u.name)}${u.ref && UNIT[u.ref] ? ' — ' + esc(UNIT[u.ref].desc) : u.ref && BUILDINGS.find(b => b.id === u.ref) ? ' — ' + esc(BUILDINGS.find(b => b.id === u.ref)!.effect) : ''}</li>`).join('')}</ul>` : ''}${T.req.length ? `<p class="small">Requiere: ${T.req.map(r => `<span class="${k.techs.includes(r) ? 'pos' : 'neg'}">${esc(TECH[r].name)}</span>`).join(', ')}</p>` : ''}
    ${has ? '<p class="pos">Ya conocida.</p>' : k.research.current === T.id ? `<p>En curso: ${fmt(k.research.progress)}/${cost}</p>` : `<button class="primary" data-act="research" data-t="${T.id}" ${av ? '' : 'disabled'}>${k.research.current ? 'Cambiar a este proyecto' : 'Investigar'}</button>${k.research.current && av ? '<p class="small neg">Cambiar de proyecto pierde la mitad del progreso actual.</p>' : ''}`}</div>`; }
  return `<p class="small">Investigación mensual: <b>${sgn(e.net.investigacion)}</b> (bibliotecas, universidades, especies sabias y el consejo). Proyecto actual: <b>${k.research.current ? esc(TECH[k.research.current].name) : 'ninguno'}</b>.</p>
  <div class="techwrap"><div class="techtree"><svg width="${Wd}" height="${Hd}">${lines}${nodes}</svg></div>${card}</div>`;
};
act('techsel', d => { UI.modalArg = d.t; renderModal(); });
act('research', d => { const k = playerK(UI.g!); if (k.research.current && k.research.current !== d.t) k.research.progress = Math.floor(k.research.progress / 2); else if (!k.research.current) k.research.progress = 0; k.research.current = d.t!; toast('Nuevo proyecto: ' + TECH[d.t!].name); HOOK.refresh(); });

// ---------- ejército ----------
BODY.ejercito = () => {
  const g = UI.g!, w = UI.w!; const k = playerK(g); const ar = g.armies.filter(a => a.owner === k.id); const e = getEco();
  const tot = ar.reduce((s, a) => s + armyMen(a), 0); const upk = (e.cons.oro || []).filter(x => /ej[ée]rcito|tropas|soldad/i.test(x.label)).reduce((s, x) => s + Math.abs(x.value), 0);
  const byType: Record<string, number> = {}; for (const a of ar) for (const u of a.units) byType[u.type] = (byType[u.type] || 0) + u.men;
  return `<p>${ar.length} ejército(s) · <b>${fmt(tot)}</b> soldados · ${fmt(kprovs(g, k.id).reduce((s, p) => s + p.mobilized, 0))} movilizados${upk ? ` · mantenimiento ≈${fmt(upk, 1)} oro/mes` : ''} · reserva de armas ${fmt(k.stock.armas)}</p>
  <table class="tbl"><tr><th>Ejército</th><th>Ubicación</th><th>Efectivos</th><th>Moral</th><th>Suministro</th><th>Estado</th></tr>${ar.map(a => `<tr class="clickable" data-act="focus" data-army="${a.id}"><td>${esc(a.name)}</td><td>${esc(w.provinces[a.prov].name)}</td><td>${fmt(armyMen(a))}</td><td>${Math.round(a.morale)}</td><td class="${isSupplied(w, g, a) ? 'pos' : 'neg'}">${isSupplied(w, g, a) ? 'Sí' : a.supply.toFixed(1) + ' m'}</td><td>${a.path.length ? 'En marcha → ' + esc(w.provinces[a.path[a.path.length - 1]].name) : g.provinces[a.prov].siege?.by === k.id ? 'Asediando' : 'Acampado'}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sin ejércitos. Recluta desde el panel de una provincia (pestaña Reclutar).</td></tr>'}</table>
  <h3>Tropas por tipo</h3><table class="tbl">${Object.entries(byType).map(([t, n]) => `<tr><td>${esc(UNIT[t].name)}</td><td>${fmt(n)}</td></tr>`).join('') || '<tr><td class="muted">—</td></tr>'}</table>
  <h3>Batallas recientes</h3>${battleList()}`;
};
function battleList() { const g = UI.g!; const reps = g.battleReports.filter(r => r.winner === g.playerId || r.loser === g.playerId); return reps.length ? `<ul>${reps.slice(0, 12).map(r => `<li><a data-act="breport" data-id="${r.id}">${dateStr(r.turn)} · ${esc(r.field)} — <b class="${r.winner === g.playerId ? 'pos' : 'neg'}">${r.winner === g.playerId ? 'victoria' : 'derrota'}</b></a></li>`).join('')}</ul>` : '<p class="muted small">Aún no has librado batallas.</p>'; }
act('breport', d => { openModal('cronicas', { tab: 'batallas', rep: +d.id! }); });

// ---------- exploración ----------
function plan(): ExpPlan { const g = UI.g!; const k = playerK(g); const a = UI.modalArg; if (a && a.plan) return a.plan; const p: ExpPlan = { start: k.capital, kind: 'terrestre', dir: 'N', members: 120, supplies: 8, escort: 40, risk: 1, leaderIdx: 0 }; UI.modalArg = { plan: p }; return p; }
BODY.exploracion = () => {
  const g = UI.g!, w = UI.w!; const k = playerK(g); const p = plan(); const cost = expCost(p); const why = expCheck(w, g, k.id, p); const exps = explorers(g, k);
  const starts = kprovs(g, k.id).filter(q => p.kind === 'terrestre' || q.buildings.puerto);
  if (!starts.some(q => q.id === p.start) && starts.length) p.start = starts[0].id;
  const list = g.expeditions.filter(e => e.owner === k.id).slice().reverse();
  const colonies = g.provinces.filter(q => q.colonizing && q.colonizing.by === k.id);
  const known = k.known.filter(v => v >= 2).length;
  return `<div class="grid2"><div><h3>Organizar una expedición</h3>
  <div class="form">
   <label>Tipo <select data-act-change="expf" data-f="kind">${Object.entries(EXP_KINDS).map(([id, n]) => `<option value="${id}" ${p.kind === id ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
   <label>Punto de partida <select data-act-change="expf" data-f="start">${starts.map(q => `<option value="${q.id}" ${p.start === q.id ? 'selected' : ''}>${esc(w.provinces[q.id].name)} (${esc(q.cityName)})</option>`).join('') || '<option>Ningún puerto disponible</option>'}</select></label>
   <label>Dirección <select data-act-change="expf" data-f="dir">${[['N', 'Norte'], ['S', 'Sur'], ['E', 'Este'], ['O', 'Oeste']].map(([v, n]) => `<option value="${v}" ${p.dir === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
   <label>Jefe <select data-act-change="expf" data-f="leaderIdx"><option value="0" ${p.leaderIdx === 0 ? 'selected' : ''}>${esc(exps[0]?.name || 'Explorador mayor')} (explorador mayor, inteligencia ${exps[0]?.inteligencia ?? '—'})</option><option value="1" ${p.leaderIdx === 1 ? 'selected' : ''}>Un aventurero local (desconocido)</option></select></label>
   <label>Miembros <input type="number" min="20" max="600" step="10" value="${p.members}" data-act-change="expf" data-f="members"></label>
   <label>Escolta armada <input type="number" min="0" max="500" step="10" value="${p.escort}" data-act-change="expf" data-f="escort"></label>
   <label>Suministros (meses) <input type="number" min="3" max="24" value="${p.supplies}" data-act-change="expf" data-f="supplies"></label>
   <label>Riesgo aceptado <select data-act-change="expf" data-f="risk">${['Prudente', 'Normal', 'Audaz'].map((n, i) => `<option value="${i}" ${p.risk === i ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  </div>
  <p>Coste: ◉ ${cost.oro} oro · ❦ ${cost.alimentos} alimentos · ${p.members} personas de ${esc(g.provinces[p.start]?.cityName || '')}</p>
  <p class="small muted">Más suministros = más alcance. Más escolta = menos pérdidas por hostilidades. Un riesgo audaz avanza más rápido pero sufre más incidentes. Las expediciones marítimas parten de un puerto; las oceánicas requieren Navegación oceánica.</p>
  ${why.length ? `<ul class="bad">${why.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  <div class="row"><input id="expname" placeholder="Nombre (opcional)"><button class="primary" data-act="launch" ${why.length ? 'disabled' : ''}>Partir</button></div>
  </div><div>
  <h3>Conocimiento del mundo</h3><p>${known} de ${k.known.length} provincias exploradas (${Math.round(known / k.known.length * 100)}%).</p>
  <h3>Expediciones</h3>${list.length ? `<table class="tbl sm">${list.map(e => `<tr class="clickable" data-act="${e.state === 'activa' || e.state === 'regreso' ? 'focus' : 'exprep1'}" data-exp="${e.id}" data-id="${e.id}"><td>${esc(e.name)}</td><td>${({ activa: 'Explorando', regreso: 'Regresando', terminada: 'Concluida', perdida: 'Perdida' })[e.state]}</td><td>${e.discovered} prov.</td><td>${e.members}/${e.startMembers}</td></tr>`).join('')}</table>` : '<p class="muted small">Ninguna todavía.</p>'}
  <h3>Fundaciones en curso</h3>${colonies.length ? `<ul>${colonies.map(q => `<li><a data-act="focus" data-prov="${q.id}">${esc(q.colonizing!.name)}</a> en ${esc(w.provinces[q.id].name)} — ${q.colonizing!.monthsLeft} meses</li>`).join('')}</ul>` : '<p class="muted small">Para fundar una colonia, selecciona una provincia explorada sin dueño y abre la pestaña Colonizar.</p>'}
  </div></div>`;
};
act('expf', (d, el) => { const p = plan(); const v = (el as HTMLInputElement).value; (p as any)[d.f!] = ['kind', 'dir'].includes(d.f!) ? v : +v; renderModal(); });
act('launch', () => { const g = UI.g!; const p = plan(); const name = ($<HTMLInputElement>('#expname').value || '').trim(); const e = launchExpedition(UI.w!, g, g.playerId, { ...p }, name || undefined); if (e) { toast(`${e.name} parte hacia lo desconocido.`); UI.atlas!.refresh(); HOOK.refresh(); } });
act('exprep1', d => { UI.g!.expReports = [+d.id!]; openModal('exprep'); });
BODY.exprep = () => {
  const g = UI.g!, w = UI.w!; const ids = g.expReports.length ? g.expReports : []; if (!ids.length) return '<p>No hay informes.</p>';
  return ids.map(id => { const e = g.expeditions.find(x => x.id === id); if (!e) return ''; return `<div class="person">${portrait(e.leader, 64)}<div><h3>${esc(e.name)}</h3><p>${e.state === 'perdida' ? '<b class="neg">La expedición se ha perdido.</b>' : `Regresa tras ${e.months} meses con ${e.members} de ${e.startMembers} miembros.`}</p></div></div>
  <div class="kv"><span>Provincias descubiertas</span><b>${e.discovered}</b><span>Mares cartografiados</span><b>${e.discoveredSeas}</b><span>Pérdidas</span><b>${e.losses}</b><span>Ruinas halladas</span><b>${e.ruinsFound}</b><span>Primeros contactos</span><b>${e.contacts.map(c => esc(g.kingdoms[c].name)).join(', ') || '—'}</b></div>
  ${e.found.length ? `<h4>Hallazgos</h4><ul>${e.found.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
  ${e.opportunities.length ? `<h4>Oportunidades de colonización</h4><ul class="links">${e.opportunities.map(p => `<li><a data-act="focus" data-prov="${p}">${esc(w.provinces[p].name)} (${BIOMES[w.provinces[p].biome].name.toLowerCase()})</a></li>`).join('')}</ul>` : ''}
  <h4>Diario de viaje</h4><ul class="log">${e.log.map(l => `<li><small>${dateStr(l.turn)}</small> ${esc(l.text)}</li>`).join('')}</ul>`; }).join('<hr>');
};

// ---------- diplomacia ----------
let dSel: number | null = null; let dEval: { k: number; p: string; e: any } | null = null;
BODY.diplomacia = () => {
  const g = UI.g!, w = UI.w!; const k = playerK(g); const ks = g.kingdoms.filter(o => o.alive && o.id !== k.id && rel(g, k.id, o.id)?.contact);
  const unknownN = g.kingdoms.filter(o => o.alive && o.id !== k.id && !rel(g, k.id, o.id)?.contact).length;
  if (typeof UI.modalArg === 'number') { dSel = UI.modalArg; UI.modalArg = null; }
  const sel = dSel != null && ks.some(o => o.id === dSel) ? dSel : ks[0]?.id;
  const list = ks.sort((a, b) => (a.independent ? 1 : 0) - (b.independent ? 1 : 0) || a.name.localeCompare(b.name)).map(o => { const r = rel(g, k.id, o.id); return `<tr class="clickable ${o.id === sel ? 'on' : ''}" data-act="dsel" data-k="${o.id}"><td>${heraldry(o, 22)}</td><td>${esc(o.name)}${o.independent ? ' <small class="muted">(independiente)</small>' : ''}</td><td class="${r.war ? 'neg' : r.opinion > 20 ? 'pos' : r.opinion < -10 ? 'neg' : ''}">${r.war ? 'GUERRA' : attitude(r.opinion)}</td><td>${[r.alliance && 'Alianza', r.nap && 'No agresión', r.trade && 'Comercio', r.mapsShared && 'Mapas', r.protectorate === k.id && 'Protectorado'].filter(Boolean).join(', ')}</td></tr>`; }).join('');
  let det = '<p class="muted">Aún no has establecido contacto con ningún reino.</p>';
  if (sel != null) {
    const o = g.kingdoms[sel]; const r = rel(g, k.id, o.id); const av = available(g, k.id, o.id); const ev = dEval;
    const pr = power(g, k.id) / Math.max(1, power(g, o.id)); const provs = kprovs(g, o.id).length;
    det = `<div class="hero">${heraldry(o, 56)}<div><h3>${esc(o.name)}</h3><p>${TYPE_NAMES[o.type]} · ${PERSONALITY_NAMES[o.personality]} · ${provs} provincias conocidas por nosotros: ${kprovs(g, o.id).filter(p => k.known[p.id] >= 2).length}</p></div></div>
    <div class="person">${portrait(o.ruler, 56, true)}<div><b>${esc(o.ruler.name)}</b><br><small>${SPECIES[o.ruler.species].name}, ${o.ruler.age} años · ${esc(o.ruler.trait)}</small></div></div>
    <div class="kv"><span>Opinión</span><b>${Math.round(r.opinion)} (${attitude(r.opinion)})</b><span>Confianza</span><b>${Math.round(r.trust)}</b><span>Tensión</span><b>${Math.round(r.tension)}</b><span>Poder relativo</span><b>${pr.toFixed(2)}× (estimación)</b>${r.war ? `<span>Guerra desde</span><b>${dateStr(r.warStart)} · puntuación ${r.warScore * (r.a === k.id ? 1 : -1)}</b>` : ''}</div>
    <h4>Propuestas</h4><div class="props">${av.map(a => `<div class="prop"><button data-act="dprop" data-k="${o.id}" data-p="${a.kind}" ${a.ok ? '' : 'disabled'} title="${esc(a.why || '')}">${PROP_NAMES[a.kind]}</button><button class="mini" data-act="deval" data-k="${o.id}" data-p="${a.kind}" ${a.ok ? '' : 'disabled'}>¿Aceptaría?</button>${a.kind === 'regalo' ? `<input type="number" class="sm" id="giftgold" value="50" min="25" step="25"> oro` : ''}${!a.ok && a.why ? `<small class="muted">${esc(a.why)}</small>` : ''}</div>`).join('') || '<p class="muted small">Sin propuestas disponibles.</p>'}</div>
    ${ev && ev.k === o.id ? `<div class="evalbox ${ev.e.accept ? 'good' : 'bad'}"><b>${PROP_NAMES[ev.p as PropKind]}: ${ev.e.accept ? 'probablemente aceptaría' : ev.e.blocked ? esc(ev.e.blocked) : 'probablemente rechazaría'}</b> (puntuación ${Math.round(ev.e.score)})${bd(ev.e.reasons, '', 0)}${ev.e.counter ? `<p>Contraoferta: ${esc(ev.e.counter.text)} <button class="mini" data-act="dcounter" data-k="${o.id}" data-p="${ev.p}" data-g="${ev.e.counter.gold}">Aceptar contraoferta (${ev.e.counter.gold} oro)</button></p>` : ''}</div>` : ''}
    ${!r.war ? `<div class="btns"><button class="danger" data-act="dwar" data-k="${o.id}">Declarar la guerra</button></div>${r.alliance || r.nap ? '<p class="small neg">Romper un tratado cuesta legitimidad y prestigio, y empeora tu reputación ante todos.</p>' : ''}` : ''}`;
  }
  return `<div class="grid2"><div><table class="tbl clickable">${list}</table>${unknownN ? `<p class="small muted">Existen ${unknownN} reinos o pueblos con los que aún no hemos contactado. Explora para encontrarlos.</p>` : ''}</div><div>${det}</div></div>`;
};
act('dsel', d => { dSel = +d.k!; dEval = null; renderModal(); });
act('deval', d => { const g = UI.g!; const p: any = { kind: d.p }; if (d.p === 'regalo') p.gold = +($<HTMLInputElement>('#giftgold')?.value || 50); dEval = { k: +d.k!, p: d.p, e: evaluate(UI.w!, g, g.playerId, +d.k!, p) }; dSel = +d.k!; renderModal(); });
act('dprop', d => { const g = UI.g!; const p: any = { kind: d.p }; if (d.p === 'regalo') p.gold = +($<HTMLInputElement>('#giftgold')?.value || 50); const e = propose(UI.w!, g, g.playerId, +d.k!, p); toast(e.accept ? `${g.kingdoms[+d.k!].short} acepta: ${PROP_NAMES[d.p as PropKind]}.` : `${g.kingdoms[+d.k!].short} rechaza la propuesta.${e.counter ? ' Propone: ' + e.counter.text : ''}`, e.accept ? 'completado' : 'importante'); dSel = +d.k!; dEval = null; UI.atlas!.refresh(); HOOK.refresh(); });
act('dcounter', d => { const g = UI.g!; const e = propose(UI.w!, g, g.playerId, +d.k!, { kind: d.p as PropKind, gold: +d.g! }); toast(e.accept ? 'Contraoferta aceptada.' : 'Finalmente la rechazan.', e.accept ? 'completado' : 'importante'); dSel = +d.k!; dEval = null; UI.atlas!.refresh(); HOOK.refresh(); });
act('dwar', async d => { const g = UI.g!; const o = g.kingdoms[+d.k!]; if (!(await ask(`¿Declarar la guerra a ${o.name}? Sus aliados pueden unirse.`, 'Declarar la guerra'))) return; declareWar(UI.w!, g, g.playerId, o.id); dSel = o.id; UI.atlas!.refresh(); HOOK.refresh(); });

// ---------- crónicas ----------
BODY.cronicas = () => {
  const g = UI.g!; const a = (UI.modalArg && typeof UI.modalArg === 'object' && UI.modalArg.tab) ? UI.modalArg : { tab: 'cronica' }; UI.modalArg = a;
  const tabs = [['cronica', 'Crónica del reino'], ['mundo', 'Historia del mundo'], ['alertas', 'Alertas'], ['batallas', 'Batallas'], ['stats', 'Estadísticas']];
  let body = '';
  if (a.tab === 'cronica' || a.tab === 'mundo') { const items = g.chronicle.filter(c => a.tab === 'cronica' ? c.kingdom === g.playerId || c.kingdom === -1 : c.important).slice().reverse().slice(0, 300); body = `<ul class="chron">${items.map(c => `<li class="${c.important ? 'imp' : ''}"><small>${dateStr(c.turn)}</small> ${esc(c.text)}</li>`).join('')}</ul>`; }
  else if (a.tab === 'alertas') body = `<ul class="chron">${g.alerts.slice(0, 200).map(x => `<li class="al-${x.level}"><small>${dateStr(x.turn)} · ${x.level}</small> ${x.focus ? `<a data-act="alert" data-id="${x.id}">${esc(x.text)}</a>` : esc(x.text)}</li>`).join('')}</ul>`;
  else if (a.tab === 'batallas') { const rep = a.rep != null ? g.battleReports.find(r => r.id === a.rep) : null; body = rep ? reportHtml(rep) + '<p><a data-act="ctab" data-t="batallas">← Todas las batallas</a></p>' : `<ul>${g.battleReports.map(r => `<li><a data-act="breport" data-id="${r.id}">${dateStr(r.turn)} · ${esc(r.field)}: ${esc(g.kingdoms[r.winner].short)} vence a ${esc(g.kingdoms[r.loser].short)}</a></li>`).join('') || '<li class="muted">Sin batallas registradas.</li>'}</ul>`; }
  else { const k = playerK(g); const s = g.stats; body = `<div class="kv"><span>Meses de reinado</span><b>${g.turn}</b><span>Batallas ganadas / perdidas</span><b>${s.battlesWon} / ${s.battlesLost}</b><span>Mayor ejército</span><b>${fmt(s.maxArmy)}</b><span>Colonias fundadas</span><b>${s.founded}</b><span>Regiones descubiertas</span><b>${s.discovered}</b><span>Provincias</span><b>${kprovs(g, k.id).length}</b><span>Población</span><b>${fmt(totalPop(g, k.id))}</b><span>Tecnologías</span><b>${k.techs.length}</b><span>Monarcas</span><b>${s.rulers.map(esc).join(' → ')}</b></div>
    <h3>Reinos del mundo conocido</h3><table class="tbl sm"><tr><th></th><th>Reino</th><th>Provincias</th><th>Estado</th></tr>${g.kingdoms.filter(o => !o.independent && (o.id === k.id || rel(g, k.id, o.id)?.contact)).map(o => `<tr><td>${heraldry(o, 18)}</td><td>${esc(o.name)}</td><td>${o.alive ? kprovs(g, o.id).length : '—'}</td><td>${o.alive ? '' : 'Caído'}</td></tr>`).join('')}</table>`; }
  return `<div class="tabs">${tabs.map(([id, n]) => `<button class="${a.tab === id ? 'on' : ''}" data-act="ctab" data-t="${id}">${n}</button>`).join('')}</div>${body}`;
};
act('ctab', d => { UI.modalArg = { tab: d.t }; renderModal(); });
function reportHtml(r: any) {
  const g = UI.g!; return `<h3>Batalla de ${esc(r.field)} <small>${dateStr(r.turn)}</small></h3><p>Vencedor: <b>${esc(g.kingdoms[r.winner].name)}</b> tras ${r.phases} fases.</p>
  <table class="tbl"><tr><th></th>${r.sides.map((s: any) => `<th>${esc(s.name)}<br><small>${esc(s.general)}</small></th>`).join('')}</tr>${[['start', 'Al inicio'], ['end', 'Supervivientes'], ['killed', 'Muertos'], ['wounded', 'Heridos'], ['captured', 'Capturados'], ['deserted', 'Desertores'], ['dispersed', 'Dispersos']].map(([k, n]) => `<tr><td>${n}</td>${r.sides.map((s: any) => `<td>${fmt(s[k])}</td>`).join('')}</tr>`).join('')}</table>
  ${r.sides.map((s: any) => `<h4>${esc(s.name)}</h4><table class="tbl sm">${s.units.map((u: any) => `<tr><td>${esc(u.name)}</td><td>${fmt(u.start)} → ${fmt(u.end)}</td></tr>`).join('')}</table>`).join('')}
  <h4>Momentos decisivos</h4><ul>${r.decisive.map((x: string) => `<li>${esc(x)}</li>`).join('')}</ul><h4>Consecuencias</h4><ul>${r.consequences.map((x: string) => `<li>${esc(x)}</li>`).join('')}</ul>`;
}

// ---------- eventos ----------
BODY.evento = () => {
  const g = UI.g!, w = UI.w!; const e = g.events[0]; if (!e) { setTimeout(closeModal, 0); return '<p>No hay asuntos pendientes.</p>'; }
  return `<div class="event"><h3>${esc(e.title)}</h3><p class="small muted">${dateStr(e.turn)}${e.prov >= 0 ? ' · ' + esc(w.provinces[e.prov].name) : ''}${g.events.length > 1 ? ` · ${g.events.length - 1} asunto(s) más después de este` : ''}</p><p>${esc(e.text)}</p>
  <div class="choices">${e.choices.map((c, i) => `<button data-act="evchoice" data-id="${e.id}" data-c="${i}"><b>${esc(c.label)}</b><small>${esc(c.effects)}</small></button>`).join('')}</div>${e.prov >= 0 ? `<p><a data-act="focus" data-prov="${e.prov}">Ver la provincia en el Atlas</a> (el asunto seguirá pendiente)</p>` : ''}</div>`;
};
act('evchoice', d => { const g = UI.g!; const r = resolveEvent(UI.w!, g, +d.id!, +d.c!); if (r) toast(r, 'completado'); UI.atlas!.refresh(); HOOK.refresh(); if (!g.events.length) closeModal(); else renderModal(); });

// ---------- indicadores ----------
BODY.chips = () => { const all: string[] = Object.keys(RES); return `<p>Elige qué recursos se muestran en la barra superior.</p><div class="checks">${all.map(r => `<label><input type="checkbox" data-act-change="chip" data-r="${r}" ${UI.chips.includes(r) ? 'checked' : ''}> ${RES[r as ResId].icon} ${RES[r as ResId].name}</label>`).join('')}</div>`; };
act('chip', (d, el) => { const on = (el as HTMLInputElement).checked; const all = Object.keys(RES); UI.chips = all.filter(r => r === d.r ? on : UI.chips.includes(r)); try { localStorage.setItem('aethoria.chips', JSON.stringify(UI.chips)); } catch { } HOOK.top(); });

// ---------- partida ----------
let saves: SaveMeta[] = []; async function refreshSaves() { try { saves = await listSaves(); } catch { saves = []; } if (UI.modal === 'partida') renderModal(); }
const ROADMAP = [
  ['Implementado', 'Mundo persistente por semilla (234 provincias, 103 mares, 8 masas de tierra), niebla de exploración por reino, Atlas con 13 capas, economía con desgloses, 19 edificios visibles, 25 tecnologías, 10 tipos de tropa, 7 especies, 18 reinos con IA, diplomacia con motivos, expediciones, colonias, eventos, sucesión, rebeliones, batallas tácticas por fases, guardado en IndexedDB con exportación.'],
  ['Pendiente', 'Flotas y batallas navales (el transporte marítimo se resuelve hoy por las expediciones y la colonización).'],
  ['Pendiente', 'Rutas comerciales dibujadas como trayectos con mercancías concretas (hoy el comercio son acuerdos bilaterales que modifican precios e ingresos).'],
  ['Pendiente', 'Matrimonios dinásticos, conspiraciones y misiones de personajes del consejo.'],
  ['Pendiente', 'Religión y cultura como sistemas propios.'],
  ['Pendiente', 'Asedios tácticos (hoy los asedios son estratégicos, con asalto opcional).'],
  ['Pendiente', 'Varias semillas jugables diseñadas a mano: la geografía actual está diseñada para la semilla 1347; otras semillas reutilizan el mismo diseño con variaciones de ruido.'],
  ['Pendiente', 'Música, sonido y animaciones de transición en el mapa.'],
];
BODY.partida = () => {
  const g = UI.g!; const k = playerK(g); const slot = (id: string, n: string) => { const m = saves.find(s => s.slot === id); return `<tr><td><b>${n}</b></td><td>${m ? `${esc(m.kingdom)} · ${esc(m.date)}<br><small class="muted">${new Date(m.savedAt).toLocaleString('es')}</small>` : '<span class="muted">vacía</span>'}</td><td class="nowrap">${id.startsWith('auto') ? '' : `<button class="mini" data-act="save" data-s="${id}">Guardar aquí</button>`}${m ? `<button class="mini" data-act="load" data-s="${id}">Cargar</button><button class="mini danger" data-act="delsave" data-s="${id}">Borrar</button>` : ''}</td></tr>`; };
  return `<div class="grid2"><div><h3>Guardar y cargar</h3><p class="small">La partida se autoguarda cada mes (se conserva también el autoguardado anterior). Los datos viven en el almacenamiento del navegador; exporta un archivo para tener una copia fuera.</p>
  <table class="tbl">${slot('auto', 'Autoguardado')}${slot('auto_prev', 'Autoguardado anterior')}${slot('manual1', 'Ranura 1')}${slot('manual2', 'Ranura 2')}${slot('manual3', 'Ranura 3')}</table>
  <div class="btns"><button data-act="export">Exportar partida (.json)</button><label class="btn">Importar partida<input type="file" accept=".json,application/json" data-act-change="import" hidden></label></div>
  <h3>Opciones</h3><label><input type="checkbox" data-act-change="autopause" ${g.autoPause ? 'checked' : ''}> Detener el avance automático ante alertas críticas</label>
  <p class="small muted">Semilla del mundo: ${g.seed} · versión de guardado ${g.version} · ${esc(g.gameName)} · dificultad ${['fácil', 'normal', 'difícil'][g.difficulty] || g.difficulty}</p>
  <div class="btns"><button class="danger" data-act="newgame">Nueva partida…</button></div></div>
  <div><h3>Estado del desarrollo</h3><ul class="roadmap">${ROADMAP.map(([s, t]) => `<li class="${s === 'Implementado' ? 'done' : 'todo'}"><b>${s}:</b> ${esc(t)}</li>`).join('')}</ul></div></div>`;
};
act('save', async d => { const g = UI.g!; const k = playerK(g); await saveGame(g, d.s!, { name: g.gameName, kingdom: k.name, turn: g.turn, date: dateStr(g.turn) }); toast('Partida guardada.', 'completado'); refreshSaves(); });
act('load', async d => { try { const { g, w } = await loadGame(d.s!); (window as any).__startGame(w, g); toast('Partida cargada.', 'completado'); } catch (e) { toast('No se pudo cargar: ' + (e as Error).message, 'critica'); } });
act('delsave', async d => { if (!(await ask('¿Borrar esta ranura?', 'Borrar'))) return; await deleteSave(d.s!); refreshSaves(); });
act('export', () => { const g = UI.g!; const blob = new Blob([serialize(g)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `aethoria-${playerK(g).short.toLowerCase()}-${g.turn}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); showText('Exportar partida', serialize(g)); });
act('import', (d, el) => { const f = (el as HTMLInputElement).files?.[0]; if (!f) return; f.text().then(t => { try { const { g, w } = importGame(t); (window as any).__startGame(w, g); toast('Partida importada.', 'completado'); } catch (e) { toast('Archivo no válido: ' + (e as Error).message, 'critica'); } }); });
act('autopause', (d, el) => { UI.g!.autoPause = (el as HTMLInputElement).checked; });
act('newgame', async () => { if (!(await ask('¿Volver a la pantalla de inicio? La partida actual queda en el autoguardado.', 'Volver al inicio'))) return; closeModal(); (window as any).__showStart(); });
