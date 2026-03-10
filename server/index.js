import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { WebSocketServer } from 'ws';
import Database from 'better-sqlite3';
import { SYSTEMS, COMMODITIES, getConnections } from '../shared/galaxy.js';
import { SHIPS, SHIP_DEALERS, getCargoCapacity, getCargoUsed } from '../shared/ships.js';

const PORT = 3000;
const __dirname = new URL('.', import.meta.url).pathname;
const PUBLIC_DIR = join(__dirname, '..', 'public');
const SHARED_DIR = join(__dirname, '..', 'shared');

// ── Database ──────────────────────────────────────────────

const db = new Database(join(__dirname, '..', 'space-online.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    credits INTEGER DEFAULT 1000,
    system_id TEXT DEFAULT 'sol',
    cargo TEXT DEFAULT '{}',
    ship TEXT DEFAULT 'starter',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS market_prices (
    system_id TEXT,
    commodity_id TEXT,
    price REAL,
    supply INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (system_id, commodity_id)
  );
`);

// Initialize market prices for all systems
const upsertPrice = db.prepare(`
  INSERT OR IGNORE INTO market_prices (system_id, commodity_id, price, supply)
  VALUES (?, ?, ?, ?)
`);

for (const system of SYSTEMS) {
  for (const commodity of COMMODITIES) {
    const modifier = getSystemPriceModifier(system.type, commodity.id);
    const price = Math.round(commodity.basePrice * modifier);
    const supply = Math.floor(50 + Math.random() * 100);
    upsertPrice.run(system.id, commodity.id, price, supply);
  }
}

function getSystemPriceModifier(systemType, commodityId) {
  const modifiers = {
    hub:        { fuel: 1.0, ore: 1.1, electronics: 0.9, weapons: 1.2, food: 0.9, medicine: 0.9, luxuries: 1.0, scrap: 1.1 },
    industrial: { fuel: 0.8, ore: 0.6, electronics: 1.2, weapons: 1.0, food: 1.1, medicine: 1.1, luxuries: 1.5, scrap: 0.7 },
    trade:      { fuel: 1.1, ore: 1.2, electronics: 0.8, weapons: 1.3, food: 0.8, medicine: 0.8, luxuries: 0.7, scrap: 1.2 },
    frontier:   { fuel: 1.3, ore: 0.9, electronics: 1.4, weapons: 0.6, food: 1.3, medicine: 1.3, luxuries: 1.8, scrap: 0.5 },
    military:   { fuel: 0.9, ore: 1.0, electronics: 1.0, weapons: 0.8, food: 1.0, medicine: 0.7, luxuries: 1.4, scrap: 1.0 },
    unknown:    { fuel: 1.5, ore: 0.7, electronics: 1.1, weapons: 1.1, food: 1.5, medicine: 1.5, luxuries: 0.5, scrap: 0.3 },
  };
  return (modifiers[systemType]?.[commodityId] ?? 1.0) * (0.85 + Math.random() * 0.3);
}

// ── Player State ──────────────────────────────────────────

const activePlayers = new Map(); // ws -> player state

function createPlayer(id, name) {
  db.prepare(`INSERT OR IGNORE INTO players (id, name) VALUES (?, ?)`).run(id, name);
  return db.prepare(`SELECT * FROM players WHERE id = ?`).get(id);
}

function savePlayer(player) {
  db.prepare(`
    UPDATE players SET credits = ?, system_id = ?, cargo = ?, ship = ? WHERE id = ?
  `).run(player.credits, player.system_id, JSON.stringify(player.cargo), player.ship, player.id);
}

// ── Market ────────────────────────────────────────────────

function getMarketPrices(systemId) {
  return db.prepare(`SELECT * FROM market_prices WHERE system_id = ?`).all(systemId);
}

function fluctuatePrices() {
  const prices = db.prepare(`SELECT * FROM market_prices`).all();
  const update = db.prepare(`UPDATE market_prices SET price = ?, supply = ? WHERE system_id = ? AND commodity_id = ?`);

  for (const row of prices) {
    const commodity = COMMODITIES.find(c => c.id === row.commodity_id);
    if (!commodity) continue;
    const change = 1 + (Math.random() - 0.5) * commodity.volatility * 0.1;
    const newPrice = Math.max(1, Math.round(row.price * change));
    const supplyChange = Math.floor((Math.random() - 0.45) * 5);
    const newSupply = Math.max(0, row.supply + supplyChange);
    update.run(newPrice, newSupply, row.system_id, row.commodity_id);
  }
}

// Fluctuate prices every 30 seconds
setInterval(fluctuatePrices, 30000);

// ── HTTP Server ───────────────────────────────────────────

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;

  // Only allow alphanumeric, hyphens, underscores, dots, and slashes
  if (!/^[a-zA-Z0-9/_.-]+$/.test(url)) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  let filePath;
  if (url.startsWith('/shared/')) {
    filePath = join(SHARED_DIR, url.slice(8));
  } else {
    filePath = join(PUBLIC_DIR, url.slice(1));
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

// ── WebSocket Server ──────────────────────────────────────

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let player = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'login': {
        const id = msg.playerId || crypto.randomUUID();
        const name = (msg.name || 'Pilot').slice(0, 20);
        const dbPlayer = createPlayer(id, name);
        player = {
          ...dbPlayer,
          cargo: JSON.parse(dbPlayer.cargo || '{}'),
        };
        activePlayers.set(ws, player);

        const loginSys = SYSTEMS.find(s => s.id === player.system_id);
        const dealerShips = (SHIP_DEALERS[loginSys.type] || []).map(id => SHIPS[id]).filter(Boolean);
        send(ws, {
          type: 'login_ok',
          player: sanitizePlayer(player),
          galaxy: { systems: SYSTEMS, connections: getConnections(player.system_id) },
          market: getMarketPrices(player.system_id),
          players: getPlayersInSystem(player.system_id, player.id),
          ships: dealerShips,
        });

        broadcastToSystem(player.system_id, {
          type: 'player_entered',
          player: { id: player.id, name: player.name, ship: player.ship },
        }, ws);
        break;
      }

      case 'jump': {
        if (!player) return;
        const targetId = msg.systemId;
        const connections = getConnections(player.system_id);
        if (!connections.includes(targetId)) {
          send(ws, { type: 'error', message: 'No jump lane to that system.' });
          return;
        }

        broadcastToSystem(player.system_id, {
          type: 'player_left',
          playerId: player.id,
        }, ws);

        player.system_id = targetId;
        savePlayer(player);

        const jumpSys = SYSTEMS.find(s => s.id === targetId);
        const jumpDealerShips = (SHIP_DEALERS[jumpSys.type] || []).map(id => SHIPS[id]).filter(Boolean);
        send(ws, {
          type: 'jumped',
          player: sanitizePlayer(player),
          connections: getConnections(targetId),
          market: getMarketPrices(targetId),
          players: getPlayersInSystem(targetId, player.id),
          ships: jumpDealerShips,
        });

        broadcastToSystem(targetId, {
          type: 'player_entered',
          player: { id: player.id, name: player.name, ship: player.ship },
        }, ws);
        break;
      }

      case 'buy': {
        if (!player) return;
        const { commodityId, quantity } = msg;
        const qty = Math.max(1, Math.min(50, quantity || 1));
        // Cargo capacity check
        const capacity = getCargoCapacity(player.ship);
        const used = getCargoUsed(player.cargo);
        if (used + qty > capacity) {
          send(ws, { type: 'error', message: `Cargo full! ${used}/${capacity} units. Need a bigger ship.` });
          return;
        }
        const priceRow = db.prepare(`SELECT * FROM market_prices WHERE system_id = ? AND commodity_id = ?`)
          .get(player.system_id, commodityId);
        if (!priceRow || priceRow.supply < qty) {
          send(ws, { type: 'error', message: 'Not enough supply.' });
          return;
        }
        const totalCost = priceRow.price * qty;
        if (player.credits < totalCost) {
          send(ws, { type: 'error', message: 'Not enough credits.' });
          return;
        }
        player.credits -= totalCost;
        player.cargo[commodityId] = (player.cargo[commodityId] || 0) + qty;
        db.prepare(`UPDATE market_prices SET supply = supply - ? WHERE system_id = ? AND commodity_id = ?`)
          .run(qty, player.system_id, commodityId);
        savePlayer(player);
        send(ws, {
          type: 'trade_ok',
          action: 'buy',
          player: sanitizePlayer(player),
          market: getMarketPrices(player.system_id),
        });
        break;
      }

      case 'sell': {
        if (!player) return;
        const { commodityId: cid, quantity: q } = msg;
        const sellQty = Math.max(1, Math.min(50, q || 1));
        if (!player.cargo[cid] || player.cargo[cid] < sellQty) {
          send(ws, { type: 'error', message: 'You don\'t have enough to sell.' });
          return;
        }
        const price = db.prepare(`SELECT price FROM market_prices WHERE system_id = ? AND commodity_id = ?`)
          .get(player.system_id, cid);
        if (!price) return;
        player.credits += price.price * sellQty;
        player.cargo[cid] -= sellQty;
        if (player.cargo[cid] <= 0) delete player.cargo[cid];
        db.prepare(`UPDATE market_prices SET supply = supply + ? WHERE system_id = ? AND commodity_id = ?`)
          .run(sellQty, player.system_id, cid);
        savePlayer(player);
        send(ws, {
          type: 'trade_ok',
          action: 'sell',
          player: sanitizePlayer(player),
          market: getMarketPrices(player.system_id),
        });
        break;
      }

      case 'chat': {
        if (!player) return;
        const text = (msg.text || '').slice(0, 200);
        if (!text) return;
        broadcastToSystem(player.system_id, {
          type: 'chat',
          playerId: player.id,
          name: player.name,
          text,
        });
        break;
      }

      case 'get_ships': {
        if (!player) return;
        const sys = SYSTEMS.find(s => s.id === player.system_id);
        const available = (SHIP_DEALERS[sys.type] || [])
          .map(id => SHIPS[id])
          .filter(Boolean);
        send(ws, { type: 'ships_list', ships: available, currentShip: player.ship });
        break;
      }

      case 'buy_ship': {
        if (!player) return;
        const shipId = msg.shipId;
        const ship = SHIPS[shipId];
        if (!ship) {
          send(ws, { type: 'error', message: 'Unknown ship.' });
          return;
        }
        // Check if this system sells this ship
        const sys = SYSTEMS.find(s => s.id === player.system_id);
        const dealerShips = SHIP_DEALERS[sys.type] || [];
        if (!dealerShips.includes(shipId)) {
          send(ws, { type: 'error', message: 'This ship isn\'t sold here.' });
          return;
        }
        if (player.ship === shipId) {
          send(ws, { type: 'error', message: 'You already fly this ship.' });
          return;
        }
        // Trade-in: old ship gives back 50% value
        const oldShip = SHIPS[player.ship];
        const tradeInValue = oldShip ? Math.floor(oldShip.price * 0.5) : 0;
        const finalCost = ship.price - tradeInValue;
        if (player.credits < finalCost) {
          send(ws, { type: 'error', message: `Not enough credits. Need \u00A2${finalCost.toLocaleString()} (after \u00A2${tradeInValue.toLocaleString()} trade-in).` });
          return;
        }
        // Check if cargo fits in new ship
        const currentCargo = getCargoUsed(player.cargo);
        if (currentCargo > ship.stats.cargo) {
          send(ws, { type: 'error', message: `Cargo won't fit! Sell ${currentCargo - ship.stats.cargo} units first.` });
          return;
        }
        player.credits -= finalCost;
        player.ship = shipId;
        savePlayer(player);
        send(ws, {
          type: 'ship_bought',
          player: sanitizePlayer(player),
          ship,
        });
        broadcastToSystem(player.system_id, {
          type: 'player_ship_changed',
          playerId: player.id,
          ship: shipId,
        }, ws);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (player) {
      savePlayer(player);
      broadcastToSystem(player.system_id, {
        type: 'player_left',
        playerId: player.id,
      }, ws);
      activePlayers.delete(ws);
    }
  });
});

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

function sanitizePlayer(p) {
  return { id: p.id, name: p.name, credits: p.credits, system_id: p.system_id, cargo: p.cargo, ship: p.ship };
}

function getPlayersInSystem(systemId, excludeId) {
  const players = [];
  for (const [, p] of activePlayers) {
    if (p.system_id === systemId && p.id !== excludeId) {
      players.push({ id: p.id, name: p.name, ship: p.ship });
    }
  }
  return players;
}

function broadcastToSystem(systemId, data, excludeWs) {
  for (const [ws, p] of activePlayers) {
    if (p.system_id === systemId && ws !== excludeWs) {
      send(ws, data);
    }
  }
}

server.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   SPACE ONLINE — server running      ║`);
  console.log(`  ║   http://localhost:${PORT}              ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
});
