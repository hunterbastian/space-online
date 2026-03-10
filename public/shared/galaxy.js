// Shared galaxy data — used by both server and client
// Node-based star map with jump connections

export const COMMODITIES = [
  { id: 'fuel',        name: 'Fuel Cells',      basePrice: 50,   volatility: 0.2 },
  { id: 'ore',         name: 'Raw Ore',          basePrice: 30,   volatility: 0.3 },
  { id: 'electronics', name: 'Electronics',      basePrice: 120,  volatility: 0.15 },
  { id: 'weapons',     name: 'Weapon Parts',     basePrice: 200,  volatility: 0.25 },
  { id: 'food',        name: 'Ration Packs',     basePrice: 20,   volatility: 0.1 },
  { id: 'medicine',    name: 'Med Supplies',     basePrice: 80,   volatility: 0.2 },
  { id: 'luxuries',    name: 'Luxury Goods',     basePrice: 300,  volatility: 0.4 },
  { id: 'scrap',       name: 'Salvage Scrap',    basePrice: 15,   volatility: 0.35 },
];

export const SYSTEMS = [
  {
    id: 'sol',
    name: 'Sol',
    x: 500, y: 400,
    type: 'hub',
    color: '#f0c040',
    stations: ['Sol Station Alpha'],
    description: 'The cradle of humanity. Busy trade hub.',
  },
  {
    id: 'nova_prime',
    name: 'Nova Prime',
    x: 300, y: 250,
    type: 'industrial',
    color: '#e05030',
    stations: ['Nova Forge', 'Ore Depot'],
    description: 'Industrial powerhouse. Rich in raw materials.',
  },
  {
    id: 'azure',
    name: 'Azure Drift',
    x: 700, y: 300,
    type: 'trade',
    color: '#30a0e0',
    stations: ['Azure Market'],
    description: 'Free trade zone. Best prices on luxury goods.',
  },
  {
    id: 'phantom',
    name: 'Phantom Reach',
    x: 200, y: 500,
    type: 'frontier',
    color: '#a040d0',
    stations: ['Phantom Outpost'],
    description: 'Lawless frontier. Cheap weapons, if you dare.',
  },
  {
    id: 'iron_veil',
    name: 'Iron Veil',
    x: 600, y: 600,
    type: 'military',
    color: '#60d060',
    stations: ['Iron Citadel', 'Patrol Base'],
    description: 'Military stronghold. High security, regulated trade.',
  },
  {
    id: 'drift',
    name: 'Starfall Drift',
    x: 450, y: 150,
    type: 'frontier',
    color: '#d0d0d0',
    stations: ['Starfall Haven'],
    description: 'Remote system. Rumors of rare salvage.',
  },
  {
    id: 'ember',
    name: 'Ember Gate',
    x: 150, y: 300,
    type: 'trade',
    color: '#f08040',
    stations: ['Ember Bazaar'],
    description: 'Crossroads system. A little of everything.',
  },
  {
    id: 'void',
    name: 'The Void',
    x: 800, y: 500,
    type: 'unknown',
    color: '#4060a0',
    stations: ['Derelict Station'],
    description: 'Uncharted space. What lies beyond?',
  },
];

// Jump gate connections (bidirectional)
export const JUMP_LANES = [
  ['sol', 'nova_prime'],
  ['sol', 'azure'],
  ['sol', 'iron_veil'],
  ['sol', 'drift'],
  ['nova_prime', 'ember'],
  ['nova_prime', 'phantom'],
  ['azure', 'iron_veil'],
  ['azure', 'void'],
  ['phantom', 'ember'],
  ['iron_veil', 'void'],
  ['drift', 'azure'],
  ['drift', 'ember'],
];

// Get systems connected to a given system
export function getConnections(systemId) {
  const connections = [];
  for (const [a, b] of JUMP_LANES) {
    if (a === systemId) connections.push(b);
    if (b === systemId) connections.push(a);
  }
  return connections;
}
