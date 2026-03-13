export type ParamMeta = {
  name: string;
  desc: string;
  values?: string[];
};

export type OperationDependency = {
  id: string;
  reason: string;
};

export type OperationMeta = {
  id: string;
  name: string;
  description: string;
  howItWorks?: string[];
  dataSources?: string[];
  route: string;
  icon: string;
  logType: string;
  danger?: boolean;
  params: string[];
  paramsMeta: ParamMeta[];
  dependencies?: OperationDependency[];
};

export const operations: OperationMeta[] = [
    {
    id: "generate-migration-report",
    name: "Migration Report",
    description: "Reads sport categories from Convex, scrapes each Sphere category page, compares HTC vs non-HTC article links against ContentStack taxonomy counts, and saves quick plus detailed markdown reports in Convex.",
    howItWorks: [
      "Loads the category list from sportCategories in Convex, then fetches each category page through the Sphere renderer.",
      "Extracts article links from the rendered HTML, separates HTC links from other link types, and counts matching ContentStack blog_post entries by taxonomy.",
      "Builds quick and detailed markdown reports, then stores them in Convex so they can be viewed again from the dashboard.",
    ],
    dataSources: [
      "Convex sportCategories as the category source of truth.",
      "Sphere renderer HTML for per-category article discovery.",
      "ContentStack Management API counts filtered by taxonomy term and locale.",
    ],
    route: "/operations/generate-migration-report",
    icon: "📊",
    logType: "generate_report",
    params: ["locale"],
    paramsMeta: [
      { name: "locale", desc: "Locale used to count matching ContentStack entries. Determines which CS entries are considered migrated.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
    ],
    dependencies: [
      {
        id: "seed-sport-categories",
        reason: "This report reads sport categories from Convex DB, so the seed must have populated sportCategories first.",
      },
    ],
  },
  {
    id: "check-sync-status",
    name: "Check Sync Status",
    description: "Fetches published Sphere items and ContentStack entries for the selected types and locale, compares the chosen match fields, and reports synced keys, Sphere-only keys, and ContentStack-only keys.",
    howItWorks: [
      "Fetches all published Sphere items for the selected Sphere content type and locale.",
      "Fetches the selected ContentStack content type for the same locale, then extracts the chosen match field on each side with dot-notation support.",
      "Builds set-based diffs to compute the sync rate and list items that exist only in Sphere or only in ContentStack.",
    ],
    dataSources: [
      "Sphere content API results filtered by content type, locale, and published status.",
      "ContentStack delivery entries for the selected content type and locale.",
    ],
    route: "/operations/check-sync-status",
    icon: "🔍",
    logType: "sync_check",
    params: ["Sphere type", "Content Stack type", "match field", "locale"],
    paramsMeta: [
      { name: "Sphere type", desc: "Sphere content model to fetch articles from.", values: ["Highlight", "HowToUse", "HowToRepair", "Storybook", "Testing"] },
      { name: "Content Stack type", desc: "ContentStack content type to compare against.", values: ["blog_post", "blog_sport_category", "blog_content_category"] },
      { name: "match field", desc: "Field used to cross-reference entries. 'Sphere match field' is on the Sphere side, 'Content Stack match field' is on the ContentStack side — entries match when both fields hold the same value.", values: ["id (Sphere default)", "sphere_id (Content Stack default)"] },
      { name: "locale", desc: "ContentStack locale scope for the audit.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
    ],
  },
  {
    id: "sphere-import",
    name: "Sphere Import",
    description: "Fetches published Sphere content filtered by sport IDs from Convex sportGroupMappings, maps each item into a blog_post payload, then creates, updates, or publishes the matching ContentStack entries.",
    howItWorks: [
      "Loads all known sport IDs and taxonomy mappings from Convex sportGroupMappings, then fetches published Sphere items for the selected content type and locale.",
      "Maps each Sphere item to a ContentStack blog_post structure, including taxonomies derived from dd_sports through the generated lookup.",
      "Creates missing entries, updates changed ones, republishes them, and supports dry-run mode to inspect planned writes without touching ContentStack.",
    ],
    dataSources: [
      "Convex sportGroupMappings for dd_sports filters and taxonomy lookup.",
      "Sphere content API entries for the selected content type and locale.",
      "ContentStack managed entries indexed by sphere_id.",
    ],
    route: "/operations/sphere-import",
    icon: "🔄",
    logType: "sphere_import",
    params: ["Sphere type", "Content Stack type", "locale", "dry run"],
    paramsMeta: [
      { name: "Sphere type", desc: "Sphere content model to pull articles from.", values: ["Highlight", "HowToUse", "HowToRepair", "Storybook", "Testing"] },
      { name: "Content Stack type", desc: "Target ContentStack content type — entries will be created or updated under this type.", values: ["blog_post", "blog_sport_category", "blog_content_category"] },
      { name: "locale", desc: "Locale used when creating or updating ContentStack entries.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
      { name: "dry run", desc: "When on, no writes happen — only shows what would be created, updated or published.", values: ["on → audit only", "off → live write"] },
    ],
    dependencies: [
      {
        id: "generate-sport-group-mapping",
        reason: "Sphere import uses sportGroupMappings to know which sport IDs to fetch and which taxonomy terms to attach.",
      },
    ],
  },
  {
    id: "mass-import",
    name: "Mass Import",
    description: "Creates ContentStack entries in bulk from an uploaded JSON array, can create the language master first, can publish immediately, and reports created, skipped, and failed items.",
    howItWorks: [
      "Parses a local JSON array in the browser, then sends the objects to the Convex action as entry payloads.",
      "Strips ContentStack-managed system fields before creation and can optionally create the master entry before localising it.",
      "Optionally publishes after creation and records failures per item and per step so partial imports stay diagnosable.",
    ],
    dataSources: [
      "User-provided JSON array uploaded from the dashboard.",
      "ContentStack Management API create, localise, publish, and delete operations.",
    ],
    route: "/operations/mass-import",
    icon: "📥",
    logType: "mass_import",
    params: ["JSON file", "content type", "locale", "create master", "publish"],
    paramsMeta: [
      { name: "JSON file", desc: "A local .json file containing an array of objects — each object becomes one ContentStack entry." },
      { name: "content type", desc: "ContentStack content type to create entries under.", values: ["blog_post", "blog_sport_category", "blog_content_category"] },
      { name: "locale", desc: "Locale used when creating entries.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
      { name: "create master", desc: "When on, creates the master (en-GB) entry first before the localised variant. Required if the master does not yet exist in ContentStack." },
      { name: "publish", desc: "When on, each entry is automatically published immediately after creation." },
    ],
  },
  {
    id: "mass-field-update",
    name: "Mass Field Update",
    description: "Fetches all managed ContentStack entries for one type and locale, sets a single field path to the supplied value, and can republish each updated entry.",
    howItWorks: [
      "Loads every managed entry for the selected ContentStack type and locale.",
      "Applies the provided field path with dot-notation support to each entry payload, then sends the update to ContentStack.",
      "Optionally republishes each updated entry and returns per-entry failures when updates or publishes fail.",
    ],
    dataSources: [
      "ContentStack managed entries for the chosen content type and locale.",
      "A JSON-parsed value supplied from the dashboard form.",
    ],
    route: "/operations/mass-field-update",
    icon: "✏️",
    logType: "massFieldUpdate",
    params: ["content type", "locale", "field path", "value", "publish"],
    paramsMeta: [
      { name: "content type", desc: "ContentStack content type whose entries will be updated.", values: ["blog_post", "blog_sport_category", "blog_content_category"] },
      { name: "locale", desc: "Only entries in this locale are modified — master entries are never touched.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
      { name: "field path", desc: "Dot-notation path of the field to overwrite.", values: ["is_active", "metadata.robot_no_follow", "seo.title"] },
      { name: "value", desc: "JSON-encoded value to assign. Booleans, strings, numbers and objects are all valid.", values: ["true", "false", "\"string\"", "42"] },
      { name: "publish", desc: "When on, each updated entry is re-published immediately after the field update." },
    ],
  },
  {
    id: "sync-uk-category-taxonomies",
    name: "UK Category Taxonomies",
    description: "Ensures every article referenced by Convex sportCategories exists in ContentStack blog_post with the required UK taxonomy terms, creating missing entries from Sphere when necessary.",
    howItWorks: [
      "Builds an article-to-required-taxonomies index from Convex sportCategories, merging terms when the same article appears in multiple categories.",
      "Checks existing ContentStack blog_post entries by sphere_id and adds any missing taxonomy terms without removing existing ones.",
      "When an article is missing entirely, fetches it from the Sphere API or renderer fallback, maps it to blog_post, merges UK-category and dd_sports taxonomies, then creates and publishes it.",
    ],
    dataSources: [
      "Convex sportCategories for articleIds and required UK taxonomy terms.",
      "Convex sportGroupMappings to derive dd_sports taxonomies during article recreation.",
      "Sphere content API with HTML fallback, plus ContentStack managed blog_post entries.",
    ],
    route: "/operations/sync-uk-category-taxonomies",
    icon: "🏷️",
    logType: "syncUKCategoryTaxonomies",
    params: ["locale", "dry run"],
    paramsMeta: [
      { name: "locale", desc: "Locale used when creating or updating ContentStack entries.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
      { name: "dry run", desc: "When on, only audits which articles are missing or need taxonomy updates — no writes to ContentStack.", values: ["on → audit only", "off → live write"] },
    ],
    dependencies: [
      {
        id: "seed-sport-categories",
        reason: "The sync reads article IDs and taxonomies from sportCategories in Convex.",
      },
      {
        id: "generate-sport-group-mapping",
        reason: "The sync also needs sportGroupMappings to derive dd_sports taxonomies when recreating missing entries.",
      },
    ],
  },
  {
    id: "enrich-sport-categories",
    name: "Enrich Sport Categories",
    description: "Reads seeded sportCategories, scrapes each Sphere category page to extract article links and content list filters, then upserts ddSports and article IDs back into Convex.",
    howItWorks: [
      "Loads one or all rows from Convex sportCategories, then fetches the renderer HTML for each category sphereId.",
      "Extracts visible HTC article UUIDs and also parses the embedded dynamic teaser filters to recover ddSports and content types.",
      "Queries Sphere content lists with those filters, collects article sphere IDs, and upserts the enrichment into Convex sportCategories.",
    ],
    dataSources: [
      "Convex sportCategories as the rows to enrich.",
      "Sphere renderer HTML for article links and contentListFilters.",
      "Sphere content API results filtered by extracted ddSports and content types.",
    ],
    route: "/operations/enrich-sport-categories",
    icon: "🏃",
    logType: "enrich_sport_categories",
    params: ["locale", "category"],
    paramsMeta: [
      { name: "locale", desc: "Locale used when querying Sphere content lists for the extracted content filters.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
      { name: "category", desc: "Optional single category to enrich. Leave empty to process the whole sportCategories table." },
    ],
    dependencies: [
      {
        id: "seed-sport-categories",
        reason: "This operation updates existing sportCategories rows, so the table must already be seeded.",
      },
    ],
  },
    {
    id: "seed-sport-categories",
    name: "Seed Sport Categories",
    description: "Loads the legacy UK sports JSON seed into Convex sportCategories and upserts rows by sphereId so Convex becomes the source of truth.",
    howItWorks: [
      "Imports the legacy uk-sports-categories JSON file shipped in the repository.",
      "Normalises optional fields such as ddSports, articleSphereIds, and articleIds before writing.",
      "Bulk-upserts rows into Convex sportCategories so reruns refresh the existing records instead of duplicating them.",
    ],
    dataSources: [
      "The repository seed file convex/lib/sphere/uk-sports-categories.json.",
      "Convex sportCategories table as the persisted destination.",
    ],
    route: "/operations/seed-sport-categories",
    icon: "🌱",
    logType: "seed_sport_categories",
    params: ["source"],
    paramsMeta: [
      { name: "source", desc: "Loads the existing legacy uk sports categories JSON into Convex DB. Use once initially, then rerun only to refresh from the legacy seed." },
    ],
  },
  {
    id: "generate-sport-group-mapping",
    name: "Sport Group Mapping",
    description: "Fetches blog_sport_category entries from ContentStack, resolves group-to-sport mappings through the FedID referential API, and upserts the result into Convex sportGroupMappings.",
    howItWorks: [
      "Loads the blog_sport_category taxonomy entries from ContentStack for the selected locale.",
      "For each group, resolves the underlying sport IDs through the FedID referential mapping helpers.",
      "Persists the resulting group label, URL, taxonomy, and sport ID lists into Convex sportGroupMappings, while also reporting missing referential groups.",
    ],
    dataSources: [
      "ContentStack blog_sport_category entries for the chosen locale.",
      "FedID referential API lookups used by the mapping helpers.",
      "Convex sportGroupMappings as the persisted mapping store.",
    ],
    route: "/operations/generate-sport-group-mapping",
    icon: "🗺️",
    logType: "generate_sport_group_mapping",
    params: ["locale"],
    paramsMeta: [
      { name: "locale", desc: "Locale used to fetch blog sport category entries and resolve sport groups from the referential API.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
    ],
  },
  {
    id: "clean-entries",
    name: "Clean Entries",
    description: "Removes the known ContentStack system fields from a pasted JSON payload and returns cleaned objects directly in the dashboard without writing any files.",
    howItWorks: [
      "Accepts either a JSON array or an object containing an entries array from the page form.",
      "Walks each object and drops a fixed set of ContentStack-managed fields such as _version, ACL, publish_details, and audit timestamps.",
      "Returns the cleaned payload immediately so it can be copied or reused in another operation.",
    ],
    dataSources: [
      "JSON pasted by the user in the dashboard.",
      "An internal fixed allow-remove list of ContentStack system fields.",
    ],
    route: "/operations/clean-entries",
    icon: "🧹",
    logType: "clean_entries",
    params: ["entries JSON"],
    paramsMeta: [
      { name: "entries JSON", desc: "Paste either an array of entries or an object containing an entries array. The operation strips ContentStack system fields only." },
    ],
  },
  {
    id: "delete-entries",
    name: "Delete Entries",
    description: "Fetches all managed ContentStack entries for one type and locale, unpublishes each localized entry, then permanently deletes it while leaving the master entry untouched.",
    howItWorks: [
      "Loads all managed entries for the selected content type and locale.",
      "Unpublishes each localized entry from the current ContentStack environment before deletion.",
      "Deletes the localized variant and reports any entry-level failures in the final summary.",
    ],
    dataSources: [
      "ContentStack managed entries for the chosen content type and locale.",
      "ContentStack unpublish and delete operations against the current environment.",
    ],
    route: "/operations/delete-entries",
    icon: "🗑️",
    logType: "deleteEntries",
    danger: true,
    params: ["content type", "locale"],
    paramsMeta: [
      { name: "content type", desc: "ContentStack content type whose entries will be unpublished and deleted.", values: ["blog_post", "blog_sport_category", "blog_content_category"] },
      { name: "locale", desc: "Only entries for this locale are affected. The master (en-GB) entry is NOT deleted.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
    ],
  },
];

export function getOperationMeta(id: string): OperationMeta | undefined {
  return operations.find((operation) => operation.id === id);
}
