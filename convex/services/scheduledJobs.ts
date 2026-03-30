import { mutation, query } from "../_generated/server";
import { components } from "../_generated/api";
import { internal } from "../_generated/api";
import { Crons, type CronInfo } from "@convex-dev/crons";
import { v } from "convex/values";

const crons = new Crons(components.crons);

/** List all registered scheduled jobs. */
export const listJobs = query({
  args: {},
  handler: async (ctx): Promise<CronInfo[]> => {
    return await crons.list(ctx);
  },
});

/** Register a new scheduled job. */
export const registerJob = mutation({
  args: {
    name: v.string(),
    operationId: v.string(),
    params: v.any(),
    schedule: v.union(
      v.object({ kind: v.literal("interval"), ms: v.number() }),
      v.object({ kind: v.literal("cron"), cronspec: v.string() }),
    ),
  },
  handler: async (ctx, { name, operationId, params, schedule }): Promise<string> => {
    return await crons.register(
      ctx,
      schedule,
      internal.operations.dispatchScheduledJob.run,
      { operationId, params, jobName: name },
      name,
    );
  },
});

/** Delete a scheduled job by its id. */
export const deleteJob = mutation({
  args: {
    id: v.string(),
  },
  handler: async (ctx, { id }) => {
    return await crons.delete(ctx, { id });
  },
});
