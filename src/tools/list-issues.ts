import { z } from "zod";
import { ISSUE_STATE_FILTERS } from "../types.js";

export const listIssuesSchema = z.object({
  state: z
    .enum(ISSUE_STATE_FILTERS)
    .default("open")
    .describe("Filter issues by state. Defaults to open issues."),
});
