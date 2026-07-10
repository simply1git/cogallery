#!/bin/bash
# Script to run security audits

# Exit on any error
set -e

echo "Running security audit (npm audit)..."
npm audit

# If we want to ignore low severity, we can use --audit-level=high
# But let's just run the full audit and let the exit code determine success/failure.

echo "Security audit completed."