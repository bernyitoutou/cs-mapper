import { config } from "../config.js";
import { managementPost, managementPut } from "./client.js";
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
    payload
  );
  return data.entry;
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
    locales: ["en-US"],
  }
): Promise<void> {
  await managementPost(
    `/content_types/${contentTypeUid}/entries/${entryUid}/publish`,
    {
      entry: {
        environments: params.environments,
        locales: params.locales,
        ...(params.scheduledAt ? { scheduled_at: params.scheduledAt } : {}),
      },
    }
  );
}

/** Unpublish a single entry from one or more environments / locales. */
export async function unpublishEntry(
  contentTypeUid: string,
  entryUid: string,
  params: PublishEntryParams = {
    environments: [config.contentstack.environment],
    locales: ["en-US"],
  }
): Promise<void> {
  await managementPost(
    `/content_types/${contentTypeUid}/entries/${entryUid}/unpublish`,
    {
      entry: {
        environments: params.environments,
        locales: params.locales,
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
