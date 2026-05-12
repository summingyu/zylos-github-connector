#!/bin/bash
set -e  # Exit on error

# Color output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
success() { echo -e "${GREEN}✓ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; }
info() { echo -e "${YELLOW}➜ $1${NC}"; }

APP_NAME="zylos-github-connector"
CONFIG_PATH="$HOME/zylos/components/github-connector/config.json"
CONFIG_BACKUP="/tmp/github-connector-config-backup.json"

# Test: Start PM2
test_start() {
  info "Testing PM2 start..."

  # Stop any existing process
  pm2 stop $APP_NAME 2>/dev/null || true
  pm2 delete $APP_NAME 2>/dev/null || true

  # Start PM2
  pm2 start ecosystem.config.cjs

  # Wait for process to be online
  sleep 2

  # Check status
  STATUS=$(pm2 list | grep $APP_NAME | awk '{print $10}')
  if [ "$STATUS" = "online" ]; then
    success "PM2 started successfully (status: $STATUS)"
  else
    error "PM2 failed to start (status: $STATUS)"
    exit 1
  fi

  # Check log files exist
  if [ -f "logs/error.log" ] && [ -f "logs/out.log" ]; then
    success "Log files created"
  else
    error "Log files not found"
    exit 1
  fi

  # Test HTTP endpoint
  HEALTH=$(curl -s http://localhost:3461/health)
  if echo "$HEALTH" | grep -q "ok"; then
    success "Health endpoint responding"
  else
    error "Health endpoint not responding"
    exit 1
  fi
}

# Test: Stop PM2
test_stop() {
  info "Testing PM2 stop..."

  pm2 stop $APP_NAME

  # Wait for process to stop
  sleep 2

  # Check status
  STATUS=$(pm2 list | grep $APP_NAME | awk '{print $10}')
  if [ "$STATUS" = "stopped" ]; then
    success "PM2 stopped successfully (status: $STATUS)"
  else
    error "PM2 failed to stop (status: $STATUS)"
    exit 1
  fi

  # Check for shutdown logs
  if grep -q "Shutting down" logs/out.log; then
    success "Graceful shutdown logs found"
  else
    error "Shutdown logs not found"
    exit 1
  fi

  # Check for cleanup logs
  if grep -q "Stopped dedupe cleanup interval" logs/out.log; then
    success "Resource cleanup logs found"
  else
    error "Cleanup logs not found"
    exit 1
  fi
}

# Test: Restart PM2
test_restart() {
  info "Testing PM2 restart..."

  pm2 restart $APP_NAME

  # Wait for process to be online
  sleep 2

  # Check status
  STATUS=$(pm2 list | grep $APP_NAME | awk '{print $10}')
  if [ "$STATUS" = "online" ]; then
    success "PM2 restarted successfully (status: $STATUS)"
  else
    error "PM2 failed to restart (status: $STATUS)"
    exit 1
  fi

  # Test HTTP endpoint after restart
  HEALTH=$(curl -s http://localhost:3461/health)
  if echo "$HEALTH" | grep -q "ok"; then
    success "Health endpoint responding after restart"
  else
    error "Health endpoint not responding after restart"
    exit 1
  fi
}

# Test: Disabled config
test_disabled() {
  info "Testing disabled configuration..."

  # Skip if no config file
  if [ ! -f "$CONFIG_PATH" ]; then
    info "No config file found, skipping disabled test"
    return
  fi

  # Backup current config
  cp "$CONFIG_PATH" "$CONFIG_BACKUP"

  # Set enabled to false
  node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('$CONFIG_PATH', 'utf8'));
    config.enabled = false;
    fs.writeFileSync('$CONFIG_PATH', JSON.stringify(config, null, 2));
  "

  # Restart PM2
  pm2 restart $APP_NAME

  # Wait for process to exit
  sleep 3

  # Check status
  STATUS=$(pm2 list | grep $APP_NAME | awk '{print $10}')
  if [ "$STATUS" = "stopped" ] || [ "$STATUS" = "errored" ]; then
    success "Process exited when disabled (status: $STATUS)"
  else
    error "Process did not exit when disabled (status: $STATUS)"
  fi

  # Restore config
  mv "$CONFIG_BACKUP" "$CONFIG_PATH"

  # Restart PM2 with restored config
  pm2 restart $APP_NAME
  sleep 2
}

# Cleanup
cleanup() {
  info "Cleaning up..."

  # Delete PM2 process
  pm2 delete $APP_NAME 2>/dev/null || true

  # Remove config backup if exists
  rm -f "$CONFIG_BACKUP"

  success "Cleanup complete"
}

# Main test flow
main() {
  echo "==================================="
  echo "   PM2 Integration Test Suite"
  echo "==================================="
  echo ""

  test_start
  echo ""

  test_stop
  echo ""

  test_restart
  echo ""

  test_disabled
  echo ""

  cleanup
  echo ""

  echo "==================================="
  echo -e "${GREEN}   All tests passed!${NC}"
  echo "==================================="
}

# Run main function
main
