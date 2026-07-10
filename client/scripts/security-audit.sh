#!/bin/bash

# Security audit script for CoGallery client

echo "Running security audit for client dependencies..."

# Run npm audit
npm audit

# Check for outdated packages (optional)
echo -e "\nChecking for outdated packages:"
npm outdated

# If you want to automatically fix vulnerabilities (use with caution)
# npm audit fix

echo "Security audit completed."