import type { AuthedReviewer, Env } from "./types";

export function requireAdmin(request: Request, env: Env): Response | null {
  const expected = env.ADMIN_TOKEN;
  if (!expected) return new Response(JSON.stringify({ error: "ADMIN_TOKEN is not configured" }), { status: 500 });
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== expected) return new Response(JSON.stringify({ error: "Admin authorization required" }), { status: 401 });
  return null;
}

export async function createReviewerToken(): Promise<{ token: string; tokenHash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { token, tokenHash: await sha256(token) };
}

export async function requireReviewer(request: Request, env: Env): Promise<AuthedReviewer | Response> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return new Response(JSON.stringify({ error: "Reviewer authorization required" }), { status: 401 });
  const tokenHash = await sha256(token);
  const reviewer = await env.DB.prepare(
    "SELECT id, name, email FROM reviewers WHERE token_hash = ? AND active = 1"
  )
    .bind(tokenHash)
    .first<AuthedReviewer>();
  if (!reviewer) return new Response(JSON.stringify({ error: "Reviewer link is invalid or inactive" }), { status: 401 });
  return reviewer;
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
