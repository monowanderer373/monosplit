[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet('Validate', 'HoldDatabase', 'HoldFrontend')]
    [string] $Action = 'Validate',

    [Parameter()]
    [string] $ApprovalPhrase,

    [Parameter()]
    [ValidatePattern('^[a-z0-9]{20}$')]
    [string] $ProjectRef
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $repoRoot 'docs\releases\2026-09-phase6-release-manifest.json'
$runbookPath = Join-Path $repoRoot 'docs\releases\2026-09-phase6-production-runbook.md'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

if ($manifest.candidateSha -notmatch '^[a-f0-9]{40}$') {
    throw 'The release manifest candidate SHA is invalid.'
}
if ($manifest.productionSupabaseRef -ceq $manifest.stagingSupabaseRef) {
    throw 'Production and staging refs must be different.'
}

$migrationRoot = Join-Path $repoRoot 'supabase\migrations'
$migrationFiles = @(Get-ChildItem -LiteralPath $migrationRoot -Filter '*.sql' -File)
if ($migrationFiles.Count -ne 21) {
    throw "Expected 21 migration files and found $($migrationFiles.Count)."
}
$duplicateVersions = @(
    $migrationFiles |
        ForEach-Object { $_.Name.Substring(0, 14) } |
        Group-Object |
        Where-Object { $_.Count -gt 1 }
)
if ($duplicateVersions.Count -gt 0) {
    throw 'Duplicate migration versions exist.'
}

$expected = @($manifest.migrations | Sort-Object order)
if ($expected.Count -ne 9) {
    throw 'The release manifest must list exactly nine pending migrations.'
}
$previousOrder = 0
foreach ($migration in $expected) {
    if ([int]$migration.order -ne ($previousOrder + 1)) {
        throw 'Pending migration order is not contiguous.'
    }
    $previousOrder = [int]$migration.order
    $path = Join-Path $migrationRoot $migration.filename
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing migration file $($migration.filename)."
    }
    $actualHash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -cne [string]$migration.sha256) {
        throw "Checksum mismatch for $($migration.filename)."
    }
}

$runbook = Get-Content -LiteralPath $runbookPath -Raw
foreach ($phrase in @(
    [string]$manifest.approvalPhrases.databaseMigration,
    [string]$manifest.approvalPhrases.frontendDeployment
)) {
    if ($runbook -notlike "*$phrase*") {
        throw 'The runbook is missing a required approval phrase.'
    }
}
foreach ($migration in $expected) {
    if ($runbook -notlike "*$($migration.sha256)*") {
        throw "The runbook is missing the checksum for $($migration.filename)."
    }
}
if ($runbook -match '(?i)(eyJ[A-Za-z0-9_-]{20,}|sb_secret_|service_role|postgres://)') {
    throw 'The runbook contains a secret-shaped value.'
}

$localMain = (& git -C $repoRoot rev-parse origin/main).Trim()
if ($localMain -cne [string]$manifest.expectedOriginMainSha) {
    throw "origin/main is $localMain, not the reviewed baseline."
}
& git -C $repoRoot merge-base --is-ancestor $localMain $manifest.candidateSha
if ($LASTEXITCODE -ne 0) {
    throw 'The reviewed main SHA is no longer an ancestor of the candidate.'
}

function Stop-ReleaseExecution {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Reason
    )

    Write-Output "RELEASE_HOLD_STOP $Reason"
    exit 2
}

if ($Action -eq 'HoldDatabase' -or $Action -eq 'HoldFrontend') {
    $expectedPhrase = if ($Action -eq 'HoldDatabase') {
        [string]$manifest.approvalPhrases.databaseMigration
    } else {
        [string]$manifest.approvalPhrases.frontendDeployment
    }
    if ([string]::IsNullOrWhiteSpace($ApprovalPhrase) -or $ApprovalPhrase -cne $expectedPhrase) {
        Stop-ReleaseExecution -Reason 'approval phrase missing or incorrect'
    }
    if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
        Stop-ReleaseExecution -Reason 'project ref was not explicit'
    }
    if ($Action -eq 'HoldDatabase' -and $ProjectRef -cne [string]$manifest.productionSupabaseRef) {
        Stop-ReleaseExecution -Reason 'database approval is bound to the production ref only'
    }
    Write-Output 'RELEASE_HOLD_ACCEPTED_NOT_EXECUTED'
    Write-Output 'This preflight does not apply migrations, merge main, or deploy.'
    exit 3
}

Write-Output 'PHASE6_PREFLIGHT_PASS'
Write-Output ("CANDIDATE_SHA=" + $manifest.candidateSha)
Write-Output ("MIGRATION_FILES=" + $migrationFiles.Count)
Write-Output ("PENDING_MIGRATIONS=" + $expected.Count)
Write-Output 'REMOTE_MUTATION=false'
