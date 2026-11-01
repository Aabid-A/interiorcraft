/** Accept an article number or an IKEA product URL, without matching unrelated digits. */
export function extractIkeaArticleNumber(input: string): string | null {
  const value = input.trim();

  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (url.hostname !== "ikea.com" && !url.hostname.endsWith(".ikea.com")) return null;
    return url.pathname.match(/\/p\/(?:[a-z0-9]+-)*s?(\d{8})\/?$/i)?.[1] ?? null;
  } catch {
    const digits = value.replace(/\D/g, "");
    return /^\d{8}$/.test(digits) ? digits : null;
  }
}
