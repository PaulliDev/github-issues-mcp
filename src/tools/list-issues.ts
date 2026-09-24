import { z } from "zod";

export const listIssuesSchema = z.object({
  state: z
    .enum(["open", "closed", "all"])
    .default("open")
    .describe("Filter issues by state. Defaults to open issues."),
});

export type ListIssuesInput = z.infer<typeof listIssuesSchema>;
