import { getActiveBatch } from "./db";
import type { Env } from "./types";

export type DatabaseAdminSummary = {
  databaseId: string;
  databaseName: string;
  active: boolean;
  voteCount: number;
  assignedAdminId: string | null;
  assignedAdminName: string | null;
};

type DatabaseStatusRow = {
  database_id: string;
  database_name: string;
  active: number;
  vote_count: number;
  assigned_admin_id: string | null;
  assigned_admin_name: string | null;
};

export async function listAdminRecords(env: Env): Promise<DatabaseAdminSummary[]> {
  const batch = await getActiveBatch(env);
  if (!batch) return [];
  const rows = await env.DB.prepare(
    `SELECT d.database_id, d.database_name, d.active,
            COUNT(DISTINCT r.id) AS vote_count,
            a.admin_id AS assigned_admin_id,
            ra.name AS assigned_admin_name
     FROM database_records d
     LEFT JOIN reviews r ON r.import_batch_id = d.import_batch_id AND r.database_id = d.database_id
     LEFT JOIN database_admin_assignments a
       ON a.import_batch_id = d.import_batch_id AND a.database_id = d.database_id
     LEFT JOIN result_admins ra ON ra.id = a.admin_id
     WHERE d.import_batch_id = ?
     GROUP BY d.database_id, d.database_name, d.active, a.admin_id, ra.name
     ORDER BY d.database_name`
  )
    .bind(batch.id)
    .all<DatabaseStatusRow>();
  return rows.results.map(statusFromRow);
}

export async function listInactiveDatabaseIds(env: Env): Promise<string[]> {
  const records = await listAdminRecords(env);
  return records.filter((record) => !record.active).map((record) => record.databaseId);
}

export async function updateDatabaseStatus(
  env: Env,
  databaseId: string,
  active: boolean
): Promise<DatabaseAdminSummary | null> {
  const batch = await getActiveBatch(env);
  if (!batch) return null;
  await env.DB.prepare(
    "UPDATE database_records SET active = ? WHERE import_batch_id = ? AND database_id = ?"
  )
    .bind(active ? 1 : 0, batch.id, databaseId)
    .run();
  return getAdminRecord(env, batch.id, databaseId);
}

export async function updateDatabaseName(
  env: Env,
  databaseId: string,
  databaseName: string
): Promise<DatabaseAdminSummary | null> {
  const batch = await getActiveBatch(env);
  if (!batch) return null;
  await env.DB.prepare(
    "UPDATE database_records SET database_name = ? WHERE import_batch_id = ? AND database_id = ?"
  )
    .bind(databaseName, batch.id, databaseId)
    .run();
  return getAdminRecord(env, batch.id, databaseId);
}

async function getAdminRecord(env: Env, batchId: string, databaseId: string): Promise<DatabaseAdminSummary | null> {
  const row = await env.DB.prepare(
    `SELECT d.database_id, d.database_name, d.active,
            COUNT(DISTINCT r.id) AS vote_count,
            a.admin_id AS assigned_admin_id,
            ra.name AS assigned_admin_name
     FROM database_records d
     LEFT JOIN reviews r ON r.import_batch_id = d.import_batch_id AND r.database_id = d.database_id
     LEFT JOIN database_admin_assignments a
       ON a.import_batch_id = d.import_batch_id AND a.database_id = d.database_id
     LEFT JOIN result_admins ra ON ra.id = a.admin_id
     WHERE d.import_batch_id = ? AND d.database_id = ?
     GROUP BY d.database_id, d.database_name, d.active, a.admin_id, ra.name`
  ).bind(batchId, databaseId).first<DatabaseStatusRow>();
  return row ? statusFromRow(row) : null;
}

function statusFromRow(row: DatabaseStatusRow): DatabaseAdminSummary {
  return {
    databaseId: row.database_id,
    databaseName: row.database_name,
    active: row.active === 1,
    voteCount: Number(row.vote_count),
    assignedAdminId: row.assigned_admin_id,
    assignedAdminName: row.assigned_admin_name
  };
}
