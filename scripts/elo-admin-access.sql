-- Elo by Hirsch — controle de acesso comercial administrado pela Hirsch.
-- REVISÃO OBRIGATÓRIA antes da execução: faça backup e confira RLS existentes.
-- Não execute sem identificar a conta administradora no passo final.
-- Esta migração cria tabelas separadas e preserva organizações/contatos já existentes.

create table if not exists public.elo_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.elo_admins enable row level security;
revoke all on public.elo_admins from anon, authenticated;

create table if not exists public.elo_access_grants (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  mode text not null check (mode in ('free','courtesy','paid','trial','blocked')),
  expires_on date,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint elo_access_expiry_check check (
    (mode in ('courtesy','trial') and expires_on is not null)
    or (mode in ('free','paid','blocked') and expires_on is null)
  )
);
alter table public.elo_access_grants enable row level security;
revoke all on public.elo_access_grants from anon, authenticated;

create table if not exists public.elo_access_audit (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  old_mode text,
  old_expires_on date,
  new_mode text not null,
  new_expires_on date,
  changed_at timestamptz not null default now()
);
create index if not exists elo_access_audit_org_time
on public.elo_access_audit (organization_id, changed_at desc);
alter table public.elo_access_audit enable row level security;
revoke all on public.elo_access_audit from anon, authenticated;

create or replace function public.elo_is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (select 1 from public.elo_admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.elo_is_admin() from public;
grant execute on function public.elo_is_admin() to authenticated;

-- Check server-side que não expõe os registros de outras empresas.
-- Na ausência de concessão manual, mantém a regra comercial legada.
create or replace function public.elo_org_has_access(p_organization_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_org public.organizations%rowtype;
  v_mode text;
  v_until date;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.organization_id = p_organization_id
  ) then
    return false;
  end if;

  if public.elo_is_admin() then return true; end if;
  select * into v_org from public.organizations o where o.id = p_organization_id;
  if not found then return false; end if;
  select g.mode, g.expires_on into v_mode, v_until
  from public.elo_access_grants g where g.organization_id = p_organization_id;

  case v_mode
    when 'free' then return true;
    when 'paid' then return true; -- marcação MANUAL; não comprova pagamento
    when 'courtesy' then return v_until >= current_date;
    when 'trial' then return v_until >= current_date;
    when 'blocked' then return false;
    else return v_org.subscription_status = 'active'
      or v_org.trial_ends_at is null
      or v_org.trial_ends_at > now();
  end case;
end;
$$;
revoke all on function public.elo_org_has_access(uuid) from public;
grant execute on function public.elo_org_has_access(uuid) to authenticated;

create or replace function public.elo_my_access()
returns table (is_admin boolean, mode text, expires_on date, allowed boolean)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_org public.organizations%rowtype;
  v_grant public.elo_access_grants%rowtype;
  v_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'Sessão não autenticada';
  end if;
  select o.* into v_org from public.profiles p
  join public.organizations o on o.id = p.organization_id
  where p.id = auth.uid();
  if not found then raise exception 'Perfil ou organização não encontrados'; end if;
  select * into v_grant from public.elo_access_grants g where g.organization_id = v_org.id;
  v_admin := public.elo_is_admin();
  return query select
    v_admin,
    coalesce(v_grant.mode, case when v_org.subscription_status = 'active' then 'paid' else 'trial' end),
    coalesce(v_grant.expires_on,
      case when v_grant.mode is null then v_org.trial_ends_at::date else null end),
    public.elo_org_has_access(v_org.id);
end;
$$;
revoke all on function public.elo_my_access() from public;
grant execute on function public.elo_my_access() to authenticated;

create or replace function public.elo_admin_accounts()
returns table (
  organization_id uuid,
  organization_name text,
  mode text,
  expires_on date,
  allowed boolean,
  members bigint,
  member_summary text
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.elo_is_admin() then raise exception 'Acesso não autorizado'; end if;
  return query
  select
    o.id,
    o.name::text,
    coalesce(g.mode, case when o.subscription_status = 'active' then 'paid' else 'trial' end)::text,
    coalesce(g.expires_on, case when g.mode is null then o.trial_ends_at::date else null end),
    case
      when g.mode in ('free','paid') then true
      when g.mode in ('courtesy','trial') then g.expires_on >= current_date
      when g.mode = 'blocked' then false
      else o.subscription_status = 'active'
        or o.trial_ends_at is null
        or o.trial_ends_at > now()
    end,
    (select count(*) from public.profiles p where p.organization_id = o.id),
    (select string_agg(coalesce(nullif(p.full_name, ''), u.email, 'Integrante sem nome'), ', ' order by coalesce(nullif(p.full_name, ''), u.email))
     from public.profiles p
     left join auth.users u on u.id = p.id
     where p.organization_id = o.id)
  from public.organizations o
  left join public.elo_access_grants g on g.organization_id = o.id
  order by o.name;
end;
$$;
revoke all on function public.elo_admin_accounts() from public;
grant execute on function public.elo_admin_accounts() to authenticated;

create or replace function public.elo_admin_set_access(
  p_organization_id uuid,
  p_mode text,
  p_expires_on date default null
)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_previous public.elo_access_grants%rowtype;
begin
  if not public.elo_is_admin() then raise exception 'Acesso não autorizado'; end if;
  if p_mode is null or p_mode not in ('free','courtesy','paid','trial','blocked') then
    raise exception 'Modalidade inválida';
  end if;
  if p_mode in ('trial','courtesy') and (p_expires_on is null or p_expires_on < current_date) then
    raise exception 'Informe uma data de término igual ou posterior a hoje';
  end if;
  if p_mode in ('free','paid','blocked') and p_expires_on is not null then
    raise exception 'Esta modalidade não deve ter vencimento';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id) then
    raise exception 'Organização não encontrada';
  end if;

  select * into v_previous from public.elo_access_grants
  where organization_id = p_organization_id for update;

  insert into public.elo_access_grants (organization_id, mode, expires_on, updated_by, updated_at)
  values (p_organization_id, p_mode, p_expires_on, auth.uid(), now())
  on conflict (organization_id) do update
  set mode = excluded.mode,
      expires_on = excluded.expires_on,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  insert into public.elo_access_audit
    (organization_id, actor_id, old_mode, old_expires_on, new_mode, new_expires_on)
  values
    (p_organization_id, auth.uid(), v_previous.mode, v_previous.expires_on, p_mode, p_expires_on);
end;
$$;
revoke all on function public.elo_admin_set_access(uuid,text,date) from public;
grant execute on function public.elo_admin_set_access(uuid,text,date) to authenticated;

-- RESTRITIVAS: acrescentam a condição de entitlement às políticas RLS
-- existentes, em vez de substituí-las. Validar policies originais antes de aplicar.
-- Também impede leitura/escrita via API mesmo que alguém burle a tela de bloqueio.
alter table public.contacts enable row level security;
drop policy if exists elo_commercial_access on public.contacts;
create policy elo_commercial_access on public.contacts
  as restrictive for all to authenticated
  using (public.elo_org_has_access(organization_id))
  with check (public.elo_org_has_access(organization_id));

alter table public.tasks enable row level security;
drop policy if exists elo_commercial_access on public.tasks;
create policy elo_commercial_access on public.tasks
  as restrictive for all to authenticated
  using (public.elo_org_has_access(organization_id))
  with check (public.elo_org_has_access(organization_id));

-- Etapas do funil e histórico de interações também devem respeitar bloqueios.
-- O segundo histórico é opcional, pois só existe após instalar a melhoria de Contatos.
do $
begin
  if to_regclass('public.deal_stage_history') is not null then
    execute 'alter table public.deal_stage_history enable row level security';
    execute 'drop policy if exists elo_commercial_access on public.deal_stage_history';
    execute 'create policy elo_commercial_access on public.deal_stage_history
      as restrictive for all to authenticated
      using (public.elo_org_has_access(organization_id))
      with check (public.elo_org_has_access(organization_id))';
  end if;
  if to_regclass('public.contact_interactions') is not null then
    execute 'alter table public.contact_interactions enable row level security';
    execute 'drop policy if exists elo_commercial_access on public.contact_interactions';
    execute 'create policy elo_commercial_access on public.contact_interactions
      as restrictive for all to authenticated
      using (public.elo_org_has_access(organization_id))
      with check (public.elo_org_has_access(organization_id))';
  end if;
end $;

-- Protege contra mudança de assinatura/período pelo frontend.
-- Revise esta trigger se houver integração de cobrança que atualize estes campos.
create or replace function public.elo_prevent_customer_subscription_edit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (new.subscription_status is distinct from old.subscription_status
      or new.trial_ends_at is distinct from old.trial_ends_at)
    and auth.uid() is not null and not public.elo_is_admin() then
    raise exception 'Alterações de assinatura são restritas à administração';
  end if;
  return new;
end;
$$;
drop trigger if exists elo_prevent_customer_subscription_edit on public.organizations;
create trigger elo_prevent_customer_subscription_edit
  before update on public.organizations
  for each row execute function public.elo_prevent_customer_subscription_edit();

-- BOOTSTRAP MANUAL: substituir o endereço por aquele da conta que administrará o Elo
-- e executar SOMENTE após confirmar que é a conta correta.
-- insert into public.elo_admins (user_id)
-- select id from auth.users where lower(email) = lower('ADMIN@EXEMPLO.COM')
-- on conflict do nothing;
-- Após o bootstrap, conferir o SELECT na tabela elo_admins e realizar login novamente.
