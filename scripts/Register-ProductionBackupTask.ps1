[CmdletBinding()]
param(
    [Parameter()]
    [string] $SettingsPath,

    [Parameter()]
    [ValidatePattern('^\d{2}:\d{2}$')]
    [string] $DailyTime = '03:00',

    [Parameter()]
    [string] $TaskName = 'Tabby Tally Production Backup'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ProductionBackup.Common.ps1')

if ([string]::IsNullOrWhiteSpace($SettingsPath)) {
    $SettingsPath = Get-DefaultBackupSettingsPath
}
$SettingsPath = [System.IO.Path]::GetFullPath($SettingsPath)
if (-not (Test-Path -LiteralPath $SettingsPath -PathType Leaf)) {
    throw 'Production backup settings are missing. Run Initialize-ProductionBackup.ps1 first.'
}

$backupScriptPath = Join-Path $PSScriptRoot 'Backup-Beta.ps1'
$repoRoot = Split-Path -Parent $PSScriptRoot
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$windowsCredential = Get-Credential `
    -UserName $identity `
    -Message 'Enter the Windows account password used by Task Scheduler. It is not written to repository files or logs.'
if ($null -eq $windowsCredential) {
    throw 'Scheduled task registration was cancelled.'
}
$windowsPassword = $windowsCredential.GetNetworkCredential().Password
if ([string]::IsNullOrWhiteSpace($windowsPassword)) {
    throw 'The Windows account password cannot be empty.'
}

$timeParts = $DailyTime.Split(':')
$dailyStart = [DateTime]::Today.AddHours([int]$timeParts[0]).AddMinutes([int]$timeParts[1])
$actionArguments = @(
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy Bypass',
    "-File `"$backupScriptPath`"",
    '-Mode Daily',
    "-SettingsPath `"$SettingsPath`""
) -join ' '

$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument $actionArguments `
    -WorkingDirectory $repoRoot
$triggers = @(
    (New-ScheduledTaskTrigger -Daily -At $dailyStart),
    (New-ScheduledTaskTrigger -AtLogOn -User $identity)
)
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 30) `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -MultipleInstances IgnoreNew `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $triggers `
        -Settings $settings `
        -User $identity `
        -Password $windowsPassword `
        -Description 'Creates and verifies an encrypted Tabby Tally production database backup.' `
        -Force | Out-Null
} finally {
    $windowsPassword = $null
    $windowsCredential = $null
}

$registeredTask = Get-ScheduledTask -TaskName $TaskName
if ($registeredTask.State -eq 'Disabled') {
    throw 'The scheduled backup task was registered but is disabled.'
}

Write-Output "Scheduled task registered: $TaskName"
Write-Output "Triggers: daily at $DailyTime and at current-user logon."
Write-Output 'The task does not wake the computer and does not run concurrent instances.'
