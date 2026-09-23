begin;

create extension if not exists pgtap with schema extensions;
select plan(103);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '71000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'workflow-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Owner"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '72000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'workflow-approver-one@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Approver One"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '73000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'workflow-approver-two@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Approver Two"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '74000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'workflow-stranger@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Stranger"}',
    now(), now()
  );

update public.participants
set id = case auth_user_id
  when '71000000-0000-4000-8000-000000000001'
    then 'a7100000-0000-4000-8000-000000000001'::uuid
  when '72000000-0000-4000-8000-000000000002'
    then 'b7200000-0000-4000-8000-000000000002'::uuid
  when '73000000-0000-4000-8000-000000000003'
    then 'c7300000-0000-4000-8000-000000000003'::uuid
  when '74000000-0000-4000-8000-000000000004'
    then 'd7400000-0000-4000-8000-000000000004'::uuid
end
where auth_user_id in (
  '71000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000002',
  '73000000-0000-4000-8000-000000000003',
  '74000000-0000-4000-8000-000000000004'
);

insert into public.participants(id, kind, display_name, created_by)
values (
  'e7500000-0000-4000-8000-000000000005',
  'manual',
  'Historical Manual',
  '71000000-0000-4000-8000-000000000001'
);

insert into public.friendships(
  participant_low_id, participant_high_id, requested_by, status, accepted_at
)
values
  (
    'a7100000-0000-4000-8000-000000000001',
    'b7200000-0000-4000-8000-000000000002',
    'a7100000-0000-4000-8000-000000000001',
    'accepted', now()
  ),
  (
    'a7100000-0000-4000-8000-000000000001',
    'c7300000-0000-4000-8000-000000000003',
    'a7100000-0000-4000-8000-000000000001',
    'accepted', now()
  ),
  (
    'a7100000-0000-4000-8000-000000000001',
    'd7400000-0000-4000-8000-000000000004',
    'a7100000-0000-4000-8000-000000000001',
    'accepted', now()
  );

-- A confirmed multi-account Direct Expense with one historical Manual principal.
insert into public.expenses(
  id, client_request_id, scope, created_by, total_minor, participant_count,
  currency, description, category, occurred_on
)
values
  (
    '81000000-0000-4000-8000-000000000001',
    '81100000-0000-4000-8000-000000000001',
    'direct', 'a7100000-0000-4000-8000-000000000001',
    10000, 4, 'MYR', 'Original A', 'Food', current_date
  ),
  (
    '82000000-0000-4000-8000-000000000002',
    '82200000-0000-4000-8000-000000000002',
    'direct', 'a7100000-0000-4000-8000-000000000001',
    5000, 2, 'MYR', 'Decline target', 'Other', current_date
  ),
  (
    '83000000-0000-4000-8000-000000000003',
    '83300000-0000-4000-8000-000000000003',
    'direct', 'a7100000-0000-4000-8000-000000000001',
    5000, 2, 'MYR', 'Cancel proposal target', 'Other', current_date
  ),
  (
    '84000000-0000-4000-8000-000000000004',
    '84400000-0000-4000-8000-000000000004',
    'direct', 'a7100000-0000-4000-8000-000000000001',
    5000, 2, 'MYR', 'Cancellation authority target', 'Other', current_date
  );

insert into public.expense_participations(
  id, expense_id, participant_id, name_snapshot, participant_order,
  state, tracking_mode
)
values
  ('91000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'a7100000-0000-4000-8000-000000000001', 'Owner', 0, 'accepted', 'tracked'),
  ('91000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', 'b7200000-0000-4000-8000-000000000002', 'Approver One', 1, 'accepted', 'tracked'),
  ('91000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000001', 'c7300000-0000-4000-8000-000000000003', 'Approver Two', 2, 'accepted', 'tracked'),
  ('91000000-0000-4000-8000-000000000004', '81000000-0000-4000-8000-000000000001', 'e7500000-0000-4000-8000-000000000005', 'Historical Manual', 3, 'untracked', 'untracked'),
  ('92000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002', 'a7100000-0000-4000-8000-000000000001', 'Owner', 0, 'accepted', 'tracked'),
  ('92000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', 'b7200000-0000-4000-8000-000000000002', 'Approver One', 1, 'accepted', 'tracked'),
  ('93000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000003', 'a7100000-0000-4000-8000-000000000001', 'Owner', 0, 'accepted', 'tracked'),
  ('93000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000003', 'b7200000-0000-4000-8000-000000000002', 'Approver One', 1, 'accepted', 'tracked'),
  ('94000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000004', 'a7100000-0000-4000-8000-000000000001', 'Owner', 0, 'accepted', 'tracked'),
  ('94000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000004', 'b7200000-0000-4000-8000-000000000002', 'Approver One', 1, 'accepted', 'tracked');

insert into public.payer_contributions(
  expense_participation_id, expense_id, amount_minor
)
values
  ('91000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 10000),
  ('92000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002', 5000),
  ('93000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000003', 5000),
  ('94000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000004', 5000);

insert into public.expense_shares(
  expense_participation_id, expense_id, amount_minor
)
values
  ('91000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 2500),
  ('91000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', 2500),
  ('91000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000001', 2500),
  ('91000000-0000-4000-8000-000000000004', '81000000-0000-4000-8000-000000000001', 2500),
  ('92000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002', 2500),
  ('92000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', 2500),
  ('93000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000003', 2500),
  ('93000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000003', 2500),
  ('94000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000004', 2500),
  ('94000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000004', 2500);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"71000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok(
  $$
    select public.propose_direct_expense_change(
      'a0100000-0000-4000-8000-000000000001',
      '81000000-0000-4000-8000-000000000001',
      1,
      'correction',
      'Correct amount',
      8000,
      'MYR',
      'Replacement B',
      'Food',
      current_date,
      array[
        'a7100000-0000-4000-8000-000000000001'::uuid,
        'b7200000-0000-4000-8000-000000000002'::uuid,
        'c7300000-0000-4000-8000-000000000003'::uuid,
        'e7500000-0000-4000-8000-000000000005'::uuid
      ],
      array[8000::bigint, 0, 0, 0],
      array[2000::bigint, 2000, 2000, 2000]
    )
  $$,
  'a confirmed Direct correction can be proposed'
);
select results_eq(
  $$
    select status
    from public.expenses
    where id = '81000000-0000-4000-8000-000000000001'
  $$,
  $$ values ('active'::text) $$,
  'proposal leaves A financially effective'
);
select results_eq(
  $$
    select status
    from public.expenses
    where client_request_id = 'a0100000-0000-4000-8000-000000000001'
  $$,
  $$ values ('correction_pending'::text) $$,
  'proposal creates an ineffective correction_pending B'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.direct_expense_change_approvals as approval
    join public.direct_expense_change_requests as request
      on request.id = approval.request_id
    where request.client_request_id =
      'a0100000-0000-4000-8000-000000000001'
  $$,
  $$ values (2::bigint) $$,
  'every non-proposer account Participant is snapshotted as required'
);
select lives_ok(
  $$
    select public.propose_direct_expense_change(
      'a0100000-0000-4000-8000-000000000001',
      '81000000-0000-4000-8000-000000000001',
      1,
      'correction',
      'Correct amount',
      8000,
      'MYR',
      'Replacement B',
      'Food',
      current_date,
      array[
        'a7100000-0000-4000-8000-000000000001'::uuid,
        'b7200000-0000-4000-8000-000000000002'::uuid,
        'c7300000-0000-4000-8000-000000000003'::uuid,
        'e7500000-0000-4000-8000-000000000005'::uuid
      ],
      array[8000::bigint, 0, 0, 0],
      array[2000::bigint, 2000, 2000, 2000]
    )
  $$,
  'an identical correction proposal retry is idempotent'
);
select throws_ok(
  $$
    select public.propose_direct_expense_change(
      'a0100000-0000-4000-8000-000000000001',
      '81000000-0000-4000-8000-000000000001',
      1,
      'cancellation'
    )
  $$,
  'P0001',
  'idempotency_conflict',
  'reusing a request ID for different semantics is rejected'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000002","is_anonymous":false}';
select lives_ok(
  $$
    select public.respond_to_direct_expense_change(
      (
        select id
        from public.direct_expense_change_requests
        where client_request_id =
          'a0100000-0000-4000-8000-000000000001'
      ),
      'accepted',
      1
    )
  $$,
  'the first required Participant can accept'
);
select results_eq(
  $$
    select expense.status, request.state, request.version
    from public.direct_expense_change_requests as request
    join public.expenses as expense on expense.id = request.target_expense_id
    where request.client_request_id =
      'a0100000-0000-4000-8000-000000000001'
  $$,
  $$ values ('active'::text, 'pending'::text, 2::integer) $$,
  'a non-final acceptance leaves A effective and the request pending'
);
select results_eq(
  $$
    select sum(total_minor)::bigint
    from public.expenses
    where id = '81000000-0000-4000-8000-000000000001'
       or client_request_id = 'a0100000-0000-4000-8000-000000000001'
      and status = 'active'
  $$,
  $$ values (10000::bigint) $$,
  'the first approval leaves effective E unchanged'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000004","is_anonymous":false}';
select throws_ok(
  $$
    select public.respond_to_direct_expense_change(
      (
        select id
        from public.direct_expense_change_requests
        where client_request_id =
          'a0100000-0000-4000-8000-000000000001'
      ),
      'accepted',
      2
    )
  $$,
  'P0001',
  'change_request_not_found',
  'RLS hides the request from an account attempting to spoof approval'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"73000000-0000-4000-8000-000000000003","is_anonymous":false}';
select lives_ok(
  $$
    select public.respond_to_direct_expense_change(
      (
        select id
        from public.direct_expense_change_requests
        where client_request_id =
          'a0100000-0000-4000-8000-000000000001'
      ),
      'accepted',
      2
    )
  $$,
  'the final required acceptance succeeds'
);
select results_eq(
  $$
    select original.status, original.termination_kind,
           replacement.status, replacement.corrects_expense_id,
           request.state
    from public.direct_expense_change_requests as request
    join public.expenses as original on original.id = request.target_expense_id
    join public.expenses as replacement
      on replacement.id = request.replacement_expense_id
    where request.client_request_id =
      'a0100000-0000-4000-8000-000000000001'
  $$,
  $$
    values (
      'voided'::text,
      'corrected'::text,
      'active'::text,
      '81000000-0000-4000-8000-000000000001'::uuid,
      'authoritative'::text
    )
  $$,
  'final acceptance atomically switches A to authoritative B'
);
select results_eq(
  $$
    select sum(total_minor)::bigint
    from public.expenses
    where (
      id = '81000000-0000-4000-8000-000000000001'
      or client_request_id = 'a0100000-0000-4000-8000-000000000001'
    )
      and status = 'active'
  $$,
  $$ values (8000::bigint) $$,
  'exactly one revision contributes after authority'
);
reset role;
select results_eq(
  $$
    select array_agg(participation.participant_id order by participation.participant_order)
    from public.expense_participations as participation
    join public.expenses as expense on expense.id = participation.expense_id
    where expense.client_request_id =
      'a0100000-0000-4000-8000-000000000001'
  $$,
  $$
    values (
      array[
        'a7100000-0000-4000-8000-000000000001'::uuid,
        'b7200000-0000-4000-8000-000000000002'::uuid,
        'c7300000-0000-4000-8000-000000000003'::uuid,
        'e7500000-0000-4000-8000-000000000005'::uuid
      ]
    )
  $$,
  'authoritative correction preserves exact Participant UUID order'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.expense_participations as participation
    join public.expenses as expense on expense.id = participation.expense_id
    where expense.client_request_id =
      'a0100000-0000-4000-8000-000000000001'
      and participation.participant_id =
        'e7500000-0000-4000-8000-000000000005'
      and participation.state = 'untracked'
  $$,
  $$ values (1::bigint) $$,
  'the historical Manual Participant UUID remains unchanged'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"71000000-0000-4000-8000-000000000001","is_anonymous":false}';
select throws_ok(
  $$
    select public.propose_direct_expense_change(
      'a0110000-0000-4000-8000-000000000011',
      (
        select id from public.expenses
        where client_request_id =
          'a0100000-0000-4000-8000-000000000001'
      ),
      2,
      'correction',
      null,
      8000,
      'USD',
      'Invalid currency',
      'Food',
      current_date,
      array[
        'a7100000-0000-4000-8000-000000000001'::uuid,
        'b7200000-0000-4000-8000-000000000002'::uuid,
        'c7300000-0000-4000-8000-000000000003'::uuid,
        'e7500000-0000-4000-8000-000000000005'::uuid
      ],
      array[8000::bigint, 0, 0, 0],
      array[2000::bigint, 2000, 2000, 2000]
    )
  $$,
  'P0001',
  'currency_change_requires_cancel_and_new',
  'confirmed Direct correction preserves exact currency'
);
select throws_ok(
  $$
    select public.propose_direct_expense_change(
      'a0120000-0000-4000-8000-000000000012',
      (
        select id from public.expenses
        where client_request_id =
          'a0100000-0000-4000-8000-000000000001'
      ),
      2,
      'correction',
      null,
      8000,
      'MYR',
      'Invalid order',
      'Food',
      current_date,
      array[
        'a7100000-0000-4000-8000-000000000001'::uuid,
        'c7300000-0000-4000-8000-000000000003'::uuid,
        'b7200000-0000-4000-8000-000000000002'::uuid,
        'e7500000-0000-4000-8000-000000000005'::uuid
      ],
      array[8000::bigint, 0, 0, 0],
      array[2000::bigint, 2000, 2000, 2000]
    )
  $$,
  'P0001',
  'participant_order_mismatch',
  'confirmed Direct correction preserves exact participant_order'
);
select throws_ok(
  $$
    select public.propose_direct_expense_change(
      'a0130000-0000-4000-8000-000000000013',
      (
        select id from public.expenses
        where client_request_id =
          'a0100000-0000-4000-8000-000000000001'
      ),
      2,
      'correction',
      null,
      8000,
      'MYR',
      'Invalid principal set',
      'Food',
      current_date,
      array[
        'a7100000-0000-4000-8000-000000000001'::uuid,
        'b7200000-0000-4000-8000-000000000002'::uuid,
        'c7300000-0000-4000-8000-000000000003'::uuid,
        'd7400000-0000-4000-8000-000000000004'::uuid
      ],
      array[8000::bigint, 0, 0, 0],
      array[2000::bigint, 2000, 2000, 2000]
    )
  $$,
  'P0001',
  'participant_order_mismatch',
  'confirmed Direct correction preserves the exact Participant UUID set'
);
select lives_ok(
  $$
    select public.propose_direct_expense_change(
      'a0140000-0000-4000-8000-000000000014',
      (
        select id from public.expenses
        where client_request_id =
          'a0100000-0000-4000-8000-000000000001'
      ),
      2,
      'correction',
      'Second correction',
      9000,
      'MYR',
      'Replacement C',
      'Food',
      current_date,
      array[
        'a7100000-0000-4000-8000-000000000001'::uuid,
        'b7200000-0000-4000-8000-000000000002'::uuid,
        'c7300000-0000-4000-8000-000000000003'::uuid,
        'e7500000-0000-4000-8000-000000000005'::uuid
      ],
      array[9000::bigint, 0, 0, 0],
      array[2250::bigint, 2250, 2250, 2250]
    )
  $$,
  'an authoritative B can begin a B to C correction'
);
select throws_ok(
  $$
    select public.replace_expense_financials(
      (
        select replacement_expense_id
        from public.direct_expense_change_requests
        where client_request_id =
          'a0140000-0000-4000-8000-000000000014'
      ),
      1,
      9000,
      'MYR',
      array[
        'a7100000-0000-4000-8000-000000000001'::uuid,
        'b7200000-0000-4000-8000-000000000002'::uuid,
        'c7300000-0000-4000-8000-000000000003'::uuid,
        'e7500000-0000-4000-8000-000000000005'::uuid
      ],
      array[9000::bigint, 0, 0, 0],
      array[2250::bigint, 2250, 2250, 2250]
    )
  $$,
  'P0001',
  'correction_pending_expense',
  'generic financial replace cannot mutate pending candidate C'
);
select throws_ok(
  $$
    select public.cancel_expense(
      (
        select replacement_expense_id
        from public.direct_expense_change_requests
        where client_request_id =
          'a0140000-0000-4000-8000-000000000014'
      ),
      1,
      null
    )
  $$,
  'P0001',
  'correction_pending_expense',
  'generic cancellation cannot terminate pending candidate C'
);
select throws_ok(
  $$
    select public.update_expense_metadata(
      (
        select id from public.expenses
        where client_request_id =
          'a0100000-0000-4000-8000-000000000001'
      ),
      'Frozen while pending',
      'Food',
      current_date,
      2
    )
  $$,
  'P0001',
  'open_change_request',
  'metadata mutation is frozen while a Direct change request is pending'
);
select throws_ok(
  $$
    select public.propose_direct_expense_change(
      'a0150000-0000-4000-8000-000000000015',
      (
        select id from public.expenses
        where client_request_id =
          'a0100000-0000-4000-8000-000000000001'
      ),
      2,
      'cancellation'
    )
  $$,
  'P0001',
  'change_request_exists',
  'a correction and cancellation request cannot be open together'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000002","is_anonymous":false}';
select throws_ok(
  $$
    select public.respond_to_direct_expense_change(
      (
        select id from public.direct_expense_change_requests
        where client_request_id =
          'a0140000-0000-4000-8000-000000000014'
      ),
      'accepted',
      2
    )
  $$,
  'P0001',
  'version_conflict',
  'stale Direct change request versions are rejected'
);
select lives_ok(
  $$
    select public.respond_to_direct_expense_change(
      (
        select id from public.direct_expense_change_requests
        where client_request_id =
          'a0140000-0000-4000-8000-000000000014'
      ),
      'accepted',
      1
    )
  $$,
  'the first B to C approval succeeds with the current version'
);
select throws_ok(
  $$
    select public.respond_to_direct_expense_change(
      (
        select id from public.direct_expense_change_requests
        where client_request_id =
          'a0140000-0000-4000-8000-000000000014'
      ),
      'declined',
      2
    )
  $$,
  'P0001',
  'approval_response_conflict',
  'an opposite terminal approval intent conflicts'
);
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"73000000-0000-4000-8000-000000000003","is_anonymous":false}';
select lives_ok(
  $$
    select public.respond_to_direct_expense_change(
      (
        select id from public.direct_expense_change_requests
        where client_request_id =
          'a0140000-0000-4000-8000-000000000014'
      ),
      'accepted',
      2
    )
  $$,
  'the final B to C approval atomically completes the chain'
);
reset role;
select results_eq(
  $$
    with recursive chain as (
      select id, corrects_expense_id, status
      from public.expenses
      where id = '81000000-0000-4000-8000-000000000001'
      union all
      select child.id, child.corrects_expense_id, child.status
      from public.expenses as child
      join chain on child.corrects_expense_id = chain.id
    )
    select count(*)::bigint, count(*) filter (where status = 'active')::bigint
    from chain
  $$,
  $$ values (3::bigint, 1::bigint) $$,
  'A to B to C is a single chain with one active authoritative revision'
);
select is(
  private.direct_revision_chain_is_consistent(
    (
      select replacement_expense_id
      from public.direct_expense_change_requests
      where target_expense_id =
        '81000000-0000-4000-8000-000000000001'
        and state = 'authoritative'
    )
  ),
  true,
  'historical A to B authority remains valid after B is superseded by C'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"71000000-0000-4000-8000-000000000001","is_anonymous":false}';
select throws_ok(
  $$
    select public.propose_direct_expense_change(
      'a0200000-0000-4000-8000-000000000002',
      '81000000-0000-4000-8000-000000000001',
      2,
      'cancellation'
    )
  $$,
  'P0001',
  'effective_direct_expense_required',
  'a superseded historical revision cannot branch'
);

-- Decline and proposer-withdrawal both preserve their current A.
select lives_ok(
  $$
    select public.propose_direct_expense_change(
      'a0300000-0000-4000-8000-000000000003',
      '82000000-0000-4000-8000-000000000002',
      1,
      'correction',
      null,
      4000,
      'MYR',
      'Declined replacement',
      'Other',
      current_date,
      array[
        'a7100000-0000-4000-8000-000000000001'::uuid,
        'b7200000-0000-4000-8000-000000000002'::uuid
      ],
      array[4000::bigint, 0],
      array[2000::bigint, 2000]
    )
  $$,
  'a second valid correction can be proposed'
);
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000002","is_anonymous":false}';
select lives_ok(
  $$
    select public.respond_to_direct_expense_change(
      (
        select id from public.direct_expense_change_requests
        where client_request_id =
          'a0300000-0000-4000-8000-000000000003'
      ),
      'declined',
      1
    )
  $$,
  'a required Participant can decline a correction'
);
reset role;
select results_eq(
  $$
    select original.status, replacement.status, request.state,
           replacement.corrects_expense_id
    from public.direct_expense_change_requests as request
    join public.expenses as original on original.id = request.target_expense_id
    join public.expenses as replacement
      on replacement.id = request.replacement_expense_id
    where request.client_request_id =
      'a0300000-0000-4000-8000-000000000003'
  $$,
  $$ values ('active'::text, 'voided'::text, 'declined'::text, null::uuid) $$,
  'decline terminates B without changing A or creating lineage'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"71000000-0000-4000-8000-000000000001","is_anonymous":false}';
select lives_ok(
  $$
    select public.propose_direct_expense_change(
      'a0400000-0000-4000-8000-000000000004',
      '83000000-0000-4000-8000-000000000003',
      1,
      'correction',
      null,
      4000,
      'MYR',
      'Withdrawn replacement',
      'Other',
      current_date,
      array[
        'a7100000-0000-4000-8000-000000000001'::uuid,
        'b7200000-0000-4000-8000-000000000002'::uuid
      ],
      array[4000::bigint, 0],
      array[2000::bigint, 2000]
    )
  $$,
  'a correction can be staged for proposer cancellation'
);
select lives_ok(
  $$
    select public.cancel_direct_expense_change(
      (
        select id from public.direct_expense_change_requests
        where client_request_id =
          'a0400000-0000-4000-8000-000000000004'
      ),
      1
    )
  $$,
  'the proposer can cancel a pending change'
);
select results_eq(
  $$
    select original.status, replacement.status, request.state,
           replacement.corrects_expense_id
    from public.direct_expense_change_requests as request
    join public.expenses as original on original.id = request.target_expense_id
    join public.expenses as replacement
      on replacement.id = request.replacement_expense_id
    where request.client_request_id =
      'a0400000-0000-4000-8000-000000000004'
  $$,
  $$ values ('active'::text, 'voided'::text, 'cancelled'::text, null::uuid) $$,
  'proposer cancellation preserves A and creates no lineage'
);
select lives_ok(
  $$
    select public.cancel_direct_expense_change(
      (
        select id from public.direct_expense_change_requests
        where client_request_id =
          'a0400000-0000-4000-8000-000000000004'
      ),
      1
    )
  $$,
  'repeating the same proposer cancellation is idempotent'
);
select lives_ok(
  $$
    select public.propose_direct_expense_change(
      'a0410000-0000-4000-8000-000000000041',
      '83000000-0000-4000-8000-000000000003',
      1,
      'correction',
      null,
      4000,
      'MYR',
      'New request after withdrawal',
      'Other',
      current_date,
      array[
        'a7100000-0000-4000-8000-000000000001'::uuid,
        'b7200000-0000-4000-8000-000000000002'::uuid
      ],
      array[4000::bigint, 0],
      array[2000::bigint, 2000]
    )
  $$,
  'recovery from a withdrawn Direct change creates a new request'
);
select results_eq(
  $$
    select client_request_id, state
    from public.direct_expense_change_requests
    where target_expense_id = '83000000-0000-4000-8000-000000000003'
    order by client_request_id
  $$,
  $$
    values
      ('a0400000-0000-4000-8000-000000000004'::uuid, 'cancelled'::text),
      ('a0410000-0000-4000-8000-000000000041'::uuid, 'pending'::text)
  $$,
  'the withdrawn request stays terminal beside the new pending request'
);
select lives_ok(
  $$
    select public.cancel_direct_expense_change(
      (
        select id from public.direct_expense_change_requests
        where client_request_id =
          'a0410000-0000-4000-8000-000000000041'
      ),
      1
    )
  $$,
  'the replacement test request can be withdrawn independently'
);

-- Confirmed Direct cancellation requires counterpart authority.
select throws_ok(
  $$
    select public.replace_expense_financials(
      '84000000-0000-4000-8000-000000000004',
      1,
      5000,
      'MYR',
      array[
        'a7100000-0000-4000-8000-000000000001'::uuid,
        'b7200000-0000-4000-8000-000000000002'::uuid
      ],
      array[5000::bigint, 0],
      array[2500::bigint, 2500]
    )
  $$,
  'P0001',
  'confirmed_direct_financials_immutable',
  'generic financial replace cannot rewrite confirmed Direct history'
);
select throws_ok(
  $$
    select public.cancel_expense(
      '84000000-0000-4000-8000-000000000004',
      1,
      null
    )
  $$,
  'P0001',
  'confirmed_direct_requires_change_request',
  'confirmed Direct immediate cancellation is rejected'
);
select lives_ok(
  $$
    select public.propose_direct_expense_change(
      'a0500000-0000-4000-8000-000000000005',
      '84000000-0000-4000-8000-000000000004',
      1,
      'cancellation'
    )
  $$,
  'the creator can request confirmed Direct cancellation'
);
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000002","is_anonymous":false}';
select lives_ok(
  $$
    select public.respond_to_direct_expense_change(
      (
        select id from public.direct_expense_change_requests
        where client_request_id =
          'a0500000-0000-4000-8000-000000000005'
      ),
      'accepted',
      1
    )
  $$,
  'the accepted counterpart can authorize cancellation'
);
select results_eq(
  $$
    select expense.status, expense.termination_kind,
           request.state, request.replacement_expense_id
    from public.direct_expense_change_requests as request
    join public.expenses as expense on expense.id = request.target_expense_id
    where request.client_request_id =
      'a0500000-0000-4000-8000-000000000005'
  $$,
  $$ values ('voided'::text, 'cancelled'::text, 'authoritative'::text, null::uuid) $$,
  'final cancellation approval removes A with no replacement'
);

-- Space correction uses creator/owner authority and never Direct authority.
reset role;
insert into public.spaces(id, type, name, owner_participant_id, default_currency)
values (
  'b0100000-0000-4000-8000-000000000001',
  'trip',
  'Workflow Space',
  'a7100000-0000-4000-8000-000000000001',
  'MYR'
);
insert into public.space_members(space_id, participant_id, role)
values
  ('b0100000-0000-4000-8000-000000000001', 'a7100000-0000-4000-8000-000000000001', 'owner'),
  ('b0100000-0000-4000-8000-000000000001', 'b7200000-0000-4000-8000-000000000002', 'full_access'),
  ('b0100000-0000-4000-8000-000000000001', 'c7300000-0000-4000-8000-000000000003', 'view'),
  ('b0100000-0000-4000-8000-000000000001', 'e7500000-0000-4000-8000-000000000005', 'full_access');
insert into public.expenses(
  id, client_request_id, scope, space_id, created_by, total_minor,
  participant_count, currency, description, category, occurred_on
)
values (
  'b0200000-0000-4000-8000-000000000002',
  'b0210000-0000-4000-8000-000000000002',
  'space',
  'b0100000-0000-4000-8000-000000000001',
  'b7200000-0000-4000-8000-000000000002',
  6000, 2, 'MYR', 'Space A', 'Travel', current_date
);
insert into public.expense_participations(
  id, expense_id, participant_id, name_snapshot, participant_order,
  state, tracking_mode
)
values
  ('b0300000-0000-4000-8000-000000000001', 'b0200000-0000-4000-8000-000000000002', 'a7100000-0000-4000-8000-000000000001', 'Owner', 0, 'accepted', 'tracked'),
  ('b0300000-0000-4000-8000-000000000002', 'b0200000-0000-4000-8000-000000000002', 'b7200000-0000-4000-8000-000000000002', 'Approver One', 1, 'accepted', 'tracked');
insert into public.payer_contributions(expense_participation_id, expense_id, amount_minor)
values ('b0300000-0000-4000-8000-000000000001', 'b0200000-0000-4000-8000-000000000002', 6000);
insert into public.expense_shares(expense_participation_id, expense_id, amount_minor)
values
  ('b0300000-0000-4000-8000-000000000001', 'b0200000-0000-4000-8000-000000000002', 3000),
  ('b0300000-0000-4000-8000-000000000002', 'b0200000-0000-4000-8000-000000000002', 3000);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"71000000-0000-4000-8000-000000000001","is_anonymous":false}';
select throws_ok(
  $$
    select public.replace_expense_financials(
      'b0200000-0000-4000-8000-000000000002',
      1, 6000, 'MYR',
      array[
        'a7100000-0000-4000-8000-000000000001'::uuid,
        'b7200000-0000-4000-8000-000000000002'::uuid
      ],
      array[6000::bigint, 0],
      array[3000::bigint, 3000]
    )
  $$,
  'P0001',
  'expense_write_denied',
  'a non-creator Space owner cannot use generic financial replace'
);
select lives_ok(
  $$
    select public.correct_space_expense(
      'b0400000-0000-4000-8000-000000000004',
      'b0200000-0000-4000-8000-000000000002',
      1,
      7000,
      'MYR',
      'Space B',
      'Travel',
      current_date,
      array[
        'b7200000-0000-4000-8000-000000000002'::uuid,
        'a7100000-0000-4000-8000-000000000001'::uuid
      ],
      array[7000::bigint, 0],
      array[3500::bigint, 3500]
    )
  $$,
  'a Space owner can atomically correct an Expense with explicit new order'
);
select results_eq(
  $$
    select original.status, original.termination_kind,
           replacement.status, replacement.corrects_expense_id,
           replacement.currency
    from public.expenses as original
    join public.expenses as replacement
      on replacement.corrects_expense_id = original.id
    where original.id = 'b0200000-0000-4000-8000-000000000002'
  $$,
  $$
    values (
      'voided'::text, 'corrected'::text, 'active'::text,
      'b0200000-0000-4000-8000-000000000002'::uuid, 'MYR'::text
    )
  $$,
  'Space correction atomically switches one authoritative revision'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.direct_expense_change_requests
    where target_expense_id = 'b0200000-0000-4000-8000-000000000002'
  $$,
  $$ values (0::bigint) $$,
  'Space correction creates no Direct authority record'
);
select lives_ok(
  $$
    select public.correct_space_expense(
      'b0400000-0000-4000-8000-000000000004',
      'b0200000-0000-4000-8000-000000000002',
      1,
      7000,
      'MYR',
      'Space B',
      'Travel',
      current_date,
      array[
        'b7200000-0000-4000-8000-000000000002'::uuid,
        'a7100000-0000-4000-8000-000000000001'::uuid
      ],
      array[7000::bigint, 0],
      array[3500::bigint, 3500]
    )
  $$,
  'an identical Space correction request retry is idempotent'
);
select throws_ok(
  $$
    select public.correct_space_expense(
      'b0410000-0000-4000-8000-000000000041',
      (
        select id from public.expenses
        where client_request_id =
          'b0400000-0000-4000-8000-000000000004'
      ),
      1,
      7000,
      'USD',
      'Invalid Space currency',
      'Travel',
      current_date,
      array[
        'b7200000-0000-4000-8000-000000000002'::uuid,
        'a7100000-0000-4000-8000-000000000001'::uuid
      ],
      array[7000::bigint, 0],
      array[3500::bigint, 3500]
    )
  $$,
  'P0001',
  'currency_change_requires_cancel_and_new',
  'confirmed Space correction preserves exact currency'
);
select throws_ok(
  $$
    select public.replace_expense_financials(
      (
        select id from public.expenses
        where client_request_id =
          'b0400000-0000-4000-8000-000000000004'
      ),
      1, 7000, 'MYR',
      array[
        'b7200000-0000-4000-8000-000000000002'::uuid,
        'a7100000-0000-4000-8000-000000000001'::uuid
      ],
      array[7000::bigint, 0],
      array[3500::bigint, 3500]
    )
  $$,
  'P0001',
  'space_correction_required',
  'even the current Space correction creator cannot use generic replace'
);
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000002","is_anonymous":false}';
select throws_ok(
  $$
    select public.correct_space_expense(
      'b0420000-0000-4000-8000-000000000042',
      (
        select id from public.expenses
        where client_request_id =
          'b0400000-0000-4000-8000-000000000004'
      ),
      1,
      7000,
      'MYR',
      'Full access is not correction authority',
      'Travel',
      current_date,
      array[
        'b7200000-0000-4000-8000-000000000002'::uuid,
        'a7100000-0000-4000-8000-000000000001'::uuid
      ],
      array[7000::bigint, 0],
      array[3500::bigint, 3500]
    )
  $$,
  'P0001',
  'expense_write_denied',
  'Space full_access alone does not grant correction authority'
);

-- Settlement acceptance, cancellation, immutable reversal, and summaries.
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"71000000-0000-4000-8000-000000000001","is_anonymous":false}';
select is(
  public.propose_settlement(
    'c0100000-0000-4000-8000-000000000001',
    'direct',
    null,
    'MYR',
    1000,
    current_date,
    array['b7200000-0000-4000-8000-000000000002'::uuid],
    array[1000::bigint],
    null
  ) is not null,
  true,
  'a versioned pending settlement can be proposed'
);
select lives_ok(
  $$
    select public.propose_settlement(
      'c0100000-0000-4000-8000-000000000001',
      'direct',
      null,
      'MYR',
      1000,
      current_date,
      array['b7200000-0000-4000-8000-000000000002'::uuid],
      array[1000::bigint],
      null
    )
  $$,
  'an identical settlement proposal retry is idempotent'
);
select throws_ok(
  $$
    select public.propose_settlement(
      'c0100000-0000-4000-8000-000000000001',
      'direct',
      null,
      'MYR',
      1100,
      current_date,
      array['b7200000-0000-4000-8000-000000000002'::uuid],
      array[1100::bigint],
      null
    )
  $$,
  'P0001',
  'idempotency_conflict',
  'a settlement request ID cannot be reused for different money'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000002","is_anonymous":false}';
select lives_ok(
  $$
    select public.respond_to_settlement(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'c0100000-0000-4000-8000-000000000001'
      ),
      'accepted',
      1
    )
  $$,
  'a creditor can accept a pending allocation with the expected version'
);
select results_eq(
  $$
    select allocation.state, payment.status, payment.version
    from public.settlement_allocations as allocation
    join public.settlement_payments as payment
      on payment.id = allocation.settlement_payment_id
    where payment.client_request_id =
      'c0100000-0000-4000-8000-000000000001'
  $$,
  $$ values ('accepted'::text, 'confirmed'::text, 2::integer) $$,
  'acceptance creates T and increments the parent version'
);
select lives_ok(
  $$
    select public.respond_to_settlement(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'c0100000-0000-4000-8000-000000000001'
      ),
      'accepted',
      1
    )
  $$,
  'same-terminal settlement response retry is idempotent'
);

reset role;
create temporary table accepted_snapshot as
select allocation.id, allocation.state, allocation.responded_at
from public.settlement_allocations as allocation
join public.settlement_payments as payment
  on payment.id = allocation.settlement_payment_id
where payment.client_request_id =
  'c0100000-0000-4000-8000-000000000001';
grant select on accepted_snapshot to authenticated;

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000002","is_anonymous":false}';
select lives_ok(
  $$
    select public.reverse_settlement_allocation(
      'c0200000-0000-4000-8000-000000000002',
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'c0100000-0000-4000-8000-000000000001'
      ),
      2,
      null
    )
  $$,
  'the account creditor can create an immutable full reversal fact'
);
select results_eq(
  $$
    select allocation.state, allocation.responded_at,
           snapshot.state, snapshot.responded_at
    from public.settlement_allocations as allocation
    join accepted_snapshot as snapshot on snapshot.id = allocation.id
  $$,
  $$
    select state, responded_at, state, responded_at
    from accepted_snapshot
  $$,
  'reversal leaves accepted allocation state and timestamp unchanged'
);
select results_eq(
  $$
    select reversal.amount_minor, payment.status, payment.version
    from public.settlement_allocation_reversals as reversal
    join public.settlement_allocations as allocation
      on allocation.id = reversal.settlement_allocation_id
    join public.settlement_payments as payment
      on payment.id = allocation.settlement_payment_id
    where reversal.client_request_id =
      'c0200000-0000-4000-8000-000000000002'
  $$,
  $$ values (1000::bigint, 'reversed'::text, 3::integer) $$,
  'reversal records R and updates only parent summary/version'
);
select lives_ok(
  $$
    select public.reverse_settlement_allocation(
      'c0200000-0000-4000-8000-000000000002',
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'c0100000-0000-4000-8000-000000000001'
      ),
      2,
      null
    )
  $$,
  'same reversal request retry is idempotent'
);
select throws_ok(
  $$
    select public.reverse_settlement_allocation(
      'c0300000-0000-4000-8000-000000000003',
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'c0100000-0000-4000-8000-000000000001'
      ),
      3,
      null
    )
  $$,
  'P0001',
  'allocation_already_reversed',
  'a second full reversal is rejected'
);

reset role;
update public.settlement_allocation_reversals
set amount_minor = 999
where client_request_id = 'c0200000-0000-4000-8000-000000000002';
select throws_ok(
  $$
    select public.recompute_settlement_status(
      (
        select allocation.settlement_payment_id
        from public.settlement_allocation_reversals as reversal
        join public.settlement_allocations as allocation
          on allocation.id = reversal.settlement_allocation_id
        where reversal.client_request_id =
          'c0200000-0000-4000-8000-000000000002'
      )
    )
  $$,
  'P0001',
  'financial_invariant_violation',
  'settlement summary fails closed on a wrong reversal amount'
);
update public.settlement_allocation_reversals
set amount_minor = 1000
where client_request_id = 'c0200000-0000-4000-8000-000000000002';
update public.settlement_allocations
set state = 'declined'
where id = (
  select settlement_allocation_id
  from public.settlement_allocation_reversals
  where client_request_id = 'c0200000-0000-4000-8000-000000000002'
);
select throws_ok(
  $$
    select public.recompute_settlement_status(
      (
        select allocation.settlement_payment_id
        from public.settlement_allocation_reversals as reversal
        join public.settlement_allocations as allocation
          on allocation.id = reversal.settlement_allocation_id
        where reversal.client_request_id =
          'c0200000-0000-4000-8000-000000000002'
      )
    )
  $$,
  'P0001',
  'financial_invariant_violation',
  'settlement summary fails closed when a reversal points to non-accepted state'
);
update public.settlement_allocations
set state = 'accepted'
where id = (
  select settlement_allocation_id
  from public.settlement_allocation_reversals
  where client_request_id = 'c0200000-0000-4000-8000-000000000002'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"71000000-0000-4000-8000-000000000001","is_anonymous":false}';
select throws_ok(
  $$
    select public.cancel_pending_settlement_allocation(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'c0100000-0000-4000-8000-000000000001'
      ),
      3
    )
  $$,
  'P0001',
  'allocation_not_pending',
  'a stale debtor cannot cancel an accepted allocation'
);
select is(
  public.propose_settlement(
    'c0310000-0000-4000-8000-000000000031',
    'space',
    'b0100000-0000-4000-8000-000000000001',
    'MYR',
    400,
    current_date,
    array['e7500000-0000-4000-8000-000000000005'::uuid],
    array[400::bigint],
    null
  ) is not null,
  true,
  'a Manual Space creditor is auto-accepted'
);
select lives_ok(
  $$
    select public.reverse_settlement_allocation(
      'c0320000-0000-4000-8000-000000000032',
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'c0310000-0000-4000-8000-000000000031'
      ),
      1,
      null
    )
  $$,
  'the debtor can reverse an auto-accepted Manual creditor allocation'
);
select results_eq(
  $$
    select allocation.state, payment.status, payment.version,
           reversal.reversed_by
    from public.settlement_allocations as allocation
    join public.settlement_payments as payment
      on payment.id = allocation.settlement_payment_id
    join public.settlement_allocation_reversals as reversal
      on reversal.settlement_allocation_id = allocation.id
    where payment.client_request_id =
      'c0310000-0000-4000-8000-000000000031'
  $$,
  $$
    values (
      'accepted'::text,
      'reversed'::text,
      2::integer,
      'a7100000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  'Manual reversal preserves accepted history and records debtor authority'
);
select is(
  public.propose_settlement(
    'c0330000-0000-4000-8000-000000000033',
    'space',
    'b0100000-0000-4000-8000-000000000001',
    'MYR',
    1000,
    current_date,
    array[
      'b7200000-0000-4000-8000-000000000002'::uuid,
      'c7300000-0000-4000-8000-000000000003'::uuid
    ],
    array[500::bigint, 500],
    null
  ) is not null,
  true,
  'a multi-creditor settlement is created for mixed summary coverage'
);
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000002","is_anonymous":false}';
select throws_ok(
  $$
    select public.respond_to_settlement(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'c0330000-0000-4000-8000-000000000033'
          and allocation.creditor_participant_id =
            'b7200000-0000-4000-8000-000000000002'
      ),
      'accepted',
      99
    )
  $$,
  'P0001',
  'version_conflict',
  'stale settlement payment versions are rejected'
);
select lives_ok(
  $$
    select public.respond_to_settlement(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'c0330000-0000-4000-8000-000000000033'
          and allocation.creditor_participant_id =
            'b7200000-0000-4000-8000-000000000002'
      ),
      'accepted',
      1
    )
  $$,
  'one creditor can accept a multi-creditor settlement'
);
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"71000000-0000-4000-8000-000000000001","is_anonymous":false}';
select lives_ok(
  $$
    select public.cancel_pending_settlement_allocation(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'c0330000-0000-4000-8000-000000000033'
          and allocation.creditor_participant_id =
            'c7300000-0000-4000-8000-000000000003'
      ),
      2
    )
  $$,
  'the debtor can close the remaining pending allocation'
);
select results_eq(
  $$
    select status, version
    from public.settlement_payments
    where client_request_id =
      'c0330000-0000-4000-8000-000000000033'
  $$,
  $$ values ('mixed_closed'::text, 3::integer) $$,
  'accepted plus cancelled produces deterministic mixed_closed summary'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"71000000-0000-4000-8000-000000000001","is_anonymous":false}';
select is(
  public.propose_settlement(
    'c0400000-0000-4000-8000-000000000004',
    'direct',
    null,
    'MYR',
    500,
    current_date,
    array['b7200000-0000-4000-8000-000000000002'::uuid],
    array[500::bigint],
    null
  ) is not null,
  true,
  'a second pending allocation is created for cancellation'
);
select lives_ok(
  $$
    select public.cancel_pending_settlement_allocation(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'c0400000-0000-4000-8000-000000000004'
      ),
      1
    )
  $$,
  'the debtor can cancel a still-pending allocation'
);
select results_eq(
  $$
    select allocation.state, payment.status, payment.version
    from public.settlement_allocations as allocation
    join public.settlement_payments as payment
      on payment.id = allocation.settlement_payment_id
    where payment.client_request_id =
      'c0400000-0000-4000-8000-000000000004'
  $$,
  $$ values ('cancelled'::text, 'cancelled'::text, 2::integer) $$,
  'all-cancelled allocations produce cancelled parent summary'
);
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000002","is_anonymous":false}';
select throws_ok(
  $$
    select public.respond_to_settlement(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'c0400000-0000-4000-8000-000000000004'
      ),
      'accepted',
      1
    )
  $$,
  'P0001',
  'settlement_response_conflict',
  'stale acceptance cannot overwrite debtor cancellation'
);
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"71000000-0000-4000-8000-000000000001","is_anonymous":false}';
select is(
  public.propose_settlement(
    'c0410000-0000-4000-8000-000000000041',
    'direct',
    null,
    'MYR',
    500,
    current_date,
    array['b7200000-0000-4000-8000-000000000002'::uuid],
    array[500::bigint],
    null
  ) is not null,
  true,
  'recovery from a cancelled settlement creates a new proposal'
);
select results_eq(
  $$
    select payment.client_request_id, allocation.state
    from public.settlement_payments as payment
    join public.settlement_allocations as allocation
      on allocation.settlement_payment_id = payment.id
    where payment.client_request_id in (
      'c0400000-0000-4000-8000-000000000004',
      'c0410000-0000-4000-8000-000000000041'
    )
    order by payment.client_request_id
  $$,
  $$
    values
      ('c0400000-0000-4000-8000-000000000004'::uuid, 'cancelled'::text),
      ('c0410000-0000-4000-8000-000000000041'::uuid, 'pending'::text)
  $$,
  'the cancelled allocation stays terminal beside the new proposal'
);
select lives_ok(
  $$
    select public.cancel_pending_settlement_allocation(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'c0410000-0000-4000-8000-000000000041'
      ),
      1
    )
  $$,
  'the replacement settlement proposal has an independent lifecycle'
);

-- Owner-local cancellation restore is narrow, versioned, and preserves identity.
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"71000000-0000-4000-8000-000000000001","is_anonymous":false}';
select is(
  public.create_expense(
    'd0100000-0000-4000-8000-000000000001',
    'personal',
    null,
    1200,
    'MYR',
    'Owner-local Personal',
    'Other',
    current_date,
    array['a7100000-0000-4000-8000-000000000001'::uuid],
    array[1200::bigint],
    array[1200::bigint]
  ) is not null,
  true,
  'an owner-local Personal expense is created'
);
select is(
  public.cancel_expense(
    (
      select id from public.expenses
      where client_request_id = 'd0100000-0000-4000-8000-000000000001'
    ),
    1,
    null
  ),
  2,
  'the Personal creator can cancel owner-local history'
);
select throws_ok(
  $$
    select public.restore_owner_local_expense(
      (
        select id from public.expenses
        where client_request_id = 'd0100000-0000-4000-8000-000000000001'
      ),
      1
    )
  $$,
  'P0001',
  'version_conflict',
  'owner-local restore rejects a stale expected version'
);
select is(
  public.restore_owner_local_expense(
    (
      select id from public.expenses
      where client_request_id = 'd0100000-0000-4000-8000-000000000001'
    ),
    2
  ),
  3,
  'the Personal creator can restore the exact cancellation'
);
select results_eq(
  $$
    select status, termination_kind, voided_at, version
    from public.expenses
    where client_request_id = 'd0100000-0000-4000-8000-000000000001'
  $$,
  $$ values ('active'::text, null::text, null::timestamptz, 3::integer) $$,
  'Personal restore clears only cancellation lifecycle state'
);
select is(
  public.restore_owner_local_expense(
    (
      select id from public.expenses
      where client_request_id = 'd0100000-0000-4000-8000-000000000001'
    ),
    2
  ),
  3,
  'retrying the same Personal restore is idempotent'
);
select throws_ok(
  $$
    select public.restore_owner_local_expense(
      (
        select id from public.expenses
        where client_request_id = 'd0100000-0000-4000-8000-000000000001'
      ),
      3
    )
  $$,
  'P0001',
  'expense_not_restorable',
  'an active expense is not mistaken for a new restoration'
);

select is(
  public.create_expense(
    'd0200000-0000-4000-8000-000000000002',
    'direct',
    null,
    2000,
    'MYR',
    'Owner-local Manual Direct',
    'Other',
    current_date,
    array[
      'a7100000-0000-4000-8000-000000000001'::uuid,
      'e7500000-0000-4000-8000-000000000005'::uuid
    ],
    array[2000::bigint, 0],
    array[1000::bigint, 1000]
  ) is not null,
  true,
  'an exact all-manual Direct expense is created'
);
select is(
  public.cancel_expense(
    (
      select id from public.expenses
      where client_request_id = 'd0200000-0000-4000-8000-000000000002'
    ),
    1,
    null
  ),
  2,
  'the all-manual Direct creator can cancel owner-local history'
);
select is(
  public.restore_owner_local_expense(
    (
      select id from public.expenses
      where client_request_id = 'd0200000-0000-4000-8000-000000000002'
    ),
    2
  ),
  3,
  'the all-manual Direct creator can restore the cancellation'
);
select results_eq(
  $$
    select participation.participant_id
    from public.expense_participations as participation
    join public.expenses as expense on expense.id = participation.expense_id
    where expense.client_request_id =
      'd0200000-0000-4000-8000-000000000002'
    order by participation.participant_order
  $$,
  $$
    values
      ('a7100000-0000-4000-8000-000000000001'::uuid),
      ('e7500000-0000-4000-8000-000000000005'::uuid)
  $$,
  'all-manual Direct restore preserves exact Participant UUIDs'
);
select throws_ok(
  $$
    select public.restore_owner_local_expense(
      '84000000-0000-4000-8000-000000000004',
      (select version from public.expenses
       where id = '84000000-0000-4000-8000-000000000004')
    )
  $$,
  'P0001',
  'expense_not_restorable',
  'authoritatively cancelled confirmed Direct history cannot be restored'
);
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000002","is_anonymous":false}';
select throws_ok(
  $$
    select public.restore_owner_local_expense(
      'b0200000-0000-4000-8000-000000000002',
      (select version from public.expenses
       where id = 'b0200000-0000-4000-8000-000000000002')
    )
  $$,
  'P0001',
  'expense_not_restorable',
  'Space correction history cannot be restored'
);

-- Old overloads are gone and only versioned/guarded writers are executable.
reset role;
select is(
  pg_catalog.to_regprocedure('public.void_expense(uuid)'),
  null::regprocedure,
  'old void_expense overload is removed'
);
select is(
  pg_catalog.to_regprocedure('public.respond_to_direct_expense(uuid,text)'),
  null::regprocedure,
  'old Direct response overload is removed'
);
select is(
  pg_catalog.to_regprocedure('public.respond_to_settlement(uuid,text)') is not null,
  true,
  'deployed two-argument settlement response remains callable through the compatibility overload'
);
select is(
  pg_catalog.to_regprocedure('public.reverse_settlement_allocation(uuid)'),
  null::regprocedure,
  'old settlement reversal overload is removed'
);
select is(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.respond_to_settlement(uuid,text,integer)',
    'EXECUTE'
  ),
  true,
  'authenticated clients can execute the versioned settlement response'
);
select is(
  pg_catalog.has_function_privilege(
    'anon',
    'public.respond_to_settlement(uuid,text,integer)',
    'EXECUTE'
  ),
  false,
  'anonymous clients cannot execute financial authority RPCs'
);
select is(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.restore_owner_local_expense(uuid,integer)',
    'EXECUTE'
  ),
  true,
  'authenticated clients can execute owner-local restore'
);
select is(
  pg_catalog.has_function_privilege(
    'anon',
    'public.restore_owner_local_expense(uuid,integer)',
    'EXECUTE'
  ),
  false,
  'anonymous clients cannot execute owner-local restore'
);

select * from finish();
rollback;
