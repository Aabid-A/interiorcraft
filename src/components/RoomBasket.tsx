"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ExternalLink, ShoppingBag, Trash2 } from "lucide-react";
import articlePrices from "../../public/prices.json";
import { Button } from "@/components/ui/button";
import { buildRoomEstimate, formatBasketPrice } from "@/lib/roomBasket";
import { useRoomStore } from "@/store/useRoomStore";

export function RoomBasket() {
  const titleId = useId();
  const placedItems = useRoomStore((state) => state.placedItems);
  const removeItem = useRoomStore((state) => state.removeItem);
  const estimate = useMemo(() => buildRoomEstimate(placedItems, articlePrices), [placedItems]);
  const [message, setMessage] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const checkoutPending = useRef(false);
  const mounted = useRef(false);
  const incomplete = estimate.missingPriceQuantity > 0;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function checkoutAtIkea() {
    if (!estimate.quantity || checkoutPending.current) return;
    checkoutPending.current = true;
    setIsTransferring(true);
    setMessage("");
    setCheckoutUrl(null);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 2500));
      if (!mounted.current) return;
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: placedItems }),
        signal: AbortSignal.timeout(15000),
      });
      const data: unknown = await response.json();
      if (!mounted.current) return;
      if (!response.ok) {
        const error = data && typeof data === "object" && "error" in data ? data.error : null;
        throw new Error(typeof error === "string" ? error : "Could not prepare IKEA checkout. Please try again.");
      }
      if (!data || typeof data !== "object" || !("redirectUrl" in data) || typeof data.redirectUrl !== "string") {
        throw new Error("IKEA checkout returned an invalid link. Please try again.");
      }
      const redirect = new URL(data.redirectUrl);
      if (redirect.origin !== "https://www.ikea.com" || !redirect.pathname.startsWith("/gb/en/") || redirect.username || redirect.password) {
        throw new Error("IKEA checkout returned an invalid link. Please try again.");
      }
      setCheckoutUrl(redirect.href);
      window.open(redirect.href, "_blank", "noopener,noreferrer");
      setMessage("IKEA is ready. If the new tab did not open, use the link below.");
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error && error.name === "Error" ? error.message : "Could not prepare IKEA checkout. Please try again.");
    } finally {
      checkoutPending.current = false;
      if (mounted.current) setIsTransferring(false);
    }
  }

  return (
    <section aria-labelledby={titleId} className="border-t border-stone-200 px-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag size={17} aria-hidden="true" /> Room estimate</h2>
        <span className="text-xs tabular-nums text-stone-500">{estimate.quantity} {estimate.quantity === 1 ? "item" : "items"}</span>
      </div>
      {estimate.lines.length ? (
        <ul aria-label="Furniture basket" className="mt-4 max-h-64 space-y-4 overflow-y-auto overscroll-contain [scrollbar-color:#a8a29e_#fafaf9]">
          {estimate.lines.map((line) => (
            <li key={line.articleNumber} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="break-words font-medium leading-5">{line.name} <span className="whitespace-nowrap text-stone-500">×{line.quantity}</span></p>
                <p className="mt-1 break-words text-xs tabular-nums text-stone-500">{line.articleNumber}{line.unitPricePence !== null ? ` · ${formatBasketPrice(line.unitPricePence)} each` : " · Price unavailable"}</p>
              </div>
              <div className="flex shrink-0 items-start gap-2">
                <span className="pt-0.5 text-xs font-medium tabular-nums text-stone-700">{line.totalPence === null ? "Unavailable" : formatBasketPrice(line.totalPence)}</span>
                <button type="button" aria-label={`Remove one ${line.name}`} title="Remove one" onClick={() => removeItem(line.itemIds.at(-1) ?? line.itemIds[0])}
                  className="rounded-md p-1 text-stone-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-700">
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm leading-6 text-stone-500">Add furniture to see your room estimate.</p>}
      <div className="mt-5 border-t border-stone-200 pt-4" aria-live="polite" aria-atomic="true">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">{incomplete ? "Known subtotal" : "Grand total"}</p>
          <p className="text-xl font-semibold tabular-nums text-emerald-600">{formatBasketPrice(estimate.knownSubtotalPence)}</p>
        </div>
        {incomplete && <p className="mt-2 text-xs leading-5 text-amber-800">{estimate.missingPriceQuantity} {estimate.missingPriceQuantity === 1 ? "item needs a price" : "items need prices"}. Estimate incomplete.</p>}
      </div>
      <Button type="button" disabled={!estimate.quantity || isTransferring} onClick={checkoutAtIkea} aria-busy={isTransferring} aria-describedby="basket-checkout-help"
        className="mt-4 h-11 w-full gap-2 rounded-xl bg-[#059669] px-4 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:shadow-none motion-reduce:transition-none">
        {isTransferring ? <span aria-hidden="true" className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" /> : <ExternalLink size={16} aria-hidden="true" />}
        {isTransferring ? "Transferring to IKEA Cart..." : "Checkout at IKEA"}
      </Button>
      <p id="basket-checkout-help" className="mt-2 text-xs leading-5 text-stone-500">Checkout opens an IKEA search for your items in a new tab. Prices in GBP, delivery excluded.</p>
      <p role="status" className="mt-2 text-xs leading-5 text-stone-600">{message}</p>
      {checkoutUrl && <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-medium text-emerald-700 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Open IKEA search</a>}
    </section>
  );
}
