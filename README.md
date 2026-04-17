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
| `migrateBlogSportCategorySportsField` | Backfills `blog_sport_category.sports[]` from legacy `sport_ddfs_id` and `is_sport_group`, with optional legacy-field cleanup |
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
- **Schedules** page: create, view, and delete cron-scheduled operations with last-run status

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | [Convex](https://convex.dev) v1.32 (self-hosted via Docker) |
| Cron scheduling | `@convex-dev/crons` component |
| Frontend | React 18 + Vite 6 + TypeScript |
| Routing | React Router DOM v7 |
| Styling | Tailwind CSS v4 |
| Package manager | pnpm v10 |
| Container runtime | Docker (Rancher Desktop or Docker Desktop) |

---

## Project structure

```
cs-mapper/
├── convex/               # Convex backend (schema, operations, services, lib)
│   ├── schema.ts         # Database schema
│   ├── convex.config.ts  # Registers @convex-dev/crons component
│   ├── lib/              # Config, utils, API clients (CS / Sphere / FedID)
│   ├── operations/       # Triggerable Convex actions
│   └── services/         # Convex queries & mutations (including scheduledJobs)
├── web/                  # React + Vite frontend
│   ├── Dockerfile        # Two-stage build: node builder → nginx runner
│   └── src/
│       ├── pages/        # One page per operation + Home + Schedules
│       └── components/   # Shared UI components
├── docker-compose.yml    # backend + dashboard + ui services
├── .dockerignore
└── scripts/
    └── set-convex-env.mjs  # Helper to push .env vars to Convex
```

---

## Setup & deployment

There are two ways to run the stack: **Docker (recommended for production-like environments)** or **local dev mode** (faster iteration).

---

### Option A — Docker (self-hosted, all services)

#### Prerequisites

- [Rancher Desktop](https://rancherdesktop.io/) or Docker Desktop
- pnpm v10 (`npm install -g pnpm`)
- Node.js ≥ 18 (for deploying Convex functions)

#### 1. Install root dependencies

```bash
pnpm install
```

#### 2. Start the containers

```bash
pnpm backend:up
# Starts: backend (port 3210), dashboard (port 6791), ui (port 5173)
```

Wait ~10 seconds for the backend to be healthy, then check:

```
http://localhost:6791   → Convex dashboard
http://localhost:5173   → cs-mapper UI
```

#### 3. Generate the admin key (first run only)

```bash
pnpm backend:admin-key
# Prints something like: convex-self-hosted|...
```

#### 4. Create `.env.local` at the project root

```dotenv
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='<paste the key from step 3>'
```

> If a `CONVEX_DEPLOYMENT` line exists from a previous cloud project, remove it.

#### 5. Push your environment variables to the backend

Fill in `.env.staging` or `.env.production` with your CS / Sphere / FedID credentials (see [Environment variables reference](#environment-variables-reference)), then:

```bash
pnpm env:staging       # or pnpm env:production
```

#### 6. Deploy the Convex functions

```bash
pnpm deploy
# Compiles and pushes all convex/ functions to the self-hosted backend
```

The UI at `http://localhost:5173` is now fully operational.

#### Rebuilding the UI after code changes

```bash
pnpm ui:build          # rebuilds the web/Dockerfile image
pnpm backend:up        # restarts containers with the new image
```

#### Useful commands

```bash
pnpm backend:logs      # tail backend container logs
pnpm backend:down      # stop all containers (data is preserved in convex-data volume)
docker compose down -v # stop containers AND wipe all data (full reset)
```

---

### Option B — Local dev mode

#### Prerequisites

- Node.js ≥ 18
- pnpm v10 (`npm install -g pnpm`)

#### 1. Install dependencies

```bash
pnpm install           # root (Convex backend deps)
cd web && pnpm install # web frontend deps
```

#### 2. Start the Convex backend

```bash
pnpm convex:dev
```

On first run, choose **"Run a local Convex backend"**. Convex creates `.env.local` automatically and watches `convex/` for changes in real-time.

#### 3. Push environment variables

```bash
pnpm env:staging       # reads .env.staging  → pushes vars to the local backend
pnpm env:production    # reads .env.production → pushes vars to the local backend
```

#### 4. Start the web frontend

```bash
pnpm ui:dev
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
