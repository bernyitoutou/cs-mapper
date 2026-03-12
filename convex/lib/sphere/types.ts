export type SphereContent = {
  id: string;
  title: string;
  content_type?: string;
  status?: number;
  locale?: string;
  model_codes?: string[];
  [key: string]: unknown;
};

/** Hydra collection response returned by GET /contents */
export type SphereListResponse = {
  "hydra:totalItems": number;
  "hydra:member": SphereContent[];
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
