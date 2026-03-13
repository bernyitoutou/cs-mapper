import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Branch, Environment } from "../lib/contentstack/types.js";

const DEFAULTS = {
  csEnvironment: Environment.Staging,
  csBranch: Branch.Dev,
} as const;

type SettingsKey = keyof typeof DEFAULTS;

/** Get current environment + branch settings. */
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("appSettings").collect();
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    return {
      csEnvironment: (map["csEnvironment"] ?? DEFAULTS.csEnvironment) as Environment,
      csBranch: (map["csBranch"] ?? DEFAULTS.csBranch) as Branch,
    };
  },
});

/** Update one or more settings keys. */
export const updateSettings = mutation({
  args: {
    csEnvironment: v.optional(v.union(v.literal(Environment.Production), v.literal(Environment.Staging))),
    csBranch: v.optional(v.union(v.literal(Branch.Main), v.literal(Branch.Dev))),
  },
  handler: async (ctx, args) => {
    const updates = Object.entries(args).filter(([, v]) => v !== undefined) as [SettingsKey, string][];
    for (const [key, value] of updates) {
      const existing = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { value });
      } else {
        await ctx.db.insert("appSettings", { key, value });
      }
    }
  },
});
