# GitHub Issues MCP Server

A Model Context Protocol (MCP) server in TypeScript that lets Claude, Cursor, or any MCP client
list, create, search, and comment on GitHub issues.

This is the companion code for the Snippets Ltd tutorial
**[Building a Custom MCP Server in TypeScript](https://snippets.ltd/blog/building-custom-mcp-server-in-typescript)**.
Read the article for the step-by-step explanation.

## What it exposes

| Type | Name | What it does |
|---|---|---|
| Tool | `list_issues` | List open, closed, or all issues (pull requests excluded), most recently updated first |
| Tool | `create_issue` | Create an issue with a title, body, and labels |
| Tool | `add_comment` | Comment on an existing issue |
| Tool | `search_issues` | Search issues with GitHub search syntax |
| Resource | `repo://readme` | The repository README |
| Resource | `repo://issues/recent` | The 10 most recently updated open issues |

## Prerequisites

- Node.js 20.12 or newer
- A GitHub [fine-grained personal access token](https://github.com/settings/personal-access-tokens)
  with **Issues: Read and write** on the repository you want to use (use a test repo while experimenting)

## Setup

```bash
git clone https://github.com/PaulliDev/github-issues-mcp.git
cd github-issues-mcp
npm install
cp .env.example .env   # then fill in GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO
npm run build
```

## Run it

| Command | What it does |
|---|---|
| `npm run inspect` | Opens the MCP Inspector in your browser, connected to the server over stdio |
| `npm start` | Runs the stdio server (what desktop clients spawn) |
| `npm run start:http` | Runs the Streamable HTTP server on `PORT` (default 3001), protected by `MCP_AUTH_TOKEN` |

## Call the HTTP server

Add `MCP_AUTH_TOKEN` to `.env`, run `npm run start:http`, then from another terminal:

```bash
curl -s http://localhost:3001/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer <your MCP_AUTH_TOKEN>' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Every MCP message is a POST to `/mcp` with a JSON-RPC body. Replies arrive as Server-Sent Events
(`event: message` / `data: {...}`). Without the header you get `401`; `GET` returns `405`.
The MCP Inspector can also connect: choose **Streamable HTTP**, URL `http://localhost:3001/mcp`,
and add the `Authorization` header. To publish online, run it on any Node host behind HTTPS.

## Connect to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "github-issues": {
      "command": "node",
      "args": ["/absolute/path/to/github-issues-mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "github_pat_your_token_here",
        "GITHUB_OWNER": "your-org",
        "GITHUB_REPO": "your-repo"
      }
    }
  }
}
```

Restart Claude Desktop and ask things like "show me open issues labeled bug".

## Project structure

```
src/
├── index.ts                  # stdio entry point
├── http-server.ts            # Streamable HTTP entry point (auth + rate limiting)
├── server.ts                 # createServer(): registers tools and resources
├── configuration.ts          # loads .env and validates environment variables
├── github-client.ts          # GitHub REST API wrapper
├── types.ts                  # shared and GitHub API types
├── tools/                    # Zod input schemas, one file per tool
└── security/
    ├── sanitize-tool-output.ts
    └── create-authentication-middleware.ts
```

## Security notes

- Tool results contain text written by anyone who can open an issue. The server filters common
  prompt-injection phrases, but your client should still treat tool output as untrusted.
- The HTTP server refuses to start without `MCP_AUTH_TOKEN`. Use a long random value.
- Give the GitHub token the fewest permissions possible.

## License

MIT
