import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadRepositories } from "./repository-manager.js";
import { searchFiles, readFileContent } from "./file-searcher.js";

const server = new McpServer({
  name: "repo-bridge-mcp",
  version: "0.1.0",
});

server.tool(
  "list_repositories",
  "登録済みリポジトリの一覧取得",
  {},
  async () => {
    const configs = await loadRepositories();
    const repositories = configs.map(({ id, name, path }) => ({ id, name, path }));
    return {
      content: [{ type: "text", text: JSON.stringify(repositories) }],
    };
  }
);

server.tool(
  "search_files",
  "ファイル名・パターンによる横断検索",
  {
    pattern: z.string().describe("検索パターン"),
    repository_id: z.string().optional().describe("リポジトリID（省略時は全リポジトリ対象）"),
  },
  async ({ pattern, repository_id }) => {
    const configs = await loadRepositories();
    const results = await searchFiles({ pattern, repository_id, configs });
    return {
      content: [{ type: "text", text: JSON.stringify(results) }],
    };
  }
);

server.tool(
  "read_file",
  "指定ファイルの内容取得",
  {
    repository_id: z.string().describe("リポジトリID"),
    path: z.string().describe("ファイルパス"),
  },
  async ({ repository_id, path }) => {
    const configs = await loadRepositories();
    const content = await readFileContent({ repository_id, path, configs });
    return {
      content: [{ type: "text", text: content }],
    };
  }
);

server.tool(
  "search_content",
  "ファイル内容のキーワード検索",
  {
    keyword: z.string().describe("検索キーワード"),
    repository_id: z.string().optional().describe("リポジトリID（省略時は全リポジトリ対象）"),
  },
  async () => {
    throw new Error("Not implemented");
  }
);

server.tool(
  "get_context",
  "作業コンテキストに応じた関連ファイル取得",
  {
    context: z.string().describe("作業コンテキスト"),
  },
  async () => {
    throw new Error("Not implemented");
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
