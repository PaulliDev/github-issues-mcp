import { z } from "zod";

export const addCommentSchema = z.object({
  issueNumber: z
    .number()
    .int()
    .positive()
    .describe("The issue number to comment on."),
  body: z
    .string()
    .min(1)
    .max(65536)
    .describe("The comment body. Supports markdown."),
});
