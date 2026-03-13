"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

import { config } from "./lib/config.js";
import { ContentstackError } from "./lib/contentstack/client.js";
import { createEntry, deleteEntry, publishEntry, updateEntry } from "./lib/contentstack/update.js";
import { localeValidator, Locale } from "./lib/locales.js";
import { ContentType, contentTypeValidator } from "./lib/contentstack/types";

/**
 * Fields managed by ContentStack that must not be sent in a creation payload.
 * Sending them causes CS error 119 (entry creation failed).
 */
const CS_SYSTEM_FIELDS = new Set([
  "uid", "locale", "_version", "created_at", "updated_at",
  "created_by", "updated_by", "_in_progress", "ACL",
  "publish_details", "_metadata",
]);

function stripSystemFields(item: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(item).filter(([key]) => !CS_SYSTEM_FIELDS.has(key))
  );
}

function serializeError(err: unknown): string {
  if (err instanceof ContentstackError) {
    const detail = err.errors ? ` | details: ${JSON.stringify(err.errors)}` : "";
    return `${err.message}${detail}`;
  }
  return String(err);
}

/** Best-effort delete of a created entry used as rollback on step failure.
 * When createMasterFirst=true, deletes the localized variant first, then the master.
 */
async function rollback(
  contentTypeUid: ContentType,
  uid: string,
  locale?: Locale
): Promise<void> {
  try {
    if (locale) {
      // Delete the localized variant first
      await deleteEntry(contentTypeUid, uid, locale);
    }
    // Delete the master (or the direct-locale entry)
    await deleteEntry(contentTypeUid, uid);
  } catch {
    // Swallow — rollback failure is logged by the caller via the failed[] report
  }
}

type ImportedItem = {
  uid: string;
  item: Record<string, unknown>;
};

type FailedItem = {
  item: Record<string, unknown>;
  step: "create" | "localize" | "publish";
  error: string;
};

/**
 * Bulk-create ContentStack entries from an array of field payloads.
 *
 * Two creation modes:
 * - `createMasterFirst = false` (default): entry is created directly in the
 *   target locale. Simple and fast — use when you don't need a language-master.
 * - `createMasterFirst = true`: a language-master entry (no locale) is created
 *   first, then the same payload is used to localize it. Required for stacks
 *   that enforce the master → locale relationship.
 *
 * @example
 * await api.import.massImport({
 *   contentTypeUid: "blog_post",
 *   locale: "fr-FR",
 *   items: [
 *     { title: "Mon article", body: "..." },
 *     { title: "Deuxième article", body: "..." },
 *   ],
 *   createMasterFirst: false,
 *   publishAfterCreate: true,
 * })
 */
export const massImport = action({
  args: {
    /** ContentStack content type UID. e.g. "blog_post" */
    contentTypeUid: contentTypeValidator,
    /** Target locale for all entries. e.g. "fr-FR" */
    locale: localeValidator,
    /** Array of entry field payloads (content type schema fields). */
    items: v.array(v.any()),
    /**
     * When true, a language-master entry is created first (without locale),
     * then localized using the same payload.
     * When false, the entry is created directly in the target locale.
     */
    createMasterFirst: v.boolean(),
    /**
     * When true, each successfully created entry is published to the
     * current environment after creation.
     * @default false
     */
    publishAfterCreate: v.optional(v.boolean()),
  },

  handler: async (_ctx, args) => {
    const shouldPublish = args.publishAfterCreate ?? false;
    const environment = config.contentstack.environment;

    const created: ImportedItem[] = [];
    const failed: FailedItem[] = [];

    for (const rawItem of args.items) {
      const item = rawItem as Record<string, unknown>;
      const payload = stripSystemFields(item);
      let uid: string | undefined;

      // ── Step 1: Create ──────────────────────────────────────────────────
      try {
        if (args.createMasterFirst) {
          // Create language-master (no locale), then localize below
          const master = await createEntry(args.contentTypeUid, payload);
          uid = master.uid;
        } else {
          // Create directly in the target locale
          const entry = await createEntry(args.contentTypeUid, payload, args.locale);
          uid = entry.uid;
        }
      } catch (err) {
        failed.push({ item, step: "create", error: serializeError(err) });
        continue;
      }

      // ── Step 2 (conditional): Localize ──────────────────────────────────
      if (args.createMasterFirst) {
        try {
          await updateEntry(args.contentTypeUid, uid, { entry: payload }, args.locale);
        } catch (err) {
          await rollback(args.contentTypeUid, uid, args.locale);
          failed.push({ item, step: "localize", error: serializeError(err) });
          continue;
        }
      }

      // ── Step 3 (conditional): Publish ───────────────────────────────────
      if (shouldPublish) {
        try {
          await publishEntry(
            args.contentTypeUid,
            uid,
            { environments: [environment], locales: [args.locale] },
            // Pass locale as query param when entry was localized from a master
            args.createMasterFirst ? args.locale : undefined
          );
        } catch (err) {
          await rollback(args.contentTypeUid, uid, args.createMasterFirst ? args.locale : undefined);
          failed.push({ item, step: "publish", error: serializeError(err) });
          continue;
        }
      }

      created.push({ uid, item });
    }

    // ── Report ──────────────────────────────────────────────────────────────
    const report = {
      summary: {
        total: args.items.length,
        created: created.length,
        failed: failed.length,
      },
      params: {
        contentTypeUid: args.contentTypeUid,
        locale: args.locale,
        createMasterFirst: args.createMasterFirst,
        publishAfterCreate: shouldPublish,
        environment,
      },
      created,
      failed,
    };

    console.log("\n=== Mass Import Report ===");
    console.log(`  Content type    : ${args.contentTypeUid}`);
    console.log(`  Locale          : ${args.locale}`);
    console.log(`  Environment     : ${environment}`);
    console.log(`  Mode            : ${args.createMasterFirst ? "master → localize" : "direct locale"}`);
    console.log(`  Publish         : ${shouldPublish}`);
    console.log("");
    console.log(`  Total           : ${report.summary.total}`);
    console.log(`  ✅ Created       : ${report.summary.created}`);
    console.log(`  ❌ Failed        : ${report.summary.failed}`);
    if (failed.length > 0) {
      console.log("\n  Failed items:");
      for (const f of failed) {
        console.log(`    [${f.step}] ${f.error}`);
      }
    }
    console.log("==========================\n");

    return report;
  },
});
