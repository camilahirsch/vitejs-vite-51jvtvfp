-- Elo — importação histórica de contatos e linha do tempo por prospect.
-- Migration additive: não exclui nem substitui registros existentes.
begin;
alter table public.contacts add column if not exists entry_date date;
alter table public.contacts add column if not exists first_contact_date date;

create table if not exists public.contact_interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  occurred_at date not null default current_date,
  kind text not null check (kind in ('whatsapp','ligacao','email','reuniao','cobranca','outro')),
  note text not null check (length(btrim(note)) > 0),
  from_stage text,
  to_stage text not null,
  next_contact_date date,
  created_at timestamptz not null default now()
);
create index if not exists contact_interactions_timeline_idx
  on public.contact_interactions(organization_id,contact_id,occurred_at desc,created_at desc);
alter table public.contact_interactions enable row level security;
revoke all on public.contact_interactions from public,anon,authenticated;
grant select on public.contact_interactions to authenticated;
drop policy if exists elo_contact_interactions_select on public.contact_interactions;
create policy elo_contact_interactions_select on public.contact_interactions
  for select to authenticated
  using (
    organization_id = (select public.get_my_organization_id())
    and public.elo_org_has_access(organization_id)
  );

create or replace function public.elo_record_contact_interaction(
  p_contact_id uuid,
  p_occurred_at date,
  p_kind text,
  p_note text,
  p_new_stage text,
  p_next_contact_date date default null
)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_contact public.contacts%rowtype;
  v_org_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Faça login para registrar uma interação'; end if;
  if p_contact_id is null or p_occurred_at is null or nullif(btrim(p_note),'') is null then
    raise exception 'Informe contato, data e observação';
  end if;
  if p_kind is null or p_kind not in ('whatsapp','ligacao','email','reuniao','cobranca','outro') then
    raise exception 'Tipo de contato inválido';
  end if;
  if p_new_stage is null or p_new_stage not in
    ('novo','contato_feito','qualificado','proposta','negociacao','ganho','perdido')
  then raise exception 'Status inválido'; end if;

  select p.organization_id into v_org_id from public.profiles p where p.id = auth.uid();
  if v_org_id is null or not public.elo_org_has_access(v_org_id) then
    raise exception 'Conta sem acesso ao CRM';
  end if;
  select * into v_contact from public.contacts
    where id = p_contact_id and organization_id = v_org_id
    for update;
  if not found then raise exception 'Contato não encontrado nessa organização'; end if;

  insert into public.contact_interactions
    (organization_id,contact_id,created_by,occurred_at,kind,note,from_stage,to_stage,next_contact_date)
  values
    (v_org_id,p_contact_id,auth.uid(),p_occurred_at,p_kind,btrim(p_note),
     v_contact.stage,p_new_stage,p_next_contact_date)
  returning id into v_id;

  update public.contacts set stage=p_new_stage,
    last_contact_date=greatest(coalesce(last_contact_date,p_occurred_at),p_occurred_at),
    next_reminder_date=p_next_contact_date
  where id=p_contact_id and organization_id=v_org_id;

  if v_contact.stage is distinct from p_new_stage then
    insert into public.deal_stage_history
      (organization_id,contact_id,from_stage,to_stage,changed_by)
    values (v_org_id,p_contact_id,v_contact.stage,p_new_stage,auth.uid());
  end if;
  return v_id;
end;
$$;
revoke all on function public.elo_record_contact_interaction(uuid,date,text,text,text,date)
  from public,anon,authenticated;
grant execute on function public.elo_record_contact_interaction(uuid,date,text,text,text,date)
  to authenticated;
commit;