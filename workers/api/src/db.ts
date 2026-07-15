import type { DatabaseRecord, FinalDecisionUpsert, ImportCommit, ReviewerCreate, ReviewerUpdate, ReviewUpsert } from "@az-refresh/shared";
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

type ReviewerTokenCredentials = {
  token: string;
  tokenHash: string;
};

export type ReviewerAdminSummary = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: string;
  reviewUrlPath: string | null;
};

export async function createReviewer(
  env: Env,
  payload: ReviewerCreate,
  credentials: ReviewerTokenCredentials
): Promise<ReviewerAdminSummary> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO reviewers (id, name, email, token, token_hash, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)"
  )
    .bind(id, payload.name, payload.email, credentials.token, credentials.tokenHash, now)
    .run();
  return {
    id,
    name: payload.name,
    email: payload.email,
    active: true,
    createdAt: now,
    reviewUrlPath: reviewUrlPath(credentials.token)
  };
}

export async function listReviewers(env: Env): Promise<ReviewerAdminSummary[]> {
  const reviewers = await env.DB.prepare(
    "SELECT id, name, email, token, active, created_at FROM reviewers ORDER BY created_at DESC"
  ).all<ReviewerRow>();
  return reviewers.results.map(reviewerFromRow);
}

export async function getReviewer(env: Env, reviewerId: string): Promise<ReviewerAdminSummary | null> {
  const reviewer = await env.DB.prepare(
    "SELECT id, name, email, token, active, created_at FROM reviewers WHERE id = ?"
  )
    .bind(reviewerId)
    .first<ReviewerRow>();
  return reviewer ? reviewerFromRow(reviewer) : null;
}

export async function updateReviewer(
  env: Env,
  reviewerId: string,
  payload: ReviewerUpdate
): Promise<ReviewerAdminSummary | null> {
  const existing = await getReviewer(env, reviewerId);
  if (!existing) return null;
  await env.DB.prepare("UPDATE reviewers SET name = ?, email = ? WHERE id = ?")
    .bind(payload.name, payload.email, reviewerId)
    .run();
  return await getReviewer(env, reviewerId);
}

export async function deactivateReviewer(env: Env, reviewerId: string): Promise<ReviewerAdminSummary | null> {
  const existing = await getReviewer(env, reviewerId);
  if (!existing) return null;
  await env.DB.prepare("UPDATE reviewers SET active = 0 WHERE id = ?").bind(reviewerId).run();
  return await getReviewer(env, reviewerId);
}

export async function regenerateReviewerLink(
  env: Env,
  reviewerId: string,
  credentials: ReviewerTokenCredentials
): Promise<ReviewerAdminSummary | null> {
  const existing = await getReviewer(env, reviewerId);
  if (!existing) return null;
  await env.DB.prepare("UPDATE reviewers SET token = ?, token_hash = ?, active = 1 WHERE id = ?")
    .bind(credentials.token, credentials.tokenHash, reviewerId)
    .run();
  return await getReviewer(env, reviewerId);
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

export async function listAllRecords(env: Env): Promise<DatabaseRecord[]> {
  const batch = await getActiveBatch(env);
  if (!batch) return [];
  const rows = await env.DB.prepare("SELECT * FROM database_records WHERE import_batch_id = ? ORDER BY database_name")
    .bind(batch.id)
    .all<RecordRow>();
  return rows.results.map(recordFromRow);
}

export async function listDatabaseOptions(env: Env): Promise<Array<{ databaseId: string; databaseName: string }>> {
  const batch = await getActiveBatch(env);
  if (!batch) return [];
  const rows = await env.DB.prepare(
    "SELECT database_id, database_name FROM database_records WHERE import_batch_id = ? ORDER BY database_name"
  )
    .bind(batch.id)
    .all<{ database_id: string; database_name: string }>();
  return rows.results.map((row) => ({ databaseId: row.database_id, databaseName: row.database_name }));
}

export async function listRecordsForSelection(
  env: Env,
  subjects: string[],
  databaseIds: string[]
): Promise<DatabaseRecord[]> {
  const batch = await getActiveBatch(env);
  if (!batch) return [];
  const conditions: string[] = [];
  const bindings: string[] = [batch.id];
  if (subjects.length) {
    conditions.push(
      `EXISTS (
        SELECT 1 FROM database_subjects ds
        WHERE ds.import_batch_id = r.import_batch_id
          AND ds.database_id = r.database_id
          AND ds.subject_name IN (${subjects.map(() => "?").join(",")})
      )`
    );
    bindings.push(...subjects);
  }
  if (databaseIds.length) {
    conditions.push(`r.database_id IN (${databaseIds.map(() => "?").join(",")})`);
    bindings.push(...databaseIds);
  }
  if (!conditions.length) return [];
  const rows = await env.DB.prepare(
    `SELECT r.* FROM database_records r
     WHERE r.import_batch_id = ? AND (${conditions.join(" OR ")})
     ORDER BY r.database_name`
  )
    .bind(...bindings)
    .all<RecordRow>();
  return rows.results.map(recordFromRow);
}

export async function getCurrentReviewerSession(env: Env, reviewerId: string) {
  const batch = await getActiveBatch(env);
  if (!batch) return null;
  const row = await env.DB.prepare(
    `SELECT s.id, s.selected_subjects_json, s.selected_database_ids_json, s.started_at, s.updated_at,
            COUNT(r.id) AS review_count
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
  const records = await listRecordsForSelection(env, session.selectedSubjects, session.selectedDatabaseIds);
  const reviews = await listReviewsForSession(env, session.id);
  return { session, records, reviews };
}

export async function createReviewerSession(
  env: Env,
  reviewerId: string,
  selectedSubjects: string[],
  selectedDatabaseIds: string[]
) {
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
        id, reviewer_id, import_batch_id, selected_subjects_json, selected_database_ids_json, started_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, reviewerId, batch.id, JSON.stringify(selectedSubjects), JSON.stringify(selectedDatabaseIds), now, now)
  ]);
  const records = await listRecordsForSelection(env, selectedSubjects, selectedDatabaseIds);
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
  const reviewRows = await env.DB.prepare(
    `SELECT r.*, v.name AS reviewer_name, v.email AS reviewer_email
     FROM reviews r
     JOIN reviewers v ON v.id = r.reviewer_id
     WHERE r.import_batch_id = ?
     ORDER BY r.updated_at DESC`
  )
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
  reviewer_name?: string;
  reviewer_email?: string;
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
  selected_database_ids_json: string;
  started_at: string;
  updated_at: string;
  review_count: number;
};

type ReviewerRow = {
  id: string;
  name: string;
  email: string;
  token: string | null;
  active: number;
  created_at: string;
};

function reviewerFromRow(row: ReviewerRow): ReviewerAdminSummary {
  const active = row.active === 1;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    active,
    createdAt: row.created_at,
    reviewUrlPath: active ? reviewUrlPath(row.token) : null
  };
}

function reviewUrlPath(token: string | null | undefined): string | null {
  return token ? `/review/${encodeURIComponent(token)}` : null;
}

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
    reviewerName: row.reviewer_name ?? "",
    reviewerEmail: row.reviewer_email ?? "",
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
    selectedDatabaseIds: JSON.parse(row.selected_database_ids_json) as string[],
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    reviewCount: row.review_count
  };
}
