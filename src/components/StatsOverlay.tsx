"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useRoomStore } from "@/store/useRoomStore";

export function StatsOverlay() {
  const area = useRoomStore((state) => state.roomDimensions.widthMeters * state.roomDimensions.depthMeters);
  const count = useRoomStore((state) => state.placedItems.length);

  return (
    <Card className="pointer-events-none absolute bottom-4 right-4 z-10 bg-white py-3 text-stone-900 shadow-md" aria-label="Room summary">
      <CardContent className="px-4">
        <dl className="flex gap-6 text-xs">
          <div><dt className="text-stone-600">Room area</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{area.toFixed(1)} m²</dd></div>
          <div><dt className="text-stone-600">Furniture</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{count} {count === 1 ? "item" : "items"}</dd></div>
        </dl>
      </CardContent>
    </Card>
  );
}
