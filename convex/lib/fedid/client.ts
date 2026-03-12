import { config } from "../config.js";
import type { FedIdApiError, FedIdTokenResponse, SportGroupListResponse } from "./types.js";

export class FedIdError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(`[${status}] FedID error: ${message}`);
    this.name = "FedIdError";
  }
}

/** Build Basic auth value: either the pre-computed FEDID_BASIC or Base64(clientId:clientSecret). */
function basicAuth(): string {
  if (config.fedid.basic) return config.fedid.basic;
  return Buffer.from(`${config.fedid.clientId}:${config.fedid.clientSecret}`).toString("base64");
}

/** Fetch a short-lived OAuth2 Bearer token from FedID using client_credentials flow. */
export async function getAccessToken(): Promise<string> {
  const res = await fetch(config.fedid.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth()}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as FedIdApiError;
      detail = body.error_description ?? body.error ?? detail;
    } catch {
      // not JSON
    }
    throw new FedIdError(res.status, `Token request failed: ${detail}`);
  }

  const data = (await res.json()) as FedIdTokenResponse;
  return data.access_token;
}

/** Perform a GET request against the Referential API using a Bearer token. */
export async function referentialGet<T>(
  path: string,
  token: string,
  searchParams: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${config.fedid.host}${path}`);
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);

  const correlationId = crypto.randomUUID();

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-correlation-id": correlationId,
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as FedIdApiError;
      detail = body.error_description ?? body.error ?? detail;
    } catch {
      // not JSON
    }
    throw new FedIdError(res.status, `Referential API error on ${path}: ${detail}`);
  }

  return res.json() as Promise<T>;
}

/** Fetch all sport groups for a given locale (locale format: "en_GB"). */
export async function fetchAllSportGroups(locale: string): Promise<SportGroupListResponse> {
  const token = await getAccessToken();
  return referentialGet<SportGroupListResponse>(`/api/v1/referentials/${locale}/sport_groups`, token);
}
