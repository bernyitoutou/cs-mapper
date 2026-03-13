export type ParamMeta = {
  name: string;
  desc: string;
  values?: string[];
};

export type OperationMeta = {
  id: string;
  name: string;
  description: string;
  route: string;
  icon: string;
  logType: string;
  danger?: boolean;
  params: string[];
  paramsMeta: ParamMeta[];
};

export const operations: OperationMeta[] = [
  {
    id: "check-sync-status",
    name: "Check Sync Status",
    description: "Audits how many Sphere articles are already in ContentStack — reports sync rate, missing entries and orphans.",
    route: "/operations/check-sync-status",
    icon: "🔍",
    logType: "sync_check",
    params: ["Sphere type", "CS type", "match field", "locale"],
    paramsMeta: [
      { name: "Sphere type", desc: "Sphere content model to fetch articles from.", values: ["Highlight", "HowToUse", "HowToRepair", "Storybook", "Testing"] },
      { name: "CS type", desc: "ContentStack content type to compare against.", values: ["blog_post", "blog_sport_category", "blog_content_category"] },
      { name: "match field", desc: "Field used to cross-reference entries. 'Sphere match field' is on the Sphere side, 'CS match field' is on the ContentStack side — entries match when both fields hold the same value.", values: ["id (Sphere default)", "sphere_id (CS default)"] },
      { name: "locale", desc: "ContentStack locale scope for the audit.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
    ],
  },
  {
    id: "sphere-import",
    name: "Sphere Import",
    description: "Pulls articles from Sphere and creates or updates the matching ContentStack entries, then publishes them.",
    route: "/operations/sphere-import",
    icon: "🔄",
    logType: "sphere_import",
    params: ["Sphere type", "CS type", "locale", "dry run"],
    paramsMeta: [
      { name: "Sphere type", desc: "Sphere content model to pull articles from.", values: ["Highlight", "HowToUse", "HowToRepair", "Storybook", "Testing"] },
      { name: "CS type", desc: "Target ContentStack content type — entries will be created or updated under this type.", values: ["blog_post", "blog_sport_category", "blog_content_category"] },
      { name: "locale", desc: "Locale used when creating or updating ContentStack entries.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
      { name: "dry run", desc: "When on, no writes happen — only shows what would be created, updated or published.", values: ["on → audit only", "off → live write"] },
    ],
  },
  {
    id: "mass-import",
    name: "Mass Import",
    description: "Creates ContentStack entries in bulk from a local JSON file. Optionally creates the master entry first and publishes.",
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
    description: "Overwrites one field across every entry of a content type for a given locale. Supports dot-notation for nested paths.",
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
    description: "Ensures every UK sport article listed in uk-sports-categories.json exists in ContentStack with the correct taxonomy terms.",
    route: "/operations/sync-uk-category-taxonomies",
    icon: "🏷️",
    logType: "syncUKCategoryTaxonomies",
    params: ["locale", "dry run"],
    paramsMeta: [
      { name: "locale", desc: "Locale used when creating or updating ContentStack entries.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
      { name: "dry run", desc: "When on, only audits which articles are missing or need taxonomy updates — no writes to ContentStack.", values: ["on → audit only", "off → live write"] },
    ],
  },
  {
    id: "generate-migration-report",
    name: "Migration Report",
    description: "Scrapes Sphere category pages, counts HTC vs non-HTC articles, cross-references ContentStack, and saves a markdown report.",
    route: "/operations/generate-migration-report",
    icon: "📊",
    logType: "generate_report",
    params: ["locale"],
    paramsMeta: [
      { name: "locale", desc: "Locale used to count matching ContentStack entries. Determines which CS entries are considered migrated.", values: ["en-GB", "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "zh-CN"] },
    ],
  },
  {
    id: "delete-entries",
    name: "Delete Entries",
    description: "Unpublishes then permanently deletes every entry of a content type for one locale. Master entries are not affected.",
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
