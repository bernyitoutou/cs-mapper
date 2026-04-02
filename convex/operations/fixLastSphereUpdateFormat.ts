"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

import { getAllManagedEntries } from "../lib/contentstack/retrieve.js";
import { updateEntry, publishEntry } from "../lib/contentstack/update.js";
import { config } from "../lib/config.js";
import { ContentType } from "../lib/contentstack/types.js";
import { Locale, localeValidator } from "../lib/locales.js";

/**
 * Re-format the `last_sphere_update` field on all `blog_post` entries tagged
 * with `cs_mapper`.
 *
 * Java's `Instant.toString()` produces `"2024-01-01T12:00:00Z"` (no ms),
 * while JS `new Date().toISOString()` produces `"2024-01-01T12:00:00.000Z"`.
 * This operation normalises every stored value to the JS ISO format so that
 * round-trip parsing is lossless.
 *
 * @example
 * // Dry run — preview changes without writing
 * await api.operations.fixLastSphereUpdateFormat({ dryRun: true });
 *
 * // Live run — apply changes
 * await api.operations.fixLastSphereUpdateFormat({ dryRun: false });
 */
export const fixLastSphereUpdateFormat = action({
  args: {
    locale: localeValidator,
    dryRun: v.optional(v.boolean()),
  },

  handler: async (ctx, args) => {
    const { locale, dryRun = true } = args;
    const { environment } = config.contentstack;

    console.log(`\n=== Fix last_sphere_update format ===`);
    console.log(`  Locale      : ${locale}`);
    console.log(`  Environment : ${environment}`);
    console.log(`  Dry run     : ${dryRun}`);

    const entries = await getAllManagedEntries(ContentType.BlogPost, {
      locale,
      query: JSON.stringify({ tags: "cs_mapper" }),
    });

    console.log(`  Found       : ${entries.length} blog_post entries (tagged cs_mapper)`);

    const skipped: { uid: string; reason: string }[] = [];
    const toUpdate: { uid: string; before: string; after: string }[] = [];
    const failed: { uid: string; error: string }[] = [];

    for (const entry of entries) {
      const uid = entry.uid as string;
      const raw = entry["last_sphere_update"];

      if (typeof raw !== "string" || raw.trim() === "") {
        skipped.push({ uid, reason: "missing or non-string last_sphere_update" });
        continue;
      }

      const parsed = new Date(raw);
      if (isNaN(parsed.getTime())) {
        skipped.push({ uid, reason: `unparseable date: "${raw}"` });
        continue;
      }

      const normalized = parsed.toISOString();

      if (normalized === raw) {
        skipped.push({ uid, reason: "already in correct format" });
        continue;
      }

      toUpdate.push({ uid, before: raw, after: normalized });

      if (!dryRun) {
        try {
          await updateEntry(
            ContentType.BlogPost,
            uid,
            { entry: { ...entry, last_sphere_update: normalized } as Record<string, unknown> },
            locale
          );
          await publishEntry(ContentType.BlogPost, uid, {
            environments: [environment],
            locales: [locale as Locale],
          }, locale);
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          failed.push({ uid, error });
          console.error(`  ✗ ${uid}: ${error}`);
        }
      }
    }

    const updatedCount = dryRun ? 0 : toUpdate.length - failed.length;

    console.log(`  To update : ${toUpdate.length}`);
    console.log(`  Skipped   : ${skipped.length}`);
    if (!dryRun) {
      console.log(`  ✅ Updated : ${updatedCount}`);
      console.log(`  ✗  Failed  : ${failed.length}`);
    }
    console.log(`=====================================\n`);

    if (!dryRun) {
      await ctx.runMutation(api.services.logs.writelog, {
        type: "fixLastSphereUpdateFormat",
        status: failed.length === 0 ? "success" : "error",
        params: { locale, environment, dryRun },
        result: {
          summary: {
            total: entries.length,
            updated: updatedCount,
            skipped: skipped.length,
            failed: failed.length,
          },
        },
        error: failed.length > 0 ? `${failed.length} item(s) failed` : undefined,
      });
    }

    return {
      dryRun,
      summary: {
        total: entries.length,
        toUpdate: toUpdate.length,
        skipped: skipped.length,
        ...(dryRun ? {} : { updated: updatedCount, failed: failed.length }),
      },
      changes: toUpdate,
      skipped,
      ...(dryRun ? {} : { errors: failed }),
    };
  },
});
