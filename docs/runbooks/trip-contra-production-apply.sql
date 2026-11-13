-- COMPLETE: existing Tabby Tally skiqsxvmxvmxfzhrzcxh with creator proxy installed.
-- Adds shared bilateral contra snapshots and explicit-net coverage. Does not record payments or change balances.
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('tabby.personal-periods.migration',0));
do $contra_install$
declare migration_sql text;
begin
 if(select array_agg(version order by version)from supabase_migrations.schema_migrations where version<>'202611120001')is distinct from array['202608300001','202608300002','202608300003','202608300004','202608300005','202608300006','202608300007','202608300008','202608300009','202608300010','202608300011','202608300012','202609080001','202609210001','202609210002','202609210003','202609210004','202609210005','202609210006','202609210007','202609240001','202610050001','202610090001','202610090002','202610130001','202610130002','20261016130602','20261016132156','202610250001','202610250002','202610250003','202610260001','202610280001','202610310001','202611030001','202611030002','202611040001','202611050001','202611050002','202611100001','202611100002','202611110001']::text[]then raise exception 'Unexpected contra baseline: installed creator proxy required';end if;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='202611120001')then
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid)'))is distinct from '5d0f6a08ae247bc3f9d75e43d6ad2ade'then raise exception 'Unexpected pre-contra function: public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid)';end if;
 if has_function_privilege('anon','public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid)','EXECUTE')or has_function_privilege('authenticated','public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.respond_fx_settlement_bundle(uuid,text,integer,uuid)'))is distinct from 'f87644372ddc6d54f8a2b20df17dd282'then raise exception 'Unexpected pre-contra function: public.respond_fx_settlement_bundle(uuid,text,integer,uuid)';end if;
 if has_function_privilege('anon','public.respond_fx_settlement_bundle(uuid,text,integer,uuid)','EXECUTE')or has_function_privilege('authenticated','public.respond_fx_settlement_bundle(uuid,text,integer,uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.cancel_fx_settlement_bundle(uuid,integer)'))is distinct from '924ef06ac69089ea9f62194023f532b5'then raise exception 'Unexpected pre-contra function: public.cancel_fx_settlement_bundle(uuid,integer)';end if;
 if has_function_privilege('anon','public.cancel_fx_settlement_bundle(uuid,integer)','EXECUTE')or has_function_privilege('authenticated','public.cancel_fx_settlement_bundle(uuid,integer)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.reverse_fx_settlement_bundle(uuid,uuid,integer)'))is distinct from '5b0eeb2bdab5617d1d06bbed80704664'then raise exception 'Unexpected pre-contra function: public.reverse_fx_settlement_bundle(uuid,uuid,integer)';end if;
 if has_function_privilege('anon','public.reverse_fx_settlement_bundle(uuid,uuid,integer)','EXECUTE')or has_function_privilege('authenticated','public.reverse_fx_settlement_bundle(uuid,uuid,integer)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.fx_pair_quote(uuid,uuid,uuid,text,text,jsonb,bigint,boolean)'))is distinct from '1cae10a41b2abf0bd44670e14de14c37'then raise exception 'Unexpected pre-contra function: private.fx_pair_quote(uuid,uuid,uuid,text,text,jsonb,bigint,boolean)';end if;
 if has_function_privilege('anon','private.fx_pair_quote(uuid,uuid,uuid,text,text,jsonb,bigint,boolean)','EXECUTE')or has_function_privilege('authenticated','private.fx_pair_quote(uuid,uuid,uuid,text,text,jsonb,bigint,boolean)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.trip_batch_account(uuid,uuid,text)'))is distinct from 'efcb29454edc9892f09345e821fbc620'then raise exception 'Unexpected pre-contra function: private.trip_batch_account(uuid,uuid,text)';end if;
 if has_function_privilege('anon','private.trip_batch_account(uuid,uuid,text)','EXECUTE')or has_function_privilege('authenticated','private.trip_batch_account(uuid,uuid,text)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.trip_batch_review(uuid,uuid,text,text,uuid,jsonb)'))is distinct from 'f4993ca37a0cf26ecb0759bb9c48b2aa'then raise exception 'Unexpected pre-contra function: private.trip_batch_review(uuid,uuid,text,text,uuid,jsonb)';end if;
 if has_function_privilege('anon','private.trip_batch_review(uuid,uuid,text,text,uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','private.trip_batch_review(uuid,uuid,text,text,uuid,jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.quote_trip_settlement_batch(uuid,text,text,uuid,jsonb)'))is distinct from '01c51df88f6bed7121b49e4566dacdd8'then raise exception 'Unexpected pre-contra function: public.quote_trip_settlement_batch(uuid,text,text,uuid,jsonb)';end if;
 if has_function_privilege('anon','public.quote_trip_settlement_batch(uuid,text,text,uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','public.quote_trip_settlement_batch(uuid,text,text,uuid,jsonb)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.submit_trip_settlement_batch(uuid,uuid)'))is distinct from '4957b0614b8315b45284508fe54d4b8c'then raise exception 'Unexpected pre-contra function: public.submit_trip_settlement_batch(uuid,uuid)';end if;
 if has_function_privilege('anon','public.submit_trip_settlement_batch(uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','public.submit_trip_settlement_batch(uuid,uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.fx_release_bundle_cash(uuid,uuid)'))is distinct from '16e38eb7d1bbd83b4044e157b1a01ec6'then raise exception 'Unexpected pre-contra function: private.fx_release_bundle_cash(uuid,uuid)';end if;
 if has_function_privilege('anon','private.fx_release_bundle_cash(uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','private.fx_release_bundle_cash(uuid,uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.respond_fx_bundle(uuid,text,integer,jsonb,boolean)'))is distinct from 'c8006e3950ff3cba48da728d091cbe64'then raise exception 'Unexpected pre-contra function: private.respond_fx_bundle(uuid,text,integer,jsonb,boolean)';end if;
 if has_function_privilege('anon','private.respond_fx_bundle(uuid,text,integer,jsonb,boolean)','EXECUTE')or has_function_privilege('authenticated','private.respond_fx_bundle(uuid,text,integer,jsonb,boolean)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.respond_trip_batch_child(uuid,text,integer,jsonb)'))is distinct from '44edffb1cca036e648fc9a72e9d0a9d9'then raise exception 'Unexpected pre-contra function: public.respond_trip_batch_child(uuid,text,integer,jsonb)';end if;
 if has_function_privilege('anon','public.respond_trip_batch_child(uuid,text,integer,jsonb)','EXECUTE')or has_function_privilege('authenticated','public.respond_trip_batch_child(uuid,text,integer,jsonb)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_value(bigint,text,numeric,numeric)'))is distinct from '03a36afaaa9283132639a2a676b76b25'then raise exception 'Unexpected pre-contra function: private.routed_value(bigint,text,numeric,numeric)';end if;
 if has_function_privilege('anon','private.routed_value(bigint,text,numeric,numeric)','EXECUTE')or has_function_privilege('authenticated','private.routed_value(bigint,text,numeric,numeric)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_edge(uuid,uuid,uuid,numeric,numeric)'))is distinct from '68b1d452b3c1b568e41adfe0ffd8bf99'then raise exception 'Unexpected pre-contra function: private.routed_edge(uuid,uuid,uuid,numeric,numeric)';end if;
 if has_function_privilege('anon','private.routed_edge(uuid,uuid,uuid,numeric,numeric)','EXECUTE')or has_function_privilege('authenticated','private.routed_edge(uuid,uuid,uuid,numeric,numeric)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_build(uuid,uuid,jsonb)'))is distinct from 'ed0ad8532c45a7fea81b16f39861cd3a'then raise exception 'Unexpected pre-contra function: private.routed_build(uuid,uuid,jsonb)';end if;
 if has_function_privilege('anon','private.routed_build(uuid,uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','private.routed_build(uuid,uuid,jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_public_plan(jsonb)'))is distinct from '532e3731690e7acf89f8e25080dfb2ca'then raise exception 'Unexpected pre-contra function: private.routed_public_plan(jsonb)';end if;
 if has_function_privilege('anon','private.routed_public_plan(jsonb)','EXECUTE')or has_function_privilege('authenticated','private.routed_public_plan(jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_digest(uuid,uuid,jsonb,jsonb,timestamptz)'))is distinct from 'bb5e9203c4c15d8a6b257179e32ce68e'then raise exception 'Unexpected pre-contra function: private.routed_digest(uuid,uuid,jsonb,jsonb,timestamptz)';end if;
 if has_function_privilege('anon','private.routed_digest(uuid,uuid,jsonb,jsonb,timestamptz)','EXECUTE')or has_function_privilege('authenticated','private.routed_digest(uuid,uuid,jsonb,jsonb,timestamptz)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.preview_trip_routed_settlement(uuid,jsonb,timestamptz)'))is distinct from '24410c24dbf3a99fde829771e0a510b4'then raise exception 'Unexpected pre-contra function: public.preview_trip_routed_settlement(uuid,jsonb,timestamptz)';end if;
 if has_function_privilege('anon','public.preview_trip_routed_settlement(uuid,jsonb,timestamptz)','EXECUTE')or has_function_privilege('authenticated','public.preview_trip_routed_settlement(uuid,jsonb,timestamptz)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_view(uuid)'))is distinct from '373441c8dba18449f3d787aa56c6bf60'then raise exception 'Unexpected pre-contra function: private.routed_view(uuid)';end if;
 if has_function_privilege('anon','private.routed_view(uuid)','EXECUTE')or has_function_privilege('authenticated','private.routed_view(uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.submit_trip_routed_settlement(uuid,jsonb,uuid,text,timestamptz)'))is distinct from '056d16695ddee941aaec7dbc24e2a497'then raise exception 'Unexpected pre-contra function: public.submit_trip_routed_settlement(uuid,jsonb,uuid,text,timestamptz)';end if;
 if has_function_privilege('anon','public.submit_trip_routed_settlement(uuid,jsonb,uuid,text,timestamptz)','EXECUTE')or has_function_privilege('authenticated','public.submit_trip_routed_settlement(uuid,jsonb,uuid,text,timestamptz)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.post_routed_proposal(uuid)'))is distinct from '3c785437476ffea723f0ffcd5a983cc8'then raise exception 'Unexpected pre-contra function: private.post_routed_proposal(uuid)';end if;
 if has_function_privilege('anon','private.post_routed_proposal(uuid)','EXECUTE')or has_function_privilege('authenticated','private.post_routed_proposal(uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.decide_trip_routed_settlement(uuid,text,integer,jsonb)'))is distinct from '41cb2c9ea17ad1dd919a1a4900b771f6'then raise exception 'Unexpected pre-contra function: public.decide_trip_routed_settlement(uuid,text,integer,jsonb)';end if;
 if has_function_privilege('anon','public.decide_trip_routed_settlement(uuid,text,integer,jsonb)','EXECUTE')or has_function_privilege('authenticated','public.decide_trip_routed_settlement(uuid,text,integer,jsonb)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.read_trip_routed_settlements(uuid,uuid,uuid)'))is distinct from '67095cc62a65bf5234a74cc29847f438'then raise exception 'Unexpected pre-contra function: public.read_trip_routed_settlements(uuid,uuid,uuid)';end if;
 if has_function_privilege('anon','public.read_trip_routed_settlements(uuid,uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','public.read_trip_routed_settlements(uuid,uuid,uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.reverse_trip_routed_settlement(uuid,uuid,integer)'))is distinct from '3793f49aa0cb782733e5c46130cbe79f'then raise exception 'Unexpected pre-contra function: public.reverse_trip_routed_settlement(uuid,uuid,integer)';end if;
 if has_function_privilege('anon','public.reverse_trip_routed_settlement(uuid,uuid,integer)','EXECUTE')or has_function_privilege('authenticated','public.reverse_trip_routed_settlement(uuid,uuid,integer)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_can_record(uuid,uuid)'))is distinct from '70c3cfc0160376f27d0fff51465c7de6'then raise exception 'Unexpected pre-contra function: private.creator_can_record(uuid,uuid)';end if;
 if has_function_privilege('anon','private.creator_can_record(uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','private.creator_can_record(uuid,uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_policy(uuid)'))is distinct from '192682ee6c742fdf74603f9d108f0393'then raise exception 'Unexpected pre-contra function: private.creator_policy(uuid)';end if;
 if has_function_privilege('anon','private.creator_policy(uuid)','EXECUTE')or has_function_privilege('authenticated','private.creator_policy(uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_invalidate_grants()'))is distinct from 'f3b2d1b35bb18f588b3163a953f51351'then raise exception 'Unexpected pre-contra function: private.creator_invalidate_grants()';end if;
 if has_function_privilege('anon','private.creator_invalidate_grants()','EXECUTE')or has_function_privilege('authenticated','private.creator_invalidate_grants()','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_build_core(uuid,uuid,jsonb,boolean)'))is distinct from 'c5e81af8cff1dfa49f7b90bea61286e8'then raise exception 'Unexpected pre-contra function: private.routed_build_core(uuid,uuid,jsonb,boolean)';end if;
 if has_function_privilege('anon','private.routed_build_core(uuid,uuid,jsonb,boolean)','EXECUTE')or has_function_privilege('authenticated','private.routed_build_core(uuid,uuid,jsonb,boolean)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.get_trip_creator_context(uuid)'))is distinct from '81fb31cba28501d68ebd035c09d4ea8c'then raise exception 'Unexpected pre-contra function: public.get_trip_creator_context(uuid)';end if;
 if has_function_privilege('anon','public.get_trip_creator_context(uuid)','EXECUTE')or has_function_privilege('authenticated','public.get_trip_creator_context(uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.set_trip_creator_delegate(uuid,uuid,boolean,uuid,text)'))is distinct from '3cd128bd02300eb02c3806fcd0da49b4'then raise exception 'Unexpected pre-contra function: public.set_trip_creator_delegate(uuid,uuid,boolean,uuid,text)';end if;
 if has_function_privilege('anon','public.set_trip_creator_delegate(uuid,uuid,boolean,uuid,text)','EXECUTE')or has_function_privilege('authenticated','public.set_trip_creator_delegate(uuid,uuid,boolean,uuid,text)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_normalize(jsonb)'))is distinct from 'e8034879e697369f926dd8382a7d1e36'then raise exception 'Unexpected pre-contra function: private.creator_normalize(jsonb)';end if;
 if has_function_privilege('anon','private.creator_normalize(jsonb)','EXECUTE')or has_function_privilege('authenticated','private.creator_normalize(jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_review(uuid,uuid,jsonb,timestamptz)'))is distinct from '78941a991ae940ea799a2607c37c0db2'then raise exception 'Unexpected pre-contra function: private.creator_review(uuid,uuid,jsonb,timestamptz)';end if;
 if has_function_privilege('anon','private.creator_review(uuid,uuid,jsonb,timestamptz)','EXECUTE')or has_function_privilege('authenticated','private.creator_review(uuid,uuid,jsonb,timestamptz)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.preview_trip_creator_settlement(uuid,jsonb)'))is distinct from 'cf4a8327dd8b68ff745bbc0bb19889c2'then raise exception 'Unexpected pre-contra function: public.preview_trip_creator_settlement(uuid,jsonb)';end if;
 if has_function_privilege('anon','public.preview_trip_creator_settlement(uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','public.preview_trip_creator_settlement(uuid,jsonb)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_can_read(uuid,uuid)'))is distinct from '1988d36d5dcdc102bfd6d9bc6424d481'then raise exception 'Unexpected pre-contra function: private.creator_can_read(uuid,uuid)';end if;
 if has_function_privilege('anon','private.creator_can_read(uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','private.creator_can_read(uuid,uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_view(uuid,uuid)'))is distinct from '5d31d355d82db8ce6b2fbe243a53ed38'then raise exception 'Unexpected pre-contra function: private.creator_view(uuid,uuid)';end if;
 if has_function_privilege('anon','private.creator_view(uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','private.creator_view(uuid,uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.read_trip_creator_settlements(uuid,uuid,uuid)'))is distinct from 'da99c06f5eedf326b9783701df4887db'then raise exception 'Unexpected pre-contra function: public.read_trip_creator_settlements(uuid,uuid,uuid)';end if;
 if has_function_privilege('anon','public.read_trip_creator_settlements(uuid,uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','public.read_trip_creator_settlements(uuid,uuid,uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_link_cash(uuid,text,uuid,uuid)'))is distinct from '057cd54a1892787514e1200aa4cc9b63'then raise exception 'Unexpected pre-contra function: private.creator_link_cash(uuid,text,uuid,uuid)';end if;
 if has_function_privilege('anon','private.creator_link_cash(uuid,text,uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','private.creator_link_cash(uuid,text,uuid,uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_post(uuid)'))is distinct from '5fbbd7d54629c722f2d7935179deec1e'then raise exception 'Unexpected pre-contra function: private.creator_post(uuid)';end if;
 if has_function_privilege('anon','private.creator_post(uuid)','EXECUTE')or has_function_privilege('authenticated','private.creator_post(uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_notify(uuid,text,uuid,text,uuid)'))is distinct from 'fcba22dc9e443aeebe36fcdd49d9543d'then raise exception 'Unexpected pre-contra function: private.creator_notify(uuid,text,uuid,text,uuid)';end if;
 if has_function_privilege('anon','private.creator_notify(uuid,text,uuid,text,uuid)','EXECUTE')or has_function_privilege('authenticated','private.creator_notify(uuid,text,uuid,text,uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.record_trip_creator_settlement(uuid,jsonb,uuid,text,timestamptz,boolean)'))is distinct from '344e9b8b2edc7109164763f7fc306519'then raise exception 'Unexpected pre-contra function: public.record_trip_creator_settlement(uuid,jsonb,uuid,text,timestamptz,boolean)';end if;
 if has_function_privilege('anon','public.record_trip_creator_settlement(uuid,jsonb,uuid,text,timestamptz,boolean)','EXECUTE')or has_function_privilege('authenticated','public.record_trip_creator_settlement(uuid,jsonb,uuid,text,timestamptz,boolean)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.link_trip_creator_account(uuid,text,uuid,uuid,integer)'))is distinct from '31f133cd92bf781480c6736a77890b43'then raise exception 'Unexpected pre-contra function: public.link_trip_creator_account(uuid,text,uuid,uuid,integer)';end if;
 if has_function_privilege('anon','public.link_trip_creator_account(uuid,text,uuid,uuid,integer)','EXECUTE')or has_function_privilege('authenticated','public.link_trip_creator_account(uuid,text,uuid,uuid,integer)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.request_trip_creator_correction(uuid,uuid,text)'))is distinct from '437fa552a830dd269681efa27f14b7e9'then raise exception 'Unexpected pre-contra function: public.request_trip_creator_correction(uuid,uuid,text)';end if;
 if has_function_privilege('anon','public.request_trip_creator_correction(uuid,uuid,text)','EXECUTE')or has_function_privilege('authenticated','public.request_trip_creator_correction(uuid,uuid,text)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.resolve_trip_creator_correction(uuid,uuid,integer,text,uuid)'))is distinct from 'b3067ae790c3ee90846134ddfbf8214e'then raise exception 'Unexpected pre-contra function: public.resolve_trip_creator_correction(uuid,uuid,integer,text,uuid)';end if;
 if has_function_privilege('anon','public.resolve_trip_creator_correction(uuid,uuid,integer,text,uuid)','EXECUTE')or has_function_privilege('authenticated','public.resolve_trip_creator_correction(uuid,uuid,integer,text,uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.reverse_trip_creator_settlement(uuid,uuid,integer,text)'))is distinct from '4ed00031ecbdd343aefb451147078f74'then raise exception 'Unexpected pre-contra function: public.reverse_trip_creator_settlement(uuid,uuid,integer,text)';end if;
 if has_function_privilege('anon','public.reverse_trip_creator_settlement(uuid,uuid,integer,text)','EXECUTE')or has_function_privilege('authenticated','public.reverse_trip_creator_settlement(uuid,uuid,integer,text)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.deliver_creator_notices(uuid,integer)'))is distinct from 'e17d9be5f189efc186a4290ed51222ce'then raise exception 'Unexpected pre-contra function: private.deliver_creator_notices(uuid,integer)';end if;
 if has_function_privilege('anon','private.deliver_creator_notices(uuid,integer)','EXECUTE')or has_function_privilege('authenticated','private.deliver_creator_notices(uuid,integer)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.can_read_creator_settlement_notice(uuid)'))is distinct from 'bf01da7e411a566fb06135ba55dbf085'then raise exception 'Unexpected pre-contra function: public.can_read_creator_settlement_notice(uuid)';end if;
 if has_function_privilege('anon','public.can_read_creator_settlement_notice(uuid)','EXECUTE')or has_function_privilege('authenticated','public.can_read_creator_settlement_notice(uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.get_creator_settlement_notifications(uuid)'))is distinct from '8bb456cf6bd621443b5273524b3889ee'then raise exception 'Unexpected pre-contra function: public.get_creator_settlement_notifications(uuid)';end if;
 if has_function_privilege('anon','public.get_creator_settlement_notifications(uuid)','EXECUTE')or has_function_privilege('authenticated','public.get_creator_settlement_notifications(uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.space_signed_outstanding(uuid,uuid,uuid,text)'))is distinct from '6951d609cc188609862ab2570a9b9f8f'then raise exception 'Unexpected pre-contra function: private.space_signed_outstanding(uuid,uuid,uuid,text)';end if;
 if has_function_privilege('anon','private.space_signed_outstanding(uuid,uuid,uuid,text)','EXECUTE')or has_function_privilege('authenticated','private.space_signed_outstanding(uuid,uuid,uuid,text)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 -- Canonical SHA256 15406177affffba1fec93bcf270866fa9444d447421f4957f97019ffee95335d
 migration_sql:=convert_from(decode($contra_payload$
LS0gRm9yd2FyZCBUcmlwIGNvbnRyYSByZWFkIG1vZGVsIGFuZCBleHBsaWNpdC1uZXQgbmF0aXZlIGNvdmVyYWdlLiBObyBoaXN0
b3J5IHJld3JpdGUuCmJlZ2luOwoKCi0tIFNhbWUgY2Fub25pY2FsIG5hdGl2ZSBxdWVyeTsgbGVhdmUgdGhlIGxlZ2FjeSBmdW5j
dGlvbiBhbmQgaXRzIHZvbGF0aWxpdHkgdW50b3VjaGVkLgpDUkVBVEUgT1IgUkVQTEFDRSBGVU5DVElPTiBwcml2YXRlLmNvbnRy
YV9zaWduZWRfb3V0c3RhbmRpbmcodGFyZ2V0X3NwYWNlX2lkIHV1aWQsIGZpcnN0X3BhcnRpY2lwYW50X2lkIHV1aWQsIHNlY29u
ZF9wYXJ0aWNpcGFudF9pZCB1dWlkLCBjdXJyZW5jeV9jb2RlIHRleHQpCiBSRVRVUk5TIGJpZ2ludAogTEFOR1VBR0UgcGxwZ3Nx
bCBTVEFCTEUKIFNFQ1VSSVRZIERFRklORVIKIFNFVCBzZWFyY2hfcGF0aCBUTyAnJwpBUyAkJApkZWNsYXJlIHJlc3VsdF9taW5v
ciBudW1lcmljOwpiZWdpbgogIHdpdGggcG9zaXRpb25zIGFzICgKICAgIHNlbGVjdCBwYXJ0aWNpcGF0aW9uLmV4cGVuc2VfaWQs
IHBhcnRpY2lwYXRpb24ucGFydGljaXBhbnRfaWQsCiAgICAgIHBhcnRpY2lwYXRpb24ucGFydGljaXBhbnRfb3JkZXIsCiAgICAg
IGNvYWxlc2NlKGNvbnRyaWJ1dGlvbi5hbW91bnRfbWlub3IsIDApIC0gc2hhcmUuYW1vdW50X21pbm9yIGFzIG5ldF9taW5vcgog
ICAgZnJvbSBwdWJsaWMuZXhwZW5zZXMgYXMgZXhwZW5zZQogICAgam9pbiBwdWJsaWMuZXhwZW5zZV9wYXJ0aWNpcGF0aW9ucyBh
cyBwYXJ0aWNpcGF0aW9uIG9uIHBhcnRpY2lwYXRpb24uZXhwZW5zZV9pZCA9IGV4cGVuc2UuaWQKICAgIGpvaW4gcHVibGljLmV4
cGVuc2Vfc2hhcmVzIGFzIHNoYXJlIG9uIHNoYXJlLmV4cGVuc2VfcGFydGljaXBhdGlvbl9pZCA9IHBhcnRpY2lwYXRpb24uaWQK
ICAgIGxlZnQgam9pbiBwdWJsaWMucGF5ZXJfY29udHJpYnV0aW9ucyBhcyBjb250cmlidXRpb24gb24gY29udHJpYnV0aW9uLmV4
cGVuc2VfcGFydGljaXBhdGlvbl9pZCA9IHBhcnRpY2lwYXRpb24uaWQKICAgIHdoZXJlIGV4cGVuc2Uuc2NvcGUgPSAnc3BhY2Un
IGFuZCBleHBlbnNlLnNwYWNlX2lkID0gdGFyZ2V0X3NwYWNlX2lkCiAgICAgIGFuZCBleHBlbnNlLnN0YXR1cyA9ICdhY3RpdmUn
IGFuZCBleHBlbnNlLmN1cnJlbmN5ID0gcGdfY2F0YWxvZy51cHBlcihjdXJyZW5jeV9jb2RlKQogICAgLS0gU3BhY2UgcGFpcmlu
ZyBpbmNsdWRlcyBhbGwgcGFydGljaXBhdGlvbnMsIHVubGlrZSBEaXJlY3QgYWNjZXB0ZWQvdHJhY2tlZC4KICApLCBkZWJ0b3Jz
IGFzICgKICAgIHNlbGVjdCAqLCBjb2FsZXNjZShwZ19jYXRhbG9nLnN1bSgtbmV0X21pbm9yKSBvdmVyICgKICAgICAgcGFydGl0
aW9uIGJ5IGV4cGVuc2VfaWQgb3JkZXIgYnkgcGFydGljaXBhbnRfb3JkZXIsIHBhcnRpY2lwYW50X2lkCiAgICAgIHJvd3MgYmV0
d2VlbiB1bmJvdW5kZWQgcHJlY2VkaW5nIGFuZCAxIHByZWNlZGluZwogICAgKSwgMCkgYXMgc3RhcnRfbWlub3IsIHBnX2NhdGFs
b2cuc3VtKC1uZXRfbWlub3IpIG92ZXIgKAogICAgICBwYXJ0aXRpb24gYnkgZXhwZW5zZV9pZCBvcmRlciBieSBwYXJ0aWNpcGFu
dF9vcmRlciwgcGFydGljaXBhbnRfaWQKICAgICAgcm93cyBiZXR3ZWVuIHVuYm91bmRlZCBwcmVjZWRpbmcgYW5kIGN1cnJlbnQg
cm93CiAgICApIGFzIGVuZF9taW5vciBmcm9tIHBvc2l0aW9ucyB3aGVyZSBuZXRfbWlub3IgPCAwCiAgKSwgY3JlZGl0b3JzIGFz
ICgKICAgIHNlbGVjdCAqLCBjb2FsZXNjZShwZ19jYXRhbG9nLnN1bShuZXRfbWlub3IpIG92ZXIgKAogICAgICBwYXJ0aXRpb24g
YnkgZXhwZW5zZV9pZCBvcmRlciBieSBwYXJ0aWNpcGFudF9vcmRlciwgcGFydGljaXBhbnRfaWQKICAgICAgcm93cyBiZXR3ZWVu
IHVuYm91bmRlZCBwcmVjZWRpbmcgYW5kIDEgcHJlY2VkaW5nCiAgICApLCAwKSBhcyBzdGFydF9taW5vciwgcGdfY2F0YWxvZy5z
dW0obmV0X21pbm9yKSBvdmVyICgKICAgICAgcGFydGl0aW9uIGJ5IGV4cGVuc2VfaWQgb3JkZXIgYnkgcGFydGljaXBhbnRfb3Jk
ZXIsIHBhcnRpY2lwYW50X2lkCiAgICAgIHJvd3MgYmV0d2VlbiB1bmJvdW5kZWQgcHJlY2VkaW5nIGFuZCBjdXJyZW50IHJvdwog
ICAgKSBhcyBlbmRfbWlub3IgZnJvbSBwb3NpdGlvbnMgd2hlcmUgbmV0X21pbm9yID4gMAogICksIGV4cGVuc2VfZWZmZWN0IGFz
ICgKICAgIHNlbGVjdCBjb2FsZXNjZShwZ19jYXRhbG9nLnN1bSgKICAgICAgKGNhc2Ugd2hlbiBkZWJ0b3IucGFydGljaXBhbnRf
aWQgPSBmaXJzdF9wYXJ0aWNpcGFudF9pZCB0aGVuIDEgZWxzZSAtMSBlbmQpCiAgICAgICogcHJpdmF0ZS5zaGFyZWRfcmVzdGFy
dF9hbW91bnQoZGVidG9yLmV4cGVuc2VfaWQsZGVidG9yLnBhcnRpY2lwYW50X2lkLGNyZWRpdG9yLnBhcnRpY2lwYW50X2lkLAog
ICAgICAgIGdyZWF0ZXN0KDAsbGVhc3QoZGVidG9yLmVuZF9taW5vcixjcmVkaXRvci5lbmRfbWlub3IpLWdyZWF0ZXN0KGRlYnRv
ci5zdGFydF9taW5vcixjcmVkaXRvci5zdGFydF9taW5vcikpOjpiaWdpbnQpCiAgICApLCAwKSBhcyBhbW91bnRfbWlub3IKICAg
IGZyb20gZGVidG9ycyBhcyBkZWJ0b3Igam9pbiBjcmVkaXRvcnMgYXMgY3JlZGl0b3IgdXNpbmcgKGV4cGVuc2VfaWQpCiAgICB3
aGVyZSAoZGVidG9yLnBhcnRpY2lwYW50X2lkID0gZmlyc3RfcGFydGljaXBhbnRfaWQgYW5kIGNyZWRpdG9yLnBhcnRpY2lwYW50
X2lkID0gc2Vjb25kX3BhcnRpY2lwYW50X2lkKQogICAgICAgb3IgKGRlYnRvci5wYXJ0aWNpcGFudF9pZCA9IHNlY29uZF9wYXJ0
aWNpcGFudF9pZCBhbmQgY3JlZGl0b3IucGFydGljaXBhbnRfaWQgPSBmaXJzdF9wYXJ0aWNpcGFudF9pZCkKICApLCByZXZlcnNh
bHMgYXMgKAogICAgc2VsZWN0IHNldHRsZW1lbnRfYWxsb2NhdGlvbl9pZCwgcGdfY2F0YWxvZy5zdW0oYW1vdW50X21pbm9yKSBh
cyBhbW91bnRfbWlub3IKICAgIGZyb20gcHVibGljLnNldHRsZW1lbnRfYWxsb2NhdGlvbl9yZXZlcnNhbHMgZ3JvdXAgYnkgc2V0
dGxlbWVudF9hbGxvY2F0aW9uX2lkCiAgKSwgdHJhbnNmZXJfZWZmZWN0IGFzICgKICAgIHNlbGVjdCBjb2FsZXNjZShwZ19jYXRh
bG9nLnN1bSgKICAgICAgKGNhc2Ugd2hlbiBwYXltZW50LmRlYnRvcl9wYXJ0aWNpcGFudF9pZCA9IGZpcnN0X3BhcnRpY2lwYW50
X2lkIHRoZW4gLTEgZWxzZSAxIGVuZCkKICAgICAgKiAoY2FzZSB3aGVuIGFsbG9jYXRpb24uc3RhdGUgPSAncmV2ZXJzZWQnIHRo
ZW4gMAogICAgICAgICBlbHNlIGFsbG9jYXRpb24uYW1vdW50X21pbm9yIC0gY29hbGVzY2UocmV2ZXJzYWwuYW1vdW50X21pbm9y
LCAwKSBlbmQpCiAgICApLCAwKSBhcyBhbW91bnRfbWlub3IKICAgIGZyb20gcHVibGljLnNldHRsZW1lbnRfcGF5bWVudHMgYXMg
cGF5bWVudAogICAgam9pbiBwdWJsaWMuc2V0dGxlbWVudF9hbGxvY2F0aW9ucyBhcyBhbGxvY2F0aW9uIG9uIGFsbG9jYXRpb24u
c2V0dGxlbWVudF9wYXltZW50X2lkID0gcGF5bWVudC5pZAogICAgbGVmdCBqb2luIHJldmVyc2FscyBhcyByZXZlcnNhbCBvbiBy
ZXZlcnNhbC5zZXR0bGVtZW50X2FsbG9jYXRpb25faWQgPSBhbGxvY2F0aW9uLmlkCiAgICB3aGVyZSBwYXltZW50LnNjb3BlID0g
J3NwYWNlJyBhbmQgcGF5bWVudC5zcGFjZV9pZCA9IHRhcmdldF9zcGFjZV9pZAogICAgICBhbmQgcGF5bWVudC5jdXJyZW5jeSA9
IHBnX2NhdGFsb2cudXBwZXIoY3VycmVuY3lfY29kZSkgYW5kIHBheW1lbnQuZnhfY2FzaF9vbmx5ID0gZmFsc2UKICAgICAgYW5k
IGFsbG9jYXRpb24uc3RhdGUgaW4gKCdhY2NlcHRlZCcsICdyZXZlcnNlZCcpCiAgICAgIGFuZCBub3QgcHJpdmF0ZS5zaGFyZWRf
YWxsb2NhdGlvbl9jbGVhcmVkKGFsbG9jYXRpb24uaWQpCiAgICAgIGFuZCAoKHBheW1lbnQuZGVidG9yX3BhcnRpY2lwYW50X2lk
ID0gZmlyc3RfcGFydGljaXBhbnRfaWQgYW5kIGFsbG9jYXRpb24uY3JlZGl0b3JfcGFydGljaXBhbnRfaWQgPSBzZWNvbmRfcGFy
dGljaXBhbnRfaWQpCiAgICAgICAgb3IgKHBheW1lbnQuZGVidG9yX3BhcnRpY2lwYW50X2lkID0gc2Vjb25kX3BhcnRpY2lwYW50
X2lkIGFuZCBhbGxvY2F0aW9uLmNyZWRpdG9yX3BhcnRpY2lwYW50X2lkID0gZmlyc3RfcGFydGljaXBhbnRfaWQpKQogICkKICBz
ZWxlY3QgZXhwZW5zZV9lZmZlY3QuYW1vdW50X21pbm9yICsgdHJhbnNmZXJfZWZmZWN0LmFtb3VudF9taW5vciBpbnRvIHJlc3Vs
dF9taW5vcgogIGZyb20gZXhwZW5zZV9lZmZlY3QgY3Jvc3Mgam9pbiB0cmFuc2Zlcl9lZmZlY3Q7CiAgaWYgcGdfY2F0YWxvZy5h
YnMocmVzdWx0X21pbm9yKSA+IDkwMDcxOTkyNTQ3NDA5OTEgdGhlbgogICAgcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2Ug
PSAnYW1vdW50X292ZXJmbG93JywgZXJyY29kZSA9ICdQMDAwMSc7CiAgZW5kIGlmOwogIHJldHVybiByZXN1bHRfbWlub3I6OmJp
Z2ludDsKZW5kOwokJDsKCgotLSBBdWRpdGFibGUgb3JpZ2luYWwgZGlyZWN0aW9uczsgcmVhZCBvbmx5LCBleGNsdWRlZCBmcm9t
IGFsbCBjYXNoIGNhbGN1bGF0aW9ucy4KY3JlYXRlIGZ1bmN0aW9uIHByaXZhdGUuY29udHJhX25hdGl2ZV9hdWRpdCh0cmlwIHV1
aWQsYSB1dWlkLGIgdXVpZCkKcmV0dXJucyBqc29uYiBsYW5ndWFnZSBzcWwgc3RhYmxlIHNlY3VyaXR5IGRlZmluZXIgc2V0IHNl
YXJjaF9wYXRoPScnIGFzICQkCiB3aXRoIGNvZGVzIGFzKHNlbGVjdCBkaXN0aW5jdCBjdXJyZW5jeSBmcm9tIHB1YmxpYy5leHBl
bnNlcyB3aGVyZSBzY29wZT0nc3BhY2UnYW5kIHNwYWNlX2lkPXRyaXAgYW5kIHN0YXR1cz0nYWN0aXZlJyksYmlsbHMgYXMoCiBz
ZWxlY3QgYy5jdXJyZW5jeSxjb2FsZXNjZShzdW0ocHJpdmF0ZS5zaGFyZWRfcmVzdGFydF9hbW91bnQoZS5pZCxhLGIscHJpdmF0
ZS5zaGFyZWRfcmF3X2V4cGVuc2Vfb2JsaWdhdGlvbihlLmlkLGEsYikpKSwwKTo6YmlnaW50IGZvcndhcmQsY29hbGVzY2Uoc3Vt
KHByaXZhdGUuc2hhcmVkX3Jlc3RhcnRfYW1vdW50KGUuaWQsYixhLHByaXZhdGUuc2hhcmVkX3Jhd19leHBlbnNlX29ibGlnYXRp
b24oZS5pZCxiLGEpKSksMCk6OmJpZ2ludCByZXZlcnNlIGZyb20gY29kZXMgYyBqb2luIHB1YmxpYy5leHBlbnNlcyBlIG9uIGUu
c2NvcGU9J3NwYWNlJ2FuZCBlLnNwYWNlX2lkPXRyaXAgYW5kIGUuc3RhdHVzPSdhY3RpdmUnYW5kIGUuY3VycmVuY3k9Yy5jdXJy
ZW5jeSBncm91cCBieSBjLmN1cnJlbmN5CiApLHJldmVyc2FscyBhcyhzZWxlY3Qgc2V0dGxlbWVudF9hbGxvY2F0aW9uX2lkLHN1
bShhbW91bnRfbWlub3IpOjpiaWdpbnQgbWlub3IgZnJvbSBwdWJsaWMuc2V0dGxlbWVudF9hbGxvY2F0aW9uX3JldmVyc2FscyBn
cm91cCBieSBzZXR0bGVtZW50X2FsbG9jYXRpb25faWQpLHBhaWQgYXMoCiBzZWxlY3QgcC5jdXJyZW5jeSxjb2FsZXNjZShzdW0o
Y2FzZSB3aGVuIHAuZGVidG9yX3BhcnRpY2lwYW50X2lkPWEgdGhlbiBjYXNlIHdoZW4gbC5zdGF0ZT0ncmV2ZXJzZWQndGhlbiAw
IGVsc2UgbC5hbW91bnRfbWlub3ItY29hbGVzY2Uoci5taW5vciwwKWVuZCBlbHNlIDAgZW5kKSwwKTo6YmlnaW50IGZvcndhcmQs
Y29hbGVzY2Uoc3VtKGNhc2Ugd2hlbiBwLmRlYnRvcl9wYXJ0aWNpcGFudF9pZD1iIHRoZW4gY2FzZSB3aGVuIGwuc3RhdGU9J3Jl
dmVyc2VkJ3RoZW4gMCBlbHNlIGwuYW1vdW50X21pbm9yLWNvYWxlc2NlKHIubWlub3IsMCllbmQgZWxzZSAwIGVuZCksMCk6OmJp
Z2ludCByZXZlcnNlIGZyb20gcHVibGljLnNldHRsZW1lbnRfcGF5bWVudHMgcCBqb2luIHB1YmxpYy5zZXR0bGVtZW50X2FsbG9j
YXRpb25zIGwgb24gbC5zZXR0bGVtZW50X3BheW1lbnRfaWQ9cC5pZCBsZWZ0IGpvaW4gcmV2ZXJzYWxzIHIgb24gci5zZXR0bGVt
ZW50X2FsbG9jYXRpb25faWQ9bC5pZCB3aGVyZSBwLnNjb3BlPSdzcGFjZSdhbmQgcC5zcGFjZV9pZD10cmlwIGFuZCBub3QgcC5m
eF9jYXNoX29ubHkgYW5kIGwuc3RhdGUgaW4oJ2FjY2VwdGVkJywncmV2ZXJzZWQnKWFuZCBub3QgcHJpdmF0ZS5zaGFyZWRfYWxs
b2NhdGlvbl9jbGVhcmVkKGwuaWQpYW5kKChwLmRlYnRvcl9wYXJ0aWNpcGFudF9pZD1hIGFuZCBsLmNyZWRpdG9yX3BhcnRpY2lw
YW50X2lkPWIpb3IocC5kZWJ0b3JfcGFydGljaXBhbnRfaWQ9YiBhbmQgbC5jcmVkaXRvcl9wYXJ0aWNpcGFudF9pZD1hKSlncm91
cCBieSBwLmN1cnJlbmN5CiApc2VsZWN0IGNvYWxlc2NlKGpzb25iX2FnZyhqc29uYl9idWlsZF9vYmplY3QoJ2N1cnJlbmN5Jyxj
LmN1cnJlbmN5LCdhQmlsbHMnLGNvYWxlc2NlKGJpLmZvcndhcmQsMCksJ2JCaWxscycsY29hbGVzY2UoYmkucmV2ZXJzZSwwKSwn
YUFwcGxpZWQnLGNvYWxlc2NlKHAuZm9yd2FyZCwwKSwnYkFwcGxpZWQnLGNvYWxlc2NlKHAucmV2ZXJzZSwwKSlvcmRlciBieSBj
LmN1cnJlbmN5KSwnW10nKWZyb20gY29kZXMgYyBsZWZ0IGpvaW4gYmlsbHMgYmkgdXNpbmcoY3VycmVuY3kpbGVmdCBqb2luIHBh
aWQgcCB1c2luZyhjdXJyZW5jeSkKJCQ7CgoKLS0gQSByZWFkIG1vZGVsIG92ZXIgZXhpc3Rpbmcgb3JpZ2luYWwtY3VycmVuY3kg
ZmFjdHMsIG5ldmVyIGEgc2Vjb25kIGxlZGdlci4KY3JlYXRlIGZ1bmN0aW9uIHByaXZhdGUuY29udHJhX3F1b3RlKG1vZGUgdGV4
dCxjdXN0b21fcmF0ZSB0ZXh0LGRpc3BsYXlfY3VycmVuY3kgdGV4dCkKcmV0dXJucyBqc29uYiBsYW5ndWFnZSBwbHBnc3FsIHN0
YWJsZSBzZWN1cml0eSBkZWZpbmVyIHNldCBzZWFyY2hfcGF0aD0nJyBhcyAkJAojdmFyaWFibGVfY29uZmxpY3QgdXNlX3Zhcmlh
YmxlCmRlY2xhcmUgc25hcHNob3QgdXVpZDtyYXRlcyBqc29uYjtuIG51bWVyaWM7ZCBudW1lcmljOwpiZWdpbgogaWYgbW9kZSBp
cyBudWxsIG9yIG1vZGUgbm90IGluKCdzeXN0ZW0nLCdjdXN0b20nKW9yIHByaXZhdGUuY3VycmVuY3lfZGlnaXRzKGRpc3BsYXlf
Y3VycmVuY3kpaXMgbnVsbCB0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdpbnZhbGlkX3JhdGUnLGVycmNvZGU9
J1AwMDAxJztlbmQgaWY7CiBzZWxlY3Qgcy5pZCxzLnJhdGVzIGludG8gc25hcHNob3QscmF0ZXMgZnJvbSB0YWJieV9meC5yZWZy
ZXNoX3N0YXRlIHIgam9pbiB0YWJieV9meC5zbmFwc2hvdHMgcyBvbiBzLmlkPXIuc25hcHNob3RfaWQgd2hlcmUgci5zaW5nbGV0
b247CiBpZiBtb2RlPSdjdXN0b20ndGhlbgogIGlmIGNvYWxlc2NlKGN1c3RvbV9yYXRlLCcnKSF+J15bMC05XXsxLDEyfShcLlsw
LTldezEsMTJ9KT8kJ29yIGN1c3RvbV9yYXRlOjpudW1lcmljPD0wIHRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9
J2ludmFsaWRfcmF0ZScsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKICBuOj1jdXN0b21fcmF0ZTo6bnVtZXJpYztkOj0xOwogZWxz
ZSBuOj0ocmF0ZXMtPidWTkQnLT4+J2Rlbm9taW5hdG9yJyk6Om51bWVyaWM7ZDo9KHJhdGVzLT4nVk5EJy0+PidudW1lcmF0b3In
KTo6bnVtZXJpYztlbmQgaWY7CiByZXR1cm4ganNvbmJfYnVpbGRfb2JqZWN0KCdtb2RlJyxtb2RlLCdzbmFwc2hvdElkJyxzbmFw
c2hvdCwncmF0ZXMnLGNvYWxlc2NlKHJhdGVzLCd7fSc6Ompzb25iKSwnbnVtZXJhdG9yJyxuOjp0ZXh0LCdkZW5vbWluYXRvcics
ZDo6dGV4dCwnZGlzcGxheUN1cnJlbmN5Jyx1cHBlcihkaXNwbGF5X2N1cnJlbmN5KSk7CmVuZCQkOwpjcmVhdGUgZnVuY3Rpb24g
cHJpdmF0ZS5jb250cmFfZGlzcGxheV92YWx1ZShhbW91bnQgYmlnaW50LGNvZGUgdGV4dCxxdW90ZSBqc29uYikKcmV0dXJucyBi
aWdpbnQgbGFuZ3VhZ2UgcGxwZ3NxbCBpbW11dGFibGUgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCiN2YXJpYWJsZV9jb25mbGlj
dCB1c2VfdmFyaWFibGUKZGVjbGFyZSB0YXJnZXQgdGV4dDo9cXVvdGUtPj4nZGlzcGxheUN1cnJlbmN5JztjbiBudW1lcmljO2Nk
IG51bWVyaWM7dG4gbnVtZXJpYzt0ZCBudW1lcmljOwpiZWdpbgogaWYgYW1vdW50PDAgb3IgYW1vdW50PjkwMDcxOTkyNTQ3NDA5
OTEgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0naW52YWxpZF9hbW91bnQnLGVycmNvZGU9J1AwMDAxJztlbmQg
aWY7CiBpZiBjb2RlPXRhcmdldCB0aGVuIHJldHVybiBhbW91bnQ7ZW5kIGlmOwogY246PWNhc2UgY29kZSB3aGVuJ01ZUid0aGVu
IDEgd2hlbidWTkQndGhlbihxdW90ZS0+PidudW1lcmF0b3InKTo6bnVtZXJpYyBlbHNlKHF1b3RlLT4ncmF0ZXMnLT5jb2RlLT4+
J2Rlbm9taW5hdG9yJyk6Om51bWVyaWMgZW5kOwogY2Q6PWNhc2UgY29kZSB3aGVuJ01ZUid0aGVuIDEgd2hlbidWTkQndGhlbihx
dW90ZS0+PidkZW5vbWluYXRvcicpOjpudW1lcmljIGVsc2UocXVvdGUtPidyYXRlcyctPmNvZGUtPj4nbnVtZXJhdG9yJyk6Om51
bWVyaWMgZW5kOwogdG46PWNhc2UgdGFyZ2V0IHdoZW4nTVlSJ3RoZW4gMSB3aGVuJ1ZORCd0aGVuKHF1b3RlLT4+J251bWVyYXRv
cicpOjpudW1lcmljIGVsc2UocXVvdGUtPidyYXRlcyctPnRhcmdldC0+PidkZW5vbWluYXRvcicpOjpudW1lcmljIGVuZDsKIHRk
Oj1jYXNlIHRhcmdldCB3aGVuJ01ZUid0aGVuIDEgd2hlbidWTkQndGhlbihxdW90ZS0+PidkZW5vbWluYXRvcicpOjpudW1lcmlj
IGVsc2UocXVvdGUtPidyYXRlcyctPnRhcmdldC0+PidudW1lcmF0b3InKTo6bnVtZXJpYyBlbmQ7CiBpZiBjbiBpcyBudWxsIG9y
IGNkIGlzIG51bGwgb3IgdG4gaXMgbnVsbCBvciB0ZCBpcyBudWxsIG9yIGxlYXN0KGNuLGNkLHRuLHRkKTw9MCB0aGVuIHJldHVy
biBudWxsO2VuZCBpZjsKIHJldHVybiBwcml2YXRlLmZ4X3JvdW5kX2RpdihhbW91bnQ6Om51bWVyaWMqKDEwOjpudW1lcmljXnBy
aXZhdGUuY3VycmVuY3lfZGlnaXRzKHRhcmdldCkpKmNkKnRuLCgxMDo6bnVtZXJpY15wcml2YXRlLmN1cnJlbmN5X2RpZ2l0cyhj
b2RlKSkqY24qdGQpOwplbmQkJDsKY3JlYXRlIGZ1bmN0aW9uIHByaXZhdGUuY29udHJhX25hdGl2ZV9wYWlyKG5hdGl2ZSBqc29u
YixhIHV1aWQsYiB1dWlkLHF1b3RlIGpzb25iKQpyZXR1cm5zIGpzb25iIGxhbmd1YWdlIHBscGdzcWwgc3RhYmxlIHNldCBzZWFy
Y2hfcGF0aD0nJyBhcyAkJAojdmFyaWFibGVfY29uZmxpY3QgdXNlX3ZhcmlhYmxlCmRlY2xhcmUgbGVnIGpzb25iO3ggYmlnaW50
O2YgYmlnaW50Oj0nMCc6OmJpZ2ludDtyIGJpZ2ludDo9JzAnOjpiaWdpbnQ7a25vd24gYm9vbGVhbjo9dHJ1ZTtlc3RpbWF0ZWQg
Ym9vbGVhbjo9ZmFsc2U7CmJlZ2luCiBmb3IgbGVnIGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMobmF0aXZl
KXEgbG9vcAogIHg6PXByaXZhdGUuY29udHJhX2Rpc3BsYXlfdmFsdWUoKGxlZy0+PidtaW5vcicpOjpiaWdpbnQsbGVnLT4+J2N1
cnJlbmN5JyxxdW90ZSk7CiAgaWYgeCBpcyBudWxsIHRoZW4ga25vd246PWZhbHNlO2Vsc2UgaWYgbGVnLT4+J2Zyb20nPWE6OnRl
eHQgdGhlbiBmOj1mK3g7ZWxzZSByOj1yK3g7ZW5kIGlmO2VuZCBpZjsKICBlc3RpbWF0ZWQ6PWVzdGltYXRlZCBvciBsZWctPj4n
Y3VycmVuY3knPD5xdW90ZS0+PidkaXNwbGF5Q3VycmVuY3knOwogZW5kIGxvb3A7CiBpZiBncmVhdGVzdChmLHIpPjkwMDcxOTky
NTQ3NDA5OTEgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0naW52YWxpZF9hbW91bnQnLGVycmNvZGU9J1AwMDAx
JztlbmQgaWY7CiByZXR1cm4ganNvbmJfYnVpbGRfb2JqZWN0KCdrbm93bicsa25vd24sJ2N1cnJlbmN5JyxxdW90ZS0+PidkaXNw
bGF5Q3VycmVuY3knLCdlc3RpbWF0ZWQnLGVzdGltYXRlZCwnYU93ZXNCJyxjYXNlIHdoZW4ga25vd24gdGhlbiBmIGVuZCwnYk93
ZXNBJyxjYXNlIHdoZW4ga25vd24gdGhlbiByIGVuZCwnY29udHJhTWlub3InLGNhc2Ugd2hlbiBrbm93biB0aGVuIGxlYXN0KGYs
cillbmQsJ25ldE1pbm9yJyxjYXNlIHdoZW4ga25vd24gdGhlbiBhYnMoZi1yKWVuZCwncGF5ZXInLGNhc2Ugd2hlbiBrbm93biBh
bmQgZjw+ciB0aGVuIGNhc2Ugd2hlbiBmPnIgdGhlbiBhIGVsc2UgYiBlbmQgZW5kLCdyZWNpcGllbnQnLGNhc2Ugd2hlbiBrbm93
biBhbmQgZjw+ciB0aGVuIGNhc2Ugd2hlbiBmPnIgdGhlbiBiIGVsc2UgYSBlbmQgZW5kKTsKZW5kJCQ7CmNyZWF0ZSBmdW5jdGlv
biBwcml2YXRlLmNvbnRyYV9wYWlyKHRyaXAgdXVpZCxhIHV1aWQsYiB1dWlkLHF1b3RlIGpzb25iKQpyZXR1cm5zIGpzb25iIGxh
bmd1YWdlIHBscGdzcWwgc3RhYmxlIHNlY3VyaXR5IGRlZmluZXIgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCiN2YXJpYWJsZV9j
b25mbGljdCB1c2VfdmFyaWFibGUKZGVjbGFyZSBuYXRpdmUganNvbmI6PSdbXSc6Ompzb25iO2F2YWlsYWJsZSBqc29uYjo9J1td
Jzo6anNvbmI7Y29kZSB0ZXh0O3NpZ25lZCBiaWdpbnQ7aG9sZCBiaWdpbnQ7cmVhZHkgYm9vbGVhbjo9dHJ1ZTtoZWxkIGJvb2xl
YW46PWZhbHNlO2xlZyBqc29uYjtsZWRnZXIganNvbmI7YXZhaWxhYmxlX2xlZGdlciBqc29uYjthdWRpdCBqc29uYjtkaXNwbGF5
IGpzb25iO2dyb3NzX2Rpc3BsYXkganNvbmI7CmJlZ2luCiBmb3IgY29kZSBpbiBzZWxlY3QgZGlzdGluY3QgZS5jdXJyZW5jeSBm
cm9tIHB1YmxpYy5leHBlbnNlcyBlIHdoZXJlIGUuc3BhY2VfaWQ9dHJpcCBhbmQgZS5zY29wZT0nc3BhY2UnYW5kIGUuc3RhdHVz
PSdhY3RpdmUnb3JkZXIgYnkgZS5jdXJyZW5jeSBsb29wCiAgc2lnbmVkOj1wcml2YXRlLmNvbnRyYV9zaWduZWRfb3V0c3RhbmRp
bmcodHJpcCxhLGIsY29kZSk7CiAgaWYgc2lnbmVkPD4wIHRoZW4KICAgbGVnOj1qc29uYl9idWlsZF9vYmplY3QoJ2Zyb20nLGNh
c2Ugd2hlbiBzaWduZWQ+MCB0aGVuIGEgZWxzZSBiIGVuZCwndG8nLGNhc2Ugd2hlbiBzaWduZWQ+MCB0aGVuIGIgZWxzZSBhIGVu
ZCwnY3VycmVuY3knLGNvZGUsJ21pbm9yJyxhYnMoc2lnbmVkKSk7bmF0aXZlOj1uYXRpdmV8fGpzb25iX2J1aWxkX2FycmF5KGxl
Zyk7CiAgIGhvbGQ6PXByaXZhdGUucGVuZGluZ19wYWlyX21pbm9yKHRyaXAsKGxlZy0+Pidmcm9tJyk6OnV1aWQsKGxlZy0+Pid0
bycpOjp1dWlkLGNvZGUpO2hlbGQ6PWhlbGQgb3IgaG9sZD4wOwogICBhdmFpbGFibGU6PWF2YWlsYWJsZXx8anNvbmJfYnVpbGRf
YXJyYXkobGVnfHxqc29uYl9idWlsZF9vYmplY3QoJ21pbm9yJyxncmVhdGVzdChhYnMoc2lnbmVkKS1ob2xkLDApKSk7CgogIGVu
ZCBpZjsKIGVuZCBsb29wOwogLS0gQSBwZW5kaW5nIHJlc2VydmF0aW9uIG5ldmVyIGludmVudHMgYSByZXZlcnNlIG9ibGlnYXRp
b24gb3IgY2hhbmdlcyBzdGFuZGluZy4KIHJlYWR5Oj1leGlzdHMoc2VsZWN0IDEgZnJvbSBwdWJsaWMuc3BhY2VfbWVtYmVycyBt
IHdoZXJlIG0uc3BhY2VfaWQ9dHJpcCBhbmQgbS5wYXJ0aWNpcGFudF9pZD1hIGFuZCBtLnJlbW92ZWRfYXQgaXMgbnVsbClhbmQg
ZXhpc3RzKHNlbGVjdCAxIGZyb20gcHVibGljLnNwYWNlX21lbWJlcnMgbSB3aGVyZSBtLnNwYWNlX2lkPXRyaXAgYW5kIG0ucGFy
dGljaXBhbnRfaWQ9YiBhbmQgbS5yZW1vdmVkX2F0IGlzIG51bGwpOwogYXVkaXQ6PXByaXZhdGUuY29udHJhX25hdGl2ZV9hdWRp
dCh0cmlwLGEsYik7ZGlzcGxheTo9cHJpdmF0ZS5jb250cmFfbmF0aXZlX3BhaXIobmF0aXZlLGEsYixxdW90ZSk7Z3Jvc3NfZGlz
cGxheTo9cHJpdmF0ZS5jb250cmFfZ3Jvc3NfZGlzcGxheShhdWRpdCxhLGIscXVvdGUpOwogaWYgbm90IGNvYWxlc2NlKChkaXNw
bGF5LT4+J2tub3duJyk6OmJvb2xlYW4gYW5kKGdyb3NzX2Rpc3BsYXktPj4na25vd24nKTo6Ym9vbGVhbiBhbmQgZGlzcGxheS0+
J25ldE1pbm9yJz1ncm9zc19kaXNwbGF5LT4nbmV0TWlub3InYW5kIGRpc3BsYXktPidwYXllcic9Z3Jvc3NfZGlzcGxheS0+J3Bh
eWVyJyxmYWxzZSl0aGVuIGdyb3NzX2Rpc3BsYXk6PW51bGw7ZW5kIGlmOwogbGVkZ2VyOj1wcml2YXRlLmNvbnRyYV9uYXRpdmVf
cGFpcihuYXRpdmUsYSxiLHF1b3RlfHxqc29uYl9idWlsZF9vYmplY3QoJ2Rpc3BsYXlDdXJyZW5jeScsJ1ZORCcpKTthdmFpbGFi
bGVfbGVkZ2VyOj1wcml2YXRlLmNvbnRyYV9uYXRpdmVfcGFpcihhdmFpbGFibGUsYSxiLHF1b3RlfHxqc29uYl9idWlsZF9vYmpl
Y3QoJ2Rpc3BsYXlDdXJyZW5jeScsJ1ZORCcpKTsKIHJldHVybiBqc29uYl9idWlsZF9vYmplY3QoJ2lkJyxhOjp0ZXh0fHwnOid8
fGI6OnRleHQsJ2EnLGEsJ2InLGIsJ2VkZ2VCYXNpcycsJ25ldCcsJ25hdGl2ZUJhc2lzJywnc2FtZV9jdXJyZW5jeV9uZXQnLCdu
YXRpdmUnLG5hdGl2ZSwnYXZhaWxhYmxlTmF0aXZlJyxhdmFpbGFibGUsJ2Rpc3BsYXknLGRpc3BsYXksJ2dyb3NzRGlzcGxheScs
Z3Jvc3NfZGlzcGxheSwnbGVkZ2VyQ3VycmVuY3knLCdWTkQnLCdsZWRnZXInLGxlZGdlciwnbmV0TWlub3InLGxlZGdlci0+J25l
dE1pbm9yJywncGF5ZXInLGxlZGdlci0+J3BheWVyJywncmVjaXBpZW50JyxsZWRnZXItPidyZWNpcGllbnQnLCdhdmFpbGFibGVN
aW5vcicsY2FzZSB3aGVuIHJlYWR5IGFuZCBub3QgaGVsZCBhbmQobGVkZ2VyLT4+J2tub3duJyk6OmJvb2xlYW4gYW5kKGF2YWls
YWJsZV9sZWRnZXItPj4na25vd24nKTo6Ym9vbGVhbiBhbmQgbGVkZ2VyLT4+J3BheWVyJz1hdmFpbGFibGVfbGVkZ2VyLT4+J3Bh
eWVyJ3RoZW4gbGVhc3QoKGxlZGdlci0+PiduZXRNaW5vcicpOjpiaWdpbnQsKGF2YWlsYWJsZV9sZWRnZXItPj4nbmV0TWlub3In
KTo6YmlnaW50KWVsc2UgMCBlbmQsJ3BlbmRpbmcnLGhlbGQsJ2N1cnJlbnRNZW1iZXJzJyxyZWFkeSwnYXVkaXQnLGF1ZGl0LCdz
b3VyY2VWZXJzaW9ucycscHJpdmF0ZS5meF9wYWlyX2V4cGVuc2VfdmVyc2lvbnModHJpcCxhLGIpKTsKZW5kJCQ7CmNyZWF0ZSBm
dW5jdGlvbiBwcml2YXRlLmNvbnRyYV9tYXRyaXgodHJpcCB1dWlkLHF1b3RlIGpzb25iKQpyZXR1cm5zIGpzb25iIGxhbmd1YWdl
IHBscGdzcWwgc3RhYmxlIHNlY3VyaXR5IGRlZmluZXIgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCiN2YXJpYWJsZV9jb25mbGlj
dCB1c2VfdmFyaWFibGUKZGVjbGFyZSBwYWlycyBqc29uYjo9J1tdJzo6anNvbmI7cGFpciBqc29uYjtyb3cgcmVjb3JkO3Jldmlz
aW9uIHRleHQ7ZmFjdHMganNvbmI7CmJlZ2luCiBmb3Igcm93IGluIHNlbGVjdCBhLnBhcnRpY2lwYW50X2lkIGEsYi5wYXJ0aWNp
cGFudF9pZCBiIGZyb20gcHVibGljLnNwYWNlX21lbWJlcnMgYSBqb2luIHB1YmxpYy5zcGFjZV9tZW1iZXJzIGIgb24gYi5zcGFj
ZV9pZD1hLnNwYWNlX2lkIGFuZCBhLnBhcnRpY2lwYW50X2lkPGIucGFydGljaXBhbnRfaWQgd2hlcmUgYS5zcGFjZV9pZD10cmlw
IG9yZGVyIGJ5IGEucGFydGljaXBhbnRfaWQsYi5wYXJ0aWNpcGFudF9pZCBsb29wCiAgcGFpcjo9cHJpdmF0ZS5jb250cmFfcGFp
cih0cmlwLHJvdy5hLHJvdy5iLHF1b3RlKTtpZiBqc29uYl9hcnJheV9sZW5ndGgocGFpci0+J25hdGl2ZScpPjAgdGhlbiBwYWly
czo9cGFpcnN8fGpzb25iX2J1aWxkX2FycmF5KHBhaXIpO2VuZCBpZjsKIGVuZCBsb29wOwogLS0gRnJlZXplIGFsbCBzaGFyZWQg
ZmluYW5jaWFsIHZlcnNpb25zLCBub3QgdGltZXN0YW1wcyBvciBwcml2YXRlIGFjY291bnRzLgogc2VsZWN0IGpzb25iX2J1aWxk
X29iamVjdCgnZXhwZW5zZXMnLChzZWxlY3QgY29hbGVzY2UoanNvbmJfYWdnKGpzb25iX2J1aWxkX2FycmF5KGUuaWQsZS52ZXJz
aW9uLGUuc3RhdHVzKW9yZGVyIGJ5IGUuaWQpLCdbXScpZnJvbSBwdWJsaWMuZXhwZW5zZXMgZSB3aGVyZSBlLnNjb3BlPSdzcGFj
ZSdhbmQgZS5zcGFjZV9pZD10cmlwKSwncGF5bWVudHMnLChzZWxlY3QgY29hbGVzY2UoanNvbmJfYWdnKGpzb25iX2J1aWxkX2Fy
cmF5KHAuaWQscC52ZXJzaW9uLHAuc3RhdHVzLHAuY3VycmVuY3kscC5hbW91bnRfbWlub3Ipb3JkZXIgYnkgcC5pZCksJ1tdJylm
cm9tIHB1YmxpYy5zZXR0bGVtZW50X3BheW1lbnRzIHAgd2hlcmUgcC5zY29wZT0nc3BhY2UnYW5kIHAuc3BhY2VfaWQ9dHJpcCks
J2FsbG9jYXRpb25zJywoc2VsZWN0IGNvYWxlc2NlKGpzb25iX2FnZyhqc29uYl9idWlsZF9hcnJheShhLmlkLGEuc3RhdGUsYS5h
bW91bnRfbWlub3IsYS5jcmVkaXRvcl9wYXJ0aWNpcGFudF9pZClvcmRlciBieSBhLmlkKSwnW10nKWZyb20gcHVibGljLnNldHRs
ZW1lbnRfYWxsb2NhdGlvbnMgYSBqb2luIHB1YmxpYy5zZXR0bGVtZW50X3BheW1lbnRzIHAgb24gcC5pZD1hLnNldHRsZW1lbnRf
cGF5bWVudF9pZCB3aGVyZSBwLnNjb3BlPSdzcGFjZSdhbmQgcC5zcGFjZV9pZD10cmlwKSwnbWVtYmVycycsKHNlbGVjdCBjb2Fs
ZXNjZShqc29uYl9hZ2coanNvbmJfYnVpbGRfYXJyYXkobS5wYXJ0aWNpcGFudF9pZCxtLnJvbGUsbS5yZW1vdmVkX2F0KW9yZGVy
IGJ5IG0ucGFydGljaXBhbnRfaWQpLCdbXScpZnJvbSBwdWJsaWMuc3BhY2VfbWVtYmVycyBtIHdoZXJlIG0uc3BhY2VfaWQ9dHJp
cCkpaW50byBmYWN0czsKIHJldmlzaW9uOj1lbmNvZGUoZXh0ZW5zaW9ucy5kaWdlc3QoanNvbmJfYnVpbGRfb2JqZWN0KCd0cmlw
Jyx0cmlwLCdxdW90ZScscXVvdGUsJ3BhaXJzJyxwYWlycywnZmFjdHMnLGZhY3RzKTo6dGV4dCwnc2hhMjU2JyksJ2hleCcpOwog
cmV0dXJuIGpzb25iX2J1aWxkX29iamVjdCgndHJpcElkJyx0cmlwLCdyZXZpc2lvbicscmV2aXNpb24sJ2VkZ2VCYXNpcycsJ25l
dCcsJ3F1b3RlJyxxdW90ZSwncGFpcnMnLHBhaXJzKTsKZW5kJCQ7CmNyZWF0ZSBmdW5jdGlvbiBwdWJsaWMucmVhZF90cmlwX2Nv
bnRyYV9zbmFwc2hvdCh0YXJnZXRfc3BhY2VfaWQgdXVpZCxyYXRlX21vZGUgdGV4dCBkZWZhdWx0J3N5c3RlbScsdm5kX3Blcl9t
eXIgdGV4dCBkZWZhdWx0IG51bGwsZGlzcGxheV9jdXJyZW5jeSB0ZXh0IGRlZmF1bHQnTVlSJykKcmV0dXJucyBqc29uYiBsYW5n
dWFnZSBwbHBnc3FsIHN0YWJsZSBzZWN1cml0eSBkZWZpbmVyIHNldCBzZWFyY2hfcGF0aD0nJyBhcyAkJAojdmFyaWFibGVfY29u
ZmxpY3QgdXNlX3ZhcmlhYmxlCmRlY2xhcmUgYWN0b3IgdXVpZDo9cHJpdmF0ZS5yZXF1aXJlX3BlcnNvbmFsX2FjdG9yKCk7cmVz
dWx0IGpzb25iO3dob2xlIGJvb2xlYW47CmJlZ2luCiBpZiBwcml2YXRlLnNwYWNlX3JvbGUodGFyZ2V0X3NwYWNlX2lkLGFjdG9y
KWlzIG51bGwgb3Igbm90IGV4aXN0cyhzZWxlY3QgMSBmcm9tIHB1YmxpYy5zcGFjZXMgcyB3aGVyZSBzLmlkPXRhcmdldF9zcGFj
ZV9pZCBhbmQgcy50eXBlPSd0cmlwJ2FuZCBzLnN0YXR1czw+J3ZvaWRlZCcpdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVz
c2FnZT0nc3BhY2VfbWVtYmVyc2hpcF9yZXF1aXJlZCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKIHJlc3VsdDo9cHJpdmF0ZS5j
b250cmFfbWF0cml4KHRhcmdldF9zcGFjZV9pZCxwcml2YXRlLmNvbnRyYV9xdW90ZShyYXRlX21vZGUsdm5kX3Blcl9teXIsZGlz
cGxheV9jdXJyZW5jeSkpO3dob2xlOj1wcml2YXRlLmNyZWF0b3JfY2FuX3JlY29yZCh0YXJnZXRfc3BhY2VfaWQsYWN0b3IpOwog
aWYgbm90IHdob2xlIHRoZW4gcmVzdWx0Oj1yZXN1bHR8fGpzb25iX2J1aWxkX29iamVjdCgncGFpcnMnLChzZWxlY3QgY29hbGVz
Y2UoanNvbmJfYWdnKHEpLCdbXScpZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhyZXN1bHQtPidwYWlycycpcSB3aGVyZSBhY3Rv
cjo6dGV4dCBpbihxLT4+J2EnLHEtPj4nYicpKSk7ZW5kIGlmOwogcmV0dXJuIHJlc3VsdHx8anNvbmJfYnVpbGRfb2JqZWN0KCd2
aWV3ZXInLGFjdG9yLCdjYW5SZWNvcmQnLHdob2xlKTsKZW5kJCQ7CgoKY3JlYXRlIGZ1bmN0aW9uIHByaXZhdGUuY29udHJhX2dy
b3NzX2Rpc3BsYXkoYXVkaXQganNvbmIsYSB1dWlkLGIgdXVpZCxxdW90ZSBqc29uYikKcmV0dXJucyBqc29uYiBsYW5ndWFnZSBw
bHBnc3FsIHN0YWJsZSBzZXQgc2VhcmNoX3BhdGg9JycgYXMgJCQKI3ZhcmlhYmxlX2NvbmZsaWN0IHVzZV92YXJpYWJsZQpkZWNs
YXJlIHJvdyBqc29uYjtuYXRpdmUganNvbmI6PSdbXSc6Ompzb25iO2YgYmlnaW50O3IgYmlnaW50OwpiZWdpbgogZm9yIHJvdyBp
biBzZWxlY3QgcSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKGF1ZGl0KXEgbG9vcAogIGY6PShyb3ctPj4nYUJpbGxzJyk6OmJp
Z2ludC0ocm93LT4+J2FBcHBsaWVkJyk6OmJpZ2ludDtyOj0ocm93LT4+J2JCaWxscycpOjpiaWdpbnQtKHJvdy0+PidiQXBwbGll
ZCcpOjpiaWdpbnQ7CiAgbmF0aXZlOj1uYXRpdmV8fGpzb25iX2J1aWxkX2FycmF5KGpzb25iX2J1aWxkX29iamVjdCgnZnJvbScs
YSwndG8nLGIsJ2N1cnJlbmN5Jyxyb3ctPj4nY3VycmVuY3knLCdtaW5vcicsZ3JlYXRlc3QoZiwwKStncmVhdGVzdCgtciwwKSks
anNvbmJfYnVpbGRfb2JqZWN0KCdmcm9tJyxiLCd0bycsYSwnY3VycmVuY3knLHJvdy0+PidjdXJyZW5jeScsJ21pbm9yJyxncmVh
dGVzdChyLDApK2dyZWF0ZXN0KC1mLDApKSk7CiBlbmQgbG9vcDtyZXR1cm4gcHJpdmF0ZS5jb250cmFfbmF0aXZlX3BhaXIobmF0
aXZlLGEsYixxdW90ZSk7CmVuZCQkOwoKCi0tIEtlZXAgdGhlIGV4aXN0aW5nIFZORCBxdW90ZSB1bml0IGZvciBuYXRpdmUgcm91
dGVkIGNvdmVyYWdlLiBUaGUgc2hhcmVkCi0tIHNuYXBzaG90IGFsc28gcHJvdmlkZXMgdGhlIG92ZXJ2aWV3J3MgZGlzcGxheSB2
YWx1YXRpb24gYXQgdGhhdCBleGFjdCBxdW90ZS4KY3JlYXRlIGZ1bmN0aW9uIHByaXZhdGUuY29udHJhX25ldF9lZGdlKHRyaXAg
dXVpZCxkZWJ0b3IgdXVpZCxjcmVkaXRvciB1dWlkLG4gbnVtZXJpYyxkIG51bWVyaWMpCnJldHVybnMganNvbmIgbGFuZ3VhZ2Ug
cGxwZ3NxbCBzdGFibGUgc2VjdXJpdHkgZGVmaW5lciBzZXQgc2VhcmNoX3BhdGg9JycgYXMgJCQKI3ZhcmlhYmxlX2NvbmZsaWN0
IHVzZV92YXJpYWJsZQpkZWNsYXJlIHBhaXIganNvbmI7cSBqc29uYjsKYmVnaW4KIHE6PWpzb25iX2J1aWxkX29iamVjdCgnbnVt
ZXJhdG9yJyxuOjp0ZXh0LCdkZW5vbWluYXRvcicsZDo6dGV4dCwnZGlzcGxheUN1cnJlbmN5JywnTVlSJywncmF0ZXMnLCd7fSc6
Ompzb25iKTtwYWlyOj1wcml2YXRlLmNvbnRyYV9wYWlyKHRyaXAsZGVidG9yLGNyZWRpdG9yLHEpOwogcmV0dXJuIGpzb25iX2J1
aWxkX29iamVjdCgnaWQnLGRlYnRvcjo6dGV4dHx8JzonfHxjcmVkaXRvcjo6dGV4dCwnZnJvbScsZGVidG9yLCd0bycsY3JlZGl0
b3IsJ21pbm9yJyxjYXNlIHdoZW4gcGFpci0+PidwYXllcic9ZGVidG9yOjp0ZXh0IHRoZW4gcGFpci0+J2F2YWlsYWJsZU1pbm9y
J2Vsc2UnMCc6Ompzb25iIGVuZCwnbmF0aXZlJyxwYWlyLT4nYXZhaWxhYmxlTmF0aXZlJywnc3RhbmRpbmdOYXRpdmUnLHBhaXIt
PiduYXRpdmUnLCdleHBlbnNlcycscGFpci0+J3NvdXJjZVZlcnNpb25zJyk7CmVuZCQkOwpjcmVhdGUgZnVuY3Rpb24gcHJpdmF0
ZS5jb250cmFfcmVzb2x2ZV9uYXRpdmUoZWRnZSBqc29uYixhbW91bnQgYmlnaW50LG4gbnVtZXJpYyxkIG51bWVyaWMpCnJldHVy
bnMganNvbmIgbGFuZ3VhZ2UgcGxwZ3NxbCBzdGFibGUgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCiN2YXJpYWJsZV9jb25mbGlj
dCB1c2VfdmFyaWFibGUKZGVjbGFyZSBsZWcganNvbmI7d29yayBqc29uYjo9J1tdJzo6anNvbmI7b3V0IGpzb25iOj0nW10nOjpq
c29uYjt1cGRhdGVkIGpzb25iO29yaWdpbmFsIGJpZ2ludDtjb3ZlcmVkIGJpZ2ludDtyZW1haW5pbmcgYmlnaW50O2JlZm9yZV92
YWx1ZSBiaWdpbnQ7YWZ0ZXJfdmFsdWUgYmlnaW50O2RlbHRhIGJpZ2ludDtuZXRfZGVsdGEgYmlnaW50Oj0nMCc6OmJpZ2ludDtk
aWZmZXJlbmNlIGJpZ2ludDt3YW50ZWQgYmlnaW50O2xvIGJpZ2ludDtoaSBiaWdpbnQ7c2lnbnVtIGludDtvcHBvc2l0ZSBiaWdp
bnQ6PScwJzo6YmlnaW50O2NvbnRyYSBiaWdpbnQ7CmJlZ2luCiBpZiBhbW91bnQ8MCBvciBhbW91bnQ+KGVkZ2UtPj4nbWlub3In
KTo6YmlnaW50IHRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2ludmFsaWRfcm91dGVkX2Ftb3VudCcsZXJyY29k
ZT0nUDAwMDEnO2VuZCBpZjsKIGlmIGFtb3VudD0wIHRoZW4gcmV0dXJuJ1tdJzo6anNvbmI7ZW5kIGlmOwogZm9yIGxlZyBpbiBz
ZWxlY3QgcSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKGVkZ2UtPiduYXRpdmUnKXEgb3JkZXIgYnkgcS0+PidjdXJyZW5jeScs
cS0+Pidmcm9tJ2xvb3AKICBvcmlnaW5hbDo9KGxlZy0+PidtaW5vcicpOjpiaWdpbnQ7CiAgY292ZXJlZDo9Y2FzZSB3aGVuIGFt
b3VudD0oZWRnZS0+PidtaW5vcicpOjpiaWdpbnQgdGhlbiBvcmlnaW5hbCBlbHNlIGxlYXN0KG9yaWdpbmFsLHByaXZhdGUuZnhf
cm91bmRfZGl2KG9yaWdpbmFsOjpudW1lcmljKmFtb3VudCwoZWRnZS0+PidtaW5vcicpOjpudW1lcmljKSllbmQ7CiAgYmVmb3Jl
X3ZhbHVlOj1wcml2YXRlLnJvdXRlZF92YWx1ZShvcmlnaW5hbCxsZWctPj4nY3VycmVuY3knLG4sZCk7YWZ0ZXJfdmFsdWU6PXBy
aXZhdGUucm91dGVkX3ZhbHVlKG9yaWdpbmFsLWNvdmVyZWQsbGVnLT4+J2N1cnJlbmN5JyxuLGQpO2RlbHRhOj1iZWZvcmVfdmFs
dWUtYWZ0ZXJfdmFsdWU7CiAgc2lnbnVtOj1jYXNlIHdoZW4gbGVnLT4+J2Zyb20nPWVkZ2UtPj4nZnJvbSd0aGVuIDEgZWxzZS0x
IGVuZDtuZXRfZGVsdGE6PW5ldF9kZWx0YStzaWdudW0qZGVsdGE7CiAgd29yazo9d29ya3x8anNvbmJfYnVpbGRfYXJyYXkobGVn
fHxqc29uYl9idWlsZF9vYmplY3QoJ29yaWdpbmFsJyxvcmlnaW5hbCwnbWlub3InLGNvdmVyZWQsJ2JlZm9yZScsYmVmb3JlX3Zh
bHVlLCdkZWx0YScsZGVsdGEsJ3NpZ251bScsc2lnbnVtKSk7CiBlbmQgbG9vcDsKIC0tIFF1YW50aXplIGFnYWluc3QgYmVmb3Jl
L2FmdGVyIGF1dGhvcml0YXRpdmUgYmFsYW5jZXMsIG5vdCBhIHNpbGVudCB0b2xlcmFuY2UuCiAtLSBBIHNpbmdsZSBuYXRpdmUg
cXVhbnR1bSBpcyBzZWxlY3RlZCBvbmx5IHdoZW4gaXQgZXhwbGFpbnMgdGhlIGV4YWN0IG5hdGl2ZSBxdW90ZSBkZWx0YS4KIGRp
ZmZlcmVuY2U6PWFtb3VudC1uZXRfZGVsdGE7CiBmb3IgbGVnIGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMo
d29yaylxIG9yZGVyIGJ5IGNhc2Ugd2hlbiBxLT4+J2N1cnJlbmN5Jz0nVk5EJ3RoZW4gMCBlbHNlIDEgZW5kLHEtPj4nZnJvbSds
b29wCiAgZXhpdCB3aGVuIGRpZmZlcmVuY2U9MDtzaWdudW06PShsZWctPj4nc2lnbnVtJyk6OmludDtvcmlnaW5hbDo9KGxlZy0+
PidvcmlnaW5hbCcpOjpiaWdpbnQ7cmVtYWluaW5nOj1vcmlnaW5hbC0obGVnLT4+J21pbm9yJyk6OmJpZ2ludDsKICB3YW50ZWQ6
PShsZWctPj4nYmVmb3JlJyk6OmJpZ2ludC0oKGxlZy0+PidkZWx0YScpOjpiaWdpbnQrc2lnbnVtKmRpZmZlcmVuY2UpOwogIGlm
IHdhbnRlZDwwIHRoZW4gY29udGludWU7ZW5kIGlmOwogIGlmIGxlZy0+PidjdXJyZW5jeSc9J1ZORCd0aGVuIGxvOj13YW50ZWQ7
aGk6PXdhbnRlZDsKICBlbHNlIGxvOj1ncmVhdGVzdCgwLGNlaWwoKHdhbnRlZDo6bnVtZXJpYy0wLjUpKjEwMCpkL24pOjpiaWdp
bnQpO2hpOj1jZWlsKCh3YW50ZWQ6Om51bWVyaWMrMC41KSoxMDAqZC9uKTo6YmlnaW50LTE7ZW5kIGlmOwogIGxvOj1ncmVhdGVz
dChsbywwKTtoaTo9bGVhc3QoaGksb3JpZ2luYWwpO2lmIGxvPmhpIHRoZW4gY29udGludWU7ZW5kIGlmOwogIHJlbWFpbmluZzo9
bGVhc3QoZ3JlYXRlc3QocmVtYWluaW5nLGxvKSxoaSk7aWYgcHJpdmF0ZS5yb3V0ZWRfdmFsdWUocmVtYWluaW5nLGxlZy0+Pidj
dXJyZW5jeScsbixkKTw+d2FudGVkIHRoZW4gY29udGludWU7ZW5kIGlmOwogIGRlbHRhOj0obGVnLT4+J2JlZm9yZScpOjpiaWdp
bnQtd2FudGVkO3VwZGF0ZWQ6PWxlZ3x8anNvbmJfYnVpbGRfb2JqZWN0KCdtaW5vcicsb3JpZ2luYWwtcmVtYWluaW5nLCdkZWx0
YScsZGVsdGEpOwogIHNlbGVjdCBqc29uYl9hZ2coY2FzZSB3aGVuIHEtPj4nZnJvbSc9bGVnLT4+J2Zyb20nYW5kIHEtPj4nY3Vy
cmVuY3knPWxlZy0+PidjdXJyZW5jeSd0aGVuIHVwZGF0ZWQgZWxzZSBxIGVuZCBvcmRlciBieSBxLT4+J2N1cnJlbmN5JyxxLT4+
J2Zyb20nKWludG8gd29yayBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKHdvcmspcTsKICBuZXRfZGVsdGE6PW5ldF9kZWx0YStz
aWdudW0qKGRlbHRhLShsZWctPj4nZGVsdGEnKTo6YmlnaW50KTtkaWZmZXJlbmNlOj1hbW91bnQtbmV0X2RlbHRhOwogZW5kIGxv
b3A7CiBpZiBkaWZmZXJlbmNlPD4wIHRoZW4gcmV0dXJuIG51bGw7ZW5kIGlmOwogc2VsZWN0IGNvYWxlc2NlKHN1bSgocS0+Pidk
ZWx0YScpOjpiaWdpbnQpLDApOjpiaWdpbnQgaW50byBvcHBvc2l0ZSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKHdvcmspcSB3
aGVyZShxLT4+J3NpZ251bScpOjppbnQ8MDsKIGZvciBsZWcgaW4gc2VsZWN0IHEgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyh3
b3JrKXEgb3JkZXIgYnkgcS0+PidjdXJyZW5jeScscS0+Pidmcm9tJ2xvb3AKICBjb3ZlcmVkOj0obGVnLT4+J21pbm9yJyk6OmJp
Z2ludDtpZiBjb3ZlcmVkPTAgdGhlbiBjb250aW51ZTtlbmQgaWY7ZGVsdGE6PShsZWctPj4nZGVsdGEnKTo6YmlnaW50OwogIGlm
KGxlZy0+PidzaWdudW0nKTo6aW50PDAgdGhlbiBjb250cmE6PWRlbHRhOwogIGVsc2UgY29udHJhOj1sZWFzdChvcHBvc2l0ZSxk
ZWx0YSk7b3Bwb3NpdGU6PW9wcG9zaXRlLWNvbnRyYTtlbmQgaWY7CiAgb3V0Oj1vdXR8fGpzb25iX2J1aWxkX2FycmF5KChsZWct
J29yaWdpbmFsJy0nYmVmb3JlJy0nZGVsdGEnLSdzaWdudW0nKXx8anNvbmJfYnVpbGRfb2JqZWN0KCdlZGdlSWQnLGVkZ2UtPj4n
aWQnLCdhcHBsaWNhdGlvbicsY2FzZSB3aGVuKGxlZy0+PidzaWdudW0nKTo6aW50PDAgdGhlbidjb250cmEnd2hlbiBjb250cmE+
MCB0aGVuJ2NvbnRyYV9hbmRfcmVwYXltZW50J2Vsc2UncmVwYXltZW50J2VuZCwnbGVkZ2VyQ3VycmVuY3knLCdWTkQnLCdjb250
cmFFcXVpdmFsZW50TWlub3InLGNvbnRyYSwncmVwYXltZW50RXF1aXZhbGVudE1pbm9yJyxjYXNlIHdoZW4obGVnLT4+J3NpZ251
bScpOjppbnQ8MCB0aGVuIDAgZWxzZSBkZWx0YS1jb250cmEgZW5kKSk7CiBlbmQgbG9vcDtyZXR1cm4gb3V0OwplbmQkJDsKCgpj
cmVhdGUgb3IgcmVwbGFjZSBmdW5jdGlvbiBwcml2YXRlLnJvdXRlZF9idWlsZF9jb3JlKGFjdG9yIHV1aWQsdHJpcCB1dWlkLGRy
YWZ0IGpzb25iLGNyZWF0b3JfbW9kZSBib29sZWFuKQpyZXR1cm5zIGpzb25iIGxhbmd1YWdlIHBscGdzcWwgc2VjdXJpdHkgZGVm
aW5lciBzZXQgc2VhcmNoX3BhdGg9JycgYXMgJCQKI3ZhcmlhYmxlX2NvbmZsaWN0IHVzZV92YXJpYWJsZQpkZWNsYXJlIHBheW1l
bnRzIGpzb25iOj1kcmFmdC0+J3BheW1lbnRzJztwIGpzb25iO2xpbmUganNvbmI7ZSBqc29uYjtsZWcganNvbmI7bWVtYmVyIHV1
aWQ7c2VuZGVyIHV1aWQ7cmVjZWl2ZXIgdXVpZDt2aWEgdXVpZDtrIHRleHQ7CiBlZGdlcyBqc29uYjo9J3t9Jzo6anNvbmI7cmVz
ZXJ2ZWQganNvbmI6PSd7fSc6Ompzb25iO2lkcyBqc29uYjo9J3t9Jzo6anNvbmI7bGVmdHMganNvbmI6PSd7fSc6Ompzb25iO3Rv
dGFscyBqc29uYjo9J3t9Jzo6anNvbmI7bGluZXMganNvbmI6PSdbXSc6Ompzb25iO25leHRfbGluZXMganNvbmI6PSdbXSc6Ompz
b25iO2lzc3VlcyBqc29uYjo9J1tdJzo6anNvbmI7bmF0aXZlIGpzb25iOj0nW10nOjpqc29uYjtyZW1haW5pbmcganNvbmI6PSdb
XSc6Ompzb25iO2FjdG9ycyBqc29uYjo9J1tdJzo6anNvbmI7c291cmNlcyBqc29uYjo9J1tdJzo6anNvbmI7CiBhbW91bnQgYmln
aW50O3ZhbHVlIGJpZ2ludDtyb3V0ZSBiaWdpbnQ7ZGlyZWN0IGJpZ2ludDt1bmFwcGxpZWQgYmlnaW50O2NhcCBiaWdpbnQ7Y292
ZXJlZCBiaWdpbnQ7dG90YWwgYmlnaW50O25ldCBiaWdpbnQ7CiBuIG51bWVyaWM7ZCBudW1lcmljO2Nhc2hfZ3JvdXAgcmVjb3Jk
O3NuYXBzaG90IHV1aWQ7cmF0ZXMganNvbmI7cXVvdGUganNvbmI7bW9kZSB0ZXh0Oj1kcmFmdC0+PidyYXRlTW9kZSc7CiBuZXRf
bW9kZSBib29sZWFuOj1jb2FsZXNjZShkcmFmdC0+PidlZGdlQmFzaXMnPSduZXQnLGZhbHNlKTtjcSBqc29uYjttYXRyaXgganNv
bmI7cmVzb2x2ZWQganNvbmI7CmJlZ2luCiBpZiBjcmVhdG9yX21vZGUgYW5kIG5vdCBwcml2YXRlLmNyZWF0b3JfY2FuX3JlY29y
ZCh0cmlwLGFjdG9yKXRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2NyZWF0b3JfcHJveHlfZm9yYmlkZGVuJyxl
cnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogaWYgYWN0b3IgaXMgbnVsbCBvciBwcml2YXRlLnNwYWNlX3JvbGUodHJpcCxhY3Rvcilp
cyBudWxsIHRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J3NldHRsZW1lbnRfcGFydGljaXBhbnRfZGVuaWVkJyxl
cnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogcGVyZm9ybSAxIGZyb20gcHVibGljLnNwYWNlcyBzIHdoZXJlIHMuaWQ9dHJpcCBhbmQg
cy50eXBlPSd0cmlwJ2FuZCBzLnN0YXR1czw+J3ZvaWRlZCdmb3Igc2hhcmU7CiBpZiBub3QgZm91bmQgdGhlbiByYWlzZSBleGNl
cHRpb24gdXNpbmcgbWVzc2FnZT0nc2V0dGxlbWVudF9wYXJ0aWNpcGFudF9kZW5pZWQnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7
CiBpZiBkcmFmdCA/ICdlZGdlQmFzaXMnb3IgZHJhZnQgPyAnY29udHJhU25hcHNob3QndGhlbgogIGlmIG5vdCBuZXRfbW9kZSBv
ciBqc29uYl90eXBlb2YoZHJhZnQtPidjb250cmFTbmFwc2hvdCcpaXMgZGlzdGluY3QgZnJvbSdvYmplY3Qnb3IgY29hbGVzY2Uo
ZHJhZnQtPidjb250cmFTbmFwc2hvdCctPj4ncmV2aXNpb24nLCcnKSF+J15bYS1mMC05XXs2NH0kJ29yIGV4aXN0cyhzZWxlY3Qg
MSBmcm9tIGpzb25iX29iamVjdF9rZXlzKGRyYWZ0LT4nY29udHJhU25hcHNob3QnKWsgd2hlcmUgayBub3QgaW4oJ3JldmlzaW9u
JywnZGlzcGxheUN1cnJlbmN5JykpdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0naW52YWxpZF9jb250cmFfc25h
cHNob3QnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiAgLS0gV3JpdGVzIGhvbGQgdGhlIGV4aXN0aW5nIGNvbW1vbiBmaW5hbmNp
YWwgbG9jayBhbmQgcGluIHRoZSByYXRlIHJvdy4KICBwZXJmb3JtIDEgZnJvbSB0YWJieV9meC5yZWZyZXNoX3N0YXRlIHIgam9p
biB0YWJieV9meC5zbmFwc2hvdHMgcyBvbiBzLmlkPXIuc25hcHNob3RfaWQgd2hlcmUgci5zaW5nbGV0b24gZm9yIHNoYXJlIG9m
IHIsczsKICBjcTo9cHJpdmF0ZS5jb250cmFfcXVvdGUobW9kZSxkcmFmdC0+Pid2bmRQZXJNeXInLGRyYWZ0LT4nY29udHJhU25h
cHNob3QnLT4+J2Rpc3BsYXlDdXJyZW5jeScpO21hdHJpeDo9cHJpdmF0ZS5jb250cmFfbWF0cml4KHRyaXAsY3EpOwogIGlmIG1h
dHJpeC0+PidyZXZpc2lvbidpcyBkaXN0aW5jdCBmcm9tIGRyYWZ0LT4nY29udHJhU25hcHNob3QnLT4+J3JldmlzaW9uJ3RoZW4g
cmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2NvbnRyYV9zbmFwc2hvdF9jaGFuZ2VkJyxlcnJjb2RlPSdQMDAwMSc7ZW5k
IGlmOwogZW5kIGlmOwogaWYgbW9kZSBpcyBudWxsIG9yIG1vZGUgbm90IGluKCdzeXN0ZW0nLCdjdXN0b20nKW9yIGpzb25iX3R5
cGVvZihwYXltZW50cylpcyBkaXN0aW5jdCBmcm9tJ2FycmF5J29yIGpzb25iX2FycmF5X2xlbmd0aChwYXltZW50cylub3QgYmV0
d2VlbiAxIGFuZCA1MCB0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdpbnZhbGlkX2Ftb3VudCcsZXJyY29kZT0n
UDAwMDEnO2VuZCBpZjsKIGlmIG1vZGU9J2N1c3RvbScgdGhlbgogIGlmIGNvYWxlc2NlKGRyYWZ0LT4+J3ZuZFBlck15cicsJycp
IX4nXlswLTldezEsMTJ9KFwuWzAtOV17MSwxMn0pPyQnb3IoZHJhZnQtPj4ndm5kUGVyTXlyJyk6Om51bWVyaWM8PTAgdGhlbiBy
YWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0naW52YWxpZF9yYXRlJyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogIG46PShk
cmFmdC0+Pid2bmRQZXJNeXInKTo6bnVtZXJpYztkOj0xO3F1b3RlOj1qc29uYl9idWlsZF9vYmplY3QoJ251bWVyYXRvcicsbjo6
dGV4dCwnZGVub21pbmF0b3InLCcxJywnc291cmNlJywnY3VzdG9tJywncHJvdmlkZXInLCdDdXN0b20nKTsKIGVsc2UKICBzZWxl
Y3Qgci5zbmFwc2hvdF9pZCxzLnJhdGVzIGludG8gc25hcHNob3QscmF0ZXMgZnJvbSB0YWJieV9meC5yZWZyZXNoX3N0YXRlIHIg
am9pbiB0YWJieV9meC5zbmFwc2hvdHMgcyBvbiBzLmlkPXIuc25hcHNob3RfaWQgd2hlcmUgci5zaW5nbGV0b24gZm9yIHNoYXJl
IG9mIHIsczsKICBuOj0ocmF0ZXMtPidWTkQnLT4+J2Rlbm9taW5hdG9yJyk6Om51bWVyaWM7ZDo9KHJhdGVzLT4nVk5EJy0+Pidu
dW1lcmF0b3InKTo6bnVtZXJpYzsKICBxdW90ZTo9anNvbmJfYnVpbGRfb2JqZWN0KCdudW1lcmF0b3InLG46OnRleHQsJ2Rlbm9t
aW5hdG9yJyxkOjp0ZXh0LCdzb3VyY2UnLCdzeXN0ZW0nLCdwcm92aWRlcicscmF0ZXMtPidWTkQnLT4+J3Byb3ZpZGVyJywncmF0
ZURhdGUnLHJhdGVzLT4nVk5EJy0+PidyYXRlRGF0ZScsJ3NuYXBzaG90SWQnLHNuYXBzaG90KTsKIGVuZCBpZjsKIGZvciBwIGlu
IHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMocGF5bWVudHMpcSBvcmRlciBieSBxLT4+J2lkJ2xvb3AKICBzZW5k
ZXI6PShwLT4+J3BheWVyJyk6OnV1aWQ7cmVjZWl2ZXI6PShwLT4+J3JlY2lwaWVudCcpOjp1dWlkO3ZpYTo9bnVsbGlmKHAtPid2
aWEnLT4+J3BlcnNvbicsJycpOjp1dWlkOwogIGlmIGNvYWxlc2NlKHAtPj4naWQnLCcnKSF+J15bQS1aYS16MC05Xy1dezEsODB9
JCdvciBpZHMgPyAocC0+PidpZCcpb3Igc2VuZGVyIGlzIG51bGwgb3IgcmVjZWl2ZXIgaXMgbnVsbCBvciBzZW5kZXI9cmVjZWl2
ZXIgb3IgKG5vdCBjcmVhdG9yX21vZGUgYW5kIGFjdG9yIG5vdCBpbihzZW5kZXIscmVjZWl2ZXIpKW9yIHAtPj4ndGVuZGVyQ3Vy
cmVuY3knbm90IGluKCdNWVInLCdWTkQnKW9yIHAtPj4nbWV0aG9kJ25vdCBpbignY2FzaCcsJ2JhbmtfdHJhbnNmZXInKXRoZW4g
cmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J3JvdXRlZF9wYXJ0aWNpcGFudF9kZW5pZWQnLGVycmNvZGU9J1AwMDAxJztl
bmQgaWY7CiAgaWYgKHAtPj4ndGVuZGVyQ3VycmVuY3knKWlzIG51bGwgb3IocC0+PidtZXRob2QnKWlzIG51bGwgb3IgY29hbGVz
Y2UocC0+Pid0ZW5kZXJNaW5vcicsJycpIX4nXlswLTldezEsMTZ9JCd0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdl
PSdpbnZhbGlkX2Ftb3VudCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKICBpZHM6PWlkc3x8anNvbmJfYnVpbGRfb2JqZWN0KHAt
Pj4naWQnLHRydWUpO2s6PXNlbmRlcjo6dGV4dHx8JzonfHxyZWNlaXZlcjo6dGV4dHx8JzonfHwocC0+Pid0ZW5kZXJDdXJyZW5j
eScpOwogIGlmIGlkcyA/IGsgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0nZHVwbGljYXRlX3RlbmRlcicsZXJy
Y29kZT0nUDAwMDEnO2VuZCBpZjtpZHM6PWlkc3x8anNvbmJfYnVpbGRfb2JqZWN0KGssdHJ1ZSk7CiAgZm9yIG1lbWJlciBpbiBz
ZWxlY3QgZGlzdGluY3QgeCBmcm9tIHVubmVzdChhcnJheVtzZW5kZXIscmVjZWl2ZXIsdmlhXSl4IHdoZXJlIHggaXMgbm90IG51
bGwgb3JkZXIgYnkgeCBsb29wCiAgIHBlcmZvcm0gMSBmcm9tIHB1YmxpYy5zcGFjZV9tZW1iZXJzIHNtIGpvaW4gcHVibGljLnBh
cnRpY2lwYW50cyBwdCBvbiBwdC5pZD1zbS5wYXJ0aWNpcGFudF9pZCB3aGVyZSBzbS5zcGFjZV9pZD10cmlwIGFuZCBzbS5wYXJ0
aWNpcGFudF9pZD1tZW1iZXIgYW5kIHNtLnJlbW92ZWRfYXQgaXMgbnVsbCBhbmQgKHB0LmtpbmQ9J2FjY291bnQnb3IgY3JlYXRv
cl9tb2RlIGFuZCBwdC5raW5kPSdtYW51YWwnKWZvciBzaGFyZSBvZiBzbSxwdDsKICAgaWYgbm90IGZvdW5kIHRoZW4gcmFpc2Ug
ZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J3JvdXRlZF9wYXJ0aWNpcGFudF9kZW5pZWQnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7
CiAgIGlmIG5vdCBhY3RvcnMgQD4ganNvbmJfYnVpbGRfYXJyYXkobWVtYmVyKXRoZW4gYWN0b3JzOj1hY3RvcnN8fGpzb25iX2J1
aWxkX2FycmF5KG1lbWJlcik7ZW5kIGlmOwogIGVuZCBsb29wOwogIGlmIHZpYSBpcyBub3QgbnVsbCBhbmQgdmlhIGluKHNlbmRl
cixyZWNlaXZlcil0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdpbnZhbGlkX2ludGVybWVkaWFyeScsZXJyY29k
ZT0nUDAwMDEnO2VuZCBpZjsKICAtLSBMb2FkIG9ubHkgdGhlIHNoYXJlZCBwYWlycyB1c2VkIGJ5IHRoaXMgZHJhZnQ7IHVucmVs
YXRlZCBwYWlycyBuZXZlciBlbnRlciBEVE9zLgogIGZvciBlIGluIHNlbGVjdCBqc29uYl9idWlsZF9vYmplY3QoJ2Zyb20nLHNl
bmRlciwndG8nLHJlY2VpdmVyKXVuaW9uIGFsbCBzZWxlY3QganNvbmJfYnVpbGRfb2JqZWN0KCdmcm9tJyxzZW5kZXIsJ3RvJyx2
aWEpd2hlcmUgdmlhIGlzIG5vdCBudWxsIHVuaW9uIGFsbCBzZWxlY3QganNvbmJfYnVpbGRfb2JqZWN0KCdmcm9tJyx2aWEsJ3Rv
JyxyZWNlaXZlcil3aGVyZSB2aWEgaXMgbm90IG51bGwgbG9vcAogICBrOj0oZS0+Pidmcm9tJyl8fCc6J3x8KGUtPj4ndG8nKTsK
ICAgaWYgbm90IGVkZ2VzID8gayB0aGVuCiAgICBlOj1jYXNlIHdoZW4gbmV0X21vZGUgdGhlbiBwcml2YXRlLmNvbnRyYV9uZXRf
ZWRnZSh0cmlwLChlLT4+J2Zyb20nKTo6dXVpZCwoZS0+Pid0bycpOjp1dWlkLG4sZCllbHNlIHByaXZhdGUucm91dGVkX2VkZ2Uo
dHJpcCwoZS0+Pidmcm9tJyk6OnV1aWQsKGUtPj4ndG8nKTo6dXVpZCxuLGQpZW5kO2VkZ2VzOj1lZGdlc3x8anNvbmJfYnVpbGRf
b2JqZWN0KGssZSk7bGVmdHM6PWxlZnRzfHxqc29uYl9idWlsZF9vYmplY3QoayxlLT4nbWlub3InKTsKICAgZW5kIGlmOwogIGVu
ZCBsb29wOwogIGFtb3VudDo9KHAtPj4ndGVuZGVyTWlub3InKTo6YmlnaW50O2lmIGFtb3VudDw9MCB0aGVuIHJhaXNlIGV4Y2Vw
dGlvbiB1c2luZyBtZXNzYWdlPSdpbnZhbGlkX2Ftb3VudCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKICB2YWx1ZTo9cHJpdmF0
ZS5yb3V0ZWRfdmFsdWUoYW1vdW50LHAtPj4ndGVuZGVyQ3VycmVuY3knLG4sZCk7cm91dGU6PTA7CiAgcDo9anNvbmJfc3RyaXBf
bnVsbHMoanNvbmJfYnVpbGRfb2JqZWN0KCdpZCcscC0+PidpZCcsJ3BheWVyJyxzZW5kZXIsJ3JlY2lwaWVudCcscmVjZWl2ZXIs
J3RlbmRlckN1cnJlbmN5JyxwLT4+J3RlbmRlckN1cnJlbmN5JywndGVuZGVyTWlub3InLGFtb3VudCwnbWV0aG9kJyxwLT4+J21l
dGhvZCcsJ3ZpYScsY2FzZSB3aGVuIHZpYSBpcyBub3QgbnVsbCB0aGVuIGpzb25iX2J1aWxkX29iamVjdCgncGVyc29uJyx2aWEp
fHxjYXNlIHdoZW4gcC0+J3ZpYScgPyAnbWlub3InIHRoZW4ganNvbmJfYnVpbGRfb2JqZWN0KCdtaW5vcicscC0+J3ZpYSctPidt
aW5vcicpZWxzZSAne30nOjpqc29uYiBlbmQgZWxzZSBudWxsIGVuZCkpOwogIGlmIHZhbHVlPTAgdGhlbiBpc3N1ZXM6PWlzc3Vl
c3x8anNvbmJfYnVpbGRfYXJyYXkoanNvbmJfYnVpbGRfb2JqZWN0KCdjb2RlJywnWkVST19WQUxVRScsJ3BheW1lbnRJZHMnLGpz
b25iX2J1aWxkX2FycmF5KHAtPj4naWQnKSkpO2VuZCBpZjsKICBpZiB2aWEgaXMgbm90IG51bGwgdGhlbgogICBjYXA6PWxlYXN0
KHZhbHVlLChlZGdlcy0+KHNlbmRlcjo6dGV4dHx8JzonfHx2aWE6OnRleHQpLT4+J21pbm9yJyk6OmJpZ2ludCwoZWRnZXMtPih2
aWE6OnRleHR8fCc6J3x8cmVjZWl2ZXI6OnRleHQpLT4+J21pbm9yJyk6OmJpZ2ludCk7CiAgIGlmIGNhcDw9MCB0aGVuIGlzc3Vl
czo9aXNzdWVzfHxqc29uYl9idWlsZF9hcnJheShqc29uYl9idWlsZF9vYmplY3QoJ2NvZGUnLCdOT19PUEVOX1JPVVRFJywncGF5
bWVudElkcycsanNvbmJfYnVpbGRfYXJyYXkocC0+PidpZCcpKSk7ZW5kIGlmOwogICBpZiBwLT4ndmlhJyA/ICdtaW5vcidhbmQg
Y29hbGVzY2UocC0+J3ZpYSctPj4nbWlub3InLCcnKSF+J15bMC05XXsxLDE2fSQndGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcg
bWVzc2FnZT0naW52YWxpZF9hbW91bnQnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiAgIHJvdXRlOj1jb2FsZXNjZSgocC0+J3Zp
YSctPj4nbWlub3InKTo6YmlnaW50LGNhcCk7CiAgIGlmIHJvdXRlPDAgb3Igcm91dGU+dmFsdWUgb3Iocm91dGU9MCBhbmQgY2Fw
PjApdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0naW52YWxpZF9yb3V0ZWRfYW1vdW50JyxlcnJjb2RlPSdQMDAw
MSc7ZW5kIGlmOwogICBmb3IgayBpbiBzZWxlY3Qgc2VuZGVyOjp0ZXh0fHwnOid8fHZpYTo6dGV4dCB1bmlvbiBhbGwgc2VsZWN0
IHZpYTo6dGV4dHx8JzonfHxyZWNlaXZlcjo6dGV4dCBsb29wCiAgICByZXNlcnZlZDo9cmVzZXJ2ZWR8fGpzb25iX2J1aWxkX29i
amVjdChrLGNvYWxlc2NlKChyZXNlcnZlZC0+PmspOjpiaWdpbnQsMCkrcm91dGUpOwogICAgdG90YWxzOj10b3RhbHN8fGpzb25i
X2J1aWxkX29iamVjdChrLGNvYWxlc2NlKHRvdGFscy0+aywnW10nKXx8anNvbmJfYnVpbGRfYXJyYXkocC0+PidpZCcpKTsKICAg
ZW5kIGxvb3A7CiAgZW5kIGlmOwogIGxpbmVzOj1saW5lc3x8anNvbmJfYnVpbGRfYXJyYXkoanNvbmJfYnVpbGRfb2JqZWN0KCdw
YXltZW50JyxwLCd2YWx1ZU1pbm9yJyx2YWx1ZSwndmlhTWlub3InLHJvdXRlLCdkaXJlY3RNaW5vcicsMCwndW5hcHBsaWVkTWlu
b3InLHZhbHVlLXJvdXRlKSk7CiBlbmQgbG9vcDsKIGlmIG1vZGU9J3N5c3RlbScgdGhlbgogIGlmIGV4aXN0cyhzZWxlY3QgMSBm
cm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKHBheW1lbnRzKXEgd2hlcmUgcS0+Pid0ZW5kZXJDdXJyZW5jeSc9J01ZUicpb3IgZXhp
c3RzKHNlbGVjdCAxIGZyb20ganNvbmJfZWFjaChlZGdlcyllZGdlIGNyb3NzIGpvaW4gbGF0ZXJhbCBqc29uYl9hcnJheV9lbGVt
ZW50cyhlZGdlLnZhbHVlLT4nbmF0aXZlJylsZWcgd2hlcmUgbGVnLT4+J2N1cnJlbmN5Jz0nTVlSJyl0aGVuCiAgIGlmIG4gaXMg
bnVsbCBvciBkIGlzIG51bGwgb3Igbjw9MCBvciBkPD0wIG9yIHF1b3RlLT4+J3Byb3ZpZGVyJ2lzIG51bGwgb3IgcXVvdGUtPj4n
cmF0ZURhdGUnaXMgbnVsbCB0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdmeF9yYXRlX3VuYXZhaWxhYmxlJyxl
cnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogICBpZiBzbmFwc2hvdCBpcyBkaXN0aW5jdCBmcm9tIG51bGxpZihkcmFmdC0+PidzbmFw
c2hvdElkJywnJyk6OnV1aWQgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0ncXVvdGVfY2hhbmdlZCcsZXJyY29k
ZT0nUDAwMDEnO2VuZCBpZjsKICBlbHNlIG46PTE7ZDo9MTtxdW90ZTo9anNvbmJfYnVpbGRfb2JqZWN0KCdudW1lcmF0b3InLCcx
JywnZGVub21pbmF0b3InLCcxJywnc291cmNlJywnaWRlbnRpdHknKTtlbmQgaWY7CiBlbmQgaWY7CiAtLSBBZ2dyZWdhdGVkIGFj
dHVhbCBjYXNoIG11c3QgZXhwbGFpbiB0aGUgc2FtZSB2YWx1ZTsgc3BsaXR0aW5nIE1ZUiBjZW50cwogLS0gYWNyb3NzIHBheWVl
cyBtdXN0IG5vdCBtYW51ZmFjdHVyZSBhIFZORCBvZiBleHRyYSBuYXRpdmUgY292ZXJhZ2UuCiBmb3IgY2FzaF9ncm91cCBpbiBz
ZWxlY3QgcS0+J3BheW1lbnQnLT4+J3BheWVyJyBwYXllcixxLT4ncGF5bWVudCctPj4ndGVuZGVyQ3VycmVuY3knIGNvZGUsc3Vt
KChxLT4ncGF5bWVudCctPj4ndGVuZGVyTWlub3InKTo6YmlnaW50KTo6YmlnaW50IGFtb3VudCxzdW0oKHEtPj4ndmFsdWVNaW5v
cicpOjpiaWdpbnQpOjpiaWdpbnQgZXF1aXZhbGVudCxqc29uYl9hZ2cocS0+J3BheW1lbnQnLT4+J2lkJykgaWRzIGZyb20ganNv
bmJfYXJyYXlfZWxlbWVudHMobGluZXMpcSBncm91cCBieSAxLDIgbG9vcAogIGlmIHByaXZhdGUucm91dGVkX3ZhbHVlKGNhc2hf
Z3JvdXAuYW1vdW50LGNhc2hfZ3JvdXAuY29kZSxuLGQpPD5jYXNoX2dyb3VwLmVxdWl2YWxlbnQgdGhlbiBpc3N1ZXM6PWlzc3Vl
c3x8anNvbmJfYnVpbGRfYXJyYXkoanNvbmJfYnVpbGRfb2JqZWN0KCdjb2RlJywnTkFUSVZFX1BSRUNJU0lPTicsJ3BheW1lbnRJ
ZHMnLGNhc2hfZ3JvdXAuaWRzKSk7ZW5kIGlmOwogZW5kIGxvb3A7CiBmb3Igayx0b3RhbCBpbiBzZWxlY3QgZW50cnkua2V5LGVu
dHJ5LnZhbHVlOjp0ZXh0OjpiaWdpbnQgZnJvbSBqc29uYl9lYWNoKHJlc2VydmVkKWVudHJ5IGxvb3AKICBjYXA6PShlZGdlcy0+
ay0+PidtaW5vcicpOjpiaWdpbnQ7CiAgaWYgdG90YWw+Y2FwIHRoZW4gaXNzdWVzOj1pc3N1ZXN8fGpzb25iX2J1aWxkX2FycmF5
KGpzb25iX2J1aWxkX29iamVjdCgnY29kZScsJ1NIQVJFRF9MSU1JVCcsJ3BheW1lbnRJZHMnLHRvdGFscy0+aywnY2FwYWNpdHlN
aW5vcicsY2FwKSk7ZW5kIGlmOwogZW5kIGxvb3A7CiBpZiBqc29uYl9hcnJheV9sZW5ndGgoaXNzdWVzKT0wIHRoZW4KICBmb3Ig
ayx0b3RhbCBpbiBzZWxlY3QgZW50cnkua2V5LGVudHJ5LnZhbHVlOjp0ZXh0OjpiaWdpbnQgZnJvbSBqc29uYl9lYWNoKHJlc2Vy
dmVkKWVudHJ5IGxvb3AgbGVmdHM6PWxlZnRzfHxqc29uYl9idWlsZF9vYmplY3QoaywobGVmdHMtPj5rKTo6YmlnaW50LXRvdGFs
KTtlbmQgbG9vcDsKICBmb3IgbGluZSBpbiBzZWxlY3QgcSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKGxpbmVzKXEgbG9vcAog
ICBwOj1saW5lLT4ncGF5bWVudCc7azo9KHAtPj4ncGF5ZXInKXx8JzonfHwocC0+PidyZWNpcGllbnQnKTt1bmFwcGxpZWQ6PShs
aW5lLT4+J3VuYXBwbGllZE1pbm9yJyk6OmJpZ2ludDsKICAgZGlyZWN0Oj1sZWFzdCh1bmFwcGxpZWQsKGxlZnRzLT4+ayk6OmJp
Z2ludCk7bGVmdHM6PWxlZnRzfHxqc29uYl9idWlsZF9vYmplY3QoaywobGVmdHMtPj5rKTo6YmlnaW50LWRpcmVjdCk7CiAgIGlm
IGRpcmVjdD4wIHRoZW4gdG90YWxzOj10b3RhbHN8fGpzb25iX2J1aWxkX29iamVjdChrLGNvYWxlc2NlKHRvdGFscy0+aywnW10n
KXx8anNvbmJfYnVpbGRfYXJyYXkocC0+PidpZCcpKTtlbmQgaWY7CiAgIGlmIHVuYXBwbGllZD5kaXJlY3QgdGhlbiBpc3N1ZXM6
PWlzc3Vlc3x8anNvbmJfYnVpbGRfYXJyYXkoanNvbmJfYnVpbGRfb2JqZWN0KCdjb2RlJywnVU5BUFBMSUVEX0NBU0gnLCdwYXlt
ZW50SWRzJyxqc29uYl9idWlsZF9hcnJheShwLT4+J2lkJykpKTtlbmQgaWY7CiAgIG5leHRfbGluZXM6PW5leHRfbGluZXN8fGpz
b25iX2J1aWxkX2FycmF5KGxpbmV8fGpzb25iX2J1aWxkX29iamVjdCgnZGlyZWN0TWlub3InLGRpcmVjdCwndW5hcHBsaWVkTWlu
b3InLHVuYXBwbGllZC1kaXJlY3QpKTsKICBlbmQgbG9vcDtsaW5lczo9bmV4dF9saW5lczsKIGVuZCBpZjsKIGZvciBrLGUgaW4g
c2VsZWN0IGVudHJ5LmtleSxlbnRyeS52YWx1ZSBmcm9tIGpzb25iX2VhY2goZWRnZXMpZW50cnkgb3JkZXIgYnkgZW50cnkua2V5
IGxvb3AKICB0b3RhbDo9KGUtPj4nbWlub3InKTo6YmlnaW50LShsZWZ0cy0+PmspOjpiaWdpbnQ7bmV0Oj0wOwogIGlmIG5ldF9t
b2RlIHRoZW4KICAgcmVzb2x2ZWQ6PXByaXZhdGUuY29udHJhX3Jlc29sdmVfbmF0aXZlKGUsdG90YWwsbixkKTsKICAgaWYgcmVz
b2x2ZWQgaXMgbnVsbCB0aGVuIG5ldDo9LTE7ZWxzZSBuYXRpdmU6PW5hdGl2ZXx8cmVzb2x2ZWQ7bmV0Oj10b3RhbDtlbmQgaWY7
CiAgZWxzZQogIGZvciBsZWcgaW4gc2VsZWN0IHEgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhlLT4nbmF0aXZlJylxIGxvb3AK
ICAgY292ZXJlZDo9Y2FzZSB3aGVuIHRvdGFsPTAgdGhlbiAwIGVsc2UgbGVhc3QoKGxlZy0+PidtaW5vcicpOjpiaWdpbnQscHJp
dmF0ZS5meF9yb3VuZF9kaXYoKGxlZy0+PidtaW5vcicpOjpudW1lcmljKnRvdGFsLChlLT4+J21pbm9yJyk6Om51bWVyaWMpKWVu
ZDsKICAgaWYgY292ZXJlZD4wIHRoZW4gbmF0aXZlOj1uYXRpdmV8fGpzb25iX2J1aWxkX2FycmF5KGpzb25iX2J1aWxkX29iamVj
dCgnZWRnZUlkJyxrLCdmcm9tJyxsZWctPidmcm9tJywndG8nLGxlZy0+J3RvJywnY3VycmVuY3knLGxlZy0+J2N1cnJlbmN5Jywn
bWlub3InLGNvdmVyZWQpKTtlbmQgaWY7CiAgIG5ldDo9bmV0K2Nhc2Ugd2hlbiBsZWctPj4nZnJvbSc9ZS0+Pidmcm9tJ3RoZW4g
MSBlbHNlIC0xIGVuZCpwcml2YXRlLnJvdXRlZF92YWx1ZShjb3ZlcmVkLGxlZy0+PidjdXJyZW5jeScsbixkKTsKICAgcmVtYWlu
aW5nOj1yZW1haW5pbmd8fGpzb25iX2J1aWxkX2FycmF5KGpzb25iX2J1aWxkX29iamVjdCgnaWQnLGt8fCc6J3x8KGxlZy0+Pidj
dXJyZW5jeScpfHwnOid8fChsZWctPj4nZnJvbScpLCdmcm9tJyxsZWctPidmcm9tJywndG8nLGxlZy0+J3RvJywnY3VycmVuY3kn
LGxlZy0+J2N1cnJlbmN5JywnbWlub3InLChsZWctPj4nbWlub3InKTo6YmlnaW50LWNvdmVyZWQpKTsKICBlbmQgbG9vcDsKICBl
bmQgaWY7CiAgLS0gTm8gdW5leHBsYWluZWQgdG9sZXJhbmNlOiBuYXRpdmUgY292ZXJhZ2UgbXVzdCBleHBsYWluIHRoZSBwYWly
ZWQgdmFsdWUuCiAgaWYgdG90YWw+MCBhbmQgbmV0PD50b3RhbCB0aGVuIGlzc3Vlczo9aXNzdWVzfHxqc29uYl9idWlsZF9hcnJh
eShqc29uYl9idWlsZF9vYmplY3QoJ2NvZGUnLCdOQVRJVkVfUFJFQ0lTSU9OJywncGF5bWVudElkcycsdG90YWxzLT5rKSk7ZW5k
IGlmOwogIHNvdXJjZXM6PXNvdXJjZXN8fGpzb25iX2J1aWxkX2FycmF5KGUpOwogZW5kIGxvb3A7CiBpZiBqc29uYl9hcnJheV9s
ZW5ndGgoaXNzdWVzKT4wIHRoZW4gbmF0aXZlOj0nW10nOjpqc29uYjtyZW1haW5pbmc6PSdbXSc6Ompzb25iO3NlbGVjdCBqc29u
Yl9hZ2cocXx8anNvbmJfYnVpbGRfb2JqZWN0KCd2aWFNaW5vcicsMCwnZGlyZWN0TWlub3InLDAsJ3VuYXBwbGllZE1pbm9yJyxx
LT4ndmFsdWVNaW5vcicpKWludG8gbGluZXMgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhsaW5lcylxO2ZvciBlIGluIHNlbGVj
dCBlbnRyeS52YWx1ZSBmcm9tIGpzb25iX2VhY2goZWRnZXMpZW50cnkgbG9vcCByZW1haW5pbmc6PXJlbWFpbmluZ3x8ZS0+J25h
dGl2ZSc7ZW5kIGxvb3A7ZW5kIGlmOwogcmV0dXJuIGpzb25iX2J1aWxkX29iamVjdCgnbGVkZ2VyQ3VycmVuY3knLCdWTkQnLCds
aW5lcycsbGluZXMsJ2lzc3VlcycsaXNzdWVzLCdyZW1haW5pbmcnLHJlbWFpbmluZywncmF0ZScscXVvdGUsJ25hdGl2ZScsbmF0
aXZlLCdzb3VyY2VzJyxzb3VyY2VzLCdhY3RvcnMnLGFjdG9ycyl8fGNhc2Ugd2hlbiBuZXRfbW9kZSB0aGVuIGpzb25iX2J1aWxk
X29iamVjdCgnZWRnZUJhc2lzJywnbmV0JywnY29udHJhUXVvdGUnLGNxKWVsc2UgJ3t9Jzo6anNvbmIgZW5kOwplbmQgJCQ7Cgpj
cmVhdGUgb3IgcmVwbGFjZSBmdW5jdGlvbiBwcml2YXRlLmNyZWF0b3Jfbm9ybWFsaXplKGRyYWZ0IGpzb25iKQpyZXR1cm5zIGpz
b25iIGxhbmd1YWdlIHBscGdzcWwgc3RhYmxlIHNldCBzZWFyY2hfcGF0aD0nJyBhcyAkJAojdmFyaWFibGVfY29uZmxpY3QgdXNl
X3ZhcmlhYmxlCmRlY2xhcmUgb2NjdXJyZWQgdGltZXN0YW1wdHo7bGlua3MganNvbmI7bGluayBqc29uYjtyZXN1bHQganNvbmI7
cmVwbGFjZW1lbnQgdXVpZDsKYmVnaW4KIGlmIGpzb25iX3R5cGVvZihkcmFmdClpcyBkaXN0aW5jdCBmcm9tJ29iamVjdCdvciBl
eGlzdHMoc2VsZWN0IDEgZnJvbSBqc29uYl9vYmplY3Rfa2V5cyhkcmFmdClrIHdoZXJlIGsgbm90IGluKCdyYXRlTW9kZScsJ3Zu
ZFBlck15cicsJ3NuYXBzaG90SWQnLCdwYXltZW50cycsJ29jY3VycmVkQXQnLCdub3RlJywnb3duQWNjb3VudExpbmtzJywncmVw
bGFjZW1lbnRGb3InLCdlZGdlQmFzaXMnLCdjb250cmFTbmFwc2hvdCcpKXRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3Nh
Z2U9J2NyZWF0b3JfaW52YWxpZF9kcmFmdCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKIGlmIGNvYWxlc2NlKGRyYWZ0LT4+J29j
Y3VycmVkQXQnLCcnKSF+J15bMC05XXs0fS1bMC05XXsyfS1bMC05XXsyfVRbMC05XXsyfTpbMC05XXsyfSg6WzAtOV17Mn0oXC5b
MC05XXsxLDZ9KT8pPyhafFsrLV1bMC05XXsyfTpbMC05XXsyfSkkJ3RoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9
J2NyZWF0b3JfaW52YWxpZF90aW1lJyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogYmVnaW4gb2NjdXJyZWQ6PShkcmFmdC0+Pidv
Y2N1cnJlZEF0Jyk6OnRpbWVzdGFtcHR6O2V4Y2VwdGlvbiB3aGVuIG90aGVycyB0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBt
ZXNzYWdlPSdjcmVhdG9yX2ludmFsaWRfdGltZScsZXJyY29kZT0nUDAwMDEnO2VuZDsKIGlmIG9jY3VycmVkIGlzIG51bGwgb3Ig
bm90IGlzZmluaXRlKG9jY3VycmVkKXRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2NyZWF0b3JfaW52YWxpZF90
aW1lJyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogaWYgZHJhZnQgPyAnbm90ZSdhbmQganNvbmJfdHlwZW9mKGRyYWZ0LT4nbm90
ZScpaXMgZGlzdGluY3QgZnJvbSdzdHJpbmcnb3IgbGVuZ3RoKGNvYWxlc2NlKGRyYWZ0LT4+J25vdGUnLCcnKSk+NTAwIHRoZW4g
cmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2NyZWF0b3JfaW52YWxpZF9ub3RlJyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlm
OwogaWYgZHJhZnQgPyAnZWRnZUJhc2lzJ29yIGRyYWZ0ID8gJ2NvbnRyYVNuYXBzaG90J3RoZW4KICBpZiBkcmFmdC0+PidlZGdl
QmFzaXMnaXMgZGlzdGluY3QgZnJvbSduZXQnb3IganNvbmJfdHlwZW9mKGRyYWZ0LT4nY29udHJhU25hcHNob3QnKWlzIGRpc3Rp
bmN0IGZyb20nb2JqZWN0J29yIGNvYWxlc2NlKGRyYWZ0LT4nY29udHJhU25hcHNob3QnLT4+J3JldmlzaW9uJywnJykhfideW2Et
ZjAtOV17NjR9JCdvciBleGlzdHMoc2VsZWN0IDEgZnJvbSBqc29uYl9vYmplY3Rfa2V5cyhkcmFmdC0+J2NvbnRyYVNuYXBzaG90
JylrIHdoZXJlIGsgbm90IGluKCdyZXZpc2lvbicsJ2Rpc3BsYXlDdXJyZW5jeScpKXRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5n
IG1lc3NhZ2U9J2ludmFsaWRfY29udHJhX3NuYXBzaG90JyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogZW5kIGlmOwogbGlua3M6
PWNvYWxlc2NlKGRyYWZ0LT4nb3duQWNjb3VudExpbmtzJywnW10nOjpqc29uYik7CiBpZiBqc29uYl90eXBlb2YobGlua3MpaXMg
ZGlzdGluY3QgZnJvbSdhcnJheSdvciBqc29uYl9hcnJheV9sZW5ndGgobGlua3MpPjUwIHRoZW4gcmFpc2UgZXhjZXB0aW9uIHVz
aW5nIG1lc3NhZ2U9J2NyZWF0b3JfaW52YWxpZF9hY2NvdW50X2xpbmsnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiBmb3IgbGlu
ayBpbiBzZWxlY3QgcSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKGxpbmtzKXEgbG9vcAogIGlmIGpzb25iX3R5cGVvZihsaW5r
KWlzIGRpc3RpbmN0IGZyb20nb2JqZWN0J29yIGNvYWxlc2NlKGxpbmstPj4ncGF5bWVudElkJywnJykhfideW0EtWmEtejAtOV8t
XXsxLDgwfSQnb3IgY29hbGVzY2UobGluay0+PidhY2NvdW50SWQnLCcnKSF+KideWzAtOWEtZl17OH0tWzAtOWEtZl17NH0tWzAt
OWEtZl17NH0tWzAtOWEtZl17NH0tWzAtOWEtZl17MTJ9JCdvciBleGlzdHMoc2VsZWN0IDEgZnJvbSBqc29uYl9vYmplY3Rfa2V5
cyhsaW5rKWsgd2hlcmUgayBub3QgaW4oJ3BheW1lbnRJZCcsJ2FjY291bnRJZCcpKXRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5n
IG1lc3NhZ2U9J2NyZWF0b3JfaW52YWxpZF9hY2NvdW50X2xpbmsnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiBlbmQgbG9vcDsK
IGlmKHNlbGVjdCBjb3VudCgqKWZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMobGlua3MpKTw+KHNlbGVjdCBjb3VudChkaXN0aW5j
dCBxLT4+J3BheW1lbnRJZCcpZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhsaW5rcylxKXRoZW4gcmFpc2UgZXhjZXB0aW9uIHVz
aW5nIG1lc3NhZ2U9J2NyZWF0b3JfaW52YWxpZF9hY2NvdW50X2xpbmsnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiBzZWxlY3Qg
Y29hbGVzY2UoanNvbmJfYWdnKGpzb25iX2J1aWxkX29iamVjdCgncGF5bWVudElkJyxxLT4+J3BheW1lbnRJZCcsJ2FjY291bnRJ
ZCcsbG93ZXIocS0+PidhY2NvdW50SWQnKSlvcmRlciBieSBxLT4+J3BheW1lbnRJZCcpLCdbXSc6Ompzb25iKWludG8gbGlua3Mg
ZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhsaW5rcylxOwogaWYgZHJhZnQgPyAncmVwbGFjZW1lbnRGb3IndGhlbgogIGJlZ2lu
IHJlcGxhY2VtZW50Oj0oZHJhZnQtPj4ncmVwbGFjZW1lbnRGb3InKTo6dXVpZDtleGNlcHRpb24gd2hlbiBvdGhlcnMgdGhlbiBy
YWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0nY3JlYXRvcl9pbnZhbGlkX3JlcGxhY2VtZW50JyxlcnJjb2RlPSdQMDAwMSc7
ZW5kOwogIGlmIHJlcGxhY2VtZW50IGlzIG51bGwgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0nY3JlYXRvcl9p
bnZhbGlkX3JlcGxhY2VtZW50JyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogZW5kIGlmOwogcmVzdWx0Oj0oZHJhZnQtJ29jY3Vy
cmVkQXQnLSdub3RlJy0nb3duQWNjb3VudExpbmtzJy0ncmVwbGFjZW1lbnRGb3InKXx8anNvbmJfYnVpbGRfb2JqZWN0KCdvY2N1
cnJlZEF0Jyx0b19jaGFyKG9jY3VycmVkIGF0IHRpbWUgem9uZSAnVVRDJywnWVlZWS1NTS1ERCJUIkhIMjQ6TUk6U1MuVVMiWiIn
KSwnbm90ZScsYnRyaW0oY29hbGVzY2UoZHJhZnQtPj4nbm90ZScsJycpKSwnb3duQWNjb3VudExpbmtzJyxsaW5rcyk7CiBpZiBy
ZXBsYWNlbWVudCBpcyBub3QgbnVsbCB0aGVuIHJlc3VsdDo9cmVzdWx0fHxqc29uYl9idWlsZF9vYmplY3QoJ3JlcGxhY2VtZW50
Rm9yJyxyZXBsYWNlbWVudCk7ZW5kIGlmO3JldHVybiByZXN1bHQ7CmVuZCQkOwoKY3JlYXRlIG9yIHJlcGxhY2UgZnVuY3Rpb24g
cHJpdmF0ZS5jcmVhdG9yX3Bvc3QodGFyZ2V0IHV1aWQpCnJldHVybnMgdm9pZCBsYW5ndWFnZSBwbHBnc3FsIHNlY3VyaXR5IGRl
ZmluZXIgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCiN2YXJpYWJsZV9jb25mbGljdCB1c2VfdmFyaWFibGUKZGVjbGFyZSByZWMg
cHJpdmF0ZS5jcmVhdG9yX3JlY29yZHMlcm93dHlwZTtsaW5lIGpzb25iO2xlZyBqc29uYjtsaW5rIGpzb25iO3BpZCB1dWlkO2Ug
anNvbmI7c3RhdGVzIGpzb25iOj0nW10nOjpqc29uYjtwYXltZW50X2RheSBkYXRlOwpiZWdpbgogc2VsZWN0ICogaW50byByZWMg
ZnJvbSBwcml2YXRlLmNyZWF0b3JfcmVjb3JkcyByIHdoZXJlIHIuaWQ9dGFyZ2V0OwogcGF5bWVudF9kYXk6PShyZWMub2NjdXJy
ZWRfYXQgYXQgdGltZSB6b25lIHJlYy50aW1lX3pvbmUpOjpkYXRlOwogZm9yIGxpbmUgaW4gc2VsZWN0IHEgZnJvbSBqc29uYl9h
cnJheV9lbGVtZW50cyhyZWMucGxhbi0+J2xpbmVzJylxIGxvb3AKICBpbnNlcnQgaW50byBwdWJsaWMuc2V0dGxlbWVudF9wYXlt
ZW50cyhjbGllbnRfcmVxdWVzdF9pZCxzY29wZSxzcGFjZV9pZCxkZWJ0b3JfcGFydGljaXBhbnRfaWQsY3VycmVuY3ksYW1vdW50
X21pbm9yLHBheW1lbnRfZGF0ZSxzdGF0dXMsbm90ZSxmeF9jYXNoX29ubHksY2FzaF90cmFja2luZ19yZXF1aXJlZCkKICB2YWx1
ZXMocHJpdmF0ZS5tb25leV9jaGlsZF9yZXF1ZXN0KHJlYy5yZXF1ZXN0X2lkLCdjcmVhdG9yOmNhc2g6J3x8KGxpbmUtPidwYXlt
ZW50Jy0+PidpZCcpKSwnc3BhY2UnLHJlYy5zcGFjZV9pZCwobGluZS0+J3BheW1lbnQnLT4+J3BheWVyJyk6OnV1aWQsbGluZS0+
J3BheW1lbnQnLT4+J3RlbmRlckN1cnJlbmN5JywobGluZS0+J3BheW1lbnQnLT4+J3RlbmRlck1pbm9yJyk6OmJpZ2ludCxwYXlt
ZW50X2RheSwnY29uZmlybWVkJywnZngtY2FzaCcsdHJ1ZSxmYWxzZSlyZXR1cm5pbmcgaWQgaW50byBwaWQ7CiAgaW5zZXJ0IGlu
dG8gcHVibGljLnNldHRsZW1lbnRfYWxsb2NhdGlvbnMoc2V0dGxlbWVudF9wYXltZW50X2lkLGNyZWRpdG9yX3BhcnRpY2lwYW50
X2lkLGFtb3VudF9taW5vcixzdGF0ZSxyZXNwb25kZWRfYXQpdmFsdWVzKHBpZCwobGluZS0+J3BheW1lbnQnLT4+J3JlY2lwaWVu
dCcpOjp1dWlkLChsaW5lLT4ncGF5bWVudCctPj4ndGVuZGVyTWlub3InKTo6YmlnaW50LCdhY2NlcHRlZCcsbm93KCkpOwogIGlu
c2VydCBpbnRvIHByaXZhdGUuY3JlYXRvcl9yZWNlaXB0cyhyZWNvcmRfaWQscGF5bWVudF9pZCxraW5kLGxpbmVfaWQpdmFsdWVz
KHJlYy5pZCxwaWQsJ2Nhc2gnLGxpbmUtPidwYXltZW50Jy0+PidpZCcpOwogIGluc2VydCBpbnRvIHB1YmxpYy5maW5hbmNpYWxf
ZXZlbnRzKGFjdG9yX3BhcnRpY2lwYW50X2lkLHNldHRsZW1lbnRfcGF5bWVudF9pZCxldmVudF90eXBlLHNhZmVfZGlmZil2YWx1
ZXMocmVjLnJlY29yZGVkX2J5LHBpZCwnc2V0dGxlbWVudC5jcmVhdG9yX2Nhc2hfcG9zdGVkJyxqc29uYl9idWlsZF9vYmplY3Qo
J3JlY29yZF9pZCcscmVjLmlkLCdsaW5lX2lkJyxsaW5lLT4ncGF5bWVudCctPj4naWQnLCdtZXRob2QnLGxpbmUtPidwYXltZW50
Jy0+PidtZXRob2QnLCdvY2N1cnJlZF9hdCcscmVjLm9jY3VycmVkX2F0KSk7CiBlbmQgbG9vcDsKIGZvciBsZWcgaW4gc2VsZWN0
IHEgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhyZWMucGxhbi0+J25hdGl2ZScpcSBsb29wCiAgaW5zZXJ0IGludG8gcHVibGlj
LnNldHRsZW1lbnRfcGF5bWVudHMoY2xpZW50X3JlcXVlc3RfaWQsc2NvcGUsc3BhY2VfaWQsZGVidG9yX3BhcnRpY2lwYW50X2lk
LGN1cnJlbmN5LGFtb3VudF9taW5vcixwYXltZW50X2RhdGUsc3RhdHVzLG5vdGUsZnhfY2FzaF9vbmx5LGNhc2hfdHJhY2tpbmdf
cmVxdWlyZWQpCiAgdmFsdWVzKHByaXZhdGUubW9uZXlfY2hpbGRfcmVxdWVzdChyZWMucmVxdWVzdF9pZCwnY3JlYXRvcjpjb3Zl
cmFnZTonfHwobGVnLT4+J2VkZ2VJZCcpfHwnOid8fChsZWctPj4nY3VycmVuY3knKXx8JzonfHwobGVnLT4+J2Zyb20nKSksJ3Nw
YWNlJyxyZWMuc3BhY2VfaWQsKGxlZy0+Pidmcm9tJyk6OnV1aWQsbGVnLT4+J2N1cnJlbmN5JywobGVnLT4+J21pbm9yJyk6OmJp
Z2ludCxwYXltZW50X2RheSwnY29uZmlybWVkJywnZngtY292ZXJhZ2UnLGZhbHNlLGZhbHNlKXJldHVybmluZyBpZCBpbnRvIHBp
ZDsKICBpbnNlcnQgaW50byBwdWJsaWMuc2V0dGxlbWVudF9hbGxvY2F0aW9ucyhzZXR0bGVtZW50X3BheW1lbnRfaWQsY3JlZGl0
b3JfcGFydGljaXBhbnRfaWQsYW1vdW50X21pbm9yLHN0YXRlLHJlc3BvbmRlZF9hdCl2YWx1ZXMocGlkLChsZWctPj4ndG8nKTo6
dXVpZCwobGVnLT4+J21pbm9yJyk6OmJpZ2ludCwnYWNjZXB0ZWQnLG5vdygpKTsKICBpbnNlcnQgaW50byBwcml2YXRlLmNyZWF0
b3JfcmVjZWlwdHMocmVjb3JkX2lkLHBheW1lbnRfaWQsa2luZCl2YWx1ZXMocmVjLmlkLHBpZCwnY292ZXJhZ2UnKTsKICBpbnNl
cnQgaW50byBwdWJsaWMuZmluYW5jaWFsX2V2ZW50cyhhY3Rvcl9wYXJ0aWNpcGFudF9pZCxzZXR0bGVtZW50X3BheW1lbnRfaWQs
ZXZlbnRfdHlwZSxzYWZlX2RpZmYpdmFsdWVzKHJlYy5yZWNvcmRlZF9ieSxwaWQsJ3NldHRsZW1lbnQuY3JlYXRvcl9jb3ZlcmFn
ZV9wb3N0ZWQnLGpzb25iX2J1aWxkX29iamVjdCgncmVjb3JkX2lkJyxyZWMuaWQsJ2N1cnJlbmN5JyxsZWctPj4nY3VycmVuY3kn
LCdtaW5vcicsbGVnLT4nbWlub3InKXx8anNvbmJfc3RyaXBfbnVsbHMoanNvbmJfYnVpbGRfb2JqZWN0KCdhcHBsaWNhdGlvbics
bGVnLT4nYXBwbGljYXRpb24nLCdsZWRnZXJfY3VycmVuY3knLGxlZy0+J2xlZGdlckN1cnJlbmN5JywnY29udHJhX2VxdWl2YWxl
bnRfbWlub3InLGxlZy0+J2NvbnRyYUVxdWl2YWxlbnRNaW5vcicsJ3JlcGF5bWVudF9lcXVpdmFsZW50X21pbm9yJyxsZWctPidy
ZXBheW1lbnRFcXVpdmFsZW50TWlub3InLCdlZGdlX2lkJyxjYXNlIHdoZW4gbGVnID8gJ2FwcGxpY2F0aW9uJ3RoZW4gbGVnLT4n
ZWRnZUlkJ2VuZCkpKTsKIGVuZCBsb29wOwogZm9yIGxpbmsgaW4gc2VsZWN0IHEgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhy
ZWMuZHJhZnQtPidvd25BY2NvdW50TGlua3MnKXEgb3JkZXIgYnkgcS0+PidhY2NvdW50SWQnLHEtPj4ncGF5bWVudElkJ2xvb3Ag
cGVyZm9ybSBwcml2YXRlLmNyZWF0b3JfbGlua19jYXNoKHJlYy5pZCxsaW5rLT4+J3BheW1lbnRJZCcscmVjLnJlY29yZGVkX2J5
LChsaW5rLT4+J2FjY291bnRJZCcpOjp1dWlkKTtlbmQgbG9vcDsKIGZvciBlIGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlf
ZWxlbWVudHMocmVjLnBsYW4tPidzb3VyY2VzJylxIGxvb3Agc3RhdGVzOj1zdGF0ZXN8fGpzb25iX2J1aWxkX2FycmF5KHByaXZh
dGUucm91dGVkX2VkZ2UocmVjLnNwYWNlX2lkLChlLT4+J2Zyb20nKTo6dXVpZCwoZS0+Pid0bycpOjp1dWlkLChyZWMucGxhbi0+
J3JhdGUnLT4+J251bWVyYXRvcicpOjpudW1lcmljLChyZWMucGxhbi0+J3JhdGUnLT4+J2Rlbm9taW5hdG9yJyk6Om51bWVyaWMp
KTtlbmQgbG9vcDsKIHVwZGF0ZSBwcml2YXRlLmNyZWF0b3JfcmVjb3JkcyBzZXQgYWZ0ZXJfc3RhdGU9c3RhdGVzIHdoZXJlIGlk
PXJlYy5pZDsKZW5kJCQ7CgpjcmVhdGUgb3IgcmVwbGFjZSBmdW5jdGlvbiBwcml2YXRlLnBvc3Rfcm91dGVkX3Byb3Bvc2FsKHRh
cmdldCB1dWlkKQpyZXR1cm5zIHZvaWQgbGFuZ3VhZ2UgcGxwZ3NxbCBzZWN1cml0eSBkZWZpbmVyIHNldCBzZWFyY2hfcGF0aD0n
JyBhcyAkJAojdmFyaWFibGVfY29uZmxpY3QgdXNlX3ZhcmlhYmxlCmRlY2xhcmUgcCBwcml2YXRlLnRyaXBfcm91dGVkX3Byb3Bv
c2FscyVyb3d0eXBlO2xpbmUganNvbmI7bGVnIGpzb25iO3JvbGUgdGV4dDtvd25lciB1dWlkO2FjY291bnQgdXVpZDtwaWQgdXVp
ZDthaWQgdXVpZDtjYXNoX2xlZyB1dWlkO2F1dGgganNvbmI7c2F2ZWQganNvbmI7c3RhdGVzIGpzb25iOj0nW10nOjpqc29uYjtl
IGpzb25iO24gbnVtZXJpYztkIG51bWVyaWM7CmJlZ2luCiBzZWxlY3QgKiBpbnRvIHAgZnJvbSBwcml2YXRlLnRyaXBfcm91dGVk
X3Byb3Bvc2FscyB3aGVyZSBpZD10YXJnZXQ7CiAtLSBWYWxpZGF0ZSBFVkVSWSBzYXZlZCBvd25lciBhdXRob3JpemF0aW9uIGJl
Zm9yZSB0aGUgZmlyc3QgY2FzaCB3cml0ZS4KIGZvciBsaW5lIGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMo
cC5wbGFuLT4nbGluZXMnKXEgbG9vcAogIGZvciByb2xlLG93bmVyIGluIHNlbGVjdCdwYXllcicsKGxpbmUtPidwYXltZW50Jy0+
PidwYXllcicpOjp1dWlkIHVuaW9uIGFsbCBzZWxlY3QncmVjZWl2ZXInLChsaW5lLT4ncGF5bWVudCctPj4ncmVjaXBpZW50Jyk6
OnV1aWQgbG9vcAogICBzZWxlY3QgYS5hdXRob3JpemF0aW9ucy0+KChsaW5lLT4ncGF5bWVudCctPj4naWQnKXx8JzonfHxyb2xl
KWludG8gc2F2ZWQgZnJvbSBwcml2YXRlLnRyaXBfcm91dGVkX2FwcHJvdmFscyBhIHdoZXJlIGEucHJvcG9zYWw9cC5pZCBhbmQg
YS5hY3Rvcj1vd25lciBhbmQgYS5kZWNpc2lvbj0nYXBwcm92ZSc7CiAgIGF1dGg6PXByaXZhdGUudHJpcF9iYXRjaF9hY2NvdW50
KG93bmVyLChzYXZlZC0+PidpZCcpOjp1dWlkLGxpbmUtPidwYXltZW50Jy0+Pid0ZW5kZXJDdXJyZW5jeScpOwogICBpZiBzYXZl
ZCBpcyBkaXN0aW5jdCBmcm9tIGF1dGggdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0ncm91dGVkX2FjY291bnRf
Y2hhbmdlZCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKICBlbmQgbG9vcDsKIGVuZCBsb29wOwogZm9yIGxpbmUgaW4gc2VsZWN0
IHEgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhwLnBsYW4tPidsaW5lcycpcSBsb29wCiAgaW5zZXJ0IGludG8gcHVibGljLnNl
dHRsZW1lbnRfcGF5bWVudHMoY2xpZW50X3JlcXVlc3RfaWQsc2NvcGUsc3BhY2VfaWQsZGVidG9yX3BhcnRpY2lwYW50X2lkLGN1
cnJlbmN5LGFtb3VudF9taW5vcixwYXltZW50X2RhdGUsc3RhdHVzLG5vdGUsZnhfY2FzaF9vbmx5LGNhc2hfdHJhY2tpbmdfcmVx
dWlyZWQpCiAgIHZhbHVlcyhwcml2YXRlLm1vbmV5X2NoaWxkX3JlcXVlc3QocC5yZXF1ZXN0X2lkLCdyb3V0ZWQ6Y2FzaDonfHwo
bGluZS0+J3BheW1lbnQnLT4+J2lkJykpLCdzcGFjZScscC5zcGFjZV9pZCwobGluZS0+J3BheW1lbnQnLT4+J3BheWVyJyk6OnV1
aWQsbGluZS0+J3BheW1lbnQnLT4+J3RlbmRlckN1cnJlbmN5JywobGluZS0+J3BheW1lbnQnLT4+J3RlbmRlck1pbm9yJyk6OmJp
Z2ludCxjdXJyZW50X2RhdGUsJ3BlbmRpbmcnLCdmeC1jYXNoJyx0cnVlLHRydWUpcmV0dXJuaW5nIGlkIGludG8gcGlkOwogIGlu
c2VydCBpbnRvIHB1YmxpYy5zZXR0bGVtZW50X2FsbG9jYXRpb25zKHNldHRsZW1lbnRfcGF5bWVudF9pZCxjcmVkaXRvcl9wYXJ0
aWNpcGFudF9pZCxhbW91bnRfbWlub3Isc3RhdGUpdmFsdWVzKHBpZCwobGluZS0+J3BheW1lbnQnLT4+J3JlY2lwaWVudCcpOjp1
dWlkLChsaW5lLT4ncGF5bWVudCctPj4ndGVuZGVyTWlub3InKTo6YmlnaW50LCdwZW5kaW5nJylyZXR1cm5pbmcgaWQgaW50byBh
aWQ7CiAgZm9yIHJvbGUsb3duZXIgaW4gc2VsZWN0J3BheWVyJywobGluZS0+J3BheW1lbnQnLT4+J3BheWVyJyk6OnV1aWQgdW5p
b24gYWxsIHNlbGVjdCdyZWNlaXZlcicsKGxpbmUtPidwYXltZW50Jy0+PidyZWNpcGllbnQnKTo6dXVpZCBsb29wCiAgIHNlbGVj
dChhLmFjY291bnRzLT4+KChsaW5lLT4ncGF5bWVudCctPj4naWQnKXx8JzonfHxyb2xlKSk6OnV1aWQgaW50byBhY2NvdW50IGZy
b20gcHJpdmF0ZS50cmlwX3JvdXRlZF9hcHByb3ZhbHMgYSB3aGVyZSBhLnByb3Bvc2FsPXAuaWQgYW5kIGEuYWN0b3I9b3duZXI7
CiAgIGluc2VydCBpbnRvIHB1YmxpYy5wZXJzb25hbF9zZXR0bGVtZW50X2Nhc2hfbGVncyhvd25lcl9wYXJ0aWNpcGFudF9pZCxj
bGllbnRfcmVxdWVzdF9pZCxwYXlsb2FkX2ZpbmdlcnByaW50LHNldHRsZW1lbnRfcGF5bWVudF9pZCxzZXR0bGVtZW50X2FsbG9j
YXRpb25faWQscm9sZSxhY2NvdW50X2lkLGNhc2hfYW1vdW50X21pbm9yLGFjY291bnRfY3VycmVuY3ksc2hhcmVkX2Ftb3VudF9t
aW5vcixnaWZ0X2V4dHJhX21pbm9yLHN0YXR1cykKICAgIHZhbHVlcyhvd25lcixwcml2YXRlLm1vbmV5X2NoaWxkX3JlcXVlc3Qo
cC5yZXF1ZXN0X2lkLCdyb3V0ZWQ6J3x8KGxpbmUtPidwYXltZW50Jy0+PidpZCcpfHwnOid8fHJvbGUpLHByaXZhdGUucGVyc29u
YWxfcGF5bG9hZF9maW5nZXJwcmludChqc29uYl9idWlsZF9vYmplY3QoJ2FsbG9jYXRpb25faWQnLGFpZCwncm9sZScscm9sZSwn
YWNjb3VudF9pZCcsYWNjb3VudCwnY2FzaF9hbW91bnRfbWlub3InLGxpbmUtPidwYXltZW50Jy0+J3RlbmRlck1pbm9yJywnYWNj
b3VudF9jdXJyZW5jeScsbGluZS0+J3BheW1lbnQnLT4+J3RlbmRlckN1cnJlbmN5Jywnc2hhcmVkX2Ftb3VudF9taW5vcicsbGlu
ZS0+J3BheW1lbnQnLT4ndGVuZGVyTWlub3InLCdnaWZ0X2V4dHJhX21pbm9yJywwKSkscGlkLGFpZCxyb2xlLGFjY291bnQsKGxp
bmUtPidwYXltZW50Jy0+Pid0ZW5kZXJNaW5vcicpOjpiaWdpbnQsbGluZS0+J3BheW1lbnQnLT4+J3RlbmRlckN1cnJlbmN5Jywo
bGluZS0+J3BheW1lbnQnLT4+J3RlbmRlck1pbm9yJyk6OmJpZ2ludCwwLCdwZW5kaW5nJylyZXR1cm5pbmcgaWQgaW50byBjYXNo
X2xlZzsKICAgcGVyZm9ybSBwcml2YXRlLnBvc3RfcGVyc29uYWxfc2V0dGxlbWVudF9jYXNoX2xlZyhjYXNoX2xlZyk7CiAgZW5k
IGxvb3A7CiAgdXBkYXRlIHB1YmxpYy5zZXR0bGVtZW50X2FsbG9jYXRpb25zIHNldCBzdGF0ZT0nYWNjZXB0ZWQnLHJlc3BvbmRl
ZF9hdD1ub3coKXdoZXJlIGlkPWFpZDsKICB1cGRhdGUgcHVibGljLnNldHRsZW1lbnRfcGF5bWVudHMgc2V0IHN0YXR1cz0nY29u
ZmlybWVkJyx2ZXJzaW9uPXZlcnNpb24rMSB3aGVyZSBpZD1waWQ7CiAgaW5zZXJ0IGludG8gcHJpdmF0ZS50cmlwX3JvdXRlZF9y
ZWNlaXB0cyB2YWx1ZXMocC5pZCxwaWQsJ2Nhc2gnLGxpbmUtPidwYXltZW50Jy0+PidpZCcpOwogIGluc2VydCBpbnRvIHB1Ymxp
Yy5maW5hbmNpYWxfZXZlbnRzKGFjdG9yX3BhcnRpY2lwYW50X2lkLHNldHRsZW1lbnRfcGF5bWVudF9pZCxldmVudF90eXBlLHNh
ZmVfZGlmZil2YWx1ZXMocHVibGljLmN1cnJlbnRfcGFydGljaXBhbnRfaWQoKSxwaWQsJ3NldHRsZW1lbnQucm91dGVkX2Nhc2hf
cG9zdGVkJyxqc29uYl9idWlsZF9vYmplY3QoJ3Byb3Bvc2FsX2lkJyxwLmlkLCdsaW5lX2lkJyxsaW5lLT4ncGF5bWVudCctPj4n
aWQnLCdtZXRob2QnLGxpbmUtPidwYXltZW50Jy0+PidtZXRob2QnKSk7CiBlbmQgbG9vcDsKIGZvciBsZWcgaW4gc2VsZWN0IHEg
ZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhwLnBsYW4tPiduYXRpdmUnKXEgbG9vcAogIGluc2VydCBpbnRvIHB1YmxpYy5zZXR0
bGVtZW50X3BheW1lbnRzKGNsaWVudF9yZXF1ZXN0X2lkLHNjb3BlLHNwYWNlX2lkLGRlYnRvcl9wYXJ0aWNpcGFudF9pZCxjdXJy
ZW5jeSxhbW91bnRfbWlub3IscGF5bWVudF9kYXRlLHN0YXR1cyxub3RlLGZ4X2Nhc2hfb25seSxjYXNoX3RyYWNraW5nX3JlcXVp
cmVkKQogICB2YWx1ZXMocHJpdmF0ZS5tb25leV9jaGlsZF9yZXF1ZXN0KHAucmVxdWVzdF9pZCwncm91dGVkOmNvdmVyYWdlOid8
fChsZWctPj4nZWRnZUlkJyl8fCc6J3x8KGxlZy0+PidjdXJyZW5jeScpfHwnOid8fChsZWctPj4nZnJvbScpKSwnc3BhY2UnLHAu
c3BhY2VfaWQsKGxlZy0+Pidmcm9tJyk6OnV1aWQsbGVnLT4+J2N1cnJlbmN5JywobGVnLT4+J21pbm9yJyk6OmJpZ2ludCxjdXJy
ZW50X2RhdGUsJ2NvbmZpcm1lZCcsJ2Z4LWNvdmVyYWdlJyxmYWxzZSxmYWxzZSlyZXR1cm5pbmcgaWQgaW50byBwaWQ7CiAgaW5z
ZXJ0IGludG8gcHVibGljLnNldHRsZW1lbnRfYWxsb2NhdGlvbnMoc2V0dGxlbWVudF9wYXltZW50X2lkLGNyZWRpdG9yX3BhcnRp
Y2lwYW50X2lkLGFtb3VudF9taW5vcixzdGF0ZSxyZXNwb25kZWRfYXQpdmFsdWVzKHBpZCwobGVnLT4+J3RvJyk6OnV1aWQsKGxl
Zy0+PidtaW5vcicpOjpiaWdpbnQsJ2FjY2VwdGVkJyxub3coKSk7CiAgaW5zZXJ0IGludG8gcHJpdmF0ZS50cmlwX3JvdXRlZF9y
ZWNlaXB0cyB2YWx1ZXMocC5pZCxwaWQsJ2NvdmVyYWdlJyxudWxsKTsKICBpbnNlcnQgaW50byBwdWJsaWMuZmluYW5jaWFsX2V2
ZW50cyhhY3Rvcl9wYXJ0aWNpcGFudF9pZCxzZXR0bGVtZW50X3BheW1lbnRfaWQsZXZlbnRfdHlwZSxzYWZlX2RpZmYpdmFsdWVz
KHB1YmxpYy5jdXJyZW50X3BhcnRpY2lwYW50X2lkKCkscGlkLCdzZXR0bGVtZW50LnJvdXRlZF9jb3ZlcmFnZV9wb3N0ZWQnLGpz
b25iX2J1aWxkX29iamVjdCgncHJvcG9zYWxfaWQnLHAuaWQsJ2N1cnJlbmN5JyxsZWctPj4nY3VycmVuY3knLCdtaW5vcicsbGVn
LT4nbWlub3InKXx8anNvbmJfc3RyaXBfbnVsbHMoanNvbmJfYnVpbGRfb2JqZWN0KCdhcHBsaWNhdGlvbicsbGVnLT4nYXBwbGlj
YXRpb24nLCdsZWRnZXJfY3VycmVuY3knLGxlZy0+J2xlZGdlckN1cnJlbmN5JywnY29udHJhX2VxdWl2YWxlbnRfbWlub3InLGxl
Zy0+J2NvbnRyYUVxdWl2YWxlbnRNaW5vcicsJ3JlcGF5bWVudF9lcXVpdmFsZW50X21pbm9yJyxsZWctPidyZXBheW1lbnRFcXVp
dmFsZW50TWlub3InLCdlZGdlX2lkJyxjYXNlIHdoZW4gbGVnID8gJ2FwcGxpY2F0aW9uJ3RoZW4gbGVnLT4nZWRnZUlkJ2VuZCkp
KTsKIGVuZCBsb29wOwogbjo9KHAucGxhbi0+J3JhdGUnLT4+J251bWVyYXRvcicpOjpudW1lcmljO2Q6PShwLnBsYW4tPidyYXRl
Jy0+PidkZW5vbWluYXRvcicpOjpudW1lcmljOwogZm9yIGUgaW4gc2VsZWN0IHEgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhw
LnBsYW4tPidzb3VyY2VzJylxIGxvb3Agc3RhdGVzOj1zdGF0ZXN8fGpzb25iX2J1aWxkX2FycmF5KHByaXZhdGUucm91dGVkX2Vk
Z2UocC5zcGFjZV9pZCwoZS0+Pidmcm9tJyk6OnV1aWQsKGUtPj4ndG8nKTo6dXVpZCxuLGQpKTtlbmQgbG9vcDsKIHVwZGF0ZSBw
cml2YXRlLnRyaXBfcm91dGVkX3Byb3Bvc2FscyBzZXQgc3RhdHVzPSdwb3N0ZWQnLHBvc3RlZF9hdD1ub3coKSx2ZXJzaW9uPXZl
cnNpb24rMSxhZnRlcl9zdGF0ZT1zdGF0ZXMgd2hlcmUgaWQ9cC5pZDsKZW5kICQkOwoKLS0gUHJlc2VydmUgZXZlcnkgb2xkIGZy
b3plbiBwbGFuJ3MgcHJvamVjdGlvbiBhbmQgcmV2ZXJzYWwgY29udHJhY3QuCmRvICRsZWdhY3lfcHJvamVjdGlvbiQKZGVjbGFy
ZSBkZWZpbml0aW9uIHRleHQ7CmJlZ2luCiBkZWZpbml0aW9uOj1wZ19nZXRfZnVuY3Rpb25kZWYoJ3ByaXZhdGUucm91dGVkX3B1
YmxpY19wbGFuKGpzb25iKSc6OnJlZ3Byb2NlZHVyZSk7CiBleGVjdXRlIHJlcGxhY2UoZGVmaW5pdGlvbiwnRlVOQ1RJT04gcHJp
dmF0ZS5yb3V0ZWRfcHVibGljX3BsYW4oJywgJ0ZVTkNUSU9OIHByaXZhdGUucm91dGVkX3B1YmxpY19wbGFuX3YxKCcpOwplbmQK
JGxlZ2FjeV9wcm9qZWN0aW9uJDsKY3JlYXRlIGZ1bmN0aW9uIHByaXZhdGUuY29udHJhX3JlbWFpbmluZyhwbGFuIGpzb25iKQpy
ZXR1cm5zIGpzb25iIGxhbmd1YWdlIHBscGdzcWwgc3RhYmxlIHNldCBzZWFyY2hfcGF0aD0nJyBhcyAkJAojdmFyaWFibGVfY29u
ZmxpY3QgdXNlX3ZhcmlhYmxlCmRlY2xhcmUgYmFsYW5jZXMganNvbmI7cm93cyBqc29uYjo9J1tdJzo6anNvbmI7cGFpciByZWNv
cmQ7ZGV0YWlsIGpzb25iO2xlZ3MganNvbmI7cSBqc29uYjo9cGxhbi0+J2NvbnRyYVF1b3RlJzsKYmVnaW4KIHdpdGggb3JpZ2lu
YWxzIGFzKAogIHNlbGVjdCBuLT4+J2Zyb20nIGRlYnRvcixuLT4+J3RvJyBjcmVkaXRvcixuLT4+J2N1cnJlbmN5JyBjdXJyZW5j
eSxtYXgoKG4tPj4nbWlub3InKTo6YmlnaW50KSBhbW91bnQKICBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKHBsYW4tPidzb3Vy
Y2VzJylzIGNyb3NzIGpvaW4gbGF0ZXJhbCBqc29uYl9hcnJheV9lbGVtZW50cyhjb2FsZXNjZShzLT4nc3RhbmRpbmdOYXRpdmUn
LHMtPiduYXRpdmUnKSluIGdyb3VwIGJ5IDEsMiwzCiApLHJlZHVjdGlvbnMgYXMoCiAgc2VsZWN0IG4tPj4nZnJvbScgZGVidG9y
LG4tPj4ndG8nIGNyZWRpdG9yLG4tPj4nY3VycmVuY3knIGN1cnJlbmN5LHN1bSgobi0+PidtaW5vcicpOjpiaWdpbnQpOjpiaWdp
bnQgYW1vdW50IGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMocGxhbi0+J25hdGl2ZScpbiBncm91cCBieSAxLDIsMwogKXNlbGVj
dCBjb2FsZXNjZShqc29uYl9hZ2coanNvbmJfYnVpbGRfb2JqZWN0KCdmcm9tJyxvLmRlYnRvciwndG8nLG8uY3JlZGl0b3IsJ2N1
cnJlbmN5JyxvLmN1cnJlbmN5LCdtaW5vcicsby5hbW91bnQtY29hbGVzY2Uoci5hbW91bnQsMCkpb3JkZXIgYnkgby5kZWJ0b3Is
by5jcmVkaXRvcixvLmN1cnJlbmN5KSwnW10nKWludG8gYmFsYW5jZXMgZnJvbSBvcmlnaW5hbHMgbyBsZWZ0IGpvaW4gcmVkdWN0
aW9ucyByIHVzaW5nKGRlYnRvcixjcmVkaXRvcixjdXJyZW5jeSk7CiBpZiBleGlzdHMoc2VsZWN0IDEgZnJvbSBqc29uYl9hcnJh
eV9lbGVtZW50cyhiYWxhbmNlcyluIHdoZXJlKG4tPj4nbWlub3InKTo6YmlnaW50PDApdGhlbiByYWlzZSBleGNlcHRpb24gdXNp
bmcgbWVzc2FnZT0naW52YWxpZF9jb250cmFfc25hcHNob3QnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiBmb3IgcGFpciBpbiBz
ZWxlY3QgZGlzdGluY3QgbGVhc3Qobi0+Pidmcm9tJyxuLT4+J3RvJylhLGdyZWF0ZXN0KG4tPj4nZnJvbScsbi0+Pid0bycpYiBm
cm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKGJhbGFuY2VzKW4gb3JkZXIgYnkgMSwyIGxvb3AKICBzZWxlY3QgY29hbGVzY2UoanNv
bmJfYWdnKG4pLCdbXScpaW50byBsZWdzIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMoYmFsYW5jZXMpbiB3aGVyZSBuLT4+J2Zy
b20naW4ocGFpci5hLHBhaXIuYilhbmQgbi0+Pid0bydpbihwYWlyLmEscGFpci5iKTsKICBkZXRhaWw6PXByaXZhdGUuY29udHJh
X25hdGl2ZV9wYWlyKGxlZ3MscGFpci5hOjp1dWlkLHBhaXIuYjo6dXVpZCxxKTsKICBpZiBub3QoZGV0YWlsLT4+J2tub3duJyk6
OmJvb2xlYW4gdGhlbiBkZXRhaWw6PXByaXZhdGUuY29udHJhX25hdGl2ZV9wYWlyKGxlZ3MscGFpci5hOjp1dWlkLHBhaXIuYjo6
dXVpZCxxfHxqc29uYl9idWlsZF9vYmplY3QoJ2Rpc3BsYXlDdXJyZW5jeScsJ1ZORCcpKTtlbmQgaWY7CiAgaWYoZGV0YWlsLT4+
J2tub3duJyk6OmJvb2xlYW4gYW5kKGRldGFpbC0+PiduZXRNaW5vcicpOjpiaWdpbnQ+MCB0aGVuIHJvd3M6PXJvd3N8fGpzb25i
X2J1aWxkX2FycmF5KGpzb25iX2J1aWxkX29iamVjdCgnaWQnLHBhaXIuYXx8JzonfHxwYWlyLmIsJ2Zyb20nLGRldGFpbC0+J3Bh
eWVyJywndG8nLGRldGFpbC0+J3JlY2lwaWVudCcsJ2N1cnJlbmN5JyxkZXRhaWwtPidjdXJyZW5jeScsJ21pbm9yJyxkZXRhaWwt
PiduZXRNaW5vcicpKTtlbmQgaWY7CiBlbmQgbG9vcDtyZXR1cm4gcm93czsKZW5kJCQ7CmNyZWF0ZSBvciByZXBsYWNlIGZ1bmN0
aW9uIHByaXZhdGUucm91dGVkX3B1YmxpY19wbGFuKHBsYW4ganNvbmIpCnJldHVybnMganNvbmIgbGFuZ3VhZ2UgcGxwZ3NxbCBz
dGFibGUgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCmJlZ2luCiBpZiBwbGFuLT4+J2VkZ2VCYXNpcyc9J25ldCd0aGVuIHJldHVy
bihwcml2YXRlLnJvdXRlZF9wdWJsaWNfcGxhbl92MShwbGFuKS0nY29udHJhUXVvdGUnKXx8anNvbmJfYnVpbGRfb2JqZWN0KCdl
ZGdlQmFzaXMnLCduZXQnLCdyZW1haW5pbmcnLHByaXZhdGUuY29udHJhX3JlbWFpbmluZyhwbGFuKSwncmVtYWluaW5nRXN0aW1h
dGVkJyx0cnVlKTtlbmQgaWY7CiByZXR1cm4gcHJpdmF0ZS5yb3V0ZWRfcHVibGljX3BsYW5fdjEocGxhbik7CmVuZCQkOwoKcmV2
b2tlIGFsbCBvbiBmdW5jdGlvbiBwcml2YXRlLmNvbnRyYV9zaWduZWRfb3V0c3RhbmRpbmcodXVpZCx1dWlkLHV1aWQsdGV4dClm
cm9tIHB1YmxpYyxhbm9uLGF1dGhlbnRpY2F0ZWQ7CnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfbmF0aXZl
X2F1ZGl0KHV1aWQsdXVpZCx1dWlkKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFsbCBvbiBmdW5jdGlv
biBwcml2YXRlLmNvbnRyYV9xdW90ZSh0ZXh0LHRleHQsdGV4dClmcm9tIHB1YmxpYyxhbm9uLGF1dGhlbnRpY2F0ZWQ7CnJldm9r
ZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfZGlzcGxheV92YWx1ZShiaWdpbnQsdGV4dCxqc29uYilmcm9tIHB1Ymxp
Yyxhbm9uLGF1dGhlbnRpY2F0ZWQ7CnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfbmF0aXZlX3BhaXIoanNv
bmIsdXVpZCx1dWlkLGpzb25iKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBw
cml2YXRlLmNvbnRyYV9wYWlyKHV1aWQsdXVpZCx1dWlkLGpzb25iKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2
b2tlIGFsbCBvbiBmdW5jdGlvbiBwcml2YXRlLmNvbnRyYV9tYXRyaXgodXVpZCxqc29uYilmcm9tIHB1YmxpYyxhbm9uLGF1dGhl
bnRpY2F0ZWQ7CnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfZ3Jvc3NfZGlzcGxheShqc29uYix1dWlkLHV1
aWQsanNvbmIpZnJvbSBwdWJsaWMsYW5vbixhdXRoZW50aWNhdGVkOwpyZXZva2UgYWxsIG9uIGZ1bmN0aW9uIHByaXZhdGUuY29u
dHJhX25ldF9lZGdlKHV1aWQsdXVpZCx1dWlkLG51bWVyaWMsbnVtZXJpYylmcm9tIHB1YmxpYyxhbm9uLGF1dGhlbnRpY2F0ZWQ7
CnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfcmVzb2x2ZV9uYXRpdmUoanNvbmIsYmlnaW50LG51bWVyaWMs
bnVtZXJpYylmcm9tIHB1YmxpYyxhbm9uLGF1dGhlbnRpY2F0ZWQ7CnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5yb3V0
ZWRfYnVpbGRfY29yZSh1dWlkLHV1aWQsanNvbmIsYm9vbGVhbilmcm9tIHB1YmxpYyxhbm9uLGF1dGhlbnRpY2F0ZWQ7CnJldm9r
ZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5jcmVhdG9yX25vcm1hbGl6ZShqc29uYilmcm9tIHB1YmxpYyxhbm9uLGF1dGhlbnRp
Y2F0ZWQ7CnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5jcmVhdG9yX3Bvc3QodXVpZClmcm9tIHB1YmxpYyxhbm9uLGF1
dGhlbnRpY2F0ZWQ7CnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5wb3N0X3JvdXRlZF9wcm9wb3NhbCh1dWlkKWZyb20g
cHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBwcml2YXRlLmNvbnRyYV9yZW1haW5pbmco
anNvbmIpZnJvbSBwdWJsaWMsYW5vbixhdXRoZW50aWNhdGVkOwpyZXZva2UgYWxsIG9uIGZ1bmN0aW9uIHByaXZhdGUucm91dGVk
X3B1YmxpY19wbGFuKGpzb25iKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBw
cml2YXRlLnJvdXRlZF9wdWJsaWNfcGxhbl92MShqc29uYilmcm9tIHB1YmxpYyxhbm9uLGF1dGhlbnRpY2F0ZWQ7CnJldm9rZSBh
bGwgb24gZnVuY3Rpb24gcHVibGljLnJlYWRfdHJpcF9jb250cmFfc25hcHNob3QodXVpZCx0ZXh0LHRleHQsdGV4dClmcm9tIHB1
YmxpYyxhbm9uLGF1dGhlbnRpY2F0ZWQ7CmdyYW50IGV4ZWN1dGUgb24gZnVuY3Rpb24gcHVibGljLnJlYWRfdHJpcF9jb250cmFf
c25hcHNob3QodXVpZCx0ZXh0LHRleHQsdGV4dCl0byBhdXRoZW50aWNhdGVkOwpub3RpZnkgcGdyc3QsJ3JlbG9hZCBzY2hlbWEn
Owpjb21taXQ7Cg==
$contra_payload$,'base64'),'UTF8');
 if encode(extensions.digest(migration_sql,'sha256'),'hex')<>'15406177affffba1fec93bcf270866fa9444d447421f4957f97019ffee95335d'then raise exception 'Incomplete contra payload';end if;
 execute replace(regexp_replace(migration_sql,'commit;\s*$','','i'),E'begin;\n','');
 insert into supabase_migrations.schema_migrations(version,name,statements)values('202611120001','trip_bilateral_contra',array[migration_sql]);
 end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid)'))is distinct from '5d0f6a08ae247bc3f9d75e43d6ad2ade'then raise exception 'Unexpected contra function: public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid)';end if;
 if has_function_privilege('anon','public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid)','EXECUTE')or has_function_privilege('authenticated','public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.respond_fx_settlement_bundle(uuid,text,integer,uuid)'))is distinct from 'f87644372ddc6d54f8a2b20df17dd282'then raise exception 'Unexpected contra function: public.respond_fx_settlement_bundle(uuid,text,integer,uuid)';end if;
 if has_function_privilege('anon','public.respond_fx_settlement_bundle(uuid,text,integer,uuid)','EXECUTE')or has_function_privilege('authenticated','public.respond_fx_settlement_bundle(uuid,text,integer,uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.cancel_fx_settlement_bundle(uuid,integer)'))is distinct from '924ef06ac69089ea9f62194023f532b5'then raise exception 'Unexpected contra function: public.cancel_fx_settlement_bundle(uuid,integer)';end if;
 if has_function_privilege('anon','public.cancel_fx_settlement_bundle(uuid,integer)','EXECUTE')or has_function_privilege('authenticated','public.cancel_fx_settlement_bundle(uuid,integer)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.reverse_fx_settlement_bundle(uuid,uuid,integer)'))is distinct from '5b0eeb2bdab5617d1d06bbed80704664'then raise exception 'Unexpected contra function: public.reverse_fx_settlement_bundle(uuid,uuid,integer)';end if;
 if has_function_privilege('anon','public.reverse_fx_settlement_bundle(uuid,uuid,integer)','EXECUTE')or has_function_privilege('authenticated','public.reverse_fx_settlement_bundle(uuid,uuid,integer)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.fx_pair_quote(uuid,uuid,uuid,text,text,jsonb,bigint,boolean)'))is distinct from '1cae10a41b2abf0bd44670e14de14c37'then raise exception 'Unexpected contra function: private.fx_pair_quote(uuid,uuid,uuid,text,text,jsonb,bigint,boolean)';end if;
 if has_function_privilege('anon','private.fx_pair_quote(uuid,uuid,uuid,text,text,jsonb,bigint,boolean)','EXECUTE')or has_function_privilege('authenticated','private.fx_pair_quote(uuid,uuid,uuid,text,text,jsonb,bigint,boolean)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.trip_batch_account(uuid,uuid,text)'))is distinct from 'efcb29454edc9892f09345e821fbc620'then raise exception 'Unexpected contra function: private.trip_batch_account(uuid,uuid,text)';end if;
 if has_function_privilege('anon','private.trip_batch_account(uuid,uuid,text)','EXECUTE')or has_function_privilege('authenticated','private.trip_batch_account(uuid,uuid,text)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.trip_batch_review(uuid,uuid,text,text,uuid,jsonb)'))is distinct from 'f4993ca37a0cf26ecb0759bb9c48b2aa'then raise exception 'Unexpected contra function: private.trip_batch_review(uuid,uuid,text,text,uuid,jsonb)';end if;
 if has_function_privilege('anon','private.trip_batch_review(uuid,uuid,text,text,uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','private.trip_batch_review(uuid,uuid,text,text,uuid,jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.quote_trip_settlement_batch(uuid,text,text,uuid,jsonb)'))is distinct from '01c51df88f6bed7121b49e4566dacdd8'then raise exception 'Unexpected contra function: public.quote_trip_settlement_batch(uuid,text,text,uuid,jsonb)';end if;
 if has_function_privilege('anon','public.quote_trip_settlement_batch(uuid,text,text,uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','public.quote_trip_settlement_batch(uuid,text,text,uuid,jsonb)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.submit_trip_settlement_batch(uuid,uuid)'))is distinct from '4957b0614b8315b45284508fe54d4b8c'then raise exception 'Unexpected contra function: public.submit_trip_settlement_batch(uuid,uuid)';end if;
 if has_function_privilege('anon','public.submit_trip_settlement_batch(uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','public.submit_trip_settlement_batch(uuid,uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.fx_release_bundle_cash(uuid,uuid)'))is distinct from '16e38eb7d1bbd83b4044e157b1a01ec6'then raise exception 'Unexpected contra function: private.fx_release_bundle_cash(uuid,uuid)';end if;
 if has_function_privilege('anon','private.fx_release_bundle_cash(uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','private.fx_release_bundle_cash(uuid,uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.respond_fx_bundle(uuid,text,integer,jsonb,boolean)'))is distinct from 'c8006e3950ff3cba48da728d091cbe64'then raise exception 'Unexpected contra function: private.respond_fx_bundle(uuid,text,integer,jsonb,boolean)';end if;
 if has_function_privilege('anon','private.respond_fx_bundle(uuid,text,integer,jsonb,boolean)','EXECUTE')or has_function_privilege('authenticated','private.respond_fx_bundle(uuid,text,integer,jsonb,boolean)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.respond_trip_batch_child(uuid,text,integer,jsonb)'))is distinct from '44edffb1cca036e648fc9a72e9d0a9d9'then raise exception 'Unexpected contra function: public.respond_trip_batch_child(uuid,text,integer,jsonb)';end if;
 if has_function_privilege('anon','public.respond_trip_batch_child(uuid,text,integer,jsonb)','EXECUTE')or has_function_privilege('authenticated','public.respond_trip_batch_child(uuid,text,integer,jsonb)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_value(bigint,text,numeric,numeric)'))is distinct from '03a36afaaa9283132639a2a676b76b25'then raise exception 'Unexpected contra function: private.routed_value(bigint,text,numeric,numeric)';end if;
 if has_function_privilege('anon','private.routed_value(bigint,text,numeric,numeric)','EXECUTE')or has_function_privilege('authenticated','private.routed_value(bigint,text,numeric,numeric)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_edge(uuid,uuid,uuid,numeric,numeric)'))is distinct from '68b1d452b3c1b568e41adfe0ffd8bf99'then raise exception 'Unexpected contra function: private.routed_edge(uuid,uuid,uuid,numeric,numeric)';end if;
 if has_function_privilege('anon','private.routed_edge(uuid,uuid,uuid,numeric,numeric)','EXECUTE')or has_function_privilege('authenticated','private.routed_edge(uuid,uuid,uuid,numeric,numeric)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_build(uuid,uuid,jsonb)'))is distinct from 'ed0ad8532c45a7fea81b16f39861cd3a'then raise exception 'Unexpected contra function: private.routed_build(uuid,uuid,jsonb)';end if;
 if has_function_privilege('anon','private.routed_build(uuid,uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','private.routed_build(uuid,uuid,jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_public_plan(jsonb)'))is distinct from '7be87d0e3fec98d575b7e145a8c6c038'then raise exception 'Unexpected contra function: private.routed_public_plan(jsonb)';end if;
 if has_function_privilege('anon','private.routed_public_plan(jsonb)','EXECUTE')or has_function_privilege('authenticated','private.routed_public_plan(jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_digest(uuid,uuid,jsonb,jsonb,timestamptz)'))is distinct from 'bb5e9203c4c15d8a6b257179e32ce68e'then raise exception 'Unexpected contra function: private.routed_digest(uuid,uuid,jsonb,jsonb,timestamptz)';end if;
 if has_function_privilege('anon','private.routed_digest(uuid,uuid,jsonb,jsonb,timestamptz)','EXECUTE')or has_function_privilege('authenticated','private.routed_digest(uuid,uuid,jsonb,jsonb,timestamptz)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.preview_trip_routed_settlement(uuid,jsonb,timestamptz)'))is distinct from '24410c24dbf3a99fde829771e0a510b4'then raise exception 'Unexpected contra function: public.preview_trip_routed_settlement(uuid,jsonb,timestamptz)';end if;
 if has_function_privilege('anon','public.preview_trip_routed_settlement(uuid,jsonb,timestamptz)','EXECUTE')or has_function_privilege('authenticated','public.preview_trip_routed_settlement(uuid,jsonb,timestamptz)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_view(uuid)'))is distinct from '373441c8dba18449f3d787aa56c6bf60'then raise exception 'Unexpected contra function: private.routed_view(uuid)';end if;
 if has_function_privilege('anon','private.routed_view(uuid)','EXECUTE')or has_function_privilege('authenticated','private.routed_view(uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.submit_trip_routed_settlement(uuid,jsonb,uuid,text,timestamptz)'))is distinct from '056d16695ddee941aaec7dbc24e2a497'then raise exception 'Unexpected contra function: public.submit_trip_routed_settlement(uuid,jsonb,uuid,text,timestamptz)';end if;
 if has_function_privilege('anon','public.submit_trip_routed_settlement(uuid,jsonb,uuid,text,timestamptz)','EXECUTE')or has_function_privilege('authenticated','public.submit_trip_routed_settlement(uuid,jsonb,uuid,text,timestamptz)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.post_routed_proposal(uuid)'))is distinct from 'c201841ec0bc742b33ea80e4e4c9dbb5'then raise exception 'Unexpected contra function: private.post_routed_proposal(uuid)';end if;
 if has_function_privilege('anon','private.post_routed_proposal(uuid)','EXECUTE')or has_function_privilege('authenticated','private.post_routed_proposal(uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.decide_trip_routed_settlement(uuid,text,integer,jsonb)'))is distinct from '41cb2c9ea17ad1dd919a1a4900b771f6'then raise exception 'Unexpected contra function: public.decide_trip_routed_settlement(uuid,text,integer,jsonb)';end if;
 if has_function_privilege('anon','public.decide_trip_routed_settlement(uuid,text,integer,jsonb)','EXECUTE')or has_function_privilege('authenticated','public.decide_trip_routed_settlement(uuid,text,integer,jsonb)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.read_trip_routed_settlements(uuid,uuid,uuid)'))is distinct from '67095cc62a65bf5234a74cc29847f438'then raise exception 'Unexpected contra function: public.read_trip_routed_settlements(uuid,uuid,uuid)';end if;
 if has_function_privilege('anon','public.read_trip_routed_settlements(uuid,uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','public.read_trip_routed_settlements(uuid,uuid,uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.reverse_trip_routed_settlement(uuid,uuid,integer)'))is distinct from '3793f49aa0cb782733e5c46130cbe79f'then raise exception 'Unexpected contra function: public.reverse_trip_routed_settlement(uuid,uuid,integer)';end if;
 if has_function_privilege('anon','public.reverse_trip_routed_settlement(uuid,uuid,integer)','EXECUTE')or has_function_privilege('authenticated','public.reverse_trip_routed_settlement(uuid,uuid,integer)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_can_record(uuid,uuid)'))is distinct from '70c3cfc0160376f27d0fff51465c7de6'then raise exception 'Unexpected contra function: private.creator_can_record(uuid,uuid)';end if;
 if has_function_privilege('anon','private.creator_can_record(uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','private.creator_can_record(uuid,uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_policy(uuid)'))is distinct from '192682ee6c742fdf74603f9d108f0393'then raise exception 'Unexpected contra function: private.creator_policy(uuid)';end if;
 if has_function_privilege('anon','private.creator_policy(uuid)','EXECUTE')or has_function_privilege('authenticated','private.creator_policy(uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_invalidate_grants()'))is distinct from 'f3b2d1b35bb18f588b3163a953f51351'then raise exception 'Unexpected contra function: private.creator_invalidate_grants()';end if;
 if has_function_privilege('anon','private.creator_invalidate_grants()','EXECUTE')or has_function_privilege('authenticated','private.creator_invalidate_grants()','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_build_core(uuid,uuid,jsonb,boolean)'))is distinct from '38fbb6aeffb4da0119d8a82b2bc0d264'then raise exception 'Unexpected contra function: private.routed_build_core(uuid,uuid,jsonb,boolean)';end if;
 if has_function_privilege('anon','private.routed_build_core(uuid,uuid,jsonb,boolean)','EXECUTE')or has_function_privilege('authenticated','private.routed_build_core(uuid,uuid,jsonb,boolean)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.get_trip_creator_context(uuid)'))is distinct from '81fb31cba28501d68ebd035c09d4ea8c'then raise exception 'Unexpected contra function: public.get_trip_creator_context(uuid)';end if;
 if has_function_privilege('anon','public.get_trip_creator_context(uuid)','EXECUTE')or has_function_privilege('authenticated','public.get_trip_creator_context(uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.set_trip_creator_delegate(uuid,uuid,boolean,uuid,text)'))is distinct from '3cd128bd02300eb02c3806fcd0da49b4'then raise exception 'Unexpected contra function: public.set_trip_creator_delegate(uuid,uuid,boolean,uuid,text)';end if;
 if has_function_privilege('anon','public.set_trip_creator_delegate(uuid,uuid,boolean,uuid,text)','EXECUTE')or has_function_privilege('authenticated','public.set_trip_creator_delegate(uuid,uuid,boolean,uuid,text)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_normalize(jsonb)'))is distinct from '2982b9f9725d154fe02b86a891b7e280'then raise exception 'Unexpected contra function: private.creator_normalize(jsonb)';end if;
 if has_function_privilege('anon','private.creator_normalize(jsonb)','EXECUTE')or has_function_privilege('authenticated','private.creator_normalize(jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_review(uuid,uuid,jsonb,timestamptz)'))is distinct from '78941a991ae940ea799a2607c37c0db2'then raise exception 'Unexpected contra function: private.creator_review(uuid,uuid,jsonb,timestamptz)';end if;
 if has_function_privilege('anon','private.creator_review(uuid,uuid,jsonb,timestamptz)','EXECUTE')or has_function_privilege('authenticated','private.creator_review(uuid,uuid,jsonb,timestamptz)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.preview_trip_creator_settlement(uuid,jsonb)'))is distinct from 'cf4a8327dd8b68ff745bbc0bb19889c2'then raise exception 'Unexpected contra function: public.preview_trip_creator_settlement(uuid,jsonb)';end if;
 if has_function_privilege('anon','public.preview_trip_creator_settlement(uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','public.preview_trip_creator_settlement(uuid,jsonb)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_can_read(uuid,uuid)'))is distinct from '1988d36d5dcdc102bfd6d9bc6424d481'then raise exception 'Unexpected contra function: private.creator_can_read(uuid,uuid)';end if;
 if has_function_privilege('anon','private.creator_can_read(uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','private.creator_can_read(uuid,uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_view(uuid,uuid)'))is distinct from '5d31d355d82db8ce6b2fbe243a53ed38'then raise exception 'Unexpected contra function: private.creator_view(uuid,uuid)';end if;
 if has_function_privilege('anon','private.creator_view(uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','private.creator_view(uuid,uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.read_trip_creator_settlements(uuid,uuid,uuid)'))is distinct from 'da99c06f5eedf326b9783701df4887db'then raise exception 'Unexpected contra function: public.read_trip_creator_settlements(uuid,uuid,uuid)';end if;
 if has_function_privilege('anon','public.read_trip_creator_settlements(uuid,uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','public.read_trip_creator_settlements(uuid,uuid,uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_link_cash(uuid,text,uuid,uuid)'))is distinct from '057cd54a1892787514e1200aa4cc9b63'then raise exception 'Unexpected contra function: private.creator_link_cash(uuid,text,uuid,uuid)';end if;
 if has_function_privilege('anon','private.creator_link_cash(uuid,text,uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','private.creator_link_cash(uuid,text,uuid,uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_post(uuid)'))is distinct from 'bbf588a6f4fdf52293f46c1e9cee18a4'then raise exception 'Unexpected contra function: private.creator_post(uuid)';end if;
 if has_function_privilege('anon','private.creator_post(uuid)','EXECUTE')or has_function_privilege('authenticated','private.creator_post(uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.creator_notify(uuid,text,uuid,text,uuid)'))is distinct from 'fcba22dc9e443aeebe36fcdd49d9543d'then raise exception 'Unexpected contra function: private.creator_notify(uuid,text,uuid,text,uuid)';end if;
 if has_function_privilege('anon','private.creator_notify(uuid,text,uuid,text,uuid)','EXECUTE')or has_function_privilege('authenticated','private.creator_notify(uuid,text,uuid,text,uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.record_trip_creator_settlement(uuid,jsonb,uuid,text,timestamptz,boolean)'))is distinct from '344e9b8b2edc7109164763f7fc306519'then raise exception 'Unexpected contra function: public.record_trip_creator_settlement(uuid,jsonb,uuid,text,timestamptz,boolean)';end if;
 if has_function_privilege('anon','public.record_trip_creator_settlement(uuid,jsonb,uuid,text,timestamptz,boolean)','EXECUTE')or has_function_privilege('authenticated','public.record_trip_creator_settlement(uuid,jsonb,uuid,text,timestamptz,boolean)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.link_trip_creator_account(uuid,text,uuid,uuid,integer)'))is distinct from '31f133cd92bf781480c6736a77890b43'then raise exception 'Unexpected contra function: public.link_trip_creator_account(uuid,text,uuid,uuid,integer)';end if;
 if has_function_privilege('anon','public.link_trip_creator_account(uuid,text,uuid,uuid,integer)','EXECUTE')or has_function_privilege('authenticated','public.link_trip_creator_account(uuid,text,uuid,uuid,integer)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.request_trip_creator_correction(uuid,uuid,text)'))is distinct from '437fa552a830dd269681efa27f14b7e9'then raise exception 'Unexpected contra function: public.request_trip_creator_correction(uuid,uuid,text)';end if;
 if has_function_privilege('anon','public.request_trip_creator_correction(uuid,uuid,text)','EXECUTE')or has_function_privilege('authenticated','public.request_trip_creator_correction(uuid,uuid,text)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.resolve_trip_creator_correction(uuid,uuid,integer,text,uuid)'))is distinct from 'b3067ae790c3ee90846134ddfbf8214e'then raise exception 'Unexpected contra function: public.resolve_trip_creator_correction(uuid,uuid,integer,text,uuid)';end if;
 if has_function_privilege('anon','public.resolve_trip_creator_correction(uuid,uuid,integer,text,uuid)','EXECUTE')or has_function_privilege('authenticated','public.resolve_trip_creator_correction(uuid,uuid,integer,text,uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.reverse_trip_creator_settlement(uuid,uuid,integer,text)'))is distinct from '4ed00031ecbdd343aefb451147078f74'then raise exception 'Unexpected contra function: public.reverse_trip_creator_settlement(uuid,uuid,integer,text)';end if;
 if has_function_privilege('anon','public.reverse_trip_creator_settlement(uuid,uuid,integer,text)','EXECUTE')or has_function_privilege('authenticated','public.reverse_trip_creator_settlement(uuid,uuid,integer,text)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.deliver_creator_notices(uuid,integer)'))is distinct from 'e17d9be5f189efc186a4290ed51222ce'then raise exception 'Unexpected contra function: private.deliver_creator_notices(uuid,integer)';end if;
 if has_function_privilege('anon','private.deliver_creator_notices(uuid,integer)','EXECUTE')or has_function_privilege('authenticated','private.deliver_creator_notices(uuid,integer)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.can_read_creator_settlement_notice(uuid)'))is distinct from 'bf01da7e411a566fb06135ba55dbf085'then raise exception 'Unexpected contra function: public.can_read_creator_settlement_notice(uuid)';end if;
 if has_function_privilege('anon','public.can_read_creator_settlement_notice(uuid)','EXECUTE')or has_function_privilege('authenticated','public.can_read_creator_settlement_notice(uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.get_creator_settlement_notifications(uuid)'))is distinct from '8bb456cf6bd621443b5273524b3889ee'then raise exception 'Unexpected contra function: public.get_creator_settlement_notifications(uuid)';end if;
 if has_function_privilege('anon','public.get_creator_settlement_notifications(uuid)','EXECUTE')or has_function_privilege('authenticated','public.get_creator_settlement_notifications(uuid)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_public_plan_v1(jsonb)'))is distinct from '532e3731690e7acf89f8e25080dfb2ca'then raise exception 'Unexpected contra function: private.routed_public_plan_v1(jsonb)';end if;
 if has_function_privilege('anon','private.routed_public_plan_v1(jsonb)','EXECUTE')or has_function_privilege('authenticated','private.routed_public_plan_v1(jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_signed_outstanding(uuid,uuid,uuid,text)'))is distinct from '6951d609cc188609862ab2570a9b9f8f'then raise exception 'Unexpected contra function: private.contra_signed_outstanding(uuid,uuid,uuid,text)';end if;
 if has_function_privilege('anon','private.contra_signed_outstanding(uuid,uuid,uuid,text)','EXECUTE')or has_function_privilege('authenticated','private.contra_signed_outstanding(uuid,uuid,uuid,text)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_native_audit(uuid,uuid,uuid)'))is distinct from '07e50c132b61d3492ab72bf7281341df'then raise exception 'Unexpected contra function: private.contra_native_audit(uuid,uuid,uuid)';end if;
 if has_function_privilege('anon','private.contra_native_audit(uuid,uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','private.contra_native_audit(uuid,uuid,uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_quote(text,text,text)'))is distinct from '77a3db15ed0b7845c50f6ec319546ea1'then raise exception 'Unexpected contra function: private.contra_quote(text,text,text)';end if;
 if has_function_privilege('anon','private.contra_quote(text,text,text)','EXECUTE')or has_function_privilege('authenticated','private.contra_quote(text,text,text)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_display_value(bigint,text,jsonb)'))is distinct from 'e9bfb19398fa109b7b6ae47891d75717'then raise exception 'Unexpected contra function: private.contra_display_value(bigint,text,jsonb)';end if;
 if has_function_privilege('anon','private.contra_display_value(bigint,text,jsonb)','EXECUTE')or has_function_privilege('authenticated','private.contra_display_value(bigint,text,jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_native_pair(jsonb,uuid,uuid,jsonb)'))is distinct from 'dd1d8fa5b9ebb010426ba155b53902d2'then raise exception 'Unexpected contra function: private.contra_native_pair(jsonb,uuid,uuid,jsonb)';end if;
 if has_function_privilege('anon','private.contra_native_pair(jsonb,uuid,uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','private.contra_native_pair(jsonb,uuid,uuid,jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_pair(uuid,uuid,uuid,jsonb)'))is distinct from '09774ab67d7e5c5b2adfc6ee49381889'then raise exception 'Unexpected contra function: private.contra_pair(uuid,uuid,uuid,jsonb)';end if;
 if has_function_privilege('anon','private.contra_pair(uuid,uuid,uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','private.contra_pair(uuid,uuid,uuid,jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_matrix(uuid,jsonb)'))is distinct from 'de5ab8526d6778f509889b226d248307'then raise exception 'Unexpected contra function: private.contra_matrix(uuid,jsonb)';end if;
 if has_function_privilege('anon','private.contra_matrix(uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','private.contra_matrix(uuid,jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.read_trip_contra_snapshot(uuid,text,text,text)'))is distinct from 'd72db9d36b7c7b578ab0e1e83e4b8887'then raise exception 'Unexpected contra function: public.read_trip_contra_snapshot(uuid,text,text,text)';end if;
 if has_function_privilege('anon','public.read_trip_contra_snapshot(uuid,text,text,text)','EXECUTE')or has_function_privilege('authenticated','public.read_trip_contra_snapshot(uuid,text,text,text)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_gross_display(jsonb,uuid,uuid,jsonb)'))is distinct from '0dbbd617871f749c9cf73b643792c0d9'then raise exception 'Unexpected contra function: private.contra_gross_display(jsonb,uuid,uuid,jsonb)';end if;
 if has_function_privilege('anon','private.contra_gross_display(jsonb,uuid,uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','private.contra_gross_display(jsonb,uuid,uuid,jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_net_edge(uuid,uuid,uuid,numeric,numeric)'))is distinct from 'e798e6b8749bdd50a385d770ed5d594e'then raise exception 'Unexpected contra function: private.contra_net_edge(uuid,uuid,uuid,numeric,numeric)';end if;
 if has_function_privilege('anon','private.contra_net_edge(uuid,uuid,uuid,numeric,numeric)','EXECUTE')or has_function_privilege('authenticated','private.contra_net_edge(uuid,uuid,uuid,numeric,numeric)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_resolve_native(jsonb,bigint,numeric,numeric)'))is distinct from '19f13fc9bcd0d742baf4b991622d9955'then raise exception 'Unexpected contra function: private.contra_resolve_native(jsonb,bigint,numeric,numeric)';end if;
 if has_function_privilege('anon','private.contra_resolve_native(jsonb,bigint,numeric,numeric)','EXECUTE')or has_function_privilege('authenticated','private.contra_resolve_native(jsonb,bigint,numeric,numeric)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_remaining(jsonb)'))is distinct from 'bd1a4912a2ce2408b7b9f6244d429275'then raise exception 'Unexpected contra function: private.contra_remaining(jsonb)';end if;
 if has_function_privilege('anon','private.contra_remaining(jsonb)','EXECUTE')or has_function_privilege('authenticated','private.contra_remaining(jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.space_signed_outstanding(uuid,uuid,uuid,text)'))is distinct from '6951d609cc188609862ab2570a9b9f8f'then raise exception 'Unexpected contra function: private.space_signed_outstanding(uuid,uuid,uuid,text)';end if;
 if has_function_privilege('anon','private.space_signed_outstanding(uuid,uuid,uuid,text)','EXECUTE')or has_function_privilege('authenticated','private.space_signed_outstanding(uuid,uuid,uuid,text)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if exists(select 1 from unnest(array['private.contra_signed_outstanding(uuid,uuid,uuid,text)','private.contra_net_edge(uuid,uuid,uuid,numeric,numeric)','private.contra_quote(text,text,text)','private.contra_pair(uuid,uuid,uuid,jsonb)','private.contra_matrix(uuid,jsonb)','public.read_trip_contra_snapshot(uuid,text,text,text)','private.contra_native_pair(jsonb,uuid,uuid,jsonb)','private.contra_gross_display(jsonb,uuid,uuid,jsonb)','private.contra_resolve_native(jsonb,bigint,numeric,numeric)','private.contra_remaining(jsonb)','private.routed_public_plan(jsonb)'])s(sig)join pg_proc p on p.oid=to_regprocedure(s.sig)where p.provolatile<>'s')then raise exception 'Unexpected contra projection volatility';end if;
 if(select provolatile from pg_proc where oid='private.creator_normalize(jsonb)'::regprocedure)<>'s'then raise exception 'Unexpected creator normalizer volatility';end if;
end;
$contra_install$;
notify pgrst,'reload schema';
commit;
select 'TABBY_TRIP_CONTRA_INSTALL_COMPLETE_20261112' as installation_status;
