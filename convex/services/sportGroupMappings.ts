import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

const sportGroupMappingFields = {
  groupId: v.string(),
  label: v.string(),
  url: v.string(),
  csUid: v.string(),
  taxonomy: v.optional(v.string()),
  sportIds: v.array(v.string()),
};

export const listSportGroupMappings = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("sportGroupMappings").collect();
  },
});

export const getSportGroupMapping = query({
  args: { groupId: v.string() },
  handler: async (ctx, { groupId }) => {
    return ctx.db
      .query("sportGroupMappings")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .first();
  },
});

export const getAllSportIds = query({
  args: {},
  handler: async (ctx) => {
    const mappings = await ctx.db.query("sportGroupMappings").collect();
    const sportIds = new Set<string>();

    for (const mapping of mappings) {
      for (const sportId of mapping.sportIds) {
        sportIds.add(sportId);
      }
    }

    return [...sportIds].sort((left, right) => Number(left) - Number(right));
  },
});

export const bulkUpsertSportGroupMappings = mutation({
  args: {
    mappings: v.array(v.object(sportGroupMappingFields)),
  },
  handler: async (ctx, { mappings }) => {
    const now = Date.now();
    let inserted = 0;
    let updated = 0;

    for (const mapping of mappings) {
      const existing = await ctx.db
        .query("sportGroupMappings")
        .withIndex("by_groupId", (q) => q.eq("groupId", mapping.groupId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { ...mapping, updatedAt: now });
        updated += 1;
      } else {
        await ctx.db.insert("sportGroupMappings", { ...mapping, updatedAt: now });
        inserted += 1;
      }
    }

    return { inserted, updated };
  },
});