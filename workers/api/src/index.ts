import {
  FinalDecisionUpsertSchema,
  ImportCommitSchema,
  ReviewerCreateSchema,
  ReviewerUpdateSchema,
  ReviewUpsertSchema,
  SessionStartSchema,
  validateImportRecords
} from "@az-refresh/shared";
import { createReviewerToken, requireAdmin, requireReviewer } from "./auth";
import {
  commitImport,
  createReviewer,
  createReviewerSession,
  deactivateReviewer,
  getActiveBatch,
  getAggregates,
  getCurrentReviewerSession,
  getCurrentReviewerSessionDetail,
  getReviewer,
  listAllRecords,
  listDatabaseOptions,
  listReviewers,
  listSubjects,
  regenerateReviewerLink,
  saveFinalDecision,
  updateReviewer,
  upsertReview
} from "./db";
import { errorResponse, jsonResponse, optionsResponse, readJson } from "./http";
import type { AuthedReviewer, Env } from "./types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return optionsResponse(env, request);
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") return jsonResponse({ ok: true }, {}, env, request);
      if (url.pathname.startsWith("/admin/")) return await handleAdmin(request, env, url);
      if (url.pathname.startsWith("/reviewer/")) return await handleReviewer(request, env, url);
      return errorResponse("Not found", 404, env, request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      return errorResponse(message, 500, env, request);
    }
  }
};

async function handleAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  const auth = requireAdmin(request, env);
  if (auth) return withCors(auth, env, request);

  if (request.method === "POST" && url.pathname === "/admin/import/validate") {
    const payload = ImportCommitSchema.parse(await readJson(request));
    return jsonResponse(validateImportRecords(payload.records), {}, env, request);
  }

  if (request.method === "POST" && url.pathname === "/admin/import/commit") {
    const payload = ImportCommitSchema.parse(await readJson(request));
    const result = validateImportRecords(payload.records);
    if (result.errors.length) return jsonResponse(result, { status: 422 }, env, request);
    const batchId = await commitImport(env, payload);
    return jsonResponse({ batchId }, {}, env, request);
  }

  if (request.method === "POST" && url.pathname === "/admin/reviewers") {
    const payload = ReviewerCreateSchema.parse(await readJson(request));
    const credentials = await createReviewerToken();
    const reviewer = await createReviewer(env, payload, credentials);
    return jsonResponse(
      { reviewer, id: reviewer.id, token: credentials.token, reviewUrlPath: reviewer.reviewUrlPath },
      {},
      env,
      request
    );
  }

  if (request.method === "GET" && url.pathname === "/admin/reviewers") {
    return jsonResponse({ reviewers: await listReviewers(env) }, {}, env, request);
  }

  const reviewerRoute = parseReviewerRoute(url.pathname);

  if (reviewerRoute && !reviewerRoute.action && request.method === "GET") {
    const reviewer = await getReviewer(env, reviewerRoute.id);
    if (!reviewer) return errorResponse("Reviewer not found", 404, env, request);
    return jsonResponse({ reviewer }, {}, env, request);
  }

  if (reviewerRoute && !reviewerRoute.action && request.method === "PUT") {
    const payload = ReviewerUpdateSchema.parse(await readJson(request));
    const reviewer = await updateReviewer(env, reviewerRoute.id, payload);
    if (!reviewer) return errorResponse("Reviewer not found", 404, env, request);
    return jsonResponse({ reviewer }, {}, env, request);
  }

  if (reviewerRoute && !reviewerRoute.action && request.method === "DELETE") {
    const reviewer = await deactivateReviewer(env, reviewerRoute.id);
    if (!reviewer) return errorResponse("Reviewer not found", 404, env, request);
    return jsonResponse({ reviewer }, {}, env, request);
  }

  if (reviewerRoute?.action === "regenerate-link" && request.method === "POST") {
    const credentials = await createReviewerToken();
    const reviewer = await regenerateReviewerLink(env, reviewerRoute.id, credentials);
    if (!reviewer) return errorResponse("Reviewer not found", 404, env, request);
    return jsonResponse({ reviewer, token: credentials.token, reviewUrlPath: reviewer.reviewUrlPath }, {}, env, request);
  }

  if (request.method === "GET" && url.pathname === "/admin/records") {
    return jsonResponse({ records: await listAllRecords(env), activeBatch: await getActiveBatch(env) }, {}, env, request);
  }

  if (request.method === "GET" && url.pathname === "/admin/aggregates") {
    return jsonResponse({ aggregates: await getAggregates(env), activeBatch: await getActiveBatch(env) }, {}, env, request);
  }

  if (request.method === "PUT" && url.pathname === "/admin/final-decisions") {
    const payload = FinalDecisionUpsertSchema.parse(await readJson(request));
    await saveFinalDecision(env, payload);
    return jsonResponse({ ok: true }, {}, env, request);
  }

  return errorResponse("Admin route not found", 404, env, request);
}

async function handleReviewer(request: Request, env: Env, url: URL): Promise<Response> {
  const authed = await requireReviewer(request, env);
  if (authed instanceof Response) return withCors(authed, env, request);
  const reviewer = authed as AuthedReviewer;

  if (request.method === "GET" && url.pathname === "/reviewer/me") {
    return jsonResponse(
      {
        reviewer,
        subjects: await listSubjects(env),
        databases: await listDatabaseOptions(env),
        currentSession: await getCurrentReviewerSession(env, reviewer.id)
      },
      {},
      env,
      request
    );
  }

  if (request.method === "GET" && url.pathname === "/reviewer/session/current") {
    const detail = await getCurrentReviewerSessionDetail(env, reviewer.id);
    if (!detail) return errorResponse("No review session found", 404, env, request);
    return jsonResponse(
      {
        sessionId: detail.session.id,
        selectedSubjects: detail.session.selectedSubjects,
        selectedDatabaseIds: detail.session.selectedDatabaseIds,
        records: detail.records,
        reviews: detail.reviews
      },
      {},
      env,
      request
    );
  }

  if (request.method === "POST" && url.pathname === "/reviewer/session") {
    const payload = SessionStartSchema.parse(await readJson(request));
    const batch = await getActiveBatch(env);
    if (!batch) return errorResponse("No active import batch", 409, env, request);
    return jsonResponse(
      await createReviewerSession(env, reviewer.id, payload.selectedSubjects, payload.selectedDatabaseIds),
      {},
      env,
      request
    );
  }

  if (request.method === "PUT" && url.pathname === "/reviewer/reviews") {
    const payload = ReviewUpsertSchema.parse(await readJson(request));
    const reviewId = await upsertReview(env, reviewer.id, payload);
    return jsonResponse({ reviewId }, {}, env, request);
  }

  return errorResponse("Reviewer route not found", 404, env, request);
}

function parseReviewerRoute(pathname: string): { id: string; action?: string } | null {
  const match = pathname.match(/^\/admin\/reviewers\/([^/]+)(?:\/([^/]+))?$/);
  if (!match) return null;
  const id = match[1];
  if (!id) return null;
  const action = match[2];
  return {
    id: decodeURIComponent(id),
    action: action ? decodeURIComponent(action) : undefined
  };
}

function withCors(response: Response, env: Env, request: Request): Response {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("origin");
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((item) => item.trim());
  if (origin && allowed.includes(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "origin");
  }
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
