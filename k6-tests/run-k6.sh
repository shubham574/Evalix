#!/usr/bin/env bash
#
# InterviewAce - Grafana k6 Module-by-Module Load Testing Suite (Bash)
#
# Runs k6 tests for each module of the InterviewAce project one by one for 100 users for 15 seconds.

BASE_URL="${BASE_URL:-http://localhost:5000}"
VUS="${VUS:-100}"
DURATION="${DURATION:-15s}"
AUTH_TOKEN="${AUTH_TOKEN:-test-token}"
MODULE="${1:-}"

echo ""
echo "========================================================"
echo "   InterviewAce - Grafana k6 Module Load Tester"
echo "========================================================"
echo "Target URL : $BASE_URL"
echo "Load       : $VUS Virtual Users"
echo "Duration   : $DURATION per module"
echo "Auth Token : $AUTH_TOKEN"
echo "========================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULES_DIR="$SCRIPT_DIR/modules"

if [ -n "$MODULE" ]; then
  FILES=$(ls "$MODULES_DIR"/*"$MODULE"*.js 2>/dev/null)
  if [ -z "$FILES" ]; then
    echo "[ERROR] Module '$MODULE' not found in $MODULES_DIR"
    exit 1
  fi
else
  FILES=$(ls "$MODULES_DIR"/*.js | sort)
fi

for file in $FILES; do
  module_name=$(basename "$file" .js)
  echo ""
  echo "--------------------------------------------------------"
  echo "▶ Running Module: $module_name ($VUS VUs for $DURATION)..."
  echo "--------------------------------------------------------"

  k6 run \
    --vus "$VUS" \
    --duration "$DURATION" \
    -e BASE_URL="$BASE_URL" \
    -e AUTH_TOKEN="$AUTH_TOKEN" \
    "$file"

  status=$?
  if [ $status -ne 0 ]; then
    echo "[WARN] Module $module_name finished with non-zero exit code ($status)"
  fi
  sleep 1
done

echo ""
echo "========================================================"
echo "              ALL MODULE TESTS FINISHED"
echo "========================================================"
