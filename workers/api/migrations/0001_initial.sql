CREATE TABLE import_batches (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  source_workbook_base64 TEXT NOT NULL DEFAULT '',
  record_count INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE database_records (
  import_batch_id TEXT NOT NULL,
  database_id TEXT NOT NULL,
  database_name TEXT NOT NULL,
  database_url TEXT NOT NULL DEFAULT '',
  original_description_html TEXT NOT NULL DEFAULT '',
  rewritten_description_a_html TEXT NOT NULL DEFAULT '',
  rewritten_description_b_html TEXT NOT NULL DEFAULT '',
  associated_subjects_json TEXT NOT NULL,
  springshare_metadata_json TEXT NOT NULL,
  PRIMARY KEY (import_batch_id, database_id),
  FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE CASCADE
);

CREATE TABLE subjects (
  name TEXT PRIMARY KEY,
  canonical INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE database_subjects (
  import_batch_id TEXT NOT NULL,
  database_id TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  PRIMARY KEY (import_batch_id, database_id, subject_name),
  FOREIGN KEY (import_batch_id, database_id) REFERENCES database_records(import_batch_id, database_id) ON DELETE CASCADE,
  FOREIGN KEY (subject_name) REFERENCES subjects(name) ON DELETE CASCADE
);

CREATE TABLE reviewers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE review_sessions (
  id TEXT PRIMARY KEY,
  reviewer_id TEXT NOT NULL,
  import_batch_id TEXT NOT NULL,
  selected_subjects_json TEXT NOT NULL,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (reviewer_id) REFERENCES reviewers(id),
  FOREIGN KEY (import_batch_id) REFERENCES import_batches(id)
);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  reviewer_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  import_batch_id TEXT NOT NULL,
  database_id TEXT NOT NULL,
  selected_subjects_json TEXT NOT NULL,
  choice TEXT NOT NULL,
  revised_description_html TEXT NOT NULL DEFAULT '',
  comments TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (reviewer_id, import_batch_id, database_id),
  FOREIGN KEY (reviewer_id) REFERENCES reviewers(id),
  FOREIGN KEY (session_id) REFERENCES review_sessions(id),
  FOREIGN KEY (import_batch_id, database_id) REFERENCES database_records(import_batch_id, database_id)
);

CREATE TABLE final_decisions (
  import_batch_id TEXT NOT NULL,
  database_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  selected_review_id TEXT,
  final_description_html TEXT NOT NULL DEFAULT '',
  finalized INTEGER NOT NULL DEFAULT 0,
  finalized_by TEXT,
  finalized_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (import_batch_id, database_id),
  FOREIGN KEY (import_batch_id, database_id) REFERENCES database_records(import_batch_id, database_id),
  FOREIGN KEY (selected_review_id) REFERENCES reviews(id)
);

CREATE INDEX idx_database_subjects_subject ON database_subjects(subject_name);
CREATE INDEX idx_reviews_database ON reviews(import_batch_id, database_id);
CREATE INDEX idx_sessions_reviewer ON review_sessions(reviewer_id);
