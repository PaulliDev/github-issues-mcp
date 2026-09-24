import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { GitHubClient } from "./github-client.js";
import { sanitizeToolOutput } from "./security/sanitize-tool-output.js";
import { addCommentSchema } from "./tools/add-comment.js";
import { createIssueSchema } from "./tools/create-issue.js";
import { listIssuesSchema } from "./tools/list-issues.js";
import { searchIssuesSchema } from "./tools/search-issues.js";

const SERVER_NAME = "github-issues";
const RECENT_ISSUES_LIMIT = 10;

// Reads the version from package.json so the server never reports a stale one.
function readPackageVersion(): string {
  const packageJsonUrl = new URL("../package.json", import.meta.url);
  const packageJson: unknown = JSON.parse(readFileSync(packageJsonUrl, "utf-8"));

  if (
    typeof packageJson === "object" &&
    packageJson !== null &&
    "version" in packageJson &&
    typeof packageJson.version === "string"
  ) {
    return packageJson.version;
  }

  throw new Error("package.json is missing a version");
}

// Every tool returns its data as pretty-printed JSON text, filtered for prompt injection.
function toTextResult(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: sanitizeToolOutput(JSON.stringify(data, null, 2)) }],
  };
}

function registerTools(server: McpServer, githubClient: GitHubClient): void {
  server.registerTool(
    "list_issues",
    {
      description:
        "List issues in the GitHub repository, most recently updated first. Returns issue number, title, state, author, and labels.",
      inputSchema: listIssuesSchema.shape,
    },
    async ({ state }) => toTextResult(await githubClient.listIssues(state))
  );

  server.registerTool(
    "create_issue",
    {
      description: "Create a new issue in the GitHub repository.",
      inputSchema: createIssueSchema.shape,
    },
    async ({ title, body, labels }) =>
      toTextResult(await githubClient.createIssue(title, body, labels))
  );

  server.registerTool(
    "add_comment",
    {
      description: "Add a comment to an existing issue.",
      inputSchema: addCommentSchema.shape,
    },
    async ({ issueNumber, body }) =>
      toTextResult(await githubClient.addComment(issueNumber, body))
  );

  server.registerTool(
    "search_issues",
    {
      description:
        "Search for issues in this repository using GitHub search syntax (for example label:bug is:open).",
      inputSchema: searchIssuesSchema.shape,
    },
    async ({ query }) => toTextResult(await githubClient.searchIssues(query))
  );
}

function registerResources(server: McpServer, githubClient: GitHubClient): void {
  server.registerResource(
    "repository-readme",
    "repo://readme",
    { description: "The repository README file", mimeType: "text/markdown" },
    async (uri: URL) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: sanitizeToolOutput(await githubClient.getReadme()),
        },
      ],
    })
  );

  server.registerResource(
    "recent-issues",
    "repo://issues/recent",
    {
      description: `The ${RECENT_ISSUES_LIMIT} most recently updated open issues`,
      mimeType: "application/json",
    },
    async (uri: URL) => {
      const issues = await githubClient.listIssues("open");
      const recentIssues = issues.slice(0, RECENT_ISSUES_LIMIT);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: sanitizeToolOutput(JSON.stringify(recentIssues, null, 2)),
          },
        ],
      };
    }
  );
}

export function createServer(githubClient: GitHubClient): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: readPackageVersion(),
  });

  registerTools(server, githubClient);
  registerResources(server, githubClient);

  return server;
}
