# Convex — CS Mapper

Mass-action tooling for ContentStack and Sphere, built on [Convex actions](https://docs.convex.dev/functions/actions).

---

## Structure

```
convex/
  contentstack.ts        → Exposed Convex actions (ContentStack)
  sphere.ts              → Exposed Convex actions (Sphere)
  sync.ts                → Cross-source sync check actions
  lib/
    config.ts            → Environment variable loader
    utils.ts             → Shared helpers (getNestedValue…)
    contentstack/
      types.ts           → TypeScript types (Entry, Pagination, params…)
      client.ts          → Low-level fetch helpers (Delivery API + Management API)
      retrieve.ts        → Read functions
      update.ts          → Write / publish functions
    sphere/
      types.ts           → TypeScript types
      client.ts          → Low-level fetch helpers
      retrieve.ts        → Read functions
```

---

## Environments

Push variables into Convex with:

```bash
pnpm env:staging      # reads .env.staging
pnpm env:production   # reads .env.production
```

Expected variables:

| Variable | Description |
|---|---|
| `CS_STACK_API_KEY` | ContentStack API key |
| `CS_DELIVERY_TOKEN` | Delivery API token (published content only) |
| `CS_MANAGEMENT_TOKEN` | Management API token (read + write) |
| `CS_ENVIRONMENT` | Target CS environment (`staging` / `production`) |
| `CS_BRANCH` | CS branch (`dev` / `main`) |
| `CS_HOST` | CS host (`https://gcp-na-api.contentstack.com`) |
| `SPHERE_HOST` | Sphere host |
| `SPHERE_API_KEY` | Sphere API key |
| `SPHERE_PIXL_HOST` | Media CDN host (optional) |
| `SPHERE_CONTENT_TYPES_IDS` | JSON map `{ slug: uuid }` of Sphere content types |

---

## ContentStack actions

All actions live in `convex/contentstack.ts` and are prefixed with `cs`.

### Read the schema

```ts
// List all content types in the stack
await api.contentstack.csGetContentTypes()

// Full field schema of a single content type
await api.contentstack.csGetContentType({ contentTypeUid: "homepage" })
```

### Fetch entries (published only — Delivery API)

```ts
// Single entry by UID
await api.contentstack.csGetEntry({
  contentTypeUid: "homepage",
  entryUid: "blt123",
  locale: "fr-FR",
})

// Paginated entries with filters
await api.contentstack.csGetEntries({
  contentTypeUid: "homepage",
  locale: "fr-FR",
  query: '{"title":{"$regex":"^Sport"}}',
  orderBy: "-updated_at",
  limit: 50,
  skip: 0,
})

// All entries (auto-paginated)
await api.contentstack.csGetAllEntries({
  contentTypeUid: "footer",
  locale: "en-GB",
})

// Count entries
await api.contentstack.csCountEntries({
  contentTypeUid: "homepage",
  locale: "fr-FR",
})
```

### Fetch entries (drafts included — Management API)

```ts
await api.contentstack.csGetManagedEntry({ contentTypeUid: "homepage", entryUid: "blt123" })
await api.contentstack.csGetManagedEntries({ contentTypeUid: "homepage", locale: "fr-FR" })
await api.contentstack.csGetAllManagedEntries({ contentTypeUid: "homepage" })
```

### Assets

```ts
await api.contentstack.csGetAssets({ limit: 100 })
await api.contentstack.csGetAllAssets()
```

### Update an entry

ContentStack replaces the entire entry body — fetch the entry first, merge your changes, then save.

```ts
const entry = await api.contentstack.csGetManagedEntry({
  contentTypeUid: "homepage",
  entryUid: "blt123",
  locale: "en-GB",
})

await api.contentstack.csUpdateEntry({
  contentTypeUid: "homepage",
  entryUid: "blt123",
  entry: { ...entry, title: "New title" },
  locale: "en-GB",
})
```

### Publish / unpublish

```ts
await api.contentstack.csPublishEntry({
  contentTypeUid: "homepage",
  entryUid: "blt123",
  environments: ["staging"],
  locales: ["en-GB", "fr-FR"],
})

await api.contentstack.csUnpublishEntry({
  contentTypeUid: "homepage",
  entryUid: "blt123",
  environments: ["staging"],
  locales: ["en-GB"],
})
```

### Bulk publish / unpublish (async)

CS processes bulk operations asynchronously — poll the returned job ID to track completion.

```ts
const { job_id } = await api.contentstack.csBulkPublish({
  entries: [
    { content_type: "homepage", uid: "blt1", locale: "en-GB" },
    { content_type: "footer",   uid: "blt2", locale: "fr-FR" },
  ],
  environments: ["staging"],
  locales: ["en-GB", "fr-FR"],
  action: "publish",
})

await api.contentstack.csGetBulkJobStatus({ jobId: job_id })
// → { status: "in_progress" | "completed" | "failed" }
```

### Bulk field update (async)

```ts
const { job_id } = await api.contentstack.csBulkUpdate({
  content_type: "homepage",
  entries: [
    { uid: "blt1", locale: "en-GB" },
    { uid: "blt2", locale: "fr-FR" },
  ],
  update: { tags: ["script-updated"] },
})
```

### Patch entries one by one (sync)

Useful for complex field transformations on an already-fetched set of entries.
For large sets prefer `csBulkUpdate` (single API call).

```ts
const entries = await api.contentstack.csGetAllManagedEntries({
  contentTypeUid: "homepage",
  locale: "en-GB",
})

await api.contentstack.csPatchEntries({
  contentTypeUid: "homepage",
  entries,
  patch: { tags: ["v2"] },
  locale: "en-GB",
})
// Returns [{ uid, success, error? }, …]
```

---

## Sphere actions

All actions live in `convex/sphere.ts` and are prefixed with `sphere`.

```ts
// By UUID
await api.sphere.sphereGetByUUID({ uuid: "4c2eadf7-..." })

// Search with filters
await api.sphere.sphereSearch({
  contentTypeId: "875ef604-5ca2-4ed9-96b7-15e6c6e0fd0d",
  locale: "fr-FR",
  status: 1,        // 1 = published, 0 = draft
  page: 1,
  perPage: 50,
})

// All pages (auto-paginated)
await api.sphere.sphereGetAll({
  contentTypeId: "875ef604-5ca2-4ed9-96b7-15e6c6e0fd0d",
  locale: "fr-FR",
  status: 1,
})

// By product model code(s)
await api.sphere.sphereGetByModelCodes({
  modelCodes: ["8581842", "8511826"],
  contentTypeId: "875ef604-5ca2-4ed9-96b7-15e6c6e0fd0d",
  locale: "en-GB",
  status: 1,
})

// List available content type definitions
await api.sphere.sphereGetContentTypes()
```

---

## Sync actions

All actions live in `convex/sync.ts`.

### `checkSyncStatus` — Sphere ↔ ContentStack

Compares all **published** items from a Sphere content type against all **published** entries from a ContentStack content type, matching on configurable dot-notation field paths.

```ts
const report = await api.sync.checkSyncStatus({
  // Sphere
  sphereContentTypeId: "875ef604-5ca2-4ed9-96b7-15e6c6e0fd0d",
  sphereMatchField: "id",            // dot-notation path on Sphere item

  // ContentStack
  csContentTypeUid: "product_page",
  csMatchField: "sphere_id",         // dot-notation path on CS entry

  // Optional filters
  locale: "fr-FR",
  sphereStatus: 1,                   // 1 = published (default), 0 = draft
})
```

**Report shape:**
```ts
{
  params: { ... },          // echo of input args
  summary: {
    sphere:       { total, withMatchField, missingMatchField },
    contentstack: { total, withMatchField, missingMatchField },
    sync: {
      synced: number,
      onlyInSphere: number,
      onlyInContentStack: number,
      syncRate: string,     // e.g. "94.3%"
    },
  },
  details: {
    onlyInSphere: string[],        // Sphere values not found in CS
    onlyInContentStack: string[],  // CS values not found in Sphere
  },
}
```

The summary is also printed to the Convex dashboard logs.

---

## Adding a new ContentStack content type

1. Inspect the schema to understand available fields:
   ```ts
   await api.contentstack.csGetContentType({ contentTypeUid: "my_content_type" })
   ```
2. Optionally add a TypeScript type in `convex/lib/contentstack/types.ts`.
3. Use `csGetAllEntries` / `csGetAllManagedEntries` with `contentTypeUid: "my_content_type"`.
4. Implement business logic in a new action file under `convex/`.
