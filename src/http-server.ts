import express, { type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfiguration, loadEnvironmentFile } from "./configuration.js";
import { GitHubClient } from "./github-client.js";
import { createAuthenticationMiddleware } from "./security/create-authentication-middleware.js";
import { createServer } from "./server.js";

const RATE_LIMIT_WINDOW_MILLISECONDS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const DEFAULT_PORT = 3001;
const MAXIMUM_PORT = 65535;

function loadAuthenticationToken(): string {
  const authenticationToken = process.env.MCP_AUTH_TOKEN;

  if (!authenticationToken) {
    throw new Error("Missing required environment variable: MCP_AUTH_TOKEN");
  }

  return authenticationToken;
}

// Reads PORT from the environment. Rejects values like "abc" or "70000" instead of
// silently starting on NaN or an invalid port.
function loadPort(): number {
  const rawPort = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > MAXIMUM_PORT) {
    throw new Error(`Invalid PORT: "${rawPort}". Use a whole number between 1 and ${MAXIMUM_PORT}.`);
  }

  return port;
}

function sendJsonRpcError(response: Response, status: number, code: number, message: string): void {
  response.status(status).json({ jsonrpc: "2.0", error: { code, message }, id: null });
}

async function handleMcpRequest(
  githubClient: GitHubClient,
  request: Request,
  response: Response
): Promise<void> {
  // Stateless mode: a fresh server and transport per request, closed when the response ends.
  const server = createServer(githubClient);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  response.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  } catch (error: unknown) {
    process.stderr.write(`Error handling MCP request: ${String(error)}\n`);

    if (!response.headersSent) {
      sendJsonRpcError(response, 500, -32603, "Internal server error");
    }
  }
}

async function startHttpServer(): Promise<void> {
  loadEnvironmentFile();

  const configuration = loadConfiguration();
  const authenticationToken = loadAuthenticationToken();
  const githubClient = new GitHubClient(configuration);
  const application = express();
  const port = loadPort();

  application.use(express.json());
  application.use(
    rateLimit({ windowMs: RATE_LIMIT_WINDOW_MILLISECONDS, limit: RATE_LIMIT_MAX_REQUESTS })
  );
  application.use(createAuthenticationMiddleware(authenticationToken));

  application.post("/mcp", (request: Request, response: Response) =>
    handleMcpRequest(githubClient, request, response)
  );
  // Stateless servers have no session stream to open (GET) or end (DELETE).
  application.get("/mcp", (_request: Request, response: Response) =>
    sendJsonRpcError(response, 405, -32000, "Method not allowed.")
  );
  application.delete("/mcp", (_request: Request, response: Response) =>
    sendJsonRpcError(response, 405, -32000, "Method not allowed.")
  );

  application.listen(port, () => {
    process.stderr.write(`MCP HTTP server listening on port ${port}\n`);
  });
}

startHttpServer().catch((error: unknown) => {
  process.stderr.write(`Fatal error: ${String(error)}\n`);
  process.exit(1);
});
