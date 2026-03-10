import { useRef, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { SYSTEMS, getConnections } from '../../shared/galaxy.js';
import { SHIPS, MANUFACTURERS } from '../../shared/ships.js';

// ── Input Manager ─────────────────────────────

const keys = {};
const mouse = { x: 0, y: 0, locked: false };

function setupInput(canvas) {
  const onKeyDown = (e) => { keys[e.code] = true; };
  const onKeyUp = (e) => { keys[e.code] = false; };
  const onMouseMove = (e) => {
    if (!document.pointerLockElement) return;
    mouse.x += e.movementX * 0.002;
    mouse.y += e.movementY * 0.002;
    mouse.y = Math.max(-1.2, Math.min(1.2, mouse.y));
  };
  const onClick = () => {
    if (!document.pointerLockElement) {
      canvas.requestPointerLock();
    }
  };
  const onLockChange = () => {
    mouse.locked = !!document.pointerLockElement;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onClick);
  document.addEventListener('pointerlockchange', onLockChange);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('click', onClick);
    document.removeEventListener('pointerlockchange', onLockChange);
  };
}

// ── Ship Hulls (inline for flight view) ───────

function ShipHull({ manufacturer }) {
  switch (manufacturer) {
    case 'vektron':
      return (
        <group>
          <mesh><boxGeometry args={[0.6, 0.2, 0.35]} /><meshStandardMaterial color="#d07030" roughness={0.6} metalness={0.3} /></mesh>
          <mesh position={[0, -0.1, 0.22]}><boxGeometry args={[0.35, 0.1, 0.12]} /><meshStandardMaterial color="#a05020" /></mesh>
          <mesh position={[0, -0.1, -0.22]}><boxGeometry args={[0.35, 0.1, 0.12]} /><meshStandardMaterial color="#a05020" /></mesh>
          <mesh position={[0.18, 0.13, 0]}><boxGeometry args={[0.12, 0.08, 0.12]} /><meshStandardMaterial color="#f0a050" emissive="#f0a050" emissiveIntensity={0.3} /></mesh>
          <mesh position={[-0.35, 0, 0.08]}><sphereGeometry args={[0.04, 8, 8]} /><meshBasicMaterial color="#ff6030" /></mesh>
          <mesh position={[-0.35, 0, -0.08]}><sphereGeometry args={[0.04, 8, 8]} /><meshBasicMaterial color="#ff6030" /></mesh>
        </group>
      );
    case 'astra':
      return (
        <group>
          <mesh rotation={[0, 0, Math.PI / 4]}><cylinderGeometry args={[0.01, 0.18, 0.65, 4]} /><meshStandardMaterial color="#3090d0" roughness={0.3} metalness={0.5} /></mesh>
          <mesh position={[0, 0, 0.18]} rotation={[0, 0, 0.1]}><boxGeometry args={[0.35, 0.02, 0.22]} /><meshStandardMaterial color="#2080c0" /></mesh>
          <mesh position={[0, 0, -0.18]} rotation={[0, 0, -0.1]}><boxGeometry args={[0.35, 0.02, 0.22]} /><meshStandardMaterial color="#2080c0" /></mesh>
          <mesh position={[0.28, 0.04, 0]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#60c0ff" emissive="#60c0ff" emissiveIntensity={0.4} transparent opacity={0.8} /></mesh>
          <mesh position={[-0.35, 0, 0]}><sphereGeometry args={[0.04, 8, 8]} /><meshBasicMaterial color="#40a0ff" /></mesh>
        </group>
      );
    case 'phantom':
      return (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.16, 0.65, 3]} /><meshStandardMaterial color="#8030b0" roughness={0.2} metalness={0.6} /></mesh>
          <mesh position={[-0.08, 0.1, 0]}><boxGeometry args={[0.2, 0.12, 0.015]} /><meshStandardMaterial color="#6020a0" /></mesh>
          <mesh position={[0.18, 0.02, 0]}><boxGeometry args={[0.12, 0.02, 0.08]} /><meshStandardMaterial color="#d060ff" emissive="#d060ff" emissiveIntensity={0.5} /></mesh>
          <mesh position={[-0.3, 0, 0.06]}><sphereGeometry args={[0.03, 6, 6]} /><meshBasicMaterial color="#c040ff" /></mesh>
          <mesh position={[-0.3, 0, -0.06]}><sphereGeometry args={[0.03, 6, 6]} /><meshBasicMaterial color="#c040ff" /></mesh>
        </group>
      );
    case 'ironclad':
      return (
        <group>
          <mesh><boxGeometry args={[0.6, 0.25, 0.4]} /><meshStandardMaterial color="#408040" roughness={0.7} metalness={0.4} /></mesh>
          <mesh position={[0, 0.16, 0]}><boxGeometry args={[0.45, 0.04, 0.3]} /><meshStandardMaterial color="#306030" /></mesh>
          <mesh position={[0.08, 0.2, 0]}><cylinderGeometry args={[0.04, 0.06, 0.08, 6]} /><meshStandardMaterial color="#508050" /></mesh>
          <mesh position={[0.25, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.015, 0.015, 0.25, 4]} /><meshStandardMaterial color="#303030" metalness={0.8} /></mesh>
          <mesh position={[-0.35, 0, 0]}><sphereGeometry args={[0.06, 8, 8]} /><meshBasicMaterial color="#40ff60" /></mesh>
        </group>
      );
    default: // drift
      return (
        <group>
          <mesh><torusGeometry args={[0.22, 0.07, 8, 16]} /><meshStandardMaterial color="#b0b0b0" roughness={0.2} metalness={0.7} /></mesh>
          <mesh><sphereGeometry args={[0.1, 12, 12]} /><meshStandardMaterial color="#e0e0e0" emissive="#8080ff" emissiveIntensity={0.4} /></mesh>
          <mesh><sphereGeometry args={[0.06, 8, 8]} /><meshBasicMaterial color="#a0a0ff" transparent opacity={0.6} /></mesh>
        </group>
      );
  }
}

// ── Engine Trail ──────────────────────────────

function EngineTrail({ shipRef, color }) {
  const trailRef = useRef();
  const positions = useMemo(() => new Float32Array(60 * 3), []);
  const trailPoints = useRef([]);

  useFrame(() => {
    if (!shipRef.current || !trailRef.current) return;
    const pos = new THREE.Vector3();
    shipRef.current.getWorldPosition(pos);

    trailPoints.current.push(pos.clone());
    if (trailPoints.current.length > 60) trailPoints.current.shift();

    const geo = trailRef.current.geometry;
    const arr = geo.attributes.position.array;
    for (let i = 0; i < 60; i++) {
      const p = trailPoints.current[i] || trailPoints.current[trailPoints.current.length - 1] || pos;
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    geo.attributes.position.needsUpdate = true;
  });

  return (
    <line ref={trailRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={60} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={0.4} />
    </line>
  );
}

// ── Player Ship Controller ────────────────────

function PlayerShipController({ ship, onDock }) {
  const shipRef = useRef();
  const velocityRef = useRef(new THREE.Vector3());
  const rotationRef = useRef(new THREE.Euler(0, 0, 0));
  const { camera } = useThree();

  const speed = useMemo(() => {
    const baseSpeed = 2.0;
    return baseSpeed / (ship.stats.speed || 1);
  }, [ship]);

  const mfrColor = MANUFACTURERS[ship.manufacturer]?.color || '#ffffff';

  useFrame((_, delta) => {
    if (!shipRef.current) return;
    const dt = Math.min(delta, 0.05);

    // Rotation from mouse
    const targetYaw = -mouse.x;
    const targetPitch = -mouse.y;
    rotationRef.current.y = targetYaw;
    rotationRef.current.x = targetPitch;

    const quat = new THREE.Quaternion().setFromEuler(rotationRef.current);
    shipRef.current.quaternion.slerp(quat, 5 * dt);

    // Movement
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(shipRef.current.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(shipRef.current.quaternion);
    const up = new THREE.Vector3(0, 1, 0);

    const thrust = new THREE.Vector3();
    const boost = keys['ShiftLeft'] || keys['ShiftRight'] ? 2.5 : 1;

    if (keys['KeyW'] || keys['ArrowUp']) thrust.add(forward);
    if (keys['KeyS'] || keys['ArrowDown']) thrust.sub(forward);
    if (keys['KeyA'] || keys['ArrowLeft']) thrust.sub(right);
    if (keys['KeyD'] || keys['ArrowRight']) thrust.add(right);
    if (keys['Space']) thrust.add(up);
    if (keys['ControlLeft']) thrust.sub(up);

    if (thrust.length() > 0) {
      thrust.normalize().multiplyScalar(speed * boost * dt);
      velocityRef.current.add(thrust);
    }

    // Drag
    velocityRef.current.multiplyScalar(0.96);

    // Apply velocity
    shipRef.current.position.add(velocityRef.current);

    // Camera follows behind ship
    const cameraOffset = new THREE.Vector3(0, 0.5, 2).applyQuaternion(shipRef.current.quaternion);
    const targetCamPos = shipRef.current.position.clone().add(cameraOffset);
    camera.position.lerp(targetCamPos, 4 * dt);
    camera.lookAt(shipRef.current.position);
  });

  return (
    <>
      <group ref={shipRef} position={[0, 0, 0]}>
        <ShipHull manufacturer={ship.manufacturer} />
      </group>
      <EngineTrail shipRef={shipRef} color={mfrColor} />
    </>
  );
}

// ── Space Station ─────────────────────────────

function SpaceStation({ position, name, color, onApproach }) {
  const ref = useRef();
  const ringRef = useRef();

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.1;
    if (ringRef.current) ringRef.current.rotation.x += delta * 0.15;
  });

  return (
    <group position={position}>
      {/* Station body */}
      <group ref={ref}>
        <mesh>
          <cylinderGeometry args={[0.4, 0.4, 1.2, 8]} />
          <meshStandardMaterial color="#333340" roughness={0.7} metalness={0.5} />
        </mesh>
        {/* Hab modules */}
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a, i) => (
          <mesh key={i} position={[Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55]}>
            <boxGeometry args={[0.25, 0.5, 0.15]} />
            <meshStandardMaterial color="#444455" roughness={0.6} />
          </mesh>
        ))}
        {/* Lights */}
        <pointLight position={[0, 0.8, 0]} color={color} intensity={2} distance={5} />
      </group>
      {/* Docking ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.8, 0.03, 8, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      {/* Label */}
      <Billboard position={[0, 1.2, 0]}>
        <Text fontSize={0.2} color={color} outlineWidth={0.01} outlineColor="#000000" anchorX="center">
          {name}
        </Text>
        <Text fontSize={0.1} color="#888888" outlineWidth={0.005} outlineColor="#000000" anchorX="center" position={[0, -0.2, 0]}>
          [DOCK: press F]
        </Text>
      </Billboard>
    </group>
  );
}

// ── Planet ────────────────────────────────────

function Planet({ position, radius, color, name }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.05;
  });

  return (
    <group position={position}>
      {/* Black outline */}
      <mesh>
        <sphereGeometry args={[radius + 0.05, 24, 24]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh ref={ref}>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} />
      </mesh>
      {/* Atmosphere */}
      <mesh>
        <sphereGeometry args={[radius + 0.08, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      <Billboard position={[0, radius + 0.4, 0]}>
        <Text fontSize={0.15} color="#666666" outlineWidth={0.005} outlineColor="#000000" anchorX="center">
          {name}
        </Text>
      </Billboard>
    </group>
  );
}

// ── Asteroid Field ────────────────────────────

function AsteroidField({ center, count = 30, radius = 8 }) {
  const asteroids = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const r = radius + (Math.random() - 0.5) * 3;
      const y = (Math.random() - 0.5) * 2;
      return {
        pos: [center[0] + Math.cos(angle) * r, center[1] + y, center[2] + Math.sin(angle) * r],
        scale: 0.05 + Math.random() * 0.15,
        rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0],
        speed: 0.1 + Math.random() * 0.3,
      };
    });
  }, [center, count, radius]);

  return asteroids.map((a, i) => (
    <AsteroidRock key={i} {...a} />
  ));
}

function AsteroidRock({ pos, scale, rotation, speed }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x += delta * speed;
      ref.current.rotation.z += delta * speed * 0.7;
    }
  });

  return (
    <group position={pos}>
      <mesh>
        <dodecahedronGeometry args={[scale + 0.02, 0]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh ref={ref} rotation={rotation}>
        <dodecahedronGeometry args={[scale, 1]} />
        <meshStandardMaterial color="#5a5040" roughness={0.9} metalness={0.2} />
      </mesh>
    </group>
  );
}

// ── Space Dust Particles ──────────────────────

function SpaceDust({ count = 300 }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 40;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    return arr;
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#c8c0aa" transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

// ── HUD Overlay ───────────────────────────────

function FlightHUD({ ship, speed, onExit }) {
  const mfr = MANUFACTURERS[ship.manufacturer];
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
      fontFamily: "'Geist', sans-serif",
    }}>
      {/* Crosshair */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 24, height: 24, border: '2px solid rgba(240,192,64,0.5)', borderRadius: '50%',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 4, height: 4, background: '#f0c040', borderRadius: '50%',
        }} />
      </div>

      {/* Ship info bottom-left */}
      <div style={{
        position: 'absolute', bottom: 60, left: 20, pointerEvents: 'auto',
        background: 'rgba(15,15,25,0.85)', border: '2px solid rgba(240,192,64,0.3)',
        padding: '12px 16px', borderRadius: 4,
      }}>
        <div style={{ fontFamily: "'Bangers', cursive", fontSize: 18, color: mfr?.color || '#fff', letterSpacing: 2 }}>
          {ship.name}
        </div>
        <div style={{ fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: 1 }}>
          {mfr?.name}
        </div>
      </div>

      {/* Controls hint bottom-right */}
      <div style={{
        position: 'absolute', bottom: 60, right: 20,
        background: 'rgba(15,15,25,0.85)', border: '2px solid rgba(240,192,64,0.3)',
        padding: '10px 14px', borderRadius: 4, fontSize: 11, color: '#8a8070', lineHeight: 1.6,
      }}>
        <div><strong style={{ color: '#e8e0d0' }}>WASD</strong> — Fly</div>
        <div><strong style={{ color: '#e8e0d0' }}>MOUSE</strong> — Look</div>
        <div><strong style={{ color: '#e8e0d0' }}>SHIFT</strong> — Boost</div>
        <div><strong style={{ color: '#e8e0d0' }}>SPACE/CTRL</strong> — Up/Down</div>
        <div><strong style={{ color: '#e8e0d0' }}>F</strong> — Dock at station</div>
        <div><strong style={{ color: '#e8e0d0' }}>M</strong> — Galaxy map</div>
      </div>

      {/* Map button top-right */}
      <button onClick={onExit} style={{
        position: 'absolute', top: 12, right: 20, pointerEvents: 'auto',
        padding: '8px 20px', background: '#f0c040', color: '#000', border: '2px solid #000',
        fontFamily: "'Bangers', cursive", fontSize: 14, letterSpacing: 2, cursor: 'pointer',
        borderRadius: 3, boxShadow: '2px 2px 0 #000',
      }}>
        GALAXY MAP [M]
      </button>

      {/* Click to fly prompt */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        fontSize: 12, color: 'rgba(240,192,64,0.6)', letterSpacing: 1,
      }}>
        CLICK TO FLY
      </div>
    </div>
  );
}

// ── Generate system environment ───────────────

function useSystemEnvironment(systemId) {
  return useMemo(() => {
    const sys = SYSTEMS.find(s => s.id === systemId);
    if (!sys) return { station: null, planets: [], asteroids: false };

    // Seed random from system id for consistency
    const seed = sys.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = (i) => {
      const x = Math.sin(seed * 9301 + i * 49297) * 49297;
      return x - Math.floor(x);
    };

    const station = {
      position: [3 + rand(1) * 2, rand(2) - 0.5, -2 + rand(3) * 4],
      name: sys.stations[0] || 'Station',
    };

    const planetCount = 1 + Math.floor(rand(4) * 3);
    const planets = Array.from({ length: planetCount }, (_, i) => ({
      position: [
        (rand(10 + i) - 0.5) * 25,
        (rand(20 + i) - 0.5) * 4,
        (rand(30 + i) - 0.5) * 25,
      ],
      radius: 0.8 + rand(40 + i) * 2,
      color: ['#6a4a3a', '#3a5a7a', '#5a6a4a', '#7a5a6a', '#4a6a6a'][i % 5],
      name: `${sys.name} ${['I', 'II', 'III', 'IV'][i]}`,
    }));

    const hasAsteroids = sys.type === 'industrial' || sys.type === 'frontier' || sys.type === 'unknown';

    return { station, planets, hasAsteroids, color: sys.color };
  }, [systemId]);
}

// ── Flight Scene ──────────────────────────────

function FlightScene({ ship, systemId, onDock }) {
  const { gl } = useThree();
  const env = useSystemEnvironment(systemId);

  useEffect(() => {
    const cleanup = setupInput(gl.domElement);
    return cleanup;
  }, [gl]);

  // M key to exit
  useEffect(() => {
    // handled by parent via onExit
  }, []);

  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 10, 5]} intensity={1} color="#ffe8d0" />
      <pointLight position={[-10, -5, -10]} intensity={0.3} color="#4060a0" />

      <SpaceDust count={400} />

      {/* Sun/Star */}
      <mesh position={[30, 15, -20]}>
        <sphereGeometry args={[3, 16, 16]} />
        <meshBasicMaterial color={env.color || '#f0c040'} />
      </mesh>
      <pointLight position={[30, 15, -20]} intensity={3} color={env.color || '#f0c040'} distance={100} />

      {/* Station */}
      {env.station && (
        <SpaceStation
          position={env.station.position}
          name={env.station.name}
          color={env.color || '#f0c040'}
        />
      )}

      {/* Planets */}
      {env.planets.map((p, i) => (
        <Planet key={i} {...p} />
      ))}

      {/* Asteroid field */}
      {env.hasAsteroids && (
        <AsteroidField center={[0, 0, 0]} count={40} radius={12} />
      )}

      {/* Player ship */}
      <PlayerShipController ship={ship} onDock={onDock} />

      <fog attach="fog" args={['#06060c', 5, 60]} />
    </>
  );
}

// ── Main Export ───────────────────────────────

export default function FlightView({ player, onExit }) {
  const ship = SHIPS[player.ship];
  if (!ship) return null;

  // M key handler
  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'KeyM') {
        document.exitPointerLock?.();
        onExit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onExit]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ fov: 65, near: 0.01, far: 200, position: [0, 1, 3] }}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#06060c');
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
        }}
      >
        <FlightScene ship={ship} systemId={player.system_id} />
      </Canvas>
      <FlightHUD ship={ship} onExit={onExit} />
    </div>
  );
}
