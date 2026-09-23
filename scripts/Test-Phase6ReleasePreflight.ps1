[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet('Validate', 'HoldDatabase', 'HoldFrontend')]
    [string] $Action = 'Validate',

    [Parameter()]
    [string] $ApprovalPhrase,

    [Parameter()]
    [ValidatePattern('^[a-z0-9]{20}$')]
    [string] $ProjectRef,

    [Parameter()]
    [ValidatePattern('^[a-f0-9]{40}$')]
    [string] $ReleaseSha
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $repoRoot 'docs\releases\2026-09-phase6-release-manifest.json'
$runbookPath = Join-Path $repoRoot 'docs\releases\2026-09-phase6-production-runbook.md'
$manifestJson = Get-Content -LiteralPath $manifestPath -Raw
$manifest = $manifestJson | ConvertFrom-Json

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
    $expectedRow = "| $($migration.order) | ``$($migration.filename)`` | ``$($migration.sha256)`` |"
    if ($runbook.IndexOf($expectedRow, [System.StringComparison]::Ordinal) -lt 0) {
        throw "The runbook does not bind $($migration.filename) to its order and checksum."
    }
}
$secretPattern = '(?i)(eyJ[A-Za-z0-9_-]{20,}|sb_secret_|service_role|postgres(?:ql)?://)'
if ($runbook -match $secretPattern -or $manifestJson -match $secretPattern) {
    throw 'The runbook or manifest contains a secret-shaped value.'
}

$localMain = (& git -C $repoRoot rev-parse origin/main).Trim()
if ($localMain -cne [string]$manifest.expectedOriginMainSha) {
    throw "origin/main is $localMain, not the reviewed baseline."
}
& git -C $repoRoot merge-base --is-ancestor $localMain $manifest.candidateSha
if ($LASTEXITCODE -ne 0) {
    throw 'The reviewed main SHA is no longer an ancestor of the candidate.'
}
$currentHead = (& git -C $repoRoot rev-parse HEAD).Trim()
$currentBranch = (& git -C $repoRoot branch --show-current).Trim()
if (-not [string]::IsNullOrWhiteSpace($currentBranch) -and
    $currentBranch -cne [string]$manifest.sourceBranch) {
    throw "Current branch is $currentBranch, not $($manifest.sourceBranch)."
}
if (-not [string]::IsNullOrWhiteSpace($ReleaseSha) -and $ReleaseSha -cne $currentHead) {
    throw 'ReleaseSha does not match the checked-out immutable release commit.'
}
$headParent = (& git -C $repoRoot rev-parse "$currentHead^").Trim()
if ($headParent -cne [string]$manifest.reviewedRunbookBaseSha) {
    throw 'The release branch contains commits beyond the single reviewed Gate D correction.'
}
$allowedReleaseFiles = @(
    'docs/releases/2026-09-phase6-production-runbook.md',
    'docs/releases/2026-09-phase6-release-manifest.json',
    'scripts/Get-Phase6ReleaseSnapshot.ps1',
    'scripts/Test-Phase6ReleasePreflight.ps1'
)
$releaseFiles = @(& git -C $repoRoot diff --name-only $manifest.reviewedRunbookBaseSha $currentHead)
$unexpectedReleaseFiles = @($releaseFiles | Where-Object { $allowedReleaseFiles -cnotcontains $_ })
if ($unexpectedReleaseFiles.Count -gt 0) {
    throw "The reviewed Gate D correction changed unexpected files: $($unexpectedReleaseFiles -join ', ')."
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
    if ($ProjectRef -cne [string]$manifest.productionSupabaseRef) {
        Stop-ReleaseExecution -Reason 'release approval is bound to the production ref only'
    }
    if ([string]::IsNullOrWhiteSpace($ReleaseSha) -or $ReleaseSha -cne $currentHead) {
        Stop-ReleaseExecution -Reason 'release SHA was not explicit or does not match HEAD'
    }
    $remoteRelease = (& git -C $repoRoot rev-parse "origin/$($manifest.sourceBranch)").Trim()
    if ($remoteRelease -cne $ReleaseSha) {
        Stop-ReleaseExecution -Reason 'origin release branch does not match the frozen release SHA'
    }
    Write-Output 'RELEASE_HOLD_ACCEPTED_NOT_EXECUTED'
    Write-Output 'This preflight does not apply migrations, merge main, or deploy.'
    exit 3
}

Write-Output 'PHASE6_PREFLIGHT_PASS'
Write-Output ("CANDIDATE_SHA=" + $manifest.candidateSha)
Write-Output ("RELEASE_SHA=" + $currentHead)
Write-Output ("MIGRATION_FILES=" + $migrationFiles.Count)
Write-Output ("PENDING_MIGRATIONS=" + $expected.Count)
Write-Output 'REMOTE_MUTATION=false'
