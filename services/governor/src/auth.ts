import type { Request, Response, NextFunction, RequestHandler } from "express";

export type Role = "admin" | "operator" | "auditor";

interface KeyRecord {
  role: Role;
}

const ROLE_SET = new Set<Role>(["admin", "operator", "auditor"]);

const parseApiKeys = (raw: string | undefined): Map<string, KeyRecord> => {
  const map = new Map<string, KeyRecord>();
  if (!raw) return map;

  for (const segment of raw.split(",")) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const [roleRaw, keyRaw] = trimmed.split("=", 2);
    const role = roleRaw?.trim() as Role | undefined;
    const key = keyRaw?.trim();
    if (!role || !ROLE_SET.has(role) || !key) continue;
    map.set(key, { role });
  }
  return map;
};

const getApiKeyFromRequest = (req: Request): string | null => {
  const explicit = req.header("x-api-key");
  if (explicit && explicit.trim()) return explicit.trim();
  const auth = req.header("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ", 2);
  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) return null;
  return token.trim();
};

const hasRole = (actual: Role, expected: Role[]) => {
  if (actual === "admin") return true;
  return expected.includes(actual);
};

export const createAuth = (rawApiKeys: string | undefined) => {
  const keys = parseApiKeys(rawApiKeys);
  const enabled = keys.size > 0;

  const requireRole = (expected: Role[]): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!enabled) {
        next();
        return;
      }

      const key = getApiKeyFromRequest(req);
      if (!key) {
        res.status(401).json({ error: "Missing API key." });
        return;
      }

      const record = keys.get(key);
      if (!record) {
        res.status(403).json({ error: "Invalid API key." });
        return;
      }

      if (!hasRole(record.role, expected)) {
        res.status(403).json({ error: "Insufficient role." });
        return;
      }

      next();
    };
  };

  return {
    enabled,
    requireRole
  };
};
