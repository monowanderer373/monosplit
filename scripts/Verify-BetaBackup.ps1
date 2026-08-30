[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $BackupDirectory,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9]{20}$')]
    [string] $ExpectedProjectRef
)

$ErrorActionPreference = 'Stop'

$resolvedDirectory = (Resolve-Path -LiteralPath $BackupDirectory).Path
$manifestPath = Join-Path $resolvedDirectory 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw 'manifest.json is missing. The backup cannot be verified.'
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.formatVersion -ne 2) {
    throw 'The backup manifest version is unsupported.'
}
if ([string]$manifest.projectRef -cne $ExpectedProjectRef) {
    throw 'The backup project ref does not match ExpectedProjectRef.'
}

$requiredFiles = @(
    'roles.sql',
    'schema.sql',
    'data.sql',
    'exact-row-counts.csv'
)
foreach ($requiredFile in $requiredFiles) {
    $entry = @($manifest.files | Where-Object { $_.name -ceq $requiredFile })
    if ($entry.Count -ne 1) {
        throw "The manifest must contain exactly one $requiredFile entry."
    }

    $filePath = Join-Path $resolvedDirectory $requiredFile
    if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        throw "$requiredFile is missing."
    }

    $file = Get-Item -LiteralPath $filePath
    if ($file.Length -eq 0 -or $file.Length -ne [long]$entry[0].bytes) {
        throw "$requiredFile has an unexpected size."
    }

    $actualHash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -cne [string]$entry[0].sha256) {
        throw "$requiredFile failed SHA-256 verification."
    }
}

$schemaPath = Join-Path $resolvedDirectory 'schema.sql'
$schemaText = Get-Content -LiteralPath $schemaPath -Raw
if ($schemaText -notmatch '(?im)^\s*create\s+(?:schema|table|function)\b') {
    throw 'schema.sql does not contain restorable schema definitions.'
}

$countsPath = Join-Path $resolvedDirectory 'exact-row-counts.csv'
$countRows = @(Import-Csv -LiteralPath $countsPath)
if ($countRows.Count -eq 0) {
    throw 'exact-row-counts.csv contains no table inventory.'
}
foreach ($countRow in $countRows) {
    if ([string]::IsNullOrWhiteSpace([string]$countRow.schema_name) -or
        [string]::IsNullOrWhiteSpace([string]$countRow.relation_name) -or
        [string]::IsNullOrWhiteSpace([string]$countRow.exact_rows)) {
        throw 'exact-row-counts.csv must contain schema_name, relation_name, and exact_rows values.'
    }

    $exactRows = 0L
    if (-not [long]::TryParse([string]$countRow.exact_rows, [ref]$exactRows) -or
        $exactRows -lt 0) {
        throw 'exact-row-counts.csv contains an invalid exact_rows value.'
    }
}

Write-Output 'Backup hashes, sizes, project ref, exact inventory, and schema structure passed verification.'
Write-Output 'A disposable restore and row-count comparison are still required before destructive work.'
