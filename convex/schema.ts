import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  operationLogs: defineTable({
    type: v.string(), // e.g. "sync_check", "sphere_import", "mass_import", "publish", "update"
    status: v.union(v.literal("success"), v.literal("error")),
    params: v.optional(v.any()),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),

  reports: defineTable({
    name: v.string(),
    content: v.string(),
    locale: v.string(),
    generatedAt: v.number(),
  })
    .index("by_generatedAt", ["generatedAt"])
    .index("by_name", ["name"]),

  appSettings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),
});
