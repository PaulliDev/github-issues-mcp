import type {
  GitHubApiComment,
  GitHubApiIssue,
  GitHubApiLabel,
  GitHubApiReadme,
  GitHubApiSearchResult,
  GitHubComment,
  GitHubIssue,
  ServerConfiguration,
} from "./types.js";

// A thin wrapper around the GitHub REST API. Nothing in this file knows about MCP:
// the MCP tools in server.ts call these methods, so the tools stay small and the
// HTTP details live in one place.
export class GitHubClient {
  private readonly baseUrl: string = "https://api.github.com";
  private readonly headers: Record<string, string>;
  private readonly owner: string;
  private readonly repository: string;

  // One client per repository. The token is sent with every request.
  public constructor(configuration: ServerConfiguration) {
    this.owner = configuration.owner;
    this.repository = configuration.repository;
    this.headers = {
      Authorization: `Bearer ${configuration.githubToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "github-issues-mcp-server",
    };
  }

  // Used by the list_issues tool and the recent-issues resource.
  // Returns up to 30 issues, most recently updated first.
  public async listIssues(state: "open" | "closed" | "all"): Promise<GitHubIssue[]> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repository}/issues?state=${state}&sort=updated&direction=desc&per_page=30`;
    const rawIssues = await this.request<GitHubApiIssue[]>(url);

    // The issues endpoint also returns pull requests. They carry a `pull_request` field.
    return rawIssues
      .filter((rawIssue: GitHubApiIssue) => rawIssue.pull_request === undefined)
      .map(mapToGitHubIssue);
  }

  // Used by the create_issue tool. Returns the issue GitHub created, including its new number.
  public async createIssue(title: string, body: string, labels: string[]): Promise<GitHubIssue> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repository}/issues`;
    const rawIssue = await this.request<GitHubApiIssue>(url, {
      method: "POST",
      body: JSON.stringify({ title, body, labels }),
    });

    return mapToGitHubIssue(rawIssue);
  }

  // Used by the add_comment tool. Returns the comment GitHub created.
  public async addComment(issueNumber: number, body: string): Promise<GitHubComment> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repository}/issues/${issueNumber}/comments`;
    const rawComment = await this.request<GitHubApiComment>(url, {
      method: "POST",
      body: JSON.stringify({ body }),
    });

    return {
      id: rawComment.id,
      body: rawComment.body,
      author: rawComment.user.login,
      createdAt: rawComment.created_at,
    };
  }

  // Used by the search_issues tool. The query is limited to this repository and to
  // issues only, so the AI can't search other repositories or pull requests.
  public async searchIssues(query: string): Promise<GitHubIssue[]> {
    const searchQuery = `${query} repo:${this.owner}/${this.repository} is:issue`;
    const url = `${this.baseUrl}/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=20`;
    const result = await this.request<GitHubApiSearchResult>(url);

    return result.items.map(mapToGitHubIssue);
  }

  // Used by the repository-readme resource. A missing README is not an error,
  // so this returns a message instead of throwing.
  public async getReadme(): Promise<string> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repository}/readme`;
    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      return "README not found for this repository.";
    }

    // Trusted boundary: the shape is defined by the GitHub REST API.
    const readme = (await response.json()) as GitHubApiReadme;

    // GitHub sends file contents base64 encoded.
    return Buffer.from(readme.content, "base64").toString("utf-8");
  }

  // Shared by every method above: sends the request with our headers, turns an HTTP
  // error into an exception, and parses the JSON body. The MCP SDK catches the
  // exception and reports it to the AI as a failed tool call.
  private async request<TResponse>(url: string, init: RequestInit = {}): Promise<TResponse> {
    const response = await fetch(url, { ...init, headers: this.headers });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    // Trusted boundary: the shape is defined by the GitHub REST API.
    return (await response.json()) as TResponse;
  }
}

// Converts GitHub's raw issue into the smaller, camelCase shape our tools return to the AI.
function mapToGitHubIssue(rawIssue: GitHubApiIssue): GitHubIssue {
  return {
    number: rawIssue.number,
    title: rawIssue.title,
    body: rawIssue.body,
    state: rawIssue.state,
    author: rawIssue.user.login,
    labels: rawIssue.labels.map((label: GitHubApiLabel) => label.name),
    createdAt: rawIssue.created_at,
    updatedAt: rawIssue.updated_at,
  };
}
