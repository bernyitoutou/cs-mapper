/**
 * Static lookup utilities over the generated sport_group_mapping.json.
 *
 * The mapping is a JSON file produced by `pnpm generate:sport-mapping`.
 * All lookups are O(1) / O(n) in-memory — no API call is required.
 *
 * @see scripts/generateSportGroupMapping.ts
 */

import mappingJson from "./sport_group_mapping.json" with { type: "json" };
import type { SportGroupMappingEntry } from "./types.js";

const mapping = mappingJson as Record<string, SportGroupMappingEntry>;

// Reverse index built once at module load: sportId → taxonomy term_uid
const sportIdToTaxonomy = new Map<string, string>();
// Reverse index: sportId → sport group IDs that contain it
const sportIdToGroupIds = new Map<string, string[]>();

for (const [groupId, entry] of Object.entries(mapping)) {
  for (const sportId of entry.sportIds) {
    if (entry.taxonomy && !sportIdToTaxonomy.has(sportId)) {
      sportIdToTaxonomy.set(sportId, entry.taxonomy);
    }
    const existing = sportIdToGroupIds.get(sportId) ?? [];
    existing.push(groupId);
    sportIdToGroupIds.set(sportId, existing);
  }
}

/**
 * Return the sport IDs belonging to a sport group ID.
 * Returns an empty array if the group ID is not found.
 *
 * @example getSportIdsByGroupId("14") // ["260", "277", ...]
 */
export function getSportIdsByGroupId(groupId: string): string[] {
  return mapping[groupId]?.sportIds ?? [];
}

/**
 * Return the ContentStack taxonomy term_uid for a given sport ID.
 * When a sport appears in multiple groups the taxonomy of the first group
 * (as ordered in the mapping) is returned.
 *
 * Returns null if the sport ID is not found in any group.
 *
 * @example getTaxonomyBySportId("260") // "cycling"
 */
export function getTaxonomyBySportId(sportId: string): string | null {
  return sportIdToTaxonomy.get(sportId) ?? null;
}

/**
 * Return all sport group IDs that contain the given sport ID.
 *
 * @example getGroupIdsBySportId("260") // ["14"]
 */
export function getGroupIdsBySportId(sportId: string): string[] {
  return sportIdToGroupIds.get(sportId) ?? [];
}

/**
 * Return the full mapping entry for a sport group ID, or null if not found.
 */
export function getSportGroupEntry(groupId: string): SportGroupMappingEntry | null {
  return mapping[groupId] ?? null;
}

/** The full mapping record (read-only). */
export const sportGroupMapping: Readonly<Record<string, SportGroupMappingEntry>> = mapping;
