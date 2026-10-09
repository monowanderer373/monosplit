-- Membership-history hardening must not hide a Direct invitation from its
-- recipient. Reading a pending share does not make it a confirmed balance.
begin;

create or replace function private.can_read_expense(
  target_expense_id uuid,
  viewer_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer_participant_id is not null and exists (
    select 1
    from public.expenses as expense
    where expense.id = target_expense_id
      and (
        expense.created_by = viewer_participant_id
        or exists (
          select 1
          from public.expense_participations as participation
          where participation.expense_id = expense.id
            and participation.participant_id = viewer_participant_id
            and (
              participation.state = 'accepted'
              or (expense.scope = 'direct' and participation.state = 'pending')
            )
        )
        or (
          expense.scope = 'space'
          and private.has_space_membership_at(
            expense.space_id,
            viewer_participant_id,
            expense.created_at
          )
        )
      )
  );
$$;

commit;
