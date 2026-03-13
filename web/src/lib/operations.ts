export type OperationMeta = {
  id: string;
  name: string;
  description: string;
  route: string;
  icon: string;
  logType: string;
  danger?: boolean;
};

export const operations: OperationMeta[] = [
  {
    id: "check-sync-status",
    name: "Check Sync Status",
    description: "Compare Sphere and ContentStack entries — shows sync rate and mismatches.",
    route: "/operations/check-sync-status",
    icon: "🔍",
    logType: "sync_check",
  },
  {
    id: "sphere-import",
    name: "Sphere Import",
    description: "Import content from Sphere into ContentStack (create, update, publish).",
    route: "/operations/sphere-import",
    icon: "🔄",
    logType: "sphere_import",
  },
  {
    id: "mass-import",
    name: "Mass Import",
    description: "Bulk-create entries from a JSON file upload.",
    route: "/operations/mass-import",
    icon: "📥",
    logType: "mass_import",
  },
  {
    id: "mass-field-update",
    name: "Mass Field Update",
    description: "Set a single field value across all entries of a content type.",
    route: "/operations/mass-field-update",
    icon: "✏️",
    logType: "massFieldUpdate",
  },
  {
    id: "sync-uk-category-taxonomies",
    name: "UK Category Taxonomies",
    description: "Sync UK sports article taxonomies from Sphere to ContentStack.",
    route: "/operations/sync-uk-category-taxonomies",
    icon: "🏷️",
    logType: "syncUKCategoryTaxonomies",
  },
  {
    id: "generate-migration-report",
    name: "Migration Report",
    description: "Scrape Sphere pages and generate a markdown migration status report.",
    route: "/operations/generate-migration-report",
    icon: "📊",
    logType: "generate_report",
  },
  {
    id: "delete-entries",
    name: "Delete Entries",
    description: "Unpublish and delete all entries for a locale. Irreversible.",
    route: "/operations/delete-entries",
    icon: "🗑️",
    logType: "deleteEntries",
    danger: true,
  },
];
