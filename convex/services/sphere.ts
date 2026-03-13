"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

import {
  getAllSphereContents,
  getSphereContentByUUID,
  getSphereContentsByModelCode,
  getSphereContentTypes,
  searchSphereContents,
} from "../lib/sphere/retrieve.js";

// ---------------------------------------------------------------------------
// Retrieve
// ---------------------------------------------------------------------------

/** Get a single Sphere content element by its UUID. */
export const sphereGetByUUID = action({
  args: { uuid: v.string() },
  handler: async (_ctx, { uuid }) => getSphereContentByUUID(uuid),
});

/**
 * Search Sphere contents with filters.
 *
 * @example
 * // from a Convex client
 * await api.services.sphere.sphereSearch({ contentTypeId: "875ef604-...", locale: "fr-FR", status: 1 })
 */
export const sphereSearch = action({
  args: {
    contentTypeId: v.optional(v.string()),
    modelCodes: v.optional(v.array(v.string())),
    locale: v.optional(v.string()),
    /** 1 = published, 0 = draft */
    status: v.optional(v.number()),
    page: v.optional(v.number()),
    perPage: v.optional(v.number()),
  },
  handler: async (_ctx, params) =>
    searchSphereContents({
      ...params,
      status: params.status as 0 | 1 | undefined,
    }),
});

/**
 * Fetch ALL Sphere contents matching a filter, paginating automatically.
 * Use with caution — makes multiple HTTP requests.
 */
export const sphereGetAll = action({
  args: {
    contentTypeId: v.optional(v.string()),
    modelCodes: v.optional(v.array(v.string())),
    locale: v.optional(v.string()),
    status: v.optional(v.number()),
    perPage: v.optional(v.number()),
  },
  handler: async (_ctx, params) =>
    getAllSphereContents({
      ...params,
      status: params.status as 0 | 1 | undefined,
    }),
});

/**
 * Get Sphere contents for one or more product model codes.
 *
 * @example
 * await api.services.sphere.sphereGetByModelCodes({
 *   modelCodes: ["8581842"],
 *   contentTypeId: "875ef604-5ca2-4ed9-96b7-15e6c6e0fd0d",
 *   locale: "en-GB",
 *   status: 1,
 * })
 */
export const sphereGetByModelCodes = action({
  args: {
    modelCodes: v.array(v.string()),
    contentTypeId: v.string(),
    locale: v.optional(v.string()),
    status: v.optional(v.number()),
  },
  handler: async (_ctx, { modelCodes, contentTypeId, locale, status }) =>
    getSphereContentsByModelCode(modelCodes, contentTypeId, {
      locale,
      status: status as 0 | 1 | undefined,
    }),
});

/** List all content type definitions available in Sphere. */
export const sphereGetContentTypes = action({
  args: {},
  handler: async () => getSphereContentTypes(),
});
