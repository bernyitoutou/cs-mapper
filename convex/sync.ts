"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

import { getAllEntries } from "./lib/contentstack/retrieve.js";
import { getAllSphereContents } from "./lib/sphere/retrieve.js";
import { getNestedValue } from "./lib/utils.js";

/**
 * Check the sync state between a Sphere content type and a ContentStack content type.
 *
 * Fetches all published items on both sides, compares them on user-supplied
 * dot-notation field paths, and returns a report with counts and unmatched keys.
 *
 * @example
 * await api.sync.checkSyncStatus({
 *   sphereContentTypeId: "875ef604-5ca2-4ed9-96b7-15e6c6e0fd0d",
 *   sphereMatchField: "id",
 *   csContentTypeUid: "product_page",
 *   csMatchField: "sphere_id",
 *   locale: "fr-FR",
 * })
 */
export const checkSyncStatus = action({
  args: {
    /** UUID of the Sphere content type to compare */
    sphereContentTypeId: v.string(),
    /** Dot-notation path to extract the match key from a Sphere item. e.g. "id", "body.model_code" */
    sphereMatchField: v.string(),
    /** ContentStack content type UID. e.g. "product_page" */
    csContentTypeUid: v.string(),
    /** Dot-notation path to extract the match key from a CS entry. e.g. "sphere_id", "uid" */
    csMatchField: v.string(),
    /** Locale filter applied to both sides. e.g. "fr-FR" */
    locale: v.optional(v.string()),
    /**
     * Sphere publication status filter.
     * 1 = published (default), 0 = draft
     */
    sphereStatus: v.optional(v.number()),
  },

  handler: async (_ctx, args) => {
    const sphereStatus = (args.sphereStatus ?? 1) as 0 | 1;

    // 1. Fetch all published Sphere items
    const sphereItems = await getAllSphereContents({
      contentTypeId: args.sphereContentTypeId,
      locale: args.locale,
      status: sphereStatus,
    });

    // 2. Fetch all published CS entries (Delivery API)
    const csEntries = await getAllEntries(args.csContentTypeUid, {
      locale: args.locale,
    });

    // 3. Extract match keys from Sphere items
    const sphereKeys = new Set<string>();
    let sphereMissingField = 0;
    for (const item of sphereItems) {
      const val = getNestedValue(item, args.sphereMatchField);
      if (val != null) {
        sphereKeys.add(String(val));
      } else {
        sphereMissingField++;
      }
    }

    // 4. Extract match keys from CS entries
    const csKeys = new Set<string>();
    let csMissingField = 0;
    for (const entry of csEntries) {
      const val = getNestedValue(entry, args.csMatchField);
      if (val != null) {
        csKeys.add(String(val));
      } else {
        csMissingField++;
      }
    }

    // 5. Compute diff
    const synced = [...sphereKeys].filter((k) => csKeys.has(k));
    const onlyInSphere = [...sphereKeys].filter((k) => !csKeys.has(k));
    const onlyInCS = [...csKeys].filter((k) => !sphereKeys.has(k));

    const syncRate =
      sphereKeys.size > 0
        ? `${((synced.length / sphereKeys.size) * 100).toFixed(1)}%`
        : "N/A";

    const report = {
      params: {
        sphereContentTypeId: args.sphereContentTypeId,
        sphereMatchField: args.sphereMatchField,
        sphereStatus,
        csContentTypeUid: args.csContentTypeUid,
        csMatchField: args.csMatchField,
        locale: args.locale ?? "all",
      },
      summary: {
        sphere: {
          total: sphereItems.length,
          withMatchField: sphereKeys.size,
          missingMatchField: sphereMissingField,
        },
        contentstack: {
          total: csEntries.length,
          withMatchField: csKeys.size,
          missingMatchField: csMissingField,
        },
        sync: {
          synced: synced.length,
          onlyInSphere: onlyInSphere.length,
          onlyInContentStack: onlyInCS.length,
          syncRate,
        },
      },
      details: {
        /** Sphere match-field values not found in ContentStack */
        onlyInSphere,
        /** ContentStack match-field values not found in Sphere */
        onlyInContentStack: onlyInCS,
      },
    };

    // 6. Log to Convex dashboard
    console.log("\n=== Sync Status Report ===");
    console.log(`  Sphere type     : ${args.sphereContentTypeId}`);
    console.log(`  CS type         : ${args.csContentTypeUid}`);
    console.log(`  Match           : Sphere["${args.sphereMatchField}"] ↔ CS["${args.csMatchField}"]`);
    console.log(`  Locale          : ${report.params.locale}`);
    console.log("");
    console.log(`  Sphere total    : ${report.summary.sphere.total}  (keyed: ${sphereKeys.size}, missing field: ${sphereMissingField})`);
    console.log(`  CS total        : ${report.summary.contentstack.total}  (keyed: ${csKeys.size}, missing field: ${csMissingField})`);
    console.log("");
    console.log(`  ✅ Synced          : ${report.summary.sync.synced}  (${syncRate})`);
    console.log(`  ⚠️  Only in Sphere  : ${report.summary.sync.onlyInSphere}`);
    console.log(`  ⚠️  Only in CS      : ${report.summary.sync.onlyInContentStack}`);
    console.log("==========================\n");

    return report;
  },
});
