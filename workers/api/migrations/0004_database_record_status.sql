ALTER TABLE database_records
ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1));

CREATE INDEX idx_database_records_batch_active
ON database_records(import_batch_id, active);
