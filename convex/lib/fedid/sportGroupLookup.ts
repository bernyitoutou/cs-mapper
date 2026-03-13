import type { SportGroupMappingEntry } from "./types.js";

export type SportGroupLookup = {
  getSportIdsByGroupId: (groupId: string) => string[];
  getTaxonomyBySportId: (sportId: string) => string | null;
  getGroupIdsBySportId: (sportId: string) => string[];
  getSportGroupEntry: (groupId: string) => SportGroupMappingEntry | null;
  sportGroupMapping: Readonly<Record<string, SportGroupMappingEntry>>;
};

/**
 * Build in-memory O(1) lookup helpers from sport group mappings loaded at runtime.
 */
export function createSportGroupLookup(
  entries: Array<{
    groupId: string;
    label: string;
    url: string;
    csUid: string;
    taxonomy?: string | null;
    sportIds: string[];
  }>
): SportGroupLookup {
  const mapping = Object.fromEntries(
    entries.map(({ groupId, ...entry }) => [groupId, entry])
  ) as Record<string, SportGroupMappingEntry>;

  const sportIdToTaxonomy = new Map<string, string>();
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

  return {
    getSportIdsByGroupId(groupId: string): string[] {
      return mapping[groupId]?.sportIds ?? [];
    },

    getTaxonomyBySportId(sportId: string): string | null {
      return sportIdToTaxonomy.get(sportId) ?? null;
    },

    getGroupIdsBySportId(sportId: string): string[] {
      return sportIdToGroupIds.get(sportId) ?? [];
    },

    getSportGroupEntry(groupId: string): SportGroupMappingEntry | null {
      return mapping[groupId] ?? null;
    },

    sportGroupMapping: mapping,
  };
}
