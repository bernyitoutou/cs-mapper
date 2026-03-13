/**
 * Generates a Markdown migration report for UK sports categories.
 *
 * For each category in uk-sports-categories.json:
 *   - Fetches the Sphere renderer HTML (fresh) and classifies every article link
 *     as HTC (`/c/htc/`) or other.
 *   - Queries the ContentStack Management API for blog_post entries that carry
 *     the category taxonomy term (includes drafts → full import state).
 *
 * Writes reports/migration-report-YYYY-MM-DD.md
 *
 * Usage:
 *   pnpm run report:migration [--env .env.staging] [--locale en-GB]
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { managementGet } from "../convex/lib/contentstack/client.js";
import { getContentHTMLByUUID } from "../convex/lib/sphere/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ---------- env ----------
const envFlagIndex = process.argv.indexOf("--env");
const envFile =
  envFlagIndex !== -1 ? process.argv[envFlagIndex + 1] : ".env.staging";
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

const localeFlagIndex = process.argv.indexOf("--locale");
const LOCALE =
  localeFlagIndex !== -1 ? process.argv[localeFlagIndex + 1] : "en-GB";

// ---------- types ----------
type SportCategory = {
  name: string;
  url: string;
  sphereId: string;
  taxonomy: string;
  articleIds?: string[];
};

type ArticleLink = {
  uuid: string;
  path: string;
  segment: string; // "htc", "lp", "article", …
  isHtc: boolean;
};

type CategoryReport = {
  name: string;
  taxonomy: string;
  sphereTotal: number;
  sphereHtc: number;
  sphereNonHtc: number;
  nonHtcArticles: ArticleLink[];
  csTotal: number;
  migrationRate: number; // csTotal / sphereHtc × 100
  status: "complete" | "partial" | "empty" | "error";
  error?: string;
};

// ---------- sphere parsing ----------

/**
 * Captures every internal article link on a Sphere category page.
 * Pattern: /c/{segment}/{title}_{uuid}
 * Excludes the category page's own UUID to avoid self-references.
 */
const ALL_ARTICLE_RE =
  /href="https:\/\/www\.decathlon\.co\.uk(\/c\/([^/"]+)\/[^"]+_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))"/g;

function extractAllArticles(html: string, selfSphereId: string): ArticleLink[] {
  const seen = new Set<string>();
  const links: ArticleLink[] = [];

  for (const [, path, segment, uuid] of html.matchAll(ALL_ARTICLE_RE)) {
    if (uuid === selfSphereId) continue; // skip self
    if (seen.has(uuid)) continue;
    seen.add(uuid);
    links.push({ uuid, path, segment, isHtc: segment === "htc" });
  }

  return links;
}

// ---------- ContentStack ----------

async function countCsEntriesByTaxonomy(taxonomy: string): Promise<number> {
  type Resp = { entries: unknown[]; count?: number };
  const data = await managementGet<Resp>("/content_types/blog_post/entries", {
    locale: LOCALE.toLowerCase(),
    query: JSON.stringify({ "taxonomies.term_uid": taxonomy }),
    include_count: "true",
    limit: "1",
  });
  return data.count ?? data.entries?.length ?? 0;
}

// ---------- helpers ----------

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function statusEmoji(s: CategoryReport["status"]): string {
  return { complete: "✅", partial: "🟡", empty: "🔴", error: "❌" }[s];
}

function progressBar(n: number, d: number, width = 10): string {
  if (d === 0) return "░".repeat(width);
  const filled = Math.round((n / d) * width);
  return "█".repeat(Math.min(filled, width)) + "░".repeat(Math.max(width - filled, 0));
}

// ---------- markdown builders ----------

type Aggregates = {
  now: string;
  totalSphereHtc: number;
  totalSphereAll: number;
  totalSphereNonHtc: number;
  totalCs: number;
  fullyMigrated: number;
  partial: number;
  empty: number;
  errors: number;
};

function computeAggregates(reports: CategoryReport[]): Aggregates {
  return {
    now: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
    totalSphereHtc: reports.reduce((s, r) => s + r.sphereHtc, 0),
    totalSphereAll: reports.reduce((s, r) => s + r.sphereTotal, 0),
    totalSphereNonHtc: reports.reduce((s, r) => s + r.sphereNonHtc, 0),
    totalCs: reports.reduce((s, r) => s + r.csTotal, 0),
    fullyMigrated: reports.filter((r) => r.status === "complete").length,
    partial: reports.filter((r) => r.status === "partial").length,
    empty: reports.filter((r) => r.status === "empty").length,
    errors: reports.filter((r) => r.status === "error").length,
  };
}

function buildHeader(
  title: string,
  locale: string,
  agg: Aggregates,
  categoryCount: number
): string[] {
  return [
    `# 🏅 UK Sports Categories — ${title}`,
    ``,
    `| | |`,
    `|---|---|`,
    `| **Generated** | ${agg.now} |`,
    `| **Locale** | \`${locale}\` |`,
    `| **Environment** | staging |`,
    `| **Categories scanned** | ${categoryCount} |`,
    ``,
    `---`,
    ``,
  ];
}

function buildGlobalSummary(agg: Aggregates, categoryCount: number): string[] {
  const { totalSphereHtc, totalSphereAll, totalSphereNonHtc, totalCs,
          fullyMigrated, partial, empty, errors } = agg;
  return [
    `## 📊 Global Summary`,
    ``,
    `### Migration Progress`,
    ``,
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Sphere articles on pages (HTC) | **${totalSphereHtc}** |`,
    `| Sphere total links found (all types) | ${totalSphereAll} |`,
    `| Sphere non-HTC links | ${totalSphereNonHtc} |`,
    `| ContentStack entries with taxonomy | **${totalCs}** |`,
    `| **Global migration rate** (CS / Sphere HTC) | **${pct(totalCs, totalSphereHtc)}** |`,
    ``,
    `\`\`\``,
    `${progressBar(totalCs, totalSphereHtc, 40)} ${pct(totalCs, totalSphereHtc)} (${totalCs} / ${totalSphereHtc})`,
    `\`\`\``,
    ``,
    `### Category Status`,
    ``,
    `| Status | Count | % of categories |`,
    `|--------|------:|:---------------:|`,
    `| ✅ Fully migrated | ${fullyMigrated} | ${pct(fullyMigrated, categoryCount)} |`,
    `| 🟡 Partially migrated | ${partial} | ${pct(partial, categoryCount)} |`,
    `| 🔴 Not started | ${empty} | ${pct(empty, categoryCount)} |`,
    `| ❌ Error | ${errors} | ${pct(errors, categoryCount)} |`,
    ``,
    `---`,
    ``,
  ];
}

function buildQuickTable(reports: CategoryReport[]): string[] {
  const lines: string[] = [
    `## 🗂️ Quick Status Table`,
    ``,
    `| # | Category | Sphere HTC | CS | Rate | Progress | Non-HTC | Status |`,
    `|--:|----------|:----------:|:--:|:----:|----------|:-------:|:------:|`,
  ];
  for (let i = 0; i < reports.length; i++) {
    const r = reports[i];
    lines.push(
      `| ${i + 1} | ${r.name} | ${r.sphereHtc} | ${r.csTotal} | ${pct(r.csTotal, r.sphereHtc)} | \`${progressBar(r.csTotal, r.sphereHtc, 8)}\` | ${r.sphereNonHtc} | ${statusEmoji(r.status)} |`
    );
  }
  return lines;
}

function buildPerCategoryDetail(reports: CategoryReport[]): string[] {
  const lines: string[] = [``, `---`, ``, `## 📋 Per-Category Detail`, ``];
  for (const r of reports) {
    lines.push(
      `### ${statusEmoji(r.status)} ${r.name}`,
      ``,
      `> **Taxonomy:** \`${r.taxonomy}\``,
      ``,
      `| Metric | Value |`,
      `|--------|------:|`,
      `| Sphere articles found on page (total) | ${r.sphereTotal} |`,
      `| &nbsp;&nbsp;↳ HTC \`/c/htc/\` | **${r.sphereHtc}** |`,
      `| &nbsp;&nbsp;↳ Non-HTC (other paths) | ${r.sphereNonHtc} |`,
      `| ContentStack entries with taxonomy | **${r.csTotal}** |`,
      `| **Migration rate** | **${pct(r.csTotal, r.sphereHtc)}** |`,
      ``
    );
    if (r.error) {
      lines.push(`> ⚠️ **Error during fetch:** \`${r.error}\``, ``);
    }
    if (r.sphereHtc > 0) {
      lines.push(
        `\`\`\``,
        `${progressBar(r.csTotal, r.sphereHtc, 20)} ${pct(r.csTotal, r.sphereHtc)} (${r.csTotal} / ${r.sphereHtc})`,
        `\`\`\``,
        ``
      );
    }
    if (r.nonHtcArticles.length > 0) {
      lines.push(
        `<details>`,
        `<summary>⚠️ Non-HTC articles found on page (${r.nonHtcArticles.length})</summary>`,
        ``,
        `| Segment | UUID | Path |`,
        `|---------|------|------|`
      );
      for (const a of r.nonHtcArticles) {
        lines.push(`| \`${a.segment}\` | \`${a.uuid}\` | \`${a.path}\` |`);
      }
      lines.push(``, `</details>`, ``);
    }
    lines.push(`---`, ``);
  }
  return lines;
}

function buildQuickReport(reports: CategoryReport[], locale: string): string {
  const agg = computeAggregates(reports);
  const { now, totalSphereHtc, totalSphereAll, totalSphereNonHtc, totalCs,
          fullyMigrated, partial, empty, errors } = agg;
  const n = reports.length;

  const lines: string[] = [
    `# 🏅 UK Sports — Migration Quick Report`,
    ``,
    `> ${now} · \`${locale}\` · staging · **${n} categories**`,
    ``,
    `---`,
    ``,
    `## 📊 Summary`,
    ``,
    `| Sphere HTC | + Non-HTC | = Total links | CS entries | **Rate** |`,
    `|:----------:|:---------:|:-------------:|:----------:|:--------:|`,
    `| **${totalSphereHtc}** | ${totalSphereNonHtc} | ${totalSphereAll} | **${totalCs}** | **${pct(totalCs, totalSphereHtc)}** |`,
    ``,
    `\`${progressBar(totalCs, totalSphereHtc, 36)} ${pct(totalCs, totalSphereHtc)} (${totalCs} / ${totalSphereHtc})\``,
    ``,
    `| ✅ Complete | 🟡 Partial | 🔴 Empty | ❌ Error |`,
    `|:-----------:|:---------:|:--------:|:-------:|`,
    `| ${fullyMigrated} *(${pct(fullyMigrated, n)})* | ${partial} *(${pct(partial, n)})* | ${empty} *(${pct(empty, n)})* | ${errors} *(${pct(errors, n)})* |`,
    ``,
    `---`,
    ``,
    ...buildQuickTable(reports),
    ``,
  ];
  return lines.join("\n");
}

function buildDetailedReport(reports: CategoryReport[], locale: string): string {
  const agg = computeAggregates(reports);
  return [
    ...buildHeader("Migration Report — Detailed", locale, agg, reports.length),
    ...buildGlobalSummary(agg, reports.length),
    ...buildQuickTable(reports),
    ...buildPerCategoryDetail(reports),
  ].join("\n");
}

// ---------- main ----------

const categoriesPath = resolve(
  root,
  "convex/lib/sphere/uk-sports-categories.json"
);
const categories: SportCategory[] = JSON.parse(
  readFileSync(categoriesPath, "utf-8")
);

async function main() {
  console.log(
    `\n=== Migration Report — ${categories.length} categories | locale: ${LOCALE} ===\n`
  );

  const reports: CategoryReport[] = [];

  for (const cat of categories) {
    process.stdout.write(`  ${cat.name.padEnd(24)}`);

    try {
      // 1. Fresh sphere scrape (HTC + non-HTC)
      const html = await getContentHTMLByUUID(cat.sphereId);
      const articles = extractAllArticles(html, cat.sphereId);
      const htcArticles = articles.filter((a) => a.isHtc);
      const nonHtcArticles = articles.filter((a) => !a.isHtc);

      // 2. CS count by taxonomy
      const csTotal = await countCsEntriesByTaxonomy(cat.taxonomy);

      // 3. Determine status
      const sphereHtc = htcArticles.length;
      let status: CategoryReport["status"];
      if (sphereHtc === 0 && csTotal === 0) status = "empty";
      else if (csTotal === 0) status = "empty";
      else if (csTotal >= sphereHtc && sphereHtc > 0) status = "complete";
      else status = "partial";

      const migrationRate = sphereHtc > 0 ? (csTotal / sphereHtc) * 100 : 0;

      process.stdout.write(
        `sphere: ${articles.length} (${sphereHtc} HTC + ${nonHtcArticles.length} other) | CS: ${csTotal} | ${migrationRate.toFixed(0)}%\n`
      );

      reports.push({
        name: cat.name,
        taxonomy: cat.taxonomy,
        sphereTotal: articles.length,
        sphereHtc,
        sphereNonHtc: nonHtcArticles.length,
        nonHtcArticles,
        csTotal,
        migrationRate,
        status,
      });

      await sleep(200); // gentle rate limiting
    } catch (err) {
      const error = (err as Error).message;
      console.log(`ERROR: ${error}`);
      reports.push({
        name: cat.name,
        taxonomy: cat.taxonomy,
        sphereTotal: 0,
        sphereHtc: 0,
        sphereNonHtc: 0,
        nonHtcArticles: [],
        csTotal: 0,
        migrationRate: 0,
        status: "error",
        error,
      });
    }
  }

  // Write reports
  const reportsDir = resolve(root, "reports");
  mkdirSync(reportsDir, { recursive: true });

  const dateStamp = new Date().toISOString().split("T")[0];
  const quickPath    = resolve(reportsDir, `migration-report-${dateStamp}.md`);
  const detailedPath = resolve(reportsDir, `migration-report-${dateStamp}-detailed.md`);

  writeFileSync(quickPath,    buildQuickReport(reports, LOCALE),    "utf-8");
  writeFileSync(detailedPath, buildDetailedReport(reports, LOCALE), "utf-8");

  // Console summary
  const totalSphereHtc = reports.reduce((s, r) => s + r.sphereHtc, 0);
  const totalCs = reports.reduce((s, r) => s + r.csTotal, 0);
  const fullyMigrated = reports.filter((r) => r.status === "complete").length;
  const partial = reports.filter((r) => r.status === "partial").length;
  const empty = reports.filter((r) => r.status === "empty").length;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Sphere HTC total  : ${totalSphereHtc}`);
  console.log(`  CS total          : ${totalCs}`);
  console.log(`  Global rate       : ${pct(totalCs, totalSphereHtc)}`);
  console.log(`  ✅ Complete       : ${fullyMigrated}`);
  console.log(`  🟡 Partial        : ${partial}`);
  console.log(`  🔴 Empty          : ${empty}`);
  console.log(`${"─".repeat(60)}`);
  console.log(`\n✓ Reports written to:`);
  console.log(`  reports/migration-report-${dateStamp}.md`);
  console.log(`  reports/migration-report-${dateStamp}-detailed.md\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
