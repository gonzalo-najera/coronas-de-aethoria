// Panel lateral: provincias (resumen, ciudad, producción, población, construir, reclutar, colonizar), ejércitos y expediciones.
import type { ResId, SpeciesId } from '../engine/types';
import { RES, BIOMES, DEPOSITS, SPECIES, SPECIES_IDS, BUILDINGS, UNIT, CONTINENTS, LAWS } from '../engine/data';
import { knowLevel, playerK, armyMen, dateStr, atWar, isVisible } from '../engine/game';
import { provinceEconomy, stabilityFactors, prosperityTarget, popCapacity, buildCheck, buildCost, buildMonths, startBuild, cancelBuild, recruitPool, sum, maxSupply, isSupplied, supplyCapacity, techName } from '../engine/economy';
import { recruitOptions, recruit, splitArmy, mergeArmies, disband, assault, pathInfo, siegeMonths, garrison, armySpeed } from '../engine/military';
import { COLONY_KINDS, colonyCheck, startColony, EXP_KINDS } from '../engine/exploration';
import { UI, act, $, esc, fmt, sgn, big, bd, bar, toast, HOOK, ask } from './util';
import { cityView, portrait, heraldry } from './art';

const KNOW = ['Desconocida', 'Cartografiada', 'Explorada (información antigua)', 'Visible', 'Propia'];
const CLIMATE: Record<string, string> = { frio: 'Frío', templado: 'Templado', calido: 'Cálido', arido: 'Árido', tropical: 'Tropical' };
export function charLine(c: { diplomacia: number; administracion: number; liderazgo: number; estrategia: number; inteligencia: number; carisma: number }) {
  return `<div class="attrs">${[['Diplomacia', c.diplomacia], ['Administración', c.administracion], ['Liderazgo', c.liderazgo], ['Estrategia', c.estrategia], ['Inteligencia', c.inteligencia], ['Carisma', c.carisma]].map(([n, v]) => `<span title="${n}">${(n as string).slice(0, 4)}. <b>${v}</b></span>`).join('')}</div>`;
}
export function renderPanel() {
  const el = $('#panel'); const a = UI.atlas; if (!a || !UI.g) return; const s = a.sel;
  if (UI.mode?.kind === 'move') { el.innerHTML = movePanel(); el.hidden = false; return; }
  if (s.kind === 'prov') el.innerHTML = provPanel(s.id); else if (s.kind === 'army') el.innerHTML = armyPanel(s.id); else if (s.kind === 'exp') el.innerHTML = expPanel(s.id);
  else el.innerHTML = `<div class="pad muted"><p>Selecciona una provincia, un ejército o una expedición en el Atlas.</p><p class="small">Arrastra para desplazarte, usa la rueda para acercarte. Clic derecho con un ejército seleccionado para marcar destino. Barra espaciadora: mes siguiente.</p></div>`;
  el.hidden = false;
}
act('closepanel', () => { UI.atlas!.sel = { kind: null, id: -1 }; UI.atlas!.dirty = true; renderPanel(); });
act('tab', d => { UI.tab = d.t!; renderPanel(); });
act('resopen', d => { UI.resOpen = UI.resOpen === d.r ? null : d.r!; renderPanel(); });
act('focus', d => HOOK.focus({ prov: d.prov != null ? +d.prov : undefined, army: d.army != null ? +d.army : undefined, exp: d.exp != null ? +d.exp : undefined }));

// ---------- provincia ----------
function provPanel(pid: number) {
  const g = UI.g!, w = UI.w!; const s = w.provinces[pid], p = g.provinces[pid]; const k = playerK(g); const lv = knowLevel(w, g, k.id, pid);
  const per = UI.atlas!.per[pid]; const ownerK = per >= 0 ? g.kingdoms[per] : null; const own = p.owner === k.id;
  const tabs: [string, string][] = own ? [['resumen', 'Resumen'], ['ciudad', 'Ciudad'], ['produccion', 'Producción'], ['poblacion', 'Población'], ['construir', 'Construir'], ['reclutar', 'Reclutar']]
    : lv >= 3 && p.owner >= 0 ? [['resumen', 'Resumen'], ['ciudad', 'Ciudad']] : lv >= 2 && p.owner < 0 ? [['resumen', 'Resumen'], ['colonizar', 'Colonizar']] : [['resumen', 'Resumen']];
  if (!tabs.some(t => t[0] === UI.tab)) UI.tab = 'resumen';
  const head = `<header class="ph">${ownerK && lv >= 2 ? heraldry(ownerK, 34) : '<div class="nohera"></div>'}<div><h2>${esc(s.name)}</h2><small>${lv >= 2 ? esc(p.cityName) + ' · ' : ''}${ownerK ? esc(ownerK.name) : per === -1 ? 'Tierras sin reino' : 'Dueño desconocido'}${p.owner === -1 && lv >= 2 && p.colonizing ? ' · fundación en curso' : ''}</small></div><button class="icon" data-act="closepanel">×</button></header>
  <div class="tabs">${tabs.map(([id, n]) => `<button class="${UI.tab === id ? 'on' : ''}" data-act="tab" data-t="${id}">${n}</button>`).join('')}</div>`;
  let body = '';
  switch (UI.tab) {
    case 'ciudad': body = `<div class="cityview">${cityView(p, s, ownerK?.color || '#888')}</div><p class="small muted">Cada edificio construido aparece en la vista (pasa el ratón para identificarlo). Los andamios indican obras en curso.</p>${bList(pid)}`; break;
    case 'produccion': body = prodTab(pid); break;
    case 'poblacion': body = popTab(pid); break;
    case 'construir': body = buildTab(pid); break;
    case 'reclutar': body = recruitTab(pid); break;
    case 'colonizar': body = colonyTab(pid); break;
    default: body = summaryTab(pid, lv);
  }
  return head + `<div class="pbody">${body}</div>`;
}
function bList(pid: number) { const p = UI.g!.provinces[pid]; const ent = Object.entries(p.buildings).filter(x => x[1] > 0); return ent.length ? `<h4>Edificios</h4><ul class="cols">${ent.map(([b, l]) => `<li>${esc(BUILDINGS.find(x => x.id === b)?.name || b)}${l > 1 ? ' ' + l : ''}</li>`).join('')}</ul>` : '<p class="muted small">Sin edificios destacables.</p>'; }
function summaryTab(pid: number, lv: number) {
  const g = UI.g!, w = UI.w!; const s = w.provinces[pid], p = g.provinces[pid]; const k = playerK(g); const own = p.owner === k.id;
  const deps = s.deposits.filter((d, i) => lv >= 2 && (!d.hidden || p.revealedDeposits.includes(i)));
  let h = `<div class="kv"><span>Conocimiento</span><b>${KNOW[lv]}</b><span>Terreno</span><b>${BIOMES[s.biome].name}${s.river ? ', río' : ''}${s.coastal ? ', costa' : ''}</b><span>Clima</span><b>${CLIMATE[s.climate]} (hemisferio ${s.hemisphere === 'N' ? 'norte' : 'sur'})</b><span>Continente</span><b>${esc(w.continents[s.continent]?.name || CONTINENTS[s.continent] || '—')}</b><span>Superficie</span><b>${s.area} leguas²</b>`;
  if (lv === 1) return h + `</div><p class="small muted">Solo conocemos su contorno por mapas y relatos. Envía exploradores o ejércitos para saber más.</p>`;
  if (lv === 2) h += `<span>Último dueño conocido</span><b>${k.lastOwner[pid] >= 0 ? esc(g.kingdoms[k.lastOwner[pid]].name) : 'Nadie'}</b><span>Última observación</span><b>hace ${g.turn - k.lastSeen[pid]} meses</b>`;
  if (lv >= 3) h += `<span>Población</span><b>${own ? fmt(p.pop) : '≈' + big(Math.round(p.pop / 1000) * 1000)}</b>`;
  if (own || lv >= 3) h += `<span>Fertilidad</span><b>${Math.round(s.fertility * 100)}%</b><span>Defensa del terreno</span><b>+${Math.round(s.defense * 100)}%</b>`;
  h += '</div>';
  if (deps.length) h += `<h4>Yacimientos</h4><ul>${deps.map(d => `<li><b>${DEPOSITS[d.kind].name}</b> — ${esc(DEPOSITS[d.kind].desc)}</li>`).join('')}</ul>`;
  if (s.strategic.length) h += `<h4>Lugares estratégicos</h4><ul>${s.strategic.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  if (s.ruins && lv >= 2) h += `<p class="small">⌂ Hay ruinas antiguas en la provincia.</p>`;
  if (own) {
    const sf = stabilityFactors(w, g, pid), pt = prosperityTarget(w, g, pid);
    h += `<h4>Estabilidad ${Math.round(p.stability)} ${bar(p.stability)}</h4><details><summary>Factores (objetivo ${Math.round(sum(sf))})</summary>${bd(sf)}</details>
    <h4>Prosperidad ${Math.round(p.prosperity)} ${bar(p.prosperity)}</h4><details><summary>Factores (objetivo ${Math.round(sum(pt))})</summary>${bd(pt)}</details>
    <div class="kv"><span>Control</span><b>${Math.round(p.control)}%</b><span>Movilizados</span><b>${fmt(p.mobilized)}</b>${p.plague ? '<span>Epidemia</span><b class="neg">activa</b>' : ''}${p.lowStabMonths ? `<span>Meses inestable</span><b class="neg">${p.lowStabMonths} (a los 9 puede rebelarse)</b>` : ''}</div>`;
    if (p.queue.length) h += `<h4>Obras</h4><ul>${p.queue.map(q => `<li>${esc(BUILDINGS.find(b => b.id === q.b)!.name)}: ${q.monthsLeft} de ${q.total} meses</li>`).join('')}</ul>`;
  } else if (lv >= 3 && p.owner >= 0) h += bList(pid);
  if (p.siege && lv >= 3) h += `<p class="neg">⚔ Asediada por ${esc(g.kingdoms[p.siege.by].name)}: ${Math.round(p.siege.progress)}% (guarnición ≈${fmt(garrison(g, pid))})</p>`;
  if (p.occupier >= 0 && lv >= 3) h += `<p class="neg">Ocupada por ${esc(g.kingdoms[p.occupier].name)}</p>`;
  if (p.colonizing && lv >= 2) h += `<p>Fundación de <b>${esc(p.colonizing.name)}</b> por ${esc(g.kingdoms[p.colonizing.by].short)}: faltan ${p.colonizing.monthsLeft} meses.</p>`;
  const armies = g.armies.filter(a => a.prov === pid && (a.owner === k.id || isVisible(w, g, k.id, pid)));
  if (armies.length) h += `<h4>Ejércitos presentes</h4><ul class="links">${armies.map(a => `<li><a data-act="focus" data-army="${a.id}"><span class="sw" style="background:${g.kingdoms[a.owner].color}"></span>${a.owner === k.id ? esc(a.name) + ' · ' + fmt(armyMen(a)) : 'Ejército de ' + esc(g.kingdoms[a.owner].short) + ' · ≈' + fmt(Math.round(armyMen(a) / 500) * 500)}</a></li>`).join('')}</ul>`;
  return h;
}
function prodTab(pid: number) {
  const g = UI.g!, w = UI.w!; const e = provinceEconomy(w, g, pid);
  const rows = (Object.keys(RES) as ResId[]).filter(r => e.prod[r].length || e.cons[r].length).map(r => { const pr = sum(e.prod[r]), co = sum(e.cons[r]); const net = pr - Math.abs(co); const open = UI.resOpen === r;
    return `<tr class="clickable ${open ? 'on' : ''}" data-act="resopen" data-r="${r}"><td>${RES[r].icon} ${RES[r].name}</td><td class="pos">${sgn(pr)}</td><td class="neg">${co ? '−' + fmt(Math.abs(co), 1) : '0'}</td><td class="${net < 0 ? 'neg' : 'pos'}"><b>${sgn(net)}</b></td></tr>${open ? `<tr><td colspan="4" class="bdcell"><h5>Producción de ${RES[r].name.toLowerCase()}</h5>${bd(e.prod[r])}${e.cons[r].length ? `<h5>Consumo</h5>${bd(e.cons[r].map(x => ({ label: x.label, value: -Math.abs(x.value) })))}` : ''}</td></tr>` : ''}`; }).join('');
  return `<p class="small">Valores mensuales calculados por el mismo motor que procesa el turno. Haz clic en un recurso para ver su desglose.</p><table class="tbl prod"><tr><th>Recurso</th><th>Prod.</th><th>Cons.</th><th>Neto</th></tr>${rows}</table>
  <h4>Eficiencia productiva ×${e.effMult.toFixed(2)}</h4>${bd(e.eff, '', 2)}<p class="small muted">Trabajadores empleados en edificios: ${fmt(e.workers)}.</p>`;
}
function popTab(pid: number) {
  const g = UI.g!, w = UI.w!; const p = g.provinces[pid]; const cap = popCapacity(w, g, pid); const k = playerK(g);
  const sp = SPECIES_IDS.filter(s => p.species[s] > 0.001).sort((a, b) => p.species[b] - p.species[a]);
  return `<div class="kv"><span>Habitantes</span><b>${fmt(p.pop)}</b><span>Capacidad</span><b>${fmt(cap)} ${bar(p.pop, cap)}</b><span>Movilizados</span><b>${fmt(p.mobilized)}</b><span>Reserva reclutable</span><b>${fmt(recruitPool(w, g, pid, null))} (${LAWS.reclutamiento.levels[k.laws.reclutamiento]})</b></div>
  <h4>Especies</h4><table class="tbl">${sp.map(s => `<tr><td><span class="sw" style="background:${SPECIES[s].color}"></span>${SPECIES[s].plural}</td><td>${(p.species[s] * 100).toFixed(1)}%</td><td>${fmt(p.pop * p.species[s])}</td><td class="small muted">${esc(SPECIES[s].desc)}</td></tr>`).join('')}</table>
  <p class="small muted">Cada especie tiene fuerza, longevidad, fertilidad, consumo y talentos propios que modifican la producción, el crecimiento y las tropas disponibles.</p>`;
}
function buildTab(pid: number) {
  const g = UI.g!, w = UI.w!; const p = g.provinces[pid]; const k = playerK(g); let cat = ''; let h = '';
  if (p.queue.length) h += `<h4>Obras en curso</h4><ul>${p.queue.map((q, i) => `<li>${esc(BUILDINGS.find(b => b.id === q.b)!.name)} — ${q.monthsLeft}/${q.total} meses ${bar(q.total - q.monthsLeft, q.total)} <button class="mini" data-act="cancelb" data-p="${pid}" data-i="${i}" title="Cancelar (se recupera la mitad del coste)">Cancelar</button></li>`).join('')}</ul>`;
  for (const b of BUILDINGS) {
    if (b.cat !== cat) { cat = b.cat; h += `<h4>${esc(cat)}</h4>`; }
    const c = buildCheck(w, g, k.id, pid, b.id); const cost = buildCost(g, k.id, pid, b.id); const lvNow = p.buildings[b.id] || 0;
    const costTxt = Object.entries(cost).map(([r, v]) => `<span class="${(k.stock as any)[r] < (v as number) ? 'neg' : ''}">${RES[r as ResId].icon}${fmt(v as number)}</span>`).join(' ');
    h += `<div class="bld ${c.ok ? '' : 'dis'}"><div><b>${esc(b.name)}</b> <small class="muted">${lvNow ? 'nivel ' + lvNow + '/' + b.max : b.max > 1 ? 'máx. ' + b.max : ''}</small><br><small>${esc(b.effect)}</small><br><small class="muted">${costTxt} · ${buildMonths(g, pid, b.id)} meses · mant. ${b.upkeep} oro/mes${b.workers ? ' · ' + b.workers + ' trabajadores' : ''}</small>${c.why.length ? `<br><small class="neg">${c.why.map(esc).join(' · ')}</small>` : ''}</div><button data-act="build" data-p="${pid}" data-b="${b.id}" ${c.ok ? '' : 'disabled'}>${lvNow ? 'Ampliar' : 'Construir'}</button></div>`;
  }
  return h;
}
act('build', d => { const g = UI.g!; if (startBuild(UI.w!, g, g.playerId, +d.p!, d.b!)) { toast('Obras iniciadas: ' + BUILDINGS.find(b => b.id === d.b)!.name); HOOK.refresh(); } else toast('No es posible construir ahora.', 'critica'); });
act('cancelb', d => { const g = UI.g!; cancelBuild(g, g.playerId, +d.p!, +d.i!); HOOK.refresh(); });
function recruitTab(pid: number) {
  const g = UI.g!, w = UI.w!; const k = playerK(g); const opts = recruitOptions(w, g, k.id, pid);
  return `<p class="small">Coste por cada 100 soldados. Reclutar reduce la población y la producción de la provincia. Las tropas se unen al ejército estacionado aquí o forman uno nuevo.</p>` + opts.map(o => { const u = o.u; const max = Math.floor(Math.min(o.pool, k.stock.oro / u.cost.oro * 100, u.cost.armas ? k.stock.armas / u.cost.armas * 100 : 1e9)); const def = Math.max(0, Math.min(max, u.id === 'gigantes' ? 10 : 500));
    return `<div class="bld ${o.why.length ? 'dis' : ''}"><div><b>${esc(u.name)}</b>${u.species ? ` <small class="muted">(${SPECIES[u.species].plural.toLowerCase()})</small>` : ''}<br><small>${esc(u.desc)}</small><br><small class="muted">Ataque ${u.atk} · Defensa ${u.def}${u.ranged ? ' · Distancia ' + u.ranged + ' (alcance ' + u.range + ')' : ''} · Moral ${u.morale} · Velocidad ${u.speed}${u.antiCav > 1.2 ? ' · Anticaballería' : ''}</small><br><small>◉${u.cost.oro} ⚔${u.cost.armas} · mant. ${u.upkeep} oro y ${u.food} alim. · disponibles ${fmt(o.pool)}</small>${o.why.length ? `<br><small class="neg">${o.why.map(x => esc(x.startsWith('Requiere ') && !x.includes('cuartel') ? 'Requiere ' + techName(x.slice(9)) : x)).join(' · ')}</small>` : ''}</div>
    ${o.why.length ? '' : `<div class="rec"><input type="number" min="0" max="${max}" step="${u.id === 'gigantes' ? 1 : 50}" value="${def}" id="rec-${u.id}"><button data-act="recruit" data-p="${pid}" data-u="${u.id}" ${max < (u.id === 'gigantes' ? 5 : 50) ? 'disabled' : ''}>Reclutar</button></div>`}</div>`; }).join('');
}
act('recruit', d => { const g = UI.g!; const n = +($<HTMLInputElement>('#rec-' + d.u).value || 0); const a = recruit(UI.w!, g, g.playerId, +d.p!, d.u!, n); if (a) { toast(`${fmt(n)} ${UNIT[d.u!].name.toLowerCase()} se unen a ${a.name}.`); HOOK.refresh(); } else toast('No se pudo reclutar: revisa oro, armas y población disponible (mínimo 50).', 'critica'); });
function colonyTab(pid: number) {
  const g = UI.g!, w = UI.w!; const k = playerK(g); const p = g.provinces[pid];
  return `<p class="small">Funda un asentamiento propio en esta provincia sin dueño. Los colonos salen de tu capital.</p><label>Nombre del asentamiento <input id="colname" value="${esc(p.cityName)}"></label>` + Object.entries(COLONY_KINDS).map(([id, c]) => { const why = colonyCheck(w, g, k.id, pid, id);
    return `<div class="bld ${why.length ? 'dis' : ''}"><div><b>${esc(c.name)}</b><br><small>${esc(c.desc)}</small><br><small class="muted">${Object.entries(c.cost).map(([r, v]) => RES[r as ResId].icon + v).join(' ')} · ${fmt(c.settlers)} colonos · ${c.months} meses</small>${why.length ? `<br><small class="neg">${why.map(esc).join(' · ')}</small>` : ''}</div><button data-act="colonize" data-p="${pid}" data-k="${id}" ${why.length ? 'disabled' : ''}>Fundar</button></div>`; }).join('');
}
act('colonize', d => { const g = UI.g!; const name = ($<HTMLInputElement>('#colname').value || '').trim(); if (startColony(UI.w!, g, g.playerId, +d.p!, d.k!, name)) { g.stats.founded++; toast('Los colonos parten hacia ' + name + '.'); HOOK.refresh(); } });

// ---------- ejército ----------
function armyPanel(id: number) {
  const g = UI.g!, w = UI.w!; const a = g.armies.find(x => x.id === id); if (!a) return '<div class="pad">El ejército ya no existe.</div>'; const k = playerK(g); const own = a.owner === k.id; const K = g.kingdoms[a.owner];
  const men = armyMen(a); const s = w.provinces[a.prov];
  if (!own) return `<header class="ph">${heraldry(K, 34)}<div><h2>Ejército de ${esc(K.short)}</h2><small>en ${esc(s.name)}</small></div><button class="icon" data-act="closepanel">×</button></header><div class="pbody"><p>Efectivos estimados: <b>≈${fmt(Math.round(men / 500) * 500)}</b></p><p>Composición observada: ${a.units.map(u => esc(UNIT[u.type].name)).join(', ')}</p>${atWar(g, k.id, a.owner) ? '<p class="neg">Estamos en guerra con este reino.</p>' : ''}<p class="small muted">Una batalla dará una estimación más precisa según tus exploradores.</p></div>`;
  const others = g.armies.filter(x => x.owner === k.id && x.prov === a.prov && x.id !== a.id);
  const wounded = Object.values(a.wounded).reduce((s2, v) => s2 + v, 0); const sup = isSupplied(w, g, a);
  const dest = a.path.length ? w.provinces[a.path[a.path.length - 1]].name : null; const eta = a.path.length ? pathInfo(w, g, a, a.path).months : 0;
  const pr = g.provinces[a.prov]; const canAssault = pr.siege && pr.siege.by === k.id;
  return `<header class="ph">${heraldry(K, 34)}<div><h2><input class="title-in" value="${esc(a.name)}" data-act-change="rename" data-id="${a.id}" title="Renombrar"></h2><small>en ${esc(s.name)}${dest ? ' → ' + esc(dest) + ` (≈${Math.max(1, Math.ceil(eta))} meses)` : ''}${a.retreating ? ' · en retirada' : ''}</small></div><button class="icon" data-act="closepanel">×</button></header>
  <div class="pbody">
  <div class="kv"><span>Efectivos</span><b>${fmt(men)}</b><span>Heridos en recuperación</span><b>${fmt(wounded)}</b><span>Moral</span><b>${Math.round(a.morale)} ${bar(a.morale)}</b><span>Suministro</span><b class="${sup ? 'pos' : 'neg'}">${sup ? 'Abastecido' : `Sin línea: reservas ${a.supply.toFixed(1)}/${maxSupply(K)} meses`}</b><span>Capacidad de la provincia</span><b>${fmt(supplyCapacity(w, g, a.prov))} soldados</b><span>Velocidad</span><b>${armySpeed(w, g, a).toFixed(2)}</b></div>
  <table class="tbl"><tr><th>Unidad</th><th>Efectivos</th><th>Exp.</th><th>Heridos</th></tr>${a.units.map(u => `<tr><td>${esc(UNIT[u.type].name)}</td><td>${fmt(u.men)}</td><td>${Math.round(u.exp * 100)}%</td><td>${fmt(a.wounded[u.type] || 0)}</td></tr>`).join('')}</table>
  ${a.general ? `<h4>General</h4><div class="person">${portrait(a.general, 56)}<div><b>${esc(a.general.name)}</b><br><small>${SPECIES[a.general.species].name}, ${a.general.age} años · ${esc(a.general.trait)}</small>${charLine(a.general)}</div></div>` : '<p class="small muted">Sin general: el ejército combate sin bonificaciones de mando.</p>'}
  ${pr.siege && pr.siege.by === k.id ? `<p>Asedio de ${esc(pr.cityName)}: ${Math.round(pr.siege.progress)}% · se espera rendición en ≈${siegeMonths(g, a.prov, a)} meses · guarnición ≈${fmt(garrison(g, a.prov))}</p>` : ''}
  <div class="btns"><button class="primary" data-act="move" data-id="${a.id}">Mover…</button>${a.path.length ? `<button data-act="halt" data-id="${a.id}">Detener</button>` : ''}${canAssault ? `<button data-act="assault" data-id="${a.id}" title="Ataque inmediato a las murallas: arriesgado">Asaltar</button>` : ''}</div>
  <h4>Organización</h4>
  <div class="row"><select id="split-t">${a.units.map(u => `<option value="${u.type}">${esc(UNIT[u.type].name)}</option>`).join('')}</select><input type="number" id="split-n" value="${Math.floor((a.units[0]?.men || 0) / 2)}" min="1"><button data-act="split" data-id="${a.id}">Dividir</button></div>
  ${others.length ? `<div class="row"><select id="merge-o">${others.map(o => `<option value="${o.id}">${esc(o.name)} (${fmt(armyMen(o))})</option>`).join('')}</select><button data-act="merge" data-id="${a.id}">Fusionar aquí</button></div>` : ''}
  <div class="row"><button class="danger" data-act="disband" data-id="${a.id}" title="Los soldados vuelven a la población">Licenciar el ejército</button></div>
  </div>`;
}
act('rename', (d, el) => { const a = UI.g!.armies.find(x => x.id === +d.id!); if (a) { a.name = (el as HTMLInputElement).value.trim().slice(0, 40) || a.name; UI.atlas!.dirty = true; } });
act('halt', d => { const a = UI.g!.armies.find(x => x.id === +d.id!); if (a) { a.path = []; a.progress = 0; HOOK.refresh(); } });
act('assault', d => { const g = UI.g!; const a = g.armies.find(x => x.id === +d.id!); if (!a) return; const r = assault(UI.w!, g, a); toast(r.text, r.ok ? 'completado' : 'critica'); UI.atlas!.refresh(); HOOK.refresh(); });
act('split', d => { const g = UI.g!; const a = g.armies.find(x => x.id === +d.id!); if (!a) return; const t = $<HTMLSelectElement>('#split-t').value, n = +$<HTMLInputElement>('#split-n').value; const b = splitArmy(g, a, t, n); if (b) { UI.atlas!.sel = { kind: 'army', id: b.id }; toast('Nuevo ejército: ' + b.name); HOOK.refresh(); } else toast('División no válida (no puedes separar todo el ejército).', 'critica'); });
act('merge', d => { const g = UI.g!; const a = g.armies.find(x => x.id === +d.id!); const o = g.armies.find(x => x.id === +$<HTMLSelectElement>('#merge-o').value); if (a && o) { mergeArmies(g, a, o); HOOK.refresh(); } });
act('disband', async d => { const g = UI.g!; const a = g.armies.find(x => x.id === +d.id!); if (!a) return; if (!(await ask(`¿Licenciar ${a.name}? Los soldados volverán a sus hogares.`, 'Licenciar'))) return; disband(UI.w!, g, a); UI.atlas!.sel = { kind: null, id: -1 }; HOOK.refresh(); });

function movePanel() {
  const g = UI.g!, w = UI.w!; const m = UI.mode!; const a = g.armies.find(x => x.id === m.army); if (!a) return '';
  let h = `<header class="ph"><div><h2>Mover ${esc(a.name)}</h2><small>desde ${esc(w.provinces[a.prov].name)}</small></div><button class="icon" data-act="movecancel">×</button></header><div class="pbody">`;
  if (m.dest == null) return h + `<p>Haz clic en la provincia de destino. Al pasar el ratón verás la ruta prevista y el tiempo estimado.</p><div class="btns"><button data-act="movecancel">Cancelar</button></div></div>`;
  if (!m.path) return h + `<p class="neg">No hay ruta posible hasta ${esc(w.provinces[m.dest].name)} (mar, tierras desconocidas o territorio sin derecho de paso).</p><div class="btns"><button data-act="move" data-id="${a.id}">Elegir otro destino</button><button data-act="movecancel">Cancelar</button></div></div>`;
  const info = pathInfo(w, g, a, m.path);
  return h + `<p>Destino: <b>${esc(w.provinces[m.dest].name)}</b> · ${m.path.length} provincia(s) · llegada estimada en <b>${Math.max(1, Math.ceil(info.months))} mes(es)</b> (${info.months.toFixed(1)}).</p>
  <ol class="small">${m.path.map(p => `<li>${esc(w.provinces[p].name)}${isSupplied(w, g, { owner: a.owner, prov: p }) ? '' : ' <span class="neg">(sin suministro)</span>'}</li>`).join('')}</ol>
  ${info.risks.length ? `<h4>Riesgos</h4><ul class="bad">${info.risks.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '<p class="pos small">Ruta segura y abastecida.</p>'}
  <div class="btns"><button class="primary" data-act="moveok">Confirmar orden</button><button data-act="move" data-id="${a.id}">Otro destino</button><button data-act="movecancel">Cancelar</button></div></div>`;
}

// ---------- expedición ----------
function expPanel(id: number) {
  const g = UI.g!, w = UI.w!; const e = g.expeditions.find(x => x.id === id); if (!e) return '';
  const where = e.loc.t === 'p' ? w.provinces[e.loc.id].name : w.seas[e.loc.id].name;
  return `<header class="ph"><div><h2>${esc(e.name)}</h2><small>${EXP_KINDS[e.kind]} · rumbo ${({ N: 'norte', S: 'sur', E: 'este', O: 'oeste' })[e.dir]} · ${esc(where)}</small></div><button class="icon" data-act="closepanel">×</button></header>
  <div class="pbody"><div class="person">${portrait(e.leader, 56)}<div><b>${esc(e.leader.name)}</b><br><small>${SPECIES[e.leader.species].name} · ${esc(e.leader.trait)}</small>${charLine(e.leader)}</div></div>
  <div class="kv"><span>Estado</span><b>${({ activa: 'Explorando', regreso: 'De regreso', terminada: 'Concluida', perdida: 'Perdida' })[e.state]}</b><span>Miembros</span><b>${e.members}/${e.startMembers}</b><span>Escolta</span><b>${e.escort}</b><span>Suministros</span><b>${e.supplies.toFixed(1)} de ${e.startSupplies} meses</b><span>Tiempo</span><b>${e.months} meses</b><span>Provincias descubiertas</span><b>${e.discovered}</b><span>Mares descubiertos</span><b>${e.discoveredSeas}</b><span>Contactos</span><b>${e.contacts.map(c => esc(g.kingdoms[c].short)).join(', ') || '—'}</b></div>
  ${e.found.length ? `<h4>Hallazgos</h4><ul>${e.found.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
  <h4>Diario</h4><ul class="log">${e.log.slice().reverse().map(l => `<li><small>${dateStr(l.turn)}</small> ${esc(l.text)}</li>`).join('')}</ul></div>`;
}
