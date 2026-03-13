"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

import { getAllManagedEntries } from "../lib/contentstack/retrieve.js";
import { updateEntry, publishEntry } from "../lib/contentstack/update.js";
import { config } from "../lib/config.js";
import { setNestedValue } from "../lib/utils.js";
import { localeValidator } from "../lib/locales";
import { contentTypeValidator } from "../lib/contentstack/types";

/**
 * Set a single field to a given value across all entries of a content type for a specific locale,
 * then optionally republish.
 *
 * The field supports dot-notation for nested paths (e.g. `"metadata.robot_no_follow"`).
 * Only the specified locale is modified — the master entry is not touched.
 *
 * @example
 * await api.operations.massFieldUpdate({
 *   csContentTypeUid: "blog_sport_category",
 *   locale: "en-GB",
 *   field: "is_active",
 *   value: false,
 *   publishAfterUpdate: true,
 * })
 */
export const massFieldUpdate = action({
  args: {
    csContentTypeUid: contentTypeValidator,
    locale: localeValidator,
    /** Dot-notation field path to update, e.g. "is_active" or "metadata.robot_no_follow" */
    field: v.string(),
    /** Value to set on the field */
    value: v.any(),
    publishAfterUpdate: v.optional(v.boolean()),
  },

  handler: async (ctx, args) => {
    const { csContentTypeUid, locale, field, value, publishAfterUpdate = false } = args;
    const { environment } = config.contentstack;

    const entries = await getAllManagedEntries(csContentTypeUid, { locale });
    console.log(`\n=== Mass Field Update ===`);
    console.log(`  CS type : ${csContentTypeUid}`);
    console.log(`  Locale  : ${locale}`);
    console.log(`  Field   : ${field} = ${JSON.stringify(value)}`);
    console.log(`  Publish : ${publishAfterUpdate}`);
    console.log(`  Found   : ${entries.length} entries`);

    const updated: string[] = [];
    const failed: { uid: string; error: string }[] = [];

    for (const entry of entries) {
      const uid = entry.uid;
      try {
        // Build updated payload with only the target field changed
        const payload = setNestedValue({ ...entry } as Record<string, unknown>, field, value);
        await updateEntry(csContentTypeUid, uid, { entry: payload }, locale);
        if (publishAfterUpdate) {
          await publishEntry(csContentTypeUid, uid, {
            environments: [environment],
            locales: [locale],
          }, locale);
        }
        updated.push(uid);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        failed.push({ uid, error });
        console.error(`  ✗ ${uid}: ${error}`);
      }
    }

    console.log(`  ✅ Updated : ${updated.length}`);
    console.log(`  ✗  Failed  : ${failed.length}`);
    console.log(`=========================\n`);

    await ctx.runMutation(api.services.logs.writelog, {
      type: "massFieldUpdate",
      status: failed.length === 0 ? "success" : "error",
      params: { csContentTypeUid, locale, field, value: JSON.stringify(value), publishAfterUpdate },
      result: { summary: { total: entries.length, updated: updated.length, failed: failed.length } },
      error: failed.length > 0 ? `${failed.length} item(s) failed` : undefined,
    });

    return { summary: { total: entries.length, updated: updated.length, failed: failed.length }, failed };
  },
});
