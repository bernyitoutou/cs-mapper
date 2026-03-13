import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

export const listSportCategories = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("sportCategories").collect();
  },
});

export const getSportCategory = query({
  args: { sphereId: v.string() },
  handler: async (ctx, { sphereId }) => {
    return ctx.db
      .query("sportCategories")
      .withIndex("by_sphereId", (q) => q.eq("sphereId", sphereId))
      .first();
  },
});

const sportCategoryFields = {
  name: v.string(),
  url: v.string(),
  sphereId: v.string(),
  taxonomy: v.string(),
  ddSports: v.optional(v.array(v.number())),
  articleSphereIds: v.optional(v.array(v.string())),
  articleIds: v.optional(v.array(v.string())),
};

export const upsertSportCategory = mutation({
  args: sportCategoryFields,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sportCategories")
      .withIndex("by_sphereId", (q) => q.eq("sphereId", args.sphereId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return ctx.db.insert("sportCategories", { ...args, updatedAt: now });
  },
});

export const bulkUpsertSportCategories = mutation({
  args: {
    categories: v.array(v.object(sportCategoryFields)),
  },
  handler: async (ctx, { categories }) => {
    const now = Date.now();
    let inserted = 0;
    let updated = 0;
    for (const cat of categories) {
      const existing = await ctx.db
        .query("sportCategories")
        .withIndex("by_sphereId", (q) => q.eq("sphereId", cat.sphereId))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { ...cat, updatedAt: now });
        updated++;
      } else {
        await ctx.db.insert("sportCategories", { ...cat, updatedAt: now });
        inserted++;
      }
    }
    return { inserted, updated };
  },
});
