"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { localeValidator } from "../lib/locales.js";
import { buildSportGroupMapping, fetchBlogSportCategoryEntries } from "../lib/fedid/mapping.js";

type GenerateSportGroupMappingSummary = {
  groups: number;
  allSportIds: number;
  missingGroups: number;
  inserted: number;
  updated: number;
};

type GenerateSportGroupMappingResult = {
  summary: GenerateSportGroupMappingSummary;
  notFound: string[];
};

export const generateSportGroupMapping = action({
  args: {
    locale: localeValidator,
  },
  handler: async (ctx, { locale }): Promise<GenerateSportGroupMappingResult> => {
    const entries = await fetchBlogSportCategoryEntries(locale);
    const { mapping, allSportIds, notFound } = await buildSportGroupMapping(entries, locale);

    const mappings = Object.entries(mapping).map(([groupId, entry]) => ({
      groupId,
      label: entry.label,
      url: entry.url,
      csUid: entry.csUid,
      taxonomy: entry.taxonomy ?? undefined,
      sportIds: entry.sportIds,
    }));

    const upsertResult: { inserted: number; updated: number } = await ctx.runMutation(
      api.services.sportGroupMappings.bulkUpsertSportGroupMappings,
      { mappings }
    );

    const summary: GenerateSportGroupMappingSummary = {
      groups: mappings.length,
      allSportIds: allSportIds.length,
      missingGroups: notFound.length,
      ...upsertResult,
    };

    await ctx.runMutation(api.services.logs.writelog, {
      type: "generate_sport_group_mapping",
      status: notFound.length === 0 ? "success" : "error",
      params: { locale },
      result: summary,
      error: notFound.length > 0 ? `${notFound.length} group(s) missing in referential API` : undefined,
    });

    return {
      summary,
      notFound,
    };
  },
});