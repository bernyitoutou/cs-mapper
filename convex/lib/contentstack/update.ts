import { config } from "../config.js";
import { Locale } from "../locales.js";
import { managementDelete, managementPost, managementPut } from "./client.js";
import type {
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

  await managementDelete(
    `/content_types/${contentTypeUid}/entries/${entryUid}`,
    sp
  );
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
