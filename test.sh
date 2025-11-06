#!/bin/bash
set -euo pipefail

case "${1:-}" in
  base)
    # Run a subset of existing tests that pass at the base commit
    pnpm test -- --spec \
      tests/cypress/integration/extensions/link.spec.ts \
      tests/cypress/integration/markdown/manager.spec.ts
    ;;
  new)
    # Run newly added tests that should fail before the feature is implemented
    pnpm test -- --spec tests/cypress/integration/extensions/track-changes.spec.ts
    ;;
  *)
    echo "Usage: ./test.sh {base|new}" >&2
    exit 1
    ;;
esac
