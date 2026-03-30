"use node";

import { internalAction } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

/**
 * Internal dispatcher invoked by the crons component on each scheduled run.
 * Calls the appropriate public operation action and writes a log entry.
 */
export const run = internalAction({
  args: {
    operationId: v.string(),
    params: v.any(),
    jobName: v.optional(v.string()),
  },
  handler: async (ctx, { operationId, params, jobName }) => {
    const logType = `scheduled:${jobName ?? operationId}`;
    let result: unknown;
    try {
      switch (operationId) {
        case "sphere-import":
          result = await ctx.runAction(api.operations.sphereImport.sphereImport, params);
          break;
        case "generate-migration-report":
          result = await ctx.runAction(api.operations.generateMigrationReport.generateMigrationReport, params);
          break;
        case "generate-sport-group-mapping":
          result = await ctx.runAction(api.operations.generateSportGroupMapping.generateSportGroupMapping, params);
          break;
        case "sync-uk-category-taxonomies":
          result = await ctx.runAction(api.operations.syncUKCategoryTaxonomies.syncUKCategoryTaxonomies, params);
          break;
        case "seed-sport-categories":
          result = await ctx.runAction(api.operations.seedSportCategories.seedSportCategories, {});
          break;
        case "enrich-sport-categories":
          result = await ctx.runAction(api.operations.enrichSportCategories.enrichSportCategories, params);
          break;
        default:
          throw new Error(`Unknown operationId: ${operationId}`);
      }

      await ctx.runMutation(api.services.logs.writelog, {
        type: logType,
        status: "success",
        params,
        result,
      });
    } catch (err) {
      await ctx.runMutation(api.services.logs.writelog, {
        type: logType,
        status: "error",
        params,
        error: String(err),
      });
      throw err;
    }
  },
});
