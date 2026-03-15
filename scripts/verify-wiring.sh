#!/bin/bash
# verify-wiring.sh - Static wiring verification for DeckPilot
# Checks that all components are imported, APIs are called, pages are linked, no placeholder text.
# Exit 0 = all checks pass, Exit 1 = gaps found.

set -e
ERRORS=0
WARNINGS=0

echo "=== DeckPilot Wiring Verification ==="
echo ""

# Rule 1: Every exported component in src/components/deck/ must be imported somewhere in src/app/ or src/components/
echo "--- Checking component imports ---"
for component in src/components/deck/*.tsx; do
  [ -f "$component" ] || continue
  # Extract exported function/const names (macOS-compatible: grep -E + sed)
  names=$(grep -E 'export (default )?(function|const) [A-Za-z_][A-Za-z0-9_]*' "$component" | sed -E 's/.*export (default )?(function|const) ([A-Za-z_][A-Za-z0-9_]*).*/\3/')
  for name in $names; do
    # Check if imported anywhere in src/ (excluding the file itself)
    count=$(grep -rl "$name" src/ --include='*.tsx' --include='*.ts' | grep -v "$component" | wc -l | tr -d ' ')
    if [ "$count" -eq 0 ]; then
      echo "FAIL: Orphaned component '$name' in $component - not imported anywhere"
      ERRORS=$((ERRORS + 1))
    fi
  done
done

# Also check src/components/cards/ and src/components/ai/ and src/components/theme-*
for component in src/components/cards/*.tsx src/components/ai/*.tsx src/components/theme-*.tsx; do
  [ -f "$component" ] || continue
  names=$(grep -E 'export (default )?(function|const) [A-Za-z_][A-Za-z0-9_]*' "$component" | sed -E 's/.*export (default )?(function|const) ([A-Za-z_][A-Za-z0-9_]*).*/\3/')
  for name in $names; do
    count=$(grep -rl "$name" src/ --include='*.tsx' --include='*.ts' | grep -v "$component" | wc -l | tr -d ' ')
    if [ "$count" -eq 0 ]; then
      echo "FAIL: Orphaned component '$name' in $component - not imported anywhere"
      ERRORS=$((ERRORS + 1))
    fi
  done
done

echo ""

# Rule 2: API routes should have at least one client-side caller
echo "--- Checking API route usage ---"
for route in $(find src/app/api -name 'route.ts' 2>/dev/null); do
  # Extract the API path from the file path
  path=$(echo "$route" | sed 's|src/app||;s|/route.ts||')
  # Check if any file references this path (excluding the route itself and inngest internal routes)
  if echo "$path" | grep -q "inngest"; then
    continue  # Inngest routes are called by the Inngest framework, not our code
  fi
  count=$(grep -rl "$path" src/ --include='*.tsx' --include='*.ts' | grep -v "$route" | wc -l | tr -d ' ')
  if [ "$count" -eq 0 ]; then
    echo "FAIL: API route $path has no client-side callers"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""

# Rule 3: Dashboard pages should be reachable via navigation links
echo "--- Checking page reachability ---"
for page in $(find src/app/\(dashboard\) -name 'page.tsx' 2>/dev/null); do
  # Extract relative path
  relpath=$(echo "$page" | sed 's|src/app/(dashboard)||;s|/page.tsx||')
  # Skip root pages and dynamic segments for simple check
  if [ "$relpath" = "/decks" ] || [ "$relpath" = "/settings" ]; then
    continue
  fi
  # Convert [id] to a generic pattern for grep
  greppath=$(echo "$relpath" | sed 's|\[id\]|[^/"]*|g' | sed 's|^/||')
  # Check if any other file has an href containing this path pattern
  count=$(grep -rEl "href=.*$greppath" src/ --include='*.tsx' | grep -v "$page" | wc -l | tr -d ' ')
  if [ "$count" -eq 0 ]; then
    echo "FAIL: Unreachable page $page - no navigation link found"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""

# Rule 4: No placeholder text in production code
echo "--- Checking for placeholder text ---"
placeholders=$(grep -rn "Phase 6\|coming soon\|Coming in Phase\|coming in Phase\|Create Next App" src/app/ --include='*.tsx' --include='*.ts' 2>/dev/null || true)
if [ -n "$placeholders" ]; then
  echo "FAIL: Placeholder text found in production code:"
  echo "$placeholders"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# Summary
echo "=== Verification Complete ==="
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"

if [ "$ERRORS" -gt 0 ]; then
  echo "RESULT: FAIL"
  exit 1
else
  echo "RESULT: PASS"
  exit 0
fi
