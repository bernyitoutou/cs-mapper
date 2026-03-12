/**
 * For each UK sport category, fetch the rendered HTML from the Sphere renderer
 * and extract all article sphere IDs from hrefs matching /c/htc/..._<uuid>.
 *
 * Writes the enriched list to convex/lib/sphere/uk-sports-categories.json.
 *
 * Usage:
 *   pnpm run scrape:uk-articles [--env .env.staging]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getContentHTMLByUUID } from "../convex/lib/sphere/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ---------- env ----------
const envFlagIndex = process.argv.indexOf("--env");
const envFile = envFlagIndex !== -1 ? process.argv[envFlagIndex + 1] : ".env.staging";
try {
  const raw = readFileSync(resolve(root, envFile), "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }
} catch {
  console.warn(`Warning: could not read ${envFile}`);
}

// ---------- types ----------
type SportCategory = {
  name: string;
  url: string;
  sphereId: string;
  taxonomy: string;
  articleIds?: string[];
};

const ARTICLE_HREF_RE =
  /href="https:\/\/www\.decathlon\.co\.uk\/c\/htc\/[^"]+_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/g;

function extractArticleIds(html: string): string[] {
  const ids = new Set<string>();
  for (const [, uuid] of html.matchAll(ARTICLE_HREF_RE)) {
    ids.add(uuid);
  }
  return [...ids];
}

// ---------- main ----------
const categoriesPath = resolve(root, "convex/lib/sphere/uk-sports-categories.json");
const categories: SportCategory[] = JSON.parse(readFileSync(categoriesPath, "utf-8"));

async function main() {
  console.log(`\n=== Scraping article IDs for ${categories.length} UK sport categories ===\n`);

  const results: SportCategory[] = [];

  for (const cat of categories) {
    process.stdout.write(`  ${cat.name.padEnd(20)}`);
    try {
      const html = await getContentHTMLByUUID(cat.sphereId);
      const articleIds = extractArticleIds(html);
      console.log(`→ ${articleIds.length} articles`);
      results.push({ ...cat, articleIds });
    } catch (err) {
      console.log(`→ ERROR: ${(err as Error).message}`);
      results.push({ ...cat, articleIds: [] });
    }
  }

  writeFileSync(categoriesPath, JSON.stringify(results, null, 2) + "\n", "utf-8");
  const total = results.reduce((s, c) => s + (c.articleIds?.length ?? 0), 0);
  console.log(`\n✓ Done — ${total} total article IDs written to convex/lib/sphere/uk-sports-categories.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
