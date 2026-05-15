#!/usr/bin/env bash
set -euo pipefail

n8n import:workflow --separate --input=/app/imports/workflows
