-- Globale Revisionsnummer pro Nutzer: wird nach jedem erfolgreichen Full-Save hochgezählt.
-- Ermöglicht der App, zu erkennen, ob die Cloud neuer ist als der zuletzt geladene Stand in diesem Tab.

alter table public.user_settings
  add column if not exists cloud_data_revision bigint not null default 0,
  add column if not exists cloud_data_revision_at timestamptz;

comment on column public.user_settings.cloud_data_revision is 'Trading Dashboard: monoton steigend nach jedem vollständigen Cloud-Save.';
comment on column public.user_settings.cloud_data_revision_at is 'Zeitpunkt des letzten cloud_data_revision-Inkrements.';

create or replace function public.increment_user_cloud_revision(p_user_id uuid)
returns table(revision bigint, revision_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  update public.user_settings s
  set
    cloud_data_revision = coalesce(s.cloud_data_revision, 0) + 1,
    cloud_data_revision_at = now()
  where s.user_id = p_user_id
  returning s.cloud_data_revision, s.cloud_data_revision_at;
end;
$$;

grant execute on function public.increment_user_cloud_revision(uuid) to authenticated;
