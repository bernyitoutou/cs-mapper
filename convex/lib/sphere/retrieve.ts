import { sphereGet } from "./client.js";
import type {
  SphereContent,
  SphereContentTypeDefinition,
  SphereListResponse,
  SphereSearchParams,
} from "./types.js";

const DEFAULT_PER_PAGE = 50;

function toSphereLocale(locale: string): string {
  return locale.replace("-", "_");
}

function buildSearchParams(params: SphereSearchParams): Record<string, string> {
  const p: Record<string, string> = {};
  if (params.contentTypeId) p["content_type"] = params.contentTypeId;
  if (params.modelCodes?.length) p["model_codes"] = params.modelCodes.join(",");
  if (params.locale) p["locale"] = toSphereLocale(params.locale);
  if (params.status != null) p["status"] = String(params.status);
  if (params.page != null) p["page"] = String(params.page);
  if (params.perPage != null) p["per_page"] = String(params.perPage);
  return p;
}

// ---------------------------------------------------------------------------
// Retrieve
// ---------------------------------------------------------------------------

/** Get a single Sphere content element by its UUID. */
export async function getSphereContentByUUID(uuid: string): Promise<SphereContent> {
  return sphereGet<SphereContent>(`/contents/${uuid}`);
}

/**
 * Search Sphere contents with various filters.
 *
 * @example
 * const page = await searchSphereContents({
 *   contentTypeId: "875ef604-...",
 *   locale: "fr-FR",
 *   status: 1,
 * });
 */
export async function searchSphereContents(
  params: SphereSearchParams = {}
): Promise<SphereListResponse> {
  return sphereGet<SphereListResponse>(
    "/contents",
    buildSearchParams({ perPage: DEFAULT_PER_PAGE, ...params })
  );
}

/**
 * Get Sphere contents by product model code(s).
 *
 * @example
 * const items = await getSphereContentsByModelCode(
 *   ["8581842"],
 *   "875ef604-5ca2-4ed9-96b7-15e6c6e0fd0d",
 *   { locale: "en-GB", status: 1 }
 * );
 */
export async function getSphereContentsByModelCode(
  modelCodes: string[],
  contentTypeId: string,
  params: Omit<SphereSearchParams, "modelCodes" | "contentTypeId"> = {}
): Promise<SphereContent[]> {
  const result = await searchSphereContents({ ...params, modelCodes, contentTypeId });
  return result.items;
}

/**
 * Fetch ALL Sphere contents matching a filter, paginating automatically.
 *
 * @example
 * const all = await getAllSphereContents({ contentTypeId: "875ef604-...", locale: "fr-FR" });
 */
export async function getAllSphereContents(
  params: Omit<SphereSearchParams, "page"> = {}
): Promise<SphereContent[]> {
  const collected: SphereContent[] = [];
  let page = 1;

  while (true) {
    const result = await searchSphereContents({ ...params, page, perPage: DEFAULT_PER_PAGE });
    collected.push(...result.items);
    const totalPages = Math.ceil(result.total / result.per_page);
    if (page >= totalPages || result.items.length === 0) break;
    page++;
  }

  return collected;
}

/** List available content type definitions in Sphere. */
export async function getSphereContentTypes(): Promise<SphereContentTypeDefinition[]> {
  return sphereGet<SphereContentTypeDefinition[]>("/content_types");
}
