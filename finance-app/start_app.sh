#!/bin/bash
# Script to start the finance app (Frontend + Backend)
# Run this from the finance-app directory

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
NODE_BIN="$PARENT_DIR/node-v22.13.0-darwin-arm64/bin"

# Add node to PATH
export PATH="$NODE_BIN:$PATH"

echo "Starting Finance App..."
echo "Using Node version: $(node -v)"

# Kill any existing processes on ports 3001 or 5173 (optional/safe effort)
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

# Start Backend and Frontend concurrently
./node_modules/.bin/concurrently \
  --names "SERVER,CLIENT" \
  --prefix-colors "yellow,cyan" \
  "node server.js" \
  "npm run dev -- --host"
