import { z } from "zod";

// GitHub combines several repo: qualifiers with OR, so "bug repo:someone/else" would
// widen the search beyond our repository. Qualifiers that change the scope are rejected.
const SCOPE_QUALIFIER_PATTERN = /(^|\s)-?(repo|org|user):/i;

export const searchIssuesSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(256)
    .refine((query: string) => !SCOPE_QUALIFIER_PATTERN.test(query), {
      message: "The repo:, org:, and user: qualifiers are not allowed.",
    })
    .describe(
      "Search query to find issues in this repository. Supports GitHub search syntax such as label:bug or is:open, but not repo:, org:, or user:."
    ),
});
