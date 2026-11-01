"use client";

import { useMemo, useState } from "react";
import { Armchair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import catalog from "@/data/room-catalog.json";
import availableModels from "../../public/available_models.json";
import { extractIkeaArticleNumber } from "@/lib/ikeaParser";
import { catalogProduct, type CatalogProduct } from "@/lib/productLookup";
import { useRoomStore } from "@/store/useRoomStore";

const modelArticles = new Set(availableModels);
const products = Object.entries(catalog)
  .filter(([article]) => modelArticles.has(article))
  .map(([article, product]) => catalogProduct(article, product))
  .sort((a, b) => a.name.localeCompare(b.name));

export function FurnitureCatalog() {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const addItem = useRoomStore((state) => state.addItem);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const article = extractIkeaArticleNumber(query) ?? normalized;
    return products.filter((product) => !normalized || product.name.toLowerCase().includes(normalized) || product.category.toLowerCase().includes(normalized) || product.articleNumber.includes(article));
  }, [query]);

  function place(product: CatalogProduct) {
    const success = addItem({ id: crypto.randomUUID(), articleNumber: product.articleNumber, name: product.title, dimensions: { ...product.dimensions }, position: [0, 0, 0], rotationY: 0 });
    setMessage(success ? `Added ${product.name}.` : `${product.name} does not fit. Increase the room dimensions and try again.`);
  }

  return (
    <section aria-label="Furniture catalog" className="flex h-full min-h-0 flex-col text-slate-900">
      <header className="shrink-0 border-b border-slate-200 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Armchair size={18} aria-hidden="true" /> Furniture catalog</h2>
        <label htmlFor="catalog-query" className="sr-only">Search furniture</label>
        <Input id="catalog-query" type="search" placeholder="Search name or article number" value={query} onChange={(event) => setQuery(event.currentTarget.value)} className="mt-4" />
        <p role="status" className="mt-2 text-xs">{message || `${filtered.length} pieces to explore`}</p>
      </header>
      <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {filtered.map((product) => <li key={product.articleNumber} className="rounded-xl border border-slate-200 p-3"><h3 className="text-sm font-semibold">{product.name}</h3><p className="mt-1 text-xs text-slate-600">{product.category}</p><Button className="mt-3" onClick={() => place(product)}>Add to room</Button></li>)}
      </ul>
    </section>
  );
}
