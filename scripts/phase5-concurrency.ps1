$ErrorActionPreference = 'Stop'

$container = 'supabase_db_MonoSplit'
$running = docker ps --filter "name=^${container}$" --format '{{.Names}}'
if ($running -ne $container) {
  throw "Local Supabase database container '$container' is not running."
}

$sqlPath = Join-Path $PSScriptRoot 'phase5-concurrency.sql'
Get-Content -Raw $sqlPath |
  docker exec -i -e PGPASSWORD=postgres $container `
    psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1

if ($LASTEXITCODE -ne 0) {
  throw "Phase 5 concurrency harness failed with exit code $LASTEXITCODE."
}
