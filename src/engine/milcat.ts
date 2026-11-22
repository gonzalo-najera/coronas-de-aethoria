// Catálogo militar modular: edades, armamento, protecciones y tipos de unidad.
// Las estadísticas finales de cada unidad se DERIVAN de su base (especie e instrucción) + arma + protección + nivel de equipo,
// de modo que añadir contenido consiste en añadir entradas a estas tablas, sin tocar el motor de batalla.
import type { SpeciesId } from './types';

// ---------------------------------------------------------------- Edades
export interface EraDef { id: number; roman: string; name: string; desc: string; active: boolean; pending?: string; }
export const ERAS: EraDef[] = [
  { id: 1, roman: 'I', name: 'Alta Edad Media', desc: 'Combate cuerpo a cuerpo, formaciones sencillas y fortificaciones básicas.', active: true },
  { id: 2, roman: 'II', name: 'Plena Edad Media', desc: 'Armaduras, disciplina, caballería acorazada, ballestas y asedios.', active: true },
  { id: 3, roman: 'III', name: 'Baja Edad Media', desc: 'La pólvora inicia una transformación militar.', active: false, pending: 'Fase 3 de la ampliación militar' },
  { id: 4, roman: 'IV', name: 'Renacimiento', desc: 'Formaciones mixtas de picas y armas de fuego.', active: false, pending: 'Fase 3 de la ampliación militar' },
  { id: 5, roman: 'V', name: 'Edad Moderna', desc: 'Bayoneta, infantería de línea y artillería móvil.', active: false, pending: 'Fase 5 de la ampliación militar' },
  { id: 6, roman: 'VI', name: 'Ilustración', desc: 'Disciplina, maniobra, potencia de fuego y ejércitos profesionales.', active: false, pending: 'Fase 5 de la ampliación militar' },
  { id: 7, roman: 'VII', name: 'Primera Revolución Industrial', desc: 'Retrocarga, ánima rayada, ferrocarril y telégrafo.', active: false, pending: 'Fase 5 de la ampliación militar' },
  { id: 8, roman: 'VIII', name: 'Segunda Revolución Industrial', desc: 'Trincheras, ametralladoras y primeras aeronaves.', active: false, pending: 'Fase 5 de la ampliación militar' },
  { id: 9, roman: 'IX', name: 'Mecanización y Aviación', desc: 'Carros de combate, aviación y armas combinadas.', active: false, pending: 'Fase 5 de la ampliación militar' },
  { id: 10, roman: 'X', name: 'Era Atómica y Espacial', desc: 'Disuasión estratégica, helicópteros y guerra electrónica.', active: false, pending: 'Fase 5 de la ampliación militar' },
  { id: 11, roman: 'XI', name: 'Era Digital', desc: 'Información, drones, ciberdefensa y precisión.', active: false, pending: 'Fase 5 de la ampliación militar' },
  { id: 12, roman: 'XII', name: 'Era Futura', desc: 'Sistemas autónomos y exoesqueletos, sin unidades invencibles.', active: false, pending: 'Fase 5 de la ampliación militar' },
];

// ---------------------------------------------------------------- Niveles de equipo
// stat: multiplicador sobre la parte de arma y protección; cost: multiplicador del coste en armas.
export const TIERS = [
  { id: 0, name: 'Obsoleto', stat: 0.82, cost: 0.4, req: 'Siempre disponible: material viejo o de desecho.' },
  { id: 1, name: 'Básico', stat: 0.92, cost: 0.7, req: 'Siempre disponible.' },
  { id: 2, name: 'Estándar', stat: 1, cost: 1, req: 'Herrería en la provincia de reclutamiento.' },
  { id: 3, name: 'Avanzado', stat: 1.1, cost: 1.4, req: 'Acero templado y armería en la provincia.' },
  { id: 4, name: 'De élite', stat: 1.2, cost: 2, req: 'Maestría armera y armería en la provincia.' },
];
export function tierName(t: number) { return TIERS[Math.max(0, Math.min(4, Math.round(t)))].name; }
export function tierStat(t: number) { const lo = Math.max(0, Math.min(4, Math.floor(t))), hi = Math.min(4, lo + 1), f = Math.max(0, Math.min(1, t - lo)); return TIERS[lo].stat * (1 - f) + TIERS[hi].stat * f; }

// ---------------------------------------------------------------- Armamento
export type WeaponKind = 'cac' | 'asta' | 'arco' | 'ballesta' | 'arrojadiza' | 'asedio' | 'natural';
export interface WeaponDef {
  id: string; name: string; era: number; kind: WeaponKind; tech?: string;
  melee?: number; def?: number; pen: number; antiCharge?: number; charge?: number;
  ranged?: number; range?: number; precision?: number; reload?: number; ammo?: number; ammoUse?: number;
  cost: number; desc: string;
}
export const WEAPONS: WeaponDef[] = [
  { id: 'aperos', name: 'Aperos y armas improvisadas', era: 1, kind: 'cac', melee: 2, pen: 1, cost: 0.5, desc: 'Hoces, horcas y garrotes.' },
  { id: 'cuchillo', name: 'Cuchillo y hacha de mano', era: 1, kind: 'cac', melee: 1, pen: 1, cost: 0.3, desc: 'Arma de respaldo de tiradores y servidores.' },
  { id: 'espada_corta', name: 'Espada corta', era: 1, kind: 'cac', melee: 3, pen: 2.5, cost: 1.2, desc: 'Ligera y manejable.' },
  { id: 'espada', name: 'Espada de hierro', era: 1, kind: 'cac', tech: 'forja', melee: 4, pen: 3.5, cost: 2.5, desc: 'Arma versátil de infantería bien equipada.' },
  { id: 'hacha', name: 'Hacha de guerra', era: 1, kind: 'cac', melee: 5, pen: 5, cost: 2, desc: 'Golpes que abren escudos y cotas.' },
  { id: 'martillo', name: 'Martillo de guerra', era: 1, kind: 'cac', melee: 3, pen: 6, cost: 2.2, desc: 'Aplasta las protecciones más gruesas.' },
  { id: 'lanza', name: 'Lanza', era: 1, kind: 'asta', melee: 3, pen: 3, antiCharge: 1.5, cost: 1.2, desc: 'Mantiene a raya a jinetes y bestias.' },
  { id: 'pica', name: 'Pica', era: 2, kind: 'asta', tech: 'picas', melee: 2, def: 2, pen: 3.5, antiCharge: 2.4, cost: 1.8, desc: 'Asta de cinco metros: muro contra cargas, torpe en el cuerpo a cuerpo.' },
  { id: 'lanza_caballeria', name: 'Lanza de caballería', era: 2, kind: 'asta', tech: 'estribo', melee: 5, pen: 5, charge: 0.4, cost: 2.5, desc: 'Con estribo, el impacto de la carga se transmite a la punta.' },
  { id: 'garrote', name: 'Garrote de gigante', era: 1, kind: 'natural', melee: 10, pen: 7, cost: 3, desc: 'Un tronco reforzado con hierro.' },
  { id: 'ariete', name: 'Ariete', era: 2, kind: 'asedio', tech: 'asedio', melee: 1, pen: 1, cost: 6, desc: 'Viga con cabeza de hierro bajo techumbre.' },
  { id: 'arco_caza', name: 'Arco de caza', era: 1, kind: 'arco', ranged: 3, range: 4, pen: 1.5, precision: 0.65, reload: 1, ammo: 40, ammoUse: 0.01, cost: 0.8, desc: 'Ligero; apto para hostigar y explorar.' },
  { id: 'arco_corto', name: 'Arco de guerra', era: 1, kind: 'arco', ranged: 6, range: 5, pen: 2.5, precision: 0.7, reload: 1, ammo: 60, ammoUse: 0.012, cost: 1.5, desc: 'Arco estándar de las levas.' },
  { id: 'arco_largo', name: 'Arco largo', era: 2, kind: 'arco', tech: 'arcolargo', ranged: 8, range: 7, pen: 4, precision: 0.75, reload: 1, ammo: 60, ammoUse: 0.014, cost: 2, desc: 'Gran alcance y penetración, pero exige años de práctica.' },
  { id: 'arco_compuesto', name: 'Arco compuesto', era: 2, kind: 'arco', tech: 'arco_compuesto', ranged: 6, range: 5, pen: 3.5, precision: 0.72, reload: 1, ammo: 50, ammoUse: 0.014, cost: 2.2, desc: 'Corto y potente: se puede tirar a galope.' },
  { id: 'ballesta', name: 'Ballesta', era: 2, kind: 'ballesta', tech: 'ballesta', ranged: 12, range: 5, pen: 8, precision: 0.8, reload: 3, ammo: 24, ammoUse: 0.03, cost: 2.2, desc: 'Atraviesa armaduras, pero la recarga es lenta.' },
  { id: 'jabalinas', name: 'Jabalinas', era: 1, kind: 'arrojadiza', ranged: 7, range: 2.5, pen: 3.5, precision: 0.6, reload: 2, ammo: 4, ammoUse: 0.02, cost: 0.8, desc: 'Pocas y a corta distancia, antes del choque.' },
  { id: 'catapulta', name: 'Catapulta', era: 2, kind: 'asedio', tech: 'asedio', ranged: 40, range: 11, pen: 6, precision: 0.3, reload: 6, ammo: 16, ammoUse: 0.2, cost: 12, desc: 'Proyectiles de piedra contra muros y formaciones densas.' },
  { id: 'trabuquete', name: 'Trabuquete de contrapeso', era: 2, kind: 'asedio', tech: 'trabuquete', ranged: 60, range: 13, pen: 8, precision: 0.25, reload: 8, ammo: 12, ammoUse: 0.35, cost: 18, desc: 'La máquina de asedio más poderosa de su tiempo.' },
];
export const WEAPON: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map(x => [x.id, x]));

// ---------------------------------------------------------------- Protecciones
export interface ArmorDef { id: string; name: string; era: number; tech?: string; def: number; prot: number; mprot: number; weight: number; cost: number; desc: string; }
export const ARMORS: ArmorDef[] = [
  { id: 'ninguna', name: 'Sin protección', era: 1, def: 0, prot: 0, mprot: 0, weight: 1, cost: 0, desc: 'Servidores de máquinas y civiles.' },
  { id: 'acolchada', name: 'Gambesón acolchado', era: 1, def: 1, prot: 1.5, mprot: 2, weight: 0.99, cost: 0.5, desc: 'Barato y sorprendentemente eficaz contra flechas.' },
  { id: 'cuero', name: 'Cuero endurecido', era: 1, def: 1, prot: 1, mprot: 1, weight: 1, cost: 0.5, desc: 'Protección ligera que no estorba.' },
  { id: 'pieles', name: 'Pieles y placas de hueso', era: 1, def: 3, prot: 2, mprot: 2, weight: 1, cost: 2, desc: 'Protección tosca a escala de gigante.' },
  { id: 'cota_malla', name: 'Cota de malla', era: 1, def: 2, prot: 4, mprot: 3, weight: 0.95, cost: 2.5, desc: 'Anillas de hierro: cara de producir.' },
  { id: 'loriga', name: 'Loriga y yelmo', era: 2, tech: 'loriga', def: 3, prot: 5, mprot: 4.5, weight: 0.92, cost: 3.5, desc: 'Malla completa con yelmo cerrado.' },
  { id: 'placas', name: 'Armadura de placas', era: 2, tech: 'armadura_placas', def: 3, prot: 7.5, mprot: 7, weight: 0.86, cost: 6, desc: 'Casi inmune a flechas ligeras; pesada y fatigosa.' },
  { id: 'cota_gigante', name: 'Cota de gigante', era: 2, tech: 'asedio', def: 5, prot: 4, mprot: 3, weight: 0.97, cost: 6, desc: 'Malla forjada a medida de un gigante.' },
  { id: 'mantelete', name: 'Techumbre de mantelete', era: 2, tech: 'asedio', def: 2, prot: 3, mprot: 7, weight: 1, cost: 2, desc: 'Cubierta de madera y pieles húmedas.' },
];
export const ARMOR: Record<string, ArmorDef> = Object.fromEntries(ARMORS.map(x => [x.id, x]));
export const SHIELD = { def: 2, mprot: 3, cost: 0.5 };

// ---------------------------------------------------------------- Atributos (los 28 independientes)
// key: campo de UnitDef. na(d): true si el atributo no se aplica a la unidad (se muestra desactivado).
export type Role = 'infanteria' | 'tiradores' | 'caballeria' | 'choque' | 'reconocimiento' | 'asedio' | 'ingenieros';
export const ROLE_NAMES: Record<Role, string> = { infanteria: 'Infantería', tiradores: 'Tiradores', caballeria: 'Caballería', choque: 'Tropas de choque', reconocimiento: 'Reconocimiento', asedio: 'Máquinas de asedio', ingenieros: 'Ingenieros' };

// ---------------------------------------------------------------- Tipos de unidad
export interface UnitBase {
  melee: number; def: number; rangedSkill?: number; morale: number; discipline: number; cohesion?: number; endurance: number;
  speed: number; strat: number; recon: number; conceal: number; charge?: number; siege?: number; size?: number; density: number;
}
export interface UnitSpec {
  id: string; name: string; era: number; role: Role; species: SpeciesId | null; techs?: string[]; barracks: boolean; cav?: boolean;
  melee: string; ranged?: string; armor: string; shield?: boolean; base: UnitBase;
  cost: number; upkeep: number; food: number; training: number; logistics: number;
  terrain?: Partial<Record<string, number>>; desc: string; symbol: string; upgrades?: string[]; obsoleteBy?: string[];
}
const CAV_T = { bosque: 0.65, montana: 0.5, pantano: 0.55, llanura: 1.12, estepa: 1.15, pradera: 1.1 };
const CEN_T = { bosque: 0.6, montana: 0.5, pantano: 0.55, llanura: 1.15, estepa: 1.2, pradera: 1.15 };
export const UNIT_SPECS: UnitSpec[] = [
  // ---- Edad I
  { id: 'milicia', name: 'Milicias campesinas', era: 1, role: 'infanteria', species: null, barracks: false, melee: 'aperos', armor: 'acolchada',
    base: { melee: 2, def: 3, morale: 40, discipline: 25, cohesion: 75, endurance: 45, speed: 1, strat: 1, recon: 5, conceal: 15, density: 120 },
    cost: 6, upkeep: 0.3, food: 0.12, training: 0, logistics: 1, desc: 'Levas mal equipadas. Baratas y frágiles, pero disponibles al instante.', symbol: 'inf', upgrades: ['lanceros', 'inf_ligera', 'hacheros'] },
  { id: 'inf_ligera', name: 'Infantería ligera', era: 1, role: 'infanteria', species: null, barracks: true, melee: 'espada_corta', ranged: 'jabalinas', armor: 'cuero', shield: true,
    base: { melee: 1, def: 2, morale: 50, discipline: 40, cohesion: 80, endurance: 65, speed: 1.35, strat: 1.1, recon: 25, conceal: 35, density: 90 },
    cost: 10, upkeep: 0.45, food: 0.13, training: 1, logistics: 1, terrain: { bosque: 1.15, colinas: 1.1 }, desc: 'Rápidos hostigadores con jabalinas. Buenos en terreno quebrado.', symbol: 'inf', upgrades: ['espadachines', 'lanceros'] },
  { id: 'hacheros', name: 'Guerreros con hacha', era: 1, role: 'infanteria', species: null, barracks: true, melee: 'hacha', armor: 'cuero',
    base: { melee: 2, def: 2, morale: 55, discipline: 35, cohesion: 75, endurance: 60, speed: 1.05, strat: 1, recon: 5, conceal: 15, density: 100 },
    cost: 12, upkeep: 0.55, food: 0.14, training: 1, logistics: 1, desc: 'Alta penetración: abren escudos y cotas, pero se protegen mal.', symbol: 'inf', upgrades: ['inf_pesada', 'espadachines'], obsoleteBy: ['inf_pesada'] },
  { id: 'espadachines', name: 'Espadachines', era: 1, role: 'infanteria', species: null, techs: ['forja'], barracks: true, melee: 'espada', armor: 'cota_malla', shield: true,
    base: { melee: 2, def: 3, morale: 58, discipline: 50, cohesion: 85, endurance: 55, speed: 1, strat: 1, recon: 5, conceal: 10, density: 100 },
    cost: 16, upkeep: 0.75, food: 0.14, training: 2, logistics: 1.1, desc: 'Infantería bien protegida que domina a la infantería ligera.', symbol: 'inf', upgrades: ['inf_pesada'], obsoleteBy: ['inf_pesada'] },
  { id: 'lanceros', name: 'Lanceros', era: 1, role: 'infanteria', species: null, barracks: true, melee: 'lanza', armor: 'cuero', shield: true,
    base: { melee: 3, def: 4, morale: 55, discipline: 45, cohesion: 85, endurance: 55, speed: 1, strat: 1, recon: 5, conceal: 10, density: 110 },
    cost: 12, upkeep: 0.6, food: 0.14, training: 1, logistics: 1, desc: 'Infantería de línea versátil; frena a la caballería ligera.', symbol: 'inf', upgrades: ['piqueros', 'inf_pesada', 'espadachines'], obsoleteBy: ['piqueros', 'inf_pesada'] },
  { id: 'arqueros', name: 'Arqueros', era: 1, role: 'tiradores', species: null, barracks: true, melee: 'cuchillo', ranged: 'arco_corto', armor: 'acolchada',
    base: { melee: 2, def: 2, morale: 45, discipline: 40, endurance: 50, speed: 1, strat: 1, recon: 15, conceal: 20, density: 100 },
    cost: 12, upkeep: 0.6, food: 0.13, training: 2, logistics: 1.1, desc: 'Tiro a distancia eficaz contra tropas poco protegidas. Débiles cuerpo a cuerpo.', symbol: 'bow', upgrades: ['arq_largo', 'ballesteros'], obsoleteBy: ['arq_largo', 'ballesteros'] },
  { id: 'jinetes_ligeros', name: 'Jinetes ligeros', era: 1, role: 'caballeria', species: null, techs: ['equitacion'], barracks: true, cav: true, melee: 'lanza', ranged: 'jabalinas', armor: 'cuero',
    base: { melee: 3, def: 2, morale: 55, discipline: 40, endurance: 60, speed: 2.1, strat: 1.5, recon: 55, conceal: 20, charge: 0.6, size: 1.1, density: 50 },
    cost: 22, upkeep: 1.1, food: 0.25, training: 2, logistics: 1.6, terrain: CAV_T, desc: 'Exploración, persecución y hostigamiento. No resisten un choque frontal.', symbol: 'cav', upgrades: ['cab_pesada'] },
  { id: 'minotauros', name: 'Guerreros minotauros', era: 1, role: 'choque', species: 'minotauro', barracks: true, melee: 'hacha', armor: 'cuero',
    base: { melee: 7, def: 9, morale: 75, discipline: 45, endurance: 80, speed: 0.85, strat: 0.85, recon: 5, conceal: 5, charge: 0.8, size: 1.25, density: 60 },
    cost: 30, upkeep: 1.6, food: 0.3, training: 2, logistics: 1.6, terrain: { colinas: 1.1 }, desc: 'Choque devastador contra formaciones debilitadas; blanco grande para los tiradores.', symbol: 'heavy', upgrades: ['min_acorazados'], obsoleteBy: ['min_acorazados'] },
  { id: 'cent_exploradores', name: 'Centauros exploradores', era: 1, role: 'reconocimiento', species: 'centauro', barracks: false, cav: true, melee: 'espada_corta', ranged: 'arco_caza', armor: 'cuero',
    base: { melee: 3, def: 2, morale: 50, discipline: 35, endurance: 70, speed: 2.4, strat: 1.8, recon: 70, conceal: 30, charge: 0.3, size: 1.2, density: 45 },
    cost: 18, upkeep: 0.9, food: 0.26, training: 1, logistics: 1.5, terrain: CEN_T, desc: 'Ojos del ejército en campo abierto: mejoran mucho la información de batalla.', symbol: 'scout', upgrades: ['centauros', 'cent_arqueros'] },
  { id: 'centauros', name: 'Caballería centaura', era: 1, role: 'caballeria', species: 'centauro', techs: ['montada'], barracks: true, cav: true, melee: 'lanza', ranged: 'jabalinas', armor: 'cuero',
    base: { melee: 5, def: 4, morale: 65, discipline: 45, endurance: 75, speed: 2.2, strat: 1.6, recon: 35, conceal: 10, charge: 1.2, size: 1.2, density: 50 },
    cost: 28, upkeep: 1.4, food: 0.28, training: 2, logistics: 1.6, terrain: CEN_T, desc: 'Cargas, flanqueos y hostigamiento en las llanuras.', symbol: 'cav', upgrades: ['cent_lanceros', 'cent_arqueros'], obsoleteBy: ['cent_lanceros'] },
  { id: 'gigantes_combate', name: 'Gigantes de combate', era: 1, role: 'choque', species: 'gigante', barracks: true, melee: 'garrote', armor: 'pieles',
    base: { melee: 50, def: 35, morale: 80, discipline: 40, endurance: 70, speed: 0.75, strat: 0.75, recon: 10, conceal: 0, charge: 1, siege: 100, size: 3, density: 4 },
    cost: 180, upkeep: 8, food: 1.8, training: 3, logistics: 4, desc: 'Rompen cualquier línea, pero el fuego concentrado los abate.', symbol: 'giant', upgrades: ['gigantes'] },
  { id: 'exploradores', name: 'Exploradores faunos', era: 1, role: 'reconocimiento', species: 'fauno', barracks: false, melee: 'cuchillo', ranged: 'arco_caza', armor: 'cuero',
    base: { melee: 3, def: 2, morale: 50, discipline: 40, endurance: 70, speed: 1.6, strat: 1.3, recon: 75, conceal: 70, density: 80 },
    cost: 9, upkeep: 0.4, food: 0.1, training: 1, logistics: 0.9, terrain: { bosque: 1.5, selva: 1.4 }, desc: 'Reconocimiento y emboscadas; casi invisibles en el bosque.', symbol: 'scout' },
  { id: 'enanos', name: 'Defensores enanos', era: 1, role: 'infanteria', species: 'enano', barracks: true, melee: 'martillo', armor: 'cota_malla', shield: true,
    base: { melee: 4, def: 9, morale: 80, discipline: 70, cohesion: 95, endurance: 80, speed: 0.75, strat: 0.8, recon: 5, conceal: 10, siege: 2, density: 110 },
    cost: 22, upkeep: 1.1, food: 0.15, training: 2, logistics: 1.2, terrain: { colinas: 1.2, montana: 1.25 }, desc: 'Muralla viviente. Lentos.', symbol: 'shield', upgrades: ['enanos_pesada'], obsoleteBy: ['enanos_pesada'] },
  // ---- Edad II
  { id: 'inf_pesada', name: 'Infantería pesada', era: 2, role: 'infanteria', species: null, techs: ['loriga'], barracks: true, melee: 'espada', armor: 'loriga', shield: true,
    base: { melee: 3, def: 4, morale: 65, discipline: 60, cohesion: 90, endurance: 55, speed: 0.9, strat: 0.95, recon: 5, conceal: 5, density: 100 },
    cost: 20, upkeep: 0.95, food: 0.15, training: 3, logistics: 1.2, desc: 'Columna vertebral del ejército: resiste flechas y choques.', symbol: 'shield' },
  { id: 'caballeros', name: 'Caballeros acorazados', era: 2, role: 'caballeria', species: null, techs: ['estribo', 'armadura_placas'], barracks: true, cav: true, melee: 'lanza_caballeria', armor: 'placas',
    base: { melee: 6, def: 6, morale: 80, discipline: 55, cohesion: 90, endurance: 60, speed: 1.8, strat: 1.3, recon: 20, conceal: 0, charge: 1.6, size: 1.3, density: 40 },
    cost: 55, upkeep: 2.6, food: 0.32, training: 5, logistics: 2.2, terrain: CAV_T, desc: 'La carga más temible de su tiempo. Cara, lenta de formar y vulnerable a picas y barro.', symbol: 'cav' },
  { id: 'cab_pesada', name: 'Caballería pesada', era: 2, role: 'caballeria', species: null, techs: ['estribo'], barracks: true, cav: true, melee: 'lanza_caballeria', armor: 'loriga',
    base: { melee: 5, def: 4, morale: 70, discipline: 50, endurance: 60, speed: 2, strat: 1.4, recon: 25, conceal: 5, charge: 1.4, size: 1.3, density: 45 },
    cost: 38, upkeep: 1.9, food: 0.3, training: 3, logistics: 1.9, terrain: CAV_T, desc: 'Arrolla infantería desorganizada. Sufre ante picas y terreno abrupto.', symbol: 'cav', upgrades: ['caballeros'], obsoleteBy: ['caballeros'] },
  { id: 'ballesteros', name: 'Ballesteros', era: 2, role: 'tiradores', species: null, techs: ['ballesta'], barracks: true, melee: 'cuchillo', ranged: 'ballesta', armor: 'acolchada',
    base: { melee: 2, def: 2, morale: 50, discipline: 50, endurance: 50, speed: 0.95, strat: 1, recon: 10, conceal: 15, density: 100 },
    cost: 15, upkeep: 0.7, food: 0.13, training: 1, logistics: 1.3, desc: 'Atraviesan armaduras y se instruyen deprisa; vulnerables mientras recargan.', symbol: 'bow' },
  { id: 'piqueros', name: 'Piqueros', era: 2, role: 'infanteria', species: null, techs: ['picas'], barracks: true, melee: 'pica', armor: 'acolchada',
    base: { melee: 3, def: 6, morale: 60, discipline: 60, cohesion: 90, endurance: 55, speed: 0.9, strat: 0.95, recon: 5, conceal: 5, density: 120 },
    cost: 14, upkeep: 0.7, food: 0.14, training: 2, logistics: 1, terrain: { bosque: 0.7 }, desc: 'Muro de picas que frena cargas; vulnerable a tiradores y flanqueos.', symbol: 'pike' },
  { id: 'arq_largo', name: 'Arqueros de largo alcance', era: 2, role: 'tiradores', species: null, techs: ['arcolargo'], barracks: true, melee: 'cuchillo', ranged: 'arco_largo', armor: 'acolchada',
    base: { melee: 2, def: 2, morale: 50, discipline: 45, endurance: 60, speed: 1, strat: 1, recon: 15, conceal: 20, density: 100 },
    cost: 16, upkeep: 0.75, food: 0.13, training: 4, logistics: 1.1, desc: 'Gran alcance y cadencia; requieren una larga instrucción.', symbol: 'bow' },
  { id: 'arq_elficos', name: 'Arqueros élficos', era: 2, role: 'tiradores', species: 'elfo', techs: ['arcolargo'], barracks: true, melee: 'cuchillo', ranged: 'arco_largo', armor: 'acolchada',
    base: { melee: 3, def: 2, rangedSkill: 1.25, morale: 65, discipline: 60, endurance: 60, speed: 1.05, strat: 1.05, recon: 40, conceal: 45, density: 90 },
    cost: 26, upkeep: 1.3, food: 0.12, training: 3, logistics: 1.1, terrain: { bosque: 1.2 }, desc: 'Precisión y alcance excepcionales. Difíciles de reponer.', symbol: 'bow' },
  { id: 'min_acorazados', name: 'Minotauros acorazados', era: 2, role: 'choque', species: 'minotauro', techs: ['armadura_placas'], barracks: true, melee: 'hacha', armor: 'placas',
    base: { melee: 8, def: 10, morale: 80, discipline: 55, endurance: 75, speed: 0.8, strat: 0.8, recon: 5, conceal: 0, charge: 1, size: 1.3, density: 55 },
    cost: 45, upkeep: 2.2, food: 0.32, training: 3, logistics: 2, terrain: { colinas: 1.1 }, desc: 'Choque acorazado que resiste el tiro; caro y hambriento.', symbol: 'heavy' },
  { id: 'cent_lanceros', name: 'Centauros lanceros', era: 2, role: 'caballeria', species: 'centauro', techs: ['estribo'], barracks: true, cav: true, melee: 'lanza_caballeria', armor: 'loriga',
    base: { melee: 6, def: 4, morale: 70, discipline: 50, endurance: 80, speed: 2, strat: 1.6, recon: 30, conceal: 5, charge: 1.5, size: 1.25, density: 45 },
    cost: 40, upkeep: 2, food: 0.3, training: 3, logistics: 1.8, terrain: CEN_T, desc: 'Caballería de choque centaura; incansable en campo abierto.', symbol: 'cav' },
  { id: 'cent_arqueros', name: 'Centauros arqueros', era: 2, role: 'tiradores', species: 'centauro', techs: ['arco_compuesto'], barracks: true, cav: true, melee: 'espada_corta', ranged: 'arco_compuesto', armor: 'cuero',
    base: { melee: 3, def: 2, morale: 60, discipline: 50, endurance: 75, speed: 2.3, strat: 1.7, recon: 45, conceal: 15, charge: 0.3, size: 1.2, density: 45 },
    cost: 26, upkeep: 1.6, food: 0.28, training: 3, logistics: 1.7, terrain: { bosque: 0.55, montana: 0.5, pantano: 0.55, estepa: 1.25, llanura: 1.15, pradera: 1.15 }, desc: 'Arqueros a galope: desgastan a la infantería lenta; inútiles en bosques y pasos.', symbol: 'cav' },
  { id: 'enanos_pesada', name: 'Infantería pesada enana', era: 2, role: 'infanteria', species: 'enano', techs: ['armadura_placas'], barracks: true, melee: 'hacha', armor: 'placas', shield: true,
    base: { melee: 4, def: 10, morale: 85, discipline: 80, cohesion: 100, endurance: 85, speed: 0.7, strat: 0.75, recon: 5, conceal: 5, siege: 3, density: 100 },
    cost: 34, upkeep: 1.6, food: 0.16, training: 3, logistics: 1.5, terrain: { colinas: 1.2, montana: 1.25 }, desc: 'La infantería más resistente del continente.', symbol: 'shield' },
  { id: 'ingenieros', name: 'Ingenieros de asedio', era: 2, role: 'ingenieros', species: null, techs: ['asedio'], barracks: true, melee: 'cuchillo', armor: 'cuero',
    base: { melee: 1, def: 2, morale: 40, discipline: 45, endurance: 55, speed: 0.95, strat: 0.95, recon: 10, conceal: 10, siege: 10, density: 100 },
    cost: 18, upkeep: 0.9, food: 0.13, training: 2, logistics: 1.2, desc: 'Zapas, minas y obras de asedio. Inútiles en campo abierto.', symbol: 'inf' },
  { id: 'catapultas', name: 'Catapultas', era: 2, role: 'asedio', species: null, techs: ['asedio'], barracks: true, melee: 'cuchillo', ranged: 'catapulta', armor: 'ninguna',
    base: { melee: 1, def: 1, morale: 40, discipline: 40, endurance: 40, speed: 0.35, strat: 0.6, recon: 0, conceal: 0, siege: 8, size: 1.5, density: 25 },
    cost: 30, upkeep: 1.4, food: 0.13, training: 2, logistics: 2.5, desc: 'Largo alcance contra muros y tropas concentradas; indefensas si las alcanzan.', symbol: 'siege', upgrades: ['trabuquetes'], obsoleteBy: ['trabuquetes'] },
  { id: 'trabuquetes', name: 'Trabuquetes', era: 2, role: 'asedio', species: null, techs: ['trabuquete'], barracks: true, melee: 'cuchillo', ranged: 'trabuquete', armor: 'ninguna',
    base: { melee: 1, def: 1, morale: 40, discipline: 45, endurance: 40, speed: 0.2, strat: 0.5, recon: 0, conceal: 0, siege: 16, size: 1.8, density: 20 },
    cost: 45, upkeep: 2, food: 0.13, training: 3, logistics: 3, desc: 'Derriban murallas desde muy lejos. Casi inmóviles.', symbol: 'siege' },
  { id: 'arietes', name: 'Arietes', era: 2, role: 'asedio', species: null, techs: ['asedio'], barracks: true, melee: 'ariete', armor: 'mantelete',
    base: { melee: 1, def: 2, morale: 45, discipline: 45, endurance: 60, speed: 0.4, strat: 0.7, recon: 0, conceal: 0, siege: 14, size: 1.4, density: 40 },
    cost: 20, upkeep: 0.8, food: 0.13, training: 1, logistics: 1.8, desc: 'Abren puertas: aceleran asedios y asaltos. Sin valor en batalla campal.', symbol: 'siege' },
  { id: 'gigantes', name: 'Gigantes de asedio', era: 2, role: 'choque', species: 'gigante', techs: ['asedio'], barracks: true, melee: 'garrote', armor: 'cota_gigante',
    base: { melee: 60, def: 40, morale: 85, discipline: 50, endurance: 70, speed: 0.7, strat: 0.7, recon: 10, conceal: 0, charge: 1, siege: 200, size: 3, density: 4 },
    cost: 220, upkeep: 9, food: 1.8, training: 3, logistics: 4, desc: 'Pocos y temibles. Derriban murallas y aceleran mucho los asedios.', symbol: 'giant' },
];

// ---------------------------------------------------------------- Unidad derivada (lo que usa el motor)
export interface UnitDef {
  id: string; name: string; era: number; role: Role; species: SpeciesId | null; tech?: string; techs: string[]; needsBarracks: boolean; cav: boolean;
  weapon: string; rweapon: string | null; armorId: string; shield: boolean;
  // atributos (por 100 efectivos donde procede); null = no aplica
  atk: number; ranged: number; pen: number; rpen: number; precision: number; range: number; reload: number;
  charge: number; antiCav: number; def: number; armor: number; mprot: number; speed: number; stratSpeed: number; recon: number;
  morale: number; discipline: number; cohesion: number; endurance: number; conceal: number; siege: number; size: number;
  food: number; ammo: number; ammoUse: number; fuel: null; cost: { oro: number; armas: number }; upkeep: number; training: number; logistics: number;
  terrain: Partial<Record<string, number>>; density: number; desc: string; symbol: string; upgrades: string[]; obsoleteBy: string[];
}
const r1 = (x: number) => Math.round(x * 100) / 100;
export function deriveUnit(s: UnitSpec, tier = 2): UnitDef {
  const m = tierStat(tier); const W = WEAPON[s.melee], R = s.ranged ? WEAPON[s.ranged] : null, A = ARMOR[s.armor], b = s.base; const sh = s.shield ? SHIELD : { def: 0, mprot: 0, cost: 0 };
  const techs = s.techs || []; const tcost = TIERS[Math.max(0, Math.min(4, Math.round(tier)))].cost;
  return {
    id: s.id, name: s.name, era: s.era, role: s.role, species: s.species, tech: techs[0], techs, needsBarracks: s.barracks, cav: !!s.cav,
    weapon: W.id, rweapon: R ? R.id : null, armorId: A.id, shield: !!s.shield,
    atk: r1(b.melee + (W.melee || 0) * m), ranged: R ? r1((R.ranged || 0) * (b.rangedSkill || 1) * m) : 0, pen: r1(W.pen * m), rpen: R ? r1(R.pen * m) : 0,
    precision: R ? r1(Math.min(0.95, (R.precision || 0.7) * (b.rangedSkill ? 1 + (b.rangedSkill - 1) * 0.5 : 1))) : 0, range: R ? R.range || 0 : 0, reload: R ? R.reload || 1 : 0,
    charge: r1((b.charge || 0) + (W.charge || 0)), antiCav: W.antiCharge || 1, def: r1(b.def + (A.def + sh.def + (W.def || 0)) * m), armor: r1(A.prot * m), mprot: r1((A.mprot + sh.mprot) * m),
    speed: r1(b.speed * A.weight), stratSpeed: b.strat, recon: b.recon, morale: b.morale, discipline: b.discipline, cohesion: b.cohesion ?? 85, endurance: b.endurance,
    conceal: b.conceal, siege: b.siege || 0, size: b.size || 1, food: s.food, ammo: R ? R.ammo || 0 : 0, ammoUse: R ? R.ammoUse || 0 : 0, fuel: null,
    cost: { oro: s.cost, armas: r1((W.cost + (R ? R.cost : 0) + A.cost + sh.cost) * 1.3 * tcost) }, upkeep: s.upkeep, training: s.training, logistics: s.logistics,
    terrain: s.terrain || {}, density: b.density, desc: s.desc, symbol: s.symbol, upgrades: s.upgrades || [], obsoleteBy: s.obsoleteBy || [],
  };
}
export const UNITS: UnitDef[] = UNIT_SPECS.map(s => deriveUnit(s));
export const UNIT: Record<string, UnitDef> = Object.fromEntries(UNITS.map(u => [u.id, u]));
export const SPEC: Record<string, UnitSpec> = Object.fromEntries(UNIT_SPECS.map(u => [u.id, u]));
const cache = new Map<string, UnitDef>();
/** Estadísticas efectivas con un nivel de equipo concreto (cacheadas). */
export function ust(type: string, tier = 2): UnitDef { const t = Math.round((tier ?? 2) * 10) / 10; if (t === 2) return UNIT[type]; const k = type + ':' + t; let u = cache.get(k); if (!u) { u = deriveUnit(SPEC[type], t); cache.set(k, u); } return u; }
/** Potencia de fuego sostenida (daño de tiro por casilla y pulso). Atributo derivado. */
export function firepower(d: UnitDef) { return d.ranged > 0 ? r1(d.ranged * d.precision / 0.7 / Math.max(1, d.reload)) : 0; }
/** Fatiga: ritmo de acumulación relativo (1 = normal). Atributo derivado de resistencia física y peso del equipo. */
export function fatigueRate(d: UnitDef) { return r1((1.5 - d.endurance / 100) / Math.max(0.6, ARMOR[d.armorId].weight)); }

// Los 28 atributos independientes, con su lectura y regla de aplicabilidad.
export interface AttrDef { key: string; name: string; get: (d: UnitDef) => number | null; fmt?: (v: number) => string; hint: string; }
const pct = (v: number) => Math.round(v * 100) + '%'; const L = (v: number) => v.toLocaleString('es');
export const ATTRS: AttrDef[] = [
  { key: 'atk', name: 'Ataque cuerpo a cuerpo', get: d => d.role === 'asedio' && d.rweapon ? null : d.atk, hint: 'Daño en el choque.' },
  { key: 'ranged', name: 'Ataque a distancia', get: d => d.ranged || null, hint: 'Daño de cada descarga.' },
  { key: 'pen', name: 'Penetración de armadura', get: d => d.rweapon ? d.rpen : d.pen, hint: 'Se compara con la armadura del blanco: si la supera, el daño crece; si no, cae.' },
  { key: 'fp', name: 'Potencia de fuego', get: d => firepower(d) || null, hint: 'Daño de tiro sostenido (ataque × precisión ÷ recarga).' },
  { key: 'precision', name: 'Precisión', get: d => d.precision || null, fmt: pct, hint: 'Proporción de impactos útiles.' },
  { key: 'range', name: 'Alcance efectivo', get: d => d.range || null, fmt: v => L(v) + ' casillas', hint: 'No puede disparar más allá. Las colinas dan +1.' },
  { key: 'reload', name: 'Cadencia de disparo', get: d => d.reload || null, fmt: v => v === 1 ? 'cada pulso' : `1 cada ${v} pulsos`, hint: 'Mientras recargan, los ballesteros defienden peor.' },
  { key: 'charge', name: 'Capacidad de carga', get: d => d.charge || null, hint: 'Multiplica el impacto del primer choque.' },
  { key: 'antiCav', name: 'Resistencia a cargas', get: d => d.antiCav, hint: '≥2: una carga frontal contra la formación fracasa.' },
  { key: 'def', name: 'Defensa cuerpo a cuerpo', get: d => d.def, hint: 'Reduce las bajas en el choque.' },
  { key: 'mprot', name: 'Protección frente a proyectiles', get: d => d.mprot, hint: 'Escudos y armaduras frente a flechas y virotes.' },
  { key: 'speed', name: 'Movilidad', get: d => d.speed, fmt: v => L(v) + ' (táctica)', hint: 'Velocidad en el campo de batalla.' },
  { key: 'recon', name: 'Capacidad de reconocimiento', get: d => d.recon || null, hint: 'Mejora la información sobre el enemigo antes y durante la batalla.' },
  { key: 'morale', name: 'Moral', get: d => d.morale, hint: 'Moral inicial; al agotarse, la unidad huye.' },
  { key: 'discipline', name: 'Disciplina', get: d => d.discipline, hint: 'Aguanta más antes de desbandarse y pierde menos cohesión.' },
  { key: 'cohesion', name: 'Cohesión', get: d => d.cohesion, hint: 'Cohesión inicial de la formación.' },
  { key: 'endurance', name: 'Resistencia física', get: d => d.endurance, hint: 'Ritmo al que se fatiga.' },
  { key: 'fatigue', name: 'Fatiga', get: d => fatigueRate(d), fmt: v => '×' + L(v), hint: 'Ritmo relativo de acumulación de fatiga (resistencia y peso del equipo).' },
  { key: 'conceal', name: 'Capacidad de ocultación', get: d => d.conceal || null, hint: 'Distancia a la que el enemigo la detecta en bosques.' },
  { key: 'siege', name: 'Eficacia contra fortificaciones', get: d => d.siege || null, hint: 'Acelera asedios y mejora los asaltos (por cada 100).' },
  { key: 'food', name: 'Consumo alimentario', get: d => d.food, fmt: v => L(v) + '/mes', hint: 'Alimentos por cada 100 al mes.' },
  { key: 'ammoUse', name: 'Consumo de munición', get: d => d.ammoUse || null, fmt: v => L(v) + ' armas/descarga', hint: 'Reponer la munición gastada cuesta armas (por cada 100).' },
  { key: 'fuel', name: 'Consumo de combustible', get: d => d.fuel, hint: 'Solo para vehículos de edades industriales.' },
  { key: 'cost', name: 'Coste de reclutamiento', get: d => d.cost.oro, fmt: v => v + ' oro', hint: 'Más el coste en armas del equipo.' },
  { key: 'upkeep', name: 'Coste de mantenimiento', get: d => d.upkeep, fmt: v => L(v) + ' oro/mes', hint: 'Por cada 100 efectivos.' },
  { key: 'training', name: 'Tiempo de entrenamiento', get: d => d.training, fmt: v => v ? v + ' meses' : 'inmediato', hint: 'Meses en instrucción con penalización de combate.' },
  { key: 'logistics', name: 'Necesidades logísticas', get: d => d.logistics, fmt: v => '×' + L(v), hint: 'Peso sobre la capacidad de abastecimiento de las provincias.' },
  { key: 'terrain', name: 'Adaptación al terreno', get: d => Object.keys(d.terrain).length ? 1 : null, hint: 'Modificadores según el bioma.' },
];

/** Fortalezas y vulnerabilidades derivadas de los atributos (no son tablas fijas de piedra, papel o tijera). */
export function traits(d: UnitDef): { pros: string[]; cons: string[] } {
  const pros: string[] = [], cons: string[] = [];
  if (d.antiCav >= 2) pros.push('Detiene cargas frontales de caballería'); else if (d.antiCav >= 1.5) pros.push('Resiste bien a jinetes ligeros');
  if (d.pen >= 5 || d.rpen >= 6) pros.push('Eficaz contra tropas acorazadas');
  if (d.armor >= 6) pros.push('Muy protegida frente a armas cortas'); if (d.mprot >= 6) pros.push('Casi inmune a flechas ligeras');
  if (d.charge >= 1.2) pros.push('Carga demoledora contra formaciones desorganizadas');
  if (d.ranged > 0 && d.range >= 6) pros.push('Gran alcance de tiro'); else if (d.ranged > 0 && d.reload === 1 && d.rpen < 4) pros.push('Desgasta a la infantería poco protegida');
  if (d.speed >= 1.6) pros.push('Gran movilidad'); if (d.recon >= 50) pros.push('Excelente reconocimiento'); if (d.conceal >= 45) pros.push('Se oculta bien en bosques');
  if (d.siege >= 10) pros.push('Muy útil en asedios'); if (d.discipline >= 70) pros.push('Disciplina férrea');
  if (d.mprot <= 2.5 && d.role !== 'asedio') cons.push('Vulnerable a proyectiles'); if (d.reload >= 3) cons.push('Vulnerable durante la recarga');
  if (d.ranged > 0 && d.atk <= 3) cons.push('Débil cuerpo a cuerpo'); if (d.size >= 1.25) cons.push('Blanco grande para el fuego concentrado');
  if (d.cav) cons.push('Sufre ante picas, pantanos, bosques y montañas'); if (d.antiCav >= 2) cons.push('Torpe frente a flanqueos');
  if (d.speed <= 0.5) cons.push('Casi inmóvil en el campo'); if (d.training >= 4) cons.push('Instrucción larga: difícil de reponer');
  if (d.morale <= 45) cons.push('Moral frágil'); if (d.food >= 0.28) cons.push('Gran consumo de alimentos');
  return { pros, cons };
}
