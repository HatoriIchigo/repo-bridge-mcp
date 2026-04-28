import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadRepositories } from "./repository-manager.js";
import { searchFiles, readFileContent, searchContent } from "./file-searcher.js";
import { getContext } from "./context-provider.js";

const server = new McpServer(
  { name: "repo-bridge-mcp", version: "0.1.0" },
  {
    instructions:
      "作業を開始する前に必ず get_context を呼び出し、関連ファイルを取得すること。" +
      "コードの実装・デバッグ・レビュー・質問への回答など、いかなる作業においても最初のステップとして実行すること。",
  },
);

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
  async ({ keyword, repository_id }) => {
    const configs = await loadRepositories();
    const targets = repository_id ? configs.filter((c) => c.id === repository_id) : configs;
    const results = await searchContent({ keyword, configs: targets });
    return {
      content: [{ type: "text", text: JSON.stringify(results) }],
    };
  }
);

server.tool(
  "get_context",
  "【作業開始前に必ず呼び出す】実装・デバッグ・レビュー・質問への回答など、いかなる作業においても最初に呼び出し、関連ファイルとスニペットを取得する。contextには作業内容・キーワードを渡す。",
  {
    context: z.string().describe("作業コンテキスト"),
    repository_id: z.string().optional().describe("リポジトリID（省略時はCWD判定）"),
  },
  async ({ context, repository_id }) => {
    const configs = await loadRepositories();
    const results = await getContext({ context, repository_id, configs });
    return {
      content: [{ type: "text", text: JSON.stringify(results) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
