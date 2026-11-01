"use client";

import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TransformControls, useGLTF } from "@react-three/drei";
import { Box3, Vector3, type Group } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { clampItemPosition, useRoomStore, type PlacedItem } from "@/store/useRoomStore";

interface PlacedItemMeshProps {
  item: PlacedItem;
  selected: boolean;
  onSelect: () => void;
}

class ModelErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function FallbackBox({ dimensions, selected }: { dimensions: PlacedItem["dimensions"]; selected: boolean }) {
  const { w, h, d } = dimensions;
  return (
    <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={selected ? "#ba9670" : "#c8b9a5"} roughness={0.8} />
    </mesh>
  );
}

function ModelAsset({ path, dimensions }: { path: string; dimensions: PlacedItem["dimensions"] }) {
  const { scene } = useGLTF(path);
  const { w, h, d } = dimensions;
  const fitted = useMemo(() => {
    // Clone bones and transforms while keeping cached geometry and materials shared.
    const object = clone(scene);
    object.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(object, true);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    if (
      bounds.isEmpty() ||
      [...bounds.min.toArray(), ...bounds.max.toArray(), ...size.toArray()].some((value) => !Number.isFinite(value)) ||
      size.toArray().some((value) => value <= 0)
    ) {
      throw new Error(`Model has invalid bounds: ${path}`);
    }

    const scale: [number, number, number] = [w / size.x, h / size.y, d / size.z];
    const position: [number, number, number] = [
      -center.x * scale[0],
      -bounds.min.y * scale[1],
      -center.z * scale[2],
    ];
    if ([...scale, ...position].some((value) => !Number.isFinite(value))) {
      throw new Error(`Model cannot fit item dimensions: ${path}`);
    }
    object.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return { object, scale, position };
  }, [scene, path, w, h, d]);

  return (
    <group scale={fitted.scale} position={fitted.position} dispose={null}>
      <primitive object={fitted.object} dispose={null} />
    </group>
  );
}

export function PlacedItemMesh({ item, selected, onSelect }: PlacedItemMeshProps) {
  const group = useRef<Group>(null!);
  const dragging = useRef(false);
  const [transformMode, setTransformMode] = useState<"translate" | "rotate">("translate");
  const updateItemTransform = useRoomStore((state) => state.updateItemTransform);
  const path = `/models/${item.articleNumber}.glb`;
  const fallback = <FallbackBox dimensions={item.dimensions} selected={selected} />;

  useEffect(() => {
    if (!selected) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        event.repeat || event.isComposing || event.defaultPrevented ||
        event.altKey || event.ctrlKey || event.metaKey || dragging.current ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || target.closest("input, textarea, select")))
      ) return;

      const key = event.key.toLowerCase();
      if (key === "r") {
        event.preventDefault();
        setTransformMode((mode) => mode === "translate" ? "rotate" : "translate");
      } else if (key === "t") {
        event.preventDefault();
        setTransformMode("translate");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected]);

  useLayoutEffect(() => {
    if (dragging.current) return;
    group.current.position.set(...item.position);
    // Keep yaw continuous across quarter turns when controls update the quaternion.
    group.current.rotation.order = "YXZ";
    group.current.rotation.set(0, item.rotationY, 0);
    group.current.updateMatrixWorld();
  }, [item.position, item.rotationY]);

  function keepInsideRoom() {
    const object = group.current;
    if (!object) return;
    object.rotation.set(0, object.rotation.y, 0);
    // Clamp the live object after every control update, without publishing drag frames.
    const position = clampItemPosition(
      [object.position.x, 0, object.position.z],
      item.dimensions,
      object.rotation.y,
      useRoomStore.getState().roomDimensions,
    );
    object.position.set(...position);
    object.updateMatrixWorld();
  }

  function finishDrag() {
    keepInsideRoom();
    const object = group.current;
    if (!object) return;
    // Persist once the gesture ends, so store updates cannot reset an active drag.
    updateItemTransform(item.id, [object.position.x, 0, object.position.z], object.rotation.y);
    dragging.current = false;
  }

  return (
    <>
      <group
        ref={group}
        name={item.name}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <ModelErrorBoundary key={path} fallback={fallback}>
          <Suspense fallback={fallback}>
            <ModelAsset path={path} dimensions={item.dimensions} />
          </Suspense>
        </ModelErrorBoundary>
      </group>
      {selected && (
        <TransformControls
          object={group}
          mode={transformMode}
          space="world"
          showX={transformMode === "translate"}
          showY={transformMode === "rotate"}
          showZ={transformMode === "translate"}
          size={0.8}
          onMouseDown={() => { dragging.current = true; }}
          onObjectChange={keepInsideRoom}
          onMouseUp={finishDrag}
        />
      )}
    </>
  );
}
