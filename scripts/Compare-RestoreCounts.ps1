[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string] $ExpectedCountsPath,

    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string] $ActualCountsPath,

    [Parameter()]
    [string[]] $ExcludedRelations = @(
        'auth.schema_migrations',
        'storage.migrations'
    )
)

$ErrorActionPreference = 'Stop'

function ConvertTo-CountMap {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    $map = @{}
    foreach ($row in @(Import-Csv -LiteralPath $Path)) {
        $key = "$($row.schema_name).$($row.relation_name)"
        if ($map.ContainsKey($key)) {
            throw "Duplicate relation $key was found in a count inventory."
        }

        $count = 0L
        if (-not [long]::TryParse([string]$row.exact_rows, [ref]$count) -or
            $count -lt 0) {
            throw "Relation $key has an invalid row count."
        }
        $map[$key] = $count
    }
    return $map
}

$expected = ConvertTo-CountMap -Path $ExpectedCountsPath
$actual = ConvertTo-CountMap -Path $ActualCountsPath
$differences = @()

foreach ($relation in @($expected.Keys | Sort-Object)) {
    if ($ExcludedRelations -ccontains $relation) {
        continue
    }
    if (-not $actual.ContainsKey($relation)) {
        $differences += "$relation expected=$($expected[$relation]) actual=missing"
        continue
    }
    if ($expected[$relation] -ne $actual[$relation]) {
        $differences += "$relation expected=$($expected[$relation]) actual=$($actual[$relation])"
    }
}

foreach ($relation in @($actual.Keys | Sort-Object)) {
    if ($ExcludedRelations -ccontains $relation) {
        continue
    }
    if (-not $expected.ContainsKey($relation)) {
        $differences += "$relation expected=missing actual=$($actual[$relation])"
    }
}

if ($differences.Count -gt 0) {
    throw "Restore row-count comparison failed:`n$($differences -join "`n")"
}

Write-Output 'Restored row counts match the backup inventory.'
