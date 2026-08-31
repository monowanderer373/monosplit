[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9]{20}$')]
    [string] $ExpectedProjectRef,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-zA-Z0-9.-]+$')]
    [string] $DatabaseHost,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-zA-Z0-9._-]+$')]
    [string] $DatabaseUser,

    [Parameter()]
    [ValidateRange(1, 65535)]
    [int] $DatabasePort = 5432,

    [Parameter()]
    [string] $DestinationRoot,

    [Parameter()]
    [string] $SettingsPath
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ProductionBackup.Common.ps1')

function ConvertTo-PlainText {
    param(
        [Parameter(Mandatory = $true)]
        [securestring] $SecureValue
    )

    return ([System.Net.NetworkCredential]::new('', $SecureValue)).Password
}

function Get-OneDriveRoots {
    $candidateRoots = [System.Collections.Generic.List[string]]::new()
    @(
        $env:OneDrive,
        $env:OneDriveConsumer,
        $env:OneDriveCommercial
    ) | Where-Object {
        -not [string]::IsNullOrWhiteSpace([string]$_)
    } | ForEach-Object {
        $candidateRoots.Add([string]$_)
    }

    $accountsPath = 'HKCU:\Software\Microsoft\OneDrive\Accounts'
    if (Test-Path -LiteralPath $accountsPath) {
        $accountKeys = @(Get-ChildItem `
            -LiteralPath $accountsPath `
            -ErrorAction SilentlyContinue)
        foreach ($accountKey in $accountKeys) {
            try {
                $accountProperties = Get-ItemProperty `
                    -LiteralPath $accountKey.PSPath `
                    -ErrorAction Stop
                $userFolderProperty = $accountProperties.PSObject.Properties['UserFolder']
                if ($null -eq $userFolderProperty -or
                    [string]::IsNullOrWhiteSpace([string]$userFolderProperty.Value)) {
                    continue
                }

                $candidateRoots.Add([string]$userFolderProperty.Value)
            } catch {
                # Stale, partially removed, or inaccessible OneDrive accounts
                # are ignored. Valid Personal and Business entries continue.
                continue
            }
        }
    }

    $validRoots = foreach ($candidateRoot in $candidateRoots) {
        try {
            if (Test-Path `
                -LiteralPath $candidateRoot `
                -PathType Container `
                -ErrorAction Stop) {
                [System.IO.Path]::GetFullPath($candidateRoot).TrimEnd('\')
            }
        } catch {
            # Invalid paths and stale sync locations are not selectable.
            continue
        }
    }

    return @($validRoots | Sort-Object -Unique)
}

if ([string]::IsNullOrWhiteSpace($SettingsPath)) {
    $SettingsPath = Get-DefaultBackupSettingsPath
}
$SettingsPath = [System.IO.Path]::GetFullPath($SettingsPath)

if ([string]::IsNullOrWhiteSpace($DestinationRoot)) {
    $oneDriveRoots = @(Get-OneDriveRoots)
    $selectedRoot = $null
    if ($oneDriveRoots.Count -eq 0) {
        Write-Warning 'No existing OneDrive Personal or Business sync folder was detected.'
        $manualDestination = Read-Host `
            'Enter an existing folder path for encrypted production backups'
        if ([string]::IsNullOrWhiteSpace($manualDestination)) {
            throw 'No backup destination was entered. Setup was cancelled before requesting credentials.'
        }

        try {
            $manualDestination = [System.IO.Path]::GetFullPath($manualDestination)
        } catch {
            throw 'The manually entered backup destination is not a valid path.'
        }
        if (-not (Test-Path `
            -LiteralPath $manualDestination `
            -PathType Container `
            -ErrorAction SilentlyContinue)) {
            throw 'The manually entered backup destination must be an existing folder.'
        }
        $DestinationRoot = $manualDestination
    } elseif ($oneDriveRoots.Count -eq 1) {
        $selectedRoot = $oneDriveRoots[0]
    } else {
        Write-Output 'Multiple OneDrive sync roots were detected:'
        for ($index = 0; $index -lt $oneDriveRoots.Count; $index++) {
            Write-Output ("[{0}] {1}" -f ($index + 1), $oneDriveRoots[$index])
        }

        $selection = Read-Host 'Select the OneDrive root number'
        $selectedIndex = 0
        if (-not [int]::TryParse($selection, [ref]$selectedIndex) -or
            $selectedIndex -lt 1 -or
            $selectedIndex -gt $oneDriveRoots.Count) {
            throw 'A valid OneDrive root was not selected.'
        }
        $selectedRoot = $oneDriveRoots[$selectedIndex - 1]
    }

    if (-not [string]::IsNullOrWhiteSpace($selectedRoot)) {
        $DestinationRoot = Join-Path $selectedRoot 'Tabby Tally\Production Backups'
    }
}
$DestinationRoot = [System.IO.Path]::GetFullPath($DestinationRoot)

$null = Get-GnuPgPath
$null = Get-Command 'docker.exe' -ErrorAction Stop
Import-Module CredentialManager -ErrorAction Stop

$databaseCredentialTarget = 'TabbyTally/ProductionDatabase'
$archiveCredentialTarget = 'TabbyTally/BackupArchive'

$databaseCredential = Get-Credential `
    -UserName $DatabaseUser `
    -Message 'Enter the Supabase production database password. It will be stored in Windows Credential Manager.'
if ($null -eq $databaseCredential) {
    throw 'Database credential setup was cancelled.'
}
$databasePassword = $databaseCredential.GetNetworkCredential().Password
if ([string]::IsNullOrWhiteSpace($databasePassword)) {
    throw 'The database password cannot be empty.'
}

$archiveSecure = Read-Host `
    'Enter a new backup archive passphrase (minimum 20 characters)' `
    -AsSecureString
$archiveConfirmationSecure = Read-Host `
    'Confirm the backup archive passphrase' `
    -AsSecureString
$archivePassword = ConvertTo-PlainText -SecureValue $archiveSecure
$archiveConfirmation = ConvertTo-PlainText -SecureValue $archiveConfirmationSecure
if ($archivePassword.Length -lt 20) {
    throw 'The backup archive passphrase must contain at least 20 characters.'
}
if ($archivePassword -cne $archiveConfirmation) {
    throw 'The backup archive passphrases do not match.'
}

New-StoredCredential `
    -Target $databaseCredentialTarget `
    -UserName $DatabaseUser `
    -Password $databasePassword `
    -Type Generic `
    -Persist LocalMachine | Out-Null
New-StoredCredential `
    -Target $archiveCredentialTarget `
    -UserName 'archive' `
    -Password $archivePassword `
    -Type Generic `
    -Persist LocalMachine | Out-Null

if (-not (Test-Path -LiteralPath $DestinationRoot -PathType Container)) {
    New-Item -ItemType Directory -Path $DestinationRoot -Force:$false | Out-Null
}

$settingsDirectory = Split-Path -Parent $SettingsPath
if (-not (Test-Path -LiteralPath $settingsDirectory -PathType Container)) {
    New-Item -ItemType Directory -Path $settingsDirectory -Force:$false | Out-Null
}

$settings = [ordered]@{
    formatVersion = 1
    projectRef = $ExpectedProjectRef
    databaseHost = $DatabaseHost
    databasePort = $DatabasePort
    databaseName = 'postgres'
    databaseUser = $DatabaseUser
    sslMode = 'require'
    databaseCredentialTarget = $databaseCredentialTarget
    archiveCredentialTarget = $archiveCredentialTarget
    destinationRoot = $DestinationRoot
    postgresImage = 'public.ecr.aws/supabase/postgres:17.6.1.104'
    dailyRetentionCount = 14
    preMigrationRetentionDays = 90
}
$settings | ConvertTo-Json -Depth 3 |
    Set-Content -LiteralPath $SettingsPath -Encoding UTF8

Set-RestrictivePathPermissions -Path $settingsDirectory -IsDirectory $true
Set-RestrictivePathPermissions -Path $SettingsPath -IsDirectory $false
Set-RestrictivePathPermissions -Path $DestinationRoot -IsDirectory $true

$databasePassword = $null
$archivePassword = $null
$archiveConfirmation = $null

Write-Output "Production backup settings saved at: $SettingsPath"
Write-Output "Encrypted archives will be written to: $DestinationRoot"
Write-Output 'No database or archive password was written to disk.'
