import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium, type BrowserContext } from "playwright";

const CATALOG = new URL("../src/data/room-catalog.json", import.meta.url);
const OUTPUT = new URL("../public/models/", import.meta.url);
const PRICES = new URL("../public/prices.json", import.meta.url);
const PROCESSED_IDS = new URL("../processed_ids.log", import.meta.url);
const ARTICLE = /^\d{8}$/;
const MAX_BYTES = 150 * 1024 * 1024;
const BATCH_SIZE = 75;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Format = "glb" | "usdz";
type Candidate = { url: string; format: Format };

function modelFormat(raw: string): Format | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return /\.(glb|usdz)$/i.exec(url.pathname)?.[1].toLowerCase() as Format | undefined ?? null;
  } catch {
    return null;
  }
}

function validateModel(body: Buffer, format: Format): void {
  if (body.length < 12 || body.length > MAX_BYTES) throw new Error("Invalid model size");
  if (format === "glb") {
    if (body.toString("ascii", 0, 4) !== "glTF" || body.readUInt32LE(4) !== 2 || body.readUInt32LE(8) !== body.length) {
      throw new Error("Response is not a complete GLB version 2 file");
    }
  } else if (body.readUInt32LE(0) !== 0x04034b50 || !/\.usd[ac]?(?:\x00|[^a-z])/i.test(body.toString("latin1"))) {
    throw new Error("Response is not a USDZ archive containing a USD scene");
  }
}

function sourceCandidates(html: string): Candidate[] {
  // Decode URL separators and HTML delimiters without executing embedded scripts.
  const source = html
    .replace(/\\u002f/gi, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/")
    .replace(/&(?:amp|quot|apos|lt|gt);|&#(?:x[0-9a-f]+|[0-9]+);/gi, (entity) => {
      const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };
      if (!entity.startsWith("&#")) return named[entity.slice(1, -1).toLowerCase()];
      const hex = entity[2].toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    });
  const candidates = new Map<string, Candidate>();
  const urls = source.match(/https:\/\/[^\s"'<>`\\]*?\.(?:glb|usdz)(?:\?[^\s"'<>`\\]*)?(?=$|[\s"'<>`\\)\]},;])/gi) ?? [];
  for (const raw of urls) {
    const url = raw.replace(/[)\]},;]+$/, "");
    const format = modelFormat(url);
    if (format) candidates.set(url, { url, format });
  }
  return [...candidates.values()].sort((a, b) => Number(a.format === "usdz") - Number(b.format === "usdz"));
}

async function saveModel(context: BrowserContext, candidate: Candidate, article: string, referer: string): Promise<void> {
  const response = await context.request.get(candidate.url, {
    headers: { Referer: referer },
    timeout: 30_000,
    maxRedirects: 5,
  });
  try {
    if (!response.ok()) throw new Error(`Download returned HTTP ${response.status()}`);
    const headers = response.headers();
    if (/text\/html|application\/json/i.test(headers["content-type"] ?? "")) {
      throw new Error("Download returned an HTML or JSON response");
    }
    if (Number(headers["content-length"]) > MAX_BYTES) throw new Error("Model exceeds 150 MB limit");
    const body = await response.body();
    validateModel(body, candidate.format);
    await writeFile(new URL(`${article}.${candidate.format}`, OUTPUT), body);
  } finally {
    await response.dispose();
  }
}

async function scrapeArticle(context: BrowserContext, article: string, locale: string): Promise<Format | null> {
  const page = await context.newPage();
  try {
    await page.route("**/*", (route) => {
      const resourceType = route.request().resourceType();
      return ["image", "stylesheet", "font", "media"].includes(resourceType)
        ? route.abort()
        : route.continue();
    });
    const response = await page.goto(`https://www.ikea.com/${locale}/p/-${article}/`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    const html = await page.content();
    if (response && !response.ok()) throw new Error(`Product page returned HTTP ${response.status()}`);
    const candidates = sourceCandidates(html);
    if (!candidates.length) {
      console.log(`[${article}] No model URL in page HTML`);
      return null;
    }
    for (const candidate of candidates) {
      try {
        await saveModel(context, candidate, article, page.url());
        return candidate.format;
      } catch (error) {
        console.warn(`[${article}] ${candidate.format.toUpperCase()} download failed: ${errorMessage(error)}`);
      }
    }
    return null;
  } finally {
    await page.close();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readPrices(): Promise<Record<string, unknown>> {
  let raw: string;
  try {
    raw = await readFile(PRICES, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error(`Could not read public/prices.json: ${errorMessage(error)}`);
  }
  let prices: unknown;
  try {
    prices = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in public/prices.json: ${errorMessage(error)}`);
  }
  if (!prices || typeof prices !== "object" || Array.isArray(prices)) {
    throw new Error("Expected an article-keyed object in public/prices.json");
  }
  return prices as Record<string, unknown>;
}

async function readProcessedIds(): Promise<Set<string>> {
  // Append mode creates a missing log without truncating previous attempts.
  await appendFile(PROCESSED_IDS, "", "utf8");
  const raw = await readFile(PROCESSED_IDS, "utf8");
  const processed = new Set<string>();
  let malformed = 0;
  for (const line of raw.split(/\r?\n/)) {
    const article = line.trim();
    if (ARTICLE.test(article)) processed.add(article);
    else if (article) malformed++;
  }
  if (malformed) console.warn(`Ignored ${malformed} malformed lines in processed_ids.log.`);
  // Keep the next record separate even if the last run left an incomplete line.
  if (raw && !raw.endsWith("\n")) await appendFile(PROCESSED_IDS, "\n", "utf8");
  return processed;
}

async function main(): Promise<void> {
  const processedIds = await readProcessedIds();
  let logWrites = Promise.resolve();
  let persistenceFailures = 0;
  const recordAttempt = async (article: string): Promise<void> => {
    // Recover the queue after a failed write so other workers can still persist.
    const write = logWrites.then(() => appendFile(PROCESSED_IDS, `${article}\n`, "utf8"));
    logWrites = write.catch(() => {});
    try {
      await write;
    } catch (error) {
      persistenceFailures++;
      console.error(`[${article}] Could not persist attempt to processed_ids.log: ${errorMessage(error)}`);
    }
  };
  const { values } = parseArgs({
    options: {
      limit: { type: "string" },
      articles: { type: "string" },
      locale: { type: "string", default: "gb/en" },
    },
  });
  const locale = values.locale!;
  if (!/^[a-z]{2}\/[a-z]{2}$/.test(locale)) throw new Error("Use a locale such as gb/en or us/en");
  const limit = values.limit === undefined ? Infinity : Number(values.limit);
  if (limit !== Infinity && (!Number.isSafeInteger(limit) || limit < 1)) throw new Error("Limit must be a positive integer");
  const catalog: unknown = JSON.parse(await readFile(CATALOG, "utf8"));
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) throw new Error("Expected an article-keyed catalog object");
  const available = new Set(Object.keys(catalog).filter((article) => ARTICLE.test(article)));
  const selected = values.articles?.split(",").map((article) => article.trim());
  if (selected?.some((article) => !ARTICLE.test(article) || !available.has(article))) {
    throw new Error("Every selected article must be an eight digit key in the catalog");
  }
  const requested = [...new Set(selected ?? available)];
  if (!requested.length) throw new Error("No valid articles in the catalog");
  const prices = await readPrices();
  const outputPath = fileURLToPath(OUTPUT);
  const pending = requested.filter((article) =>
    !processedIds.has(article) &&
    !existsSync(path.join(outputPath, `${article}.glb`)) &&
    !Object.prototype.hasOwnProperty.call(prices, article)
  );
  const skipped = requested.length - pending.length;
  if (skipped) console.log(`Skipped ${skipped} articles already checked or with existing models or prices.`);
  const articles = pending.slice(0, limit);
  if (!articles.length) {
    console.log("No pending articles to process.");
    return;
  }
  await mkdir(OUTPUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let saved = 0;
  try {
    for (let batchStart = 0; batchStart < articles.length; batchStart += BATCH_SIZE) {
      const batch = articles.slice(batchStart, batchStart + BATCH_SIZE);
      await Promise.all(batch.map(async (article, batchIndex) => {
        if (processedIds.has(article)) return;
        // Claim synchronously before any await to prevent duplicate concurrent attempts.
        processedIds.add(article);
        console.log(`[${batchStart + batchIndex + 1}/${articles.length}] Looking for ${article}`);
        try {
          // Stagger page creation within each batch to spread product requests.
          await sleep(200 + Math.floor(Math.random() * 301));
          const context = await browser.newContext({ locale: "en-GB" });
          try {
            console.log(`[${article}] Checking IKEA ${locale}`);
            const format = await scrapeArticle(context, article, locale);
            if (format) {
              saved++;
              console.log(`[${article}] Saved public/models/${article}.${format}${format === "usdz" ? " (USDZ only, no GLB conversion performed)" : ""}`);
            } else {
              console.warn(`[${article}] No downloadable model found`);
            }
          } finally {
            await context.close();
          }
        } catch (error) {
          console.warn(`[${article}] Skipped: ${errorMessage(error)}`);
        } finally {
          // Includes missing source URLs, downloads and context/page/navigation failures.
          await recordAttempt(article);
        }
      }));
      // Keep the three second pause between batches, including failed attempts.
      if (batchStart + BATCH_SIZE < articles.length) await sleep(3_000);
    }
  } finally {
    await browser.close();
  }
  console.log(`Finished: ${saved}/${articles.length} models saved.`);
  if (persistenceFailures) {
    throw new Error(`${persistenceFailures} attempted articles could not be recorded in processed_ids.log. Those articles may be retried on the next run; see the per-article errors above.`);
  }
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
