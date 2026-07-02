import type { DatabaseRecord, FinalDecisionUpsert, ImportCommit, ReviewUpsert } from "@az-refresh/shared";
import { CANONICAL_SUBJECTS, deriveSubjects } from "@az-refresh/shared";
import type { Env } from "./types";

export async function getActiveBatch(env: Env) {
  return env.DB.prepare("SELECT * FROM import_batches WHERE active = 1 ORDER BY created_at DESC LIMIT 1").first<{
    id: string;
    filename: string;
    source_workbook_base64: string;
    record_count: number;
    created_at: string;
  }>();
}

export async function commitImport(env: Env, payload: ImportCommit): Promise<string> {
  const batchId = crypto.randomUUID();
  const now = new Date().toISOString();
  const subjects = new Set([...CANONICAL_SUBJECTS, ...deriveSubjects(payload.records)]);

  const statements: D1PreparedStatement[] = [
    env.DB.prepare("UPDATE import_batches SET active = 0"),
    env.DB.prepare(
      "INSERT INTO import_batches (id, filename, source_workbook_base64, record_count, active, created_at) VALUES (?, ?, ?, ?, 1, ?)"
    ).bind(batchId, payload.filename, payload.sourceWorkbookBase64, payload.records.length, now)
  ];

  for (const subject of subjects) {
    statements.push(
      env.DB.prepare("INSERT OR IGNORE INTO subjects (name, canonical, created_at) VALUES (?, ?, ?)").bind(
        subject,
        CANONICAL_SUBJECTS.includes(subject as never) ? 1 : 0,
        now
      )
    );
  }

  for (const record of payload.records) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO database_records (
          import_batch_id, database_id, database_name, database_url, original_description_html,
          rewritten_description_a_html, rewritten_description_b_html, associated_subjects_json,
          springshare_metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        batchId,
        record.databaseId,
        record.databaseName,
        record.databaseUrl,
        record.originalDescriptionHtml,
        record.rewrittenDescriptionAHtml,
        record.rewrittenDescriptionBHtml,
        JSON.stringify(record.associatedSubjects),
        JSON.stringify(record.springshareMetadata)
      )
    );
    for (const subject of record.associatedSubjects) {
      statements.push(
        env.DB.prepare(
          "INSERT INTO database_subjects (import_batch_id, database_id, subject_name) VALUES (?, ?, ?)"
        ).bind(batchId, record.databaseId, subject)
      );
    }
  }

  await env.DB.batch(statements);
  return batchId;
}

export async function listSubjects(env: Env): Promise<string[]> {
  const rows = await env.DB.prepare("SELECT name FROM subjects ORDER BY name").all<{ name: string }>();
  return rows.results.map((row) => row.name);
}

export async function listRecordsForSubjects(env: Env, subjects: string[]): Promise<DatabaseRecord[]> {
  const batch = await getActiveBatch(env);
  if (!batch) return [];
  const placeholders = subjects.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT DISTINCT r.* FROM database_records r
     JOIN database_subjects ds ON ds.import_batch_id = r.import_batch_id AND ds.database_id = r.database_id
     WHERE r.import_batch_id = ? AND ds.subject_name IN (${placeholders})
     ORDER BY r.database_name`
  )
    .bind(batch.id, ...subjects)
    .all<RecordRow>();
  return rows.results.map(recordFromRow);
}

export async function listAllRecords(env: Env): Promise<DatabaseRecord[]> {
  const batch = await getActiveBatch(env);
  if (!batch) return [];
  const rows = await env.DB.prepare("SELECT * FROM database_records WHERE import_batch_id = ? ORDER BY database_name")
    .bind(batch.id)
    .all<RecordRow>();
  return rows.results.map(recordFromRow);
}

export async function getCurrentReviewerSession(env: Env, reviewerId: string) {
  const batch = await getActiveBatch(env);
  if (!batch) return null;
  const row = await env.DB.prepare(
    `SELECT s.id, s.selected_subjects_json, s.started_at, s.updated_at, COUNT(r.id) AS review_count
     FROM review_sessions s
     LEFT JOIN reviews r ON r.session_id = s.id
     WHERE s.reviewer_id = ? AND s.import_batch_id = ?
     GROUP BY s.id
     ORDER BY s.updated_at DESC
     LIMIT 1`
  )
    .bind(reviewerId, batch.id)
    .first<SessionRow>();
  return row ? sessionFromRow(row) : null;
}

export async function getCurrentReviewerSessionDetail(env: Env, reviewerId: string) {
  const session = await getCurrentReviewerSession(env, reviewerId);
  if (!session) return null;
  const records = await listRecordsForSubjects(env, session.selectedSubjects);
  const reviews = await listReviewsForSession(env, session.id);
  return { session, records, reviews };
}

export async function createReviewerSession(env: Env, reviewerId: string, selectedSubjects: string[]) {
  const batch = await getActiveBatch(env);
  if (!batch) throw new Error("No active import batch");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE final_decisions
       SET selected_review_id = NULL, updated_at = ?
       WHERE import_batch_id = ?
       AND selected_review_id IN (
         SELECT id FROM reviews WHERE reviewer_id = ? AND import_batch_id = ?
       )`
    ).bind(now, batch.id, reviewerId, batch.id),
    env.DB.prepare("DELETE FROM reviews WHERE reviewer_id = ? AND import_batch_id = ?").bind(reviewerId, batch.id),
    env.DB.prepare("DELETE FROM review_sessions WHERE reviewer_id = ? AND import_batch_id = ?").bind(reviewerId, batch.id),
    env.DB.prepare(
      `INSERT INTO review_sessions (
        id, reviewer_id, import_batch_id, selected_subjects_json, started_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, reviewerId, batch.id, JSON.stringify(selectedSubjects), now, now)
  ]);
  const records = await listRecordsForSubjects(env, selectedSubjects);
  return { sessionId: id, records, reviews: [] };
}

export async function upsertReview(env: Env, reviewerId: string, payload: ReviewUpsert): Promise<string> {
  const batch = await getActiveBatch(env);
  if (!batch) throw new Error("No active import batch");
  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    "SELECT id, created_at FROM reviews WHERE reviewer_id = ? AND import_batch_id = ? AND database_id = ?"
  )
    .bind(reviewerId, batch.id, payload.databaseId)
    .first<{ id: string; created_at: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO reviews (
      id, reviewer_id, session_id, import_batch_id, database_id, selected_subjects_json, choice,
      revised_description_html, comments, updated_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      reviewerId,
      payload.sessionId,
      batch.id,
      payload.databaseId,
      JSON.stringify(payload.selectedSubjects),
      payload.choice,
      payload.revisedDescriptionHtml,
      payload.comments,
      now,
      existing?.created_at ?? now
    )
    .run();
  await env.DB.prepare("UPDATE review_sessions SET updated_at = ? WHERE id = ?").bind(now, payload.sessionId).run();
  return id;
}

export async function saveFinalDecision(env: Env, payload: FinalDecisionUpsert): Promise<void> {
  const batch = await getActiveBatch(env);
  if (!batch) throw new Error("No active import batch");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO final_decisions (
      import_batch_id, database_id, decision, selected_review_id, final_description_html,
      finalized, finalized_by, finalized_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      batch.id,
      payload.databaseId,
      payload.decision,
      payload.selectedReviewId ?? null,
      payload.finalDescriptionHtml,
      payload.finalized ? 1 : 0,
      payload.finalized ? "admin" : null,
      payload.finalized ? now : null,
      now
    )
    .run();
}

export async function getAggregates(env: Env) {
  const batch = await getActiveBatch(env);
  if (!batch) return [];
  const records = await listAllRecords(env);
  const reviewRows = await env.DB.prepare("SELECT * FROM reviews WHERE import_batch_id = ? ORDER BY updated_at DESC")
    .bind(batch.id)
    .all<ReviewRow>();
  const decisionRows = await env.DB.prepare("SELECT * FROM final_decisions WHERE import_batch_id = ?")
    .bind(batch.id)
    .all<DecisionRow>();
  const decisions = new Map(decisionRows.results.map((row) => [row.database_id, decisionFromRow(row)]));
  const reviewsByDatabase = new Map<string, ReturnType<typeof reviewFromRow>[]>();
  for (const row of reviewRows.results) {
    const review = reviewFromRow(row);
    const current = reviewsByDatabase.get(row.database_id) ?? [];
    current.push(review);
    reviewsByDatabase.set(row.database_id, current);
  }
  return records.map((record) => {
    const reviews = reviewsByDatabase.get(record.databaseId) ?? [];
    const votes = {
      original: 0,
      rewritten_a: 0,
      rewritten_b: 0,
      edited: 0,
      needs_follow_up: 0
    };
    reviews.forEach((review) => {
      votes[review.choice] += 1;
    });
    return {
      record,
      votes,
      reviews,
      finalDecision: decisions.get(record.databaseId) ?? null,
      completionStatus: reviews.length > 0 ? "reviewed" : "unreviewed"
    };
  });
}

async function listReviewsForSession(env: Env, sessionId: string) {
  const rows = await env.DB.prepare("SELECT * FROM reviews WHERE session_id = ? ORDER BY updated_at DESC")
    .bind(sessionId)
    .all<ReviewRow>();
  return rows.results.map(reviewFromRow);
}

type RecordRow = {
  database_id: string;
  database_name: string;
  database_url: string;
  original_description_html: string;
  rewritten_description_a_html: string;
  rewritten_description_b_html: string;
  associated_subjects_json: string;
  springshare_metadata_json: string;
};

type ReviewRow = {
  id: string;
  reviewer_id: string;
  session_id: string;
  database_id: string;
  selected_subjects_json: string;
  choice: "original" | "rewritten_a" | "rewritten_b" | "edited" | "needs_follow_up";
  revised_description_html: string;
  comments: string;
  updated_at: string;
  created_at: string;
};

type DecisionRow = {
  database_id: string;
  decision: "use_original" | "use_rewritten_a" | "use_rewritten_b" | "use_faculty_revision" | "custom_final" | "hold";
  selected_review_id: string | null;
  final_description_html: string;
  finalized: number;
  finalized_at: string | null;
  updated_at: string;
};

type SessionRow = {
  id: string;
  selected_subjects_json: string;
  started_at: string;
  updated_at: string;
  review_count: number;
};

function recordFromRow(row: RecordRow): DatabaseRecord {
  return {
    databaseId: row.database_id,
    databaseName: row.database_name,
    databaseUrl: row.database_url,
    originalDescriptionHtml: row.original_description_html,
    rewrittenDescriptionAHtml: row.rewritten_description_a_html,
    rewrittenDescriptionBHtml: row.rewritten_description_b_html,
    associatedSubjects: JSON.parse(row.associated_subjects_json) as string[],
    springshareMetadata: JSON.parse(row.springshare_metadata_json) as Record<string, unknown>
  };
}

function reviewFromRow(row: ReviewRow) {
  return {
    id: row.id,
    reviewerId: row.reviewer_id,
    sessionId: row.session_id,
    databaseId: row.database_id,
    selectedSubjects: JSON.parse(row.selected_subjects_json) as string[],
    choice: row.choice,
    revisedDescriptionHtml: row.revised_description_html,
    comments: row.comments,
    updatedAt: row.updated_at,
    createdAt: row.created_at
  };
}

function decisionFromRow(row: DecisionRow) {
  return {
    databaseId: row.database_id,
    decision: row.decision,
    selectedReviewId: row.selected_review_id,
    finalDescriptionHtml: row.final_description_html,
    finalized: row.finalized === 1,
    finalizedAt: row.finalized_at,
    updatedAt: row.updated_at
  };
}

function sessionFromRow(row: SessionRow) {
  return {
    id: row.id,
    selectedSubjects: JSON.parse(row.selected_subjects_json) as string[],
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    reviewCount: row.review_count
  };
}
