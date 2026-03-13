"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

const SYSTEM_FIELDS = new Set([
  "_version",
  "_content_type_uid",
  "ACL",
  "_in_progress",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "publish_details",
  "branch",
]);

export const cleanEntries = action({
  args: {
    entries: v.array(v.any()),
  },
  handler: async (_ctx, { entries }) => {
    const cleaned = entries.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return entry;
      }

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
        if (!SYSTEM_FIELDS.has(key)) {
          result[key] = value;
        }
      }
      return result;
    });

    return {
      total: cleaned.length,
      cleaned,
    };
  },
});