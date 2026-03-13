"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { managementGet } from "../lib/contentstack/client.js";
import { getContentHTMLByUUID } from "../lib/sphere/client.js";
import { localeValidator } from "../lib/locales.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SportCategory = {
  name: string;
  url: string;
  sphereId: string;
  taxonomy: string;
  [key: string]: unknown;
};

type ArticleLink = {
  uuid: string;
  path: string;
  segment: string;
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
  migrationRate: number;
  status: "complete" | "partial" | "empty" | "error";
  error?: string;
};

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_ARTICLE_RE =
  /href="https:\/\/www\.decathlon\.co\.uk(\/c\/([^/"]+)\/[^"]+_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))"/g;

function extractAllArticles(html: string, selfSphereId: string): ArticleLink[] {
  const seen = new Set<string>();
  const links: ArticleLink[] = [];
  for (const [, path, segment, uuid] of html.matchAll(ALL_ARTICLE_RE)) {
    if (!path || !segment || !uuid) continue;
    if (uuid === selfSphereId) continue;
    if (seen.has(uuid)) continue;
    seen.add(uuid);
    links.push({ uuid, path, segment, isHtc: segment === "htc" });
  }
  return links;
}

async function countCsEntriesByTaxonomy(taxonomy: string, locale: string): Promise<number> {
  type Resp = { entries: unknown[]; count?: number };
  const data = await managementGet<Resp>("/content_types/blog_post/entries", {
    locale: locale.toLowerCase(),
    query: JSON.stringify({ "taxonomies.term_uid": taxonomy }),
    include_count: "true",
    limit: "1",
  });
  return data.count ?? data.entries?.length ?? 0;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

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

function buildQuickTable(reports: CategoryReport[]): string[] {
  const lines: string[] = [
    `## 🗂️ Quick Status Table`,
    ``,
    `| # | Category | Sphere HTC | CS | Rate | Progress | Non-HTC | Status |`,
    `|--:|----------|:----------:|:--:|:----:|----------|:-------:|:------:|`,
  ];
  for (const [i, r] of reports.entries()) {
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

function buildQuickReport(reports: CategoryReport[], locale: string, agg: Aggregates): string {
  const n = reports.length;
  const { totalSphereHtc, totalSphereAll, totalSphereNonHtc, totalCs,
          fullyMigrated, partial, empty, errors } = agg;
  return [
    `# 🏅 UK Sports — Migration Quick Report`,
    ``,
    `> ${agg.now} · \`${locale}\` · **${n} categories**`,
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
  ].join("\n");
}

function buildDetailedReport(reports: CategoryReport[], locale: string, agg: Aggregates): string {
  return [
    `# 🏅 UK Sports Categories — Migration Report — Detailed`,
    ``,
    `| | |`,
    `|---|---|`,
    `| **Generated** | ${agg.now} |`,
    `| **Locale** | \`${locale}\` |`,
    `| **Categories scanned** | ${reports.length} |`,
    ``,
    `---`,
    ``,
    `## 📊 Global Summary`,
    ``,
    `### Migration Progress`,
    ``,
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Sphere articles on pages (HTC) | **${agg.totalSphereHtc}** |`,
    `| Sphere total links found (all types) | ${agg.totalSphereAll} |`,
    `| Sphere non-HTC links | ${agg.totalSphereNonHtc} |`,
    `| ContentStack entries with taxonomy | **${agg.totalCs}** |`,
    `| **Global migration rate** (CS / Sphere HTC) | **${pct(agg.totalCs, agg.totalSphereHtc)}** |`,
    ``,
    `\`\`\``,
    `${progressBar(agg.totalCs, agg.totalSphereHtc, 40)} ${pct(agg.totalCs, agg.totalSphereHtc)} (${agg.totalCs} / ${agg.totalSphereHtc})`,
    `\`\`\``,
    ``,
    `### Category Status`,
    ``,
    `| Status | Count | % of categories |`,
    `|--------|------:|:---------------:|`,
    `| ✅ Fully migrated | ${agg.fullyMigrated} | ${pct(agg.fullyMigrated, reports.length)} |`,
    `| 🟡 Partially migrated | ${agg.partial} | ${pct(agg.partial, reports.length)} |`,
    `| 🔴 Not started | ${agg.empty} | ${pct(agg.empty, reports.length)} |`,
    `| ❌ Error | ${agg.errors} | ${pct(agg.errors, reports.length)} |`,
    ``,
    `---`,
    ``,
    ...buildQuickTable(reports),
    ...buildPerCategoryDetail(reports),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Action: Generate Migration Report
// ---------------------------------------------------------------------------

export const generateMigrationReport = action({
  args: {
    locale: localeValidator,
  },
  handler: async (ctx, { locale }) => {
    const categories = (await ctx.runQuery(api.services.sportCategories.listSportCategories, {})) as SportCategory[];

    if (categories.length === 0) {
      throw new Error("No sport categories found. Run seedSportCategories first.");
    }

    const categoryReports: CategoryReport[] = [];

    console.log(`\n=== Migration Report — ${categories.length} categories | locale: ${locale} ===\n`);

    for (const cat of categories) {
      try {
        const html = await getContentHTMLByUUID(cat.sphereId);
        const articles = extractAllArticles(html, cat.sphereId);
        const htcArticles = articles.filter((a) => a.isHtc);
        const nonHtcArticles = articles.filter((a) => !a.isHtc);
        const csTotal = await countCsEntriesByTaxonomy(cat.taxonomy, locale);

        const sphereHtc = htcArticles.length;
        let status: CategoryReport["status"];
        if (sphereHtc === 0 && csTotal === 0) status = "empty";
        else if (csTotal === 0) status = "empty";
        else if (csTotal >= sphereHtc && sphereHtc > 0) status = "complete";
        else status = "partial";

        categoryReports.push({
          name: cat.name,
          taxonomy: cat.taxonomy,
          sphereTotal: articles.length,
          sphereHtc,
          sphereNonHtc: nonHtcArticles.length,
          nonHtcArticles,
          csTotal,
          migrationRate: sphereHtc > 0 ? (csTotal / sphereHtc) * 100 : 0,
          status,
        });

        await sleep(200);
      } catch (err) {
        categoryReports.push({
          name: cat.name,
          taxonomy: cat.taxonomy,
          sphereTotal: 0,
          sphereHtc: 0,
          sphereNonHtc: 0,
          nonHtcArticles: [],
          csTotal: 0,
          migrationRate: 0,
          status: "error",
          error: (err as Error).message,
        });
      }
    }

    const agg = computeAggregates(categoryReports);
    const now = Date.now();
    const dateStr = new Date(now).toISOString().slice(0, 10);

    const quickReport = buildQuickReport(categoryReports, locale, agg);
    const detailedReport = buildDetailedReport(categoryReports, locale, agg);

    await ctx.runMutation(api.services.reports.saveReport, {
      name: `migration-${dateStr}`,
      content: quickReport,
      locale,
      generatedAt: now,
    });
    await ctx.runMutation(api.services.reports.saveReport, {
      name: `migration-${dateStr}-detailed`,
      content: detailedReport,
      locale,
      generatedAt: now,
    });

    return { quickReport, detailedReport, categories: categoryReports };
  },
});
