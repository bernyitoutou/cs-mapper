"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

import { getAllEntries, getAllManagedEntries } from "./lib/contentstack/retrieve.js";
import { createEntry, updateEntry, publishEntry, unpublishEntry, deleteEntry } from "./lib/contentstack/update.js";
import { config } from "./lib/config.js";
import { getAllSphereContents } from "./lib/sphere/retrieve.js";
import { mapSphereToBlogPost } from "./lib/sphere/blogPostMapper.js";
import { getNestedValue, setNestedValue } from "./lib/utils.js";
import { localeValidator } from "./lib/locales";
import allSportIdsData from "./lib/fedid/all_sport_ids.json" with { type: "json" };

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
    locale: localeValidator,
  },

  handler: async (_ctx, args) => {

    // 1. Fetch all published Sphere items
    const sphereItems = await getAllSphereContents({
      contentTypeId: args.sphereContentTypeId,
      locale: args.locale,
      status: 1, // published only
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
        sphereStatus: 1, // published only
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

/**
 * Fetch all published Sphere articles for the configured sport IDs, then
 * create or update matching `blog_post` entries in ContentStack and publish them.
 *
 * - Uses `all_sport_ids.json` as the dd_sports filter (generated by `generate:sport-mapping`).
 * - Matches Sphere ↔ CS via the `sphere_id` field.
 * - Updates are triggered when `sphere.updated_at > cs.last_sphere_update`.
 * - Set `dryRun: true` to validate the mapping without writing anything.
 *
 * @example
 * await api.sync.sphereImport({
 *   locale: "en-GB",
 *   sphereContentTypeId: "875ef604-5ca2-4ed9-96b7-15e6c6e0fd0d",
 *   csContentTypeUid: "blog_post",
 * })
 */
export const sphereImport = action({
  args: {
    locale: localeValidator,
    /** Sphere content type UUID */
    sphereContentTypeId: v.string(),
    /** ContentStack content type UID */
    csContentTypeUid: v.string(),
    /** When true, fetch and map entries but skip all CS writes */
    dryRun: v.optional(v.boolean()),
  },

  handler: async (_ctx, args) => {
    const { locale, sphereContentTypeId, csContentTypeUid, dryRun = false } = args;
    const allSportIds = allSportIdsData as string[];

    console.log(`\n=== Sphere Import ===`);
    console.log(`  Sphere type : ${sphereContentTypeId}`);
    console.log(`  CS type     : ${csContentTypeUid}`);
    console.log(`  Locale      : ${locale}`);
    console.log(`  Sport IDs   : ${allSportIds.length} sport IDs as filter`);
    console.log(`  Dry run     : ${dryRun}`);

    // 1. Fetch all matching published Sphere entries
    const sphereEntries = await getAllSphereContents({
      contentTypeId: sphereContentTypeId,
      locale,
      status: 1,
      ddSports: allSportIds.map(Number),
    });
    console.log(`  Sphere entries fetched: ${sphereEntries.length}`);

    // 2. Fetch all existing CS entries and index by sphere_id
    const csEntries = await getAllManagedEntries(csContentTypeUid, { locale });
    const csMap = new Map<string, Record<string, unknown>>();
    for (const entry of csEntries) {
      const sphereId = entry["sphere_id"];
      if (typeof sphereId === "string") {
        csMap.set(sphereId, entry as Record<string, unknown>);
      }
    }
    console.log(`  CS entries fetched: ${csEntries.length} (${csMap.size} with sphere_id)`);

    const { environment, branch } = config.contentstack;
    const publishParams = {
      environments: [environment],
      locales: [locale],
    };

    // 3. Process each Sphere entry
    type FailedItem = { sphereId: string; title: string; step: string; error: string };
    const created: string[] = [];
    const updated: string[] = [];
    const skipped: string[] = [];
    const failed: FailedItem[] = [];

    for (const sphereEntry of sphereEntries) {
      const sphereId = sphereEntry.id;
      const title = sphereEntry.title;

      try {
        const mappedData = mapSphereToBlogPost(sphereEntry);
        const csEntry = csMap.get(sphereId);

        if (!csEntry) {
          // Create new entry
          if (dryRun) {
            created.push(sphereId);
            continue;
          }
          const newEntry = await createEntry(csContentTypeUid, mappedData, locale);
          await publishEntry(csContentTypeUid, newEntry.uid, publishParams, locale);
          created.push(sphereId);
        } else {
          // Check if update needed: date changed OR taxonomies are out of sync
          const sphereUpdatedAt = sphereEntry.updated_at;
          const csLastUpdate = csEntry["last_sphere_update"];
          const dateChanged =
            typeof sphereUpdatedAt === "string" &&
            typeof csLastUpdate === "string" &&
            new Date(sphereUpdatedAt) > new Date(csLastUpdate);

          const csTaxonomies = csEntry["taxonomies"];
          const expectedTerms = new Set(mappedData["taxonomies"] as Array<{ term_uid: string }>);
          const actualTerms = new Set(
            Array.isArray(csTaxonomies)
              ? (csTaxonomies as Array<{ term_uid: string }>).map((t) => t.term_uid)
              : []
          );
          const expectedTermUids = (mappedData["taxonomies"] as Array<{ term_uid: string }>).map(
            (t) => t.term_uid
          );
          const taxonomiesOutOfSync =
            actualTerms.size !== expectedTermUids.length ||
            expectedTermUids.some((uid) => !actualTerms.has(uid));

          const needsUpdate = dateChanged || taxonomiesOutOfSync;
          void expectedTerms;

          if (!needsUpdate) {
            skipped.push(sphereId);
            continue;
          }

          if (dryRun) {
            updated.push(sphereId);
            continue;
          }
          const entryUid = csEntry["uid"] as string;
          await updateEntry(csContentTypeUid, entryUid, { entry: mappedData }, locale);
          await publishEntry(csContentTypeUid, entryUid, publishParams, locale);
          updated.push(sphereId);
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        const step = csMap.has(sphereId) ? "update" : "create";
        failed.push({ sphereId, title, step, error });
        console.error(`  ✗ [${step}] ${title} (${sphereId}): ${error}`);
      }
    }

    const summary = {
      total: sphereEntries.length,
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
    console.log(`  branch=${branch}, env=${environment}`);
    console.log("====================\n");

    return { summary, params: { locale, sphereContentTypeId, csContentTypeUid, dryRun }, failed };
  },
});

/**
 * Unpublish and delete all entries of a given content type for a specific locale.
 *
 * Does NOT delete the master entry — only the localized variant is removed.
 * Safe to run per-locale independently.
 *
 * @example
 * await api.sync.deleteEntries({
 *   csContentTypeUid: "blog_post",
 *   locale: "en-GB",
 * })
 */
export const deleteEntries = action({
  args: {
    csContentTypeUid: v.string(),
    locale: localeValidator,
  },

  handler: async (_ctx, args) => {
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

    return { summary: { total: entries.length, deleted: deleted.length, failed: failed.length }, failed };
  },
});

/**
 * Set a single field to a given value across all entries of a content type for a specific locale,
 * then optionally republish.
 *
 * The field supports dot-notation for nested paths (e.g. `"metadata.robot_no_follow"`).
 * Only the specified locale is modified — the master entry is not touched.
 *
 * @example
 * await api.sync.massFieldUpdate({
 *   csContentTypeUid: "blog_sport_category",
 *   locale: "en-GB",
 *   field: "is_active",
 *   value: false,
 *   publishAfterUpdate: true,
 * })
 */
export const massFieldUpdate = action({
  args: {
    csContentTypeUid: v.string(),
    locale: localeValidator,
    /** Dot-notation field path to update, e.g. "is_active" or "metadata.robot_no_follow" */
    field: v.string(),
    /** Value to set on the field */
    value: v.any(),
    publishAfterUpdate: v.optional(v.boolean()),
  },

  handler: async (_ctx, args) => {
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

    return { summary: { total: entries.length, updated: updated.length, failed: failed.length }, failed };
  },
});
