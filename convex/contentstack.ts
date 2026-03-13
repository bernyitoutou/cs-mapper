"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

import {
  countEntries,
  getAllAssets,
  getAllEntries,
  getAllManagedEntries,
  getAssets,
  getContentType,
  getContentTypes,
  getEntries,
  getEntry,
  getManagedEntries,
  getManagedEntry,
} from "./lib/contentstack/retrieve.js";

import {
  bulkPublish,
  bulkUpdate,
  getBulkJobStatus,
  patchEntries,
  publishEntry,
  unpublishEntry,
  updateEntry,
} from "./lib/contentstack/update.js";
import { localeValidator } from "./lib/locales";
import { contentTypeValidator } from "./lib/contentstack/types";

// ---------------------------------------------------------------------------
// Shared arg shapes (reused across actions)
// ---------------------------------------------------------------------------

const paginationArgs = {
  limit: v.optional(v.number()),
  skip: v.optional(v.number()),
};

const retrieveArgs = {
  locale: v.optional(localeValidator),
  query: v.optional(v.string()),
  includeDepth: v.optional(v.number()),
  only: v.optional(v.array(v.string())),
  except: v.optional(v.array(v.string())),
  orderBy: v.optional(v.string()),
  ...paginationArgs,
};

// ---------------------------------------------------------------------------
// Content type schema
// ---------------------------------------------------------------------------

/** List all content type definitions in your stack. */
export const csGetContentTypes = action({
  args: {},
  handler: async () => getContentTypes(),
});

/** Get the full field schema of a single content type. */
export const csGetContentType = action({
  args: { contentTypeUid: v.string() },
  handler: async (_ctx, { contentTypeUid }) => getContentType(contentTypeUid),
});

// ---------------------------------------------------------------------------
// Delivery API — published entries
// ---------------------------------------------------------------------------

/** Get a single published entry by UID. */
export const csGetEntry = action({
  args: {
    contentTypeUid: v.string(),
    entryUid: v.string(),
    locale: v.optional(localeValidator),
    includeDepth: v.optional(v.number()),
  },
  handler: async (_ctx, { contentTypeUid, entryUid, locale, includeDepth }) =>
    getEntry(contentTypeUid, entryUid, { locale, includeDepth }),
});

/** Get a page of published entries for a content type. */
export const csGetEntries = action({
  args: { contentTypeUid: v.string(), ...retrieveArgs },
  handler: async (_ctx, { contentTypeUid, limit, skip, ...rest }) =>
    getEntries(contentTypeUid, {
      ...rest,
      pagination: limit != null || skip != null ? { limit, skip } : undefined,
    }),
});

/**
 * Fetch ALL published entries, auto-paginating.
 * Use with caution on large content types.
 */
export const csGetAllEntries = action({
  args: {
    contentTypeUid: v.string(),
    locale: v.optional(localeValidator),
    query: v.optional(v.string()),
    includeDepth: v.optional(v.number()),
    only: v.optional(v.array(v.string())),
    except: v.optional(v.array(v.string())),
    orderBy: v.optional(v.string()),
  },
  handler: async (_ctx, { contentTypeUid, ...params }) =>
    getAllEntries(contentTypeUid, params),
});

/** Count published entries matching an optional query. */
export const csCountEntries = action({
  args: {
    contentTypeUid: v.string(),
    locale: v.optional(localeValidator),
    query: v.optional(v.string()),
  },
  handler: async (_ctx, { contentTypeUid, ...params }) =>
    countEntries(contentTypeUid, params),
});

// ---------------------------------------------------------------------------
// Management API — all entries including drafts
// ---------------------------------------------------------------------------

/** Get a single entry including unpublished drafts. */
export const csGetManagedEntry = action({
  args: {
    contentTypeUid: v.string(),
    entryUid: v.string(),
    locale: v.optional(localeValidator),
  },
  handler: async (_ctx, { contentTypeUid, entryUid, locale }) =>
    getManagedEntry(contentTypeUid, entryUid, { locale }),
});

/** Get a page of entries including drafts. */
export const csGetManagedEntries = action({
  args: { contentTypeUid: v.string(), ...retrieveArgs },
  handler: async (_ctx, { contentTypeUid, limit, skip, ...rest }) =>
    getManagedEntries(contentTypeUid, {
      ...rest,
      pagination: limit != null || skip != null ? { limit, skip } : undefined,
    }),
});

/** Fetch ALL entries including drafts, auto-paginating. */
export const csGetAllManagedEntries = action({
  args: {
    contentTypeUid: contentTypeValidator,
    locale: v.optional(localeValidator),
    query: v.optional(v.string()),
    includeDepth: v.optional(v.number()),
    only: v.optional(v.array(v.string())),
    except: v.optional(v.array(v.string())),
    orderBy: v.optional(v.string()),
  },
  handler: async (_ctx, { contentTypeUid, ...params }) =>
    getAllManagedEntries(contentTypeUid, params),
});

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

/** Get a page of assets. */
export const csGetAssets = action({
  args: {
    query: v.optional(v.string()),
    folder: v.optional(v.string()),
    ...paginationArgs,
  },
  handler: async (_ctx, { limit, skip, ...rest }) =>
    getAssets({
      ...rest,
      pagination: limit != null || skip != null ? { limit, skip } : undefined,
    }),
});

/** Fetch ALL assets, auto-paginating. */
export const csGetAllAssets = action({
  args: {
    query: v.optional(v.string()),
    folder: v.optional(v.string()),
  },
  handler: async (_ctx, params) => getAllAssets(params),
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Update an entry's fields.
 * Pass the full entry object — CS replaces the entire body.
 */
export const csUpdateEntry = action({
  args: {
    contentTypeUid: contentTypeValidator,
    entryUid: v.string(),
    /** Full entry payload, e.g. the result of csGetManagedEntry merged with your changes */
    entry: v.any(),
    locale: v.optional(localeValidator),
  },
  handler: async (_ctx, { contentTypeUid, entryUid, entry, locale }) =>
    updateEntry(
      contentTypeUid,
      entryUid,
      { entry: entry as Record<string, unknown> },
      locale
    ),
});

/** Publish an entry to one or more environments / locales. */
export const csPublishEntry = action({
  args: {
    contentTypeUid: contentTypeValidator,
    entryUid: v.string(),
    environments: v.array(v.string()),
    locales: v.array(v.string()),
    scheduledAt: v.optional(v.string()),
  },
  handler: async (_ctx, { contentTypeUid, entryUid, ...params }) =>
    publishEntry(contentTypeUid, entryUid, params),
});

/** Unpublish an entry from one or more environments / locales. */
export const csUnpublishEntry = action({
  args: {
    contentTypeUid: contentTypeValidator,
    entryUid: v.string(),
    environments: v.array(v.string()),
    locales: v.array(v.string()),
    scheduledAt: v.optional(v.string()),
  },
  handler: async (_ctx, { contentTypeUid, entryUid, ...params }) =>
    unpublishEntry(contentTypeUid, entryUid, params),
});

/** Bulk publish or unpublish a list of entries (async, returns a job ID). */
export const csBulkPublish = action({
  args: {
    entries: v.array(
      v.object({ content_type: contentTypeValidator, uid: v.string(), locale: localeValidator })
    ),
    environments: v.array(v.string()),
    locales: v.array(v.string()),
    action: v.union(v.literal("publish"), v.literal("unpublish")),
  },
  handler: async (_ctx, params) => bulkPublish(params),
});

/** Bulk update a field across many entries of the same content type (async, returns a job ID). */
export const csBulkUpdate = action({
  args: {
    content_type: contentTypeValidator,
    entries: v.array(v.object({ uid: v.string(), locale: localeValidator })),
    update: v.any(),
  },
  handler: async (_ctx, { content_type, entries, update }) =>
    bulkUpdate({
      content_type,
      entries,
      update: update as Record<string, unknown>,
    }),
});

/** Check the status of a bulk publish / update job. */
export const csGetBulkJobStatus = action({
  args: { jobId: v.string() },
  handler: async (_ctx, { jobId }) => getBulkJobStatus(jobId),
});

/**
 * Patch a specific set of fields on multiple entries one by one.
 * You must pass the full current entry objects (e.g. from csGetAllManagedEntries).
 */
export const csPatchEntries = action({
  args: {
    contentTypeUid: contentTypeValidator,
    entries: v.array(v.any()),
    patch: v.any(),
    locale: v.optional(localeValidator),
  },
  handler: async (_ctx, { contentTypeUid, entries, patch, locale }) =>
    patchEntries(
      contentTypeUid,
      entries as Parameters<typeof patchEntries>[1],
      patch as Record<string, unknown>,
      locale
    ),
});
