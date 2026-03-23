export type SphereTeaserImage = {
  media_id: string;
  security_key: string;
  alt_title?: string;
  type?: string;
  [key: string]: unknown;
};

export type SphereContent = {
  id: string;
  title: string;
  content_type?: string;
  status?: number;
  locale?: string;
  model_codes?: string[];
  dd_sports?: number[];
  summary?: string;
  meta_description?: string;
  teaser_image?: SphereTeaserImage;
  updated_at?: string;
  url?: string;
  [key: string]: unknown;
};

/** Hydra collection response returned by GET /contents */
export type SphereListResponse = {
  "hydra:totalItems": number;
  "hydra:member": SphereContent[];
};

export type SphereSearchParams = {
  /** Content-type UUID */
  contentTypeId?: string;
  /** Product model codes */
  modelCodes?: string[];
  /** Locale in "en-GB" or "en_GB" format — will be normalised to underscore */
  locale?: string;
  /** 1 = published, 0 = draft */
  status?: 0 | 1;
  page?: number;
  perPage?: number;
  /** Filter by Decathlon sport IDs (dd_sports) */
  ddSports?: number[];
};

export type SphereApiError = {
  message: string;
  code?: string | number;
};

// ---------------------------------------------------------------------------
// Sphere content type UUIDs
// ---------------------------------------------------------------------------

export const SphereContentTypes = {
  Highlight: "910db489-2c1f-42ad-bc8f-95bc02e16d45",
  Testing: "2bad7d01-a3d2-4d20-a00f-ad677184b69e",
  HowToUse: "b0881271-586f-4fb6-88cb-1d6f0d4a584b",
  HowToRepair: "9d25f7b8-de5c-4c56-9be0-8ce43196ab6f",
  Storybook: "e8e57267-1b91-48df-8140-7cfc0cc88e4c",
} as const;
