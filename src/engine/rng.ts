// Generador aleatorio determinista (mulberry32). Su estado se guarda en la partida.
export class RNG {
  s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  int(a: number, b: number) { return Math.floor(this.range(a, b + 1)); }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p: number) { return this.next() < p; }
  shuffle<T>(arr: T[]): T[] { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  weighted<T>(items: T[], w: (t: T) => number): T { let tot = 0; for (const i of items) tot += Math.max(0, w(i)); let r = this.next() * tot; for (const i of items) { r -= Math.max(0, w(i)); if (r <= 0) return i; } return items[items.length - 1]; }
}
export function hashStr(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function hashNums(...n: number[]): number { let h = 2166136261; for (const x of n) { h ^= x | 0; h = Math.imul(h, 16777619); h ^= h >>> 13; } return h >>> 0; }

// Ruido de gradiente 2D con semilla
export class Noise2D {
  perm: Uint8Array; gx: Float32Array; gy: Float32Array;
  constructor(seed: number) {
    const r = new RNG(seed); this.perm = new Uint8Array(512); const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    this.gx = new Float32Array(256); this.gy = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const a = r.next() * Math.PI * 2; this.gx[i] = Math.cos(a); this.gy[i] = Math.sin(a); }
  }
  n(x: number, y: number): number {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const P = this.perm;
    const g = (ix: number, iy: number, dx: number, dy: number) => { const h = P[(P[ix & 255] + iy) & 511]; return this.gx[h] * dx + this.gy[h] * dy; };
    const a = g(xi, yi, xf, yf), b = g(xi + 1, yi, xf - 1, yf), c = g(xi, yi + 1, xf, yf - 1), d = g(xi + 1, yi + 1, xf - 1, yf - 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.4;
  }
  fbm(x: number, y: number, oct = 5, lac = 2, gain = 0.5): number { let s = 0, amp = 1, f = 1, norm = 0; for (let i = 0; i < oct; i++) { s += amp * this.n(x * f, y * f); norm += amp; amp *= gain; f *= lac; } return s / norm; }
}
