-- =============================================================================
-- Phase 11 — Exports, quotas et supervision.
-- Exports tracés dans le journal d'audit, quotas d'usage par entreprise
-- (fenêtres de 10 minutes), sonde de santé sans donnée.
-- =============================================================================

-- Quotas par entreprise et par fenêtre de 10 minutes. Valeurs prudentes pour
-- le pilote ; elles deviendront des droits d'offre (Phase 16).
create function private.quota_limit(p_kind text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'export' then 30
    when 'upload' then 60
  end;
$$;

-- Consomme une unité de quota ; false si la limite de la fenêtre est atteinte.
create function public.consume_quota(p_business_id uuid, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := private.quota_limit(p_kind);
begin
  if not private.is_business_member(p_business_id) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if v_limit is null then
    raise exception 'quota inconnu' using errcode = '22023';
  end if;
  return private.hit_rate_limit('quota:' || p_kind || ':' || p_business_id, v_limit);
end;
$$;

-- Trace un export (type, nombre de lignes, période) après contrôle du rôle
-- et du quota. Renvoie false si le quota est atteint (rien n'est exporté).
create function public.log_export(
  p_business_id uuid,
  p_kind text,
  p_rows integer,
  p_from date,
  p_to date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_business_role(p_business_id, array['owner', 'manager']::public.business_role[]) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if p_kind not in ('customers', 'catalog', 'orders', 'payments', 'quotes', 'invoices') then
    raise exception 'export inconnu' using errcode = '22023';
  end if;
  if not private.hit_rate_limit('quota:export:' || p_business_id, private.quota_limit('export')) then
    return false;
  end if;
  perform private.write_audit(p_business_id, 'export.created', 'export', p_kind,
    jsonb_build_object('rows', p_rows, 'from', p_from, 'to', p_to));
  return true;
end;
$$;

-- Sonde de santé : vérifie que la base répond, sans rien révéler.
create function public.health_check()
returns boolean
language sql
stable
set search_path = ''
as $$
  select true;
$$;

revoke all on function private.quota_limit(text) from public, anon, authenticated;
revoke all on function public.consume_quota(uuid, text) from public, anon;
revoke all on function public.log_export(uuid, text, integer, date, date) from public, anon;
revoke all on function public.health_check() from public;
grant execute on function public.consume_quota(uuid, text) to authenticated;
grant execute on function public.log_export(uuid, text, integer, date, date) to authenticated;
grant execute on function public.health_check() to anon, authenticated;

create index if not exists audit_logs_business_id_idx on public.audit_logs (business_id, id desc);
