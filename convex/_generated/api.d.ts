/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as contentstack from "../contentstack.js";
import type * as lib_config from "../lib/config.js";
import type * as lib_contentstack_client from "../lib/contentstack/client.js";
import type * as lib_contentstack_retrieve from "../lib/contentstack/retrieve.js";
import type * as lib_contentstack_types from "../lib/contentstack/types.js";
import type * as lib_contentstack_update from "../lib/contentstack/update.js";
import type * as lib_sphere_client from "../lib/sphere/client.js";
import type * as lib_sphere_retrieve from "../lib/sphere/retrieve.js";
import type * as lib_sphere_types from "../lib/sphere/types.js";
import type * as sphere from "../sphere.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  contentstack: typeof contentstack;
  "lib/config": typeof lib_config;
  "lib/contentstack/client": typeof lib_contentstack_client;
  "lib/contentstack/retrieve": typeof lib_contentstack_retrieve;
  "lib/contentstack/types": typeof lib_contentstack_types;
  "lib/contentstack/update": typeof lib_contentstack_update;
  "lib/sphere/client": typeof lib_sphere_client;
  "lib/sphere/retrieve": typeof lib_sphere_retrieve;
  "lib/sphere/types": typeof lib_sphere_types;
  sphere: typeof sphere;
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

export declare const components: {};
