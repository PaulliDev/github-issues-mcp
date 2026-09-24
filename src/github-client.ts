import type {
  GitHubApiComment,
  GitHubApiIssue,
  GitHubApiReadme,
  GitHubApiSearchResult,
  GitHubComment,
  GitHubIssue,
  ServerConfiguration,
} from "./types.js";

export class GitHubClient {
  private readonly baseUrl = "https://api.github.com";
  private readonly headers: Record<string, string>;
  private readonly owner: string;
  private readonly repository: string;

  constructor(configuration: ServerConfiguration) {
    this.owner = configuration.owner;
    this.repository = configuration.repository;
    this.headers = {
      Authorization: `Bearer ${configuration.githubToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "github-issues-mcp-server",
    };
  }

  async listIssues(state: "open" | "closed" | "all"): Promise<GitHubIssue[]> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repository}/issues?state=${state}&sort=updated&direction=desc&per_page=30`;
    const rawIssues = await this.request<GitHubApiIssue[]>(url);

    // The issues endpoint also returns pull requests. They carry a `pull_request` field.
    return rawIssues
      .filter((rawIssue: GitHubApiIssue) => rawIssue.pull_request === undefined)
      .map(mapToGitHubIssue);
  }

  async createIssue(title: string, body: string, labels: string[]): Promise<GitHubIssue> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repository}/issues`;
    const rawIssue = await this.request<GitHubApiIssue>(url, {
      method: "POST",
      body: JSON.stringify({ title, body, labels }),
    });

    return mapToGitHubIssue(rawIssue);
  }

  async addComment(issueNumber: number, body: string): Promise<GitHubComment> {
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

  async searchIssues(query: string): Promise<GitHubIssue[]> {
    const searchQuery = `${query} repo:${this.owner}/${this.repository} is:issue`;
    const url = `${this.baseUrl}/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=20`;
    const result = await this.request<GitHubApiSearchResult>(url);

    return result.items.map(mapToGitHubIssue);
  }

  async getReadme(): Promise<string> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repository}/readme`;
    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      return "README not found for this repository.";
    }

    // Trusted boundary: the shape is defined by the GitHub REST API.
    const readme = (await response.json()) as GitHubApiReadme;

    return Buffer.from(readme.content, "base64").toString("utf-8");
  }

  private async request<TResponse>(url: string, init: RequestInit = {}): Promise<TResponse> {
    const response = await fetch(url, { ...init, headers: this.headers });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    // Trusted boundary: the shape is defined by the GitHub REST API.
    return (await response.json()) as TResponse;
  }
}

function mapToGitHubIssue(rawIssue: GitHubApiIssue): GitHubIssue {
  return {
    number: rawIssue.number,
    title: rawIssue.title,
    body: rawIssue.body,
    state: rawIssue.state,
    author: rawIssue.user.login,
    labels: rawIssue.labels.map((label: { name: string }) => label.name),
    createdAt: rawIssue.created_at,
    updatedAt: rawIssue.updated_at,
  };
}
