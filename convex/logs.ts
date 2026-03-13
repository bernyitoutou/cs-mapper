import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Insert a new operation log entry. */
export const writelog = mutation({
  args: {
    type: v.string(),
    status: v.union(v.literal("success"), v.literal("error")),
    params: v.optional(v.any()),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("operationLogs", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

/** Return the 100 most recent log entries, newest first. */
export const getLogs = query({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db
      .query("operationLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);
    return logs;
  },
});

/** Delete all log entries. */
export const clearLogs = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete in batches of 500 to stay within Convex mutation memory/write limits
    while (true) {
      const batch = await ctx.db.query("operationLogs").take(500);
      if (batch.length === 0) break;
      for (const doc of batch) {
        await ctx.db.delete(doc._id);
      }
    }
  },
});
