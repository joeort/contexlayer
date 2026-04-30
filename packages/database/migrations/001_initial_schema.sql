-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ORGANIZATIONS (tenants)
-- ============================================================
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'trial'
                CHECK (plan IN ('trial', 'starter', 'growth', 'enterprise')),
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONNECTORS
-- ============================================================
CREATE TABLE connectors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'error', 'paused')),
  -- credentials stored encrypted; application layer encrypts before insert
  credentials     JSONB NOT NULL DEFAULT '{}',
  config          JSONB NOT NULL DEFAULT '{}',
  last_synced_at  TIMESTAMPTZ,
  sync_cursor     JSONB,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, type, display_name)
);

-- ============================================================
-- SCHEMA DISCOVERY
-- ============================================================
CREATE TABLE schema_objects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connector_id    UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  object_name     TEXT NOT NULL,
  object_label    TEXT,
  object_type     TEXT NOT NULL DEFAULT 'standard'
                    CHECK (object_type IN ('standard', 'custom', 'view', 'report_folder')),
  record_count    BIGINT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  discovered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connector_id, object_name)
);

CREATE TABLE schema_fields (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connector_id    UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  object_id       UUID NOT NULL REFERENCES schema_objects(id) ON DELETE CASCADE,
  field_name      TEXT NOT NULL,
  field_label     TEXT,
  field_type      TEXT NOT NULL DEFAULT 'unknown',
  is_custom       BOOLEAN NOT NULL DEFAULT FALSE,
  formula         TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  sample_values   JSONB,
  null_rate       FLOAT CHECK (null_rate >= 0 AND null_rate <= 1),
  -- 1536-dim vector for text-embedding-3-small / Claude embeddings
  embedding       vector(1536),
  discovered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(object_id, field_name)
);

-- Human or LLM enrichment of a field
CREATE TABLE field_annotations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  field_id          UUID NOT NULL REFERENCES schema_fields(id) ON DELETE CASCADE,
  description       TEXT,
  usage_notes       TEXT,
  -- canonical field for its semantic concept within this org
  is_preferred      BOOLEAN NOT NULL DEFAULT FALSE,
  replaces_field_id UUID REFERENCES schema_fields(id),
  authored_by       TEXT NOT NULL DEFAULT 'system',
  confidence        FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- one preferred annotation per field
  UNIQUE(field_id, is_preferred) DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================
-- METRICS + TEMPORAL VERSIONS
-- ============================================================
CREATE TABLE metrics (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  aliases     TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  category    TEXT CHECK (category IN (
                'revenue','pipeline','activity','product',
                'finance','marketing','customer_success'
              )),
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'active', 'deprecated')),
  embedding   vector(1536),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, name)
);

CREATE TABLE metric_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_id       UUID NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  effective_from  DATE NOT NULL,
  -- NULL = current version
  effective_to    DATE,
  -- structured definition: { primary_field, aggregation, filters, joins, exclusions, segment_by }
  definition      JSONB NOT NULL,
  sql_template    TEXT,
  notes           TEXT,
  source          TEXT NOT NULL DEFAULT 'manual'
                    CHECK (source IN ('manual', 'report_analysis', 'llm_inference')),
  source_ref      UUID,
  authored_by     TEXT NOT NULL DEFAULT 'system',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(metric_id, version_number),
  -- non-overlapping date ranges enforced at application layer with partial index
  CONSTRAINT effective_to_after_from CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- ============================================================
-- BUSINESS RULES
-- ============================================================
CREATE TABLE business_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_type       TEXT NOT NULL
                    CHECK (rule_type IN (
                      'filter','join','exclusion','alias','nuance','temporal_change'
                    )),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  -- { metrics: [...], objects: [...], connectors: [...] }
  applies_to      JSONB NOT NULL DEFAULT '{}',
  structured_rule JSONB,
  effective_from  DATE,
  effective_to    DATE,
  priority        INTEGER NOT NULL DEFAULT 50,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  embedding       vector(1536),
  source          TEXT NOT NULL DEFAULT 'manual',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REPORTS (discovered from BI tools)
-- ============================================================
CREATE TABLE reports (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connector_id      UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  external_id       TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  report_type       TEXT DEFAULT 'unknown'
                      CHECK (report_type IN (
                        'tabular','summary','matrix','joined','dashboard','unknown'
                      )),
  url               TEXT,
  raw_definition    JSONB NOT NULL DEFAULT '{}',
  analysis_status   TEXT NOT NULL DEFAULT 'pending'
                      CHECK (analysis_status IN (
                        'pending','analyzing','complete','failed'
                      )),
  analysis_result   JSONB,
  analyzed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connector_id, external_id)
);

-- ============================================================
-- JOIN PATHS
-- ============================================================
CREATE TABLE join_paths (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT,
  -- array of { fromConnector, fromObject, fromField, toConnector, toObject, toField, joinType }
  steps           JSONB NOT NULL,
  discovered_from TEXT,
  confidence      FLOAT NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONTEXT BUNDLES (pre-compiled MCP responses)
-- ============================================================
CREATE TABLE context_bundles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bundle_type TEXT NOT NULL,
  content     JSONB NOT NULL,
  token_count INTEGER,
  compiled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  cache_key   TEXT NOT NULL,
  UNIQUE(org_id, cache_key)
);

-- ============================================================
-- AUDIT TABLES
-- ============================================================
CREATE TABLE mcp_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  api_key_id       TEXT,
  intent           TEXT NOT NULL,
  intent_category  TEXT,
  context_served   JSONB,
  metrics_matched  TEXT[] NOT NULL DEFAULT '{}',
  fields_matched   TEXT[] NOT NULL DEFAULT '{}',
  rules_applied    TEXT[] NOT NULL DEFAULT '{}',
  latency_ms       INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sync_jobs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connector_id        UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  job_type            TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','running','complete','failed')),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  records_processed   INTEGER,
  error_details       JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
-- Vector similarity search (ivfflat — tune lists param after data volume known)
CREATE INDEX idx_schema_fields_embedding ON schema_fields
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_metrics_embedding ON metrics
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_business_rules_embedding ON business_rules
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Temporal metric resolution
CREATE INDEX idx_metric_versions_range ON metric_versions
  (metric_id, effective_from, effective_to);

-- Common query patterns
CREATE INDEX idx_schema_fields_org_object ON schema_fields(org_id, object_id);
CREATE INDEX idx_schema_fields_preferred ON field_annotations(org_id, field_id) WHERE is_preferred = TRUE;
CREATE INDEX idx_metrics_org_status ON metrics(org_id, status);
CREATE INDEX idx_business_rules_active ON business_rules(org_id, is_active, rule_type);
CREATE INDEX idx_reports_analysis_status ON reports(org_id, analysis_status);
CREATE INDEX idx_mcp_requests_org_date ON mcp_requests(org_id, created_at DESC);
CREATE INDEX idx_sync_jobs_connector ON sync_jobs(connector_id, created_at DESC);
CREATE INDEX idx_connectors_org ON connectors(org_id, status);

-- Full-text search on field labels and metric names
CREATE INDEX idx_schema_fields_label_fts ON schema_fields
  USING gin(to_tsvector('english', coalesce(field_label, '') || ' ' || field_name));
CREATE INDEX idx_metrics_name_fts ON metrics
  USING gin(to_tsvector('english', name || ' ' || array_to_string(aliases, ' ')));

-- Trigram index for fuzzy name matching
CREATE INDEX idx_schema_fields_label_trgm ON schema_fields
  USING gin(field_label gin_trgm_ops);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_connectors_updated_at
  BEFORE UPDATE ON connectors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_field_annotations_updated_at
  BEFORE UPDATE ON field_annotations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_metrics_updated_at
  BEFORE UPDATE ON metrics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_business_rules_updated_at
  BEFORE UPDATE ON business_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
