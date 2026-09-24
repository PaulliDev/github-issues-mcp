import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";

function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

// Takes the expected token as an argument so the caller must decide what happens when it is missing.
export function createAuthenticationMiddleware(expectedToken: string): RequestHandler {
  const expectedHeaderHash = hashToken(`Bearer ${expectedToken}`);

  return (request: Request, response: Response, next: NextFunction): void => {
    const authorizationHeader = request.headers.authorization ?? "";
    // Hashing both sides gives equal-length buffers, which timingSafeEqual requires.
    const isAuthorized = timingSafeEqual(hashToken(authorizationHeader), expectedHeaderHash);

    if (!isAuthorized) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    next();
  };
}
