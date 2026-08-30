[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9]{20}$')]
    [string] $ExpectedProjectRef,

    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string] $ExactCountInventoryPath,

    [Parameter(Mandatory = $true)]
    [switch] $WritesFrozen,

    [Parameter()]
    [string] $OutputRoot
)

$ErrorActionPreference = 'Stop'

function Invoke-SupabaseDump {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments,

        [Parameter(Mandatory = $true)]
        [string] $ArtifactName
    )

    & $script:NpxCommand.Source supabase db dump @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Supabase failed while creating $ArtifactName. No backup is verified."
    }
}

function Set-RestrictivePathPermissions {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path,

        [Parameter(Mandatory = $true)]
        [bool] $IsDirectory
    )

    if ($env:OS -eq 'Windows_NT') {
        $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $grant = if ($IsDirectory) {
            "${identity}:(OI)(CI)F"
        } else {
            "${identity}:F"
        }

        & icacls.exe $Path '/inheritance:r' '/grant:r' $grant | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Could not apply a restrictive Windows ACL to $Path."
        }
        return
    }

    $chmod = Get-Command 'chmod' -ErrorAction SilentlyContinue
    if ($null -ne $chmod) {
        $mode = if ($IsDirectory) { '700' } else { '600' }
        & $chmod.Source $mode '--' $Path
        if ($LASTEXITCODE -ne 0) {
            throw "Could not apply restrictive permissions to $Path."
        }
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$linkedRefPath = Join-Path $repoRoot 'supabase/.temp/project-ref'
if (-not (Test-Path -LiteralPath $linkedRefPath -PathType Leaf)) {
    throw 'No linked Supabase project was found. Run supabase link, then retry with the expected project ref.'
}

$linkedProjectRef = (Get-Content -LiteralPath $linkedRefPath -Raw).Trim()
if ($linkedProjectRef -cne $ExpectedProjectRef) {
    throw 'The linked Supabase project does not match ExpectedProjectRef. Backup stopped.'
}

$script:NpxCommand = Get-Command 'npx' -ErrorAction Stop
$canonicalOutputRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $repoRoot 'backups')
)
if (-not [string]::IsNullOrWhiteSpace($OutputRoot)) {
    $candidateRoot = if ([System.IO.Path]::IsPathRooted($OutputRoot)) {
        [System.IO.Path]::GetFullPath($OutputRoot)
    } else {
        [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputRoot))
    }

    if (-not [string]::Equals(
        $candidateRoot.TrimEnd(
            [System.IO.Path]::DirectorySeparatorChar,
            [System.IO.Path]::AltDirectorySeparatorChar
        ),
        $canonicalOutputRoot.TrimEnd(
            [System.IO.Path]::DirectorySeparatorChar,
            [System.IO.Path]::AltDirectorySeparatorChar
        ),
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw 'OutputRoot must be the repository backups directory. Arbitrary backup destinations are not allowed.'
    }
}
$OutputRoot = $canonicalOutputRoot

if (-not $WritesFrozen.IsPresent) {
    throw 'WritesFrozen must be acknowledged after application writes and workers are paused.'
}

if (-not (Test-Path -LiteralPath $OutputRoot -PathType Container)) {
    New-Item -ItemType Directory -Path $OutputRoot -Force:$false | Out-Null
}
Set-RestrictivePathPermissions -Path $OutputRoot -IsDirectory $true

$timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$backupDirectory = Join-Path $OutputRoot "beta-$timestamp"
if (Test-Path -LiteralPath $backupDirectory) {
    throw 'The timestamped backup directory already exists. Backup stopped to avoid overwriting files.'
}

New-Item -ItemType Directory -Path $backupDirectory -Force:$false | Out-Null
Set-RestrictivePathPermissions -Path $backupDirectory -IsDirectory $true

$rolesPath = Join-Path $backupDirectory 'roles.sql'
$schemaPath = Join-Path $backupDirectory 'schema.sql'
$dataPath = Join-Path $backupDirectory 'data.sql'
$countsPath = Join-Path $backupDirectory 'exact-row-counts.csv'
$schemas = 'public,auth,storage'

$resolvedInventoryPath = (Resolve-Path -LiteralPath $ExactCountInventoryPath).Path
Copy-Item -LiteralPath $resolvedInventoryPath -Destination $countsPath
$countInventory = Get-Item -LiteralPath $countsPath
if ($countInventory.Length -eq 0) {
    throw 'The exact row-count inventory is empty. Backup stopped.'
}
Set-RestrictivePathPermissions -Path $countsPath -IsDirectory $false

Invoke-SupabaseDump `
    -ArtifactName 'the role dump' `
    -Arguments @('--linked', '--role-only', '--file', $rolesPath, '--log-level', 'error')
Invoke-SupabaseDump `
    -ArtifactName 'the schema dump' `
    -Arguments @('--linked', '--schema', $schemas, '--file', $schemaPath, '--log-level', 'error')
Invoke-SupabaseDump `
    -ArtifactName 'the data dump' `
    -Arguments @(
        '--linked',
        '--data-only',
        '--use-copy',
        '--schema',
        $schemas,
        '--file',
        $dataPath,
        '--log-level',
        'error'
    )

$files = @($rolesPath, $schemaPath, $dataPath, $countsPath) | ForEach-Object {
    $file = Get-Item -LiteralPath $_
    if ($file.Length -eq 0) {
        throw "$($file.Name) is empty. No backup is verified."
    }
    Set-RestrictivePathPermissions -Path $file.FullName -IsDirectory $false

    [ordered]@{
        name = $file.Name
        bytes = $file.Length
        sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}

$manifest = [ordered]@{
    formatVersion = 2
    createdAtUtc = [DateTime]::UtcNow.ToString('o')
    projectRef = $ExpectedProjectRef
    schemas = @('public', 'auth', 'storage')
    files = $files
}

$manifestPath = Join-Path $backupDirectory 'manifest.json'
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Output "Backup artifacts created at: $backupDirectory"
Write-Output 'Run scripts/Verify-BetaBackup.ps1 before any destructive operation.'
