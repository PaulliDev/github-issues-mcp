import { existsSync } from "node:fs";
import type { ServerConfiguration } from "./types.js";

const ENVIRONMENT_FILE_PATH = ".env";

// Loads .env from the working directory when present. Variables already set
// (for example by Claude Desktop's "env" block) are not overwritten.
export function loadEnvironmentFile(): void {
  if (existsSync(ENVIRONMENT_FILE_PATH)) {
    process.loadEnvFile(ENVIRONMENT_FILE_PATH);
  }
}

export function loadConfiguration(): ServerConfiguration {
  const githubToken = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repository = process.env.GITHUB_REPO;

  if (!githubToken || !owner || !repository) {
    throw new Error(
      "Missing required environment variables: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO"
    );
  }

  return { githubToken, owner, repository };
}
