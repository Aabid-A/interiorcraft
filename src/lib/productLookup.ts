import { extractIkeaArticleNumber } from "./ikeaParser";

export interface CatalogProduct {
  articleNumber: string;
  name: string;
  category: string;
  title: string;
  thumbnail?: string;
  price: number | null;
  currency: string;
  /** Bounding dimensions in meters. */
  dimensions: { w: number; h: number; d: number };
}

type CatalogData = Record<string, {
  name: string;
  category: string;
  title: string;
  thumbnail?: string;
  price: { amount: number; currency: string } | null;
  dimensions: { width: number; height: number; depth: number };
}>;

export function catalogProduct(articleNumber: string, product: CatalogData[string]): CatalogProduct {
  return {
    articleNumber,
    name: product.name,
    category: product.category,
    title: product.title,
    thumbnail: product.thumbnail,
    price: product.price?.amount ?? null,
    currency: product.price?.currency ?? "GBP",
    dimensions: {
      w: product.dimensions.width,
      h: product.dimensions.height,
      d: product.dimensions.depth,
    },
  };
}

/** The explicit import keeps catalog data out of the initial client bundle. */
async function loadCatalog(): Promise<CatalogData> {
  const { default: data } = await import("@/data/room-catalog.json");
  return data;
}

export async function searchProducts(input: string): Promise<CatalogProduct[]> {
  const query = input.trim().toLowerCase();
  if (!query) return [];
  const articleQuery = extractIkeaArticleNumber(query) ?? query;
  const products = await loadCatalog();
  return Object.entries(products)
    .filter(([articleNumber, product]) =>
      product.name.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query) ||
      articleNumber.toLowerCase().includes(articleQuery),
    )
    .map(([articleNumber, product]) => catalogProduct(articleNumber, product));
}

export async function lookupProduct(input: string): Promise<CatalogProduct | null> {
  const articleNumber = extractIkeaArticleNumber(input);
  if (!articleNumber) return null;
  const products = await loadCatalog();
  return Object.hasOwn(products, articleNumber) ? catalogProduct(articleNumber, products[articleNumber]) : null;
}
