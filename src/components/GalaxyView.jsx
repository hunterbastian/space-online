import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { SYSTEMS, JUMP_LANES, getConnections } from '../../shared/galaxy.js';
import PlayerShip from './ShipModel';

// Scale galaxy coordinates into 3D space
const SCALE = 0.01;
const sysPos = (sys) => [
  (sys.x - 500) * SCALE,
  (Math.random() * 60 - 30) * SCALE, // slight Y variation for depth
  (sys.y - 400) * SCALE,
];

// Precompute stable positions
const systemPositions = {};
for (const sys of SYSTEMS) {
  // Use a seeded-ish offset based on system id for consistent Y
  const hash = sys.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  systemPositions[sys.id] = [
    (sys.x - 500) * SCALE,
    ((hash % 60) - 30) * SCALE,
    (sys.y - 400) * SCALE,
  ];
}

function Starfield({ count = 500 }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return arr;
  }, [count]);

  const sizes = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) arr[i] = Math.random() * 0.02 + 0.005;
    return arr;
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
        <bufferAttribute attach="attributes-size" array={sizes} count={count} itemSize={1} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#c8c0aa" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

function JumpLane({ from, to, isActive }) {
  const points = useMemo(() => [
    new THREE.Vector3(...from),
    new THREE.Vector3(...to),
  ], [from, to]);

  return (
    <>
      {/* Outer black outline */}
      <Line
        points={points}
        color="#000000"
        lineWidth={4}
      />
      {/* Inner colored line */}
      <Line
        points={points}
        color={isActive ? '#f0c040' : '#3a3528'}
        lineWidth={isActive ? 2 : 1}
        dashed
        dashSize={0.05}
        gapSize={0.03}
        transparent
        opacity={isActive ? 0.7 : 0.3}
      />
    </>
  );
}

function SystemNode({ system, isCurrent, isReachable, onClick }) {
  const meshRef = useRef();
  const glowRef = useRef();
  const outlineRef = useRef();
  const baseSize = isCurrent ? 0.06 : 0.04;

  useFrame((_, delta) => {
    if (meshRef.current && isCurrent) {
      const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.15;
      meshRef.current.scale.setScalar(pulse);
      if (outlineRef.current) outlineRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current) {
      glowRef.current.rotation.z += delta * 0.3;
    }
  });

  const color = new THREE.Color(system.color);
  const pos = systemPositions[system.id];

  return (
    <group position={pos} onClick={onClick}>
      {/* Glow sprite */}
      {(isCurrent || isReachable) && (
        <sprite ref={glowRef} scale={[0.3, 0.3, 0.3]}>
          <spriteMaterial
            color={system.color}
            transparent
            opacity={isCurrent ? 0.3 : 0.15}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      )}

      {/* Black outline sphere */}
      <mesh ref={outlineRef}>
        <sphereGeometry args={[baseSize + 0.012, 16, 16]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Main sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[baseSize, 16, 16]} />
        <meshStandardMaterial
          color={system.color}
          emissive={system.color}
          emissiveIntensity={isCurrent ? 0.5 : (isReachable ? 0.2 : 0.05)}
          transparent
          opacity={isCurrent ? 1 : (isReachable ? 0.85 : 0.35)}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>

      {/* Cel-shade highlight */}
      <mesh position={[-baseSize * 0.2, baseSize * 0.25, baseSize * 0.3]}>
        <sphereGeometry args={[baseSize * 0.35, 8, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
      </mesh>

      {/* Label */}
      <Billboard position={[0, -baseSize - 0.04, 0]}>
        <Text
          fontSize={0.03}
          color={isCurrent ? '#ffffff' : (isReachable ? '#cccccc' : '#666666')}
          anchorX="center"
          anchorY="top"
          font="/fonts/Geist-Bold.woff"
          outlineWidth={0.003}
          outlineColor="#000000"
        >
          {system.name}
        </Text>
      </Billboard>

      {/* "YOU ARE HERE" label */}
      {isCurrent && (
        <Billboard position={[0, baseSize + 0.04, 0]}>
          <Text
            fontSize={0.025}
            color="#f0c040"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.002}
            outlineColor="#000000"
          >
            YOU ARE HERE
          </Text>
        </Billboard>
      )}
    </group>
  );
}

function GalaxyScene({ player }) {
  const connections = getConnections(player.system_id);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.8} />

      <Starfield count={800} />

      {/* Jump Lanes */}
      {JUMP_LANES.map(([aId, bId]) => {
        const isActive =
          (aId === player.system_id && connections.includes(bId)) ||
          (bId === player.system_id && connections.includes(aId));
        return (
          <JumpLane
            key={`${aId}-${bId}`}
            from={systemPositions[aId]}
            to={systemPositions[bId]}
            isActive={isActive}
          />
        );
      })}

      {/* System Nodes */}
      {SYSTEMS.map(sys => (
        <SystemNode
          key={sys.id}
          system={sys}
          isCurrent={sys.id === player.system_id}
          isReachable={connections.includes(sys.id)}
        />
      ))}

      {/* Player Ship */}
      <PlayerShip
        shipId={player.ship}
        systemPosition={systemPositions[player.system_id]}
      />

      {/* Nebula fog */}
      <fog attach="fog" args={['#06060c', 3, 12]} />
    </>
  );
}

export default function GalaxyView({ player, currentSystem }) {
  const cameraPos = useMemo(() => {
    const pos = systemPositions[player.system_id];
    return [pos[0] + 0.5, pos[1] + 0.8, pos[2] + 1.2];
  }, [player.system_id]);

  const target = useMemo(() => {
    return systemPositions[player.system_id];
  }, [player.system_id]);

  return (
    <Canvas
      camera={{ position: cameraPos, fov: 50, near: 0.01, far: 50 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor('#06060c');
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.2;
      }}
    >
      <GalaxyScene player={player} />
      <OrbitControls
        target={target}
        enableDamping
        dampingFactor={0.05}
        minDistance={0.3}
        maxDistance={5}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </Canvas>
  );
}
