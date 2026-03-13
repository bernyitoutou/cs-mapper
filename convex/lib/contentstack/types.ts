import { v } from "convex/values";
import { Locale } from "../locales";

// ---------------------------------------------------------------------------
// Enums — Content Types, Taxonomy, Environment, Branch
// ---------------------------------------------------------------------------

export enum ContentType {
  BlogPost = "blog_post",
  BlogSportCategory = "blog_sport_category",
  BlogContentCategory = "blog_content_category",
}

export const contentTypeValidator = v.union(
  v.literal(ContentType.BlogPost),
  v.literal(ContentType.BlogSportCategory),
  v.literal(ContentType.BlogContentCategory)
);

export enum Taxonomy {
  SportCategory = "sport_category",
  ContentCategory = "content_category",
}

export const taxonomyValidator = v.union(
  v.literal(Taxonomy.SportCategory),
  v.literal(Taxonomy.ContentCategory)
);

export enum Environment {
  Production = "production",
  Staging = "staging",
}

export const environmentValidator = v.union(
  v.literal(Environment.Production),
  v.literal(Environment.Staging)
);

export enum Branch {
  Main = "main",
  Dev = "dev",
}

export const branchValidator = v.union(
  v.literal(Branch.Main),
  v.literal(Branch.Dev)
);

// ---------------------------------------------------------------------------

export type Pagination = {
  /** Max entries per page (CS max is 250) */
  limit?: number;
  /** Number of entries to skip */
  skip?: number;
};

export type PublishDetails = {
  environment: Environment;
  locale: Locale;
  time: string;
  user: string;
  version?: number;
};

/** Minimal system fields always present on any CS entry. */
export type EntrySystemFields = {
  uid: string;
  title: string;
  locale: Locale;
  _version: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  tags: string[];
  _in_progress: boolean;
  publish_details?: PublishDetails | PublishDetails[];
};

/**
 * A generic ContentStack entry.
 * `T` carries the content-type-specific fields.
 * Use `Record<string, unknown>` when you haven't defined the schema yet.
 */
export type Entry<
  T extends Record<string, unknown> = Record<string, unknown>,
> = EntrySystemFields & T;

export type GetEntriesResponse<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  entries: Entry<T>[];
  count?: number;
};

export type GetEntryResponse<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  entry: Entry<T>;
};

export type GetAssetsResponse = {
  assets: Asset[];
  count?: number;
};

export type GetContentTypesResponse = {
  content_types: ContentTypeDefinition[];
  count?: number;
};

export type GetContentTypeResponse = {
  content_type: ContentTypeDefinition;
};

export type ContentTypeDefinition = {
  uid: string;
  title: string;
  description: string;
  schema: ContentTypeFieldDefinition[];
  options: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ContentTypeFieldDefinition = {
  uid: string;
  display_name: string;
  data_type: string;
  mandatory: boolean;
  unique: boolean;
  multiple: boolean;
  schema?: ContentTypeFieldDefinition[];
  [key: string]: unknown;
};

export type Asset = {
  uid: string;
  title: string;
  filename: string;
  content_type: string;
  file_size: string;
  url: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  publish_details?: PublishDetails[];
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Retrieve params
// ---------------------------------------------------------------------------

export type GetEntriesParams = {
  /** CS query JSON syntax. e.g. '{"title":{"$regex":"^Sport"}}' */
  query?: string;
  locale?: Locale;
  /** Include referenced entries up to this depth (max 5) */
  includeDepth?: number;
  /** Fields to include in the response */
  only?: string[];
  /** Fields to exclude from the response */
  except?: string[];
  /** Field to sort by. Prefix with "-" for descending. */
  orderBy?: string;
  pagination?: Pagination;
};

export type GetAssetsParams = {
  query?: string;
  folder?: string;
  pagination?: Pagination;
};

// ---------------------------------------------------------------------------
// Update / Publish params
// ---------------------------------------------------------------------------

export type UpdateEntryPayload = {
  entry: Record<string, unknown>;
};

export type PublishEntryParams = {
  environments: Environment[];
  locales: Locale[];
  /** ISO datetime for scheduled publishing */
  scheduledAt?: string;
};

export type BulkPublishItem = {
  content_type: string;
  uid: string;
  locale: string;
};

export type BulkPublishParams = {
  entries: BulkPublishItem[];
  environments: Environment[];
  locales: Locale[];
  action: "publish" | "unpublish";
};

export type BulkUpdateParams = {
  content_type: string;
  entries: Array<{ uid: string; locale: Locale }>;
  update: Record<string, unknown>;
};

export type ContentstackApiError = {
  error_code: number;
  error_message: string;
  errors?: Record<string, unknown>;
};
