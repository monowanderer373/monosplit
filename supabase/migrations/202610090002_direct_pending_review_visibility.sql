-- Review visibility is separate from authority to classify confirmed money.
-- Keep can_read_expense unchanged: affiliations and other financial operations
-- retain the existing accepted-participant / historical-membership rules.
begin;

create function private.can_review_expense(target_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_read_expense(target_expense_id, public.current_participant_id())
    or exists (
      select 1
      from public.expenses as expense
      join public.expense_participations as participation on participation.expense_id = expense.id
      where expense.id = target_expense_id
        and expense.scope = 'direct'
        and participation.participant_id = public.current_participant_id()
        and participation.state = 'pending'
    );
$$;
revoke all on function private.can_review_expense(uuid) from public, anon, authenticated;
grant execute on function private.can_review_expense(uuid) to authenticated;

drop policy expenses_select_visible on public.expenses;
create policy expenses_select_visible on public.expenses for select to authenticated
  using (private.can_review_expense(id));

drop policy expense_participations_select_visible on public.expense_participations;
create policy expense_participations_select_visible on public.expense_participations for select to authenticated
  using (private.can_review_expense(expense_id));

drop policy expense_shares_select_visible on public.expense_shares;
create policy expense_shares_select_visible on public.expense_shares for select to authenticated
  using (private.can_review_expense(expense_id));

drop policy payer_contributions_select_visible on public.payer_contributions;
create policy payer_contributions_select_visible on public.payer_contributions for select to authenticated
  using (private.can_review_expense(expense_id));

commit;
