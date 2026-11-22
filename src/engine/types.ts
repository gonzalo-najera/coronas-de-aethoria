// Modelo de datos persistente de Coronas de Aethoria.
export type SpeciesId = 'humano' | 'fauno' | 'minotauro' | 'centauro' | 'gigante' | 'enano' | 'elfo';
export type ResId = 'oro' | 'alimentos' | 'madera' | 'piedra' | 'hierro' | 'herramientas' | 'armas' | 'investigacion' | 'prestigio';
export type Biome = 'oceano' | 'mar' | 'lago' | 'llanura' | 'pradera' | 'estepa' | 'bosque' | 'taiga' | 'selva' | 'desierto' | 'tundra' | 'colinas' | 'montana' | 'nieve' | 'pantano';
export type DepositId = 'hierro' | 'oro' | 'plata' | 'gemas' | 'sal' | 'especias' | 'caballos' | 'plantas' | 'cobre';
export type Climate = 'frio' | 'templado' | 'calido' | 'arido' | 'tropical';
export type KingdomType = 'agricola' | 'montanoso' | 'maritimo' | 'forestal' | 'llanuras' | 'desertico' | 'independiente';
export type Personality = 'expansionista' | 'comercial' | 'pacifista' | 'militarista' | 'explorador' | 'cientifico' | 'diplomatico' | 'aislacionista' | 'prudente';
export type Breakdown = { label: string; value: number }[];

export interface Deposit { kind: DepositId; hidden: boolean; }

export interface ProvStatic {
  id: number; name: string; cells: number[]; area: number; cx: number; cy: number;
  city: number; // índice de celda de la capital provincial
  biome: Biome; mix: Partial<Record<Biome, number>>; neighbors: number[]; seas: number[];
  coastal: boolean; river: boolean; fertility: number; elevation: number; climate: Climate; hemisphere: 'N' | 'S';
  deposits: Deposit[]; continent: number; strategic: string[]; ruins: boolean;
  sites: { mine: number; forest: number; farm: number; port: number; quarry: number; tower: number };
  moveCost: number; defense: number;
}
export interface SeaStatic { id: number; name: string; cells: number[]; cx: number; cy: number; deep: boolean; neighbors: number[]; provinces: number[]; }
export interface Continent { id: number; name: string; cx: number; cy: number; }

export interface Character {
  id: number; name: string; species: SpeciesId; age: number; health: number;
  diplomacia: number; administracion: number; liderazgo: number; estrategia: number; inteligencia: number; carisma: number;
  trait: string; seed: number; loyalty: number; ambition: number; exp: number;
}

export interface Relation {
  a: number; b: number; contact: boolean; opinion: number; trust: number; tension: number;
  alliance: boolean; nap: boolean; trade: boolean; mapsShared: boolean; war: boolean; warStart: number; warScore: number;
  giftBonus: number; lastProposal: number; protectorate: number; // -1 o id del protector
}

export interface QueueItem { b: string; monthsLeft: number; total: number; }
export interface ProvState {
  id: number; owner: number; occupier: number; pop: number; species: Record<SpeciesId, number>;
  buildings: Record<string, number>; queue: QueueItem[]; stability: number; prosperity: number; control: number;
  cityName: string; unrest: number; siege: { by: number; progress: number; months: number } | null;
  mobilized: number; conqueredTurn: number; colonizing: { by: number; monthsLeft: number; kind: string; name: string; settlers: number } | null;
  revealedDeposits: number[]; lowStabMonths: number; plague: number;
}

export interface Kingdom {
  id: number; name: string; short: string; color: string; color2: string; type: KingdomType; independent: boolean;
  personality: Personality; capital: number; ruler: Character; heir: Character | null; regency: boolean;
  council: Record<string, Character>;
  stock: Record<ResId, number>; legitimacy: number;
  research: { current: string | null; progress: number }; techs: string[];
  laws: { impuestos: number; reclutamiento: number; integracion: number };
  known: number[]; seaKnown: number[]; lastOwner: number[]; lastSeen: number[];
  alive: boolean; warExhaustion: number; heraldry: { shape: number; charge: number };
  market: { min: Partial<Record<ResId, number>>; max: Partial<Record<ResId, number>> };
  aiTimer: number; dynasty: string;
}

// tier: nivel de equipo 0..4 (Obsoleto..De élite; ausente = Estándar). train: meses de instrucción pendientes.
// amm: fracción de munición disponible (ausente = completa). rid: regimiento al que pertenece.
export interface Unit { type: string; men: number; exp: number; tier?: number; train?: number; amm?: number; rid?: number; }
export interface Regiment {
  id: number; owner: number; name: string; banner: number; founded: number; type: string; active: boolean;
  battles: number; wins: number; losses: number; casualties: number; decorations: string[]; commanders: string[];
  history: { turn: number; text: string }[];
}
export interface Army {
  id: number; owner: number; name: string; prov: number; units: Unit[]; wounded: Record<string, number>;
  path: number[]; progress: number; supply: number; morale: number; general: Character | null;
  lastBattle: number; retreating: boolean; sieging: boolean;
}

export interface RegionRef { t: 'p' | 's'; id: number; }
export interface Expedition {
  id: number; owner: number; name: string; kind: 'terrestre' | 'maritima' | 'oceanica'; leader: Character;
  members: number; startMembers: number; supplies: number; startSupplies: number; escort: number; dir: 'N' | 'S' | 'E' | 'O';
  risk: number; loc: RegionRef; route: RegionRef[]; home: number; months: number; maxMonths: number;
  state: 'activa' | 'regreso' | 'terminada' | 'perdida'; found: string[]; discovered: number; discoveredSeas: number; contacts: number[];
  log: { turn: number; text: string }[]; losses: number; ruinsFound: number; opportunities: number[];
}

export interface ChronEntry { turn: number; kingdom: number; kind: string; text: string; important: boolean; }
export interface Alert { id: number; turn: number; level: 'critica' | 'importante' | 'info' | 'completado' | 'consejo' | 'internacional'; text: string; read: boolean; focus?: { prov?: number; army?: number; exp?: number }; }
export interface GameEventChoice { label: string; effects: string; }
export interface GameEventInst { id: number; kind: string; title: string; text: string; prov: number; choices: GameEventChoice[]; turn: number; data?: any; }

export interface GameState {
  version: number; seed: number; worldHash: string; rng: number; turn: number; startYear: number;
  playerId: number; difficulty: number; gameName: string;
  kingdoms: Kingdom[]; provinces: ProvState[]; armies: Army[]; expeditions: Expedition[];
  relations: Record<string, Relation>; chronicle: ChronEntry[]; alerts: Alert[]; events: GameEventInst[];
  pendingBattles: any[]; battleReports: any[]; expReports: number[];
  nextId: number; history: { turn: number; oro: number; alimentos: number; pop: number; investigacion: number }[];
  stats: { battlesWon: number; battlesLost: number; maxArmy: number; founded: number; discovered: number; rulers: string[] };
  autoPause: boolean;
  regiments: Regiment[];
}
