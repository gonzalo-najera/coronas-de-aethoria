import { generateWorld } from '../src/engine/world';
const t = Date.now(); const w = generateWorld(1347);
console.log('ms', Date.now() - t, 'provs', w.provinces.length, 'seas', w.seas.length, 'rivers', w.rivers.length, w.hash);
const byC: any = {}; for (const p of w.provinces) byC[p.continent] = (byC[p.continent] || 0) + 1; console.log(byC);
console.log('deep seas', w.seas.filter(s => s.deep).length);
const sizes = w.provinces.map(p => p.area).sort((a,b)=>a-b); console.log('area min/med/max', sizes[0], sizes[sizes.length>>1], sizes[sizes.length-1]);
const bc: any = {}; for (const p of w.provinces) bc[p.biome] = (bc[p.biome]||0)+1; console.log(bc);
console.log(w.provinces.slice(0,8).map(p=>p.name+' | '+p.strategic.join(',')));
const w2 = generateWorld(1347); console.log('determinista', w2.hash === w.hash);
