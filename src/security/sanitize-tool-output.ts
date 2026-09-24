const SUSPICIOUS_PATTERNS: RegExp[] = [
  /ignore (all )?previous instructions/gi,
  /you are now/gi,
  /system prompt/gi,
];

// A cheap first filter, not a guarantee: the client must still treat tool results as untrusted.
export function sanitizeToolOutput(content: string): string {
  let sanitizedContent = content;

  for (const pattern of SUSPICIOUS_PATTERNS) {
    sanitizedContent = sanitizedContent.replace(pattern, "[filtered]");
  }

  return sanitizedContent;
}
