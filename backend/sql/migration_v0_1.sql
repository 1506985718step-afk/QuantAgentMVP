
-- Migration: Align with QuantAgent Constitution v0.1
-- Run this if you have an existing DB.

BEGIN;

-- 1. Episodes Changes
-- Ensure mode exists and has constraint
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS mode VARCHAR(16) DEFAULT 'sim' NOT NULL;
DO $$ BEGIN
    ALTER TABLE episodes ADD CONSTRAINT chk_episodes_mode CHECK (mode IN ('sim', 'paper', 'live'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Split PnL
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS pnl_amount NUMERIC(20, 4) DEFAULT 0;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS pnl_rate NUMERIC(10, 6) DEFAULT 0;

-- Migrate old data if 'pnl' exists (Best effort assumption: old pnl was amount)
DO $$
BEGIN
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='episodes' AND column_name='pnl') THEN
        UPDATE episodes SET pnl_amount = pnl WHERE pnl_amount = 0;
    END IF;
END $$;

-- 2. Steps Changes
ALTER TABLE steps ADD COLUMN IF NOT EXISTS violations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE steps ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Ensure constraints
DO $$ BEGIN
    ALTER TABLE steps ADD CONSTRAINT chk_step_index_positive CHECK (step_index >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_episodes_modtime ON episodes;
CREATE TRIGGER update_episodes_modtime
    BEFORE UPDATE ON episodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;
