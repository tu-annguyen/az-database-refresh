CREATE TABLE result_admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE database_admin_assignments (
  import_batch_id TEXT NOT NULL,
  database_id TEXT NOT NULL,
  admin_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (import_batch_id, database_id),
  FOREIGN KEY (import_batch_id, database_id)
    REFERENCES database_records(import_batch_id, database_id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES result_admins(id)
);

CREATE INDEX idx_database_admin_assignments_admin
ON database_admin_assignments(admin_id, import_batch_id);
