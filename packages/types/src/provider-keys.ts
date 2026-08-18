export type ProviderKeyName = "heygen";

export interface ProviderKeyMetadata {
  provider: ProviderKeyName;
  keyHint: string;
  updatedAt?: string | null;
}

export interface ProviderKeysResponse {
  keys: ProviderKeyMetadata[];
}

export interface ProviderKeyUpsertRequest {
  provider: ProviderKeyName;
  apiKey: string;
}
