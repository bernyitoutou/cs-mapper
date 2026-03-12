// Config is read from process.env — in Convex, environment variables are set
// via the Convex dashboard or CLI (`npx convex env set KEY value`).
// Locally they are picked up from .env.local.

function require(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] ?? undefined;
}

export const config = {
  contentstack: {
    apiKey: require("CS_STACK_API_KEY"),
    deliveryToken: require("CS_DELIVERY_TOKEN"),
    managementToken: require("CS_MANAGEMENT_TOKEN"),
    environment: require("CS_ENVIRONMENT"),
    branch: optional("CS_BRANCH") ?? "main",
    deliveryHost: require("CS_DELIVERY_HOST").replace(/\/$/, ""),
    managementHost: require("CS_MANAGEMENT_HOST").replace(/\/$/, ""),
  },
  sphere: {
    host: require("SPHERE_HOST").replace(/\/$/, ""),
    apiKey: require("SPHERE_API_KEY"),
    pixlHost: optional("SPHERE_PIXL_HOST")?.replace(/\/$/, ""),
    contentTypesIds: (() => {
      const raw = optional("SPHERE_CONTENT_TYPES_IDS");
      if (!raw) return {} as Record<string, string>;
      return JSON.parse(raw) as Record<string, string>;
    })(),
  },
};
