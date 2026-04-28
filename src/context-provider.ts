import { resolve } from "path";
import type { RepositoryConfig, ContextResult } from "./types.js";
import { searchContent } from "./file-searcher.js";
import { extractKeywords } from "./keyword-extractor.js";

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

  const extracted = await extractKeywords(context);
  const keywords = extracted.length > 0 ? extracted : [context];

  const allResults = await Promise.all(
    keywords.map((kw) => searchContent({ keyword: kw, configs: targets })),
  );

  const scoreMap = new Map<string, { result: ContextResult; score: number }>();
  for (const results of allResults) {
    for (const result of results) {
      const key = `${result.repository_id}::${result.path}`;
      const existing = scoreMap.get(key);
      if (existing) {
        existing.score += 1;
      } else {
        scoreMap.set(key, { result, score: 1 });
      }
    }
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((entry) => entry.result);
}
