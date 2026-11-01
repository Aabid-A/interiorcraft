"use client";

import { useId, useState } from "react";
import { Ruler } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FLOOR_MATERIALS, useRoomStore, type FloorMaterial, type RoomDimensions } from "@/store/useRoomStore";

function DimensionInput({ dimension, id }: { dimension: keyof RoomDimensions; id: string }) {
  const value = useRoomStore((state) => state.roomDimensions[dimension]);
  const setRoomDimensions = useRoomStore((state) => state.setRoomDimensions);
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      id={id}
      type="number"
      min={1.2}
      max={20}
      step={0.1}
      value={draft ?? value}
      onChange={(event) => {
        // Keep partial input editable while the scene retains valid dimensions.
        setDraft(event.currentTarget.value);
        setRoomDimensions({ [dimension]: event.currentTarget.valueAsNumber });
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="mt-2 h-10 rounded-lg border-stone-300 bg-white px-3 text-sm tabular-nums"
    />
  );
}

export function RoomConfiguration() {
  const id = useId();
  const wallColor = useRoomStore((state) => state.wallColor);
  const floorMaterial = useRoomStore((state) => state.floorMaterial);
  const setWallColor = useRoomStore((state) => state.setWallColor);
  const setFloorMaterial = useRoomStore((state) => state.setFloorMaterial);

  return (
    <section className="px-6 py-7" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`} className="mb-5 flex items-center gap-2 text-sm font-semibold"><Ruler size={17} aria-hidden="true" /> Room configuration</h2>
    <div className="grid grid-cols-2 gap-3">
      {(["widthMeters", "depthMeters"] as const).map((key) => (
        <label key={key} className="block text-xs font-medium text-stone-600" htmlFor={`${id}-${key}`}>
          {key === "widthMeters" ? "Width (m)" : "Depth (m)"}
          <DimensionInput dimension={key} id={`${id}-${key}`} />
        </label>
      ))}
    </div>
    <p className="mt-2 text-xs text-stone-500">1.2 to 20 metres per side</p>
    <div className="mt-6 flex items-center justify-between">
      <label htmlFor={`${id}-wall-color`} className="text-sm font-medium">Wall colour</label>
      <Input id={`${id}-wall-color`} aria-label="Wall colour" type="color" value={wallColor} onChange={(event) => setWallColor(event.currentTarget.value)} className="h-9 w-14 cursor-pointer rounded-lg border-stone-300 p-1" />
    </div>
    <div className="mt-4 flex gap-2" aria-label="Wall colour presets">
      {[{ name: "Warm white", color: "#e5e1d8" }, { name: "Sage", color: "#a8b5a0" }, { name: "Clay", color: "#c99d88" }, { name: "Slate", color: "#8f9da8" }].map(({ name, color }) => (
        <Button key={color} variant="outline" size="icon" title={name} aria-label={name} aria-pressed={wallColor === color} onClick={() => setWallColor(color)} style={{ backgroundColor: color }} className={`h-9 w-9 border-stone-300 ${wallColor === color ? "ring-2 ring-stone-700 ring-offset-2" : ""}`} />
      ))}
    </div>
    <div className="mt-6">
      <label htmlFor={`${id}-floor-material`} className="text-sm font-medium">Floor material</label>
      <select
        id={`${id}-floor-material`}
        value={floorMaterial}
        onChange={(event) => setFloorMaterial(event.currentTarget.value as FloorMaterial)}
        className="mt-2 h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2"
      >
        {FLOOR_MATERIALS.map((material) => (
          <option key={material} value={material}>{material.charAt(0).toUpperCase() + material.slice(1)}</option>
        ))}
      </select>
    </div>
  </section>
  );
}
