import { getAllSportGroups } from "./retrieve.js";
import { getAllEntries } from "../contentstack/retrieve.js";
import type { BlogSportsEntry, SportGroupMappingEntry } from "./types.js";
import { Locale } from "../locales.js";

export interface SportGroupMappingResult {
  mapping: Record<string, SportGroupMappingEntry>;
  allSportIds: string[];
  notFound: string[];
}

const BLOG_SPORT_CATEGORY_UID = "blog_sport_category";

/**
 * Fetch all published blog_sport_category entries from ContentStack.
 * Returns only the fields required to build the sport group mapping.
 */
export async function fetchBlogSportCategoryEntries(locale: Locale): Promise<BlogSportsEntry[]> {
  const entries = await getAllEntries<BlogSportsEntry>(BLOG_SPORT_CATEGORY_UID, { locale });
  return entries;
}

/**
 * Build a sport group ID → mapping entry from a list of blog_sports_entries.
 * Fetches sport groups from the Referential API for the given locale.
 *
 * @param entries - Array of blog sports entries (from blog_sports_entries.json or ContentStack)
 * @param locale  - Locale in any format: "en-GB", "en-gb", or "en_GB"
 */
export async function buildSportGroupMapping(
  entries: BlogSportsEntry[],
  locale: Locale
): Promise<SportGroupMappingResult> {
  const groups = await getAllSportGroups(locale);

  const mapping: Record<string, SportGroupMappingEntry> = {};
  const notFound: string[] = [];

  for (const entry of entries) {
    const groupId = entry.sport_ddfs_id;
    const group = groups.get(groupId);
    const taxonomy = entry.taxonomies?.find((t) => t.taxonomy_uid === "sport_category")?.term_uid ?? null;

    mapping[groupId] = {
      label: entry.sport_label,
      url: entry.url,
      csUid: entry.uid,
      taxonomy,
      sportIds: group?.sports ?? [],
    };

    if (!group) {
      notFound.push(`${groupId} (${entry.sport_label})`);
    }
  }

  const allSportIds = [...new Set(Object.values(mapping).flatMap((g) => g.sportIds))].sort(
    (a, b) => Number(a) - Number(b)
  );

  return { mapping, allSportIds, notFound };
}
