import { deliveryGet, managementGet } from "./client.js";
import { sleep } from "../utils.js";
import type {
  Entry,
  GetEntriesParams,
  GetEntriesResponse,
} from "./types.js";

const CS_MAX_LIMIT = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEntrySearchParams(params: GetEntriesParams): Record<string, string> {
  const p: Record<string, string> = {};

  if (params.locale) p["locale"] = params.locale.toLowerCase();

  p["include_all"] = "true";
  if (params.includeDepth) p["depth"] = String(Math.min(params.includeDepth, 5));

  if (params.query) p["query"] = params.query;
  if (params.orderBy) {
    if (params.orderBy.startsWith("-")) {
      p["desc"] = params.orderBy.slice(1);
    } else {
      p["asc"] = params.orderBy;
    }
  }
  if (params.only?.length) p["only[BASE][]"] = params.only.join(",");
  if (params.except?.length) p["except[BASE][]"] = params.except.join(",");

  if (params.pagination) {
    p["include_count"] = "true";
    if (params.pagination.limit != null) p["limit"] = String(params.pagination.limit);
    if (params.pagination.skip != null) p["skip"] = String(params.pagination.skip);
  }

  return p;
}

// ---------------------------------------------------------------------------
// Delivery API — published entries only
// ---------------------------------------------------------------------------

/** Get a page of published entries for a content type. */
export async function getEntries<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  contentTypeUid: string,
  params: GetEntriesParams = {}
): Promise<GetEntriesResponse<T>> {
  return deliveryGet<GetEntriesResponse<T>>(
    `/content_types/${contentTypeUid}/entries`,
    buildEntrySearchParams({
      ...params,
      pagination: {
        limit: params.pagination?.limit ?? CS_MAX_LIMIT,
        skip: params.pagination?.skip ?? 0,
      },
    })
  );
}

/**
 * Fetch ALL published entries for a content type, paginating automatically.
 * Makes multiple requests (1 per 250 entries). Use with caution on large types.
 */
export async function getAllEntries<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  contentTypeUid: string,
  params: Omit<GetEntriesParams, "pagination"> = {}
): Promise<Entry<T>[]> {
  const collected: Entry<T>[] = [];
  let skip = 0;

  while (true) {
    if (collected.length > 0) await sleep(100);
    const { entries, count } = await getEntries<T>(contentTypeUid, {
      ...params,
      pagination: { limit: CS_MAX_LIMIT, skip },
    });
    collected.push(...entries);
    if (collected.length >= (count ?? entries.length) || entries.length === 0) break;
    skip += CS_MAX_LIMIT;
  }

  return collected;
}

// ---------------------------------------------------------------------------
// Management API — all entries including drafts
// ---------------------------------------------------------------------------

/** Get a page of entries (including drafts) via the Management API. */
export async function getManagedEntries<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  contentTypeUid: string,
  params: GetEntriesParams = {}
): Promise<GetEntriesResponse<T>> {
  return managementGet<GetEntriesResponse<T>>(
    `/content_types/${contentTypeUid}/entries`,
    buildEntrySearchParams({
      ...params,
      pagination: {
        limit: params.pagination?.limit ?? CS_MAX_LIMIT,
        skip: params.pagination?.skip ?? 0,
      },
    })
  );
}

/** Fetch ALL entries including drafts, paginating automatically. */
export async function getAllManagedEntries<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  contentTypeUid: string,
  params: Omit<GetEntriesParams, "pagination"> = {}
): Promise<Entry<T>[]> {
  const collected: Entry<T>[] = [];
  let skip = 0;

  while (true) {
    if (collected.length > 0) await sleep(100);
    const { entries, count } = await getManagedEntries<T>(contentTypeUid, {
      ...params,
      pagination: { limit: CS_MAX_LIMIT, skip },
    });
    collected.push(...entries);
    if (collected.length >= (count ?? entries.length) || entries.length === 0) break;
    skip += CS_MAX_LIMIT;
  }

  return collected;
}
