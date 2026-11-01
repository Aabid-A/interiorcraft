export interface BasketItem {
  articleNumber: string;
  name: string;
}

export type ArticlePrices = Readonly<Record<string, string | number | undefined>>;

export interface BasketLine extends BasketItem {
  quantity: number;
  unitPricePence: number | null;
  totalPence: number | null;
}

export interface RoomEstimate {
  lines: BasketLine[];
  quantity: number;
  knownSubtotalPence: number;
  missingPriceQuantity: number;
}

function priceInPence(value: string | number | undefined): number | null {
  if (value === undefined || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) return null;
  const pence = Math.round(Number(value) * 100);
  return Number.isSafeInteger(pence) ? pence : null;
}

export function buildRoomEstimate(items: readonly BasketItem[], prices: ArticlePrices): RoomEstimate {
  const grouped = new Map<string, BasketLine>();
  for (const item of items) {
    const previous = grouped.get(item.articleNumber);
    if (previous) {
      previous.quantity += 1;
      previous.totalPence = previous.unitPricePence === null ? null : previous.unitPricePence * previous.quantity;
    } else {
      const unitPricePence = priceInPence(Object.hasOwn(prices, item.articleNumber) ? prices[item.articleNumber] : undefined);
      grouped.set(item.articleNumber, { ...item, quantity: 1, unitPricePence, totalPence: unitPricePence });
    }
  }
  const lines = [...grouped.values()];
  return {
    lines,
    quantity: items.length,
    knownSubtotalPence: lines.reduce((sum, line) => sum + (line.totalPence ?? 0), 0),
    missingPriceQuantity: lines.reduce((sum, line) => sum + (line.unitPricePence === null ? line.quantity : 0), 0),
  };
}

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatBasketPrice(pence: number): string {
  return gbp.format(pence / 100);
}

