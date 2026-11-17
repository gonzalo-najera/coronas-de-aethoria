// UI Engine — Atlas: cartografía ilustrada pre-renderizada + capas dinámicas que solo muestran lo que el reino conoce.
import type { World } from '../engine/world';
import { W, H, BIOME_LIST, N4 } from '../engine/world';
import type { GameState } from '../engine/types';
import { BIOMES, SPECIES, SPECIES_IDS, DEPOSITS } from '../engine/data';
import { knowLevel, isVisible, armyMen, rel, atWar } from '../engine/game';
import { kingdomEconomy, provinceEconomy, sum, supplyCapacity, isSupplied } from '../engine/economy';
import { Noise2D, hashNums, RNG } from '../engine/rng';
import { posOf } from '../engine/exploration';

export const S = 8;
export const LAYERS: { id: string; name: string; note?: string }[] = [
  { id: 'fisico', name: 'Físico' }, { id: 'politico', name: 'Político' }, { id: 'provincial', name: 'Provincias' }, { id: 'economico', name: 'Economía' },
  { id: 'recursos', name: 'Recursos' }, { id: 'militar', name: 'Militar' }, { id: 'comercial', name: 'Comercio' }, { id: 'diplomatico', name: 'Diplomacia' },
  { id: 'demografico', name: 'Demografía' }, { id: 'estabilidad', name: 'Estabilidad' }, { id: 'infraestructura', name: 'Infraestructuras' }, { id: 'suministros', name: 'Suministros' }, { id: 'exploracion', name: 'Exploración' },
];
const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const BC = BIOME_LIST.map(b => hex(BIOMES[b].color));

export interface Sel { kind: 'prov' | 'army' | 'exp' | null; id: number; }
export class Atlas {
  cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: World; g: GameState;
  base!: HTMLCanvasElement; overlay: HTMLCanvasElement; fog: HTMLCanvasElement; fogTmp: HTMLCanvasElement; parch!: CanvasPattern | null;
  provPath!: Path2D; kBorders: { color: string; path: Path2D }[] = []; ownerEdges: Path2D = new Path2D(); riverPaths: { path: Path2D; w: number }[] = [];
  vx = 0; vy = 0; z = 0.5; layer = 'politico'; sel: Sel = { kind: null, id: -1 }; hover = -1; preview: number[] | null = null; dpr = 1; dirty = true; overlayKey = '';
  constructor(cv: HTMLCanvasElement, w: World, g: GameState) {
    this.cv = cv; this.ctx = cv.getContext('2d')!; this.w = w; this.g = g;
    this.overlay = document.createElement('canvas'); this.overlay.width = W; this.overlay.height = H;
    this.fog = document.createElement('canvas'); this.fog.width = W; this.fog.height = H; this.fogTmp = document.createElement('canvas');
    this.buildBase(); this.buildStaticPaths(); this.refresh();
  }
  setGame(g: GameState) { this.g = g; this.refresh(); }
  // ---------- capa base estática ----------
  buildBase() {
    const w = this.w; const bw = W * S, bh = H * S; const c = document.createElement('canvas'); c.width = bw; c.height = bh; const x = c.getContext('2d')!;
    const img = x.createImageData(bw, bh); const d = img.data; const nz = new Noise2D(w.seed + 99);
    const F = new Float32Array(W * H); const DW = new Float32Array(W * H);
    // campo continuo tierra/agua y distancia
    const distW = new Float32Array(W * H).fill(99); { const q: number[] = []; for (let i = 0; i < W * H; i++) if (!w.land[i]) { distW[i] = 0; q.push(i); } let h = 0; while (h < q.length) { const c0 = q[h++]; const cx = c0 % W, cy = (c0 / W) | 0; for (const [dx, dy] of N4) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (distW[j] > distW[c0] + 1) { distW[j] = distW[c0] + 1; q.push(j); } } } }
    for (let i = 0; i < W * H; i++) { F[i] = w.land[i] ? Math.min(1, 0.25 + distW[i] * 0.3) : -Math.min(1, 0.25 + (w.lake[i] ? 1 : w.distLand[i]) * 0.3); DW[i] = w.land[i] ? 0 : (w.lake[i] ? 1 : w.distLand[i]); }
    const samp = (arr: Float32Array | Uint8Array, fx: number, fy: number) => { fx = Math.max(0, Math.min(W - 1.001, fx)); fy = Math.max(0, Math.min(H - 1.001, fy)); const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0; const i = y0 * W + x0; return (arr[i] * (1 - tx) + arr[i + 1] * tx) * (1 - ty) + (arr[i + W] * (1 - tx) + arr[i + W + 1] * tx) * ty; };
    const el = w.elev;
    for (let py = 0; py < bh; py++) {
      const fy = py / S - 0.5;
      for (let px = 0; px < bw; px++) {
        const fx = px / S - 0.5; const o = (py * bw + px) * 4;
        const n1 = nz.n(px / 24, py / 24) * 0.5 + nz.n(px / 7, py / 7) * 0.2;
        const f = samp(F, fx, fy) + n1 * 0.18;
        const grain = ((hashNums(px, py) & 255) / 255 - 0.5) * 10;
        let r: number, gg: number, b: number;
        if (f < 0) {
          const dd = samp(DW, fx, fy) + n1 * 0.6; const deep = Math.min(1, dd / 9);
          r = 150 - 85 * deep; gg = 182 - 72 * deep; b = 176 - 50 * deep;
          const ring = Math.abs(((dd + 0.2) % 1.6) - 0.8); if (dd < 4.2 && ring < 0.08) { const a = (1 - dd / 4.2) * 0.45; r += (225 - r) * a; gg += (225 - gg) * a; b += (215 - b) * a; }
          if (f > -0.06) { r = 70; gg = 58; b = 44; }
        } else {
          const cx = Math.max(0, Math.min(W - 1, Math.round(fx + nz.n(px / 5, py / 5) * 0.7))), cy = Math.max(0, Math.min(H - 1, Math.round(fy + nz.n(px / 5 + 50, py / 5) * 0.7)));
          // mezcla bilineal de colores de bioma
          const x0 = Math.max(0, Math.min(W - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(H - 2, Math.floor(fy))); const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
          const cc = [y0 * W + x0, y0 * W + x0 + 1, (y0 + 1) * W + x0, (y0 + 1) * W + x0 + 1]; const ww = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
          r = 0; gg = 0; b = 0; let tw = 0; for (let k = 0; k < 4; k++) { if (!w.land[cc[k]]) continue; const col = BC[w.biome[cc[k]]]; r += col[0] * ww[k]; gg += col[1] * ww[k]; b += col[2] * ww[k]; tw += ww[k]; }
          if (tw < 0.01) { const col = BC[w.biome[cy * W + cx]]; r = col[0]; gg = col[1]; b = col[2]; tw = 1; }
          r /= tw; gg /= tw; b /= tw;
          // sombreado de relieve (luz del noroeste)
          const e0 = samp(el, fx, fy), ex = samp(el, fx + 0.6, fy), ey = samp(el, fx, fy + 0.6);
          const sh = Math.max(-0.35, Math.min(0.35, ((e0 - ex) + (e0 - ey)) * 3.2));
          r *= 1 + sh; gg *= 1 + sh; b *= 1 + sh * 0.9;
          // tono de pergamino
          r = r * 0.86 + 236 * 0.14; gg = gg * 0.86 + 222 * 0.14; b = b * 0.86 + 190 * 0.14;
          if (f < 0.07) { r = 70; gg = 58; b = 44; }
        }
        d[o] = Math.max(0, Math.min(255, r + grain)); d[o + 1] = Math.max(0, Math.min(255, gg + grain)); d[o + 2] = Math.max(0, Math.min(255, b + grain * 0.8)); d[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    // glifos: ríos, bosques, colinas, montañas
    const rnd = new RNG(hashNums(w.seed, 1234));
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const rv of w.rivers) {
      const pts = rv.cells.map(c => [(c % W + 0.5 + (rnd.next() - 0.5) * 0.5) * S, (((c / W) | 0) + 0.5 + (rnd.next() - 0.5) * 0.5) * S]);
      const last = rv.cells[rv.cells.length - 1]; const lx = last % W, ly = (last / W) | 0; for (const [dx, dy] of N4) { const j = (ly + dy) * W + lx + dx; if (!w.land[j]) { pts.push([(lx + dx + 0.5) * S, (ly + dy + 0.5) * S]); break; } }
      for (let i = 1; i < pts.length; i++) { const t = i / pts.length; x.strokeStyle = '#5b8aa0'; x.lineWidth = 1 + t * 2.6; x.beginPath(); const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const mx0 = i > 1 ? (pts[i - 2][0] + ax) / 2 : ax, my0 = i > 1 ? (pts[i - 2][1] + ay) / 2 : ay; x.moveTo(mx0, my0); x.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2); x.stroke(); }
    }
    type Gl = { y: number; f: () => void };
    const gl: Gl[] = [];
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
      const i = cy * W + cx; if (!w.land[i]) continue; const b = BIOME_LIST[w.biome[i]]; const jx = () => (rnd.next() - 0.5) * S * 0.8;
      const px = (cx + 0.5) * S, py = (cy + 0.5) * S;
      if (b === 'bosque' || b === 'selva' || b === 'pantano' && rnd.next() < 0.3) { const n = b === 'selva' ? 3 : 2; for (let k = 0; k < n; k++) { const tx = px + jx(), ty = py + jx(); const rr = S * (b === 'selva' ? 0.5 : 0.42) * (0.8 + rnd.next() * 0.4); const dark = b === 'selva' ? '#2f5532' : '#486b3a'; gl.push({ y: ty, f: () => { x.fillStyle = '#5b4a33'; x.fillRect(tx - 0.6, ty, 1.2, rr * 0.9); x.beginPath(); x.arc(tx, ty, rr, 0, 7); x.fillStyle = dark; x.fill(); x.beginPath(); x.arc(tx - rr * 0.3, ty - rr * 0.3, rr * 0.55, 0, 7); x.fillStyle = 'rgba(160,190,110,.35)'; x.fill(); x.lineWidth = 0.6; x.strokeStyle = 'rgba(40,40,25,.6)'; x.beginPath(); x.arc(tx, ty, rr, 0, 7); x.stroke(); } }); } }
      else if (b === 'taiga') { for (let k = 0; k < 2; k++) { const tx = px + jx(), ty = py + jx(); const hh = S * (0.9 + rnd.next() * 0.4); gl.push({ y: ty, f: () => { x.beginPath(); x.moveTo(tx, ty - hh); x.lineTo(tx + hh * 0.38, ty + hh * 0.2); x.lineTo(tx - hh * 0.38, ty + hh * 0.2); x.closePath(); x.fillStyle = '#3f5c45'; x.fill(); x.strokeStyle = 'rgba(30,35,25,.6)'; x.lineWidth = 0.6; x.stroke(); } }); } }
      else if ((b === 'montana' || b === 'nieve') && (cx + cy * 3) % 2 === 0 && rnd.next() < 0.75) {
        const tx = px + jx(), ty = py + jx() * 0.5; const e = w.elev[i]; const hw = S * (1.1 + e * 0.9) * (0.8 + rnd.next() * 0.4), hh = S * (1.0 + e * 1.4); const snow = b === 'nieve' || w.temp[i] < 0.35;
        gl.push({ y: ty, f: () => { x.beginPath(); x.moveTo(tx - hw, ty + hh * 0.3); x.lineTo(tx, ty - hh); x.lineTo(tx + hw, ty + hh * 0.3); x.closePath(); x.fillStyle = '#c9bc9f'; x.fill(); x.beginPath(); x.moveTo(tx, ty - hh); x.lineTo(tx + hw, ty + hh * 0.3); x.lineTo(tx + hw * 0.1, ty + hh * 0.3); x.closePath(); x.fillStyle = '#8f8068'; x.fill();
          if (snow) { x.beginPath(); x.moveTo(tx, ty - hh); x.lineTo(tx + hw * 0.32, ty - hh * 0.55); x.lineTo(tx + hw * 0.05, ty - hh * 0.62); x.lineTo(tx - hw * 0.12, ty - hh * 0.5); x.lineTo(tx - hw * 0.32, ty - hh * 0.55); x.closePath(); x.fillStyle = '#f4f1ea'; x.fill(); }
          x.beginPath(); x.moveTo(tx - hw, ty + hh * 0.3); x.lineTo(tx, ty - hh); x.lineTo(tx + hw, ty + hh * 0.3); x.strokeStyle = '#4a3b2a'; x.lineWidth = 1; x.stroke();
          x.beginPath(); for (let k = 1; k < 4; k++) { x.moveTo(tx + hw * 0.15 * k, ty - hh + hh * 0.3 * k); x.lineTo(tx + hw * 0.15 * k + hw * 0.2, ty - hh + hh * 0.3 * k + hh * 0.15); } x.strokeStyle = 'rgba(60,45,30,.45)'; x.lineWidth = 0.6; x.stroke(); } });
      }
      else if (b === 'colinas' && (cx + cy) % 3 === 0 && rnd.next() < 0.7) { const tx = px + jx(), ty = py + jx(); const hw = S * 1.0; gl.push({ y: ty, f: () => { x.beginPath(); x.arc(tx, ty + hw * 0.4, hw, Math.PI * 1.15, Math.PI * 1.85); x.strokeStyle = 'rgba(80,62,40,.75)'; x.lineWidth = 1; x.stroke(); x.beginPath(); x.arc(tx + 1, ty + hw * 0.45, hw * 0.8, Math.PI * 1.5, Math.PI * 1.85); x.strokeStyle = 'rgba(80,62,40,.35)'; x.lineWidth = 2; x.stroke(); } }); }
      else if (b === 'desierto' && rnd.next() < 0.18) { const tx = px + jx(), ty = py + jx(); gl.push({ y: ty, f: () => { x.beginPath(); x.moveTo(tx - S * 0.8, ty); x.quadraticCurveTo(tx, ty - S * 0.5, tx + S * 0.8, ty); x.strokeStyle = 'rgba(150,110,60,.55)'; x.lineWidth = 0.8; x.stroke(); } }); }
      else if ((b === 'pantano') && rnd.next() < 0.5) { const tx = px + jx(), ty = py + jx(); gl.push({ y: ty, f: () => { x.strokeStyle = 'rgba(60,80,50,.7)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(tx - 3, ty); x.lineTo(tx + 3, ty); x.moveTo(tx - 1, ty); x.lineTo(tx - 2, ty - 3); x.moveTo(tx + 1, ty); x.lineTo(tx + 2, ty - 3); x.stroke(); } }); }
      else if ((b === 'tundra' || b === 'estepa') && rnd.next() < 0.12) { const tx = px + jx(), ty = py + jx(); gl.push({ y: ty, f: () => { x.fillStyle = 'rgba(90,80,60,.45)'; x.fillRect(tx, ty, 1.2, 1.2); x.fillRect(tx + 3, ty + 1, 1.2, 1.2); } }); }
    }
    gl.sort((a, b) => a.y - b.y); for (const q of gl) q.f();
    // marco
    x.strokeStyle = '#3b2b1a'; x.lineWidth = 6; x.strokeRect(3, 3, bw - 6, bh - 6);
    this.base = c;
    // pergamino para la niebla
    const pc = document.createElement('canvas'); pc.width = 256; pc.height = 256; const p = pc.getContext('2d')!; const pi = p.createImageData(256, 256);
    const pn = new Noise2D(7);
    for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) { const o = (y * 256 + xx) * 4; const v = pn.fbm(xx / 40, y / 40, 4) * 18 + ((hashNums(xx, y, 3) & 255) / 255 - 0.5) * 14; pi.data[o] = 226 + v; pi.data[o + 1] = 207 + v; pi.data[o + 2] = 163 + v * 0.8; pi.data[o + 3] = 255; }
    p.putImageData(pi, 0, 0); p.strokeStyle = 'rgba(120,90,50,.08)'; for (let i = -256; i < 256; i += 9) { p.beginPath(); p.moveTo(i, 0); p.lineTo(i + 256, 256); p.stroke(); }
    this.parch = this.ctx.createPattern(pc, 'repeat');
  }
  buildStaticPaths() {
    const w = this.w;
    this.provPath = edgesPath((a, b) => { const pa = w.prov[a], pb = w.prov[b]; return pa >= 0 && pb >= 0 && pa !== pb; });
  }
  // ---------- capas dinámicas ----------
  perceivedOwner(p: number): number { const k = this.g.playerId; const lv = knowLevel(this.w, this.g, k, p); if (lv >= 3) return this.g.provinces[p].owner; if (lv === 2) return this.g.kingdoms[k].lastOwner[p]; return -3; }
  refresh() {
    const w = this.w, g = this.g; const per = w.provinces.map(p => this.perceivedOwner(p.id));
    this.per = per;
    // fronteras de reinos percibidas
    const byK = new Map<number, number>();
    this.kBorders = [];
    const ks = [...new Set(per.filter(o => o >= 0))];
    for (const k of ks) { const path = edgesPath((a, b) => { const pa = w.prov[a], pb = w.prov[b]; if (pa < 0 || pb < 0) return false; const oa = per[pa], ob = per[pb]; return (oa === k) !== (ob === k) && oa !== -3 && ob !== -3; }); this.kBorders.push({ color: g.kingdoms[k].color, path }); }
    this.ownerEdges = edgesPath((a, b) => { const pa = w.prov[a], pb = w.prov[b]; if (pa < 0 || pb < 0) return false; return per[pa] !== per[pb] && per[pa] !== -3 && per[pb] !== -3; });
    this.buildFog(); this.overlayKey = ''; this.dirty = true;
  }
  per: number[] = [];
  buildFog() {
    const w = this.w, g = this.g, k = g.kingdoms[g.playerId]; const x = this.fog.getContext('2d')!; const img = x.createImageData(W, H);
    const lvP = w.provinces.map(p => knowLevel(w, g, g.playerId, p.id));
    for (let i = 0; i < W * H; i++) {
      let a = 0; const p = w.prov[i], s = w.sea[i];
      if (p >= 0) { const l = lvP[p]; a = l === 0 ? 1 : l === 1 ? 0.5 : l === 2 ? 0.2 : 0; }
      else if (s >= 0) { const l = k.seaKnown[s]; a = l === 0 ? 1 : l === 1 ? 0.45 : 0; }
      else { // lagos: según la provincia vecina
        let m = 1; const cx = i % W, cy = (i / W) | 0; for (const [dx, dy] of N4) { const j = (cy + dy) * W + cx + dx; if (w.prov[j] >= 0) m = Math.min(m, lvP[w.prov[j]] >= 2 ? 0 : 1); } a = m; }
      img.data[i * 4 + 3] = Math.round(a * 255);
    }
    x.putImageData(img, 0, 0);
  }
  layerColor(pid: number): string | null {
    const g = this.g, w = this.w, k = g.playerId; const lv = knowLevel(w, g, k, pid); const p = g.provinces[pid]; const own = p.owner === k;
    const per = this.per[pid];
    const heat = (t: number, a = 0.55) => { t = Math.max(0, Math.min(1, t)); const r = Math.round(200 - 120 * t), gg = Math.round(70 + 120 * t), b = 60; return `rgba(${r},${gg},${b},${a})`; };
    switch (this.layer) {
      case 'fisico': return null;
      case 'politico': if (per >= 0) return g.kingdoms[per].color + '70'; if (per === -1 && lv >= 2) return 'rgba(230,220,190,0.25)'; return null;
      case 'provincial': if (lv < 1) return null; { const h = hashNums(pid, 9) % 360; return `hsla(${h},35%,62%,0.5)`; }
      case 'economico': if (lv < 3 || p.owner < 0) return null; { const e = provinceEconomy(w, g, pid); const v = sum(e.prod.oro) + sum(e.prod.alimentos) * 0.8 + sum(e.prod.madera) * 0.6 + sum(e.prod.piedra) * 0.6 + sum(e.prod.hierro) * 2; return heat(v / 70, own ? 0.6 : 0.35); }
      case 'recursos': return null;
      case 'militar': if (lv < 2) return null; { const f = (p.buildings.murallas || 0) + (p.buildings.castillo ? 2 : 0); if (p.owner >= 0 && atWar(g, k, p.owner)) return `rgba(170,40,30,${0.25 + f * 0.08})`; if (p.occupier >= 0) return 'rgba(120,30,30,.55)'; return f ? `rgba(90,80,70,${0.15 + f * 0.1})` : null; }
      case 'comercial': if (lv < 2 || p.owner < 0) return null; { if (p.owner === k) return p.buildings.mercado || p.buildings.puerto ? 'rgba(200,160,60,.55)' : 'rgba(200,170,90,.25)'; const r = rel(g, k, p.owner); if (r?.trade) return 'rgba(220,170,50,.5)'; if (r?.war) return 'rgba(150,50,40,.35)'; return 'rgba(150,150,150,.15)'; }
      case 'diplomatico': if (per < 0) return null; { if (per === k) return 'rgba(60,110,60,.55)'; const r = rel(g, k, per); if (!r) return null; if (r.war) return 'rgba(170,40,30,.6)'; if (r.alliance) return 'rgba(50,130,70,.55)'; if (r.protectorate === k) return 'rgba(90,150,90,.45)'; if (r.nap || r.trade) return 'rgba(150,180,100,.45)'; const o = r.opinion; return o < -20 ? 'rgba(210,120,50,.5)' : o > 20 ? 'rgba(170,200,140,.45)' : 'rgba(170,170,160,.4)'; }
      case 'demografico': if (lv < 2) return null; { let best = 'humano', bv = 0; for (const s of SPECIES_IDS) if (p.species[s] > bv) { bv = p.species[s]; best = s; } const dens = Math.min(1, p.pop / w.provinces[pid].area / 400); const [r, gg, b] = hex(SPECIES[best as keyof typeof SPECIES].color); return `rgba(${r},${gg},${b},${0.25 + dens * 0.5})`; }
      case 'estabilidad': if (!own && lv < 3) return null; if (p.owner < 0) return null; return heat(p.stability / 100, own ? 0.6 : 0.3);
      case 'infraestructura': if (lv < 3 || p.owner < 0) return null; { const b = p.buildings; const v = (b.camino ? 2 : 0) + (b.puerto || 0) + (b.deposito ? 1 : 0) + Object.values(b).reduce((s, x) => s + x, 0) * 0.15; return heat(v / 5, 0.5); }
      case 'suministros': if (lv < 3) return null; { const sup = isSupplied(w, g, { owner: k, prov: pid }); const cap = supplyCapacity(w, g, pid); return sup ? `rgba(70,140,70,${0.2 + Math.min(0.45, cap / 40000)})` : (p.owner >= 0 && atWar(g, k, p.owner) ? 'rgba(160,40,30,.45)' : 'rgba(170,120,60,.3)'); }
      case 'exploracion': return ['rgba(40,30,20,.0)', 'rgba(190,150,80,.55)', 'rgba(220,200,100,.5)', 'rgba(140,200,120,.5)', 'rgba(60,130,70,.6)'][lv];
    }
    return null;
  }
  buildOverlay() {
    const key = this.layer + ':' + this.g.turn + ':' + this.g.provinces.reduce((s, p) => s + p.owner * 3 + p.occupier, 0) + ':' + JSON.stringify(this.g.kingdoms[this.g.playerId].laws);
    if (key === this.overlayKey) return; this.overlayKey = key;
    const x = this.overlay.getContext('2d')!; x.clearRect(0, 0, W, H);
    const cols = this.w.provinces.map(p => this.layerColor(p.id));
    const img = x.createImageData(W, H);
    const cache = new Map<string, number[]>();
    const parse = (c: string) => { let v = cache.get(c); if (v) return v; const t = document.createElement('canvas').getContext('2d')!; t.fillStyle = c; const s = t.fillStyle as string; if (s.startsWith('#')) { v = [...hex(s), 255]; } else { const m = s.match(/[\d.]+/g)!.map(Number); v = [m[0], m[1], m[2], Math.round((m[3] ?? 1) * 255)]; } if (c.length === 9 && c.startsWith('#')) v[3] = parseInt(c.slice(7, 9), 16); cache.set(c, v); return v; };
    for (let i = 0; i < W * H; i++) { const p = this.w.prov[i]; if (p < 0) continue; const c = cols[p]; if (!c) continue; const v = parse(c); img.data.set(v, i * 4); }
    x.putImageData(img, 0, 0);
  }
  // ---------- dibujo ----------
  resize() { const r = this.cv.getBoundingClientRect(); this.dpr = window.devicePixelRatio || 1; this.cv.width = Math.round(r.width * this.dpr); this.cv.height = Math.round(r.height * this.dpr); this.dirty = true; }
  toWorld(sx: number, sy: number) { return [sx / this.z + this.vx, sy / this.z + this.vy]; }
  toScreen(wx: number, wy: number) { return [(wx - this.vx) * this.z, (wy - this.vy) * this.z]; }
  cellAt(sx: number, sy: number) { const [wx, wy] = this.toWorld(sx, sy); const cx = Math.floor(wx / S), cy = Math.floor(wy / S); if (cx < 0 || cy < 0 || cx >= W || cy >= H) return -1; return cy * W + cx; }
  centerOn(cx: number, cy: number, z?: number) { const r = this.cv.getBoundingClientRect(); if (z) this.z = z; this.vx = (cx + 0.5) * S - r.width / 2 / this.z; this.vy = (cy + 0.5) * S - r.height / 2 / this.z; this.clamp(); this.dirty = true; }
  clamp() { const r = this.cv.getBoundingClientRect(); const mw = W * S, mh = H * S; this.z = Math.max(Math.min(r.width / mw, r.height / mh) * 0.95, Math.min(3, this.z)); this.vx = Math.max(-r.width / this.z * 0.3, Math.min(mw - r.width / this.z * 0.7, this.vx)); this.vy = Math.max(-r.height / this.z * 0.3, Math.min(mh - r.height / this.z * 0.7, this.vy)); }
  draw() {
    const c = this.ctx, w = this.w, g = this.g; const dpr = this.dpr; const cw = this.cv.width / dpr, ch = this.cv.height / dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#2b2118'; c.fillRect(0, 0, cw, ch);
    c.save(); c.translate(-this.vx * this.z, -this.vy * this.z); c.scale(this.z, this.z);
    c.imageSmoothingEnabled = true; c.drawImage(this.base, 0, 0);
    this.buildOverlay(); c.drawImage(this.overlay, 0, 0, W * S, H * S);
    // fronteras
    if (this.z > 0.55 && this.layer !== 'fisico') { c.setLineDash([3, 3]); c.strokeStyle = 'rgba(70,50,30,.35)'; c.lineWidth = 0.8 / Math.max(0.6, this.z); c.stroke(this.provPath); c.setLineDash([]); }
    if (['politico', 'diplomatico', 'militar', 'comercial', 'fisico', 'provincial'].includes(this.layer)) { for (const kb of this.kBorders) { c.strokeStyle = kb.color + 'cc'; c.lineWidth = 3.2 / Math.max(0.5, this.z) + 1; c.stroke(kb.path); } c.strokeStyle = 'rgba(40,25,15,.75)'; c.lineWidth = 1 / Math.max(0.5, this.z); c.stroke(this.ownerEdges); }
    this.drawFields(c);
    c.restore();
    // niebla con pergamino (en coordenadas de pantalla)
    const ft = this.fogTmp; if (ft.width !== this.cv.width || ft.height !== this.cv.height) { ft.width = this.cv.width; ft.height = this.cv.height; }
    const fx = ft.getContext('2d')!; fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, ft.width, ft.height); fx.globalCompositeOperation = 'source-over'; fx.imageSmoothingEnabled = true;
    fx.setTransform(dpr * this.z, 0, 0, dpr * this.z, -this.vx * this.z * dpr, -this.vy * this.z * dpr); fx.drawImage(this.fog, -S * 0.5, -S * 0.5, W * S + S, H * S + S);
    fx.setTransform(dpr, 0, 0, dpr, 0, 0); fx.globalCompositeOperation = 'source-in'; if (this.parch) { fx.fillStyle = this.parch; fx.fillRect(0, 0, cw, ch); }
    fx.globalCompositeOperation = 'source-over';
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(ft, 0, 0); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // por encima de la niebla: elementos conocidos
    this.drawRoads(c); this.drawCities(c); this.drawResources(c); this.drawExpeditions(c); this.drawArmies(c); this.drawLabels(c); this.drawSelection(c); this.drawCompass(c, cw, ch);
    this.dirty = false;
  }
  sx(cell: number) { return this.toScreen((cell % W + 0.5) * S, (((cell / W) | 0) + 0.5) * S); }
  drawFields(c: CanvasRenderingContext2D) {
    // campos de cultivo y canales de riego (escala del mundo)
    const g = this.g, w = this.w; if (this.z < 0.45) return;
    for (const p of g.provinces) {
      if (knowLevel(w, g, g.playerId, p.id) < 3) continue; const s = w.provinces[p.id]; const n = (p.buildings.granja || 0) * 2; if (!n || s.sites.farm < 0) continue;
      const r = new RNG(hashNums(p.id, 55)); const fx = (s.sites.farm % W + 0.5) * S, fy = (((s.sites.farm / W) | 0) + 0.5) * S;
      for (let i = 0; i < n; i++) { const ox = fx + (r.next() - 0.5) * S * 3, oy = fy + (r.next() - 0.5) * S * 3; const a = r.next() * 0.6 - 0.3; c.save(); c.translate(ox, oy); c.rotate(a); c.fillStyle = ['#c9b56a', '#a8a35a', '#d2bf7a', '#8f9a52'][i % 4]; c.fillRect(-S * 0.7, -S * 0.45, S * 1.4, S * 0.9); c.strokeStyle = 'rgba(90,70,40,.5)'; c.lineWidth = 0.4; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(-S * 0.7, k * S * 0.18); c.lineTo(S * 0.7, k * S * 0.18); c.stroke(); } c.strokeRect(-S * 0.7, -S * 0.45, S * 1.4, S * 0.9); c.restore(); }
      if (p.buildings.riego) { c.strokeStyle = '#5f97b0'; c.lineWidth = 1; c.beginPath(); c.moveTo(fx - S * 1.6, fy - S); c.lineTo(fx + S * 1.6, fy + S * 0.4); c.moveTo(fx - S * 1.4, fy + S); c.lineTo(fx + S * 1.2, fy - S * 0.8); c.stroke(); }
    }
  }
  drawRoads(c: CanvasRenderingContext2D) {
    const g = this.g, w = this.w; if (this.z < 0.3) return; const seen = new Set<string>();
    c.lineCap = 'round';
    for (const p of g.provinces) {
      if (!p.buildings.camino || knowLevel(w, g, g.playerId, p.id) < 3) continue;
      for (const n of w.provinces[p.id].neighbors) {
        const q = g.provinces[n]; if (!q.buildings.camino || knowLevel(w, g, g.playerId, n) < 3) continue; const key = Math.min(p.id, n) + '-' + Math.max(p.id, n); if (seen.has(key)) continue; seen.add(key);
        const a = w.provinces[p.id].city, b = w.provinces[n].city; const [ax, ay] = this.sx(a), [bx, by] = this.sx(b);
        const mx = (ax + bx) / 2 + (ay - by) * 0.08, my = (ay + by) / 2 + (bx - ax) * 0.08;
        c.strokeStyle = 'rgba(90,60,30,.85)'; c.lineWidth = Math.max(1.2, 2 * this.z); c.setLineDash([5 * Math.max(0.6, this.z), 3 * Math.max(0.6, this.z)]); c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, my, bx, by); c.stroke(); c.setLineDash([]);
        // puente donde el camino cruza un río
        for (let t = 0.05; t < 0.95; t += 0.03) { const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * mx + t * t * bx, y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * my + t * t * by; const ci = this.cellAt(x, y); if (ci >= 0 && w.river[ci]) { const s2 = Math.max(4, 6 * this.z); c.fillStyle = '#b9a27a'; c.strokeStyle = '#4a3522'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - s2, y + s2 * 0.3); c.quadraticCurveTo(x, y - s2 * 0.8, x + s2, y + s2 * 0.3); c.lineTo(x + s2, y + s2 * 0.6); c.quadraticCurveTo(x, y - s2 * 0.4, x - s2, y + s2 * 0.6); c.closePath(); c.fill(); c.stroke(); break; } }
      }
    }
  }
  drawCities(c: CanvasRenderingContext2D) {
    const g = this.g, w = this.w; const z = this.z; const sc = Math.max(0.55, Math.min(1.6, z * 1.1));
    for (const p of g.provinces) {
      const lv = knowLevel(w, g, g.playerId, p.id); if (lv < 2) continue; const s = w.provinces[p.id]; const owner = lv >= 3 ? p.owner : g.kingdoms[g.playerId].lastOwner[p.id];
      const isCap = owner >= 0 && g.kingdoms[owner].capital === p.id; const tier = p.pop > 45000 ? 3 : p.pop > 18000 ? 2 : 1;
      if (z < 0.32 && !isCap) continue;
      const [x, y] = this.sx(s.city); const col = owner >= 0 ? g.kingdoms[owner].color : '#8a7a5a';
      const B = lv >= 3 ? p.buildings : {} as Record<string, number>; const detail = z >= 0.62;
      // edificios en sus emplazamientos
      if (lv >= 3 && detail) {
        if (B.mina && s.sites.mine >= 0) { const [mx, my] = this.sx(s.sites.mine); glyphMine(c, mx, my, sc); }
        if (B.cantera && s.sites.quarry >= 0) { const [mx, my] = this.sx(s.sites.quarry); glyphQuarry(c, mx + 10 * sc, my + 6 * sc, sc); }
        if (B.aserradero && s.sites.forest >= 0) { const [mx, my] = this.sx(s.sites.forest); glyphSawmill(c, mx, my, sc); }
        if (B.molino && s.sites.farm >= 0) { const [mx, my] = this.sx(s.sites.farm); glyphMill(c, mx + 9 * sc, my - 4 * sc, sc); }
        if (B.torre && s.sites.tower >= 0) { const [mx, my] = this.sx(s.sites.tower); glyphTower(c, mx, my, sc, col); }
        if (B.cuartel) glyphTents(c, x - 16 * sc, y + 9 * sc, sc, col);
        if (B.deposito) glyphCrates(c, x + 16 * sc, y + 10 * sc, sc);
        if (z > 1.25) { let k = 0; for (const [id, f] of [['biblioteca', glyphLibrary], ['universidad', glyphDome], ['hospital', glyphHospital], ['mercado', glyphMarket]] as const) if (B[id]) { (f as any)(c, x - 14 * sc + k * 9 * sc, y - 15 * sc, sc); k++; } }
      }
      if (lv >= 3 && B.puerto && s.sites.port >= 0) { const pc = s.sites.port; let wx = pc; const px0 = pc % W, py0 = (pc / W) | 0; for (const [dx, dy] of N4) { const j = (py0 + dy) * W + px0 + dx; if (w.sea[j] >= 0) { wx = j; break; } } const [ax, ay] = this.sx(pc), [bx, by] = this.sx(wx); glyphPort(c, ax, ay, bx, by, sc, B.puerto, col); }
      // ciudad
      if (lv >= 3 && B.castillo) glyphCastle(c, x + 13 * sc, y - 6 * sc, sc * 1.1, col);
      glyphCity(c, x, y, sc, tier, isCap, col, lv >= 3 ? (B.murallas || 0) : 0, s.climate, p.species);
      if (lv >= 3 && p.queue.length && detail) glyphScaffold(c, x + 12 * sc, y + 6 * sc, sc, 1 - p.queue[0].monthsLeft / p.queue[0].total);
      if (p.siege && lv >= 3) { c.strokeStyle = '#a02818'; c.lineWidth = 2; c.setLineDash([3, 3]); c.beginPath(); c.arc(x, y, 14 * sc, 0, Math.PI * 2 * p.siege.progress / 100); c.stroke(); c.setLineDash([]); }
      if (p.occupier >= 0 && lv >= 3) { c.fillStyle = g.kingdoms[p.occupier].color; c.strokeStyle = '#2a1a10'; c.beginPath(); c.moveTo(x - 2, y - 22 * sc); c.lineTo(x - 2, y - 12 * sc); c.stroke(); c.fillRect(x - 2, y - 22 * sc, 9 * sc, 5 * sc); }
      if (p.colonizing && lv >= 2) glyphScaffold(c, x, y - 4, sc, 0.5);
      if (z > 0.75 || isCap) { c.font = `${isCap ? 'bold ' : ''}${Math.round((isCap ? 12 : 10.5) * Math.min(1.25, sc))}px "EB Garamond", Georgia, serif`; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(245,235,210,.9)'; c.strokeText(p.cityName, x, y + 17 * sc); c.fillStyle = '#2b1d10'; c.fillText(p.cityName, x, y + 17 * sc); }
    }
  }
  drawResources(c: CanvasRenderingContext2D) {
    if (this.layer !== 'recursos') return; const g = this.g, w = this.w;
    for (const p of g.provinces) { if (knowLevel(w, g, g.playerId, p.id) < 2) continue; const s = w.provinces[p.id]; const deps = s.deposits.filter((d, i) => !d.hidden || p.revealedDeposits.includes(i)); const [x, y] = this.toScreen((s.cx + 0.5) * S, (s.cy + 0.5) * S);
      deps.forEach((d, i) => { const xx = x + (i - (deps.length - 1) / 2) * 20, yy = y - 4; c.fillStyle = '#f3e7c8'; c.strokeStyle = '#4a3522'; c.lineWidth = 1; c.beginPath(); c.arc(xx, yy, 9, 0, 7); c.fill(); c.stroke(); c.fillStyle = DEP_COL[d.kind] || '#555'; c.beginPath(); c.arc(xx, yy, 5.5, 0, 7); c.fill(); c.font = 'bold 8px Georgia'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(DEPOSITS[d.kind].name[0], xx, yy + 3); }); }
  }
  armySlots(): Map<number, number[]> { const m = new Map<number, number[]>(); for (const a of this.g.armies) { if (!this.armyVisible(a)) continue; const l = m.get(a.prov) || []; l.push(a.id); m.set(a.prov, l); } return m; }
  armyVisible(a: any) { return a.owner === this.g.playerId || isVisible(this.w, this.g, this.g.playerId, a.prov); }
  armyPos(a: any, slots: Map<number, number[]>): [number, number] { const s = this.w.provinces[a.prov]; const l = slots.get(a.prov) || [a.id]; const i = l.indexOf(a.id); let [x, y] = this.sx(s.city); x += (i - (l.length - 1) / 2) * 30 - 0; y -= 26 * Math.max(0.7, Math.min(1.3, this.z)); if (a.path.length && a.progress > 0) { const [nx, ny] = this.sx(this.w.provinces[a.path[0]].city); x += (nx - x) * a.progress * 0.8; y += (ny - y + 26) * a.progress * 0.8; } return [x, y]; }
  drawArmies(c: CanvasRenderingContext2D) {
    const g = this.g; const slots = this.armySlots();
    for (const a of g.armies) {
      if (!this.armyVisible(a)) continue; const [x, y] = this.armyPos(a, slots); const k = g.kingdoms[a.owner]; const mine = a.owner === g.playerId; const sel = this.sel.kind === 'army' && this.sel.id === a.id;
      if ((mine || sel) && a.path.length) { // ruta
        c.strokeStyle = mine ? 'rgba(40,25,10,.85)' : 'rgba(140,30,20,.8)'; c.lineWidth = 2.2; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(x, y + 10); let px = x, py = y + 10; for (const p of a.path) { const [qx, qy] = this.sx(this.w.provinces[p].city); c.lineTo(qx, qy); px = qx; py = qy; } c.stroke(); c.setLineDash([]); arrowHead(c, px, py, a.path.length > 1 ? this.sx(this.w.provinces[a.path[a.path.length - 2]].city) : [x, y], '#2a1a0c');
      }
      const men = armyMen(a); const est = mine || (a.owner >= 0 && rel(g, g.playerId, a.owner)?.alliance) ? men.toLocaleString('es') : '≈' + (Math.round(men / 100) * 100).toLocaleString('es');
      banner(c, x, y, k.color, k.color2, est, sel, a.sieging, atWar(g, g.playerId, a.owner));
    }
    if (this.preview && this.sel.kind === 'army') { const a = g.armies.find(x => x.id === this.sel.id); if (a) { const [x, y] = this.armyPos(a, slots); c.strokeStyle = 'rgba(20,90,40,.9)'; c.lineWidth = 3; c.setLineDash([2, 5]); c.beginPath(); c.moveTo(x, y + 10); let last: [number, number] = [x, y]; let prev: [number, number] = [x, y]; for (const p of this.preview) { prev = last; last = this.sx(this.w.provinces[p].city) as [number, number]; c.lineTo(last[0], last[1]); } c.stroke(); c.setLineDash([]); arrowHead(c, last[0], last[1], prev, '#145a28'); } }
  }
  drawExpeditions(c: CanvasRenderingContext2D) {
    const g = this.g, w = this.w;
    for (const e of g.expeditions) {
      if (e.owner !== g.playerId) continue; const live = e.state === 'activa' || e.state === 'regreso'; const sel = this.sel.kind === 'exp' && this.sel.id === e.id; if (!live && !sel) continue;
      c.strokeStyle = sel ? 'rgba(120,40,20,.95)' : 'rgba(120,60,20,.6)'; c.lineWidth = sel ? 2.4 : 1.6; c.setLineDash([2, 4]); c.beginPath();
      e.route.forEach((r, i) => { const [px, py] = posOf(w, r); const [x, y] = this.toScreen((px + 0.5) * S, (py + 0.5) * S); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke(); c.setLineDash([]);
      if (!live) continue; const [px, py] = posOf(w, e.loc); const [x, y] = this.toScreen((px + 0.5) * S, (py + 0.5) * S);
      glyphExpedition(c, x, y, e.loc.t === 's', sel, g.kingdoms[e.owner].color);
    }
  }
  drawLabels(c: CanvasRenderingContext2D) {
    const g = this.g, w = this.w; const z = this.z;
    // mares
    if (z > 0.38) { c.font = `italic ${Math.round(11 * Math.min(1.3, z * 1.2))}px "EB Garamond", Georgia, serif`; c.textAlign = 'center'; c.fillStyle = 'rgba(30,60,80,.75)'; for (const s of w.seas) { if (g.kingdoms[g.playerId].seaKnown[s.id] < 2 || s.cells.length < 120) continue; const [x, y] = this.toScreen((s.cx + 0.5) * S, (s.cy + 0.5) * S); spaced(c, s.name, x, y, 1.5); } }
    // reinos
    if (['politico', 'diplomatico', 'fisico', 'militar'].includes(this.layer)) {
      const acc = new Map<number, { x: number; y: number; n: number }>();
      this.per.forEach((o, p) => { if (o < 0) return; const s = w.provinces[p]; const e = acc.get(o) || { x: 0, y: 0, n: 0 }; e.x += s.cx * s.area; e.y += s.cy * s.area; e.n += s.area; acc.set(o, e); });
      for (const [k, e] of acc) { const K = g.kingdoms[k]; if (K.independent && z < 0.7) continue; const [x, y] = this.toScreen((e.x / e.n + 0.5) * S, (e.y / e.n + 0.5) * S); const size = Math.max(10, Math.min(30, Math.sqrt(e.n) * 0.75 * z)); c.font = `600 ${Math.round(size)}px "Cinzel", "Trajan Pro", Georgia, serif`; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = 'rgba(245,235,210,.7)'; const name = (K.independent ? K.short : K.short).toUpperCase(); spaced(c, name, x, y - (z > 0.75 ? size * 1.2 : 0), size * 0.25, true); c.fillStyle = 'rgba(50,30,15,.78)'; spaced(c, name, x, y - (z > 0.75 ? size * 1.2 : 0), size * 0.25); }
    }
    // provincias
    if (z > 1.25) { c.font = `italic ${Math.round(10 * Math.min(1.4, z * 0.8))}px "EB Garamond", Georgia, serif`; c.textAlign = 'center'; c.fillStyle = 'rgba(60,40,20,.7)'; for (const s of w.provinces) { if (knowLevel(w, g, g.playerId, s.id) < 1) continue; const [x, y] = this.toScreen((s.cx + 0.5) * S, (s.cy + 0.5) * S + S * 2.8); c.fillText(s.name, x, y); } }
    // continentes conocidos
    if (z < 0.6) { c.font = `${Math.round(22 * z * 2)}px "Cinzel", Georgia, serif`; c.fillStyle = 'rgba(60,40,20,.28)'; for (const ct of w.continents) { const ps = w.provinces.filter(p => p.continent === ct.id); const kn = ps.filter(p => g.kingdoms[g.playerId].known[p.id] >= 1).length; if (!ps.length || kn / ps.length < 0.4) continue; const [x, y] = this.toScreen(ct.cx * S, (ct.cy + 14) * S); spaced(c, ct.name.toUpperCase(), x, y, 8); } }
  }
  drawSelection(c: CanvasRenderingContext2D) {
    const w = this.w; const p = this.sel.kind === 'prov' ? this.sel.id : -1;
    for (const id of [this.hover, p]) { if (id < 0) continue; const s = w.provinces[id]; c.save(); c.translate(-this.vx * this.z, -this.vy * this.z); c.scale(this.z, this.z); const path = provOutline(w, id); c.strokeStyle = id === p ? 'rgba(255,240,180,.95)' : 'rgba(255,250,230,.55)'; c.lineWidth = (id === p ? 3 : 2) / this.z; c.stroke(path); if (id === p) { c.strokeStyle = 'rgba(60,30,10,.9)'; c.lineWidth = 1 / this.z; c.stroke(path); } c.restore(); }
  }
  drawCompass(c: CanvasRenderingContext2D, cw: number, ch: number) {
    const x = 60, y = ch - 70, r = 34; c.save(); c.translate(x, y); c.globalAlpha = 0.85; c.strokeStyle = '#3b2b1a'; c.fillStyle = '#efe2c0'; c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, r * 0.62, 0, 7); c.fill(); c.stroke();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const L = i % 2 ? r * 0.6 : r; c.beginPath(); c.moveTo(Math.cos(a - 0.2) * r * 0.18, Math.sin(a - 0.2) * r * 0.18); c.lineTo(Math.cos(a) * L, Math.sin(a) * L); c.lineTo(Math.cos(a + 0.2) * r * 0.18, Math.sin(a + 0.2) * r * 0.18); c.closePath(); c.fillStyle = i % 2 ? '#c9b48a' : (i === 6 ? '#8c2f24' : '#4a3522'); c.fill(); c.stroke(); }
    c.font = 'bold 11px Cinzel, Georgia'; c.fillStyle = '#3b2b1a'; c.textAlign = 'center'; c.fillText('N', 0, -r - 4); c.restore();
  }
  hitArmy(sx: number, sy: number): number | null { const slots = this.armySlots(); let best: number | null = null; for (const a of this.g.armies) { if (!this.armyVisible(a)) continue; const [x, y] = this.armyPos(a, slots); if (Math.abs(sx - x) < 14 && sy > y - 18 && sy < y + 16) best = a.id; } return best; }
  hitExp(sx: number, sy: number): number | null { for (const e of this.g.expeditions) { if (e.owner !== this.g.playerId || (e.state !== 'activa' && e.state !== 'regreso')) continue; const [px, py] = posOf(this.w, e.loc); const [x, y] = this.toScreen((px + 0.5) * S, (py + 0.5) * S); if (Math.hypot(sx - x, sy - y) < 13) return e.id; } return null; }
}
const DEP_COL: Record<string, string> = { hierro: '#6b6f78', cobre: '#b06a3a', oro: '#c9a227', plata: '#a9b0b8', gemas: '#6a3fa0', sal: '#d8d2c4', especias: '#b5452a', caballos: '#7a5a3a', plantas: '#4f8a4a' };
const outlineCache = new Map<number, Path2D>();
function provOutline(w: World, id: number) { let p = outlineCache.get(id); if (p) return p; p = edgesPath((a, b) => (w.prov[a] === id) !== (w.prov[b] === id)); outlineCache.set(id, p); return p; }
// Construye trayectos suavizados (Chaikin) a partir de las aristas entre celdas que cumplen la condición.
export function edgesPath(diff: (a: number, b: number) => boolean): Path2D {
  const segs: [number, number, number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (x + 1 < W && diff(i, i + 1)) segs.push([x + 1, y, x + 1, y + 1]); if (y + 1 < H && diff(i, i + W)) segs.push([x, y + 1, x + 1, y + 1]); }
  const key = (x: number, y: number) => y * (W + 1) + x; const adj = new Map<number, number[]>();
  segs.forEach((s, i) => { for (const k of [key(s[0], s[1]), key(s[2], s[3])]) { const l = adj.get(k) || []; l.push(i); adj.set(k, l); } });
  const used = new Uint8Array(segs.length); const path = new Path2D();
  const walk = (start: number) => {
    const pts: [number, number][] = []; let s = segs[start]; used[start] = 1; pts.push([s[0], s[1]], [s[2], s[3]]);
    for (const dir of [1, 0]) { for (; ;) { const end = dir ? pts[pts.length - 1] : pts[0]; const l = adj.get(key(end[0], end[1]))!; if (l.length !== 2) break; const nx = l.find(i => !used[i]); if (nx === undefined) break; used[nx] = 1; const q = segs[nx]; const np: [number, number] = (q[0] === end[0] && q[1] === end[1]) ? [q[2], q[3]] : [q[0], q[1]]; if (dir) pts.push(np); else pts.unshift(np); } }
    let P = pts; for (let it = 0; it < 2; it++) { const Q: [number, number][] = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const [ax, ay] = P[i], [bx, by] = P[i + 1]; Q.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]); } Q.push(P[P.length - 1]); P = Q; }
    path.moveTo(P[0][0] * S, P[0][1] * S); for (let i = 1; i < P.length; i++) path.lineTo(P[i][0] * S, P[i][1] * S);
  };
  for (let i = 0; i < segs.length; i++) if (!used[i]) walk(i);
  return path;
}
function spaced(c: CanvasRenderingContext2D, t: string, x: number, y: number, sp: number, stroke = false) { const ws = [...t].map(ch => c.measureText(ch).width); const tot = ws.reduce((a, b) => a + b, 0) + sp * (t.length - 1); let cx = x - tot / 2; const al = c.textAlign; c.textAlign = 'left'; [...t].forEach((ch, i) => { if (stroke) c.strokeText(ch, cx, y); else c.fillText(ch, cx, y); cx += ws[i] + sp; }); c.textAlign = al; }
function arrowHead(c: CanvasRenderingContext2D, x: number, y: number, from: number[], col: string) { const a = Math.atan2(y - from[1], x - from[0]); c.fillStyle = col; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 10 * Math.cos(a - 0.4), y - 10 * Math.sin(a - 0.4)); c.lineTo(x - 10 * Math.cos(a + 0.4), y - 10 * Math.sin(a + 0.4)); c.closePath(); c.fill(); }
function banner(c: CanvasRenderingContext2D, x: number, y: number, col: string, col2: string, label: string, sel: boolean, siege: boolean, enemy: boolean) {
  c.save(); c.translate(x, y);
  if (sel) { c.fillStyle = 'rgba(255,240,170,.55)'; c.beginPath(); c.arc(0, 0, 19, 0, 7); c.fill(); }
  c.strokeStyle = '#2a1a0c'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-9, -16); c.lineTo(-9, 14); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(-9, -16); c.lineTo(10, -16); c.lineTo(10, 2); c.lineTo(0.5, -2); c.lineTo(-9, 2); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = col2; c.beginPath(); c.moveTo(-5, -12); c.lineTo(6, -12); c.lineTo(6, -6); c.lineTo(0.5, -3.5); c.lineTo(-5, -6); c.closePath(); c.fill();
  if (enemy) { c.strokeStyle = '#b01e10'; c.lineWidth = 2; c.strokeRect(-12, -19, 25, 24); }
  c.font = 'bold 10px Georgia'; c.textAlign = 'center'; const tw = c.measureText(label).width + 8; c.fillStyle = 'rgba(245,235,210,.95)'; c.strokeStyle = '#2a1a0c'; c.lineWidth = 1; c.fillRect(-tw / 2, 5, tw, 12); c.strokeRect(-tw / 2, 5, tw, 12); c.fillStyle = '#2a1a0c'; c.fillText(label, 0, 14.5);
  if (siege) { c.font = '12px Georgia'; c.fillText('⚔', 14, -6); }
  c.restore();
}
function house(c: CanvasRenderingContext2D, x: number, y: number, s: number, roof: string, wall = '#e8dcc0') { c.fillStyle = wall; c.fillRect(x - 3 * s, y - 3 * s, 6 * s, 4 * s); c.fillStyle = roof; c.beginPath(); c.moveTo(x - 3.8 * s, y - 3 * s); c.lineTo(x, y - 6.5 * s); c.lineTo(x + 3.8 * s, y - 3 * s); c.closePath(); c.fill(); c.strokeStyle = '#3a2816'; c.lineWidth = 0.7; c.strokeRect(x - 3 * s, y - 3 * s, 6 * s, 4 * s); c.beginPath(); c.moveTo(x - 3.8 * s, y - 3 * s); c.lineTo(x, y - 6.5 * s); c.lineTo(x + 3.8 * s, y - 3 * s); c.stroke(); }
function glyphCity(c: CanvasRenderingContext2D, x: number, y: number, s: number, tier: number, cap: boolean, col: string, walls: number, climate: string, sp: any) {
  const roof = climate === 'arido' || climate === 'calido' ? '#c98a4a' : climate === 'frio' ? '#5a5560' : sp.elfo > 0.25 ? '#4f7f6a' : sp.enano > 0.25 ? '#6e6a62' : '#9a4a32';
  const wall = climate === 'arido' ? '#ecd9a8' : '#e8dcc0';
  if (walls) { c.fillStyle = 'rgba(150,140,120,.9)'; c.strokeStyle = '#3a2816'; c.lineWidth = walls >= 2 ? 2.2 : 1.4; c.beginPath(); c.ellipse(x, y - 1 * s, (11 + tier * 2) * s, (7 + tier) * s, 0, 0, 7); c.stroke(); c.strokeStyle = '#9b927f'; c.lineWidth = (walls >= 2 ? 3.2 : 2) * s; c.beginPath(); c.ellipse(x, y - 1 * s, (11 + tier * 2) * s, (7 + tier) * s, 0, 0, 7); c.stroke(); c.strokeStyle = '#3a2816'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(x, y - 1 * s, (11 + tier * 2) * s, (7 + tier) * s, 0, 0, 7); c.stroke(); if (walls >= 2) for (let i = 0; i < 4 + walls * 2; i++) { const a = i / (4 + walls * 2) * Math.PI * 2; const tx = x + Math.cos(a) * (11 + tier * 2) * s, ty = y - s + Math.sin(a) * (7 + tier) * s; c.fillStyle = '#b8af9b'; c.fillRect(tx - 1.8 * s, ty - 3.5 * s, 3.6 * s, 4 * s); c.strokeRect(tx - 1.8 * s, ty - 3.5 * s, 3.6 * s, 4 * s); } }
  const n = tier === 1 ? 2 : tier === 2 ? 4 : 6; const pos = [[-4, 1], [4, 2], [0, -2], [-7, -3], [7, -2], [-1, 4]];
  for (let i = 0; i < n; i++) house(c, x + pos[i][0] * s, y + pos[i][1] * s, s * (i === 2 ? 1.1 : 0.9), roof, wall);
  if (tier >= 2 || cap) { c.fillStyle = '#d8ccb0'; c.fillRect(x - 1.5 * s, y - 11 * s, 3 * s, 8 * s); c.strokeStyle = '#3a2816'; c.strokeRect(x - 1.5 * s, y - 11 * s, 3 * s, 8 * s); c.fillStyle = roof; c.beginPath(); c.moveTo(x - 2.4 * s, y - 11 * s); c.lineTo(x, y - 15 * s); c.lineTo(x + 2.4 * s, y - 11 * s); c.fill(); }
  if (cap) { c.strokeStyle = '#2a1a0c'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y - 15 * s); c.lineTo(x, y - 21 * s); c.stroke(); c.fillStyle = col; c.beginPath(); c.moveTo(x, y - 21 * s); c.lineTo(x + 7 * s, y - 19.5 * s); c.lineTo(x, y - 18 * s); c.fill(); }
}
function glyphCastle(c: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) {
  c.strokeStyle = '#2e2014'; c.lineWidth = 0.8; const st = '#bdb3a0', dk = '#8f8572';
  c.fillStyle = st; c.fillRect(x - 7 * s, y - 4 * s, 14 * s, 7 * s); c.strokeRect(x - 7 * s, y - 4 * s, 14 * s, 7 * s);
  for (const tx of [-7, 7]) { c.fillStyle = dk; c.fillRect(x + tx * s - 2.5 * s, y - 9 * s, 5 * s, 12 * s); c.strokeRect(x + tx * s - 2.5 * s, y - 9 * s, 5 * s, 12 * s); for (let k = 0; k < 3; k++) { c.fillStyle = dk; c.fillRect(x + tx * s - 2.5 * s + k * 1.8 * s, y - 10.5 * s, 1.2 * s, 1.5 * s); } }
  c.fillStyle = st; c.fillRect(x - 3 * s, y - 13 * s, 6 * s, 11 * s); c.strokeRect(x - 3 * s, y - 13 * s, 6 * s, 11 * s); for (let k = 0; k < 3; k++) c.fillRect(x - 3 * s + k * 2.2 * s, y - 14.5 * s, 1.4 * s, 1.5 * s);
  c.fillStyle = '#3a2816'; c.beginPath(); c.arc(x, y + 3 * s, 1.8 * s, Math.PI, 0); c.fill();
  c.beginPath(); c.moveTo(x, y - 14.5 * s); c.lineTo(x, y - 20 * s); c.stroke(); c.fillStyle = col; c.beginPath(); c.moveTo(x, y - 20 * s); c.lineTo(x + 6 * s, y - 18.5 * s); c.lineTo(x, y - 17 * s); c.fill();
}
function glyphPort(c: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, s: number, lvl: number, col: string) {
  const dx = bx - ax, dy = by - ay; const L = Math.hypot(dx, dy) || 1; const ux = dx / L, uy = dy / L;
  c.strokeStyle = '#5a3d22'; c.lineWidth = 2.4 * s; for (let k = -1; k <= (lvl > 1 ? 1 : 0); k++) { c.beginPath(); c.moveTo(ax + k * uy * 5 * s, ay - k * ux * 5 * s); c.lineTo(ax + ux * 12 * s + k * uy * 5 * s, ay + uy * 12 * s - k * ux * 5 * s); c.stroke(); }
  const sx = ax + ux * 17 * s, sy = ay + uy * 17 * s; c.fillStyle = '#6b4a2a'; c.beginPath(); c.moveTo(sx - 6 * s, sy); c.lineTo(sx + 6 * s, sy); c.lineTo(sx + 4 * s, sy + 3 * s); c.lineTo(sx - 4 * s, sy + 3 * s); c.closePath(); c.fill(); c.strokeStyle = '#2a1a0c'; c.lineWidth = 0.8; c.stroke(); c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, sy - 9 * s); c.stroke(); c.fillStyle = '#f2ead6'; c.beginPath(); c.moveTo(sx + 0.5, sy - 8.5 * s); c.lineTo(sx + 5 * s, sy - 2 * s); c.lineTo(sx + 0.5, sy - 2 * s); c.fill(); c.stroke(); c.fillStyle = col; c.fillRect(sx - 0.5, sy - 11 * s, 3 * s, 2 * s);
}
function glyphMine(c: CanvasRenderingContext2D, x: number, y: number, s: number) { c.fillStyle = '#7a6a55'; c.beginPath(); c.moveTo(x - 7 * s, y + 3 * s); c.lineTo(x, y - 6 * s); c.lineTo(x + 7 * s, y + 3 * s); c.closePath(); c.fill(); c.strokeStyle = '#2e2014'; c.lineWidth = 0.8; c.stroke(); c.fillStyle = '#1e140c'; c.beginPath(); c.arc(x, y + 3 * s, 3 * s, Math.PI, 0); c.fill(); c.strokeStyle = '#8a6a3a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 3.4 * s, y + 3 * s); c.lineTo(x - 3.4 * s, y - 0.5 * s); c.lineTo(x + 3.4 * s, y - 0.5 * s); c.lineTo(x + 3.4 * s, y + 3 * s); c.stroke(); c.fillStyle = '#5a5050'; c.fillRect(x + 4 * s, y + 2 * s, 4 * s, 2 * s); }
function glyphQuarry(c: CanvasRenderingContext2D, x: number, y: number, s: number) { c.fillStyle = '#b0a898'; c.strokeStyle = '#3a2c1c'; c.lineWidth = 0.7; for (let i = 0; i < 3; i++) { c.fillRect(x - (6 - i * 2) * s, y - i * 2.2 * s, (12 - i * 4) * s, 2.2 * s); c.strokeRect(x - (6 - i * 2) * s, y - i * 2.2 * s, (12 - i * 4) * s, 2.2 * s); } }
function glyphSawmill(c: CanvasRenderingContext2D, x: number, y: number, s: number) { house(c, x, y, s * 0.9, '#6b4a2a', '#c9a878'); c.fillStyle = '#8a5a30'; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(x + 6 * s, y + (i - 1) * 1.6 * s, 3 * s, 0.8 * s, 0, 0, 7); c.fill(); } }
function glyphMill(c: CanvasRenderingContext2D, x: number, y: number, s: number) { c.fillStyle = '#e5d8b8'; c.strokeStyle = '#3a2816'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - 2.5 * s, y + 3 * s); c.lineTo(x - 1.5 * s, y - 5 * s); c.lineTo(x + 1.5 * s, y - 5 * s); c.lineTo(x + 2.5 * s, y + 3 * s); c.closePath(); c.fill(); c.stroke(); c.save(); c.translate(x, y - 5 * s); for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.fillStyle = '#d8c8a0'; c.fillRect(0, -0.8 * s, 6 * s, 1.6 * s); c.strokeRect(0, -0.8 * s, 6 * s, 1.6 * s); } c.restore(); }
function glyphTower(c: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) { c.fillStyle = '#b9ae98'; c.strokeStyle = '#2e2014'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - 2.5 * s, y + 3 * s); c.lineTo(x - 2 * s, y - 8 * s); c.lineTo(x + 2 * s, y - 8 * s); c.lineTo(x + 2.5 * s, y + 3 * s); c.closePath(); c.fill(); c.stroke(); c.fillRect(x - 3 * s, y - 10 * s, 6 * s, 2.5 * s); c.strokeRect(x - 3 * s, y - 10 * s, 6 * s, 2.5 * s); c.fillStyle = col; c.fillRect(x - 0.5, y - 14 * s, 4 * s, 2.4 * s); }
function glyphTents(c: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) { for (let i = 0; i < 3; i++) { const tx = x + (i - 1) * 5 * s; c.fillStyle = i === 1 ? col : '#e2d5b5'; c.strokeStyle = '#3a2816'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(tx - 2.6 * s, y + 2 * s); c.lineTo(tx, y - 3 * s); c.lineTo(tx + 2.6 * s, y + 2 * s); c.closePath(); c.fill(); c.stroke(); } }
function glyphCrates(c: CanvasRenderingContext2D, x: number, y: number, s: number) { c.fillStyle = '#a5763f'; c.strokeStyle = '#3a2816'; c.lineWidth = 0.7; for (const [dx, dy] of [[-2, 0], [2, 0], [0, -3]]) { c.fillRect(x + (dx - 1.8) * s, y + (dy - 1.8) * s, 3.6 * s, 3.6 * s); c.strokeRect(x + (dx - 1.8) * s, y + (dy - 1.8) * s, 3.6 * s, 3.6 * s); } }
function glyphLibrary(c: CanvasRenderingContext2D, x: number, y: number, s: number) { c.fillStyle = '#e9dfc6'; c.strokeStyle = '#3a2816'; c.lineWidth = 0.7; c.fillRect(x - 3 * s, y - 2 * s, 6 * s, 4 * s); c.strokeRect(x - 3 * s, y - 2 * s, 6 * s, 4 * s); c.beginPath(); c.moveTo(x - 3.6 * s, y - 2 * s); c.lineTo(x, y - 4.5 * s); c.lineTo(x + 3.6 * s, y - 2 * s); c.closePath(); c.fillStyle = '#8a7a5a'; c.fill(); c.stroke(); for (let i = -2; i <= 2; i += 2) { c.beginPath(); c.moveTo(x + i * s, y - 1.6 * s); c.lineTo(x + i * s, y + 2 * s); c.stroke(); } }
function glyphDome(c: CanvasRenderingContext2D, x: number, y: number, s: number) { c.fillStyle = '#e9dfc6'; c.strokeStyle = '#3a2816'; c.lineWidth = 0.7; c.fillRect(x - 3.5 * s, y - 2 * s, 7 * s, 4 * s); c.strokeRect(x - 3.5 * s, y - 2 * s, 7 * s, 4 * s); c.fillStyle = '#6f8fa0'; c.beginPath(); c.arc(x, y - 2 * s, 3 * s, Math.PI, 0); c.fill(); c.stroke(); }
function glyphHospital(c: CanvasRenderingContext2D, x: number, y: number, s: number) { house(c, x, y + 2 * s, s * 0.8, '#7a8a70'); c.fillStyle = '#a02818'; c.fillRect(x - 0.6 * s, y - 2.5 * s, 1.2 * s, 3 * s); c.fillRect(x - 1.5 * s, y - 1.6 * s, 3 * s, 1.2 * s); }
function glyphMarket(c: CanvasRenderingContext2D, x: number, y: number, s: number) { for (let i = 0; i < 2; i++) { c.fillStyle = i ? '#b5452a' : '#d8b35a'; c.beginPath(); c.moveTo(x + (i * 4 - 4) * s, y); c.lineTo(x + (i * 4 - 2) * s, y - 2.5 * s); c.lineTo(x + i * 4 * s, y); c.fill(); c.strokeStyle = '#3a2816'; c.lineWidth = 0.6; c.stroke(); } }
function glyphScaffold(c: CanvasRenderingContext2D, x: number, y: number, s: number, prog: number) { c.strokeStyle = '#7a5530'; c.lineWidth = 1; c.strokeRect(x - 4 * s, y - 7 * s, 8 * s, 8 * s); c.beginPath(); c.moveTo(x - 4 * s, y + s); c.lineTo(x + 4 * s, y - 7 * s); c.moveTo(x - 4 * s, y - 3 * s); c.lineTo(x + 4 * s, y - 3 * s); c.stroke(); c.strokeStyle = '#2f7a3a'; c.lineWidth = 2; c.beginPath(); c.arc(x, y - 3 * s, 7 * s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.05, prog)); c.stroke(); }
function glyphExpedition(c: CanvasRenderingContext2D, x: number, y: number, ship: boolean, sel: boolean, col: string) {
  c.save(); c.translate(x, y); if (sel) { c.fillStyle = 'rgba(255,240,170,.6)'; c.beginPath(); c.arc(0, 0, 15, 0, 7); c.fill(); }
  c.strokeStyle = '#2a1a0c'; c.lineWidth = 1;
  if (ship) { c.fillStyle = '#6b4a2a'; c.beginPath(); c.moveTo(-9, 2); c.lineTo(9, 2); c.lineTo(6, 7); c.lineTo(-6, 7); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -12); c.stroke(); c.fillStyle = '#f3ead2'; c.beginPath(); c.moveTo(1, -11); c.quadraticCurveTo(9, -5, 1, 1); c.closePath(); c.fill(); c.stroke(); c.fillStyle = col; c.fillRect(-1, -15, 6, 3); }
  else { c.fillStyle = '#efe2c0'; c.beginPath(); c.arc(0, 0, 9, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#8c2f24'; c.beginPath(); c.moveTo(0, -7); c.lineTo(2.5, 0); c.lineTo(0, 7); c.lineTo(-2.5, 0); c.closePath(); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(0, 0, 1.8, 0, 7); c.fill(); }
  c.restore();
}
