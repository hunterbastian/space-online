import { useState, useRef } from 'react';
import { SYSTEMS, getConnections, COMMODITIES } from '../../shared/galaxy.js';
import { SHIPS, MANUFACTURERS, RARITY_COLORS, getCargoCapacity, getCargoUsed } from '../../shared/ships.js';
import { jumpTo, buyCommodity, sellCommodity, buyShip, sendChat, getCurrentSystem, getAvailableShips, getSystemMarket } from '../store';
import GalaxyView from './GalaxyView';
import FlightView from './FlightView';

export default function GameScreen({ state }) {
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'flight'
  const { player, chatMessages } = state;
  const currentSystem = getCurrentSystem();
  const shipData = SHIPS[player.ship];
  const market = getSystemMarket();
  const availableShips = getAvailableShips();
  const connections = getConnections(player.system_id);
  const capacity = getCargoCapacity(player.ship);
  const used = getCargoUsed(player.cargo);

  // Flight mode — full screen 3D
  if (viewMode === 'flight') {
    return <FlightView player={player} onExit={() => setViewMode('map')} />;
  }

  return (
    <div className="game-screen">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="logo">SPACE ONLINE</div>
        <div className="player-info">
          <div><span>PILOT:</span> <strong>{player.name}</strong></div>
          <div><span>CREDITS:</span> <strong>&cent;{player.credits.toLocaleString()}</strong></div>
          <div><span>SYSTEM:</span> <strong>{currentSystem.name}</strong></div>
          <div><span>SHIP:</span> <strong>{shipData?.name || player.ship}</strong></div>
        </div>
      </div>

      {/* Left Panel: Navigation */}
      <div className="panel">
        <div className="panel-title">NAVIGATION</div>
        <SystemInfo system={currentSystem} />

        <button
          onClick={() => setViewMode('flight')}
          style={{
            display: 'block', width: '100%', padding: '10px', marginBottom: 12,
            background: 'var(--accent)', color: '#000', border: '3px solid #000',
            fontFamily: "'Bangers', cursive", fontSize: 18, letterSpacing: 3,
            cursor: 'pointer', borderRadius: 3, boxShadow: '2px 2px 0 #000',
          }}
        >
          UNDOCK &amp; FLY
        </button>

        <div className="panel-title">JUMP GATES</div>
        {connections.map(id => {
          const sys = SYSTEMS.find(s => s.id === id);
          return (
            <button key={id} className="system-btn" onClick={() => jumpTo(id)}>
              <div className="sys-name" style={{ color: sys.color }}>{sys.name}</div>
              <div className="sys-type">{sys.type}</div>
            </button>
          );
        })}

        <div className="panel-title">PILOTS IN SYSTEM</div>
        <div className="dim">No other pilots</div>
      </div>

      {/* Center: 3D Viewport */}
      <div className="viewport">
        <GalaxyView player={player} currentSystem={currentSystem} />
      </div>

      {/* Right Panel: Market, Cargo, Ships */}
      <div className="panel right">
        <div className="panel-title">STATION MARKET</div>
        {COMMODITIES.map(c => {
          const row = market[c.id];
          if (!row) return null;
          return (
            <div key={c.id} className="market-row">
              <div>
                <div className="commodity-name">{c.name}</div>
                <div className="supply">Supply: {row.supply}</div>
              </div>
              <div className="price">&cent;{Math.round(row.price)}</div>
              <div className="trade-btns">
                <button className="trade-btn buy" onClick={() => buyCommodity(c.id)}>BUY</button>
                <button className="trade-btn sell" onClick={() => sellCommodity(c.id)}>SELL</button>
              </div>
            </div>
          );
        })}

        <div className="panel-title">CARGO HOLD</div>
        <CargoSection cargo={player.cargo} capacity={capacity} used={used} />

        <div className="panel-title">SHIP DEALER</div>
        <ShipDealer ships={availableShips} currentShip={player.ship} />
      </div>

      {/* Bottom: Chat */}
      <ChatBar messages={chatMessages} />
    </div>
  );
}

function SystemInfo({ system }) {
  return (
    <div className="panel-section" style={{ padding: '8px 6px' }}>
      <div style={{ fontWeight: 600, color: system.color, fontSize: 15 }}>{system.name}</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' }}>{system.type}</div>
      <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>{system.description}</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>Stations: {system.stations.join(', ')}</div>
    </div>
  );
}

function CargoSection({ cargo, capacity, used }) {
  const pct = Math.min(100, (used / capacity) * 100);
  const barColor = pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--accent)' : 'var(--success)';
  const entries = Object.entries(cargo).filter(([, q]) => q > 0);

  return (
    <div>
      <div style={{ padding: '4px 6px', marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
          <span style={{ color: 'var(--text-dim)' }}>Capacity</span>
          <span>{used} / {capacity}</span>
        </div>
        <div className="cargo-bar">
          <div className="cargo-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
        </div>
      </div>
      {entries.length === 0
        ? <div className="dim">Empty</div>
        : entries.map(([id, qty]) => {
            const c = COMMODITIES.find(c => c.id === id);
            return (
              <div key={id} className="cargo-row">
                <span>{c?.name || id}</span>
                <span className="qty">x{qty}</span>
              </div>
            );
          })
      }
    </div>
  );
}

function ShipDealer({ ships, currentShip }) {
  if (ships.length === 0) return <div className="dim">No ships for sale here</div>;

  const maxCargo = 200, maxHull = 300, maxFirepower = 60;
  const oldShip = SHIPS[currentShip];
  const tradeIn = oldShip ? Math.floor(oldShip.price * 0.5) : 0;

  return ships.map(ship => {
    const isEquipped = currentShip === ship.id;
    const mfr = MANUFACTURERS[ship.manufacturer];
    const rarityColor = RARITY_COLORS[ship.rarity] || '#9a9a9a';
    const finalCost = ship.price - tradeIn;

    const stats = [
      { label: 'Cargo', value: ship.stats.cargo, max: maxCargo, color: '#40a0f0' },
      { label: 'Speed', value: Math.round((1 / ship.stats.speed) * 50), max: 100, color: '#a040d0' },
      { label: 'Hull', value: ship.stats.hull, max: maxHull, color: '#50d060' },
      { label: 'Power', value: ship.stats.firepower, max: maxFirepower, color: '#e05040' },
    ];

    return (
      <div key={ship.id} className={`ship-card${isEquipped ? ' equipped' : ''}`}>
        <div className="ship-header">
          <div className="ship-name" style={{ color: mfr.color }}>{ship.name}</div>
          <div className="ship-rarity" style={{ color: rarityColor, borderColor: rarityColor }}>{ship.rarity}</div>
        </div>
        <div className="ship-manufacturer">{mfr.name}</div>
        <div className="ship-desc">{ship.description}</div>

        {stats.map(s => (
          <div key={s.label} className="stat-bar-row">
            <div className="stat-label">{s.label}</div>
            <div className="stat-bar">
              <div className="stat-bar-fill" style={{ width: `${Math.min(100, (s.value / s.max) * 100)}%`, background: s.color }} />
            </div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}

        <div className="ship-footer">
          {isEquipped ? (
            <>
              <div className="ship-price" style={{ color: 'var(--accent)' }}>EQUIPPED</div>
              <button className="buy-ship-btn equipped-label">CURRENT</button>
            </>
          ) : (
            <>
              <div className="ship-price">
                <span style={{ color: 'var(--accent)' }}>&cent;{finalCost.toLocaleString()}</span>
                {tradeIn > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: "'Geist', sans-serif", letterSpacing: 0 }}>
                    (&cent;{tradeIn.toLocaleString()} trade-in)
                  </div>
                )}
              </div>
              <button className="buy-ship-btn" onClick={() => buyShip(ship.id)}>BUY</button>
            </>
          )}
        </div>
      </div>
    );
  });
}

function ChatBar({ messages }) {
  const [input, setInput] = useState('');
  const logRef = useRef(null);

  const handleSend = () => {
    if (input.trim()) {
      sendChat(input.trim());
      setInput('');
    }
  };

  return (
    <div className="bottom-bar">
      <div className="chat-log" ref={logRef}>
        {messages.map((m, i) => (
          <div key={i} className="msg">
            <span className="sender">{m.name}:</span> {m.text}
          </div>
        ))}
      </div>
      <input
        className="chat-input"
        type="text"
        placeholder="Chat..."
        maxLength={200}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSend()}
      />
    </div>
  );
}
