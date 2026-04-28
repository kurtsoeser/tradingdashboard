create table if not exists public.user_app_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_user_app_data_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_app_data_updated_at on public.user_app_data;
create trigger trg_user_app_data_updated_at
before update on public.user_app_data
for each row
execute function public.set_user_app_data_updated_at();

alter table public.user_app_data enable row level security;

drop policy if exists "Users can read own app data" on public.user_app_data;
create policy "Users can read own app data"
on public.user_app_data
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own app data" on public.user_app_data;
create policy "Users can insert own app data"
on public.user_app_data
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own app data" on public.user_app_data;
create policy "Users can update own app data"
on public.user_app_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
