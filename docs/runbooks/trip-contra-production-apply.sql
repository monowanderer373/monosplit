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
 -- Canonical SHA256 6b6093c8aa8d3ce7a261be88475030c9a63e24eb3533352c215cdb8b01624801
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
aW1tdXRhYmxlIHNldCBzZWFyY2hfcGF0aD0nJyBhcyAkJAojdmFyaWFibGVfY29uZmxpY3QgdXNlX3ZhcmlhYmxlCmRlY2xhcmUg
bGVnIGpzb25iO3ggYmlnaW50O2YgYmlnaW50Oj0wO3IgYmlnaW50Oj0wO2tub3duIGJvb2xlYW46PXRydWU7ZXN0aW1hdGVkIGJv
b2xlYW46PWZhbHNlOwpiZWdpbgogZm9yIGxlZyBpbiBzZWxlY3QgcSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKG5hdGl2ZSlx
IGxvb3AKICB4Oj1wcml2YXRlLmNvbnRyYV9kaXNwbGF5X3ZhbHVlKChsZWctPj4nbWlub3InKTo6YmlnaW50LGxlZy0+PidjdXJy
ZW5jeScscXVvdGUpOwogIGlmIHggaXMgbnVsbCB0aGVuIGtub3duOj1mYWxzZTtlbHNlIGlmIGxlZy0+Pidmcm9tJz1hOjp0ZXh0
IHRoZW4gZjo9Zit4O2Vsc2Ugcjo9cit4O2VuZCBpZjtlbmQgaWY7CiAgZXN0aW1hdGVkOj1lc3RpbWF0ZWQgb3IgbGVnLT4+J2N1
cnJlbmN5Jzw+cXVvdGUtPj4nZGlzcGxheUN1cnJlbmN5JzsKIGVuZCBsb29wOwogaWYgZ3JlYXRlc3QoZixyKT45MDA3MTk5MjU0
NzQwOTkxIHRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2ludmFsaWRfYW1vdW50JyxlcnJjb2RlPSdQMDAwMSc7
ZW5kIGlmOwogcmV0dXJuIGpzb25iX2J1aWxkX29iamVjdCgna25vd24nLGtub3duLCdjdXJyZW5jeScscXVvdGUtPj4nZGlzcGxh
eUN1cnJlbmN5JywnZXN0aW1hdGVkJyxlc3RpbWF0ZWQsJ2FPd2VzQicsY2FzZSB3aGVuIGtub3duIHRoZW4gZiBlbmQsJ2JPd2Vz
QScsY2FzZSB3aGVuIGtub3duIHRoZW4gciBlbmQsJ2NvbnRyYU1pbm9yJyxjYXNlIHdoZW4ga25vd24gdGhlbiBsZWFzdChmLHIp
ZW5kLCduZXRNaW5vcicsY2FzZSB3aGVuIGtub3duIHRoZW4gYWJzKGYtcillbmQsJ3BheWVyJyxjYXNlIHdoZW4ga25vd24gYW5k
IGY8PnIgdGhlbiBjYXNlIHdoZW4gZj5yIHRoZW4gYSBlbHNlIGIgZW5kIGVuZCwncmVjaXBpZW50JyxjYXNlIHdoZW4ga25vd24g
YW5kIGY8PnIgdGhlbiBjYXNlIHdoZW4gZj5yIHRoZW4gYiBlbHNlIGEgZW5kIGVuZCk7CmVuZCQkOwpjcmVhdGUgZnVuY3Rpb24g
cHJpdmF0ZS5jb250cmFfcGFpcih0cmlwIHV1aWQsYSB1dWlkLGIgdXVpZCxxdW90ZSBqc29uYikKcmV0dXJucyBqc29uYiBsYW5n
dWFnZSBwbHBnc3FsIHNlY3VyaXR5IGRlZmluZXIgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCiN2YXJpYWJsZV9jb25mbGljdCB1
c2VfdmFyaWFibGUKZGVjbGFyZSBuYXRpdmUganNvbmI6PSdbXSc6Ompzb25iO2F2YWlsYWJsZSBqc29uYjo9J1tdJzo6anNvbmI7
Y29kZSB0ZXh0O3NpZ25lZCBiaWdpbnQ7aG9sZCBiaWdpbnQ7cmVhZHkgYm9vbGVhbjo9dHJ1ZTtoZWxkIGJvb2xlYW46PWZhbHNl
O2xlZyBqc29uYjtsZWRnZXIganNvbmI7YXZhaWxhYmxlX2xlZGdlciBqc29uYjthdWRpdCBqc29uYjtkaXNwbGF5IGpzb25iO2dy
b3NzX2Rpc3BsYXkganNvbmI7CmJlZ2luCiBmb3IgY29kZSBpbiBzZWxlY3QgZGlzdGluY3QgZS5jdXJyZW5jeSBmcm9tIHB1Ymxp
Yy5leHBlbnNlcyBlIHdoZXJlIGUuc3BhY2VfaWQ9dHJpcCBhbmQgZS5zY29wZT0nc3BhY2UnYW5kIGUuc3RhdHVzPSdhY3RpdmUn
b3JkZXIgYnkgZS5jdXJyZW5jeSBsb29wCiAgc2lnbmVkOj1wcml2YXRlLnNwYWNlX3NpZ25lZF9vdXRzdGFuZGluZyh0cmlwLGEs
Yixjb2RlKTsKICBpZiBzaWduZWQ8PjAgdGhlbgogICBsZWc6PWpzb25iX2J1aWxkX29iamVjdCgnZnJvbScsY2FzZSB3aGVuIHNp
Z25lZD4wIHRoZW4gYSBlbHNlIGIgZW5kLCd0bycsY2FzZSB3aGVuIHNpZ25lZD4wIHRoZW4gYiBlbHNlIGEgZW5kLCdjdXJyZW5j
eScsY29kZSwnbWlub3InLGFicyhzaWduZWQpKTtuYXRpdmU6PW5hdGl2ZXx8anNvbmJfYnVpbGRfYXJyYXkobGVnKTsKICAgaG9s
ZDo9cHJpdmF0ZS5wZW5kaW5nX3BhaXJfbWlub3IodHJpcCwobGVnLT4+J2Zyb20nKTo6dXVpZCwobGVnLT4+J3RvJyk6OnV1aWQs
Y29kZSk7aGVsZDo9aGVsZCBvciBob2xkPjA7CiAgIGF2YWlsYWJsZTo9YXZhaWxhYmxlfHxqc29uYl9idWlsZF9hcnJheShsZWd8
fGpzb25iX2J1aWxkX29iamVjdCgnbWlub3InLGdyZWF0ZXN0KGFicyhzaWduZWQpLWhvbGQsMCkpKTsKCiAgZW5kIGlmOwogZW5k
IGxvb3A7CiAtLSBBIHBlbmRpbmcgcmVzZXJ2YXRpb24gbmV2ZXIgaW52ZW50cyBhIHJldmVyc2Ugb2JsaWdhdGlvbiBvciBjaGFu
Z2VzIHN0YW5kaW5nLgogcmVhZHk6PWV4aXN0cyhzZWxlY3QgMSBmcm9tIHB1YmxpYy5zcGFjZV9tZW1iZXJzIG0gd2hlcmUgbS5z
cGFjZV9pZD10cmlwIGFuZCBtLnBhcnRpY2lwYW50X2lkPWEgYW5kIG0ucmVtb3ZlZF9hdCBpcyBudWxsKWFuZCBleGlzdHMoc2Vs
ZWN0IDEgZnJvbSBwdWJsaWMuc3BhY2VfbWVtYmVycyBtIHdoZXJlIG0uc3BhY2VfaWQ9dHJpcCBhbmQgbS5wYXJ0aWNpcGFudF9p
ZD1iIGFuZCBtLnJlbW92ZWRfYXQgaXMgbnVsbCk7CiBhdWRpdDo9cHJpdmF0ZS5jb250cmFfbmF0aXZlX2F1ZGl0KHRyaXAsYSxi
KTtkaXNwbGF5Oj1wcml2YXRlLmNvbnRyYV9uYXRpdmVfcGFpcihuYXRpdmUsYSxiLHF1b3RlKTtncm9zc19kaXNwbGF5Oj1wcml2
YXRlLmNvbnRyYV9ncm9zc19kaXNwbGF5KGF1ZGl0LGEsYixxdW90ZSk7CiBpZiBub3QgY29hbGVzY2UoKGRpc3BsYXktPj4na25v
d24nKTo6Ym9vbGVhbiBhbmQoZ3Jvc3NfZGlzcGxheS0+Pidrbm93bicpOjpib29sZWFuIGFuZCBkaXNwbGF5LT4nbmV0TWlub3In
PWdyb3NzX2Rpc3BsYXktPiduZXRNaW5vcidhbmQgZGlzcGxheS0+J3BheWVyJz1ncm9zc19kaXNwbGF5LT4ncGF5ZXInLGZhbHNl
KXRoZW4gZ3Jvc3NfZGlzcGxheTo9bnVsbDtlbmQgaWY7CiBsZWRnZXI6PXByaXZhdGUuY29udHJhX25hdGl2ZV9wYWlyKG5hdGl2
ZSxhLGIscXVvdGV8fGpzb25iX2J1aWxkX29iamVjdCgnZGlzcGxheUN1cnJlbmN5JywnTVlSJykpO2F2YWlsYWJsZV9sZWRnZXI6
PXByaXZhdGUuY29udHJhX25hdGl2ZV9wYWlyKGF2YWlsYWJsZSxhLGIscXVvdGV8fGpzb25iX2J1aWxkX29iamVjdCgnZGlzcGxh
eUN1cnJlbmN5JywnTVlSJykpOwogcmV0dXJuIGpzb25iX2J1aWxkX29iamVjdCgnaWQnLGE6OnRleHR8fCc6J3x8Yjo6dGV4dCwn
YScsYSwnYicsYiwnZWRnZUJhc2lzJywnbmV0JywnbmF0aXZlQmFzaXMnLCdzYW1lX2N1cnJlbmN5X25ldCcsJ25hdGl2ZScsbmF0
aXZlLCdhdmFpbGFibGVOYXRpdmUnLGF2YWlsYWJsZSwnZGlzcGxheScsZGlzcGxheSwnZ3Jvc3NEaXNwbGF5Jyxncm9zc19kaXNw
bGF5LCdsZWRnZXJDdXJyZW5jeScsJ01ZUicsJ2xlZGdlcicsbGVkZ2VyLCduZXRNaW5vcicsbGVkZ2VyLT4nbmV0TWlub3InLCdw
YXllcicsbGVkZ2VyLT4ncGF5ZXInLCdyZWNpcGllbnQnLGxlZGdlci0+J3JlY2lwaWVudCcsJ2F2YWlsYWJsZU1pbm9yJyxjYXNl
IHdoZW4gcmVhZHkgYW5kIG5vdCBoZWxkIGFuZChsZWRnZXItPj4na25vd24nKTo6Ym9vbGVhbiBhbmQoYXZhaWxhYmxlX2xlZGdl
ci0+Pidrbm93bicpOjpib29sZWFuIGFuZCBsZWRnZXItPj4ncGF5ZXInPWF2YWlsYWJsZV9sZWRnZXItPj4ncGF5ZXIndGhlbiBs
ZWFzdCgobGVkZ2VyLT4+J25ldE1pbm9yJyk6OmJpZ2ludCwoYXZhaWxhYmxlX2xlZGdlci0+PiduZXRNaW5vcicpOjpiaWdpbnQp
ZWxzZSAwIGVuZCwncGVuZGluZycsaGVsZCwnY3VycmVudE1lbWJlcnMnLHJlYWR5LCdhdWRpdCcsYXVkaXQsJ3NvdXJjZVZlcnNp
b25zJyxwcml2YXRlLmZ4X3BhaXJfZXhwZW5zZV92ZXJzaW9ucyh0cmlwLGEsYikpOwplbmQkJDsKY3JlYXRlIGZ1bmN0aW9uIHBy
aXZhdGUuY29udHJhX21hdHJpeCh0cmlwIHV1aWQscXVvdGUganNvbmIpCnJldHVybnMganNvbmIgbGFuZ3VhZ2UgcGxwZ3NxbCBz
ZWN1cml0eSBkZWZpbmVyIHNldCBzZWFyY2hfcGF0aD0nJyBhcyAkJAojdmFyaWFibGVfY29uZmxpY3QgdXNlX3ZhcmlhYmxlCmRl
Y2xhcmUgcGFpcnMganNvbmI6PSdbXSc6Ompzb25iO3BhaXIganNvbmI7cm93IHJlY29yZDtyZXZpc2lvbiB0ZXh0O2ZhY3RzIGpz
b25iOwpiZWdpbgogZm9yIHJvdyBpbiBzZWxlY3QgYS5wYXJ0aWNpcGFudF9pZCBhLGIucGFydGljaXBhbnRfaWQgYiBmcm9tIHB1
YmxpYy5zcGFjZV9tZW1iZXJzIGEgam9pbiBwdWJsaWMuc3BhY2VfbWVtYmVycyBiIG9uIGIuc3BhY2VfaWQ9YS5zcGFjZV9pZCBh
bmQgYS5wYXJ0aWNpcGFudF9pZDxiLnBhcnRpY2lwYW50X2lkIHdoZXJlIGEuc3BhY2VfaWQ9dHJpcCBvcmRlciBieSBhLnBhcnRp
Y2lwYW50X2lkLGIucGFydGljaXBhbnRfaWQgbG9vcAogIHBhaXI6PXByaXZhdGUuY29udHJhX3BhaXIodHJpcCxyb3cuYSxyb3cu
YixxdW90ZSk7aWYganNvbmJfYXJyYXlfbGVuZ3RoKHBhaXItPiduYXRpdmUnKT4wIHRoZW4gcGFpcnM6PXBhaXJzfHxqc29uYl9i
dWlsZF9hcnJheShwYWlyKTtlbmQgaWY7CiBlbmQgbG9vcDsKIC0tIEZyZWV6ZSBhbGwgc2hhcmVkIGZpbmFuY2lhbCB2ZXJzaW9u
cywgbm90IHRpbWVzdGFtcHMgb3IgcHJpdmF0ZSBhY2NvdW50cy4KIHNlbGVjdCBqc29uYl9idWlsZF9vYmplY3QoJ2V4cGVuc2Vz
Jywoc2VsZWN0IGNvYWxlc2NlKGpzb25iX2FnZyhqc29uYl9idWlsZF9hcnJheShlLmlkLGUudmVyc2lvbixlLnN0YXR1cylvcmRl
ciBieSBlLmlkKSwnW10nKWZyb20gcHVibGljLmV4cGVuc2VzIGUgd2hlcmUgZS5zY29wZT0nc3BhY2UnYW5kIGUuc3BhY2VfaWQ9
dHJpcCksJ3BheW1lbnRzJywoc2VsZWN0IGNvYWxlc2NlKGpzb25iX2FnZyhqc29uYl9idWlsZF9hcnJheShwLmlkLHAudmVyc2lv
bixwLnN0YXR1cyxwLmN1cnJlbmN5LHAuYW1vdW50X21pbm9yKW9yZGVyIGJ5IHAuaWQpLCdbXScpZnJvbSBwdWJsaWMuc2V0dGxl
bWVudF9wYXltZW50cyBwIHdoZXJlIHAuc2NvcGU9J3NwYWNlJ2FuZCBwLnNwYWNlX2lkPXRyaXApLCdhbGxvY2F0aW9ucycsKHNl
bGVjdCBjb2FsZXNjZShqc29uYl9hZ2coanNvbmJfYnVpbGRfYXJyYXkoYS5pZCxhLnN0YXRlLGEuYW1vdW50X21pbm9yLGEuY3Jl
ZGl0b3JfcGFydGljaXBhbnRfaWQpb3JkZXIgYnkgYS5pZCksJ1tdJylmcm9tIHB1YmxpYy5zZXR0bGVtZW50X2FsbG9jYXRpb25z
IGEgam9pbiBwdWJsaWMuc2V0dGxlbWVudF9wYXltZW50cyBwIG9uIHAuaWQ9YS5zZXR0bGVtZW50X3BheW1lbnRfaWQgd2hlcmUg
cC5zY29wZT0nc3BhY2UnYW5kIHAuc3BhY2VfaWQ9dHJpcCksJ21lbWJlcnMnLChzZWxlY3QgY29hbGVzY2UoanNvbmJfYWdnKGpz
b25iX2J1aWxkX2FycmF5KG0ucGFydGljaXBhbnRfaWQsbS5yb2xlLG0ucmVtb3ZlZF9hdClvcmRlciBieSBtLnBhcnRpY2lwYW50
X2lkKSwnW10nKWZyb20gcHVibGljLnNwYWNlX21lbWJlcnMgbSB3aGVyZSBtLnNwYWNlX2lkPXRyaXApKWludG8gZmFjdHM7CiBy
ZXZpc2lvbjo9ZW5jb2RlKGV4dGVuc2lvbnMuZGlnZXN0KGpzb25iX2J1aWxkX29iamVjdCgndHJpcCcsdHJpcCwncXVvdGUnLHF1
b3RlLCdwYWlycycscGFpcnMsJ2ZhY3RzJyxmYWN0cyk6OnRleHQsJ3NoYTI1NicpLCdoZXgnKTsKIHJldHVybiBqc29uYl9idWls
ZF9vYmplY3QoJ3RyaXBJZCcsdHJpcCwncmV2aXNpb24nLHJldmlzaW9uLCdlZGdlQmFzaXMnLCduZXQnLCdxdW90ZScscXVvdGUs
J3BhaXJzJyxwYWlycyk7CmVuZCQkOwpjcmVhdGUgZnVuY3Rpb24gcHVibGljLnJlYWRfdHJpcF9jb250cmFfc25hcHNob3QodGFy
Z2V0X3NwYWNlX2lkIHV1aWQscmF0ZV9tb2RlIHRleHQgZGVmYXVsdCdzeXN0ZW0nLHZuZF9wZXJfbXlyIHRleHQgZGVmYXVsdCBu
dWxsLGRpc3BsYXlfY3VycmVuY3kgdGV4dCBkZWZhdWx0J01ZUicpCnJldHVybnMganNvbmIgbGFuZ3VhZ2UgcGxwZ3NxbCBzZWN1
cml0eSBkZWZpbmVyIHNldCBzZWFyY2hfcGF0aD0nJyBhcyAkJAojdmFyaWFibGVfY29uZmxpY3QgdXNlX3ZhcmlhYmxlCmRlY2xh
cmUgYWN0b3IgdXVpZDo9cHJpdmF0ZS5yZXF1aXJlX3BlcnNvbmFsX2FjdG9yKCk7cmVzdWx0IGpzb25iO3dob2xlIGJvb2xlYW47
CmJlZ2luCiBpZiBwcml2YXRlLnNwYWNlX3JvbGUodGFyZ2V0X3NwYWNlX2lkLGFjdG9yKWlzIG51bGwgb3Igbm90IGV4aXN0cyhz
ZWxlY3QgMSBmcm9tIHB1YmxpYy5zcGFjZXMgcyB3aGVyZSBzLmlkPXRhcmdldF9zcGFjZV9pZCBhbmQgcy50eXBlPSd0cmlwJ2Fu
ZCBzLnN0YXR1czw+J3ZvaWRlZCcpdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0nc3BhY2VfbWVtYmVyc2hpcF9y
ZXF1aXJlZCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKIHBlcmZvcm0gcHJpdmF0ZS5sb2NrX2NvbGxlY3RfcGF5X2JhbGFuY2Uo
KTtyZXN1bHQ6PXByaXZhdGUuY29udHJhX21hdHJpeCh0YXJnZXRfc3BhY2VfaWQscHJpdmF0ZS5jb250cmFfcXVvdGUocmF0ZV9t
b2RlLHZuZF9wZXJfbXlyLGRpc3BsYXlfY3VycmVuY3kpKTt3aG9sZTo9cHJpdmF0ZS5jcmVhdG9yX2Nhbl9yZWNvcmQodGFyZ2V0
X3NwYWNlX2lkLGFjdG9yKTsKIGlmIG5vdCB3aG9sZSB0aGVuIHJlc3VsdDo9cmVzdWx0fHxqc29uYl9idWlsZF9vYmplY3QoJ3Bh
aXJzJywoc2VsZWN0IGNvYWxlc2NlKGpzb25iX2FnZyhxKSwnW10nKWZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMocmVzdWx0LT4n
cGFpcnMnKXEgd2hlcmUgYWN0b3I6OnRleHQgaW4ocS0+PidhJyxxLT4+J2InKSkpO2VuZCBpZjsKIHJldHVybiByZXN1bHR8fGpz
b25iX2J1aWxkX29iamVjdCgndmlld2VyJyxhY3RvciwnY2FuUmVjb3JkJyx3aG9sZSk7CmVuZCQkOwoKCmNyZWF0ZSBmdW5jdGlv
biBwcml2YXRlLmNvbnRyYV9ncm9zc19kaXNwbGF5KGF1ZGl0IGpzb25iLGEgdXVpZCxiIHV1aWQscXVvdGUganNvbmIpCnJldHVy
bnMganNvbmIgbGFuZ3VhZ2UgcGxwZ3NxbCBpbW11dGFibGUgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCiN2YXJpYWJsZV9jb25m
bGljdCB1c2VfdmFyaWFibGUKZGVjbGFyZSByb3cganNvbmI7bmF0aXZlIGpzb25iOj0nW10nOjpqc29uYjtmIGJpZ2ludDtyIGJp
Z2ludDsKYmVnaW4KIGZvciByb3cgaW4gc2VsZWN0IHEgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhhdWRpdClxIGxvb3AKICBm
Oj0ocm93LT4+J2FCaWxscycpOjpiaWdpbnQtKHJvdy0+PidhQXBwbGllZCcpOjpiaWdpbnQ7cjo9KHJvdy0+PidiQmlsbHMnKTo6
YmlnaW50LShyb3ctPj4nYkFwcGxpZWQnKTo6YmlnaW50OwogIG5hdGl2ZTo9bmF0aXZlfHxqc29uYl9idWlsZF9hcnJheShqc29u
Yl9idWlsZF9vYmplY3QoJ2Zyb20nLGEsJ3RvJyxiLCdjdXJyZW5jeScscm93LT4+J2N1cnJlbmN5JywnbWlub3InLGdyZWF0ZXN0
KGYsMCkrZ3JlYXRlc3QoLXIsMCkpLGpzb25iX2J1aWxkX29iamVjdCgnZnJvbScsYiwndG8nLGEsJ2N1cnJlbmN5Jyxyb3ctPj4n
Y3VycmVuY3knLCdtaW5vcicsZ3JlYXRlc3QociwwKStncmVhdGVzdCgtZiwwKSkpOwogZW5kIGxvb3A7cmV0dXJuIHByaXZhdGUu
Y29udHJhX25hdGl2ZV9wYWlyKG5hdGl2ZSxhLGIscXVvdGUpOwplbmQkJDsKCgotLSBOZXcgbmV0IG1vZGUgdXNlcyB0aGUgb3Zl
cnZpZXcncyBNWVIgbWlub3IgdW5pdCBhbmQgdGhlIGV4aXN0aW5nIG9yaWdpbmFsLQotLSBjdXJyZW5jeSBjb250cmEvcmVwYXlt
ZW50IGNvdmVyYWdlIG1vZGVsLiBDYXNoIGFsd2F5cyBrZWVwcyBpdHMgYWN0dWFsIGN1cnJlbmN5LgpjcmVhdGUgZnVuY3Rpb24g
cHJpdmF0ZS5jb250cmFfdmFsdWUoYW1vdW50IGJpZ2ludCxjb2RlIHRleHQsbiBudW1lcmljLGQgbnVtZXJpYykKcmV0dXJucyBi
aWdpbnQgbGFuZ3VhZ2UgcGxwZ3NxbCBpbW11dGFibGUgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCmJlZ2luCiBpZiBhbW91bnQ8
MCBvciBhbW91bnQ+OTAwNzE5OTI1NDc0MDk5MSBvciBjb2RlIG5vdCBpbignTVlSJywnVk5EJyl0aGVuIHJhaXNlIGV4Y2VwdGlv
biB1c2luZyBtZXNzYWdlPSdpbnZhbGlkX2Ftb3VudCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKIGlmIGNvZGU9J01ZUid0aGVu
IHJldHVybiBhbW91bnQ7ZW5kIGlmOwogaWYgbiBpcyBudWxsIG9yIGQgaXMgbnVsbCBvciBsZWFzdChuLGQpPD0wIHRoZW4gcmFp
c2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2Z4X3JhdGVfdW5hdmFpbGFibGUnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiBy
ZXR1cm4gcHJpdmF0ZS5meF9yb3VuZF9kaXYoYW1vdW50OjpudW1lcmljKjEwMCpkLG4pOwplbmQkJDsKY3JlYXRlIGZ1bmN0aW9u
IHByaXZhdGUuY29udHJhX25ldF9lZGdlKHRyaXAgdXVpZCxkZWJ0b3IgdXVpZCxjcmVkaXRvciB1dWlkLG4gbnVtZXJpYyxkIG51
bWVyaWMpCnJldHVybnMganNvbmIgbGFuZ3VhZ2UgcGxwZ3NxbCBzZWN1cml0eSBkZWZpbmVyIHNldCBzZWFyY2hfcGF0aD0nJyBh
cyAkJAojdmFyaWFibGVfY29uZmxpY3QgdXNlX3ZhcmlhYmxlCmRlY2xhcmUgcGFpciBqc29uYjtxIGpzb25iOwpiZWdpbgogcTo9
anNvbmJfYnVpbGRfb2JqZWN0KCdudW1lcmF0b3InLG46OnRleHQsJ2Rlbm9taW5hdG9yJyxkOjp0ZXh0LCdkaXNwbGF5Q3VycmVu
Y3knLCdNWVInLCdyYXRlcycsJ3t9Jzo6anNvbmIpO3BhaXI6PXByaXZhdGUuY29udHJhX3BhaXIodHJpcCxkZWJ0b3IsY3JlZGl0
b3IscSk7CiByZXR1cm4ganNvbmJfYnVpbGRfb2JqZWN0KCdpZCcsZGVidG9yOjp0ZXh0fHwnOid8fGNyZWRpdG9yOjp0ZXh0LCdm
cm9tJyxkZWJ0b3IsJ3RvJyxjcmVkaXRvciwnbWlub3InLGNhc2Ugd2hlbiBwYWlyLT4+J3BheWVyJz1kZWJ0b3I6OnRleHQgdGhl
biBwYWlyLT4nYXZhaWxhYmxlTWlub3InZWxzZScwJzo6anNvbmIgZW5kLCduYXRpdmUnLHBhaXItPidhdmFpbGFibGVOYXRpdmUn
LCdzdGFuZGluZ05hdGl2ZScscGFpci0+J25hdGl2ZScsJ2V4cGVuc2VzJyxwYWlyLT4nc291cmNlVmVyc2lvbnMnKTsKZW5kJCQ7
CmNyZWF0ZSBmdW5jdGlvbiBwcml2YXRlLmNvbnRyYV9yZXNvbHZlX25hdGl2ZShlZGdlIGpzb25iLGFtb3VudCBiaWdpbnQsbiBu
dW1lcmljLGQgbnVtZXJpYykKcmV0dXJucyBqc29uYiBsYW5ndWFnZSBwbHBnc3FsIGltbXV0YWJsZSBzZXQgc2VhcmNoX3BhdGg9
JycgYXMgJCQKI3ZhcmlhYmxlX2NvbmZsaWN0IHVzZV92YXJpYWJsZQpkZWNsYXJlIGxlZyBqc29uYjt3b3JrIGpzb25iOj0nW10n
Ojpqc29uYjtvdXQganNvbmI6PSdbXSc6Ompzb25iO3VwZGF0ZWQganNvbmI7b3JpZ2luYWwgYmlnaW50O2NvdmVyZWQgYmlnaW50
O3JlbWFpbmluZyBiaWdpbnQ7YmVmb3JlX3ZhbHVlIGJpZ2ludDthZnRlcl92YWx1ZSBiaWdpbnQ7ZGVsdGEgYmlnaW50O25ldF9k
ZWx0YSBiaWdpbnQ6PTA7ZGlmZmVyZW5jZSBiaWdpbnQ7d2FudGVkIGJpZ2ludDtsbyBiaWdpbnQ7aGkgYmlnaW50O3NpZ251bSBp
bnQ7b3Bwb3NpdGUgYmlnaW50Oj0wO2NvbnRyYSBiaWdpbnQ7CmJlZ2luCiBpZiBhbW91bnQ8MCBvciBhbW91bnQ+KGVkZ2UtPj4n
bWlub3InKTo6YmlnaW50IHRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2ludmFsaWRfcm91dGVkX2Ftb3VudCcs
ZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKIGlmIGFtb3VudD0wIHRoZW4gcmV0dXJuJ1tdJzo6anNvbmI7ZW5kIGlmOwogZm9yIGxl
ZyBpbiBzZWxlY3QgcSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKGVkZ2UtPiduYXRpdmUnKXEgb3JkZXIgYnkgcS0+PidjdXJy
ZW5jeScscS0+Pidmcm9tJ2xvb3AKICBvcmlnaW5hbDo9KGxlZy0+PidtaW5vcicpOjpiaWdpbnQ7CiAgY292ZXJlZDo9Y2FzZSB3
aGVuIGFtb3VudD0oZWRnZS0+PidtaW5vcicpOjpiaWdpbnQgdGhlbiBvcmlnaW5hbCBlbHNlIGxlYXN0KG9yaWdpbmFsLHByaXZh
dGUuZnhfcm91bmRfZGl2KG9yaWdpbmFsOjpudW1lcmljKmFtb3VudCwoZWRnZS0+PidtaW5vcicpOjpudW1lcmljKSllbmQ7CiAg
YmVmb3JlX3ZhbHVlOj1wcml2YXRlLmNvbnRyYV92YWx1ZShvcmlnaW5hbCxsZWctPj4nY3VycmVuY3knLG4sZCk7YWZ0ZXJfdmFs
dWU6PXByaXZhdGUuY29udHJhX3ZhbHVlKG9yaWdpbmFsLWNvdmVyZWQsbGVnLT4+J2N1cnJlbmN5JyxuLGQpO2RlbHRhOj1iZWZv
cmVfdmFsdWUtYWZ0ZXJfdmFsdWU7CiAgc2lnbnVtOj1jYXNlIHdoZW4gbGVnLT4+J2Zyb20nPWVkZ2UtPj4nZnJvbSd0aGVuIDEg
ZWxzZS0xIGVuZDtuZXRfZGVsdGE6PW5ldF9kZWx0YStzaWdudW0qZGVsdGE7CiAgd29yazo9d29ya3x8anNvbmJfYnVpbGRfYXJy
YXkobGVnfHxqc29uYl9idWlsZF9vYmplY3QoJ29yaWdpbmFsJyxvcmlnaW5hbCwnbWlub3InLGNvdmVyZWQsJ2JlZm9yZScsYmVm
b3JlX3ZhbHVlLCdkZWx0YScsZGVsdGEsJ3NpZ251bScsc2lnbnVtKSk7CiBlbmQgbG9vcDsKIC0tIFF1YW50aXplIGFnYWluc3Qg
YmVmb3JlL2FmdGVyIGF1dGhvcml0YXRpdmUgYmFsYW5jZXMsIG5vdCBhIHNpbGVudCB0b2xlcmFuY2UuCiAtLSBBIHNpbmdsZSBu
YXRpdmUgcXVhbnR1bSBpcyBzZWxlY3RlZCBvbmx5IHdoZW4gaXQgZXhwbGFpbnMgdGhlIGV4YWN0IE1ZUiBkZWx0YS4KIGRpZmZl
cmVuY2U6PWFtb3VudC1uZXRfZGVsdGE7CiBmb3IgbGVnIGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMod29y
aylxIG9yZGVyIGJ5IGNhc2Ugd2hlbiBxLT4+J2N1cnJlbmN5Jz0nTVlSJ3RoZW4gMCBlbHNlIDEgZW5kLHEtPj4nZnJvbSdsb29w
CiAgZXhpdCB3aGVuIGRpZmZlcmVuY2U9MDtzaWdudW06PShsZWctPj4nc2lnbnVtJyk6OmludDtvcmlnaW5hbDo9KGxlZy0+Pidv
cmlnaW5hbCcpOjpiaWdpbnQ7cmVtYWluaW5nOj1vcmlnaW5hbC0obGVnLT4+J21pbm9yJyk6OmJpZ2ludDsKICB3YW50ZWQ6PShs
ZWctPj4nYmVmb3JlJyk6OmJpZ2ludC0oKGxlZy0+PidkZWx0YScpOjpiaWdpbnQrc2lnbnVtKmRpZmZlcmVuY2UpOwogIGlmIHdh
bnRlZDwwIHRoZW4gY29udGludWU7ZW5kIGlmOwogIGlmIGxlZy0+PidjdXJyZW5jeSc9J01ZUid0aGVuIGxvOj13YW50ZWQ7aGk6
PXdhbnRlZDsKICBlbHNlIGxvOj1ncmVhdGVzdCgwLGNlaWwoKHdhbnRlZDo6bnVtZXJpYy0wLjUpKm4vKDEwMCpkKSk6OmJpZ2lu
dCk7aGk6PWNlaWwoKHdhbnRlZDo6bnVtZXJpYyswLjUpKm4vKDEwMCpkKSk6OmJpZ2ludC0xO2VuZCBpZjsKICBsbzo9Z3JlYXRl
c3QobG8sMCk7aGk6PWxlYXN0KGhpLG9yaWdpbmFsKTtpZiBsbz5oaSB0aGVuIGNvbnRpbnVlO2VuZCBpZjsKICByZW1haW5pbmc6
PWxlYXN0KGdyZWF0ZXN0KHJlbWFpbmluZyxsbyksaGkpO2lmIHByaXZhdGUuY29udHJhX3ZhbHVlKHJlbWFpbmluZyxsZWctPj4n
Y3VycmVuY3knLG4sZCk8PndhbnRlZCB0aGVuIGNvbnRpbnVlO2VuZCBpZjsKICBkZWx0YTo9KGxlZy0+PidiZWZvcmUnKTo6Ymln
aW50LXdhbnRlZDt1cGRhdGVkOj1sZWd8fGpzb25iX2J1aWxkX29iamVjdCgnbWlub3InLG9yaWdpbmFsLXJlbWFpbmluZywnZGVs
dGEnLGRlbHRhKTsKICBzZWxlY3QganNvbmJfYWdnKGNhc2Ugd2hlbiBxLT4+J2Zyb20nPWxlZy0+Pidmcm9tJ2FuZCBxLT4+J2N1
cnJlbmN5Jz1sZWctPj4nY3VycmVuY3kndGhlbiB1cGRhdGVkIGVsc2UgcSBlbmQgb3JkZXIgYnkgcS0+PidjdXJyZW5jeScscS0+
Pidmcm9tJylpbnRvIHdvcmsgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyh3b3JrKXE7CiAgbmV0X2RlbHRhOj1uZXRfZGVsdGEr
c2lnbnVtKihkZWx0YS0obGVnLT4+J2RlbHRhJyk6OmJpZ2ludCk7ZGlmZmVyZW5jZTo9YW1vdW50LW5ldF9kZWx0YTsKIGVuZCBs
b29wOwogaWYgZGlmZmVyZW5jZTw+MCB0aGVuIHJldHVybiBudWxsO2VuZCBpZjsKIHNlbGVjdCBjb2FsZXNjZShzdW0oKHEtPj4n
ZGVsdGEnKTo6YmlnaW50KSwwKTo6YmlnaW50IGludG8gb3Bwb3NpdGUgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyh3b3JrKXEg
d2hlcmUocS0+PidzaWdudW0nKTo6aW50PDA7CiBmb3IgbGVnIGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMo
d29yaylxIG9yZGVyIGJ5IHEtPj4nY3VycmVuY3knLHEtPj4nZnJvbSdsb29wCiAgY292ZXJlZDo9KGxlZy0+PidtaW5vcicpOjpi
aWdpbnQ7aWYgY292ZXJlZD0wIHRoZW4gY29udGludWU7ZW5kIGlmO2RlbHRhOj0obGVnLT4+J2RlbHRhJyk6OmJpZ2ludDsKICBp
ZihsZWctPj4nc2lnbnVtJyk6OmludDwwIHRoZW4gY29udHJhOj1kZWx0YTsKICBlbHNlIGNvbnRyYTo9bGVhc3Qob3Bwb3NpdGUs
ZGVsdGEpO29wcG9zaXRlOj1vcHBvc2l0ZS1jb250cmE7ZW5kIGlmOwogIG91dDo9b3V0fHxqc29uYl9idWlsZF9hcnJheSgobGVn
LSdvcmlnaW5hbCctJ2JlZm9yZSctJ2RlbHRhJy0nc2lnbnVtJyl8fGpzb25iX2J1aWxkX29iamVjdCgnZWRnZUlkJyxlZGdlLT4+
J2lkJywnYXBwbGljYXRpb24nLGNhc2Ugd2hlbihsZWctPj4nc2lnbnVtJyk6OmludDwwIHRoZW4nY29udHJhJ3doZW4gY29udHJh
PjAgdGhlbidjb250cmFfYW5kX3JlcGF5bWVudCdlbHNlJ3JlcGF5bWVudCdlbmQsJ2xlZGdlckN1cnJlbmN5JywnTVlSJywnY29u
dHJhRXF1aXZhbGVudE1pbm9yJyxjb250cmEsJ3JlcGF5bWVudEVxdWl2YWxlbnRNaW5vcicsY2FzZSB3aGVuKGxlZy0+PidzaWdu
dW0nKTo6aW50PDAgdGhlbiAwIGVsc2UgZGVsdGEtY29udHJhIGVuZCkpOwogZW5kIGxvb3A7cmV0dXJuIG91dDsKZW5kJCQ7CgoK
Y3JlYXRlIG9yIHJlcGxhY2UgZnVuY3Rpb24gcHJpdmF0ZS5yb3V0ZWRfYnVpbGRfY29yZShhY3RvciB1dWlkLHRyaXAgdXVpZCxk
cmFmdCBqc29uYixjcmVhdG9yX21vZGUgYm9vbGVhbikKcmV0dXJucyBqc29uYiBsYW5ndWFnZSBwbHBnc3FsIHNlY3VyaXR5IGRl
ZmluZXIgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCiN2YXJpYWJsZV9jb25mbGljdCB1c2VfdmFyaWFibGUKZGVjbGFyZSBwYXlt
ZW50cyBqc29uYjo9ZHJhZnQtPidwYXltZW50cyc7cCBqc29uYjtsaW5lIGpzb25iO2UganNvbmI7bGVnIGpzb25iO21lbWJlciB1
dWlkO3NlbmRlciB1dWlkO3JlY2VpdmVyIHV1aWQ7dmlhIHV1aWQ7ayB0ZXh0OwogZWRnZXMganNvbmI6PSd7fSc6Ompzb25iO3Jl
c2VydmVkIGpzb25iOj0ne30nOjpqc29uYjtpZHMganNvbmI6PSd7fSc6Ompzb25iO2xlZnRzIGpzb25iOj0ne30nOjpqc29uYjt0
b3RhbHMganNvbmI6PSd7fSc6Ompzb25iO2xpbmVzIGpzb25iOj0nW10nOjpqc29uYjtuZXh0X2xpbmVzIGpzb25iOj0nW10nOjpq
c29uYjtpc3N1ZXMganNvbmI6PSdbXSc6Ompzb25iO25hdGl2ZSBqc29uYjo9J1tdJzo6anNvbmI7cmVtYWluaW5nIGpzb25iOj0n
W10nOjpqc29uYjthY3RvcnMganNvbmI6PSdbXSc6Ompzb25iO3NvdXJjZXMganNvbmI6PSdbXSc6Ompzb25iOwogYW1vdW50IGJp
Z2ludDt2YWx1ZSBiaWdpbnQ7cm91dGUgYmlnaW50O2RpcmVjdCBiaWdpbnQ7dW5hcHBsaWVkIGJpZ2ludDtjYXAgYmlnaW50O2Nv
dmVyZWQgYmlnaW50O3RvdGFsIGJpZ2ludDtuZXQgYmlnaW50OwogbiBudW1lcmljO2QgbnVtZXJpYztjYXNoX2dyb3VwIHJlY29y
ZDtzbmFwc2hvdCB1dWlkO3JhdGVzIGpzb25iO3F1b3RlIGpzb25iO21vZGUgdGV4dDo9ZHJhZnQtPj4ncmF0ZU1vZGUnOwogbmV0
X21vZGUgYm9vbGVhbjo9Y29hbGVzY2UoZHJhZnQtPj4nZWRnZUJhc2lzJz0nbmV0JyxmYWxzZSk7Y3EganNvbmI7bWF0cml4IGpz
b25iO3Jlc29sdmVkIGpzb25iOwpiZWdpbgogaWYgY3JlYXRvcl9tb2RlIGFuZCBub3QgcHJpdmF0ZS5jcmVhdG9yX2Nhbl9yZWNv
cmQodHJpcCxhY3Rvcil0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdjcmVhdG9yX3Byb3h5X2ZvcmJpZGRlbics
ZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKIGlmIGFjdG9yIGlzIG51bGwgb3IgcHJpdmF0ZS5zcGFjZV9yb2xlKHRyaXAsYWN0b3Ip
aXMgbnVsbCB0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdzZXR0bGVtZW50X3BhcnRpY2lwYW50X2RlbmllZCcs
ZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKIHBlcmZvcm0gMSBmcm9tIHB1YmxpYy5zcGFjZXMgcyB3aGVyZSBzLmlkPXRyaXAgYW5k
IHMudHlwZT0ndHJpcCdhbmQgcy5zdGF0dXM8Pid2b2lkZWQnZm9yIHNoYXJlOwogaWYgbm90IGZvdW5kIHRoZW4gcmFpc2UgZXhj
ZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J3NldHRsZW1lbnRfcGFydGljaXBhbnRfZGVuaWVkJyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlm
OwogaWYgZHJhZnQgPyAnZWRnZUJhc2lzJ29yIGRyYWZ0ID8gJ2NvbnRyYVNuYXBzaG90J3RoZW4KICBpZiBub3QgbmV0X21vZGUg
b3IganNvbmJfdHlwZW9mKGRyYWZ0LT4nY29udHJhU25hcHNob3QnKWlzIGRpc3RpbmN0IGZyb20nb2JqZWN0J29yIGNvYWxlc2Nl
KGRyYWZ0LT4nY29udHJhU25hcHNob3QnLT4+J3JldmlzaW9uJywnJykhfideW2EtZjAtOV17NjR9JCdvciBleGlzdHMoc2VsZWN0
IDEgZnJvbSBqc29uYl9vYmplY3Rfa2V5cyhkcmFmdC0+J2NvbnRyYVNuYXBzaG90JylrIHdoZXJlIGsgbm90IGluKCdyZXZpc2lv
bicsJ2Rpc3BsYXlDdXJyZW5jeScpKXRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2ludmFsaWRfY29udHJhX3Nu
YXBzaG90JyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogIGNxOj1wcml2YXRlLmNvbnRyYV9xdW90ZShtb2RlLGRyYWZ0LT4+J3Zu
ZFBlck15cicsZHJhZnQtPidjb250cmFTbmFwc2hvdCctPj4nZGlzcGxheUN1cnJlbmN5Jyk7bWF0cml4Oj1wcml2YXRlLmNvbnRy
YV9tYXRyaXgodHJpcCxjcSk7CiAgaWYgbWF0cml4LT4+J3JldmlzaW9uJ2lzIGRpc3RpbmN0IGZyb20gZHJhZnQtPidjb250cmFT
bmFwc2hvdCctPj4ncmV2aXNpb24ndGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0nY29udHJhX3NuYXBzaG90X2No
YW5nZWQnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiBlbmQgaWY7CiBpZiBtb2RlIGlzIG51bGwgb3IgbW9kZSBub3QgaW4oJ3N5
c3RlbScsJ2N1c3RvbScpb3IganNvbmJfdHlwZW9mKHBheW1lbnRzKWlzIGRpc3RpbmN0IGZyb20nYXJyYXknb3IganNvbmJfYXJy
YXlfbGVuZ3RoKHBheW1lbnRzKW5vdCBiZXR3ZWVuIDEgYW5kIDUwIHRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9
J2ludmFsaWRfYW1vdW50JyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogaWYgbW9kZT0nY3VzdG9tJyB0aGVuCiAgaWYgY29hbGVz
Y2UoZHJhZnQtPj4ndm5kUGVyTXlyJywnJykhfideWzAtOV17MSwxMn0oXC5bMC05XXsxLDEyfSk/JCdvcihkcmFmdC0+Pid2bmRQ
ZXJNeXInKTo6bnVtZXJpYzw9MCB0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNzYWdlPSdpbnZhbGlkX3JhdGUnLGVycmNv
ZGU9J1AwMDAxJztlbmQgaWY7CiAgbjo9KGRyYWZ0LT4+J3ZuZFBlck15cicpOjpudW1lcmljO2Q6PTE7cXVvdGU6PWpzb25iX2J1
aWxkX29iamVjdCgnbnVtZXJhdG9yJyxuOjp0ZXh0LCdkZW5vbWluYXRvcicsJzEnLCdzb3VyY2UnLCdjdXN0b20nLCdwcm92aWRl
cicsJ0N1c3RvbScpOwogZWxzZQogIHNlbGVjdCByLnNuYXBzaG90X2lkLHMucmF0ZXMgaW50byBzbmFwc2hvdCxyYXRlcyBmcm9t
IHRhYmJ5X2Z4LnJlZnJlc2hfc3RhdGUgciBqb2luIHRhYmJ5X2Z4LnNuYXBzaG90cyBzIG9uIHMuaWQ9ci5zbmFwc2hvdF9pZCB3
aGVyZSByLnNpbmdsZXRvbiBmb3Igc2hhcmUgb2YgcixzOwogIG46PShyYXRlcy0+J1ZORCctPj4nZGVub21pbmF0b3InKTo6bnVt
ZXJpYztkOj0ocmF0ZXMtPidWTkQnLT4+J251bWVyYXRvcicpOjpudW1lcmljOwogIHF1b3RlOj1qc29uYl9idWlsZF9vYmplY3Qo
J251bWVyYXRvcicsbjo6dGV4dCwnZGVub21pbmF0b3InLGQ6OnRleHQsJ3NvdXJjZScsJ3N5c3RlbScsJ3Byb3ZpZGVyJyxyYXRl
cy0+J1ZORCctPj4ncHJvdmlkZXInLCdyYXRlRGF0ZScscmF0ZXMtPidWTkQnLT4+J3JhdGVEYXRlJywnc25hcHNob3RJZCcsc25h
cHNob3QpOwogZW5kIGlmOwogZm9yIHAgaW4gc2VsZWN0IHEgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhwYXltZW50cylxIG9y
ZGVyIGJ5IHEtPj4naWQnbG9vcAogIHNlbmRlcjo9KHAtPj4ncGF5ZXInKTo6dXVpZDtyZWNlaXZlcjo9KHAtPj4ncmVjaXBpZW50
Jyk6OnV1aWQ7dmlhOj1udWxsaWYocC0+J3ZpYSctPj4ncGVyc29uJywnJyk6OnV1aWQ7CiAgaWYgY29hbGVzY2UocC0+PidpZCcs
JycpIX4nXltBLVphLXowLTlfLV17MSw4MH0kJ29yIGlkcyA/IChwLT4+J2lkJylvciBzZW5kZXIgaXMgbnVsbCBvciByZWNlaXZl
ciBpcyBudWxsIG9yIHNlbmRlcj1yZWNlaXZlciBvciAobm90IGNyZWF0b3JfbW9kZSBhbmQgYWN0b3Igbm90IGluKHNlbmRlcixy
ZWNlaXZlcikpb3IgcC0+Pid0ZW5kZXJDdXJyZW5jeSdub3QgaW4oJ01ZUicsJ1ZORCcpb3IgcC0+PidtZXRob2Qnbm90IGluKCdj
YXNoJywnYmFua190cmFuc2ZlcicpdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0ncm91dGVkX3BhcnRpY2lwYW50
X2RlbmllZCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKICBpZiAocC0+Pid0ZW5kZXJDdXJyZW5jeScpaXMgbnVsbCBvcihwLT4+
J21ldGhvZCcpaXMgbnVsbCBvciBjb2FsZXNjZShwLT4+J3RlbmRlck1pbm9yJywnJykhfideWzAtOV17MSwxNn0kJ3RoZW4gcmFp
c2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2ludmFsaWRfYW1vdW50JyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogIGlkczo9
aWRzfHxqc29uYl9idWlsZF9vYmplY3QocC0+PidpZCcsdHJ1ZSk7azo9c2VuZGVyOjp0ZXh0fHwnOid8fHJlY2VpdmVyOjp0ZXh0
fHwnOid8fChwLT4+J3RlbmRlckN1cnJlbmN5Jyk7CiAgaWYgaWRzID8gayB0aGVuIHJhaXNlIGV4Y2VwdGlvbiB1c2luZyBtZXNz
YWdlPSdkdXBsaWNhdGVfdGVuZGVyJyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmO2lkczo9aWRzfHxqc29uYl9idWlsZF9vYmplY3Qo
ayx0cnVlKTsKICBmb3IgbWVtYmVyIGluIHNlbGVjdCBkaXN0aW5jdCB4IGZyb20gdW5uZXN0KGFycmF5W3NlbmRlcixyZWNlaXZl
cix2aWFdKXggd2hlcmUgeCBpcyBub3QgbnVsbCBvcmRlciBieSB4IGxvb3AKICAgcGVyZm9ybSAxIGZyb20gcHVibGljLnNwYWNl
X21lbWJlcnMgc20gam9pbiBwdWJsaWMucGFydGljaXBhbnRzIHB0IG9uIHB0LmlkPXNtLnBhcnRpY2lwYW50X2lkIHdoZXJlIHNt
LnNwYWNlX2lkPXRyaXAgYW5kIHNtLnBhcnRpY2lwYW50X2lkPW1lbWJlciBhbmQgc20ucmVtb3ZlZF9hdCBpcyBudWxsIGFuZCAo
cHQua2luZD0nYWNjb3VudCdvciBjcmVhdG9yX21vZGUgYW5kIHB0LmtpbmQ9J21hbnVhbCcpZm9yIHNoYXJlIG9mIHNtLHB0Owog
ICBpZiBub3QgZm91bmQgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0ncm91dGVkX3BhcnRpY2lwYW50X2Rlbmll
ZCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKICAgaWYgbm90IGFjdG9ycyBAPiBqc29uYl9idWlsZF9hcnJheShtZW1iZXIpdGhl
biBhY3RvcnM6PWFjdG9yc3x8anNvbmJfYnVpbGRfYXJyYXkobWVtYmVyKTtlbmQgaWY7CiAgZW5kIGxvb3A7CiAgaWYgdmlhIGlz
IG5vdCBudWxsIGFuZCB2aWEgaW4oc2VuZGVyLHJlY2VpdmVyKXRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2lu
dmFsaWRfaW50ZXJtZWRpYXJ5JyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogIC0tIExvYWQgb25seSB0aGUgc2hhcmVkIHBhaXJz
IHVzZWQgYnkgdGhpcyBkcmFmdDsgdW5yZWxhdGVkIHBhaXJzIG5ldmVyIGVudGVyIERUT3MuCiAgZm9yIGUgaW4gc2VsZWN0IGpz
b25iX2J1aWxkX29iamVjdCgnZnJvbScsc2VuZGVyLCd0bycscmVjZWl2ZXIpdW5pb24gYWxsIHNlbGVjdCBqc29uYl9idWlsZF9v
YmplY3QoJ2Zyb20nLHNlbmRlciwndG8nLHZpYSl3aGVyZSB2aWEgaXMgbm90IG51bGwgdW5pb24gYWxsIHNlbGVjdCBqc29uYl9i
dWlsZF9vYmplY3QoJ2Zyb20nLHZpYSwndG8nLHJlY2VpdmVyKXdoZXJlIHZpYSBpcyBub3QgbnVsbCBsb29wCiAgIGs6PShlLT4+
J2Zyb20nKXx8JzonfHwoZS0+Pid0bycpOwogICBpZiBub3QgZWRnZXMgPyBrIHRoZW4KICAgIGU6PWNhc2Ugd2hlbiBuZXRfbW9k
ZSB0aGVuIHByaXZhdGUuY29udHJhX25ldF9lZGdlKHRyaXAsKGUtPj4nZnJvbScpOjp1dWlkLChlLT4+J3RvJyk6OnV1aWQsbixk
KWVsc2UgcHJpdmF0ZS5yb3V0ZWRfZWRnZSh0cmlwLChlLT4+J2Zyb20nKTo6dXVpZCwoZS0+Pid0bycpOjp1dWlkLG4sZCllbmQ7
ZWRnZXM6PWVkZ2VzfHxqc29uYl9idWlsZF9vYmplY3QoayxlKTtsZWZ0czo9bGVmdHN8fGpzb25iX2J1aWxkX29iamVjdChrLGUt
PidtaW5vcicpOwogICBlbmQgaWY7CiAgZW5kIGxvb3A7CiAgYW1vdW50Oj0ocC0+Pid0ZW5kZXJNaW5vcicpOjpiaWdpbnQ7aWYg
YW1vdW50PD0wIHRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2ludmFsaWRfYW1vdW50JyxlcnJjb2RlPSdQMDAw
MSc7ZW5kIGlmOwogIHZhbHVlOj1jYXNlIHdoZW4gbmV0X21vZGUgdGhlbiBwcml2YXRlLmNvbnRyYV92YWx1ZShhbW91bnQscC0+
Pid0ZW5kZXJDdXJyZW5jeScsbixkKWVsc2UgcHJpdmF0ZS5yb3V0ZWRfdmFsdWUoYW1vdW50LHAtPj4ndGVuZGVyQ3VycmVuY3kn
LG4sZCllbmQ7cm91dGU6PTA7CiAgcDo9anNvbmJfc3RyaXBfbnVsbHMoanNvbmJfYnVpbGRfb2JqZWN0KCdpZCcscC0+PidpZCcs
J3BheWVyJyxzZW5kZXIsJ3JlY2lwaWVudCcscmVjZWl2ZXIsJ3RlbmRlckN1cnJlbmN5JyxwLT4+J3RlbmRlckN1cnJlbmN5Jywn
dGVuZGVyTWlub3InLGFtb3VudCwnbWV0aG9kJyxwLT4+J21ldGhvZCcsJ3ZpYScsY2FzZSB3aGVuIHZpYSBpcyBub3QgbnVsbCB0
aGVuIGpzb25iX2J1aWxkX29iamVjdCgncGVyc29uJyx2aWEpfHxjYXNlIHdoZW4gcC0+J3ZpYScgPyAnbWlub3InIHRoZW4ganNv
bmJfYnVpbGRfb2JqZWN0KCdtaW5vcicscC0+J3ZpYSctPidtaW5vcicpZWxzZSAne30nOjpqc29uYiBlbmQgZWxzZSBudWxsIGVu
ZCkpOwogIGlmIHZhbHVlPTAgdGhlbiBpc3N1ZXM6PWlzc3Vlc3x8anNvbmJfYnVpbGRfYXJyYXkoanNvbmJfYnVpbGRfb2JqZWN0
KCdjb2RlJywnWkVST19WQUxVRScsJ3BheW1lbnRJZHMnLGpzb25iX2J1aWxkX2FycmF5KHAtPj4naWQnKSkpO2VuZCBpZjsKICBp
ZiB2aWEgaXMgbm90IG51bGwgdGhlbgogICBjYXA6PWxlYXN0KHZhbHVlLChlZGdlcy0+KHNlbmRlcjo6dGV4dHx8JzonfHx2aWE6
OnRleHQpLT4+J21pbm9yJyk6OmJpZ2ludCwoZWRnZXMtPih2aWE6OnRleHR8fCc6J3x8cmVjZWl2ZXI6OnRleHQpLT4+J21pbm9y
Jyk6OmJpZ2ludCk7CiAgIGlmIGNhcDw9MCB0aGVuIGlzc3Vlczo9aXNzdWVzfHxqc29uYl9idWlsZF9hcnJheShqc29uYl9idWls
ZF9vYmplY3QoJ2NvZGUnLCdOT19PUEVOX1JPVVRFJywncGF5bWVudElkcycsanNvbmJfYnVpbGRfYXJyYXkocC0+PidpZCcpKSk7
ZW5kIGlmOwogICBpZiBwLT4ndmlhJyA/ICdtaW5vcidhbmQgY29hbGVzY2UocC0+J3ZpYSctPj4nbWlub3InLCcnKSF+J15bMC05
XXsxLDE2fSQndGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0naW52YWxpZF9hbW91bnQnLGVycmNvZGU9J1AwMDAx
JztlbmQgaWY7CiAgIHJvdXRlOj1jb2FsZXNjZSgocC0+J3ZpYSctPj4nbWlub3InKTo6YmlnaW50LGNhcCk7CiAgIGlmIHJvdXRl
PDAgb3Igcm91dGU+dmFsdWUgb3Iocm91dGU9MCBhbmQgY2FwPjApdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0n
aW52YWxpZF9yb3V0ZWRfYW1vdW50JyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogICBmb3IgayBpbiBzZWxlY3Qgc2VuZGVyOjp0
ZXh0fHwnOid8fHZpYTo6dGV4dCB1bmlvbiBhbGwgc2VsZWN0IHZpYTo6dGV4dHx8JzonfHxyZWNlaXZlcjo6dGV4dCBsb29wCiAg
ICByZXNlcnZlZDo9cmVzZXJ2ZWR8fGpzb25iX2J1aWxkX29iamVjdChrLGNvYWxlc2NlKChyZXNlcnZlZC0+PmspOjpiaWdpbnQs
MCkrcm91dGUpOwogICAgdG90YWxzOj10b3RhbHN8fGpzb25iX2J1aWxkX29iamVjdChrLGNvYWxlc2NlKHRvdGFscy0+aywnW10n
KXx8anNvbmJfYnVpbGRfYXJyYXkocC0+PidpZCcpKTsKICAgZW5kIGxvb3A7CiAgZW5kIGlmOwogIGxpbmVzOj1saW5lc3x8anNv
bmJfYnVpbGRfYXJyYXkoanNvbmJfYnVpbGRfb2JqZWN0KCdwYXltZW50JyxwLCd2YWx1ZU1pbm9yJyx2YWx1ZSwndmlhTWlub3In
LHJvdXRlLCdkaXJlY3RNaW5vcicsMCwndW5hcHBsaWVkTWlub3InLHZhbHVlLXJvdXRlKSk7CiBlbmQgbG9vcDsKIGlmIG1vZGU9
J3N5c3RlbScgdGhlbgogIGlmIGV4aXN0cyhzZWxlY3QgMSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKHBheW1lbnRzKXEgd2hl
cmUgcS0+Pid0ZW5kZXJDdXJyZW5jeSc9Y2FzZSB3aGVuIG5ldF9tb2RlIHRoZW4nVk5EJ2Vsc2UnTVlSJ2VuZClvciBleGlzdHMo
c2VsZWN0IDEgZnJvbSBqc29uYl9lYWNoKGVkZ2VzKWVkZ2UgY3Jvc3Mgam9pbiBsYXRlcmFsIGpzb25iX2FycmF5X2VsZW1lbnRz
KGVkZ2UudmFsdWUtPiduYXRpdmUnKWxlZyB3aGVyZSBsZWctPj4nY3VycmVuY3knPWNhc2Ugd2hlbiBuZXRfbW9kZSB0aGVuJ1ZO
RCdlbHNlJ01ZUidlbmQpdGhlbgogICBpZiBuIGlzIG51bGwgb3IgZCBpcyBudWxsIG9yIG48PTAgb3IgZDw9MCBvciBxdW90ZS0+
Pidwcm92aWRlcidpcyBudWxsIG9yIHF1b3RlLT4+J3JhdGVEYXRlJ2lzIG51bGwgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcg
bWVzc2FnZT0nZnhfcmF0ZV91bmF2YWlsYWJsZScsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKICAgaWYgc25hcHNob3QgaXMgZGlz
dGluY3QgZnJvbSBudWxsaWYoZHJhZnQtPj4nc25hcHNob3RJZCcsJycpOjp1dWlkIHRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5n
IG1lc3NhZ2U9J3F1b3RlX2NoYW5nZWQnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiAgZWxzZSBuOj0xO2Q6PTE7cXVvdGU6PWpz
b25iX2J1aWxkX29iamVjdCgnbnVtZXJhdG9yJywnMScsJ2Rlbm9taW5hdG9yJywnMScsJ3NvdXJjZScsJ2lkZW50aXR5Jyk7ZW5k
IGlmOwogZW5kIGlmOwogLS0gQWdncmVnYXRlZCBhY3R1YWwgY2FzaCBtdXN0IGV4cGxhaW4gdGhlIHNhbWUgdmFsdWU7IHNwbGl0
dGluZyBNWVIgY2VudHMKIC0tIGFjcm9zcyBwYXllZXMgbXVzdCBub3QgbWFudWZhY3R1cmUgYSBWTkQgb2YgZXh0cmEgbmF0aXZl
IGNvdmVyYWdlLgogZm9yIGNhc2hfZ3JvdXAgaW4gc2VsZWN0IHEtPidwYXltZW50Jy0+PidwYXllcicgcGF5ZXIscS0+J3BheW1l
bnQnLT4+J3RlbmRlckN1cnJlbmN5JyBjb2RlLHN1bSgocS0+J3BheW1lbnQnLT4+J3RlbmRlck1pbm9yJyk6OmJpZ2ludCk6OmJp
Z2ludCBhbW91bnQsc3VtKChxLT4+J3ZhbHVlTWlub3InKTo6YmlnaW50KTo6YmlnaW50IGVxdWl2YWxlbnQsanNvbmJfYWdnKHEt
PidwYXltZW50Jy0+PidpZCcpIGlkcyBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKGxpbmVzKXEgZ3JvdXAgYnkgMSwyIGxvb3AK
ICBpZiAoY2FzZSB3aGVuIG5ldF9tb2RlIHRoZW4gcHJpdmF0ZS5jb250cmFfdmFsdWUoY2FzaF9ncm91cC5hbW91bnQsY2FzaF9n
cm91cC5jb2RlLG4sZCllbHNlIHByaXZhdGUucm91dGVkX3ZhbHVlKGNhc2hfZ3JvdXAuYW1vdW50LGNhc2hfZ3JvdXAuY29kZSxu
LGQpZW5kKTw+Y2FzaF9ncm91cC5lcXVpdmFsZW50IHRoZW4gaXNzdWVzOj1pc3N1ZXN8fGpzb25iX2J1aWxkX2FycmF5KGpzb25i
X2J1aWxkX29iamVjdCgnY29kZScsJ05BVElWRV9QUkVDSVNJT04nLCdwYXltZW50SWRzJyxjYXNoX2dyb3VwLmlkcykpO2VuZCBp
ZjsKIGVuZCBsb29wOwogZm9yIGssdG90YWwgaW4gc2VsZWN0IGVudHJ5LmtleSxlbnRyeS52YWx1ZTo6dGV4dDo6YmlnaW50IGZy
b20ganNvbmJfZWFjaChyZXNlcnZlZCllbnRyeSBsb29wCiAgY2FwOj0oZWRnZXMtPmstPj4nbWlub3InKTo6YmlnaW50OwogIGlm
IHRvdGFsPmNhcCB0aGVuIGlzc3Vlczo9aXNzdWVzfHxqc29uYl9idWlsZF9hcnJheShqc29uYl9idWlsZF9vYmplY3QoJ2NvZGUn
LCdTSEFSRURfTElNSVQnLCdwYXltZW50SWRzJyx0b3RhbHMtPmssJ2NhcGFjaXR5TWlub3InLGNhcCkpO2VuZCBpZjsKIGVuZCBs
b29wOwogaWYganNvbmJfYXJyYXlfbGVuZ3RoKGlzc3Vlcyk9MCB0aGVuCiAgZm9yIGssdG90YWwgaW4gc2VsZWN0IGVudHJ5Lmtl
eSxlbnRyeS52YWx1ZTo6dGV4dDo6YmlnaW50IGZyb20ganNvbmJfZWFjaChyZXNlcnZlZCllbnRyeSBsb29wIGxlZnRzOj1sZWZ0
c3x8anNvbmJfYnVpbGRfb2JqZWN0KGssKGxlZnRzLT4+ayk6OmJpZ2ludC10b3RhbCk7ZW5kIGxvb3A7CiAgZm9yIGxpbmUgaW4g
c2VsZWN0IHEgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhsaW5lcylxIGxvb3AKICAgcDo9bGluZS0+J3BheW1lbnQnO2s6PShw
LT4+J3BheWVyJyl8fCc6J3x8KHAtPj4ncmVjaXBpZW50Jyk7dW5hcHBsaWVkOj0obGluZS0+Pid1bmFwcGxpZWRNaW5vcicpOjpi
aWdpbnQ7CiAgIGRpcmVjdDo9bGVhc3QodW5hcHBsaWVkLChsZWZ0cy0+PmspOjpiaWdpbnQpO2xlZnRzOj1sZWZ0c3x8anNvbmJf
YnVpbGRfb2JqZWN0KGssKGxlZnRzLT4+ayk6OmJpZ2ludC1kaXJlY3QpOwogICBpZiBkaXJlY3Q+MCB0aGVuIHRvdGFsczo9dG90
YWxzfHxqc29uYl9idWlsZF9vYmplY3Qoayxjb2FsZXNjZSh0b3RhbHMtPmssJ1tdJyl8fGpzb25iX2J1aWxkX2FycmF5KHAtPj4n
aWQnKSk7ZW5kIGlmOwogICBpZiB1bmFwcGxpZWQ+ZGlyZWN0IHRoZW4gaXNzdWVzOj1pc3N1ZXN8fGpzb25iX2J1aWxkX2FycmF5
KGpzb25iX2J1aWxkX29iamVjdCgnY29kZScsJ1VOQVBQTElFRF9DQVNIJywncGF5bWVudElkcycsanNvbmJfYnVpbGRfYXJyYXko
cC0+PidpZCcpKSk7ZW5kIGlmOwogICBuZXh0X2xpbmVzOj1uZXh0X2xpbmVzfHxqc29uYl9idWlsZF9hcnJheShsaW5lfHxqc29u
Yl9idWlsZF9vYmplY3QoJ2RpcmVjdE1pbm9yJyxkaXJlY3QsJ3VuYXBwbGllZE1pbm9yJyx1bmFwcGxpZWQtZGlyZWN0KSk7CiAg
ZW5kIGxvb3A7bGluZXM6PW5leHRfbGluZXM7CiBlbmQgaWY7CiBmb3IgayxlIGluIHNlbGVjdCBlbnRyeS5rZXksZW50cnkudmFs
dWUgZnJvbSBqc29uYl9lYWNoKGVkZ2VzKWVudHJ5IG9yZGVyIGJ5IGVudHJ5LmtleSBsb29wCiAgdG90YWw6PShlLT4+J21pbm9y
Jyk6OmJpZ2ludC0obGVmdHMtPj5rKTo6YmlnaW50O25ldDo9MDsKICBpZiBuZXRfbW9kZSB0aGVuCiAgIHJlc29sdmVkOj1wcml2
YXRlLmNvbnRyYV9yZXNvbHZlX25hdGl2ZShlLHRvdGFsLG4sZCk7CiAgIGlmIHJlc29sdmVkIGlzIG51bGwgdGhlbiBuZXQ6PS0x
O2Vsc2UgbmF0aXZlOj1uYXRpdmV8fHJlc29sdmVkO25ldDo9dG90YWw7ZW5kIGlmOwogIGVsc2UKICBmb3IgbGVnIGluIHNlbGVj
dCBxIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMoZS0+J25hdGl2ZScpcSBsb29wCiAgIGNvdmVyZWQ6PWNhc2Ugd2hlbiB0b3Rh
bD0wIHRoZW4gMCBlbHNlIGxlYXN0KChsZWctPj4nbWlub3InKTo6YmlnaW50LHByaXZhdGUuZnhfcm91bmRfZGl2KChsZWctPj4n
bWlub3InKTo6bnVtZXJpYyp0b3RhbCwoZS0+PidtaW5vcicpOjpudW1lcmljKSllbmQ7CiAgIGlmIGNvdmVyZWQ+MCB0aGVuIG5h
dGl2ZTo9bmF0aXZlfHxqc29uYl9idWlsZF9hcnJheShqc29uYl9idWlsZF9vYmplY3QoJ2VkZ2VJZCcsaywnZnJvbScsbGVnLT4n
ZnJvbScsJ3RvJyxsZWctPid0bycsJ2N1cnJlbmN5JyxsZWctPidjdXJyZW5jeScsJ21pbm9yJyxjb3ZlcmVkKSk7ZW5kIGlmOwog
ICBuZXQ6PW5ldCtjYXNlIHdoZW4gbGVnLT4+J2Zyb20nPWUtPj4nZnJvbSd0aGVuIDEgZWxzZSAtMSBlbmQqcHJpdmF0ZS5yb3V0
ZWRfdmFsdWUoY292ZXJlZCxsZWctPj4nY3VycmVuY3knLG4sZCk7CiAgIHJlbWFpbmluZzo9cmVtYWluaW5nfHxqc29uYl9idWls
ZF9hcnJheShqc29uYl9idWlsZF9vYmplY3QoJ2lkJyxrfHwnOid8fChsZWctPj4nY3VycmVuY3knKXx8JzonfHwobGVnLT4+J2Zy
b20nKSwnZnJvbScsbGVnLT4nZnJvbScsJ3RvJyxsZWctPid0bycsJ2N1cnJlbmN5JyxsZWctPidjdXJyZW5jeScsJ21pbm9yJywo
bGVnLT4+J21pbm9yJyk6OmJpZ2ludC1jb3ZlcmVkKSk7CiAgZW5kIGxvb3A7CiAgZW5kIGlmOwogIC0tIE5vIHVuZXhwbGFpbmVk
IHRvbGVyYW5jZTogbmF0aXZlIGNvdmVyYWdlIG11c3QgZXhwbGFpbiB0aGUgcGFpcmVkIHZhbHVlLgogIGlmIHRvdGFsPjAgYW5k
IG5ldDw+dG90YWwgdGhlbiBpc3N1ZXM6PWlzc3Vlc3x8anNvbmJfYnVpbGRfYXJyYXkoanNvbmJfYnVpbGRfb2JqZWN0KCdjb2Rl
JywnTkFUSVZFX1BSRUNJU0lPTicsJ3BheW1lbnRJZHMnLHRvdGFscy0+aykpO2VuZCBpZjsKICBzb3VyY2VzOj1zb3VyY2VzfHxq
c29uYl9idWlsZF9hcnJheShlKTsKIGVuZCBsb29wOwogaWYganNvbmJfYXJyYXlfbGVuZ3RoKGlzc3Vlcyk+MCB0aGVuIG5hdGl2
ZTo9J1tdJzo6anNvbmI7cmVtYWluaW5nOj0nW10nOjpqc29uYjtzZWxlY3QganNvbmJfYWdnKHF8fGpzb25iX2J1aWxkX29iamVj
dCgndmlhTWlub3InLDAsJ2RpcmVjdE1pbm9yJywwLCd1bmFwcGxpZWRNaW5vcicscS0+J3ZhbHVlTWlub3InKSlpbnRvIGxpbmVz
IGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMobGluZXMpcTtmb3IgZSBpbiBzZWxlY3QgZW50cnkudmFsdWUgZnJvbSBqc29uYl9l
YWNoKGVkZ2VzKWVudHJ5IGxvb3AgcmVtYWluaW5nOj1yZW1haW5pbmd8fGUtPiduYXRpdmUnO2VuZCBsb29wO2VuZCBpZjsKIHJl
dHVybiBqc29uYl9idWlsZF9vYmplY3QoJ2xlZGdlckN1cnJlbmN5JyxjYXNlIHdoZW4gbmV0X21vZGUgdGhlbidNWVInZWxzZSdW
TkQnZW5kLCdsaW5lcycsbGluZXMsJ2lzc3VlcycsaXNzdWVzLCdyZW1haW5pbmcnLHJlbWFpbmluZywncmF0ZScscXVvdGUsJ25h
dGl2ZScsbmF0aXZlLCdzb3VyY2VzJyxzb3VyY2VzLCdhY3RvcnMnLGFjdG9ycyl8fGNhc2Ugd2hlbiBuZXRfbW9kZSB0aGVuIGpz
b25iX2J1aWxkX29iamVjdCgnZWRnZUJhc2lzJywnbmV0JywnY29udHJhUXVvdGUnLGNxKWVsc2UgJ3t9Jzo6anNvbmIgZW5kOwpl
bmQgJCQ7CgpjcmVhdGUgb3IgcmVwbGFjZSBmdW5jdGlvbiBwcml2YXRlLmNyZWF0b3Jfbm9ybWFsaXplKGRyYWZ0IGpzb25iKQpy
ZXR1cm5zIGpzb25iIGxhbmd1YWdlIHBscGdzcWwgc3RhYmxlIHNldCBzZWFyY2hfcGF0aD0nJyBhcyAkJAojdmFyaWFibGVfY29u
ZmxpY3QgdXNlX3ZhcmlhYmxlCmRlY2xhcmUgb2NjdXJyZWQgdGltZXN0YW1wdHo7bGlua3MganNvbmI7bGluayBqc29uYjtyZXN1
bHQganNvbmI7cmVwbGFjZW1lbnQgdXVpZDsKYmVnaW4KIGlmIGpzb25iX3R5cGVvZihkcmFmdClpcyBkaXN0aW5jdCBmcm9tJ29i
amVjdCdvciBleGlzdHMoc2VsZWN0IDEgZnJvbSBqc29uYl9vYmplY3Rfa2V5cyhkcmFmdClrIHdoZXJlIGsgbm90IGluKCdyYXRl
TW9kZScsJ3ZuZFBlck15cicsJ3NuYXBzaG90SWQnLCdwYXltZW50cycsJ29jY3VycmVkQXQnLCdub3RlJywnb3duQWNjb3VudExp
bmtzJywncmVwbGFjZW1lbnRGb3InLCdlZGdlQmFzaXMnLCdjb250cmFTbmFwc2hvdCcpKXRoZW4gcmFpc2UgZXhjZXB0aW9uIHVz
aW5nIG1lc3NhZ2U9J2NyZWF0b3JfaW52YWxpZF9kcmFmdCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKIGlmIGNvYWxlc2NlKGRy
YWZ0LT4+J29jY3VycmVkQXQnLCcnKSF+J15bMC05XXs0fS1bMC05XXsyfS1bMC05XXsyfVRbMC05XXsyfTpbMC05XXsyfSg6WzAt
OV17Mn0oXC5bMC05XXsxLDZ9KT8pPyhafFsrLV1bMC05XXsyfTpbMC05XXsyfSkkJ3RoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5n
IG1lc3NhZ2U9J2NyZWF0b3JfaW52YWxpZF90aW1lJyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogYmVnaW4gb2NjdXJyZWQ6PShk
cmFmdC0+PidvY2N1cnJlZEF0Jyk6OnRpbWVzdGFtcHR6O2V4Y2VwdGlvbiB3aGVuIG90aGVycyB0aGVuIHJhaXNlIGV4Y2VwdGlv
biB1c2luZyBtZXNzYWdlPSdjcmVhdG9yX2ludmFsaWRfdGltZScsZXJyY29kZT0nUDAwMDEnO2VuZDsKIGlmIG9jY3VycmVkIGlz
IG51bGwgb3Igbm90IGlzZmluaXRlKG9jY3VycmVkKXRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2NyZWF0b3Jf
aW52YWxpZF90aW1lJyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogaWYgZHJhZnQgPyAnbm90ZSdhbmQganNvbmJfdHlwZW9mKGRy
YWZ0LT4nbm90ZScpaXMgZGlzdGluY3QgZnJvbSdzdHJpbmcnb3IgbGVuZ3RoKGNvYWxlc2NlKGRyYWZ0LT4+J25vdGUnLCcnKSk+
NTAwIHRoZW4gcmFpc2UgZXhjZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2NyZWF0b3JfaW52YWxpZF9ub3RlJyxlcnJjb2RlPSdQMDAw
MSc7ZW5kIGlmOwogaWYgZHJhZnQgPyAnZWRnZUJhc2lzJ29yIGRyYWZ0ID8gJ2NvbnRyYVNuYXBzaG90J3RoZW4KICBpZiBkcmFm
dC0+PidlZGdlQmFzaXMnaXMgZGlzdGluY3QgZnJvbSduZXQnb3IganNvbmJfdHlwZW9mKGRyYWZ0LT4nY29udHJhU25hcHNob3Qn
KWlzIGRpc3RpbmN0IGZyb20nb2JqZWN0J29yIGNvYWxlc2NlKGRyYWZ0LT4nY29udHJhU25hcHNob3QnLT4+J3JldmlzaW9uJywn
JykhfideW2EtZjAtOV17NjR9JCdvciBleGlzdHMoc2VsZWN0IDEgZnJvbSBqc29uYl9vYmplY3Rfa2V5cyhkcmFmdC0+J2NvbnRy
YVNuYXBzaG90JylrIHdoZXJlIGsgbm90IGluKCdyZXZpc2lvbicsJ2Rpc3BsYXlDdXJyZW5jeScpKXRoZW4gcmFpc2UgZXhjZXB0
aW9uIHVzaW5nIG1lc3NhZ2U9J2ludmFsaWRfY29udHJhX3NuYXBzaG90JyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogZW5kIGlm
OwogbGlua3M6PWNvYWxlc2NlKGRyYWZ0LT4nb3duQWNjb3VudExpbmtzJywnW10nOjpqc29uYik7CiBpZiBqc29uYl90eXBlb2Yo
bGlua3MpaXMgZGlzdGluY3QgZnJvbSdhcnJheSdvciBqc29uYl9hcnJheV9sZW5ndGgobGlua3MpPjUwIHRoZW4gcmFpc2UgZXhj
ZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2NyZWF0b3JfaW52YWxpZF9hY2NvdW50X2xpbmsnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7
CiBmb3IgbGluayBpbiBzZWxlY3QgcSBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKGxpbmtzKXEgbG9vcAogIGlmIGpzb25iX3R5
cGVvZihsaW5rKWlzIGRpc3RpbmN0IGZyb20nb2JqZWN0J29yIGNvYWxlc2NlKGxpbmstPj4ncGF5bWVudElkJywnJykhfideW0Et
WmEtejAtOV8tXXsxLDgwfSQnb3IgY29hbGVzY2UobGluay0+PidhY2NvdW50SWQnLCcnKSF+KideWzAtOWEtZl17OH0tWzAtOWEt
Zl17NH0tWzAtOWEtZl17NH0tWzAtOWEtZl17NH0tWzAtOWEtZl17MTJ9JCdvciBleGlzdHMoc2VsZWN0IDEgZnJvbSBqc29uYl9v
YmplY3Rfa2V5cyhsaW5rKWsgd2hlcmUgayBub3QgaW4oJ3BheW1lbnRJZCcsJ2FjY291bnRJZCcpKXRoZW4gcmFpc2UgZXhjZXB0
aW9uIHVzaW5nIG1lc3NhZ2U9J2NyZWF0b3JfaW52YWxpZF9hY2NvdW50X2xpbmsnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiBl
bmQgbG9vcDsKIGlmKHNlbGVjdCBjb3VudCgqKWZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMobGlua3MpKTw+KHNlbGVjdCBjb3Vu
dChkaXN0aW5jdCBxLT4+J3BheW1lbnRJZCcpZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhsaW5rcylxKXRoZW4gcmFpc2UgZXhj
ZXB0aW9uIHVzaW5nIG1lc3NhZ2U9J2NyZWF0b3JfaW52YWxpZF9hY2NvdW50X2xpbmsnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7
CiBzZWxlY3QgY29hbGVzY2UoanNvbmJfYWdnKGpzb25iX2J1aWxkX29iamVjdCgncGF5bWVudElkJyxxLT4+J3BheW1lbnRJZCcs
J2FjY291bnRJZCcsbG93ZXIocS0+PidhY2NvdW50SWQnKSlvcmRlciBieSBxLT4+J3BheW1lbnRJZCcpLCdbXSc6Ompzb25iKWlu
dG8gbGlua3MgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhsaW5rcylxOwogaWYgZHJhZnQgPyAncmVwbGFjZW1lbnRGb3IndGhl
bgogIGJlZ2luIHJlcGxhY2VtZW50Oj0oZHJhZnQtPj4ncmVwbGFjZW1lbnRGb3InKTo6dXVpZDtleGNlcHRpb24gd2hlbiBvdGhl
cnMgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0nY3JlYXRvcl9pbnZhbGlkX3JlcGxhY2VtZW50JyxlcnJjb2Rl
PSdQMDAwMSc7ZW5kOwogIGlmIHJlcGxhY2VtZW50IGlzIG51bGwgdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0n
Y3JlYXRvcl9pbnZhbGlkX3JlcGxhY2VtZW50JyxlcnJjb2RlPSdQMDAwMSc7ZW5kIGlmOwogZW5kIGlmOwogcmVzdWx0Oj0oZHJh
ZnQtJ29jY3VycmVkQXQnLSdub3RlJy0nb3duQWNjb3VudExpbmtzJy0ncmVwbGFjZW1lbnRGb3InKXx8anNvbmJfYnVpbGRfb2Jq
ZWN0KCdvY2N1cnJlZEF0Jyx0b19jaGFyKG9jY3VycmVkIGF0IHRpbWUgem9uZSAnVVRDJywnWVlZWS1NTS1ERCJUIkhIMjQ6TUk6
U1MuVVMiWiInKSwnbm90ZScsYnRyaW0oY29hbGVzY2UoZHJhZnQtPj4nbm90ZScsJycpKSwnb3duQWNjb3VudExpbmtzJyxsaW5r
cyk7CiBpZiByZXBsYWNlbWVudCBpcyBub3QgbnVsbCB0aGVuIHJlc3VsdDo9cmVzdWx0fHxqc29uYl9idWlsZF9vYmplY3QoJ3Jl
cGxhY2VtZW50Rm9yJyxyZXBsYWNlbWVudCk7ZW5kIGlmO3JldHVybiByZXN1bHQ7CmVuZCQkOwoKY3JlYXRlIG9yIHJlcGxhY2Ug
ZnVuY3Rpb24gcHJpdmF0ZS5jcmVhdG9yX3Bvc3QodGFyZ2V0IHV1aWQpCnJldHVybnMgdm9pZCBsYW5ndWFnZSBwbHBnc3FsIHNl
Y3VyaXR5IGRlZmluZXIgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCiN2YXJpYWJsZV9jb25mbGljdCB1c2VfdmFyaWFibGUKZGVj
bGFyZSByZWMgcHJpdmF0ZS5jcmVhdG9yX3JlY29yZHMlcm93dHlwZTtsaW5lIGpzb25iO2xlZyBqc29uYjtsaW5rIGpzb25iO3Bp
ZCB1dWlkO2UganNvbmI7c3RhdGVzIGpzb25iOj0nW10nOjpqc29uYjtwYXltZW50X2RheSBkYXRlOwpiZWdpbgogc2VsZWN0ICog
aW50byByZWMgZnJvbSBwcml2YXRlLmNyZWF0b3JfcmVjb3JkcyByIHdoZXJlIHIuaWQ9dGFyZ2V0OwogcGF5bWVudF9kYXk6PShy
ZWMub2NjdXJyZWRfYXQgYXQgdGltZSB6b25lIHJlYy50aW1lX3pvbmUpOjpkYXRlOwogZm9yIGxpbmUgaW4gc2VsZWN0IHEgZnJv
bSBqc29uYl9hcnJheV9lbGVtZW50cyhyZWMucGxhbi0+J2xpbmVzJylxIGxvb3AKICBpbnNlcnQgaW50byBwdWJsaWMuc2V0dGxl
bWVudF9wYXltZW50cyhjbGllbnRfcmVxdWVzdF9pZCxzY29wZSxzcGFjZV9pZCxkZWJ0b3JfcGFydGljaXBhbnRfaWQsY3VycmVu
Y3ksYW1vdW50X21pbm9yLHBheW1lbnRfZGF0ZSxzdGF0dXMsbm90ZSxmeF9jYXNoX29ubHksY2FzaF90cmFja2luZ19yZXF1aXJl
ZCkKICB2YWx1ZXMocHJpdmF0ZS5tb25leV9jaGlsZF9yZXF1ZXN0KHJlYy5yZXF1ZXN0X2lkLCdjcmVhdG9yOmNhc2g6J3x8KGxp
bmUtPidwYXltZW50Jy0+PidpZCcpKSwnc3BhY2UnLHJlYy5zcGFjZV9pZCwobGluZS0+J3BheW1lbnQnLT4+J3BheWVyJyk6OnV1
aWQsbGluZS0+J3BheW1lbnQnLT4+J3RlbmRlckN1cnJlbmN5JywobGluZS0+J3BheW1lbnQnLT4+J3RlbmRlck1pbm9yJyk6OmJp
Z2ludCxwYXltZW50X2RheSwnY29uZmlybWVkJywnZngtY2FzaCcsdHJ1ZSxmYWxzZSlyZXR1cm5pbmcgaWQgaW50byBwaWQ7CiAg
aW5zZXJ0IGludG8gcHVibGljLnNldHRsZW1lbnRfYWxsb2NhdGlvbnMoc2V0dGxlbWVudF9wYXltZW50X2lkLGNyZWRpdG9yX3Bh
cnRpY2lwYW50X2lkLGFtb3VudF9taW5vcixzdGF0ZSxyZXNwb25kZWRfYXQpdmFsdWVzKHBpZCwobGluZS0+J3BheW1lbnQnLT4+
J3JlY2lwaWVudCcpOjp1dWlkLChsaW5lLT4ncGF5bWVudCctPj4ndGVuZGVyTWlub3InKTo6YmlnaW50LCdhY2NlcHRlZCcsbm93
KCkpOwogIGluc2VydCBpbnRvIHByaXZhdGUuY3JlYXRvcl9yZWNlaXB0cyhyZWNvcmRfaWQscGF5bWVudF9pZCxraW5kLGxpbmVf
aWQpdmFsdWVzKHJlYy5pZCxwaWQsJ2Nhc2gnLGxpbmUtPidwYXltZW50Jy0+PidpZCcpOwogIGluc2VydCBpbnRvIHB1YmxpYy5m
aW5hbmNpYWxfZXZlbnRzKGFjdG9yX3BhcnRpY2lwYW50X2lkLHNldHRsZW1lbnRfcGF5bWVudF9pZCxldmVudF90eXBlLHNhZmVf
ZGlmZil2YWx1ZXMocmVjLnJlY29yZGVkX2J5LHBpZCwnc2V0dGxlbWVudC5jcmVhdG9yX2Nhc2hfcG9zdGVkJyxqc29uYl9idWls
ZF9vYmplY3QoJ3JlY29yZF9pZCcscmVjLmlkLCdsaW5lX2lkJyxsaW5lLT4ncGF5bWVudCctPj4naWQnLCdtZXRob2QnLGxpbmUt
PidwYXltZW50Jy0+PidtZXRob2QnLCdvY2N1cnJlZF9hdCcscmVjLm9jY3VycmVkX2F0KSk7CiBlbmQgbG9vcDsKIGZvciBsZWcg
aW4gc2VsZWN0IHEgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhyZWMucGxhbi0+J25hdGl2ZScpcSBsb29wCiAgaW5zZXJ0IGlu
dG8gcHVibGljLnNldHRsZW1lbnRfcGF5bWVudHMoY2xpZW50X3JlcXVlc3RfaWQsc2NvcGUsc3BhY2VfaWQsZGVidG9yX3BhcnRp
Y2lwYW50X2lkLGN1cnJlbmN5LGFtb3VudF9taW5vcixwYXltZW50X2RhdGUsc3RhdHVzLG5vdGUsZnhfY2FzaF9vbmx5LGNhc2hf
dHJhY2tpbmdfcmVxdWlyZWQpCiAgdmFsdWVzKHByaXZhdGUubW9uZXlfY2hpbGRfcmVxdWVzdChyZWMucmVxdWVzdF9pZCwnY3Jl
YXRvcjpjb3ZlcmFnZTonfHwobGVnLT4+J2VkZ2VJZCcpfHwnOid8fChsZWctPj4nY3VycmVuY3knKXx8JzonfHwobGVnLT4+J2Zy
b20nKSksJ3NwYWNlJyxyZWMuc3BhY2VfaWQsKGxlZy0+Pidmcm9tJyk6OnV1aWQsbGVnLT4+J2N1cnJlbmN5JywobGVnLT4+J21p
bm9yJyk6OmJpZ2ludCxwYXltZW50X2RheSwnY29uZmlybWVkJywnZngtY292ZXJhZ2UnLGZhbHNlLGZhbHNlKXJldHVybmluZyBp
ZCBpbnRvIHBpZDsKICBpbnNlcnQgaW50byBwdWJsaWMuc2V0dGxlbWVudF9hbGxvY2F0aW9ucyhzZXR0bGVtZW50X3BheW1lbnRf
aWQsY3JlZGl0b3JfcGFydGljaXBhbnRfaWQsYW1vdW50X21pbm9yLHN0YXRlLHJlc3BvbmRlZF9hdCl2YWx1ZXMocGlkLChsZWct
Pj4ndG8nKTo6dXVpZCwobGVnLT4+J21pbm9yJyk6OmJpZ2ludCwnYWNjZXB0ZWQnLG5vdygpKTsKICBpbnNlcnQgaW50byBwcml2
YXRlLmNyZWF0b3JfcmVjZWlwdHMocmVjb3JkX2lkLHBheW1lbnRfaWQsa2luZCl2YWx1ZXMocmVjLmlkLHBpZCwnY292ZXJhZ2Un
KTsKICBpbnNlcnQgaW50byBwdWJsaWMuZmluYW5jaWFsX2V2ZW50cyhhY3Rvcl9wYXJ0aWNpcGFudF9pZCxzZXR0bGVtZW50X3Bh
eW1lbnRfaWQsZXZlbnRfdHlwZSxzYWZlX2RpZmYpdmFsdWVzKHJlYy5yZWNvcmRlZF9ieSxwaWQsJ3NldHRsZW1lbnQuY3JlYXRv
cl9jb3ZlcmFnZV9wb3N0ZWQnLGpzb25iX2J1aWxkX29iamVjdCgncmVjb3JkX2lkJyxyZWMuaWQsJ2N1cnJlbmN5JyxsZWctPj4n
Y3VycmVuY3knLCdtaW5vcicsbGVnLT4nbWlub3InKXx8anNvbmJfc3RyaXBfbnVsbHMoanNvbmJfYnVpbGRfb2JqZWN0KCdhcHBs
aWNhdGlvbicsbGVnLT4nYXBwbGljYXRpb24nLCdsZWRnZXJfY3VycmVuY3knLGxlZy0+J2xlZGdlckN1cnJlbmN5JywnY29udHJh
X2VxdWl2YWxlbnRfbWlub3InLGxlZy0+J2NvbnRyYUVxdWl2YWxlbnRNaW5vcicsJ3JlcGF5bWVudF9lcXVpdmFsZW50X21pbm9y
JyxsZWctPidyZXBheW1lbnRFcXVpdmFsZW50TWlub3InLCdlZGdlX2lkJyxjYXNlIHdoZW4gbGVnID8gJ2FwcGxpY2F0aW9uJ3Ro
ZW4gbGVnLT4nZWRnZUlkJ2VuZCkpKTsKIGVuZCBsb29wOwogZm9yIGxpbmsgaW4gc2VsZWN0IHEgZnJvbSBqc29uYl9hcnJheV9l
bGVtZW50cyhyZWMuZHJhZnQtPidvd25BY2NvdW50TGlua3MnKXEgb3JkZXIgYnkgcS0+PidhY2NvdW50SWQnLHEtPj4ncGF5bWVu
dElkJ2xvb3AgcGVyZm9ybSBwcml2YXRlLmNyZWF0b3JfbGlua19jYXNoKHJlYy5pZCxsaW5rLT4+J3BheW1lbnRJZCcscmVjLnJl
Y29yZGVkX2J5LChsaW5rLT4+J2FjY291bnRJZCcpOjp1dWlkKTtlbmQgbG9vcDsKIGZvciBlIGluIHNlbGVjdCBxIGZyb20ganNv
bmJfYXJyYXlfZWxlbWVudHMocmVjLnBsYW4tPidzb3VyY2VzJylxIGxvb3Agc3RhdGVzOj1zdGF0ZXN8fGpzb25iX2J1aWxkX2Fy
cmF5KHByaXZhdGUucm91dGVkX2VkZ2UocmVjLnNwYWNlX2lkLChlLT4+J2Zyb20nKTo6dXVpZCwoZS0+Pid0bycpOjp1dWlkLChy
ZWMucGxhbi0+J3JhdGUnLT4+J251bWVyYXRvcicpOjpudW1lcmljLChyZWMucGxhbi0+J3JhdGUnLT4+J2Rlbm9taW5hdG9yJyk6
Om51bWVyaWMpKTtlbmQgbG9vcDsKIHVwZGF0ZSBwcml2YXRlLmNyZWF0b3JfcmVjb3JkcyBzZXQgYWZ0ZXJfc3RhdGU9c3RhdGVz
IHdoZXJlIGlkPXJlYy5pZDsKZW5kJCQ7CgpjcmVhdGUgb3IgcmVwbGFjZSBmdW5jdGlvbiBwcml2YXRlLnBvc3Rfcm91dGVkX3By
b3Bvc2FsKHRhcmdldCB1dWlkKQpyZXR1cm5zIHZvaWQgbGFuZ3VhZ2UgcGxwZ3NxbCBzZWN1cml0eSBkZWZpbmVyIHNldCBzZWFy
Y2hfcGF0aD0nJyBhcyAkJAojdmFyaWFibGVfY29uZmxpY3QgdXNlX3ZhcmlhYmxlCmRlY2xhcmUgcCBwcml2YXRlLnRyaXBfcm91
dGVkX3Byb3Bvc2FscyVyb3d0eXBlO2xpbmUganNvbmI7bGVnIGpzb25iO3JvbGUgdGV4dDtvd25lciB1dWlkO2FjY291bnQgdXVp
ZDtwaWQgdXVpZDthaWQgdXVpZDtjYXNoX2xlZyB1dWlkO2F1dGgganNvbmI7c2F2ZWQganNvbmI7c3RhdGVzIGpzb25iOj0nW10n
Ojpqc29uYjtlIGpzb25iO24gbnVtZXJpYztkIG51bWVyaWM7CmJlZ2luCiBzZWxlY3QgKiBpbnRvIHAgZnJvbSBwcml2YXRlLnRy
aXBfcm91dGVkX3Byb3Bvc2FscyB3aGVyZSBpZD10YXJnZXQ7CiAtLSBWYWxpZGF0ZSBFVkVSWSBzYXZlZCBvd25lciBhdXRob3Jp
emF0aW9uIGJlZm9yZSB0aGUgZmlyc3QgY2FzaCB3cml0ZS4KIGZvciBsaW5lIGluIHNlbGVjdCBxIGZyb20ganNvbmJfYXJyYXlf
ZWxlbWVudHMocC5wbGFuLT4nbGluZXMnKXEgbG9vcAogIGZvciByb2xlLG93bmVyIGluIHNlbGVjdCdwYXllcicsKGxpbmUtPidw
YXltZW50Jy0+PidwYXllcicpOjp1dWlkIHVuaW9uIGFsbCBzZWxlY3QncmVjZWl2ZXInLChsaW5lLT4ncGF5bWVudCctPj4ncmVj
aXBpZW50Jyk6OnV1aWQgbG9vcAogICBzZWxlY3QgYS5hdXRob3JpemF0aW9ucy0+KChsaW5lLT4ncGF5bWVudCctPj4naWQnKXx8
JzonfHxyb2xlKWludG8gc2F2ZWQgZnJvbSBwcml2YXRlLnRyaXBfcm91dGVkX2FwcHJvdmFscyBhIHdoZXJlIGEucHJvcG9zYWw9
cC5pZCBhbmQgYS5hY3Rvcj1vd25lciBhbmQgYS5kZWNpc2lvbj0nYXBwcm92ZSc7CiAgIGF1dGg6PXByaXZhdGUudHJpcF9iYXRj
aF9hY2NvdW50KG93bmVyLChzYXZlZC0+PidpZCcpOjp1dWlkLGxpbmUtPidwYXltZW50Jy0+Pid0ZW5kZXJDdXJyZW5jeScpOwog
ICBpZiBzYXZlZCBpcyBkaXN0aW5jdCBmcm9tIGF1dGggdGhlbiByYWlzZSBleGNlcHRpb24gdXNpbmcgbWVzc2FnZT0ncm91dGVk
X2FjY291bnRfY2hhbmdlZCcsZXJyY29kZT0nUDAwMDEnO2VuZCBpZjsKICBlbmQgbG9vcDsKIGVuZCBsb29wOwogZm9yIGxpbmUg
aW4gc2VsZWN0IHEgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhwLnBsYW4tPidsaW5lcycpcSBsb29wCiAgaW5zZXJ0IGludG8g
cHVibGljLnNldHRsZW1lbnRfcGF5bWVudHMoY2xpZW50X3JlcXVlc3RfaWQsc2NvcGUsc3BhY2VfaWQsZGVidG9yX3BhcnRpY2lw
YW50X2lkLGN1cnJlbmN5LGFtb3VudF9taW5vcixwYXltZW50X2RhdGUsc3RhdHVzLG5vdGUsZnhfY2FzaF9vbmx5LGNhc2hfdHJh
Y2tpbmdfcmVxdWlyZWQpCiAgIHZhbHVlcyhwcml2YXRlLm1vbmV5X2NoaWxkX3JlcXVlc3QocC5yZXF1ZXN0X2lkLCdyb3V0ZWQ6
Y2FzaDonfHwobGluZS0+J3BheW1lbnQnLT4+J2lkJykpLCdzcGFjZScscC5zcGFjZV9pZCwobGluZS0+J3BheW1lbnQnLT4+J3Bh
eWVyJyk6OnV1aWQsbGluZS0+J3BheW1lbnQnLT4+J3RlbmRlckN1cnJlbmN5JywobGluZS0+J3BheW1lbnQnLT4+J3RlbmRlck1p
bm9yJyk6OmJpZ2ludCxjdXJyZW50X2RhdGUsJ3BlbmRpbmcnLCdmeC1jYXNoJyx0cnVlLHRydWUpcmV0dXJuaW5nIGlkIGludG8g
cGlkOwogIGluc2VydCBpbnRvIHB1YmxpYy5zZXR0bGVtZW50X2FsbG9jYXRpb25zKHNldHRsZW1lbnRfcGF5bWVudF9pZCxjcmVk
aXRvcl9wYXJ0aWNpcGFudF9pZCxhbW91bnRfbWlub3Isc3RhdGUpdmFsdWVzKHBpZCwobGluZS0+J3BheW1lbnQnLT4+J3JlY2lw
aWVudCcpOjp1dWlkLChsaW5lLT4ncGF5bWVudCctPj4ndGVuZGVyTWlub3InKTo6YmlnaW50LCdwZW5kaW5nJylyZXR1cm5pbmcg
aWQgaW50byBhaWQ7CiAgZm9yIHJvbGUsb3duZXIgaW4gc2VsZWN0J3BheWVyJywobGluZS0+J3BheW1lbnQnLT4+J3BheWVyJyk6
OnV1aWQgdW5pb24gYWxsIHNlbGVjdCdyZWNlaXZlcicsKGxpbmUtPidwYXltZW50Jy0+PidyZWNpcGllbnQnKTo6dXVpZCBsb29w
CiAgIHNlbGVjdChhLmFjY291bnRzLT4+KChsaW5lLT4ncGF5bWVudCctPj4naWQnKXx8JzonfHxyb2xlKSk6OnV1aWQgaW50byBh
Y2NvdW50IGZyb20gcHJpdmF0ZS50cmlwX3JvdXRlZF9hcHByb3ZhbHMgYSB3aGVyZSBhLnByb3Bvc2FsPXAuaWQgYW5kIGEuYWN0
b3I9b3duZXI7CiAgIGluc2VydCBpbnRvIHB1YmxpYy5wZXJzb25hbF9zZXR0bGVtZW50X2Nhc2hfbGVncyhvd25lcl9wYXJ0aWNp
cGFudF9pZCxjbGllbnRfcmVxdWVzdF9pZCxwYXlsb2FkX2ZpbmdlcnByaW50LHNldHRsZW1lbnRfcGF5bWVudF9pZCxzZXR0bGVt
ZW50X2FsbG9jYXRpb25faWQscm9sZSxhY2NvdW50X2lkLGNhc2hfYW1vdW50X21pbm9yLGFjY291bnRfY3VycmVuY3ksc2hhcmVk
X2Ftb3VudF9taW5vcixnaWZ0X2V4dHJhX21pbm9yLHN0YXR1cykKICAgIHZhbHVlcyhvd25lcixwcml2YXRlLm1vbmV5X2NoaWxk
X3JlcXVlc3QocC5yZXF1ZXN0X2lkLCdyb3V0ZWQ6J3x8KGxpbmUtPidwYXltZW50Jy0+PidpZCcpfHwnOid8fHJvbGUpLHByaXZh
dGUucGVyc29uYWxfcGF5bG9hZF9maW5nZXJwcmludChqc29uYl9idWlsZF9vYmplY3QoJ2FsbG9jYXRpb25faWQnLGFpZCwncm9s
ZScscm9sZSwnYWNjb3VudF9pZCcsYWNjb3VudCwnY2FzaF9hbW91bnRfbWlub3InLGxpbmUtPidwYXltZW50Jy0+J3RlbmRlck1p
bm9yJywnYWNjb3VudF9jdXJyZW5jeScsbGluZS0+J3BheW1lbnQnLT4+J3RlbmRlckN1cnJlbmN5Jywnc2hhcmVkX2Ftb3VudF9t
aW5vcicsbGluZS0+J3BheW1lbnQnLT4ndGVuZGVyTWlub3InLCdnaWZ0X2V4dHJhX21pbm9yJywwKSkscGlkLGFpZCxyb2xlLGFj
Y291bnQsKGxpbmUtPidwYXltZW50Jy0+Pid0ZW5kZXJNaW5vcicpOjpiaWdpbnQsbGluZS0+J3BheW1lbnQnLT4+J3RlbmRlckN1
cnJlbmN5JywobGluZS0+J3BheW1lbnQnLT4+J3RlbmRlck1pbm9yJyk6OmJpZ2ludCwwLCdwZW5kaW5nJylyZXR1cm5pbmcgaWQg
aW50byBjYXNoX2xlZzsKICAgcGVyZm9ybSBwcml2YXRlLnBvc3RfcGVyc29uYWxfc2V0dGxlbWVudF9jYXNoX2xlZyhjYXNoX2xl
Zyk7CiAgZW5kIGxvb3A7CiAgdXBkYXRlIHB1YmxpYy5zZXR0bGVtZW50X2FsbG9jYXRpb25zIHNldCBzdGF0ZT0nYWNjZXB0ZWQn
LHJlc3BvbmRlZF9hdD1ub3coKXdoZXJlIGlkPWFpZDsKICB1cGRhdGUgcHVibGljLnNldHRsZW1lbnRfcGF5bWVudHMgc2V0IHN0
YXR1cz0nY29uZmlybWVkJyx2ZXJzaW9uPXZlcnNpb24rMSB3aGVyZSBpZD1waWQ7CiAgaW5zZXJ0IGludG8gcHJpdmF0ZS50cmlw
X3JvdXRlZF9yZWNlaXB0cyB2YWx1ZXMocC5pZCxwaWQsJ2Nhc2gnLGxpbmUtPidwYXltZW50Jy0+PidpZCcpOwogIGluc2VydCBp
bnRvIHB1YmxpYy5maW5hbmNpYWxfZXZlbnRzKGFjdG9yX3BhcnRpY2lwYW50X2lkLHNldHRsZW1lbnRfcGF5bWVudF9pZCxldmVu
dF90eXBlLHNhZmVfZGlmZil2YWx1ZXMocHVibGljLmN1cnJlbnRfcGFydGljaXBhbnRfaWQoKSxwaWQsJ3NldHRsZW1lbnQucm91
dGVkX2Nhc2hfcG9zdGVkJyxqc29uYl9idWlsZF9vYmplY3QoJ3Byb3Bvc2FsX2lkJyxwLmlkLCdsaW5lX2lkJyxsaW5lLT4ncGF5
bWVudCctPj4naWQnLCdtZXRob2QnLGxpbmUtPidwYXltZW50Jy0+PidtZXRob2QnKSk7CiBlbmQgbG9vcDsKIGZvciBsZWcgaW4g
c2VsZWN0IHEgZnJvbSBqc29uYl9hcnJheV9lbGVtZW50cyhwLnBsYW4tPiduYXRpdmUnKXEgbG9vcAogIGluc2VydCBpbnRvIHB1
YmxpYy5zZXR0bGVtZW50X3BheW1lbnRzKGNsaWVudF9yZXF1ZXN0X2lkLHNjb3BlLHNwYWNlX2lkLGRlYnRvcl9wYXJ0aWNpcGFu
dF9pZCxjdXJyZW5jeSxhbW91bnRfbWlub3IscGF5bWVudF9kYXRlLHN0YXR1cyxub3RlLGZ4X2Nhc2hfb25seSxjYXNoX3RyYWNr
aW5nX3JlcXVpcmVkKQogICB2YWx1ZXMocHJpdmF0ZS5tb25leV9jaGlsZF9yZXF1ZXN0KHAucmVxdWVzdF9pZCwncm91dGVkOmNv
dmVyYWdlOid8fChsZWctPj4nZWRnZUlkJyl8fCc6J3x8KGxlZy0+PidjdXJyZW5jeScpfHwnOid8fChsZWctPj4nZnJvbScpKSwn
c3BhY2UnLHAuc3BhY2VfaWQsKGxlZy0+Pidmcm9tJyk6OnV1aWQsbGVnLT4+J2N1cnJlbmN5JywobGVnLT4+J21pbm9yJyk6OmJp
Z2ludCxjdXJyZW50X2RhdGUsJ2NvbmZpcm1lZCcsJ2Z4LWNvdmVyYWdlJyxmYWxzZSxmYWxzZSlyZXR1cm5pbmcgaWQgaW50byBw
aWQ7CiAgaW5zZXJ0IGludG8gcHVibGljLnNldHRsZW1lbnRfYWxsb2NhdGlvbnMoc2V0dGxlbWVudF9wYXltZW50X2lkLGNyZWRp
dG9yX3BhcnRpY2lwYW50X2lkLGFtb3VudF9taW5vcixzdGF0ZSxyZXNwb25kZWRfYXQpdmFsdWVzKHBpZCwobGVnLT4+J3RvJyk6
OnV1aWQsKGxlZy0+PidtaW5vcicpOjpiaWdpbnQsJ2FjY2VwdGVkJyxub3coKSk7CiAgaW5zZXJ0IGludG8gcHJpdmF0ZS50cmlw
X3JvdXRlZF9yZWNlaXB0cyB2YWx1ZXMocC5pZCxwaWQsJ2NvdmVyYWdlJyxudWxsKTsKICBpbnNlcnQgaW50byBwdWJsaWMuZmlu
YW5jaWFsX2V2ZW50cyhhY3Rvcl9wYXJ0aWNpcGFudF9pZCxzZXR0bGVtZW50X3BheW1lbnRfaWQsZXZlbnRfdHlwZSxzYWZlX2Rp
ZmYpdmFsdWVzKHB1YmxpYy5jdXJyZW50X3BhcnRpY2lwYW50X2lkKCkscGlkLCdzZXR0bGVtZW50LnJvdXRlZF9jb3ZlcmFnZV9w
b3N0ZWQnLGpzb25iX2J1aWxkX29iamVjdCgncHJvcG9zYWxfaWQnLHAuaWQsJ2N1cnJlbmN5JyxsZWctPj4nY3VycmVuY3knLCdt
aW5vcicsbGVnLT4nbWlub3InKXx8anNvbmJfc3RyaXBfbnVsbHMoanNvbmJfYnVpbGRfb2JqZWN0KCdhcHBsaWNhdGlvbicsbGVn
LT4nYXBwbGljYXRpb24nLCdsZWRnZXJfY3VycmVuY3knLGxlZy0+J2xlZGdlckN1cnJlbmN5JywnY29udHJhX2VxdWl2YWxlbnRf
bWlub3InLGxlZy0+J2NvbnRyYUVxdWl2YWxlbnRNaW5vcicsJ3JlcGF5bWVudF9lcXVpdmFsZW50X21pbm9yJyxsZWctPidyZXBh
eW1lbnRFcXVpdmFsZW50TWlub3InLCdlZGdlX2lkJyxjYXNlIHdoZW4gbGVnID8gJ2FwcGxpY2F0aW9uJ3RoZW4gbGVnLT4nZWRn
ZUlkJ2VuZCkpKTsKIGVuZCBsb29wOwogbjo9KHAucGxhbi0+J3JhdGUnLT4+J251bWVyYXRvcicpOjpudW1lcmljO2Q6PShwLnBs
YW4tPidyYXRlJy0+PidkZW5vbWluYXRvcicpOjpudW1lcmljOwogZm9yIGUgaW4gc2VsZWN0IHEgZnJvbSBqc29uYl9hcnJheV9l
bGVtZW50cyhwLnBsYW4tPidzb3VyY2VzJylxIGxvb3Agc3RhdGVzOj1zdGF0ZXN8fGpzb25iX2J1aWxkX2FycmF5KHByaXZhdGUu
cm91dGVkX2VkZ2UocC5zcGFjZV9pZCwoZS0+Pidmcm9tJyk6OnV1aWQsKGUtPj4ndG8nKTo6dXVpZCxuLGQpKTtlbmQgbG9vcDsK
IHVwZGF0ZSBwcml2YXRlLnRyaXBfcm91dGVkX3Byb3Bvc2FscyBzZXQgc3RhdHVzPSdwb3N0ZWQnLHBvc3RlZF9hdD1ub3coKSx2
ZXJzaW9uPXZlcnNpb24rMSxhZnRlcl9zdGF0ZT1zdGF0ZXMgd2hlcmUgaWQ9cC5pZDsKZW5kICQkOwoKLS0gUHJlc2VydmUgZXZl
cnkgb2xkIGZyb3plbiBwbGFuJ3MgcHJvamVjdGlvbiBhbmQgcmV2ZXJzYWwgY29udHJhY3QuCmRvICRsZWdhY3lfcHJvamVjdGlv
biQKZGVjbGFyZSBkZWZpbml0aW9uIHRleHQ7CmJlZ2luCiBkZWZpbml0aW9uOj1wZ19nZXRfZnVuY3Rpb25kZWYoJ3ByaXZhdGUu
cm91dGVkX3B1YmxpY19wbGFuKGpzb25iKSc6OnJlZ3Byb2NlZHVyZSk7CiBleGVjdXRlIHJlcGxhY2UoZGVmaW5pdGlvbiwnRlVO
Q1RJT04gcHJpdmF0ZS5yb3V0ZWRfcHVibGljX3BsYW4oJywgJ0ZVTkNUSU9OIHByaXZhdGUucm91dGVkX3B1YmxpY19wbGFuX3Yx
KCcpOwplbmQKJGxlZ2FjeV9wcm9qZWN0aW9uJDsKY3JlYXRlIGZ1bmN0aW9uIHByaXZhdGUuY29udHJhX3JlbWFpbmluZyhwbGFu
IGpzb25iKQpyZXR1cm5zIGpzb25iIGxhbmd1YWdlIHBscGdzcWwgaW1tdXRhYmxlIHNldCBzZWFyY2hfcGF0aD0nJyBhcyAkJAoj
dmFyaWFibGVfY29uZmxpY3QgdXNlX3ZhcmlhYmxlCmRlY2xhcmUgYmFsYW5jZXMganNvbmI7cm93cyBqc29uYjo9J1tdJzo6anNv
bmI7cGFpciByZWNvcmQ7ZGV0YWlsIGpzb25iO2xlZ3MganNvbmI7cSBqc29uYjo9cGxhbi0+J2NvbnRyYVF1b3RlJzsKYmVnaW4K
IHdpdGggb3JpZ2luYWxzIGFzKAogIHNlbGVjdCBuLT4+J2Zyb20nIGRlYnRvcixuLT4+J3RvJyBjcmVkaXRvcixuLT4+J2N1cnJl
bmN5JyBjdXJyZW5jeSxtYXgoKG4tPj4nbWlub3InKTo6YmlnaW50KSBhbW91bnQKICBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRz
KHBsYW4tPidzb3VyY2VzJylzIGNyb3NzIGpvaW4gbGF0ZXJhbCBqc29uYl9hcnJheV9lbGVtZW50cyhjb2FsZXNjZShzLT4nc3Rh
bmRpbmdOYXRpdmUnLHMtPiduYXRpdmUnKSluIGdyb3VwIGJ5IDEsMiwzCiApLHJlZHVjdGlvbnMgYXMoCiAgc2VsZWN0IG4tPj4n
ZnJvbScgZGVidG9yLG4tPj4ndG8nIGNyZWRpdG9yLG4tPj4nY3VycmVuY3knIGN1cnJlbmN5LHN1bSgobi0+PidtaW5vcicpOjpi
aWdpbnQpOjpiaWdpbnQgYW1vdW50IGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMocGxhbi0+J25hdGl2ZScpbiBncm91cCBieSAx
LDIsMwogKXNlbGVjdCBjb2FsZXNjZShqc29uYl9hZ2coanNvbmJfYnVpbGRfb2JqZWN0KCdmcm9tJyxvLmRlYnRvciwndG8nLG8u
Y3JlZGl0b3IsJ2N1cnJlbmN5JyxvLmN1cnJlbmN5LCdtaW5vcicsby5hbW91bnQtY29hbGVzY2Uoci5hbW91bnQsMCkpb3JkZXIg
Ynkgby5kZWJ0b3Isby5jcmVkaXRvcixvLmN1cnJlbmN5KSwnW10nKWludG8gYmFsYW5jZXMgZnJvbSBvcmlnaW5hbHMgbyBsZWZ0
IGpvaW4gcmVkdWN0aW9ucyByIHVzaW5nKGRlYnRvcixjcmVkaXRvcixjdXJyZW5jeSk7CiBpZiBleGlzdHMoc2VsZWN0IDEgZnJv
bSBqc29uYl9hcnJheV9lbGVtZW50cyhiYWxhbmNlcyluIHdoZXJlKG4tPj4nbWlub3InKTo6YmlnaW50PDApdGhlbiByYWlzZSBl
eGNlcHRpb24gdXNpbmcgbWVzc2FnZT0naW52YWxpZF9jb250cmFfc25hcHNob3QnLGVycmNvZGU9J1AwMDAxJztlbmQgaWY7CiBm
b3IgcGFpciBpbiBzZWxlY3QgZGlzdGluY3QgbGVhc3Qobi0+Pidmcm9tJyxuLT4+J3RvJylhLGdyZWF0ZXN0KG4tPj4nZnJvbScs
bi0+Pid0bycpYiBmcm9tIGpzb25iX2FycmF5X2VsZW1lbnRzKGJhbGFuY2VzKW4gb3JkZXIgYnkgMSwyIGxvb3AKICBzZWxlY3Qg
Y29hbGVzY2UoanNvbmJfYWdnKG4pLCdbXScpaW50byBsZWdzIGZyb20ganNvbmJfYXJyYXlfZWxlbWVudHMoYmFsYW5jZXMpbiB3
aGVyZSBuLT4+J2Zyb20naW4ocGFpci5hLHBhaXIuYilhbmQgbi0+Pid0bydpbihwYWlyLmEscGFpci5iKTsKICBkZXRhaWw6PXBy
aXZhdGUuY29udHJhX25hdGl2ZV9wYWlyKGxlZ3MscGFpci5hOjp1dWlkLHBhaXIuYjo6dXVpZCxxKTsKICBpZiBub3QoZGV0YWls
LT4+J2tub3duJyk6OmJvb2xlYW4gdGhlbiBkZXRhaWw6PXByaXZhdGUuY29udHJhX25hdGl2ZV9wYWlyKGxlZ3MscGFpci5hOjp1
dWlkLHBhaXIuYjo6dXVpZCxxfHxqc29uYl9idWlsZF9vYmplY3QoJ2Rpc3BsYXlDdXJyZW5jeScsJ1ZORCcpKTtlbmQgaWY7CiAg
aWYoZGV0YWlsLT4+J2tub3duJyk6OmJvb2xlYW4gYW5kKGRldGFpbC0+PiduZXRNaW5vcicpOjpiaWdpbnQ+MCB0aGVuIHJvd3M6
PXJvd3N8fGpzb25iX2J1aWxkX2FycmF5KGpzb25iX2J1aWxkX29iamVjdCgnaWQnLHBhaXIuYXx8JzonfHxwYWlyLmIsJ2Zyb20n
LGRldGFpbC0+J3BheWVyJywndG8nLGRldGFpbC0+J3JlY2lwaWVudCcsJ2N1cnJlbmN5JyxkZXRhaWwtPidjdXJyZW5jeScsJ21p
bm9yJyxkZXRhaWwtPiduZXRNaW5vcicpKTtlbmQgaWY7CiBlbmQgbG9vcDtyZXR1cm4gcm93czsKZW5kJCQ7CmNyZWF0ZSBvciBy
ZXBsYWNlIGZ1bmN0aW9uIHByaXZhdGUucm91dGVkX3B1YmxpY19wbGFuKHBsYW4ganNvbmIpCnJldHVybnMganNvbmIgbGFuZ3Vh
Z2UgcGxwZ3NxbCBpbW11dGFibGUgc2V0IHNlYXJjaF9wYXRoPScnIGFzICQkCmJlZ2luCiBpZiBwbGFuLT4+J2VkZ2VCYXNpcyc9
J25ldCd0aGVuIHJldHVybihwcml2YXRlLnJvdXRlZF9wdWJsaWNfcGxhbl92MShwbGFuKS0nY29udHJhUXVvdGUnKXx8anNvbmJf
YnVpbGRfb2JqZWN0KCdlZGdlQmFzaXMnLCduZXQnLCdyZW1haW5pbmcnLHByaXZhdGUuY29udHJhX3JlbWFpbmluZyhwbGFuKSwn
cmVtYWluaW5nRXN0aW1hdGVkJyx0cnVlKTtlbmQgaWY7CiByZXR1cm4gcHJpdmF0ZS5yb3V0ZWRfcHVibGljX3BsYW5fdjEocGxh
bik7CmVuZCQkOwoKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBwcml2YXRlLmNvbnRyYV9uYXRpdmVfYXVkaXQodXVpZCx1dWlkLHV1
aWQpZnJvbSBwdWJsaWMsYW5vbixhdXRoZW50aWNhdGVkOwpyZXZva2UgYWxsIG9uIGZ1bmN0aW9uIHByaXZhdGUuY29udHJhX3F1
b3RlKHRleHQsdGV4dCx0ZXh0KWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBw
cml2YXRlLmNvbnRyYV9kaXNwbGF5X3ZhbHVlKGJpZ2ludCx0ZXh0LGpzb25iKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRl
ZDsKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBwcml2YXRlLmNvbnRyYV9uYXRpdmVfcGFpcihqc29uYix1dWlkLHV1aWQsanNvbmIp
ZnJvbSBwdWJsaWMsYW5vbixhdXRoZW50aWNhdGVkOwpyZXZva2UgYWxsIG9uIGZ1bmN0aW9uIHByaXZhdGUuY29udHJhX3BhaXIo
dXVpZCx1dWlkLHV1aWQsanNvbmIpZnJvbSBwdWJsaWMsYW5vbixhdXRoZW50aWNhdGVkOwpyZXZva2UgYWxsIG9uIGZ1bmN0aW9u
IHByaXZhdGUuY29udHJhX21hdHJpeCh1dWlkLGpzb25iKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFs
bCBvbiBmdW5jdGlvbiBwcml2YXRlLmNvbnRyYV9ncm9zc19kaXNwbGF5KGpzb25iLHV1aWQsdXVpZCxqc29uYilmcm9tIHB1Ymxp
Yyxhbm9uLGF1dGhlbnRpY2F0ZWQ7CnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFfdmFsdWUoYmlnaW50LHRl
eHQsbnVtZXJpYyxudW1lcmljKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBw
cml2YXRlLmNvbnRyYV9uZXRfZWRnZSh1dWlkLHV1aWQsdXVpZCxudW1lcmljLG51bWVyaWMpZnJvbSBwdWJsaWMsYW5vbixhdXRo
ZW50aWNhdGVkOwpyZXZva2UgYWxsIG9uIGZ1bmN0aW9uIHByaXZhdGUuY29udHJhX3Jlc29sdmVfbmF0aXZlKGpzb25iLGJpZ2lu
dCxudW1lcmljLG51bWVyaWMpZnJvbSBwdWJsaWMsYW5vbixhdXRoZW50aWNhdGVkOwpyZXZva2UgYWxsIG9uIGZ1bmN0aW9uIHBy
aXZhdGUucm91dGVkX2J1aWxkX2NvcmUodXVpZCx1dWlkLGpzb25iLGJvb2xlYW4pZnJvbSBwdWJsaWMsYW5vbixhdXRoZW50aWNh
dGVkOwpyZXZva2UgYWxsIG9uIGZ1bmN0aW9uIHByaXZhdGUuY3JlYXRvcl9ub3JtYWxpemUoanNvbmIpZnJvbSBwdWJsaWMsYW5v
bixhdXRoZW50aWNhdGVkOwpyZXZva2UgYWxsIG9uIGZ1bmN0aW9uIHByaXZhdGUuY3JlYXRvcl9wb3N0KHV1aWQpZnJvbSBwdWJs
aWMsYW5vbixhdXRoZW50aWNhdGVkOwpyZXZva2UgYWxsIG9uIGZ1bmN0aW9uIHByaXZhdGUucG9zdF9yb3V0ZWRfcHJvcG9zYWwo
dXVpZClmcm9tIHB1YmxpYyxhbm9uLGF1dGhlbnRpY2F0ZWQ7CnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHJpdmF0ZS5jb250cmFf
cmVtYWluaW5nKGpzb25iKWZyb20gcHVibGljLGFub24sYXV0aGVudGljYXRlZDsKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBwcml2
YXRlLnJvdXRlZF9wdWJsaWNfcGxhbihqc29uYilmcm9tIHB1YmxpYyxhbm9uLGF1dGhlbnRpY2F0ZWQ7CnJldm9rZSBhbGwgb24g
ZnVuY3Rpb24gcHJpdmF0ZS5yb3V0ZWRfcHVibGljX3BsYW5fdjEoanNvbmIpZnJvbSBwdWJsaWMsYW5vbixhdXRoZW50aWNhdGVk
OwpyZXZva2UgYWxsIG9uIGZ1bmN0aW9uIHB1YmxpYy5yZWFkX3RyaXBfY29udHJhX3NuYXBzaG90KHV1aWQsdGV4dCx0ZXh0LHRl
eHQpZnJvbSBwdWJsaWMsYW5vbixhdXRoZW50aWNhdGVkOwpncmFudCBleGVjdXRlIG9uIGZ1bmN0aW9uIHB1YmxpYy5yZWFkX3Ry
aXBfY29udHJhX3NuYXBzaG90KHV1aWQsdGV4dCx0ZXh0LHRleHQpdG8gYXV0aGVudGljYXRlZDsKbm90aWZ5IHBncnN0LCdyZWxv
YWQgc2NoZW1hJzsKY29tbWl0Owo=
$contra_payload$,'base64'),'UTF8');
 if encode(extensions.digest(migration_sql,'sha256'),'hex')<>'6b6093c8aa8d3ce7a261be88475030c9a63e24eb3533352c215cdb8b01624801'then raise exception 'Incomplete contra payload';end if;
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
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_native_pair(jsonb,uuid,uuid,jsonb)'))is distinct from 'fca995dcf8e6d59c9570a623613c8f88'then raise exception 'Unexpected contra function: private.contra_native_pair(jsonb,uuid,uuid,jsonb)';end if;
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
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_resolve_native(jsonb,bigint,numeric,numeric)'))is distinct from '536919a8e140588c62f08894a759f22b'then raise exception 'Unexpected contra function: private.contra_resolve_native(jsonb,bigint,numeric,numeric)';end if;
 if has_function_privilege('anon','private.contra_resolve_native(jsonb,bigint,numeric,numeric)','EXECUTE')or has_function_privilege('authenticated','private.contra_resolve_native(jsonb,bigint,numeric,numeric)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('private.contra_remaining(jsonb)'))is distinct from 'bd1a4912a2ce2408b7b9f6244d429275'then raise exception 'Unexpected contra function: private.contra_remaining(jsonb)';end if;
 if has_function_privilege('anon','private.contra_remaining(jsonb)','EXECUTE')or has_function_privilege('authenticated','private.contra_remaining(jsonb)','EXECUTE')is distinct from false then raise exception 'Unexpected contra function privileges';end if;
 if(select provolatile from pg_proc where oid='private.creator_normalize(jsonb)'::regprocedure)<>'s'then raise exception 'Unexpected creator normalizer volatility';end if;
end;
$contra_install$;
notify pgrst,'reload schema';
commit;
select 'TABBY_TRIP_CONTRA_INSTALL_COMPLETE_20261112' as installation_status;
