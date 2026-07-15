import type { FinalDecisionUpsert, ImportCommit, ReviewUpsert } from "@az-refresh/shared";
import type { AdminAggregate, DatabaseOption, Reviewer, ReviewerSessionSummary, ReviewSummary } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

type RequestOptions = {
  adminToken?: string;
  reviewerToken?: string;
};

export async function adminValidateImport(adminToken: string, payload: ImportCommit) {
  return apiFetch<{ errors: string[]; warnings: string[]; subjects: string[]; records: unknown[] }>(
    "/admin/import/validate",
    { method: "POST", body: payload },
    { adminToken }
  );
}

export async function adminCommitImport(adminToken: string, payload: ImportCommit) {
  return apiFetch<{ batchId: string }>("/admin/import/commit", { method: "POST", body: payload }, { adminToken });
}

export async function adminCreateReviewer(adminToken: string, name: string, email: string) {
  return apiFetch<{ reviewer: Reviewer; id: string; token: string; reviewUrlPath: string | null }>(
    "/admin/reviewers",
    { method: "POST", body: { name, email } },
    { adminToken }
  );
}

export async function adminGetReviewers(adminToken: string) {
  return apiFetch<{ reviewers: Reviewer[] }>("/admin/reviewers", {}, { adminToken });
}

export async function adminUpdateReviewer(adminToken: string, reviewerId: string, name: string, email: string) {
  return apiFetch<{ reviewer: Reviewer }>(
    `/admin/reviewers/${encodeURIComponent(reviewerId)}`,
    { method: "PUT", body: { name, email } },
    { adminToken }
  );
}

export async function adminDeleteReviewer(adminToken: string, reviewerId: string) {
  return apiFetch<{ reviewer: Reviewer }>(
    `/admin/reviewers/${encodeURIComponent(reviewerId)}`,
    { method: "DELETE" },
    { adminToken }
  );
}

export async function adminRegenerateReviewerLink(adminToken: string, reviewerId: string) {
  return apiFetch<{ reviewer: Reviewer; token: string; reviewUrlPath: string | null }>(
    `/admin/reviewers/${encodeURIComponent(reviewerId)}/regenerate-link`,
    { method: "POST" },
    { adminToken }
  );
}

export async function adminGetAggregates(adminToken: string) {
  return apiFetch<{ aggregates: AdminAggregate[]; activeBatch: { source_workbook_base64: string } | null }>(
    "/admin/aggregates",
    {},
    { adminToken }
  );
}

export async function adminSaveFinalDecision(adminToken: string, payload: FinalDecisionUpsert) {
  return apiFetch<{ ok: true }>("/admin/final-decisions", { method: "PUT", body: payload }, { adminToken });
}

export async function reviewerMe(reviewerToken: string) {
  return apiFetch<{
    reviewer: Reviewer;
    subjects: string[];
    databases: DatabaseOption[];
    currentSession: ReviewerSessionSummary | null;
  }>(
    "/reviewer/me",
    {},
    { reviewerToken }
  );
}

export async function reviewerStartSession(
  reviewerToken: string,
  selectedSubjects: string[],
  selectedDatabaseIds: string[]
) {
  return apiFetch<{ sessionId: string; records: ImportCommit["records"]; reviews: ReviewSummary[] }>(
    "/reviewer/session",
    { method: "POST", body: { selectedSubjects, selectedDatabaseIds } },
    { reviewerToken }
  );
}

export async function reviewerResumeSession(reviewerToken: string) {
  return apiFetch<{
    sessionId: string;
    selectedSubjects: string[];
    selectedDatabaseIds: string[];
    records: ImportCommit["records"];
    reviews: ReviewSummary[];
  }>("/reviewer/session/current", {}, { reviewerToken });
}

export async function reviewerSaveReview(reviewerToken: string, payload: ReviewUpsert) {
  return apiFetch<{ reviewId: string }>("/reviewer/reviews", { method: "PUT", body: payload }, { reviewerToken });
}

async function apiFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  options: RequestOptions = {}
): Promise<T> {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.adminToken) headers.set("authorization", `Bearer ${options.adminToken}`);
  if (options.reviewerToken) headers.set("authorization", `Bearer ${options.reviewerToken}`);
  const response = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed: ${response.status}`);
  return data;
}
