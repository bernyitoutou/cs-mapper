#!/usr/bin/env node
// scripts/set-convex-env.mjs
// Usage: node scripts/set-convex-env.mjs staging|production

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";

const env = process.argv[2];
if (!env || !["staging", "production"].includes(env)) {
  console.error("Usage: pnpm env:staging  or  pnpm env:production");
  process.exit(1);
}

const envFile = resolve(process.cwd(), `.env.${env}`);
let raw;
try {
  raw = readFileSync(envFile, "utf8");
} catch {
  console.error(`Cannot read ${envFile}`);
  process.exit(1);
}

const vars = [];
for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  // Skip comments and empty lines
  if (!trimmed || trimmed.startsWith("#")) continue;

  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;

  const key = trimmed.slice(0, eqIdx).trim();
  // Strip surrounding quotes from the value
  let value = trimmed.slice(eqIdx + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  vars.push({ key, value });
}

console.log(`\nPushing ${vars.length} variables to Convex (${env})…\n`);

for (const { key, value } of vars) {
  try {
    execSync(`npx convex env set ${key} ${JSON.stringify(value)}`, {
      stdio: "inherit",
    });
  } catch (err) {
    console.error(`Failed to set ${key}:`, err.message);
    process.exit(1);
  }
}

console.log(`\nDone! Convex is now configured for ${env}.\n`);
