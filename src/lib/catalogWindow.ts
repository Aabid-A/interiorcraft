// Card padding (24), preview (128), gap (12), name (40), category (36), price (24).
export const CATALOG_CARD_HEIGHT = 264;
export const CATALOG_ROW_GAP = 12;
export const CATALOG_ROW_HEIGHT = CATALOG_CARD_HEIGHT + CATALOG_ROW_GAP;
export const CATALOG_PADDING = 16;
const OVERSCAN_ROWS = 1;

export const CATALOG_COLUMNS = 2;

export function catalogWindow(itemCount: number, scrollTop: number, viewportHeight: number, columns = CATALOG_COLUMNS) {
  const columnCount = Math.max(1, Math.floor(columns));
  const rowCount = Math.ceil(itemCount / columnCount);
  const totalHeight = Math.max(0, rowCount * CATALOG_ROW_HEIGHT - CATALOG_ROW_GAP);
  const maxScrollTop = Math.max(0, totalHeight + CATALOG_PADDING * 2 - viewportHeight);
  const offset = Math.max(0, Math.min(scrollTop, maxScrollTop) - CATALOG_PADDING);
  const startRow = Math.max(0, Math.floor(offset / CATALOG_ROW_HEIGHT) - OVERSCAN_ROWS);
  const endRow = Math.min(rowCount, Math.ceil((offset + viewportHeight) / CATALOG_ROW_HEIGHT) + OVERSCAN_ROWS);
  return { start: startRow * columnCount, end: Math.min(itemCount, endRow * columnCount), totalHeight };
}
