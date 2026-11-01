"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { MousePointer2, Rotate3D } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { FurnitureCatalog } from "@/components/FurnitureCatalog";
import { ProjectControls } from "@/components/ProjectControls";
import { StatsOverlay } from "@/components/StatsOverlay";
import { useRoomStore } from "@/store/useRoomStore";
import { RoomConfiguration } from "@/components/RoomConfiguration";
import { LightingPopover } from "@/components/LightingPopover";

const RoomCanvas = dynamic(() => import("@/components/RoomCanvas"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center gap-3 text-sm text-emerald-800" role="status"><Logo /> Preparing your space...</div>,
});

export default function Home() {
  const [captureImage, setCaptureImage] = useState<(() => string) | null>(null);
  const onCaptureReady = useCallback((capture: (() => string) | null) => {
    setCaptureImage(() => capture);
  }, []);
  const dimensions = useRoomStore((state) => state.roomDimensions);
  const floorMaterial = useRoomStore((state) => state.floorMaterial);
  const placedItems = useRoomStore((state) => state.placedItems);

  return (
    <main className="relative flex h-dvh flex-row overflow-hidden bg-slate-100 text-stone-900 selection:bg-emerald-100 selection:text-emerald-950 lg:h-dvh-row lg:overflow-hidden">
      {/* Keep a transitioning width in flow when the sidebar becomes absolute. */}
      <div className={`relative block h-full shrink-0 transition-[width] duration-700 ease-in-out motion-reduce:transition-none w-[300px]`}>
        <aside aria-label="Room configuration and estimate" className={`z-20 flex h-full w-[300px] flex-col overflow-y-auto overscroll-contain border-r border-slate-200 bg-white/90 shadow-xl backdrop-blur-md transition-transform duration-700 ease-in-out motion-reduce:transition-none [scrollbar-color:#94a3b8_#f8fafc] relative translate-x-0`}>
          <header className="flex items-center gap-3 border-b border-stone-200 px-6 py-6">
            <Logo />
            <div><h1 className="text-lg text-slate-900 font-bold tracking-tight">Makan3D</h1><p className="text-xs text-stone-500">A space to make your own</p></div>
          </header>
          <RoomConfiguration />
          <footer className="mt-auto flex items-center justify-between border-t border-stone-200 px-6 py-4 text-xs text-stone-500"><span>{placedItems.length} items placed</span><span>Makan3D</span></footer>
        </aside>
      </div>
      <section aria-label="Interactive 3D room" className={`relative isolate flex min-h-0 min-w-0 flex-1 flex-col transition-[padding] duration-700 ease-in-out motion-reduce:transition-none lg:h-full lg:pb-0 pb-0`}>
        <div className="absolute right-4 top-4 z-30 flex items-start gap-2 xl:right-8">
          <LightingPopover />
        </div>
        <div className="grid shrink-0 grid-rows-[1fr]">
          <div className="min-h-0 overflow-hidden">
            <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 py-4 pl-5 pr-32 xl:pl-8 xl:pr-36">
              <div><h2 className="text-sm font-semibold">NewSpace</h2><p className="mt-1 text-xs tabular-nums text-stone-600">{dimensions.widthMeters.toFixed(1)} m × {dimensions.depthMeters.toFixed(1)} m <span className="mx-1">·</span> {(dimensions.widthMeters * dimensions.depthMeters).toFixed(1)} m²</p></div>
              <span className="hidden items-center gap-2 text-xs font-medium text-stone-600 sm:flex lg:hidden xl:flex"><Rotate3D size={16} aria-hidden="true" /> 3D view</span>
            </header>
          </div>
        </div>
        <div className="grid shrink-0 grid-rows-[1fr]">
          <div className="min-h-0 overflow-hidden">
            <ProjectControls captureImage={captureImage} />
          </div>
        </div>
        <div className="relative min-h-0 min-w-0 flex-1"><RoomCanvas onCaptureReady={onCaptureReady}  /><StatsOverlay /></div>
        <div className="grid shrink-0 grid-rows-[1fr]">
          <div className="min-h-0 overflow-hidden">
            <footer className="hidden shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white/80 px-5 py-3 text-xs text-stone-600 xl:px-8">
              <span className="flex items-center gap-2"><MousePointer2 size={14} aria-hidden="true" /> Drag to orbit · Scroll to zoom · Right-drag to pan</span><span>{floorMaterial === "grid" ? "Grid: 0.3 m" : floorMaterial === "tile" ? "Tiles: 0.6 m" : floorMaterial === "wood" ? "Wood floor" : "Concrete floor"}</span>
            </footer>
          </div>
        </div>
      </section>
      <div className={`relative block h-full shrink-0 justify-end transition-[width] duration-700 ease-in-out motion-reduce:transition-none w-[380px] 2xl:w-[400px]`}>
        <aside aria-label="Furniture catalog" className={`flex h-full w-[380px] shrink-0 flex-col border-l border-slate-200 bg-white/90 shadow-xl transition-transform duration-700 ease-in-out motion-reduce:transition-none 2xl:w-[400px] relative translate-x-0`}>
          <FurnitureCatalog />
        </aside>
      </div>
    </main>
  );
}
