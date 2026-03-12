import { deliveryGet, managementGet } from "./client.js";
import type {
  Asset,
  ContentTypeDefinition,
  Entry,
  GetAssetsParams,
  GetAssetsResponse,
  GetContentTypeResponse,
  GetContentTypesResponse,
  GetEntriesParams,
  GetEntriesResponse,
  GetEntryResponse,
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
// Content type schema (Management API)
// ---------------------------------------------------------------------------

/** List all content type definitions registered in the stack. */
export async function getContentTypes(): Promise<ContentTypeDefinition[]> {
  const collected: ContentTypeDefinition[] = [];
  let skip = 0;

  while (true) {
    const data = await managementGet<GetContentTypesResponse>("/content_types", {
      include_count: "true",
      limit: String(CS_MAX_LIMIT),
      skip: String(skip),
    });
    collected.push(...data.content_types);
    if (!data.count || collected.length >= data.count) break;
    skip += CS_MAX_LIMIT;
  }

  return collected;
}

/** Get the full schema definition of a single content type. */
export async function getContentType(
  contentTypeUid: string
): Promise<ContentTypeDefinition> {
  const data = await managementGet<GetContentTypeResponse>(
    `/content_types/${contentTypeUid}`
  );
  return data.content_type;
}

// ---------------------------------------------------------------------------
// Delivery API — published entries only
// ---------------------------------------------------------------------------

/** Get a single published entry by UID. */
export async function getEntry<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  contentTypeUid: string,
  entryUid: string,
  params: Pick<GetEntriesParams, "locale" | "includeDepth"> = {}
): Promise<Entry<T>> {
  const data = await deliveryGet<GetEntryResponse<T>>(
    `/content_types/${contentTypeUid}/entries/${entryUid}`,
    buildEntrySearchParams(params)
  );
  return data.entry;
}

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

/** Count published entries matching an optional query. */
export async function countEntries(
  contentTypeUid: string,
  params: Pick<GetEntriesParams, "locale" | "query"> = {}
): Promise<number> {
  const sp: Record<string, string> = { include_count: "true", limit: "1" };
  if (params.locale) sp["locale"] = params.locale.toLowerCase();
  if (params.query) sp["query"] = params.query;

  const data = await deliveryGet<GetEntriesResponse>(
    `/content_types/${contentTypeUid}/entries`,
    sp
  );
  return data.count ?? data.entries.length;
}

// ---------------------------------------------------------------------------
// Management API — all entries including drafts
// ---------------------------------------------------------------------------

/** Get a single entry (including unpublished drafts) via the Management API. */
export async function getManagedEntry<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  contentTypeUid: string,
  entryUid: string,
  params: Pick<GetEntriesParams, "locale"> = {}
): Promise<Entry<T>> {
  const sp: Record<string, string> = {};
  if (params.locale) sp["locale"] = params.locale.toLowerCase();

  const data = await managementGet<GetEntryResponse<T>>(
    `/content_types/${contentTypeUid}/entries/${entryUid}`,
    sp
  );
  return data.entry;
}

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

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

/** Get a page of assets from the stack. */
export async function getAssets(params: GetAssetsParams = {}): Promise<GetAssetsResponse> {
  const sp: Record<string, string> = { include_count: "true" };
  if (params.query) sp["query"] = params.query;
  if (params.folder) sp["folder"] = params.folder;
  if (params.pagination?.limit != null) sp["limit"] = String(params.pagination.limit);
  if (params.pagination?.skip != null) sp["skip"] = String(params.pagination.skip);

  return managementGet<GetAssetsResponse>("/assets", sp);
}

/** Fetch ALL assets, paginating automatically. */
export async function getAllAssets(
  params: Omit<GetAssetsParams, "pagination"> = {}
): Promise<Asset[]> {
  const collected: Asset[] = [];
  let skip = 0;

  while (true) {
    const { assets, count } = await getAssets({
      ...params,
      pagination: { limit: CS_MAX_LIMIT, skip },
    });
    collected.push(...assets);
    if (collected.length >= (count ?? assets.length) || assets.length === 0) break;
    skip += CS_MAX_LIMIT;
  }

  return collected;
}
