#!/usr/bin/env bash
# Certbot --deploy-hook: runs only after a successful renewal. Reloads nginx
# so the new fullchain is served without dropping connections.
set -euo pipefail
systemctl reload nginx
