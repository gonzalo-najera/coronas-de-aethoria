// Utilidades compartidas de la interfaz: estado global de la UI, acciones delegadas, formato y desgloses.
import type { World } from '../engine/world';
import type { GameState, Breakdown } from '../engine/types';
import type { Atlas } from './render';

export interface UIState {
  w: World | null; g: GameState | null; atlas: Atlas | null;
  mode: null | { kind: 'move'; army: number; dest?: number; path?: number[] | null };
  tab: string; resOpen: string | null; modal: string | null; modalArg: any; auto: boolean; speed: number; busy: boolean;
  lastAlert: number; chips: string[];
}
export const UI: UIState = { w: null, g: null, atlas: null, mode: null, tab: 'resumen', resOpen: null, modal: null, modalArg: null, auto: false, speed: 900, busy: false, lastAlert: 0, chips: [] };

type Act = (d: DOMStringMap, el: HTMLElement, ev: Event) => void;
export const ACTIONS: Record<string, Act> = {};
export function act(name: string, f: Act) { ACTIONS[name] = f; }

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
export const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function fmt(n: number, d = 0) { if (!isFinite(n)) return '—'; const v = Math.abs(n) >= 100 ? Math.round(n) : +n.toFixed(d); return v.toLocaleString('es', { maximumFractionDigits: d }); }
export function sgn(n: number, d = 1) { if (Math.abs(n) < 0.5 * Math.pow(10, -d)) return '0'; const s = fmt(n, d); return n > 0.0001 ? '+' + s : s; }
export function big(n: number) { if (n >= 1e6) return (n / 1e6).toLocaleString('es', { maximumFractionDigits: 2 }) + ' M'; if (n >= 1e4) return Math.round(n / 1000).toLocaleString('es') + ' mil'; return Math.round(n).toLocaleString('es'); }
export function bd(b: Breakdown, unit = '', d = 1) {
  if (!b.length) return '<div class="muted small">Sin partidas.</div>';
  const tot = b.reduce((s, x) => s + x.value, 0);
  return `<table class="bd">${b.map(x => `<tr><td>${esc(x.label)}</td><td class="${x.value < 0 ? 'neg' : 'pos'}">${sgn(x.value, d)}${unit}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td>${sgn(tot, d)}${unit}</td></tr></table>`;
}
export function bar(v: number, max = 100, cls = '') { const p = Math.max(0, Math.min(100, v / max * 100)); return `<span class="bar ${cls}"><i style="width:${p}%"></i></span>`; }
let toastT = 0;
export function toast(text: string, kind = 'info') { const t = $('#toast'); if (!t) return; t.innerHTML = esc(text); t.className = 'show ' + kind; clearTimeout(toastT); toastT = window.setTimeout(() => t.className = '', 3800); }
export function tip(el: HTMLElement | null, html: string | null, x = 0, y = 0) {
  const t = $('#tip'); if (!html || !el) { t.style.display = 'none'; return; }
  t.innerHTML = html; t.style.display = 'block'; const r = t.getBoundingClientRect();
  t.style.left = Math.min(window.innerWidth - r.width - 8, x + 14) + 'px'; t.style.top = Math.min(window.innerHeight - r.height - 8, y + 14) + 'px';
}
// Registro de funciones de repintado (evita dependencias circulares entre módulos)
export const HOOK: { refresh: () => void; panel: () => void; top: () => void; modal: () => void; focus: (f: any) => void } = { refresh() { }, panel() { }, top() { }, modal() { }, focus() { } };
// Confirmación dentro de la página (los diálogos nativos no funcionan en todos los entornos).
export function ask(text: string, ok = 'Confirmar'): Promise<boolean> {
  return new Promise(res => {
    const d = document.createElement('div'); d.className = 'askbox';
    d.innerHTML = `<div class="askwin"><p>${esc(text)}</p><div class="btns"><button class="primary" data-k="1">${esc(ok)}</button><button data-k="0">Cancelar</button></div></div>`;
    d.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('[data-k]') as HTMLElement | null; if (!b && e.target !== d) return; d.remove(); res(!!b && b.dataset.k === '1'); });
    document.body.appendChild(d); (d.querySelector('.primary') as HTMLElement).focus();
  });
}
export function showText(title: string, text: string) {
  const d = document.createElement('div'); d.className = 'askbox';
  d.innerHTML = `<div class="askwin wide"><h3>${esc(title)}</h3><p class="small">Si la descarga no empieza (algunos visores la bloquean), copia este texto y guárdalo en un archivo .json. Se puede importar desde la pantalla de inicio o desde Partida.</p><textarea readonly></textarea><div class="btns"><button data-k="copy">Copiar</button><button class="primary" data-k="0">Cerrar</button></div></div>`;
  (d.querySelector('textarea') as HTMLTextAreaElement).value = text;
  d.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('[data-k]') as HTMLElement | null; if (!b) return; if (b.dataset.k === 'copy') { const ta = d.querySelector('textarea') as HTMLTextAreaElement; ta.select(); navigator.clipboard?.writeText(text).then(() => toast('Copiado.'), () => toast('Selecciona el texto y cópialo con Ctrl+C.')); return; } d.remove(); });
  document.body.appendChild(d);
}
