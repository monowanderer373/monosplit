begin;

create extension if not exists pgtap with schema extensions;
select plan(52);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '51000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'phase5-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Owner"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '52000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'phase5-approver@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Approver"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '53000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'phase5-stranger@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Stranger"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '54000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'phase5-approver-two@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Approver Two"}',
    now(), now()
  );

update public.participants
set id = case auth_user_id
  when '51000000-0000-4000-8000-000000000001'
    then 'a1000000-0000-4000-8000-000000000001'::uuid
  when '52000000-0000-4000-8000-000000000002'
    then 'b2000000-0000-4000-8000-000000000002'::uuid
  when '53000000-0000-4000-8000-000000000003'
    then 'c3000000-0000-4000-8000-000000000003'::uuid
  when '54000000-0000-4000-8000-000000000004'
    then 'd4000000-0000-4000-8000-000000000004'::uuid
end
where auth_user_id in (
  '51000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000002',
  '53000000-0000-4000-8000-000000000003',
  '54000000-0000-4000-8000-000000000004'
);

insert into public.person_relationships(
  id, owner_participant_id, display_name, linked_participant_id
)
values (
  '53000000-0000-4000-9000-000000000003',
  'c3000000-0000-4000-8000-000000000003',
  'Approver as seen by stranger',
  'b2000000-0000-4000-8000-000000000002'
);

insert into public.spaces(
  id, type, name, owner_participant_id, default_currency
)
values (
  '50000000-0000-4000-9000-000000000001',
  'trip',
  'Phase 5 unchanged Space',
  'a1000000-0000-4000-8000-000000000001',
  'MYR'
);
insert into public.space_members(space_id, participant_id, role)
values (
  '50000000-0000-4000-9000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'owner'
);

insert into public.expenses(
  id, client_request_id, scope, created_by, total_minor, participant_count,
  currency, description, category, occurred_on, status, voided_at, voided_by
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'direct', 'a1000000-0000-4000-8000-000000000001', 10000, 3,
    'MYR', 'Authoritative target', 'Other', current_date,
    'active', null, null
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '12000000-0000-4000-8000-000000000002',
    'direct', 'a1000000-0000-4000-8000-000000000001', 8000, 3,
    'MYR', 'Pending candidate', 'Other', current_date,
    'correction_pending', null, null
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '13000000-0000-4000-8000-000000000003',
    'personal', 'a1000000-0000-4000-8000-000000000001', 1000, 1,
    'MYR', 'Historical legacy void', 'Other', current_date,
    'voided', now(), 'a1000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '14000000-0000-4000-8000-000000000004',
    'personal', 'a1000000-0000-4000-8000-000000000001', 1000, 1,
    'MYR', 'Historical active', 'Other', current_date,
    'active', null, null
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    '16000000-0000-4000-8000-000000000006',
    'direct', 'a1000000-0000-4000-8000-000000000001', 10000, 2,
    'MYR', 'Second target', 'Other', current_date,
    'active', null, null
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    '17000000-0000-4000-8000-000000000007',
    'direct', 'a1000000-0000-4000-8000-000000000001', 9000, 2,
    'MYR', 'Second candidate', 'Other', current_date,
    'correction_pending', null, null
  );

insert into public.expense_participations(
  id, expense_id, participant_id, name_snapshot, participant_order,
  state, tracking_mode
)
values
  (
    '21000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'Owner', 0, 'accepted', 'tracked'
  ),
  (
    '22000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000002',
    'Approver', 1, 'accepted', 'tracked'
  ),
  (
    '23000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'Owner', 0, 'accepted', 'tracked'
  ),
  (
    '24000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000002',
    'Approver', 1, 'pending', 'tracked'
  ),
  (
    '25000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    'd4000000-0000-4000-8000-000000000004',
    'Approver Two', 2, 'accepted', 'tracked'
  ),
  (
    '26000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000002',
    'd4000000-0000-4000-8000-000000000004',
    'Approver Two', 2, 'pending', 'tracked'
  );

insert into public.direct_expense_change_requests(
  id, client_request_id, kind, state, proposed_by, target_expense_id,
  replacement_expense_id, target_version, payload_fingerprint
)
values (
  '30000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  'correction',
  'pending',
  'a1000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  1,
  repeat('a', 64)
);
insert into public.direct_expense_change_approvals(request_id, participant_id)
values
  (
    '30000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000002'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    'd4000000-0000-4000-8000-000000000004'
  );

insert into public.settlement_payments(
  id, client_request_id, scope, space_id, debtor_participant_id, currency,
  amount_minor, payment_date, status
)
values (
  '40000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000001',
  'direct',
  null,
  'a1000000-0000-4000-8000-000000000001',
  'MYR',
  10000,
  current_date,
  'confirmed'
);
insert into public.settlement_allocations(
  id, settlement_payment_id, creditor_participant_id, amount_minor,
  state, responded_at
)
values (
  '42000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000002',
  10000,
  'accepted',
  now()
);
insert into public.settlement_allocation_reversals(
  id, client_request_id, settlement_allocation_id, reversed_by, amount_minor
)
values (
  '43000000-0000-4000-8000-000000000001',
  '44000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000002',
  10000
);

select lives_ok(
  $$
    insert into public.expenses(
      id, client_request_id, scope, created_by, total_minor, participant_count,
      currency, category, occurred_on, status
    )
    values (
      '10000000-0000-4000-8000-000000000008',
      '18000000-0000-4000-8000-000000000008',
      'direct', 'a1000000-0000-4000-8000-000000000001', 1, 1,
      'MYR', 'Other', current_date, 'correction_pending'
    )
  $$,
  'correction_pending is a valid Expense status'
);
select throws_ok(
  $$
    insert into public.expenses(
      id, client_request_id, scope, created_by, total_minor, participant_count,
      currency, category, occurred_on, status
    )
    values (
      '10000000-0000-4000-8000-00000000000a',
      '1a000000-0000-4000-8000-00000000000a',
      'personal', 'a1000000-0000-4000-8000-000000000001', 1, 1,
      'MYR', 'Other', current_date, 'correction_pending'
    )
  $$,
  '23514',
  null,
  'only Direct candidate Expenses may be correction_pending'
);
select results_eq(
  $$ select status from public.expenses where id in (
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004'
  ) order by status $$,
  $$ values ('active'::text), ('voided'::text) $$,
  'historical active and voided Expense states remain valid'
);
select is(
  (
    select termination_kind
    from public.expenses
    where id = '10000000-0000-4000-8000-000000000003'
  ),
  null::text,
  'a historical void remains a legacy void with no inferred termination kind'
);
select throws_ok(
  $$
    update public.expenses
    set corrects_expense_id = id
    where id = '10000000-0000-4000-8000-000000000004'
  $$,
  '23514',
  null,
  'an Expense cannot correct itself'
);
select throws_ok(
  $$
    update public.expenses
    set corrects_expense_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    where id = '10000000-0000-4000-8000-000000000004'
  $$,
  '23503',
  null,
  'correction lineage must reference an existing Expense'
);

insert into public.expenses(
  id, client_request_id, scope, created_by, total_minor, participant_count,
  currency, category, occurred_on, status, corrects_expense_id
)
values (
  '10000000-0000-4000-8000-000000000005',
  '15000000-0000-4000-8000-000000000005',
  'direct', 'a1000000-0000-4000-8000-000000000001', 7000, 2,
  'MYR', 'Other', current_date, 'active',
  '10000000-0000-4000-8000-000000000001'
);
select throws_ok(
  $$
    insert into public.expenses(
      id, client_request_id, scope, created_by, total_minor, participant_count,
      currency, category, occurred_on, status, corrects_expense_id
    )
    values (
      '10000000-0000-4000-8000-000000000009',
      '19000000-0000-4000-8000-000000000009',
      'direct', 'a1000000-0000-4000-8000-000000000001', 6000, 2,
      'MYR', 'Other', current_date, 'active',
      '10000000-0000-4000-8000-000000000001'
    )
  $$,
  '23505',
  null,
  'one original Expense can have at most one authoritative child'
);
select throws_ok(
  $$
    insert into public.direct_expense_change_requests(
      client_request_id, kind, state, proposed_by, target_expense_id,
      replacement_expense_id, target_version, payload_fingerprint
    )
    values (
      '32000000-0000-4000-8000-000000000002',
      'correction', 'declined',
      'a1000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000006',
      '10000000-0000-4000-8000-000000000002',
      1, repeat('b', 64)
    )
  $$,
  '23505',
  null,
  'one replacement Expense can belong to only one request'
);
select throws_ok(
  $$
    insert into public.direct_expense_change_requests(
      client_request_id, kind, state, proposed_by, target_expense_id,
      target_version, payload_fingerprint
    )
    values (
      '31000000-0000-4000-8000-000000000001',
      'cancellation', 'declined',
      'a1000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000004',
      1, repeat('b', 64)
    )
  $$,
  '23505',
  null,
  'actor-scoped client request identity is unique'
);
select throws_ok(
  $$
    insert into public.direct_expense_change_requests(
      client_request_id, kind, state, proposed_by, target_expense_id,
      target_version, payload_fingerprint
    )
    values (
      '33000000-0000-4000-8000-000000000003',
      'cancellation', 'pending',
      'a1000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      1, repeat('c', 64)
    )
  $$,
  '23505',
  null,
  'one target Expense can have only one pending request'
);

insert into public.direct_expense_change_requests(
  id, client_request_id, kind, state, proposed_by, target_expense_id,
  replacement_expense_id, target_version, payload_fingerprint
)
values (
  '30000000-0000-4000-8000-000000000004',
  '34000000-0000-4000-8000-000000000004',
  'correction',
  'authoritative',
  'a1000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000006',
  '10000000-0000-4000-8000-000000000007',
  1,
  repeat('d', 64)
);
select throws_ok(
  $$
    insert into public.direct_expense_change_requests(
      client_request_id, kind, state, proposed_by, target_expense_id,
      target_version, payload_fingerprint
    )
    values (
      '35000000-0000-4000-8000-000000000005',
      'cancellation', 'authoritative',
      'a1000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000006',
      1, repeat('e', 64)
    )
  $$,
  '23505',
  null,
  'one target Expense can have only one authoritative outcome'
);
select throws_ok(
  $$
    insert into public.direct_expense_change_requests(
      client_request_id, kind, state, proposed_by, target_expense_id,
      target_version, payload_fingerprint
    )
    values (
      '36000000-0000-4000-8000-000000000006',
      'correction', 'declined',
      'a1000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000004',
      1, repeat('f', 64)
    )
  $$,
  '23514',
  null,
  'a correction request requires a replacement Expense'
);
select throws_ok(
  $$
    insert into public.direct_expense_change_requests(
      client_request_id, kind, state, proposed_by, target_expense_id,
      replacement_expense_id, target_version, payload_fingerprint
    )
    values (
      '37000000-0000-4000-8000-000000000007',
      'cancellation', 'declined',
      'a1000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000008',
      1, repeat('0', 64)
    )
  $$,
  '23514',
  null,
  'a cancellation request forbids a replacement Expense'
);
select throws_ok(
  $$
    insert into public.direct_expense_change_requests(
      client_request_id, kind, state, proposed_by, target_expense_id,
      replacement_expense_id, target_version, payload_fingerprint
    )
    values (
      '38000000-0000-4000-8000-000000000008',
      'correction', 'declined',
      'a1000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000004',
      1, repeat('1', 64)
    )
  $$,
  '23514',
  null,
  'a request target and replacement must be different Expenses'
);
select throws_ok(
  $$
    insert into public.direct_expense_change_approvals(request_id, participant_id)
    values (
      '30000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000002'
    )
  $$,
  '23505',
  null,
  'one Participant has at most one approval row per request'
);
select throws_ok(
  $$
    insert into public.direct_expense_change_requests(
      client_request_id, kind, proposed_by, target_expense_id,
      target_version, payload_fingerprint
    )
    values (
      '39000000-0000-4000-8000-000000000009',
      'cancellation', 'a1000000-0000-4000-8000-000000000001',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      1, repeat('2', 64)
    )
  $$,
  '23503',
  null,
  'request target Expense FK is enforced'
);
select throws_ok(
  $$
    insert into public.direct_expense_change_requests(
      client_request_id, kind, proposed_by, target_expense_id,
      target_version, payload_fingerprint
    )
    values (
      '3a000000-0000-4000-8000-00000000000a',
      'cancellation', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '10000000-0000-4000-8000-000000000004',
      1, repeat('3', 64)
    )
  $$,
  '23503',
  null,
  'request proposer Participant FK is enforced'
);
select throws_ok(
  $$
    insert into public.direct_expense_change_requests(
      client_request_id, kind, state, proposed_by, target_expense_id,
      replacement_expense_id, target_version, payload_fingerprint
    )
    values (
      '3c000000-0000-4000-8000-00000000000c',
      'correction', 'declined',
      'a1000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000004',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      1, repeat('5', 64)
    )
  $$,
  '23503',
  null,
  'request replacement Expense FK is enforced'
);
select throws_ok(
  $$
    insert into public.direct_expense_change_approvals(request_id, participant_id)
    values (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      'b2000000-0000-4000-8000-000000000002'
    )
  $$,
  '23503',
  null,
  'approval request FK is enforced'
);
select throws_ok(
  $$
    insert into public.direct_expense_change_approvals(request_id, participant_id)
    values (
      '30000000-0000-4000-8000-000000000001',
      'ffffffff-ffff-4fff-8fff-ffffffffffff'
    )
  $$,
  '23503',
  null,
  'approval Participant FK is enforced'
);
select throws_ok(
  $$
    insert into public.settlement_allocation_reversals(
      client_request_id, settlement_allocation_id, reversed_by, amount_minor
    )
    values (
      '45000000-0000-4000-8000-000000000005',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      'b2000000-0000-4000-8000-000000000002',
      100
    )
  $$,
  '23503',
  null,
  'a reversal must reference an existing allocation'
);
select throws_ok(
  $$
    insert into public.settlement_allocation_reversals(
      client_request_id, settlement_allocation_id, reversed_by, amount_minor
    )
    values (
      '46000000-0000-4000-8000-000000000006',
      '42000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000002',
      10000
    )
  $$,
  '23505',
  null,
  'an allocation can have only one full reversal fact'
);
select throws_ok(
  $$
    delete from public.settlement_allocations
    where id = '42000000-0000-4000-8000-000000000001'
  $$,
  '23503',
  null,
  'a reversal prevents deletion of its accepted allocation'
);
select throws_ok(
  $$
    delete from public.settlement_payments
    where id = '40000000-0000-4000-8000-000000000001'
  $$,
  '23503',
  null,
  'payment cascade cannot delete accepted history referenced by a reversal'
);
select lives_ok(
  $$
    insert into public.settlement_allocations(
      id, settlement_payment_id, creditor_participant_id, amount_minor,
      state, responded_at
    )
    values (
      '42000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000001',
      1, 'cancelled', now()
    )
  $$,
  'cancelled is a supported settlement allocation state'
);
select is(
  (
    select state
    from public.settlement_allocations
    where id = '42000000-0000-4000-8000-000000000001'
  ),
  'accepted',
  'adding cancellation support does not rewrite an accepted allocation'
);
select is(
  (
    select version
    from public.settlement_payments
    where id = '40000000-0000-4000-8000-000000000001'
  ),
  1,
  'Settlement Payment version defaults to 1'
);
select lives_ok(
  $$
    insert into public.settlement_payments(
      id, client_request_id, scope, debtor_participant_id, currency,
      amount_minor, payment_date, status
    )
    values (
      '40000000-0000-4000-8000-000000000002',
      '41000000-0000-4000-8000-000000000002',
      'direct', 'a1000000-0000-4000-8000-000000000001', 'MYR',
      1, current_date, 'mixed_closed'
    )
  $$,
  'mixed_closed is a supported parent summary state'
);
select lives_ok(
  $$
    insert into public.settlement_payments(
      id, client_request_id, scope, debtor_participant_id, currency,
      amount_minor, payment_date, status
    )
    values (
      '40000000-0000-4000-8000-000000000003',
      '41000000-0000-4000-8000-000000000003',
      'direct', 'a1000000-0000-4000-8000-000000000001', 'MYR',
      1, current_date, 'cancelled'
    )
  $$,
  'cancelled is a supported parent summary state'
);
select lives_ok(
  $$
    do $block$
    begin
      insert into public.settlement_payments(
        id, client_request_id, scope, debtor_participant_id, currency,
        amount_minor, payment_date, status
      )
      values (
        '40000000-0000-4000-8000-000000000004',
        '41000000-0000-4000-8000-000000000004',
        'direct', 'a1000000-0000-4000-8000-000000000001', 'MYR',
        1, current_date, 'reversed'
      );
      insert into public.settlement_allocations(
        settlement_payment_id, creditor_participant_id, amount_minor,
        state, responded_at
      )
      values (
        '40000000-0000-4000-8000-000000000004',
        'b2000000-0000-4000-8000-000000000002',
        1, 'reversed', now()
      );
    end
    $block$
  $$,
  'legacy reversed payment and allocation states remain valid'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_class
    where oid in (
      'public.direct_expense_change_requests'::regclass,
      'public.direct_expense_change_approvals'::regclass,
      'public.settlement_allocation_reversals'::regclass
    )
      and relrowsecurity
  $$,
  $$ values (3::bigint) $$,
  'RLS is enabled on every new financial table'
);
select is(
  pg_catalog.has_table_privilege(
    'authenticated',
    'public.direct_expense_change_requests',
    'SELECT'
  ),
  true,
  'authenticated clients receive read access to request rows subject to RLS'
);
select is(
  (
    pg_catalog.has_table_privilege(
      'authenticated',
      'public.direct_expense_change_requests',
      'INSERT,UPDATE,DELETE'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.direct_expense_change_approvals',
      'INSERT,UPDATE,DELETE'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.settlement_allocation_reversals',
      'INSERT,UPDATE,DELETE'
    )
  ),
  false,
  'authenticated clients have no direct mutation privilege on new tables'
);
select is(
  (
    pg_catalog.has_table_privilege(
      'anon',
      'public.direct_expense_change_requests',
      'SELECT,INSERT,UPDATE,DELETE'
    )
    or pg_catalog.has_table_privilege(
      'anon',
      'public.direct_expense_change_approvals',
      'SELECT,INSERT,UPDATE,DELETE'
    )
    or pg_catalog.has_table_privilege(
      'anon',
      'public.settlement_allocation_reversals',
      'SELECT,INSERT,UPDATE,DELETE'
    )
  ),
  false,
  'anonymous clients have no privileges on new financial tables'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"51000000-0000-4000-8000-000000000001","is_anonymous":false}';
select results_eq(
  $$
    select count(*)::bigint
    from public.direct_expense_change_requests
    where id = '30000000-0000-4000-8000-000000000001'
  $$,
  $$ values (1::bigint) $$,
  'the proposer can read its Direct change request'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.direct_expense_change_approvals
    where request_id = '30000000-0000-4000-8000-000000000001'
  $$,
  $$ values (2::bigint) $$,
  'the proposer can read the request authority snapshot'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.settlement_allocation_reversals
    where id = '43000000-0000-4000-8000-000000000001'
  $$,
  $$ values (1::bigint) $$,
  'the settlement debtor can read its reversal fact'
);
select throws_ok(
  $$
    insert into public.direct_expense_change_requests(
      client_request_id, kind, proposed_by, target_expense_id,
      target_version, payload_fingerprint
    )
    values (
      '3b000000-0000-4000-8000-00000000000b',
      'cancellation', 'a1000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000004',
      1, repeat('4', 64)
    )
  $$,
  '42501',
  null,
  'an authenticated proposer cannot bypass future RPC authority with direct DML'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"52000000-0000-4000-8000-000000000002","is_anonymous":false}';
select results_eq(
  $$
    select count(*)::bigint
    from public.direct_expense_change_requests
    where id = '30000000-0000-4000-8000-000000000001'
  $$,
  $$ values (1::bigint) $$,
  'a required Participant can read the Direct change request'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.direct_expense_change_approvals
    where request_id = '30000000-0000-4000-8000-000000000001'
  $$,
  $$ values (1::bigint) $$,
  'a required Participant can read only its own approval row'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.settlement_allocation_reversals
    where id = '43000000-0000-4000-8000-000000000001'
  $$,
  $$ values (1::bigint) $$,
  'the settlement creditor can read the reversal fact'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"53000000-0000-4000-8000-000000000003","is_anonymous":false}';
select results_eq(
  $$ select count(*)::bigint from public.person_relationships $$,
  $$ values (1::bigint) $$,
  'the stranger can read its own Person relationship fixture'
);
select results_eq(
  $$ select count(*)::bigint from public.expenses $$,
  $$ values (0::bigint) $$,
  'a Person relationship does not grant Expense visibility'
);
select results_eq(
  $$ select count(*)::bigint from public.direct_expense_change_requests $$,
  $$ values (0::bigint) $$,
  'a Person relationship does not grant Direct request visibility'
);
select results_eq(
  $$ select count(*)::bigint from public.direct_expense_change_approvals $$,
  $$ values (0::bigint) $$,
  'a Person relationship does not grant approval visibility'
);
select results_eq(
  $$ select count(*)::bigint from public.settlement_allocation_reversals $$,
  $$ values (0::bigint) $$,
  'a Person relationship does not grant settlement reversal visibility'
);
select results_eq(
  $$ select count(*)::bigint from public.spaces $$,
  $$ values (0::bigint) $$,
  'new financial tables do not grant Space access'
);

reset role;
select results_eq(
  $$
    select count(*)::bigint
    from public.participants
    where id in (
      'a1000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000002',
      'c3000000-0000-4000-8000-000000000003',
      'd4000000-0000-4000-8000-000000000004'
    )
  $$,
  $$ values (4::bigint) $$,
  'Phase 5B1 does not rewrite Participant identities'
);
select results_eq(
  $$
    select participant_id
    from public.space_members
    where space_id = '50000000-0000-4000-9000-000000000001'
  $$,
  $$
    values ('a1000000-0000-4000-8000-000000000001'::uuid)
  $$,
  'Phase 5B1 does not change Space membership'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.direct_expense_change_requests as request
    join public.expenses as replacement
      on replacement.id = request.replacement_expense_id
    join public.expenses as target
      on target.id = request.target_expense_id
    where request.id = '30000000-0000-4000-8000-000000000004'
      and request.kind = 'correction'
      and request.state = 'authoritative'
      and not (
        replacement.corrects_expense_id = target.id
        and replacement.status = 'active'
        and target.status = 'voided'
        and target.termination_kind = 'corrected'
      )
  $$,
  $$ values (1::bigint) $$,
  'the invariant query detects authoritative request without matching lineage'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.expenses as replacement
    join public.expenses as target
      on target.id = replacement.corrects_expense_id
    where replacement.id = '10000000-0000-4000-8000-000000000005'
      and replacement.scope = 'direct'
      and not exists (
        select 1
        from public.direct_expense_change_requests as request
        where request.kind = 'correction'
          and request.state = 'authoritative'
          and request.target_expense_id = target.id
          and request.replacement_expense_id = replacement.id
      )
  $$,
  $$ values (1::bigint) $$,
  'the invariant query detects Direct lineage without matching authority'
);
select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname in (
        'expenses_one_authoritative_child_idx',
        'direct_change_replacement_once_idx',
        'direct_change_one_pending_target_idx',
        'direct_change_one_authoritative_target_idx'
      )
  $$,
  $$ values (4::bigint) $$,
  'all lineage and request branch barrier indexes exist'
);

select * from finish();
rollback;
