import { sphereGet, getContentHTMLByUUID, SphereError } from "./client.js";
import type {
  SphereContent,
  SphereContentTypeDefinition,
  SphereListResponse,
  SphereSearchParams,
  SphereTeaserImage,
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
  if (params.ddSports?.length) p["dd_sports"] = params.ddSports.join(",");
  return p;
}

// ---------------------------------------------------------------------------
// Retrieve
// ---------------------------------------------------------------------------

/** Get a single Sphere content element by its UUID. */
export async function getSphereContentByUUID(uuid: string): Promise<SphereContent> {
  return sphereGet<SphereContent>(`/contents/${uuid}`);
}

// ---------------------------------------------------------------------------
// HTML-renderer-based retrieval (fallback when the Sphere JSON API is down)
// ---------------------------------------------------------------------------

/**
 * Parse a `SphereContent` from the SvelteKit hydration data embedded in the
 * Sphere Renderer HTML page.
 *
 * The renderer inlines the page state as a JavaScript object literal inside a
 * `<script>` tag. This function extracts the top-level `content` object from
 * the `data:[null,null,{type:"data",data:{content:{…}}}]` array and picks
 * the specific fields used by `mapSphereToBlogPost`.
 *
 * Fields NOT available via this route: none critical — `updatedAt` IS present
 * in the hydration data.
 */
function parseSphereContentFromHTML(html: string, uuid: string): SphereContent | null {
  // Find the last <script> tag (the SvelteKit hydration script)
  let scriptContent = "";
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = scriptRegex.exec(html)) !== null) {
    scriptContent = m[1] ?? ""; // keep overwriting → last script wins
  }
  if (!scriptContent) return null;

  // Locate the inline content object: `data:{content:{…}}`
  const MARKER = "data:{content:{";
  const markerIdx = scriptContent.indexOf(MARKER);
  if (markerIdx === -1) return null;

  // Slice from the opening `{` of the content object
  const contentObjStart = markerIdx + MARKER.length - 1;
  const slice = scriptContent.slice(contentObjStart);

  // Use the section before `brickList:` for top-level field extraction so that
  // repeated field names inside bricks (e.g. `title`, `mediaId`) are ignored.
  const brickListIdx = slice.indexOf("brickList:");
  const header = brickListIdx > 0 ? slice.slice(0, brickListIdx) : slice.slice(0, 4000);

  // ---- helpers ----
  const str = (pattern: RegExp): string | undefined => {
    const match = header.match(pattern);
    if (!match) return undefined;
    try { return JSON.parse(`"${match[1]}"`); } catch { return match[1]; }
  };

  // ---- scalar fields ----
  const idMatch = header.match(/\bid:"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/);
  const id = idMatch?.[1] ?? uuid;

  const title        = str(/\btitle:"((?:[^"\\]|\\.)*)"/)           ?? "";
  const summary      = str(/\bsummary:"((?:[^"\\]|\\.)*)"/)         ?? undefined;
  const meta_description = str(/\bmetaDescription:"((?:[^"\\]|\\.)*)"/) ?? undefined;

  const urlMatch = header.match(/\burl:"(https?:\/\/[^"]+)"/);
  const url = urlMatch?.[1];

  const ddSportsMatch = header.match(/\bddSports:\[([^\]]*)\]/);
  const dd_sports: number[] = ddSportsMatch?.[1]
    ? ddSportsMatch[1].split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
    : [];

  const updatedAtMatch = header.match(/\bupdatedAt:"([^"]+)"/);
  const updated_at = updatedAtMatch?.[1];

  // ---- teaserImage sub-object (brace-tracked extraction) ----
  let teaser_image: SphereTeaserImage | undefined;
  const teaserIdx = header.indexOf("teaserImage:{");
  if (teaserIdx !== -1) {
    const braceStart = header.indexOf("{", teaserIdx);
    let depth = 0;
    let braceEnd = braceStart;
    for (let i = braceStart; i < header.length; i++) {
      if (header[i] === "{") depth++;
      else if (header[i] === "}") {
        depth--;
        if (depth === 0) { braceEnd = i; break; }
      }
    }
    const tStr = header.slice(braceStart, braceEnd + 1);
    const mediaId    = tStr.match(/\bmediaId:"([^"]+)"/)?.[1];
    const secKey     = tStr.match(/\bsecurityKey:"([^"]+)"/)?.[1];
    const altTitleRaw = tStr.match(/\baltTitle:"((?:[^"\\]|\\.)*)"/)?.[1];
    if (mediaId && secKey) {
      teaser_image = {
        media_id:     mediaId,
        security_key: secKey,
        alt_title:    altTitleRaw ? (() => { try { return JSON.parse(`"${altTitleRaw}"`); } catch { return altTitleRaw; } })() : undefined,
      };
    }
  }

  return { id, title, summary, meta_description, url, dd_sports, updated_at, teaser_image };
}

/**
 * Fetch a single Sphere content element by UUID by parsing the Sphere Renderer
 * HTML page instead of calling the JSON API directly.
 *
 * Use this as a fallback when the Sphere JSON API (`SPHERE_HOST`) is unavailable.
 */
export async function getSphereContentFromHTML(uuid: string): Promise<SphereContent> {
  const html = await getContentHTMLByUUID(uuid);
  const content = parseSphereContentFromHTML(html, uuid);
  if (!content) {
    throw new SphereError(0, `Could not parse Sphere content from Renderer HTML for UUID ${uuid}`);
  }
  return content;
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
  return result["hydra:member"];
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
    const members = result["hydra:member"];
    collected.push(...members);
    if (members.length === 0 || collected.length >= result["hydra:totalItems"]) break;
    page++;
  }

  return collected;
}

/** List available content type definitions in Sphere. */
export async function getSphereContentTypes(): Promise<SphereContentTypeDefinition[]> {
  return sphereGet<SphereContentTypeDefinition[]>("/content_types");
}
