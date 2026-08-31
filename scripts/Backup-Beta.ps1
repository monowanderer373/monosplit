[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet('Daily', 'PreMigration')]
    [string] $Mode = 'Daily',

    [Parameter()]
    [switch] $WritesFrozen,

    [Parameter()]
    [switch] $Force,

    [Parameter()]
    [string] $SettingsPath
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ProductionBackup.Common.ps1')

function Remove-ExpiredBackups {
    param(
        [Parameter(Mandatory = $true)]
        [pscustomobject] $Settings
    )

    $dailyArchives = @(Get-ChildItem `
        -LiteralPath $Settings.destinationRoot `
        -Filter 'tabby-tally-*-daily.backup.enc' `
        -File |
        Sort-Object LastWriteTimeUtc -Descending)
    $dailyArchives |
        Select-Object -Skip ([int]$Settings.dailyRetentionCount) |
        Remove-Item -Force

    $preMigrationCutoff = [DateTime]::UtcNow.AddDays(
        -[int]$Settings.preMigrationRetentionDays
    )
    Get-ChildItem `
        -LiteralPath $Settings.destinationRoot `
        -Filter 'tabby-tally-*-pre-migration.backup.enc' `
        -File |
        Where-Object { $_.LastWriteTimeUtc -lt $preMigrationCutoff } |
        Remove-Item -Force
}

if ([string]::IsNullOrWhiteSpace($SettingsPath)) {
    $SettingsPath = Get-DefaultBackupSettingsPath
}
$SettingsPath = [System.IO.Path]::GetFullPath($SettingsPath)
if (-not (Test-Path -LiteralPath $SettingsPath -PathType Leaf)) {
    throw "Backup settings were not found at $SettingsPath. Run Initialize-ProductionBackup.ps1 first."
}

$settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
if ($settings.formatVersion -ne 1) {
    throw 'The production backup settings version is unsupported.'
}
if ($Mode -ceq 'PreMigration' -and -not $WritesFrozen.IsPresent) {
    throw 'PreMigration backups require WritesFrozen after application writes have drained.'
}
if (-not (Test-Path -LiteralPath $settings.destinationRoot -PathType Container)) {
    throw 'The configured encrypted backup destination is unavailable.'
}

$stateRoot = Split-Path -Parent $SettingsPath
$logsRoot = Join-Path $stateRoot 'Logs'
$tempRoot = Join-Path $stateRoot 'Temp'
foreach ($directory in @($logsRoot, $tempRoot)) {
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
        New-Item -ItemType Directory -Path $directory -Force:$false | Out-Null
    }
    Set-RestrictivePathPermissions -Path $directory -IsDirectory $true
}

$timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$purpose = if ($Mode -ceq 'Daily') { 'daily' } else { 'pre-migration' }
$logPath = Join-Path $logsRoot "backup-$timestamp-$purpose.log"
New-Item -ItemType File -Path $logPath -Force:$false | Out-Null
Set-RestrictivePathPermissions -Path $logPath -IsDirectory $false
Write-BackupLog -LogPath $logPath -Message "START mode=$purpose"

$databasePassword = $null
$archivePassword = $null
$runRoot = $null

try {
    if ($Mode -ceq 'Daily' -and -not $Force.IsPresent) {
        $todayArchive = Get-ChildItem `
            -LiteralPath $settings.destinationRoot `
            -Filter 'tabby-tally-*-daily.backup.enc' `
            -File |
            Where-Object { $_.LastWriteTime.Date -eq [DateTime]::Now.Date } |
            Select-Object -First 1
        if ($null -ne $todayArchive) {
            Remove-ExpiredBackups -Settings $settings
            Write-BackupLog -LogPath $logPath -Message 'SUCCESS daily archive already exists; retention verified'
            Write-Output 'A verified daily archive already exists for today. No duplicate was created.'
            exit 0
        }
    }

    $databasePassword = Get-StoredBackupSecret -Target $settings.databaseCredentialTarget
    $archivePassword = Get-StoredBackupSecret -Target $settings.archiveCredentialTarget
    $gpgPath = Get-GnuPgPath
    $null = Get-Command 'docker.exe' -ErrorAction Stop

    $runRoot = Join-Path $tempRoot ([Guid]::NewGuid().ToString('N'))
    $artifactRoot = Join-Path $runRoot 'artifact'
    New-Item -ItemType Directory -Path $runRoot -Force:$false | Out-Null
    New-Item -ItemType Directory -Path $artifactRoot -Force:$false | Out-Null
    Set-RestrictivePathPermissions -Path $runRoot -IsDirectory $true
    Set-RestrictivePathPermissions -Path $artifactRoot -IsDirectory $true

    $inventoryScript = Join-Path $artifactRoot '_inventory.psql'
    @'
\set ON_ERROR_STOP on
create temporary table backup_exact_row_counts (
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
    insert into backup_exact_row_counts values (
      target.schema_name,
      target.relation_name,
      row_count
    );
  end loop;
end
$$;
\copy (select schema_name, relation_name, exact_rows from backup_exact_row_counts order by schema_name, relation_name) to '/backup/exact-row-counts.csv' with (format csv, header true)
'@ | Set-Content -LiteralPath $inventoryScript -Encoding UTF8

    $metadataScript = Join-Path $artifactRoot '_metadata.psql'
    @'
\set ON_ERROR_STOP on
\copy (select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check from pg_catalog.pg_policies where schemaname in ('public', 'private') order by schemaname, tablename, policyname) to '/backup/rls-policies.csv' with (format csv, header true)
\copy (select version, name from supabase_migrations.schema_migrations order by version) to '/backup/migration-state.csv' with (format csv, header true)
'@ | Set-Content -LiteralPath $metadataScript -Encoding UTF8

    $connectionArguments = @(
        "--host=$($settings.databaseHost)",
        "--port=$($settings.databasePort)",
        "--username=$($settings.databaseUser)",
        "--dbname=$($settings.databaseName)"
    )
    Invoke-DockerDatabaseTool `
        -Image $settings.postgresImage `
        -MountDirectory $artifactRoot `
        -DatabasePassword $databasePassword `
        -SslMode $settings.sslMode `
        -Tool 'pg_dump' `
        -ToolArguments (
            $connectionArguments + @(
                '--format=custom',
                '--compress=9',
                '--no-owner',
                '--schema=public',
                '--schema=auth',
                '--schema=storage',
                '--schema=private',
                '--file=/backup/database.dump'
            )
        ) `
        -Stage 'Logical database dump'
    Write-BackupLog -LogPath $logPath -Message 'PASS logical database dump'

    foreach ($scriptName in @('_inventory.psql', '_metadata.psql')) {
        Invoke-DockerDatabaseTool `
            -Image $settings.postgresImage `
            -MountDirectory $artifactRoot `
            -DatabasePassword $databasePassword `
            -SslMode $settings.sslMode `
            -Tool 'psql' `
            -ToolArguments (
                $connectionArguments + @(
                    '--no-psqlrc',
                    '--quiet',
                    '--set=ON_ERROR_STOP=1',
                    "--file=/backup/$scriptName"
                )
            ) `
            -Stage "Database metadata capture ($scriptName)"
    }
    Remove-Item -LiteralPath $inventoryScript, $metadataScript -Force
    Write-BackupLog -LogPath $logPath -Message 'PASS exact counts, RLS policies, and migration state'

    $docker = Get-Command 'docker.exe' -ErrorAction Stop
    $mount = ([System.IO.Path]::GetFullPath($artifactRoot)).TrimEnd('\')
    & $docker.Source run --rm --volume "${mount}:/backup" `
        $settings.postgresImage `
        sh -c 'pg_restore --list /backup/database.dump > /backup/dump-toc.list' *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Logical dump structure validation failed with exit code $LASTEXITCODE."
    }

    $repoRoot = Split-Path -Parent $PSScriptRoot
    $gitSha = (& git -C $repoRoot rev-parse HEAD 2>$null).Trim()
    if ($LASTEXITCODE -ne 0 -or $gitSha -notmatch '^[a-f0-9]{40}$') {
        throw 'The current Git commit could not be recorded.'
    }

    $fileEntries = @(
        'database.dump',
        'dump-toc.list',
        'exact-row-counts.csv',
        'rls-policies.csv',
        'migration-state.csv'
    ) | ForEach-Object {
        $file = Get-Item -LiteralPath (Join-Path $artifactRoot $_)
        if ($file.Length -eq 0) {
            throw "$($_) is empty."
        }
        Set-RestrictivePathPermissions -Path $file.FullName -IsDirectory $false
        [ordered]@{
            name = $file.Name
            bytes = $file.Length
            sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }

    $manifest = [ordered]@{
        formatVersion = 3
        createdAtUtc = [DateTime]::UtcNow.ToString('o')
        projectRef = $settings.projectRef
        purpose = $purpose
        gitCommitSha = $gitSha
        schemas = @('public', 'auth', 'storage', 'private')
        logicalRestoreExclusions = @(
            'auth.schema_migrations',
            'storage.migrations'
        )
        files = $fileEntries
    }
    $manifestPath = Join-Path $artifactRoot 'manifest.json'
    $manifest | ConvertTo-Json -Depth 5 |
        Set-Content -LiteralPath $manifestPath -Encoding UTF8
    Set-RestrictivePathPermissions -Path $manifestPath -IsDirectory $false

    & (Join-Path $PSScriptRoot 'Verify-BetaBackup.ps1') `
        -BackupDirectory $artifactRoot `
        -ExpectedProjectRef $settings.projectRef *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'The plaintext logical backup failed integrity verification.'
    }
    Write-BackupLog -LogPath $logPath -Message 'PASS manifest and plaintext integrity verification'

    $zipPath = Join-Path $runRoot 'backup.zip'
    Compress-Archive `
        -Path (Join-Path $artifactRoot '*') `
        -DestinationPath $zipPath `
        -CompressionLevel Optimal
    $zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash

    $gpgHome = Join-Path $runRoot 'gnupg'
    New-Item -ItemType Directory -Path $gpgHome -Force:$false | Out-Null
    Set-RestrictivePathPermissions -Path $gpgHome -IsDirectory $true
    $encryptedPath = Join-Path $runRoot 'backup.enc'
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
            '--symmetric',
            '--cipher-algo',
            'AES256',
            '--compress-algo',
            'none',
            '--output',
            $encryptedPath,
            $zipPath
        ) `
        -Stage 'AES-256 archive encryption'

    $decryptedZipPath = Join-Path $runRoot 'verification.zip'
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
            $decryptedZipPath,
            $encryptedPath
        ) `
        -Stage 'Encrypted archive open test'
    if ((Get-FileHash -LiteralPath $decryptedZipPath -Algorithm SHA256).Hash -cne $zipHash) {
        throw 'The decrypted verification archive does not match its plaintext source.'
    }

    $verificationRoot = Join-Path $runRoot 'verification'
    Expand-Archive -LiteralPath $decryptedZipPath -DestinationPath $verificationRoot
    & (Join-Path $PSScriptRoot 'Verify-BetaBackup.ps1') `
        -BackupDirectory $verificationRoot `
        -ExpectedProjectRef $settings.projectRef *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'The decrypted archive failed backup integrity verification.'
    }
    Write-BackupLog -LogPath $logPath -Message 'PASS AES-256 encryption and decrypt/open verification'

    $archiveName = "tabby-tally-$timestamp-$purpose.backup.enc"
    $finalPath = Join-Path $settings.destinationRoot $archiveName
    if (Test-Path -LiteralPath $finalPath) {
        throw 'The final encrypted archive name already exists.'
    }
    Move-Item -LiteralPath $encryptedPath -Destination $finalPath

    $lastSuccess = [ordered]@{
        completedAtUtc = [DateTime]::UtcNow.ToString('o')
        mode = $purpose
        archiveName = $archiveName
        archiveBytes = (Get-Item -LiteralPath $finalPath).Length
        archiveSha256 = (Get-FileHash -LiteralPath $finalPath -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    $lastSuccessPath = Join-Path $stateRoot 'last-success.json'
    $lastSuccess | ConvertTo-Json |
        Set-Content -LiteralPath $lastSuccessPath -Encoding UTF8
    Set-RestrictivePathPermissions -Path $lastSuccessPath -IsDirectory $false

    Remove-ExpiredBackups -Settings $settings
    Write-BackupLog -LogPath $logPath -Message "SUCCESS archive=$archiveName"
    Write-Output "Verified encrypted backup created: $finalPath"
} catch {
    Write-BackupLog -LogPath $logPath -Message "FAILED stage=$($_.Exception.Message)"
    Write-Error 'Production backup failed. Review the local backup log; no secret was logged.'
    exit 1
} finally {
    $databasePassword = $null
    $archivePassword = $null
    if ($null -ne $runRoot -and
        (Test-Path -LiteralPath $runRoot -PathType Container)) {
        Remove-Item -LiteralPath $runRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
