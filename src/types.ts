export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  author: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GitHubComment {
  id: number;
  body: string;
  author: string;
  createdAt: string;
}

export interface ServerConfiguration {
  githubToken: string;
  owner: string;
  repository: string;
}

// The subset of GitHub REST API response fields this server reads.

interface GitHubApiUser {
  login: string;
}

interface GitHubApiLabel {
  name: string;
}

export interface GitHubApiIssue {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  user: GitHubApiUser;
  labels: GitHubApiLabel[];
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
}

export interface GitHubApiComment {
  id: number;
  body: string;
  user: GitHubApiUser;
  created_at: string;
}

export interface GitHubApiSearchResult {
  items: GitHubApiIssue[];
}

export interface GitHubApiReadme {
  content: string;
}
