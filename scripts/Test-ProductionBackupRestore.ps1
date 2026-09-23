[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string] $ArchivePath,

    [Parameter()]
    [string] $SettingsPath,

    [Parameter()]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string] $SourceHealthCsv,

    [Parameter()]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string] $SourceFunctionCsv
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ProductionBackup.Common.ps1')

function ConvertTo-GrantFlag {
    param([string] $Value)
    switch -Regex ($Value.Trim().ToLowerInvariant()) {
        '^(t|true|1)$' { return 'true' }
        '^(f|false|0)$' { return 'false' }
        default { return $Value.Trim().ToLowerInvariant() }
    }
}

function Invoke-CheckedDocker {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments,

        [Parameter(Mandatory = $true)]
        [string] $FailureMessage
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $toolOutput = @(& docker.exe @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($exitCode -ne 0) {
        $safeErrors = @($toolOutput |
            ForEach-Object { [string]$_ } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            ForEach-Object {
                $_ -replace '(?i)(password|token|secret|authorization)\s*=\s*\S+', '$1=[redacted]'
            } |
            Select-Object -First 3)
        $suffix = if ($safeErrors.Count -gt 0) {
            " $($safeErrors -join ' | ')"
        } else {
            ''
        }
        throw "$FailureMessage$suffix"
    }
}

if ([string]::IsNullOrWhiteSpace($SettingsPath)) {
    $SettingsPath = Get-DefaultBackupSettingsPath
}
$SettingsPath = [System.IO.Path]::GetFullPath($SettingsPath)
$ArchivePath = (Resolve-Path -LiteralPath $ArchivePath).Path
$settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
if ($settings.formatVersion -ne 1) {
    throw 'The production backup settings version is unsupported.'
}

$stateRoot = Split-Path -Parent $SettingsPath
$tempRoot = Join-Path $stateRoot 'Temp'
$reportsRoot = Join-Path $stateRoot 'Restore Reports'
foreach ($directory in @($tempRoot, $reportsRoot)) {
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
        New-Item -ItemType Directory -Path $directory -Force:$false | Out-Null
    }
    Set-RestrictivePathPermissions -Path $directory -IsDirectory $true
}

$timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$runRoot = Join-Path $tempRoot "restore-$([Guid]::NewGuid().ToString('N'))"
$artifactRoot = Join-Path $runRoot 'artifact'
New-Item -ItemType Directory -Path $runRoot -Force:$false | Out-Null
New-Item -ItemType Directory -Path $artifactRoot -Force:$false | Out-Null
Set-RestrictivePathPermissions -Path $runRoot -IsDirectory $true
$containerName = "tabby-tally-restore-$([Guid]::NewGuid().ToString('N'))"
$localPassword = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
$containerStarted = $false
$completed = $false
$failureStage = $null
$archivePassword = $null

try {
    $failureStage = 'stage encrypted archive'
    $localArchivePath = Join-Path $runRoot 'source.backup.enc'
    Copy-Item -LiteralPath $ArchivePath -Destination $localArchivePath
    if (
        (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash -cne
        (Get-FileHash -LiteralPath $localArchivePath -Algorithm SHA256).Hash
    ) {
        throw 'The staged encrypted archive does not match its source.'
    }

    $failureStage = 'decrypt'
    $archivePassword = Get-StoredBackupSecret -Target $settings.archiveCredentialTarget
    $gpgPath = Get-GnuPgPath
    $zipPath = Join-Path $runRoot 'backup.zip'
    $gpgHome = Join-Path $runRoot 'gnupg'
    New-Item -ItemType Directory -Path $gpgHome -Force:$false | Out-Null
    Set-RestrictivePathPermissions -Path $gpgHome -IsDirectory $true
    $decryptError = $null
    for ($decryptAttempt = 1; $decryptAttempt -le 3; $decryptAttempt++) {
        try {
            Invoke-GnuPgWithSecret `
                -GnuPgPath $gpgPath `
                -Secret $archivePassword `
                -Arguments @(
                    '--batch',
                    '--yes',
                    '--no-symkey-cache',
                    '--homedir',
                    $gpgHome,
                    '--pinentry-mode',
                    'loopback',
                    '--passphrase-fd',
                    '0',
                    '--decrypt',
                    '--output',
                    $zipPath,
                    $localArchivePath
                ) `
                -Stage 'Backup archive decryption'
            $decryptError = $null
            break
        } catch {
            $decryptError = $_
            Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
            if ($decryptAttempt -lt 3) {
                # Gpg4win can briefly retain a symmetric-key agent state after
                # an archive is created. A bounded delay keeps an immediate
                # backup-then-restore rehearsal deterministic.
                Start-Sleep -Seconds 10
            }
        }
    }
    if ($null -ne $decryptError) {
        throw $decryptError
    }
    $failureStage = 'expand archive'
    Expand-Archive -LiteralPath $zipPath -DestinationPath $artifactRoot

    $failureStage = 'archive manifest'
    $manifest = Get-Content `
        -LiteralPath (Join-Path $artifactRoot 'manifest.json') `
        -Raw |
        ConvertFrom-Json
    if ($manifest.formatVersion -ne 3) {
        throw 'Full restore rehearsal requires a format version 3 archive.'
    }
    $failureStage = 'archive integrity'
    & (Join-Path $PSScriptRoot 'Verify-BetaBackup.ps1') `
        -BackupDirectory $artifactRoot `
        -ExpectedProjectRef $settings.projectRef *> $null

    $failureStage = 'isolated database startup'
    $docker = Get-Command 'docker.exe' -ErrorAction Stop
    $mount = ([System.IO.Path]::GetFullPath($artifactRoot)).TrimEnd('\')
    Invoke-CheckedDocker `
        -Arguments @(
            'run',
            '--detach',
            '--name',
            $containerName,
            '--env',
            "POSTGRES_PASSWORD=$localPassword",
            '--volume',
            "${mount}:/backup",
            $settings.postgresImage
        ) `
        -FailureMessage 'The isolated restore database could not be started.'
    $containerStarted = $true

    $ready = $false
    $consecutiveReadyChecks = 0
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & $docker.Source exec $containerName `
            pg_isready --username postgres --dbname postgres *> $null
        $readyExitCode = $LASTEXITCODE
        $ErrorActionPreference = $previousErrorActionPreference
        if ($readyExitCode -eq 0) {
            $consecutiveReadyChecks++
            if ($consecutiveReadyChecks -ge 5) {
                $ready = $true
                break
            }
        } else {
            $consecutiveReadyChecks = 0
        }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) {
        throw 'The isolated restore database did not become ready within two minutes.'
    }

    $failureStage = 'schema reset'
    $dropSql = @'
drop schema if exists private cascade;
drop schema if exists public cascade;
drop schema if exists auth cascade;
drop schema if exists storage cascade;
'@
    Invoke-CheckedDocker `
        -Arguments @(
            'exec',
            '--env',
            "PGPASSWORD=$localPassword",
            $containerName,
            'psql',
            '--username',
            'supabase_admin',
            '--dbname',
            'postgres',
            '--set',
            'ON_ERROR_STOP=1',
            '--command',
            $dropSql
        ) `
        -FailureMessage 'The isolated restore schemas could not be reset.'

    $failureStage = 'logical restore'
    Invoke-CheckedDocker `
        -Arguments @(
            'exec',
            '--env',
            "PGPASSWORD=$localPassword",
            $containerName,
            'pg_restore',
            '--username',
            'supabase_admin',
            '--dbname',
            'postgres',
            '--no-owner',
            '--exit-on-error',
            '/backup/database.dump'
        ) `
        -FailureMessage 'The logical dump could not be restored into the isolated database.'

    $failureStage = 'verification queries'
    $verificationScript = Join-Path $artifactRoot '_restore-verification.psql'
    @'
\set ON_ERROR_STOP on
create temporary table restored_exact_row_counts (
  schema_name text not null,
  relation_name text not null,
  exact_rows bigint not null
) on commit preserve rows;
do $$
declare
  target record;
  row_count bigint;
begin
  for target in
    select namespace.nspname as schema_name, relation.relname as relation_name
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname in ('public', 'auth', 'storage', 'private')
      and relation.relkind in ('r', 'p')
    order by namespace.nspname, relation.relname
  loop
    execute pg_catalog.format(
      'select pg_catalog.count(*) from %I.%I',
      target.schema_name,
      target.relation_name
    ) into row_count;
    insert into restored_exact_row_counts values (
      target.schema_name,
      target.relation_name,
      row_count
    );
  end loop;
end
$$;
\copy (select schema_name, relation_name, exact_rows from restored_exact_row_counts order by schema_name, relation_name) to '/backup/restored-row-counts.csv' with (format csv, header true)
\copy (select check_name, violation_count from (values ('orphan_profile', (select count(*) from public.user_profiles p left join auth.users u on u.id = p.id where u.id is null)), ('orphan_account_participant', (select count(*) from public.participants p left join auth.users u on u.id = p.auth_user_id where p.kind = 'account' and u.id is null)), ('missing_identity_correlation', (select case when exists (select 1 from auth.users) and not exists (select 1 from auth.users u join public.user_profiles profile on profile.id = u.id join public.participants participant on participant.auth_user_id = u.id) then 1 else 0 end)), ('expense_participant_count_mismatch', (select count(*) from public.expenses e where e.participant_count <> (select count(*) from public.expense_participations ep where ep.expense_id = e.id))), ('payer_total_mismatch', (select count(*) from public.expenses e where e.total_minor <> coalesce((select sum(pc.amount_minor) from public.payer_contributions pc where pc.expense_id = e.id), 0))), ('share_total_mismatch', (select count(*) from public.expenses e where e.total_minor <> coalesce((select sum(es.amount_minor) from public.expense_shares es where es.expense_id = e.id), 0))), ('settlement_total_mismatch', (select count(*) from public.settlement_payments sp where sp.amount_minor <> coalesce((select sum(sa.amount_minor) from public.settlement_allocations sa where sa.settlement_payment_id = sp.id), 0))), ('legacy_invite_token_exposed', (select count(*) from private.legacy_beta_recovery recovery where recovery.row_data ? 'token'))) as checks(check_name, violation_count) order by check_name) to '/backup/restore-invariants.csv' with (format csv, header true)
\copy (select nspname as schema_name from pg_catalog.pg_namespace where nspname in ('public', 'auth', 'storage', 'private') order by nspname) to '/backup/restored-schemas.csv' with (format csv, header true)
\copy (select proc.oid::regprocedure::text as signature, pg_catalog.pg_get_function_result(proc.oid) as result_type, pg_catalog.has_function_privilege('authenticated', proc.oid, 'execute') as authenticated_execute, pg_catalog.has_function_privilege('anon', proc.oid, 'execute') as anon_execute, pg_catalog.has_function_privilege('public', proc.oid, 'execute') as public_execute from pg_catalog.pg_proc as proc join pg_catalog.pg_namespace as namespace on namespace.oid = proc.pronamespace where namespace.nspname = 'public' and proc.proname = 'respond_to_settlement' order by 1) to '/backup/restored-functions.csv' with (format csv, header true)
'@ | Set-Content -LiteralPath $verificationScript -Encoding UTF8

    Invoke-CheckedDocker `
        -Arguments @(
            'exec',
            '--env',
            "PGPASSWORD=$localPassword",
            $containerName,
            'psql',
            '--username',
            'supabase_admin',
            '--dbname',
            'postgres',
            '--no-psqlrc',
            '--quiet',
            '--set',
            'ON_ERROR_STOP=1',
            '--file',
            '/backup/_restore-verification.psql'
        ) `
        -FailureMessage 'The restored database verification queries failed.'

    $failureStage = 'row-count comparison'
    & (Join-Path $PSScriptRoot 'Compare-RestoreCounts.ps1') `
        -ExpectedCountsPath (Join-Path $artifactRoot 'exact-row-counts.csv') `
        -ActualCountsPath (Join-Path $artifactRoot 'restored-row-counts.csv') `
        -ExcludedRelations @($manifest.logicalRestoreExclusions) *> $null

    $failureStage = 'restore fidelity'
    $archiveLedger = @(Import-Csv -LiteralPath (Join-Path $artifactRoot 'migration-state.csv'))
    if ($archiveLedger.Count -lt 1) {
        throw 'The backup archive does not contain a migration ledger.'
    }
    $latestMigration = [string]($archiveLedger | Select-Object -Last 1).version
    if ([string]::IsNullOrWhiteSpace($latestMigration)) {
        throw 'The backup archive migration ledger has no latest version.'
    }
    $requiredSchemas = @('auth', 'private', 'public', 'storage')
    $restoredSchemas = @(
        Import-Csv -LiteralPath (Join-Path $artifactRoot 'restored-schemas.csv') |
            ForEach-Object { $_.schema_name }
    )
    $missingSchemas = @($requiredSchemas | Where-Object { $restoredSchemas -cnotcontains $_ })
    if ($missingSchemas.Count -gt 0) {
        throw "Restored schemas are missing: $($missingSchemas -join ', ')."
    }
    $functions = @(Import-Csv -LiteralPath (Join-Path $artifactRoot 'restored-functions.csv'))
    if ($functions.Count -lt 1) {
        throw 'The restored database has no respond_to_settlement function.'
    }
    if (-not [string]::IsNullOrWhiteSpace($SourceFunctionCsv)) {
        $sourceFunctions = @(Import-Csv -LiteralPath $SourceFunctionCsv)
        $restoredFunctionKeys = @($functions | ForEach-Object {
            '{0}|{1}|{2}|{3}|{4}' -f ($_.signature -replace '\s', ''), ($_.result_type.Trim()), (ConvertTo-GrantFlag $_.authenticated_execute), (ConvertTo-GrantFlag $_.anon_execute), (ConvertTo-GrantFlag $_.public_execute)
        } | Sort-Object)
        $sourceFunctionKeys = @($sourceFunctions | ForEach-Object {
            '{0}|{1}|{2}|{3}|{4}' -f ($_.signature -replace '\s', ''), ($_.result_type.Trim()), (ConvertTo-GrantFlag $_.authenticated_execute), (ConvertTo-GrantFlag $_.anon_execute), (ConvertTo-GrantFlag $_.public_execute)
        } | Sort-Object)
        if (($restoredFunctionKeys -join "`n") -cne ($sourceFunctionKeys -join "`n")) {
            throw ("Restore fidelity failed: respond_to_settlement signatures, return types, or grants differ from the source. restored=[{0}] source=[{1}]" -f ($restoredFunctionKeys -join '; '), ($sourceFunctionKeys -join '; '))
        }
    }
    $invariants = @(Import-Csv -LiteralPath (Join-Path $artifactRoot 'restore-invariants.csv'))
    $sourceHealthWarnings = @()
    if (-not [string]::IsNullOrWhiteSpace($SourceHealthCsv)) {
        $sourceInvariants = @(Import-Csv -LiteralPath $SourceHealthCsv)
        $sourceLookup = @{}
        foreach ($sourceInvariant in $sourceInvariants) {
            $sourceLookup[$sourceInvariant.check_name] = [long]$sourceInvariant.violation_count
        }
        foreach ($invariant in $invariants) {
            $checkName = [string]$invariant.check_name
            $restoredCount = [long]$invariant.violation_count
            if (-not $sourceLookup.ContainsKey($checkName)) {
                throw "Restore fidelity failed: source health check $checkName is missing."
            }
            if ($sourceLookup[$checkName] -ne $restoredCount) {
                throw "Restore fidelity failed: $checkName source=$($sourceLookup[$checkName]) restored=$restoredCount."
            }
            if ($restoredCount -ne 0) {
                $sourceHealthWarnings += [ordered]@{
                    check_name = $checkName
                    violation_count = $restoredCount
                }
            }
        }
    } else {
        foreach ($invariant in $invariants) {
            $restoredCount = [long]$invariant.violation_count
            if ($restoredCount -ne 0) {
                $sourceHealthWarnings += [ordered]@{
                    check_name = [string]$invariant.check_name
                    violation_count = $restoredCount
                }
            }
        }
    }
    $sourceHealth = if ($sourceHealthWarnings.Count -gt 0) {
        'SOURCE_HEALTH_WARNING'
    } else {
        'SOURCE_HEALTH_PASS'
    }

    $counts = @(Import-Csv -LiteralPath (Join-Path $artifactRoot 'restored-row-counts.csv'))
    $countLookup = @{}
    foreach ($count in $counts) {
        $countLookup["$($count.schema_name).$($count.relation_name)"] = [long]$count.exact_rows
    }
    $report = [ordered]@{
        completedAtUtc = [DateTime]::UtcNow.ToString('o')
        restoreFidelity = 'RESTORE_FIDELITY_PASS'
        sourceHealth = $sourceHealth
        sourceHealthWarnings = @($sourceHealthWarnings)
        sourceArchiveName = Split-Path -Leaf $ArchivePath
        sourceArchiveSha256 = (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
        projectRef = $settings.projectRef
        gitCommitSha = $manifest.gitCommitSha
        isolatedContainerImage = $settings.postgresImage
        restoredLedger = [ordered]@{
            migrationCount = [long]$archiveLedger.Count
            latestMigration = $latestMigration
            source = 'archive-migration-state'
        }
        restoredFunctions = @($functions | ForEach-Object {
            [ordered]@{
                signature = $_.signature
                resultType = $_.result_type
                authenticatedExecute = $_.authenticated_execute
                anonExecute = $_.anon_execute
                publicExecute = $_.public_execute
            }
        })
        verifiedCounts = [ordered]@{
            authUsers = $countLookup['auth.users']
            userProfiles = $countLookup['public.user_profiles']
            participants = $countLookup['public.participants']
            groups = $countLookup['public.spaces']
            memberships = $countLookup['public.space_members']
            expenses = $countLookup['public.expenses']
            payerContributions = $countLookup['public.payer_contributions']
            expenseShares = $countLookup['public.expense_shares']
            settlements = $countLookup['public.settlement_payments']
            settlementAllocations = $countLookup['public.settlement_allocations']
        }
        invariantChecks = @($invariants | ForEach-Object { $_.check_name })
    }
    $reportPath = Join-Path $reportsRoot "restore-$timestamp-passed.json"
    $report | ConvertTo-Json -Depth 5 |
        Set-Content -LiteralPath $reportPath -Encoding UTF8
    Set-RestrictivePathPermissions -Path $reportPath -IsDirectory $false
    $completed = $true

    Write-Output "RESTORE_FIDELITY_PASS"
    Write-Output $sourceHealth
    foreach ($warning in $sourceHealthWarnings) {
        Write-Output ("SOURCE_HEALTH_WARNING {0}={1}" -f $warning.check_name, $warning.violation_count)
    }
    Write-Output ("ARCHIVE_LEDGER count={0} latest={1}" -f $archiveLedger.Count, $latestMigration)
    Write-Output ("AUTH_USERS={0}" -f $countLookup['auth.users'])
    Write-Output ("STORAGE_OBJECTS={0}" -f $countLookup['storage.objects'])
    Write-Output ("STORAGE_BUCKETS={0}" -f $countLookup['storage.buckets'])
    foreach ($function in $functions) {
        Write-Output ("RESTORED_FUNCTION {0}=>{1} authenticated={2} anon={3} public={4}" -f $function.signature, $function.result_type, $function.authenticated_execute, $function.anon_execute, $function.public_execute)
    }
    Write-Output "Isolated restore verification finished. Report: $reportPath"
} catch {
    $failureReport = [ordered]@{
        completedAtUtc = [DateTime]::UtcNow.ToString('o')
        result = 'failed'
        stage = $failureStage
        safeReason = if ($failureStage -ceq 'decrypt' -and
            $_.Exception.Message -match '^Backup archive decryption failed') {
            $_.Exception.Message
        } elseif ($failureStage -ceq 'logical restore' -and
            $_.Exception.Message -match '^The logical dump could not be restored') {
            $_.Exception.Message
        } elseif ($failureStage -in @('verification queries', 'row-count comparison', 'restore fidelity')) {
            $_.Exception.Message
        } else {
            $null
        }
        sourceArchiveName = Split-Path -Leaf $ArchivePath
    }
    $failureReportPath = Join-Path $reportsRoot "restore-$timestamp-failed.json"
    $failureReport | ConvertTo-Json |
        Set-Content -LiteralPath $failureReportPath -Encoding UTF8
    Set-RestrictivePathPermissions -Path $failureReportPath -IsDirectory $false
    $visibleReason = if ($failureStage -in @('verification queries', 'row-count comparison', 'restore fidelity')) {
        $_.Exception.Message
    } else {
        $null
    }
    if ([string]::IsNullOrWhiteSpace($visibleReason)) {
        Write-Error "Isolated restore rehearsal failed during: $failureStage."
    } else {
        Write-Error "Isolated restore rehearsal failed during: $failureStage. $visibleReason"
    }
    exit 1
} finally {
    $archivePassword = $null
    $localPassword = $null
    if ($containerStarted) {
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & docker.exe rm --force $containerName *> $null
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if (Test-Path -LiteralPath $runRoot -PathType Container) {
        Remove-Item -LiteralPath $runRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if (-not $completed) {
    exit 1
}
