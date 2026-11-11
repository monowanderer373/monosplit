#!/usr/bin/env bash
set -euo pipefail
# The hosted image's Azure Ubuntu mirror failed DNS in Quality43034143250.
# Keep the same signed Ubuntu dependencies and pinned Playwright browser; use
# the official archives rather than skipping browser/dependency installation.
if [[ "${CI:-}" != "true" || "$(uname -s)" != "Linux" ]]; then
  echo 'This mirror setup is only for the disposable Linux CI runner.' >&2
  exit 2
fi
if [[ -f /etc/apt/apt-mirrors.txt ]]; then
  printf '%s\n' 'https://archive.ubuntu.com/ubuntu' | sudo tee /etc/apt/apt-mirrors.txt >/dev/null
fi
if [[ -f /etc/apt/apt-mirrors-security.txt ]]; then
  printf '%s\n' 'https://security.ubuntu.com/ubuntu' | sudo tee /etc/apt/apt-mirrors-security.txt >/dev/null
fi
for apt_source in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
  [[ -f "$apt_source" ]] || continue
  sudo sed -i 's|http://azure.archive.ubuntu.com/ubuntu|https://archive.ubuntu.com/ubuntu|g;s|https://azure.archive.ubuntu.com/ubuntu|https://archive.ubuntu.com/ubuntu|g' "$apt_source"
done
printf '%s\n' 'Acquire::Retries "2";' 'Acquire::http::Timeout "20";' 'Acquire::https::Timeout "20";' | sudo tee /etc/apt/apt.conf.d/99tabby-ci-network >/dev/null
