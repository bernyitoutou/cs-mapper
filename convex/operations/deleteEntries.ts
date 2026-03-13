"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

import { getAllManagedEntries } from "../lib/contentstack/retrieve.js";
import { unpublishEntry, deleteEntry } from "../lib/contentstack/update.js";
import { config } from "../lib/config.js";
import { localeValidator } from "../lib/locales";
import { contentTypeValidator } from "../lib/contentstack/types";

/**
 * Unpublish and delete all entries of a given content type for a specific locale.
 *
 * Does NOT delete the master entry — only the localized variant is removed.
 * Safe to run per-locale independently.
 *
 * @example
 * await api.operations.deleteEntries({
 *   csContentTypeUid: "blog_post",
 *   locale: "en-GB",
 * })
 */
export const deleteEntries = action({
  args: {
    csContentTypeUid: contentTypeValidator,
    locale: localeValidator,
  },

  handler: async (ctx, args) => {
    const { csContentTypeUid, locale } = args;
    const { environment } = config.contentstack;

    const entries = await getAllManagedEntries(csContentTypeUid, { locale });
    console.log(`\n=== Delete Entries ===`);
    console.log(`  CS type : ${csContentTypeUid}`);
    console.log(`  Locale  : ${locale}`);
    console.log(`  Found   : ${entries.length} entries`);

    const deleted: string[] = [];
    const failed: { uid: string; error: string }[] = [];

    for (const entry of entries) {
      const uid = entry.uid;
      try {
        await unpublishEntry(csContentTypeUid, uid, {
          environments: [environment],
          locales: [locale],
        });
        await deleteEntry(csContentTypeUid, uid, locale);
        deleted.push(uid);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        failed.push({ uid, error });
        console.error(`  ✗ ${uid}: ${error}`);
      }
    }

    console.log(`  ✅ Deleted : ${deleted.length}`);
    console.log(`  ✗  Failed  : ${failed.length}`);
    console.log(`======================\n`);

    await ctx.runMutation(api.services.logs.writelog, {
      type: "deleteEntries",
      status: failed.length === 0 ? "success" : "error",
      params: { csContentTypeUid, locale },
      result: { summary: { total: entries.length, deleted: deleted.length, failed: failed.length } },
      error: failed.length > 0 ? `${failed.length} item(s) failed` : undefined,
    });

    return { summary: { total: entries.length, deleted: deleted.length, failed: failed.length }, failed };
  },
});
