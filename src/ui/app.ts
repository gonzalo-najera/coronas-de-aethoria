// Interfaz principal: barra superior, navegación, Atlas interactivo, control del tiempo, alertas y eventos.
import type { World } from '../engine/world';
import { W } from '../engine/world';
import type { GameState, ResId } from '../engine/types';
import { RES, SPECIES } from '../engine/data';
import { dateStr, dateOf, knowLevel, playerK, totalPop, setW, kprovs, armyMen } from '../engine/game';
import { kingdomEconomy, KEco, storageCap, sum } from '../engine/economy';
import { endTurn } from '../engine/turn';
import { findPath, pathInfo } from '../engine/military';
import { saveGame } from '../engine/save';
import { warsOf } from '../engine/diplomacy';
import { Atlas, LAYERS, S } from './render';
import { openBattle, battleOpen } from './battleView';
import { UI, ACTIONS, act, $, esc, fmt, sgn, big, bd, tip, toast, HOOK } from './util';
import { renderPanel } from './panels';
import { renderModal, openModal, closeModal } from './modals';
import { heraldry } from './art';

const RES_ORDER: ResId[] = ['oro', 'alimentos', 'madera', 'piedra', 'hierro', 'herramientas', 'armas', 'investigacion', 'prestigio'];
const LEGENDS: Record<string, string> = {
  fisico: 'Relieve, ríos, bosques y costas, tal como los conoce tu reino.', politico: 'Color de cada reino. Fuera de tu visión se muestra el último dueño conocido.', provincial: 'Límites de cada provincia cartografiada.',
  economico: 'Producción total de las provincias visibles: <span class="sw" style="background:#c84630"></span> baja → <span class="sw" style="background:#50be3c"></span> alta.', recursos: 'Yacimientos conocidos (círculos). Las minas y canteras construidas se ven sobre el mapa.',
  militar: 'Rojo: territorio enemigo u ocupado. Gris: fortificaciones. Banderas: ejércitos visibles.', comercial: 'Dorado: mercados, puertos y socios comerciales. Rojo: enemigos.', diplomatico: 'Verde: aliados y pactos. Naranja: desconfiados u hostiles. Rojo: en guerra.',
  demografico: 'Especie mayoritaria (color) y densidad (intensidad).', estabilidad: 'Estabilidad: rojo inestable → verde estable.', infraestructura: 'Caminos, puertos, depósitos y edificios.',
  suministros: 'Verde: con línea de abastecimiento (más intenso = más capacidad). Ocre: sin suministro.', exploracion: 'Nivel de conocimiento: ocre = cartografiado, amarillo = explorado (información antigua), verde = visible, verde oscuro = propio.',
};
let eco: KEco | null = null; let ecoTurn = -1;
export function getEco(force = false) { const g = UI.g!; if (force || !eco || ecoTurn !== g.turn) { eco = kingdomEconomy(UI.w!, g, g.playerId); ecoTurn = g.turn; } return eco; }
export function invalidateEco() { eco = null; }

export function startGame(w: World, g: GameState) {
  UI.w = w; UI.g = g; setW(w); UI.mode = null; UI.modal = null; invalidateEco();
  try { UI.chips = JSON.parse(localStorage.getItem('aethoria.chips') || 'null') || RES_ORDER.slice(); } catch { UI.chips = RES_ORDER.slice(); }
  $('#start').hidden = true; $('#app').hidden = false;
  const cv = $<HTMLCanvasElement>('#map');
  if (!UI.atlas) { UI.atlas = new Atlas(cv, w, g); bindMap(cv); requestAnimationFrame(loop); }
  else { const a = UI.atlas; if (a.w !== w) { a.w = w; a.buildBase(); a.buildStaticPaths(); } a.setGame(g); }
  UI.atlas.resize(); const cap = w.provinces[playerK(g).capital]; UI.atlas.sel = { kind: 'prov', id: cap.id }; UI.atlas.centerOn(cap.cx, cap.cy, 1.1);
  UI.lastAlert = g.alerts[0]?.id || 0;
  renderLayers(); refreshAll();
  if (g.pendingBattles.length) setTimeout(() => openNextBattle(), 50); else if (g.events.length) openModal('evento');
}
function loop() { const a = UI.atlas; if (a && a.dirty && !$('#app').hidden) a.draw(); requestAnimationFrame(loop); }
export function refreshAll() { invalidateEco(); renderTop(); renderPanel(); renderAlerts(); if (UI.modal) renderModal(); if (UI.atlas) { UI.atlas.overlayKey = ''; UI.atlas.dirty = true; } }
HOOK.refresh = refreshAll; HOOK.top = renderTop; HOOK.panel = renderPanel; HOOK.modal = () => UI.modal && renderModal();
HOOK.focus = (f: { prov?: number; army?: number; exp?: number }) => {
  const a = UI.atlas!, w = UI.w!, g = UI.g!; if (f.army != null) { const ar = g.armies.find(x => x.id === f.army); if (ar) { a.sel = { kind: 'army', id: ar.id }; const s = w.provinces[ar.prov]; a.centerOn(s.cx, s.cy, Math.max(a.z, 1)); } }
  else if (f.exp != null) { a.sel = { kind: 'exp', id: f.exp }; const e = g.expeditions.find(x => x.id === f.exp); if (e) { const p = e.loc.t === 'p' ? w.provinces[e.loc.id] : w.seas[e.loc.id]; a.centerOn(p.cx, p.cy, Math.max(a.z, 0.9)); } }
  else if (f.prov != null) { a.sel = { kind: 'prov', id: f.prov }; const s = w.provinces[f.prov]; a.centerOn(s.cx, s.cy, Math.max(a.z, 1)); }
  closeModal(); renderPanel();
};

// ---------- barra superior ----------
function renderTop() {
  const g = UI.g!, w = UI.w!; const k = playerK(g); const e = getEco(); const cap = storageCap(g, k.id); const d = dateOf(g.turn);
  const provs = kprovs(g, k.id); const stab = provs.length ? provs.reduce((s, p) => s + p.stability, 0) / provs.length : 0; const wars = warsOf(g, k.id).filter(x => g.kingdoms[x].alive);
  const chips = UI.chips.filter(r => RES[r as ResId]).map(r => { const id = r as ResId; const net = e.net[id]; const low = id !== 'investigacion' && id !== 'prestigio' && k.stock[id] < Math.max(10, -net * 3) && net < 0;
    return `<div class="chip-res ${low ? 'warn' : ''}" data-tip="res" data-r="${id}"><i class="ri ri-${id}">${RES[id].icon}</i><b>${id === 'investigacion' ? fmt(k.research.progress) : big(k.stock[id])}</b><small class="${net < 0 ? 'neg' : 'pos'}">${sgn(net)}</small></div>`; }).join('');
  $('#top').innerHTML = `<div class="brand" data-act="modal" data-m="reino" title="Tu reino">${heraldry(k, 30)}<div><b>${esc(k.name)}</b><small>${esc(k.ruler.name)}</small></div></div>
  <div class="date" data-tip="date"><b>${d.month}</b><small>año ${d.y} · ${d.season}</small></div>
  <div class="chips-res">${chips}
    <div class="chip-res" data-tip="pop"><i class="ri">☗</i><b>${big(totalPop(g, k.id))}</b><small>habitantes</small></div>
    <div class="chip-res" data-tip="stab"><i class="ri">⚖</i><b>${Math.round(stab)}</b><small>estabilidad</small></div>
    <div class="chip-res" data-tip="legit"><i class="ri">♔</i><b>${Math.round(k.legitimacy)}</b><small>legitimidad</small></div>
    ${wars.length ? `<div class="chip-res war" data-act="modal" data-m="diplomacia" data-tip="wars"><i class="ri">⚔</i><b>${wars.length}</b><small>guerra${wars.length > 1 ? 's' : ''}</small></div>` : ''}
    <button class="icon" data-act="chips" title="Elegir los indicadores visibles">⚙</button></div>
  <div class="time">
    <button class="primary" data-act="turn" title="Avanzar un mes (barra espaciadora)" ${UI.busy ? 'disabled' : ''}>Mes siguiente ▸</button>
    <button data-act="until" title="Avanza mes a mes hasta que ocurra algo importante (máx. 24 meses)" ${UI.busy ? 'disabled' : ''}>Hasta evento ▸▸</button>
    <button class="${UI.auto ? 'on' : ''}" data-act="auto" title="Avance automático">${UI.auto ? '❚❚ Pausa' : '▶ Auto'}</button>
    <select data-act-change="speed" title="Velocidad del avance automático">${[[1800, 'Lenta'], [900, 'Normal'], [350, 'Rápida']].map(([v, n]) => `<option value="${v}" ${UI.speed === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
  </div>`;
}
export const TIPS: Record<string, (el: HTMLElement) => string> = {
  res(el) {
    const r = el.dataset.r as ResId; const g = UI.g!; const k = playerK(g); const e = getEco(); const cap = storageCap(g, k.id);
    if (r === 'investigacion') return `<h4>✦ Investigación</h4><p>Proyecto: <b>${k.research.current ? esc(TECHN(k.research.current)) : 'ninguno'}</b> · progreso ${fmt(k.research.progress)}</p><h5>Producción mensual</h5>${bd(e.prod[r])}${e.cons[r].length ? '<h5>Costes</h5>' + bd(e.cons[r]) : ''}<p class="small muted">Haz clic en Tecnología para elegir un proyecto.</p>`;
    return `<h4>${RES[r].icon} ${RES[r].name}</h4><p>Reservas: <b>${fmt(k.stock[r])}</b>${cap[r] < 99999 ? ` / capacidad ${fmt(cap[r])}` : ''} · balance <b class="${e.net[r] < 0 ? 'neg' : 'pos'}">${sgn(e.net[r])}</b>/mes</p><h5>Producción</h5>${bd(e.prod[r])}<h5>Consumo</h5>${bd(e.cons[r].map(x => ({ label: x.label, value: -Math.abs(x.value) })))}${e.net[r] < 0 && k.stock[r] > 0 ? `<p class="neg small">Se agotará en ≈ ${Math.floor(k.stock[r] / -e.net[r])} meses.</p>` : ''}`;
  },
  pop() { const g = UI.g!, k = playerK(g); const tot = totalPop(g, k.id); const mix: Record<string, number> = {}; for (const p of kprovs(g, k.id)) for (const s in p.species) mix[s] = (mix[s] || 0) + p.species[s as keyof typeof p.species] * p.pop; return `<h4>Población</h4><p>${fmt(tot)} habitantes en ${kprovs(g, k.id).length} provincias.</p><table class="bd">${Object.entries(mix).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).map(([s, v]) => `<tr><td>${SPECIES[s as keyof typeof SPECIES].plural}</td><td>${(v / tot * 100).toFixed(1)}%</td></tr>`).join('')}</table>`; },
  stab() { const g = UI.g!; const ps = kprovs(g, g.playerId).sort((a, b) => a.stability - b.stability); return `<h4>Estabilidad media</h4><p>Provincias menos estables:</p><table class="bd">${ps.slice(0, 6).map(p => `<tr><td>${esc(UI.w!.provinces[p.id].name)}</td><td class="${p.stability < 30 ? 'neg' : ''}">${Math.round(p.stability)}</td></tr>`).join('')}</table><p class="small muted">Abre una provincia para ver todos los factores.</p>`; },
  legit() { const k = playerK(UI.g!); return `<h4>Legitimidad de la corona</h4><p>${Math.round(k.legitimacy)}/100. Baja con las crisis sucesorias, las regencias y la ruptura de tratados; sube lentamente con el tiempo y las victorias.</p>`; },
  wars() { const g = UI.g!; return `<h4>Guerras</h4><ul>${warsOf(g, g.playerId).filter(x => g.kingdoms[x].alive).map(x => `<li>${esc(g.kingdoms[x].name)}</li>`).join('')}</ul>`; },
  date() { const g = UI.g!; return `<h4>${dateStr(g.turn)}</h4><p>Turno ${g.turn}. Cada turno es un mes. Las estaciones afectan a cosechas, movimiento y navegación (en el hemisferio sur van invertidas).</p>`; },
};
let TECHN = (id: string) => id; export function setTechName(f: (id: string) => string) { TECHN = f; }

// ---------- capas ----------
function renderLayers() {
  const a = UI.atlas!; $('#layers').innerHTML = LAYERS.map(l => `<button class="${a.layer === l.id ? 'on' : ''}" data-act="layer" data-l="${l.id}">${l.name}</button>`).join('');
  $('#legend').innerHTML = `<b>${LAYERS.find(l => l.id === a.layer)!.name}</b> · ${LEGENDS[a.layer] || ''}`;
}
act('layer', d => { UI.atlas!.layer = d.l!; UI.atlas!.overlayKey = ''; UI.atlas!.dirty = true; renderLayers(); });

// ---------- alertas ----------
function renderAlerts() {
  const g = UI.g!; const fresh = g.alerts.filter(a => !a.read && a.turn >= g.turn - 1).slice(0, 6);
  $('#alerts').innerHTML = fresh.map(a => `<div class="alert ${a.level}" data-act="alert" data-id="${a.id}"><span>${esc(a.text)}</span><button data-act="dismiss" data-id="${a.id}" title="Descartar">×</button></div>`).join('') + (g.events.length ? `<div class="alert critica" data-act="modal" data-m="evento"><span>⚑ ${g.events.length} decisión(es) pendiente(s): ${esc(g.events[0].title)}</span></div>` : '') + (g.pendingBattles.length ? `<div class="alert critica" data-act="battle"><span>⚔ Batalla pendiente: haz clic para dirigirla</span></div>` : '');
}
act('alert', d => { const g = UI.g!; const a = g.alerts.find(x => x.id === +d.id!); if (!a) return; a.read = true; if (a.focus) HOOK.focus(a.focus); renderAlerts(); });
act('dismiss', (d, el, ev) => { ev.stopPropagation(); const a = UI.g!.alerts.find(x => x.id === +d.id!); if (a) a.read = true; renderAlerts(); });
act('battle', () => openNextBattle());
act('chips', () => openModal('chips'));

// ---------- tiempo ----------
async function autosave() { const g = UI.g!; const k = playerK(g); try { await saveGame(g, 'auto', { name: 'Autoguardado', kingdom: k.name, turn: g.turn, date: dateStr(g.turn) }); } catch (e) { console.warn(e); toast('No se pudo autoguardar: ' + (e as Error).message, 'critica'); } }
export function openNextBattle() {
  const g = UI.g!; const b = g.pendingBattles[0]; if (!b || battleOpen()) return; stopAuto();
  openBattle($('#battle'), UI.w!, g, b, () => { UI.atlas!.refresh(); refreshAll(); autosave(); if (g.pendingBattles.length) setTimeout(openNextBattle, 30); else if (g.events.length) openModal('evento'); });
}
function blocked(): string | null { const g = UI.g!; if (g.pendingBattles.length) return 'battle'; if (g.events.length) return 'event'; return null; }
function doTurn(): 'ok' | 'stop' {
  const g = UI.g!, w = UI.w!; const b = blocked(); if (b === 'battle') { openNextBattle(); return 'stop'; } if (b === 'event') { openModal('evento'); toast('Antes de avanzar, decide sobre los asuntos pendientes.', 'importante'); return 'stop'; }
  const before = g.alerts[0]?.id || 0; const t0 = performance.now();
  endTurn(w, g); invalidateEco(); UI.atlas!.refresh();
  // sincroniza la selección si el ejército desapareció
  const sel = UI.atlas!.sel; if (sel.kind === 'army' && !g.armies.some(a => a.id === sel.id)) UI.atlas!.sel = { kind: null, id: -1 };
  if (UI.mode && !g.armies.some(a => a.id === UI.mode!.army)) UI.mode = null;
  refreshAll(); autosave();
  console.debug('turno', g.turn, Math.round(performance.now() - t0) + ' ms');
  const fresh = g.alerts.filter(a => a.id > before);
  if (g.expReports.length) { openModal('exprep'); return 'stop'; }
  if (g.pendingBattles.length) { setTimeout(openNextBattle, 30); return 'stop'; }
  if (g.events.length) { openModal('evento'); return 'stop'; }
  if (g.autoPause && fresh.some(a => a.level === 'critica')) { toast(fresh.find(a => a.level === 'critica')!.text, 'critica'); return 'stop'; }
  return 'ok';
}
let autoT = 0;
function stopAuto() { UI.auto = false; clearTimeout(autoT); }
function autoStep() { if (!UI.auto) return; if (UI.busy || battleOpen() || UI.modal === 'evento' || UI.modal === 'exprep') { stopAuto(); renderTop(); return; } const r = doTurn(); if (r === 'stop') { stopAuto(); renderTop(); return; } autoT = window.setTimeout(autoStep, UI.speed); }
act('turn', () => { if (UI.busy) return; UI.busy = true; try { doTurn(); } finally { UI.busy = false; renderTop(); } });
act('until', () => {
  if (UI.busy) return; UI.busy = true; renderTop(); let n = 0; const g = UI.g!;
  const step = () => { const before = g.alerts[0]?.id || 0; const r = doTurn(); n++; const imp = g.alerts.some(a => a.id > before && (a.level === 'critica' || a.level === 'importante')); if (r === 'stop' || imp || n >= 24) { UI.busy = false; renderTop(); if (imp && r !== 'stop') toast(g.alerts[0].text, 'importante'); return; } setTimeout(step, 16); };
  step();
});
act('auto', () => { UI.auto = !UI.auto; renderTop(); if (UI.auto) autoT = window.setTimeout(autoStep, 50); else clearTimeout(autoT); });
act('speed', (d, el) => { UI.speed = +(el as HTMLSelectElement).value; });

// ---------- movimiento de ejércitos ----------
export function planMove(armyId: number, dest: number) {
  const g = UI.g!, w = UI.w!; const a = g.armies.find(x => x.id === armyId); if (!a) return;
  const path = dest === a.prov ? [] : findPath(w, g, a, dest);
  UI.mode = { kind: 'move', army: armyId, dest, path }; UI.atlas!.preview = path ? [a.prov, ...path] : null; UI.atlas!.dirty = true; renderPanel();
}
act('move', d => { UI.mode = { kind: 'move', army: +d.id! }; UI.atlas!.preview = null; renderPanel(); toast('Haz clic en la provincia de destino (o clic derecho sobre el mapa).'); });
act('movecancel', () => { UI.mode = null; UI.atlas!.preview = null; UI.atlas!.dirty = true; renderPanel(); });
act('moveok', () => {
  const g = UI.g!; const m = UI.mode; if (!m || !m.path) return; const a = g.armies.find(x => x.id === m.army); if (!a) return;
  a.path = m.path.slice(); a.progress = 0; a.sieging = false; UI.mode = null; UI.atlas!.preview = null; UI.atlas!.dirty = true; toast(`${a.name} se pone en marcha.`); renderPanel();
});

// ---------- Atlas: ratón ----------
function bindMap(cv: HTMLCanvasElement) {
  let drag: { x: number; y: number; vx: number; vy: number; moved: boolean } | null = null; let lastHoverP = -2;
  const local = (e: MouseEvent) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const provAt = (sx: number, sy: number) => { const c = UI.atlas!.cellAt(sx, sy); return c < 0 ? -1 : UI.w!.prov[c]; };
  cv.addEventListener('mousedown', e => { if (e.button !== 0) return; const a = UI.atlas!; drag = { x: e.clientX, y: e.clientY, vx: a.vx, vy: a.vy, moved: false }; });
  window.addEventListener('mousemove', e => {
    const a = UI.atlas; if (!a) return;
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; if (drag.moved) { a.vx = drag.vx - dx / a.z; a.vy = drag.vy - dy / a.z; a.clamp(); a.dirty = true; cv.style.cursor = 'grabbing'; } return; }
    if (e.target !== cv) return; const [sx, sy] = local(e); const p = provAt(sx, sy);
    if (p !== lastHoverP) { lastHoverP = p; a.hover = p; a.dirty = true;
      if (UI.mode?.kind === 'move' && UI.mode.dest == null && p >= 0) { const ar = UI.g!.armies.find(x => x.id === UI.mode!.army); if (ar) { const path = findPath(UI.w!, UI.g!, ar, p); a.preview = path ? [ar.prov, ...path] : null; } }
    }
    const army = a.hitArmy(sx, sy); cv.style.cursor = UI.mode ? 'crosshair' : army != null ? 'pointer' : 'default';
    tip(cv, hoverTip(p, army), e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', e => {
    const a = UI.atlas; if (!a || !drag) return; const d = drag; drag = null; cv.style.cursor = 'default'; if (d.moved || e.target !== cv) return;
    const [sx, sy] = local(e); const g = UI.g!, w = UI.w!;
    if (UI.mode?.kind === 'move') { const p = provAt(sx, sy); if (p >= 0) planMove(UI.mode.army, p); return; }
    const ar = a.hitArmy(sx, sy); if (ar != null) { a.sel = { kind: 'army', id: ar }; UI.tab = 'resumen'; a.dirty = true; renderPanel(); return; }
    const ex = a.hitExp(sx, sy); if (ex != null) { a.sel = { kind: 'exp', id: ex }; a.dirty = true; renderPanel(); return; }
    const p = provAt(sx, sy); if (p >= 0 && knowLevel(w, g, g.playerId, p) >= 1) { if (!(a.sel.kind === 'prov' && a.sel.id === p)) UI.tab = 'resumen'; a.sel = { kind: 'prov', id: p }; } else a.sel = { kind: null, id: -1 };
    a.dirty = true; renderPanel();
  });
  cv.addEventListener('contextmenu', e => {
    e.preventDefault(); const a = UI.atlas!; const g = UI.g!; const [sx, sy] = local(e); const p = provAt(sx, sy); if (p < 0) return;
    const armyId = UI.mode?.army ?? (a.sel.kind === 'army' ? a.sel.id : -1); const ar = g.armies.find(x => x.id === armyId);
    if (ar && ar.owner === g.playerId) planMove(ar.id, p);
  });
  cv.addEventListener('wheel', e => {
    e.preventDefault(); const a = UI.atlas!; const [sx, sy] = local(e); const [wx, wy] = a.toWorld(sx, sy); const f = Math.exp(-e.deltaY * 0.0015);
    a.z = a.z * f; a.clamp(); a.vx = wx - sx / a.z; a.vy = wy - sy / a.z; a.clamp(); a.dirty = true;
  }, { passive: false });
  window.addEventListener('resize', () => { UI.atlas?.resize(); UI.atlas?.clamp(); });
}
function hoverTip(p: number, army: number | null): string | null {
  const g = UI.g!, w = UI.w!; if (army != null) { const a = g.armies.find(x => x.id === army)!; const own = a.owner === g.playerId; const men = armyMen(a); return `<b>${esc(own ? a.name : 'Ejército de ' + g.kingdoms[a.owner].short)}</b><br>${own ? fmt(men) : '≈' + fmt(Math.round(men / 500) * 500)} soldados${a.path.length ? '<br>En marcha' : ''}${own ? '' : '<br><small>Estimación por exploradores</small>'}`; }
  if (p < 0) return null; const lv = knowLevel(w, g, g.playerId, p); if (lv === 0) return '<i>Tierras desconocidas</i>';
  const s = w.provinces[p], st = g.provinces[p]; const per = UI.atlas!.per[p];
  const owner = per >= 0 ? g.kingdoms[per].name : per === -1 ? 'Sin dueño' : 'Desconocido';
  let mv = ''; if (UI.mode?.kind === 'move' && UI.atlas!.preview && UI.mode.dest == null) { const ar = g.armies.find(x => x.id === UI.mode!.army); if (ar) { const info = pathInfo(w, g, ar, UI.atlas!.preview.slice(1)); mv = `<br><b>Llegada: ≈${Math.max(1, Math.ceil(info.months))} mes(es)</b>${info.risks.length ? '<br><span class="neg">' + info.risks.map(esc).join('<br>') + '</span>' : ''}`; } }
  return `<b>${esc(s.name)}</b>${lv >= 2 ? ' · ' + esc(st.cityName) : ''}<br>${owner}${lv === 2 ? ` <small>(visto hace ${g.turn - g.kingdoms[g.playerId].lastSeen[p]} meses)</small>` : ''}${lv === 1 ? '<br><small>Solo cartografiada</small>' : ''}${mv}`;
}

// ---------- delegación global ----------
export function bindGlobal() {
  document.addEventListener('click', e => { const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null; if (!el || (el as HTMLButtonElement).disabled) return; if ($('#battle').contains(el)) return; const f = ACTIONS[el.dataset.act!]; if (f) { e.preventDefault(); f(el.dataset, el, e); } });
  document.addEventListener('change', e => { const el = e.target as HTMLElement; const n = el.dataset?.actChange; if (n && ACTIONS[n]) ACTIONS[n](el.dataset, el, e); });
  document.addEventListener('mouseover', e => { const el = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement | null; if (!el) { if (!(e.target as HTMLElement).closest('#map')) tip(null, null); return; } const f = TIPS[el.dataset.tip!]; if (f && UI.g) { const r = el.getBoundingClientRect(); tip(el, f(el), r.left, r.bottom); } });
  document.addEventListener('keydown', e => {
    if ((e.target as HTMLElement).matches('input,select,textarea')) return; if (battleOpen()) return;
    if (e.key === ' ' && UI.g && !$('#app').hidden) { e.preventDefault(); ACTIONS.turn({}, document.body, e); }
    if (e.key === 'Escape') { if (UI.mode) ACTIONS.movecancel({}, document.body, e); else if (UI.modal) closeModal(); }
  });
}
