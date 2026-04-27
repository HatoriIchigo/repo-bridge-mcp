export interface RepositoryConfig {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
  exclude_patterns: string[];
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
