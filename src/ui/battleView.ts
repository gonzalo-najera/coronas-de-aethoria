// Vista táctica de batalla. Todo lo que se dibuja procede del estado del motor (grupos, fotogramas registrados por tick).
import type { World } from '../engine/world';
import type { GameState } from '../engine/types';
import { UNIT, SPECIES } from '../engine/data';
import {
  BattleState, BGroup, BW, BH, TILE, SECTORS, SECTOR_NAMES, ORDER_NAMES, Order, Intensity, INT, FORMATIONS, Deployment, Sector,
  formationDeployment, applyDeployment, moveDeployed, deployZone, assessment, enemyEstimate, hiddenFrom, alive, desperateAllowed, runPhase, aiOrders, sideTotals, tileAt, unitCat,
  ST, rangeOf,
} from '../engine/battle';
import { applyBattle } from '../engine/turn';
import { tierName } from '../engine/milcat';
import { portrait } from './art';
import { esc, fmt, $ } from './util';

const ORDERS: Order[] = ['mantener', 'avanzar', 'atacar', 'cargar', 'flanquear', 'hostigar', 'disparar', 'replegarse', 'retirarse', 'perseguir', 'reforzar'];
const ORDER_HELP: Record<Order, string> = {
  mantener: 'Conserva la posición y recupera cohesión.', avanzar: 'Se acerca al enemigo más próximo (los tiradores se detienen al tener alcance).', atacar: 'Choca contra el objetivo (o el enemigo más cercano).',
  cargar: 'Carrera de choque: gran impacto inicial, mucha fatiga. Ideal para caballería y tropas pesadas.', flanquear: 'Rodea al objetivo para golpear su flanco.', hostigar: 'Dispara y se retira si el enemigo se acerca.',
  disparar: 'Dispara sin moverse al enemigo a su alcance.', replegarse: 'Retrocede ordenadamente hasta la línea propia.', retirarse: 'Abandona el campo de batalla (no cuenta como huida).',
  perseguir: 'Persigue a las unidades que huyen para capturarlas.', reforzar: 'Se coloca detrás de un grupo aliado para sostenerlo.',
};
const NEEDS_ENEMY: Order[] = ['atacar', 'cargar', 'flanquear', 'perseguir'];
const INT_NAMES: Record<Intensity, string> = { prudente: 'Prudente', equilibrada: 'Equilibrada', agresiva: 'Agresiva', desesperada: 'Desesperada' };
const INT_HELP: Record<Intensity, string> = { prudente: 'Menos daño causado y recibido, menos fatiga.', equilibrada: 'Valores base.', agresiva: '+38% daño causado, +28% recibido, +60% fatiga.', desesperada: '+85% daño, +65% recibido; puede acabar en colapso. Solo con inferioridad grave o moral baja.' };
const STATUS_NAMES: Record<string, string> = { formado: 'Formado', combatiendo: 'Combatiendo', desorganizado: 'Desorganizado', huida: 'En huida', retirado: 'Retirado', destruido: 'Destruido' };
const TILE_COL = ['#b9b37a', '#5e7d45', '#a99a68', '#5f8fa8', '#8fa0a0', '#cdb98a', '#77706a', '#6f7d5a', '#e8ebef'];

interface View { w: World; g: GameState; b: BattleState; root: HTMLElement; cv: HTMLCanvasElement; T: number; sel: number | null; picking: null | 'enemy' | 'friend'; anim: null | { t0: number; from: Map<number, { x: number; y: number; men: number }>; }; dep: Deployment; drag: BGroup | null; done: (rep: any) => void; rep: any; hover: BGroup | null; formation: string; logPh: number }
let V: View | null = null;

export function openBattle(root: HTMLElement, w: World, g: GameState, b: BattleState, done: (rep: any) => void) {
  root.hidden = false;
  root.innerHTML = `<div class="bt-wrap"><header class="bt-head"></header><div class="bt-body"><div class="bt-field"><canvas></canvas><div class="bt-legend"></div></div><aside class="bt-side"></aside></div></div>`;
  const cv = root.querySelector('canvas') as HTMLCanvasElement;
  V = { w, g, b, root, cv, T: 28, sel: null, picking: null, anim: null, dep: {}, drag: null, done, rep: null, hover: null, formation: 'equilibrada', logPh: -1 };
  if (b.stage === 'despliegue' || (b.stage === 'reconocimiento' && b.groups.some(x => x.side === 0))) { /* reanudar */ }
  if (!b.groups.some(x => x.side === 0)) { V.dep = formationDeployment(b.sides[0], 'equilibrada'); applyDeployment(b, 0, V.dep); }
  else V.dep = depFromGroups(b);
  cv.addEventListener('mousedown', onDown); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  window.addEventListener('resize', layout);
  root.onclick = onClick; root.onchange = onChange; root.oninput = onInput;
  layout(); render();
}
function close() { if (!V) return; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); window.removeEventListener('resize', layout); V.root.hidden = true; V.root.innerHTML = ''; const d = V.done, r = V.rep; V = null; d(r); }
function depFromGroups(b: BattleState): Deployment { const d: Deployment = {}; for (const g of b.groups) if (g.side === 0) { const e = d[g.type] || (d[g.type] = {}); e[g.sector] = (e[g.sector] || 0) + g.startMen; } return d; }

function layout() {
  if (!V) return; const box = V.root.querySelector('.bt-field') as HTMLElement; const r = box.getBoundingClientRect();
  V.T = Math.max(14, Math.floor(Math.min((r.width - 8) / BW, (r.height - 40) / BH)));
  const dpr = window.devicePixelRatio || 1; V.cv.style.width = V.T * BW + 'px'; V.cv.style.height = V.T * BH + 'px'; V.cv.width = V.T * BW * dpr; V.cv.height = V.T * BH * dpr; draw();
}

// ---------- dibujo ----------
function posOf(g: BGroup): { x: number; y: number; men: number; w: number } {
  if (!V!.anim) return { x: g.x, y: g.y, men: g.men, w: g.w };
  const b = V!.b; const nF = b.frames.length; const t = Math.min(1, (performance.now() - V!.anim.t0) / (nF * 260)); const fi = t * nF; const i = Math.min(nF - 1, Math.floor(fi)); const f = fi - i;
  const cur = b.frames[i].g.find(q => q.id === g.id); const prevF = i === 0 ? V!.anim.from.get(g.id) : b.frames[i - 1].g.find(q => q.id === g.id);
  if (!cur) return { x: g.x, y: g.y, men: g.men, w: g.w }; if (!prevF) return { x: cur.x, y: cur.y, men: cur.men, w: cur.w };
  return { x: prevF.x + (cur.x - prevF.x) * f, y: prevF.y + (cur.y - prevF.y) * f, men: Math.round(prevF.men + (cur.men - prevF.men) * f), w: cur.w };
}
function frameStatus(g: BGroup) { if (!V!.anim) return g.status; const b = V!.b; const nF = b.frames.length; const t = Math.min(1, (performance.now() - V!.anim.t0) / (nF * 260)); const i = Math.min(nF - 1, Math.floor(t * nF)); return b.frames[i].g.find(q => q.id === g.id)?.st || g.status; }
function draw() {
  if (!V) return; const { cv, b, T } = V; const c = cv.getContext('2d')!; const dpr = window.devicePixelRatio || 1; c.setTransform(dpr, 0, 0, dpr, 0, 0);
  // terreno
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) { const t = b.tiles[y * BW + x]; c.fillStyle = TILE_COL[t]; c.fillRect(x * T, y * T, T + 0.5, T + 0.5); }
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const t = b.tiles[y * BW + x]; const px = x * T, py = y * T; const hsh = (x * 73 + y * 151) % 7;
    if (t === 1) { for (let k = 0; k < 3; k++) { const ox = px + ((hsh + k * 3) % 5 + 1) * T / 6, oy = py + ((hsh * 2 + k * 5) % 5 + 1) * T / 6; c.fillStyle = '#3e5a30'; c.beginPath(); c.arc(ox, oy, T * 0.2, 0, 7); c.fill(); c.fillStyle = '#4f6e3c'; c.beginPath(); c.arc(ox - T * 0.05, oy - T * 0.06, T * 0.12, 0, 7); c.fill(); } }
    else if (t === 2) { c.strokeStyle = 'rgba(90,70,40,.55)'; c.lineWidth = 1; c.beginPath(); c.arc(px + T / 2, py + T * 0.8, T * 0.42, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    else if (t === 3) { c.strokeStyle = 'rgba(220,235,245,.5)'; c.beginPath(); c.moveTo(px, py + T * 0.4); c.quadraticCurveTo(px + T / 2, py + T * 0.25, px + T, py + T * 0.45); c.stroke(); }
    else if (t === 4) { c.fillStyle = '#8a6a44'; c.fillRect(px, py + T * 0.2, T, T * 0.6); c.strokeStyle = '#5a4026'; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(px + k * T / 4, py + T * 0.2); c.lineTo(px + k * T / 4, py + T * 0.8); c.stroke(); } }
    else if (t === 6) { c.fillStyle = '#5e5852'; c.beginPath(); c.moveTo(px + T * 0.1, py + T * 0.9); c.lineTo(px + T * 0.45, py + T * 0.15); c.lineTo(px + T * 0.9, py + T * 0.9); c.fill(); }
    else if (t === 7) { c.strokeStyle = 'rgba(40,60,40,.6)'; c.beginPath(); c.moveTo(px + T * 0.3, py + T * 0.7); c.lineTo(px + T * 0.25, py + T * 0.35); c.moveTo(px + T * 0.6, py + T * 0.7); c.lineTo(px + T * 0.65, py + T * 0.3); c.stroke(); }
  }
  c.strokeStyle = 'rgba(40,30,20,.08)'; c.lineWidth = 1; for (let x = 0; x <= BW; x++) { c.beginPath(); c.moveTo(x * T, 0); c.lineTo(x * T, BH * T); c.stroke(); } for (let y = 0; y <= BH; y++) { c.beginPath(); c.moveTo(0, y * T); c.lineTo(BW * T, y * T); c.stroke(); }
  // zonas de despliegue
  if (b.stage === 'despliegue' || b.stage === 'reconocimiento') { const [y0, y1] = deployZone(0); c.fillStyle = 'rgba(60,120,200,.12)'; c.fillRect(0, y0 * T, BW * T, (y1 - y0) * T); c.strokeStyle = 'rgba(60,120,200,.6)'; c.setLineDash([6, 4]); c.strokeRect(1, y0 * T, BW * T - 2, (y1 - y0) * T); c.setLineDash([]); }
  // efectos del fotograma actual
  if (V.anim && b.frames.length) {
    const nF = b.frames.length; const t = Math.min(1, (performance.now() - V.anim.t0) / (nF * 260)); const i = Math.min(nF - 1, Math.floor(t * nF)); const fr = b.frames[i];
    for (const e of fr.fx) { const A = b.groups.find(q => q.id === e.a), B = b.groups.find(q => q.id === e.b); if (!A || !B) continue; const pa = posOf(A), pb = posOf(B); if (hiddenFrom(b, 0, A) && hiddenFrom(b, 0, B)) continue;
      if (e.k === 'tiro') { c.strokeStyle = 'rgba(40,30,20,.55)'; c.lineWidth = 1; c.setLineDash([2, 4]); c.beginPath(); c.moveTo(pa.x * T, pa.y * T); c.quadraticCurveTo((pa.x + pb.x) / 2 * T, (Math.min(pa.y, pb.y) - 1.5) * T, pb.x * T, pb.y * T); c.stroke(); c.setLineDash([]); }
      else { const mx = (pa.x + pb.x) / 2 * T, my = (pa.y + pb.y) / 2 * T; c.fillStyle = 'rgba(200,40,20,.6)'; for (let k = 0; k < 4; k++) { const a = (performance.now() / 90 + k * 1.6) % 6.28; c.beginPath(); c.arc(mx + Math.cos(a) * T * 0.3, my + Math.sin(a) * T * 0.2, 2, 0, 7); c.fill(); } } }
  }
  // grupos
  const sel = V.sel != null ? b.groups.find(q => q.id === V!.sel) : null;
  if (sel && alive(sel)) { const d = ST(sel); { const p = posOf(sel); const V2 = 4.5 + d.recon / 40; c.strokeStyle = 'rgba(80,90,110,.55)'; c.setLineDash([2, 5]); c.beginPath(); c.arc(p.x * T, p.y * T, V2 * T, 0, 7); c.stroke(); c.setLineDash([]); } if (d.range > 0 && (sel.ammo ?? 1) > 0) { const p = posOf(sel); const R = rangeOf(b, sel); c.strokeStyle = 'rgba(200,150,40,.8)'; c.fillStyle = 'rgba(230,190,80,.1)'; c.setLineDash([5, 4]); c.beginPath(); c.arc(p.x * T, p.y * T, R * T, 0, 7); c.fill(); c.stroke(); c.setLineDash([]); }
    if (sel.target != null) { const tg = b.groups.find(q => q.id === sel.target); if (tg && !(tg.side === 1 && hiddenFrom(b, 0, tg))) { const p = posOf(sel), q = posOf(tg); c.strokeStyle = tg.side === 0 ? 'rgba(40,120,60,.9)' : 'rgba(180,30,20,.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x * T, p.y * T); c.lineTo(q.x * T, q.y * T); c.stroke(); } } }
  for (const g of b.groups) {
    const st = frameStatus(g); if (st === 'retirado' || st === 'destruido') continue; if (g.side === 1 && hiddenFrom(b, 0, g)) continue;
    const p = posOf(g); const col = b.sides[g.side].color; const x0 = (p.x - p.w / 2) * T, y0 = (p.y - 0.42) * T, ww = p.w * T, hh = 0.84 * T;
    c.globalAlpha = st === 'huida' ? 0.5 : 1;
    c.fillStyle = col; c.strokeStyle = g.side === 0 ? '#f6ecd0' : '#1a1008'; c.lineWidth = 2; c.fillRect(x0, y0, ww, hh); c.strokeRect(x0, y0, ww, hh);
    if (st === 'desorganizado') { c.strokeStyle = 'rgba(255,255,255,.7)'; c.setLineDash([3, 3]); c.strokeRect(x0 + 2, y0 + 2, ww - 4, hh - 4); c.setLineDash([]); }
    if (st === 'huida') { c.strokeStyle = 'rgba(0,0,0,.6)'; c.beginPath(); for (let k = -hh; k < ww; k += 5) { c.moveTo(x0 + k, y0 + hh); c.lineTo(x0 + k + hh, y0); } c.save(); c.clip(); c.stroke(); c.restore(); }
    // símbolo de la unidad
    sym(c, unitSym(g.type), x0 + ww / 2, y0 + hh / 2, Math.min(hh * 0.8, ww * 0.9));
    // frente (hacia el enemigo)
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x0, g.side === 0 ? y0 : y0 + hh - 3, ww, 3);
    c.globalAlpha = 1;
    // efectivos (el enemigo según la calidad de la información)
    c.font = `600 ${Math.max(9, T * 0.38)}px "EB Garamond", Georgia, serif`; c.textAlign = 'center'; const txt = g.side === 0 || b.stage === 'fin' ? fmt(p.men) : enemyEstimate(b, 0, p.men).txt;
    c.lineWidth = 3; c.strokeStyle = 'rgba(245,235,210,.95)'; c.strokeText(txt, x0 + ww / 2, y0 + hh + T * 0.42); c.fillStyle = '#20140a'; c.fillText(txt, x0 + ww / 2, y0 + hh + T * 0.42);
    if (g.id === V.sel) { c.strokeStyle = '#ffd34d'; c.lineWidth = 3; c.strokeRect(x0 - 3, y0 - 3, ww + 6, hh + 6); }
    if (V.hover === g) { c.strokeStyle = 'rgba(255,240,180,.8)'; c.lineWidth = 1.5; c.strokeRect(x0 - 2, y0 - 2, ww + 4, hh + 4); }
    // barra de moral
    if (g.side === 0 || b.info[0] > 0.5) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x0, y0 - 5, ww, 3); c.fillStyle = g.morale > 50 ? '#5c9a4a' : g.morale > 25 ? '#d0a030' : '#c0392b'; c.fillRect(x0, y0 - 5, ww * Math.min(1, g.morale / 100), 3); }
  }
  if (V.picking) { c.fillStyle = 'rgba(30,20,10,.65)'; c.fillRect(0, 0, BW * T, 26); c.fillStyle = '#ffe9a8'; c.font = '600 14px "EB Garamond", Georgia, serif'; c.textAlign = 'center'; c.fillText(V.picking === 'enemy' ? 'Haz clic en el grupo enemigo objetivo (Esc: el más cercano)' : 'Haz clic en el grupo aliado al que reforzar', BW * T / 2, 18); }
  if (V.anim) { if (performance.now() - V.anim.t0 < V.b.frames.length * 260) requestAnimationFrame(draw); else { V.anim = null; render(); } }
}
function unitSym(type: string) { return UNIT[type].symbol; }
function sym(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number) {
  c.save(); c.translate(x, y); const k = size / 20; c.scale(k, k); c.strokeStyle = 'rgba(255,250,235,.95)'; c.fillStyle = 'rgba(255,250,235,.95)'; c.lineWidth = 2 / Math.max(0.6, k) * 1.2;
  c.beginPath();
  switch (s) {
    case 'inf': c.moveTo(-8, -6); c.lineTo(8, 6); c.moveTo(8, -6); c.lineTo(-8, 6); break;
    case 'pike': c.moveTo(-8, 7); c.lineTo(6, -7); c.moveTo(-2, 7); c.lineTo(10, -5); c.moveTo(-10, 5); c.lineTo(2, -8); break;
    case 'bow': c.arc(-2, 0, 8, -1.2, 1.2); c.moveTo(1, -7.5); c.lineTo(1, 7.5); c.moveTo(-6, 0); c.lineTo(9, 0); break;
    case 'heavy': c.rect(-8, -6, 16, 12); c.moveTo(-8, -6); c.lineTo(8, 6); c.moveTo(8, -6); c.lineTo(-8, 6); break;
    case 'cav': c.moveTo(-9, 6); c.lineTo(9, -6); c.moveTo(-6, -4); c.quadraticCurveTo(0, -10, 6, -4); break;
    case 'scout': c.arc(0, 0, 6, 0, 7); c.moveTo(-9, 0); c.lineTo(9, 0); break;
    case 'shield': c.moveTo(-7, -7); c.lineTo(7, -7); c.lineTo(7, 1); c.quadraticCurveTo(0, 9, -7, 1); c.closePath(); break;
    case 'giant': c.arc(0, -4, 4, 0, 7); c.moveTo(-8, 8); c.lineTo(0, 0); c.lineTo(8, 8); break;
    case 'siege': c.moveTo(-9, 6); c.lineTo(9, 6); c.moveTo(-6, 6); c.lineTo(0, -6); c.lineTo(6, 6); c.moveTo(0, -6); c.lineTo(-8, -8); c.moveTo(-6, 9); c.arc(-6, 9, 1.5, 0, 7); c.moveTo(6, 9); c.arc(6, 9, 1.5, 0, 7); break;
    default: c.arc(0, 0, 6, 0, 7);
  }
  c.stroke(); c.restore();
}

// ---------- interacción en el lienzo ----------
function groupAt(ev: MouseEvent): BGroup | null {
  if (!V) return null; const r = V.cv.getBoundingClientRect(); const x = (ev.clientX - r.left) / V.T, y = (ev.clientY - r.top) / V.T;
  let best: BGroup | null = null; for (const g of V.b.groups) { if (!['formado', 'combatiendo', 'desorganizado', 'huida'].includes(g.status)) continue; if (g.side === 1 && hiddenFrom(V.b, 0, g)) continue; if (Math.abs(x - g.x) <= g.w / 2 + 0.2 && Math.abs(y - g.y) <= 0.6) best = g; }
  return best;
}
function onDown(ev: MouseEvent) {
  if (!V || V.anim) return; const g = groupAt(ev);
  if (V.picking && g) { const s = V.b.groups.find(q => q.id === V!.sel)!; if (V.picking === 'enemy' && g.side === 1) { s.target = g.id; V.picking = null; render(); return; } if (V.picking === 'friend' && g.side === 0 && g.id !== s.id) { s.target = g.id; V.picking = null; render(); return; } return; }
  if (g) { V.sel = g.id; if (V.b.stage === 'despliegue' && g.side === 0) V.drag = g; render(); }
}
function onMove(ev: MouseEvent) {
  if (!V) return; if (V.drag) { const r = V.cv.getBoundingClientRect(); moveDeployed(V.b, V.drag, (ev.clientX - r.left) / V.T, (ev.clientY - r.top) / V.T); draw(); return; }
  if (ev.target === V.cv) { const g = groupAt(ev); if (g !== V.hover) { V.hover = g; draw(); const tipEl = V.root.querySelector('.bt-legend') as HTMLElement; tipEl.innerHTML = g ? groupLine(g) : legendHtml(); } }
}
function onUp() { if (V?.drag) { V.drag = null; render(); } }
function groupLine(g: BGroup) {
  const b = V!.b; const d = UNIT[g.type]; const tn = TILE[tileAt(b, g.x, g.y)].n;
  if (g.side === 1 && b.info[0] < 0.5) return `<b>Tropas enemigas</b> · ${enemyEstimate(b, 0, g.men).txt} · terreno: ${tn} (información escasa)`;
  return `<b>${esc(d.name)}</b> (${g.side === 0 ? 'propia' : 'enemiga'}) · ${SECTOR_NAMES[g.sector]} · ${g.side === 0 ? fmt(g.men) : enemyEstimate(b, 0, g.men).txt} efectivos · ${STATUS_NAMES[g.status]} · moral ${Math.round(g.morale)} · terreno: ${tn}${g.side === 0 ? ' · orden: ' + ORDER_NAMES[g.order] : ''}`;
}
function legendHtml() { return `<span class="lg" style="--c:${TILE_COL[0]}"></span>Llano <span class="lg" style="--c:${TILE_COL[1]}"></span>Bosque (oculta, +20% def.) <span class="lg" style="--c:${TILE_COL[2]}"></span>Colina (+25% def., +1 alcance) <span class="lg" style="--c:${TILE_COL[3]}"></span>Río <span class="lg" style="--c:${TILE_COL[4]}"></span>Vado <span class="lg" style="--c:${TILE_COL[6]}"></span>Roca <span class="lg" style="--c:${TILE_COL[7]}"></span>Pantano`; }

// ---------- paneles ----------
function render() {
  if (!V) return; const { b, g } = V; const S0 = b.sides[0], S1 = b.sides[1]; const t0 = sideTotals(b, 0), t1 = sideTotals(b, 1);
  const tot = (s: 0 | 1) => b.groups.filter(q => q.side === s).reduce((x, q) => x + q.men, 0) || b.sides[s].units.reduce((x, u) => x + u.men, 0);
  const stageN = { reconocimiento: '1 · Reconocimiento', despliegue: '2 · Despliegue', combate: `3 · Combate — fase ${b.phase}/${b.maxPhases}`, fin: '4 · Informe' }[b.stage];
  (V.root.querySelector('.bt-head') as HTMLElement).innerHTML = `<div class="bt-title"><small>Batalla de</small> ${esc(b.fieldName)}</div>
    <div class="bt-sides"><span class="sw" style="background:${S0.color}"></span>${esc(S0.name)} <b>${fmt(tot(0))}</b> ${b.attackerSide === 0 ? '(atacante)' : '(defensor)'} <span class="vs">contra</span> <span class="sw" style="background:${S1.color}"></span>${esc(S1.name)} <b>${b.stage === 'fin' ? fmt(tot(1)) : enemyEstimate(b, 0, tot(1)).txt}</b></div>
    <div class="bt-stage">${stageN}</div>`;
  const side = V.root.querySelector('.bt-side') as HTMLElement;
  if (b.stage === 'reconocimiento') side.innerHTML = reconHtml();
  else if (b.stage === 'despliegue') side.innerHTML = deployHtml();
  else if (b.stage === 'combate') side.innerHTML = combatHtml();
  else side.innerHTML = reportHtml();
  (V.root.querySelector('.bt-legend') as HTMLElement).innerHTML = legendHtml();
  draw();
}
function reconHtml() {
  const b = V!.b; const a = assessment(b, 0); const S1 = b.sides[1]; const gen0 = b.sides[0].general, gen1 = b.sides[1].general;
  const list = (t: string, arr: string[], cls: string) => arr.length ? `<h4>${t}</h4><ul class="${cls}">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const enemy = b.info[0] > 0.5 ? S1.units.map(u => `<tr><td>${esc(UNIT[u.type].name)}</td><td>${enemyEstimate(b, 0, u.men).txt}</td></tr>`).join('') : `<tr><td>Fuerzas sin identificar</td><td>${enemyEstimate(b, 0, S1.units.reduce((s, u) => s + u.men, 0)).txt}</td></tr>`;
  return `<h3>Informe de reconocimiento</h3>
  <p class="small">Calidad de la información: <b>${a.quality}</b> (${Math.round(a.q * 100)}%). Depende de los exploradores, la caballería centaura y la inteligencia del general.${a.q <= 0.6 ? ' Las tropas enemigas en bosques permanecerán ocultas hasta que te acerques.' : ''}</p>
  <div class="gens">${gen0 ? `<div>${portrait(gen0, 48)}<small>${esc(gen0.name)}<br>Estrategia ${gen0.estrategia} · Liderazgo ${gen0.liderazgo}</small></div>` : ''}${gen1 ? `<div>${b.info[0] > 0.5 ? portrait(gen1, 48) : '<div class="unknown-face">?</div>'}<small>${b.info[0] > 0.5 ? esc(gen1.name) + '<br>Estrategia ' + gen1.estrategia : 'General enemigo desconocido'}</small></div>` : ''}</div>
  <h4>Terreno</h4><ul>${b.features.map(f => `<li>${esc(f)}</li>`).join('') || '<li>Campo abierto sin accidentes notables</li>'}</ul>
  ${list('Ventajas', a.adv, 'good')}${list('Vulnerabilidades', a.vul, 'bad')}${list('Posiciones defensivas', a.def, '')}${list('Rutas de flanqueo', a.flank, '')}${list('Riesgos', a.risk, 'bad')}
  <h4>Fuerzas enemigas estimadas</h4><table class="tbl">${enemy}</table>
  <div class="btns"><button class="primary" data-b="todeploy">Pasar al despliegue</button><button data-b="auto">Resolución automática</button></div>
  <p class="small muted">La resolución automática usa exactamente el mismo motor de combate, con las órdenes de tu mariscal.</p>`;
}
function deployHtml() {
  const b = V!.b; const S0 = b.sides[0]; const hasForest = b.tiles.filter(t => t === 1).length > 12;
  const forms = Object.entries(FORMATIONS).map(([id, f]) => { const ok = !f.needs || hasForest; return `<button class="chip ${V!.formation === id ? 'on' : ''}" data-b="form" data-f="${id}" ${ok ? '' : 'disabled'} title="${esc(f.desc)}${ok ? '' : ' (no hay bosque)'}">${esc(f.name)}</button>`; }).join('');
  const rows = S0.units.map(u => { const e = V!.dep[u.type] || {}; const used = SECTORS.reduce((s, x) => s + (e[x] || 0), 0); return `<tr><td>${esc(UNIT[u.type].name)}<br><small class="${used !== u.men ? 'neg' : 'muted'}">${fmt(used)} / ${fmt(u.men)}</small></td>${SECTORS.map(s => `<td><input type="number" min="0" step="10" value="${e[s] || 0}" data-dep="${u.type}" data-sec="${s}"></td>`).join('')}</tr>`; }).join('');
  return `<h3>Despliegue</h3>
  <p class="small">Elige una formación, ajusta cuántos soldados de cada tipo van a cada sector o arrastra los grupos dentro de la zona azul.</p>
  <div class="chips">${forms}</div>
  <div class="scrollx"><table class="tbl dep"><tr><th>Unidad</th>${SECTORS.map(s => `<th>${SECTOR_NAMES[s].replace('Flanco ', 'Fl. ')}</th>`).join('')}</tr>${rows}</table></div>
  <p class="small muted">Anchura mínima del frente: ${b.minWidth} casillas. Los grupos más anchos que el terreno disponible se estrechan (y pierden frente de combate).</p>
  <div class="btns"><button data-b="autodep">Distribuir automáticamente</button><button class="primary" data-b="start">Comenzar la batalla</button></div>
  <div class="btns"><button data-b="auto">Resolución automática</button></div>`;
}
function combatHtml() {
  const b = V!.b; const sel = V!.sel != null ? b.groups.find(q => q.id === V!.sel) : null; const desp = desperateAllowed(b, 0);
  let gi = '<p class="small muted">Selecciona uno de tus grupos en el campo para darle órdenes. Los grupos sin órdenes nuevas mantienen la última.</p>';
  if (sel && sel.side === 0) {
    const d = ST(sel); const tgt = sel.target != null ? b.groups.find(q => q.id === sel.target) : null;
    gi = `<div class="grp"><h4>${esc(d.name)} · ${SECTOR_NAMES[sel.sector]}</h4>
    <div class="stats"><span>Efectivos <b>${fmt(sel.men)}</b>/${fmt(sel.startMen)}</span><span>Estado <b>${STATUS_NAMES[sel.status]}</b></span><span>Moral <b>${Math.round(sel.morale)}</b></span><span>Cohesión <b>${Math.round(sel.cohesion)}</b></span><span>Fatiga <b>${Math.round(sel.fatigue)}</b></span><span>Experiencia <b>${Math.round(sel.exp * 100)}%</b></span><span>Terreno <b>${TILE[tileAt(b, sel.x, sel.y)].n}</b></span><span>Equipo <b>${tierName(sel.tier ?? 2)}</b></span><span>Armadura <b>${ST(sel).armor}</b></span>${d.range ? `<span>Alcance <b>${rangeOf(b, sel)}</b></span><span>Munición <b class="${(sel.ammo ?? 1) <= 0 ? 'neg' : ''}">${sel.ammo ?? '—'}/${sel.maxAmmo ?? '—'}</b></span>${d.reload > 1 ? `<span>Recarga <b>${(sel.rl || 0) > 0 ? 'recargando' : 'lista'}</b></span>` : ''}` : ''}${sel.train ? '<span class="neg">En instrucción</span>' : ''}</div>
    <p class="small muted">Círculo dorado: alcance de tiro real (solo si queda munición). Círculo gris punteado: radio aproximado en el que detecta tropas ocultas en bosques.</p>
    <p class="small">Bajas: ${fmt(sel.killed)} muertos, ${fmt(sel.wounded)} heridos, ${fmt(sel.captured)} capturados, ${fmt(sel.deserted)} desertores, ${fmt(sel.dispersed)} dispersos.</p>
    ${alive(sel) ? `<h4>Orden: ${ORDER_NAMES[sel.order]}${tgt ? ' → ' + (tgt.side === 1 && hiddenFrom(b, 0, tgt) ? 'objetivo oculto' : esc(UNIT[tgt.type].name)) : ''}</h4>
    <div class="orders">${ORDERS.map(o => { const dis = (o === 'disparar' || o === 'hostigar') && (d.range === 0 || (sel.ammo ?? 1) <= 0) || (o === 'perseguir' && !b.groups.some(q => q.side === 1 && q.status === 'huida')); return `<button class="${sel.order === o ? 'on' : ''}" data-b="order" data-o="${o}" ${dis ? 'disabled' : ''} title="${esc(ORDER_HELP[o])}">${ORDER_NAMES[o]}</button>`; }).join('')}</div>
    <h4>Intensidad</h4><div class="orders">${(Object.keys(INT) as Intensity[]).map(i => `<button class="${sel.intensity === i ? 'on' : ''}" data-b="int" data-i="${i}" ${i === 'desesperada' && !desp ? 'disabled' : ''} title="${esc(INT_HELP[i])}">${INT_NAMES[i]}</button>`).join('')}</div>
    <div class="btns"><button data-b="intall" data-i="${sel.intensity}">Aplicar esta intensidad a todos</button></div>` : '<p class="neg">Este grupo ya no puede recibir órdenes.</p>'}</div>`;
  } else if (sel) gi = `<div class="grp"><h4>Grupo enemigo</h4><p class="small">${groupLine(sel)}</p></div>`;
  const myG = b.groups.filter(q => q.side === 0);
  const ov = myG.map(q => `<tr class="${q.id === V!.sel ? 'on' : ''}" data-b="sel" data-g="${q.id}"><td>${esc(UNIT[q.type].name)}<br><small class="muted">${SECTOR_NAMES[q.sector]}</small></td><td>${fmt(q.men)}</td><td>${STATUS_NAMES[q.status]}</td><td>${alive(q) ? ORDER_NAMES[q.order] : '—'}</td></tr>`).join('');
  const logs = b.log.filter(l => l.phase === b.phase).slice(-14).map(l => `<li class="${l.side === 0 ? 'mine' : l.side === 1 ? 'theirs' : ''}">${esc(l.text)}</li>`).join('');
  return `${gi}
  <div class="btns"><button class="primary" data-b="phase" ${V!.anim ? 'disabled' : ''}>Ejecutar fase ${b.phase + 1}</button><button data-b="delegate" title="El mariscal da órdenes a los grupos que siguen en 'mantener'">Delegar órdenes secundarias</button></div>
  <div class="btns"><button data-b="marshal" title="Tu mariscal ordena a todos los grupos esta fase">Fase dirigida por el mariscal</button><button data-b="rest">Resolver el resto automáticamente</button></div>
  <h4>Tus grupos</h4><table class="tbl sm clickable">${ov}</table>
  ${logs ? `<h4>Fase ${b.phase}</h4><ul class="blog">${logs}</ul>` : ''}`;
}
function reportHtml() {
  const b = V!.b; const rep = V!.rep; const win = b.winner;
  const t = [sideTotals(b, 0), sideTotals(b, 1)]; const won = win === 0;
  const row = (l: string, k: keyof ReturnType<typeof sideTotals>) => `<tr><td>${l}</td><td>${fmt(t[0][k] as number)}</td><td>${fmt(t[1][k] as number)}</td></tr>`;
  return `<h3 class="${won ? 'pos' : 'neg'}">${won ? 'Victoria' : 'Derrota'} en ${esc(b.fieldName)}</h3>
  <p class="small">${b.phase} fases de combate.</p>
  <table class="tbl"><tr><th></th><th>${esc(b.sides[0].name)}</th><th>${esc(b.sides[1].name)}</th></tr>${row('Al inicio', 'start')}${row('Supervivientes', 'end')}${row('Muertos', 'killed')}${row('Heridos', 'wounded')}${row('Capturados', 'captured')}${row('Desertores', 'deserted')}${row('Dispersos', 'dispersed')}</table>
  <p class="small muted">Los heridos vuelven al ejército con el tiempo; la mitad de los dispersos también. Muertos, capturados y desertores se pierden.</p>
  <h4>Momentos decisivos</h4><ul>${b.decisive.slice(0, 8).map(d => `<li>${esc(d)}</li>`).join('') || '<li>Sin momentos destacables.</li>'}</ul>
  ${rep ? `<h4>Consecuencias</h4><ul>${rep.consequences.map((c: string) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
  <div class="btns"><button class="primary" data-b="close">Volver al Atlas</button></div>`;
}

// ---------- acciones ----------
function finishIfDone() {
  if (!V || V.b.stage !== 'fin' || V.rep) return; V.rep = applyBattle(V.w, V.g, V.b); const i = V.g.pendingBattles.indexOf(V.b); if (i >= 0) V.g.pendingBattles.splice(i, 1);
}
function runOne(marshal = false) {
  if (!V) return; const b = V.b; if (marshal) aiOrders(b, 0); aiOrders(b, 1);
  const from = new Map(b.groups.map(q => [q.id, { x: q.x, y: q.y, men: q.men }])); runPhase(b); finishIfDone();
  V.anim = { t0: performance.now(), from }; render(); requestAnimationFrame(draw);
}
function autoAll() { if (!V) return; const b = V.b; if (b.stage === 'reconocimiento' || b.stage === 'despliegue') { b.stage = 'combate'; } let guard = 0; while (b.stage !== 'fin' && guard++ < 30) { aiOrders(b, 0); aiOrders(b, 1); runPhase(b); } finishIfDone(); V.anim = null; render(); }
function onClick(ev: Event) {
  if (!V) return; const el = (ev.target as HTMLElement).closest('[data-b]') as HTMLElement | null; if (!el || (el as HTMLButtonElement).disabled) return; const a = el.dataset.b; const b = V.b;
  const sel = V.sel != null ? b.groups.find(q => q.id === V!.sel) : null;
  switch (a) {
    case 'todeploy': b.stage = 'despliegue'; break;
    case 'form': V.formation = el.dataset.f!; V.dep = formationDeployment(b.sides[0], V.formation); applyDeployment(b, 0, V.dep); break;
    case 'autodep': { const f = b.attackerSide === 0 ? (b.sides[0].units.some(u => UNIT[u.type].cav) ? 'envolvente' : 'equilibrada') : (b.minWidth < 16 ? 'profundidad' : 'defensiva'); V.formation = f; V.dep = formationDeployment(b.sides[0], f); applyDeployment(b, 0, V.dep); break; }
    case 'start': b.stage = 'combate'; V.sel = b.groups.find(q => q.side === 0)?.id ?? null; break;
    case 'auto': case 'rest': autoAll(); return;
    case 'phase': runOne(false); return;
    case 'marshal': runOne(true); return;
    case 'delegate': aiOrders(b, 0, true); break;
    case 'sel': V.sel = +el.dataset.g!; break;
    case 'order': if (sel) { const o = el.dataset.o as Order; sel.order = o; sel.ordersGiven++; sel.target = null; if (NEEDS_ENEMY.includes(o)) V.picking = 'enemy'; else if (o === 'reforzar') V.picking = 'friend'; } break;
    case 'int': if (sel) sel.intensity = el.dataset.i as Intensity; break;
    case 'intall': for (const q of b.groups) if (q.side === 0 && alive(q)) q.intensity = el.dataset.i as Intensity; break;
    case 'close': close(); return;
  }
  render();
}
function onChange(ev: Event) { onInput(ev); }
function onInput(ev: Event) {
  if (!V) return; const el = ev.target as HTMLInputElement; if (!el.dataset.dep) return; const t = el.dataset.dep, s = el.dataset.sec as Sector;
  const u = V.b.sides[0].units.find(x => x.type === t)!; const e = V.dep[t] || (V.dep[t] = {}); e[s] = Math.max(0, Math.min(u.men, Math.round(+el.value || 0)));
  if (ev.type === 'change') { applyDeployment(V.b, 0, V.dep); V.formation = ''; render(); }
}
document.addEventListener('keydown', e => { if (V && e.key === 'Escape' && V.picking) { V.picking = null; render(); } });
export function battleOpen() { return !!V; }
