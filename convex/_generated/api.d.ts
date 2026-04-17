/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as lib_config from "../lib/config.js";
import type * as lib_contentstack_client from "../lib/contentstack/client.js";
import type * as lib_contentstack_retrieve from "../lib/contentstack/retrieve.js";
import type * as lib_contentstack_types from "../lib/contentstack/types.js";
import type * as lib_contentstack_update from "../lib/contentstack/update.js";
import type * as lib_fedid_client from "../lib/fedid/client.js";
import type * as lib_fedid_mapping from "../lib/fedid/mapping.js";
import type * as lib_fedid_retrieve from "../lib/fedid/retrieve.js";
import type * as lib_fedid_sportGroupLookup from "../lib/fedid/sportGroupLookup.js";
import type * as lib_fedid_types from "../lib/fedid/types.js";
import type * as lib_locales from "../lib/locales.js";
import type * as lib_sphere_blogPostMapper from "../lib/sphere/blogPostMapper.js";
import type * as lib_sphere_client from "../lib/sphere/client.js";
import type * as lib_sphere_retrieve from "../lib/sphere/retrieve.js";
import type * as lib_sphere_types from "../lib/sphere/types.js";
import type * as lib_utils from "../lib/utils.js";
import type * as operations_cleanEntries from "../operations/cleanEntries.js";
import type * as operations_deleteEntries from "../operations/deleteEntries.js";
import type * as operations_dispatchScheduledJob from "../operations/dispatchScheduledJob.js";
import type * as operations_enrichSportCategories from "../operations/enrichSportCategories.js";
import type * as operations_fixLastSphereUpdateFormat from "../operations/fixLastSphereUpdateFormat.js";
import type * as operations_generateMigrationReport from "../operations/generateMigrationReport.js";
import type * as operations_generateObsoleteImageReport from "../operations/generateObsoleteImageReport.js";
import type * as operations_generateSportGroupMapping from "../operations/generateSportGroupMapping.js";
import type * as operations_massFieldUpdate from "../operations/massFieldUpdate.js";
import type * as operations_massImport from "../operations/massImport.js";
import type * as operations_migrateBlogSportCategorySportsField from "../operations/migrateBlogSportCategorySportsField.js";
import type * as operations_seedSportCategories from "../operations/seedSportCategories.js";
import type * as operations_sphereImport from "../operations/sphereImport.js";
import type * as operations_syncUKCategoryTaxonomies from "../operations/syncUKCategoryTaxonomies.js";
import type * as services_logs from "../services/logs.js";
import type * as services_reports from "../services/reports.js";
import type * as services_scheduledJobs from "../services/scheduledJobs.js";
import type * as services_settings from "../services/settings.js";
import type * as services_sportCategories from "../services/sportCategories.js";
import type * as services_sportGroupMappings from "../services/sportGroupMappings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "lib/config": typeof lib_config;
  "lib/contentstack/client": typeof lib_contentstack_client;
  "lib/contentstack/retrieve": typeof lib_contentstack_retrieve;
  "lib/contentstack/types": typeof lib_contentstack_types;
  "lib/contentstack/update": typeof lib_contentstack_update;
  "lib/fedid/client": typeof lib_fedid_client;
  "lib/fedid/mapping": typeof lib_fedid_mapping;
  "lib/fedid/retrieve": typeof lib_fedid_retrieve;
  "lib/fedid/sportGroupLookup": typeof lib_fedid_sportGroupLookup;
  "lib/fedid/types": typeof lib_fedid_types;
  "lib/locales": typeof lib_locales;
  "lib/sphere/blogPostMapper": typeof lib_sphere_blogPostMapper;
  "lib/sphere/client": typeof lib_sphere_client;
  "lib/sphere/retrieve": typeof lib_sphere_retrieve;
  "lib/sphere/types": typeof lib_sphere_types;
  "lib/utils": typeof lib_utils;
  "operations/cleanEntries": typeof operations_cleanEntries;
  "operations/deleteEntries": typeof operations_deleteEntries;
  "operations/dispatchScheduledJob": typeof operations_dispatchScheduledJob;
  "operations/enrichSportCategories": typeof operations_enrichSportCategories;
  "operations/fixLastSphereUpdateFormat": typeof operations_fixLastSphereUpdateFormat;
  "operations/generateMigrationReport": typeof operations_generateMigrationReport;
  "operations/generateObsoleteImageReport": typeof operations_generateObsoleteImageReport;
  "operations/generateSportGroupMapping": typeof operations_generateSportGroupMapping;
  "operations/massFieldUpdate": typeof operations_massFieldUpdate;
  "operations/massImport": typeof operations_massImport;
  "operations/migrateBlogSportCategorySportsField": typeof operations_migrateBlogSportCategorySportsField;
  "operations/seedSportCategories": typeof operations_seedSportCategories;
  "operations/sphereImport": typeof operations_sphereImport;
  "operations/syncUKCategoryTaxonomies": typeof operations_syncUKCategoryTaxonomies;
  "services/logs": typeof services_logs;
  "services/reports": typeof services_reports;
  "services/scheduledJobs": typeof services_scheduledJobs;
  "services/settings": typeof services_settings;
  "services/sportCategories": typeof services_sportCategories;
  "services/sportGroupMappings": typeof services_sportGroupMappings;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  crons: {
    public: {
      del: FunctionReference<
        "mutation",
        "internal",
        { identifier: { id: string } | { name: string } },
        null
      >;
      get: FunctionReference<
        "query",
        "internal",
        { identifier: { id: string } | { name: string } },
        {
          args: Record<string, any>;
          functionHandle: string;
          id: string;
          name?: string;
          schedule:
            | { kind: "interval"; ms: number }
            | { cronspec: string; kind: "cron"; tz?: string };
        } | null
      >;
      list: FunctionReference<
        "query",
        "internal",
        {},
        Array<{
          args: Record<string, any>;
          functionHandle: string;
          id: string;
          name?: string;
          schedule:
            | { kind: "interval"; ms: number }
            | { cronspec: string; kind: "cron"; tz?: string };
        }>
      >;
      register: FunctionReference<
        "mutation",
        "internal",
        {
          args: Record<string, any>;
          functionHandle: string;
          name?: string;
          schedule:
            | { kind: "interval"; ms: number }
            | { cronspec: string; kind: "cron"; tz?: string };
        },
        string
      >;
    };
  };
};
