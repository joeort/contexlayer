-- API keys for MCP client authentication
-- Keys are hashed before storage; the plain key is shown to users exactly once

CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  -- SHA-256(plain_key) — never store the plain key
  key_hash     TEXT NOT NULL UNIQUE,
  -- First 20 chars of the key for display (e.g. "cl_live_a1b2c3d4_xx...")
  key_prefix   TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   TEXT NOT NULL DEFAULT 'user',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, name)
);

CREATE INDEX idx_api_keys_hash   ON api_keys(key_hash) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_org    ON api_keys(org_id, is_active);
