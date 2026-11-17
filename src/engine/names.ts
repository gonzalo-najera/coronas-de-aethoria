import { RNG } from './rng';
import type { SpeciesId, Biome } from './types';

const PRE = ['Val', 'Mor', 'Ast', 'Bre', 'Cal', 'Dor', 'Esp', 'Fal', 'Gar', 'Hel', 'Ilm', 'Lor', 'Mar', 'Nev', 'Orn', 'Pel', 'Quel', 'Ros', 'Sal', 'Tor', 'Ulm', 'Ver', 'Zar', 'Alc', 'Bel', 'Cor', 'Dal', 'Erm', 'Fen', 'Gol', 'Lum', 'Mir', 'Nar', 'Os', 'Par', 'Rib', 'Sel', 'Tal', 'Vel', 'Yer', 'Car', 'Bar', 'Tam', 'Lis', 'Ald', 'Ber', 'Can', 'Del'];
const MID = ['a', 'e', 'i', 'o', 'u', 'ar', 'en', 'il', 'or', 'an', 'el', 'ad', 'er', 'on', 'ia', 'ue'];
const SUF = ['ena', 'oria', 'ama', 'edo', 'era', 'iel', 'ona', 'urna', 'ancia', 'ejo', 'illa', 'ón', 'ar', 'és', 'ira', 'uela', 'osa', 'ante', 'ida', 'oz', 'al', 'ín', 'ea', 'ura'];
const COMPOUND_A = ['Peña', 'Fuente', 'Torre', 'Monte', 'Vado', 'Roca', 'Prado', 'Valle', 'Puerto', 'Campo', 'Agua', 'Piedra', 'Sierra', 'Cerro', 'Hoya', 'Bosque', 'Arco', 'Brezo', 'Lago', 'Alba'];
const COMPOUND_B = ['alta', 'clara', 'fría', 'negra', 'verde', 'honda', 'dorada', 'parda', 'blanca', 'brava', 'mansa', 'vieja', 'lejana', 'oscura', 'serena', 'roja'];
const BIOME_PREFIX: Partial<Record<Biome, string[]>> = {
  bosque: ['Bosque de', 'Fronda de', 'Selva Vieja de', 'Arboleda de'], taiga: ['Pinar de', 'Bosque Gris de'], selva: ['Espesura de', 'Junglas de'],
  desierto: ['Arenales de', 'Erial de', 'Dunas de'], tundra: ['Páramo de', 'Yermo de'], montana: ['Sierra de', 'Picos de', 'Montes de'],
  colinas: ['Altos de', 'Lomas de', 'Cerros de'], estepa: ['Estepa de', 'Llanos de'], pantano: ['Marismas de', 'Ciénagas de'],
  pradera: ['Vega de', 'Campiña de'], llanura: ['Campos de', 'Tierra de', 'Llanura de'], nieve: ['Cumbres de'],
};

export function baseName(r: RNG): string {
  if (r.chance(0.22)) return r.pick(COMPOUND_A) + r.pick(COMPOUND_B);
  let s = r.pick(PRE);
  if (r.chance(0.35)) s += r.pick(MID);
  s += r.pick(SUF);
  return s.replace(/([aeiouáéíóú])\1/g, '$1');
}
export function provinceName(r: RNG, biome: Biome, used: Set<string>): string {
  for (let i = 0; i < 40; i++) {
    const b = baseName(r);
    let n = b;
    const pf = BIOME_PREFIX[biome];
    if (pf && r.chance(0.45)) n = r.pick(pf) + ' ' + b;
    else if (r.chance(0.12)) n = 'Marca de ' + b;
    if (!used.has(n)) { used.add(n); return n; }
  }
  const n = baseName(r) + ' ' + used.size; used.add(n); return n;
}
export function seaName(r: RNG, deep: boolean, used: Set<string>): string {
  const kinds = deep ? ['Océano', 'Piélago', 'Abismo', 'Mar Exterior de'] : ['Mar de', 'Golfo de', 'Bahía de', 'Estrecho de', 'Aguas de', 'Mar'];
  const adj = ['de las Brumas', 'de los Albatros', 'Cerúleo', 'de las Ballenas', 'de Plata', 'Tempestuoso', 'del Ocaso', 'del Alba', 'Sereno', 'de los Faros', 'de Ámbar', 'Sombrío', 'de Coral', 'de los Náufragos', 'Glauco', 'de las Sirenas Mudas'];
  for (let i = 0; i < 40; i++) {
    const k = r.pick(kinds);
    let n: string;
    if (k.endsWith('de')) n = k + ' ' + baseName(r);
    else if (k === 'Mar' || deep) n = k + ' ' + r.pick(adj);
    else n = k + ' ' + baseName(r);
    if (!used.has(n)) { used.add(n); return n; }
  }
  const n = 'Mar ' + used.size; used.add(n); return n;
}
const FIRST: Record<SpeciesId, string[][]> = {
  humano: [['Al', 'Ber', 'Cas', 'Dar', 'El', 'Gon', 'Is', 'Lu', 'Mar', 'Rod', 'Tom', 'Ul', 'Ber', 'Fer', 'Ines', 'Jim'], ['ric', 'ando', 'bel', 'ela', 'ena', 'ardo', 'mira', 'ino', 'ida', 'ón', 'iana', 'esto']],
  fauno: [['Til', 'Mel', 'Bri', 'Fen', 'Lio', 'Ser', 'Pim', 'Ror', 'Ama', 'Cor'], ['ión', 'aro', 'issa', 'efo', 'ín', 'ilda', 'unco', 'olo', 'ea']],
  minotauro: [['Brak', 'Thur', 'Gor', 'Mor', 'Kar', 'Dra', 'Ost', 'Bal', 'Rum'], ['gan', 'mok', 'ath', 'uro', 'dak', 'ena', 'ruk', 'osa']],
  centauro: [['Cal', 'Ere', 'Fal', 'Ori', 'Sar', 'Tai', 'Vel', 'Nim', 'Dax'], ['ion', 'ane', 'odas', 'ara', 'emo', 'ithe', 'oras', 'ea']],
  gigante: [['Hro', 'Gund', 'Ymb', 'Sol', 'Ost', 'Bjar', 'Trom', 'Ulg'], ['mar', 'old', 'rik', 'ga', 'vard', 'heim', 'ra']],
  enano: [['Dor', 'Bal', 'Grim', 'Thor', 'Har', 'Bru', 'Kil', 'Dur', 'Mag'], ['in', 'rek', 'li', 'gund', 'da', 'win', 'ra', 'nar']],
  elfo: [['Ae', 'Ith', 'Syl', 'Lae', 'Ny', 'Ere', 'Ilu', 'Vae', 'Thal'], ['lith', 'rion', 'wen', 'nor', 'raeth', 'liel', 'dris', 'ven']],
};
const SURN: Record<SpeciesId, string[]> = {
  humano: ['de Valhondo', 'Altoroble', 'Piedrafría', 'de Lumbral', 'Sotoverde', 'Riosereno', 'Marcafuerte', 'del Vado'],
  fauno: ['Bosquealto', 'Hojamansa', 'Musgoclaro', 'Raízfirme', 'Cañaverde'],
  minotauro: ['Cuernofuerte', 'Pezuñabronce', 'Rompemuros', 'Testaferrea'],
  centauro: ['Crinveloz', 'Cascoalto', 'Vientollano', 'Galoplargo'],
  gigante: ['Montealto', 'Hombrorroca', 'Pasolento', 'Nievealta'],
  enano: ['Yunquehondo', 'Barbagrís', 'Martillorrojo', 'Vetaplata'],
  elfo: ['Lunavera', 'Hojaplata', 'Estrellalba', 'Brisaclara'],
};
export function personName(r: RNG, sp: SpeciesId): string {
  const f = FIRST[sp]; return r.pick(f[0]) + r.pick(f[1]) + ' ' + r.pick(SURN[sp]);
}
export function cityName(r: RNG, used: Set<string>): string {
  for (let i = 0; i < 40; i++) {
    let n = baseName(r);
    if (r.chance(0.15)) n = r.pick(['San ', 'Villa', 'Puebla de ', 'Castro ', 'Torre', 'Fuerte ']) + n;
    if (!used.has(n)) { used.add(n); return n.replace('Villa', 'Villa').trim(); }
  }
  const n = baseName(r) + used.size; used.add(n); return n;
}
