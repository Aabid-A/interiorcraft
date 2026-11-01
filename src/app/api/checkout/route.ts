const MAX_BODY_BYTES = 256 * 1024;
const MAX_ITEMS = 200;

export async function POST(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Send a JSON body containing articleNumbers or items." }, { status: 400 });

  let body: unknown;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return Response.json({ error: "Checkout request is too large. Send no more than 256 KB." }, { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return Response.json({ error: "Send valid JSON containing articleNumbers or items." }, { status: 400 });
  } finally {
    reader.releaseLock();
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Send a JSON object containing articleNumbers or items." }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  const hasArticleNumbers = "articleNumbers" in payload;
  const hasItems = "items" in payload;
  if (hasArticleNumbers === hasItems) {
    return Response.json({ error: "Provide either articleNumbers or items, but not both." }, { status: 400 });
  }

  const entries = hasArticleNumbers ? payload.articleNumbers : payload.items;
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_ITEMS) {
    return Response.json({ error: `Checkout requires an array containing 1 to ${MAX_ITEMS} items.` }, { status: 400 });
  }
  const articleNumbers = hasArticleNumbers ? entries : entries.map((item: unknown) => (
    item && typeof item === "object" && "articleNumber" in item ? item.articleNumber : null
  ));
  if (!articleNumbers.every((articleNumber: unknown) => typeof articleNumber === "string" && /^\d{8}$/.test(articleNumber))) {
    return Response.json({ error: "Each article number must be a string containing exactly 8 digits." }, { status: 400 });
  }

  const redirectUrl = "https://www.ikea.com/gb/en/search/?q=" + articleNumbers.join("%20");
  return Response.json({ redirectUrl });
}
