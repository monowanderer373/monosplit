#!/usr/bin/env bash
set -euo pipefail
# Hosted Ubuntu already supplies a supported Chrome channel and its runtime.
# An external apt mirror outage must not prevent executing all browser tests.
if [[ "${CI:-}" == "true" ]] && command -v google-chrome >/dev/null; then
  google-chrome --version
  printf '%s\n' 'TABBY_CI_BROWSER=chrome' >> "${GITHUB_ENV:?CI environment file is required}"
else
  npx playwright install --with-deps chromium
fi
