"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

import { localeValidator } from "../lib/locales.js";
import { getSportsForGroup, getSportsForGroups } from "../lib/fedid/retrieve.js";
import { buildSportGroupMapping } from "../lib/fedid/mapping.js";

/**
 * Get the sport IDs belonging to a given sport group ID from the Referential API.
 *
 * @example
 * await api.services.fedid.getSportIdsForGroup({
 *   sportGroupId: "14",
 *   locale: "en-GB",
 * })
 * // returns: { sportGroupId: "14", sportIds: ["260", "277", "278", "280"] }
 */
export const getSportIdsForGroup = action({
  args: {
    /** DDFS sport group ID. e.g. "14" */
    sportGroupId: v.string(),
    /** Locale to use for the Referential API. e.g. "en-GB" */
    locale: localeValidator,
  },
  handler: async (_ctx, args) => {
    const sportIds = await getSportsForGroup(args.sportGroupId, args.locale);
    return { sportGroupId: args.sportGroupId, sportIds };
  },
});

/**
 * Batch resolve multiple sport group IDs → sport IDs in a single API request.
 *
 * @example
 * await api.services.fedid.getSportIdsForGroups({
 *   sportGroupIds: ["14", "83", "180"],
 *   locale: "en-GB",
 * })
 */
export const getSportIdsForGroups = action({
  args: {
    /** Array of DDFS sport group IDs to resolve */
    sportGroupIds: v.array(v.string()),
    /** Locale to use for the Referential API. e.g. "en-GB" */
    locale: localeValidator,
  },
  handler: async (_ctx, args) => {
    const mapping = await getSportsForGroups(args.sportGroupIds, args.locale);
    const allSportIds = [...new Set(Object.values(mapping).flat())].sort();
    return { mapping, allSportIds };
  },
});

const blogSportsEntryValidator = v.object({
  uid: v.string(),
  locale: v.string(),
  sport_ddfs_id: v.string(),
  sport_label: v.string(),
  title: v.string(),
  url: v.string(),
  taxonomies: v.optional(
    v.array(v.object({ taxonomy_uid: v.string(), term_uid: v.string() }))
  ),
});

/**
 * Build the sport group → sport IDs mapping from blog sports entries.
 * Returns the full mapping (with label, url, uid, taxonomy and sportIds) plus
 * a deduplicated list of all sport IDs that appear in at least one group.
 *
 * @example
 * await api.services.fedid.generateSportGroupMapping({
 *   entries: [...],   // blog_sports_entries
 *   locale: "en-GB",
 * })
 */
export const generateSportGroupMapping = action({
  args: {
    entries: v.array(blogSportsEntryValidator),
    locale: localeValidator,
  },
  handler: async (_ctx, args) => {
    return buildSportGroupMapping(args.entries, args.locale);
  },
});
