"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Armchair, Plus, Search } from "lucide-react";
import { CatalogModelPreview } from "@/components/CatalogModelPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import catalog from "@/data/room-catalog.json";
import availableModels from "../../public/available_models.json";
import prices from "../../public/prices.json";
import { extractIkeaArticleNumber } from "@/lib/ikeaParser";
import { catalogProduct, type CatalogProduct } from "@/lib/productLookup";
import { catalogWindow, CATALOG_CARD_HEIGHT, CATALOG_COLUMNS, CATALOG_PADDING, CATALOG_ROW_GAP, CATALOG_ROW_HEIGHT } from "@/lib/catalogWindow";
import { useRoomStore } from "@/store/useRoomStore";
import { invalidateCatalogPreviews, registerCatalogRegion } from "@/store/useCatalogPreviewStore";

const modelArticles = new Set(availableModels);
const articlePrices: Record<string, string> = prices;
const products: CatalogProduct[] = Object.entries(catalog)
  .filter(([articleNumber]) => modelArticles.has(articleNumber))
  .map(([articleNumber, product]) => catalogProduct(articleNumber, product))
  .sort((a, b) => a.name.localeCompare(b.name) || a.category.localeCompare(b.category) || a.articleNumber.localeCompare(b.articleNumber));
const categories = [...new Set(products.map((product) => product.category))].sort((a, b) => a.localeCompare(b));

export function FurnitureCatalog() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 600, width: 0 });
  const [placementError, setPlacementError] = useState("");
  const [added, setAdded] = useState("");
  const scrollRegion = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<{ index: number; action: "card" | "add" } | null>(null);
  const addItem = useRoomStore((state) => state.addItem);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const articleQuery = extractIkeaArticleNumber(normalizedQuery) ?? normalizedQuery;
    return products.filter((product) =>
      (!category || product.category === category) &&
      (!normalizedQuery || product.name.toLowerCase().includes(normalizedQuery) ||
        product.category.toLowerCase().includes(normalizedQuery) || product.articleNumber.includes(articleQuery)),
    );
  }, [query, category]);
  const columns = CATALOG_COLUMNS;
  const { start, end, totalHeight } = catalogWindow(filteredProducts.length, viewport.scrollTop, viewport.height, columns);
  useLayoutEffect(() => {
    const region = scrollRegion.current;
    if (region) return registerCatalogRegion(region);
  }, []);

  useLayoutEffect(() => {
    invalidateCatalogPreviews();
  }, [query, category, placementError, added, viewport.width, viewport.height, start, end]);

  const updateViewport = useCallback(() => {
    const region = scrollRegion.current;
    if (!region) return;
    const next = { scrollTop: region.scrollTop, height: region.clientHeight, width: region.clientWidth };
    const nextWindow = catalogWindow(filteredProducts.length, next.scrollTop, next.height, CATALOG_COLUMNS);
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && region.contains(focused) && focused.dataset.catalogIndex !== undefined) {
      const index = Number(focused.dataset.catalogIndex);
      if (index < nextWindow.start || index >= nextWindow.end) region.focus({ preventScroll: true });
    }
    setViewport((previous) => {
      const previousWindow = catalogWindow(filteredProducts.length, previous.scrollTop, previous.height, CATALOG_COLUMNS);
      return previousWindow.start === nextWindow.start && previousWindow.end === nextWindow.end && previous.height === next.height && previous.width === next.width
        ? previous : next;
    });
  }, [filteredProducts.length]);

  useLayoutEffect(() => {
    // Measure the sidebar's own results region before painting the first window.
    updateViewport();
  }, [updateViewport]);

  useEffect(() => {
    const region = scrollRegion.current;
    if (!region) return;
    let frame = 0;
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateViewport);
    };
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(region);
    region.addEventListener("scroll", scheduleUpdate, { passive: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      region.removeEventListener("scroll", scheduleUpdate);
    };
  }, [updateViewport]);

  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    const { index, action } = pendingFocus.current;
    const item = scrollRegion.current?.querySelector<HTMLElement>(`button[data-catalog-index="${index}"][data-catalog-action="${action}"]`);
    if (item) {
      pendingFocus.current = null;
      item.focus({ preventScroll: true });
    }
  }, [start, end, columns]);

  function resetResults() {
    setViewport((previous) => ({ ...previous, scrollTop: 0 }));
    pendingFocus.current = null;
    setPlacementError("");
    setAdded("");
    if (scrollRegion.current) scrollRegion.current.scrollTop = 0;
  }

  function focusProduct(index: number, action: "card" | "add" = "card") {
    const region = scrollRegion.current;
    if (!region || index < 0 || index >= filteredProducts.length) return;
    const top = CATALOG_PADDING + Math.floor(index / columns) * CATALOG_ROW_HEIGHT;
    const bottom = top + CATALOG_CARD_HEIGHT;
    if (top < region.scrollTop) region.scrollTop = top - CATALOG_PADDING;
    else if (bottom > region.scrollTop + region.clientHeight) region.scrollTop = bottom - region.clientHeight + CATALOG_PADDING;
    const item = region.querySelector<HTMLElement>(`button[data-catalog-index="${index}"][data-catalog-action="${action}"]`);
    if (item) item.focus({ preventScroll: true });
    else pendingFocus.current = { index, action };
    updateViewport();
  }

  function navigateCatalog(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    const index = target.dataset.catalogIndex === undefined ? null : Number(target.dataset.catalogIndex);
    if (event.key === "Tab" && index !== null) {
      const leavingItem = event.shiftKey ? target.dataset.catalogAction === "card" : target.dataset.catalogAction === "add";
      if (!leavingItem) return;
      const next = index + (event.shiftKey ? -1 : 1);
      if (next >= 0 && next < filteredProducts.length && (next < start || next >= end)) {
        event.preventDefault();
        focusProduct(next, event.shiftKey ? "add" : "card");
      }
      return;
    }
    const current = index ?? Math.min(filteredProducts.length - 1, Math.floor((scrollRegion.current?.scrollTop ?? 0) / CATALOG_ROW_HEIGHT) * columns);
    const next = event.key === "Home" ? 0
      : event.key === "End" ? filteredProducts.length - 1
        : event.key === "ArrowDown" ? Math.min(filteredProducts.length - 1, index === null ? current : current + columns)
          : event.key === "ArrowUp" ? Math.max(0, index === null ? current : current - columns)
            : event.key === "ArrowRight" ? Math.min(filteredProducts.length - 1, index === null ? current : current + 1)
              : event.key === "ArrowLeft" ? Math.max(0, index === null ? current : current - 1)
                : null;
    if (next !== null && filteredProducts.length) { event.preventDefault(); focusProduct(next); }
  }

  function addToRoom(product: CatalogProduct) {
    const success = addItem({
      id: crypto.randomUUID(), articleNumber: product.articleNumber, name: product.title,
      dimensions: { ...product.dimensions }, position: [0, 0, 0], rotationY: 0,
    });
    if (success) {
      setPlacementError("");
      setAdded(`Added ${product.name} at the centre of your room. Select it, then drag its arrows or square to move it.`);
    } else {
      setAdded("");
      setPlacementError(`${product.name} does not fit. Increase the room dimensions and try again.`);
    }
  }

  return (
    <section aria-labelledby="catalog-title" className="flex h-full min-h-0 min-w-0 flex-col text-slate-900">
      <header className="relative z-30 shrink-0 border-b border-slate-200 px-5 pb-4 pt-6">
        <h2 id="catalog-title" className="flex items-center gap-2 text-sm font-semibold"><Armchair size={18} aria-hidden="true" /> Furniture catalog</h2>
        <p className="mt-2 text-sm leading-5 text-slate-600">Choose a piece to add to your room.</p>
        <div className="mt-4 grid gap-2">
          <div className="relative">
            <label htmlFor="catalog-query" className="sr-only">Search furniture</label>
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-500" />
            <Input id="catalog-query" type="search" placeholder="Search name or article number" value={query} aria-controls="catalog-results"
              onChange={(event) => { setQuery(event.currentTarget.value); resetResults(); }}
              className="h-11 min-w-0 rounded-xl border-slate-200 bg-white pl-11 pr-3 text-base shadow-none placeholder:text-slate-500 focus-visible:border-slate-600 focus-visible:ring-slate-600/20 sm:text-sm" />
          </div>
          <div className="relative">
            <label htmlFor="catalog-category" className="sr-only">Category</label>
            <select id="catalog-category" value={category} aria-controls="catalog-results" onChange={(event) => { setCategory(event.currentTarget.value); resetResults(); }}
              className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-700 outline-none focus-visible:border-slate-600 focus-visible:ring-2 focus-visible:ring-slate-600/20 sm:text-sm">
              <option value="">All categories</option>
              {categories.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-slate-600">
          <p role="status" aria-live="polite">{filteredProducts.length.toLocaleString("en-GB")} {filteredProducts.length === 1 ? "piece" : "pieces"}{query.trim() || category ? " found" : " to explore"}</p>
          {(query || category) && <button type="button" className="min-h-8 rounded px-1 font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900" onClick={() => { setQuery(""); setCategory(""); resetResults(); }}>Clear filters</button>}
        </div>
        {placementError && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{placementError}</p>}
        <p role="status" aria-live="polite" className={added ? "mt-3 text-xs leading-5 text-emerald-800" : "sr-only"}>{added}</p>
      </header>
      <div id="catalog-results" ref={scrollRegion} role="region" aria-label="Furniture catalog results" aria-describedby="catalog-keyboard-help" tabIndex={0} onKeyDown={navigateCatalog}
        style={{ overflowAnchor: "none", scrollbarColor: "#94a3b8 #f8fafc", padding: CATALOG_PADDING }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-700">
        {filteredProducts.length ? <ul className="relative" style={{ height: totalHeight }}>
          {filteredProducts.slice(start, end).map((product, offset) => {
            const index = start + offset;
            return (
              <CatalogModelPreview key={product.articleNumber} articleNumber={product.articleNumber} title={product.name}
                thumbnail={product.thumbnail ?? "/og/kind-cabinet.png"} scrollRegion={scrollRegion} index={index} total={filteredProducts.length}
                style={{ top: Math.floor(index / columns) * CATALOG_ROW_HEIGHT, left: `calc(${index % columns} * (100% + ${CATALOG_ROW_GAP}px) / ${columns})`, width: `calc((100% - ${(columns - 1) * CATALOG_ROW_GAP}px) / ${columns})`, height: CATALOG_CARD_HEIGHT }}>
                {(preview) => <>
                <button type="button" data-catalog-index={index} data-catalog-action="card" onClick={() => addToRoom(product)}
                  aria-label={`Add ${product.name} to room, ${product.category}${articlePrices[product.articleNumber] ? `, £${articlePrices[product.articleNumber]}` : ""}, ${product.dimensions.w} metres wide, ${product.dimensions.h} metres high, ${product.dimensions.d} metres deep`}
                  className="absolute inset-0 z-[1] cursor-pointer rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700" />
                <div className="relative mb-3 shrink-0">
                  {preview}
                  <Button type="button" size="icon" data-catalog-index={index} data-catalog-action="add" aria-label={`Add ${product.name} to room`} onClick={() => addToRoom(product)}
                    className="absolute bottom-3 right-3 z-50 min-h-11 min-w-11 rounded-full border-0 bg-white text-slate-900 shadow-sm opacity-0 transition-opacity duration-200 hover:bg-slate-100 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 motion-reduce:transition-none [@media(hover:none)]:opacity-100 [@media(pointer:coarse)]:opacity-100"
                    style={{ pointerEvents: "auto" }}><Plus aria-hidden="true" className="size-5" /></Button>
                </div>
                <h3 title={product.name} className="line-clamp-2 h-10 shrink-0 text-sm font-semibold leading-5 text-slate-900">{product.name}</h3>
                <p title={product.category} className="mt-1 line-clamp-2 h-8 shrink-0 text-xs leading-4 text-slate-600">{product.category}</p>
                <p className="mt-1 h-5 shrink-0 text-sm leading-5 text-slate-600">{articlePrices[product.articleNumber] ? `£${articlePrices[product.articleNumber]}` : ""}</p>
                </>}
              </CatalogModelPreview>
            );
          })}
        </ul> : <div className="flex min-h-56 flex-col items-center justify-center px-4 text-center"><h3 className="text-base font-semibold">No matching furniture</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">Try a different name or article number, or choose another category.</p></div>}
      </div>
      <p id="catalog-keyboard-help" className="sr-only">Use the arrow keys to browse items, or Home and End to jump to the first or last item. Press Enter or Space on an item to add it to your room.</p>
    </section>
  );
}
