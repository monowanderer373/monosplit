[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9]{20}$')]
    [string] $ProjectRef,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9]{20}$')]
    [string] $ExpectedProjectRef,

    [Parameter(Mandatory = $true)]
    [ValidateSet('PreMigration', 'PostMigration', 'Monitoring')]
    [string] $Stage,

    [Parameter(Mandatory = $true)]
    [ValidateRange(1, 1000)]
    [int] $ExpectedMigrationCount,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9]{12}$')]
    [string] $ExpectedLatestMigration,

    [Parameter()]
    [string] $OutputDirectory
)

$ErrorActionPreference = 'Stop'
if ($ProjectRef -cne $ExpectedProjectRef) {
    throw 'ProjectRef does not match the explicitly authorized ExpectedProjectRef.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $repoRoot 'docs\releases\2026-09-phase6-release-manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($ProjectRef -notin @(
    [string]$manifest.productionSupabaseRef,
    [string]$manifest.stagingSupabaseRef
)) {
    throw 'ProjectRef is not one of the release manifest refs.'
}

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $env:TEMP (
        'tabby-phase6-release-snapshot-{0}' -f [Guid]::NewGuid().ToString('N')
    )
}
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
$repoPrefix = [System.IO.Path]::GetFullPath($repoRoot).TrimEnd('\') + '\'
if ($OutputDirectory.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Snapshot output must stay outside the Git repository.'
}
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

function Invoke-ReadOnlyQuery {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name,

        [Parameter(Mandatory = $true)]
        [string] $Sql
    )

    $queryPath = Join-Path $env:TEMP (
        'tabby-phase6-{0}-{1}.sql' -f $Name, [Guid]::NewGuid().ToString('N')
    )
    try {
        Set-Content -LiteralPath $queryPath -Value $Sql -Encoding UTF8
        $output = @(
            & npx --yes "supabase@$($manifest.supabaseCliVersion)" `
                db query `
                --linked `
                --project-ref $ProjectRef `
                --output-format json `
                --file $queryPath
        )
        if ($LASTEXITCODE -ne 0) {
            throw "Read-only query $Name failed."
        }
        $raw = $output -join [Environment]::NewLine
        $jsonStart = $raw.IndexOf('{')
        if ($jsonStart -lt 0) {
            throw "Read-only query $Name did not return JSON."
        }
        $payload = $raw.Substring($jsonStart) | ConvertFrom-Json
        return @($payload.rows)
    } finally {
        Remove-Item -LiteralPath $queryPath -Force -ErrorAction SilentlyContinue
    }
}

$ledgerSql = @'
select count(*)::bigint as migration_count,
       max(version) as latest_migration
from supabase_migrations.schema_migrations;
'@

$healthSql = @'
select check_name, violation_count
from (
  values
    ('orphan_profile', (select count(*) from public.user_profiles p left join auth.users u on u.id = p.id where u.id is null)),
    ('orphan_account_participant', (select count(*) from public.participants p left join auth.users u on u.id = p.auth_user_id where p.kind = 'account' and u.id is null)),
    ('missing_identity_correlation', (select case when exists (select 1 from auth.users) and not exists (select 1 from auth.users u join public.user_profiles profile on profile.id = u.id join public.participants participant on participant.auth_user_id = u.id) then 1 else 0 end)),
    ('expense_participant_count_mismatch', (select count(*) from public.expenses e where e.participant_count <> (select count(*) from public.expense_participations ep where ep.expense_id = e.id))),
    ('payer_total_mismatch', (select count(*) from public.expenses e where e.total_minor <> coalesce((select sum(pc.amount_minor) from public.payer_contributions pc where pc.expense_id = e.id), 0))),
    ('share_total_mismatch', (select count(*) from public.expenses e where e.total_minor <> coalesce((select sum(es.amount_minor) from public.expense_shares es where es.expense_id = e.id), 0))),
    ('settlement_total_mismatch', (select count(*) from public.settlement_payments sp where sp.amount_minor <> coalesce((select sum(sa.amount_minor) from public.settlement_allocations sa where sa.settlement_payment_id = sp.id), 0))),
    ('legacy_invite_token_exposed', (select count(*) from private.legacy_beta_recovery recovery where recovery.row_data ? 'token'))
) as checks(check_name, violation_count)
order by check_name;
'@

$functionSql = @'
select proc.oid::regprocedure::text as signature,
       pg_catalog.pg_get_function_result(proc.oid) as result_type,
       pg_catalog.has_function_privilege('authenticated', proc.oid, 'execute') as authenticated_execute,
       pg_catalog.has_function_privilege('anon', proc.oid, 'execute') as anon_execute,
       pg_catalog.has_function_privilege('public', proc.oid, 'execute') as public_execute
from pg_catalog.pg_proc as proc
join pg_catalog.pg_namespace as namespace on namespace.oid = proc.pronamespace
where namespace.nspname = 'public'
  and proc.proname = 'respond_to_settlement'
order by 1;
'@

$structuralSql = @'
with expected_tables(table_name) as (
  values
    ('direct_expense_change_requests'),
    ('direct_expense_change_approvals'),
    ('settlement_allocation_reversals'),
    ('personal_accounts'),
    ('personal_account_transactions'),
    ('personal_account_entries'),
    ('personal_account_events'),
    ('personal_funding_intents'),
    ('personal_recurring_rules'),
    ('personal_recurring_occurrences'),
    ('personal_installment_plans'),
    ('personal_installments'),
    ('settlement_payment_requests'),
    ('settlement_attribution_intents'),
    ('personal_settlement_cash_legs'),
    ('space_membership_intervals'),
    ('personal_expense_affiliations')
),
expected_indexes(index_name) as (
  values
    ('expenses_one_authoritative_child_idx'),
    ('personal_accounts_one_active_default_idx'),
    ('personal_funding_intents_one_active_idx'),
    ('space_membership_intervals_one_open_idx'),
    ('personal_expense_affiliations_owner_active_idx')
),
expected_functions(function_name) as (
  values
    ('propose_direct_expense_change'),
    ('respond_to_direct_expense_change'),
    ('cancel_direct_expense_change'),
    ('correct_space_expense'),
    ('cancel_expense'),
    ('restore_owner_local_expense'),
    ('update_expense_metadata'),
    ('replace_expense_financials'),
    ('respond_to_direct_expense'),
    ('respond_to_settlement'),
    ('cancel_pending_settlement_allocation'),
    ('reverse_settlement_allocation'),
    ('propose_settlement'),
    ('create_personal_account'),
    ('update_personal_account'),
    ('set_default_personal_account'),
    ('archive_personal_account'),
    ('complete_account_opening'),
    ('create_income_transaction'),
    ('create_refund_transaction'),
    ('create_transfer_transaction'),
    ('reconcile_account_to_stated_balance'),
    ('reverse_personal_account_transaction'),
    ('link_expense_funding'),
    ('complete_pending_funding'),
    ('create_expense_with_funding'),
    ('create_personal_recurring_rule'),
    ('update_personal_recurring_rule'),
    ('set_personal_recurring_paused'),
    ('catch_up_personal_recurring'),
    ('post_personal_recurring_occurrence'),
    ('retry_personal_recurring_occurrence'),
    ('update_personal_recurring_occurrence'),
    ('skip_personal_recurring_occurrence'),
    ('cancel_pending_funding'),
    ('reverse_personal_recurring_occurrence'),
    ('create_installment_plan_for_expense'),
    ('create_installment_purchase'),
    ('post_installment_repayment'),
    ('retry_installment_repayment'),
    ('catch_up_personal_installments'),
    ('edit_future_installment'),
    ('reschedule_remaining_installments'),
    ('pay_off_installment_plan'),
    ('reverse_installment'),
    ('get_direct_outstanding'),
    ('create_settlement_payment_request'),
    ('cancel_settlement_payment_request'),
    ('authorize_personal_settlement_cash_leg'),
    ('upsert_personal_expense_affiliation'),
    ('archive_personal_expense_affiliation')
),
phase6_functions as (
  select proc.oid, proc.proname
  from pg_catalog.pg_proc proc
  join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
  join expected_functions expected on expected.function_name = proc.proname
  where namespace.nspname = 'public'
)
select check_name, violation_count
from (
  values
    ('missing_corrects_expense_id', (select count(*) from (select 1) marker where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'expenses' and column_name = 'corrects_expense_id'))),
    ('missing_expected_tables', (select count(*) from expected_tables where pg_catalog.to_regclass('public.' || table_name) is null)),
    ('rls_disabled_tables', (select count(*) from expected_tables expected join pg_catalog.pg_class relation on relation.oid = pg_catalog.to_regclass('public.' || expected.table_name) where not relation.relrowsecurity)),
    ('missing_expected_indexes', (select count(*) from expected_indexes expected where not exists (select 1 from pg_catalog.pg_indexes found where found.schemaname = 'public' and found.indexname = expected.index_name))),
    ('missing_protected_rpc_names', (select count(*) from expected_functions expected where not exists (select 1 from phase6_functions found where found.proname = expected.function_name))),
    ('authenticated_rpc_denials', (select count(*) from phase6_functions where not pg_catalog.has_function_privilege('authenticated', oid, 'execute'))),
    ('anon_rpc_execute_grants', (select count(*) from phase6_functions where pg_catalog.has_function_privilege('anon', oid, 'execute'))),
    ('public_rpc_execute_grants', (select count(*) from phase6_functions where pg_catalog.has_function_privilege('public', oid, 'execute')))
) checks(check_name, violation_count)
order by check_name;
'@

$ledger = @(Invoke-ReadOnlyQuery -Name 'ledger' -Sql $ledgerSql)
if ($ledger.Count -ne 1 -or
    [int]$ledger[0].migration_count -ne $ExpectedMigrationCount -or
    [string]$ledger[0].latest_migration -cne $ExpectedLatestMigration) {
    throw 'The remote migration ledger does not match the expected release gate.'
}

$health = @(Invoke-ReadOnlyQuery -Name 'health' -Sql $healthSql)
$unexpectedHealth = @($health | Where-Object {
    $_.check_name -cne 'orphan_account_participant' -and [long]$_.violation_count -ne 0
})
if ($unexpectedHealth.Count -gt 0) {
    throw "Unexpected source-health violations: $($unexpectedHealth.check_name -join ', ')."
}

$functions = @(Invoke-ReadOnlyQuery -Name 'functions' -Sql $functionSql)
if ($functions.Count -lt 1) {
    throw 'respond_to_settlement is missing.'
}
if ($Stage -ne 'PreMigration') {
    $expectedSignatures = @(
        'respond_to_settlement(uuid,text)',
        'respond_to_settlement(uuid,text,integer)'
    )
    $actualSignatures = @($functions.signature | ForEach-Object { $_ -replace '\s', '' } | Sort-Object)
    if (($actualSignatures -join "`n") -cne (($expectedSignatures | Sort-Object) -join "`n")) {
        throw 'The settlement overload set is not the expected post-migration set.'
    }
    $badFunctionGrants = @($functions | Where-Object {
        $_.authenticated_execute -notin @($true, 't', 'true') -or
        $_.anon_execute -in @($true, 't', 'true') -or
        $_.public_execute -in @($true, 't', 'true')
    })
    if ($badFunctionGrants.Count -gt 0) {
        throw 'A settlement overload has unsafe execution grants.'
    }
}

$structural = @()
if ($Stage -ne 'PreMigration') {
    $structural = @(Invoke-ReadOnlyQuery -Name 'structural' -Sql $structuralSql)
    $structuralFailures = @($structural | Where-Object { [long]$_.violation_count -ne 0 })
    if ($structuralFailures.Count -gt 0) {
        throw "Post-migration structural checks failed: $($structuralFailures.check_name -join ', ')."
    }
}

$ledger | Export-Csv -LiteralPath (Join-Path $OutputDirectory 'ledger.csv') -NoTypeInformation
$health | Export-Csv -LiteralPath (Join-Path $OutputDirectory 'source-health.csv') -NoTypeInformation
$functions | Export-Csv -LiteralPath (Join-Path $OutputDirectory 'source-functions.csv') -NoTypeInformation
if ($structural.Count -gt 0) {
    $structural |
        Export-Csv -LiteralPath (Join-Path $OutputDirectory 'structural-checks.csv') -NoTypeInformation
}

Write-Output 'PHASE6_READ_ONLY_SNAPSHOT_PASS'
Write-Output ("PROJECT_REF=" + $ProjectRef)
Write-Output ("STAGE=" + $Stage)
Write-Output ("LEDGER_COUNT=" + $ledger[0].migration_count)
Write-Output ("LEDGER_LATEST=" + $ledger[0].latest_migration)
foreach ($warning in @($health | Where-Object { [long]$_.violation_count -ne 0 })) {
    Write-Output ("SOURCE_HEALTH_WARNING {0}={1}" -f $warning.check_name, $warning.violation_count)
}
Write-Output ("OUTPUT_DIRECTORY=" + $OutputDirectory)
Write-Output 'REMOTE_MUTATION=false'
