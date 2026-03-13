import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Upsert a report by name (replaces existing report with the same name). */
export const saveReport = mutation({
  args: {
    name: v.string(),
    content: v.string(),
    locale: v.string(),
    generatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reports")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        locale: args.locale,
        generatedAt: args.generatedAt,
      });
      return existing._id;
    }
    return ctx.db.insert("reports", args);
  },
});

/** List all reports (metadata only), newest first. */
export const listReports = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_generatedAt")
      .order("desc")
      .collect();
    return reports.map(({ _id, name, locale, generatedAt }) => ({
      _id,
      name,
      locale,
      generatedAt,
    }));
  },
});

/** Get a single report's full content by ID. */
export const getReport = query({
  args: { id: v.id("reports") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

/** Delete a report by ID. */
export const deleteReport = mutation({
  args: { id: v.id("reports") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});
