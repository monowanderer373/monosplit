begin;

create extension if not exists pgtap with schema extensions;
select plan(46);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Owner"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'viewer@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Viewer"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated', null, '', null,
    '{"provider":"anonymous","providers":[]}', '{}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-8444-444444444444',
    'authenticated', 'authenticated', 'target@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Target"}', now(), now()
  );

update public.participants
set id = case auth_user_id
  when '11111111-1111-4111-8111-111111111111' then 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
  when '22222222-2222-4222-8222-222222222222' then 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
  when '33333333-3333-4333-8333-333333333333' then 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid
  when '44444444-4444-4444-8444-444444444444' then '99999999-9999-4999-8999-999999999999'::uuid
end
where auth_user_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444'
);

insert into public.participants(id, kind, display_name, created_by)
values (
  '88888888-8888-4888-8888-888888888888',
  'manual',
  'Manual traveller',
  '11111111-1111-4111-8111-111111111111'
);

insert into public.spaces (
  id, type, name, owner_participant_id, default_currency
)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'trip',
  'RLS trip',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'MYR'
);

insert into public.space_members(space_id, participant_id, role)
values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'view'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '88888888-8888-4888-8888-888888888888', 'full_access');

insert into public.space_invites(token_digest, space_id, role, created_by, expires_at)
values
  (
    extensions.digest('owner-repeat-invite', 'sha256'),
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'view',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    now() + interval '1 day'
  ),
  (
    extensions.digest('anonymous-full-access-invite', 'sha256'),
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'full_access',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    now() + interval '1 day'
  ),
  (
    extensions.digest('anonymous-view-invite', 'sha256'),
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'view',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    now() + interval '1 day'
  );

insert into public.friendships(
  participant_low_id, participant_high_id, requested_by, status, accepted_at
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'accepted',
    now()
  ),
  (
    '99999999-9999-4999-8999-999999999999',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'accepted',
    now()
  );

insert into public.expenses(
  id, client_request_id, scope, space_id, created_by, total_minor, participant_count,
  currency, description, category, occurred_on
)
values
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    '11111111-aaaa-4aaa-8aaa-111111111111',
    'personal', null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1000, 1,
    'MYR', 'Private', 'Other', current_date
  ),
  (
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    '22222222-aaaa-4aaa-8aaa-222222222222',
    'direct', null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 2000, 2,
    'MYR', 'Direct', 'Food', current_date
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    '77777777-aaaa-4aaa-8aaa-777777777777',
    'space', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 3000, 2,
    'MYR', 'Historical Space expense', 'Food', current_date
  );

insert into public.expense_participations(
  id, expense_id, participant_id, name_snapshot, participant_order, state, tracking_mode
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Owner', 0, 'accepted', 'tracked'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Owner', 0, 'accepted', 'tracked'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Viewer', 1, 'pending', 'tracked'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '77777777-7777-4777-8777-777777777777',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Owner', 0, 'accepted', 'tracked'
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    '77777777-7777-4777-8777-777777777777',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Viewer', 1, 'accepted', 'tracked'
  );

insert into public.payer_contributions(expense_participation_id, expense_id, amount_minor)
values
  ('10000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 1000),
  ('10000000-0000-4000-8000-000000000002', 'ffffffff-ffff-4fff-8fff-ffffffffffff', 2000),
  ('10000000-0000-4000-8000-000000000004', '77777777-7777-4777-8777-777777777777', 3000);

insert into public.expense_shares(expense_participation_id, expense_id, amount_minor)
values
  ('10000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 1000),
  ('10000000-0000-4000-8000-000000000002', 'ffffffff-ffff-4fff-8fff-ffffffffffff', 1000),
  ('10000000-0000-4000-8000-000000000003', 'ffffffff-ffff-4fff-8fff-ffffffffffff', 1000),
  ('10000000-0000-4000-8000-000000000004', '77777777-7777-4777-8777-777777777777', 1500),
  ('10000000-0000-4000-8000-000000000005', '77777777-7777-4777-8777-777777777777', 1500);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_class
    where relnamespace = 'public'::regnamespace
      and relname in (
        'user_profiles', 'participants', 'spaces', 'space_members', 'friendships',
        'space_invites', 'friend_invites', 'expenses', 'expense_participations',
        'payer_contributions', 'expense_shares', 'settlement_payments',
        'settlement_allocations', 'financial_events', 'product_events',
        'capture_templates', 'recurring_rules', 'recurring_drafts',
        'participant_link_requests', 'capture_entitlements', 'capture_usage'
      )
      and relrowsecurity
  ),
  21,
  'RLS is enabled on every Tabby Tally client-facing table'
);
select is(
  pg_catalog.to_regprocedure('public.are_friends(uuid,uuid)') is null,
  true,
  'relationship helpers are not exposed as public RPCs'
);
select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_constraint
    where conrelid = 'public.recurring_rules'::regclass
      and pg_catalog.pg_get_constraintdef(oid) like '%jsonb_contains_amount_key%'
  $$,
  $$ values (1::bigint) $$,
  'recurring rules enforce the recursive no-amount invariant'
);
select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_publication as publication
    join pg_catalog.pg_publication_rel as publication_relation
      on publication_relation.prpubid = publication.oid
    join pg_catalog.pg_class as relation
      on relation.oid = publication_relation.prrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where publication.pubname = 'supabase_realtime'
      and namespace.nspname = 'public'
      and relation.relname in (
        'expenses',
        'expense_participations',
        'payer_contributions',
        'expense_shares',
        'settlement_payments',
        'settlement_allocations'
      )
  $$,
  $$ values (6::bigint) $$,
  'Realtime publishes every relational financial table'
);
select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_publication as publication
    join pg_catalog.pg_publication_rel as publication_relation
      on publication_relation.prpubid = publication.oid
    join pg_catalog.pg_class as relation
      on relation.oid = publication_relation.prrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where publication.pubname = 'supabase_realtime'
      and namespace.nspname = 'public'
      and relation.relname in ('groups', 'user_groups', 'group_invite_links')
  $$,
  $$ values (0::bigint) $$,
  'Realtime excludes the preserved legacy tables'
);
select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('groups', 'user_groups', 'group_invite_links')
      and (
        not relation.relrowsecurity
        or exists (
          select 1
          from pg_catalog.pg_policies as policy
          where policy.schemaname = namespace.nspname
            and policy.tablename = relation.relname
        )
      )
  $$,
  $$ values (0::bigint) $$,
  'preserved legacy tables have RLS enabled and no client policies'
);
select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('groups', 'user_groups', 'group_invite_links')
      and (
        pg_catalog.has_table_privilege('anon', relation.oid, 'SELECT')
        or pg_catalog.has_table_privilege('anon', relation.oid, 'INSERT')
        or pg_catalog.has_table_privilege('anon', relation.oid, 'UPDATE')
        or pg_catalog.has_table_privilege('anon', relation.oid, 'DELETE')
        or pg_catalog.has_table_privilege('anon', relation.oid, 'TRUNCATE')
        or pg_catalog.has_table_privilege('anon', relation.oid, 'REFERENCES')
        or pg_catalog.has_table_privilege('anon', relation.oid, 'TRIGGER')
        or pg_catalog.has_table_privilege('authenticated', relation.oid, 'SELECT')
        or pg_catalog.has_table_privilege('authenticated', relation.oid, 'INSERT')
        or pg_catalog.has_table_privilege('authenticated', relation.oid, 'UPDATE')
        or pg_catalog.has_table_privilege('authenticated', relation.oid, 'DELETE')
        or pg_catalog.has_table_privilege('authenticated', relation.oid, 'TRUNCATE')
        or pg_catalog.has_table_privilege('authenticated', relation.oid, 'REFERENCES')
        or pg_catalog.has_table_privilege('authenticated', relation.oid, 'TRIGGER')
      )
  $$,
  $$ values (0::bigint) $$,
  'browser roles have no privileges on preserved legacy tables'
);
select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('groups', 'user_groups', 'group_invite_links')
      and not pg_catalog.has_table_privilege(
        'service_role',
        relation.oid,
        'SELECT'
      )
  $$,
  $$ values (0::bigint) $$,
  'service role can export every preserved legacy table'
);
select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'is_group_owner',
        'get_group_role',
        'is_group_member'
      )
      and (
        pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE')
        or pg_catalog.has_function_privilege(
          'authenticated',
          procedure.oid,
          'EXECUTE'
        )
      )
  $$,
  $$ values (0::bigint) $$,
  'browser roles cannot execute legacy group access helpers'
);
select is(
  (
    select not exists (
      select 1
      from pg_catalog.aclexplode(
        coalesce(
          procedure.proacl,
          pg_catalog.acldefault('f', procedure.proowner)
        )
      ) as privilege
      where privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    )
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'public.recompute_settlement_status(uuid)'::pg_catalog.regprocedure
  ),
  true,
  'PUBLIC cannot execute the actor-unchecked settlement status mutator'
);
select is(
  pg_catalog.has_function_privilege(
    'anon',
    'public.recompute_settlement_status(uuid)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute the actor-unchecked settlement status mutator'
);
select is(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.recompute_settlement_status(uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute the actor-unchecked settlement status mutator'
);
select throws_ok(
  $$
    insert into public.space_members(space_id, participant_id, role)
    values (
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'full_access'
    )
  $$,
  'P0001',
  'anonymous_full_access_denied',
  'the database trigger rejects direct anonymous full-access assignment'
);
select throws_ok(
  $$
    update public.spaces
    set owner_participant_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  $$,
  'P0001',
  'anonymous_space_owner_denied',
  'the database trigger rejects direct anonymous Space ownership'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';

select is(
  public.accept_space_invite('owner-repeat-invite'),
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
  'an existing owner can consume a repeated invite safely'
);
select is(
  private.space_role(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  'owner',
  'accepting a lower-role invite never downgrades an owner'
);
select results_eq(
  $$ select count(*)::bigint from public.user_profiles $$,
  $$ values (1::bigint) $$,
  'an account sees only its own full profile'
);
select results_eq(
  $$ select count(*)::bigint from public.expenses where scope = 'personal' $$,
  $$ values (1::bigint) $$,
  'the personal-expense creator can read it'
);
select lives_ok(
  $$
    select public.request_manual_participant_link(
      '88888888-8888-4888-8888-888888888888',
      '99999999-9999-4999-8999-999999999999'
    )
  $$,
  'a creator can request a friend to link a manual participant'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"44444444-4444-4444-8444-444444444444","is_anonymous":false}';
select lives_ok(
  $$
    select public.respond_manual_participant_link(
      (
        select id
        from public.participant_link_requests
        where manual_participant_id = '88888888-8888-4888-8888-888888888888'
      ),
      'accepted'
    )
  $$,
  'the target account can accept a manual participant link'
);
select is(
  private.space_role(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '99999999-9999-4999-8999-999999999999'
  ),
  null,
  'linking a manual participant never grants Space membership'
);
select throws_ok(
  $$
    select public.propose_settlement(
      '99999999-0000-4000-8000-000000000001',
      'space',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'MYR',
      1500,
      current_date,
      array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid],
      array[1500::bigint]
    )
  $$,
  'P0001',
  'space_write_denied',
  'a non-member cannot propose a Space settlement'
);
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
select results_eq(
  $$
    select count(*)::bigint
    from public.space_members
    where space_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      and participant_id = '88888888-8888-4888-8888-888888888888'
      and removed_at is null
  $$,
  $$ values (0::bigint) $$,
  'an accepted account link retires the duplicate manual Space membership'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';

select results_eq(
  $$ select count(*)::bigint from public.expenses where scope = 'personal' $$,
  $$ values (0::bigint) $$,
  'another account cannot read a personal expense'
);
select results_eq(
  $$ select participant_count::bigint from public.expenses where scope = 'direct' $$,
  $$ values (2::bigint) $$,
  'a tagged account can read the Direct expense header and participant count'
);
select results_eq(
  $$ select count(*)::bigint from public.expense_participations where expense_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff' $$,
  $$ values (2::bigint) $$,
  'a tagged account sees its own and the payer Direct participations'
);
select results_eq(
  $$ select count(*)::bigint from public.expense_shares where expense_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff' $$,
  $$ values (1::bigint) $$,
  'a tagged account sees only its own Direct share'
);
select results_eq(
  $$ select count(*)::bigint from public.spaces $$,
  $$ values (1::bigint) $$,
  'a view member can read its active space'
);
select throws_ok(
  $$
    select public.propose_settlement(
      '22222222-0000-4000-8000-000000000001',
      'space',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'MYR',
      1500,
      current_date,
      array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid],
      array[1500::bigint]
    )
  $$,
  'P0001',
  'space_write_denied',
  'a view member cannot propose a Space settlement'
);
select throws_ok(
  $$
    select public.create_expense(
      '33333333-aaaa-4aaa-8aaa-333333333333',
      'space',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      100,
      'MYR',
      'Denied',
      'Other',
      current_date,
      array['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid],
      array[100::bigint],
      array[100::bigint]
    )
  $$,
  'P0001',
  'space_write_denied',
  'a view member cannot create a Space expense'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
select lives_ok(
  $$
    select public.remove_space_member(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    )
  $$,
  'an owner can remove a view member without deleting history'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
select throws_ok(
  $$
    select public.propose_settlement(
      '22222222-0000-4000-8000-000000000002',
      'space',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'MYR',
      1500,
      current_date,
      array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid],
      array[1500::bigint]
    )
  $$,
  'P0001',
  'space_write_denied',
  'a removed member cannot propose a Space settlement'
);
select results_eq(
  $$ select count(*)::bigint from public.expenses where scope = 'space' $$,
  $$ values (1::bigint) $$,
  'a removed member retains its historical Space expense'
);
select results_eq(
  $$ select count(*)::bigint from public.expense_participations where expense_id = '77777777-7777-4777-8777-777777777777' $$,
  $$ values (2::bigint) $$,
  'a removed member retains historical participant details needed for balances'
);
select results_eq(
  $$ select count(*)::bigint from public.expense_shares where expense_id = '77777777-7777-4777-8777-777777777777' $$,
  $$ values (2::bigint) $$,
  'a removed member retains historical shares needed for balances'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"33333333-3333-4333-8333-333333333333","is_anonymous":true}';

select results_eq(
  $$ select count(*)::bigint from public.spaces $$,
  $$ values (0::bigint) $$,
  'an anonymous non-member cannot enumerate spaces'
);
select throws_ok(
  $$ select public.accept_space_invite('anonymous-full-access-invite') $$,
  'P0001',
  'anonymous_full_access_invite_denied',
  'an anonymous account receives a stable rejection for a full-access invite'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.preview_space_invite('anonymous-full-access-invite')
  $$,
  $$ values (1::bigint) $$,
  'a rejected anonymous full-access invite remains unconsumed'
);
select throws_ok(
  $$
    select public.create_expense(
      '33333333-0000-4000-8000-000000000002',
      'space',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      100,
      'MYR',
      'Denied anonymous Space write',
      'Other',
      current_date,
      array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid],
      array[100::bigint],
      array[100::bigint]
    )
  $$,
  'P0001',
  'permanent_account_required',
  'the database guard denies an anonymous Space expense without a role'
);
select throws_ok(
  $$
    select public.propose_settlement(
      '33333333-0000-4000-8000-000000000001',
      'space',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'MYR',
      1500,
      current_date,
      array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid],
      array[1500::bigint]
    )
  $$,
  'P0001',
  'permanent_account_required',
  'an anonymous non-member cannot propose a Space settlement'
);
select lives_ok(
  $$ select public.accept_space_invite('anonymous-view-invite') $$,
  'an anonymous account can still accept a view-only Space invite'
);
select is(
  private.space_role(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  ),
  'view',
  'view-only acceptance cannot elevate an anonymous account'
);
select throws_ok(
  $$
    select public.remove_space_member(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    )
  $$,
  'P0001',
  'permanent_account_required',
  'an anonymous view member cannot mutate Space membership'
);
select throws_ok(
  $$
    select public.create_expense(
      '44444444-aaaa-4aaa-8aaa-444444444444',
      'personal',
      null,
      100,
      'MYR',
      'Denied',
      'Other',
      current_date,
      array['cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid],
      array[100::bigint],
      array[100::bigint]
    )
  $$,
  'P0001',
  'permanent_account_required',
  'an anonymous guest cannot create a personal expense'
);

reset role;
select results_eq(
  $$ select count(*)::bigint from public.settlement_payments $$,
  $$ values (0::bigint) $$,
  'all rejected settlement attempts leave the settlement ledger unchanged'
);
select results_eq(
  $$
    select
      participation.participant_id,
      (
        coalesce(contribution.amount_minor, 0)
        - share.amount_minor
      )::bigint as balance_minor
    from public.expense_participations as participation
    left join public.payer_contributions as contribution
      on contribution.expense_participation_id = participation.id
    join public.expense_shares as share
      on share.expense_participation_id = participation.id
    where participation.expense_id =
      '77777777-7777-4777-8777-777777777777'
    order by participation.participant_id
  $$,
  $$
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 1500::bigint),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, -1500::bigint)
  $$,
  'rejected settlement attempts leave the existing Space balances unchanged'
);
select * from finish();
rollback;
