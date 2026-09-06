begin;

create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '61000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'person-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Owner"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '62000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'person-target@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Target"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '63000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'person-archived@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Archived"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-8000-000000000000',
    '64000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'person-blocked@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Blocked"}',
    now(), now()
  );

update public.participants
set id = case auth_user_id
  when '61000000-0000-4000-8000-000000000001'
    then '61000000-0000-4000-9000-000000000001'::uuid
  when '62000000-0000-4000-8000-000000000002'
    then '62000000-0000-4000-9000-000000000002'::uuid
  when '63000000-0000-4000-8000-000000000003'
    then '63000000-0000-4000-9000-000000000003'::uuid
  when '64000000-0000-4000-8000-000000000004'
    then '64000000-0000-4000-9000-000000000004'::uuid
end
where auth_user_id in (
  '61000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000002',
  '63000000-0000-4000-8000-000000000003',
  '64000000-0000-4000-8000-000000000004'
);

select ok(
  'public.person_relationships'::regclass is not null,
  'Person relationships table exists'
);
select ok(
  'public.person_manual_participants'::regclass is not null,
  'Person manual attachment table exists'
);
select ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.person_relationships'::regclass
  ),
  'Person relationships use RLS'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.person_relationships',
    'INSERT,UPDATE,DELETE'
  ),
  'authenticated clients cannot mutate Person relationships directly'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.person_manual_participants',
    'INSERT,UPDATE,DELETE'
  ),
  'authenticated clients cannot mutate manual attachments directly'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok(
  $$ select public.create_manual_participant('Manual Lan') $$,
  'the compatibility command creates a Manual Participant and Person'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.person_relationships
    where display_name = 'Manual Lan'
  $$,
  $$ values (1::bigint) $$,
  'the owner can read the created Manual Person'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.person_manual_participants as mapping
    join public.person_relationships as person on person.id = mapping.person_id
    where person.display_name = 'Manual Lan' and mapping.is_primary
  $$,
  $$ values (1::bigint) $$,
  'the Manual Participant is attached as the primary principal'
);
select throws_ok(
  $$
    insert into public.person_relationships(owner_participant_id, display_name)
    values ('61000000-0000-4000-9000-000000000001', 'Client write')
  $$,
  '42501',
  null,
  'RLS and grants reject ordinary client writes'
);

set local role postgres;

insert into public.friendships(
  participant_low_id, participant_high_id, requested_by, status, accepted_at
)
values
  (
    '61000000-0000-4000-9000-000000000001',
    '62000000-0000-4000-9000-000000000002',
    '61000000-0000-4000-9000-000000000001',
    'accepted',
    now()
  ),
  (
    '61000000-0000-4000-9000-000000000001',
    '63000000-0000-4000-9000-000000000003',
    '61000000-0000-4000-9000-000000000001',
    'archived',
    now()
  ),
  (
    '61000000-0000-4000-9000-000000000001',
    '64000000-0000-4000-9000-000000000004',
    '61000000-0000-4000-9000-000000000001',
    'blocked',
    now()
  );

select results_eq(
  $$
    select count(*)::bigint
    from public.person_relationships
    where owner_participant_id in (
      '61000000-0000-4000-9000-000000000001',
      '62000000-0000-4000-9000-000000000002',
      '63000000-0000-4000-9000-000000000003',
      '64000000-0000-4000-9000-000000000004'
    )
      and linked_participant_id in (
        '61000000-0000-4000-9000-000000000001',
        '62000000-0000-4000-9000-000000000002',
        '63000000-0000-4000-9000-000000000003',
        '64000000-0000-4000-9000-000000000004'
      )
  $$,
  $$ values (6::bigint) $$,
  'accepted, archived, and blocked established relationships create both Persons'
);

update public.friendships
set status = 'blocked', archived_at = now()
where participant_low_id = '61000000-0000-4000-9000-000000000001'
  and participant_high_id = '62000000-0000-4000-9000-000000000002';

select results_eq(
  $$
    select count(*)::bigint
    from public.person_relationships
    where owner_participant_id = '61000000-0000-4000-9000-000000000001'
      and linked_participant_id = '62000000-0000-4000-9000-000000000002'
  $$,
  $$ values (1::bigint) $$,
  'blocking an established relationship preserves Person identity'
);

update public.friendships
set status = 'accepted', archived_at = null
where participant_low_id = '61000000-0000-4000-9000-000000000001'
  and participant_high_id = '62000000-0000-4000-9000-000000000002';

insert into public.friendships(
  participant_low_id, participant_high_id, requested_by, status
)
values (
  '62000000-0000-4000-9000-000000000002',
  '63000000-0000-4000-9000-000000000003',
  '62000000-0000-4000-9000-000000000002',
  'pending'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.person_relationships
    where owner_participant_id = '62000000-0000-4000-9000-000000000002'
      and linked_participant_id = '63000000-0000-4000-9000-000000000003'
  $$,
  $$ values (0::bigint) $$,
  'a merely pending Friendship does not create Person identity'
);

select throws_ok(
  $$
    insert into public.person_relationships(
      owner_participant_id, display_name, linked_participant_id
    )
    select
      '61000000-0000-4000-9000-000000000001',
      'Invalid linked manual',
      manual.id
    from public.participants as manual
    where manual.display_name = 'Manual Lan'
  $$,
  'P0001',
  'linked_participant_must_be_account',
  'the database rejects a Manual Participant as linked principal'
);
select throws_ok(
  $$
    insert into public.person_manual_participants(
      person_id, manual_participant_id, is_primary
    )
    select
      person.id,
      '62000000-0000-4000-9000-000000000002',
      false
    from public.person_relationships as person
    where person.owner_participant_id =
      '61000000-0000-4000-9000-000000000001'
    limit 1
  $$,
  'P0001',
  'manual_attachment_must_be_manual',
  'the database rejects an account Participant as a manual attachment'
);
select throws_ok(
  $$
    insert into public.person_manual_participants(
      person_id, manual_participant_id, is_primary
    )
    select
      target_person.id,
      manual.id,
      false
    from public.person_relationships as target_person
    cross join public.participants as manual
    where target_person.owner_participant_id =
      '62000000-0000-4000-9000-000000000002'
      and manual.display_name = 'Manual Lan'
    limit 1
  $$,
  'P0001',
  'manual_attachment_owner_mismatch',
  'the database rejects a Manual Participant owned by another account'
);

insert into public.spaces(
  id, type, name, owner_participant_id, default_currency
)
values (
  '65000000-0000-4000-8000-000000000005',
  'trip',
  'Identity Boundary Trip',
  '61000000-0000-4000-9000-000000000001',
  'MYR'
);
insert into public.space_members(space_id, participant_id, role)
select
  '65000000-0000-4000-8000-000000000005',
  manual.id,
  'full_access'
from public.participants as manual
where manual.display_name = 'Manual Lan';

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok(
  $$
    select public.create_expense(
      '66000000-0000-4000-8000-000000000006',
      'direct',
      null,
      1000,
      'MYR',
      'Before link',
      'Other',
      current_date,
      array[
        '61000000-0000-4000-9000-000000000001'::uuid,
        (
          select manual_participant_id
          from public.person_manual_participants as mapping
          join public.person_relationships as person
            on person.id = mapping.person_id
          where person.display_name = 'Manual Lan'
          limit 1
        )
      ],
      array[1000::bigint, 0::bigint],
      array[500::bigint, 500::bigint]
    )
  $$,
  'an old Manual Direct expense can be created'
);
select lives_ok(
  $$
    select public.add_manual_space_member(
      '65000000-0000-4000-8000-000000000005',
      'Space Manual'
    )
  $$,
  'adding a Manual Space member also creates its Person'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.person_manual_participants as mapping
    join public.participants as manual
      on manual.id = mapping.manual_participant_id
    where manual.display_name = 'Space Manual'
  $$,
  $$ values (1::bigint) $$,
  'every supported Manual Participant creation crosses the Person boundary'
);

select lives_ok(
  $$
    select public.request_manual_participant_link(
      (
        select manual_participant_id
        from public.person_manual_participants as mapping
        join public.person_relationships as person
          on person.id = mapping.person_id
        where person.display_name = 'Manual Lan'
        limit 1
      ),
      '62000000-0000-4000-9000-000000000002'
    )
  $$,
  'the compatibility link command binds the request to the Manual Person'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.participant_link_requests
    where person_relationship_id is not null and status = 'pending'
  $$,
  $$ values (1::bigint) $$,
  'new link requests are explicitly Person-bound'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"62000000-0000-4000-8000-000000000002","is_anonymous":false}';
select lives_ok(
  $$
    select public.respond_manual_participant_link(
      (select id from public.participant_link_requests limit 1),
      'accepted'
    )
  $$,
  'the target can accept the Person-bound link'
);
select lives_ok(
  $$
    select public.respond_manual_participant_link(
      (select id from public.participant_link_requests limit 1),
      'accepted'
    )
  $$,
  'repeated acceptance is idempotent'
);

set local role postgres;
select results_eq(
  $$
    select ep.participant_id, ep.state, ep.tracking_mode
    from public.expense_participations as ep
    join public.expenses as expense on expense.id = ep.expense_id
    join public.participants as manual on manual.id = ep.participant_id
    where expense.client_request_id =
      '66000000-0000-4000-8000-000000000006'
      and manual.display_name = 'Manual Lan'
  $$,
  $$
    select
      manual.id,
      'untracked'::text,
      'untracked'::text
    from public.participants as manual
    where manual.display_name = 'Manual Lan'
  $$,
  'linking does not rewrite the historical financial principal or trust'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.space_members as member
    join public.participants as manual on manual.id = member.participant_id
    where member.space_id = '65000000-0000-4000-8000-000000000005'
      and manual.display_name = 'Manual Lan'
      and member.removed_at is null
  $$,
  $$ values (1::bigint) $$,
  'linking does not remove the Manual Participant from a Space'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.space_members
    where space_id = '65000000-0000-4000-8000-000000000005'
      and participant_id = '62000000-0000-4000-9000-000000000002'
  $$,
  $$ values (0::bigint) $$,
  'linking does not grant Space membership to the account'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.person_relationships
    where owner_participant_id = '61000000-0000-4000-9000-000000000001'
      and merged_into_person_id is null
      and linked_participant_id =
        '62000000-0000-4000-9000-000000000002'
  $$,
  $$ values (1::bigint) $$,
  'deterministic consolidation leaves one user-facing linked Person'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000001","is_anonymous":false}';
select lives_ok(
  $$
    select public.create_expense(
      '67000000-0000-4000-8000-000000000007',
      'direct',
      null,
      1000,
      'MYR',
      'After link',
      'Other',
      current_date,
      array[
        '61000000-0000-4000-9000-000000000001'::uuid,
        '62000000-0000-4000-9000-000000000002'::uuid
      ],
      array[1000::bigint, 0::bigint],
      array[500::bigint, 500::bigint]
    )
  $$,
  'a new Direct expense resolves to the linked account principal'
);

set local role postgres;
select results_eq(
  $$
    select ep.state, ep.tracking_mode
    from public.expense_participations as ep
    join public.expenses as expense on expense.id = ep.expense_id
    where expense.client_request_id =
      '67000000-0000-4000-8000-000000000007'
      and ep.participant_id =
        '62000000-0000-4000-9000-000000000002'
  $$,
  $$ values ('pending'::text, 'tracked'::text) $$,
  'new linked Direct participation uses normal pending confirmation'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"62000000-0000-4000-8000-000000000002","is_anonymous":false}';
select results_eq(
  $$
    select count(*)::bigint
    from public.person_relationships
    where owner_participant_id =
      '61000000-0000-4000-9000-000000000001'
  $$,
  $$ values (0::bigint) $$,
  'Person RLS prevents reading another owner relationship'
);

select * from finish();
rollback;
