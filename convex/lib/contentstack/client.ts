import { config } from "../config.js";
import type { ContentstackApiError } from "./types.js";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ContentstackError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: number,
    message: string,
    public readonly errors?: Record<string, unknown>
  ) {
    super(`[${status}] CS error ${code}: ${message}`);
    this.name = "ContentstackError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: ContentstackApiError | null = null;
    try {
      body = (await response.json()) as ContentstackApiError;
    } catch {
      // not JSON
    }
    throw new ContentstackError(
      response.status,
      body?.error_code ?? response.status,
      body?.error_message ?? response.statusText,
      body?.errors
    );
  }
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Delivery API — read published content
// ---------------------------------------------------------------------------

export async function deliveryGet<T>(
  path: string,
  searchParams: Record<string, string> = {}
): Promise<T> {
  const { host, apiKey, deliveryToken, branch } = config.contentstack;
  const url = new URL(`${host}/v3${path}`);
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      api_key: apiKey,
      access_token: deliveryToken,
      branch,
    },
  });
  return handleResponse<T>(res);
}

// ---------------------------------------------------------------------------
// Management API — read all content + write
// ---------------------------------------------------------------------------

export async function managementGet<T>(
  path: string,
  searchParams: Record<string, string> = {}
): Promise<T> {
  const { host, apiKey, managementToken, branch } = config.contentstack;
  const url = new URL(`${host}/v3${path}`);
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      api_key: apiKey,
      authorization: managementToken,
      branch,
    },
  });
  return handleResponse<T>(res);
}

export async function managementPut<T>(path: string, body: unknown): Promise<T> {
  const { host, apiKey, managementToken, branch } = config.contentstack;
  const url = new URL(`${host}/v3${path}`);

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      api_key: apiKey,
      authorization: managementToken,
      branch,
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function managementPost<T>(
  path: string,
  body: unknown,
  searchParams: Record<string, string> = {}
): Promise<T> {
  const { host, apiKey, managementToken, branch } = config.contentstack;
  const url = new URL(`${host}/v3${path}`);
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      api_key: apiKey,
      authorization: managementToken,
      branch,
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function managementDelete<T>(path: string): Promise<T> {
  const { host, apiKey, managementToken, branch } = config.contentstack;
  const url = new URL(`${host}/v3${path}`);

  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      api_key: apiKey,
      authorization: managementToken,
      branch,
    },
  });
  return handleResponse<T>(res);
}
