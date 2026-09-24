import { z } from "zod";

export const searchIssuesSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(256)
    .describe("Search query to find issues. Supports GitHub search syntax."),
});

export type SearchIssuesInput = z.infer<typeof searchIssuesSchema>;
