
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function for auto-updating timestamps (Trigger Function)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Episodes Table (Settlement Unit)
CREATE TABLE IF NOT EXISTS episodes (
    episode_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(64) NOT NULL,
    trade_day DATE NOT NULL,
    
    -- Constitution §2.1: Mode is mandatory and strict
    mode VARCHAR(16) NOT NULL CHECK (mode IN ('sim', 'paper', 'live')),
    
    -- Traceability
    policy_version VARCHAR(128) NOT NULL,
    
    -- Financials (PnL Split for precision, avoid ambiguous percentages)
    initial_equity NUMERIC(20, 4) NOT NULL,
    final_equity NUMERIC(20, 4),
    pnl_amount NUMERIC(20, 4) DEFAULT 0, -- Absolute value (e.g. +500.00)
    pnl_rate NUMERIC(10, 6) DEFAULT 0,   -- Rate (e.g. 0.050000 for 5%)
    max_drawdown NUMERIC(10, 6) DEFAULT 0,
    
    -- Audit & Risk
    violations JSONB DEFAULT '[]'::jsonb, 
    reward_total NUMERIC(20, 6) DEFAULT 0,
    
    -- Meta
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_episodes_mode_day UNIQUE (session_id, trade_day, mode)
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_episodes_modtime ON episodes;
CREATE TRIGGER update_episodes_modtime
    BEFORE UPDATE ON episodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Steps Table (Replay Unit)
CREATE TABLE IF NOT EXISTS steps (
    step_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    episode_id UUID NOT NULL REFERENCES episodes(episode_id) ON DELETE CASCADE,
    
    -- Sequencing (Strictly Non-Negative)
    step_index INTEGER NOT NULL CHECK (step_index >= 0),
    
    -- Time Truth
    timestamp TIMESTAMPTZ NOT NULL, -- The time the event HAPPENED (Event Time)
    ingested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- The time we WROTE it (Processing Time)
    
    -- The "Truth" State
    observation JSONB NOT NULL,
    action JSONB,
    
    -- Execution & Audit
    tool_calls JSONB DEFAULT '[]'::jsonb,
    guardrails JSONB DEFAULT '[]'::jsonb, -- Unified as Array
    violations JSONB DEFAULT '[]'::jsonb, -- Step-level violations (Constitution §4.3)
    
    -- RL
    reward_step NUMERIC(20, 6) DEFAULT 0,
    
    CONSTRAINT uq_steps_episode_index UNIQUE (episode_id, step_index)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_episodes_trade_day ON episodes(trade_day);
CREATE INDEX IF NOT EXISTS idx_episodes_mode ON episodes(mode);
-- Replay Index: Critical for sequential loading
CREATE INDEX IF NOT EXISTS idx_steps_replay ON steps(episode_id, step_index ASC);
