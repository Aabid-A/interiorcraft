"use client";

import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, View, useGLTF } from "@react-three/drei";
import { Box3, PerspectiveCamera as ThreePerspectiveCamera, Vector3, type Material, type Mesh } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { observeCatalogVisibility } from "@/lib/catalogVisibility";
import { useDebounce } from "@/lib/useDebounce";
import { disableCatalogPreviews, registerCatalogView, useCatalogPreviewStore } from "@/store/useCatalogPreviewStore";

const loadedPreviewPaths = new Set<string>();
const previewRevealDuration = 300;

class PreviewErrorBoundary extends Component<
  { children: ReactNode; onError?: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function PreviewAsset({ modelPath, onLoaded }: { modelPath: string; onLoaded: () => void }) {
  // useGLTF resumes only after the file and its dependent resources are parsed.
  const { scene } = useGLTF(modelPath);
  const invalidate = useThree((state) => state.invalidate);
  const reveal = useRef<{
    started: number;
    update: (progress: number) => void;
    release: () => void;
  } | null>(null);
  const fitted = useMemo(() => {
    // Keep cached materials and geometry shared with furniture in the room.
    const object = clone(scene);
    object.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(object, true);
    const center = bounds.getCenter(new Vector3());
    const radius = bounds.getSize(new Vector3()).length() / 2;
    if (bounds.isEmpty() || !Number.isFinite(radius) || radius <= 0 || center.toArray().some((value) => !Number.isFinite(value))) {
      throw new Error(`Model has invalid preview bounds: ${modelPath}`);
    }
    return { object, center, scale: 1 / radius };
  }, [scene, modelPath]);

  useLayoutEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const originals: { mesh: Mesh; material: Material | Material[] }[] = [];
      const materials = new Map<Material, Material>();
      const fadeMaterial = (original: Material) => {
        let material = materials.get(original);
        if (!material) {
          material = original.clone();
          material.transparent = true;
          material.opacity = 0;
          materials.set(original, material);
        }
        return material;
      };

      // Views share a portal Canvas, so HTML opacity cannot fade their pixels.
      // Isolate opacity briefly without changing cached room materials or textures.
      fitted.object.traverse((child) => {
        if (!(child as Mesh).isMesh) return;
        const mesh = child as Mesh;
        originals.push({ mesh, material: mesh.material });
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(fadeMaterial)
          : fadeMaterial(mesh.material);
      });
      reveal.current = {
        started: performance.now(),
        update: (progress) => {
          for (const [original, material] of materials) material.opacity = original.opacity * progress;
        },
        release: () => {
          for (const original of originals) original.mesh.material = original.material;
          for (const material of materials.values()) material.dispose();
        },
      };
    }
    loadedPreviewPaths.add(modelPath);
    onLoaded();
    invalidate();
    return () => {
      reveal.current?.release();
      reveal.current = null;
    };
  }, [fitted, modelPath, onLoaded, invalidate]);

  useFrame(() => {
    const animation = reveal.current;
    if (!animation) return;
    const progress = Math.min(1, (performance.now() - animation.started) / previewRevealDuration);
    animation.update(progress);
    if (progress === 1) {
      animation.release();
      reveal.current = null;
    } else {
      invalidate();
    }
  }, -0.5);

  return (
    <group scale={fitted.scale} dispose={null}>
      <group position={[-fitted.center.x, -fitted.center.y, -fitted.center.z]}>
        <primitive object={fitted.object} dispose={null} />
      </group>
    </group>
  );
}

function PreviewCamera({ track }: { track: RefObject<HTMLDivElement | null> }) {
  const camera = useRef<ThreePerspectiveCamera>(null);
  useFrame(() => {
    const rect = track.current?.getBoundingClientRect();
    if (!camera.current || !rect?.width || !rect.height) return;
    const halfFov = (35 * Math.PI) / 360;
    const horizontalHalfFov = Math.atan(Math.tan(halfFov) * rect.width / rect.height);
    const distance = 1.12 / Math.sin(Math.min(halfFov, horizontalHalfFov));
    camera.current.position.set(0.6, 0.45, 0.7).normalize().multiplyScalar(distance);
    camera.current.lookAt(0, 0, 0);
  });
  return <PerspectiveCamera ref={camera} makeDefault fov={35} near={0.01} far={100} />;
}

export function CatalogModelPreview({ articleNumber, title, thumbnail, scrollRegion, index, total, style, children }: {
  articleNumber: string;
  title: string;
  thumbnail: string;
  scrollRegion: RefObject<HTMLDivElement | null>;
  index: number;
  total: number;
  style: CSSProperties;
  children: (preview: ReactNode) => ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const modelPath = `/models/${articleNumber}.glb`;
  const [loadedPath, setLoadedPath] = useState<string | null>(() => loadedPreviewPaths.has(modelPath) ? modelPath : null);
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const isLoaded = loadedPath === modelPath || loadedPreviewPaths.has(modelPath);
  const hasFailed = failedPath === modelPath;
  const handleLoaded = useCallback(() => setLoadedPath(modelPath), [modelPath]);
  const handleError = useCallback(() => setFailedPath(modelPath), [modelPath]);
  const enabled = useCatalogPreviewStore((state) => state.enabled);
  // A new request identity restarts the delay even after a quick leave and return.
  const request = useMemo(() => ({ active: visible && enabled && (isHovered || isFocused) }), [visible, enabled, isHovered, isFocused]);
  const debouncedRequest = useDebounce(request, 200);
  const showPreview = request.active && debouncedRequest === request && !hasFailed;

  useEffect(() => {
    const region = scrollRegion.current;
    if (!region) return;
    // Scrolling under a stationary pointer is not an inspection request.
    const stopHover = () => setIsHovered(false);
    region.addEventListener("scroll", stopHover, { passive: true });
    return () => region.removeEventListener("scroll", stopHover);
  }, [scrollRegion]);

  useEffect(() => {
    const element = track.current;
    const region = scrollRegion.current;
    if (!element || !region || !enabled) return;
    return observeCatalogVisibility(element, region, setVisible);
  }, [scrollRegion, enabled]);

  useLayoutEffect(() => {
    if (showPreview) return registerCatalogView();
  }, [showPreview]);

  const preview = (
    <div
      ref={track}
      data-catalog-preview={articleNumber}
      role="img"
      aria-label={`${showPreview && isLoaded ? "3D preview" : "Furniture illustration"} of ${title}`}
      aria-busy={showPreview && !isLoaded}
      className="relative h-32 shrink-0 overflow-hidden rounded-lg bg-slate-50"
    >
      {/* These small static drawings are already generated and served directly. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbnail}
        alt=""
        width={720}
        height={630}
        loading="lazy"
        decoding="async"
        className={`pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-300 motion-reduce:transition-none ${showPreview && isLoaded ? "opacity-0" : "opacity-100"}`}
      />
      {showPreview && !isLoaded && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-slate-100/25 motion-safe:animate-pulse" />
      )}
      {showPreview && (
        <View
          key={modelPath}
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ease-linear motion-reduce:transition-none ${isLoaded ? "opacity-100" : "opacity-0"}`}
          style={{ pointerEvents: "none" }}
        >
          <PreviewCamera track={track} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[4, 6, 5]} intensity={2.5} />
          <directionalLight position={[-4, 2, -3]} intensity={1} />
          <PreviewErrorBoundary onError={handleError}>
            <Suspense fallback={null}>
              <PreviewAsset modelPath={modelPath} onLoaded={handleLoaded} />
            </Suspense>
          </PreviewErrorBoundary>
        </View>
      )}
    </div>
  );

  return (
    <li
      aria-posinset={index + 1}
      aria-setsize={total}
      className="group absolute flex min-w-0 flex-col break-words rounded-2xl bg-white p-3 text-sm shadow-sm"
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) setIsFocused(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
      }}
    >
      {children(preview)}
    </li>
  );
}

function ClearPreviewFrame() {
  // View takes over rendering, so clear old scissor rectangles before drawing views.
  useFrame(({ gl }) => {
    gl.setScissorTest(false);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, true);
  }, -1);
  return null;
}

export function CatalogPreviewCanvas({ region }: { region: HTMLDivElement }) {
  const overlay = useRef<HTMLDivElement>(null);
  const invalidate = useRef<(() => void) | null>(null);
  const canvasElement = useRef<HTMLCanvasElement | null>(null);
  const updateClip = useCallback((region: HTMLDivElement | null) => {
    const rect = region?.getBoundingClientRect();
    const canvasRect = overlay.current?.getBoundingClientRect();
    if (!rect || !canvasRect || !overlay.current) return;
    overlay.current.style.zIndex = region?.closest('[data-slot="sheet-content"]') ? "60" : "40";
    const top = Math.max(0, Math.min(canvasRect.height, rect.top - canvasRect.top));
    const bottom = Math.max(top, Math.min(canvasRect.height, rect.bottom - canvasRect.top));
    const left = Math.max(0, Math.min(canvasRect.width, rect.left - canvasRect.left));
    const right = Math.max(left, Math.min(canvasRect.width, rect.right - canvasRect.left));
    overlay.current.style.clipPath = `inset(${top}px ${canvasRect.width - right}px ${canvasRect.height - bottom}px ${left}px)`;
    invalidate.current?.();
  }, []);

  useLayoutEffect(() => updateClip(region), [region, updateClip]);
  useEffect(() => {
    const update = () => updateClip(region);
    const observer = new ResizeObserver(update);
    observer.observe(region);
    // Capture scrolls from the catalog and from any surrounding layout container.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [region, updateClip]);

  useEffect(() => () => {
    canvasElement.current?.removeEventListener("webglcontextlost", disableCatalogPreviews);
    if (useCatalogPreviewStore.getState().invalidate === invalidate.current) {
      useCatalogPreviewStore.setState({ invalidate: null });
    }
    invalidate.current = null;
  }, []);

  return (
    <div ref={overlay} aria-hidden="true" className="fixed inset-0 z-40 pointer-events-none" style={{ pointerEvents: "none", clipPath: "inset(50%)" }}>
      <PreviewErrorBoundary onError={disableCatalogPreviews}>
        <Canvas
          style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          frameloop="demand"
          dpr={1}
          gl={{ alpha: true, antialias: true }}
          fallback={null}
          onCreated={(state) => {
            const element = state.gl.domElement;
            element.style.pointerEvents = "none";
            element.addEventListener("webglcontextlost", disableCatalogPreviews);
            canvasElement.current = element;
            state.setEvents({ enabled: false });
            invalidate.current = state.invalidate;
            useCatalogPreviewStore.setState({ invalidate: state.invalidate });
            updateClip(region);
          }}
        >
          <ClearPreviewFrame />
          <View.Port />
        </Canvas>
      </PreviewErrorBoundary>
    </div>
  );
}
