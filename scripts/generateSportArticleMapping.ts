/**
 * For each UK sport category:
 *   1. Fetch the Sphere renderer HTML to extract the `contentListFilters`
 *      (specifically `ddSports` and `contentType`) from the `block_dynamic_teaser` brick.
 *   2. Call the Sphere content API (paginated) with those filters to get ALL articles.
 *   3. Enrich uk-sports-categories.json with `articleSphereIds` and write the output.
 *
 * Usage:
 *   pnpm generate:sport-article-mapping [--env .env.staging]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getContentHTMLByUUID } from "../convex/lib/sphere/client.js";
import { getAllSphereContents } from "../convex/lib/sphere/retrieve.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ---------- env ----------
const envFlagIndex = process.argv.indexOf("--env");
const envFile = envFlagIndex !== -1 ? process.argv[envFlagIndex + 1] : ".env.staging";
try {
  const raw = readFileSync(resolve(root, envFile), "utf-8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const ei = t.indexOf("=");
    if (ei === -1) continue;
    const key = t.slice(0, ei).trim();
    const val = t.slice(ei + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] = val;
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
};

type ContentListFilters = {
  contentType: string[];
  ddSports: number[];
};

// ---------- HTML parsing ----------

/**
 * Extract `contentListFilters` from the `block_dynamic_teaser` brick embedded
 * in the renderer HTML script tag.
 *
 * The embedded data is JavaScript object literal notation (not strict JSON),
 * so we use targeted regex extraction rather than JSON.parse.
 */
function extractContentListFilters(html: string): ContentListFilters | null {
  // Find the one <script> block
  const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (!scriptMatch) return null;
  const script = scriptMatch[1];

  // Locate block_dynamic_teaser section
  const dynIdx = script.indexOf("block_dynamic_teaser");
  if (dynIdx === -1) return null;
  const section = script.slice(dynIdx, dynIdx + 12000);

  // Extract contentListFilters object up to its closing brace (simple text slice)
  const filtersStart = section.indexOf("contentListFilters:");
  if (filtersStart === -1) return null;

  // Slice from 'contentListFilters:{' to the matching '}'
  const braceStart = section.indexOf("{", filtersStart);
  if (braceStart === -1) return null;
  let depth = 0;
  let braceEnd = braceStart;
  for (let i = braceStart; i < section.length; i++) {
    if (section[i] === "{") depth++;
    else if (section[i] === "}") {
      depth--;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }
  }
  const filtersStr = section.slice(braceStart, braceEnd + 1);

  // Extract contentType array
  const ctMatch = filtersStr.match(/contentType:\[([^\]]*)\]/);
  const contentType: string[] = ctMatch
    ? ctMatch[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
    : [];

  // Extract ddSports array
  const dsMatch = filtersStr.match(/ddSports:\[([^\]]*)\]/);
  const ddSports: number[] = dsMatch
    ? dsMatch[1].split(",").map((s) => Number(s.trim().replace(/^["']|["']$/g, ""))).filter((n) => !isNaN(n) && n > 0)
    : [];

  return { contentType, ddSports };
}

// ---------- main ----------

async function main() {
  const categoriesPath = resolve(root, "convex/lib/sphere/uk-sports-categories.json");
  const categories: SportCategory[] = JSON.parse(readFileSync(categoriesPath, "utf-8"));

  // Optional: filter to one category for testing (--category <name>)
  const catFlagIndex = process.argv.indexOf("--category");
  const catFilter = catFlagIndex !== -1 ? process.argv[catFlagIndex + 1].toLowerCase() : null;
  const toProcess = catFilter
    ? categories.filter((c) => c.name.toLowerCase() === catFilter)
    : categories;

  if (toProcess.length === 0) {
    console.error(`No category matched: ${catFilter}`);
    process.exit(1);
  }

  console.log(`\n=== Sphere Article Mapping ===`);
  console.log(`  Categories : ${toProcess.length}`);
  console.log(`  Env file   : ${envFile}`);
  console.log(`  Renderer   : ${process.env.SPHERE_RENDERER_URL}`);
  console.log(`  Sphere API : ${process.env.SPHERE_HOST}\n`);

  const results: Array<SportCategory & { ddSports: number[]; articleSphereIds: string[] }> = [];

  for (const cat of toProcess) {
    process.stdout.write(`  [${cat.name}] Fetching renderer...`);

    let filters: ContentListFilters | null = null;
    try {
      const html = await getContentHTMLByUUID(cat.sphereId);
      filters = extractContentListFilters(html);
    } catch (err) {
      console.log(` ✗ renderer error: ${(err as Error).message}`);
      results.push({ ...cat, ddSports: [], articleSphereIds: [] });
      continue;
    }

    if (!filters || filters.ddSports.length === 0) {
      console.log(` ⚠ no ddSports filter found`);
      results.push({ ...cat, ddSports: [], articleSphereIds: [] });
      continue;
    }

    process.stdout.write(` ddSports=[${filters.ddSports.join(",")}] → querying articles...`);

    // Query all articles matching those sport IDs across all relevant content types.
    // We iterate over each content type listed in contentListFilters to be complete.
    const seenIds = new Set<string>();

    for (const contentTypeId of filters.contentType) {
      try {
        const articles = await getAllSphereContents({
          contentTypeId,
          ddSports: filters.ddSports,
          locale: "en-GB",
          status: 1,
        });
        for (const a of articles) seenIds.add(a.id);
      } catch {
        // some content types may return 0 or error – skip silently
      }
    }

    const articleSphereIds = [...seenIds];
    console.log(` ${articleSphereIds.length} articles`);
    results.push({ ...cat, ddSports: filters.ddSports, articleSphereIds });

    // Small delay between categories to be a good API citizen
    await new Promise((r) => setTimeout(r, 200));
  }

  const outputPath = resolve(root, "convex/lib/sphere/uk-sports-categories.json");

  if (catFilter) {
    // Only update the processed categories in the existing file
    const existing: Array<SportCategory & { ddSports?: number[]; articleSphereIds?: string[] }> =
      JSON.parse(readFileSync(outputPath, "utf-8"));
    for (const r of results) {
      const idx = existing.findIndex((e) => e.sphereId === r.sphereId);
      if (idx !== -1) existing[idx] = r;
    }
    writeFileSync(outputPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
    console.log(`\n✓ Updated ${results.length} categor${results.length === 1 ? "y" : "ies"} in ${outputPath}`);
  } else {
    writeFileSync(outputPath, JSON.stringify(results, null, 2) + "\n", "utf-8");
    console.log(`\n✓ Wrote ${results.length} categories to ${outputPath}`);
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
