import { create } from "zustand";
import { z } from "zod";

export interface PlacedItem {
  id: string;
  articleNumber: string;
  name: string;
  dimensions: { w: number; h: number; d: number };
  position: [number, number, number];
  rotationY: number;
}

export interface RoomDimensions {
  widthMeters: number;
  depthMeters: number;
}

export const FLOOR_MATERIALS = ["grid", "wood", "tile", "concrete"] as const;
export type FloorMaterial = (typeof FLOOR_MATERIALS)[number];

export const ENVIRONMENT_PRESETS = ["apartment", "city", "dawn", "sunset", "studio"] as const;
export type EnvironmentPreset = (typeof ENVIRONMENT_PRESETS)[number];

interface RoomState {
  roomDimensions: RoomDimensions;
  wallColor: string;
  floorMaterial: FloorMaterial;
  exposure: number;
  ambientLight: number;
  environmentPreset: EnvironmentPreset;
  placedItems: PlacedItem[];
  setRoomDimensions: (dimensions: Partial<RoomDimensions>) => void;
  setWallColor: (color: string) => void;
  setFloorMaterial: (material: FloorMaterial) => void;
  setExposure: (exposure: number) => void;
  setAmbientLight: (intensity: number) => void;
  setEnvironmentPreset: (preset: EnvironmentPreset) => void;
  addItem: (item: PlacedItem) => boolean;
  removeItem: (id: string) => void;
  updateItemTransform: (id: string, position: PlacedItem["position"], rotation: number) => void;
  importLayout: (layout: unknown) => string | null;
}

const layoutSchema = z.object({
  roomDimensions: z.object({
    widthMeters: z.number().min(1.2).max(20),
    depthMeters: z.number().min(1.2).max(20),
  }),
  wallColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  floorMaterial: z.enum(FLOOR_MATERIALS).optional(),
  exposure: z.number().min(0.5).max(2).optional(),
  ambientLight: z.number().min(0.1).max(2.5).optional(),
  environmentPreset: z.enum(ENVIRONMENT_PRESETS).optional(),
  placedItems: z.array(z.object({
    id: z.string().trim().min(1),
    articleNumber: z.string().trim().min(1),
    name: z.string().trim().min(1),
    dimensions: z.object({ w: z.number().positive(), h: z.number().positive(), d: z.number().positive() }),
    position: z.tuple([z.number(), z.literal(0), z.number()]),
    rotationY: z.number(),
  })),
});

function footprint(item: Pick<PlacedItem, "dimensions" | "rotationY">) {
  const cos = Math.abs(Math.cos(item.rotationY));
  const sin = Math.abs(Math.sin(item.rotationY));
  return {
    width: item.dimensions.w * cos + item.dimensions.d * sin,
    depth: item.dimensions.w * sin + item.dimensions.d * cos,
  };
}

export function clampItemPosition(
  position: PlacedItem["position"],
  dimensions: PlacedItem["dimensions"],
  rotationY: number,
  room: RoomDimensions,
): PlacedItem["position"] {
  const { width, depth } = footprint({ dimensions, rotationY });
  // Center an oversized footprint on that axis if an existing item cannot fit.
  const maxX = Math.max(0, (room.widthMeters - width) / 2);
  const maxZ = Math.max(0, (room.depthMeters - depth) / 2);
  return [
    maxX === 0 ? 0 : Math.max(-maxX, Math.min(maxX, position[0])),
    0,
    maxZ === 0 ? 0 : Math.max(-maxZ, Math.min(maxZ, position[2])),
  ];
}

function constrainItem(item: PlacedItem, room: RoomDimensions): PlacedItem | null {
  if (!Number.isFinite(item.rotationY) || item.position.some((value) => !Number.isFinite(value)) ||
      Object.values(item.dimensions).some((value) => !Number.isFinite(value) || value <= 0)) return null;
  const { width, depth } = footprint(item);
  if (width > room.widthMeters || depth > room.depthMeters) return null;
  const position = clampItemPosition(item.position, item.dimensions, item.rotationY, room);
  return position.every((value, index) => value === item.position[index]) ? item : { ...item, position };
}

export const useRoomStore = create<RoomState>((set) => ({
  roomDimensions: { widthMeters: 4.5, depthMeters: 6.0 },
  wallColor: "#e5e1d8",
  floorMaterial: "grid",
  exposure: 1.2,
  ambientLight: 0.8,
  environmentPreset: "apartment",
  placedItems: [],
  importLayout: (layout) => {
    const parsed = layoutSchema.safeParse(layout);
    if (!parsed.success) return "Invalid layout. Use room dimensions from 1.2 to 20 metres and furniture with valid dimensions and floor-level positions.";
    const { roomDimensions, placedItems, wallColor, floorMaterial, exposure, ambientLight, environmentPreset } = parsed.data;
    const ids = new Set<string>();
    for (const item of placedItems) {
      if (ids.has(item.id)) return "Invalid layout. Each furniture item must have a unique ID.";
      ids.add(item.id);
      const { width, depth } = footprint(item);
      if (width > roomDimensions.widthMeters || depth > roomDimensions.depthMeters ||
          Math.abs(item.position[0]) > (roomDimensions.widthMeters - width) / 2 + 1e-9 ||
          Math.abs(item.position[2]) > (roomDimensions.depthMeters - depth) / 2 + 1e-9) {
        return `Invalid layout. Furniture "${item.name}" extends outside the room.`;
      }
    }
    set({
      roomDimensions,
      placedItems: placedItems.map((item) => constrainItem(item, roomDimensions)!),
      ...(wallColor ? { wallColor } : {}),
      ...(floorMaterial ? { floorMaterial } : {}),
      ...(exposure !== undefined ? { exposure } : {}),
      ...(ambientLight !== undefined ? { ambientLight } : {}),
      ...(environmentPreset ? { environmentPreset } : {}),
    });
    return null;
  },
  addItem: (item) => {
    let added = false;
    set((state) => {
      const next = constrainItem(item, state.roomDimensions);
      if (!next || state.placedItems.some((placed) => placed.id === item.id)) return state;
      added = true;
      return { placedItems: [...state.placedItems, next] };
    });
    return added;
  },
  removeItem: (id) => set((state) => ({
    placedItems: state.placedItems.filter((item) => item.id !== id),
  })),
  updateItemTransform: (id, position, rotation) => set((state) => {
    const current = state.placedItems.find((item) => item.id === id);
    if (!current) return state;
    if (!Number.isFinite(rotation) || position.some((value) => !Number.isFinite(value))) return state;
    const next: PlacedItem = {
      ...current,
      position: clampItemPosition(position, current.dimensions, rotation, state.roomDimensions),
      rotationY: rotation,
    };
    if (next.rotationY === current.rotationY &&
        next.position.every((value, index) => value === current.position[index])) return state;
    return { placedItems: state.placedItems.map((item) => item.id === id ? next : item) };
  }),
  setRoomDimensions: (dimensions) => set((state) => {
    const next = { ...state.roomDimensions, ...dimensions };
    if (Object.values(next).some((value) => !Number.isFinite(value) || value < 1.2 || value > 20)) return state;
    // Keep room dimensions large enough for the actual, rotated furniture sizes.
    for (const item of state.placedItems) {
      const { width, depth } = footprint(item);
      next.widthMeters = Math.max(next.widthMeters, width);
      next.depthMeters = Math.max(next.depthMeters, depth);
    }
    if (next.widthMeters === state.roomDimensions.widthMeters &&
        next.depthMeters === state.roomDimensions.depthMeters) return state;
    return {
      roomDimensions: next,
      placedItems: state.placedItems.map((item) => constrainItem(item, next)!),
    };
  }),
  setWallColor: (wallColor) => {
    if (/^#[0-9a-f]{6}$/i.test(wallColor)) set({ wallColor });
  },
  setFloorMaterial: (floorMaterial) => {
    if (FLOOR_MATERIALS.includes(floorMaterial)) set({ floorMaterial });
  },
  setExposure: (exposure) => {
    if (Number.isFinite(exposure) && exposure >= 0.5 && exposure <= 2) set({ exposure });
  },
  setAmbientLight: (ambientLight) => {
    if (Number.isFinite(ambientLight) && ambientLight >= 0.1 && ambientLight <= 2.5) set({ ambientLight });
  },
  setEnvironmentPreset: (environmentPreset) => {
    if (ENVIRONMENT_PRESETS.includes(environmentPreset)) set({ environmentPreset });
  },
}));
