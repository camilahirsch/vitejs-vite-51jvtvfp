-- Accept Cobrar as a contact status when recording individual interactions.
-- RLS, tenant checks and original function body are preserved.
begin;
CREATE OR REPLACE FUNCTION public.elo_record_contact_interaction(p_contact_id uuid, p_occurred_at date, p_kind text, p_note text, p_new_stage text, p_next_contact_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    ('novo','contato_feito','qualificado','proposta','negociacao','cobrar','ganho','perdido')
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
$function$;

revoke all on function public.elo_record_contact_interaction(uuid,date,text,text,text,date) from public,anon;
grant execute on function public.elo_record_contact_interaction(uuid,date,text,text,text,date) to authenticated;
commit;
