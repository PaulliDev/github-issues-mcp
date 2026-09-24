// The states an issue can be in, and the filters list_issues accepts.
// Defined once here and reused by the Zod schema and the GitHub client.
export const ISSUE_STATE_FILTERS = ["open", "closed", "all"] as const;

export type IssueStateFilter = (typeof ISSUE_STATE_FILTERS)[number];

export type IssueState = Exclude<IssueStateFilter, "all">;

// An issue as our tools return it to the AI: only the fields it needs, in camelCase.
export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: IssueState;
  author: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

// A comment as the add_comment tool returns it to the AI.
export interface GitHubComment {
  id: number;
  body: string;
  author: string;
  createdAt: string;
}

// Settings loaded from environment variables and passed to the GitHub client.
export interface ServerConfiguration {
  githubToken: string;
  owner: string;
  repository: string;
}

// The subset of GitHub REST API response fields this server reads.

// The author of an issue or comment, as GitHub returns it.
interface GitHubApiUser {
  login: string;
}

// A label attached to an issue, as GitHub returns it.
export interface GitHubApiLabel {
  name: string;
}

// A raw issue from GitHub. The client maps it to GitHubIssue.
// Pull requests come back from the same endpoint and carry a `pull_request` field.
export interface GitHubApiIssue {
  number: number;
  title: string;
  body: string | null;
  state: IssueState;
  user: GitHubApiUser;
  labels: GitHubApiLabel[];
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
}

// A raw comment from GitHub. The client maps it to GitHubComment.
export interface GitHubApiComment {
  id: number;
  body: string;
  user: GitHubApiUser;
  created_at: string;
}

// The response of GitHub's search endpoint, used by search_issues.
export interface GitHubApiSearchResult {
  items: GitHubApiIssue[];
}

// The README endpoint response. `content` is base64 encoded.
export interface GitHubApiReadme {
  content: string;
}
