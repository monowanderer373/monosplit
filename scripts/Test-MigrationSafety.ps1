[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string[]] $MigrationPath,

    [Parameter()]
    [switch] $WritesFrozen,

    [Parameter()]
    [ValidateRange(1, 240)]
    [int] $MaximumBackupAgeMinutes = 60,

    [Parameter()]
    [string] $RollbackPlanPath,

    [Parameter()]
    [string] $ApprovalReference,

    [Parameter()]
    [string] $SettingsPath
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ProductionBackup.Common.ps1')

if ([string]::IsNullOrWhiteSpace($SettingsPath)) {
    $SettingsPath = Get-DefaultBackupSettingsPath
}
$SettingsPath = [System.IO.Path]::GetFullPath($SettingsPath)
$settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
if ($settings.formatVersion -ne 1) {
    throw 'The production backup settings version is unsupported.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$migrationRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $repoRoot 'supabase\migrations')
).TrimEnd('\') + '\'
$findings = @()

foreach ($path in $MigrationPath) {
    $resolvedPath = (Resolve-Path -LiteralPath $path).Path
    if (-not $resolvedPath.StartsWith(
        $migrationRoot,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw "Migration path is outside supabase/migrations: $resolvedPath"
    }

    $sql = Get-Content -LiteralPath $resolvedPath -Raw
    $riskSignals = @()
    $highRiskPatterns = [ordered]@{
        drop_table = '(?im)\bdrop\s+table\b'
        drop_column = '(?im)\bdrop\s+column\b'
        drop_schema = '(?im)\bdrop\s+schema\b'
        truncate = '(?im)\btruncate(?:\s+table)?\b'
        auth_user_delete = '(?im)\bdelete\s+from\s+auth\.users\b'
        financial_rewrite = '(?im)\b(?:update|delete\s+from)\s+public\.(?:expenses|expense_participations|payer_contributions|expense_shares|settlement_payments|settlement_allocations)\b'
        money_type_change = '(?im)\balter\s+(?:table\s+)?public\.[a-z0-9_]+\s+.*\b(?:amount_minor|total_minor)\b.*\btype\b'
        allocation_logic_change = '(?im)\bcreate\s+or\s+replace\s+function\s+public\.(?:create_expense|update_expense|propose_settlement|recompute_settlement_status)\b'
    }
    foreach ($signal in $highRiskPatterns.GetEnumerator()) {
        if ($sql -match $signal.Value) {
            $riskSignals += $signal.Key
        }
    }

    $classification = if ($riskSignals.Count -gt 0) {
        'high-risk'
    } elseif ($sql -match '(?im)\bcreate\s+or\s+replace\s+function\b|\balter\s+table\b.*\bset\s+not\s+null\b') {
        'forward-fix'
    } else {
        'safely-reversible'
    }

    $findings += [pscustomobject]@{
        migration = Split-Path -Leaf $resolvedPath
        classification = $classification
        signals = @($riskSignals)
    }
}

$highRisk = @($findings | Where-Object { $_.classification -ceq 'high-risk' })
if ($highRisk.Count -gt 0) {
    if (-not $WritesFrozen.IsPresent) {
        throw 'High-risk migrations require WritesFrozen after application writes have drained.'
    }
    if ([string]::IsNullOrWhiteSpace($ApprovalReference)) {
        throw 'High-risk migrations require a recorded approval reference.'
    }
    if ([string]::IsNullOrWhiteSpace($RollbackPlanPath) -or
        -not (Test-Path -LiteralPath $RollbackPlanPath -PathType Leaf) -or
        (Get-Item -LiteralPath $RollbackPlanPath).Length -eq 0) {
        throw 'High-risk migrations require a non-empty rollback or forward-fix plan file.'
    }

    $stateRoot = Split-Path -Parent $SettingsPath
    $lastSuccessPath = Join-Path $stateRoot 'last-success.json'
    if (-not (Test-Path -LiteralPath $lastSuccessPath -PathType Leaf)) {
        throw 'No verified production backup receipt was found.'
    }
    $lastSuccess = Get-Content -LiteralPath $lastSuccessPath -Raw | ConvertFrom-Json
    if ($lastSuccess.mode -cne 'pre-migration') {
        throw 'The latest verified backup is not a pre-migration backup.'
    }

    $backupAge = [DateTime]::UtcNow - [DateTime]::Parse(
        [string]$lastSuccess.completedAtUtc,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::RoundtripKind
    )
    if ($backupAge.TotalMinutes -gt $MaximumBackupAgeMinutes -or
        $backupAge.TotalMinutes -lt 0) {
        throw "The verified pre-migration backup is older than $MaximumBackupAgeMinutes minutes."
    }
    $archivePath = Join-Path $settings.destinationRoot $lastSuccess.archiveName
    if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
        throw 'The verified pre-migration archive is missing from encrypted storage.'
    }
    $actualArchiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualArchiveHash -cne [string]$lastSuccess.archiveSha256) {
        throw 'The pre-migration archive hash no longer matches its success receipt.'
    }

    $reportsRoot = Join-Path $stateRoot 'Restore Reports'
    if (-not (Test-Path -LiteralPath $reportsRoot -PathType Container)) {
        throw 'No isolated restore rehearsal reports were found.'
    }
    $matchingRestore = Get-ChildItem -LiteralPath $reportsRoot -Filter 'restore-*-passed.json' -File |
        Sort-Object LastWriteTimeUtc -Descending |
        ForEach-Object {
            Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
        } |
        Where-Object {
            $_.result -ceq 'passed' -and
            $_.sourceArchiveName -ceq $lastSuccess.archiveName -and
            $_.sourceArchiveSha256 -ceq $lastSuccess.archiveSha256
        } |
        Select-Object -First 1
    if ($null -eq $matchingRestore) {
        throw 'The current pre-migration archive has not passed an isolated restore rehearsal.'
    }
}

$linkedRefPath = Join-Path $repoRoot 'supabase\.temp\project-ref'
if (-not (Test-Path -LiteralPath $linkedRefPath -PathType Leaf) -or
    (Get-Content -LiteralPath $linkedRefPath -Raw).Trim() -cne $settings.projectRef) {
    throw 'The linked Supabase project does not match the configured production project.'
}

& npx.cmd supabase db push --linked --dry-run
if ($LASTEXITCODE -ne 0) {
    throw 'Supabase linked migration dry-run failed.'
}

$stateRoot = Split-Path -Parent $SettingsPath
$reportsRoot = Join-Path $stateRoot 'Migration Reports'
if (-not (Test-Path -LiteralPath $reportsRoot -PathType Container)) {
    New-Item -ItemType Directory -Path $reportsRoot -Force:$false | Out-Null
}
Set-RestrictivePathPermissions -Path $reportsRoot -IsDirectory $true
$reportPath = Join-Path $reportsRoot (
    'migration-check-{0}.json' -f [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
)
$report = [ordered]@{
    checkedAtUtc = [DateTime]::UtcNow.ToString('o')
    projectRef = $settings.projectRef
    maximumBackupAgeMinutes = $MaximumBackupAgeMinutes
    approvalReference = if ($highRisk.Count -gt 0) { $ApprovalReference } else { $null }
    findings = $findings
    linkedDryRun = 'passed'
}
$report | ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath $reportPath -Encoding UTF8
Set-RestrictivePathPermissions -Path $reportPath -IsDirectory $false

$findings | Format-Table migration, classification, signals -AutoSize
Write-Output "Migration safety gate passed. Report: $reportPath"
