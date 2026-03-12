import { fetchAllSportGroups } from "./client.js";
import type { SportGroup } from "./types.js";

/**
 * Convert a locale from "en-GB" / "en-gb" format to "en_GB" (underscore, uppercase region)
 * as required by the Referential API.
 */
export function toReferentialLocale(locale: string): string {
  const [lang, region] = locale.replace("_", "-").split("-");
  if (!lang) throw new Error(`Invalid locale: ${locale}`);
  return region ? `${lang.toLowerCase()}_${region.toUpperCase()}` : lang.toLowerCase();
}

/**
 * Fetch all sport groups from the Referential API and index them by ID.
 *
 * @param locale - Locale in any format: "en-GB", "en-gb", or "en_GB"
 */
export async function getAllSportGroups(locale: string): Promise<Map<string, SportGroup>> {
  const apiLocale = toReferentialLocale(locale);
  const response = await fetchAllSportGroups(apiLocale);

  const index = new Map<string, SportGroup>();
  for (const group of response.items) {
    index.set(group.id, group);
  }
  return index;
}

/**
 * Get the sport IDs belonging to a given sport group ID.
 *
 * Fetches all sport groups from the Referential API (single request) and returns
 * the `sports` array for the matching group, or an empty array if not found.
 *
 * @param sportGroupId - The DDFS sport group ID. e.g. "14"
 * @param locale - Locale in any format: "en-GB", "en-gb", or "en_GB"
 */
export async function getSportsForGroup(sportGroupId: string, locale: string): Promise<string[]> {
  const groups = await getAllSportGroups(locale);
  return groups.get(sportGroupId)?.sports ?? [];
}

/**
 * Batch resolve sport group IDs → sport IDs for a list of group IDs.
 * Makes a single API request regardless of how many IDs are provided.
 *
 * @param sportGroupIds - Array of DDFS sport group IDs to resolve
 * @param locale - Locale in any format: "en-GB", "en-gb", or "en_GB"
 * @returns Record mapping each input group ID to its sport IDs array
 */
export async function getSportsForGroups(
  sportGroupIds: string[],
  locale: string
): Promise<Record<string, string[]>> {
  const groups = await getAllSportGroups(locale);
  const result: Record<string, string[]> = {};
  for (const id of sportGroupIds) {
    result[id] = groups.get(id)?.sports ?? [];
  }
  return result;
}
