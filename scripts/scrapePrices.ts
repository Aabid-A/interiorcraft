/**
 * Extract UK prices without opening a browser or saving product HTML.
 * npm run prices:scrape -- --seed-cache --transport curl
 * npm run prices:scrape -- --refresh --limit 30 --transport curl
 * Existing valid prices survive interrupted runs. Missing prices stay absent.
 */
import { execFile } from "node:child_process";
import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import { parseArgs, promisify } from "node:util";
import { pathToFileURL } from "node:url";

const run = promisify(execFile);
const output = new URL("../public/prices.json", import.meta.url);
const cache = new URL("./ikea/cache/", import.meta.url);
type ObjectValue = Record<string, unknown>;

function object(value: unknown): value is ObjectValue {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function priceString(value: unknown): string | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount.toFixed(2) : null;
}

async function readJson(url: URL, fallback: unknown): Promise<unknown> {
  try { return JSON.parse(await readFile(url, "utf8")); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

function attributes(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map((match) => [match[1].toLowerCase(), match[2] ?? match[3]]));
}

export function extractPrice(html: string, article: string): string | null {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => attributes(match[0]));
  const currency = metas.find((meta) => /^(?:pricecurrency|product:price:currency)$/i.test(meta.name ?? meta.property ?? meta.itemprop ?? ""))?.content;
  if (!currency || currency.toUpperCase() === "GBP") {
    for (const meta of metas) {
      if (!/^(?:price|product:price:amount)$/i.test(meta.name ?? meta.property ?? meta.itemprop ?? "")) continue;
      const price = priceString(meta.content);
      if (price !== null) return price;
    }
  }
  function fromProduct(value: unknown): string | null {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const price = fromProduct(entry);
        if (price !== null) return price;
      }
    } else if (object(value)) {
      const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
      if (types.includes("Product") && (!value.sku || String(value.sku).replace(/\D/g, "") === article)) {
        const offers = Array.isArray(value.offers) ? value.offers : [value.offers];
        for (const offer of offers) {
          if (!object(offer) || offer.priceCurrency !== "GBP") continue;
          const price = priceString(offer.price);
          if (price !== null) return price;
        }
      }
      if (value["@graph"]) return fromProduct(value["@graph"]);
    }
    return null;
  }
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (attributes(script[1]).type?.toLowerCase() !== "application/ld+json") continue;
    try {
      const price = fromProduct(JSON.parse(script[2]));
      if (price !== null) return price;
    } catch {
      // One malformed structured data block must not hide the remaining blocks.
    }
  }
  return null;
}

async function main() {
  const { values } = parseArgs({ options: {
    limit: { type: "string" }, concurrency: { type: "string", default: "4" },
    timeout: { type: "string", default: "12000" }, retries: { type: "string", default: "1" },
    transport: { type: "string", default: "fetch" }, refresh: { type: "boolean", default: false },
    "seed-cache": { type: "boolean", default: false },
  } });
  const concurrency = Number(values.concurrency);
  const timeout = Number(values.timeout);
  const retries = Number(values.retries);
  const limit = values.limit === undefined ? Infinity : Number(values.limit);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) throw new Error("Concurrency must be between 1 and 12");
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 60000) throw new Error("Timeout must be between 1000 and 60000 ms");
  if (!Number.isInteger(retries) || retries < 0 || retries > 3) throw new Error("Retries must be between 0 and 3");
  if (limit !== Infinity && (!Number.isSafeInteger(limit) || limit < 1)) throw new Error("Limit must be a positive integer");
  if (!["fetch", "curl"].includes(values.transport!)) throw new Error("Transport must be fetch or curl");
  const manifest = await readJson(new URL("../public/available_models.json", import.meta.url), []);
  if (!Array.isArray(manifest) || !manifest.every((id) => typeof id === "string" && /^\d{8}$/.test(id))) throw new Error("Invalid model article manifest");
  const articles = [...new Set(manifest as string[])];
  const known = new Set(articles);
  const prices: Record<string, string> = {};
  const existing = await readJson(output, {});
  if (!object(existing)) throw new Error("Expected an article-keyed object in public/prices.json");
  for (const [id, value] of Object.entries(existing)) {
    const price = priceString(value);
    if (known.has(id) && price !== null) prices[id] = price;
  }
  const urls = new Map<string, string>();
  let seeded = 0;
  function visit(value: unknown) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (object(value)) {
      const id = value.itemNo;
      if (typeof id === "string" && known.has(id)) {
        if (typeof value.pipUrl === "string" && value.pipUrl.startsWith("https://www.ikea.com/gb/en/p/") && new RegExp(`-s?${id}/$`).test(value.pipUrl)) urls.set(id, value.pipUrl);
        if (values["seed-cache"] && !prices[id] && object(value.salesPrice) && value.salesPrice.currencyCode === "GBP") {
          const price = priceString(value.salesPrice.numeral);
          if (price !== null) { prices[id] = price; seeded++; }
        }
      }
      Object.values(value).forEach((entry) => { if (entry && typeof entry === "object") visit(entry); });
    }
  }
  let files: string[] = [];
  try { files = await readdir(cache); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const file of files.filter((name) => /^plp-.*\.json$/.test(name)).sort()) visit(await readJson(new URL(file, cache), {}));
  async function persist() {
    const sorted = Object.fromEntries(Object.entries(prices).sort(([a], [b]) => a.localeCompare(b)));
    const temporary = new URL("../public/prices.json.tmp", import.meta.url);
    await writeFile(temporary, `${JSON.stringify(sorted, null, 2)}\n`);
    await rename(temporary, output);
  }
  await persist();
  const pending = articles.filter((id) => values.refresh || !prices[id]).slice(0, limit);
  console.log(`${articles.length} articles, ${urls.size} local UK URLs, ${seeded} cached prices added. Fetching ${pending.length} pages with ${values.transport}.`);
  let next = 0;
  let fetched = 0;
  let checked = 0;
  let failures = 0;
  let consecutiveFailures = 0;
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  async function fetchHtml(url: string) {
    if (values.transport === "curl") {
      const { stdout } = await run("curl", ["-L", "--silent", "--show-error", "--max-time", String(timeout / 1000), "--write-out", "\n%{http_code}\n%{url_effective}", url], { maxBuffer: 8 * 1024 * 1024, timeout: timeout + 2000 });
      const match = stdout.match(/\n(\d{3})\n([^\n]+)$/);
      if (!match) throw new Error("Missing curl response status");
      return { status: Number(match[1]), url: match[2], html: stdout.slice(0, match.index) };
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { "Accept-Language": "en-GB", Accept: "text/html" } });
    return { status: response.status, url: response.url, html: await response.text() };
  }
  // Persist once per bounded batch, so interruption loses at most one batch.
  while (next < pending.length && !stopping) {
    const batch = pending.slice(next, next + concurrency);
    next += batch.length;
    await Promise.all(batch.map(async (id) => {
      try {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            const response = await fetchHtml(urls.get(id) ?? `https://www.ikea.com/gb/en/p/-${id}/`);
            if (response.status === 404 || response.status === 410) { consecutiveFailures = 0; failures++; break; }
            if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
            consecutiveFailures = 0;
            if (!new RegExp(`/gb/en/p/[^/?]*-s?${id}/?$`).test(new URL(response.url).pathname)) { failures++; break; }
            const price = extractPrice(response.html, id);
            if (price !== null) { prices[id] = price; fetched++; }
            else failures++;
            break;
          } catch (error) {
            if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
            else throw error;
          }
        }
      } catch (error) {
        failures++;
        consecutiveFailures++;
        console.warn(`[${id}] ${error instanceof Error ? error.message : String(error)}`);
      } finally { checked++; }
    }));
    await persist();
    if (checked % 40 < concurrency || next >= pending.length) console.log(`${checked}/${pending.length} checked, ${fetched} live prices, ${failures} unavailable or failed.`);
    if (consecutiveFailures >= 16) { console.warn("Stopping after repeated network/server failures. Rerun to resume."); stopping = true; }
    if (!stopping && next < pending.length) await new Promise((resolve) => setTimeout(resolve, 150));
  }
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  console.log(`Saved ${Object.keys(prices).length}/${articles.length} prices: ${seeded} added from local cache, ${fetched} fetched live, ${articles.length - Object.keys(prices).length} missing. Checked ${checked} pages.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
