import { getActiveBatch } from "./db";
import type { Env } from "./types";

export type DatabaseAdminSummary = {
  databaseId: string;
  databaseName: string;
  active: boolean;
};

type DatabaseStatusRow = {
  database_id: string;
  database_name: string;
  active: number;
};

export async function listAdminRecords(env: Env): Promise<DatabaseAdminSummary[]> {
  const batch = await getActiveBatch(env);
  if (!batch) return [];
  const rows = await env.DB.prepare(
    `SELECT database_id, database_name, active
     FROM database_records
     WHERE import_batch_id = ?
     ORDER BY database_name`
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
  const row = await env.DB.prepare(
    `SELECT database_id, database_name, active
     FROM database_records
     WHERE import_batch_id = ? AND database_id = ?`
  )
    .bind(batch.id, databaseId)
    .first<DatabaseStatusRow>();
  return row ? statusFromRow(row) : null;
}

function statusFromRow(row: DatabaseStatusRow): DatabaseAdminSummary {
  return {
    databaseId: row.database_id,
    databaseName: row.database_name,
    active: row.active === 1
  };
}
