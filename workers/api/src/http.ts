import type { Env } from "./types";

export function jsonResponse(data: unknown, init: ResponseInit = {}, env?: Env, request?: Request): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  addCors(headers, env, request);
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(message: string, status: number, env?: Env, request?: Request): Response {
  return jsonResponse({ error: message }, { status }, env, request);
}

export function optionsResponse(env: Env, request: Request): Response {
  const headers = new Headers();
  addCors(headers, env, request);
  headers.set("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
  headers.set("access-control-allow-headers", "authorization,content-type");
  headers.set("access-control-max-age", "86400");
  return new Response(null, { status: 204, headers });
}

function addCors(headers: Headers, env?: Env, request?: Request): void {
  if (!env || !request) return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowed.includes(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "origin");
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}
