import { z } from "zod";

export const createIssueSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(256)
    .describe("The title of the issue to create."),
  body: z
    .string()
    .max(65536)
    .describe("The body content of the issue. Supports markdown."),
  labels: z
    .array(z.string())
    .default([])
    .describe("Labels to apply to the issue."),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
