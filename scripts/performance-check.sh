#!/bin/bash
# Script to run performance checks

# Exit on any error
set -e

echo "Building production bundle..."
npm run build

# The build command should have triggered the visualizer, which opens a browser window.
# We can also check the size of the dist directory.
echo "Build completed. Checking bundle size..."
du -sh dist

echo "Performance check completed. If the bundle analyzer opened, review the report for optimization opportunities."