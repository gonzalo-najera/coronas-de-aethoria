// World Engine + Map Engine: genera el mundo persistente a partir de una semilla.
// La geografía es una función pura de (semilla, versión del generador): al cargar una partida se regenera idéntica
// y se verifica con un hash. El diseño de continentes, cordilleras y mares es intencional; el ruido solo da forma orgánica.
import { RNG, Noise2D, hashNums } from './rng';
import type { Biome, ProvStatic, SeaStatic, Continent, Deposit, DepositId, Climate } from './types';
import { BIOMES, CONTINENTS } from './data';
import { provinceName, seaName } from './names';

export const W = 360, H = 240, GEN_VERSION = 3;
export const BIOME_LIST: Biome[] = ['oceano', 'mar', 'lago', 'llanura', 'pradera', 'estepa', 'bosque', 'taiga', 'selva', 'desierto', 'tundra', 'colinas', 'montana', 'nieve', 'pantano'];

export interface World {
  seed: number; hash: string;
  elev: Float32Array; moist: Float32Array; temp: Float32Array; land: Uint8Array; biome: Uint8Array;
  prov: Int16Array; sea: Int16Array; river: Uint8Array; lake: Uint8Array; distLand: Float32Array; cont: Int8Array;
  rivers: { cells: number[]; flow: number; name: string }[];
  provinces: ProvStatic[]; seas: SeaStatic[]; continents: Continent[];
}

type Blob = { x: number; y: number; rx: number; ry: number; c: number; w?: number };
// Diseño intencional del mundo (coordenadas de celda)
const BLOBS: Blob[] = [
  // Valdoria (0): continente inicial
  { x: 118, y: 118, rx: 46, ry: 58, c: 0 }, { x: 88, y: 150, rx: 26, ry: 26, c: 0 }, { x: 100, y: 82, rx: 28, ry: 26, c: 0 },
  { x: 148, y: 96, rx: 24, ry: 24, c: 0 }, { x: 152, y: 158, rx: 22, ry: 22, c: 0 }, { x: 127, y: 62, rx: 13, ry: 15, c: 0 },
  { x: 152, y: 70, rx: 15, ry: 18, c: 0 }, { x: 80, y: 112, rx: 18, ry: 22, c: 0 }, { x: 100, y: 178, rx: 18, ry: 12, c: 0 }, { x: 168, y: 128, rx: 10, ry: 14, c: 0 },
  // Norvhal (1): norte frío
  { x: 178, y: 34, rx: 20, ry: 15, c: 1 }, { x: 205, y: 28, rx: 24, ry: 15, c: 1 }, { x: 236, y: 36, rx: 20, ry: 14, c: 1 }, { x: 164, y: 48, rx: 9, ry: 9, c: 1 },
  // Esmerana (2): este
  { x: 266, y: 96, rx: 42, ry: 30, c: 2 }, { x: 302, y: 118, rx: 28, ry: 26, c: 2 }, { x: 246, y: 74, rx: 18, ry: 14, c: 2 }, { x: 322, y: 86, rx: 20, ry: 20, c: 2 }, { x: 236, y: 118, rx: 14, ry: 14, c: 2 },
  // Kharesh (3): sur
  { x: 214, y: 190, rx: 44, ry: 22, c: 3 }, { x: 246, y: 212, rx: 28, ry: 18, c: 3 }, { x: 184, y: 200, rx: 18, ry: 16, c: 3 }, { x: 258, y: 176, rx: 20, ry: 14, c: 3 }, { x: 214, y: 222, rx: 18, ry: 10, c: 3 },
  // Brumalia (4): oeste, más allá del océano
  { x: 24, y: 118, rx: 17, ry: 48, c: 4 }, { x: 32, y: 168, rx: 15, ry: 16, c: 4 }, { x: 20, y: 70, rx: 13, ry: 16, c: 4 },
  // Islas Cendra (5)
  { x: 140, y: 204, rx: 7, ry: 6, c: 5 }, { x: 154, y: 214, rx: 6, ry: 5, c: 5 }, { x: 127, y: 212, rx: 5, ry: 5, c: 5 }, { x: 165, y: 199, rx: 5, ry: 4, c: 5 },
  // Archipiélago Velasal (6)
  { x: 336, y: 176, rx: 7, ry: 6, c: 6 }, { x: 346, y: 192, rx: 7, ry: 7, c: 6 }, { x: 328, y: 200, rx: 5, ry: 5, c: 6 }, { x: 350, y: 162, rx: 5, ry: 5, c: 6 },
  // Isla de Morvena (7)
  { x: 302, y: 24, rx: 15, ry: 10, c: 7 },
];
type Ridge = { a: [number, number]; b: [number, number]; w: number; amp: number };
const RIDGES: Ridge[] = [
  { a: [80, 54], b: [104, 104], w: 11, amp: 0.85 },   // Montes Hierrocano (Durnhal)
  { a: [104, 104], b: [90, 120], w: 7, amp: 0.55 },
  { a: [66, 126], b: [74, 170], w: 7, amp: 0.45 },   // Colinas de Ilvaren
  { a: [156, 108], b: [174, 144], w: 8, amp: 0.6 },  // Altos de Rocagrís
  { a: [118, 150], b: [140, 172], w: 6, amp: 0.4 },  // Lomas del sur
  { a: [168, 28], b: [248, 32], w: 9, amp: 0.85 },    // Espinazo de Norvhal
  { a: [242, 66], b: [292, 124], w: 9, amp: 0.8 },   // Cordillera de Esmerana
  { a: [318, 70], b: [330, 100], w: 7, amp: 0.5 },
  { a: [188, 204], b: [234, 222], w: 8, amp: 0.6 }, // Sierras de Kharesh
  { a: [222, 176], b: [244, 170], w: 6, amp: 0.4 },
  { a: [18, 58], b: [30, 150], w: 8, amp: 0.7 },    // Brumalia
  { a: [140, 202], b: [142, 206], w: 3, amp: 0.7 },  // volcán de Cendra
  { a: [344, 190], b: [346, 194], w: 3, amp: 0.6 },
];
const CARVES = [
  { x: 120, y: 118, rx: 11, ry: 7, line: [[128, 121], [170, 132]] as number[][] }, // Mar de Lirio y su estrecho
];
const LAKES = [[88, 128, 3], [134, 142, 2.6], [282, 100, 3.6], [214, 32, 3], [26, 140, 3], [300, 132, 2.4], [62, 100, 2.4]];

function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay; const l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx - px, y = ay + t * dy - py; return Math.sqrt(x * x + y * y);
}

class Heap { a: [number, number][] = []; push(p: number, v: number) { const a = this.a; a.push([p, v]); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break;[a[i], a[j]] = [a[j], a[i]]; i = j; } } pop() { const a = this.a; const top = a[0]; const last = a.pop()!; if (a.length) { a[0] = last; let i = 0; for (; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break;[a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; } get size() { return this.a.length; } }

export const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
export const idx = (x: number, y: number) => y * W + x;

export function generateWorld(seed: number): World {
  const rng = new RNG(hashNums(seed, 7));
  const nA = new Noise2D(seed), nB = new Noise2D(seed + 1), nC = new Noise2D(seed + 2), nD = new Noise2D(seed + 3);
  const N = W * H;
  const elev = new Float32Array(N), moist = new Float32Array(N), temp = new Float32Array(N), land = new Uint8Array(N), cont = new Int8Array(N).fill(-1);
  const lake = new Uint8Array(N);
  // 1. Forma de las tierras
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    const wx = x + 15 * nA.fbm(x / 30, y / 30, 4) + 4 * nC.fbm(x / 9 + 40, y / 9, 2), wy = y + 15 * nB.fbm(x / 30 + 9, y / 30 + 3, 4) + 4 * nD.fbm(x / 9, y / 9 + 40, 2);
    let best = -9, bc = -1;
    for (const b of BLOBS) { const dx = (wx - b.x) / b.rx, dy = (wy - b.y) / b.ry; const v = 1 - Math.sqrt(dx * dx + dy * dy); if (v > best) { best = v; bc = b.c; } }
    let h = best * 0.9 + 0.26 * nC.fbm(x / 13, y / 13, 5) - 0.03;
    for (const c of CARVES) {
      const dx = (wx - c.x) / c.rx, dy = (wy - c.y) / c.ry; const v = 1 - Math.sqrt(dx * dx + dy * dy); if (v > 0) h -= v * 1.4 + 0.1;
      const d = distSeg(x, y, c.line[0][0], c.line[0][1], c.line[1][0], c.line[1][1]); if (d < 2.6) h = Math.min(h, -0.08);
    }
    for (const [lx, ly, lr] of LAKES) { const d = Math.hypot(wx - lx, wy - ly); if (d < lr) { h = Math.max(h, 0.05); lake[i] = 1; } }
    if (x < 2 || y < 2 || x > W - 3 || y > H - 3) h = Math.min(h, -0.3);
    land[i] = h > 0 && !lake[i] ? 1 : 0; if (land[i]) cont[i] = bc;
    let ridge = 0;
    for (const r of RIDGES) { const d = distSeg(wx, wy, r.a[0], r.a[1], r.b[0], r.b[1]); if (d < r.w) { const k = 1 - d / r.w; ridge = Math.max(ridge, r.amp * k * k * (0.65 + 0.5 * nD.fbm(x / 7, y / 7, 3))); } }
    elev[i] = land[i] ? Math.max(0.02, Math.min(1.2, 0.12 + 0.22 * Math.max(0, best) + ridge + 0.18 * nD.fbm(x / 22 + 5, y / 22, 4) + 0.08 * Math.max(0, nC.fbm(x / 9, y / 9, 2)))) : h;
  }
  // islotes diminutos -> mar
  const comp = new Int32Array(N).fill(-1);
  { let cid = 0; for (let i = 0; i < N; i++) { if (!land[i] || comp[i] >= 0) continue; const st = [i]; const cells: number[] = []; comp[i] = cid; while (st.length) { const c = st.pop()!; cells.push(c); const cx = c % W, cy = (c / W) | 0; for (const [dx, dy] of N4) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = idx(nx, ny); if (land[j] && comp[j] < 0) { comp[j] = cid; st.push(j); } } } if (cells.length < 6) for (const c of cells) { land[c] = 0; cont[c] = -1; elev[c] = -0.02; } cid++; } }
  // lagos: agua no conectada al borde
  const ocean = new Uint8Array(N); { const st: number[] = [0]; ocean[0] = 1; while (st.length) { const c = st.pop()!; const cx = c % W, cy = (c / W) | 0; for (const [dx, dy] of N4) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = idx(nx, ny); if (!land[j] && !lake[j] && !ocean[j]) { ocean[j] = 1; st.push(j); } } } }
  for (let i = 0; i < N; i++) if (!land[i] && !ocean[i]) lake[i] = 1;
  // distancia a tierra (agua) y al agua (tierra)
  const distLand = bfsDist(N, i => land[i] === 1, () => true);
  const distWater = bfsDist(N, i => !land[i], () => true);
  // 2. Clima
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    let t = 1 - Math.abs(y - 205) / 205; t -= Math.max(0, elev[i] - 0.3) * 0.45; t += 0.04 * nB.fbm(x / 30, y / 30, 2);
    let m = 0.52 + 0.32 * nA.fbm(x / 26 + 20, y / 26 + 20, 4) + Math.max(0, 0.18 - distWater[i] * 0.012);
    if (x > 168 && x < 280 && y > 160 && y < 202) m -= 0.42 * Math.min(1, (y - 160) / 12) * Math.min(1, (202 - y) / 10); // gran desierto de Kharesh
    if (x > 128 && x < 178 && y > 78 && y < 118) m -= 0.18; // llanos orientales de Valdoria
    if (x < 90 && y > 120 && y < 175) m += 0.15; // bosques occidentales
    if (x > 290 && y > 100 && y < 150) m += 0.15; // bosques de Velmora
    if (y > 205) m += 0.2; // selvas australes
    temp[i] = t; moist[i] = m;
  }
  // 3. Ríos: desde tierras altas hacia el agua siguiendo la distancia decreciente al mar/lago
  const river = new Uint8Array(N); const rivers: World['rivers'] = [];
  const cand: number[] = []; for (let i = 0; i < N; i++) if (land[i] && elev[i] > 0.44 && moist[i] > 0.3 && distWater[i] > 5) cand.push(i);
  rng.shuffle(cand); const sources: number[] = [];
  for (const c of cand) { if (sources.length > 110) break; const cx = c % W, cy = (c / W) | 0; if (sources.every(s => Math.hypot(s % W - cx, ((s / W) | 0) - cy) > 8)) sources.push(c); }
  const usedNames = new Set<string>();
  for (const s of sources) {
    const path: number[] = [s]; let c = s; let ok = false;
    for (let step = 0; step < 300; step++) {
      const cx = c % W, cy = (c / W) | 0; let best = -1, bv = 1e9;
      for (const [dx, dy] of N4) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = idx(nx, ny); if (distWater[j] < distWater[c] || (!land[j])) { const v = distWater[j] * 1.0 + elev[j] * 1.5 + rng.next() * 0.9; if (v < bv) { bv = v; best = j; } } }
      if (best < 0) break; if (!land[best]) { ok = true; break; } path.push(best); if (river[best]) { ok = true; break; } c = best;
    }
    if (ok && path.length >= 7) { for (const p of path) river[p] = Math.min(255, river[p] + 1); rivers.push({ cells: path, flow: path.length, name: 'Río ' + provinceName(rng, 'llanura', usedNames).replace(/^.* de /, '') }); }
  }
  // humedad junto a los ríos
  const nearRiver = bfsDist(N, i => river[i] > 0, () => true);
  for (let i = 0; i < N; i++) if (land[i] && nearRiver[i] < 4) moist[i] += 0.14 * (1 - nearRiver[i] / 4);
  // 4. Biomas
  const biome = new Uint8Array(N); const B = (b: Biome) => BIOME_LIST.indexOf(b);
  for (let i = 0; i < N; i++) {
    if (!land[i]) { biome[i] = lake[i] ? B('lago') : distLand[i] > 6 ? B('oceano') : B('mar'); continue; }
    const e = elev[i], t = temp[i], m = moist[i]; let b: Biome;
    if (e > 0.74) b = t < 0.5 ? 'nieve' : 'montana';
    else if (e > 0.58) b = t < 0.22 ? 'tundra' : 'montana';
    else if (e > 0.47) b = t < 0.22 ? 'tundra' : 'colinas';
    else if (t < 0.2) b = m > 0.6 ? 'taiga' : 'tundra';
    else if (t < 0.34) b = m > 0.5 ? 'taiga' : 'estepa';
    else if (t > 0.86 && m > 0.6) b = 'selva';
    else if (m < 0.24 && t > 0.6) b = 'desierto';
    else if (m < 0.36) b = 'estepa';
    else if (m > 0.8 && e < 0.2 && nearRiver[i] < 3) b = 'pantano';
    else if (m > 0.66) b = 'bosque';
    else if (m > 0.5) b = 'pradera';
    else b = 'llanura';
    biome[i] = B(b);
  }
  // 5. Provincias (relleno por coste: las fronteras siguen ríos y cordilleras)
  const prov = new Int16Array(N).fill(-1);
  const landCells: number[] = []; for (let i = 0; i < N; i++) if (land[i]) landCells.push(i);
  rng.shuffle(landCells);
  const seeds: number[] = [];
  const spacing = (i: number) => { const b = BIOME_LIST[biome[i]]; return b === 'desierto' || b === 'tundra' || b === 'nieve' ? 14 : b === 'montana' ? 12 : b === 'selva' || b === 'taiga' ? 12 : 10; };
  const grid = new Map<number, number[]>(); const gk = (x: number, y: number) => ((x / 14) | 0) * 1000 + ((y / 14) | 0);
  for (const c of landCells) {
    const cx = c % W, cy = (c / W) | 0; const sp = spacing(c); let ok = true;
    for (let gx = -1; gx <= 1 && ok; gx++) for (let gy = -1; gy <= 1 && ok; gy++) { const l = grid.get(gk(cx + gx * 14, cy + gy * 14)); if (l) for (const s of l) if (Math.hypot(s % W - cx, ((s / W) | 0) - cy) < Math.max(sp, spacing(s))) { ok = false; break; } }
    if (ok) { seeds.push(c); const k = gk(cx, cy); if (!grid.has(k)) grid.set(k, []); grid.get(k)!.push(c); }
  }
  const cost = (i: number) => 1 + (river[i] ? 4 : 0) + (BIOME_LIST[biome[i]] === 'montana' ? 2.5 : 0) + (BIOME_LIST[biome[i]] === 'nieve' ? 4 : 0);
  costFill(seeds, prov, i => land[i] === 1, cost);
  // tierras sin semilla (islas)
  for (let i = 0; i < N; i++) if (land[i] && prov[i] < 0) { seeds.push(i); costFill([i], prov, j => land[j] === 1 && prov[j] < 0, cost, seeds.length - 1); }
  // fusionar provincias diminutas
  let cellsBy: number[][] = seeds.map(() => []); for (let i = 0; i < N; i++) if (prov[i] >= 0) cellsBy[prov[i]].push(i);
  for (let p = 0; p < cellsBy.length; p++) {
    if (cellsBy[p].length >= 28 || cellsBy[p].length === 0) continue;
    const cnt = new Map<number, number>(); for (const c of cellsBy[p]) { const cx = c % W, cy = (c / W) | 0; for (const [dx, dy] of N4) { const j = idx(cx + dx, cy + dy); const q = prov[j]; if (q >= 0 && q !== p) cnt.set(q, (cnt.get(q) || 0) + 1); } }
    let best = -1, bv = 0; cnt.forEach((v, q) => { if (v > bv) { bv = v; best = q; } });
    if (best >= 0) { for (const c of cellsBy[p]) prov[c] = best; cellsBy[best].push(...cellsBy[p]); cellsBy[p] = []; }
  }
  // reindexar
  const remap = new Int16Array(cellsBy.length).fill(-1); let np = 0; for (let p = 0; p < cellsBy.length; p++) if (cellsBy[p].length) remap[p] = np++;
  for (let i = 0; i < N; i++) if (prov[i] >= 0) prov[i] = remap[prov[i]];
  cellsBy = Array.from({ length: np }, () => []); for (let i = 0; i < N; i++) if (prov[i] >= 0) cellsBy[prov[i]].push(i);
  // 6. Regiones marítimas
  const sea = new Int16Array(N).fill(-1);
  const water: number[] = []; for (let i = 0; i < N; i++) if (!land[i] && !lake[i]) water.push(i);
  rng.shuffle(water); const sseeds: number[] = [];
  const isDeep = (i: number) => distLand[i] > 6;
  for (const c of water) { const cx = c % W, cy = (c / W) | 0; const sp = isDeep(c) ? 44 : 21; if (sseeds.every(s => isDeep(s) !== isDeep(c) || Math.hypot(s % W - cx, ((s / W) | 0) - cy) >= sp)) sseeds.push(c); }
  const shallowSeeds = sseeds.filter(s => !isDeep(s)), deepSeeds = sseeds.filter(s => isDeep(s));
  const allS = [...shallowSeeds, ...deepSeeds];
  costFillIds(shallowSeeds, shallowSeeds.map((_, k) => k), sea, i => !land[i] && !lake[i] && !isDeep(i));
  costFillIds(deepSeeds, deepSeeds.map((_, k) => k + shallowSeeds.length), sea, i => !land[i] && !lake[i] && isDeep(i));
  for (let i = 0; i < N; i++) if (!land[i] && !lake[i] && sea[i] < 0) { allS.push(i); costFillIds([i], [allS.length - 1], sea, j => !land[j] && !lake[j] && sea[j] < 0 && isDeep(j) === isDeep(i)); }
  let seaCells: number[][] = allS.map(() => []); for (let i = 0; i < N; i++) if (sea[i] >= 0) seaCells[sea[i]].push(i);
  // fusionar regiones marinas diminutas
  for (let s = 0; s < seaCells.length; s++) {
    if (seaCells[s].length >= 40 || !seaCells[s].length) continue;
    const cnt = new Map<number, number>(); for (const c of seaCells[s]) { const cx = c % W, cy = (c / W) | 0; for (const [dx, dy] of N4) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const q = sea[idx(nx, ny)]; if (q >= 0 && q !== s) cnt.set(q, (cnt.get(q) || 0) + 1); } }
    let best = -1, bv = 0; cnt.forEach((v, q) => { if (v > bv) { bv = v; best = q; } });
    if (best >= 0) { for (const c of seaCells[s]) sea[c] = best; seaCells[best].push(...seaCells[s]); seaCells[s] = []; }
  }
  const sremap = new Int16Array(seaCells.length).fill(-1); let ns = 0; for (let s = 0; s < seaCells.length; s++) if (seaCells[s].length) sremap[s] = ns++;
  for (let i = 0; i < N; i++) if (sea[i] >= 0) sea[i] = sremap[sea[i]];
  seaCells = Array.from({ length: ns }, () => []); for (let i = 0; i < N; i++) if (sea[i] >= 0) seaCells[sea[i]].push(i);

  // 7. Atributos de provincias
  const used = new Set<string>();
  const provinces: ProvStatic[] = [];
  for (let p = 0; p < np; p++) {
    const cells = cellsBy[p]; const mix: Partial<Record<Biome, number>> = {}; let sx = 0, sy = 0, e = 0, fert = 0, mv = 0, df = 0, rv = 0, tt = 0, mm = 0;
    const contCount = new Map<number, number>();
    for (const c of cells) { const b = BIOME_LIST[biome[c]]; mix[b] = (mix[b] || 0) + 1; sx += c % W; sy += (c / W) | 0; e += elev[c]; fert += BIOMES[b].fert * (river[c] ? 1.3 : 1); mv += BIOMES[b].move; df += BIOMES[b].def; if (river[c]) rv++; tt += temp[c]; mm += moist[c]; contCount.set(cont[c], (contCount.get(cont[c]) || 0) + 1); }
    const n = cells.length; for (const k in mix) mix[k as Biome] = mix[k as Biome]! / n;
    let main: Biome = 'llanura', mv2 = 0; for (const k in mix) if (mix[k as Biome]! > mv2) { mv2 = mix[k as Biome]!; main = k as Biome; }
    const mx = sx / n, my = sy / n;
    let center = cells[0], cd = 1e9; for (const c of cells) { const d = Math.hypot(c % W - mx, ((c / W) | 0) - my); if (d < cd) { cd = d; center = c; } }
    const neighbors = new Set<number>(), seasN = new Set<number>(); let coastal = false; const coastCells: number[] = [];
    for (const c of cells) { const cx = c % W, cy = (c / W) | 0; for (const [dx, dy] of N4) { const j = idx(cx + dx, cy + dy); if (prov[j] >= 0 && prov[j] !== p) neighbors.add(prov[j]); if (sea[j] >= 0) { seasN.add(sea[j]); coastal = true; coastCells.push(c); } } }
    const isB = (c: number, ...bs: Biome[]) => bs.includes(BIOME_LIST[biome[c]]);
    // ciudad
    let city = center, cv = -1e9;
    for (const c of cells) { const cx = c % W, cy = (c / W) | 0; let v = -Math.hypot(cx - mx, cy - my) / Math.sqrt(n) * 3; if (river[c]) v += 2.5; if (coastCells.includes(c)) v += 1.5; if (isB(c, 'montana', 'nieve')) v -= 6; if (isB(c, 'pantano', 'desierto')) v -= 1; v += BIOMES[BIOME_LIST[biome[c]]].fert; let edge = false; for (const [dx, dy] of N8) if (prov[idx(cx + dx, cy + dy)] !== p) edge = true; if (edge) v -= 3; v += rng.next() * 0.3; if (v > cv) { cv = v; city = c; } }
    const near = (pred: (c: number) => boolean, minD = 2) => { let b = -1, bd = 1e9; const cx0 = city % W, cy0 = (city / W) | 0; for (const c of cells) { if (!pred(c)) continue; const d = Math.hypot(c % W - cx0, ((c / W) | 0) - cy0); if (d >= minD && d < bd) { bd = d; b = c; } } return b; };
    const mineSite = near(c => isB(c, 'montana', 'colinas', 'nieve', 'tundra')), forest = near(c => isB(c, 'bosque', 'taiga', 'selva')), farm = near(c => isB(c, 'llanura', 'pradera', 'estepa', 'colinas', 'pantano', 'desierto', 'tundra') && !river[c]);
    const port = coastCells.length ? coastCells.reduce((a, c) => Math.hypot(c % W - city % W, ((c / W) | 0) - ((city / W) | 0)) < Math.hypot(a % W - city % W, ((a / W) | 0) - ((city / W) | 0)) ? c : a) : -1;
    let tower = city, te = -1; for (const c of cells) if (elev[c] > te && Math.hypot(c % W - city % W, ((c / W) | 0) - ((city / W) | 0)) < 8) { te = elev[c]; tower = c; }
    const avgT = tt / n, avgM = mm / n;
    const climate: Climate = avgT < 0.3 ? 'frio' : (avgM < 0.3 && avgT > 0.55) ? 'arido' : (avgT > 0.84 && avgM > 0.55) ? 'tropical' : avgT > 0.66 ? 'calido' : 'templado';
    // yacimientos
    const deposits: Deposit[] = []; const rock = (mix.montana || 0) + (mix.colinas || 0) + (mix.nieve || 0) * 0.5;
    const dr = new RNG(hashNums(seed, p, 991));
    const addDep = (k: DepositId, pr: number) => { if (dr.next() < pr) deposits.push({ kind: k, hidden: dr.next() < 0.3 }); };
    addDep('hierro', Math.min(0.85, rock * 1.4 + 0.05)); addDep('oro', rock * 0.25); addDep('plata', rock * 0.3); addDep('gemas', (mix.montana || 0) * 0.35);
    addDep('cobre', rock * 0.4); addDep('sal', (mix.desierto || 0) * 0.6 + (coastal ? 0.06 : 0)); addDep('especias', (mix.selva || 0) * 0.7 + (mix.desierto || 0) * 0.15);
    addDep('caballos', (mix.estepa || 0) * 0.8 + (mix.pradera || 0) * 0.4); addDep('plantas', (mix.bosque || 0) * 0.4 + (mix.selva || 0) * 0.6);
    const ci = [...contCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
    provinces.push({ id: p, name: provinceName(rng, main, used), cells, area: n, cx: center % W, cy: (center / W) | 0, city, biome: main, mix, neighbors: [...neighbors], seas: [...seasN], coastal, river: rv > 0, fertility: Math.min(1.6, fert / n), elevation: e / n, climate, hemisphere: ((city / W) | 0) > 205 ? 'S' : 'N', deposits, continent: Math.max(0, ci), strategic: [], ruins: dr.next() < 0.1, sites: { mine: mineSite, forest, farm, port, quarry: mineSite, tower }, moveCost: mv / n, defense: df / n + (rv > 2 ? 0.1 : 0) });
  }
  // 8. Regiones marítimas
  const seas: SeaStatic[] = [];
  const sused = new Set<string>();
  for (let s = 0; s < ns; s++) {
    const cells = seaCells[s]; let sx = 0, sy = 0, deep = 0; const nb = new Set<number>(), pv = new Set<number>();
    for (const c of cells) { sx += c % W; sy += (c / W) | 0; if (isDeep(c)) deep++; const cx = c % W, cy = (c / W) | 0; for (const [dx, dy] of N4) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = idx(nx, ny); if (sea[j] >= 0 && sea[j] !== s) nb.add(sea[j]); if (prov[j] >= 0) pv.add(prov[j]); } }
    const mx = sx / cells.length, my = sy / cells.length; let center = cells[0], cd = 1e9; for (const c of cells) { const d = Math.hypot(c % W - mx, ((c / W) | 0) - my); if (d < cd) { cd = d; center = c; } }
    const dp = deep > cells.length / 2;
    seas.push({ id: s, name: seaName(rng, dp, sused), cells, cx: center % W, cy: (center / W) | 0, deep: dp, neighbors: [...nb], provinces: [...pv] });
  }
  // nombres fijos de mares notables
  const nameSeaAt = (x: number, y: number, name: string) => { const s = sea[idx(x, y)]; if (s >= 0) seas[s].name = name; };
  nameSeaAt(120, 118, 'Mar de Lirio'); nameSeaAt(48, 120, 'Océano del Poniente'); nameSeaAt(190, 110, 'Mar de las Dos Coronas');
  // 9. Valor estratégico
  for (const p of provinces) {
    if ((p.mix.montana || 0) + (p.mix.nieve || 0) > 0.25 && p.neighbors.length >= 3) p.strategic.push('Paso de montaña');
    for (const s of p.seas) { const sr = seas[s]; const conts = new Set(sr.provinces.map(q => provinces[q].continent)); if (!sr.deep && conts.size >= 2) { p.strategic.push('Domina el ' + sr.name); break; } }
    if (p.river && p.neighbors.some(q => provinces[q].river) && p.strategic.length === 0 && p.fertility > 0.9) p.strategic.push('Vado principal del río');
    if (p.deposits.some(d => d.kind === 'hierro') && (p.mix.montana || 0) > 0.3) p.strategic.push('Minas de hierro de la región');
    const harbor = p.coastal && p.seas.length >= 2; if (harbor && p.strategic.length < 2) p.strategic.push('Gran puerto natural');
  }
  const continents: Continent[] = CONTINENTS.map((name, id) => { const ps = provinces.filter(p => p.continent === id); const cx = ps.reduce((a, p) => a + p.cx, 0) / Math.max(1, ps.length), cy = ps.reduce((a, p) => a + p.cy, 0) / Math.max(1, ps.length); return { id, name, cx, cy }; });
  let hh = 2166136261; for (let i = 0; i < N; i += 1) { hh ^= prov[i] * 31 + biome[i] + sea[i] * 7; hh = Math.imul(hh, 16777619); }
  return { seed, hash: (hh >>> 0).toString(16) + '-' + np + '-' + ns + '-v' + GEN_VERSION, elev, moist, temp, land, biome, prov, sea, river, lake, distLand, cont, rivers, provinces, seas, continents };
}

function bfsDist(N: number, src: (i: number) => boolean, pass: (i: number) => boolean): Float32Array {
  const d = new Float32Array(N).fill(1e9); const q = new Int32Array(N); let h = 0, t = 0;
  for (let i = 0; i < N; i++) if (src(i)) { d[i] = 0; q[t++] = i; }
  while (h < t) { const c = q[h++]; const cx = c % W, cy = (c / W) | 0; for (const [dx, dy] of N4) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (d[j] > d[c] + 1 && pass(j)) { d[j] = d[c] + 1; q[t++] = j; } } }
  return d;
}
function costFill(seeds: number[], out: Int16Array, pass: (i: number) => boolean, cost: (i: number) => number, idOffset = -1) {
  const dist = new Map<number, number>(); const hp = new Heap();
  seeds.forEach((s, k) => { const id = idOffset >= 0 ? idOffset : k; out[s] = id; dist.set(s, 0); hp.push(0, s); });
  while (hp.size) { const [d, c] = hp.pop(); if (d > (dist.get(c) ?? 1e9)) continue; const cx = c % W, cy = (c / W) | 0; for (const [dx, dy] of N4) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (!pass(j)) continue; const nd = d + cost(j); if (nd < (dist.get(j) ?? 1e9)) { dist.set(j, nd); out[j] = out[c]; hp.push(nd, j); } } }
}
function costFillIds(seeds: number[], ids: number[], out: Int16Array, pass: (i: number) => boolean) {
  const dist = new Float32Array(out.length).fill(1e9); const hp = new Heap();
  seeds.forEach((s, k) => { out[s] = ids[k]; dist[s] = 0; hp.push(0, s); });
  while (hp.size) { const [d, c] = hp.pop(); if (d > dist[c]) continue; const cx = c % W, cy = (c / W) | 0; for (const [dx, dy] of N4) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (!pass(j)) continue; const nd = d + 1; if (nd < dist[j]) { dist[j] = nd; out[j] = out[c]; hp.push(nd, j); } } }
}
