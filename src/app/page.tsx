"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Eye, EyeOff, MousePointer2, Rotate3D } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { FurnitureCatalog } from "@/components/FurnitureCatalog";
import { ProjectControls } from "@/components/ProjectControls";
import { StatsOverlay } from "@/components/StatsOverlay";
import { RoomBasket } from "@/components/RoomBasket";
import { useRoomStore } from "@/store/useRoomStore";
import { RoomConfiguration } from "@/components/RoomConfiguration";
import { LightingPopover } from "@/components/LightingPopover";
import { MobileNavigation } from "@/components/MobileNavigation";

const RoomCanvas = dynamic(() => import("@/components/RoomCanvas"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center gap-3 text-sm text-emerald-800" role="status"><Logo /> Preparing your space...</div>,
});

const subscribeDesktop = (listener: () => void) => {
  const media = window.matchMedia("(min-width: 1024px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};
const getDesktopSnapshot = () => window.matchMedia("(min-width: 1024px)").matches;
const getServerDesktopSnapshot = () => false;

export default function Home() {
  const isDesktop = useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, getServerDesktopSnapshot);
  const [isCinematicMode, setIsCinematicMode] = useState(false);
  const [captureImage, setCaptureImage] = useState<(() => string) | null>(null);
  const onCaptureReady = useCallback((capture: (() => string) | null) => {
    setCaptureImage(() => capture);
  }, []);
  const dimensions = useRoomStore((state) => state.roomDimensions);
  const floorMaterial = useRoomStore((state) => state.floorMaterial);
  const placedItems = useRoomStore((state) => state.placedItems);

  useEffect(() => {
    if (!isCinematicMode) return;
    function exitOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsCinematicMode(false);
    }
    window.addEventListener("keydown", exitOnEscape);
    return () => window.removeEventListener("keydown", exitOnEscape);
  }, [isCinematicMode]);

  const chromeTransition = `grid shrink-0 transition-[grid-template-rows,opacity] duration-700 ease-in-out motion-reduce:transition-none ${isCinematicMode ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`;

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-slate-100 text-stone-900 selection:bg-emerald-100 selection:text-emerald-950 lg:h-dvh lg:flex-row lg:overflow-hidden">
      {/* Keep a transitioning width in flow when the sidebar becomes absolute. */}
      <div className={`relative hidden h-full shrink-0 transition-[width] duration-700 ease-in-out motion-reduce:transition-none lg:block ${isCinematicMode ? "w-0" : "w-[300px]"}`}>
        <aside aria-label="Room configuration and estimate" inert={isCinematicMode} aria-hidden={isCinematicMode} className={`z-20 flex h-full w-[300px] flex-col overflow-y-auto overscroll-contain border-r border-slate-200 bg-white/90 shadow-xl backdrop-blur-md transition-transform duration-700 ease-in-out motion-reduce:transition-none [scrollbar-color:#94a3b8_#f8fafc] ${isCinematicMode ? "absolute left-0 top-0 -translate-x-full" : "relative translate-x-0"}`}>
          <header className="flex items-center gap-3 border-b border-stone-200 px-6 py-6">
            <Logo />
            <div><h1 className="text-lg text-slate-900 font-bold tracking-tight">Makan3D</h1><p className="text-xs text-stone-500">A space to make your own</p></div>
          </header>
          <RoomConfiguration />
          <RoomBasket />
          <footer className="mt-auto flex items-center justify-between border-t border-stone-200 px-6 py-4 text-xs text-stone-500"><span>{placedItems.length} items placed</span><span>Makan3D</span></footer>
        </aside>
      </div>
      <section aria-label="Interactive 3D room" className={`relative isolate flex min-h-0 min-w-0 flex-1 flex-col transition-[padding] duration-700 ease-in-out motion-reduce:transition-none lg:h-full lg:pb-0 ${isCinematicMode ? "pb-0" : "pb-[calc(77px+env(safe-area-inset-bottom))]"}`}>
        <div className="absolute right-4 top-4 z-30 flex items-start gap-2 xl:right-8">
          {!isCinematicMode && <LightingPopover />}
          <button
            type="button"
            aria-label={isCinematicMode ? "Exit cinematic mode" : "Enter cinematic mode"}
            aria-pressed={isCinematicMode}
            title={isCinematicMode ? "Exit cinematic mode (Escape)" : "Cinematic mode"}
            onClick={() => setIsCinematicMode((current) => !current)}
            className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-3 text-xs font-medium text-stone-600 hover:bg-white hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            {isCinematicMode ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            {isCinematicMode && <span>Exit</span>}
          </button>
        </div>
        <div className={chromeTransition} inert={isCinematicMode} aria-hidden={isCinematicMode}>
          <div className="min-h-0 overflow-hidden">
            <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 py-4 pl-5 pr-32 xl:pl-8 xl:pr-36">
              <div><h2 className="text-sm font-semibold">NewSpace</h2><p className="mt-1 text-xs tabular-nums text-stone-600">{dimensions.widthMeters.toFixed(1)} m × {dimensions.depthMeters.toFixed(1)} m <span className="mx-1">·</span> {(dimensions.widthMeters * dimensions.depthMeters).toFixed(1)} m²</p></div>
              <span className="hidden items-center gap-2 text-xs font-medium text-stone-600 sm:flex lg:hidden xl:flex"><Rotate3D size={16} aria-hidden="true" /> 3D view</span>
            </header>
          </div>
        </div>
        <div className={chromeTransition} inert={isCinematicMode} aria-hidden={isCinematicMode}>
          <div className="min-h-0 overflow-hidden">
            <ProjectControls captureImage={captureImage} />
          </div>
        </div>
        <div className="relative min-h-0 min-w-0 flex-1"><RoomCanvas onCaptureReady={onCaptureReady} isCinematicMode={isCinematicMode} />{!isCinematicMode && <StatsOverlay />}</div>
        <div className={chromeTransition} inert={isCinematicMode} aria-hidden={isCinematicMode}>
          <div className="min-h-0 overflow-hidden">
            <footer className="hidden shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white/80 px-5 py-3 text-xs text-stone-600 lg:flex xl:px-8">
              <span className="flex items-center gap-2"><MousePointer2 size={14} aria-hidden="true" /> Drag to orbit · Scroll to zoom · Right-drag to pan</span><span>{floorMaterial === "grid" ? "Grid: 0.3 m" : floorMaterial === "tile" ? "Tiles: 0.6 m" : floorMaterial === "wood" ? "Wood floor" : "Concrete floor"}</span>
            </footer>
          </div>
        </div>
      </section>
      <div className={`relative hidden h-full shrink-0 justify-end transition-[width] duration-700 ease-in-out motion-reduce:transition-none lg:flex ${isCinematicMode ? "w-0" : "w-[380px] 2xl:w-[400px]"}`}>
        <aside aria-label="Furniture catalog" inert={isCinematicMode} aria-hidden={isCinematicMode} className={`flex h-full w-[380px] shrink-0 flex-col border-l border-slate-200 bg-white/90 shadow-xl transition-transform duration-700 ease-in-out motion-reduce:transition-none 2xl:w-[400px] ${isCinematicMode ? "absolute right-0 top-0 translate-x-full" : "relative translate-x-0"}`}>
          {isDesktop && <FurnitureCatalog />}
        </aside>
      </div>
      {!isDesktop && !isCinematicMode && <MobileNavigation />}
    </main>
  );
}
