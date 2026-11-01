"use client";

import { Component, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Grid, OrbitControls } from "@react-three/drei";
import {
  CanvasTexture,
  DoubleSide,
  MeshStandardMaterial,
  PerspectiveCamera,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import { useRoomStore, type EnvironmentPreset, type FloorMaterial } from "@/store/useRoomStore";
import { PlacedItemMesh } from "@/components/PlacedItemMesh";

const WALL_HEIGHT = 2.5;

// The exact Drei presets, served locally so scene lighting needs no external CDN.
const ENVIRONMENT_FILES: Record<EnvironmentPreset, string> = {
  apartment: "/environments/lebombo_1k.hdr",
  city: "/environments/potsdamer_platz_1k.hdr",
  dawn: "/environments/kiara_1_dawn_1k.hdr",
  sunset: "/environments/venice_sunset_1k.hdr",
  studio: "/environments/studio_small_03_1k.hdr",
};

function RendererExposure({ exposure }: { exposure: number }) {
  const get = useThree((state) => state.get);
  useLayoutEffect(() => {
    const { gl, invalidate } = get();
    gl.toneMappingExposure = exposure;
    invalidate();
  }, [exposure, get]);
  return null;
}

class EnvironmentBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn("Room environment unavailable. Using the scene lights.", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const FLOOR_SURFACES: Record<FloorMaterial, { color: string; roughness: number }> = {
  grid: { color: "#e5ded1", roughness: 0.9 },
  wood: { color: "#8B5A2B", roughness: 0.4 },
  tile: { color: "#E0E0E0", roughness: 0.3 },
  concrete: { color: "#808080", roughness: 0.95 },
};

function WoodFloorMaterial({ width, depth }: { width: number; depth: number }) {
  const materialRef = useRef<MeshStandardMaterial>(null);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const material = materialRef.current;
    if (!material || typeof document === "undefined") return;

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 1024;
    const context = canvas.getContext("2d");
    if (!context) return;

    const plankColors = ["#8b5a2b", "#986535", "#805027", "#926031", "#a06c3c", "#89562b"];
    const plankWidth = canvas.width / plankColors.length;

    for (let plank = 0; plank < plankColors.length; plank++) {
      const left = plank * plankWidth;
      context.fillStyle = plankColors[plank];
      context.fillRect(left, 0, plankWidth, canvas.height);

      // Periodic grain meets at the texture edges when the canvas repeats.
      for (let grain = 0; grain < 18; grain++) {
        const grainX = left + 5 + (grain / 18) * (plankWidth - 10);
        context.beginPath();
        for (let y = 0; y <= canvas.height; y += 8) {
          const x = grainX + Math.sin((y / canvas.height) * Math.PI * 4 + plank + grain) * 1.5;
          if (y === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = grain % 3 === 0 ? "rgba(235, 186, 125, 0.16)" : "rgba(65, 35, 16, 0.15)";
        context.lineWidth = grain % 3 === 0 ? 1.2 : 0.7;
        context.stroke();
      }

      context.fillStyle = "#49301c";
      context.fillRect(left, 0, 2, canvas.height);
      context.fillRect(left, ((plank * 3) % 8) * 128, plankWidth, 3);
      context.fillStyle = "rgba(235, 186, 125, 0.25)";
      context.fillRect(left + 2, 0, 1, canvas.height);
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    // Six 20 cm boards and a 2.4 m length per tile keep plank sizes fixed as rooms resize.
    texture.repeat.set(width / 1.2, depth / 2.4);
    material.map = texture;
    material.color.set("#ffffff");
    material.needsUpdate = true;
    invalidate();

    return () => {
      material.map = null;
      material.color.set(FLOOR_SURFACES.wood.color);
      material.needsUpdate = true;
      texture.dispose();
    };
  }, [width, depth, invalidate]);

  return <meshStandardMaterial ref={materialRef} {...FLOOR_SURFACES.wood} />;
}

function RoomGeometry() {
  const { widthMeters: width, depthMeters: depth } = useRoomStore(
    (state) => state.roomDimensions,
  );
  const wallColor = useRoomStore((state) => state.wallColor);
  const floorMaterial = useRoomStore((state) => state.floorMaterial);
  const floorSurface = FLOOR_SURFACES[floorMaterial];

  const walls: {
    position: [number, number, number];
    rotation: [number, number, number];
    width: number;
  }[] = [
    { position: [0, WALL_HEIGHT / 2, -depth / 2], rotation: [0, 0, 0], width },
    { position: [0, WALL_HEIGHT / 2, depth / 2], rotation: [0, Math.PI, 0], width },
    { position: [-width / 2, WALL_HEIGHT / 2, 0], rotation: [0, Math.PI / 2, 0], width: depth },
    { position: [width / 2, WALL_HEIGHT / 2, 0], rotation: [0, -Math.PI / 2, 0], width: depth },
  ];

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        {floorMaterial === "wood" ? (
          <WoodFloorMaterial width={width} depth={depth} />
        ) : (
          <meshStandardMaterial color={floorSurface.color} roughness={floorSurface.roughness} />
        )}
      </mesh>
      {(floorMaterial === "grid" || floorMaterial === "tile") && <Grid
        args={[width, depth]}
        position={[0, 0.008, 0]}
        cellSize={floorMaterial === "tile" ? 0.6 : 0.3}
        cellThickness={0.6}
        cellColor={floorMaterial === "tile" ? "#b0b0b0" : "#a49c8d"}
        sectionSize={floorMaterial === "tile" ? 0.6 : 1.5}
        sectionThickness={floorMaterial === "tile" ? 0.6 : 1}
        sectionColor={floorMaterial === "tile" ? "#b0b0b0" : "#8f877a"}
        fadeDistance={100}
        fadeStrength={0}
        infiniteGrid={false}
      />}
      {walls.map((wall, index) => (
        <mesh key={index} position={wall.position} rotation={wall.rotation} receiveShadow>
          <planeGeometry args={[wall.width, WALL_HEIGHT]} />
          <meshStandardMaterial
            color={wallColor}
            transparent
            opacity={0.8}
            side={DoubleSide}
            depthWrite={false}
            roughness={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

function RoomCamera() {
  const dimensions = useRoomStore((state) => state.roomDimensions);
  const camera = useThree((state) => state.camera);
  const aspect = useThree((state) => state.size.width / state.size.height);
  const invalidate = useThree((state) => state.invalidate);
  const radius = Math.hypot(dimensions.widthMeters, dimensions.depthMeters, WALL_HEIGHT) / 2;
  const verticalFov = ((camera instanceof PerspectiveCamera ? camera.fov : 40) * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const distance = (radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2)) * 1.12;

  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;

    // Fit the room's bounding sphere, including the walls, at any viewport ratio.
    camera.position.set(distance * 0.57, distance * 0.66 + WALL_HEIGHT / 2, distance * 0.57);
    camera.lookAt(0, WALL_HEIGHT / 2, 0);
    // Three.js cameras are mutable scene objects, updated alongside their projection matrix.
    // eslint-disable-next-line react-hooks/immutability
    camera.far = Math.max(150, distance * 3);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, distance, invalidate]);

  return (
    <OrbitControls
      makeDefault
      target={[0, WALL_HEIGHT / 2, 0]}
      enableDamping
      dampingFactor={0.08}
      minDistance={1.5}
      maxDistance={Math.max(60, distance * 2)}
      maxPolarAngle={Math.PI / 2 - 0.02}
    />
  );
}

type CaptureReady = (capture: (() => string) | null) => void;

function CaptureBridge({ onCaptureReady }: { onCaptureReady: CaptureReady }) {
  const get = useThree((state) => state.get);
  useEffect(() => {
    onCaptureReady(() => {
      const { gl, scene, camera } = get();
      if (gl.getContext().isContextLost()) throw new Error("The 3D view is unavailable.");
      // Demand rendering may be idle. Render the current scene before reading its pixels.
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    });
    return () => onCaptureReady(null);
  }, [get, onCaptureReady]);
  return null;
}

export default function RoomCanvas({ onCaptureReady }: { onCaptureReady: CaptureReady }) {
  const dimensions = useRoomStore((state) => state.roomDimensions);
  const placedItems = useRoomStore((state) => state.placedItems);
  const exposure = useRoomStore((state) => state.exposure);
  const ambientLight = useRoomStore((state) => state.ambientLight);
  const environmentPreset = useRoomStore((state) => state.environmentPreset);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = placedItems.some((item) => item.id === selectedId)
    ? selectedId : placedItems.at(-1)?.id;
  const lightExtent = Math.max(dimensions.widthMeters, dimensions.depthMeters, 6);

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [8, 8, 8], fov: 40, near: 0.1, far: 150 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMappingExposure: exposure }}
        aria-label={"Interactive 3D room. Select furniture and drag its arrows or square to move it. Press R to toggle rotation and drag the ring to turn it. Press T to move. Drag the room to orbit, scroll to zoom, and right-drag to pan."}
      >
        {/* Optional reflections must not suspend or crash the room. */}
        <RendererExposure exposure={exposure} />
        <EnvironmentBoundary key={environmentPreset}>
          <Suspense fallback={null}>
            <Environment files={ENVIRONMENT_FILES[environmentPreset]} />
          </Suspense>
        </EnvironmentBoundary>
        <Suspense fallback={null}>
          <color attach="background" args={["#f1efe9"]} />
          <ambientLight intensity={ambientLight} />
          <directionalLight
            position={[5, 10, 4]}
            intensity={2}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-lightExtent}
            shadow-camera-right={lightExtent}
            shadow-camera-top={lightExtent}
            shadow-camera-bottom={-lightExtent}
            shadow-camera-near={0.1}
            shadow-camera-far={50}
            shadow-normalBias={0.03}
          />
          <RoomGeometry />
          <RoomCamera />
          <CaptureBridge onCaptureReady={onCaptureReady} />
          {placedItems.map((item) => (
            <PlacedItemMesh
              key={item.id}
              item={item}
              selected={item.id === activeId}
              onSelect={() => setSelectedId(item.id)}
            />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}
