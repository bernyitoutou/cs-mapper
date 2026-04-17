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
  schedulable?: boolean;
  params: string[];
  paramsMeta: ParamMeta[];
  dependencies?: OperationDependency[];
};

export const operations: OperationMeta[] = [
    {
    id: "sync-uk-category-taxonomies",
    name: "Sync Sphere Articles with ContentStack Blog Posts",
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
    schedulable: true,
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
    id: "generate-migration-report",
    name: "Generated Blog Post Migration Report",
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
    schedulable: true,
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
    id: "generate-obsolete-image-report",
    name: "Generate Obsolete Image Report",
    description: "Scans articles linked from each UK category URL, probes their Pixl teaser image, and generates a report of obsolete 1x1 assets grouped by category URL.",
    howItWorks: [
      "Loads the category URLs stored in Convex sportCategories and fetches each category page through the Sphere renderer.",
      "Extracts linked HTC article UUIDs, loads each article teaser image metadata, then probes the Pixl URL to read HTTP status and image dimensions.",
      "Marks assets as obsolete when Pixl returns a 1x1 placeholder or an obsolete image response, then saves quick and detailed markdown reports in Convex.",
    ],
    dataSources: [
      "Convex sportCategories for the category URLs and Sphere UUIDs.",
      "Sphere renderer HTML for article discovery and teaser image metadata.",
      "Pixl image responses to detect 1x1 obsolete assets.",
    ],
    route: "/operations/generate-obsolete-image-report",
    icon: "🖼️",
    logType: "generate_obsolete_image_report",
    params: ["category url"],
    paramsMeta: [
      { name: "category url", desc: "Optional single category URL to scan. Leave on All categories to generate the report grouped across every stored category URL." },
    ],
    dependencies: [
      {
        id: "seed-sport-categories",
        reason: "The report uses sportCategories as the source of category URLs and Sphere IDs.",
      },
    ],
  },
  {
    id: "sphere-import",
    name: "Import Blog Posts entries from Sphere articles",
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
    schedulable: true,
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
    schedulable: true,
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
    schedulable: true,
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
    schedulable: true,
    params: ["locale"],
    paramsMeta: [
      { name: "locale", desc: "Locale used to fetch blog sport category entries and resolve sport groups from the referential API.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
    ],
  },
  {
    id: "migrate-blog-sport-category-sports-field",
    name: "Migrate Blog Sport Category Sports Field",
    description: "Backfills the new sports array on blog_sport_category entries from the legacy sport_ddfs_id and is_sport_group fields, while optionally clearing those legacy fields after the copy.",
    howItWorks: [
      "Loads all managed blog_sport_category entries for the selected locale from ContentStack.",
      "Builds one sports item from the legacy sport_ddfs_id and is_sport_group values and appends it only when that exact object is not already present.",
      "Preserves existing valid sports items, supports dry-run previews, and can optionally publish the updated entries and clear the legacy fields once downstream scripts are ready.",
    ],
    dataSources: [
      "ContentStack managed blog_sport_category entries for the chosen locale.",
      "Existing legacy fields sport_ddfs_id and is_sport_group on each entry.",
    ],
    route: "/operations/migrate-blog-sport-category-sports-field",
    icon: "🧬",
    logType: "migrateBlogSportCategorySportsField",
    params: ["locale", "dry run", "publish", "clear legacy fields"],
    paramsMeta: [
      { name: "locale", desc: "Locale whose blog_sport_category entries will be inspected and updated.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
      { name: "dry run", desc: "When on, shows which entries would be updated without writing anything to ContentStack.", values: ["on → audit only", "off → live write"] },
      { name: "publish", desc: "When on, re-publishes each updated localized entry after the sports array is written.", values: ["on → publish updated entries", "off → leave unpublished changes"] },
      { name: "clear legacy fields", desc: "Optional cleanup step. When on during a live run, clears sport_ddfs_id and is_sport_group after copying them into sports.", values: ["off → keep legacy fields", "on → clear legacy fields"] },
    ],
  },/** 
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
  },*/
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
