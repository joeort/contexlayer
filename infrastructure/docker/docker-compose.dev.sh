#!/bin/bash
# Start local dev infrastructure
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting Context Layer dev infrastructure..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d

echo ""
echo "Services:"
echo "  Postgres:     postgresql://context_layer:context_layer_dev@localhost:5432/context_layer"
echo "  Redis:        redis://localhost:6379"
echo "  Meilisearch:  http://localhost:7700 (master key: dev_master_key_change_in_prod)"
echo ""
echo "Run 'pnpm db:migrate' to apply migrations."
