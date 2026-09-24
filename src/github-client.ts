import type {
  GitHubApiComment,
  GitHubApiIssue,
  GitHubApiLabel,
  GitHubApiReadme,
  GitHubApiSearchResult,
  GitHubComment,
  GitHubIssue,
  IssueStateFilter,
  ServerConfiguration,
} from "./types.js";

const GITHUB_API_BASE_URL = "https://api.github.com";
const LIST_ISSUES_PAGE_SIZE = 30;
const SEARCH_ISSUES_PAGE_SIZE = 20;
const HTTP_STATUS_NOT_FOUND = 404;

// A thin wrapper around the GitHub REST API. Nothing in this file knows about MCP:
// the MCP tools in server.ts call these methods, so the tools stay small and the
// HTTP details live in one place.
export class GitHubClient {
  private readonly headers: Record<string, string>;
  private readonly owner: string;
  private readonly repository: string;
  private readonly repositoryPath: string;

  // One client per repository. The token is sent with every request.
  public constructor(configuration: ServerConfiguration) {
    this.owner = configuration.owner;
    this.repository = configuration.repository;
    // Encoded once, so a stray character in the configuration can't change the URL path.
    this.repositoryPath = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repository)}`;
    this.headers = {
      Authorization: `Bearer ${configuration.githubToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "github-issues-mcp-server",
    };
  }

  // Used by the list_issues tool and the recent-issues resource.
  // Returns up to 30 issues, most recently updated first.
  public async listIssues(state: IssueStateFilter): Promise<GitHubIssue[]> {
    const url = this.buildUrl(`${this.repositoryPath}/issues`, {
      state: state,
      sort: "updated",
      direction: "desc",
      per_page: String(LIST_ISSUES_PAGE_SIZE),
    });
    const rawIssues = await this.request<GitHubApiIssue[]>(url);

    // The issues endpoint also returns pull requests. They carry a `pull_request` field.
    return rawIssues
      .filter((rawIssue: GitHubApiIssue) => rawIssue.pull_request === undefined)
      .map(mapToGitHubIssue);
  }

  // Used by the create_issue tool. Returns the issue GitHub created, including its new number.
  public async createIssue(title: string, body: string, labels: string[]): Promise<GitHubIssue> {
    const url = this.buildUrl(`${this.repositoryPath}/issues`);
    const rawIssue = await this.request<GitHubApiIssue>(url, {
      method: "POST",
      body: JSON.stringify({ title: title, body: body, labels: labels }),
    });

    return mapToGitHubIssue(rawIssue);
  }

  // Used by the add_comment tool. Returns the comment GitHub created.
  public async addComment(issueNumber: number, body: string): Promise<GitHubComment> {
    const url = this.buildUrl(`${this.repositoryPath}/issues/${issueNumber}/comments`);
    const rawComment = await this.request<GitHubApiComment>(url, {
      method: "POST",
      body: JSON.stringify({ body: body }),
    });

    return mapToGitHubComment(rawComment);
  }

  // Used by the search_issues tool. The query is limited to this repository and to
  // issues only. The Zod schema rejects repo:, org:, and user: qualifiers, which
  // GitHub would otherwise combine with ours to search other repositories too.
  public async searchIssues(query: string): Promise<GitHubIssue[]> {
    const url = this.buildUrl("/search/issues", {
      q: `${query} repo:${this.owner}/${this.repository} is:issue`,
      per_page: String(SEARCH_ISSUES_PAGE_SIZE),
    });
    const result = await this.request<GitHubApiSearchResult>(url);

    return result.items.map(mapToGitHubIssue);
  }

  // Used by the repository-readme resource. A repository without a README (404) is
  // normal, so that case returns a message. Any other failure, such as a bad token,
  // is a real error and throws.
  public async getReadme(): Promise<string> {
    const url = this.buildUrl(`${this.repositoryPath}/readme`);
    const response = await fetch(url, { headers: this.headers });

    if (response.status === HTTP_STATUS_NOT_FOUND) {
      return "README not found for this repository.";
    }
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    // Trusted boundary: the shape is defined by the GitHub REST API.
    const readme = (await response.json()) as GitHubApiReadme;

    // GitHub sends file contents base64 encoded.
    return Buffer.from(readme.content, "base64").toString("utf-8");
  }

  // Builds a full API URL. URLSearchParams encodes every query value for us.
  private buildUrl(path: string, queryParameters: Record<string, string> = {}): string {
    const url = new URL(path, GITHUB_API_BASE_URL);

    url.search = new URLSearchParams(queryParameters).toString();

    return url.toString();
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

// Converts GitHub's raw comment into the shape the add_comment tool returns to the AI.
function mapToGitHubComment(rawComment: GitHubApiComment): GitHubComment {
  return {
    id: rawComment.id,
    body: rawComment.body,
    author: rawComment.user.login,
    createdAt: rawComment.created_at,
  };
}
