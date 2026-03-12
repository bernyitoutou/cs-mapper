export interface SportGroup {
  id: string;
  name: string;
  locale: string;
  type: string;
  sports: string[];
  status: string;
  updatedAt: string;
}

export interface BlogSportsEntry {
  uid: string;
  locale: string;
  sport_ddfs_id: string;
  sport_label: string;
  title: string;
  url: string;
  taxonomies?: Array<{ taxonomy_uid: string; term_uid: string }>;
  [key: string]: unknown;
}

export interface SportGroupMappingEntry {
  label: string;
  url: string;
  csUid: string;
  taxonomy: string | null;
  sportIds: string[];
}

export interface SportGroupListResponse {
  items: SportGroup[];
}

export interface FedIdTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface FedIdApiError {
  error: string;
  error_description?: string;
  error_code?: string;
}
