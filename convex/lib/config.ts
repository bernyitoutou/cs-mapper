// Config is read from process.env — in Convex, environment variables are set
// via the Convex dashboard or CLI (`npx convex env set KEY value`).
// Locally they are picked up from .env.local.

import { Branch, Environment } from "./contentstack/types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] ?? undefined;
}

type Config = {
  contentstack: {
    apiKey: string;
    deliveryToken: string;
    managementToken: string;
    environment: Environment;
    branch: Branch;
    deliveryHost: string;
    managementHost: string;
  };
  sphere: {
    host: string;
    apiKey: string;
    pixlHost?: string;
    rendererUrl: string;
    contentTypesIds: Record<string, string>;
  };
  fedid: {
    host: string;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    basic?: string;
  };
}

// Each sub-config uses a getter so env vars are only read when first accessed.
// This allows scripts that only need one sub-config (e.g. fedid) to import this
// file without requiring unrelated env vars to be set.
export const config: Config = {
  get contentstack() {
    return {
      apiKey: requireEnv("CS_STACK_API_KEY"),
      deliveryToken: requireEnv("CS_DELIVERY_TOKEN"),
      managementToken: requireEnv("CS_MANAGEMENT_TOKEN"),
      environment: (requireEnv("CS_ENVIRONMENT") as Environment) ?? Environment.Staging,
      branch: (optional("CS_BRANCH") as Branch) ?? Branch.Dev,
      deliveryHost: requireEnv("CS_DELIVERY_HOST").replace(/\/$/, ""),
      managementHost: requireEnv("CS_MANAGEMENT_HOST").replace(/\/$/, ""),
    };
  },
  get sphere() {
    return {
      host: requireEnv("SPHERE_HOST").replace(/\/$/, ""),
      apiKey: requireEnv("SPHERE_API_KEY"),
      pixlHost: optional("SPHERE_PIXL_HOST")?.replace(/\/$/, ""),
      rendererUrl: requireEnv("SPHERE_RENDERER_URL").replace(/\/$/, ""),
      contentTypesIds: (() => {
        const raw = optional("SPHERE_CONTENT_TYPES_IDS");
        if (!raw) return {} as Record<string, string>;
        return JSON.parse(raw) as Record<string, string>;
      })(),
    };
  },
  get fedid() {
    return {
      host: requireEnv("FEDID_HOST").replace(/\/$/, ""),
      tokenUrl: requireEnv("FEDID_TOKEN_URL"),
      clientId: requireEnv("FEDID_CLIENT_ID"),
      clientSecret: requireEnv("FEDID_CLIENT_SECRET"),
      basic: optional("FEDID_BASIC"),
    };
  },
};
