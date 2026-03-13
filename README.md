# cs-mapper

A ContentStack migration and sync operations dashboard for Decathlon UK. Provides a web UI to trigger backend operations that import, sync, and manage content between **Sphere** (Decathlon's internal content platform), **ContentStack** (the target CMS), and **FedID / Referential API** (Decathlon's sport taxonomy API).

---

## What it does

### Backend (Convex)

The Convex backend exposes a set of **operations** (Node.js actions) that can be triggered from the web UI. Each operation is logged to the `operationLogs` table in real-time.

| Operation | Description |
|---|---|
| `seedSportCategories` | Seeds the `sportCategories` table from the bundled static JSON (`uk-sports-categories.json`) |
| `generateSportGroupMapping` | Resolves FedID sport group IDs → sport IDs and upserts the `sportGroupMappings` table |
| `enrichSportCategories` | Scrapes Sphere sport category pages to extract article IDs and `ddSports` filter IDs |
| `sphereImport` | Main import pipeline: fetches Sphere articles, maps them to CS `blog_post` entries, creates/updates and publishes them |
| `syncUKCategoryTaxonomies` | Assigns `sport_category` taxonomy terms to CS blog posts; creates missing entries from Sphere |
| `generateMigrationReport` | Produces a per-category markdown migration report (coverage rate, synced/missing counts) |
| `checkSyncStatus` | Compares published items between a Sphere content type and a CS content type |
| `massFieldUpdate` | Sets a field to a given value across all entries of a CS content type |
| `massImport` | Bulk-creates CS entries from a payload array, with optional publish |
| `deleteEntries` | Unpublishes then deletes all localized entries of a CS content type |
| `cleanEntries` | Strips CS system fields from raw API payloads |

#### Recommended order for a fresh migration

```
1. seedSportCategories
2. generateSportGroupMapping
3. enrichSportCategories
4. sphereImport
5. syncUKCategoryTaxonomies
6. generateMigrationReport
```

### Web (`web/`)

React + Vite dashboard that connects to the Convex backend in real-time:
- Lists all available operations with configurable parameters
- Shows live operation logs and status
- Displays saved migration reports (rendered Markdown)
- Allows switching the active ContentStack environment and branch

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | [Convex](https://convex.dev) v1.32 |
| Frontend | React 18 + Vite 6 + TypeScript |
| Routing | React Router DOM v7 |
| Styling | Tailwind CSS v4 |
| Package manager | pnpm v10 |

---

## Project structure

```
cs-mapper/
├── convex/               # Convex backend (schema, operations, services, lib)
│   ├── schema.ts         # Database schema
│   ├── lib/              # Config, utils, API clients (CS / Sphere / FedID)
│   ├── operations/       # Triggerable Convex actions
│   └── services/         # Convex queries & mutations
├── web/                  # React + Vite frontend
│   └── src/
│       ├── pages/        # One page per operation + Home
│       └── components/   # Shared UI components
└── scripts/
    └── set-convex-env.mjs  # Helper to push .env vars to Convex
```

---

## Setup & deployment

### Prerequisites

- Node.js ≥ 18
- pnpm v10 (`npm install -g pnpm`)
- A Convex account and project (or local self-hosted instance)

### 1. Install dependencies

```bash
# Root (Convex backend deps)
pnpm install

# Web frontend deps
cd web && pnpm install
```

### 2. Start the Convex backend (local)

```bash
pnpm convex dev
```

On first run, Convex will prompt you with several options — choose **"Run a local Convex backend"**. This starts a fully local Convex backend and automatically generates the `.env.local` file with the correct URLs.

Convex watches the `convex/` folder and syncs changes in real-time.

### 3. Push environment variables to Convex

Once `.env.staging` or `.env.production` is filled in:

```bash
pnpm env:staging       # reads .env.staging  → pushes vars to the local backend
pnpm env:production    # reads .env.production → pushes vars to the local backend
```

This runs `scripts/set-convex-env.mjs` which calls `npx convex env set` for each variable.

### 4. Start the web frontend

```bash
cd web
pnpm dev
# → http://localhost:5173
```

---

## Environment variables reference

All backend variables are read by `convex/lib/config.ts` at runtime. Push them to Convex via the CLI (see above) or the Convex dashboard.

### ContentStack

| Variable | Description |
|---|---|
| `CS_STACK_API_KEY` | ContentStack stack API key |
| `CS_DELIVERY_TOKEN` | Read-only Delivery API token |
| `CS_MANAGEMENT_TOKEN` | Read/write Management API token |
| `CS_ENVIRONMENT` | Target CS environment (`staging` or `production`) |
| `CS_BRANCH` | CS branch (`main`, `dev`, …) |
| `CS_DELIVERY_HOST` | Delivery API base URL |
| `CS_MANAGEMENT_HOST` | Management API base URL |

### Sphere

| Variable | Description |
|---|---|
| `SPHERE_HOST` | Sphere API base URL |
| `SPHERE_API_KEY` | Sphere API key |
| `SPHERE_RENDERER_URL` | Sphere HTML renderer URL (used to extract article IDs) |
| `SPHERE_PIXL_HOST` | *(optional)* Pixl image service host |
| `SPHERE_CONTENT_TYPES_IDS` | *(optional)* JSON object mapping content type names → UUIDs |

### FedID / Referential API

| Variable | Description |
|---|---|
| `FEDID_HOST` | Referential API base URL |
| `FEDID_TOKEN_URL` | OAuth token endpoint |
| `FEDID_CLIENT_ID` | OAuth client ID |
| `FEDID_CLIENT_SECRET` | OAuth client secret |
| `FEDID_BASIC` | *(optional)* Pre-built Basic auth header (alternative to client credentials flow) |

---

### `.env.staging` example

```dotenv
# ContentStack — staging
CS_DELIVERY_HOST="https://your-cs-delivery-host.com"
CS_MANAGEMENT_HOST="https://your-cs-management-host.com"
CS_STACK_API_KEY=your_stack_api_key
CS_DELIVERY_TOKEN=your_delivery_token
CS_MANAGEMENT_TOKEN=your_management_token
CS_ENVIRONMENT=staging
CS_BRANCH=dev

# Sphere
SPHERE_HOST="https://your-sphere-api-host.com/cms"
SPHERE_API_KEY="your-sphere-api-key"
SPHERE_PIXL_HOST="https://your-pixl-host.com"
SPHERE_RENDERER_URL=https://your-sphere-renderer.com
SPHERE_CONTENT_TYPES_IDS="{\"how_to_chose\": \"your-content-type-uuid\"}"

# FedID
FEDID_TOKEN_URL=https://your-fedid-preprod-host.com/as/token.oauth2
FEDID_HOST=https://your-referential-staging-host.com
FEDID_CLIENT_ID=your_client_id
FEDID_CLIENT_SECRET=your_client_secret
```

### `.env.production` example

```dotenv
# ContentStack — production
CS_DELIVERY_HOST="https://your-cs-delivery-host.com"
CS_MANAGEMENT_HOST="https://your-cs-management-host.com"
CS_STACK_API_KEY=your_stack_api_key
CS_DELIVERY_TOKEN=your_delivery_token
CS_MANAGEMENT_TOKEN=your_management_token
CS_ENVIRONMENT=production
CS_BRANCH=main

# Sphere
SPHERE_HOST="https://your-sphere-api-host.com/cms"
SPHERE_API_KEY="your-sphere-api-key"
SPHERE_PIXL_HOST="https://your-pixl-host.com"
SPHERE_RENDERER_URL=https://your-sphere-renderer.com
SPHERE_CONTENT_TYPES_IDS="{\"how_to_chose\": \"your-content-type-uuid\"}"

# FedID
FEDID_TOKEN_URL=https://your-fedid-prod-host.com/as/token.oauth2
FEDID_HOST=https://your-referential-prod-host.com
FEDID_CLIENT_ID=your_client_id
FEDID_CLIENT_SECRET=your_client_secret
```

---

## Database schema (Convex tables)

| Table | Purpose |
|---|---|
| `operationLogs` | Audit log of every operation run (type, status, params, result, timestamps) |
| `reports` | Saved markdown migration reports |
| `appSettings` | Key/value store for `csEnvironment` and `csBranch` |
| `sportCategories` | UK sport categories seeded from JSON, enriched with Sphere article IDs and ddSports IDs |
| `sportGroupMappings` | FedID sport group → CS entry + sport IDs mapping (drives Sphere import filters) |
