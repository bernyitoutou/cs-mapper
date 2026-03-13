# cs-mapper — Production Readiness Audit Report

> **Date:** 2026-03-13
> **Scope:** Full codebase — backend (Convex), frontend (React/Vite), CLI scripts
> **Perspective:** Senior Engineer — Enterprise-grade assessment for a system with multi-million euro business impact and millions of end-users

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Severity Classification](#2-severity-classification)
3. [Security](#3-security)
4. [Data Integrity](#4-data-integrity)
5. [Resilience & Error Handling](#5-resilience--error-handling)
6. [Architecture & Design](#6-architecture--design)
7. [Observability & Monitoring](#7-observability--monitoring)
8. [Testing](#8-testing)
9. [Configuration Management](#9-configuration-management)
10. [Frontend Reliability](#10-frontend-reliability)
11. [Code Quality](#11-code-quality)
12. [Production-Specific Risks](#12-production-specific-risks)
13. [Prioritised Action Plan](#13-prioritised-action-plan)
14. [Verdict](#14-verdict)

---

## 1. Executive Summary

cs-mapper is a content migration and synchronisation tool that bridges **Sphere CMS**, **ContentStack**, and the **Decathlon FedID Referential API**. It orchestrates import, sync, publish, and reporting operations through a Convex backend with a React dashboard.

The functional logic is well-structured and the code quality is clean for a proof-of-concept. However, the codebase lacks the reliability layers required for a production deployment: **no tests, no retry mechanisms, no authentication, no idempotency guarantees, and limited error handling**. These gaps create real risks of silent data corruption, partial state, and undetected failures.

**The tool is not production-ready in its current state**, but the foundations are solid. The path to production is one of _hardening_, not rewriting.

---

## 2. Severity Classification

| Severity | Definition |
|----------|-----------|
| **P0 — CRITICAL** | Risk of data loss, data corruption, or security breach in production. Must be fixed before any production use. |
| **P1 — MAJOR** | Risk of instability, unexpected behaviour, or silent failures. Should be fixed before production. |
| **P2 — IMPORTANT** | Architectural fragility, significant technical debt. Should be addressed for long-term maintainability. |
| **P3 — RECOMMENDED** | Best-practice improvements for a production-grade tool. |

---

## 3. Security

### 3.1 [P0] Cross-Site Scripting (XSS) via `dangerouslySetInnerHTML`

**File:** `web/src/pages/Reports.tsx` (lines 70–73)

```tsx
const renderedHtml = selectedReport?.content
  ? (marked(selectedReport.content) as string)
  : null;

// Later in JSX:
<div dangerouslySetInnerHTML={{ __html: renderedHtml ?? "" }} />
```

**Issue:** Markdown report content is converted to raw HTML using `marked` and injected into the DOM without any sanitisation. The `marked` library does **not** sanitise output by default. If a report contains embedded `<script>` tags, event handlers (`onload`, `onerror`), or other malicious HTML — whether injected intentionally or accidentally — it will execute in the user's browser.

**Impact:** An attacker who can influence report content (e.g. via a crafted Sphere article title or a manually uploaded `.md` file) can execute arbitrary JavaScript in the context of the dashboard, potentially stealing tokens or triggering destructive API calls.

**Recommendation:**
- Install and apply `DOMPurify` on all HTML before injection: `DOMPurify.sanitize(marked(content))`
- Alternatively, use a Markdown renderer that outputs React elements (e.g. `react-markdown`) instead of raw HTML

---

### 3.2 [P1] No Authentication or Authorisation

**Files:** All Convex actions and mutations (`convex/sync.ts`, `convex/import.ts`, `convex/contentstack.ts`, `convex/logs.ts`, `convex/reports.ts`, etc.)

**Issue:** Every Convex function — including destructive operations like `massImport`, `csPublishEntry`, `csUnpublishEntry`, `csBulkPublish`, `csUpdateEntry`, and `clearLogs` — is callable by anyone with access to the Convex deployment URL. There is no identity verification, no role-based access control, and no rate limiting at the application layer.

**Impact:**
- Unauthorised users could publish or delete production content at scale
- Bulk operations could be triggered without accountability
- API keys and tokens for ContentStack, Sphere, and FedID could be exposed through error responses

**Recommendation:**
- Implement Convex authentication (Clerk, Auth0, or custom)
- Add authorisation checks (`ctx.auth.getUserIdentity()`) at the start of every action/mutation
- Consider role-based restrictions: read-only vs. write access, staging-only vs. production access

---

### 3.3 [P1] Sensitive Data Leakage via Logs

**Files:** `convex/sync.ts`, `convex/import.ts`, `convex/reportActions.ts`

**Issue:** Error messages from external APIs (ContentStack, Sphere, FedID) are logged via `console.log`/`console.error` and stored in the `operationLogs` table. These error messages may contain:
- Request URLs with embedded tokens
- Full error bodies with internal API details
- Payload data that should not be persisted

Additionally, the `operationLogs` table stores `params: v.any()` and `result: v.any()`, which means arbitrary data — potentially including secrets — can be written to the database.

**Recommendation:**
- Sanitise error messages before logging: strip URLs, redact tokens
- Limit what is stored in `params` and `result` (use a defined schema instead of `v.any()`)
- Implement log retention policies (auto-delete after N days)

---

### 3.4 [P2] `deleteEntry` Bypasses the HTTP Client Abstraction

**File:** `convex/lib/contentstack/update.ts` (lines 22–53)

```typescript
export async function deleteEntry(
  contentTypeUid: string,
  entryUid: string,
  locale?: string
): Promise<void> {
  // Rebuilds the full HTTP request manually instead of using managementDelete
  const { managementHost, apiKey, managementToken, branch } = config.contentstack;
  const url = new URL(`${managementHost}/v3${path}`);
  // ...
}
```

**Issue:** The `managementDelete` function in `client.ts` does not support `searchParams`, so `deleteEntry` manually reconstructs the HTTP request. This creates a second code path for building authenticated requests, which could diverge from the main client if headers or auth logic change.

**Recommendation:** Extend `managementDelete` to accept `searchParams` (like the other client methods), then refactor `deleteEntry` to use it.

---

## 4. Data Integrity

### 4.1 [P0] No Atomicity on Create + Publish Operations

**File:** `convex/sync.ts` — `sphereImport` handler (lines 229–237)

```typescript
const newEntry = await createEntry(csContentTypeUid, mappedData, locale);
await publishEntry(csContentTypeUid, newEntry.uid, publishParams, locale);
created.push(sphereId);
```

**Issue:** If `createEntry` succeeds but `publishEntry` fails (network error, rate limit, ContentStack outage), the entry exists as a draft in ContentStack but is recorded as "created" in the summary. On the next sync run:
1. `csMap.get(sphereId)` finds the draft entry
2. The date comparison (`sphereUpdatedAt > csLastUpdate`) may evaluate to `false` if `last_sphere_update` was set during creation
3. The entry is silently **skipped** — it remains an unpublished draft forever

**Contrast:** The `massImport` function (in `import.ts`) has a rollback mechanism — if publish fails, the created entry is deleted. This pattern is missing from `sphereImport`.

**Impact:** Entries that are created but never published — invisible to end-users but consuming ContentStack quotas and potentially causing confusion during audits.

**Recommendation:**
- Add a rollback mechanism to `sphereImport` (delete the entry if publish fails)
- Track entries with a distinct `"created_unpublished"` status in the report
- Consider a separate reconciliation job that detects orphan drafts

---

### 4.2 [P0] Unsafe Date Comparison via `new Date()` String Parsing

**File:** `convex/sync.ts` (lines 243–248)

```typescript
const dateChanged =
  typeof sphereUpdatedAt === "string" &&
  typeof csLastUpdate === "string" &&
  new Date(sphereUpdatedAt) > new Date(csLastUpdate);
```

**Issue:**
1. **No format validation.** If either date string is in an unexpected format, `new Date()` returns `Invalid Date`. Comparing `Invalid Date > <any Date>` always returns `false`, so the update is **silently skipped**.
2. **No timezone normalisation.** Sphere and ContentStack may return dates in different formats or timezones. A naive comparison could produce incorrect results.
3. **No type narrowing.** The `updated_at` field on `SphereContent` is typed as `string | undefined`. The code only checks `typeof === "string"`, not whether the string is a valid ISO 8601 date.

**Impact:** Changed content in Sphere may never be synchronised to ContentStack, with no error or warning.

**Recommendation:**
```typescript
function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

const sphereDate = parseDate(sphereUpdatedAt);
const csDate = parseDate(csLastUpdate);
const dateChanged = sphereDate !== null && csDate !== null && sphereDate > csDate;
// If either date is unparseable, force an update (safer default)
const dateUnparseable = sphereDate === null || csDate === null;
const needsUpdate = dateChanged || dateUnparseable || taxonomiesOutOfSync;
```

---

### 4.3 [P1] Incorrect Set Usage for Taxonomy Comparison

**File:** `convex/sync.ts` (lines 250–262)

```typescript
const expectedTerms = new Set(mappedData["taxonomies"] as Array<{ term_uid: string }>);
// ...
void expectedTerms; // explicitly unused
```

**Issue:**
1. `new Set()` with objects compares by **reference**, not by value. The Set will never deduplicate objects with the same `term_uid`. This variable is created, then immediately discarded with `void`.
2. The actual comparison logic (via `actualTerms` Set of strings) is correct, but the dead code is confusing and suggests an incomplete refactor.

**Recommendation:** Remove the dead code (`expectedTerms` and `void expectedTerms`). The remaining comparison logic is functional.

---

### 4.4 [P1] `clearLogs` Unbounded Collection and Deletion

**File:** `convex/logs.ts` (lines 34–38)

```typescript
export const clearLogs = mutation({
  handler: async (ctx) => {
    const all = await ctx.db.query("operationLogs").collect();
    await Promise.all(all.map((doc) => ctx.db.delete(doc._id)));
  },
});
```

**Issue:**
- `.collect()` loads **all** log entries into memory. With thousands of logs, this can exceed Convex mutation memory limits.
- `Promise.all` with unbounded concurrency on database deletes can hit Convex write quotas.
- There is no pagination or batching.

**Recommendation:**
```typescript
// Delete in batches of 100
const batch = await ctx.db.query("operationLogs").take(100);
for (const doc of batch) {
  await ctx.db.delete(doc._id);
}
// Client calls clearLogs repeatedly until no more remain
```
Or use a Convex scheduled function to drain the table incrementally.

---

### 4.5 [P1] `saveReport` Upsert Without an Index on `name`

**File:** `convex/reports.ts` (lines 7–18)

```typescript
const existing = await ctx.db
  .query("reports")
  .filter((q) => q.eq(q.field("name"), args.name))
  .first();
```

**Issue:**
- The `name` field has **no index** in `schema.ts`, so this performs a full table scan.
- Two concurrent calls with the same `name` can both find `existing === null` and both insert — creating a duplicate.

**Recommendation:**
- Add an index: `.index("by_name", ["name"])` in the schema
- Use `.withIndex("by_name", q => q.eq("name", args.name))` in the query

---

## 5. Resilience & Error Handling

### 5.1 [P0] No Retry Strategy on External API Calls

**Files:** `convex/lib/contentstack/client.ts`, `convex/lib/sphere/client.ts`, `convex/lib/fedid/client.ts`

**Issue:** All three external API clients (`deliveryGet`, `managementPost`, `sphereGet`, `referentialGet`, etc.) make a single HTTP request and immediately throw on failure. There is no retry logic for:
- **429 Too Many Requests** — rate limiting (all three APIs have published rate limits)
- **502/503/504** — transient server errors
- **Network timeouts** — DNS resolution failures, connection resets

For `sphereImport` processing hundreds of entries sequentially, a single transient error fails the entire operation with no way to resume.

**Impact:** Intermittent failures in any external API cause full operation failure, leaving partial state with no recovery path.

**Recommendation:**
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number; retryOn?: (err: unknown) => boolean } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, retryOn = isTransient } = options;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries || !retryOn(err)) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

function isTransient(err: unknown): boolean {
  if (err instanceof ContentstackError) {
    return [429, 502, 503, 504].includes(err.status);
  }
  return err instanceof TypeError; // fetch network errors
}
```

Apply `withRetry` in all client functions.

---

### 5.2 [P0] No Client-Side Rate Limiting

**Files:** `convex/lib/contentstack/retrieve.ts` (pagination loops), `convex/lib/sphere/retrieve.ts` (pagination loops)

**Issue:** The `getAllEntries`, `getAllManagedEntries`, and `getAllSphereContents` functions loop through pages with no delay between requests. A content type with 5,000 entries triggers 50 sequential API calls in as fast a loop as possible. This is likely to trigger ContentStack's rate limiter (which returns a 429), and since there is no retry logic (§5.1), the entire operation fails.

The only `sleep()` in the codebase is a 200ms delay in `reportActions.ts` between categories — the pagination loops themselves have none.

**Recommendation:**
- Add a configurable delay between pagination requests (e.g. 100-200ms)
- Respect `Retry-After` headers from 429 responses
- Consider using concurrency-limited parallel requests for large fetches

---

### 5.3 [P1] `patchEntries` — Unbounded Sequential Loop

**File:** `convex/lib/contentstack/update.ts` (lines 190–212)

```typescript
export async function patchEntries(
  contentTypeUid: string,
  entries: Array<Entry>,
  patch: Record<string, unknown>,
  locale?: string
): Promise<Array<{ uid: string; success: boolean; error?: string }>> {
  for (const entry of entries) {
    await updateEntry(contentTypeUid, entry.uid, { entry: { ...entry, ...patch } }, locale);
  }
  return results;
}
```

**Issue:**
- No concurrency limit, batching, or progress tracking
- Passing 10,000 entries results in 10,000 sequential HTTP requests
- Convex actions have a timeout (typically ~10 minutes) — this function could easily exceed it
- No throttling → rate limit risk (§5.2)

**Recommendation:**
- Process in batches of 10–25 entries
- Add a delay between batches
- For large sets, recommend `bulkUpdate()` instead (which is a single API call)
- Add progress callbacks or log intermediate progress

---

### 5.4 [P1] Action Timeout Risk for Long-Running Operations

**Files:** `convex/sync.ts` (`sphereImport`), `convex/import.ts` (`massImport`), `convex/reportActions.ts` (`generateMigrationReport`)

**Issue:** These actions perform dozens to hundreds of sequential HTTP requests within a single Convex action. Convex actions have a maximum execution time. A `sphereImport` processing 500 entries (each requiring 2 API calls — create + publish) makes ~1,000 HTTP requests — well beyond the timeout window.

**Recommendation:**
- Chunk work using `ctx.scheduler.runAfter()` to split processing into segments
- Implement a progress/state table to track where processing left off
- Return partial results and allow resumption

---

### 5.5 [P2] Fragile HTML Parsing for Sphere Content

**File:** `convex/lib/sphere/retrieve.ts` (lines 56–125, `parseSphereContentFromHTML`)

**Issue:** This function parses JavaScript object literals embedded in SvelteKit-rendered HTML using regular expressions. This approach is inherently fragile:
- A minor change to the Sphere renderer template (e.g. reordering properties, adding whitespace, changing variable names) will break extraction
- Regex cannot reliably handle nested structures, escaped quotes, or Unicode escapes
- `JSON.parse('"${match[1]}"')` can fail on strings containing unescaped backslashes or quotes

**Mitigating factor:** This is documented as a fallback path, not the primary retrieval method.

**Recommendation:**
- Add comprehensive error handling with clear error messages when parsing fails
- Consider using a JavaScript parser (e.g. `acorn`) instead of regex for reliable AST-level extraction
- Add validation on the output: if critical fields (`id`, `title`) are missing, throw a descriptive error rather than returning partial data
- Monitor for breakage via automated tests that run against a known HTML fixture

---

## 6. Architecture & Design

### 6.1 [P1] Settings UI Toggle Does Not Control Actual API Calls

**Files:** `convex/lib/config.ts`, `convex/settings.ts`, `web/src/App.tsx`

**Issue — the core disconnect:**

| Layer | Source of truth | Read from |
|-------|----------------|-----------|
| `config.ts` (used by all API clients) | `process.env.CS_ENVIRONMENT`, `process.env.CS_BRANCH` | Environment variables |
| `settings.ts` (used by UI) | `appSettings` table in Convex DB | Database |
| `App.tsx` toggle button | Calls `updateSettings` mutation | Database |

The toggle button in the header calls `updateSettings()`, which writes to the database. But **every API call** reads from `config.contentstack.environment` and `config.contentstack.branch`, which come from `process.env` — the environment variables, not the database.

**Impact:** The UI gives a false impression of environment control. Users believe they are switching between staging and production, but all API calls continue to hit whichever environment was configured in the Convex deployment's env vars.

**Recommendation:**
- **Option A:** Remove the toggle and make environment selection explicit at deployment time (safer for production)
- **Option B:** Have actions read the branch/environment from the database (via `ctx.runQuery(api.settings.getSettings)`) and pass them to API calls. This requires threading the settings through all client functions.
- Either way, **clearly indicate which environment is actually being targeted** — not just which one is selected in the UI

---

### 6.2 [P1] Massive Code Duplication Between `reportActions.ts` and `scripts/generateMigrationReport.ts`

**Files:** `convex/reportActions.ts` (~300 lines), `scripts/generateMigrationReport.ts` (~300 lines)

**Issue:** These two files contain nearly identical logic:
- `extractAllArticles()` — same regex, same deduplication
- `countCsEntriesByTaxonomy()` — same API call
- `computeAggregates()` — same reduction
- `buildQuickTable()`, `buildPerCategoryDetail()` — same Markdown builders
- `pct()`, `progressBar()`, `statusEmoji()` — same helpers

A bug fix or feature change applied to one is not automatically applied to the other. Since the script is used for local testing and the action is used in the dashboard, they can silently diverge.

**Recommendation:** Extract shared logic into a library module (e.g. `convex/lib/reports/migrationReport.ts`) and have both the action and the script import from it.

---

### 6.3 [P2] `Locale` Enum Defined in Three Places

**Files:**
- `convex/lib/locales.ts` — defines `Locale` enum + `localeValidator`
- `convex/lib/contentstack/types.ts` — defines identical `Locale` enum + `localeValidator`

Both are imported inconsistently across the codebase: some files import from `locales.ts`, others from `contentstack/types.ts`.

**Recommendation:** Keep a single source of truth. Since `Locale` is used by non-ContentStack modules too (Sphere, FedID), it belongs in `locales.ts`. Remove the duplicate from `types.ts` and update all imports.

---

### 6.4 [P2] `v.any()` Used for Structured Data

**Files:**
- `convex/import.ts` (line 82): `items: v.array(v.any())`
- `convex/contentstack.ts` (line 156): `entry: v.any()`
- `convex/contentstack.ts` (line 209): `update: v.any()`
- `convex/contentstack.ts` (line 222): `entries: v.array(v.any())`
- `convex/logs.ts` (lines 7–8): `params: v.optional(v.any())`, `result: v.optional(v.any())`

**Issue:** `v.any()` disables all schema validation. Any malformed payload passes through Convex validation and is forwarded directly to external APIs. This is especially dangerous for write operations (`createEntry`, `updateEntry`) where a field typo or wrong data type could corrupt ContentStack content.

**Recommendation:** Define validators for the most common payloads (at minimum for `blog_post` entries). Use `v.record(v.string(), v.any())` as a stepping stone if full schemas are too much work initially.

---

### 6.5 [P3] Unused Imports

**File:** `convex/sync.ts`

```typescript
import { getNestedValue, setNestedValue } from "./lib/utils.js";
import ukSportsCategoriesData from "./lib/sphere/uk-sports-categories.json" with { type: "json" };
```

`setNestedValue` and `ukSportsCategoriesData` are imported but never used.

---

## 7. Observability & Monitoring

### 7.1 [P1] No Structured Logging

**Files:** All Convex actions (sync.ts, import.ts, reportActions.ts, etc.)

**Issue:** All logging uses `console.log` with emoji-decorated formatted strings:

```typescript
console.log(`  ✅ Created : ${summary.created}`);
console.log(`  🔄 Updated : ${summary.updated}`);
```

This is fine for developer ergonomics during development, but in a production system:
- Logs cannot be parsed by monitoring tools (Datadog, CloudWatch, etc.)
- There is no `request_id` or `correlation_id` to trace operations end-to-end
- Log levels (info, warn, error) are not differentiated
- FedID's `referentialGet` generates a `correlationId` but never logs it

**Recommendation:**
- Use structured logging: `console.log(JSON.stringify({ event: "entry_created", sphereId, csUid, locale, dryRun }))`
- Add a `traceId` generated at the start of each action and included in every log line
- Log all external API calls with duration, status code, and response size

---

### 7.2 [P1] Operation Logs Written Client-Side Only

**Files:** `web/src/pages/SyncDashboard.tsx`, `MassImport.tsx`, `EntryManager.tsx`

```typescript
try {
  const result = await checkSync(syncForm);
  await writelog({ type: "sync_check", status: "success", params: syncForm, result });
} catch (err) {
  await writelog({ type: "sync_check", status: "error", params: syncForm, error: String(err) });
}
```

**Issue:** The `writelog` mutation is called from the React frontend **after** the action completes. If the user closes the tab, loses network, or the `writelog` call itself fails, the operation log is never written. For the most critical operations (mass import, bulk publish), having no audit trail is unacceptable.

**Recommendation:** Write logs inside the Convex action itself (server-side). Use `ctx.runMutation(api.logs.writelog, ...)` at the end of each action handler. The client code is simpler and the audit trail is guaranteed.

---

### 7.3 [P2] No Health Checks or Connectivity Tests

**Issue:** There is no way to verify whether the external APIs (ContentStack Delivery, ContentStack Management, Sphere, FedID) are reachable and correctly configured before running a migration. A misconfigured token or a downed API is only discovered when an operation fails.

**Recommendation:** Add a `healthCheck` action that pings each API with a lightweight request (e.g. `GET /content_types?limit=1` for ContentStack) and returns a status summary. Wire it to a status indicator in the dashboard header.

---

## 8. Testing

### 8.1 [P0] No Tests Exist

**Finding:** There are zero test files in the repository. No unit tests, no integration tests, no end-to-end tests.

This is the **single most critical gap** for production readiness. The following modules carry the highest risk if they contain bugs:

| Module | What it does | Consequence of a bug |
|--------|-------------|---------------------|
| `blogPostMapper.ts` | Maps Sphere data → ContentStack blog_post schema | Corrupted content in production CMS |
| `update.ts` (`createEntry`, `deleteEntry`, `publishEntry`) | Writes to ContentStack | Content loss or unintended publication |
| `sportGroupLookup.ts` | Maps sport IDs → taxonomy terms | Wrong categorisation of all articles |
| `retrieve.ts` (pagination logic) | Fetches all entries/assets | Missing data in sync comparisons |
| `parseSphereContentFromHTML` | Parses JS from HTML | Silent data extraction failures |
| `getNestedValue` / `setNestedValue` | Dot-notation object traversal | Incorrect field reads/writes |

**Minimum test coverage recommended before production:**

1. **`blogPostMapper.ts`** — Unit tests with fixture data:
   - Standard entry with all fields
   - Entry with missing optional fields (`teaser_image`, `summary`, `url`)
   - Entry with no `dd_sports` → empty taxonomies
   - Entry with unknown sport ID → `getTaxonomyBySportId` returns null

2. **`sportGroupLookup.ts`** — Unit tests:
   - Sport ID in mapping → returns correct taxonomy
   - Sport ID not in mapping → returns null
   - Sport group with no sports → returns empty array

3. **Pagination functions** (`getAllEntries`, `getAllSphereContents`) — Integration tests with mocked HTTP:
   - Single page (count ≤ limit)
   - Multiple pages
   - Empty result
   - Count mismatch (API reports more items than exist)

4. **`parseSphereContentFromHTML`** — Snapshot tests:
   - Known-good HTML fixture → expected SphereContent output
   - HTML with no matching script tag → returns null
   - HTML with malformed data → returns null (doesn't crash)

5. **End-to-end workflow** — Integration test with mocked APIs:
   - `sphereImport` with 3 entries: 1 new, 1 updated, 1 skipped
   - Verify correct API calls were made in correct order

---

## 9. Configuration Management

### 9.1 [P1] Copy-Pasted Env File Parsing Across 4 Scripts

**Files:**
- `scripts/generateSportGroupMapping.ts` (lines 29–42)
- `scripts/generateMigrationReport.ts` (lines 28–42)
- `scripts/generateSportArticleMapping.ts` (lines 24–37)
- `scripts/scrapeUKSportsArticles.ts` (lines 21–34)

**Issue:** The same ~15-line env file parser is duplicated in every CLI script:

```typescript
try {
  const raw = readFileSync(resolve(root, envFile), "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }
} catch { /* ... */ }
```

This parser does not handle:
- Multi-line values
- Values containing `=` signs (e.g. base64 tokens) — actually this works because of `indexOf` only finding the first `=`, but it's fragile
- Inline comments (`KEY=value # this is a comment`)
- Escaped quotes within values

**Recommendation:** Use `dotenv` or `dotenvx` — battle-tested, handles edge cases, and is a single line: `config({ path: envFile })`.

---

### 9.2 [P2] `config.ts` Shadows Node.js `require`

**File:** `convex/lib/config.ts` (line 5)

```typescript
function require(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
```

**Issue:** This local function has the same name as Node.js's `require()` built-in. While it works because it's scoped to the module, it can confuse developers, cause issues with linters, and create problems if the module is ever migrated to CommonJS.

**Recommendation:** Rename to `requireEnv()`.

---

## 10. Frontend Reliability

### 10.1 [P1] Pagination Race Condition in EntryManager

**File:** `web/src/pages/EntryManager.tsx` (lines 200–206)

```tsx
<button
  onClick={() => {
    setSearch((s) => ({ ...s, skip: s.skip + s.limit }));
    runSearch();  // ← Uses stale state!
  }}
>Next →</button>
```

**Issue:** `setSearch` enqueues a state update (React batches state updates), but `runSearch()` is called immediately after, reading the **current** (not yet updated) `search.skip` value. The "Next" and "Prev" buttons don't actually paginate — they always search with the old skip value.

**Recommendation:**
```tsx
// Option A: Use useEffect to trigger search on state change
useEffect(() => { runSearch(); }, [search.skip]);

// Option B: Pass the new values directly
function goToPage(newSkip: number) {
  const newSearch = { ...search, skip: newSkip };
  setSearch(newSearch);
  runSearchWith(newSearch); // Modified to accept params
}
```

---

### 10.2 [P2] Infinite Polling Without Cleanup in Bulk Actions

**File:** `web/src/pages/EntryManager.tsx` — `executeBulk` function

```typescript
let done = false;
while (!done) {
  await new Promise((r) => setTimeout(r, 2000));
  const status = (await getBulkJobStatus({ jobId })) as BulkJobResult;
  // ...
  if (jobStatus === "complete" || jobStatus === "failed") done = true;
}
```

**Issue:**
- If the component unmounts during polling (user navigates away), the `while` loop continues, calling `setBulkJobStatus` on an unmounted component → React warning + memory leak
- If the job never completes or fails (stuck in `"in_progress"`), the loop runs forever
- No maximum retry count or timeout

**Recommendation:**
- Use an `AbortController` or a `useRef` flag to stop polling on unmount
- Add a maximum polling duration (e.g. 5 minutes)
- Add a UI button to cancel polling

---

### 10.3 [P2] No Confirmation Before Destructive Actions

**Files:** `web/src/pages/EntryManager.tsx`, `SyncDashboard.tsx`, `MassImport.tsx`

**Issue:** Operations like Publish, Unpublish, Bulk Publish, Bulk Unpublish, and Mass Import execute immediately on button click with no confirmation dialog. A single accidental click can:
- Publish hundreds of draft entries to production
- Unpublish live content
- Create hundreds of duplicate entries

**Recommendation:** Add a confirmation modal for all write operations, especially:
- Any operation targeting more than 1 entry
- Any operation targeting the production environment
- Mass Import (always)

---

## 11. Code Quality

### 11.1 [P2] Dead Code and `void` Statements

**File:** `convex/sync.ts` (line 262)

```typescript
const expectedTerms = new Set(mappedData["taxonomies"] as Array<{ term_uid: string }>);
// ... (expectedTerms is never read)
void expectedTerms;
```

A variable is created, never used, and explicitly voided to suppress the TypeScript unused-variable warning. This suggests an incomplete refactor.

**Recommendation:** Remove the dead code entirely.

---

### 11.2 [P2] Inconsistent Validator Strictness Across Actions

**File:** `convex/contentstack.ts`

Some actions use strict validators:
```typescript
csUpdateEntry → contentTypeUid: contentTypeValidator    // ✅ validated
csPublishEntry → contentTypeUid: contentTypeValidator   // ✅ validated
```

Other actions use plain strings:
```typescript
csGetEntry → contentTypeUid: v.string()                 // ❌ any string
csGetEntries → contentTypeUid: v.string()               // ❌ any string
csGetContentType → contentTypeUid: v.string()           // ❌ any string
```

**Issue:** Inconsistent validation means typos in content type UIDs are caught for write operations but not for reads. A user querying `"blog_posts"` (with an "s") gets a confusing API error instead of a clear validation error.

**Recommendation:** Use `contentTypeValidator` (or at least a dedicated validator) consistently across all actions. For read-only actions where arbitrary content types are legitimate, use `v.string()` intentionally and document why.

---

### 11.3 [P3] `package.json` Points to Non-Existent File

**File:** `package.json`

```json
"main": "index.js"
```

No `index.js` file exists in the repository. This is cosmetic but indicates incomplete project setup.

---

## 12. Production-Specific Risks

### 12.1 [P0] No Idempotency on `massImport`

**File:** `convex/import.ts`

**Issue:** If a `massImport` action is interrupted (Convex timeout, client disconnect, deployment restart) and re-triggered, all entries are processed from scratch. Items that were already created in the first run are created **again** — producing duplicates in ContentStack.

There is no uniqueness check (e.g. "does an entry with this `sphere_id` already exist?") before calling `createEntry`.

**Impact:** Duplicate content in the production CMS, potentially thousands of entries that need manual cleanup.

**Recommendation:**
- Before creating each entry, check if an entry with the same identifying field (e.g. `sphere_id`, `title`) already exists in ContentStack
- Consider implementing a `processed_items` log or idempotency key pattern
- At minimum, add a warning in the UI: "Re-running this import may create duplicates"

---

### 12.2 [P0] Accidental Environment Toggle

**File:** `web/src/App.tsx` (lines 28–34)

```tsx
<button onClick={toggleEnv}>
  {isProd ? "→ Dev + Staging" : "→ Main + Production"}
</button>
```

**Issue:** The environment toggle button is always visible, one click away, with no confirmation. While §6.1 notes that this toggle doesn't actually control API calls (because `config.ts` reads from env vars), if this disconnect is ever fixed, a single accidental click followed by an import could write directly to production.

**Impact Scenario:** Developer clicks "→ Main + Production" by mistake → runs a mass import → creates hundreds of entries in the production ContentStack that are visible to millions of users.

**Recommendation:**
- If fixing the settings system: add a double-confirmation modal ("You are about to switch to PRODUCTION. Type 'PRODUCTION' to confirm.")
- Consider disabling the production toggle entirely in the UI and requiring env-level changes through infrastructure tooling
- Add visual safeguards: red header background when in production mode

---

### 12.3 [P1] `sphereImport` Assumes `sphere_id` Uniqueness in ContentStack

**File:** `convex/sync.ts` (lines 200–206)

```typescript
const csMap = new Map<string, Record<string, unknown>>();
for (const entry of csEntries) {
  const sphereId = entry["sphere_id"];
  if (typeof sphereId === "string") {
    csMap.set(sphereId, entry as Record<string, unknown>);
  }
}
```

**Issue:** If multiple ContentStack entries share the same `sphere_id` (e.g. from a previous duplicate import), only the last one is retained in `csMap`. The others are silently ignored — they will never be updated and may diverge from the source data.

**Recommendation:**
- Log a warning when duplicate `sphere_id` values are detected
- Add a reconciliation check at the start of `sphereImport` that reports duplicates
- Consider enforcing uniqueness on `sphere_id` at the ContentStack content type level

---

## 13. Prioritised Action Plan

### P0 — Must Fix Before Production

| # | Action | Files | Effort |
|---|--------|-------|--------|
| 1 | Add unit tests for `blogPostMapper`, `sportGroupLookup`, pagination, HTML parser | New test files | Medium |
| 2 | Implement retry + exponential backoff on all external API calls | `client.ts` (×3) | Medium |
| 3 | Add idempotency check in `massImport` (check existence before create) | `import.ts` | Small |
| 4 | Add rollback on failed publish in `sphereImport` | `sync.ts` | Small |
| 5 | Sanitise HTML in Reports page (DOMPurify or react-markdown) | `Reports.tsx` | Small |
| 6 | Fix date comparison to handle invalid dates safely | `sync.ts` | Small |

### P1 — Should Fix Before Production

| # | Action | Files | Effort |
|---|--------|-------|--------|
| 7 | Add authentication + authorisation on Convex actions | All action files | Large |
| 8 | Fix or remove the settings toggle (settings.ts vs config.ts) | `config.ts`, `settings.ts`, `App.tsx` | Medium |
| 9 | Add rate limiting / throttle on pagination loops | `retrieve.ts` (×2) | Medium |
| 10 | Chunk long-running actions (Convex scheduler) | `sync.ts`, `import.ts`, `reportActions.ts` | Medium |
| 11 | Move logging server-side + add structured logging | All actions | Medium |
| 12 | Add confirmation modals for destructive UI actions | `EntryManager.tsx`, `MassImport.tsx` | Small |
| 13 | Fix frontend pagination race condition | `EntryManager.tsx` | Small |
| 14 | Add index on `reports.name` | `schema.ts` | Small |
| 15 | Batch `clearLogs` to avoid memory issues | `logs.ts` | Small |

### P2 — Should Address for Maintainability

| # | Action | Files | Effort |
|---|--------|-------|--------|
| 16 | Deduplicate report generation logic | `reportActions.ts`, `scripts/` | Medium |
| 17 | Remove duplicate `Locale` enum | `locales.ts`, `types.ts` | Small |
| 18 | Replace `v.any()` with typed validators | `import.ts`, `contentstack.ts`, `logs.ts` | Medium |
| 19 | Use `dotenv` library instead of custom parser | All scripts | Small |
| 20 | Apply consistent validator strictness | `contentstack.ts` | Small |
| 21 | Fix unmount cleanup for bulk polling | `EntryManager.tsx` | Small |
| 22 | Extend `managementDelete` to support searchParams | `client.ts`, `update.ts` | Small |
| 23 | Rename `require()` → `requireEnv()` | `config.ts` | Small |

### P3 — Nice to Have

| # | Action | Effort |
|---|--------|--------|
| 24 | Remove dead code (`expectedTerms`, unused imports) | Small |
| 25 | Add health check endpoint for external APIs | Small |
| 26 | Fix `package.json` `main` field | Trivial |

---

## 14. Verdict

### Current State: **Not Production Ready**

The codebase is clean, well-organised, and functionally correct for a POC. The architecture — Convex backend, React dashboard, clean separation between API clients and business logic — is sound and scalable.

However, it lacks the **reliability, safety, and observability layers** that are non-negotiable for a system that modifies production CMS content seen by millions of users:

| Dimension | Current | Production Target |
|-----------|---------|-------------------|
| **Security** | No auth, XSS vulnerability | Auth + RBAC + sanitisation |
| **Data integrity** | No atomicity, no idempotency | Rollback + dedup + safe defaults |
| **Resilience** | No retry, no rate limiting | Retry + backoff + circuit breaker |
| **Testing** | 0% coverage | Critical path coverage (mapper, sync, pagination) |
| **Observability** | console.log | Structured logging + audit trail + health checks |
| **UX safety** | One-click destructive actions | Confirmations + environment safeguards |

### Path to Production

The work is **hardening, not rewriting**. The existing code structure supports all the recommended improvements without architectural changes. Estimated effort for P0 items: **~2–3 developer-days**. P0 + P1: **~5–7 developer-days**.

### Bottom Line

> Fix the P0 items, add tests for the critical mapper and sync logic, implement retry on API calls, and add authentication. That gets you from "works on my machine" to "deployable with confidence."
