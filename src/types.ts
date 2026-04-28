export interface RepositoryConfig {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
  exclude_patterns: string[];
  cache_exclude_patterns?: string[];
}

export interface Settings {
  repositories: RepositoryConfig[];
  local_cache?: boolean;
  cache_delete?: boolean;
}

export interface CacheFileEntry {
  chunks: string[];
  cached_at: string;
}

export interface CacheData {
  repository_id: string;
  repository_name: string;
  created_at: string;
  files: Record<string, CacheFileEntry>;
}

export interface Repository {
  id: string;
  name: string;
  path: string;
}

export interface FileEntry {
  repository_id: string;
  path: string;
  type: "file" | "directory";
}

export interface ContextResult {
  repository_id: string;
  path: string;
  snippet: string;
}
