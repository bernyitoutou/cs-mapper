# Referential API - Technical Specification

## Table of Contents
1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [API Endpoints](#api-endpoints)
4. [Data Models](#data-models)
5. [Implementation Guide (Node.js/TypeScript)](#implementation-guide-nodejstypescript)
6. [Error Handling](#error-handling)
7. [Rate Limiting & Best Practices](#rate-limiting--best-practices)

---

## Overview

### What is the Referential API?

The **Referential API** is a XMerch service that provides Decathlon's reference data including:
- **Sport Groups**: Collections of related sports (e.g., "Racket Sports" includes Tennis, Badminton, Squash)
- **Brands**: Decathlon brand catalog

This API is used by the Content Mapper to resolve sport group IDs into individual sport IDs for querying the Sphere CMS.

### Base URLs

| Environment | Base URL |
|-------------|----------|
| **Staging** | `https://api-global.preprod.decathlon.net/referentials` |
| **Production** | `https://api-global.decathlon.net/referentials` |

### API Version
`v1`

---

## Authentication Flow

The Referential API requires **OAuth2 Bearer Token authentication** via Decathlon's FedID service.

### Two-Step Authentication

```mermaid
sequenceDiagram
    participant Client
    participant FedID as FedID OAuth2 Server
    participant RefAPI as Referential API
    
    Client->>FedID: 1. POST /as/token.oauth2
    Note over Client,FedID: client_id + client_secret<br/>(Basic Auth)
    FedID-->>Client: 2. access_token (JWT)
    
    Client->>RefAPI: 3. GET /sport_groups
    Note over Client,RefAPI: Authorization: Bearer <token>
    RefAPI-->>Client: 4. Sport Groups Data
```

### Step 1: Get Access Token from FedID

**Endpoint:**
```
POST https://preprod.idpdecathlon.oxylane.com/as/token.oauth2
```

**Headers:**
```http
Content-Type: application/x-www-form-urlencoded
Authorization: Basic <Base64(client_id:client_secret)>
```

**Body (x-www-form-urlencoded):**
```
grant_type=client_credentials
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Step 2: Use Token with Referential API

**Headers:**
```http
Authorization: Bearer <access_token>
x-correlation-id: <uuid>
```

---

## API Endpoints

### 1. Get Sport Groups Referential

Retrieves all sport groups with their associated sports.

**Endpoint:**
```
GET /api/v1/referentials/{locale}/sport_groups
```

**Path Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `locale` | string | ✅ | Locale code (format: `xx_XX`) | `en_GB`, `fr_FR` |

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `since` | string | ❌ | ISO 8601 date to filter updated items (gte) | `2024-01-15T00:00:00Z` |

**Headers:**

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Authorization` | string | ✅ | Bearer token from FedID |
| `x-correlation-id` | string (UUID) | ✅ | Request tracing ID |

**Example Request:**
```bash
curl -X GET \
  'https://api-global.preprod.decathlon.net/referentials/api/v1/referentials/en_GB/sport_groups' \
  -H 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'x-correlation-id: 550e8400-e29b-41d4-a716-446655440000'
```

**Success Response (200 OK):**
```json
{
  "items": [
    {
      "id": "14",
      "name": "Tennis Group",
      "locale": "en_GB",
      "type": "generic",
      "sports": ["260", "277", "278", "280"],
      "status": "active",
      "updatedAt": "2024-02-05T17:32:28.593Z"
    },
    {
      "id": "42",
      "name": "Football Group",
      "locale": "en_GB",
      "type": "generic",
      "sports": ["468", "462", "552"],
      "status": "active",
      "updatedAt": "2024-01-20T10:15:00.000Z"
    }
  ]
}
```

**Error Responses:**

| Status Code | Description | Response Body |
|-------------|-------------|---------------|
| `400` | Bad Request (invalid locale format) | `{"error": "Bad Request", "error_code": "400", "error_description": "..."}` |
| `401` | Unauthorized (invalid or expired token) | `{"error": "Unauthorized"}` |
| `500` | Internal Server Error | `{"error": "Internal Server Error", ...}` |

---

### 2. Get Brands Referential

Retrieves all Decathlon brands.

**Endpoint:**
```
GET /api/v1/referentials/{locale}/brands
```

**Parameters:** Same as Sport Groups endpoint

**Example Response:**
```json
{
  "items": [
    {
      "id": "1",
      "name": "Domyos",
      "locale": "en_GB",
      "status": "active",
      "updatedAt": "2024-01-10T08:30:00.000Z"
    },
    {
      "id": "2",
      "name": "Quechua",
      "locale": "en_GB",
      "status": "active",
      "updatedAt": "2024-01-12T14:20:00.000Z"
    }
  ]
}
```

---

## Data Models

### SportGroup

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique sport group identifier | `"14"` |
| `name` | string | Human-readable name | `"Tennis Group"` |
| `locale` | string | Locale code | `"en_GB"` |
| `type` | string | Sport group type | `"generic"` |
| `sports` | string[] | Array of sport IDs in this group | `["260", "277", "278"]` |
| `status` | enum | Status of the referential item | `"active"` |
| `updatedAt` | string (ISO 8601) | Last update timestamp | `"2024-02-05T17:32:28.593Z"` |

### ReferentialStatus (Enum)

| Value | Description |
|-------|-------------|
| `active` | Currently active and valid |
| `deprecated` | Deprecated but still usable |
| `deactivated` | No longer active |
| `deleted` | Marked as deleted |

### Brand

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique brand identifier | `"1"` |
| `name` | string | Brand name | `"Domyos"` |
| `locale` | string | Locale code | `"en_GB"` |
| `status` | enum | Status of the referential item | `"active"` |
| `updatedAt` | string (ISO 8601) | Last update timestamp | `"2024-01-10T08:30:00.000Z"` |

### Error Response

| Field | Type | Description |
|-------|------|-------------|
| `error` | string | Error name |
| `error_code` | string | HTTP status code |
| `error_description` | string | Detailed error message |
| `error_link` | string | (optional) Link to documentation |

---

## Implementation Guide (Node.js/TypeScript)

### Prerequisites

```bash
npm install axios
npm install --save-dev @types/node
```

### 1. TypeScript Type Definitions

```typescript
// types.ts

export enum ReferentialStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  DEACTIVATED = 'deactivated',
  DELETED = 'deleted'
}

export interface SportGroup {
  id: string;
  name: string;
  locale: string;
  type: string;
  sports: string[];
  status: ReferentialStatus;
  updatedAt: string;
}

export interface SportGroupsResponse {
  items: SportGroup[];
}

export interface Brand {
  id: string;
  name: string;
  locale: string;
  status: ReferentialStatus;
  updatedAt: string;
}

export interface BrandsResponse {
  items: Brand[];
}

export interface FedIDTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ErrorResponse {
  error: string;
  error_code: string;
  error_description: string;
  error_link?: string;
}
```

### 2. FedID Authentication Client

```typescript
// fedid-client.ts
import axios, { AxiosInstance } from 'axios';
import { FedIDTokenResponse } from './types';

export class FedIDClient {
  private axiosInstance: AxiosInstance;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    private readonly tokenHost: string,
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {
    this.axiosInstance = axios.create({
      baseURL: tokenHost,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  /**
   * Get a valid access token (returns cached token if still valid)
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedToken;
    }

    // Request new token
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString('base64');

    const response = await this.axiosInstance.post<FedIDTokenResponse>(
      '/as/token.oauth2',
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    this.cachedToken = response.data.access_token;
    this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;

    return this.cachedToken;
  }

  /**
   * Clear cached token (e.g., on 401 errors)
   */
  clearToken(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }
}
```

### 3. Referential API Client

```typescript
// referential-client.ts
import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { FedIDClient } from './fedid-client';
import { SportGroupsResponse, BrandsResponse } from './types';

export class ReferentialClient {
  private axiosInstance: AxiosInstance;

  constructor(
    private readonly baseUrl: string,
    private readonly fedIDClient: FedIDClient
  ) {
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
    });

    // Interceptor to inject Bearer token
    this.axiosInstance.interceptors.request.use(async (config) => {
      const token = await this.fedIDClient.getAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      config.headers['x-correlation-id'] = uuidv4();
      return config;
    });

    // Interceptor to handle 401 and retry with new token
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          this.fedIDClient.clearToken();
          const token = await this.fedIDClient.getAccessToken();
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return this.axiosInstance(originalRequest);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Get all sport groups for a given locale
   */
  async getSportGroups(
    locale: string,
    since?: Date
  ): Promise<SportGroupsResponse> {
    const params: Record<string, string> = {};
    if (since) {
      params.since = since.toISOString();
    }

    const response = await this.axiosInstance.get<SportGroupsResponse>(
      `/api/v1/referentials/${locale}/sport_groups`,
      { params }
    );

    return response.data;
  }

  /**
   * Get all brands for a given locale
   */
  async getBrands(locale: string, since?: Date): Promise<BrandsResponse> {
    const params: Record<string, string> = {};
    if (since) {
      params.since = since.toISOString();
    }

    const response = await this.axiosInstance.get<BrandsResponse>(
      `/api/v1/referentials/${locale}/brands`,
      { params }
    );

    return response.data;
  }
}
```

### 4. Usage Example

```typescript
// example.ts
import { FedIDClient } from './fedid-client';
import { ReferentialClient } from './referential-client';

// Configuration
const config = {
  fedid: {
    tokenHost: 'https://preprod.idpdecathlon.oxylane.com',
    clientId: process.env.FEDID_CLIENT_ID!,
    clientSecret: process.env.FEDID_CLIENT_SECRET!,
  },
  referential: {
    baseUrl: 'https://api-global.preprod.decathlon.net/referentials',
  },
};

// Initialize clients
const fedIDClient = new FedIDClient(
  config.fedid.tokenHost,
  config.fedid.clientId,
  config.fedid.clientSecret
);

const referentialClient = new ReferentialClient(
  config.referential.baseUrl,
  fedIDClient
);

// Usage
async function main() {
  try {
    // Get sport groups for locale en_GB
    const sportGroups = await referentialClient.getSportGroups('en_GB');
    console.log('Sport Groups:', sportGroups.items);

    // Get only active sport groups
    const activeSportGroups = sportGroups.items.filter(
      (sg) => sg.status === 'active'
    );

    // Build a lookup map: sportGroupId -> sportIds
    const sportGroupMap = new Map<string, string[]>();
    activeSportGroups.forEach((sg) => {
      sportGroupMap.set(sg.id, sg.sports);
    });

    // Example: Resolve sport group ID to sport IDs
    const sportGroupId = '14';
    const sportIds = sportGroupMap.get(sportGroupId) || [];
    console.log(`Sport Group ${sportGroupId} contains sports:`, sportIds);

    // Get brands
    const brands = await referentialClient.getBrands('en_GB');
    console.log('Brands:', brands.items);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

### 5. Sport Group Cache Service (like Java implementation)

```typescript
// sport-group-cache.ts
import { ReferentialClient } from './referential-client';
import { SportGroup } from './types';

export class SportGroupCache {
  private cache: Map<string, string[]> = new Map();
  private loaded = false;

  constructor(private readonly client: ReferentialClient) {}

  /**
   * Get sport IDs for a sport group ID
   * Loads all sport groups on first call and caches them
   */
  async getSportIds(sportGroupId: string): Promise<string[]> {
    if (!this.loaded) {
      await this.loadSportGroups();
    }

    return this.cache.get(sportGroupId) || [];
  }

  /**
   * Load all sport groups from API
   * Uses en_GB locale by default (same as Java implementation)
   */
  private async loadSportGroups(): Promise<void> {
    const DEFAULT_LOCALE = 'en_GB';

    try {
      const response = await this.client.getSportGroups(DEFAULT_LOCALE);

      response.items
        .filter((sg) => sg.status === 'active')
        .forEach((sg) => {
          this.cache.set(sg.id, sg.sports);
        });

      this.loaded = true;
      console.log(`Loaded ${this.cache.size} sport groups into cache`);
    } catch (error) {
      console.error('Failed to load sport groups:', error);
      throw error;
    }
  }

  /**
   * Clear the cache (useful for testing or forced refresh)
   */
  clear(): void {
    this.cache.clear();
    this.loaded = false;
  }
}
```

### 6. Complete Example with Cache

```typescript
// main.ts
import { FedIDClient } from './fedid-client';
import { ReferentialClient } from './referential-client';
import { SportGroupCache } from './sport-group-cache';

async function main() {
  // Initialize
  const fedIDClient = new FedIDClient(
    process.env.FEDID_TOKEN_HOST!,
    process.env.FEDID_CLIENT_ID!,
    process.env.FEDID_CLIENT_SECRET!
  );

  const referentialClient = new ReferentialClient(
    process.env.REFERENTIAL_BASE_URL!,
    fedIDClient
  );

  const sportGroupCache = new SportGroupCache(referentialClient);

  // Use case: Resolve sport group to individual sports
  const sportGroupId = '14'; // Tennis Group
  const sportIds = await sportGroupCache.getSportIds(sportGroupId);
  
  console.log(`Sport Group ${sportGroupId} resolves to sports:`, sportIds);
  // Output: Sport Group 14 resolves to sports: ["260", "277", "278", "280"]

  // Subsequent calls use cached data (no API call)
  const sportIds2 = await sportGroupCache.getSportIds('42');
  console.log(`Sport Group 42 resolves to sports:`, sportIds2);
}

main();
```

---

## Error Handling

### Common Error Scenarios

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| Invalid locale format | 400 | Locale not matching `^[a-z]{2}_[A-Z]{2}$` | Use format like `en_GB`, not `en-GB` |
| Unauthorized | 401 | Invalid/expired token | Refresh token from FedID |
| Missing correlation ID | 400 | No `x-correlation-id` header | Always include UUID in header |
| Rate limit exceeded | 429 | Too many requests | Implement exponential backoff |
| Internal server error | 500 | API issue | Retry with exponential backoff |

### Error Handling Example

```typescript
import { AxiosError } from 'axios';
import { ErrorResponse } from './types';

async function getSportGroupsWithRetry(
  client: ReferentialClient,
  locale: string,
  maxRetries = 3
) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await client.getSportGroups(locale);
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;

      if (axiosError.response) {
        const status = axiosError.response.status;
        const errorData = axiosError.response.data;

        console.error(
          `API Error [${status}]: ${errorData.error_description}`
        );

        // Don't retry on 4xx errors (except 429)
        if (status >= 400 && status < 500 && status !== 429) {
          throw error;
        }

        // Retry on 5xx or 429 with exponential backoff
        if (status >= 500 || status === 429) {
          attempt++;
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`Retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      throw error;
    }
  }

  throw new Error(`Failed after ${maxRetries} retries`);
}
```

---

## Rate Limiting & Best Practices

### Caching Strategy

**✅ DO:**
- Cache sport groups in memory (they change infrequently)
- Use the `since` parameter for incremental updates
- Implement a TTL for cache refresh (e.g., 1 hour)

**❌ DON'T:**
- Query the API for every sport group resolution
- Make parallel requests for the same data

### Example Cache with TTL

```typescript
export class SportGroupCacheWithTTL {
  private cache: Map<string, string[]> = new Map();
  private lastLoadedAt: number = 0;
  private readonly TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(private readonly client: ReferentialClient) {}

  async getSportIds(sportGroupId: string): Promise<string[]> {
    // Refresh cache if expired
    if (Date.now() - this.lastLoadedAt > this.TTL_MS) {
      await this.loadSportGroups();
    }

    return this.cache.get(sportGroupId) || [];
  }

  private async loadSportGroups(): Promise<void> {
    const lastUpdate = this.lastLoadedAt > 0 
      ? new Date(this.lastLoadedAt) 
      : undefined;

    const response = await this.client.getSportGroups('en_GB', lastUpdate);

    response.items
      .filter((sg) => sg.status === 'active')
      .forEach((sg) => {
        this.cache.set(sg.id, sg.sports);
      });

    this.lastLoadedAt = Date.now();
  }
}
```

### Performance Tips

1. **Batch Requests**: There's no batch endpoint, but you can parallelize requests for different locales
   ```typescript
   const locales = ['en_GB', 'fr_FR', 'de_DE'];
   const results = await Promise.all(
     locales.map((locale) => client.getSportGroups(locale))
   );
   ```

2. **Connection Pooling**: Use `keepAlive` in your HTTP client
   ```typescript
   import http from 'http';
   import https from 'https';
   
   const httpAgent = new http.Agent({ keepAlive: true });
   const httpsAgent = new https.Agent({ keepAlive: true });
   
   const axiosInstance = axios.create({
     httpAgent,
     httpsAgent,
   });
   ```

3. **Request Timeout**: Always set reasonable timeouts
   ```typescript
   const response = await axiosInstance.get(url, {
     timeout: 5000, // 5 seconds
   });
   ```

---

## Configuration Management

### Environment Variables

```bash
# .env
FEDID_TOKEN_HOST=https://preprod.idpdecathlon.oxylane.com
FEDID_CLIENT_ID=your-client-id
FEDID_CLIENT_SECRET=your-client-secret
REFERENTIAL_BASE_URL=https://api-global.preprod.decathlon.net/referentials
```

### Configuration Type

```typescript
// config.ts
export interface Config {
  fedid: {
    tokenHost: string;
    clientId: string;
    clientSecret: string;
  };
  referential: {
    baseUrl: string;
  };
}

export function loadConfig(): Config {
  const requiredEnvVars = [
    'FEDID_TOKEN_HOST',
    'FEDID_CLIENT_ID',
    'FEDID_CLIENT_SECRET',
    'REFERENTIAL_BASE_URL',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    fedid: {
      tokenHost: process.env.FEDID_TOKEN_HOST!,
      clientId: process.env.FEDID_CLIENT_ID!,
      clientSecret: process.env.FEDID_CLIENT_SECRET!,
    },
    referential: {
      baseUrl: process.env.REFERENTIAL_BASE_URL!,
    },
  };
}
```

---

## Testing

### Mock Server for Testing

```typescript
// __tests__/mock-server.ts
import nock from 'nock';

export function mockFedIDServer(token = 'mock-token') {
  nock('https://preprod.idpdecathlon.oxylane.com')
    .post('/as/token.oauth2')
    .reply(200, {
      access_token: token,
      token_type: 'Bearer',
      expires_in: 3600,
    });
}

export function mockReferentialServer() {
  nock('https://api-global.preprod.decathlon.net')
    .get('/referentials/api/v1/referentials/en_GB/sport_groups')
    .reply(200, {
      items: [
        {
          id: '14',
          name: 'Tennis Group',
          locale: 'en_GB',
          type: 'generic',
          sports: ['260', '277', '278'],
          status: 'active',
          updatedAt: '2024-02-05T17:32:28.593Z',
        },
      ],
    });
}
```

### Unit Test Example

```typescript
// __tests__/sport-group-cache.test.ts
import { SportGroupCache } from '../sport-group-cache';
import { mockFedIDServer, mockReferentialServer } from './mock-server';

describe('SportGroupCache', () => {
  beforeEach(() => {
    mockFedIDServer();
    mockReferentialServer();
  });

  it('should resolve sport group ID to sport IDs', async () => {
    const cache = new SportGroupCache(/* ... */);
    
    const sportIds = await cache.getSportIds('14');
    
    expect(sportIds).toEqual(['260', '277', '278']);
  });

  it('should return empty array for unknown sport group', async () => {
    const cache = new SportGroupCache(/* ... */);
    
    const sportIds = await cache.getSportIds('999');
    
    expect(sportIds).toEqual([]);
  });
});
```

---

## Appendix

### OpenAPI Specification

The full OpenAPI specification is available at:
```
common/referential-api-client/src/main/resources/openapi.yaml
```

### Useful Links

- **Swagger UI (Staging)**: `https://api-global.preprod.decathlon.net/referentials/swagger-ui.html` (if available)
- **XMerch Team**: https://github.com/orgs/dktunited/teams/xmerch

### Credentials Access

Contact your team lead or Decathlon Identity team to obtain:
- FedID OAuth2 Client ID
- FedID OAuth2 Client Secret

These credentials are environment-specific (staging vs production).

---

**Version:** 1.0  
**Last Updated:** March 12, 2026  
**Maintainer:** SEO Backend Team
