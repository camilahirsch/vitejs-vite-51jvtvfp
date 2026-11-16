-- Elo: pré-aprovação de gratuidade para um e-mail ainda não cadastrado.
-- O e-mail beneficiário é registrado somente no Supabase, nunca no repositório.
-- A concessão só se aplica à organização do próprio usuário cadastrado.
-- Preserva liberações/bloqueios já definidos manualmente.

begin;

create schema if not exists elo_internal;
revoke all on schema elo_internal from public, anon, authenticated;

create table if not exists elo_internal.preapproved_free_accounts (
  email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  approved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
revoke all on elo_internal.preapproved_free_accounts from public, anon, authenticated;

create or replace function elo_internal.apply_preapproved_free(
  p_user_id uuid,
  p_organization_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_approved_by uuid;
  v_inserted integer := 0;
begin
  -- Use only the immutable auth account identity, never user-editable metadata.
  select w.approved_by into v_approved_by
  from auth.users u
  join elo_internal.preapproved_free_accounts w
    on w.email = lower(btrim(u.email))
  join public.profiles p
    on p.id = u.id and p.organization_id = p_organization_id
  where u.id = p_user_id;

  if v_approved_by is null then
    return false;
  end if;

  -- Never override an explicit paid or blocked setting.
  insert into public.elo_access_grants
    (organization_id, mode, expires_on, updated_by)
  values
    (p_organization_id, 'free', null, v_approved_by)
  on conflict (organization_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    insert into public.elo_access_audit
      (organization_id, actor_id, old_mode, old_expires_on, new_mode, new_expires_on)
    values (p_organization_id, v_approved_by, null, null, 'free', null);
  end if;

  return v_inserted = 1;
end;
$fn$;

revoke all on function elo_internal.apply_preapproved_free(uuid,uuid)
  from public, anon, authenticated;

create or replace function elo_internal.apply_preapproved_free_on_profile_create()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
begin
  perform elo_internal.apply_preapproved_free(new.id, new.organization_id);
  return new;
end;
$fn$;

revoke all on function elo_internal.apply_preapproved_free_on_profile_create()
  from public, anon, authenticated;

drop trigger if exists elo_preapproved_free_on_profile_created on public.profiles;

create trigger elo_preapproved_free_on_profile_created
after insert on public.profiles
for each row
execute function elo_internal.apply_preapproved_free_on_profile_create();

commit;