import { query } from "../_generated/server";
import { Branch, Environment } from "../lib/contentstack/types.js";

/** Returns the CS environment and branch as configured via env vars. */
export const getSettings = query({
  args: {},
  handler: async () => {
    return {
      csEnvironment: (process.env.CS_ENVIRONMENT ?? Environment.Staging) as Environment,
      csBranch: (process.env.CS_BRANCH ?? Branch.Dev) as Branch,
    };
  },
});
