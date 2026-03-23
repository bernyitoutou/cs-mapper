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
