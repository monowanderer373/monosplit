begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
select ok(has_function_privilege('authenticated','public.insights_fx_health()','execute'),'authenticated operational FX evidence');
select ok(not has_function_privilege('anon','public.insights_fx_health()','execute'),'anonymous cannot call health');
select ok(not has_function_privilege('service_role','public.insights_fx_health()','execute'),'no service-role access');
select throws_ok('select public.insights_fx_health()','42501','authentication required','SQL anonymous rejected');
select * from finish();
rollback;
