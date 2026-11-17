// Save Engine: IndexedDB (con respaldo en memoria), varias ranuras, autoguardado, exportación/importación y versionado.
import type { GameState } from './types';
import { SAVE_VERSION } from './game';
import { generateWorld, World } from './world';

const DB = 'coronas-de-aethoria', STORE = 'saves';
let mem: Record<string, any> = {};
function open(): Promise<IDBDatabase | null> {
  return new Promise(res => { try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch { res(null); } });
}
async function put(key: string, val: any) { const db = await open(); if (!db) { mem[key] = val; return; } await new Promise<void>((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(val, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
async function get(key: string): Promise<any> { const db = await open(); if (!db) return mem[key]; return new Promise(res => { const t = db.transaction(STORE, 'readonly'); const q = t.objectStore(STORE).get(key); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); }
async function del(key: string) { const db = await open(); if (!db) { delete mem[key]; return; } await new Promise<void>(res => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(key); t.oncomplete = () => res(); }); }
async function keys(): Promise<string[]> { const db = await open(); if (!db) return Object.keys(mem); return new Promise(res => { const t = db.transaction(STORE, 'readonly'); const q = t.objectStore(STORE).getAllKeys(); q.onsuccess = () => res(q.result as string[]); q.onerror = () => res([]); }); }

export interface SaveMeta { slot: string; name: string; kingdom: string; turn: number; date: string; savedAt: number; version: number; }
export function serialize(g: GameState) { return JSON.stringify(g); }
export function migrate(o: any): GameState {
  if (!o || typeof o !== 'object' || !o.version) throw new Error('Archivo de guardado no válido');
  if (o.version > SAVE_VERSION) throw new Error('El guardado procede de una versión más reciente del juego');
  // versión 1: formato actual. Futuras migraciones se encadenarán aquí.
  return o as GameState;
}
export function validate(g: GameState, w: World): string[] {
  const errs: string[] = [];
  if (g.worldHash !== w.hash) errs.push('La geografía regenerada no coincide con la del guardado');
  if (g.provinces.length !== w.provinces.length) errs.push('Número de provincias distinto');
  for (const a of g.armies) { if (a.prov < 0 || a.prov >= w.provinces.length) errs.push('Ejército fuera del mapa: ' + a.name); for (const u of a.units) if (u.men < 0 || !isFinite(u.men)) errs.push('Efectivos inválidos en ' + a.name); }
  for (const k of g.kingdoms) for (const r in k.stock) if (!isFinite((k.stock as any)[r])) errs.push(`Recurso inválido ${r} en ${k.name}`);
  return errs;
}
export async function saveGame(g: GameState, slot: string, meta: Omit<SaveMeta, 'slot' | 'savedAt' | 'version'>) {
  if (slot === 'auto') { const prev = await get('save:auto'); if (prev) await put('save:auto_prev', prev); const pm = await get('meta:auto'); if (pm) await put('meta:auto_prev', { ...pm, slot: 'auto_prev', name: 'Autoguardado anterior' }); }
  await put('save:' + slot, serialize(g)); await put('meta:' + slot, { ...meta, slot, savedAt: Date.now(), version: SAVE_VERSION });
}
export async function listSaves(): Promise<SaveMeta[]> { const ks = await keys(); const out: SaveMeta[] = []; for (const k of ks) if (String(k).startsWith('meta:')) { const m = await get(k); if (m) out.push(m); } return out.sort((a, b) => b.savedAt - a.savedAt); }
export async function loadGame(slot: string): Promise<{ g: GameState; w: World }> {
  const tryLoad = async (s: string) => { const raw = await get('save:' + s); if (!raw) throw new Error('No existe la partida'); const g = migrate(JSON.parse(raw)); const w = generateWorld(g.seed); const errs = validate(g, w); if (errs.length) throw new Error(errs.join('; ')); return { g, w }; };
  try { return await tryLoad(slot); } catch (e) { if (slot === 'auto') { try { return await tryLoad('auto_prev'); } catch { } } throw e; }
}
export async function deleteSave(slot: string) { await del('save:' + slot); await del('meta:' + slot); }
export function importGame(text: string): { g: GameState; w: World } { const g = migrate(JSON.parse(text)); const w = generateWorld(g.seed); const errs = validate(g, w); if (errs.length) throw new Error(errs.join('; ')); return { g, w }; }
