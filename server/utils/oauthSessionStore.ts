import crypto from "node:crypto";

type OAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  service: string;
  createdAt: number;
};

// In-memory one-time token store - tokens expire after 5 minutes
const sessionStore = new Map<string, OAuthSession>();

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, session] of sessionStore.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessionStore.delete(key);
    }
  }
}

export function storeOAuthSession(session: Omit<OAuthSession, "createdAt">): string {
  pruneExpired();
  const token = crypto.randomBytes(32).toString("hex");
  sessionStore.set(token, { ...session, createdAt: Date.now() });
  return token;
}

export function consumeOAuthSession(token: string): OAuthSession | null {
  pruneExpired();
  const session = sessionStore.get(token);
  if (!session) return null;
  // One-time use - delete immediately after consumption
  sessionStore.delete(token);
  if (Date.now() - session.createdAt > SESSION_TTL_MS) return null;
  return session;
}
