import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfiguration, loadEnvironmentFile } from "./configuration.js";
import { GitHubClient } from "./github-client.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  loadEnvironmentFile();

  const configuration = loadConfiguration();
  const githubClient = new GitHubClient(configuration);
  const server = createServer(githubClient);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch((error: unknown) => {
  process.stderr.write(`Fatal error: ${String(error)}\n`);
  process.exit(1);
});
