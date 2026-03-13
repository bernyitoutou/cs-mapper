"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { getContentHTMLByUUID } from "../lib/sphere/client.js";
import { getAllSphereContents } from "../lib/sphere/retrieve.js";
import { localeValidator } from "../lib/locales.js";

type SportCategoryRecord = {
  _id: unknown;
  _creationTime: number;
  name: string;
  url: string;
  sphereId: string;
  taxonomy: string;
  ddSports?: number[];
  articleSphereIds?: string[];
  articleIds?: string[];
  updatedAt: number;
};

type ContentListFilters = {
  contentType: string[];
  ddSports: number[];
};

const ARTICLE_HREF_RE =
  /href="https:\/\/www\.decathlon\.co\.uk\/c\/htc\/[^\"]+_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/g;

function extractArticleIds(html: string): string[] {
  const ids = new Set<string>();
  for (const [, uuid] of html.matchAll(ARTICLE_HREF_RE)) {
    if (uuid) ids.add(uuid);
  }
  return [...ids];
}

function extractContentListFilters(html: string): ContentListFilters | null {
  const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (!scriptMatch) return null;
  const script = scriptMatch[1] ?? "";

  const dynamicTeaserStart = script.indexOf("block_dynamic_teaser");
  if (dynamicTeaserStart === -1) return null;
  const section = script.slice(dynamicTeaserStart, dynamicTeaserStart + 12000);

  const filtersStart = section.indexOf("contentListFilters:");
  if (filtersStart === -1) return null;

  const braceStart = section.indexOf("{", filtersStart);
  if (braceStart === -1) return null;

  let depth = 0;
  let braceEnd = braceStart;
  for (let index = braceStart; index < section.length; index += 1) {
    if (section[index] === "{") depth += 1;
    if (section[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        braceEnd = index;
        break;
      }
    }
  }

  const filtersString = section.slice(braceStart, braceEnd + 1);
  const contentTypeMatch = filtersString.match(/contentType:\[([^\]]*)\]/);
  const ddSportsMatch = filtersString.match(/ddSports:\[([^\]]*)\]/);

  const contentType = contentTypeMatch
    ? (contentTypeMatch[1] ?? "")
        .split(",")
        .map((value) => value.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
    : [];

  const ddSports = ddSportsMatch
    ? (ddSportsMatch[1] ?? "")
        .split(",")
        .map((value) => Number(value.trim().replace(/^["']|["']$/g, "")))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];

  return { contentType, ddSports };
}

export const enrichSportCategories = action({
  args: {
    locale: v.optional(localeValidator),
    sphereId: v.optional(v.string()),
  },
  handler: async (ctx, { locale = "en-GB", sphereId }) => {
    const allCategories = (await ctx.runQuery(api.services.sportCategories.listSportCategories, {})) as SportCategoryRecord[];
    const categories = sphereId
      ? allCategories.filter((category) => category.sphereId === sphereId)
      : allCategories;

    if (categories.length === 0) {
      throw new Error(sphereId ? `No sport category found for sphereId=${sphereId}` : "No sport categories found. Seed the table first.");
    }

    const updated: Array<{
      sphereId: string;
      name: string;
      ddSports: number[];
      articleIds: number;
      articleSphereIds: number;
    }> = [];
    const failed: Array<{ sphereId: string; name: string; error: string }> = [];

    for (const category of categories) {
      try {
        const html = await getContentHTMLByUUID(category.sphereId);
        const articleIds = extractArticleIds(html);
        const filters = extractContentListFilters(html);

        const seenArticleSphereIds = new Set<string>();
        for (const contentTypeId of filters?.contentType ?? []) {
          try {
            const contents = await getAllSphereContents({
              contentTypeId,
              ddSports: filters?.ddSports ?? [],
              locale,
              status: 1,
            });
            for (const content of contents) {
              seenArticleSphereIds.add(content.id);
            }
          } catch {
            // Some content types can error or be empty. Continue with the rest.
          }
        }

        await ctx.runMutation(api.services.sportCategories.upsertSportCategory, {
          name: category.name,
          url: category.url,
          sphereId: category.sphereId,
          taxonomy: category.taxonomy,
          ddSports: filters?.ddSports?.length ? filters.ddSports : undefined,
          articleSphereIds: seenArticleSphereIds.size > 0 ? [...seenArticleSphereIds] : undefined,
          articleIds,
        });

        updated.push({
          sphereId: category.sphereId,
          name: category.name,
          ddSports: filters?.ddSports ?? [],
          articleIds: articleIds.length,
          articleSphereIds: seenArticleSphereIds.size,
        });
      } catch (error) {
        failed.push({
          sphereId: category.sphereId,
          name: category.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const summary = {
      total: categories.length,
      updated: updated.length,
      failed: failed.length,
    };

    await ctx.runMutation(api.services.logs.writelog, {
      type: "enrich_sport_categories",
      status: failed.length === 0 ? "success" : "error",
      params: { locale, sphereId },
      result: summary,
      error: failed.length > 0 ? `${failed.length} category enrichment(s) failed` : undefined,
    });

    return {
      summary,
      updated,
      failed,
    };
  },
});