import {
  DatabaseRecordNameUpdateSchema,
  DatabaseRecordStatusSchema,
  DatabaseAssignmentsUpdateSchema,
  FinalDecisionUpsertSchema,
  ImportCommitSchema,
  ReviewerCreateSchema,
  ReviewerUpdateSchema,
  ResultAdminCreateSchema,
  ResultAdminUpdateSchema,
  ReviewUpsertSchema,
  SessionStartSchema,
  validateImportRecords
} from "@az-refresh/shared";
import { createAccessToken, createReviewerToken, requireAdmin, requireResultAdmin, requireReviewer } from "./auth";
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
  InactiveDatabaseError,
  listDatabaseOptions,
  listReviewers,
  listSubjects,
  regenerateReviewerLink,
  saveFinalDecision,
  updateReviewer,
  upsertReview
} from "./db";
import {
  listAdminRecords,
  listInactiveDatabaseIds,
  updateDatabaseName,
  updateDatabaseStatus
} from "./databaseStatus";
import { errorResponse, jsonResponse, optionsResponse, readJson } from "./http";
import type { AuthedReviewer, Env } from "./types";
import type { AuthedResultAdmin } from "./types";
import {
  AssignmentValidationError,
  createResultAdmin,
  deactivateResultAdmin,
  isDatabaseAssignedTo,
  listAssignedDatabaseIds,
  listResultAdmins,
  regenerateResultAdminLink,
  updateDatabaseAssignments,
  updateResultAdmin
} from "./resultAdmins";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return optionsResponse(env, request);
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") return jsonResponse({ ok: true }, {}, env, request);
      if (url.pathname.startsWith("/admin/")) return await handleAdmin(request, env, url);
      if (url.pathname.startsWith("/result-admin/")) return await handleResultAdmin(request, env, url);
      if (url.pathname.startsWith("/reviewer/")) return await handleReviewer(request, env, url);
      return errorResponse("Not found", 404, env, request);
    } catch (error) {
      if (error instanceof InactiveDatabaseError) {
        return errorResponse(error.message, 409, env, request);
      }
      if (error instanceof AssignmentValidationError) {
        return errorResponse(error.message, 400, env, request);
      }
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

  if (request.method === "POST" && url.pathname === "/admin/result-admins") {
    const payload = ResultAdminCreateSchema.parse(await readJson(request));
    const credentials = await createAccessToken();
    const admin = await createResultAdmin(env, payload, credentials);
    return jsonResponse({ admin, token: credentials.token, adminReviewUrlPath: admin.adminReviewUrlPath }, {}, env, request);
  }

  if (request.method === "GET" && url.pathname === "/admin/result-admins") {
    return jsonResponse({ admins: await listResultAdmins(env) }, {}, env, request);
  }

  const resultAdminRoute = parseResultAdminRoute(url.pathname);
  if (resultAdminRoute && !resultAdminRoute.action && request.method === "PUT") {
    const payload = ResultAdminUpdateSchema.parse(await readJson(request));
    const admin = await updateResultAdmin(env, resultAdminRoute.id, payload);
    if (!admin) return errorResponse("Admin not found", 404, env, request);
    return jsonResponse({ admin }, {}, env, request);
  }
  if (resultAdminRoute && !resultAdminRoute.action && request.method === "DELETE") {
    const admin = await deactivateResultAdmin(env, resultAdminRoute.id);
    if (!admin) return errorResponse("Admin not found", 404, env, request);
    return jsonResponse({ admin }, {}, env, request);
  }
  if (resultAdminRoute?.action === "regenerate-link" && request.method === "POST") {
    const credentials = await createAccessToken();
    const admin = await regenerateResultAdminLink(env, resultAdminRoute.id, credentials);
    if (!admin) return errorResponse("Admin not found", 404, env, request);
    return jsonResponse({ admin, token: credentials.token, adminReviewUrlPath: admin.adminReviewUrlPath }, {}, env, request);
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
    return jsonResponse({ records: await listAdminRecords(env), activeBatch: await getActiveBatch(env) }, {}, env, request);
  }

  if (request.method === "PUT" && url.pathname === "/admin/records/assignments") {
    const payload = DatabaseAssignmentsUpdateSchema.parse(await readJson(request));
    await updateDatabaseAssignments(env, payload.databaseIds, payload.adminId);
    return jsonResponse({ records: await listAdminRecords(env) }, {}, env, request);
  }

  const databaseStatusRoute = parseDatabaseStatusRoute(url.pathname);
  if (databaseStatusRoute && request.method === "PUT") {
    const payload = DatabaseRecordStatusSchema.parse(await readJson(request));
    const record = await updateDatabaseStatus(env, databaseStatusRoute.id, payload.active);
    if (!record) return errorResponse("Database not found in the active import batch", 404, env, request);
    return jsonResponse({ record }, {}, env, request);
  }

  const databaseNameRoute = parseDatabaseNameRoute(url.pathname);
  if (databaseNameRoute && request.method === "PUT") {
    const payload = DatabaseRecordNameUpdateSchema.parse(await readJson(request));
    const record = await updateDatabaseName(env, databaseNameRoute.id, payload.databaseName);
    if (!record) return errorResponse("Database not found in the active import batch", 404, env, request);
    return jsonResponse({ record }, {}, env, request);
  }

  if (request.method === "GET" && url.pathname === "/admin/aggregates") {
    return jsonResponse(
      {
        aggregates: await getAggregates(env),
        activeBatch: await getActiveBatch(env),
        inactiveDatabaseIds: await listInactiveDatabaseIds(env)
      },
      {},
      env,
      request
    );
  }

  if (request.method === "PUT" && url.pathname === "/admin/final-decisions") {
    const payload = FinalDecisionUpsertSchema.parse(await readJson(request));
    await saveFinalDecision(env, payload);
    return jsonResponse({ ok: true }, {}, env, request);
  }

  return errorResponse("Admin route not found", 404, env, request);
}

async function handleResultAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  const authed = await requireResultAdmin(request, env);
  if (authed instanceof Response) return withCors(authed, env, request);
  const admin = authed as AuthedResultAdmin;

  if (request.method === "GET" && url.pathname === "/result-admin/me") {
    return jsonResponse({ admin }, {}, env, request);
  }
  if (request.method === "GET" && url.pathname === "/result-admin/aggregates") {
    const assignedIds = new Set(await listAssignedDatabaseIds(env, admin.id));
    const aggregates = (await getAggregates(env)).filter((item) => assignedIds.has(item.record.databaseId));
    return jsonResponse({ aggregates }, {}, env, request);
  }
  if (request.method === "PUT" && url.pathname === "/result-admin/final-decisions") {
    const payload = FinalDecisionUpsertSchema.parse(await readJson(request));
    if (!await isDatabaseAssignedTo(env, admin.id, payload.databaseId)) {
      return errorResponse("This database is not assigned to you.", 403, env, request);
    }
    await saveFinalDecision(env, payload, `result-admin:${admin.id}`);
    return jsonResponse({ ok: true }, {}, env, request);
  }
  return errorResponse("Admin review route not found", 404, env, request);
}

async function handleReviewer(request: Request, env: Env, url: URL): Promise<Response> {
  const authed = await requireReviewer(request, env);
  if (authed instanceof Response) return withCors(authed, env, request);
  const reviewer = authed as AuthedReviewer;

  if (request.method === "GET" && url.pathname === "/reviewer/me") {
    const databases = await listDatabaseOptions(env);
    const currentSession = await getCurrentReviewerSession(env, reviewer.id);
    const activeDatabaseIds = new Set(databases.map((database) => database.databaseId));
    return jsonResponse(
      {
        reviewer,
        subjects: await listSubjects(env),
        databases,
        currentSession: currentSession
          ? {
              ...currentSession,
              selectedDatabaseIds: currentSession.selectedDatabaseIds.filter((id) => activeDatabaseIds.has(id))
            }
          : null
      },
      {},
      env,
      request
    );
  }

  if (request.method === "GET" && url.pathname === "/reviewer/session/current") {
    const detail = await getCurrentReviewerSessionDetail(env, reviewer.id);
    if (!detail) return errorResponse("No review session found", 404, env, request);
    const activeDatabaseIds = new Set((await listDatabaseOptions(env)).map((database) => database.databaseId));
    return jsonResponse(
      {
        sessionId: detail.session.id,
        selectedSubjects: detail.session.selectedSubjects,
        selectedDatabaseIds: detail.session.selectedDatabaseIds.filter((id) => activeDatabaseIds.has(id)),
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

function parseResultAdminRoute(pathname: string): { id: string; action?: string } | null {
  const match = pathname.match(/^\/admin\/result-admins\/([^/]+)(?:\/([^/]+))?$/);
  const id = match?.[1];
  if (!id) return null;
  return {
    id: decodeURIComponent(id),
    action: match?.[2] ? decodeURIComponent(match[2]) : undefined
  };
}

function parseDatabaseStatusRoute(pathname: string): { id: string } | null {
  const match = pathname.match(/^\/admin\/records\/([^/]+)\/status$/);
  const id = match?.[1];
  return id ? { id: decodeURIComponent(id) } : null;
}

function parseDatabaseNameRoute(pathname: string): { id: string } | null {
  const match = pathname.match(/^\/admin\/records\/([^/]+)\/name$/);
  const id = match?.[1];
  return id ? { id: decodeURIComponent(id) } : null;
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
