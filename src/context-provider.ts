import { resolve } from "path";
import type { RepositoryConfig, ContextResult } from "./types.js";
import { searchContent } from "./file-searcher.js";

interface GetContextOptions {
  context: string;
  repository_id?: string;
  configs: RepositoryConfig[];
}

export async function getContext(options: GetContextOptions): Promise<ContextResult[]> {
  const { context, repository_id, configs } = options;

  if (!context) throw new Error("context is required");

  let targets: RepositoryConfig[];

  if (repository_id !== undefined) {
    const found = configs.find((c) => c.id === repository_id);
    if (!found) throw new Error(`Repository not found: ${repository_id}`);
    targets = [found];
  } else {
    const cwd = resolve(process.cwd());
    const matched = configs.filter((c) => {
      const repoPath = resolve(c.path);
      return cwd.startsWith(repoPath + "/") || cwd === repoPath;
    });

    if (matched.length > 0) {
      matched.sort((a, b) => resolve(b.path).length - resolve(a.path).length);
      targets = [matched[0]];
    } else {
      targets = configs;
    }
  }

  return searchContent({ keyword: context, configs: targets });
}
