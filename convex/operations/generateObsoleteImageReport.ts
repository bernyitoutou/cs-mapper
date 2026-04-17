"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { config } from "../lib/config.js";
import { getContentHTMLByUUID } from "../lib/sphere/client.js";
import { getSphereContentFromHTML } from "../lib/sphere/retrieve.js";

type SportCategory = {
  name: string;
  url: string;
  sphereId: string;
  taxonomy: string;
  [key: string]: unknown;
};

type CategoryArticleLink = {
  uuid: string;
  path: string;
  url: string;
};

type ArticleAudit = {
  uuid: string;
  title: string;
  articleUrl?: string;
  pixlUrl?: string;
  alt?: string;
  status: "ok" | "obsolete" | "missing" | "error";
  reason: string;
  width?: number;
  height?: number;
  httpStatus?: number;
  contentType?: string;
  bytes?: number;
  error?: string;
};

type CategoryItem = ArticleAudit & {
  path: string;
  categoryUrl: string;
};

type CategoryReport = {
  name: string;
  url: string;
  taxonomy: string;
  totalArticles: number;
  checkedArticles: number;
  obsoleteCount: number;
  missingCount: number;
  errorCount: number;
  obsoleteArticles: CategoryItem[];
  missingArticles: CategoryItem[];
  errors: CategoryItem[];
  status: "clean" | "obsolete" | "missing" | "error";
  error?: string;
};

type Summary = {
  generatedAtIso: string;
  categoriesScanned: number;
  totalArticles: number;
  checkedArticles: number;
  obsoleteImages: number;
  missingImages: number;
  errors: number;
  categoriesWithObsoleteImages: number;
};

type ParsedDimensions = {
  width: number;
  height: number;
};

type ImageProbe = ParsedDimensions & {
  httpStatus: number;
  contentType?: string;
  bytes: number;
};

const ARTICLE_RE =
  /href="https:\/\/www\.decathlon\.co\.uk(\/c\/htc\/[^\"]+_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))"/g;

function extractCategoryArticles(html: string, selfSphereId: string): CategoryArticleLink[] {
  const links: CategoryArticleLink[] = [];
  const seen = new Set<string>();
  for (const [, path, uuid] of html.matchAll(ARTICLE_RE)) {
    if (!path || !uuid || uuid === selfSphereId || seen.has(uuid)) continue;
    seen.add(uuid);
    links.push({
      uuid,
      path,
      url: `https://www.decathlon.co.uk${path}`,
    });
  }
  return links;
}

function parsePngDimensions(bytes: Uint8Array): ParsedDimensions | null {
  if (bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) return null;
  }
  const width =
    (bytes[16] << 24) |
    (bytes[17] << 16) |
    (bytes[18] << 8) |
    bytes[19];
  const height =
    (bytes[20] << 24) |
    (bytes[21] << 16) |
    (bytes[22] << 8) |
    bytes[23];
  return { width: width >>> 0, height: height >>> 0 };
}

function parseJpegDimensions(bytes: Uint8Array): ParsedDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;

    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) break;

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    offset += 2;
    if (segmentLength < 2 || offset + segmentLength - 2 > bytes.length) break;

    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isStartOfFrame) {
      if (segmentLength < 7) return null;
      const height = (bytes[offset + 1] << 8) | bytes[offset + 2];
      const width = (bytes[offset + 3] << 8) | bytes[offset + 4];
      return { width, height };
    }

    offset += segmentLength - 2;
  }

  return null;
}

function parseImageDimensions(bytes: Uint8Array, contentType?: string): ParsedDimensions | null {
  const normalizedType = contentType?.toLowerCase() ?? "";
  if (normalizedType.includes("png")) return parsePngDimensions(bytes);
  if (normalizedType.includes("jpeg") || normalizedType.includes("jpg")) {
    return parseJpegDimensions(bytes);
  }

  return parsePngDimensions(bytes) ?? parseJpegDimensions(bytes);
}

async function inspectPixlImage(url: string): Promise<ImageProbe> {
  const response = await fetch(url, {
    headers: {
      Range: "bytes=0-65535",
    },
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? undefined;
  const dimensions = parseImageDimensions(bytes, contentType);

  return {
    httpStatus: response.status,
    contentType,
    bytes: bytes.length,
    width: dimensions?.width ?? 0,
    height: dimensions?.height ?? 0,
  };
}

function buildPixlUrl(mediaId: string, securityKey: string): string {
  const numericId = mediaId.replace(/\D/g, "");
  const pixlHost = config.sphere.pixlHost ?? "https://contents.mediadecathlon.com";
  return `${pixlHost}/${mediaId}/k$${securityKey}/${numericId}_default.jpg`;
}

async function auditArticle(uuid: string): Promise<ArticleAudit> {
  try {
    const article = await getSphereContentFromHTML(uuid);
    const title = article.title ?? uuid;
    const articleUrl = typeof article.url === "string" ? article.url : undefined;

    if (!article.teaser_image?.media_id || !article.teaser_image?.security_key) {
      return {
        uuid,
        title,
        articleUrl,
        status: "missing",
        reason: "no_teaser_image",
      };
    }

    const pixlUrl = buildPixlUrl(
      article.teaser_image.media_id,
      article.teaser_image.security_key
    );
    const probe = await inspectPixlImage(pixlUrl);

    if (probe.width === 1 && probe.height === 1) {
      return {
        uuid,
        title,
        articleUrl,
        pixlUrl,
        alt: article.teaser_image.alt_title,
        status: "obsolete",
        reason: "pixl_1x1",
        width: probe.width,
        height: probe.height,
        httpStatus: probe.httpStatus,
        contentType: probe.contentType,
        bytes: probe.bytes,
      };
    }

    if (probe.httpStatus === 404 || probe.httpStatus === 410) {
      return {
        uuid,
        title,
        articleUrl,
        pixlUrl,
        alt: article.teaser_image.alt_title,
        status: "obsolete",
        reason: `pixl_http_${probe.httpStatus}`,
        width: probe.width,
        height: probe.height,
        httpStatus: probe.httpStatus,
        contentType: probe.contentType,
        bytes: probe.bytes,
      };
    }

    if (probe.httpStatus < 200 || probe.httpStatus >= 300) {
      return {
        uuid,
        title,
        articleUrl,
        pixlUrl,
        alt: article.teaser_image.alt_title,
        status: "error",
        reason: `pixl_http_${probe.httpStatus}`,
        width: probe.width,
        height: probe.height,
        httpStatus: probe.httpStatus,
        contentType: probe.contentType,
        bytes: probe.bytes,
        error: `Unexpected Pixl response status ${probe.httpStatus}`,
      };
    }

    return {
      uuid,
      title,
      articleUrl,
      pixlUrl,
      alt: article.teaser_image.alt_title,
      status: "ok",
      reason: "ok",
      width: probe.width,
      height: probe.height,
      httpStatus: probe.httpStatus,
      contentType: probe.contentType,
      bytes: probe.bytes,
    };
  } catch (error) {
    return {
      uuid,
      title: uuid,
      status: "error",
      reason: "audit_failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function toCategoryItem(audit: ArticleAudit, link: CategoryArticleLink, categoryUrl: string): CategoryItem {
  return {
    ...audit,
    articleUrl: audit.articleUrl ?? link.url,
    path: link.path,
    categoryUrl,
  };
}

function summarize(reports: CategoryReport[]): Summary {
  return {
    generatedAtIso: new Date().toISOString(),
    categoriesScanned: reports.length,
    totalArticles: reports.reduce((sum, report) => sum + report.totalArticles, 0),
    checkedArticles: reports.reduce((sum, report) => sum + report.checkedArticles, 0),
    obsoleteImages: reports.reduce((sum, report) => sum + report.obsoleteCount, 0),
    missingImages: reports.reduce((sum, report) => sum + report.missingCount, 0),
    errors: reports.reduce((sum, report) => sum + report.errorCount, 0),
    categoriesWithObsoleteImages: reports.filter((report) => report.obsoleteCount > 0).length,
  };
}

function buildQuickReport(reports: CategoryReport[], summary: Summary): string {
  const lines = [
    "# Obsolete Images Report",
    "",
    `> Generated ${summary.generatedAtIso}`,
    "",
    "## Summary",
    "",
    `| Categories | Articles | Checked | Obsolete | Missing image | Errors |`,
    `|-----------:|---------:|--------:|---------:|--------------:|-------:|`,
    `| ${summary.categoriesScanned} | ${summary.totalArticles} | ${summary.checkedArticles} | ${summary.obsoleteImages} | ${summary.missingImages} | ${summary.errors} |`,
    "",
    "## By Category URL",
    "",
    `| Category | URL | Articles | Obsolete | Missing | Errors | Status |`,
    `|----------|-----|---------:|---------:|--------:|-------:|--------|`,
  ];

  for (const report of reports) {
    lines.push(
      `| ${report.name} | ${report.url} | ${report.totalArticles} | ${report.obsoleteCount} | ${report.missingCount} | ${report.errorCount} | ${report.status} |`
    );
  }

  return lines.join("\n");
}

function buildDetailedReport(reports: CategoryReport[], summary: Summary): string {
  const lines = [
    "# Obsolete Images Report — Detailed",
    "",
    `> Generated ${summary.generatedAtIso}`,
    "",
    "## Summary",
    "",
    `- Categories scanned: ${summary.categoriesScanned}`,
    `- Articles discovered: ${summary.totalArticles}`,
    `- Articles checked: ${summary.checkedArticles}`,
    `- Obsolete images: ${summary.obsoleteImages}`,
    `- Missing images: ${summary.missingImages}`,
    `- Errors: ${summary.errors}`,
    "",
  ];

  for (const report of reports) {
    lines.push(
      `## ${report.name}`,
      "",
      `- URL: ${report.url}`,
      `- Taxonomy: ${report.taxonomy}`,
      `- Articles found: ${report.totalArticles}`,
      `- Obsolete images: ${report.obsoleteCount}`,
      `- Missing images: ${report.missingCount}`,
      `- Errors: ${report.errorCount}`,
      ""
    );

    if (report.error) {
      lines.push(`- Category error: ${report.error}`, "");
      continue;
    }

    if (report.obsoleteArticles.length > 0) {
      lines.push(
        "### Obsolete Images",
        "",
        `| Title | Article URL | Sphere ID | Size | HTTP | Image URL |`,
        `|-------|-------------|-----------|------|------|-----------|`
      );
      for (const item of report.obsoleteArticles) {
        lines.push(
          `| ${item.title.replace(/\|/g, "\\|")} | ${item.articleUrl ?? ""} | ${item.uuid} | ${item.width ?? 0}x${item.height ?? 0} | ${item.httpStatus ?? ""} | ${item.pixlUrl ?? ""} |`
        );
      }
      lines.push("");
    }

    if (report.missingArticles.length > 0) {
      lines.push(
        "### Missing Images",
        "",
        `| Title | Article URL | Sphere ID | Reason |`,
        `|-------|-------------|-----------|--------|`
      );
      for (const item of report.missingArticles) {
        lines.push(
          `| ${item.title.replace(/\|/g, "\\|")} | ${item.articleUrl ?? ""} | ${item.uuid} | ${item.reason} |`
        );
      }
      lines.push("");
    }

    if (report.errors.length > 0) {
      lines.push(
        "### Errors",
        "",
        `| Sphere ID | Article URL | Error |`,
        `|-----------|-------------|-------|`
      );
      for (const item of report.errors) {
        lines.push(`| ${item.uuid} | ${item.articleUrl ?? ""} | ${item.error ?? item.reason} |`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function buildReportName(prefix: string, categoryUrl?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  if (!categoryUrl) return `${prefix}-${date}`;

  const slug = categoryUrl
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 50);
  return `${prefix}-${slug}-${date}`;
}

export const generateObsoleteImageReport = action({
  args: {
    categoryUrl: v.optional(v.string()),
  },
  handler: async (ctx, { categoryUrl }) => {
    const categories = (await ctx.runQuery(
      api.services.sportCategories.listSportCategories,
      {}
    )) as SportCategory[];

    const selectedCategories = categoryUrl
      ? categories.filter((category) => category.url === categoryUrl)
      : categories;

    if (selectedCategories.length === 0) {
      throw new Error(
        categoryUrl
          ? `No sport category found for url=${categoryUrl}`
          : "No sport categories found. Run seedSportCategories first."
      );
    }

    const auditCache = new Map<string, Promise<ArticleAudit>>();
    const reports: CategoryReport[] = [];

    for (const category of selectedCategories) {
      try {
        const html = await getContentHTMLByUUID(category.sphereId);
        const articleLinks = extractCategoryArticles(html, category.sphereId);

        const auditedLinks = await Promise.all(
          articleLinks.map(async (link) => {
            const existing = auditCache.get(link.uuid);
            const auditPromise = existing ?? auditArticle(link.uuid);
            if (!existing) auditCache.set(link.uuid, auditPromise);
            const audit = await auditPromise;
            return { link, item: toCategoryItem(audit, link, category.url) };
          })
        );

        const obsoleteArticles = auditedLinks
          .filter(({ item }) => item.status === "obsolete")
          .map(({ item }) => item);
        const missingArticles = auditedLinks
          .filter(({ item }) => item.status === "missing")
          .map(({ item }) => item);
        const errors = auditedLinks
          .filter(({ item }) => item.status === "error")
          .map(({ item }) => item);

        let status: CategoryReport["status"] = "clean";
        if (errors.length > 0) status = "error";
        else if (obsoleteArticles.length > 0) status = "obsolete";
        else if (missingArticles.length > 0) status = "missing";

        reports.push({
          name: category.name,
          url: category.url,
          taxonomy: category.taxonomy,
          totalArticles: articleLinks.length,
          checkedArticles: auditedLinks.filter(({ item }) => item.status !== "missing").length,
          obsoleteCount: obsoleteArticles.length,
          missingCount: missingArticles.length,
          errorCount: errors.length,
          obsoleteArticles,
          missingArticles,
          errors,
          status,
        });
      } catch (error) {
        reports.push({
          name: category.name,
          url: category.url,
          taxonomy: category.taxonomy,
          totalArticles: 0,
          checkedArticles: 0,
          obsoleteCount: 0,
          missingCount: 0,
          errorCount: 1,
          obsoleteArticles: [],
          missingArticles: [],
          errors: [],
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const summary = summarize(reports);
    const quickReport = buildQuickReport(reports, summary);
    const detailedReport = buildDetailedReport(reports, summary);
    const generatedAt = Date.now();

    await ctx.runMutation(api.services.reports.saveReport, {
      name: buildReportName("obsolete-images", categoryUrl),
      content: quickReport,
      locale: "en-GB",
      generatedAt,
    });
    await ctx.runMutation(api.services.reports.saveReport, {
      name: buildReportName("obsolete-images-detailed", categoryUrl),
      content: detailedReport,
      locale: "en-GB",
      generatedAt,
    });

    await ctx.runMutation(api.services.logs.writelog, {
      type: "generate_obsolete_image_report",
      status: reports.some((report) => report.status === "error") ? "error" : "success",
      params: { categoryUrl },
      result: summary,
      error: reports.some((report) => report.status === "error")
        ? `${reports.filter((report) => report.status === "error").length} category scan(s) failed`
        : undefined,
    });

    return { summary, quickReport, detailedReport, categories: reports };
  },
});