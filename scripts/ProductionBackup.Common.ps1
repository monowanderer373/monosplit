Set-StrictMode -Version Latest

function Get-DefaultBackupSettingsPath {
    $stateRoot = Join-Path $env:LOCALAPPDATA 'TabbyTally\Backup'
    return Join-Path $stateRoot 'backup-settings.json'
}

function Set-RestrictivePathPermissions {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path,

        [Parameter(Mandatory = $true)]
        [bool] $IsDirectory
    )

    if ($env:OS -ne 'Windows_NT') {
        throw 'Production backup automation currently supports Windows only.'
    }

    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $grant = if ($IsDirectory) {
        "${identity}:(OI)(CI)F"
    } else {
        "${identity}:F"
    }

    & icacls.exe $Path '/inheritance:r' '/grant:r' $grant | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not apply restrictive Windows permissions to $Path."
    }
}

function Get-GnuPgPath {
    $candidates = @(
        (Get-Command 'gpg.exe' -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
        (Join-Path $env:ProgramFiles 'GnuPG\bin\gpg.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'GnuPG\bin\gpg.exe')
    ) | Where-Object {
        -not [string]::IsNullOrWhiteSpace([string]$_) -and
        (Test-Path -LiteralPath $_ -PathType Leaf)
    } | Select-Object -Unique

    if (@($candidates).Count -eq 0) {
        throw 'GnuPG was not found. Install the Gpg4win package before running backups.'
    }

    return [string](@($candidates)[0])
}

function Get-StoredBackupSecret {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Target
    )

    Import-Module CredentialManager -ErrorAction Stop
    $credential = Get-StoredCredential -Target $Target
    if ($null -eq $credential) {
        throw "Windows Credential Manager entry '$Target' was not found."
    }

    $secret = $credential.GetNetworkCredential().Password
    if ([string]::IsNullOrWhiteSpace($secret)) {
        throw "Windows Credential Manager entry '$Target' has an empty password."
    }

    return $secret
}

function Invoke-DockerDatabaseTool {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Image,

        [Parameter(Mandatory = $true)]
        [string] $MountDirectory,

        [Parameter(Mandatory = $true)]
        [string] $DatabasePassword,

        [Parameter()]
        [ValidateSet('disable', 'prefer', 'require', 'verify-ca', 'verify-full')]
        [string] $SslMode = 'require',

        [Parameter(Mandatory = $true)]
        [string] $Tool,

        [Parameter(Mandatory = $true)]
        [string[]] $ToolArguments,

        [Parameter(Mandatory = $true)]
        [string] $Stage
    )

    $docker = Get-Command 'docker.exe' -ErrorAction Stop
    $mount = ([System.IO.Path]::GetFullPath($MountDirectory)).TrimEnd('\')
    $arguments = @(
        'run',
        '--rm',
        '-i',
        '--volume',
        "${mount}:/backup",
        $Image,
        'sh',
        '-c',
        'IFS= read -r PGPASSWORD; PGPASSWORD=${PGPASSWORD%?}; PGPASSWORD=${PGPASSWORD%__TABBY_END__}; export PGPASSWORD; export PGSSLMODE="$1"; shift; exec "$@"',
        '--',
        $SslMode,
        $Tool
    ) + $ToolArguments

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        ($DatabasePassword + '__TABBY_END__') | & $docker.Source @arguments *> $null
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($exitCode -ne 0) {
        throw "$Stage failed with exit code $exitCode."
    }
}

function Invoke-GnuPgWithSecret {
    param(
        [Parameter(Mandatory = $true)]
        [string] $GnuPgPath,

        [Parameter(Mandatory = $true)]
        [string] $Secret,

        [Parameter(Mandatory = $true)]
        [string[]] $Arguments,

        [Parameter(Mandatory = $true)]
        [string] $Stage
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $toolOutput = @($Secret | & $GnuPgPath @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($exitCode -ne 0) {
        $outputText = $toolOutput -join "`n"
        $failureClass = if ($outputText -match '(?i)bad session key|decryption failed') {
            'decryption-rejected'
        } elseif ($outputText -match '(?i)no such file|can.t open') {
            'input-unavailable'
        } elseif ($outputText -match '(?i)file exists|can.t create') {
            'output-unavailable'
        } elseif ($outputText -match '(?i)invalid option|usage:') {
            'invalid-arguments'
        } else {
            'tool-error'
        }
        throw "$Stage failed with exit code $exitCode ($failureClass)."
    }
}

function Write-BackupLog {
    param(
        [Parameter(Mandatory = $true)]
        [string] $LogPath,

        [Parameter(Mandatory = $true)]
        [string] $Message
    )

    $line = '{0} {1}' -f [DateTime]::UtcNow.ToString('o'), $Message
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}
