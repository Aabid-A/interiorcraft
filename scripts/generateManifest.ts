import { readdir, writeFile } from "node:fs/promises";

async function generateManifest(): Promise<void> {
  const entries = await readdir(new URL("../public/models/", import.meta.url), { withFileTypes: true });
  const articles = entries
    .filter((entry) => entry.isFile() && /^\d{8}\.glb$/.test(entry.name))
    .map((entry) => entry.name.slice(0, -4))
    .sort();

  await writeFile(new URL("../public/available_models.json", import.meta.url), `${JSON.stringify(articles, null, 2)}\n`);
  console.log(`Generated public/available_models.json with ${articles.length} models.`);
}

generateManifest().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
