-- Preserve one private recovery copy before the approved private-beta account
-- reset cascades through historical MonoSplit membership rows.

create table if not exists private.legacy_beta_recovery (
  source_table text not null
    check (source_table in ('groups', 'user_groups', 'group_invite_links')),
  source_key text not null,
  row_data jsonb not null,
  archived_at timestamptz not null default pg_catalog.now(),
  primary key (source_table, source_key)
);

revoke all on table private.legacy_beta_recovery from public;
revoke all on table private.legacy_beta_recovery from anon;
revoke all on table private.legacy_beta_recovery from authenticated;
grant select on table private.legacy_beta_recovery to service_role;

do $$
begin
  if pg_catalog.to_regclass('public.groups') is not null then
    execute $archive$
      insert into private.legacy_beta_recovery(
        source_table,
        source_key,
        row_data
      )
      select 'groups', legacy_group.id::text, pg_catalog.to_jsonb(legacy_group)
      from public.groups as legacy_group
      on conflict (source_table, source_key)
      do update set
        row_data = excluded.row_data,
        archived_at = pg_catalog.now()
    $archive$;
  end if;

  if pg_catalog.to_regclass('public.user_groups') is not null then
    execute $archive$
      insert into private.legacy_beta_recovery(
        source_table,
        source_key,
        row_data
      )
      select
        'user_groups',
        legacy_membership.user_id::text || ':' || legacy_membership.group_id::text,
        pg_catalog.to_jsonb(legacy_membership)
      from public.user_groups as legacy_membership
      on conflict (source_table, source_key)
      do update set
        row_data = excluded.row_data,
        archived_at = pg_catalog.now()
    $archive$;
  end if;

  if pg_catalog.to_regclass('public.group_invite_links') is not null then
    execute $archive$
      insert into private.legacy_beta_recovery(
        source_table,
        source_key,
        row_data
      )
      select
        'group_invite_links',
        pg_catalog.encode(
          extensions.digest(legacy_invite.token::text, 'sha256'),
          'hex'
        ),
        (
          pg_catalog.to_jsonb(legacy_invite) - 'token'
        ) || pg_catalog.jsonb_build_object(
          'token_sha256',
          pg_catalog.encode(
            extensions.digest(legacy_invite.token::text, 'sha256'),
            'hex'
          )
        )
      from public.group_invite_links as legacy_invite
      on conflict (source_table, source_key)
      do update set
        row_data = excluded.row_data,
        archived_at = pg_catalog.now()
    $archive$;
  end if;
end
$$;
