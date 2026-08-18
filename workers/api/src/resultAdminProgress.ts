import type { Env } from "./types";

export type ResultAdminAssignmentProgress = {
  adminId: string;
  finalizedCount: number;
  totalCount: number;
  updatedAt: string | null;
};

type AssignmentProgressRow = {
  admin_id: string;
  finalized_count: number;
  total_count: number;
  updated_at: string | null;
};

export async function listResultAdminAssignmentProgress(
  env: Env
): Promise<ResultAdminAssignmentProgress[]> {
  const rows = await env.DB.prepare(
    `SELECT a.admin_id,
            SUM(CASE WHEN f.finalized = 1 THEN 1 ELSE 0 END) AS finalized_count,
            COUNT(*) AS total_count,
            MAX(
              CASE WHEN f.updated_at > a.assigned_at THEN f.updated_at ELSE a.assigned_at END
            ) AS updated_at
     FROM database_admin_assignments a
     JOIN import_batches b ON b.id = a.import_batch_id AND b.active = 1
     JOIN database_records d
       ON d.import_batch_id = a.import_batch_id
      AND d.database_id = a.database_id
      AND d.active = 1
     LEFT JOIN final_decisions f
       ON f.import_batch_id = a.import_batch_id
      AND f.database_id = a.database_id
     GROUP BY a.admin_id`
  ).all<AssignmentProgressRow>();
  return rows.results.map(assignmentProgressFromRow);
}

function assignmentProgressFromRow(row: AssignmentProgressRow): ResultAdminAssignmentProgress {
  return {
    adminId: row.admin_id,
    finalizedCount: Number(row.finalized_count),
    totalCount: Number(row.total_count),
    updatedAt: row.updated_at
  };
}
