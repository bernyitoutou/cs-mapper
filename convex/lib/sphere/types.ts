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
  ClothingAndEquipment: "a25a906d-8026-40e6-906f-231d69e0cab6",
  CultureAndSociety: "3d0504f0-84e7-45c0-8c6f-c2a585bb2770",
  DiscoverASport: "ea4a68c8-f70d-421c-8499-211e27ac6387",
  Exercise: "8db61d7e-8a50-4e49-a3d4-f5a9ae051cf9",
  Glossary: "2df59c68-f9d5-4a40-af76-2f7c8b1a0527",
  HowToChoose: "875ef604-5ca2-4ed9-96b7-15e6c6e0fd0d",
  MaintainAndRepair: "df9f2111-7fbe-49c8-a94b-0c7af0ac41d1",
  LearnTo: "42103ca7-2700-434a-83a6-d92765ba5daf",
  News: "406d94ba-b437-46a0-8568-9587e87a8b10",
  NutritionAndHydration: "ea2f55f1-1e81-4200-b140-3cc4fa238876",
  PressRelease: "384fc715-e910-49cb-971d-d801446356a4",
  Progress: "9cace9e2-62ea-4730-b6de-508e9b595a3b",
  Recipe: "df1f5db4-3798-4910-8926-f4a70a667350",
  Rules: "8e1dda27-20da-4de6-9f4b-b687835ed82e",
  Security: "11f63456-c61a-4b11-9cfe-878225343bee",
  SportBenefits: "89d90517-b6e6-408c-a912-3903390dfe41",
  StoryOfProduct: "75dde0dc-95ba-42c4-b787-41cc1465a91a",
  Testimonials: "4252f1c8-1b52-49b5-9518-1cefcabe4a37",
  TrainingPlan: "3159d97f-bb80-4412-be01-cb1a9c69551c",
  WarmUpAndRecovery: "93d35269-7c9d-467a-96c8-7937c03e9f7e",
  Wellness: "3446d4e3-4d40-43d9-ad46-ebfefc96a611",
} as const;
