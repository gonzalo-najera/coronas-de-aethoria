import { generateWorld, W, H, BIOME_LIST } from '../src/engine/world';
import { BIOMES } from '../src/engine/data';
import { writeFileSync } from 'fs';
const w = generateWorld(1347);
console.log('provs', w.provinces.length, 'seas', w.seas.length, 'rivers', w.rivers.length);
const S = 3; const buf = Buffer.alloc(W * S * H * S * 3);
for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) {
  const i = ((y / S) | 0) * W + ((x / S) | 0); let c = BIOMES[BIOME_LIST[w.biome[i]]].color;
  let r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
  if (w.river[i]) { r = 40; g = 90; b = 200; }
  const cx = (x / S) | 0, cy = (y / S) | 0;
  const p = w.prov[i]; if (p >= 0 && ((cx + 1 < W && w.prov[i + 1] !== p && w.prov[i + 1] >= 0) || (cy + 1 < H && w.prov[i + W] !== p && w.prov[i + W] >= 0))) { r *= 0.6; g *= 0.6; b *= 0.6; }
  const s = w.sea[i]; if (s >= 0 && ((cx + 1 < W && w.sea[i + 1] !== s && w.sea[i + 1] >= 0) || (cy + 1 < H && w.sea[i + W] !== s && w.sea[i + W] >= 0))) { r *= 0.8; g *= 0.8; b *= 0.8; }
  const o = (y * W * S + x) * 3; buf[o] = r; buf[o + 1] = g; buf[o + 2] = b;
}
writeFileSync('/tmp/claude-0/-home-user/2b4a8ca5-0b8d-5e86-b10a-6b3e4690915e/scratchpad/map.ppm', Buffer.concat([Buffer.from(`P6 ${W * S} ${H * S} 255\n`), buf]));
