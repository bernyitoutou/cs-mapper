import { config } from "../config.js";
import type { SphereApiError } from "./types.js";

export class SphereError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string | number
  ) {
    super(`[${status}] Sphere error: ${message}`);
    this.name = "SphereError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: SphereApiError | null = null;
    try {
      body = (await response.json()) as SphereApiError;
    } catch {
      // not JSON
    }
    throw new SphereError(response.status, body?.message ?? response.statusText, body?.code);
  }
  return response.json() as Promise<T>;
}

function baseHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": config.sphere.apiKey,
  };
}

export async function sphereGet<T>(
  path: string,
  searchParams: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${config.sphere.host}${path}`);
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { method: "GET", headers: baseHeaders() });
  return handleResponse<T>(res);
}

export async function spherePost<T>(path: string, body: unknown): Promise<T> {
  const url = new URL(`${config.sphere.host}${path}`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function spherePut<T>(path: string, body: unknown): Promise<T> {
  const url = new URL(`${config.sphere.host}${path}`);
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: baseHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}
