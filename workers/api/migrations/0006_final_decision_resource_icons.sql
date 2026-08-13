ALTER TABLE final_decisions
ADD COLUMN artificial_intelligence_icon INTEGER NOT NULL DEFAULT 0 CHECK (artificial_intelligence_icon IN (0, 1));
