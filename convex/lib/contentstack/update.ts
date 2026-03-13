import { config } from "../config.js";
import { Locale } from "../locales.js";
import { managementDelete, managementPost, managementPut } from "./client.js";
import type {
  BulkPublishParams,
  BulkUpdateParams,
  Entry,
  GetEntryResponse,
  PublishEntryParams,
  UpdateEntryPayload,
} from "./types.js";

// ---------------------------------------------------------------------------
// Single-entry operations
// ---------------------------------------------------------------------------

/**
 * Permanently delete an entry from ContentStack.
 *
 * - No `locale`: deletes the master entry (and all its localized variants).
 * - With `locale`: deletes only that localized variant, leaving the master intact.
 *
 * Use as rollback when a subsequent step (localize, publish) fails.
 */
export async function deleteEntry(
  contentTypeUid: string,
  entryUid: string,
  locale?: string
): Promise<void> {
  const sp: Record<string, string> = {};
  if (locale) sp["locale"] = locale.toLowerCase();

  const path = `/content_types/${contentTypeUid}/entries/${entryUid}`;
  // managementDelete doesn't support searchParams — build URL manually
  const { managementHost, apiKey, managementToken, branch } = config.contentstack;
  const url = new URL(`${managementHost}/v3${path}`);
  for (const [k, v] of Object.entries(sp)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      api_key: apiKey,
      authorization: managementToken,
      branch,
    },
  });
  if (!res.ok) {
    throw new Error(`[${res.status}] Failed to delete entry ${entryUid}${locale ? ` (locale: ${locale})` : ""}`);
  }
}

/**
 * Update an entry's fields.
 *
 * ContentStack replaces the whole entry body — fetch the entry first, merge
 * your changes, then call this function with the full updated entry as payload.
 *
 * @example
 * const entry = await getManagedEntry("homepage", uid, { locale: "en-GB" });
 * await updateEntry("homepage", uid, { entry: { ...entry, title: "New" } }, "en-GB");
 */
export async function updateEntry<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  contentTypeUid: string,
  entryUid: string,
  payload: UpdateEntryPayload,
  locale?: string
): Promise<Entry<T>> {
  const sp: Record<string, string> = {};
  if (locale) sp["locale"] = locale.toLowerCase();

  const data = await managementPut<GetEntryResponse<T>>(
    `/content_types/${contentTypeUid}/entries/${entryUid}`,
    payload,
    sp
  );
  return data.entry;
}

/**
 * Create a new entry in ContentStack.
 *
 * If `locale` is omitted the entry is created as a master (language-agnostic).
 * Pass a locale to create directly in that locale.
 *
 * @example
 * const entry = await createEntry("blog_post", { title: "Hello", body: "..." });
 * const localized = await createEntry("blog_post", { title: "Bonjour" }, "fr-FR");
 */
export async function createEntry<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  contentTypeUid: string,
  data: Record<string, unknown>,
  locale?: string
): Promise<Entry<T>> {
  const sp: Record<string, string> = {};
  if (locale) sp["locale"] = locale.toLowerCase();

  const response = await managementPost<GetEntryResponse<T>>(
    `/content_types/${contentTypeUid}/entries`,
    { entry: data },
    sp
  );
  return response.entry;
}

/**
 * Publish a single entry to one or more environments / locales.
 *
 * @example
 * await publishEntry("homepage", "blt123", {
 *   environments: ["staging"],
 *   locales: ["en-GB", "fr-FR"],
 * });
 */
export async function publishEntry(
  contentTypeUid: string,
  entryUid: string,
  params: PublishEntryParams = {
    environments: [config.contentstack.environment],
    locales: [Locale.EnGb],
  },
  /** When set, publish is scoped to that locale (required for localized entries). */
  locale?: string
): Promise<void> {
  const sp: Record<string, string> = {};
  if (locale) sp["locale"] = locale.toLowerCase();

  await managementPost(
    `/content_types/${contentTypeUid}/entries/${entryUid}/publish`,
    {
      entry: {
        environments: params.environments,
        locales: params.locales.map((l) => l.toLowerCase()),
        ...(params.scheduledAt ? { scheduled_at: params.scheduledAt } : {}),
      },
    },
    sp
  );
}

/** Unpublish a single entry from one or more environments / locales. */
export async function unpublishEntry(
  contentTypeUid: string,
  entryUid: string,
  params: PublishEntryParams = {
    environments: [config.contentstack.environment],
    locales: [Locale.EnGb],
  }
): Promise<void> {
  await managementPost(
    `/content_types/${contentTypeUid}/entries/${entryUid}/unpublish`,
    {
      entry: {
        environments: params.environments,
        locales: params.locales.map((l) => l.toLowerCase()),
        ...(params.scheduledAt ? { scheduled_at: params.scheduledAt } : {}),
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

/**
 * Bulk publish or unpublish a list of entries.
 * CS processes this asynchronously — returns a job ID to poll.
 *
 * @example
 * const { job_id } = await bulkPublish({
 *   entries: [{ content_type: "homepage", uid: "blt...", locale: "en-GB" }],
 *   environments: ["staging"],
 *   locales: ["en-GB"],
 *   action: "publish",
 * });
 */
export async function bulkPublish(
  params: BulkPublishParams
): Promise<{ job_id: string }> {
  return managementPost<{ job_id: string }>("/bulk/publish", {
    entries: params.entries,
    environments: params.environments,
    locales: params.locales,
    action: params.action,
  });
}

/**
 * Bulk update a specific set of fields across many entries.
 *
 * @example
 * await bulkUpdate({
 *   content_type: "homepage",
 *   entries: [{ uid: "blt1", locale: "en-GB" }],
 *   update: { tags: ["script-updated"] },
 * });
 */
export async function bulkUpdate(
  params: BulkUpdateParams
): Promise<{ job_id: string }> {
  return managementPost<{ job_id: string }>("/bulk/update", {
    content_type: { uid: params.content_type },
    entries: params.entries,
    update: params.update,
  });
}

/** Poll the status of an async bulk job. */
export async function getBulkJobStatus(jobId: string): Promise<{
  status: "in_progress" | "completed" | "failed";
  message?: string;
  errors?: unknown[];
}> {
  return managementPost(`/bulk/jobs/${jobId}`, {});
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Apply a field patch to many entries one by one.
 * Fetches nothing — you must pass the full current entry objects so that
 * ContentStack does not wipe unset fields.
 *
 * For large sets prefer `bulkUpdate()` which is a single API call.
 *
 * @returns Array of `{ uid, success, error? }` per entry.
 */
export async function patchEntries(
  contentTypeUid: string,
  entries: Array<Entry>,
  patch: Record<string, unknown>,
  locale?: string
): Promise<Array<{ uid: string; success: boolean; error?: string }>> {
  const results: Array<{ uid: string; success: boolean; error?: string }> = [];

  for (const entry of entries) {
    try {
      await updateEntry(
        contentTypeUid,
        entry.uid,
        { entry: { ...entry, ...patch } },
        locale
      );
      results.push({ uid: entry.uid, success: true });
    } catch (err) {
      results.push({
        uid: entry.uid,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
