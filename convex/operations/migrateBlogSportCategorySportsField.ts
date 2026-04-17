"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

import { getAllManagedEntries } from "../lib/contentstack/retrieve.js";
import { publishEntry, updateEntry } from "../lib/contentstack/update.js";
import { config } from "../lib/config.js";
import { ContentType } from "../lib/contentstack/types.js";
import { Locale, localeValidator } from "../lib/locales.js";

type BlogSportCategoryEntry = {
  uid: string;
  sport_ddfs_id?: unknown;
  is_sport_group?: unknown;
  sports?: unknown;
  [key: string]: unknown;
};

type SportFieldItem = {
  sport_ddfs_id: number;
  is_sport_group: boolean;
};

function parseLegacySportId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseLegacySportGroup(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  return null;
}

function normalizeExistingSports(value: unknown): SportFieldItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: SportFieldItem[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const sportId = parseLegacySportId((item as Record<string, unknown>).sport_ddfs_id);
    const isSportGroup = parseLegacySportGroup((item as Record<string, unknown>).is_sport_group);

    if (sportId === null || isSportGroup === null) {
      continue;
    }

    normalized.push({
      sport_ddfs_id: sportId,
      is_sport_group: isSportGroup,
    });
  }

  return normalized;
}

function hasSameSport(items: SportFieldItem[], candidate: SportFieldItem): boolean {
  return items.some(
    (item) =>
      item.sport_ddfs_id === candidate.sport_ddfs_id &&
      item.is_sport_group === candidate.is_sport_group
  );
}

/**
 * Populate the new `sports` array field on `blog_sport_category` entries by
 * copying the existing `sport_ddfs_id` and `is_sport_group` values.
 *
 * Legacy fields are preserved. If `sports` already contains the equivalent
 * object, the entry is skipped. Existing valid `sports` items are preserved.
 */
export const migrateBlogSportCategorySportsField = action({
  args: {
    locale: localeValidator,
    dryRun: v.optional(v.boolean()),
    publishAfterUpdate: v.optional(v.boolean()),
    clearLegacyFields: v.optional(v.boolean()),
  },

  handler: async (ctx, args) => {
    const {
      locale,
      dryRun = true,
      publishAfterUpdate = false,
      clearLegacyFields = false,
    } = args;
    const { environment } = config.contentstack;

    const entries = await getAllManagedEntries<BlogSportCategoryEntry>(ContentType.BlogSportCategory, {
      locale,
    });

    console.log("\n=== Migrate blog_sport_category sports field ===");
    console.log(`  Locale      : ${locale}`);
    console.log(`  Dry run     : ${dryRun}`);
    console.log(`  Publish     : ${publishAfterUpdate && !dryRun}`);
    console.log(`  Clear old   : ${clearLegacyFields && !dryRun}`);
    console.log(`  Found       : ${entries.length} entries`);

    const changes: Array<{
      uid: string;
      before: SportFieldItem[];
      appended: SportFieldItem;
      after: SportFieldItem[];
    }> = [];
    const skippedMissingLegacy: Array<{ uid: string; reason: string }> = [];
    const skippedAlreadyPresent: string[] = [];
    const failed: Array<{ uid: string; error: string }> = [];

    for (const entry of entries) {
      const uid = entry.uid;
      const sportId = parseLegacySportId(entry.sport_ddfs_id);
      const isSportGroup = parseLegacySportGroup(entry.is_sport_group);

      if (sportId === null || isSportGroup === null) {
        skippedMissingLegacy.push({
          uid,
          reason: "missing or invalid legacy sport_ddfs_id / is_sport_group values",
        });
        continue;
      }

      const existingSports = normalizeExistingSports(entry.sports);
      const legacySport: SportFieldItem = {
        sport_ddfs_id: sportId,
        is_sport_group: isSportGroup,
      };

      if (hasSameSport(existingSports, legacySport)) {
        skippedAlreadyPresent.push(uid);
        continue;
      }

      const nextSports = [...existingSports, legacySport];

      changes.push({
        uid,
        before: existingSports,
        appended: legacySport,
        after: nextSports,
      });

      if (dryRun) {
        continue;
      }

      try {
        await updateEntry(
          ContentType.BlogSportCategory,
          uid,
          {
            entry: {
              ...entry,
              sports: nextSports,
              ...(clearLegacyFields
                ? {
                    sport_ddfs_id: null,
                    is_sport_group: null,
                  }
                : {}),
            },
          },
          locale
        );

        if (publishAfterUpdate) {
          await publishEntry(
            ContentType.BlogSportCategory,
            uid,
            {
              environments: [environment],
              locales: [locale as Locale],
            },
            locale
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ uid, error: message });
        console.error(`  ✗ ${uid}: ${message}`);
      }
    }

    const updated = dryRun ? 0 : changes.length - failed.length;

    console.log(`  To update   : ${changes.length}`);
    console.log(`  Skipped old : ${skippedMissingLegacy.length}`);
    console.log(`  Skipped new : ${skippedAlreadyPresent.length}`);
    if (!dryRun) {
      console.log(`  ✅ Updated   : ${updated}`);
      console.log(`  ✗ Failed    : ${failed.length}`);
    }
    console.log("===============================================\n");

    await ctx.runMutation(api.services.logs.writelog, {
      type: "migrateBlogSportCategorySportsField",
      status: failed.length === 0 ? "success" : "error",
      params: {
        locale,
        dryRun,
        publishAfterUpdate: publishAfterUpdate && !dryRun,
        clearLegacyFields: clearLegacyFields && !dryRun,
      },
      result: {
        summary: {
          total: entries.length,
          toUpdate: changes.length,
          skippedMissingLegacy: skippedMissingLegacy.length,
          skippedAlreadyPresent: skippedAlreadyPresent.length,
          ...(dryRun ? {} : { updated, failed: failed.length }),
        },
      },
      error: failed.length > 0 ? `${failed.length} item(s) failed` : undefined,
    });

    return {
      dryRun,
      clearLegacyFields,
      summary: {
        total: entries.length,
        toUpdate: changes.length,
        skippedMissingLegacy: skippedMissingLegacy.length,
        skippedAlreadyPresent: skippedAlreadyPresent.length,
        ...(dryRun ? {} : { updated, failed: failed.length }),
      },
      changes,
      skippedMissingLegacy,
      skippedAlreadyPresent,
      ...(dryRun ? {} : { failed }),
    };
  },
});