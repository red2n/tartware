#!/bin/bash
# =====================================================
# docker-entrypoint-custom.sh
# Custom entrypoint wrapper for Tartware initialization
# =====================================================

set -e

# Make scripts executable
chmod +x /docker-entrypoint-initdb.d/scripts/docker/*.sh 2>/dev/null || true

# Copy our init script to where PostgreSQL entrypoint expects it
# PostgreSQL only processes files directly in /docker-entrypoint-initdb.d/
cp /docker-entrypoint-initdb.d/scripts/docker/00-tartware-init.sh /docker-entrypoint-initdb.d/00-tartware-init.sh

# Run the official PostgreSQL entrypoint
# It will automatically execute our init script
exec docker-entrypoint.sh postgres
