-- Add released status to estimates (mirrors job order release / visit completion).
-- Must be in its own migration: PostgreSQL requires the new enum value to be
-- committed before it can be used in UPDATE/INSERT statements.
ALTER TYPE estimate_status ADD VALUE IF NOT EXISTS 'released';
