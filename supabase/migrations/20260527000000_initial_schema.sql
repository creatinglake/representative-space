-- Representative Space — Initial Schema
-- Migrates 7 in-memory stores to Postgres tables
-- Run against a Supabase project: supabase db push

------------------------------------------------------------
-- Helper functions
------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Rows in % are append-only and cannot be modified', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

------------------------------------------------------------
-- 1. representative_spaces
------------------------------------------------------------

CREATE TABLE representative_spaces (
  id              TEXT PRIMARY KEY,
  sub_type        TEXT NOT NULL CHECK (sub_type IN ('individual', 'candidate')),
  entity_did      TEXT,
  entity_slug     TEXT NOT NULL UNIQUE,
  jurisdiction    TEXT NOT NULL,
  office_or_candidacy_label TEXT NOT NULL,
  party_affiliation TEXT,
  term_dates      JSONB,
  candidacy_record JSONB,
  creation_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'verified')),
  lifecycle_state TEXT NOT NULL DEFAULT 'active'
    CHECK (lifecycle_state IN ('active', 'archived')),
  archived_at     TIMESTAMPTZ,
  archived_by     TEXT,
  archived_reason TEXT,
  successor_space_slug TEXT,
  profile         JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spaces_jurisdiction ON representative_spaces (jurisdiction);
CREATE INDEX idx_spaces_lifecycle ON representative_spaces (lifecycle_state);
CREATE INDEX idx_spaces_created ON representative_spaces (creation_date DESC);

CREATE TRIGGER trg_spaces_updated_at
  BEFORE UPDATE ON representative_spaces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

------------------------------------------------------------
-- 2. verification_records
------------------------------------------------------------

CREATE TABLE verification_records (
  id          TEXT PRIMARY KEY,
  space_id    TEXT NOT NULL REFERENCES representative_spaces(id),
  proof_type  TEXT NOT NULL DEFAULT 'admin_attestation',
  verified_by TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  notes       TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_verifications_space ON verification_records (space_id);

------------------------------------------------------------
-- 3. civic_events (append-only ledger)
------------------------------------------------------------

CREATE TABLE civic_events (
  id          TEXT PRIMARY KEY,
  version     TEXT NOT NULL DEFAULT '1.0',
  event_type  TEXT NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  process_id  TEXT NOT NULL DEFAULT '',
  actor       TEXT NOT NULL,
  space_slug  TEXT NOT NULL,  -- extracted from data for indexing
  jurisdiction TEXT NOT NULL,
  action_url  TEXT NOT NULL DEFAULT '',
  source      JSONB NOT NULL DEFAULT '{"hub_id":"","hub_url":""}',
  dedupe_key  TEXT,
  data        JSONB NOT NULL DEFAULT '{}',
  meta        JSONB NOT NULL DEFAULT '{"visibility":"public"}'
);

-- Primary ledger query: events for a space, newest first, with cursor pagination
CREATE INDEX idx_events_ledger ON civic_events (space_slug, timestamp DESC, id DESC);
CREATE INDEX idx_events_type ON civic_events (event_type);
CREATE INDEX idx_events_global_chrono ON civic_events (timestamp DESC);
CREATE INDEX idx_events_slug_type ON civic_events (space_slug, event_type);
CREATE UNIQUE INDEX idx_events_dedupe ON civic_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Append-only: prevent updates and deletes
CREATE TRIGGER trg_events_immutable
  BEFORE UPDATE OR DELETE ON civic_events
  FOR EACH ROW EXECUTE FUNCTION prevent_modification();

------------------------------------------------------------
-- 4. outcome_deliveries
------------------------------------------------------------

CREATE TABLE outcome_deliveries (
  id                        TEXT PRIMARY KEY,
  originating_process_id    TEXT NOT NULL,
  originating_hub_id        TEXT NOT NULL,
  originating_process_type  TEXT,
  outcome_summary           TEXT NOT NULL,
  participation_stats       JSONB NOT NULL DEFAULT '{}',
  result                    JSONB NOT NULL DEFAULT '{}',
  delivery_timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  addressed_to_slug         TEXT NOT NULL,
  response_id               TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outcomes_slug ON outcome_deliveries (addressed_to_slug, delivery_timestamp DESC, created_at DESC);

------------------------------------------------------------
-- 5. positions (with version chains)
------------------------------------------------------------

CREATE TABLE positions (
  id               TEXT PRIMARY KEY,
  topic            TEXT NOT NULL,
  author_did       TEXT NOT NULL,
  space_slug       TEXT NOT NULL,
  statement        TEXT NOT NULL,
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version          INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'current'
    CHECK (status IN ('current', 'superseded')),
  prior_version_id TEXT REFERENCES positions(id),
  linked_outcomes  JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_positions_slug ON positions (space_slug, status, timestamp DESC);
CREATE INDEX idx_positions_history ON positions (prior_version_id);

------------------------------------------------------------
-- 6. responses (for outcomes, positions, etc.)
------------------------------------------------------------

CREATE TABLE responses (
  id                  TEXT PRIMARY KEY,
  author_did          TEXT NOT NULL,
  in_response_to_type TEXT NOT NULL,
  in_response_to_id   TEXT NOT NULL,
  content             TEXT NOT NULL,
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version             INTEGER NOT NULL DEFAULT 1,
  prior_version_id    TEXT REFERENCES responses(id),
  immutable           BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_responses_target ON responses (in_response_to_type, in_response_to_id, timestamp DESC, version DESC);
CREATE INDEX idx_responses_target_id ON responses (in_response_to_id, timestamp DESC);

------------------------------------------------------------
-- 7. citizen_issues (with flattened moderation + tallies)
------------------------------------------------------------

CREATE TABLE citizen_issues (
  id                TEXT PRIMARY KEY,
  space_slug        TEXT NOT NULL,
  author_id         TEXT NOT NULL,
  entry_type        TEXT NOT NULL CHECK (entry_type IN ('issue', 'question', 'poll')),
  title             TEXT NOT NULL,
  body              TEXT NOT NULL,
  jurisdiction_tag  TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'responded', 'closed')),
  version           INTEGER NOT NULL DEFAULT 1,
  prior_version_id  TEXT REFERENCES citizen_issues(id),
  poll_options      JSONB NOT NULL DEFAULT '[]',
  poll_tally        JSONB NOT NULL DEFAULT '{}',
  support_count     INTEGER NOT NULL DEFAULT 0,
  oppose_count      INTEGER NOT NULL DEFAULT 0,
  mod_hidden        BOOLEAN NOT NULL DEFAULT FALSE,
  mod_reason        TEXT,
  mod_hidden_by     TEXT,
  mod_hidden_at     TIMESTAMPTZ,
  mod_restored_at   TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  closed_by         TEXT,
  latest_response_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_issues_slug ON citizen_issues (space_slug, mod_hidden, created_at DESC);
CREATE INDEX idx_issues_filter ON citizen_issues (space_slug, entry_type, status);
CREATE INDEX idx_issues_author ON citizen_issues (author_id);

CREATE TRIGGER trg_issues_updated_at
  BEFORE UPDATE ON citizen_issues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

------------------------------------------------------------
-- 8. issue_signals (composite PK: issue + user)
------------------------------------------------------------

CREATE TABLE issue_signals (
  issue_id   TEXT NOT NULL REFERENCES citizen_issues(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  signal     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (issue_id, user_id)
);

------------------------------------------------------------
-- 9. issue_responses (entity replies to citizen issues)
------------------------------------------------------------

CREATE TABLE issue_responses (
  id               TEXT PRIMARY KEY,
  issue_id         TEXT NOT NULL REFERENCES citizen_issues(id) ON DELETE CASCADE,
  author_did       TEXT NOT NULL,
  in_response_to_type TEXT NOT NULL DEFAULT 'issue_board_entry',
  content          TEXT NOT NULL,
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version          INTEGER NOT NULL DEFAULT 1,
  prior_version_id TEXT REFERENCES issue_responses(id)
);

CREATE INDEX idx_issue_responses_issue ON issue_responses (issue_id, timestamp DESC);

-- Add the FK from citizen_issues.latest_response_id now that issue_responses exists
ALTER TABLE citizen_issues
  ADD CONSTRAINT fk_issues_latest_response
  FOREIGN KEY (latest_response_id) REFERENCES issue_responses(id);

------------------------------------------------------------
-- 10. processes (deliberation, etc.)
------------------------------------------------------------

CREATE TABLE processes (
  id          TEXT PRIMARY KEY,
  definition  JSONB NOT NULL DEFAULT '{}',
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'active', 'closed', 'finalized')),
  host_id     TEXT NOT NULL,
  space_slug  TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  state       JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_processes_slug ON processes (space_slug, created_at DESC);
CREATE INDEX idx_processes_status ON processes (status);

CREATE TRIGGER trg_processes_updated_at
  BEFORE UPDATE ON processes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

------------------------------------------------------------
-- Row Level Security (enable on all tables, open for service_role)
------------------------------------------------------------

ALTER TABLE representative_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. For the API server using the service_role key,
-- all operations are allowed. Public/anon policies can be added later for
-- direct Supabase client access from the frontend if desired.
