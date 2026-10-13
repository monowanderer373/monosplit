-- Read-only operational evidence for this fixed public-reference task only.
-- No commands, headers, credentials, users or financial data are returned.
create function public.insights_fx_health() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare state tabby_fx.refresh_state; job cron.job; run cron.job_run_details;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into state from tabby_fx.refresh_state where singleton;
  select * into job from cron.job where jobname='tabby-insights-frankfurter-daily';
  select * into run from cron.job_run_details where jobid=job.jobid order by start_time desc limit 1;
  return jsonb_build_object('serverTime',now(),'snapshotId',state.snapshot_id,
    'attemptedAt',state.attempted_at,'succeededAt',state.succeeded_at,'failure',state.failure,
    'schedule',job.schedule,'active',job.active,'lastRunStatus',run.status,
    'lastRunStartedAt',run.start_time,'lastRunEndedAt',run.end_time);
end $$;
revoke all on function public.insights_fx_health() from public,anon,service_role;
grant execute on function public.insights_fx_health() to authenticated;
