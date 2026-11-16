-- Executar somente no SQL Editor do projeto Supabase correto, após backup.
-- Não remove nem altera registros já existentes.
alter table public.contacts
  add column if not exists first_contact_date date;

create table if not exists public.contact_interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  occurred_at date not null default current_date,
  note text not null check (length(btrim(note)) > 0),
  from_stage text not null,
  to_stage text not null,
  next_contact_date date,
  created_at timestamptz not null default now()
);

create index if not exists contact_interactions_org_contact_date_idx
on public.contact_interactions (organization_id, contact_id, occurred_at desc, created_at desc);

alter table public.contact_interactions enable row level security;
grant select on public.contact_interactions to authenticated;
drop policy if exists "Organization users can read contact interactions" on public.contact_interactions;
create policy "Organization users can read contact interactions"
on public.contact_interactions for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.organization_id = contact_interactions.organization_id
  )
);

-- A escrita é intermediada por uma função transacional que também atualiza o contato.
-- Evita observações gravadas sem atualização do estágio ou do próximo retorno.
create or replace function public.record_elo_contact_interaction(
  p_contact_id uuid,
  p_occurred_at date,
  p_note text,
  p_new_stage text,
  p_next_contact_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact public.contacts%rowtype;
  v_org uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Faça login para registrar uma interação';
  end if;
  if p_occurred_at is null or nullif(btrim(p_note), '') is null then
    raise exception 'Informe a data e a observação';
  end if;
  if p_new_stage is null or p_new_stage not in ('novo', 'contato_feito', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido') then
    raise exception 'Status inválido';
  end if;
  select * into v_contact from public.contacts where id = p_contact_id for update;
  if not found then raise exception 'Contato não encontrado'; end if;
  select p.organization_id into v_org
  from public.profiles p where p.id = auth.uid();
  if v_org is null or v_org <> v_contact.organization_id then
    raise exception 'Acesso não autorizado ao contato';
  end if;

  insert into public.contact_interactions
    (organization_id, contact_id, created_by, occurred_at, note, from_stage, to_stage, next_contact_date)
  values
    (v_org, p_contact_id, auth.uid(), p_occurred_at, btrim(p_note), v_contact.stage, p_new_stage, p_next_contact_date)
  returning id into v_id;

  update public.contacts set
    stage = p_new_stage,
    last_contact_date = greatest(coalesce(last_contact_date, p_occurred_at), p_occurred_at),
    next_reminder_date = p_next_contact_date
  where id = p_contact_id and organization_id = v_org;

  if v_contact.stage is distinct from p_new_stage then
    insert into public.deal_stage_history
      (organization_id, contact_id, from_stage, to_stage, changed_by)
    values
      (v_org, p_contact_id, v_contact.stage, p_new_stage, auth.uid());
  end if;
  return v_id;
end;
$$;

revoke all on function public.record_elo_contact_interaction(uuid, date, text, text, date) from public;
revoke all on function public.record_elo_contact_interaction(uuid, date, text, text, date) from anon;
grant execute on function public.record_elo_contact_interaction(uuid, date, text, text, date) to authenticated;
