"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

import { getAllManagedEntries } from "../lib/contentstack/retrieve.js";
import { createEntry, updateEntry, publishEntry, deleteEntry } from "../lib/contentstack/update.js";
import { ContentstackError } from "../lib/contentstack/client.js";
import { config } from "../lib/config.js";
import { getSphereContentByUUID, getSphereContentFromHTML } from "../lib/sphere/retrieve.js";
import { mapSphereToBlogPost } from "../lib/sphere/blogPostMapper.js";
import { localeValidator } from "../lib/locales";
import ukSportsCategoriesData from "../lib/sphere/uk-sports-categories.json" with { type: "json" };
import { Taxonomy } from "../lib/contentstack/types";

type UKSportsCategory = {
  name: string;
  url: string;
  sphereId: string;
  taxonomy: Taxonomy;
  articleIds?: string[];
};

/**
 * For every article sphere ID listed in uk-sports-categories.json, ensure it exists
 * in ContentStack as a blog_post with the correct sport_category taxonomy term.
 *
 * - If the entry **exists**: adds any missing taxonomy terms (merge only, never removes).
 * - If the entry **does not exist**: fetches the full Sphere content, maps it via
 *   mapSphereToBlogPost (dd_sports taxonomies included), merges the UK-category
 *   taxonomy, creates the entry, then publishes.
 * - After any create or update the entry is published immediately.
 * - Set `dryRun: true` to audit without writing anything.
 *
 * @example
 * await api.operations.syncUKCategoryTaxonomies({
 *   locale: "en-GB",
 *   dryRun: false,
 * })
 */
export const syncUKCategoryTaxonomies = action({
  args: {
    locale: localeValidator,
    dryRun: v.optional(v.boolean()),
  },

  handler: async (ctx, args) => {
    const { locale, dryRun = false } = args;
    const { environment } = config.contentstack;
    const TAXONOMY_UID = "sport_category";

    const categories = ukSportsCategoriesData as UKSportsCategory[];

    // --- Phase 1: build article-id → required taxonomy terms index ---
    // One article can appear in several categories → union of all their taxonomies.
    const articleTaxonomies = new Map<string, Set<string>>();
    for (const cat of categories) {
      for (const articleId of cat.articleIds ?? []) {
        const existing = articleTaxonomies.get(articleId) ?? new Set<string>();
        existing.add(cat.taxonomy);
        articleTaxonomies.set(articleId, existing);
      }
    }
    const allArticleIds = [...articleTaxonomies.keys()];

    console.log(`\n=== Sync UK Category Taxonomies ===`);
    console.log(`  Locale        : ${locale}`);
    console.log(`  Dry run       : ${dryRun}`);
    console.log(`  Unique article IDs : ${allArticleIds.length}`);

    // --- Phase 2: fetch CS snapshot indexed by sphere_id ---
    const csEntries = await getAllManagedEntries("blog_post", { locale });
    const csMap = new Map<string, Record<string, unknown>>();
    for (const entry of csEntries) {
      const sid = entry["sphere_id"];
      if (typeof sid === "string") csMap.set(sid, entry as Record<string, unknown>);
    }
    console.log(`  CS entries fetched : ${csEntries.length} (${csMap.size} with sphere_id)`);

    const publishParams = {
      environments: [environment],
      locales: [locale],
    };

    type FailedItem = { sphereId: string; step: string; error: string };
    const created: string[] = [];
    const updated: string[] = [];
    const skipped: string[] = [];
    const failed: FailedItem[] = [];

    // --- Phase 3: process each article ---
    for (const [sphereArticleId, requiredTerms] of articleTaxonomies) {
      try {
        const csEntry = csMap.get(sphereArticleId);

        if (csEntry) {
          // --- Entry exists: check for missing taxonomy terms ---
          const existingTaxonomies = (csEntry["taxonomies"] ?? []) as Array<{
            taxonomy_uid: string;
            term_uid: string;
          }>;
          const existingTerms = new Set(
            existingTaxonomies
              .filter((t) => t.taxonomy_uid === TAXONOMY_UID)
              .map((t) => t.term_uid)
          );

          const missingTerms = [...requiredTerms].filter((t) => !existingTerms.has(t));
          if (missingTerms.length === 0) {
            skipped.push(sphereArticleId);
            continue;
          }

          if (dryRun) {
            updated.push(sphereArticleId);
            continue;
          }

          // Merge: keep existing taxonomies, append missing ones
          const mergedTaxonomies = [
            ...existingTaxonomies,
            ...missingTerms.map((term_uid) => ({ taxonomy_uid: TAXONOMY_UID, term_uid })),
          ];

          // Send only the taxonomies field — CS Management PUT supports partial
          // updates and sending the full entry round-trips expanded reference
          // fields (from include_all=true) that CS rejects on write (error 121).
          const entryUid = csEntry["uid"] as string;
          await updateEntry(
            "blog_post",
            entryUid,
            { entry: { taxonomies: mergedTaxonomies } },
            locale
          );
          await publishEntry("blog_post", entryUid, publishParams, locale);
          updated.push(sphereArticleId);
        } else {
          // --- Entry does not exist: fetch from Sphere and create ---
          if (dryRun) {
            created.push(sphereArticleId);
            continue;
          }

          // Fetch from Sphere: try JSON API first, fall back to HTML renderer
          let sphereContent;
          try {
            sphereContent = await getSphereContentByUUID(sphereArticleId);
          } catch (apiErr) {
            console.warn(`  ↩ Sphere API failed (${apiErr instanceof Error ? apiErr.message : apiErr}), using HTML renderer for ${sphereArticleId}`);
            sphereContent = await getSphereContentFromHTML(sphereArticleId);
          }
          const mapped = mapSphereToBlogPost(sphereContent);

          // Merge dd_sports-derived taxonomies with UK-category taxonomies
          const ddSportsTaxonomies = (mapped["taxonomies"] ?? []) as Array<{
            taxonomy_uid: string;
            term_uid: string;
          }>;
          const ddSportsTerms = new Set(ddSportsTaxonomies.map((t) => t.term_uid));
          const extraTerms = [...requiredTerms].filter((t) => !ddSportsTerms.has(t));
          const finalTaxonomies = [
            ...ddSportsTaxonomies,
            ...extraTerms.map((term_uid) => ({ taxonomy_uid: TAXONOMY_UID, term_uid })),
          ];

          const newEntry = await createEntry(
            "blog_post",
            { ...mapped, taxonomies: finalTaxonomies },
            locale
          );
          try {
            await publishEntry("blog_post", newEntry.uid, publishParams, locale);
          } catch (publishErr) {
            try { await deleteEntry("blog_post", newEntry.uid); } catch { /* best-effort */ }
            throw publishErr;
          }
          created.push(sphereArticleId);
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        const step = csMap.has(sphereArticleId) ? "update" : "create";
        const details = err instanceof ContentstackError && err.errors
          ? ` | details: ${JSON.stringify(err.errors)}`
          : "";
        failed.push({ sphereId: sphereArticleId, step, error });
        console.error(`  ✗ [${step}] ${sphereArticleId}: ${error}${details}`);
      }
    }

    const summary = {
      total: allArticleIds.length,
      created: created.length,
      updated: updated.length,
      skipped: skipped.length,
      failed: failed.length,
    };

    console.log(`\n  Results (dryRun=${dryRun}):`);
    console.log(`  ✅ Created : ${summary.created}`);
    console.log(`  🔄 Updated : ${summary.updated}`);
    console.log(`  ⏭  Skipped : ${summary.skipped}`);
    console.log(`  ✗  Failed  : ${summary.failed}`);
    console.log(`  env=${environment}`);
    console.log(`====================================\n`);

    await ctx.runMutation(api.services.logs.writelog, {
      type: "syncUKCategoryTaxonomies",
      status: failed.length === 0 ? "success" : "error",
      params: { locale, dryRun },
      result: { summary },
      error: failed.length > 0 ? `${failed.length} item(s) failed` : undefined,
    });

    return { summary, params: { locale, dryRun }, failed };
  },
});
