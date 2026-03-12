/**
 * Generate sport group → sport IDs mapping by fetching blog_sport_category
 * entries from ContentStack, then resolving sport IDs via the Referential API.
 *
 * Writes two output files:
 *
 *   convex/lib/fedid/sport_group_mapping.json
 *     { "<sport_ddfs_id>": { "label", "url", "csUid", "taxonomy", "sportIds" } }
 *
 *   resources/all_sport_ids.json
 *     ["<id>", ...] — all unique sport IDs that appear in at least one group
 *
 * Usage:
 *   pnpm generate:sport-mapping [--env .env.production]
 *   (defaults to .env.local if --env is omitted)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSportGroupMapping, fetchBlogSportCategoryEntries } from "../convex/lib/fedid/mapping.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Support --env <file> flag (defaults to .env.local)
const envFlagIndex = process.argv.indexOf("--env");
const envFile = envFlagIndex !== -1 ? process.argv[envFlagIndex + 1] : ".env.local";

// Parse env file manually — env file values take precedence over shell env vars.
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
  console.warn(`Warning: could not read ${envFile}, using shell environment variables`);
}

async function main() {
  const locale = "en-gb";
  console.log(`Fetching blog_sport_category entries from ContentStack (locale: ${locale})...`);
  const entries = await fetchBlogSportCategoryEntries(locale);
  console.log(`Fetched ${entries.length} sport category entries`);

  const { mapping, allSportIds, notFound } = await buildSportGroupMapping(entries, locale);

  if (notFound.length > 0) {
    console.warn(`\n⚠  ${notFound.length} sport group(s) not found in Referential API:`);
    for (const id of notFound) console.warn(`   - ${id}`);
  }

  const mappingPath = resolve(root, "convex", "lib", "fedid", "sport_group_mapping.json");
  const allSportIdsPath = resolve(root, "convex", "lib", "fedid", "all_sport_ids.json");

  writeFileSync(mappingPath, JSON.stringify(mapping, null, 2) + "\n", "utf-8");
  writeFileSync(allSportIdsPath, JSON.stringify(allSportIds, null, 2) + "\n", "utf-8");

  console.log(`\n✓ sport_group_mapping.json — ${Object.keys(mapping).length} sport groups`);
  console.log(`✓ all_sport_ids.json        — ${allSportIds.length} unique sport IDs`);

  console.log("\nSport group → sport IDs summary:");
  for (const [id, info] of Object.entries(mapping)) {
    const count = info.sportIds.length;
    const tax = info.taxonomy ? ` [${info.taxonomy}]` : "";
    const status = count === 0 ? "⚠  no sports found" : `${count} sports`;
    console.log(`  ${id.padEnd(6)} ${info.label.padEnd(30)}${tax.padEnd(25)} ${status}`);
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
