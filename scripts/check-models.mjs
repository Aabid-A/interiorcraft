import { open, readFile, stat } from "node:fs/promises";

async function main() {
  const articles = JSON.parse(await readFile(new URL("../public/available_models.json", import.meta.url), "utf8"));
  if (!Array.isArray(articles) || !articles.length || articles.some((article) => !/^\d{8}$/.test(article))) {
    throw new Error("public/available_models.json must list valid model article numbers.");
  }
  for (const article of articles) {
    const path = new URL(`../public/models/${article}.glb`, import.meta.url);
    let file;
    try {
      const info = await stat(path);
      file = await open(path, "r");
      const header = Buffer.alloc(12);
      const { bytesRead } = await file.read(header, 0, 12, 0);
      if (!info.isFile() || bytesRead !== 12 || header.toString("ascii", 0, 4) !== "glTF" ||
          header.readUInt32LE(4) !== 2 || header.readUInt32LE(8) !== info.size) {
        throw new Error("Missing GLB content or unresolved Git LFS pointer.");
      }
    } catch {
      throw new Error(`Model ${article}.glb is missing or invalid. Run git lfs install and git lfs pull locally. On Vercel, enable Git Large File Storage (LFS) under Project Settings > Git, then redeploy.`);
    } finally {
      await file?.close();
    }
  }
  console.log(`Model assets ready: ${articles.length} valid GLB files.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Model asset validation failed.");
  process.exitCode = 1;
});
