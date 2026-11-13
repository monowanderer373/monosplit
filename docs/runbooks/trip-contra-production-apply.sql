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
 -- Canonical SHA256 01fb68762483bcf42162a645c30fdab55aaf77335b59a9288841495b7ec09492
 migration_sql:=convert_from(decode($contra_payload$
LS0gRm9yd2FyZCBUcmlwIGNvbnRyYSByZWFkIG1vZGVsIGFuZCBleHBsaWNpdC1uZXQgbmF0aXZlIGNvdmVyYWdlLiBObyBoaXN0
b3J5IHJld3JpdGUuCmJlZ2luOwoKCi0tIEF1ZGl0YWJsZSBvcmlnaW5hbCBkaXJlY3Rpb25zOyByZWFkIG9ubHksIGV4Y2x1ZGVk
IGZyb20gYWxsIGNhc2ggY2FsY3VsYXRpb25zLgpjcmVhdGUgZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfbmF0aXZlX2F1ZGl0KHRy
aXAgdXVpZCxhIHV1aWQsYiB1dWlkKQpyZXR1cm5zIGpzb25iIGxhbmd1YWdlIHNxbCBzdGFibGUgc2VjdXJpdHkgZGVmaW5lciBz
ZXQgc2VhcmNoX3BhdGg9JycgYXMgJCQKIHdpdGggY29kZXMgYXMoc2VsZWN0IGRpc3RpbmN0IGN1cnJlbmN5IGZyb20gcHVibGlj
LmV4cGVuc2VzIHdoZXJlIHNjb3BlPSdzcGFjZSdhbmQgc3BhY2VfaWQ9dHJpcCBhbmQgc3RhdHVzPSdhY3RpdmUnKSxiaWxscyBh
cygKIHNlbGVjdCBjLmN1cnJlbmN5LGNvYWxlc2NlKHN1bShwcml2YXRlLnNoYXJlZF9yZXN0YXJ0X2Ftb3VudChlLmlkLGEsYixw
cml2YXRlLnNoYXJlZF9yYXdfZXhwZW5zZV9vYmxpZ2F0aW9uKGUuaWQsYSxiKSkpLDApOjpiaWdpbnQgZm9yd2FyZCxjb2FsZXNj
ZShzdW0ocHJpdmF0ZS5zaGFyZWRfcmVzdGFydF9hbW91bnQoZS5pZCxiLGEscHJpdmF0ZS5zaGFyZWRfcmF3X2V4cGVuc2Vfb2Js
aWdhdGlvbihlLmlkLGIsYSkpKSwwKTo6YmlnaW50IHJldmVyc2UgZnJvbSBjb2RlcyBjIGpvaW4gcHVibGljLmV4cGVuc2VzIGUg
b24gZS5zY29wZT0nc3BhY2UnYW5kIGUuc3BhY2VfaWQ9dHJpcCBhbmQgZS5zdGF0dXM9J2FjdGl2ZSdhbmQgZS5jdXJyZW5jeT1j
LmN1cnJlbmN5IGdyb3VwIGJ5IGMuY3VycmVuY3kKICkscmV2ZXJzYWxzIGFzKHNlbGVjdCBzZXR0bGVtZW50X2FsbG9jYXRpb25f
aWQsc3VtKGFtb3VudF9taW5vcik6OmJpZ2ludCBtaW5vciBmcm9tIHB1YmxpYy5zZXR0bGVtZW50X2FsbG9jYXRpb25fcmV2ZXJz
YWxzIGdyb3VwIGJ5IHNldHRsZW1lbnRfYWxsb2NhdGlvbl9pZCkscGFpZCBhcygKIHNlbGVjdCBwLmN1cnJlbmN5LGNvYWxlc2Nl
KHN1bShjYXNlIHdoZW4gcC5kZWJ0b3JfcGFydGljaXBhbnRfaWQ9YSB0aGVuIGNhc2Ugd2hlbiBsLnN0YXRlPSdyZXZlcnNlZCd0
aGVuIDAgZWxzZSBsLmFtb3VudF9taW5vci1jb2FsZXNjZShyLm1pbm9yLDApZW5kIGVsc2UgMCBlbmQpLDApOjpiaWdpbnQgZm9y
d2FyZCxjb2FsZXNjZShzdW0oY2FzZSB3aGVuIHAuZGVidG9yX3BhcnRpY2lwYW50X2lkPWIgdGhlbiBjYXNlIHdoZW4gbC5zdGF0
ZT0ncmV2ZXJzZWQndGhlbiAwIGVsc2UgbC5hbW91bnRfbWlub3ItY29hbGVzY2Uoci5taW5vciwwKWVuZCBlbHNlIDAgZW5kKSww
KTo6YmlnaW50IHJldmVyc2UgZnJvbSBwdWJsaWMuc2V0dGxlbWVudF9wYXltZW50cyBwIGpvaW4gcHVibGljLnNldHRsZW1lbnRf
YWxsb2NhdGlvbnMgbCBvbiBsLnNldHRsZW1lbnRfcGF5bWVudF9pZD1wLmlkIGxlZnQgam9pbiByZXZlcnNhbHMgciBvbiByLnNl
dHRsZW1lbnRfYWxsb2NhdGlvbl9pZD1sLmlkIHdoZXJlIHAuc2NvcGU9J3NwYWNlJ2FuZCBwLnNwYWNlX2lkPXRyaXAgYW5kIG5v
dCBwLmZ4X2Nhc2hfb25seSBhbmQgbC5zdGF0ZSBpbignYWNjZXB0ZWQnLCdyZXZlcnNlZCcpYW5kIG5vdCBwcml2YXRlLnNoYXJl
ZF9hbGxvY2F0aW9uX2NsZWFyZWQobC5pZClhbmQoKHAuZGVidG9yX3BhcnRpY2lwYW50X2lkPWEgYW5kIGwuY3JlZGl0b3JfcGFy
dGljaXBhbnRfaWQ9YilvcihwLmRlYnRvcl9wYXJ0aWNpcGFudF9pZD1iIGFuZCBsLmNyZWRpdG9yX3BhcnRpY2lwYW50X2lkPWEp
KWdyb3VwIGJ5IHAuY3VycmVuY3kKIClzZWxlY3QgY29hbGVzY2UoanNvbmJfYWdnKGpzb25iX2J1aWxkX29iamVjdCgnY3VycmVu
Y3knLGMuY3VycmVuY3ksJ2FCaWxscycsY29hbGVzY2UoYmkuZm9yd2FyZCwwKSwnYkJpbGxzJyxjb2FsZXNjZShiaS5yZXZlcnNl
LDApLCdhQXBwbGllZCcsY29hbGVzY2UocC5mb3J3YXJkLDApLCdiQXBwbGllZCcsY29hbGVzY2UocC5yZXZlcnNlLDApKW9yZGVy
IGJ5IGMuY3VycmVuY3kpLCdbXScpZnJvbSBjb2RlcyBjIGxlZnQgam9pbiBiaWxscyBiaSB1c2luZyhjdXJyZW5jeSlsZWZ0IGpv
aW4gcGFpZCBwIHVzaW5nKGN1cnJlbmN5KQokJDsKCgotLSBBIHJlYWQgbW9kZWwgb3ZlciBleGlzdGluZyBvcmlnaW5hbC1jdXJy
ZW5jeSBmYWN0cywgbmV2ZXIgYSBzZWNvbmQgbGVkZ2VyLgpjcmVhdGUgZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfcXVvdGUobW9k
ZSB0ZXh0LGN1c3RvbV9yYXRlIHRleHQsZGlzcGxheV9jdXJyZW5jeSB0ZXh0KQpyZXR1cm5zIGpzb25iIGxhbmd1YWdlIHBscGdz
cWwgc2VjdXJpdHkgZGVmaW5lciBzZXQgc2VhcmNoX3BhdGg9JycgYXMgJCQKI3ZhcmlhYmxlX2NvbmZsaWN0IHVzZV92YXJpYWJs
ZQpkZWNsYXJlIHNuYXBzaG90IHV1aWQ7cmF0ZXMganNvbmI7biBudW1lcmljO2QgbnVtZXJpYzsKYmVnaW4KIGlmIG1vZGUgaXMg
bnVsbCBvciBtb2RlIG5vdCBpbignc3lzdGVtJywnY3VzdG9tJylvciBwcml2YXRlLmN1cnJlbmN5X2RpZ2l0cyhkaXNwbGF5X2N1
cnJlbmN5KWlzIG51bGwgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0naW52YWxpZF9yYXRlJyxlcnJjb2RlPSdQ
MDAwMSc7ZW5kIGlmOwogc2VsZWN0IHMuaWQscy5yYXRlcyBpbnRvIHNuYXBzaG90LHJhdGVzIGZyb20gdGFiYnlfZngucmVmcmVz
aF9zdGF0ZSByIGpvaW4gdGFiYnlfZnguc25hcHNob3RzIHMgb24gcy5pZD1yLnNuYXBzaG90X2lkIHdoZXJlIHIuc2luZ2xldG9u
IGZvciBzaGFyZSBvZiByLHM7CiBpZiBtb2RlPSdjdXN0b20ndGhlbgogIGlmIGNvYWxlc2NlKGN1c3RvbV9yYXRlLCcnKSF+J15b
MC05XXsxLDEyfShcLlswLTldezEsMTJ9KT8kJ29yIGN1c3RvbV9yYXRlOjpudW1lcmljPD0wIHRoZW4gcmFpc2UgZXhjZXB0aW9u
IHVzaW5nIG1lc3NhZ2U9J2ludmFsaWRfcmF0ZScsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKICBuOj1jdXN0b21fcmF0ZTo6bnVt
ZXJpYztkOj0xOwogZWxzZSBuOj0ocmF0ZXMtPidWTkQnLT4+J2Rlbm9taW5hdG9yJyk6Om51bWVyaWM7ZDo9KHJhdGVzLT4nVk5E
Jy0+PidudW1lcmF0b3InKTo6bnVtZXJpYztlbmQgaWY7CiByZXR1cm4ganNvbmJfYnVpbGRfb2JqZWN0KCdtb2RlJyxtb2RlLCdz
bmFwc2hvdElkJyxzbmFwc2hvdCwncmF0ZXMnLGNvYWxlc2NlKHJhdGVzLCd7fSc6Ompzb25iKSwnbnVtZXJhdG9yJyxuOjp0ZXh0
LCdkZW5vbWluYXRvcicsZDo6dGV4dCwnZGlzcGxheUN1cnJlbmN5Jyx1cHBlcihkaXNwbGF5X2N1cnJlbmN5KSk7CmVuZCQkOwpj
cmVhdGUgZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfZGlzcGxheV92YWx1ZShhbW91bnQgYmlnaW50LGNvZGUgdGV4dCxxdW90ZSBq
c29uYikKcmV0dXJucyBiaWdpbnQgbGFuZ3VhZ2UgcGxwZ3NxbCBpbW11dGFibGUgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCiN2
YXJpYWJsZV9jb25mbGljdCB1c2VfdmFyaWFibGUKZGVjbGFyZSB0YXJnZXQgdGV4dDo9cXVvdGUtPj4nZGlzcGxheUN1cnJlbmN5
JztjbiBudW1lcmljO2NkIG51bWVyaWM7dG4gbnVtZXJpYzt0ZCBudW1lcmljOwpiZWdpbgogaWYgYW1vdW50PDAgb3IgYW1vdW50
PjkwMDcxOTkyNTQ3NDA5OTEgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0naW52YWxpZF9hbW91bnQnLGVycmNv
ZGU9J1AwMDAxJztlbmQgaWY7CiBpZiBjb2RlPXRhcmdldCB0aGVuIHJldHVybiBhbW91bnQ7ZW5kIGlmOwogY246PWNhc2UgY29k
ZSB3aGVuJ01ZUid0aGVuIDEgd2hlbidWTkQndGhlbihxdW90ZS0+PidudW1lcmF0b3InKTo6bnVtZXJpYyBlbHNlKHF1b3RlLT4n
cmF0ZXMnLT5jb2RlLT4+J2Rlbm9taW5hdG9yJyk6Om51bWVyaWMgZW5kOwogY2Q6PWNhc2UgY29kZSB3aGVuJ01ZUid0aGVuIDEg
d2hlbidWTkQndGhlbihxdW90ZS0+PidkZW5vbWluYXRvcicpOjpudW1lcmljIGVsc2UocXVvdGUtPidyYXRlcyctPmNvZGUtPj4n
bnVtZXJhdG9yJyk6Om51bWVyaWMgZW5kOwogdG46PWNhc2UgdGFyZ2V0IHdoZW4nTVlSJ3RoZW4gMSB3aGVuJ1ZORCd0aGVuKHF1
b3RlLT4+J251bWVyYXRvcicpOjpudW1lcmljIGVsc2UocXVvdGUtPidyYXRlcyctPnRhcmdldC0+PidkZW5vbWluYXRvcicpOjpu
dW1lcmljIGVuZDsKIHRkOj1jYXNlIHRhcmdldCB3aGVuJ01ZUid0aGVuIDEgd2hlbidWTkQndGhlbihxdW90ZS0+PidkZW5vbWlu
YXRvcicpOjpudW1lcmljIGVsc2UocXVvdGUtPidyYXRlcyctPnRhcmdldC0+PidudW1lcmF0b3InKTo6bnVtZXJpYyBlbmQ7CiBp
ZiBjbiBpcyBudWxsIG9yIGNkIGlzIG51bGwgb3IgdG4gaXMgbnVsbCBvciB0ZCBpcyBudWxsIG9yIGxlYXN0KGNuLGNkLHRuLHRk
KTw9MCB0aGVuIHJldHVybiBudWxsO2VuZCBpZjsKIHJldHVybiBwcml2YXRlLmZ4X3JvdW5kX2RpdihhbW91bnQ6Om51bWVyaWMq
KDEwOjpudW1lcmljXnByaXZhdGUuY3VycmVuY3lfZGlnaXRzKHRhcmdldCkpKmNkKnRuLCgxMDo6bnVtZXJpY15wcml2YXRlLmN1
cnJlbmN5X2RpZ2l0cyhjb2RlKSkqY24qdGQpOwplbmQkJDsKY3JlYXRlIGZ1bmN0aW9uIHByaXZhdGUuY29udHJhX25hdGl2ZV9w
YWlyKG5hdGl2ZSBqc29uYixhIHV1aWQsYiB1dWlkLHF1b3RlIGpzb25iKQpyZXR1cm5zIGpzb25iIGxhbmd1YWdlIHBscGdzcWwg
c3RhYmxlIHNldCBzZWFyY2hfcGF0aD0nJyBhcyAkJAojdmFyaWFibGVfY29uZmxpY3QgdXNlX3ZhcmlhYmxlCmRlY2xhcmUgbGVn
IGpzb25iO3ggYmlnaW50O2YgYmlnaW50Oj0nMCc6OmJpZ2ludDtyIGJpZ2ludDo9JzAnOjpiaWdpbnQ7a25vd24gYm9vbGVhbjo9
dHJ1ZTtlc3RpbWF0ZWQgYm9vbGVhbjo9ZmFsc2U7CmJlZ2luCiBmb3IgbGVnIGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlf
ZWxlbWVudHMobmF0aXZlKXEgbG9vcAogIHg6PXByaXZhdGUuY29udHJhX2Rpc3BsYXlfdmFsdWUoKGxlZy0+PidtaW5vcicpOjpi
aWdpbnQsbGVnLT4+J2N1cnJlbmN5JyxxdW90ZSk7CiAgaWYgeCBpcyBudWxsIHRoZW4ga25vd246PWZhbHNlO2Vsc2UgaWYgbGVn
LT4+J2Zyb20nPWE6OnRleHQgdGhlbiBmOj1mK3g7ZWxzZSByOj1yK3g7ZW5kIGlmO2VuZCBpZjsKICBlc3RpbWF0ZWQ6PWVzdGlt
YXRlZCBvciBsZWctPj4nY3VycmVuY3knPD5xdW90ZS0+PidkaXNwbGF5Q3VycmVuY3knOwogZW5kIGxvb3A7CiBpZiBncmVhdGVz
dChmLHIpPjkwMDcxOTkyNTQ3NDA5OTEgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0naW52YWxpZF9hbW91bnQn
LGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiByZXR1cm4ganNvbmJfYnVpbGRfb2JqZWN0KCdrbm93bicsa25vd24sJ2N1cnJlbmN5
JyxxdW90ZS0+PidkaXNwbGF5Q3VycmVuY3knLCdlc3RpbWF0ZWQnLGVzdGltYXRlZCwnYU93ZXNCJyxjYXNlIHdoZW4ga25vd24g
dGhlbiBmIGVuZCwnYk93ZXNBJyxjYXNlIHdoZW4ga25vd24gdGhlbiByIGVuZCwnY29udHJhTWlub3InLGNhc2Ugd2hlbiBrbm93
biB0aGVuIGxlYXN0KGYscillbmQsJ25ldE1pbm9yJyxjYXNlIHdoZW4ga25vd24gdGhlbiBhYnMoZi1yKWVuZCwncGF5ZXInLGNh
c2Ugd2hlbiBrbm93biBhbmQgZjw+ciB0aGVuIGNhc2Ugd2hlbiBmPnIgdGhlbiBhIGVsc2UgYiBlbmQgZW5kLCdyZWNpcGllbnQn
LGNhc2Ugd2hlbiBrbm93biBhbmQgZjw+ciB0aGVuIGNhc2Ugd2hlbiBmPnIgdGhlbiBiIGVsc2UgYSBlbmQgZW5kKTsKZW5kJCQ7
CmNyZWF0ZSBmdW5jdGlvbiBwcml2YXRlLmNvbnRyYV9wYWlyKHRyaXAgdXVpZCxhIHV1aWQsYiB1dWlkLHF1b3RlIGpzb25iKQpy
ZXR1cm5zIGpzb25iIGxhbmd1YWdlIHBscGdzcWwgc2VjdXJpdHkgZGVmaW5lciBzZXQgc2VhcmNoX3BhdGg9JycgYXMgJCQKI3Zh
cmlhYmxlX2NvbmZsaWN0IHVzZV92YXJpYWJsZQpkZWNsYXJlIG5hdGl2ZSBqc29uYjo9J1tdJzo6anNvbmI7YXZhaWxhYmxlIGpz
b25iOj0nW10nOjpqc29uYjtjb2RlIHRleHQ7c2lnbmVkIGJpZ2ludDtob2xkIGJpZ2ludDtyZWFkeSBib29sZWFuOj10cnVlO2hl
bGQgYm9vbGVhbjo9ZmFsc2U7bGVnIGpzb25iO2xlZGdlciBqc29uYjthdmFpbGFibGVfbGVkZ2VyIGpzb25iO2F1ZGl0IGpzb25i
O2Rpc3BsYXkganNvbmI7Z3Jvc3NfZGlzcGxheSBqc29uYjsKYmVnaW4KIGZvciBjb2RlIGluIHNlbGVjdCBkaXN0aW5jdCBlLmN1
cnJlbmN5IGZyb20gcHVibGljLmV4cGVuc2VzIGUgd2hlcmUgZS5zcGFjZV9pZD10cmlwIGFuZCBlLnNjb3BlPSdzcGFjZSdhbmQg
ZS5zdGF0dXM9J2FjdGl2ZSdvcmRlciBieSBlLmN1cnJlbmN5IGxvb3AKICBzaWduZWQ6PXByaXZhdGUuc3BhY2Vfc2lnbmVkX291
dHN0YW5kaW5nKHRyaXAsYSxiLGNvZGUpOwogIGlmIHNpZ25lZDw+MCB0aGVuCiAgIGxlZzo9anNvbmJfYnVpbGRfb2JqZWN0KCdm
cm9tJyxjYXNlIHdoZW4gc2lnbmVkPjAgdGhlbiBhIGVsc2UgYiBlbmQsJ3RvJyxjYXNlIHdoZW4gc2lnbmVkPjAgdGhlbiBiIGVs
c2UgYSBlbmQsJ2N1cnJlbmN5Jyxjb2RlLCdtaW5vcicsYWJzKHNpZ25lZCkpO25hdGl2ZTo9bmF0aXZlfHxqc29uYl9idWlsZF9h
cnJheShsZWcpOwogICBob2xkOj1wcml2YXRlLnBlbmRpbmdfcGFpcl9taW5vcih0cmlwLChsZWctPj4nZnJvbScpOjp1dWlkLChs
ZWctPj4ndG8nKTo6dXVpZCxjb2RlKTtoZWxkOj1oZWxkIG9yIGhvbGQ+MDsKICAgYXZhaWxhYmxlOj1hdmFpbGFibGV8fGpzb25i
X2J1aWxkX2FycmF5KGxlZ3x8anNvbmJfYnVpbGRfb2JqZWN0KCdtaW5vcicsZ3JlYXRlc3QoYWJzKHNpZ25lZCktaG9sZCwwKSkp
OwoKICBlbmQgaWY7CiBlbmQgbG9vcDsKIC0tIEEgcGVuZGluZyByZXNlcnZhdGlvbiBuZXZlciBpbnZlbnRzIGEgcmV2ZXJzZSBv
YmxpZ2F0aW9uIG9yIGNoYW5nZXMgc3RhbmRpbmcuCiByZWFkeTo9ZXhpc3RzKHNlbGVjdCAxIGZyb20gcHVibGljLnNwYWNlX21l
bWJlcnMgbSB3aGVyZSBtLnNwYWNlX2lkPXRyaXAgYW5kIG0ucGFydGljaXBhbnRfaWQ9YSBhbmQgbS5yZW1vdmVkX2F0IGlzIG51
bGwpYW5kIGV4aXN0cyhzZWxlY3QgMSBmcm9tIHB1YmxpYy5zcGFjZV9tZW1iZXJzIG0gd2hlcmUgbS5zcGFjZV9pZD10cmlwIGFu
ZCBtLnBhcnRpY2lwYW50X2lkPWIgYW5kIG0ucmVtb3ZlZF9hdCBpcyBudWxsKTsKIGF1ZGl0Oj1wcml2YXRlLmNvbnRyYV9uYXRp
dmVfYXVkaXQodHJpcCxhLGIpO2Rpc3BsYXk6PXByaXZhdGUuY29udHJhX25hdGl2ZV9wYWlyKG5hdGl2ZSxhLGIscXVvdGUpO2dy
b3NzX2Rpc3BsYXk6PXByaXZhdGUuY29udHJhX2dyb3NzX2Rpc3BsYXkoYXVkaXQsYSxiLHF1b3RlKTsKIGlmIG5vdCBjb2FsZXNj
ZSgoZGlzcGxheS0+Pidrbm93bicpOjpib29sZWFuIGFuZChncm9zc19kaXNwbGF5LT4+J2tub3duJyk6OmJvb2xlYW4gYW5kIGRp
c3BsYXktPiduZXRNaW5vcic9Z3Jvc3NfZGlzcGxheS0+J25ldE1pbm9yJ2FuZCBkaXNwbGF5LT4ncGF5ZXInPWdyb3NzX2Rpc3Bs
YXktPidwYXllcicsZmFsc2UpdGhlbiBncm9zc19kaXNwbGF5Oj1udWxsO2VuZCBpZjsKIGxlZGdlcjo9cHJpdmF0ZS5jb250cmFf
bmF0aXZlX3BhaXIobmF0aXZlLGEsYixxdW90ZXx8anNvbmJfYnVpbGRfb2JqZWN0KCdkaXNwbGF5Q3VycmVuY3knLCdNWVInKSk7
YXZhaWxhYmxlX2xlZGdlcjo9cHJpdmF0ZS5jb250cmFfbmF0aXZlX3BhaXIoYXZhaWxhYmxlLGEsYixxdW90ZXx8anNvbmJfYnVp
bGRfb2JqZWN0KCdkaXNwbGF5Q3VycmVuY3knLCdNWVInKSk7CiByZXR1cm4ganNvbmJfYnVpbGRfb2JqZWN0KCdpZCcsYTo6dGV4
dHx8JzonfHxiOjp0ZXh0LCdhJyxhLCdiJyxiLCdlZGdlQmFzaXMnLCduZXQnLCduYXRpdmVCYXNpcycsJ3NhbWVfY3VycmVuY3lf
bmV0JywnbmF0aXZlJyxuYXRpdmUsJ2F2YWlsYWJsZU5hdGl2ZScsYXZhaWxhYmxlLCdkaXNwbGF5JyxkaXNwbGF5LCdncm9zc0Rp
c3BsYXknLGdyb3NzX2Rpc3BsYXksJ2xlZGdlckN1cnJlbmN5JywnTVlSJywnbGVkZ2VyJyxsZWRnZXIsJ25ldE1pbm9yJyxsZWRn
ZXItPiduZXRNaW5vcicsJ3BheWVyJyxsZWRnZXItPidwYXllcicsJ3JlY2lwaWVudCcsbGVkZ2VyLT4ncmVjaXBpZW50JywnYXZh
aWxhYmxlTWlub3InLGNhc2Ugd2hlbiByZWFkeSBhbmQgbm90IGhlbGQgYW5kKGxlZGdlci0+Pidrbm93bicpOjpib29sZWFuIGFu
ZChhdmFpbGFibGVfbGVkZ2VyLT4+J2tub3duJyk6OmJvb2xlYW4gYW5kIGxlZGdlci0+PidwYXllcic9YXZhaWxhYmxlX2xlZGdl
ci0+PidwYXllcid0aGVuIGxlYXN0KChsZWRnZXItPj4nbmV0TWlub3InKTo6YmlnaW50LChhdmFpbGFibGVfbGVkZ2VyLT4+J25l
dE1pbm9yJyk6OmJpZ2ludCllbHNlIDAgZW5kLCdwZW5kaW5nJyxoZWxkLCdjdXJyZW50TWVtYmVycycscmVhZHksJ2F1ZGl0Jyxh
dWRpdCwnc291cmNlVmVyc2lvbnMnLHByaXZhdGUuZnhfcGFpcl9leHBlbnNlX3ZlcnNpb25zKHRyaXAsYSxiKSk7CmVuZCQkOwpj
cmVhdGUgZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfbWF0cml4KHRyaXAgdXVpZCxxdW90ZSBqc29uYikKcmV0dXJucyBqc29uYiBs
YW5ndWFnZSBwbHBnc3FsIHNlY3VyaXR5IGRlZmluZXIgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCiN2YXJpYWJsZV9jb25mbGlj
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
dWFnZSBwbHBnc3FsIHNlY3VyaXR5IGRlZmluZXIgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCiN2YXJpYWJsZV9jb25mbGljdCB1
c2VfdmFyaWFibGUKZGVjbGFyZSBhY3RvciB1dWlkOj1wcml2YXRlLnJlcXVpcmVfcGVyc29uYWxfYWN0b3IoKTtyZXN1bHQganNv
bmI7d2hvbGUgYm9vbGVhbjsKYmVnaW4KIGlmIHByaXZhdGUuc3BhY2Vfcm9sZSh0YXJnZXRfc3BhY2VfaWQsYWN0b3IpaXMgbnVs
bCBvciBub3QgZXhpc3RzKHNlbGVjdCAxIGZyb20gcHVibGljLnNwYWNlcyBzIHdoZXJlIHMuaWQ9dGFyZ2V0X3NwYWNlX2lkIGFu
ZCBzLnR5cGU9J3RyaXAnYW5kIHMuc3RhdHVzPD4ndm9pZGVkJyl0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdz
cGFjZV9tZW1iZXJzaGlwX3JlcXVpcmVkJyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogcGVyZm9ybSBwcml2YXRlLmxvY2tfY29s
bGVjdF9wYXlfYmFsYW5jZSgpO3Jlc3VsdDo9cHJpdmF0ZS5jb250cmFfbWF0cml4KHRhcmdldF9zcGFjZV9pZCxwcml2YXRlLmNv
bnRyYV9xdW90ZShyYXRlX21vZGUsdm5kX3Blcl9teXIsZGlzcGxheV9jdXJyZW5jeSkpO3dob2xlOj1wcml2YXRlLmNyZWF0b3Jf
Y2FuX3JlY29yZCh0YXJnZXRfc3BhY2VfaWQsYWN0b3IpOwogaWYgbm90IHdob2xlIHRoZW4gcmVzdWx0Oj1yZXN1bHR8fGpzb25i
X2J1aWxkX29iamVjdCgncGFpcnMnLChzZWxlY3QgY29hbGVzY2UoanNvbmJfYWdnKHEpLCdbXScpZnJvbSBqc29uYl9hcnJheV9l
bGVtZW50cyhyZXN1bHQtPidwYWlycycpcSB3aGVyZSBhY3Rvcjo6dGV4dCBpbihxLT4+J2EnLHEtPj4nYicpKSk7ZW5kIGlmOwog
cmV0dXJuIHJlc3VsdHx8anNvbmJfYnVpbGRfb2JqZWN0KCd2aWV3ZXInLGFjdG9yLCdjYW5SZWNvcmQnLHdob2xlKTsKZW5kJCQ7
CgoKY3JlYXRlIGZ1bmN0aW9uIHByaXZhdGUuY29udHJhX2dyb3NzX2Rpc3BsYXkoYXVkaXQganNvbmIsYSB1dWlkLGIgdXVpZCxx
dW90ZSBqc29uYikKcmV0dXJucyBqc29uYiBsYW5ndWFnZSBwbHBnc3FsIHN0YWJsZSBzZXQgc2VhcmNoX3BhdGg9JycgYXMgJCQK
I3ZhcmlhYmxlX2NvbmZsaWN0IHVzZV92YXJpYWJsZQpkZWNsYXJlIHJvdyBqc29uYjtuYXRpdmUganNvbmI6PSdbXSc6Ompzb25i
O2YgYmlnaW50O3IgYmlnaW50OwpiZWdpbgogZm9yIHJvdyBpbiBzZWxlY3QgcSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKGF1
ZGl0KXEgbG9vcAogIGY6PShyb3ctPj4nYUJpbGxzJyk6OmJpZ2ludC0ocm93LT4+J2FBcHBsaWVkJyk6OmJpZ2ludDtyOj0ocm93
LT4+J2JCaWxscycpOjpiaWdpbnQtKHJvdy0+PidiQXBwbGllZCcpOjpiaWdpbnQ7CiAgbmF0aXZlOj1uYXRpdmV8fGpzb25iX2J1
aWxkX2FycmF5KGpzb25iX2J1aWxkX29iamVjdCgnZnJvbScsYSwndG8nLGIsJ2N1cnJlbmN5Jyxyb3ctPj4nY3VycmVuY3knLCdt
aW5vcicsZ3JlYXRlc3QoZiwwKStncmVhdGVzdCgtciwwKSksanNvbmJfYnVpbGRfb2JqZWN0KCdmcm9tJyxiLCd0bycsYSwnY3Vy
cmVuY3knLHJvdy0+PidjdXJyZW5jeScsJ21pbm9yJyxncmVhdGVzdChyLDApK2dyZWF0ZXN0KC1mLDApKSk7CiBlbmQgbG9vcDty
ZXR1cm4gcHJpdmF0ZS5jb250cmFfbmF0aXZlX3BhaXIobmF0aXZlLGEsYixxdW90ZSk7CmVuZCQkOwoKCi0tIE5ldyBuZXQgbW9k
ZSB1c2VzIHRoZSBvdmVydmlldydzIE1ZUiBtaW5vciB1bml0IGFuZCB0aGUgZXhpc3Rpbmcgb3JpZ2luYWwtCi0tIGN1cnJlbmN5
IGNvbnRyYS9yZXBheW1lbnQgY292ZXJhZ2UgbW9kZWwuIENhc2ggYWx3YXlzIGtlZXBzIGl0cyBhY3R1YWwgY3VycmVuY3kuCmNy
ZWF0ZSBmdW5jdGlvbiBwcml2YXRlLmNvbnRyYV92YWx1ZShhbW91bnQgYmlnaW50LGNvZGUgdGV4dCxuIG51bWVyaWMsZCBudW1l
cmljKQpyZXR1cm5zIGJpZ2ludCBsYW5ndWFnZSBwbHBnc3FsIGltbXV0YWJsZSBzZXQgc2VhcmNoX3BhdGg9JycgYXMgJCQKYmVn
aW4KIGlmIGFtb3VudDwwIG9yIGFtb3VudD45MDA3MTk5MjU0NzQwOTkxIG9yIGNvZGUgbm90IGluKCdNWVInLCdWTkQnKXRoZW4g
cmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2ludmFsaWRfYW1vdW50JyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogaWYg
Y29kZT0nTVlSJ3RoZW4gcmV0dXJuIGFtb3VudDtlbmQgaWY7CiBpZiBuIGlzIG51bGwgb3IgZCBpcyBudWxsIG9yIGxlYXN0KG4s
ZCk8PTAgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0nZnhfcmF0ZV91bmF2YWlsYWJsZScsZXJyY29kZT0nUDAw
MDEnO2VuZCBpZjsKIHJldHVybiBwcml2YXRlLmZ4X3JvdW5kX2RpdihhbW91bnQ6Om51bWVyaWMqMTAwKmQsbik7CmVuZCQkOwpj
cmVhdGUgZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfbmV0X2VkZ2UodHJpcCB1dWlkLGRlYnRvciB1dWlkLGNyZWRpdG9yIHV1aWQs
biBudW1lcmljLGQgbnVtZXJpYykKcmV0dXJucyBqc29uYiBsYW5ndWFnZSBwbHBnc3FsIHNlY3VyaXR5IGRlZmluZXIgc2V0IHNl
YXJjaF9wYXRoPScnIGFzICQkCiN2YXJpYWJsZV9jb25mbGljdCB1c2VfdmFyaWFibGUKZGVjbGFyZSBwYWlyIGpzb25iO3EganNv
bmI7CmJlZ2luCiBxOj1qc29uYl9idWlsZF9vYmplY3QoJ251bWVyYXRvcicsbjo6dGV4dCwnZGVub21pbmF0b3InLGQ6OnRleHQs
J2Rpc3BsYXlDdXJyZW5jeScsJ01ZUicsJ3JhdGVzJywne30nOjpqc29uYik7cGFpcjo9cHJpdmF0ZS5jb250cmFfcGFpcih0cmlw
LGRlYnRvcixjcmVkaXRvcixxKTsKIHJldHVybiBqc29uYl9idWlsZF9vYmplY3QoJ2lkJyxkZWJ0b3I6OnRleHR8fCc6J3x8Y3Jl
ZGl0b3I6OnRleHQsJ2Zyb20nLGRlYnRvciwndG8nLGNyZWRpdG9yLCdtaW5vcicsY2FzZSB3aGVuIHBhaXItPj4ncGF5ZXInPWRl
YnRvcjo6dGV4dCB0aGVuIHBhaXItPidhdmFpbGFibGVNaW5vcidlbHNlJzAnOjpqc29uYiBlbmQsJ25hdGl2ZScscGFpci0+J2F2
YWlsYWJsZU5hdGl2ZScsJ3N0YW5kaW5nTmF0aXZlJyxwYWlyLT4nbmF0aXZlJywnZXhwZW5zZXMnLHBhaXItPidzb3VyY2VWZXJz
aW9ucycpOwplbmQkJDsKY3JlYXRlIGZ1bmN0aW9uIHByaXZhdGUuY29udHJhX3Jlc29sdmVfbmF0aXZlKGVkZ2UganNvbmIsYW1v
dW50IGJpZ2ludCxuIG51bWVyaWMsZCBudW1lcmljKQpyZXR1cm5zIGpzb25iIGxhbmd1YWdlIHBscGdzcWwgc3RhYmxlIHNldCBz
ZWFyY2hfcGF0aD0nJyBhcyAkJAojdmFyaWFibGVfY29uZmxpY3QgdXNlX3ZhcmlhYmxlCmRlY2xhcmUgbGVnIGpzb25iO3dvcmsg
anNvbmI6PSdbXSc6Ompzb25iO291dCBqc29uYjo9J1tdJzo6anNvbmI7dXBkYXRlZCBqc29uYjtvcmlnaW5hbCBiaWdpbnQ7Y292
ZXJlZCBiaWdpbnQ7cmVtYWluaW5nIGJpZ2ludDtiZWZvcmVfdmFsdWUgYmlnaW50O2FmdGVyX3ZhbHVlIGJpZ2ludDtkZWx0YSBi
aWdpbnQ7bmV0X2RlbHRhIGJpZ2ludDo9JzAnOjpiaWdpbnQ7ZGlmZmVyZW5jZSBiaWdpbnQ7d2FudGVkIGJpZ2ludDtsbyBiaWdp
bnQ7aGkgYmlnaW50O3NpZ251bSBpbnQ7b3Bwb3NpdGUgYmlnaW50Oj0nMCc6OmJpZ2ludDtjb250cmEgYmlnaW50OwpiZWdpbgog
aWYgYW1vdW50PDAgb3IgYW1vdW50PihlZGdlLT4+J21pbm9yJyk6OmJpZ2ludCB0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBt
ZXNzYWdlPSdpbnZhbGlkX3JvdXRlZF9hbW91bnQnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiBpZiBhbW91bnQ9MCB0aGVuIHJl
dHVybidbXSc6Ompzb25iO2VuZCBpZjsKIGZvciBsZWcgaW4gc2VsZWN0IHEgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhlZGdl
LT4nbmF0aXZlJylxIG9yZGVyIGJ5IHEtPj4nY3VycmVuY3knLHEtPj4nZnJvbSdsb29wCiAgb3JpZ2luYWw6PShsZWctPj4nbWlu
b3InKTo6YmlnaW50OwogIGNvdmVyZWQ6PWNhc2Ugd2hlbiBhbW91bnQ9KGVkZ2UtPj4nbWlub3InKTo6YmlnaW50IHRoZW4gb3Jp
Z2luYWwgZWxzZSBsZWFzdChvcmlnaW5hbCxwcml2YXRlLmZ4X3JvdW5kX2RpdihvcmlnaW5hbDo6bnVtZXJpYyphbW91bnQsKGVk
Z2UtPj4nbWlub3InKTo6bnVtZXJpYykpZW5kOwogIGJlZm9yZV92YWx1ZTo9cHJpdmF0ZS5jb250cmFfdmFsdWUob3JpZ2luYWws
bGVnLT4+J2N1cnJlbmN5JyxuLGQpO2FmdGVyX3ZhbHVlOj1wcml2YXRlLmNvbnRyYV92YWx1ZShvcmlnaW5hbC1jb3ZlcmVkLGxl
Zy0+PidjdXJyZW5jeScsbixkKTtkZWx0YTo9YmVmb3JlX3ZhbHVlLWFmdGVyX3ZhbHVlOwogIHNpZ251bTo9Y2FzZSB3aGVuIGxl
Zy0+Pidmcm9tJz1lZGdlLT4+J2Zyb20ndGhlbiAxIGVsc2UtMSBlbmQ7bmV0X2RlbHRhOj1uZXRfZGVsdGErc2lnbnVtKmRlbHRh
OwogIHdvcms6PXdvcmt8fGpzb25iX2J1aWxkX2FycmF5KGxlZ3x8anNvbmJfYnVpbGRfb2JqZWN0KCdvcmlnaW5hbCcsb3JpZ2lu
YWwsJ21pbm9yJyxjb3ZlcmVkLCdiZWZvcmUnLGJlZm9yZV92YWx1ZSwnZGVsdGEnLGRlbHRhLCdzaWdudW0nLHNpZ251bSkpOwog
ZW5kIGxvb3A7CiAtLSBRdWFudGl6ZSBhZ2FpbnN0IGJlZm9yZS9hZnRlciBhdXRob3JpdGF0aXZlIGJhbGFuY2VzLCBub3QgYSBz
aWxlbnQgdG9sZXJhbmNlLgogLS0gQSBzaW5nbGUgbmF0aXZlIHF1YW50dW0gaXMgc2VsZWN0ZWQgb25seSB3aGVuIGl0IGV4cGxh
aW5zIHRoZSBleGFjdCBNWVIgZGVsdGEuCiBkaWZmZXJlbmNlOj1hbW91bnQtbmV0X2RlbHRhOwogZm9yIGxlZyBpbiBzZWxlY3Qg
cSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKHdvcmspcSBvcmRlciBieSBjYXNlIHdoZW4gcS0+PidjdXJyZW5jeSc9J01ZUid0
aGVuIDAgZWxzZSAxIGVuZCxxLT4+J2Zyb20nbG9vcAogIGV4aXQgd2hlbiBkaWZmZXJlbmNlPTA7c2lnbnVtOj0obGVnLT4+J3Np
Z251bScpOjppbnQ7b3JpZ2luYWw6PShsZWctPj4nb3JpZ2luYWwnKTo6YmlnaW50O3JlbWFpbmluZzo9b3JpZ2luYWwtKGxlZy0+
PidtaW5vcicpOjpiaWdpbnQ7CiAgd2FudGVkOj0obGVnLT4+J2JlZm9yZScpOjpiaWdpbnQtKChsZWctPj4nZGVsdGEnKTo6Ymln
aW50K3NpZ251bSpkaWZmZXJlbmNlKTsKICBpZiB3YW50ZWQ8MCB0aGVuIGNvbnRpbnVlO2VuZCBpZjsKICBpZiBsZWctPj4nY3Vy
cmVuY3knPSdNWVIndGhlbiBsbzo9d2FudGVkO2hpOj13YW50ZWQ7CiAgZWxzZSBsbzo9Z3JlYXRlc3QoMCxjZWlsKCh3YW50ZWQ6
Om51bWVyaWMtMC41KSpuLygxMDAqZCkpOjpiaWdpbnQpO2hpOj1jZWlsKCh3YW50ZWQ6Om51bWVyaWMrMC41KSpuLygxMDAqZCkp
OjpiaWdpbnQtMTtlbmQgaWY7CiAgbG86PWdyZWF0ZXN0KGxvLDApO2hpOj1sZWFzdChoaSxvcmlnaW5hbCk7aWYgbG8+aGkgdGhl
biBjb250aW51ZTtlbmQgaWY7CiAgcmVtYWluaW5nOj1sZWFzdChncmVhdGVzdChyZW1haW5pbmcsbG8pLGhpKTtpZiBwcml2YXRl
LmNvbnRyYV92YWx1ZShyZW1haW5pbmcsbGVnLT4+J2N1cnJlbmN5JyxuLGQpPD53YW50ZWQgdGhlbiBjb250aW51ZTtlbmQgaWY7
CiAgZGVsdGE6PShsZWctPj4nYmVmb3JlJyk6OmJpZ2ludC13YW50ZWQ7dXBkYXRlZDo9bGVnfHxqc29uYl9idWlsZF9vYmplY3Qo
J21pbm9yJyxvcmlnaW5hbC1yZW1haW5pbmcsJ2RlbHRhJyxkZWx0YSk7CiAgc2VsZWN0IGpzb25iX2FnZyhjYXNlIHdoZW4gcS0+
Pidmcm9tJz1sZWctPj4nZnJvbSdhbmQgcS0+PidjdXJyZW5jeSc9bGVnLT4+J2N1cnJlbmN5J3RoZW4gdXBkYXRlZCBlbHNlIHEg
ZW5kIG9yZGVyIGJ5IHEtPj4nY3VycmVuY3knLHEtPj4nZnJvbScpaW50byB3b3JrIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMo
d29yaylxOwogIG5ldF9kZWx0YTo9bmV0X2RlbHRhK3NpZ251bSooZGVsdGEtKGxlZy0+PidkZWx0YScpOjpiaWdpbnQpO2RpZmZl
cmVuY2U6PWFtb3VudC1uZXRfZGVsdGE7CiBlbmQgbG9vcDsKIGlmIGRpZmZlcmVuY2U8PjAgdGhlbiByZXR1cm4gbnVsbDtlbmQg
aWY7CiBzZWxlY3QgY29hbGVzY2Uoc3VtKChxLT4+J2RlbHRhJyk6OmJpZ2ludCksMCk6OmJpZ2ludCBpbnRvIG9wcG9zaXRlIGZy
b20ganNvbmJfYXJyYXlfZWxlbWVudHMod29yaylxIHdoZXJlKHEtPj4nc2lnbnVtJyk6OmludDwwOwogZm9yIGxlZyBpbiBzZWxl
Y3QgcSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKHdvcmspcSBvcmRlciBieSBxLT4+J2N1cnJlbmN5JyxxLT4+J2Zyb20nbG9v
cAogIGNvdmVyZWQ6PShsZWctPj4nbWlub3InKTo6YmlnaW50O2lmIGNvdmVyZWQ9MCB0aGVuIGNvbnRpbnVlO2VuZCBpZjtkZWx0
YTo9KGxlZy0+PidkZWx0YScpOjpiaWdpbnQ7CiAgaWYobGVnLT4+J3NpZ251bScpOjppbnQ8MCB0aGVuIGNvbnRyYTo9ZGVsdGE7
CiAgZWxzZSBjb250cmE6PWxlYXN0KG9wcG9zaXRlLGRlbHRhKTtvcHBvc2l0ZTo9b3Bwb3NpdGUtY29udHJhO2VuZCBpZjsKICBv
dXQ6PW91dHx8anNvbmJfYnVpbGRfYXJyYXkoKGxlZy0nb3JpZ2luYWwnLSdiZWZvcmUnLSdkZWx0YSctJ3NpZ251bScpfHxqc29u
Yl9idWlsZF9vYmplY3QoJ2VkZ2VJZCcsZWRnZS0+PidpZCcsJ2FwcGxpY2F0aW9uJyxjYXNlIHdoZW4obGVnLT4+J3NpZ251bScp
OjppbnQ8MCB0aGVuJ2NvbnRyYSd3aGVuIGNvbnRyYT4wIHRoZW4nY29udHJhX2FuZF9yZXBheW1lbnQnZWxzZSdyZXBheW1lbnQn
ZW5kLCdsZWRnZXJDdXJyZW5jeScsJ01ZUicsJ2NvbnRyYUVxdWl2YWxlbnRNaW5vcicsY29udHJhLCdyZXBheW1lbnRFcXVpdmFs
ZW50TWlub3InLGNhc2Ugd2hlbihsZWctPj4nc2lnbnVtJyk6OmludDwwIHRoZW4gMCBlbHNlIGRlbHRhLWNvbnRyYSBlbmQpKTsK
IGVuZCBsb29wO3JldHVybiBvdXQ7CmVuZCQkOwoKCmNyZWF0ZSBvciByZXBsYWNlIGZ1bmN0aW9uIHByaXZhdGUucm91dGVkX2J1
aWxkX2NvcmUoYWN0b3IgdXVpZCx0cmlwIHV1aWQsZHJhZnQganNvbmIsY3JlYXRvcl9tb2RlIGJvb2xlYW4pCnJldHVybnMganNv
bmIgbGFuZ3VhZ2UgcGxwZ3NxbCBzZWN1cml0eSBkZWZpbmVyIHNldCBzZWFyY2hfcGF0aD0nJyBhcyAkJAojdmFyaWFibGVfY29u
ZmxpY3QgdXNlX3ZhcmlhYmxlCmRlY2xhcmUgcGF5bWVudHMganNvbmI6PWRyYWZ0LT4ncGF5bWVudHMnO3AganNvbmI7bGluZSBq
c29uYjtlIGpzb25iO2xlZyBqc29uYjttZW1iZXIgdXVpZDtzZW5kZXIgdXVpZDtyZWNlaXZlciB1dWlkO3ZpYSB1dWlkO2sgdGV4
dDsKIGVkZ2VzIGpzb25iOj0ne30nOjpqc29uYjtyZXNlcnZlZCBqc29uYjo9J3t9Jzo6anNvbmI7aWRzIGpzb25iOj0ne30nOjpq
c29uYjtsZWZ0cyBqc29uYjo9J3t9Jzo6anNvbmI7dG90YWxzIGpzb25iOj0ne30nOjpqc29uYjtsaW5lcyBqc29uYjo9J1tdJzo6
anNvbmI7bmV4dF9saW5lcyBqc29uYjo9J1tdJzo6anNvbmI7aXNzdWVzIGpzb25iOj0nW10nOjpqc29uYjtuYXRpdmUganNvbmI6
PSdbXSc6Ompzb25iO3JlbWFpbmluZyBqc29uYjo9J1tdJzo6anNvbmI7YWN0b3JzIGpzb25iOj0nW10nOjpqc29uYjtzb3VyY2Vz
IGpzb25iOj0nW10nOjpqc29uYjsKIGFtb3VudCBiaWdpbnQ7dmFsdWUgYmlnaW50O3JvdXRlIGJpZ2ludDtkaXJlY3QgYmlnaW50
O3VuYXBwbGllZCBiaWdpbnQ7Y2FwIGJpZ2ludDtjb3ZlcmVkIGJpZ2ludDt0b3RhbCBiaWdpbnQ7bmV0IGJpZ2ludDsKIG4gbnVt
ZXJpYztkIG51bWVyaWM7Y2FzaF9ncm91cCByZWNvcmQ7c25hcHNob3QgdXVpZDtyYXRlcyBqc29uYjtxdW90ZSBqc29uYjttb2Rl
IHRleHQ6PWRyYWZ0LT4+J3JhdGVNb2RlJzsKIG5ldF9tb2RlIGJvb2xlYW46PWNvYWxlc2NlKGRyYWZ0LT4+J2VkZ2VCYXNpcyc9
J25ldCcsZmFsc2UpO2NxIGpzb25iO21hdHJpeCBqc29uYjtyZXNvbHZlZCBqc29uYjsKYmVnaW4KIGlmIGNyZWF0b3JfbW9kZSBh
bmQgbm90IHByaXZhdGUuY3JlYXRvcl9jYW5fcmVjb3JkKHRyaXAsYWN0b3IpdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVz
c2FnZT0nY3JlYXRvcl9wcm94eV9mb3JiaWRkZW4nLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiBpZiBhY3RvciBpcyBudWxsIG9y
IHByaXZhdGUuc3BhY2Vfcm9sZSh0cmlwLGFjdG9yKWlzIG51bGwgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0n
c2V0dGxlbWVudF9wYXJ0aWNpcGFudF9kZW5pZWQnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiBwZXJmb3JtIDEgZnJvbSBwdWJs
aWMuc3BhY2VzIHMgd2hlcmUgcy5pZD10cmlwIGFuZCBzLnR5cGU9J3RyaXAnYW5kIHMuc3RhdHVzPD4ndm9pZGVkJ2ZvciBzaGFy
ZTsKIGlmIG5vdCBmb3VuZCB0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdzZXR0bGVtZW50X3BhcnRpY2lwYW50
X2RlbmllZCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKIGlmIGRyYWZ0ID8gJ2VkZ2VCYXNpcydvciBkcmFmdCA/ICdjb250cmFT
bmFwc2hvdCd0aGVuCiAgaWYgbm90IG5ldF9tb2RlIG9yIGpzb25iX3R5cGVvZihkcmFmdC0+J2NvbnRyYVNuYXBzaG90JylpcyBk
aXN0aW5jdCBmcm9tJ29iamVjdCdvciBjb2FsZXNjZShkcmFmdC0+J2NvbnRyYVNuYXBzaG90Jy0+PidyZXZpc2lvbicsJycpIX4n
XlthLWYwLTldezY0fSQnb3IgZXhpc3RzKHNlbGVjdCAxIGZyb20ganNvbmJfb2JqZWN0X2tleXMoZHJhZnQtPidjb250cmFTbmFw
c2hvdCcpayB3aGVyZSBrIG5vdCBpbigncmV2aXNpb24nLCdkaXNwbGF5Q3VycmVuY3knKSl0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1
c2luZyBtZXNzYWdlPSdpbnZhbGlkX2NvbnRyYV9zbmFwc2hvdCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKICBjcTo9cHJpdmF0
ZS5jb250cmFfcXVvdGUobW9kZSxkcmFmdC0+Pid2bmRQZXJNeXInLGRyYWZ0LT4nY29udHJhU25hcHNob3QnLT4+J2Rpc3BsYXlD
dXJyZW5jeScpO21hdHJpeDo9cHJpdmF0ZS5jb250cmFfbWF0cml4KHRyaXAsY3EpOwogIGlmIG1hdHJpeC0+PidyZXZpc2lvbidp
cyBkaXN0aW5jdCBmcm9tIGRyYWZ0LT4nY29udHJhU25hcHNob3QnLT4+J3JldmlzaW9uJ3RoZW4gcmFpc2UgZXhjZXB0aW9uIHVz
aW5nIG1lc3NhZ2U9J2NvbnRyYV9zbmFwc2hvdF9jaGFuZ2VkJyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogZW5kIGlmOwogaWYg
bW9kZSBpcyBudWxsIG9yIG1vZGUgbm90IGluKCdzeXN0ZW0nLCdjdXN0b20nKW9yIGpzb25iX3R5cGVvZihwYXltZW50cylpcyBk
aXN0aW5jdCBmcm9tJ2FycmF5J29yIGpzb25iX2FycmF5X2xlbmd0aChwYXltZW50cylub3QgYmV0d2VlbiAxIGFuZCA1MCB0aGVu
IHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdpbnZhbGlkX2Ftb3VudCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKIGlm
IG1vZGU9J2N1c3RvbScgdGhlbgogIGlmIGNvYWxlc2NlKGRyYWZ0LT4+J3ZuZFBlck15cicsJycpIX4nXlswLTldezEsMTJ9KFwu
WzAtOV17MSwxMn0pPyQnb3IoZHJhZnQtPj4ndm5kUGVyTXlyJyk6Om51bWVyaWM8PTAgdGhlbiByYWlzZSBleGNlcHRpb24gdXNp
bmcgbWVzc2FnZT0naW52YWxpZF9yYXRlJyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogIG46PShkcmFmdC0+Pid2bmRQZXJNeXIn
KTo6bnVtZXJpYztkOj0xO3F1b3RlOj1qc29uYl9idWlsZF9vYmplY3QoJ251bWVyYXRvcicsbjo6dGV4dCwnZGVub21pbmF0b3In
LCcxJywnc291cmNlJywnY3VzdG9tJywncHJvdmlkZXInLCdDdXN0b20nKTsKIGVsc2UKICBzZWxlY3Qgci5zbmFwc2hvdF9pZCxz
LnJhdGVzIGludG8gc25hcHNob3QscmF0ZXMgZnJvbSB0YWJieV9meC5yZWZyZXNoX3N0YXRlIHIgam9pbiB0YWJieV9meC5zbmFw
c2hvdHMgcyBvbiBzLmlkPXIuc25hcHNob3RfaWQgd2hlcmUgci5zaW5nbGV0b24gZm9yIHNoYXJlIG9mIHIsczsKICBuOj0ocmF0
ZXMtPidWTkQnLT4+J2Rlbm9taW5hdG9yJyk6Om51bWVyaWM7ZDo9KHJhdGVzLT4nVk5EJy0+PidudW1lcmF0b3InKTo6bnVtZXJp
YzsKICBxdW90ZTo9anNvbmJfYnVpbGRfb2JqZWN0KCdudW1lcmF0b3InLG46OnRleHQsJ2Rlbm9taW5hdG9yJyxkOjp0ZXh0LCdz
b3VyY2UnLCdzeXN0ZW0nLCdwcm92aWRlcicscmF0ZXMtPidWTkQnLT4+J3Byb3ZpZGVyJywncmF0ZURhdGUnLHJhdGVzLT4nVk5E
Jy0+PidyYXRlRGF0ZScsJ3NuYXBzaG90SWQnLHNuYXBzaG90KTsKIGVuZCBpZjsKIGZvciBwIGluIHNlbGVjdCBxIGZyb20ganNv
bmJfYXJyYXlfZWxlbWVudHMocGF5bWVudHMpcSBvcmRlciBieSBxLT4+J2lkJ2xvb3AKICBzZW5kZXI6PShwLT4+J3BheWVyJyk6
OnV1aWQ7cmVjZWl2ZXI6PShwLT4+J3JlY2lwaWVudCcpOjp1dWlkO3ZpYTo9bnVsbGlmKHAtPid2aWEnLT4+J3BlcnNvbicsJycp
Ojp1dWlkOwogIGlmIGNvYWxlc2NlKHAtPj4naWQnLCcnKSF+J15bQS1aYS16MC05Xy1dezEsODB9JCdvciBpZHMgPyAocC0+Pidp
ZCcpb3Igc2VuZGVyIGlzIG51bGwgb3IgcmVjZWl2ZXIgaXMgbnVsbCBvciBzZW5kZXI9cmVjZWl2ZXIgb3IgKG5vdCBjcmVhdG9y
X21vZGUgYW5kIGFjdG9yIG5vdCBpbihzZW5kZXIscmVjZWl2ZXIpKW9yIHAtPj4ndGVuZGVyQ3VycmVuY3knbm90IGluKCdNWVIn
LCdWTkQnKW9yIHAtPj4nbWV0aG9kJ25vdCBpbignY2FzaCcsJ2JhbmtfdHJhbnNmZXInKXRoZW4gcmFpc2UgZXhjZXB0aW9uIHVz
aW5nIG1lc3NhZ2U9J3JvdXRlZF9wYXJ0aWNpcGFudF9kZW5pZWQnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiAgaWYgKHAtPj4n
dGVuZGVyQ3VycmVuY3knKWlzIG51bGwgb3IocC0+PidtZXRob2QnKWlzIG51bGwgb3IgY29hbGVzY2UocC0+Pid0ZW5kZXJNaW5v
cicsJycpIX4nXlswLTldezEsMTZ9JCd0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdpbnZhbGlkX2Ftb3VudCcs
ZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKICBpZHM6PWlkc3x8anNvbmJfYnVpbGRfb2JqZWN0KHAtPj4naWQnLHRydWUpO2s6PXNl
bmRlcjo6dGV4dHx8JzonfHxyZWNlaXZlcjo6dGV4dHx8JzonfHwocC0+Pid0ZW5kZXJDdXJyZW5jeScpOwogIGlmIGlkcyA/IGsg
dGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0nZHVwbGljYXRlX3RlbmRlcicsZXJyY29kZT0nUDAwMDEnO2VuZCBp
ZjtpZHM6PWlkc3x8anNvbmJfYnVpbGRfb2JqZWN0KGssdHJ1ZSk7CiAgZm9yIG1lbWJlciBpbiBzZWxlY3QgZGlzdGluY3QgeCBm
cm9tIHVubmVzdChhcnJheVtzZW5kZXIscmVjZWl2ZXIsdmlhXSl4IHdoZXJlIHggaXMgbm90IG51bGwgb3JkZXIgYnkgeCBsb29w
CiAgIHBlcmZvcm0gMSBmcm9tIHB1YmxpYy5zcGFjZV9tZW1iZXJzIHNtIGpvaW4gcHVibGljLnBhcnRpY2lwYW50cyBwdCBvbiBw
dC5pZD1zbS5wYXJ0aWNpcGFudF9pZCB3aGVyZSBzbS5zcGFjZV9pZD10cmlwIGFuZCBzbS5wYXJ0aWNpcGFudF9pZD1tZW1iZXIg
YW5kIHNtLnJlbW92ZWRfYXQgaXMgbnVsbCBhbmQgKHB0LmtpbmQ9J2FjY291bnQnb3IgY3JlYXRvcl9tb2RlIGFuZCBwdC5raW5k
PSdtYW51YWwnKWZvciBzaGFyZSBvZiBzbSxwdDsKICAgaWYgbm90IGZvdW5kIHRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1l
c3NhZ2U9J3JvdXRlZF9wYXJ0aWNpcGFudF9kZW5pZWQnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiAgIGlmIG5vdCBhY3RvcnMg
QD4ganNvbmJfYnVpbGRfYXJyYXkobWVtYmVyKXRoZW4gYWN0b3JzOj1hY3RvcnN8fGpzb25iX2J1aWxkX2FycmF5KG1lbWJlcik7
ZW5kIGlmOwogIGVuZCBsb29wOwogIGlmIHZpYSBpcyBub3QgbnVsbCBhbmQgdmlhIGluKHNlbmRlcixyZWNlaXZlcil0aGVuIHJh
aXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdpbnZhbGlkX2ludGVybWVkaWFyeScsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsK
ICAtLSBMb2FkIG9ubHkgdGhlIHNoYXJlZCBwYWlycyB1c2VkIGJ5IHRoaXMgZHJhZnQ7IHVucmVsYXRlZCBwYWlycyBuZXZlciBl
bnRlciBEVE9zLgogIGZvciBlIGluIHNlbGVjdCBqc29uYl9idWlsZF9vYmplY3QoJ2Zyb20nLHNlbmRlciwndG8nLHJlY2VpdmVy
KXVuaW9uIGFsbCBzZWxlY3QganNvbmJfYnVpbGRfb2JqZWN0KCdmcm9tJyxzZW5kZXIsJ3RvJyx2aWEpd2hlcmUgdmlhIGlzIG5v
dCBudWxsIHVuaW9uIGFsbCBzZWxlY3QganNvbmJfYnVpbGRfb2JqZWN0KCdmcm9tJyx2aWEsJ3RvJyxyZWNlaXZlcil3aGVyZSB2
aWEgaXMgbm90IG51bGwgbG9vcAogICBrOj0oZS0+Pidmcm9tJyl8fCc6J3x8KGUtPj4ndG8nKTsKICAgaWYgbm90IGVkZ2VzID8g
ayB0aGVuCiAgICBlOj1jYXNlIHdoZW4gbmV0X21vZGUgdGhlbiBwcml2YXRlLmNvbnRyYV9uZXRfZWRnZSh0cmlwLChlLT4+J2Zy
b20nKTo6dXVpZCwoZS0+Pid0bycpOjp1dWlkLG4sZCllbHNlIHByaXZhdGUucm91dGVkX2VkZ2UodHJpcCwoZS0+Pidmcm9tJyk6
OnV1aWQsKGUtPj4ndG8nKTo6dXVpZCxuLGQpZW5kO2VkZ2VzOj1lZGdlc3x8anNvbmJfYnVpbGRfb2JqZWN0KGssZSk7bGVmdHM6
PWxlZnRzfHxqc29uYl9idWlsZF9vYmplY3QoayxlLT4nbWlub3InKTsKICAgZW5kIGlmOwogIGVuZCBsb29wOwogIGFtb3VudDo9
KHAtPj4ndGVuZGVyTWlub3InKTo6YmlnaW50O2lmIGFtb3VudDw9MCB0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdl
PSdpbnZhbGlkX2Ftb3VudCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKICB2YWx1ZTo9Y2FzZSB3aGVuIG5ldF9tb2RlIHRoZW4g
cHJpdmF0ZS5jb250cmFfdmFsdWUoYW1vdW50LHAtPj4ndGVuZGVyQ3VycmVuY3knLG4sZCllbHNlIHByaXZhdGUucm91dGVkX3Zh
bHVlKGFtb3VudCxwLT4+J3RlbmRlckN1cnJlbmN5JyxuLGQpZW5kO3JvdXRlOj0wOwogIHA6PWpzb25iX3N0cmlwX251bGxzKGpz
b25iX2J1aWxkX29iamVjdCgnaWQnLHAtPj4naWQnLCdwYXllcicsc2VuZGVyLCdyZWNpcGllbnQnLHJlY2VpdmVyLCd0ZW5kZXJD
dXJyZW5jeScscC0+Pid0ZW5kZXJDdXJyZW5jeScsJ3RlbmRlck1pbm9yJyxhbW91bnQsJ21ldGhvZCcscC0+PidtZXRob2QnLCd2
aWEnLGNhc2Ugd2hlbiB2aWEgaXMgbm90IG51bGwgdGhlbiBqc29uYl9idWlsZF9vYmplY3QoJ3BlcnNvbicsdmlhKXx8Y2FzZSB3
aGVuIHAtPid2aWEnID8gJ21pbm9yJyB0aGVuIGpzb25iX2J1aWxkX29iamVjdCgnbWlub3InLHAtPid2aWEnLT4nbWlub3InKWVs
c2UgJ3t9Jzo6anNvbmIgZW5kIGVsc2UgbnVsbCBlbmQpKTsKICBpZiB2YWx1ZT0wIHRoZW4gaXNzdWVzOj1pc3N1ZXN8fGpzb25i
X2J1aWxkX2FycmF5KGpzb25iX2J1aWxkX29iamVjdCgnY29kZScsJ1pFUk9fVkFMVUUnLCdwYXltZW50SWRzJyxqc29uYl9idWls
ZF9hcnJheShwLT4+J2lkJykpKTtlbmQgaWY7CiAgaWYgdmlhIGlzIG5vdCBudWxsIHRoZW4KICAgY2FwOj1sZWFzdCh2YWx1ZSwo
ZWRnZXMtPihzZW5kZXI6OnRleHR8fCc6J3x8dmlhOjp0ZXh0KS0+PidtaW5vcicpOjpiaWdpbnQsKGVkZ2VzLT4odmlhOjp0ZXh0
fHwnOid8fHJlY2VpdmVyOjp0ZXh0KS0+PidtaW5vcicpOjpiaWdpbnQpOwogICBpZiBjYXA8PTAgdGhlbiBpc3N1ZXM6PWlzc3Vl
c3x8anNvbmJfYnVpbGRfYXJyYXkoanNvbmJfYnVpbGRfb2JqZWN0KCdjb2RlJywnTk9fT1BFTl9ST1VURScsJ3BheW1lbnRJZHMn
LGpzb25iX2J1aWxkX2FycmF5KHAtPj4naWQnKSkpO2VuZCBpZjsKICAgaWYgcC0+J3ZpYScgPyAnbWlub3InYW5kIGNvYWxlc2Nl
KHAtPid2aWEnLT4+J21pbm9yJywnJykhfideWzAtOV17MSwxNn0kJ3RoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9
J2ludmFsaWRfYW1vdW50JyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogICByb3V0ZTo9Y29hbGVzY2UoKHAtPid2aWEnLT4+J21p
bm9yJyk6OmJpZ2ludCxjYXApOwogICBpZiByb3V0ZTwwIG9yIHJvdXRlPnZhbHVlIG9yKHJvdXRlPTAgYW5kIGNhcD4wKXRoZW4g
cmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2ludmFsaWRfcm91dGVkX2Ftb3VudCcsZXJyY29kZT0nUDAwMDEnO2VuZCBp
ZjsKICAgZm9yIGsgaW4gc2VsZWN0IHNlbmRlcjo6dGV4dHx8JzonfHx2aWE6OnRleHQgdW5pb24gYWxsIHNlbGVjdCB2aWE6OnRl
eHR8fCc6J3x8cmVjZWl2ZXI6OnRleHQgbG9vcAogICAgcmVzZXJ2ZWQ6PXJlc2VydmVkfHxqc29uYl9idWlsZF9vYmplY3Qoayxj
b2FsZXNjZSgocmVzZXJ2ZWQtPj5rKTo6YmlnaW50LDApK3JvdXRlKTsKICAgIHRvdGFsczo9dG90YWxzfHxqc29uYl9idWlsZF9v
YmplY3Qoayxjb2FsZXNjZSh0b3RhbHMtPmssJ1tdJyl8fGpzb25iX2J1aWxkX2FycmF5KHAtPj4naWQnKSk7CiAgIGVuZCBsb29w
OwogIGVuZCBpZjsKICBsaW5lczo9bGluZXN8fGpzb25iX2J1aWxkX2FycmF5KGpzb25iX2J1aWxkX29iamVjdCgncGF5bWVudCcs
cCwndmFsdWVNaW5vcicsdmFsdWUsJ3ZpYU1pbm9yJyxyb3V0ZSwnZGlyZWN0TWlub3InLDAsJ3VuYXBwbGllZE1pbm9yJyx2YWx1
ZS1yb3V0ZSkpOwogZW5kIGxvb3A7CiBpZiBtb2RlPSdzeXN0ZW0nIHRoZW4KICBpZiBleGlzdHMoc2VsZWN0IDEgZnJvbSBqc29u
Yl9hcnJheV9lbGVtZW50cyhwYXltZW50cylxIHdoZXJlIHEtPj4ndGVuZGVyQ3VycmVuY3knPWNhc2Ugd2hlbiBuZXRfbW9kZSB0
aGVuJ1ZORCdlbHNlJ01ZUidlbmQpb3IgZXhpc3RzKHNlbGVjdCAxIGZyb20ganNvbmJfZWFjaChlZGdlcyllZGdlIGNyb3NzIGpv
aW4gbGF0ZXJhbCBqc29uYl9hcnJheV9lbGVtZW50cyhlZGdlLnZhbHVlLT4nbmF0aXZlJylsZWcgd2hlcmUgbGVnLT4+J2N1cnJl
bmN5Jz1jYXNlIHdoZW4gbmV0X21vZGUgdGhlbidWTkQnZWxzZSdNWVInZW5kKXRoZW4KICAgaWYgbiBpcyBudWxsIG9yIGQgaXMg
bnVsbCBvciBuPD0wIG9yIGQ8PTAgb3IgcXVvdGUtPj4ncHJvdmlkZXInaXMgbnVsbCBvciBxdW90ZS0+PidyYXRlRGF0ZSdpcyBu
dWxsIHRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2Z4X3JhdGVfdW5hdmFpbGFibGUnLGVycmNvZGU9J1AwMDAx
JztlbmQgaWY7CiAgIGlmIHNuYXBzaG90IGlzIGRpc3RpbmN0IGZyb20gbnVsbGlmKGRyYWZ0LT4+J3NuYXBzaG90SWQnLCcnKTo6
dXVpZCB0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdxdW90ZV9jaGFuZ2VkJyxlcnJjb2RlPSdQMDAwMSc7ZW5k
IGlmOwogIGVsc2Ugbjo9MTtkOj0xO3F1b3RlOj1qc29uYl9idWlsZF9vYmplY3QoJ251bWVyYXRvcicsJzEnLCdkZW5vbWluYXRv
cicsJzEnLCdzb3VyY2UnLCdpZGVudGl0eScpO2VuZCBpZjsKIGVuZCBpZjsKIC0tIEFnZ3JlZ2F0ZWQgYWN0dWFsIGNhc2ggbXVz
dCBleHBsYWluIHRoZSBzYW1lIHZhbHVlOyBzcGxpdHRpbmcgTVlSIGNlbnRzCiAtLSBhY3Jvc3MgcGF5ZWVzIG11c3Qgbm90IG1h
bnVmYWN0dXJlIGEgVk5EIG9mIGV4dHJhIG5hdGl2ZSBjb3ZlcmFnZS4KIGZvciBjYXNoX2dyb3VwIGluIHNlbGVjdCBxLT4ncGF5
bWVudCctPj4ncGF5ZXInIHBheWVyLHEtPidwYXltZW50Jy0+Pid0ZW5kZXJDdXJyZW5jeScgY29kZSxzdW0oKHEtPidwYXltZW50
Jy0+Pid0ZW5kZXJNaW5vcicpOjpiaWdpbnQpOjpiaWdpbnQgYW1vdW50LHN1bSgocS0+Pid2YWx1ZU1pbm9yJyk6OmJpZ2ludCk6
OmJpZ2ludCBlcXVpdmFsZW50LGpzb25iX2FnZyhxLT4ncGF5bWVudCctPj4naWQnKSBpZHMgZnJvbSBqc29uYl9hcnJheV9lbGVt
ZW50cyhsaW5lcylxIGdyb3VwIGJ5IDEsMiBsb29wCiAgaWYgKGNhc2Ugd2hlbiBuZXRfbW9kZSB0aGVuIHByaXZhdGUuY29udHJh
X3ZhbHVlKGNhc2hfZ3JvdXAuYW1vdW50LGNhc2hfZ3JvdXAuY29kZSxuLGQpZWxzZSBwcml2YXRlLnJvdXRlZF92YWx1ZShjYXNo
X2dyb3VwLmFtb3VudCxjYXNoX2dyb3VwLmNvZGUsbixkKWVuZCk8PmNhc2hfZ3JvdXAuZXF1aXZhbGVudCB0aGVuIGlzc3Vlczo9
aXNzdWVzfHxqc29uYl9idWlsZF9hcnJheShqc29uYl9idWlsZF9vYmplY3QoJ2NvZGUnLCdOQVRJVkVfUFJFQ0lTSU9OJywncGF5
bWVudElkcycsY2FzaF9ncm91cC5pZHMpKTtlbmQgaWY7CiBlbmQgbG9vcDsKIGZvciBrLHRvdGFsIGluIHNlbGVjdCBlbnRyeS5r
ZXksZW50cnkudmFsdWU6OnRleHQ6OmJpZ2ludCBmcm9tIGpzb25iX2VhY2gocmVzZXJ2ZWQpZW50cnkgbG9vcAogIGNhcDo9KGVk
Z2VzLT5rLT4+J21pbm9yJyk6OmJpZ2ludDsKICBpZiB0b3RhbD5jYXAgdGhlbiBpc3N1ZXM6PWlzc3Vlc3x8anNvbmJfYnVpbGRf
YXJyYXkoanNvbmJfYnVpbGRfb2JqZWN0KCdjb2RlJywnU0hBUkVEX0xJTUlUJywncGF5bWVudElkcycsdG90YWxzLT5rLCdjYXBh
Y2l0eU1pbm9yJyxjYXApKTtlbmQgaWY7CiBlbmQgbG9vcDsKIGlmIGpzb25iX2FycmF5X2xlbmd0aChpc3N1ZXMpPTAgdGhlbgog
IGZvciBrLHRvdGFsIGluIHNlbGVjdCBlbnRyeS5rZXksZW50cnkudmFsdWU6OnRleHQ6OmJpZ2ludCBmcm9tIGpzb25iX2VhY2go
cmVzZXJ2ZWQpZW50cnkgbG9vcCBsZWZ0czo9bGVmdHN8fGpzb25iX2J1aWxkX29iamVjdChrLChsZWZ0cy0+PmspOjpiaWdpbnQt
dG90YWwpO2VuZCBsb29wOwogIGZvciBsaW5lIGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMobGluZXMpcSBs
b29wCiAgIHA6PWxpbmUtPidwYXltZW50JztrOj0ocC0+PidwYXllcicpfHwnOid8fChwLT4+J3JlY2lwaWVudCcpO3VuYXBwbGll
ZDo9KGxpbmUtPj4ndW5hcHBsaWVkTWlub3InKTo6YmlnaW50OwogICBkaXJlY3Q6PWxlYXN0KHVuYXBwbGllZCwobGVmdHMtPj5r
KTo6YmlnaW50KTtsZWZ0czo9bGVmdHN8fGpzb25iX2J1aWxkX29iamVjdChrLChsZWZ0cy0+PmspOjpiaWdpbnQtZGlyZWN0KTsK
ICAgaWYgZGlyZWN0PjAgdGhlbiB0b3RhbHM6PXRvdGFsc3x8anNvbmJfYnVpbGRfb2JqZWN0KGssY29hbGVzY2UodG90YWxzLT5r
LCdbXScpfHxqc29uYl9idWlsZF9hcnJheShwLT4+J2lkJykpO2VuZCBpZjsKICAgaWYgdW5hcHBsaWVkPmRpcmVjdCB0aGVuIGlz
c3Vlczo9aXNzdWVzfHxqc29uYl9idWlsZF9hcnJheShqc29uYl9idWlsZF9vYmplY3QoJ2NvZGUnLCdVTkFQUExJRURfQ0FTSCcs
J3BheW1lbnRJZHMnLGpzb25iX2J1aWxkX2FycmF5KHAtPj4naWQnKSkpO2VuZCBpZjsKICAgbmV4dF9saW5lczo9bmV4dF9saW5l
c3x8anNvbmJfYnVpbGRfYXJyYXkobGluZXx8anNvbmJfYnVpbGRfb2JqZWN0KCdkaXJlY3RNaW5vcicsZGlyZWN0LCd1bmFwcGxp
ZWRNaW5vcicsdW5hcHBsaWVkLWRpcmVjdCkpOwogIGVuZCBsb29wO2xpbmVzOj1uZXh0X2xpbmVzOwogZW5kIGlmOwogZm9yIGss
ZSBpbiBzZWxlY3QgZW50cnkua2V5LGVudHJ5LnZhbHVlIGZyb20ganNvbmJfZWFjaChlZGdlcyllbnRyeSBvcmRlciBieSBlbnRy
eS5rZXkgbG9vcAogIHRvdGFsOj0oZS0+PidtaW5vcicpOjpiaWdpbnQtKGxlZnRzLT4+ayk6OmJpZ2ludDtuZXQ6PTA7CiAgaWYg
bmV0X21vZGUgdGhlbgogICByZXNvbHZlZDo9cHJpdmF0ZS5jb250cmFfcmVzb2x2ZV9uYXRpdmUoZSx0b3RhbCxuLGQpOwogICBp
ZiByZXNvbHZlZCBpcyBudWxsIHRoZW4gbmV0Oj0tMTtlbHNlIG5hdGl2ZTo9bmF0aXZlfHxyZXNvbHZlZDtuZXQ6PXRvdGFsO2Vu
ZCBpZjsKICBlbHNlCiAgZm9yIGxlZyBpbiBzZWxlY3QgcSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKGUtPiduYXRpdmUnKXEg
bG9vcAogICBjb3ZlcmVkOj1jYXNlIHdoZW4gdG90YWw9MCB0aGVuIDAgZWxzZSBsZWFzdCgobGVnLT4+J21pbm9yJyk6OmJpZ2lu
dCxwcml2YXRlLmZ4X3JvdW5kX2RpdigobGVnLT4+J21pbm9yJyk6Om51bWVyaWMqdG90YWwsKGUtPj4nbWlub3InKTo6bnVtZXJp
YykpZW5kOwogICBpZiBjb3ZlcmVkPjAgdGhlbiBuYXRpdmU6PW5hdGl2ZXx8anNvbmJfYnVpbGRfYXJyYXkoanNvbmJfYnVpbGRf
b2JqZWN0KCdlZGdlSWQnLGssJ2Zyb20nLGxlZy0+J2Zyb20nLCd0bycsbGVnLT4ndG8nLCdjdXJyZW5jeScsbGVnLT4nY3VycmVu
Y3knLCdtaW5vcicsY292ZXJlZCkpO2VuZCBpZjsKICAgbmV0Oj1uZXQrY2FzZSB3aGVuIGxlZy0+Pidmcm9tJz1lLT4+J2Zyb20n
dGhlbiAxIGVsc2UgLTEgZW5kKnByaXZhdGUucm91dGVkX3ZhbHVlKGNvdmVyZWQsbGVnLT4+J2N1cnJlbmN5JyxuLGQpOwogICBy
ZW1haW5pbmc6PXJlbWFpbmluZ3x8anNvbmJfYnVpbGRfYXJyYXkoanNvbmJfYnVpbGRfb2JqZWN0KCdpZCcsa3x8JzonfHwobGVn
LT4+J2N1cnJlbmN5Jyl8fCc6J3x8KGxlZy0+Pidmcm9tJyksJ2Zyb20nLGxlZy0+J2Zyb20nLCd0bycsbGVnLT4ndG8nLCdjdXJy
ZW5jeScsbGVnLT4nY3VycmVuY3knLCdtaW5vcicsKGxlZy0+PidtaW5vcicpOjpiaWdpbnQtY292ZXJlZCkpOwogIGVuZCBsb29w
OwogIGVuZCBpZjsKICAtLSBObyB1bmV4cGxhaW5lZCB0b2xlcmFuY2U6IG5hdGl2ZSBjb3ZlcmFnZSBtdXN0IGV4cGxhaW4gdGhl
IHBhaXJlZCB2YWx1ZS4KICBpZiB0b3RhbD4wIGFuZCBuZXQ8PnRvdGFsIHRoZW4gaXNzdWVzOj1pc3N1ZXN8fGpzb25iX2J1aWxk
X2FycmF5KGpzb25iX2J1aWxkX29iamVjdCgnY29kZScsJ05BVElWRV9QUkVDSVNJT04nLCdwYXltZW50SWRzJyx0b3RhbHMtPmsp
KTtlbmQgaWY7CiAgc291cmNlczo9c291cmNlc3x8anNvbmJfYnVpbGRfYXJyYXkoZSk7CiBlbmQgbG9vcDsKIGlmIGpzb25iX2Fy
cmF5X2xlbmd0aChpc3N1ZXMpPjAgdGhlbiBuYXRpdmU6PSdbXSc6Ompzb25iO3JlbWFpbmluZzo9J1tdJzo6anNvbmI7c2VsZWN0
IGpzb25iX2FnZyhxfHxqc29uYl9idWlsZF9vYmplY3QoJ3ZpYU1pbm9yJywwLCdkaXJlY3RNaW5vcicsMCwndW5hcHBsaWVkTWlu
b3InLHEtPid2YWx1ZU1pbm9yJykpaW50byBsaW5lcyBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKGxpbmVzKXE7Zm9yIGUgaW4g
c2VsZWN0IGVudHJ5LnZhbHVlIGZyb20ganNvbmJfZWFjaChlZGdlcyllbnRyeSBsb29wIHJlbWFpbmluZzo9cmVtYWluaW5nfHxl
LT4nbmF0aXZlJztlbmQgbG9vcDtlbmQgaWY7CiByZXR1cm4ganNvbmJfYnVpbGRfb2JqZWN0KCdsZWRnZXJDdXJyZW5jeScsY2Fz
ZSB3aGVuIG5ldF9tb2RlIHRoZW4nTVlSJ2Vsc2UnVk5EJ2VuZCwnbGluZXMnLGxpbmVzLCdpc3N1ZXMnLGlzc3VlcywncmVtYWlu
aW5nJyxyZW1haW5pbmcsJ3JhdGUnLHF1b3RlLCduYXRpdmUnLG5hdGl2ZSwnc291cmNlcycsc291cmNlcywnYWN0b3JzJyxhY3Rv
cnMpfHxjYXNlIHdoZW4gbmV0X21vZGUgdGhlbiBqc29uYl9idWlsZF9vYmplY3QoJ2VkZ2VCYXNpcycsJ25ldCcsJ2NvbnRyYVF1
b3RlJyxjcSllbHNlICd7fSc6Ompzb25iIGVuZDsKZW5kICQkOwoKY3JlYXRlIG9yIHJlcGxhY2UgZnVuY3Rpb24gcHJpdmF0ZS5j
cmVhdG9yX25vcm1hbGl6ZShkcmFmdCBqc29uYikKcmV0dXJucyBqc29uYiBsYW5ndWFnZSBwbHBnc3FsIHN0YWJsZSBzZXQgc2Vh
cmNoX3BhdGg9JycgYXMgJCQKI3ZhcmlhYmxlX2NvbmZsaWN0IHVzZV92YXJpYWJsZQpkZWNsYXJlIG9jY3VycmVkIHRpbWVzdGFt
cHR6O2xpbmtzIGpzb25iO2xpbmsganNvbmI7cmVzdWx0IGpzb25iO3JlcGxhY2VtZW50IHV1aWQ7CmJlZ2luCiBpZiBqc29uYl90
eXBlb2YoZHJhZnQpaXMgZGlzdGluY3QgZnJvbSdvYmplY3Qnb3IgZXhpc3RzKHNlbGVjdCAxIGZyb20ganNvbmJfb2JqZWN0X2tl
eXMoZHJhZnQpayB3aGVyZSBrIG5vdCBpbigncmF0ZU1vZGUnLCd2bmRQZXJNeXInLCdzbmFwc2hvdElkJywncGF5bWVudHMnLCdv
Y2N1cnJlZEF0Jywnbm90ZScsJ293bkFjY291bnRMaW5rcycsJ3JlcGxhY2VtZW50Rm9yJywnZWRnZUJhc2lzJywnY29udHJhU25h
cHNob3QnKSl0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdjcmVhdG9yX2ludmFsaWRfZHJhZnQnLGVycmNvZGU9
J1AwMDAxJztlbmQgaWY7CiBpZiBjb2FsZXNjZShkcmFmdC0+PidvY2N1cnJlZEF0JywnJykhfideWzAtOV17NH0tWzAtOV17Mn0t
WzAtOV17Mn1UWzAtOV17Mn06WzAtOV17Mn0oOlswLTldezJ9KFwuWzAtOV17MSw2fSk/KT8oWnxbKy1dWzAtOV17Mn06WzAtOV17
Mn0pJCd0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdjcmVhdG9yX2ludmFsaWRfdGltZScsZXJyY29kZT0nUDAw
MDEnO2VuZCBpZjsKIGJlZ2luIG9jY3VycmVkOj0oZHJhZnQtPj4nb2NjdXJyZWRBdCcpOjp0aW1lc3RhbXB0ejtleGNlcHRpb24g
d2hlbiBvdGhlcnMgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0nY3JlYXRvcl9pbnZhbGlkX3RpbWUnLGVycmNv
ZGU9J1AwMDAxJztlbmQ7CiBpZiBvY2N1cnJlZCBpcyBudWxsIG9yIG5vdCBpc2Zpbml0ZShvY2N1cnJlZCl0aGVuIHJhaXNlIGV4
Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdjcmVhdG9yX2ludmFsaWRfdGltZScsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKIGlmIGRy
YWZ0ID8gJ25vdGUnYW5kIGpzb25iX3R5cGVvZihkcmFmdC0+J25vdGUnKWlzIGRpc3RpbmN0IGZyb20nc3RyaW5nJ29yIGxlbmd0
aChjb2FsZXNjZShkcmFmdC0+Pidub3RlJywnJykpPjUwMCB0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdjcmVh
dG9yX2ludmFsaWRfbm90ZScsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKIGlmIGRyYWZ0ID8gJ2VkZ2VCYXNpcydvciBkcmFmdCA/
ICdjb250cmFTbmFwc2hvdCd0aGVuCiAgaWYgZHJhZnQtPj4nZWRnZUJhc2lzJ2lzIGRpc3RpbmN0IGZyb20nbmV0J29yIGpzb25i
X3R5cGVvZihkcmFmdC0+J2NvbnRyYVNuYXBzaG90JylpcyBkaXN0aW5jdCBmcm9tJ29iamVjdCdvciBjb2FsZXNjZShkcmFmdC0+
J2NvbnRyYVNuYXBzaG90Jy0+PidyZXZpc2lvbicsJycpIX4nXlthLWYwLTldezY0fSQnb3IgZXhpc3RzKHNlbGVjdCAxIGZyb20g
anNvbmJfb2JqZWN0X2tleXMoZHJhZnQtPidjb250cmFTbmFwc2hvdCcpayB3aGVyZSBrIG5vdCBpbigncmV2aXNpb24nLCdkaXNw
bGF5Q3VycmVuY3knKSl0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdpbnZhbGlkX2NvbnRyYV9zbmFwc2hvdCcs
ZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKIGVuZCBpZjsKIGxpbmtzOj1jb2FsZXNjZShkcmFmdC0+J293bkFjY291bnRMaW5rcycs
J1tdJzo6anNvbmIpOwogaWYganNvbmJfdHlwZW9mKGxpbmtzKWlzIGRpc3RpbmN0IGZyb20nYXJyYXknb3IganNvbmJfYXJyYXlf
bGVuZ3RoKGxpbmtzKT41MCB0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdjcmVhdG9yX2ludmFsaWRfYWNjb3Vu
dF9saW5rJyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogZm9yIGxpbmsgaW4gc2VsZWN0IHEgZnJvbSBqc29uYl9hcnJheV9lbGVt
ZW50cyhsaW5rcylxIGxvb3AKICBpZiBqc29uYl90eXBlb2YobGluaylpcyBkaXN0aW5jdCBmcm9tJ29iamVjdCdvciBjb2FsZXNj
ZShsaW5rLT4+J3BheW1lbnRJZCcsJycpIX4nXltBLVphLXowLTlfLV17MSw4MH0kJ29yIGNvYWxlc2NlKGxpbmstPj4nYWNjb3Vu
dElkJywnJykhfionXlswLTlhLWZdezh9LVswLTlhLWZdezR9LVswLTlhLWZdezR9LVswLTlhLWZdezR9LVswLTlhLWZdezEyfSQn
b3IgZXhpc3RzKHNlbGVjdCAxIGZyb20ganNvbmJfb2JqZWN0X2tleXMobGluaylrIHdoZXJlIGsgbm90IGluKCdwYXltZW50SWQn
LCdhY2NvdW50SWQnKSl0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdjcmVhdG9yX2ludmFsaWRfYWNjb3VudF9s
aW5rJyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogZW5kIGxvb3A7CiBpZihzZWxlY3QgY291bnQoKilmcm9tIGpzb25iX2FycmF5
X2VsZW1lbnRzKGxpbmtzKSk8PihzZWxlY3QgY291bnQoZGlzdGluY3QgcS0+PidwYXltZW50SWQnKWZyb20ganNvbmJfYXJyYXlf
ZWxlbWVudHMobGlua3MpcSl0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdjcmVhdG9yX2ludmFsaWRfYWNjb3Vu
dF9saW5rJyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogc2VsZWN0IGNvYWxlc2NlKGpzb25iX2FnZyhqc29uYl9idWlsZF9vYmpl
Y3QoJ3BheW1lbnRJZCcscS0+PidwYXltZW50SWQnLCdhY2NvdW50SWQnLGxvd2VyKHEtPj4nYWNjb3VudElkJykpb3JkZXIgYnkg
cS0+PidwYXltZW50SWQnKSwnW10nOjpqc29uYilpbnRvIGxpbmtzIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMobGlua3MpcTsK
IGlmIGRyYWZ0ID8gJ3JlcGxhY2VtZW50Rm9yJ3RoZW4KICBiZWdpbiByZXBsYWNlbWVudDo9KGRyYWZ0LT4+J3JlcGxhY2VtZW50
Rm9yJyk6OnV1aWQ7ZXhjZXB0aW9uIHdoZW4gb3RoZXJzIHRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2NyZWF0
b3JfaW52YWxpZF9yZXBsYWNlbWVudCcsZXJyY29kZT0nUDAwMDEnO2VuZDsKICBpZiByZXBsYWNlbWVudCBpcyBudWxsIHRoZW4g
cmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2NyZWF0b3JfaW52YWxpZF9yZXBsYWNlbWVudCcsZXJyY29kZT0nUDAwMDEn
O2VuZCBpZjsKIGVuZCBpZjsKIHJlc3VsdDo9KGRyYWZ0LSdvY2N1cnJlZEF0Jy0nbm90ZSctJ293bkFjY291bnRMaW5rcyctJ3Jl
cGxhY2VtZW50Rm9yJyl8fGpzb25iX2J1aWxkX29iamVjdCgnb2NjdXJyZWRBdCcsdG9fY2hhcihvY2N1cnJlZCBhdCB0aW1lIHpv
bmUgJ1VUQycsJ1lZWVktTU0tREQiVCJISDI0Ok1JOlNTLlVTIloiJyksJ25vdGUnLGJ0cmltKGNvYWxlc2NlKGRyYWZ0LT4+J25v
dGUnLCcnKSksJ293bkFjY291bnRMaW5rcycsbGlua3MpOwogaWYgcmVwbGFjZW1lbnQgaXMgbm90IG51bGwgdGhlbiByZXN1bHQ6
PXJlc3VsdHx8anNvbmJfYnVpbGRfb2JqZWN0KCdyZXBsYWNlbWVudEZvcicscmVwbGFjZW1lbnQpO2VuZCBpZjtyZXR1cm4gcmVz
dWx0OwplbmQkJDsKCmNyZWF0ZSBvciByZXBsYWNlIGZ1bmN0aW9uIHByaXZhdGUuY3JlYXRvcl9wb3N0KHRhcmdldCB1dWlkKQpy
ZXR1cm5zIHZvaWQgbGFuZ3VhZ2UgcGxwZ3NxbCBzZWN1cml0eSBkZWZpbmVyIHNldCBzZWFyY2hfcGF0aD0nJyBhcyAkJAojdmFy
aWFibGVfY29uZmxpY3QgdXNlX3ZhcmlhYmxlCmRlY2xhcmUgcmVjIHByaXZhdGUuY3JlYXRvcl9yZWNvcmRzJXJvd3R5cGU7bGlu
ZSBqc29uYjtsZWcganNvbmI7bGluayBqc29uYjtwaWQgdXVpZDtlIGpzb25iO3N0YXRlcyBqc29uYjo9J1tdJzo6anNvbmI7cGF5
bWVudF9kYXkgZGF0ZTsKYmVnaW4KIHNlbGVjdCAqIGludG8gcmVjIGZyb20gcHJpdmF0ZS5jcmVhdG9yX3JlY29yZHMgciB3aGVy
ZSByLmlkPXRhcmdldDsKIHBheW1lbnRfZGF5Oj0ocmVjLm9jY3VycmVkX2F0IGF0IHRpbWUgem9uZSByZWMudGltZV96b25lKTo6
ZGF0ZTsKIGZvciBsaW5lIGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMocmVjLnBsYW4tPidsaW5lcycpcSBs
b29wCiAgaW5zZXJ0IGludG8gcHVibGljLnNldHRsZW1lbnRfcGF5bWVudHMoY2xpZW50X3JlcXVlc3RfaWQsc2NvcGUsc3BhY2Vf
aWQsZGVidG9yX3BhcnRpY2lwYW50X2lkLGN1cnJlbmN5LGFtb3VudF9taW5vcixwYXltZW50X2RhdGUsc3RhdHVzLG5vdGUsZnhf
Y2FzaF9vbmx5LGNhc2hfdHJhY2tpbmdfcmVxdWlyZWQpCiAgdmFsdWVzKHByaXZhdGUubW9uZXlfY2hpbGRfcmVxdWVzdChyZWMu
cmVxdWVzdF9pZCwnY3JlYXRvcjpjYXNoOid8fChsaW5lLT4ncGF5bWVudCctPj4naWQnKSksJ3NwYWNlJyxyZWMuc3BhY2VfaWQs
KGxpbmUtPidwYXltZW50Jy0+PidwYXllcicpOjp1dWlkLGxpbmUtPidwYXltZW50Jy0+Pid0ZW5kZXJDdXJyZW5jeScsKGxpbmUt
PidwYXltZW50Jy0+Pid0ZW5kZXJNaW5vcicpOjpiaWdpbnQscGF5bWVudF9kYXksJ2NvbmZpcm1lZCcsJ2Z4LWNhc2gnLHRydWUs
ZmFsc2UpcmV0dXJuaW5nIGlkIGludG8gcGlkOwogIGluc2VydCBpbnRvIHB1YmxpYy5zZXR0bGVtZW50X2FsbG9jYXRpb25zKHNl
dHRsZW1lbnRfcGF5bWVudF9pZCxjcmVkaXRvcl9wYXJ0aWNpcGFudF9pZCxhbW91bnRfbWlub3Isc3RhdGUscmVzcG9uZGVkX2F0
KXZhbHVlcyhwaWQsKGxpbmUtPidwYXltZW50Jy0+PidyZWNpcGllbnQnKTo6dXVpZCwobGluZS0+J3BheW1lbnQnLT4+J3RlbmRl
ck1pbm9yJyk6OmJpZ2ludCwnYWNjZXB0ZWQnLG5vdygpKTsKICBpbnNlcnQgaW50byBwcml2YXRlLmNyZWF0b3JfcmVjZWlwdHMo
cmVjb3JkX2lkLHBheW1lbnRfaWQsa2luZCxsaW5lX2lkKXZhbHVlcyhyZWMuaWQscGlkLCdjYXNoJyxsaW5lLT4ncGF5bWVudCct
Pj4naWQnKTsKICBpbnNlcnQgaW50byBwdWJsaWMuZmluYW5jaWFsX2V2ZW50cyhhY3Rvcl9wYXJ0aWNpcGFudF9pZCxzZXR0bGVt
ZW50X3BheW1lbnRfaWQsZXZlbnRfdHlwZSxzYWZlX2RpZmYpdmFsdWVzKHJlYy5yZWNvcmRlZF9ieSxwaWQsJ3NldHRsZW1lbnQu
Y3JlYXRvcl9jYXNoX3Bvc3RlZCcsanNvbmJfYnVpbGRfb2JqZWN0KCdyZWNvcmRfaWQnLHJlYy5pZCwnbGluZV9pZCcsbGluZS0+
J3BheW1lbnQnLT4+J2lkJywnbWV0aG9kJyxsaW5lLT4ncGF5bWVudCctPj4nbWV0aG9kJywnb2NjdXJyZWRfYXQnLHJlYy5vY2N1
cnJlZF9hdCkpOwogZW5kIGxvb3A7CiBmb3IgbGVnIGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMocmVjLnBs
YW4tPiduYXRpdmUnKXEgbG9vcAogIGluc2VydCBpbnRvIHB1YmxpYy5zZXR0bGVtZW50X3BheW1lbnRzKGNsaWVudF9yZXF1ZXN0
X2lkLHNjb3BlLHNwYWNlX2lkLGRlYnRvcl9wYXJ0aWNpcGFudF9pZCxjdXJyZW5jeSxhbW91bnRfbWlub3IscGF5bWVudF9kYXRl
LHN0YXR1cyxub3RlLGZ4X2Nhc2hfb25seSxjYXNoX3RyYWNraW5nX3JlcXVpcmVkKQogIHZhbHVlcyhwcml2YXRlLm1vbmV5X2No
aWxkX3JlcXVlc3QocmVjLnJlcXVlc3RfaWQsJ2NyZWF0b3I6Y292ZXJhZ2U6J3x8KGxlZy0+PidlZGdlSWQnKXx8JzonfHwobGVn
LT4+J2N1cnJlbmN5Jyl8fCc6J3x8KGxlZy0+Pidmcm9tJykpLCdzcGFjZScscmVjLnNwYWNlX2lkLChsZWctPj4nZnJvbScpOjp1
dWlkLGxlZy0+PidjdXJyZW5jeScsKGxlZy0+PidtaW5vcicpOjpiaWdpbnQscGF5bWVudF9kYXksJ2NvbmZpcm1lZCcsJ2Z4LWNv
dmVyYWdlJyxmYWxzZSxmYWxzZSlyZXR1cm5pbmcgaWQgaW50byBwaWQ7CiAgaW5zZXJ0IGludG8gcHVibGljLnNldHRsZW1lbnRf
YWxsb2NhdGlvbnMoc2V0dGxlbWVudF9wYXltZW50X2lkLGNyZWRpdG9yX3BhcnRpY2lwYW50X2lkLGFtb3VudF9taW5vcixzdGF0
ZSxyZXNwb25kZWRfYXQpdmFsdWVzKHBpZCwobGVnLT4+J3RvJyk6OnV1aWQsKGxlZy0+PidtaW5vcicpOjpiaWdpbnQsJ2FjY2Vw
dGVkJyxub3coKSk7CiAgaW5zZXJ0IGludG8gcHJpdmF0ZS5jcmVhdG9yX3JlY2VpcHRzKHJlY29yZF9pZCxwYXltZW50X2lkLGtp
bmQpdmFsdWVzKHJlYy5pZCxwaWQsJ2NvdmVyYWdlJyk7CiAgaW5zZXJ0IGludG8gcHVibGljLmZpbmFuY2lhbF9ldmVudHMoYWN0
b3JfcGFydGljaXBhbnRfaWQsc2V0dGxlbWVudF9wYXltZW50X2lkLGV2ZW50X3R5cGUsc2FmZV9kaWZmKXZhbHVlcyhyZWMucmVj
b3JkZWRfYnkscGlkLCdzZXR0bGVtZW50LmNyZWF0b3JfY292ZXJhZ2VfcG9zdGVkJyxqc29uYl9idWlsZF9vYmplY3QoJ3JlY29y
ZF9pZCcscmVjLmlkLCdjdXJyZW5jeScsbGVnLT4+J2N1cnJlbmN5JywnbWlub3InLGxlZy0+J21pbm9yJyl8fGpzb25iX3N0cmlw
X251bGxzKGpzb25iX2J1aWxkX29iamVjdCgnYXBwbGljYXRpb24nLGxlZy0+J2FwcGxpY2F0aW9uJywnbGVkZ2VyX2N1cnJlbmN5
JyxsZWctPidsZWRnZXJDdXJyZW5jeScsJ2NvbnRyYV9lcXVpdmFsZW50X21pbm9yJyxsZWctPidjb250cmFFcXVpdmFsZW50TWlu
b3InLCdyZXBheW1lbnRfZXF1aXZhbGVudF9taW5vcicsbGVnLT4ncmVwYXltZW50RXF1aXZhbGVudE1pbm9yJywnZWRnZV9pZCcs
Y2FzZSB3aGVuIGxlZyA/ICdhcHBsaWNhdGlvbid0aGVuIGxlZy0+J2VkZ2VJZCdlbmQpKSk7CiBlbmQgbG9vcDsKIGZvciBsaW5r
IGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMocmVjLmRyYWZ0LT4nb3duQWNjb3VudExpbmtzJylxIG9yZGVy
IGJ5IHEtPj4nYWNjb3VudElkJyxxLT4+J3BheW1lbnRJZCdsb29wIHBlcmZvcm0gcHJpdmF0ZS5jcmVhdG9yX2xpbmtfY2FzaChy
ZWMuaWQsbGluay0+PidwYXltZW50SWQnLHJlYy5yZWNvcmRlZF9ieSwobGluay0+PidhY2NvdW50SWQnKTo6dXVpZCk7ZW5kIGxv
b3A7CiBmb3IgZSBpbiBzZWxlY3QgcSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKHJlYy5wbGFuLT4nc291cmNlcycpcSBsb29w
IHN0YXRlczo9c3RhdGVzfHxqc29uYl9idWlsZF9hcnJheShwcml2YXRlLnJvdXRlZF9lZGdlKHJlYy5zcGFjZV9pZCwoZS0+Pidm
cm9tJyk6OnV1aWQsKGUtPj4ndG8nKTo6dXVpZCwocmVjLnBsYW4tPidyYXRlJy0+PidudW1lcmF0b3InKTo6bnVtZXJpYywocmVj
LnBsYW4tPidyYXRlJy0+PidkZW5vbWluYXRvcicpOjpudW1lcmljKSk7ZW5kIGxvb3A7CiB1cGRhdGUgcHJpdmF0ZS5jcmVhdG9y
X3JlY29yZHMgc2V0IGFmdGVyX3N0YXRlPXN0YXRlcyB3aGVyZSBpZD1yZWMuaWQ7CmVuZCQkOwoKY3JlYXRlIG9yIHJlcGxhY2Ug
ZnVuY3Rpb24gcHJpdmF0ZS5wb3N0X3JvdXRlZF9wcm9wb3NhbCh0YXJnZXQgdXVpZCkKcmV0dXJucyB2b2lkIGxhbmd1YWdlIHBs
cGdzcWwgc2VjdXJpdHkgZGVmaW5lciBzZXQgc2VhcmNoX3BhdGg9JycgYXMgJCQKI3ZhcmlhYmxlX2NvbmZsaWN0IHVzZV92YXJp
YWJsZQpkZWNsYXJlIHAgcHJpdmF0ZS50cmlwX3JvdXRlZF9wcm9wb3NhbHMlcm93dHlwZTtsaW5lIGpzb25iO2xlZyBqc29uYjty
b2xlIHRleHQ7b3duZXIgdXVpZDthY2NvdW50IHV1aWQ7cGlkIHV1aWQ7YWlkIHV1aWQ7Y2FzaF9sZWcgdXVpZDthdXRoIGpzb25i
O3NhdmVkIGpzb25iO3N0YXRlcyBqc29uYjo9J1tdJzo6anNvbmI7ZSBqc29uYjtuIG51bWVyaWM7ZCBudW1lcmljOwpiZWdpbgog
c2VsZWN0ICogaW50byBwIGZyb20gcHJpdmF0ZS50cmlwX3JvdXRlZF9wcm9wb3NhbHMgd2hlcmUgaWQ9dGFyZ2V0OwogLS0gVmFs
aWRhdGUgRVZFUlkgc2F2ZWQgb3duZXIgYXV0aG9yaXphdGlvbiBiZWZvcmUgdGhlIGZpcnN0IGNhc2ggd3JpdGUuCiBmb3IgbGlu
ZSBpbiBzZWxlY3QgcSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKHAucGxhbi0+J2xpbmVzJylxIGxvb3AKICBmb3Igcm9sZSxv
d25lciBpbiBzZWxlY3QncGF5ZXInLChsaW5lLT4ncGF5bWVudCctPj4ncGF5ZXInKTo6dXVpZCB1bmlvbiBhbGwgc2VsZWN0J3Jl
Y2VpdmVyJywobGluZS0+J3BheW1lbnQnLT4+J3JlY2lwaWVudCcpOjp1dWlkIGxvb3AKICAgc2VsZWN0IGEuYXV0aG9yaXphdGlv
bnMtPigobGluZS0+J3BheW1lbnQnLT4+J2lkJyl8fCc6J3x8cm9sZSlpbnRvIHNhdmVkIGZyb20gcHJpdmF0ZS50cmlwX3JvdXRl
ZF9hcHByb3ZhbHMgYSB3aGVyZSBhLnByb3Bvc2FsPXAuaWQgYW5kIGEuYWN0b3I9b3duZXIgYW5kIGEuZGVjaXNpb249J2FwcHJv
dmUnOwogICBhdXRoOj1wcml2YXRlLnRyaXBfYmF0Y2hfYWNjb3VudChvd25lciwoc2F2ZWQtPj4naWQnKTo6dXVpZCxsaW5lLT4n
cGF5bWVudCctPj4ndGVuZGVyQ3VycmVuY3knKTsKICAgaWYgc2F2ZWQgaXMgZGlzdGluY3QgZnJvbSBhdXRoIHRoZW4gcmFpc2Ug
ZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J3JvdXRlZF9hY2NvdW50X2NoYW5nZWQnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiAg
ZW5kIGxvb3A7CiBlbmQgbG9vcDsKIGZvciBsaW5lIGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMocC5wbGFu
LT4nbGluZXMnKXEgbG9vcAogIGluc2VydCBpbnRvIHB1YmxpYy5zZXR0bGVtZW50X3BheW1lbnRzKGNsaWVudF9yZXF1ZXN0X2lk
LHNjb3BlLHNwYWNlX2lkLGRlYnRvcl9wYXJ0aWNpcGFudF9pZCxjdXJyZW5jeSxhbW91bnRfbWlub3IscGF5bWVudF9kYXRlLHN0
YXR1cyxub3RlLGZ4X2Nhc2hfb25seSxjYXNoX3RyYWNraW5nX3JlcXVpcmVkKQogICB2YWx1ZXMocHJpdmF0ZS5tb25leV9jaGls
ZF9yZXF1ZXN0KHAucmVxdWVzdF9pZCwncm91dGVkOmNhc2g6J3x8KGxpbmUtPidwYXltZW50Jy0+PidpZCcpKSwnc3BhY2UnLHAu
c3BhY2VfaWQsKGxpbmUtPidwYXltZW50Jy0+PidwYXllcicpOjp1dWlkLGxpbmUtPidwYXltZW50Jy0+Pid0ZW5kZXJDdXJyZW5j
eScsKGxpbmUtPidwYXltZW50Jy0+Pid0ZW5kZXJNaW5vcicpOjpiaWdpbnQsY3VycmVudF9kYXRlLCdwZW5kaW5nJywnZngtY2Fz
aCcsdHJ1ZSx0cnVlKXJldHVybmluZyBpZCBpbnRvIHBpZDsKICBpbnNlcnQgaW50byBwdWJsaWMuc2V0dGxlbWVudF9hbGxvY2F0
aW9ucyhzZXR0bGVtZW50X3BheW1lbnRfaWQsY3JlZGl0b3JfcGFydGljaXBhbnRfaWQsYW1vdW50X21pbm9yLHN0YXRlKXZhbHVl
cyhwaWQsKGxpbmUtPidwYXltZW50Jy0+PidyZWNpcGllbnQnKTo6dXVpZCwobGluZS0+J3BheW1lbnQnLT4+J3RlbmRlck1pbm9y
Jyk6OmJpZ2ludCwncGVuZGluZycpcmV0dXJuaW5nIGlkIGludG8gYWlkOwogIGZvciByb2xlLG93bmVyIGluIHNlbGVjdCdwYXll
cicsKGxpbmUtPidwYXltZW50Jy0+PidwYXllcicpOjp1dWlkIHVuaW9uIGFsbCBzZWxlY3QncmVjZWl2ZXInLChsaW5lLT4ncGF5
bWVudCctPj4ncmVjaXBpZW50Jyk6OnV1aWQgbG9vcAogICBzZWxlY3QoYS5hY2NvdW50cy0+PigobGluZS0+J3BheW1lbnQnLT4+
J2lkJyl8fCc6J3x8cm9sZSkpOjp1dWlkIGludG8gYWNjb3VudCBmcm9tIHByaXZhdGUudHJpcF9yb3V0ZWRfYXBwcm92YWxzIGEg
d2hlcmUgYS5wcm9wb3NhbD1wLmlkIGFuZCBhLmFjdG9yPW93bmVyOwogICBpbnNlcnQgaW50byBwdWJsaWMucGVyc29uYWxfc2V0
dGxlbWVudF9jYXNoX2xlZ3Mob3duZXJfcGFydGljaXBhbnRfaWQsY2xpZW50X3JlcXVlc3RfaWQscGF5bG9hZF9maW5nZXJwcmlu
dCxzZXR0bGVtZW50X3BheW1lbnRfaWQsc2V0dGxlbWVudF9hbGxvY2F0aW9uX2lkLHJvbGUsYWNjb3VudF9pZCxjYXNoX2Ftb3Vu
dF9taW5vcixhY2NvdW50X2N1cnJlbmN5LHNoYXJlZF9hbW91bnRfbWlub3IsZ2lmdF9leHRyYV9taW5vcixzdGF0dXMpCiAgICB2
YWx1ZXMob3duZXIscHJpdmF0ZS5tb25leV9jaGlsZF9yZXF1ZXN0KHAucmVxdWVzdF9pZCwncm91dGVkOid8fChsaW5lLT4ncGF5
bWVudCctPj4naWQnKXx8JzonfHxyb2xlKSxwcml2YXRlLnBlcnNvbmFsX3BheWxvYWRfZmluZ2VycHJpbnQoanNvbmJfYnVpbGRf
b2JqZWN0KCdhbGxvY2F0aW9uX2lkJyxhaWQsJ3JvbGUnLHJvbGUsJ2FjY291bnRfaWQnLGFjY291bnQsJ2Nhc2hfYW1vdW50X21p
bm9yJyxsaW5lLT4ncGF5bWVudCctPid0ZW5kZXJNaW5vcicsJ2FjY291bnRfY3VycmVuY3knLGxpbmUtPidwYXltZW50Jy0+Pid0
ZW5kZXJDdXJyZW5jeScsJ3NoYXJlZF9hbW91bnRfbWlub3InLGxpbmUtPidwYXltZW50Jy0+J3RlbmRlck1pbm9yJywnZ2lmdF9l
eHRyYV9taW5vcicsMCkpLHBpZCxhaWQscm9sZSxhY2NvdW50LChsaW5lLT4ncGF5bWVudCctPj4ndGVuZGVyTWlub3InKTo6Ymln
aW50LGxpbmUtPidwYXltZW50Jy0+Pid0ZW5kZXJDdXJyZW5jeScsKGxpbmUtPidwYXltZW50Jy0+Pid0ZW5kZXJNaW5vcicpOjpi
aWdpbnQsMCwncGVuZGluZycpcmV0dXJuaW5nIGlkIGludG8gY2FzaF9sZWc7CiAgIHBlcmZvcm0gcHJpdmF0ZS5wb3N0X3BlcnNv
bmFsX3NldHRsZW1lbnRfY2FzaF9sZWcoY2FzaF9sZWcpOwogIGVuZCBsb29wOwogIHVwZGF0ZSBwdWJsaWMuc2V0dGxlbWVudF9h
bGxvY2F0aW9ucyBzZXQgc3RhdGU9J2FjY2VwdGVkJyxyZXNwb25kZWRfYXQ9bm93KCl3aGVyZSBpZD1haWQ7CiAgdXBkYXRlIHB1
YmxpYy5zZXR0bGVtZW50X3BheW1lbnRzIHNldCBzdGF0dXM9J2NvbmZpcm1lZCcsdmVyc2lvbj12ZXJzaW9uKzEgd2hlcmUgaWQ9
cGlkOwogIGluc2VydCBpbnRvIHByaXZhdGUudHJpcF9yb3V0ZWRfcmVjZWlwdHMgdmFsdWVzKHAuaWQscGlkLCdjYXNoJyxsaW5l
LT4ncGF5bWVudCctPj4naWQnKTsKICBpbnNlcnQgaW50byBwdWJsaWMuZmluYW5jaWFsX2V2ZW50cyhhY3Rvcl9wYXJ0aWNpcGFu
dF9pZCxzZXR0bGVtZW50X3BheW1lbnRfaWQsZXZlbnRfdHlwZSxzYWZlX2RpZmYpdmFsdWVzKHB1YmxpYy5jdXJyZW50X3BhcnRp
Y2lwYW50X2lkKCkscGlkLCdzZXR0bGVtZW50LnJvdXRlZF9jYXNoX3Bvc3RlZCcsanNvbmJfYnVpbGRfb2JqZWN0KCdwcm9wb3Nh
bF9pZCcscC5pZCwnbGluZV9pZCcsbGluZS0+J3BheW1lbnQnLT4+J2lkJywnbWV0aG9kJyxsaW5lLT4ncGF5bWVudCctPj4nbWV0
aG9kJykpOwogZW5kIGxvb3A7CiBmb3IgbGVnIGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMocC5wbGFuLT4n
bmF0aXZlJylxIGxvb3AKICBpbnNlcnQgaW50byBwdWJsaWMuc2V0dGxlbWVudF9wYXltZW50cyhjbGllbnRfcmVxdWVzdF9pZCxz
Y29wZSxzcGFjZV9pZCxkZWJ0b3JfcGFydGljaXBhbnRfaWQsY3VycmVuY3ksYW1vdW50X21pbm9yLHBheW1lbnRfZGF0ZSxzdGF0
dXMsbm90ZSxmeF9jYXNoX29ubHksY2FzaF90cmFja2luZ19yZXF1aXJlZCkKICAgdmFsdWVzKHByaXZhdGUubW9uZXlfY2hpbGRf
cmVxdWVzdChwLnJlcXVlc3RfaWQsJ3JvdXRlZDpjb3ZlcmFnZTonfHwobGVnLT4+J2VkZ2VJZCcpfHwnOid8fChsZWctPj4nY3Vy
cmVuY3knKXx8JzonfHwobGVnLT4+J2Zyb20nKSksJ3NwYWNlJyxwLnNwYWNlX2lkLChsZWctPj4nZnJvbScpOjp1dWlkLGxlZy0+
PidjdXJyZW5jeScsKGxlZy0+PidtaW5vcicpOjpiaWdpbnQsY3VycmVudF9kYXRlLCdjb25maXJtZWQnLCdmeC1jb3ZlcmFnZScs
ZmFsc2UsZmFsc2UpcmV0dXJuaW5nIGlkIGludG8gcGlkOwogIGluc2VydCBpbnRvIHB1YmxpYy5zZXR0bGVtZW50X2FsbG9jYXRp
b25zKHNldHRsZW1lbnRfcGF5bWVudF9pZCxjcmVkaXRvcl9wYXJ0aWNpcGFudF9pZCxhbW91bnRfbWlub3Isc3RhdGUscmVzcG9u
ZGVkX2F0KXZhbHVlcyhwaWQsKGxlZy0+Pid0bycpOjp1dWlkLChsZWctPj4nbWlub3InKTo6YmlnaW50LCdhY2NlcHRlZCcsbm93
KCkpOwogIGluc2VydCBpbnRvIHByaXZhdGUudHJpcF9yb3V0ZWRfcmVjZWlwdHMgdmFsdWVzKHAuaWQscGlkLCdjb3ZlcmFnZScs
bnVsbCk7CiAgaW5zZXJ0IGludG8gcHVibGljLmZpbmFuY2lhbF9ldmVudHMoYWN0b3JfcGFydGljaXBhbnRfaWQsc2V0dGxlbWVu
dF9wYXltZW50X2lkLGV2ZW50X3R5cGUsc2FmZV9kaWZmKXZhbHVlcyhwdWJsaWMuY3VycmVudF9wYXJ0aWNpcGFudF9pZCgpLHBp
ZCwnc2V0dGxlbWVudC5yb3V0ZWRfY292ZXJhZ2VfcG9zdGVkJyxqc29uYl9idWlsZF9vYmplY3QoJ3Byb3Bvc2FsX2lkJyxwLmlk
LCdjdXJyZW5jeScsbGVnLT4+J2N1cnJlbmN5JywnbWlub3InLGxlZy0+J21pbm9yJyl8fGpzb25iX3N0cmlwX251bGxzKGpzb25i
X2J1aWxkX29iamVjdCgnYXBwbGljYXRpb24nLGxlZy0+J2FwcGxpY2F0aW9uJywnbGVkZ2VyX2N1cnJlbmN5JyxsZWctPidsZWRn
ZXJDdXJyZW5jeScsJ2NvbnRyYV9lcXVpdmFsZW50X21pbm9yJyxsZWctPidjb250cmFFcXVpdmFsZW50TWlub3InLCdyZXBheW1l
bnRfZXF1aXZhbGVudF9taW5vcicsbGVnLT4ncmVwYXltZW50RXF1aXZhbGVudE1pbm9yJywnZWRnZV9pZCcsY2FzZSB3aGVuIGxl
ZyA/ICdhcHBsaWNhdGlvbid0aGVuIGxlZy0+J2VkZ2VJZCdlbmQpKSk7CiBlbmQgbG9vcDsKIG46PShwLnBsYW4tPidyYXRlJy0+
PidudW1lcmF0b3InKTo6bnVtZXJpYztkOj0ocC5wbGFuLT4ncmF0ZSctPj4nZGVub21pbmF0b3InKTo6bnVtZXJpYzsKIGZvciBl
IGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMocC5wbGFuLT4nc291cmNlcycpcSBsb29wIHN0YXRlczo9c3Rh
dGVzfHxqc29uYl9idWlsZF9hcnJheShwcml2YXRlLnJvdXRlZF9lZGdlKHAuc3BhY2VfaWQsKGUtPj4nZnJvbScpOjp1dWlkLChl
LT4+J3RvJyk6OnV1aWQsbixkKSk7ZW5kIGxvb3A7CiB1cGRhdGUgcHJpdmF0ZS50cmlwX3JvdXRlZF9wcm9wb3NhbHMgc2V0IHN0
YXR1cz0ncG9zdGVkJyxwb3N0ZWRfYXQ9bm93KCksdmVyc2lvbj12ZXJzaW9uKzEsYWZ0ZXJfc3RhdGU9c3RhdGVzIHdoZXJlIGlk
PXAuaWQ7CmVuZCAkJDsKCi0tIFByZXNlcnZlIGV2ZXJ5IG9sZCBmcm96ZW4gcGxhbidzIHByb2plY3Rpb24gYW5kIHJldmVyc2Fs
IGNvbnRyYWN0LgpkbyAkbGVnYWN5X3Byb2plY3Rpb24kCmRlY2xhcmUgZGVmaW5pdGlvbiB0ZXh0OwpiZWdpbgogZGVmaW5pdGlv
bjo9cGdfZ2V0X2Z1bmN0aW9uZGVmKCdwcml2YXRlLnJvdXRlZF9wdWJsaWNfcGxhbihqc29uYiknOjpyZWdwcm9jZWR1cmUpOwog
ZXhlY3V0ZSByZXBsYWNlKGRlZmluaXRpb24sJ0ZVTkNUSU9OIHByaXZhdGUucm91dGVkX3B1YmxpY19wbGFuKCcsICdGVU5DVElP
TiBwcml2YXRlLnJvdXRlZF9wdWJsaWNfcGxhbl92MSgnKTsKZW5kCiRsZWdhY3lfcHJvamVjdGlvbiQ7CmNyZWF0ZSBmdW5jdGlv
biBwcml2YXRlLmNvbnRyYV9yZW1haW5pbmcocGxhbiBqc29uYikKcmV0dXJucyBqc29uYiBsYW5ndWFnZSBwbHBnc3FsIHN0YWJs
ZSBzZXQgc2VhcmNoX3BhdGg9JycgYXMgJCQKI3ZhcmlhYmxlX2NvbmZsaWN0IHVzZV92YXJpYWJsZQpkZWNsYXJlIGJhbGFuY2Vz
IGpzb25iO3Jvd3MganNvbmI6PSdbXSc6Ompzb25iO3BhaXIgcmVjb3JkO2RldGFpbCBqc29uYjtsZWdzIGpzb25iO3EganNvbmI6
PXBsYW4tPidjb250cmFRdW90ZSc7CmJlZ2luCiB3aXRoIG9yaWdpbmFscyBhcygKICBzZWxlY3Qgbi0+Pidmcm9tJyBkZWJ0b3Is
bi0+Pid0bycgY3JlZGl0b3Isbi0+PidjdXJyZW5jeScgY3VycmVuY3ksbWF4KChuLT4+J21pbm9yJyk6OmJpZ2ludCkgYW1vdW50
CiAgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhwbGFuLT4nc291cmNlcycpcyBjcm9zcyBqb2luIGxhdGVyYWwganNvbmJfYXJy
YXlfZWxlbWVudHMoY29hbGVzY2Uocy0+J3N0YW5kaW5nTmF0aXZlJyxzLT4nbmF0aXZlJykpbiBncm91cCBieSAxLDIsMwogKSxy
ZWR1Y3Rpb25zIGFzKAogIHNlbGVjdCBuLT4+J2Zyb20nIGRlYnRvcixuLT4+J3RvJyBjcmVkaXRvcixuLT4+J2N1cnJlbmN5JyBj
dXJyZW5jeSxzdW0oKG4tPj4nbWlub3InKTo6YmlnaW50KTo6YmlnaW50IGFtb3VudCBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRz
KHBsYW4tPiduYXRpdmUnKW4gZ3JvdXAgYnkgMSwyLDMKIClzZWxlY3QgY29hbGVzY2UoanNvbmJfYWdnKGpzb25iX2J1aWxkX29i
amVjdCgnZnJvbScsby5kZWJ0b3IsJ3RvJyxvLmNyZWRpdG9yLCdjdXJyZW5jeScsby5jdXJyZW5jeSwnbWlub3InLG8uYW1vdW50
LWNvYWxlc2NlKHIuYW1vdW50LDApKW9yZGVyIGJ5IG8uZGVidG9yLG8uY3JlZGl0b3Isby5jdXJyZW5jeSksJ1tdJylpbnRvIGJh
bGFuY2VzIGZyb20gb3JpZ2luYWxzIG8gbGVmdCBqb2luIHJlZHVjdGlvbnMgciB1c2luZyhkZWJ0b3IsY3JlZGl0b3IsY3VycmVu
Y3kpOwogaWYgZXhpc3RzKHNlbGVjdCAxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMoYmFsYW5jZXMpbiB3aGVyZShuLT4+J21p
bm9yJyk6OmJpZ2ludDwwKXRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2ludmFsaWRfY29udHJhX3NuYXBzaG90
JyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogZm9yIHBhaXIgaW4gc2VsZWN0IGRpc3RpbmN0IGxlYXN0KG4tPj4nZnJvbScsbi0+
Pid0bycpYSxncmVhdGVzdChuLT4+J2Zyb20nLG4tPj4ndG8nKWIgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhiYWxhbmNlcylu
IG9yZGVyIGJ5IDEsMiBsb29wCiAgc2VsZWN0IGNvYWxlc2NlKGpzb25iX2FnZyhuKSwnW10nKWludG8gbGVncyBmcm9tIGpzb25i
X2FycmF5X2VsZW1lbnRzKGJhbGFuY2VzKW4gd2hlcmUgbi0+Pidmcm9tJ2luKHBhaXIuYSxwYWlyLmIpYW5kIG4tPj4ndG8naW4o
cGFpci5hLHBhaXIuYik7CiAgZGV0YWlsOj1wcml2YXRlLmNvbnRyYV9uYXRpdmVfcGFpcihsZWdzLHBhaXIuYTo6dXVpZCxwYWly
LmI6OnV1aWQscSk7CiAgaWYgbm90KGRldGFpbC0+Pidrbm93bicpOjpib29sZWFuIHRoZW4gZGV0YWlsOj1wcml2YXRlLmNvbnRy
YV9uYXRpdmVfcGFpcihsZWdzLHBhaXIuYTo6dXVpZCxwYWlyLmI6OnV1aWQscXx8anNvbmJfYnVpbGRfb2JqZWN0KCdkaXNwbGF5
Q3VycmVuY3knLCdWTkQnKSk7ZW5kIGlmOwogIGlmKGRldGFpbC0+Pidrbm93bicpOjpib29sZWFuIGFuZChkZXRhaWwtPj4nbmV0
TWlub3InKTo6YmlnaW50PjAgdGhlbiByb3dzOj1yb3dzfHxqc29uYl9idWlsZF9hcnJheShqc29uYl9idWlsZF9vYmplY3QoJ2lk
JyxwYWlyLmF8fCc6J3x8cGFpci5iLCdmcm9tJyxkZXRhaWwtPidwYXllcicsJ3RvJyxkZXRhaWwtPidyZWNpcGllbnQnLCdjdXJy
ZW5jeScsZGV0YWlsLT4nY3VycmVuY3knLCdtaW5vcicsZGV0YWlsLT4nbmV0TWlub3InKSk7ZW5kIGlmOwogZW5kIGxvb3A7cmV0
dXJuIHJvd3M7CmVuZCQkOwpjcmVhdGUgb3IgcmVwbGFjZSBmdW5jdGlvbiBwcml2YXRlLnJvdXRlZF9wdWJsaWNfcGxhbihwbGFu
IGpzb25iKQpyZXR1cm5zIGpzb25iIGxhbmd1YWdlIHBscGdzcWwgc3RhYmxlIHNldCBzZWFyY2hfcGF0aD0nJyBhcyAkJApiZWdp
bgogaWYgcGxhbi0+PidlZGdlQmFzaXMnPSduZXQndGhlbiByZXR1cm4ocHJpdmF0ZS5yb3V0ZWRfcHVibGljX3BsYW5fdjEocGxh
biktJ2NvbnRyYVF1b3RlJyl8fGpzb25iX2J1aWxkX29iamVjdCgnZWRnZUJhc2lzJywnbmV0JywncmVtYWluaW5nJyxwcml2YXRl
LmNvbnRyYV9yZW1haW5pbmcocGxhbiksJ3JlbWFpbmluZ0VzdGltYXRlZCcsdHJ1ZSk7ZW5kIGlmOwogcmV0dXJuIHByaXZhdGUu
cm91dGVkX3B1YmxpY19wbGFuX3YxKHBsYW4pOwplbmQkJDsKCnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFf
bmF0aXZlX2F1ZGl0KHV1aWQsdXVpZCx1dWlkKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFsbCBvbiBm
dW5jdGlvbiBwcml2YXRlLmNvbnRyYV9xdW90ZSh0ZXh0LHRleHQsdGV4dClmcm9tIHB1YmxpYyxhbm9uLGF1dGhlbnRpY2F0ZWQ7
CnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfZGlzcGxheV92YWx1ZShiaWdpbnQsdGV4dCxqc29uYilmcm9t
IHB1YmxpYyxhbm9uLGF1dGhlbnRpY2F0ZWQ7CnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfbmF0aXZlX3Bh
aXIoanNvbmIsdXVpZCx1dWlkLGpzb25iKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFsbCBvbiBmdW5j
dGlvbiBwcml2YXRlLmNvbnRyYV9wYWlyKHV1aWQsdXVpZCx1dWlkLGpzb25iKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRl
ZDsKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBwcml2YXRlLmNvbnRyYV9tYXRyaXgodXVpZCxqc29uYilmcm9tIHB1YmxpYyxhbm9u
LGF1dGhlbnRpY2F0ZWQ7CnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfZ3Jvc3NfZGlzcGxheShqc29uYix1
dWlkLHV1aWQsanNvbmIpZnJvbSBwdWJsaWMsYW5vbixhdXRoZW50aWNhdGVkOwpyZXZva2UgYWxsIG9uIGZ1bmN0aW9uIHByaXZh
dGUuY29udHJhX3ZhbHVlKGJpZ2ludCx0ZXh0LG51bWVyaWMsbnVtZXJpYylmcm9tIHB1YmxpYyxhbm9uLGF1dGhlbnRpY2F0ZWQ7
CnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfbmV0X2VkZ2UodXVpZCx1dWlkLHV1aWQsbnVtZXJpYyxudW1l
cmljKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBwcml2YXRlLmNvbnRyYV9y
ZXNvbHZlX25hdGl2ZShqc29uYixiaWdpbnQsbnVtZXJpYyxudW1lcmljKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsK
cmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBwcml2YXRlLnJvdXRlZF9idWlsZF9jb3JlKHV1aWQsdXVpZCxqc29uYixib29sZWFuKWZy
b20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBwcml2YXRlLmNyZWF0b3Jfbm9ybWFs
aXplKGpzb25iKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBwcml2YXRlLmNy
ZWF0b3JfcG9zdCh1dWlkKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBwcml2
YXRlLnBvc3Rfcm91dGVkX3Byb3Bvc2FsKHV1aWQpZnJvbSBwdWJsaWMsYW5vbixhdXRoZW50aWNhdGVkOwpyZXZva2UgYWxsIG9u
IGZ1bmN0aW9uIHByaXZhdGUuY29udHJhX3JlbWFpbmluZyhqc29uYilmcm9tIHB1YmxpYyxhbm9uLGF1dGhlbnRpY2F0ZWQ7CnJl
dm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5yb3V0ZWRfcHVibGljX3BsYW4oanNvbmIpZnJvbSBwdWJsaWMsYW5vbixhdXRo
ZW50aWNhdGVkOwpyZXZva2UgYWxsIG9uIGZ1bmN0aW9uIHByaXZhdGUucm91dGVkX3B1YmxpY19wbGFuX3YxKGpzb25iKWZyb20g
cHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBwdWJsaWMucmVhZF90cmlwX2NvbnRyYV9z
bmFwc2hvdCh1dWlkLHRleHQsdGV4dCx0ZXh0KWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKZ3JhbnQgZXhlY3V0ZSBv
biBmdW5jdGlvbiBwdWJsaWMucmVhZF90cmlwX2NvbnRyYV9zbmFwc2hvdCh1dWlkLHRleHQsdGV4dCx0ZXh0KXRvIGF1dGhlbnRp
Y2F0ZWQ7Cm5vdGlmeSBwZ3JzdCwncmVsb2FkIHNjaGVtYSc7CmNvbW1pdDsK
$contra_payload$,'base64'),'UTF8');
 if encode(extensions.digest(migration_sql,'sha256'),'hex')<>'01fb68762483bcf42162a645c30fdab55aaf77335b59a9288841495b7ec09492'then raise exception 'Incomplete contra payload';end if;
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
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.routed_build_core(uuid,uuid,jsonb,boolean)'))is distinct from 'a737a42908d25ab33b317d3df509ec27'then raise exception 'Unexpected contra function: private.routed_build_core(uuid,uuid,jsonb,boolean)';end if;
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
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_native_audit(uuid,uuid,uuid)'))is distinct from '07e50c132b61d3492ab72bf7281341df'then raise exception 'Unexpected contra function: private.contra_native_audit(uuid,uuid,uuid)';end if;
 if has_function_privilege('anon','private.contra_native_audit(uuid,uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','private.contra_native_audit(uuid,uuid,uuid)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_quote(text,text,text)'))is distinct from '68159e700d0d2b72d9af1e25f5954dc0'then raise exception 'Unexpected contra function: private.contra_quote(text,text,text)';end if;
 if has_function_privilege('anon','private.contra_quote(text,text,text)','EXECUTE')or has_function_privilege('authenticated','private.contra_quote(text,text,text)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_display_value(bigint,text,jsonb)'))is distinct from 'e9bfb19398fa109b7b6ae47891d75717'then raise exception 'Unexpected contra function: private.contra_display_value(bigint,text,jsonb)';end if;
 if has_function_privilege('anon','private.contra_display_value(bigint,text,jsonb)','EXECUTE')or has_function_privilege('authenticated','private.contra_display_value(bigint,text,jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_native_pair(jsonb,uuid,uuid,jsonb)'))is distinct from 'dd1d8fa5b9ebb010426ba155b53902d2'then raise exception 'Unexpected contra function: private.contra_native_pair(jsonb,uuid,uuid,jsonb)';end if;
 if has_function_privilege('anon','private.contra_native_pair(jsonb,uuid,uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','private.contra_native_pair(jsonb,uuid,uuid,jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_pair(uuid,uuid,uuid,jsonb)'))is distinct from '7e96dd704bb07c4994ef7cfff3fa060c'then raise exception 'Unexpected contra function: private.contra_pair(uuid,uuid,uuid,jsonb)';end if;
 if has_function_privilege('anon','private.contra_pair(uuid,uuid,uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','private.contra_pair(uuid,uuid,uuid,jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_matrix(uuid,jsonb)'))is distinct from 'de5ab8526d6778f509889b226d248307'then raise exception 'Unexpected contra function: private.contra_matrix(uuid,jsonb)';end if;
 if has_function_privilege('anon','private.contra_matrix(uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','private.contra_matrix(uuid,jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('public.read_trip_contra_snapshot(uuid,text,text,text)'))is distinct from '2572f2672777022746402263c5cdb211'then raise exception 'Unexpected contra function: public.read_trip_contra_snapshot(uuid,text,text,text)';end if;
 if has_function_privilege('anon','public.read_trip_contra_snapshot(uuid,text,text,text)','EXECUTE')or has_function_privilege('authenticated','public.read_trip_contra_snapshot(uuid,text,text,text)','EXECUTE')is distinct from true then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_gross_display(jsonb,uuid,uuid,jsonb)'))is distinct from '0dbbd617871f749c9cf73b643792c0d9'then raise exception 'Unexpected contra function: private.contra_gross_display(jsonb,uuid,uuid,jsonb)';end if;
 if has_function_privilege('anon','private.contra_gross_display(jsonb,uuid,uuid,jsonb)','EXECUTE')or has_function_privilege('authenticated','private.contra_gross_display(jsonb,uuid,uuid,jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_value(bigint,text,numeric,numeric)'))is distinct from 'e7269fc15edc1ed68e214196498b7eae'then raise exception 'Unexpected contra function: private.contra_value(bigint,text,numeric,numeric)';end if;
 if has_function_privilege('anon','private.contra_value(bigint,text,numeric,numeric)','EXECUTE')or has_function_privilege('authenticated','private.contra_value(bigint,text,numeric,numeric)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_net_edge(uuid,uuid,uuid,numeric,numeric)'))is distinct from 'e798e6b8749bdd50a385d770ed5d594e'then raise exception 'Unexpected contra function: private.contra_net_edge(uuid,uuid,uuid,numeric,numeric)';end if;
 if has_function_privilege('anon','private.contra_net_edge(uuid,uuid,uuid,numeric,numeric)','EXECUTE')or has_function_privilege('authenticated','private.contra_net_edge(uuid,uuid,uuid,numeric,numeric)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_resolve_native(jsonb,bigint,numeric,numeric)'))is distinct from '7d3d6eb5d70b2de9dd8d0de086ed37f8'then raise exception 'Unexpected contra function: private.contra_resolve_native(jsonb,bigint,numeric,numeric)';end if;
 if has_function_privilege('anon','private.contra_resolve_native(jsonb,bigint,numeric,numeric)','EXECUTE')or has_function_privilege('authenticated','private.contra_resolve_native(jsonb,bigint,numeric,numeric)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_remaining(jsonb)'))is distinct from 'bd1a4912a2ce2408b7b9f6244d429275'then raise exception 'Unexpected contra function: private.contra_remaining(jsonb)';end if;
 if has_function_privilege('anon','private.contra_remaining(jsonb)','EXECUTE')or has_function_privilege('authenticated','private.contra_remaining(jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if exists(select 1 from unnest(array['private.contra_native_pair(jsonb,uuid,uuid,jsonb)','private.contra_gross_display(jsonb,uuid,uuid,jsonb)','private.contra_resolve_native(jsonb,bigint,numeric,numeric)','private.contra_remaining(jsonb)','private.routed_public_plan(jsonb)'])s(sig)join pg_proc p on p.oid=to_regprocedure(s.sig)where p.provolatile<>'s')then raise exception 'Unexpected contra projection volatility';end if;
 if(select provolatile from pg_proc where oid='private.creator_normalize(jsonb)'::regprocedure)<>'s'then raise exception 'Unexpected creator normalizer volatility';end if;
end;
$contra_install$;
notify pgrst,'reload schema';
commit;
select 'TABBY_TRIP_CONTRA_INSTALL_COMPLETE_20261112' as installation_status;
