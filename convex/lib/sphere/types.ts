export type SphereContent = {
  uuid: string;
  title: string;
  content_type_id: string;
  status: number;
  locale: string;
  model_codes?: string[];
  created_at: string;
  updated_at: string;
  body: Record<string, unknown>;
  [key: string]: unknown;
};

export type SphereListResponse = {
  items: SphereContent[];
  total: number;
  page: number;
  per_page: number;
};

export type SphereContentTypeDefinition = {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
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
};

export type SphereApiError = {
  message: string;
  code?: string | number;
};
