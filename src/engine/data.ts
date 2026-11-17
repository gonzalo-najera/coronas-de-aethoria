import type { SpeciesId, ResId, Biome, KingdomType, Personality, DepositId } from './types';

export const GAME_TITLE = 'Coronas de Aethoria';
export const MONTHS = ['Escarcha', 'Deshielo', 'Brotes', 'Lluvias', 'Flores', 'Siega Temprana', 'Sol Alto', 'Espigas', 'Vendimia', 'Hojarasca', 'Brumas', 'Velas'];
export const SEASONS = ['Invierno', 'Invierno', 'Primavera', 'Primavera', 'Primavera', 'Verano', 'Verano', 'Verano', 'Otoño', 'Otoño', 'Otoño', 'Invierno'];

export interface SpeciesDef {
  id: SpeciesId; name: string; plural: string; color: string;
  fuerza: number; agilidad: number; resistencia: number; movilidad: number; academica: number; artesanal: number;
  longevidad: number; fertilidad: number; consumo: number; militar: number; transporte: number;
  prod: Partial<Record<ResId, number>>; terrain: Partial<Record<Biome, number>>; desc: string;
}
export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  humano: { id: 'humano', name: 'Humano', plural: 'Humanos', color: '#b08a5a', fuerza: 1, agilidad: 1, resistencia: 1, movilidad: 1, academica: 1, artesanal: 1, longevidad: 1, fertilidad: 1.25, consumo: 1, militar: 1, transporte: 1, prod: { oro: 0.18, alimentos: 0.05 }, terrain: {}, desc: 'Versátiles, buenos administradores y comerciantes. Crecen deprisa.' },
  fauno: { id: 'fauno', name: 'Fauno', plural: 'Faunos', color: '#6f8f4e', fuerza: 0.8, agilidad: 1.2, resistencia: 0.9, movilidad: 1.1, academica: 1.05, artesanal: 1.05, longevidad: 1.1, fertilidad: 1.05, consumo: 0.85, militar: 0.85, transporte: 0.9, prod: { madera: 0.3, alimentos: 0.1 }, terrain: { bosque: 1.3, selva: 1.2, desierto: 0.7 }, desc: 'Ligados a los bosques: madera, agricultura sostenible, sigilo y cohesión social.' },
  minotauro: { id: 'minotauro', name: 'Minotauro', plural: 'Minotauros', color: '#8a4b32', fuerza: 1.8, agilidad: 0.85, resistencia: 1.4, movilidad: 0.85, academica: 0.85, artesanal: 1.1, longevidad: 1, fertilidad: 0.85, consumo: 1.7, militar: 1.35, transporte: 1.6, prod: { piedra: 0.3, hierro: 0.2 }, terrain: { colinas: 1.1 }, desc: 'Fuerza extraordinaria: cantería, minería y choque. Comen mucho.' },
  centauro: { id: 'centauro', name: 'Centauro', plural: 'Centauros', color: '#a8743a', fuerza: 1.3, agilidad: 1.3, resistencia: 1.2, movilidad: 1.8, academica: 1, artesanal: 0.95, longevidad: 1.05, fertilidad: 0.9, consumo: 1.6, militar: 1.25, transporte: 1.5, prod: { alimentos: 0.12, oro: 0.06 }, terrain: { llanura: 1.25, estepa: 1.3, pradera: 1.25, montana: 0.6, bosque: 0.8 }, desc: 'Señores de las llanuras: velocidad, mensajería y combate móvil.' },
  gigante: { id: 'gigante', name: 'Gigante', plural: 'Gigantes', color: '#7d7f8c', fuerza: 4, agilidad: 0.6, resistencia: 2.5, movilidad: 0.6, academica: 0.95, artesanal: 1.1, longevidad: 1.6, fertilidad: 0.35, consumo: 5, militar: 2, transporte: 4, prod: { piedra: 0.45 }, terrain: { montana: 1.1, tundra: 1.1 }, desc: 'Escasos y majestuosos: obras monumentales y asedios. Consumo enorme.' },
  enano: { id: 'enano', name: 'Enano', plural: 'Enanos', color: '#7a5c45', fuerza: 1.25, agilidad: 0.9, resistencia: 1.35, movilidad: 0.8, academica: 1.05, artesanal: 1.45, longevidad: 1.4, fertilidad: 0.8, consumo: 1.05, militar: 1.15, transporte: 1.1, prod: { hierro: 0.35, herramientas: 0.3, armas: 0.2 }, terrain: { montana: 1.3, colinas: 1.2 }, desc: 'Mineros, metalúrgicos e ingenieros de fortificaciones.' },
  elfo: { id: 'elfo', name: 'Elfo', plural: 'Elfos', color: '#5d7f86', fuerza: 0.9, agilidad: 1.25, resistencia: 0.95, movilidad: 1.05, academica: 1.5, artesanal: 1.15, longevidad: 3, fertilidad: 0.5, consumo: 0.9, militar: 1.1, transporte: 0.9, prod: { investigacion: 0.45 }, terrain: { bosque: 1.2 }, desc: 'Longevos: investigación, arquería, medicina y cartografía. Crecen despacio.' },
};
export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];

export const RES: Record<ResId, { name: string; icon: string; base: number }> = {
  oro: { name: 'Oro', icon: '◉', base: 1 },
  alimentos: { name: 'Alimentos', icon: '❦', base: 1.2 },
  madera: { name: 'Madera', icon: '♣', base: 1.5 },
  piedra: { name: 'Piedra', icon: '▲', base: 1.6 },
  hierro: { name: 'Hierro', icon: '⚒', base: 3 },
  herramientas: { name: 'Herramientas', icon: '⚙', base: 6 },
  armas: { name: 'Armas', icon: '⚔', base: 8 },
  investigacion: { name: 'Investigación', icon: '✦', base: 0 },
  prestigio: { name: 'Prestigio', icon: '♛', base: 0 },
};
export const TRADEABLE: ResId[] = ['alimentos', 'madera', 'piedra', 'hierro', 'herramientas', 'armas'];

export const BIOMES: Record<Biome, { name: string; color: string; fert: number; move: number; def: number; wood: number; stone: number; land: boolean }> = {
  oceano: { name: 'Océano', color: '#3f6a7a', fert: 0, move: 1, def: 0, wood: 0, stone: 0, land: false },
  mar: { name: 'Mar', color: '#5f8f97', fert: 0, move: 1, def: 0, wood: 0, stone: 0, land: false },
  lago: { name: 'Lago', color: '#6a9aa0', fert: 0, move: 1, def: 0, wood: 0, stone: 0, land: false },
  llanura: { name: 'Llanura', color: '#b7b77a', fert: 1, move: 1, def: 0, wood: 0.1, stone: 0.05, land: true },
  pradera: { name: 'Pradera', color: '#9fae6a', fert: 1.15, move: 1, def: 0, wood: 0.15, stone: 0.05, land: true },
  estepa: { name: 'Estepa', color: '#c2b07c', fert: 0.55, move: 0.9, def: 0, wood: 0.05, stone: 0.1, land: true },
  bosque: { name: 'Bosque', color: '#5d7d47', fert: 0.55, move: 1.6, def: 0.2, wood: 1, stone: 0.1, land: true },
  taiga: { name: 'Taiga', color: '#536f50', fert: 0.3, move: 1.7, def: 0.2, wood: 0.9, stone: 0.15, land: true },
  selva: { name: 'Selva', color: '#3f6a3c', fert: 0.6, move: 2.2, def: 0.25, wood: 0.9, stone: 0.05, land: true },
  desierto: { name: 'Desierto', color: '#d8c08a', fert: 0.08, move: 1.8, def: 0.05, wood: 0, stone: 0.3, land: true },
  tundra: { name: 'Tundra', color: '#b9b8a6', fert: 0.12, move: 1.5, def: 0.05, wood: 0.05, stone: 0.2, land: true },
  colinas: { name: 'Colinas', color: '#a99e6c', fert: 0.6, move: 1.5, def: 0.3, wood: 0.2, stone: 0.8, land: true },
  montana: { name: 'Montaña', color: '#8f8577', fert: 0.1, move: 2.8, def: 0.6, wood: 0.1, stone: 1.2, land: true },
  nieve: { name: 'Cumbres nevadas', color: '#e8e6df', fert: 0, move: 3.5, def: 0.6, wood: 0, stone: 0.8, land: true },
  pantano: { name: 'Pantano', color: '#7b8a5e', fert: 0.35, move: 2.2, def: 0.15, wood: 0.4, stone: 0, land: true },
};

export const DEPOSITS: Record<DepositId, { name: string; res: ResId | null; gold: number; desc: string }> = {
  hierro: { name: 'Hierro', res: 'hierro', gold: 0, desc: 'Vetas de mineral de hierro. Requiere mina.' },
  cobre: { name: 'Cobre', res: 'hierro', gold: 1, desc: 'Cobre, útil para aleaciones y comercio.' },
  oro: { name: 'Oro', res: null, gold: 10, desc: 'Filones auríferos. La mina produce oro.' },
  plata: { name: 'Plata', res: null, gold: 6, desc: 'Plata. La mina produce oro.' },
  gemas: { name: 'Gemas', res: null, gold: 7, desc: 'Piedras preciosas: comercio y prestigio.' },
  sal: { name: 'Sal', res: null, gold: 3, desc: 'Salinas: conservación de alimentos y comercio.' },
  especias: { name: 'Especias', res: null, gold: 5, desc: 'Especias exóticas muy cotizadas.' },
  caballos: { name: 'Pastos de cría', res: 'alimentos', gold: 2, desc: 'Grandes pastos para ganado.' },
  plantas: { name: 'Plantas medicinales', res: null, gold: 2, desc: 'Reducen el riesgo de epidemias.' },
};

export interface BuildingDef {
  id: string; name: string; cat: string; cost: Partial<Record<ResId, number>>; months: number; max: number;
  tech?: string; techLv2?: string; upkeep: number; workers: number; desc: string; effect: string;
  cond?: string; visual: string;
}
export const BUILDINGS: BuildingDef[] = [
  { id: 'granja', name: 'Granjas', cat: 'Agricultura', cost: { oro: 40, madera: 20 }, months: 3, max: 3, upkeep: 0.5, workers: 300, desc: 'Campos de cultivo y huertos.', effect: '+6 alimentos por nivel (según fertilidad). Aumenta la capacidad de población.', visual: 'Campos labrados alrededor de la ciudad.' },
  { id: 'molino', name: 'Molino', cat: 'Agricultura', cost: { oro: 60, madera: 30, piedra: 20 }, months: 4, max: 2, tech: 'molinos', upkeep: 0.6, workers: 80, desc: 'Muele el grano y reduce pérdidas.', effect: '+15% alimentos por nivel.', visual: 'Molino de aspas en el paisaje agrícola.' },
  { id: 'riego', name: 'Canales de riego', cat: 'Agricultura', cost: { oro: 80, piedra: 40 }, months: 6, max: 1, tech: 'regadio', cond: 'rio', upkeep: 0.8, workers: 120, desc: 'Lleva el agua del río a los campos.', effect: '+25% alimentos. Requiere río.', visual: 'Canales azules entre los campos.' },
  { id: 'aserradero', name: 'Aserradero', cat: 'Industria', cost: { oro: 50, piedra: 20 }, months: 3, max: 3, cond: 'bosque', upkeep: 0.5, workers: 150, desc: 'Tala y corte de madera.', effect: '+5 madera por nivel.', visual: 'Aserradero junto al bosque.' },
  { id: 'cantera', name: 'Cantera', cat: 'Industria', cost: { oro: 50, madera: 20 }, months: 3, max: 3, cond: 'roca', upkeep: 0.5, workers: 150, desc: 'Extracción de piedra.', effect: '+5 piedra por nivel.', visual: 'Cantera escalonada en la ladera.' },
  { id: 'mina', name: 'Mina', cat: 'Industria', cost: { oro: 80, madera: 40 }, months: 5, max: 3, techLv2: 'mineria', cond: 'yacimiento', upkeep: 1, workers: 200, desc: 'Explota los yacimientos de la provincia.', effect: '+5 hierro o +oro por nivel según el yacimiento.', visual: 'Bocamina con vagonetas en la montaña.' },
  { id: 'herreria', name: 'Herrería', cat: 'Industria', cost: { oro: 70, madera: 20, piedra: 30 }, months: 4, max: 2, tech: 'forja', upkeep: 0.8, workers: 100, desc: 'Convierte hierro y madera en herramientas.', effect: 'Consume 3 hierro + 1 madera → 3 herramientas por nivel.', visual: 'Fragua con humo en la ciudad.' },
  { id: 'armeria', name: 'Armería', cat: 'Industria', cost: { oro: 90, madera: 30, piedra: 40, hierro: 20 }, months: 5, max: 2, tech: 'metalurgia', upkeep: 1, workers: 100, desc: 'Forja armas para el ejército.', effect: 'Consume 3 hierro + 1 madera → 3 armas por nivel.', visual: 'Armería con estandartes.' },
  { id: 'mercado', name: 'Mercado', cat: 'Comercio', cost: { oro: 80, madera: 40 }, months: 4, max: 2, upkeep: 0.5, workers: 100, desc: 'Plaza de comercio.', effect: '+20% impuestos de la provincia por nivel, +prosperidad.', visual: 'Toldos de mercado en la plaza.' },
  { id: 'puerto', name: 'Puerto', cat: 'Comercio', cost: { oro: 100, madera: 80, piedra: 30 }, months: 6, max: 2, techLv2: 'naval', cond: 'costa', upkeep: 1, workers: 200, desc: 'Muelles, pesca y comercio marítimo.', effect: '+pesca, +oro por comercio. Permite expediciones marítimas.', visual: 'Muelles y barcos en la costa.' },
  { id: 'biblioteca', name: 'Biblioteca', cat: 'Ciencia', cost: { oro: 90, madera: 30, piedra: 40 }, months: 5, max: 1, tech: 'bibliotecas', upkeep: 1, workers: 30, desc: 'Archivo de saberes.', effect: '+3 investigación, +10% investigación de la provincia.', visual: 'Edificio con biblioteca en la vista de ciudad.' },
  { id: 'universidad', name: 'Universidad', cat: 'Ciencia', cost: { oro: 200, madera: 60, piedra: 100 }, months: 10, max: 1, tech: 'universidades', upkeep: 2.5, workers: 80, desc: 'Centro de estudios superiores.', effect: '+8 investigación, +25% investigación de la provincia.', visual: 'Cúpula universitaria en la vista de ciudad.' },
  { id: 'hospital', name: 'Hospital', cat: 'Ciencia', cost: { oro: 90, madera: 30, piedra: 30 }, months: 5, max: 1, tech: 'herboristeria', upkeep: 1, workers: 60, desc: 'Atención a enfermos y heridos.', effect: '-60% riesgo de epidemia, +3 estabilidad, heridos se recuperan más rápido.', visual: 'Hospital con jardín.' },
  { id: 'murallas', name: 'Murallas', cat: 'Defensa', cost: { oro: 80, piedra: 150 }, months: 6, max: 3, techLv2: 'mamposteria', upkeep: 0.8, workers: 200, desc: 'Cerco de piedra.', effect: '+asedio: cada nivel añade 2 meses y guarnición. +5 estabilidad.', visual: 'La ciudad pasa a verse amurallada.' },
  { id: 'castillo', name: 'Castillo', cat: 'Defensa', cost: { oro: 250, madera: 60, piedra: 250, hierro: 20 }, months: 12, max: 1, tech: 'fortificaciones', upkeep: 2, workers: 300, desc: 'Fortaleza señorial.', effect: '+3 meses de asedio, +guarnición, +10% defensa en batalla, +prestigio.', visual: 'Castillo con torres y banderas.' },
  { id: 'cuartel', name: 'Cuartel', cat: 'Defensa', cost: { oro: 70, madera: 40, piedra: 30 }, months: 4, max: 1, upkeep: 1, workers: 50, desc: 'Instrucción de tropas.', effect: 'Permite reclutar unidades profesionales. +experiencia inicial.', visual: 'Barracones y patio de armas.' },
  { id: 'torre', name: 'Torre de vigilancia', cat: 'Defensa', cost: { oro: 40, piedra: 30 }, months: 2, max: 1, upkeep: 0.3, workers: 10, desc: 'Atalaya.', effect: 'Visión de las provincias a 2 pasos.', visual: 'Atalaya en un alto.' },
  { id: 'camino', name: 'Caminos', cat: 'Infraestructura', cost: { oro: 40, piedra: 30 }, months: 3, max: 1, upkeep: 0.4, workers: 150, desc: 'Red de caminos.', effect: '-35% coste de movimiento, +abastecimiento, +5% impuestos. Se dibujan hacia provincias vecinas con caminos, con puentes sobre los ríos.', visual: 'Caminos y puentes entre ciudades.' },
  { id: 'deposito', name: 'Depósito militar', cat: 'Infraestructura', cost: { oro: 60, madera: 40 }, months: 3, max: 1, tech: 'logistica', upkeep: 0.6, workers: 40, desc: 'Almacenes para el ejército.', effect: '+capacidad de abastecimiento en la provincia y vecinas.', visual: 'Almacenes y carros.' },
];
export const BLD: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));

export interface TechDef { id: string; name: string; branch: string; cost: number; req: string[]; desc: string; effects: string[]; unlocks: { kind: string; name: string; ref?: string }[]; col: number; row: number; }
export const TECHS: TechDef[] = [
  { id: 'escritura', name: 'Escritura', branch: 'Educación', cost: 0, req: [], desc: 'Registro de leyes y cuentas.', effects: ['Base de toda administración.'], unlocks: [], col: 0, row: 3 },
  { id: 'forja', name: 'Forja', branch: 'Metalurgia', cost: 0, req: [], desc: 'Trabajo básico del hierro.', effects: [], unlocks: [{ kind: 'Edificio', name: 'Herrería', ref: 'herreria' }], col: 0, row: 6 },
  { id: 'rotacion', name: 'Rotación de cultivos', branch: 'Agricultura', cost: 60, req: [], desc: 'Alternar cultivos regenera la tierra.', effects: ['+15% producción de alimentos'], unlocks: [{ kind: 'Mejora', name: '+15% alimentos' }], col: 1, row: 0 },
  { id: 'molinos', name: 'Molinos', branch: 'Agricultura', cost: 110, req: ['rotacion'], desc: 'Aprovechar el viento y el agua para moler.', effects: [], unlocks: [{ kind: 'Edificio', name: 'Molino', ref: 'molino' }], col: 2, row: 0 },
  { id: 'regadio', name: 'Regadío', branch: 'Agricultura', cost: 180, req: ['molinos', 'matematicas'], desc: 'Canales y acequias desde los ríos.', effects: [], unlocks: [{ kind: 'Edificio', name: 'Canales de riego', ref: 'riego' }], col: 3, row: 0 },
  { id: 'silvicultura', name: 'Silvicultura', branch: 'Silvicultura', cost: 70, req: [], desc: 'Gestión sostenible de los bosques.', effects: ['+20% madera'], unlocks: [{ kind: 'Mejora', name: '+20% madera' }], col: 1, row: 1 },
  { id: 'herboristeria', name: 'Herboristería', branch: 'Medicina', cost: 90, req: ['silvicultura'], desc: 'Remedios de plantas medicinales.', effects: ['Heridos se recuperan un 30% más rápido'], unlocks: [{ kind: 'Edificio', name: 'Hospital', ref: 'hospital' }], col: 2, row: 1 },
  { id: 'matematicas', name: 'Matemáticas', branch: 'Matemáticas', cost: 80, req: ['escritura'], desc: 'Geometría y cálculo.', effects: ['+10% investigación'], unlocks: [{ kind: 'Mejora', name: '+10% investigación' }], col: 1, row: 2 },
  { id: 'bibliotecas', name: 'Bibliotecas', branch: 'Educación', cost: 90, req: ['escritura'], desc: 'Conservar y copiar el saber.', effects: [], unlocks: [{ kind: 'Edificio', name: 'Biblioteca', ref: 'biblioteca' }], col: 1, row: 3 },
  { id: 'universidades', name: 'Universidades', branch: 'Educación', cost: 220, req: ['bibliotecas', 'matematicas'], desc: 'Estudios superiores.', effects: [], unlocks: [{ kind: 'Edificio', name: 'Universidad', ref: 'universidad' }], col: 2, row: 3 },
  { id: 'cartografia', name: 'Cartografía', branch: 'Cartografía', cost: 120, req: ['matematicas'], desc: 'Mapas precisos y sistemáticos.', effects: ['Expediciones: +1 región por mes y -25% riesgo de extravío', 'Las expediciones cartografían 2 regiones alrededor'], unlocks: [{ kind: 'Expedición', name: 'Expedición cartográfica de mayor alcance' }, { kind: 'Acción', name: 'Intercambio de mapas con otros reinos' }], col: 2, row: 2 },
  { id: 'naval', name: 'Construcción naval', branch: 'Construcción naval', cost: 100, req: [], desc: 'Cascos más grandes y robustos.', effects: ['-30% riesgo de tormentas en expediciones'], unlocks: [{ kind: 'Edificio', name: 'Puerto nivel 2', ref: 'puerto' }], col: 1, row: 4 },
  { id: 'oceanica', name: 'Navegación oceánica', branch: 'Navegación', cost: 240, req: ['cartografia', 'naval'], desc: 'Navegar lejos de la costa con astrolabio.', effects: ['Las expediciones pueden cruzar océanos profundos'], unlocks: [{ kind: 'Expedición', name: 'Exploración oceánica' }, { kind: 'Acción', name: 'Colonias de ultramar' }], col: 3, row: 2 },
  { id: 'comercio', name: 'Gremios mercantiles', branch: 'Comercio', cost: 100, req: ['escritura'], desc: 'Organización del comercio.', effects: ['+25% ingresos de mercados', 'Acuerdos comerciales +50% oro'], unlocks: [{ kind: 'Mejora', name: 'Mercados más rentables' }], col: 2, row: 4 },
  { id: 'administracion', name: 'Administración', branch: 'Administración', cost: 110, req: ['escritura'], desc: 'Funcionarios y registros.', effects: ['+5 estabilidad en provincias lejanas', 'Reduce la penalización por expansión'], unlocks: [{ kind: 'Ley', name: 'Integración plena de especies', ref: 'integracion' }], col: 1, row: 5 },
  { id: 'mineria', name: 'Minería profunda', branch: 'Minería', cost: 100, req: ['forja'], desc: 'Galerías y entibados.', effects: ['+20% hierro'], unlocks: [{ kind: 'Edificio', name: 'Mina nivel 2-3', ref: 'mina' }], col: 1, row: 6 },
  { id: 'metalurgia', name: 'Metalurgia avanzada', branch: 'Metalurgia', cost: 140, req: ['forja', 'mineria'], desc: 'Hornos de alta temperatura.', effects: [], unlocks: [{ kind: 'Edificio', name: 'Armería', ref: 'armeria' }], col: 2, row: 6 },
  { id: 'acero', name: 'Acero templado', branch: 'Metalurgia', cost: 220, req: ['metalurgia'], desc: 'Hojas más duras y flexibles.', effects: ['+12% ataque cuerpo a cuerpo de todas las unidades'], unlocks: [{ kind: 'Mejora militar', name: '+12% ataque' }], col: 3, row: 6 },
  { id: 'mamposteria', name: 'Mampostería', branch: 'Arquitectura', cost: 80, req: [], desc: 'Muros de piedra trabada.', effects: ['+15% piedra'], unlocks: [{ kind: 'Edificio', name: 'Murallas nivel 2-3', ref: 'murallas' }], col: 1, row: 7 },
  { id: 'fortificaciones', name: 'Fortificaciones', branch: 'Fortificaciones', cost: 160, req: ['mamposteria'], desc: 'Castillos y torres flanqueantes.', effects: [], unlocks: [{ kind: 'Edificio', name: 'Castillo', ref: 'castillo' }], col: 2, row: 7 },
  { id: 'asedio', name: 'Ingeniería de asedio', branch: 'Asedios', cost: 180, req: ['fortificaciones', 'matematicas'], desc: 'Arietes, torres y catapultas.', effects: ['Asedios un 40% más rápidos'], unlocks: [{ kind: 'Unidad', name: 'Gigantes de asedio', ref: 'gigantes' }], col: 3, row: 7 },
  { id: 'picas', name: 'Picas', branch: 'Infantería', cost: 70, req: [], desc: 'Formaciones cerradas de astas largas.', effects: [], unlocks: [{ kind: 'Unidad', name: 'Piqueros', ref: 'piqueros' }], col: 1, row: 8 },
  { id: 'montada', name: 'Tácticas montadas', branch: 'Caballería', cost: 100, req: ['picas'], desc: 'Cargas y hostigamiento a gran velocidad.', effects: [], unlocks: [{ kind: 'Unidad', name: 'Caballería centaura', ref: 'centauros' }], col: 2, row: 8 },
  { id: 'arcolargo', name: 'Arco largo', branch: 'Arquería', cost: 100, req: ['silvicultura'], desc: 'Arcos de tejo de gran alcance.', effects: [], unlocks: [{ kind: 'Unidad', name: 'Arqueros élficos', ref: 'arq_elficos' }], col: 2, row: 9 },
  { id: 'logistica', name: 'Logística', branch: 'Logística', cost: 110, req: ['administracion'], desc: 'Convoyes y almacenes de campaña.', effects: ['+2 meses de autonomía para los ejércitos'], unlocks: [{ kind: 'Edificio', name: 'Depósito militar', ref: 'deposito' }], col: 2, row: 5 },
];
export const TECH: Record<string, TechDef> = Object.fromEntries(TECHS.map(t => [t.id, t]));

export interface UnitDef {
  id: string; name: string; species: SpeciesId | null; tech?: string; needsBarracks: boolean;
  atk: number; def: number; ranged: number; range: number; speed: number; morale: number; charge: number;
  antiCav: number; density: number; cost: { oro: number; armas: number }; upkeep: number; food: number;
  stratSpeed: number; terrain: Partial<Record<string, number>>; desc: string; symbol: string; cav: boolean;
}
// Valores por 100 efectivos (coste, mantenimiento, comida). density = efectivos por casilla de frente.
export const UNITS: UnitDef[] = [
  { id: 'milicia', name: 'Milicia', species: null, needsBarracks: false, atk: 4, def: 4, ranged: 0, range: 0, speed: 1, morale: 40, charge: 0, antiCav: 1, density: 120, cost: { oro: 6, armas: 1 }, upkeep: 0.3, food: 0.12, stratSpeed: 1, terrain: {}, desc: 'Levas mal equipadas. Baratas, frágiles.', symbol: 'inf', cav: false },
  { id: 'lanceros', name: 'Lanceros', species: null, needsBarracks: true, atk: 6, def: 7, ranged: 0, range: 0, speed: 1, morale: 55, charge: 0, antiCav: 1.5, density: 110, cost: { oro: 12, armas: 3 }, upkeep: 0.6, food: 0.14, stratSpeed: 1, terrain: {}, desc: 'Infantería de línea versátil.', symbol: 'inf', cav: false },
  { id: 'piqueros', name: 'Piqueros', species: null, tech: 'picas', needsBarracks: true, atk: 5, def: 9, ranged: 0, range: 0, speed: 0.9, morale: 60, charge: 0, antiCav: 2.4, density: 120, cost: { oro: 14, armas: 3 }, upkeep: 0.7, food: 0.14, stratSpeed: 0.95, terrain: { bosque: 0.7 }, desc: 'Muro de picas: frena cargas.', symbol: 'pike', cav: false },
  { id: 'arqueros', name: 'Arqueros', species: null, needsBarracks: true, atk: 3, def: 3, ranged: 6, range: 5, speed: 1, morale: 45, charge: 0, antiCav: 1, density: 100, cost: { oro: 12, armas: 2 }, upkeep: 0.6, food: 0.13, stratSpeed: 1, terrain: {}, desc: 'Tiro a distancia. Débiles cuerpo a cuerpo.', symbol: 'bow', cav: false },
  { id: 'minotauros', name: 'Infantería pesada de minotauros', species: 'minotauro', needsBarracks: true, atk: 12, def: 10, ranged: 0, range: 0, speed: 0.85, morale: 75, charge: 0.8, antiCav: 1.3, density: 60, cost: { oro: 30, armas: 6 }, upkeep: 1.6, food: 0.3, stratSpeed: 0.85, terrain: { colinas: 1.1 }, desc: 'Choque devastador que rompe formaciones.', symbol: 'heavy', cav: false },
  { id: 'centauros', name: 'Caballería centaura', species: 'centauro', tech: 'montada', needsBarracks: true, atk: 9, def: 5, ranged: 3, range: 3, speed: 2.2, morale: 65, charge: 1.2, antiCav: 1, density: 50, cost: { oro: 28, armas: 4 }, upkeep: 1.4, food: 0.28, stratSpeed: 1.6, terrain: { bosque: 0.6, montana: 0.5, llanura: 1.15, estepa: 1.2 }, desc: 'Cargas, flanqueos y hostigamiento.', symbol: 'cav', cav: true },
  { id: 'exploradores', name: 'Exploradores faunos', species: 'fauno', needsBarracks: false, atk: 4, def: 3, ranged: 3, range: 3, speed: 1.6, morale: 50, charge: 0, antiCav: 1, density: 80, cost: { oro: 9, armas: 1 }, upkeep: 0.4, food: 0.1, stratSpeed: 1.3, terrain: { bosque: 1.5, selva: 1.4 }, desc: 'Reconocimiento y emboscadas. Mejoran la información de batalla.', symbol: 'scout', cav: false },
  { id: 'enanos', name: 'Defensores enanos', species: 'enano', needsBarracks: true, atk: 7, def: 13, ranged: 0, range: 0, speed: 0.75, morale: 80, charge: 0, antiCav: 1.8, density: 110, cost: { oro: 22, armas: 5 }, upkeep: 1.1, food: 0.15, stratSpeed: 0.8, terrain: { colinas: 1.2, montana: 1.25 }, desc: 'Muralla viviente. Lentos.', symbol: 'shield', cav: false },
  { id: 'arq_elficos', name: 'Arqueros élficos', species: 'elfo', tech: 'arcolargo', needsBarracks: true, atk: 4, def: 4, ranged: 10, range: 7, speed: 1.05, morale: 65, charge: 0, antiCav: 1, density: 90, cost: { oro: 26, armas: 3 }, upkeep: 1.3, food: 0.12, stratSpeed: 1.05, terrain: { bosque: 1.2 }, desc: 'Precisión y alcance excepcionales. Difíciles de reponer.', symbol: 'bow', cav: false },
  { id: 'gigantes', name: 'Gigantes de asedio', species: 'gigante', tech: 'asedio', needsBarracks: true, atk: 70, def: 45, ranged: 0, range: 0, speed: 0.7, morale: 85, charge: 1, antiCav: 1.5, density: 4, cost: { oro: 220, armas: 30 }, upkeep: 9, food: 1.8, stratSpeed: 0.7, terrain: {}, desc: 'Pocos y temibles. Derriban murallas (asedios x2).', symbol: 'giant', cav: false },
];
export const UNIT: Record<string, UnitDef> = Object.fromEntries(UNITS.map(u => [u.id, u]));

export const LAWS = {
  impuestos: { name: 'Impuestos', levels: ['Bajos', 'Moderados', 'Altos'], desc: ['−25% ingresos fiscales, +8 estabilidad, +crecimiento.', 'Equilibrio entre ingresos y estabilidad.', '+35% ingresos fiscales, −12 estabilidad, −crecimiento económico.'] },
  reclutamiento: { name: 'Reclutamiento', levels: ['Voluntario', 'Levas regionales', 'Movilización general'], desc: ['Reserva reclutable 4% de la población. +3 estabilidad.', 'Reserva reclutable 8% de la población.', 'Reserva 15% de la población, −8 estabilidad, −10% producción.'] },
  integracion: { name: 'Convivencia de especies', levels: ['Autonomía comunitaria', 'Tolerancia', 'Integración plena'], desc: ['Las comunidades se gobiernan solas: −2 tensión por diversidad, −5% impuestos.', 'Sin medidas especiales.', 'Representación política de todas las especies: sin tensión por diversidad, +5% producción. Requiere Administración.'] },
};

export interface KingdomTemplate { name: string; short: string; type: KingdomType; personality: Personality; color: string; color2: string; anchor: [number, number]; size: number; species: Partial<Record<SpeciesId, number>>; continent: number; techs: string[]; dynasty: string; independent?: boolean; desc: string; }
export const KINGDOMS: KingdomTemplate[] = [
  { name: 'Reino de Aurelanda', short: 'Aurelanda', type: 'agricola', personality: 'prudente', color: '#b3863a', color2: '#f1e2b0', anchor: [108, 132], size: 12, species: { humano: 52, fauno: 18, centauro: 10, minotauro: 10, enano: 5, gigante: 2, elfo: 3 }, continent: 0, techs: ['rotacion'], dynasty: 'Casa Doradal', desc: 'Valles fluviales fértiles, mucha población y ejército numeroso, pero escasez de minerales.' },
  { name: 'Corona de Durnhal', short: 'Durnhal', type: 'montanoso', personality: 'aislacionista', color: '#6e6a7a', color2: '#d8d4e0', anchor: [92, 82], size: 9, species: { enano: 34, minotauro: 22, humano: 30, gigante: 6, fauno: 4, elfo: 2, centauro: 2 }, continent: 0, techs: ['mamposteria', 'mineria'], dynasty: 'Linaje Yunquehondo', desc: 'Piedra y metales abundantes y fortalezas excelentes, pero tierras de labor pobres.' },
  { name: 'Liga de Marisal', short: 'Marisal', type: 'maritimo', personality: 'comercial', color: '#2f6f8f', color2: '#cfe6ee', anchor: [150, 158], size: 8, species: { humano: 55, elfo: 12, fauno: 10, enano: 8, minotauro: 8, centauro: 5, gigante: 2 }, continent: 0, techs: ['naval', 'comercio'], dynasty: 'Familia Velamar', desc: 'Puertos, comercio y flota. Exploración fácil, poco territorio.' },
  { name: 'Fronda de Ilvaren', short: 'Ilvaren', type: 'forestal', personality: 'cientifico', color: '#4f7a43', color2: '#d7e6c5', anchor: [70, 148], size: 9, species: { fauno: 38, elfo: 22, humano: 28, centauro: 6, minotauro: 3, enano: 2, gigante: 1 }, continent: 0, techs: ['silvicultura', 'herboristeria'], dynasty: 'Estirpe Hojaplata', desc: 'Madera, faunos y elfos, exploradores especializados. Mueve mal grandes ejércitos.' },
  { name: 'Confederación de Llanoalto', short: 'Llanoalto', type: 'llanuras', personality: 'expansionista', color: '#9a4b3a', color2: '#efd2c4', anchor: [140, 100], size: 10, species: { centauro: 36, humano: 40, minotauro: 10, fauno: 8, enano: 3, gigante: 1, elfo: 2 }, continent: 0, techs: ['picas', 'montada'], dynasty: 'Clan Crinbravía', desc: 'Ganadería y centauros: gran movilidad militar, poca defensa natural.' },
  { name: 'Imperio de Ostrevia', short: 'Ostrevia', type: 'agricola', personality: 'militarista', color: '#7a2f45', color2: '#ecc9d2', anchor: [262, 98], size: 14, species: { humano: 60, minotauro: 14, centauro: 10, enano: 6, fauno: 6, gigante: 2, elfo: 2 }, continent: 2, techs: ['rotacion', 'picas', 'mamposteria'], dynasty: 'Dinastía Ostrav', desc: 'Gran potencia agraria y militar del este.' },
  { name: 'Principado de Velmora', short: 'Velmora', type: 'forestal', personality: 'diplomatico', color: '#3e6f6a', color2: '#cbe3df', anchor: [310, 120], size: 7, species: { elfo: 40, fauno: 25, humano: 30, centauro: 3, enano: 2 }, continent: 2, techs: ['bibliotecas', 'arcolargo', 'silvicultura'], dynasty: 'Casa Lunavera', desc: 'Principado sabio de los bosques orientales.' },
  { name: 'Reino de Skarnheim', short: 'Skarnheim', type: 'montanoso', personality: 'expansionista', color: '#4a5a78', color2: '#d3dbea', anchor: [205, 30], size: 9, species: { humano: 50, gigante: 12, enano: 18, minotauro: 12, centauro: 4, fauno: 2, elfo: 2 }, continent: 1, techs: ['naval', 'mamposteria'], dynasty: 'Casa Hielofirme', desc: 'Reino norteño de fiordos y gigantes.' },
  { name: 'Emirato de Qasmara', short: 'Qasmara', type: 'desertico', personality: 'comercial', color: '#b5652a', color2: '#f3dcc0', anchor: [205, 182], size: 10, species: { humano: 55, centauro: 15, minotauro: 15, enano: 6, gigante: 4, fauno: 3, elfo: 2 }, continent: 3, techs: ['comercio', 'matematicas'], dynasty: 'Casa Al-Sahrad', desc: 'Caravanas, sal y especias en el gran desierto.' },
  { name: 'Reino de Tamarú', short: 'Tamarú', type: 'forestal', personality: 'pacifista', color: '#2f6b3a', color2: '#c6e2c3', anchor: [238, 214], size: 8, species: { fauno: 35, humano: 40, minotauro: 10, elfo: 8, centauro: 4, gigante: 3 }, continent: 3, techs: ['herboristeria'], dynasty: 'Linaje Ceibaroja', desc: 'Reino selvático de la costa austral.' },
  { name: 'Dominio de Orhal', short: 'Orhal', type: 'llanuras', personality: 'explorador', color: '#6b4f8a', color2: '#ddd0ea', anchor: [24, 120], size: 10, species: { humano: 45, centauro: 20, gigante: 5, elfo: 15, fauno: 10, enano: 5 }, continent: 4, techs: ['naval', 'cartografia', 'matematicas'], dynasty: 'Casa Brumalta', desc: 'Civilización desconocida al otro lado del océano occidental.' },
  // Pueblos independientes
  { name: 'Ciudad libre de Puertoalba', short: 'Puertoalba', type: 'independiente', personality: 'comercial', color: '#8f7f5a', color2: '#ede4cf', anchor: [125, 62], size: 1, species: { humano: 60, enano: 15, elfo: 10, fauno: 15 }, continent: 0, techs: [], dynasty: 'Concejo de mercaderes', independent: true, desc: 'Ciudad comercial independiente.' },
  { name: 'Tribus de Cardonegro', short: 'Cardonegro', type: 'independiente', personality: 'aislacionista', color: '#5e5a3c', color2: '#dedcc4', anchor: [58, 108], size: 2, species: { fauno: 55, centauro: 20, humano: 25 }, continent: 0, techs: [], dynasty: 'Consejo de ancianos', independent: true, desc: 'Comunidades tribales de los brezales.' },
  { name: 'Clanes de Rocagrís', short: 'Rocagrís', type: 'independiente', personality: 'militarista', color: '#6b6258', color2: '#e0dbd5', anchor: [165, 128], size: 2, species: { minotauro: 50, enano: 25, humano: 25 }, continent: 0, techs: [], dynasty: 'Caudillos', independent: true, desc: 'Clanes minotauros de las colinas.' },
  { name: 'Señorío de Valtierra', short: 'Valtierra', type: 'independiente', personality: 'prudente', color: '#7c6b4d', color2: '#e7dfcf', anchor: [80, 178], size: 2, species: { humano: 70, fauno: 20, elfo: 10 }, continent: 0, techs: [], dynasty: 'Casa Valtierra', independent: true, desc: 'Pequeño señorío costero.' },
  { name: 'Pueblos de Cendra', short: 'Cendra', type: 'independiente', personality: 'pacifista', color: '#7a5a4a', color2: '#ecdcd2', anchor: [138, 204], size: 2, species: { humano: 55, gigante: 10, fauno: 35 }, continent: 5, techs: [], dynasty: 'Asamblea isleña', independent: true, desc: 'Isleños de las Islas Cendra, volcánicas.' },
  { name: 'Nómadas del Erg Rojo', short: 'Erg Rojo', type: 'independiente', personality: 'expansionista', color: '#9a6a3a', color2: '#f0dcc4', anchor: [255, 170], size: 2, species: { centauro: 55, humano: 45 }, continent: 3, techs: [], dynasty: 'Jefes de caravana', independent: true, desc: 'Nómadas centauros del desierto.' },
  { name: 'Hermandad de Brezoalto', short: 'Brezoalto', type: 'independiente', personality: 'diplomatico', color: '#6a7a5a', color2: '#dfe6d4', anchor: [238, 40], size: 2, species: { humano: 40, gigante: 20, enano: 40 }, continent: 1, techs: [], dynasty: 'Hermandad', independent: true, desc: 'Comunidad de montañeses del norte.' },
];

export const CONTINENTS = ['Valdoria', 'Norvhal', 'Esmerana', 'Kharesh', 'Brumalia', 'Islas Cendra', 'Archipiélago Velasal', 'Isla de Morvena'];

export const PERSONALITY_NAMES: Record<Personality, string> = { expansionista: 'Expansionista', comercial: 'Comercial', pacifista: 'Pacifista', militarista: 'Militarista', explorador: 'Explorador', cientifico: 'Científico', diplomatico: 'Diplomático', aislacionista: 'Aislacionista', prudente: 'Prudente' };
export const TYPE_NAMES: Record<KingdomType, string> = { agricola: 'Reino agrícola', montanoso: 'Reino montañoso', maritimo: 'Reino marítimo', forestal: 'Reino forestal', llanuras: 'Reino de las grandes llanuras', desertico: 'Reino del desierto', independiente: 'Pueblo independiente' };
