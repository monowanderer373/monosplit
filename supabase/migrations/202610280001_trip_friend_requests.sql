-- Issue02: directed, consent-based friendship requests. No expense or principal rewrites.
begin;
create table public.trip_friend_requests (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.participants(id),
 target_id uuid not null references public.participants(id),
 source_space_id uuid not null references public.spaces(id),
 source_name text not null,
 sender_name text not null,
 target_name text not null,
 pair_low uuid generated always as (least(sender_id,target_id)) stored,
 pair_high uuid generated always as (greatest(sender_id,target_id)) stored,
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled','expired')),
 version integer not null default 1 check(version>0),
 friendship_id uuid references public.friendships(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 responded_at timestamptz,
 check(sender_id<>target_id)
);
create unique index trip_friend_one_pending_pair on public.trip_friend_requests(pair_low,pair_high) where status='pending';
create index trip_friend_target_pending on public.trip_friend_requests(target_id,created_at) where status='pending';
create table private.trip_friend_command_receipts (
 actor_id uuid not null references public.participants(id),
 command_id uuid not null,
 target_id uuid not null,
 source_space_id uuid not null,
 request_id uuid not null references public.trip_friend_requests(id),
 primary key(actor_id,command_id)
);
alter table public.trip_friend_requests enable row level security;
alter table private.trip_friend_command_receipts enable row level security;
revoke all on public.trip_friend_requests from public,anon,authenticated;
revoke all on private.trip_friend_command_receipts from public,anon,authenticated;
grant select on public.trip_friend_requests to authenticated;
create policy trip_friend_read_pair on public.trip_friend_requests for select to authenticated
 using(public.is_permanent_account() and public.current_participant_id() in(sender_id,target_id));

create function public.send_trip_friend_request(command_id uuid,target_participant_id uuid,source_trip_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=public.current_participant_id(); low_id uuid; high_id uuid;
 prior private.trip_friend_command_receipts%rowtype;
 item public.trip_friend_requests%rowtype;
 friendship public.friendships%rowtype;
 source public.spaces%rowtype; sender_name text; target_name text;
begin
 if actor is null or not public.is_permanent_account() then raise exception 'permanent_account_required'; end if;
 if command_id is null or target_participant_id is null or target_participant_id=actor then raise exception 'friend_request_unavailable'; end if;
 low_id:=least(actor,target_participant_id);high_id:=greatest(actor,target_participant_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trip-friend:'||low_id::text||':'||high_id::text,0));
 select * into prior from private.trip_friend_command_receipts c where c.actor_id=actor and c.command_id=send_trip_friend_request.command_id;
 if prior.command_id is not null then
  if prior.target_id<>target_participant_id or prior.source_space_id is distinct from source_trip_id then raise exception 'request_payload_mismatch'; end if;
  return prior.request_id;
 end if;
 select * into source from public.spaces s where s.id=source_trip_id and s.type='trip' and s.status<>'voided' for share;
 if source.id is null or not private.is_active_space_member(source.id,actor) or not private.is_active_space_member(source.id,target_participant_id) then raise exception 'friend_request_unavailable'; end if;
 -- Lock memberships against removal until the authorized request is recorded.
 perform 1 from public.space_members m where m.space_id=source.id and m.participant_id in(actor,target_participant_id) and m.removed_at is null for share;
 if not private.is_active_space_member(source.id,actor) or not private.is_active_space_member(source.id,target_participant_id) then raise exception 'friend_request_unavailable'; end if;
 select p.display_name into sender_name from public.participants p join auth.users u on u.id=p.auth_user_id where p.id=actor and p.kind='account' and not coalesce(u.is_anonymous,false) and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now());
 select p.display_name into target_name from public.participants p join auth.users u on u.id=p.auth_user_id where p.id=target_participant_id and p.kind='account' and not coalesce(u.is_anonymous,false) and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now());
 if sender_name is null or target_name is null then raise exception 'friend_request_unavailable'; end if;
 select * into friendship from public.friendships f where f.participant_low_id=low_id and f.participant_high_id=high_id for update;
 if friendship.status in('blocked','archived','accepted') then raise exception 'friend_request_unavailable'; end if;
 update public.trip_friend_requests r set status='expired',version=r.version+1,responded_at=now() where r.pair_low=low_id and r.pair_high=high_id and r.status='pending' and r.expires_at<=now();
 select * into item from public.trip_friend_requests r where r.pair_low=low_id and r.pair_high=high_id and r.status='pending' for update;
 if item.id is null then
  if exists(select 1 from public.trip_friend_requests r where r.pair_low=low_id and r.pair_high=high_id and r.status='declined' and r.responded_at>now()-interval '24 hours') then raise exception 'friend_request_unavailable'; end if;
  insert into public.trip_friend_requests(sender_id,target_id,source_space_id,source_name,sender_name,target_name)
   values(actor,target_participant_id,source.id,source.name,sender_name,target_name) returning * into item;
 end if;
 insert into private.trip_friend_command_receipts values(actor,command_id,target_participant_id,source_trip_id,item.id);
 return item.id;
end; $$;

create function public.respond_trip_friend_request(target_request_id uuid,response text,expected_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.current_participant_id(); item public.trip_friend_requests%rowtype; friendship public.friendships%rowtype; result_id uuid;
begin
 if actor is null or not public.is_permanent_account() then raise exception 'permanent_account_required'; end if;
 select * into item from public.trip_friend_requests r where r.id=target_request_id and actor in(r.sender_id,r.target_id);
 if item.id is null or response not in('accepted','declined','cancelled') or response is null then raise exception 'friend_request_unavailable'; end if;
 if (response='cancelled' and actor<>item.sender_id) or (response<>'cancelled' and actor<>item.target_id) then raise exception 'friend_request_unavailable'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trip-friend:'||item.pair_low::text||':'||item.pair_high::text,0));
 select * into item from public.trip_friend_requests r where r.id=target_request_id for update;
 if item.status=response then return; end if;
 if item.status<>'pending' or item.expires_at<=now() then raise exception 'friend_request_unavailable'; end if;
 if item.version is distinct from expected_version then raise exception 'version_conflict'; end if;
 if response='accepted' then
 if (select count(*) from public.participants p join auth.users u on u.id=p.auth_user_id where p.id in(item.sender_id,item.target_id) and p.kind='account' and not coalesce(u.is_anonymous,false) and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()))<>2 then raise exception 'friend_request_unavailable'; end if;
 select * into friendship from public.friendships f where f.participant_low_id=item.pair_low and f.participant_high_id=item.pair_high for update;
 if friendship.status in('blocked','archived') then raise exception 'friend_request_unavailable'; end if;
  insert into public.friendships as established(participant_low_id,participant_high_id,requested_by,status,accepted_at)
   values(item.pair_low,item.pair_high,item.sender_id,'accepted',now())
   on conflict(participant_low_id,participant_high_id) do update set status='accepted',accepted_at=coalesce(established.accepted_at,now()) where established.status in('pending','accepted') returning id into result_id;
  if result_id is null then raise exception 'friend_request_unavailable'; end if;
  -- Original friendship trigger creates both owner-scoped Person relationships atomically.
 end if;
 update public.trip_friend_requests r set status=response,version=r.version+1,responded_at=now(),friendship_id=result_id where r.id=item.id;
end; $$;

create function public.get_trip_friend_states(source_trip_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=public.current_participant_id(); result jsonb;
begin
 if actor is null or not public.is_permanent_account() then raise exception 'permanent_account_required'; end if;
 if not exists(select 1 from public.spaces s where s.id=source_trip_id and s.type='trip' and s.status<>'voided') or not private.is_active_space_member(source_trip_id,actor) then raise exception 'space_access_denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('participantId',p.id,'state',
  case when u.id is null or coalesce(u.is_anonymous,false) or u.deleted_at is not null or u.banned_until>now() or f.status in('blocked','archived') then 'unavailable'
   when f.status='accepted' then 'friend' when recent.id is not null then 'unavailable' when r.id is not null then case when r.sender_id=actor then 'sent' else 'incoming' end else 'available' end,
  'requestId',r.id,'version',r.version)), '[]'::jsonb) into result
 from public.space_members m join public.participants p on p.id=m.participant_id
 left join auth.users u on u.id=p.auth_user_id
 left join public.friendships f on f.participant_low_id=least(actor,p.id) and f.participant_high_id=greatest(actor,p.id)
 left join public.trip_friend_requests r on r.pair_low=least(actor,p.id) and r.pair_high=greatest(actor,p.id) and r.status='pending' and r.expires_at>now()
 left join lateral(select q.id from public.trip_friend_requests q where q.pair_low=least(actor,p.id) and q.pair_high=greatest(actor,p.id) and q.status='declined' and q.responded_at>now()-interval '24 hours' limit 1)recent on true
 where m.space_id=source_trip_id and m.removed_at is null and p.kind='account' and p.id<>actor;
 return result;
end; $$;
-- Server time and current pair availability govern pending review, even after source access ends.
create function public.get_pending_trip_friend_requests()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=public.current_participant_id(); result jsonb;
begin
 if actor is null or not public.is_permanent_account() then raise exception 'permanent_account_required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'sender_id',r.sender_id,'target_id',r.target_id,'source_name',r.source_name,'sender_name',r.sender_name,'target_name',r.target_name,'status',r.status,'version',r.version,'expires_at',r.expires_at,
 'canAccept',not exists(select 1 from public.friendships f where f.participant_low_id=r.pair_low and f.participant_high_id=r.pair_high and f.status in('blocked','archived')) and (select count(*) from public.participants p join auth.users u on u.id=p.auth_user_id where p.id in(r.sender_id,r.target_id) and p.kind='account' and not coalesce(u.is_anonymous,false) and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()))=2)order by r.created_at,r.id),'[]'::jsonb) into result
 from public.trip_friend_requests r where actor in(r.sender_id,r.target_id) and r.status='pending' and r.expires_at>now();
 return result;
end; $$;
revoke all on function public.get_pending_trip_friend_requests() from public,anon;
grant execute on function public.get_pending_trip_friend_requests() to authenticated;
revoke all on function public.send_trip_friend_request(uuid,uuid,uuid) from public,anon;
revoke all on function public.respond_trip_friend_request(uuid,text,integer) from public,anon;
revoke all on function public.get_trip_friend_states(uuid) from public,anon;
grant execute on function public.send_trip_friend_request(uuid,uuid,uuid) to authenticated;
grant execute on function public.respond_trip_friend_request(uuid,text,integer) to authenticated;
grant execute on function public.get_trip_friend_states(uuid) to authenticated;
do $$begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='trip_friend_requests') then alter publication supabase_realtime add table public.trip_friend_requests; end if;
end;$$;
notify pgrst,'reload schema';
commit;
