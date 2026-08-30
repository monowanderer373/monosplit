-- Intentionally deterministic and empty.
-- Local resets enable seeding, but baseline-release does not create sample,
-- account, or financial rows.
do $$
begin
  null;
end
$$;
