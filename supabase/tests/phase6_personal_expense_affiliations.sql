begin;

create extension if not exists pgtap with schema extensions;
select plan(41);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000','76000000-0000-4000-8000-000000000001',
   'authenticated','authenticated','affiliation-owner@example.test','',now(),
   '{"provider":"email","providers":["email"]}','{"display_name":"Owner"}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','77000000-0000-4000-8000-000000000002',
   'authenticated','authenticated','affiliation-lan@example.test','',now(),
   '{"provider":"email","providers":["email"]}','{"display_name":"Lan"}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','78000000-0000-4000-8000-000000000003',
   'authenticated','authenticated','affiliation-pending@example.test','',now(),
   '{"provider":"email","providers":["email"]}','{"display_name":"Pending"}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','79000000-0000-4000-8000-000000000004',
   'authenticated','authenticated','affiliation-outsider@example.test','',now(),
   '{"provider":"email","providers":["email"]}','{"display_name":"Outsider"}',now(),now());

update public.participants
set id = case auth_user_id
  when '76000000-0000-4000-8000-000000000001' then 'a6000000-0000-4000-8000-000000000001'::uuid
  when '77000000-0000-4000-8000-000000000002' then 'b7000000-0000-4000-8000-000000000002'::uuid
  when '78000000-0000-4000-8000-000000000003' then 'c8000000-0000-4000-8000-000000000003'::uuid
  when '79000000-0000-4000-8000-000000000004' then 'd9000000-0000-4000-8000-000000000004'::uuid
end
where auth_user_id in (
  '76000000-0000-4000-8000-000000000001',
  '77000000-0000-4000-8000-000000000002',
  '78000000-0000-4000-8000-000000000003',
  '79000000-0000-4000-8000-000000000004'
);

insert into public.spaces(
  id, type, name, owner_participant_id, default_currency
)
values (
  'ea000000-0000-4000-8000-000000000005',
  'trip',
  'Hanoi Days',
  'a6000000-0000-4000-8000-000000000001',
  'MYR'
);

insert into public.space_members(
  space_id, participant_id, role, joined_at
)
values
  ('ea000000-0000-4000-8000-000000000005','a6000000-0000-4000-8000-000000000001','owner','2026-01-01 00:00:00+00'),
  ('ea000000-0000-4000-8000-000000000005','b7000000-0000-4000-8000-000000000002','view','2026-01-01 00:00:00+00');

insert into public.expenses(
  id, client_request_id, scope, space_id, created_by, total_minor,
  participant_count, currency, description, category, occurred_on, created_at
)
values
  ('8a000000-0000-4000-8000-000000000001','9a000000-0000-4000-8000-000000000001','personal',null,'a6000000-0000-4000-8000-000000000001',1500,1,'MYR','Personal latte','Food','2026-01-02','2026-01-02 00:00:00+00'),
  ('8a000000-0000-4000-8000-000000000002','9a000000-0000-4000-8000-000000000002','direct',null,'a6000000-0000-4000-8000-000000000001',5000,2,'MYR','Accepted dinner','Food','2026-01-02','2026-01-02 00:00:00+00'),
  ('8a000000-0000-4000-8000-000000000003','9a000000-0000-4000-8000-000000000003','direct',null,'a6000000-0000-4000-8000-000000000001',2400,2,'MYR','Pending Grab','Transport','2026-01-02','2026-01-02 00:00:00+00'),
  ('8a000000-0000-4000-8000-000000000004','9a000000-0000-4000-8000-000000000004','personal',null,'b7000000-0000-4000-8000-000000000002',2000,1,'MYR','Lan private','Other','2026-01-02','2026-01-02 00:00:00+00'),
  ('8a000000-0000-4000-8000-000000000005','9a000000-0000-4000-8000-000000000005','space','ea000000-0000-4000-8000-000000000005','a6000000-0000-4000-8000-000000000001',6000,2,'MYR','Trip dinner','Food','2026-01-02','2026-01-02 00:00:00+00');

insert into public.expense_participations(
  expense_id, participant_id, name_snapshot, participant_order, state, tracking_mode
)
values
  ('8a000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','Owner',0,'accepted','tracked'),
  ('8a000000-0000-4000-8000-000000000002','a6000000-0000-4000-8000-000000000001','Owner',0,'accepted','tracked'),
  ('8a000000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000002','Lan',1,'accepted','tracked'),
  ('8a000000-0000-4000-8000-000000000003','a6000000-0000-4000-8000-000000000001','Owner',0,'accepted','tracked'),
  ('8a000000-0000-4000-8000-000000000003','c8000000-0000-4000-8000-000000000003','Pending',1,'pending','tracked'),
  ('8a000000-0000-4000-8000-000000000004','b7000000-0000-4000-8000-000000000002','Lan',0,'accepted','tracked'),
  ('8a000000-0000-4000-8000-000000000005','a6000000-0000-4000-8000-000000000001','Owner',0,'accepted','tracked'),
  ('8a000000-0000-4000-8000-000000000005','b7000000-0000-4000-8000-000000000002','Lan',1,'accepted','tracked');

select is((
  select relrowsecurity
  from pg_catalog.pg_class
  where oid = 'public.personal_expense_affiliations'::regclass
),true,'personal expense affiliations have RLS enabled');

select is(pg_catalog.has_table_privilege(
  'authenticated','public.personal_expense_affiliations','SELECT'
),true,'authenticated owners can select visible private affiliations');

select is(pg_catalog.has_table_privilege(
  'authenticated','public.personal_expense_affiliations','INSERT,UPDATE,DELETE'
),false,'authenticated clients cannot write affiliations directly');

select is(pg_catalog.has_function_privilege(
  'authenticated',
  'public.upsert_personal_expense_affiliation(uuid,text,integer)',
  'EXECUTE'
),true,'authenticated owners can invoke affiliation upsert');

select is(pg_catalog.has_function_privilege(
  'authenticated',
  'public.archive_personal_expense_affiliation(uuid,integer)',
  'EXECUTE'
),true,'authenticated owners can invoke affiliation archive');

select is(pg_catalog.has_function_privilege(
  'anon','public.upsert_personal_expense_affiliation(uuid,text,integer)','EXECUTE'
),false,'anonymous sessions cannot classify expenses');

select is(pg_catalog.has_function_privilege(
  'anon','public.archive_personal_expense_affiliation(uuid,integer)','EXECUTE'
),false,'anonymous sessions cannot archive affiliations');

select is(pg_catalog.has_function_privilege(
  'authenticated','private.validate_personal_expense_affiliation()','EXECUTE'
),false,'clients cannot invoke the affiliation integrity trigger directly');

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"76000000-0000-4000-8000-000000000001","is_anonymous":false}';

select results_eq($$
  select public.upsert_personal_expense_affiliation(
    '8a000000-0000-4000-8000-000000000001','  Hanoi solo  ',null
  ) is not null
$$,$$ values (true) $$,'owner can classify a readable personal expense');

select results_eq($$
  select label, archived_at is null, version
  from public.personal_expense_affiliations
  where expense_id='8a000000-0000-4000-8000-000000000001'
$$,$$ values ('Hanoi solo'::text,true,1) $$,
'new affiliations trim labels and start active at version one');

select results_eq($$
  select public.upsert_personal_expense_affiliation(
    '8a000000-0000-4000-8000-000000000001','Hanoi solo',null
  ) = (
    select id from public.personal_expense_affiliations
    where expense_id='8a000000-0000-4000-8000-000000000001'
  )
$$,$$ values (true) $$,'repeating the same desired label is idempotent');

select results_eq($$
  select version from public.personal_expense_affiliations
  where expense_id='8a000000-0000-4000-8000-000000000001'
$$,$$ values (1) $$,'an idempotent retry does not increment version');

select throws_ok($$
  select public.upsert_personal_expense_affiliation(
    '8a000000-0000-4000-8000-000000000001','Hanoi coffee',null
  )
$$,'P0001','version_conflict','renaming requires an expected version');

select throws_ok($$
  select public.upsert_personal_expense_affiliation(
    '8a000000-0000-4000-8000-000000000001','Hanoi coffee',9
  )
$$,'P0001','version_conflict','renaming rejects a stale version');

select results_eq($$
  select public.upsert_personal_expense_affiliation(
    '8a000000-0000-4000-8000-000000000001','Hanoi coffee',1
  ) is not null
$$,$$ values (true) $$,'owner can rename with the current version');

select results_eq($$
  select label, version from public.personal_expense_affiliations
  where expense_id='8a000000-0000-4000-8000-000000000001'
$$,$$ values ('Hanoi coffee'::text,2) $$,
'rename stores the new label and increments version');

select throws_ok($$
  select public.upsert_personal_expense_affiliation(
    '8a000000-0000-4000-8000-000000000001','   ',2
  )
$$,'P0001','invalid_trip_label','blank travel labels are rejected');

select throws_ok($$
  select public.upsert_personal_expense_affiliation(
    '8a000000-0000-4000-8000-000000000001',repeat('x',81),2
  )
$$,'P0001','invalid_trip_label','travel labels longer than eighty characters are rejected');

select throws_ok($$
  select public.upsert_personal_expense_affiliation(
    '8a000000-0000-4000-8000-000000000004','Secret trip',null
  )
$$,'P0001','expense_not_visible','an owner cannot classify another person private expense');

select results_eq($$
  select public.upsert_personal_expense_affiliation(
    '8a000000-0000-4000-8000-000000000002','Shared Hanoi',null
  ) is not null
$$,$$ values (true) $$,'owner can classify a readable shared expense');

select results_eq($$
  select count(*)::bigint
  from public.personal_expense_affiliations
  where archived_at is null
$$,$$ values (2::bigint) $$,'owner sees two active private travel classifications');

select throws_ok($$
  insert into public.personal_expense_affiliations(
    owner_participant_id,expense_id,label
  ) values (
    'a6000000-0000-4000-8000-000000000001',
    '8a000000-0000-4000-8000-000000000005',
    'Direct write'
  )
$$,'42501','permission denied for table personal_expense_affiliations',
'owners cannot bypass the affiliation RPC');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"77000000-0000-4000-8000-000000000002","is_anonymous":false}';

select results_eq($$
  select count(*)::bigint from public.personal_expense_affiliations
$$,$$ values (0::bigint) $$,'Lan cannot see the owner private travel labels');

select results_eq($$
  select public.upsert_personal_expense_affiliation(
    '8a000000-0000-4000-8000-000000000002','Lan Hanoi',null
  ) is not null
$$,$$ values (true) $$,'an accepted participant can create her own label');

select results_eq($$
  select label from public.personal_expense_affiliations
$$,$$ values ('Lan Hanoi'::text) $$,'Lan sees only her own affiliation');

select throws_ok($$
  select public.archive_personal_expense_affiliation(
    (
      select id from public.personal_expense_affiliations
      where owner_participant_id='a6000000-0000-4000-8000-000000000001'
      limit 1
    ),1
  )
$$,'P0001','affiliation_not_found','a counterparty cannot archive the owner private label');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"78000000-0000-4000-8000-000000000003","is_anonymous":false}';

select throws_ok($$
  select public.upsert_personal_expense_affiliation(
    '8a000000-0000-4000-8000-000000000003','Pending trip',null
  )
$$,'P0001','expense_not_visible','pending participation cannot create a travel affiliation');

select results_eq($$
  select count(*)::bigint from public.personal_expense_affiliations
$$,$$ values (0::bigint) $$,'pending participants see no private affiliations');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"79000000-0000-4000-8000-000000000004","is_anonymous":false}';

select throws_ok($$
  select public.upsert_personal_expense_affiliation(
    '8a000000-0000-4000-8000-000000000001','Guessed trip',null
  )
$$,'P0001','expense_not_visible','an unrelated participant cannot classify a guessed expense UUID');

select results_eq($$
  select count(*)::bigint from public.personal_expense_affiliations
$$,$$ values (0::bigint) $$,'an unrelated participant sees no affiliations');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"76000000-0000-4000-8000-000000000001","is_anonymous":false}';

select throws_ok($$
  select public.archive_personal_expense_affiliation(
    (
      select id from public.personal_expense_affiliations
      where expense_id='8a000000-0000-4000-8000-000000000001'
    ),1
  )
$$,'P0001','version_conflict','archive rejects a stale version');

select results_eq($$
  select public.archive_personal_expense_affiliation(
    (
      select id from public.personal_expense_affiliations
      where expense_id='8a000000-0000-4000-8000-000000000001'
    ),2
  ) is not null
$$,$$ values (true) $$,'owner can archive with the current version');

select results_eq($$
  select archived_at is not null, version
  from public.personal_expense_affiliations
  where expense_id='8a000000-0000-4000-8000-000000000001'
$$,$$ values (true,3) $$,'archive preserves the row and increments version');

select results_eq($$
  select count(*)::bigint from public.expenses
  where id='8a000000-0000-4000-8000-000000000001'
$$,$$ values (1::bigint) $$,'archiving a label never deletes its Canonical Expense');

select results_eq($$
  select public.archive_personal_expense_affiliation(
    (
      select id from public.personal_expense_affiliations
      where expense_id='8a000000-0000-4000-8000-000000000001'
    ),2
  ) is not null
$$,$$ values (true) $$,'repeating archive is idempotent even with the original version');

select throws_ok($$
  select public.upsert_personal_expense_affiliation(
    '8a000000-0000-4000-8000-000000000001','Hanoi return',2
  )
$$,'P0001','version_conflict','reactivation rejects the pre-archive version');

select results_eq($$
  select public.upsert_personal_expense_affiliation(
    '8a000000-0000-4000-8000-000000000001','Hanoi return',3
  ) is not null
$$,$$ values (true) $$,'owner can reactivate an archived affiliation');

select results_eq($$
  select label, archived_at is null, version
  from public.personal_expense_affiliations
  where expense_id='8a000000-0000-4000-8000-000000000001'
$$,$$ values ('Hanoi return'::text,true,4) $$,
'reactivation restores the active row at the next version');

select results_eq($$
  select count(*)::bigint
  from public.personal_expense_affiliations
  where archived_at is null
$$,$$ values (2::bigint) $$,'travel mode can filter the owner two active affiliation rows');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"79000000-0000-4000-8000-000000000004","is_anonymous":false}';

select results_eq($$
  select count(*)::bigint from public.expenses
  where id='8a000000-0000-4000-8000-000000000001'
$$,$$ values (0::bigint) $$,'a private affiliation never grants expense read access');

reset role;

select throws_ok($$
  insert into public.personal_expense_affiliations(
    owner_participant_id,expense_id,label
  ) values (
    'd9000000-0000-4000-8000-000000000004',
    '8a000000-0000-4000-8000-000000000001',
    'Invalid server write'
  )
$$,'P0001','expense_not_visible',
'the integrity trigger rejects server writes that would manufacture access');

select * from finish();
rollback;
