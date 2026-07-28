import type { Env } from "./types";

export type ReviewerSessionProgress = {
  id: string;
  startedAt: string;
  updatedAt: string;
  reviewCount: number;
  totalCount: number;
};

export type ReviewerSessionProgressWithReviewer = ReviewerSessionProgress & {
  reviewerId: string;
};

type SessionProgressRow = {
  reviewer_id: string;
  id: string;
  started_at: string;
  updated_at: string;
  review_count: number;
  total_count: number;
};

export async function listLatestReviewerSessionProgress(
  env: Env
): Promise<ReviewerSessionProgressWithReviewer[]> {
  const rows = await env.DB.prepare(latestSessionProgressSql()).all<SessionProgressRow>();
  return rows.results.map(sessionProgressFromRow);
}

export async function getLatestReviewerSessionProgress(
  env: Env,
  reviewerId: string
): Promise<ReviewerSessionProgress | null> {
  const row = await env.DB.prepare(latestSessionProgressSql("WHERE reviewer_id = ?"))
    .bind(reviewerId)
    .first<SessionProgressRow>();
  return row ? sessionProgressFromRow(row) : null;
}

function latestSessionProgressSql(filter = ""): string {
  return `WITH ranked_sessions AS (
      SELECT review_sessions.*,
             ROW_NUMBER() OVER (PARTITION BY reviewer_id ORDER BY updated_at DESC, started_at DESC) AS session_rank
      FROM review_sessions
      ${filter}
    )
    SELECT s.reviewer_id, s.id, s.started_at, s.updated_at,
           (
             SELECT COUNT(*)
             FROM reviews r
             JOIN database_records d
               ON d.import_batch_id = r.import_batch_id
              AND d.database_id = r.database_id
              AND d.active = 1
             WHERE r.session_id = s.id
           ) AS review_count,
           (
             SELECT COUNT(*)
             FROM database_records d
             WHERE d.import_batch_id = s.import_batch_id
               AND d.active = 1
               AND (
                 EXISTS (
                   SELECT 1
                   FROM database_subjects ds
                   JOIN json_each(s.selected_subjects_json) selected_subject
                     ON selected_subject.value = ds.subject_name
                   WHERE ds.import_batch_id = d.import_batch_id
                     AND ds.database_id = d.database_id
                 )
                 OR EXISTS (
                   SELECT 1
                   FROM json_each(s.selected_database_ids_json) selected_database
                   WHERE selected_database.value = d.database_id
                 )
               )
           ) AS total_count
    FROM ranked_sessions s
    WHERE s.session_rank = 1`;
}

function sessionProgressFromRow(row: SessionProgressRow): ReviewerSessionProgressWithReviewer {
  return {
    reviewerId: row.reviewer_id,
    id: row.id,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    reviewCount: row.review_count,
    totalCount: row.total_count
  };
}
