import type { ResultAdminCreate, ResultAdminUpdate } from "@az-refresh/shared";
import { getActiveBatch } from "./db";
import { listResultAdminAssignmentProgress } from "./resultAdminProgress";
import type { ResultAdminAssignmentProgress } from "./resultAdminProgress";
import type { Env } from "./types";

type TokenCredentials = { token: string; tokenHash: string };

export type ResultAdminSummary = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: string;
  adminReviewUrlPath: string | null;
  assignmentProgress: Omit<ResultAdminAssignmentProgress, "adminId">;
};

type ResultAdminRow = {
  id: string;
  name: string;
  email: string;
  token: string;
  active: number;
  created_at: string;
};

export async function createResultAdmin(
  env: Env,
  payload: ResultAdminCreate,
  credentials: TokenCredentials
): Promise<ResultAdminSummary> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO result_admins (id, name, email, token, token_hash, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)"
  ).bind(id, payload.name, payload.email, credentials.token, credentials.tokenHash, now).run();
  return {
    id,
    name: payload.name,
    email: payload.email,
    active: true,
    createdAt: now,
    adminReviewUrlPath: link(credentials.token),
    assignmentProgress: emptyAssignmentProgress()
  };
}

export async function listResultAdmins(env: Env): Promise<ResultAdminSummary[]> {
  const [admins, progress] = await Promise.all([
    env.DB.prepare(
      "SELECT id, name, email, token, active, created_at FROM result_admins ORDER BY created_at DESC"
    ).all<ResultAdminRow>(),
    listResultAdminAssignmentProgress(env)
  ]);
  const progressByAdmin = new Map(progress.map((item) => [item.adminId, item]));
  return admins.results.map((admin) => fromRow(admin, progressByAdmin.get(admin.id)));
}

export async function getResultAdmin(env: Env, id: string): Promise<ResultAdminSummary | null> {
  const [row, progress] = await Promise.all([
    env.DB.prepare(
      "SELECT id, name, email, token, active, created_at FROM result_admins WHERE id = ?"
    ).bind(id).first<ResultAdminRow>(),
    listResultAdminAssignmentProgress(env)
  ]);
  return row ? fromRow(row, progress.find((item) => item.adminId === id)) : null;
}

export async function updateResultAdmin(
  env: Env,
  id: string,
  payload: ResultAdminUpdate
): Promise<ResultAdminSummary | null> {
  if (!await getResultAdmin(env, id)) return null;
  await env.DB.prepare("UPDATE result_admins SET name = ?, email = ? WHERE id = ?")
    .bind(payload.name, payload.email, id).run();
  return getResultAdmin(env, id);
}

export async function deactivateResultAdmin(env: Env, id: string): Promise<ResultAdminSummary | null> {
  if (!await getResultAdmin(env, id)) return null;
  await env.DB.batch([
    env.DB.prepare("UPDATE result_admins SET active = 0 WHERE id = ?").bind(id),
    env.DB.prepare("DELETE FROM database_admin_assignments WHERE admin_id = ?").bind(id)
  ]);
  return getResultAdmin(env, id);
}

export async function regenerateResultAdminLink(
  env: Env,
  id: string,
  credentials: TokenCredentials
): Promise<ResultAdminSummary | null> {
  if (!await getResultAdmin(env, id)) return null;
  await env.DB.prepare("UPDATE result_admins SET token = ?, token_hash = ?, active = 1 WHERE id = ?")
    .bind(credentials.token, credentials.tokenHash, id).run();
  return getResultAdmin(env, id);
}

export async function updateDatabaseAssignments(env: Env, databaseIds: string[], adminId: string | null): Promise<void> {
  const batch = await getActiveBatch(env);
  if (!batch) throw new AssignmentValidationError("No active import batch");
  const uniqueIds = [...new Set(databaseIds)];
  const placeholders = uniqueIds.map(() => "?").join(",");
  const existing = await env.DB.prepare(
    `SELECT database_id FROM database_records WHERE import_batch_id = ? AND database_id IN (${placeholders})`
  ).bind(batch.id, ...uniqueIds).all<{ database_id: string }>();
  if (existing.results.length !== uniqueIds.length) {
    throw new AssignmentValidationError("One or more databases were not found in the active import batch.");
  }
  if (adminId) {
    const admin = await env.DB.prepare("SELECT id FROM result_admins WHERE id = ? AND active = 1")
      .bind(adminId).first<{ id: string }>();
    if (!admin) throw new AssignmentValidationError("The selected admin is not active.");
  }
  const now = new Date().toISOString();
  const statements = uniqueIds.map((databaseId) => adminId
    ? env.DB.prepare(
      `INSERT INTO database_admin_assignments (import_batch_id, database_id, admin_id, assigned_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(import_batch_id, database_id) DO UPDATE SET admin_id = excluded.admin_id, assigned_at = excluded.assigned_at`
    ).bind(batch.id, databaseId, adminId, now)
    : env.DB.prepare("DELETE FROM database_admin_assignments WHERE import_batch_id = ? AND database_id = ?")
      .bind(batch.id, databaseId));
  await env.DB.batch(statements);
}

export async function listAssignedDatabaseIds(env: Env, adminId: string): Promise<string[]> {
  const batch = await getActiveBatch(env);
  if (!batch) return [];
  const rows = await env.DB.prepare(
    "SELECT database_id FROM database_admin_assignments WHERE import_batch_id = ? AND admin_id = ?"
  ).bind(batch.id, adminId).all<{ database_id: string }>();
  return rows.results.map((row) => row.database_id);
}

export async function isDatabaseAssignedTo(env: Env, adminId: string, databaseId: string): Promise<boolean> {
  const batch = await getActiveBatch(env);
  if (!batch) return false;
  const row = await env.DB.prepare(
    "SELECT 1 AS assigned FROM database_admin_assignments WHERE import_batch_id = ? AND database_id = ? AND admin_id = ?"
  ).bind(batch.id, databaseId, adminId).first<{ assigned: number }>();
  return Boolean(row);
}

export class AssignmentValidationError extends Error {}

function fromRow(row: ResultAdminRow, progress?: ResultAdminAssignmentProgress): ResultAdminSummary {
  const active = row.active === 1;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    active,
    createdAt: row.created_at,
    adminReviewUrlPath: active ? link(row.token) : null,
    assignmentProgress: progress
      ? {
          finalizedCount: progress.finalizedCount,
          totalCount: progress.totalCount,
          updatedAt: progress.updatedAt
        }
      : emptyAssignmentProgress()
  };
}

function emptyAssignmentProgress(): ResultAdminSummary["assignmentProgress"] {
  return { finalizedCount: 0, totalCount: 0, updatedAt: null };
}

function link(token: string): string {
  return `/admin-review/${encodeURIComponent(token)}`;
}
