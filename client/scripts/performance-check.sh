#!/bin/bash

# Performance check script for Coallery client

echo "Building production bundle..."
npm run build

# Check the size of the built assets
echo -e "\nChecking bundle sizes:"
# List the size of the assets in the dist directory
du -sh dist/* 2>/dev/null || echo "Unable to compute sizes (du command not found or no dist directory)"

# Optionally, check the gzipped size of the main JavaScript bundle
if [ -f "dist/assets/index.js" ]; then
  echo -e "\nChecking gzipped size of main JS bundle:"
  gzip_size=$(gzip -c dist/assets/index.js | wc -c)
  echo "gzipped: $gzip_size bytes"
elif [ -f "dist/index.js" ]; then
  gzip_size=$(gzip -c dist/dist/index.js | wc -c)
  echo "gzipped: $gzip_size bytes"
else
  echo "Could not find the main JS bundle to check gzipped size."
fi

echo -e "\nPerformance check completed."
echo "Note: For a detailed bundle visualization, check the report.html generated in the dist directory (if the visualizer plugin is configured to generate it)."