ALTER TABLE reviewers ADD COLUMN token TEXT;

CREATE UNIQUE INDEX idx_reviewers_token ON reviewers(token);
