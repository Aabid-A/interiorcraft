"use client";

import dynamic from "next/dynamic";
import { useCatalogPreviewStore } from "@/store/useCatalogPreviewStore";

const CatalogPreviewCanvas = dynamic(() => import("./CatalogModelPreview").then((module) => module.CatalogPreviewCanvas), {
  ssr: false,
});

// This host is a direct body child so sidebar transforms and clipping cannot offset the Canvas.
export function CatalogPreviewHost() {
  const region = useCatalogPreviewStore((state) => state.region);
  const hasViews = useCatalogPreviewStore((state) => state.views.size > 0);
  const enabled = useCatalogPreviewStore((state) => state.enabled);
  return enabled && region && hasViews ? <CatalogPreviewCanvas region={region} /> : null;
}
