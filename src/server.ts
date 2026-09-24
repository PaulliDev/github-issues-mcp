import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitHubClient } from "./github-client.js";
import { sanitizeToolOutput } from "./security/sanitize-tool-output.js";
import { addCommentSchema } from "./tools/add-comment.js";
import { createIssueSchema } from "./tools/create-issue.js";
import { listIssuesSchema } from "./tools/list-issues.js";
import { searchIssuesSchema } from "./tools/search-issues.js";

interface TextToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
}

function toTextResult(data: unknown): TextToolResult {
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
      description: "Search for issues using GitHub search syntax.",
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
    { description: "The 10 most recently updated open issues", mimeType: "application/json" },
    async (uri: URL) => {
      const issues = await githubClient.listIssues("open");
      const recentIssues = issues.slice(0, 10);

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
    name: "github-issues",
    version: "1.0.0",
  });

  registerTools(server, githubClient);
  registerResources(server, githubClient);

  return server;
}
