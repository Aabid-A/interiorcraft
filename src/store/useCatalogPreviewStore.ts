"use client";

import { create } from "zustand";

type CatalogPreviewState = {
  region: HTMLDivElement | null;
  views: Set<symbol>;
  enabled: boolean;
  invalidate: (() => void) | null;
};

export const useCatalogPreviewStore = create<CatalogPreviewState>(() => ({
  region: null,
  views: new Set(),
  enabled: true,
  invalidate: null,
}));

export function registerCatalogRegion(region: HTMLDivElement) {
  useCatalogPreviewStore.setState({ region });
  return () => {
    if (useCatalogPreviewStore.getState().region === region) {
      useCatalogPreviewStore.setState({ region: null });
    }
  };
}

export function registerCatalogView() {
  const token = Symbol();
  useCatalogPreviewStore.setState((state) => ({ views: new Set(state.views).add(token) }));
  return () => {
    useCatalogPreviewStore.setState((state) => {
      const views = new Set(state.views);
      views.delete(token);
      return { views };
    });
  };
}

export function invalidateCatalogPreviews() {
  useCatalogPreviewStore.getState().invalidate?.();
}

export function disableCatalogPreviews() {
  useCatalogPreviewStore.setState({ enabled: false });
}
